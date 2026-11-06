// ทดสอบตู้เกม (XO/UNO/เป่ายิ้งฉุบ): เริ่ม/ออกโต๊ะ/คืนเดิมพันตอนหลุด + arcRefundAll • characterization ของพฤติกรรมปัจจุบัน: node tools/test-arcade.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-arcade-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;

const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('arcade');
let seq = 0;
const cabOf = g => 'cab' + S.CABINETS.findIndex(c => c.game === g);
function mk(name, coin = 1000) { // ผู้เล่นจริงผ่าน join แล้ววางไว้ใกล้ตู้ XO
  const ws = mkWs(), p = w.join(ws, name, '#fff').p; p.rec.inv.coin = coin; p.ws2 = ws; seq++;
  p.rec.wk1 = { n: {}, done: {}, final: true }; // ปิดภารกิจสัปดาห์แรก + ความสำเร็จทั้งหมด (ไม่งั้นเล่นจบได้เหรียญโบนัสปนกับเงินเดิมพัน)
  p.rec.ach = { cnt: {}, got: Object.fromEntries(S.ACH.map(d => [d.id, 1])) };
  p.rec.starter = { done: {}, final: true }; // คู่มือเริ่มต้นจบแล้ว (ไม่งั้นมีเหรียญโบนัสขั้นตอน)
  const q = w.questsOf(p); for (const it of q.list) it.done = true; q.bonus = true; // เควสประจำวันถือว่าเสร็จหมด (ไม่งั้นได้เหรียญเควสปนกับยอดที่วัด)
  return p;
}
const near = (p, id) => { const t = w.tables[id]; p.x = (t.cx + 0.5) * TS; p.y = (t.cy + 1.5) * TS; };
const arc = (p, a, id, extra) => w.handle(p, Object.assign({ t: 'arc', a, id }, extra));
const coin = p => p.rec.inv.coin;
const idle = t => t.state === 'idle';

// ---- XO (เกม 2 ฝ่าย): สร้างห้อง/ยกเลิก/เข้าร่วม ----
{
  const id = cabOf('xo'), t = w.tables[id], h = mk('Host'), g = mk('Guest'); near(h, id); near(g, id);
  arc(h, 'create', id, { bet: 100 });
  assert.strictEqual(t.state, 'waiting'); assert.strictEqual(coin(h), 900, 'เดิมพันถูกกันไว้ (escrow) ตอนสร้างห้อง'); assert.strictEqual(t.host.id, h.id);
  arc(g, 'cancel', id); assert.strictEqual(t.state, 'waiting', 'คนอื่นยกเลิกห้องไม่ได้');
  g.rec.inv.coin = 50; arc(g, 'join', id); assert.strictEqual(t.state, 'waiting', 'เหรียญไม่พอเข้าไม่ได้'); assert.strictEqual(coin(g), 50);
  arc(h, 'join', id); assert.strictEqual(t.state, 'waiting', 'เจ้าของห้องเข้าร่วมตัวเองไม่ได้');
  arc(h, 'cancel', id);
  assert.ok(idle(t)); assert.strictEqual(coin(h), 1000, 'ยกเลิกห้องรอ คืนเดิมพัน');
  // เดิมพันนอกรายการ = 0 • เหรียญไม่พอ = ไม่เริ่ม
  arc(h, 'create', id, { bet: 77 }); assert.strictEqual(t.bet, 0, 'ยอดเดิมพันนอก S.BETS ถูกปัดเป็น 0'); assert.strictEqual(coin(h), 1000); arc(h, 'cancel', id);
  h.rec.inv.coin = 5; arc(h, 'create', id, { bet: 100 }); assert.ok(idle(t), 'เหรียญไม่พอสร้างห้องไม่ได้'); assert.strictEqual(coin(h), 5);
  h.rec.inv.coin = 1000; g.rec.inv.coin = 1000;
  // เข้าร่วม → เริ่มเล่น (ทั้งคู่ถูกกันเดิมพัน)
  arc(h, 'create', id, { bet: 100 }); arc(g, 'join', id);
  assert.strictEqual(t.state, 'playing'); assert.strictEqual(coin(h), 900); assert.strictEqual(coin(g), 900);
  const x = t.xId === h.id ? h : g, o = x === h ? g : h;
  assert.ok(w.inGame(h) && w.inGame(g), 'inGame เป็นจริงตอนนั่งโต๊ะ');
  // ลงเดินผิดคิว/ผิดช่องไม่มีผล
  arc(o, 'move', id, { i: 0 }); assert.strictEqual(t.board[0], '', 'ไม่ใช่ตาตัวเองเดินไม่ได้');
  arc(x, 'move', id, { i: 99 }); assert.ok(t.board.every(c => c === ''));
  arc(x, 'move', id, { i: 0 }); assert.strictEqual(t.board[0], 'X');
  // ผู้เล่นหลุดกลางเกม = แพ้ ผู้ชนะได้เงินสองฝั่งหักค่าบริการ 5% เข้า toPot
  const pot0 = w.lotto.pot; w.leave(o);
  assert.strictEqual(t.state, 'over'); assert.strictEqual(t.winner, 'X' === (o === x ? 'X' : 'O') ? 'O' : 'X');
  const rake = Math.floor(200 * S.RAKE); assert.strictEqual(coin(x), 900 + 200 - rake, 'ผู้ชนะได้ 2 เท่าหักค่าบริการ'); assert.strictEqual(w.lotto.pot, pot0 + rake, 'ค่าบริการเข้ากองกลาง');
  assert.strictEqual(coin(o), 900, 'ผู้หลุดเสียเดิมพัน'); assert.ok(!w.inGame(x), 'จบเกมแล้วไม่ถือว่าอยู่ในเกม');
  w.leave(x); w.resetTable(t);
  console.log('  XO: escrow/ยกเลิก/เข้าร่วม/หลุดกลางเกมจ่ายผู้ชนะ+ค่าบริการเข้าโต๊ะกลาง');
}

