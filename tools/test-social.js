// ทดสอบเทรดระหว่างผู้เล่น: ของไม่หักจนกว่ากดยืนยันครบ (จึงไม่มี escrow จริง) ยกเลิก/ปฏิเสธ/หลุด = ของอยู่ที่เดิม (characterization): node tools/test-social.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-social-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;

const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('social');
function mk(name, inv) {
  const ws = mkWs(), p = w.join(ws, name, '#fff').p; p.ws2 = ws; p.rec.inv = Object.assign({ coin: 500 }, inv);
  p.x = 10 * TS; p.y = 20 * TS; return p;
}
const tr = (p, m) => w.handle(p, Object.assign({ t: 'trade' }, m));
const evs = p => p.ws2.msgs.filter(m => m.t === 'trade').map(m => m.ev);
const snapInv = p => JSON.stringify(p.rec.inv);
// เปิดห้องเทรดให้ a กับ b พร้อมเสนอของ (ยังไม่กดยืนยัน)
function open(a, b) { tr(a, { a: 'req', to: b.id }); tr(b, { a: 'accept' }); }

// ---- ขอเทรด: เงื่อนไข ----
{
  const a = mk('TrA', { crop_carrot: 10 }), b = mk('TrB', { crop_corn: 10 }), c = mk('TrC'), far = mk('TrFar'); far.x = 40 * TS;
  tr(a, { a: 'req', to: 99999 }); assert.ok(!a.tradeId, 'ไม่พบผู้เล่น'); tr(a, { a: 'req', to: a.id }); assert.ok(!a.tradeId, 'เทรดกับตัวเองไม่ได้');
  tr(a, { a: 'req', to: far.id }); assert.ok(!a.tradeId && !far.tradeId, 'ไกลเกิน S.TRADE.range เทรดไม่ได้');
  tr(a, { a: 'req', to: b.id });
  assert.ok(a.tradeId && a.tradeId === b.tradeId, 'จองคู่เทรดไว้ทั้งสองฝั่ง'); assert.ok(evs(b).includes('req') && evs(a).includes('wait'));
  assert.strictEqual(w.trades.get(a.tradeId).open, false, 'ยังไม่เปิดจนกว่าอีกฝ่ายตอบรับ');
  tr(a, { a: 'accept' }); assert.strictEqual(w.trades.get(a.tradeId).open, false, 'ผู้ขอรับเองไม่ได้ (เฉพาะฝั่งผู้ถูกขอ)');
  tr(c, { a: 'req', to: b.id }); assert.ok(!c.tradeId, 'อีกฝ่ายติดเทรดอยู่ ขอซ้อนไม่ได้');
  tr(b, { a: 'accept' }); assert.strictEqual(w.trades.get(a.tradeId).open, true);
  tr(a, { a: 'offer', item: 'coin', qty: 5 }); assert.deepStrictEqual(w.trades.get(a.tradeId).a.offer, {}, 'เหรียญเทรดไม่ได้');
  tr(a, { a: 'offer', item: 'crop_carrot', qty: 99999 }); assert.deepStrictEqual(w.trades.get(a.tradeId).a.offer, { crop_carrot: 10 }, 'เสนอเกินที่มี = ปัดเหลือที่มีอยู่');
  tr(a, { a: 'offer', item: 'crop_carrot', qty: 0 }); assert.deepStrictEqual(w.trades.get(a.tradeId).a.offer, {}, 'qty 0 = ถอนของออกจากข้อเสนอ');
  tr(a, { a: 'cancel' });
  for (const p of [a, b, c, far]) w.leave(p);
  console.log('  ขอเทรด: ไม่พบ/ตัวเอง/ไกล/ซ้อน/รับเฉพาะผู้ถูกขอ/เหรียญเทรดไม่ได้/ปัดตามที่มี');
}

