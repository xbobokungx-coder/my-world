'use strict';
// เทรดระหว่างผู้เล่น: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { TS } = S;
const { send } = require('../util.js');

module.exports = {
  // ---------- เทรดของระหว่างผู้เล่น: ของเท่านั้น (ไม่มีเหรียญ) มูลค่าฝั่งละไม่เกิน 1000 ต่อรอบ ทั้งสองฝ่ายต้องกดยืนยัน ----------
  tradeOf(p) { return p.tradeId ? this.trades.get(p.tradeId) : null; },
  tradeValue(offer) { let v = 0; for (const k in offer) v += S.tradeValue(k) * offer[k]; return v; },
  tradePub(tr, side) {
    const me = tr[side], ot = tr[side === 'a' ? 'b' : 'a'];
    return { t: 'trade', ev: 'state', open: tr.open, max: S.TRADE.maxValue, me: { offer: me.offer, ok: me.ok, value: this.tradeValue(me.offer) }, other: { id: ot.id, name: ot.name, offer: ot.offer, ok: ot.ok, value: this.tradeValue(ot.offer) } };
  },
  tradePush(tr) { for (const side of ['a', 'b']) { const q = this.players.get(tr[side].id); if (q) send(q, this.tradePub(tr, side)); } },
  tradeCancel(p, why) {
    const tr = this.tradeOf(p); if (!tr) return;
    this.trades.delete(tr.id);
    for (const side of ['a', 'b']) { const q = this.players.get(tr[side].id); if (q) { q.tradeId = 0; send(q, { t: 'trade', ev: 'closed', why: why || 'ยกเลิกการเทรด' }); } }
  },
  tradeHandle(p, m) {
    const tr = this.tradeOf(p), side = tr && tr.a.id === p.id ? 'a' : 'b';
    switch (m.a) {
      case 'req': {
        const q = this.players.get(m.to | 0);
        if (!q || q === p || tr || q.tradeId) return this.toast(p, !q ? 'ไม่พบผู้เล่นคนนั้น' : q.tradeId ? 'อีกฝ่ายกำลังเทรดกับคนอื่นอยู่' : 'คุณกำลังเทรดอยู่');
        if (Math.hypot(p.x - q.x, p.y - q.y) > S.TRADE.range * TS) return this.toast(p, `ต้องอยู่ใกล้กัน (ไม่เกิน ${S.TRADE.range} ช่อง) ถึงจะเทรดได้`);
        const t2 = { id: this.nextTrade++, a: { id: p.id, key: p.key, name: p.name, offer: {}, ok: false }, b: { id: q.id, key: q.key, name: q.name, offer: {}, ok: false }, open: false, t0: Date.now() };
        this.trades.set(t2.id, t2); p.tradeId = q.tradeId = t2.id; // จองคู่ไว้ก่อน (ยังไม่เปิดจนกว่าอีกฝ่ายตอบรับ)
        send(q, { t: 'trade', ev: 'req', from: { id: p.id, name: p.name } }); send(p, { t: 'trade', ev: 'wait', to: q.name });
        break;
      }
      case 'accept': if (tr && !tr.open && side === 'b') { tr.open = true; this.tradePush(tr); } break;
      case 'decline': case 'cancel': this.tradeCancel(p, m.a === 'decline' ? `${p.name} ปฏิเสธการเทรด` : `${p.name} ยกเลิกการเทรด`); break;
      case 'offer': {
        if (!tr || !tr.open) return;
        const k = m.item, q = Math.max(0, Math.min(9999, m.qty | 0)), me = tr[side];
        if (!S.isTradable(k)) return this.toast(p, 'ของชิ้นนี้เทรดไม่ได้ (เหรียญ/เสื้อผ้า/อุปกรณ์ผูกกับตัว)');
        const have = p.rec.inv[k] || 0, qty = Math.min(q, have);
        const next = Object.assign({}, me.offer); if (qty > 0) next[k] = qty; else delete next[k];
        if (this.tradeValue(next) > S.TRADE.maxValue) return this.toast(p, `มูลค่ารวมเกิน ${S.TRADE.maxValue} เหรียญต่อรอบ`);
        me.offer = next; tr.a.ok = tr.b.ok = false; // แก้ข้อเสนอแล้วต้องยืนยันใหม่ทั้งคู่
        this.tradePush(tr);
        break;
      }
      case 'ok': {
        if (!tr || !tr.open) return;
        tr[side].ok = !!m.on; this.tradePush(tr);
        if (tr.a.ok && tr.b.ok) this.tradeExecute(tr);
        break;
      }
    }
  },
  tradeExecute(tr) {
    const pa = this.players.get(tr.a.id), pb = this.players.get(tr.b.id);
    if (!pa || !pb) return this.tradeCancel(pa || pb, 'อีกฝ่ายหลุดจากเกม');
    for (const [p, offer] of [[pa, tr.a.offer], [pb, tr.b.offer]]) {
      if (this.tradeValue(offer) > S.TRADE.maxValue) return this.tradeCancel(pa, 'มูลค่าเกินลิมิต');
      for (const k in offer) if (!S.isTradable(k) || (p.rec.inv[k] || 0) < offer[k]) { tr.a.ok = tr.b.ok = false; this.toast(pa, 'ของในกระเป๋าเปลี่ยนไป กรุณาตรวจข้อเสนอใหม่'); this.toast(pb, 'ของในกระเป๋าเปลี่ยนไป กรุณาตรวจข้อเสนอใหม่'); return this.tradePush(tr); }
    }
    for (const k in tr.a.offer) { const lots = this.add(pa, k, -tr.a.offer[k]); this.add(pb, k, tr.a.offer[k], undefined, lots); } // อายุของติดไปด้วย (เทรดไม่ทำให้ของกลับมาสด)
    for (const k in tr.b.offer) { const lots = this.add(pb, k, -tr.b.offer[k]); this.add(pa, k, tr.b.offer[k], undefined, lots); }
    this.trades.delete(tr.id); pa.tradeId = pb.tradeId = 0;
    send(pa, { t: 'trade', ev: 'done', with: pb.name }); send(pb, { t: 'trade', ev: 'done', with: pa.name });
    this.sfxTo(pa, 'collect'); this.sfxTo(pb, 'collect'); this.dirty = true;
    this.event(pa, 'trade'); this.event(pb, 'trade');
  },
};
