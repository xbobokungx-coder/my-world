// ทดสอบแผงฝากขาย (server/systems/stall.js): ลงประกาศ/ซื้อ/ยกเลิก/หมดอายุ/ผู้ขายออฟไลน์/ความสด/ภาษี 7%/เหรียญรวมคงที่
// รัน: node tools/test-stall.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-stall-');
let NOW = Date.now(); Date.now = () => NOW;
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('stalltest');
let mint = 0; // เหรียญที่สร้างให้ผู้เล่นตอนตั้งฉาก + รางวัลจากระบบที่เกิดจากการซื้อขาย (เควส/มือใหม่ ฯลฯ) ซึ่งไม่ใช่เหรียญของแผง
{ const add0 = w.add; w.add = function (p, k, n, why, l) { if (k === 'coin' && n > 0 && why !== 'stall_sell') mint += n; return add0.call(this, p, k, n, why, l); }; }
const mk = (name, coin = 1000, pin = true) => { mint += coin; const p = { name, key: name.toLowerCase(), id: name, x: (S.FLEA.x + 0.5) * S.TS, y: (S.FLEA.y + 0.5) * S.TS, ws: { readyState: 0, send() {} }, rec: { name, inv: { coin }, skills: {}, starter: { done: {}, final: true } } }; if (pin) p.rec.pin = 'x'; w.players.set(name, p); w.saved[p.key] = p.rec; return p; };
const st = (p, m) => w.stallHandle(p, m);
const total = () => Object.values(w.saved).reduce((a, r) => a + (r.inv.coin || 0), 0) + w.lotto.pot + w.bids.reduce((a, b) => a + b.coin, 0); // กระเป๋าทุกคน + กองกลาง + เงินที่กันไว้ในคำเสนอซื้อ
const coin = p => p.rec.inv.coin || 0;
const left = (p, k) => p.rec.inv[k] || 0;
const lotSum = (rec, k) => (rec.lots && rec.lots[k] || []).reduce((a, x) => a + x[1], 0);
const T0 = total();

const A = mk('Aoy', 1000), B = mk('Ben', 1000), C = mk('Cat', 1000), N = mk('Nopin', 1000, false);
const same2 = why => assert.strictEqual(total(), T0 + mint, 'เหรียญรวมต้องคงที่: ' + why);
A.rec.inv.plank = 10; A.rec.inv.egg = 0; w.add(A, 'egg', 5);

// 1) ไม่มี PIN = ซื้อขายไม่ได้
N.rec.inv.plank = 5; st(N, { a: 'post', item: 'plank', n: 1, price: 58 }); assert.strictEqual(w.stall.length, 0); assert.strictEqual(left(N, 'plank'), 5);

// 2) ลงประกาศ: ตรวจเงื่อนไข
const base = S.tradeValue('plank'), lo = Math.ceil(base * S.STALL.min), hi = Math.floor(base * S.STALL.max);
st(A, { a: 'post', item: 'coin', n: 1, price: 10 }); st(A, { a: 'post', item: 'nonexistent', n: 1, price: 10 });
st(A, { a: 'post', item: 'plank', n: 0, price: base }); st(A, { a: 'post', item: 'plank', n: 11, price: base });
st(A, { a: 'post', item: 'plank', n: S.STALL.maxN + 1, price: base });
st(A, { a: 'post', item: 'plank', n: 1, price: lo - 1 }); st(A, { a: 'post', item: 'plank', n: 1, price: hi + 1 });
assert.strictEqual(w.stall.length, 0, 'ลงประกาศที่ผิดเงื่อนไขทั้งหมดต้องถูกปฏิเสธ'); assert.strictEqual(left(A, 'plank'), 10);
st(A, { a: 'post', item: 'plank', n: 4, price: lo }); st(A, { a: 'post', item: 'plank', n: 1, price: hi });
assert.strictEqual(w.stall.length, 2, 'ราคาขอบล่าง/ขอบบนใช้ได้'); assert.strictEqual(left(A, 'plank'), 5, 'ของออกจากกระเป๋าตอนลงประกาศ');
assert.deepStrictEqual(w.stallPub().map(x => [x.item, x.n, x.price, x.name]), [['plank', 4, lo, 'Aoy'], ['plank', 1, hi, 'Aoy']]);
same2('post');
// ช่องวางขายเต็ม
{ const big = mk('Big'); big.rec.inv.plank = 50; for (let i = 0; i < S.STALL.slots + 2; i++) st(big, { a: 'post', item: 'plank', n: 1, price: base });
  assert.strictEqual(w.stall.filter(x => x.seller === big.key).length, S.STALL.slots, 'วางได้ไม่เกิน slots');
  for (const x of w.stall.filter(x => x.seller === big.key)) st(big, { a: 'cancel', id: x.id }); assert.strictEqual(left(big, 'plank'), 50); }
