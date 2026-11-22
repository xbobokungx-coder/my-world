// ทดสอบสัตว์ในถ้ำเหมือง (15 พ.ย. 2026): เกิดตามชั้น/เพดาน • เขตปลอดภัย • ชั้นว่างไม่อัปเดต • โดนแล้วหิวลด ไม่ตาย ไม่เสียของ • อมตะ • สลบ+วาร์ป • ฟาดสัตว์ • เกิดใหม่ • สวิตช์ปิด • ไม่ลงเซฟ
// รัน: node tools/test-creatures.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-creatures-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, C = S.CREATURE;
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('creaturetest'), ws = mkWs(), a = w.join(ws, 'alice', '#e74c3c').p;
const types = t => ws.msgs.filter(m => m.t === t);
const goto = (f, x, y) => { const at = f === 1 ? S.CAVE.spawn : w.caveLanding(f); w.changeScene(a, '@cave' + f, x === undefined ? at.x : x, y === undefined ? at.y : y); };
a.rec.hunger = 100; a.rec.inv = { coin: 500, pick_1: 1, stone: 3 };

// 1) สูตรใน shared
assert.strictEqual(S.creatureCap(1), 5); assert.strictEqual(S.creatureCap(10), 18); assert.ok([1,2,3,4,5,6,7,8,9,10].every(f => Number.isInteger(S.creatureCap(f))), 'จำนวนต่อชั้นเป็นจำนวนเต็ม');
for (let f = 1; f <= 10; f++) assert.ok(S.creatureKinds(f).length > 0, 'ทุกชั้นมีชนิดสัตว์ ' + f);
assert.deepStrictEqual(S.creatureKinds(1), ['rat']); assert.ok(!S.creatureKinds(1).includes('golem'));

// 2) เกิดตามชั้น/เพดาน/ชนิด/เขตปลอดภัย/ห่างผู้เล่น
for (const f of [1, 3, 5, 8, 10]) {
  goto(f); const F = w.floorOf(f);
  assert.ok(F.creatures && F.creatures.size === S.creatureCap(f), `ชั้น ${f} ต้องมี ${S.creatureCap(f)} ตัว ได้ ${F.creatures && F.creatures.size}`);
  for (const c of F.creatures.values()) {
    assert.ok(S.creatureKinds(f).includes(c.k), `ชั้น ${f} ไม่ควรมี ${c.k}`); assert.strictEqual(c.hp, S.creatureHp(c.k, f));
    assert.ok(!w.creatureSafe(F, f, c.x, c.y), 'ไม่เกิดในเขตปลอดภัย'); assert.ok(!S.blockedAt(F.map, c.x, c.y, C.stepR), 'เกิดบนช่องโล่ง');
    assert.ok(Math.hypot(c.x - a.x, c.y - a.y) >= C.spawnGap * TS - 1, 'เกิดห่างผู้เล่น');
  }
  const crs = types('crs').pop(); assert.ok(crs && crs.list.length === F.creatures.size && crs.list[0].length === 8, 'ส่ง crs รายการเต็มหลังเข้าชั้น');
}

// 3) ชั้นว่างคนไม่อัปเดต + เคลียร์หลัง emptyMs
{
  const F = w.floorOf(3); goto(3); const c0 = [...F.creatures.values()][0];
  w.changeScene(a, null, S.SPAWN.x, S.SPAWN.y); const x0 = c0.x, y0 = c0.y; let now = Date.now();
  for (let i = 1; i <= 20; i++) w.creatureTick(now + i * 300);
  assert.ok(c0.x === x0 && c0.y === y0, 'ชั้นว่างคนสัตว์ไม่ขยับ'); assert.ok(F.creatures, 'ยังไม่ถึงเวลาเคลียร์');
  w.creatureTick(now + C.emptyMs + 1000); w.creatureTick(now + C.emptyMs * 2 + 5000); assert.ok(!F.creatures, 'ว่างคนครบเวลา = เคลียร์สัตว์ทิ้ง');
}

// 4) สัตว์เดินเล่นแล้วไม่ทะลุผนัง/ไม่เข้าเขตปลอดภัย + ขยับแล้วส่ง crm
{
  goto(5); const F = w.floorOf(5); ws.msgs.length = 0; let now = Date.now() + 1e6;
  for (let i = 0; i < 400; i++) { w.creatureTick(now += 260); for (const c of F.creatures.values()) { assert.ok(!S.blockedAt(F.map, c.x, c.y, C.stepR), 'ไม่ทะลุผนัง/แร่'); assert.ok(!w.creatureSafe(F, 5, c.x, c.y), 'ไม่เข้าเขตปลอดภัย'); } a.crInv = 0; }
  assert.ok(types('crm').length > 0, 'ส่งเดลต้า crm'); const u = types('crm')[0].u[0]; assert.strictEqual(u.length, 6);
}

