'use strict';
// เควสประจำวัน แต้ม บัฟ และข่าวชื่อเสียง: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { send } = require('../util.js');

module.exports = {
  questPick(p, r, have) { // สุ่มเควสให้ครบ QUEST_PER_DAY ข้อ: กระจายหลายหมวดก่อน แล้วค่อยเติมให้เต็ม • have = id ที่มีอยู่แล้ว (ไม่ซ้ำ)
    const inv = p.rec.inv, newbie = (p.rec.qtotal || 0) < S.QUEST_NEWBIE, hasAxe = S.axeTier(inv) > 0;
    const ids = Object.keys(S.QUESTS).filter(id => { const d = S.QUESTS[id]; return !have.includes(id) && !(newbie && (d.adv || d.cat === 'cook')) && !(d.cat === 'wood' && !hasAxe); }); // มือใหม่: ข้อง่ายเท่านั้น • เควสไม้ต้องมีขวาน
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const out = [];
    for (const c of shuffle([...new Set(ids.map(id => S.QUESTS[id].cat))])) {
      if (out.length + have.length >= S.QUEST_PER_DAY) break;
      const pool = ids.filter(id => S.QUESTS[id].cat === c); out.push(pool[Math.floor(r() * pool.length)]);
    }
    const rest = shuffle(ids.filter(id => !out.includes(id)));
    while (out.length + have.length < S.QUEST_PER_DAY && rest.length) out.push(rest.pop());
    return out;
  },
  questsOf(p) { // เควสของวันนี้ (สุ่มจากชื่อ+วัน ได้ชุดเดิมทั้งวันแม้ออกแล้วเข้าใหม่) • ถ้าเคยได้น้อยกว่าที่กำหนด (ปรับจำนวนเควสกลางวัน) จะเติมให้ครบโดยไม่ล้างความคืบหน้า
    const day = this.today(); let q = p.rec.quest;
    const valid = !!(q && q.day === day && q.list.every(it => S.QUESTS[it.id]));
    if (valid && q.list.length >= S.QUEST_PER_DAY) return q;
    let h = 2166136261; for (const ch of p.key + day + (valid ? q.list.length : '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const r = S.rng(h >>> 0), mk = id => ({ id, n: 0, done: false, seen: [] });
    if (valid) { for (const id of this.questPick(p, r, q.list.map(it => it.id))) q.list.push(mk(id)); delete q.bonus; this.dirty = true; return q; }
    q = p.rec.quest = { day, list: this.questPick(p, r, []).map(mk) };
    return q;
  },
  ptsOf(p) { const day = this.today(), o = p.rec.pts = p.rec.pts || { bal: 0, earned: 0, day }; if (o.day !== day) { o.day = day; o.earned = 0; } return o; },
  buffOn(p, id) { return !!(p.rec.buffs && p.rec.buffs[id] > Date.now()); },
  questPush(p) {
    const q = this.questsOf(p), pts = this.ptsOf(p), now = Date.now(), buffs = {};
    for (const id of Object.keys(S.BUFFS)) if (this.buffOn(p, id)) buffs[id] = p.rec.buffs[id] - now;
    send(p, { t: 'quests', wk1: this.wk1Pub(p.rec), list: q.list.map(it => [it.id, it.n, it.done ? 1 : 0]), total: p.rec.qtotal || 0, title: this.titleOf(p.rec),
      starter: { done: Object.keys(this.starterOf(p).done), final: !!this.starterOf(p).final, c2: { done: Object.keys(this.starterOf(p).c2.done), final: !!this.starterOf(p).c2.final } }, streak: { n: (p.rec.streak || {}).n || 0 },
      book: Object.fromEntries(Object.keys(S.BOOK).map(c => [c, Object.keys(this.bookOf(p)[c])])),
      wk: (this.wkRoll(), { mine: this.week.by[p.name] || 0, claimed: !!this.week.claimed[p.key] }), pts: { bal: pts.bal, earned: pts.earned }, buffs });
  },
  addPts(p, n) {
    const o = this.ptsOf(p); n = Math.min(n, S.POINTS.dailyCap - o.earned);
    if (n <= 0) return;
    o.bal += n; o.earned += n; this.dirty = true; this.wk1Step(p, 'help'); this.questPush(p); this.toast(p, `💛 แต้มความดี +${n}`);
  },
  statDay() { // วันใหม่: ประกาศผู้นำของเมื่อวานลงข่าวเมือง แล้วเริ่มนับใหม่
    const day = this.today();
    if (this.stats.day === day) return;
    for (const [ev, [emoji, label]] of Object.entries(S.FAME)) {
      const top = Object.entries(this.stats.ev[ev] || {}).sort((a, b) => b[1] - a[1])[0];
      if (top && this.stats.day) this.addLog(`🏆 ${emoji} ${label}ประจำเมื่อวาน: ${top[0]} (${top[1]} ครั้ง)`);
    }
    this.stats = { day, ev: {} }; this.dirty = true;
  },
  famePub() { const o = {}; for (const ev of Object.keys(S.FAME)) o[ev] = Object.entries(this.stats.ev[ev] || {}).sort((a, b) => b[1] - a[1]).slice(0, 3); return o; },
  questHandle(p, m) {
    if (m.a === 'ach') return this.achPush(p);
    if (m.a === 'title') { // เลือกฉายาที่ปลดล็อกแล้ว ('' = กลับไปใช้ฉายาตามเควส)
      const id = typeof m.id === 'string' ? m.id : '';
      if (id) { const d = S.ACH.find(x => x.id === id); if (!d || !d.title || !(p.rec.ach && p.rec.ach.got[id])) return; p.rec.ttl = id; } else delete p.rec.ttl;
      p.title = this.titleOf(p.rec); this.broadcast({ t: 'title', id: p.id, title: p.title }); this.dirty = true; this.achPush(p);
      return this.toast(p, p.title ? `🏅 ใช้ฉายา "${p.title}"` : 'เอาฉายาออกแล้ว');
    }
    if (m.a === 'buff') {
      const id = typeof m.id === 'string' && Object.hasOwn(S.BUFFS, m.id) ? m.id : null, B = id && S.BUFFS[id];
      if (!B) return;
      if (this.buffOn(p, id)) return this.toast(p, `${B.emoji} ${B.name} ยังมีผลอยู่`);
      const o = this.ptsOf(p); if (o.bal < B.cost) return this.toast(p, 'แต้มความดีไม่พอ');
      o.bal -= B.cost; (p.rec.buffs || (p.rec.buffs = {}))[id] = Date.now() + B.ms; this.dirty = true;
      this.questPush(p); this.toast(p, `${B.emoji} ${B.name}: ${B.desc} (${Math.round(B.ms / 60000)} นาที)`); this.sfxTo(p, 'levelup');
    } else if (m.a === 'weekly') { this.weeklyClaim(p);
    } else if (m.a === 'fame') { this.statDay(); send(p, { t: 'fame', f: this.famePub() }); }
  },
};
