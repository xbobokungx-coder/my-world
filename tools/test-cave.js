// ทดสอบถ้ำเหมือง 10 ชั้น (ผังสุ่มต่อชั้น เดินถึงบันไดลงเสมอ แร่ 3 ขนาด สัดส่วนแร่ต่อชั้น ขุด/อีเต้อ/ความทนทาน แร่เกิดใหม่ 1 วันในเกม ขายแร่): node tools/test-cave.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-cave-'));
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, T = S.T;

const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const last = (ws, t) => { for (let i = ws.msgs.length - 1; i >= 0; i--) if (ws.msgs[i].t === t) return ws.msgs[i]; return null; };

// สัดส่วนแร่ต่อชั้น: ชั้น f = แร่ลำดับ f 70% / f+1 20% / f+2 10% ชั้น 10 มิทริลล้วน (แร่ 10 ชนิด ปลดทุก 2 เลเวล)
{
  assert.deepStrictEqual(S.floorMix(1), { stone: 80, copper: 20 }); // ชั้น 1 พิเศษ (MINE.mix1) ไม่มีเงิน
  assert.deepStrictEqual(S.floorMix(5), { emerald: 70, opal: 20, sapphire: 10 });
  assert.deepStrictEqual(S.floorMix(9), { moonstone: 70, mythril: 30 });
  assert.deepStrictEqual(S.floorMix(10), { mythril: 70, moonstone: 30 }); // ชั้นลึกสุดมีมูนสโตนปนให้ Lv17–18 ขุดได้บ้าง
  assert.strictEqual(S.ORE_ORDER.length, S.MINE.floors, 'แร่ 1 ระดับต่อ 1 ชั้น');
  assert.strictEqual(S.pickTier({ pick_2: 1, pick_5: 1 }), 5); assert.strictEqual(S.pickTier({}), 0);
  assert.strictEqual(S.caveFloor('@cave7'), 7); assert.strictEqual(S.caveFloor('alice'), 0); assert.strictEqual(S.caveFloor(null), 0);
}

