// ทดสอบอุปกรณ์ 10 ระดับ (WP-23) ผ่านข้อความและ World จริง: จอบ (โบนัสเก็บเกี่ยว/สึก/พังไม่บล็อก) • ตะกร้า-ถัง (ผลผลิตสัตว์ของตัวเอง) •
// กระทะ (ค่าเตา/สึก/พัง = 0.3) • ซื้อระดับ ≤ ที่ถือถูกปฏิเสธ • ขายคืนตามสภาพ (70% × ทนเหลือ ÷ ทนเต็ม ต่ำสุด 10%)
// รัน: node tools/test-gear-play.js (DATA_DIR ชั่วคราว ไม่แตะ data/)
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-gearplay-');
let NOW = Date.now(); Date.now = () => NOW; // เวลาปลอมเดินเอง (พ้น cooldown ของ act)
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, G = S.GEAR_TUNE;

const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('gearplay');
w.themeRain = () => 'off';
let seq = 0;
function mk(inv) { // ผู้เล่นใหม่ ยืนที่ตำแหน่งกลางๆ
  const ws = mkWs(), p = w.join(ws, 'gp' + (++seq), '#fff').p; p.ws2 = ws;
  p.rec.inv = Object.assign({ coin: 100000 }, inv); p.rec.hunger = 100; p.rec.skills = { farm: 1e9, fish: 0, animal: 1e9, wood: 0, cook: 1e9, mine: 0 }; p.rec.starter = { done: {}, final: true }; p.rec.dur = {}; p.rec.fix = {};
  return p;
}
const toasts = p => p.ws2.msgs.filter(m => m.t === 'msg').map(m => m.text), lastToast = p => toasts(p).pop() || '';
const withRand = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };
const act = (p, tool, tx, ty) => { NOW += 1000; w.handle(p, { t: 'act', tool, tx, ty }); };
const at = (p, x, y, dir) => { p.x = (x + 0.5) * TS; p.y = (y + 0.5) * TS; p.dir = dir; };
const shopPos = (p, kind) => { const [cx, cy] = S.BUILDINGS.find(b => b.kind === kind).counter[0]; at(p, cx, cy, 0); };
const have = (p, k) => p.rec.inv[k] || 0;

// ช่องในแปลงผัก: เลือกช่องหญ้าที่ไม่ใช่แปลงเช่า (y ≥ 14) และไม่ถูกใช้
const FARM = S.FARM, cells = [];
for (let y = FARM.y0; y <= FARM.y1; y++) for (let x = FARM.x0; x <= FARM.x1; x++) if (y >= 14 && w.map[y][x] === S.T.GRASS && !w.farm[x + ',' + y]) cells.push([x, y]);
assert.ok(cells.length >= 20, 'ต้องมีช่องหญ้าในแปลงผัก');
let ci = 0;
function ripe(cropId) { const [x, y] = cells[ci++], k = x + ',' + y; w.farm[k] = { c: cropId, g: S.CROPS[cropId].time, m: 0 }; return { x, y, k }; }
const harvest = (p, cell, rand) => { at(p, cell.x, cell.y + 1, 1); return withRand(rand, () => act(p, 'hand', cell.x, cell.y)); };
const lowCrop = Object.keys(S.CROPS).find(c => S.cropTier(S.CROPS[c]) === 1), hiCrop = Object.keys(S.CROPS).find(c => S.cropTier(S.CROPS[c]) === 2);
assert.ok(lowCrop && hiCrop);
const base = G.hoe.base;