same2('slots/cancel ของเต็ม');
// ลบรายการของ A ที่ลงไว้ (ยกเลิก = ของคืนครบ)
for (const x of [...w.stall]) st(A, { a: 'cancel', id: x.id }); assert.strictEqual(w.stall.length, 0); assert.strictEqual(left(A, 'plank'), 10, 'ยกเลิก = ของคืนครบ');

// 3) ยกเลิก: คนอื่นยกเลิกไม่ได้
st(A, { a: 'post', item: 'plank', n: 3, price: base }); const id1 = w.stall[0].id;
st(B, { a: 'cancel', id: id1 }); assert.strictEqual(w.stall.length, 1, 'คนอื่นยกเลิกของคนอื่นไม่ได้');
st(A, { a: 'buy', id: id1, n: 1 }); assert.strictEqual(w.stall[0].n, 3, 'ซื้อของตัวเองไม่ได้'); assert.strictEqual(coin(A), 1000);

// 4) ซื้อ: ภาษี 7% เข้ากองกลาง ผู้ขายได้ส่วนที่เหลือ
{
  const pot0 = w.lotto.pot, a0 = coin(A), b0 = coin(B), cost = 2 * base, tax = Math.floor(cost * S.STALL.tax);
  st(B, { a: 'buy', id: id1, n: 2 });
  const bq = coin(B) - (b0 - cost); assert.ok(bq >= 0 && bq <= S.QUEST_ALL.coin + 200, 'ผู้ซื้อจ่ายเต็ม (อาจได้รางวัลเควส)'); const qd = bq; assert.strictEqual(left(B, 'plank'), 2);
  assert.strictEqual(coin(A), a0 + cost - tax, 'ผู้ขายได้หลังหักภาษี'); assert.strictEqual(w.lotto.pot, pot0 + tax, 'ภาษีเข้ากองกลาง');
  assert.strictEqual(w.stall[0].n, 1, 'ซื้อบางส่วน เหลือบนแผง'); same2('buy บางส่วน');
  st(B, { a: 'buy', id: id1, n: 99 }); assert.strictEqual(left(B, 'plank'), 3, 'ซื้อเกินจำนวนที่เหลือ = ซื้อเท่าที่มี'); assert.strictEqual(w.stall.length, 0, 'ซื้อหมดแล้วรายการหายไป'); same2('buy หมด');
  st(B, { a: 'buy', id: id1, n: 1 }); assert.strictEqual(left(B, 'plank'), 3, 'รายการที่หายแล้วซื้อซ้ำไม่ได้');
}
// ภาษีปัดลง: ราคาเล็กมาก (ต่ำกว่า 15 บาท ภาษี 0)
{ const D = mk('Dan', 100); D.rec.inv.egg = 0; w.add(D, 'egg', 1); st(D, { a: 'post', item: 'egg', n: 1, price: 10 }); const pot0 = w.lotto.pot, d0 = coin(D);
  st(C, { a: 'buy', id: w.stall[0].id, n: 1 }); assert.strictEqual(w.lotto.pot, pot0, 'ภาษีปัดลงเป็น 0 ที่ราคา 10'); assert.strictEqual(coin(D), d0 + 10); same2('ภาษีปัดลง'); }

