#!/usr/bin/env bash
# deploy.sh — อัปเดตเกมจริงบน VPS จาก GitHub ในคำสั่งเดียว (รันบน VPS)
#   ./tools/deploy.sh            ทดสอบ → ถามก่อน restart
#   ./tools/deploy.sh -y         ไม่ถาม (ใช้ตอนสั่งผ่าน ssh / agent ops หลังผู้ใช้ยืนยันแล้ว)
#   ./tools/deploy.sh --check    ทดสอบเวอร์ชันใหม่อย่างเดียว ไม่อัปเดตอะไร
#   ./tools/deploy.sh --restart  บังคับ restart แม้ไม่ได้แก้โค้ดฝั่งเซิร์ฟเวอร์
# ลำดับ: ทดสอบเวอร์ชันใหม่ในโฟลเดอร์ชั่วคราวก่อน (เกมจริงยังไม่ถูกแตะ) → ผ่านแล้วค่อย pull
#        → สำรอง data/ → restart เฉพาะเมื่อจำเป็น → เช็ก health → ไม่ผ่านย้อนกลับอัตโนมัติ
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BRANCH="${BRANCH:-main}"
SERVICE="${SERVICE:-my-world}"
RESTART_CMD="${RESTART_CMD:-systemctl restart $SERVICE}"
HEALTH_URL="${HEALTH_URL:-http://localhost:${PORT:-3000}/healthz}"
LOG="${DEPLOY_LOG:-$APP_DIR/backup/deploy.log}"
YES=0; CHECK_ONLY=0; FORCE_RESTART=0
for a in "$@"; do case "$a" in
  -y|--yes) YES=1 ;; --check) CHECK_ONLY=1 ;; --restart) FORCE_RESTART=1 ;;
  *) echo "ไม่รู้จักตัวเลือก: $a"; exit 1 ;; esac; done

cd "$APP_DIR"
mkdir -p backup/pre-deploy
say() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

# กันรันซ้อนกันสองหน้าต่าง
exec 9>"$APP_DIR/backup/.deploy.lock"
flock -n 9 || { echo "มี deploy อื่นกำลังรันอยู่"; exit 1; }

# บน VPS ห้ามมีงานค้างที่ยังไม่ commit (เช่น hotfix ที่ลืม push)
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  say "หยุด: มีไฟล์ถูกแก้บน VPS ที่ยังไม่ commit — commit+push หรือ git stash ก่อน"
  git status --short --untracked-files=no; exit 1
fi

OLD=$(git rev-parse HEAD)
git fetch -q origin "$BRANCH"
NEW=$(git rev-parse "origin/$BRANCH")
if ! git merge-base --is-ancestor "$OLD" "$NEW"; then
  say "หยุด: VPS มี commit ที่ GitHub ไม่มี (ไปแก้บน VPS แล้วไม่ได้ push) — push จาก VPS ก่อน"; exit 1
fi
if [ "$OLD" = "$NEW" ] && [ "$FORCE_RESTART" = 0 ]; then say "โค้ดล่าสุดอยู่แล้ว ($(git log -1 --format='%h %s'))"; exit 0; fi
CHANGED=$(git diff --name-only "$OLD" "$NEW")
say "อัปเดต $(git rev-parse --short "$OLD") → $(git rev-parse --short "$NEW") ($(echo "$CHANGED" | grep -c . || true) ไฟล์)"
git log --oneline -n 20 "$OLD..$NEW" # ไม่ใช้ | head: ใต้ pipefail ถ้ามีเกิน 20 commit git log โดน SIGPIPE แล้วสคริปต์จบ exit 141

# 1) ทดสอบเวอร์ชันใหม่ในโฟลเดอร์ชั่วคราว
TMP=$(mktemp -d)
cleanup() { git worktree remove --force "$TMP" >/dev/null 2>&1 || rm -rf "$TMP"; }
trap cleanup EXIT
git worktree add -q --detach "$TMP" "$NEW"
if echo "$CHANGED" | grep -qE '^package(-lock)?\.json$'; then
  (cd "$TMP" && npm ci --omit=dev --silent)
