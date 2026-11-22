// ทดสอบราคาช่างไม้ (3.2): ขายคืน 0.85 เฉพาะของประดิษฐ์เอง • ค่าโรงช่าง 20% ทุกสูตร • มาร์จิ้น • ไม่ปั๊มเงิน • rare/ของร้านไม่เป็นช่องปั๊ม
// รัน: node tools/test-craft-price.js
const assert = require('assert'), S = require('../public/shared.js');
const raw = k => S.itemInfo(k).sell || 0, F = S.FURN;
const recs = S.CRAFT.filter(r => r.id.startsWith('furn_')), key = r => r.id.slice(5);
const cost = r => Object.entries(r.in).reduce((a, [k, n]) => a + raw(k) * n, 0);
// ใช้ plank 44 ตามรายงาน
assert.strictEqual(raw('plank'), 44);
assert.strictEqual(S.FURN_SELL_CRAFT, 0.85); assert.strictEqual(S.FURN_SELL, 0.35); assert.strictEqual(S.CRAFT_FEE, 0.2);
// 1) ค่าโรงช่าง = 20% ของราคา ทุกสูตรเฟอร์นิเจอร์ และยิ่งแพงยิ่งแพง • ไม้กระดานไม่มีค่า
for (const r of recs) assert.strictEqual(S.craftFee(r.id), Math.round(F[key(r)].price * 0.2), r.id);
assert.strictEqual(S.craftFee('plank'), 0);
const byPrice = recs.slice().sort((a, b) => F[key(a)].price - F[key(b)].price);
for (let i = 1; i < byPrice.length; i++) assert.ok(S.craftFee(byPrice[i].id) >= S.craftFee(byPrice[i - 1].id), 'ค่าทำต้องไล่ตามราคา');
// 2) ราคาขายคืน: ของประดิษฐ์เอง 0.85 • ของที่ร้านขาย 0.35 • rare ขายไม่ได้
for (const [k, f] of Object.entries(F)) {
  const i = S.itemInfo('furn_' + k);
  if (f.rare) assert.strictEqual(i.sell, undefined, k + ' rare ต้องขายคืนไม่ได้');
  else if (f.noshop || f.craft) assert.strictEqual(i.sell, Math.floor(f.price * 0.85), k);
  else assert.strictEqual(i.sell, Math.floor(f.price * 0.35), k);
}
// 3) มาร์จิ้นสุทธิ (ขายคืน − ค่าโรงช่าง) เทียบวัตถุดิบดิบ: ชุดที่ปรับตามข้อ 3.2 อยู่ +8–26% • ที่เหลือต้องไม่ขาดทุนและไม่เกิน +35%
const LISTED = ['chair', 'table', 'shelf', 'bed', 'screen_bamboo', 'stool', 'armchair', 'wardrobe', 'dresser', 'bedking', 'nightstand', 'screen_wood', 'coffeetable', 'bedsingle', 'cupboard', 'desk'];
for (const r of recs) {
  const net = S.itemInfo(r.id).sell - S.craftFee(r.id), mg = net / cost(r) - 1, k = key(r);
  if (LISTED.includes(k)) assert.ok(mg >= 0.075 && mg <= 0.26, `${k} มาร์จิ้น ${(mg * 100).toFixed(1)}% ต้อง 8–26%`);
  else assert.ok(mg >= 0.05 && mg <= 0.35, `${k} (นอกรายการ 3.2) มาร์จิ้น ${(mg * 100).toFixed(1)}%`);
}
// 4) สูตรใหม่ตามรายการ
const R = id => S.CRAFT.find(x => x.id === 'furn_' + id);
assert.deepStrictEqual([R('shelf').in.log, R('shelf').xp], [11, 18]); assert.deepStrictEqual([R('bed').in.log, R('bed').xp], [12, 28]);
assert.deepStrictEqual([R('screen_bamboo').in.bamboo, R('screen_bamboo').xp], [16, 40]); assert.deepStrictEqual([R('armchair').in.palmwood, R('armchair').xp], [4, 32]);
assert.deepStrictEqual([R('wardrobe').in.teak, R('wardrobe').xp], [6, 85]); assert.deepStrictEqual([R('dresser').in.goldwood, R('dresser').xp], [5, 81]);
assert.deepStrictEqual([R('nightstand').in.log, R('nightstand').xp], [5, 24]); assert.deepStrictEqual([R('screen_wood').in.plank, R('screen_wood').xp], [3, 56]);
assert.deepStrictEqual([R('coffeetable').in.bamboo, R('coffeetable').xp], [7, 26]); assert.deepStrictEqual([R('bedsingle').in.pinewood, R('bedsingle').xp], [8, 56]);
assert.deepStrictEqual([R('cupboard').in.palmwood, R('cupboard').xp], [6, 64]); assert.deepStrictEqual([R('desk').in.teak, R('desk').xp], [5, 66]);
for (const k of ['chair', 'table', 'stool', 'bedking']) { /* ไม่เปลี่ยน */ }
assert.strictEqual(R('chair').in.log, 4); assert.strictEqual(R('table').in.log, 8); assert.strictEqual(R('stool').in.pinewood, 2); assert.strictEqual(R('bedking').in.rosewood, 5);
// 5) ไม่ปั๊มเงิน: ของที่ร้านขาย ซื้อร้าน→ขายคืน ขาดทุนเสมอ • ของประดิษฐ์เองซื้อจากร้านไม่ได้ (ไม่อยู่ในรายการซื้อ)
const shopBuy = S.SHOPS.furn.buy;
for (const k of shopBuy) { const i = S.itemInfo(k); assert.ok(i.sell < i.buy, k + ' ซื้อ→ขายคืนต้องขาดทุน'); }
for (const [k, f] of Object.entries(F)) if (f.noshop || f.craft || f.rare) assert.ok(!shopBuy.includes('furn_' + k), k + ' ต้องไม่วางขายในร้าน');
// 6) แผง/เสนอซื้อ: ราคาต่ำสุดของของประดิษฐ์เองไม่ต่ำกว่าราคาขายคืนระบบ (ซื้อแผง→ขายระบบห้ามกำไร) และไม่เกินเพดาน
for (const r of recs) { const lo = S.stallMin(r.id), hi = Math.floor(S.tradeValue(r.id) * S.STALL.max); assert.ok(lo >= S.itemInfo(r.id).sell && lo <= hi, r.id); assert.strictEqual(S.tradeValue(r.id), F[key(r)].price, 'std = ราคาเต็ม ' + r.id); }
assert.strictEqual(S.stallMin('plank'), Math.ceil(44 * S.STALL.min)); // ของอื่นไม่กระทบ
// 7) ทุกที่ที่อ่านราคาตรงกัน: holdingsValue ใช้ราคาเต็ม (ไม่ผูก sell) • tradeValue ของ rare ไม่ใช่ราคาขายคืน
assert.strictEqual(S.holdingsValue({ furn_chair: 2 }), 2 * F.chair.price);
assert.ok(S.stallMin('furn_cat') >= 1 && S.itemInfo('furn_cat').sell === undefined);
// 8) ของแจกฟรีที่ขายคืนได้ 0.85 (ตามรอยได้): เควสเริ่มต้นแจกเก้าอี้ 1 ตัว = ขายได้ 102 (ครั้งเดียวต่อบัญชี) ต้องไม่เกินมูลค่าที่ตั้งใจ
const freeNoshop = S.STARTER_FINAL.items.filter(k => /^furn_/.test(k) && S.furnCraftOnly(F[k.slice(5)]));
assert.deepStrictEqual(freeNoshop, ['furn_chair']);
assert.ok(S.itemInfo('furn_chair').sell <= S.STARTER_FINAL.coin, 'เก้าอี้ฟรีขายคืนต้องไม่เกินเงินรางวัลเริ่มต้น');
for (const k of S.RARE) assert.ok(F[k].rare && S.itemInfo('furn_' + k).sell === undefined, k + ' ของรางวัล rare ต้องขายไม่ได้');
console.log('✓ ผ่าน: craft-price');
