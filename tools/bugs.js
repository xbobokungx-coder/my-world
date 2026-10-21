// อ่านรายงานบั๊กที่ผู้เล่นส่งมา (data/bugs/)
//   node tools/bugs.js          รายการล่าสุด
//   node tools/bugs.js <id>     ดูรายละเอียด + path ของภาพ
//   node tools/bugs.js rm <id>  ลบรายงาน (และภาพ) เมื่อแก้แล้ว
const fs = require('fs'), path = require('path');
const dir = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'bugs');
const all = () => { try { return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).sort((a, b) => b.time - a.time); } catch (e) { return []; } };
const when = t => new Date(t).toLocaleString('th-TH', { hour12: false });
const [a, b] = process.argv.slice(2);
if (a === 'rm' && b) {
  const r = all().find(x => x.id === b); if (!r) { console.error('ไม่พบ ' + b); process.exit(1); }
  for (const f of [r.id + '.json', r.img]) if (f) try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* ไม่มีแล้ว */ }
  console.log('ลบแล้ว ' + b);
} else if (a) {
  const r = all().find(x => x.id === a); if (!r) { console.error('ไม่พบ ' + a); process.exit(1); }
  console.log(`#${r.id}  ${when(r.time)}\nผู้แจ้ง: ${r.name || '?'}  ห้อง: ${r.room || '?'}  IP: ${r.ip}\n\n${r.text}\n\nบริบท: ${JSON.stringify(r.ctx)}\nภาพ: ${r.img ? path.join(dir, r.img) : '-'}`);
} else {
  const l = all(); if (!l.length) console.log('ยังไม่มีรายงานบั๊ก');
  for (const r of l.slice(0, 30)) console.log(`#${r.id}  ${when(r.time)}  ${(r.name || '?').padEnd(12)} ${r.img ? '🖼 ' : '   '}${r.text.replace(/\s+/g, ' ').slice(0, 70)}`);
}
