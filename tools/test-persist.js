// ทดสอบว่าข้อมูลเมืองที่ save แล้วถูกโหลดกลับมาครบหลังรีสตาร์ต: node tools/test-persist.js
// (บั๊กเดิม: โครงการพัฒนาเมืองถูกบันทึกแต่ไม่ถูกโหลด → ยอดลงขันรีเซ็ตเป็น 0 ทุกครั้งที่รีสตาร์ตเซิร์ฟเวอร์)
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-persist-');
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('main');
const p = { name: 'tester', key: 'tester', x: 0, y: 0, ws: { readyState: 0, send() {} }, rec: { inv: { coin: 20000 }, skills: { farm: 0, fish: 0, animal: 0, wood: 0, cook: 0 }, pts: 0, arc: { pts: 0, total: 0, wk: 0 } } };
const fresh = S.makeMap(), cx = 44 * S.TS, y0 = 33 * S.TS + 16, y1 = 43 * S.TS + 16; // กึ่งกลางสะพาน (รอยต่อสองช่อง) จากฝั่งเหนือถึงฝั่งใต้
const crossable = m => { for (let y = y0; y <= y1; y += 4) if (S.blockedAt(m, cx, y)) return false; return true; };
assert.strictEqual(crossable(fresh), false, 'แมพเปล่า (makeMap) ยังไม่มีสะพาน');
w.players.set(1, p); w.saved.tester = p.rec;
assert.strictEqual(crossable(w.map), true, 'สะพานต้องมีให้เลยตั้งแต่เริ่ม เดินข้ามจากเหนือลงใต้ได้');
assert.strictEqual(S.blockedAt(w.map, 38 * S.TS, 38 * S.TS), true, 'น้ำนอกสะพานต้องยังเดินไม่ได้');
assert.strictEqual(S.blockedAt(w.map, cx, 33 * S.TS + 16), false, 'ปลายสะพานฝั่งเหนือต้องต่อกับฝั่งที่เดินได้');
w.dirty = true; w.save(true);
// ไม่มีดอกเบี้ย: ยอดฝากต้องไม่เพิ่มเองไม่ว่าจะออนไลน์นานแค่ไหน
p.rec.bank = { bal: 5000 }; p.activeAt = Date.now();
for (let i = 0; i < 20; i++) w.tick(60, Date.now());
assert.strictEqual(w.bankOf(p).bal, 5000, 'ยอดฝากเปลี่ยนเอง (ไม่ควรมีดอกเบี้ย)');
assert.strictEqual(S.BANK.rate, undefined, 'BANK.rate ต้องไม่มีแล้ว');
// พลังงาน ⚡ + งานหนัก: ต้นทุนสัมพันธ์กับรายได้ของงาน
{
  const E = S.ENERGY, R = E.coinsPerEnergy, ON = E.on; E.on = true; p.rec.en = null; w.enJoin(p); p.sit = null; // ระบบพลังงานปิดอยู่ในเกม (ECONOMY-PLAN 7.5) แต่โค้ดยังอยู่ เปิดชั่วคราวเพื่อทดสอบ
  assert.strictEqual(w.enOf(p).v, E.max, 'เริ่มเต็ม');
  // ต้นทุนพลังงาน ≈ มูลค่า ÷ coinsPerEnergy ทุกกลุ่มงาน (ผักรวมทั้งรอบ ขุด+ปลูก+รดน้ำ+เก็บ)
  const fixed = E.cost.dig + E.cost.plant + E.cost.water;
  for (const c of Object.values(S.CROPS)) if (c.sell >= 4 * R) assert.ok(Math.abs((S.energyCost('harvest', c.sell) + fixed) * R - c.sell) <= R / 2 + 1e-9, 'ผัก ' + c.name + ' พลังงานต้องสัมพันธ์กับราคา');
  for (const f of S.FISH) if (f.sell >= R) assert.ok(Math.abs(S.energyCost('fish', f.sell) * R - f.sell) <= R / 2 + 1e-9, 'ปลา ' + f.name + ' พลังงานต้องสัมพันธ์กับราคา');
  const val = [1, 12, 26, 55, 90, 140, 190].map(v => S.energyCost('fish', v)); assert.deepStrictEqual(val, [...val].sort((a, b) => a - b), 'ของแพงขึ้นต้องกินพลังงานไม่น้อยลง');
  assert.ok(S.energyCost('harvest', S.CROPS.mango.sell) > 5 * S.energyCost('harvest', S.CROPS.carrot.sell), 'มะม่วงกินพลังงานมากกว่าแครอทมาก');
  assert.strictEqual(S.energyCost('harvest', S.CROPS.carrot.sell) + fixed, 4, 'ผักถูกยังทำรอบละ 4 หน่วยขั้นต่ำ');
  // ตัดไม้ซ้ำจนเหนื่อย
  const VAR = E.var; E.var = null; // เทสต์ต้นทุนตายตัวด้านล่างปิดความล้างานซ้ำ (ทดสอบแยกท้ายส่วนนี้)
  const chopVal = 2 * S.WOOD.log.sell, per = S.energyCost('chop', chopVal); let n = 0;
  while (!w.exhausted(p) && n < 200) { w.tire(p, 'chop', chopVal); n++; }
  assert.ok(w.exhausted(p) && n === Math.ceil(E.max / per), 'ตัดไม้ซ้ำต้องเหนื่อยตามต้นทุน');
  assert.ok(w.heavyAction('axe', '1,1') && w.heavyAction('hoe', '1,1') && w.heavyAction('seed_carrot', '1,1') && !w.heavyAction('feed', '1,1') && !w.heavyAction('hand', '1,1'), 'งานหนักถูกหยุด งานเบา/ร้าน/เลี้ยงสัตว์ไม่ถูกหยุด');
  // หนี้พลังงาน: งานแพงตอนเหลือพลังงานนิดเดียว ต้องพักนานตามมูลค่า (ไม่ใช่ได้ส่วนลด)
  const e = w.enOf(p); e.v = 1; e.ex = false; w.tire(p, 'harvest', S.CROPS.mango.sell);
  const cost = S.energyCost('harvest', S.CROPS.mango.sell); assert.ok(Math.abs(e.v - (1 - cost)) < 1e-9 && e.v < 0 && w.exhausted(p), 'ติดหนี้พลังงาน');
  const needSec = (E.resume - e.v) * E.regenMs / 1000;
  w.energyTick(needSec - 5); assert.ok(w.exhausted(p), 'ยังไม่ครบเวลาพักตามมูลค่างาน ต้องยังเหนื่อย');
  w.energyTick(10); assert.ok(!w.exhausted(p), 'พักครบแล้วกลับมาทำงานได้');
  // นั่งพักเร็วขึ้น 3 เท่า
  e.v = 0; e.ex = true; p.sit = { x: 1, y: 1 }; w.energyTick(10); const sitV = e.v; p.sit = null; e.v = 0; w.energyTick(10);
  assert.ok(Math.abs(sitV - e.v * E.sitMul) < 1e-6, 'นั่งพักฟื้นเร็วขึ้นตาม sitMul');
  // ออฟไลน์ก็ฟื้น
  e.v = 0; e.ex = true; e.at = Date.now() - 60000; w.enJoin(p); assert.ok(Math.abs(e.v - 60000 / E.regenMs) < 0.2, 'ออฟไลน์ก็ฟื้น');
  // ความล้างานซ้ำ: กลุ่มเดียวซ้ำแพงขึ้นไม่เกิน ×(1+max), สลับกลุ่มถูกกว่า, ฟื้นตามเวลา, ออฟไลน์ก็ฟื้น
  E.var = VAR; p.rec.wk = {}; p.rec.wkAt = 0; e.v = E.max; e.ex = false;
  const cv = S.energyCost('harvest', S.CROPS.mango.sell); let paid = 0;
  for (let i = 0; i < 12; i++) { e.v = E.max; e.ex = false; const b = e.v; w.tire(p, 'harvest', S.CROPS.mango.sell); paid = b - e.v; }
  assert.ok(paid > cv * (1 + VAR.max) * 0.95 && paid <= cv * (1 + VAR.max) + 0.06, 'ทำกลุ่มเดียวซ้ำ ต้นทุนชนเพดาน ×' + (1 + VAR.max));
  e.v = E.max; e.ex = false; const bf = e.v; w.tire(p, 'fish', 40); assert.ok(Math.abs((bf - e.v) - S.energyCost('fish', 40)) < 0.06, 'สลับไปกลุ่มอื่นยังจ่ายราคาปกติ');
  p.rec.wkAt -= 10 * VAR.halfLifeMs; e.v = E.max; e.ex = false; const b2 = e.v; w.tire(p, 'harvest', S.CROPS.mango.sell); assert.ok(Math.abs((b2 - e.v) - cv) < 0.06, 'พักนานความล้าหาย กลับมาราคาปกติ');
  // นั่งพัก: ความล้างานซ้ำหายเร็วขึ้น sitMul เท่า + แจ้ง client ผ่าน enPub
  p.rec.wk = { farm: 40 }; p.sit = { x: 1, y: 1 }; e.v = 50; w.energyTick(VAR.halfLifeMs / 1000 / E.sitMul); p.sit = null;
  assert.ok(Math.abs(p.rec.wk.farm - 40 * 0.5 ** ((E.sitMul - 1) / E.sitMul)) < 1e-6, 'นั่งพักความล้าลดเร็ว sitMul เท่า');
  p.rec.wk = { farm: 25 }; assert.deepStrictEqual(w.enPub(p).wk, { farm: 25 }, 'enPub ส่งความล้างานซ้ำให้ client');
  // กินอาหารฟื้นตาม eatMul
  e.v = 10; p.rec.hunger = 40; p.rec.inv.meal_bread = 1; w.eat(p, 'meal_bread'); const food = S.itemInfo('meal_bread').food;
  assert.ok(Math.abs(e.v - (10 + food * E.eatMul)) < 1e-6, 'กินอาหารฟื้นพลังงานตาม eatMul');
  const pub = w.enPub(p, 7); assert.ok(pub.t === 'en' && pub.rate > 0 && pub.spent === 7 && Number.isFinite(pub.v), 'ข้อมูลส่ง client ถูกต้อง');
  console.log('  พลังงาน: แครอท 1 รอบ', S.energyCost('harvest', S.CROPS.carrot.sell) + fixed, '• มะม่วง', S.energyCost('harvest', S.CROPS.mango.sell) + fixed, '• ปลาคาร์พ', S.energyCost('fish', 12), '• ปลาวาฬ', S.energyCost('fish', 120), '• ตัดไม้', per, '(' + R + ' เหรียญ/พลังงาน)');
  e.v = E.max; e.ex = false;
  E.on = ON;
}
// ความอิ่มตัวของตลาดต่อหมวด: ขายซ้ำๆ ในหมวดเดียวกัน (สลับชนิดก็ตก) ราคาตก ไม่มีลิมิต พักแล้วฟื้น
{
  const C = S.CATFAT;
  assert.deepStrictEqual(['fish_carp', 'crop_melon', 'egg', 'milk', 'log', 'dish_grill'].map(S.sellCat), ['fish', 'crop', 'animal', 'animal', 'wood', 'dish'], 'จัดหมวดสินค้า');
  assert.strictEqual(S.sellQuote(100, 1, 1).total, 100, 'ชิ้นแรกได้เต็ม'); { const d = S.sellDrop(100); assert.strictEqual(S.sellQuote(100, 1, 30).total, (() => { let m = 1, t = 0; for (let i = 0; i < 30; i++) { t += Math.round(100 * m); m = Math.max(S.MARKET.min, m - d); } return t; })(), 'ขาย 30 ชิ้นลดตาม sellDrop (ตามมูลค่า B3)'); }
  assert.ok(S.sellDrop(5) < S.sellDrop(67) && S.sellDrop(67) < S.sellDrop(180) && S.sellDrop(1e6) === S.CATFAT.dropMax, 'ของแพงลดต่อชิ้นมากกว่าของถูก มีเพดาน');
  w.event = () => {}; w.nearShopKind = () => 'fish'; p.rec.cat = null; p.rec.sold = null; p.rec.mk = {};
  const kinds = S.FISH.filter(f => f.id !== 'boot').sort((x, y) => y.sell - x.sell).slice(0, 12).map(f => 'fish_' + f.id); let paid = 0, itemOnly = 0, units = 0;
  for (const k of kinds) w.market[k] = w.market[k] || { m: 1, t: 1 };
  for (let round = 0; round < 5; round++) for (const k of kinds) { // สลับชนิดทีละ 1 ชิ้น หนีความอิ่มตัวรายชนิด
    p.rec.inv[k] = 1; const mE = w.effMult(p, k) / w.catOf(p, 'fish'), c0 = p.rec.inv.coin; w.sell(p, k, 1);
    paid += p.rec.inv.coin - c0; itemOnly += Math.max(1, Math.round(S.itemInfo(k).sell * mE)); units++;
  }
  const cm = w.catOf(p, 'fish'); assert.ok(cm < 0.8 && cm >= C.min, 'ขายหมวดเดียว ' + units + ' ชิ้น ความอิ่มตัวหมวดต้องลดลง (' + cm.toFixed(2) + ')');
  assert.ok(paid < itemOnly * 0.85, `สลับชนิดขายซ้ำ ต้องได้น้อยกว่าราคารายชนิดอย่างชัดเจน (ได้ ${paid} จาก ${itemOnly})`);
  assert.strictEqual(w.catOf(p, 'crop'), 1, 'หมวดอื่นไม่ถูกกระทบ');
  const cat = w.catPub(p); assert.ok(cat.t === 'cat' && cat.c.fish < 0.995 && cat.recover === C.recover, 'ข้อมูลที่ส่งให้ป้ายถูกต้อง');
  const before = w.catOf(p, 'fish'); for (let i = 0; i < 30; i++) w.marketTick(Date.now()); // พักขาย ~30 นาที (ตลาดเดินนาทีละครั้ง)
  assert.ok(Math.abs(w.catOf(p, 'fish') - (1 - (1 - before) * Math.pow(1 - C.recover, 30))) < 0.01 && w.catOf(p, 'fish') > before, 'พักขายแล้วราคาหมวดฟื้นกลับตามอัตรา');
  console.log('  ตลาดหมวดปลา: ขายสลับ 12 ชนิด ' + units + ' ชิ้น ได้ ' + paid + ' จากราคารายชนิด ' + itemOnly + ' (' + Math.round(paid / itemOnly * 100) + '%) • ความอิ่มตัวหลังขาย ' + Math.round(cm * 100) + '% → พัก 30 นาที ' + Math.round(w.catOf(p, 'fish') * 100) + '%');
}
// ตลาดหมวดฟื้นตอนออฟไลน์ / ใบสั่งซื้อ NPC
{
  // ตลาดหมวดฟื้นตามเวลาจริงตอนออฟไลน์
  p.rec.cat = { fish: 0.5 }; p.rec.catAt = Date.now() - 60 * 60000; w.catJoin(p);
  assert.ok(Math.abs(p.rec.cat.fish - (1 - 0.5 * Math.pow(1 - S.CATFAT.recover, 60))) < 1e-3, 'ออฟไลน์ 60 นาที ตลาดหมวดฟื้นตามเวลาจริง');
  p.rec.cat = null;
  // ใบงาน NPC (ORDERS แทนกระดานใบสั่งซื้อเดิมที่เอาออกแล้ว): จำนวนใบตามคน ใบละ 2–3 หมวดไม่ซ้ำ ของราคา ≤ 90 ไม่ใช่อาหาร จ่าย 120% ของราคามาตรฐาน
  { const O = S.ORDERS; w.orders = {}; const o = w.ordersRoll();
    assert.ok(o.list.length >= O.minN && o.list.length <= O.maxN, 'จำนวนใบงานอยู่ในช่วง minN–maxN');
    for (const x of o.list) {
      assert.ok(x.need.length >= 2 && x.need.length <= 3 && new Set(x.need.map(([k]) => S.sellCat(k))).size === x.need.length, 'ใบละ 2–3 หมวดไม่ซ้ำกัน');
      for (const [k, q] of x.need) assert.ok(S.itemInfo(k).sell <= 90 && S.sellCat(k) !== 'dish' && q >= O.qty[0] && q <= O.qty[1], 'ของราคา ≤ 90 ไม่ใช่อาหาร จำนวนในช่วง qty');
      assert.strictEqual(x.pay, Math.round(x.need.reduce((t, [k, q]) => t + S.itemInfo(k).sell * q, 0) * O.pay), 'จ่าย 120% ของราคามาตรฐาน');
    }
    assert.strictEqual(w.ordersRoll(), o, 'วันเดียวกันได้ชุดเดิม');
    console.log('  ใบงาน NPC: ' + o.list.length + ' ใบ ตรงกติกา'); }
}
// ถือได้ไม่จำกัด + ขายเป็นชุดใหญ่: ราคาต่อชิ้นลดตามมูลค่า (sellDrop, B3) ถึงพื้น 20% ที่ชิ้น ~81 ขายรวดหรือทยอยติดกันได้เงินเท่ากัน
{
  const C = S.CATFAT, Mn = S.MARKET.min; assert.strictEqual(Mn, 0.2);
  const D = S.sellDrop(100), units = []; { let m = 1; for (let i = 0; i < 100; i++) { units.push(Math.max(1, Math.round(100 * Math.max(Mn, m)))); m = Math.max(Mn, m - D); } } // ราคาชิ้นที่ i ลดตามมูลค่า (B3)
  assert.strictEqual(S.sellQuote(100, 1, 100).total, units.reduce((x, y) => x + y, 0), 'ราคารวมตรงกับลดทีละชิ้น');
  assert.ok(units[0] === 100 && units.every((u, i) => i === 0 || u <= units[i - 1]), 'ชิ้นแรกเต็ม แล้วลดลงเรื่อยๆ');
  assert.ok(units.slice(Math.ceil((1 - Mn) / D) + 1).every(u => u === 20), 'ถึงพื้น 20% แล้วไม่ต่ำกว่านั้น');
  assert.strictEqual(S.sellQuote(100, 0.05, 3).total, 3 * 20, 'ตลาดตกหนักก็ไม่ต่ำกว่า 20% ของราคาฐาน');
  // ผ่านระบบจริง: ขายรวด 100 ชิ้น เทียบทยอยขายติดกันทีละชิ้น ต้องได้เงินเท่ากัน (ขายทีละชิ้นไม่ได้เปรียบ) ถือไม่จำกัด
  w.event = () => {}; w.nearShopKind = () => 'animal'; const base = S.itemInfo('egg').sell, reset = () => { w.market.egg = { m: 1, t: 1 }; p.rec.cat = null; p.rec.mk = {}; p.rec.sold = null; };
  reset(); p.rec.inv.egg = 100; let c0 = p.rec.inv.coin; w.sell(p, 'egg', 'all'); const batch = p.rec.inv.coin - c0, catB = w.catOf(p, 'animal'), pmB = w.pmOf(p, 'egg'), gB = w.market.egg.m;
  reset(); p.rec.inv.egg = 100; c0 = p.rec.inv.coin; for (let i = 0; i < 100; i++) w.sell(p, 'egg', 1); const singles = p.rec.inv.coin - c0;
  assert.ok(Math.abs(batch - singles) / batch < 0.03, `ขายรวด 100 ชิ้น (${batch}) กับทยอยติดกันทีละชิ้น (${singles}) ต้องได้เงินเท่ากัน`);
  assert.ok(Math.abs(w.catOf(p, 'animal') - catB) < 0.02 && Math.abs(w.pmOf(p, 'egg') - pmB) < 0.02 && Math.abs(w.market.egg.m - gB) < 0.02, 'ตลาดหลังขายรวด กับ หลังทยอยขาย ต้องอยู่ที่เดียวกัน');
  assert.ok(batch >= 100 * Math.round(base * Mn) && batch < 100 * base, 'ชุด 100 ชิ้นได้ระหว่างพื้น 20% กับราคาเต็ม (ได้ ' + batch + ' จาก ' + 100 * base + ')');
  reset(); p.rec.inv.egg = 3000; c0 = p.rec.inv.coin; w.sell(p, 'egg', 'all'); const got = p.rec.inv.coin - c0;
  assert.strictEqual(p.rec.inv.egg || 0, 0, 'ถือ 3,000 ชิ้น ขายหมดในครั้งเดียว ไม่มีเพดาน'); assert.ok(got >= 3000 * Math.round(base * Mn), 'ชิ้นท้ายๆ ได้พื้น 20%');
  console.log('  ขายไข่ 100 ชิ้น: ชุดเดียว ' + batch + ' • ทยอยติดกันทีละชิ้น ' + singles + ' (ราคาฐานรวม ' + 100 * base + ') • 3,000 ชิ้น ได้ ' + got + ' • ตลาดหมวดหลังขายชุด 100 = ' + Math.round(catB * 100) + '% ส่วนตัว ' + Math.round(pmB * 100) + '%');
  reset();
}
const w2 = new World('main');
for (const P of S.PROJECTS) assert.strictEqual(w2.projects[P.id].coin, P.goal, P.id + ' ต้องสร้างเสร็จตั้งแต่ต้น (ไม่ต้องลงขัน)');
assert.strictEqual(crossable(w2.map), true, 'หลังรีสตาร์ตสะพานต้องยังอยู่');
// สูตรประดิษฐ์: เลเวลสูตรต้องไม่ต่ำกว่าเลเวลที่ต้นไม้ให้วัตถุดิบปลดล็อก • เฟอร์นิเจอร์ที่ร้านเลิกขายต้องมีสูตรทุกชิ้น และวัตถุดิบ+ค่าโรงช่างไม่เกินราคาของ
{ const woodLv = {}; for (const t of Object.values(S.TREE_KINDS)) for (const [it] of t.drop || []) woodLv[it] = Math.min(woodLv[it] || 99, t.lv);
  const need = k => k === 'plank' ? 1 : woodLv[k] || 1;
  for (const r of S.CRAFT) for (const k of Object.keys(r.in)) assert.ok(r.lv >= need(k), `${r.id} Lv${r.lv} ใช้ ${k} ที่ได้ตอน Lv${need(k)}`);
  for (const k of S.FURN_CRAFT_ONLY) { const r = S.CRAFT.find(x => x.id === 'furn_' + k); assert.ok(r, 'ไม่มีสูตร ' + k);
    const mat = Object.entries(r.in).reduce((t, [i, n]) => t + n * S.itemInfo(i).sell, 0); assert.ok(mat + S.craftFee(r.id) <= S.FURN[k].price, `${k} ต้นทุน ${mat}+${S.craftFee(r.id)} เกินราคา ${S.FURN[k].price}`); }
  assert.ok(Object.keys(woodLv).length >= 10, 'อ่านเลเวลไม้จาก TREE_KINDS ได้'); }
