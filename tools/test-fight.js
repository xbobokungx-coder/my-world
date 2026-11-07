// ทดสอบชักเย่อกับปลา: โมเดลล้วน (ทั้งสองฝั่งใช้ชุดเดียวกัน) + ขั้นตอนบนเซิร์ฟเวอร์ (ตั้งเบ็ด → ชักเย่อ → ชนะ/สายขาด/ปลาหลุด/ดึงเร็วไปคืนเหยื่อ)
// รัน: node tools/test-fight.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-fight-');
const { World } = require('../server.js'), S = require('../public/shared.js'), F = S.FIGHT;

// บอทมือคน: กรอจนตึง ~72 แล้วปล่อยจนเหลือ ~48 • เห็นเตือนกระชากก็ปล่อยก่อน • ช้าตามเวลาตอบสนอง react ms
function play(cls, rod, perk, perfect, react, seed, policy) {
  const rnd = S.rng(seed), f = S.fightNew(cls, rod, perk, perfect, rnd); let hold = false, pend = null, t = 0;
  while (!f.end && t < 30000) {
    const ph = S.fightPhase(f); let want;
    if (policy === 'holdall') want = true; else if (policy === 'none') want = false;
    else {
      const ns = f.sched.find(([at, d]) => f.t < at + d), until = ns ? ns[0] - f.t : 1e9;
      if (ph === 'surge') want = false; else if (until < F.warnMs + 250 && f.ten > 30) want = false; else if (ph === 'warn') want = f.ten < 30; else if (hold) want = f.ten < 72; else want = f.ten < 48;
    }
    if (want !== hold && (pend === null || pend.v !== want)) pend = { v: want, at: t + react * (0.6 + 0.8 * rnd()) };
    if (want === hold) pend = null;
    if (pend && t >= pend.at) { hold = pend.v; pend = null; }
    S.fightStep(f, 25, hold); t += 25;
  }
  return f;
}
const rate = (cls, rod, perk, perfect, react, policy, n = 300) => { let w = 0; for (let i = 0; i < n; i++) if (play(cls, rod, perk, perfect, react, i * 31 + cls, policy).end === 'win') w++; return w / n; };

