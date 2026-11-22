// ทดสอบราคาอาหารตามวัตถุดิบที่ใช้ (B′: dish_<ชื่อ>_qN) — docs/reports/economy-reprice.md ข้อ 3.1
// รัน: node tools/test-cook-tier.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-cooktier-');
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('main'), got = [];
const mk = inv => { const p = { name: 'K', key: 'k', id: 'K', x: 0, y: 0, ws: { readyState: 1, send(s) { got.push(JSON.parse(s)); } }, rec: { name: 'K', inv, skills: { cook: 2e6 }, dur: {} } }; w.players.set('K', p); w.saved.k = p.rec; return p; };
w.nearShopKind = () => 'food'; w.event = () => {};
const broad = S.COOK.filter(r => S.cookRange(r)), sig = S.COOK.filter(r => !S.cookRange(r));
assert.ok(broad.length >= 20 && sig.length >= 20, 'มีทั้งสูตรหมวดกว้างและเจาะจง');
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const fishK = S.FISH_ALL.filter(f => f.id !== 'boot').map(f => 'fish_' + f.id), cropK = Object.keys(S.CROPS).map(c => 'crop_' + c), eggK = ['egg', 'duck_egg'];
const pick = (a, n) => { const o = {}; for (let i = 0; i < n; i++) o[a[Math.floor(rnd() * a.length)]] = 1 + Math.floor(rnd() * 4); return o; };
const rich = () => Object.assign({}, pick(fishK, 1 + Math.floor(rnd() * 8)), pick(cropK, 1 + Math.floor(rnd() * 4)), pick(eggK, 1 + Math.floor(rnd() * 2)), { milk: 9, meal_bread: 9, crop_mushroom: 9 });
const feeR = S.COOK_FEE;

// 1) ระดับ 0 = ราคาฐานเดิม และสูตรฐานไม่ขาดทุนเมื่อใช้ของถูกสุด
for (const r of broad) { const rg = S.cookRange(r); assert.ok(r.sell * (1 - feeR) >= rg.min - 1, `${r.id}: ฐาน net ${(r.sell * (1 - feeR)).toFixed(1)} < วัตถุดิบถูกสุด ${rg.min}`); assert.strictEqual(S.cookSell(r, 0), r.sell); assert.strictEqual(S.itemInfo(r.id).sell, r.sell, 'คีย์เดิมคงราคาฐาน'); }
{ const inv = { crop_carrot: 9, fish_carp: 9, egg: 9 }, r = S.COOK.find(x => x.id === 'dish_saltfish'), cu = S.cookUse(inv, r), q = S.cookQuote(r, cu); assert.ok(cu.ok); assert.strictEqual(q.key, 'dish_saltfish'); assert.strictEqual(q.sell, 20); assert.strictEqual(q.q, 0, 'ปลาถูกสุด = ระดับ 0'); }
// 2) สุ่มคลัง: ทุกระดับ net ≥ วัตถุดิบ, ส่วนเพิ่มจากการทำไม่เกินฐาน + เศษปัดระดับ (ไม่ปั๊มเงิน แม้ซื้อวัตถุดิบจากแผง/ขายดิบก็ได้เท่ากัน)
let n2 = 0, maxQ = 0;
for (let it = 0; it < 300; it++) for (const r of broad) {
  const inv = rich(), cu = S.cookUse(inv, r); if (!cu.ok) continue; n2++;
  const q = S.cookQuote(r, cu), rg = S.cookRange(r), fee = Math.round(q.sell * feeR), net = q.sell - fee;
  assert.ok(q.R >= rg.min && q.R <= rg.max, `${r.id}: R นอกช่วง`); assert.ok(net >= q.R - 1, `${r.id} q${q.q}: net ${net} < วัตถุดิบ ${q.R}`);
  const d = (q.R - rg.min) / (1 - feeR), added = net - q.R, addedBase = r.sell * (1 - feeR) - rg.min;
  assert.ok(added <= addedBase + 0.2 * d + 0.7 * S.COOK_TIER.base + 1, `${r.id} q${q.q}: ส่วนเพิ่ม ${added.toFixed(1)} เกินฐาน ${addedBase.toFixed(1)} + เศษปัดระดับ`);
  assert.ok(q.sell >= r.sell && (q.q === 0) === (q.sell === r.sell) && (q.q === 0) === (q.key === r.id)); assert.strictEqual(q.key, q.q ? `${r.id}_q${q.q}` : r.id); assert.ok(q.q <= rg.maxQ); maxQ = Math.max(maxQ, q.q);
}
assert.ok(n2 > 1000 && maxQ >= 5, 'สุ่มได้หลายระดับ ' + maxQ);
// ขอบบน: ใช้ของแพงสุด ได้ระดับสูงสุด ราคาไม่เกินฐาน + ส่วนเกินจริง × 1.25 + 5
for (const r of broad) { const rg = S.cookRange(r), inv = Object.fromEntries([...fishK, ...cropK, ...eggK].map(k => [k, 99])); // มีทุกอย่าง: ใช้ถูกสุดเสมอ
  const q0 = S.cookQuote(r, S.cookUse(inv, r)); assert.strictEqual(q0.q, 0, r.id + ' มีของถูกด้วยใช้ถูกสุด');
  const hiInv = {}; const top = (a, nn) => a.sort((x, y) => S.itemInfo(y).sell - S.itemInfo(x).sell).slice(0, nn); for (const need of r.in) if (need.c) for (const k of top((need.c === 'fish' ? fishK : need.c === 'crop' ? cropK : eggK).slice(), need.u ? need.n : 1)) hiInv[k] = 99; for (const need of r.in) if (need.k) hiInv[need.k] = 99;
  const cu = S.cookUse(hiInv, r); if (!cu.ok) continue; const q = S.cookQuote(r, cu); assert.ok(q.sell <= r.sell + (q.R - rg.min) / (1 - feeR) * 1.25 + 6, `${r.id} ราคาบนเกินส่วนเกิน`); assert.ok(q.R <= rg.max); }
