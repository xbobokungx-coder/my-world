// ทดสอบว่าข้อมูลเมืองที่ save แล้วถูกโหลดกลับมาครบหลังรีสตาร์ต: node tools/test-persist.js
// (บั๊กเดิม: โครงการพัฒนาเมืองถูกบันทึกแต่ไม่ถูกโหลด → ยอดลงขันรีเซ็ตเป็น 0 ทุกครั้งที่รีสตาร์ตเซิร์ฟเวอร์)
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-persist-'));
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('main'); w.nearChest = () => true;
const p = { name: 'tester', key: 'tester', x: 0, y: 0, ws: { readyState: 0, send() {} }, rec: { inv: { coin: 20000 }, pts: 0, arc: { pts: 0, total: 0, wk: 0 } } };
const fresh = S.makeMap(), cx = 44 * S.TS, y0 = 33 * S.TS + 16, y1 = 43 * S.TS + 16; // กึ่งกลางสะพาน (รอยต่อสองช่อง) จากฝั่งเหนือถึงฝั่งใต้
const crossable = m => { for (let y = y0; y <= y1; y += 4) if (S.blockedAt(m, cx, y)) return false; return true; };
assert.strictEqual(crossable(fresh), false, 'ก่อนสร้างสะพานต้องข้ามสระไม่ได้');
w.players.set(1, p); w.saved.tester = p.rec;
for (let i = 0; i < 4; i++) w.projHandle(p, { id: 'bridge', amt: 2000 });
w.projHandle(p, { id: 'bridge', amt: 500 }); w.projHandle(p, { id: 'lighthouse', amt: 500 });
assert.strictEqual(crossable(w.map), true, 'สร้างสะพานครบแล้วต้องเดินข้ามจากเหนือลงใต้ได้ทันที (ไม่ต้องรีสตาร์ต)');
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
  const E = S.ENERGY, R = E.coinsPerEnergy; p.rec.en = null; w.enJoin(p); p.sit = null;
  assert.strictEqual(w.enOf(p).v, E.max, 'เริ่มเต็ม');
  // ต้นทุนพลังงาน ≈ มูลค่า ÷ coinsPerEnergy ทุกกลุ่มงาน (ผักรวมทั้งรอบ ขุด+ปลูก+รดน้ำ+เก็บ)
  const fixed = E.cost.dig + E.cost.plant + E.cost.water;
  for (const c of Object.values(S.CROPS)) if (c.sell >= 4 * R) assert.ok(Math.abs((S.energyCost('harvest', c.sell) + fixed) * R - c.sell) <= R / 2 + 1e-9, 'ผัก ' + c.name + ' พลังงานต้องสัมพันธ์กับราคา');
  for (const f of S.FISH) if (f.sell >= R) assert.ok(Math.abs(S.energyCost('fish', f.sell) * R - f.sell) <= R / 2 + 1e-9, 'ปลา ' + f.name + ' พลังงานต้องสัมพันธ์กับราคา');
  const val = [1, 12, 26, 55, 90, 140, 190].map(v => S.energyCost('fish', v)); assert.deepStrictEqual(val, [...val].sort((a, b) => a - b), 'ของแพงขึ้นต้องกินพลังงานไม่น้อยลง');
  assert.ok(S.energyCost('harvest', S.CROPS.mango.sell) > 5 * S.energyCost('harvest', S.CROPS.carrot.sell), 'มะม่วงกินพลังงานมากกว่าแครอทมาก');
  assert.strictEqual(S.energyCost('harvest', S.CROPS.carrot.sell) + fixed, 4, 'ผักถูกยังทำรอบละ 4 หน่วยขั้นต่ำ');
  // ตัดไม้ซ้ำจนเหนื่อย
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
  // กินอาหารฟื้นตาม eatMul
  e.v = 10; p.rec.hunger = 40; p.rec.inv.meal_bread = 1; w.eat(p, 'meal_bread'); const food = S.itemInfo('meal_bread').food;
  assert.ok(Math.abs(e.v - (10 + food * E.eatMul)) < 1e-6, 'กินอาหารฟื้นพลังงานตาม eatMul');
  const pub = w.enPub(p, 7); assert.ok(pub.t === 'en' && pub.rate > 0 && pub.spent === 7 && Number.isFinite(pub.v), 'ข้อมูลส่ง client ถูกต้อง');
  console.log('  พลังงาน: แครอท 1 รอบ', S.energyCost('harvest', S.CROPS.carrot.sell) + fixed, '• มะม่วง', S.energyCost('harvest', S.CROPS.mango.sell) + fixed, '• ปลาคาร์พ', S.energyCost('fish', 12), '• ปลาวาฬ', S.energyCost('fish', 120), '• ตัดไม้', per, '(' + R + ' เหรียญ/พลังงาน)');
  e.v = E.max; e.ex = false;
}
// ความอิ่มตัวของตลาดต่อหมวด: ขายซ้ำๆ ในหมวดเดียวกัน (สลับชนิดก็ตก) ราคาตก ไม่มีลิมิต พักแล้วฟื้น
{
  const C = S.CATFAT;
  assert.deepStrictEqual(['fish_carp', 'crop_melon', 'egg', 'milk', 'log', 'dish_grill'].map(S.sellCat), ['fish', 'crop', 'animal', 'animal', 'wood', 'dish'], 'จัดหมวดสินค้า');
  assert.strictEqual(S.sellQuote(10, 1, 1, C.step).total, S.sellQuote(10, 1, 1).total, 'ชิ้นแรกราคาเท่าเดิม');
  assert.ok(S.sellQuote(100, 1, 30, C.step).total < S.sellQuote(100, 1, 30).total, 'ขายรวดหลายชิ้นในหมวด ต่อชิ้นถูกลงกว่าเดิม');
  w.event = () => {}; w.nearShopKind = () => 'fish'; p.rec.cat = null; p.rec.sold = null; p.rec.mk = {};
  const kinds = S.FISH.filter(f => f.id !== 'boot').slice(0, 12).map(f => 'fish_' + f.id); let paid = 0, itemOnly = 0, units = 0;
  for (const k of kinds) w.market[k] = w.market[k] || { m: 1, t: 1 };
  for (let round = 0; round < 5; round++) for (const k of kinds) { // สลับชนิดทีละ 1 ชิ้น หนีความอิ่มตัวรายชนิด
    p.rec.inv[k] = 1; const mE = w.effMult(p, k) / w.catOf(p, 'fish'), c0 = p.rec.inv.coin; w.sell(p, k, 1);
    paid += p.rec.inv.coin - c0; itemOnly += Math.max(1, Math.round(S.itemInfo(k).sell * mE)); units++;
  }
  const cm = w.catOf(p, 'fish'); assert.ok(Math.abs(cm - Math.pow(C.step, units)) < 1e-9 || cm === C.min, 'ความอิ่มตัวหมวดตาม step ต่อชิ้น');
  assert.ok(paid < itemOnly * 0.85, `สลับชนิดขายซ้ำ ต้องได้น้อยกว่าราคารายชนิดอย่างชัดเจน (ได้ ${paid} จาก ${itemOnly})`);
  assert.strictEqual(w.catOf(p, 'crop'), 1, 'หมวดอื่นไม่ถูกกระทบ');
  const cat = w.catPub(p); assert.ok(cat.t === 'cat' && cat.c.fish < 0.995 && cat.recover === C.recover, 'ข้อมูลที่ส่งให้ป้ายถูกต้อง');
  const before = w.catOf(p, 'fish'); for (let i = 0; i < 30; i++) w.marketTick(Date.now()); // พักขาย ~30 นาที (ตลาดเดินนาทีละครั้ง)
  assert.ok(w.catOf(p, 'fish') > before + 0.2 && w.catOf(p, 'fish') <= 1, 'พักขายแล้วราคาหมวดฟื้นกลับ');
  console.log('  ตลาดหมวดปลา: ขายสลับ 12 ชนิด ' + units + ' ชิ้น ได้ ' + paid + ' จากราคารายชนิด ' + itemOnly + ' (' + Math.round(paid / itemOnly * 100) + '%) • ความอิ่มตัวหลังขาย ' + Math.round(cm * 100) + '% → พัก 30 นาที ' + Math.round(w.catOf(p, 'fish') * 100) + '%');
}
// ตลาดหมวดฟื้นตอนออฟไลน์ / ใบสั่งซื้อ NPC
{
  // ตลาดหมวดฟื้นตามเวลาจริงตอนออฟไลน์
  p.rec.cat = { fish: 0.5 }; p.rec.catAt = Date.now() - 60 * 60000; w.catJoin(p);
  assert.ok(Math.abs(p.rec.cat.fish - (1 - 0.5 * Math.pow(1 - S.CATFAT.recover, 60))) < 1e-3, 'ออฟไลน์ 60 นาที ตลาดหมวดฟื้นตามเวลาจริง');
  p.rec.cat = null;
  // ใบสั่งซื้อ NPC: ไม่ล้นกระดาน ราคา 115% ของราคาร้านตอนนั้น สินค้าสลับ ไม่ซ้ำใบที่เปิดอยู่
  w.orders = []; for (const k of S.SELLABLE) w.market[k] = w.market[k] || { m: 1, t: 1 }; let sameCat = 0, last = null; const seen = [];
  for (let i = 0; i < 60; i++) {
    const before = new Set(w.orders.map(o => o.id)); w.npcPostOrders(); const o = w.orders.find(x => !before.has(x.id)); assert.ok(o, 'ต้องมีใบใหม่ทุกวัน');
    const info = S.itemInfo(o.item), m = w.market[o.item].m; assert.strictEqual(o.perUnit, Math.max(1, Math.round(info.sell * m * S.ORDER.npcPremium)), 'NPC จ่าย 115% ของราคาร้าน');
    const cat = S.sellCat(o.item); if (cat === last) sameCat++; last = cat; seen.push(o.item);
    const open = w.orders.filter(x => x.npc); assert.ok(open.length <= S.ORDER.npcMaxOpen, 'ใบ NPC ต้องไม่เกิน ' + S.ORDER.npcMaxOpen); assert.strictEqual(new Set(open.map(x => x.item)).size, open.length, 'ไม่มีสินค้าซ้ำในใบที่เปิดอยู่');
  }
  assert.ok(new Set(seen).size >= 25, 'เมนูต้องหมุนเวียนหลากหลาย (ได้ ' + new Set(seen).size + ' ชนิดจาก 60 ใบ)'); assert.ok(sameCat <= 6, 'หมวดซ้ำติดกันต้องน้อย (' + sameCat + ')');
  // ใบของผู้เล่นต้องขึ้นก่อนใบ NPC
  w.orders.push({ id: 99999, by: 'someone', byName: 'เพื่อน', npc: false, item: 'crop_carrot', qty: 5, filled: 0, perUnit: 20, esc: 100, exp: Date.now() + 1e7 });
  w.orders.push({ id: 100000, by: p.key, byName: 'tester', npc: false, item: 'crop_corn', qty: 5, filled: 0, perUnit: 30, esc: 150, exp: Date.now() + 1e7 });
  const list = w.ordersPub(p).list; assert.ok(list[0].mine && !list[1].npc && list.slice(2).every(x => x.npc), 'ลำดับ: ใบของเรา → ใบผู้เล่นอื่น → NPC');
  // โหลดข้อมูลเดิมที่ล้น (59 ใบ NPC) ต้องถูกตัดเหลือ npcMaxOpen
  w.orders = []; for (let i = 0; i < 59; i++) w.orders.push({ id: 200 + i, by: '', byName: 'x', npc: true, item: S.SELLABLE[i % S.SELLABLE.length], qty: 10, filled: 0, perUnit: 10, esc: 0, exp: Date.now() + i * 1000 });
  w.trimNpc(S.ORDER.npcMaxOpen); assert.strictEqual(w.orders.length, S.ORDER.npcMaxOpen, 'ตัดใบ NPC ที่ล้น');
  console.log('  ใบสั่งซื้อ NPC: 60 ใบหมุนเวียน ' + new Set(seen).size + ' ชนิด หมวดซ้ำติดกัน ' + sameCat + ' ครั้ง เปิดค้างไม่เกิน ' + S.ORDER.npcMaxOpen);
}
// ถือได้ไม่จำกัด + ขายเป็นชุดใหญ่: ราคาต่อชิ้นลดลงเรื่อยๆ ถึงพื้น 20% ของราคาฐาน (ชิ้นที่ ~80 เป็นต้นไป) ขายรวดหรือทยอยได้เงินใกล้เคียงกัน
{
  const C = S.CATFAT, Mn = S.MARKET.min, step = S.MARKET.step * C.step; assert.strictEqual(Mn, 0.2); assert.ok(Math.abs(step - 0.98) < 0.001, 'ลดชิ้นละ ~2%');
  const unit = (base, m0, i) => Math.max(1, Math.round(base * Math.max(Mn, m0 * Math.pow(step, i)))); // ราคาชิ้นที่ i (เริ่ม 0)
  let sum = 0; for (let i = 0; i < 100; i++) sum += unit(100, 1, i);
  assert.ok(Math.abs(S.sellQuote(100, 1, 100, C.step).total - sum) <= 2, 'ยอดรวมชุด 100 ชิ้นตรงสูตรทีละชิ้น');
  const t80 = S.sellQuote(100, 1, 80, C.step).total, t100 = S.sellQuote(100, 1, 100, C.step).total;
  assert.strictEqual(t100 - t80, 20 * 20, 'ชิ้นที่ 81-100 ราคาชิ้นละ 20% ของราคาฐาน (20 ชิ้น × 20 = 400)');
  assert.strictEqual(unit(100, 1, 0), 100, 'ชิ้นแรกได้เต็ม'); assert.ok(unit(100, 1, 40) < unit(100, 1, 10) && unit(100, 1, 79) <= 21 && unit(100, 1, 79) >= 20, 'ลดลงเรื่อยๆ จนถึงพื้นราว ชิ้นที่ 80');
  assert.strictEqual(S.sellQuote(100, 0.05, 3, C.step).total, 3 * 20, 'ตลาดตกหนักก็ไม่ต่ำกว่า 20% ของราคาฐาน');
  // ผ่านระบบจริง: ถือไม่จำกัด ขาย 3,000 ชิ้นทีเดียว / ขายรวด 100 ชิ้น เทียบกับทยอยขายทีละชิ้น
  w.event = () => {}; w.nearShopKind = () => 'animal'; const base = S.itemInfo('egg').sell, reset = () => { w.market.egg = { m: 1, t: 1 }; p.rec.cat = null; p.rec.mk = {}; p.rec.sold = null; };
  reset(); p.rec.inv.egg = 100; let c0 = p.rec.inv.coin; w.sell(p, 'egg', 'all'); const batch = p.rec.inv.coin - c0, catAfterBatch = w.catOf(p, 'animal');
  reset(); p.rec.inv.egg = 100; c0 = p.rec.inv.coin; for (let i = 0; i < 100; i++) w.sell(p, 'egg', 1); const singles = p.rec.inv.coin - c0;
  assert.ok(Math.abs(batch - singles) / batch < 0.12, `ขายรวด 100 ชิ้น (${batch}) กับทยอยทีละชิ้น (${singles}) ต้องได้เงินใกล้เคียงกัน`);
  assert.ok(batch < 100 * base * 0.6 && batch > 100 * base * 0.2, 'ชุด 100 ชิ้นได้เฉลี่ยระหว่าง 20% ถึง 60% ของราคาฐาน');
  reset(); p.rec.inv.egg = 3000; c0 = p.rec.inv.coin; const m0 = w.effMult(p, 'egg'); w.sell(p, 'egg', 'all'); const got = p.rec.inv.coin - c0;
  assert.strictEqual(p.rec.inv.egg || 0, 0, 'ถือ 3,000 ชิ้น ขายหมดในครั้งเดียว ไม่มีเพดาน'); assert.ok(got >= 3000 * Math.round(base * Mn) && got < 3000 * base * m0 * 0.3, 'ชุดใหญ่ส่วนใหญ่ได้ราคาพื้น 20%');
  assert.ok(Math.abs(w.catOf(p, 'animal') - Math.max(C.min, Math.pow(C.step, 3000))) < 1e-9, 'ความอิ่มตัวหมวดลดตามจำนวนชิ้นจริง');
  console.log('  ขายไข่ 100 ชิ้น: ชุดเดียว ' + batch + ' • ทยอยทีละชิ้น ' + singles + ' (ราคาฐานรวม ' + 100 * base + ') • 3,000 ชิ้น ได้ ' + got + ' • ตลาดหมวดหลังขายชุด 100 = ' + Math.round(catAfterBatch * 100) + '%');
  reset();
}
const w2 = new World('main');
assert.strictEqual(w2.projects.bridge.coin, 5000, 'bridge coin lost after reload');
assert.strictEqual(w2.projects.lighthouse.coin, 500, 'lighthouse coin lost after reload');
assert.strictEqual(w2.projects.bridge.donors.tester, 5000, 'donors lost after reload');
assert.strictEqual(crossable(w2.map), true, 'หลังรีสตาร์ตสะพานต้องยังอยู่');
// ทุกโครงการ: แปลงช่องตามที่ตั้งใจ เดินถึงได้/ตันตามกติกา ไม่ทับอาคารอื่น
const all = S.makeMap(); for (const P of S.PROJECTS) S.applyProject(all, P.id);
const T = S.T, walk = (x, y) => !S.blockedAt(all, x * S.TS + 16, y * S.TS + 16);
for (let y = S.LIGHTHOUSE.y0; y <= S.LIGHTHOUSE.y1; y++) for (let x = S.LIGHTHOUSE.x0; x <= S.LIGHTHOUSE.x1; x++) assert.strictEqual(all[y][x], T.LANDMARK, 'ประภาคารต้องเป็นช่องตัน');
for (let y = S.ISLAND.y0; y <= S.ISLAND.y1; y++) for (let x = S.ISLAND.x0; x <= S.ISLAND.x1; x++) assert.ok(walk(x, y), 'เกาะต้องเดินได้');
for (let x = S.ISLAND.x0; x <= S.BRIDGE.x0; x++) assert.ok(walk(x, S.ISLAND.walk.y), 'ต้องเดินจากสะพานขึ้นเกาะได้');
for (const r of [S.FESTIVAL.stage, ...S.FESTIVAL.tents]) for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) assert.strictEqual(all[y][x], T.LANDMARK, 'เวที/เต็นท์ต้องเป็นช่องตัน');
assert.ok(walk(S.FESTIVAL.plaza.x0, S.FESTIVAL.plaza.y1) && walk(S.FESTIVAL.plaza.x1, S.FESTIVAL.plaza.y0 + 3), 'ลานเทศกาลต้องเดินได้');
const orig = S.makeMap(); let changed = 0; for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (orig[y][x] !== all[y][x]) { changed++; assert.ok([T.WATER, T.GRASS, T.TREE, T.PATH].includes(orig[y][x]), `ทับช่องที่ไม่ควรทับที่ ${x},${y}`); }
console.log('  โครงการทั้ง 4 แปลงแมพ', changed, 'ช่อง');
console.log('✓ ผ่าน: ยอดโครงการอยู่ครบหลังโหลดใหม่ และสะพานเดินข้ามได้ทั้งตอนสร้างเสร็จและหลังรีสตาร์ต');
fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); process.exit(0);
