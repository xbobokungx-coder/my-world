// ทดสอบค่าสถานะสัตว์เลี้ยง: แต้มตามราคา • ผลเฉพาะตอนพาออก/ไม่ป่วย/อิ่มพอ • XP พลังงาน และโชคเพิ่มผลผลิต
// รัน: node tools/test-pet.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-pet-');
const { World } = require('../server.js'), S = require('../public/shared.js');

// แต้มรวมตามราคา: ราคาแพงกว่า = แต้มรวมมากกว่า (≈ ราคา ÷ 100) ตัวละ 1–3 ค่า
{
  const ids = Object.keys(S.COMPANIONS).sort((a, b) => S.COMPANIONS[a].price - S.COMPANIONS[b].price);
  let prev = 0;
  for (const id of ids) {
    const C = S.COMPANIONS[id], pts = Object.values(C.st).reduce((a, b) => a + b, 0);
    assert.ok(pts > prev, `${id}: แต้มรวม ${pts} ต้องมากกว่าตัวที่ถูกกว่า (${prev})`); prev = pts;
    assert.ok(Math.abs(pts - C.price / 100) <= 0.6, `${id}: แต้ม ${pts} ต้องใกล้ราคา ${C.price} ÷ 100`);
    assert.ok(Object.keys(C.st).length >= 1 && Object.keys(C.st).every(k => ['xp', 'spd', 'luck'].includes(k)), `${id}: ชนิดค่าสถานะ`);
  }
  assert.strictEqual(new Set(ids.map(id => JSON.stringify(S.COMPANIONS[id].st))).size, ids.length, 'แต่ละตัวค่าไม่ซ้ำกัน');
}

// ผลตามอารมณ์: อิ่มเต็ม = เต็ม • หิว = ครึ่ง • หิวจัด/ป่วย = ไม่มี
{
  const full = S.petBonus('capybara', 100, false), half = S.petBonus('capybara', 30, false), none = S.petBonus('capybara', 10, false), sick = S.petBonus('capybara', 100, true);
  assert.ok(Math.abs(full.spd - 0.08) < 1e-9 && Math.abs(full.xp - 0.06) < 1e-9 && Math.abs(full.luck - 0.04) < 1e-9, 'คาปิบาร่าอิ่ม: 🏃8% 📚6% 🍀4%');
  assert.ok(Math.abs(half.spd - 0.04) < 1e-9, 'หิว = ครึ่งเดียว');
  assert.deepStrictEqual([none.xp, none.spd, none.luck, sick.xp, sick.spd, sick.luck], [0, 0, 0, 0, 0, 0], 'หิวจัด/ป่วย = ไม่มีผล');
  assert.ok(/ลูกสุนัข.*🏃\+6%.*🍀\+4%/.test(S.itemInfo('pet_dog').name), 'ชื่อในร้านโชว์ค่าสถานะ');
}

const w = new World('pettest');
const ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } };
const p = w.join(ws, 'Petty', '#3498db', false).p;
p.rec.inv.coin = 99999; p.rec.inv.pet_capybara = 1; p.rec.inv.pet_bird = 1; w.dirty = false;
const xpOf = () => p.rec.skills.farm || 0, enOf = () => w.enOf(p).v;
const run = (n, f) => { for (let i = 0; i < n; i++) f(); };

