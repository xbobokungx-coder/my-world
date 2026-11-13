// ทดสอบย้ายเซฟ xpv 6 → 7 (WP-20 หลอด XP มาตรฐานชาวนา/คนเลี้ยงสัตว์/ช่างไม้/เชฟ): เลเวลไม่ตก สัดส่วนคงที่ ส่วนเกินตามดาว idempotent โซ่ xpv 3→7
// ใช้เรคอร์ดสังเคราะห์ใน DATA_DIR ชั่วคราวเท่านั้น (ไม่แตะ data/ จริง): node tools/test-xp-migrate.js
const fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process');
const dataDir = process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-xpmig-');
const S = require('../public/shared.js'), clone = o => JSON.parse(JSON.stringify(o));
const SK = ['farm', 'animal', 'wood', 'cook'];
assert.deepStrictEqual(S.STD_V7_SKILLS, SK);

// ---- (ก) ทุกเลเวล 1–19 × สัดส่วน ----
for (const sk of SK) {
  for (let L = 1; L < S.MAX_LV; L++) for (const f of [0, 0.1, 0.25, 0.5, 0.75, 0.99]) {
    const old = Math.floor(S.XP_TABLE[L] + f * (S.XP_TABLE[L + 1] - S.XP_TABLE[L])), rec = { xpv: 6, skills: { [sk]: old }, inv: { coin: 77 } };
    assert.strictEqual(S.levelOf(old), L); assert.strictEqual(S.migrateStdV7(rec), true); const nw = rec.skills[sk];
    assert.strictEqual(S.levelOf(nw, sk), L, `${sk} Lv${L} f=${f}: เลเวลไม่ตก (${old} → ${nw})`);
    const fo = (old - S.XP_TABLE[L]) / (S.XP_TABLE[L + 1] - S.XP_TABLE[L]), fn = (nw - S.XP_TABLE_STD[L]) / (S.XP_TABLE_STD[L + 1] - S.XP_TABLE_STD[L]);
    assert.ok(Math.abs(fo - fn) < 0.012, `${sk} Lv${L} f=${f}: สัดส่วน ${fo.toFixed(3)} → ${fn.toFixed(3)}`);
    if (f === 0) assert.strictEqual(nw, S.XP_TABLE_STD[L], 'ต้นเลเวลตรงเป๊ะ');
    assert.strictEqual(rec.xpv, 7); assert.strictEqual(rec.inv.coin, 77, 'ไม่แตะเหรียญ');
  }
  // ---- (ข) Lv20 และส่วนเกิน: ตามสัดส่วนดาว ----
  const m = S.masteryXp(sk); assert.strictEqual(m, 8000);
  for (const extra of [0, 1, 5000, 25000, 50000, 125000, 400000]) {
    const rec = { xpv: 6, skills: { [sk]: S.XP_TABLE[20] + extra } }; S.migrateStdV7(rec); const nw = rec.skills[sk];
    assert.strictEqual(S.levelOf(nw, sk), 20); assert.ok(Math.abs((nw - S.XP_TABLE_STD[20]) / m - extra / S.MASTERY.xpPer) < 1 / m + 1e-9, `${sk} ส่วนเกิน ${extra}`);
  }
  // ดาวที่ซื้อแล้ว: n ดาวเดิม (ขั้นต่ำ XP) ต้องยังมี XP พอสำหรับดาว n ในเกณฑ์ใหม่ และ rec.stars ไม่ถูกแตะ
  for (let n = 1; n <= S.MASTERY.max; n++) {
    const rec = { xpv: 6, stars: { [sk]: n }, skills: { [sk]: S.XP_TABLE[20] + n * S.MASTERY.xpPer } }; S.migrateStdV7(rec);
    assert.ok(rec.skills[sk] >= S.xpFor(S.MAX_LV, sk) + n * m, `${sk} ดาว ${n} ไม่ตกเกณฑ์`); assert.deepStrictEqual(rec.stars, { [sk]: n });
  }
  // เก็บแบบ monotone
  let prev = -1; for (let xp = 0; xp <= 900000; xp += 997) { const r = { xpv: 6, skills: { [sk]: xp } }; S.migrateStdV7(r); assert.ok(r.skills[sk] >= prev, 'ไม่ถอยหลัง ' + xp); prev = r.skills[sk]; }
  // ย้อนกลับ: เลเวลเท่าเดิม ถอยแล้วย้ายใหม่ไม่ต่างเกินเศษ
  for (const xp of [0, 100, 700, 5000, 20150, 100000, 613650, 700000, 900000]) {
    const r = { xpv: 6, skills: { [sk]: xp } }; S.migrateStdV7(r); const mid = r.skills[sk]; assert.strictEqual(S.unmigrateStdV7(r), true); assert.strictEqual(r.xpv, 6);
    assert.strictEqual(S.levelOf(r.skills[sk]), S.levelOf(xp), `${sk} ถอยกลับเลเวลเท่าเดิม xp=${xp}`);
    S.migrateStdV7(r); assert.ok(Math.abs(r.skills[sk] - mid) <= 2, 'ถอยแล้วย้ายซ้ำคลาดไม่เกินเศษ');
  }
}

