---
name: ship
description: Commit, push, and deploy finished work to the live VPS through the ops agent.
disable-model-invocation: true
---

# Ship (only when the user runs /ship)

1. `git status`. Make sure no secrets or `data/`/`backup/` files are staged.
2. `tools/check-all.sh` (syntax + เทสต์ทั้งหมด ผลสั้น) ถ้าไม่ผ่านให้หยุด (ไม่ต้องส่ง qa-tester)
3. `tools/ship.sh "ข้อความไทย" ไฟล์...` เพิ่มทีละไฟล์ (มันรัน check-all เอง แล้ว commit + push)
4. Ask the user to confirm the deploy time (online players disconnect briefly if server code changed).
5. เมื่อผู้ใช้ยืนยัน: `tools/ship.sh --deploy-only` (รัน deploy.sh -y ผ่าน ssh แล้วสรุป HEAD/healthz/RAM/โปรเซส Claude ค้าง) • ถ้าต้อง --check ก่อนหรือต้องวิเคราะห์ปัญหา ค่อยเรียก ops
