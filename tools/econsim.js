'use strict';
// จำลองเศรษฐกิจทั้งเมือง N วัน ด้วยผู้เล่นจำลองหลายแบบ เพื่อวัดเกณฑ์ความไม่เหลื่อมล้ำ (ECONOMY-PLAN.md หัวข้อ 1B: G2 G3 G4 G5 G8) ก่อนเปิดรับคนเล่น
// ใช้: node tools/econsim.js [จำนวนวัน=35]        → ตารางผลต่อแบบผู้เล่น + สรุปเกณฑ์
//      node tools/econsim.js 35 --json             → ผลดิบ
// ใช้ค่าจริงจาก public/shared.js ผ่าน tools/levelsim.js (ผลผลิต/XP ต่อชั่วโมงต่อเลเวล) แล้วเพิ่มสิ่งที่ levelsim ไม่มี:
//   ตลาดอิ่มตัวระหว่างเล่น (ยิ่งเล่นนานต่อรอบ ราคายิ่งตก) • ของส่วนรวมที่ต้องแย่งกัน (ต้นไม้งอก ผลผลิตเล้า) • ค่าอาหาร • เควส/streak • การซื้อของ (ที่ใช้เงิน)
// เป็นแบบจำลองหยาบ ใช้ "เทียบก่อน/หลังปรับตัวเลข" ไม่ใช่ทำนายค่าจริง • เทียบกับข้อมูลจริงด้วย tools/economy.js (ราคาขายจริงต่อหมวด รายได้ต่อการกระทำ)
const S = require('../public/shared.js'), L = require('./levelsim.js');

const days = Math.max(1, +process.argv.filter(a => !a.startsWith('--'))[2] || 35);
const C = {
  window: 240,        // ทุกคนเล่นช่วงเย็นเดียวกัน 4 ชม. (ข้อมูลจริง: คนเข้าเยอะ 21:00–01:00) ใช้คิดการแย่งของส่วนรวม
  foodPerMin: 2.9,    // ค่าอาหารต่อนาทีที่ทำงาน (หิว 7.2 แต้ม/นาที × ขนมปัง 0.4 เหรียญ/แต้ม)
  questPerDay: 260,   // เควส 6 ข้อ + โบนัสครบ (เฉลี่ย) สำหรับคนที่เล่น ≥ 30 นาที
  reserve: 200,       // เก็บเงินสดไว้ก่อนซื้อของในรายการอยากได้
  sellEvery: 10,      // ขายทุกกี่นาที (ขายเป็นชุด)
  // ปรับแบบจำลองให้ใกล้ข้อมูลจริง: สัดส่วนผลผลิตที่คนจริงทำได้เทียบ levelsim (ข้อมูล 21–25 ต.ค. 2026: เลี้ยงสัตว์ได้ ~16 เหรียญ/การกระทำ ขณะที่แบบจำลองคิด ~42 เพราะต้องเดินหาสัตว์ที่หิว)
  cal: { farm: 1, fish: 1, animal: 0.4, wood: 1, cook: 1 },
};
// ของที่ผู้เล่นอยากซื้อ (ที่ใช้เงิน) เรียงตามลำดับที่คนมักซื้อ: เครื่องมือตามเลเวล → ของแต่งตัว → เฟอร์นิเจอร์ → สัตว์เลี้ยง → สิ่งที่ shared.js มีเพิ่ม (WISH_EXTRA)
function wishlist() {
  const w = [];
  w.push({ k: 'can_2', p: S.CANS[2].price, need: ['farm', 3] }, { k: 'rod_2', p: S.RODS[2].price, need: ['fish', 3] }, { k: 'axe_1', p: S.AXES[1].price, need: ['wood', 1] }, { k: 'axe_2', p: S.AXES[2].price, need: ['wood', 3] });
  w.push({ k: 'can_3', p: S.CANS[3].price, need: ['farm', 6] }, { k: 'rod_3', p: S.RODS[3].price, need: ['fish', 6] }, { k: 'axe_3', p: S.AXES[3].price, need: ['wood', 6] });
  for (const c of Object.keys(S.WEAR)) for (const i of S.WEAR[c]) if (i.price) w.push({ k: 'wear', p: i.price });
  for (const [k, f] of Object.entries(S.FURN)) if (!f.rare && !f.craft) w.push({ k: 'furn_' + k, p: f.price });
  for (const c of Object.values(S.COMPANIONS)) w.push({ k: 'pet', p: c.price });
  for (const x of S.WISH_EXTRA || []) w.push(x); // ที่ใช้เงินใหม่ (ขั้น 2) ใส่ไว้ใน shared.js ให้จำลองรู้จัก
  return w;
}
const SK = ['farm', 'fish', 'animal', 'wood', 'cook'];
const gini = a => { if (a.length < 2) return 0; a = a.slice().sort((x, y) => x - y); const s = a.reduce((x, y) => x + y, 0); if (!s) return 0; let c = 0; a.forEach((v, i) => { c += (2 * (i + 1) - a.length - 1) * v; }); return c / (a.length * s); };

