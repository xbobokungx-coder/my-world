// ทดสอบกองกลาง หวยประจำวัน และภาษีขาย: node tools/test-lotto.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-lotto-');
const { World } = require('../server.js'), S = require('../public/shared.js');

// ---- ภาษีขาย ----
{
  for (const c of [500, 1000, 2000, 5000, 10000, 20000, 60000, 1e6]) assert.ok(S.saleTax(0, c) <= c * 0.07 + 1, 'ภาษีต้องไม่เกิน 7% ของราคาขาย ' + c);
  assert.strictEqual(S.saleTax(0, 1000), 0, 'ต่ำกว่า 1,000 ไม่เสีย');
  assert.deepStrictEqual([2000, 5000, 10000, 20000, 60000].map(c => S.saleTax(0, c)), [20, 80, 280, 780, 3380]);
  let h = 0, t = 0; for (let i = 0; i < 60; i++) { t += S.saleTax(h, 1000); h += 1000; }
  assert.strictEqual(t, S.saleTax(0, 60000), 'ทยอยขายชิ้นละ 1,000 ต้องเสียเท่าขายรวดเดียว');
  const now = Date.now(), H = S.TAX.fadeMs;
  assert.strictEqual(Math.round(S.heatOf([[now - H / 2, 10000]], now)), 5000, 'ผ่านไปครึ่งวัน ยอดสะสมเหลือครึ่ง');
  assert.strictEqual(S.heatOf([[now - H, 10000]], now), 0, 'ครบ 24 ชม. ยอดสะสมเป็น 0');
  assert.strictEqual(S.saleTax(S.heatOf([[now - H, 60000]], now), 5000), S.saleTax(0, 5000), 'ครบ 24 ชม. เสียภาษีเหมือนเริ่มใหม่');
  assert.strictEqual(S.taxRate(50000), 0.07); assert.strictEqual(S.taxRate(500), 0);
  assert.strictEqual(S.STALL.tax, 0.07, 'ภาษีแผงฝากขายเท่าเพดานภาษีร้าน');
  console.log('  ภาษีขาย: ไม่เกิน 7% ทยอยขาย=รวดเดียว จางเส้นตรง 24 ชม.');
}