// ผังถ้ำทุกชั้น: เดินถึงทุกพื้นและบันไดลงจากหน้าทางออก ก้อนแร่ไม่ปิดทาง ทุกก้อนมีที่ยืนขุด ห่างกัน ≥ oreGap ช่อง 20–45 ก้อน แต่ละชั้นผังไม่ซ้ำกัน
{
  const sigs = new Set();
  for (let f = 1; f <= S.MINE.floors; f++) {
    const m = S.makeCaveMap(f), spots = S.caveOreSpots(m, f);
    assert.ok(spots.length >= 20 && spots.length <= S.MINE.maxOres, `ชั้น ${f}: ก้อนแร่ ${spots.length} ต้องอยู่ที่ 20–${S.MINE.maxOres}`);
    for (const a of spots) for (const b of spots) if (a !== b) assert.ok(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) > S.MINE.oreGap, `ชั้น ${f}: ก้อนแร่ต้องห่างกัน`);
    const downs = []; let open = 0;
    m.forEach((r, y) => r.forEach((c, x) => { if (c === T.DOWN) downs.push([x, y]); if (c === T.CAVE || c === T.MOUTH || c === T.DOWN) open++; }));
    assert.strictEqual(downs.length, f < S.MINE.floors ? 3 : 0, `ชั้น ${f}: บันไดลง`);
    for (const o of spots) { assert.strictEqual(m[o.y][o.x], T.CAVE); m[o.y][o.x] = T.ORE; }
    const sol = (x, y) => S.blockedAt(m, (x + 0.5) * TS, (y + 0.5) * TS);
    const sx = Math.floor(S.CAVE.spawn.x / TS), sy = Math.floor(S.CAVE.spawn.y / TS), seen = new Set([sx + ',' + sy]), q = [[sx, sy]];
    while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of S.DIRS) { const k = (x + dx) + ',' + (y + dy); if (seen.has(k) || sol(x + dx, y + dy)) continue; seen.add(k); q.push([x + dx, y + dy]); } }
    assert.strictEqual(seen.size, open - spots.length, `ชั้น ${f}: ต้องเดินถึงพื้นถ้ำทุกช่อง (ก้อนแร่/เสาไม่ปิดทาง)`);
    for (const [x, y] of downs) assert.ok(seen.has(x + ',' + y), `ชั้น ${f}: เดินถึงบันไดลงได้`);
    for (const o of spots) assert.ok(S.DIRS.some(([dx, dy]) => seen.has((o.x + dx) + ',' + (o.y + dy))), `ชั้น ${f}: ก้อนแร่ทุกก้อนมีที่ยืนขุด`);
    assert.ok(!S.blockedAt(m, S.CAVE.spawn.x, S.CAVE.spawn.y), 'จุดเกิดในถ้ำเดินได้');
    for (const x of S.CAVE.exit) assert.strictEqual(m[S.CAVE.y1][x], T.MOUTH);
    // สัดส่วนแร่ใกล้ 70/20/10 (ชั้น 10 ล้วนคริสตัล)
    const cnt = {}; for (const o of spots) cnt[o.k] = (cnt[o.k] || 0) + 1;
    for (const [k, w] of Object.entries(S.floorMix(f))) assert.ok(Math.abs((cnt[k] || 0) / spots.length * 100 - w) < 22, `ชั้น ${f}: ${k} ควรราว ${w}% ได้ ${((cnt[k] || 0) / spots.length * 100).toFixed(0)}%`);
    assert.deepStrictEqual(Object.keys(cnt).sort(), Object.keys(S.floorMix(f)).sort(), `ชั้น ${f}: ชนิดแร่ต้องตรงตามสัดส่วนชั้น`);
    m.forEach(r => r.forEach((c, i) => { if (c === T.ORE) r[i] = T.CAVE; }));
    sigs.add(m.map(r => r.join('')).join('|'));
  }
  assert.strictEqual(sigs.size, S.MINE.floors, 'ผังแต่ละชั้นต้องต่างกัน');
  const m1 = S.makeCaveMap(3), m2 = S.makeCaveMap(3); assert.deepStrictEqual(m1, m2, 'ผังชั้นเดียวกันต้องได้เหมือนกันทุกครั้ง (เซิร์ฟเวอร์กับหน้าเว็บตรงกัน)');
  // ขนาด/ดรอป: ขนาดละช่วงที่กำหนด ความทนทานต่างกัน
  const R = S.rng(5); const seen = [0, 0, 0];
  for (let i = 0; i < 3000; i++) { const s = S.rollSize(R); seen[s]++; const d = S.rollDrop(s, R), r = S.ORE_SIZES[s].drop; assert.ok(d >= r[0] && d <= r[1]); }
  assert.ok(seen[0] > seen[1] && seen[1] > seen[2] && seen[2] > 100, 'เล็กพบมากสุด ใหญ่หายากสุด (ฐาน 50/40/10)');
  for (let f = 1; f <= S.MINE.floors; f++) { const mx = S.sizeMix(f); assert.strictEqual(mx[0] + mx[1] + mx[2], 100, 'สัดส่วนขนาดชั้น ' + f + ' ต้องรวม 100'); if (f > 1) assert.ok(mx[2] >= S.sizeMix(f - 1)[2] && mx[0] <= S.sizeMix(f - 1)[0], 'ยิ่งลึกก้อนใหญ่ไม่น้อยลง'); }
  { const big = f => { const sp = S.caveOreSpots(S.makeCaveMap(f), f); return sp.filter(o => o.s === 2).length / sp.length; }; assert.ok(big(10) > big(1), 'ชั้น 10 มีก้อนใหญ่สัดส่วนมากกว่าชั้น 1'); }
  assert.ok(S.oreHp('stone', 0) < S.oreHp('stone', 1) && S.oreHp('stone', 1) < S.oreHp('stone', 2), 'ก้อนใหญ่ HP มากกว่า');
  const t = S.makeMap();
  for (const x of S.MINE.door) { assert.strictEqual(t[S.MINE.y][x], T.MOUTH); assert.strictEqual(t[S.MINE.y + 1][x], T.PATH, 'หน้าปากถ้ำต้องเป็นทาง'); }
  assert.ok(!S.blockedAt(t, (S.MINE.door[0] + 0.5) * TS, 8.5 * TS), 'ปากถ้ำเดินเข้าได้');
  for (let x = S.MINE.hill.x0; x <= S.MINE.hill.x1; x++) assert.ok(S.blockedAt(t, (x + 0.5) * TS, 7.5 * TS) || !S.hillAt(x, 7), 'ภูเขาถ้ำเดินทะลุไม่ได้');
  assert.strictEqual(S.playLevel({}), 5, 'อาชีพใหม่ต้องไม่ดันระดับการเล่นของคนทั่วไป');
}

