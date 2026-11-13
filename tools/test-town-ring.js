// ทดสอบผังเมืองร้านล้อมลานกองไฟ (docs/plans/town-ring-layout.md ขั้น 2) — ผ่านทั้งผังเก่าและผังใหม่
// อ่านผังจาก shared.js ล้วนๆ (ไม่แตะเซิร์ฟเวอร์/data) • TOWN_RING_SHARED=<path> ใช้ทดลองกับสำเนา shared.js
const assert = require('assert'), path = require('path');
const S = require(process.env.TOWN_RING_SHARED ? path.resolve(process.env.TOWN_RING_SHARED) : '../public/shared.js');
const { TS, W, H, T } = S;
const m = S.makeMap(), bare = S.makeMap({ bare: true });
const shops = S.BUILDINGS.filter(b => b.kind !== 'sign');
assert(shops.length >= 10, 'ต้องมีร้านอย่างน้อย 10 ร้าน (นับจาก BUILDINGS ไม่รวม sign)');
const isClosed = b => !!b.closed; // ร้านปิดปรับปรุง: ไม่อยู่ใน SHOPS เปิดไม่ได้ แต่ยังต้องต่อทาง/ไม่ทับกัน
const door = b => [b.counter[0][0], b.counter[0][1] + 1]; // ช่องยืนหน้าประตู (เหมือน validateLayout)
const key = (x, y) => y * 1000 + x;
// ช่องชน: เทียบเท่า solid() ใน shared.js (ใช้ S.blockedAt ที่กลางช่อง — รัศมี 8px อยู่ในช่องเดียว)
const solidT = (x, y) => x < 0 || y < 0 || x >= W || y >= H || S.blockedAt(m, x * TS + TS / 2, y * TS + TS / 2);
// เครือข่ายทาง: PATH/SAND/BRIDGE/STAIR หรือพื้นปูหิน (isPaved: ลาน + แถวหน้าประตู)
const roadT = (x, y) => x >= 0 && y >= 0 && x < W && y < H && ([T.PATH, T.SAND, T.BRIDGE, T.STAIR].includes(m[y][x]) || S.isPaved(x, y));
function bfs(sx, sy, ok) {
  const seen = new Set([key(sx, sy)]), q = [[sx, sy]];
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of S.DIRS) { const nx = x + dx, ny = y + dy; if (ok(nx, ny) && !seen.has(key(nx, ny))) { seen.add(key(nx, ny)); q.push([nx, ny]); } } }
  return seen;
}
const F = S.FIRE, fireAdj = S.DIRS.map(([dx, dy]) => [F.x + dx, F.y + dy]);

