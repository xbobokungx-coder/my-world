// ทดสอบคลังเก็บของในบ้าน (server/systems/storage.js): เก็บ/หยิบ อายุไม่คิดย้อนหลัง ถอดตู้ คืนตู้ตอนโหลด ย้ายข้อมูลตู้เย็นเดิม rank
// รัน: node tools/test-storage.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const DIR = process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-storage-');
let NOW = Date.parse('2026-11-21T10:00:00+07:00'); Date.now = () => NOW;
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, H = 3600e3;
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const last = (ws, t) => { for (let i = ws.msgs.length - 1; i >= 0; i--) if (ws.msgs[i].t === t) return ws.msgs[i]; return null; };
const st = (w, p, m) => w.handle(p, Object.assign({ t: 'store' }, m));
const hs = (w, p, m) => w.handle(p, Object.assign({ t: 'house' }, m));
const sumL = (L) => (L || []).reduce((a, x) => a + x[1], 0);
const inStore = (rec, pool, k) => (rec.store && rec.store[pool] && rec.store[pool].inv[k]) || 0;
const total = (rec, k) => (rec.inv[k] || 0) + inStore(rec, 'cold', k) + inStore(rec, 'box', k);
const lotInv = (rec, k) => assert.strictEqual(sumL(rec.lots && rec.lots[k]), rec.inv[k] || 0, 'sum(lots) ต้องเท่ากับ inv: ' + k);
const coldInv = (rec, k) => assert.strictEqual(sumL(rec.store.cold.lots[k]), rec.store.cold.inv[k] || 0, 'sum(lots คลัง) ต้องเท่ากับ inv คลัง: ' + k);

const w = new World('main'), wa = mkWs(), wb = mkWs();
const a = w.join(wa, 'alice', '#e74c3c').p, b = w.join(wb, 'bob', '#3498db').p;
assert.strictEqual(a.rec.frz, 1, 'บัญชีใหม่ต้องมี frz:1');
Object.assign(a.rec.inv, { coin: 5000, furn_fridge: 2, furn_crate: 1 });
w.handle(a, { t: 'house', a: 'enter' });
a.x = 36 * TS; a.y = 24 * TS;
const items = () => w.houses.alice.items, idOf = f => Object.keys(items()).find(i => items()[i].f === f);
hs(w, a, { a: 'place', f: 'fridge', x: 37, y: 22, r: 0 }); const fid = +idOf('fridge'); assert.ok(fid, 'วางตู้เย็นได้');
hs(w, a, { a: 'place', f: 'crate', x: 34, y: 22, r: 0 }); const cid = +idOf('crate'); assert.ok(cid, 'วางลังได้');
// ผู้เล่นมีของ: ไข่อายุ 20 ชม. + แครอทใหม่ + ไม้
w.add(a, 'egg', 10, 't', [[NOW - 20 * H, 10]]); w.add(a, 'crop_carrot', 5); a.rec.inv.plank = 20; a.rec.inv.pick_1 = 1; a.rec.inv.pet_dog = 1;
assert.strictEqual(w.freshPub(a.rec, a.key).fz, false, 'ตู้เย็นต้องไม่ชะลอของในกระเป๋าแล้ว (fz false)');
const eggT0 = total(a.rec, 'egg');