// ===== (1) จอบ: เก็บเกี่ยว =====
{
  // สุ่มติด (0) → ได้ +1 และจอบสึก • สุ่มไม่ติด (0.999) → ได้ 1 ชิ้น แต่จอบก็ยังสึก
  const p = mk({}), d0 = w.durCur(p, 'hoe'); assert.strictEqual(d0, S.DURABILITY.hoe.max[1]);
  let c = ripe(lowCrop); harvest(p, c, 0);
  assert.strictEqual(have(p, 'crop_' + lowCrop), 2, 'จอบฟรี + พืชระดับ 1 + สุ่มติด = 2 ชิ้น'); assert.ok(toasts(p).some(t => /จอบดี/.test(t)), 'มีข้อความโบนัส'); assert.ok(!w.farm[c.k].c, 'ต้นถูกเก็บแล้ว');
  assert.ok(w.durCur(p, 'hoe') < d0, 'ติดโบนัสแล้วจอบสึก'); const d1 = w.durCur(p, 'hoe');
  c = ripe(lowCrop); harvest(p, c, 0.999); assert.strictEqual(have(p, 'crop_' + lowCrop), 3, 'สุ่มไม่ติด +1 ชิ้นเท่านั้น'); assert.ok(w.durCur(p, 'hoe') < d1, 'ไม่ติดโบนัสก็ยังสึก (wear > 0)');
  // ขอบเขตโอกาส: สุ่มต่ำกว่า base ติด สูงกว่าไม่ติด
  const q = mk({}); c = ripe(lowCrop); harvest(q, c, base - 1e-6); assert.strictEqual(have(q, 'crop_' + lowCrop), 2, 'สุ่ม < base ติด');
  c = ripe(lowCrop); harvest(q, c, base + 1e-6); assert.strictEqual(have(q, 'crop_' + lowCrop), 3, 'สุ่ม > base ไม่ติด');
}
{
  // สึกตามตั๋ว: ระดับ ≥ พืช สึกต่อครั้ง = gearHit.wear (1 ครั้ง durUse) • จอบต่ำกว่าพืชเกิน 0 ระดับ (d<0) = ไม่มีโบนัส ไม่สึก ไม่มีข้อความ dur
  const p = mk({}); let c = ripe(hiCrop); p.ws2.msgs.length = 0; const d0 = w.durCur(p, 'hoe'); harvest(p, c, 0);
  assert.strictEqual(S.hoeHit(p.rec.inv, S.CROPS[hiCrop]).bonus, 0); assert.strictEqual(have(p, 'crop_' + hiCrop), 1, 'จอบต่ำกว่าพืช 1 ระดับ ไม่มีโบนัสแม้สุ่ม 0'); assert.strictEqual(w.durCur(p, 'hoe'), d0, 'ไม่มีโบนัสต้องไม่สึก'); assert.ok(!p.ws2.msgs.some(m => m.t === 'dur'), 'ไม่ส่ง dur'); assert.ok(!toasts(p).some(t => /จอบดี/.test(t)));
  // จอบตรงระดับพืช (hoe_2 กับพืชระดับ 2) ติดโบนัสและสึก
  const q = mk({ hoe_2: 1 }); c = ripe(hiCrop); const e0 = w.durCur(q, 'hoe'); assert.strictEqual(e0, S.DURABILITY.hoe.max[2]); harvest(q, c, 0); assert.strictEqual(have(q, 'crop_' + hiCrop), 2); assert.ok(w.durCur(q, 'hoe') < e0, 'hoe_2 สึก');
  // จอบสูงสุด (10) ได้โอกาสเท่าพื้น (over = 0: อัปแล้วไม่ลด) กับพืชระดับต่ำ
  const r = mk({ hoe_10: 1 }); c = ripe(lowCrop); harvest(r, c, base - 1e-6); assert.strictEqual(have(r, 'crop_' + lowCrop), 2, 'hoe_10 ยังได้โบนัสกับพืชระดับต่ำ (ไม่ลดเมื่ออัป)'); c = ripe(lowCrop); harvest(r, c, base + 1e-6); assert.strictEqual(have(r, 'crop_' + lowCrop), 3);
  assert.ok(S.hoeBonus(r.rec.inv, S.CROPS[lowCrop]) >= S.hoeBonus({}, S.CROPS[lowCrop]), 'อัปแล้วโบนัสไม่ต่ำกว่าจอบฟรี');
}
{
  // จอบพัง: ยังเก็บเกี่ยวได้ ไม่บล็อก แต่ไม่ได้โบนัสและไม่สึกต่อ • ขุดดินใหม่ไม่ได้ (durOk เดิม)
  const p = mk({}); p.rec.dur.hoe = 0; assert.strictEqual(w.durCur(p, 'hoe'), 0); const c = ripe(lowCrop); p.ws2.msgs.length = 0; harvest(p, c, 0);
  assert.strictEqual(have(p, 'crop_' + lowCrop), 1, 'จอบพัง เก็บได้ 1 ชิ้น (ไม่บล็อก ไม่โบนัส)'); assert.ok(!w.farm[c.k].c, 'เก็บสำเร็จ'); assert.strictEqual(w.durCur(p, 'hoe'), 0); assert.ok(!toasts(p).some(t => /จอบดี/.test(t)));
  assert.ok(!p.ws2.msgs.some(m => m.t === 'dur'), 'จอบพังไม่ส่ง dur ตอนเก็บเกี่ยว');  const [x, y] = cells[ci++]; at(p, x, y + 1, 1); act(p, 'hoe', x, y); assert.ok(!w.farm[x + ',' + y], 'จอบพังขุดดินไม่ได้'); assert.ok(/พัง/.test(lastToast(p)), 'ต้องแจ้งว่าพัง: ' + lastToast(p));
  // ซ่อมแล้วโบนัสกลับมา
  shopPos(p, 'farm'); p.rec.inv.coin = 99999; w.handle(p, { t: 'repair', tool: 'hoe' }); assert.ok(w.durCur(p, 'hoe') > 0, 'ซ่อมแล้วจอบใช้ได้'); const c2 = ripe(lowCrop); const n0 = have(p, 'crop_' + lowCrop); harvest(p, c2, 0); assert.strictEqual(have(p, 'crop_' + lowCrop), n0 + 2);
}
{
  // ต้นของคนอื่นที่ยังล็อก เก็บไม่ได้ → ไม่เสียจอบ ไม่ได้โบนัส (ตรวจว่าโบนัสอยู่หลังด่านล็อก)
  const p = mk({}), q = mk({}), c = ripe(lowCrop); w.farm[c.k].o = q.key; w.farm[c.k].on = q.name; w.farm[c.k].rm = 0; const d0 = w.durCur(p, 'hoe'); harvest(p, c, 0);
  assert.strictEqual(have(p, 'crop_' + lowCrop), 0); assert.ok(w.farm[c.k].c, 'ต้นยังอยู่'); assert.strictEqual(w.durCur(p, 'hoe'), d0);
  harvest(q, c, 0); assert.strictEqual(have(q, 'crop_' + lowCrop), 2, 'เจ้าของเก็บได้พร้อมโบนัส');
}
console.log('  จอบ: โบนัสเก็บเกี่ยว (สุ่ม stub) • สึกตามระดับ • พังไม่บล็อกการเก็บ • ขุดต้องใช้จอบที่ไม่พัง');

