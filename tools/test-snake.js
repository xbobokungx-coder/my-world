// ทดสอบเกมงูในตู้เกม: ตัวจำลองกลาง (shared) + การเล่นจริงผ่านเซิร์ฟเวอร์ (เริ่ม/เลี้ยว/จบ/คะแนนสูงสุด/อันดับ/ออกจากตู้)
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-snake-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, K = S.SNAKE;
const seq = a => { let i = 0; return () => a[i++ % a.length]; };

// ---- ตัวจำลองกลาง ----
{
  const r = S.snakeNew(seq([0.5]));
  assert.strictEqual(r.body.length, 3); assert.strictEqual(r.dir, 1); assert.ok(r.food && !r.body.some(([x, y]) => x === r.food[0] && y === r.food[1]), 'ไข่ไม่ทับตัวงู');
  r.food = [r.body[0][0] + 1, r.body[0][1]]; // ไข่อยู่หน้าหัวพอดี
  S.snakeStep(r, seq([0.1])); assert.strictEqual(r.body.length, 4, 'กินไข่แล้วยาวขึ้น'); assert.strictEqual(r.score, K.food); assert.strictEqual(r.foods, 1);
  assert.strictEqual(S.snakeTurn(r, 3), false, 'ย้อนกลับ 180° ไม่ได้'); assert.strictEqual(S.snakeTurn(r, 1), false, 'ทิศเดิมไม่ต้องเข้าคิว');
  assert.ok(S.snakeTurn(r, 0) && S.snakeTurn(r, 3) && !S.snakeTurn(r, 2), 'เลี้ยวสะสมได้สูงสุด 2 ทิศ'); assert.strictEqual(S.snakeTurn(r, 9), false); assert.strictEqual(S.snakeTurn(r, 0.5), false);
  const w = S.snakeNew(seq([0.3])); w.food = [0, 0]; for (let i = 0; i < K.w; i++) S.snakeStep(w, seq([0.3]));
  assert.ok(w.over, 'ชนกำแพงจบเกม'); const b = w.body.map(c => c.slice()); S.snakeStep(w, seq([0.3])); assert.deepStrictEqual(w.body, b, 'จบแล้วไม่ขยับต่อ');
  // ชนตัวเอง: งูยาว 5 เลี้ยวขึ้น-ซ้าย-ลง
  const s2 = { body: [[5, 5], [4, 5], [3, 5], [2, 5], [1, 5]], dir: 1, q: [], food: [15, 15], foods: 0, score: 0, over: false, win: false };
  S.snakeTurn(s2, 2); S.snakeStep(s2, Math.random); S.snakeTurn(s2, 3); S.snakeStep(s2, Math.random); assert.ok(!s2.over); S.snakeTurn(s2, 0); S.snakeStep(s2, Math.random); assert.ok(s2.over, 'ชนตัวเองจบเกม');
  // เข้าช่องหางเดิมได้ (หางขยับหนี)
  const s3 = { body: [[2, 2], [2, 3], [3, 3], [3, 2]], dir: 1, q: [], food: [9, 9], foods: 0, score: 0, over: false, win: false };
  S.snakeStep(s3, Math.random); assert.ok(!s3.over, 'ตามหางตัวเองได้');
  // ความเร็ว: เริ่มช้า เร็วขึ้นตามไข่ มีขั้นต่ำ
  assert.strictEqual(S.snakeMs({ foods: 0 }), K.baseMs); assert.ok(S.snakeMs({ foods: 5 }) < K.baseMs); assert.strictEqual(S.snakeMs({ foods: 9999 }), K.minMs);
  // ชนะเมื่อกระดานเต็ม
  const full = []; for (let y = 0; y < K.h; y++) for (let x = 0; x < K.w; x++) full.push([x, y]);
  assert.strictEqual(S.snakeFood(full, Math.random), null, 'กระดานเต็มไม่มีที่วางไข่');
}