const w = new World('main');
const wa = mkWs(), wb = mkWs();
const a = w.join(wa, 'alice', '#e74c3c').p, b = w.join(wb, 'bob', '#3498db').p;
const door = () => ({ x: (S.MINE.door[0] + 0.5) * TS, y: 9.5 * TS });
const step = (p, x, y) => { w.handle(p, { t: 'm', x, y, d: 1 }); };
const ctr = (x, y) => [(x + 0.5) * TS, (y + 0.5) * TS];

// เดินจากหน้าปากถ้ำขึ้นไปช่องปากถ้ำ (เดินก้าวละไม่เกิน 60 px) = เข้าถ้ำชั้น 1 ฉากร่วม
a.x = door().x; a.y = door().y; b.x = door().x + 64; b.y = door().y;
step(a, a.x, 8.5 * TS);
assert.strictEqual(a.scene, '@cave1', 'เดินเข้าปากถ้ำ = เข้าถ้ำชั้น 1');
const sc = last(wa, 'scene');
assert.ok(sc && sc.cave === 1 && sc.ores.length >= 20 && sc.ores[0].length === 4 && sc.players.length === 1, 'ต้องได้ฉากถ้ำพร้อมรายการแร่ [x,y,ชนิด,ขนาด]');
assert.deepStrictEqual([a.x, a.y], [S.CAVE.spawn.x, S.CAVE.spawn.y]);
assert.strictEqual(Math.floor(a.ret.y / TS), 9, 'จำตำแหน่งหน้าปากถ้ำไว้ ไม่ใช่ช่องปากถ้ำ');
b.x = door().x; b.y = door().y; step(b, b.x, 8.5 * TS);
assert.strictEqual(b.scene, '@cave1'); assert.ok(wa.msgs.some(m => m.t === 'p+' && m.id === b.id), 'คนในถ้ำเห็นกัน');
assert.ok(last(wb, 'scene').players.length === 2, 'คนใหม่เห็นคนที่อยู่ก่อน');
assert.ok(w.floors.size === 1 && w.floorOf(1).ores.size <= S.MINE.maxOres, 'สร้างเฉพาะชั้นที่มีคนเข้า');

