// ทดสอบสัตว์ของใครของมัน: โผล่/หายตามออนไลน์ • เพดานต่อคน • ไก่ของขวัญ • ไม่ชุบ
// รัน: node tools/test-herd.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-herd-'));
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
// ไม่มีปุ่มชุบ / ไม่มี dead queue
assert.strictEqual(Object.keys(w.chest.dead || {}).length, 0);
w.chestHandle(a2, { a: 'revive', type: 'chicken' }); // no-op
assert.ok(!w.chest.dead.chicken);
console.log('ok herd: gift + cap', S.ANIMALS.chicken.cap, '+ despawn/respawn on leave/join');
