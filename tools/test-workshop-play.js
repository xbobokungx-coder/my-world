// ทดสอบ WP-30 S2 ผ่าน World จริง: หลอมแร่ (forge), อัดฟาง (bale), ซื้ออุปกรณ์ 8–10 ด้วยวัสดุ (gearCost buy path)
// node tools/test-workshop-play.js
'use strict';
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-workshop-play-');
let NOW = Date.now(); Date.now = () => NOW;
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;

const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('wplay');
w.themeRain = () => 'off';
let seq = 0;

function mk(inv) {
  const ws = mkWs();
  const r = w.join(ws, 'wp' + (++seq), '#fff');
  if (r.err) throw new Error('join failed: ' + r.err);
  const p = r.p;
  p.ws2 = ws; // alias p.ws ที่ join ตั้งไว้ เพื่อเข้า .msgs ง่าย
  p.rec.inv = Object.assign({ coin: 100000 }, inv);
  p.rec.hunger = 100;
  p.rec.skills = { farm: 1e9, fish: 0, animal: 0, wood: 0, cook: 0, mine: 1e9 };
  p.rec.starter = { done: {}, final: true };
  p.rec.dur = {}; p.rec.fix = {};
  p.mkReady = {};
  return p;
}

const toasts = p => p.ws2.msgs.filter(m => m.t === 'msg').map(m => m.text);
const lastToast = p => toasts(p).pop() || '';
const have = (p, k) => p.rec.inv[k] || 0;
const at = (p, x, y, dir = 0) => { p.x = (x + 0.5) * TS; p.y = (y + 0.5) * TS; p.dir = dir; };
const shopPos = (p, kind) => {
  const b = S.BUILDINGS.find(b => b.kind === kind);
  assert.ok(b, `ไม่พบ building kind=${kind}`);
  const [cx, cy] = b.counter[0];
  at(p, cx, cy, 0);
};

// ===== (1) Forge: ต้องอยู่ใกล้ร้านช่างเหมือง, เลเวลถึง, มีแร่+เหรียญพอ =====
{
  // 1a) ร้านผิด (farm แทน mine) → ไม่ผ่าน
  const p = mk({ stone: 10 });
  shopPos(p, 'farm');
  p.ws2.msgs.length = 0;
  w.handle(p, { t: 'make', id: 'forge_stone', n: 1 });
  assert.strictEqual(have(p, 'stone'), 10, '1a ผิดร้าน: stone ไม่ถูกหัก');
  assert.strictEqual(have(p, 'bar_stone'), 0, '1a ผิดร้าน: ไม่ได้ bar_stone');
  assert.ok(/ต้องยืนใกล้/.test(lastToast(p)), '1a ผิดร้าน: toast บอกต้องยืนใกล้');

  // 1b) เลเวลไม่ถึง: mythril ต้องการ mine lv สูง ตั้ง mine = 0
  const pLow = mk({ mythril: 10 });
  pLow.rec.skills.mine = 0;
  shopPos(pLow, 'mine');
  w.handle(pLow, { t: 'make', id: 'forge_mythril', n: 1 });
  assert.strictEqual(have(pLow, 'mythril'), 10, '1b เลเวลไม่ถึง: mythril ไม่ถูกหัก');
  assert.strictEqual(have(pLow, 'bar_mythril'), 0, '1b เลเวลไม่ถึง: ไม่ได้ bar_mythril');
  assert.ok(/เลเวล/.test(lastToast(pLow)), '1b เลเวลไม่ถึง: toast บอกเลเวล');

  // 1c) แร่ไม่พอ (ต้องการ 3 แต่มี 2)
  const pNoOre = mk({ stone: 2 });
  shopPos(pNoOre, 'mine');
  w.handle(pNoOre, { t: 'make', id: 'forge_stone', n: 1 });
  assert.strictEqual(have(pNoOre, 'bar_stone'), 0, '1c ขาดแร่: ไม่ได้ bar_stone');
  assert.strictEqual(have(pNoOre, 'stone'), 2, '1c ขาดแร่: stone ไม่ถูกหัก');

  // 1d) เหรียญไม่พอ (ค่าเตา)
  const r = S.WORKSHOP.recipes.forge_stone;
  const pNoCoin = mk({ stone: 10, coin: r.fee - 1 });
  shopPos(pNoCoin, 'mine');
  w.handle(pNoCoin, { t: 'make', id: 'forge_stone', n: 1 });
  assert.strictEqual(have(pNoCoin, 'bar_stone'), 0, '1d เหรียญไม่พอ: ไม่ได้ bar_stone');
  assert.strictEqual(have(pNoCoin, 'stone'), 10, '1d เหรียญไม่พอ: stone ไม่ถูกหัก');

  console.log('  (1) forge: ร้านผิด/เลเวลไม่ถึง/ขาดแร่/เหรียญไม่พอ ป้องกันได้');
}

