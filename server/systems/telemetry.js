'use strict';
// สถิติการกระทำ/ความมั่งคั่งผู้เล่น (telemetry): ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { logEv } = require('../util.js');
const SNAP_MS = +process.env.SNAP_MS || 60 * 60 * 1000; // ระยะห่างของ event snap (ไว้ทดสอบ)

module.exports = {
  // ----- telemetry: นับจำนวนการกระทำ + พลังงานที่ใช้ต่อคน รวมไว้ในหน่วยความจำ แล้วเขียนเป็น event 'act' ตอนออกจากเกม/ทุกชั่วโมง (ไม่เขียนทุกคลิก) -----
  telAdd(p, kind, en) { const t = p.tel || (p.tel = { n: {}, en: {} }); t.n[kind] = (t.n[kind] || 0) + 1; if (en) t.en[kind] = (t.en[kind] || 0) + en; },
  telFlush(p, sync) { const t = p.tel; if (!t || !Object.keys(t.n).length) return; p.tel = null; logEv(this.room, 'act', { p: p.key, n: t.n, en: t.en }, sync); },
  telTick(now) { // ทุกชั่วโมง: ภาพรวมตลาดกลาง/ฝูงสัตว์ + เทการกระทำของคนที่ออนไลน์ค้างอยู่
    if (!this.snapAt) this.snapAt = now + Math.min(5 * 60 * 1000, SNAP_MS);
    if (now < this.snapAt) return;
    this.snapAt = now + SNAP_MS;
    const mk = {}; for (const k of Object.keys(this.market)) mk[k] = Math.round(this.market[k].m * 100) / 100;
    const an = {}; for (const a of this.animals) if (!a.dead) an[a.type] = (an[a.type] || 0) + 1;
    logEv(this.room, 'snap', { mk, pot: this.lotto.pot, an, online: this.players.size });
    for (const p of this.players.values()) { this.telFlush(p); this.wealthLog(p); }
  },
  wealthLog(p) { // ความมั่งคั่งของผู้เล่น วันละครั้งต่อคน (ตอนออกจากเกม/รอบ snap): เหรียญ ATM มูลค่าของในกระเป๋า (ราคาฐาน) มูลค่าเฟอร์นิเจอร์ที่วาง
    const day = this.today(); if (p.rec.wDay === day) return; p.rec.wDay = day;
    let goods = 0; for (const [k, n] of Object.entries(p.rec.inv)) { if (k === 'coin') continue; const i = S.itemInfo(k); if (i && i.sell) goods += i.sell * n; }
    const h = this.houses[p.key];
    logEv(this.room, 'wealth', { p: p.key, coin: p.rec.inv.coin || 0, bank: this.bankOf(p).bal, goods, house: h ? S.houseScore(h.items).value : 0, lv: S.playLevel(p.rec.skills) });
  },
};
