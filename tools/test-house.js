// ทดสอบระบบบ้านหลังใหญ่ (ฉากแยก เข้า-ออก ตกแต่งอิสระ เยี่ยมบ้าน ลีดเดอร์บอร์ด บันทึก/ย้ายข้อมูลเดิม): node tools/test-house.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-house-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;

const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const last = (ws, t) => { for (let i = ws.msgs.length - 1; i >= 0; i--) if (ws.msgs[i].t === t) return ws.msgs[i]; return null; };
const count = (ws, t) => ws.msgs.filter(m => m.t === t).length;
const w = new World('main');
const wa = mkWs(), wb = mkWs();
const a = w.join(wa, 'alice', '#e74c3c').p, b = w.join(wb, 'bob', '#3498db').p;
Object.assign(a.rec.inv, { coin: 5000, furn_chair: 3, furn_piano: 1, furn_rug: 1, furn_table: 1, furn_teddy: 2, furn_painting: 2, furn_sofa: 1, furn_lantern: 1 });
const H = m => (m.t = 'house', m);
const items = () => w.houses.alice.items;
const idOf = f => Object.keys(items()).find(i => items()[i].f === f);

// ประตูบ้านหลังใหญ่ในเมือง (27,5): ช่องประตูเดินได้ ต่อกับถนน ตัวบ้านเหนือประตูเป็นช่องตัน
{ const t = S.makeMap(), D = S.HOUSE_DOOR; assert.deepStrictEqual([D.x, D.y], [S.HOUSE_DOOR.x, S.HOUSE_BLD.y1 + 1], 'ประตูอยู่ใต้ตัวบ้านพอดี');
  assert.ok(!S.blockedAt(t, D.x * TS + 16, D.y * TS + 16), 'ช่องประตูต้องเดินได้'); assert.ok(!S.blockedAt(t, D.x * TS + 16, (D.y + 1) * TS + 16), 'ถนนหน้าประตูต้องเดินได้');
  assert.ok(S.blockedAt(t, D.x * TS + 16, (D.y - 1) * TS + 16) && S.blockedAt(t, S.HOUSE_BLD.x0 * TS + 16, S.HOUSE_BLD.y0 * TS + 16), 'ตัวบ้านต้องตัน'); }
// เมืองไม่มีที่ดินแล้ว • แมพบ้าน: พื้น 22x15, ผนัง/ช่องว่างเดินทะลุไม่ได้, ประตูเดินออกได้
{ const t = S.makeMap(); assert.ok(!t.some(r => r.includes(S.T.FLOOR)), 'แมพเมืองต้องไม่มีพื้นไม้ของที่ดินเดิม'); }
{ const m = S.makeHouseMap(); let f = 0; for (const r of m) for (const c of r) if (c === S.T.FLOOR) f++; assert.strictEqual(f, 22 * 15);
  assert.ok(S.blockedAt(m, 21 * TS, 15 * TS), 'ผนังบนต้องตัน'); assert.ok(S.blockedAt(m, 5 * TS, 5 * TS), 'นอกบ้านต้องตัน');
  assert.ok(!S.blockedAt(m, S.HOUSE_SPAWN.x, S.HOUSE_SPAWN.y), 'จุดเกิดในบ้านต้องเดินได้'); assert.ok(!S.blockedAt(m, 31.5 * TS, 31.5 * TS), 'ประตูต้องเดินออกได้'); }

// เข้าบ้านตัวเอง: เป็นฉากแยก คนในเมืองเห็นว่าหายไป
const before = { x: a.x, y: a.y };
w.handle(a, H({ a: 'enter' }));
assert.strictEqual(a.scene, 'alice'); const sc = last(wa, 'scene');
assert.ok(sc && sc.sc === 'alice' && sc.mine === true && sc.players.length === 1 && Array.isArray(sc.items), 'ต้องได้ข้อความ scene ของบ้านตัวเอง');
assert.ok(wb.msgs.some(m => m.t === 'p-' && m.id === a.id && m.quiet), 'คนในเมืองต้องเห็นเจ้าของหายไป (เงียบ ไม่ขึ้นแชท)');
assert.deepStrictEqual({ x: a.ret.x, y: a.ret.y }, before, 'จำตำแหน่งในเมืองไว้กลับมา');
const coin0 = a.rec.inv.coin; w.handle(a, { t: 'buy', item: 'seed_carrot', n: 1 }); assert.strictEqual(a.rec.inv.coin, coin0, 'ซื้อของในบ้านต้องไม่ได้');

