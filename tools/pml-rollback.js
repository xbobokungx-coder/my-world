// ก่อนย้อนโค้ดหวย/ตลาดนัด: (1) rec.lottoPend ของทุกบัญชี -> บวกเข้า inv.coin แล้วลบ (2) d.bids ทุกรายการ -> คืน coin ให้ buyer แล้วล้าง bids
// ใช้: node tools/pml-rollback.js [--dry-run (ค่าตั้งต้น) | --apply] [--force] [ไฟล์ห้อง.json ...] • DATA_DIR ตั้งผ่าน env ได้ (ค่าเริ่มต้น ./data)
// ต้องหยุดเซิร์ฟเวอร์ก่อน --apply (ตรวจด้วย pgrep ข้ามได้ด้วย --force) • รันซ้ำปลอดภัย (ล้างแล้วไม่คืนซ้ำ) • สำรอง <ไฟล์>.pre-pml ก่อนเขียนทับ
const fs = require('fs'), path = require('path'), cp = require('child_process');
const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const apply = process.argv.includes('--apply'), force = process.argv.includes('--force');
let files = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!files.length) files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'layout.json' && !f.startsWith('rooms.')).map(f => path.join(dir, f));
if (apply && !force) {
  let run = ''; try { run = cp.execSync('pgrep -f "node.*server\\.js" || true', { encoding: 'utf8' }).trim(); } catch (e) { /* ไม่มี pgrep */ }
  if (run) { console.log(`[pml-rollback] เซิร์ฟเวอร์ยังรันอยู่ (pid ${run.split('\n').join(',')}) หยุดก่อนแล้วสั่งใหม่ (หรือใส่ --force)`); process.exit(1); }
}
const pendSum = rec => { let s = 0; for (const e of (Array.isArray(rec.lottoPend) ? rec.lottoPend : [])) if (Array.isArray(e) && Number.isFinite(e[2]) && e[2] > 0) s += Math.floor(e[2]); return s; };
let gPend = 0, gBid = 0, gAcc = 0, gBids = 0;
for (const f of files) {
  let d; try { d = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch (e) { console.log(`[pml-rollback] ข้าม ${f}: ${e.message}`); continue; }
  if (!d || typeof d.players !== 'object' || !d.players) { console.log(`[pml-rollback] ข้าม ${f}: ไม่มี players`); continue; }
  let pend = 0, bid = 0, acc = 0, nb = 0, lost = 0, touched = false;
  const give = (rec, n) => { rec.inv = rec.inv && typeof rec.inv === 'object' ? rec.inv : {}; rec.inv.coin = (Number.isFinite(rec.inv.coin) ? rec.inv.coin : 0) + n; };
  for (const rec of Object.values(d.players)) {
    if (!rec || typeof rec !== 'object' || rec.lottoPend === undefined) continue;
    const s = pendSum(rec); if (s) { give(rec, s); pend += s; acc++; }
    delete rec.lottoPend; touched = true;
  }
  if (Array.isArray(d.bids) && d.bids.length) {
    for (const b of d.bids) {
      const c = b && Number.isFinite(b.coin) && b.coin > 0 ? Math.floor(b.coin) : 0; if (!c) continue;
      const rec = b && typeof b.buyer === 'string' ? d.players[b.buyer] : null;
      if (!rec || typeof rec !== 'object') { lost += c; continue; } // เจ้าของไม่มีในเซฟ: ไม่ลบ bids ถ้ามีเงินหาย
      give(rec, c); bid += c; nb++;
    }
    if (lost) console.log(`[pml-rollback] ${f}: เตือน bids ${lost} เหรียญหาเจ้าของไม่เจอ (ไม่ได้คืน ข้ามไฟล์นี้ให้ตรวจมือ)`);
    else { d.bids = []; touched = true; }
  } else if (d.bids !== undefined && !lost) { /* ว่างอยู่แล้ว */ }
  console.log(`[pml-rollback] ${path.basename(f)}: หวยรอรับ ${pend} (${acc} บัญชี) | bids คืน ${bid} (${nb} รายการ)`);
  gPend += pend; gBid += bid; gAcc += acc; gBids += nb;
  if (lost || !touched) continue;
  if (apply) { fs.copyFileSync(f, f + '.pre-pml'); fs.writeFileSync(f + '.tmp', JSON.stringify(d)); fs.renameSync(f + '.tmp', f); }
}
console.log(`[pml-rollback] รวม: หวยรอรับ ${gPend} (${gAcc} บัญชี) + bids ${gBid} (${gBids} รายการ) = ${gPend + gBid} เหรียญ • ${apply ? 'เขียนไฟล์แล้ว (สำรอง .pre-pml)' : 'dry-run ยังไม่แก้ไฟล์ (ใส่ --apply เพื่อทำจริง)'}`);