// ---- ยกเลิก/ปฏิเสธ: ของไม่หาย ไม่ย้าย ----
{
  const a = mk('CxA', { crop_carrot: 10, crop_corn: 4 }), b = mk('CxB', { crop_tomato: 6 });
  const a0 = snapInv(a), b0 = snapInv(b);
  open(a, b); tr(a, { a: 'offer', item: 'crop_carrot', qty: 5 }); tr(b, { a: 'offer', item: 'crop_tomato', qty: 3 });
  const t = w.trades.get(a.tradeId); assert.deepStrictEqual(t.a.offer, { crop_carrot: 5 }); assert.deepStrictEqual(t.b.offer, { crop_tomato: 3 });
  assert.strictEqual(snapInv(a), a0, 'เสนอของแล้วของยังอยู่ในกระเป๋า (ไม่มีการกันของ)'); assert.strictEqual(snapInv(b), b0);
  tr(a, { a: 'ok', on: true }); assert.ok(t.a.ok && !t.b.ok); tr(b, { a: 'offer', item: 'crop_tomato', qty: 2 }); assert.ok(!t.a.ok && !t.b.ok, 'แก้ข้อเสนอ ต้องยืนยันใหม่ทั้งคู่');
  tr(a, { a: 'cancel' });
  assert.strictEqual(w.trades.size, 0); assert.strictEqual(a.tradeId, 0); assert.strictEqual(b.tradeId, 0);
  assert.strictEqual(snapInv(a), a0, 'ยกเลิก: ของครบเหมือนเดิม'); assert.strictEqual(snapInv(b), b0);
  const closed = p => p.ws2.msgs.filter(m => m.t === 'trade' && m.ev === 'closed').pop();
  assert.ok(closed(a) && closed(b)); assert.ok(/ยกเลิกการเทรด/.test(closed(b).why) && closed(b).why.includes('CxA'));
  // ปฏิเสธตอนยังไม่เปิด
  tr(a, { a: 'req', to: b.id }); tr(b, { a: 'decline' }); assert.strictEqual(w.trades.size, 0); assert.ok(!a.tradeId && !b.tradeId); assert.ok(/ปฏิเสธ/.test(closed(a).why) && closed(a).why.includes('CxB'));
  assert.strictEqual(snapInv(a), a0);
  // ยกเลิกแล้วขอเทรดใหม่ได้
  open(a, b); assert.ok(a.tradeId && w.trades.get(a.tradeId).open); tr(b, { a: 'cancel' });
  for (const p of [a, b]) w.leave(p);
  console.log('  ยกเลิก/ปฏิเสธ: ของอยู่ที่เดิม ห้องถูกล้าง ทั้งสองฝั่งได้ข้อความปิด');
}

// ---- ผู้เล่นหลุดกลางเทรด: ยกเลิกห้อง ของอยู่กับเจ้าของ อีกฝั่งปลดล็อก ----
{
  const a = mk('LvA', { crop_carrot: 10 }), b = mk('LvB', { crop_corn: 10 }), a0 = snapInv(a);
  open(a, b); tr(a, { a: 'offer', item: 'crop_carrot', qty: 10 }); tr(b, { a: 'offer', item: 'crop_corn', qty: 10 }); tr(a, { a: 'ok', on: true });
  const aRec = a.rec; w.leave(b);
  assert.strictEqual(w.trades.size, 0, 'หลุด = ยกเลิกห้อง'); assert.strictEqual(a.tradeId, 0, 'อีกฝั่งปลดล็อกเทรดได้ใหม่');
  assert.ok(a.ws2.msgs.filter(m => m.t === 'trade' && m.ev === 'closed').pop().why === 'ผู้เล่นออกจากเกม');
  assert.strictEqual(snapInv(a), a0, 'ของของผู้ที่ยังอยู่ไม่ถูกแตะ'); assert.strictEqual(w.saved[b.key].inv.crop_corn, 10, 'ของของผู้หลุดอยู่ครบในเซฟ'); assert.strictEqual(aRec.inv.crop_carrot, 10);
  const c = mk('LvC', {}); tr(a, { a: 'req', to: c.id }); assert.ok(a.tradeId, 'หลังอีกฝั่งหลุด ขอเทรดกับคนอื่นต่อได้'); tr(a, { a: 'cancel' });
  // ผู้ขอที่หลุดตอนยังรอตอบรับ
  const d = mk('LvD', {}); tr(c, { a: 'req', to: d.id }); w.leave(c); assert.strictEqual(w.trades.size, 0); assert.strictEqual(d.tradeId, 0);
  assert.ok(d.ws2.msgs.filter(m => m.t === 'trade' && m.ev === 'closed').pop(), 'ผู้ถูกขอได้ข้อความปิดห้อง');
  for (const p of [a, d]) w.leave(p);
  console.log('  หลุดกลางเทรด: ห้องถูกยกเลิก/ของไม่หาย/อีกฝั่งปลดล็อก');
}

