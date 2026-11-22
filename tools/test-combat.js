// ทดสอบระบบต่อสู้ในป่าดงดิบ (J4–J6): HP/สูตรดาเมจ/จังหวะกันรัว/สลบ→ค่ายไม่เสียของ/ฮีล/ของตก/XP/สมุนไพร/สวิตช์ปิด/ชั้นเหมืองใช้กติกาหิวเดิม
// รัน: node tools/test-combat.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-combat-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, CB = S.COMBAT, C = S.CREATURE, J = S.JUNGLE;
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('combattest'), ws = mkWs(), a = w.join(ws, 'alice', '#e74c3c').p;
const types = t => ws.msgs.filter(m => m.t === t), last = t => types(t).pop();
a.rec.hunger = 100; a.rec.inv = { coin: 500, stone: 3 };
const enter = () => { if (a.scene) w.changeScene(a, null, S.SPAWN.x, S.SPAWN.y); w.warpTo(a, 'jungle'); };
const F = () => w.floorOf(97);
// วางผู้เล่นกลางที่โล่งนอกเขตปลอดภัย แล้วเคลียร์สัตว์ ใส่สัตว์ 1 ตัวหน้าผู้เล่น (ชนิด k)
const open = (x, y) => !S.blockedAt(F().map, (x + 0.5) * TS, (y + 0.5) * TS, 14) && !S.jungleSafe((x + 0.5) * TS, (y + 0.5) * TS);
let spot = null; for (let y = 12; y < 20 && !spot; y++) for (let x = 25; x < 40 && !spot; x++) if ([0, 1, 2].every(d => open(x + d, y)) && open(x - 1, y)) spot = [x, y];
const setup = k => {
  enter(); const f = F(); f.creatures.clear(); f.crWait = [];
  a.x = (spot[0] + 0.5) * TS; a.y = (spot[1] + 0.5) * TS; a.dir = 3; a.stunUntil = a.faintUntil = a.faintWarp = a.crInv = a.hitAt = a.lastAct = 0; a.cb.hp = a.cb.mx; a.cb.st = 'ok'; a.cb.last = 0; ws.msgs.length = 0;
  const hp = S.crHpOf(k, 97), c = { id: 7000 + (setup.n = (setup.n || 0) + 1), k, x: a.x + TS * 0.8, y: a.y, dir: 2, st: 0, hp, hpMax: hp, until: 0, wt: 0, wdx: 0, wdy: 0, tid: 0, sent: null, spot: 0, hx: a.x + TS * 0.8, hy: a.y, ret: false };
  f.creatures.set(c.id, c); return { f, c };
};
const swing = (o = {}) => { a.lastAct = 0; a.hitAt = 0; w.handle(a, Object.assign({ t: 'act', tool: 'sword' }, o)); };

// 1) ค่าใน shared
assert.deepStrictEqual(Object.keys(S.JUNGLE_MON), ['jslime', 'jwasp', 'jsnake', 'jstump']);
assert.deepStrictEqual(Object.values(S.JUNGLE_MON).map(m => [m.hp, m.dmg, m.wind, m.spd, m.xp]), [[24, 5, 700, 0.45, 4], [18, 6, 500, 0.85, 6], [32, 10, 500, 0.65, 9], [60, 14, 900, 0.5, 15]]);
assert.strictEqual(CB.swordDmg[1], 10); assert.strictEqual(CB.bareDmg, 3); assert.strictEqual(J.mon.on, true); assert.strictEqual(J.mon.respawnMs, 90000);
for (const k of ['jherb', 'jm_gel', 'jm_sting', 'jm_skin', 'jm_core']) { const i = S.itemInfo(k); assert.ok(i && i.name && i.once && !i.sell && !i.buy && !S.isTradable(k) && !i.food, 'ของป่าไม่ขาย/ไม่เทรด/ไม่ใช่อาหาร ' + k); }
// ชั้นเหมืองได้โปรไฟล์เดิม ทะเลไม่มี
assert.strictEqual(S.crProfile(3).hit, 'hunger'); assert.strictEqual(S.crProfile(3).strike, 'pick'); assert.strictEqual(S.crProfile(98), null); assert.strictEqual(S.crProfile(97).hit, 'hp');

