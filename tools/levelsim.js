'use strict';
// จำลอง XP และเหรียญต่อชั่วโมงของแต่ละอาชีพในแต่ละเลเวล จากค่าใน public/shared.js (อ่านอย่างเดียว ไม่แตะข้อมูลผู้เล่น)
// ใช้: node tools/levelsim.js        → ตาราง XP/ชม. เทียบชาวนา + เวลาเล่นโดยประมาณถึงแต่ละเลเวล
//      node tools/levelsim.js --json → ผลดิบเป็น JSON
// ใช้ตอนปรับ XP_TABLE / XP ของพืช ปลา ไม้ สูตรอาหาร: เป้าคือทุกอาชีพที่เลเวลเดียวกันได้ XP/ชม. ห่างจากชาวนาไม่เกิน ±25% (ECONOMY-PLAN.md ขั้น 1B)
// ทุกตัวเลขเป็น "เพดานบนของผู้เล่นคนเดียวที่ลงมือต่อเนื่อง" ไม่ใช่ค่าเฉลี่ยของคนจริง • ผู้เล่นจริงช้ากว่าราว EFF เท่า (ข้อมูล ต.ค. 2026: ชาวนา Lv10 ใน ~46 นาที)
// เลือก "ทางที่ได้เงินมากสุด" ในแต่ละเลเวล (ผู้เล่นเลือกพืช/เหยื่อ/สูตรตามเงิน) แล้วรายงาน XP ของทางนั้น
const S = require('../public/shared.js');

const M = {
  apm: 20,         // จำนวนการกระทำต่อนาที รวมเดิน (ขุด ปลูก รดน้ำ เก็บ ให้อาหาร ประดิษฐ์ ฯลฯ)
  cropPrice: 0.76, // ราคาขายจริงของผัก ÷ ราคาฐาน (ข้อมูลจริง 7 วัน)
  fishOver: 3,     // วินาทีนอกเวลารอปลาต่อการเหวี่ยง 1 ครั้ง (เหวี่ยง กดเกจ เก็บ)
  fishHit: 0.8,    // สัดส่วนที่กดเกจโดน
  treeWalk: 5,     // วินาทีเดินระหว่างต้นไม้ + ฟันครั้งละ 0.7 วินาที
  treeRegen: 60000 / S.TREE.growMs, // ต้นไม้งอกใหม่ต่อนาทีทั้งห้อง (เพดานระยะยาวของการตัดไม้คนเดียว)
  EFF: 0.5,        // ผู้เล่นจริงทำได้กี่เท่าของเพดานนี้
};

