// ทดสอบคู่มือมือใหม่: บท 1 (6 ข้อ) ไม่เปลี่ยน • บท 2 (ตัดไม้ ขุดแร่ ให้อาหาร เก็บไข่ ทำอาหาร) นับแยก ได้เหรียญต่อข้อ + รางวัลรวม ผู้เล่นเก่าข้าม
// รัน: node tools/test-starter.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-starter-'));
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('startertest');
const mk = name => { const ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }; const r = w.join(ws, name, '#3498db', false); assert.ok(r.p, name); return { p: r.p, ws }; };
const coin = p => p.rec.inv.coin || 0;
const quests = ws => { for (let i = ws.msgs.length - 1; i >= 0; i--) if (ws.msgs[i].t === 'quests') return ws.msgs[i]; return null; };

assert.strictEqual(S.STARTER.length, 6, 'บท 1 ยังเป็น 6 ข้อ');
assert.deepStrictEqual(S.STARTER2.map(s => s.ev), ['chop', 'mine', 'feed', 'collect', 'cook']);
for (const s of S.STARTER2) assert.ok(s.hint && s.text && s.coin > 0 && s.how.length >= 2, s.id + ' ข้อมูลครบ');

// ผู้เล่นใหม่
const { p, ws } = mk('Newbie');
let st = w.starterOf(p);
assert.ok(!st.final && !st.c2.final, 'มือใหม่: ทั้งสองบทยังไม่จบ');
assert.deepStrictEqual(quests(ws).starter.c2, { done: [], final: false }, 'ส่ง c2 ให้ไคลเอนต์');
// ทำข้อบท 2 ก่อนจบบท 1 ก็นับ (ไม่เสียเหรียญ)
let c0 = coin(p); w.event(p, 'chop');
assert.ok(coin(p) - c0 >= S.STARTER2.find(s => s.id === 'chop').coin, 'ตัดไม้: ได้เหรียญข้อ (อาจมีรางวัลอื่นของเกมร่วมด้วย เช่น ความสำเร็จ)');
assert.ok(st.c2.done.chop && !st.final, 'บท 1 ยังไม่ถูกแตะ');
c0 = coin(p); const d0 = Object.keys(st.c2.done).length; w.event(p, 'chop'); assert.strictEqual(Object.keys(st.c2.done).length, d0, 'ทำซ้ำไม่นับข้อซ้ำ');
// บท 1 จบตามเดิม (กติกาเดิมยังทำงาน)
for (const s of S.STARTER) w.event(p, s.ev);
assert.ok(st.final, 'บท 1 ครบแล้ว final'); assert.ok(!st.c2.final, 'บท 1 จบ ไม่ทำให้บท 2 จบ');
assert.deepStrictEqual(quests(ws).starter.done.length, 6);
// บท 2 ที่เหลือ
const before = coin(p), rest = S.STARTER2.filter(s => s.id !== 'chop');
for (const s of rest) w.event(p, s.ev);
const want = rest.reduce((a, s) => a + s.coin, 0) + S.STARTER2_FINAL.coin;
assert.ok(coin(p) - before >= want, 'เหรียญบท 2 ≥ ผลรวมข้อที่เหลือ + รางวัลรวม');
assert.ok(st.c2.final, 'บท 2 จบ'); assert.strictEqual(quests(ws).starter.c2.final, true);
{ const logBefore = w.log.length; for (const s of S.STARTER2) w.event(p, s.ev); assert.strictEqual(w.log.length, logBefore, 'จบแล้วไม่ประกาศซ้ำ'); }

// ผู้เล่นเก่า (ระดับการเล่น ≥ 8) ข้ามบท 2
{
  const q = mk('Veteran'); delete q.p.rec.starter; q.p.rec.skills = { farm: 60000, fish: 60000, animal: 0, wood: 0 };
  assert.ok(S.playLevel(q.p.rec.skills) >= 8, 'ตั้งผู้เล่นเก่าได้');
  w.event(q.p, 'mine'); assert.ok(!w.starterOf(q.p).c2.done.mine, 'ผู้เล่นเก่า: ไม่นับบท 2');
  assert.ok(w.starterOf(q.p).c2.final);
}
// ผู้เล่นที่จบบท 1 ไปแล้วก่อนมีบท 2 (ไม่มี c2 ในเซฟ) ได้บท 2 ด้วย
{
  const q = mk('Midway'); q.p.rec.starter = { done: Object.fromEntries(S.STARTER.map(s => [s.id, 1])), final: true };
  assert.ok(!w.starterOf(q.p).c2.final, 'จบบท 1 เก่า → เริ่มบท 2');
  w.event(q.p, 'cook'); assert.ok(w.starterOf(q.p).c2.done.cook, 'ได้นับข้อทำอาหาร');
}
console.log('ผ่าน: คู่มือมือใหม่ บท 1+2');
process.exit(0);