// 2) เข้าป่า: HP เต็ม 100 + cb + jh + มอนสเตอร์ 18 ตัวที่จุดบ้าน
enter(); assert.strictEqual(a.cb.hp, 100); assert.strictEqual(a.cb.mx, 100);
assert.deepStrictEqual(last('cb'), { t: 'cb', hp: 100, mx: 100, st: 'ok' }); const jh = last('jh'); assert.strictEqual(jh.list.length, 12); assert.ok(jh.list.every(h => h.length === 3 && h[2] === 1));
{ const cs = [...F().creatures.values()]; assert.strictEqual(cs.length, 18); const crs = last('crs'); assert.strictEqual(crs.list.length, 18);
  J.mon.spots.forEach(([k, x, y], i) => { const c = cs.find(q => q.spot === i); assert.ok(c && c.k === k, 'ตัวที่ ' + i); assert.strictEqual(Math.floor(c.x / TS), x); assert.strictEqual(Math.floor(c.y / TS), y); assert.strictEqual(c.hp, S.JUNGLE_MON[k].hp); assert.ok(!S.jungleSafe(c.x, c.y)); }); }
a.rec.skills.fight = S.xpFor(2, 'fight'); assert.strictEqual(S.xpFor(2, 'fight'), 300, 'หลอดนักสู้ Lv2 = 300 XP (22 พ.ย. 2026 ซิม jungle-sim: ≈ 47 ตัว)'); assert.strictEqual(w.combatMax(a), 104, 'Lv2 นักสู้ = 100+4'); a.rec.skills.fight = S.xpFor(2, 'fight') - 1; assert.strictEqual(w.combatMax(a), 100, 'ขาด 1 XP ยัง Lv1'); a.rec.skills.fight = 0;

// 3) ดาเมจ: มือเปล่า 3 ดาบไม้ 10 • เล็งอัตโนมัติในกรวย • ส่ง crh d/by
{ const { c } = setup('jstump'); swing(); assert.strictEqual(c.hp, 57, 'มือเปล่า 3'); const h = last('crh'); assert.ok(h && h.id === c.id && h.hp === 57 && h.d === 3 && h.by === a.id, 'crh มี d กับ by');
  a.rec.inv.sword_1 = 1; c.x = a.x + TS * 0.8; c.y = a.y; swing(); assert.strictEqual(c.hp, 47, 'ดาบไม้ 10'); }
// หลังเป้า (กรวย 120°) ฟันไม่โดน • ไกลเกิน 1.25 ช่องไม่โดน
{ const { c } = setup('jslime'); c.x = a.x - TS * 0.8; swing(); assert.strictEqual(c.hp, 24, 'อยู่ข้างหลังไม่โดน'); const { c: d } = setup('jslime'); d.x = a.x + TS * 1.4; swing(); assert.strictEqual(d.hp, 24, 'ไกลเกินระยะ');
  const { c: e } = setup('jslime'); e.x = a.x + TS * 0.45; e.y = a.y + TS * 0.95; swing(); assert.strictEqual(e.hp, 24, 'มุมเกิน 60° จากหน้า (กรวย 120°) ไม่โดน'); const { c: g } = setup('jslime'); g.x = a.x + TS * 0.9; g.y = a.y + TS * 0.3; swing(); assert.strictEqual(g.hp, 14, 'ในกรวยโดน (ดาบ 10)'); }
// จังหวะกันรัว: ฟันถี่กว่า SWING_MS−150 ไม่นับ
{ const { c } = setup('jstump'); swing(); const hp1 = c.hp; c.x = a.x + TS * 0.8; w.handle(a, { t: 'act', tool: 'sword' }); a.lastAct = 0; w.handle(a, { t: 'act', tool: 'sword' }); assert.strictEqual(c.hp, hp1, 'ถี่เกินไม่นับ');
  a.lastAct = 0; a.hitAt = Date.now() - (S.SWING_MS - 150) - 5; w.handle(a, { t: 'act', tool: 'sword' }); assert.strictEqual(c.hp, hp1 - 10, 'ครบจังหวะแล้วโดน'); }
// ค่า tx ty ผิด/ไกล = ไม่ทำอะไร (ไม่พัง)
{ const { c } = setup('jslime'); swing({ tx: 1e9, ty: 5 }); swing({ tx: 'a', ty: null }); swing({ tx: NaN, ty: NaN }); swing({ tx: spot[0] + 30, ty: spot[1] }); assert.ok(c.hp <= 24 && w.players.get(a.id) === a); }
// เขตปลอดภัยฟันมอนสเตอร์ไม่ได้
{ const { c } = setup('jslime'); a.x = 31.5 * TS; a.y = 6.5 * TS; c.x = a.x + TS * 0.8; c.y = a.y; swing(); assert.strictEqual(c.hp, 24, 'ในเขตปลอดภัยฟันไม่ได้'); }

