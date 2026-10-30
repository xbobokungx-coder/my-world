# My World — คู่มือปรับปรุงเกม (Claude Code / คนทำงาน)

เกมฟาร์มออนไลน์ใน repo นี้ถูกพัฒนาและรัน **บน VPS โดยตรง** แล้วซิงก์ผ่าน GitHub
ไฟล์นี้บอกวิธีทำงานให้เหมือนกันทุกเครื่อง (VPS และเครื่องที่บ้าน)

- Repo: `git@github.com:xbobokungx-coder/my-world.git` (branch `main`)
- เกมจริงที่คนเล่น: **`https://165-101-64-106.sslip.io`** (ต้องใช้ HTTPS ไม่งั้นเปิดไมค์ไม่ได้) VPS ชื่อเครื่อง `my-world`
- ภาษาในเกม คอมเมนต์ และเอกสาร: **ไทย**

## กฎเหล็ก (ทำทุกครั้ง)

1. **แก้เสร็จต้อง commit และ push ขึ้น GitHub ทุกครั้ง** ห้ามทิ้งงานค้างไว้เฉพาะในเครื่อง
2. **ก่อนเริ่มงาน `git pull`** ทุกครั้ง (อาจมีคนแก้จากอีกเครื่อง)
3. **ห้าม commit ความลับ:** `admin.key`, `data/`, `backup/`, `.env`, รหัสผ่าน, คีย์ SSH (`.gitignore` กันไว้แล้ว แต่ดู `git status` ก่อน commit เสมอ)
4. **ห้ามเขียนรหัสผู้ดูแลหรือรหัสผ่านลงไฟล์เอกสารใดๆ** รหัสผู้ดูแลอยู่ในไฟล์ `admin.key` บนเซิร์ฟเวอร์เท่านั้น
5. เปลี่ยนข้อมูลผู้เล่น (`data/main.json`) ด้วยมือเฉพาะตอนจำเป็น และ **สำรองก่อนเสมอ** (ดูหัวข้อสำรองข้อมูล)

## โครงสร้างโปรเจกต์

| ไฟล์ | หน้าที่ |
|---|---|
| `server.js` | เซิร์ฟเวอร์ Node.js + WebSocket (`ws`) คุมกติกาทั้งหมด (server-authoritative): ผู้เล่น เศรษฐกิจ ตู้เกม คาสิโน ผู้ดูแล ห้อง |
| `public/shared.js` | ค่าคงที่ที่ใช้ร่วมกันสองฝั่ง: `FISH`, `CROPS`, `ANIMALS`, `WEAR`, `CABINETS`, `MARKET`, `SICK`, `CASINO` ปรับสมดุลเกมที่นี่ |
| `public/game.js` | ฝั่งเว็บ: วาด Canvas, รับ input, UI, เสียง |
| `public/pixelart.js` `pixelchar.js` `pixelui.js` | พิกเซลอาร์ต พื้น/อาคาร, ตัวละคร, สัตว์/พืช/ไอคอน |
| `public/pixelaction.js` | สไปรต์ชีตท่าทำงาน (ขุดแร่ ตัดไม้ ตกปลา) เฟรม + เศษกระเด็นตอนกระทบ ดูชีตทั้งหมด `__mw.actionSheet()` ในคอนโซลเบราว์เซอร์ |
| `public/pixelfurn.js` | แปลงภาพเฟอร์นิเจอร์ในบ้าน (`ART` ใน game.js) เป็นพิกเซลอาร์ต ×2 ปรับโทนสีและใส่ขอบ |
| `public/index.html` | หน้าเว็บและ CSS ของ UI |
| `GAME-DESIGN.md` | **แหล่งความจริงเดียวของกติกาและตัวเลขทั้งเกม** (ดึงจากโค้ด) แก้กติกาแล้วอัปเดตที่นี่ด้วย |
| `ECONOMY-PLAN.md` | แผนเศรษฐกิจระยะยาว KPI คันโยกปรับสมดุล และบันทึกการปรับค่า |
| `GROWTH-PLAN.md` | แผนดึงผู้เล่นใหม่และให้อยู่ต่อ (60 วินาทีแรก 7 วันแรก ชาเลนจ์ส่งต่อ อีเวนต์) |
| `STYLE_GUIDE.md` | กติกาหน้าตา สี มุมกล้อง รูปทรง **อ่านก่อนเพิ่มของที่มองเห็นได้** |
| `README.md` / `HOW-TO-PLAY.md` | รายละเอียดฟีเจอร์และวิธีเล่น อัปเดตเมื่อเพิ่มฟีเจอร์ |
| `tools/stats.js` | สรุปตัวชี้วัดจาก `data/events/*.jsonl` และไฟล์เซฟ: `node tools/stats.js` |
| `tools/economy.js` | รายงานเศรษฐกิจรายวัน (เงินรวม Gini เข้า–ออก ราคาจริงต่อหมวด พลังงาน ตลาด คู่มือ): `node tools/economy.js 7` (นับเฉพาะผู้เล่นจริงที่ออนไลน์ ≥ 5 นาที ตาม `tools/realplayers.js` ใส่ `--all` เพื่อนับทุกบัญชี) |
| `tools/levelsim.js` | จำลอง XP/ชม. และเหรียญ/ชม. ทุกอาชีพทุกเลเวล ใช้ก่อนปรับ XP หรือราคา: `node tools/levelsim.js` |
| `tools/econsim.js` | จำลองเศรษฐกิจทั้งเมือง 35 วัน วัดเกณฑ์ความไม่เหลื่อมล้ำ G2–G8: `node tools/econsim.js` (ใช้คู่กับ levelsim ก่อนปรับตัวเลข) |
| `tools/backup.sh` | สำรอง `data/` (cron ทุกชั่วโมง ดูหัวข้อสำรองข้อมูล) |
| `*.ps1` `*.bat` | สคริปต์สำหรับ Windows (ใช้บนเครื่องที่บ้านได้ ไม่ใช้บน VPS) |