// ---- XO: ผู้สร้างห้องรอหลุด / หมดเวลารอ / เดินห่างตู้ / ปิดเซิร์ฟเวอร์ ----
{
  const id = cabOf('xo'), t = w.tables[id], h = mk('Host2'), g = mk('Guest2'); near(h, id); near(g, id);
  arc(h, 'create', id, { bet: 50 }); const hostRec = h.rec; assert.strictEqual(coin(h), 950);
  w.leave(h); assert.ok(idle(t)); assert.strictEqual(hostRec.inv.coin, 1000, 'เจ้าของห้องรอหลุด คืนเดิมพันเข้า rec');
  // หมดเวลารอ 180 วิ
  const h2 = mk('Host3'); near(h2, id); arc(h2, 'create', id, { bet: 100 }); assert.strictEqual(coin(h2), 900);
  w.arcTick(t.waitUntil - 1); assert.strictEqual(t.state, 'waiting'); w.arcTick(t.waitUntil + 1);
  assert.ok(idle(t)); assert.strictEqual(coin(h2), 1000, 'หมดเวลารอ คืนเดิมพัน');
  // เดินห่างตู้ขณะรอ = ออกโต๊ะ + คืนเดิมพัน
  arc(h2, 'create', id, { bet: 100 }); h2.x = 0; h2.y = 0; w.arcRangeCheck(h2);
  assert.ok(idle(t)); assert.strictEqual(coin(h2), 1000, 'เดินห่างตู้ = ออกโต๊ะ คืนเดิมพัน');
  assert.ok(h2.ws2.msgs.some(m => m.t === 'arc' && m.close === id), 'ส่งคำสั่งปิดหน้าตู้ให้ผู้เล่น');
  // arcRefundAll: รอ → คืนเจ้าของ • กำลังเล่น → คืนทั้งสองฝั่ง (ตอนปิดเซิร์ฟเวอร์)
  near(h2, id); arc(h2, 'create', id, { bet: 100 }); w.arcRefundAll(); assert.strictEqual(coin(h2), 1000, 'arcRefundAll คืนห้องที่รอ');
  arc(h2, 'cancel', id); // ห้องยังรออยู่ (arcRefundAll ไม่รีเซ็ตโต๊ะ) → ยกเลิกคืนซ้ำ  ดู Hand-off
  const afterDup = coin(h2);
  assert.strictEqual(afterDup, 1100, 'พฤติกรรมปัจจุบัน: arcRefundAll ไม่ล้างโต๊ะ ถ้ายกเลิกต่อจะได้คืนซ้ำ (ไม่เกิดจริงเพราะปิดเซิร์ฟเวอร์ตามหลัง บันทึกไว้เฉยๆ)');
  h2.rec.inv.coin = 1000; w.resetTable(t);
  const g2 = mk('Guest3'); near(g2, id); near(h2, id); arc(h2, 'create', id, { bet: 500 }); arc(g2, 'join', id);
  assert.strictEqual(t.state, 'playing'); assert.strictEqual(coin(h2), 500); assert.strictEqual(coin(g2), 500);
  w.arcRefundAll(); assert.strictEqual(coin(h2), 1000); assert.strictEqual(coin(g2), 1000, 'arcRefundAll คืนเดิมพันทั้งสองฝั่งที่กำลังเล่น');
  w.resetTable(t);
  // บอท: ตอนนี้ปิดเดิมพันกับบอทอยู่ (S.BOTBET.bets=[0]) ขอเดิมพันก็ได้ 0
  h2.rec.inv.coin = 1000; const bet = 100; // ตอนนี้ S.BOTBET.bets = [0] (ปิดเดิมพันกับบอท) ขอเดิมพัน 100 → ถูกปัดเป็น 0
  assert.deepStrictEqual(S.BOTBET.bets, [0]);
  arc(h2, 'bot', id, { bet }); assert.strictEqual(t.state, 'playing'); assert.ok(t.bot); assert.strictEqual(t.bet, 0, 'เล่นกับบอทเดิมพันไม่ได้ (S.BOTBET ปิดอยู่)'); assert.strictEqual(coin(h2), 1000);
  w.arcRefundAll(); assert.strictEqual(coin(h2), 1000, 'ห้องบอทไม่มีเดิมพัน arcRefundAll ไม่แจกเหรียญเพิ่ม');
  w.leave(h2); assert.ok(idle(t) || t.state === 'over', 'ผู้เล่นหลุดจากโต๊ะบอท จบเกม');
  w.resetTable(t); w.leave(g2); w.leave(g);
  console.log('  XO: หลุด/หมดเวลา/เดินห่าง/arcRefundAll/บอท');
}

