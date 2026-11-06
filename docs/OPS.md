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


## สำรองข้อมูล

ข้อมูลผู้เล่นอยู่ที่ `/root/my-world/data/` (ไม่ขึ้น git)

**สำรองอัตโนมัติ:** `/etc/cron.d/my-world-backup` รัน `tools/backup.sh` ทุกชั่วโมง (นาทีที่ 5) เก็บที่ `backup/auto/hourly/` 48 ชุด และ `backup/auto/daily/` 14 วัน (ตรวจว่าไฟล์ JSON อ่านได้ก่อนเก็บ) log อยู่ที่ `/var/log/my-world-backup.log` กู้คืน: `systemctl stop my-world` → `tar xzf backup/auto/hourly/<ไฟล์>.tar.gz -C /root/my-world` → `systemctl start my-world` (ถ้าย้ายเครื่อง ต้องสร้างไฟล์ cron ใหม่)

ก่อนแก้โครงสร้างข้อมูลหรืออัปเดตใหญ่ สำรองด้วยมืออีกชุด:

```bash
mkdir -p /root/my-world/backup && cp -a /root/my-world/data /root/my-world/backup/data-$(date +%Y%m%d-%H%M)
```

กู้คืน: `systemctl stop my-world` → คัดลอกกลับไปที่ `data/` → `systemctl start my-world`


## ข้อมูลเซิร์ฟเวอร์ (VPS)

- ระบบ: Ubuntu (RAM ~1GB, มี swap 1GB) ระวังกินหน่วยความจำ อย่าติดตั้งของหนักโดยไม่จำเป็น
- พอร์ต: `22` (SSH), `80`/`443` (Caddy), `3000` (เกม ใช้ภายในเป็นหลัก)
- HTTPS: Caddy (`/etc/caddy/Caddyfile`) ขอใบรับรอง Let's Encrypt ให้ชื่อ `165-101-64-106.sslip.io` (sslip.io ชี้ไป IP ของ VPS ฟรี) แล้ว reverse proxy ไป `localhost:3000` รวม WebSocket ต่ออายุใบรับรองอัตโนมัติ ดูสถานะ `systemctl status caddy`
- service: `/etc/systemd/system/my-world.service` (รัน `/usr/bin/node server.js` ใน `/root/my-world`)
- Node.js LTS ติดตั้งจาก NodeSource
- ถ้ามีโดเมนจริง: ชี้ A record มาที่ IP VPS แล้วเปลี่ยนชื่อในบรรทัดแรกของ `/etc/caddy/Caddyfile` จากนั้น `systemctl reload caddy`
- ไมค์/กล้องในเบราว์เซอร์ใช้ได้เฉพาะ HTTPS หรือ `localhost` ตอนทดสอบที่บ้านผ่าน `localhost` ใช้ได้ปกติ
