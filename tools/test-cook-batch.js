// ทดสอบทำอาหารทีละหลายจาน (cook n): หักวัตถุดิบ/ค่าเตา/XP ต่อจานเท่าเดิม • เตาพักรวม = เวลา × จาน • ของไม่พอ = ทำเท่าที่ได้ • n ผิดปกติถูกบีบ • เตาร้อนอยู่ปฏิเสธ
// รัน: node tools/test-cook-batch.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-cookbatch-');
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('main'), got = [];
const mk = inv => { const p = { name: 'K', key: 'k', id: 'K', x: 0, y: 0, ws: { readyState: 1, send(s) { got.push(JSON.parse(s)); } }, rec: { name: 'K', inv, skills: { cook: 0 }, dur: {} } }; w.players.set('K', p); w.saved.k = p.rec; return p; };
w.nearShopKind = () => 'food'; w.event = () => {};
const r = S.COOK.find(x => x.lv === 1 && x.in.every(i => i.k)); assert.ok(r, 'มีสูตร lv1 วัตถุดิบเจาะจง');
const base = S.cookUse(Object.fromEntries(r.in.map(i => [i.k, 999])), r).use, fee = Math.round(r.sell * S.panFee(r, S.panTier({}), true));
const inv0 = () => Object.assign({ coin: 100000 }, Object.fromEntries(Object.entries(base).map(([k, n]) => [k, n * 20])));
// 1) n=3: ได้ 3 จาน หักของ/เหรียญ ×3 เตาพัก 3×เวลา
{ const p = mk(inv0()); got.length = 0; const before = JSON.stringify(p.rec.inv); w.cook(p, r.id, 3);
  assert.strictEqual(p.rec.inv[r.id], 3, 'ได้ 3 จาน'); for (const [k, n] of Object.entries(base)) assert.strictEqual(p.rec.inv[k], n * 20 - n * 3, 'หักวัตถุดิบ ×3 ' + k);
  assert.strictEqual(100000 - p.rec.inv.coin, fee * 3, 'ค่าเตา ×3'); const cd = got.filter(m => m.t === 'cookcd'); assert.strictEqual(cd.length, 1); assert.strictEqual(cd[0].ms, r.time * 3);
  got.length = 0; w.cook(p, r.id, 2); assert.strictEqual(p.rec.inv[r.id], 3, 'เตาร้อนอยู่ทำเพิ่มไม่ได้'); assert.ok(got.some(m => m.t === 'cookcd')); }
// 2) ไม่ส่ง n / n=1 = ทีละจานเหมือนเดิม
{ const p = mk(inv0()); w.cook(p, r.id); assert.strictEqual(p.rec.inv[r.id], 1); const q = mk(inv0()); w.cook(q, r.id, 1); assert.strictEqual(q.rec.inv[r.id], 1); }
// 3) ของพอแค่ 2 จาน สั่ง 5 = ได้ 2 จาน (ไม่ติดลบ)
{ const p = mk(Object.assign({ coin: 100000 }, Object.fromEntries(Object.entries(base).map(([k, n]) => [k, n * 2])))); w.cook(p, r.id, 5); assert.strictEqual(p.rec.inv[r.id], 2); for (const k of Object.keys(base)) assert.ok((p.rec.inv[k] || 0) >= 0); }
// 4) เหรียญพอแค่ 2 จาน
if (fee > 0) { const p = mk(Object.assign(inv0(), { coin: fee * 2 + (fee - 1) })); w.cook(p, r.id, 5); assert.strictEqual(p.rec.inv[r.id], 2, 'เหรียญจำกัดจำนวนจาน'); assert.ok(p.rec.inv.coin >= 0); }
// 5) n ผิดปกติ: เกินเพดาน/ลบ/ทศนิยม/ข้อความ → บีบ 1..COOK_BATCH_MAX หรือ 1
{ const p = mk(inv0()); w.cook(p, r.id, 9999); assert.strictEqual(p.rec.inv[r.id], S.COOK_BATCH_MAX, 'เกินเพดาน'); }
for (const bad of [-5, 0, 1.5, '3', null, NaN]) { const p = mk(inv0()); w.cook(p, r.id, bad); assert.strictEqual(p.rec.inv[r.id], 1, 'n ผิดปกติ ' + String(bad) + ' = 1 จาน'); }
// 6) ไม่มีของเลย = ไม่ได้ ไม่ส่ง cookcd
{ const p = mk({ coin: 1000 }); got.length = 0; w.cook(p, r.id, 4); assert.ok(!p.rec.inv[r.id]); assert.ok(!got.some(m => m.t === 'cookcd')); assert.ok(!p.cookReady || p.cookReady <= Date.now()); }
console.log('✓ ผ่าน: cook-batch');
