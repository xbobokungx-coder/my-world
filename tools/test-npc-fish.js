// ทดสอบลุงสมชายตกปลาประกอบฉาก: node tools/test-npc-fish.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-npcfish-');
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('npcfish');
const uncle = w.npcs.find(n => n.job === 'fish');
assert.ok(uncle && uncle.name === 'ลุงสมชาย', 'ลุงสมชายมีงานตกปลา');
assert.ok(w.npcs.filter(n => n.job).length === 1, 'มีแค่ลุงสมชายที่ตกปลาในรอบนี้');

// จุดตกปลา: ยืนบนช่องเดินได้ ทุ่นอยู่บนช่องน้ำจริง
const spots = w.npcFishSpots(); assert.ok(spots.length > 10, 'ต้องมีจุดยืนริมสระ');
for (const sp of spots) {
  assert.ok(w.npcWalkable(sp.x, sp.y), 'ยืนบนช่องเดินได้');
  assert.strictEqual(w.map[Math.floor(sp.fy / S.TS)][Math.floor(sp.fx / S.TS)], S.T.WATER, 'ทุ่นอยู่บนน้ำ');
}

// จำลองเวลา: ต้องเคยตกปลา เดินกลับมาปกติ และไม่แตะเงิน/ปลา/ตลาด/เซฟ
const fakeP = { id: 1, key: 'x', name: 'X', x: 0, y: 0, ws: { readyState: 1, send() {} }, rec: { inv: { coin: 5 }, skills: {} } };
w.players.set(1, fakeP);
const before = JSON.stringify([fakeP.rec, w.market && Object.keys(w.market).length, w.animals.length]);
let now = 1e6, fished = 0, moved = 0, bite = 0, seenFs = new Set(), last = [uncle.x, uncle.y];
const rand0 = Math.random; let seed = 7; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 20 * 60 * 30; i++) { // 30 นาทีจำลอง 20 tick/วินาที
  now += 50; w.npcTick(0.05, now);
  if (uncle.fs) { fished++; seenFs.add(uncle.fs); if (uncle.fs === 2) bite++; assert.ok(uncle.fish && uncle.fx > 0, 'ตกปลาต้องมีทุ่น'); assert.strictEqual(uncle.path.length, 0, 'ตอนตกปลาไม่เดิน'); }
  if (Math.hypot(uncle.x - last[0], uncle.y - last[1]) > 1) moved++; last = [uncle.x, uncle.y];
}
Math.random = rand0;
assert.ok(fished > 20 * 10, 'ใน 30 นาทีต้องตกปลาอย่างน้อยครั้งหนึ่ง (>10 วินาที) ได้ ' + fished);
assert.ok(moved > 100, 'ยังเดินเล่นอยู่');
assert.ok(seenFs.has(1) && seenFs.has(2) && bite > 0, 'มีทั้งช่วงรอและปลากินเบ็ด');
assert.strictEqual(JSON.stringify([fakeP.rec, w.market && Object.keys(w.market).length, w.animals.length]), before, 'ไม่กระทบเหรียญ/ตลาด/สัตว์/เซฟผู้เล่น');
// ไม่มีผู้เล่น = พัก ไม่ตกปลาเพิ่ม
w.players.clear(); const f0 = uncle.fs, p0 = [uncle.x, uncle.y]; w.npcTick(1, now + 5e6);
assert.deepStrictEqual([uncle.fs, uncle.x, uncle.y], [f0, ...p0], 'ไม่มีผู้เล่นออนไลน์ NPC พัก');
// pub: ส่งข้อมูลเบ็ดให้ฝั่งเว็บ
uncle.fs = 1; uncle.fx = 100; uncle.fy = 200; const pub = w.npcPub(uncle); assert.deepStrictEqual([pub.fs, pub.fx, pub.fy, pub.held], [1, 100, 200, '🎣']);
console.log('npc-fish ok');
process.exit(0);
