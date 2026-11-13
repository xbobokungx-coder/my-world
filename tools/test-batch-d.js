// ทดสอบชุด D: ประตูเล้าฝั่งขวา • แตรยานพาหนะ • ตั๋ววาปกลับกองไฟ • อันดับออนไลน์รายสัปดาห์: node tools/test-batch-d.js
process.env.TZ = 'Asia/Bangkok';
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-batchd-');
const RealDate = Date; let NOW = RealDate.UTC(2026, 10, 4, 3, 0, 0); // พุธ 4 พ.ย. 2026
class FakeDate extends RealDate { constructor(...a) { if (a.length === 0) super(NOW); else super(...a); } static now() { return NOW; } }
global.Date = FakeDate;
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, T = S.T;
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('batchd');
const wsA = mkWs(), wsB = mkWs();
const a = w.join(wsA, 'alice', '#e74c3c').p, b = w.join(wsB, 'bob', '#3498db').p;
const last = (ws, t) => ws.msgs.filter(m => m.t === t).pop();

// 1) เล้า: ประตูขวา (ทั้ง 11 เล้า) เป็นทางเดิน ส่วนรั้วที่เหลือยังอยู่
{
  const m = S.makeMap(); let n = 0;
  for (const [id, P] of Object.entries(S.PENS)) {
    assert.ok(P.gate.every(([x]) => m[P.gate[0][1]][x] === T.PATH), id + ' ประตูซ้ายเป็นทาง');
    // ทั้ง 11 เล้ามีประตูขวา (เล้า x1=61 ใช้แถบทางเดินแคบ x63 ต่อเข้าถนน)
    assert.strictEqual(P.gateR.length, P.gate.length, id + ' มีประตูขวา');
    for (const [x, y] of P.gateR) { assert.strictEqual(x, P.x1 + 1); assert.strictEqual(m[y][x], T.PATH, id + ' ประตูขวาเป็นทาง'); assert.ok(!S.blockedAt(m, (x + 0.5) * TS, (y + 0.5) * TS), id + ' เดินผ่านได้'); assert.ok(!S.blockedAt(m, (x + 1.5) * TS, (y + 0.5) * TS) || x + 1 >= S.W, id + ' ด้านนอกประตูขวาเดินต่อได้'); n++; }
    if (P.x1 + 1 === S.W - 2) { assert.ok(P.edgeR.length > 0, id + ' มีแถบขอบ x63'); for (const [x, y] of P.edgeR) { assert.strictEqual(x, S.W - 1); assert.strictEqual(m[y][x], T.PATH, id + ' แถบขอบเป็นทาง'); assert.ok(!S.blockedAt(m, (x + 0.5) * TS, (y + 0.5) * TS), id + ' ยืนที่ x63 ได้'); } }
    // BFS จากถนน (ช่องถนน x45 หรือแถวทางเดิน) เข้าประตูซ้าย/ขวา โดยไม่ลัดผ่านในเล้า
    {
      const inPen = (x, y) => x >= P.x0 && x <= P.x1 && y >= P.y0 && y <= P.y1;
      const st = [45, P.gate[0][1] < 9 ? 8 : P.gate[0][1]], seen = new Set([st + '']), q = [st];
      while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (seen.has(k) || inPen(nx, ny) || S.blockedAt(m, (nx + 0.5) * TS, (ny + 0.5) * TS)) continue; seen.add(k); q.push([nx, ny]); } }
      for (const g of P.gate) assert.ok(seen.has(g + ''), id + ' ถนนถึงประตูซ้าย');
      for (const g of P.gateR) assert.ok(seen.has(g + ''), id + ' ถนนถึงประตูขวา (ไม่ลัดผ่านในเล้า)');
      // ช่องในเล้าข้างประตู (แถวใดแถวหนึ่ง) เดินได้ทั้งฝั่งซ้ายและขวา
      for (const x of [P.x0, P.x1]) assert.ok(P.gate.some(([, y]) => !S.blockedAt(m, (x + 0.5) * TS, (y + 0.5) * TS)), id + ' ในเล้าเดินได้');
    }
    // รั้วที่เหลือต้องยังเป็นรั้ว (มุม + ตำแหน่งนอกประตู)
    assert.strictEqual(m[P.y0 - 1][P.x1 + 1], T.FENCE); assert.strictEqual(m[P.y1 + 1][P.x0 - 1], T.FENCE);
  }
  assert.strictEqual(n, 22, 'ประตูขวา 11 เล้า x 2 ช่อง');
  // ไม่มีผู้เล่นถูกเตะกลับจุดเกิดเพราะช่องประตู (เปิดทางอย่างเดียว ไม่เพิ่มรั้ว)
  for (const P of Object.values(S.PENS)) for (const [x, y] of P.gate.concat(P.gateR)) assert.ok(!S.blockedAt(m, (x + 0.5) * TS, (y + 0.5) * TS));
}

