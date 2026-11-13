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

// WP-21: ไก่งวง (Lv7) แพะ (Lv9) + ชนิดที่ไม่รู้จักต้องไม่ถูกลบจากเซฟ
{
  const lvOrig = w.lv.bind(w);
  const c = mk('Carol'); c.rec.inv.coin = 100000; w.nearShopKind = () => 'animal';
  let L = 6; w.lv = (p, sk) => (p === c && sk === 'animal') ? L : lvOrig(p, sk);
  // เลเวลไม่ถึงถูกปฏิเสธ
  w.buy(c, 'animal_turkey', 1); assert.strictEqual(w.ownerCount(c.key, 'turkey'), 0, 'Lv6 ซื้อไก่งวงไม่ได้');
  L = 7; w.buy(c, 'animal_turkey', 1); assert.strictEqual(w.ownerCount(c.key, 'turkey'), 1, 'Lv7 ซื้อไก่งวงได้');
  w.buy(c, 'animal_goat', 1); assert.strictEqual(w.ownerCount(c.key, 'goat'), 0, 'Lv7 ซื้อแพะไม่ได้');
  L = 9; w.buy(c, 'animal_goat', 1); assert.strictEqual(w.ownerCount(c.key, 'goat'), 1, 'Lv9 ซื้อแพะได้');
  assert.strictEqual(c.rec.inv.coin, 100000 - S.ANIMALS.turkey.price - S.ANIMALS.goat.price, 'หักเงินถูก');
  for (const t of ['turkey', 'goat']) {
    const z = w.zone(t), an = w.animals.find(x => x.owner === c.key && x.type === t);
    assert.ok(an.x >= z.x0 && an.x <= z.x1 && an.y >= z.y0 && an.y <= z.y1, t + ' เกิดในคอกของตัวเอง');
    // ให้อาหาร → เริ่มผลิต → เก็บผลผลิต
    const A = S.ANIMALS[t]; c.x = an.x; c.y = an.y; c.rec.inv[A.feedItem] = 2; an.hunger = 10;
    const xp0 = c.rec.skills.animal || 0;
    c.lastAct = 0; w.handle(c, { t: 'act', tool: A.feedItem, tx: Math.floor(an.x / S.TS), ty: Math.floor(an.y / S.TS) });
    assert.ok(an.fed && an.hunger === 100 && c.rec.inv[A.feedItem] === 1, t + ' ให้อาหารได้');
    assert.ok((c.rec.skills.animal || 0) - xp0 === S.animalXp(S.ANIMAL_XP.feed, L), t + ' XP ให้อาหารตาม ANIMAL_XP.feed');
    an.fed = false; an.prod = true; an.feeder = c.key; c.x = an.x; c.y = an.y;
    c.lastAct = 0; w.handle(c, { t: 'act', tool: 'hand', tx: Math.floor(an.x / S.TS), ty: Math.floor(an.y / S.TS) });
    assert.ok((c.rec.inv[A.product] || 0) >= 1 && !an.prod, t + ' เก็บ ' + A.product + ' ได้');
    const info = S.itemInfo(A.product); assert.ok(info && info.sell > 0 && info.cat === 'animal', A.product + ' มี itemInfo');
    assert.ok(S.SELLABLE.includes(A.product) && S.sellCat(A.product) === 'animal' && S.perishable(A.product), A.product + ' ขายได้/เสียง่าย');
    assert.ok(S.SHOPS.animal.buy.includes('animal_' + t), t + ' มีในร้านสัตว์');
  }
  // XP: WP-21 จูนแล้ว (feed 2, cap 20 ไม่ตันที่ PERK_LV อีก, perLv 0.17) สูตร ×(1 + perLv × (min(เลเวล, cap) − from))
  assert.strictEqual(S.ANIMAL_XP.feed, 2); assert.strictEqual(S.ANIMAL_XP.cap, 20); assert.strictEqual(S.ANIMAL_XP.perLv, 0.17);
  for (const lv of [1, 5, 10, 15, 20]) assert.strictEqual(S.animalXp(10, lv), Math.round(10 * (1 + 0.17 * Math.max(0, Math.min(lv, 20) - 5))));
  // ราคาไข่/นมเดิมต้องไม่เปลี่ยน (เชฟใช้)
  assert.deepStrictEqual(['egg', 'duck_egg', 'milk'].map(k => S.itemInfo(k).sell), [20, 30, 55]);
  // คอกใหม่ไม่ชนขอบแมพ และประตูเป็นทาง
  const m = S.makeMap();
  for (const t of ['turkey', 'goat']) { const P = S.PENS[t]; assert.ok(P.y1 + 1 <= S.H - 2 && P.x1 + 1 <= S.W - 2, t + ' รั้วอยู่ในแมพ'); for (const [x, y] of P.gate) assert.strictEqual(m[y][x], S.T.PATH, t + ' ประตูเป็นทาง'); }
  // ชนิดไม่รู้จัก: อยู่ใน rec.herd หลังโหลด/ซิงก์/ออกเกม/เข้าใหม่ แต่ไม่โผล่ในเล้า
  const unk = { type: 'zzz', hunger: 55, zero: 0, sick: false, sickMs: 0, fed: false, prod: false, feeder: '', fn: '', pm: 0, layLeft: 0 };
  c.rec.herd.push(unk);
  w.syncHerd(c); assert.ok(c.rec.herd.some(x => x.type === 'zzz'), 'syncHerd เก็บชนิดไม่รู้จัก');
  w.leave(c); assert.ok(w.saved.carol.herd.some(x => x.type === 'zzz'), 'ออกเกมแล้ว zzz ยังอยู่ในเซฟ');
  const c2 = mk('Carol');
  assert.ok(c2.rec.herd.some(x => x.type === 'zzz' && x.hunger === 55), 'เข้าใหม่ zzz ยังอยู่');
  assert.ok(!w.animals.some(x => x.type === 'zzz'), 'zzz ไม่โผล่ในเล้า');
  assert.strictEqual(w.ownerCount(c2.key, 'turkey'), 1, 'ไก่งวงกลับมาครบ');
  assert.strictEqual(w.ownerCount(c2.key, 'goat'), 1, 'แพะกลับมาครบ');
  w.syncHerd(c2); assert.ok(c2.rec.herd.some(x => x.type === 'zzz'), 'sync หลังโหลดแล้ว zzz ยังอยู่');
  console.log('ok herd: turkey Lv7 + goat Lv9 (ซื้อ/ให้อาหาร/เก็บ) + ชนิดไม่รู้จักไม่หาย');
}
