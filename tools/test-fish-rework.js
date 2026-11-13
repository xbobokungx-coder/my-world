// ทดสอบปรับชาวประมง (6 พ.ย. 2026): ตารางหลอด XP_TABLE_STD • ตัวย้ายเซฟ xpv 4 → 5 • RARE_SELL • สระปลาเลื่อนตามเลเวล (FISHPOOL)
const assert = require('assert'), S = require('../public/shared.js');
{
  assert.deepStrictEqual(S.XP_TABLE_STD, [0, 0, 250, 576, 1000, 1552, 2271, 3208, 4428, 6017, 8086, 10780, 14289, 18859, 24810, 32561, 42655, 55801, 72921, 95218, 124256]);
  for (let lv = 1; lv <= S.MAX_LV; lv++) {
    assert.strictEqual(S.xpFor(lv, 'fish'), S.XP_TABLE_STD[lv]); assert.strictEqual(S.levelOf(S.XP_TABLE_STD[lv], 'fish'), lv);
    if (lv > 1) assert.strictEqual(S.levelOf(S.XP_TABLE_STD[lv] - 1, 'fish'), lv - 1);
    for (const sk of ['farm', 'animal', 'wood', 'cook']) assert.strictEqual(S.xpFor(lv, sk), S.XP_TABLE_STD[lv], sk + ' ใช้หลอดมาตรฐาน (xpv 7, WP-20)'); assert.strictEqual(S.xpFor(lv), S.XP_TABLE[lv], 'ไม่ส่ง skill = ตารางเดิม');
  }
  assert.strictEqual(S.xpFor(20, 'mine'), S.XP_TABLE_MINE[20]); assert.strictEqual(S.masteryXp('fish'), 8000);
}
{ // ย้ายเซฟ
  for (let L = 1; L < 20; L++) for (const f of [0, 0.3, 0.999]) {
    const old = Math.floor(S.XP_TABLE[L] + f * (S.XP_TABLE[L + 1] - S.XP_TABLE[L])), nw = S.xpStdV5(old, 'fish');
    assert.strictEqual(S.levelOf(nw, 'fish'), L, `เลเวลเท่าเดิม ${L}/${f}`);
    if (f === 0) assert.strictEqual(nw, S.XP_TABLE_STD[L]);
  }
  assert.strictEqual(S.xpStdV5(S.XP_TABLE[20], 'fish'), S.XP_TABLE_STD[20]);
  assert.strictEqual(S.xpStdV5(S.XP_TABLE[20] + S.MASTERY.xpPer, 'fish'), S.XP_TABLE_STD[20] + 8000, 'ครบ 1 ดาวเดิม = 1 ดาวใหม่');
  assert.strictEqual(S.xpStdV5(-5, 'fish'), 0); assert.strictEqual(S.xpStdV5(NaN, 'fish'), 0);
  const rec = { xpv: 4, skills: { fish: S.XP_TABLE[10], farm: 777, mine: 5 } };
  assert.strictEqual(S.migrateStdV5(rec, ['fish']), true); assert.strictEqual(rec.xpv, 5);
  assert.strictEqual(rec.skills.fish, S.XP_TABLE_STD[10]); assert.strictEqual(rec.skills.farm, 777); assert.strictEqual(rec.skills.mine, 5);
  assert.strictEqual(S.migrateStdV5(rec, ['fish']), false); assert.strictEqual(rec.skills.fish, S.XP_TABLE_STD[10], 'idempotent');
  const r2 = { xpv: 4 }; assert.strictEqual(S.migrateStdV5(r2, ['fish']), true); assert.strictEqual(r2.xpv, 5, 'ไม่มี skills ไม่พัง');
  assert.strictEqual(S.migrateStdV5(null, ['fish']), false);
}
{ // RARE_SELL
  assert.strictEqual(S.RARE_SELL, 100, 'เกณฑ์พักรอบกลับเป็น 100 เท่าเดิม (กติกาใหม่ 7 พ.ย. รอบ 2)'); assert.ok(S.fishWeight(S.FISH.find(f => f.id === 'dolphin'), 10, 4, 1) > 0);
}
{ // สระปลาเลื่อนตามเลเวล
  assert.deepStrictEqual(S.FISHPOOL, { keep: 2, decay: 0.75 });
  const by = id => S.FISH.find(f => f.id === id), K = S.FISHPOOL.keep, D = S.FISHPOOL.decay;
  assert.strictEqual(S.fishNewestLv(false, 20, 10), 20); assert.strictEqual(S.fishNewestLv(false, 20, 7), 14, "คัน 7 ตกได้ถึงปลา Lv14 (ปลา Lv15+ ต้องคัน 8+ ตาม rod = ⌈Lv÷2⌉)"); assert.strictEqual(S.fishNewestLv(true, 3, 1), 3);
  const carp = by('carp'), newest = 20;
  assert.strictEqual(S.fishPoolMul(carp, 20, 10), Math.pow(D, newest - 1 - K), 'ปลาเก่าถูกลดตามส่วนที่เกิน');
  assert.strictEqual(S.fishPoolMul(by('star'), 20, 10), 1); assert.strictEqual(S.fishPoolMul(by('boot'), 20, 10), 1, 'รองเท้าไม่ลด');
  assert.strictEqual(S.fishPoolMul(by('bass'), 4, 3), 1, 'ห่างไม่เกิน keep ไม่ลด');
  // ทะเลไม่ปนกับน้ำจืด
  assert.strictEqual(S.fishPoolMul(by('sardine'), 20, 10), Math.pow(D, S.fishNewestLv(true, 20, 10) - 1 - K));
  assert.ok(S.fishWeight(by('star'), 20, 10, 1) > 0); assert.ok(S.fishWeight(carp, 20, 10, 1) < carp.w, 'คาร์ปที่เลเวลสูงตกยากลง');
  assert.ok(S.fishWeight(carp, 1, 1, 1) === carp.w || S.fishWeight(carp, 1, 1, 1) > 0);
}


