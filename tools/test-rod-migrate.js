// ทดสอบคันเบ็ด 10 ระดับ (WP-11, 13 พ.ย. 2026): ตัวย้ายเซฟ xpv 5 → 6 (ตารางทางเลือก B ไม่มีใครเสียสิทธิ์) • unmigrate • rodHit/fishTier • การสึกคันที่ startFight
// ใช้เรคอร์ดสังเคราะห์ใน DATA_DIR ชั่วคราวเท่านั้น (ไม่แตะ data/ จริง): node tools/test-rod-migrate.js
const fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process'), os = require('os');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-rodmig-');
const S = require('../public/shared.js'), TS = S.TS, MIG = S.ROD_MIG6, REPAIR = S.REPAIR;
const clone = o => JSON.parse(JSON.stringify(o));
const EXPECT_MAP = { 1: 1, 2: 2, 3: 4, 4: 6, 5: 8, 6: 9, 7: 10 }, OLD_MAX = [0, 200, 370, 850, 1360, 2860, 5030, 5580];
// กติกาตกปลาเดิม (ก่อน xpv 6): ความสามารถของคันระดับ r ต่อปลาแต่ละตัว — ใช้ยืนยันว่าไม่มีใครตกปลาที่เคยตกได้แล้วตกไม่ได้
const OLD_MAXCLASS = [0, 1, 2, 3, 3, 3, 3, 3], oldFishRod = lv => (lv >= 19 ? 7 : lv >= 16 ? 6 : lv >= 13 ? 5 : lv >= 11 ? 4 : 0);
const subsets = [[]]; for (let m = 1; m < 64; m++) { const s = []; for (let t = 2; t <= 7; t++) if (m & (1 << (t - 2))) s.push(t); subsets.push(s); } // รวมชุดว่าง = ถือแต่คัน 1 ที่แจกฟรี
const invOf = (held, coin = 777) => { const o = { coin, lamp: 1, stone: 7 }; for (const t of held) o['rod_' + t] = 1; return o; };
const topOf = held => (held.length ? held[held.length - 1] : 1);
const oldMaxOf = (t, fx) => Math.floor(OLD_MAX[t] * (1 - REPAIR.decay * Math.min(REPAIR.maxFixes, fx)));
const durClose = (nw, nm, before, om, msg) => assert.ok(Math.abs(nw / nm - before / om) <= 1 / nm + 1 / om, `${msg}: ${before}/${om} → ${nw}/${nm}`);
const catchable = (f, rod) => S.fishWeight(f, 20, rod, 1) > 0, oldCatchable = (f, r) => S.fishClass(f) <= OLD_MAXCLASS[r] && r >= oldFishRod(f.lv);

// ---- (ก) ตารางและตัวเลขตามตั๋ว ----
{
  assert.deepStrictEqual(MIG.map, EXPECT_MAP, 'ตารางแปลงคันเป็นทางเลือก B {1,2,4,6,8,9,10}'); assert.deepStrictEqual(MIG.oldMax, OLD_MAX);
  assert.strictEqual(S.ROD_MAX, 10); assert.strictEqual(Object.keys(S.RODS).length, 10);
  for (let t = 1; t <= 7; t++) assert.ok(MIG.map[t] >= t, 'ระดับใหม่ไม่ต่ำกว่าเดิม ' + t);
  for (let t = 2; t <= 7; t++) assert.ok(MIG.map[t] > MIG.map[t - 1]);
  assert.deepStrictEqual(S.DURABILITY.rod.max, [0, 160, 330, 560, 820, 1100, 1400, 1750, 2100, 2500, 2900]);
  for (let t = 2; t <= 10; t++) assert.strictEqual(S.TOOL_PRICE.rod[t], S.RODS[t].price);
  assert.deepStrictEqual(S.ROD_MAXCLASS, [0, 1, 2, 2, 3, 3, 3, 3, 3, 3, 3]); assert.strictEqual(S.rodTier({}), 1, 'ไม่มีคันที่ซื้อ = คัน 1 แจกฟรี');
  assert.strictEqual(S.RODS[1].price, undefined, 'คัน 1 แจกฟรี');
  for (const f of S.FISH) { assert.strictEqual(S.fishTier(f), Math.ceil(f.lv / 2), f.id + ' ระดับปลา'); if (f.lv >= 11) assert.strictEqual(f.rod, S.fishTier(f), f.id + ' ฟิลด์ rod = ⌈Lv÷2⌉'); else assert.ok(!f.rod, f.id + ' Lv ≤ 10 ไม่ติดด่านแข็ง'); }
  assert.strictEqual(S.fishTier(null), 1); assert.strictEqual(S.fishTier({}), 1);
}

