// ตรวจประกาศถึงผู้เล่น (public/notices.js): โครงสร้างครบ id ไม่ซ้ำ ข้อความไทย ความยาวพอเหมาะ: node tools/test-notices.js
const assert = require('assert'), fs = require('fs'), path = require('path');
const { NOTICES } = require('../public/notices.js');
assert.ok(Array.isArray(NOTICES) && NOTICES.length >= 1, 'ต้องมีประกาศอย่างน้อย 1 ชิ้น');
const ids = new Set(), TH = /[฀-๿]/;
for (const n of NOTICES) {
  assert.ok(/^\d{4}-\d{2}-\d{2}(-[a-z0-9-]+)?$/.test(n.id) && !ids.has(n.id), 'id ไม่ซ้ำและรูปแบบถูก: ' + n.id); ids.add(n.id);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(n.date), 'date YYYY-MM-DD'); assert.ok(n.emoji && TH.test(n.title), 'มี emoji และชื่อไทย');
  assert.ok(TH.test(n.intro || 'ก'), 'intro ไทย'); assert.ok(Array.isArray(n.sections) && n.sections.length >= 1, 'มีหัวข้อ');
  for (const sc of n.sections) { assert.ok(TH.test(sc.h), 'หัวข้อไทย'); assert.ok(Array.isArray(sc.lines) && sc.lines.length >= 1, 'หัวข้อต้องมีบรรทัด'); for (const l of sc.lines) assert.ok(TH.test(l) && l.length <= 200, 'บรรทัดไทยและไม่ยาวเกิน 200: ' + l.slice(0, 20)); }
  const raw = JSON.stringify(n); assert.ok(!/admin\.key|รหัสผ่าน:|password/i.test(raw), 'ห้ามมีความลับ');
}
assert.ok(/notices\.js/.test(fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8')), 'index.html ต้องโหลด notices.js');
console.log('test-notices ผ่าน (' + NOTICES.length + ' ประกาศ)');
