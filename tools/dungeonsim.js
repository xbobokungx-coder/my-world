'use strict';
// จำลองสมดุลดันเจี้ยน 100 ชั้น (docs/plans/DUNGEON-100.md) รอบ 1 • ไม่แตะโค้ดเกม อ่านค่าจริงจาก public/shared.js และ tools/levelsim.js
// ใช้: node tools/dungeonsim.js [death|time|income|table|all]  • รอบ 2 (ตารางผนึกรายชั้น): node tools/dungeonsim.js floors [--json]  (ไม่รวมใน all)
//   death  = ค่าซ่อมหลังตายหนึ่งครั้ง เทียบรายได้/ชม. (ข้อ 1)
//   time   = เวลาต่อชั้น/อาณาจักร จำนวนครั้งฟาด ถึงชั้น 100 เดี่ยว/2/4 คน เวลาบอส (ข้อ 2)
//   income = รายได้ นักสู้เทียบชาวนา ตารางราคาชิ้นส่วน XP นักสู้ (ข้อ 3)
//   table  = ตารางร่างสถิติ 10 อาณาจักร (ข้อ 4)
// ทุกค่าใน D ด้านล่างที่เป็น "สมมติฐาน" ไม่ได้วัดจากเกมจริง (ยังไม่มีระบบต่อสู้) — ปรับตรงนี้แล้วรันซ้ำ
const S = require('../public/shared.js');
const L = require('./levelsim.js');
const R = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const f0 = n => Math.round(n).toLocaleString('en-US');
const pct = n => (n * 100).toFixed(0) + '%';
const pad = (s, w) => String(s).padStart(w);

const D = {
  // ---- ค่าจริงจากเกม ----
  swing: S.SWING_MS / 1000,           // 0.57 วิ/ครั้ง (ขั้นต่ำระหว่างฟาด)
  repair: S.REPAIR,                   // {decay .15, maxFixes 3, growth .5, pct .25}
  eff: L.M.EFF,                       // 0.5 ผู้เล่นจริง = เพดาน levelsim × 0.5
  // ---- ค่าจากแผน (DUNGEON-100.md) ----
  gearMul: 1.5,                       // ราคาอาวุธ/เกราะ = ราคาอีเต้อระดับ r × 1.5
  hits0: 4, hitsK: 0.3,               // ตีธรรมดา 4 + 0.3(k-1) ครั้ง
  mult: { elite: 3, mini: 8, boss: 20, final: 60 }, // ตัวคูณ HP เทียบมอนสเตอร์ธรรมดา (ตีความ: คูณจำนวนครั้งตีของธรรมดาชั้น k=10)
  hpParty: 0.6, bonusParty: 0.10,     // HP ×(1+0.6 ต่อคนเพิ่ม) • XP/ของ +10% ต่อคน
  // ---- สมมติฐาน (ไม่ได้วัด) ----
  charmPrice: 0.5,                    // ราคาเครื่องราง = 0.5 × ราคาอีเต้อระดับ r
  u: { norm: 0.60, elite: 0.50, mini: 0.45, boss: 0.40, final: 0.38 }, // สัดส่วนเวลาที่ได้ฟาดจริงขณะสู้ (ที่เหลือคือหลบ/เดินเข้า/รอท่า)
  walk0: 6, walkR: 0.4,               // วินาทีเดิน+ล่อมอนสเตอร์ต่อตัว = walk0 + walkR×(r-1)
  fixed: { rest: 90, normObj: 75, miniObj: 45, puzzle: 210, shrine: 100, elite: 60, treasure: 150, bossWalk: 30 }, // วินาทีของชั้นแต่ละแบบที่ไม่ใช่การตี
  bossFixed: 20, finalFixed: 60,      // ช่วงบอสอยู่ในเฟส/อมตะ/ท่าร่วมมือ ที่ไม่ขึ้นกับดาเมจ (วินาที) บอสสุดท้าย 3 เฟส
  waste: 0.05,                        // ปาร์ตี้: ฟาดทับ/เกินเลือด เสียต่อคนที่เพิ่ม
  friction: 1.0,                      // ปาร์ตี้: เวลาไม่ใช่การตี ×friction ต่อคนที่เพิ่ม (1.0 = กลางๆ: รอเพื่อนกับสำรวจคู่ขนานหักล้างกัน ไม่มีข้อมูลจริง)
  planKingdomHours: [1.5, 2, 2, 2.5, 3, 3, 3.5, 4, 4.5, 5], // เวลา "รวมเตรียมของ" ต่ออาณาจักรในแผน (รวม 31 ชม.)
  targetPure: 14,                     // เป้าตีล้วนๆ ที่เลือก (กลางของ 12–16)
  critMean: 1 + S.MINE.crit.p * (S.MINE.crit.mul - 1), // สมมติคริเหมือนขุดแร่ (10% ×3 = ×1.2)
  powerLv: 0.015,                     // ดาเมจ +1.5%/เลเวลนักสู้
  powerColl: 0.01,                    // สมุดสะสม +1%/อาณาจักรที่ครบ (สูงสุด +10%)
  food: 1.05, foodMax: 1.10,          // อาหารบัฟทั่วไป / เต็มที่
  starMax: 1.10,                      // 5 ดาว ≈ +10%
  wearShare: { weapon: 0.07, armor: 0.05 }, consShare: 0.08, // ค่าสึกอาวุธ/เกราะ และยา-อาหาร เป็น % ของรายได้รวม
  split: { drops: 0.55, chests: 0.25, quests: 0.20 }, // ที่มาของรายได้รวม
  sessionH: 1.5,                      // เซสชันปกติ/วัน (ชม.) ใช้กระจายเควสประจำวัน
  piece: { norm: 1, elite: 3, mini: 8, boss: 25 }, // ชิ้นส่วนเฉลี่ยต่อตัว
  income: 1.05,                       // เป้าสุทธิหลังค่าสึก = 105% ของชาวนา
};

// ---------- ฐาน: รายได้อ้างอิง ----------
const farmerReal = r => { const lv = 2 * r; return (L.farm(Math.min(20, lv - 1)).coin + L.farm(Math.min(20, lv)).coin) / 2 * D.eff; }; // ชาวนาเลเวลเดียวกับนักสู้ในอาณาจักร r (กลาง Lv 2r-1..2r) เหรียญ/ชม.จริง
const feeBase = r => S.MINE.fee[r] * 10;     // ฐานที่แผนใช้ (ตั๋วเหมือง ≈ 10% ของรายได้/ชม.)
const gearPrice = r => D.gearMul * S.toolPrice('pick', r);
const charmPrice = r => D.charmPrice * S.toolPrice('pick', r);
const hitsOf = k => D.hits0 + D.hitsK * (k - 1);
const pTyp = r => (1 + D.powerLv * (2 * r - 2)) * (1 + D.powerColl * (r - 1)) * D.food; // กำลังโจมตีผู้เล่นปกติเทียบดาเมจอาวุธล้วน (เลเวลตามที่แนะนำ 2r-1)
const PMAX = (1 + D.powerLv * 19) * D.starMax * (1 + D.powerColl * 10) * D.foodMax;     // Lv20 5 ดาว สมุดเต็ม อาหารเต็ม

// ========== 1) ค่าซ่อมหลังตาย ==========
// ซ่อมต่อชิ้น = ceil(ราคา × pct × (1+growth×n) × สัดส่วนที่เสียหาย) (สูตร S.repairCost) n = จำนวนครั้งซ่อมที่นับแล้วของชิ้นนั้น
const repOne = (price, n, d) => Math.ceil(price * D.repair.pct * (1 + D.repair.growth * n) * d);
const deathCost = (r, d, n = 0, f = 1) => f * (repOne(gearPrice(r), n, d) * 2 + repOne(charmPrice(r), n, d)); // อาวุธ+เกราะ+เครื่องราง
function death() {
  console.log('=== 1) ค่าซ่อมหลังตายหนึ่งครั้ง (อาวุธ+เกราะ ราคา = อีเต้อ r ×1.5, เครื่องราง = 0.5 × อีเต้อ r [สมมติ]) ===');
  console.log('รายได้/ชม. สองฐาน: A = ฐานที่แผนใช้ (MINE.fee ×10)  B = เป้ารายได้นักสู้จริง = 105% ของชาวนาเลเวลเดียวกัน (levelsim เพดาน × EFF 0.5)');
  console.log('อ.  อาวุธ=เกราะ  เครื่องราง | รายได้ A   B  | ตายซ่อมเต็ม(durLoss100%,ไม่นับครั้ง n=0) | %ของ B ที่ durLoss 100/75/50/25 | %ของ A ที่ 100/50/25 | n=1,2 @100% (%B)');
  const rows = [];
  for (const r of R) {
    const A = feeBase(r) || NaN, B = D.income * farmerReal(r), c = d => deathCost(r, d);
    rows.push({ r, A, B });
    console.log(`${pad(r, 2)} ${pad(f0(gearPrice(r)), 9)} ${pad(f0(charmPrice(r)), 9)} | ${pad(f0(A), 7)} ${pad(f0(B), 7)} | ${pad(f0(c(1)), 9)}  | ${[1, .75, .5, .25].map(d => pad(pct(c(d) / B), 5)).join(' ')} | ${[1, .5, .25].map(d => pad(isNaN(A) ? '-' : pct(c(d) / A), 4)).join(' ')} | ${[1, 2].map(n => pad(pct(deathCost(r, 1, n) / B), 5)).join(' ')}`);
  }
  console.log('\nถ้าซ่อมจากตาย "นับเป็นครั้งซ่อม": ซ่อมได้ maxFixes=' + D.repair.maxFixes + ' ครั้ง → ตายครั้งที่ ' + (D.repair.maxFixes + 1) + ' (ถ้าไม่เคยซ่อมปกติ) อุปกรณ์ซ่อมไม่ได้ต้องซื้อใหม่ • ความทนสูงสุดตกครั้งละ ' + pct(D.repair.decay) + ' • ที่ r=10 ซื้อใหม่ทั้งชุด = ' + f0(2 * gearPrice(10) + charmPrice(10)) + ' (= ' + (((2 * gearPrice(10) + charmPrice(10)) / (D.income * farmerReal(10))).toFixed(1)) + ' ชม.ของรายได้)');
  console.log('\nค่า durLoss สูงสุดที่ค่าซ่อม ≤ 10% / 12% ของรายได้ B ต่อการตาย (n=0, f=1) และตัวคูณค่าซ่อม f ที่ต้องใช้ถ้า durLoss=100%');
  let minD10 = 1, minD12 = 1, minF10 = 9, minF12 = 9;
  for (const x of rows) {
    const r = x.r, full = deathCost(r, 1), dd = t => Math.min(1, t * x.B / full), ff = t => t * x.B / full;
    minD10 = Math.min(minD10, dd(.10)); minD12 = Math.min(minD12, dd(.12)); minF10 = Math.min(minF10, ff(.10)); minF12 = Math.min(minF12, ff(.12));
    console.log(`  อ.${pad(r, 2)}  durLoss ≤ ${pad(pct(dd(.10)), 4)} / ${pad(pct(dd(.12)), 4)}   หรือ ตัวคูณซ่อม ≤ ${ff(.10).toFixed(2)} / ${ff(.12).toFixed(2)}   ฝาครอบเหรียญ 10% = ${f0(Math.floor(.10 * x.B / 10) * 10)}`);
  }
  console.log(`  ค่าเดียวใช้ได้ทุกอาณาจักร: durLoss ≤ ${pct(minD10)} (10%) / ${pct(minD12)} (12%) • ตัวคูณซ่อมจากตาย ≤ ${minF10.toFixed(2)} / ${minF12.toFixed(2)}`);
  console.log('\nตัวเลือกให้เจ้าของเลือก (ผลที่ n=0 เป็น % ของรายได้ B ที่ อ.1 / 3 / 5 / 7 / 10)');
  const opts = [
    ['0 ตามสั่ง: durLoss 100% ซ่อมราคาเต็ม', 1, 1], ['ก durLoss 50%', .5, 1], ['ก2 durLoss 25%', .25, 1], ['ก3 durLoss 12%', .12, 1],
    ['ข durLoss 100% ซ่อมจากตาย ×0.12', 1, .12], ['ข2 durLoss 100% ×0.20', 1, .20], ['ค durLoss 50% ×0.25', .5, .25],
  ];
  for (const [nm, d, f] of opts) console.log(`  ${nm.padEnd(40)} ${[1, 3, 5, 7, 10].map(r => pad(pct(deathCost(r, d, 0, f) / (D.income * farmerReal(r))), 5)).join(' ')}   สูงสุด ${pct(Math.max(...R.map(r => deathCost(r, d, 0, f) / (D.income * farmerReal(r)))))}`);
  console.log('  ง ฝาครอบเหรียญ (durLoss 100% แต่ค่าซ่อมจากตาย = min(ค่าเต็ม, 10% ของรายได้ B ปัดสิบ)) → สูงสุด 10% ทุกอาณาจักร (ต้องมีโค้ดใหม่: ตารางฝา DG.death.repairCap[อ.])');
  console.log('  ตายเพิ่มจนความทนเต็มสูงสุดลด: ถ้าซ่อมจากตายไม่นับครั้ง ซ่อมปกติ (จากการสึก) ยังนับตามเดิมที่ n=0..3 ค่าซ่อมตอนตายแพงขึ้น ×(1+0.5n): n=3 → ×2.5 (ฝา/ตัวคูณ f ช่วยให้อยู่ในเกณฑ์ได้ด้วย)');
  return { minD10, minD12, minF10, minF12 };
}

