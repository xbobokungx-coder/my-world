'use strict';
// รายงานเศรษฐกิจรายวัน จาก data/events/*.jsonl และไฟล์เซฟ data/<ห้อง>.json (อ่านอย่างเดียว ไม่แก้ข้อมูล)
// ใช้: node tools/economy.js [จำนวนวันย้อนหลัง=7] [โฟลเดอร์ data]
// ดูคู่กับ node tools/stats.js (retention/เซสชัน) • ตัวเลขที่ต้องใช้ event ใหม่ (act, snap, sell.base, starter.ses) มีตั้งแต่ 21 ต.ค. 2026 เป็นต้นไป
const fs = require('fs'), path = require('path');
const days = Math.max(1, +process.argv[2] || 7);
const dir = process.argv[3] || path.join(__dirname, '..', 'data');
const evDir = path.join(dir, 'events');
const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const med = a => { if (!a.length) return null; a = a.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';
const num = n => Math.round(n).toLocaleString('en-US');
const since = Date.now() - days * 864e5;
const evs = [];
if (fs.existsSync(evDir)) for (const f of fs.readdirSync(evDir).filter(f => f.endsWith('.jsonl')).sort())
  for (const ln of fs.readFileSync(path.join(evDir, f), 'utf8').split('\n')) { if (ln) try { const e = JSON.parse(ln); if (e.t >= since) evs.push(e); } catch (e) { /* ข้ามบรรทัดเสีย */ } }

// ----- 1) เงินในระบบตอนนี้ (จากไฟล์เซฟ) -----
const players = [];
let chest = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('rooms.'))) {
  let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, '')); } catch (e) { continue; }
  chest += (d.chest && d.chest.coin) || 0;
  for (const [k, r] of Object.entries(d.players || {})) players.push({ key: k, money: ((r.inv && r.inv.coin) || 0) + ((r.bank && r.bank.bal) || 0), seen: r.lastSeen || 0 });
}
const gini = a => { if (a.length < 2) return 0; a = a.slice().sort((x, y) => x - y); const s = a.reduce((x, y) => x + y, 0); if (!s) return 0; let c = 0; a.forEach((v, i) => { c += (2 * (i + 1) - a.length - 1) * v; }); return c / (a.length * s); };
const money = players.map(p => p.money), total = money.reduce((a, b) => a + b, 0), sorted = money.slice().sort((a, b) => b - a);
const act7 = players.filter(p => p.seen >= Date.now() - 7 * 864e5).map(p => p.money);
console.log(`=== เงินในระบบ (ตอนนี้) ===`);
console.log(`บัญชี ${players.length} | เงินรวม (กระเป๋า+ธนาคาร) ${num(total)} | ค่ากลาง ${med(money) ?? '-'} | Gini ${gini(money).toFixed(2)} | อันดับ 1 ถือ ${pct(sorted[0] || 0, total)} | 5 อันดับแรก ${pct(sorted.slice(0, 5).reduce((a, b) => a + b, 0), total)}`);
console.log(`เล่นภายใน 7 วัน ${act7.length} คน ค่ากลางเงิน ${med(act7) ?? '-'} | เงินกองกลาง ${num(chest)}`);

// ----- 2) เงินเข้า–ออกต่อวัน แยกเหตุผล (ไม่นับฝาก/ถอน ATM) -----
console.log(`\n=== เงินเข้า–ออกต่อวัน (${days} วันล่าสุด) ===`);
const flow = {};
for (const e of evs) if (e.e === 'coin' && e.why !== 'bank') { const o = flow[dayOf(e.t)] = flow[dayOf(e.t)] || {}; const w = o[e.why] = o[e.why] || { in: 0, out: 0 }; if (e.n > 0) w.in += e.n; else w.out -= e.n; }
for (const [day, o] of Object.entries(flow).sort()) {
  const t = Object.entries(o), inn = t.reduce((a, [, v]) => a + v.in, 0), out = t.reduce((a, [, v]) => a + v.out, 0);
  const top = (k) => t.filter(([, v]) => v[k]).sort((a, b) => b[1][k] - a[1][k]).slice(0, 5).map(([w, v]) => `${w} ${num(v[k])}`).join(', ');
  console.log(`${day}: เข้า ${num(inn)} ออก ${num(out)} สุทธิ ${inn - out >= 0 ? '+' : ''}${num(inn - out)} | เข้ามากสุด: ${top('in')} | ออกมากสุด: ${top('out')}`);
}