// ขุดแร่: ต้องมีอีเต้อ เลเวล และระดับอีเต้อพอ • ก้อนเล็ก/กลาง/ใหญ่ ขุดนานต่างกัน ได้ชิ้นตามช่วง
const F1 = w.floorOf(1);
const find = (kind, size) => [...F1.ores].find(([, o]) => o.k === kind && (size === undefined || o.s === size));
const act = (p, tx, ty) => { p.lastAct = p.hitAt = 0; w.handle(p, { t: 'act', tool: 'pick', tx, ty }); };
const stand = (p, [ox, oy]) => { [p.x, p.y] = ctr(ox, oy + 1); p.dir = 1; };
let [sk, so] = find('stone', 0); const [ox, oy] = sk.split(',').map(Number);
stand(a, [ox, oy]); act(a, ox, oy); assert.ok(F1.ores.has(sk) && !F1.hp.size, 'ไม่มีอีเต้อ ขุดไม่ได้');
a.rec.inv.coin = 99999; [a.x, a.y] = [door().x, door().y]; w.handle(a, { t: 'buy', item: 'pick_1', n: 1 }); assert.ok(!a.rec.inv.pick_1, 'ในถ้ำไม่มีร้าน ซื้อไม่ได้');
a.rec.inv.pick_1 = 1; stand(a, [ox, oy]);
const hp0 = S.oreHp('stone', 0), xp0 = a.rec.skills.mine || 0; assert.strictEqual(hp0, Math.round(S.MINE.hpBase * S.ACTION_TUNE.mine));
for (let i = 0; i < hp0 - 1; i++) act(a, ox, oy);
assert.ok(F1.ores.has(sk), 'ขุดยังไม่ครบ HP ยังไม่แตก'); assert.strictEqual(a.rec.dur && a.rec.dur.pick, undefined, 'อีเต้อสึกเมื่อแตกก้อน ไม่ใช่ทุกครั้งที่ฟาด');
act(a, ox, oy);
assert.ok(!F1.ores.has(sk) && F1.map[oy][ox] === T.CAVE, 'ขุดครบ HP แตก ช่องกลายเป็นพื้น');
assert.ok(a.rec.inv.stone >= S.ORE_SIZES[0].drop[0] && a.rec.inv.stone <= S.ORE_SIZES[0].drop[1], 'ก้อนเล็กได้หินตามช่วงดรอป'); assert.ok((a.rec.skills.mine || 0) > xp0, 'ได้ XP นักขุดแร่');
assert.ok(wb.msgs.some(m => m.t === 'ore' && m.x === ox && m.y === oy && m.k === ''), 'คนอื่นในถ้ำเห็นแร่หาย');
assert.ok(a.rec.dur.pick < S.durMax('pick', 1, 0) && a.rec.dur.pick >= S.durMax('pick', 1, 0) - 2, 'อีเต้อสึก 1 ครั้งต่อก้อน');
assert.strictEqual(a.rec.ach && a.rec.ach.cnt.mine, 1, 'นับสถิติ mine');
// ก้อนใหญ่: HP มากกว่า ชิ้นมากกว่า
{ const big = find('stone', 2); if (big) { const [bk] = big, [bx, by] = bk.split(',').map(Number); stand(a, [bx, by]); const before = a.rec.inv.stone || 0, need = S.oreHp('stone', 2);
    for (let i = 0; i < need - 1; i++) act(a, bx, by); assert.ok(F1.ores.has(bk), 'ก้อนใหญ่ต้องฟาดมากกว่า');
    { const oh = wb.msgs.filter(z => z.t === 'oh' && z.x === bx && z.y === by).pop(); assert.ok(oh && oh.f > 0 && oh.f < 1, 'คนในถ้ำเห็นก้อนแร่ร้าว (HP ที่เหลือ 0–1)'); }
    a.lastAct = 0; w.handle(a, { t: 'act', tool: 'pick', tx: bx, ty: by }); assert.ok(F1.ores.has(bk), 'ฟาดถี่กว่าความยาวท่า (SWING_MS) ไม่นับ');
    act(a, bx, by);
    const got = a.rec.inv.stone - before; assert.ok(!F1.ores.has(bk) && got >= S.ORE_SIZES[2].drop[0] && got <= S.ORE_SIZES[2].drop[1], `ก้อนใหญ่ได้ ${S.ORE_SIZES[2].drop.join('–')} ชิ้น ได้ ` + got); } }