// ---- UNO (หลายคน): เข้า-ออกห้องรอ, host ยกเลิก, เริ่ม, หลุดกลางเกม, arcRefundAll ----
{
  const id = cabOf('uno'), t = w.tables[id], h = mk('UHost'), a = mk('UA'), b = mk('UB'); for (const p of [h, a, b]) near(p, id);
  arc(h, 'create', id, { bet: 100 }); assert.strictEqual(t.state, 'waiting'); assert.strictEqual(coin(h), 900); assert.strictEqual(t.players.length, 1);
  arc(a, 'join', id); arc(b, 'join', id); assert.strictEqual(t.players.length, 3); assert.strictEqual(coin(a), 900);
  arc(a, 'join', id); assert.strictEqual(t.players.length, 3, 'เข้าซ้ำไม่ได้'); assert.strictEqual(coin(a), 900);
  arc(b, 'leave', id); assert.strictEqual(t.players.length, 2); assert.strictEqual(coin(b), 1000, 'ผู้เข้าร่วมออกห้องรอ คืนเดิมพัน');
  arc(h, 'leave', id); assert.strictEqual(t.players.length, 2, 'host ใช้ leave ไม่ได้ (ต้อง cancel)');
  arc(a, 'cancel', id); assert.strictEqual(t.state, 'waiting', 'ไม่ใช่ host ยกเลิกไม่ได้');
  arc(h, 'cancel', id); assert.ok(idle(t)); assert.strictEqual(coin(h), 1000); assert.strictEqual(coin(a), 1000, 'host ยกเลิก คืนทุกคน'); assert.deepStrictEqual(t.players, []);
  // host หลุดตอนรอ = ยกเลิกห้องคืนทุกคน
  arc(h, 'create', id, { bet: 100 }); arc(a, 'join', id); w.leave(h);
  assert.ok(idle(t)); assert.strictEqual(coin(a), 1000, 'host หลุดตอนรอ คืนเดิมพันผู้เข้าร่วม'); assert.strictEqual(h.rec.inv.coin, 1000);
  // หมดเวลารอ
  const h2 = mk('UHost2'); near(h2, id); arc(h2, 'create', id, { bet: 50 }); arc(a, 'join', id);
  w.arcTick(t.waitUntil + 1); assert.ok(idle(t)); assert.strictEqual(coin(h2), 1000); assert.strictEqual(coin(a), 1000, 'หมดเวลารอ คืนทุกคน');
  // startnow ต้องมี >= 2 คน แล้วเล่น
  arc(h2, 'create', id, { bet: 100 }); arc(h2, 'startnow', id); assert.strictEqual(t.state, 'waiting', 'คนเดียวเริ่มไม่ได้');
  arc(a, 'join', id); arc(a, 'startnow', id); assert.strictEqual(t.state, 'waiting', 'ไม่ใช่ host เริ่มไม่ได้');
  arc(h2, 'startnow', id); assert.strictEqual(t.state, 'playing'); assert.ok(t.players.every(q => q.hand.length === 7), 'แจกไพ่ 7 ใบ');
  assert.strictEqual(coin(h2), 900);
  // ผู้เล่นหลุดกลางเกม (2 คน) = ถูกตัดออก อีกฝั่งชนะรับกองกลางหักค่าบริการ
  const pot0 = w.lotto.pot; w.leave(a);
  assert.strictEqual(t.state, 'over'); const net = 200 - Math.floor(200 * S.RAKE);
  assert.strictEqual(w.saved[h2.key].inv.coin, 900 + net, 'ผู้ชนะ UNO ได้กองกลางหักค่าบริการ'); assert.strictEqual(w.lotto.pot, pot0 + 200 * S.RAKE, 'ค่าบริการ UNO เข้ากองกลาง');
  assert.strictEqual(a.rec.inv.coin, 900, 'ผู้หลุดเสียเดิมพัน');
  w.resetUno(t);
  // arcRefundAll ตอนกำลังเล่น: คืนเฉพาะมนุษย์ (บอทไม่ได้รับ)
  h2.rec.inv.coin = 1000; const c = mk('UC'); near(c, id); near(h2, id);
  arc(h2, 'create', id, { bet: 100 }); arc(c, 'join', id); arc(h2, 'startnow', id); assert.strictEqual(t.state, 'playing');
  w.arcRefundAll(); assert.strictEqual(coin(h2), 1000); assert.strictEqual(coin(c), 1000, 'arcRefundAll UNO: คืนทุกคนที่กำลังเล่น');
  w.resetUno(t);
  // เล่นกับบอท: เดิมพันของคน 1 คน
  h2.rec.inv.coin = 1000; const bet = 100; // ตอนนี้ S.BOTBET.bets = [0] (ปิดเดิมพันกับบอท) ขอเดิมพัน 100 → ถูกปัดเป็น 0
  assert.deepStrictEqual(S.BOTBET.bets, [0]);
  arc(h2, 'bot', id, { bet }); assert.strictEqual(t.state, 'playing'); assert.ok(t.bot); assert.strictEqual(t.bet, 0, 'เล่นกับบอทเดิมพันไม่ได้ (S.BOTBET ปิดอยู่)'); assert.strictEqual(coin(h2), 1000); assert.ok(t.players.some(q => q.bot));
  w.arcRefundAll(); assert.strictEqual(coin(h2), 1000, 'arcRefundAll ห้องบอท: ไม่มีเดิมพันไม่แจกเพิ่ม');
  w.resetUno(t);
  for (const p of [h2, a, b, c]) w.leave(p);
  console.log('  UNO: เข้า-ออกห้องรอ/ยกเลิก/หมดเวลา/หลุดกลางเกม/arcRefundAll/บอท');
}