// ---- (ข) ไม่มีใครเสียสิทธิ์: ทุกชุดที่ถือได้ ตกปลาที่เคยตกได้แล้วยังตกได้ ----
{
  for (const r of [1, 2, 3, 4, 5, 6, 7]) for (const f of S.FISH) if (oldCatchable(f, r)) assert.ok(catchable(f, EXPECT_MAP[r]), `คันเดิม ${r} → ${EXPECT_MAP[r]} เคยตก ${f.id} (Lv${f.lv}) ได้ ต้องยังตกได้`);
  for (const held of subsets) {
    const rec = { xpv: 5, inv: invOf(held) }; S.migrateToolsV6(rec); const top = topOf(held);
    assert.strictEqual(S.rodTier(rec.inv), EXPECT_MAP[top], `ถือ [${held}] ระดับใช้งานหลังย้าย`); assert.ok(S.rodTier(rec.inv) >= top);
    for (const f of S.FISH) if (oldCatchable(f, top)) assert.ok(catchable(f, S.rodTier(rec.inv)), `ถือ [${held}] เคยตก ${f.id} ได้ ต้องยังตกได้`);
  }
}

// ---- (ค) ย้ายทุกระดับเดิม (1–7) × ซ่อม 0/2/3 × ความทนเต็ม/ครึ่ง/0.2/0 ----
{
  for (let t = 1; t <= 7; t++) for (const fx of [0, 2, 3]) for (const f of [1, 0.5, 0.2, 0]) {
    const om = oldMaxOf(t, fx), before = Math.round(om * f), held = t === 1 ? [] : [t], nu = EXPECT_MAP[t];
    const rec = { xpv: 5, inv: invOf(held), dur: { rod: before, pick: 33 }, fix: { rod: fx, pick: 1 } }, fixBefore = clone(rec.fix);
    const r = S.migrateToolsV6(rec), nm = S.durMax('rod', nu, fx);
    assert.deepStrictEqual(r.rod, [t, nu]); assert.strictEqual(rec.xpv, 6); assert.strictEqual(rec.inv.coin, 777, 'เหรียญไม่เปลี่ยน'); assert.deepStrictEqual(rec.fix, fixBefore, 'rec.fix คงเดิม');
    assert.strictEqual(rec.dur.pick, 33, 'ความทนของเครื่องมืออื่นไม่แตะ'); assert.strictEqual(rec.inv.lamp, 1); assert.strictEqual(rec.inv.stone, 7);
    if (before === 0) assert.strictEqual(rec.dur.rod, 0, 'พังยังพัง'); else { assert.ok(rec.dur.rod >= 1); durClose(rec.dur.rod, nm, before, om, `rod_${t} f=${f} fix=${fx}`); }
    assert.ok(rec.dur.rod >= 0 && rec.dur.rod <= nm); if (f === 1) assert.strictEqual(rec.dur.rod, nm, 'เต็มยังเต็ม');
    assert.strictEqual(S.rodTier(rec.inv), nu);
    if (t > 1) { assert.strictEqual(rec.inv['rod_' + nu] >= 1, true, 'ได้คีย์ใหม่'); assert.ok(rec.inv['rod_' + t] >= 1, 'คีย์เดิมไม่ถูกลบ'); }
    if (nu === t) assert.ok(!rec.tmig || (!rec.tmig.add.length && !Object.keys(rec.tmig.left).length), 'ระดับที่ไม่เปลี่ยนไม่มีของค้าง');
    else { assert.deepStrictEqual(rec.tmig.add, ['rod_' + nu]); assert.deepStrictEqual(rec.tmig.left, { ['rod_' + t]: 1 }); }
    assert.strictEqual(rec.tmig.dur.rod, before);
  }
  { const rec = { xpv: 5, inv: invOf([3]), dur: { rod: 99999 } }; S.migrateToolsV6(rec); assert.strictEqual(rec.dur.rod, S.durMax('rod', 4, 0)); }
  { const rec = { xpv: 5, inv: invOf([3]), dur: { rod: -50 } }; S.migrateToolsV6(rec); assert.strictEqual(rec.dur.rod, 0); }
  { const rec = { xpv: 5, inv: invOf([3]), dur: { rod: 'x' } }; S.migrateToolsV6(rec); assert.strictEqual(rec.dur.rod, 'x', 'dur ไม่ใช่ตัวเลข ไม่แตะ'); }
  { const rec = { xpv: 5, dur: { rod: 100 } }; S.migrateToolsV6(rec); assert.strictEqual(rec.dur.rod, 80, 'ไม่มี inv: ถือเป็นคัน 1 คงสัดส่วน 100/200 → 80/160'); }
  { const rec = { xpv: 5, inv: invOf([4]), dur: { rod: oldMaxOf(4, 3) }, fix: { rod: 9 } }; S.migrateToolsV6(rec); assert.ok(rec.dur.rod >= 1 && rec.dur.rod <= S.durMax('rod', 6, 9), 'fix เกินเพดานตัดที่ 3'); }
  // คีย์ชน: rod_5/rod_6 เดิม (→ 8/9) เป็นคีย์ที่ระดับใหม่ 5/6 ใช้ความหมายใหม่ ต้องไม่ถูกอ่านเป็นคัน 5/6 ใหม่หลังย้าย
  for (const t of [5, 6]) { const rec = { xpv: 5, inv: invOf([t]) }; S.migrateToolsV6(rec); assert.strictEqual(S.rodTier(rec.inv), EXPECT_MAP[t], `rod_${t} เดิม ไม่ใช่คัน ${t} ใหม่`); assert.ok(S.tmigLocked(rec, 'rod_' + t) > 0, `rod_${t} เดิมเป็นของค้าง ล็อกขายคืน`); }
}