// 4) โดนตี = เสีย HP ตามชนิด ผลัก/สตัน ส่ง hurt d อมตะ 1.5 วิ ไม่เสียของ • ไม่แตะความหิว
{ const { f, c } = setup('jsnake'), JK = S.JUNGLE_MON.jsnake, now = Date.now(), inv = JSON.stringify(a.rec.inv), coin = a.rec.inv.coin, hun = a.rec.hunger, x0 = a.x;
  w.creatureHit(f, 97, c, JK, a, now); assert.strictEqual(a.cb.hp, 90); const h = last('hurt'); assert.ok(h && h.d === 10 && h.k === 'jsnake' && h.h === undefined && h.stun === JK.stun, 'hurt มี d'); assert.ok(a.x < x0 && a.stunUntil > now, 'ผลัก+สตัน');
  assert.strictEqual(a.rec.hunger, hun, 'ในป่าโดนตีไม่ลดความหิว'); w.creatureHit(f, 97, c, JK, a, now + 100); assert.strictEqual(a.cb.hp, 90, 'อมตะ 1.5 วิ'); w.creatureHit(f, 97, c, JK, a, now + C.invulnMs + 10); assert.strictEqual(a.cb.hp, 80);
  w.cbAt = 0; w.combatTick(Date.now() + 400); assert.ok(types('cb').length >= 1 && types('cb').length <= 3 && last('cb').hp === 80, 'ส่ง cb เมื่อเปลี่ยน (ค้างรอส่งรอบถัดไปได้)'); assert.strictEqual(a.rec.inv.coin, coin); assert.strictEqual(JSON.stringify(a.rec.inv), inv); }
// ง้าง + cra ครบวงจร และไม่ทะลุเขตปลอดภัย
{ const { f, c } = setup('jslime'); c.x = a.x + TS * 0.6; ws.msgs.length = 0; let now = Date.now(); for (let i = 0; i < 12 && a.cb.hp === 100; i++) { w.creatureTick(now += 260); w.combatTick(now); if (c.st !== 2) a.crInv = 0; }
  const m = types('cra')[0]; assert.ok(m && m.id === c.id && m.ms === 700 && m.r > 0, 'ส่ง cra ง้าง 700ms'); assert.ok(a.cb.hp < 100, 'สไลม์ตีโดน'); assert.strictEqual(a.cb.hp, 95); }

// 5) สลบ: HP 0 → faint 3 วิ → ตื่นที่ค่าย HP 50% ไม่เสียของ/เหรียญ
{ const { f, c } = setup('jstump'), JK = S.JUNGLE_MON.jstump, t0 = Date.now(), inv = JSON.stringify(a.rec.inv); a.cb.hp = 10; a.rec.dur = { pick: 5 }; const dur = JSON.stringify(a.rec.dur);
  w.creatureHit(f, 97, c, JK, a, t0); assert.strictEqual(a.cb.hp, 0); assert.strictEqual(a.cb.st, 'faint'); assert.strictEqual(last('faint').ms, 3000); const cb = last('cb'); assert.ok(cb.st === 'faint' && cb.hp === 0 && cb.ms > 0 && cb.ms <= 3000);
  assert.ok(!w.creatureEligible(f, 97, a, t0 + 1), 'สลบแล้วไม่ถูกตีซ้ำ'); swing(); assert.ok(c.hp === JK.hp, 'สลบฟันไม่ได้');
  w.crAt = 0; w.creatureTick(t0 + 1000); assert.strictEqual(a.scene, '@cave97'); assert.strictEqual(a.cb.st, 'faint', 'ยังไม่ครบเวลา');
  w.crAt = 0; w.creatureTick(a.faintWarp + C.tickMs + 1); assert.strictEqual(a.cb.st, 'ok'); assert.strictEqual(a.cb.hp, 50); assert.ok(a.x === J.spawn.x && a.y === J.spawn.y, 'ตื่นที่ค่าย'); assert.ok(!a.faintWarp && !a.stunUntil);
  assert.strictEqual(JSON.stringify(a.rec.inv), inv, 'สลบไม่เสียของ/เหรียญ'); assert.strictEqual(JSON.stringify(a.rec.dur), dur, 'ไม่เสียความทน'); assert.deepStrictEqual([last('cb').hp, last('cb').st], [50, 'ok']); assert.ok(S.jungleSafe(a.x, a.y)); }

