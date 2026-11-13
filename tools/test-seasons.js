// ทดสอบข้อจำกัดการปลูกตามฤดู: node tools/test-seasons.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-seasons-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, T = S.T, SE = S.SEASONS, CROPS = S.CROPS, K = S.TREE_KINDS;
const L = SE.days * 864e5, E = SE.epoch, mid = i => E + (i + 0.5) * L; // กลางฤดูที่ i (0 ร้อน 1 ฝน 2 หนาว 3 ร้อนอีกรอบ)
const ID = ['hot', 'rain', 'cool'];
const realNow = Date.now; let fake = null; Date.now = () => (fake == null ? realNow() : fake);
const at = t => { fake = t; };

// ---- ข้อมูล: lv>freeLv อยู่ฤดูเดียวพอดี • lv<=freeLv ไม่อยู่ในลิสต์ ----
for (const c of S.CROP_IDS()) {
  const n = SE.list.filter(x => x.crops.includes(c)).length;
  assert.strictEqual(n, CROPS[c].lv > SE.freeLv ? 1 : 0, `${c} อยู่ในลิสต์ฤดู ${n} ฤดู`);
}
for (const x of SE.list) for (const c of x.crops) assert.ok(CROPS[c] && !CROPS[c].legacy, 'crops ต้องเป็นพืชจริง ' + c);
assert.strictEqual(SE.inMul, 1.08); assert.strictEqual(SE.freeLv, 5);

// ---- canPlant / cropSeason ----
for (let i = 0; i < 6; i++) {
  const t = mid(i), cur = ID[i % 3];
  for (const c of Object.keys(CROPS)) {
    const C = CROPS[c], inSeason = SE.list.find(x => x.id === cur).crops.includes(c);
    if (C.legacy || C.lv <= SE.freeLv) { assert.ok(S.canPlant(c, t), `${c} ปลูกได้ทุกฤดู`); assert.strictEqual(S.cropSeason(c, t), 0, `${c} ไม่มีผลฤดู`); assert.strictEqual(S.plantWait(c, null, t), null); }
    else { assert.strictEqual(S.inSeason(c, t), inSeason, `${c} ฤดู ${cur}`); assert.ok(S.canPlant(c, t), `${c} ปลูกนอกฤดูได้แล้ว`); assert.strictEqual(S.cropSeason(c, t), inSeason ? 1 : -1); }
  }
}
assert.ok(S.inSeason('pumpkin', E - 1000), 'ก่อน epoch ปลูกได้หมด');
{ // plantWait: รอถึงต้นฤดูของพืช (ใช้ตอนสวิตช์ lockCrops เปิดกลับ — ค่าปกติปิด = ปลูกนอกฤดูได้ plantWait เป็น null)
  assert.strictEqual(SE.lockCrops, false); assert.strictEqual(S.plantWait('pumpkin', null, mid(0)), null, 'ค่าปกติ ปลูกนอกฤดูได้'); SE.lockCrops = true;
  let w = S.plantWait('pumpkin', null, mid(0)); assert.strictEqual(w.s.id, 'rain'); assert.strictEqual(w.ms, E + L - mid(0));
  w = S.plantWait('pumpkin', null, mid(2)); assert.strictEqual(w.s.id, 'rain'); assert.strictEqual(w.ms, E + 4 * L - mid(2), 'หนาว -> ร้อน -> ฝน');
  w = S.plantWait('strawberry', null, E + L + 5); assert.strictEqual(w.s.id, 'hot'); assert.strictEqual(w.ms, E + 3 * L - (E + L + 5));
  assert.strictEqual(S.canPlant('pumpkin', E + L + w.ms * 0), true); assert.strictEqual(S.canPlant('pumpkin', mid(0)), false, 'lockCrops เปิด = นอกฤดูปลูกไม่ได้'); SE.lockCrops = false;
  assert.strictEqual(S.seasonWaitText(36 * 3600e3 + 5), '1 วัน 12 ชม.'); assert.strictEqual(S.seasonWaitText(5 * 60e3), '5 นาที'); assert.strictEqual(S.seasonWaitText(2.5 * 3600e3), '2 ชม. 30 นาที'); assert.strictEqual(S.seasonWaitText(0), '1 นาที');
}
{ // ตารางเลเวล x ฤดู: Lv >= 3 ปลูกได้ >= 3 ชนิด และ >= 1 ชนิดที่ปลดล็อกทุกเลเวล
  for (let i = 0; i < 3; i++) for (let lv = 1; lv <= 20; lv++) {
    const n = S.CROP_IDS().filter(c => CROPS[c].lv <= lv && S.inSeason(c, mid(i))).length;
    assert.ok(n >= 1 && (lv < 3 || n >= 3), `Lv${lv} ฤดู ${ID[i]} ปลูกได้ ${n} ชนิด`);
  }
}
// lockCrops ปิด (ค่าปกติ) = ปลูกได้หมด
assert.ok(S.canPlant('pumpkin', mid(0)) && S.plantWait('pumpkin', null, mid(0)) === null);