// ===== ส่วนเพิ่มของ QA (7 พ.ย. 2026) =====
const fs = require('fs'), path = require('path'), cp = require('child_process');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-fishrw-');
const { World } = require('../server.js'), clone = o => JSON.parse(JSON.stringify(o));
{ // (ก) ตัวย้ายเซฟ ทุกเลเวล 1–20 และเกิน Lv20
  for (let L = 1; L <= 20; L++) for (const f of [0, 0.01, 0.5, 0.99]) {
    const hi = L < 20 ? S.XP_TABLE[L + 1] : S.XP_TABLE[20] + S.MASTERY.xpPer, old = Math.floor(S.XP_TABLE[L] + f * (hi - S.XP_TABLE[L])), nw = S.xpStdV5(old, 'fish');
    if (L < 20) {
      assert.strictEqual(S.levelOf(nw, 'fish'), L, `เลเวลเดิม Lv${L} f=${f}`);
      const fo = (old - S.XP_TABLE[L]) / (S.XP_TABLE[L + 1] - S.XP_TABLE[L]), fn = (nw - S.XP_TABLE_STD[L]) / (S.XP_TABLE_STD[L + 1] - S.XP_TABLE_STD[L]);
      assert.ok(Math.abs(fo - fn) < 0.01, `สัดส่วนเดิม Lv${L} f=${f}: ${fo} vs ${fn}`);
    } else { assert.strictEqual(S.levelOf(nw, 'fish'), 20); assert.ok(Math.abs((nw - S.XP_TABLE_STD[20]) / S.masteryXp('fish') - f) < 0.01, 'เกิน Lv20 สัดส่วนดาวเดิม ' + f); }
  }
  for (const k of [1, 2.5]) { const nw = S.xpStdV5(S.XP_TABLE[20] + k * S.MASTERY.xpPer, 'fish'); assert.ok(Math.abs(nw - (S.XP_TABLE_STD[20] + k * 8000)) <= 1, 'ดาว ' + k); }
  for (const bad of [null, undefined, 0, 'x', [], {}, { xpv: 4, skills: null }, { xpv: 4, skills: { fish: 'abc' } }, { xpv: 4, skills: { farm: 5 } }]) assert.doesNotThrow(() => S.migrateStdV5(bad, ['fish']), JSON.stringify(bad));
  const r3 = { xpv: 4, skills: { farm: 5 } }; S.migrateStdV5(r3, ['fish']); assert.deepStrictEqual(r3.skills, { farm: 5 }, 'ไม่มี skills.fish ไม่สร้างให้'); assert.strictEqual(r3.xpv, 5);
  for (const v of [5, 6, 99]) { const rec = { xpv: v, skills: { fish: 9999 } }; assert.strictEqual(S.migrateStdV5(rec, ['fish']), false); assert.deepStrictEqual(rec, { xpv: v, skills: { fish: 9999 } }, 'xpv ' + v + ' ข้าม'); }
  const r4 = { xpv: 4, skills: { fish: 12345 } }; S.migrateStdV5(r4, ['fish']); const once = clone(r4); S.migrateStdV5(r4, ['fish']); assert.deepStrictEqual(r4, once, 'idempotent');
}
{ // โซ่ผ่าน server.js: xpv 1/2/3/4 → 5 ชาวประมงเท่านั้นถูกแปลง
  const lvXp = L => S.XP_TABLE[L] + 10;
  const players = {
    c4: { name: 'c4', xpv: 4, mig2: true, skills: { fish: lvXp(10), farm: lvXp(10), mine: 777, wood: 5 }, inv: { coin: 5, rod_3: 1 }, dur: { rod: 999 }, x: 10, y: 10 },
    c3: { name: 'c3', xpv: 3, mig2: true, skills: { fish: lvXp(10), farm: lvXp(10) }, inv: { coin: 5 }, x: 10, y: 10 },
    c2: { name: 'c2', xpv: 2, mig2: true, skills: { fish: 3000, farm: 3000 }, inv: { coin: 5 }, x: 10, y: 10 },
    c1: { name: 'c1', mig2: true, skills: { fish: 400, farm: 400 }, inv: { coin: 5 }, x: 10, y: 10 },
    c5: { name: 'c5', xpv: 5, mig2: true, skills: { fish: 12345, farm: 12345 }, inv: { coin: 5 }, x: 10, y: 10 },
    nos: { name: 'nos', xpv: 4, mig2: true, inv: { coin: 5 }, x: 10, y: 10 },
  };
  fs.writeFileSync(path.join(process.env.DATA_DIR, 'fishmig.json'), JSON.stringify({ players: clone(players), farm: {}, layout: 2 }));
  const w = new World('fishmig'), sv = w.saved;
  for (const k of Object.keys(players)) assert.strictEqual(sv[k].xpv, 7, k + ' xpv 7 (โซ่ 5 → 6 → 7 ต่อท้าย)');
  assert.strictEqual(S.levelOf(sv.c4.skills.fish, 'fish'), 10, 'c4 ชาวประมงเลเวลเดิม'); assert.strictEqual(sv.c4.skills.farm, S.xpStdV5(lvXp(10), 'farm'), 'ชาวนาแปลงที่ V7 (WP-20)'); assert.strictEqual(S.levelOf(sv.c4.skills.farm, 'farm'), 10);
  assert.strictEqual(sv.c4.skills.mine, 777); assert.strictEqual(sv.c4.skills.wood, S.xpStdV5(5, 'wood'), 'ช่างไม้แปลงที่ V7');
  assert.strictEqual(S.levelOf(sv.c3.skills.fish, 'fish'), 10, 'c3 (xpv 3 → 5)'); assert.strictEqual(sv.c3.skills.farm, S.xpStdV5(lvXp(10), 'farm'));
  assert.strictEqual(S.levelOf(sv.c2.skills.fish, 'fish'), S.levelOf(S.xpFromV2(3000)), 'c2 เลเวลเดิมตลอดโซ่'); assert.strictEqual(S.levelOf(sv.c1.skills.fish, 'fish'), S.levelOf(S.xpFromV2(S.xpFromV1(400))), 'c1 (ไม่มี xpv) เลเวลเดิมตลอดโซ่');
  assert.strictEqual(sv.c5.skills.fish, 12345, 'xpv 5 ไม่แตะ'); assert.strictEqual(sv.c5.skills.farm, S.xpStdV5(12345, 'farm'), 'xpv 5 → ชาวนาแปลงที่ V7'); assert.strictEqual(sv.nos.skills, undefined);
  assert.strictEqual(sv.c4.inv.rod_3, 1, 'คันเบ็ดไม่ถูกย้าย');
  w.dirty = true; w.save(true); const snap = clone(sv); assert.deepStrictEqual(clone(new World('fishmig').saved), snap, 'โหลดซ้ำไม่แปลงซ้ำ');
  // (ค) ความทนทานเบ็ด: เล่นเดิมที่ dur.rod เกินค่าสูงสุดใหม่ (dur 999 ในคัน 3 = สูงสุด 420) ไม่เสียหาย
  const ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }, p = new World('fishmig2').join(ws, 'zz', '#e74c3c').p, w2 = new World('fishmig3');
  p.rec.inv.rod_3 = 1; p.rec.dur = { rod: 99999 }; const wp = new World('fishmig4'); const pj = wp.join(ws, 'yy', '#e74c3c').p; pj.rec.inv.rod_3 = 1; pj.rec.dur = { rod: 99999 };
  assert.strictEqual(wp.durCur(pj, 'rod'), S.durMax('rod', 3, 0), 'dur เกินสูงสุด clamp เท่าสูงสุด'); assert.strictEqual(wp.durCur(pj, 'rod'), S.DURABILITY.rod.max[3]);
  pj.rec.dur.rod = 5; assert.strictEqual(wp.durCur(pj, 'rod'), 5, 'ค่าต่ำกว่าไม่แตะ'); delete pj.rec.dur; assert.strictEqual(wp.durCur(pj, 'rod'), S.DURABILITY.rod.max[3], 'ไม่มีค่า = เต็ม');
  assert.doesNotThrow(() => wp.durPub(pj));
}
{ // (ข) levelOf/xpFor + playLevel นับตารางใหม่
  assert.strictEqual(S.levelOf(1000, 'fish'), 4); assert.strictEqual(S.levelOf(1000, 'farm'), 4, 'ชาวนาใช้หลอดมาตรฐาน xpv 7'); assert.strictEqual(S.levelOf(1000), 2, 'ไม่ส่ง skill = ตารางเดิม');
  const base = S.playLevel({}), sk = { fish: S.XP_TABLE_STD[10] }; assert.strictEqual(S.playLevel(sk), base + 9, 'playLevel นับชาวประมงด้วย XP_TABLE_STD');
  assert.strictEqual(S.playLevel({ fish: S.XP_TABLE[10] }), base + S.levelOf(S.XP_TABLE[10], 'fish') - 1, 'XP ตารางเก่าให้เลเวลตามตารางใหม่');
  assert.strictEqual(S.playLevel({ farm: S.XP_TABLE_STD[10] }), base + 9, 'ชาวนาใช้หลอดมาตรฐาน xpv 7 (WP-20)');
}
{ // (ง) พักรอบปลาหายาก
  const ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }, w = new World('fishrare'), p = w.join(ws, 'rr', '#e74c3c').p;
  p.rec.skills = Object.assign(p.rec.skills || {}, { fish: S.XP_TABLE_STD[20] }); p.rec.inv.rod_7 = 1; p.rec.starter = Object.assign(p.rec.starter || {}, { final: true });
  const cheap = S.FISH.filter(f => f.id !== 'boot' && f.sell < S.RARE_SELL).sort((a, b) => b.sell - a.sell)[0], rare = S.FISH.filter(f => f.sell >= S.RARE_SELL).sort((a, b) => a.sell - b.sell)[0];
  assert.ok(cheap && rare && cheap.sell < S.RARE_SELL && rare.sell >= S.RARE_SELL, 'ตารางมีทั้งสองฝั่งเกณฑ์');
  p.rec.rareAt = 0; w.landFish(p, cheap, false, false, false); assert.ok(!p.rec.rareAt || p.rec.rareAt <= Date.now(), 'ปลา ' + cheap.sell + ' ต่ำกว่าเกณฑ์ ไม่ตั้งพัก');
  const t0 = Date.now(); w.landFish(p, rare, false, false, false); assert.ok(p.rec.rareAt >= t0 + S.rareCdMs(20) - 50 && p.rec.rareAt <= Date.now() + S.rareCdMs(20) + 50, 'ปลา ' + rare.sell + ' ตั้งพัก'); assert.ok(ws.msgs.some(m => /พักรอบ/.test(JSON.stringify(m))), 'แจ้งพักรอบ');
  // ระหว่างพัก ตกปลาไม่ออกปลา ≥ RARE_SELL (ทุกครั้ง); ไม่พัก = เป็นไปได้ที่ออก
  const T0 = 2e12, origRnd = Math.random; p.fish = null;
  const draw = () => { p.rec.inv.bait = 5; p.baitSel = 'bait'; w.castFish(p, 10, 10, T0, false, ''); p.fish.at = T0; w.tick(0.1, T0); Object.assign(p.fish, { c: 0.5, half: 0.2, per: 1000, gt0: T0 - 500, at: T0 + 4000 }); w.reelFish(p, T0); const f = p.fish && p.fish.pick; p.fish = null; return f; };
  p.rec.rareAt = Date.now() + 1e6; let n = 0, seen = new Set(); for (let i = 0; i < 150; i++) { const f = draw(); if (f) { n++; seen.add(f.id); assert.ok(f.sell < S.RARE_SELL, 'ระหว่างพักออกปลาแพง ' + f.id); } }
  assert.ok(n >= 100, 'ตกได้ปลาธรรมดาระหว่างพัก ' + n); assert.ok(seen.size >= 3, 'หลายชนิด');
  p.rec.rareAt = 0; let rareSeen = 0; for (let i = 0; i < 400; i++) { const f = draw(); if (f && f.sell >= S.RARE_SELL) rareSeen++; } assert.ok(rareSeen > 0, 'ไม่พัก ปลาหายากออกได้');
  p.fish = null; Math.random = origRnd;
}
{ // (จ) สระเลื่อน: เลเวลสูง ปลาใหม่ตกบ่อยกว่าปลาเก่า แต่ปลาเก่าไม่เป็นศูนย์
  const by = id => S.FISH.find(f => f.id === id), carp = by('carp'), nw = by('dragon');
  for (const [fl, rod] of [[17, 9], [20, 10], [14, 5]]) { const wc = S.fishWeight(carp, fl, rod, 1), wn = S.fishWeight(by('beaver'), fl, rod, 1); assert.ok(wc > 0, 'ปลาเก่าไม่เป็นศูนย์ fl' + fl); assert.ok(wc < carp.w, 'ปลาเก่าถูกลด'); assert.ok(wn >= 0); }
  const share = (f, fl, rod) => { const tot = S.fishPool(false).filter(g => g.lv <= fl).reduce((a, g) => a + S.fishWeight(g, fl, rod, 1), 0); return S.fishWeight(f, fl, rod, 1) / tot; };
  assert.ok(share(carp, 20, 10) < share(carp, 4, 3), 'สัดส่วนปลาตะเพียนลดลงเมื่อเลเวลสูง');
  const grp = (fl, rod, pred) => S.fishPool(false).filter(g => g.id !== 'boot' && g.lv <= fl && pred(g)).reduce((a, g) => a + share(g, fl, rod), 0);
  assert.ok(grp(20, 10, g => g.lv >= 18) > grp(10, 4, g => g.lv >= 8), 'ปลา 3 ระดับบนสุดตกบ่อยขึ้นเมื่อเลเวลสูง');
  for (const [g14, pts] of [[g => g.lv <= 9, [[10, 4], [12, 6], [15, 8], [18, 9], [20, 10]]], [g => g.lv <= 14, [[15, 8], [18, 9], [20, 10]]]]) { const sh = pts.map(([l, r]) => grp(l, r, g14)); for (let i = 1; i < sh.length; i++) assert.ok(sh[i] < sh[i - 1], 'สัดส่วนปลาเก่ากลุ่มเดียวกันลดลงตามเลเวล ' + sh.join(',')); } // เดิมเทียบ lv<=14 ที่ Lv20 กับ lv<=9 ที่ Lv15 (คนละกลุ่ม) ราคา/สระใหม่ทำให้ไม่ตรง จึงเทียบกลุ่มเดียวกัน
  assert.strictEqual(S.fishWeight(by('star'), 20, 10, 1) / by('star').w >= 1, true, 'ปลาใหม่สุดไม่ถูกลดน้ำหนัก');
  assert.strictEqual(S.fishPoolMul(carp, 1, 1), 1); assert.strictEqual(S.fishPoolMul(by('bass'), 3, 2), 1);
  assert.ok(S.fishPoolMul(carp, 20, 10) < S.fishPoolMul(by('koi'), 20, 10), 'ยิ่งเก่า ยิ่งลดมาก'); assert.ok(S.fishPoolMul(carp, 20, 10) > 0);
  void nw;
}
{ // (ฉ) invariants ของตาราง
  for (let L = 2; L <= 20; L++) assert.ok(S.XP_TABLE_STD[L] > S.XP_TABLE_STD[L - 1] || L === 2, 'XP_TABLE_STD เพิ่ม ' + L); assert.strictEqual(S.XP_TABLE_STD.length, S.MAX_LV + 1);
  for (let L = 3; L <= 20; L++) assert.ok(S.XP_TABLE_STD[L] - S.XP_TABLE_STD[L - 1] > S.XP_TABLE_STD[L - 1] - S.XP_TABLE_STD[L - 2] - 0, 'ช่วงต่อเลเวลโตขึ้น ' + L);
  for (const sea of [false, true]) {
    const set = S.FISH.filter(f => f.id !== 'boot' && !!f.sea === sea).sort((a, b) => a.lv - b.lv), tag = sea ? 'ทะเล' : 'น้ำจืด';
    assert.strictEqual(set.length, 20, tag + ' 20 ชนิด');
    for (let i = 1; i < set.length; i++) { assert.ok(set[i].sell >= set[i - 1].sell, `${tag}: ราคา ${set[i].id} < ${set[i - 1].id}`); assert.ok(set[i].xp >= set[i - 1].xp, `${tag}: XP ${set[i].id} < ${set[i - 1].id}`); assert.ok(set[i].lv > set[i - 1].lv, tag + ' เลเวลไม่ซ้ำ'); }
  }
  const rods = Object.keys(S.RODS).map(Number).filter(n => n >= 2); for (let i = 1; i < rods.length; i++) { const a = S.RODS[rods[i - 1]], b = S.RODS[rods[i]]; assert.ok(b.price > a.price && b.lv > a.lv, 'คัน ' + rods[i] + ' แพงกว่าและปลดช้ากว่า'); assert.ok(S.TOOL_PRICE.rod[rods[i]] > S.TOOL_PRICE.rod[rods[i - 1]]); assert.strictEqual(S.TOOL_PRICE.rod[rods[i]], b.price, 'ราคาในตารางเครื่องมือตรง RODS'); }
  for (let t = 2; t < S.DURABILITY.rod.max.length; t++) { assert.ok(S.DURABILITY.rod.max[t] > S.DURABILITY.rod.max[t - 1], 'ความทนทานเบ็ดเพิ่มตามระดับ ' + t); assert.ok(S.DURABILITY.rod.fix[t] > S.DURABILITY.rod.fix[t - 1], 'ค่าซ่อมเพิ่ม'); }
  const bs = Object.values(S.BAITS).sort((a, b) => a.price - b.price); for (let i = 1; i < bs.length; i++) { assert.ok(bs[i].price > bs[i - 1].price && (bs[i].lv || 0) >= (bs[i - 1].lv || 0), 'เหยื่อแพงขึ้นปลดช้าลง'); }
}
{ // (ช) levelsim --json: ชั่วโมงสะสมของชาวประมง
  const sim = JSON.parse(cp.execFileSync(process.execPath, [path.join(__dirname, 'levelsim.js'), '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 })), rows = sim.fish, EFF = 0.5;
  assert.strictEqual(rows.length, S.MAX_LV); let h = 0; const at = {};
  for (let lv = 1; lv < S.MAX_LV; lv++) { h += (S.xpFor(lv + 1, 'fish') - S.xpFor(lv, 'fish')) / (rows[lv - 1].xp * EFF); at[lv + 1] = h; }
  assert.ok(Math.abs(at[10] - 4.0) <= 0.4, 'ถึง Lv10 ≈ 4.0 ชม. ได้ ' + at[10].toFixed(2)); assert.ok(Math.abs(at[20] - 20) <= 2.0, 'ถึง Lv20 ≈ 20 ชม. ได้ ' + at[20].toFixed(2));
  assert.ok(Math.abs(S.xpFor(2, 'fish') / (rows[0].xp * EFF) - 0.25) <= 0.025, 'Lv1→2 ≈ 15 นาที');
}
{ // (ซ) ย้ายความทนทานเบ็ด xpv 4 → 5 คงสัดส่วน
  const mk = (rod, dur, fix) => ({ xpv: 4, skills: { fish: 100 }, inv: rod ? { ['rod_' + rod]: 1 } : { coin: 5 }, dur: dur == null ? undefined : { rod: dur }, fix: fix ? { rod: fix } : undefined });
  const oldD = (t, f) => Math.max(1, Math.floor(S.ROD_MIG6.oldMax[t] * (1 - S.REPAIR.decay * Math.min(S.REPAIR.maxFixes, f)))); // xpv 4→5 ให้ค่าตามตารางยุค xpv 5 (migrateToolsV6 แปลงต่อ)
  const mig = r => { S.migrateStdV5(r, S.STD_V5_SKILLS); return r; };
  let r = mig(mk(7, 560)); assert.strictEqual(r.dur.rod, oldD(7, 0), 'เต็มคงเต็ม');
  r = mig(mk(4, 140)); assert.strictEqual(r.dur.rod, oldD(4, 0) / 2, 'ครึ่งคงครึ่ง');
  r = mig(mk(5, 0)); assert.strictEqual(r.dur.rod, 0, 'พังคงพัง');
  r = mig(mk(3, 1)); assert.ok(r.dur.rod >= 1, 'เหลือนิดเดียวไม่กลายเป็นพัง');
  r = mig(mk(0, 100)); assert.strictEqual(r.dur.rod, oldD(1, 0), 'เบ็ดเริ่มต้นเต็มคงเต็ม');
  r = mig(mk(6, Math.floor(450 * 0.85), 1)); assert.strictEqual(r.dur.rod, oldD(6, 1), 'ซ่อมแล้วเต็มคงเต็ม');
  r = mig(mk(2, 140)); const once = r.dur.rod; S.migrateStdV5(r, S.STD_V5_SKILLS); assert.strictEqual(r.dur.rod, once, 'รันซ้ำไม่เปลี่ยน');
  assert.doesNotThrow(() => { mig({ xpv: 4 }); mig({ xpv: 4, dur: {} }); mig({ xpv: 4, dur: { rod: 50 } }); }, 'ไม่มี dur/inv ไม่พัง');
  r = mig({ xpv: 4, dur: { rod: 7 }, inv: { rod_2: 1 }, skills: { fish: 0 } }); assert.ok(r.dur.rod > 0);
  const rs = JSON.parse(JSON.stringify(mk(7, 560))); S.migrateStdV5(rs, ['mine']); assert.strictEqual(rs.dur.rod, 560, 'ไม่รวม fish ไม่แตะเบ็ด');
}
{ // (ฌ) rareCdMs: ค่าเริ่มต้น RARE_CD = ลดเชิงเส้น Lv10 → Lv20 / clamp
  assert.deepStrictEqual(S.RARE_CD, { from: 10, to: 20, endMul: 0.5 }); assert.strictEqual(S.RARE_CD_MS, 6 * 60 * 1000);
  for (let lv = 0; lv <= 10; lv++) assert.strictEqual(S.rareCdMs(lv), 6 * 60 * 1000, 'ก่อน/ที่ Lv10 พัก 6 นาที Lv' + lv);
  assert.strictEqual(S.rareCdMs(20), 3 * 60000); assert.strictEqual(S.rareCdMs(30), 3 * 60000, 'เกิน Lv20 ไม่ลดต่อ');
  for (let lv = 10; lv < 20; lv++) { assert.ok(S.rareCdMs(lv + 1) < S.rareCdMs(lv), 'ลดต่อเนื่อง Lv' + lv); assert.ok(Math.abs((S.rareCdMs(lv) - S.rareCdMs(lv + 1)) - 18000) <= 1, 'ลดเชิงเส้น 18 วินาที/เลเวล'); }
  for (const bad of [NaN, undefined, null, 'x', Infinity]) assert.strictEqual(S.rareCdMs(bad), S.RARE_CD_MS, 'ค่าเพี้ยน → ค่าเดิม');
  const cfg = { from: 10, to: 20, endMul: 0.5 };
  assert.strictEqual(S.rareCdMs(5, cfg), S.RARE_CD_MS); assert.strictEqual(S.rareCdMs(10, cfg), S.RARE_CD_MS);
  assert.strictEqual(S.rareCdMs(15, cfg), Math.round(S.RARE_CD_MS * 0.75)); assert.strictEqual(S.rareCdMs(20, cfg), S.RARE_CD_MS / 2); assert.strictEqual(S.rareCdMs(99, cfg), S.RARE_CD_MS / 2);
  assert.strictEqual(S.rareCdMs(20, { from: 10, to: 20, endMul: 1 }), S.RARE_CD_MS, 'endMul 1 = ไม่ลด');
  for (const c of [{ from: 10, to: 20, endMul: -3 }, { from: 20, to: 10, endMul: 0 }, { from: 5, to: 5, endMul: 0.2 }, { from: NaN, to: 1, endMul: 1 }]) for (let lv = 0; lv <= 30; lv++) { const v = S.rareCdMs(lv, c); assert.ok(Number.isFinite(v) && v >= 0, 'ไม่ติดลบ/ไม่ NaN'); }
}
{ // (ญ) ราคาปลา: regression เทียบ HEAD (ก่อนปรับ 7 พ.ย.) — ห้ามต่ำกว่า HEAD • ปลา >= 100 ต้องเท่า HEAD
  const HEAD_FRESH = { carp: 12, bass: 20, shrimp: 26, crab: 32, koi: 50, lobster: 55, squid: 65, octopus: 75, shark: 90, dolphin: 140, jelly: 210, beaver: 250, flamingo: 290, coral: 330, swan: 380, mermaid: 450, dragon: 520, sdragon: 600, unicorn: 700, star: 800 };
  const HEAD_SEA = { sardine: 15, anchovy: 19, mackerel: 25, snapper: 34, seabass: 48, tuna: 58, bonito: 68, barracuda: 78, puffer: 95, sword: 145, manta: 215, hammer: 245, turtle: 285, seal: 325, orca: 380, whaleshark: 450, bluewhale: 560, kraken: 620, angler: 710, pearl: 820 };
  const NEW_FRESH = [14, 22, 33, 41, 50, 60, 65, 75, 90], NEW_SEA = [15, 23, 34, 42, 52, 62, 68, 78, 95], NEW_XP = [9, 12, 16, 16, 16, 17, 20, 23, 27, 61, 138, 310, 411, 545, 724, 826, 943, 1076, 1267, 1491];
  const by = id => S.FISH.find(f => f.id === id), fresh = S.FISH.filter(f => !f.sea && f.id !== 'boot').sort((a, b) => a.lv - b.lv), sea = S.FISH.filter(f => f.sea).sort((a, b) => a.lv - b.lv);
  for (const [tbl, set, news] of [[HEAD_FRESH, fresh, NEW_FRESH], [HEAD_SEA, sea, NEW_SEA]]) {
    assert.deepStrictEqual(set.map(f => f.id), Object.keys(tbl), 'ชุดปลาเรียงตาม lv ตรงตาราง HEAD');
    for (const [id, h] of Object.entries(tbl)) { const f = by(id); assert.ok(f.sell >= h, `${id} ราคา ${f.sell} ต่ำกว่า HEAD ${h}`); if (h >= 100) assert.strictEqual(f.sell, h, `${id} (>=100) ต้องเท่า HEAD`); if (f.lv >= 10) assert.strictEqual(f.sell, h, id + ' lv>=10 เท่า HEAD'); }
    news.forEach((v, i) => assert.strictEqual(set[i].sell, v, 'ราคาใหม่ ' + set[i].id));
    set.forEach((f, i) => assert.strictEqual(f.xp, NEW_XP[i], 'XP ' + f.id));
  }
  assert.strictEqual(by('boot').sell, 1);
  // ปลาที่ราคาข้ามเส้น 60 = fishClass 2 → ต้องเบ็ด 2+ ; ที่ Lv ตกได้ต้องมีเบ็ดที่ซื้อได้ ณ เลเวลนั้น
  assert.strictEqual(S.fishClass(by('lobster')), 2); assert.strictEqual(S.fishClass(by('tuna')), 2); assert.strictEqual(S.fishClass(by('koi')), 1);
  assert.strictEqual(S.fishWeight(by('lobster'), 6, 1, 1), 0, 'เบ็ด 1 ตกกุ้งมังกรไม่ได้'); assert.ok(S.fishWeight(by('lobster'), 6, 2, 1) > 0); assert.ok(S.fishWeight(by('tuna'), 6, 2, 1) > 0);
  const bestRod = L => Object.keys(S.RODS).map(Number).filter(n => n === 1 || S.RODS[n].lv <= L).pop();
  assert.ok(S.RODS[2].lv <= 3 && 3 < 6, 'เบ็ด 2 ปลด Lv3 ก่อนกุ้งมังกร/ทูน่า (Lv6)');
  for (let L = 1; L <= 20; L++) for (const isSea of [false, true]) {
    const rod = bestRod(L), tot = S.fishPool(isSea).filter(f => f.id !== 'boot' && f.lv <= L).reduce((a, f) => a + S.fishWeight(f, L, rod, 1), 0);
    assert.ok(tot > 0, `Lv${L} ${isSea ? 'ทะเล' : 'น้ำจืด'} เบ็ด ${rod} ตกปลาไม่ได้เลย`);
    for (const f of S.fishPool(isSea).filter(g => g.id !== 'boot' && g.lv === L)) assert.ok(S.fishWeight(f, L, rod, 1) > 0, `Lv${L} ปลาประจำเลเวล ${f.id} ตกไม่ได้ด้วยเบ็ด ${rod} ที่ซื้อได้`);
  }
  // เบ็ด/เหยื่อใหม่
  assert.deepStrictEqual(S.TOOL_PRICE.rod, [0, 60, 250, 600, 1200, 2100, 3300, 4900, 6800, 9000, 11500], "ราคาคัน 10 ระดับ (WP-11)"); assert.strictEqual(S.RODS[6].price, 3300); assert.strictEqual(S.RODS[7].price, 4900); assert.strictEqual(S.RODS[10].price, 11500);
  assert.strictEqual(S.BAITS[2].price, 8); assert.strictEqual(S.BAITS[3].price, 25); assert.strictEqual(S.BAIT_PRICE, 2);
}
{ // (ฎ) ซิม: XP/ชม. ตามเส้น 1000×1.1412^(L−1) ±10% • ปลาหายาก/ชม.
  const sim = JSON.parse(cp.execFileSync(process.execPath, [path.join(__dirname, 'levelsim.js'), '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 })), rows = sim.fish, EFF = 0.5;
  for (let lv = 1; lv <= S.MAX_LV; lv++) { const goal = 1000 * Math.pow(1.1412, lv - 1), real = rows[lv - 1].xp * EFF; assert.ok(Math.abs(real / goal - 1) <= 0.10, `Lv${lv} XP/ชม. ${real.toFixed(0)} นอก ±10% ของ ${goal.toFixed(0)}`); }
  const rk = Object.keys(rows[0]).find(k => /rare/i.test(k)); assert.ok(rk, 'ซิมต้องรายงานอัตราปลาหายาก ได้ keys: ' + Object.keys(rows[0]));
  for (const r of rows) assert.ok(r[rk] <= 20.5, `ปลาหายาก/ชม. Lv${r.lv} = ${r[rk]} เกิน ~20`);
}
{ // (ฏ) ผลข้างเคียงราคา/XP: ขายคืนเบ็ด 70% • XP ปลาหายากไม่ข้ามหลายเลเวลต่อครั้ง • เกณฑ์ achievement/ออร์เดอร์
  for (let r = 2; r <= S.ROD_MAX; r++) { const v = S.sellbackValue('rod_' + r), price = S.TOOL_PRICE.rod[r]; assert.ok(v > 0 && v <= Math.round(price * 0.7) + 1 && v < price, `ขายคืนเบ็ด ${r}: ${v} จากราคา ${price}`); assert.ok(Math.abs(v - price * 0.7) <= 1, 'ขายคืน 70% ของราคาใหม่ เบ็ด ' + r); }
  // XP ต่อการตกหนึ่งครั้ง (สูงสุด: ชักสะอาด) ต้องน้อยกว่าช่วงเลเวลที่เลเวลต่ำสุดที่ตกปลานั้นได้ → ไม่ข้ามเลเวลเกิน 1
  const maxMul = S.FIGHT.cleanXp * Math.max(...S.FIGHT.xpMul);
  for (const f of S.FISH) { const m = f.xp * maxMul, L = Math.min(S.MAX_LV, f.lv); if (L < S.MAX_LV) assert.ok(m < S.XP_TABLE_STD[L + 1] - S.XP_TABLE_STD[L], `${f.id} XP ${m} ข้ามเลเวล Lv${L}`); }
  // ผ่าน server: ผู้เล่นอยู่ที่เลเวลของปลาพอดีและ XP ใกล้ถึงเลเวลถัดไป ตกปลาหายากได้ขึ้นเลเวลไม่เกิน 1 และ toast ขึ้นเลเวลเดียว
  const w = new World('fishxp');
  for (const f of S.FISH.filter(g => g.lv >= 10 && g.lv < S.MAX_LV)) {
    const ws = { readyState: 1, msgs: [], send(x) { this.msgs.push(JSON.parse(x)); } }, p = w.join(ws, 'x' + f.id, '#e74c3c').p;
    p.rec.skills = Object.assign(p.rec.skills || {}, { fish: S.XP_TABLE_STD[f.lv + 1] - 1 }); p.rec.rareAt = 0; const before = w.lv(p, 'fish'); assert.strictEqual(before, f.lv);
    w.landFish(p, f, false, false, true); const after = w.lv(p, 'fish'); assert.ok(after - before <= 1 && after >= before, `${f.id}: ${before} → ${after}`);
    const ups = ws.msgs.filter(m => /เลเวล \d+!/.test(JSON.stringify(m)) && /ชาวประมง/.test(JSON.stringify(m)) && m.t === 'toast'); assert.ok(ups.length <= 1, f.id + ' toast ขึ้นเลเวลซ้ำ');
    assert.ok(p.rec.rareAt > Date.now(), f.id + ' ตั้งพักรอบ'); assert.ok(p.rec.rareAt <= Date.now() + 6 * 60000 + 100);
  }
  assert.ok(S.FISH.some(f => f.id !== 'boot' && f.sell <= 90), 'ออร์เดอร์ NPC (<=90) ยังมีปลาให้ขาย');
}
console.log('test-fish-rework ผ่านทั้งหมด');
