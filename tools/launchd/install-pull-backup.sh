#!/usr/bin/env bash
# ติดตั้งงานดึงสำรองรายวันบน macOS (launchd): ทุกวัน 21:00 รัน tools/pull-backup.sh เก็บที่ ~/my-world-backups (KEEP=30)
# ใช้: tools/launchd/install-pull-backup.sh        ถอด: tools/launchd/install-pull-backup.sh --remove
# ข้อควรรู้: ssh รันแบบ BatchMode ไม่ถามรหัส คีย์ของ "my-world" ต้องไม่มีรหัสผ่าน หรืออยู่ใน Keychain (UseKeychain yes + AddKeysToAgent yes ใน ~/.ssh/config)
# และอย่าย้ายรีโปไป Desktop/Documents/Downloads (macOS อาจบล็อก launchd อ่านไฟล์)
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd); LABEL=com.my-world.pull-backup; PL="$HOME/Library/LaunchAgents/$LABEL.plist"
if [ "${1:-}" = "--remove" ]; then launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true; rm -f "$PL"; echo "ถอดแล้ว"; exit 0; fi
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/my-world-backups"
sed -e "s|__ROOT__|$ROOT|g" -e "s|__HOME__|$HOME|g" "$ROOT/tools/launchd/my-world-pull-backup.plist" > "$PL"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true; sleep 1
launchctl bootstrap "gui/$(id -u)" "$PL" || { sleep 2; launchctl bootstrap "gui/$(id -u)" "$PL"; }
echo "ติดตั้งแล้ว: $PL (ทุกวัน 21:00) • ทดลองรันตอนนี้: launchctl kickstart gui/$(id -u)/$LABEL • log: ~/my-world-backups/pull.log"
