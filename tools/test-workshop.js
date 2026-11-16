// ทดสอบการผลิต WP-30 S1: วัสดุแท่ง (bar_*) อุปกรณ์ 8–10 (gearCost, gearBars) และสูตรหลอม (WORKSHOP, makeCheck)
// node tools/test-workshop.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-workshop-');
const S = require('../public/shared.js');

// ---- 1. BARS: 10 ชนิด ตาม ORE_ORDER ----
{
  const keys = Object.keys(S.BARS);
  assert.strictEqual(keys.length, 10, `BARS มี ${keys.length} คีย์ ต้อง 10`);
  const oreOrder = S.ORE_ORDER;
  assert.deepStrictEqual(keys.sort(), oreOrder.slice().sort(), 'BARS คีย์ต้องตรงกับ ORE_ORDER');
  for (const o of oreOrder) assert.ok(o in S.BARS, `${o} ต้องอยู่ใน BARS`);
}

// ---- 2. BAR_TUNE สูตรคิด: fee, std, shop ----
{
  const { ore: ORE, feePct, shopMul } = S.BAR_TUNE;
  for (const o of S.ORE_ORDER) {
    const bar = S.BARS[o];
    const oSell = S.ORES[o].sell;
    const expectFee = Math.round(feePct * ORE * oSell);
    const expectStd = ORE * oSell + expectFee;
    const expectShop = Math.round(expectStd * shopMul);
    assert.strictEqual(bar.fee, expectFee, `${o}: fee=${bar.fee} ต้อง=${expectFee}`);
    assert.strictEqual(bar.std, expectStd, `${o}: std=${bar.std} ต้อง=${expectStd}`);
    assert.strictEqual(bar.shop, expectShop, `${o}: shop=${bar.shop} ต้อง=${expectShop}`);
  }
}

// ---- 3. ตัวอย่างตารางจากแผน (ตรวจค่า ตามสูตร BAR_TUNE) ----
{
  const samples = [
    { ore: 'stone',   expStd: 17,   expShop: 26 },
    { ore: 'copper',  expStd: 31,   expShop: 47 },
    { ore: 'mythril', expStd: 138,  expShop: 207 },
  ];
  for (const { ore, expStd, expShop } of samples) {
    const bar = S.BARS[ore];
    assert.strictEqual(bar.std, expStd, `bar_${ore} std=${bar.std} ต้อง ${expStd}`);
    assert.strictEqual(bar.shop, expShop, `bar_${ore} shop=${bar.shop} ต้อง ${expShop}`);
  }
}

// ---- 4. itemInfo('bar_mythril'): buy===shop, std, cat==='bar', ore==='mythril', ไม่มี sell ----
{
  const info = S.itemInfo('bar_mythril');
  assert.ok(info, 'itemInfo bar_mythril มี');
  assert.strictEqual(info.buy, S.BARS.mythril.shop, 'buy = shop ราคา');
  assert.strictEqual(info.std, S.BARS.mythril.std, 'std ตรงกับ BARS');
  assert.strictEqual(info.cat, 'bar', 'cat === bar');
  assert.strictEqual(info.ore, 'mythril', 'ore === mythril');
  assert.strictEqual(info.sell, undefined, 'ไม่มี sell');
}

// ---- 5. itemInfo('hay'): std === 44, buy === 24 ----
{
  const info = S.itemInfo('hay');
  assert.ok(info, 'itemInfo hay มี');
  assert.strictEqual(info.std, 44, `hay std=${info.std} ต้อง 44`);
  assert.strictEqual(info.buy, 24, `hay buy=${info.buy} ต้อง 24`);
}

// ---- 6. วัสดุไม่อยู่ SELLABLE ----
{
  for (const o of S.ORE_ORDER) {
    const key = 'bar_' + o;
    assert.ok(!S.SELLABLE.includes(key), `${key} ต้องไม่อยู่ SELLABLE`);
  }
}

// ---- 7. isTradable('bar_stone') === true ----
{
  const tradable = S.isTradable('bar_stone');
  assert.strictEqual(tradable, true, `isTradable('bar_stone') = ${tradable} ต้อง true`);
}

