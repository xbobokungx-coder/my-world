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
  animalPrice: 0.65, // ราคาขายจริงของผลผลิตสัตว์ ÷ ราคาฐาน (ข้อมูลจริง 7 วัน เหมือน cropPrice • econsim มีตลาดอิ่มตัวของมันเอง cal.animal 0.4 อีกชั้น)
  fishOver: 3,     // วินาทีนอกเวลารอปลาต่อการเหวี่ยง 1 ครั้ง (เหวี่ยง กดเกจ เก็บ)
  fishHit: 0.8,    // สัดส่วนที่กดเกจโดน
  treeWalk: 5,     // วินาทีเดินระหว่างต้นไม้ + ฟันครั้งละ 0.7 วินาที
  oreWalk: 6,      // วินาทีเดินหาก้อนแร่ถัดไปในถ้ำ (ชั้นละ ~30–40 ก้อน ห่างกัน ≥ 3 ช่อง) + ขุดครั้งละ 0.7 วินาที
  treeRegen: 60000 / S.TREE.growMs, // ต้นไม้งอกใหม่ต่อนาทีทั้งห้อง (เพดานระยะยาวของการตัดไม้คนเดียว)
  mktMul: 1.0,     // ราคาตลาดผู้เล่นของวัตถุดิบ ÷ ราคาขายฐาน (เชฟซื้อ, WP-22) • แผงขายตั้งได้ 0.5–2 เท่า (STALL.min/max)
  buyAct: 0.25,    // จำนวนการกระทำต่อวัตถุดิบ 1 ชิ้นตอนซื้อจากตลาด (ซื้อทีละหลายชิ้น)
  EFF: 0.5,        // ผู้เล่นจริงทำได้กี่เท่าของเพดานนี้
  season: !process.argv.includes('--noseason'), // คิดข้อจำกัดฤดูของชาวนา (season-planting) • --noseason = ฐานเดิมไม่มีฤดู
  gear: !process.argv.includes('--nogear'),     // WP-23: คิดโบนัส+ค่าสึกของจอบ/ตะกร้า-ถัง/กระทะ • --nogear = ฐานเดิมก่อน WP-23 (ไม่มีอุปกรณ์ บัวใช้เกณฑ์ Lv3/Lv6 เดิม)
};
// WP-23: อุปกรณ์ชาวนา/คนเลี้ยงสัตว์/เชฟ 10 ระดับ • ใช้ฟังก์ชันกลางเดียวกับเซิร์ฟเวอร์ (S.hoeHit / S.pailHit+pailChance / S.panHit+panFee) • ปลดทุก 2 เลเวล (ซื้อทันทีที่ปลด) • lag = ไม่อัป ใช้ต่ำกว่าระดับที่ปลดแล้วกี่ระดับ
const gearAt = (list, lv) => { let t = 1; for (const [k, v] of Object.entries(list)) if (v.lv && lv >= v.lv) t = Math.max(t, +k); return t; };
const hoeAt = lv => gearAt(S.HOES, lv), pailAt = lv => gearAt(S.PAILS, lv), panAt = lv => gearAt(S.PANS, lv);
const NEWCAN = M.gear; // บัวตามตาราง CANS ใหม่ (Lv5 ได้บัว 3) ตายตัวตามธง --nogear ไม่ขยับตอนเปิด/ปิดอุปกรณ์ชั่วคราวเทียบ
const canAt = lv => NEWCAN ? gearAt(S.CANS, lv) : (lv >= 6 ? 3 : lv >= 3 ? 2 : 1); // --nogear = เกณฑ์เดิม (บัว 3 ที่ Lv6)
// ค่าสึกเฉลี่ยต่อ "ครั้งใช้" ที่ตัวคูณสึก 1 (ราคา÷ทน×WEAR_RATE.base×1.35 แบบเดียวกับขวาน/คัน/อีเต้อ) • ต้องคูณ wear จาก gearHit เอง
const gearWear = (tool, tier) => S.TOOL_PRICE[tool][tier] / S.DURABILITY[tool].max[tier] * S.WEAR_RATE.base * 1.35;
const invOf = (tool, t) => t > 1 ? { [tool + '_' + t]: 1 } : {};
const withGear = (on, fn) => { const g = M.gear; M.gear = on; try { return fn(); } finally { M.gear = g; } };

