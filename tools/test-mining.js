// ทดสอบสูตรขุดแร่ใหม่ (6 พ.ย. 2026): ต่ำกว่าแร่ 1 ระดับขุดได้แต่ช้า • แรงเกินแร่ไม่แตกครั้งเดียว + ได้ชิ้นเพิ่ม + สึกน้อยลง • ถุงมือ/ค้อน • ตั๋วลงชั้น (เพิ่มในเฟสถัดไป)
// รัน: node tools/test-mining.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-mining-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, T = S.T, M = S.MINE;

// 1) สูตรล้วน
{
  const hit = (inv, k, s) => S.mineHit(inv, k, s);
  assert.strictEqual(hit({}, 'stone', 0), null, 'ไม่มีอีเต้อ');
  const a = hit({ pick_1: 1 }, 'stone', 0); assert.strictEqual(a.hits, S.oreHp('stone', 0), 'อีเต้อไม้ตีหินเล็ก ฟาดตาม HP (เหมือนเดิม)'); assert.ok(!a.slow && a.wear === 1 && a.extra === 0);
  const sl = hit({ pick_1: 1 }, 'copper', 0); assert.ok(sl && sl.slow, 'ต่ำกว่า 1 ระดับ ขุดได้แต่ช้า'); assert.ok(sl.hits >= S.oreHp('copper', 0) * 1.9 && sl.wear === M.slow.wear, 'ช้า ~2 เท่าและสึก ×2');
  assert.strictEqual(hit({ pick_1: 1 }, 'amethyst', 0), null, 'ต่ำกว่า 2 ระดับยังล็อก');
  // แรงเกินแร่ไม่แตกครั้งเดียว: ทุกขนาดฟาดอย่างน้อย minHits
  for (const [pk, k] of [[6, 'stone'], [6, 'copper'], [5, 'silver'], [4, 'stone']]) for (let s = 0; s < 3; s++) { const h = hit({ ['pick_' + pk]: 1, hammer_3: 1, glove_3: 1 }, k, s); assert.ok(h.hits >= M.minHits[s], `${pk}/${k}/${s} ฟาด ${h.hits} ต้อง ≥ ${M.minHits[s]}`); }
  const ov = hit({ pick_6: 1 }, 'stone', 0); assert.ok(ov.over === 5 && ov.extra === M.over.cap && ov.wear < 0.5, 'แรงเกินแร่ได้ชิ้นเพิ่มสูงสุดและสึกน้อย');
  // ถุงมือ: ดาเมจเพิ่ม/สึกลด • ค้อนช่วยเฉพาะก้อนกลาง/ใหญ่
  const base = hit({ pick_3: 1 }, 'amethyst', 1), gl = hit({ pick_3: 1, glove_2: 1 }, 'amethyst', 1), hm = hit({ pick_3: 1, hammer_2: 1 }, 'amethyst', 1);
  assert.ok(gl.dmg > base.dmg && gl.wear < base.wear, 'ถุงมือดีขึ้น'); assert.ok(hm.dmg > base.dmg && hm.wear === base.wear, 'ค้อนเพิ่มดาเมจกับก้อนกลาง');
  assert.strictEqual(hit({ pick_3: 1, hammer_3: 1 }, 'amethyst', 0).dmg, hit({ pick_3: 1 }, 'amethyst', 0).dmg, 'ค้อนไม่ช่วยก้อนเล็ก');
  assert.ok(S.itemInfo('glove_3').once && S.itemInfo('hammer_3').once && S.SHOPS.mine.buy.includes('glove_1') && S.SHOPS.mine.buy.includes('hammer_3'), 'มีขายที่ร้านช่างเหมือง');
  assert.strictEqual(S.gloveTier({ glove_1: 1, glove_2: 1 }), 2); assert.strictEqual(S.hammerTier({}), 0);
}

