// ทดสอบวัตถุดิบทางเลือกของเชฟ (S.COOK_ALT / S.cookUse): เห็ดทรัฟเฟิลปลูก ×1 = เห็ดทรัฟเฟิลป่า (truffle) ×1 • ชื่อไม่ซ้ำกัน • ราคา/XP จานเท่าเดิม
// รัน: node tools/test-cook-alt.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-cookalt-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('cookalt'); let seq = 0;
function mk(inv) {
  const ws = mkWs(), p = w.join(ws, 'alt' + (++seq), '#fff').p; p.ws2 = ws;
  p.rec.inv = Object.assign({ coin: 100000 }, inv); p.rec.hunger = 100; p.rec.skills = { farm: 0, fish: 0, animal: 0, wood: 0, cook: 1e9, mine: 0 };
  const [cx, cy] = S.BUILDINGS.find(b => b.kind === 'food').counter[0]; p.x = (cx + 0.5) * TS; p.y = (cy + 0.5) * TS; return p;
}
const have = (p, k) => p.rec.inv[k] || 0, cook = (p, id) => { p.cookReady = 0; w.handle(p, { t: 'cook', id }); };
const OM = 'dish_truffleomelet', SP = 'dish_trufflesoup';

// ข้อมูล: ชื่อต่างกัน id เดิม ราคา/XP เดิม
assert.strictEqual(S.CROPS.mushroom.name, 'เห็ดทรัฟเฟิลปลูก'); assert.strictEqual(S.itemInfo('crop_mushroom').name, 'เห็ดทรัฟเฟิลปลูก');
assert.strictEqual(S.itemInfo('truffle').name, 'เห็ดทรัฟเฟิลป่า'); assert.notStrictEqual(S.itemInfo('crop_mushroom').name, S.itemInfo('truffle').name);
assert.strictEqual(S.CROPS.mushroom.sell, 278); assert.strictEqual(S.itemInfo('truffle').sell, 85);
{ const o = S.COOK.find(r => r.id === OM), s = S.COOK.find(r => r.id === SP);
  assert.deepStrictEqual([o.sell, o.xp, o.lv, o.time], [650, 1009, 18, 14500]); assert.deepStrictEqual([s.sell, s.xp, s.lv, s.time], [700, 1133, 19, 15500]);
  assert.deepStrictEqual(o.in, [{ k: 'crop_mushroom', n: 1 }, { k: 'egg', n: 2 }]); }
// อัตราแลกเปลี่ยน 1:1 (เจ้าของสั่ง: เห็ดปลูกกับป่าใช้แทนกันตรงๆ)
{ const a = S.COOK_ALT.crop_mushroom[0]; assert.strictEqual(a.k, 'truffle'); assert.strictEqual(a.n, 1); }
// cookUse (ตัวช่วยที่เว็บเรียก)
{ const r = S.COOK.find(x => x.id === OM);
  let u = S.cookUse({ truffle: 1, egg: 2 }, r); assert.ok(u.ok); assert.deepStrictEqual(u.use, { truffle: 1, egg: 2 }); assert.ok(u.rows[0].alt && u.rows[0].picks[0].k === 'truffle');
  u = S.cookUse({ truffle: 0, egg: 2 }, r); assert.ok(!u.ok && u.bad === 'basic' && !u.rows[0].ok && u.rows[1].ok);
  u = S.cookUse({ crop_mushroom: 1, truffle: 9, egg: 2 }, r); assert.deepStrictEqual(u.use, { crop_mushroom: 1, egg: 2 }); assert.ok(!u.rows[0].alt, 'มีทั้งสองใช้เห็ดปลูกก่อน');
  u = S.cookUse({ crop_mushroom: 1, egg: 2 }, r); assert.ok(u.ok && !u.rows[0].alt);
  u = S.cookUse({ egg: 2 }, r); assert.ok(!u.ok);
  const before = JSON.stringify({ truffle: 1, egg: 2 }), inv = { truffle: 1, egg: 2 }; S.cookUse(inv, r); assert.strictEqual(JSON.stringify(inv), before, 'ไม่แก้คลัง'); }
// ฝั่งเซิร์ฟเวอร์
{ // เห็ดป่า ×1 ทำไข่เจียวได้ หักถูก
  const p = mk({ truffle: 1, egg: 2 }); cook(p, OM); assert.strictEqual(have(p, OM), 1); assert.strictEqual(have(p, 'truffle'), 0); assert.strictEqual(have(p, 'egg'), 0); assert.strictEqual(have(p, 'crop_mushroom'), 0); }
{ // ไม่มีเห็ดเลย ของไม่หาย
  const p = mk({ egg: 2 }), c0 = have(p, 'coin'); cook(p, OM); assert.strictEqual(have(p, OM), 0); assert.strictEqual(have(p, 'egg'), 2); assert.strictEqual(have(p, 'coin'), c0); }
{ // เห็ดปลูกทำได้ และไม่แตะเห็ดป่า
  const p = mk({ crop_mushroom: 1, truffle: 1, egg: 2 }); cook(p, OM); assert.strictEqual(have(p, OM), 1); assert.strictEqual(have(p, 'crop_mushroom'), 0); assert.strictEqual(have(p, 'truffle'), 1); }
{ // มีทั้งสองอย่างเต็ม ใช้เห็ดปลูกก่อน
  const p = mk({ crop_mushroom: 2, truffle: 9, milk: 2 }); cook(p, SP); assert.strictEqual(have(p, SP), 1); assert.strictEqual(have(p, 'crop_mushroom'), 1); assert.strictEqual(have(p, 'truffle'), 9); assert.strictEqual(have(p, 'milk'), 1); }
{ // ซุป: เห็ดป่า ×1 + นม เศษเหลือ (7 → 6)
  const p = mk({ truffle: 7, milk: 1 }); cook(p, SP); assert.strictEqual(have(p, SP), 1); assert.strictEqual(have(p, 'truffle'), 6); assert.strictEqual(have(p, 'milk'), 0); }
{ // ความสด/lots ของไข่ที่หักพร้อมกันยังตรงกับคลัง; ราคา/XP/เหรียญเท่ากันไม่ว่าใช้ตัวไหน
  const a = mk({ truffle: 1, egg: 5 }), b = mk({ crop_mushroom: 1, egg: 5 }); const xa = a.rec.skills.cook, xb = b.rec.skills.cook, ca = have(a, 'coin'), cb = have(b, 'coin');
  cook(a, OM); cook(b, OM);
  for (const p of [a, b]) { assert.strictEqual(have(p, 'egg'), 3); const lots = (p.rec.lots && p.rec.lots.egg) || []; assert.strictEqual(lots.reduce((t, l) => t + l[1], 0), have(p, 'egg'), 'lots ไข่ตรงกับคลัง'); }
  assert.strictEqual(ca - have(a, 'coin'), cb - have(b, 'coin'), 'ค่าเตาเท่ากัน'); assert.strictEqual(a.rec.skills.cook - xa, b.rec.skills.cook - xb, 'XP เท่ากัน'); }
console.log('test-cook-alt: ผ่านทั้งหมด'); process.exit(0);
