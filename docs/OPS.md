# My World — งานปฏิบัติการ (VPS, deploy, สำรองข้อมูล)

## ลำดับงานหลัก (ตั้งแต่ พ.ย. 2026)
**dev ที่เครื่อง → push ขึ้น GitHub → VPS อัปเดตด้วย `tools/deploy.sh`** ไม่แก้โค้ดบน VPS ยกเว้น hotfix ฉุกเฉิน (ทำแล้ว commit + push จาก VPS ทันที)

```bash
# จากเครื่อง dev (สั่งผ่าน ssh) หรือ agent ops
ssh my-world 'cd /root/my-world && ./tools/deploy.sh --check'   # ทดสอบเวอร์ชันใหม่อย่างเดียว
ssh my-world 'cd /root/my-world && ./tools/deploy.sh -y'        # deploy จริง
```

`deploy.sh` ทำตามลำดับ:
1. หยุดถ้ามีไฟล์ถูกแก้บน VPS ที่ยังไม่ commit หรือ VPS มี commit ที่ GitHub ไม่มี
2. ทดสอบเวอร์ชันใหม่ในโฟลเดอร์ชั่วคราว (`node --check` ไฟล์ที่เปลี่ยน + `tools/test-*.js` ทุกไฟล์) เกมจริงยังไม่ถูกแตะ ไม่ผ่าน = หยุด
3. สำรอง `data/` ไปที่ `backup/pre-deploy/` (เก็บ 10 ชุดล่าสุด)
4. `git merge --ff-only` แล้ว restart เฉพาะเมื่อแก้ `server.js`, `server/**`, `public/shared.js`, `shared/**` หรือ `package*.json`
5. เช็ก `/healthz` 15 วินาที ไม่ผ่าน = ย้อนโค้ดกลับเวอร์ชันเดิม + restart อัตโนมัติ
บันทึกอยู่ที่ `backup/deploy.log`

ถ้า deploy ย้อนกลับ: ดู `journalctl -u my-world -n 50 --no-pager` แก้ที่เครื่อง dev แล้ว push ใหม่ (commit ที่พังยังอยู่บน GitHub จนกว่าจะ revert)

---
ข้างล่างย้ายมาจาก CLAUDE.md เดิม (ขั้นตอนแก้บน VPS โดยตรงใช้เฉพาะ hotfix)


## ขั้นตอนทำงานบน VPS (เกมจริง)

เกมรันเป็น systemd service ชื่อ `my-world` (เปิดเองตอนบูต รีสตาร์ทเองถ้าล่ม) โฟลเดอร์ `/root/my-world`

