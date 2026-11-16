'use strict';
// WP-30 E0: จำลองเศรษฐกิจห่วงโซ่ผลิต (แร่→วัสดุ bar_* • ผัก→hay • เฟอร์นิเจอร์ชั้นดี) ตามแผน docs/plans/production-chain.md ก่อนลงโค้ด
// อ่านอย่างเดียว: ใช้ public/shared.js + tools/levelsim.js ตัวเดิม ไม่แก้ค่าใดในเกม • ตัวเลขห่วงโซ่ (BAR/GEAR_BARS/สูตรเฟอร์นิเจอร์) อยู่ในไฟล์นี้เพราะยังไม่มีใน shared.js
// ใช้: node tools/chainsim.js            → ทุกหัวข้อ
//      node tools/chainsim.js q1 q3      → เลือกหัวข้อ (q1 นักขุด/ส่วนวัสดุ • q2 ร้านวัสดุ+คืนทุน • q3 ปั๊มขายคืน • q4 hay • q5 ช่างไม้ • q6 ดีมานด์/ค่าเตา)
// สมมติฐานที่ "ไม่ได้วัดจริง" ติดป้าย [สมมติ] ในผลลัพธ์ • ข้อมูลจริงเรื่องจำนวนผู้เล่นต่อเลเวลไม่มีในเครื่อง (data/ ว่าง) จึงใช้ฉากสมมติ X = จำนวนครั้งซื้ออุปกรณ์ต่อระดับต่อวัน
const S = require('../public/shared.js'), L = require('./levelsim.js');
const EFF = L.M.EFF;
const want = process.argv.slice(2).filter(a => /^q\d$/.test(a)); // ตัวเลือกเพิ่ม: fp=2.5 (ตัวคูณราคาเฟอร์นิเจอร์ชั้นดี ค่าตั้งต้น 2.0)
const on = q => !want.length || want.includes(q);
const num = n => Math.round(n).toLocaleString('en-US');
const p0 = (a, b) => Math.round(a / b * 100);
const sims = L.simulate();
const coinOf = (sk, lv) => sims[sk][lv - 1].coin;

// ===== ตัวเลขร่างของ architect (ยังไม่อยู่ใน shared.js) =====
const BAR = { ore: 3, feePct: 0.15, shopMul: 1.5, tax: S.STALL.tax };
const GEAR_BARS = { share: 0.25, 8: [['jade', 0.6], ['emerald', 0.4]], 9: [['moonstone', 0.6], ['sapphire', 0.4]], 10: [['mythril', 0.6], ['opal', 0.4]] };
const barFee = k => Math.round(BAR.feePct * BAR.ore * S.ORES[k].sell);
const barStd = k => BAR.ore * S.ORES[k].sell + barFee(k);
const barShop = (k, mul = BAR.shopMul) => Math.round(barStd(k) * mul);
const LINES = { hoe: 'farm', can: 'farm', pail: 'animal', pan: 'cook', rod: 'fish', axe: 'wood', pick: 'mine' };
const price = (tool, t) => tool === 'can' ? S.CANS[t].price : S.TOOL_PRICE[tool][t];
const unlockLv = t => 2 * t - 1;
// จำนวนวัสดุต่อการซื้อ 1 ชิ้น = round(ราคา×share×สัดส่วน ÷ ราคาร้านวัสดุ) • เหรียญที่เหลือ = ราคา − Σ จำนวน×ราคาร้าน
function gearCost(P, t, share = GEAR_BARS.share, mul = BAR.shopMul) {
  const use = []; let credit = 0;
  for (const [k, fr] of GEAR_BARS[t]) { const sp = barShop(k, mul), n = Math.round(P * share * fr / sp); use.push({ k, n, sp }); credit += n * sp; }
  return { coin: P - credit, use, credit, stdVal: use.reduce((a, u) => a + u.n * barStd(u.k), 0) };
}
const allBuys = (share, mul) => { const out = []; for (const tool of Object.keys(LINES)) for (const t of [8, 9, 10]) { const P = price(tool, t); out.push(Object.assign({ tool, t, P }, gearCost(P, t, share, mul))); } return out; };

// แยกจำนวนแร่ต่อชนิดของนักขุดที่เลเวล lv (สัดส่วนชิ้นแร่ ตามตรรกะเดียวกับ levelsim.mine) คูณชิ้นต่อชม.รวมจาก levelsim
function mineSplit(lv) {
  const inv = {}; for (const [t, p] of Object.entries(S.PICKS)) if (!p.lv || p.lv <= lv) inv['pick_' + t] = 1;
  const fl = Math.min(Math.ceil(lv / 2), S.MINE.floors);
  const mix = Object.entries(S.floorMix(fl)).filter(([k]) => S.ORES[k].lv <= lv && S.mineHit(inv, k, 0)), sh = mix.reduce((a, [, w]) => a + w, 0) / 100;
  const per = {}; let tot = 0;
  for (const [k, w] of mix) { const f = w / 100 / sh; let q = 0; for (let i = 0; i < S.ORE_SIZES.length; i++) { const z = S.ORE_SIZES[i], p = f * S.sizeMix(fl)[i] / 100, n = (z.drop[0] + z.drop[1]) / 2, mh = S.mineHit(inv, k, i); q += p * (n + mh.extra); } per[k] = q; tot += q; }
  const m = sims.mine[lv - 1], out = {}; for (const k of Object.keys(per)) out[k] = m.pieces * per[k] / tot; // ชิ้น/ชม. (เพดาน)
  return out;
}
const row = (...c) => c.join('');