// เริ่มเงื้อ (sw): คนในชั้นเดียวกันเห็นท่าทันที ก่อนผลจริงจะมาตอนกระทบ
{ wb.msgs.length = 0; a.swAt = 0; w.handle(a, { t: 'sw' }); assert.ok(wb.msgs.some(z => z.t === 'use' && z.id === a.id), 'sw = คนอื่นเห็นท่าเงื้อ'); }

// ต้องเลเวล/อีเต้อถึง: ทองแดงต้อง Lv3 + อีเต้อหิน (ระดับ 2)
{ const c = find('copper'); const [cx, cy] = c[0].split(',').map(Number); stand(a, [cx, cy]); act(a, cx, cy);
  assert.ok(F1.ores.has(c[0]) && !F1.hp.has(c[0]), 'เลเวล/อีเต้อไม่ถึง ขุดไม่ได้ ไม่ลด HP'); }

// แร่เกิดใหม่เมื่อครบ MINE.respawnMs (1/5 วันในเกม) ที่ช่องเดิมที่ขุด (ถ้าไม่ว่างค่อยสุ่มช่องใหม่ในชั้นเดิม) โดยไม่ปิดทางเดิน
assert.ok(F1.wait.length >= 1); const waitN = F1.wait.length, oresN = F1.ores.size; w.oreTick(Date.now() + 1000); assert.strictEqual(F1.wait.length, waitN, 'ยังไม่ครบวัน');
assert.strictEqual(S.MINE.respawnMs, S.DAY_MS / 5);
{ const before = new Set(F1.ores.keys()); w.oreTick(Date.now() + S.MINE.respawnMs + 1000);
  assert.ok(!F1.wait.length && F1.ores.size === oresN + waitN, 'ครบเวลาเกิดใหม่ครบทุกก้อน');
  const fresh = [...F1.ores.keys()].filter(k => !before.has(k)); assert.strictEqual(fresh.length, waitN);
  assert.ok(fresh.includes(sk), 'ก้อนที่ขุดไป เกิดใหม่ที่ช่องเดิม');
  for (const k of fresh) { const [x, y] = k.split(',').map(Number); assert.strictEqual(F1.map[y][x], T.ORE); assert.ok(Object.keys(S.floorMix(1)).includes(F1.ores.get(k).k), 'ชนิดที่เกิดใหม่ตามชั้น');
    const m = wb.msgs.filter(z => z.t === 'ore' && z.x === x && z.y === y).pop(); assert.ok(m && m.k === F1.ores.get(k).k && m.s === F1.ores.get(k).s, 'คนในถ้ำเห็นแร่เกิดใหม่ พร้อมชนิดและขนาด'); }
  assert.ok(F1.map[oy][ox] === T.CAVE || F1.ores.has(sk));
  // พื้นที่เดินยังต่อถึงกันหมด (ก้อนใหม่ไม่ปิดทาง)
  const open = F1.map.flat().filter(c => S.caveOpen(c)).length; assert.strictEqual(S.caveReach(F1.map), open, 'หลังแร่เกิดใหม่ ทุกพื้นยังเดินถึง'); }

// อีเต้อพัง ใช้ไม่ได้
{ a.rec.dur.pick = 0; const [k2] = find('stone'); const [x2, y2] = k2.split(',').map(Number); stand(a, [x2, y2]); act(a, x2, y2); assert.ok(F1.ores.has(k2) && !F1.hp.has(k2), 'อีเต้อพังขุดไม่ได้'); a.rec.dur.pick = 50; }