// 6) ฟื้น HP: พ้นการต่อสู้ 8 วิ +1/วิ • เขตปลอดภัย +5/วิ • ไม่ฟื้นระหว่างต่อสู้
{ setup('jslime'); a.cb.hp = 50; const t = Date.now(); a.cb.last = t; w.cbAt = t - 250; w.combatTick(t); assert.strictEqual(a.cb.hp, 50, 'เพิ่งสู้ ไม่ฟื้น');
  a.cb.last = t - CB.regenIdleMs - 1; w.cbAt = t; w.combatTick(t + 1000 - 1 + 1); assert.ok(Math.abs(a.cb.hp - 50.5) < 0.01 || Math.abs(a.cb.hp - 51) < 0.01, 'ฟื้น ~1/วิ (dt ≤ 0.5 ต่อรอบ) ' + a.cb.hp);
  a.x = 31.5 * TS; a.y = 6.5 * TS; a.cb.hp = 50; a.cb.last = t; w.cbAt = t; w.combatTick(t + 500); assert.ok(Math.abs(a.cb.hp - 52.5) < 0.01, 'เขตปลอดภัย +5/วิ ' + a.cb.hp);
  // ไม่เกิน mx
  a.cb.hp = a.cb.mx - 1; w.cbAt = t; w.combatTick(t + 500); assert.ok(a.cb.hp <= a.cb.mx);
  // cb ไม่ถี่เกิน 4/วิ
  ws.msgs.length = 0; a.cb.hp = 10; a.cb.sentKey = ''; a.cb.sentAt = 0; let tt = t + 10000; for (let i = 0; i < 40; i++) { tt += 50; w.cbAt = 0; w.combatTick(tt); a.cb.sentAt = a.cb.sentAt; } assert.ok(types('cb').length <= 4 * 2 + 1, 'cb ≤ 4 ต่อวิ ' + types('cb').length); }
// กินอาหาร: food×0.5% HP เต็ม (ข้ามอิ่ม) • สมุนไพร +30 คูลดาวน์ 5 วิ ไม่เพิ่มความอิ่ม HP เต็มไม่เสียของ
{ setup('jslime'); a.rec.inv.meal_rice = 2; a.rec.inv.jherb = 3; a.cb.hp = 30; a.rec.hunger = 50; const exp = a.cb.mx * S.FOOD.meal_rice * CB.eatPct / 100;
  w.handle(a, { t: 'eat', item: 'meal_rice' }); assert.ok(Math.abs(a.cb.hp - (30 + exp)) < 0.01, 'อาหารฟื้น HP ' + a.cb.hp); assert.ok(a.rec.hunger > 50 && a.rec.inv.meal_rice === 1);
  a.cb.hp = 30; const hun = a.rec.hunger; w.handle(a, { t: 'eat', item: 'jherb' }); assert.strictEqual(a.cb.hp, 60); assert.strictEqual(a.rec.inv.jherb, 2); assert.strictEqual(a.rec.hunger, hun, 'สมุนไพรไม่เพิ่มความอิ่ม');
  w.handle(a, { t: 'eat', item: 'jherb' }); assert.strictEqual(a.cb.hp, 60, 'คูลดาวน์'); assert.strictEqual(a.rec.inv.jherb, 2); a.cb.healAt = 0; a.cb.hp = a.cb.mx; w.handle(a, { t: 'eat', item: 'jherb' }); assert.strictEqual(a.rec.inv.jherb, 2, 'HP เต็มไม่กิน');
  a.cb.hp = 99; a.cb.healAt = 0; w.handle(a, { t: 'eat', item: 'jherb' }); assert.strictEqual(a.cb.hp, 100, 'ไม่เกินเต็ม');
  a.rec.hunger = 100; a.cb.hp = a.cb.mx; a.rec.inv.meal_rice = 2; w.handle(a, { t: 'eat', item: 'meal_rice' }); assert.strictEqual(a.rec.inv.meal_rice, 2, 'อิ่มและ HP เต็ม = กินไม่ลง');
  // นอกป่ากินสมุนไพรไม่ได้ ไม่เสียของ
  w.changeScene(a, null, S.SPAWN.x, S.SPAWN.y); assert.strictEqual(a.cb, null); const n = a.rec.inv.jherb; w.handle(a, { t: 'eat', item: 'jherb' }); assert.strictEqual(a.rec.inv.jherb, n); }

