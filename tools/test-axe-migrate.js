// ทดสอบขวาน 10 ระดับ (WP-10, 13 พ.ย. 2026): ตัวย้ายเซฟ xpv 5 → 6 (ตารางทางเลือก B ไม่มีใครเสียสิทธิ์) • unmigrate • chopHit • ฟันต้นไม้จริงผ่านข้อความ
// ใช้เรคอร์ดสังเคราะห์ใน DATA_DIR ชั่วคราวเท่านั้น (ไม่แตะ data/ จริง): node tools/test-axe-migrate.js
const fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process'), os = require('os');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-axemig-');
const S = require('../public/shared.js'), TS = S.TS, T = S.T, MIG = S.AXE_MIG6, REPAIR = S.REPAIR;
const clone = o => JSON.parse(JSON.stringify(o));
const EXPECT_MAP = { 1: 1, 2: 2, 3: 4, 4: 6, 5: 9 }, OLD_MAX = [0, 90, 140, 220, 320, 450];
// ขวานระดับเดิมที่ต้นไม้แต่ละชนิดต้องการ (ก่อน xpv 6) — ใช้ยืนยันว่าไม่มีใครฟันต้นที่เคยฟันได้แล้วฟันไม่ได้
const OLD_TREE_AXE = { broad: 1, bamboo: 1, pine: 1, coconut: 1, teak: 2, gold: 3, padauk: 3, rose: 3, oak: 3, willow: 3, dipt: 4, maple: 4, takian: 4, ginkgo: 4, sakura: 5, makha: 5, raintree: 5, ebony: 5, shingchan: 5, ancient: 5 };
const subsets = []; for (let m = 1; m < 32; m++) { const s = []; for (let t = 1; t <= 5; t++) if (m & (1 << (t - 1))) s.push(t); subsets.push(s); }
const invOf = (held, coin = 777) => { const o = { coin, lamp: 1, stone: 7 }; for (const t of held) o['axe_' + t] = 1; return o; };
const oldMaxOf = (t, fx) => Math.floor(OLD_MAX[t] * (1 - REPAIR.decay * Math.min(REPAIR.maxFixes, fx)));
const durClose = (nw, nm, before, om, msg) => assert.ok(Math.abs(nw / nm - before / om) <= 1 / nm + 1 / om, `${msg}: ${before}/${om} → ${nw}/${nm}`);

// ---- (ก) ตารางและตัวเลขตามตั๋ว ----
{
  assert.deepStrictEqual(MIG.map, EXPECT_MAP, 'ตารางแปลงขวานเป็นทางเลือก B {1,2,4,6,9}');
  assert.deepStrictEqual(MIG.oldMax, OLD_MAX); assert.deepStrictEqual(MIG.oldPrice, [0, 50, 220, 700, 2000, 5500]);
  assert.strictEqual(S.AXE_MAX, 10); assert.strictEqual(Object.keys(S.AXES).length, 10);
  for (let t = 1; t <= 5; t++) assert.ok(MIG.map[t] >= t, 'ระดับใหม่ไม่ต่ำกว่าเดิม ' + t);
  for (let t = 2; t <= 5; t++) assert.ok(MIG.map[t] > MIG.map[t - 1], 'ตารางแปลงเพิ่มขึ้นเรื่อยๆ');
  assert.deepStrictEqual(S.DURABILITY.axe.max, [0, 155, 390, 730, 1000, 1275, 1745, 2145, 2610, 2985, 3315]); // 14 พ.ย. 2026 สมดุลความทนทาน: ค่าสึก ~6.3% ของรายได้ (เดิม 120…2610 ค่าสึก 8%)
  for (let t = 1; t <= 10; t++) assert.strictEqual(S.TOOL_PRICE.axe[t], S.AXES[t].price, 'ราคา TOOL_PRICE ตรง AXES ' + t);
  for (const [id, K] of Object.entries(S.TREE_KINDS)) { assert.strictEqual(K.axe, Math.ceil(K.lv / 2), id + ' ระดับต้นไม้ = ⌈Lv÷2⌉'); assert.strictEqual(K.hp, S.AXE_TUNE.hpPer * K.axe, id + ' hp = 5 × ระดับ'); }
  assert.deepStrictEqual(Object.keys(S.TREE_KINDS).sort(), Object.keys(OLD_TREE_AXE).sort(), 'ชนิดต้นไม้ครบเท่าเดิม');
}

// ---- (ข) ไม่มีใครเสียสิทธิ์ (ทุกชุดที่ถือได้ ฟันต้นที่เคยฟันได้แล้วยังฟันได้) ----
{
  for (const held of subsets) {
    const rec = { xpv: 5, inv: invOf(held) }; S.migrateToolsV6(rec); const oldTop = held[held.length - 1];
    assert.strictEqual(S.axeTier(rec.inv), MIG.map[oldTop], `ถือ [${held}] ระดับใช้งานหลังย้าย = map[${oldTop}]`);
    assert.ok(S.axeTier(rec.inv) >= oldTop, 'ระดับไม่ลด');
    for (const [id, need] of Object.entries(OLD_TREE_AXE)) if (oldTop >= need) { const r = S.chopHit(rec.inv, id); assert.ok(r && !r.blocked, `ถือ [${held}] เคยฟัน ${id} ได้ ต้องยังฟันได้`); }
  }
  // ถึงระดับเดียว (ไม่ถือเลย) ผู้เล่นใหม่ได้ขวานแรกเริ่มตามเดิม
  assert.strictEqual(S.axeTier({}), 0); assert.strictEqual(S.chopHit({}, 'broad'), null, 'ไม่มีขวาน → null');
}

