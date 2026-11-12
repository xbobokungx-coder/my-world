// ทดสอบขุดซ้ำช่องที่ขุดแล้ว: ต้องไม่เกิดอะไรขึ้น (ช่องไม่หาย จอบ/พลังงาน/XP ไม่เปลี่ยน ไม่มีเสียง/tileUpdate) • node tools/test-hoe-redig.js
// ตั้ง SERVER_JS=/path/to/server.js เพื่อรันกับสำเนา server อื่น (ใช้พิสูจน์ว่าเทสต์จับบั๊กได้)
const assert = require('assert'), path = require('path');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-hoe-');
let NOW = Date.now(); Date.now = () => NOW; // เวลาปลอมเดินเอง (พ้น cooldown ของ act)
const { World } = require(process.env.SERVER_JS || '../server.js'), S = require('../public/shared.js'), TS = S.TS;

const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('hoeredig'), ws = mkWs();
w.themeRain = () => 'off';
const p = w.join(ws, 'Digger', '#fff').p;
p.rec.inv = Object.assign(p.rec.inv || {}, { coin: 500, seed_carrot: 5 }); p.rec.hunger = 100;
const at = (x, y, dir) => { p.x = (x + 0.5) * TS; p.y = (y + 0.5) * TS; p.dir = dir; };
const act = (tool, tx, ty) => { NOW += 1000; w.handle(p, { t: 'act', tool, tx, ty }); };
const state = () => JSON.stringify({ rec: p.rec, heat: p.heat || null, en: w.enOf(p), farm: w.farm });
const texts = m => m.filter(x => x.t === 'msg').map(x => x.text);
const clear = () => { ws.msgs.length = 0; };

// ช่องทดสอบในแปลงผัก (y 14+ ไม่ใช่แปลงเช่า) : เลือกช่องหญ้าที่ไม่ถูกบล็อกและยังไม่มีใน farm
const FARM = S.FARM || { x0: 3, y0: 11, x1: 18, y1: 20 };
const T = S.T, cells = [];
for (let y = FARM.y0; y <= FARM.y1 && cells.length < 3; y++) for (let x = FARM.x0; x <= FARM.x1 && cells.length < 3; x++) {
  if (y >= 14 && w.map[y][x] === T.GRASS && !w.farm[x + ',' + y]) cells.push([x, y]);
}
assert.ok(cells.length >= 3, 'ต้องมีช่องหญ้าในแปลงผัก');
const [cx, cy] = cells[0], k = cx + ',' + cy;
at(cx, cy + 1, 1);

// (1) ขุดครั้งแรกสำเร็จ
{
  const xp0 = p.rec.xp ? JSON.stringify(p.rec.xp) : '', dur0 = w.durCur(p, 'hoe'), heat0 = JSON.stringify(p.heat || null);
  clear(); act('hoe', cx, cy);
  assert.ok(w.farm[k], 'ช่องต้องเข้า farm: ' + JSON.stringify(texts(ws.msgs)));
  assert.notStrictEqual(JSON.stringify(p.rec.xp || ''), xp0, 'XP ฟาร์มต้องเพิ่ม');
  assert.ok(ws.msgs.some(m => m.t === 'sfx' && m.k === 'hoe'), 'ต้องมีเสียง hoe');
  assert.ok(w.durCur(p, 'hoe') < dur0 || JSON.stringify(p.heat) !== heat0, 'จอบต้องสึก');
  console.log('  (1) ขุดครั้งแรกสำเร็จ (ช่องเข้า farm, XP, จอบสึก, พลังงาน, เสียง)');
}
// (2) ขุดซ้ำ 3 ครั้ง ไม่เกิดอะไรขึ้น
{
  const before = state(); clear();
  for (let i = 0; i < 3; i++) act('hoe', cx, cy);
  assert.ok(w.farm[k], 'ช่องต้องไม่ถูกลบออกจาก farm');
  assert.strictEqual(state(), before, 'ขุดซ้ำต้องไม่เปลี่ยน rec/heat/พลังงาน/farm');
  assert.ok(!ws.msgs.some(m => m.t === 'sfx' && m.k === 'hoe'), 'ต้องไม่มีเสียง hoe');
  assert.ok(!ws.msgs.some(m => m.t === 'dur'), 'ต้องไม่ส่งความทนทานจอบใหม่');
  assert.ok(!ws.msgs.some(m => /tile/i.test(m.t) && JSON.stringify(m).includes(k)), 'ต้องไม่มี tileUpdate ของช่องนี้: ' + JSON.stringify(ws.msgs));
  console.log('  (2) ขุดซ้ำ 3 ครั้ง ไม่เกิดอะไรขึ้น');
}
// (5) หลังขุดซ้ำ ปลูก/รดน้ำยังทำงาน
{
  at(cx, cy + 1, 1);
  act('seed_carrot', cx, cy);
  assert.ok(w.farm[k] && w.farm[k].c === 'carrot', 'ต้องปลูกแครอทได้: ' + JSON.stringify(w.farm[k]) + JSON.stringify(texts(ws.msgs)));
  act('water', cx, cy);
  assert.ok(w.farm[k].wu, 'ต้องรดน้ำได้: ' + JSON.stringify(w.farm[k]) + JSON.stringify(texts(ws.msgs)));
  console.log('  (5) ปลูก/รดน้ำบนช่องที่ขุดซ้ำได้');
}
// (3) ช่องมีพืช ขุดไม่ได้
{
  const before = state(); clear(); act('hoe', cx, cy);
  assert.ok(texts(ws.msgs).includes('มีพืชอยู่ ขุดไม่ได้'), 'ต้องมีข้อความพืชอยู่: ' + JSON.stringify(texts(ws.msgs)));
  assert.ok(w.farm[k] && w.farm[k].c === 'carrot', 'พืชต้องยังอยู่');
  assert.strictEqual(state(), before);
  console.log('  (3) ช่องมีพืช: ขึ้นข้อความ ขุดไม่ได้');
}
// (4) นอกแปลง
{
  at(10, 24, 1); const before = state(); clear(); act('hoe', 10, 23);
  assert.ok(texts(ws.msgs).includes('ขุดได้เฉพาะในแปลงผัก'), 'ต้องมีข้อความนอกแปลง: ' + JSON.stringify(texts(ws.msgs)));
  assert.strictEqual(state(), before);
  console.log('  (4) นอกแปลง: ขึ้นข้อความ');
}
console.log('PASS test-hoe-redig');
process.exit(0);