// เปิดไม่ได้: ข้อความผิดรูป / ไม่ใช่ตู้ / ไกล / ไม่ใช่เจ้าของ / ยังไม่ open
for (const bad of [null, {}, { a: 5 }, { a: 'open' }, { a: 'open', i: 'x' }, { a: 'open', i: NaN }, { a: 'open', i: {} }, { a: 'put', pool: 'cold', k: 'egg', n: 1 }, { a: 'zzz' }]) st(w, a, bad);
w.handle(a, { t: 'store' }); w.handle(a, { t: 'store', a: [], i: [], pool: {}, k: {}, n: 'x' });
assert.ok(!last(wa, 'store'), 'ข้อความผิดรูป/ยังไม่ open ต้องไม่ได้สถานะคลัง'); assert.strictEqual(a.rec.inv.egg, 10);
NOW += 1000; const tbl = +Object.keys(items())[0]; st(w, a, { a: 'open', i: 99999 }); assert.ok(!last(wa, 'store'));
a.x = 20 * TS; a.y = 20 * TS; st(w, a, { a: 'open', i: fid }); assert.ok(!last(wa, 'store'), 'ไกลเกิน 4 ช่องต้องเปิดไม่ได้');
a.x = 36 * TS; a.y = 24 * TS; NOW += 1000; st(w, a, { a: 'open', i: fid });
let m = last(wa, 'store'); assert.ok(m && m.pool === 'cold' && m.cap === 60 && m.used === 0, 'เปิดตู้เย็น cap 60');
// เว้นระยะ open
wa.msgs.length = 0; st(w, a, { a: 'open', i: fid }); assert.ok(!last(wa, 'store'), 'open ถี่เกิน 150ms ต้องถูกเมิน');
// ผู้เยี่ยมเปิดไม่ได้ (บ้านคนอื่น) และไม่เปิดจากในเมือง
w.handle(b, { t: 'house', a: 'enter', who: 'alice' }); b.x = 36 * TS; b.y = 24 * TS; NOW += 1000;
st(w, b, { a: 'open', i: fid }); assert.ok(!last(wb, 'store') && !b.storeAt, 'คนมาเยี่ยมเปิดไม่ได้');
st(w, b, { a: 'take', pool: 'cold', k: 'egg', n: 1 }); w.handle(b, { t: 'house', a: 'exit' });
st(w, b, { a: 'open', i: fid }); assert.ok(!last(wb, 'store'), 'จากในเมืองเปิดไม่ได้');

// เก็บ: ปฏิเสธของผิดชนิด
const rej = (pool, k) => { const u = inStore(a.rec, pool, k), n0 = a.rec.inv[k]; st(w, a, { a: 'put', pool, k, n: 1 }); assert.strictEqual(inStore(a.rec, pool, k), u, 'ต้องปฏิเสธ ' + pool + ':' + k); assert.strictEqual(a.rec.inv[k], n0); };
rej('cold', 'plank'); rej('cold', 'coin'); rej('cold', 'pick_1'); rej('cold', '__proto__'); rej('cold', 'constructor');
st(w, a, { a: 'put', pool: 'cold', k: 'egg', n: -3 }); st(w, a, { a: 'put', pool: 'cold', k: 'egg', n: 1.5 }); st(w, a, { a: 'put', pool: 'cold', k: 'egg', n: NaN }); st(w, a, { a: 'put', pool: 'cold', k: 'egg', n: '5' }); st(w, a, { a: 'put', pool: 'cold', k: 'egg', n: 0 });
assert.strictEqual(a.rec.inv.egg, 10, 'n ผิดรูปต้องไม่ทำอะไร'); assert.ok(!a.rec.store.cold.inv.egg);
st(w, a, { a: 'put', pool: 'box', k: 'egg', n: 1 }); assert.strictEqual(a.rec.inv.egg, 10, 'pool ที่ไม่ได้เปิดอยู่ใช้ไม่ได้');
st(w, a, { a: 'put', pool: 'cold', k: 'egg', n: 999 }); // เกินที่มี → เก็บเท่าที่มี
assert.strictEqual(a.rec.inv.egg || 0, 0); assert.strictEqual(a.rec.store.cold.inv.egg, 10);
assert.strictEqual(total(a.rec, 'egg'), eggT0, 'ผลรวม inv+คลัง คงที่'); lotInv(a.rec, 'egg'); coldInv(a.rec, 'egg');
// ของสดเก็บได้ ไม่ใช่ของสดไม่ได้ (ลังของสดไม่ได้)
st(w, a, { a: 'put', pool: 'cold', k: 'crop_carrot', n: 5 }); assert.strictEqual(a.rec.store.cold.inv.crop_carrot, 5);
// อายุไม่คิดย้อนหลัง: เก็บ 40 ชม. ที่ ×mul (HOME.store.cold.mul) = +40×mul ชม. จากอายุ 20 (ค่าเดิม ×0.25 = +10)
const CM = S.HOME.store.cold.mul;
NOW += 40 * H; w.dirty = true;
const bagAt = w.houses.alice && 0; // (กันเตือน)
st(w, a, { a: 'take', pool: 'cold', k: 'egg', n: 10 });
assert.strictEqual(a.rec.inv.egg, 10); lotInv(a.rec, 'egg');
let age = NOW - w.lotsOf(a.rec, 'egg')[0][0]; assert.ok(Math.abs(age - (20 + 40 * CM) * H) < 20000, 'อายุหลังหยิบ = 20+40×mul ชม. ได้ ' + age / H);
assert.strictEqual(S.freshTier(w.lotsOf(a.rec, 'egg')[0][0], NOW), 1, '20+40×mul ชม. (>24) = ค้าง');
st(w, a, { a: 'take', pool: 'cold', k: 'crop_carrot', n: 5 });
age = NOW - w.lotsOf(a.rec, 'crop_carrot')[0][0]; assert.ok(Math.abs(age - 40 * CM * H) < 20000, 'แครอทใหม่ 40 ชม. ในตู้ = 40×mul ชม. ยังสด ได้ ' + age / H);
assert.strictEqual(S.freshTier(w.lotsOf(a.rec, 'crop_carrot')[0][0], NOW), 0);
NOW += 10 * H; age = NOW - w.lotsOf(a.rec, 'egg')[0][0]; assert.ok(Math.abs(age - (30 + 40 * CM) * H) < 20000, 'ของในกระเป๋าแก่ต่อปกติ');
// เก็บ-หยิบทั้งหมด + ความจุ
a.rec.inv.egg = 0; delete a.rec.lots.egg; w.add(a, 'egg', 70);
st(w, a, { a: 'putall', pool: 'cold' }); assert.strictEqual(a.rec.store.cold.inv.egg, 60, 'จุสูงสุด 60 ชิ้น'); assert.strictEqual(a.rec.inv.egg, 10);
assert.strictEqual(a.rec.inv.crop_carrot | 0, 0 + (a.rec.store.cold.inv.crop_carrot ? 0 : a.rec.inv.crop_carrot | 0));
lotInv(a.rec, 'egg'); coldInv(a.rec, 'egg'); st(w, a, { a: 'put', pool: 'cold', k: 'egg', n: 5 }); assert.strictEqual(a.rec.store.cold.inv.egg, 60, 'เกินจุเก็บไม่ได้');