// ================= Q1: ส่วนวัสดุกับรายได้นักขุด =================
if (on('q1')) {
  console.log('=== Q1 รายได้นักขุดเมื่อขายวัสดุ (ที่ std×m หักภาษีแผง 7% และค่าเตา) เทียบแร่ขายร้าน ===');
  console.log('กำไรต่อวัสดุ 1 ชิ้นเทียบขายแร่ 3 ก้อนให้ร้าน = m×std×0.93 − ค่าเตา − 3×ราคาแร่ (ยังไม่คิดตลาดแร่อิ่มตัว = ประมาณแบบระวัง)');
  const ex = 'jade'; const gb = m => (m * barStd(ex) * (1 - BAR.tax) - barFee(ex) - BAR.ore * S.ORES[ex].sell) / (BAR.ore * S.ORES[ex].sell);
  console.log('  ตัวอย่างหยก: ' + [0.5, 1.0, 1.1, 1.25, 1.4].map(m => `m=${m}: ${(gb(m) * 100 >= 0 ? '+' : '') + (gb(m) * 100).toFixed(0)}% ของมูลค่าแร่`).join(' • ') + ' • m คุ้มทุน = ' + ((barFee(ex) + BAR.ore * S.ORES[ex].sell) / (barStd(ex) * (1 - BAR.tax))).toFixed(3) + '×std');
  console.log('\n(ก) เพดานบน: ถ้านักขุดหลอมแร่ชนิดนั้น "ทั้งหมด" (φ=100%) และขายหมดที่ m — เหรียญ/ชม. % ของชาวนา (ฐานตอนนี้ → m 1.1 / 1.25 / 1.4) [ดีมานด์ไม่จำกัด = ขอบบนที่ไม่เกิดจริง]');
  console.log('Lv ชั้น ฐาน%   แร่หลักที่ขุด   ชิ้น/ชม.   |  φ=100%: m1.1  m1.25  m1.4  | φ ที่ชนเพดาน 125% (m1.25 / m1.4)');
  for (let lv = 9; lv <= 20; lv++) {
    const sp = mineSplit(lv), I0 = coinOf('mine', lv), F = coinOf('farm', lv), top = Object.entries(sp).sort((a, b) => b[1] - a[1])[0], k = top[0], q = top[1];
    const d = m => q / BAR.ore * (m * barStd(k) * (1 - BAR.tax) - barFee(k) - BAR.ore * S.ORES[k].sell);
    const phi = m => { const dm = d(m); return dm <= 0 ? '-' : Math.min(9.99, Math.max(0, (1.25 * F - I0) / dm)).toFixed(2); };
    console.log(row(String(lv).padStart(2), '  ', String(Math.min(Math.ceil(lv / 2), 10)).padStart(2), '  ', (p0(I0, F) + '%').padStart(5), '   ', k.padEnd(10), num(q).padStart(7), '   |        ', [1.1, 1.25, 1.4].map(m => (p0(I0 + d(m), F) + '%').padStart(6)).join(' '), '   |   ', phi(1.25).padStart(5), '/', phi(1.4)));
  }
  // (ข) ดีมานด์จำกัด: ฉากสมมติ X ครั้งซื้ออุปกรณ์ต่อระดับ(8/9/10)ต่อวัน ทั้งเซิร์ฟเวอร์ กระจายเท่ากันทั้ง 7 สาย • นักขุดที่ผลิตวัสดุแบ่งดีมานด์เท่ากัน
  for (const share of [0.15, 0.25, 0.30]) {
    const B = allBuys(share, BAR.shopMul), perBars = {};
    for (const t of [8, 9, 10]) for (const [k] of GEAR_BARS[t]) perBars[k] = B.filter(b => b.t === t).reduce((a, b) => a + b.use.find(u => u.k === k).n, 0) / 7; // ชิ้น/การซื้อเฉลี่ย
    console.log(`\n(ข) ดีมานด์จำกัด share=${share} shopMul=${BAR.shopMul} • วัสดุเฉลี่ยต่อการซื้อ 1 ชิ้น: ` + Object.entries(perBars).map(([k, n]) => `${k} ${n.toFixed(1)}`).join(' ') + ' [สมมติ: นักขุด 60 นาที/วัน เล่นจริง EFF 0.5; ขายที่ m=1.25]');
    console.log('   ครั้งซื้อ/ระดับ/วัน X |  นักขุด 1 คนรับดีมานด์ทั้งหมด: รายได้เพิ่ม % ของรายได้นักขุดต่อวัน (หยก Lv15 / มูนสโตน Lv17 / มิทริล Lv19) | นักขุด 3 คนแบ่ง');
    for (const X of [2, 6, 20]) {
      const f = (k, M) => { const lv = S.ORES[k].lv, extra = X * perBars[k] / M * (1.25 * barStd(k) * (1 - BAR.tax) - barFee(k) - BAR.ore * S.ORES[k].sell); return extra / (coinOf('mine', lv) * EFF * 1.0) * 100; };
      console.log(`   X=${String(X).padStart(2)}               |  ` + ['jade', 'moonstone', 'mythril'].map(k => ('+' + f(k, 1).toFixed(1) + '%').padStart(7)).join(' ') + '                                      | ' + ['jade', 'moonstone', 'mythril'].map(k => ('+' + f(k, 3).toFixed(1) + '%').padStart(6)).join(' '));
    }
  }
}

if (on('q1')) {
  // X* = จำนวนครั้งซื้ออุปกรณ์/ระดับ/วัน ที่ทำให้นักขุดคนเดียวที่รับดีมานด์ทั้งหมดของวัสดุนั้นชน 125% ของชาวนา (นักขุดเลเวลเท่าแร่ ณ ชั้นที่ขุดแร่นั้นเป็นแร่หลัก ขาย m ที่กำหนด) • share 0.25 shopMul 1.5
  console.log('\n(ค) X* ที่นักขุดคนเดียว (รับดีมานด์ทั้งหมดของวัสดุชนิดนั้น) ชน 125% ของชาวนา [สมมติ: นักขุด 60 นาที/วัน; share .25 shopMul 1.5; ดีมานด์เฉพาะระดับที่ใช้วัสดุนั้น]');
  const B = allBuys(0.25, 1.5);
  for (const k of ['emerald', 'opal', 'sapphire', 'jade', 'moonstone', 'mythril']) {
    const lv = S.ORES[k].lv, t = Object.keys(GEAR_BARS).filter(x => x !== 'share').find(x => GEAR_BARS[x].some(([o]) => o === k)), per = B.filter(b => b.t === +t).reduce((a, b) => a + b.use.find(u => u.k === k).n, 0) / 7, I0 = coinOf('mine', lv), F = coinOf('farm', lv);
    const out = [1.1, 1.25, 1.4].map(m => { const g = m * barStd(k) * (1 - BAR.tax) - barFee(k) - BAR.ore * S.ORES[k].sell; if (g <= 0) return '  ไม่คุ้ม'; const room = 1.25 * F - I0; if (room <= 0) return 'เกินแล้ว'; const X = room * EFF / (per * g); return X > 99 ? '  >99' : X.toFixed(0).padStart(5); });
    console.log(`  ${k.padEnd(10)} (นักขุด Lv${String(lv).padStart(2)} ฐาน ${p0(I0, F)}%) ใช้ ${per.toFixed(1)} ชิ้น/การซื้อ ระดับ ${t}: X* ที่ m=1.1 / 1.25 / 1.4 = ${out.join(' / ')}`);
  }
}