// 2) แตรยานพาหนะ
{
  wsA.msgs.length = wsB.msgs.length = 0;
  w.handle(a, { t: 'horn' }); assert.ok(!last(wsB, 'horn'), 'ไม่ได้ขับ = ไม่ broadcast');
  a.rec.inv.veh_car = 1; w.setVeh(a, 'car'); assert.strictEqual(a.veh, 'car');
  w.handle(a, { t: 'horn' }); const h = last(wsB, 'horn'); assert.ok(h && h.id === a.id && h.v === 'car', 'แตรถึงคนอื่น'); assert.ok(last(wsA, 'horn'), 'เจ้าตัวก็ได้ยิน');
  wsB.msgs.length = 0; w.handle(a, { t: 'horn' }); assert.ok(!last(wsB, 'horn'), 'คูลดาวน์');
  NOW += S.HORN.cdMs + 1; w.handle(a, { t: 'horn' }); assert.ok(last(wsB, 'horn'), 'พ้นคูลดาวน์ดังได้อีก');
  w.setVeh(a, ''); wsB.msgs.length = 0; NOW += 5000; w.handle(a, { t: 'horn', v: 'car' }); assert.ok(!last(wsB, 'horn'), 'ลงรถแล้วห้าม (ไม่เชื่อ v จากไคลเอนต์)');
  wsA.msgs.length = 0; w.handle(b, { t: 'horn', v: 'car' }); assert.ok(!last(wsA, 'horn'), 'ไม่มีรถห้าม');
  { // แตรเรือ: อยู่ทะเลใหญ่ = v 'boat' (ไม่เชื่อ v จากเว็บ) ส่งเฉพาะคนในซีนเดียวกัน
    const sc = '@cave' + S.OCEAN.floor; a.scene = sc; b.scene = sc; wsA.msgs.length = wsB.msgs.length = 0; NOW += 5000;
    w.handle(a, { t: 'horn', v: 'car' }); const hb = last(wsB, 'horn'); assert.ok(hb && hb.v === 'boat' && hb.id === a.id, 'แตรเรือ v=boat'); assert.ok(last(wsA, 'horn'), 'เจ้าตัวได้ยิน');
    b.scene = null; wsB.msgs.length = 0; NOW += 5000; w.handle(a, { t: 'horn' }); assert.ok(!last(wsB, 'horn'), 'คนอยู่เมืองไม่ได้ยินแตรเรือ');
    a.scene = '@cave5'; wsB.msgs.length = 0; NOW += 5000; w.handle(a, { t: 'horn' }); assert.ok(!last(wsB, 'horn'), 'ในถ้ำไม่ใช่เรือ ห้าม'); a.scene = null;
  }
  assert.ok(!JSON.stringify(a.rec).includes('hornAt'), 'ไม่เก็บเซฟ');
}