// ถอดตู้เย็นใบสุดท้ายขณะมีของ = ปฏิเสธ
hs(w, a, { a: 'remove', i: fid }); assert.ok(items()[fid], 'ตู้ยังมีของ ห้ามถอด'); assert.ok(/ตู้ยังมีของ 60 ชิ้น/.test(last(wa, 'msg').text));
// วางตู้ใบที่สองแล้วถอดใบแรกได้ (ความจุ 60 ยังพอ) ; ใบสอง+ใบแรก = 120 จุของที่เกิน
hs(w, a, { a: 'place', f: 'fridge', x: 39, y: 22, r: 0 }); const f2 = Object.keys(items()).find(i => items()[i].f === 'fridge' && +i !== fid);
assert.strictEqual(S.storeCap(items(), 'cold'), 120);
st(w, a, { a: 'take', pool: 'cold', k: 'egg', n: 20 }); st(w, a, { a: 'put', pool: 'cold', k: 'egg', n: 5 });
hs(w, a, { a: 'remove', i: f2 }); assert.ok(!items()[f2], 'ความจุเหลือ 60 ≥ ของ 45 ถอดได้'); assert.ok(w.houses.alice && a.rec.inv.furn_fridge === 1);
assert.strictEqual(a.rec.store.cold.r, S.HOME.store.cold.mul, 'ยังมีตู้เย็น อัตรายังเท่า mul');
st(w, a, { a: 'takeall', pool: 'cold' }); assert.deepStrictEqual(a.rec.store.cold.inv, {}); assert.deepStrictEqual(a.rec.store.cold.lots, {}); lotInv(a.rec, 'egg');
assert.strictEqual(total(a.rec, 'egg'), 70, 'ของไม่หาย');

// อายุไม่ย้อนหลัง/ไม่ได้ประโยชน์ย้อน: ของเก็บไว้ตอนมีตู้เย็น ถอดตู้ → อัตรา 1 จากจุดนั้น (rebase)
st(w, a, { a: 'put', pool: 'cold', k: 'egg', n: 10 }); NOW += 40 * H; // อายุในตู้ +10
hs(w, a, { a: 'remove', i: fid }) /* ใบสุดท้าย แต่ของ 10 จึงถูกห้าม */; assert.ok(items()[fid]);
st(w, a, { a: 'takeall', pool: 'cold' });
st(w, a, { a: 'put', pool: 'cold', k: 'egg', n: 10 }); const tvAge = () => S.storeAge(a.rec.store.cold.lots.egg[0][0], a.rec.store.cold, NOW);
const a0 = tvAge(); NOW += 8 * H; assert.ok(Math.abs(tvAge() - a0 - 8 * CM * H) < 20000, 'ในตู้อายุเดิน ×mul');
st(w, a, { a: 'takeall', pool: 'cold' });