// 5) โดนแล้ว: หิวลดตามชั้น ไม่ต่ำกว่า 0 ไม่ตาย ไม่เสียของ/เหรียญ อมตะหลังโดน
const setup = (f, k) => { goto(f); const F = w.floorOf(f); F.creatures.clear(); F.crWait = []; const c = { id: 9000 + f, k, x: 0, y: 0, dir: 0, st: 0, hp: 3, hpMax: 3, until: 0, wt: 0, wdx: 0, wdy: 0, tid: 0, sent: null }; F.creatures.set(c.id, c);
  // วางผู้เล่นในช่องโล่งที่ไม่ใช่เขตปลอดภัยและห่างผนัง แล้ววางสัตว์ติดข้าง
  let spot = null; for (let y = S.CAVE.y0 + 2; y < S.CAVE.y1 - 1 && !spot; y++) for (let x = S.CAVE.x0 + 2; x < S.CAVE.x1 - 1 && !spot; x++) { const px = (x + 0.5) * TS, py = (y + 0.5) * TS; if (!S.blockedAt(F.map, px, py, 14) && !S.blockedAt(F.map, px + TS, py, 14) && !w.creatureSafe(F, f, px, py) && !w.creatureSafe(F, f, px + TS, py)) spot = [px, py]; }
  assert.ok(spot, 'หาช่องทดสอบได้'); a.x = spot[0]; a.y = spot[1]; c.x = spot[0] + 20; c.y = spot[1]; a.crInv = 0; a.crHits = []; a.stunUntil = 0; a.faintUntil = 0; a.faintWarp = 0; ws.msgs.length = 0; return { F, c }; };
{
  const { F, c } = setup(2, 'bat'), K = S.CREATURES.bat, now = Date.now(); const coin = a.rec.inv.coin, inv = JSON.stringify(a.rec.inv), x0 = a.x;
  w.creatureHit(F, 2, c, K, a, now);
  assert.strictEqual(Math.round(a.rec.hunger), 100 - S.creatureHunger(2), 'หิวลด 1+ชั้น'); const h = types('hurt')[0]; assert.ok(h && h.k === 'bat' && h.h === S.creatureHunger(2) && h.stun === K.stun, 'ส่ง hurt');
  assert.ok(a.x < x0 && Math.abs(a.y - h.y) < 1 && h.x === Math.round(a.x), 'ผลักห่างจากสัตว์'); assert.ok(a.stunUntil > now, 'สตัน');
  assert.ok(!S.blockedAt(F.map, a.x, a.y), 'ไม่ถูกผลักทะลุผนัง'); assert.ok(a.rec.hunger > 0 && JSON.stringify(a.rec.inv) === inv && a.rec.inv.coin === coin, 'ไม่เสียของ/เหรียญ');
  const h1 = a.rec.hunger; w.creatureHit(F, 2, c, K, a, now + 100); assert.strictEqual(a.rec.hunger, h1, 'อมตะหลังโดน ไม่หิวลดซ้ำ'); assert.strictEqual(types('hurt').length, 1);
  w.creatureHit(F, 2, c, K, a, now + C.invulnMs + 10); assert.ok(a.rec.hunger < h1, 'พ้นอมตะแล้วโดนอีกได้');
  // สตันห้ามเดิน/ฟาด
  const px = a.x; w.handle(a, { t: 'm', x: a.x + 10, y: a.y, d: 3 }); assert.strictEqual(a.x, px, 'สตันเดินไม่ได้'); assert.ok(types('tp').length > 0);
  // หิวไม่ต่ำกว่า 0
  a.rec.hunger = 1; a.crInv = 0; w.creatureHit(F, 2, c, K, a, now + 5000); assert.strictEqual(a.rec.hunger, 0); assert.ok(w.players.get(a.id) === a, 'ไม่ตาย');
}
// 5b) แมงมุม: ใยหิวครึ่ง ไม่ผลัก ส่ง web
{
  const { F, c } = setup(5, 'spider'), K = S.CREATURES.spider, now = Date.now(); a.rec.hunger = 100; const x0 = a.x;
  w.creatureHit(F, 5, c, K, a, now); assert.strictEqual(a.x, x0, 'แมงมุมไม่ผลัก'); assert.strictEqual(types('web')[0].ms, C.webSlow.ms);
  assert.strictEqual(Math.round(100 - a.rec.hunger), Math.max(1, Math.round(S.creatureHunger(5) / 2)), 'ใยหิวครึ่ง');
}
// 6) โดนครบ 4 ครั้งใน 30 วิ = สลบ แล้ววาร์ปถูกที่
{
  for (const f of [1, 4]) {
    const { F, c } = setup(f, 'rat'), K = S.CREATURES.rat, t0 = Date.now(), coin = a.rec.inv.coin; a.rec.hunger = 100;
    for (let i = 0; i < C.faint.hits; i++) w.creatureHit(F, f, c, K, a, t0 + i * (C.invulnMs + 10));
    assert.strictEqual(types('faint').length, 1, 'สลบครั้งเดียว'); assert.strictEqual(types('faint')[0].ms, C.faint.restMs); assert.ok(a.faintUntil > 0 && a.faintWarp > 0);
    assert.ok(!w.creatureEligible(F, f, a, t0 + 1), 'ระหว่างสลบไม่ถูกตี'); w.crAt = 0; w.creatureTick(a.faintWarp + C.tickMs + 1);
    const at = f === 1 ? S.CAVE.spawn : w.caveLanding(f);
    assert.ok(a.x === at.x && a.y === at.y && a.scene === '@cave' + f, 'วาร์ปไปจุดลงบันได/จุดเกิดของชั้น ' + f); assert.ok(!a.faintWarp && !a.stunUntil);
    assert.strictEqual(a.rec.inv.coin, coin, 'สลบไม่เสียเหรียญ'); assert.ok(a.rec.inv.stone === 3 && a.rec.inv.pick_1 === 1, 'สลบไม่เสียของ');
  }
  // โดนห่างเกิน 30 วิ ไม่สลบ
  const { F, c } = setup(2, 'bat'), K = S.CREATURES.bat, t0 = Date.now(); ws.msgs.length = 0;
  for (let i = 0; i < 6; i++) w.creatureHit(F, 2, c, K, a, t0 + i * 10000); assert.strictEqual(types('faint').length, 0, 'โดนห่างกัน ≥ 30 วิ/4 ครั้ง ไม่สลบ');
}
// 7) ผู้เล่นในเขตปลอดภัยไม่ถูกตี • ออกชั้นแล้วไม่ถูกตีต่อ
{
  const { F, c } = setup(3, 'rat'); const sp = w.caveLanding(3); a.x = sp.x; a.y = sp.y; c.x = sp.x + 10; c.y = sp.y; ws.msgs.length = 0; const h0 = a.rec.hunger;
  w.creatureStrike(F, 3, Object.assign(c, { w: { x: c.x, y: c.y, r: 100 } }), S.CREATURES.rat, Date.now()); assert.strictEqual(a.rec.hunger, h0, 'ในเขตปลอดภัยไม่ถูกตี'); assert.strictEqual(types('hurt').length, 0);
  const s2 = setup(3, 'rat'); w.changeScene(a, null, S.SPAWN.x, S.SPAWN.y); ws.msgs.length = 0; const h1 = a.rec.hunger;
  w.creatureStrike(s2.F, 3, Object.assign(s2.c, { w: { x: s2.c.x, y: s2.c.y, r: 100 } }), S.CREATURES.rat, Date.now()); assert.strictEqual(a.rec.hunger, h1, 'ออกชั้นแล้วไม่ถูกตี'); assert.strictEqual(types('hurt').length, 0);
}
// 8) ฟาดสัตว์: ตายตามจำนวนฟาด อีเต้อสึก เกิดใหม่หลัง respawnMs • ได้ของ/เหรียญ/XP = 0
{
  const { F, c } = setup(2, 'bat'); c.hp = c.hpMax = 2; a.dir = 3; const [tx, ty] = S.facing(a.x, a.y, a.dir); c.x = (tx + 0.5) * TS; c.y = (ty + 0.5) * TS; F.crWait = [];
  const dur0 = w.durCur(a, 'pick'), xp0 = a.rec.skills.mine || 0, inv0 = JSON.stringify(a.rec.inv), act = () => { a.lastAct = a.hitAt = 0; w.handle(a, { t: 'act', tool: 'pick', tx: undefined, ty: undefined }); };
  act(); assert.strictEqual(c.hp, 1, 'ฟาดครั้งแรก hp ลด 1'); assert.ok(types('crh').some(m => m.id === c.id && m.hp === 1), 'ส่ง crh'); assert.strictEqual(c.st, 4, 'สะดุ้ง/พัก');
  assert.ok(w.durCur(a, 'pick') < dur0, 'อีเต้อสึก');
  c.x = (tx + 0.5) * TS; c.y = (ty + 0.5) * TS; act(); assert.ok(!F.creatures.has(c.id), 'ตายหลังฟาดครบ'); assert.ok(types('crd').some(m => m.id === c.id), 'ส่ง crd');
  assert.strictEqual(JSON.stringify(a.rec.inv), inv0, 'ฆ่าสัตว์ไม่ได้ของ/เหรียญ'); assert.strictEqual(a.rec.skills.mine || 0, xp0, 'ไม่ได้ XP');
  assert.strictEqual(F.crWait.length, 1); assert.ok(F.crWait[0].at - Date.now() > C.respawnMs - 2000, 'คิวเกิดใหม่ตาม respawnMs');
  ws.msgs.length = 0; F.crWait[0].at = 0; w.crAt = 0; w.creatureTick(Date.now() + 1000); assert.strictEqual(types('crn').length, 1, 'เกิดใหม่แล้วส่ง crn'); assert.strictEqual(F.creatures.size, 1);
  assert.ok(Math.hypot([...F.creatures.values()][0].x - a.x, [...F.creatures.values()][0].y - a.y) >= C.spawnGap * TS - 1, 'เกิดใหม่ห่างผู้เล่น');
  // สตันฟาดไม่ได้
  const c2 = [...F.creatures.values()][0]; c2.x = (tx + 0.5) * TS; c2.y = (ty + 0.5) * TS; const hp = c2.hp; a.stunUntil = Date.now() + 5000; act(); assert.strictEqual(c2.hp, hp, 'สตันฟาดไม่ได้'); a.stunUntil = 0;
  // ไม่มีสัตว์หน้า = ลงไปหาแร่ตามเดิม (ไม่ error)
  c2.x = c2.y = 0; act();
}
// 9) ง้าง → cra → โจมตี (ครบวงจรผ่านเดลต้าเวลา)
{
  const { F, c } = setup(2, 'rat'); c.k = 'rat'; ws.msgs.length = 0; const sd = [30, -30, 20, -20].find(o => [o].every(d => !S.blockedAt(F.map, a.x + d, a.y, C.stepR) && !w.creatureSafe(F, 2, a.x + d, a.y))); c.x = a.x + sd; c.y = a.y; let now = Date.now() + 2e6; w.crAt = 0; const h0 = a.rec.hunger; let cra = false;
  for (let i = 0; i < 30 && a.rec.hunger === h0; i++) { w.creatureTick(now += 260); if (types('cra').length) cra = true; if (c.st !== 2) a.crInv = 0; }
  assert.ok(cra, 'ส่ง cra ตอนเริ่มง้าง'); const m = types('cra')[0]; assert.ok(m.id === c.id && m.r > 0 && m.ms === S.CREATURES.rat.wind);
}
// 10) สวิตช์ปิด: ไม่มีสัตว์ ไม่มีข้อความ
{
  C.on = false; try {
    const { F } = (goto(6), { F: w.floorOf(6) }); F.creatures = null; ws.msgs.length = 0; goto(6);
    assert.ok(!F.creatures, 'ปิดสวิตช์ไม่เกิด'); assert.strictEqual(types('crs').length + types('crn').length + types('crm').length, 0, 'ไม่มีข้อความสัตว์'); w.creatureTick(Date.now() + 5e6);
  } finally { C.on = true; }
}
// 11) ไม่ลงเซฟ + ชั้นทะเลไม่มีสัตว์
{
  goto(2); assert.ok(!JSON.stringify(a.rec).includes('creature') && !('creatures' in a.rec)); assert.ok(!JSON.stringify(w.saved).includes('"crs"'));
  assert.ok(!w.creatureOn(S.SEA.floor) && !w.creatureOn(S.OCEAN.floor), 'ชั้นทะเลไม่มีสัตว์');
}
// 12) รีวิว: ฟาดไกล/ทะลุผนังไม่ได้ • หิว 0 ยังฟาดสัตว์ได้แต่ขุดแร่ไม่ได้ • สัตว์เกิดตอนมีคนอยู่แล้วส่ง crn ให้คนเดิม • สลบแล้วออกถ้ำเคลียร์สถานะ
{
  const { F, c } = setup(2, 'bat'); c.hp = c.hpMax = 5; a.dir = 3; const [tx, ty] = S.facing(a.x, a.y, a.dir);
  const act = () => { a.lastAct = a.hitAt = 0; w.handle(a, { t: 'act', tool: 'pick' }); };
  c.x = a.x + C.strikeReach * TS + 40; c.y = a.y; assert.strictEqual(w.creatureStrikeBy(a, Date.now(), Math.floor(c.x / TS), Math.floor(c.y / TS)), false, 'ไกลเกิน strikeReach ฟาดไม่ได้'); assert.strictEqual(c.hp, 5);
  c.x = (tx + 0.5) * TS; c.y = (ty + 0.5) * TS; const row = Math.floor(a.y / TS), col = Math.floor(a.x / TS), keep = F.map[row][col + 1]; F.map[row][col + 1] = S.T.ROCK !== undefined ? S.T.ROCK : S.T.WALL; // ผนังคั่นระหว่างผู้เล่นกับสัตว์
  if (S.caveOpen(F.map[row][col + 1])) F.map[row][col + 1] = S.T.ORE;
  assert.strictEqual(w.creatureStrikeBy(a, Date.now(), tx, ty), false, 'ฟาดทะลุผนังไม่ได้'); F.map[row][col + 1] = keep;
  a.rec.hunger = 0; act(); assert.strictEqual(c.hp, 4, 'หิว 0 ยังฟาดสัตว์ได้');
  F.ores.clear(); const before = JSON.stringify(a.rec.inv); act(); assert.strictEqual(JSON.stringify(a.rec.inv), before); a.rec.hunger = 100;
}
{
  const ws2 = mkWs(), b = w.join(ws2, 'bob', '#3498db').p; goto(5); const F = w.floorOf(5); w.changeScene(b, '@cave5', S.CAVE.spawn.x, S.CAVE.spawn.y); ws2.msgs.length = 0;
  const gone = [...F.creatures.keys()][0]; F.creatures.delete(gone); a.x = a.y = 0; ws.msgs.length = 0; w.changeScene(a, '@cave5', S.CAVE.spawn.x, S.CAVE.spawn.y);
  assert.ok(ws2.msgs.some(m => m.t === 'crn'), 'คนที่อยู่ก่อนได้ crn ตัวที่เกิดใหม่'); assert.ok(types('crs').length === 1, 'คนเข้าใหม่ได้ crs');
  w.changeScene(b, null, S.SPAWN.x, S.SPAWN.y); w.leave(b);
}
{
  const { F, c } = setup(2, 'rat'); const t0 = Date.now(); for (let i = 0; i < C.faint.hits; i++) w.creatureHit(F, 2, c, S.CREATURES.rat, a, t0 + i * (C.invulnMs + 10));
  assert.ok(a.faintWarp && a.stunUntil); w.changeScene(a, null, S.SPAWN.x, S.SPAWN.y);
  assert.ok(!a.faintWarp && !a.stunUntil && !a.faintUntil, 'สลบแล้วออกถ้ำ เคลียร์สถานะ'); w.crAt = 0; w.creatureTick(t0 + 1e5); assert.strictEqual(a.scene, null, 'ไม่ถูกวาร์ปเข้าถ้ำ');
}
// 13) โปรไฟล์ชั้น (J4): ชั้นเหมืองได้ค่าเดิม • ทะเลไม่มี • ป่าเป็นโปรไฟล์ hp
for (let f = 1; f <= S.MINE.floors; f++) { const pr = S.crProfile(f); assert.ok(pr && pr.id === 'mine' && pr.on && pr.hit === 'hunger' && pr.strike === 'pick' && pr.wake === 'stairs' && pr.open === S.caveOpen && pr.respawnMs === C.respawnMs && pr.cap === S.creatureCap(f), 'โปรไฟล์ชั้นเหมือง ' + f); assert.ok(w.creatureOn(f)); }
assert.strictEqual(S.crProfile(S.SEA.floor), null); assert.strictEqual(S.crProfile(S.OCEAN.floor), null); assert.strictEqual(S.crProfile(0), null); assert.ok(S.crProfile(97).id === 'jungle' && S.crProfile(97).hit === 'hp');
{ C.on = false; try { assert.ok(!w.creatureOn(1) && !w.creatureOn(97)); assert.ok(!S.crProfile(3).on); } finally { C.on = true; } }
console.log('test-creatures: ผ่านทั้งหมด');
process.exit(0);