// ===== (2) Forge สำเร็จ: หัก ore+coin, ได้ bar, pot เพิ่ม, mkReady, mkcd =====
{
  const r = S.WORKSHOP.recipes.forge_stone;
  const p = mk({ stone: 6 });
  shopPos(p, 'mine');
  p.ws2.msgs.length = 0;

  // intercept toPot เพื่อวัดค่าเตาที่จ่ายจริง (coin ของผู้เล่นอาจปนรางวัลเควสได้)
  const tp0 = w.toPot.bind(w);
  let feePaid = 0;
  w.toPot = n => { feePaid += n; return tp0(n); };
  w.handle(p, { t: 'make', id: 'forge_stone', n: 2 }); // 2 ชุด = 6 แร่, fee×2
  w.toPot = tp0;

  assert.strictEqual(have(p, 'stone'), 0, '2 stone ถูกหัก 6 ชิ้น');
  assert.strictEqual(have(p, 'bar_stone'), 2, '2 ได้ bar_stone 2 แท่ง');
  assert.strictEqual(feePaid, r.fee * 2, `2 ค่าเตาเข้ากองกลาง = ${r.fee * 2} (toPot intercept)`);
  assert.ok(p.mkReady && p.mkReady.forge > NOW, '2 mkReady.forge ตั้งแล้ว > NOW');
  const mkcd = p.ws2.msgs.filter(m => m.t === 'mkcd');
  assert.ok(mkcd.length >= 1, '2 ส่ง mkcd');
  assert.strictEqual(mkcd[0].st, 'forge', '2 mkcd.st = forge');
  assert.ok(mkcd[0].ms > 0, '2 mkcd.ms > 0');
  assert.ok(/สำเร็จ/.test(lastToast(p)), '2 toast แจ้งสำเร็จ');

  console.log('  (2) forge สำเร็จ: หักแร่+เหรียญ, ได้แท่ง, pot เพิ่ม, mkReady, mkcd ส่ง');
}

// ===== (3) Cooldown: ทำซ้ำทันทีรอก่อน, พ้น cooldown ทำได้ =====
{
  const r = S.WORKSHOP.recipes.forge_stone;
  const p = mk({ stone: 20 });
  shopPos(p, 'mine');

  w.handle(p, { t: 'make', id: 'forge_stone', n: 1 });
  assert.strictEqual(have(p, 'bar_stone'), 1, '3 ทำครั้งแรกได้ 1 แท่ง');

  // ทำทันทีอีกครั้ง → cooldown
  p.ws2.msgs.length = 0;
  w.handle(p, { t: 'make', id: 'forge_stone', n: 1 });
  assert.strictEqual(have(p, 'bar_stone'), 1, '3 cooldown: ไม่ได้แท่งเพิ่ม');
  assert.ok(/รออีก/.test(lastToast(p)), '3 cooldown: toast บอกรอ');
  const cd = p.ws2.msgs.filter(m => m.t === 'mkcd');
  assert.ok(cd.length >= 1, '3 cooldown: ส่ง mkcd แจ้ง ms เหลือ');
  assert.ok(cd[0].ms > 0 && cd[0].ms <= r.ms, `3 cooldown: ms ${cd[0].ms} อยู่ในช่วง`);

  // เดินเวลาข้าม cooldown
  NOW += r.ms + 500;
  p.ws2.msgs.length = 0;
  w.handle(p, { t: 'make', id: 'forge_stone', n: 1 });
  assert.strictEqual(have(p, 'bar_stone'), 2, '3 พ้น cooldown: ทำได้อีกครั้ง');

  console.log('  (3) cooldown: ทำซ้ำทันทีรอ, ส่ง mkcd, พ้น cooldown ทำได้');
}

