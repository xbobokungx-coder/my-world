'use strict';
// ป้ายอันดับกลางเมือง: เลเวล / XP สัปดาห์นี้ / เศรษฐี / ตู้เกม (ต่อกลับ class World ด้วย mix() ดู server/mixin.js)
// ส่งออกเฉพาะชื่อตัวละครกับตัวเลขของแท็บ • ตัดผู้ดูแล (ADMIN_NAME) และบัญชีที่ XP รวมต่ำกว่า S.RANK.minXp (บัญชีทดลอง/แค่เข้ามาดู)
const S = require('../../public/shared.js');
const { send } = require('../util.js');
const { ADMIN_NAME } = require('../consts.js');

const num = v => (Number.isFinite(v) && v > 0 ? v : 0);
// ปิดบังจำนวนเหรียญ: เหลือเห็นสามหลักท้าย ที่เหลือเป็น x คงจุลภาคไว้ (123,321,123 → xxx,xxx,123 • 45,678 → xx,678 • 500 → 500)
const maskCoin = n => { const s = Math.floor(num(n)).toLocaleString('en-US'); let seen = 0, out = ''; for (let i = s.length - 1; i >= 0; i--) { const c = s[i]; if (c === ',') { out = c + out; continue; } out = (seen < 3 ? c : 'x') + out; seen++; } return out; };

