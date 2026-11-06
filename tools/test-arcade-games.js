// ทดสอบเกมตู้ที่ test-arcade.js ไม่ครอบ: ไพ่ป๊อกเด้ง (pok) / ใครกดเร็วกว่า (react) / Connect 4 (c4)
// เล่นกับผู้เล่นปลอม 2 คนจนจบ ด้วยเวลา/สุ่มปลอม (ผลคงที่) • เรียกผ่าน World API เท่านั้น: node tools/test-arcade-games.js
const assert = require('assert');
process.env.TZ = 'Asia/Bangkok';
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-arcgames-');

// ---- สแตบเวลา + Math.random (PRNG มี seed) ก่อน require server.js ----
const RealDate = Date; let NOW = RealDate.UTC(2026, 10, 6, 3, 0, 0);
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
  static now() { return NOW; }
}
global.Date = FakeDate;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
Math.random = mulberry32(20261106);

const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('arcgames');
const cabOf = g => 'cab' + S.CABINETS.findIndex(c => c.game === g);
function mk(name, coin = 1000) {
  const ws = mkWs(), p = w.join(ws, name, '#fff').p; p.rec.inv.coin = coin;
  p.rec.wk1 = { n: {}, done: {}, final: true };
  p.rec.ach = { cnt: {}, got: Object.fromEntries(S.ACH.map(d => [d.id, 1])) };
  p.rec.starter = { done: {}, final: true };
  const q = w.questsOf(p); for (const it of q.list) it.done = true; q.bonus = true;
  return p;
}
const near = (p, id) => { const t = w.tables[id]; p.x = (t.cx + 0.5) * TS; p.y = (t.cy + 1.5) * TS; };
const arc = (p, a, id, extra) => w.handle(p, Object.assign({ t: 'arc', a, id }, extra));
const coin = p => p.rec.inv.coin;
const rake = pot => Math.floor(pot * S.RAKE);
const adv = ms => { NOW += ms; w.arcTick(NOW); };
const pair = (game, bet, n1, n2) => { // สร้างห้อง + เข้าร่วม (ยังไม่เริ่มสำหรับ party)
  const id = cabOf(game), h = mk(n1), g = mk(n2); near(h, id); near(g, id);
  arc(h, 'create', id, { bet }); arc(g, 'join', id); return { id, t: w.tables[id], h, g };
};
const clear = (id, ...ps) => { for (const p of ps) w.leave(p); NOW += 60000; w.arcTick(NOW); assert.strictEqual(w.tables[id].state, 'idle', 'โต๊ะต้องกลับว่างหลังหมดเวลารีเซ็ต'); };

// ---- ไพ่ป๊อก (pok): เล่นจนจบหลายตา เหรียญรวมคงที่ (เดิมพัน→ผู้ชนะ→toPot) ----
{
  let played = 0, tries = 0, sawDecide = false;
  while (played < 8 && tries++ < 40) {
    const { id, t, h, g } = pair('pok', 100, 'PkA' + tries, 'PkB' + tries);
    assert.strictEqual(t.state, 'waiting'); assert.strictEqual(coin(h), 900); assert.strictEqual(coin(g), 900);
    const pot0 = w.lotto.pot; arc(h, 'startnow', id);
    assert.ok(t.state === 'playing' || t.state === 'over', 'เริ่มแล้วต้องเล่นอยู่ (หรือเปิดไพ่ทันทีถ้ามีป๊อก)');
    assert.ok(t.players.every(q => q.hand.length === 2), 'แจกไพ่คนละ 2 ใบ');
    if (t.state === 'playing') {
      sawDecide = true;
      arc(h, 'move', id, { c: played % 2 ? 'draw' : 'stay' }); assert.strictEqual(t.state, 'playing', 'ยังรอคนที่สอง');
      arc(g, 'move', id, { c: 'stay' });
    }
    assert.strictEqual(t.state, 'over', 'ตัดสินใจครบแล้วเกมจบ');
    const net = 200 - rake(200), paid = coin(h) + coin(g) - 1800, dPot = w.lotto.pot - pot0;
    assert.strictEqual(dPot, rake(200), 'ค่าบริการเข้ากองกลาง');
    assert.strictEqual(paid, net, 'เหรียญรวมคงที่: ผู้ชนะ(หรือหารเสมอ)ได้ครบยอดหักค่าบริการ');
    assert.ok(t.winners.length >= 1 || t.winner === '', 'มีสถานะผู้ชนะ');
    clear(id, h, g); played++;
  }
  assert.strictEqual(played, 8); assert.ok(sawDecide, 'อย่างน้อยหนึ่งตาต้องผ่านขั้นตัดสินใจ');
  console.log('  pok: เล่นจบ 8 ตา เหรียญรวมคงที่ + ค่าบริการเข้ากองกลาง');
}

