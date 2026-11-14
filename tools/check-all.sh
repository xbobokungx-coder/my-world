#!/usr/bin/env bash
# check-all.sh — ตรวจก่อน commit ในคำสั่งเดียว พิมพ์สั้นๆ (ประหยัดโทเคน)
#   tools/check-all.sh          node --check ไฟล์ .js ที่แก้/ใหม่ + รันทุก tools/test-*.js ทีละไฟล์
#   tools/check-all.sh --quick  แค่ node --check (ไม่รันเทสต์)
# ผ่านทั้งหมด = พิมพ์ "OK ..." บรรทัดเดียว exit 0 • พัง = พิมพ์ชื่อไฟล์ + ท้ายผล 15 บรรทัด exit 1
cd "$(dirname "$0")/.."
fail=0; n=0
files=$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } | grep -E '\.js$' | sort -u )
for f in $files; do [ -f "$f" ] || continue; n=$((n+1)); node --check "$f" 2>&1 | head -5 || true; [ "${PIPESTATUS[0]}" = 0 ] || { echo "SYNTAX FAIL: $f"; fail=1; }; done
[ "$fail" = 0 ] || exit 1
[ "${1:-}" = "--quick" ] && { echo "OK: syntax $n ไฟล์"; exit 0; }
t=0; tmp=$(mktemp)
for f in tools/test-*.js; do
  t=$((t+1))
  if ! node "$f" >"$tmp" 2>&1; then echo "TEST FAIL: $f"; tail -15 "$tmp"; fail=1; fi
done
rm -f "$tmp"
[ "$fail" = 0 ] && echo "OK: syntax $n ไฟล์ • เทสต์ $t ไฟล์ผ่านหมด" || exit 1