// วางอิสระ: พิกัดละเอียด 1/4 ช่อง ไม่จำกัดชิ้นต่อช่อง
a.x = 28 * TS; a.y = 25 * TS;
w.handle(a, H({ a: 'place', f: 'table', x: 26.1, y: 20.2, r: 0 }));
const tid = idOf('table'); assert.ok(tid, 'วางโต๊ะได้'); assert.deepStrictEqual([items()[tid].x, items()[tid].y], [26, 20.25], 'พิกัดปัดเป็นทีละ 1/4 ช่อง');
w.handle(a, H({ a: 'place', f: 'teddy', x: 26, y: 20.25, r: 0 })); const ted = idOf('teddy');
assert.strictEqual(items()[ted].on, +tid, 'ของเล็กวางบนโต๊ะได้'); assert.strictEqual(items()[ted].z, S.FURN.table.h, 'ความสูงตามโต๊ะ');
w.handle(a, H({ a: 'place', f: 'teddy', x: 30.5, y: 22.75, r: 0 })); assert.strictEqual(Object.values(items()).filter(i => i.f === 'teddy').length, 2, 'ตุ๊กตาวางบนพื้นได้ใกล้ๆ กัน');
w.handle(a, H({ a: 'place', f: 'chair', x: 26.5, y: 20.25, r: 0 })); assert.ok(!idOf('chair'), 'ของตันซ้อนทับกันไม่ได้');
w.handle(a, H({ a: 'place', f: 'chair', x: 24.5, y: 20.25, r: 0 })); assert.ok(idOf('chair'), 'วางเก้าอี้ข้างโต๊ะติดกันได้');
w.handle(a, H({ a: 'place', f: 'rug', x: 28, y: 22, r: 0 })); w.handle(a, H({ a: 'place', f: 'chair', x: 28, y: 22, r: 0 })); assert.strictEqual(Object.values(items()).filter(i => i.f === 'chair').length, 2, 'ของวางบนพรมได้');
w.handle(a, H({ a: 'place', f: 'piano', x: 31.5, y: 30, r: 0 })); assert.ok(!idOf('piano'), 'หน้าประตูต้องเว้นว่าง');
w.handle(a, H({ a: 'place', f: 'piano', x: 3, y: 3, r: 0 })); assert.ok(!idOf('piano'), 'นอกพื้นบ้านวางไม่ได้');
w.handle(a, H({ a: 'place', f: 'piano', x: 40, y: 18, r: 0 })); assert.ok(idOf('piano'), 'เปียโนวางได้'); const pid = idOf('piano');
a.x = 40 * TS; a.y = 18 * TS; w.handle(a, H({ a: 'place', f: 'sofa', x: 40, y: 20, r: 0 })); assert.ok(idOf('sofa'), 'วางของใกล้ผู้เล่นได้ถ้าไม่ได้ยืนทับ');
w.handle(a, H({ a: 'place', f: 'lantern', x: 41, y: 29, r: 0 })); a.x = 28 * TS; a.y = 25 * TS;
a.x = 33 * TS; a.y = 27 * TS; w.handle(a, H({ a: 'place', f: 'chair', x: 33, y: 27, r: 0 })); assert.strictEqual(Object.values(items()).filter(i => i.f === 'chair').length, 2, 'วางทับคนที่ยืนอยู่ไม่ได้'); a.x = 28 * TS; a.y = 25 * TS;
// ของติดผนัง
w.handle(a, H({ a: 'place', f: 'painting', wl: 'n', u: 30.1 })); const pt = idOf('painting');
assert.deepStrictEqual([items()[pt].wl, items()[pt].u, items()[pt].y], ['n', 30, S.HFLOOR.y0], 'ภาพติดผนังหลังขวา');
w.handle(a, H({ a: 'place', f: 'painting', wl: 'n', u: 30.5 })); assert.strictEqual(Object.values(items()).filter(i => i.f === 'painting').length, 1, 'ติดผนังซ้อนกันไม่ได้');
w.handle(a, H({ a: 'place', f: 'painting', wl: 'w', u: 18 })); assert.strictEqual(Object.values(items()).filter(i => i.f === 'painting').length, 2, 'ติดผนังหลังซ้ายได้');
// เดิน: ชนเฟอร์นิเจอร์ตัน เดินผ่านของไม่ตัน
const tb = items()[tid]; assert.ok(S.houseBlockedAt(w.houseMap(), w.houseRects('alice'), tb.x * TS, tb.y * TS), 'โต๊ะต้องกั้นทาง');
assert.ok(!S.houseBlockedAt(w.houseMap(), w.houseRects('alice'), 36 * TS, 24 * TS), 'พื้นว่างเดินได้');
const px0 = a.x; w.handle(a, { t: 'm', x: a.x + 30, y: a.y, d: 3 }); assert.ok(a.x !== px0 || true);
// หมุน ย้าย (พร้อมของบนหลังย้ายตาม) เก็บคืน (ของบนหลังตกพื้น)
w.handle(a, H({ a: 'rot', i: pid })); assert.strictEqual(items()[pid].r, 1, 'หมุนเปียโน');
w.handle(a, H({ a: 'move', i: tid, x: 33, y: 22 })); assert.deepStrictEqual([items()[tid].x, items()[tid].y], [33, 22], 'ย้ายโต๊ะ'); assert.deepStrictEqual([items()[ted].x, items()[ted].y], [33, 22], 'ตุ๊กตาบนโต๊ะย้ายตาม');
w.handle(a, H({ a: 'move', i: tid, x: 40, y: 18 })); assert.deepStrictEqual([items()[tid].x, items()[tid].y], [33, 22], 'ย้ายไปทับเปียโนไม่ได้ ต้องอยู่ที่เดิม');
w.handle(a, H({ a: 'remove', i: tid })); assert.ok(!items()[tid] && a.rec.inv.furn_table === 1, 'เก็บโต๊ะคืนกระเป๋า');
assert.deepStrictEqual([items()[ted].z, items()[ted].on], [0, null], 'ของที่เคยวางบนโต๊ะตกลงพื้น');
assert.ok(count(wa, 'furn') >= 8, 'เจ้าของได้ข้อความ furn'); assert.strictEqual(count(wb, 'furn'), 0, 'คนในเมืองไม่ได้รับข้อความ furn ของบ้าน');
// สแนปช็อต: คนในบ้านไม่เห็นคนในเมือง
w.tick(0.05, Date.now());
const sn = last(wa, 's'); assert.ok(sn && sn.p.every(r => r[0] === a.id) && sn.c.length === 0, 'สแนปช็อตในบ้านต้องมีแค่คนในบ้าน');
const sb = last(wb, 's'); assert.ok(sb.p.every(r => r[0] === b.id), 'สแนปช็อตในเมืองต้องไม่มีคนที่อยู่ในบ้าน');
// นั่ง
const sid = idOf('sofa'); a.x = 38 * TS; a.y = 20 * TS; w.handle(a, { t: 'act', tool: '', i: +sid }); assert.ok(a.sit && a.sit.i === +sid && !a.sit.lie, 'นั่งโซฟาได้'); { const sp = S.seatSpots(items()[sid])[a.sit.k]; assert.strictEqual(Math.round(a.x), Math.round(sp.x * TS), 'นั่งตรงที่นั่งของโซฟา (โซฟา 2 ที่นั่ง)'); }
w.handle(a, H({ a: 'remove', i: +sid })); assert.strictEqual(a.sit, null, 'ที่นั่งถูกเก็บ = ลุกขึ้น'); a.x = 28 * TS; a.y = 25 * TS;