// ===== (2) ตะกร้า/ถัง =====
{
  const hen = (p, opt) => { const a = w.spawnAnimal('chicken', p); a.x = p.x; a.y = p.y; a.prod = true; a.fed = false; a.feeder = (opt && opt.feeder !== undefined) ? opt.feeder : p.key; a.fn = a.feeder ? 'x' : ''; a.pm = (opt && opt.pm) || 0; return a; };
  const collect = (p, rand) => { p.rec.inv.egg = 0; at(p, 47, 12, 0); withRand(rand, () => act(p, 'hand')); return have(p, 'egg'); };
  const A = S.ANIMALS.chicken, full = S.DURABILITY.pail.max[1];
  // ของตัวเอง: สุ่มต่ำกว่าความน่าจะเป็น → 2 ฟอง • สูง → 1 ฟอง • ถังสึกทุกครั้งที่เก็บ
  const p = mk({}); p.scene = null; at(p, 47, 12, 0); hen(p); const cMine = S.pailChance(p.rec.inv, A);
  assert.strictEqual(w.durCur(p, 'pail'), full); assert.strictEqual(collect(p, cMine - 1e-6), 2, 'ของตัวเอง สุ่มติด = 2 ฟอง'); assert.ok(w.durCur(p, 'pail') < full, 'ถังสึก'); const d1 = w.durCur(p, 'pail');
  hen(p); assert.strictEqual(collect(p, cMine + 1e-6), 1, 'ของตัวเอง สุ่มไม่ติด = 1 ฟอง'); assert.ok(w.durCur(p, 'pail') < d1, 'เก็บแล้วสึกแม้ไม่ติดโบนัส');
  // ตะกร้าฟรี (0.406) ต้องดีกว่าพื้น 0.25: สุ่ม 0.3 ได้ 2 ฟอง
  hen(p); assert.strictEqual(collect(p, S.ANIMAL_BONUS + 0.05), 2, 'ตะกร้าใช้งานได้ ช่วงระหว่าง 0.25–0.406 ได้ผลงาม');
  // ถังพัง = ค่าเดิมเท่าก่อนมีระบบ (0.25) ไม่สึกอีก ไม่บล็อก
  const q = mk({}); at(q, 47, 12, 0); q.rec.dur.pail = 0; hen(q); assert.strictEqual(collect(q, S.ANIMAL_BONUS + 0.05), 1, 'ถังพัง: 0.3 ไม่ติด (พื้น 0.25)'); hen(q); assert.strictEqual(collect(q, S.ANIMAL_BONUS - 1e-6), 2, 'ถังพัง: ต่ำกว่า 0.25 ยังติด = เท่าเดิมไม่ได้แย่ลง'); assert.strictEqual(w.durCur(q, 'pail'), 0, 'พังแล้วไม่สึกต่อ');
  assert.ok(!q.ws2.msgs.some(m => m.t === 'dur'), 'ถังพังไม่ส่ง dur');
  // ถังสูงสุด (pail_10) ไม่ได้แย่กว่าตะกร้าฟรีกับไก่ และไม่เกิน max
  const r = mk({ pail_10: 1 }); at(r, 47, 12, 0); hen(r); const cr = S.pailChance(r.rec.inv, A); assert.ok(cr >= cMine - 1e-12 && cr <= G.pail.max); assert.strictEqual(collect(r, cr - 1e-6), 2);
  // ของคนอื่น (เลยเวลา 1 วัน เก็บได้): ไม่ได้โบนัส ไม่สึกถัง แม้สุ่ม 0
  const o = mk({}), s = mk({}); at(s, 47, 12, 0); hen(s, { feeder: o.key, pm: S.DAY_MS }); const d0 = w.durCur(s, 'pail'); assert.strictEqual(collect(s, 0), 1, 'ของคนอื่น = 1 ฟองเสมอ'); assert.strictEqual(w.durCur(s, 'pail'), d0, 'ของคนอื่น ถังไม่สึก');
  // ของคนอื่นที่ยังไม่ครบ 1 วัน ถูกล็อก เก็บไม่ได้
  const l = mk({}); at(l, 47, 12, 0); hen(l, { feeder: o.key, pm: 0 }); assert.strictEqual(collect(l, 0), 0, 'ยังล็อกอยู่'); assert.ok(/ผลผลิตนี้เป็นของ/.test(lastToast(l)));
  // สัตว์ที่ไม่มีใครป้อน (feeder ว่าง): ไม่นับว่าเลี้ยงเอง ไม่ได้โบนัส
  const n = mk({}); at(n, 47, 12, 0); hen(n, { feeder: '' }); assert.strictEqual(collect(n, 0), 1, 'ไม่มีผู้ป้อน = ไม่ได้โบนัสตะกร้า');
  for (const x of w.animals.filter(a => a.type === 'chicken' && a.prod)) x.prod = false;
  console.log('  ตะกร้า/ถัง: สัตว์ตัวเองสุ่มโบนัสและสึก • พัง = 0.25 เดิม • ของคนอื่นไม่ได้/ไม่สึก • ล็อก 1 วันยังอยู่');
}

