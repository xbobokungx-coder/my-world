// ทดสอบย้ายความทน rod/axe/pick ตามสัดส่วน (xpv 7 → 8, 14 พ.ย. 2026) + ถอยกลับ • ใช้เรคอร์ดสังเคราะห์ + DATA_DIR ชั่วคราวเท่านั้น: node tools/test-dur-migrate.js
const fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process'), os = require('os');
const S = require('../public/shared.js'), R = S.REPAIR, OLD = S.DUR_MIG8, clone = o => JSON.parse(JSON.stringify(o));
const TOOLS = ['rod', 'axe', 'pick'], held = (tool, t) => tool === 'rod' ? (t > 1 ? { ['rod_' + t]: 1 } : {}) : { [tool + '_' + t]: 1 };
const oldMax = (tool, t, fx) => Math.max(1, Math.floor(OLD[tool][t] * (1 - R.decay * Math.min(R.maxFixes, fx))));
const mk = (tool, t, dur, fx) => ({ xpv: 7, inv: Object.assign({ coin: 500 }, held(tool, t)), dur: { [tool]: dur }, fix: { [tool]: fx } });
// (ก) ตารางเก่าตามตั๋ว (ห้ามแก้) + ตารางใหม่ต้องเป็นค่าจริงใน DURABILITY
assert.deepStrictEqual(OLD.rod, [0, 160, 330, 560, 820, 1100, 1400, 1750, 2100, 2500, 2900]);
assert.deepStrictEqual(OLD.axe, [0, 120, 310, 580, 790, 1010, 1370, 1690, 2050, 2350, 2610]);
assert.deepStrictEqual(OLD.pick, [0, 115, 320, 460, 600, 800, 1000, 1300, 1650, 2100, 2600]);
// (ข) ทุกเครื่องมือ/ระดับ/จำนวนซ่อม: เต็มยังเต็ม ครึ่งยังครึ่ง 0 ยัง 0 • ราคาขายคืนชิ้นเต็ม = frac 1 (เท่าเดิม 70%)
for (const tool of TOOLS) for (let t = 1; t <= 10; t++) for (let fx = 0; fx <= 4; fx++) {
  const om = oldMax(tool, t, fx), nm = S.durMax(tool, t, fx);
  { const r = mk(tool, t, om, fx); assert.strictEqual(S.migrateDurV8(r), true); assert.strictEqual(r.xpv, 8); assert.strictEqual(r.dur[tool], nm, `เต็ม ${tool}${t} fx${fx}`); assert.strictEqual(r.fix[tool], fx, 'fix ไม่แตะ'); }
  { const r = mk(tool, t, Math.round(om / 2), fx); S.migrateDurV8(r); assert.ok(Number.isInteger(r.dur[tool]) && r.dur[tool] >= 0 && r.dur[tool] <= nm); assert.ok(Math.abs(r.dur[tool] / nm - Math.round(om / 2) / om) <= 1 / nm + 1 / om, `ครึ่ง ${tool}${t} fx${fx}`); }
  { const r = mk(tool, t, 0, fx); S.migrateDurV8(r); assert.strictEqual(r.dur[tool], 0, 'พังยังพัง'); }
  { const r = mk(tool, t, 1, fx); S.migrateDurV8(r); assert.ok(r.dur[tool] >= 1, 'เหลือ 1 ไม่ถูกปัดเป็นพัง'); }
  { const r = mk(tool, t, om * 5, fx); S.migrateDurV8(r); assert.strictEqual(r.dur[tool], nm, 'เกินเพดาน clamp'); }
  if (fx === 0) { const r = mk(tool, t, om, 0); S.migrateDurV8(r); assert.strictEqual(r.dur[tool] / S.DURABILITY[tool].max[t], 1, 'ขายคืนชิ้นเต็ม frac = 1'); }
  { const r = mk(tool, t, Math.round(om * 0.37), fx), o = r.dur[tool]; S.migrateDurV8(r); S.unmigrateDurV8(r); assert.strictEqual(r.xpv, 7); assert.ok(Math.abs(r.dur[tool] - o) <= Math.ceil(om / nm) + 1, `unmigrate ${tool}${t} fx${fx}: ${o} → ${r.dur[tool]}`); }
}
// (ค) idempotent: รันซ้ำไม่ย้ายซ้ำ • xpv >= 8 ไม่แตะ
{ const r = mk('axe', 10, 1000, 1); S.migrateDurV8(r); const snap = clone(r); assert.strictEqual(S.migrateDurV8(r), false); assert.deepStrictEqual(r, snap); for (const v of [8, 9]) { const q = mk('axe', 10, 1000, 0); q.xpv = v; const s2 = clone(q); assert.strictEqual(S.migrateDurV8(q), false); assert.deepStrictEqual(q, s2); } }
// (ง) เซฟ dur ไม่มีค่า / ไม่มีเครื่องมือ / ผิดรูป ไม่พัง ไม่สร้างค่าให้
for (const bad of [null, undefined, 0, 'x', [], {}, { xpv: 7 }, { xpv: 7, inv: null }, { xpv: 7, inv: { coin: 5 } }, { xpv: 7, inv: { coin: 5 }, dur: { axe: 10 } }, { xpv: 7, inv: { axe_3: 1 }, dur: null }, { xpv: 7, inv: { axe_3: 1 }, dur: { axe: 'x' } }, { xpv: 7, inv: { axe_3: 1 }, dur: { axe: NaN }, fix: 'x' }, { xpv: 7, inv: 'x', dur: { axe: 5 } }]) {
  const r = bad === undefined ? bad : clone(bad); assert.doesNotThrow(() => { S.migrateDurV8(r); S.unmigrateDurV8(r); });
}
{ const r = { xpv: 7, inv: { coin: 5, axe_3: 1 } }; S.migrateDurV8(r); assert.strictEqual(r.dur, undefined, 'ไม่มี dur ไม่สร้างให้'); assert.strictEqual(r.xpv, 8); }
{ const r = { xpv: 7, inv: { axe_3: 1 }, dur: { axe: -5 } }; S.migrateDurV8(r); assert.strictEqual(r.dur.axe, 0); }
{ const r = { xpv: 7, inv: { coin: 9, hoe_2: 1 }, dur: { hoe: 50 } }; S.migrateDurV8(r); assert.strictEqual(r.dur.hoe, 50, 'เครื่องมืออื่นไม่แตะ'); }
// (จ) เซฟเก่ากว่า xpv 7 ผ่าน migrateToolsV6 (ตารางใหม่) แล้ว noConvert = ไม่คูณซ้ำ • tmig.nd ตามสเกล
{ const r = { xpv: 5, inv: { coin: 5, axe_3: 1 }, dur: { axe: 110 } }; S.migrateToolsV6(r); const d = r.dur.axe; S.migrateDurV8(r, true); assert.strictEqual(r.dur.axe, d); assert.strictEqual(r.xpv, 8); }
{ const r = { xpv: 6, inv: { coin: 5, axe_4: 1, axe_6: 1 }, dur: { axe: 400 }, tmig: { add: ['axe_6'], left: {}, old: { axe: 4 }, dur: { axe: 200 }, nd: { axe: 400 } } }; S.migrateDurV8(r); assert.ok(r.dur.axe > 0 && r.tmig.nd.axe === r.dur.axe, 'nd สเกลเดียวกับ dur'); S.unmigrateDurV8(r); assert.strictEqual(r.tmig.nd.axe, r.dur.axe); }
// (ฉ) ผ่านเซิร์ฟเวอร์จริง: โหลดเซฟ xpv 7 ย้ายครั้งเดียว บันทึกซ้ำแล้วโหลดใหม่ไม่ย้ายซ้ำ • unmigrate CLI คืนสัดส่วน
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-dur-')), f = path.join(dir, 'main.json'), env = { ...process.env, DATA_DIR: dir };
  const om = oldMax('axe', 10, 0), save = { players: { a: { xpv: 7, inv: { coin: 9, axe_10: 1 }, dur: { axe: om } }, b: { xpv: 7, inv: { coin: 9, axe_10: 1 }, dur: { axe: Math.round(om / 2) } }, c: { xpv: 7, inv: { coin: 1 } } } };
  fs.writeFileSync(f, JSON.stringify(save));
  const load = () => { process.env.DATA_DIR = dir; for (const k of Object.keys(require.cache)) if (k.includes(path.sep + 'server')) delete require.cache[k]; const { World } = require('../server.js'); return new World('main'); };
  let w; try { w = load(); } catch (e) { w = null; }
  if (w && w.saved) {
    assert.strictEqual(w.saved.a.xpv, 8); assert.strictEqual(w.saved.a.dur.axe, S.durMax('axe', 10, 0), 'โหลดเซฟ: เต็มยังเต็ม'); const b1 = w.saved.b.dur.axe; assert.ok(Math.abs(b1 / S.durMax('axe', 10, 0) - 0.5) < 0.01);
    assert.strictEqual(w.saved.c.dur, undefined); w.saved.a.dur.axe -= 1; const a1 = w.saved.a.dur.axe, d2 = JSON.parse(JSON.stringify({ players: w.saved })); fs.writeFileSync(f, JSON.stringify(d2)); const w2 = load(); assert.strictEqual(w2.saved.a.dur.axe, a1, 'โหลดซ้ำไม่ย้ายซ้ำ'); assert.strictEqual(w2.saved.b.dur.axe, b1);
  }
  fs.writeFileSync(f, JSON.stringify({ players: { a: { xpv: 8, inv: { coin: 9, axe_10: 1 }, dur: { axe: S.durMax('axe', 10, 0) } } } }));
  cp.execFileSync('node', [path.join(__dirname, 'tools-unmigrate.js'), '--to=7'], { env, encoding: 'utf8' });
  const u = JSON.parse(fs.readFileSync(f, 'utf8')).players.a; assert.strictEqual(u.xpv, 7); assert.strictEqual(u.dur.axe, om, 'unmigrate CLI เต็ม → เต็มตารางเก่า');
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('test-dur-migrate: ผ่านทั้งหมด');