function farm(lv) {
  const cap = Math.min(S.FARM_CAP.max, S.FARM_CAP.base + S.FARM_CAP.perLv * (lv - 1)), m = 1 + 0.04 * (lv - 1), wet = S.CANS[lv >= 6 ? 3 : lv >= 3 ? 2 : 1].wet;
  let best = null;
  for (const [k, c] of Object.entries(S.CROPS)) {
    if (c.lv > lv) continue;
    const grow = c.time / m, waters = Math.ceil(grow / wet), acts = 3 + waters; // ขุด ปลูก เก็บ + รดน้ำทุกครั้งที่ดินแห้ง
    const ppm = Math.min(cap / (grow / 60000), M.apm / acts);                 // ต้นต่อนาที: ติดเพดานแปลงหรือแรงงาน
    const coin = ppm * (c.sell * M.cropPrice - c.seed) * 60, xp = ppm * (c.xp + 1 + 2 + waters) * 60;
    if (!best || coin > best.coin) best = { pick: k, coin, xp };
  }
  return best;
}
function fishPool(lv, rod, tier) {
  return S.FISH.filter(f => f.lv <= lv).map(f => ({ f, w: f.w * (f.sell >= 100 ? 1 + 0.12 * (lv - 1) + 0.35 * (rod - 1) : 1) / (f.id === 'boot' ? 1 + rod : 1) * S.baitWeight(f, tier) })).filter(x => x.w > 0);
}
function fishCpm(lv, rod) { return 60 / (8.75 * Math.max(0.4, 1 - 0.05 * (lv - 1)) * (1 - 0.12 * (rod - 1)) + M.fishOver) * M.fishHit; }
function fish(lv) {
  const rod = lv >= 6 ? 3 : lv >= 3 ? 2 : 1, cpm = fishCpm(lv, rod);
  let best = null;
  for (const t of [1, 2, 3]) {
    const b = S.BAITS[t]; if (b.lv && lv < b.lv) continue;
    const pool = fishPool(lv, rod, t), W = pool.reduce((a, x) => a + x.w, 0);
    const sell = pool.reduce((a, x) => a + x.w * x.f.sell, 0) / W, xp = pool.reduce((a, x) => a + x.w * x.f.xp, 0) / W;
    const coin = cpm * (sell - b.price) * 60;
    if (!best || coin > best.coin) best = { pick: 'เหยื่อ' + t, coin, xp: cpm * xp * 60 };
  }
  return best;
}
function wood(lv) {
  const axe = lv >= 6 ? 3 : lv >= 3 ? 2 : 1, hits = Math.ceil(S.TREE_HP / S.AXES[axe].power);
  const tpm = Math.min(60 / (hits * 0.7 + M.treeWalk), M.treeRegen);
  const logs = 2 + 0.04 * (lv - 1), hard = Math.min(1, S.WOOD.hardwood.chance + 0.01 * (lv - 1));
  const chopXp = S.WOOD.log.xp * logs + S.WOOD.hardwood.xp * hard;
  // แปรรูป: สูตรที่ได้ XP ต่อต้นมากสุด (ไม้กระดาน = 2 ท่อน • ต้นที่ต้องโค่นต่อชิ้น = ตามไม้ท่อนหรือไม้เนื้อแข็ง แล้วแต่อย่างไหนขาดก่อน)
  const wl = 1 + (S.WOOD.xpPerLv || 0) * (lv - 1); // ตัวคูณ XP ช่างไม้ตามเลเวล (โค่นและประดิษฐ์)
  let best = { pick: 'ขายท่อน', perTree: 0 };
  for (const r of S.CRAFT) {
    if (r.lv > lv || r.id === 'plank') continue;
    const pl = r.in.plank || 0, lg = (r.in.log || 0) + 2 * pl, hw = r.in.hardwood || 0;
    const xp = r.xp + pl * S.CRAFT.find(c => c.id === 'plank').xp, trees = Math.max(lg / logs, hw / hard);
    if (xp / trees > best.perTree) best = { pick: r.id.replace('furn_', ''), perTree: xp / trees };
  }
  const xp = tpm * (chopXp + best.perTree) * wl * 60;
  const coin = tpm * (logs * S.WOOD.log.sell + hard * S.WOOD.hardwood.sell) * 60; // ขายดิบ (เงินไม่ใช่เป้าของเครื่องมือนี้)
  return { pick: best.pick, coin, xp };
}
function animal(lv) {
  const sp = Math.max(0.5, 1 - 0.05 * (lv - 1));
  let cyc = 0, xpc = 0, coinc = 0;
  for (const A of Object.values(S.ANIMALS)) {
    if (A.lv > lv) continue;
    const per = A.cap / ((A.time[0] + A.time[1]) / 2 * sp / 60000); // รอบผลิตต่อนาทีของเล้าเต็ม
    const prod = S.itemInfo(A.product), feed = S.itemInfo(A.feedItem);
    cyc += per; xpc += per * (A.xp + 3); coinc += per * ((prod.sell || 0) * 1.5 * 0.65 - feed.buy);
  }
  const f = Math.min(1, M.apm / 2 / cyc); // ให้อาหาร + เก็บ = 2 การกระทำต่อรอบ
  return { pick: 'เล้าเต็ม', coin: coinc * f * 60, xp: xpc * f * 60 };
}
function cook(lv) {
  // นาทีที่ต้องใช้หาวัตถุดิบ 1 ชิ้น เมื่ออาชีพอื่นเลเวลเท่ากัน: ปลาถูกสุด/ผักถูกสุด/ไข่ = เวลาลงมือ (ไม่นับรอโต)
  const rod = lv >= 6 ? 3 : lv >= 3 ? 2 : 1, fishMin = 1 / fishCpm(lv, rod), cropMin = 4 / M.apm, eggMin = 2 / M.apm / 1.5;
  const need = { fish: fishMin, crop: cropMin, egg: eggMin, milk: eggMin, meal_bread: 0 };
  let best = null;
  for (const r of S.COOK) {
    if (r.lv > lv) continue;
    let min = r.time / 60000 + 1 / M.apm;
    for (const x of r.in) min += x.n * (need[x.c || x.k] || 0);
    const fee = r.sell * S.COOK_FEE, coin = 60 / min * (r.sell - fee), xp = 60 / min * r.xp;
    if (!best || xp > best.xp) best = { pick: r.id.replace('dish_', ''), coin, xp };
  }
  return best;
}

