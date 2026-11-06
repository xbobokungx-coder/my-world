'use strict';
// แผงฝากขาย: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { logEv } = require('../util.js');

module.exports = {
  // ----- แผงฝากขาย (S.STALL): ผู้เล่นขายของให้กันด้วยเหรียญ -----
  stallPub() { this.stallExpire(); return this.stall.map(x => ({ id: x.id, item: x.item, n: x.n, price: x.price, name: x.name, mine: x.seller })); },
  stallPush() { this.dirty = true; this.broadcast({ t: 'stall', l: this.stallPub() }); },
  stallExpire() { const now = Date.now(), keep = []; for (const x of this.stall) { if (now - x.t < S.STALL.days * 864e5) { keep.push(x); continue; } this.stallReturn(x); } if (keep.length !== this.stall.length) { this.stall = keep; this.dirty = true; } },
  stallReturn(x) { // คืนของให้คนขาย (ออนไลน์/ออฟไลน์) พร้อมอายุของเดิม
    const q = [...this.players.values()].find(o => o.key === x.seller);
    if (q) { this.add(q, x.item, x.n, undefined, x.lots); this.toast(q, `🛒 ของบนแผง ${S.itemInfo(x.item).name} ×${x.n} คืนกระเป๋าแล้ว`); }
    else { const rec = this.saved[x.seller]; if (rec) { rec.inv[x.item] = (rec.inv[x.item] || 0) + x.n; if (S.perishable(x.item) && x.lots) this.lotPut(rec, x.item, x.lots); this.dirty = true; } }
  },
  stallHandle(p, m) {
    if (!p.rec.pin) return this.toast(p, '🔐 ต้องตั้ง PIN ก่อนถึงจะซื้อขายที่แผงได้ (📊 ข้อมูลฉัน → ตั้ง PIN)');
    this.stallExpire();
    if (m.a === 'post') {
      const item = String(m.item || ''), n = Math.floor(+m.n), price = Math.floor(+m.price), base = S.tradeValue(item);
      if (!S.isTradable(item) || !base) return this.toast(p, 'ของชิ้นนี้วางขายที่แผงไม่ได้');
      if (!(n > 0) || n > S.STALL.maxN || (p.rec.inv[item] || 0) < n) return this.toast(p, 'จำนวนไม่ถูกต้อง');
      const lo = Math.max(1, Math.ceil(base * S.STALL.min)), hi = Math.floor(base * S.STALL.max);
      if (!(price >= lo && price <= hi)) return this.toast(p, `ราคาต่อชิ้นต้องอยู่ระหว่าง 🪙${lo}–${hi}`);
      if (this.stall.filter(x => x.seller === p.key).length >= S.STALL.slots) return this.toast(p, `วางขายได้คนละไม่เกิน ${S.STALL.slots} รายการ`);
      const lots = this.add(p, item, -n);
      this.stall.push({ id: this.stallNext++, seller: p.key, name: p.name, item, n, price, lots, t: Date.now() });
      const i = S.itemInfo(item); this.toast(p, `🛒 วาง ${i.emoji} ${i.name} ×${n} ชิ้นละ 🪙${price} แล้ว`); this.addLog(`🛒 ${p.name} วางขาย ${i.emoji} ${i.name} ×${n} ชิ้นละ 🪙${price}`);
      return this.stallPush();
    }
    const x = this.stall.find(y => y.id === (m.id | 0)); if (!x) return this.toast(p, 'รายการนี้ขายไปแล้วหรือหมดเวลา');
    if (m.a === 'cancel') { if (x.seller !== p.key) return; this.stall = this.stall.filter(y => y !== x); this.stallReturn(x); return this.stallPush(); }
    if (m.a === 'buy') {
      if (x.seller === p.key) return this.toast(p, 'ซื้อของตัวเองไม่ได้');
      const q = Math.min(x.n, Math.max(1, Math.floor(+m.n) || 1)), cost = q * x.price;
      if ((p.rec.inv.coin || 0) < cost) return this.toast(p, 'เหรียญไม่พอ');
      const take = []; let need = q; // แบ่งกองอายุของตามจำนวนที่ซื้อ (ของเก่าออกก่อน)
      for (const L of x.lots || []) { if (!need) break; const d = Math.min(L[1], need); take.push([L[0], d]); L[1] -= d; need -= d; }
      if (x.lots) x.lots = x.lots.filter(L => L[1] > 0);
      x.n -= q; if (!x.n) this.stall = this.stall.filter(y => y !== x);
      const got = cost - Math.floor(cost * S.STALL.tax); this.toPot(cost - got); // ภาษีแผง 7% เข้ากองกลาง
      this.add(p, 'coin', -cost, 'stall_buy'); this.add(p, x.item, q, undefined, take.length ? take : undefined);
      const s = [...this.players.values()].find(o => o.key === x.seller);
      if (s) { this.add(s, 'coin', got, 'stall_sell'); this.toast(s, `🛒 ${p.name} ซื้อ ${S.itemInfo(x.item).name} ×${q} ได้ 🪙${got} (หักภาษี ${Math.round(S.STALL.tax * 100)}%)`); }
      else { this.creditInv(x.seller, 'coin', got); logEv(this.room, 'coin', { p: x.seller, n: got, why: 'stall_sell' }); }
      logEv(this.room, 'stall', { buyer: p.key, seller: x.seller, item: x.item, q, coin: cost, tax: cost - got });
      const i = S.itemInfo(x.item); this.toast(p, `🛒 ซื้อ ${i.emoji} ${i.name} ×${q} จาก ${x.name} (🪙${cost})`); this.sfxTo(p, 'coin'); this.event(p, 'trade');
      return this.stallPush();
    }
  },
};