// ---- ผ่านเซิร์ฟเวอร์ ----
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('snake');
const id = 'cab' + S.CABINETS.findIndex(c => c.game === 'snake'); assert.ok(w.tables[id], 'มีโต๊ะตู้งู');
const t = w.tables[id];
function mk(name) {
  const ws = mkWs(), p = w.join(ws, name, '#fff').p; p.ws2 = ws;
  p.rec.wk1 = { n: {}, done: {}, final: true }; p.rec.ach = { cnt: {}, got: Object.fromEntries(S.ACH.map(d => [d.id, 1])) }; p.rec.starter = { done: {}, final: true };
  const q = w.questsOf(p); for (const it of q.list) it.done = true; q.bonus = true;
  p.x = (t.cx + 0.5) * TS; p.y = (t.cy + 1.5) * TS; return p;
}
const arc = (p, a, extra) => w.handle(p, Object.assign({ t: 'arc', a, id }, extra));
const last = (p, f) => p.ws2.msgs.filter(f).pop();
const play = (p, foods) => { // เล่นตรงๆ จนกินครบ foods ฟองแล้วชนกำแพง (ยัดไข่หน้าหัวทุกก้าว)
  const run = w.snkRuns().get(p.id); assert.ok(run, 'มีเกมอยู่');
  while (!run.r.over) { const [hx, hy] = run.r.body[0], [dx, dy] = S.SNAKE_DIRS ? S.SNAKE_DIRS[run.r.dir] : [1, 0]; if (run.r.foods < foods) run.r.food = [hx + dx, hy + dy]; run.next = Date.now(); w.snakeTick(Date.now() + 1); /* หนึ่งก้าวต่อรอบ */ if (run.r.foods >= foods && !run.r.over) run.r.food = null; }
};

