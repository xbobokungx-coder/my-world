'use strict';
// เชฟทำอาหาร + คราฟต์: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { send } = require('../util.js');

module.exports = {
  cook(p, id) { // เชฟ (อาชีพที่ 5): ใช้วัตถุดิบข้ามสาย (ชนิดที่ถูกที่สุดก่อน) ทำอาหารขายได้แพงกว่าของดิบ ปลดสูตรตามเลเวลเชฟ ได้ XP เชฟ เตาต้องพักระหว่างจาน
    const r = typeof id === 'string' ? S.COOK.find(x => x.id === id) : null; if (!r) return;
    if (this.nearShopKind(p) !== 'food') return this.toast(p, 'ต้องยืนใกล้ประตูร้านอาหารถึงจะทำอาหารได้');
    if (this.lv(p, 'cook') < r.lv) return this.toast(p, `สูตรนี้ปลดล็อกที่เชฟเลเวล ${r.lv} (ตอนนี้ ${this.lv(p, 'cook')}) — ทำเมนูง่ายขึ้นก่อนเพื่อเก็บเลเวล`);
    const now = Date.now();
    if (now < (p.cookReady || 0)) return send(p, { t: 'cookcd', ms: p.cookReady - now }), this.toast(p, `เตายังร้อนอยู่ รออีก ${Math.ceil((p.cookReady - now) / 1000)} วินาที`);
    const inv = p.rec.inv, cu = S.cookUse(inv, r), use = cu.use; // วัตถุดิบ: ใช้ของหลักก่อน ขาดค่อยใช้ของทางเลือก (S.COOK_ALT) ตัดสินที่ shared ให้เว็บแสดงตรงกัน
    if (!cu.ok) { const u = cu.rows.find(x => !x.ok && x.need.u); return this.toast(p, u ? `วัตถุดิบไม่พอ ต้องใช้ปลาคนละชนิดอย่างน้อย ${u.need.n} ชนิด` : 'วัตถุดิบไม่พอ'); }
    const panOk = this.durCur(p, 'pan') > 0, pTier = S.panTier(inv), feeR = S.panFee(r, pTier, panOk), fee = Math.round(r.sell * feeR); // ค่าเช่าเตา: หายจากระบบทั้งหมด (TOWN.feeShare) กันครัวเป็นช่องสร้างเงินล้วนๆ
    if ((inv.coin || 0) < fee) return this.toast(p, `ค่าเช่าเตา 🪙 ${fee} เหรียญไม่พอ`);
    for (const [k, n] of Object.entries(use)) this.add(p, k, -n);
    this.add(p, 'coin', -fee, 'cookfee'); this.toPot(fee); this.add(p, r.id, 1);
    this.addXp(p, 'cook', r.xp); p.cookReady = now + r.time; send(p, { t: 'cookcd', ms: r.time }); // บอกเว็บว่าเตาพักอีกกี่ ms (นับจากตอนได้รับ)
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