// ========== 2) เวลา ==========
// n = จำนวนคนในปาร์ตี้ • opt.mul = ตัวคูณ HP บอส {boss, final} • opt.N = ตัวนับมอนสเตอร์ธรรมดาต่อชั้นปกติ (สำหรับ r) • opt.x = ตัวคูณ HP ต่อคนเพิ่ม (ค่าเริ่ม 0.6) • opt.ux = ตัวคูณสัดส่วนฟาด (ผู้เล่นเก่ง) • opt.state = 'typ'|'max'
const hpMulN = (n, x) => 1 + (x === undefined ? D.hpParty : x) * (n - 1);
function fightSec(swings, uu, n, o = {}) { // เวลาตีจริง (วินาที) ของเป้าที่ต้องฟาดรวม swings ครั้ง
  const waste = 1 + D.waste * (n - 1);
  return swings * hpMulN(n, o.x) * waste * D.swing / (uu * (o.ux || 1)) / (o.sq || n); // o.sq = จำนวนคนในทีมย่อยที่ตีจริง (HP ยังสเกลตามปาร์ตี้ทั้งหมด n) // HP ปาร์ตี้ ×(1+x(n-1)) แล้วหารแรงตี n คน
}
function bossSec(kind, r, n, o = {}) {
  const hits = hitsOf(10), m = (o.mul && o.mul[kind]) || D.mult[kind];
  const power = o.state === 'max' ? PMAX / pTyp(r) : 1; // HP ผูกกับผู้เล่นปกติ ผู้เล่นเต็มสเต็ปตีเร็วขึ้นตามส่วนต่าง
  const fx = (kind === 'final' ? D.finalFixed : D.bossFixed) * Math.pow(D.friction, n - 1);
  return fx + fightSec(m * hits / power, D.u[kind], n, o) * 1;
}
function floorSet(r, n, o = {}) { // คืน [{k, type, sec, kills:{norm,elite,mini,boss}, swings}] 10 ชั้น
  const N = o.N || 14, out = [], walk = (D.walk0 + D.walkR * (r - 1)) , F = D.fixed, fr = Math.pow(D.friction, n - 1), ux = o.ux || 1;
  const mon = (k, cnt, kind, extraMult) => { // ตัวละ ครั้งฟาด = hits(k) × ตัวคูณ
    const sw = hitsOf(k) * (kind === 'norm' ? 1 : D.mult[kind] / (kind === 'elite' ? 1 : 1)) * hpMulN(n, o.x);
    const sec = fightSec(hitsOf(k) * (kind === 'norm' ? 1 : D.mult[kind]) , D.u[kind], n, o) + walk * fr / (kind === 'norm' ? 1 : 1) / ux;
    return { sec: cnt * sec, swings: cnt * sw / n, cnt, kind };
  };
  for (let k = 1; k <= 10; k++) {
    let t = 0, sw = 0, kills = { norm: 0, elite: 0, mini: 0, boss: 0 };
    const add = (cnt, kind) => { if (!cnt) return; const m = mon(k, cnt, kind); t += m.sec; sw += m.swings; kills[kind] += cnt; };
    if (k === 1) t = F.rest * fr;
    else if (k <= 4) { add(N, 'norm'); t += F.normObj * fr; }
    else if (k === 5) { add(1, 'mini'); add(Math.round(N / 2), 'norm'); t += F.miniObj * fr; }
    else if (k === 6) { add(Math.round(N / 3), 'norm'); t += F.puzzle * fr; }
    else if (k === 7) { add(Math.round(N / 2), 'norm'); t += F.shrine * fr; }
    else if (k === 8) { add(Math.round(N / 3), 'elite'); add(Math.round(N / 3), 'norm'); t += F.elite * fr; }
    else if (k === 9) { add(Math.round(N / 4), 'norm'); t += F.treasure * fr; }
    else { t += F.bossWalk * fr + bossSec(r === 10 ? 'final' : 'boss', r, n, o); kills.boss = 1; sw += (r === 10 ? D.mult.final : D.mult.boss) * hitsOf(10) * hpMulN(n, o.x) / n; }
    t += (o.extra || 0) * fr * (k >= 2 && k <= 9 ? 1 : 0); // วินาทีพิเศษต่อชั้น (ผัง/ทางเดินใหญ่ขึ้น) ที่ใช้ปิดช่องว่างเวลา
    out.push({ k, sec: t, swings: sw, kills });
  }
  return out;
}
const kingdomSec = (r, n, o) => floorSet(r, n, o).reduce((a, x) => a + x.sec, 0);
const nSched = r => 12 + Math.round(6 * (r - 1) / 9); // จำนวนมอนสเตอร์ธรรมดาต่อชั้นปกติ 12→18 (แผน: 12–18 ตัว/ห้อง ฝา RAM 18)
function solveN(r, targetSec, o = {}) { // N ตามตาราง nSched แล้วหา extra = วินาทีที่ไม่ใช่การตี/ชั้นปกติ-เทียบเท่า (8 ชั้น) ที่ต้องเติมให้ครบเวลาเป้า (ผังใหญ่ ทางอ้อม ปริศนา เป้าหมายชั้น)
  const N = nSched(r), base = kingdomSec(r, 1, Object.assign({}, o, { N }));
  return { N, extra: Math.max(0, (targetSec - base) / 8) };
}
const shape = D.planKingdomHours.map(h => h / D.planKingdomHours.reduce((a, b) => a + b, 0));
function plan(targetH = D.targetPure) { // คืน {N:[..], extra:[..], opt:[..]} ต่ออาณาจักร
  const o = { N: [], extra: [], mulBoss: null };
  for (const r of R) { const s = solveN(r, targetH * 3600 * shape[r - 1]); o.N[r - 1] = s.N; o.extra[r - 1] = Math.round(s.extra); }
  return o;
}
function time() {
  console.log('=== 2) เวลา (สมมติฐานที่ไม่ได้วัด: สัดส่วนเวลาฟาดจริง u, เดิน, เวลาปริศนา — ดูตัวแปร D ในสคริปต์) ===');
  console.log(`ครั้งฟาดต่อมอนสเตอร์ธรรมดา ชั้น k=1..10 = ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(k => hitsOf(k).toFixed(1)).join(' ')} (ตามแผน 4–6.7 ที่กำลังผู้เล่นปกติ) → ${(hitsOf(1) * D.swing).toFixed(1)}–${(hitsOf(10) * D.swing).toFixed(1)} วิถ้าฟาดต่อเนื่อง ${(hitsOf(1) * D.swing / D.u.norm).toFixed(1)}–${(hitsOf(10) * D.swing / D.u.norm).toFixed(1)} วิที่ u=${D.u.norm}`);
  // 2.1 บอส
  console.log('\n--- บอส (เดี่ยว) เวลา = ช่วงอมตะ/เฟส + HP÷ดาเมจ • HP บอส = ตัวคูณ × ครั้งตีของธรรมดา k=10 (6.7 ครั้ง) ---');
  const bs = (kind, r, n, o) => bossSec(kind, r, n, o) / 60;
  console.log(`ตามแผน ×${D.mult.boss}: บอสอาณาจักร 1–9 เดี่ยว ${bs('boss', 1, 1).toFixed(1)} นาที (เป้า 2–3) • ปาร์ตี้ 2/4 คน ${bs('boss', 1, 2).toFixed(1)} / ${bs('boss', 1, 4).toFixed(1)} นาที`);
  console.log(`ตามแผน ×${D.mult.final}: บอสสุดท้ายเดี่ยว ผู้เล่นปกติ ${bs('final', 10, 1).toFixed(1)} นาที • เต็มสเต็ป(Lv20 5ดาว สมุดเต็ม อาหารเต็ม) ${bs('final', 10, 1, { state: 'max' }).toFixed(1)} นาที (เป้า 6–8)`);
  // ตัวคูณที่ต้องใช้
  const hm = n => hpMulN(n);
  const solveM = (kind, tgt, state) => { let m = 1; while (m < 400 && bossSec(kind, 10, 1, { mul: { [kind]: m }, state }) < tgt) m++; return m; };
  const mb = solveM('boss', 150), mf = solveM('final', 7 * 60, 'typ'), mfMax = solveM('final', 6.2 * 60, 'max');
  console.log(`ตัวคูณที่ได้เวลาเป้า (เดี่ยว): บอสทั่วไป 2.5 นาที → ×${mb} • บอสสุดท้าย 7 นาที ผู้เล่นปกติ → ×${mf} / เต็มสเต็ป 6.2 นาที → ×${mfMax} (เลือก ≈ ×${Math.round((mf + mfMax) / 2)})`);
  const MB = mb, MF = Math.round((mf + mfMax) / 2), O = { mul: { boss: MB, final: MF } };
  console.log(`ด้วย ×${MB}/×${MF}: บอสเดี่ยว ${bs('boss', 5, 1, O).toFixed(1)} นาที (2/4 คน ${bs('boss', 5, 2, O).toFixed(1)}/${bs('boss', 5, 4, O).toFixed(1)}) • สุดท้าย ปกติ ${bs('final', 10, 1, O).toFixed(1)} เต็ม ${bs('final', 10, 1, Object.assign({ state: 'max' }, O)).toFixed(1)} (2/4 คน ${bs('final', 10, 2, O).toFixed(1)}/${bs('final', 10, 4, O).toFixed(1)})`);
  console.log('\n--- ส่วนต่างปาร์ตี้ vs เดี่ยว (เวลาบอส เป้า ±25% = 0.75–1.25) ตามตัวคูณ HP ต่อคนที่เพิ่ม x ---');
  for (const x of [0.6, 0.7, 0.8, 0.9]) {
    const g = (kind, n) => bossSec(kind, 5, n, Object.assign({ x }, O)) / bossSec(kind, 5, 1, Object.assign({ x }, O));
    const gf = n => bossSec('final', 10, n, Object.assign({ x }, O)) / bossSec('final', 10, 1, Object.assign({ x }, O));
    console.log(`  x=${x}: บอสทั่วไป 2 คน ${g('boss', 2).toFixed(2)} 4 คน ${g('boss', 4).toFixed(2)} • บอสสุดท้าย 2 คน ${gf(2).toFixed(2)} 4 คน ${gf(4).toFixed(2)}  ${[g('boss', 4), gf(4)].every(v => v >= 0.75 && v <= 1.25) ? 'ผ่าน' : 'ตก'}`);
  }
  { const fx = D.bossFixed; D.bossFixed = 0; const g = (x, n) => bossSec('boss', 5, n, Object.assign({ x }, O)) / bossSec('boss', 5, 1, Object.assign({ x }, O)); const r = [0.6, 0.7, 0.75, 0.8, 0.9].map(x => `x=${x}: 4 คน ${g(x, 4).toFixed(2)}`).join(' • '); D.bossFixed = fx; console.log(`  ถ้าบอสไม่มีช่วงอมตะ/ท่าร่วมมือเลย (bossFixed=0, กรณีแย่สุด): ${r} → x ต่ำกว่า 0.67 ตก ±25% • ค่าแนะนำ x=0.75 ผ่านทั้งสองกรณี`); }
  // 2.2 ตารางเวลา
  console.log('\n--- เวลาต่ออาณาจักร (ชม.) ตัวเลขใช้ ตัวคูณบอส ×' + MB + '/×' + MF + ' • เป้าตีล้วนๆ รวม ' + D.targetPure + ' ชม. สัดส่วนตามแผน 1.5/2/2/2.5/3/3/3.5/4/4.5/5 ---');
  const pl = plan(); pl.mul = O.mul;
  console.log('อ.  เป้า(ชม.)  N/ชั้น  +วิ/ชั้น  เดี่ยว  2 คน  4 คน  นาที/ชั้นปกติ(เดี่ยว)  ฟาดรวมเดี่ยว  ตีสุทธิ(ชม.)');
  let tot = [0, 0, 0], swAll = 0;
  for (const r of R) {
    const o = { N: pl.N[r - 1], extra: pl.extra[r - 1], mul: O.mul }, s1 = floorSet(r, 1, o), s2 = floorSet(r, 2, o), s4 = floorSet(r, 4, o);
    const t1 = s1.reduce((a, x) => a + x.sec, 0), t2 = s2.reduce((a, x) => a + x.sec, 0), t4 = s4.reduce((a, x) => a + x.sec, 0), sw = s1.reduce((a, x) => a + x.swings, 0);
    tot[0] += t1; tot[1] += t2; tot[2] += t4; swAll += sw;
    const normF = s1.filter(x => x.k >= 2 && x.k <= 4).reduce((a, x) => a + x.sec, 0) / 3;
    console.log(`${pad(r, 2)} ${pad((D.targetPure * shape[r - 1]).toFixed(2), 8)} ${pad(pl.N[r - 1], 6)} ${pad(pl.extra[r - 1], 8)} ${pad((t1 / 3600).toFixed(2), 6)} ${pad((t2 / 3600).toFixed(2), 5)} ${pad((t4 / 3600).toFixed(2), 5)} ${pad((normF / 60).toFixed(1), 12)} ${pad(f0(sw), 14)} ${pad((sw * D.swing / 3600).toFixed(2), 10)}`);
  }
  console.log(`รวมถึงชั้น 100: เดี่ยว ${(tot[0] / 3600).toFixed(1)} ชม. • 2 คน ${(tot[1] / 3600).toFixed(1)} ชม. (${pct(tot[1] / tot[0])}) • 4 คน ${(tot[2] / 3600).toFixed(1)} ชม. (${pct(tot[2] / tot[0])}) • ฟาดรวมเดี่ยว ${f0(swAll)} ครั้ง = ${(swAll * D.swing / 3600).toFixed(1)} ชม.ของการเหวี่ยงล้วน (ที่เหลือคือเดิน หลบ ปริศนา)`);
  console.log('ผลตรวจเป้า: 12–16 ชม. เดี่ยว ' + (tot[0] / 3600 >= 12 && tot[0] / 3600 <= 16 ? 'ผ่าน' : 'ตก') + ' • ปาร์ตี้ 4 คนเทียบเดี่ยว ' + pct(tot[2] / tot[0]) + ' (ต้อง ≥ 75%) ' + (tot[2] / tot[0] >= 0.75 ? 'ผ่าน' : 'ตก — ต้องเพิ่มส่วนที่ไม่ใช่การตี หรือเพิ่ม x'));
  for (const NN of [18, 36]) { let t = 0; for (const r of R) t += kingdomSec(r, 1, { N: NN, mul: O.mul }); console.log(`ไม่เติมเวลานอกการตี และใช้ N=${NN} ตัวทุกชั้นปกติ: เดี่ยว ${(t / 3600).toFixed(1)} ชม.${NN === 18 ? ' (ฝา RAM 18 ตัว/ห้อง → เหลือแค่ ~7 ชม. ต้องเติมเวลานอกการตีหรือคลื่นเพิ่ม)' : ' (สองคลื่นต่อชั้น)'}`); }
  console.log('\n--- ความไว: ชั่วโมงถึงชั้น 100 เดี่ยว เมื่อสมมติฐานเปลี่ยน (ใช้ N/extra ชุดเดิม) ---');
  for (const [nm, ux] of [['ผู้เล่นเก่ง ฟาดมากขึ้น 25%', 1.25], ['ผู้เล่นปกติ', 1], ['มือใหม่ ฟาดน้อยลง 25%', 0.75]]) {
    let t = 0; for (const r of R) t += kingdomSec(r, 1, { N: pl.N[r - 1], extra: pl.extra[r - 1], mul: O.mul, ux }); console.log(`  ${nm.padEnd(30)} ${(t / 3600).toFixed(1)} ชม.`);
  }
  console.log(`\nหมายเหตุ ตัวเลขแผนที่ขัดกันเอง: (ก) 90×5 นาที + 10×3 นาที = 8 ชม. ไม่ใช่ 12–16 ชม. (ข) เวลาต่ออาณาจักรรวม 31 ชม. = ชุด "รวมเตรียมของ" ไม่ใช่ตีล้วนๆ (ค) ตัวคูณบอส ×20/×60 ของแผน (เทียบมอนธรรมดา k=10) ได้ ${bs('boss', 1, 1).toFixed(1)} / ${bs('final', 10, 1).toFixed(1)} นาทีที่ u เท่านี้ ถ้าตีความเทียบ W ตรงๆ (ไม่คูณครั้งตี 6.7) บอสจะตายใน ~11 วิ ไม่ตรงเป้าเลย`);
  return { pl, MB, MF, tot };
}