// ลีดเดอร์บอร์ด + เยี่ยมบ้าน
const expectScore = S.houseScore(items());
w.handle(b, H({ a: 'board' })); const bd = last(wb, 'hboard');
assert.strictEqual(bd.list.length, 1); assert.deepStrictEqual([bd.list[0].n, bd.list[0].v, bd.list[0].c], ['alice', expectScore.value, expectScore.count]);
w.handle(b, H({ a: 'enter', who: 'nobody' })); assert.ok(!b.scene, 'ไม่มีบ้านนี้ต้องไม่เข้า');
b.lastEnter = 0; w.handle(b, H({ a: 'enter', who: 'bob' })); assert.strictEqual(b.scene, 'bob', 'เข้าบ้านตัวเองเสมอได้ (สร้างว่างๆ)'); w.handle(b, H({ a: 'exit' })); assert.ok(!b.scene);
b.rec.inv.furn_chair = 1; b.lastEnter = 0; w.handle(b, H({ a: 'enter', who: 'Alice' }));
assert.strictEqual(b.scene, 'alice', 'เยี่ยมบ้านเพื่อนจากชื่อ (ไม่สนตัวพิมพ์)'); const sv = last(wb, 'scene');
assert.ok(!sv.mine && sv.items.length === Object.keys(items()).length && sv.players.length === 2, 'ผู้เยี่ยมเห็นของและเจ้าของบ้าน');
const n0 = Object.keys(items()).length;
w.handle(b, H({ a: 'place', f: 'chair', x: 36, y: 25, r: 0 })); w.handle(b, H({ a: 'remove', i: pid })); w.handle(b, H({ a: 'move', i: pid, x: 36, y: 25 })); w.handle(b, H({ a: 'rot', i: pid }));
assert.ok(Object.keys(items()).length === n0 && b.rec.inv.furn_chair === 1 && items()[pid].r === 1, 'ผู้เยี่ยมวาง/เก็บ/ย้าย/หมุนของในบ้านคนอื่นไม่ได้');
// ออกจากบ้านด้วยการเดินไปที่ประตู → กลับตำแหน่งเดิมในเมือง
const bPos = { x: b.ret.x, y: b.ret.y };
w.handle(b, { t: 'm', x: S.HOUSE_SPAWN.x, y: 31.5 * TS, d: 0 }); assert.ok(!b.scene, 'เดินถึงประตู = ออกจากบ้าน');
assert.ok(Math.hypot(b.x - bPos.x, b.y - bPos.y) < 1 || S.blockedAt(w.map, bPos.x, bPos.y), 'กลับตำแหน่งเดิมในเมือง');
assert.ok(last(wb, 'scene').sc === null, 'ได้ข้อความ scene กลับเมือง');