// 7) ฆ่า: ลบสัตว์ ส่ง crd เข้าคิวเกิดใหม่ 90 วิ XP นักสู้ + ของตกต่อคนที่ตีโดน (บังคับสุ่ม)
{ const ws2 = mkWs(), b = w.join(ws2, 'bob', '#3498db').p; a.rec.inv.sword_1 = 1; const rnd = Math.random;
  for (const k of Object.keys(S.JUNGLE_MON)) {
    const { f, c } = setup(k), JK = S.JUNGLE_MON[k]; c.hp = 10; c.hitBy = new Set([b.id]); b.scene = '@cave97'; b.x = a.x; b.y = a.y; b.rec.inv = {}; b.rec.skills = {}; a.rec.inv.sword_1 = 1; const xp0 = a.rec.skills.fight || 0; delete a.rec.inv[JK.drop.item];
    Math.random = () => 0; try { swing(); } finally { Math.random = rnd; }
    assert.ok(!f.creatures.has(c.id), k + ' ตาย'); assert.ok(types('crd').some(m => m.id === c.id)); assert.strictEqual(f.crWait.length, 1); assert.ok(Math.abs(f.crWait[0].at - Date.now() - 90000) < 2000 && f.crWait[0].spot === 0, 'เกิดใหม่ 90 วิ ที่จุดบ้านเดิม');
    assert.strictEqual(a.rec.skills.fight - xp0, JK.xp, 'XP นักสู้ ' + k); assert.strictEqual(a.rec.inv[JK.drop.item], 1, 'ของตก ' + k); assert.strictEqual(b.rec.inv[JK.drop.item], 1, 'คนที่ตีโดนอีกคนก็ได้ ' + k); assert.strictEqual(b.rec.skills.fight, JK.xp);
  }
  // สุ่มไม่ผ่าน = ไม่ตก
  { const { c } = setup('jslime'); c.hp = 1; delete a.rec.inv.jm_gel; Math.random = () => 0.99; try { swing(); } finally { Math.random = rnd; } assert.ok(!a.rec.inv.jm_gel, 'ไม่ตกเมื่อสุ่มไม่ผ่าน'); }
  // ไม่ตีไม่ได้ของ (คนที่ไม่ได้ตีโดน) 
  { const { f, c } = setup('jsnake'); c.hp = 1; c.hitBy = new Set(); b.rec.inv = {}; Math.random = () => 0; try { swing(); } finally { Math.random = rnd; } assert.ok(!b.rec.inv.jm_skin, 'คนที่ไม่ได้ตีไม่ได้ของ'); }
  w.changeScene(b, null, S.SPAWN.x, S.SPAWN.y); w.leave(b); }
// เลเวลนักสู้ขึ้น → HP เต็มสูงขึ้น
{ setup('jslime'); a.rec.skills.fight = S.xpFor(2, 'fight') - 1; w.combatXp(a, 4); assert.strictEqual(a.cb.mx, 104); assert.strictEqual(last('cb').mx, 104); }

// 8) พุ่มสมุนไพร: เก็บด้วย Action ได้ jherb เกิดใหม่ตามเวลา ส่ง jh1 • พุ่มที่ยังไม่งอกเก็บไม่ได้
{ setup('jslime'); F().creatures.clear(); const [hx, hy] = J.herbs[0]; a.x = (hx - 0.5) * TS; a.y = (hy + 0.5) * TS; a.dir = 3; a.rec.inv.jherb = 0; ws.msgs.length = 0;
  swing(); assert.strictEqual(a.rec.inv.jherb, J.herbN); assert.deepStrictEqual(last('jh1'), { t: 'jh1', x: hx, y: hy, r: 0 });
  swing(); assert.strictEqual(a.rec.inv.jherb, J.herbN, 'พุ่มยังไม่งอก เก็บซ้ำไม่ได้');
  const now = Date.now(); w.cbAt = 0; w.combatTick(now + 1000); assert.strictEqual(types('jh1').length, 1, 'ยังไม่ถึงเวลางอก');
  w.cbAt = 0; w.combatTick(now + J.herbMs + 1); assert.deepStrictEqual(last('jh1'), { t: 'jh1', x: hx, y: hy, r: 1 }); swing(); assert.strictEqual(a.rec.inv.jherb, 2 * J.herbN, 'งอกใหม่เก็บได้');
  assert.ok(!S.itemInfo('jherb').sell && !S.isTradable('jherb')); }
