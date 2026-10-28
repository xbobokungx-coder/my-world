// ทดสอบถ้ำเหมือง (ฉากร่วม เข้า-ออกปากถ้ำ ขุดแร่ เลเวล/อีเต้อ ความทนทาน แร่เกิดใหม่ ขายแร่): node tools/test-cave.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-cave-'));
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, T = S.T;

const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const last = (ws, t) => { for (let i = ws.msgs.length - 1; i >= 0; i--) if (ws.msgs[i].t === t) return ws.msgs[i]; return null; };

// ผังถ้ำ: ทุกพื้นเดินถึงจากจุดเกิด ก้อนแร่ไม่ปิดทาง ทางออกอยู่ผนังล่าง ปากถ้ำในเมืองเดินเข้าได้จากด้านล่าง
{
  const m = S.makeCaveMap(), spots = S.caveOreSpots(m);
  assert.ok(spots.length > 40 && spots.length <= S.MINE.maxOres, 'ก้อนแร่ต้องมีหลายสิบก้อน');
  for (const o of spots) { assert.strictEqual(m[o.y][o.x], T.CAVE); m[o.y][o.x] = T.ORE; }
  const sol = (x, y) => S.blockedAt(m, (x + 0.5) * TS, (y + 0.5) * TS);
  const sx = Math.floor(S.CAVE.spawn.x / TS), sy = Math.floor(S.CAVE.spawn.y / TS), seen = new Set([sx + ',' + sy]), q = [[sx, sy]];
  while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of S.DIRS) { const k = (x + dx) + ',' + (y + dy); if (seen.has(k) || sol(x + dx, y + dy)) continue; seen.add(k); q.push([x + dx, y + dy]); } }
  let floor = 0; for (const r of m) for (const c of r) if (c === T.CAVE || c === T.MOUTH) floor++;
  assert.strictEqual(seen.size, floor, 'ต้องเดินถึงพื้นถ้ำทุกช่อง (ก้อนแร่ไม่ปิดทาง)');
  assert.ok(!S.blockedAt(m, S.CAVE.spawn.x, S.CAVE.spawn.y), 'จุดเกิดในถ้ำเดินได้');
  const t = S.makeMap();
  for (const x of S.MINE.door) { assert.strictEqual(t[S.MINE.y][x], T.MOUTH); assert.strictEqual(t[S.MINE.y + 1][x], T.PATH, 'หน้าปากถ้ำต้องเป็นทาง'); }
  assert.ok(!S.blockedAt(t, 26.5 * TS, 8.5 * TS), 'ปากถ้ำเดินเข้าได้');
  assert.strictEqual(S.playLevel({}), 5, 'อาชีพใหม่ต้องไม่ดันระดับการเล่นของคนทั่วไป');
}

const w = new World('main');
const wa = mkWs(), wb = mkWs();
const a = w.join(wa, 'alice', '#e74c3c').p, b = w.join(wb, 'bob', '#3498db').p;
const door = () => ({ x: 26.5 * TS, y: 9.5 * TS });
const step = (p, x, y) => { Object.assign(p, { x: p.x, y: p.y }); w.handle(p, { t: 'm', x, y, d: 1 }); };

// เดินจากหน้าปากถ้ำขึ้นไปช่องปากถ้ำ (เดินก้าวละไม่เกิน 60 px) = เข้าถ้ำ ฉากร่วม
a.x = door().x; a.y = door().y; b.x = door().x + 64; b.y = door().y;
step(a, a.x, 8.5 * TS);
assert.strictEqual(a.scene, '@cave', 'เดินเข้าปากถ้ำ = เข้าถ้ำ');
const sc = last(wa, 'scene');
assert.ok(sc && sc.cave === 1 && sc.ores.length > 40 && sc.players.length === 1, 'ต้องได้ฉากถ้ำพร้อมรายการแร่');
assert.deepStrictEqual([a.x, a.y], [S.CAVE.spawn.x, S.CAVE.spawn.y]);
assert.strictEqual(Math.floor(a.ret.y / TS), 9, 'จำตำแหน่งหน้าปากถ้ำไว้ ไม่ใช่ช่องปากถ้ำ');
b.x = door().x + 32; b.y = door().y; step(b, b.x, 8.5 * TS);
assert.strictEqual(b.scene, '@cave'); assert.ok(wa.msgs.some(m => m.t === 'p+' && m.id === b.id), 'คนในถ้ำเห็นกัน');
assert.ok(last(wb, 'scene').players.length === 2, 'คนใหม่เห็นคนที่อยู่ก่อน');

