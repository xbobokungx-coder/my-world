'use strict';
// เชฟทำอาหาร + คราฟต์: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { send } = require('../util.js');

module.exports = {
  cook(p, id, n) { // เชฟ (อาชีพที่ 5): ใช้วัตถุดิบข้ามสาย (ชนิดที่ถูกที่สุดก่อน) ทำอาหารขายได้แพงกว่าของดิบ ปลดสูตรตามเลเวลเชฟ ได้ XP เชฟ เตาต้องพักระหว่างจาน
    // ทำทีละหลายจาน (22 พ.ย. 2026): n = 1..S.COOK_BATCH_MAX ทำรวดเดียว (หักวัตถุดิบ/ค่าเตา/กระทะสึก/XP ต่อจานเท่าเดิมทุกอย่าง) แล้วเตาพักรวม = เวลาทำ × จำนวนจานที่ได้จริง (อัตราต่อเวลาเท่าทำทีละจาน ไม่โกงเวลา) • วัตถุดิบ/เหรียญ/กระทะไม่พอกลางทาง = ทำเท่าที่ได้
    const r = typeof id === 'string' ? S.COOK.find(x => x.id === id) : null; if (!r) return;
    const want = Number.isInteger(n) ? Math.max(1, Math.min(S.COOK_BATCH_MAX, n)) : 1;
    if (this.nearShopKind(p) !== 'food') return this.toast(p, 'ต้องยืนใกล้ประตูร้านอาหารถึงจะทำอาหารได้');
    if (this.lv(p, 'cook') < r.lv) return this.toast(p, `สูตรนี้ปลดล็อกที่เชฟเลเวล ${r.lv} (ตอนนี้ ${this.lv(p, 'cook')}) — ทำเมนูง่ายขึ้นก่อนเพื่อเก็บเลเวล`);
    const now = Date.now();
    if (now < (p.cookReady || 0)) return send(p, { t: 'cookcd', ms: p.cookReady - now }), this.toast(p, `เตายังร้อนอยู่ รออีก ${Math.ceil((p.cookReady - now) / 1000)} วินาที`);
    const inv = p.rec.inv; let made = 0, feeSum = 0, xpSum = 0, sellSum = 0, hi = 0, why = '', lastFeeR = S.COOK_FEE; // hi = จานที่ได้ระดับสูงสุด (ไว้บอกในข้อความ)
    for (let i = 0; i < want; i++) {
      const lotsMap = {}; for (const k of Object.keys(inv)) if (S.perishable(k) && inv[k] > 0) lotsMap[k] = this.lotsOf(p.rec, k);
      const cu = S.cookUse(S.cookInv(inv, lotsMap, Date.now()), r), use = cu.use; // วัตถุดิบ (เฉพาะของสด: ค้าง/เก่าทำอาหารไม่ได้ 22 พ.ย. 2026): ใช้ของหลักก่อน ขาดค่อยใช้ของทางเลือก (S.COOK_ALT) ตัดสินที่ shared ให้เว็บแสดงตรงกัน
      if (!cu.ok && S.cookUse(inv, r).ok) { why = '🟡 วัตถุดิบไม่สด (ค้าง/เก่า) ทำอาหารไม่ได้ ต้องเป็นของสดอายุไม่เกิน 24 ชั่วโมง'; break; }
      if (!cu.ok) { const u = cu.rows.find(x => !x.ok && x.need.u); why = u ? `วัตถุดิบไม่พอ ต้องใช้ปลาคนละชนิดอย่างน้อย ${u.need.n} ชนิด` : 'วัตถุดิบไม่พอ'; break; }
      const qt = S.cookQuote(r, cu); // B′: ระดับ/ราคาขายของจานนี้ตามวัตถุดิบที่ใช้จริง (แต่ละจานในชุดต่างระดับกันได้)
      const panOk = this.durCur(p, 'pan') > 0, pTier = S.panTier(inv), feeR = S.panFee(r, pTier, panOk), fee = Math.round(qt.sell * feeR); // ค่าเช่าเตา: หายจากระบบทั้งหมด (TOWN.feeShare) กันครัวเป็นช่องสร้างเงินล้วนๆ
      if ((inv.coin || 0) < fee) { why = `ค่าเช่าเตา 🪙 ${fee} เหรียญไม่พอ`; break; }
      for (const [k, c] of Object.entries(use)) { // หักจากกองที่สดก่อน (เรียงกองสดไว้หน้า ไม่ใช้กองค้าง/เก่าแทน) แล้วคืนลำดับเก่า→ใหม่
        const L = S.perishable(k) ? lotsMap[k] : null;
        if (L && L.length) L.sort((a, b) => (S.freshTier(a[0], Date.now(), false) > S.COOK_FRESH_MAX) - (S.freshTier(b[0], Date.now(), false) > S.COOK_FRESH_MAX) || a[0] - b[0]);
        this.add(p, k, -c); if (L && L.length) L.sort((a, b) => a[0] - b[0]);
      }
      this.add(p, 'coin', -fee, 'cookfee'); this.toPot(fee); this.add(p, qt.key, 1);
      this.addXp(p, 'cook', r.xp); made++; feeSum += fee; xpSum += r.xp; sellSum += qt.sell; hi = Math.max(hi, qt.q); lastFeeR = feeR;
      const pw = panOk ? S.panHit(r, pTier) : null; if (pw && pw.wear > 0 && pw.bonus > 0) this.durUse(p, 'pan', pw.wear); // กระทะสึกเมื่อทำสำเร็จ (ได้ลดค่าเตาจริงเท่านั้น)
      this.event(p, 'cook');
    }
    if (!made) return this.toast(p, why || 'วัตถุดิบไม่พอ');
    const rest = r.time * made; p.cookReady = now + rest; send(p, { t: 'cookcd', ms: rest }); // บอกเว็บว่าเตาพักอีกกี่ ms (นับจากตอนได้รับ)
    this.toast(p, `👨‍🍳 ทำ ${r.emoji} ${r.name}${made > 1 ? ' ×' + made : ''} สำเร็จ! (+${xpSum} XP เชฟ • ค่าเตา -🪙${feeSum}${lastFeeR < S.COOK_FEE ? ` (กระทะช่วยลด ${Math.round((1 - lastFeeR / S.COOK_FEE) * 100)}%)` : ''} • ขายได้ราว 🪙${sellSum}${hi ? ` • ใช้วัตถุดิบแพง ได้อาหารระดับ ✦${hi}` : ''}${made < want ? ` • ทำได้แค่ ${made} จาน: ${why}` : ''})`); this.sfx(p, 'collect');
  },
  craft(p, id, n) { // ประดิษฐ์ที่ร้านช่างไม้: ใช้ไม้ที่หามาได้ ได้ของ + XP ช่างไม้ • ทำทีละหลายชิ้น (22 พ.ย. 2026): n = 1..S.CRAFT_BATCH_MAX หักไม้/ค่าโรงช่าง/XP ต่อชิ้นเท่าเดิม ของไม่พอกลางทาง = ทำเท่าที่ได้ (ช่างไม้ไม่มีเตาพัก)
    const r = typeof id === 'string' ? S.CRAFT.find(x => x.id === id) : null; if (!r) return;
    const want = Number.isInteger(n) ? Math.max(1, Math.min(S.CRAFT_BATCH_MAX, n)) : 1;
    if (this.nearShopKind(p) !== 'wood') return this.toast(p, 'ต้องยืนใกล้ประตูร้านช่างไม้ถึงจะประดิษฐ์ได้');
    if (this.lv(p, 'wood') < r.lv) return this.toast(p, `ต้องเป็นช่างไม้เลเวล ${r.lv} ก่อน`);
    const inv = p.rec.inv, fee = S.craftFee(r.id); let made = 0, feeSum = 0, xpSum = 0, why = '';
    for (let i = 0; i < want; i++) {
      if (Object.entries(r.in).some(([k, c]) => (inv[k] || 0) < c)) { why = 'วัตถุดิบไม่พอ'; break; }
      if ((inv.coin || 0) < fee) { why = `ค่าใช้โรงช่างไม้ 🪙 ${fee} เหรียญไม่พอ`; break; }
      for (const [k, c] of Object.entries(r.in)) this.add(p, k, -c);
      if (fee) { this.add(p, 'coin', -fee, 'craftfee'); this.toPot(fee); }
      const gain = S.woodXp(r.xp, this.lv(p, 'wood')); this.add(p, r.id, 1); this.addXp(p, 'wood', gain); made++; feeSum += fee; xpSum += gain;
      this.event(p, 'craft');
    }
    if (!made) return this.toast(p, why || 'วัตถุดิบไม่พอ');
    const info = S.itemInfo(r.id); this.toast(p, `🔨 ประดิษฐ์ ${info.emoji} ${info.name}${made > 1 ? ' ×' + made : ''} สำเร็จ! (+${xpSum} XP${feeSum ? ` • ค่าโรงช่าง -🪙${feeSum}` : ''}${made < want ? ` • ทำได้แค่ ${made} ชิ้น: ${why}` : ''})`); this.sfx(p, 'collect');
    if (info.furn) this.bookAdd(p, 'furn', info.furn);
  },
};