// ---- 8. SHOPS.mine.buy รวมวัสดุ 10 ชนิด ----
{
  const mineBuy = S.SHOPS.mine.buy || [];
  for (const o of S.ORE_ORDER) {
    const key = 'bar_' + o;
    assert.ok(mineBuy.includes(key), `SHOPS.mine.buy ต้องมี ${key}`);
  }
}

// ---- 9. gearCost ไม่มีวัตถุดิบ: pick_8/9/10, can_8 ----
{
  const c8 = S.gearCost('pick_8', {});
  assert.ok(c8, 'gearCost pick_8 กลับค่า');
  assert.strictEqual(c8.coin, 6500, `pick_8 coin=${c8.coin} ต้อง 6500`);
  assert.strictEqual(Object.keys(c8.use).length, 0, 'pick_8 ไม่มีวัตถุดิบใช้');

  const c9 = S.gearCost('pick_9', {});
  assert.strictEqual(c9.coin, 9000, `pick_9 coin=${c9.coin} ต้อง 9000`);

  const c10 = S.gearCost('pick_10', {});
  assert.strictEqual(c10.coin, 12500, `pick_10 coin=${c10.coin} ต้อง 12500`);

  const can8 = S.gearCost('can_8', {});
  assert.strictEqual(can8.coin, 2800, `can_8 coin=${can8.coin} ต้อง 2800`);
}

// ---- 10. gearCost pick_10 กับวัตถุดิบครบ: coin < 12500 (ตรวจกับของจริง) ----
{
  const fullInv = {};
  for (const o of S.ORE_ORDER) {
    fullInv['bar_' + o] = 100; // มีวัสดุมากพอ
  }
  const c10Full = S.gearCost('pick_10', fullInv);
  const c10Empty = S.gearCost('pick_10', {});
  
  assert.strictEqual(c10Empty.coin, 12500, 'pick_10 ไม่มีวัตถุดิบ = 12500');
  assert.ok(c10Full.coin < 12500, `pick_10 กับวัตถุดิบครบ coin=${c10Full.coin} ต้อง < 12500`);
  assert.ok(c10Full.coin > 0, 'pick_10 กับวัตถุดิบ coin > 0');
}

// ---- 11. ส่วนวัสดุ: (needQty * shop) ÷ ราคา ≤ 0.25 (ใช้ Math.floor) ----
{
  const families = ['pick', 'axe', 'rod', 'hoe', 'pail', 'pan', 'can'];
  const tiers = [8, 9, 10];
  
  for (const fam of families) {
    for (const tier of tiers) {
      const item = `${fam}_${tier}`;
      const info = S.itemInfo(item);
      assert.ok(info && info.buy, `${item} ต้องมี itemInfo และ buy`);
      
      const price = info.buy;
      const bars = S.gearBars(item);
      
      if (!bars || bars.length === 0) continue; // ไม่มีวัสดุ ข้ามไป
      
      let totalMaterialCost = 0;
      for (const [ore, qty] of bars) {
        const barInfo = S.itemInfo('bar_' + ore);
        const shopPrice = barInfo ? barInfo.buy : 0;
        totalMaterialCost += Math.floor(qty * shopPrice);
      }
      
      const share = totalMaterialCost / price;
      assert.ok(share <= 0.25, `${item} share=${share.toFixed(4)} ต้อง <= 0.25 (price=${price} matCost=${totalMaterialCost})`);
    }
  }
}

// ---- 12. WORKSHOP.recipes: forge_* 10 + bale_* 2 = 12 รายการ ----
{
  const recs = S.WORKSHOP.recipes;
  assert.ok(recs, 'WORKSHOP.recipes มี');
  
  const forgeKeys = Object.keys(recs).filter(k => k.startsWith('forge_'));
  assert.strictEqual(forgeKeys.length, 10, `forge_* มี ${forgeKeys.length} ต้อง 10`);
  
  const baleKeys = Object.keys(recs).filter(k => k.startsWith('bale_'));
  assert.strictEqual(baleKeys.length, 2, `bale_* มี ${baleKeys.length} ต้อง 2`);
  
  // forge_* ต้องมีคีย์ของแต่ละแร่
  for (const o of S.ORE_ORDER) {
    const key = 'forge_' + o;
    assert.ok(key in recs, `${key} ต้องอยู่ WORKSHOP.recipes`);
  }
  
  // bale_* ต้อง carrot และ corn
  assert.ok('bale_carrot' in recs, 'bale_carrot ต้องมี');
  assert.ok('bale_corn' in recs, 'bale_corn ต้องมี');
}

