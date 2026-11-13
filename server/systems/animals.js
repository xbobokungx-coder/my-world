'use strict';
// สัตว์ในฟาร์ม (ฝูง คอก ผึ้ง): ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { TS, ANIMALS } = S;
const { rand } = require('../util.js');

module.exports = {
  zone(type) { const z = S.PENS[type] || S.PENS.chicken; return { x0: (z.x0 + 0.4) * TS, x1: (z.x1 + 0.6) * TS, y0: (z.y0 + 0.5) * TS, y1: (z.y1 + 0.5) * TS }; },
  hiveBox(i) { const [hx, hy] = S.BEE.hives[i]; return { x0: (hx - 0.6) * TS, x1: (hx + 1.6) * TS, y0: (hy - 0.6) * TS, y1: (hy + 1.6) * TS }; }, // ผึ้งบินวนอยู่รอบรังของตัวเอง (ไม่ไกลเกิน 1 ช่อง)
  // ----- สัตว์ฟาร์มของใครของมัน: เก็บใน rec.herd • โผล่เล้าเฉพาะตอนเจ้าของออน • ออฟ = หายจากเล้า + แช่แข็ง -----
  herdOf(rec) { if (!Array.isArray(rec.herd)) rec.herd = []; return rec.herd; },
  packAnimal(a, now) {
    return { type: a.type, hunger: Math.round(a.hunger), zero: a.zero || 0, sick: !!a.sick, sickMs: a.sickMs || 0,
      fed: !!a.fed, prod: !!a.prod, feeder: a.feeder || '', fn: a.fn || '', pm: a.pm || 0,
      layLeft: a.fed && a.layAt ? Math.max(0, a.layAt - now) : 0, warned: !!a.warned };
  },
  syncHerd(p) { const now = Date.now(); const unk = this.herdOf(p.rec).filter(st => st && !ANIMALS[st.type]); // ชนิดที่โค้ดนี้ไม่รู้จัก (เช่น ถอยเวอร์ชัน) เก็บไว้ไม่ลบ
    p.rec.herd = this.animals.filter(a => a.owner === p.key && !a.dead).map(a => this.packAnimal(a, now)).concat(unk); this.dirty = true; },
  ownerCount(key, type) { return this.animals.filter(a => a.owner === key && a.type === type && !a.dead).length; },
  count(type) { return this.animals.filter(a => a.type === type && !a.dead).length; },
  spawnAnimal(type, p, st) {
    if (!p || !ANIMALS[type]) return null;
    const hive = type === 'bee' ? this.animals.filter(a => a.type === 'bee' && a.owner === p.key).length % S.BEE.hives.length : 0;
    const z = type === 'bee' ? this.hiveBox(hive) : this.zone(type), x = rand(z.x0, z.x1), y = rand(z.y0, z.y1), now = Date.now();
    const a = { id: this.nextAid++, type, hive, owner: p.key, on: p.name, x, y, tx: x, ty: y, wait: rand(0, 3),
      prod: !!(st && st.prod), fed: !!(st && st.fed), feeder: (st && st.feeder) || '', fn: (st && st.fn) || '', pm: (st && st.pm) || 0,
      layAt: (st && st.fed) ? now + Math.max(0, st.layLeft || 0) : 0, dx: 1,
      hunger: Number.isFinite(st && st.hunger) ? Math.max(0, Math.min(100, st.hunger)) : 90,
      zero: (st && st.zero) || 0, sick: !!(st && st.sick), sickMs: (st && st.sickMs) || 0, warned: !!(st && st.warned) };
    this.animals.push(a); this.dirty = true; return a;
  },
  ensureGiftChicken(p) { // มือใหม่ (และผู้เล่นเก่ายังไม่ได้รับ): ได้ไก่ตัวแรก 1 ตัว
    if (p.rec.herdGift) return;
    p.rec.herdGift = 1; const herd = this.herdOf(p.rec);
    if (!herd.some(a => a.type === 'chicken')) {
      herd.push({ type: 'chicken', hunger: 90, zero: 0, sick: false, sickMs: 0, fed: false, prod: false, feeder: '', fn: '', pm: 0, layLeft: 0 });
      setTimeout(() => { if (p.ws.readyState === 1) this.toast(p, '🐔 เมืองมอบไก่ตัวแรกให้คุณแล้ว! ซื้ออาหารไก่แล้วไปให้อาหารที่เล้า — ไข่เป็นของคุณ'); }, 4500);
    }
    this.dirty = true;
  },
  loadHerd(p) {
    this.ensureGiftChicken(p);
    const herd = this.herdOf(p.rec), kept = [], nBy = {};
    for (const st of herd) {
      if (!st) continue;
      if (!ANIMALS[st.type]) { kept.push(st); continue; } // ชนิดไม่รู้จัก: เก็บไว้ในเซฟ ไม่ spawn ไม่ลบ
      nBy[st.type] = (nBy[st.type] || 0) + 1;
      if (nBy[st.type] > ANIMALS[st.type].cap) continue;
      kept.push(st); this.spawnAnimal(st.type, p, st);
    }
    p.rec.herd = kept; this.dirty = true;
  },
  unloadHerd(p) { this.syncHerd(p); this.animals = this.animals.filter(a => a.owner !== p.key); },
  creditAnimalCare(key, xp) { // ปันผล XP การเลี้ยงให้คนที่ให้อาหารสัตว์ไว้ แม้คนอื่นจะมาเก็บผลผลิต (ออนไลน์/ออฟไลน์)
    const p = [...this.players.values()].find(q => q.key === key);
    if (p) { this.addXp(p, 'animal', xp); this.addPts(p, 1); this.toast(p, '🐄 มีคนเก็บผลผลิตจากสัตว์ที่คุณเลี้ยง — คุณได้ XP การเลี้ยง'); }
    else { const rec = this.saved[key]; if (rec && rec.skills) { rec.skills.animal = (rec.skills.animal || 0) + xp; this.dirty = true; } }
  },
};