// ---- ราคาเป้าตลาด: ในฤดู x1.08 • lv<=5 ไม่มีผล ----
{
  const w = new World('seasonmkt'), ws = { readyState: 1, send() {} }; w.join(ws, 'a', '#fff');
  for (const [i, c, mul] of [[0, 'strawberry', SE.inMul], [1, 'strawberry', SE.outMul], [0, 'carrot', 1], [2, 'carrot', 1]]) {
    const now = mid(i) + 7 * 864e5 * 0; w.mktDay = -1; w.marketTick(Math.floor(now / S.DAY_MS) * S.DAY_MS + 1000 + (now % S.DAY_MS));
    const t = w.market['crop_' + c].t; if (t === 1.35 || t === 0.7) continue; /* ข่าวตลาดสุ่มทับราคาเป้าของสินค้า 1 ชิ้น/ตก 1 ชิ้นต่อวัน ข้ามรอบนี้ (เคยทำให้เทสต์สุ่มล้ม) */ assert.ok(t / mul >= 0.74 && t / mul <= 1.36, `ราคาเป้า ${c} ฤดู ${ID[i]} = ${t} (mul ${mul})`);
  }
}

// ---- ปลูกจริงผ่าน act(): นอกฤดูปฏิเสธไม่หักเมล็ด ----
{
  const w = new World('seasonplant'), ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }, p = w.join(ws, 'farmer', '#fff').p;
  p.rec.starter = { done: {}, final: true }; p.rec.skills = { farm: 1e7, fish: 0, animal: 0, wood: 0, cook: 0, mine: 0 }; p.rec.hunger = 100;
  p.rec.inv = { coin: 100, seed_pumpkin: 3, seed_strawberry: 3, seed_carrot: 3, seed_potato: 3, can_3: 1 };
  for (const k of Object.keys(S.CANS)) if (S.CANS[k].price !== undefined) p.rec.inv['can_' + k] = 1;
  const inv = p.rec.inv, toasts = () => ws.msgs.filter(m => m.t === 'msg').map(m => m.text), last = () => toasts().pop() || '';
  let spot = null; for (let y = 5; y < S.H - 5 && !spot; y++) for (let x = 5; x < S.W - 5 && !spot; x++) if (w.map[y][x] === T.GRASS && !w.farm[x + ',' + y]) spot = [x, y];
  let n = 0;
  const plant = (seed, t) => { at(t); const [x, y] = [spot[0] + n++, spot[1]]; w.map[y][x] = T.GRASS; w.farm[x + ',' + y] = { wu: 0 }; p.x = (x + 0.5) * TS; p.y = (y + 1.5) * TS; w.act(p, seed, t, x, y); return w.farm[x + ',' + y]; };
  w.rentBlock = () => null; w.exhausted = () => false;
  let tile = plant('seed_pumpkin', mid(0)); assert.strictEqual(tile.c, 'pumpkin', 'ฟักทองฤดูร้อนปลูกนอกฤดูได้'); assert.strictEqual(inv.seed_pumpkin, 2, 'หักเมล็ด'); assert.strictEqual(tile.os, 1, 'ติดธงนอกฤดู');
  assert.ok(/นอกฤดู/.test(last()) && /ไม่ติดผล/.test(last()), 'ข้อความเตือนปลูกนอกฤดู: ' + last());
  assert.strictEqual(w.pub(tile, Date.now()).os, 1, 'pub มี os'); inv.seed_pumpkin = 3;
  tile = plant('seed_strawberry', mid(0)); assert.strictEqual(tile.c, 'strawberry', 'สตรอว์เบอร์รีฤดูร้อนปลูกได้'); assert.ok(!tile.os && !('os' in w.pub(tile, Date.now())), 'ในฤดูไม่มีธง'); assert.strictEqual(inv.seed_strawberry, 2);
  tile = plant('seed_pumpkin', mid(1)); assert.strictEqual(tile.c, 'pumpkin', 'ฟักทองฤดูฝนปลูกได้'); assert.strictEqual(inv.seed_pumpkin, 2); assert.ok(!tile.os);
  for (let i = 0; i < 3; i++) { tile = plant('seed_carrot', mid(i)); assert.strictEqual(tile.c, 'carrot', 'แครอท lv<=5 ปลูกได้ทุกฤดู'); }
  tile = plant('seed_potato', mid(2)); assert.strictEqual(tile.c, 'potato', 'พืช legacy ปลูกได้ทุกฤดู');
  // พืชค้างข้ามฤดู: โตเท่าเดิม (ไม่ช้าลง)
  const key = Object.keys(w.farm).filter(k => w.farm[k].c === 'pumpkin' && !w.farm[k].os)[0], pt = w.farm[key];
  const now = mid(2), dt = 10000; pt.g = 0; pt.m = 1; pt.wu = now + 1e9; // ตอนนี้ฤดูหนาว ฟักทองเป็นพืชนอกฤดู (ปลูกค้างมาตั้งแต่ฤดูฝน)
  at(now); w.lastCrop = now - dt; w.cropTick(now);
  assert.ok(Math.abs(pt.g - dt) < 1e-6, `พืชนอกฤดูโตต่อปกติ ไม่ช้าลง (โตได้ ${pt.g} ต่อ ${dt})`);
  // ซื้อเมล็ดนอกฤดู: ซื้อได้ + เตือน
  const [cx, cy] = S.BUILDINGS.find(b => b.kind === 'farm').counter[0]; p.x = (cx + 0.5) * TS; p.y = (cy + 0.5) * TS; inv.coin = 5000; at(mid(0));
  const c0 = inv.seed_melon || 0; w.handle(p, { t: 'buy', item: 'seed_melon', n: 1 });
  assert.strictEqual(inv.seed_melon || 0, c0 + 1, 'ซื้อเมล็ดนอกฤดูได้'); assert.ok(/นอกฤดู.*ติดผลน้อย.*ฤดูฝน/.test(last()), 'เตือนฤดู: ' + last());
  w.handle(p, { t: 'buy', item: 'seed_strawberry', n: 1 }); assert.ok(!/นอกฤดู/.test(last()), 'ในฤดูไม่เตือน');
  w.handle(p, { t: 'buy', item: 'seed_carrot', n: 1 }); assert.ok(!/นอกฤดู/.test(last()));
}