// ---- (ค) ย้ายทุกระดับเดิม × ซ่อม 0/2/3 × ความทนเต็ม/ครึ่ง/0.2/0 ----
{
  for (let t = 1; t <= 5; t++) for (const fx of [0, 2, 3]) for (const f of [1, 0.5, 0.2, 0]) {
    const om = oldMaxOf(t, fx), before = Math.round(om * f), rec = { xpv: 5, inv: invOf([t]), dur: { axe: before, pick: 33 }, fix: { axe: fx, pick: 1 } }, fixBefore = clone(rec.fix), nu = EXPECT_MAP[t];
    const r = S.migrateToolsV6(rec), nm = S.durMax('axe', nu, fx);
    assert.deepStrictEqual(r.axe, [t, nu]); assert.strictEqual(rec.xpv, 6); assert.strictEqual(rec.inv.coin, 777, 'เหรียญไม่เปลี่ยน');
    assert.deepStrictEqual(rec.fix, fixBefore, 'rec.fix คงเดิม'); assert.strictEqual(rec.dur.pick, 33, 'ความทนของเครื่องมืออื่นไม่แตะ');
    assert.strictEqual(rec.inv.lamp, 1); assert.strictEqual(rec.inv.stone, 7);
    if (before === 0) assert.strictEqual(rec.dur.axe, 0, 'พังยังพัง'); else { assert.ok(rec.dur.axe >= 1, 'ไม่พังกลับ'); durClose(rec.dur.axe, nm, before, om, `axe_${t} f=${f} fix=${fx}`); }
    assert.ok(rec.dur.axe >= 0 && rec.dur.axe <= nm, 'ไม่เกินความทนสูงสุดใหม่');
    if (f === 1) assert.strictEqual(rec.dur.axe, nm, 'เต็มยังเต็ม');
    assert.strictEqual(rec.inv['axe_' + nu], 1, 'ได้คีย์ระดับใหม่'); assert.ok(rec.inv['axe_' + t] >= 1, 'คีย์เดิมไม่ถูกลบ');
    if (nu === t) assert.ok(!rec.tmig || (!rec.tmig.add.length && !Object.keys(rec.tmig.left).length), 'ระดับที่ไม่เปลี่ยนไม่มีของค้าง');
    else { assert.deepStrictEqual(rec.tmig.add, ['axe_' + nu]); assert.deepStrictEqual(rec.tmig.left, { ['axe_' + t]: 1 }); }
    assert.strictEqual(rec.tmig.dur.axe, before, 'tmig จำค่าความทนเดิม');
  }
  // เต็มเมื่อไม่มีค่า dur: ไม่แตะ dur (ไม่สร้างให้) และ ไม่มีซ่อม = เต็ม
  for (let t = 1; t <= 5; t++) { const rec = { xpv: 5, inv: invOf([t]) }; S.migrateToolsV6(rec); assert.strictEqual(rec.dur, undefined, 'ไม่มี dur ไม่สร้างให้'); assert.strictEqual(S.axeTier(rec.inv), EXPECT_MAP[t]); }
  // ความทนเกินสูงสุดเดิม → ตัดเหลือเต็ม • ค่าติดลบ/ไม่ใช่ตัวเลข
  { const rec = { xpv: 5, inv: invOf([3]), dur: { axe: 99999 } }; S.migrateToolsV6(rec); assert.strictEqual(rec.dur.axe, S.durMax('axe', 4, 0)); }
  { const rec = { xpv: 5, inv: invOf([3]), dur: { axe: -50 } }; S.migrateToolsV6(rec); assert.strictEqual(rec.dur.axe, 0); }
  { const rec = { xpv: 5, inv: invOf([3]), dur: { axe: 'x' } }; S.migrateToolsV6(rec); assert.strictEqual(rec.dur.axe, 'x', 'dur ไม่ใช่ตัวเลข ไม่แตะ'); }
  { const rec = { xpv: 5, inv: { coin: 5 }, dur: { axe: 12 } }; S.migrateToolsV6(rec); assert.strictEqual(rec.dur.axe, 12, 'ไม่มีขวานในกระเป๋า ไม่แตะ dur'); assert.strictEqual(rec.tmig, undefined); }
  // fix เกินเพดาน (maxFixes 3) ใช้ 3
  { const om = oldMaxOf(4, 3), rec = { xpv: 5, inv: invOf([4]), dur: { axe: om }, fix: { axe: 9 } }; S.migrateToolsV6(rec); assert.ok(rec.dur.axe >= 1 && rec.dur.axe <= S.durMax('axe', 6, 9)); }
}

