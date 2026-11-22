// ทดสอบร้านอาวุธ/ชุดเกราะ (ดาบไม้ sword_1 / ชุดเกราะไม้ armor_1): node tools/test-weapon-armor.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-wsa-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('wsa'); const ws = mkWs();
const p = w.join(ws, 'Tester', '#fff').p, M = ws.msgs;
p.rec.hunger = 100;
const stand = (x, y) => { p.x = (x + 0.5) * TS; p.y = (y + 0.5) * TS; };
const toasts = () => M.filter(x => x.t === 'msg').map(x => x.text).join('|');
const act = (tool, tx, ty) => { p.lastAct = 0; w.handle(p, { t: 'act', tool, tx, ty }); };
const wb = S.BUILDINGS.find(b => b.kind === 'weapon'), ab = S.BUILDINGS.find(b => b.kind === 'armor');
assert.ok(!wb.closed && !ab.closed && S.SHOPS.weapon && S.SHOPS.armor);
assert.strictEqual(S.WEAPON.sword[1].price, 60); assert.strictEqual(S.ARMOR[1].price, 120);
// (1) act ที่ประตูแต่ละร้านเปิดร้านของตัวเอง ทั้งมือเปล่าและถือดาบ
for (const [b, kind] of [[wb, 'weapon'], [ab, 'armor']]) for (const tool of ['hand', 'sword']) {
  const [cx, cy] = b.counter[0]; stand(cx, cy + 1); M.length = 0; act(tool, cx, cy);
  assert.ok(M.some(x => x.t === 'shop' && x.kind === kind), `${tool} ที่ร้าน ${kind} ต้องเปิดร้าน`);
}
// (2) ซื้อ: เหรียญไม่พอ → ไม่ได้ของ
const bw = () => { const [cx, cy] = wb.counter[0]; stand(cx, cy + 1); }, ba = () => { const [cx, cy] = ab.counter[0]; stand(cx, cy + 1); };
p.rec.inv = { coin: 59 }; bw(); w.handle(p, { t: 'buy', item: 'sword_1', n: 1 }); assert.ok(!p.rec.inv.sword_1 && p.rec.inv.coin === 59, 'เหรียญไม่พอห้ามได้ของ');
p.rec.inv = { coin: 119 }; ba(); w.handle(p, { t: 'buy', item: 'armor_1', n: 1 }); assert.ok(!p.rec.inv.armor_1 && !p.rec.wear.arm);
// ซื้อผิดร้าน/ของไม่มีในร้าน
p.rec.inv = { coin: 1000 }; bw(); w.handle(p, { t: 'buy', item: 'armor_1', n: 1 }); assert.ok(!p.rec.inv.armor_1, 'ร้านอาวุธไม่ขายเกราะ');
w.handle(p, { t: 'buy', item: 'sword_2', n: 1 }); w.handle(p, { t: 'buy', item: 'sword_-1', n: 1 }); assert.strictEqual(p.rec.inv.coin, 1000);
// (3) ซื้อดาบ หัก 60 ซื้อซ้ำไม่ได้ (n ปลอมก็ได้ชิ้นเดียว)
w.handle(p, { t: 'buy', item: 'sword_1', n: 5 }); assert.strictEqual(p.rec.inv.sword_1, 1); assert.strictEqual(p.rec.inv.coin, 940);
M.length = 0; w.handle(p, { t: 'buy', item: 'sword_1', n: 1 }); assert.strictEqual(p.rec.inv.sword_1, 1); assert.strictEqual(p.rec.inv.coin, 940); assert.ok(/มีของชิ้นนี้อยู่แล้ว/.test(toasts()));
// (4) ซื้อเกราะ หัก 120 + สวมให้ + broadcast look ถึงคนอื่น
const ws2 = mkWs(), q = w.join(ws2, 'Other', '#000').p; ws2.msgs.length = 0;
ba(); M.length = 0; w.handle(p, { t: 'buy', item: 'armor_1', n: 1 });
assert.strictEqual(p.rec.inv.armor_1, 1); assert.strictEqual(p.rec.inv.coin, 820); assert.strictEqual(p.rec.wear.arm, 1);
assert.ok(M.some(x => x.t === 'look' && x.wear && x.wear.arm === 1), 'ส่ง look ให้เจ้าตัว');
assert.ok(ws2.msgs.some(x => x.t === 'look' && x.id === p.id && x.wear.arm === 1), 'คนอื่นเห็นเกราะ');
w.handle(p, { t: 'buy', item: 'armor_1', n: 1 }); assert.strictEqual(p.rec.inv.coin, 820);
// (5) look: ปลอม ไม่เปลี่ยน • 0 ถอด • N จริง สวม
const lk = arm => w.handle(p, { t: 'look', wear: { arm } });
for (const bad of [9, '1', 'x', 1.5, -1, null, NaN, {}, [], true]) { lk(bad); assert.strictEqual(p.rec.wear.arm, 1, 'arm ปลอมต้องไม่เปลี่ยน: ' + JSON.stringify(bad)); }
lk(0); assert.ok(!('arm' in p.rec.wear), 'arm 0 = ถอด'); lk(1); assert.strictEqual(p.rec.wear.arm, 1);
p.rec.inv.armor_1 = 0; delete p.rec.wear.arm; lk(1); assert.ok(!p.rec.wear.arm, 'ไม่มีของ สวมไม่ได้'); p.rec.inv.armor_1 = 1;
// (6) ขายคืน 70% = 42/84 และถอด • ขายผิดร้านไม่ได้
lk(1); w.handle(p, { t: 'look', wear: { arm: 1 } });
bw(); w.handle(p, { t: 'sellback', item: 'armor_1' }); assert.strictEqual(p.rec.inv.armor_1, 1, 'ขายเกราะที่ร้านอาวุธไม่ได้');
let c0 = p.rec.inv.coin; w.handle(p, { t: 'sellback', item: 'sword_1' }); assert.ok(!p.rec.inv.sword_1); assert.strictEqual(p.rec.inv.coin - c0, 42);
ba(); c0 = p.rec.inv.coin; w.handle(p, { t: 'sellback', item: 'armor_1' }); assert.ok(!p.rec.inv.armor_1); assert.strictEqual(p.rec.inv.coin - c0, 84); assert.ok(!p.rec.wear.arm, 'ขายคืนแล้วถอดเกราะ');
w.handle(p, { t: 'sellback', item: 'armor_1' }); assert.strictEqual(p.rec.inv.coin - c0, 84, 'ขายซ้ำไม่ได้เงิน');
// (7) join: arm ที่ไม่มีของจริงถูกลบ แต่ที่มีจริงคงไว้
{
  const fs = require('fs'), path = require('path'), k = p.key;
  const w2 = new World('wsa2'); const a = w2.join(mkWs(), 'Aaa', '#fff').p; const key = a.key;
  a.rec.wear.arm = 1; a.rec.inv.armor_1 = 0; w2.leave(a); w2.dirty = true;
  const b = w2.join(mkWs(), 'Aaa', '#fff'); const bp = b.p || b;
  assert.ok(bp.rec.wear.arm === undefined, 'join ต้องลบ arm ที่ไม่มีของ');
  bp.rec.wear.arm = 1; bp.rec.inv.armor_1 = 1; w2.leave(bp);
  const c = w2.join(mkWs(), 'Aaa', '#fff'); assert.strictEqual((c.p || c).rec.wear.arm, 1, 'join คง arm ที่มีของ');
}
// (8) ใช้ดาบ (tool sword): ผักสุก/ไข่/ข้อความฟันลม ไม่เกิน 1 ครั้ง/30 วิ • ไม่มีดาบ = เงียบ
p.rec.inv = { coin: 0, sword_1: 1 }; stand(10, 10); M.length = 0; const t0 = Date.now();
p.swordMsgAt = 0; act('sword'); assert.ok(/ยังไม่มีอะไรให้ฟัน/.test(toasts()), 'ฟันลมครั้งแรกมีข้อความ');
M.length = 0; act('sword'); assert.ok(!/ยังไม่มีอะไรให้ฟัน/.test(toasts()), 'ครั้งที่สองใน 30 วิ ต้องเงียบ');
p.swordMsgAt = Date.now() - S.SWORD_IDLE_MS - 1; M.length = 0; act('sword'); assert.ok(/ยังไม่มีอะไรให้ฟัน/.test(toasts()), 'เกิน 30 วิ ขึ้นอีกได้');
p.rec.inv = { coin: 0 }; p.swordMsgAt = 0; M.length = 0; act('sword'); assert.ok(!/ฟัน/.test(toasts()), 'ไม่มีดาบ = เงียบ');
// ผักสุกด้วยดาบ = เก็บเกี่ยวเหมือนมือเปล่า
{
  p.rec.inv = { coin: 0, sword_1: 1 }; stand(10, 10); const [fx, fy] = S.facing(p.x, p.y, p.dir), k = fx + ',' + fy;
  w.map[fy][fx] = S.T.FARM !== undefined ? S.T.FARM : w.map[fy][fx];
  w.farm[k] = { c: 'carrot', g: 99999999, m: 0, o: p.key, on: p.name, rm: 0 };
  assert.strictEqual(S.cropStage(w.farm[k]), 3, 'ตั้งผักสุกไม่สำเร็จ'); { act('sword'); assert.ok(p.rec.inv.crop_carrot >= 1, 'เก็บผักด้วยดาบได้'); delete w.farm[k]; }
}
// (9) held 🗡️ / 🦺 ผ่าน
for (const e of ['🗡️', '🦺']) { w.handle(p, { t: 'held', e }); assert.strictEqual(p.held, e); }
// (10) ไม่ใช่งานหนัก / itemInfo / kindOf / ไม่มี DURABILITY / ไม่ซ้ำอีโมจิ
assert.ok(!w.heavyAction('sword', '0,0'));
assert.ok(!S.DURABILITY.sword && !S.DURABILITY.armor);
for (const k of ['sword_1', 'armor_1']) { const i = S.itemInfo(k); assert.ok(i && i.once && i.cat === 'gear' && i.buy && !i.sell && i.emoji, k); assert.strictEqual(S.kindOf(k), 'tool', 'kindOf ' + k); }
assert.strictEqual(S.sellbackValue('sword_1'), 42); assert.strictEqual(S.sellbackValue('armor_1'), 84);
assert.strictEqual(S.swordTier({ sword_1: 1 }), 1); assert.strictEqual(S.swordTier({}), 0); assert.strictEqual(S.armorTier({ armor_1: 1 }), 1);
console.log('OK test-weapon-armor');