// 3) คีย์ระดับ: itemInfo/sellCat/kindOf/FOOD/isTradable/perishable/mktKey ครบทุกระดับของทุกสูตร
let keys = 0;
for (const r of S.COOK) { const rg = S.cookRange(r), top = rg ? rg.maxQ : 0;
  for (let q = 0; q <= top; q++) { const k = q ? `${r.id}_q${q}` : r.id, i = S.itemInfo(k); keys++;
    assert.ok(i && i.name && i.emoji && i.sell === S.cookSell(r, q) && i.cat === 'food', k); assert.strictEqual(i.food, S.FOOD[r.id], k + ' food เท่าฐานทุกระดับ'); assert.strictEqual(S.sellCat(k), 'dish'); assert.strictEqual(S.kindOf(k), 'food'); assert.ok(S.perishable(k)); assert.ok(S.isTradable(k), k + ' เทรด/แผงได้'); assert.strictEqual(S.mktKey(k), r.id); assert.strictEqual(S.tradeValue(k), i.sell); assert.ok(S.shopSells('food', k), 'ร้านอาหารรับซื้อ');
    if (q) assert.ok(i.sell > S.itemInfo(`${r.id}${q > 1 ? '_q' + (q - 1) : ''}`).sell, k + ' แพงขึ้นตามระดับ'); }
  assert.strictEqual(S.itemInfo(`${r.id}_q${top + 1}`), null, r.id + ' ระดับเกินไม่มี'); }