```bash
cd /root/my-world
git pull                      # 1) ดึงล่าสุด
# 2) แก้โค้ด
node --check server.js        # 3) เช็ค syntax ก่อนรีสตาร์ท (ทำกับไฟล์ .js ที่แก้ด้วย)
for t in tools/test-*.js; do node $t >/dev/null && echo "ผ่าน $t" || echo "พัง $t"; done   # 3.1) เทสต์ต้องผ่านครบก่อนขึ้นเกมจริง (พังเพราะกติกาเปลี่ยนตั้งใจ = แก้เทสต์ให้ตรง ไม่ใช่ข้าม)
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


## ย้ายเซฟหลอด XP อาชีพ xpv 7 (13 พ.ย. 2026, WP-20)

- ชาวนา คนเลี้ยงสัตว์ ช่างไม้ เชฟ ใช้หลอดมาตรฐาน `XP_TABLE_STD` บัญชี xpv ต่ำกว่า 7 ถูกย้ายตอนโหลดเซฟครั้งเดียว (`migrateStdV7`: เลเวลไม่ตก สัดส่วนในเลเวลคงเดิม ส่วนเกินหลัง Lv20 ตามสัดส่วนดาว ไม่คืน/ไม่หักเหรียญ ไม่แตะดาว/ความสำเร็จ) ดู log `[migrate] หลอด XP อาชีพ xpv 7: ย้าย N บัญชี`
- **ถอยกลับ:** หยุดเซิร์ฟเวอร์ → `node tools/tools-unmigrate.js` (ถอย 7→6→5 ทุกขั้น) หรือ `node tools/tools-unmigrate.js --to=6` (ถอยแค่หลอด XP คงขวาน/คันเบ็ดใหม่) → `git revert` → deploy • ข้อจำกัด: XP แปลงกลับไม่เป๊ะ 1:1 (ปัดเศษ) เลเวลเท่าเดิม สัดส่วนคลาดเศษ XP • ควรสำรอง `data/` ก่อนขึ้นเสมอ

## ย้ายเซฟขวาน/คันเบ็ด xpv 6 (13 พ.ย. 2026)
- **ก่อน deploy:** ซ้อมกับสำเนาใน `data-dev` ก่อน (ทุกบัญชีเข้าได้ เหรียญรวมไม่เปลี่ยน อุปกรณ์ตรงตารางแปลง) และสำรองนอกเครื่องตามหัวข้อ สำรองนอกเครื่อง ส่วน `deploy.sh` จะสำรอง `data/` ไป `backup/pre-deploy/` ให้เองอีกชั้น
- **ตอนขึ้นครั้งแรก:** บัญชี xpv 5 ถูกย้ายตอนโหลดเซฟ ครั้งเดียว (รันซ้ำไม่เปลี่ยนอีก) ดู log `[migrate] อุปกรณ์ xpv 6: ย้าย N บัญชี`
- **ข้อจำกัดการถอยกลับ:**
  1. ต้องหยุดเซิร์ฟเวอร์ แล้วรัน `node tools/tools-unmigrate.js` **ก่อน**สตาร์ตโค้ดเก่า (ไม่ใส่ชื่อไฟล์ = ทุก `*.json` ใน `DATA_DIR` ใส่ path ระบุไฟล์ได้ สคริปต์สำรองเป็น `<ไฟล์>.pre-unmig` ก่อนเขียนทับ)
  2. ถ้าไม่รันก่อน โค้ดเก่าจะอ่านคีย์ `rod_5`/`rod_6` ที่เพิ่มใหม่ผิดความหมาย (ดู `docs/plans/tools-10-tier.md` ข้อ 7.3)
  3. ขวาน/คันระดับ 8–10 ที่ผู้เล่นซื้อหลัง deploy **ถอยกลับไม่ได้** โค้ดเก่าไม่รู้จัก ต้องตัดสินเรื่องเหรียญก่อนถอย
  4. ความทนหลังถอยกลับถูกตัดตามค่าสูงสุดเดิม ความทนที่เหลือจะน้อยลงได้
- **ลำดับถอยโค้ด:** หยุดบริการ → `node tools/tools-unmigrate.js` → `git revert` → deploy
- **ถ้าข้อมูลเสีย:** กู้จาก `backup/pre-deploy/` หรือสำรองนอกเครื่อง (ดูหัวข้อด้านบน) ห้ามใส่เนื้อหาจริงจาก `data/` ลงเอกสาร

## อุปกรณ์ชาวนา/คนเลี้ยงสัตว์/เชฟ 10 ระดับ (WP-23, 13 พ.ย. 2026) ไม่มี migration
- ไม่ย้ายเซฟ ไม่ bump xpv (คง 7) คีย์เดิมอ่านได้เหมือนเดิม (`can_2`, `can_3`, จอบเดิม) ไม่ต้องรันสคริปต์เพิ่ม
- คีย์ใหม่ `hoe_2..10`, `pail_2..10`, `pan_2..10`, `can_4..10` และ `dur`/`fix` ของ `pail`/`pan` เพิ่มตอนผู้เล่นซื้อเท่านั้น
- **ข้อควรระวังถ้าถอยโค้ด:** โค้ดเก่าไม่รู้จักคีย์ `hoe_N` / `pail_N` / `pan_N` / `can_4+` (`itemInfo` คืน null) ของพวกนี้จะไม่แสดงและใช้ไม่ได้ ไม่มี unmigrate เพราะไม่ได้แปลงคีย์ ต้องตัดสินเรื่องของที่ซื้อไปแล้วก่อนถอย (เหมือนข้อ 3 ด้านบน)

## สำรองข้อมูล

ข้อมูลผู้เล่นอยู่ที่ `/root/my-world/data/` (ไม่ขึ้น git)

**สำรองอัตโนมัติ:** `/etc/cron.d/my-world-backup` รัน `tools/backup.sh` ทุกชั่วโมง (นาทีที่ 5) เก็บที่ `backup/auto/hourly/` 48 ชุด และ `backup/auto/daily/` 14 วัน (ตรวจว่าไฟล์ JSON อ่านได้ก่อนเก็บ) log อยู่ที่ `/var/log/my-world-backup.log` กู้คืน: `systemctl stop my-world` → `tar xzf backup/auto/hourly/<ไฟล์>.tar.gz -C /root/my-world` → `systemctl start my-world` (ถ้าย้ายเครื่อง ต้องสร้างไฟล์ cron ใหม่)

### สำรองนอกเครื่อง (WP-05)
สำรองบน VPS อยู่เครื่องเดียวกับเกม ถ้า VPS พังข้อมูลหายหมด จึงดึงออกมาเครื่องเจ้าของทุกวัน:
- **Mac:** `tools/launchd/install-pull-backup.sh` (ทุกวัน 21:00 รัน `tools/pull-backup.sh` เก็บที่ `~/my-world-backups/` ล่าสุด 30 ชุด ตั้ง `KEEP=` ได้ ขั้นต่ำควร 14) ถอดด้วย `--remove` log อยู่ `~/my-world-backups/pull.log` • ssh รันแบบไม่ถามรหัส คีย์ของชื่อลัด `my-world` ต้องไม่มีรหัสผ่านหรืออยู่ใน Keychain (`UseKeychain yes` + `AddKeysToAgent yes` ใน `~/.ssh/config`) และอย่าย้ายรีโปไป Desktop/Documents/Downloads (macOS อาจบล็อก launchd)
- **Windows:** `tools/pull-backup.ps1` ผูกกับ Task Scheduler รายวัน
- ไฟล์สำรองมี IP ผู้เล่น เก็บนอกโฟลเดอร์รีโปเสมอ ห้ามส่งขึ้น git

**ซ้อมกู้:** `tools/restore-drill.sh [ไฟล์.tar.gz]` แตกลงโฟลเดอร์ชั่วคราว ตรวจ JSON ทุกไฟล์ เปิดเซิร์ฟเวอร์ด้วยข้อมูลนั้นแล้วให้บอทเข้าเกม (ไม่แตะ `data/` จริง ไม่พิมพ์เนื้อหาผู้เล่น) ควรซ้อมหลังเปลี่ยนโครงสร้างเซฟทุกครั้ง
- บันทึกผลซ้อม: 13 พ.ย. 2026 (Mac) ไฟล์ `data-20261106.tar.gz` (556 KB) JSON อ่านได้ 23 ไฟล์ ไม่มีไฟล์เสีย 2 ห้อง (บัญชี 108 และ 8) เซิร์ฟเวอร์ขึ้นและบอทเข้าเกมได้ ใช้เวลา 1 วินาที ไม่พบปัญหา • **ยังไม่ได้ซ้อมกับสำรองสดจาก VPS** (ต้อง ssh ดึงก่อน) และยังไม่ได้เปิดใช้ตั้งเวลาอัตโนมัติ

ก่อนแก้โครงสร้างข้อมูลหรืออัปเดตใหญ่ สำรองด้วยมืออีกชุด:

```bash
mkdir -p /root/my-world/backup && cp -a /root/my-world/data /root/my-world/backup/data-$(date +%Y%m%d-%H%M)
```

กู้คืน: `systemctl stop my-world` → คัดลอกกลับไปที่ `data/` → `systemctl start my-world`


## ดูแลชุมชน (WP-06)

- ดูรายงานผู้เล่นบน VPS: `node tools/reports.js` (รายการ) • `node tools/reports.js <id>` (ดูแชตแนบ) • `node tools/reports.js close <id>` ปิดรายงาน (ข้อมูลอ่อนไหว ห้าม commit ห้ามเอาเนื้อหาไปวาง)
- คำหยาบ: แก้ `data/badwords.txt` เองได้ (บรรทัดละคำ ขึ้นต้น `#` = คอมเมนต์) เซิร์ฟเวอร์โหลดใหม่เองทุกนาที ไม่ต้อง restart
- แชตย้อนหลังเก็บ 14 วัน ดูได้เฉพาะในแผงผู้ดูแลในเกม ไม่ต้องดูไฟล์ `data/chatlog/` ด้วยมือ