// ---- (ง) ถือหลายระดับ ทุกชุดย่อย (63 ชุด + ไม่มีเลย) × ความทน ----
{
  for (const held of subsets) for (const f of [1, 0.5, 0]) for (const fx of [0, 3]) {
    const top = topOf(held), om = oldMaxOf(top, fx), before = Math.round(om * f), rec = { xpv: 5, inv: invOf(held, 4321), dur: { rod: before }, fix: { rod: fx } }, orig = clone(rec);
    S.migrateToolsV6(rec);
    const N = new Set(held.map(t => EXPECT_MAP[t])), keep = Object.keys(rec.inv).filter(k => /^rod_/.test(k)).map(k => +k.slice(4)).sort((a, b) => a - b);
    assert.strictEqual(rec.inv.coin, 4321, 'เหรียญไม่เปลี่ยน');
    for (const t of held) assert.ok(rec.inv['rod_' + t] >= 1, `[${held}] rod_${t} ยังอยู่`);
    for (const n of N) assert.ok(rec.inv['rod_' + n] >= 1, `[${held}] มี rod_${n}`);
    assert.deepStrictEqual(keep, [...new Set([...held, ...N])].sort((a, b) => a - b), 'คีย์คันหลังย้าย = เดิม ∪ ชุดใหม่');
    const add = [...N].filter(n => !held.includes(n)).map(n => 'rod_' + n).sort(), left = held.filter(t => !N.has(t)).map(t => 'rod_' + t).sort();
    assert.deepStrictEqual((rec.tmig ? rec.tmig.add : []).slice().sort(), add, `[${held}] tmig.add`); assert.deepStrictEqual(Object.keys(rec.tmig ? rec.tmig.left : {}).sort(), left, `[${held}] tmig.left`);
    const nm = S.durMax('rod', EXPECT_MAP[top], fx); if (before === 0) assert.strictEqual(rec.dur.rod, 0); else durClose(rec.dur.rod, nm, before, om, `[${held}] f=${f} fix=${fx}`);
    assert.deepStrictEqual(rec.fix, orig.fix); assert.ok(rec.dur.rod <= S.durMax('rod', S.rodTier(rec.inv), fx));
  }
  { const rec = { xpv: 5, inv: { coin: 1, rod_4: 2 } }; S.migrateToolsV6(rec); assert.strictEqual(rec.tmig.left.rod_4, 2); assert.strictEqual(S.tmigLocked(rec, 'rod_4'), 2); assert.strictEqual(S.tmigLocked(rec, 'rod_6'), 1); }
  // ถือ rod_3 และ rod_4: rod_4 คือเป้าของ rod_3 อยู่แล้ว (ไม่เพิ่มซ้ำ ไม่ล็อกชิ้นที่ซื้อมาเอง) และ rod_3 ค้าง
  { const rec = { xpv: 5, inv: invOf([3, 4]) }; S.migrateToolsV6(rec); assert.deepStrictEqual(rec.tmig.add, ['rod_6']); assert.deepStrictEqual(rec.tmig.left, { rod_3: 1 }); assert.strictEqual(S.tmigLocked(rec, 'rod_4'), 0); }
}

