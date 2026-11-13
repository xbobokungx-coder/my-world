// ทดสอบการปรับนักขุดแร่ (6 พ.ย. 2026): ตัวย้ายเซฟ xpv 3 → 4 • ตารางหลอด XP_TABLE_MINE รายอาชีพ • เวลาไต่เลเวลตามเป้า • บันไดลงช่องเดียว • ดาวความชำนาญ
// ใช้เรคอร์ดสังเคราะห์ใน DATA_DIR ชั่วคราวเท่านั้น (ไม่แตะ data/ จริง): node tools/test-mine-migrate.js
const fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-minemig-');
const S = require('../public/shared.js'), TS = S.TS, T = S.T, MIG = S.MINE_MIG;
const clone = o => JSON.parse(JSON.stringify(o));

// ---- (ข) ตารางหลอดรายอาชีพ ----
{
  assert.deepStrictEqual(S.XP_TABLE_MINE, [0, 0, 250, 535, 959, 1442, 2158, 2976, 4189, 5573, 7627, 9970, 13447, 17415, 23301, 30018, 39983, 51355, 68225, 87477, 116038], 'XP_TABLE_MINE ตรงตั๋ว');
  assert.strictEqual(S.XP_TABLE_MINE.length, S.MAX_LV + 1);
  for (let i = 3; i < S.XP_TABLE_MINE.length; i++) assert.ok(S.XP_TABLE_MINE[i] > S.XP_TABLE_MINE[i - 1], 'ตารางต้องเพิ่มขึ้น');
  for (let lv = 1; lv <= S.MAX_LV; lv++) {
    assert.strictEqual(S.xpFor(lv, 'mine'), S.XP_TABLE_MINE[lv]); assert.strictEqual(S.xpFor(lv), S.XP_TABLE[lv], 'ไม่ส่ง skill = ตารางเดิม');
    for (const sk of ['farm', 'animal', 'wood', 'cook']) assert.strictEqual(S.xpFor(lv, sk), S.XP_TABLE[lv], sk + ' ใช้ตารางเดิม'); assert.strictEqual(S.xpFor(lv, 'fish'), S.XP_TABLE_STD[lv], 'fish ใช้ XP_TABLE_STD (xpv 5 ปรับชาวประมง 6 พ.ย. 2026)');
    assert.strictEqual(S.levelOf(S.XP_TABLE_MINE[lv], 'mine'), lv, 'ขอบเลเวล mine ' + lv);
    if (lv > 1) assert.strictEqual(S.levelOf(S.XP_TABLE_MINE[lv] - 1, 'mine'), lv - 1);
    assert.strictEqual(S.levelOf(S.XP_TABLE[lv], 'farm'), lv); assert.strictEqual(S.levelOf(S.XP_TABLE[lv]), lv);
  }
  assert.strictEqual(S.levelOf(1000, 'mine'), 4, 'XP 1000 ที่ตารางนักขุด = Lv4 (959 ≤ 1000 < 1442)');
  assert.strictEqual(S.levelOf(1000, 'farm'), 2, 'XP เดียวกันที่ชาวนาเป็น Lv2 (700 ≤ 1000 < 2000)');
  assert.strictEqual(S.levelOf(1e9, 'mine'), S.MAX_LV); assert.strictEqual(S.levelOf(0, 'mine'), 1); assert.strictEqual(S.levelOf(undefined, 'mine'), 1);
}

