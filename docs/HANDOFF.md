# สถานะงานล่าสุด (ส่งต่อระหว่างเครื่อง)

ไฟล์นี้คือ "ความจำร่วม" ของทุกเครื่อง Claude Code อ่านส่วนต้นอัตโนมัติตอนเปิด session
อัปเดตด้วย `/handoff` ก่อนเลิกงานหรือก่อนย้ายเครื่องทุกครั้ง

## ตอนนี้
- เครื่อง: Mac (Sira-MAC) • วันที่ 2026-11-06 • branch `main` ตรงกับ GitHub (`3a63519`) ไม่มีงานค้างในเครื่อง
- กำลังทำ: refactor ขั้น 0 ตาม `docs/plans/refactor.md` ตั๋ว `docs/tasks/refactor-step0-tests.md` (ทำทีละข้อ จบแต่ละข้อหยุดรอเจ้าของตรวจ ก่อน commit ต้องผ่าน qa-tester + code-reviewer)
- เสร็จแล้ว:
  - ติดตั้งทีม agent/skill/hook ลง git, จัดโฟลเดอร์ (เอกสารแผน → `docs/`, `public/_theme` → `art/theme-samples/`), ทดลอง agent ครบ 5 ตัว (ขั้น 0–3 ของ START-PROMPTS)
  - VPS: `git pull` แล้ว (`d2d467e` ตอนนั้น) `deploy.sh` พร้อมใช้ ปิดโปรเซส Claude เก่า 4 ตัวคืน RAM, ดึงสำรองลง `~/my-world-backups/` แล้ว
  - refactor 0.1 `6e9ea71` (`tools/testlib.js` เทสต์ล้าง temp dir) และ 0.2 `3a63519` (`test-mining` ไม่สุ่มพังแล้ว 50/50) เทสต์ 14 ไฟล์ผ่านครบ
- ค้างอยู่ / ขั้นต่อไป (ตามลำดับ):
  - **0.3 golden test** (`tools/test-golden.js` + `tools/golden/expected.json` สแตบ Date/Math.random/crypto ตาม D4 ในแผน) → 0.7 `tools/check-structure.js` → 0.5 ลบ `weekKey` ซ้ำบรรทัด 485 → 0.4 ลบโค้ดคาสิโน → 0.6 เทสต์ระบบที่ยังไม่มี แล้วค่อยขั้น 1 (mixin ทีละระบบ เริ่ม lotto)
  - **คีย์ PixelLab ได้ 401** (คีย์ใน `~/.zshrc` ใช้ไม่ได้ ต้องออกคีย์ใหม่ที่ PixelLab แล้วแก้ค่าที่เดียว) ต้องแก้ก่อนขั้น 7 (ไอคอนแครอท/ปลาทูน่า/ขวานไม้)
  - เศรษฐกิจ: ซิมไม่ผ่าน G2 (2.72 เท่า เป้า ≤2.5) และ G3 (89% เป้า ≥90%) ซิมไม่จำลองการกระจุกตัวจริง (Gini 0.38 vs จริง 0.88) ต้องรัน `node tools/economy.js 7` กับข้อมูลจริงก่อนให้ economy-designer แก้เคส 2
  - ของค้างบน VPS: โปรเซส Claude 5 ตัวใน `/root/my-world` (~430 MB รอเจ้าของเช็กว่าตัวไหนยังใช้), ไฟล์ untracked 26 รายการ (รวม `public/dl/` ที่อาจเสิร์ฟออกเว็บ ให้เจ้าของตัดสินใจ), skills 4 ตัวมีเฉพาะบน VPS (`.claude/skills/{code-review-and-quality,debugging-and-error-recovery,dev,security-and-hardening}`) ถ้าต้องการเก็บให้ดึงเข้า git
  - ตั้ง cron ดึงสำรอง 21:00 (Mac อาจหลับ ถ้าไม่เปิดทิ้งไว้ให้ตั้งบนคอมบ้านด้วย `pull-backup.ps1`) เจ้าของยังไม่ได้ยืนยันว่าตั้งแล้ว
- ตัดสินใจแล้ว:
  - dev ที่เครื่อง → push GitHub → VPS รัน `tools/deploy.sh` (ไม่แก้โค้ดบน VPS ยกเว้น hotfix)
  - refactor: `shared/` ที่ราก + route `/shared/`, `weekKey` แบบ ISO, deploy ทีละระบบช่วงคนน้อย, commit `expected.json` ได้, ห้ามเปลี่ยนรูปแบบเซฟก่อนขั้น 4
  - commit ใช้ `user.name = xbobokungx-coder` (ตั้งไว้แล้ว) ข้อความไทย ผู้เขียน agent ไม่ commit
- ระวัง:
  - dev เซิร์ฟเวอร์: `ADMIN_KEY=dev1234 PORT=3001 DATA_DIR=./data-dev npm start` (รหัสทดสอบใช้เฉพาะเครื่อง dev ห้ามใช้บน VPS)
  - Node เครื่องนี้ v25.4.0 แต่ VPS v24.22.0 ถ้าเทสต์ผ่านที่นี่แต่พังบน VPS ให้สงสัยข้อนี้ก่อน
  - VPS RAM แน่น (swap ใช้ ~690/1024 MB) รัน `deploy.sh --check` ก่อนเสมอและดู RAM; `--check` ครั้งล่าสุดจบทันทีเพราะโค้ดตรงกัน ขั้นรันเทสต์บน VPS ยังไม่เคยถูกทดสอบ
  - ไฟล์สำรอง/เซฟมี IP ผู้เล่นและเลขหวยงวดถัดไป เก็บในเครื่องเท่านั้น ห้าม commit
  - `/tmp` บน VPS มีโฟลเดอร์เทสต์ค้างจากเทสต์เก่า (ก่อน 0.1) ยังไม่ได้ลบ และ temp ของ Mac มี `mw-*` เก่า 88 อัน

## ก่อนหน้า
- 2026-11-06: ติดตั้งชุดสตูดิโอ ตั้งเครื่อง จัดโฟลเดอร์ ทดลอง agent เตรียม VPS (รายละเอียดใน git log)