// ---- เก็บเกี่ยวพืชนอกฤดู: ลุ้นติดผล ไม่ติด = เมล็ดคืน + XP ลด • ในฤดูเหมือนเดิม ----
{
  const OS = S.OFFSEASON, w = new World('offseason'), ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }, p = w.join(ws, 'farmer2', '#fff').p;
  p.rec.starter = { done: {}, final: true }; p.rec.hunger = 100; p.rec.skills = { farm: 1, fish: 0, animal: 0, wood: 0, cook: 0, mine: 0 };
  assert.ok(OS.chance >= 0.3 && OS.chance <= 0.5, 'ผลผลิตคาดหวัง 30-50%');
  assert.ok((1 - OS.chance) * (OS.seedMin + OS.seedMax) / 2 < 1, 'เมล็ดคืนเฉลี่ย < 1 เม็ดต่อเม็ดที่ปลูก (ไม่ปั๊มเมล็ดฟรี)');
  w.rentAt = () => null; w.cropLocked = () => false; w.exhausted = () => false; w.tire = () => {};
  let spot = null; for (let y = 5; y < S.H - 5 && !spot; y++) for (let x = 5; x < S.W - 5 && !spot; x++) if (w.map[y][x] === T.GRASS && !w.farm[x + ',' + y]) spot = [x, y];
  const [x, y] = spot, k = x + ',' + y; p.x = (x + 0.5) * TS; p.y = (y + 1.5) * TS; p.dir = 1;
  const harvest = os => { p.rec.inv.crop_pumpkin = 0; p.rec.inv.seed_pumpkin = 0; w.farm[k] = { c: 'pumpkin', g: CROPS.pumpkin.time, m: 1, o: p.key, on: p.name, rm: 0, ...(os ? { os: 1 } : {}) }; const xp0 = p.rec.skills.farm; w.act(p, 'hand', x, y, x, y); return { crop: p.rec.inv.crop_pumpkin || 0, seed: p.rec.inv.seed_pumpkin || 0, xp: p.rec.skills.farm - xp0, tile: w.farm[k] }; };
  p.rec.skills.farm = 0; const rn = Math.random; try {
    Math.random = () => 0.1; let r = harvest(true); assert.strictEqual(r.crop, 1, 'ติดผล = ผลผลิตปกติ'); assert.strictEqual(r.seed, 0); assert.ok(!('os' in r.tile) && !r.tile.c, 'ล้างธง os');
    Math.random = () => 0.9; r = harvest(true); assert.strictEqual(r.crop, 0, 'ไม่ติดผล = ไม่มีผลผลิต'); assert.ok(r.seed >= OS.seedMin && r.seed <= OS.seedMax, 'ได้เมล็ดคืน ' + r.seed); assert.ok(!r.tile.c && !('os' in r.tile));
    assert.ok(/ไม่ติดผล/.test(ws.msgs.filter(m => m.t === 'msg').pop().text), 'ข้อความไม่ติดผล');
    Math.random = () => 0.9; r = harvest(false); assert.strictEqual(r.crop, 1, 'ในฤดู (ไม่มีธง) ได้ผลผลิตเสมอ'); assert.strictEqual(r.seed, 0);
  } finally { Math.random = rn; }
  // สถิติ: ผลผลิตคาดหวังและเมล็ดคืนเฉลี่ย
  let cr = 0, sd = 0, xs = 0; const N = 6000; for (let i = 0; i < N; i++) { const r = harvest(true); cr += r.crop; sd += r.seed; xs += r.xp; }
  const full = CROPS.pumpkin.xp; console.log(`นอกฤดู: ผลผลิตเฉลี่ย ${(cr / N * 100).toFixed(1)}% • เมล็ดคืนเฉลี่ย ${(sd / N).toFixed(2)}/เม็ด • XP เฉลี่ย ${(xs / N / full * 100).toFixed(0)}% ของปกติ`);
  assert.ok(cr / N >= 0.3 && cr / N <= 0.5, 'ผลผลิตเฉลี่ยในช่อง 30-50%'); assert.ok(sd / N < 1, 'เมล็ดคืนเฉลี่ย < 1');
}

