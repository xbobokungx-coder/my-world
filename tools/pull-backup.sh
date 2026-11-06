#!/usr/bin/env bash
# pull-backup.sh — ดึงไฟล์สำรองรายวันล่าสุดจาก VPS มาเก็บที่เครื่องนี้ (สำหรับ Linux/macOS/WSL)
# ตั้งเวลา: crontab -e แล้วใส่  0 21 * * * /path/to/my-world/tools/pull-backup.sh
# ไฟล์สำรองมี IP ผู้เล่น: เก็บนอกโฟลเดอร์รีโปเสมอ
set -euo pipefail
DEST="${DEST:-$HOME/my-world-backups}"; KEEP="${KEEP:-30}"
mkdir -p "$DEST"
remote=$(ssh -o BatchMode=yes -o ConnectTimeout=15 my-world 'ls -1t /root/my-world/backup/auto/daily/*.tar.gz 2>/dev/null | head -1')
[ -n "$remote" ] || { echo "ไม่พบไฟล์สำรองรายวันบน VPS" >&2; exit 1; }
name=$(basename "$remote")
[ -e "$DEST/$name" ] && { echo "มีแล้ว: $name"; exit 0; }
scp -q -o BatchMode=yes "my-world:$remote" "$DEST/$name.part" && mv "$DEST/$name.part" "$DEST/$name"
echo "ดึงสำเร็จ: $name"
ls -1t "$DEST"/data-*.tar.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