เทคโนโลยี: HTML5 Canvas 2D + JavaScript ล้วน ไม่มี build step ไม่มี framework ฝั่งเว็บ ฝั่งเซิร์ฟเวอร์มี dependency เดียวคือ `ws`

## ขั้นตอนทำงานบน VPS (เกมจริง)

เกมรันเป็น systemd service ชื่อ `my-world` (เปิดเองตอนบูต รีสตาร์ทเองถ้าล่ม) โฟลเดอร์ `/root/my-world`

```bash
cd /root/my-world
git pull                      # 1) ดึงล่าสุด
# 2) แก้โค้ด
node --check server.js        # 3) เช็ค syntax ก่อนรีสตาร์ท (ทำกับไฟล์ .js ที่แก้ด้วย)
systemctl restart my-world    # 4) เฉพาะเมื่อแก้ server.js (แก้ public/* ไม่ต้อง แค่รีเฟรชเบราว์เซอร์)
systemctl status my-world --no-pager
curl -s localhost:3000/healthz   # ต้องตอบ ok
git add <ไฟล์ที่แก้>          # 5) เพิ่มทีละไฟล์ อย่าใช้ git add . แบบไม่ดูก่อน
git commit -m "ข้อความอธิบายสั้นๆ"
git push                      # 6) ขึ้น GitHub
```

หมายเหตุ:
- ไฟล์ใน `public/*` ถูกอ่านจากดิสก์ทุกคำขอ (`no-cache`) แก้แล้วรีเฟรชเบราว์เซอร์ก็เห็นผลทันที
- แก้ `server.js` แล้วต้อง restart และ **ผู้เล่นที่ออนไลน์จะหลุดชั่วครู่** ถ้าไม่เร่ง ให้ restart ตอนคนน้อย
- ถ้า restart แล้วไม่ขึ้น: `journalctl -u my-world -n 50 --no-pager` ดู error แล้วย้อนด้วย `git checkout -- <ไฟล์>` หรือ `git revert`
- ดู log สด: `journalctl -u my-world -f`

## ขั้นตอนทำงานที่เครื่องที่บ้าน (ทดสอบก่อนขึ้นเกมจริง)

```bash
git clone git@github.com:xbobokungx-coder/my-world.git
cd my-world
npm install
PORT=3001 DATA_DIR=./data-dev npm start   # เปิดที่ http://localhost:3001
```

- ใช้ `DATA_DIR` แยกเพื่อไม่ปนกับข้อมูลจริง และใช้ `PORT` คนละพอร์ต
- ตัวแปรสำหรับทดสอบ: `ADMIN_KEY=รหัสทดสอบ` (ไม่ตั้งก็สุ่มสร้าง `admin.key` ให้), `HUNGER_FAST`, `SICK_CHECK_MS`, `CASINO_RESULT_MS` ฯลฯ (ดูต้น `server.js`)
- ทดสอบผ่านแล้ว `git push` จากเครื่องบ้าน จากนั้นบน VPS `git pull` (+ `systemctl restart my-world` ถ้าแก้ `server.js`)
- ถ้าสองเครื่องแก้ไฟล์เดียวกันแล้วชน: `git pull --rebase` แก้ conflict แล้ว push ไม่ใช้ `git push --force`

## สำรองข้อมูล

ข้อมูลผู้เล่นอยู่ที่ `/root/my-world/data/` (ไม่ขึ้น git)

