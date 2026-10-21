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
// ลิมิตการถือ / ตลาดหมวดฟื้นตอนออฟไลน์ / ใบสั่งซื้อ NPC
{
  const H = S.HOLD;
  assert.deepStrictEqual(['crop_carrot', 'egg', 'log', 'crop_tomato', 'fish_whale', 'crop_mango', 'fish_humpback', 'dish_feast', 'bait', 'coin', 'seed_carrot'].map(S.holdCap), [100, 100, 100, 40, 17, 11, 11, 10, 0, 0, 0], 'เพดานการถือตามมูลค่า (ไม่ใช่ของขาย = ไม่จำกัด)');
  for (const k of S.SELLABLE) { const c = S.holdCap(k); assert.ok(c >= H.min && c <= H.max, k + ' เพดานต้องอยู่ในช่วง'); }
  p.rec.inv.fish_whale = S.holdCap('fish_whale') - 1; assert.ok(!w.holdFull(p, 'fish_whale', 1) && w.holdFull(p, 'fish_whale', 2), 'ถือเกือบเต็ม: เพิ่ม 1 ได้ เพิ่ม 2 เกิน');
  p.rec.inv.fish_whale = S.holdCap('fish_whale'); assert.ok(w.holdFull(p, 'fish_whale', 1), 'ถือเต็มแล้วเพิ่มไม่ได้'); delete p.rec.inv.fish_whale;
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
// ตู้เก็บของ: ประดิษฐ์ ฝาก/ถอน ความจุตามมูลค่า ถอนไม่เกินเพดานการถือ
{
  const msgs = []; const oldToast = w.toast; w.toast = (pp, t2) => msgs.push(t2); w.nearShopKind = () => 'wood'; p.rec.skills = Object.assign({}, p.rec.skills, { wood: 1e6 });
  for (const k of ['storage_1', 'storage_2', 'storage_3']) assert.ok(S.CRAFT.find(r => r.id === k) && S.itemInfo(k).name, k + ' ต้องมีสูตรและข้อมูลไอเทม');
  assert.strictEqual(S.holdCap('storage_1'), 0, 'ตู้ไม่ใช่ของขาย ไม่จำกัดการถือ');
  p.rec.inv.plank = 100; p.rec.inv.log = 100; p.rec.inv.hardwood = 30; p.rec.inv.storage_1 = 0; delete p.rec.inv.storage_1;
  w.craft(p, 'storage_1'); assert.strictEqual(p.rec.inv.storage_1, 1, 'ประดิษฐ์ตู้ระดับ 1 สำเร็จ'); assert.strictEqual(p.rec.inv.plank, 88, 'ใช้วัตถุดิบตามสูตร');
  w.craft(p, 'storage_1'); assert.strictEqual(p.rec.inv.storage_1, 1, 'ทำระดับเดิมซ้ำไม่ได้'); assert.strictEqual(p.rec.inv.plank, 88, 'ไม่เสียวัตถุดิบตอนถูกปฏิเสธ');
  assert.strictEqual(S.stashTier(p.rec.inv), 1, 'ระดับตู้ที่มี');
  // ฝาก/ถอนต้องอยู่ใกล้ ATM
  p.x = 3 * 32; p.y = 3 * 32; p.rec.inv.egg = 300; w.stashHandle(p, { a: 'dep', item: 'egg', n: 'all' }); assert.strictEqual(p.rec.inv.egg, 300, 'ไกลตู้ ATM ฝากไม่ได้');
  p.x = (S.ATM.x + 0.5) * 32; p.y = (S.ATM.y + 0.5) * 32;
  const eggSell = S.itemInfo('egg').sell, capVal = S.STORAGE[1].cap, maxEggs = Math.floor(capVal / eggSell);
  w.stashHandle(p, { a: 'dep', item: 'egg', n: 'all' });
  assert.strictEqual(w.stashOf(p).egg, Math.min(300, maxEggs), 'ฝากได้ไม่เกินความจุตามมูลค่า'); assert.ok(S.stashValue(w.stashOf(p)) <= capVal, 'มูลค่าในตู้ไม่เกินความจุ'); assert.strictEqual(p.rec.inv.egg + w.stashOf(p).egg, 300, 'ของไม่หาย');
  w.stashHandle(p, { a: 'dep', item: 'bait', n: 5 }); assert.ok(!w.stashOf(p).bait, 'ของที่ไม่ใช่ของขายฝากไม่ได้');
  p.rec.inv.egg = 0; w.stashHandle(p, { a: 'wd', item: 'egg', n: 'all' }); assert.strictEqual(p.rec.inv.egg, Math.min(S.holdCap('egg'), maxEggs), 'ถอนได้ไม่เกินเพดานการถือ');
  w.stashHandle(p, { a: 'wd', item: 'egg', n: 'all' }); assert.strictEqual(p.rec.inv.egg, S.holdCap('egg'), 'ถือเต็มแล้วถอนเพิ่มไม่ได้');
  assert.ok(w.stashPub(p).t === 'stash' && w.stashPub(p).tier === 1 && w.stashPub(p).cap === capVal, 'ข้อมูลส่ง client');
  // ระดับสูงกว่าเปลี่ยนความจุ และทำระดับต่ำกว่าไม่ได้แล้ว
  w.craft(p, 'storage_2'); assert.strictEqual(S.stashTier(p.rec.inv), 2); w.craft(p, 'storage_1'); assert.strictEqual(p.rec.inv.storage_1, 1, 'มีระดับสูงกว่าแล้วต้องไม่ทำระดับต่ำซ้ำ (ไม่ถูกเพิ่ม)');
  assert.strictEqual(w.stashPub(p).cap, S.STORAGE[2].cap, 'ความจุตามระดับสูงสุด');
  console.log('  ตู้เก็บของ: ฝากไข่ ' + Math.min(300, maxEggs) + ' ฟอง (ความจุ 🪙' + capVal + ') • ถอนได้ไม่เกินเพดานถือ ' + S.holdCap('egg'));
  w.toast = oldToast; p.rec.inv.egg = 0; p.rec.stash = {};
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
