'use strict';
// ความหิวและการกิน: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { send } = require('../util.js');

module.exports = {
  setHunger(p, v, quiet) {
    const old = p.rec.hunger; p.rec.hunger = Math.max(0, Math.min(100, v));
    send(p, { t: 'hun', v: Math.round(p.rec.hunger) });
    if (!quiet) {
      if (old > 20 && p.rec.hunger <= 20 && p.rec.hunger > 5) this.toast(p, '🍗 เริ่มหิวแล้ว! ไปกินอะไรหน่อย (ร้านอาหาร หรือกินผลผลิตที่มี)');
      else if (old > 5 && p.rec.hunger <= 5 && p.rec.hunger > 0) this.toast(p, '⚠️ หิวมาก! เดินช้าลงแล้ว รีบหาอาหารกิน');
      else if (old > 0 && p.rec.hunger <= 0) this.toast(p, '😵 หิวจนไม่มีแรงทำงาน! ต้องกินอาหารก่อนถึงจะใช้เครื่องมือได้');
    }
    this.dirty = true;
  },
  eat(p, item) {
    const info = typeof item === 'string' && S.itemInfo(item);
    if (!info || !info.food || !p.rec.inv[item]) return;
    if (p.rec.hunger >= 99) return this.toast(p, 'อิ่มแล้ว กินไม่ลง 😋');
    const gain = Math.min(info.food, 100 - Math.round(p.rec.hunger));
    this.add(p, item, -1);
    this.setHunger(p, p.rec.hunger + info.food, true);
    if (S.ENERGY.on) { const e = this.enOf(p); e.v = Math.min(S.ENERGY.max, e.v + info.food * S.ENERGY.eatMul); if (e.ex && e.v >= S.ENERGY.resume) e.ex = false; this.enPush(p); }
    this.toast(p, `กิน ${info.emoji} ${info.name} (อิ่มขึ้น +${gain})`);
    this.sfx(p, 'eat'); if (item.startsWith('meal_')) this.bookAdd(p, 'meal', item.slice(5));
    this.event(p, 'eat');
  },
};