// ---- หวย ----
const w = new World('main');
assert.strictEqual(w.lotto.pot, S.LOTTO.seed, 'กองตั้งต้น 30,000');
const mk = (name, coin = 10000) => { const p = { name, key: name.toLowerCase(), id: name, x: 0, y: 0, ws: { readyState: 0, send() {} }, rec: { name, inv: { coin }, skills: { farm: 400, fish: 400, animal: 400, wood: 400, cook: 400 }, starter: { done: {}, final: true } } }; w.players.set(name, p); w.saved[p.key] = p.rec; return p; };
const a = mk('A'), b = mk('B'), c = mk('C'), newbie = mk('N'); newbie.rec.skills = {}; newbie.rec.starter = { done: {}, final: false };
const seal = (n1, n2, n3) => { const nums = [n1, n2, n3], salt = 'x'; w.lotto.sealed = { nums, salt, hash: w.lottoHash(nums, salt) }; };
const draw = () => w.lottoDraw();
{
  const L = w.lotto, pot0 = L.pot;
  w.lottoBuy(newbie, { nums: ['123'] }); assert.strictEqual(L.tickets.n, undefined, 'คนใหม่ซื้อไม่ได้');
  a.x = (S.LUCKY.x + 0.5) * S.TS; a.y = (S.LUCKY.y + 0.5) * S.TS; b.x = a.x; b.y = a.y; c.x = a.x; c.y = a.y; newbie.x = a.x; newbie.y = a.y; w.lottoBuy(a, { nums: ['123', null, 'zz', '12', '4567', '007', '999', '000', '111', '222', '333', '444'] });
  assert.strictEqual(L.tickets.a.length, S.LOTTO.maxTickets, 'ซื้อได้สูงสุด 10 ใบ');
  assert.ok(L.tickets.a.every(x => /^\d{3}$/.test(x)), 'เลขเสียรูปแบบ = สุ่มให้เป็น 3 หลัก');
  assert.strictEqual(a.rec.inv.coin, 10000 - 10 * S.LOTTO.price); assert.strictEqual(S.LOTTO.price, 100); assert.strictEqual(L.pot, pot0 + 1000, 'ค่าตั๋วเข้ากองกลาง');
  w.lottoBuy(a, { nums: ['111'] }); assert.strictEqual(L.tickets.a.length, 10, 'ใบที่ 11 ซื้อไม่ได้');
  assert.deepStrictEqual(w.lottoPub(a).buyers, [['A', 10]], 'แสดงว่าใครซื้อกี่ใบ'); assert.ok(!JSON.stringify(w.lottoPub(b)).includes(L.tickets.a[0] + '"'), 'ไม่เผยเลขตั๋วของคนอื่น');
  const far = mk('Far'); far.x = 0; far.y = 0; w.lottoBuy(far, { nums: ['111'] }); assert.strictEqual(L.tickets.far, undefined, 'ต้องยืนใกล้ตู้ Lucky Lotto ถึงซื้อได้');
  const broke = mk('Poor', 20); w.lottoBuy(broke, { nums: ['111'] }); assert.strictEqual(L.tickets.poor, undefined, 'เหรียญไม่พอซื้อไม่ได้');
  // ปิดรับก่อนออกผล
  const real = Date.now; Date.now = () => w.lottoDrawAt(L.round) - 1000; w.lottoBuy(b, { nums: ['222'] }); Date.now = real;
  assert.strictEqual(L.tickets.b, undefined, 'ปิดรับตั๋ว 1 นาทีก่อนออกผล');
  assert.ok(L.sealed.hash && L.sealed.hash.length === 64 && w.lottoPub(a).hash === L.sealed.hash && !JSON.stringify(w.lottoPub(a)).includes(L.sealed.salt), 'ผู้เล่นเห็นแต่ hash ไม่เห็นเลข/เกลือ');
  console.log('  ซื้อตั๋ว: จำกัด 10 ใบ ใบละ 100 เลขสุ่ม/เลือก ค่าตั๋วเข้ากอง ปิดรับก่อนออกผล');
}
{ // ออกรางวัล 7 ชนิด: หารเท่ากัน เลขซ้ำนับต่อใบ เพดาน และ hash ตรวจได้ (ตั๋ว a: 123 สองใบ 456 • b: 123 989 • c: 700)
  const L = w.lotto; L.tickets = { a: ['123', '123', '456'], b: ['123', '989'], c: ['700'] };
  seal('123', '589', '600'); L.pot = 100000; const before = { a: a.rec.inv.coin, b: b.rec.inv.coin, c: c.rec.inv.coin }, r0 = L.round;
  draw();
  // รางวัล1 ตรง 123: 3 ใบ 50,000/3 • รางวัล2 ท้าย 89: b '989' 5,000 • รางวัล3 ท้าย 00: c '700' 5,000 • หน้า2 '12': 123 ทั้ง 3 ใบ 5,000/3 • ท้าย1 '3': 123 ทั้ง 3 ใบ ใบละ 500 (ไม่หาร)
  const r1 = Math.floor(50000 / 3), f2 = Math.floor(5000 / 3), t1 = Math.floor(100000 * 0.005);
  assert.strictEqual(t1, 500);
  assert.strictEqual(a.rec.inv.coin - before.a, 2 * r1 + 2 * f2 + 2 * t1, 'a ถือ 123 สองใบ ได้รางวัล 1 + หน้า2 + ท้าย1 อย่างละสองส่วน');
  assert.strictEqual(b.rec.inv.coin - before.b, r1 + 5000 + f2 + t1, 'b ได้รางวัล 1 + รางวัล 2 เต็ม + หน้า2 + ท้าย1 อย่างละหนึ่งส่วน');
  assert.strictEqual(c.rec.inv.coin - before.c, 5000, 'c ได้รางวัล 3 (5% ของกอง)');
  const out = 3 * r1 + 5000 + 5000 + 3 * f2 + 3 * t1;
  assert.strictEqual(L.pot, 100000 - out, 'กองลดตามที่จ่าย');
  assert.notStrictEqual(L.round, r0, 'เปิดงวดใหม่'); assert.deepStrictEqual(L.tickets, {}, 'ตั๋วงวดใหม่ว่าง');
  assert.ok(L.last && L.last.nums[0] === '123' && L.last.hash && L.last.salt, 'เก็บผลงวดก่อน + เกลือให้ตรวจ hash');
  assert.strictEqual(w.lottoHash(L.last.nums, L.last.salt), L.last.hash, 'ตรวจ hash ตรงกับเลขที่เปิด');
  console.log('  ออกรางวัล: หารเท่ากัน เลขซ้ำนับต่อใบ เพดาน และ hash ตรวจได้');
}
{ // ตารางรางวัลสมดุล: 7 รางวัล ลำดับ/ค่าตามที่ออกแบบ
  const P = S.LOTTO.prize; assert.strictEqual(P.length, 7); assert.strictEqual(S.LOTTO.maxTickets, 10);
  assert.deepStrictEqual(P.map(x => [x.pct, x.cap]), [[0.5, 100000], [0.05, 10000], [0.05, 10000], [0.12, 25000], [0.05, 10000], [0.25, 50000], [0.005, 1000]]);
  assert.ok(P[6].each && P[6].min === 100 && P[3].tote && P[4].front === 2 && P[5].near, 'ท้าย1 จ่ายทุกใบ ขั้นต่ำ 100');
  console.log('  ตารางรางวัล 7 ชนิด');
}
{ // โต๊ด (รางวัล 4): สลับที่ของรางวัล 1 = 12% (≤25,000) • ตรงเป๊ะไม่นับโต๊ด • เลขซ้ำหมดไม่มีโต๊ด • จ่ายรวมไม่เกินกอง
  const L = w.lotto; let b4, tot = () => a.rec.inv.coin + b.rec.inv.coin + c.rec.inv.coin;
  L.tickets = { a: ['321'] }; seal('123', '000', '001'); L.pot = 100000; b4 = a.rec.inv.coin; draw();
  assert.strictEqual(a.rec.inv.coin - b4, 12000, '321 (สลับของ 123) ได้โต๊ด 12% ของกอง (ไม่ถูกอย่างอื่น)');
  L.tickets = { a: ['321', '213'] }; seal('123', '000', '001'); L.pot = 1000000; b4 = a.rec.inv.coin; draw();
  assert.strictEqual(a.rec.inv.coin - b4, 25000 + 1000, 'โต๊ดเพดาน 25,000 หารตามใบที่ถูก (2 ใบรวมเท่าเพดาน) + ท้าย 1 หลักของ 213 (เพดาน 1,000)');
  L.tickets = { b: ['123'] }; seal('123', '000', '001'); L.pot = 100000; b4 = b.rec.inv.coin; draw();
  assert.strictEqual(b.rec.inv.coin - b4, 50000 + 5000 + 500, 'ตรงเป๊ะ 123 ได้รางวัล 1 + หน้า2 + ท้าย1 ไม่ได้โต๊ดซ้ำ');
  L.tickets = { a: ['111'] }; seal('111', '000', '001'); L.pot = 100000; b4 = a.rec.inv.coin; draw();
  assert.strictEqual(a.rec.inv.coin - b4, 50000 + 5000 + 500, 'เลขซ้ำหมด 111 ไม่มีโต๊ด (ได้ 1 + หน้า2 + ท้าย1)');
  L.tickets = { a: ['123', '321', '023', '000', '124', '122'], b: ['789', '987'] }; seal('123', '023', '000'); L.pot = 3000; const p0 = L.pot, s0 = tot(); draw();
  assert.ok(tot() - s0 <= p0, 'จ่ายรวมทุกรางวัลไม่เกินกองกลาง'); assert.ok(L.pot >= 0);
  console.log('  โต๊ด 3 ตัว: 12% เพดาน 25,000 ตรงเป๊ะไม่ซ้ำ เลขซ้ำไม่มี จ่ายไม่เกินกอง');
}
{ // หน้า 2 ตัว / ข้างเคียง ±1 (วนรอบ 000↔999) / ท้าย 1 หลักขั้นต่ำ 100 จ่ายทุกใบไม่หาร
  const L = w.lotto; let b4;
  L.tickets = { a: ['129', '120'] }; seal('123', '000', '001'); L.pot = 100000; b4 = a.rec.inv.coin; draw();
  assert.strictEqual(a.rec.inv.coin - b4, 2 * Math.floor(5000 / 2) + 500 * 0, 'หน้า 12: ถูกหน้า2 ทั้งสองใบ หาร 5,000 เท่ากัน (ท้าย 9/0 ไม่ตรง 3)');
  L.tickets = { a: ['124', '122', '125'] }; seal('123', '000', '001'); L.pot = 100000; b4 = a.rec.inv.coin; draw();
  // 124/122 ข้างเคียง 25,000/2 • ทั้ง 3 ใบถูกหน้า2 '12' 5,000/3 • ท้าย1: ไม่ตรง 3
  assert.strictEqual(a.rec.inv.coin - b4, 2 * Math.floor(25000 / 2) + 3 * Math.floor(5000 / 3), 'ข้างเคียง ±1 ของ 123 = 124 และ 122');
  L.tickets = { a: ['999', '001', '002'] }; seal('000', '555', '555'); L.pot = 100000; b4 = a.rec.inv.coin; draw();
  assert.strictEqual(a.rec.inv.coin - b4, 2 * Math.floor(25000 / 2) + 2 * Math.floor(5000 / 2), 'วนรอบ: ข้างเคียงของ 000 คือ 999 และ 001 (002 ไม่ถูก) + หน้า2 "00" ถูก 001/002');
  L.tickets = { a: ['505', '815', '125'] }; seal('995', '555', '555'); L.pot = 10000; b4 = a.rec.inv.coin; draw(); // ท้าย 5: 3 ใบ ใบละ max(100, 0.5% × 10,000 = 50) = 100 ไม่หาร
  assert.strictEqual(a.rec.inv.coin - b4, 3 * 100 + 0, 'ท้าย 1 หลัก ขั้นต่ำ 100 ต่อใบ ไม่หาร (ข้อนี้ไม่ตรงรางวัลอื่น)');
  L.tickets = { a: ['505', '815', '125'] }; seal('995', '555', '555'); L.pot = 150; b4 = a.rec.inv.coin; draw();
  assert.strictEqual(a.rec.inv.coin - b4, 150, 'กองไม่พอ: จ่ายได้ไม่เกินกองกลางที่เหลือ'); assert.strictEqual(L.pot, 0);
  console.log('  หน้า2 / ข้างเคียง (วนรอบ) / ท้าย 1 หลัก ขั้นต่ำ 100 ไม่หาร จ่ายไม่เกินกอง');
}
{ // ไม่มีผู้ถูก = ทบกอง ไม่ถูกรีเซ็ต • สัดส่วนของกอง
  const L = w.lotto; L.tickets = { a: ['001'] }; seal('555', '555', '555'); L.pot = 40000; draw();
  assert.strictEqual(L.pot, 40000, 'ไม่มีผู้ถูก กองไม่ลด'); 
  L.tickets = { a: ['555'] }; seal('555', '999', '999'); L.pot = 40000; const c0 = a.rec.inv.coin; draw();
  assert.strictEqual(a.rec.inv.coin - c0, 20000 + 2000 + 200, 'รางวัล 1 = 50% ของกอง + หน้า2 5% + ท้าย1 0.5%'); assert.strictEqual(L.pot, 40000 - 22200);
  L.tickets = {}; seal('111', '111', '111'); L.pot = 777; draw(); assert.strictEqual(L.pot, 777, 'ไม่มีใครซื้อตั๋ว ทบทั้งหมด');
  console.log('  ทบกองเมื่อไม่มีผู้ถูก ไม่รีเซ็ต');
}
{ // ออกย้อนหลังเมื่อเซิร์ฟเวอร์ดับข้ามเวลา + ไม่สุ่มใหม่ (ใช้เลขที่ปิดผนึกไว้)
  const L = w.lotto, sealedNums = L.sealed.nums.slice(); L.tickets = { a: [sealedNums[0]] }; L.pot = 10000; const c0 = a.rec.inv.coin, r0 = L.round;
  w.lottoTick(w.lottoDrawAt(r0) + 5000);
  assert.ok(a.rec.inv.coin - c0 >= 5000, 'ถูกรางวัล 1 ด้วยเลขที่ปิดผนึกไว้');
  assert.strictEqual(w.lotto.last.round, r0); assert.ok(w.lotto.round !== r0);
  const before = w.lotto.round; w.lottoTick(w.lottoDrawAt(before) - 1000); assert.strictEqual(w.lotto.round, before, 'ยังไม่ถึงเวลา ไม่ออก');
  const nxt = w.lotto.round; w.lottoTick(w.lottoDrawAt(nxt) + 3 * 86400e3); assert.ok(w.lotto.round !== nxt, 'ดับหลายวัน ออกย้อนหลังทีละงวดจนทัน');
  console.log('  ออกผลตามเวลา 21:00 + ย้อนหลังตอนเปิดเซิร์ฟเวอร์');
}
{ // ผู้ชนะออฟไลน์ได้เงินเข้าเซฟ + แจ้งตอนเข้าเกม • บันทึก/โหลดคงที่
  w.players.delete('C'); const L = w.lotto; L.tickets = { c: ['321'] }; seal('321', '000', '000'); L.pot = 10000; const c0 = w.saved.c.inv.coin; draw();
  assert.strictEqual(w.saved.c.inv.coin - c0, 5600); assert.deepStrictEqual(w.saved.c.lottoWins, [[1, 5000], [5, 500], [7, 100]], 'รางวัล 1 + หน้า2 + ท้าย1');
  assert.ok(w.lotto.hist.length >= 5 && w.lotto.hist[0].nums.length === 3, 'เก็บประวัติเลขที่ออกย้อนหลัง');
  w.dirty = true; w.save(true);
  const w2 = new World('main'); assert.strictEqual(w2.lotto.pot, w.lotto.pot, 'กองคงอยู่หลังโหลดใหม่'); assert.strictEqual(w2.lotto.round, w.lotto.round); assert.deepStrictEqual(w2.lotto.hist, w.lotto.hist.map(h => ({ round: h.round, nums: h.nums, n: h.n, pot0: h.pot0, winners: h.winners })), 'ประวัติคงอยู่หลังโหลดใหม่');
  assert.deepStrictEqual(w2.lotto.sealed.nums, w.lotto.sealed.nums, 'เลขปิดผนึกคงเดิมหลังรีสตาร์ต'); assert.strictEqual(w2.lotto.sealed.hash, w.lotto.sealed.hash);
  console.log('  ผู้ชนะออฟไลน์ได้เงิน + บันทึก/โหลดกองและเลขปิดผนึก');
}
{ // ภาษีขายร้าน/แผง/ค่าบริการ เข้ากองกลางจริง
  const L = w.lotto, p0 = L.pot; w.toPot(123.9); assert.strictEqual(L.pot, p0 + 123); w.toPot(-5); w.toPot(0); assert.strictEqual(L.pot, p0 + 123);
  w.nearShopKind = () => 'animal'; w.event = () => {}; const s = mk('Seller', 0); s.rec.inv.egg = 3000; const pot1 = L.pot;
  w.sell(s, 'egg', 'all'); const got = s.rec.inv.coin, tax = L.pot - pot1;
  assert.ok(tax > 0 && tax <= (got + tax) * 0.07, 'ขายก้อนใหญ่เสียภาษีเข้ากองกลาง ไม่เกิน 7% (ภาษี ' + tax + ' จาก ' + (got + tax) + ')');
  assert.strictEqual(S.heatOf(s.rec.sales, Date.now()) > 0, true, 'จดยอดขายสะสม');
  s.rec.inv.egg = 3; const pot2 = L.pot; for (let i = 0; i < 3; i++) w.sell(s, 'egg', 1); assert.ok(L.pot - pot2 >= 0);
  console.log('  ภาษีขายเข้ากองกลาง ' + tax + ' จากการขาย ' + (got + tax));
}
console.log('✓ ผ่าน: หวย/กองกลาง/ภาษีขาย');
process.exit(0);
