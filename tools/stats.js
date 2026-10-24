'use strict';
// สรุปตัวชี้วัดจากไฟล์เหตุการณ์ data/events/*.jsonl และไฟล์เซฟ data/<ห้อง>.json
// ใช้: node tools/stats.js [โฟลเดอร์ data]   (ค่าเริ่มต้น ./data)
const fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'data');
const evDir = path.join(dir, 'events');
const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const med = a => { if (!a.length) return null; a = a.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const evs = [];
if (fs.existsSync(evDir)) for (const f of fs.readdirSync(evDir).filter(f => f.endsWith('.jsonl')).sort())
  for (const ln of fs.readFileSync(path.join(evDir, f), 'utf8').split('\n')) { if (ln) try { evs.push(JSON.parse(ln)); } catch (e) { /* ข้ามบรรทัดเสีย */ } }
console.log(`เหตุการณ์ทั้งหมด ${evs.length} รายการ`);

// ผู้เล่นจากไฟล์เซฟ
const players = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('rooms.'))) {
  let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, '')); } catch (e) { continue; }
  for (const [k, r] of Object.entries(d.players || {})) players.push({ room: f.replace('.json', ''), key: k, rec: r });
}
console.log(`บัญชีทั้งหมด ${players.length}`);
{ const { realSet, MIN_MINUTES } = require('./realplayers.js'), real = realSet(players.map(p => ({ room: p.room, key: p.key, rec: p.rec })), evs); console.log(`ผู้เล่นจริง (ออนไลน์สะสม ≥ ${MIN_MINUTES} นาที) ${real.size}/${players.length} • ตัวเลขด้านล่างนับทุกบัญชี (ใช้ดูคนหลุดช่วงแรก) รายงานเศรษฐกิจดู tools/economy.js`); }
const xp = r => Object.values(r.skills || {}).reduce((a, b) => a + b, 0);
console.log(`ไม่มี XP เลย: ${players.filter(p => !xp(p.rec)).length}/${players.length} | ผ่านคู่มือครบ: ${players.filter(p => p.rec.starter && p.rec.starter.final).length} | ทำเควสอย่างน้อย 1 ข้อ: ${players.filter(p => p.rec.qtotal > 0).length}`);

// retention: วันที่ n หลังวันแรก (เฉพาะคนที่ครบ n วันแล้ว) ใช้วันที่ที่มี event join
const active = new Map(); // key -> Set(day)
for (const e of evs) if (e.e === 'join') { const k = e.room + '/' + e.p; if (!active.has(k)) active.set(k, new Set()); active.get(k).add(dayOf(e.t)); }
for (const n of [1, 7, 14]) {
  const cohort = players.filter(p => p.rec.firstSeen && Date.now() - p.rec.firstSeen >= n * 864e5);
  const back = cohort.filter(p => { const s = active.get(p.room + '/' + p.key); return s && s.has(dayOf(p.rec.firstSeen + n * 864e5)); });
  console.log(`Retention D${n}: ${cohort.length ? Math.round(back.length / cohort.length * 100) + '%' : '-'} (${back.length}/${cohort.length}) *นับจาก event ตั้งแต่เริ่มเก็บเท่านั้น`);
}

// เซสชัน
const secs = evs.filter(e => e.e === 'leave').map(e => e.sec);
console.log(`เซสชัน ${secs.length} ครั้ง ค่ากลาง ${med(secs)} วินาที | สั้นกว่า 60 วินาที ${secs.filter(s => s < 60).length}`);

// คู่มือเริ่มต้น
const st = {}; for (const e of evs) if (e.e === 'starter') { (st[e.step] = st[e.step] || []).push(e.sec); }
console.log('คู่มือเริ่มต้น (จำนวนคน / วินาทีค่ากลางนับจากสร้างบัญชี):');
for (const [k, v] of Object.entries(st)) console.log(`  ${k}: ${v.length} / ${med(v.filter(x => x != null))}`);

// เหรียญเข้า-ออกต่อวันแยกเหตุผล
const flow = {};
for (const e of evs) if (e.e === 'coin') { const o = flow[dayOf(e.t)] = flow[dayOf(e.t)] || {}; const w = o[e.why] = o[e.why] || { in: 0, out: 0 }; if (e.n > 0) w.in += e.n; else w.out -= e.n; }
for (const [day, o] of Object.entries(flow)) {
  const t = Object.entries(o).filter(([w]) => w !== 'bank'); const inn = t.reduce((a, [, v]) => a + v.in, 0), out = t.reduce((a, [, v]) => a + v.out, 0);
  console.log(`เหรียญ ${day}: เข้า ${inn} ออก ${out} (ไม่นับ ATM) | ` + t.map(([w, v]) => `${w}+${v.in}/-${v.out}`).join(' '));
}

// รายได้จากการขายต่อชนิด
const sells = {}; for (const e of evs) if (e.e === 'sell') { const o = sells[e.item] = sells[e.item] || { q: 0, c: 0 }; o.q += e.q; o.c += e.coin; }
const top = Object.entries(sells).sort((a, b) => b[1].c - a[1].c).slice(0, 10);
if (top.length) console.log('ขายสูงสุด: ' + top.map(([k, v]) => `${k} ${v.q}ชิ้น 🪙${v.c}`).join(' | '));