// ---- (จ) idempotent • xpv >= 6 ข้าม • เรคอร์ดผิดรูปไม่พัง ----
{
  for (const held of subsets) { const rec = { xpv: 5, inv: invOf(held), dur: { rod: 30 }, fix: { rod: 2 } }; S.migrateToolsV6(rec); const snap = clone(rec); assert.strictEqual(S.migrateToolsV6(rec), null); assert.deepStrictEqual(rec, snap, 'รันซ้ำเหมือนเดิม'); S.migrateToolsV6(rec); assert.deepStrictEqual(rec, snap); }
  for (const v of [6, 7, 99]) { const rec = { xpv: v, inv: invOf([3]), dur: { rod: 30 } }, snap = clone(rec); assert.strictEqual(S.migrateToolsV6(rec), null); assert.deepStrictEqual(rec, snap, 'xpv ' + v + ' ข้าม'); }
  for (const bad of [null, undefined, 0, 'x', [], {}, { xpv: 5 }, { xpv: 5, inv: null }, { xpv: 5, inv: 'x' }, { xpv: 5, inv: [] }, { xpv: 5, inv: { rod_3: 'x' } }, { xpv: 5, inv: { rod_3: -1 } }, { xpv: 5, inv: { rod_3: 0 } }, { xpv: 5, inv: { rod_3: NaN } },
    { xpv: 5, inv: { rod_3: 1 }, dur: null }, { xpv: 5, inv: { rod_3: 1 }, dur: 'x' }, { xpv: 5, inv: { rod_3: 1 }, dur: { rod: null } }, { xpv: 5, inv: { rod_3: 1 }, dur: { rod: 5 }, fix: null }, { xpv: 5, inv: { rod_3: 1 }, dur: { rod: 5 }, fix: { rod: 'z' } }, { xpv: 5, inv: { rod_3: 1 }, tmig: 'x' }, { xpv: 'abc', inv: { rod_3: 1 } }]) {
    assert.doesNotThrow(() => S.migrateToolsV6(bad), 'ไม่ควรพัง: ' + JSON.stringify(bad));
  }
  { const rec = { xpv: 5 }; const r = S.migrateToolsV6(rec); assert.strictEqual(rec.xpv, 6); assert.strictEqual(rec.inv, undefined, 'ไม่สร้าง inv ให้'); assert.deepStrictEqual(r.rod, [1, 1]); assert.strictEqual(rec.tmig, undefined); }
  { const rec = { xpv: 5, inv: { coin: 9 } }; S.migrateToolsV6(rec); assert.deepStrictEqual(rec.inv, { coin: 9 }, 'ไม่มีคันที่ซื้อ ไม่เพิ่มคีย์'); }
  { const rec = { xpv: 5, inv: { rod_3: 0 } }; S.migrateToolsV6(rec); assert.deepStrictEqual(rec.inv, { rod_3: 0 }); }
}

// ---- (ฉ) unmigrate คืนสภาพเดิมเป๊ะ ----
{
  for (const held of subsets) for (const f of [1, 0.5, 0]) for (const fx of [0, 2, 3]) {
    const top = topOf(held), om = oldMaxOf(top, fx), rec = { xpv: 5, skills: { fish: 99 }, inv: invOf(held), dur: { rod: Math.round(om * f), pick: 40 }, fix: { rod: fx } }, orig = clone(rec);
    S.migrateToolsV6(rec); assert.strictEqual(S.unmigrateToolsV6(rec), true); assert.deepStrictEqual(rec, orig, `[${held}] f=${f} fix=${fx} unmigrate คืนเป๊ะ`); assert.strictEqual(S.unmigrateToolsV6(rec), false);
  }
  { const rec = { xpv: 5, inv: { coin: 5 } }, orig = clone(rec); S.migrateToolsV6(rec); S.unmigrateToolsV6(rec); assert.deepStrictEqual(rec, orig); }
  { const rec = { xpv: 5 }; S.migrateToolsV6(rec); assert.strictEqual(S.unmigrateToolsV6(rec), true); assert.deepStrictEqual(rec, { xpv: 5 }); }
  // เล่นต่อแล้วถอย: คันที่ระบบเพิ่มถูกลบ ความทนไม่เกินสูงสุดเดิมของระดับเดิม
  for (let t = 1; t <= 7; t++) for (const fx of [0, 3]) {
    const om = oldMaxOf(t, fx), rec = { xpv: 5, inv: invOf(t === 1 ? [] : [t]), dur: { rod: om }, fix: { rod: fx } }; S.migrateToolsV6(rec); rec.dur.rod = Math.max(0, rec.dur.rod - 17);
    assert.strictEqual(S.unmigrateToolsV6(rec), true); assert.strictEqual(rec.xpv, 5); assert.strictEqual(S.rodTier(rec.inv), t, 'ถอยแล้วคันเดิม'); assert.ok(rec.dur.rod >= 0 && rec.dur.rod <= om, `ถอย rod_${t}: dur ${rec.dur.rod} ต้อง ≤ ${om}`); assert.strictEqual(rec.tmig, undefined);
  }
  { const rec = { xpv: 5, inv: invOf([3]) }; S.migrateToolsV6(rec); rec.inv.rod_9 = 1; S.unmigrateToolsV6(rec); assert.strictEqual(rec.inv.rod_9, 1, 'ของที่ซื้อเองอยู่'); assert.ok(!rec.inv.rod_4); assert.strictEqual(rec.inv.rod_3, 1); }
  for (const bad of [{ xpv: 6 }, { xpv: 6, tmig: 'x' }, { xpv: 6, tmig: { add: 'x', left: null, dur: 5 }, inv: { rod_3: 1 } }, { xpv: 6, tmig: { add: [3, {}, 'rod_zzz', 'coin'], old: { rod: 99 }, dur: { rod: 'x' } }, inv: { coin: 5 }, dur: { rod: 4 } }])
    assert.doesNotThrow(() => S.unmigrateToolsV6(clone(bad)), 'ถอยเรคอร์ดผิดรูปไม่พัง ' + JSON.stringify(bad));
}