// ---- (ก) ตัวแปลง XP: เลเวลและสัดส่วนความคืบหน้าเดิม ----
{
  for (let L = 1; L < S.MAX_LV; L++) for (const f of [0, 0.1, 0.25, 0.5, 0.75, 0.99]) {
    const old = Math.floor(S.XP_TABLE[L] + f * (S.XP_TABLE[L + 1] - S.XP_TABLE[L])), nw = S.xpMineV4(old);
    assert.strictEqual(S.levelOf(old), L, 'ตั้งต้น Lv' + L); assert.strictEqual(S.levelOf(nw, 'mine'), L, `Lv${L} f=${f}: เลเวลเดิมหลังแปลง (xp ${old} → ${nw})`);
    const fo = (old - S.XP_TABLE[L]) / (S.XP_TABLE[L + 1] - S.XP_TABLE[L]), fn = (nw - S.XP_TABLE_MINE[L]) / (S.XP_TABLE_MINE[L + 1] - S.XP_TABLE_MINE[L]);
    assert.ok(Math.abs(fo - fn) < 0.012, `Lv${L} f=${f}: สัดส่วนความคืบหน้า ${fo.toFixed(3)} → ${fn.toFixed(3)}`);
    if (f === 0) assert.strictEqual(nw, S.XP_TABLE_MINE[L], 'ต้นเลเวลตรงเป๊ะ');
  }
  assert.strictEqual(S.xpMineV4(0), 0); assert.strictEqual(S.xpMineV4(-50), 0); assert.strictEqual(S.xpMineV4(NaN), 0); assert.strictEqual(S.xpMineV4(undefined), 0);
  let prev = -1; for (let xp = 0; xp <= 700000; xp += 997) { const n = S.xpMineV4(xp); assert.ok(n >= prev, 'แปลงแล้วไม่ถอยหลัง (xp ' + xp + ')'); prev = n; }
  // เกิน Lv20: ส่วนเกินแปลงตามสัดส่วนหลอดต่อดาว (ดาวละ masteryXp('mine') แทน xpPer) ยังเป็น Lv20 และความคืบหน้าดาวเท่าเดิม
  assert.strictEqual(S.xpMineV4(S.XP_TABLE[20]), S.XP_TABLE_MINE[20], 'Lv20 พอดี');
  for (const extra of [0, 1, 5000, 12500, 25000, 60000, 125000]) {
    const nw = S.xpMineV4(S.XP_TABLE[20] + extra); assert.strictEqual(S.levelOf(nw, 'mine'), 20);
    assert.ok(Math.abs((nw - S.XP_TABLE_MINE[20]) / S.masteryXp('mine') - extra / S.MASTERY.xpPer) < 1 / S.masteryXp('mine') + 1e-9, 'ส่วนเกิน ' + extra + ': สัดส่วนดาวเท่าเดิม');
  }
  assert.strictEqual(S.xpMineV4(S.XP_TABLE[20] + S.MASTERY.xpPer), S.XP_TABLE_MINE[20] + S.masteryXp('mine'), 'ครบ 1 ดาวเดิม = ครบ 1 ดาวใหม่พอดี');
}