// ป้ายกลับหมู่บ้านด้วย Action
{ setup('jslime'); F().creatures.clear(); a.x = 28.5 * TS; a.y = 8.5 * TS; a.dir = 1; swing(); assert.ok(!a.scene && a.cb === null, 'Action ที่ป้าย = ออกจากป่า ทิ้ง HP'); }

// 9) ตายคิวเกิดใหม่: เกิดห่างผู้เล่น ≥ 8 ช่อง เฉพาะพื้นป่าในรัศมีบ้าน ไม่ในเขตปลอดภัย • รวม ≤ 9
{ setup('jslime'); const f = F(); f.creatures.clear(); f.crWait = J.mon.spots.map((s, i) => ({ at: 0, spot: i })); a.x = (24 + 0.5) * TS; a.y = (14 + 0.5) * TS; // ยืนทับจุดบ้านสไลม์ A
  w.crAt = 0; w.creatureTick(Date.now() + 1000);
  assert.ok(f.creatures.size <= 18 && f.creatures.size >= 12, 'ไม่เกิน 18 ' + f.creatures.size); const seen = new Set();
  for (const c of f.creatures.values()) { const s = J.mon.spots[c.spot]; assert.ok(!seen.has(c.spot)); seen.add(c.spot); assert.strictEqual(c.k, s[0]); assert.strictEqual(f.map[Math.floor(c.y / TS)][Math.floor(c.x / TS)], S.T.CAVE, 'เกิดบนพื้นป่า'); assert.ok(Math.hypot(Math.floor(c.x / TS) - s[1], Math.floor(c.y / TS) - s[2]) <= J.mon.leash + 0.01, 'ในรัศมีบ้าน'); assert.ok(!S.jungleSafe(c.x, c.y)); assert.ok(Math.hypot(c.x - a.x, c.y - a.y) >= C.spawnGap * TS - 1, 'ห่างผู้เล่น ≥ 8 ช่อง'); } }
// เดินเล่นนานๆ: ไม่ทะลุผนัง ไม่เข้าเขตปลอดภัย ไม่ไกลบ้านเกินรัศมี+ผ่อน (ผู้เล่นไม่อยู่ใกล้)
{ enter(); const f = F(); f.creatures.clear(); f.crWait = []; w.creatureFill(f, 97, Date.now()); a.x = 31.5 * TS; a.y = 5.5 * TS; let now = Date.now() + 5e6; w.crAt = now - 260; let far = 0;
  for (let i = 0; i < 1500; i++) { w.creatureTick(now += 260); for (const c of f.creatures.values()) { assert.ok(!S.blockedAt(f.map, c.x, c.y, C.stepR), 'ไม่ทะลุผนัง'); assert.ok(!S.jungleSafe(c.x, c.y), 'ไม่เข้าเขตปลอดภัย'); far = Math.max(far, Math.hypot(c.x - c.hx, c.y - c.hy)); } }
  assert.ok(far <= (J.mon.leash + 2.5) * TS, 'ไม่ไกลบ้านเกินรัศมี ' + far / TS); }
// ไล่เกินรัศมีบ้านแล้วเลิกไล่ กลับบ้าน (ผู้เล่นยืนไกลจากบ้านเกิน leash+1 ช่อง = ไม่ถูกเล็ง)
{ const { f, c } = setup('jwasp'); c.hx = c.x; c.hy = c.y; a.x = c.x + (J.mon.leash + 2) * TS; if (!open(Math.floor(a.x / TS), Math.floor(a.y / TS))) a.x = c.x - (J.mon.leash + 2) * TS; w.crAt = 0; w.creatureTick(Date.now() + 1000); assert.strictEqual(c.st, 0, 'ผู้เล่นอยู่นอกรัศมีบ้าน ไม่ไล่'); }
// มอนสเตอร์ไม่เข้าเขตปลอดภัยแม้ไล่ผู้เล่นที่หนีเข้าเขต
{ const { f, c } = setup('jslime'); c.st = 1; c.tid = a.id; a.x = 31.5 * TS; a.y = 9.5 * TS; c.x = a.x; c.y = 10.9 * TS; c.hx = c.x; c.hy = c.y; w.crAt = 0; let now = Date.now() + 1000; for (let i = 0; i < 10; i++) w.creatureTick(now += 260); assert.ok(!S.jungleSafe(c.x, c.y)); assert.strictEqual(a.cb.hp, a.cb.mx, 'ผู้เล่นในเขตปลอดภัยไม่ถูกตี'); }