// ---- (ง) ถือหลายระดับ ทุกชุดย่อย × ความทน ----
{
  for (const held of subsets) for (const f of [1, 0.5, 0]) for (const fx of [0, 3]) {
    const top = held[held.length - 1], om = oldMaxOf(top, fx), before = Math.round(om * f), rec = { xpv: 5, inv: invOf(held, 4321), dur: { axe: before }, fix: { axe: fx } }, orig = clone(rec);
    S.migrateToolsV6(rec);
    const N = new Set(held.map(t => EXPECT_MAP[t])), keep = Object.keys(rec.inv).filter(k => /^axe_/.test(k)).map(k => +k.slice(4)).sort((a, b) => a - b);
    assert.strictEqual(rec.inv.coin, 4321, 'เหรียญไม่เปลี่ยน');
    for (const t of held) assert.ok(rec.inv['axe_' + t] >= 1, `[${held}] คีย์เดิม axe_${t} ยังอยู่`);
    for (const n of N) assert.strictEqual(rec.inv['axe_' + n] >= 1, true, `[${held}] มี axe_${n}`);
    assert.deepStrictEqual(keep, [...new Set([...held, ...N])].sort((a, b) => a - b), 'คีย์ขวานหลังย้าย = เดิม ∪ ชุดใหม่ ไม่มีอย่างอื่น');
    const add = [...N].filter(n => !held.includes(n)).map(n => 'axe_' + n).sort(), left = held.filter(t => !N.has(t)).map(t => 'axe_' + t).sort();
    assert.deepStrictEqual((rec.tmig ? rec.tmig.add : []).slice().sort(), add, `[${held}] tmig.add`);
    assert.deepStrictEqual(Object.keys(rec.tmig ? rec.tmig.left : {}).sort(), left, `[${held}] tmig.left`);
    // ความทนคิดจากขวานที่ใช้อยู่ (สูงสุดที่ถือ)
    const nm = S.durMax('axe', EXPECT_MAP[top], fx); if (before === 0) assert.strictEqual(rec.dur.axe, 0); else durClose(rec.dur.axe, nm, before, om, `[${held}] f=${f} fix=${fx}`);
    assert.deepStrictEqual(rec.fix, orig.fix);
    // ความทนไม่ควรเกินสูงสุดของขวานที่ใช้งานจริงหลังย้าย (ที่ server ใช้ axeTier)
    assert.ok(rec.dur.axe <= S.durMax('axe', S.axeTier(rec.inv), fx));
  }
  // จำนวนมากกว่า 1 ชิ้นในคีย์ที่ค้าง บันทึกจำนวนจริง
  { const rec = { xpv: 5, inv: { coin: 1, axe_3: 2 } }; S.migrateToolsV6(rec); assert.strictEqual(rec.tmig.left.axe_3, 2); assert.strictEqual(S.tmigLocked(rec, 'axe_3'), 2, 'ล็อกทั้ง 2 ชิ้น'); assert.strictEqual(S.tmigLocked(rec, 'axe_4'), 1, 'ชิ้นที่ระบบเพิ่มให้ล็อก 1'); assert.strictEqual(S.tmigLocked(rec, 'axe_1'), 0); assert.strictEqual(S.tmigLocked({}, 'axe_1'), 0); assert.strictEqual(S.tmigLocked(null, 'axe_1'), 0); }
}

// ---- (จ) idempotent • xpv >= 6 ข้าม • เรคอร์ดผิดรูปไม่พัง ----
{
  for (const held of subsets) { const rec = { xpv: 5, inv: invOf(held), dur: { axe: 30 }, fix: { axe: 2 } }; S.migrateToolsV6(rec); const snap = clone(rec); assert.strictEqual(S.migrateToolsV6(rec), null, 'ครั้งสองไม่ทำ'); assert.deepStrictEqual(rec, snap, 'รันซ้ำเหมือนเดิม'); S.migrateToolsV6(rec); assert.deepStrictEqual(rec, snap); }
  for (const v of [6, 7, 99]) { const rec = { xpv: v, inv: invOf([3]), dur: { axe: 30 } }, snap = clone(rec); assert.strictEqual(S.migrateToolsV6(rec), null); assert.deepStrictEqual(rec, snap, 'xpv ' + v + ' ข้าม'); }
  for (const bad of [null, undefined, 0, 'x', [], {}, { xpv: 5 }, { xpv: 5, inv: null }, { xpv: 5, inv: 'x' }, { xpv: 5, inv: [] }, { xpv: 5, inv: { axe_3: 'x' } }, { xpv: 5, inv: { axe_3: -1 } }, { xpv: 5, inv: { axe_3: 0 } }, { xpv: 5, inv: { axe_3: NaN } },
    { xpv: 5, inv: { axe_3: 1 }, dur: null }, { xpv: 5, inv: { axe_3: 1 }, dur: 'x' }, { xpv: 5, inv: { axe_3: 1 }, dur: { axe: null } }, { xpv: 5, inv: { axe_3: 1 }, dur: { axe: 5 }, fix: null }, { xpv: 5, inv: { axe_3: 1 }, dur: { axe: 5 }, fix: { axe: 'z' } }, { xpv: 5, inv: { axe_3: 1 }, tmig: 'x' }, { xpv: 'abc', inv: { axe_3: 1 } }]) {
    assert.doesNotThrow(() => S.migrateToolsV6(bad), 'ไม่ควรพัง: ' + JSON.stringify(bad));
  }
  { const rec = { xpv: 5 }; const r = S.migrateToolsV6(rec); assert.strictEqual(rec.xpv, 6, 'เรคอร์ดว่างก็ติดธง xpv 6'); assert.strictEqual(rec.inv, undefined, 'ไม่สร้าง inv ให้'); assert.deepStrictEqual(r.axe, [0, 0]); assert.strictEqual(rec.tmig, undefined); }
  { const rec = { xpv: 5, inv: { coin: 9 } }; S.migrateToolsV6(rec); assert.deepStrictEqual(rec.inv, { coin: 9 }, 'ไม่มีขวาน ไม่ให้ขวาน'); }
  { const rec = { xpv: 5, inv: { axe_3: 0 } }; S.migrateToolsV6(rec); assert.deepStrictEqual(rec.inv, { axe_3: 0 }, 'axe_3 = 0 ไม่นับว่าถือ'); }
}