// ---- ป๊อก: หมดเวลาตัดสินใจ / หลุดกลางเกม / arcRefundAll ----
{
  const playing = (name) => { for (let i = 0; i < 60; i++) { const r = pair('pok', 100, name + 'a' + i, name + 'b' + i); arc(r.h, 'startnow', r.id); if (r.t.state === 'playing') return r; clear(r.id, r.h, r.g); } assert.fail('สุ่มไม่ได้ตาที่ไม่มีป๊อก'); };
  // หมดเวลา: ไม่มีใครกด → ทุกคน "อยู่" แล้วตัดสินให้
  let r = playing('PkT'); assert.ok(r.t.deadline > NOW);
  adv(r.t.deadline - NOW + 1); assert.strictEqual(r.t.state, 'over', 'หมดเวลาตัดสินใจ = เกมจบ');
  clear(r.id, r.h, r.g);
  // หลุดกลางเกม: คนที่เหลือชนะ ได้ 2 เท่าหักค่าบริการ
  r = playing('PkL'); const pot0 = w.lotto.pot; w.leave(r.g);
  assert.strictEqual(r.t.state, 'over'); assert.strictEqual(r.t.winners.length, 1); assert.strictEqual(r.t.winners[0], r.h.id);
  assert.strictEqual(coin(r.h), 900 + 200 - rake(200), 'ผู้ชนะได้เดิมพันสองฝั่งหักค่าบริการ'); assert.strictEqual(coin(r.g), 900, 'ผู้หลุดเสียเดิมพัน');
  assert.strictEqual(w.lotto.pot, pot0 + rake(200)); clear(r.id, r.h);
  // arcRefundAll ตอนกำลังเล่น + ตอนรอ
  r = playing('PkR'); w.arcRefundAll(); assert.strictEqual(coin(r.h), 1000); assert.strictEqual(coin(r.g), 1000, 'arcRefundAll คืนเดิมพันทั้งสอง'); clear(r.id, r.h, r.g);
  r = pair('pok', 100, 'PkW1', 'PkW2'); w.arcRefundAll(); assert.strictEqual(coin(r.h), 1000); assert.strictEqual(coin(r.g), 1000, 'arcRefundAll คืนห้องที่รอ'); clear(r.id, r.h, r.g);
  // หมดเวลารอ คืนทุกคน
  r = pair('pok', 100, 'PkX1', 'PkX2'); adv(r.t.waitUntil - NOW + 1);
  assert.strictEqual(r.t.state, 'idle'); assert.strictEqual(coin(r.h), 1000); assert.strictEqual(coin(r.g), 1000, 'หมดเวลารอ คืนเดิมพัน'); clear(r.id, r.h, r.g);
  console.log('  pok: หมดเวลา/หลุดกลางเกมจ่ายผู้ชนะ/arcRefundAll/หมดเวลารอ');
}

// ---- ใครกดเร็วกว่า (react): กดก่อนสัญญาณออกรอบ, ชนะครบ 2 รอบจบเกม ----
{
  const { id, t, h, g } = pair('react', 100, 'RcA', 'RcB'); const pot0 = w.lotto.pot;
  arc(h, 'startnow', id); assert.strictEqual(t.state, 'playing'); assert.strictEqual(t.g.phase, 'wait');
  arc(h, 'move', id); assert.ok(h.id && t.players[0].fs, 'กดก่อนสัญญาณ = fs'); assert.strictEqual(t.players[0].score, 0); assert.strictEqual(t.g.phase, 'wait');
  adv(t.g.goAt - NOW + 1); assert.strictEqual(t.g.phase, 'go', 'ถึงเวลาสัญญาณ GO');
  arc(h, 'move', id); assert.strictEqual(t.g.phase, 'go', 'คนกดก่อนสัญญาณกดซ้ำไม่นับ'); assert.strictEqual(t.players[0].score, 0);
  NOW += 300; arc(g, 'move', id); assert.strictEqual(t.g.phase, 'result'); assert.strictEqual(t.players[1].score, 1, 'คนแรกที่กดหลังสัญญาณได้แต้ม');
  adv(2300); assert.strictEqual(t.g.phase, 'wait', 'พักผลแล้วเริ่มรอบใหม่'); assert.strictEqual(t.g.round, 2);
  for (const q of t.players) assert.ok(!q.fs, 'รอบใหม่ล้าง fs');
  adv(t.g.goAt - NOW + 1); NOW += 200; arc(g, 'move', id); assert.strictEqual(t.players[1].score, 2);
  adv(2300); assert.strictEqual(t.state, 'over', 'ครบ 2 แต้มจบเกม'); assert.deepStrictEqual(t.winners, [g.id]);
  assert.strictEqual(coin(g), 900 + 200 - rake(200), 'ผู้ชนะได้เดิมพันสองฝั่งหักค่าบริการ'); assert.strictEqual(coin(h), 900); assert.strictEqual(w.lotto.pot, pot0 + rake(200));
  clear(id, h, g);
  // หลุดกลางเกม + arcRefundAll
  let r = pair('react', 100, 'RcC', 'RcD'); arc(r.h, 'startnow', r.id); w.arcRefundAll(); assert.strictEqual(coin(r.h), 1000); assert.strictEqual(coin(r.g), 1000, 'arcRefundAll คืนเดิมพัน'); clear(r.id, r.h, r.g);
  r = pair('react', 100, 'RcE', 'RcF'); arc(r.h, 'startnow', r.id); w.leave(r.h);
  assert.strictEqual(r.t.state, 'over'); assert.deepStrictEqual(r.t.winners, [r.g.id]); assert.strictEqual(coin(r.g), 900 + 200 - rake(200)); assert.strictEqual(coin(r.h), 900, 'ผู้หลุดเสียเดิมพัน'); clear(r.id, r.g);
  console.log('  react: กดก่อนสัญญาณ/ชนะรอบ/ครบแต้มจบ/จ่ายผู้ชนะ/หลุด/arcRefundAll');
}