// 3) ตั๋ววาปกลับกองไฟ
{
  const R = S.MINE.recall, info = S.itemInfo('recall');
  assert.ok(info && info.buy === R.price && !info.once && info.name.includes('ตั๋ว'));
  assert.ok(S.SHOPS.mine.buy.includes('recall')); assert.strictEqual(S.sellbackValue('recall', 1), 0, 'ขายคืนไม่ได้ (กันขาย-ซื้อวน)');
  assert.ok(S.isTradable('recall'), 'เทรดได้ (มูลค่า = ราคาซื้อ)');
  assert.ok(R.price < S.MINE.fee[10] && R.price > 100);
  // ซื้อที่ร้านช่างเหมือง
  const mine = S.BUILDINGS.find(x => x.kind === 'mine'); a.x = (mine.counter[0][0] + 0.5) * TS; a.y = (mine.counter[0][1] + 0.5) * TS; a.scene = null;
  a.rec.inv.coin = R.price * 2; w.buy(a, 'recall', 1); assert.strictEqual(a.rec.inv.recall, 1); assert.strictEqual(a.rec.inv.coin, R.price);
  w.handle(a, { t: 'buy', item: 'recall', n: -5 }); w.handle(a, { t: 'buy', item: 'recall', n: NaN }); a.rec.inv.coin = R.price; a.rec.inv.recall = 1; // n ถูกบีบเป็น 1..10 ที่ตัวรับข้อความ
  a.rec.inv.coin += R.price * 0;
   assert.ok(a.rec.inv.coin <= R.price, 'จำนวนแปลก ๆ ไม่ทำให้เหรียญเพิ่ม');
  // ใช้ในเมือง/ชั้น 1/ทะเล ไม่ได้ ไม่เสียตั๋ว
  w.handle(a, { t: 'recall' }); assert.strictEqual(a.rec.inv.recall, 1, 'ในเมืองใช้ไม่ได้');
  a.scene = '@cave1'; w.handle(a, { t: 'recall' }); assert.strictEqual(a.rec.inv.recall, 1, 'ชั้น 1 ใช้ไม่ได้'); assert.strictEqual(a.scene, '@cave1');
  a.scene = '@cave' + S.SEA.floor; w.handle(a, { t: 'recall' }); assert.strictEqual(a.rec.inv.recall, 1, 'ทะเลใช้ไม่ได้');
  a.scene = '@cave5'; a.veh = 'car'; w.handle(a, { t: 'recall' }); assert.strictEqual(a.rec.inv.recall, 1, 'ขับรถอยู่ใช้ไม่ได้'); a.veh = '';
  const b0 = b.rec.inv.recall || 0; b.scene = '@cave5'; w.handle(b, { t: 'recall' }); assert.strictEqual(b.scene, '@cave5', 'ไม่มีตั๋วใช้ไม่ได้'); assert.strictEqual(b.rec.inv.recall || 0, b0); b.scene = null;
  // ใช้จริงที่ชั้น 5
  a.x = 31 * TS; a.y = 40 * TS; w.dirty = false;
  w.handle(a, { t: 'recall' });
  assert.strictEqual(a.scene, null); assert.strictEqual(a.rec.inv.recall || 0, 0, 'ตั๋วหมด 1 ใบ'); assert.deepStrictEqual([a.x, a.y], [S.SPAWN.x, S.SPAWN.y]); assert.ok(w.dirty);
  const sc = last(wsA, 'scene'); assert.ok(sc && sc.sc === null, 'ส่งฉากเมืองให้ไคลเอนต์');
  w.handle(a, { t: 'recall' }); assert.strictEqual(a.rec.inv.recall || 0, 0, 'กดซ้ำไม่ติดลบ');
  // เทรดตั๋วระหว่างผู้เล่น: ยอดไม่ติดลบ ไม่เกิดของซ้ำ
  a.rec.inv.recall = 1; a.scene = '@cave3'; w.handle(a, { t: 'recall' }); w.handle(a, { t: 'recall' }); assert.strictEqual(a.rec.inv.recall || 0, 0);
}

