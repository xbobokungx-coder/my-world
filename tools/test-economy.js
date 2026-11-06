// ทดสอบเศรษฐกิจ: ซื้อ/ขาย/ราคาตกจากการขาย/ตลาดฟื้น/ภาษีขายเข้า toPot (characterization): node tools/test-economy.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-economy-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;

const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('economy');
function mk(name, coin = 1000) {
  const ws = mkWs(), p = w.join(ws, name, '#fff').p; p.ws2 = ws;
  p.rec.inv = { coin }; p.rec.hunger = 100; p.rec.skills = { farm: 0, fish: 0, animal: 0, wood: 0, cook: 0, mine: 0 };
  p.rec.ach = { cnt: {}, got: Object.fromEntries(S.ACH.map(d => [d.id, 1])) }; // กันเหรียญโบนัสความสำเร็จปนกับยอดซื้อขาย
  p.rec.starter = { done: {}, final: true }; // คู่มือเริ่มต้นจบแล้ว (ไม่งั้นมีเหรียญโบนัสขั้นตอน)
  const q = w.questsOf(p); for (const it of q.list) it.done = true; q.bonus = true; // เควสประจำวันถือว่าเสร็จหมด (ไม่งั้นได้เหรียญเควสปนกับยอดที่วัด)
  return p;
}
const shop = (p, kind) => { const [cx, cy] = S.BUILDINGS.find(b => b.kind === kind).counter[0]; p.x = (cx + 0.5) * TS; p.y = (cy + 0.5) * TS; };
const coin = p => p.rec.inv.coin || 0, have = (p, k) => p.rec.inv[k] || 0;
const buy = (p, item, n) => w.handle(p, { t: 'buy', item, n }), sell = (p, item, n) => w.handle(p, { t: 'sell', item, n });
const lastToast = p => { const m = p.ws2.msgs.filter(x => x.t === 'msg').pop(); return m ? m.text : ''; };

// ---- ซื้อ ----
{
  const p = mk('Buyer'); shop(p, 'farm');
  buy(p, 'seed_carrot', 3); assert.strictEqual(coin(p), 1000 - 3 * S.itemInfo('seed_carrot').buy); assert.strictEqual(have(p, 'seed_carrot'), 3);
  buy(p, 'seed_carrot', 99); assert.strictEqual(have(p, 'seed_carrot'), 13, 'ซื้อครั้งละไม่เกิน 10');
  buy(p, 'seed_carrot', 0); assert.strictEqual(have(p, 'seed_carrot'), 14, 'จำนวนน้อยกว่า 1 ปัดเป็น 1');
  const c0 = coin(p); buy(p, 'seed_cabbage', 1); assert.strictEqual(have(p, 'seed_cabbage'), 0, 'เลเวลไม่ถึงซื้อไม่ได้'); assert.strictEqual(coin(p), c0); assert.ok(/เลเวล 2/.test(lastToast(p)));
  p.rec.skills.farm = 5000; buy(p, 'seed_cabbage', 1); assert.strictEqual(have(p, 'seed_cabbage'), 1, 'เลเวลถึงแล้วซื้อได้'); assert.strictEqual(coin(p), c0 - S.itemInfo('seed_cabbage').buy);
  const c1 = coin(p); buy(p, 'bait', 1); assert.strictEqual(coin(p), c1, 'ร้านเมล็ดไม่ขายเหยื่อ'); assert.strictEqual(have(p, 'bait'), 0);
  p.rec.inv.coin = 5; buy(p, 'seed_carrot', 1); assert.strictEqual(coin(p), 5, 'เหรียญไม่พอไม่หักเงิน'); assert.strictEqual(have(p, 'seed_carrot'), 14); assert.strictEqual(lastToast(p), 'เหรียญไม่พอ');
  p.rec.inv.coin = 1000; p.x = 0; p.y = 0; buy(p, 'seed_carrot', 1); assert.strictEqual(coin(p), 1000, 'ต้องยืนที่เคาน์เตอร์ร้าน'); assert.strictEqual(have(p, 'seed_carrot'), 14);
  // ของชิ้นเดียว (once) + ขายคืน 70%
  shop(p, 'mine'); buy(p, 'lamp', 1); assert.strictEqual(have(p, 'lamp'), 1); assert.strictEqual(coin(p), 880);
  buy(p, 'lamp', 1); assert.strictEqual(have(p, 'lamp'), 1, 'ของชิ้นเดียวซื้อซ้ำไม่ได้'); assert.strictEqual(coin(p), 880); assert.strictEqual(lastToast(p), 'คุณมีของชิ้นนี้อยู่แล้ว');
  w.handle(p, { t: 'sellback', item: 'lamp' }); assert.strictEqual(have(p, 'lamp'), 0); assert.strictEqual(coin(p), 880 + Math.floor(120 * S.SELLBACK), 'ขายคืนได้ 70% ของราคาซื้อ');
  console.log('  ซื้อ: หัก/จำกัด 10/เลเวล/ไม่พอ/ไกลร้าน/ชิ้นเดียว/ขายคืน 70%');
}

