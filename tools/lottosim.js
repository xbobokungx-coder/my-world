'use strict';
// WP-33 จำลอง EV หวยกับผู้ซื้อหลายบัญชี • เรียก lottoBuy/lottoDraw ตัวจริงจาก server/systems/lotto.js กับโลกจำลอง
// ไม่แตะ data/ ไม่เขียน event log (ครอบ logEv ก่อน require) • ข้อเสนอแก้กติกาทำในหน่วยความจำของซิมเท่านั้น
// ใช้: node tools/lottosim.js [--draws=1500] [--real=0|10]   (real = จำนวนผู้เล่นจริงที่ซื้อสุ่ม 5 ใบ/งวดเจือจางรางวัล)
const path = require('path');
const util = require(path.join(__dirname, '../server/util.js'));
util.logEv = () => {};
const S = require(path.join(__dirname, '../public/shared.js'));
const mod = require(path.join(__dirname, '../server/systems/lotto.js'));
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? Number(a.split('=')[1]) : d; };
const DRAWS = arg('draws', 1500), REAL = arg('real', 0);
const BASE_PRIZE = JSON.parse(JSON.stringify(S.LOTTO.prize));
const BASE_MAX = S.LOTTO.maxTickets;

function mkWorld() {
  const w = Object.assign({}, mod);
  w.room = 'sim'; w.dirty = false; w.saved = {}; w.players = new Map(); w.paid = {};
  w.lotto = { pot: 0, round: '2999-1-1', sealed: null, tickets: {}, last: null, hist: [] };
  w.lotto.sealed = w.lottoSeal();
  w.toast = () => {}; w.sfxTo = () => {}; w.broadcast = () => {}; w.nearLucky = () => true; w.lottoOk = () => true;
  w.lottoAward = (key, _k, n) => { w.paid[key] = (w.paid[key] || 0) + n; };
  w.add = (p, _c, n) => { p.rec.inv.coin += n; };
  return w;
}
const mkP = key => ({ key, rec: { inv: { coin: 1e9 } }, ws: { readyState: 3 } });
const pad = n => String(n).padStart(3, '0');
function shuffled(n) { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// กลยุทธ์เลือกเลข: random = สุ่มซ้ำได้ • cover = เลขไม่ซ้ำกันทุกใบ และเลขท้ายกระจายเท่ากัน (ตามหลักหวย: ใบที่ i ลงท้าย i%10)
function pickNums(strategy, total) {
  if (strategy === 'random') return Array.from({ length: total }, () => pad(Math.floor(Math.random() * 1000)));
  const used = new Set(), out = [], byLast = Array.from({ length: 10 }, (_, d) => shuffled(100).map(h => h * 10 + d));
  for (let i = 0; i < total; i++) { const l = byLast[i % 10]; out.push(pad(l[Math.floor(i / 10) % 100])); }
  return out;
}

// หนึ่งสถานการณ์: pot0 = เงินในกองก่อนขายตั๋วงวดนี้, accts บัญชีละ perAcct ใบ, ipCap = เพดานตั๋วรวมต่อเครื่อง/IP (0 = ไม่จำกัด)
function run({ pot0, accts, perAcct = 10, strategy = 'cover', real = REAL, ipCap = 0, prize, draws = DRAWS }) {
  S.LOTTO.prize = prize || BASE_PRIZE; S.LOTTO.maxTickets = BASE_MAX;
  let cost = 0, win = 0, tickets = 0, worstOver = 0, potEnd = 0, hitDraws = 0, pnl = [], realCost = 0, realWin = 0;
  for (let d = 0; d < draws; d++) {
    const w = mkWorld(); w.lotto.pot = pot0;
    const A = []; let total = Math.min(accts * perAcct, ipCap > 0 ? ipCap : 1e9), left = total;
    const nums = pickNums(strategy, total);
    let at = 0;
    for (let i = 0; i < accts && left > 0; i++) { const p = mkP('atk' + i); const n = Math.min(perAcct, left); w.lottoBuy(p, { nums: nums.slice(at, at + n) }); at += n; left -= n; }
    for (let i = 0; i < real; i++) { const p = mkP('real' + i); w.lottoBuy(p, { nums: Array.from({ length: 5 }, () => pad(Math.floor(Math.random() * 1000))) }); }
    const base = w.lotto.pot; // = pot0 + ค่าตั๋วทุกใบ (ตรวจว่า lottoBuy เติมกองจริง)
    w.lottoDraw();
    let paidAll = 0, atkWin = 0, rWin = 0;
    for (const [k, v] of Object.entries(w.paid)) { paidAll += v; if (k.startsWith('atk')) atkWin += v; else rWin += v; }
    if (paidAll > base) worstOver = Math.max(worstOver, paidAll - base);
    const c = total * S.LOTTO.price; cost += c; win += atkWin; tickets += total; potEnd += w.lotto.pot; if (atkWin > 0) hitDraws++;
    pnl.push(atkWin - c); realCost += real * 5 * S.LOTTO.price; realWin += rWin;
  }
  pnl.sort((a, b) => a - b);
  return { tickets: tickets / draws, cost: cost / draws, win: win / draws, ev: tickets ? win / cost : 0, net: (win - cost) / draws, p10: pnl[Math.floor(pnl.length * 0.1)], p90: pnl[Math.floor(pnl.length * 0.9)], potEnd: potEnd / draws, worstOver, realEv: realCost ? realWin / realCost : NaN };
}

// ข้อเสนอ (ปรับ prize ในหน่วยความจำ)
const clone = p => JSON.parse(JSON.stringify(p));
const mk = f => { const p = clone(BASE_PRIZE); f(p); return p; };
const last1 = p => p.find(x => x.last1);
const flat1 = p => { const l = last1(p); l.min = 100; l.cap = 100; };
const scaleCap = (p, k) => { for (const x of p) if (!x.last1) x.cap = Math.round(x.cap * k); };
const P1 = mk(flat1), P4 = mk(p => { flat1(p); scaleCap(p, 0.25); }), P5 = mk(p => { flat1(p); scaleCap(p, 0.5); });
const PROPOSALS = {
  P0: { label: 'กติกาปัจจุบัน', prize: BASE_PRIZE, ipCap: 0 },
  P1: { label: 'last1 จ่ายตายตัว 100/ใบที่ถูก (min=cap=100) อย่างเดียว', prize: P1, ipCap: 0 },
  P2: { label: 'จำกัด 10 ใบ/IP รวมทุกบัญชี (กติกาอื่นเดิม)', prize: BASE_PRIZE, ipCap: 10 },
  P3: { label: 'จำกัด 30 ใบ/IP (กติกาอื่นเดิม)', prize: BASE_PRIZE, ipCap: 30 },
  P4: { label: 'P1 + เพดานรางวัลหลักคูณ 0.25 (100k/10k/10k/25k/10k/50k -> 25k/2.5k/2.5k/6.25k/2.5k/12.5k) pct เดิม', prize: P4, ipCap: 0 },
  P5: { label: 'P1 + เพดานรางวัลหลักคูณ 0.5', prize: P5, ipCap: 0 },
  P6: { label: 'P4 + จำกัด 30 ใบ/IP', prize: P4, ipCap: 30 },
  P7: { label: 'จำกัด 20 ใบ/IP (กติกาอื่นเดิม)', prize: BASE_PRIZE, ipCap: 20 },
};

// โหมดต่อเนื่อง: กองสะสมข้ามงวด มีเงินเข้า inflow/วัน (ภาษี ค่าซ่อม ฯลฯ สมมุติ) ผู้เล่นจริง real คน x5 ใบ + ผู้โกง accts บัญชี x10 ใบ cover
function dyn({ prize, ipCap = 0, accts = 0, real = 10, inflow = 5000, days = 120, trials = 6 }) {
  S.LOTTO.prize = prize; S.LOTTO.maxTickets = BASE_MAX;
  let potSum = 0, atkNet = 0, realEvSum = 0, realN = 0, n = 0, potMax = 0, atkShare = 0;
  for (let t = 0; t < trials; t++) {
    const w = mkWorld(); w.lotto.pot = S.LOTTO.seed;
    for (let d = 0; d < days; d++) {
      w.lotto.pot += inflow; w.paid = {};
      let total = Math.min(accts * 10, ipCap > 0 ? ipCap : 1e9), at = 0; const nums = pickNums('cover', total);
      for (let i = 0; i < accts && at < total; i++) { const k = Math.min(10, total - at); w.lottoBuy(mkP('atk' + i), { nums: nums.slice(at, at + k) }); at += k; }
      for (let i = 0; i < real; i++) w.lottoBuy(mkP('real' + i), { nums: Array.from({ length: 5 }, () => pad(Math.floor(Math.random() * 1000))) });
      w.lotto.round = '2999-1-1'; w.lottoDraw();
      let a = 0, r = 0; for (const [k, v] of Object.entries(w.paid)) { if (k.startsWith('atk')) a += v; else r += v; }
      if (d >= 20) { potSum += w.lotto.pot; potMax = Math.max(potMax, w.lotto.pot); atkNet += a - total * 100; realEvSum += r - real * 500; realN++; n++; atkShare += a / Math.max(1, a + r); }
    }
  }
  return { pot: potSum / n, potMax, atkNet: atkNet / n, realNet: realEvSum / n, atkShare: atkShare / n };
}

const POTS = [['เล็ก 30k', 30000], ['กลาง 100k', 100000], ['ใหญ่ 300k', 300000], ['ใหญ่มาก 1M', 1000000]];
const ACCTS = [1, 3, 10, 30, 100];
const fmt = n => (n >= 0 ? '+' : '') + Math.round(n).toLocaleString();
const only = process.argv.find(x => x.startsWith('--only='));
const names = only ? only.split('=')[1].split(',') : Object.keys(PROPOSALS);
if (!process.argv.includes('--dyn')) console.log(`ซิม ${DRAWS} งวด/จุด • ผู้เล่นจริงเจือจาง ${REAL} คน x5 ใบ • ราคาตั๋ว ${S.LOTTO.price} • ซื้อ 10 ใบ/บัญชี\n`);
if (process.argv.includes('--dyn')) {
  const inflow = arg('inflow', 5000);
  console.log(`โหมดต่อเนื่อง 120 วัน x6 รอบ • เงินเข้ากอง ${inflow}/วัน (สมมุติ) • ผู้เล่นจริง ${REAL || 10} คน x5 ใบ • ผู้โกง cover 10 ใบ/บัญชี\n`);
  console.log('ข้อเสนอ  ผู้โกง(บัญชี)  กองเฉลี่ย   กองสูงสุด  ผู้โกงสุทธิ/วัน  ผู้เล่นจริงสุทธิ/วัน  ส่วนแบ่งรางวัลของผู้โกง');
  for (const nm of names) for (const a of [0, 10, 30]) { const P = PROPOSALS[nm], r = dyn({ prize: P.prize, ipCap: P.ipCap, accts: a, real: REAL || 10, inflow }); console.log(`${nm.padEnd(8)} ${String(a).padStart(8)}   ${String(Math.round(r.pot)).padStart(9)}  ${String(Math.round(r.potMax)).padStart(9)}  ${fmt(r.atkNet).padStart(14)}  ${fmt(r.realNet).padStart(18)}  ${(r.atkShare * 100).toFixed(0)}%`); }
  process.exit(0);
}
for (const nm of names) {
  const P = PROPOSALS[nm];
  console.log(`== ${nm}: ${P.label}`);
  for (const strat of ['cover', 'random']) {
    console.log(`  กลยุทธ์ ${strat}`);
    console.log('  กอง          บัญชี ใบ/งวด  EV/ใบ   กำไรสุทธิ/งวด  p10..p90            กองหลังออก  เกินกอง');
    for (const [pn, pot] of POTS) for (const a of ACCTS) {
      if (strat === 'random' && a !== 10 && a !== 30 && a !== 100) continue;
      const r = run({ pot0: pot, accts: a, strategy: strat, ipCap: P.ipCap, prize: P.prize });
      console.log(`  ${pn.padEnd(12)} ${String(a).padStart(4)} ${String(Math.round(r.tickets)).padStart(6)}  ${r.ev.toFixed(2)}  ${fmt(r.net).padStart(12)}  ${(fmt(r.p10) + ' .. ' + fmt(r.p90)).padEnd(20)} ${String(Math.round(r.potEnd)).padStart(9)}  ${r.worstOver}`);
    }
  }
  console.log('');
}
