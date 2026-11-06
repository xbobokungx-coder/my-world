'use strict';
// ไร่ แปลงปลูก และแปลงเช่า: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { CROPS } = S;

module.exports = {
  // พืชเป็นของคนปลูก (t.o = key, t.on = ชื่อ): เก็บได้เฉพาะเจ้าของ แต่ถ้าสุกแล้วไม่มีใครมาเก็บครบ 1 วันในเกม (t.rm = เวลาที่สุกค้างอยู่ นับเฉพาะตอนมีคนออนไลน์) คนอื่นก็มาเก็บได้ ต้นเก่าที่ไม่มีเจ้าของ = ใครเก็บก็ได้
  cropLocked(t, p) { return !!(t.o && p.key !== t.o && (t.rm || 0) < S.DAY_MS); },
  pub(t, now) { return { c: t.c || null, s: t.c ? S.cropStage(t) : 0, f: t.c ? S.cropFrame(t) : 0, w: t.wu > now ? 1 : 0, o: t.on || '', l: t.c && t.o && S.cropStage(t) === 3 && (t.rm || 0) < S.DAY_MS ? 1 : 0 }; },
  tileUpdate(k, t) {
    if (t) { t._p = JSON.stringify(this.pub(t, Date.now())); this.broadcast({ t: 'tile', k, v: JSON.parse(t._p) }); }
    else this.broadcast({ t: 'tile', k, v: null });
    this.dirty = true;
  },
  cropTick(now) {
    let dt = now - this.lastCrop; this.lastCrop = now;
    if (!Number.isFinite(dt) || dt < 0 || dt > 120000) return; // นาฬิกากระโดด — ไม่โต/ไม่ถอย
    if (!this.players.size) return; // โลกจำศีล: ไม่มีคนออนไลน์ พืชไม่โต
    for (const k in this.farm) {
      const t = this.farm[k];
      if (t.c && t.wu > now && S.cropStage(t) < 3) t.g = Math.min(CROPS[t.c].time, (t.g || 0) + dt * (t.m || 1) / (S.cropSeason(t.c, now) < 0 ? S.SEASONS.outGrow : 1)); // นอกฤดูโตช้าลง
      else if (t.c && t.o && S.cropStage(t) === 3 && (t.rm || 0) < S.DAY_MS) { t.rm = (t.rm || 0) + dt; this.dirty = true; } // สุกค้างอยู่ นับเวลาจนครบ 1 วันในเกม
      else if (!t.c) { // แปลงว่างที่ไม่มีใครถาง/ปลูกเกินเวลาที่กำหนด หญ้าขึ้นกลับ
        t.idle = (t.idle || 0) + dt;
        if (t.idle >= S.FARM_REGROW_MS) { delete this.farm[k]; this.tileUpdate(k, null); this.dirty = true; continue; }
      }
      if (JSON.stringify(this.pub(t, now)) !== t._p) this.tileUpdate(k, t);
    }
  },
  // ----- แปลงเช่า (S.FARM_RENT) -----
  rentAt(x, y) { const P = S.rentPlotAt(x, y), r = P && this.rents[P.id]; return r && r.until > Date.now() ? r : null; },
  rentBlock(x, y, p) { // แปลงเช่าใช้ได้เฉพาะคนที่เช่าอยู่ แปลงว่างล็อกไว้ (คืนข้อความที่ต้องบล็อก หรือ null)
    if (!S.rentPlotAt(x, y)) return null;
    const r = this.rentAt(x, y);
    if (r && r.key === p.key) return null;
    return r ? `🔒 แปลงนี้ ${r.name} เช่าอยู่` : '🔒 แปลงนี้ยังไม่มีคนเช่า ล็อกไว้ก่อน (เช่าได้ที่ร้านเมล็ดพันธุ์)';
  },
  rentsPub() { const o = {}, now = Date.now(); for (const [id, r] of Object.entries(this.rents)) if (r.until > now) o[id] = { name: r.name, until: r.until, key: r.key }; return o; },
  rentHandle(p, id) { // เช่า/ต่อเวลาแปลง ที่ร้านเมล็ดพันธุ์ • คนละแปลง • จ่ายเหรียญ (หายจากระบบ)
    if (this.nearShopKind(p) !== 'farm') return this.toast(p, 'เช่าแปลงได้ที่ร้านเมล็ดพันธุ์');
    const P = S.FARM_RENT.plots.find(q => q.id === id); if (!P) return;
    const now = Date.now(), cur = this.rents[id], mine = Object.entries(this.rents).find(([k, r]) => r.key === p.key && r.until > now);
    if (cur && cur.until > now && cur.key !== p.key) return this.toast(p, `แปลง ${id} มีคนเช่าอยู่แล้ว (${cur.name})`);
    if (mine && mine[0] !== id) return this.toast(p, `คุณเช่าแปลง ${mine[0]} อยู่แล้ว เช่าได้คนละแปลง`);
    if (cur && cur.key === p.key && cur.until > now) return this.toast(p, 'เช่าได้รอบละ 1 วัน รอให้หมดรอบก่อนแล้วค่อยเช่าใหม่');
    const until = now + S.FARM_RENT.ms;
    if ((p.rec.inv.coin || 0) < S.FARM_RENT.price) return this.toast(p, `เหรียญไม่พอ ค่าเช่า 🪙 ${S.FARM_RENT.price}`);
    this.add(p, 'coin', -S.FARM_RENT.price, 'rent'); this.toPot(S.FARM_RENT.price); this.rents[id] = { key: p.key, name: p.name, until }; this.dirty = true;
    this.broadcast({ t: 'rents', r: this.rentsPub() }); this.sfxTo(p, 'coin');
    this.toast(p, `🏡 เช่าแปลง ${id} ถึง ${new Date(until).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} (ต้นในแปลงนี้ไม่นับเพดานปลูก)`);
    if (!cur || cur.key !== p.key || cur.until <= now) this.addLog(`🏡 ${p.name} เช่าแปลง ${id} ที่แปลงผัก`);
  },
};
