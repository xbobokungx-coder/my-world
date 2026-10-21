// อ่านรายงานบั๊กที่ผู้เล่นส่งมา (data/bugs/)
//   node tools/bugs.js          รายการ (🔴 ยังไม่แก้ ก่อน แล้ว ✅ แก้แล้ว)
//   node tools/bugs.js fix <id>     ทำเครื่องหมายว่าแก้แล้ว  •  reopen <id> เปิดใหม่
//   node tools/bugs.js <id>     ดูรายละเอียด + path ของภาพ
//   node tools/bugs.js rm <id>  ลบรายงานถาวร (ปกติไม่ต้องใช้ ให้ fix แทนเพื่อเก็บประวัติ)
const fs = require('fs'), path = require('path');
const dir = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'bugs');
const all = () => { try { return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).sort((a, b) => b.time - a.time); } catch (e) { return []; } };
const when = t => new Date(t).toLocaleString('th-TH', { hour12: false });
const [a, b] = process.argv.slice(2);
const save = r => fs.writeFileSync(path.join(dir, r.id + '.json'), JSON.stringify(r, null, 1));
if ((a === 'fix' || a === 'reopen') && b) {
  const r = all().find(x => x.id === b); if (!r) { console.error('ไม่พบ ' + b); process.exit(1); }
  if (a === 'fix') { r.status = 'fixed'; r.fixedAt = Date.now(); r.fixedBy = 'cli'; } else { delete r.status; delete r.fixedAt; delete r.fixedBy; }
  save(r); console.log((a === 'fix' ? 'แก้แล้ว ' : 'เปิดใหม่ ') + b);
} else if (a === 'rm' && b) {
  const r = all().find(x => x.id === b); if (!r) { console.error('ไม่พบ ' + b); process.exit(1); }
  for (const f of [r.id + '.json', r.img]) if (f) try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* ไม่มีแล้ว */ }
  console.log('ลบแล้ว ' + b);
} else if (a) {
  const r = all().find(x => x.id === a); if (!r) { console.error('ไม่พบ ' + a); process.exit(1); }
  console.log(`#${r.id}  ${r.status === 'fixed' ? '✅ แก้แล้ว ' + when(r.fixedAt) + (r.fixedBy ? ' โดย ' + r.fixedBy : '') : '🔴 ยังไม่แก้'}\nแจ้งเมื่อ ${when(r.time)}\nผู้แจ้ง: ${r.name || '?'}  ห้อง: ${r.room || '?'}\n\n${r.text}\n\nภาพ: ${r.img ? path.join(dir, r.img) : '-'}`);
} else {
  const l = all(); if (!l.length) console.log('ยังไม่มีรายงานบั๊ก');
  const row = r => `#${r.id}  ${when(r.time)}  ${(r.name || '?').padEnd(12)} ${r.img ? '🖼 ' : '   '}${r.text.replace(/\s+/g, ' ').slice(0, 70)}`;
  const op = l.filter(r => r.status !== 'fixed'), fx = l.filter(r => r.status === 'fixed');
  if (l.length) { console.log(`🔴 ยังไม่แก้ (${op.length})`); op.forEach(r => console.log(row(r))); console.log(`\n✅ แก้แล้ว (${fx.length})`); fx.slice(0, 30).forEach(r => console.log(row(r))); }
}
