// ทดสอบสัดส่วนชนิดแร่ตอนเกิดใหม่: แร่ที่ผู้เล่นขุดไม่ได้ (เลเวล/อีเต้อไม่ถึง) ต้องไม่สะสมจนเต็มชั้นแล้วแร่ที่ขุดได้หายหมด
// รัน: node tools/test-ore-mix.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-oremix-'));
const { World } = require('../server.js'), S = require('../public/shared.js'), T = S.T;

// rollOreQuota: ชนิดที่เต็มโควตาไม่ถูกสุ่ม • ไม่มีชนิดไหนว่างก็สุ่มตามสัดส่วนปกติ
{
  const rng = S.rng(20261105), cap = 50, full = {}; for (const [id, w] of Object.entries(S.floorMix(1))) full[id] = Math.ceil(w * cap / 100);
  const some = Object.assign({}, full, { copper: 0 });
  for (let i = 0; i < 200; i++) assert.strictEqual(S.rollOreQuota(1, rng, some, cap), 'copper', 'มีแต่ทองแดงที่ยังไม่เต็ม');
  for (let i = 0; i < 200; i++) assert.ok(S.floorMix(1)[S.rollOreQuota(1, rng, full, cap)], 'เต็มทุกชนิดก็ยังสุ่มตามสัดส่วนปกติ');
}

// จำลอง: ผู้เล่นขุดเฉพาะชนิดหลักของชั้น (เหมือนมือใหม่ที่ขุดได้แต่หิน) 300 รอบ → ชนิดที่ขุดไม่ได้ไม่ล้นโควตา ชนิดที่ขุดได้ไม่หมด
const w = Object.create(World.prototype); w.initCave(); w.sceneMates = () => []; w.sceneBroadcast = () => {};
for (const f of [1, 3, 6, 10]) {
  const F = w.floorOf(f); let now = 1e12; const first = Object.entries(S.floorMix(f)).sort((a, b) => b[1] - a[1])[0][0];
  for (let cyc = 0; cyc < 300; cyc++) {
    for (let i = 0; i < 6; i++) { const ks = [...F.ores].filter(([, o]) => o.k === first).map(([k]) => k); if (!ks.length) break; const k = ks[Math.floor(Math.random() * ks.length)], [x, y] = k.split(',').map(Number); F.ores.delete(k); F.map[y][x] = T.CAVE; F.wait.push({ x, y, at: now + S.MINE.respawnMs }); }
    for (let t = 0; t < 40; t++) { now += 5000; w.oreTick(now); }
  }
  const c = {}; for (const o of F.ores.values()) c[o.k] = (c[o.k] || 0) + 1;
  assert.ok(F.ores.size >= F.cap - 2, `ชั้น ${f}: แร่เกิดใหม่ครบ ${F.ores.size}/${F.cap}`);
  assert.ok((c[first] || 0) >= F.cap * S.floorMix(f)[first] / 100 * 0.8, `ชั้น ${f}: ${first} ต้องไม่หายจากชั้น (เหลือ ${c[first] || 0})`);
  for (const [id, n] of Object.entries(c)) assert.ok(n <= Math.max(1, Math.ceil(S.floorMix(f)[id] * F.cap / 100)) + 1, `ชั้น ${f}: ${id} ล้นโควตา ${n}`);
}
console.log('ผ่าน test-ore-mix');
process.exit(0);
