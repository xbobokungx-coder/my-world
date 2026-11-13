// ทดสอบความเข้ากันได้ของเซฟเก่ากับอุปกรณ์ 10 ระดับ (WP-23, ไม่ bump xpv คง 7): ผู้ถือ can_2/can_3/จอบ/dur.hoe/fix.hoe เดิมโหลดแล้วทำงานเหมือนเดิม
// ใช้เรคอร์ดสังเคราะห์ใน DATA_DIR ชั่วคราวเท่านั้น (ไม่แตะ data/): node tools/test-gear-compat.js
const fs = require('fs'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-gearcompat-');
let NOW = Date.now(); Date.now = () => NOW;
const S = require('../public/shared.js'), TS = S.TS, clone = o => JSON.parse(JSON.stringify(o));

// ---- "ล็อก" ที่ห้ามเปลี่ยนโดยไม่ bump xpv 8 (ตั๋วข้อ 3/4) ----
{
  assert.strictEqual(S.DURABILITY.hoe.max[1], 120, 'จอบระดับ 1 ทนสูงสุด 120 (dur.hoe ในเซฟเก่าใช้ต่อได้)');
  assert.deepStrictEqual([S.CANS[1].cap, S.CANS[1].wet], [10, 90000]); assert.deepStrictEqual([S.CANS[2].cap, S.CANS[2].wet], [20, 120000]); assert.deepStrictEqual([S.CANS[3].cap, S.CANS[3].wet], [50, 180000]);
  assert.ok(S.CANS[2].lv <= 3 && S.CANS[3].lv <= 6, 'can_2/can_3 ปลดไม่ช้ากว่าเดิม (Lv3/Lv6)');
  assert.deepStrictEqual(Object.values(S.CROPS).map(c => [c.id || c.name, S.cropCan(c)]).filter(x => x[1] > 3), [], 'cropCan ไม่ขยายเกิน 3');
  assert.deepStrictEqual([5, 6, 7, 8, 12].map(lv => S.cropCan({ lv })), [1, 2, 2, 3, 3], 'cropCan เกณฑ์เดิม: Lv6–7 บัว 2, Lv8+ บัว 3');
  for (const t of [4, 5, 10]) assert.ok(S.canTier({ ['can_' + t]: 1 }) >= S.cropCan({ lv: 20 }), 'บัวสูงกว่า 3 ปลูกได้ทุกพืช');
}

const ACH0 = () => ({ cnt: {}, got: Object.fromEntries(S.ACH.map(d => [d.id, 1])) }); // กันเหรียญโบนัสความสำเร็จปนยอดตอนโหลด
const rec = (name, inv, extra) => Object.assign({ name, xpv: 7, mig2: true, ach: ACH0(), skills: { farm: 1e9, animal: 1e9, cook: 1e9, wood: 0, fish: 0, mine: 0 }, inv: Object.assign({ coin: 5000, seed_carrot: 5 }, inv), x: 10, y: 10, hunger: 100, starter: { done: {}, final: true } }, extra || {});
const players = {
  c2: rec('c2', { can_2: 1 }, { dur: { hoe: 90 }, wtr: 99 }),
  c3: rec('c3', { can_3: 1 }, { dur: { hoe: 30 }, fix: { hoe: 2 }, wtr: 15 }),
  c23: rec('c23', { can_2: 1, can_3: 1, seed_grape: 3, seed_pumpkin: 3 }),
  bare: rec('bare', {}, { dur: { hoe: 0 } }),
  brk: rec('brk', { can_3: 1 }, { dur: { hoe: 0, rod: 50 }, fix: { hoe: 3 } }),
};
fs.writeFileSync(path.join(process.env.DATA_DIR, 'gearcompat.json'), JSON.stringify({ players: clone(players), farm: {}, layout: 2 }));
const { World } = require('../server.js');
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('gearcompat'), sv = w.saved;

// ---- โหลด: ไม่ย้ายเซฟ ไม่เพิ่ม/ลบคีย์ ไม่แตะเหรียญ ----
for (const k of Object.keys(players)) {
  const o = players[k], r = sv[k];
  assert.strictEqual(r.xpv, 8, k + ' xpv ต้องเป็น 8 (ย้ายความทนครั้งเดียว)'); assert.strictEqual(r.tmig, undefined, k + ' ไม่มี tmig (ไม่ย้ายเซฟ)');
  assert.deepStrictEqual(r.inv, o.inv, k + ' inv เท่าเดิมเป๊ะ (ไม่เพิ่ม/ลบคีย์ ไม่แตะเหรียญ)'); { const e = JSON.parse(JSON.stringify(o)); S.migrateDurV8(e); assert.deepStrictEqual(r.dur, e.dur, k + ' dur เท่าเดิม (ยกเว้น rod/axe/pick ย้ายตามสัดส่วน xpv 8)'); } assert.deepStrictEqual(r.fix, o.fix, k + ' fix เท่าเดิม');
  assert.ok(!r.dur || (!('pail' in r.dur) && !('pan' in r.dur)), k + ' ไม่สร้าง dur.pail/pan ให้ (ของฟรีเต็มโดยปริยาย)');
}
assert.strictEqual(S.canTier(sv.c2.inv), 2); assert.strictEqual(S.canTier(sv.c3.inv), 3); assert.strictEqual(S.canTier(sv.c23.inv), 3); assert.strictEqual(S.canTier(sv.bare.inv), 1);
for (const k of Object.keys(players)) { assert.strictEqual(S.hoeTier(sv[k].inv), 1, k + ' จอบเดิม = จอบ 1'); assert.strictEqual(S.pailTier(sv[k].inv), 1); assert.strictEqual(S.panTier(sv[k].inv), 1); }
// เซฟแล้วโหลดซ้ำไม่เปลี่ยน
w.dirty = true; w.save(true); const snap = clone(sv), w2 = new World('gearcompat'); assert.deepStrictEqual(clone(w2.saved), snap, 'โหลดรอบสอง = ไม่เปลี่ยน');
w2.dirty = true; w2.save(true); assert.deepStrictEqual(clone(new World('gearcompat').saved), snap, 'รอบสามก็เหมือนเดิม');
for (const k of Object.keys(players)) assert.strictEqual(snap[k].xpv, 8);

// ---- เข้าเกม: ความทน/น้ำ/บัวเท่าเดิม ----
const J = {}, get = name => J[name] || (() => { const ws = mkWs(), p = w2.join(ws, name, '#e74c3c').p; p.ws2 = ws; p.rec.hunger = 100; return (J[name] = p); })();
w2.themeRain = () => 'off';
const durMsg = p => { const m = p.ws2.msgs.find(x => x.t === 'dur') || p.ws2.msgs.find(x => x.t === 'w' && x.dur); return m && (m.d || m.dur); };
{
  const c2 = get('c2'), c3 = get('c3'), bare = get('bare'), brk = get('brk');
  assert.strictEqual(w2.durCur(c2, 'hoe'), 90); assert.strictEqual(w2.durMx(c2, 'hoe'), 120); assert.strictEqual(w2.durCur(c3, 'hoe'), 30, 'dur.hoe เดิม 30 ใช้ต่อได้'); assert.strictEqual(w2.fixN(c3, 'hoe'), 2); assert.strictEqual(w2.durMx(c3, 'hoe'), Math.floor(120 * (1 - S.REPAIR.decay * 2)), 'ทนสูงสุดตามซ่อม 2 ครั้ง เท่าสูตรเดิม');
  assert.strictEqual(w2.durCur(bare, 'hoe'), 0, 'จอบพังเดิมยังพัง'); assert.strictEqual(w2.durCur(brk, 'hoe'), 0); assert.strictEqual(w2.fixN(brk, 'hoe'), 3); assert.strictEqual(w2.durCur(brk, 'rod'), 52, 'ความทน rod ย้ายตามสัดส่วน xpv 8 (50 → 52) เครื่องมืออื่นไม่เปลี่ยน');
  assert.strictEqual(w2.durCur(c2, 'pail'), S.DURABILITY.pail.max[1], 'ถัง/กระทะที่ไม่เคยมี = เต็มของระดับ 1'); assert.strictEqual(w2.durCur(c2, 'pan'), S.DURABILITY.pan.max[1]);
  const d = durMsg(c2); assert.ok(d, 'มีข้อความ dur ตอนเข้าเกม'); assert.deepStrictEqual(d.hoe, [90, 120, 0]); assert.deepStrictEqual(durMsg(c3).hoe, [30, 84, 2]);
  assert.strictEqual(w2.canOf(c2).cap, 20); assert.strictEqual(w2.canOf(c2).wet, 120000); assert.strictEqual(w2.canOf(c3).cap, 50); assert.strictEqual(w2.canOf(c3).wet, 180000); assert.strictEqual(w2.canOf(bare).cap, 10); assert.strictEqual(w2.canOf(bare).wet, 90000);
  assert.strictEqual(w2.waterCur(c2), 20, 'น้ำเกินความจุบัว 2 ถูกตัดเหมือนเดิม'); assert.strictEqual(w2.waterCur(c3), 15, 'น้ำที่เหลือในบัว 3 คงเดิม');
}

// ---- ปลูก: เกณฑ์บัวเดิม (องุ่น Lv8 ต้องบัว 3; ฟักทอง Lv6–7 ต้องบัว 2) ----
{
  // องุ่นอยู่ฤดูหนาว ฟักทองอยู่ฤดูฝน ปลูกพร้อมกันไม่ได้ — หาคนละช่วง
  const findSeason = crop => { const epoch = Date.parse('2026-11-01T00:00:00+07:00'); for (let i = 0; i < 21; i++) { const t = epoch + i * 864e5; if (S.inSeason(crop, t)) return t; } return 0; };
  const tGrape = findSeason('grape'), tPump = findSeason('pumpkin');
  assert.ok(S.inSeason('grape', tGrape) && S.inSeason('pumpkin', tPump) && S.inSeason('carrot', tGrape), 'หาฤดูองุ่นและฟักทองได้');
  assert.strictEqual(S.cropCan(S.CROPS.grape), 3, 'องุ่นยังต้องบัว 3'); assert.strictEqual(S.CROPS.grape.lv, 8);
  const FARM = S.FARM, cells = []; for (let y = FARM.y0; y <= FARM.y1; y++) for (let x = FARM.x0; x <= FARM.x1; x++) if (y >= 14 && w2.map[y][x] === S.T.GRASS && !w2.farm[x + ',' + y]) cells.push([x, y]);
  let ci = 0; const plant = (p, seed) => { const [x, y] = cells[ci++], k = x + ',' + y; w2.farm[k] = {}; p.x = (x + 0.5) * TS; p.y = (y + 1.5) * TS; p.dir = 1; NOW += 1000; w2.handle(p, { t: 'act', tool: seed, tx: x, ty: y }); return w2.farm[k] && w2.farm[k].c; };
  for (const nm of ['c2', 'c3', 'c23', 'bare']) { const p = get(nm); p.rec.inv.seed_grape = 3; p.rec.inv.seed_pumpkin = 3; p.rec.inv.seed_carrot = 3; }
  // ฤดูฝนมาก่อนฤดูหนาวในรอบแรก — ห้ามถอยเวลา เพราะ act ทิ้งถ้า now ย้อนหลัง lastAct
  NOW = tPump;
  assert.strictEqual(plant(get('bare'), 'seed_pumpkin'), undefined, 'ไม่มีบัวปลูกฟักทอง Lv6–7 ไม่ได้');
  assert.strictEqual(plant(get('c2'), 'seed_pumpkin'), 'pumpkin', 'can_2 ปลูกฟักทองได้ (เท่าเดิม)'); assert.strictEqual(plant(get('c3'), 'seed_pumpkin'), 'pumpkin');
  NOW = tGrape;
  assert.strictEqual(plant(get('c3'), 'seed_grape'), 'grape', 'can_3 ปลูกองุ่น Lv8 ได้ (เท่าเดิม)'); assert.strictEqual(plant(get('c23'), 'seed_grape'), 'grape');
  assert.strictEqual(plant(get('c2'), 'seed_grape'), undefined, 'can_2 ปลูกองุ่นไม่ได้ (เท่าเดิม)'); assert.ok(/บัวรดน้ำ/.test(get('c2').ws2.msgs.filter(m => m.t === 'msg').pop().text), 'ข้อความบอกให้ซื้อบัว');
  assert.strictEqual(plant(get('bare'), 'seed_grape'), undefined, 'ไม่มีบัวปลูกองุ่นไม่ได้');
  assert.strictEqual(plant(get('bare'), 'seed_carrot'), 'carrot', 'ไม่มีบัวปลูกพืชระดับต้นได้');
  // รดน้ำ: ความจุ/เวลาเปียกของบัวเดิม
  const p = get('c3'), [x, y] = cells[ci - 1 > 0 ? 0 : 0], k = Object.keys(w2.farm).find(q => w2.farm[q].c === 'grape'), [fx, fy] = k.split(',').map(Number); p.x = (fx + 0.5) * TS; p.y = (fy + 1.5) * TS; p.dir = 1; const wl = w2.waterCur(p); NOW += 1000; w2.handle(p, { t: 'act', tool: 'water', tx: fx, ty: fy });
  assert.strictEqual(w2.farm[k].wu, NOW + 180000, 'บัว 3 รดแล้วเปียก 180 วิ เท่าเดิม'); assert.strictEqual(w2.waterCur(p), wl - 1); void x; void y;
  const q = get('c2'), k2 = Object.keys(w2.farm).find(z => w2.farm[z].c === 'pumpkin' && z !== k), [gx, gy] = k2.split(',').map(Number); q.x = (gx + 0.5) * TS; q.y = (gy + 1.5) * TS; q.dir = 1; NOW += 1000; w2.handle(q, { t: 'act', tool: 'water', tx: gx, ty: gy }); assert.strictEqual(w2.farm[k2].wu, NOW + 120000, 'บัว 2 รดแล้วเปียก 120 วิ เท่าเดิม');
}

// ---- ใช้จอบเดิม: ขุดได้ตามความทนเดิม • สึกลงจากค่าในเซฟ ----
{
  const p = get('c2'), FARM = S.FARM; let cell; for (let y = FARM.y0; y <= FARM.y1 && !cell; y++) for (let x = FARM.x0; x <= FARM.x1 && !cell; x++) if (y >= 14 && w2.map[y][x] === S.T.GRASS && !w2.farm[x + ',' + y]) cell = [x, y];
  p.x = (cell[0] + 0.5) * TS; p.y = (cell[1] + 1.5) * TS; p.dir = 1; const d0 = w2.durCur(p, 'hoe'); NOW += 1000; w2.handle(p, { t: 'act', tool: 'hoe', tx: cell[0], ty: cell[1] });
  assert.ok(w2.farm[cell.join(',')], 'จอบ 90/120 ขุดได้'); assert.strictEqual(w2.durCur(p, 'hoe'), d0 - 1, 'ขุด 1 ครั้งสึก 1 เท่าเดิม');
  const b = get('bare'); b.x = (cell[0] + 1.5) * TS; b.y = (cell[1] + 1.5) * TS; b.dir = 1; const c2 = [cell[0] + 1, cell[1]]; NOW += 1000; w2.handle(b, { t: 'act', tool: 'hoe', tx: c2[0], ty: c2[1] }); assert.ok(!w2.farm[c2.join(',')], 'จอบพังเดิมขุดไม่ได้เหมือนเดิม');
}

// ---- ขายคืน can_2/can_3 เดิม: 70% เต็ม (บัวไม่มีความทน) และซื้อบัวสูงกว่าได้ ----
{
  const shopAt = (p, kind) => { const [cx, cy] = S.BUILDINGS.find(b => b.kind === kind).counter[0]; p.x = (cx + 0.5) * TS; p.y = (cy + 0.5) * TS; };
  const p = get('c3'); shopAt(p, 'farm'); p.rec.starter = { done: {}, final: true }; const c0 = p.rec.inv.coin; w2.handle(p, { t: 'sellback', item: 'can_3' }); assert.strictEqual(p.rec.inv.coin - c0, Math.floor(S.CANS[3].price * 0.7), 'can_3 เดิมขายคืน 70% ได้ (ไม่ถูกล็อก)'); assert.strictEqual(S.canTier(p.rec.inv), 1);
  const q = get('c2'); shopAt(q, 'farm'); q.rec.starter = { done: {}, final: true }; q.rec.inv.coin = 99999; w2.handle(q, { t: 'buy', item: 'can_2' }); assert.strictEqual(q.rec.inv.coin, 99999, 'ซื้อ can_2 ซ้ำไม่ได้'); w2.handle(q, { t: 'buy', item: 'can_3' }); assert.strictEqual(S.canTier(q.rec.inv), 3, 'อัป can_2 → can_3 ได้'); assert.strictEqual(q.rec.inv.coin, 99999 - S.CANS[3].price);
  // ผู้ถือจอบเดิมซื้อจอบ 2 ได้: ความทนรีเซ็ตเต็มของระดับ 2 ไม่ใช่ค่าเก่า
  const r = get('c23'); shopAt(r, 'farm'); r.rec.starter = { done: {}, final: true }; r.rec.dur = { hoe: 10 }; w2.handle(r, { t: 'buy', item: 'hoe_2' }); assert.strictEqual(S.hoeTier(r.rec.inv), 2); assert.strictEqual(w2.durCur(r, 'hoe'), S.DURABILITY.hoe.max[2]);
}
console.log('PASS test-gear-compat');
process.exit(0);