// ---- (ก) migrateMineV4: รายการในเรคอร์ด ----
{
  // อีเต้อ 1..6 → 1,2,4,6,8,10 ทีละชิ้น จำนวนคงเดิม ค่าอื่นไม่ถูกแตะ
  const MAP = { 1: 1, 2: 2, 3: 4, 4: 6, 5: 8, 6: 10 };
  for (const [o, n] of Object.entries(MAP)) {
    const rec = { xpv: 3, skills: { mine: 0 }, inv: { coin: 100, ['pick_' + o]: 1, lamp: 1, stone: 7 } }; const r = S.migrateMineV4(rec);
    assert.deepStrictEqual(rec.inv, { coin: 100, ['pick_' + n]: 1, lamp: 1, stone: 7 }, `pick_${o} → pick_${n}`); assert.deepStrictEqual(r, { refund: 0 }); assert.strictEqual(rec.xpv, 4);
  }
  { const rec = { xpv: 3, inv: { coin: 0, pick_1: 1, pick_2: 1, pick_3: 1, pick_4: 1, pick_5: 1, pick_6: 1 } }; S.migrateMineV4(rec);
    assert.deepStrictEqual(Object.keys(rec.inv).sort(), ['coin', 'pick_1', 'pick_10', 'pick_2', 'pick_4', 'pick_6', 'pick_8'].sort(), 'ถือครบ 6 ชิ้น แปลงไม่ชนกัน'); for (const k of ['pick_1', 'pick_2', 'pick_4', 'pick_6', 'pick_8', 'pick_10']) assert.strictEqual(rec.inv[k], 1); }
  // ความทนทานคงสัดส่วน (เต็ม / ครึ่ง / พัง / ซ่อมแล้ว)
  for (let t = 1; t <= 6; t++) for (const f of [1, 0.5, 0.2, 0]) for (const fx of [0, 2, 3]) {
    const oldMax = Math.floor(MIG.oldDur[t] * (1 - S.REPAIR.decay * fx)), rec = { xpv: 3, inv: { ['pick_' + t]: 1 }, dur: { pick: Math.round(oldMax * f) } }; if (fx) rec.fix = { pick: fx };
    const before = rec.dur.pick; S.migrateMineV4(rec); const nm = S.durMax('pick', MIG.pick[t], fx);
    if (before === 0) assert.strictEqual(rec.dur.pick, 0, 'พังยังพัง'); else assert.ok(Math.abs(rec.dur.pick / nm - before / oldMax) <= 1 / nm + 1 / oldMax, `pick_${t} f=${f} fix=${fx}: ${before}/${oldMax} → ${rec.dur.pick}/${nm}`);
    assert.ok(rec.dur.pick <= nm && rec.dur.pick >= 0);
  }
  { const rec = { xpv: 3, inv: { pick_3: 1 }, dur: { pick: 400, rod: 33 } }; S.migrateMineV4(rec); assert.strictEqual(rec.dur.pick, S.durMax('pick', 4, 0), 'เต็มยังเต็ม'); assert.strictEqual(rec.dur.rod, 33, 'ความทนทานอื่นไม่ถูกแตะ'); }
  { const rec = { xpv: 3, inv: { coin: 5 }, dur: { pick: 12 } }; S.migrateMineV4(rec); assert.strictEqual(rec.dur.pick, 12, 'ไม่มีอีเต้อในกระเป๋า ไม่แตะ dur'); }
  // ถุงมือ/ค้อน: ลบ + คืนเหรียญตามราคาซื้อเดิม
  const REF = { glove_1: 220, glove_2: 1200, glove_3: 4000, hammer_1: 600, hammer_2: 2500, hammer_3: 7000 };
  for (const [k, v] of Object.entries(REF)) { const rec = { xpv: 3, inv: { coin: 10, [k]: 1 } }, r = S.migrateMineV4(rec); assert.deepStrictEqual(rec.inv, { coin: 10 + v }); assert.strictEqual(r.refund, v, k + ' คืน ' + v); }
  { const rec = { xpv: 3, inv: Object.assign({ coin: 0 }, Object.fromEntries(Object.keys(REF).map(k => [k, 1]))) }, r = S.migrateMineV4(rec), sum = Object.values(REF).reduce((a, b) => a + b, 0);
    assert.strictEqual(r.refund, sum); assert.deepStrictEqual(rec.inv, { coin: sum }, 'ครบชุด คืนรวม ' + sum + ' และลบของเก่าหมด'); }
  { const rec = { xpv: 3, inv: { glove_3: 1, hammer_3: 1 } }; S.migrateMineV4(rec); assert.strictEqual(rec.inv.coin, 11000, 'ไม่มี coin เดิมก็สร้างให้'); }
  { const rec = { xpv: 3, inv: { coin: 1, pick_2: 1 } }; S.migrateMineV4(rec); assert.strictEqual(rec.inv.coin, 1, 'ไม่มีถุงมือ/ค้อน ไม่เปลี่ยนเหรียญ'); }
  // XP ผ่านตัวย้ายในเรคอร์ด: เฉพาะ skills.mine อาชีพอื่นไม่แตะ
  { const rec = { xpv: 3, skills: { mine: 20150, farm: 20150, fish: 700 }, inv: {} }; S.migrateMineV4(rec);
    assert.strictEqual(rec.skills.mine, S.XP_TABLE_MINE[7], 'Lv7 ต้นเลเวล'); assert.strictEqual(rec.skills.farm, 20150); assert.strictEqual(rec.skills.fish, 700); }
  // รันซ้ำไม่เปลี่ยน (idempotent) + xpv >= 4 ข้าม
  { const rec = { xpv: 3, skills: { mine: 30000 }, inv: { coin: 50, pick_3: 1, glove_1: 1 }, dur: { pick: 200 } }; S.migrateMineV4(rec); const snap = clone(rec);
    assert.strictEqual(S.migrateMineV4(rec), null, 'ครั้งสอง = ไม่ทำ'); assert.deepStrictEqual(rec, snap, 'รันซ้ำแล้วเรคอร์ดเหมือนเดิม'); S.migrateMineV4(rec); assert.deepStrictEqual(rec, snap); }
  for (const v of [4, 5, 99]) { const rec = { xpv: v, skills: { mine: 30000 }, inv: { coin: 50, pick_3: 1, glove_1: 1 }, dur: { pick: 200 } }, snap = clone(rec); assert.strictEqual(S.migrateMineV4(rec), null); assert.deepStrictEqual(rec, snap, 'xpv ' + v + ' ข้าม'); }
  // เรคอร์ดว่าง/ผิดรูปไม่พัง
  for (const bad of [null, undefined, 0, 'x', [], {}, { xpv: 3 }, { xpv: 3, skills: null }, { xpv: 3, skills: {} }, { xpv: 3, skills: { mine: 'abc' } }, { xpv: 3, inv: null }, { xpv: 3, inv: 'x' }, { xpv: 3, skills: { farm: 5 } }, { xpv: 3, inv: { pick_2: 1 }, dur: null }, { xpv: 3, inv: { pick_2: 1 }, dur: { pick: 'x' } }]) {
    assert.doesNotThrow(() => S.migrateMineV4(bad), 'ไม่ควรพัง: ' + JSON.stringify(bad));
  }
  { const rec = { xpv: 3 }; S.migrateMineV4(rec); assert.strictEqual(rec.xpv, 4, 'เรคอร์ดว่างก็ติดธง xpv 4'); assert.strictEqual(rec.skills, undefined, 'ไม่สร้าง skills ให้'); }
  { const rec = { xpv: 3, skills: { farm: 5 } }; S.migrateMineV4(rec); assert.deepStrictEqual(rec.skills, { farm: 5 }, 'ไม่มี skills.mine ไม่สร้างให้'); }
}