// ---- (ช) สคริปต์ tools/tools-unmigrate.js กับสำเนาชั่วคราวเท่านั้น ----
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-rodunm-')); process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} });
  const origPlayers = {}, migPlayers = {};
  subsets.forEach((held, i) => { const rec = { name: 'u' + i, xpv: 5, inv: invOf(held, 100 + i), dur: { rod: Math.round(oldMaxOf(topOf(held), 2) / 2) }, fix: { rod: 2 } }; origPlayers['u' + i] = clone(rec); S.migrateToolsV6(rec); migPlayers['u' + i] = rec; });
  const file = path.join(dir, 'room.json'); fs.writeFileSync(file, JSON.stringify({ players: migPlayers, farm: {}, layout: 2 }));
  const out = cp.execFileSync(process.execPath, [path.join(__dirname, 'tools-unmigrate.js'), file], { encoding: 'utf8', env: Object.assign({}, process.env, { DATA_DIR: dir }) });
  assert.ok(/ถอยกลับ 64 บัญชี/.test(out), out); assert.ok(fs.existsSync(file + '.pre-unmig'));
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).players, origPlayers, 'สคริปต์ถอยกลับคืนเดิมทั้งไฟล์');
}

// ---- (ซ) โหลดผ่าน World: โซ่จบที่ xpv 6 • เหรียญไม่เปลี่ยน • เซฟ-โหลดซ้ำไม่เปลี่ยน • tmig ไม่หลุด client • sellback ล็อก ----
const { World } = require('../server.js'), leaks = []; // ข้อผิดพลาดที่รวบไว้ตรวจท้ายไฟล์
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
{
  const ACH0 = () => ({ cnt: {}, got: Object.fromEntries(S.ACH.map(d => [d.id, 1])) });
  const players = {
    r3: { name: 'r3', xpv: 5, mig2: true, ach: ACH0(), skills: { fish: 5000 }, inv: { coin: 5000, rod_3: 1 }, dur: { rod: 425 }, fix: { rod: 1 }, x: 10, y: 10 },
    r7: { name: 'r7', xpv: 5, mig2: true, ach: ACH0(), skills: { fish: 5000 }, inv: { coin: 123, rod_2: 1, rod_5: 1, rod_7: 1 }, dur: { rod: 5580 }, x: 10, y: 10 },
    r2: { name: 'r2', xpv: 5, mig2: true, ach: ACH0(), skills: { fish: 5000 }, inv: { coin: 321, rod_2: 1 }, x: 10, y: 10 },
    old4: { name: 'old4', xpv: 4, mig2: true, ach: ACH0(), skills: { fish: 700 }, inv: { coin: 99, rod_3: 1 }, dur: { rod: 200 }, x: 10, y: 10 },
    old3: { name: 'old3', xpv: 3, mig2: true, ach: ACH0(), skills: { fish: 700 }, inv: { coin: 99, rod_2: 1 }, x: 10, y: 10 },
    new6: { name: 'new6', xpv: 6, mig2: true, ach: ACH0(), skills: { fish: 5 }, inv: { coin: 55, rod_10: 1 }, dur: { rod: 7 }, x: 10, y: 10 },
    bare: { name: 'bare', xpv: 5, mig2: true, ach: ACH0(), skills: { fish: 5 }, inv: { coin: 5 }, dur: { rod: 100 }, x: 10, y: 10 },
  };
  fs.writeFileSync(path.join(process.env.DATA_DIR, 'rodmig.json'), JSON.stringify({ players: clone(players), farm: {}, layout: 2 }));
  const w = new World('rodmig'), sv = w.saved;
  for (const k of Object.keys(players)) assert.strictEqual(sv[k].xpv, 6, k + ' ต้องเป็น xpv 6 หลังโหลด');
  assert.strictEqual(sv.r3.inv.coin, 5000, 'เหรียญไม่เปลี่ยน'); assert.strictEqual(sv.r7.inv.coin, 123); assert.strictEqual(sv.r2.inv.coin, 321); assert.strictEqual(sv.old4.inv.coin, 99); assert.strictEqual(sv.old3.inv.coin, 99);
  assert.strictEqual(S.rodTier(sv.r3.inv), 4); assert.strictEqual(S.rodTier(sv.r7.inv), 10); assert.strictEqual(S.rodTier(sv.r2.inv), 2); assert.strictEqual(S.rodTier(sv.old4.inv), 4); assert.strictEqual(S.rodTier(sv.old3.inv), 2); assert.strictEqual(S.rodTier(sv.new6.inv), 10); assert.strictEqual(sv.new6.dur.rod, 7); assert.strictEqual(sv.new6.tmig, undefined);
  assert.strictEqual(sv.r7.dur.rod, S.durMax('rod', 10, 0), 'r7 เต็มยังเต็ม'); assert.deepStrictEqual(sv.r7.tmig.add.slice().sort(), ['rod_10', 'rod_8'], 'ถือ {2,5,7} → N = {2,8,10}'); assert.deepStrictEqual(sv.r7.tmig.left, { rod_5: 1, rod_7: 1 });
  assert.deepStrictEqual(sv.r3.fix, { rod: 1 }); assert.strictEqual(sv.r3.tmig.dur.rod, 425);
  assert.ok(sv.old4.dur.rod > 0 && sv.old4.dur.rod <= S.durMax('rod', 4, 0), 'โซ่ xpv 4 → 5 → 6 ความทนอยู่ในช่วง'); if (sv.old4.dur.rod !== S.durMax('rod', 4, 0)) leaks.push(`old4 (xpv 4, rod_3 เต็ม 200/200) ควรเต็มคัน 4 ใหม่ ${S.durMax('rod', 4, 0)} แต่ได้ ${sv.old4.dur.rod}: migrateStdV5 (shared.js ~บรรทัด 559-561) ใช้ durMax ตารางใหม่ 10 ระดับกับระดับเดิม ทำให้ migrateToolsV6 คำนวณสัดส่วนจาก oldMax ผิด`);
  assert.strictEqual(sv.bare.dur.rod, 80, 'คัน 1 คงสัดส่วน 100/200 → 80/160'); assert.strictEqual(sv.bare.tmig && sv.bare.tmig.add.length, 0);
  w.dirty = true; w.save(true); const snap = clone(sv), w2 = new World('rodmig'); assert.deepStrictEqual(clone(w2.saved), snap, 'โหลดรอบสอง = ไม่เปลี่ยน'); w2.dirty = true; w2.save(true); assert.deepStrictEqual(clone(new World('rodmig').saved), snap, 'รอบสามเหมือนเดิม');
  for (const [name, lockedKeys] of [['r3', ['rod_3']], ['r7', ['rod_7']], ['old4', ['rod_3']]]) {
    const ws = mkWs(), p = w2.join(ws, name, '#e74c3c').p; w2.add(p, 'coin', 1);
    const first = ws.msgs.find(m => m.t === 'w'); assert.ok(first);
    for (const k of lockedKeys) assert.ok(!(k in first.inv), `${name}: ${k} ไม่ควรอยู่ใน w.inv`);
    assert.ok(S.rodTier(first.inv) > 1, name + ' client ยังเห็นคันใหม่'); assert.ok(!/tmig/.test(JSON.stringify(ws.msgs)), name + ' ไม่มี tmig ในข้อความที่ส่ง client');
    for (const m of ws.msgs.filter(m => m.t === 'inv')) for (const k of lockedKeys) if (k in m.inv) leaks.push(`${name}: ${k} หลุดใน inv message (add() ใน server/systems/core.js ส่ง inv ดิบ ไม่ผ่าน S.invPub)`);
    assert.ok(p.rec.inv[lockedKeys[0]] >= 1, 'ในเซฟยังมีอยู่');
    assert.deepStrictEqual(ws.msgs.find(m => m.t === 'w').dur.rod.slice(0, 2), [w2.durCur(p, 'rod'), w2.durMx(p, 'rod')]);
  }
  const w3 = new World('rodmig'), joined = {}, get = name => joined[name] || (() => { const ws = mkWs(), p = w3.join(ws, name, '#e74c3c').p; p.ws2 = ws; return (joined[name] = p); })();
  const shopAt = (p, kind) => { const [cx, cy] = S.BUILDINGS.find(b => b.kind === kind).counter[0]; p.x = (cx + 0.5) * TS; p.y = (cy + 0.5) * TS; };
  const toastOf = p => { const m = p.ws2.msgs.filter(x => x.t === 'msg').pop(); return m ? m.text : ''; };
  for (const [name, keys] of [['r3', ['rod_3', 'rod_4']], ['r7', ['rod_7', 'rod_10']], ['old4', ['rod_3', 'rod_4']]]) {
    const p = get(name); shopAt(p, 'fish'); p.rec.starter = { done: {}, final: true };
    for (const k of keys) { const c0 = p.rec.inv.coin, n0 = p.rec.inv[k]; w3.handle(p, { t: 'sellback', item: k }); assert.strictEqual(p.rec.inv.coin, c0, `${name} sellback ${k} เหรียญต้องไม่เพิ่ม`); assert.strictEqual(p.rec.inv[k], n0); assert.ok(/ขายคืนไม่ได้/.test(toastOf(p)), `${name} ${k}: ${toastOf(p)}`); }
  }
  { const p = get('r7'); const c0 = p.rec.inv.coin; // rod_5 ไม่อยู่ใน N={2,8,10}: ค้าง และ rod_2 เป็นของเดิมที่ไม่ได้ย้าย
    w3.handle(p, { t: 'sellback', item: 'rod_5' }); assert.strictEqual(p.rec.inv.coin, c0, 'rod_5 เดิมที่ค้าง ขายคืนไม่ได้');
    w3.handle(p, { t: 'sellback', item: 'rod_2' }); assert.strictEqual(p.rec.inv.coin, c0 + S.sellbackValue('rod_2'), 'rod_2 ไม่ได้ย้าย ขายได้ตามปกติ'); }
  { const q = get('r3'); shopAt(q, 'fish'); q.rec.inv.coin = 99999; q.rec.skills.fish = S.XP_TABLE_STD[20];
    w3.handle(q, { t: 'buy', item: 'rod_3', n: 1 }); assert.strictEqual(q.rec.inv.coin, 99999, 'ซื้อระดับต่ำกว่าที่ใช้อยู่ ไม่ได้'); w3.handle(q, { t: 'buy', item: 'rod_4', n: 1 }); assert.strictEqual(q.rec.inv.coin, 99999, 'ซื้อเท่ากันไม่ได้');
    w3.handle(q, { t: 'buy', item: 'rod_5', n: 1 }); assert.strictEqual(q.rec.inv.coin, 99999 - S.RODS[5].price); assert.strictEqual(S.rodTier(q.rec.inv), 5);
    w3.handle(q, { t: 'sellback', item: 'rod_5' }); assert.strictEqual(q.rec.inv.coin, 99999 - S.RODS[5].price + S.sellbackValue('rod_5'), 'ซื้อเองขายคืนได้'); w3.handle(q, { t: 'sellback', item: 'rod_4' }); assert.strictEqual(q.rec.inv.rod_4, 1, 'rod_4 ที่ระบบเพิ่มยังล็อก'); }
  w2.join(mkWs(), 'newbie', '#e74c3c'); assert.strictEqual(w2.saved.newbie.xpv, 6); assert.strictEqual(w2.saved.newbie.tmig, undefined);
}