// ---- สำเร็จ: สลับของ อายุของติดไปด้วย ตรวจเฉพาะเมื่อกดยืนยันครบ ----
{
  const a = mk('OkA', { crop_carrot: 10 }), b = mk('OkB', { crop_corn: 10 });
  const ageA = w.lotsOf(a.rec, 'crop_carrot').map(x => x.slice());
  open(a, b); tr(a, { a: 'offer', item: 'crop_carrot', qty: 4 }); tr(b, { a: 'offer', item: 'crop_corn', qty: 6 });
  tr(a, { a: 'ok', on: true }); assert.strictEqual(w.trades.size, 1, 'ฝั่งเดียวยืนยัน ยังไม่แลก'); assert.strictEqual(a.rec.inv.crop_carrot, 10);
  tr(a, { a: 'ok', on: false }); tr(a, { a: 'ok', on: true }); tr(b, { a: 'ok', on: true });
  assert.strictEqual(w.trades.size, 0); assert.ok(!a.tradeId && !b.tradeId);
  assert.strictEqual(a.rec.inv.crop_carrot, 6); assert.strictEqual(b.rec.inv.crop_carrot, 4); assert.strictEqual(a.rec.inv.crop_corn, 6); assert.strictEqual(b.rec.inv.crop_corn, 4, 'สลับของครบ');
  assert.ok(evs(a).includes('done') && evs(b).includes('done'));
  assert.deepStrictEqual(w.lotsOf(b.rec, 'crop_carrot').reduce((s, x) => s + x[1], 0), 4, 'อายุของ (lots) ย้ายตามไปด้วย จำนวนรวมตรงกับกระเป๋า');
  assert.ok(w.lotsOf(b.rec, 'crop_carrot').every(x => x[0] === ageA[0][0]), 'ของที่ได้ยังมีอายุเดิม ไม่สดขึ้นเพราะเทรด');
  // ของในกระเป๋าเปลี่ยนก่อนยืนยัน → ไม่แลก ล้างการยืนยัน ห้องยังอยู่
  open(a, b); tr(a, { a: 'offer', item: 'crop_carrot', qty: 6 }); tr(b, { a: 'offer', item: 'crop_corn', qty: 4 }); a.rec.inv.crop_carrot = 1;
  tr(a, { a: 'ok', on: true }); tr(b, { a: 'ok', on: true });
  assert.strictEqual(w.trades.size, 1, 'ของไม่พอตอนยืนยัน ห้องยังเปิด'); assert.ok(!w.trades.get(a.tradeId).a.ok && !w.trades.get(a.tradeId).b.ok);
  assert.strictEqual(a.rec.inv.crop_carrot, 1); assert.strictEqual(b.rec.inv.crop_carrot, 4, 'ไม่มีของย้าย');
  tr(a, { a: 'cancel' });
  // เพดานมูลค่า
  a.rec.inv.crop_carrot = 999; open(a, b); tr(a, { a: 'offer', item: 'crop_carrot', qty: 999 });
  assert.deepStrictEqual(w.trades.get(a.tradeId).a.offer, {}, 'ข้อเสนอเกินเพดานมูลค่า S.TRADE.maxValue ถูกปฏิเสธ'); tr(a, { a: 'cancel' });
  for (const p of [a, b]) w.leave(p);
  console.log('  สำเร็จ: ต้องกดครบสองฝั่ง/สลับของ+อายุของติดไป/ของเปลี่ยนก่อนยืนยันไม่แลก/เพดานมูลค่า');
}

console.log('social ok');
process.exit(0);
