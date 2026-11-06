'use strict';
// พลังงานและความล้า ⚡: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { logEv, send } = require('../util.js');

module.exports = {
  // ----- พลังงาน ⚡ (Phase 2) -----
  enOf(p) { const e = p.rec.en = p.rec.en && typeof p.rec.en === 'object' ? p.rec.en : {}; if (!Number.isFinite(e.v)) e.v = S.ENERGY.max; e.v = Math.max(-S.ENERGY.max, Math.min(S.ENERGY.max, e.v)); if (!Number.isFinite(e.at)) e.at = Date.now(); e.ex = !!e.ex; return e; },
  enJoin(p) { const e = this.enOf(p), now = Date.now(); e.v = Math.min(S.ENERGY.max, e.v + Math.max(0, now - e.at) / S.ENERGY.regenMs); e.at = now; if (e.ex && e.v >= S.ENERGY.resume) e.ex = false; }, // ฟื้นระหว่างออฟไลน์ด้วย
  enPub(p, spent) { const e = this.enOf(p); return { t: 'en', spent: spent || 0, v: Math.round(e.v * 10) / 10, ex: e.ex, rate: (p.sit ? S.ENERGY.sitMul : 1) / S.ENERGY.regenMs, resume: S.ENERGY.resume, rareUntil: p.rec.rareAt || 0, wk: this.wkPub(p), wkScale: S.ENERGY.var && S.ENERGY.var.scale, wkMax: S.ENERGY.var && S.ENERGY.var.max, wkHalf: S.ENERGY.var && S.ENERGY.var.halfLifeMs }; },
  enPush(p, spent) { send(p, this.enPub(p, spent)); },
  wkDecay(p, ms) { // ความล้างานซ้ำของทุกกลุ่มลดครึ่งหนึ่งทุก halfLifeMs (ms = เวลาที่นับ) ล้างกลุ่มที่เหลือน้อยทิ้ง
    const V = S.ENERGY.var, w = p.rec.wk = p.rec.wk && typeof p.rec.wk === 'object' ? p.rec.wk : {}, f = Math.pow(0.5, Math.max(0, ms) / V.halfLifeMs);
    for (const k of Object.keys(w)) { w[k] = Number.isFinite(w[k]) ? w[k] * f : 0; if (w[k] < 0.5) delete w[k]; }
    return w;
  },
  wkMult(p, kind, base) { // ตัวคูณต้นทุนพลังงานจากความล้างานกลุ่มเดิมซ้ำๆ (ดู ENERGY.var ใน shared.js) แล้วบวกความล้าของงานนี้เพิ่ม
    const V = S.ENERGY.var, g = V && V.group[kind]; if (!g) return 1;
    const now = Date.now(), w = this.wkDecay(p, now - (p.rec.wkAt || now));
    p.rec.wkAt = now; const m = 1 + Math.min(V.max, (w[g] || 0) / V.scale); w[g] = (w[g] || 0) + base; return m;
  },
  wkPub(p) { // ความล้าต่อกลุ่ม (ค่าดิบ) ให้ client คำนวณ % และลดเองตามเวลา
    const V = S.ENERGY.var, w = p.rec.wk; if (!V || !w) return null; const o = {};
    for (const k of Object.keys(w)) o[k] = Math.round(w[k] * 10) / 10; return Object.keys(o).length ? o : null;
  },
  tire(p, kind, value) { // งานหนักที่สำเร็จแล้ว หักพลังงานตามมูลค่างาน (S.energyCost) เกินที่มี = ติดลบ ต้องพักจนถึง resume
    if (!S.ENERGY.on) return this.telAdd(p, kind, 0); // ระบบพลังงานปิดอยู่: ไม่หักพลังงาน แต่ยังนับการกระทำ
    const e = this.enOf(p), cost = Math.round(S.energyCost(kind, value) * this.wkMult(p, kind, S.energyCost(kind, value)) * 10) / 10; e.v = Math.max(-S.ENERGY.max, e.v - cost); e.at = Date.now();
    if (e.v <= 0 && !e.ex) {
      e.ex = true; const sec = Math.ceil((S.ENERGY.resume - e.v) * S.ENERGY.regenMs / (p.sit ? S.ENERGY.sitMul : 1) / 1000);
      this.toast(p, `😮‍💨 เหนื่อยแล้ว! ต้องพักราว ${sec >= 60 ? Math.ceil(sec / 60) + ' นาที' : sec + ' วินาที'} (นั่งที่ม้านั่งฟื้นไวขึ้น 3 เท่า) ระหว่างนี้ทำอาหาร เควส หรือลงขันเมืองได้`); logEv(this.room, 'tired', { p: p.key });
    }
    this.dirty = true; this.enPush(p, cost); this.telAdd(p, kind, cost);
  },
  exhausted(p) { return S.ENERGY.on && this.enOf(p).ex; },
  heavyAction(tool, k) { return ['hoe', 'water', 'axe', 'rod'].includes(tool) || (typeof tool === 'string' && tool.startsWith('seed_')) || (tool === 'hand' && !!(this.farm[k] && this.farm[k].c)); }, // เครื่องมือ/การกระทำที่ถูกหยุดเมื่อเหนื่อย (นั่ง/เก็บไข่/ร้านค้า/ให้อาหารสัตว์ไม่ถูกหยุด)
  energyTick(dt) { // ฟื้นพลังงานทุกคนที่ออนไลน์ + ส่งค่าให้ client ทุก ~1 วินาทีเฉพาะคนที่ยังไม่เต็ม
    if (!S.ENERGY.on) return;
    this.enAcc = (this.enAcc || 0) + dt; const push = this.enAcc >= 1; if (push) this.enAcc = 0;
    for (const p of this.players.values()) {
      if (p.sit && S.ENERGY.var && p.rec.wk) this.wkDecay(p, dt * 1000 * (S.ENERGY.sitMul - 1)); // นั่งพัก: ความล้างานซ้ำหายเร็วขึ้น sitMul เท่า (รวมกับการลดตามเวลาปกติ)
      const e = this.enOf(p); if (e.v >= S.ENERGY.max && !e.ex) continue;
      e.v = Math.min(S.ENERGY.max, e.v + dt * 1000 / S.ENERGY.regenMs * (p.sit ? S.ENERGY.sitMul : 1)); e.at = Date.now(); this.dirty = true;
      if (e.ex && e.v >= S.ENERGY.resume) { e.ex = false; this.toast(p, '⚡ พักพอแล้ว กลับไปทำงานได้'); this.enPush(p); } else if (push) this.enPush(p);
    }
  },
};