// ---- (ค) เรคอร์ด: อาชีพอื่นไม่แตะ, idempotent, xpv >= 7 ข้าม, ผิดรูปไม่พัง ----
{
  const rec = { xpv: 6, skills: { farm: 20150, fish: 700, mine: 900, animal: 7600, wood: 0, cook: 2000 }, inv: { coin: 5 }, stars: { fish: 2 }, ach: { got: { a: 1 } } }, before = clone(rec);
  S.migrateStdV7(rec); assert.strictEqual(rec.skills.fish, 700); assert.strictEqual(rec.skills.mine, 900); assert.strictEqual(rec.skills.farm, S.XP_TABLE_STD[7]); assert.strictEqual(rec.skills.wood, 0);
  assert.deepStrictEqual(rec.inv, before.inv); assert.deepStrictEqual(rec.stars, before.stars); assert.deepStrictEqual(rec.ach, before.ach);
  const snap = clone(rec); assert.strictEqual(S.migrateStdV7(rec), false); assert.deepStrictEqual(rec, snap, 'ครั้งสอง = ไม่เปลี่ยน');
  for (const v of [7, 8, 99]) { const r = { xpv: v, skills: { farm: 30000 } }, s0 = clone(r); assert.strictEqual(S.migrateStdV7(r), false); assert.deepStrictEqual(r, s0); }
  for (const bad of [null, undefined, 0, 'x', [], {}, { xpv: 6 }, { xpv: 6, skills: null }, { xpv: 6, skills: 'x' }, { xpv: 6, skills: { farm: 'abc', animal: null, wood: NaN, cook: Infinity } }, { xpv: 6, skills: { farm: -50 } }]) {
    assert.doesNotThrow(() => S.migrateStdV7(bad), JSON.stringify(bad)); assert.strictEqual(S.unmigrateStdV7(null), false);
  }
  { const r = { xpv: 6, skills: { farm: -50 } }; S.migrateStdV7(r); assert.strictEqual(r.skills.farm, 0, 'ติดลบ → 0'); }
  { const r = { xpv: 6, skills: { farm: 'abc', wood: NaN } }; S.migrateStdV7(r); assert.strictEqual(r.skills.farm, 'abc', 'ไม่ใช่ตัวเลข ไม่แตะ'); assert.strictEqual(r.xpv, 7); }
}