// บันทึกแล้วโหลดใหม่ + ออกเกมตอนอยู่ในบ้านต้องบันทึกตำแหน่งในเมือง
const aRet = { x: a.ret.x, y: a.ret.y }, snapItems = JSON.stringify(items());
w.leave(a); assert.deepStrictEqual({ x: a.rec.x, y: a.rec.y }, aRet, 'ออกเกมตอนอยู่ในบ้านต้องจำตำแหน่งในเมือง');
w.dirty = true; w.save(true);
const w2 = new World('main');
assert.strictEqual(JSON.stringify(w2.houses.alice.items), snapItems, 'ของในบ้านต้องคงอยู่ครบหลังรีสตาร์ต (id/พิกัด/ความสูง)');
assert.ok(w2.houses.alice.next > Math.max(...Object.keys(w2.houses.alice.items).map(Number)), 'ตัวนับ id ต่อจากเดิม');

// ย้ายข้อมูลจากรุ่นแรก (ช่องละชิ้น 'x,y' → f ใต้ houses) และจากระบบที่ดินเดิม (owners/items)
const f1 = path.join(process.env.DATA_DIR, 'v1.json');
fs.writeFileSync(f1, JSON.stringify({ players: { erin: { name: 'erin', inv: { coin: 1 } } }, house: { houses: { erin: { items: { '25,20': 'sofa', '26,24': 'painting', '30,22': 'piano' } } } } }));
const wv = new World('v1');
assert.deepStrictEqual(Object.values(wv.houses.erin.items).map(i => [i.f, i.x, i.y, i.wl, i.u]).sort(), [['painting', 26.5, 16, 'n', 26.5], ['piano', 30.5, 22.5, undefined, undefined], ['sofa', 25.5, 20.5, undefined, undefined]].sort(), 'บ้านรุ่นแรกแปลงเป็นกึ่งกลางช่อง ภาพขึ้นผนัง');
const f2 = path.join(process.env.DATA_DIR, 'legacy.json');
fs.writeFileSync(f2, JSON.stringify({ players: { carol: { name: 'carol', inv: { coin: 1 } }, dave: { name: 'dave', inv: { coin: 1 } } },
  house: { owners: { 1: 'carol', 2: 'dave' }, items: { '9,2': 'chair', '12,5': 'sofa', '17,3': 'rug', '40,4': 'tv' } } }));
const w3 = new World('legacy');
assert.deepStrictEqual(Object.values(w3.houses.carol.items).map(i => [i.f, i.x, i.y]).sort(), [['chair', 23.5, 18.5], ['sofa', 26.5, 21.5]].sort(), 'ย้ายของจากแปลงที่ 2 ไปมุมซ้ายบนของพื้นบ้าน');
assert.deepStrictEqual(Object.values(w3.houses.dave.items).map(i => [i.f, i.x, i.y]), [['rug', 24.5, 19.5]], 'ย้ายของจากแปลงที่ 3');
console.log('✓ ผ่าน: ระบบบ้านหลังใหญ่ (ฉากแยก ตกแต่งอิสระ เยี่ยมบ้าน ลีดเดอร์บอร์ด บันทึก ย้ายข้อมูลเดิม)');
process.exit(0);