// บันไดลง/ขึ้น: ชั้น 1 → 2 → กลับชั้น 1 ยืนข้างบันไดลง → ออกเมือง
{ const down = []; F1.map.forEach((r, y) => r.forEach((c, x) => { if (c === T.DOWN) down.push([x, y]); }));
  const land = w.caveLanding(1); [a.x, a.y] = [land.x, land.y];
  const [dx, dy] = down.find(([x, y]) => Math.hypot((x + 0.5) * TS - land.x, (y + 0.5) * TS - land.y) <= TS + 1); step(a, ...ctr(dx, dy));
  assert.strictEqual(a.scene, '@cave2', 'เดินลงบันไดลง = ชั้น 2'); assert.strictEqual(last(wa, 'scene').cave, 2);
  assert.deepStrictEqual([a.x, a.y], [S.CAVE.spawn.x, S.CAVE.spawn.y]); assert.ok(w.floors.size === 2);
  assert.ok(wb.msgs.some(m => m.t === 'p-' && m.id === a.id), 'คนชั้น 1 เห็นเขาหายไป');
  const F2 = w.floorOf(2); assert.ok([...F2.ores.values()].every(o => ['copper', 'silver', 'amethyst'].includes(o.k)), 'ชั้น 2 มีแต่แร่ลำดับ 2–4');
  [a.x, a.y] = ctr(S.CAVE.exit[1], S.CAVE.y1 - 1); step(a, ...ctr(S.CAVE.exit[1], S.CAVE.y1));
  assert.strictEqual(a.scene, '@cave1', 'ทางออกชั้น 2 = ขึ้นชั้น 1'); assert.ok(!S.blockedAt(F1.map, a.x, a.y) && F1.map[Math.floor(a.y / TS)][Math.floor(a.x / TS)] !== T.DOWN, 'ขึ้นมายืนข้างบันไดลง ไม่ทับบันได');
}

// ออกจากถ้ำ: เดินลงทางออกชั้น 1 → กลับหน้าปากถ้ำ (ไม่ทับช่องปากถ้ำ ไม่วนเข้าซ้ำ)
a.x = 31.5 * TS; a.y = (S.CAVE.y1 - 0.5) * TS; step(a, a.x, (S.CAVE.y1 + 0.2) * TS);
assert.strictEqual(a.scene, null, 'เดินถึงทางออกชั้น 1 = กลับเมือง'); assert.strictEqual(Math.floor(a.y / TS), 9);
assert.notStrictEqual(w.map[Math.floor(a.y / TS)][Math.floor(a.x / TS)], T.MOUTH);
assert.strictEqual(last(wa, 'scene').sc, null);

// ร้านช่างเหมือง: อีเต้อ 6 ระดับ ต้องเลเวล แล้วความทนทานเต็ม • ขายแร่ได้เงิน
{ const b2 = S.BUILDINGS.find(x => x.kind === 'mine'); a.x = (b2.counter[0][0] + 0.5) * TS; a.y = (b2.counter[0][1] + 1) * TS;
  a.rec.inv.coin = 99999; delete a.rec.inv.pick_1;
  assert.strictEqual(Object.keys(S.PICKS).length, 6); assert.deepStrictEqual(S.SHOPS.mine.buy.filter(x => /^pick_/.test(x)), ['pick_1', 'pick_2', 'pick_3', 'pick_4', 'pick_5', 'pick_6']);
  w.handle(a, { t: 'buy', item: 'pick_2', n: 1 }); assert.ok(!a.rec.inv.pick_2, 'อีเต้อหินต้อง Lv3');
  w.handle(a, { t: 'buy', item: 'pick_6', n: 1 }); assert.ok(!a.rec.inv.pick_6, 'อีเต้อเพชรต้อง Lv19');
  w.handle(a, { t: 'buy', item: 'pick_1', n: 1 }); assert.ok(a.rec.inv.pick_1, 'ซื้ออีเต้อไม้ได้'); assert.strictEqual(a.rec.dur.pick, undefined, 'ซื้อใหม่ความทนทานเต็ม');
  a.rec.inv.coal = 10; const c0 = a.rec.inv.coin; w.handle(a, { t: 'sell', item: 'coal', n: 'all' }); assert.ok(a.rec.inv.coin > c0 && !a.rec.inv.coal, 'ขายแร่ได้'); }
console.log('test-cave: ok');
process.exit(0);