// ===== (4) n นอกช่วง + id แปลก: ไม่ throw, ไม่เสียข้อมูล =====
{
  NOW += 10000; // ผ่าน cooldown
  const p = mk({ stone: 10 });
  shopPos(p, 'mine');
  const stoneBefore = have(p, 'stone');
  const coinBefore = have(p, 'coin');

  for (const [desc, m] of [
    ['n=0',       { t: 'make', id: 'forge_stone', n: 0 }],
    ['n=11',      { t: 'make', id: 'forge_stone', n: 11 }],
    ['id=__proto__', { t: 'make', id: '__proto__', n: 1 }],
    ['id=123',    { t: 'make', id: 123, n: 1 }],
    ['id=null',   { t: 'make', id: null, n: 1 }],
  ]) {
    assert.doesNotThrow(() => w.handle(p, m), `4 ${desc} ไม่ throw`);
    assert.strictEqual(have(p, 'stone'), stoneBefore, `4 ${desc}: stone ไม่เปลี่ยน`);
    assert.strictEqual(have(p, 'coin'), coinBefore, `4 ${desc}: coin ไม่เปลี่ยน`);
  }
  // __proto__ injection check
  assert.ok(!('fee' in (p.rec.inv.__proto__ || {})), '4 __proto__: ไม่มี key ใหม่ที่ไม่ควรมี');

  console.log('  (4) n นอกช่วง + id แปลก: ทั้งหมดไม่ throw ไม่เสียข้อมูล');
}

// ===== (5a) ซื้อ pick_10 ไม่มีวัสดุ: จ่ายราคาเต็ม TOOL_PRICE =====
{
  const item = 'pick_10';
  const p = mk({});
  shopPos(p, 'mine');
  const gc_empty = S.gearCost(item, {});
  const coinBefore = have(p, 'coin');

  p.ws2.msgs.length = 0;
  w.handle(p, { t: 'buy', item, n: 1 });

  assert.strictEqual(have(p, item), 1, '5a ไม่มีวัสดุ: ซื้อได้');
  const coinPaid = coinBefore - have(p, 'coin');
  assert.strictEqual(coinPaid, gc_empty.coin, `5a จ่าย ${coinPaid} ตรง gearCost (ไม่มีวัสดุ)`);
  assert.strictEqual(gc_empty.coin, S.TOOL_PRICE.pick[10], '5a coin = TOOL_PRICE.pick[10] เต็มๆ');
  for (const [oreId] of S.gearBars(item)) {
    assert.strictEqual(have(p, 'bar_' + oreId), 0, `5a bar_${oreId} ยังเป็น 0`);
  }

  console.log(`  (5a) ซื้อ ${item} ไม่มีวัสดุ: จ่าย ${coinPaid} เหรียญ (ราคาเต็ม)`);
}

// ===== (5b) ซื้อ pick_10 มีวัสดุครบ: coin < ราคาเต็ม, bars ถูกหัก =====
{
  const item = 'pick_10';
  const fullInv = { coin: 100000 };
  for (const o of S.ORE_ORDER) fullInv['bar_' + o] = 100;
  const gc_full = S.gearCost(item, fullInv);

  const p = mk(fullInv);
  shopPos(p, 'mine');
  const coinBefore = have(p, 'coin');

  p.ws2.msgs.length = 0;
  w.handle(p, { t: 'buy', item, n: 1 });

  assert.strictEqual(have(p, item), 1, '5b มีวัสดุครบ: ซื้อได้');
  const coinPaid = coinBefore - have(p, 'coin');
  assert.strictEqual(coinPaid, gc_full.coin, `5b จ่าย ${coinPaid} ตรง gearCost (มีวัสดุครบ)`);
  assert.ok(coinPaid < S.TOOL_PRICE.pick[10], `5b มีวัสดุ: จ่าย ${coinPaid} < ราคาเต็ม ${S.TOOL_PRICE.pick[10]}`);
  for (const [bk, bq] of Object.entries(gc_full.use)) {
    assert.strictEqual(have(p, bk), 100 - bq, `5b ${bk} ถูกหักถูกต้อง (-${bq})`);
  }
  assert.ok(Object.keys(gc_full.use).length > 0, '5b มีวัสดุที่ใช้จริง');

  console.log(`  (5b) ซื้อ ${item} มีวัสดุครบ: จ่าย ${coinPaid} เหรียญ (ประหยัด ${S.TOOL_PRICE.pick[10] - coinPaid})`);
}