// ================= Q2: ร้านวัสดุ × สัดส่วน: คืนทุน + ผลต่อผู้ซื้อ + เงินเฟ้อ =================
if (on('q2')) {
  console.log('\n=== Q2 shopMul × share: คืนทุนอุปกรณ์ 8–10 / ส่วนลดผู้ซื้อ / เงินที่ระบบสร้างเพิ่ม ===');
  console.log('คืนทุน(ชม.) = ราคา ÷ (เหรียญสุทธิ/ชม.ของอาชีพที่เลเวลปลด × EFF) แบบเดียวกับ levelsim • ทางร้าน = จ่ายเหรียญเท่าเดิมเป๊ะ (เติมวัสดุอัตโนมัติ) จึงเท่าวันนี้ทุกประการ');
  console.log('สาย    ระดับ Lv  ราคา   คืนทุนทางร้าน | ทางผู้เล่น(m=1.25, share .25, mul 1.5) ราคาจ่ายรวม%P  คืนทุน');
  let worst = 0;
  for (const tool of Object.keys(LINES)) for (const t of [8, 9, 10]) {
    const P = price(tool, t), lv = unlockLv(t), inc = coinOf(LINES[tool], lv) * EFF, g = gearCost(P, t, 0.25, 1.5), pay = g.coin + g.credit * 1.25 / 1.5;
    worst = Math.max(worst, P / inc);
    console.log(row(tool.padEnd(6), String(t).padStart(5), String(lv).padStart(4), num(P).padStart(7), (P / inc).toFixed(2).padStart(9), 'ชม.      |        ', (pay / P * 100).toFixed(1).padStart(18), '%   ', (pay / inc).toFixed(2).padStart(6), g.use.map(u => ` ${u.k}×${u.n}`).join('')));
  }
  console.log(`  คืนทุนทางร้านแย่สุด ${worst.toFixed(2)} ชม. (เป้า ≤ 1.2) — แผนไม่เปลี่ยนตัวเลขนี้เลยเพราะราคาเหรียญรวมเท่าเดิม`);
  console.log('\nส่วนลดผู้ซื้อ (เทียบ P) เมื่อซื้อวัสดุจากผู้เล่นที่ m×std และเงินที่ระบบสร้างเพิ่มต่อการซื้อ = s×(1 − (1+tax×m)/shopMul) × P [ค่าเตา+ภาษีหักแล้ว ชดเชยแร่ที่ไม่ได้ขายร้าน]');
  console.log('share shopMul | ผู้ซื้อประหยัด % ของ P ที่ m=1.0 / 1.25 / ครึ่งราคา(m=.5) | เงินสร้างเพิ่ม %P ที่ m=1.25 | ช่วง m ที่ทั้งสองฝ่ายได้ (1.075–shopMul)');
  for (const share of [0.15, 0.25, 0.30]) for (const mul of [1.3, 1.5, 2.0]) {
    const sv = m => share * (1 - m / mul) * 100, mk = share * (1 - (1 + BAR.tax * 1.25) / mul) * 100;
    console.log(row(share.toFixed(2).padStart(5), String(mul).padStart(7), ' | ', sv(1.0).toFixed(1).padStart(5), '/', sv(1.25).toFixed(1).padStart(5), '/', sv(0.5).toFixed(1).padStart(5), '                     | ', mk.toFixed(1).padStart(5), '                       | ', (mul - 1.075).toFixed(3), ` (กว้าง ${((mul - 1.075) / mul * 100).toFixed(0)}% ของราคาร้าน)`));
  }
}