// ---- (ฉ) unmigrate คืนสภาพเดิมเป๊ะ ----
{
  for (const held of subsets) for (const f of [1, 0.5, 0]) for (const fx of [0, 2, 3]) {
    const top = held[held.length - 1], om = oldMaxOf(top, fx), rec = { xpv: 5, skills: { wood: 99 }, inv: invOf(held), dur: { axe: Math.round(om * f), pick: 40 }, fix: { axe: fx } }, orig = clone(rec);
    S.migrateToolsV6(rec); assert.strictEqual(S.unmigrateToolsV6(rec), true); assert.deepStrictEqual(rec, orig, `[${held}] f=${f} fix=${fx} unmigrate คืนเป๊ะ`);
    assert.strictEqual(S.unmigrateToolsV6(rec), false, 'ถอยซ้ำไม่ทำ');
  }
  { const rec = { xpv: 5, inv: { coin: 5 } }, orig = clone(rec); S.migrateToolsV6(rec); S.unmigrateToolsV6(rec); assert.deepStrictEqual(rec, orig, 'ไม่มีขวาน คืนเดิม'); }
  { const rec = { xpv: 5 }; S.migrateToolsV6(rec); assert.strictEqual(S.unmigrateToolsV6(rec), true); assert.deepStrictEqual(rec, { xpv: 5 }); }
  // เล่นต่อหลังย้ายแล้วค่อยถอย: คีย์ที่ระบบเพิ่มถูกลบ ความทนไม่เกินสูงสุดเดิมของระดับเดิม ไม่มีขวานหาย
  for (let t = 1; t <= 5; t++) for (const fx of [0, 3]) {
    const om = oldMaxOf(t, fx), rec = { xpv: 5, inv: invOf([t]), dur: { axe: om }, fix: { axe: fx } }; S.migrateToolsV6(rec); rec.dur.axe = Math.max(0, rec.dur.axe - 11); // ใช้ไปแล้ว
    assert.strictEqual(S.unmigrateToolsV6(rec), true); assert.strictEqual(rec.xpv, 5); assert.strictEqual(S.axeTier(rec.inv), t, 'ถอยแล้วขวานเดิม'); assert.ok(rec.dur.axe >= 0 && rec.dur.axe <= om, `ถอย axe_${t}: dur ${rec.dur.axe} ต้อง ≤ ${om}`); assert.strictEqual(rec.tmig, undefined);
  }
  // ซื้อขวานใหม่หลังย้ายแล้วถอย: ไม่ลบของที่ซื้อเอง
  { const rec = { xpv: 5, inv: invOf([3]) }; S.migrateToolsV6(rec); rec.inv.axe_7 = 1; S.unmigrateToolsV6(rec); assert.strictEqual(rec.inv.axe_7, 1, 'ของที่ซื้อเองอยู่'); assert.ok(!rec.inv.axe_4, 'ของที่ระบบเพิ่มถูกลบ'); assert.strictEqual(rec.inv.axe_3, 1); }
  assert.strictEqual(S.unmigrateToolsV6({ xpv: 5, inv: {} }), false); assert.strictEqual(S.unmigrateToolsV6(null), false);
  for (const bad of [{ xpv: 6 }, { xpv: 6, tmig: 'x' }, { xpv: 6, tmig: { add: 'x', left: null, dur: 5 }, inv: { axe_3: 1 } }, { xpv: 6, tmig: { add: [3, {}, 'axe_zzz', 'coin'], old: { axe: 99 }, dur: { axe: 'x' } }, inv: { coin: 5 }, dur: { axe: 4 } }])
    assert.doesNotThrow(() => S.unmigrateToolsV6(clone(bad)), 'ถอยเรคอร์ดผิดรูปไม่พัง ' + JSON.stringify(bad));
  { const rec = { xpv: 6, tmig: { add: ['coin'] }, inv: { coin: 50 } }; S.unmigrateToolsV6(rec); assert.strictEqual(rec.inv.coin, 50, 'tmig.add ที่ไม่ใช่ขวาน/คัน ไม่ลบ'); }
}

// ---- (ช) สคริปต์ tools/tools-unmigrate.js กับสำเนาชั่วคราวเท่านั้น ----
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-axeunm-')); process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} });
  const origPlayers = {}, migPlayers = {};
  subsets.forEach((held, i) => { const top = held[held.length - 1], rec = { name: 'u' + i, xpv: 5, inv: invOf(held, 100 + i), dur: { axe: Math.round(oldMaxOf(top, 2) / 2) }, fix: { axe: 2 } }; origPlayers['u' + i] = clone(rec); S.migrateToolsV6(rec); migPlayers['u' + i] = rec; });
  const file = path.join(dir, 'room.json'); fs.writeFileSync(file, JSON.stringify({ players: migPlayers, farm: {}, layout: 2 }));
  const out = cp.execFileSync(process.execPath, [path.join(__dirname, 'tools-unmigrate.js'), file], { encoding: 'utf8', env: Object.assign({}, process.env, { DATA_DIR: dir }) });
  assert.ok(/ถอยกลับ 31 บัญชี/.test(out), out); assert.ok(fs.existsSync(file + '.pre-unmig'), 'สำรอง .pre-unmig');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).players, origPlayers, 'สคริปต์ถอยกลับคืนเดิมทั้งไฟล์');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file + '.pre-unmig', 'utf8')).players, migPlayers, 'ไฟล์สำรองคือสภาพก่อนถอย');
  const out2 = cp.execFileSync(process.execPath, [path.join(__dirname, 'tools-unmigrate.js'), file], { encoding: 'utf8', env: Object.assign({}, process.env, { DATA_DIR: dir }) }); assert.ok(/ไม่มีบัญชี xpv 6/.test(out2), 'รันซ้ำไม่ทำอะไร');
}

