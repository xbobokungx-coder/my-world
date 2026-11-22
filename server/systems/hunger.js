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
  eatMulAt(p) { return p.scene && !S.caveFloor(p.scene) && this.houses[p.scene] ? this.houseComfortOf(p.scene).eatMul : 1; }, // กินในบ้านที่มีชุดครัวครบ = อิ่มเพิ่ม (นอกบ้าน ×1)
  drainMul(p) { return S.HOME.rest.mul < 1 && this.restLeft(p) > 0 && !this.buffOn(p, 'hunger') ? S.HOME.rest.mul : 1; }, // หลับสบายลดความหิวช้าลง ไม่ซ้อนกับ BUFFS.hunger (บัฟนั้นแรงกว่า ใช้ตัวนั้น)
  eat(p, item) {
    if (item === 'jherb') return this.combatUseHerb(p); // สมุนไพรป่า: ฟื้น HP ในป่า (ไม่ใช่อาหาร)
    if (p.cb && p.cb.st === 'faint') return; // สลบอยู่กินไม่ได้
    const info = typeof item === 'string' && S.itemInfo(item);
    if (!info || !info.food || !p.rec.inv[item]) return;
    if (p.rec.hunger >= 99 && !(p.cb && p.cb.hp < p.cb.mx - 0.5)) return this.toast(p, 'อิ่มแล้ว กินไม่ลง 😋'); // อิ่มเต็มแต่ HP ในป่าไม่เต็ม = กินเพื่อฟื้น HP ได้
    const food = info.food * this.eatMulAt(p), gain = Math.min(Math.round(food), 100 - Math.round(p.rec.hunger)); // food = อิ่มที่ได้ (ชุดครัวในบ้านคูณเพิ่ม ไม่เกิน 100)
    this.add(p, item, -1);
    this.setHunger(p, p.rec.hunger + food, true);
    if (p.cb) this.combatHeal(p, p.cb.mx * info.food * S.COMBAT.eatPct / 100); // ในป่า: อาหารฟื้น HP ด้วย (เต็ม × ความอิ่มอาหาร × eatPct %)
    if (S.ENERGY.on) { const e = this.enOf(p); e.v = Math.min(S.ENERGY.max, e.v + info.food * S.ENERGY.eatMul); if (e.ex && e.v >= S.ENERGY.resume) e.ex = false; this.enPush(p); }
    this.toast(p, `กิน ${info.emoji} ${info.name} (อิ่มขึ้น +${gain})`);
    this.sfx(p, 'eat'); if (item.startsWith('meal_')) this.bookAdd(p, 'meal', item.slice(5));
    this.event(p, 'eat');
  },
};
