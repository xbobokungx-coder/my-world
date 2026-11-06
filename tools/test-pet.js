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
console.log('ผ่าน: Stat สัตว์เลี้ยง');
process.exit(0);