// ---- (ญ) rodHit / fishTier / fightNew down ----
{
  const R = S.ROD_TUNE; assert.deepStrictEqual({ slow: R.slow, over: R.over }, { slow: { win: 0.85, wear: 0.5 }, over: { wear: 0.25 } }, 'ROD_TUNE ตามตั๋ว'); assert.ok(R.slowStr > 0);
  for (const f of S.FISH) for (let rod = 1; rod <= S.ROD_MAX; rod++) {
    const h = S.rodHit(rod, f), d = rod - S.fishTier(f);
    assert.strictEqual(h.down, Math.max(0, -d)); assert.strictEqual(h.over, Math.max(0, d)); assert.ok(Math.abs(h.win - Math.pow(0.85, h.down)) < 1e-12);
    assert.ok(Math.abs(h.wear - (d < 0 ? 1 + 0.5 * -d : 1 / (1 + 0.25 * d))) < 1e-12, `${f.id} rod ${rod} สึก ${h.wear}`);
    if (d === 0) { assert.strictEqual(h.wear, 1); assert.strictEqual(h.win, 1); }
    if (d === -1) assert.strictEqual(h.wear, 1.5, 'ต่ำ 1 ระดับ สึก ×1.5'); if (d === -1) assert.ok(Math.abs(h.win - 0.85) < 1e-12);
    if (d > 0) assert.ok(h.wear < 1, 'คันสูงกว่าสึกลด');
  }
  // fightNew: แรงปลา ×(1 + slowStr × down) เมื่อคันต่ำกว่าปลา
  for (const cls of [0, 1, 2, 3]) for (const rod of [1, 4, 10]) for (const down of [0, 1, 2, 3]) { const a = S.fightNew(cls, rod, 1, true, () => 0.5, 0), b = S.fightNew(cls, rod, 1, true, () => 0.5, down); if (!a.str) { assert.strictEqual(b.str, 0); continue; } assert.ok(Math.abs(b.str / a.str - (1 + R.slowStr * down)) < 1e-9, `str cls${cls} rod${rod} down${down}`); assert.strictEqual(b.run, a.run); }
  assert.doesNotThrow(() => S.fightNew(1, 5, 1, true, Math.random)); assert.ok(S.fightNew(1, 5, 1, true, () => 0.5).str > 0, 'ไม่ส่ง down = 0 (พฤติกรรมเดิม)');
  for (const bad of [null, undefined, {}]) assert.doesNotThrow(() => S.rodHit(3, bad));
}

