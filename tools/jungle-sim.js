// ซิมต่อสู้ป่าดงดิบ: รันโค้ดเซิร์ฟเวอร์จริง (creatures.js + combat.js) ด้วยเวลาเสมือนและบอตผู้เล่น • ไม่แตะ data จริง (DATA_DIR ชั่วคราว)
// รัน: node tools/jungle-sim.js [รอบต่อช่อง=200]   วัด: TTK / ดาเมจที่เสียต่อการเจอ 1 ตัว / ตัวที่ฆ่าได้ก่อนสลบ / ฟื้น HP / XP ต่อชม. / เวลาถึงเลเวล
// บอต: pro = ตัดสินใจทุก 50ms (เพดานทักษะ) • human = ตัดสินใจเฉลี่ยทุก 250ms • casual = ทุก 500ms • stand = ยืนนิ่งไม่เดินตามหลังโดนผลัก (มือใหม่ไม่หลบ)
// ข้อสังเกต: ท่าฟันขัดจังหวะง้างของมอนสเตอร์ทุกตัว (ยกเว้นภูตตอไม้ armor) และผลักถอย 1 ช่อง → ถ้าฟันก่อนทัน เกือบไม่โดนตี จึงต้องมีบอตหลายระดับเพื่อให้เห็นช่วงจริง
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-jsim-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, CB = S.COMBAT, C = S.CREATURE, J = S.JUNGLE;
const N = +process.argv[2] || 200;
const mkWs = () => ({ readyState: 1, msgs: [], send() {} });
const w = new World('jsim'), a = w.join(mkWs(), 'sim', '#fff').p;
a.rec.hunger = 100; a.rec.inv = { coin: 0 };
let vt = 1e9; Date.now = () => vt; // เวลาเสมือน
const F = () => w.floorOf(97), SWING = S.SWING_MS, STEP = 50, SPD = C.playerSpd;
const kinds = Object.keys(S.JUNGLE_MON);
const open = (x, y) => !S.blockedAt(F().map, (x + 0.5) * TS, (y + 0.5) * TS, 14) && !S.jungleSafe((x + 0.5) * TS, (y + 0.5) * TS);
let spot = null; for (let y = 12; y < 20 && !spot; y++) for (let x = 25; x < 40 && !spot; x++) if ([-2, -1, 0, 1, 2, 3, 4, 5].every(d => open(x + d, y))) spot = [x, y];
const enter = () => { if (a.scene) w.changeScene(a, null, S.SPAWN.x, S.SPAWN.y); w.warpTo(a, 'jungle'); const f = F(); f.creatures.clear(); f.crWait = []; w.crAt = 0; w.cbAt = 0; };
const resetLv = () => { a.rec.skills = a.rec.skills || {}; a.rec.skills.fight = 0; a.cb.mx = w.combatMax(a); }; // ซิมไม่ให้เลเวลขึ้นระหว่างวัด (HP คงที่ Lv1)
const place = (keepHp) => { resetLv(); if (!keepHp) a.cb.hp = a.cb.mx; a.x = (spot[0] + 0.5) * TS; a.y = (spot[1] + 0.5) * TS; a.dir = 3; a.stunUntil = a.faintUntil = a.faintWarp = a.crInv = a.hitAt = a.lastAct = 0; a.cb.st = 'ok'; a.cb.last = 0; };
const dirOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
function mon(k, dx, dy = 0) { const f = F(), hp = S.crHpOf(k, 97), x = a.x + dx * TS, y = a.y + dy * TS, c = { id: (mon.n = (mon.n || 7000) + 1), k, x, y, dir: 2, st: 0, hp, hpMax: hp, until: 0, wt: 0, wdx: 0, wdy: 0, tid: 0, sent: null, spot: 0, hx: x, hy: y, ret: false }; f.creatures.set(c.id, c); return c; }
const tickAll = () => { w.creatureTick(vt); w.combatTick(vt); };
// บอตผู้เล่น 1 ตัวสู้กับสัตว์ c จนตายหรือสลบหรือหมดเวลา • คืน { ms, dmg, hits, win, faint }
// opt.lat = รอบตัดสินใจเฉลี่ย ms (0 = ทุก 50ms) ระหว่างรอบ ถ้ากำลังเดินเข้าหาก็เดินต่อแต่ไม่ฟัน • opt.chase=false = ไม่เดินตามเมื่อห่างเกินระยะ • opt.rt = หลบวงเตือน cra หลังเห็นกี่ ms (0 = ไม่หลบ)
function fight(c, opt) {
  const { rt = 0, lat = 0, sword = true, chase = true } = opt, f = F(); a.rec.inv.sword_1 = sword ? 1 : 0;
  const t0 = vt, hp0 = a.cb.hp, reach = CB.reach * TS * 0.97; let hits = 0, lastTick = vt, dodgeAt = 0, dodgeFor = 0, lastHp = a.cb.hp, nextDec = vt + lat * Math.random(), mv = false;
  const out = (win, faint) => ({ ms: vt - t0, dmg: hp0 - a.cb.hp, hits, win, faint });
  for (let i = 0; i < 2400; i++) { // ≤ 120 วิ
    vt += STEP;
    if (vt - lastTick >= C.tickMs) { lastTick = vt; tickAll(); }
    if (a.cb.hp < lastHp - 0.01) hits++; lastHp = a.cb.hp;
    if (a.cb.st === 'faint') return out(false, true);
    if (!f.creatures.has(c.id)) return out(true, false);
    if (vt < (a.stunUntil || 0)) { mv = false; continue; }
    if (rt && c.st === 2 && c.w && c.until !== dodgeFor) { dodgeFor = c.until; dodgeAt = vt + rt; } // หลบ: ขยับหลัง rt แล้วเดินออกนอกวงด้วยความเร็วคน
    if (rt && c.st === 2 && c.w && vt >= dodgeAt) {
      const dx = a.x - c.w.x, dy = a.y - c.w.y, d = Math.hypot(dx, dy) || 1;
      if (d < c.w.r + 3) { const s = SPD * STEP / 1000, nx = a.x + dx / d * s, ny = a.y + dy / d * s; if (!S.blockedAt(f.map, nx, ny, 14)) { a.x = nx; a.y = ny; } continue; }
    }
    const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
    if (vt >= nextDec) {
      nextDec = vt + (lat ? lat * (0.5 + Math.random()) : 0); a.dir = dirOf(dx, dy);
      if (d <= reach) { mv = false; if (vt - (a.hitAt || 0) >= SWING) w.combatSwing(a, {}); } else mv = chase;
    }
    if (mv && d > 14) { const s = Math.min(SPD * STEP / 1000, d - 13), nx = a.x + dx / d * s, ny = a.y + dy / d * s; if (!S.blockedAt(f.map, nx, ny, 14)) { a.x = nx; a.y = ny; } if (!lat && d - s <= reach) mv = false; }
  }
  return out(false, false);
}
const avg = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
const pct = (xs, p) => { const s = [...xs].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const fmt = (x, n = 1) => x.toFixed(n);
const MODES = [['pro', { lat: 0 }], ['human 250ms', { lat: 250 }], ['casual 500ms', { lat: 500 }], ['stand นิ่ง', { lat: 300, chase: false }], ['human+หลบ450', { lat: 250, rt: 450 }]];

// ---------- 1) เจอ 1 ตัว ----------
console.log(`\n=== 1) เจอ 1 ตัว (สัตว์อยู่ห่าง 2.4 ช่อง HP เต็ม ${CB.hpBase}) รอบละ ${N} ===`);
console.log('ชนิด   อาวุธ    บอต             TTK วิ(เฉลี่ย|p90)  เสีย HP(เฉลี่ย|p90)  โดนกี่ครั้ง  โดนบ้าง%  ตัวที่ฆ่าได้ก่อนสลบ');
const res = {};
for (const k of kinds) for (const sword of [true, false]) for (const [mn, o] of MODES) {
  enter(); const ttk = [], dm = [], hs = []; let any = 0;
  for (let i = 0; i < N; i++) { place(); const r = fight(mon(k, 2.4), { ...o, sword }); F().creatures.clear(); ttk.push(r.ms / 1000); dm.push(r.dmg); hs.push(r.hits); if (r.hits) any++; vt += 20000; }
  const chain = []; // ฆ่าติดๆ (เว้น 4 วิเดินหาตัวถัดไป ไม่ฟื้น) จนสลบ
  for (let i = 0; i < Math.min(N, 60); i++) { place(); let n = 0; for (; n < 400; n++) { place(true); const r = fight(mon(k, 2.4), { ...o, sword }); F().creatures.clear(); if (r.faint) break; vt += 4000; } chain.push(n); vt += 20000; }
  res[k + (sword ? 'S' : 'B') + mn] = { ttk: avg(ttk), dm: avg(dm), chain: avg(chain), any: any / N };
  console.log(`${k.padEnd(7)}${(sword ? 'ดาบไม้' : 'มือเปล่า').padEnd(9)}${mn.padEnd(16)}${fmt(avg(ttk)).padStart(5)} |${fmt(pct(ttk, .9)).padStart(5)}      ${fmt(avg(dm)).padStart(5)} |${fmt(pct(dm, .9), 0).padStart(4)}       ${fmt(avg(hs), 2).padStart(5)}      ${fmt(any / N * 100, 0).padStart(4)}   ${fmt(avg(chain), 1).padStart(6)}${avg(chain) >= 400 ? '+' : ''}`);
}

// ---------- 1b) วิ่งผ่านโดยไม่สู้ (ผู้เล่นวิ่งผ่านที่ห่างข้าง 1.5 ช่อง ความเร็วเต็ม) ----------
console.log('\n=== 1b) วิ่งผ่านโดยไม่ฟัน (ห่างข้าง 1.5 ช่อง วิ่ง 12 ช่อง ผ่านหน้าสัตว์ที่ยืนรอ) • โดนอย่างน้อย 1 ครั้ง% | HP ที่เสียเฉลี่ย ===');
for (const k of kinds) {
  enter(); let any = 0; const dm = [];
  for (let i = 0; i < N; i++) {
    place(); const c = mon(k, 6, 1.5); a.y = (spot[1] + 0.5) * TS; const hp0 = a.cb.hp; let lastTick = vt;
    for (let t = 0; t < 130; t++) { vt += STEP; if (vt - lastTick >= C.tickMs) { lastTick = vt; tickAll(); } if (vt >= (a.stunUntil || 0)) { const nx = a.x + SPD * STEP / 1000; if (!S.blockedAt(F().map, nx, a.y, 14)) a.x = nx; } if (a.cb.st === 'faint') break; }
    F().creatures.clear(); if (a.cb.hp < hp0 - 0.01) any++; dm.push(hp0 - a.cb.hp); vt += 20000;
  }
  console.log(`  ${k.padEnd(7)} โดน ${fmt(any / N * 100, 0)}% | เสีย ${fmt(avg(dm))} HP (ถ้าโดน ${fmt(any ? avg(dm) * N / any : 0)})`);
}

// ---------- 2) ฟื้นตัว ----------
const mx = CB.hpBase;
console.log(`\n=== 2) ฟื้น HP (HP เต็ม Lv1 = ${mx}) ===`);
console.log(`สลบ ${CB.faintMs / 1000} วิ → ตื่นที่ค่าย ${CB.wakePct * 100}% = ${mx * CB.wakePct} HP → เขตปลอดภัย +${CB.regenSafe}/วิ เต็มใน ${fmt((mx - mx * CB.wakePct) / CB.regenSafe)} วิ (สลบถึงเต็ม ${fmt(CB.faintMs / 1000 + (mx - mx * CB.wakePct) / CB.regenSafe)} วิ) • ค่ายไกลจากสไลม์ ~${fmt(Math.hypot(24 - 31, 14 - 5) / (SPD / TS), 0)} วิเดิน`);
console.log(`นอกเขต: พ้นสู้ ${CB.regenIdleMs / 1000} วิ แล้ว +${CB.regenRate}/วิ ฟื้น 50 HP = ${CB.regenIdleMs / 1000 + 50 / CB.regenRate} วิ`);
console.log(`สมุนไพร +${CB.herbHeal} HP คูลดาวน์ ${CB.herbCdMs / 1000} วิ (สูงสุด ${CB.herbHeal / (CB.herbCdMs / 1000)} HP/วิ) • ${J.herbs.length} จุด งอก ${J.herbMs / 1000} วิ = ${fmt(J.herbs.length * J.herbN * 3600 / (J.herbMs / 1000), 0)} ชิ้น/ชม. = ${fmt(J.herbs.length * J.herbN * CB.herbHeal / (J.herbMs / 1000), 1)} HP/วิ ทั้งป่า`);
console.log(`อาหาร ฟื้น = HP เต็ม × food × ${CB.eatPct}% (ในโค้ดไม่มีคูลดาวน์การกิน):`);
for (const k of ['meal_bread', 'meal_sandwich', 'meal_soup', 'meal_rice', 'crop_carrot', 'dish_vegbowl', 'dish_grill', 'dish_seafood', 'dish_feast', 'dish_platter']) { const i = S.itemInfo(k), food = S.FOOD[k], heal = mx * food * CB.eatPct / 100; console.log(`  ${(i.name || k).padEnd(16)} food ${String(food).padStart(3)} → +${fmt(heal, 1).padStart(5)} HP • ${i.buy ? 'ซื้อ ' + i.buy + ' เหรียญ = ' + fmt(i.buy / heal, 2) + ' เหรียญ/HP' : 'ขายได้ ' + i.sell + ' เหรียญ = ' + fmt(i.sell / heal, 1) + ' เหรียญ/HP (ราคาขาย)'}`); }

// ---------- 3) XP ----------
console.log('\n=== 3) XP นักสู้ ===');
const spots = J.mon.spots, per = k => S.JUNGLE_MON[k].xp, capH = 3600 / (J.mon.respawnMs / 1000);
const xpCycle = spots.reduce((s, [k]) => s + per(k), 0);
console.log(`เพดานเกิดใหม่: ${spots.length} จุด × ${fmt(capH, 0)} ตัว/ชม. = ${spots.length * capH} ตัว/ชม. • XP ต่อรอบ ${J.mon.respawnMs / 1000} วิ = ${xpCycle} • เพดาน ${xpCycle * capH} XP/ชม. (ต่อ 1 คน ผู้เล่นหลายคนตีตัวเดียวกันได้ XP ครบทุกคน)`);
const m = F().map, open2 = (x, y) => x >= 0 && y >= 0 && x < S.W && y < S.H && !S.blockedAt(m, (x + 0.5) * TS, (y + 0.5) * TS, 6) && m[y][x] !== S.T.BRIDGE;
const bfs = (sx, sy) => { const d = new Map([[sx + ',' + sy, 0]]), q = [[sx, sy]]; for (let i = 0; i < q.length; i++) for (const [dx, dy] of S.DIRS) { const x = q[i][0] + dx, y = q[i][1] + dy, key = x + ',' + y; if (!d.has(key) && open2(x, y)) { d.set(key, d.get(q[i][0] + ',' + q[i][1]) + 1); q.push([x, y]); } } return d; };
function tour(list, start) { let cur = start, left = list.slice(), len = 0; while (left.length) { const d = bfs(cur[0], cur[1]); left.sort((p, q) => (d.get(p[1] + ',' + p[2]) || 1e9) - (d.get(q[1] + ',' + q[2]) || 1e9)); const n = left.shift(); len += d.get(n[1] + ',' + n[2]) || 0; cur = [n[1], n[2]]; } return len; }
const sets = { 'ง่ายล้วน (สไลม์ 3)': spots.filter(s => s[0] === 'jslime'), 'สไลม์+แตน (5)': spots.filter(s => s[0] === 'jslime' || s[0] === 'jwasp'), 'ทั้ง 9 จุด': spots };
const HUMAN = 0.75; // ประสิทธิภาพมนุษย์จริง (หยุดดู หลงทาง ไปไม่ทันตอนเกิด) เทียบเดินตรงเต็มสปีด
console.log(`ทัวร์เดินเก็บมอนสเตอร์ (ระยะ BFS จริง ${fmt(SPD / TS, 2)} ช่อง/วิ เวลาสู้จากซิมข้อ 1 ดาบ human 250ms + 1.5 วิเล็ง ×${HUMAN} มนุษย์):`);
const tourRes = {};
for (const [name, list] of Object.entries(sets)) {
  const len = tour(list, [31, 5]), fightS = list.reduce((s, [k]) => s + res[k + 'Shuman 250ms'].ttk + 1.5, 0), walkS = len / (SPD / TS), loopS = Math.max(walkS + fightS, J.mon.respawnMs / 1000), xpLoop = list.reduce((s, [k]) => s + per(k), 0);
  tourRes[name] = { killsH: list.length * 3600 / loopS * HUMAN, xpH: xpLoop * 3600 / loopS * HUMAN };
  console.log(`  ${name.padEnd(18)} เดิน ${String(len).padStart(3)} ช่อง = ${fmt(walkS, 0)} วิ + สู้ ${fmt(fightS, 0)} วิ → รอบละ ${fmt(loopS, 0)} วิ (ขั้นต่ำ ${J.mon.respawnMs / 1000}) • ${fmt(tourRes[name].killsH, 0)} ตัว/ชม. • ${fmt(tourRes[name].xpH, 0)} XP/ชม.`);
}
const avgXp = list => list.reduce((s, [k]) => s + per(k), 0) / list.length, TAB = { 'XP_TABLE เดิม': S.XP_TABLE, 'XP_TABLE_STD': S.XP_TABLE_STD, 'XP_TABLE_FIGHT': S.XP_TABLE_FIGHT };
const hrs = xp => xp / (xp <= 3000 ? tourRes['สไลม์+แตน (5)'].xpH : tourRes['ทั้ง 9 จุด'].xpH);
console.log('เวลาถึงเลเวล (XP/ชม. ของทัวร์ สไลม์+แตน สำหรับตารางถึง 3,000 XP แล้วใช้ทั้ง 9 จุด):');
for (const [tn, T] of Object.entries(TAB)) { if (!T) continue; console.log(`  ${tn.padEnd(15)} ${[2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map(lv => `Lv${lv} ${T[lv]}xp=${fmt(hrs(T[lv]), hrs(T[lv]) < 10 ? 1 : 0)}ชม.`).join(' • ')}`); }
console.log(`ฆ่ากี่ตัวถึง Lv2 (XP/ตัวเฉลี่ย สไลม์+แตน ${fmt(avgXp(sets['สไลม์+แตน (5)']), 1)} | ทั้ง 9 จุด ${fmt(avgXp(spots), 1)}): ` + Object.entries(TAB).filter(([, T]) => T).map(([tn, T]) => `${tn} ${fmt(T[2] / avgXp(sets['สไลม์+แตน (5)']), 0)}/${fmt(T[2] / avgXp(spots), 0)} ตัว`).join(' • '));
console.log('เทียบอาชีพอื่น (XP/ชม.จริง ≈ เพดาน levelsim × 0.5): Lv1 ~1,050 • Lv3 ~1,350 • Lv5 ~1,680 • Lv10 ~3,280 • Lv20 ~12,300');

// ---------- 4) ของตก (ต่อชม. ที่ฟาร์มเพดาน) ----------
console.log('\n=== 4) ของตก jm_* ต่อชม. (เพดาน ฆ่าทุกครั้งที่เกิดใหม่) ===');
for (const k of kinds) { const n = spots.filter(s => s[0] === k).length * capH, d = S.JUNGLE_MON[k].drop; console.log(`  ${k.padEnd(7)} ${n} ตัว/ชม. × ${d.p} = ${fmt(n * d.p, 0)} ${d.item}/ชม.`); }
module.exports = { res, tourRes };
process.exit(0);
