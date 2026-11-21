// ทดสอบความสบายของบ้าน + บัฟหลับสบาย + ชุดห้อง (S.houseComfort, house.js sitRecover/restCheck, hunger.js drainMul/eatMulAt)
// รัน: node tools/test-home-comfort.js
const assert = require('assert');
require('./testlib');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-comfort-');
let NOW = Date.parse('2026-11-21T10:00:00+07:00'); Date.now = () => NOW;
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, HC = S.HOME.comfort;
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const last = (ws, t) => { for (let i = ws.msgs.length - 1; i >= 0; i--) if (ws.msgs[i].t === t) return ws.msgs[i]; return null; };
const mk = list => { const o = {}; list.forEach((f, i) => o[i + 1] = { f, x: 30, y: 24, r: 0 }); return o; };
const cm = list => S.houseComfort(mk(list));

// ---------- ฟังก์ชันล้วน ----------
assert.strictEqual(cm([]).v, 0); assert.strictEqual(cm([]).tier, 0);
assert.strictEqual(S.houseComfort(undefined).v, 0); assert.strictEqual(S.houseComfort({ 1: null, 2: { f: 'nope' } }).v, 0);
assert.strictEqual(cm(Array(50).fill('plant')).v, 1, 'ต้นไม้ 50 ต้น = สบาย 1 (ชนิดไม่ซ้ำ)');
const DEC = ['plant', 'vase', 'painting', 'clock', 'teddy', 'lantern', 'floorlamp', 'poster'], LIV = ['chair', 'sofa', 'armchair', 'stool', 'coffeetable', 'tv'], KIT = ['table', 'fridge', 'stove', 'counter', 'sink', 'cupboard'];
assert.strictEqual(cm(DEC).v, HC.cap.decor, 'หมวดตัดที่เพดาน (decor 8 ชนิด → 6)');
assert.strictEqual(cm(['piano']).v, HC.pts.lux, 'ราคา ≥ luxPrice = 2'); assert.strictEqual(cm(['statue']).v, HC.pts.rare, 'rare = 3');
assert.strictEqual(cm(['statue', 'fountain', 'flag', 'cat']).v, HC.cap.rare, 'rare ตัดที่เพดาน 4');
assert.strictEqual(cm(['screen_wood', 'screen_shoji', 'screen_bamboo']).v, HC.cap.divider, 'divider เพดาน 2');
// ขั้นตามเกณฑ์ (ชุดครัวไม่มีโบนัสความสบาย)
const dv = n => DEC.slice(0, n), lv = n => LIV.slice(0, n), kv = n => KIT.slice(0, n);
assert.strictEqual(cm(dv(5)).tier, 0); assert.strictEqual(cm(dv(6)).tier, 1);
assert.strictEqual(cm([...dv(6), ...lv(6), ...kv(1)]).v, 13); assert.strictEqual(cm([...dv(6), ...lv(6), ...kv(1)]).tier, 1);
assert.strictEqual(cm([...dv(6), ...lv(6), ...kv(2)]).v, 14); assert.strictEqual(cm([...dv(6), ...lv(6), ...kv(2)]).tier, 2);
assert.strictEqual(cm([...dv(6), ...lv(6), ...kv(5)]).tier, 2); assert.strictEqual(cm([...dv(6), ...lv(6), ...kv(6), 'bed', 'bedsingle', 'bedking', 'wardrobe', 'nightstand']).tier, 3, 'วางครบ 24+ = บ้านในฝัน');
assert.deepStrictEqual(HC.tiers.length, HC.sitMul.length); assert.strictEqual(HC.sitMul[0], 1, 'ขั้น 0 = ×1');
// ชุดห้อง + ข้อความความคืบหน้า
let c = cm(['fridge', 'counter']); let k = c.sets.find(s => s.id === 'kitchen');
assert.deepStrictEqual([k.have, k.need, k.done], [2, 3, false]); assert.ok(/ครัว 2\/3 ขาดเตาแก๊ส/.test(k.txt), k.txt); assert.strictEqual(c.eatMul, 1);
c = cm(['fridge', 'stove', 'sink']); k = c.sets.find(s => s.id === 'kitchen'); assert.ok(k.done && /ครบแล้ว/.test(k.txt)); assert.strictEqual(c.eatMul, S.HOME.sets.kitchen.eatMul);
c = cm(['desk', 'officechair', 'globe']); assert.strictEqual(c.sets.find(s => s.id === 'study').done, true); assert.strictEqual(c.v, 3 + S.HOME.sets.study.comfort, 'โต๊ะ+เก้าอี้+ลูกโลก ชิ้นละ 1 + มุมอ่านครบ (comfort แทน XP)');
c = cm(['bed', 'dresser', 'floorlamp']); assert.strictEqual(c.restMul, S.HOME.sets.bedroom.restMul); c = cm(['chair', 'table', 'tv']); assert.strictEqual(c.sitTier, 1);
assert.strictEqual(S.sitMulOf(cm([...dv(6), ...lv(6), ...kv(2)]), true), HC.sitMul[2]); assert.strictEqual(S.sitMulOf(cm(['chair', 'table', 'tv']), false), HC.sitMul[1], 'นั่งเล่นครบ: นั่งได้ขั้นเพิ่ม'); assert.strictEqual(S.sitMulOf(cm(['chair', 'table', 'tv']), true), HC.sitMul[0], 'นอนไม่ได้ขั้นเพิ่ม');
assert.strictEqual(S.sitMulOf(null, false), 1);
assert.strictEqual(S.restMinutes(cm([])), 0); assert.strictEqual(S.restMinutes(cm([...dv(6), ...lv(6), ...kv(2)])), S.HOME.rest.mins[2]);