// 5) เหรียญไม่พอ / ไม่มี PIN
st(A, { a: 'post', item: 'plank', n: 1, price: hi }); { const id = w.stall[0].id, poor = mk('Poor', hi - 1), p0 = w.lotto.pot;
  st(poor, { a: 'buy', id, n: 1 }); assert.strictEqual(w.stall.length, 1, 'เหรียญไม่พอซื้อไม่ได้'); assert.strictEqual(coin(poor), hi - 1);
  N.rec.inv.coin = 5000; mint += 4000; st(N, { a: 'buy', id, n: 1 }); assert.strictEqual(w.stall.length, 1, 'ไม่มี PIN ซื้อไม่ได้'); assert.strictEqual(w.lotto.pot, p0);
  st(A, { a: 'cancel', id }); }
N.rec.inv.coin = 1000; mint -= 4000; same2('ปฏิเสธการซื้อ');

// 6) ความสดของสินค้า (lots) ส่งต่อถูก: ของเก่า/ใหม่ ซื้อทีละส่วน ของเก่าออกก่อน
{
  const E = mk('Eve', 5000), F = mk('Fay', 5000);
  E.rec.inv.egg = 0; E.rec.lots = {}; w.add(E, 'egg', 3); // ของเก่า
  NOW += 2 * 3600e3; w.add(E, 'egg', 2); // ของใหม่ (ห่างเกิน 1 นาที ไม่รวมกอง)
  const tOld = E.rec.lots.egg[0][0], tNew = E.rec.lots.egg[1][0]; assert.ok(tNew > tOld);
  st(E, { a: 'post', item: 'egg', n: 5, price: 20 }); const id = w.stall[0].id;
  assert.strictEqual(left(E, 'egg'), 0); assert.strictEqual(lotSum(E.rec, 'egg'), 0, 'ลงแผงแล้วกองอายุของผู้ขายหมด');
  assert.deepStrictEqual(w.stall[0].lots, [[tOld, 3], [tNew, 2]], 'แผงเก็บอายุของไว้');
  st(F, { a: 'buy', id, n: 4 });
  assert.deepStrictEqual(F.rec.lots.egg, [[tOld, 3], [tNew, 1]], 'ผู้ซื้อได้อายุของเก่าก่อน');
  assert.deepStrictEqual(w.stall[0].lots, [[tNew, 1]], 'เหลือบนแผงเป็นของใหม่'); assert.strictEqual(lotSum(F.rec, 'egg'), left(F, 'egg'), 'กองอายุ = จำนวนในกระเป๋า');
  st(E, { a: 'cancel', id }); assert.deepStrictEqual(E.rec.lots.egg, [[tNew, 1]], 'ยกเลิก: อายุของเดิมกลับคืน'); assert.strictEqual(left(E, 'egg'), 1);
}
// ของไม่เน่าไม่มีกอง lots ที่ใช้งานจริง
assert.strictEqual(w.stall.length, 0);

// 7) ผู้ขายออฟไลน์ก็ได้เงิน (ออกจากเกม แต่เซฟยังอยู่)
{
  const G = mk('Gus', 100), H = mk('Hal', 1000); G.rec.inv.plank = 2; st(G, { a: 'post', item: 'plank', n: 2, price: base });
  w.players.delete('Gus'); const pot0 = w.lotto.pot, cost = base, tax = Math.floor(cost * S.STALL.tax);
  st(H, { a: 'buy', id: w.stall[0].id, n: 1 });
  assert.strictEqual(w.saved.gus.inv.coin, 100 + cost - tax, 'ผู้ขายออฟไลน์ได้เงินหลังหักภาษี'); assert.strictEqual(w.lotto.pot, pot0 + tax); same2('ออฟไลน์');
  // ยกเลิกไม่ได้ถ้าไม่อยู่ในเกม แต่หมดอายุแล้วของคืนเข้าเซฟ
  NOW += S.STALL.days * 864e5 + 1000; w.stallExpire();
  assert.strictEqual(w.stall.length, 0); assert.strictEqual(w.saved.gus.inv.plank, 1, 'หมดอายุ: ของที่เหลือคืนเซฟผู้ขายออฟไลน์');
}