// (1) ช่องยืนหน้าประตูเดินถึงช่องติดกองไฟได้ (BFS บนช่องไม่ชน)
for (const b of shops) {
  const [dx, dy] = door(b);
  assert(!solidT(dx, dy), `${b.kind}: ช่องยืนหน้าประตู (${dx},${dy}) ชน`);
  if (isClosed(b)) continue; // ร้านปิดไม่ต้องเดินถึงเพื่อเปิดร้าน (ข้อ 2 ยังตรวจการต่อทางอยู่)
  const seen = bfs(dx, dy, (x, y) => !solidT(x, y));
  assert(fireAdj.some(([x, y]) => seen.has(key(x, y))), `${b.kind}: เดินจากหน้าประตูไปติดกองไฟไม่ถึง`);
}
// (2) ช่องยืนต่อเครือข่ายทางถึงลานกองไฟ
const P = S.PLAZA;
for (const b of shops) {
  const [dx, dy] = door(b);
  const seen = bfs(dx, dy, roadT);
  let hit = false; for (let y = P.y0; y <= P.y1 && !hit; y++) for (let x = P.x0; x <= P.x1; x++) if (seen.has(key(x, y))) { hit = true; break; }
  assert(hit, `${b.kind}: ช่องหน้าประตูไม่ต่อทางถึงลานกองไฟ`);
}
// (3) ร้านไม่ทับเขตห้าม + ไม่ทับกันเอง (กฎเดียวกับ validateLayout ใน server.js)
const inRect = (x, y, r, pad) => x >= r.x0 - pad && x <= r.x1 + pad && y >= r.y0 - pad && y <= r.y1 + pad;
const ARCADE = { x0: 24, y0: 1, x1: 41, y1: 7 }; // เทียบเท่า PAVED_RECTS[0] ลานตู้เกม (ไม่ได้ export จาก shared.js) — ถ้าลานนี้ย้าย ต้องแก้ตรงนี้
const okTerrain = new Set([T.GRASS, T.PATH, T.SAND, T.TREE]); // เหมือน okTerrain ใน validateLayout: ไม่ทับน้ำ/รั้ว/หน้าผา
const occ = new Map();
for (const b of shops) for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
  const at = `${b.kind} (${x},${y})`;
  assert(x < 45, `${at} x>=45 (เขตเล้า/ขอบเมือง)`);
  assert(okTerrain.has(bare[y][x]), `${at} ทับน้ำ/รั้ว/หน้าผา type=${bare[y][x]}`);
  assert(!inRect(x, y, S.FARM, 1), `${at} ทับแปลงผัก±1`);
  for (const [n, pen] of Object.entries(S.PENS)) assert(!inRect(x, y, pen, 1), `${at} ทับเล้า ${n}±1`);
  assert(!inRect(x, y, S.HOUSE_BLD, 0), `${at} ทับบ้านหลังใหญ่`);
  assert(!inRect(x, y, ARCADE, 0), `${at} ทับลาน Arcade`);
  assert(!occ.has(key(x, y)), `${at} ซ้อนกับ ${occ.get(key(x, y))}`); occ.set(key(x, y), b.kind);
}
// ช่องยืนหน้าประตูต้องไม่ทับตัวร้านอื่นและไม่ทับเขตห้าม (เหมือน claim แบบ floating)
for (const b of shops) { const [x, y] = door(b); assert(!occ.has(key(x, y)), `${b.kind}: ช่องยืนทับร้าน ${occ.get(key(x, y))}`); assert(!inRect(x, y, S.FARM, 1) || b.kind === 'farm', `${b.kind}: ช่องยืนทับแปลงผัก±1`); }
// (4) ประตูสองร้านห่างกัน >= 4 ช่อง (ยุคลิด)
for (let i = 0; i < shops.length; i++) for (let j = i + 1; j < shops.length; j++) {
  const a = door(shops[i]), c = door(shops[j]);
  assert(Math.hypot(a[0] - c[0], a[1] - c[1]) >= 4, `ประตู ${shops[i].kind} กับ ${shops[j].kind} ใกล้กันเกินไป`);
}
// (5) nearShopKind (server/systems/core.js ~133): เทียบเท่า — ร้านที่ counter ใกล้สุดในรัศมี 110px จากกลางช่องยืน (ผู้เล่นยืนกลางช่อง y+1 ใต้ counter)
// เรียกของจริงต้องสร้าง World+ผู้เล่น จึงคำนวณซ้ำด้วยสูตรเดียวกัน (วนทุก counter ของทุกร้านที่มี SHOPS[kind])
const nearShop = (px, py) => { let best = null, bd = 110; for (const b of S.BUILDINGS) for (const [cx, cy] of b.counter) { if (!S.SHOPS[b.kind]) continue; const d = Math.hypot(px - (cx + 0.5) * TS, py - (cy + 0.5) * TS); if (d < bd) { bd = d; best = b.kind; } } return best; };
for (const b of shops) {
  const [x, y] = door(b), got = nearShop((x + 0.5) * TS, (y + 0.5) * TS);
  if (isClosed(b)) { assert(!S.SHOPS[b.kind], `${b.kind}: ร้านปิดต้องไม่มีใน SHOPS`); assert.strictEqual(got, null, `${b.kind}: ร้านปิดต้องได้ nearShop = null แต่ได้ ${got}`); }
  else assert.strictEqual(got, b.kind, `${b.kind}: nearShopKind ที่ช่องยืนไม่ใช่ร้านนี้`);
}
// (6) SPAWN, START_SPAWN, NPC home ไม่อยู่บนช่องชน
const pxBlocked = (x, y) => S.blockedAt(m, x, y);
assert(!pxBlocked(S.SPAWN.x, S.SPAWN.y), 'SPAWN ชน');
assert(!pxBlocked(S.START_SPAWN.x, S.START_SPAWN.y), 'START_SPAWN ชน');
let npcHomes; try { npcHomes = require('../server/consts.js').NPC_DEFS.map(n => n.home); } catch (e) { npcHomes = [[27, 28], [41, 32], [33, 21]]; /* ตามแผน: ป้าแก้ว / ลุงสมชาย / น้องมิ้นท์ */ }
assert.strictEqual(npcHomes.length, 3);
for (const [hx, hy] of npcHomes) assert(!solidT(hx, hy), `NPC home (${hx},${hy}) ชน`);
// ช่องเดินได้ที่เดินไม่ถึงจาก SPAWN: เก็บเป็นเพดานของผังปัจจุบัน (ผังใหม่ต้องไม่เกินนี้) และ SPAWN ต้องถึงทุกช่องหน้าประตู
const seenS = bfs(Math.floor(S.SPAWN.x / TS), Math.floor(S.SPAWN.y / TS), (x, y) => !solidT(x, y));
for (const b of shops) { const [x, y] = door(b); assert(seenS.has(key(x, y)), `${b.kind}: เดินจาก SPAWN ไปหน้าประตูไม่ถึง`); }
let unreach = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!solidT(x, y) && !seenS.has(key(x, y))) unreach++;
const MAX_UNREACH = +(process.env.TOWN_RING_MAX_UNREACH || 0); // ผังปัจจุบัน = 0 ช่อง ห้ามเพิ่ม
assert(unreach <= MAX_UNREACH, `ช่องเดินไม่ถึง ${unreach} > ${MAX_UNREACH}`);