// ========== 3) รายได้และ XP ==========
function income() {
  console.log('=== 3) รายได้/ชม. นักสู้ เทียบชาวนา และตารางราคาชิ้นส่วน ===');
  const { pl, MB, MF } = time_quiet();
  const tgtG = r => D.income * farmerReal(r) / (1 - D.wearShare.weapon - D.wearShare.armor); // รายได้รวมที่ต้องการต่อชม. (ก่อนหักค่าสึก)
  const O = r => ({ N: pl.N[r - 1], extra: pl.extra[r - 1], mul: { boss: MB, final: MF } });
  const k = {}; // นับตัวที่ฆ่าและเวลาต่ออาณาจักร (เดี่ยว)
  for (const r of R) { const fs = floorSet(r, 1, O(r)), c = { norm: 0, elite: 0, mini: 0, boss: 0 }; fs.forEach(x => { for (const t in c) c[t] += x.kills[t]; }); k[r] = { c, T: fs.reduce((a, x) => a + x.sec, 0) }; }
  const pcs = r => k[r].c.norm * D.piece.norm + k[r].c.elite * D.piece.elite + k[r].c.mini * D.piece.mini + k[r].c.boss * D.piece.boss;
  console.log('อ. | ชาวนา B/ชม. | รวมเป้า G/ชม. | ชิ้นส่วน/ชม. | ราคา/ชิ้น (ปัดจำนวนเต็ม) | ÷ราคาแร่ r | หีบ/ชั้น | เควสประจำวัน/ชุด | ตีสุทธิ(หลังสึก) %ชาวนา | หลังยา-อาหาร | ปาร์ตี้ 2 / 4 คน (ไม่มีโบนัสของตก) | ปาร์ตี้ +10%/คน | เก่ง ×1.25');
  const price = {}, chest = {}, quest = {};
  const res = [];
  for (const r of R) {
    const T = k[r].T / 3600, G = tgtG(r), ph = pcs(r) / T;
    price[r] = Math.max(1, Math.round(D.split.drops * G * T / pcs(r))); chest[r] = Math.round(D.split.chests * G * T / 10 / 5) * 5; quest[r] = Math.round(D.split.quests * G * D.sessionH / 10) * 10;
    // ประเมินรายได้ใหม่จากตัวเลขปัดเศษ: ต่อชม. = (ชิ้น×ราคา + หีบ10ชั้น) ÷ T + เควสต่อวัน ÷ เซสชัน
    const base = (n, bonus, uxm = 1) => { // รายได้รวมต่อคนต่อชม. ที่ปาร์ตี้ n คน (เวลาจากโมเดล) bonus = โบนัสของตก/คน • uxm = ผู้เล่นเก่ง
      const Tn = kingdomSec(r, n, Object.assign({ ux: uxm }, O(r))) / 3600, drops = pcs(r) * price[r] * (1 + bonus * (n - 1)), ch = chest[r] * 10 * (1 + 0 * bonus), qq = quest[r];
      return (drops + ch) / Tn + qq / D.sessionH; };
    const g1 = base(1, 0), wear = (D.wearShare.weapon + D.wearShare.armor) * g1, cons = D.consShare * g1, fm = farmerReal(r);
    res.push({ r, g1, net: g1 - wear, fm });
    console.log(`${pad(r, 2)} | ${pad(f0(fm), 6)} | ${pad(f0(G), 6)} | ${pad(f0(ph), 6)} | ${pad(price[r], 5)} | ${pad((price[r] / S.ORES[S.ORE_ORDER[r - 1]].sell).toFixed(1) + '×', 6)} | ${pad(chest[r], 5)} | ${pad(quest[r], 6)} | ${pad(pct((g1 - wear) / fm), 5)} | ${pad(pct((g1 - wear - cons) / fm), 5)} | ${pad(pct((base(2, 0) * 0.88) / fm), 5)} / ${pad(pct((base(4, 0) * 0.88) / fm), 5)} | ${pad(pct((base(2, D.bonusParty) * 0.88) / fm), 5)} / ${pad(pct((base(4, D.bonusParty) * 0.88) / fm), 5)} | ${pad(pct((base(1, 0, 1.25) * 0.88) / fm), 5)}`);
  }
  console.log(`เกณฑ์: ตีสุทธิหลังสึก ≤110% (เพดาน 125%) • "ปาร์ตี้" = รายได้ต่อคนต่อชม. หลังหักค่าสึก (เทียบชาวนา) ที่ของตกต่อคน • สมมติแหล่งรายได้: ชิ้นส่วน ${pct(D.split.drops)} หีบ ${pct(D.split.chests)} เควส ${pct(D.split.quests)} ของรายได้รวม`);
  console.log('ตารางที่เสนอ (ชิ้นส่วนธรรมดาต่ออาณาจักร r, ราคาขาย) = ' + R.map(r => price[r]).join(', '));
  console.log('  ราคาตามชนิด = ธรรมดา ×1 / อีลีท ×3 / มินิบอส ×8 / บอส ×25 ต่อตัวที่ตก (ชิ้นเฉลี่ย) • หีบต่อชั้น (เฉลี่ยรวม 10 ชั้น) = ' + R.map(r => chest[r]).join(', ') + ' • เควสประจำวันชุดละ 3 ใบ = ' + R.map(r => quest[r]).join(', '));
  // ปาร์ตี้ โบนัส
  console.log('\n--- ปาร์ตี้: ตัวคูณของตก/คนที่ทำให้รายได้ต่อคนไม่เกิน 115% ของเดี่ยวที่ อ.5 (ชิ้นส่วนและหีบ) ---');
  const r5 = 5;
  const solveBonus = n => { let b = -1; for (let t = 1; t >= -1; t -= 0.01) { const Tn = kingdomSec(r5, n, O(r5)) / 3600; const Tn1 = kingdomSec(r5, 1, O(r5)) / 3600; const dr = pcs(r5) * price[r5], ch = chest[r5] * 10; const cur = ((dr * (1 + t) + ch) / Tn) , solo = (dr + ch) / Tn1; if (cur <= 1.15 * solo) { b = t; break; } } return b; };
  console.log(`  เวลาเคลียร์ อ.5: 2 คน ${pct(kingdomSec(5, 2, O(5)) / kingdomSec(5, 1, O(5)))} • 4 คน ${pct(kingdomSec(5, 4, O(5)) / kingdomSec(5, 1, O(5)))} ของเดี่ยว • ถ้าของตกต่อคน = เท่าเดี่ยว รายได้ต่อคน/ชม. ×${(kingdomSec(5, 1, O(5)) / kingdomSec(5, 2, O(5))).toFixed(2)} (2 คน) ×${(kingdomSec(5, 1, O(5)) / kingdomSec(5, 4, O(5))).toFixed(2)} (4 คน)`);
  console.log(`  ตัวคูณของตก/คนที่ให้ ≤115% ของเดี่ยว: 2 คน ${(1 + solveBonus(2)).toFixed(2)}× • 4 คน ${(1 + solveBonus(4)).toFixed(2)}× (ส่วนหีบไม่ปรับ) — แผน +10%/คนให้ ×1.10/×1.30 ซึ่งเกินเมื่อเทียบกับเวลาที่ลดลง`);
  // XP
  console.log('\n--- XP นักสู้: เป้า Lv20 ≈ 20 ชม. (หลอด STD) ---');
  const gh = lv => L.goalHours('fish', lv); // ชม.จริงถึงเลเวล lv ตามเป้า
  const xpAt = h => { let lv = 1; while (lv < 20 && gh(lv + 1) <= h) lv++; if (lv >= 20) return S.xpFor(20, 'farm') + (h - gh(20)) * 1000 * Math.pow(1.1412, 19); const a = gh(lv), b = gh(lv + 1), xa = S.xpFor(lv, 'farm'), xb = S.xpFor(lv + 1, 'farm'); return xa * Math.pow(xb / xa, (h - a) / (b - a)); }; // ใช้การโตแบบยกกำลังช่วงเลเวล
  const lvAt = h => { let lv = 1; while (lv < 20 && gh(lv + 1) <= h) lv++; return lv; };
  let cum = 0; const xpr = {};
  console.log('อ. | เริ่ม(ชม.สะสม) | เลเวลตอนเข้า(S2) | แนะนำ 2r-1 | XP รวมที่ให้ในอาณาจักร | XP/ชม.จริง | XP/ธรรมดา (ปัด) | อีลีท | มินิ | บอส | เควส+หีบ XP 15%');
  for (const r of R) {
    const T = k[r].T / 3600, x0 = xpAt(cum), x1 = xpAt(cum + T), X = x1 - x0, wsum = k[r].c.norm + 3 * k[r].c.elite + 8 * k[r].c.mini + 20 * k[r].c.boss;
    const perN = Math.max(1, Math.round(0.85 * X / wsum)); xpr[r] = perN;
    console.log(`${pad(r, 2)} | ${pad(cum.toFixed(1), 6)} | ${pad(lvAt(cum), 6)} | ${pad(2 * r - 1, 5)} | ${pad(f0(X), 8)} | ${pad(f0(X / T), 6)} | ${pad(perN, 5)} | ${pad(perN * 3, 5)} | ${pad(perN * 8, 5)} | ${pad(perN * 20, 5)} | ${pad(f0(X * 0.15 / D.sessionH), 6)}`);
    cum += T;
  }
  console.log(`จบชั้น 100 ที่ ${cum.toFixed(1)} ชม.สะสมตีล้วนๆ = เลเวล ${lvAt(cum)} ตามเส้นเป้า (S2) • ถ้าอยากให้เลเวลตรงที่แนะนำ 2r-1 ทุกอาณาจักร (S1) ต้องให้ XP สะสมก่อนเข้าอาณาจักร 10 มากกว่าเส้นเป้า ≈ ${(S.xpFor(19, 'farm') / xpAt(cum - k[10].T / 3600)).toFixed(2)}× → นักสู้ถึง Lv20 ราว ชม.ที่ 14 ไม่ใช่ ${gh(20).toFixed(0)} ชม. (ชนเป้า Lv20≈20 ชม.)`);
  console.log('  ข้อควรตัดสิน: เลเวลตามเส้น 20 ชม. จะตามหลังเลเวลแนะนำ 1–3 เลเวลในอาณาจักรลึก (อ.10 เข้าที่ Lv16 แทน 19) (ผู้เล่นปกติที่เวลาตีล้วนๆ ' + cum.toFixed(0) + ' ชม. ยังไม่ถึง Lv20 ส่วนที่ขาดมาจากเควส/ทำซ้ำ/ตาย/เตรียมของ 6+ ชม. ที่แผนนับเป็น 30–40 ชม.)');
  // ความทน
  console.log('\n--- ความทนอาวุธ/เกราะที่ทำให้ค่าสึกตรงเป้า (อาวุธ 7% เกราะ 5% ของรายได้รวม) ---');
  const wr = [], ar = [];
  for (const r of R) {
    const fs = floorSet(r, 1, O(r)), sw = fs.reduce((a, x) => a + x.swings, 0), T = k[r].T / 3600, sph = sw / T, G = res[r - 1].g1;
    const perSw = D.wearShare.weapon * G / sph, dw = Math.round(gearPrice(r) * S.WEAR_RATE.base * 1.35 / perSw / 50) * 50;
    const hitsTaken = 140, perHit = D.wearShare.armor * G / hitsTaken, da = Math.round(gearPrice(r) * S.WEAR_RATE.base * 1.35 / perHit / 50) * 50; // สมมติโดนตีชม.ละ 140 ครั้ง
    wr.push(dw); ar.push(da);
  }
  console.log('  ความทนอาวุธ (ครั้งฟาด) อ.1–10: ' + wr.join(', ') + ' (ฟาดต่อชม. ' + f0(floorSet(5, 1, O(5)).reduce((a, x) => a + x.swings, 0) / (k[5].T / 3600)) + ' ที่ อ.5)');
  console.log('  ความทนเกราะ (ครั้งที่โดน; สมมติโดน 140 ครั้ง/ชม.) อ.1–10: ' + ar.join(', '));
  return { price, chest, quest };
}

// ========== 4) ตารางร่างสถิติ ==========
const W = [4, 5, 6, 8, 10, 12, 15, 19, 24, 30];            // ดาเมจอาวุธต่อครั้ง (ข้อเสนอ ก้าว ~ +25%)
const ARM = [10, 14, 19, 25, 32, 40, 50, 62, 76, 92];      // HP เพิ่มจากเกราะ
const hpBase = lv => 50 + 5 * (lv - 1);
function table() {
  console.log('=== 4) ตารางร่างสถิติ 10 อาณาจักร (จำนวนเต็ม) ===');
  const { MB, MF } = time_quiet();
  console.log(`ดาเมจอาวุธ W(ระดับ 1–10) = ${W.join(', ')} • เกราะ +HP = ${ARM.join(', ')} • HP ผู้เล่นฐาน = 50 + 5×(Lv−1) • เป้าฟาดธรรมดา ${hitsOf(1)}–${hitsOf(10).toFixed(1)} ครั้ง ที่กำลังผู้เล่นปกติ (เลเวล 2r−1 + สมุดสะสม + อาหาร, คริ ×${D.critMean.toFixed(1)})`);
  console.log('อ. | W | กำลังปกติ P | HP ผู้เล่น (Lv 2r-1 + เกราะ r) | HP ธรรมดา k=1..10 ตัวแรก/ตัวท้าย | อีลีท (k=8) | มินิ (k=5) | บอส x0 | ดาเมจธรรมดา k=1 / k=10 | อีลีท | มินิ | บอส');
  const rows = [];
  for (const r of R) {
    const P = pTyp(r), php = hpBase(2 * r - 1) + ARM[r - 1];
    const hp = k => Math.round(W[r - 1] * P * D.critMean * hitsOf(k));
    const mhp = { n1: hp(1), n10: hp(10), elite: hp(8) * D.mult.elite, mini: hp(5) * D.mult.mini, boss: hp(10) * (r === 10 ? MF : MB) };
    const dm = (hitsDie) => Math.max(1, Math.round(php / hitsDie));
    const dN1 = dm(14), dN10 = dm(10), dE = dm(8), dM = dm(7), dB = dm(r === 10 ? 5 : 6);
    rows.push({ r, mhp }); console.log(`${pad(r, 2)} | ${pad(W[r - 1], 2)} | ${P.toFixed(2)} | ${pad(php, 4)} (${hpBase(2 * r - 1)}+${ARM[r - 1]}) | ${pad(mhp.n1, 4)} / ${pad(mhp.n10, 4)} | ${pad(f0(mhp.elite), 5)} | ${pad(f0(mhp.mini), 5)} | ${pad(f0(mhp.boss), 6)}${r === 10 ? ' (สุดท้าย)' : ''} | ${pad(dN1, 3)} / ${pad(dN10, 3)} | ${pad(dE, 3)} | ${pad(dM, 3)} | ${pad(dB, 3)}`);
  }
  console.log('อ่านตาราง: ดาเมจมอนสเตอร์ = HP ผู้เล่น ÷ จำนวนครั้งที่ตั้งใจให้โดนก่อนตาย (ธรรมดา 14 → 10 ครั้ง, อีลีท 8, มินิ 7, บอส 6, สุดท้าย 5) ที่ HP ผู้เล่น "ตามที่แนะนำ" • ผู้เล่นเลเวลตามเส้นเป้า (ช้ากว่าแนะนำ ~1–3 เลเวล) HP ต่ำลง 5–10% → โดนน้อยลง 1 ครั้ง');
  console.log('บอสสุดท้าย (ชั้น 100): HP ' + f0(rows[9].mhp.boss) + ' เฟสละ ~⅓ • ข้อ 10 ของ §12 (อาวุธ 10 + Lv20 + 5 ดาว + สมุดเต็ม + อาหารเต็ม ต้องไม่ต่ำกว่า 6 นาที): ที่ตัวคูณ ×' + MF + ' ได้ ' + (bossSec('final', 10, 1, { mul: { final: MF }, state: 'max' }) / 60).toFixed(1) + ' นาที');
  console.log('สกิลอาวุธ ดาบ/หอก/ธนู (ข้อเสนอ ไม่ได้ซิม): ดาบ ×1.0 ต่อครั้งเร็ว • หอก ×0.9 ทะลุแถว • ธนู ×0.85 ไกล (ใช้ลูกธนู) — ค่ามาตรฐาน ซิมทั้งหมดใช้ดาบ');
}

