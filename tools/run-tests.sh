#!/usr/bin/env bash
# run-tests.sh — รันเทสต์ tools/test-*.js ทั้งชุด • ไฟล์ที่แยกโฟลเดอร์ข้อมูลเองรันขนาน (JOBS=4) • ไฟล์ที่ใช้ data/ ตัวเดิมรันทีละตัว
#   tools/run-tests.sh [โฟลเดอร์โปรเจกต์]   • ผ่านทั้งหมด = exit 0 • พัง = พิมพ์ชื่อไฟล์ + ท้ายผล 15 บรรทัด exit 1
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"; JOBS="${JOBS:-4}"
cd "$ROOT" || exit 1
OUT=$(mktemp -d); PAR=(); SER=()
for f in tools/test-*.js; do if grep -q "DATA_DIR" "$f"; then PAR+=("$f"); else SER+=("$f"); fi; done
run() { local n; n=$(echo "$1" | tr '/' '_'); if node "$1" >"$OUT/$n.log" 2>&1; then echo ok >"$OUT/$n.res"; else echo "FAIL $1" >"$OUT/$n.res"; fi; }
for f in "${PAR[@]}"; do run "$f" & while [ "$(jobs -p | wc -l)" -ge "$JOBS" ]; do sleep 0.2; done; done
wait
export DATA_DIR="$OUT/.serial-data"; mkdir -p "$DATA_DIR"
for f in "${SER[@]}"; do run "$f"; done
fail=0; total=0
for r in "$OUT"/*.res; do total=$((total+1)); if [ "$(cat "$r")" != ok ]; then fail=1; name=$(sed 's/^FAIL //' "$r"); echo "TEST FAIL: $name"; tail -15 "${r%.res}.log"; fi; done
rm -rf "$OUT"
[ "$fail" = 0 ] && echo "OK: เทสต์ $total ไฟล์ผ่านหมด" || exit 1
