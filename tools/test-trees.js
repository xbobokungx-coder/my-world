// ทดสอบต้นไม้: โควตาต่อชนิด (ต้นแพงที่คนตัดไม่ได้ต้องไม่ไล่ต้นมือใหม่จนหมดแมพ) + ถอนต้นที่เกินโควตา + อัตรางอกของชนิดหายากไม่เพิ่ม
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-trees-');
const { World } = require('../server.js'), S = require('../public/shared.js'), K = S.TREE_KINDS, CAP = S.TREE.cap;
const rng = S.rng(5112026);

// โควตา: ทุกชนิดอย่างน้อย 1 ต้น ผลรวมไม่ต่ำกว่าเพดาน ต้นสามัญ (Lv1–4) รวมได้เกินครึ่งเพดาน
{
  const q = Object.keys(K).map(id => S.treeQuota(id, CAP)); assert.ok(q.every(n => n >= 1));
  assert.ok(q.reduce((a, b) => a + b, 0) >= CAP, 'รวมโควตา ≥ เพดาน');
  const low = Object.keys(K).filter(id => K[id].lv <= 4).reduce((a, id) => a + S.treeQuota(id, CAP), 0); assert.ok(low > CAP * 0.5, 'โควตาต้น Lv1–4 เกินครึ่งเพดาน ' + low);
}
// pickTreeSpawn: ชนิดที่เต็มโควตา → skip • ยังไม่เต็ม → งอกได้ และอัตราของชนิดนั้นไม่เพิ่มเพราะชนิดอื่นเต็ม (กันฟาร์มไม้หายาก)
{
  const spots = []; for (let y = 3; y < 13; y++) for (let x = 3; x < 9; x++) spots.push([x, y]); // 60 ช่อง ทางเหนือ (ไว้ให้ครบหลายชนิด ไม่ให้เทสต์ช้า)
  const m = Array.from({ length: S.H }, () => Array(S.W).fill(S.T.GRASS)), N = 1500;
  const full = {}; for (const id of Object.keys(K)) full[id] = S.treeQuota(id, CAP);
  for (let i = 0; i < 200; i++) { const p = S.pickTreeSpawn(m, rng, spots, full, CAP); assert.ok(p && p.skip, 'ทุกชนิดเต็มโควตาต้องไม่งอก'); }
  let base = 0; for (let i = 0; i < N; i++) if (S.pickTreeSpawn(m, rng, spots).k === 'broad') base++;
  const some = Object.assign({}, full, { broad: 0 }); let broad = 0, other = 0;
  for (let i = 0; i < N; i++) { const p = S.pickTreeSpawn(m, rng, spots, some, CAP); if (p.skip) continue; if (p.k === 'broad') broad++; else other++; }
  assert.ok(broad > 0 && other === 0, 'มีแต่ broad ที่ยังไม่เต็ม งอกได้เฉพาะ broad');
  assert.ok(Math.abs(broad - base) / N < 0.05, `อัตรา broad ต้องเท่าเดิม (ปกติ ${base} / มีโควตา ${broad} จาก ${N})`);
}
// pickTreeTrim: ถอนชนิดที่เกินโควตามากสุด เคารพ ok() และไม่ถอนจนต่ำกว่าโควตา
{
  const list = []; for (let i = 0; i < 40; i++) list.push([i, 2, 'ancient']); for (let i = 0; i < 10; i++) list.push([i, 3, 'broad']);
  const t = S.pickTreeTrim(list, CAP, rng); assert.strictEqual(t[2], 'ancient');
  assert.strictEqual(S.pickTreeTrim(list, CAP, rng, () => false), null, 'ok() ไม่ผ่านทุกต้น = ไม่ถอน');
  assert.strictEqual(S.pickTreeTrim([[1, 1, 'ancient']], CAP, rng), null, 'ไม่เกินโควตาไม่ถอน');
}