// ===== (3) กระทะ =====
{
  const r1 = S.COOK.find(x => x.lv === 1 && x.in.every(i => i.k)), r2 = S.COOK.find(x => S.cookTier(x) === 2 && x.in.every(i => i.k));
  assert.ok(r1 && r2, 'ต้องมีสูตรระดับ 1 และ 2 ที่ใช้ของเจาะจง');
  const cookP = (p, r) => { for (const i of r.in) p.rec.inv[i.k] = 99; shopPos(p, 'food'); p.cookReady = 0; const d0 = w.durCur(p, 'pan'), tp = w.toPot; let paid = 0; w.toPot = n => { paid += n; return tp.call(w, n); }; p.ws2.msgs.length = 0; w.handle(p, { t: 'cook', id: r.id }); w.toPot = tp; return { paid, dur0: d0, made: have(p, r.id) }; }; // ค่าเตาทั้งหมดเข้ากองกลาง (toPot) วัดจากตรงนี้ (เหรียญผู้เล่นปนรางวัลคู่มือ)
  // กระทะฟรี (หม้อดิน) กับสูตรระดับ 1: ค่าเตาลด + กระทะสึก
  const p = mk({}); let o = cookP(p, r1); const f1 = Math.round(r1.sell * S.panFee(r1, 1, true));
  assert.strictEqual(o.made, 1); assert.strictEqual(o.paid, f1, 'ค่าเตาลดตาม panFee'); assert.ok(f1 < Math.round(r1.sell * S.COOK_FEE), 'ค่าเตาลดลงจริง'); assert.ok(w.durCur(p, 'pan') < o.dur0, 'กระทะสึก'); assert.ok(toasts(p).some(t => /กระทะช่วยลด/.test(t)), 'toast บอกค่าเตาที่ลด');
  // กระทะต่ำกว่าสูตร 1 ระดับ: ไม่ลด ไม่สึก (ค่าเตา 0.3)
  const q = mk({}); o = cookP(q, r2); assert.strictEqual(o.made, 1); assert.strictEqual(o.paid, Math.round(r2.sell * S.COOK_FEE), 'กระทะต่ำกว่าสูตร = ค่าเตา 0.3 เท่าเดิม'); assert.strictEqual(w.durCur(q, 'pan'), o.dur0, 'ไม่ได้ลดค่าเตา = ไม่สึก');
  // กระทะตรงระดับสูตร (pan_2) ลดและสึก
  const t = mk({ pan_2: 1 }); o = cookP(t, r2); assert.strictEqual(o.paid, Math.round(r2.sell * S.panFee(r2, 2, true))); assert.ok(o.paid < Math.round(r2.sell * S.COOK_FEE)); assert.ok(w.durCur(t, 'pan') < o.dur0);
  // กระทะพัง: ค่าเตา 0.3 เท่าเดิม ยังทำอาหารได้ ไม่สึกต่อ
  const b = mk({}); b.rec.dur.pan = 0; o = cookP(b, r1); assert.strictEqual(o.made, 1, 'กระทะพังยังทำอาหารได้'); assert.strictEqual(o.paid, Math.round(r1.sell * 0.3), 'กระทะพัง = ค่าเตา 0.3'); assert.strictEqual(w.durCur(b, 'pan'), 0); assert.ok(!toasts(b).some(x => /กระทะช่วยลด/.test(x)));
  // ค่าเตาไม่ต่ำกว่า minFee แม้กระทะสูงสุด และเหรียญไม่พอค่าเตา = ไม่ทำ ไม่สึก
  const h = mk({ pan_10: 1 }); o = cookP(h, r1); assert.ok(o.paid >= Math.round(r1.sell * G.pan.minFee)); assert.ok(o.paid <= Math.round(r1.sell * S.COOK_FEE), 'กระทะสูงสุดไม่แพงกว่าเดิม');
  const poor = mk({}); poor.rec.inv.coin = 0; for (const i of r1.in) poor.rec.inv[i.k] = 9; shopPos(poor, 'food'); poor.cookReady = 0; const dp = w.durCur(poor, 'pan'); w.handle(poor, { t: 'cook', id: r1.id }); assert.strictEqual(have(poor, r1.id), 0, 'ไม่มีเหรียญ ทำไม่ได้'); assert.strictEqual(w.durCur(poor, 'pan'), dp, 'ทำไม่สำเร็จ = ไม่สึก'); assert.ok(/ค่าเช่าเตา/.test(lastToast(poor)));
  console.log('  กระทะ: ลดค่าเตาแล้วสึก • ต่ำกว่าสูตรไม่ลดไม่สึก • พัง = 0.3 • เหรียญไม่พอไม่สึก');
}

