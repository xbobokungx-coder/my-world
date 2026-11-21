'use strict';
// จำลองที่เก็บของในบ้าน (HOME.store) และบัฟความสบาย (HOME.comfort/rest/sets) เพื่อคุมเศรษฐกิจ • ข้อมูลจำลองล้วน ไม่อ่าน data/
// ใช้: node tools/homesim.js            → ตารางตู้เย็น (กำไรจากการตุนของสด) + ตารางความสบาย/คืนทุน
//      node tools/homesim.js cold       → เฉพาะตู้เย็น      • node tools/homesim.js comfort → เฉพาะความสบาย
//      node tools/homesim.js cold --quick → ตารางย่อ (เลเวล 10 เท่านั้น)
// ตู้เย็น: ผู้เล่นจำลองผลิตของสดต่อเนื่อง ขายตามกติกาตลาดจริง (S.sellQuote, ตลาดกลาง×ส่วนตัว×หมวด, ภาษีขาย, ความสด) แล้วเลือกนโยบายขาย
//   "ขายเมื่อราคาต่อชิ้น ≥ θ × ราคาฐาน" ที่ดีที่สุด (กวาด θ) เทียบ: ไม่มีตู้ • ตู้เย็นเดิม (กระเป๋าช้าครึ่งเดียวไม่จำกัดจำนวน) • ตู้ใหม่ mul/ความจุต่างๆ • เพดาน (ของไม่เสื่อมเลย = ไม้/แร่)
// ผลผลิต/ชม. ต่อเลเวลมาจาก tools/levelsim.js (ผ่านตัวคูณ EFF และ cal ของ econsim) ตัวเลขเป็นแบบหยาบ ใช้เทียบก่อน/หลังเท่านั้น
const S = require('../public/shared.js'), L = require('./levelsim.js');
const MIN = 60000, DAY = 1440;
const rngOf = seed => { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const CAL = { farm: 1, fish: 1, animal: 0.4, wood: 1, cook: 1, mine: 1 }; // เท่า econsim C.cal
const sims = L.simulate();
const prodOf = (sk, lv) => { const r = sims[sk][lv - 1], f = L.M.EFF * CAL[sk]; return { pph: r.pieces * f, val: r.gross / r.pieces, cat: r.cat, costPh: r.cost * f }; };
const fm = a => a < S.FRESH.freshMs ? S.FRESH.mul[0] : a < S.FRESH.staleMs ? S.FRESH.mul[1] : S.FRESH.mul[2];

// ---- จำลองผู้เล่นหนึ่งคน ----
// P = { pph, val } • cfg = { mins (นาทีเล่น/วัน), days, warm, seed, nItems, sellEvery, trip,
//   rate: อัตราอายุในกระเป๋า (1 ปกติ, 0.5 ตู้เย็นเดิม, 0 ไม่เสื่อม), cold: null | { mul, cap } } • pol = { th, force }
function run(P, cfg, pol) {
  const rnd = rngOf(cfg.seed), nI = cfg.nItems || 3, every = cfg.sellEvery || 10, perMin = P.pph / 60 / nI, unitCost = P.costPh / P.pph, FOODMIN = 2.9; let workMin = 0, clock = 0;
  const cen = [], mk = [], lots = []; for (let i = 0; i < nI; i++) { cen.push(1); mk.push(1); lots.push([]); }
  let ct = 1, sales = [], rev = 0, tax = 0, lostMin = 0, soldPcs = 0, baseSold = 0, coldMax = 0;
  const cold = cfg.cold, rateP = cfg.rate === undefined ? 1 : cfg.rate;
  for (let d = 0; d < cfg.days; d++) {
    const tgt = []; for (let i = 0; i < nI; i++) tgt.push(Math.min(S.MARKET.max, Math.min(1.3, Math.max(0.75, 1 + (rnd() - 0.5) * 0.4)))); // ราคาเป้าหมายรายวันของแต่ละชนิด (เท่า server market.js)
    if (rnd() < 0.5) { tgt[Math.floor(rnd() * nI)] = 1.35; } // ข่าวตลาดราคาพุ่ง (โอกาสหยาบๆ)
    for (let i = 0; i < nI; i++) cen[i] = tgt[i];
    // ช่วงออฟไลน์ไม่สม่ำเสมอ (±4 ชม.) และมีวันที่ไม่เข้าเกม 15% (กันผลจากรอบ 24 ชม.พอดีเป๊ะ ซึ่งชนขอบความสดทุกครั้ง)
    let gapMin = DAY - cfg.mins + Math.round((rnd() - 0.5) * 480); if (cfg.skip) while (rnd() < cfg.skip) gapMin += DAY;
    clock += gapMin; const gap = gapMin * MIN, base = clock * MIN;
    // ออฟไลน์: หมวดฟื้น (catJoin) ส่วนตัวไม่ฟื้น อายุเดิน
    ct = 1 - (1 - ct) * Math.pow(1 - S.CATFAT.recover, gapMin);
    if (d > 0) for (const ls of lots) for (const l of ls) l.a += gap * (l.c ? cold.mul : rateP);
    const trips = cold ? (cfg.trip || 0) : 0;
    let work = cfg.mins - trips; // เข้าบ้านหยิบของตอนเริ่ม
    lostMin += trips;
    for (let t = 0; t < cfg.mins; t++) {
      const now = base + t * MIN, last = t === cfg.mins - 1;
      if (t < work) { // ผลิตเมื่อ (ของค้าง < ที่ยอมถือ) และ (ขายได้ราคาคุ้มต้นทุน+ค่าอาหาร) เหมือน econsim: คนจริงหยุดเมื่อขายแล้วขาดทุน
        let stock = 0; for (const ls of lots) for (const l of ls) stock += l.n;
        let sig = 0; for (let i = 0; i < nI; i++) sig += cen[i] * mk[i]; sig = sig / nI * ct;
        if (stock < pol.hold * P.pph && sig * P.val > unitCost * 1.05 + FOODMIN / (perMin * nI)) {
          if (d >= cfg.warm) workMin++;
          for (let i = 0; i < nI; i++) { const ls = lots[i]; const top = ls[ls.length - 1]; if (top && top.fresh) top.n += perMin; else ls.push({ a: 0, n: perMin, c: false, fresh: true }); } // ผลผลิตใหม่รวมเป็นกองเดียว (อายุเริ่มที่ 0)
        }
      }
      if ((t + 1) % every === 0 || last) {
        if (last && cold) { // ก่อนออกจากเกม: เก็บของเข้าตู้เย็นเท่าที่จุ (เอาของเก่าก่อน) ใช้เวลาเข้าบ้านอีกรอบ
          let used = 0; for (const ls of lots) for (const l of ls) if (l.c) used += l.n;
          const all = []; for (const ls of lots) for (const l of ls) if (!l.c) all.push(l); all.sort((x, y) => y.a - x.a);
          for (const l of all) { const room = cold.cap - used; if (room <= 0) break; const mv = Math.min(room, l.n); if (mv < l.n) { l.n -= mv; const ls = lots.find(z => z.includes(l)); ls.push({ a: l.a, n: mv, c: true }); } else l.c = true; used += mv; }
          coldMax = Math.max(coldMax, used);
        }
        for (let i = 0; i < nI; i++) { // ขายทีละชนิด
          const ls = lots[i]; if (!ls.length) continue;
          ls.sort((x, y) => y.a - x.a);
          const drop = S.sellDrop(P.val), mEff = cen[i] * mk[i] * ct; let m = mEff, pay = 0, q = 0;
          while (ls.length) {
            const l = ls[0];
            if (!(l.n > 1e-9)) { ls.shift(); continue; }
            const k = fm(l.a), unit = P.val * k * Math.max(S.MARKET.min, m);
            const rate = l.c ? cold.mul : rateP, avgGap = (DAY - cfg.mins) * MIN;
            const willCross = pol.force && last && (l.a < S.FRESH.freshMs ? l.a + avgGap * rate >= S.FRESH.freshMs : l.a < S.FRESH.staleMs ? l.a + avgGap * rate >= S.FRESH.staleMs : true);
            if (!willCross && unit < pol.th * P.val) break;
            const n = Math.min(1, l.n); pay += Math.max(1, Math.round(P.val * k * Math.max(S.MARKET.min, m))) * n; q += n; l.n -= n; m = Math.max(S.MARKET.min, m - drop * n);
            if (cold && l.c && l.n <= 1e-9) { /* หยิบออกจากตู้ตอนขาย */ }
          }
          for (let j = ls.length - 1; j >= 0; j--) if (!(ls[j].n > 1e-9)) ls.splice(j, 1);
          if (!q) continue;
          const heat = S.heatOf(sales, now), tx = S.saleTax(heat, Math.round(pay));
          sales = sales.filter(x => now - x[0] < S.TAX.fadeMs); sales.push([now, Math.round(pay)]);
          if (d >= cfg.warm) { rev += pay - tx; tax += tx; soldPcs += q; baseSold += q * P.val; }
          const r = mEff > 0 ? Math.min(1, m / mEff) : 1;
          ct = Math.max(S.CATFAT.min, ct * Math.pow(r, 0.5));
          cen[i] = Math.min(S.MARKET.max, Math.max(S.MARKET.min, cen[i] * Math.pow(Math.sqrt(r), 1 - S.PMARKET.share)));
          mk[i] = Math.min(1, Math.max(S.PMARKET.min, mk[i] * Math.pow(Math.sqrt(r), S.PMARKET.share)));
        }
      }
      for (let i = 0; i < nI; i++) { cen[i] += (tgt[i] - cen[i]) * S.MARKET.recover; mk[i] += (1 - mk[i]) * S.PMARKET.recover; }
      ct += (1 - ct) * S.CATFAT.recover;
      for (const ls of lots) for (const l of ls) l.a += MIN * (l.c ? cold.mul : rateP);
      for (const ls of lots) for (const l of ls) if (l.fresh && l.a > 5 * MIN) l.fresh = false;
    }
    clock += cfg.mins;
  }
  const hrs = (cfg.days - cfg.warm) * (cfg.mins - (cold ? cfg.trip || 0 : 0)) / 60;
  let left = 0; for (const ls of lots) for (const l of ls) left += l.n;
  const net = rev - workMin * (unitCost * perMin * nI + FOODMIN); // กำไรสุทธิ = ขาย(หลังภาษี) − ต้นทุนผลิต − ค่าอาหารตอนทำงาน
  return { rev, net, tax, workMin, perHr: net / ((cfg.days - cfg.warm) * cfg.mins / 60), ratio: baseSold ? (rev + tax) / baseSold : 0, left, coldMax, lostMin, hrs };
}
const FINE = process.argv.includes('--fine');
const POLS = []; for (const th of FINE ? [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] : [0.3, 0.5, 0.7, 0.9]) for (const force of [0, 1]) for (const hold of FINE ? [1, 2, 3] : [1, 3]) POLS.push({ th, force, hold });
// หานโยบายที่ดีที่สุด (เฉลี่ยหลาย seed ด้วยตัวสุ่มชุดเดียวกัน) แล้วคืนค่าเฉลี่ยของโยบายนั้น
function best(P, cfg, seeds) {
  let top = null;
  for (const pol of POLS) {
    let s = 0, left = 0; for (const sd of seeds) { const r = run(P, { ...cfg, seed: sd }, pol); s += r.perHr; left += r.left; }
    s /= seeds.length; if (!top || s > top.perHr) top = { perHr: s, pol, left: left / seeds.length };
  }
  return top;
}

const argv = process.argv.slice(2), what = argv.find(a => !a.startsWith('--')) || 'all', quick = argv.includes('--quick');
const num = n => Math.round(n).toLocaleString('en-US'), pc = x => (Math.round(x * 1000) / 10).toFixed(1) + '%';

function cold() {
  const opt = n => { const a = argv.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=')[1].split(',') : null; };
  const seeds = (FINE ? [11, 22, 33, 44, 55, 66] : [11, 22, 33, 44]), days = 60, warm = 15;
  const lvs = (opt('lv') || (quick ? ['10'] : ['5', '10', '20'])).map(Number), minsL = (opt('mins') || (quick ? ['60', '240'] : ['60', '120', '240'])).map(Number), skills = opt('skills') || ['farm', 'fish', 'animal', 'cook'];
  const variants = [
    { id: 'old', name: 'ตู้เย็นเดิม (กระเป๋า ×0.5 ไม่จำกัด)', rate: 0.5 },
    { id: 'c25', name: 'ใหม่ ×0.25 ความจุ 240', cold: { mul: 0.25, cap: 240 } },
    { id: 'c35', name: 'ใหม่ ×0.35 ความจุ 240', cold: { mul: 0.35, cap: 240 } },
    { id: 'c50', name: 'ใหม่ ×0.5 ความจุ 240', cold: { mul: 0.5, cap: 240 } },
    { id: 'c25s', name: 'ใหม่ ×0.25 ความจุ 120', cold: { mul: 0.25, cap: 120 } },
    { id: 'inf', name: 'เพดาน (ไม่เสื่อมเลย)', rate: 0 },
  ];
  const custom = process.env.HS_VARIANTS ? JSON.parse(process.env.HS_VARIANTS) : null;
  if (custom) variants.splice(0, variants.length, ...custom);
  console.log('กำไรสุทธิ/ชม.ที่เล่น (ขายหลังภาษี − ต้นทุนผลิต − ค่าอาหาร) ของผู้เล่นที่ขายด้วยนโยบายที่ดีที่สุดของแต่ละแบบ • ตัวเลขในวงเล็บ = เทียบ "ไม่มีตู้เย็น" (กระเป๋าเสื่อมปกติ)');
  const out = [];
  for (const sk of skills) for (const lv of lvs) for (const mins of minsL) {
    const P = prodOf(sk, lv), cfg = { mins, days, warm, nItems: 3, sellEvery: 10, trip: 3, skip: 0.15 };
    const base = best(P, { ...cfg, rate: 1 }, seeds);
    const row = { sk, lv, mins, base: base.perHr, ratio: 0, v: {} };
    row.ratio = run(P, { ...cfg, rate: 1, seed: seeds[0] }, base.pol).ratio;
    for (const v of variants) { const r = best(P, { ...cfg, rate: v.rate === undefined ? 1 : v.rate, cold: v.cold || null }, seeds); row.v[v.id] = r.perHr; }
    out.push(row);
  }
  if (argv.includes('--json')) return console.log(JSON.stringify(out));
  console.log('อาชีพ     Lv  นาที/วัน  ไม่มีตู้  ' + variants.map(v => v.id.padStart(14)).join(''));
  for (const r of out) console.log(((S.SKILLS[r.sk] || { name: r.sk }).name).padEnd(10) + String(r.lv).padStart(2) + String(r.mins).padStart(9) + num(r.base).padStart(10) + '(' + pc(r.ratio).padStart(5) + ') ' + variants.map(v => (num(r.v[v.id]) + ' (' + (r.v[v.id] / r.base >= 1 ? '+' : '') + pc(r.v[v.id] / r.base - 1) + ')').padStart(18)).join(''));
  const avg = id => out.reduce((n, r) => n + r.v[id] / r.base - 1, 0) / out.length, mx = id => Math.max(...out.map(r => r.v[id] / r.base - 1));
  console.log('\nกำไรเพิ่มเฉลี่ย/สูงสุดเทียบไม่มีตู้: ' + variants.map(v => `${v.id} ${pc(avg(v.id))}/${pc(mx(v.id))}`).join(' • '));
}

// ---- ความสบาย: ค่าอาหารต่อชั่วโมง เทียบต้นทุนเฟอร์นิเจอร์ ----
const FOODCOIN = 0.4; // เหรียญต่อแต้มอิ่มของอาหารร้านที่ถูกสุด (ขนมปัง 6 เหรียญ/15 แต้ม = 0.4 เท่ากันทุกเมนู) ราคาที่นักเล่นเหตุผลจ่ายจริง
function comfort() {
  const H = S.PLAYER_HUNGER, F = S.FURN, C = S.HOME.comfort;
  const drainWork = H.workMul * 60000 / H.tickMs; // แต้มหิว/นาที ตอนทำงาน (ทำงานล้วน)
  const hrCost = drainWork * 60 * FOODCOIN;        // เหรียญ/ชม. ที่ทำงานล้วน (เพดานค่าอาหาร) ซื้อขนมปัง
  console.log(`ค่าอาหาร: หิวลด ${drainWork.toFixed(1)} แต้ม/นาทีตอนทำงาน (เดินเฉยๆ ${(H.idleMul * 60000 / H.tickMs).toFixed(1)}) • อาหารร้าน ${FOODCOIN} เหรียญ/แต้ม → ทำงานล้วน ${num(hrCost)} เหรียญ/ชม. (econsim ใช้ 2.9/นาที = 174/ชม.)`);
  // ต้นทุนเฟอร์นิเจอร์: ซื้อร้าน = price • ของ noshop = ทำเอง (ราคา FURN เป็นมูลค่า ใช้ราคา FURN ×1 เป็นต้นทุนวัสดุ+ค่าเตา ≈ ราคา)
  const cost = ids => ids.reduce((n, id) => n + F[id].price, 0);
  // ชุดห้องที่ถูกที่สุด (เลือกชิ้นถูกสุดในแต่ละช่อง)
  const cheapest = (id) => { const D = S.HOME.sets[id]; return D.slots.map(sl => sl.any.slice().sort((a, b) => F[a].price - F[b].price)[0]); };
  const setsRes = {}; for (const id of Object.keys(S.HOME.sets)) { const ids = cheapest(id); setsRes[id] = { ids, cost: cost(ids) }; }
  console.log('\nชุดห้องที่ถูกที่สุด (ชิ้นถูกสุดต่อช่อง):');
  for (const [id, r] of Object.entries(setsRes)) console.log('  ' + (S.HOME.sets[id].emoji + ' ' + S.HOME.sets[id].name).padEnd(22) + num(r.cost).padStart(7) + ' เหรียญ  ' + r.ids.map(i => F[i].name).join(' + '));
  // คะแนนความสบายจากเฟอร์นิเจอร์ที่ถูกที่สุดเพื่อไปถึงแต่ละขั้น (greedy: คะแนน/ราคา)
  const items = Object.keys(F).map(id => { const d = F[id], p = (d.rare || d.cat === 'rare') ? C.pts.rare : d.price >= C.pts.luxPrice ? C.pts.lux : C.pts.def; return { id, cat: d.cat, p, price: d.price, noshop: !!d.noshop, legacy: !!d.legacy }; }).filter(x => !x.legacy);
  const cheapTier = (target, withSets) => { // เลือกชิ้นถูกสุดต่อคะแนน จนถึงเป้า (ตัดเพดานหมวด) + ถ้า withSets ใส่ชุดที่ให้ comfort ก่อน
    const pick = [], by = {}; let v = 0, total = 0; const have = new Set();
    const add = x => { if (have.has(x.id)) return; have.add(x.id); pick.push(x.id); total += x.price; const room = (C.cap[x.cat] || 0) - (by[x.cat] || 0), g = Math.max(0, Math.min(x.p, room)); by[x.cat] = (by[x.cat] || 0) + x.p; v += g; };
    for (const id of withSets || []) add(items.find(x => x.id === id));
    const pool = items.filter(x => x.p === 1).sort((a, b) => a.price - b.price);
    for (const x of pool) { if (v >= target) break; add(x); }
    return { v, total, n: pick.length, pick };
  };
  console.log('\nต้นทุนถึงแต่ละขั้นความสบาย (ชิ้นถูกสุด ชนิดไม่ซ้ำ ตัดเพดานหมวด):');
  for (let t = 1; t < C.tiers.length; t++) { const r = cheapTier(C.tiers[t]); console.log(`  ขั้น ${t} ${C.names[t]} (≥${C.tiers[t]} แต้ม): ${r.n} ชิ้น ${num(r.total)} เหรียญ (ได้ ${r.v} แต้ม)`); }
  // ประหยัดค่าอาหารต่อชั่วโมง
  const R = S.HOME.rest;
  const sleepSave = (tier, restMul, workFrac) => { // นอนครั้งเดียวแล้วบัฟอยู่ mins×restMul นาที: ประหยัด 25% ของหิวที่ลดตอนบัฟ (ทำงาน workFrac ของเวลา)
    const min = R.mins[tier] * restMul, drain = (workFrac * H.workMul + (1 - workFrac) * H.idleMul) * 60000 / H.tickMs; // แต้ม/นาที
    return { min, pts: min * drain * (1 - R.mul), coin: min * drain * (1 - R.mul) * FOODCOIN };
  };
  console.log('\nบัฟ 😴 หลับสบาย (หิวลด ×' + R.mul + '):');
  for (let t = 1; t < R.mins.length; t++) for (const rm of [1, 1.5]) { const s = sleepSave(t, rm, 1); console.log(`  ขั้น ${t} ${rm === 1.5 ? 'ห้องนอนครบ' : 'ไม่มีชุด'}: ${s.min.toFixed(0)} นาที ประหยัด ${s.pts.toFixed(0)} แต้ม ≈ ${s.coin.toFixed(0)} เหรียญ/รอบ (ทำงานล้วน)`); }
  // ประหยัดสูงสุดต่อชม.: ขั้น 3 + ห้องนอน + ครัว + นั่งเล่น: นอน 1 นาทีทุกครั้งที่บัฟหมด (บัฟคลุมได้ ≤ 100%) กินในบ้านเพิ่ม 20% (ถ้ากินในบ้านทั้งหมด)
  console.log('\nประหยัดค่าอาหารสูงสุดต่อชม. (ขั้น 3 ชุดครบ นอนต่อบัฟให้คลุมทั้งชั่วโมง ทำงานล้วน):');
  const cover = Math.min(1, R.mins[3] * 1.5 / 60); // สัดส่วนชั่วโมงที่ถูกคลุม
  const dr = H.workMul * 60000 / H.tickMs * 60; // แต้ม/ชม.
  const rest = dr * cover * (1 - R.mul), kit = (1 - 1 / 1.2) * dr * (1 - cover * (1 - R.mul)); // ครัว: กินในบ้านอิ่ม ×1.2 → ซื้ออาหารน้อยลง 1/1.2 (เฉพาะส่วนที่กินในบ้าน = 100% เพดาน)
  console.log(`  บัฟ: คลุม ${pc(cover)} ของชั่วโมง ลดความหิวได้ ${rest.toFixed(0)} แต้ม ≈ ${(rest * FOODCOIN).toFixed(0)} เหรียญ/ชม. (${pc(rest / dr)} ของค่าอาหาร)`);
  console.log(`  ชุดครัว (กินในบ้านเท่านั้น เพดานทฤษฎี): ≈ ${(kit * FOODCOIN).toFixed(0)} เหรียญ/ชม. อีก ${pc(kit / dr)}  → รวมเพดาน ≈ ${((rest + kit) * FOODCOIN).toFixed(0)} เหรียญ/ชม. (${pc((rest + kit) / dr)} ของค่าอาหาร ${num(hrCost)}/ชม. ไม่ถึง 100% เสมอ)`);
  // คืนทุน (ชม.เล่น) = ต้นทุนชุดที่ต้องมีเพื่อบัฟขั้น 3 + ห้องนอน + ครัว ÷ ประหยัดต่อชม.
  const full = { bed: cheapTier(C.tiers[3], [...cheapest('bedroom'), ...cheapest('kitchen'), ...cheapest('living')]), };
  console.log(`\nต้นทุนบ้านขั้น 3 + ชุดนอน/ครัว/นั่งเล่น (ถูกสุด): ${full.bed.n} ชิ้น ${num(full.bed.total)} เหรียญ (ได้ ${full.bed.v} แต้ม)`);
  const save = (rest + kit) * FOODCOIN;
  console.log(`  คืนทุน = ${num(full.bed.total)} ÷ ${save.toFixed(0)} = ${num(full.bed.total / save)} ชม.เล่น (ถ้าเล่น 2 ชม./วัน = ${num(full.bed.total / save / 2)} วัน)`);
  // ความอิ่มตอนนั่ง
  console.log('\nนั่ง/นอนฟื้นอิ่ม (แต้ม/นาที) ตามขั้น: ' + C.sitMul.map((m, i) => `ขั้น ${i} ${(H.sitGain * 60000 / H.sitMs * m).toFixed(0)}`).join(' • ') + ` • (ม้านั่งเมือง ${(H.sitGain * 60000 / H.sitMs).toFixed(0)})`);
  const fill = 80; console.log('  เวลานั่งเติม 80 แต้ม: ' + C.sitMul.map((m, i) => `ขั้น ${i} ${(fill / (H.sitGain * 60000 / H.sitMs * m)).toFixed(1)} นาที`).join(' • '));
}

if (what === 'cold' || what === 'all') cold();
if (what === 'comfort' || what === 'all') comfort();
module.exports = { run, best, prodOf };