// ---------- เซิร์ฟเวอร์ ----------
const w = new World('main'), wa = mkWs(), wb = mkWs();
const a = w.join(wa, 'alice', '#e74c3c').p, b = w.join(wb, 'bob', '#3498db').p;
const set = (key, list) => { const h = w.houses[key] || (w.houses[key] = { items: {}, next: 1 }); h.items = {}; list.forEach((f, i) => h.items[i + 1] = { f, x: 36, y: 24, r: 0 }); h.next = list.length + 1; w.hrects.delete(key); w.hcomf.delete(key); };
const stand = p => { p.sit = null; };
w.handle(a, { t: 'house', a: 'enter' }); a.x = 36 * TS; a.y = 24 * TS;
let hm = last(wa, 'hcomfort'); assert.ok(hm && hm.v === 0 && hm.tier === 0 && Array.isArray(hm.sets) && hm.sets.length === 4 && hm.mine === true && hm.rest === 0, 'เข้าบ้านได้ hcomfort');
// วาง/ถอดส่ง hcomfort ใหม่ + แคชล้าง
a.rec.inv.furn_plant = 1; a.rec.inv.furn_fridge = 1; NOW += 1000; w.handle(a, { t: 'house', a: 'place', f: 'plant', x: 33, y: 22, r: 0 });
hm = last(wa, 'hcomfort'); assert.strictEqual(hm.v, 1, 'วางต้นไม้ → สบาย 1'); assert.strictEqual(w.houseComfortOf('alice').v, 1);
w.handle(a, { t: 'house', a: 'place', f: 'fridge', x: 38, y: 22, r: 0 }); assert.strictEqual(last(wa, 'hcomfort').v, 2); assert.ok(/ครัว 1\/3 ขาด/.test(last(wa, 'hcomfort').sets.find(s => s.id === 'kitchen').txt));
const pid = +Object.keys(w.houses.alice.items).find(i => w.houses.alice.items[i].f === 'plant'); w.handle(a, { t: 'house', a: 'remove', i: pid }); assert.strictEqual(last(wa, 'hcomfort').v, 1, 'ถอด → ลดลง');
// บอร์ดบ้านมีคะแนนความสบายเป็นคอลัมน์ ยังเรียงตามมูลค่า
w.handle(a, { t: 'house', a: 'board' }); { const row = last(wa, 'hboard').list.find(r => r.me); assert.ok(row && row.cm === 1 && row.ct === 0, 'hboard มี cm/ct'); }