// (7) ขอบตะวันออก x>=45 ต้องไม่ถูกแตะ: hash ของ m[y][x] ทุกแถว x=45..W-1 วัดจากผัง ณ 12 พ.ย. 2026 (ก่อนทำลานต้นไม้) — ถ้าตั้งใจแก้เขตนี้ ต้องวัดใหม่และแจ้งผู้ดูแล
// 13 พ.ย. 2026 WP-21: เพิ่มเล้าไก่งวง/แพะ + ทางลง x57 → วัด hash ใหม่ (ตั้งใจ)
const EAST_HASH = '17f59b5becc750452f6a8e4aeb62ba54';
const eastHash = require('crypto').createHash('md5').update(m.map(r => r.slice(45).join(',')).join('\n')).digest('hex');
assert.strictEqual(eastHash, EAST_HASH, `ผัง x>=45 เปลี่ยนไป (hash ${eastHash})`);

// (8) ทางในโซนเมือง x10–44 y8–35 ต่อกันเป็นก้อนเดียวจากถนนสายกลาง ไม่มีหย่อมลอย
const Z = { x0: 10, y0: 8, x1: 44, y1: 35 }, inZ = (x, y) => x >= Z.x0 && x <= Z.x1 && y >= Z.y0 && y <= Z.y1;
const pathT = (x, y) => inZ(x, y) && [T.PATH, T.SAND, T.STAIR, T.BRIDGE, T.MOUTH].includes(m[y][x]);
const trunk = bfs(33, 12, pathT); // ถนนสายกลาง x33–34 y9–33
assert(pathT(33, 12), 'ถนนสายกลาง (33,12) ไม่ใช่ทาง');
const floating = []; for (let y = Z.y0; y <= Z.y1; y++) for (let x = Z.x0; x <= Z.x1; x++) if (pathT(x, y) && !trunk.has(key(x, y))) floating.push(`(${x},${y})`);
// ผังปัจจุบันมีหย่อมลอย 14 ช่อง = ทรายรอบบ่อน้ำ + ประตูสวนใต้ (10–14,21–25) ที่ไม่มีทางต่อถนน (แผนข้อ N8 road(11,26,11,29) จะแก้) → เพดาน = 14 ผังที่แก้ทางแล้วตั้ง TOWN_RING_MAX_FLOAT=0 TOWN_RING_STRICT=1
const MAX_FLOAT = +(process.env.TOWN_RING_MAX_FLOAT ?? 14);
assert(floating.length <= MAX_FLOAT, `ทางลอยแยกจากถนนสายกลาง ${floating.length} ช่อง (เพดาน ${MAX_FLOAT}): ${floating.slice(0, 12).join(' ')}`);

