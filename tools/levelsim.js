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
  oreWalk: 6,      // วินาทีเดินระหว่างก้อนแร่ในถ้ำ (ถ้ำกว้าง ก้อนห่างกัน) + ขุดครั้งละ 0.7 วินาที
  treeRegen: 60000 / S.TREE.growMs, // ต้นไม้งอกใหม่ต่อนาทีทั้งห้อง (เพดานระยะยาวของการตัดไม้คนเดียว)
  EFF: 0.5,        // ผู้เล่นจริงทำได้กี่เท่าของเพดานนี้
};

function farm(lv) {
  const cap = Math.min(S.FARM_CAP.max, S.FARM_CAP.base + S.FARM_CAP.perLv * (lv - 1)), m = 1 + 0.04 * (lv - 1), wet = S.CANS[lv >= 6 ? 3 : lv >= 3 ? 2 : 1].wet;
  let best = null;
  for (const [k, c] of Object.entries(S.CROPS)) {
    if (c.lv > lv) continue;
    const grow = c.time / m, waters = Math.ceil(grow / wet), acts = 3 + waters; // ขุด ปลูก เก็บ + รดน้ำทุกครั้งที่ดินแห้ง
    if (S.cropCan && S.canTier({ can_2: lv >= 3, can_3: lv >= 6 }) < S.cropCan(c)) continue; // ยังไม่มีบัวที่พืชนี้ต้องใช้
    const ppm = Math.min(cap / (grow / 60000), M.apm / acts);                 // ต้นต่อนาที: ติดเพดานแปลงหรือแรงงาน
    const coin = ppm * (c.sell * M.cropPrice - c.seed) * 60, xp = ppm * (c.xp + 1 + 2 + waters) * 60;
    if (!best || coin > best.coin) best = { pick: k, coin, xp, gross: ppm * c.sell * 60, cost: ppm * c.seed * 60, pieces: ppm * 60, cat: 'crop' };
  }
  return best;
}
function fishPool(lv, rod, tier) {
  return S.FISH.filter(f => f.lv <= lv).map(f => ({ f, w: S.fishWeight(f, lv, rod, tier) })).filter(x => x.w > 0);
}
function fishCpm(lv, rod) { return 60 / (8.75 * Math.max(0.4, 1 - 0.05 * (lv - 1)) * (1 - 0.12 * (rod - 1)) + M.fishOver) * M.fishHit; }
function fish(lv) {
  const rod = lv >= 9 ? 4 : lv >= 6 ? 3 : lv >= 3 ? 2 : 1, cpm = fishCpm(lv, rod);
  let best = null;
  for (const t of [1, 2, 3]) {
    const b = S.BAITS[t]; if (b.lv && lv < b.lv) continue;
    const pool = fishPool(lv, rod, t), W = pool.reduce((a, x) => a + x.w, 0);
    const sell = pool.reduce((a, x) => a + x.w * x.f.sell, 0) / W, xp = pool.reduce((a, x) => a + x.w * x.f.xp, 0) / W;
    const coin = cpm * (sell - b.price) * 60;
    if (!best || coin > best.coin) best = { pick: 'เหยื่อ' + t, coin, xp: cpm * xp * 60, gross: cpm * sell * 60, cost: cpm * b.price * 60, pieces: cpm * 60, cat: 'fish' };
  }
  return best;
}
// สัดส่วนชนิดต้นไม้ที่งอกใหม่ (สุ่มตามที่เกิดจริงบนแมพ) ใช้คิดว่าต้นที่งอกมีกี่ส่วนที่เลเวล/ขวานนี้ฟันได้
const KIND_SHARE = (() => { if (!S.TREE_KINDS) return { broad: 1 }; const m = S.makeMap(), r = S.rng(5), d = {}; let n = 0;
  for (let i = 0; i < 4000; i++) { const x = 2 + Math.floor(r() * (S.W - 4)), y = 2 + Math.floor(r() * (S.H - 4)); if (!S.treeSpotOk(m, x, y)) continue; const k = S.pickTreeKind(m, x, y, r); d[k] = (d[k] || 0) + 1; n++; }
  for (const k of Object.keys(d)) d[k] /= n; return d; })();