// ---- ใบงาน NPC: ไม่ขอพืชที่ปลูกไม่ได้ในฤดูนั้น ----
for (let i = 0; i < 3; i++) {
  at(mid(i)); const w = new World('seasonord' + i), ws = { readyState: 1, send() {} }; w.join(ws, 'a', '#fff');
  for (let r = 0; r < 60; r++) { w.orders = { day: -1, list: [], by: {} }; for (const o of w.ordersRoll().list) for (const [k] of o.need) if (k.startsWith('crop_')) assert.ok(S.inSeason(k.slice(5), mid(i)), `ใบงานขอ ${k} ในฤดู ${ID[i]}`); }
}

// ---- ต้นไม้ ----
{
  const own = new Set(SE.list.flatMap(x => x.trees)); assert.strictEqual(own.size, 9);
  for (const id of own) assert.ok(K[id], 'ชนิดต้นไม้ในฤดูต้องมีใน TREE_KINDS ' + id);
  for (let i = 0; i < 3; i++) {
    const t = mid(i);
    for (const id of Object.keys(K)) { const o = SE.list.find(x => x.trees.includes(id)); assert.strictEqual(S.canSpawnTree(id, t), !o || o.id === ID[i], `canSpawnTree ${id} ${ID[i]}`); }
    for (let a = 1; a <= S.AXE_MAX; a++) assert.ok(Object.keys(K).some(id => K[id].axe === a && !own.has(id)), `ขวานขั้น ${a} ต้องมีต้นทุกฤดูให้ตัด`);
    const tot = Object.keys(K).filter(id => S.canSpawnTree(id, t)).reduce((a, id) => a + S.treeQuota(id, S.TREE.cap, t), 0); assert.ok(tot >= S.TREE.cap, `ผลรวมโควตาในฤดู ${tot} < ${S.TREE.cap}`);
  }
  // spawn ส่ง t: ไม่คืนชนิดนอกฤดู
  const m = new World('treeseason').map, spots = []; for (let y = 2; y < S.H - 2; y++) for (let x = 2; x < S.W - 2; x++) if (S.treeSpotOk(m, x, y)) spots.push([x, y]);
  const rng = S.rng(99); for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; } spots.length = Math.min(spots.length, 150); // ลดจำนวนช่องให้เทสต์เร็ว
  for (let i = 0; i < 3; i++) for (let r = 0; r < 400; r++) { const p = S.pickTreeSpawn(m, rng, spots, null, S.TREE.cap, mid(i)); if (p && !p.skip) assert.ok(S.canSpawnTree(p.k, mid(i)), `งอก ${p.k} นอกฤดู ${ID[i]}`); }
  // ไม่ส่ง t = พฤติกรรมเดิม (งอกได้ทุกชนิด)
  const seen = new Set(); for (let r = 0; r < 1500; r++) { const p = S.pickTreeSpawn(m, rng, spots); if (p) seen.add(p.k); } assert.ok(seen.has('maple') || seen.has('sakura') || seen.has('bamboo'));
  // lockTrees ปิด
  SE.lockTrees = false; assert.ok(S.canSpawnTree('sakura', mid(0))); SE.lockTrees = true;
  // trim: ต้นนอกฤดูไม่ถูกถอนถ้าไม่เกินโควตาปกติ
  assert.strictEqual(S.pickTreeTrim([[1, 1, 'sakura']], S.TREE.cap, rng, null, mid(0)), null);
}
// จำลองเต็มระบบ: ข้ามฤดู ต้นเดิมไม่ถูกถอน แมพเติมถึงเพดาน
{
  const w = new World('treesim'), ws = { readyState: 1, send() {} }, pl = w.join(ws, 'alice', '#fff').p; w.treeCap = S.TREE.cap; S.TREE.growMs = 1000;
  const sim = (i, steps) => { for (let s = 0; s < steps; s++) { pl.x = pl.y = 5; const t = mid(i) + s * 1000; at(t); w.tick(1, t); } };
  sim(0, 400);
  const n0 = w.treeList().length; assert.ok(n0 >= S.TREE.cap - 2, `ฤดูร้อนแมพเต็ม ${n0}/${S.TREE.cap}`);
  const mapleBefore = w.treeList().filter(t => t[2] === 'maple').length;
  sim(2, 400);
  const tl = w.treeList(); assert.ok(tl.length >= S.TREE.cap - 2, `ฤดูหนาวแมพเต็ม ${tl.length}`);
  assert.ok(tl.every(t => K[t[2]]), 'ทุกต้นมีชนิดถูกต้อง');
  const q = id => S.treeQuota(id, S.TREE.cap, mid(2)); for (const id of Object.keys(K)) assert.ok(tl.filter(t => t[2] === id).length <= q(id) + 1, `ชนิด ${id} เกินโควตา`);
  assert.ok(mapleBefore <= S.treeQuota('maple', S.TREE.cap) + 1);
  const ck = {}; for (const t of tl) ck[t[2]] = 1; assert.ok(Object.keys(ck).length >= 8, 'ชนิดต้นไม้หลากหลาย');
  for (let a = 1; a <= S.AXE_MAX; a++) assert.ok(tl.some(t => K[t[2]].axe === a), `ขวานขั้น ${a} มีต้นให้ตัดบนแมพจริง`);
}
Date.now = realNow;
console.log('ผ่าน test-seasons');
process.exit(0);