// ---- (ซ) โหลดผ่าน World: โซ่ทุกเวอร์ชันจบที่ xpv 6 • เหรียญไม่เปลี่ยน • เซฟแล้วโหลดซ้ำไม่เปลี่ยน • tmig ไม่หลุดไป client • sellback ล็อก ----
const { World } = require('../server.js'), leaks = []; // ข้อผิดพลาดที่รวบไว้ตรวจท้ายไฟล์ (ให้ส่วนอื่นรันครบก่อน)
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
{
  const ACH0 = () => ({ cnt: {}, got: Object.fromEntries(S.ACH.map(d => [d.id, 1])) }); // กันเหรียญโบนัสความสำเร็จปนกับยอดเหรียญตอนโหลด
  const players = {
    a3: { name: 'a3', xpv: 5, mig2: true, ach: ACH0(), skills: { wood: 5000 }, inv: { coin: 5000, axe_3: 1 }, dur: { axe: 110 }, fix: { axe: 1 }, x: 10, y: 10 },
    a5: { name: 'a5', xpv: 5, mig2: true, ach: ACH0(), skills: { wood: 5000 }, inv: { coin: 123, axe_1: 1, axe_2: 1, axe_5: 1 }, dur: { axe: 225 }, x: 10, y: 10 },
    a2: { name: 'a2', xpv: 5, mig2: true, ach: ACH0(), skills: { wood: 5000 }, inv: { coin: 321, axe_2: 1 }, x: 10, y: 10 },
    old4: { name: 'old4', xpv: 4, mig2: true, ach: ACH0(), skills: { wood: 5000, fish: 700 }, inv: { coin: 99, axe_4: 1 }, dur: { axe: 160 }, x: 10, y: 10 },
    old3: { name: 'old3', xpv: 3, mig2: true, ach: ACH0(), skills: { wood: 5000, mine: 100 }, inv: { coin: 99, axe_3: 1, pick_2: 1 }, x: 10, y: 10 },
    new6: { name: 'new6', xpv: 6, mig2: true, ach: ACH0(), skills: { wood: 5 }, inv: { coin: 55, axe_7: 1 }, dur: { axe: 7 }, x: 10, y: 10 },
    bare: { name: 'bare', xpv: 5, mig2: true, ach: ACH0(), skills: { wood: 5 }, inv: { coin: 5 }, x: 10, y: 10 },
  };
  fs.writeFileSync(path.join(process.env.DATA_DIR, 'axemig.json'), JSON.stringify({ players: clone(players), farm: {}, layout: 2 }));
  const w = new World('axemig'), sv = w.saved;
  for (const k of Object.keys(players)) assert.strictEqual(sv[k].xpv, 8, k + ' ต้องเป็น xpv 8 หลังโหลด');
  assert.strictEqual(sv.a3.inv.coin, 5000, 'a3 เหรียญไม่เปลี่ยน'); assert.strictEqual(sv.a5.inv.coin, 123); assert.strictEqual(sv.a2.inv.coin, 321);
  assert.strictEqual(sv.old4.inv.coin, 99, 'xpv 4 ไม่มีของอื่นให้คืนเงิน'); assert.strictEqual(sv.old3.inv.coin, 99 + 0, 'xpv 3 ไม่มีถุงมือ/ค้อน เหรียญเท่าเดิม');
  assert.strictEqual(S.axeTier(sv.a3.inv), 4); assert.strictEqual(S.axeTier(sv.a5.inv), 9); assert.strictEqual(S.axeTier(sv.a2.inv), 2); assert.strictEqual(S.axeTier(sv.old4.inv), 6); assert.strictEqual(S.axeTier(sv.old3.inv), 4); assert.strictEqual(S.axeTier(sv.new6.inv), 7, 'xpv 6 ไม่ถูกแตะ'); assert.strictEqual(sv.new6.dur.axe, 9, 'xpv 6 ย้ายความทนต่อ xpv 8 (7/1690 × 2145 ปัดเป็น 9)'); assert.strictEqual(sv.new6.tmig, undefined);
  assert.deepStrictEqual(sv.a5.tmig.add.sort(), ['axe_9']); assert.deepStrictEqual(sv.a5.tmig.left, { axe_5: 1 }); assert.deepStrictEqual(sv.a3.tmig.left, { axe_3: 1 });
  assert.strictEqual(sv.a3.tmig.dur.axe, 110); assert.deepStrictEqual(sv.a3.fix, { axe: 1 }, 'rec.fix คงเดิม');
  assert.strictEqual(sv.bare.tmig, undefined); assert.strictEqual(S.axeTier(sv.bare.inv), 0);
  // เซฟแล้วโหลดซ้ำ ไม่เปลี่ยน (ไม่ย้ายซ้ำ ไม่เพิ่มคีย์ซ้ำ)
  w.dirty = true; w.save(true); const snap = clone(sv), w2 = new World('axemig'); assert.deepStrictEqual(clone(w2.saved), snap, 'โหลดรอบสอง = ไม่เปลี่ยน');
  w2.dirty = true; w2.save(true); assert.deepStrictEqual(clone(new World('axemig').saved), snap, 'รอบสามก็เหมือนเดิม');
  // join: inv ที่ส่ง client ไม่มีของค้าง ไม่มี tmig
  for (const [name, lockedKeys] of [['a3', ['axe_3']], ['a5', ['axe_5']], ['old4', ['axe_4']]]) {
    const ws = mkWs(), p = w2.join(ws, name, '#e74c3c').p; w2.add(p, 'coin', 1);
    const first = ws.msgs.find(m => m.t === 'w'); assert.ok(first, 'ได้ข้อความ w');
    for (const k of lockedKeys) assert.ok(!(k in first.inv), `${name}: ${k} ไม่ควรอยู่ใน w.inv`);
    assert.ok(S.axeTier(first.inv) > 0, name + ' client ยังเห็นขวานใหม่');
    assert.ok(!/tmig/.test(JSON.stringify(ws.msgs)), name + ' ไม่มี tmig ในข้อความที่ส่ง client');
    const invMsgs = ws.msgs.filter(m => m.t === 'inv'); assert.ok(invMsgs.length >= 1); for (const m of invMsgs) for (const k of lockedKeys) if (k in m.inv) leaks.push(`${name}: ${k} หลุดใน inv message (add() ใน server/systems/core.js ส่ง inv ดิบ ไม่ผ่าน S.invPub)`);
    assert.ok(p.rec.inv[lockedKeys[0]] >= 1, 'แต่ในเซฟยังมีอยู่ (ไม่ถูกลบ)');
  }
  // sellback: คีย์ที่ล็อกถูกปฏิเสธ เหรียญไม่เพิ่ม • คีย์ปกติขายได้
  const shopAt = (p, kind) => { const [cx, cy] = S.BUILDINGS.find(b => b.kind === kind).counter[0]; p.x = (cx + 0.5) * TS; p.y = (cy + 0.5) * TS; };
  const toastOf = p => { const m = p.ws2.msgs.filter(x => x.t === 'msg').pop(); return m ? m.text : ''; };
  assert.ok(S.SHOPS.wood.buy.includes('axe_4') && S.SHOPS.wood.buy.includes('axe_9') && S.SHOPS.wood.buy.includes('axe_10'), 'ร้านช่างไม้ขายขวานครบ 10 ระดับ (ให้ sellback ผ่านด่านร้านก่อนถึงด่านล็อก)');
  const w3 = new World('axemig'), joined = {}, get = name => joined[name] || (() => { const ws = mkWs(), p = w3.join(ws, name, '#e74c3c').p; p.ws2 = ws; return (joined[name] = p); })();
  for (const [name, keys] of [['a3', ['axe_3', 'axe_4']], ['a5', ['axe_5', 'axe_9']], ['old4', ['axe_4', 'axe_6']]]) {
    const p = get(name); shopAt(p, 'wood'); p.rec.starter = { done: {}, final: true };
    for (const k of keys) {
      const c0 = p.rec.inv.coin, n0 = p.rec.inv[k]; w3.handle(p, { t: 'sellback', item: k });
      assert.strictEqual(p.rec.inv.coin, c0, `${name} sellback ${k} เหรียญต้องไม่เพิ่ม`); assert.strictEqual(p.rec.inv[k], n0, `${name} sellback ${k} ของไม่หาย`);
      assert.ok(/ขายคืนไม่ได้/.test(toastOf(p)), `${name} ${k} ต้องได้ข้อความปฏิเสธ`);
    }
    assert.strictEqual(p.rec.tmig && S.tmigLocked(p.rec, keys[0]) > 0 && S.tmigLocked(p.rec, keys[1]) > 0, true);
  }
  { // ของที่ซื้อเอง/ไม่ได้ย้ายขายคืนได้ตามปกติ 70% (กันล็อกเกินเหตุ)
    const p = get('a2'); shopAt(p, 'wood'); const c0 = p.rec.inv.coin;
    w3.handle(p, { t: 'sellback', item: 'axe_2' }); assert.strictEqual(p.rec.inv.coin, c0 + S.sellbackValue('axe_2'), 'axe_2 ไม่ได้ย้าย ขายคืนได้'); assert.ok(!p.rec.inv.axe_2);
    // ซื้อใหม่หลังย้าย: ซื้อระดับสูงกว่าที่ใช้ได้ ขายคืนได้ ระดับต่ำกว่า/เท่ากันซื้อไม่ได้
    const q = get('a3'); shopAt(q, 'wood'); q.rec.inv.coin = 99999; q.rec.skills.wood = S.XP_TABLE[20];
    w3.handle(q, { t: 'buy', item: 'axe_3', n: 1 }); assert.strictEqual(q.rec.inv.coin, 99999, 'ซื้อระดับต่ำกว่าที่ใช้อยู่ (4) ไม่ได้');
    w3.handle(q, { t: 'buy', item: 'axe_4', n: 1 }); assert.strictEqual(q.rec.inv.coin, 99999, 'ซื้อระดับเท่ากันไม่ได้');
    w3.handle(q, { t: 'buy', item: 'axe_5', n: 1 }); assert.strictEqual(q.rec.inv.coin, 99999 - S.AXES[5].price); assert.strictEqual(S.axeTier(q.rec.inv), 5);
    w3.handle(q, { t: 'sellback', item: 'axe_5' }); assert.strictEqual(q.rec.inv.coin, 99999 - S.AXES[5].price + S.sellbackValue('axe_5'), 'ชิ้นที่ซื้อเองขายคืนได้'); assert.strictEqual(S.axeTier(q.rec.inv), 4);
    w3.handle(q, { t: 'sellback', item: 'axe_4' }); assert.strictEqual(q.rec.inv.axe_4, 1, 'axe_4 ที่ระบบเพิ่มให้ยังล็อก');
  }
  // ผู้เล่นใหม่เริ่มที่ xpv 6
  const nj = w2.join(mkWs(), 'newbie', '#e74c3c'); assert.strictEqual(w2.saved.newbie.xpv, 8); assert.strictEqual(w2.saved.newbie.tmig, undefined);
}