// ---- (ง) โหลดผ่าน World: โซ่ xpv 3→7 / 4 / 5 / 6 / 7 ----
const { World } = require('../server.js');
{
  const ACH0 = () => ({ cnt: {}, got: Object.fromEntries(S.ACH.map(d => [d.id, 1])) });
  const mk = (xpv, sk, extra) => Object.assign({ name: 'x', xpv, mig2: true, ach: ACH0(), skills: sk, inv: { coin: 1234 }, x: 10, y: 10 }, extra || {});
  const players = {
    p3: mk(3, { farm: 7600, animal: 2000, wood: 4350, cook: 20150, fish: 7600 }), p4: mk(4, { farm: 7600, fish: 800 }), p5: mk(5, { farm: 7600, wood: 613650 + 125000 }), p6: mk(6, { farm: 7600 }, { stars: { farm: 2 } }),
    p7: mk(7, { farm: 7600 }), p1: mk(2, { farm: 7600 }), bare: mk(6, {}), nos: { name: 'nos', xpv: 6, mig2: true, ach: ACH0(), inv: { coin: 9 }, x: 10, y: 10 },
  };
  fs.writeFileSync(path.join(dataDir, 'xpmig.json'), JSON.stringify({ players: clone(players), farm: {}, layout: 2 }));
  const w = new World('xpmig'), sv = w.saved;
  for (const k of Object.keys(players)) { assert.strictEqual(sv[k].xpv, 8, k + ' xpv 8'); assert.strictEqual(sv[k].inv.coin, k === 'nos' ? 9 : 1234, k + ' เหรียญไม่เปลี่ยน (ไม่คืน/ไม่หัก)'); }
  assert.strictEqual(sv.p7.skills.farm, 7600, 'xpv 7 ไม่ถูกแตะ'); assert.strictEqual(S.levelOf(sv.p6.skills.farm, 'farm'), S.levelOf(7600), 'p6 เลเวลเท่าเดิม'); assert.deepStrictEqual(sv.p6.stars, { farm: 2 });
  assert.strictEqual(S.levelOf(sv.p3.skills.farm, 'farm'), S.levelOf(7600), 'p3 โซ่ยาว เลเวลเท่าเดิม'); // xpv3 อยู่บน XP_TABLE แล้ว
  assert.strictEqual(sv.p3.skills.farm, S.xpStdV5(7600, 'farm')); assert.strictEqual(S.levelOf(sv.p3.skills.cook, 'cook'), S.levelOf(20150)); assert.strictEqual(S.levelOf(sv.p5.skills.wood, 'wood'), 20);
  assert.strictEqual(sv.p1.skills.farm, S.xpStdV5(S.xpFromV2(7600), 'farm'), 'xpv 2: ผ่าน V2→V3 ก่อนแล้วค่อย V7');
  assert.strictEqual(sv.p4.skills.fish, S.xpStdV5(800, 'fish'), 'xpv 4: ปลาย้าย V5 ครั้งเดียว'); assert.strictEqual(sv.p3.skills.fish, S.xpStdV5(7600, 'fish'), 'ปลาไม่ถูกแปลงซ้ำใน V7');
  // เซฟแล้วโหลดซ้ำไม่เปลี่ยน
  w.dirty = true; w.save(true); const snap = clone(sv); assert.deepStrictEqual(clone(new World('xpmig').saved), snap, 'โหลดซ้ำไม่เปลี่ยน');
  // ผู้เล่นใหม่ = xpv 7
  const ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }; const j = w.join(ws, 'newbie', '#e74c3c'); assert.strictEqual(j.p.rec.xpv, 8, 'ผู้เล่นใหม่ xpv 7');
}

// ---- (จ) tools-unmigrate กับสำเนาชั่วคราว ----
{
  const orig = {}, migd = {}; [0, 150, 700, 5000, 20150, 126900, 613650, 700000].forEach((xp, i) => { const rec = { name: 'u' + i, xpv: 6, skills: { farm: xp, animal: xp, wood: xp, cook: xp, fish: 55 }, inv: { coin: 5 } }; orig['u' + i] = clone(rec); S.migrateStdV7(rec); migd['u' + i] = rec; });
  const file = path.join(dataDir, 'unm.json'); fs.writeFileSync(file, JSON.stringify({ players: migd, farm: {}, layout: 2 }));
  const env = Object.assign({}, process.env, { DATA_DIR: dataDir }), run = a => cp.execFileSync(process.execPath, [path.join(__dirname, 'tools-unmigrate.js'), ...a], { encoding: 'utf8', env });
  const out = run([file, '--to=6']); assert.ok(/ถอยกลับ 8 บัญชี/.test(out), out); assert.ok(fs.existsSync(file + '.pre-unmig'));
  const back = JSON.parse(fs.readFileSync(file, 'utf8')).players;
  for (const k of Object.keys(orig)) { assert.strictEqual(back[k].xpv, 6); for (const sk of SK) { assert.strictEqual(S.levelOf(back[k].skills[sk]), S.levelOf(orig[k].skills[sk]), k + sk + ' เลเวลเท่าเดิม'); assert.ok(Math.abs(back[k].skills[sk] - orig[k].skills[sk]) <= 60, k + ' คลาดเล็กน้อย'); } assert.strictEqual(back[k].skills.fish, 55); assert.strictEqual(back[k].inv.coin, 5); }
  assert.ok(/ไม่มีบัญชี xpv 7/.test(run([file, '--to=6'])), 'รันซ้ำไม่ทำอะไร');
}
console.log('test-xp-migrate: ผ่านทั้งหมด');