// ----- 3) ราคาขายจริงเทียบราคาฐาน ต่อหมวด -----
console.log(`\n=== ราคาขายจริง / ราคาฐาน ต่อหมวด (เฉพาะ event ที่มี base) ===`);
const cats = {};
for (const e of evs) if (e.e === 'sell' && e.base) { const c = cats[e.cat || '?'] = cats[e.cat || '?'] || { coin: 0, base: 0, q: 0, who: new Set() }; c.coin += e.coin; c.base += e.base; c.q += e.q; c.who.add(e.p); }
if (!Object.keys(cats).length) console.log('(ยังไม่มีข้อมูล)');
for (const [c, v] of Object.entries(cats).sort((a, b) => b[1].coin - a[1].coin)) console.log(`${c}: ${num(v.q)} ชิ้น ได้ ${num(v.coin)} จากฐาน ${num(v.base)} = ${pct(v.coin, v.base)} | ผู้ขาย ${v.who.size} คน`);

// ----- 4) การกระทำและพลังงาน -----
console.log(`\n=== การกระทำ / พลังงานที่ใช้ (event act) ===`);
const acts = {}, actWho = new Set();
for (const e of evs) if (e.e === 'act') { actWho.add(e.p); for (const [k, n] of Object.entries(e.n || {})) { const a = acts[k] = acts[k] || { n: 0, en: 0 }; a.n += n; a.en += (e.en && e.en[k]) || 0; } }
if (!Object.keys(acts).length) console.log('(ยังไม่มีข้อมูล)');
else {
  const enAll = Object.values(acts).reduce((a, b) => a + b.en, 0);
  console.log(`ผู้เล่นที่มีข้อมูล ${actWho.size} คน | พลังงานรวม ${num(enAll)}`);
  for (const [k, v] of Object.entries(acts).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k}: ${num(v.n)} ครั้ง${v.en ? ` | พลังงาน ${num(v.en)} (${pct(v.en, enAll)})` : ''}`);
}
const tired = evs.filter(e => e.e === 'tired');
console.log(`เหนื่อย (tired) ${tired.length} ครั้ง จาก ${new Set(tired.map(e => e.p)).size} คน`);

// ----- 5) ภาพรวมรายชั่วโมงล่าสุด (event snap) -----
const snaps = evs.filter(e => e.e === 'snap');
console.log(`\n=== ตลาดกลาง / กองกลาง / ฝูงสัตว์ (snap ล่าสุดจาก ${snaps.length} ครั้ง) ===`);
if (!snaps.length) console.log('(ยังไม่มีข้อมูล)');
else {
  const s = snaps[snaps.length - 1], mk = Object.entries(s.mk || {}).sort((a, b) => a[1] - b[1]);
  console.log(`เวลา ${new Date(s.t).toLocaleString('th-TH')} | ออนไลน์ ${s.online} | กองกลาง ${num(s.chest)} | สัตว์: ${Object.entries(s.an || {}).map(([k, n]) => `${k} ${n}`).join(' ') || 'ไม่มี'} | ตายรอชุบ: ${Object.entries(s.dead || {}).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' ') || '-'}`);
  console.log(`ราคาต่ำสุด: ${mk.slice(0, 5).map(([k, m]) => `${k} ${m}`).join(', ')}`);
  console.log(`ราคาสูงสุด: ${mk.slice(-5).reverse().map(([k, m]) => `${k} ${m}`).join(', ')}`);
  // ชนิดที่ถูกกดต่ำกว่า 0.6 บ่อย (มากกว่าครึ่งของ snap)
  const low = {}; for (const x of snaps) for (const [k, m] of Object.entries(x.mk || {})) if (m < 0.6) low[k] = (low[k] || 0) + 1;
  const often = Object.entries(low).filter(([, n]) => n > snaps.length / 2).map(([k]) => k);
  if (often.length) console.log(`ถูกกดต่ำกว่า 0.6 เกินครึ่งของเวลา: ${often.join(', ')}`);
}

// ----- 6) คู่มือเริ่มต้น: คนที่ผ่านแต่ละขั้น และเวลาในเซสชันนั้น -----
console.log(`\n=== คู่มือเริ่มต้น (${days} วันล่าสุด) ===`);
const firstJoin = new Set(evs.filter(e => e.e === 'join' && e.first).map(e => e.p));
const steps = {};
for (const e of evs) if (e.e === 'starter') { const s = steps[e.step] = steps[e.step] || { who: new Set(), ses: [], first: 0 }; s.who.add(e.p); if (e.ses != null) s.ses.push(e.ses); if (e.joins === 1) s.first++; }
console.log(`บัญชีใหม่ (join ครั้งแรก) ${firstJoin.size} คน`);
for (const [k, v] of Object.entries(steps).sort((a, b) => b[1].who.size - a[1].who.size))
  console.log(`  ${k}: ${v.who.size} คน${firstJoin.size ? ` (${pct(v.who.size, firstJoin.size)} ของบัญชีใหม่)` : ''}${v.ses.length ? ` | ค่ากลาง ${med(v.ses)} วินาทีในเซสชันนั้น | ผ่านในเซสชันแรก ${v.first}/${v.ses.length}` : ''}`);
