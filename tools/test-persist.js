// ทดสอบว่าข้อมูลเมืองที่ save แล้วถูกโหลดกลับมาครบหลังรีสตาร์ต: node tools/test-persist.js
// (บั๊กเดิม: โครงการพัฒนาเมืองถูกบันทึกแต่ไม่ถูกโหลด → ยอดลงขันรีเซ็ตเป็น 0 ทุกครั้งที่รีสตาร์ตเซิร์ฟเวอร์)
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-persist-'));
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('main'); w.nearChest = () => true;
const p = { name: 'tester', key: 'tester', x: 0, y: 0, ws: { readyState: 0, send() {} }, rec: { inv: { coin: 20000 }, pts: 0, arc: { pts: 0, total: 0, wk: 0 } } };
const fresh = S.makeMap(), cx = 44 * S.TS, y0 = 33 * S.TS + 16, y1 = 43 * S.TS + 16; // กึ่งกลางสะพาน (รอยต่อสองช่อง) จากฝั่งเหนือถึงฝั่งใต้
const crossable = m => { for (let y = y0; y <= y1; y += 4) if (S.blockedAt(m, cx, y)) return false; return true; };
assert.strictEqual(crossable(fresh), false, 'ก่อนสร้างสะพานต้องข้ามสระไม่ได้');
w.players.set(1, p); w.saved.tester = p.rec;
for (let i = 0; i < 4; i++) w.projHandle(p, { id: 'bridge', amt: 2000 });
w.projHandle(p, { id: 'bridge', amt: 500 }); w.projHandle(p, { id: 'lighthouse', amt: 500 });
assert.strictEqual(crossable(w.map), true, 'สร้างสะพานครบแล้วต้องเดินข้ามจากเหนือลงใต้ได้ทันที (ไม่ต้องรีสตาร์ต)');
assert.strictEqual(S.blockedAt(w.map, 38 * S.TS, 38 * S.TS), true, 'น้ำนอกสะพานต้องยังเดินไม่ได้');
assert.strictEqual(S.blockedAt(w.map, cx, 33 * S.TS + 16), false, 'ปลายสะพานฝั่งเหนือต้องต่อกับฝั่งที่เดินได้');
w.dirty = true; w.save(true);
// ไม่มีดอกเบี้ย: ยอดฝากต้องไม่เพิ่มเองไม่ว่าจะออนไลน์นานแค่ไหน
p.rec.bank = { bal: 5000 }; p.activeAt = Date.now();
for (let i = 0; i < 20; i++) w.tick(60, Date.now());
assert.strictEqual(w.bankOf(p).bal, 5000, 'ยอดฝากเปลี่ยนเอง (ไม่ควรมีดอกเบี้ย)');
assert.strictEqual(S.BANK.rate, undefined, 'BANK.rate ต้องไม่มีแล้ว');
// โควตาขายราคาเต็มต่อวัน
{
  const Q = S.QUOTA, near = (a, b, e = 1) => Math.abs(a - b) <= e;
  assert.strictEqual(S.quotaPay(0, 1000).pay, 1000, 'ในโควตาต้องได้เต็ม');
  assert.strictEqual(S.quotaPay(0, Q.full).pay, Q.full, 'ถึงโควตาพอดีได้เต็ม');
  assert.ok(near(S.quotaPay(Q.full - 500, 1500).pay, 500 + 1000 * Q.over), 'ข้ามโควตากลางการขาย: ส่วนเกินได้ over');
  assert.ok(near(S.quotaPay(Q.full, 1000).pay, 1000 * Q.over), 'เกินโควตาแล้วได้ 30%');
  assert.ok(near(S.quotaPay(Q.full * 2, 1000).pay, 1000 * Q.over * Q.decay), 'ขายเกินต่อเนื่อง ลดลงอีกขั้น');
  assert.ok(near(S.quotaPay(Q.full * 50, 1000).pay, 1000 * Q.floor), 'ลดถึงพื้นแล้วคงที่');
  assert.ok(S.quotaPay(Q.full * 50, 1).pay >= 1, 'ขายชิ้นเล็กอย่างน้อยได้ 1 เหรียญ');
  // ขายแบ่งหลายครั้งต้องได้เท่ากับขายครั้งเดียว (กันแกล้งแบ่งขายเลี่ยงลดราคา)
  let g = 0, parts = 0; for (let i = 0; i < 40; i++) { parts += S.quotaPay(g, 500).pay; g += 500; }
  assert.ok(near(parts, S.quotaPay(0, 20000).pay, 40), 'แบ่งขายต้องไม่ได้มากกว่าขายรวด');
  // ผ่านระบบจริง: ขายผ่าน World.sell
  w.event = () => {}; // ปิดรางวัลเควส/คู่มือที่ผูกกับการขาย จะได้วัดเฉพาะเหรียญจากการขาย
  w.nearShopKind = () => 'farm'; w.market.crop_melon = w.market.crop_melon || { m: 1 };
  p.rec.inv.crop_melon = 400; p.rec.sold = null; const c0 = p.rec.inv.coin;
  w.sell(p, 'crop_melon', 'all');
  const got = p.rec.inv.coin - c0, gross = p.rec.sold.gross;
  assert.ok(gross > Q.full, 'ต้องขายพอให้เกินโควตาในเทสต์');
  assert.strictEqual(got, S.quotaPay(0, gross).pay, 'เหรียญที่ได้จริงต้องตรงกับสูตรโควตา');
  assert.ok(got < gross, 'เกินโควตาต้องได้น้อยกว่าราคาตลาด');
  const q = w.quotaPub(p); assert.ok(q.rate < 1 && q.gross === gross && q.resetAt > Date.now(), 'ข้อมูลที่ส่งให้ป้ายสถานะต้องถูกต้อง');
  console.log('  โควตา: ขายตลาด', gross, 'ได้จริง', got, '(' + Math.round(got / gross * 100) + '%) อัตราถัดไป', Math.round(q.rate * 100) + '%');
}
const w2 = new World('main');
assert.strictEqual(w2.projects.bridge.coin, 5000, 'bridge coin lost after reload');
assert.strictEqual(w2.projects.lighthouse.coin, 500, 'lighthouse coin lost after reload');
assert.strictEqual(w2.projects.bridge.donors.tester, 5000, 'donors lost after reload');
assert.strictEqual(crossable(w2.map), true, 'หลังรีสตาร์ตสะพานต้องยังอยู่');
// ทุกโครงการ: แปลงช่องตามที่ตั้งใจ เดินถึงได้/ตันตามกติกา ไม่ทับอาคารอื่น
const all = S.makeMap(); for (const P of S.PROJECTS) S.applyProject(all, P.id);
const T = S.T, walk = (x, y) => !S.blockedAt(all, x * S.TS + 16, y * S.TS + 16);
for (let y = S.LIGHTHOUSE.y0; y <= S.LIGHTHOUSE.y1; y++) for (let x = S.LIGHTHOUSE.x0; x <= S.LIGHTHOUSE.x1; x++) assert.strictEqual(all[y][x], T.LANDMARK, 'ประภาคารต้องเป็นช่องตัน');
for (let y = S.ISLAND.y0; y <= S.ISLAND.y1; y++) for (let x = S.ISLAND.x0; x <= S.ISLAND.x1; x++) assert.ok(walk(x, y), 'เกาะต้องเดินได้');
for (let x = S.ISLAND.x0; x <= S.BRIDGE.x0; x++) assert.ok(walk(x, S.ISLAND.walk.y), 'ต้องเดินจากสะพานขึ้นเกาะได้');
for (const r of [S.FESTIVAL.stage, ...S.FESTIVAL.tents]) for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) assert.strictEqual(all[y][x], T.LANDMARK, 'เวที/เต็นท์ต้องเป็นช่องตัน');
assert.ok(walk(S.FESTIVAL.plaza.x0, S.FESTIVAL.plaza.y1) && walk(S.FESTIVAL.plaza.x1, S.FESTIVAL.plaza.y0 + 3), 'ลานเทศกาลต้องเดินได้');
const orig = S.makeMap(); let changed = 0; for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (orig[y][x] !== all[y][x]) { changed++; assert.ok([T.WATER, T.GRASS, T.TREE, T.PATH].includes(orig[y][x]), `ทับช่องที่ไม่ควรทับที่ ${x},${y}`); }
console.log('  โครงการทั้ง 4 แปลงแมพ', changed, 'ช่อง');
console.log('✓ ผ่าน: ยอดโครงการอยู่ครบหลังโหลดใหม่ และสะพานเดินข้ามได้ทั้งตอนสร้างเสร็จและหลังรีสตาร์ต');
fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); process.exit(0);
