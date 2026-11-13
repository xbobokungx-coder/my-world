'use strict';
// เชฟทำอาหาร + คราฟต์: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');

module.exports = {
  cook(p, id) { // เชฟ (อาชีพที่ 5): ใช้วัตถุดิบข้ามสาย (ชนิดที่ถูกที่สุดก่อน) ทำอาหารขายได้แพงกว่าของดิบ ปลดสูตรตามเลเวลเชฟ ได้ XP เชฟ เตาต้องพักระหว่างจาน
    const r = typeof id === 'string' ? S.COOK.find(x => x.id === id) : null; if (!r) return;
    if (this.nearShopKind(p) !== 'food') return this.toast(p, 'ต้องยืนใกล้ประตูร้านอาหารถึงจะทำอาหารได้');
    if (this.lv(p, 'cook') < r.lv) return this.toast(p, `สูตรนี้ปลดล็อกที่เชฟเลเวล ${r.lv} (ตอนนี้ ${this.lv(p, 'cook')}) — ทำเมนูง่ายขึ้นก่อนเพื่อเก็บเลเวล`);
    const now = Date.now();
    if (now < (p.cookReady || 0)) return this.toast(p, `เตายังร้อนอยู่ รออีก ${Math.ceil((p.cookReady - now) / 1000)} วินาที`);
    const inv = p.rec.inv, use = {};
    for (const need of r.in) {
      if (need.k) { if ((inv[need.k] || 0) < need.n) return this.toast(p, 'วัตถุดิบไม่พอ'); use[need.k] = (use[need.k] || 0) + need.n; continue; }
      if (need.u) { // ต้องเป็นปลาคนละชนิดกัน ชนิดละ 1 ตัว เริ่มจากชนิดที่ถูกที่สุด
        const kinds = Object.keys(inv).filter(k => inv[k] - (use[k] || 0) > 0 && S.cookCat(need.c, k)).sort((x, y) => S.itemInfo(x).sell - S.itemInfo(y).sell);
        if (kinds.length < need.n) return this.toast(p, `วัตถุดิบไม่พอ ต้องใช้ปลาคนละชนิดอย่างน้อย ${need.n} ชนิด`);
        for (const k of kinds.slice(0, need.n)) use[k] = (use[k] || 0) + 1;
        continue;
      }
      const own = Object.keys(inv).filter(k => inv[k] > 0 && S.cookCat(need.c, k)).sort((x, y) => S.itemInfo(x).sell - S.itemInfo(y).sell);
      let left = need.n;
      for (const k of own) { const take = Math.min(left, inv[k] - (use[k] || 0)); if (take > 0) { use[k] = (use[k] || 0) + take; left -= take; } if (!left) break; }
      if (left) return this.toast(p, 'วัตถุดิบไม่พอ');
    }
    const panOk = this.durCur(p, 'pan') > 0, pTier = S.panTier(inv), feeR = S.panFee(r, pTier, panOk), fee = Math.round(r.sell * feeR); // ค่าเช่าเตา: หายจากระบบทั้งหมด (TOWN.feeShare) กันครัวเป็นช่องสร้างเงินล้วนๆ
    if ((inv.coin || 0) < fee) return this.toast(p, `ค่าเช่าเตา 🪙 ${fee} เหรียญไม่พอ`);
    for (const [k, n] of Object.entries(use)) this.add(p, k, -n);
    this.add(p, 'coin', -fee, 'cookfee'); this.toPot(fee); this.add(p, r.id, 1);
    this.addXp(p, 'cook', r.xp); p.cookReady = now + r.time;
    const pw = panOk ? S.panHit(r, pTier) : null; if (pw && pw.wear > 0 && pw.bonus > 0) this.durUse(p, 'pan', pw.wear); // กระทะสึกเมื่อทำสำเร็จ (ได้ลดค่าเตาจริงเท่านั้น)
    this.toast(p, `👨‍🍳 ทำ ${r.emoji} ${r.name} สำเร็จ! (+${r.xp} XP เชฟ • ค่าเตา -🪙${fee}${feeR < S.COOK_FEE ? ` (กระทะช่วยลด ${Math.round((1 - feeR / S.COOK_FEE) * 100)}%)` : ''} • ขายได้ราว 🪙${r.sell})`); this.sfx(p, 'collect');
    this.event(p, 'cook');
  },
  craft(p, id) { // ประดิษฐ์ที่ร้านช่างไม้: ใช้ไม้ที่หามาได้ ได้ของ + XP ช่างไม้
    const r = typeof id === 'string' ? S.CRAFT.find(x => x.id === id) : null; if (!r) return;
    if (this.nearShopKind(p) !== 'wood') return this.toast(p, 'ต้องยืนใกล้ประตูร้านช่างไม้ถึงจะประดิษฐ์ได้');
    if (this.lv(p, 'wood') < r.lv) return this.toast(p, `ต้องเป็นช่างไม้เลเวล ${r.lv} ก่อน`);
    for (const [k, n] of Object.entries(r.in)) if ((p.rec.inv[k] || 0) < n) return this.toast(p, 'วัตถุดิบไม่พอ');
    const fee = S.craftFee(r.id); if ((p.rec.inv.coin || 0) < fee) return this.toast(p, `ค่าใช้โรงช่างไม้ 🪙 ${fee} เหรียญไม่พอ`);
    for (const [k, n] of Object.entries(r.in)) this.add(p, k, -n);
    if (fee) { this.add(p, 'coin', -fee, 'craftfee'); this.toPot(fee); }
    const gain = S.woodXp(r.xp, this.lv(p, 'wood')); this.add(p, r.id, 1); this.addXp(p, 'wood', gain);
    const info = S.itemInfo(r.id); this.toast(p, `🔨 ประดิษฐ์ ${info.emoji} ${info.name} สำเร็จ! (+${gain} XP${fee ? ` • ค่าโรงช่าง -🪙${fee}` : ''})`); this.sfx(p, 'collect');
    if (info.furn) this.bookAdd(p, 'furn', info.furn);
    this.event(p, 'craft');
  },
};
