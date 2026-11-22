// ทดสอบ: วัตถุดิบไม่สด (ค้าง/เก่า) ทำอาหารไม่ได้ • ใช้ของสดก่อนและไม่แตะกองเก่า • cookInv นับเฉพาะของสด
// รัน: node tools/test-cook-fresh.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-cookfresh-');
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('main'), got = [];
const mk = (inv, lots) => { const p = { name: 'K', key: 'k', id: 'K', x: 0, y: 0, ws: { readyState: 1, send(s) { got.push(JSON.parse(s)); } }, rec: { name: 'K', inv, lots, skills: { cook: 0 }, dur: {} } }; w.players.set('K', p); w.saved.k = p.rec; return p; };
w.nearShopKind = () => 'food'; w.event = () => {};
const now = Date.now(), H = 3600e3, r = S.COOK.find(x => x.id === 'dish_saltfish'), fish = 'fish_carp';
assert.ok(S.perishable(fish)); assert.strictEqual(S.COOK_FRESH_MAX, 0);
const dish = p => Object.keys(p.rec.inv).filter(k => k.startsWith('dish_saltfish')).reduce((a, k) => a + p.rec.inv[k], 0);
// 1) cookInv: นับเฉพาะของสด
{ const o = S.cookInv({ [fish]: 5, coin: 9, rock: 2 }, { [fish]: [[now - 100 * H, 2], [now - 30 * H, 1], [now - 1 * H, 2]] }, now); assert.strictEqual(o[fish], 2, 'สด 2 (ค้าง/เก่าไม่นับ)'); assert.strictEqual(o.coin, 9); assert.strictEqual(o.rock, 2);
  assert.strictEqual(S.cookInv({ [fish]: 3 }, {}, now)[fish], 3, 'ไม่มีข้อมูล lot = นับเป็นของใหม่'); }
// 2) ของเก่า/ค้างล้วน ทำไม่ได้ + ไม่หักของ/เหรียญ/ไม่เริ่มเตาพัก
{ const p = mk({ coin: 1000, [fish]: 3 }, { [fish]: [[now - 100 * H, 2], [now - 30 * H, 1]] }); got.length = 0; w.cook(p, r.id, 3); assert.strictEqual(dish(p), 0); assert.strictEqual(p.rec.inv[fish], 3); assert.strictEqual(p.rec.inv.coin, 1000); assert.ok(!p.cookReady || p.cookReady <= now, 'ไม่เริ่มเตาพัก');
  assert.ok(got.some(m => m.t === 'msg' && /ไม่สด/.test(m.text)), 'แจ้งว่าวัตถุดิบไม่สด'); }
// 3) ผสม: ใช้ของสดก่อน กองเก่ายังอยู่ ทำได้เท่าที่สดมี
{ const p = mk({ coin: 1000, [fish]: 4 }, { [fish]: [[now - 100 * H, 2], [now - 1 * H, 2]] }); w.cook(p, r.id, 4); assert.strictEqual(dish(p), 2, 'ทำได้ 2 จานจากของสด 2 ตัว'); assert.strictEqual(p.rec.inv[fish], 2, 'เหลือกองเก่า 2');
  const L = w.lotsOf(p.rec, fish); assert.strictEqual(L.reduce((a, [, n]) => a + n, 0), 2); assert.ok(L.every(([t]) => t <= now - 90 * H), 'กองที่เหลือคือกองเก่า'); }
// 4) ของสดล้วน ทำได้ตามปกติ
{ const p = mk({ coin: 1000, [fish]: 2 }, { [fish]: [[now - 2 * H, 2]] }); w.cook(p, r.id, 2); assert.strictEqual(dish(p), 2); assert.ok(!p.rec.inv[fish]); }
// 5) ผักไม่สดก็ทำไม่ได้ (หมวดผัก)
{ const veg = S.COOK.find(x => x.id === 'dish_vegbowl'), ck = Object.keys(S.CROPS)[0], key = 'crop_' + ck; assert.ok(S.perishable(key));
  const p = mk({ coin: 1000, [key]: 4 }, { [key]: [[now - 100 * H, 4]] }); w.cook(p, veg.id, 1); assert.ok(!Object.keys(p.rec.inv).some(k => k.startsWith('dish_vegbowl')), 'ผักเก่าทำไม่ได้'); assert.strictEqual(p.rec.inv[key], 4); }
console.log('✓ ผ่าน: cook-fresh');