// ================= Q3: ช่องปั๊มเงินซื้อวัสดุถูก + ซื้อ/ขายคืนอุปกรณ์ 70% =================
if (on('q3')) {
  console.log('\n=== Q3 ปั๊มขายคืน: ต้นทุนซื้ออุปกรณ์ = P×(1 − s + s×q/shopMul) เทียบเงินคืน 0.70×P ===');
  console.log('q = ราคาที่ผู้ซื้อได้วัสดุ (หน่วย std): 0 = ได้ฟรี/บัญชีสำรองแจก • 0.5 = เสนอซื้อพื้นแผง (STALL.min) • 0.565 = ซื้อแร่พื้นแผง 0.5× + ค่าเตา • 0.87 = แร่ตัวเองมูลค่าขายร้าน (ต้นทุนจริง) • 1.0 = std');
  const qs = [0, 0.5, 0.565, 0.87, 1.0];
  console.log('shopMul |' + qs.map(q => ('q=' + q).padStart(9)).join('') + ' | s ที่เริ่มปั๊มได้ (ต้นทุน < 70%) ต่อ q');
  for (const mul of [1.3, 1.5, 2.0]) {
    console.log(row(String(mul).padStart(7), ' |', qs.map(q => ('s*=' + (q >= mul ? '∞' : Math.min(9.99, 0.3 / (1 - q / mul)).toFixed(2))).padStart(9)).join('')));
  }
  console.log('\nส่วนต่างต้นทุน−เงินคืน (บวก = ขาดทุนต่อรอบ, ลบ = กำไรปั๊ม) หน่วย % ของ P ที่ s=0.25 / 0.30 (เพดานแข็ง):');
  console.log('shopMul |' + qs.map(q => ('q=' + q).padStart(14)).join(''));
  for (const mul of [1.3, 1.5, 2.0]) console.log(row(String(mul).padStart(7), ' |', qs.map(q => ([0.25, 0.30].map(s => ((1 - s + s * q / mul - 0.7) * 100).toFixed(1)).join('/')).padStart(14)).join('')));
  console.log('\nสรุป: ที่ q=0 ต้องใช้ s<0.30 เสมอ (s=0.30 คือคุ้มทุนพอดี ไม่มีระยะเผื่อ) • s=0.25 มีเผื่อ ≥5% ของ P ที่ q=0 ทุก shopMul • ที่ q จริง ≥0.5 เผื่อ ≥10% • ปั๊มจริงเริ่มที่ s ≈ 0.45–0.49 (shopMul 1.5–1.3) ตรงแผน');
  console.log('\nส่วนวัสดุ "จริง" (เครดิตวัสดุ ÷ P) หลังปัดจำนวนชิ้น: round() ทำให้เกินค่าตั้ง (เช่น ตั้ง .25 → สูงสุด 28–30% • ตั้ง .30 → สูงสุด 34%) • floor() ไม่เกินค่าตั้งเสมอ');
  for (const share of [0.15, 0.25, 0.30]) for (const mul of [1.3, 1.5, 2.0]) {
    const eff = fn => { const e = []; for (const tool of Object.keys(LINES)) for (const t of [8, 9, 10]) { const P = price(tool, t); let c = 0; for (const [k, fr] of GEAR_BARS[t]) { const sp = barShop(k, mul); c += fn(P * share * fr / sp) * sp; } e.push(c / P); } return [Math.min(...e), Math.max(...e)]; };
    const r = eff(Math.round), f = eff(Math.floor);
    console.log(`  share ${share.toFixed(2)} shopMul ${mul}: round ${(r[0] * 100).toFixed(1)}–${(r[1] * 100).toFixed(1)}%  | floor ${(f[0] * 100).toFixed(1)}–${(f[1] * 100).toFixed(1)}%`);
  }
  console.log('ช่องอื่นที่ตรวจ: (1) เทรดตรงไม่มีภาษี แต่ ≤1,000/ฝั่ง และวัสดุไม่มี sell จึงไม่ออกเป็นเหรียญระบบ (2) หลอมแล้วขายร้านไม่ได้ (ไม่อยู่ SELLABLE) (3) ฟรี q=0 ต้องมีแร่จริงเสมอ = มีเวลาขุด ต้นทุนไม่เป็นศูนย์');
}

// ================= Q4: hay =================
if (on('q4')) {
  console.log('\n=== Q4 hay: คนเลี้ยงสัตว์ ÷ ชาวนา เมื่อจ่าย hay 12/18/22/24 (levelsim ปัจจุบัน = 24) ===');
  const orig = S.itemInfo, withHay = (p, fn) => { S.itemInfo = k => k === 'hay' ? Object.assign({}, orig(k), { buy: p }) : orig(k); try { return fn(); } finally { S.itemInfo = orig; } };
  const R = {}; for (const p of [24, 22, 18, 12]) R[p] = withHay(p, () => Array.from({ length: 20 }, (_, i) => L.animal(i + 1)));
  console.log('Lv | hay/ชม.(เพดาน) | เหรียญ%ชาวนา: hay=24  22  18  12 | ใครเกิน 120% ?');
  for (let lv = 1; lv <= 20; lv++) {
    const F = coinOf('farm', lv), r = [24, 22, 18, 12].map(p => p0(R[p][lv - 1].coin, F)), a = S.ANIMALS;
    const hayN = Object.values(a).filter(x => x.feedItem === 'hay' && x.lv <= lv).length;
    // hay/ชม. = ผลต่อ coin ที่ลดต้นทุน 1 เหรียญ → coin(12) − coin(24) = 12 × hay/ชม. (เพราะต้นทุนเชิงเส้นในราคา hay)
    const hayH = (R[12][lv - 1].coin - R[24][lv - 1].coin) / 12;
    console.log(row(String(lv).padStart(2), ' | ', hayN ? num(hayH).padStart(6) + ' /ชม. ' : '   -   ', '     |            ', r.map(x => String(x).padStart(4)).join(' '), '   | ', r.some(x => x > 120) ? '!' + r.filter(x => x > 120).length + ' ค่า' : ''));
  }
  const over = (p, thr) => { const o = []; for (let lv = 1; lv <= 20; lv++) if (p0(R[p][lv - 1].coin, coinOf('farm', lv)) > thr) o.push(lv); return o.join(','); };
  console.log('เกิน 120%: ' + [24, 22, 18, 12].map(p => `hay${p}: Lv[${over(p, 120)}]`).join(' • '));
  console.log('เกิน 125%: ' + [24, 22, 18, 12].map(p => `hay${p}: Lv[${over(p, 125)}]`).join(' • '));
  // ชาวนา: อัดฟางเทียบขายผัก (รายได้ขั้นต้นต่อผัก 1 ชิ้น: เมล็ดจ่ายเท่ากันทั้งสองทาง) ที่ตลาดผักอิ่มตัว (ตัวคูณราคาผัก 1.0 / 0.76 จริง / 0.5 / 0.3 = CATFAT.min)
  console.log('\nชาวนา อัดฟาง vs ขายผัก: รายได้ขั้นต้นต่อผัก 1 ชิ้น (hay หักภาษีแผง 7%) และ +% ของ hay เทียบขายผักที่ตัวคูณราคาผักต่างกัน');
  for (const c of ['carrot', 'corn']) {
    const C = S.CROPS[c], yld = c === 'carrot' ? 1 : 2, tax = 1 - BAR.tax, bale = p => yld * p * tax, sell = m => C.sell * m, d = (p, m) => ((bale(p) / sell(m) - 1) * 100);
    console.log(`  ${c} (ขาย ${C.sell} → hay ${yld}): ขายผัก ×1.0=${sell(1).toFixed(1)} ×0.76=${sell(0.76).toFixed(1)} ×0.5=${sell(0.5).toFixed(1)} ×0.3=${sell(0.3).toFixed(1)} | อัดฟาง p24=${bale(24).toFixed(1)} p22=${bale(22).toFixed(1)} p18=${bale(18).toFixed(1)} p12=${bale(12).toFixed(1)}`);
    for (const m of [1, 0.76, 0.5, 0.3]) console.log(`     ผัก×${m}: อัดฟางมากกว่า ` + [24, 22, 18, 12].map(p => `p${p}:${d(p, m) >= 0 ? '+' : ''}${d(p, m).toFixed(0)}%`).join(' '));
  }
  // ขอบบน: ชาวนา Lv1–10 ปลูกข้าวโพด/แครอทอย่างเดียวแล้วอัดฟางขายหมด (ดีมานด์ไม่จำกัด) เทียบทางที่ levelsim เลือก
  const cropPph = (lv, c) => { const cap = Math.min(S.FARM_CAP.max, S.FARM_CAP.base + S.FARM_CAP.perLv * (lv - 1)), m = 1 + 0.04 * (lv - 1), wet = S.CANS[L.canAt(lv)].wet, grow = c.time / m, acts = 3 + Math.ceil(grow / wet); return Math.min(cap / (grow / 60000), L.M.apm / acts) * 60; };
  console.log('\nขอบบน [ดีมานด์ hay ไม่จำกัด = ไม่เกิดจริง]: ชาวนาปลูกแครอท/ข้าวโพดอัดฟางล้วน เหรียญ/ชม.(เพดาน) % ของที่ levelsim ให้ชาวนาที่เลเวลนั้น');
  console.log('Lv | ชิ้น/ชม. ข้าวโพด | hay@24  hay@18  hay@12 (ข้าวโพด)  | แครอท hay@24');
  for (const lv of [3, 4, 5, 6, 8, 10, 14, 20]) {
    const cn = S.CROPS.corn, cr = S.CROPS.carrot, pc = cropPph(lv, cn), pr = cropPph(lv, cr), F = coinOf('farm', lv);
    const b = (p, c, pp, y) => pp * (y * p * (1 - BAR.tax) - c.seed);
    console.log(row(String(lv).padStart(2), ' | ', num(pc).padStart(8), '        |  ', [24, 18, 12].map(p => (p0(b(p, cn, pc, 2), F) + '%').padStart(6)).join('  '), '           |  ', p0(b(24, cr, pr, 1), F) + '%'));
  }
}

