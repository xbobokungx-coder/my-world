#!/usr/bin/env node
// ถอยโค้ดที่เก็บของในบ้าน (S1): ย้ายของในทุกคลัง rec.store กลับ rec.inv + rec.lots แล้วลบ rec.store
// ใช้: node tools/store-unstash.js <data/main.json> [--write]   (ไม่ใส่ --write = dry-run แค่พิมพ์สรุป ไม่แก้ไฟล์)
// ต้องปิดเซิร์ฟเวอร์และสำรอง data/ ก่อนใช้ --write เสมอ (ดู docs/OPS.md ส่วน "ย้อนโค้ดที่เก็บของในบ้าน")
// อายุกองของคลังเย็น: ในกระเป๋าได้เวลา now − S.storeAge(tv, คลัง, now) ตรงกับที่ storeHandle 'take' ทำ → ความสดไม่เสียเปรียบ/ไม่ได้เปรียบ
const fs = require('fs'), path = require('path');
const S = require('../public/shared.js');

const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const okKey = k => typeof k === 'string' && k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
const okN = n => Number.isInteger(n) && n > 0;

// ปรับ rec.lots[k] ให้ผลรวมเท่า inv (เหมือน lotsOf ฝั่งเซิร์ฟเวอร์: ขาด = ของใหม่ ณ now, เกิน = ตัดกองเก่าก่อน)
function lotsFit(rec, k, now) {
  if (!rec.lots || typeof rec.lots !== 'object') rec.lots = {};
  let L = Array.isArray(rec.lots[k]) ? rec.lots[k].filter(x => Array.isArray(x) && Number.isFinite(x[0]) && okN(x[1])).map(x => [x[0], x[1]]) : [];
  const have = rec.inv[k] || 0; let sum = L.reduce((a, x) => a + x[1], 0);
  if (sum < have) L.push([now, have - sum]);
  while (sum > have && L.length) { const d = Math.min(L[0][1], sum - have); L[0][1] -= d; sum -= d; if (!L[0][1]) L.shift(); }
  return L;
}

// ย้ายทั้งก้อนข้อมูล d (= เนื้อ main.json) คืน { accounts, items, skipped } • แก้ d ในหน่วยความจำ (เรียกซ้ำปลอดภัย: ไม่มี store = ไม่ทำอะไร)
function unstash(d, now) {
  const out = { accounts: 0, items: 0, skipped: 0, kinds: {} };
  if (!d || typeof d !== 'object' || !d.players || typeof d.players !== 'object') return out;
  for (const rec of Object.values(d.players)) {
    if (!rec || typeof rec !== 'object' || !has(rec, 'store')) continue;
    const st = rec.store; delete rec.store; out.accounts++;
    if (!st || typeof st !== 'object') continue; // store เพี้ยน: ลบทิ้ง ไม่มีของให้ย้าย
    if (!rec.inv || typeof rec.inv !== 'object') rec.inv = {};
    for (const pool of Object.keys(st)) {
      const o = st[pool]; if (!o || typeof o !== 'object' || !o.inv || typeof o.inv !== 'object') continue;
      const cold = pool === 'cold';
      const pl = { r: Number.isFinite(o.r) && o.r > 0 ? o.r : 1, at: Number.isFinite(o.at) ? o.at : now };
      for (const k of Object.keys(o.inv)) {
        const n = o.inv[k];
        if (!okKey(k) || !okN(n) || k === 'coin') { out.skipped++; continue; }
        const perish = S.perishable(k);
        // ปรับ lots เดิมของกระเป๋าให้ตรง inv ก่อนบวก (ไม่งั้นส่วนต่างจะถูกนับเป็นของใหม่ผิดกอง)
        const base = perish ? lotsFit(rec, k, now) : null;
        let add = [];
        if (perish) {
          let L = cold && Array.isArray(o.lots && o.lots[k]) ? o.lots[k].filter(x => Array.isArray(x) && Number.isFinite(x[0]) && okN(x[1])) : [];
          let sum = L.reduce((a, x) => a + x[1], 0);
          add = L.map(x => [now - S.storeAge(x[0], pl, now), x[1]]);
          if (sum < n) add.push([now, n - sum]); // กองไม่ครบ = ส่วนขาดนับเป็นของใหม่
          else if (sum > n) { let over = sum - n; add.sort((a, b) => a[0] - b[0]); while (over > 0 && add.length) { const x = Math.min(add[0][1], over); add[0][1] -= x; over -= x; if (!add[0][1]) add.shift(); } }
        }
        rec.inv[k] = (rec.inv[k] || 0) + n;
        if (perish) {
          const L = base.concat(add).sort((a, b) => a[0] - b[0]);
          for (let j = L.length - 1; j > 0; j--) if (L[j][0] - L[j - 1][0] < 60000) { L[j - 1][1] += L[j][1]; L.splice(j, 1); } // รวมกองอายุใกล้กัน (เหมือน lotPut)
          rec.lots[k] = L;
        }
        out.items += n; out.kinds[k] = (out.kinds[k] || 0) + n;
      }
    }
  }
  return out;
}

module.exports = { unstash };

if (require.main === module) {
  const args = process.argv.slice(2), write = args.includes('--write'), file = args.find(a => !a.startsWith('--'));
  if (!file) { console.log('ใช้: node tools/store-unstash.js <data/main.json> [--write]\n(ไม่ใส่ --write = ดูสรุปเฉยๆ ไม่แก้ไฟล์)'); process.exit(1); }
  let d; try { d = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (e) { console.log(`[store-unstash] อ่าน ${file} ไม่ได้: ${e.message}`); process.exit(1); }
  if (write) console.log('[store-unstash] คำเตือน: ต้องปิดเซิร์ฟเวอร์และสำรอง data/ ก่อน ไม่งั้นเซิร์ฟเวอร์จะเขียนทับผลนี้');
  const r = unstash(d, Date.now());
  console.log(`[store-unstash] ${write ? 'เขียนแล้ว' : 'dry-run (ยังไม่แก้ไฟล์)'}: ${r.accounts} บัญชีมีคลัง • ย้ายของ ${r.items} ชิ้น (${Object.keys(r.kinds).length} ชนิด)` + (r.skipped ? ` • ข้ามรายการเสีย ${r.skipped}` : ''));
  if (!write) { if (r.accounts) console.log('ใส่ --write เพื่อเขียนจริง (หลังปิดเซิร์ฟเวอร์ + สำรองแล้ว)'); process.exit(0); }
  if (!r.accounts) { console.log('ไม่มีคลังให้ย้าย ไม่แก้ไฟล์'); process.exit(0); }
  const tmp = file + '.unstash.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, file);
}
