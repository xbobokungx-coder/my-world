'use strict';
// ป้ายอันดับกลางเมือง: เลเวล / XP สัปดาห์นี้ / เศรษฐี / ตู้เกม (ต่อกลับ class World ด้วย mix() ดู server/mixin.js)
// ส่งออกเฉพาะชื่อตัวละครกับตัวเลขของแท็บ • ตัดผู้ดูแล (ADMIN_NAME) และบัญชีที่ XP รวมต่ำกว่า S.RANK.minXp (บัญชีทดลอง/แค่เข้ามาดู)
const S = require('../../public/shared.js');
const { send } = require('../util.js');
const { ADMIN_NAME } = require('../consts.js');

const num = v => (Number.isFinite(v) && v > 0 ? v : 0);

module.exports = {
  rankBuild() { // คำนวณอันดับจากเซฟทุกคนครั้งเดียว (แล้วแคช) → { top, ranks }
    const wkNow = this.weekKey(), admin = ADMIN_NAME.toLowerCase(), skills = Object.keys(S.SKILLS);
    const rows = [];
    for (const [k, r] of Object.entries(this.saved)) {
      if (!r || typeof r !== 'object' || k === admin || String(r.name || '').toLowerCase() === admin) continue;
      const sk = r.skills && typeof r.skills === 'object' ? r.skills : {};
      let xpAll = 0; for (const s of skills) xpAll += num(sk[s]);
      if (xpAll < S.RANK.minXp) continue;
      const a = r.arc && typeof r.arc === 'object' ? r.arc : {};
      rows.push({
        k, n: String(r.name || k), xpAll, sk,
        wk: r.wkx && r.wkx.k === wkNow ? Math.floor(num(r.wkx.xp)) : 0,
        coin: Math.floor(num(r.inv && r.inv.coin)) + Math.floor(num(r.bank && r.bank.bal)),
        at: Math.floor(num(a.total)), aw: a.wkKey === wkNow ? Math.floor(num(a.wk)) : 0,
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
      rich: make('rich', rows.filter(x => x.coin > 0), (a, b) => b.coin - a.coin, x => ({ n: x.n, coin: x.coin })),
      arc: {
        total: make('at', rows.filter(x => x.at > 0), (a, b) => b.at - a.at, x => ({ n: x.n, total: x.at })),
        wk: make('aw', rows.filter(x => x.aw > 0), (a, b) => b.aw - a.aw, x => ({ n: x.n, wk: x.aw })),
      },
    };
    return { at: Date.now(), wkKey: wkNow, top: t, ranks: { lv: ranks.lv, wk: ranks.wk, rich: ranks.rich, arc: ranks.at } };
  },
  rankData() { // แคชผลคำนวณ (S.RANK.cacheMs) และทิ้งเมื่อข้ามสัปดาห์
    const c = this._rank;
    if (c && c.wkKey === this.weekKey() && Date.now() - c.at < S.RANK.cacheMs) return c;
    return (this._rank = this.rankBuild());
  },
  sendRank(p) { // ตอบ { t:'rank', lv, wk, rich, arc, me } • me = อันดับตัวเอง (0 = ยังไม่ติด)
    const d = this.rankData(), k = p.key, rk = d.ranks;
    const me = { lv: {}, wk: rk.wk[k] || 0, rich: rk.rich[k] || 0, arc: (rk.arc && rk.arc[k]) || 0 };
    for (const s of Object.keys(rk.lv)) me.lv[s] = rk.lv[s][k] || 0;
    send(p, { t: 'rank', lv: d.top.lv, wk: d.top.wk, rich: d.top.rich, arc: d.top.arc, me });
  },
};
