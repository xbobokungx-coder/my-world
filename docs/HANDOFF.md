# สถานะงานล่าสุด (ส่งต่อระหว่างเครื่อง)

ไฟล์นี้คือ "ความจำร่วม" ของทุกเครื่อง Claude Code อ่านส่วนต้นอัตโนมัติตอนเปิด session
อัปเดตด้วย `/handoff` ก่อนเลิกงานหรือก่อนย้ายเครื่องทุกครั้ง

## ตอนนี้
- เครื่อง: -
- กำลังทำ: ตั้งทีม subagent และขั้นตอน deploy (`docs/plans/AGENTS-PLAN.md`, `docs/SETUP-MACHINES.md`)
- เสร็จแล้ว: -
- ค้างอยู่ / ขั้นต่อไป: ทำตาม `docs/START-PROMPTS.md` (ติดตั้งชุดไฟล์ → ตรวจเครื่อง → ทดลอง agent → VPS → refactor ขั้น 0 ตาม `docs/plans/REFACTOR-PLAN.md`)
- ตัดสินใจแล้ว: dev ที่เครื่อง → push GitHub → VPS รัน `tools/deploy.sh` (ไม่แก้โค้ดบน VPS ยกเว้น hotfix)
- ระวัง: -

## ก่อนหน้า