{
  const a = mk('Anna');
  arc(a, 'open'); // เปิดตู้ผ่าน arcOpen ไม่ได้ผ่าน handle → ใช้ pubFor โดยตรง
  const pub = w.pubFor(t, a.id); assert.strictEqual(pub.game, 'snake'); assert.deepStrictEqual(pub.top, { best: [], wk: [] }); assert.strictEqual(pub.run, null);
  arc(a, 'start'); const st = last(a, m => m.t === 'snk'); assert.ok(st && st.start && st.b.length === 6, 'เริ่มเกมได้ งูยาว 3');
  arc(a, 'start'); assert.strictEqual(a.ws2.msgs.filter(m => m.t === 'snk' && m.start).length, 1, 'เกมกำลังเล่นอยู่ เริ่มซ้อนไม่ได้');
  arc(a, 'dir', { d: 0 }); assert.deepStrictEqual(w.snkRuns().get(a.id).r.q, [0], 'รับทิศเลี้ยว');
  arc(a, 'dir', { d: 'x' }); arc(a, 'dir', { d: 99 }); assert.strictEqual(w.snkRuns().get(a.id).r.q.length, 1, 'ทิศแปลกถูกปัด');
  // ชนกำแพงโดยไม่กินเลย: ไม่ได้แต้มตู้เกม แต่จบเกมได้
  const before = w.arcOf(a.rec).pts; w.snkRuns().get(a.id).r.q.length = 0; play(a, 0);
  const over0 = last(a, m => m.t === 'snk' && m.over); assert.ok(over0 && over0.sc === 0 && !over0.nb, 'จบเกมคะแนน 0'); assert.strictEqual(w.arcOf(a.rec).pts, before, 'กินไม่ถึง minFoods ไม่ได้แต้มตู้เกม');
  assert.ok(!w.snkRuns().has(a.id), 'เกมที่จบแล้วถูกเก็บออก');
  // เล่นจริง: กิน 6 ฟอง = 60 คะแนน ได้สถิติ + แต้มตู้เกม
  a.snkCd = 0; arc(a, 'start'); play(a, 6);
  const o = last(a, m => m.t === 'snk' && m.over); assert.strictEqual(o.sc, 60); assert.strictEqual(o.best, 60); assert.strictEqual(o.nb, 1);
  assert.strictEqual(w.arcOf(a.rec).pts - before, Math.min(K.ptsMax, 1 + Math.floor(6 / K.ptsPer)), 'ได้แต้มตู้เกมตามไข่');
  assert.strictEqual(w.snkOf(a.rec).best, 60); assert.strictEqual(w.snkOf(a.rec).wk, 60);
  // เล่นซ้ำได้คะแนนต่ำกว่า สถิติไม่ลด
  a.snkCd = 0; arc(a, 'start'); play(a, 3); const o2 = last(a, m => m.t === 'snk' && m.over); assert.strictEqual(o2.sc, 30); assert.strictEqual(o2.best, 60); assert.ok(!o2.nb);
  // คูลดาวน์ก่อนเริ่มรอบใหม่
  arc(a, 'start'); assert.ok(!w.snkRuns().has(a.id), 'ติดคูลดาวน์เริ่มรอบใหม่ทันทีไม่ได้');
  // อันดับ
  const b = mk('Bob'); arc(b, 'start'); play(b, 7); /* ตรงไปทางขวาได้ไข่สูงสุด 7 ฟองก่อนชนกำแพง */ const tops = w.snakeTops();
  assert.deepStrictEqual(tops.best.map(x => [x.name, x.best]), [['Bob', 70], ['Anna', 60]], 'เรียงตามคะแนนสูงสุด'); assert.deepStrictEqual(tops.wk.map(x => x.name), ['Bob', 'Anna']);
  w.handle(a, { t: 'lb' }); assert.strictEqual(last(a, m => m.t === 'lb').snk.best[0].name, 'Bob', 'ข้อความ lb มีอันดับงู');
  // สัปดาห์ใหม่ล้างเฉพาะ wk
  w.snkOf(a.rec).wkKey = -1; assert.strictEqual(w.snkOf(a.rec).wk, 0); assert.strictEqual(w.snkOf(a.rec).best, 60);
  // เดินห่างตู้ = จบเกมทันที (นับคะแนนที่ได้) • ปิดตู้ = จบเกม
  const c = mk('Cat'); arc(c, 'start'); const run = w.snkRuns().get(c.id); run.r.score = 20; run.r.foods = 2; c.x += 20 * TS; w.arcRangeCheck(c);
  assert.ok(!w.snkRuns().has(c.id), 'เดินห่างตู้จบเกม'); assert.strictEqual(w.snkOf(c.rec).best, 20, 'คะแนนที่ทำได้ยังนับ'); assert.ok(last(c, m => m.t === 'arc' && m.close), 'บอกฝั่งเว็บปิดหน้าต่าง');
  const d = mk('Dan'); arc(d, 'start'); arc(d, 'close'); assert.ok(!w.snkRuns().has(d.id), 'ปิดตู้จบเกม');
  // ไกลเกินระยะเริ่มไม่ได้ • หลุดการเชื่อมต่อ = จบเกม
  const e = mk('Eve'); e.x += 20 * TS; arc(e, 'start'); assert.ok(!w.snkRuns().has(e.id), 'ไกลเกินระยะเริ่มไม่ได้');
  e.x -= 20 * TS; e.snkCd = 0; arc(e, 'start'); assert.ok(w.snkRuns().has(e.id)); w.arcLeave(e); assert.ok(!w.snkRuns().has(e.id), 'ออกจากเกม จบเกม');
  // ตัวจับเวลาหยุดเมื่อไม่มีเกม
  w.snakeTick(Date.now()); assert.ok(!w._snkTimer, 'ไม่มีเกม ปิดตัวจับเวลา');
}
console.log('✓ ผ่าน: เกมงูในตู้เกม');
process.exit(0);