function wood(lv) {
  const axe = lv >= 6 ? 3 : lv >= 3 ? 2 : 1, wl = 1 + (S.WOOD.xpPerLv || 0) * (lv - 1);
  const kinds = S.TREE_KINDS || { broad: { lv: 1, axe: 1, hp: S.TREE_HP, drop: [['log', 2]], bonus: [['hardwood', S.WOOD.hardwood.chance]] } }, items = S.WOOD_ITEMS || { log: S.WOOD.log, hardwood: S.WOOD.hardwood };
  let share = 0, val = 0, xp = 0, pcs = 0, secs = 0;
  for (const [id, K] of Object.entries(kinds)) {
    const sh = KIND_SHARE[id] || 0; if (!sh || K.lv > lv || K.axe > axe) continue; // ต้นที่ยังฟันไม่ได้ปล่อยไว้ให้คนเลเวลสูง
    let v = 0, x = 0, n = 0;
    K.drop.forEach(([it, q], i) => { const qq = q + (i === 0 ? 0.04 * (lv - 1) : 0); v += items[it].sell * qq; x += items[it].xp * qq; n += qq; });
    for (const [it, ch] of K.bonus || []) { const c = Math.min(1, ch + 0.01 * (lv - 1)); v += items[it].sell * c; x += items[it].xp * c; n += c; }
    share += sh; val += sh * v; xp += sh * x; pcs += sh * n; secs += sh * (Math.ceil(K.hp / S.AXES[axe].power) * 0.7 + M.treeWalk);
  }
  val /= share; xp /= share; pcs /= share; secs /= share;
  const tpm = Math.min(60 / secs, M.treeRegen * share); // ต้นต่อนาที: ติดความเร็วฟันหรือจำนวนต้นที่งอกแล้วฟันได้
  const craftXp = 0.27 * val; // แปรรูปเป็นเฟอร์นิเจอร์ ≈ 0.27 XP ต่อเหรียญของวัตถุดิบ (ลังไม้ = 34 XP จากไม้ท่อน 8 ท่อน)
  const best = S.CRAFT.filter(r => r.lv <= lv).slice(-1)[0];
  return { pick: best ? best.id.replace('furn_', '').slice(0, 6) : 'ขาย', coin: tpm * val * 60, xp: tpm * (xp + craftXp) * wl * 60, gross: tpm * val * 60, cost: 0, pieces: tpm * pcs * 60, cat: 'wood' };
}
function animal(lv) {
  const sp = Math.max(0.5, 1 - 0.05 * (lv - 1));
  let cyc = 0, xpc = 0, coinc = 0, gr = 0, fc = 0;
  for (const A of Object.values(S.ANIMALS)) {
    if (A.lv > lv) continue;
    const per = A.cap / ((A.time[0] + A.time[1]) / 2 * sp / 60000); // รอบผลิตต่อนาทีของเล้าเต็ม
    const prod = S.itemInfo(A.product), feed = S.itemInfo(A.feedItem);
    cyc += per; xpc += per * (S.animalXp ? S.animalXp(A.xp + 3, lv) : A.xp + 3); const yld = 1 + (S.ANIMAL_BONUS === undefined ? 0.5 : S.ANIMAL_BONUS); coinc += per * ((prod.sell || 0) * yld * 0.65 - feed.buy); gr += per * (prod.sell || 0) * yld; fc += per * feed.buy;
  }
  const f = Math.min(1, M.apm / 2 / cyc); // ให้อาหาร + เก็บ = 2 การกระทำต่อรอบ
  return { pick: 'เล้าเต็ม', coin: coinc * f * 60, xp: xpc * f * 60, gross: gr * f * 60, cost: fc * f * 60, pieces: cyc * (1 + (S.ANIMAL_BONUS === undefined ? 0.5 : S.ANIMAL_BONUS)) * f * 60, cat: 'animal' };
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
    if (!best || xp > best.xp) best = { pick: r.id.replace('dish_', ''), coin, xp, gross: 60 / min * r.sell, cost: 60 / min * fee, pieces: 60 / min, cat: 'dish' };
  }
  return best;
}

// ขุดเหมือง: ก้อนแร่ในถ้ำมีจำกัดตายตัว (S.caveOreSpots) เกิดใหม่ตามชั้นความลึก (S.MINE.respawn) • เพดาน = ติดความเร็วขุดหรือจำนวนก้อนที่เกิดใหม่ทั้งถ้ำ (ผู้เล่นหลายคนแบ่งกัน)
const CAVE_NODES = (() => { const d = {}; for (const o of S.caveOreSpots(S.makeCaveMap())) { const e = d[o.k] || (d[o.k] = { n: 0, perMin: 0 }); e.n++; e.perMin += 60000 / S.MINE.respawn[S.caveTier(o.y)]; } return d; })();
function mine(lv) {
  const pk = lv >= 6 ? 3 : lv >= 3 ? 2 : 1, wl = 1 + S.MINE.xpPerLv * (lv - 1), power = S.PICKS[pk].power, wearPerHit = S.WEAR_RATE.base * 1.3, perHit = S.TOOL_PRICE.pick[pk] / S.DURABILITY.pick.max[pk] * wearPerHit * 1.35; // 1.35 = ซ่อม/ซื้อใหม่เฉลี่ย
  let supply = 0, val = 0, xp = 0, pcs = 0, secs = 0, cost = 0;
  const elig = Object.entries(S.ORES).filter(([k, o]) => o.lv <= lv && o.pick <= pk && CAVE_NODES[k]);
  for (const [k, o] of elig) supply += CAVE_NODES[k].perMin;
  for (const [k, o] of elig) {
    const sh = CAVE_NODES[k].perMin / supply, bi = S.ORES[o.bonus[0]], bc = Math.min(1, o.bonus[1] + 0.01 * (lv - 1)), hits = Math.ceil(o.hp / power);
    val += sh * (o.drop * o.sell + bc * bi.sell); xp += sh * (o.drop * o.xp + bc * bi.xp); pcs += sh * (o.drop + bc); secs += sh * (hits * 0.7 + M.oreWalk); cost += sh * hits * perHit;
  }
  const npm = Math.min(60 / secs, supply);
  return { pick: elig.slice(-1)[0][0], coin: npm * (val - cost) * 60, xp: npm * xp * wl * 60, gross: npm * val * 60, cost: npm * cost * 60, pieces: npm * pcs * 60, cat: 'ore' };
}
const SIMS = { farm, fish, animal, wood, cook, mine };
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
module.exports = { M, SIMS, simulate, hoursTo };
