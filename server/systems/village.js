'use strict';
// หมู่บ้าน สัปดาห์เมือง และรางวัลรายสัปดาห์: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { send } = require('../util.js');

module.exports = {
  loadVillage(d) {
    const v = d || {};
    this.village = { day: typeof v.day === 'string' ? v.day : '', n: Number.isFinite(v.n) ? Math.max(0, Math.floor(v.n)) : 0, peak: Number.isFinite(v.peak) ? Math.max(1, Math.floor(v.peak)) : 1, done: !!v.done, until: Number.isFinite(v.until) ? v.until : 0, doneAt: Number.isFinite(v.doneAt) ? v.doneAt : 0, open: Number.isFinite(v.open) ? v.open : 0, by: Object.create(null), prev: Object.create(null) };
    for (const [k, x] of Object.entries(v.by || {})) if (Number.isFinite(x)) this.village.by[k] = x;
    for (const [k, x] of Object.entries(v.prev || {})) if (Number.isFinite(x)) this.village.prev[k] = x;
  },
  villageRoll() { const day = this.today(); if (this.village.day !== day) this.village = { day, n: 0, peak: Math.max(1, this.players.size), done: false, until: this.village.until, doneAt: this.village.doneAt, open: this.village.open, by: Object.create(null), prev: this.village.by }; }, // prev = คนที่ช่วยเมื่อวาน (บัฟที่ข้ามเที่ยงคืนยังเต็ม)
  villageGoal() { return S.VILLAGE.base + S.VILLAGE.per * Math.max(1, this.village.peak); },
  happyEnd(p) { // บัฟเต็มเวลาเฉพาะคนที่ช่วยงานเมือง ≥ fullMin ครั้ง คนที่ไม่ได้ช่วยได้แค่ shortMs แรก
    const v = this.village, name = p ? p.name : '';
    if (!p || (v.open || 0) > Date.now() || Math.max(v.by[name] || 0, (v.prev || {})[name] || 0) >= S.VILLAGE.fullMin) return v.until;
    return Math.min(v.until, (v.doneAt || 0) + S.VILLAGE.shortMs);
  },
  happyOn(p) { return this.happyEnd(p) > Date.now(); },
  villageSend() { for (const q of this.players.values()) send(q, this.villagePub(q)); },
  villagePub(p) { this.villageRoll(); this.wkRoll(); return { wn: this.week.n, wgoal: this.wkGoal(), wdone: this.week.done, t: 'village', n: this.village.n, goal: this.villageGoal(), done: this.village.done, left: Math.max(0, this.happyEnd(p) - Date.now()), mine: p ? this.village.by[p.name] || 0 : 0, full: S.VILLAGE.fullMin }; },
  villageBump(p) { if (p) this.wkBump(p); // ทุกครั้งที่ใครช่วยงานของเมือง (นับรวมทุกคน) ครบเป้าของวัน = ทั้งเมืองติดบัฟ
    this.villageRoll(); const v = this.village; this.dirty = true;
    // มีคนเล่นวันนี้ ≥ 2 คน = คนเดียวนับได้ไม่เกิน maxShare ของเป้า ต้องมีผู้ช่วยจึงครบ (ถ้าวันนี้เล่นคนเดียวตลอด ไม่จำกัด)
    const cap = v.peak >= 2 ? Math.ceil(this.villageGoal() * S.VILLAGE.maxShare) : Infinity, who = p ? p.name : '';
    if (!p || (v.by[who] || 0) < cap) { v.n++; if (p) v.by[who] = (v.by[who] || 0) + 1; }
    if (!v.done && v.n >= this.villageGoal()) {
      v.done = true; v.until = Date.now() + S.VILLAGE.ms; v.doneAt = Date.now();
      const mins = Math.round(S.VILLAGE.ms / 60000);
      this.broadcast({ t: 'msg', text: `🎉 Happy Village! ทุกคนช่วยกันครบเป้าแล้ว ตกปลาไวขึ้นและหาไม้เนื้อแข็งง่ายขึ้นเป็นเวลา ${mins} นาที` });
      this.addLog(`🎉 Happy Village! เมืองช่วยกันทำงานครบ ${v.n} ครั้ง ติดบัฟร่วม ${mins} นาที`);
    }
    this.villageSend();
  },
  loadWeek(d) {
    const w = d || {};
    this.week = { key: typeof w.key === 'string' ? w.key : '', n: Number.isFinite(w.n) ? Math.max(0, Math.floor(w.n)) : 0, done: !!w.done, by: Object.create(null), claimed: Object.create(null), cnt: Object.create(null) };
    for (const [k, v] of Object.entries(w.by || {})) if (Number.isFinite(v)) this.week.by[k] = v;
    for (const [k, v] of Object.entries(w.cnt || {})) if (Number.isFinite(v)) this.week.cnt[k] = v;
    for (const k of Object.keys(w.claimed || {})) this.week.claimed[k] = 1;
  },
  wkRoll() { const k = this.weekKey(); if (this.week.key !== k) { this.week = { key: k, n: 0, done: false, by: Object.create(null), claimed: Object.create(null), cnt: Object.create(null) }; } },
  wkGoal() { return S.WEEKLY.base + S.WEEKLY.per * Math.max(1, Object.keys(this.week.by).length); },
  wkBump(p) {
    this.wkRoll(); const w = this.week; w.by[p.name] = (w.by[p.name] || 0) + 1; this.dirty = true; // by = ครั้งที่ช่วยทั้งหมด (ใช้เช็ก minShare) cnt = ครั้งที่นับเข้าเป้า
    const cap = Object.keys(w.by).length >= 2 ? Math.ceil(this.wkGoal() * S.WEEKLY.maxShare) : Infinity;
    if ((w.cnt[p.name] || 0) < cap) { w.n++; w.cnt[p.name] = (w.cnt[p.name] || 0) + 1; }
    if (!w.done && w.n >= this.wkGoal()) {
      w.done = true;
      this.broadcast({ t: 'msg', text: '🏆 เป้าหมายรายสัปดาห์ของเมืองสำเร็จแล้ว! ใครมีส่วนร่วมไปรับรางวัลที่ 📰 ได้เลย' });
      this.addLog(`🏆 เมืองทำเป้าหมายรายสัปดาห์สำเร็จ (${w.n} ครั้ง)`);
    }
  },
  weeklyClaim(p) {
    this.wkRoll(); const w = this.week;
    if (!w.done) return this.toast(p, 'เป้าหมายรายสัปดาห์ยังไม่สำเร็จ ช่วยกันต่อนะ');
    if (w.claimed[p.key]) return this.toast(p, 'คุณรับรางวัลสัปดาห์นี้ไปแล้ว');
    if ((w.by[p.name] || 0) < S.WEEKLY.minShare) return this.toast(p, `ต้องช่วยงานอย่างน้อย ${S.WEEKLY.minShare} ครั้งในสัปดาห์นี้ถึงรับรางวัลได้ (คุณทำไป ${w.by[p.name] || 0})`);
    w.claimed[p.key] = 1; const rare = this.rareOfWeek(), r = S.FURN[rare];
    this.add(p, 'coin', S.WEEKLY.coin, 'weekly'); this.add(p, 'furn_' + rare, 1); this.dirty = true;
    this.addLog(`🎁 ${p.name} รับรางวัลเป้าหมายรายสัปดาห์ ${r.emoji} ${r.name}`);
    this.toast(p, `🎁 รางวัลสัปดาห์: 🪙${S.WEEKLY.coin} + ${r.emoji} ${r.name}`); this.sfxTo(p, 'levelup'); this.questPush(p);
  },
  rareOfWeek() { return S.RARE[Math.floor(Date.now() / (7 * 864e5)) % S.RARE.length]; },
};