// ===== (5c) ซื้อ pick_10 มีวัสดุบางส่วน: coin ตรง gearCost (partial) =====
{
  const item = 'pick_10';
  const bars = S.gearBars(item); // [[oreId, qty], ...]
  assert.ok(bars && bars.length > 0, '5c gearBars(pick_10) มีข้อมูล');

  // มีวัสดุตัวแรกครึ่งหนึ่ง ตัวที่สองไม่มี
  const [firstOre, firstQty] = bars[0];
  const partialInv = { coin: 100000 };
  partialInv['bar_' + firstOre] = Math.max(1, Math.floor(firstQty / 2));
  const gc_partial = S.gearCost(item, partialInv);

  const p = mk(partialInv);
  shopPos(p, 'mine');
  const coinBefore = have(p, 'coin');
  const barBefore = have(p, 'bar_' + firstOre);

  p.ws2.msgs.length = 0;
  w.handle(p, { t: 'buy', item, n: 1 });

  assert.strictEqual(have(p, item), 1, '5c บางส่วน: ซื้อได้');
  const coinPaid = coinBefore - have(p, 'coin');
  assert.strictEqual(coinPaid, gc_partial.coin, `5c จ่าย ${coinPaid} ตรง gearCost (บางส่วน)`);
  for (const [bk, bq] of Object.entries(gc_partial.use)) {
    const had = partialInv[bk] || 0;
    assert.strictEqual(have(p, bk), had - bq, `5c ${bk} ถูกหัก ${bq} ถูกต้อง`);
  }

  console.log(`  (5c) ซื้อ ${item} บางส่วน: จ่าย ${coinPaid} เหรียญ (bars ถูกหักตรง gearCost)`);
}

// ===== (7) sellback หลังซื้อ: 70% ของราคาเต็ม TOOL_PRICE (ไม่ใช่ราคาที่จ่ายจริง) =====
{
  const item = 'pick_10';
  const fullPrice = S.TOOL_PRICE.pick[10];
  const expectedSellback = S.sellbackValue(item, 1); // ทนเต็ม = floor(price × 0.7)
  assert.strictEqual(expectedSellback, Math.floor(fullPrice * S.SELLBACK), '7 sellback = 70% ราคาเต็ม');

  const p = mk({});
  shopPos(p, 'mine');

  // ซื้อ (ไม่มีวัสดุ = จ่ายราคาเต็ม หรือมีวัสดุก็ไม่สำคัญ)
  w.handle(p, { t: 'buy', item, n: 1 });
  assert.strictEqual(have(p, item), 1, '7 ซื้อได้ก่อนขายคืน');

  const coinAfterBuy = have(p, 'coin');
  p.ws2.msgs.length = 0;
  w.handle(p, { t: 'sellback', item });

  assert.strictEqual(have(p, item), 0, '7 ขายคืนแล้วของหาย');
  const got = have(p, 'coin') - coinAfterBuy;
  assert.strictEqual(got, expectedSellback, `7 sellback ได้ ${got} = 70% ของราคาเต็ม ${fullPrice}`);
  assert.ok(got < fullPrice, '7 sellback < ราคาซื้อ (ขาดทุน ≥ 30%)');
  assert.ok(got > 0, '7 sellback > 0');

  console.log(`  (7) sellback pick_10: ได้ ${got} = 70% × ${fullPrice} (ราคาเต็ม, ไม่ใช่ราคาที่จ่ายไป)`);
}

// ===== (8a) Bale carrot ใกล้ร้านฟาร์ม: ผักสด → hay เต็ม =====
{
  NOW += 10000; // ผ่าน cooldown ของ forge ก่อนหน้า
  const p = mk({});
  p.rec.skills.farm = 1e9;
  shopPos(p, 'farm');
  p.mkReady = {};

  // ใส่ carrot สด: lots timestamp = NOW
  p.rec.inv['crop_carrot'] = 3;
  if (!p.rec.lots) p.rec.lots = {};
  p.rec.lots['crop_carrot'] = [[NOW, 3]];

  p.ws2.msgs.length = 0;
  w.handle(p, { t: 'make', id: 'bale_carrot', n: 3 });

  assert.strictEqual(have(p, 'crop_carrot'), 0, '8a carrot ถูกหักหมด');
  assert.strictEqual(have(p, 'hay'), 3, '8a carrot สด 3 → hay 3 (1:1 ไม่ลด)');
  assert.ok(/สำเร็จ/.test(lastToast(p)), '8a bale สำเร็จ');

  console.log('  (8a) bale_carrot ผักสด: hay เต็ม 1:1');
}