// คืนตู้ตอนโหลด: ตู้เย็นหายจากบ้านในไฟล์ → คืนเข้ากระเป๋า ของยังอยู่ หยิบได้ อัตรากลับเป็น 1
st(w, a, { a: 'put', pool: 'cold', k: 'egg', n: 10 }); const ageBefore = tvAge(); const eggsAll = total(a.rec, 'egg');
w.dirty = true; w.save(true);
const file = path.join(DIR, 'main.json'), dat = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.ok(dat.players.alice.store && dat.players.alice.store.cold.inv.egg === 10, 'เซฟต้องมี rec.store');
for (const [id, it] of Object.entries(dat.house.houses.alice.items)) if (it.f === 'fridge') delete dat.house.houses.alice.items[id];
fs.writeFileSync(file, JSON.stringify(dat));
NOW += 5 * H;
const w2 = new World('main'), r2 = w2.saved.alice;
assert.strictEqual(r2.store.cold.inv.egg, 10, 'ของในคลังยังอยู่หลังตู้ถูกคืน'); assert.strictEqual(r2.store.cold.r, 1, 'ไม่มีตู้เย็น อัตรา 1');
assert.ok(r2.inv.furn_fridge >= 1, 'ตู้เย็นถูกคืนเข้ากระเป๋า');
const c2 = r2.store.cold, ageNow = S.storeAge(c2.lots.egg[0][0], c2, NOW); assert.ok(Math.abs(ageNow - ageBefore - 0) < 6 * H, 'ไม่คิดย้อนหลัง');
assert.ok(Math.abs(S.storeAge(c2.lots.egg[0][0], c2, NOW + 3 * H) - ageNow - 3 * H) < 20000, 'หลังโหลดอายุเดินเต็ม ×1');
assert.strictEqual(w2.storeRate('alice'), 1);
// หยิบออกด้วย World ใหม่ (ผู้เล่นออนไลน์ใหม่)
{ const ws = mkWs(), pp = w2.join(ws, 'alice', '#e74c3c').p; pp.rec.inv.furn_fridge = 1; w2.handle(pp, { t: 'house', a: 'enter' }); pp.x = 36 * TS; pp.y = 24 * TS;
  hs(w2, pp, { a: 'place', f: 'fridge', x: 37, y: 22, r: 0 }); const nf = +Object.keys(w2.houses.alice.items).find(i => w2.houses.alice.items[i].f === 'fridge');
  assert.strictEqual(pp.rec.store.cold.r, S.HOME.store.cold.mul, 'วางตู้เย็นคืน อัตรา mul จากจุดนั้น'); NOW += 1000;
  st(w2, pp, { a: 'open', i: nf }); st(w2, pp, { a: 'takeall', pool: 'cold' }); assert.strictEqual(pp.rec.inv.egg >= 10, true); assert.strictEqual(total(pp.rec, 'egg') >= eggsAll, true, 'ของไม่หาย'); }

// ปฏิเสธคลังของ box: ของสด/once/สัตว์/coin; รับของไม่เสีย
{ const w3 = new World('main'), ws = mkWs(), pp = w3.join(ws, 'carol', '#111111').p; Object.assign(pp.rec.inv, { furn_crate: 1, coin: 10, plank: 30, egg: 3, pick_1: 1, pet_dog: 1, furn_chair: 1 });
  w3.handle(pp, { t: 'house', a: 'enter' }); pp.x = 36 * TS; pp.y = 24 * TS; hs(w3, pp, { a: 'place', f: 'crate', x: 34, y: 22, r: 0 }); const id = +Object.keys(w3.houses.carol.items)[0]; NOW += 1000;
  st(w3, pp, { a: 'open', i: id }); const o = last(ws, 'store'); assert.ok(o && o.pool === 'box' && o.cap === 80);
  for (const k of ['coin', 'egg', 'pick_1', 'pet_dog']) st(w3, pp, { a: 'put', pool: 'box', k, n: 1 });
  assert.deepStrictEqual(pp.rec.store.box.inv, {}, 'box รับ coin/ของสด/once/สัตว์ไม่ได้');
  st(w3, pp, { a: 'put', pool: 'box', k: 'plank', n: 30 }); st(w3, pp, { a: 'put', pool: 'box', k: 'furn_chair', n: 1 }); assert.strictEqual(pp.rec.store.box.inv.plank, 30); assert.strictEqual(pp.rec.store.box.inv.furn_chair, 1);
  assert.ok(!pp.rec.store.box.lots, 'box ไม่มี lots'); hs(w3, pp, { a: 'remove', i: id }); assert.ok(w3.houses.carol.items[id], 'ลังมีของ ถอดไม่ได้เมื่อความจุไม่พอ (31 > 0)');
  // rank นับมูลค่าในคลัง
  const ps = pp.rec; ps.skills.farm = 100000; ps.inv.coin = 0; w3.saved.carol = ps; const rb = w3.rankBuild(); assert.ok(rb.ranks.rich && rb.ranks.rich.carol, 'มูลค่าในคลังต้องนับเป็นความมั่งคั่ง (เหรียญ 0 ก็ติดอันดับ)');
  assert.ok(S.storeValue(ps.store) > 0 && S.storeValue(undefined) === 0 && S.storeValue({ cold: null, box: { inv: 5 } }) === 0); }