// นั่งในบ้านฟื้นอิ่มตามขั้น: ขั้น 0 = +1 ต่อ tick เป๊ะ ขั้น 2 = ×2 ขั้น 1 สะสมเศษ
const sitOn = (p, key, f) => { const id = +Object.keys(w.houses[key].items).find(i => w.houses[key].items[i].f === f); NOW += 1000; p.lastAct = 0; w.handle(p, { t: 'act', i: id }); assert.ok(p.sit, 'นั่ง/นอนได้ ' + f); };
set('alice', ['chair']); a.x = 36 * TS; a.y = 24 * TS; sitOn(a, 'alice', 'chair'); a.rec.hunger = 50;
for (let i = 0; i < 5; i++) w.sitRecover(a); assert.strictEqual(a.rec.hunger, 55, 'ขั้น 0 ได้ +1/tick เท่าเดิม (5 วิ × 5 tick)');
stand(a); set('alice', ['chair', 'sofa', ...dv(6), ...kv(6)]); assert.strictEqual(w.houseComfortOf('alice').tier, 2); assert.strictEqual(w.houseComfortOf('alice').sitTier, 0);
sitOn(a, 'alice', 'chair'); a.rec.hunger = 50; w.sitRecover(a); assert.strictEqual(a.rec.hunger, 52, 'ขั้น 2 ฟื้น ×2 ต่อ tick'); for (let i = 0; i < 4; i++) w.sitRecover(a); assert.strictEqual(a.rec.hunger, 60, 'ขั้น 2: 5 tick = +10');
stand(a); set('alice', [...dv(6), ...lv(6)]); sitOn(a, 'alice', 'chair'); assert.strictEqual(w.houseComfortOf('alice').tier, 1); // v=12 ขั้น 1 (ชุดนั่งเล่นครบ → นั่งได้ขั้น +1)
{ const t = w.houseComfortOf('alice').tier; a.rec.hunger = 50; a.sitAcc = 0; w.sitRecover(a); w.sitRecover(a); assert.strictEqual(a.rec.hunger, 50 + Math.floor(2 * HC.sitMul[Math.min(3, t + w.houseComfortOf('alice').sitTier)]), 'สะสมเศษถูก'); }
// 100 เต็มแล้วไม่เกิน
stand(a); a.rec.hunger = 99.5; sitOn(a, 'alice', 'chair'); w.sitRecover(a); assert.ok(a.rec.hunger <= 100);
// ม้านั่งในเมือง: p.scene null เท่าเดิม ไม่ผ่านความสบาย
w.handle(a, { t: 'house', a: 'exit' }); a.sit = { x: 1, y: 1 }; a.rec.hunger = 50; w.sitRecover(a); assert.strictEqual(a.rec.hunger, 50 + S.PLAYER_HUNGER.sitGain, 'ม้านั่งในเมือง +sitGain เท่าเดิม'); stand(a);
w.sitRecover(a); assert.strictEqual(a.rec.hunger, 51, 'ไม่นั่งไม่ฟื้น');