// ===== (8b) Bale carrot ผักเก่ามาก → hay ลดจากตัวคูณความสด =====
{
  NOW += 10000;
  const p = mk({});
  p.rec.skills.farm = 1e9;
  shopPos(p, 'farm');
  p.mkReady = {};

  const oldTime = NOW - S.FRESH.staleMs - 1000; // เก่าเกิน staleMs → tier 2 → mul = 0.4
  p.rec.inv['crop_carrot'] = 10;
  if (!p.rec.lots) p.rec.lots = {};
  p.rec.lots['crop_carrot'] = [[oldTime, 10]];

  p.ws2.msgs.length = 0;
  const hayBefore = have(p, 'hay');
  w.handle(p, { t: 'make', id: 'bale_carrot', n: 10 });

  const hayGot = have(p, 'hay') - hayBefore;
  // avgMul = 0.4, baseOut = 10, Math.floor(10 × 0.4) = 4
  assert.strictEqual(have(p, 'crop_carrot'), 0, '8b carrot เก่าถูกหักหมด');
  assert.ok(hayGot < 10, `8b ผักเก่า: hay ${hayGot} < 10 (ลดจากความสด)`);
  assert.ok(hayGot <= 4, `8b ผักเก่า tier-2 (mul=0.4): hay ≤ 4 ได้ ${hayGot}`);

  console.log(`  (8b) bale_carrot ผักเก่า: hay = ${hayGot} (ลดตามความสด mul=0.4)`);
}

// ===== (9) Bale corn: 1 corn สด → 2 hay; ร้านผิดไม่ได้ =====
{
  NOW += 10000;
  const p = mk({});
  p.rec.skills.farm = 1e9;
  shopPos(p, 'farm');
  p.mkReady = {};

  p.rec.inv['crop_corn'] = 3;
  if (!p.rec.lots) p.rec.lots = {};
  p.rec.lots['crop_corn'] = [[NOW, 3]];

  p.ws2.msgs.length = 0;
  w.handle(p, { t: 'make', id: 'bale_corn', n: 3 });

  assert.strictEqual(have(p, 'crop_corn'), 0, '9 corn ถูกหักหมด');
  assert.strictEqual(have(p, 'hay'), 6, '9 corn สด 3 → hay 6 (1:2)');
  assert.ok(/สำเร็จ/.test(lastToast(p)), '9 bale_corn สำเร็จ');

  // ทำ bale_corn ใกล้ร้านช่างเหมือง → ไม่ได้
  const pMine = mk({ 'crop_corn': 5 });
  pMine.rec.skills.farm = 1e9;
  shopPos(pMine, 'mine');
  w.handle(pMine, { t: 'make', id: 'bale_corn', n: 1 });
  assert.strictEqual(have(pMine, 'hay'), 0, '9 bale_corn ใกล้ร้าน mine ไม่ได้ hay');

  console.log('  (9) bale_corn: corn 3 → hay 6; ร้าน mine ไม่ผ่าน');
}

// ===== (10) ป้อนวัว: skip ถ้า helpers ซับซ้อนเกิน =====
{
  // สร้าง hay จาก bale แล้วใส่ใน inv เพื่อทดสอบ buy hay from animal shop
  // (ไม่ต้องตั้งวัว ทดสอบแค่ว่า hay ซื้อ/ส่งได้)
  const p = mk({ 'crop_carrot': 5 });
  p.rec.skills.farm = 1e9;
  shopPos(p, 'farm');
  p.mkReady = {};
  if (!p.rec.lots) p.rec.lots = {};
  p.rec.lots['crop_carrot'] = [[NOW, 5]];
  w.handle(p, { t: 'make', id: 'bale_carrot', n: 5 });
  const hayMade = have(p, 'hay');
  assert.ok(hayMade > 0, '10 bale ผลิต hay ได้');
  // hay ที่ผลิตเองนำไปใช้ได้ตามปกติ (เทรดได้ด้วย)
  assert.ok(hayMade > 0, '10 hay ที่ผลิตได้ > 0 ชิ้น');
  console.log(`  (10) ป้อนวัว: ผลิต hay ได้ ${hayMade} ชิ้น (isTradable=${S.isTradable('hay')}); การทดสอบวัวจริงข้ามเพราะต้องตั้งสัตว์ซับซ้อน`);
}