const SIMS = { farm, fish, animal, wood, cook };
function simulate() {
  const out = {};
  for (const [k, fn] of Object.entries(SIMS)) out[k] = Array.from({ length: S.MAX_LV }, (_, i) => Object.assign({ lv: i + 1 }, fn(i + 1)));
  return out;
}
// ชั่วโมงเล่นจริงโดยประมาณถึงแต่ละเลเวล (ใช้ XP/ชม. ของเลเวลปัจจุบัน × EFF)
function hoursTo(rows) { const h = [0]; for (let lv = 1; lv < S.MAX_LV; lv++) h.push(h[lv - 1] + (S.xpFor(lv + 1) - S.xpFor(lv)) / (rows[lv - 1].xp * M.EFF)); return h; }

if (require.main === module) {
  const r = simulate();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 1)); process.exit(0); }
  const num = n => Math.round(n).toLocaleString('en-US');
  console.log(`XP/ชม. (เพดานคนเดียว) และ % เทียบชาวนาที่เลเวลเดียวกัน • เป้า 75–125%`);
  console.log('Lv | ' + Object.keys(SIMS).map(k => S.SKILLS[k].name.padEnd(18)).join('| '));
  for (let i = 0; i < S.MAX_LV; i++) {
    const f = r.farm[i].xp;
    console.log(String(i + 1).padStart(2) + ' | ' + Object.keys(SIMS).map(k => { const x = r[k][i], pct = Math.round(x.xp / f * 100), bad = k !== 'farm' && (pct < 75 || pct > 125) ? '!' : ' ';
      return `${num(x.xp).padStart(6)} ${String(pct).padStart(3)}%${bad} ${x.pick.slice(0, 6).padEnd(6)}`; }).join('| '));
  }
  console.log(`\nชั่วโมงเล่นจริงโดยประมาณถึงเลเวล (XP/ชม. × ${M.EFF})`);
  console.log('อาชีพ'.padEnd(12) + [3, 5, 7, 10].map(l => ('Lv' + l).padStart(7)).join(''));
  for (const k of Object.keys(SIMS)) { const h = hoursTo(r[k]); console.log(S.SKILLS[k].name.padEnd(12) + [3, 5, 7, 10].map(l => h[l - 1].toFixed(1).padStart(7)).join('')); }
  console.log(`\nเหรียญ/ชม. (เพดานคนเดียว ตามทางที่เลือก)`);
  for (const k of Object.keys(SIMS)) console.log(S.SKILLS[k].name.padEnd(12) + r[k].map(x => num(x.coin).padStart(7)).join(''));
}
module.exports = { M, simulate, hoursTo };