// ชาวนา: ถ้าเปิด M.season (ค่าเริ่ม) คิดข้อจำกัดฤดูของ season-planting (S.SEASONS: พืช lv ≤ freeLv ปลูกได้ทุกฤดู ราคา ×1 • พืช lv > freeLv ปลูกได้เฉพาะฤดูตัวเอง ราคาในฤดู ×inMul) แล้ว "เฉลี่ยทุกฤดูในวงจร" (ฤดูยาวเท่ากัน) • ปิดด้วย --noseason = ไม่มีฤดู (ฐานเดิมก่อน season-planting)
const seasonList = () => (M.season && S.SEASONS && S.SEASONS.lockCrops !== undefined && S.canPlant && S.cropSeason) ? S.SEASONS.list : null;
function farmIn(lv, t, lag = 0) { // lag = ไม่อัปจอบ • t = เวลาในฤดูที่ต้องการ (undefined = ไม่คิดฤดู) • byXp = เลือกพืชตาม XP/ชม. แทนเหรียญ/ชม.
  const cap = Math.min(S.FARM_CAP.max, S.FARM_CAP.base + S.FARM_CAP.perLv * (lv - 1)), m = 1 + 0.04 * (lv - 1), wet = S.CANS[canAt(lv)].wet, ht = M.gear ? Math.max(1, hoeAt(lv) - lag) : 1, hinv = invOf('hoe', ht);
  let best = null, bestX = null;
  for (const [k, c] of Object.entries(S.CROPS)) {
    if (c.lv > lv || c.legacy) continue;
    let pm = 1; // ตัวคูณราคาตามฤดู
    if (t !== undefined) { if (!S.canPlant(k, t)) continue; pm = S.cropSeason(k, t) === 1 ? S.SEASONS.inMul : 1; }
    const grow = c.time / m, waters = Math.ceil(grow / wet), acts = 3 + waters; // ขุด ปลูก เก็บ + รดน้ำทุกครั้งที่ดินแห้ง
    if (S.cropCan && canAt(lv) < S.cropCan(c)) continue; // ยังไม่มีบัวที่พืชนี้ต้องใช้
    const ppm = Math.min(cap / (grow / 60000), M.apm / acts);                 // ต้นต่อนาที: ติดเพดานแปลงหรือแรงงาน
    const gh = M.gear ? S.hoeHit(hinv, c) : { bonus: 0, wear: 0 }, wc = M.gear && gh.wear > 0 ? gearWear('hoe', ht) * gh.wear : 0; // จอบ: โอกาสพืช +1 ตอนเก็บ (ขายได้ตามราคาตลาด) และจอบสึกต่อการเก็บเกี่ยว (ไม่นับสึกตอนขุด: ช่องที่ขุดแล้วอยู่ต่อหลังเก็บ)
    const coin = ppm * (c.sell * (1 + gh.bonus) * M.cropPrice * pm - c.seed - wc) * 60, xp = ppm * (c.xp + 1 + 2 + waters) * 60;
    const r = { pick: k, coin, xp, gross: ppm * c.sell * (1 + gh.bonus) * pm * 60, cost: ppm * c.seed * 60, wear: ppm * wc * 60, pieces: ppm * (1 + gh.bonus) * 60, cat: 'crop' };
    if (!best || coin > best.coin) best = r;
    if (!bestX || xp > bestX.xp) bestX = r;
  }
  best.byXp = { pick: bestX.pick, coin: bestX.coin, xp: bestX.xp }; return best;
}
function farm(lv, lag = 0) {
  const L = seasonList(); if (!L) return farmIn(lv, undefined, lag);
  const rows = L.map(se => Object.assign({ id: se.id }, farmIn(lv, S.SEASONS.epoch + L.indexOf(se) * S.SEASONS.days * 864e5 + 1, lag))), n = rows.length, avg = k => rows.reduce((a, r) => a + r[k], 0) / n;
  return { pick: rows.map(r => r.pick.slice(0, 3)).join('/'), coin: avg('coin'), xp: avg('xp'), gross: avg('gross'), cost: avg('cost'), wear: avg('wear'), pieces: avg('pieces'), cat: 'crop', seasons: rows };
}
function fishPool(lv, rod, tier, sea) { // sea = true: ปลาทะเล (ชุดแยก) • fishWeight รวมสระเลื่อน FISHPOOL (fishPoolMul) แล้ว
  return S.FISH.filter(f => !!f.sea === !!sea && f.lv <= lv).map(f => ({ f, w: S.fishWeight(f, lv, rod, tier) })).filter(x => x.w > 0);
}
// ชักเย่อกับปลา (5 พ.ย. 2026): เวลาต่อสู้เฉลี่ย/โอกาสชนะ ตามกลุ่มราคาปลา 0–3 (จากบอทมือคน tools/test-fight.js ตอบสนอง 250 ms คันที่ปลากลุ่มนั้นออกได้) ถ่วงด้วยน้ำหนักปลาที่ตกได้ ณ เลเวลนั้น
const FIGHT_SEC = [1.0, 3.4, 5.6, 7.5], FIGHT_WIN = [1, 1, 0.97, 0.8];
// 13 พ.ย. 2026 (WP-11): คันต่ำกว่าระดับปลา → โอกาสชนะ ×0.85^ระดับที่ขาด (S.rodHit) และคันสึก ×(1+0.5×ขาด) / ÷(1+0.25×เกิน) • wear = ตัวคูณสึกเฉลี่ยถ่วงน้ำหนักปลา
function mixOf(pool, rod) { const W = pool.reduce((a, x) => a + x.w, 0) || 1; let sec = 0, win = 0, wear = 0; for (const x of pool) { const c = S.fishClass(x.f), rh = S.rodHit(rod, x.f); sec += x.w * FIGHT_SEC[c]; win += x.w * FIGHT_WIN[c] * rh.win; wear += x.w * rh.wear; } return { sec: sec / W, win: win / W, wear: wear / W }; }
// rs = สัดส่วนที่จับได้เป็นปลาหายากจริง (ติดพักรอบ จึงน้อยกว่าน้ำหนักสุ่ม) • ไม่ส่ง rs = ไม่คิดพักรอบ (ใช้ใน cook)
function fightMix(lv, rod, sea, rs) {
  const pool = fishPool(lv, rod, 1, sea), rare = pool.filter(x => x.f.sell >= S.RARE_SELL), com = pool.filter(x => x.f.sell < S.RARE_SELL);
  if (rs === undefined || !rare.length || !com.length) return mixOf(pool, rod);
  const a = mixOf(rare, rod), c = mixOf(com, rod); return { sec: rs * a.sec + (1 - rs) * c.sec, win: rs * a.win + (1 - rs) * c.win, wear: rs * a.wear + (1 - rs) * c.wear };
}
function fishCpm(lv, rod, sea, rs) { const fm = fightMix(lv, rod, sea, rs); return 60 / (8.75 * S.ACTION_TUNE.fish * Math.max(0.4, 1 - 0.05 * (S.perkLv(lv) - 1)) * S.ROD_WAIT[rod] + M.fishOver + fm.sec) * M.fishHit * fm.win; }
const rodAt = lv => { let r = 1; for (const [k, v] of Object.entries(S.RODS)) if (v.lv && lv >= v.lv) r = Math.max(r, +k); return r; }; // คันที่ซื้อได้ตามเลเวล (ซื้อทันทีที่ปลด)
// ตกปลา (6 พ.ย. 2026): จำลองสระเลื่อน (FISHPOOL ผ่าน S.fishWeight) + พักรอบเฉพาะปลา ≥ RARE_SELL (เวลาชักเย่อคิดตามสัดส่วนปลาหายากจริงหลังพักรอบ) • ต้นทุน = เหยื่อ + เบ็ดสึกต่อ "การเหวี่ยง" (เหวี่ยงพลาดก็เสียเหยื่อและสึก จึงหารด้วยโอกาสโดน×ชนะ) • sea = ปลาทะเล (หักค่าเรือ SEA.fee ต่อ SEA.ms ถ้าไม่มีเรือ)
function fish(lv, sea, lag = 0) { // lag = ผู้เล่นไม่อัปคัน ใช้ต่ำกว่าระดับที่ปลดแล้วกี่ระดับ (0 = ซื้อสูงสุดตามเลเวล เพดานบน)
  const rod = Math.max(1, rodAt(lv) - lag), wearBase = S.TOOL_PRICE.rod[rod] / S.DURABILITY.rod.max[rod] * S.WEAR_RATE.base * 1.35; // ซ่อม/ซื้อใหม่เฉลี่ยต่อการเหวี่ยง (ตัวคูณ 1.35 แบบเดียวกับนักขุด) × ตัวคูณสึกตามระดับปลา (fm.wear) คิดในลูป
  const seaFee = sea ? S.SEA.fee * 3600000 / S.SEA.ms / 60 : 0; // ค่าเรือต่อนาที (ไม่ทำค่าเดินทางไปท่า)
  let best = null;
  for (const t of [1, 2, 3]) {
    const b = S.BAITS[t]; if (b.lv && lv < b.lv) continue;
    const pool = fishPool(lv, rod, t, sea).map(x => ({ f: Object.assign({}, x.f, { xp: x.f.xp * S.FIGHT.xpMul[S.fishClass(x.f)] }), w: x.w })), W = pool.reduce((a, x) => a + x.w, 0); // XP คูณตามกลุ่มปลา (ชักเย่อ)
    // ปลาราคา ≥ RARE_SELL ติดคูลดาวน์ RARE_CD_MS หลังได้หนึ่งตัว (ตัวถัดไปรอเวลา + รอสุ่มโดน): อัตราปลาหายาก/ชม. = 1 / (1/(ครั้งตกที่สุ่มโดน/ชม.) + คูลดาวน์) ส่วนที่เหลือเป็นปลาทั่วไป
    const rare = pool.filter(x => x.f.sell >= S.RARE_SELL), com = pool.filter(x => x.f.sell < S.RARE_SELL), WR = rare.reduce((a, x) => a + x.w, 0), WC = com.reduce((a, x) => a + x.w, 0) || 1, cd = S.rareCdMs(lv) / 3600000;
    let rs = 0, cpm, N, rr; // วนหาสัดส่วนปลาหายากจริง (อัตรา ↔ เวลาต่อครั้ง)
    for (let i = 0; i < 6; i++) { cpm = fishCpm(lv, rod, sea, rs); N = cpm * 60; rr = WR > 0 ? 1 / (1 / (N * WR / W) + cd) : 0; rs = rr / N; }
    const fm = fightMix(lv, rod, sea, rs), cast = cpm / (M.fishHit * fm.win), cr = Math.max(0, N - rr), wearCast = wearBase * fm.wear; // cast = เหวี่ยงต่อนาที
    const avg = (arr, k, w0) => arr.reduce((a, x) => a + x.w * x.f[k], 0) / (w0 || 1);
    const sellH = rr * avg(rare, 'sell', WR) + cr * avg(com, 'sell', WC), xpH = rr * avg(rare, 'xp', WR) + cr * avg(com, 'xp', WC);
    const sell = sellH / N, xp = xpH / N, cost = cast * (b.price + wearCast) + seaFee, wear = cast * wearCast;
    const coin = cpm * sell * 60 - cost * 60;
    if (!best || coin > best.coin) best = { pick: 'เหยื่อ' + t, coin, xp: cpm * xp * 60, gross: cpm * sell * 60, cost: cost * 60, wear: wear * 60, pieces: cpm * 60, rare: rr, cat: 'fish', rod, bait: t };
  }
  return best;
}
const fishSea = lv => Object.assign({ lv }, fish(lv, true)); // ทะเล: เทียบกับ fish(lv) น้ำจืด (ไม่อยู่ใน SIMS ไม่นับเข้าตารางหลัก)
// เป้าชาวประมง (ล็อก 6 พ.ย. 2026, docs/plans/fish-rework.md): ถึง Lv20 = 20 ชม.เล่นจริง • Lv1→2 = 15 นาที โตเวลาต่อเลเวล ×1.1412 • XP/ชม.จริงเลเวล L = 1,000 × 1.1412^(L−1) (ตรงตาราง XP_TABLE_STD) • ในซิมเป็นเพดาน = จริง ÷ EFF
const FISH_GOAL = { lv1Min: 15, growth: 1.1412, xpH: 1000, tol: 0.10 };
const fishGoalXpH = lv => FISH_GOAL.xpH * Math.pow(FISH_GOAL.growth, lv - 1) / M.EFF; // เพดานต่อชม. ของเลเวล lv
const fishGoalHours = lv => { let m = 0; for (let k = 1; k < lv; k++) m += FISH_GOAL.lv1Min * Math.pow(FISH_GOAL.growth, k - 1); return m / 60; };
// สัดส่วนชนิดต้นไม้ที่งอกใหม่ ใช้คิดว่าต้นที่งอกมีกี่ส่วนที่เลเวล/ขวานนี้ฟันได้
const KIND_SHARE = (() => { if (!S.TREE_KINDS) return { broad: 1 }; const d = {}; for (const [k, K] of Object.entries(S.TREE_KINDS)) d[k] = K.pct / 100; return d; })(); // ต้นไม้ที่งอกใหม่ถูกคุมสัดส่วนตามโควตา % ของแต่ละชนิด (S.TREE_KINDS[..].pct)
// ช่างไม้ (13 พ.ย. 2026 WP-10): ใช้ S.chopHit จริง (ต้นไม้ระดับ ⌈Lv÷2⌉ HP 5×ระดับ ขวาน 10 ระดับ) • ขวานสึก 1 ครั้งต่อ "การฟัน" ไม่ใช่ต่อต้น (server.js ฟันละครั้ง) × ตัวคูณสึกของ chopHit • สูตรสึกเดียวกับเหมือง/ตกปลา (ราคา÷ทน×WEAR_RATE.base×1.35) • lag = ไม่อัปขวาน ใช้ต่ำกว่าระดับที่ปลดแล้วกี่ระดับ
const axeAt = lv => { let a = 1; for (const [k, v] of Object.entries(S.AXES)) if (v.lv && lv >= v.lv) a = Math.max(a, +k); return a; }; // ขวานที่ซื้อได้ตามเลเวล (ซื้อทันทีที่ปลด)
function wood(lv, lag = 0) {
  const axe = Math.max(1, axeAt(lv) - lag), inv = { ['axe_' + axe]: 1 }, wl = 1 + (S.WOOD.xpPerLv || 0) * (S.perkLv(lv) - 1), wearBase = S.TOOL_PRICE.axe[axe] / S.DURABILITY.axe.max[axe] * S.WEAR_RATE.base * 1.35;
  const kinds = S.TREE_KINDS || { broad: { lv: 1, axe: 1, hp: S.TREE_HP, drop: [['log', 2]], bonus: [['hardwood', S.WOOD.hardwood.chance]] } }, items = S.WOOD_ITEMS || { log: S.WOOD.log, hardwood: S.WOOD.hardwood };
  let share = 0, val = 0, xp = 0, pcs = 0, secs = 0, wearC = 0;
  for (const [id, K] of Object.entries(kinds)) {
    const sh = KIND_SHARE[id] || 0; if (!sh || K.lv > lv) continue;
    const mh = S.chopHit ? S.chopHit(inv, id) : { dmg: S.AXES[axe].power, hits: Math.ceil(K.hp / S.AXES[axe].power), wear: 1, extra: 0 }; if (!mh || mh.blocked) continue; // ต้นที่ยังฟันไม่ได้ปล่อยไว้ให้คนเลเวลสูง
    let v = 0, x = 0, n = 0;
    K.drop.forEach(([it, q], i) => { const qq = q + (i === 0 ? 0.04 * (S.perkLv(lv) - 1) + mh.extra : 0); v += items[it].sell * qq; x += items[it].xp * qq; n += qq; }); // extra = โอกาสได้ชิ้นหลัก +1 (ขวานสูงกว่าต้น)
    for (const [it, ch] of K.bonus || []) { const c = Math.min(1, ch + 0.01 * (S.perkLv(lv) - 1)); v += items[it].sell * c; x += items[it].xp * c; n += c; }
    share += sh; val += sh * v; xp += sh * x; pcs += sh * n; secs += sh * (mh.hits * 0.7 + M.treeWalk); wearC += sh * mh.hits * wearBase * mh.wear;
  }
  val /= share; xp /= share; pcs /= share; secs /= share; wearC /= share;
  const tpm = Math.min(60 / secs, M.treeRegen * share); // ต้นต่อนาที: ติดความเร็วฟันหรือจำนวนต้นที่งอกแล้วฟันได้
  const craftXp = 0.27 * val; // แปรรูปเป็นเฟอร์นิเจอร์ ≈ 0.27 XP ต่อเหรียญของวัตถุดิบ (ลังไม้ = 34 XP จากไม้ท่อน 8 ท่อน)
  const best = S.CRAFT.filter(r => r.lv <= lv).slice(-1)[0];
  return { pick: best ? best.id.replace('furn_', '').slice(0, 6) : 'ขาย', coin: tpm * (val - wearC) * 60, xp: tpm * (xp + craftXp) * wl * 60, gross: tpm * val * 60, cost: tpm * wearC * 60, pieces: tpm * pcs * 60, cat: 'wood', axe, trees: tpm * 60 };
}
function animal(lv, lag = 0) { // lag = ไม่อัปตะกร้า-ถัง
  const pt = M.gear ? Math.max(1, pailAt(lv) - lag) : 1, pinv = invOf('pail', pt);
  const sp = Math.max(0.5, 1 - 0.05 * (S.perkLv(lv) - 1)); // เซิร์ฟเวอร์ใช้ perkLv (ตัน Lv10) ที่ server.js:551 (WP-21: เดิมใช้ lv เลยเร็วเกินจริงที่ Lv11+)
  let cyc = 0, xpc = 0, coinc = 0, gr = 0, fc = 0, wr = 0, pcs = 0;
  for (const A of Object.values(S.ANIMALS)) {
    if (A.lv > lv) continue;
    const per = A.cap / ((A.time[0] + A.time[1]) / 2 * sp / 60000); // รอบผลิตต่อนาทีของเล้าเต็ม
    const prod = S.itemInfo(A.product), feed = S.itemInfo(A.feedItem);
    cyc += per; xpc += per * (S.animalXp ? S.animalXp(A.xp, lv) + S.animalXp(A.feedXp != null ? A.feedXp : S.ANIMAL_XP.feed, lv) : A.xp + 3); const yld = 1 + (M.gear ? S.pailChance(pinv, A) : (S.ANIMAL_BONUS === undefined ? 0.5 : S.ANIMAL_BONUS)), ph = M.gear ? S.pailHit(pinv, A) : null, wc = ph && ph.wear > 0 ? gearWear('pail', pt) * ph.wear : 0; // ตะกร้า-ถัง: โอกาสผลผลิต ×2 บวกจากพื้น ANIMAL_BONUS • สึกต่อการเก็บ 1 ครั้ง
    coinc += per * ((prod.sell || 0) * yld * M.animalPrice - feed.buy - wc); gr += per * (prod.sell || 0) * yld; fc += per * feed.buy; wr += per * wc; pcs += per * yld;
  }
  const f = Math.min(1, M.apm / 2 / cyc); // ให้อาหาร + เก็บ = 2 การกระทำต่อรอบ
  return { pick: 'เล้าเต็ม', coin: coinc * f * 60, xp: xpc * f * 60, gross: gr * f * 60, cost: fc * f * 60, wear: wr * f * 60, pieces: pcs * f * 60, cat: 'animal' };
}
function cook(lv, buy = false, tol = 0.01, lag = 0) { // buy = true: เชฟซื้อวัตถุดิบจากตลาดผู้เล่น (WP-22) แทนหาเอง • เลือกสูตรที่ XP/ชม. ≥ (1−tol)×สูงสุด แล้วเอาที่เหรียญ/ชม.มากสุด (tol 1% = XP-pick กัน tie สลับไปมา, 10% = เชฟที่ไล่เหรียญแต่ยังไม่หลุดเส้น XP, 1 = ไล่เหรียญล้วน)
  // นาทีที่ต้องใช้หาวัตถุดิบ 1 ชิ้น เมื่ออาชีพอื่นเลเวลเท่ากัน: ปลาถูกสุด/ผักถูกสุด/ไข่ = เวลาลงมือ (ไม่นับรอโต)
  const pt = M.gear ? Math.max(1, panAt(lv) - lag) : 1; // กระทะที่ใช้ (ไม่อัป = ต่ำกว่าที่ปลด lag ระดับ)
  const rod = lv >= 6 ? 3 : lv >= 3 ? 2 : 1, fishMin = 1 / fishCpm(lv, rod), cropMin = 4 / M.apm, eggMin = 2 / M.apm / 1.5;
  const need = { fish: fishMin, crop: cropMin, egg: eggMin, milk: eggMin, meal_bread: 0 };
  let best = null; const cand = [];
  for (const r of S.COOK) {
    if (r.lv > lv) continue;
    let min = r.time / 60000 + 1 / M.apm, ing = 0;
    for (const x of r.in) {
      if (buy) { // ซื้อจากตลาด: เสียเงินตามราคาตลาดของวัตถุดิบ (หมวด = ชนิดถูกสุดในหมวด เหมือนที่ครัวหยิบใช้ก่อน) + เสียเวลาซื้อต่อชิ้น ไม่เสียเวลาหา
        const it = x.k ? S.itemInfo(x.k) : null, base = x.k ? (it.sell || it.buy || 0) : ({ fish: Math.min(...S.FISH_ALL.filter(f => f.id !== 'boot').map(f => f.sell)), crop: Math.min(...Object.values(S.CROPS).map(c => c.sell)), egg: S.itemInfo('egg').sell })[x.c];
        ing += x.n * base * (it && it.buy && !it.sell ? 1 : M.mktMul); min += x.n * M.buyAct / M.apm; continue; }
      let m = need[x.c || x.k];
      if (m === undefined && x.k) { // ของเจาะจงชนิด (ปลาทู ไข่เป็ด ฯลฯ): เวลาหา ∝ ราคาขายเทียบของถูกสุดในหมวด (หายากกว่า = ใช้เวลามากกว่า) ไม่ให้นับเป็นของฟรี
        const cat = /^fish_/.test(x.k) ? 'fish' : /^crop_/.test(x.k) ? 'crop' : x.k === 'duck_egg' ? 'egg' : null, base = { fish: Math.min(...S.FISH_ALL.filter(f => f.id !== 'boot').map(f => f.sell)), crop: Math.min(...Object.values(S.CROPS).map(c => c.sell)), egg: S.itemInfo('egg').sell }[cat], it = S.itemInfo(x.k); // ราคาของถูกสุดในหมวด ดึงจากข้อมูลกลาง
        m = cat && it && it.sell ? need[cat] * Math.max(1, it.sell / base) : 0;
      }
      min += x.n * (m || 0);
    }
    const ph = M.gear ? S.panHit(r, pt) : null, fee = r.sell * (M.gear ? S.panFee(r, pt, true) : S.COOK_FEE), wc = ph && ph.wear > 0 ? gearWear('pan', pt) * ph.wear : 0; // กระทะ: ลดค่าเตา และสึกต่อจาน
    const coin = 60 / min * (r.sell - fee - ing - wc), xp = 60 / min * r.xp;
    if (buy && coin <= 0) continue; // ซื้อแล้วขาดทุน = ไม่ทำ
    cand.push({ pick: r.id.replace('dish_', ''), coin, xp, gross: 60 / min * r.sell, cost: 60 / min * (fee + ing + wc), wear: 60 / min * wc, pieces: 60 / min, cat: 'dish' });
  }
  const mx = Math.max(...cand.map(c => c.xp));
  for (const c of cand) if (c.xp >= mx * (1 - tol) - 1e-9 && (!best || c.coin > best.coin)) best = c;
  return best;
}