if (on('q4')) {
  // ดีมานด์จำกัด: คนเลี้ยงสัตว์ 1 คนกิน hay กี่ชิ้น/ชม.จริง เทียบกำลังอัดฟางของชาวนา 1 คนที่เลเวลเดียวกัน (ข้าวโพด 300 ต้น/ชม.เพดาน → hay 600) และกำไรเพิ่มของชาวนาเมื่อขาย hay ให้คนเลี้ยง 1 คน (ที่ p เทียบขายข้าวโพดราคา×0.76)
  const orig = S.itemInfo, withHay = (p, fn) => { S.itemInfo = k => k === 'hay' ? Object.assign({}, orig(k), { buy: p }) : orig(k); try { return fn(); } finally { S.itemInfo = orig; } };
  console.log('\nดีมานด์จำกัด [สมมติ: ชาวนา 1 : คนเลี้ยงสัตว์ 1, เล่น 1 ชม.] hay ที่คนเลี้ยง 1 คนกิน (จริง) • ส่วนของกำลังอัดฟางชาวนา • กำไรเพิ่มชาวนา % ของรายได้จริงชาวนา ที่ p=24 / 22 / 18');
  for (const lv of [3, 4, 5, 7, 9, 12, 15, 18]) {
    const hayH = (withHay(12, () => L.animal(lv).coin) - withHay(24, () => L.animal(lv).coin)) / 12 * EFF, cornH = 300 * 2 * EFF, F = coinOf('farm', lv) * EFF, opp = S.CROPS.corn.sell * 0.76 / 2;
    console.log(row('  Lv', String(lv).padStart(2), ': ', num(hayH).padStart(4), ' hay/ชม. = ', (hayH / cornH * 100).toFixed(0).padStart(3), '% ของกำลังอัดฟาง 1 ชาวนา  • ชาวนาได้เพิ่ม ', [24, 22, 18].map(p => ((hayH * (p * 0.93 - opp)) / F * 100 >= 0 ? '+' : '') + (hayH * (p * 0.93 - opp) / F * 100).toFixed(1) + '%').join(' / ')));
  }
}