// ---- เป่ายิ้งฉุบ (party) ----
{
  const id = cabOf('rps'), t = w.tables[id], h = mk('RHost'), a = mk('RA'); near(h, id); near(a, id);
  arc(h, 'create', id, { bet: 100 }); assert.strictEqual(t.state, 'waiting'); assert.strictEqual(coin(h), 900);
  arc(a, 'join', id); assert.strictEqual(coin(a), 900);
  arc(a, 'leave', id); assert.strictEqual(coin(a), 1000, 'ออกห้องรอ คืนเดิมพัน'); assert.strictEqual(t.players.length, 1);
  arc(a, 'join', id); arc(h, 'cancel', id);
  assert.ok(idle(t)); assert.strictEqual(coin(h), 1000); assert.strictEqual(coin(a), 1000, 'host ยกเลิก คืนทุกคน');
  arc(h, 'create', id, { bet: 100 }); arc(a, 'join', id); w.leave(h);
  assert.ok(idle(t)); assert.strictEqual(coin(a), 1000, 'host หลุดตอนรอ คืนผู้เข้าร่วม');
  const h2 = mk('RHost2'); near(h2, id); arc(h2, 'create', id, { bet: 100 }); arc(a, 'join', id);
  w.arcTick(t.waitUntil + 1); assert.ok(idle(t)); assert.strictEqual(coin(h2), 1000); assert.strictEqual(coin(a), 1000, 'หมดเวลารอ คืนทุกคน');
  arc(h2, 'create', id, { bet: 100 }); arc(a, 'join', id);
  const addbotBefore = t.players.length; arc(h2, 'addbot', id); assert.strictEqual(t.players.length, addbotBefore, 'ห้องเดิมพันเติมบอทไม่ได้');
  arc(h2, 'startnow', id); assert.strictEqual(t.state, 'playing');
  w.arcRefundAll(); assert.strictEqual(coin(h2), 1000); assert.strictEqual(coin(a), 1000, 'arcRefundAll ห้อง party ที่กำลังเล่น คืนทุกคน');
  w.resetParty(t);
  // เล่นกับบอท: เดิมพันเฉพาะเจ้าของ, หลุดกลางเกมหมด = จบ
  const bet = 100; arc(h2, 'bot', id, { bet });
  assert.strictEqual(t.state, 'playing'); assert.strictEqual(t.bet, 0, 'เล่นกับบอทเดิมพันไม่ได้ (S.BOTBET ปิดอยู่)'); assert.strictEqual(coin(h2), 1000);
  w.arcRefundAll(); assert.strictEqual(coin(h2), 1000, 'arcRefundAll ห้องบอท: ไม่แจกเพิ่ม');
  w.leave(h2); assert.strictEqual(t.state, 'over', 'คนเดียวที่เหลือหลุด จบเกม');
  w.resetParty(t); w.leave(a);
  console.log('  RPS(party): เข้า-ออก/ยกเลิก/หมดเวลา/arcRefundAll/บอท');
}

