'use strict';
// ความทนทานเครื่องมือและบัวรดน้ำ: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { send } = require('../util.js');
const rodOf = inv => S.rodTier(inv);

module.exports = {
  // ---------- ความทนทานเครื่องมือ (รายจ่ายสม่ำเสมอ): ใช้ทุกครั้งสึก 1 หมดแล้วต้องซ่อมที่ร้านเสียเหรียญ ----------
  toolTier(p, tool) { const inv = p.rec.inv; return tool === 'rod' ? rodOf(inv) : tool === 'axe' ? (S.axeTier(inv) || 1) : tool === 'pick' ? (S.pickTier(inv) || 1) : 1; },
  fixN(p, tool) { return (p.rec.fix && p.rec.fix[tool]) || 0; },
  durMx(p, tool) { return S.durMax(tool, this.toolTier(p, tool), this.fixN(p, tool)); },
  durCur(p, tool) { const mx = this.durMx(p, tool), d = p.rec.dur && p.rec.dur[tool]; return d === undefined ? mx : Math.max(0, Math.min(d, mx)); },
  durPub(p) { const o = {}; for (const t of Object.keys(S.DURABILITY)) o[t] = [this.durCur(p, t), this.durMx(p, t), this.fixN(p, t)]; return o; },
  // ---------- น้ำในบัวรดน้ำ: ตักจากสระได้ครั้งละตามความจุของบัว (S.CANS) แล้วต้องกลับไปตักใหม่ ----------
  canOf(p) { const c = S.CANS[S.canTier(p.rec.inv)]; return this.buffOn(p, 'bigcan') ? Object.assign({}, c, { cap: Math.round(c.cap * S.BUFFS.bigcan.capMul) }) : c; },
  waterCur(p) { const cap = this.canOf(p).cap, w = p.rec.wtr; return w === undefined ? cap : Math.max(0, Math.min(w, cap)); },
  waterSet(p, n) { p.rec.wtr = n; send(p, { t: 'wtr', n }); this.dirty = true; },
  durOk(p, tool) {
    if (this.durCur(p, tool) > 0) return true;
    const D = S.DURABILITY[tool], sn = S.SHOPS[D.shop].name;
    this.toast(p, this.fixN(p, tool) >= S.REPAIR.maxFixes ? `💥 ${D.name}ซ่อมไม่ได้แล้ว! ต้องซื้อใหม่ที่${sn}` : `🔧 ${D.name}พังแล้ว! ซ่อมได้ที่${sn}`); return false;
  },
  durUse(p, tool, mul = 1) { // mul = ตัวคูณการสึก (ขวาน/คัน ตามระดับต้นไม้/ปลา) ค่าเริ่มต้น 1 = เดิม
    const W = S.WEAR_RATE, now = Date.now(), H = (p.heat || (p.heat = {}))[tool] || (p.heat[tool] = { h: 0, t: now, carry: 0, warn: false });
    H.h = Math.max(0, H.h - (now - H.t) / 1000 * W.cool) + 1; H.t = now; // ใช้ถี่ๆ ต่อเนื่อง = ร้อนขึ้น พักแล้วเย็นลง
    H.carry += W.base * (1 + Math.min(W.maxBonus, H.h * W.perHeat)) * (Number.isFinite(mul) && mul > 0 ? Math.min(mul, 5) : 1);
    const take = Math.floor(H.carry); H.carry -= take;
    const before = this.durCur(p, tool), cur = Math.max(0, before - take), mx = this.durMx(p, tool), thr = Math.ceil(mx * 0.1);
    (p.rec.dur || (p.rec.dur = {}))[tool] = cur;
    send(p, { t: 'dur', d: this.durPub(p) }); this.dirty = true;
    if (cur <= 0) this.toast(p, this.fixN(p, tool) >= S.REPAIR.maxFixes ? `💥 ${S.DURABILITY[tool].name}พังจนซ่อมไม่ได้แล้ว! ต้องซื้อใหม่ที่ร้าน` : `🔧 ${S.DURABILITY[tool].name}พังแล้ว! ต้องซ่อมที่ร้านก่อนใช้ต่อ`);
    else if (before > thr && cur <= thr) this.toast(p, `⚠️ ${S.DURABILITY[tool].name}ใกล้พังแล้ว (เหลือ ${cur})`);
    if (H.h >= W.warnHeat && !H.warn) { H.warn = true; this.toast(p, `🔥 ใช้${S.DURABILITY[tool].name}ถี่และนานมาก จะสึกหรอไวกว่าปกติ (ยิ่งใช้ต่อเนื่องยิ่งไว สูงสุด 2 เท่า) พักสักครู่จะเย็นลง`); }
    else if (H.h < W.warnHeat * 0.4) H.warn = false;
  },
  toolShopCheck(p, tool) {
    const D = typeof tool === 'string' && Object.hasOwn(S.DURABILITY, tool) ? S.DURABILITY[tool] : null; if (!D) return null;
    if (this.nearShopKind(p) !== D.shop) { this.toast(p, `ต้องอยู่ที่${S.SHOPS[D.shop].name}ถึงจะซ่อม/ซื้อ${D.name}ได้`); return null; }
    return D;
  },
  repair(p, tool) {
    const D = this.toolShopCheck(p, tool); if (!D) return;
    const tier = this.toolTier(p, tool), n = this.fixN(p, tool), cur = this.durCur(p, tool);
    if (n >= S.REPAIR.maxFixes) return this.toast(p, `💥 ${D.name}ซ่อมครบ ${n} ครั้งแล้ว ซ่อมไม่ได้อีก ต้องซื้อใหม่ (🪙 ${S.toolPrice(tool, tier)})`);
    const nmx = S.durMax(tool, tier, n + 1);
    if (cur >= nmx) return this.toast(p, `${D.name}ยังสภาพดีอยู่`);
    const cost = S.repairCost(tool, tier, cur, n);
    if ((p.rec.inv.coin || 0) < cost) return this.toast(p, `เหรียญไม่พอ ค่าซ่อม 🪙 ${cost}`);
    this.add(p, 'coin', -cost, 'repair'); this.toPot(cost); (p.rec.dur || (p.rec.dur = {}))[tool] = nmx; (p.rec.fix || (p.rec.fix = {}))[tool] = n + 1;
    send(p, { t: 'dur', d: this.durPub(p) });
    this.toast(p, `🔧 ซ่อม${D.name}เรียบร้อย (-🪙 ${cost}) ความทนทานสูงสุดเหลือ ${nmx}${n + 1 >= S.REPAIR.maxFixes ? ' • ซ่อมได้อีกไม่ได้แล้ว' : ''}`); this.sfxTo(p, 'coin'); this.dirty = true;
  },
  rebuy(p, tool) {
    const D = this.toolShopCheck(p, tool); if (!D) return;
    const tier = this.toolTier(p, tool), n = this.fixN(p, tool), cur = this.durCur(p, tool);
    if (!n && cur > 0) return this.toast(p, `${D.name}ยังใหม่อยู่ ไม่ต้องซื้อใหม่`);
    const cost = S.toolPrice(tool, tier);
    if ((p.rec.inv.coin || 0) < cost) return this.toast(p, `เหรียญไม่พอ ราคา 🪙 ${cost}`);
    this.add(p, 'coin', -cost, 'repair'); this.toPot(cost); if (p.rec.dur) delete p.rec.dur[tool]; if (p.rec.fix) delete p.rec.fix[tool];
    send(p, { t: 'dur', d: this.durPub(p) }); this.toast(p, `🛒 ซื้อ${D.name}อันใหม่แล้ว (-🪙 ${cost}) ความทนทานเต็ม`); this.sfxTo(p, 'coin'); this.dirty = true;
  },
};
