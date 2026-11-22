// ทดสอบป่าดงดิบ ขั้น J2 (ผังตายตัว 64x46 ฉาก @cave97 เข้า-ออก ไม่มีแร่): node tools/test-jungle.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-jungle-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, T = S.T, J = S.JUNGLE;

// ผังตายตัว
assert.strictEqual(J.floor, 97); assert.strictEqual(J.open, false);
assert.strictEqual(J.rows.length, S.H); assert.ok(J.rows.every(r => r.length === S.W && /^[#t.=~FHTCSREh]+$/.test(r)), 'แถวละ 64 ตัวอักษรในชุดที่กำหนด');
const m = S.makeCaveMap(97), m2 = S.makeCaveMap(97);
assert.strictEqual(m.length, S.H); assert.ok(m.every(r => r.length === S.W)); assert.deepStrictEqual(m, m2, 'ผังตายตัว');
assert.ok(S.isJungle(97) && !S.isJungle(98) && !S.isMineFloor(97) && !S.isMineFloor(98) && !S.isMineFloor(99) && S.isMineFloor(1) && S.isMineFloor(S.MINE.floors) && !S.isMineFloor(S.MINE.floors + 1));
const at = (x, y) => m[y][x];
for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) { const c = J.rows[y][x], t = at(x, y); if (c === '#' || c === 't') assert.strictEqual(t, T.TREE); if (c === 'E') assert.strictEqual(t, T.MOUTH); if (c === 'T') assert.strictEqual(t, T.LANDMARK); if (c === 'H') assert.strictEqual(t, T.BRIDGE); if (c === '~') assert.strictEqual(t, T.WATER); }
for (let x = J.exit.x0; x <= J.exit.x1; x++) for (let y = J.exit.y0; y <= J.exit.y1; y++) assert.strictEqual(at(x, y), T.MOUTH, 'ทางออกขอบบน');
for (let y = J.tower.y0; y <= J.tower.y1; y++) for (let x = J.tower.x0; x <= J.tower.x1; x++) assert.strictEqual(at(x, y), T.LANDMARK, 'ฐานหอ');
assert.strictEqual(J.rows.join('').split('T').length - 1, 12, 'หอ 4x3');
assert.ok(m.every(r => r.every(t => t !== T.ORE)), 'ไม่มีแร่ในแผนที่');
const herbCh = []; J.rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'h') herbCh.push(x + ',' + y); }));
assert.strictEqual(J.herbs.length, 12); assert.deepStrictEqual(herbCh.sort(), J.herbs.map(h => h.join(',')).sort(), 'ตัว h ตรงกับ JUNGLE.herbs');

// BFS 4 ทิศ จากจุดเกิด ไม่ใช้สะพานก็ถึง (ไม่มีกำแพงกั้นโซน): ข้ามได้เฉพาะช่องที่ไม่ solid
const sx = Math.floor(J.spawn.x / TS), sy = Math.floor(J.spawn.y / TS); assert.deepStrictEqual([sx, sy], [31, 5]);
const open = (x, y) => x >= 0 && y >= 0 && x < S.W && y < S.H && !S.blockedAt(m, (x + 0.5) * TS, (y + 0.5) * TS) && at(x, y) !== T.BRIDGE;
assert.ok(!S.blockedAt(m, J.spawn.x, J.spawn.y), 'จุดเกิดยืนได้');
const seen = new Set([sx + ',' + sy]), q = [[sx, sy]];
for (let i = 0; i < q.length; i++) for (const [dx, dy] of S.DIRS) { const x = q[i][0] + dx, y = q[i][1] + dy, k = x + ',' + y; if (!seen.has(k) && open(x, y)) { seen.add(k); q.push([x, y]); } }
for (const [x, y] of J.herbs) assert.ok(seen.has(x + ',' + y), `ถึงสมุนไพร ${x},${y} โดยไม่ข้ามสะพาน`);
assert.ok(seen.has(J.tower.door.x + ',' + J.tower.door.y), 'ถึงหน้าหอ');
assert.ok(seen.has('31,2') && [...seen].some(k => k.endsWith(',1')), 'ถึงทางออกขอบบน');
let walkable = 0; for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (open(x, y)) walkable++;
// ผังที่เจ้าของอนุมัติมีช่องโดดเดี่ยวล้อมด้วยต้นไม้ 31 ช่อง (รวมที่ข้ามตื้นตะวันออก x49-54 y21-22 ที่ปิดสองฝั่ง) ไม่กระทบจุดสำคัญ จึงยอมได้ไม่เกิน 40
assert.ok(seen.size >= walkable - 40, `พื้นที่หลักต้องต่อถึงกัน ${seen.size}/${walkable}`);