// ---- (ญ) chopHit: ดาเมจ ความสึก ไม้เพิ่ม ----
{
  const A = S.AXE_TUNE;
  assert.deepStrictEqual(A, { hpPer: 5, minHits: 3, maxDown: 1, slow: { dmg: 0.85, wear: 0.5 }, over: { bonus: 0.06, cap: 0.3, wear: 0.25 } }, 'AXE_TUNE ตามตั๋ว');
  for (const [id, K] of Object.entries(S.TREE_KINDS)) {
    const prev = {};
    for (let t = 1; t <= S.AXE_MAX; t++) {
      const inv = { ['axe_' + t]: 1 }, r = S.chopHit(inv, id), d = t - K.axe;
      if (d < -A.maxDown) { assert.strictEqual(r.blocked, true, `${id} ขวาน ${t} ต่ำเกิน ฟันไม่ได้`); assert.strictEqual(r.need, K.axe - A.maxDown); assert.strictEqual(r.dmg, undefined); continue; }
      assert.ok(!r.blocked);
      const raw = t * (d < 0 ? Math.pow(A.slow.dmg, -d) : 1), dmg = Math.min(raw, K.hp / A.minHits);
      assert.ok(Math.abs(r.dmg - dmg) < 1e-9, `${id} t${t} ดาเมจ ${r.dmg} ≠ ${dmg}`); assert.strictEqual(r.hits, Math.ceil(K.hp / dmg - 1e-9));
      assert.ok(r.hits >= A.minHits, 'ฟันได้เร็วสุด 3 ครั้ง'); assert.ok(r.dmg * r.hits >= K.hp - 1e-9 && r.dmg * (r.hits - 1) < K.hp, 'จำนวนครั้งโค่นได้พอดี');
      assert.ok(Math.abs(r.wear - (d < 0 ? 1 + A.slow.wear * -d : 1 / (1 + A.over.wear * d))) < 1e-9, `${id} t${t} สึก ${r.wear}`);
      assert.ok(Math.abs(r.extra - Math.min(A.over.cap, A.over.bonus * Math.max(0, d))) < 1e-9, `${id} t${t} ไม้เพิ่ม ${r.extra}`);
      prev[d] = r;
    }
    // ระดับเท่ากัน: ดาเมจเต็ม สึก ×1 ไม่มีไม้เพิ่ม ฟัน 5 ครั้งทุกต้น
    assert.strictEqual(prev[0].wear, 1); assert.strictEqual(prev[0].extra, 0); assert.strictEqual(prev[0].hits, 5, id + ' ระดับเท่ากัน = 5 ครั้ง');
    // ต่ำกว่า 1 ระดับ (ถ้าขวานระดับนั้นมีอยู่): ช้าลง (×0.85) สึก ×1.5 ไม่มีไม้เพิ่ม
    if (prev[-1]) { assert.ok(prev[-1].hits > prev[0].hits, id + ' ต่ำ 1 ระดับ ฟันนานขึ้น'); assert.strictEqual(prev[-1].wear, 1.5); assert.strictEqual(prev[-1].extra, 0); assert.strictEqual(prev[-1].slow, true); }
    // สูงกว่า: สึกลดลงเรื่อยๆ ไม้เพิ่มเพิ่มจนติดเพดาน 0.3 ไม่ฟันช้ากว่าระดับเท่ากัน
    let lastW = 1, lastE = 0; for (let d = 1; d <= S.AXE_MAX - K.axe; d++) { const r = prev[d]; assert.ok(r.wear < lastW, id + ' ขวานสูงขึ้นสึกลด'); assert.ok(r.extra >= lastE && r.extra <= 0.3 + 1e-9); assert.ok(r.hits <= prev[0].hits); lastW = r.wear; lastE = r.extra; }
  }
  // ต้นระดับ 1 ขวาน 1: ไม่มีทางต่ำกว่า • ต้นระดับ 2 กับขวาน 1: ฟันได้ (ต่ำ 1) ต้นระดับ 3 กับขวาน 1: ฟันไม่ได้
  assert.ok(S.chopHit({ axe_1: 1 }, 'pine') && !S.chopHit({ axe_1: 1 }, 'pine').blocked);
  assert.strictEqual(S.chopHit({ axe_1: 1 }, 'teak').blocked, true, 'ขวาน 1 vs ต้นระดับ 3');
  assert.strictEqual(S.chopHit({ axe_10: 1 }, 'ancient').hits, 5); assert.strictEqual(S.chopHit({ axe_10: 1 }, 'broad').extra, 0.3);
  assert.strictEqual(S.chopHit({ axe_10: 1, axe_2: 1 }, 'broad').dmg, S.chopHit({ axe_10: 1 }, 'broad').dmg, 'ใช้ขวานสูงสุดที่มี');
  for (const bad of [null, undefined, {}, { axe_3: 'x' }]) assert.doesNotThrow(() => S.chopHit(bad, 'oak'));
}