/*ROUND2*/
// ========== รอบ 2: ตารางผนึกรายชั้น (docs/plans/dungeon-100-floors.md ข้อ 3) ==========
// โทเคนผนึก: K ค่าย (Kt สอนชั้น 1, Kv เมืองใต้ดิน 51, Kb ค่ายใหญ่ 91) • A<n> กวาด • B กุญแจ • EB อีลีทถือกุญแจ • C<คลื่น> • D<วินาที> • E<อีลีท> • F<ขั้นปริศนา>
// G<วินาที> • H<ชิ้นเซ่น> • I<ขั้นกลไก> • L<ตัว> ศาลเจ้า • S<เงา> • M มินิบอส+ค่าย • X บอส • Z บอสสุดท้าย • ต่อท้าย * = ในสภาวะอันตราย (มืด/พิษ) เวลา ×P.hazard
const FL = [
  'Kt', 'A16', 'EB', 'C2', 'M', 'F3', 'L10', 'E1', 'H3', 'X',
  'K', 'I4', 'A16', 'EB', 'M', 'F3', 'C3', 'D60', 'H6', 'X',
  'K', 'A18', 'I5', 'C3', 'M', 'I4', 'F4', 'E1', 'H4', 'X',
  'K', 'A14 F1', 'EB I2', 'C3 E1', 'M', 'F3 F3', 'D75 A16', 'E2 H5', 'L12 G100', 'X',
  'K', 'A18 I3', 'EB I3', 'C3 I2', 'M', 'F4 A18', 'D90 E1', 'H6 G110', 'L12 C3', 'X',
  'Kv', 'A18 I2', 'F3 B', 'C3 D60', 'M', 'I2 E1', 'A20 F3', 'H5 G100', 'L12 C3', 'X',
  'K', 'A18 I3', 'F2 B', 'C3 D75', 'M', 'F3 A20', 'E1 I4', 'H2 G100', 'L12 D80', 'X',
  'K', 'F4 A18', 'F4 B', 'C3 F3', 'M', 'I4 E1', 'F6 D80', 'H6 A20', 'L12 G110', 'X',
  'K', 'S1 A18', 'D75 B', 'C3 F3', 'M', 'S2 A20', 'E2 D90', 'H5 G100', 'L12 F3', 'X',
  'Kb', 'I5* A20* B', 'I3* F5 C3*', 'I4 F3 D90', 'M', 'I3 B E1', 'I4 C3 D90', 'F8 A22 H6', 'S3 G120 E2', 'Z',
];
const FLSEAL = FL.map(s => s.split(' '));
const P = {
  hpParty: 0.75, mult: { elite: 3, mini: 8, boss: 14, final: 37 }, bonus: [0, 0, .10, .13, .15], // โบนัสของตกต่อคน ที่ปาร์ตี้ n คน (index = n)
  trav0: 30, travR: 7,            // วินาทีเดินไปผนึกแต่ละอัน = trav0 + travR×(r-1)
  door0: 20, doorR: 3,            // วินาทีเดินไปประตูท้ายชั้น
  cm: [2.2, 2.1, 2.1, 2.0, 2.1, 2.2, 2.4, 2.6, 2.9, 2.0],   // ตัวคูณ "จำนวนตัว" ต่ออาณาจักร (ผนึก A ศาลเจ้า คลื่น อีลีท ลูกสมุน มินิ) = ค่าที่เสนอแทนตัวเลขในตาราง (ฟิตตามเป้าเวลา)
  sm: [1.9, 1.8, 1.7, 1.6, 1.5, 1.5, 1.6, 1.7, 1.9, 1.3],   // ตัวคูณ "ความยาวงาน" ต่ออาณาจักร (ขั้นปริศนา ขั้นกลไก ชิ้นเซ่น วินาทีรอด/บุกเร็ว)
  dCap: 120, gCap: 150,
  wsz: r => 8 + r, waveDelay: 22, waveGap: 8,  // ขนาดคลื่น ผนึก C
  chaseKey: 35, chaseElite: 20,   // วินาทีไล่ตัวถือกุญแจ / ตามล่าอีลีท
  pz0: 40, pzS: 28,               // ปริศนา: วินาที = pz0 + pzS×ขั้น
  gRetry: 0.30, gWin: 0.80,       // บุกเร็ว: โอกาสไม่ทัน (ลองใหม่ได้) สัดส่วนเวลาที่ใช้เมื่อสำเร็จ
  hBase: 30, hItem: 5, hWalk: 15, hVal: 1 / 150, // เซ่น: วินาทีวางของ ค่าของที่เสียต่อชิ้น = รายได้ชาวนา/ชม. × hVal
  iBase: 20, iStep: 30,           // กลไกอาณาจักร: วินาที = iBase + iStep×ขั้น
  lBase: 25, lMul: 1.1,           // ศาลเจ้า: เลือกพร + ตัวละ×lMul (คำสาป)
  shadowFix: 8,
  camp: { Kt: 90, K: 150, Kv: 300, Kb: 240, Ks: 75 }, // วินาทีที่ค่าย (พิธี + ซ่อม/เก็บของ/กิน)
  miniWalk: 35, miniFix: 20, miniAdds: 6, miniCamp: 60,
  bossWalk: 30, bossPost: 30, finalPost: 90,
  hazard: 1.2, dSetup: 12,
  extra: { 25: 60, 75: 90 },      // ฉากเรื่อง (สหาย NPC ชั้น 25, หักมุมชั้น 75)
  // ---- รอบ 3 (ปิดไว้ตอนรัน floors รอบ 2) ----
  par: false, walkPar: 0, parLoss: 0.10, regroup: 15, // ปาร์ตี้แยกทีมทำผนึก C/F/I/H ขนานกัน: เวลา = ทีมที่ช้าสุด ×(1+parLoss) + รวมตัว regroup วินาที
  gScale: 0, tm: null, r3: false,         // G: ตัวที่ต้องปราบ ×(1+gScale×(n-1)) • tm = ตัวคูณระยะเดินต่ออาณาจักร (แมพใหญ่ขึ้น)
};
const rk = f => Math.ceil(f / 10), kk = f => ((f - 1) % 10) + 1;
function sealOf(tok, f, n, o = {}) {
  const r = rk(f), k = kk(f), m = tok.match(/^([A-Za-z]+)(\d*)(\*?)$/), ty = m[1]; let q = +m[2] || 0; const hz = m[3] ? P.hazard : 1;
  const fr = Math.pow(D.friction, n - 1), walk = D.walk0 + D.walkR * (r - 1), tr = (P.trav0 + P.travR * (r - 1)) * (P.tm ? P.tm[r - 1] : 1) * fr, hk = hitsOf(k);
  const cm = P.cm[r - 1], sm = P.sm[r - 1], kl = { norm: 0, elite: 0, mini: 0, boss: 0 }, nf = () => fightSec(hk, D.u.norm, n, o), wp = 1 / (1 + P.walkPar * ((o.sq || n) - 1)), nm = () => nf() + walk * fr * wp; // wp = เดิน/ล่อต่อตัวสั้นลงเมื่อคนในทีมย่อยกระจายกันหา
  const el = mult => fightSec(hk * mult, D.u.elite, n, o) + walk * fr * wp;
  let t = 0, items = 0, nG = 0, act = q, add = 0; // act = ตัวเลขจริงหลังคูณ (จำนวนตัว/ขั้น/วินาที) add = ลูกสมุนที่ไม่ตกของ
  switch (ty) {
    case 'A': { const c = Math.round(q * cm); t = tr + c * nm() * hz; kl.norm = c; act = c; break; }
    case 'B': add = Math.round(2 * cm); t = tr + P.chaseKey * fr + el(2) + add * nf(); kl.elite = 0.67; break;
    case 'EB': add = Math.round(3 * cm); t = tr + P.chaseKey * fr + el(P.mult.elite) + add * nf(); kl.elite = 1; break;
    case 'C': { const w = Math.min(18, Math.round(P.wsz(r) * cm)); t = tr * 0.3 + q * (w * (nf() + 2 * fr) + P.waveDelay * fr + P.waveGap) * hz; kl.norm = q * w; act = w; break; }
    case 'D': { const T = Math.min(P.dCap, Math.round(q * sm)); t = tr * 0.3 + T + P.dSetup; kl.norm = Math.round(T / 10); act = T; break; }
    case 'E': { const e = Math.max(q, Math.round(q * (1 + (cm - 1) * 0.4))); t = tr + e * (el(P.mult.elite) + P.chaseElite * fr) + (add = Math.round(1.5 * (cm - 1) * e)) * nf(); kl.elite = e; act = e; break; }
    case 'F': act = Math.round(q * sm); t = tr + P.pz0 + P.pzS * act; break;
    case 'G': { q = Math.min(P.gCap, Math.round(q * sm)); const w1 = D.walk0 + D.walkR * (r - 1); nG = Math.round(P.gWin * q / (fightSec(hk, D.u.norm, 1, o) + w1 * 0.4)); const p = P.gRetry; t = tr + q * P.gWin + p / (1 - p) * (q + 20) + 0; kl.norm = nG * (1 + P.gScale * (n - 1)); act = q; break; }
    case 'H': { const it = q; // ชิ้นเซ่นคงตามตาราง (ไม่คูณ sm เพราะเป็นของที่ผู้เล่นต้องเสียเงินเตรียม)
      t = tr * 0.6 + P.hBase + P.hItem * it + P.hWalk; items = it; act = it; break; }
    case 'I': act = Math.round(q * sm); t = tr + (P.iBase + P.iStep * act) * hz * fr; break;
    case 'L': { const c = Math.round(q * cm); t = tr * 0.3 + P.lBase + c * nm() * P.lMul; kl.norm = c; act = c; break; }
    case 'S': t = tr * 0.5 + q * (el(P.mult.elite) + P.shadowFix * fr); kl.elite = 0.5 * q; break;
    case 'K': case 'Kt': case 'Kv': case 'Kb': case 'Ks': t = P.camp[ty] * fr; break;
    case 'M': t = P.miniWalk * fr + fightSec(hitsOf(5) * D.mult.mini, D.u.mini, n, o) + P.miniFix * fr + (add = Math.round(P.miniAdds * cm)) * nf() + P.miniCamp; kl.mini = 1; break;
    case 'X': t = P.bossWalk * fr + bossSec('boss', r, n, o) + P.bossPost; kl.boss = 1; break;
    case 'Z': t = bossSec('final', 10, n, o) + P.finalPost; kl.boss = 1; break;
    default: throw new Error('ผนึกไม่รู้จัก ' + tok);
  }
  return { ty, t, kl, items, nG, q, act, add, hz: hz > 1 };
}
const SPLITTY = ['C', 'F', 'I', 'H', 'A', 'B', 'EB', 'E', 'S']; // ผนึกที่แยกทีมทำขนานได้ (ปริศนา กลไก ป้องกัน เซ่น + ผนึกสู้ที่ทีมย่อย ≥ minSq คน) • ที่เหลือ D G L K M X Z ต้องทำทั้งปาร์ตี้
const COMBAT = ['A', 'B', 'EB', 'E', 'S', 'C'];
const comps = (m, c) => c === 1 ? [[m]] : [].concat(...Array.from({ length: m - c + 1 }, (_, i) => comps(m - i - 1, c - 1).map(x => [i + 1, ...x])));
P.minSq = 2; P.splitSet = SPLITTY;
function partySealT(f, n, o, ss) {
  const toks = FLSEAL[f - 1]; let tg = 0; const spl = [];
  toks.forEach((tk, i) => { if (P.splitSet.includes(ss[i].ty)) spl.push(tk); else tg += ss[i].t; });
  if (!spl.length) return tg;
  const tyOf = tk => tk.match(/^[A-Za-z]+/)[0];
  let best = spl.reduce((a, tk) => a + sealOf(tk, f, n, o).t, 0);
  if (spl.length < 2) return tg + best;
  for (let c = 2; c <= Math.min(n, spl.length); c++) for (const sz of comps(n, c)) for (let a = 0, N = Math.pow(c, spl.length); a < N; a++) {
    let x = a; const asg = [], load = Array(c).fill(0); let ok = true;
    for (let j = 0; j < spl.length; j++) { asg.push(x % c); x = Math.floor(x / c); }
    if (new Set(asg).size < c) continue;
    spl.forEach((tk, j) => { const g = sz[asg[j]]; if (n >= 3 && g < P.minSq && COMBAT.includes(tyOf(tk)) && tyOf(tk) !== 'C') ok = false; load[asg[j]] += sealOf(tk, f, n, Object.assign({}, o, { sq: g })).t; });
    if (!ok) continue;
    best = Math.min(best, Math.max(...load) * (1 + P.parLoss) + P.regroup);
  }
  return tg + best;
}
function floorOf(f, n, o = {}) {
  const r = rk(f), fr = Math.pow(D.friction, n - 1), ss = FLSEAL[f - 1].map(tk => sealOf(tk, f, n, o));
  const camp = ss.length === 1 && /^(K|Kt|Kv|Kb|M|X|Z)$/.test(ss[0].ty);
  const kl = { norm: 0, elite: 0, mini: 0, boss: 0 }; let items = 0;
  ss.forEach(s => { for (const x in kl) kl[x] += s.kl[x]; items += s.items; });
  const sealT = (P.par && n > 1 && !camp) ? partySealT(f, n, o, ss) : ss.reduce((a, s) => a + s.t, 0);
  const t = sealT + (camp ? 0 : (P.door0 + P.doorR * (r - 1)) * (P.tm ? P.tm[r - 1] : 1) * fr) + (P.extra[f] || 0) * fr;
  return { f, r, k: kk(f), toks: FLSEAL[f - 1], t, kl, items, ss };
}
function setupR2() { D.hpParty = P.hpParty; D.mult.boss = P.mult.boss; D.mult.final = P.mult.final; D.mult.elite = P.mult.elite; D.mult.mini = P.mult.mini; }
const allFloors = (n, o) => { const a = []; for (let f = 1; f <= 100; f++) a.push(floorOf(f, n, o)); return a; };
const sumT = a => a.reduce((x, y) => x + y.t, 0);
const kingTargetH = r => P.r3 ? P.T3[r - 1] : 14 * D.planKingdomHours[r - 1] / 31;
function floorsCore() {
  setupR2();
  const F1 = allFloors(1), F2 = allFloors(2), F4 = allFloors(4);
  return { F1, F2, F4 };
}
// ---- ผลลัพธ์รอบ 2 ----
const isCampF = x => x.toks.length === 1 && /^(K|Kt|Kv|Kb|M|X|Z)$/.test(x.toks[0]);
const kindOf = x => x.toks.length === 1 ? ({ K: 'ค่าย', Kt: 'ค่ายสอน', Kv: 'เมืองใต้ดิน', Kb: 'ค่ายใหญ่', M: 'มินิบอส+ค่าย', X: 'บอส', Z: 'บอสสุดท้าย' }[x.toks[0]] || 'ปกติ') : 'ปกติ';
const CHEST_U = x => ({ K: 0.5, Kt: 0.5, Kv: 1, Kb: 1, M: 2, X: 4, Z: 6 }[x.toks.length === 1 ? x.toks[0] : ''] || (1 + 0.5 * (x.toks.length - 1) + 0.25)); // หน่วยหีบต่อชั้น (ปกติ 1 + 0.5/ผนึกเพิ่ม + หีบโบนัส 0.25)
const sealTxt = s => s.ty + (s.ty === 'C' ? s.q + 'x' + s.act : (['A', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'S'].includes(s.ty) ? s.act : '')) + (s.hz ? '*' : '');
const REPMUL = [1, 1, .7, .5, .38, .32, .25, .18, .14, .11];
// รอบ 3: ตาย = เกิดที่ค่ายล่าสุดต่ำกว่าชั้นที่ตาย (x1, x5 และชั้น 97 ถ้ามีค่าย) เดินผ่านชั้นที่ผ่านแล้วชั้นละ passSec แล้วเสียครึ่งชั้นของชั้นที่ตาย (ชั้นรีเซ็ต) + 15 วิ เกิดใหม่
const campFloors = (c97) => { const a = []; for (let f = 1; f <= 100; f++) if (f % 10 === 1 || f % 10 === 5) a.push(f); if (c97) a.push(97); return a.sort((x, y) => x - y); };
const passSec = r => (P.door0 + P.doorR * (r - 1)) * (P.tm ? P.tm[r - 1] : 1) * 1.3 + 15;
function deathLossR3(f, F1, c97) { const cs = campFloors(c97).filter(c => c < f), c = cs.length ? cs[cs.length - 1] : 1, r = rk(f); return Math.max(0, f - c - 1) * passSec(r) + 0.5 * F1[f - 1].t + 15; }
function floors() {
  const json = process.argv.includes('--json');
  setupR2();
  const savedCm = P.cm.slice(), savedSm = P.sm.slice();
  P.cm = P.cm.map(() => 1); P.sm = P.sm.map(() => 1); const raw = [sumT(allFloors(1)), sumT(allFloors(4))]; P.cm = savedCm; P.sm = savedSm;
  const { F1, F2, F4 } = floorsCore(), h = s => s / 3600, mn = s => (s / 60).toFixed(1);
  if (P.r3) {
    console.log('=== รอบ 3: ซิมเวลา/รายได้/ดรอปรายชั้น (จำนวนตัว ≤ ×1.5, ปาร์ตี้แยกทีมขนาน, ค่ายชั้น 97) ===');
    console.log(`พารามิเตอร์: จำนวนตัว cm = ${P.cm.join(', ')} • ความยาวงาน sm = ${P.sm.map(v => +v.toFixed(2)).join(', ')} • ระยะเดิน tm = ${P.tm.map(v => +v.toFixed(2)).join(', ')} • บอส ×${P.mult.boss}/×${P.mult.final} • HP ปาร์ตี้ +${D.hpParty}/คน • โบนัสของตกรอบ 2 (+10/13/15%) ถูกแทนด้วยตารางรายอาณาจักร (ดูข้อ 4) • แยกทีมขนาน: parLoss ${P.parLoss} regroup ${P.regroup}s walkPar ${P.walkPar} ทีมสู้ ≥${P.minSq} คน • G ตัวที่ต้องปราบ ×(1+${P.gScale}×(n-1)) • ค่ายเล็กชั้น 97 ${P.camp.Ks}s`);
  } else {
  console.log('=== รอบ 2: ซิมเวลา/รายได้/ดรอปรายชั้นตามตารางผนึก (docs/plans/dungeon-100-floors.md ข้อ 3) ===');
  console.log(`ข้อตัดสินใจที่ใช้แล้ว: บอส ×${P.mult.boss}/×${P.mult.final} • HP ปาร์ตี้ +${P.hpParty}/คน • โบนัสของตก 2/3/4 คน = ${P.bonus.slice(2).map(b => '+' + b * 100 + '%').join('/')} • ค่าซ่อมตาย repairMul ต่ออาณาจักร [${REPMUL.join(', ')}]`);
  console.log(`ตารางดิบ (ตัวเลขในไฟล์แผนเป๊ะ: A 14–22 ตัว D 60–90 วิ ฯลฯ คูณ 1.0): เดี่ยว ${h(raw[0]).toFixed(1)} ชม. 4 คน ${h(raw[1]).toFixed(1)} ชม. → ต่ำกว่าเป้า 12–16 ชม. ต้องขยายจำนวนตัว/ความยาวงาน`);
  console.log('ตัวคูณที่เสนอ (ทับตัวเลขตาราง) จำนวนตัว cm = ' + P.cm.join(', ') + ' • ความยาวงาน sm (ขั้นปริศนา/กลไก ชิ้นเซ่น วินาทีรอด/บุกเร็ว) = ' + P.sm.join(', ') + ' (อ.1–10)');
  }
  // ---- ตารางเวลาต่อผนึกแต่ละแบบ ----
  console.log('\n--- 1) นาที/ผนึก เดี่ยว (ค่าพารามิเตอร์ "เดิมในตาราง" แล้วคูณตัวคูณที่เสนอ; k=6 รวมระยะเดินไปผนึก ไม่รวมเดินไปประตู) ---');
  const typ = ['A18', 'B', 'EB', 'C3', 'D75', 'E1', 'F3', 'G100', 'H5', 'I4', 'L12', 'S1', 'K', 'M', 'X'];
  console.log('อ. | ' + typ.map(t => t.padEnd(5)).join(' '));
  for (let r = 1; r <= 10; r++) console.log(pad(r, 2) + ' | ' + typ.map(t => pad(mn(sealOf(t, (r - 1) * 10 + (t === 'K' ? 1 : t === 'M' ? 5 : t === 'X' ? 10 : 6), 1).t), 5)).join(' '));
  console.log('(r=10 ใช้ X = บอสสุดท้ายไม่ได้คิดตรงนี้ ดูชั้น 100) ผนึก C คิดคลื่นละ ' + P.wsz(1) + '→' + P.wsz(10) + ' ตัว ×cm เพดาน 18 ตัวพร้อมกัน • ผนึก B/EB/E/S ตัวไล่ล่าเดินหนี ' + P.chaseKey + '/' + P.chaseElite + ' วิ • G บุกเร็วใช้เวลา ' + P.gWin + 'T สำเร็จ + ไม่ทัน ' + (P.gRetry * 100) + '% ลองใหม่ได้ → ≈ ' + ((P.gWin + P.gRetry / (1 - P.gRetry)) * 100).toFixed(0) + '% ของเวลาจำกัด + 20 วิ/รอบรีเซ็ต');
  // ---- รายชั้น ----
  const Tk = r => F1.slice((r - 1) * 10, r * 10);
  console.log('\n--- 2) เวลารายชั้น 1–100 (นาที) • ผนึก: ตัวเลขหลังตัวอักษร = จำนวนตัว/ขั้น/วินาที "หลังคูณแล้ว" C = คลื่น x ตัว * = ในสภาวะอันตราย ---');
  console.log('ชั้น | แบบ                      | ผนึก (จริงที่เสนอ)           | เดี่ยว   2 คน   4 คน | ตัวที่ตก ธรรมดา/อีลีท/มินิ/บอส | หีบ(หน่วย)');
  for (let i = 0; i < 100; i++) { const a = F1[i], b = F2[i], c = F4[i], k = a.kl; console.log(`${pad(a.f, 4)} | ${kindOf(a).padEnd(24)} | ${a.ss.map(sealTxt).join(' ').padEnd(28)} | ${pad(mn(a.t), 6)} ${pad(mn(b.t), 6)} ${pad(mn(c.t), 6)} | ${pad(Math.round(k.norm), 4)} ${pad(k.elite.toFixed(1), 4)} ${pad(k.mini, 2)} ${pad(k.boss, 2)} | ${CHEST_U(a).toFixed(2)}`); }
  // ---- รายอาณาจักร ----
  console.log('\n--- 3) รวมรายอาณาจักร เทียบเป้า ---');
  console.log('อ. | เป้า(ชม.) เดี่ยว  2คน  4คน | %4คน/เดี่ยว | นาที/ชั้นปกติ (เฉลี่ย min–max) | ฟาดจริงรวม(ชม.)');
  let T = [0, 0, 0], normAll = [];
  for (let r = 1; r <= 10; r++) {
    const t = [F1, F2, F4].map(F => sumT(F.slice((r - 1) * 10, r * 10))), nn = Tk(r).filter(x => !isCampF(x)).map(x => x.t / 60); T = T.map((v, i) => v + t[i]); normAll = normAll.concat(nn);
    const sw = Tk(r).reduce((a, x) => a + (x.kl.norm * hitsOf(x.k) + x.kl.elite * hitsOf(x.k) * P.mult.elite + x.kl.mini * hitsOf(5) * P.mult.mini + x.kl.boss * hitsOf(10) * (r === 10 ? P.mult.final : P.mult.boss)), 0);
    console.log(`${pad(r, 2)} | ${pad(kingTargetH(r).toFixed(2), 6)} ${pad(h(t[0]).toFixed(2), 6)} ${pad(h(t[1]).toFixed(2), 5)} ${pad(h(t[2]).toFixed(2), 5)} | ${pad(pct(t[2] / t[0]), 5)} | ${(nn.reduce((a, b) => a + b, 0) / nn.length).toFixed(1)} (${Math.min(...nn).toFixed(1)}–${Math.max(...nn).toFixed(1)}) | ${(sw * D.swing / 3600).toFixed(2)}`);
  }
  console.log(`รวม: เดี่ยว ${h(T[0]).toFixed(1)} ชม. • 2 คน ${h(T[1]).toFixed(1)} (${pct(T[1] / T[0])}) • 4 คน ${h(T[2]).toFixed(1)} (${pct(T[2] / T[0])}) • ผล: เป้า ${P.r3 ? '11–12' : '12–16'} ชม. ${h(T[0]) >= (P.r3 ? 11 : 12) && h(T[0]) <= (P.r3 ? 12 : 16) ? 'ผ่าน' : 'ตก'} • ปาร์ตี้ vs เดี่ยว ±25% ${T[2] / T[0] >= .75 && T[1] / T[0] <= 1.25 ? 'ผ่าน' : 'ตก'}${P.r3 ? ' • 4 คนเร็วกว่าเดี่ยว ' + (100 - T[2] / T[0] * 100).toFixed(0) + '% (เป้า 15–20%) ' + (T[2] / T[0] <= 0.855 && T[2] / T[0] >= 0.78 ? 'ผ่าน' : 'ตก') : ''}`);
  const sens = {};
  const runWith = (fn) => { const bak = { u: Object.assign({}, D.u), fr: D.friction, walk0: D.walk0 }; fn(); const a = sumT(allFloors(1)), b = sumT(allFloors(4)); D.u = bak.u; D.friction = bak.fr; D.walk0 = bak.walk0; return [a, b]; };
  console.log('ความไว (ชม. เดี่ยว / 4 คน):');
  for (const [nm, fn] of [['ผู้เล่นเก่ง ฟาดมากขึ้น 25% (u ×1.25)', () => { for (const k in D.u) D.u[k] = Math.min(.95, D.u[k] * 1.25); }], ['มือใหม่ ฟาดน้อยลง 25%', () => { for (const k in D.u) D.u[k] *= .75; }], ['เดิน/ล่อ +30% (walk0 ×1.3)', () => { D.walk0 *= 1.3; }], ['ปาร์ตี้ขนานกันดี friction 0.9', () => { D.friction = .9; }], ['ปาร์ตี้รอกันมาก friction 1.1', () => { D.friction = 1.1; }]]) { const [a, b] = runWith(fn); console.log(`  ${nm.padEnd(38)} ${h(a).toFixed(1)} / ${h(b).toFixed(1)} (4 คน = ${pct(b / a)})`); }
  // ---- รายได้ ----
  console.log('\n--- 4) รายได้/ชม. นักสู้ vs ชาวนา (เวลา/ตัวที่ตกจากตารางรายชั้น) ---');
  const R2 = {}; let cum = 0;
  const gh = lv => L.goalHours('fish', lv);
  const xpAt = hh => { let lv = 1; while (lv < 20 && gh(lv + 1) <= hh) lv++; if (lv >= 20) return S.xpFor(20, 'farm') + (hh - gh(20)) * 1000 * Math.pow(1.1412, 19); const a = gh(lv), b = gh(lv + 1), xa = S.xpFor(lv, 'farm'), xb = S.xpFor(lv + 1, 'farm'); return xa * Math.pow(xb / xa, (hh - a) / (b - a)); };
  const lvAt = hh => { let lv = 1; while (lv < 20 && gh(lv + 1) <= hh) lv++; return lv; };
  const oldPrice = P.r3 ? [4, 8, 14, 17, 20, 28, 35, 43, 38, 59] : [6, 12, 19, 30, 42, 57, 76, 83, 102, 118]; // รอบ 3: 'เดิม' = ราคาที่เจ้าของรับไว้หลังรอบ 2
  console.log('อ. | ชาวนา/ชม. | ชิ้นส่วน(ถ่วง)/ชม. | ราคา/ชิ้น ใหม่ (เดิม) ÷แร่ | หน่วยหีบ→เหรียญ | เดี่ยวสุทธิ ราคาใหม่ / ราคาเดิม | 2 คน / 4 คน (โบนัส 10/15%) | เก่ง ×1.25 | เควส/ชุด');
  const quest = {};
  for (let r = 1; r <= 10; r++) {
    const FF = Tk(r), Tt = h(sumT(FF)), pcs = FF.reduce((a, x) => a + x.kl.norm * D.piece.norm + x.kl.elite * D.piece.elite + x.kl.mini * D.piece.mini + x.kl.boss * D.piece.boss, 0), units = FF.reduce((a, x) => a + CHEST_U(x), 0);
    const G = D.income * farmerReal(r) / (1 - D.wearShare.weapon - D.wearShare.armor), fm = farmerReal(r);
    const price = Math.max(1, Math.round(D.split.drops * G * Tt / pcs)), chestU = Math.round(D.split.chests * G * Tt / units / 5) * 5, q = Math.round(D.split.quests * G * D.sessionH / 10) * 10; quest[r] = q;
    const inc = (n, pr, ux = 1, bonus = P.bonus[n]) => { const Tn = h(sumT(allFloors(n, { ux }).slice((r - 1) * 10, r * 10))); return ((pcs * pr * (1 + bonus) + units * chestU) / Tn + q / D.sessionH) * (1 - D.wearShare.weapon - D.wearShare.armor) / fm; };
    const bR = n => P.r3 ? Math.round(Math.max(-0.20, Math.min(0.10, 1.12 / inc(n, price, 1, 0) - 1)) * 20) / 20 : P.bonus[n]; // รอบ 3: โบนัส/คน รายอาณาจักร ให้รายได้ปาร์ตี้ ≈112% ของชาวนา (บวกได้ ≤ +10% ลบได้ ≥ -20%)
    R2[r] = { r, T: Tt, pcs, units, price, chestU, q, fm, G, soloNew: inc(1, price), soloOld: inc(1, oldPrice[r - 1]), p2: inc(2, price, 1, bR(2)), p4: inc(4, price, 1, bR(4)), bonusR: { 2: bR(2), 3: bR(3), 4: bR(4) }, inc0: { 2: inc(2, price, 1, 0), 3: inc(3, price, 1, 0), 4: inc(4, price, 1, 0) }, skilled: inc(1, price, 1.25, 0) * 0.88 / (1 - D.wearShare.weapon - D.wearShare.armor) };
    const x = R2[r]; console.log(`${pad(r, 2)} | ${pad(f0(fm), 6)} | ${pad(f0(pcs / Tt), 6)} | ${pad(price, 4)} (${pad(oldPrice[r - 1], 3)}) ${(price / S.ORES[S.ORE_ORDER[r - 1]].sell).toFixed(1)}× | ${pad(chestU, 4)}/หน่วย ${pad(units.toFixed(1), 4)} | ${pad(pct(x.soloNew), 5)} / ${pad(pct(x.soloOld), 5)} | ${pad(pct(x.p2), 5)} / ${pad(pct(x.p4), 5)} | ${pad(pct(x.skilled), 5)} | ${pad(q, 5)}`);
  }
  const gotOld = R.map(r => R2[r].soloOld);
  console.log(`ถ้าคงราคาชิ้นส่วนเดิม 6/12/…/118: รายได้เดี่ยวหลังสึก ${pct(Math.min(...gotOld))}–${pct(Math.max(...gotOld))} ของชาวนา (เป้า ≤110%) → ราคาใหม่ในตารางคือค่าที่ให้ ≈105% • ส่วนต่างราคาใหม่/เดิม ${R.map(r => (R2[r].price / oldPrice[r - 1]).toFixed(2)).join(' ')}`);
  if (P.r3) {
    console.log(`ปาร์ตี้ — โบนัสของตก +10/13/15% (ค่ารอบ 2): 4 คน สูงสุด ${pct(Math.max(...R.map(r => R2[r].inc0[4] * (1 + P.bonus[4]))))} • 2 คน สูงสุด ${pct(Math.max(...R.map(r => R2[r].inc0[2] * (1 + P.bonus[2]))))} (เพดาน 125%) • ไม่มีโบนัสเลย 4 คน ${pct(Math.min(...R.map(r => R2[r].inc0[4])))}–${pct(Math.max(...R.map(r => R2[r].inc0[4])))} 2 คน ${pct(Math.min(...R.map(r => R2[r].inc0[2])))}–${pct(Math.max(...R.map(r => R2[r].inc0[2])))}`);
    console.log('รายได้ปาร์ตี้ไม่มีโบนัส (%ชาวนา) อ.1–10: 2 คน ' + R.map(r => pct(R2[r].inc0[2])).join(' ') + ' • 4 คน ' + R.map(r => pct(R2[r].inc0[4])).join(' '));
    console.log('ตัวคูณของตกต่อคนรายอาณาจักร (ให้ ≈112%): 2 คน ' + R.map(r => (1 + R2[r].bonusR[2]).toFixed(2)).join(' ') + ' • 3 คน ' + R.map(r => (1 + R2[r].bonusR[3]).toFixed(2)).join(' ') + ' • 4 คน ' + R.map(r => (1 + R2[r].bonusR[4]).toFixed(2)).join(' ') + ` → รายได้ปาร์ตี้ 4 คน ${pct(Math.min(...R.map(r => R2[r].p4)))}–${pct(Math.max(...R.map(r => R2[r].p4)))} • 2 คน ${pct(Math.min(...R.map(r => R2[r].p2)))}–${pct(Math.max(...R.map(r => R2[r].p2)))}`);
  } else console.log(`ปาร์ตี้ที่ใช้โบนัส +10/13/15% ผ่านเพดาน 125%: ${R.every(r => R2[r].p4 <= 1.25) ? 'ผ่านทุกอาณาจักร' : 'ตก'} (สูงสุด 4 คน ${pct(Math.max(...R.map(r => R2[r].p4)))} • 2 คน ${pct(Math.max(...R.map(r => R2[r].p2)))})`);
  const offerCost = R.map(r => Tk(r).reduce((a, x) => a + x.items, 0) * R2[r].fm * P.hVal);
  console.log('ต้นทุนของที่เซ่น (ชิ้นเซ่น × รายได้ชาวนา/ชม. × 1/150 [สมมติ]) ต่ออาณาจักร เหรียญ/ชม.ที่เสียไป ' + R.map((r, i) => f0(offerCost[i] / R2[r].T)).join(', ') + ' = ' + R.map((r, i) => pct(offerCost[i] / R2[r].T / R2[r].fm)).join(', ') + ' ของชาวนา');
  // ---- XP ----
  console.log('\n--- 5) XP นักสู้ ตามเส้น 20 ชม. (หลอด STD) ---');
  console.log('อ. | เริ่ม(ชม.) | เลเวลตอนเข้า | แนะนำ 2r-1 | XP รวม | XP/ธรรมดา | อีลีท(×3) | มินิ(×8) | บอส(×20)');
  const XPK = {};
  for (let r = 1; r <= 10; r++) { const FF = Tk(r), Tt = R2[r].T, X = xpAt(cum + Tt) - xpAt(cum), ws = FF.reduce((a, x) => a + x.kl.norm + 3 * x.kl.elite + 8 * x.kl.mini + 20 * x.kl.boss, 0), pn = Math.max(1, Math.round(0.85 * X / ws)); XPK[r] = pn; console.log(`${pad(r, 2)} | ${pad(cum.toFixed(1), 6)} | ${pad(lvAt(cum), 5)} | ${pad(2 * r - 1, 4)} | ${pad(f0(X), 7)} | ${pad(pn, 5)} | ${pad(pn * 3, 5)} | ${pad(pn * 8, 5)} | ${pad(pn * 20, 5)}`); cum += Tt; }
  console.log(`จบชั้น 100 ที่ ${cum.toFixed(1)} ชม.สะสมตีล้วนๆ = Lv ${lvAt(cum)} ตามเส้นเป้า (S2) • Lv20 ที่เส้นเป้า = ชม.ที่ ${gh(20).toFixed(0)} → ต้องเติมอีก ${(gh(20) - cum).toFixed(1)} ชม. จากเควส/ปราบซ้ำ/ตาย/ล่าบอสรายสัปดาห์ ถ้าอยากให้ Lv20 ถึงพร้อมชั้น 100 ต้องคูณ XP ≈ ${(S.xpFor(20, 'farm') / xpAt(cum)).toFixed(2)}× (S1) → Lv20 ที่ ${cum.toFixed(1)} ชม. ซึ่งเร็วกว่าอาชีพอื่น`);
  // ---- ดรอป ----
  console.log('\n--- 6) ตารางดรอปต่ออาณาจักร (ดูรายละเอียดต่อชั้นใน JSON) ---');
  console.log('อ. | ชิ้นส่วน/อาณาจักร (ธรรมดา เทียบเท่า) | ชิ้นต่อชั้นปกติ | มูลค่าชิ้นส่วนรวม | หีบรวม(หน่วย→เหรียญ) | บอส: ชิ้น(×25)=เหรียญ + หีบ 4 หน่วย=เหรียญ');
  for (let r = 1; r <= 10; r++) { const x = R2[r], FF = Tk(r), nf = FF.filter(y => !isCampF(y)); const pcN = nf.reduce((a, y) => a + y.kl.norm * 1 + y.kl.elite * 3, 0) / nf.length; console.log(`${pad(r, 2)} | ${pad(f0(x.pcs), 6)} | ${pad(pcN.toFixed(0), 4)} | ${pad(f0(x.pcs * x.price), 7)} | ${pad(f0(x.units * x.chestU), 6)} (${x.units.toFixed(1)}×${x.chestU}) | ${pad(D.piece.boss, 3)}×${pad(x.price, 4)}=${pad(f0(D.piece.boss * x.price), 6)} + ${pad(f0(4 * x.chestU), 5)} • มินิ ${pad(D.piece.mini, 2)}×${x.price}=${pad(f0(D.piece.mini * x.price), 5)} + หีบ 2 หน่วย ${pad(f0(2 * x.chestU), 5)}`); }
  console.log('บอสประจำ อ.1–9 ตก: แก่นบอส 1 (ครั้งแรก ผูกตัว) + เศษแสง 1 (ครั้งแรก ผูกตัว) + เครื่องราง 1 (ครั้งแรก เลือกสวม) + ชิ้นแต่งตัว 1 (ครั้งแรก) • ปราบซ้ำ: ชิ้นส่วน/หีบตามตาราง (ในกฎซ้ำ ×0.5 เกิน 3 ครั้ง/วัน) + เศษแก่น + ชิ้นแต่งตัวตามโอกาส • บอส 100: ตราผู้พิชิต + มงกุฎแสง (ไม่มีแก่น/เศษแสง)');
  console.log('\n--- 6.1 ปราบบอสซ้ำเพื่อเศษแก่น (4 เศษ = 1 แก่น) • รอบปราบซ้ำ = วาปไปค่ายชั้น x5 แล้วทำชั้น x6–x9 + บอส (เดี่ยว) ---');
  const runT = r => { let t = 0; for (let k = 6; k <= 10; k++) t += F1[(r - 1) * 10 + k - 1].t; return t; };
  console.log('อ. | เวลารอบ(นาที) | รายได้รอบ(เหรียญ ก่อนสึก) | รายได้/ชม.รอบ เทียบเฉลี่ยอาณาจักร | ชม./แก่น เมื่อเศษ/ครั้ง = 1 / 2 / 3 | % ของเวลาเล่นที่หมดไปกับฟาร์มแก่น ถ้าต้องใช้ 1 แก่น/10 ชม. ที่ 2 / 3 เศษต่อครั้ง');
  for (let r = 1; r <= 9; r++) { const x = R2[r]; let inc = 0; for (let k = 6; k <= 10; k++) { const y = F1[(r - 1) * 10 + k - 1]; inc += (y.kl.norm + y.kl.elite * 3 + y.kl.mini * 8 + y.kl.boss * 25) * x.price + CHEST_U(y) * x.chestU; } const rt = runT(r), ratio = (inc / (rt / 3600)) / ((x.pcs * x.price + x.units * x.chestU) / x.T);
    console.log(`${pad(r, 2)} | ${pad(mn(rt), 6)} | ${pad(f0(inc), 7)} | ${pad(f0(inc / (rt / 3600)), 7)} (${pad(pct(ratio), 4)}) | ${[1, 2, 3].map(p => pad((4 / p * rt / 3600).toFixed(2), 5)).join(' ')} | ${pad(pct(4 / 2 * rt / 3600 / 10), 4)} / ${pad(pct(4 / 3 * rt / 3600 / 10), 4)}`); }
  console.log('ข้อเสนอ: เศษ 2 ชิ้น/ครั้งที่ปราบซ้ำครั้งแรกของวัน (ครั้งถัดไปในวันเดียวกัน 0.5 ชิ้น) ผูกบัญชี ขายไม่ได้ → 2 ครั้ง = 1 แก่น • ถ้าเศษ 1 ชิ้น/ครั้ง ต้องปราบ 4 รอบ/แก่น = 2.6–3.3 ชม./แก่นที่ อ.4+ ซึ่งเยอะเกิน • ความต้องการแก่นต่อชม.ขึ้นกับสูตร WP-30 (ถ้าทุกอาวุธ+เกราะที่ตีใหม่กินแก่น = ~2 แก่น/10 ชม. ต้องเพิ่มเศษ/ครั้งเป็น ≥3) ยังไม่ยืนยัน • ตราเงาสัปดาห์ละ 1 ต่อบอส');
  // ---- โทษตาย ----
  console.log('\n--- 7) โทษตาย (durLoss 100% + repairMul ข้อเสนอรอบ 1) และเวลาที่เสียต่อการตาย ---');
  console.log('อ. | ซ่อมตาย(เหรียญ n=0) | %ของรายได้ B/ชม. | เวลาเสียถ้าตายเฉลี่ยชั้นปกติ(นาที) | ต่อการตายที่ชั้นแรกของช่วง..ชั้นท้ายของช่วง(นาที)');
  const deathLoss = {};
  if (P.r3) for (let f = 1; f <= 100; f++) deathLoss[f] = deathLossR3(f, F1, true);
  else for (let f = 1; f <= 100; f++) { const k = kk(f), base = k >= 6 ? 5 : 1, cleared = Math.max(0, k - base - (k === 10 ? 0 : 0)); deathLoss[f] = (cleared * 45 + 0.5 * F1[f - 1].t); }
  for (let r = 1; r <= 10; r++) { const c = deathCost(r, 1, 0, REPMUL[r - 1]), B = D.income * farmerReal(r), ids = []; for (let k = 2; k <= 10; k++) if (k !== 5) ids.push((r - 1) * 10 + k); const avg = ids.reduce((a, f) => a + deathLoss[f], 0) / ids.length / 60; console.log(`${pad(r, 2)} | ${pad(f0(c), 6)} | ${pad(pct(c / B), 4)} | ${pad(avg.toFixed(1), 5)} | ${(deathLoss[(r - 1) * 10 + 2] / 60).toFixed(1)}..${(deathLoss[(r - 1) * 10 + 10] / 60).toFixed(1)}`); }
  console.log('สมมติ: ตาย = กลับค่ายล่าสุด (ชั้น x1 หรือ x5 ที่มีค่าย; อ.10 ชั้น 92–94 กลับ 91, 96–99 กลับ 95) ชั้นที่ผ่านแล้วเดินผ่านชั้นละ 45 วิ ชั้นที่ตายรีเซ็ตเสียเฉลี่ยครึ่งชั้น • การตายหนึ่งครั้งเสียเวลา ~4–12 นาที (อ.10 ~8–12) นอกจากเงินซ่อม ซึ่งเป็นโทษหลักที่ผู้เล่นรู้สึกเมื่อค่าซ่อมถูกจำกัดไว้ ~10%');
  // ---- JSON ----
  const rows = F1.map((a, i) => { const f = a.f, r = a.r; return { f, r, k: a.k, kind: kindOf(a), seals: a.ss.map(s => { const o = { t: s.ty }; if (s.ty === 'C') { o.waves = s.q; o.size = s.act; } else if (['A', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'S'].includes(s.ty)) o.n = s.act; if (s.add) o.adds = s.add; if (s.hz) o.hazard = true; if (s.ty === 'G') o.mobs = s.nG; return o; }), tSolo: Math.round(a.t), t2: Math.round(F2[i].t), t4: Math.round(F4[i].t), kills: { norm: Math.round(a.kl.norm), elite: +a.kl.elite.toFixed(1), mini: a.kl.mini, boss: a.kl.boss }, pieces: +(a.kl.norm + a.kl.elite * 3 + a.kl.mini * 8 + a.kl.boss * 25).toFixed(1), chestUnits: +CHEST_U(a).toFixed(2), offerItems: a.items, deathLossSec: Math.round(deathLoss[f]) }; });
  const ctx = { R2, F1, F2, F4, XPK, Tk, h, mn, deathLoss, rows, REPMUL, oldPrice, quest };
  const ex = P.hook ? P.hook(ctx) : {};
  const out = { _note: (P.r3 ? 'ร่าง DG_FLOORS จากซิมรอบ 3 (tools/dungeonsim.js floors3 --json) แทนรอบ 2 • ผนึก 97 มี Ks = ค่ายเล็กท้ายชั้น • tm = ตัวคูณระยะเดินต่ออาณาจักร (ใช้กับ tSolo แล้ว)' : 'ร่าง DG_FLOORS จากซิมรอบ 2 (tools/dungeonsim.js floors --json)') + ' • ตัวเลขทุกตัวเป็นสมมติฐานที่ยังไม่วัดจริง • seals.t = ชนิดผนึก n = จำนวนตัว/ขั้น/วินาที (A/L/E/S=ตัว D/G=วินาที F/I=ขั้น H=ชิ้น) C: waves x size • adds=ลูกสมุนที่ไม่ตกของ • hazard=เวลา ×1.2 • tSolo/t2/t4 วินาทีคาดการณ์ • chestUnits คูณ kingdoms[].chestCoins', params: { bossMul: [P.mult.boss, P.mult.final], hpPartyPerExtra: P.hpParty, partyBonus: P.r3 ? 'ดู kingdoms[].partyLootMul (ตัวคูณของตกต่อคนรายอาณาจักร ×ขนาดปาร์ตี้)' : { 2: .10, 3: .13, 4: .15 }, countMul: P.cm, lengthMul: P.sm, travelMul: P.tm, partyModel: P.r3 ? { splitSeals: P.splitSet, minSquad: P.minSq, parLoss: P.parLoss, regroupSec: P.regroup, walkPar: P.walkPar, gScale: P.gScale } : undefined, repairMul: REPMUL }, kingdoms: R.map(r => ({ r, hoursSolo: +R2[r].T.toFixed(2), piecePrice: P.recPrice ? P.recPrice[r - 1] : R2[r].price, piecePriceRefit105: P.recPrice ? R2[r].price : undefined, partyLootMul: P.r3 ? { 2: +(1 + R2[r].bonusR[2]).toFixed(2), 3: +(1 + R2[r].bonusR[3]).toFixed(2), 4: +(1 + R2[r].bonusR[4]).toFixed(2) } : undefined, chestCoins: R2[r].chestU, questSetCoins: R2[r].q, xp: { norm: XPK[r], elite: XPK[r] * 3, mini: XPK[r] * 8, boss: XPK[r] * 20 } })), floors: rows }; Object.assign(out, ex);
  if (P.r3 ? json : false) { const fs = require('fs'); fs.writeFileSync(require('path').join(__dirname, 'dungeon-floors.draft.json'), JSON.stringify(out, null, 1));
  console.log('\nเขียน tools/dungeon-floors.draft.json แล้ว (' + rows.length + ' แถว)'); } else console.log('\n(ไม่เขียน JSON: ' + (P.r3 ? 'ใส่ --json เพื่อเขียน tools/dungeon-floors.draft.json' : 'รอบ 2 ปิดการเขียนทับแล้ว ใช้ floors3 --json') + ')');
  return ctx;
}
/*ROUND2END*/