module.exports = {
  // ----- เวลาออนไลน์รายสัปดาห์: rec.onl = { w: เลขสัปดาห์ไทย, s: วินาที } • นับเฉพาะตอนเชื่อมต่ออยู่ • ขึ้นสัปดาห์ใหม่ (จันทร์ 00:00 ไทย) เริ่ม 0 ใหม่ •
  onlineFlush(p, now, closing) { // เก็บเวลาที่ค้างตั้งแต่ครั้งก่อนเข้า rec.onl (เพดาน onlineCreditMax ต่อครั้ง)
    const last = p.onAt; p.onAt = now;
    if (!last || (!closing && p.ws.readyState !== 1)) return; // closing = ออกจากเกม (ws ปิดแล้ว) ยังเก็บเวลาท้ายได้
    if (now - (p.activeAt || 0) > S.RANK.activeMs) return; // ไม่ได้ขยับ/ทำอะไรเกิน activeMs = ไม่นับ (กันทิ้งแท็บ)
    const sec = Math.min(Math.max(0, now - last), S.RANK.onlineCreditMax) / 1000; if (!(sec > 0)) return;
    const w = S.thaiWeek(now), o = p.rec.onl;
    if (!o || typeof o !== 'object' || o.w !== w) p.rec.onl = { w, s: sec }; else o.s = (Number.isFinite(o.s) && o.s > 0 ? o.s : 0) + sec;
    this.dirty = true;
  },
  onlineTick(now) {
    for (const p of this.players.values()) { if (!p.onAt) p.onAt = now; else if (now - p.onAt >= S.RANK.onlineCreditMs) this.onlineFlush(p, now); }
  },
  rankBuild() { // คำนวณอันดับจากเซฟทุกคนครั้งเดียว (แล้วแคช) → { top, ranks }
    const wkNow = this.weekKey(), onWk = S.thaiWeek(Date.now()), admin = ADMIN_NAME.toLowerCase(), skills = Object.keys(S.SKILLS);
    const rows = []; let h;
    for (const [k, r] of Object.entries(this.saved)) {
      if (!r || typeof r !== 'object' || k === admin || String(r.name || '').toLowerCase() === admin) continue;
      const sk = r.skills && typeof r.skills === 'object' ? r.skills : {};
      let xpAll = 0; for (const s of skills) xpAll += num(sk[s]);
      if (xpAll < S.RANK.minXp) continue;
      rows.push({
        k, n: String(r.name || k), xpAll, sk,
        wk: r.wkx && r.wkx.k === wkNow ? Math.floor(num(r.wkx.xp)) : 0,
        on: r.onl && r.onl.w === onWk ? Math.floor(num(r.onl.s)) : 0, // วินาทีออนไลน์สัปดาห์นี้ (ไทย)
        // ความมั่งคั่งรวม: เหรียญในมือ + ธนาคาร + ของ/อุปกรณ์ในกระเป๋า + เฟอร์นิเจอร์ที่วางในบ้าน (ไม่ใช่แค่เงินสด)
        coin: Math.floor(num(r.inv && r.inv.coin)) + Math.floor(num(r.bank && r.bank.bal)) + Math.floor(S.holdingsValue(S.invPub(r))) + ((h = this.houses && this.houses[k]) && h.items ? S.houseScore(h.items).value : 0),
      });
    }
    const top = {}, ranks = {};
    const make = (id, list, cmp, row) => { // list = แถวที่ติดอันดับ • คืน Top และเก็บอันดับของทุกคน
      list.sort(cmp); const m = ranks[id] = Object.create(null);
      list.forEach((x, i) => { m[x.k] = i + 1; });
      return list.slice(0, S.RANK.top).map(row);
    };
    const lvl = {}; ranks.lv = {};
    lvl.all = make('lv.all', rows.map(x => Object.assign({ lv: S.playLevel(x.sk) }, x)), (a, b) => b.lv - a.lv || b.xpAll - a.xpAll, x => ({ n: x.n, lv: x.lv }));
    ranks.lv.all = ranks['lv.all'];
    for (const s of skills) {
      const list = rows.filter(x => num(x.sk[s]) > 0).map(x => ({ k: x.k, n: x.n, xp: Math.floor(num(x.sk[s])), lv: S.levelOf(x.sk[s], s) }));
      lvl[s] = make('lv.' + s, list, (a, b) => b.lv - a.lv || b.xp - a.xp, x => ({ n: x.n, lv: x.lv, xp: x.xp }));
      ranks.lv[s] = ranks['lv.' + s];
    }
    const t = {
      lv: lvl,
      wk: make('wk', rows.filter(x => x.wk > 0), (a, b) => b.wk - a.wk, x => ({ n: x.n, xp: x.wk })),
      on: make('on', rows.filter(x => x.on >= 60), (a, b) => b.on - a.on, x => ({ n: x.n, h: Math.floor(x.on / 360) / 10, m: Math.floor(x.on / 60) })), // ออนไลน์สัปดาห์นี้ (ชั่วโมง ทศนิยม 1 ตำแหน่ง) ต้องครบ 1 นาทีถึงติด
      rich: make('rich', rows.filter(x => x.coin > 0), (a, b) => b.coin - a.coin, x => ({ n: x.n, coin: maskCoin(x.coin) })), // ความมั่งคั่งรวม ส่งเป็นข้อความปิดบังหลักหน้า เหลือสามหลักท้าย (123,321,123 → xxx,xxx,123) ไม่ส่งตัวเลขจริง (ความเป็นส่วนตัว)
    };
    return { at: Date.now(), wkKey: wkNow, top: t, onWk, ranks: { lv: ranks.lv, wk: ranks.wk, rich: ranks.rich, on: ranks.on } };
  },
  rankData() { // แคชผลคำนวณ (S.RANK.cacheMs) และทิ้งเมื่อข้ามสัปดาห์
    const c = this._rank;
    if (c && c.wkKey === this.weekKey() && c.onWk === S.thaiWeek(Date.now()) && Date.now() - c.at < S.RANK.cacheMs) return c;
    return (this._rank = this.rankBuild());
  },
  sendRank(p) { // ตอบ { t:'rank', lv, wk, rich, me } • me = อันดับตัวเอง (0 = ยังไม่ติด)
    const d = this.rankData(), k = p.key, rk = d.ranks;
    const me = { lv: {}, wk: rk.wk[k] || 0, rich: rk.rich[k] || 0, on: rk.on[k] || 0 };
    for (const s of Object.keys(rk.lv)) me.lv[s] = rk.lv[s][k] || 0;
    send(p, { t: 'rank', lv: d.top.lv, wk: d.top.wk, rich: d.top.rich, on: d.top.on, me });
  },
};
