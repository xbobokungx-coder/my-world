#!/usr/bin/env bash
# restore-drill.sh — ซ้อมกู้ข้อมูลจากไฟล์สำรอง: แตกลงโฟลเดอร์ชั่วคราว ตรวจว่า JSON อ่านได้ เปิดเซิร์ฟเวอร์ด้วยข้อมูลนั้น
# แล้วให้บอทเข้าเกมได้ (ไม่แตะ data/ จริง ไม่พิมพ์เนื้อหาผู้เล่น แสดงแค่จำนวน)
# ใช้: tools/restore-drill.sh [ไฟล์สำรอง.tar.gz]   (ไม่ใส่ = ไฟล์ล่าสุดใน $DEST หรือ ~/my-world-backups)
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DEST="${DEST:-$HOME/my-world-backups}"
FILE="${1:-$(ls -1t "$DEST"/data-*.tar.gz 2>/dev/null | head -1 || true)}"
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "ไม่พบไฟล์สำรอง (ระบุเป็นอาร์กิวเมนต์ หรือรัน pull-backup.sh ก่อน)" >&2; exit 1; }
T0=$(date +%s); TMP=$(mktemp -d "${TMPDIR:-/tmp}/mw-drill-XXXXXX"); PORT=$((3300 + RANDOM % 500)); PID=""
cleanup() { if [ -n "$PID" ]; then kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; fi; rm -rf "$TMP"; } # รอเซิร์ฟเวอร์เซฟตอนปิดเสร็จก่อนลบโฟลเดอร์; trap cleanup EXIT
echo "ไฟล์: $(basename "$FILE") ($(du -h "$FILE" | cut -f1))"
if tar tzf "$FILE" | grep -Ev '^(\./)?data(/|$)' | grep -q .; then echo "ไฟล์สำรองมีพาธนอกโฟลเดอร์ data/ ไม่แตก" >&2; exit 1; fi
tar xzf "$FILE" -C "$TMP" --no-same-owner; [ -d "$TMP/data" ] || { echo "ในไฟล์ไม่มีโฟลเดอร์ data/" >&2; exit 1; }
node -e '
const fs=require("fs"),p=require("path"),d=process.argv[1];let ok=0,bad=[];
const walk=x=>{for(const f of fs.readdirSync(x,{withFileTypes:true})){const q=p.join(x,f.name);if(f.isDirectory())walk(q);else if(f.name.endsWith(".json")){try{JSON.parse(fs.readFileSync(q,"utf8"));ok++}catch(e){bad.push(p.relative(d,q))}}}};
walk(d);console.log("JSON อ่านได้",ok,"ไฟล์ เสีย",bad.length,bad.slice(0,5).join(","));
for(const r of fs.readdirSync(d).filter(f=>/^[a-z0-9_-]+\.json$/.test(f)&&f!=="rooms.meta.json")){try{const j=JSON.parse(fs.readFileSync(p.join(d,r),"utf8"));console.log("ห้อง",r.replace(".json",""),"บัญชี",Object.keys(j.players||{}).length)}catch(e){}}
process.exit(bad.length?1:0)' "$TMP/data"
while curl -fs "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; do PORT=$((PORT + 1)); done # พอร์ตต้องว่างจริง กันบอทเข้าผิดเซิร์ฟเวอร์
PORT=$PORT DATA_DIR="$TMP/data" ADMIN_KEY=drill-$RANDOM node "$ROOT/server.js" >"$TMP/server.log" 2>&1 & PID=$!
for i in $(seq 1 30); do curl -fs "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break; sleep 1; done
kill -0 "$PID" 2>/dev/null && curl -fs "http://127.0.0.1:$PORT/healthz" >/dev/null || { echo "เซิร์ฟเวอร์ไม่ขึ้น:"; tail -5 "$TMP/server.log"; exit 1; }
node -e '
const WebSocket=require(process.argv[1]+"/node_modules/ws");const ws=new WebSocket("ws://127.0.0.1:"+process.argv[2]+"/ws");
ws.on("open",()=>ws.send(JSON.stringify({t:"join",name:"drill"+(Date.now()%1000),color:"#3498db",pin:"1234"})));
ws.on("message",d=>{const m=JSON.parse(d);if(m.t==="w"){console.log("บอทเข้าเกมได้ (ผู้เล่นออนไลน์ในห้อง",(m.roster||[]).length+")");process.exit(0)}if(m.t==="err"){console.log("เข้าเกมไม่ได้:",m.text);process.exit(1)}});
setTimeout(()=>{console.log("หมดเวลารอเข้าเกม");process.exit(1)},8000)' "$ROOT" "$PORT"
echo "✓ ซ้อมกู้ผ่าน ใช้เวลา $(( $(date +%s) - T0 )) วินาที"
