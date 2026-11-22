// ทดสอบป่ารอบหอคอย 100 ชั้น: ปลูกเต็มทุกช่อง เว้นทางเดินหน้าประตู • ตัดแล้วงอกคืนที่เดิมทีละต้น • ไม่นับเพดาน/ไม่โดนถอนตามโควตา • ไม่งอกทับตัวผู้เล่น
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-grove-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, T = S.T, G = S.GROVE, TW = S.JGATE;

// แมพใหม่: ทุกช่องในกรอบป่า (ยกเว้นฐานหอ/ทางเดินหน้าประตู) เป็นต้นไม้ ทางเดินหน้าประตูโล่ง
{
  const m = S.makeMap(); let n = 0;
  for (let y = TW.y0 - 1; y <= TW.y1 + 2; y++) for (let x = TW.x0 - 2; x <= TW.x1 + 2; x++) {
    const base = S.jgateAt(x, y), walk = x >= TW.door[0] && x <= TW.door[2] && y > TW.y1;
    if (base) assert.strictEqual(m[y][x], T.LANDMARK, 'ฐานหอ'); else if (walk) assert.strictEqual(m[y][x], T.GRASS, `ทางเดินหน้าประตู ${x},${y} ต้องโล่ง`);
    else { assert.strictEqual(m[y][x], T.TREE, `ช่อง ${x},${y} ต้องเป็นต้นไม้`); n++; }
    assert.strictEqual(S.groveHas(x, y), !base && !walk);
  }
  assert.strictEqual(S.groveCells(m).length, n); assert.ok(n >= 28, 'ป่ารอบหอหนาแน่น ' + n);
  { const b = S.makeMap({ bare: true }); assert.ok(S.groveCells(b).some(([x, y]) => b[y][x] !== T.TREE), 'แมพเปล่า (bare) ไม่ปลูกป่าเต็ม'); }
}

// ผ่านเซิร์ฟเวอร์: เริ่มโลกใหม่ป่าเต็ม • ตัดแล้วงอกคืนช้าๆ ที่เดิม • ไม่นับเพดาน
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('grove'), p = w.join(mkWs(), 'Gard', '#fff').p;
const cells = S.groveCells(w.map);
assert.ok(cells.every(([x, y]) => w.map[y][x] === T.TREE), 'โลกใหม่ป่าเต็ม');
assert.ok(cells.every(([x, y]) => w.treeKind.get(x + ',' + y)), 'ทุกต้นมีชนิด');
assert.strictEqual(w.treeListFree().length, w.treeList().length - cells.length, 'ป่ารอบหอไม่นับเข้ารายการต้นไม้ที่คุมเพดาน');
p.x = 40 * TS; p.y = 40 * TS; // ผู้เล่นอยู่ไกล
// ตัดทิ้ง 5 ต้น → งอกคืนทีละต้นเมื่อครบ regrowMs (ครั้งแรกทันทีเพราะ groveAt ยังเป็น 0)
const cut = cells.slice(0, 5); for (const [x, y] of cut) { w.map[y][x] = T.GRASS; w.treeKind.delete(x + ',' + y); }
let t = Date.now(), back = 0; const left = () => cut.filter(([x, y]) => w.map[y][x] !== T.TREE).length;
w.groveTick(t); assert.strictEqual(left(), 4, 'งอกคืน 1 ต้น'); w.groveTick(t + 1000); assert.strictEqual(left(), 4, 'ยังไม่ครบเวลา ไม่งอกเพิ่ม');
for (let i = 1; i <= 4; i++) { w.groveTick(t + i * G.regrowMs + 1); }
assert.strictEqual(left(), 0, 'ครบเวลาทีละต้น กลับมาครบ'); assert.ok(cut.every(([x, y]) => w.treeKind.get(x + ',' + y)), 'ต้นที่งอกคืนมีชนิด');
const msgs = p.ws.msgs.filter(m => m.t === 'tree' && m.on); assert.ok(msgs.length >= 5, 'ประกาศต้นไม้งอกให้ผู้เล่นเห็น');
// ไม่งอกทับตัวผู้เล่น
{ const [x, y] = cells[10]; w.map[y][x] = T.GRASS; w.treeKind.delete(x + ',' + y); p.x = (x + 0.5) * TS; p.y = (y + 0.5) * TS; w.groveAt = 0; w.groveTick(t + 100 * G.regrowMs); assert.strictEqual(w.map[y][x], T.GRASS, 'ยืนอยู่ ไม่งอกทับตัว');
  p.x = 40 * TS; p.y = 40 * TS; w.groveTick(t + 200 * G.regrowMs); assert.strictEqual(w.map[y][x], T.TREE, 'ย้ายออกแล้วงอก'); }
// ไม่มีผู้เล่น = ไม่งอก (โลกจำศีล)
{ const [x, y] = cells[11]; w.map[y][x] = T.GRASS; const keep = new Map(w.players); w.players.clear(); w.groveAt = 0; w.groveTick(t + 300 * G.regrowMs); assert.strictEqual(w.map[y][x], T.GRASS, 'ไม่มีคนออนไลน์ ไม่งอก'); for (const [k, v] of keep) w.players.set(k, v); p.x = 40 * TS; p.y = 40 * TS; w.groveAt = 0; w.groveTick(t + 400 * G.regrowMs); assert.strictEqual(w.map[y][x], T.TREE); }
console.log('✓ ผ่าน: ป่ารอบหอคอย');
process.exit(0);