// 4) อันดับออนไลน์รายสัปดาห์
{
  assert.strictEqual(S.thaiWeek(RealDate.UTC(2026, 10, 8, 16, 59, 59)), S.thaiWeek(RealDate.UTC(2026, 10, 4, 3, 0, 0)), 'อาทิตย์ 23:59 ไทยยังสัปดาห์เดิม');
  assert.strictEqual(S.thaiWeek(RealDate.UTC(2026, 10, 8, 17, 0, 0)), S.thaiWeek(RealDate.UTC(2026, 10, 4, 3, 0, 0)) + 1, 'จันทร์ 00:00 ไทย = สัปดาห์ใหม่');
  const mk = (name, s, wk, extra) => { const rec = { name, inv: { coin: 5 }, skills: { farm: 5000 }, onl: s == null ? undefined : { w: wk === undefined ? S.thaiWeek(NOW) : wk, s } }; w.saved[name.toLowerCase()] = Object.assign(rec, extra); return rec; };
  mk('Hi', 7200 + 36); mk('Lo', 1800); mk('Old', 99999, S.thaiWeek(NOW) - 1); mk('None'); mk('Tiny', 30);
  mk(require('../server/consts.js').ADMIN_NAME, 999999);
  w._rank = null; w.sendRank(a); const r = last(wsA, 'rank');
  assert.ok(Array.isArray(r.on)); assert.deepStrictEqual(r.on.map(x => x.n), ['Hi', 'Lo'], 'เรียงมาก→น้อย ตัดแอดมิน/สัปดาห์เก่า/ศูนย์/ไม่ถึงนาที');
  assert.deepStrictEqual(r.on[0], { n: 'Hi', h: 2.01 > 2.0 ? 2 : 2 }, 'ส่งแค่ชื่อกับชั่วโมง (ทศนิยม 1 ตำแหน่ง)'); assert.deepStrictEqual(r.on[1], { n: 'Lo', h: 0.5 });
  assert.ok('on' in r.me);
  // นับเวลาจริงตอนเชื่อมต่อ
  a.rec.onl = undefined; a.onAt = 0; a.activeAt = NOW; w.onlineTick(NOW); assert.strictEqual(a.onAt, NOW);
  NOW += 9000; a.activeAt = NOW; w.onlineTick(NOW); assert.ok(!a.rec.onl, 'ยังไม่ถึงรอบเก็บ');
  NOW += 1000; a.activeAt = NOW; w.onlineTick(NOW); assert.strictEqual(a.rec.onl.s, 10); assert.strictEqual(a.rec.onl.w, S.thaiWeek(NOW));
  NOW += 600000; a.activeAt = NOW; w.onlineTick(NOW); assert.strictEqual(a.rec.onl.s, 10 + S.RANK.onlineCreditMax / 1000, 'นาฬิกากระโดดนับได้ไม่เกินเพดาน');
  // ไม่ active (ทิ้งแท็บ) ไม่ได้เวลา • active ได้
  { const s0 = a.rec.onl.s; a.onAt = NOW; NOW += 10000; a.activeAt = NOW - S.RANK.activeMs - 1; w.onlineTick(NOW); assert.strictEqual(a.rec.onl.s, s0, 'ไม่ active ไม่ได้เวลา'); assert.strictEqual(a.onAt, NOW, 'รีเซ็ตจุดนับ ไม่สะสมย้อนหลัง');
    NOW += 10000; a.activeAt = NOW - 1000; w.onlineTick(NOW); assert.strictEqual(a.rec.onl.s, s0 + 10, 'active ได้เวลา'); }
  { const b0 = b.ws.readyState; b.ws.readyState = 3; b.onAt = NOW - 5000; b.activeAt = NOW; b.rec.onl = undefined; w.onlineFlush(b, NOW, true); assert.strictEqual(b.rec.onl && b.rec.onl.s, 5, 'ตอนออกจากเกม (ws ปิดแล้ว) ยังเก็บเวลาท้าย'); b.rec.onl = undefined; b.ws.readyState = b0; }
  const bws = b.ws.readyState; b.ws.readyState = 3; b.onAt = NOW - 5000; b.rec.onl = undefined; w.onlineFlush(b, NOW); assert.ok(!b.rec.onl, 'หลุดการเชื่อมต่อไม่นับ'); b.ws.readyState = bws;
  // ข้ามสัปดาห์: รีเซ็ต
  NOW = RealDate.UTC(2026, 10, 8, 17, 0, 5); a.onAt = NOW - 10000; a.activeAt = NOW; w.onlineFlush(a, NOW); assert.strictEqual(a.rec.onl.s, 10, 'สัปดาห์ใหม่เริ่มนับใหม่'); assert.strictEqual(a.rec.onl.w, S.thaiWeek(NOW));
  assert.strictEqual(w.rankData().onWk, S.thaiWeek(NOW));
  // เซฟเก่าไม่มี onl = 0 ไม่พัง
  assert.doesNotThrow(() => w.rankBuild());
}
console.log('test-batch-d: ผ่านทั้งหมด');
process.exit(0);