function run(days) { // คืนผลจำลอง (เรียกซ้ำได้หลังแก้ค่าใน S เพื่อลองปรับสมดุล)
const sims = L.simulate();
// ผู้เล่นจำลอง: เวลาเล่นต่อวัน × อาชีพที่ชอบ × วันเริ่ม
const agents = [];
for (const mins of [30, 60, 120, 240]) for (const focus of [...SK, 'mix']) for (const start of [0, 14]) agents.push({ id: `${focus}-${mins}m-d${start}`, mins, focus, start, xp: Object.fromEntries(SK.map(k => [k, 0])), coin: 50, assets: 0, wish: wishlist(), took: {}, earned: 0, mkt: {} });

const supplyPerMin = { wood: L.M.treeRegen * (2 + 0.16), animal: null }; // ของส่วนรวมต่อนาทีทั้งห้อง (หน่วย = ชิ้น) • สัตว์คิดจากเล้าเต็มของเลเวลสูงสุด
supplyPerMin.animal = sims.animal[S.MAX_LV - 1].pieces / 60;
const share = { wood: {}, animal: {} };
const perDay = [];
for (let d = 0; d < days; d++) {
  const on = agents.filter(a => d >= a.start);
  const skillOf = a => a.focus === 'mix' ? SK[d % SK.length] : a.focus;
  const lvs = on.map(a => Math.max(...SK.map(k => S.levelOf(a.xp[k])))).sort((x, y) => x - y), medLv = lvs[Math.floor(lvs.length / 2)] || 1;
  // ความต้องการของส่วนรวมรวมทั้งวัน เทียบกับที่มีในช่วงเวลาเล่นร่วมกัน → ตัวคูณที่ได้จริง
  const scale = {};
  for (const r of ['wood', 'animal']) {
    const want = on.filter(a => skillOf(a) === r).reduce((n, a) => n + sims[r][S.levelOf(a.xp[r]) - 1].pieces / 60 * L.M.EFF * a.mins, 0);
    scale[r] = want ? Math.min(1, supplyPerMin[r] * C.window / want) : 1;
  }
  for (const a of on) {
    const sk = skillOf(a), lv = S.levelOf(a.xp[sk]), r = sims[sk][lv - 1], f = L.M.EFF * (scale[sk] || 1) * C.cal[sk];
    const cu = S.CATCHUP && lv < medLv ? S.CATCHUP.xpMul : 1; // XP ตามทัน: เลเวลต่ำกว่าค่ากลางเมือง
    const pcs = r.pieces / 60 * f, val = r.gross / r.pieces, cat = r.cat;
    let m = a.mkt[cat] === undefined ? 1 : a.mkt[cat], rev = 0, stock = (a.stock || {})[cat] || 0, work = 0;
    const unit = r.cost / r.pieces; // ต้นทุนต่อชิ้น (เมล็ด เหยื่อ อาหารสัตว์ ค่าเตา)
    for (let t = 1; t <= a.mins; t++) {
      if (stock < pcs * 120 && m * val > unit + C.foodPerMin / Math.max(0.01, pcs)) { stock += pcs; work++; } // คนจริงหยุดผลิตเมื่อขายแล้วขาดทุน หรือของค้างเกิน 2 ชม.ของการผลิต (พัก ตลาดฟื้น)
      if (t % C.sellEvery === 0 || t === a.mins) { // ขายเป็นชุด ราคาต่อชิ้นลดตามกติกาตลาดจริง (S.CATFAT.perCoin = ลดตามมูลค่า ถ้ามี)
        const drop = S.sellDrop ? S.sellDrop(val) : S.MARKET.drop;
        while (stock > 0 && val * Math.max(S.MARKET.min, m) >= unit * 1.05) { const n = Math.min(1, stock); rev += n * val * Math.max(S.MARKET.min, m); m = Math.max(S.MARKET.min, m - drop * n); stock -= n; } // ราคาต่ำกว่าทุน = เก็บไว้ขายวันหลัง
      }
      m += (1 - m) * (S.PMARKET.recover + S.CATFAT.recover) / 2; // ตลาดฟื้นต่อนาทีระหว่างเล่น (ชนิด + หมวด)
    }
    (a.stock || (a.stock = {}))[cat] = stock; a.mkt[cat] = m; // ข้ามวัน: ฟื้นเกือบเต็ม (ออฟไลน์ ~20 ชม.)
    for (const k of Object.keys(a.mkt)) a.mkt[k] = 1 - (1 - a.mkt[k]) * 0.05;
    (a.val || (a.val = {}))[cat] = val; a.gross = (a.gross || 0) + val * pcs * work; a.rev = (a.rev || 0) + rev; a.cat = cat;
    const cost = r.cost / 60 * f * work + C.foodPerMin * work, inc = rev + C.questPerDay + 10 + 5 * Math.min(d - a.start + 1, 7);
    a.coin += inc - cost; a.earned += rev; (a.daily || (a.daily = []))[d] = rev - r.cost / 60 * f * work; a.xp[sk] += r.xp / 60 * f * work * cu;
    if (scale[sk] !== undefined) share[sk][a.id] = (share[sk][a.id] || 0) + r.pieces / 60 * f * work;
    // ซื้อของในรายการอยากได้ (ที่ซื้อได้ตามเลเวล) เมื่อเงินพอ
    for (let i = 0; i < a.wish.length;) { const w = a.wish[i]; if (w.need && S.levelOf(a.xp[w.need[0]]) < w.need[1]) { i++; continue; } if (a.coin - w.p < C.reserve) break; a.coin -= w.p; a.assets += w.p; a.wish.splice(i, 1); }
  }
  perDay.push(on.map(a => a.coin + a.assets));
}

const wealth = a => a.coin + a.assets + Object.entries(a.stock || {}).reduce((n, [c, q]) => n + q * (a.val && a.val[c] || 0) * 0.5, 0); // ของค้างคิดครึ่งราคาฐาน
const avg = arr => arr.reduce((x, y) => x + y, 0) / Math.max(1, arr.length);
const grp = (f) => agents.filter(f);
const res = {
  G2: avg(grp(a => a.mins === 240 && !a.start).map(wealth)) / avg(grp(a => a.mins === 60 && !a.start).map(wealth)),
  G3: (() => { const d = Math.min(days - 1, 14 + 7); return avg(grp(a => a.mins === 60 && a.start === 14).map(a => a.daily[d] || 0)) / Math.max(1, avg(grp(a => a.mins === 60 && !a.start).map(a => a.daily[d] || 0))); })(), // รายได้ต่อวันของคนเริ่มช้า 14 วัน หลังเล่นไป 7 วัน ÷ คนเริ่มก่อน (วันเดียวกัน เวลาเล่นเท่ากัน)
  G4: Object.fromEntries(Object.entries(share).map(([r, o]) => { const t = Object.values(o).reduce((x, y) => x + y, 0); return [r, t ? Math.max(...Object.values(o)) / t : 0]; })),
  G5: gini(agents.map(wealth)),
  G8: avg(grp(a => a.mins === 240 && !a.start).map(a => a.wish.reduce((n, w) => n + w.p, 0))),
};
const byFocus = Object.fromEntries([...SK, 'mix'].map(f => [f, Object.fromEntries([30, 60, 120, 240].map(m => [m, avg(grp(a => a.focus === f && a.mins === m && !a.start).map(wealth))]))]));
return { res, agents, wealth, avg, grp, byFocus };
}
if (require.main === module) {
const { res, agents, wealth, avg, grp } = run(days);
if (process.argv.includes('--json')) { console.log(JSON.stringify({ days, res, agents: agents.map(a => ({ id: a.id, wealth: Math.round(wealth(a)), coin: Math.round(a.coin), lv: Object.fromEntries(SK.map(k => [k, S.levelOf(a.xp[k])])) })) }, null, 1)); process.exit(0); }

const num = n => Math.round(n).toLocaleString('en-US');
console.log(`จำลอง ${days} วัน • ผู้เล่นจำลอง ${agents.length} คน (เวลาเล่น 30/60/120/240 นาที/วัน × อาชีพ 5 + ผสม × เริ่มวันที่ 0/14) • ทรัพย์สิน = เหรียญ + ของที่ซื้อ`);
console.log('\nทรัพย์สินเฉลี่ยตอนจบ (เริ่มวันที่ 0)');
console.log('อาชีพ'.padEnd(10) + [30, 60, 120, 240].map(m => (m + ' นาที').padStart(10)).join(''));
for (const f of [...SK, 'mix']) console.log((S.SKILLS[f] ? S.SKILLS[f].name : 'ผสม').padEnd(10) + [30, 60, 120, 240].map(m => num(avg(grp(a => a.focus === f && a.mins === m && !a.start).map(wealth))).padStart(10)).join(''));
console.log('\nราคาขายจริง ÷ ราคาฐาน (เทียบข้อมูลจริง: ผัก 76% สัตว์ 65% ไม้ 79% ปลา 108% อาหาร 118%)');
for (const f of SK) console.log((S.SKILLS[f].name).padEnd(10) + [30, 60, 120, 240].map(m => { const g = grp(a => a.focus === f && a.mins === m && !a.start); return (Math.round(g.reduce((n, a) => n + a.rev, 0) / Math.max(1, g.reduce((n, a) => n + a.gross, 0)) * 100) + '%').padStart(10); }).join(''));
console.log(`\nเลเวลเฉลี่ยตอนจบของอาชีพหลัก (คนเล่น 60 นาที/วัน): ` + SK.map(k => `${S.SKILLS[k].name} ${avg(grp(a => a.focus === k && a.mins === 60 && !a.start).map(a => S.levelOf(a.xp[k]))).toFixed(1)}`).join(' • '));
const ok = (v, pass) => pass ? `✅ ${v}` : `❌ ${v}`;
console.log('\n=== เกณฑ์ (ECONOMY-PLAN.md 1B) ===');
console.log(`G2 คนเล่น 240 ÷ 60 นาที/วัน: ${ok(res.G2.toFixed(2) + ' เท่า', res.G2 <= 2.5)} (เป้า ≤ 2.5 • เวลามากกว่า 4 เท่า)`);
console.log(`G3 ไล่ทัน: รายได้ต่อวันของคนเริ่มช้า 14 วัน หลังเล่น 7 วัน ÷ คนเริ่มก่อน (60 นาที/วันเท่ากัน): ${ok(Math.round(res.G3 * 100) + '%', res.G3 >= 0.9)} (เป้า ≥ 90%)`);
console.log(`G4 ส่วนแบ่งสูงสุดของคนเดียว: ต้นไม้ ${ok(Math.round(res.G4.wood * 100) + '%', res.G4.wood <= 0.4)} • ผลผลิตเล้า ${ok(Math.round(res.G4.animal * 100) + '%', res.G4.animal <= 0.4)} (เป้า ≤ 40%)`);
console.log(`G5 Gini ทรัพย์สิน: ${ok(res.G5.toFixed(2), res.G5 <= 0.5)} (เป้าจำลอง ≤ 0.5)`);
console.log(`G8 ของที่อยากได้แต่ยังซื้อไม่ครบ (คนเล่น 240 นาที วันที่ ${days}): ${ok(num(res.G8) + ' เหรียญ', res.G8 > 0)} (เป้า > 0 = ยังมีเป้าให้เก็บเงิน)`);
}
module.exports = { run, C };