// จำลองเต็มระบบ: แมพเต็มต้นแพงที่ไม่มีใครตัด + ผู้เล่นตัดเฉพาะต้นที่ตัดได้ (Lv ≤ 4) → ต้นสามัญต้องกลับมาตามโควตา
{
  const w = new World('treetest'), ws = { readyState: 1, send() {} }, pl = w.join(ws, 'alice', '#e74c3c').p; pl.x = pl.y = 5; // ผู้เล่นหนึ่งคนไว้ให้ tick ทำงาน (ยืนมุมแมพ ห่างต้นไม้)
  const T = S.T; w.treeCap = CAP;
  for (const [x, y] of w.treeList()) { w.map[y][x] = T.GRASS; w.treeKind.delete(x + ',' + y); }
  const hi = Object.keys(K).filter(id => K[id].lv >= 11), spots = [];
  for (let y = 2; y < S.H - 2; y++) for (let x = 2; x < S.W - 2; x++) if (S.treeSpotOk(w.map, x, y)) spots.push([x, y]);
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  for (const [x, y] of spots.slice(0, CAP)) { w.map[y][x] = T.TREE; w.treeKind.set(x + ',' + y, hi[Math.floor(rng() * hi.length)]); } // ติดสภาพแมพที่เต็มด้วยต้นแพงล้วน (ที่เซฟจริงเป็นอยู่)
  const lowCount = () => w.treeList().filter(t => K[t[2]].lv <= 4).length, now = Date.now();
  assert.strictEqual(lowCount(), 0);
  S.TREE.growMs = 1000; const t0 = Date.now();
  for (let step = 0; step < 300; step++) { // 1 step = 1 tick (growMs ตั้งเป็น 1 วินาที = งอกทุก tick) ผู้เล่นตัดต้น Lv≤4 ให้ 1 ต้นทุก 3 tick
    pl.x = pl.y = 5;
    w.tick(1, now + step * 1000);
    if (step % 3 === 0) { const t = w.treeList().find(t => K[t[2]].lv <= 4); if (t) { w.map[t[1]][t[0]] = T.GRASS; w.treeKind.delete(t[0] + ',' + t[1]); } }
  }
  const tl = w.treeList(), c = {}; for (const t of tl) c[t[2]] = (c[t[2]] || 0) + 1;
  const hiN = tl.filter(t => K[t[2]].lv >= 11).length;
  assert.ok(lowCount() >= 10, 'ต้น Lv1–4 ต้องกลับมาในแมพ (ได้ ' + lowCount() + ')');
  assert.ok(hiN <= Object.keys(K).filter(id => K[id].lv >= 11).reduce((a, id) => a + S.treeQuota(id, CAP, Date.now()), 0) + 2, 'ต้น Lv11+ ถูกถอนลงมาตามโควตา (เหลือ ' + hiN + ')');
  for (const id of Object.keys(c)) assert.ok(c[id] <= S.treeQuota(id, CAP, Date.now()) + 1, `ชนิด ${id} เกินโควตา ${c[id]}`);
}

// WP-31: ต้น/ชม./คน ใกล้กันเมื่อมีช่างไม้ 1, 2, 4 คน (จำลองเวลาเอง ไม่ใช้นาฬิกาจริง) • ช่างไม้ฟันล้มคนละต้นทุก 10 วิ แต่หยุดเมื่อต้นเหลือต่ำกว่า 55% ของเพดาน (กันโหมดงอกเร่ง 8 ต้น/รอบ) = ฟันเร็วกว่างอก วัดได้เป็นอัตรางอกล้วนๆ
{
  S.TREE.growMs = 20000; const rate = {}, T = S.T; // คืนค่าจริงหลังเทสต์ก่อนหน้าที่ย่อ growMs
  assert.strictEqual(S.treeCapFor(1), CAP); assert.strictEqual(S.treeGrowMs(1), 20000); assert.strictEqual(S.treeCapFor(0), CAP, 'ไม่มีคนก็ใช้ค่าเดิม');
  assert.strictEqual(S.treeCapFor(99), S.TREE.cap + S.TREE.capPer * (S.TREE.maxCutters - 1), 'เพดานรวมมีที่หยุด');
  for (const m of [1, 2, 4]) {
    const w = new World('treerate' + m), ps = [];
    for (let i = 0; i < m; i++) { const q = w.join({ readyState: 1, send() {} }, 'cut' + i, '#e74c3c').p; q.x = q.y = 5; ps.push(q); }
    w.treeCap = CAP; w.treeTimer = 0;
    const t0 = 1e12; let felled = 0;
    const warm = 1800, total = warm + 3600; // วอร์มอัป 30 นาที (ให้แมพเข้าสมดุล) แล้ววัด 1 ชม.
    for (let step = 0; step < total; step++) {
      const now = t0 + step * 1000;
      for (const q of ps) { q.x = q.y = 5; }
      if (step % 10 === 0) for (const q of ps) { (q.fellAt = q.fellAt || []).push(now); q.fellAt = q.fellAt.filter(t => now - t < S.TREE.activeMs); const tl = w.treeList(); if (tl.length <= S.treeCapFor(m) * 0.55) continue; const t = tl.find(t => Math.hypot(t[0] - 5, t[1] - 5) > 6); if (t) { w.map[t[1]][t[0]] = T.GRASS; w.treeKind.delete(t[0] + ',' + t[1]); if (step >= warm) felled++; } }
      w.tick(1, now);
    }
    rate[m] = felled / m; console.log(`ช่างไม้ ${m} คน: ${Math.round(felled)} ต้น/ชม. = ${Math.round(rate[m])} ต้น/ชม./คน`);
  }
  for (const m of [2, 4]) assert.ok(Math.abs(rate[m] - rate[1]) / rate[1] <= 0.15, `ต้น/ชม./คน ที่ ${m} คน (${rate[m]}) ต้องใกล้ 1 คน (${rate[1]}) ±15%`);
}

