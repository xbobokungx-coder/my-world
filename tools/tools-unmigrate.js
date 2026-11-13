// ถอยกลับเซฟ xpv 7 → 6 (หลอด XP อาชีพ WP-20) แล้ว 6 → 5 (ขวาน/คันเบ็ด 10 ระดับ) ก่อนสตาร์ตโค้ดเก่า • ต้องหยุดเซิร์ฟเวอร์ก่อน
// ใส่ --to=6 = ถอยแค่ xpv 7 → 6 (คงขวาน/คันเบ็ดใหม่) • ข้อจำกัด: XP แปลงกลับไม่เป๊ะ 1:1 (ปัดเศษ) เลเวลเท่าเดิม สัดส่วนในเลเวลคลาดไม่เกินเศษ XP
// ใช้: node tools/tools-unmigrate.js [ไฟล์ห้อง.json ...]   (ไม่ใส่ = ทุก *.json ใน DATA_DIR ที่มี players)
// สำรองไฟล์เป็น <ไฟล์>.pre-unmig ก่อนเขียนทับ • DATA_DIR ตั้งผ่าน env ได้ (ค่าเริ่มต้น ./data)
const fs = require('fs'), path = require('path');
const S = require('../public/shared.js');
const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const to6 = process.argv.includes('--to=6'); let files = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!files.length) files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'layout.json').map(f => path.join(dir, f));
for (const f of files) {
  let d; try { d = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch (e) { console.log(`[unmigrate] ข้าม ${f}: ${e.message}`); continue; }
  if (!d || typeof d.players !== 'object' || !d.players) { console.log(`[unmigrate] ข้าม ${f}: ไม่มี players`); continue; }
  let n = 0; for (const rec of Object.values(d.players)) { const a = S.unmigrateStdV7(rec), b = !to6 && S.unmigrateToolsV6(rec); if (a || b) n++; }
  if (!n) { console.log(`[unmigrate] ${f}: ไม่มีบัญชี xpv ${to6 ? 7 : '6/7'}`); continue; }
  fs.copyFileSync(f, f + '.pre-unmig'); fs.writeFileSync(f + '.tmp', JSON.stringify(d)); fs.renameSync(f + '.tmp', f);
  console.log(`[unmigrate] ${f}: ถอยกลับ ${n} บัญชี (สำรอง ${path.basename(f)}.pre-unmig)`);
}
