#!/usr/bin/env bash
# run-tests.sh — รันเทสต์ tools/test-*.js ทั้งชุด • ไฟล์ที่แยกโฟลเดอร์ข้อมูลเองรันขนาน (JOBS=4) • ไฟล์ที่ใช้ data/ ตัวเดิมรันทีละตัว
#   tools/run-tests.sh [โฟลเดอร์โปรเจกต์]   • ผ่านทั้งหมด = exit 0 • พัง = พิมพ์ชื่อไฟล์ + ท้ายผล 15 บรรทัด exit 1
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"; JOBS="${JOBS:-4}"
cd "$ROOT" || exit 1
OUT=$(mktemp -d); PAR=(); SER=()
# ขนาน: แยกโฟลเดอร์ข้อมูลแล้ว • เทสต์ที่เปิด server ของตัวเองรับพอร์ตไม่ซ้ำจาก MW_TEST_PORT (กันชนกัน)
for f in tools/test-*.js; do if grep -q "DATA_DIR" "$f"; then PAR+=("$f"); else SER+=("$f"); fi; done
run() { # ล้มครั้งแรก = เก็บล็อกไว้ที่ /tmp/mw-flaky-*.log แล้วลองใหม่อีก 1 ครั้ง (กันเทสต์สุ่มล้ม) • ผ่านรอบสองถือว่าผ่านแต่พิมพ์เตือน FLAKY
  local n; n=$(echo "$1" | tr '/' '_')
  if MW_TEST_PORT=$((4200 + $2)) node "$1" >"$OUT/$n.log" 2>&1; then echo ok >"$OUT/$n.res"; return; fi
  cp "$OUT/$n.log" "/tmp/mw-flaky-$n.log" 2>/dev/null
  if MW_TEST_PORT=$((4300 + $2)) node "$1" >"$OUT/$n.log" 2>&1; then echo "ok" >"$OUT/$n.res"; echo "FLAKY: $1 (ล้มครั้งแรก ผ่านรอบสอง ล็อก /tmp/mw-flaky-$n.log)" >>"$OUT/flaky.txt"; else echo "FAIL $1" >"$OUT/$n.res"; fi
}
i=0; for f in "${PAR[@]}"; do i=$((i+1)); run "$f" $i & while [ "$(jobs -p | wc -l)" -ge "$JOBS" ]; do sleep 0.2; done; done
wait
export DATA_DIR="$OUT/.serial-data"; mkdir -p "$DATA_DIR"
for f in "${SER[@]}"; do i=$((i+1)); run "$f" $i; done
fail=0; total=0
for r in "$OUT"/*.res; do total=$((total+1)); if [ "$(cat "$r")" != ok ]; then fail=1; name=$(sed 's/^FAIL //' "$r"); echo "TEST FAIL: $name"; tail -15 "${r%.res}.log"; fi; done
[ -f "$OUT/flaky.txt" ] && cat "$OUT/flaky.txt"
rm -rf "$OUT"
[ "$fail" = 0 ] && echo "OK: เทสต์ $total ไฟล์ผ่านหมด" || exit 1
