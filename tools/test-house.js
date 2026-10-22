// ทดสอบระบบบ้านหลังใหญ่ (ฉากแยก เข้า-ออก ตกแต่ง เยี่ยมบ้าน ลีดเดอร์บอร์ด บันทึก/ย้ายข้อมูลเดิม): node tools/test-house.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-house-'));
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;

const mkWs = () => { const ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }; return ws; };
const last = (ws, t) => { for (let i = ws.msgs.length - 1; i >= 0; i--) if (ws.msgs[i].t === t) return ws.msgs[i]; return null; };
const count = (ws, t) => ws.msgs.filter(m => m.t === t).length;
const w = new World('main');
const wa = mkWs(), wb = mkWs();
const a = w.join(wa, 'alice', '#e74c3c').p, b = w.join(wb, 'bob', '#3498db').p;
a.rec.inv.coin = 5000; a.rec.inv.furn_chair = 2; a.rec.inv.furn_piano = 1; a.rec.inv.furn_rug = 1;
const H = m => (m.t = 'house', m);

// เมืองไม่มีที่ดินแล้ว และไม่มีเฟอร์นิเจอร์ในแมพเมือง
{ const t = S.makeMap(); assert.ok(!t.some(r => r.includes(S.T.FLOOR)), 'แมพเมืองต้องไม่มีพื้นไม้ของที่ดินเดิม'); }
// แมพบ้าน: พื้น 22x15, ผนัง/ช่องว่างเดินทะลุไม่ได้, ประตูเดินออกได้
{ const m = S.makeHouseMap(); let f = 0; for (const r of m) for (const c of r) if (c === S.T.FLOOR) f++; assert.strictEqual(f, 22 * 15);
  assert.ok(S.blockedAt(m, 21 * TS, 15 * TS), 'ผนังบนต้องตัน'); assert.ok(S.blockedAt(m, 5 * TS, 5 * TS), 'นอกบ้านต้องตัน');
  assert.ok(!S.blockedAt(m, S.HOUSE_SPAWN.x, S.HOUSE_SPAWN.y), 'จุดเกิดในบ้านต้องเดินได้'); assert.ok(!S.blockedAt(m, 31.5 * TS, 31.5 * TS), 'ประตูต้องเดินออกได้'); }

// เข้าบ้านตัวเอง: เป็นฉากแยก คนในเมืองเห็นว่าหายไป
const before = { x: a.x, y: a.y };
w.handle(a, H({ a: 'enter' }));
assert.strictEqual(a.scene, 'alice'); const sc = last(wa, 'scene');
assert.ok(sc && sc.sc === 'alice' && sc.mine === true && sc.players.length === 1, 'ต้องได้ข้อความ scene ของบ้านตัวเอง');
assert.ok(wb.msgs.some(m => m.t === 'p-' && m.id === a.id && m.quiet), 'คนในเมืองต้องเห็นเจ้าของหายไป (เงียบ ไม่ขึ้นแชท)');
assert.deepStrictEqual({ x: a.ret.x, y: a.ret.y }, before, 'จำตำแหน่งในเมืองไว้กลับมา');
// ในบ้านใช้ข้อความของเมืองไม่ได้ (เช่น ซื้อ/ขาย/ใช้เครื่องมือ)
const coin0 = a.rec.inv.coin; w.handle(a, { t: 'buy', item: 'seed_carrot', n: 1 }); assert.strictEqual(a.rec.inv.coin, coin0, 'ซื้อของในบ้านต้องไม่ได้');

// วาง/เก็บเฟอร์นิเจอร์ในบ้านตัวเอง
a.x = 28 * TS; a.y = 25 * TS; // ยืนกลางบ้าน (วางได้ไกลสุด 8 ช่อง)
w.handle(a, H({ a: 'place', f: 'chair', x: 25, y: 20 }));
assert.strictEqual(w.houses.alice.items['25,20'], 'chair'); assert.strictEqual(a.rec.inv.furn_chair, 1);
w.handle(a, H({ a: 'place', f: 'piano', x: 30, y: 20 })); assert.strictEqual(w.houseMap('alice')[20][30], S.T.FURN, 'ของตันต้องกลายเป็นช่องตัน');
w.handle(a, H({ a: 'place', f: 'rug', x: 31, y: 30 })); assert.ok(!w.houses.alice.items['31,30'], 'หน้าประตูต้องเว้นว่าง');
w.handle(a, H({ a: 'place', f: 'chair', x: 5, y: 5 })); assert.ok(!w.houses.alice.items['5,5'], 'นอกพื้นบ้านวางไม่ได้');
w.handle(a, H({ a: 'place', f: 'chair', x: 25, y: 20 })); assert.strictEqual(a.rec.inv.furn_chair, 1, 'ช่องซ้ำต้องไม่ตัดของ');
w.handle(a, H({ a: 'place', f: 'chair', x: 26, y: 20 })); w.handle(a, H({ a: 'remove', x: 26, y: 20 }));
assert.ok(!w.houses.alice.items['26,20'] && a.rec.inv.furn_chair === 1, 'เก็บคืนแล้วของกลับเข้ากระเป๋า');
assert.ok(count(wa, 'furn') >= 3, 'เจ้าของต้องได้ข้อความ furn'); assert.strictEqual(count(wb, 'furn'), 0, 'คนในเมืองต้องไม่ได้รับข้อความ furn ของบ้าน');
// ตำแหน่งในสแนปช็อต: คนในบ้านไม่เห็นคนในเมือง
w.tick(0.05, Date.now());
const sn = last(wa, 's'); assert.ok(sn && sn.p.every(r => r[0] === a.id) && sn.c.length === 0, 'สแนปช็อตในบ้านต้องมีแค่คนในบ้าน');
const sb = last(wb, 's'); assert.ok(sb.p.every(r => r[0] === b.id), 'สแนปช็อตในเมืองต้องไม่มีคนที่อยู่ในบ้าน');
// นั่งโซฟา/เก้าอี้ในบ้าน
a.x = 25 * TS; a.y = 21 * TS; w.handle(a, { t: 'act', tool: '', tx: 25, ty: 20 }); assert.deepStrictEqual(a.sit, { x: 25, y: 20 }, 'นั่งเก้าอี้ในบ้านได้');