// ---- ขาย: ราคาตกตามปริมาณที่ขาย, ตลาดกลาง/ส่วนตัว/หมวดลดลง, ภาษีเข้า toPot ----
{
  const p = mk('Seller'); shop(p, 'farm'); p.rec.inv.crop_carrot = 700; p.rec.inv.seed_carrot = 4;
  const base = S.itemInfo('crop_carrot').sell, pot0 = w.lotto.pot;
  assert.strictEqual(w.market.crop_carrot.m, 1); assert.strictEqual(w.effMult(p, 'crop_carrot'), 1);
  sell(p, 'seed_carrot', 'all'); assert.strictEqual(have(p, 'seed_carrot'), 4, 'ร้านเมล็ดรับซื้อเฉพาะผลผลิต crop_');
  const c00 = coin(p); sell(p, 'crop_carrot', 1); const first = coin(p) - c00; assert.strictEqual(first, base, 'ชิ้นแรกที่ราคาตลาดปกติ = ราคาฐาน'); assert.strictEqual(have(p, 'crop_carrot'), 699);
  const m1 = w.market.crop_carrot.m; assert.ok(m1 < 1, 'ขายแล้วราคาตลาดกลางตก'); assert.ok(p.rec.mk.crop_carrot < 1, 'ตลาดส่วนตัวตก'); assert.ok(p.rec.cat.crop < 1, 'ความอิ่มตัวหมวดตก');
  const c1 = coin(p); sell(p, 'crop_carrot', 10); const got10 = coin(p) - c1;
  assert.ok(got10 < 10 * base && got10 > 0, 'ขายหลายชิ้นต่อเนื่อง ราคาต่อชิ้นค่อยๆ ลด'); assert.strictEqual(have(p, 'crop_carrot'), 689);
  assert.ok(w.market.crop_carrot.m < m1, 'ขายเพิ่มราคาตลาดตกต่อ');
  const mid = coin(p); sell(p, 'crop_carrot', 1); assert.ok(coin(p) - mid < base, 'ราคาที่ถูกกดไว้ยังไม่ฟื้น ชิ้นถัดไปได้น้อยกว่าฐาน');
  assert.strictEqual(w.lotto.pot, pot0, 'ยอดขายต่ำกว่า 1,000 ไม่เสียภาษี กองกลางไม่ขยับ');
  // ไม่ใช่ตัวเลข/ติดลบ = ขายทั้งหมด (พฤติกรรมปัจจุบัน)
  const left = have(p, 'crop_carrot'); sell(p, 'crop_carrot', -5); assert.strictEqual(have(p, 'crop_carrot'), 0, 'n ไม่ใช่จำนวนบวก = ขายหมด'); assert.ok(left > 600);
  // ภาษี: ยอดขายสะสมเกิน 1,000 → เสียภาษี หักจากผู้ขายและเข้า toPot เท่ากันพอดี
  p.rec.inv.crop_carrot = 700; p.rec.sales = []; p.rec.mk = {}; p.rec.cat = {}; w.market.crop_carrot.m = 1;
  const cb = coin(p), potB = w.lotto.pot; sell(p, 'crop_carrot', 'all');
  const net = coin(p) - cb, tax = w.lotto.pot - potB, pay = net + tax;
  assert.ok(tax > 0, 'ขายยอดสูงต้องเสียภาษี'); assert.strictEqual(tax, S.saleTax(0, pay), 'ภาษี = S.saleTax จากยอดสะสมศูนย์'); assert.ok(pay > 1000);
  assert.strictEqual(p.rec.sales.length, 1); assert.strictEqual(p.rec.sales[0][1], pay, 'บันทึกยอดขายสะสมไว้คิดภาษีรอบหน้า');
  const cb2 = coin(p), potB2 = w.lotto.pot; p.rec.inv.crop_carrot = 100; w.market.crop_carrot.m = 1; p.rec.mk = {}; p.rec.cat = {}; sell(p, 'crop_carrot', 100);
  assert.ok(w.lotto.pot - potB2 > 0, 'ยอดสะสมสูงอยู่ ขายรอบต่อมายังเสียภาษี');
  assert.ok(coin(p) > cb2);
  // toPot โดยตรง: ปัดลง ไม่รับค่าไม่เป็นบวก
  const pp = w.lotto.pot; w.toPot(5.9); assert.strictEqual(w.lotto.pot, pp + 5); w.toPot(0); w.toPot(-10); w.toPot(0.5); assert.strictEqual(w.lotto.pot, pp + 5, 'toPot ไม่รับค่า <= 0');
  console.log('  ขาย: ราคาตกต่อชิ้น/ตลาดกลาง+ส่วนตัว+หมวดตก/ภาษีเข้า toPot ตรงกับที่หัก');
}