// 2) เซิร์ฟเวอร์: ขุดช้า / ได้ชิ้นเพิ่ม / สึกตามตัวคูณ / บันทึก event
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('miningtest'), ws = mkWs(), a = w.join(ws, 'alice', '#e74c3c').p, ctr = (x, y) => [(x + 0.5) * TS, (y + 0.5) * TS];
w.sceneMates = () => []; a.scene = '@cave1'; a.rec.hunger = 100; a.rec.skills.mine = 99999; // เลเวลสูงสุด ตัดเรื่องเลเวลออก
const F = w.floorOf(1);
const setOre = (x, y, k, s) => { F.ores.set(x + ',' + y, { k, s }); F.map[y][x] = T.ORE; };
const act = (tx, ty) => { a.lastAct = a.hitAt = 0; w.handle(a, { t: 'act', tool: 'pick', tx, ty }); };
const spot = [...F.ores.keys()][0].split(',').map(Number); F.ores.clear(); F.hp.clear(); const [ox, oy] = spot; [a.x, a.y] = ctr(ox, oy + 1); a.dir = 1;
{ // อีเต้อไม้ vs ทองแดงเล็ก: ขุดได้แต่ช้า (24 ครั้ง) และสึกเป็น 2 เท่าของปกติ
  a.rec.inv = { coin: 0, pick_1: 1 }; a.rec.dur = {}; setOre(ox, oy, 'copper', 0); const h0 = S.mineHit(a.rec.inv, 'copper', 0); let n = 0;
  while (F.ores.has(ox + ',' + oy) && n < 200) { act(ox, oy); n++; }
  assert.strictEqual(n, h0.hits, `ฟาด ${n} ครั้ง = ตามสูตร ${h0.hits}`); assert.ok(a.rec.inv.copper >= 1, 'ได้ทองแดง');
  const mx = w.durMx(a, 'pick'), lost = mx - w.durCur(a, 'pick'); assert.ok(lost >= 2, 'ต่ำกว่าแร่ สึก ≥ 2 หน่วยต่อก้อน (ได้ ' + lost + ')');
  assert.ok(ws.msgs.some(m => m.t === 'msg' && /ขุดได้แต่ช้า/.test(m.text || '')), 'บอกผู้เล่นว่าขุดช้าเพราะอีเต้อต่ำกว่า');
}
{ // อีเต้อเพชร vs หินเล็ก: ไม่แตกครั้งเดียว (≥ 3 ครั้ง) และบางครั้งได้ชิ้นเพิ่ม
  a.rec.inv = { coin: 0, pick_6: 1 }; a.rec.dur = {}; let max = 0, min = 99, extra = 0;
  for (let i = 0; i < 80; i++) { setOre(ox, oy, 'stone', 0); const b = a.rec.inv.stone || 0; let n = 0; while (F.ores.has(ox + ',' + oy) && n < 50) { act(ox, oy); n++; } max = Math.max(max, n); min = Math.min(min, n); if ((a.rec.inv.stone || 0) - b > S.ORE_SIZES[0].drop[1]) extra++; }
  assert.ok(min >= 3, 'แรงแค่ไหนก็ฟาด ≥ 3 ครั้ง (ต่ำสุด ' + min + ')'); assert.ok(extra > 0, 'มีบางก้อนได้ชิ้นเพิ่มจากอีเต้อแรงเกินแร่');
}
{ // ค้นพบแร่ใหม่ครั้งแรก: โบนัส XP + สมุดแร่ (ครั้งที่สองไม่ซ้ำ)
  a.rec.book = {}; a.rec.inv = { coin: 0, pick_1: 1 }; a.rec.dur = {}; const xp0 = a.rec.skills.mine || 0; setOre(ox, oy, 'stone', 0); let n = 0; while (F.ores.has(ox + ',' + oy) && n < 50) { act(ox, oy); n++; }
  assert.ok(w.bookOf(a).ore.stone, 'สมุดแร่จดหินแล้ว'); const gain1 = (a.rec.skills.mine || 0) - xp0; assert.ok(gain1 >= Math.round(S.ORES.stone.xp * M.discover), 'ได้ XP โบนัสค้นพบ ' + gain1);
  const xp1 = a.rec.skills.mine; setOre(ox, oy, 'stone', 0); n = 0; while (F.ores.has(ox + ',' + oy) && n < 50) { act(ox, oy); n++; } assert.ok((a.rec.skills.mine - xp1) < Math.round(S.ORES.stone.xp * M.discover), 'ก้อนที่สองไม่ได้โบนัสซ้ำ');
  assert.strictEqual(S.BOOK.ore.ids.length, 10); assert.strictEqual(S.bookInfo('ore', 'copper').name, 'ทองแดง');
}
{ // ตั๋วลงเหมือง: ต้องเคยเดินลงถึงชั้นนั้นเอง จ่ายตามตาราง ลงตรงไปชั้นนั้น เงินจมล้วน
  const wb = mkWs(), b = w.join(wb, 'bob', '#3498db').p; w.nearShopKind = () => 'mine'; b.rec.inv.coin = 10000; b.scene = null;
  w.mineTicket(b, 3); assert.strictEqual(b.rec.inv.coin, 10000, 'ยังไม่เคยลงถึงชั้น 3 ซื้อไม่ได้'); assert.strictEqual(b.scene, null);
  b.rec.deep = 3; w.mineTicket(b, 4); assert.strictEqual(b.rec.inv.coin, 10000, 'ชั้นลึกกว่าที่เคยลง ซื้อไม่ได้');
  w.mineTicket(b, 1); assert.strictEqual(b.rec.inv.coin, 10000, 'ชั้น 1 ไม่ต้องใช้ตั๋ว');
  w.mineTicket(b, 3); assert.strictEqual(b.scene, '@cave3', 'ลงตรงไปชั้น 3'); assert.strictEqual(b.rec.inv.coin, 10000 - S.MINE.fee[3], 'จ่ายตามตาราง');
  w.mineTicket(b, 2); assert.strictEqual(b.rec.inv.coin, 10000 - S.MINE.fee[3], 'อยู่ในถ้ำแล้วซื้อตั๋วไม่ได้');
  b.scene = null; b.rec.inv.coin = S.MINE.fee[3] - 1; w.mineTicket(b, 3); assert.strictEqual(b.scene, null, 'เหรียญไม่พอ ไม่ลง');
  b.rec.inv.coin = 99999; w.nearShopKind = () => 'farm'; w.mineTicket(b, 3); assert.strictEqual(b.scene, null, 'ต้องยืนใกล้ร้านช่างเหมือง'); w.nearShopKind = () => 'mine';
  // เดินลงถึงชั้นใหม่เอง = จำชั้นลึกสุด
  b.scene = null; w.enterCave(b); w.caveMove(b, 1, 2); assert.strictEqual(b.rec.deep, 3, 'ชั้น 2 ตื้นกว่า deep เดิมไม่ลด'); w.caveMove(b, 3, 4); assert.strictEqual(b.rec.deep, 4, 'ลงถึงชั้น 4 จำเป็นชั้นลึกสุดใหม่');
  assert.strictEqual(S.MINE.fee.length, S.MINE.floors + 1); for (let f = 3; f <= S.MINE.floors; f++) assert.ok(S.MINE.fee[f] > S.MINE.fee[f - 1], 'ราคาตั๋วเพิ่มตามความลึก');
}
{ // บันทึก event ขุด (เขียนไฟล์ events/วันที่.jsonl)
  setOre(ox, oy, 'stone', 0); a.rec.inv = { coin: 0, pick_1: 1, glove_1: 1 }; a.rec.dur = {}; let n = 0; while (F.ores.has(ox + ',' + oy) && n < 50) { act(ox, oy); n++; }
  setTimeout(() => {
    const dir = path.join(process.env.DATA_DIR, 'events'); const lines = fs.readdirSync(dir).flatMap(f => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))).filter(e => e.e === 'mine');
    assert.ok(lines.length >= 1 && lines[lines.length - 1].k === 'stone' && lines[lines.length - 1].gl === 1 && lines[lines.length - 1].hits >= 1, 'event mine ครบข้อมูล');
    console.log('ผ่าน test-mining'); process.exit(0);
  }, 300);
}