// ===== (4) ซื้อ: ระดับ ≤ ที่ถือถูกปฏิเสธ (รวมบัว) • ซื้อสูงกว่ารีเซ็ตความทน =====
{
  const SH = { hoe: 'farm', can: 'farm', pail: 'animal', pan: 'food' }, PR = { hoe: S.HOES, pail: S.PAILS, pan: S.PANS };
  const price = (tool, t) => tool === 'can' ? S.CANS[t].price : PR[tool][t].price;
  for (const tool of ['hoe', 'can', 'pail', 'pan']) {
    const p = mk({}); shopPos(p, SH[tool]);
    const buy = t => { const c0 = have(p, 'coin'); w.handle(p, { t: 'buy', item: `${tool}_${t}`, n: 1 }); return c0 - have(p, 'coin'); };
    assert.strictEqual(buy(3), price(tool, 3), `${tool}_3 ซื้อได้ในราคาตาราง`); assert.strictEqual(have(p, `${tool}_3`), 1);
    for (const t of [2, 3]) { assert.strictEqual(buy(t), 0, `${tool}_${t} ระดับ ≤ ที่ถือ (3) ซื้อไม่ได้`); assert.strictEqual(have(p, `${tool}_${t}`), t === 3 ? 1 : 0); }
    assert.ok(/มีของระดับนี้หรือดีกว่าอยู่แล้ว|มีของชิ้นนี้อยู่แล้ว/.test(lastToast(p)), 'ข้อความปฏิเสธ: ' + lastToast(p));
    assert.strictEqual(buy(5), price(tool, 5), `${tool}_5 ซื้อสูงกว่าได้`); assert.strictEqual(buy(4), 0, `${tool}_4 หลังถือ 5 ซื้อไม่ได้`); assert.strictEqual(have(p, `${tool}_4`), 0);
    assert.strictEqual(buy(10), price(tool, 10)); assert.strictEqual(buy(9), 0); assert.strictEqual(buy(10), 0);
    // เลเวลไม่ถึง = ซื้อไม่ได้
    const low = mk({}); low.rec.skills = { farm: 0, fish: 0, animal: 0, wood: 0, cook: 0, mine: 0 }; shopPos(low, SH[tool]); const c0 = have(low, 'coin'); w.handle(low, { t: 'buy', item: `${tool}_6`, n: 1 }); assert.strictEqual(have(low, 'coin'), c0, `${tool}_6 เลเวลไม่ถึง`);
    // ร้านผิด = ไม่ได้
    const wrong = mk({}); shopPos(wrong, SH[tool] === 'farm' ? 'food' : 'farm'); const c1 = have(wrong, 'coin'); w.handle(wrong, { t: 'buy', item: `${tool}_2` }); assert.strictEqual(have(wrong, 'coin'), c1, 'ร้านผิดซื้อไม่ได้');
  }
  // ซื้อสูงกว่า: ความทน/ซ่อมรีเซ็ตเฉพาะเครื่องมือนั้น • ซื้อต่ำกว่าถูกปฏิเสธ ไม่รีเซ็ตความทนของชิ้นที่ใช้อยู่
  for (const [tool, shop] of [['hoe', 'farm'], ['pail', 'animal'], ['pan', 'food']]) {
    const p = mk({ [tool + '_4']: 1 }); shopPos(p, shop); p.rec.dur = { [tool]: 7, rod: 33 }; p.rec.fix = { [tool]: 2, rod: 1 };
    w.handle(p, { t: 'buy', item: tool + '_2' }); assert.strictEqual(p.rec.dur[tool], 7, 'ซื้อต่ำกว่าถูกปฏิเสธ ต้องไม่รีเซ็ตความทน'); assert.strictEqual(p.rec.fix[tool], 2);
    w.handle(p, { t: 'buy', item: tool + '_6' }); assert.strictEqual(w.durCur(p, tool), S.DURABILITY[tool].max[6], 'ซื้อใหม่ ความทนเต็มของระดับใหม่'); assert.strictEqual(w.fixN(p, tool), 0, 'ซ่อมนับใหม่');
    assert.strictEqual(p.rec.dur.rod, 33, 'ไม่แตะเครื่องมืออื่น'); assert.strictEqual(p.rec.fix.rod, 1);
  }
  { const p = mk({ can_2: 1 }); shopPos(p, 'farm'); w.waterSet(p, 3); w.handle(p, { t: 'buy', item: 'can_4' }); assert.strictEqual(w.waterCur(p), S.CANS[4].cap, 'ซื้อบัวใหม่ได้น้ำเต็ม'); w.handle(p, { t: 'buy', item: 'can_3' }); assert.strictEqual(have(p, 'can_3'), 0, 'หลังถือ can_4 ซื้อ can_3 ไม่ได้'); }
  console.log('  ซื้อ: ระดับ ≤ ที่ถือถูกปฏิเสธ (hoe/can/pail/pan) • ซื้อสูงกว่ารีเซ็ตความทนเฉพาะชิ้นนั้น');
}