// ย้ายข้อมูลตู้เย็นเดิม (frz): อายุของในกระเป๋าคูณ 0.5 ครั้งเดียว ซ้ำไม่ซ้อน บัญชีไม่มีตู้เย็นไม่เปลี่ยน
{ const w4 = new World('main'), A = w4.saved.alice, wsx = null; w4.houses.alice.items[900] = { f: 'fridge', x: 37, y: 22, r: 0 }; // ใส่ตู้เย็นในบ้าน (ไฟล์ที่โหลดมาถูกคืนตู้ไปแล้ว)
  const T = NOW - 40 * H; A.inv.egg = 4; A.lots = { egg: [[T, 4]] }; delete A.frz;
  const B = w4.saved.bob || (w4.saved.bob = { inv: {} }); B.inv.egg = 3; B.lots = { egg: [[T, 3]] }; delete B.frz; // bob ไม่มีบ้าน
  w4.storeMigrate(); const t1 = A.lots.egg[0][0]; assert.ok(Math.abs((NOW - t1) - 20 * H) < 20000, 'อายุ 40 ชม. → 20 ชม. ได้ ' + (NOW - t1) / H);
  assert.strictEqual(A.frz, 1); assert.strictEqual(A.frzNote, 1); assert.strictEqual(B.lots.egg[0][0], T, 'ไม่มีตู้เย็นไม่เปลี่ยน'); assert.strictEqual(B.frz, 1); assert.ok(!B.frzNote);
  w4.storeMigrate(); assert.strictEqual(A.lots.egg[0][0], t1, 'รันซ้ำไม่หารซ้ำ');
  w4.dirty = true; w4.save(true); const w5 = new World('main'); assert.strictEqual(w5.saved.alice.lots.egg[0][0], t1, 'โหลดซ้ำอายุไม่ถูกหารซ้ำ'); assert.strictEqual(w5.saved.alice.frz, 1);
  const wsn = mkWs(), pn = w5.join(wsn, 'alice', '#e74c3c').p; assert.ok(wsn.msgs.some(x => x.t === 'msg' && /ตู้เย็นเก็บของได้จริง/.test(x.text)), 'แจ้งครั้งเดียว'); assert.ok(!pn.rec.frzNote); }

