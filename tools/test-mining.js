// ทดสอบสูตรขุดแร่ใหม่ (6 พ.ย. 2026): ต่ำกว่าแร่กี่ระดับก็ขุดได้แต่ช้า/สึกมาก (เพดาน maxHits) • แรงเกินแร่ไม่แตกครั้งเดียว + ได้ชิ้นเพิ่ม (ได้ XP) + สึกน้อยลง • ไม่มีถุงมือ/ค้อนแยก • ตั๋วลงชั้น (เพิ่มในเฟสถัดไป)
// รัน: node tools/test-mining.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-mining-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, T = S.T, M = S.MINE;

// 1) สูตรล้วน
{
  const hit = (inv, k, s) => S.mineHit(inv, k, s);
  assert.strictEqual(hit({}, 'stone', 0), null, 'ไม่มีอุปกรณ์ขุด');
  const a = hit({ pick_1: 1 }, 'stone', 0); assert.strictEqual(a.hits, S.oreHp('stone', 0), 'ถุงมือตีหินเล็ก ฟาดตาม HP'); assert.ok(!a.slow && a.wear === 1 && a.extra === 0);
  const sl = hit({ pick_1: 1 }, 'copper', 0); assert.ok(sl && sl.slow && sl.down === 1, 'ต่ำกว่า 1 ระดับ ขุดได้แต่ช้า'); assert.strictEqual(sl.hits, Math.ceil(S.oreHp('copper', 0) / M.slow.dmg - 1e-9), 'ดาเมจ ×0.85'); assert.ok(sl.wear === 1 + M.slow.wear, 'ช้ากว่าและสึกมากกว่า (1 + wear × ระดับ)');
  // ต่ำกว่าแร่กี่ระดับก็ขุดได้ (ไม่มีล็อกระดับอุปกรณ์แล้ว) แต่ยิ่งต่ำยิ่งช้า/สึกมาก และไม่เกินเพดาน MINE.maxHits
  assert.strictEqual(M.maxHits, 120); assert.ok(M.slow.dmg < 1 && M.slow.wear > 0);
  const my = hit({ pick_1: 1 }, 'mythril', 2); assert.ok(my && my.slow && my.down === 9, 'ถุงมือขุดมิทริลก้อนใหญ่ได้ (ต่ำกว่า 9 ระดับ)'); assert.ok(my.hits <= M.maxHits, 'ไม่เกินเพดาน ' + M.maxHits + ' ครั้ง ได้ ' + my.hits); assert.strictEqual(my.wear, 1 + M.slow.wear * 9);
  assert.strictEqual(my.hits, M.maxHits, 'ก้อนที่ช้าเกินเพดานถูกตัดที่ maxHits พอดี');
  for (let pk = 1; pk <= 10; pk++) for (const k of S.ORE_ORDER) for (let sz = 0; sz < 3; sz++) {
    const O = S.ORES[k], d = pk - O.pick, h = hit({ ['pick_' + pk]: 1 }, k, sz); assert.ok(h, `pick_${pk}/${k}/${sz} ต้องขุดได้`);
    assert.ok(h.hits >= M.minHits[sz] && h.hits <= M.maxHits, `pick_${pk}/${k}/${sz} ฟาด ${h.hits} อยู่ในช่วง ${M.minHits[sz]}–${M.maxHits}`);
    assert.strictEqual(h.slow, d < 0); assert.strictEqual(h.down, Math.max(0, -d)); assert.strictEqual(h.over, Math.max(0, d));
    if (d < 0) assert.ok(Math.abs(h.wear - (1 + M.slow.wear * -d)) < 1e-9 && h.extra === 0); else assert.ok(h.wear <= 1 && (d === 0 ? h.wear === 1 : h.wear < 1));
    if (pk > 1) { const lo = hit({ ['pick_' + (pk - 1)]: 1 }, k, sz); assert.ok(lo.hits >= h.hits, 'อุปกรณ์ต่ำกว่าไม่เร็วกว่า'); }
  }
  // ดาเมจต่อครั้ง (ก่อนโดน minHits/maxHits กำกับ) = power × dmg^|d| : ทองแดงก้อนใหญ่ (HP มาก ไม่โดน minHits) กับถุงมือ
  { const h = hit({ pick_1: 1 }, 'copper', 2); assert.ok(Math.abs(h.dmg - Math.max(M.slow.dmg, S.oreHp('copper', 2) / M.maxHits)) < 1e-9, 'ดาเมจ = power × 0.85^d'); }
  // แรงเกินแร่ไม่แตกครั้งเดียว: ทุกขนาดฟาดอย่างน้อย minHits
  for (const [pk, k] of [[10, 'stone'], [10, 'copper'], [7, 'silver'], [5, 'stone']]) for (let s = 0; s < 3; s++) { const h = hit({ ['pick_' + pk]: 1 }, k, s); assert.ok(h.hits >= M.minHits[s], `${pk}/${k}/${s} ฟาด ${h.hits} ต้อง ≥ ${M.minHits[s]}`); }
  const ov = hit({ pick_10: 1 }, 'stone', 0); assert.ok(ov.over === 9 && ov.extra === M.over.cap && ov.wear < 0.5, 'แรงเกินแร่ได้ชิ้นเพิ่มสูงสุดและสึกน้อย');
  // ไม่มีถุงมือ/ค้อนแยก: ตัวคูณเดิมหายไป ของเก่าในกระเป๋าไม่มีผล
  assert.strictEqual(S.gloveTier, undefined); assert.strictEqual(S.hammerTier, undefined); assert.strictEqual(S.GLOVES, undefined); assert.strictEqual(S.HAMMERS, undefined);
  assert.deepStrictEqual(hit({ pick_3: 1, glove_3: 1, hammer_3: 1 }, 'amethyst', 1), hit({ pick_3: 1 }, 'amethyst', 1), 'glove_*/hammer_* ไม่มีผลต่อการขุด');
  assert.ok(!S.SHOPS.mine.buy.some(x => /^(glove|hammer)_/.test(x))); assert.strictEqual(S.itemInfo('glove_1'), null);
  assert.strictEqual(S.oreXp(5, 20), 5, 'XP แร่ไม่คูณเลเวล'); assert.strictEqual(S.MINE.xpPerLv, undefined);
  assert.deepStrictEqual(S.ORE_ORDER.map(k => S.ORES[k].lv), [1, 3, 5, 7, 9, 11, 13, 15, 17, 19], 'ด่านเลเวลของแร่ยังอยู่');
}

