#!/usr/bin/env bash
# ship.sh — เช็ก → commit → push (→ deploy ถ้าใส่ --deploy) ในคำสั่งเดียว
#   tools/ship.sh "ข้อความ commit ไทย" ไฟล์1 ไฟล์2 ...            (commit + push)
#   tools/ship.sh --deploy "ข้อความ" ไฟล์1 ไฟล์2 ...              (แล้ว deploy VPS ด้วย)
#   tools/ship.sh --deploy-only                                   (deploy ที่ push แล้ว)
# เพิ่มไฟล์ทีละไฟล์ตามรายการเท่านั้น (ไม่ใช้ git add .) • deploy ต้องมีคำสั่งจากเจ้าของเกมก่อนเรียก
set -euo pipefail
cd "$(dirname "$0")/.."
TRAILER="${SHIP_TRAILER:-Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>}"
DEPLOY=0; ONLY=0
[ "${1:-}" = "--deploy-only" ] && { ONLY=1; shift; }
[ "${1:-}" = "--deploy" ] && { DEPLOY=1; shift; }
if [ "$ONLY" = 0 ]; then
  [ $# -ge 2 ] || { echo "ใช้: tools/ship.sh [--deploy] \"ข้อความ\" ไฟล์..."; exit 2; }
  msg="$1"; shift
  for f in "$@"; do case "$f" in admin.key|data/*|backup/*|.env*|*.pem) echo "ห้าม commit: $f"; exit 2;; esac; done
  tools/check-all.sh
  git add -- "$@"
  git commit -q -m "$msg

$TRAILER"
  git push -q origin main
  echo "commit+push: $(git log -1 --format='%h %s')"
fi
if [ "$DEPLOY" = 1 ] || [ "$ONLY" = 1 ]; then
  ssh my-world 'cd /root/my-world && ./tools/deploy.sh -y' 2>&1 | grep -vE '^ผ่าน test-' | tail -12
  ssh my-world 'cd /root/my-world && echo "HEAD $(git rev-parse --short HEAD) healthz $(curl -s localhost:3000/healthz | head -c 20)"; free -m | sed -n 2p; ps aux | grep -E "[c]laude/remote.*server" | awk "{print \"claude-proc PID\",\$2,\"RSS\",\$6\"KB\"}"'
fi
