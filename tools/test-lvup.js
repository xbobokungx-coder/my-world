// ทดสอบ: เลเวลอัพส่ง {t:'lvup'} ให้ทุกคนในห้อง (ขึ้นหลายขั้นมี n) • ไม่ขึ้นไม่ส่ง • toast/sfx เดิมยังอยู่
// รัน: node tools/test-lvup.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-lvup-');
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('lvuptest');
const mk = name => { const ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }; return { ws, p: w.join(ws, name, '#3498db', false).p }; };
const a = mk('LvA'), b = mk('LvB');
const clear = () => { a.ws.msgs.length = 0; b.ws.msgs.length = 0; };
const ups = ws => ws.msgs.filter(m => m.t === 'lvup');
a.p.rec.skills.wood = 0; w.petBonus = () => ({ xp: 0 }); // กันสุ่มเศษจากสัตว์เลี้ยง

clear(); w.addXp(a.p, 'wood', 1);
assert.strictEqual(ups(a.ws).length + ups(b.ws).length, 0, 'ไม่ขึ้นเลเวลไม่ส่ง');

clear(); w.addXp(a.p, 'wood', S.xpFor(2, 'wood') - a.p.rec.skills.wood);
for (const x of [a, b]) {
  const u = ups(x.ws); assert.strictEqual(u.length, 1, 'ทุกคนได้ 1 ข้อความ');
  assert.deepStrictEqual(u[0], { t: 'lvup', id: a.p.id, skill: 'wood', lv: 2 });
}
assert.ok(a.ws.msgs.some(m => m.t === 'msg' && /เลเวล 2/.test(m.text)), 'toast เดิมยังมี');
assert.ok(a.ws.msgs.some(m => m.t === 'sfx' && m.k === 'levelup'), 'sfx เดิมยังมี');

clear(); w.addXp(a.p, 'wood', S.xpFor(5, 'wood') - a.p.rec.skills.wood);
for (const x of [a, b]) assert.deepStrictEqual(ups(x.ws), [{ t: 'lvup', id: a.p.id, skill: 'wood', lv: 5, n: 3 }], 'ข้ามหลายขั้นมี n');
console.log('ผ่าน: lvup');
process.exit(0);