**สำรองอัตโนมัติ:** `/etc/cron.d/my-world-backup` รัน `tools/backup.sh` ทุกชั่วโมง (นาทีที่ 5) เก็บที่ `backup/auto/hourly/` 48 ชุด และ `backup/auto/daily/` 14 วัน (ตรวจว่าไฟล์ JSON อ่านได้ก่อนเก็บ) log อยู่ที่ `/var/log/my-world-backup.log` กู้คืน: `systemctl stop my-world` → `tar xzf backup/auto/hourly/<ไฟล์>.tar.gz -C /root/my-world` → `systemctl start my-world` (ถ้าย้ายเครื่อง ต้องสร้างไฟล์ cron ใหม่)

ก่อนแก้โครงสร้างข้อมูลหรืออัปเดตใหญ่ สำรองด้วยมืออีกชุด:

```bash
mkdir -p /root/my-world/backup && cp -a /root/my-world/data /root/my-world/backup/data-$(date +%Y%m%d-%H%M)
```

กู้คืน: `systemctl stop my-world` → คัดลอกกลับไปที่ `data/` → `systemctl start my-world`

## แนวทางเขียนโค้ดให้เข้ากับของเดิม

- ทุกกติกาตัดสินที่ **ฝั่งเซิร์ฟเวอร์** ฝั่งเว็บห้ามเชื่อใจ (ผู้เล่นโกงได้) ฝั่งเว็บมีหน้าที่แสดงผลและส่ง input เท่านั้น
- ค่าตัวเลขสมดุล (ราคา เวลา โอกาส) ใส่ใน `public/shared.js` อย่าฝังกระจายในโค้ด
- ของใหม่ที่มองเห็นได้ต้องทำตาม `STYLE_GUIDE.md` (พิกเซลอาร์ต พาเลตสี เงา ขอบ 1 px)
- เพิ่มเกมในตู้: ใส่ที่ `CABINETS` (`public/shared.js`) แล้วเขียนกติกาฝั่งเซิร์ฟเวอร์ใน `server.js` ส่วน Arcade
- ข้อความที่ผู้เล่นเห็น เป็นภาษาไทย น้ำเสียงสบายๆ เข้ากับเกมเดิม
- แก้เล็กๆ ที่ตรงจุด อย่าจัดรูปแบบไฟล์ทั้งไฟล์ใหม่ (ทำให้ diff ใหญ่และ conflict ง่าย)
- เพิ่มฟีเจอร์แล้วอัปเดต `README.md` / `HOW-TO-PLAY.md` ให้ตรงด้วย

## ข้อความ commit

สั้น ชัด บอกว่าเปลี่ยนอะไร เช่น
- `เพิ่มตู้เกมหมากรุก`
- `แก้บั๊กขายปลาแล้วเหรียญไม่เพิ่ม`
- `ปรับราคาเมล็ดข้าวโพด`

ผู้เขียน git บนเครื่องต่างๆ ใช้ `user.name = xbobokungx-coder`

## ผู้ดูแลเกม

ชื่อตัวละครสงวน `Sira` ต้องใส่รหัสตอนเข้าเกม รหัสอยู่ในไฟล์ `admin.key` บนเซิร์ฟเวอร์ (`cat /root/my-world/admin.key`) หรือกำหนดด้วยตัวแปร `ADMIN_KEY` ผู้ดูแลสร้างห้องใหม่ ดูรายชื่อผู้เล่น และเตะผู้เล่นได้

## ข้อมูลเซิร์ฟเวอร์ (VPS)

- ระบบ: Ubuntu (RAM ~1GB, มี swap 1GB) ระวังกินหน่วยความจำ อย่าติดตั้งของหนักโดยไม่จำเป็น
- พอร์ต: `22` (SSH), `80`/`443` (Caddy), `3000` (เกม ใช้ภายในเป็นหลัก)
- HTTPS: Caddy (`/etc/caddy/Caddyfile`) ขอใบรับรอง Let's Encrypt ให้ชื่อ `165-101-64-106.sslip.io` (sslip.io ชี้ไป IP ของ VPS ฟรี) แล้ว reverse proxy ไป `localhost:3000` รวม WebSocket ต่ออายุใบรับรองอัตโนมัติ ดูสถานะ `systemctl status caddy`
- service: `/etc/systemd/system/my-world.service` (รัน `/usr/bin/node server.js` ใน `/root/my-world`)
- Node.js LTS ติดตั้งจาก NodeSource
- ถ้ามีโดเมนจริง: ชี้ A record มาที่ IP VPS แล้วเปลี่ยนชื่อในบรรทัดแรกของ `/etc/caddy/Caddyfile` จากนั้น `systemctl reload caddy`
- ไมค์/กล้องในเบราว์เซอร์ใช้ได้เฉพาะ HTTPS หรือ `localhost` ตอนทดสอบที่บ้านผ่าน `localhost` ใช้ได้ปกติ