// ---- Connect 4 (c4): เล่นจนมีผู้ชนะ, หมดเวลา, หลุด, arcRefundAll ----
{
  const mkC4 = (n1, n2) => { const r = pair('c4', 100, n1, n2); assert.strictEqual(r.t.state, 'playing'); assert.strictEqual(coin(r.h), 900); assert.strictEqual(coin(r.g), 900);
    const by = id => (r.h.id === id ? r.h : r.g); r.X = by(r.t.xId); r.O = by(r.t.oId); assert.ok(r.X !== r.O); return r; };
  let r = mkC4('C4A', 'C4B'), { id, t, X, O } = r; const pot0 = w.lotto.pot;
  arc(O, 'move', id, { col: 0 }); assert.ok(t.g.board.every(c => c === ''), 'ไม่ใช่ตาตัวเองวางไม่ได้');
  arc(X, 'move', id, { col: 9 }); arc(X, 'move', id, { col: -1 }); assert.ok(t.g.board.every(c => c === ''), 'คอลัมน์นอกช่วงไม่มีผล');
  for (let i = 0; i < 3; i++) { arc(X, 'move', id, { col: 0 }); arc(O, 'move', id, { col: 1 }); assert.strictEqual(t.state, 'playing'); }
  assert.strictEqual(t.g.board[35], 'X'); assert.strictEqual(t.g.board[28], 'X'); assert.strictEqual(t.g.board[36], 'O');
  arc(X, 'move', id, { col: 0 });
  assert.strictEqual(t.state, 'over'); assert.strictEqual(t.winner, 'X'); assert.deepStrictEqual([...t.g.line].sort((a, b) => a - b), [14, 21, 28, 35], 'เรียง 4 แนวตั้งคอลัมน์ 0');
  assert.strictEqual(coin(X), 900 + 200 - rake(200)); assert.strictEqual(coin(O), 900); assert.strictEqual(w.lotto.pot, pot0 + rake(200), 'ค่าบริการเข้ากองกลาง');
  assert.strictEqual(coin(X) + coin(O) + (w.lotto.pot - pot0), 2000, 'เหรียญรวมคงที่');
  clear(id, X, O);
  // หมดเวลา: ผู้เล่นที่ไม่ถึงตาแพ้ (ตาปัจจุบัน = X → X แพ้)
  r = mkC4('C4C', 'C4D'); ({ id, t, X, O } = r);
  arc(X, 'move', id, { col: 3 }); assert.strictEqual(t.g.turn, 'O');
  adv(t.deadline - NOW + 1); assert.strictEqual(t.state, 'over', 'หมดเวลา = เกมจบ'); assert.strictEqual(t.winner, 'X', 'ผู้ที่ถึงตาแล้วไม่เดิน (O) แพ้');
  assert.strictEqual(coin(X), 900 + 200 - rake(200)); assert.strictEqual(coin(O), 900); assert.ok(/หมดเวลา/.test(t.msg));
  clear(id, X, O);
  // หมดเวลาตั้งแต่ตาแรก: X แพ้
  r = mkC4('C4E', 'C4F'); ({ id, t, X, O } = r); adv(t.deadline - NOW + 1);
  assert.strictEqual(t.state, 'over'); assert.strictEqual(t.winner, 'O'); assert.strictEqual(coin(O), 900 + 200 - rake(200)); assert.strictEqual(coin(X), 900); clear(id, X, O);
  // หลุดกลางเกม / arcRefundAll
  r = mkC4('C4G', 'C4H'); ({ id, t, X, O } = r); w.leave(O);
  assert.strictEqual(t.state, 'over'); assert.strictEqual(t.winner, 'X'); assert.strictEqual(coin(X), 900 + 200 - rake(200)); assert.strictEqual(coin(O), 900, 'ผู้หลุดเสียเดิมพัน'); clear(id, X);
  r = mkC4('C4I', 'C4J'); ({ id, t, X, O } = r); w.arcRefundAll(); assert.strictEqual(coin(X), 1000); assert.strictEqual(coin(O), 1000, 'arcRefundAll คืนเดิมพันทั้งสองฝั่ง'); clear(id, X, O);
  console.log('  c4: เล่นจนชนะ/หมดเวลา/หลุดกลางเกม/arcRefundAll');
}

console.log('arcade-games ok');
process.exit(0);
