'use strict';
// ความสำเร็จ ฉายา ดาว และสมุดสะสม: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { send } = require('../util.js');

module.exports = {
  // ----- ความสำเร็จ (Achievement) + ฉายา: ตัวนับสะสมเก็บใน rec.ach.cnt (นับจาก event ในเกม) • ครบเป้า = ได้เหรียญ + (บางข้อ) ปลดล็อกฉายาให้เลือกใช้ (rec.ttl) -----
  achOf(rec) { const a = rec.ach = rec.ach && typeof rec.ach === 'object' ? rec.ach : {}; if (!a.cnt || typeof a.cnt !== 'object') a.cnt = {}; if (!a.got || typeof a.got !== 'object') a.got = {}; return a; },
  titleOf(rec) { // ฉายาที่แสดงเหนือหัว: ที่เลือกไว้ (ต้องปลดล็อกแล้ว) ไม่งั้นใช้ฉายาตามจำนวนเควสสะสม
    if (rec.ttl === 'wk1' && rec.wk1 && rec.wk1.final) return S.WEEK1.final.title;
    if (typeof rec.ttl === 'string' && rec.ttl.startsWith('star:')) { const sk = rec.ttl.slice(5); if (S.SKILLS[sk] && this.starOf(rec, sk) >= S.MASTERY.max) return 'ปรมาจารย์' + S.SKILLS[sk].name; }
    if (typeof rec.ttl === 'string' && rec.ttl.startsWith('arc:')) { const x = S.ARC_SHOP.find(y => 'arc:' + y.id === rec.ttl); if (x && rec.arc && (rec.arc.tt || []).includes(x.id)) return x.title; } // ฉายาจากร้านแต้มตู้เกม
    const d = rec.ttl && S.ACH.find(x => x.id === rec.ttl), a = rec.ach;
    return d && d.title && a && a.got && a.got[d.id] ? d.title : S.titleFor(rec.qtotal);
  },
  achAdd(rec, stat, n = 1) { const a = this.achOf(rec); a.cnt[stat] = (a.cnt[stat] || 0) + n; this.dirty = true; this.achCheck(rec); },
  achCheck(rec) {
    const a = this.achOf(rec), p = [...this.players.values()].find(q => q.rec === rec) || null;
    const val = st => st === 'wealth' ? (rec.inv.coin || 0) : st === 'streak' ? ((rec.streak || {}).n || 0) : (a.cnt[st] || 0);
    let any = false;
    const waived = []; // ความสำเร็จสายลงขัน (stat 'give'): ตู้เซฟกองกลางถูกยกเลิกแล้ว (3 พ.ย. 2026) ทำให้ไม่มีทางสะสมยอดได้ → ผ่านให้ทุกคนทันที ไม่มีเหรียญ ไม่ประกาศข่าวเมือง
    for (const d of S.ACH) if (d.stat === 'give' && !a.got[d.id]) { a.got[d.id] = Date.now(); any = true; if (d.title) waived.push(d.title); }
    if (waived.length && p) this.toast(p, `🏛️ ยกเลิกตู้เซฟกองกลางแล้ว ความสำเร็จสายลงขันผ่านให้ทุกคน • ได้ฉายา ${waived.map(t => `"${t}"`).join(' ')} (เลือกใช้ได้ที่ 🏅)`);
    for (const d of S.ACH) {
      if (a.got[d.id] || val(d.stat) < d.goal) continue;
      a.got[d.id] = Date.now(); any = true;
      if (d.coin) { if (p) this.add(p, 'coin', d.coin, 'ach'); else rec.inv.coin = (rec.inv.coin || 0) + d.coin; }
      if (p) {
        this.toast(p, `🏆 ความสำเร็จใหม่: ${d.e} ${d.name}${d.coin ? ` (+🪙${d.coin})` : ''}${d.title ? ` • ปลดล็อกฉายา "${d.title}"` : ''}`); this.sfxTo(p, 'levelup');
        if (d.title) this.addLog(`🏆 ${p.name} ได้ความสำเร็จ "${d.name}" ปลดล็อกฉายา "${d.title}"`);
      }
    }
    if (any) { this.dirty = true; if (p) this.achPush(p); }
  },
  achPush(p) { const a = this.achOf(p.rec); send(p, { t: 'ach', cnt: Object.assign({}, a.cnt, { wealth: p.rec.inv.coin || 0, streak: (p.rec.streak || {}).n || 0 }), got: a.got, sel: p.rec.ttl || '' }); },
  // ----- ความชำนาญหลัง Lv10 (S.MASTERY) -----
  starOf(rec, sk) { return (rec.stars && rec.stars[sk]) || 0; },
  starClaim(p, sk) {
    if (!Object.hasOwn(S.SKILLS, sk)) return; const n = this.starOf(p.rec, sk) + 1, M = S.MASTERY;
    if (n > M.max) return this.toast(p, 'ได้ดาวครบแล้ว');
    const need = S.xpFor(S.MAX_LV, sk) + n * S.masteryXp(sk), cost = M.costBase * n;
    if ((p.rec.skills[sk] || 0) < need) return this.toast(p, `ต้องมี XP ${S.SKILLS[sk].name} ${need.toLocaleString()} ก่อน`);
    if ((p.rec.inv.coin || 0) < cost) return this.toast(p, `เหรียญไม่พอ (ดาวที่ ${n} ใช้ 🪙${cost})`);
    this.add(p, 'coin', -cost, 'mastery'); (p.rec.stars || (p.rec.stars = {}))[sk] = n; this.dirty = true;
    this.toast(p, `⭐ ${S.SKILLS[sk].emoji} ${S.SKILLS[sk].name} ดาวที่ ${n}!`); this.sfxTo(p, 'levelup'); this.addLog(`⭐ ${p.name} ได้ดาวความชำนาญ${S.SKILLS[sk].name} ${'⭐'.repeat(n)}`);
    if (n >= M.max) { p.rec.ttl = 'star:' + sk; p.title = this.titleOf(p.rec); this.broadcast({ t: 'title', id: p.id, title: p.title }); }
    send(p, { t: 'stars', s: p.rec.stars });
  },
  bookOf(p) { const b = p.rec.book = p.rec.book || {}; for (const c of Object.keys(S.BOOK)) if (!b[c] || typeof b[c] !== 'object') b[c] = {}; return b; },
  bookAdd(p, cat, id) {
    const def = Object.hasOwn(S.BOOK, cat) && S.BOOK[cat]; if (!def || !def.ids.includes(id)) return;
    const b = this.bookOf(p); if (b[cat][id]) return;
    b[cat][id] = 1; this.dirty = true; this.add(p, 'coin', S.BOOK_ENTRY_COIN, 'book');
    const n = Object.keys(b[cat]).length;
    this.toast(p, `📖 สมุดสะสม${def.name}: ${n}/${def.ids.length} (+🪙${S.BOOK_ENTRY_COIN})`);
    if (n === def.ids.length) {
      const r = def.rare && S.FURN[def.rare]; this.add(p, 'coin', def.coin, 'book'); if (r) this.add(p, 'furn_' + def.rare, 1);
      this.addLog(`📖 ${p.name} สะสม${def.name}ครบทุกชนิด!`);
      this.toast(p, `🏅 สมุดสะสม${def.name}ครบ! รับ 🪙${def.coin}${r ? ` + ${r.emoji} ${r.name}` : ''}`); this.sfxTo(p, 'levelup');
    }
    this.questPush(p);
  },
};