// ---- (ก) โหลดผ่าน server.js: ทุกเวอร์ชันเก่าจบที่ xpv 4 ----
{
  const { World } = require('../server.js');
  const players = {
    old3: { name: 'old3', xpv: 3, mig2: true, skills: { mine: S.XP_TABLE[8] + 1000, farm: 5000 }, inv: { coin: 100, pick_3: 1, glove_2: 1, hammer_1: 1 }, dur: { pick: 200 }, x: 10, y: 10 },
    old2: { name: 'old2', xpv: 2, mig2: true, skills: { mine: 3000 }, inv: { coin: 5, pick_1: 1 }, x: 10, y: 10 },
    v1: { name: 'v1', mig2: true, skills: { mine: 400 }, inv: { coin: 5 }, x: 10, y: 10 },
    new4: { name: 'new4', xpv: 4, mig2: true, skills: { mine: 777 }, inv: { coin: 5, pick_10: 1, glove_1: 1 }, x: 10, y: 10 },
  };
  fs.writeFileSync(path.join(process.env.DATA_DIR, 'minemig.json'), JSON.stringify({ players, farm: {}, layout: 2 }));
  const w = new World('minemig'), sv = w.saved;
  for (const k of Object.keys(players)) assert.strictEqual(sv[k].xpv, 6, k + ' ต้องเป็น xpv 6 หลังโหลด (โซ่ 4 → 5 → 6 ต่อท้าย)');
  const o3 = sv.old3; assert.strictEqual(S.levelOf(o3.skills.mine, 'mine'), 8, 'old3 เลเวลเดิม Lv8'); assert.strictEqual(o3.skills.farm, 5000, 'xpv 3: อาชีพอื่นไม่ถูกแตะ');
  assert.ok(o3.inv.pick_4 === 1 && !o3.inv.pick_3 && !o3.inv.glove_2 && !o3.inv.hammer_1 && o3.inv.coin >= 100 + 1200 + 600, 'old3 (เหรียญ ≥ เดิม + คืนถุงมือ 1,200 + ค้อน 600 ความสำเร็จเหรียญอาจบวกเพิ่ม): pick_3→pick_4 + คืนเงินถุงมือ 1,200 + ค้อน 600');
  assert.ok(o3.dur.pick > 0 && o3.dur.pick <= S.durMax('pick', 4, 0));
  assert.strictEqual(S.levelOf(sv.old2.skills.mine, 'mine'), S.levelOf(S.xpFromV2(3000)), 'old2 (xpv 2) เลเวลเดิม'); assert.ok(sv.old2.inv.pick_1);
  assert.strictEqual(S.levelOf(sv.v1.skills.mine, 'mine'), S.levelOf(S.xpFromV2(S.xpFromV1(400))), 'ไม่มี xpv (v1) เลเวลเดิม');
  assert.deepStrictEqual([sv.new4.skills, sv.new4.inv.pick_10, sv.new4.inv.glove_1, sv.new4.xpv], [{ mine: 777 }, 1, 1, 6], 'xpv 4 อยู่แล้ว: ไม่แปลง XP นักขุด ไม่ลบถุงมือ (ขยับเป็น xpv 6 เท่านั้น)');
  // เซฟแล้วโหลดใหม่ ไม่แปลงซ้ำ
  w.dirty = true; w.save(true); const snap = clone(sv);
  const w2 = new World('minemig'); assert.deepStrictEqual(clone(w2.saved), snap, 'โหลดรอบสอง = ไม่เปลี่ยน (ไม่คืนเงินซ้ำ)');
  // ผู้เล่นใหม่เริ่มที่ xpv 6
  const ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }; const j = w2.join(ws, 'newbie', '#e74c3c'); assert.strictEqual(w2.saved.newbie.xpv, 6);
}