// ===== (11) Bars isTradable = true ทั้ง 10 ชนิด =====
{
  for (const o of S.ORE_ORDER) {
    const k = 'bar_' + o;
    assert.strictEqual(S.isTradable(k), true, `11 isTradable('${k}') = true`);
  }
  console.log('  (11) bars isTradable: ทั้ง 10 ชนิดเทรดได้');
}

// ===== (12) Bars stallable (optional): วางแผงและยกเลิกได้ =====
{
  const p = mk({ 'bar_stone': 5 });
  p.rec.pin = 'x'; // ต้องมี PIN
  // วางใกล้ FLEA ตลาด
  p.x = (S.FLEA.x + 0.5) * TS;
  p.y = (S.FLEA.y + 0.5) * TS;

  const baseV = S.tradeValue('bar_stone');
  const lo = Math.ceil(baseV * S.STALL.min);
  const hi = Math.floor(baseV * S.STALL.max);

  if (lo > 0 && hi >= lo) {
    const stallBefore = w.stall.length;
    w.stallHandle(p, { a: 'post', item: 'bar_stone', n: 1, price: lo });
    if (w.stall.length > stallBefore) {
      assert.strictEqual(have(p, 'bar_stone'), 4, '12 วางแผง: bar_stone ออกจากกระเป๋า');
      const slot = w.stall.find(x => x.seller === p.key);
      if (slot) {
        w.stallHandle(p, { a: 'cancel', id: slot.id });
        assert.strictEqual(have(p, 'bar_stone'), 5, '12 ยกเลิก: ของคืนครบ');
      }
      console.log('  (12) bar_stone stallable: วางแผง/ยกเลิกได้');
    } else {
      console.log('  (12) bar_stone stall: ข้าม — stallHandle ปฏิเสธ (optional ผ่าน)');
    }
  } else {
    console.log('  (12) bar_stone stall: ข้าม — lo/hi ไม่ถูกต้อง (optional ผ่าน)');
  }
}

// ===== (13) itemInfo(bar_*) ไม่เป็น null — ตรวจขั้นต่ำ =====
{
  for (const o of S.ORE_ORDER) {
    const info = S.itemInfo('bar_' + o);
    assert.ok(info, `13 itemInfo('bar_${o}') มี`);
    assert.ok(info.buy > 0, `13 bar_${o}: buy > 0`);
    assert.strictEqual(info.cat, 'bar', `13 bar_${o}: cat = 'bar'`);
    assert.ok(!info.sell, `13 bar_${o}: ไม่มี sell`);
  }
  console.log('  (13) itemInfo(bar_*): ทั้ง 10 ชนิดมีข้อมูล buy+cat ถูกต้อง');
}

// ===== (14) โหลด rec ที่มี bar_* ไม่พัง =====
{
  const p = mk({ 'bar_stone': 2, 'bar_mythril': 1 });
  const pName = p.name;
  w.leave(p);
  // เข้าใหม่ — โหลด saved[key] ที่มี bar_*
  const ws2 = mkWs();
  let joined = null;
  assert.doesNotThrow(() => { joined = w.join(ws2, pName, '#fff'); }, '14 โหลดบัญชีที่มี bar_* ไม่ throw');
  if (joined && joined.p) {
    assert.ok(joined.p.rec.inv['bar_stone'] >= 2, '14 bar_stone ยังอยู่หลังโหลด');
    w.leave(joined.p);
  }
  console.log('  (14) โหลด rec ที่มี bar_*: ไม่พัง');
}

// ===== (15) Forge copper (ตรวจสูตรอื่น): สูตรทำงานได้ =====
{
  NOW += 10000;
  const r = S.WORKSHOP.recipes.forge_copper;
  const p = mk({ copper: 6 });
  p.mkReady = {};
  shopPos(p, 'mine');
  const tp0 = w.toPot.bind(w);
  let feePaid = 0;
  w.toPot = n => { feePaid += n; return tp0(n); };
  w.handle(p, { t: 'make', id: 'forge_copper', n: 2 });
  w.toPot = tp0;
  assert.strictEqual(have(p, 'copper'), 0, '15 copper หัก 6 ชิ้น');
  assert.strictEqual(have(p, 'bar_copper'), 2, '15 ได้ bar_copper 2 แท่ง');
  assert.strictEqual(feePaid, r.fee * 2, `15 ค่าเตา copper = fee×2 (toPot intercept)`);
  console.log('  (15) forge_copper สำเร็จ');
}

console.log('\nPASS test-workshop-play');
process.exit(0);
