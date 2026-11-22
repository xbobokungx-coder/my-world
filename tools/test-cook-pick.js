// ทดสอบเลือกวัตถุดิบเองในแถวหมวดกว้างของเชฟ (pick) • รัน: node tools/test-cook-pick.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-cookpick-');
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('main'), got = [];
const mk = inv => { const p = { name: 'K', key: 'k', id: 'K', x: 0, y: 0, ws: { readyState: 1, send(s) { got.push(JSON.parse(s)); } }, rec: { name: 'K', inv, skills: { cook: 2e6 }, dur: {} } }; w.players.set('K', p); w.saved.k = p.rec; return p; };
w.nearShopKind = () => 'food'; w.event = () => {};
const R = S.COOK.find(x => x.id === 'dish_saltfish'), fi = R.in.findIndex(x => x.c === 'fish' && !x.k && !x.u);
assert.ok(fi >= 0, 'สูตรมีแถวปลาหมวด');
const fishK = S.FISH_ALL.filter(f => f.id !== 'boot').map(f => 'fish_' + f.id).sort((a, b) => S.itemInfo(a).sell - S.itemInfo(b).sell);
const cheap = fishK[0], dear = fishK[fishK.length - 1];
const base = () => { const inv = { coin: 99999 }; for (const need of R.in) { if (need.k) inv[need.k] = 50; } inv[cheap] = 50; inv[dear] = 50; inv.crop_carrot = 50; inv.egg = 50; return inv; };
const keyOf = inv => Object.keys(inv).filter(k => k.startsWith(R.id) && inv[k] > 0);
const run = (inv, n, pick) => { const p = mk(inv); w.cookPick; p.cookReady = 0; w.cook(p, R.id, n, pick); return p.rec.inv; };
// 1) shared: ไม่ส่ง pick = เดิม, เลือกแพง = ใช้แพงและ chosen
const inv0 = base(), a = S.cookUse(inv0, R), b = S.cookUse(inv0, R, undefined);
assert.deepStrictEqual(a, b); assert.ok(!('chosen' in a.rows[fi]));
const c = S.cookUse(inv0, R, { [fi]: dear }); assert.ok(c.ok && c.rows[fi].chosen === true && c.rows[fi].picks[0].k === dear);
const qa = S.cookQuote(R, a), qc = S.cookQuote(R, c); assert.ok(qc.q > qa.q && qc.sell > qa.sell, 'เลือกปลาแพง ระดับสูงขึ้น'); assert.strictEqual(qc.sell, S.cookSell(R, qc.q));
// 2) ไม่พอ -> เติมถูกสุด ไม่ปฏิเสธ
const few = base(); few[dear] = 1; const need = R.in[fi].n;
if (need > 1) { const d = S.cookUse(few, R, { [fi]: dear }); assert.ok(d.ok && !d.rows[fi].chosen && d.rows[fi].picks[0].k === dear && d.rows[fi].picks.some(x => x.k === cheap)); }
// 3) ชนิดไม่มี/นอกหมวด/แถวผิด -> เท่าไม่ส่ง pick (shared)
const nof = base(); delete nof[dear];
for (const bad of [{ [fi]: dear }, { [fi]: 'crop_carrot' }, { [fi]: 'coin' }, { [fi]: 5 }, { 99: dear }, { [-1]: dear }]) assert.deepStrictEqual(S.cookUse(nof, R, bad).use, S.cookUse(nof, R).use);
assert.deepStrictEqual(S.cookUse(inv0, R, [dear]).use, a.use);
// 4) เซิร์ฟเวอร์: ล้าง pick
const pj = JSON.parse(`{"__proto__":{"x":1},"${fi}":"${dear}"}`);
assert.deepStrictEqual(w.cookPick(R, pj), { [fi]: dear }); assert.strictEqual(({}).x, undefined);
for (const bad of [[dear], null, 'x', 5, { [fi]: 5 }, { [fi]: 'x'.repeat(41) }, { [fi]: 'crop_carrot' }, { [fi]: 'nope' }, { 1.5: dear }, { 99: dear }, { __proto__: { [fi]: dear } }]) assert.deepStrictEqual(w.cookPick(R, bad), {}, JSON.stringify(bad));
const ki = R.in.findIndex(x => x.k); if (ki >= 0) assert.deepStrictEqual(w.cookPick(R, { [ki]: dear }), {}, 'แถว k ข้าม');
// 5) ทำจริง: ไม่ส่ง pick = ถูกสุด, pick แพง = ระดับสูง, ผลเท่า pick ผิดทั้งหมด
const i1 = run(base(), 1), i2 = run(base(), 1, { [fi]: dear }), i3 = run(base(), 1, pj), i4 = run(base(), 1, [dear]), i5 = run(base(), 1, { [fi]: 'crop_carrot' });
assert.deepStrictEqual(keyOf(i1), [qa.key]); assert.deepStrictEqual(keyOf(i2), [qc.key]); assert.ok(i2[dear] === 50 - R.in[fi].n && i2[cheap] === 50);
assert.deepStrictEqual(keyOf(i4), keyOf(i1)); assert.deepStrictEqual(keyOf(i5), keyOf(i1)); assert.deepStrictEqual(keyOf(i3), keyOf(i2));
// 6) ทำหลายจาน + หมดกลางทาง -> fallback ถูกสุด
const m = base(); m[dear] = R.in[fi].n + 1; const im = run(m, 3, { [fi]: dear });
const total = keyOf(im).reduce((s, k) => s + im[k], 0); assert.strictEqual(total, 3); assert.ok(keyOf(im).length >= 2, 'จานหลังๆ ระดับต่างจากจานแรก');
assert.ok(!im[dear], "ปลาแพงหมดแล้วจานท้ายใช้ถูกสุด"); assert.ok(im[cheap] < 50);
// 7) ไม่ปั๊มเงิน: ซื้อแผงราคาวัตถุดิบ -> ทำ -> ขาย (net หลังค่าเตา) ไม่เกินวัตถุดิบ
for (const q of [qa, qc]) { const net = q.sell - Math.round(q.sell * S.COOK_FEE); assert.ok(net >= q.R - 1 && net <= q.R + R.sell * (1 - S.COOK_FEE) - S.cookRange(R).min + 0.2 * q.R + 10, 'net สมเหตุผล'); }
console.log('test-cook-pick OK');