// ---- (ค) เวลา × XP/ชม. ตามเป้า (levelsim): ถึง Lv10 ≈ 4.0 ชม., Lv20 = 20 ชม. ----
{
  const sim = JSON.parse(cp.execFileSync(process.execPath, [path.join(__dirname, 'levelsim.js'), '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 })), rows = sim.mine, EFF = 0.5;
  assert.strictEqual(rows.length, S.MAX_LV);
  let h = 0; const at = {};
  for (let lv = 1; lv < S.MAX_LV; lv++) { h += (S.xpFor(lv + 1, 'mine') - S.xpFor(lv, 'mine')) / (rows[lv - 1].xp * EFF); at[lv + 1] = h; }
  assert.ok(Math.abs(at[10] - 4.0) <= 0.4, 'ถึง Lv10 ≈ 4.0 ชม. ได้ ' + at[10].toFixed(2)); assert.ok(Math.abs(at[20] - 20) <= 1.0, 'ถึง Lv20 ≈ 20 ชม. ได้ ' + at[20].toFixed(2));
  assert.ok(Math.abs(at[15] - 9.5) <= 1.0, 'ถึง Lv15 ≈ 9.5 ชม. ได้ ' + at[15].toFixed(2));
  assert.ok(Math.abs((S.xpFor(2, 'mine') / (rows[0].xp * EFF)) - 0.25) <= 0.03, 'Lv1→2 ≈ 15 นาที');
  // XP/ชม.จริงของชั้น f ≈ 1000 × 1.3^(f−1) (คงที่ 2 เลเวลต่อชั้น) ±10%
  for (let lv = 1; lv <= S.MAX_LV; lv++) { const f = Math.ceil(lv / 2), goal = 1000 * Math.pow(1.3, f - 1), got = rows[lv - 1].xp * EFF; assert.ok(Math.abs(got / goal - 1) <= 0.1, `Lv${lv} ชั้น ${f}: XP/ชม. ${got.toFixed(0)} เป้า ${goal.toFixed(0)}`); }
  // ไม่มีอาชีพอื่นถูกตารางนักขุดทำให้พัง: ชาวนา Lv20 ยังใช้ตารางเดิม ~114 ชม.
  let hf = 0; for (let lv = 1; lv < S.MAX_LV; lv++) hf += (S.XP_TABLE[lv + 1] - S.XP_TABLE[lv]) / (sim.farm[lv - 1].xp * EFF); assert.ok(hf > 90 && hf < 140, 'ชาวนาถึง Lv20 ' + hf.toFixed(0) + ' ชม.');
}

// ---- (ง) บันไดลงทุกชั้น 1–9 มี T.DOWN เดียว เดินถึงได้ ชั้น 10 ไม่มี ----
{
  for (let f = 1; f <= S.MINE.floors; f++) {
    const m = S.makeCaveMap(f), downs = []; m.forEach((r, y) => r.forEach((c, x) => { if (c === T.DOWN) downs.push([x, y]); }));
    assert.strictEqual(downs.length, f < S.MINE.floors ? 1 : 0, `ชั้น ${f}: บันไดลง`);
    if (!downs.length) continue;
    const sol = (x, y) => S.blockedAt(m, (x + 0.5) * TS, (y + 0.5) * TS), sx = Math.floor(S.CAVE.spawn.x / TS), sy = Math.floor(S.CAVE.spawn.y / TS), seen = new Set([sx + ',' + sy]), q = [[sx, sy]];
    while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of S.DIRS) { const k = (x + dx) + ',' + (y + dy); if (seen.has(k) || sol(x + dx, y + dy)) continue; seen.add(k); q.push([x + dx, y + dy]); } }
    assert.ok(seen.has(downs[0].join(',')), `ชั้น ${f}: เดินจากจุดเกิดถึงบันไดลงได้`);
    // ก้อนแร่ที่วางจริงต้องไม่ปิดทางไปบันได
    const spots = S.caveOreSpots(m, f); for (const o of spots) m[o.y][o.x] = T.ORE;
    const seen2 = new Set([sx + ',' + sy]), q2 = [[sx, sy]]; while (q2.length) { const [x, y] = q2.shift(); for (const [dx, dy] of S.DIRS) { const k = (x + dx) + ',' + (y + dy); if (seen2.has(k) || sol(x + dx, y + dy)) continue; seen2.add(k); q2.push([x + dx, y + dy]); } }
    assert.ok(seen2.has(downs[0].join(',')), `ชั้น ${f}: มีก้อนแร่แล้วยังเดินถึงบันได`);
  }
}

// ---- (จ) ดาวความชำนาญของนักขุดใช้ masteryXp ----
{
  assert.strictEqual(S.masteryXp('mine'), S.MASTERY.xpPerSkill.mine); assert.ok(S.masteryXp('mine') < S.MASTERY.xpPer, 'หลอดนักขุดเล็กกว่า จึงดาวละน้อยกว่า');
  for (const sk of ['farm', 'animal', 'wood', 'cook']) assert.strictEqual(S.masteryXp(sk), S.MASTERY.xpPer, sk + ' ดาวละ 25,000'); assert.strictEqual(S.masteryXp('fish'), 8000, 'fish ดาวละ 8,000 (ชาวประมงตั้งใจ)');
  const { World } = require('../server.js'), w = new World('minestar'), ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }, p = w.join(ws, 'starry', '#e74c3c').p;
  const need = (sk, n) => S.xpFor(S.MAX_LV, sk) + n * S.masteryXp(sk), stars = () => (p.rec.stars && p.rec.stars.mine) || 0;
  p.rec.inv.coin = 1e6;
  p.rec.skills.mine = need('mine', 1) - 1; w.handle(p, { t: 'star', skill: 'mine' }); assert.strictEqual(stars(), 0, 'ขาด 1 XP ยังไม่ได้ดาว');
  p.rec.skills.mine = need('mine', 1); w.handle(p, { t: 'star', skill: 'mine' }); assert.strictEqual(stars(), 1, 'XP = ตารางนักขุด Lv20 + 1 × masteryXp ได้ดาว 1');
  assert.ok(need('mine', 1) < S.xpFor(S.MAX_LV) + S.MASTERY.xpPer, 'เกณฑ์ดาวของนักขุดไม่ใช้ตาราง/ดาวละ 25,000 ของอาชีพอื่น');
  p.rec.skills.mine = need('mine', 2) - 1; w.handle(p, { t: 'star', skill: 'mine' }); assert.strictEqual(stars(), 1); p.rec.skills.mine = need('mine', 2); w.handle(p, { t: 'star', skill: 'mine' }); assert.strictEqual(stars(), 2);
  p.rec.skills.farm = need('farm', 1) - 1; w.handle(p, { t: 'star', skill: 'farm' }); assert.ok(!(p.rec.stars && p.rec.stars.farm), 'ชาวนาใช้เกณฑ์เดิม (XP_TABLE Lv20 + 25,000)');
  p.rec.skills.farm = need('farm', 1); w.handle(p, { t: 'star', skill: 'farm' }); assert.strictEqual(p.rec.stars.farm, 1);
}

// playLevel ต้องใช้ตารางหลอดรายอาชีพ: นักขุดแร่ Lv20 (XP_TABLE_MINE) ต้องนับเป็น Lv20 ไม่ใช่เลเวลต่ำจากตารางเดิม
{ const S2 = require('../public/shared.js'), all = Object.keys(S2.SKILLS), base = {}; for (const k of all) base[k] = 0;
  const lo = S2.playLevel(base), hi = S2.playLevel(Object.assign({}, base, { mine: S2.XP_TABLE_MINE[20] }));
  assert.strictEqual(hi - lo, S2.MAX_LV - 1, 'playLevel ต้องนับนักขุดแร่ด้วยตารางของตัวเอง'); }

console.log('ผ่าน test-mine-migrate'); process.exit(0);