// ---- (ฎ) การสึกคันที่ startFight (ไม่ใช่ตอนเหวี่ยง) ----
{
  const w = new World('rodwear'), ws = mkWs(), p = w.join(ws, 'angler', '#e74c3c').p;
  p.rec.skills = Object.assign(p.rec.skills || {}, { fish: S.XP_TABLE_STD[20] }); p.rec.hunger = 100; p.rec.starter = { done: {}, final: true }; p.rec.ach = { cnt: { fish: 5 }, got: Object.fromEntries(S.ACH.map(d => [d.id, 1])) }; // cnt.fish > 0 กันปลาตัวแรกการันตี
  const W = S.WEAR_RATE, T0 = Date.now(), per = W.base * (1 + W.perHeat);
  const setRod = t => { p.rec.inv = { coin: 100, bait: 99 }; if (t > 1) p.rec.inv['rod_' + t] = 1; if (p.rec.dur) delete p.rec.dur.rod; p.fish = null; p.baitSel = 'bait'; };
  // ก) เหวี่ยงเบ็ดเฉยๆ ไม่สึก • ดึงเบ็ดก่อนปลากิน ไม่สึกและได้เหยื่อคืน
  for (const t of [1, 4, 10]) {
    setRod(t); p.heat = {}; const d0 = w.durCur(p, 'rod'), b0 = p.rec.inv.bait; w.castFish(p, 10, 10, T0, false, ''); assert.strictEqual(p.fish.st, 'wait'); assert.strictEqual(w.durCur(p, 'rod'), d0, 'เหวี่ยงแล้วยังไม่สึก'); assert.strictEqual(p.rec.inv.bait, b0 - 1);
    w.reelFish(p, T0 + 100); assert.strictEqual(p.fish, null, 'ดึงเบ็ดก่อนปลากิน = จบ'); assert.strictEqual(w.durCur(p, 'rod'), d0, `คัน ${t}: ดึงก่อนปลากิน ไม่สึก`); assert.strictEqual(p.rec.inv.bait, b0, 'ได้เหยื่อคืน'); assert.ok(!(p.rec.dur && p.rec.dur.rod < d0));
    assert.strictEqual(ws.msgs.filter(m => m.t === 'dur').length >= 0, true);
  }
  // ข) ปลากินเบ็ด (tick เข้า startFight) สึกตามระดับปลา: ล้างความร้อนก่อนทุกครั้ง ค่าที่คาด = floor(base × (1+perHeat) × wear)
  const seen = { lo: 0, eq: 0, hi: 0 }; let n = 0;
  for (const t of [1, 2, 3, 5, 7, 10]) for (let i = 0; i < 60; i++) {
    setRod(t); p.heat = {}; w.castFish(p, 10, 10, T0, false, ''); const d0 = w.durCur(p, 'rod'); p.fish.at = T0; w.tick(0.1, T0 + 1);
    if (!p.fish || p.fish.st !== 'fight') { w.tick(0.1, T0 + 2); }
    assert.ok(p.fish && p.fish.st === 'fight', 'ปลากินเบ็ดแล้วเข้าชักเย่อ'); const f = p.fish.pick, rh = S.rodHit(t, f), took = d0 - w.durCur(p, 'rod'); n++;
    assert.strictEqual(took, Math.floor(per * Math.min(rh.wear, 5)), `คัน ${t} ปลา ${f.id} (ระดับ ${S.fishTier(f)}) สึก ${took} คาด ${Math.floor(per * rh.wear)} (wear ${rh.wear})`);
    assert.ok(rh.down === 0 || S.rodHit(t, f).wear > 1); seen[rh.down > 0 ? 'lo' : rh.over > 0 ? 'hi' : 'eq']++;
    p.fish = null;
  }
  assert.ok(seen.lo > 0 && seen.hi > 0, 'ชุดทดสอบครอบทั้งคันต่ำกว่าและสูงกว่าปลา ' + JSON.stringify(seen));
  // ค) ปลายกชนะ/แพ้ไม่ทำให้สึกซ้ำ: ครั้งเดียวต่อการกินเบ็ด (ชักเย่อจบไม่สึกเพิ่ม)
  setRod(5); p.heat = {}; w.castFish(p, 10, 10, T0, false, ''); p.fish.at = T0; w.tick(0.1, T0 + 1); const after = w.durCur(p, 'rod'); p.fish.ft.end = 'snap'; w.fightEnd(p, T0 + 5); assert.strictEqual(w.durCur(p, 'rod'), after, 'จบชักเย่อไม่สึกเพิ่ม'); assert.strictEqual(p.fish, null);
  // ง) คันที่ซื้อใหม่ซื้อไม่ได้ถ้าต่ำกว่า ฯลฯ ครอบไว้ใน (ซ) แล้ว • คันพัง (dur 0) เหวี่ยงไม่ได้
  setRod(3); p.rec.dur = { rod: 0 }; const b = p.rec.inv.bait; p.x = 0; p.y = 0; w.act(p, 'rod', Date.now(), 1, 1); assert.strictEqual(p.fish, null, 'ไม่ได้เหวี่ยง'); assert.strictEqual(p.rec.inv.bait, b);
}

assert.deepStrictEqual(leaks, [], 'ของค้าง (tmig.left) ต้องไม่หลุดไปที่ client ทุกเส้นทาง');
console.log('ผ่าน test-rod-migrate'); process.exit(0);