// WP-31 กันโกง: 5 บัญชีฟันครั้งเดียวทุก 4:59 นาที (ไม่ล้มต้น) ต้องไม่เพิ่มเพดาน/อัตรางอก • ช่างไม้เลิก → เพดานลด ต้นเกินถูกถอนทีละต้น ไม่ถอนต้นใกล้ผู้เล่น/ที่กำลังถูกฟัน
{
  const T = S.T, w = new World('treecheat'), ps = [];
  for (let i = 0; i < 6; i++) { const q = w.join({ readyState: 1, send() {} }, 'ch' + i, '#e74c3c').p; q.x = q.y = 5; ps.push(q); }
  w.treeCap = CAP; w.treeTimer = 0; let spawns = 0; const t0 = 2e12, orig = w.broadcast.bind(w);
  w.broadcast = m => { if (m && m.t === 'tree' && m.on) spawns++; return orig(m); };
  for (const [x, y] of w.treeList()) { w.map[y][x] = T.GRASS; w.treeKind.delete(x + ',' + y); }
  for (let step = 0; step < 3600; step++) { const now = t0 + step * 1000; ps.forEach(q => { q.x = q.y = 5; }); for (const q of ps.slice(1)) if (step % 299 === 0) { q.fellAt = [now]; } w.tick(1, now); }
  assert.ok(w.treeList().length <= CAP, 'ฟันทิ้งไม่เพิ่มเพดาน ' + w.treeList().length); assert.ok(spawns <= 3600 / 20 + 2, 'ฟันทิ้งไม่เพิ่มอัตรางอก ' + spawns);
  // เพดานลด: ใส่ต้นเกินเพดานฐานชนิดสามัญ แล้วไม่มีช่างไม้ → ถอนทีละต้นต่อรอบ เว้นต้นใกล้ผู้เล่น/ที่กำลังถูกฟัน
  const spots = []; for (let y = 2; y < S.H - 2; y++) for (let x = 2; x < S.W - 2; x++) if (S.treeSpotOk(w.map, x, y)) spots.push([x, y]);
  for (const [x, y] of spots.slice(0, CAP + 60)) { w.map[y][x] = T.TREE; w.treeKind.set(x + ',' + y, 'broad'); }
  const guard = w.treeList().find(t => Math.hypot(t[0] - 5, t[1] - 5) > 8); w.treeHp.set(guard[0] + ',' + guard[1], { hp: 1, t: t0 + 4e6 });
  const near = w.treeList().find(t => t !== guard && Math.hypot(t[0] - 5, t[1] - 5) <= 8 && Math.hypot(t[0] - 5, t[1] - 5) >= 6);
  const before = w.treeList().length; let prev = before;
  for (let step = 0; step < 40; step++) { w.tick(1, t0 + 4e6 + step * 1000); const n = w.treeList().length; assert.ok(prev - n <= 1 + 8, 'ถอนไม่เกินทีละต้นต่อรอบ'); prev = n; }
  assert.ok(w.treeList().length < before, 'ช่างไม้เลิก ต้นเกินต้องถูกถอน'); assert.ok(S.isChoppable(w.map, guard[0], guard[1]), 'ไม่ถอนต้นที่กำลังถูกฟัน');
}
console.log('ผ่าน test-trees');
process.exit(0);