// ---- 13. makeCheck: ตรวจเงื่อนไขหลอม ----
{
  const r = S.WORKSHOP.recipes.forge_copper;
  assert.ok(r, 'forge_copper มี');
  
  // ไม่มีอะไร: ต้อง error
  const err1 = S.makeCheck(r, {}, 1);
  assert.ok(err1, 'forge_copper ไม่มีวัตถุดิบ ต้อง error');
  
  // มี copper 3 เหรียญพอ ค่าเตา: ต้อง null (ผ่าน)
  const inv = { copper: 3, coin: 10000 };
  const err2 = S.makeCheck(r, inv, 1);
  assert.strictEqual(err2, null, 'forge_copper copper:3 coin พอ ต้อง null (ผ่าน)');
  
  // n = 0: ต้อง error
  const err3 = S.makeCheck(r, inv, 0);
  assert.ok(err3, 'makeCheck n=0 ต้อง error');
  
  // n = 11 (เกิน maxN 10): ต้อง error
  const err4 = S.makeCheck(r, inv, 11);
  assert.ok(err4, 'makeCheck n=11 (> maxN=10) ต้อง error');
  
  // n = 10 มีวัตถุดิบพอ: ต้อง null
  const inv10 = { copper: 30, coin: 100000 };
  const err5 = S.makeCheck(r, inv10, 10);
  assert.strictEqual(err5, null, 'makeCheck copper n=10 มีพอ ต้อง null');
}

// ---- 14. BAR_EMOJI: 10 ตัว ไม่ซ้ำกัน ไม่ซ้ำ PICK/AXE/HOE/PAIL/PAN/ROD/CANS emoji ----
{
  const barEmojis = Object.values(S.BAR_EMOJI);
  assert.strictEqual(barEmojis.length, 10, `BAR_EMOJI มี ${barEmojis.length} ตัว ต้อง 10`);
  
  // ไม่ซ้ำตัวเองภายใน
  const unique = new Set(barEmojis);
  assert.strictEqual(unique.size, 10, `BAR_EMOJI ต้องไม่ซ้ำ มี unique ${unique.size}`);
  
  // ไม่ซ้ำ PICK/AXE/HOE/PAIL/PAN/ROD emoji
  const forbidEmojis = new Set();
  
  // PICK_EMOJI (10 ตัว)
  if (S.PICK_EMOJI) Object.values(S.PICK_EMOJI).forEach(e => forbidEmojis.add(e));
  
  // AXE_EMOJI (10 ตัว)
  if (S.AXE_EMOJI) Object.values(S.AXE_EMOJI).forEach(e => forbidEmojis.add(e));
  
  // HOE_EMOJI (10 ตัว)
  if (S.HOE_EMOJI) Object.values(S.HOE_EMOJI).forEach(e => forbidEmojis.add(e));
  
  // PAIL_EMOJI (10 ตัว)
  if (S.PAIL_EMOJI) Object.values(S.PAIL_EMOJI).forEach(e => forbidEmojis.add(e));
  
  // PAN_EMOJI (10 ตัว)
  if (S.PAN_EMOJI) Object.values(S.PAN_EMOJI).forEach(e => forbidEmojis.add(e));
  
  // ROD_EMOJI (ถ้ามี)
  if (S.ROD_EMOJI) Object.values(S.ROD_EMOJI).forEach(e => forbidEmojis.add(e));
  
  // CANS emoji
  if (S.CANS) Object.values(S.CANS).forEach(c => { if (c && c.emoji) forbidEmojis.add(c.emoji); });
  
  for (const emoji of barEmojis) {
    assert.ok(!forbidEmojis.has(emoji), `BAR_EMOJI '${emoji}' ซ้ำกับ PICK/AXE/HOE/PAIL/PAN/ROD/CANS`);
  }
}

console.log('PASS test-workshop');
process.exit(0);