// ขุดแร่: ต้องมีอีเต้อ เลเวล และระดับอีเต้อพอ
const [ox, oy, ok_] = last(wa, 'scene').ores.find(o => o[2] === 'stone');
a.x = (ox + 0.5) * TS; a.y = (oy + 1.5) * TS; a.dir = 1; // ยืนใต้ก้อนแร่ หันขึ้น
const act = (p, tx, ty) => { p.lastAct = 0; w.handle(p, { t: 'act', tool: 'pick', tx, ty }); };
act(a, ox, oy); assert.ok(w.ores.has(ox + ',' + oy), 'ไม่มีอีเต้อ ขุดไม่ได้');
a.rec.inv.coin = 5000; a.x = door().x; a.y = door().y; // กลับไปซื้ออีเต้อไม่ได้เพราะอยู่ในถ้ำ: ซื้อไม่ได้ในถ้ำ
w.handle(a, { t: 'buy', item: 'pick_1', n: 1 }); assert.ok(!a.rec.inv.pick_1, 'ในถ้ำไม่มีร้าน ซื้อไม่ได้');
a.rec.inv.pick_1 = 1; a.x = (ox + 0.5) * TS; a.y = (oy + 1.5) * TS;
const xp0 = a.rec.skills.mine || 0;
for (let i = 0; i < 2; i++) act(a, ox, oy);
assert.ok(w.ores.has(ox + ',' + oy), 'หิน hp 3 ขุด 2 ครั้งยังไม่แตก');
act(a, ox, oy);
assert.ok(!w.ores.has(ox + ',' + oy) && w.cmap[oy][ox] === T.CAVE, 'ขุด 3 ครั้งแตก ช่องกลายเป็นพื้น');
assert.ok((a.rec.inv.stone || 0) >= 2, 'ได้หิน'); assert.ok((a.rec.skills.mine || 0) > xp0, 'ได้ XP นักขุดแร่');
assert.ok(wb.msgs.some(m => m.t === 'ore' && m.x === ox && m.y === oy && m.k === ''), 'คนอื่นในถ้ำเห็นแร่หาย');
assert.ok(a.rec.dur && a.rec.dur.pick < S.durMax('pick', 1, 0), 'อีเต้อสึกหรอ');
assert.strictEqual(a.rec.ach && a.rec.ach.cnt.mine, 1, 'นับสถิติ mine');

// ต้องเลเวล/อีเต้อถึง: ทองแดงต้อง Lv3 + อีเต้อ 2
{ const c = [...w.ores].find(([, k]) => k === 'copper'); const [cx, cy] = c[0].split(',').map(Number);
  a.x = (cx + 0.5) * TS; a.y = (cy + 1.5) * TS; act(a, cx, cy);
  assert.ok(w.ores.has(c[0]) && !w.oreHp.has(c[0]), 'เลเวล/อีเต้อไม่ถึง ขุดไม่ได้ ไม่ลด hp'); }

// แร่เกิดใหม่เมื่อครบเวลา
assert.ok(w.oreWait.length === 1); w.oreTick(Date.now() + 1000); assert.ok(!w.ores.has(ox + ',' + oy), 'ยังไม่ครบเวลา');
w.oreTick(Date.now() + S.MINE.respawn[4] + 1000);
assert.ok(w.ores.get(ox + ',' + oy) === 'stone' && w.cmap[oy][ox] === T.ORE, 'ครบเวลาเกิดใหม่'); assert.ok(last(wb, 'ore').k === 'stone');

// อีเต้อพัง ใช้ไม่ได้
{ a.rec.dur.pick = 0; const [x2, y2] = [...w.ores].find(([, k]) => k === 'stone')[0].split(',').map(Number); a.x = (x2 + 0.5) * TS; a.y = (y2 + 1.5) * TS; act(a, x2, y2); assert.ok(w.ores.has(x2 + ',' + y2), 'อีเต้อพังขุดไม่ได้'); }

// ออกจากถ้ำ: เดินลงทางออก → กลับหน้าปากถ้ำ (ไม่ทับช่องปากถ้ำ ไม่วนเข้าซ้ำ)
a.x = 31.5 * TS; a.y = (S.CAVE.y1 - 0.5) * TS; step(a, a.x, (S.CAVE.y1 + 0.2) * TS);
assert.strictEqual(a.scene, null, 'เดินถึงทางออก = กลับเมือง'); assert.strictEqual(Math.floor(a.y / TS), 9);
assert.notStrictEqual(w.map[Math.floor(a.y / TS)][Math.floor(a.x / TS)], T.MOUTH);
assert.strictEqual(last(wa, 'scene').sc, null);

// ร้านช่างเหมือง: ซื้ออีเต้อ (ระดับ 2 ต้อง Lv3) แล้วความทนทานเต็ม • ขายแร่ได้เงิน
{ const b2 = S.BUILDINGS.find(x => x.kind === 'mine'); a.x = (b2.counter[0][0] + 0.5) * TS; a.y = (b2.counter[0][1] + 1) * TS;
  a.rec.inv.coin = 5000; delete a.rec.inv.pick_1;
  w.handle(a, { t: 'buy', item: 'pick_2', n: 1 }); assert.ok(!a.rec.inv.pick_2, 'อีเต้อเหล็กต้อง Lv3');
  w.handle(a, { t: 'buy', item: 'pick_1', n: 1 }); assert.ok(a.rec.inv.pick_1, 'ซื้ออีเต้อหินได้'); assert.strictEqual(a.rec.dur.pick, undefined, 'ซื้อใหม่ความทนทานเต็ม');
  a.rec.inv.coal = 10; const c0 = a.rec.inv.coin; w.handle(a, { t: 'sell', item: 'coal', n: 'all' }); assert.ok(a.rec.inv.coin > c0 && !a.rec.inv.coal, 'ขายแร่ได้'); }
console.log('test-cave: ok');
process.exit(0);