for (const bad of ['dish_saltfish_q0', 'dish_saltfish_q01', 'dish_saltfish_q-1', 'dish_saltfish_q1_q2', 'dish_saltfish_qx', 'dish_saltfish_q1.5', 'dish_nothing_q1', 'dish_', 'dish_saltfish_q', 'dish_saltfish_q999999']) assert.strictEqual(S.itemInfo(bad), null, bad);
for (const r of sig) assert.strictEqual(S.itemInfo(r.id + '_q1'), null, r.id + ' สูตรเจาะจงไม่มีระดับ');
assert.ok(keys > 300, 'จำนวนคีย์ระดับ ' + keys + ' (ถ้าบานเกินไปให้ปรับ COOK_TIER)'); assert.ok(S.holdingsValue({ dish_saltfish_q3: 2 }) === 2 * S.itemInfo('dish_saltfish_q3').sell);
assert.ok(!S.SELLABLE.some(k => /_q\d+$/.test(k)), 'SELLABLE มีแค่คีย์ฐาน (ใบสั่งซื้อ/ตลาดกลางใช้ฐาน)');
// 4) เซฟเก่า: คีย์เดิมในกระเป๋าใช้ได้ (ขาย/กิน) ราคาฐาน
{ const p = mk({ coin: 0, dish_grill: 3, dish_saltfish: 2 }); w.market.dish_grill = w.market.dish_grill || { m: 1, t: 1 }; const c0 = p.rec.inv.coin; w.sell(p, 'dish_saltfish', 2); assert.strictEqual(p.rec.inv.dish_saltfish || 0, 0); assert.ok(p.rec.inv.coin - c0 >= 2 * 20 * 0.7, 'ขายคีย์เดิมได้ราคาฐาน'); }
// 5) cook(): ปลาถูก-กลาง-แพง ได้ระดับต่างกัน ขายได้ราคาตามที่ใช้ และใช้ตลาดฐานร่วม
{ const r = S.COOK.find(x => x.id === 'dish_saltfish'), rows = [['fish_carp', 0], ['fish_bass', 0], ['fish_lobster', 0]];
  const prices = {}; for (const [fk] of rows) { const p = mk({ coin: 99999, [fk]: 1 }); p.cookReady = 0; w.cook(p, r.id, 1); const out = Object.keys(p.rec.inv).filter(k => k.startsWith('dish_')); assert.strictEqual(out.length, 1, fk); prices[fk] = S.itemInfo(out[0]).sell; assert.ok(!p.rec.inv[fk], 'หักปลา'); const fee = 99999 - p.rec.inv.coin; assert.strictEqual(fee, Math.round(prices[fk] * S.panFee(r, S.panTier({}), true)), 'ค่าเตาคิดจากราคาระดับ'); assert.ok(prices[fk] * (1 - feeR) >= S.itemInfo(fk).sell - 1, fk + ' ไม่ขาดทุน'); }
  assert.strictEqual(prices.fish_carp, 20); assert.ok(prices.fish_bass > prices.fish_carp && prices.fish_lobster > prices.fish_bass, JSON.stringify(prices));
  console.log('  ปลาเผาเกลือ ราคาขาย:', JSON.stringify(prices)); }
// 6) cook หลายจาน: ของต่างกันในชุดเดียว ได้คีย์ระดับตามที่ใช้จริงทีละจาน
{ const r = S.COOK.find(x => x.id === 'dish_saltfish'), p = mk({ coin: 99999, fish_carp: 1, fish_bass: 1, fish_lobster: 1 }); w.cook(p, r.id, 5);
  const dishes = Object.keys(p.rec.inv).filter(k => k.startsWith('dish_')); assert.strictEqual(dishes.length, 3, 'ได้ 3 ระดับ ' + dishes); assert.ok(dishes.includes('dish_saltfish')); for (const k of dishes) assert.strictEqual(p.rec.inv[k], 1);
  assert.strictEqual(['fish_carp', 'fish_bass', 'fish_lobster'].filter(k => p.rec.inv[k]).length, 0)
  const p2 = mk({ coin: 99999, fish_carp: 4 }); w.cook(p2, r.id, 4); assert.strictEqual(p2.rec.inv.dish_saltfish, 4, 'ของเท่ากัน = กองเดียว'); }
// 7) ตลาด: ทุกระดับใช้ราคาตลาดของอาหารฐานร่วมกัน และขายแล้วตลาดฐานขยับ
{ const p = mk({ coin: 0, dish_saltfish_q5: 3, dish_saltfish: 3 }); w.market.dish_saltfish = { m: 0.8, t: 1 }; p.rec.cat = {}; p.rec.mk = {};
  assert.strictEqual(w.effMult(p, 'dish_saltfish_q5'), w.effMult(p, 'dish_saltfish')); const m0 = w.market.dish_saltfish.m; w.sell(p, 'dish_saltfish_q5', 3); assert.ok(w.market.dish_saltfish.m < m0, 'ขายระดับสูงก็กดตลาดฐาน'); assert.ok(p.rec.mk.dish_saltfish < 1 && p.rec.mk.dish_saltfish_q5 === undefined); assert.ok(!p.rec.inv.dish_saltfish_q5); assert.ok(p.rec.inv.coin > 0); }
// 8) กินได้ ความอิ่มเท่าฐาน
{ const p = mk({ coin: 0, dish_saltfish_q4: 1 }); p.rec.hunger = 10; w.setHunger = w.setHunger || (() => {}); const info = S.itemInfo('dish_saltfish_q4'); assert.strictEqual(info.food, 30); }
console.log('✓ ผ่าน: cook-tier (คีย์ระดับ ' + keys + ' คีย์, สุ่ม ' + n2 + ' คลัง, ระดับสูงสุดที่สุ่มได้ ' + maxQ + ')');