// ================= Q5: ช่างไม้กับเฟอร์นิเจอร์ชั้นดี 6 ชิ้น =================
const NEWF = [ // ตัวเลขร่างจากแผนข้อ 4 • price = 2×(Σ std วัตถุดิบ) ปัดเป็นสิบ • XP คิดจากไม้ = 0.27×มูลค่าไม้ (เท่า levelSim craftXp)
  { id: 'lamp_stone', name: 'โคมหินสวน', lv: 9, bars: { stone: 6, copper: 2 }, wood: { log: 6 } },
  { id: 'chime_copper', name: 'ระฆังลมทองแดง', lv: 10, bars: { copper: 4 }, wood: { bamboo: 6 } },
  { id: 'candle_silver', name: 'เชิงเทียนเงิน', lv: 12, bars: { silver: 5 }, wood: { maplewood: 2 } },
  { id: 'chandelier', name: 'โคมระย้าอเมทิสต์', lv: 15, bars: { amethyst: 5, silver: 3 }, wood: { sakurawood: 2 } },
  { id: 'gem_cabinet', name: 'ตู้โชว์อัญมณี', lv: 18, bars: { emerald: 3, sapphire: 3 }, wood: { ebony: 3 } },
  { id: 'jade_throne', name: 'บัลลังก์หยก', lv: 19, bars: { jade: 4, mythril: 3 }, wood: { ebony: 3 } },
];
const woodVal = r => Object.entries(r.wood).reduce((a, [k, n]) => a + S.WOOD_ITEMS[k].sell * n, 0), barVal = r => Object.entries(r.bars).reduce((a, [k, n]) => a + barStd(k) * n, 0);
for (const r of NEWF) { r.M = barVal(r) + woodVal(r); }
const FP = +((process.argv.find(a => /^fp=/.test(a)) || 'fp=2.0').slice(3)); // ตัวคูณราคา = FP × Σ std วัตถุดิบ (ใส่ fp=2.5 เพื่อลอง)
if (on('q5')) {
  console.log('\n=== Q5 ช่างไม้ Lv9–19: เฟอร์นิเจอร์ชั้นดี 6 ชิ้น ===');
  console.log('กำไรต่อชิ้น = 0.93×ราคา(ขายแผง ภาษี 7%) − ค่าโรงช่าง 20%×ราคา − วัสดุ − ไม้ (ไม้คิดที่ราคาร้านรับ = ต้นทุนเสียโอกาส) | หน่วยเหรียญ');
  console.log('ชิ้น                  Lv  ราคา  M(std)  ไม้  | กำไร: วัสดุ m=1.0  m=1.25  ร้าน×1.5 | ร้าน×2.0 | ร้านซื้อคืน 35% (ขาดทุน?) | shopMul สูงสุดที่ยังไม่ขาดทุน');
  for (const r of NEWF) {
    const pr = Math.round(FP * r.M / 10) * 10, bv = barVal(r), wv = woodVal(r), prof = m => 0.93 * pr - 0.2 * pr - bv * m - wv;
    const mulMax = (0.93 * pr - 0.2 * pr - wv) / bv;
    console.log(row(r.name.padEnd(20), String(r.lv).padStart(3), String(pr).padStart(6), String(r.M).padStart(6), String(wv).padStart(6), '   |       ', [1.0, 1.25, 1.5].map(m => prof(m).toFixed(0).padStart(7)).join(' '), '  |', prof(2.0).toFixed(0).padStart(7), '   | ', (0.35 * pr - 0.2 * pr - bv - wv).toFixed(0).padStart(7), '                   | ', mulMax.toFixed(2)));
  }
  console.log('  ตัวคูณราคา FP เทียบ: กำไรต่อชิ้น ÷ M ที่ m=1.25, shopMul 1.5: ' + [2.0, 2.5, 3.0].map(fp => `FP${fp}: ` + NEWF.map(r => { const pr = fp * r.M, bv = barVal(r), wv = woodVal(r); return ((0.73 * pr - bv * 1.25 - wv) / r.M * 100).toFixed(0) + '%'; }).join('/')).join(' • '));
  // ซัพพลายไม้ระดับห้อง: ต้นไม้งอก 180 ต้น/ชม. × สัดส่วนชนิด (TREE_KINDS.pct)
  const regrow = 60000 / S.TREE.growMs * 60, itemRoom = {};
  for (const K of Object.values(S.TREE_KINDS)) { const t = regrow * K.pct / 100; for (const [it, q] of K.drop) itemRoom[it] = (itemRoom[it] || 0) + t * q; for (const [it, c] of K.bonus || []) itemRoom[it] = (itemRoom[it] || 0) + t * c; }
  console.log('\nซัพพลายไม้ทั้งห้อง (ต้นงอก ' + regrow + ' ต้น/ชม. เพดาน): ' + ['log', 'bamboo', 'maplewood', 'sakurawood', 'ebony'].map(k => `${k} ${itemRoom[k].toFixed(1)}/ชม.`).join(' • '));
  console.log('ชิ้นสูงสุดต่อชม. ของทั้งห้อง (จำกัดแค่ไม้): ' + NEWF.map(r => `${r.name} ${Math.min(...Object.entries(r.wood).map(([k, n]) => itemRoom[k] / n)).toFixed(2)}`).join(' • ') + '  (บัลลังก์+ตู้โชว์ใช้มะเกลือกองเดียวกัน)');
  // ผลต่อ coin และ XP ช่างไม้รายเลเวล
  // แยกไม้ต่อชนิดของช่างไม้เดี่ยว (ตรรกะเดียวกับ levelsim.wood)
  const KS = (() => { const d = {}; for (const [k, K] of Object.entries(S.TREE_KINDS)) d[k] = K.pct / 100; return d; })();
  function woodItems(lv) {
    const axe = L.axeAt(lv), inv = { ['axe_' + axe]: 1 }, items = {}; let share = 0;
    const el = [];
    for (const [id, K] of Object.entries(S.TREE_KINDS)) { const sh = KS[id] || 0; if (!sh || K.lv > lv) continue; const mh = S.chopHit(inv, id); if (!mh || mh.blocked) continue; el.push([id, K, sh, mh]); share += sh; }
    const w = sims.wood[lv - 1], tph = w.trees; // ต้น/ชม. ของช่างไม้เดี่ยว
    for (const [id, K, sh, mh] of el) { const t = tph * sh / share; K.drop.forEach(([it, q], i) => { items[it] = (items[it] || 0) + t * (q + (i === 0 ? 0.04 * (S.perkLv(lv) - 1) + mh.extra : 0)); }); for (const [it, ch] of K.bonus || []) items[it] = (items[it] || 0) + t * Math.min(1, ch + 0.01 * (S.perkLv(lv) - 1)); }
    return items;
  }
  const craftXpK = 0.27;
  const usedBy = (lv, withNew) => { const s = new Set(); for (const r of S.CRAFT) if (r.lv <= lv) for (const k of Object.keys(r.in)) { s.add(k); if (k === 'plank') s.add('log'); } if (withNew) for (const r of NEWF) if (r.lv <= lv) for (const k of Object.keys(r.wood)) s.add(k); return s; };
  console.log('\nช่างไม้เดี่ยว (เพดาน): XP% ชาวนา และเหรียญ% ชาวนา แยกตามว่า "ประดิษฐ์ได้ไหม" • xp ซิม = ตามเป้า WP-20 (สมมติแปรรูปไม้ทุกชนิดได้) • จริง = เฉพาะไม้ที่มีสูตร');
  console.log('Lv | ซิม XP% | XP% จริง: สูตรเดิม | +6 ชิ้น(ไม่จำกัดดีมานด์) | ส่วน XP ซิมที่มาจากประดิษฐ์ | เหรียญ% ฐาน → +6 ชิ้น (ไม่จำกัดดีมานด์ จำกัดแค่ไม้ห้อง, m=1.25) | ดีมานด์จำกัด: เหรียญเพิ่ม % ต่อวัน [สมมติ D ชิ้น/วัน/ช่างไม้ 1 คน]');
  for (let lv = 8; lv <= 20; lv++) {
    const w = sims.wood[lv - 1], fx = sims.farm[lv - 1].xp, items = woodItems(lv), wl = 1;
    const chop = w.xp - 0; // levelsim: xp = tpm(xp + craftXp)*wl*60 → ตัดส่วน craftXp ออกแล้วคิดใหม่เฉพาะที่ประดิษฐ์ได้
    const val = k => items[k] * S.WOOD_ITEMS[k].sell, allVal = Object.keys(items).reduce((a, k) => a + val(k), 0), craftAll = craftXpK * allVal * wl;
    const chopOnly = w.xp - craftAll, cur = usedBy(lv, false), nw = usedBy(lv, true);
    const craftable = set => craftXpK * Object.keys(items).filter(k => set.has(k)).reduce((a, k) => a + val(k), 0);
    // เหรียญ +6 ชิ้น: จำกัดซัพพลายไม้ทั้งห้อง (ช่างไม้เดี่ยวเอาไม้ทั้งห้อง = ขอบบน) และ ≤ ที่ช่างไม้ตัดได้เอง
    let dCoin = 0; for (const r of NEWF) if (r.lv <= lv) { const pr = Math.round(FP * r.M / 10) * 10, n = Math.min(...Object.entries(r.wood).map(([k, q]) => Math.min(items[k] || 0, itemRoom[k]) / q)), prof = 0.93 * pr - 0.2 * pr - barVal(r) * 1.25 - woodVal(r); dCoin += n * prof; }
    // ดีมานด์จำกัด [สมมติ]: ช่างไม้ 1 คน เล่น 1 ชม./วัน ขายเฟอร์นิเจอร์ชั้นดีได้ D ชิ้น/วัน (เลือกชิ้นกำไรสูงสุดก่อน จำกัดด้วยซัพพลายไม้ทั้งห้องต่อชม.) → เหรียญเพิ่ม % ของรายได้จริงต่อวัน (เพดาน×EFF×1 ชม.)
    const dem = D => { let left = D, tot = 0; const rs = NEWF.filter(r => r.lv <= lv).map(r => { const pr = Math.round(FP * r.M / 10) * 10, prof = 0.93 * pr - 0.2 * pr - barVal(r) * 1.25 - woodVal(r), cap = Math.min(...Object.entries(r.wood).map(([k, q]) => itemRoom[k] / q)); return { prof, cap }; }).sort((a, b) => b.prof - a.prof); for (const r of rs) { const n = Math.min(left, r.cap); tot += n * r.prof; left -= n; } return tot / (w.coin * EFF) * 100; };
    console.log(row(String(lv).padStart(2), ' | ', (p0(w.xp, fx) + '%').padStart(5), '  |  ', (p0(chopOnly + craftable(cur), fx) + '%').padStart(5), '            |  ', (p0(chopOnly + craftable(nw), fx) + '%').padStart(5), '                  |  ', (p0(craftAll, w.xp) + '%').padStart(5), '                     | ', (p0(w.coin, coinOf('farm', lv)) + '%').padStart(4), ' → ', (p0(w.coin + dCoin, coinOf('farm', lv)) + '%').padStart(4), `  (+${num(dCoin)}/ชม.) | ดีมานด์จำกัด D=3: +${dem(3).toFixed(1)}%  D=10: +${dem(10).toFixed(1)}%`));
  }
  console.log('  ช่องซื้อ XP ด้วยเหรียญ: ประดิษฐ์ชิ้นราคา FP×M ได้ XP = 0.27×ไม้ • ต้นทุนขั้นต่ำถ้าไม่มีผู้ซื้อจริง (ขายร้าน 35%): ' + NEWF.map(r => { const pr = Math.round(FP * r.M / 10) * 10, xp = craftXpK * woodVal(r), loss = barVal(r) * 1.5 + woodVal(r) + 0.2 * pr - 0.35 * pr; return `${r.name} ${(loss / xp).toFixed(1)} เหรียญ/XP`; }).join(' • '));
  console.log('  เทียบ: ชาวนา Lv12 ได้ XP 4,320/ชม.จริงพร้อมกำไร • ซื้อ XP ด้วยเหรียญแพงกว่าทุกอาชีพ ไม่ใช่ช่อง (ถ้าตั้งใจซื้อวัสดุร้านแล้วประดิษฐ์ขายร้าน)');
}