// ===== (5) ขายคืนตามสภาพ =====
{
  const SH = { hoe: 'farm', pail: 'animal', pan: 'food', can: 'farm' }, PR = { hoe: S.HOES, pail: S.PAILS, pan: S.PANS };
  const priceOf = (tool, t) => tool === 'can' ? S.CANS[t].price : PR[tool][t].price;
  const sell = (p, tool, t) => { const c0 = have(p, 'coin'); w.handle(p, { t: 'sellback', item: `${tool}_${t}` }); return have(p, 'coin') - c0; };
  for (const tool of ['hoe', 'pail', 'pan']) for (const t of [2, 5, 10]) {
    const pr = priceOf(tool, t), mx = S.DURABILITY[tool].max[t], mk2 = (dur) => { const p = mk({ [`${tool}_${t}`]: 1 }); shopPos(p, SH[tool]); if (dur !== undefined) p.rec.dur[tool] = dur; return p; };
    assert.strictEqual(sell(mk2(), tool, t), Math.floor(pr * 0.7), `${tool}_${t} ความทนเต็ม = 70%`);
    assert.strictEqual(sell(mk2(mx), tool, t), Math.floor(pr * 0.7));
    const half = Math.floor(mx / 2); assert.strictEqual(sell(mk2(half), tool, t), Math.floor(pr * 0.7 * (half / mx)), `${tool}_${t} ครึ่งหลอด`); assert.ok(Math.abs(sell(mk2(mx / 2 | 0), tool, t) / (pr * 0.7) - 0.5) < 0.06);
    assert.strictEqual(sell(mk2(0), tool, t), Math.floor(pr * 0.7 * 0.1), `${tool}_${t} พัง = 10% ของ 70%`);
    assert.strictEqual(sell(mk2(1), tool, t), Math.floor(pr * 0.7 * Math.max(0.1, 1 / mx)), 'เหลือ 1 หน่วย ไม่ต่ำกว่า 10%');
    // ซ่อมมาแล้ว: ความทนสูงสุดลดลง → ราคาขายต่ำกว่า 70%
    const rp = mk({ [`${tool}_${t}`]: 1 }); shopPos(rp, SH[tool]); rp.rec.fix[tool] = 2; rp.rec.dur[tool] = S.durMax(tool, t, 2); const got = sell(rp, tool, t); assert.strictEqual(got, Math.floor(pr * 0.7 * (S.durMax(tool, t, 2) / mx))); assert.ok(got < Math.floor(pr * 0.7), 'ซ่อมมาแล้วขายได้น้อยกว่า 70%');
    // ไม่ได้ใช้ (มีชิ้นสูงกว่าอยู่) = 70% เต็มแม้ความทนของเครื่องมือที่ใช้อยู่ต่ำ
    const lo = t === 10 ? 9 : t, un = mk({ [`${tool}_${lo}`]: 1, [`${tool}_${lo + 1}`]: 1 }); shopPos(un, SH[tool]); un.rec.dur[tool] = 0; assert.strictEqual(sell(un, tool, lo), Math.floor(priceOf(tool, lo) * 0.7), `${tool}_${lo} ชิ้นต่ำที่ไม่ได้ใช้ (ถือ ${lo + 1} อยู่) ขาย 70% เต็ม`);
    // ขายแล้วไม่มีของ: ใช้ระดับ 1 (ฟรี) ความทนเป็นของใหม่ไม่ติดค่าเดิมของระดับสูง
    const gone = mk2(0); sell(gone, tool, t); assert.strictEqual(have(gone, `${tool}_${t}`), 0);
  }
  // ขายคืนแล้วซื้อใหม่ไม่ได้กำไร: ขาย + ซื้อชิ้นเดิมกลับ = เหรียญลดอย่างน้อย 30% ของราคา ทุกสภาพ
  for (const tool of ['hoe', 'pail', 'pan']) for (const t of [2, 4, 7, 10]) for (const f of [1, 0.5, 0.1, 0]) {
    const mx = S.DURABILITY[tool].max[t], pr = priceOf(tool, t), p = mk({ [`${tool}_${t}`]: 1, coin: 0 }); shopPos(p, SH[tool]); p.rec.coin = 0; p.rec.inv.coin = 0; p.rec.dur[tool] = Math.floor(mx * f);
    const got = sell(p, tool, t); assert.ok(got <= Math.floor(pr * 0.7), `${tool}_${t} f=${f} ได้เกิน 70%`);
    p.rec.inv.coin = pr + 50000; const before = have(p, 'coin') - got; // เหรียญเดิมก่อนขาย (ไม่นับที่เติมให้ซื้อ)
    const c0 = have(p, 'coin'); w.handle(p, { t: 'buy', item: `${tool}_${t}` }); assert.strictEqual(have(p, `${tool}_${t}`), 1, 'ซื้อกลับได้'); assert.strictEqual(c0 - have(p, 'coin'), pr);
    assert.ok(got - pr <= -Math.floor(pr * 0.3) + 1, `${tool}_${t} f=${f} ขายแล้วซื้อกลับ ต้องขาดทุนอย่างน้อย 30% (ได้ ${got} จ่าย ${pr})`); assert.strictEqual(w.durCur(p, tool), mx, 'ซื้อใหม่ได้ของเต็ม');
    void before;
  }
  // เทียบกับค่าซ่อม: ขายชิ้นพังแล้วซื้อใหม่ ถูกกว่าไม่ได้เมื่อเทียบกับการซื้อใหม่เต็มราคา (rebuy) — ขายคืนต้องไม่ถูกกว่าซ่อม+ถือ
  for (const tool of ['hoe', 'pail', 'pan']) { const t = 6, pr = priceOf(tool, t); assert.ok(pr - S.sellbackValue(`${tool}_${t}`, 0) >= pr * 0.69, 'ขายชิ้นพังคืนได้น้อยมาก'); }
  // บัวรดน้ำไม่มีความทน: 70% เต็มเสมอ
  { const p = mk({ can_3: 1 }); shopPos(p, 'farm'); assert.strictEqual(sell(p, 'can', 3), Math.floor(S.CANS[3].price * 0.7)); const q = mk({ can_6: 1 }); shopPos(q, 'farm'); w.waterSet(q, 110); assert.strictEqual(sell(q, 'can', 6), Math.floor(S.CANS[6].price * 0.7)); assert.ok(w.waterCur(q) <= S.CANS[1].cap, 'ขายบัวแล้วน้ำเกินความจุถูกตัด'); }
  // ขายคืนระดับ 1 (ไม่มีในร้าน) / ของที่ไม่มี = ไม่ได้เหรียญ • ผิดร้าน = ไม่ได้
  { const p = mk({}); shopPos(p, 'farm'); assert.strictEqual(sell(p, 'hoe', 1), 0); assert.strictEqual(sell(p, 'hoe', 4), 0, 'ไม่มีของขายไม่ได้'); const q = mk({ hoe_3: 1 }); shopPos(q, 'food'); assert.strictEqual(sell(q, 'hoe', 3), 0, 'ผิดร้าน'); assert.strictEqual(have(q, 'hoe_3'), 1); }
  // ขายชิ้นที่ใช้อยู่ (ระดับสูงสุด) แล้วความทนไม่ค้างไปให้ระดับที่เหลือ: dur ของเครื่องมือเดียวกัน อ่านตามระดับที่เหลือ ไม่เกินความทนสูงสุดของระดับนั้น
  { const p = mk({ hoe_2: 1, hoe_5: 1 }); shopPos(p, 'farm'); p.rec.dur.hoe = 100; sell(p, 'hoe', 5); assert.strictEqual(S.hoeTier(p.rec.inv), 2); assert.ok(w.durCur(p, 'hoe') <= S.DURABILITY.hoe.max[2], 'ความทนไม่เกินเพดานของระดับที่เหลือ'); }
  console.log('  ขายคืน: เต็ม 70% • ครึ่ง • พัง 10% • ชิ้นไม่ได้ใช้ 70% เต็ม • ซ่อมมาแล้วลดตามเพดาน • ขาย-ซื้อกลับขาดทุน ≥ 30%');
}

console.log('PASS test-gear-play');
process.exit(0);