// 10) ออกเกมกลางป่า: เซฟตำแหน่งหน้าประตูเมือง ไม่เซฟ HP/มอนสเตอร์ • กลับเข้า HP เต็ม
{ setup('jslime'); a.cb.hp = 20; assert.ok(!JSON.stringify(a.rec).includes('"cb"')); w.changeScene(a, null, S.SPAWN.x, S.SPAWN.y); enter(); assert.strictEqual(a.cb.hp, a.cb.mx, 'เข้าป่าใหม่ HP เต็ม'); }

// 11) สวิตช์ปิด JUNGLE.mon.on=false: ไม่มีมอนสเตอร์ ไม่มี cb/jh ฟัน/เก็บไม่ทำอะไร (ป่าเปล่า)
{ J.mon.on = false; try {
    if (a.scene) w.changeScene(a, null, S.SPAWN.x, S.SPAWN.y); w.floorOf(97).creatures = null; ws.msgs.length = 0; w.warpTo(a, 'jungle');
    assert.ok(!w.floorOf(97).creatures, 'ปิดสวิตช์ไม่เกิด'); assert.strictEqual(a.cb, null); assert.strictEqual(types('cb').length + types('jh').length + types('crs').length + types('crn').length, 0);
    const [hx, hy] = J.herbs[0]; a.x = (hx - 0.5) * TS; a.y = (hy + 0.5) * TS; a.dir = 3; a.rec.inv.jherb = 0; swing(); assert.ok(!a.rec.inv.jherb, 'ปิดสวิตช์เก็บสมุนไพรไม่ได้'); w.creatureTick(Date.now() + 1e4); w.combatTick(Date.now() + 1e4);
    w.changeScene(a, null, S.SPAWN.x, S.SPAWN.y);
  } finally { J.mon.on = true; } }
// แต่สวิตช์ถ้ำ C.on ปิด = ป่าไม่มีมอนสเตอร์ แต่ยังมี HP/สมุนไพร
{ C.on = false; try { if (a.scene) w.changeScene(a, null, S.SPAWN.x, S.SPAWN.y); w.floorOf(97).creatures = null; w.warpTo(a, 'jungle'); assert.ok(!w.floorOf(97).creatures); assert.ok(a.cb); w.changeScene(a, null, S.SPAWN.x, S.SPAWN.y); } finally { C.on = true; } }

// 12) ชั้นเหมืองยังใช้กติกาหิวเดิม (ไม่มี cb ไม่ใช้ d)
{ w.changeScene(a, null, S.SPAWN.x, S.SPAWN.y); const at = w.caveLanding(3); w.changeScene(a, '@cave3', at.x, at.y); assert.strictEqual(a.cb, null); const f3 = w.floorOf(3); f3.creatures.clear(); a.rec.hunger = 100; a.crInv = 0; ws.msgs.length = 0;
  const c = { id: 8100, k: 'rat', x: a.x + 20, y: a.y, dir: 0, st: 0, hp: 3, hpMax: 3, until: 0, wt: 0, wdx: 0, wdy: 0, tid: 0, sent: null }; f3.creatures.set(c.id, c);
  w.creatureHit(f3, 3, c, S.CREATURES.rat, a, Date.now()); assert.strictEqual(Math.round(a.rec.hunger), 100 - S.creatureHunger(3)); const h = last('hurt'); assert.ok(h.h === S.creatureHunger(3) && h.d === undefined, 'เหมืองใช้ h หิว');
  c.hp = 2; ws.msgs.length = 0; assert.strictEqual(w.creatureDamage(f3, 3, c, a, 1, Date.now()), true); assert.deepStrictEqual(last('crh'), { t: 'crh', id: c.id, hp: 1 }, 'เหมือง crh ไม่มี d/by'); w.changeScene(a, null, S.SPAWN.x, S.SPAWN.y); }
console.log('test-combat: ผ่านทั้งหมด');
process.exit(0);