// ---- ตลาดฟื้นตัวตามเวลา (marketTick) ----
{
  const p = mk('Recover'); shop(p, 'farm'); p.rec.inv.crop_carrot = 40; sell(p, 'crop_carrot', 'all');
  const g = w.market.crop_carrot, m0 = g.m, mk0 = p.rec.mk.crop_carrot, ct0 = p.rec.cat.crop; assert.ok(m0 < 1 && g.t === 1);
  const now = Date.now(); w.mktDay = Math.floor(now / S.DAY_MS); // ไม่ข้ามวัน (ไม่สุ่มเป้าหมายใหม่ ผลคงที่)
  w.marketTick(now);
  assert.ok(Math.abs(g.m - (m0 + (1 - m0) * S.MARKET.recover)) < 1e-9, 'ตลาดกลางขยับเข้าหาเป้าตาม MARKET.recover');
  assert.ok(Math.abs(p.rec.mk.crop_carrot - (mk0 + (1 - mk0) * S.PMARKET.recover)) < 1e-9, 'ตลาดส่วนตัวฟื้นตาม PMARKET.recover');
  assert.ok(Math.abs(p.rec.cat.crop - (ct0 + (1 - ct0) * S.CATFAT.recover)) < 1e-9, 'ความอิ่มตัวหมวดฟื้นตาม CATFAT.recover');
  for (let i = 0; i < 400; i++) w.marketTick(now);
  assert.ok(g.m > 0.999 && !(p.rec.mk && p.rec.mk.crop_carrot) && !(p.rec.cat && p.rec.cat.crop), 'รอนานพอ ราคากลับ 100% และเลิกจำค่าส่วนตัว/หมวด');
  // โลกจำศีล: ไม่มีคนออนไลน์ ตลาดไม่เดิน
  g.m = 0.5; const q = [...w.players.values()]; for (const x of q) w.players.delete(x.id); w.marketTick(now); assert.strictEqual(g.m, 0.5, 'ไม่มีผู้เล่นออนไลน์ ตลาดไม่ฟื้น');
  console.log('  ตลาดฟื้น: กลาง/ส่วนตัว/หมวด + จำศีลตอนไม่มีคน');
}

console.log('economy ok');
process.exit(0);