else
  ln -s "$APP_DIR/node_modules" "$TMP/node_modules"
fi
FAIL=0
for f in $(echo "$CHANGED" | grep -E '\.(c|m)?js$' || true); do
  [ -f "$TMP/$f" ] && { node --check "$TMP/$f" || { say "syntax พัง: $f"; FAIL=1; }; }
done
for t in "$TMP"/tools/test-*.js; do
  [ -e "$t" ] || continue
  if (cd "$TMP" && DATA_DIR="$TMP/.test-data" node "$t" >/tmp/deploy-test.out 2>&1); then echo "ผ่าน $(basename "$t")"
  else say "พัง $(basename "$t")"; tail -n 15 /tmp/deploy-test.out; FAIL=1; fi
done
[ "$FAIL" = 0 ] || { say "หยุด: เทสต์ไม่ผ่าน เกมจริงไม่ถูกแตะ"; exit 1; }
say "เทสต์ผ่านทั้งหมด"
[ "$CHECK_ONLY" = 1 ] && { say "--check: จบที่ทดสอบ"; exit 0; }

# 2) ต้อง restart ไหม (server.js / server/** / shared.js ที่เซิร์ฟเวอร์ require / dependency)
NEED_RESTART=$FORCE_RESTART
echo "$CHANGED" | grep -qE '^(server\.js|server/|public/shared\.js|shared/|package(-lock)?\.json)' && NEED_RESTART=1
if [ "$NEED_RESTART" = 1 ] && [ "$YES" = 0 ]; then
  read -r -p "ต้อง restart เกม ผู้เล่นที่ออนไลน์จะหลุดชั่วครู่ ทำเลยไหม? [y/N] " ans
  [ "$ans" = "y" ] || [ "$ans" = "Y" ] || { say "ยกเลิกโดยผู้ใช้ เกมจริงไม่ถูกแตะ"; exit 0; }
fi

# 3) สำรอง data/ ก่อนเปลี่ยน (เก็บ 10 ชุดล่าสุด)
if [ -d data ]; then
  SNAP="backup/pre-deploy/data-$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short "$OLD").tar.gz"
  tar czf "$SNAP" data && say "สำรองข้อมูล: $SNAP"
  ls -1t backup/pre-deploy/*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
fi

# 4) อัปเดตโค้ดจริง (public/* มีผลทันทีเพราะเสิร์ฟจากดิสก์)
git merge -q --ff-only "$NEW"
echo "$CHANGED" | grep -qE '^package(-lock)?\.json$' && npm ci --omit=dev --silent

health() { for i in $(seq 1 15); do curl -fsS -m 2 "$HEALTH_URL" 2>/dev/null | grep -qi ok && return 0; sleep 1; done; return 1; }
rollback() {
  say "ย้อนกลับไป $(git rev-parse --short "$OLD")"
  git reset -q --hard "$OLD"
  echo "$CHANGED" | grep -qE '^package(-lock)?\.json$' && npm ci --omit=dev --silent
  $RESTART_CMD || true
  if health; then say "ย้อนกลับสำเร็จ เกมกลับมาแล้ว — แก้โค้ดที่เครื่อง dev แล้ว push ใหม่ (หรือ git revert)"
  else say "ย้อนกลับแล้วแต่ health ยังไม่ผ่าน! ดู: journalctl -u $SERVICE -n 50 --no-pager"; fi
  exit 1
}

if [ "$NEED_RESTART" = 1 ]; then
  say "restart $SERVICE"
  $RESTART_CMD || rollback
  health && say "health ok" || { say "health ไม่ผ่านหลัง restart"; rollback; }
else
  say "แก้เฉพาะไฟล์หน้าเว็บ ไม่ต้อง restart (ผู้เล่นรีเฟรชก็เห็น)"
  health && say "health ok" || say "เตือน: health ไม่ผ่าน (แต่ไม่ได้ restart) ลองดู systemctl status $SERVICE"
fi
say "deploy เสร็จ: $(git log -1 --format='%h %s')"