// ขุดเหมือง (ถ้ำ 10 ชั้น): ผู้เล่นเลเวล n ลงชั้น n ขุดได้เฉพาะแร่ที่เลเวลถึง (ส่วนที่เหลือของชั้นข้าม) ใช้อีเต้อดีสุดที่ซื้อได้ ก้อนมี 3 ขนาด (HP/ชิ้นต่างกัน) • อีเต้อสึก 1 ครั้งต่อก้อน
// เพดานคนเดียว: ชั้นละ ~30–40 ก้อนเกิดใหม่ทุก 4 นาที (~8 ก้อน/นาที) มากกว่าที่คนเดียวขุดทัน จึงติดความเร็วขุด+เดินหา ไม่ติดซัพพลาย
const critSwings = (hp, d) => { const c = S.MINE.crit, memo = new Map(), E = h => h <= 1e-9 ? 0 : (memo.has(h) ? memo.get(h) : (memo.set(h, 0), memo.set(h, 1 + (1 - c.p) * E(+(h - d).toFixed(6)) + c.p * E(+(h - d * c.mul).toFixed(6))).get(h))); return E(hp); }; // ครั้งฟาดเฉลี่ยต่อก้อนเมื่อมีคริ (ดาเมจ ×mul โอกาส p)
function mine(lv, lag = 0) { // 6 พ.ย. 2026: ใช้ S.mineHit จริง (ไม่มีถุงมือ/ค้อนแล้ว ชุดอุปกรณ์ 10 ระดับ ต่ำกว่าแร่กี่ระดับก็ขุดได้แต่ช้าและสึกไว) • lag = ผู้เล่นไม่ได้อัปอุปกรณ์ ใช้ต่ำกว่าระดับที่ปลดแล้วกี่ระดับ (0 = ซื้อสูงสุดตามเลเวล เพดานบน)
  const inv = {}; for (const [t, p] of Object.entries(S.PICKS)) if (!p.lv || p.lv <= lv) inv['pick_' + t] = 1;
  for (let i = 0; i < lag; i++) { const top = S.pickTier(inv); if (top > 1) delete inv['pick_' + top]; }
  const pk = S.pickTier(inv), wl = 1, fl = Math.min(Math.ceil(lv / 2), S.MINE.floors);
  const mix = Object.entries(S.floorMix(fl)).filter(([k]) => S.ORES[k].lv <= lv && S.mineHit(inv, k, 0)), share = mix.reduce((a, [, w]) => a + w, 0) / 100;
  let val = 0, xp = 0, pcs = 0, secs = 0, wearC = 0;
  for (const [k, w] of mix) { const o = S.ORES[k], f = w / 100 / share; // สัดส่วนในกลุ่มที่ขุดได้
    for (let i = 0; i < S.ORE_SIZES.length; i++) { const z = S.ORE_SIZES[i], p = f * S.sizeMix(fl)[i] / 100, n = (z.drop[0] + z.drop[1]) / 2, mh = S.mineHit(inv, k, i);
      val += p * (n + mh.extra) * o.sell; xp += p * (n + mh.extra) * o.xp; pcs += p * (n + mh.extra); secs += p * critSwings(S.oreHp(k, i), mh.dmg) * 0.7;
      wearC += p * S.TOOL_PRICE.pick[pk] / S.DURABILITY.pick.max[pk] * S.WEAR_RATE.base * 1.35 * mh.wear; } } // ซ่อม/ซื้อใหม่เฉลี่ยต่อก้อน (ตัวคูณ 1.35) × ตัวคูณการสึก
  secs += M.oreWalk / Math.sqrt(share); // ก้อนที่ขุดไม่ได้ (เลเวลไม่ถึง) ทำให้ต้องเดินหาไกลขึ้น
  const npm = 60 / secs;
  return { pick: mix.slice(-1)[0][0], coin: npm * (val - wearC) * 60, xp: npm * xp * wl * 60, gross: npm * val * 60, cost: npm * wearC * 60, pieces: npm * pcs * 60, cat: 'ore', ores: npm * 60 };
}
// เป้านักขุดแร่ (ล็อก 6 พ.ย. 2026, docs/plans/mine-rework.md): ถึง Lv20 = 20 ชม.เล่นจริง • Lv1→2 = 15 นาที โตเวลาต่อเลเวล ×1.141 • XP/ชม.จริงของชั้น f = 1,000 × 1.3^(f−1) (ชั้น f = เลเวล 2f−1 และ 2f) • ในซิมนี้เป็นเพดาน = จริง ÷ EFF
const MINE_GOAL = { lv1Min: 15, growth: 1.141, floorXpH: 1000, floorGrow: 1.3, tol: 0.10 };
const mineGoalXpH = f => MINE_GOAL.floorXpH * Math.pow(MINE_GOAL.floorGrow, f - 1) / M.EFF; // เพดานต่อชม. ของชั้น f
const mineGoalHours = lv => { let m = 0; for (let k = 1; k < lv; k++) m += MINE_GOAL.lv1Min * Math.pow(MINE_GOAL.growth, k - 1); return m / 60; };
// เป้าอาชีพที่เหลือ (WP-20, 13 พ.ย. 2026): ชาวนา คนเลี้ยงสัตว์ ช่างไม้ เชฟ ใช้เส้นเดียวกับชาวประมง (ตาราง XP_TABLE_STD) • XP/ชม.จริงเลเวล L = 1,000 × 1.1412^(L−1) ยอมคลาด ±10% • ถึง Lv20 = 18–22 ชม. • ในซิมเป็นเพดาน = จริง ÷ EFF • แยกค่าต่ออาชีพไว้ให้ปรับเป้าทีละอาชีพได้
const FARM_GOAL = Object.assign({}, FISH_GOAL), ANIMAL_GOAL = Object.assign({}, FISH_GOAL), WOOD_GOAL = Object.assign({}, FISH_GOAL), COOK_GOAL = Object.assign({}, FISH_GOAL);
const GOALS = { farm: FARM_GOAL, fish: FISH_GOAL, animal: ANIMAL_GOAL, wood: WOOD_GOAL, cook: COOK_GOAL };
const goalXpH = (sk, lv) => GOALS[sk].xpH * Math.pow(GOALS[sk].growth, lv - 1) / M.EFF; // เพดานต่อชม. ของเลเวล lv ตามเป้าอาชีพ sk
const goalHours = (sk, lv) => { let m = 0; for (let k = 1; k < lv; k++) m += GOALS[sk].lv1Min * Math.pow(GOALS[sk].growth, k - 1); return m / 60; };
const SIMS = { farm, fish, animal, wood, cook, mine };
function simulate() {
  const out = {};
  for (const [k, fn] of Object.entries(SIMS)) out[k] = Array.from({ length: S.MAX_LV }, (_, i) => Object.assign({ lv: i + 1 }, fn(i + 1)));
  return out;
}
// ชั่วโมงเล่นจริงโดยประมาณถึงแต่ละเลเวล (ใช้ XP/ชม. ของเลเวลปัจจุบัน × EFF)
function hoursTo(rows, sk) { const h = [0]; for (let lv = 1; lv < S.MAX_LV; lv++) h.push(h[lv - 1] + (S.xpFor(lv + 1, sk) - S.xpFor(lv, sk)) / (rows[lv - 1].xp * M.EFF)); return h; }

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
  console.log('อาชีพ'.padEnd(12) + [3, 5, 7, 10, 15, 20].map(l => ('Lv' + l).padStart(7)).join(''));
  for (const k of Object.keys(SIMS)) { const h = hoursTo(r[k], k); console.log(S.SKILLS[k].name.padEnd(12) + [3, 5, 7, 10, 15, 20].map(l => h[l - 1].toFixed(1).padStart(7)).join('') + (k === 'mine' ? '   (ตารางหลอด XP_TABLE_MINE)' : '')); }
  console.log('เป้าชาวประมง'.padEnd(12) + [3, 5, 7, 10, 15, 20].map(l => fishGoalHours(l).toFixed(1).padStart(7)).join('') + '   (ตารางหลอด XP_TABLE_STD เป้า Lv1→2 = 15 นาที ×1.1412 ต่อเลเวล)');
  console.log('เป้านักขุด'.padEnd(12) + [3, 5, 7, 10, 15, 20].map(l => mineGoalHours(l).toFixed(1).padStart(7)).join('') + '   (Lv1→2 = 15 นาที ×1.141 ต่อเลเวล)');
  // ชาวนา คนเลี้ยงสัตว์ ช่างไม้ เชฟ (WP-20): XP/ชม.จริงเทียบเป้า 1,000×1.1412^(L−1) ±10% • เหรียญสุทธิ/ชม. % ของชาวนา (เป้า 85–120%) • ! = นอกเป้า
  const WP20 = ['farm', 'animal', 'wood', 'cook'];
  console.log(`\nหลอด XP รวม (WP-20) รายเลเวล: XP/ชม.จริง (เพดาน × ${M.EFF}) | เป้า | ตรง% | เหรียญ/ชม. % ของชาวนา`);
  console.log('Lv ' + WP20.map(k => S.SKILLS[k].name.padEnd(30)).join(''));
  for (let lv = 1; lv <= S.MAX_LV; lv++) console.log(String(lv).padStart(2) + ' ' + WP20.map(k => { const x = r[k][lv - 1], g = goalXpH(k, lv) * M.EFF, got = x.xp * M.EFF, dev = got / g - 1, cp = x.coin / r.farm[lv - 1].coin, bad = Math.abs(dev) > GOALS[k].tol;
    return (num(got).padStart(7) + num(g).padStart(7) + ((dev >= 0 ? '+' : '') + (dev * 100).toFixed(0) + '%').padStart(5) + (bad ? '!' : ' ') + (k === 'farm' ? '' : (Math.round(cp * 100) + '%').padStart(5) + (cp < 0.85 || cp > 1.20 ? '!' : ' '))).padEnd(30); }).join(''));
  console.log('ชม.ถึง Lv10/Lv20 (เป้า 18–22 ชม. ที่ Lv20): ' + WP20.map(k => { const h = hoursTo(r[k], k); return S.SKILLS[k].name + ' ' + h[9].toFixed(1) + '/' + h[19].toFixed(1) + (h[19] < 18 || h[19] > 22 ? '!' : ''); }).join(' • ') + ' • เป้า ' + goalHours('farm', 10).toFixed(1) + '/' + goalHours('farm', 20).toFixed(1));
  // เชฟ 2 โหมด (WP-22): เหรียญ/ชม. % ของชาวนา • หาเอง vs ซื้อวัตถุดิบจากตลาด (ราคา ×M.mktMul ของราคาฐาน) • เลือกสูตร XP/ชม. ≥ 99% / ≥ 90% ของสูงสุด / ไล่เหรียญล้วน (เป้า 85–120%)
  console.log(`\nเชฟ 2 โหมด: เหรียญ/ชม. % ของชาวนา (ซื้อ: ราคาตลาด ×${M.mktMul} เวลาซื้อ ${M.buyAct} ครั้ง/ชิ้น) • สูตร XP≥99% | XP≥90% | ไล่เหรียญล้วน`);
  console.log('Lv   หาเอง 99%  90%  ล้วน  | ซื้อ 99%  90%  ล้วน');
  for (let lv = 1; lv <= S.MAX_LV; lv++) { const F = r.farm[lv - 1].coin, p = (b, t) => { const c = cook(lv, b, t); return c ? Math.round(c.coin / F * 100) : 0; }, f = v => (String(v) + (v < 85 || v > 120 ? '!' : ' ')).padStart(5);
    console.log(String(lv).padStart(2) + '        ' + f(p(false, 0.01)) + f(p(false, 0.1)) + f(p(false, 1)) + '   |      ' + f(p(true, 0.01)) + f(p(true, 0.1)) + f(p(true, 1))); }
  // อุปกรณ์ชาวนา/คนเลี้ยงสัตว์/เชฟ (WP-23): ใช้ S.hoeHit / S.pailChance+pailHit / S.panFee+panHit เดียวกับเซิร์ฟเวอร์ • --nogear = ฐานเดิม
  if (M.gear) {
    const own = { farm: lv => farm(lv), animal: lv => animal(lv), cook: lv => cook(lv, false, 0.01) }, off = { farm: lv => withGear(false, () => farm(lv)), animal: lv => withGear(false, () => animal(lv)), cook: lv => withGear(false, () => cook(lv, false, 0.01)) };
    const tierAtLv = { farm: hoeAt, animal: pailAt, cook: panAt }, GN = { farm: 'จอบ', animal: 'ตะกร้า-ถัง', cook: 'กระทะ' };
    console.log(`\nอุปกรณ์ WP-23 รายเลเวล: ระดับ • ค่าสึก % ของรายได้ขั้นต้น (เป้า 7–9% Lv1–2 ยอม 4–9%) • กำไรสุทธิตรงระดับเทียบ --nogear (เป้า +3 ถึง +8%) • เชฟโหมดซื้อ (ตลาด ×${M.mktMul}) กำไร%`);
    console.log('Lv |  จอบ ระดับ สึก%  สุทธิ | ตะกร้า ระดับ สึก%  สุทธิ | กระทะ ระดับ สึก%  สุทธิ  ซื้อตลาด');
    for (let lv = 1; lv <= S.MAX_LV; lv++) {
      const cells = ['farm', 'animal', 'cook'].map(k => { const a = own[k](lv), b = off[k](lv), wp = a.wear / a.gross * 100, g = (a.coin / b.coin - 1) * 100, ok = lv <= 2 ? (wp >= 4 && wp <= 9) : (wp >= 7 && wp <= 9);
        return String(tierAtLv[k](lv)).padStart(4) + '   ' + wp.toFixed(1).padStart(5) + (ok ? ' ' : '!') + ((g >= 0 ? '+' : '') + g.toFixed(1) + '%').padStart(7) + (g < 3 || g > 8 ? '!' : ' '); });
      const bm = cook(lv, true, 0.01), bo = withGear(false, () => cook(lv, true, 0.01));
      console.log(String(lv).padStart(2) + ' | ' + cells.join(' | ') + '  ' + (bm && bo ? ((bm.coin / bo.coin - 1) * 100).toFixed(1) + '%' : '-'));
    }
    // คืนทุน: ราคา ÷ เหรียญสุทธิจริง/ชม. (เพดาน × EFF) ณ เลเวลที่ปลด (เป้า ≤ 1.2 ชม.) • จอบ+บัวซื้อคู่กันที่เลเวลเดียว • ความทนทาน • ค่าสึกต่อครั้งใช้ • "คืนทุนจริง" = ราคา ÷ (กำไรที่เพิ่มต่อชม. เทียบใช้ระดับก่อนหน้า) ชม.เล่นจริง
    console.log('\nอุปกรณ์: ซื้อได้ใน (ชม. เล่นจริงของรายได้สุทธิ ณ เลเวลที่ปลด เป้า ≤ 1.2) • ทน • ค่าสึก/ครั้งที่ตรงระดับ • คืนทุนจริง = ราคา ÷ กำไรเพิ่มต่อชม. เทียบระดับก่อนหน้า');
    console.log('ระดับ Lv | จอบ ราคา  ทน  สึก/ครั้ง | บัว ราคา | จอบ+บัว ซื้อได้ใน | ตะกร้า ราคา  ทน  สึก/ครั้ง ซื้อได้ใน | กระทะ ราคา  ทน  สึก/ครั้ง ซื้อได้ใน | คืนทุนจริง จอบ/ตะกร้า/กระทะ');
    for (let t = 2; t <= S.GEAR_MAX; t++) { const lv = 2 * t - 1, F = r.farm[lv - 1].coin * M.EFF, A = r.animal[lv - 1].coin * M.EFF, C = r.cook[lv - 1].coin * M.EFF, hp = S.TOOL_PRICE.hoe[t], cp = S.CANS[t].price, pp = S.TOOL_PRICE.pail[t], np = S.TOOL_PRICE.pan[t];
      const real = [['farm', farm, hp], ['animal', animal, pp], ['cook', (l, g) => cook(l, false, 0.01, g), np]].map(([k, fn, pr]) => { const d = (fn(lv, 0).coin - fn(lv, 1).coin) * M.EFF; return d > 0 ? (pr / d).toFixed(0) : '-'; });
      console.log(String(t).padStart(5) + String(lv).padStart(4) + ' | ' + num(hp).padStart(5) + String(S.DURABILITY.hoe.max[t]).padStart(5) + gearWear('hoe', t).toFixed(1).padStart(8) + ' | ' + num(cp).padStart(5) + ' | ' + ((hp + cp) / F).toFixed(2).padStart(9) + ' | ' + num(pp).padStart(5) + String(S.DURABILITY.pail.max[t]).padStart(6) + gearWear('pail', t).toFixed(1).padStart(8) + (pp / A).toFixed(2).padStart(9) + ' | ' + num(np).padStart(5) + String(S.DURABILITY.pan.max[t]).padStart(5) + gearWear('pan', t).toFixed(1).padStart(8) + (np / C).toFixed(2).padStart(9) + ' | ' + real.join('/')); }
    // ไม่อัป: ใช้ต่ำกว่าระดับที่ปลด 1/2/3 ระดับ และไม่ซื้อเลย (ระดับ 1 ตลอด) • เหรียญสุทธิ/ชม. % ของอัปครบ | XP/ชม. % • คอลัมน์ท้าย = ไม่มีอุปกรณ์เลย (--nogear) ต้องไม่สูงกว่า lag อื่น
    console.log('\nไม่อัปอุปกรณ์ (ต่ำกว่าระดับที่ปลด 1/2/3 ระดับ • ไม่ซื้อเลย): เหรียญสุทธิ/ชม. % ของอัปครบ | XP/ชม. % • ท้าย = ไม่มีอุปกรณ์/พัง (ฐานเดิม) • ! = ลำดับไม่เป็น lag1≥lag2≥lag3≥ไม่มี');
    for (const k of ['farm', 'animal', 'cook']) {
      console.log(GN[k].padEnd(10) + [1, 2, 3, 9].map(l => (l === 9 ? 'ไม่ซื้อเลย' : 'ต่ำกว่า ' + l).padStart(15)).join('') + '      ไม่มีเลย');
      const fn = (lv, l) => k === 'farm' ? farm(lv, l) : k === 'animal' ? animal(lv, l) : cook(lv, false, 0.01, l);
      for (const lv of [5, 7, 9, 11, 13, 15, 17, 19]) { const b = fn(lv, 0), xs = [1, 2, 3, 9].map(l => fn(lv, l)), nog = off[k](lv); let mono = true, prev = Infinity; for (const x of xs.concat([nog])) { if (x.coin > prev + 1e-6) mono = false; prev = x.coin; }
        console.log('  Lv' + String(lv).padStart(2) + '    ' + xs.map(x => (Math.round(x.coin / b.coin * 100) + '% | ' + Math.round(x.xp / b.xp * 100) + '%').padStart(15)).join('') + (Math.round(nog.coin / b.coin * 100) + '%').padStart(12) + (mono ? '' : '  !')); } }
  }
  // นักขุดแร่: XP/ชม. ต่อชั้นเทียบเป้า 1,000×1.3^(f−1) (จริง) และเหรียญเทียบชาวนา และต้นทุนสึกหรอ
  console.log(`\nนักขุดแร่ รายชั้น: XP/ชม.จริง (เพดาน × ${M.EFF}) เทียบเป้า ±${MINE_GOAL.tol * 100}% • เหรียญ/ชม.สุทธิเทียบชาวนาเลเวลเดียวกัน (เป้า ≤ 125%) • ต้นทุนสึกหรอ % ของรายได้ (เป้า ≤ 10%)`);
  console.log('ชั้น Lv     XP/ชม.จริง   เป้า  ตรง    เหรียญ/ชม. %ชาวนา  สึกหรอ%  ก้อน/ชม.');
  for (let lv = 1; lv <= S.MAX_LV; lv++) { const m = r.mine[lv - 1], f = Math.ceil(lv / 2), g = mineGoalXpH(f) * M.EFF, got = m.xp * M.EFF, dev = got / g - 1, cp = m.coin / r.farm[lv - 1].coin;
    console.log(String(f).padStart(3) + ' ' + String(lv).padStart(2) + '  ' + num(got).padStart(10) + ' ' + num(g).padStart(7) + ' ' + ((dev >= 0 ? '+' : '') + (dev * 100).toFixed(0) + '%').padStart(5) + (Math.abs(dev) > MINE_GOAL.tol ? '!' : ' ') + num(m.coin).padStart(12) + ' ' + (Math.round(cp * 100) + '%').padStart(7) + (cp > 1.25 ? '!' : ' ') + (m.cost / m.gross * 100).toFixed(1).padStart(7) + '%' + (m.cost / m.gross > 0.10 ? '!' : ' ') + num(m.ores).padStart(8)); }
  // ผู้เล่นไม่อัปอุปกรณ์: ใช้ต่ำกว่าระดับที่ปลดแล้ว 1–3 ระดับ (อุปกรณ์ปลดทุก 2 เลเวล) → XP/ชม. เหรียญสุทธิ เทียบตอนอัปครบ และจำนวนฟาดก้อนใหญ่ของแร่หลัก (เพดาน MINE.maxHits)
  console.log(`\nนักขุดแร่ไม่อัปอุปกรณ์ (ต่ำกว่าแร่ 1–3 ระดับ): % ของตอนอัปครบ (XP/ชม. | เหรียญสุทธิ/ชม.) • ฟาดก้อนใหญ่ของแร่หลัก (เพดาน ${S.MINE.maxHits})`);
  console.log('Lv    ' + [1, 2, 3].map(l => ('ต่ำกว่า ' + l).padStart(17)).join('') + '   ' + [0, 1, 2, 3].map(l => ('ฟาด d-' + l).padStart(9)).join(''));
  for (const lv of [3, 5, 7, 10, 13, 15, 17, 20]) { const b = mine(lv), t = Math.ceil(lv / 2), main = Object.keys(S.ORES).find(k => S.ORES[k].pick === t && !S.ORES[k].legacy);
    console.log(String(lv).padStart(2) + '    ' + [1, 2, 3].map(l => { const x = mine(lv, l); return (Math.round(x.xp / b.xp * 100) + '% | ' + Math.round(x.coin / b.coin * 100) + '%').padStart(17); }).join('') + '   ' + [0, 1, 2, 3].map(l => { const pk = Math.max(1, t - l), mh = S.mineHit({ ['pick_' + pk]: 1 }, main, 2); return (mh.hits + (mh.hits >= S.MINE.maxHits ? '*' : '')).padStart(9); }).join('')); }
  // ชาวประมง: XP/ชม.จริงเทียบเป้า 1,000×1.1412^(L−1) ±10% • เหรียญสุทธิเทียบชาวนา (เป้า 75–125%) • สึกหรอ+เหยื่อ % ของรายได้ • คันเบ็ดซื้อได้ภายในกี่ชม.ของรายได้จริง ณ เลเวลที่ปลด
  console.log(`\nชาวประมง รายเลเวล: XP/ชม.จริง (เพดาน × ${M.EFF}) เทียบเป้า ±${FISH_GOAL.tol * 100}% • เหรียญสุทธิ/ชม. (เพดาน) เทียบชาวนา (เป้า 75–125%) • เบ็ดสึก% • ปลาหายาก(≥${S.RARE_SELL})/ชม. • ทะเล: XP% เหรียญ% เทียบน้ำจืด`);
  console.log('Lv  คัน เหยื่อ   XP/ชม.จริง   เป้า  ตรง    เหรียญ/ชม. %ชาวนา  เบ็ดสึก%  หายาก/ชม.  | ทะเล XP% เหรียญ% (เสียค่าเรือ)');
  let prevX = 0, prevC = 0;
  for (let lv = 1; lv <= S.MAX_LV; lv++) { const m = r.fish[lv - 1], g = fishGoalXpH(lv) * M.EFF, got = m.xp * M.EFF, dev = got / g - 1, cp = m.coin / r.farm[lv - 1].coin, sx = fishSea(lv);
    const up = got > prevX && m.coin > prevC; prevX = got; prevC = m.coin;
    console.log(String(lv).padStart(2) + '  ' + String(m.rod).padStart(3) + '  ' + m.pick.slice(-1).padStart(3) + num(got).padStart(11) + ' ' + num(g).padStart(7) + ' ' + ((dev >= 0 ? '+' : '') + (dev * 100).toFixed(0) + '%').padStart(5) + (Math.abs(dev) > FISH_GOAL.tol ? '!' : ' ') + num(m.coin).padStart(12) + ' ' + (Math.round(cp * 100) + '%').padStart(7) + (cp < 0.75 || cp > 1.25 ? '!' : ' ') + (m.wear / m.gross * 100).toFixed(1).padStart(8) + '%' + (m.wear / m.gross > 0.10 ? '!' : ' ') + m.rare.toFixed(1).padStart(8) + (up ? '' : '  ไม่โต!') + '  | ' + (Math.round(sx.xp / m.xp * 100) + '%').padStart(5) + (Math.round(sx.coin / m.coin * 100) + '%').padStart(7)); }
  console.log('\nคันเบ็ด: ราคา ÷ เหรียญสุทธิจริง/ชม. (เพดาน × EFF) ณ เลเวลที่ปลด (เป้า ≤ ~1 ชม.) • ความทนทาน • สึกหรอ/เหวี่ยง');
  for (const [k, v] of Object.entries(S.RODS)) { if (!v.price) continue; const m = r.fish[v.lv - 1]; console.log(`คัน ${k} Lv${String(v.lv).padStart(2)} ราคา ${num(v.price).padStart(6)}  รายได้จริง/ชม. ${num(m.coin * M.EFF).padStart(6)}  ซื้อได้ใน ${(v.price / (m.coin * M.EFF)).toFixed(2)} ชม.  ทน ${S.DURABILITY.rod.max[k]}  ค่าสึก/เหวี่ยง ${(S.TOOL_PRICE.rod[k] / S.DURABILITY.rod.max[k] * S.WEAR_RATE.base * 1.35).toFixed(2)}`); }
  // ช่างไม้ (WP-10): เหรียญสุทธิเทียบชาวนา (เป้า 85–110%) • ขวานสึก % ของรายได้ (เป้า 7–9%) • ต้นไม้/ชม. • ซื้อขวานคืนทุนภายในกี่ชม. (เป้า ≤ 1.2)
  console.log(`\nช่างไม้ รายเลเวล: XP/ชม. • เหรียญสุทธิ/ชม. (เพดาน) เทียบชาวนา (เป้า 85–110%) • ขวานสึก % ของรายได้ (เป้า 7–9%) • ต้น/ชม. • ชิ้นหลักเพิ่ม`);
  console.log('Lv ขวาน   XP/ชม.   เหรียญ/ชม. %ชาวนา  ขวานสึก%  ต้น/ชม.');
  for (let lv = 1; lv <= S.MAX_LV; lv++) { const w = r.wood[lv - 1], cp = w.coin / r.farm[lv - 1].coin, wp = w.cost / w.gross;
    console.log(String(lv).padStart(2) + ' ' + String(w.axe).padStart(4) + num(w.xp).padStart(9) + num(w.coin).padStart(12) + ' ' + (Math.round(cp * 100) + '%').padStart(7) + (cp < 0.85 || cp > 1.10 ? '!' : ' ') + (wp * 100).toFixed(1).padStart(8) + '%' + (wp < 0.07 || wp > 0.09 ? '!' : ' ') + num(w.trees).padStart(8)); }
  console.log('\nขวาน: ราคา ÷ เหรียญสุทธิจริง/ชม. (เพดาน × EFF) ณ เลเวลที่ปลด (เป้า ≤ 1.2 ชม.) • ความทนทาน (ครั้งฟัน)');
  for (const [k, v] of Object.entries(S.AXES)) { const lv = v.lv || 1, m = r.wood[lv - 1]; console.log(`ขวาน ${String(k).padStart(2)} Lv${String(lv).padStart(2)} ราคา ${num(v.price).padStart(6)}  รายได้จริง/ชม. ${num(m.coin * M.EFF).padStart(6)}  ซื้อได้ใน ${(v.price / (m.coin * M.EFF)).toFixed(2)} ชม.  ทน ${S.DURABILITY.axe.max[k]}  ค่าสึก/ฟัน ${(S.TOOL_PRICE.axe[k] / S.DURABILITY.axe.max[k] * S.WEAR_RATE.base * 1.35).toFixed(2)}`); }
  // ไม่อัปขวาน/คัน: เหรียญสุทธิ/ชม. % ของตอนอัปครบ (เทียบตารางแผน PHASE1-BALANCE-PLAN หัวข้อ 5 และ 6 คลาด ≤ 5 จุด%) | XP/ชม. %
  console.log('\nไม่อัปขวาน/คัน (ต่ำกว่าระดับที่ปลด 1/2/3 ระดับ): เหรียญสุทธิ/ชม. % ของอัปครบ | XP/ชม. % • [แผน] = ตัวเลขในแผนหัวข้อ 5/6');
  const PLAN = { wood: { 7: [94, 80, 55], 11: [94, 86, 73], 15: [97, 91, 81], 19: [98, 94, 89] }, fish: { 7: [92, 84, 58], 11: [89, 85, 75], 15: [92, 89, 80], 19: [91, 86, 81] } };
  for (const [name, fn, key] of [['ช่างไม้', wood, 'wood'], ['ชาวประมง', (lv, lag) => fish(lv, false, lag), 'fish']]) {
    console.log(name.padEnd(10) + [1, 2, 3].map(l => ('ต่ำกว่า ' + l).padStart(20)).join(''));
    for (const lv of [7, 11, 15, 19]) { const b = fn(lv, 0), pl = PLAN[key][lv];
      console.log('  Lv' + String(lv).padStart(2) + '    ' + [1, 2, 3].map((l, i) => { const x = fn(lv, l), c = Math.round(x.coin / b.coin * 100), bad = Math.abs(c - pl[i]) > 5 ? '!' : ' '; return (c + '% | ' + Math.round(x.xp / b.xp * 100) + '% [' + pl[i] + ']' + bad).padStart(20); }).join('')); } }
  // ฤดูของชาวนา (season-planting): เหรียญ/ชม. และ XP/ชม. ต่อฤดู เทียบเฉลี่ย • ชม.ถึง Lv10/Lv20 ต่อฤดู (เริ่มและอยู่ในฤดูนั้นตลอด = ขอบล่าง/บน) • อาชีพอื่น ÷ ชาวนา (เป้า 75–125% ของเหรียญ/ชม.) ที่ฤดูเฉลี่ย/ฤดูที่ชาวนาแย่สุด
  if (r.farm[0].seasons) {
    const ids = r.farm[0].seasons.map(x => x.id), fr = id => Array.from({ length: S.MAX_LV }, (_, i) => r.farm[i].seasons.find(x => x.id === id));
    console.log(`\nชาวนารายฤดู (ฤดูละ ${S.SEASONS.days} วัน วนทุก ${S.SEASONS.list.length} ฤดู) • freeLv ${S.SEASONS.freeLv} inMul ${S.SEASONS.inMul} outMul ${S.SEASONS.outMul} • เหรียญ/ชม. [ฤดู: ${ids.join('/')}] เลือกตามเหรียญ`);
    console.log('Lv  ' + ids.map(i => i.padStart(8)).join('') + '     เฉลี่ย  ต่ำสุด%เฉลี่ย  พืชเลือก(ต่อฤดู)');
    for (const lv of [1, 3, 5, 6, 7, 8, 10, 12, 15, 18, 20]) { const x = ids.map(i => fr(i)[lv - 1]), a = r.farm[lv - 1]; console.log(String(lv).padStart(2) + '  ' + x.map(y => num(y.coin).padStart(8)).join('') + num(a.coin).padStart(11) + (Math.round(Math.min(...x.map(y => y.coin)) / a.coin * 100) + '%').padStart(11) + '    ' + x.map(y => y.pick.slice(0, 7)).join('/')); }
    const rowsOf = (pickFn) => ids.map(i => Array.from({ length: S.MAX_LV }, (_, k) => pickFn(fr(i)[k])));
    const hrs = (rows) => { const h = [0]; for (let lv = 1; lv < S.MAX_LV; lv++) h.push(h[lv - 1] + (S.xpFor(lv + 1, 'farm') - S.xpFor(lv, 'farm')) / (rows[lv - 1].xp * M.EFF)); return h; };
    console.log('\nชม.เล่นจริงถึง Lv10 / Lv20 ของชาวนา (เริ่มและเล่นอยู่ในฤดูเดียวตลอด = ขอบ) เทียบเฉลี่ยทุกฤดู');
    const mk = (label, rows) => { const h = hrs(rows); return label.padEnd(22) + h[9].toFixed(1).padStart(7) + ' /' + h[19].toFixed(1).padStart(6); };
    console.log('เลือกตามเหรียญ: เฉลี่ย  ' + mk('', r.farm).trim()); ids.forEach((i, k) => console.log('  ' + i.padEnd(6) + '            ' + mk('', fr(i)).trim()));
    console.log('เลือกตาม XP:    เฉลี่ย  ' + mk('', r.farm.map(x => ({ xp: x.seasons.reduce((a, y) => a + y.byXp.xp, 0) / x.seasons.length }))).trim()); ids.forEach((i, k) => console.log('  ' + i.padEnd(6) + '            ' + mk('', fr(i).map(x => x.byXp)).trim()));
    console.log('\nเหรียญ/ชม. อาชีพอื่น ÷ ชาวนา: ฤดูเฉลี่ย | ฤดูที่ชาวนาแย่สุด (เป้า ≤ 125%) ที่ Lv 5/10/15/20');
    for (const k of Object.keys(SIMS)) if (k !== 'farm') console.log(S.SKILLS[k].name.padEnd(12) + [5, 10, 15, 20].map(lv => { const a = r.farm[lv - 1].coin, w = Math.min(...ids.map(i => fr(i)[lv - 1].coin)); return (Math.round(r[k][lv - 1].coin / a * 100) + '%|' + Math.round(r[k][lv - 1].coin / w * 100) + '%').padStart(12); }).join(''));
  }
  console.log(`\nเหรียญ/ชม. (เพดานคนเดียว ตามทางที่เลือก)`);
  for (const k of Object.keys(SIMS)) console.log(S.SKILLS[k].name.padEnd(12) + r[k].map(x => num(x.coin).padStart(7)).join(''));
}
module.exports = { M, SIMS, hoeAt, pailAt, panAt, canAt, gearWear, withGear, animal, farm, cook, mine, FARM_GOAL, ANIMAL_GOAL, WOOD_GOAL, COOK_GOAL, GOALS, goalXpH, goalHours, wood, fish, axeAt, rodAt, simulate, hoursTo, MINE_GOAL, mineGoalXpH, mineGoalHours, FISH_GOAL, fishGoalXpH, fishGoalHours, fishSea };