/*ROUND3*/
// ========== รอบ 3: ตามการตัดสินใจของเจ้าของรอบ 2 (docs/plans/dungeon-100-floors.md ข้อ 7) ==========
// node tools/dungeonsim.js floors3 [--json]   (เขียนทับ tools/dungeon-floors.draft.json เฉพาะเมื่อใส่ --json)
// (1) จำนวนตัว ≤ ×1.5 (cm) ชดเชยด้วย sm (ปริศนา/กลไก/รอด/บุกเร็ว) + tm (ระยะเดิน) เป้า 11–12 ชม. (2) ปาร์ตี้แยกทีมทำผนึกขนาน (3) ค่ายเล็กท้ายชั้น 97 (4) ราคาชิ้นส่วนรับไว้ ตรวจกับ WP-30
const T3 = [0.62, 0.66, 0.76, 1.0, 1.2, 1.25, 1.27, 1.40, 1.42, 2.12]; // เป้าชม./อาณาจักร (เดี่ยว) รวม ≈ 11.8 • อ.1 ชั้นปกติ ~4–5 นาที • อ.10 ~15–16 นาที
function setupR3() {
  P.r3 = true; P.par = true; P.T3 = T3; P.cm = Array(10).fill(1.5); P.walkPar = 0.10; P.gScale = 0.5; P.hpParty = 0.6; // HP ปาร์ตี้ กลับมาที่ 0.6/คนตามแผนเดิม (รอบ 2 ใช้ 0.75)
  if (!FLSEAL[96].includes('Ks')) FLSEAL[96].push('Ks');
  setupR2(); P.sm = Array(10).fill(1); P.tm = Array(10).fill(1);
  const hrs = r => { let t = 0; for (let k = 1; k <= 10; k++) t += floorOf((r - 1) * 10 + k, 1).t; return t / 3600; };
  for (let r = 1; r <= 10; r++) { // หา sm (ก้าว 0.1 ≤2.4) tm (ก้าว 0.05 ≤1.8) ที่ได้เวลาเป้า ใกล้ค่ากลาง sm 1.8 tm 1.25 (ไม่ให้เดินนานหรือปริศนายาวเกินไปอย่างใดอย่างหนึ่ง)
    let best = null;
    for (let sm = 1; sm <= 2.41; sm += 0.1) for (let tm = 1; tm <= 1.81; tm += 0.05) { P.sm[r - 1] = sm; P.tm[r - 1] = tm; if (Math.abs(hrs(r) - T3[r - 1]) > 0.02) continue; const pen = Math.pow(sm - 1.8, 2) + 4 * Math.pow(tm - 1.25, 2); if (!best || pen < best.pen) best = { sm, tm, pen }; }
    if (!best) { let m = 9, bm = null; for (let sm = 1; sm <= 2.41; sm += 0.1) for (let tm = 1; tm <= 1.81; tm += 0.05) { P.sm[r - 1] = sm; P.tm[r - 1] = tm; const e = Math.abs(hrs(r) - T3[r - 1]); if (e < m) { m = e; bm = { sm, tm }; } } best = bm; console.log('(เตือน) อ.' + r + ' หา sm/tm ให้ตรงเป้าไม่ได้ ใช้ค่าใกล้สุด'); }
    P.sm[r - 1] = +best.sm.toFixed(2); P.tm[r - 1] = +best.tm.toFixed(2);
  }
}
const BAR_STD = r => { const o = S.ORES[S.ORE_ORDER[r - 1]]; return 3 * o.sell + Math.round(0.15 * 3 * o.sell); }; // WP-30: std = 3×แร่ + ค่าเตา 15%
const BAR_SHOP = r => Math.round(BAR_STD(r) * 1.5);
const gearP = t => D.gearMul * S.toolPrice('pick', t);
const minerReal = r => { const lv = 2 * r; return (L.mine(Math.min(20, lv - 1)).coin + L.mine(Math.min(20, lv)).coin) / 2 * D.eff; };
const oresPerH = r => { const lv = 2 * r; return (L.mine(Math.min(20, lv - 1)).ores + L.mine(Math.min(20, lv)).ores) / 2 * D.eff; };
function hookR3(c) {
  const { R2, F1, F2, F4, Tk, h, mn } = c, ex = {}, ACC = c.oldPrice;
  const sealMon = s => s.kl.norm + s.kl.elite + s.kl.mini + s.add;
  // ---------- ก) ความเหนื่อย ----------
  console.log('\n=== ก) ความเหนื่อย/ไม่น่าเบื่อ (เดี่ยว) ===');
  console.log('อ. | ชั้นปกติ นาที เฉลี่ย (min–max) | ผนึกสู้ (A/E/B/C/L) ตัว/10นาที สูงสุด (เฉลี่ย) | ตัวพร้อมกันสูงสุด | ผนึกยาวสุด(นาที) | ส่วนเวลา: สู้ / ปริศนา-กลไก-รอด-เซ่น / ค่าย / เดิน | ช่วงไม่มีค่ายยาวสุด(นาที)');
  const fatigue = {};
  for (let r = 1; r <= 10; r++) {
    const FF = Tk(r), norm = FF.filter(x => !isCampF(x)); let peak = 0, rs = [], longest = 0, conc = 0, tc = { fight: 0, puz: 0, camp: 0, walk: 0 };
    FF.forEach(x => { x.ss.forEach(s => { const m = sealMon(s); if (['A', 'E', 'B', 'EB', 'C', 'L'].includes(s.ty) && m > 0) { const rate = m / (s.t / 600); peak = Math.max(peak, rate); rs.push(rate); } if (!['K', 'Kt', 'Kv', 'Kb', 'Ks'].includes(s.ty)) longest = Math.max(longest, s.t / 60); if (s.ty === 'C') conc = Math.max(conc, s.act); if (s.ty === 'A') conc = Math.max(conc, Math.min(18, s.act));
        const g = ['A', 'B', 'EB', 'E', 'S', 'C', 'L', 'M', 'X', 'Z', 'G'].includes(s.ty) ? 'fight' : ['F', 'I', 'D', 'H'].includes(s.ty) ? 'puz' : 'camp'; tc[g] += s.t; });
      tc.walk += x.t - x.ss.reduce((a, s) => a + s.t, 0); });
    const T = sumT(FF), nn = norm.map(x => x.t / 60);
    // ช่วงไม่มีค่าย
    let streak = 0, mx = 0; FF.forEach(x => { if (isCampF(x) && /^(K|Kt|Kv|Kb|M)$/.test(x.toks[0])) { mx = Math.max(mx, streak); streak = 0; } else streak += x.t; if (x.f === 97 && P.r3) { mx = Math.max(mx, streak); streak = 0; } }); mx = Math.max(mx, streak);
    fatigue[r] = { peak, avgRate: rs.reduce((a, b) => a + b, 0) / rs.length, longest, conc, mx: mx / 60, mean: nn.reduce((a, b) => a + b, 0) / nn.length };
    console.log(`${pad(r, 2)} | ${nn.reduce((a, b) => a + b, 0) / nn.length >= 0 ? (nn.reduce((a, b) => a + b, 0) / nn.length).toFixed(1) : ''} (${Math.min(...nn).toFixed(1)}–${Math.max(...nn).toFixed(1)}) | ${peak.toFixed(1)} (${fatigue[r].avgRate.toFixed(1)}) | ${conc} | ${longest.toFixed(1)} | ${pct(tc.fight / T)} / ${pct(tc.puz / T)} / ${pct(tc.camp / T)} / ${pct(tc.walk / T)} | ${(mx / 60).toFixed(1)}`);
  }
  console.log('หมายเหตุ ตัว/10นาที นับทุกตัวที่ต้องปราบในผนึกนั้น (รวมลูกสมุน) ÷ เวลาของผนึก (รวมเดินหาและรอระลอก) • ตัวพร้อมกัน = ขนาดระลอก C หรือกลุ่ม A ที่ถูกจำกัด ≤18 • สู้ = ผนึกที่ตีเป็นหลัก (A B EB E S C L M X Z G)');
  ex.fatigue = R.map(r => ({ r, normalFloorMin: +fatigue[r].mean.toFixed(1), peakKillsPer10min: +fatigue[r].peak.toFixed(1), avgKillsPer10min: +fatigue[r].avgRate.toFixed(1), maxConcurrent: fatigue[r].conc, longestSealMin: +fatigue[r].longest.toFixed(1), longestNoCampMin: +(fatigue[r].mx).toFixed(1) }));
  // ---------- ข) ราคาชิ้นส่วน vs แร่/แท่ง ----------
  console.log('\n=== ข) ราคาชิ้นส่วนที่รับไว้ (4/8/14/17/20/28/35/43/38/59) เทียบแร่/แท่ง WP-30 และรายได้ 3 อาชีพ ===');
  console.log('อ. | แร่ (ขาย) | แท่ง std (ร้าน) | ราคารับไว้ | ÷แร่ ÷std | ราคาที่ให้ 105% (ซิมรอบ 3) | ชิ้น/ชม. | ชาวนา | นักขุด (ปกติ) / นักขุดหลอมแท่ง +3% | นักสู้เดี่ยว: ราคารับไว้ / ราคาใหม่ (%ชาวนา) | ÷นักขุด รับไว้ / ใหม่ | ปาร์ตี้ 4 คน รับไว้ / ใหม่ (%ชาวนา)');
  const bk = {};
  for (let r = 1; r <= 10; r++) {
    const x = R2[r], o = S.ORES[S.ORE_ORDER[r - 1]], mr = minerReal(r), FF = Tk(r), Tt = x.T, k = (n, pr) => { const Tn = h(sumT(allFloors(n).slice((r - 1) * 10, r * 10))); const bonus = x.bonusR[n] !== undefined ? x.bonusR[n] : 0; return ((x.pcs * pr * (1 + bonus) + x.units * x.chestU) / Tn + x.q / D.sessionH) * (1 - D.wearShare.weapon - D.wearShare.armor) / x.fm; };
    const acc = ACC[r - 1], nowSolo = k(1, acc), newSolo = x.soloNew, a4 = k(4, acc), n4 = x.p4;
    const minerSmelt = 1 + 0.03; // WP-30 E0: นักขุดหลอมได้เพิ่ม ≤ +1–3% [สมมติ] (คุ้มทุน m=1.075; ตลาดกดราคาใกล้คุ้มทุน)
    bk[r] = { acc, price: x.price, nowSolo, newSolo, a4, n4, mr, fm: x.fm };
    console.log(`${pad(r, 2)} | ${S.ORE_ORDER[r - 1].padEnd(9)}${pad(o.sell, 3)} | ${pad(BAR_STD(r), 4)} (${pad(BAR_SHOP(r), 4)}) | ${pad(acc, 4)} | ${(acc / o.sell).toFixed(2)}× ${(acc / BAR_STD(r)).toFixed(2)}× | ${pad(x.price, 4)} | ${pad(f0(x.pcs / Tt), 5)} | ${pad(f0(x.fm), 6)} | ${pad(f0(mr), 6)} (${pct(mr / x.fm)}) ${pct(mr * minerSmelt / x.fm)} | ${pad(pct(nowSolo), 4)} / ${pad(pct(newSolo), 4)} | ${pct(nowSolo * x.fm / mr)} / ${pct(newSolo * x.fm / mr)} | ${pad(pct(a4), 4)} / ${pad(pct(n4), 4)}`);
  }
  console.log('ผลตรวจ: ราคารับไว้ → รายได้เดี่ยว ' + pct(Math.min(...R.map(r => bk[r].nowSolo))) + '–' + pct(Math.max(...R.map(r => bk[r].nowSolo))) + ' ของชาวนา (เกณฑ์ ≤110%, ต่ำกว่า 95% = ไม่มีใครมาสู้) • ปาร์ตี้ 4 คน ' + pct(Math.min(...R.map(r => bk[r].a4))) + '–' + pct(Math.max(...R.map(r => bk[r].a4))) + ' (≤125%)');
  console.log('ราคาที่ให้ ≈105% ในซิมรอบ 3 = ' + R.map(r => R2[r].price).join(', ') + ' • อัตราส่วนราคาใหม่/รับไว้ = ' + R.map(r => (R2[r].price / ACC[r - 1]).toFixed(2)).join(' '));
  const REC = R.map(r => (bk[r].nowSolo < 0.97 || bk[r].nowSolo > 1.08) ? R2[r].price : ACC[r - 1]); // แก้เฉพาะอาณาจักรที่ราคารับไว้ให้รายได้เดี่ยวนอก 97–108%
  console.log('ราคาที่แนะนำ (แก้เฉพาะที่นอก 97–108%) = ' + REC.join(', ') + ' → เดี่ยว ' + R.map(r => pct(((x => { const Tn = h(sumT(allFloors(1).slice((r - 1) * 10, r * 10))); return ((x.pcs * REC[r - 1] + x.units * x.chestU) / Tn + x.q / D.sessionH) * (1 - D.wearShare.weapon - D.wearShare.armor) / x.fm; })(R2[r])))).join(' ') + ' • ปาร์ตี้ 4 คน (ตัวคูณของตกรายอาณาจักร) ' + R.map(r => pct(((x => { const Tn = h(sumT(allFloors(4).slice((r - 1) * 10, r * 10))); return ((x.pcs * REC[r - 1] * (1 + x.bonusR[4]) + x.units * x.chestU) / Tn + x.q / D.sessionH) * (1 - D.wearShare.weapon - D.wearShare.armor) / x.fm; })(R2[r])))).join(' '));
  ex.recommendedPieceTable = REC; P.recPrice = REC;
  ex.priceCheck = R.map(r => ({ r, ore: S.ORE_ORDER[r - 1], oreSell: S.ORES[S.ORE_ORDER[r - 1]].sell, barStd: BAR_STD(r), accepted: ACC[r - 1], refit105: R2[r].price, soloPctFarmerAtAccepted: +bk[r].nowSolo.toFixed(3), soloPctFarmerAtRefit: +bk[r].newSolo.toFixed(3), party4PctAtAccepted: +bk[r].a4.toFixed(3), party4PctAtRefit: +bk[r].n4.toFixed(3) }));
  // ---------- ค) แก่นบอส/เศษแก่น/เศษแสง vs สูตรตีเหล็ก WP-30 ----------
  console.log('\n=== ค) แก่นบอส 9 ชนิด + เศษแก่น + เศษแสง เทียบสูตรตีเหล็ก (สมมติสูตร: เหรียญ+แท่ง = ราคาเดิม P_t ส่วนแท่ง floor(0.25×P÷ราคาร้านแท่ง) ของแร่ระดับ t + แก่น) ===');
  const runMin = r => { let t = 0; for (let k = 6; k <= 10; k++) t += F1[(r - 1) * 10 + k - 1].t; return t / 60; }, run4 = r => { let t = 0; for (let k = 6; k <= 10; k++) t += F4[(r - 1) * 10 + k - 1].t; return t / 60; };
  console.log('ระดับ t (ได้จากบอส t-1) | ราคาอาวุธ=เกราะ P_t | แท่ง/ชิ้น | ชุด(อาวุธ+เกราะ)=แร่กี่ก้อน | ชม.ขุดแร่ (ซัพพลาย 50% ของแร่ที่ขุดเป็นชนิดนั้น) | รอบปราบบอส t-1: เดี่ยว/4คน นาที | ชิ้นที่ตีใหม่/10ชม. (สึกคิด 12% ของรายได้ ÷ (2P)) | %เวลาที่ต้องปราบซ้ำเพื่อเศษ ที่ 4 / 2 / 1 เศษต่อชิ้น (2 เศษ/รอบแรกของวัน)');
  const coreRows = [];
  for (let t = 2; t <= 10; t++) {
    const P_t = gearP(t), bars = Math.floor(0.25 * P_t / BAR_SHOP(t)), set = 2 * bars, ore = set * 3, oh = ore / (oresPerH(t) * 0.5) , G = D.income * farmerReal(t) / (1 - D.wearShare.weapon - D.wearShare.armor), items10 = (D.wearShare.weapon + D.wearShare.armor) * G * 10 / (2 * P_t), rmin = runMin(t - 1), r4 = run4(t - 1);
    const pctT = sh => items10 * sh / 2 * rmin / 60 / 10;
    coreRows.push({ tier: t, price: Math.round(P_t), barsPerItem: bars, oreForSet: ore, mineHours: +oh.toFixed(2), runMinSolo: +rmin.toFixed(1), runMin4p: +r4.toFixed(1), itemsPer10h: +items10.toFixed(2), rerunPct: { s4: +pctT(4).toFixed(3), s2: +pctT(2).toFixed(3), s1: +pctT(1).toFixed(3) } });
    console.log(`${pad('t=' + t + ' (บอส ' + (t - 1) * 10 + ')', 18)} | ${pad(f0(P_t), 6)} | ${pad(bars, 3)} (${S.ORE_ORDER[t - 1]}) | ${pad(ore, 4)} | ${pad(oh.toFixed(2), 5)} | ${pad(rmin.toFixed(1), 5)} / ${pad(r4.toFixed(1), 5)} | ${pad(items10.toFixed(2), 5)} | ${pad(pct(pctT(4)), 4)} / ${pad(pct(pctT(2)), 4)} / ${pad(pct(pctT(1)), 4)}`);
  }
  const catchUp = [1, 2, 3, 4, 5, 6, 7, 8, 9].reduce((a, r) => a + runMin(r), 0), catchUp4 = [1, 2, 3, 4, 5, 6, 7, 8, 9].reduce((a, r) => a + run4(r), 0);
  console.log(`เศษแสง 9 ชิ้น: ต้นทุนเหรียญ 0 (ผูกตัว ได้ตอนปราบบอสครั้งแรกอยู่แล้ว) • คนที่ตามเพื่อนทีหลังต้องปราบบอส 1–9 เองครบ: ชั้น 6–10 ของแต่ละอาณาจักรรวม ${(catchUp / 60).toFixed(1)} ชม. เดี่ยว / ${(catchUp4 / 60).toFixed(1)} ชม. กับปาร์ตี้ 4 คน (ไม่รวมผนึกชั้น 1–5 ซึ่งต้องทำใหม่เพราะประตูล็อกผนึกต่อคน)`);
  console.log('แก่นบอส 1 อัน/ระดับ (ได้ฟรีจากบอสครั้งแรก ผูกตัว): ปลดระดับทั้งอาวุธและเกราะ = ข้อเสนอ (ปลดถาวร ไม่ถูกใช้ซ้ำ) → ต้นทุนเหรียญเพิ่ม 0 ไม่แตะสมการ "เหรียญ+แท่ง = ราคาเดิม" ของ WP-30 (H1 ส่วนวัสดุ ≤0.25 ผ่านเพราะแก่นไม่มีราคา ไม่ใช่เครดิตวัสดุ)');
  console.log('ถ้าสูตรตีกินเศษแก่นทุกชิ้น: ที่ 2 เศษ/ชิ้น ใช้เวลาปราบซ้ำราว 1–3% (อ.ลึก) ถึงหลายสิบ % (อ.ต้น) ของเวลาเล่น → ดูคอลัมน์สุดท้าย');
  ex.cores = { assumption: 'ราคาอาวุธ=เกราะ P_t = 1.5×toolPrice(pick,t) • แท่ง floor(0.25×P÷ร้าน) • สึก 12% ของรายได้ ÷ (2P) ชิ้น/ชม.', tiers: coreRows, catchUpHoursSolo: +(catchUp / 60).toFixed(1), catchUpHours4p: +(catchUp4 / 60).toFixed(1) };
  // ---------- ง) ค่ายชั้น 97/95 ----------
  console.log('\n=== ง) ค่ายชั้น 95 และ 97: ความเสี่ยงตาย (ค่าซ่อม + เวลา) อ.10 ===');
  const dl = (f, c97) => deathLossR3(f, F1, c97), rm10 = deathCost(10, 1, 0, REPMUL10), B10 = D.income * farmerReal(10);
  console.log(`ซ่อมตาย อ.10 (durLoss 100% ×repairMul ${REPMUL10}) = ${f0(rm10)} เหรียญ = ${pct(rm10 / B10)} ของรายได้/ชม. (เท่ากันทุกชั้น ไม่ขึ้นกับค่าย)`);
  console.log('ชั้น | เวลาชั้น(นาที) | เวลาที่เสียต่อการตาย (นาที): ไม่มีค่าย 95 ไม่มีค่าย 97 → มี 95 ไม่มี 97 → มี 95+97 | ประหยัดจาก 97 (นาที)');
  const noCamp = (f) => { const saved = campFloors; return null; };
  const lossNo95 = f => { const cs = campFloors(false).filter(c => c !== 95 && c < f); const cc = cs[cs.length - 1]; return Math.max(0, f - cc - 1) * passSec(10) + 0.5 * F1[f - 1].t + 15; };
  for (let f = 92; f <= 99; f++) console.log(`${pad(f, 4)} | ${pad(mn(F1[f - 1].t), 6)} | ${pad((lossNo95(f) / 60).toFixed(1), 6)} ${pad((dl(f, false) / 60).toFixed(1), 6)} ${pad((dl(f, true) / 60).toFixed(1), 6)} | ${pad(((dl(f, false) - dl(f, true)) / 60).toFixed(1), 5)}`);
  // ห่วงโซ่ตาย: E_s = [(1-q)(t_s + E_{s+1}) + q(0.5 t_s + 15 + pass)]/(1-q), q = 1-(1-p)^(t_s/10นาที)
  const chain = (p, c95, c97) => { const cs = (() => { const a = campFloors(c97).filter(f => f >= 91); return c95 ? a : a.filter(f => f !== 95); })(); let E = 0, dead = 0; const w = {}; for (let s = 100; s >= 92; s--) { const t = F1[s - 1].t, q = 1 - Math.pow(1 - p, t / 600), cc = cs.filter(c => c < s).pop() || 91, pass = Math.max(0, s - cc - 1) * passSec(10); const En = (1 - q) * (t + E) + q * (0.5 * t + 15 + pass); E = En / (1 - q); dead += q / (1 - q) * 1; } return { E, dead }; };
  console.log('\nเดินจาก 92 → ผ่านบอส 100 (เดี่ยว) คาดการณ์ ที่ความเสี่ยงตายต่อ 10 นาทีของการสู้ p [สมมติ] (นาทีรวม / จำนวนครั้งตายเฉลี่ย / ค่าซ่อมรวม):');
  const chainRows = [];
  for (const p of [0.02, 0.04, 0.07, 0.10]) { const a = chain(p, false, false), b = chain(p, true, false), cc = chain(p, true, true); chainRows.push({ p, noCamps: { min: +(a.E / 60).toFixed(1), deaths: +a.dead.toFixed(2) }, camp95: { min: +(b.E / 60).toFixed(1), deaths: +b.dead.toFixed(2) }, camp95_97: { min: +(cc.E / 60).toFixed(1), deaths: +cc.dead.toFixed(2) } });
    console.log(`  p=${pct(p)}: ไม่มี 95/97 ${(a.E / 60).toFixed(1)} นาที ตาย ${a.dead.toFixed(2)} ครั้ง ซ่อม ${f0(a.dead * rm10)} • มี 95 ${(b.E / 60).toFixed(1)} / ${b.dead.toFixed(2)} / ${f0(b.dead * rm10)} • มี 95+97 ${(cc.E / 60).toFixed(1)} / ${cc.dead.toFixed(2)} / ${f0(cc.dead * rm10)} • ค่าย 97 ลดเวลา ${((b.E - cc.E) / 60).toFixed(1)} นาที (${pct((b.E - cc.E) / b.E)})`); }
  console.log('หมายเหตุ ซิมนี้ลดเฉพาะ "เวลาเดินกลับ+ชั้นรีเซ็ต" (ผนึกที่ผ่านแล้วคงอยู่ เดินผ่านชั้นละ ' + passSec(10).toFixed(0) + ' วิ) โดยไม่คิดว่าค่ายช่วยกินยา/ซ่อมกลางทาง ซึ่งลดโอกาสตายเอง (ไม่ได้วัด) • ค่าซ่อมตายเท่ากันทุกกรณี (repairMul 0.11) ค่าย 97 ไม่ช่วยเรื่องเหรียญ ช่วยเรื่องเวลาและระยะ "ไม่มีเซฟ"');
  ex.campRisk = { repairCoinPerDeath: Math.round(rm10), repairPctOfHourlyIncome: +(rm10 / B10).toFixed(3), perFloorLossMin: [92, 93, 94, 95, 96, 97, 98, 99].map(f => ({ f, noCamp95: +(lossNo95(f) / 60).toFixed(1), camp95: +(dl(f, false) / 60).toFixed(1), camp95_97: +(dl(f, true) / 60).toFixed(1) })), chain: chainRows };
  // ---------- ปาร์ตี้ ----------
  console.log('\n=== ปาร์ตี้: เร็วกว่าเดี่ยวเท่าไร ===');
  let T1 = 0, T2 = 0, T4 = 0; for (let r = 1; r <= 10; r++) { T1 += sumT(Tk(r)); T2 += sumT(F2.slice((r - 1) * 10, r * 10)); T4 += sumT(F4.slice((r - 1) * 10, r * 10)); }
  const F3 = allFloors(3);
  console.log(`รวมถึงชั้น 100: เดี่ยว ${h(T1).toFixed(1)} ชม. • 2 คน ${h(T2).toFixed(1)} (${pct(T2 / T1)}) • 3 คน ${h(sumT(F3)).toFixed(1)} (${pct(sumT(F3) / T1)}) • 4 คน ${h(T4).toFixed(1)} (${pct(T4 / T1)}) → เร็วกว่าเดี่ยว 4 คน ${(100 - T4 / T1 * 100).toFixed(0)}% (เป้า 15–20%)`);
  const perK = R.map(r => sumT(F4.slice((r - 1) * 10, r * 10)) / sumT(Tk(r))); console.log('4 คน ÷ เดี่ยว รายอาณาจักร: ' + perK.map(v => pct(v)).join(' ') + ' (อ.1–3 มี 1 ผนึก/ชั้น แยกทีมไม่ได้ จึงเร็วขึ้นน้อย)');
  const runPar = fn => { const b = { pl: P.parLoss, rg: P.regroup, wp: P.walkPar, hp: D.hpParty, ms: P.minSq, ps: P.par }; fn(); const a = sumT(allFloors(1)), c2 = sumT(allFloors(2)), c4 = sumT(allFloors(4)); P.parLoss = b.pl; P.regroup = b.rg; P.walkPar = b.wp; D.hpParty = b.hp; P.minSq = b.ms; P.par = b.ps; return [c2 / a, c4 / a]; };
  const sens = {};
  for (const [nm, fn] of [['ค่าตั้งต้น', () => {}], ['ไม่แยกทีมเลย (par ปิด)', () => { P.par = false; }], ['แยกทีมแต่ walkPar 0 (ไม่ช่วยเดิน)', () => { P.walkPar = 0; }], ['walkPar 0.20', () => { P.walkPar = 0.2; }], ['parLoss 0.20 regroup 30 (ประสานงานแย่)', () => { P.parLoss = 0.2; P.regroup = 30; }], ['parLoss 0.05 regroup 10 (คล่อง)', () => { P.parLoss = 0.05; P.regroup = 10; }], ['hpParty 0.75 (ค่ารอบ 2)', () => { D.hpParty = 0.75; }], ['ทีมสู้ได้ 1 คน (minSq 1)', () => { P.minSq = 1; }]]) { const [a, b] = runPar(fn); sens[nm] = [a, b]; console.log(`  ${nm.padEnd(40)} 2 คน ${pct(a)} • 4 คน ${pct(b)}`); }
  ex.partySensitivity = Object.fromEntries(Object.entries(sens).map(([k, v]) => [k, { p2: +v[0].toFixed(3), p4: +v[1].toFixed(3) }]));
  ex.partyTotals = { soloH: +h(T1).toFixed(2), p2H: +h(T2).toFixed(2), p4H: +h(T4).toFixed(2) };
  return ex;
}
const REPMUL10 = 0.11;
function floors3() { setupR3(); P.hook = hookR3; return floors(); }
/*ROUND3END*/

let _q = null; function time_quiet() { if (_q) return _q; const log = console.log; console.log = () => {}; try { _q = time(); } finally { console.log = log; } return _q; }

const cmd = process.argv[2] || 'all';
if (cmd === 'death' || cmd === 'all') death();
if (cmd === 'time' || cmd === 'all') { if (cmd === 'all') console.log(''); time(); }
if (cmd === 'income' || cmd === 'all') { if (cmd === 'all') console.log(''); income(); }
if (cmd === 'table' || cmd === 'all') { if (cmd === 'all') console.log(''); table(); }
if (cmd === 'floors') floors();
if (cmd === 'floors3') floors3();
module.exports = { P, floorsCore, floorOf, sealOf, D, deathCost, floorSet, kingdomSec, bossSec, farmerReal };
