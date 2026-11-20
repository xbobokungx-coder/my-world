// ทดสอบ tools/store-unstash.js ด้วยเซฟจำลอง (ไม่แตะ data/ จริง) • รัน: node tools/test-storage-unstash.js
const fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process');
const S = require('../public/shared.js'), { unstash } = require('./store-unstash.js');
const DIR = require('./testlib').tmpDataDir('mw-unstash-'), H = 3600e3, NOW = Date.parse('2026-11-21T10:00:00+07:00');
const sumL = L => (L || []).reduce((a, x) => a + x[1], 0);
const mk = () => ({ players: {
  alice: { inv: { coin: 10, egg: 3, plank: 5 }, lots: { egg: [[NOW - 50 * H, 3]] },
    store: { cold: { inv: { egg: 10, crop_carrot: 4 }, lots: { egg: [[NOW - 30 * H, 6], [NOW - 5 * H, 4]], crop_carrot: [[NOW - 2 * H, 4]] }, r: 0.25, at: NOW - 8 * H },
             box: { inv: { plank: 20, log: 7 } } } },
  bob: { inv: { coin: 5, egg: 2 }, lots: { egg: [[NOW - 1 * H, 2]] } },
  carl: { inv: { coin: 1 }, store: null },
  dina: { inv: {}, store: { cold: { inv: { egg: 'x', milk: -3, __proto__: 1 }, lots: 5 }, box: 7, junk: { inv: [] } } },
  eve: null,
} });
const tot = (rec, k) => (rec.inv[k] || 0) + [rec.store && rec.store.cold, rec.store && rec.store.box].reduce((a, o) => a + ((o && o.inv && Number.isInteger(o.inv[k]) ? o.inv[k] : 0)), 0);
const ageBefore = (rec, k) => { const c = rec.store.cold; return (c.lots[k] || []).map(([t, n]) => [S.storeAge(t, c, NOW), n]); };

// 1) ผลรวมเท่าเดิม + ความสดไม่เปลี่ยน
const d = mk(), A0 = d.players.alice, before = {}; for (const k of ['egg', 'crop_carrot', 'plank', 'log', 'coin']) before[k] = tot(A0, k);
const ages = { egg: ageBefore(A0, 'egg'), crop_carrot: ageBefore(A0, 'crop_carrot') }, oldEgg = [[NOW - 50 * H, 3]];
const r = unstash(d, NOW), A = d.players.alice;
assert.strictEqual(r.accounts, 3, 'alice carl dina มี store');
assert.strictEqual(A.store, undefined, 'ลบ store แล้ว');
for (const k of Object.keys(before)) assert.strictEqual(A.inv[k] || 0, before[k], 'ผลรวมเท่าเดิม ' + k);
assert.strictEqual(r.items, 10 + 4 + 20 + 7, 'นับชิ้นที่ย้าย');
for (const k of ['egg', 'crop_carrot']) assert.strictEqual(sumL(A.lots[k]), A.inv[k], 'sum(lots) == inv ' + k);
// อายุที่คำนวณหลัง: ของจากคลังต้องมีอายุเท่าก่อน (age = NOW − t) และกองเดิมของกระเป๋าไม่ถูกแตะ
const find = (k, age) => A.lots[k].find(([t]) => Math.abs((NOW - t) - age) < 60000);
for (const k of Object.keys(ages)) for (const [age, n] of ages[k]) { const l = find(k, age); assert.ok(l && l[1] >= n, `อายุ ${k} ${age / H} ชม. ต้องเท่าเดิม`); }
assert.ok(A.lots.egg.some(([t, n]) => t === oldEgg[0][0] && n === 3), 'กองไข่เดิมในกระเป๋าไม่เปลี่ยน');
assert.ok(!A.lots.plank && !A.lots.log, 'ของไม่เสียไม่มี lots');
// อายุ r=0.25: 30 ชม. ก่อน at(8 ชม. ก่อน) → (22) + 8×0.25 = 24 ชม.
assert.ok(Math.abs((NOW - A.lots.egg.find(([t, n]) => n === 6)[0]) - 24 * H) < 60000, 'สูตร storeAge ถูกใช้');

// 2) บัญชีไม่มี store ไม่เปลี่ยน / store เพี้ยนไม่ throw
assert.deepStrictEqual(d.players.bob, mk().players.bob, 'บัญชีไม่มี store ไม่เปลี่ยน');
assert.strictEqual(d.players.carl.store, undefined); assert.deepStrictEqual(d.players.carl.inv, { coin: 1 });
assert.strictEqual(d.players.dina.store, undefined); assert.deepStrictEqual(d.players.dina.inv, {}, 'ของเสีย (ติดลบ/ไม่ใช่เลข) ไม่ถูกย้าย');
assert.strictEqual(d.players.eve, null);
for (const bad of [null, undefined, 5, 'x', [], {}, { players: null }, { players: { a: { store: 3 } } }]) assert.doesNotThrow(() => unstash(bad, NOW));

// 3) รันซ้ำไม่ซ้ำซ้อน
const snap = JSON.stringify(d), r2 = unstash(d, NOW);
assert.strictEqual(r2.accounts, 0); assert.strictEqual(r2.items, 0); assert.strictEqual(JSON.stringify(d), snap, 'รันซ้ำไม่เปลี่ยนอะไร');

// 4) ผ่าน CLI: dry-run ไม่เขียน, --write เขียน (ไฟล์ชั่วคราว ไม่เหลือ .tmp), ไม่ใส่ path = exit 1
const f = path.join(DIR, 'main.json'), tool = path.join(__dirname, 'store-unstash.js'); fs.writeFileSync(f, JSON.stringify(mk()));
const raw = fs.readFileSync(f, 'utf8');
let o = cp.execFileSync('node', [tool, f], { encoding: 'utf8' });
assert.strictEqual(fs.readFileSync(f, 'utf8'), raw, 'dry-run ห้ามแก้ไฟล์'); assert.ok(/dry-run/.test(o) && /3 บัญชี/.test(o));
o = cp.execFileSync('node', [tool, f, '--write'], { encoding: 'utf8' });
const w = JSON.parse(fs.readFileSync(f, 'utf8')); assert.ok(!w.players.alice.store && w.players.alice.inv.egg === 13 && w.players.alice.inv.plank === 25, 'เขียนผลจริง');
assert.ok(!fs.readdirSync(DIR).some(n => n.endsWith('.tmp')), 'ไม่เหลือไฟล์ .tmp'); assert.ok(/ปิดเซิร์ฟเวอร์/.test(o), 'เตือนให้ปิดเซิร์ฟเวอร์');
const mt = fs.statSync(f).mtimeMs; cp.execFileSync('node', [tool, f, '--write']); assert.strictEqual(fs.statSync(f).mtimeMs, mt, 'ไม่มีอะไรให้ย้าย = ไม่เขียนไฟล์');
assert.throws(() => cp.execFileSync('node', [tool], { stdio: 'pipe' }));
console.log('test-storage-unstash: ผ่านทั้งหมด');