// ---- กันเล่นหลายโต๊ะพร้อมกัน + เดินห่างตู้ขณะเล่น ----
{
  const xo = cabOf('xo'), uno = cabOf('uno'), h = mk('Multi'), a = mk('Multi2'); near(h, xo); near(a, xo);
  arc(h, 'create', xo, { bet: 100 }); near(h, uno); arc(h, 'create', uno, { bet: 100 });
  assert.ok(idle(w.tables[uno]), 'นั่งโต๊ะอื่นอยู่แล้ว สร้างอีกโต๊ะไม่ได้'); assert.strictEqual(coin(h), 900);
  near(h, xo); arc(a, 'join', xo); assert.strictEqual(w.tables[xo].state, 'playing');
  h.x = 0; h.y = 0; w.arcRangeCheck(h);
  assert.strictEqual(w.tables[xo].state, 'over', 'คนนั่งเล่นเดินห่างตู้ = แพ้'); assert.strictEqual(w.tables[xo].winner === 'X' ? w.tables[xo].xId : w.tables[xo].oId, a.id);
  w.leave(h); w.leave(a); w.resetTable(w.tables[xo]);
  console.log('  กันหลายโต๊ะ + เดินห่างตู้ขณะเล่น');
}

console.log('arcade ok');
process.exit(0);