// ผ่านเซิร์ฟเวอร์
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('jungle');
assert.ok(Object.keys(w.houses).every(k => k[0] !== '@'), 'houses ไม่มีคีย์ @');
const p = w.join(mkWs(), 'Jun', '#fff').p, G = S.JGATE;
const front = () => ({ x: (G.door[0] + 0.5) * TS, y: (G.y1 + 1.5) * TS });
const stand = () => { const f = front(); p.x = f.x; p.y = f.y; p.dir = 1; p.lastAct = 0; p.exhausted = 0; };
const act = (tool = 'hand') => { p.lastAct = 0; w.handle(p, { t: 'act', tool, tx: G.door[0], ty: G.y1 }); };
const toasts = () => p.ws.msgs.filter(x => x.t === 'toast' || x.t === 'msg').map(x => JSON.stringify(x)).join('|');

// open=false: เข้าไม่ได้ ขึ้นข้อความเร็วๆ นี้ แม้หิวจนตัน
stand(); p.rec.hunger = 0; act();
assert.ok(!p.scene, 'open=false เข้าไม่ได้'); assert.ok(toasts().includes('ป่าดงดิบกำลังเตรียมตัว'), 'toast เร็วๆ นี้');
p.rec.hunger = 100;
// ผู้ดูแลวาปได้
assert.strictEqual(w.warpTo(p, 'jungle'), null); assert.strictEqual(p.scene, '@cave97');
assert.ok(p.ws.msgs.some(x => x.t === 'scene' && x.sc === '@cave97' && x.cave === 97 && x.ores.length === 0), 'ส่ง scene 97 ไม่มีแร่');
assert.deepStrictEqual([Math.floor(p.x / TS), Math.floor(p.y / TS)], [31, 5]);
w.handle(p, { t: 'm', x: 10 * TS, y: 5 * TS }); // เดินในฉาก (ลองไม่พัง)
w.leaveCave(p); assert.ok(!p.scene);

// เปิดสวิตช์: เข้าด้วย act ที่ช่อง jgate
J.open = true;
stand(); act();
assert.strictEqual(p.scene, '@cave97', 'act ที่ประตู = เข้าป่า'); assert.deepStrictEqual([Math.floor(p.x / TS), Math.floor(p.y / TS)], [31, 5]);
assert.ok(!S.blockedAt(w.map, p.ret.x, p.ret.y), 'ret ยืนได้ในเมือง'); assert.strictEqual(Math.floor(p.ret.y / TS), G.y1 + 1);
assert.strictEqual(w.floorOf(97).ores.size, 0, 'ไม่วางแร่'); assert.strictEqual(w.oresPub(97).length, 0);
// อีเต้อ/ขวานในป่า ไม่ทำอะไร ต้นไม้ไม่หาย
{ const F = w.floorOf(97); let tx, ty; for (let y = 10; y < 20 && !tx; y++) for (let x = 4; x < 60 && !tx; x++) if (F.map[y][x] === T.TREE && F.map[y][x - 1] === T.CAVE) { tx = x; ty = y; }
  p.x = (tx - 0.5) * TS; p.y = (ty + 0.5) * TS; p.dir = 3; const before = JSON.stringify(F.map);
  for (const tool of ['axe', 'pick', 'hand', 'sword']) { p.lastAct = 0; p.hitAt = 0; w.handle(p, { t: 'act', tool, tx, ty }); p.lastAct = 0; w.handle(p, { t: 'act', tool }); }
  assert.strictEqual(JSON.stringify(F.map), before, 'ฟาดต้นไม้ในป่าแล้วไม่หาย'); assert.strictEqual(F.map[ty][tx], T.TREE); }
// ตั๋ววาปใช้ไม่ได้ในป่า
p.rec.inv.recall = 1; w.recallUse(p); assert.strictEqual(p.scene, '@cave97'); assert.strictEqual(p.rec.inv.recall, 1);
// ออกด้วยการเดินถึง T.MOUTH ขอบบน
p.x = 31.5 * TS; p.y = 2.5 * TS; p.lastMove = 0; w.handle(p, { t: 'm', x: 31.5 * TS, y: 1.5 * TS, d: 1 });
assert.ok(!p.scene, 'เดินถึงทางออก = กลับเมือง'); assert.ok(Math.abs(p.y - (G.y1 + 1.5) * TS) < 1 && !p.ret, 'กลับมาหน้าประตูเมือง');
// ออฟไลน์ในป่า = เซฟตำแหน่งหน้าประตู
stand(); act(); assert.strictEqual(p.scene, '@cave97'); p.x = 40 * TS; p.y = 30 * TS;
const rec = p.rec; w.leave(p);
assert.ok(Math.abs(rec.x - front().x) < TS && Math.abs(rec.y - (G.y1 + 1.5) * TS) < 1, `เซฟหน้าประตู ${rec.x},${rec.y}`);
J.open = false;
console.log('✓ ผ่าน: ป่าดงดิบ J2');
process.exit(0);