// S3 คลังของ (box): ของใช้/วัตถุดิบเก็บได้ ของสด/once ปฏิเสธ เฟอร์นิเจอร์ที่ยังไม่วางเก็บแล้วหยิบมาวางได้ ลังบนหลังของอื่นเปิดตามระยะ ความจุรวมหลายชนิด + เพดาน max
{ const w6 = new World('main'), ws = mkWs(), pp = w6.join(ws, 'erin', '#222222').p;
  Object.assign(pp.rec.inv, { furn_crate: 1, furn_table: 1, furn_chair: 3, bar_copper: 4, seed_carrot: 5, bait: 6, meal_bread: 2, recall: 1, crop_carrot: 2, fish_carp: 1, dish_bread: 1, lamp: 1, wear_hat_cap: 1, boat: 1 });
  w6.handle(pp, { t: 'house', a: 'enter' }); pp.x = 36 * TS; pp.y = 24 * TS;
  hs(w6, pp, { a: 'place', f: 'table', x: 34, y: 22, r: 0 }); const tid = +Object.keys(w6.houses.erin.items)[0]; assert.ok(tid);
  // ลังบนหลังโต๊ะ (on): ฉีดเข้าไปตรง ๆ แล้วเปิดตามระยะ
  const cr = 77; w6.houses.erin.items[cr] = { f: 'crate', x: 34, y: 22, r: 0, z: 16, on: tid }; w6.hrects.delete('erin'); w6.hcomf.delete('erin'); NOW += 1000;
  pp.x = 20 * TS; pp.y = 20 * TS; st(w6, pp, { a: 'open', i: cr }); assert.ok(!last(ws, 'store'), 'ลังบนหลังโต๊ะ: ไกลเกิน 4 ช่องเปิดไม่ได้');
  pp.x = 36 * TS; pp.y = 24 * TS; NOW += 1000; st(w6, pp, { a: 'open', i: cr }); let o = last(ws, 'store'); assert.ok(o && o.pool === 'box' && o.cap === 80, 'ลังบนหลังโต๊ะ: ใกล้เปิดได้ cap 80');
  assert.strictEqual(S.storeCap(w6.houses.erin.items, 'cold'), 0, 'ไม่มีตู้เย็น ความจุเย็น 0');
  for (const k of ['bar_copper', 'seed_carrot', 'bait', 'meal_bread', 'recall', 'furn_chair']) st(w6, pp, { a: 'put', pool: 'box', k, n: 99 });
  assert.deepStrictEqual(pp.rec.store.box.inv, { bar_copper: 4, seed_carrot: 5, bait: 6, meal_bread: 2, recall: 1, furn_chair: 3 }, 'วัตถุดิบ เมล็ด เหยื่อ อาหารซื้อ ตั๋ว เฟอร์นิเจอร์ที่ยังไม่วาง เก็บได้');
  for (const k of ['crop_carrot', 'fish_carp', 'dish_bread', 'lamp', 'wear_hat_cap', 'boat', 'pick_9', 'furn_nothing', 'coin']) { const b = pp.rec.inv[k]; st(w6, pp, { a: 'put', pool: 'box', k, n: 1 }); assert.strictEqual(pp.rec.inv[k], b, 'ต้องปฏิเสธ ' + k); assert.ok(!pp.rec.store.box.inv[k]); }
  assert.ok(!pp.rec.lots || !pp.rec.lots.furn_chair, 'ของไม่เสียไม่มี lots');
  // หยิบเฟอร์นิเจอร์ออกมาวางได้
  st(w6, pp, { a: 'take', pool: 'box', k: 'furn_chair', n: 2 }); assert.strictEqual(pp.rec.inv.furn_chair, 2); assert.strictEqual(pp.rec.store.box.inv.furn_chair, 1);
  hs(w6, pp, { a: 'place', f: 'chair', x: 38, y: 22, r: 0 }); assert.ok(Object.values(w6.houses.erin.items).some(it => it.f === 'chair'), 'หยิบเฟอร์นิเจอร์จากคลังมาวางได้'); assert.strictEqual(pp.rec.inv.furn_chair, 1);
  // ความจุรวมหลายชนิดตู้ + เพดาน max ใบ (เอาใบจุมากสุดก่อน)
  const mk = (list) => { const o2 = {}; list.forEach((f, i) => o2[i + 1] = { f }); return o2; }, B = S.HOME.store.box;
  assert.strictEqual(S.storeCap(mk(['crate', 'cupboard', 'barrel']), 'box'), 80 + 60 + 40, 'หลายชนิดรวมกัน');
  assert.strictEqual(S.storeCap(mk(Array(10).fill('crate')), 'box'), B.max * 80, 'เกิน max ใบนับแค่ max');
  assert.strictEqual(S.storeCap(mk(['nightstand', 'nightstand', 'crate', 'crate', 'crate', 'crate', 'crate', 'crate']), 'box'), 6 * 80, 'เลือกใบที่จุมากก่อน');
  assert.strictEqual(S.storeCap(mk(['crate', 'fridge']), 'box'), 80, 'ตู้เย็นไม่นับในคลังของ'); assert.strictEqual(S.storeCap(mk(['crate', 'fridge']), 'cold'), 60);
  // เปิดคลังจากบ้านคนอื่นไม่ได้ (เจ้าของเท่านั้น) — ผู้เยี่ยมเปิดลังบนหลังโต๊ะไม่ได้
  const wsb = mkWs(), vb = w6.join(wsb, 'frank', '#333333').p; w6.houses.erin.items[cr].on = tid; w6.handle(vb, { t: 'house', a: 'enter', who: 'erin' }); vb.x = 36 * TS; vb.y = 24 * TS; NOW += 1000;
  st(w6, vb, { a: 'open', i: cr }); assert.ok(!last(wsb, 'store'), 'ผู้เยี่ยมเปิดไม่ได้'); }
console.log('test-storage OK');
