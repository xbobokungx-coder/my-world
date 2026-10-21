#!/bin/sh
# สำรองข้อมูลผู้เล่นอัตโนมัติ (cron ทุกชั่วโมง ดู /etc/cron.d/my-world-backup)
#   รายชั่วโมง: backup/auto/hourly/data-YYYYMMDD-HHMM.tar.gz เก็บ 48 ชุดล่าสุด
#   รายวัน:     backup/auto/daily/data-YYYYMMDD.tar.gz      เก็บ 14 ชุดล่าสุด (ชุดแรกของแต่ละวัน)
# กู้คืน: systemctl stop my-world → tar xzf <ไฟล์> -C /root/my-world (ได้โฟลเดอร์ data/ กลับมา) → systemctl start my-world
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR="$ROOT/backup/auto"
STAMP=$(date +%Y%m%d-%H%M)
DAY=$(date +%Y%m%d)
mkdir -p "$DIR/hourly" "$DIR/daily"

OUT="$DIR/hourly/data-$STAMP.tar.gz"
tar czf "$OUT.tmp" -C "$ROOT" data
# ไฟล์เซฟต้องอ่านเป็น JSON ได้ทุกไฟล์ ไม่งั้นไม่เก็บชุดนี้ (กันได้ไฟล์ที่เขียนค้างครึ่งทาง)
CHECK=$(mktemp -d)
tar xzf "$OUT.tmp" -C "$CHECK"
for f in "$CHECK"/data/*.json; do
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$f" || { echo "สำรองไม่สำเร็จ: $f อ่านไม่ได้" >&2; rm -rf "$CHECK" "$OUT.tmp"; exit 1; }
done
rm -rf "$CHECK"
mv "$OUT.tmp" "$OUT"

[ -e "$DIR/daily/data-$DAY.tar.gz" ] || cp "$OUT" "$DIR/daily/data-$DAY.tar.gz"

# ลบชุดเก่าที่เกินจำนวนเก็บ
ls -1t "$DIR"/hourly/data-*.tar.gz | tail -n +49 | xargs -r rm -f
ls -1t "$DIR"/daily/data-*.tar.gz | tail -n +15 | xargs -r rm -f