// 2) เซิร์ฟเวอร์: ขุดช้า / ได้ชิ้นเพิ่ม / สึกตามตัวคูณ / บันทึก event
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('miningtest'), ws = mkWs(), a = w.join(ws, 'alice', '#e74c3c').p, ctr = (x, y) => [(x + 0.5) * TS, (y + 0.5) * TS];
w.sceneMates = () => []; a.scene = '@cave1'; a.rec.hunger = 100; a.rec.skills.mine = 99999; // เลเวลสูงสุด ตัดเรื่องเลเวลออก
const F = w.floorOf(1);
const setOre = (x, y, k, s) => { F.ores.set(x + ',' + y, { k, s }); F.map[y][x] = T.ORE; };
const act = (tx, ty) => { a.lastAct = a.hitAt = 0; w.handle(a, { t: 'act', tool: 'pick', tx, ty }); };
const spot = [...F.ores.keys()][0].split(',').map(Number); F.ores.clear(); F.hp.clear(); const [ox, oy] = spot; [a.x, a.y] = ctr(ox, oy + 1); a.dir = 1;
const CRIT = { p: M.crit.p }; M.crit.p = 0; // บล็อกเก่านับจำนวนครั้งฟาดแน่นอน จึงปิดคริไว้ก่อน (เทสต์คริอยู่ท้ายไฟล์)
{ // ถุงมือ vs ทองแดงเล็ก: ขุดได้แต่ช้า (ครั้งตามสูตร) และสึกเฉลี่ย ×1.5 ต่อก้อน (ต่ำ 1 ระดับ)
  a.rec.inv = { coin: 0, pick_1: 1 }; a.rec.dur = {}; setOre(ox, oy, 'copper', 0); const h0 = S.mineHit(a.rec.inv, 'copper', 0); let n = 0;
  while (F.ores.has(ox + ',' + oy) && n < 200) { act(ox, oy); n++; }
  assert.strictEqual(n, h0.hits, `ฟาด ${n} ครั้ง = ตามสูตร ${h0.hits}`); assert.ok(a.rec.inv.copper >= 1, 'ได้ทองแดง');
  assert.ok(ws.msgs.some(m => m.t === 'msg' && /ขุดได้แต่ช้า/.test(m.text || '')), 'บอกผู้เล่นว่าขุดช้าเพราะอุปกรณ์ต่ำกว่า');
  // เทียบกับอุปกรณ์พอดีแร่ (จอบไม้ vs ทองแดง) จำนวนก้อนเท่ากัน: ต่ำกว่า 1 ระดับ สึกมากกว่า ~1.5 เท่า (ความร้อนจากการใช้ถี่คูณเท่ากันทั้งคู่)
  const K = 30, kills = pk => { a.rec.inv = { coin: 0, ['pick_' + pk]: 1 }; a.rec.dur = {}; a.heat = {}; const mx = w.durMx(a, 'pick'); for (let i = 0; i < K; i++) { setOre(ox, oy, 'copper', 0); let c = 0; while (F.ores.has(ox + ',' + oy) && c < 200) { act(ox, oy); c++; } } return mx - w.durCur(a, 'pick'); };
  const slowLost = kills(1), evenLost = kills(2); assert.ok(slowLost >= K && evenLost >= K, 'สึกอย่างน้อย 1 ต่อก้อน'); assert.ok(slowLost >= evenLost * 1.2, `ต่ำกว่าแร่สึกมากกว่า (ช้า ${slowLost} vs พอดี ${evenLost})`);
}
{ // ถุงมือขุดมิทริล (ต่ำ 9 ระดับ): ยังขุดได้ ไม่เกินเพดาน 120 ครั้ง
  a.rec.inv = { coin: 0, pick_1: 1 }; a.rec.dur = {}; setOre(ox, oy, 'mythril', 2); let n = 0; while (F.ores.has(ox + ',' + oy) && n < 400) { act(ox, oy); n++; }
  assert.ok(!F.ores.has(ox + ',' + oy) && n <= M.maxHits, 'ขุดมิทริลก้อนใหญ่ด้วยถุงมือได้ใน ≤ maxHits (ใช้ ' + n + ')'); assert.ok(a.rec.inv.mythril >= 1);
}
{ // ระเบิด (pick_10) vs หินเล็ก: ไม่แตกครั้งเดียว (≥ 3 ครั้ง) และบางครั้งได้ชิ้นเพิ่ม
  a.rec.inv = { coin: 0, pick_10: 1 }; a.rec.dur = {}; let max = 0, min = 99, extra = 0;
  for (let i = 0; i < 80; i++) { setOre(ox, oy, 'stone', 0); const b = a.rec.inv.stone || 0; let n = 0; while (F.ores.has(ox + ',' + oy) && n < 50) { act(ox, oy); n++; } max = Math.max(max, n); min = Math.min(min, n); if ((a.rec.inv.stone || 0) - b > S.ORE_SIZES[0].drop[1]) extra++; }
  assert.ok(min >= 3, 'แรงแค่ไหนก็ฟาด ≥ 3 ครั้ง (ต่ำสุด ' + min + ')'); assert.ok(extra > 0, 'มีบางก้อนได้ชิ้นเพิ่มจากอุปกรณ์แรงเกินแร่');
}
{ // ชิ้นโบนัสได้ XP ด้วย: XP = XP แร่ × (ชิ้นปกติ + โบนัส) • ไม่คูณเลเวล
  a.rec.book = { ore: { stone: 1 } }; a.rec.inv = { coin: 0, pick_10: 1 }; a.rec.dur = {};
  const run = r => { const rnd = Math.random; Math.random = () => r; try { a.rec.skills.mine = 20000; a.rec.inv.stone = 0; setOre(ox, oy, 'stone', 0); let n = 0; while (F.ores.has(ox + ',' + oy) && n < 60) { act(ox, oy); n++; } } finally { Math.random = rnd; } return { got: a.rec.inv.stone, gain: a.rec.skills.mine - 20000 }; };
  const lo = S.ORE_SIZES[0].drop[0], bon = run(0), nob = run(0.999);
  assert.strictEqual(bon.got, lo + 1, 'บังคับสุ่มต่ำสุด = ชิ้นปกติ ' + lo + ' + โบนัส 1'); assert.ok(nob.got > lo, 'ไม่ได้โบนัส (ได้ ' + nob.got + ')');
  assert.strictEqual(bon.gain, Math.round(S.ORES.stone.xp * bon.got), 'XP นับชิ้นโบนัสด้วย ได้ ' + bon.gain); assert.strictEqual(nob.gain, Math.round(S.ORES.stone.xp * nob.got), 'XP ไม่คูณเลเวล (Lv ' + S.levelOf(20000, 'mine') + ')');
}
{ // ค้นพบแร่ใหม่ครั้งแรก: โบนัส XP + สมุดแร่ (ครั้งที่สองไม่ซ้ำ)
  a.rec.book = {}; a.rec.inv = { coin: 0, pick_1: 1 }; a.rec.dur = {}; const xp0 = a.rec.skills.mine || 0; setOre(ox, oy, 'stone', 0); let n = 0; while (F.ores.has(ox + ',' + oy) && n < 50) { act(ox, oy); n++; }
  assert.ok(w.bookOf(a).ore.stone, 'สมุดแร่จดหินแล้ว'); const gain1 = (a.rec.skills.mine || 0) - xp0; assert.ok(gain1 >= Math.round(S.ORES.stone.xp * M.discover), 'ได้ XP โบนัสค้นพบ ' + gain1);
  const xp1 = a.rec.skills.mine; setOre(ox, oy, 'stone', 0); n = 0; while (F.ores.has(ox + ',' + oy) && n < 50) { act(ox, oy); n++; } assert.ok((a.rec.skills.mine - xp1) < Math.round(S.ORES.stone.xp * M.discover), 'ก้อนที่สองไม่ได้โบนัสซ้ำ');
  assert.strictEqual(S.BOOK.ore.ids.length, 10); assert.strictEqual(S.bookInfo('ore', 'copper').name, 'ทองแดง');
}
{ // ตั๋วลงเหมือง: ต้องเคยเดินลงถึงชั้นนั้นเอง จ่ายตามตาราง ลงตรงไปชั้นนั้น เงินจมล้วน
  const wb = mkWs(), b = w.join(wb, 'bob', '#3498db').p; const LX = (S.MINE.lift.x + 0.5) * S.TS, LY = (S.MINE.lift.y + 0.5) * S.TS; b.x = LX; b.y = LY; w.nearShopKind = () => 'farm'; b.rec.inv.coin = 10000; b.scene = null;
  w.mineTicket(b, 3); assert.strictEqual(b.rec.inv.coin, 10000, 'ยังไม่เคยลงถึงชั้น 3 ซื้อไม่ได้'); assert.strictEqual(b.scene, null);
  b.rec.deep = 3; w.mineTicket(b, 4); assert.strictEqual(b.rec.inv.coin, 10000, 'ชั้นลึกกว่าที่เคยลง ซื้อไม่ได้');
  w.mineTicket(b, 1); assert.strictEqual(b.rec.inv.coin, 10000, 'ชั้น 1 ไม่ต้องใช้ตั๋ว');
  w.mineTicket(b, 3); assert.strictEqual(b.scene, '@cave3', 'ลงตรงไปชั้น 3'); assert.strictEqual(b.rec.inv.coin, 10000 - S.MINE.fee[3], 'จ่ายตามตาราง');
  w.mineTicket(b, 2); assert.strictEqual(b.rec.inv.coin, 10000 - S.MINE.fee[3], 'อยู่ในถ้ำแล้วซื้อตั๋วไม่ได้');
  b.scene = null; b.rec.inv.coin = S.MINE.fee[3] - 1; w.mineTicket(b, 3); assert.strictEqual(b.scene, null, 'เหรียญไม่พอ ไม่ลง');
  b.rec.inv.coin = 99999; b.x = LX + S.MINE.lift.range + 5; w.nearShopKind = () => 'mine'; w.mineTicket(b, 3); assert.strictEqual(b.scene, null, 'ใกล้แต่ร้านช่างเหมือง ไม่ใช่ลิฟต์ ซื้อไม่ได้'); assert.strictEqual(b.rec.inv.coin, 99999); b.x = LX; assert.ok(S.nearLift(LX, LY) && !S.nearLift(0, 0) && !S.nearLift(NaN, LY));
  // เดินลงถึงชั้นใหม่เอง = จำชั้นลึกสุด
  b.scene = null; w.enterCave(b); w.caveMove(b, 1, 2); assert.strictEqual(b.rec.deep, 3, 'ชั้น 2 ตื้นกว่า deep เดิมไม่ลด'); w.caveMove(b, 3, 4); assert.strictEqual(b.rec.deep, 4, 'ลงถึงชั้น 4 จำเป็นชั้นลึกสุดใหม่');
  assert.strictEqual(S.MINE.fee.length, S.MINE.floors + 1); for (let f = 3; f <= S.MINE.floors; f++) assert.ok(S.MINE.fee[f] > S.MINE.fee[f - 1], 'ราคาตั๋วเพิ่มตามความลึก');
}
{ // ตีติด Critical: ดาเมจ ×mul หลังเพดาน minHits • ส่ง oh d/c • ครั้งแตกส่ง oh f:0 ก่อน ore • ไม่มี toast "อีก N ครั้ง" • โอกาสมาจาก S.MINE.crit.p
  assert.deepStrictEqual(CRIT, { p: 0.15 }); assert.strictEqual(M.crit.mul, 3); M.crit.p = CRIT.p;
  const rnd = Math.random, key = ox + ',' + oy, sb = w.sceneBroadcast; w.sceneBroadcast = (sc, m) => ws.msgs.push(m); // sceneMates ถูกสแตบเป็นว่าง จึงดักข้อความฉากเอง
  a.rec.inv = { coin: 0, pick_1: 1 }; a.rec.dur = {}; a.rec.book = { ore: { copper: 1 } };
  const mh = S.mineHit(a.rec.inv, 'copper', 2), full = S.oreHp('copper', 2), ohs = () => ws.msgs.filter(m => m.t === 'oh' && m.x === ox && m.y === oy);
  try {
    // ไม่คริแน่นอน (สุ่ม 0.99 ≥ p): ดาเมจปกติ ไม่มี c
    Math.random = () => 0.99; setOre(ox, oy, 'copper', 2); F.hp.clear(); ws.msgs.length = 0; act(ox, oy);
    let m = ohs().pop(); assert.ok(m && m.c === undefined && m.d === +mh.dmg.toFixed(1), 'ไม่คริ: d = ดาเมจปกติ ไม่มี c'); assert.ok(Math.abs(F.hp.get(key).hp - (full - mh.dmg)) < 1e-9);
    // คริแน่นอน (สุ่ม 0 < p): ดาเมจ ×3 HP ลดตามนั้น
    Math.random = () => 0; setOre(ox, oy, 'copper', 2); F.hp.clear(); ws.msgs.length = 0; act(ox, oy);
    m = ohs().pop(); assert.strictEqual(m.c, 1, 'คริ: c = 1'); assert.strictEqual(m.d, +(mh.dmg * M.crit.mul).toFixed(1), 'คริ: d = ดาเมจ ×3'); assert.ok(Math.abs(F.hp.get(key).hp - (full - mh.dmg * M.crit.mul)) < 1e-9, 'HP ลด ×3');
    assert.strictEqual(m.f, +(F.hp.get(key).hp / full).toFixed(2));
    assert.ok(!ws.msgs.some(z => z.t === 'msg' && /อีก \d+ ครั้ง/.test(z.text || '')), 'ไม่มี toast อีก N ครั้งแล้ว');
    // โอกาสตั้งจาก S.MINE.crit.p: สุ่ม 0.5 ไม่คริเมื่อ p=0.15 แต่คริเมื่อ p=0.9
    Math.random = () => 0.5; M.crit.p = 0.9; setOre(ox, oy, 'copper', 2); F.hp.clear(); ws.msgs.length = 0; act(ox, oy); assert.strictEqual(ohs().pop().c, 1, 'p=0.9 สุ่ม 0.5 คริ'); M.crit.p = CRIT.p;
    setOre(ox, oy, 'copper', 2); F.hp.clear(); ws.msgs.length = 0; act(ox, oy); assert.strictEqual(ohs().pop().c, undefined, 'p=0.15 สุ่ม 0.5 ไม่คริ');
    // ครั้งตีแตกด้วยคริ: ก้อนเล็กอาจแตกครั้งเดียว (ดาเมจคริคูณหลังเพดาน minHits) ส่ง oh f:0 ก่อน ore k:'' และบันทึก cr
    Math.random = () => 0; a.rec.inv = { coin: 0, pick_10: 1 }; a.rec.dur = {}; setOre(ox, oy, 'stone', 0); F.hp.clear(); ws.msgs.length = 0; let n = 0; while (F.ores.has(key) && n < 50) { act(ox, oy); n++; }
    assert.ok(n < M.minHits[0], 'คริทุกครั้งทำให้แตกไวกว่า minHits (ฟาด ' + n + ')');
    const i1 = ws.msgs.findIndex(z => z.t === 'oh' && z.x === ox && z.y === oy && z.f === 0), i2 = ws.msgs.findIndex(z => z.t === 'ore' && z.x === ox && z.y === oy && z.k === '');
    assert.ok(i1 >= 0 && i2 > i1, 'oh f:0 มาก่อน ore ที่ลบก้อน'); assert.strictEqual(ws.msgs[i1].c, 1); assert.ok(ws.msgs[i1].d > 0);
  } finally { Math.random = rnd; M.crit.p = 0; w.sceneBroadcast = sb; }
}
{ // บันทึก event ขุด (เขียนไฟล์ events/วันที่.jsonl)
  setOre(ox, oy, 'stone', 0); a.rec.inv = { coin: 0, pick_1: 1 }; a.rec.dur = {}; let n = 0; while (F.ores.has(ox + ',' + oy) && n < 50) { act(ox, oy); n++; }
  const dir = path.join(process.env.DATA_DIR, 'events'), t0 = Date.now();
  const readMine = () => { try { return fs.readdirSync(dir).flatMap(f => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))).filter(e => e.e === 'mine'); } catch (e) { return []; } };
  const poll = () => { // รอ appendFile เขียนเสร็จ (สูงสุด 3 วินาที) แล้วหา event ของก้อนที่เพิ่งขุดนี้ ไม่พึ่งลำดับบรรทัดท้าย
    const lines = readMine(), ev = lines.find(e => e.k === 'stone' && e.pk === 1 && e.slow === 0 && e.hits >= 1);
    if (!ev && Date.now() - t0 < 3000) return setTimeout(poll, 50);
    assert.ok(lines.length >= 1 && ev, 'event mine ครบข้อมูล');
    console.log('ผ่าน test-mining'); process.exit(0);
  };
  setTimeout(poll, 50);
}