// 8) หมดอายุ: ผู้ขายออนไลน์ได้ของคืนพร้อมอายุเดิม; ก่อนครบเวลายังอยู่
{
  const I = mk('Ivy', 100); I.rec.inv.egg = 0; I.rec.lots = {}; w.add(I, 'egg', 2); const tt = I.rec.lots.egg[0][0];
  st(I, { a: 'post', item: 'egg', n: 2, price: 20 }); 
  NOW += S.STALL.days * 864e5 - 1000; w.stallExpire(); assert.strictEqual(w.stall.length, 1, 'ยังไม่ครบกำหนด รายการยังอยู่');
  NOW += 2000; assert.strictEqual(w.stallPub().length, 0, 'stallPub ล้างรายการหมดอายุ');
  assert.strictEqual(left(I, 'egg'), 2); assert.deepStrictEqual(I.rec.lots.egg, [[tt, 2]], 'หมดอายุคืนของพร้อมอายุเดิม'); same2('หมดอายุ');
  st(I, { a: 'buy', id: 999, n: 1 }); // id ที่ไม่มีอยู่ ไม่พัง
}

// 9) หมดอายุตอนมีคนพยายามซื้อ: ซื้อไม่ได้ (stallHandle เรียก expire ก่อน)
{
  const J = mk('Jay', 100), K = mk('Kim', 1000); J.rec.inv.plank = 1; st(J, { a: 'post', item: 'plank', n: 1, price: base }); const id = w.stall[0].id;
  NOW += S.STALL.days * 864e5 + 1; st(K, { a: 'buy', id, n: 1 });
  assert.strictEqual(left(K, 'plank'), 0); assert.strictEqual(coin(K), 1000); assert.strictEqual(left(J, 'plank'), 1, 'ของคืนผู้ขาย');
}

// 10) เซฟ/โหลด: รายการบนแผงอยู่รอดผ่านการเซฟ (stallNext ต่อเนื่อง)
{
  const L = mk('Lee', 100); L.rec.inv.plank = 2; st(L, { a: 'post', item: 'plank', n: 2, price: base }); const id = w.stall[0].id;
  st(L, { a: 'post', item: 'plank', n: 0, price: base }); assert.strictEqual(w.stall.length, 1);
  st(L, { a: 'cancel', id }); L.rec.inv.plank = 1; st(L, { a: 'post', item: 'plank', n: 1, price: base }); assert.ok(w.stall[0].id > id, 'id ไม่ซ้ำ');
  st(L, { a: 'cancel', id: w.stall[0].id });
}