// ================= Q6: ดีมานด์จริง ค่าเตา เวลา =================
if (on('q6')) {
  console.log('\n=== Q6 ดีมานด์วัสดุ ค่าเตา และเวลานักขุด ===');
  console.log('[สมมติ] ข้อมูลจริงไม่มี: node tools/economy.js 7 ในเครื่องนี้ได้ผู้เล่นจริง 0 คน (data/ ว่าง) จึงใช้ฉาก X = ครั้งซื้ออุปกรณ์ระดับ 8–10 ต่อระดับต่อวัน ทั้งเซิร์ฟเวอร์');
  console.log('ที่มาของ X: ผู้เล่นจริงจัง ~15 คน (ECONOMY-PLAN) • แต่ละคนผ่านระดับ 8/9/10 ของอาชีพหลักครั้งเดียวต่ออาชีพ (1–2 สาย) ใน ~20–25 วันเล่น → X ≈ N×1.5 สาย÷(รอบ 3 ระดับ × ~20 วัน) ≈ N/13 : N=15 → 1.2 • N=50 → 4 • N=150 → 12');
  for (const share of [0.15, 0.25, 0.30]) {
    const B = allBuys(share, BAR.shopMul), avgStd = B.reduce((a, b) => a + b.stdVal, 0) / B.length, avgFee = B.reduce((a, b) => a + b.use.reduce((s, u) => s + u.n * barFee(u.k), 0), 0) / B.length, avgBars = B.reduce((a, b) => a + b.use.reduce((s, u) => s + u.n, 0), 0) / B.length, avgP = B.reduce((a, b) => a + b.P, 0) / B.length;
    console.log(`\nshare=${share}: 1 การซื้อ = ${avgBars.toFixed(1)} ชิ้นวัสดุ (std รวม ${num(avgStd)}) ค่าเตา ${num(avgFee)} (${(avgFee / avgP * 100).toFixed(1)}% ของ P เฉลี่ย ${num(avgP)})`);
    console.log('   X/วัน | แร่ที่ต้องหลอม (ก้อน/วัน) | ค่าเตารวม/วัน | เหรียญเข้าตลาดนัดผู้เล่น/วัน(m=1.25) | เวลาหลอม: ครั้ง×(2 วิ+3 วิ UI) นาที/วัน');
    for (const X of [1.2, 4, 12]) {
      const bars = X * 3 * avgBars, ore = bars * 3, fee = X * 3 * avgFee, rev = X * 3 * avgStd * 1.25, acts = bars / 10 + 3, mins = acts * 5 / 60;
      console.log(`   ${String(X).padStart(5)} | ${num(ore).padStart(8)} ก้อน (${num(bars)} ชิ้น)   | ${num(fee).padStart(8)}      | ${num(rev).padStart(10)}                         | ${mins.toFixed(1)} นาที/วัน (= ${(mins / 60 * 100).toFixed(1)}% ของ 1 ชม.) `);
    }
  }
  // เวลาเมื่อหลอมหมด (เพดานแย่สุด): นักขุด Lv17 ขุดมูนสโตนได้ pieces/ชม. → ชิ้นวัสดุ → ครั้งหลอม ×5 วิ
  console.log('\nเพดานแย่สุด (หลอมแร่ที่ขุดได้ทั้งหมด φ=100%): เวลาหลอม ต่อชั่วโมงเล่น และค่าเตา % ของรายได้ [ใช้ ms=2000 + UI 3 วิ ต่อครั้ง n=10]');
  for (const lv of [9, 11, 13, 15, 17, 19]) { const q = sims.mine[lv - 1].pieces * EFF, bars = q / 3, acts = bars / 10, sec = acts * 5, k = Object.entries(mineSplit(lv)).sort((a, b) => b[1] - a[1])[0][0], fee = bars * barFee(k); console.log(`  Lv${lv} ${k}: ${num(bars)} ชิ้น/ชม.จริง • ${num(acts)} ครั้ง • ${sec.toFixed(0)} วิ = ${(sec / 36).toFixed(1)}% ของชม. (เป้า ≤5%) • ค่าเตา ${num(fee)}/ชม. = ${(fee / (coinOf('mine', lv) * EFF) * 100).toFixed(0)}% ของรายได้จริง/ชม.`); }
}

