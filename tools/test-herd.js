// ทดสอบสัตว์ของใครของมัน: โผล่/หายตามออนไลน์ • เพดานต่อคน • ไก่ของขวัญ • ไม่ชุบ
// รัน: node tools/test-herd.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-herd-');
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('herdtest');
const mk = (name) => {
  const ws = { readyState: 1, send() {} };
  const r = w.join(ws, name, '#3498db', false);
  assert.ok(r.p, name + ' เข้าเกมได้');
  return r.p;
};
const a = mk('Alice'), b = mk('Bob');
assert.ok(a.rec.herdGift === 1 && a.rec.herd.some(x => x.type === 'chicken'), 'Alice ได้ไก่ของขวัญ');
assert.ok(b.rec.herd.some(x => x.type === 'chicken'), 'Bob ได้ไก่ของขวัญ');
assert.strictEqual(w.ownerCount(a.key, 'chicken'), 1, 'ไก่ของ Alice โผล่ในเล้า');
assert.strictEqual(w.animals.filter(x => x.owner === a.key).length, 1);
assert.strictEqual(w.animals.filter(x => x.owner === b.key).length, 1);
// ซื้อจนเต็ม cap
a.rec.inv.coin = 10000; a.rec.skills.animal = 0; w.nearShopKind = () => 'animal';
for (let i = 0; i < 3; i++) w.buy(a, 'animal_chicken', 1);
assert.strictEqual(w.ownerCount(a.key, 'chicken'), S.ANIMALS.chicken.cap, 'ซื้อครบ cap ต่อคน');
w.buy(a, 'animal_chicken', 1);
assert.strictEqual(w.ownerCount(a.key, 'chicken'), S.ANIMALS.chicken.cap, 'ซื้อเกิน cap ไม่ได้');
// ออกเกม = หายจากเล้า แต่ยังอยู่ใน herd
const nBefore = a.rec.herd.length;
w.leave(a);
assert.strictEqual(w.animals.filter(x => x.owner === 'alice').length, 0, 'ออกเกมแล้วสัตว์หายจากเล้า');
assert.ok(w.saved.alice.herd.length === nBefore && w.saved.alice.herd.length === S.ANIMALS.chicken.cap, 'สถานะเซฟใน herd');
// เข้าใหม่ = กลับมา
const a2 = mk('Alice');
assert.strictEqual(w.ownerCount(a2.key, 'chicken'), S.ANIMALS.chicken.cap, 'เข้าใหม่สัตว์กลับมาครบ');
assert.strictEqual(a2.rec.herdGift, 1, 'ไม่แจกไก่ซ้ำ');
console.log('ok herd: gift + cap', S.ANIMALS.chicken.cap, '+ despawn/respawn on leave/join');

// ดูแลสัตว์ (5 พ.ย. 2026): เจ้าของอยู่ในบ้าน/ถ้ำ/ทะเล = หยุดนับหิว/ป่วย • ไม่สุ่มป่วยตัวที่เจ้าของไม่อยู่ • เวลารักษา 10 นาที • บันทึกการตาย
{
  assert.strictEqual(S.SICK.graceMs, 10 * 60 * 1000, 'เวลารักษา 10 นาที');
  assert.strictEqual(S.ANIMAL_GRACE_MS, 8 * 60 * 1000);
  assert.ok(Object.values(S.ANIMALS).every(A => A.starveMin >= 40), 'สัตว์ทนหิวอย่างน้อย 40 นาที');
  const bob = [...w.players.values()].find(q => q.name === 'Bob'), al = [...w.players.values()].find(q => q.name === 'Alice');
  const an = q => w.animals.filter(x => x.owner === q.key), now = Date.now();
  for (const x of w.animals) { x.hunger = 80; x.sick = false; x.sickMs = 0; x.zero = 0; }
  al.scene = '@cave1'; w.tick(10, now); // Alice ขุดแร่อยู่ในถ้ำ
  assert.ok(an(al).every(x => x.hunger === 80), 'เจ้าของอยู่ในถ้ำ สัตว์ไม่หิวลง');
  assert.ok(an(bob).every(x => x.hunger < 80), 'เจ้าของอยู่ในเมือง สัตว์หิวลงปกติ');
  // สุ่มป่วย: ไม่เลือกตัวของ Alice (ไม่อยู่) แม้สุ่มได้ตัวแรกเสมอ
  const rnd = Math.random; Math.random = () => 0; w.sickTimer = 1e9; w.tick(1, now + 1000); Math.random = rnd;
  const sick = w.animals.filter(x => x.sick); assert.ok(sick.length === 1 && sick[0].owner === bob.key, 'ป่วยเฉพาะตัวที่เจ้าของอยู่ในเมือง');
  // ตัวที่ป่วยของ Bob ถ้า Bob เข้าบ้าน เวลาตายหยุดเดิน
  bob.scene = 'bob'; const ms0 = sick[0].sickMs; w.tick(30, now + 40000); assert.strictEqual(sick[0].sickMs, ms0, 'เจ้าของอยู่ในบ้าน เวลาป่วยไม่เดิน');
  bob.scene = null; al.scene = null;
  // หิวตาย + บันทึก event
  const dying = an(bob).find(x => !x.sick) || an(bob)[0]; dying.sick = false; dying.hunger = 0; dying.zero = S.ANIMAL_GRACE_MS + 1000; w.tick(1, now + 80000);
  assert.ok(!w.animals.includes(dying), 'หิวเกินเวลาแล้วตาย');
  console.log('ok herd: care (หยุดนับตอนเจ้าของไม่อยู่ / ป่วยเฉพาะตัวที่ทัน / ตายเมื่อเกินเวลา)');
}