// 11) ตลาดนัด: เสนอซื้อ (bid) / ขายให้ (fill) / ยกเลิก (bcancel) / หมดอายุ / ความสด / กันโกง
{
  const bs = w.bids.length; assert.strictEqual(bs, 0);
  const P = mk('Pim', 3000), Q = mk('Quin', 500), R = mk('Ray', 500); Q.rec.inv.plank = 10;
  // ไกลป้าย: เสนอซื้อ/ขาย/วางขาย/ซื้อ ไม่ได้ แต่ยกเลิกได้
  const far = mk('Far', 1000); far.x = 0; far.y = 0; far.rec.inv.plank = 3;
  st(far, { a: 'bid', item: 'plank', n: 1, price: base }); st(far, { a: 'post', item: 'plank', n: 1, price: base });
  assert.strictEqual(w.bids.length, 0); assert.strictEqual(w.stall.length, 0); assert.strictEqual(coin(far), 1000, 'ไกลป้าย = ไม่ถูกหักเงิน'); same2('ไกลป้าย');
  // ตรวจเงื่อนไขการเสนอซื้อ
  st(P, { a: 'bid', item: 'coin', n: 1, price: 10 }); st(P, { a: 'bid', item: 'nonexistent', n: 1, price: 10 });
  st(P, { a: 'bid', item: 'plank', n: 0, price: base }); st(P, { a: 'bid', item: 'plank', n: -3, price: base }); st(P, { a: 'bid', item: 'plank', n: NaN, price: base });
  st(P, { a: 'bid', item: 'plank', n: S.STALL.maxN + 1, price: base }); st(P, { a: 'bid', item: 'plank', n: 1, price: lo - 1 }); st(P, { a: 'bid', item: 'plank', n: 1, price: hi + 1 });
  st(P, { a: 'bid', item: 'plank', n: 1, price: -5 }); st(P, { a: 'bid', item: 'plank', n: 1, price: Infinity }); st(P, { a: 'bid', item: 'plank', n: 1, price: base, fresh: 3 }); st(P, { a: 'bid', item: 'plank', n: 1, price: base, fresh: -1 });
  st(N, { a: 'bid', item: 'plank', n: 1, price: base }); st(Q, { a: 'bid', item: 'plank', n: 100, price: hi });
  assert.strictEqual(w.bids.length, 0, 'เสนอซื้อผิดเงื่อนไข/ไม่มี PIN/เงินไม่พอ ถูกปฏิเสธหมด'); assert.strictEqual(coin(P), 3000); assert.strictEqual(coin(Q), 500); same2('bid ปฏิเสธ');
  // เสนอซื้อ plank 5 ชิ้น: เงินถูกกันไว้
  st(P, { a: 'bid', item: 'plank', n: 5, price: base, fresh: 0 }); assert.strictEqual(w.bids.length, 1); assert.strictEqual(coin(P), 3000 - 5 * base); assert.strictEqual(w.bids[0].coin, 5 * base); same2('bid escrow');
  const bid = w.bids[0], bpub = w.bidsPub()[0]; assert.ok(!('ip' in bpub) && !('coin' in bpub), 'ไม่ส่ง ip/coin'); assert.deepStrictEqual(Object.keys(bpub).sort(), ['fresh', 'id', 'item', 'mine', 'n', 'name', 'price']);
  // ขายให้ตัวเองไม่ได้ / ไกลป้ายขายไม่ได้ / ของไม่พอ / จำนวนผิด
  P.rec.inv.plank = 9; st(P, { a: 'fill', id: bid.id, n: 1 }); assert.strictEqual(bid.n, 5, 'ขายให้คำเสนอของตัวเองไม่ได้'); P.rec.inv.plank = 0;
  far.x = 0; st(far, { a: 'fill', id: bid.id, n: 1 }); assert.strictEqual(bid.n, 5, 'ไกลป้ายขายไม่ได้');
  st(R, { a: 'fill', id: bid.id, n: 1 }); st(Q, { a: 'fill', id: bid.id, n: 0 }); st(Q, { a: 'fill', id: bid.id, n: -2 }); st(Q, { a: 'fill', id: bid.id, n: NaN });
  assert.strictEqual(bid.n, 5, 'ไม่มีของ/จำนวนผิด ขายไม่ได้'); assert.strictEqual(left(Q, 'plank'), 10); same2('fill ปฏิเสธ');
  // ขายบางส่วน: ภาษี 7% เข้ากองกลาง ผู้ซื้อได้ของ
  { const pot0 = w.lotto.pot, q0 = coin(Q), cost = 2 * base, tax = Math.floor(cost * S.STALL.tax); st(Q, { a: 'fill', id: bid.id, n: 2 });
    const gain = coin(Q) - q0; assert.ok(gain >= cost - tax && gain <= cost - tax + S.QUEST_ALL.coin + 200, 'ผู้ขายได้หลังหักภาษี (อาจมีรางวัลเควส)');
    assert.strictEqual(w.lotto.pot, pot0 + tax); assert.strictEqual(left(P, 'plank'), 2); assert.strictEqual(left(Q, 'plank'), 8); assert.strictEqual(bid.n, 3); assert.strictEqual(bid.coin, 3 * base); same2('fill บางส่วน'); }
  st(Q, { a: 'fill', id: bid.id, n: 99 }); assert.strictEqual(left(Q, 'plank'), 5, 'ขายเกินจำนวนที่ขอ = ขายเท่าที่ขอ');  // 99 ถูกจำกัดเหลือ 3
  assert.strictEqual(w.bids.length, 0, 'ขายครบแล้วคำเสนอหาย'); assert.strictEqual(left(P, 'plank'), 5 - 0, 'ผู้ซื้อได้ครบ 5'); same2('fill ครบ');
  Q.rec.inv.plank = 10;
}
// ยกเลิก: คืนเงินเต็มที่เหลือ คนอื่นยกเลิกไม่ได้ ยกเลิกได้แม้ไกลป้าย
{
  const U = mk('Uma', 1000), V = mk('Vic', 1000); st(U, { a: 'bid', item: 'plank', n: 4, price: base }); const id = w.bids[0].id; assert.strictEqual(coin(U), 1000 - 4 * base);
  st(V, { a: 'bcancel', id }); assert.strictEqual(w.bids.length, 1, 'คนอื่นยกเลิกไม่ได้');
  U.x = 0; U.y = 0; st(U, { a: 'bcancel', id }); assert.strictEqual(w.bids.length, 0); assert.strictEqual(coin(U), 1000, 'ยกเลิกแล้วได้เงินคืนเต็ม'); same2('bcancel');
  st(U, { a: 'bcancel', id }); assert.strictEqual(coin(U), 1000, 'ยกเลิกซ้ำไม่ได้เงินเพิ่ม'); same2('bcancel ซ้ำ');
  // โควตา bidSlots
  U.x = V.x; U.y = V.y; for (let i = 0; i < S.STALL.bidSlots + 2; i++) st(U, { a: 'bid', item: 'plank', n: 1, price: base });
  assert.strictEqual(w.bids.filter(b => b.buyer === U.key).length, S.STALL.bidSlots); same2('bidSlots');
  for (const b of [...w.bids]) st(U, { a: 'bcancel', id: b.id }); assert.strictEqual(coin(U), 1000); same2('ล้าง bids');
}
// หมดอายุ: คืนเงิน (ออนไลน์/ออฟไลน์) ก่อนครบเวลายังอยู่
{
  const X = mk('Xan', 1000), Y = mk('Yo', 1000); st(X, { a: 'bid', item: 'plank', n: 3, price: base }); st(Y, { a: 'bid', item: 'plank', n: 2, price: base });
  w.players.delete('Yo'); NOW += S.STALL.bidDays * 864e5 - 1000; w.stallExpire(); assert.strictEqual(w.bids.length, 2, 'ยังไม่ครบกำหนด');
  NOW += 2000; assert.strictEqual(w.bidsPub().length, 2); w.stallPub(); assert.strictEqual(w.bids.length, 0, 'หมดอายุแล้วเคลียร์');
  assert.strictEqual(coin(X), 1000); assert.strictEqual(w.saved.yo.inv.coin, 1000, 'ออฟไลน์ก็ได้เงินคืน'); same2('bid หมดอายุ');
}
// ความสด: fresh 0 รับเฉพาะสด, ของค้างขายไม่ได้ / fresh 2 รับทุกสภาพ / ของที่ได้ติดอายุไปด้วย
{
  const M = mk('Mia', 5000), O = mk('Oak', 5000); O.rec.inv.egg = 0; O.rec.lots = {};
  w.add(O, 'egg', 3); NOW += 30 * 3600e3; w.add(O, 'egg', 2); // 3 ชิ้นแรกค้าง (30 ชม.) 2 ชิ้นหลังสด
  const tOld = O.rec.lots.egg[0][0], tNew = O.rec.lots.egg[1][0];
  st(M, { a: 'bid', item: 'egg', n: 5, price: 20, fresh: 0 }); const b0 = w.bids[0];
  st(O, { a: 'fill', id: b0.id, n: 1 }); assert.strictEqual(b0.n, 5, 'ของเก่าออกก่อน = ค้าง ปฏิเสธ (fresh 0)'); assert.strictEqual(left(O, 'egg'), 5);
  st(M, { a: 'bcancel', id: b0.id });
  st(M, { a: 'bid', item: 'egg', n: 4, price: 20, fresh: 1 }); const b1 = w.bids[0];
  st(O, { a: 'fill', id: b1.id, n: 4 }); assert.strictEqual(w.bids.length, 0); assert.deepStrictEqual(M.rec.lots.egg, [[tOld, 3], [tNew, 1]], 'ผู้ซื้อได้อายุของเดิม'); assert.strictEqual(lotSum(M.rec, 'egg'), left(M, 'egg'));
  assert.deepStrictEqual(O.rec.lots.egg, [[tNew, 1]]); same2('ความสด');
  NOW += 50 * 3600e3; // ของ tNew เป็นของเก่า (เกิน 72 ชม.? 50 ชม. = ค้าง) -> เลื่อนอีกให้เก่า
  NOW += 40 * 3600e3; st(M, { a: 'bid', item: 'egg', n: 1, price: 20, fresh: 1 }); st(O, { a: 'fill', id: w.bids[0].id, n: 1 }); assert.strictEqual(left(O, 'egg'), 1, 'ของเก่า(🔴)ขายให้ fresh 1 ไม่ได้');
  st(M, { a: 'bcancel', id: w.bids[0].id }); st(M, { a: 'bid', item: 'egg', n: 1, price: 20, fresh: 2 }); st(O, { a: 'fill', id: w.bids[0].id, n: 1 }); assert.strictEqual(left(O, 'egg'), 0, 'fresh 2 รับทุกสภาพ'); same2('ความสด 2');
  // ข้อมูลสาธารณะของแผง: fr = [สด, ค้าง, เก่า]
  O.rec.inv.egg = 0; O.rec.lots = {}; w.add(O, 'egg', 2); NOW += 30 * 3600e3; w.add(O, 'egg', 1); st(O, { a: 'post', item: 'egg', n: 3, price: 20 });
  assert.deepStrictEqual(w.stallPub().find(x => x.item === 'egg').fr, [1, 2, 0], 'fr = สด/ค้าง/เก่า'); assert.ok(!('fr' in w.stallPub().find(x => x.item === 'egg') && false));
  st(O, { a: 'cancel', id: w.stall[0].id });
}
// โหลดเซฟ: คำเสนอซื้อรอดผ่านเซฟ/โหลด id ไม่ซ้ำ; รายการเสียถูกทิ้งแต่คืนเงินให้เจ้าของ
{
  const Z = mk('Zed', 1000); st(Z, { a: 'bid', item: 'plank', n: 3, price: base }); const keep = w.bids[0]; const snap = JSON.parse(JSON.stringify(w.bids));
  const c0 = coin(Z), t0 = total();
  const bad = [{ id: 901, buyer: Z.key, name: 'Zed', item: 'plank', n: 2, price: base, coin: 2 * base + 7, fresh: 0, ip: '', t: NOW }, // coin ไม่ตรง
    { id: 902, buyer: Z.key, name: 'Zed', item: 'coin', n: 1, price: 10, coin: 10, fresh: 0, ip: '', t: NOW }, // ของที่เทรดไม่ได้
    { id: 903, buyer: Z.key, name: 'Zed', item: 'plank', n: 1, price: base, coin: base, fresh: 9, ip: '', t: NOW }, null, 5, { buyer: 'ghost', coin: 50 }];
  const before = total(); w.loadBids([...snap, ...bad]);
  assert.strictEqual(w.bids.length, 1, 'เหลือเฉพาะรายการดี'); assert.strictEqual(w.bids[0].id, keep.id);
  assert.strictEqual(coin(Z), c0 + (2 * base + 7) + base + 10, 'คืนเงินของรายการเสียให้เจ้าของ');
  assert.strictEqual(total() - before, (2 * base + 7) + base + 10, 'เงินรวมเพิ่มเท่าที่คืน (ของที่ถูกกันไว้ไม่ได้อยู่ในโหลดเปล่า)');
  mint += (2 * base + 7) + base + 10; same2('โหลดเซฟเสีย');
  st(Z, { a: 'bcancel', id: keep.id }); same2('จบ');
}
same2('จบทั้งหมด');
console.log('test-stall ผ่านทั้งหมด'); process.exit(0);