// ---------- บัฟหลับสบาย ----------
const tierSet = ['bed', 'dresser', 'floorlamp', ...dv(6), ...lv(6), ...kv(2)].filter((f, i, arr) => arr.indexOf(f) === i);
w.handle(a, { t: 'house', a: 'enter' }); set('alice', tierSet); a.x = 36 * TS; a.y = 24 * TS;
const T = w.houseComfortOf('alice'), mins = S.restMinutes(T); assert.ok(T.tier >= 2 && mins > S.HOME.rest.mins[T.tier] - 1, 'บ้านขั้นสูง + ชุดห้องนอน ได้นานขึ้น'); assert.strictEqual(mins, Math.round(S.HOME.rest.mins[T.tier] * S.HOME.sets.bedroom.restMul));
sitOn(a, 'alice', 'bed'); const t0 = NOW; assert.ok(a.sit.lie);
NOW = t0 + S.HOME.rest.lieMs - 1000; w.restCheck(a); assert.ok(!a.rec.rest, 'นอน 59 วิ ยังไม่ได้บัฟ');
NOW = t0 + S.HOME.rest.lieMs; wa.msgs.length = 0; w.restCheck(a); assert.strictEqual(a.rec.rest, NOW + mins * 60000, 'นอนครบ 60 วิ ได้บัฟ'); assert.strictEqual(last(wa, 'hcomfort').rest, mins * 60000, 'hcomfort ส่งเวลาบัฟ');
assert.ok(wa.msgs.some(x => x.t === 'msg' && /หลับสบาย/.test(x.text)), 'toast 😴');
const r1 = a.rec.rest; NOW += 5000; w.restCheck(a); assert.strictEqual(a.rec.rest, r1, 'รอบนอนเดียวกันไม่ต่อซ้ำ');
// ต่อเวลาได้ ไม่สะสม
NOW += 10 * 60000; stand(a); sitOn(a, 'alice', 'bed'); NOW += S.HOME.rest.lieMs; w.restCheck(a); assert.strictEqual(a.rec.rest, NOW + mins * 60000, 'ต่อเวลาเป็นเต็มค่า ไม่บวกทบ'); assert.ok(a.rec.rest - NOW <= mins * 60000);
// ลุกก่อน 60 วิ แล้วนอนใหม่ นับใหม่
stand(a); a.rec.rest = 0; sitOn(a, 'alice', 'bed'); NOW += 40000; stand(a); sitOn(a, 'alice', 'bed'); NOW += 40000; w.restCheck(a); assert.ok(!a.rec.rest, 'นับ 60 วิใหม่ทุกครั้งที่นอน');
// ขั้น 0 = ไม่มีบัฟ
stand(a); set('alice', ['bed']); sitOn(a, 'alice', 'bed'); NOW += 61000; w.restCheck(a); assert.ok(!a.rec.rest, 'ขั้น 0 ไม่ได้บัฟ');
// นอนบ้านคนอื่นไม่ได้บัฟ + นั่งโซฟาไม่ได้บัฟ
set('alice', tierSet); w.handle(b, { t: 'house', a: 'enter', who: 'alice' }); b.x = 36 * TS; b.y = 24 * TS; sitOn(b, 'alice', 'bed'); NOW += 61000; w.restCheck(b); assert.ok(!b.rec.rest, 'นอนบ้านคนอื่นไม่ได้บัฟ');
b.rec.hunger = 50; b.sitAcc = 0; w.sitRecover(b); assert.ok(b.rec.hunger >= 51, 'แต่คนมาเยี่ยมได้ผลนั่ง/นอนสบายของบ้านนั้น'); stand(b); w.handle(b, { t: 'house', a: 'exit' });
stand(a); a.rec.rest = 0; sitOn(a, 'alice', 'chair'); NOW += 61000; w.restCheck(a); assert.ok(!a.rec.rest, 'นั่งไม่ใช่นอน ไม่ได้บัฟ');
// ความหิวลดช้าลง ไม่ซ้อนกับ BUFFS.hunger
stand(a); a.rec.rest = NOW + 60000; a.rec.buffs = {}; assert.strictEqual(w.drainMul(a), S.HOME.rest.mul, 'มีหลับสบาย ลด ×0.75');
a.rec.buffs.hunger = NOW + 60000; assert.strictEqual(w.drainMul(a), 1, 'มี BUFFS.hunger = ไม่ซ้อน (ใช้อิ่มทนตัวเดียว)');
delete a.rec.buffs.hunger; a.rec.rest = NOW - 1; assert.strictEqual(w.drainMul(a), 1, 'หมดบัฟ ×1'); a.rec.rest = NaN; assert.strictEqual(w.drainMul(a), 1, 'ค่าเพี้ยนไม่ทำให้พัง');
assert.ok(S.HOME.rest.mul > 0.5, 'หลับสบายอ่อนกว่าอิ่มทน (0.5)');

// ---------- ชุดครัว: กินในบ้านอิ่มเพิ่ม ไม่เกิน 100 ----------
w.handle(a, { t: 'house', a: 'exit' }); a.rec.hunger = 20; a.rec.inv.meal_bread = 5; w.eat(a, 'meal_bread'); assert.strictEqual(a.rec.hunger, 35, 'นอกบ้านเท่าเดิม +15');
w.handle(a, { t: 'house', a: 'enter' }); set('alice', ['fridge', 'stove', 'counter']); assert.ok(w.houseComfortOf('alice').sets.find(s => s.id === 'kitchen').done);
a.rec.hunger = 20; w.eat(a, 'meal_bread'); assert.strictEqual(a.rec.hunger, 20 + 15 * S.HOME.sets.kitchen.eatMul, 'ครัวครบอิ่ม +20%');
a.rec.hunger = 90; w.eat(a, 'meal_bread'); assert.strictEqual(a.rec.hunger, 100, 'ไม่เกิน 100');
set('alice', ['fridge', 'stove']); a.rec.hunger = 20; w.eat(a, 'meal_bread'); assert.strictEqual(a.rec.hunger, 35, 'ครัวไม่ครบ ไม่เพิ่ม');

// ---------- เซฟ/โหลด: rec.rest เป็นฟิลด์เสริม เซฟเก่าไม่พัง ----------
a.rec.rest = NOW + 12345; w.dirty = true; w.save(true); const w2 = new World('main'); assert.strictEqual(w2.saved.alice.rest, NOW + 12345, 'rec.rest คงอยู่หลังโหลด');
delete w2.saved.bob.rest; const wsx = mkWs(), pb = w2.join(wsx, 'bob', '#3498db').p; assert.strictEqual(w2.restLeft(pb), 0); assert.strictEqual(w2.drainMul(pb), 1, 'เซฟเก่าไม่มี rest ไม่พัง');
console.log('test-home-comfort OK');
