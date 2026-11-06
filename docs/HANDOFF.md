# สถานะงานล่าสุด (ส่งต่อระหว่างเครื่อง)

ไฟล์นี้คือ "ความจำร่วม" ของทุกเครื่อง Claude Code อ่านส่วนต้นอัตโนมัติตอนเปิด session
อัปเดตด้วย `/handoff` ก่อนเลิกงานหรือก่อนย้ายเครื่องทุกครั้ง

## ตอนนี้
- เครื่อง: Mac (Sira-MAC) • วันที่ 2026-11-06 • branch `main` ตรงกับ GitHub ไม่มีงานค้างในเครื่อง • **ยังไม่ได้ deploy ขึ้น VPS เลย** (VPS ยังรันโค้ดก่อน refactor)
- กำลังทำ: refactor ตาม `docs/plans/refactor.md` — **ขั้น 0 และขั้น 1 เสร็จครบ** ถัดไปขั้น 2–3 ตามแผนย่อย `docs/plans/refactor-step2-3.md` (ยังไม่เริ่ม รอเจ้าของยืนยัน D5/D7/D8)
- เสร็จแล้ว:
  - ขั้น 0: เทสต์ล้าง temp, test-mining ไม่สุ่มพัง, golden (`tools/test-golden.js`), `check-structure.js`, ลบ `weekKey` ซ้ำ, ลบโค้ดคาสิโน, เทสต์ economy/arcade/social/cinema, เทสต์ pok/react/c4 (`test-arcade-games.js`)
  - ขั้น 1 (`fca9449`…`3ef413e`): ย้ายเมธอดออกจาก `class World` ไป `server/systems/**` ผ่าน `mix()` ครบทุกระบบ `server.js` 3,798 → 1,139 บรรทัด class เหลือ 9 ตัว (`constructor loadTown loadProjects join leave handle act tick save`) เครื่องมือ `tools/check-moved.js` `tools/move-methods.js` (มี `test-movetools.js`) ช่วยย้ายโดยพิสูจน์ว่าเนื้อเมธอดเหมือนเดิม
  - เทสต์ 24 ไฟล์ + golden ผ่านทุก commit (ไม่เคยใช้ `GOLDEN_UPDATE`)
- ค้างอยู่ / ขั้นต่อไป (ตามลำดับ):
  - **เจ้าของตัดสินใจ** ก่อนเริ่มขั้น 2: D5 (`msg_*` แทน dispatch.js), D7 (event เรียกตามลำดับคงที่), D8 (client เป็นสคริปต์ธรรมดา ไม่ใช่ ES module), `check-free-ids` แบบไม่มี dependency หรือใช้ `acorn`, ทำข้อ 2.11 ไหม, อนุมัติแก้ CLAUDE.md/`.claude/agents/*.md` (รายละเอียดในแผนหัวข้อท้าย)
  - **deploy ขั้น 0–1 ขึ้น VPS** เจ้าของสั่ง ops เอง: ช่วงคนน้อย ดูจำนวนออนไลน์จากเมนูผู้ดูแล `deploy.sh --check` ก่อนเสมอ (ไฟล์ใน `server/` ทำให้ restart ผู้เล่นหลุด) และรันเช็กลิสต์เบราว์เซอร์/เมนูผู้ดูแล (agent ไม่มีเบราว์เซอร์และห้ามอ่าน `admin.key`)
  - ขั้น 2.0 (qa เครื่องมือตรวจ free-ids/coverage/golden-msgs ฯลฯ) → 2.1…2.10 → หยุดก่อนขั้น 4 (เปลี่ยนรูปแบบเซฟ ต้องมีสำรองนอก VPS + ทดสอบ migration กับสำเนาเซฟจริงโดยเจ้าของ)
  - escape `innerHTML` 51 จุดใน `game.js` ควรเป็นตั๋ว `/bugfix` แยกก่อนขั้น 3 (เรื่องความปลอดภัย)
  - เดิม: คีย์ PixelLab 401 (ออกใหม่ก่อนขั้น 7 งานศิลป์), เศรษฐกิจซิมไม่ผ่าน G2/G3 (รัน `node tools/economy.js 7` กับข้อมูลจริงก่อน), ของค้างบน VPS (โปรเซส Claude 5 ตัว ไฟล์ untracked 26 รายการรวม `public/dl/`, skills 4 ตัวเฉพาะ VPS), cron ดึงสำรอง 21:00 ยังไม่ยืนยัน
- ตัดสินใจแล้ว:
  - dev ที่เครื่อง → push GitHub → VPS รัน `tools/deploy.sh` (ไม่แก้โค้ดบน VPS ยกเว้น hotfix)
  - refactor: `shared/` ที่ราก + route `/shared/`, `weekKey` แบบ ISO, deploy ทีละระบบช่วงคนน้อย, ห้ามเปลี่ยนรูปแบบเซฟก่อนขั้น 4
  - เจ้าของสั่งให้ทำขั้น 0–1 ต่อเนื่องโดยไม่หยุดถามทุกข้อ (ทุก commit ยังผ่านเทสต์+golden+code-reviewer) ไม่ครอบคลุม deploy/ขั้น 4
  - commit ใช้ `user.name = xbobokungx-coder` ข้อความไทย agent ไม่ commit
- ระวัง:
  - ระบบที่ไม่มีเทสต์เฉพาะ (npc telemetry bank crafting events challenge village ฯลฯ) ความเสี่ยงคือ ReferenceError เงียบ (ลืม require ตัวแปรโมดูล) reviewer ไล่มือด้วย smoke test แล้วแต่ยังไม่มีเครื่องมืออัตโนมัติ → ข้อ 2.0 ในแผน
  - เทสต์เห็นพฤติกรรมเดิมที่ดูเป็นบั๊กและล็อกไว้ (ไม่แก้): `arcRefundAll` ไม่ล้างโต๊ะ, เทรดไม่มี escrow จริง, `sell` ด้วย n ไม่เป็นบวกจะขายทั้งหมด, `S.BOTBET.bets=[0]` (ไม่มีเทสต์เดิมพันกับบอท) บันทึกใน `docs/tasks/refactor-step0-tests.md`
  - macOS ไม่มีคำสั่ง `timeout` ห้ามห่อเทสต์ (จะ FAIL หลอกทุกไฟล์) • ห้าม agent ใช้ `git stash/checkout/reset` ตอนมี agent อื่นแก้พร้อมกัน
  - dev เซิร์ฟเวอร์: `ADMIN_KEY=dev1234 PORT=3001 DATA_DIR=./data-dev npm start` (ใช้เฉพาะเครื่อง dev) • พอร์ต 3001 มี `node server.js` (pid 90161 เริ่ม 10:59) รันโค้ดเก่าค้างอยู่ ถ้าเป็น dev server ของคุณให้รีสตาร์ต
  - Node เครื่องนี้ v25.4.0 แต่ VPS v24.22.0 • VPS RAM แน่น • ไฟล์สำรอง/เซฟมี IP และเลขหวย ห้าม commit • temp ของ Mac มี `mw-*` เก่า 88 อัน, `/tmp` บน VPS มีโฟลเดอร์เทสต์เก่าค้าง

## ก่อนหน้า
- 2026-11-06: ติดตั้งชุดสตูดิโอ ตั้งเครื่อง จัดโฟลเดอร์ ทดลอง agent เตรียม VPS (รายละเอียดใน git log)