// ---- (ฎ) ฟันต้นไม้จริงผ่านข้อความ act: ต่ำกว่าฟันช้า/สึกเร็ว • ต่ำกว่าเกินปฏิเสธ ไม่สึก • สูงกว่าสึกลด/ไม้เพิ่ม ----
{
  const w = new World('axechop'), ws = mkWs(), p = w.join(ws, 'chopper', '#e74c3c').p; ws.msgs = [];
  p.rec.skills = Object.assign(p.rec.skills || {}, { wood: S.XP_TABLE[20] }); p.rec.hunger = 100; p.rec.starter = { done: {}, final: true }; p.rec.inv = { coin: 100 };
  const tl = w.treeList().filter(([x, y]) => S.isChoppable(w.map, x, y)); assert.ok(tl.length, 'แมพมีต้นไม้ให้ฟัน');
  const [tx, ty] = tl[0], key = tx + ',' + ty; p.x = (tx + 0.5) * TS; p.y = (ty + 1.5) * TS; p.dir = 1;
  const reset = kid => { w.map[ty][tx] = T.TREE; w.treeKind.set(key, kid); w.treeHp.delete(key); p.hitAt = 0; p.lastAct = 0; };
  const hit = () => { p.hitAt = 0; p.lastAct = 0; w.handle(p, { t: 'act', tool: 'axe', tx, ty }); };
  const toast = () => { const m = ws.msgs.filter(x => x.t === 'msg').pop(); return m ? m.text : ''; };
  const setAxe = t => { p.rec.inv = { coin: 100, ['axe_' + t]: 1 }; if (p.rec.dur) delete p.rec.dur.axe; p.heat = {}; };
  const durNow = () => w.durCur(p, 'axe');
  const fresh = () => { p.heat = { axe: { h: 0, t: Date.now(), carry: 0, warn: false } }; };
  const keepHeat = () => { const H = p.heat && p.heat.axe; if (H) { H.h = 0; H.t = Date.now(); } };
  // ก) ขวานต่ำกว่าเกิน 1 ระดับ: ปฏิเสธ ต้นไม่เสียหาย ความทนเท่าเดิม
  setAxe(1); reset('oak'); { const d0 = durNow(); hit(); assert.ok(/ต้องใช้ขวานระดับ 4 ขึ้นไป/.test(toast()), toast()); assert.strictEqual(durNow(), d0, 'โดนปฏิเสธไม่สึก'); assert.ok(!w.treeHp.has(key), 'ไม่ลดเลือดต้นไม้'); assert.strictEqual(w.map[ty][tx], T.TREE); }
  setAxe(3); reset('ancient'); { hit(); assert.ok(/ต้องใช้ขวานระดับ 9 ขึ้นไป/.test(toast()), toast()); }
  // ข) จำนวนครั้งโค่นตรงกับ chopHit ทุกระดับของต้น pine (ระดับ 2 hp 10)
  for (const [t, kid] of [[2, 'pine'], [1, 'pine'], [4, 'pine'], [10, 'pine'], [5, 'oak'], [4, 'oak'], [9, 'ancient'], [10, 'ancient'], [1, 'broad'], [6, 'broad']]) {
    const mh = S.chopHit({ ['axe_' + t]: 1 }, kid); setAxe(t); reset(kid); let n = 0; while (w.map[ty][tx] === T.TREE && n < 60) { hit(); n++; }
    assert.strictEqual(n, mh.hits, `ขวาน ${t} ฟัน ${kid} ต้อง ${mh.hits} ครั้ง ได้ ${n}`);
  }
  // ค) ข้อความจำนวนครั้งที่เหลือ
  setAxe(1); reset('pine'); hit(); assert.ok(new RegExp('อีก ' + (S.chopHit({ axe_1: 1 }, 'pine').hits - 1) + ' ครั้ง').test(toast()), toast());
  // ง) ความสึก: เทียบกับระดับเท่ากัน (เฉลี่ย 40 ฟัน ล้างความร้อนทุกครั้ง)
  const wearOver = (t, kid) => { setAxe(t); fresh(); const d0 = durNow(); for (let i = 0; i < 40; i++) { reset(kid); keepHeat(); hit(); } return d0 - durNow(); };
  const W = S.WEAR_RATE, perHit = W.base * (1 + W.perHeat), exp = mul => 40 * perHit * mul;
  { const eq = wearOver(2, 'pine'), lo = wearOver(1, 'pine'), hi = wearOver(6, 'pine');
    assert.ok(Math.abs(eq - exp(1)) <= 1.5, `สึกเท่าระดับ ${eq} ≈ ${exp(1).toFixed(1)}`); assert.ok(Math.abs(lo - exp(1.5)) <= 1.5, `ต่ำ 1 ระดับ สึก ×1.5: ${lo} ≈ ${exp(1.5).toFixed(1)}`); assert.ok(Math.abs(hi - exp(1 / (1 + 0.25 * 4))) <= 1.5, `สูง 4 ระดับ สึก ×0.5: ${hi} ≈ ${exp(0.5).toFixed(1)}`);
    assert.ok(lo > eq && eq > hi, 'ต่ำสึกมากสุด สูงสึกน้อยสุด'); }
  // จ) ไม้เพิ่ม: สุ่มเป็น 0 ทุกครั้ง = ทุกโอกาสผ่าน → ขวานสูงกว่าได้ชิ้นหลักเพิ่ม 1 ชิ้น ขวานเท่ากันไม่ได้เพิ่มจากกลไกนี้
  { const rnd = Math.random, K = S.TREE_KINDS.broad, main = K.drop[0][0]; Math.random = () => 0;
    try {
      const fell = t => { setAxe(t); p.rec.inv[main] = 0; p.rec.inv.coin = 100; reset('broad'); let n = 0; while (w.map[ty][tx] === T.TREE && n < 60) { hit(); n++; } return p.rec.inv[main] || 0; };
      const same = fell(1), higher = fell(10); assert.strictEqual(higher, same + 1, `ขวานสูงกว่า (extra 0.3) ได้ ${main} เพิ่ม 1 (${same} → ${higher})`);
    } finally { Math.random = rnd; }
    Math.random = () => 0.999; try { const fell = t => { setAxe(t); p.rec.inv[main] = 0; reset('broad'); let n = 0; while (w.map[ty][tx] === T.TREE && n < 60) { hit(); n++; } return p.rec.inv[main] || 0; }; assert.strictEqual(fell(10), fell(1), 'สุ่มพลาดทุกครั้ง ไม่ได้เพิ่ม'); } finally { Math.random = rnd; } }
  // ฉ) ขวานพัง ฟันไม่ได้
  setAxe(2); p.rec.dur = { axe: 0 }; reset('pine'); hit(); assert.ok(/พังแล้ว/.test(toast()), toast()); assert.ok(!w.treeHp.has(key));
}

assert.deepStrictEqual(leaks, [], 'พบบั๊กในโค้ดเกม (ดูรายการ): ของค้าง tmig.left ต้องไม่หลุดไป client');
console.log('ผ่าน test-axe-migrate'); process.exit(0);