## ข้อมูลเซิร์ฟเวอร์ (VPS)

- ระบบ: Ubuntu (RAM ~1GB, มี swap 1GB) ระวังกินหน่วยความจำ อย่าติดตั้งของหนักโดยไม่จำเป็น
- พอร์ต: `22` (SSH), `80`/`443` (Caddy), `3000` (เกม ใช้ภายในเป็นหลัก)
- HTTPS: Caddy (`/etc/caddy/Caddyfile`) ขอใบรับรอง Let's Encrypt ให้ชื่อ `165-101-64-106.sslip.io` (sslip.io ชี้ไป IP ของ VPS ฟรี) แล้ว reverse proxy ไป `localhost:3000` รวม WebSocket ต่ออายุใบรับรองอัตโนมัติ ดูสถานะ `systemctl status caddy`
- service: `/etc/systemd/system/my-world.service` (รัน `/usr/bin/node server.js` ใน `/root/my-world`)
- Node.js LTS ติดตั้งจาก NodeSource
- ถ้ามีโดเมนจริง: ชี้ A record มาที่ IP VPS แล้วเปลี่ยนชื่อในบรรทัดแรกของ `/etc/caddy/Caddyfile` จากนั้น `systemctl reload caddy`
- ไมค์/กล้องในเบราว์เซอร์ใช้ได้เฉพาะ HTTPS หรือ `localhost` ตอนทดสอบที่บ้านผ่าน `localhost` ใช้ได้ปกติ

