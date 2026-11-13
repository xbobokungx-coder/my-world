'use strict';
// แผงฝากขาย: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { logEv } = require('../util.js');

module.exports = {
  // ----- แผงฝากขาย (S.STALL): ผู้เล่นขายของให้กันด้วยเหรียญ -----
  stallFr(x) { // จำนวนสด/ค้าง/เก่า ของรายการบนแผง (ไม่นับตู้เย็น เพราะแผงไม่ใช่ตู้เย็น)
    const fr = [0, 0, 0], now = Date.now(); let c = 0;
    for (const [t, n] of x.lots || []) { fr[S.freshTier(t, now, false)] += n; c += n; }
    fr[0] += Math.max(0, x.n - c); return fr;
  },
  stallPub() { this.stallExpire(); return this.stall.map(x => { const o = { id: x.id, item: x.item, n: x.n, price: x.price, name: x.name, mine: x.seller }; if (S.perishable(x.item)) o.fr = this.stallFr(x); return o; }); },
  bidsPub() { return this.bids.map(b => ({ id: b.id, item: b.item, n: b.n, price: b.price, name: b.name, mine: b.buyer, fresh: b.fresh })); },
  stallPubAll() { const l = this.stallPub(); return { l, b: this.bidsPub() }; }, // stallPub เรียก expire ก่อน แล้วค่อยอ่าน bids
  stallPush() { this.dirty = true; this.broadcast({ t: 'stall', ...this.stallPubAll() }); },
  stallExpire() { this.bidExpire(); const now = Date.now(), keep = []; for (const x of this.stall) { if (now - x.t < S.STALL.days * 864e5) { keep.push(x); continue; } this.stallReturn(x); } if (keep.length !== this.stall.length) { this.stall = keep; this.dirty = true; } },
  bidRefund(b, why) { // คืนเงินที่กันไว้ให้คนเสนอซื้อ (ออนไลน์/ออฟไลน์) แล้วตัดคำเสนอทิ้ง
    if (b.coin > 0) { this.creditInv(b.buyer, 'coin', b.coin); logEv(this.room, 'coin', { p: b.buyer, n: b.coin, why: 'bid_refund' }); const q = [...this.players.values()].find(o => o.key === b.buyer); if (q && why) this.toast(q, why); }
    b.coin = 0; this.dirty = true;
  },
  bidExpire() { const now = Date.now(); if (!this.bids.some(b => now - b.t >= S.STALL.bidDays * 864e5)) return; this.bids = this.bids.filter(b => { if (now - b.t < S.STALL.bidDays * 864e5) return true; const i = S.itemInfo(b.item); this.bidRefund(b, `🛒 คำเสนอซื้อ ${i.emoji} ${i.name} หมดเวลา คืนเงินให้แล้ว`); return false; }); this.dirty = true; },
  loadBids(a) { // โหลดคำเสนอซื้อ: ทิ้งรายการเสีย แต่คืนเงินที่กันไว้ให้เจ้าของก่อน
    this.bids = [];
    for (const b of Array.isArray(a) ? a : []) {
      if (!b || typeof b !== 'object') continue;
      const ok = typeof b.buyer === 'string' && this.saved[b.buyer] && typeof b.item === 'string' && S.isTradable(b.item) && Number.isInteger(b.n) && b.n > 0 && Number.isInteger(b.price) && b.price > 0 && b.coin === b.n * b.price && [0, 1, 2].includes(b.fresh) && Number.isFinite(b.t) && Number.isFinite(b.id);
      if (ok) { this.bids.push({ id: b.id, buyer: b.buyer, name: String(b.name || b.buyer).slice(0, 12), item: b.item, n: b.n, price: b.price, coin: b.coin, fresh: b.fresh, ip: typeof b.ip === 'string' ? b.ip : '', t: b.t }); continue; }
      if (b && typeof b.buyer === 'string' && Number.isFinite(b.coin) && b.coin > 0 && this.saved[b.buyer]) { this.creditInv(b.buyer, 'coin', Math.floor(b.coin)); logEv(this.room, 'coin', { p: b.buyer, n: Math.floor(b.coin), why: 'bid_refund' }); }
      this.dirty = true;
    }
  },
  nearFlea(p) { return Math.hypot(p.x - (S.FLEA.x + 0.5) * S.TS, p.y - (S.FLEA.y + 0.5) * S.TS) < 4.5 * S.TS; },
  stallReturn(x) { // คืนของให้คนขาย (ออนไลน์/ออฟไลน์) พร้อมอายุของเดิม
    const q = [...this.players.values()].find(o => o.key === x.seller);
    if (q) { this.add(q, x.item, x.n, undefined, x.lots); this.toast(q, `🛒 ของบนแผง ${S.itemInfo(x.item).name} ×${x.n} คืนกระเป๋าแล้ว`); }
    else { const rec = this.saved[x.seller]; if (rec) { if (S.perishable(x.item) && x.lots) this.lotPut(rec, x.item, x.lots); rec.inv[x.item] = (rec.inv[x.item] || 0) + x.n; /* lotPut ก่อนบวกกระเป๋า ไม่งั้น lotsOf สร้างกองซ้ำ */ this.dirty = true; } }
  },
  stallHandle(p, m) {
    if (!p.rec.pin) return this.toast(p, '🔐 ต้องตั้ง PIN ก่อนถึงจะซื้อขายที่แผงได้ (📊 ข้อมูลฉัน → ตั้ง PIN)');
    this.stallExpire();
    if (m.a === 'bcancel') { // ยกเลิกคำเสนอซื้อ: ไม่ต้องยืนใกล้ป้าย คืนเงินเต็มที่เหลือ
      const b = this.bids.find(y => y.id === (m.id | 0)); if (!b) return this.toast(p, 'คำเสนอซื้อนี้ไม่อยู่แล้ว'); if (b.buyer !== p.key) return;
      this.bids = this.bids.filter(y => y !== b); this.bidRefund(b, '🛒 ยกเลิกคำเสนอซื้อแล้ว คืนเงินให้แล้ว'); return this.stallPush();
    }
    if (m.a !== 'cancel' && !this.nearFlea(p)) return this.toast(p, '🛒 ต้องยืนใกล้ป้ายตลาดนัดที่ลานกองไฟก่อนนะ');
    if (m.a === 'bid') {
      const item = String(m.item || ''), n = Math.floor(+m.n), price = Math.floor(+m.price), fresh = m.fresh == null ? 0 : Math.floor(+m.fresh), base = S.tradeValue(item);
      if (!S.isTradable(item) || !base) return this.toast(p, 'ของชิ้นนี้เสนอซื้อไม่ได้');
      if (!(n > 0) || n > S.STALL.maxN) return this.toast(p, 'จำนวนไม่ถูกต้อง');
      const lo = Math.max(1, Math.ceil(base * S.STALL.min)), hi = Math.floor(base * S.STALL.max);
      if (!(price >= lo && price <= hi)) return this.toast(p, `ราคาต่อชิ้นต้องอยู่ระหว่าง 🪙${lo}–${hi}`);
      if (![0, 1, 2].includes(fresh)) return this.toast(p, 'ระดับความสดไม่ถูกต้อง');
      if (this.bids.filter(x => x.buyer === p.key).length >= S.STALL.bidSlots) return this.toast(p, `เสนอซื้อได้คนละไม่เกิน ${S.STALL.bidSlots} รายการ`);
      if (this.stall.length + this.bids.length >= S.STALL.maxAll) return this.toast(p, 'ตลาดนัดเต็มแล้ว รอสักครู่นะ');
      const cost = n * price; if ((p.rec.inv.coin || 0) < cost) return this.toast(p, 'เหรียญไม่พอ');
      this.add(p, 'coin', -cost, 'bid_escrow'); // กันเงินไว้ก่อน
      this.bids.push({ id: this.stallNext++, buyer: p.key, name: p.name, item, n, price, coin: cost, fresh, ip: p.ip || '', t: Date.now() });
      const i = S.itemInfo(item); this.toast(p, `🛒 เสนอซื้อ ${i.emoji} ${i.name} ×${n} ชิ้นละ 🪙${price} แล้ว (กันเงิน 🪙${cost} ไว้ให้)`);
      return this.stallPush();
    }
    if (m.a === 'fill') {
      const b = this.bids.find(y => y.id === (m.id | 0)); if (!b) return this.toast(p, 'คำเสนอซื้อนี้ถูกขายไปแล้วหรือหมดเวลา');
      if (b.buyer === p.key) return this.toast(p, 'ขายให้คำเสนอของตัวเองไม่ได้');
      const q = Math.min(b.n, Math.floor(+m.n) || 0); if (!(q > 0) || (p.rec.inv[b.item] || 0) < q) return this.toast(p, 'จำนวนไม่ถูกต้อง');
      if (S.perishable(b.item)) { // ของที่จะออก (เก่าก่อน) ต้องไม่เก่ากว่าที่ผู้ซื้อรับ
        const now = Date.now(); let need = q;
        for (const [t, k] of this.lotsOf(p.rec, b.item)) { if (!need) break; if (S.freshTier(t, now, false) > b.fresh) return this.toast(p, 'ขายของเก่าก่อน (ผู้ซื้อรับเฉพาะของที่สดกว่านี้)'); need -= Math.min(k, need); }
      }
      const cost = q * b.price, got = cost - Math.floor(cost * S.STALL.tax);
      const taken = this.add(p, b.item, -q); b.coin -= cost; b.n -= q; if (!b.n) this.bids = this.bids.filter(y => y !== b);
      this.toPot(cost - got); this.add(p, 'coin', got, 'stall_sell');
      this.creditInv(b.buyer, b.item, q, taken);
      const o = [...this.players.values()].find(z => z.key === b.buyer), i = S.itemInfo(b.item);
      if (o) this.toast(o, `🛒 ${p.name} ขาย ${i.emoji} ${i.name} ×${q} ให้ตามที่เสนอซื้อแล้ว`);
      logEv(this.room, 'stall', { buyer: b.buyer, seller: p.key, item: b.item, q, coin: cost, tax: cost - got, bid: 1 });
      this.toast(p, `🛒 ขาย ${i.emoji} ${i.name} ×${q} ให้ ${b.name} ได้ 🪙${got} (หักภาษี ${Math.round(S.STALL.tax * 100)}%)`); this.sfxTo(p, 'coin'); this.event(p, 'trade');
      return this.stallPush();
    }
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
