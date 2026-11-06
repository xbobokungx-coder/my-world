'use strict';
// ใบงาน NPC: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const SELLABLE = S.SELLABLE;
const { NPC_DEFS } = require('../consts.js');

module.exports = {
  // ----- ใบงาน NPC (S.ORDERS): ใบละ 2–3 หมวด จ่ายเกินราคามาตรฐานเล็กน้อย ทุกวันใหม่ จำนวนใบตามคนที่เข้าเกม -----
  ordersRoll() {
    const day = this.today(), o = this.orders; if (o.day === day) return o;
    const today = new Set(Object.entries(this.saved).filter(([, r]) => r.lastSeen && this.dayOf(r.lastSeen) === day).map(([k]) => k));
    const n = Math.max(S.ORDERS.minN, Math.min(S.ORDERS.maxN, Math.round(S.ORDERS.perPlayer * Math.max(1, today.size, this.players.size))));
    const NPCN = NPC_DEFS.map(d => d.name), byCat = {}; for (const k of SELLABLE) { const c = S.sellCat(k), i = S.itemInfo(k); if (i && i.sell <= 90 && c !== 'dish') (byCat[c] = byCat[c] || []).push(k); }
    const cats = Object.keys(byCat), list = [];
    for (let i = 0; i < n; i++) {
      const pick = cats.slice().sort(() => Math.random() - 0.5).slice(0, 2 + (Math.random() < 0.4 ? 1 : 0));
      const need = pick.map(c => { const arr = byCat[c], k = arr[Math.floor(Math.random() * arr.length)], q = S.ORDERS.qty[0] + Math.floor(Math.random() * (S.ORDERS.qty[1] - S.ORDERS.qty[0] + 1)); return [k, q]; });
      const pay = Math.round(need.reduce((a, [k, q]) => a + S.itemInfo(k).sell * q, 0) * S.ORDERS.pay);
      list.push({ id: i + 1, npc: NPCN[i % NPCN.length], need, pay, done: '' });
    }
    this.orders = { day, list, by: {} }; this.dirty = true; return this.orders;
  },
  ordersPub(p) { const o = this.ordersRoll(); return { list: o.list.map(x => ({ id: x.id, npc: x.npc, need: x.need, pay: x.pay, done: x.done })), mine: (o.by[p.key] || 0), max: S.ORDERS.perDay }; },
  orderFill(p, id) {
    const o = this.ordersRoll(), x = o.list.find(y => y.id === (id | 0)); if (!x) return;
    if (x.done) return this.toast(p, `ใบงานนี้ ${x.done} ส่งไปแล้ว`);
    if ((o.by[p.key] || 0) >= S.ORDERS.perDay) return this.toast(p, `วันนี้ส่งใบงานครบ ${S.ORDERS.perDay} ใบแล้ว เหลือให้คนอื่นบ้างนะ`);
    for (const [k, q] of x.need) if ((p.rec.inv[k] || 0) < q) return this.toast(p, `ของไม่พอ: ${S.itemInfo(k).name} ต้องการ ${q}`);
    for (const [k, q] of x.need) this.add(p, k, -q);
    this.add(p, 'coin', x.pay, 'order_fill'); x.done = p.name; o.by[p.key] = (o.by[p.key] || 0) + 1; this.dirty = true;
    this.toast(p, `📋 ส่งใบงานของ${x.npc}สำเร็จ! ได้ 🪙${x.pay}`); this.addLog(`📋 ${p.name} ส่งใบงานของ${x.npc} ได้ 🪙${x.pay}`); this.sfxTo(p, 'levelup'); this.event(p, 'trade');
    this.broadcast({ t: 'orders_upd' });
  },
};