## เล้าไก่งวง/แพะ (13 พ.ย. 2026, WP-21) ข้อจำกัดการถอยกลับ

- เพิ่มสัตว์ `turkey`/`goat` ใน `rec.herd` และผลผลิต `turkey_egg`/`goat_milk` ใน `inv` • `loadHerd`/`syncHerd` ใหม่เก็บชนิดสัตว์ที่ไม่รู้จักไว้ ไม่ลบ
- **ถอยโค้ดกลับไปเวอร์ชันก่อน WP-21:** `loadHerd` เก่าจะลบไก่งวง/แพะที่ผู้เล่นซื้อไปแล้วทิ้งตอนผู้เล่นเข้าเกม (เสียเงินซื้อ 1,500/2,000 ต่อตัว) และผลผลิตใน `inv` ค้างอยู่แต่ไม่มีไอเทมข้อมูล (ไม่หาย แต่ขายไม่ได้) → ก่อนถอยต้องสำรอง `data/` และทำสคริปต์/ขั้นตอนเอาสัตว์ใหม่ออกจาก `rec.herd` พร้อมคืนเงิน หรือถอยเฉพาะ commit ส่วนข้อมูลแต่คงตัว `loadHerd`/`syncHerd` ใหม่ไว้
- เล้าไก่งวง/แพะย้ายขึ้นแถวบนสุด (รั้ว x52–62 y2–7) และหน้าผา x45–62 y8 เป็นทางเดินแล้ว (13 พ.ย. 2026) • ต้นไม้ที่เซฟไว้ทับรั้ว/ทางถูกตัดทิ้งตอนโหลดเอง ผู้เล่นที่เซฟตำแหน่งทับรั้วถูกย้ายไปจุดเกิดตอนเข้าเกม • ร้านที่ผู้ดูแลย้ายไว้ (`data/layout.json`) ต้องไม่ทับโซนนี้