// ไม่มีสัตว์ออกมา = ไม่มีโบนัส
p.pet = ''; p.rec.skills.farm = 0; run(1000, () => w.addXp(p, 'farm', 10));
assert.strictEqual(xpOf(), 10000, 'ไม่พาสัตว์ออก: XP ปกติ');
// นก (📚+6%): 1000 ครั้ง × 10 XP ≈ 10600 (ปัดสุ่มตามเศษ)
w.setPet(p, 'bird', 'follow'); p.rec.skills.farm = 0; run(1000, () => w.addXp(p, 'farm', 10));
assert.ok(xpOf() > 10400 && xpOf() < 10800, `นก: XP ควร ≈ +6% ได้ ${xpOf()}`);
// XP น้อยๆ ไม่สูญ: 1 XP × 5000 ครั้ง ≈ 5300
p.rec.skills.farm = 0; run(5000, () => w.addXp(p, 'farm', 1));
assert.ok(xpOf() > 5150 && xpOf() < 5450, `XP 1 หน่วยต้องปัดสุ่มไม่สูญ ได้ ${xpOf()}`);
// นกหิวจัด/ป่วย = ไม่มีผล
w.petSt(p, 'bird').h = 10; p.rec.skills.farm = 0; run(1000, () => w.addXp(p, 'farm', 10)); assert.strictEqual(xpOf(), 10000, 'หิวจัด: ไม่มีโบนัส');
w.petSt(p, 'bird').h = 100; w.petSt(p, 'bird').sick = true; p.rec.skills.farm = 0; run(1000, () => w.addXp(p, 'farm', 10)); assert.strictEqual(xpOf(), 10000, 'ป่วย: ไม่มีโบนัส');
w.petSt(p, 'bird').sick = false;
// โชค: แมว 🍀+6% / ได้ผลผลิตเพิ่มเป็นสัดส่วน • ไม่พาออกไม่ได้
{
  p.rec.inv.pet_cat = 1; w.setPet(p, 'cat', 'follow'); let hit = 0; const N = 20000; for (let i = 0; i < N; i++) if (w.petLuck(p, 'x')) hit++;
  assert.ok(hit / N > 0.05 && hit / N < 0.07, `แมว: โอกาสโชค ≈ 6% ได้ ${(hit / N * 100).toFixed(2)}%`);
  w.setPet(p, '', 'follow'); hit = 0; for (let i = 0; i < 2000; i++) if (w.petLuck(p, 'x')) hit++; assert.strictEqual(hit, 0, 'ไม่พาสัตว์ออก: ไม่มีโชค');
}
// ===== ความผูกพัน (bond) / ระดับ / ลูบหัว =====
{
  const L = S.PETLV, mk = n => { const q = w.join({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }, n, '#3498db', false).p; q.rec.inv.coin = 9999; q.rec.inv.pet_dog = 1; q.rec.inv.petfood = 50; return q; };
  // ระดับ + โบนัสคูณ: lv1 = ค่าเดิมทุกตัว • lv5 คาปิบาร่า 12/9/6
  assert.strictEqual(S.petLevel(undefined), 1); assert.strictEqual(S.petLevel(299), 1); assert.strictEqual(S.petLevel(300), 2); assert.strictEqual(S.petLevel(4000), 5); assert.strictEqual(S.petLevel(NaN), 1);
  for (const id of Object.keys(S.COMPANIONS)) assert.deepStrictEqual(S.petBonus(id, 100, false, 1), S.petBonus(id, 100, false), id + ' lv1 = เดิม');
  const c5 = S.petBonus('capybara', 100, false, 5); assert.ok(Math.abs(c5.spd - 0.12) < 1e-9 && Math.abs(c5.xp - 0.09) < 1e-9 && Math.abs(c5.luck - 0.06) < 1e-9, 'ระดับ 5 คาปิบาร่า');
  assert.ok(Math.abs(S.petBonus('cat', 100, false, 5).luck - 0.09) < 1e-9, 'แมวระดับ 5 🍀9%');
  // ของขวัญรวมสูงสุดต่อวัน ≤ ~30 เหรียญ
  { const mx = Math.max(...L.gift.table.map(([k]) => S.itemInfo(k).buy || 0)) * Math.max(...L.gift.perDay); assert.ok(mx <= 30, 'ของขวัญสูงสุด/วัน ' + mx); }
  // ทิ้งตัวละครไว้เฉยๆ = ไม่ได้ bond
  const a = mk('IdleA'); w.setPet(a, 'dog', 'follow'); a.activeAt = Date.now() - L.activeMs - 5000; run(50, () => w.petTick15(a));
  assert.ok(!(w.petSt(a, 'dog').b > 0), 'AFK ไม่ได้ bond');
  // มีกิจกรรม = ได้ • เซฟเก่าไม่มี b = ระดับ 1
  a.activeAt = Date.now(); assert.strictEqual(w.petLv(a, 'dog'), 1); w.petTick15(a); assert.ok(w.petSt(a, 'dog').b > 0, 'active ได้ bond');
  // เพดานต่อวัน: tick/feed/pat รวมไม่เกิน dayCap
  const b = mk('CapB'); w.setPet(b, 'dog', 'follow'); b.activeAt = Date.now() + 1e9;
  for (let i = 0; i < 2000; i++) { w.petSt(b, 'dog').h = 100; w.petTick15(b); b.activeAt = Date.now(); }
  assert.strictEqual(w.petSt(b, 'dog').b, L.dayCap, 'ชนเพดานวัน'); w.petSt(b, 'dog').pat = 0; w.petCare(b, 'pat'); w.petSt(b, 'dog').h = 10; w.petCare(b, 'feed');
  assert.strictEqual(w.petSt(b, 'dog').b, L.dayCap, 'ลูบ/ให้อาหารไม่เกินเพดาน');
  assert.strictEqual(w.petLv(b, 'dog'), 2, 'ถึงระดับ 2'); // 360 ≥ 300
  w.petSt(b, 'dog').bd = '1999-1-1'; w.petSt(b, 'dog').pat = 0; w.petCare(b, 'pat'); assert.ok(w.petSt(b, 'dog').b > L.dayCap, 'ขึ้นวันใหม่ได้เพิ่มอีก');
  // ลูบหัว: คูลดาวน์ / ป่วย / ไกล
  const c = mk('PatC'); w.setPet(c, 'dog', 'follow'); w.petCare(c, 'pat'); const b1 = w.petSt(c, 'dog').b; assert.strictEqual(b1, L.pat); w.petCare(c, 'pat'); assert.strictEqual(w.petSt(c, 'dog').b, b1, 'คูลดาวน์');
  w.petSt(c, 'dog').pat = Date.now() - L.patCdMs - 1; w.petCare(c, 'pat'); assert.strictEqual(w.petSt(c, 'dog').b, b1 + L.pat, 'พ้นคูลดาวน์ได้ใหม่');
  w.setPet(c, 'dog', 'play'); c.pax = c.x + L.patRange + 5; w.petSt(c, 'dog').pat = 0; const b2 = w.petSt(c, 'dog').b; w.petCare(c, 'pat'); assert.strictEqual(w.petSt(c, 'dog').b, b2, 'ไกลเกิน patRange');
  // ป่วยไม่ได้ bond (tick/pat/feed)
  const d = mk('SickD'); w.setPet(d, 'dog', 'follow'); const sd = w.petSt(d, 'dog'); sd.sick = true; sd.h = 100; w.petTick15(d); w.petCare(d, 'pat'); sd.h = 10; w.petCare(d, 'feed');
  assert.ok(!(sd.b > 0), 'ป่วยไม่ได้ bond');
  // ตายแล้ว bond หาย
  const e = mk('DieE'); w.setPet(e, 'dog', 'follow'); w.petSt(e, 'dog').b = 1000; w.petSt(e, 'dog').sick = true; w.petSt(e, 'dog').sickMs = S.PETCARE.sickDieMs; w.petTick15(e);
  assert.ok(!e.rec.pst.dog && !e.rec.inv.pet_dog, 'ตายแล้ว bond หาย');
  // plv ส่งเฉพาะระดับ > 1
  const f = mk('PlvF'); w.setPet(f, 'dog', 'follow'); assert.ok(!('plv' in w.pubFull(f)) && !('plv' in w.petPubOf(f)), 'lv1 ไม่มี plv'); w.petSt(f, 'dog').b = 900;
  assert.strictEqual(w.pubFull(f).plv, 3); assert.strictEqual(w.petPubOf(f).plv, 3);
  // เลื่อนระดับ: ทุกคนในห้องได้ {t:'pet', plv} ทันที (ผู้สังเกตการณ์ที่เป็นคนอื่น)
  { const wsO = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }; w.join(wsO, 'Obs', '#e67e22', false);
    const h = mk('LvH'); w.setPet(h, 'dog', 'follow'); w.petSt(h, 'dog').b = L.need[1] - 1; wsO.msgs.length = 0;
    w.petBond(h, 'dog', 5, 'pat'); const m1 = wsO.msgs.filter(m => m.t === 'pet' && m.id === h.id).pop();
    assert.ok(m1 && m1.plv === 2 && m1.pet === 'dog', 'เลื่อนระดับ: คนอื่นได้ pet plv=2');
    wsO.msgs.length = 0; w.petBond(h, 'dog', 5, 'pat'); assert.ok(!wsO.msgs.some(m => m.t === 'pet' && m.id === h.id), 'ไม่เลื่อน = ไม่ push'); }
  // ของขวัญรายวัน: lv5 ไม่เกิน perDay
  const g = mk('GiftG'); w.setPet(g, 'dog', 'follow'); w.petSt(g, 'dog').b = 4000; w.petSt(g, 'dog').bd = w.dayStr(0); w.petSt(g, 'dog').bn = L.dayCap;
  const sg = L.gift.chance; L.gift.chance = 1; g.activeAt = Date.now(); const f0 = g.rec.inv.petfood + (g.rec.inv.bait || 0); run(30, () => { w.petSt(g, 'dog').h = 100; w.petTick15(g); }); L.gift.chance = sg;
  assert.strictEqual(g.rec.inv.petfood + (g.rec.inv.bait || 0) - f0, L.gift.perDay[4], 'ของขวัญ/วันตามระดับ');
  console.log('ผ่าน: bond สัตว์เลี้ยง');
}
console.log('ผ่าน: Stat สัตว์เลี้ยง');
process.exit(0);