// ทุกโครงการ: แปลงช่องตามที่ตั้งใจ เดินถึงได้/ตันตามกติกา ไม่ทับอาคารอื่น
const all = S.makeMap(); for (const P of S.PROJECTS) S.applyProject(all, P.id);
const T = S.T, walk = (x, y) => !S.blockedAt(all, x * S.TS + 16, y * S.TS + 16);
for (let y = S.LIGHTHOUSE.y0; y <= S.LIGHTHOUSE.y1; y++) for (let x = S.LIGHTHOUSE.x0; x <= S.LIGHTHOUSE.x1; x++) { assert.strictEqual(all[y][x], T.WATER, 'ประภาคารต้องอยู่บนน้ำ'); assert.ok(!walk(x, y), 'ประภาคารต้องเดินทะลุไม่ได้'); }
for (let y = S.ISLAND.y0; y <= S.ISLAND.y1; y++) for (let x = S.ISLAND.x0; x <= S.ISLAND.x1; x++) if (x === S.SEA.dock.x && y === S.SEA.dock.y) assert.strictEqual(all[y][x], T.SHOP, 'ท่าเรือบนเกาะเป็นช่องร้าน (แตะออกทะเล)'); else assert.ok(walk(x, y), 'เกาะต้องเดินได้');
for (let x = S.ISLAND.x0 + 1; x <= S.BRIDGE.x0; x++) assert.ok(walk(x, S.ISLAND.walk.y), 'ต้องเดินจากสะพานขึ้นเกาะได้'); // ช่องซ้ายสุดของแถวนี้คือท่าเรือ (ตัน)
const orig = S.makeMap(); let changed = 0; for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (orig[y][x] !== all[y][x]) { changed++; assert.ok([T.WATER, T.GRASS, T.TREE, T.PATH].includes(orig[y][x]), `ทับช่องที่ไม่ควรทับที่ ${x},${y}`); }
console.log('  โครงการทั้ง 3 แปลงแมพ', changed, 'ช่อง');
console.log('✓ ผ่าน: ยอดโครงการอยู่ครบหลังโหลดใหม่ และสะพานเดินข้ามได้ทั้งตอนสร้างเสร็จและหลังรีสตาร์ต');
process.exit(0);
