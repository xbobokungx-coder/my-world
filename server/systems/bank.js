'use strict';
// ธนาคาร ATM: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { TS } = S;
const { send } = require('../util.js');

module.exports = {
  // ----- ธนาคาร (ATM) + Happy Village (บัฟร่วมของทั้งเมือง) -----
  bankOf(p) {
    const b = p.rec.bank = p.rec.bank || { bal: 0 };
    if (!Number.isFinite(b.bal) || b.bal < 0) b.bal = 0;
    b.bal = Math.floor(b.bal);
    delete b.acc; // ตัวนับเวลาดอกเบี้ยเดิม (ยกเลิกแล้ว)
    return b;
  },
  bankPush(p) { const b = this.bankOf(p); send(p, { t: 'bank', bal: b.bal, cap: S.BANK.cap }); },
  nearAtm(p) { return Math.hypot(p.x - (S.ATM.x + 0.5) * TS, p.y - (S.ATM.y + 0.5) * TS) < 4.5 * TS; },
  bankHandle(p, m) {
    if (!this.nearAtm(p)) return this.toast(p, 'ต้องอยู่ใกล้ตู้ ATM ที่ลานกองไฟ');
    const b = this.bankOf(p), want = m.amt === 'all' ? Infinity : m.amt | 0;
    if (!(want > 0)) return;
    if (m.a === 'dep') {
      const n = Math.min(want, p.rec.inv.coin || 0, S.BANK.cap - b.bal);
      if (n <= 0) return this.toast(p, b.bal >= S.BANK.cap ? `บัญชีเต็มแล้ว (เพดาน 🪙 ${S.BANK.cap})` : 'เหรียญไม่พอ');
      this.add(p, 'coin', -n, 'bank'); b.bal += n; this.toast(p, `ฝาก 🪙 ${n} เข้าบัญชีแล้ว (ยอดฝาก ${b.bal})`);
    } else if (m.a === 'wd') {
      const n = Math.min(want, b.bal);
      if (n <= 0) return this.toast(p, 'ไม่มีเงินให้ถอน');
      b.bal -= n; this.add(p, 'coin', n, 'bank'); this.toast(p, `ถอน 🪙 ${n} แล้ว (ยอดฝาก ${b.bal})`);
    } else return;
    this.sfxTo(p, 'coin'); this.dirty = true; this.bankPush(p);
  },
};