// 1) โมเดล: เหมือนเดิมทุกครั้งที่ใส่ค่าเท่ากัน • ปลาเล็กไม่กระชาก ปลาแพงกระชากตามกลุ่ม
{
  const a = S.fightNew(3, 3, 1, false, S.rng(7)), b = S.fightNew(3, 3, 1, false, S.rng(7));
  for (let i = 0; i < 200; i++) { S.fightStep(a, 40, i % 7 < 4); S.fightStep(b, 40, i % 7 < 4); }
  assert.deepStrictEqual(a, b, 'ค่าเท่ากัน ผลเท่ากัน (เว็บทำนายตรงกับเซิร์ฟเวอร์)');
  assert.strictEqual(S.fightNew(0, 1, 1, false, S.rng(1)).sched.length, 0); assert.strictEqual(S.fightNew(1, 1, 1, false, S.rng(1)).sched.length, 1); assert.strictEqual(S.fightNew(2, 2, 1, false, S.rng(1)).sched.length, 2); assert.strictEqual(S.fightNew(3, 3, 1, false, S.rng(1)).sched.length, 3);
  const p = S.fightNew(2, 2, 1, true, S.rng(3)), q = S.fightNew(2, 2, 1, false, S.rng(3)); assert.ok(p.dist < q.dist && p.ten > q.ten, 'ตั้งเบ็ดเป๊ะ ปลาเข้าใกล้กว่า');
  const ph = S.fightNew(2, 2, 1, false, S.rng(3)), at = ph.sched[0][0]; ph.t = at - 100; assert.strictEqual(S.fightPhase(ph), 'warn'); ph.t = at + 100; assert.strictEqual(S.fightPhase(ph), 'surge'); ph.t = 0; assert.strictEqual(S.fightPhase(ph), 'calm');
}
// 2) ต้องมีทักษะ: ไม่กดเลยแพ้ทุกกลุ่ม • กดค้างตลอดชนะเฉพาะปลาเล็ก (สายขาด) • มือคนปกติชนะปลากลุ่ม 1–2 • ปลายักษ์ต้องตั้งเบ็ดเป๊ะ/คันดี
{
  for (let c = 0; c < 4; c++) assert.strictEqual(rate(c, 1, 1, false, 0, 'none', 50), 0, 'ไม่กรอเลย ปลาต้องหลุด class ' + c);
  assert.strictEqual(rate(0, 1, 1, false, 0, 'holdall', 50), 1, 'ปลาเล็กกดค้างอย่างเดียวก็ชนะ');
  for (let c = 1; c < 4; c++) assert.strictEqual(rate(c, 3, 1, false, 0, 'holdall', 50), 0, 'กดค้างไม่ปล่อย สายขาด class ' + c);
  assert.ok(rate(1, 1, 1, false, 250, 'human') >= 0.97, 'ปลากลุ่ม 1 คันไม้ไผ่ มือคนชนะแทบทุกครั้ง');
  assert.ok(rate(2, 2, 1, false, 250, 'human') >= 0.9, 'ปลากลุ่ม 2 คันที่ปลายังออกได้ชนะส่วนใหญ่');
  const g3a = rate(3, 3, 1, true, 250, 'human'), g3b = rate(3, 7, 10, true, 250, 'human'), g3c = rate(3, 3, 1, false, 250, 'human');
  assert.ok(g3a >= 0.5 && g3a <= 0.9, 'ปลายักษ์ คันคาร์บอน ตั้งเบ็ดเป๊ะ ชนะราว 50–90% ได้ ' + g3a);
  assert.ok(g3b > g3a, 'คันเพชร เลเวลสูง ชนะมากกว่า'); assert.ok(g3c < g3a, 'ตั้งเบ็ดไม่เป๊ะ ยากกว่ามาก');
  assert.ok(rate(3, 5, 7, true, 400, 'human') >= 0.85, 'ตอบสนองช้า 400 ms แต่คันดีก็ยังชนะได้');
}
// 3) เซิร์ฟเวอร์: ปลากินเบ็ด → ชักเย่อทันที → ชนะได้ปลา / ปล่อยทิ้งปลาหลุด / กดค้างสายขาด / ดึงเร็วไปคืนเหยื่อ / ส่งสถานะให้ผู้เล่น
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('fighttest'), ws = mkWs(), p = w.join(ws, 'alice', '#e74c3c').p;
const got = t => ws.msgs.filter(m => m.t === t), fishN = () => Object.keys(p.rec.inv).filter(k => k.startsWith('fish_')).reduce((a, k) => a + p.rec.inv[k], 0);
let T0 = 1e12;
const cast = () => { p.rec.inv.bait = 5; p.baitSel = 'bait'; w.castFish(p, 10, 10, T0, false, ''); assert.strictEqual(p.fish.st, 'wait'); assert.strictEqual(p.fish.bk, 'bait'); };
const bite = () => { p.fish.at = T0; w.tick(0.1, T0); assert.strictEqual(p.fish.st, 'fight', 'ปลากินเบ็ด → เข้าชักเย่อทันที ไม่มีเกจ'); }; // ขั้นเดียว (7 พ.ย. 2026)
{ // ดึงก่อนปลากิน = ได้เหยื่อคืน
  cast(); assert.strictEqual(p.rec.inv.bait, 4); w.reelFish(p, T0 + 500); assert.strictEqual(p.rec.inv.bait, 5, 'ได้เหยื่อคืน'); assert.strictEqual(p.fish, null);
}
{ // ชนะ
  cast(); bite(); const n0 = fishN(), ps = ws.msgs.length; w.reelFish(p, T0);
  assert.strictEqual(p.fish.st, 'fight', 'ปลากินเบ็ด → เริ่มชักเย่อ'); assert.ok(fishN() === n0, 'ยังไม่ได้ปลาจนกว่าจะชนะ');
  const fm = got('fight').pop(); assert.ok(fm && fm.sched && fm.dist > 0 && fm.ten > 0, 'ส่งข้อมูลชักเย่อให้เว็บ');
  const packet = w.players && [...w.players.values()].length; assert.ok(packet >= 1);
  let now = T0; w.handle(p, { t: 'reel', on: true }); // กดค้าง (ปล่อยเมื่อตึง ~70)
  for (let i = 0; i < 1200 && p.fish && p.fish.st === 'fight'; i++) { now += 50; const ft = p.fish.ft; const ph = S.fightPhase(ft); const want = ph === 'surge' ? false : ph === 'warn' ? ft.ten < 30 : (p.fish.hold ? ft.ten < 70 : ft.ten < 45); if (want !== p.fish.hold) { p.fish.last = Math.min(p.fish.last, now); w.fightAdvance(p, now); if (p.fish && p.fish.st === 'fight') p.fish.hold = want; } else w.fightAdvance(p, now); }
  assert.strictEqual(p.fish, null, 'ชักเย่อจบ'); assert.ok(got('fe').pop().r === 'win', 'ผลชนะ'); assert.strictEqual(fishN(), n0 + 1, 'ชนะได้ปลา 1 ตัว');
}
{ // ปล่อยทิ้ง = ปลาหลุด ไม่ได้ปลา
  cast(); bite(); const n0 = fishN(); w.reelFish(p, T0); let now = T0; for (let i = 0; i < 700 && p.fish; i++) { now += 50; w.fightAdvance(p, now); }
  assert.strictEqual(p.fish, null); assert.strictEqual(got('fe').pop().r, 'lost'); assert.strictEqual(fishN(), n0, 'ไม่ได้ปลา');
}
{ // กดค้างไม่ปล่อยกับปลาแรง = สายขาด
  cast(); bite(); const n0 = fishN(); w.reelFish(p, T0); p.fish.ft = S.fightNew(2, 1, 1, false, S.rng(9)); w.handle(p, { t: 'reel', on: true }); let now = T0; for (let i = 0; i < 400 && p.fish; i++) { now += 50; w.fightAdvance(p, now); }
  assert.strictEqual(p.fish, null); assert.strictEqual(got('fe').pop().r, 'snap', 'กรอค้างสายตึงจนขาด'); assert.strictEqual(fishN(), n0);
}
{ // ผู้เล่นอื่นเห็นสถานะ 3 (ชักเย่อ) ในแพ็กเก็ตตำแหน่ง
  cast(); bite(); w.reelFish(p, T0); ws.msgs.length = 0; w.tick(0.1, T0 + 100); const s = got('s').pop(); assert.ok(s, 'มีแพ็กเก็ตตำแหน่ง'); const me = s.p.find(x => x[0] === p.id); assert.strictEqual(me[4], 3, 'fs = 3 ตอนชักเย่อ'); w.tick(0.1, T0 + 400); assert.ok(got('fs').length >= 1, 'ส่งสถานะจริงให้ผู้เล่นปรับ'); p.fish = null;
}
{ // act ระหว่างชักเย่อไม่ยกเลิก
  cast(); bite(); w.reelFish(p, T0); const st = p.fish.ft; w.reelFish(p, T0 + 10); assert.ok(p.fish && p.fish.st === 'fight' && p.fish.ft === st, 'กด act ซ้ำระหว่างชักเย่อไม่มีผล'); p.fish = null;
}
console.log('ผ่าน test-fight');
process.exit(0);