// ================= Q7: สมุดสะสมเฟอร์นิเจอร์ + econsim เมื่อมี FURN ใหม่ =================
if (on('q7')) {
  console.log('\n=== Q7 bookAdd จ่ายซ้ำเมื่อเพิ่ม FURN ใหม่ ===');
  const B = S.BOOK.furn, rare = S.FURN[B.rare], entries = 6 * S.BOOK_ENTRY_COIN, rv = S.tradeValue('furn_' + B.rare);
  console.log(`BOOK.furn ตอนนี้ ${B.ids.length} ชนิด (ไม่รวม rare/legacy) รางวัลครบเล่ม ${B.coin} + ${rare.name} (tradeValue ${rv}, ซื้อขายในแผงได้ ร้านรับคืนไม่ได้)`);
  console.log(`ถ้าเพิ่ม 6 ชนิดเข้า BOOK (ค่าตั้งต้นของตัวกรอง !rare && !legacy): ผู้ที่ครบ ${B.ids.length} ชนิดแล้วได้รางวัลซ้ำเมื่อเก็บครบ ${B.ids.length + 6} = ${B.coin} + ${entries} (6×${S.BOOK_ENTRY_COIN}) + ${rare.name} ${rv} = ${B.coin + entries + rv} เหรียญเทียบเท่าต่อคน (แมวขายแผงได้ ~${rv * 0.5}–${rv} หลังภาษี)`);
  console.log('ทางกัน: nobook (ไม่เข้า BOOK.furn.ids) — bookAdd มี def.ids.includes(id) กันอยู่แล้ว (achievements.js:51) จึงไม่นับเลย ไม่เขย่าตัวนับ n และไม่ต้องเพิ่มฟิลด์เซฟ • ห้ามให้ยอดรวมเกิน: ถ้าเลือก "นับแล้วกันซ้ำ" ต้องเพิ่ม rec.bookDone');
  console.log('ผู้ที่ครบเล่มตอนนี้: ไม่ทราบ [ไม่ได้วัด: data/ ว่าง] • คาดน้อยมาก (45 ชนิด ต้องซื้อ/ประดิษฐ์ครบรวมของแพง bedking 1,100 ฯลฯ)');
  // econsim: wishlist ของผู้เล่นจำลองนับ FURN ทุกชิ้นที่ !rare && !craft → ถ้าเพิ่ม 6 ชิ้นโดยไม่ติดธง จะเปลี่ยนผล G ทั้งหมด
  const E = require('./econsim.js'), base = E.run(35).res;
  const added = [];
  for (const r of NEWF) { const k = 'tmp_' + r.id; S.FURN[k] = { cat: 'living', name: r.name, emoji: '🪔', price: Math.round(FP * r.M / 10) * 10, noshop: true }; added.push(k); }
  const withF = E.run(35).res; for (const k of added) delete S.FURN[k];
  const f = r => `G2 ${r.G2.toFixed(2)} • G3 ${(r.G3 * 100).toFixed(0)}% • G4 ไม้ ${(r.G4.wood * 100).toFixed(0)}%/สัตว์ ${(r.G4.animal * 100).toFixed(0)}% • G5 ${r.G5.toFixed(3)} • G8 ${num(r.G8)}`;
  console.log('econsim 35 วัน (ไม่เปลี่ยนค่าใดในเกม ใส่ FURN จำลอง 6 ชิ้นในหน่วยความจำ):\n  ฐาน        : ' + f(base) + '\n  +FURN 6 ชิ้น: ' + f(withF));
  console.log('หมายเหตุ: econsim ไม่มีนักขุด/อุปกรณ์ระดับ 8–10 ใน wishlist จึงไม่เห็นผลวัสดุ (ทางนี้คิดมือใน Q2/Q3) • ผล FURN คือผู้เล่นจำลองซื้อของใหม่เองด้วยราคา (ไม่คิดว่าต้องประดิษฐ์) = ขอบบนของการดูดเงิน');
}