// ลีดเดอร์บอร์ด + เยี่ยมบ้าน
w.handle(b, H({ a: 'board' })); const bd = last(wb, 'hboard');
assert.strictEqual(bd.list.length, 1); assert.deepStrictEqual([bd.list[0].n, bd.list[0].v, bd.list[0].c], ['alice', S.FURN.chair.price + S.FURN.piano.price, 2]);
w.handle(b, H({ a: 'enter', who: 'nobody' })); assert.ok(!b.scene, 'ไม่มีบ้านนี้ต้องไม่เข้า');
b.lastEnter = 0; w.handle(b, H({ a: 'enter', who: 'bob' })); assert.strictEqual(b.scene, 'bob', 'เข้าบ้านตัวเองเสมอได้ (สร้างว่างๆ)'); w.handle(b, H({ a: 'exit' })); assert.ok(!b.scene);
b.rec.inv.furn_chair = 1; b.lastEnter = 0; w.handle(b, H({ a: 'enter', who: 'Alice' }));
assert.strictEqual(b.scene, 'alice', 'เยี่ยมบ้านเพื่อนจากชื่อ (ไม่สนตัวพิมพ์)'); const sv = last(wb, 'scene');
assert.ok(!sv.mine && sv.items.length === 2 && sv.players.length === 2, 'ผู้เยี่ยมเห็นของและเจ้าของบ้าน');
w.handle(b, H({ a: 'place', f: 'chair', x: 28, y: 22 })); assert.ok(!w.houses.alice.items['28,22'] && b.rec.inv.furn_chair === 1, 'ผู้เยี่ยมวางของในบ้านคนอื่นไม่ได้');
w.handle(b, H({ a: 'remove', x: 25, y: 20 })); assert.ok(w.houses.alice.items['25,20'], 'ผู้เยี่ยมเก็บของเจ้าของไม่ได้');
// ออกจากบ้านด้วยการเดินไปที่ประตู → กลับตำแหน่งเดิมในเมือง
const bPos = { x: b.ret.x, y: b.ret.y };
w.handle(b, { t: 'm', x: S.HOUSE_SPAWN.x, y: 31.5 * TS, d: 0 }); assert.ok(!b.scene, 'เดินถึงประตู = ออกจากบ้าน');
assert.ok(Math.hypot(b.x - bPos.x, b.y - bPos.y) < 1 || S.blockedAt(w.map, bPos.x, bPos.y), 'กลับตำแหน่งเดิมในเมือง');
assert.ok(last(wb, 'scene').sc === null, 'ได้ข้อความ scene กลับเมือง');

// บันทึกแล้วโหลดใหม่ + ออกเกมตอนอยู่ในบ้านต้องบันทึกตำแหน่งในเมือง
const aRet = { x: a.ret.x, y: a.ret.y };
w.leave(a); assert.deepStrictEqual({ x: a.rec.x, y: a.rec.y }, aRet, 'ออกเกมตอนอยู่ในบ้านต้องจำตำแหน่งในเมือง');
w.dirty = true; w.save(true);
const w2 = new World('main');
assert.deepStrictEqual(w2.houses.alice.items, { '25,20': 'chair', '30,20': 'piano' }, 'ของในบ้านต้องคงอยู่หลังรีสตาร์ต');
assert.strictEqual(w2.houseMap('alice')[20][30], S.T.FURN);

// ย้ายข้อมูลจากระบบที่ดินเดิม (owners/items) → บ้านใหม่ ตำแหน่งสัมพันธ์เดิม
const f2 = path.join(process.env.DATA_DIR, 'legacy.json');
fs.writeFileSync(f2, JSON.stringify({ players: { carol: { name: 'carol', inv: { coin: 1 } }, dave: { name: 'dave', inv: { coin: 1 } } },
  house: { owners: { 1: 'carol', 2: 'dave' }, items: { '9,2': 'chair', '12,5': 'sofa', '17,3': 'rug', '40,4': 'tv' } } }));
const w3 = new World('legacy');
assert.deepStrictEqual(w3.houses.carol.items, { '23,18': 'chair', '26,21': 'sofa' }, 'ย้ายของจากแปลงที่ 2 ไปมุมซ้ายบนของพื้นบ้าน');
assert.deepStrictEqual(w3.houses.dave.items, { '24,19': 'rug' }, 'ย้ายของจากแปลงที่ 3');
console.log('✓ ผ่าน: ระบบบ้านหลังใหญ่ (ฉากแยก ตกแต่ง เยี่ยมบ้าน ลีดเดอร์บอร์ด บันทึก ย้ายข้อมูลเดิม)');
process.exit(0);