// (9) ไม่มีกรอบ 3x3 ที่เป็น PATH ล้วน (ไม่นับช่อง isPaved และช่องในวงลาน S.PLAZA_DISC {x,y,r} ถ้ามี) • เพดานปรับได้ TOWN_RING_MAX_BLOBS
const inDisc = (x, y) => { const d = S.PLAZA_DISC; return !!d && Math.hypot(x - d.x, y - d.y) <= d.r; };
const plain = (x, y) => inZ(x, y) && m[y][x] === T.PATH && !S.isPaved(x, y) && !inDisc(x, y);
const blobs = []; for (let y = Z.y0; y + 2 <= Z.y1; y++) for (let x = Z.x0; x + 2 <= Z.x1; x++) { let all = true; for (let j = 0; j < 3 && all; j++) for (let i = 0; i < 3; i++) if (!plain(x + i, y + j)) { all = false; break; } if (all) blobs.push(`(${x},${y})`); }
const MAX_BLOBS = +(process.env.TOWN_RING_MAX_BLOBS || 0); // เป้าผังใหม่ = 0 ถ้าผังเก่าเกินให้ตั้งตัวแปรนี้ (ดูจำนวนจริงในบรรทัดสรุป)
assert(blobs.length <= MAX_BLOBS, `กรอบ 3x3 PATH ล้วน ${blobs.length} > ${MAX_BLOBS}: ${blobs.slice(0, 8).join(' ')}...`);

// (10) จุดสำคัญต้องต่อทางถึงถนนสายกลาง: ปากถ้ำ ลิฟต์ บันได ประตูสวน 2 จุด ช่องหน้าประตูเล้า x45
const roadFrom = bfs(33, 12, (x, y) => roadT(x, y) || pathT(x, y));
const need = [];
for (const x of S.MINE.door) need.push(['ปากถ้ำ', x, S.MINE.y]);
need.push(['ลิฟต์', S.MINE.lift.x, S.MINE.lift.y + 1]); // ลิฟต์อยู่บนหน้าผา y8 ยืนใช้จากช่องใต้
for (let x = 32; x <= 35; x++) if (m[8][x] === T.STAIR) need.push(['บันได', x, 8]);
need.push(['ประตูสวนใต้', 10, S.FARM.y1 + 1], ['ประตูสวนใต้', 11, S.FARM.y1 + 1], ['ประตูสวนตะวันออก', S.FARM.x1 + 1, 19], ['ประตูสวนตะวันออก', S.FARM.x1 + 1, 20]);
for (const [n, P] of Object.entries(S.PENS)) for (const [gx, gy] of P.gate) if (gx === 46) need.push([`ประตูเล้า ${n} (x45)`, 45, gy]);
const STRICT = (process.env.TOWN_RING_STRICT ?? '0') === '1'; // ผังปัจจุบัน ประตูสวนใต้ยังไม่ต่อทาง (ดูข้อ 8) จึงตรวจเฉพาะ "เดินถึง" จนกว่าจะตั้ง STRICT=1
for (const [n, x, y] of need) assert(roadFrom.has(key(x, y)) || (!STRICT && n === 'ประตูสวนใต้' && seenS.has(key(x, y))), `${n} (${x},${y}) ต่อทางไม่ถึงถนนสายกลาง`);
const southGateConnected = roadFrom.has(key(10, S.FARM.y1 + 1));

// (11) ข้อมูลใหม่ (โคม/ลานต้นไม้) — ข้ามเมื่อผังปัจจุบันยังไม่มี
if (S.TOWN_LAMPS) {
  const c = S.PLAZA_DISC || S.FIRE;
  for (const { x: lx, y: ly } of S.TOWN_LAMPS) {
    assert.strictEqual(m[ly][lx], T.GRASS, `โคม (${lx},${ly}) ต้องอยู่บนหญ้า`);
    assert(S.DIRS.some(([dx, dy]) => roadT(lx + dx, ly + dy)), `โคม (${lx},${ly}) ต้องติดทาง`);
    assert(Math.hypot(lx - c.x, ly - c.y) >= 4, `โคม (${lx},${ly}) ใกล้ศูนย์กลางลานเกินไป (<4)`);
  }
  for (const s of S.SEATS) assert.strictEqual(m[s.y][s.x], T.PATH, `ที่นั่ง ${s.kind} (${s.x},${s.y}) ต้องอยู่บน PATH`);
}
console.log('test-town-ring OK (blobs 3x3:', blobs.length + ', ทางลอย:', floating.length + ', ประตูสวนใต้ต่อทาง:', southGateConnected + ', hash x>=45:', eastHash + ', ช่องเดินได้แต่ไปไม่ถึงจาก SPAWN:', unreach + ')');
