// อ่านรายงานผู้เล่นที่ส่งมา (data/reports/) • ข้อมูลอ่อนไหว ห้าม commit
//   node tools/reports.js            รายการ (🔴 ยังไม่ปิด ก่อน แล้ว ✅ ปิดแล้ว)
//   node tools/reports.js <id>       ดูรายละเอียด + แชตแนบ
//   node tools/reports.js close <id> ปิดรายงาน  •  open <id> เปิดใหม่
const fs = require('fs'), path = require('path');
const dir = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'reports');
const WHY = { abuse: 'พูดจาไม่ดี', cheat: 'โกง', other: 'อื่นๆ' };
const all = () => { try { return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).sort((a, b) => b.time - a.time); } catch (e) { return []; } };
const when = t => new Date(t).toLocaleString('th-TH', { hour12: false });
const [a, b] = process.argv.slice(2);
const save = r => fs.writeFileSync(path.join(dir, r.id + '.json'), JSON.stringify(r, null, 1));
const find = id => { const r = all().find(x => x.id === id); if (!r) { console.error('ไม่พบ ' + id); process.exit(1); } return r; };
if ((a === 'close' || a === 'open') && b) {
  const r = find(b);
  if (a === 'close') { r.status = 'closed'; r.closedAt = Date.now(); r.closedBy = 'cli'; } else { delete r.status; delete r.closedAt; delete r.closedBy; }
  save(r); console.log((a === 'close' ? 'ปิดแล้ว ' : 'เปิดใหม่ ') + b);
} else if (a) {
  const r = find(a);
  console.log(`#${r.id}  ${r.status === 'closed' ? '✅ ปิดแล้ว ' + when(r.closedAt) + (r.closedBy ? ' โดย ' + r.closedBy : '') : '🔴 ยังไม่ปิด'}\nแจ้งเมื่อ ${when(r.time)}  ห้อง: ${r.room || '?'}\nผู้แจ้ง: ${r.by}  →  ผู้ถูกแจ้ง: ${r.target}  (${WHY[r.why] || r.why})\n\n${r.text || '(ไม่มีรายละเอียด)'}\n\nแชตล่าสุดในห้อง:\n${(r.chat || []).map(c => `  ${new Date(c.t).toLocaleTimeString('th-TH', { hour12: false })} ${c.name}: ${c.text}`).join('\n') || '  -'}`);
} else {
  const l = all(); if (!l.length) console.log('ยังไม่มีรายงานผู้เล่น');
  const row = r => `#${r.id}  ${when(r.time)}  ${r.by.padEnd(10)} → ${r.target.padEnd(10)} ${(WHY[r.why] || r.why).padEnd(10)} ${(r.text || '').replace(/\s+/g, ' ').slice(0, 50)}`;
  const op = l.filter(r => r.status !== 'closed'), cl = l.filter(r => r.status === 'closed');
  if (l.length) { console.log(`🔴 ยังไม่ปิด (${op.length})`); op.forEach(r => console.log(row(r))); console.log(`\n✅ ปิดแล้ว (${cl.length})`); cl.slice(0, 30).forEach(r => console.log(row(r))); }
}
