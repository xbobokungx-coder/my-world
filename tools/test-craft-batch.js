// ทดสอบประดิษฐ์ที่ร้านช่างไม้ทีละหลายชิ้น (craft n): หักไม้/ค่าโรงช่าง/XP ต่อชิ้นเท่าเดิม • ของไม่พอ = ทำเท่าที่ได้ • n ผิดปกติถูกบีบ
// รัน: node tools/test-craft-batch.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-craftbatch-');
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('main'), got = [];
const mk = inv => { const p = { name: 'K', key: 'k', id: 'K', x: 0, y: 0, ws: { readyState: 1, send(s) { got.push(JSON.parse(s)); } }, rec: { name: 'K', inv, skills: { wood: 1e9 }, dur: {} } }; w.players.set('K', p); w.saved.k = p.rec; return p; };
w.nearShopKind = () => 'wood'; w.event = () => {};
const r = S.CRAFT.find(x => x.lv <= 1) || S.CRAFT[0], fee = S.craftFee(r.id);
const stock = k => Object.fromEntries(Object.entries(r.in).map(([i, n]) => [i, n * k]));
const inv0 = () => Object.assign({ coin: 1e6 }, stock(30));
// 1) n=4 ได้ 4 ชิ้น หัก ×4
{ const p = mk(inv0()); w.craft(p, r.id, 4); assert.strictEqual(p.rec.inv[r.id], 4); for (const [k, n] of Object.entries(r.in)) assert.strictEqual(p.rec.inv[k], n * 30 - n * 4, k); assert.strictEqual(1e6 - p.rec.inv.coin, fee * 4, 'ค่าโรงช่าง ×4'); }
// 2) ไม่ส่ง n = 1 ชิ้น (ทำซ้ำได้ทันที ไม่มีเตาพัก)
{ const p = mk(inv0()); w.craft(p, r.id); w.craft(p, r.id); assert.strictEqual(p.rec.inv[r.id], 2); }
// 3) ไม้พอ 2 ชิ้น สั่ง 6 = ได้ 2
{ const p = mk(Object.assign({ coin: 1e6 }, stock(2))); w.craft(p, r.id, 6); assert.strictEqual(p.rec.inv[r.id], 2); for (const k of Object.keys(r.in)) assert.ok((p.rec.inv[k] || 0) >= 0); }
// 4) เหรียญพอ 2 ชิ้น
if (fee > 0) { const p = mk(Object.assign(inv0(), { coin: fee * 2 + fee - 1 })); w.craft(p, r.id, 6); assert.strictEqual(p.rec.inv[r.id], 2); assert.ok(p.rec.inv.coin >= 0); }
// 5) n ผิดปกติ
{ const p = mk(inv0()); w.craft(p, r.id, 9999); assert.strictEqual(p.rec.inv[r.id], S.CRAFT_BATCH_MAX); }
for (const bad of [-3, 0, 2.5, '5', null, NaN]) { const p = mk(inv0()); w.craft(p, r.id, bad); assert.strictEqual(p.rec.inv[r.id], 1, 'n ผิดปกติ ' + String(bad)); }
// 6) ของไม่มี/ผิดร้าน = ไม่ได้
{ const p = mk({ coin: 1000 }); w.craft(p, r.id, 3); assert.ok(!p.rec.inv[r.id]); const q = mk(inv0()); w.nearShopKind = () => 'farm'; w.craft(q, r.id, 3); assert.ok(!q.rec.inv[r.id]); w.nearShopKind = () => 'wood'; }
console.log('✓ ผ่าน: craft-batch');
