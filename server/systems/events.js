'use strict';
// อีเวนต์ประจำสัปดาห์: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { send, logEv } = require('../util.js');

module.exports = {
  // ----- อีเวนต์ประจำสัปดาห์ (S.EVENTS) -----
  evWindow(now = Date.now()) { // อีเวนต์ที่กำลังเล่น หรือครั้งถัดไป (ภายใน 7 วัน) → { E, start, end }
    let next = null;
    for (const E of S.EVENTS.list) for (let k = -1; k < 8; k++) {
      const d = new Date(now); d.setDate(d.getDate() + k); if (d.getDay() !== E.dow) continue;
      d.setHours(E.hour, E.min, 0, 0); const start = d.getTime(), end = start + E.mins * 60000;
      if (end <= now) continue; if (!next || start < next.start) next = { E, start, end };
    }
    return next;
  },
  evPub() { const w = this.evWindow(), on = w && w.start <= Date.now(), sc = this.evt.key === (w && w.E.id + w.start) ? this.evt.scores : {};
    const top = nb => Object.values(sc).filter(x => !!x.nb === nb && x.s > 0).sort((a, b) => b.s - a.s || b.n - a.n).slice(0, 3).map(x => [x.name, x.s]);
    return w ? { id: w.E.id, start: w.start, end: w.end, on, top: top(false), topNb: top(true) } : null; },
  evTick() {
    const now = Date.now(), w = this.evWindow(now), ev = this.evt;
    if (ev.key && !ev.done && ev.end <= now) this.evSettle();
    if (!w) return;
    const key = w.E.id + w.start;
    if (w.start <= now && ev.key !== key) { this.evt = { key, id: w.E.id, end: w.end, scores: {}, done: false }; this.dirty = true; const m = `${w.E.emoji} อีเวนต์ "${w.E.name}" เริ่มแล้ว! ${w.E.mins} นาที แข่งกันที่${w.E.unit} (มือใหม่แยกอันดับ)`; this.broadcast({ t: 'msg', text: m }); this.addLog(m); this.broadcast({ t: 'evt', e: this.evPub() }); }
    else if (w.start > now && w.start - now <= 60 * 60000 && this.evWarned !== key) { this.evWarned = key; this.broadcast({ t: 'msg', text: `${w.E.emoji} อีก ${Math.ceil((w.start - now) / 60000)} นาที อีเวนต์ "${w.E.name}" จะเริ่ม! มาลานกลางเมืองกัน` }); this.broadcast({ t: 'evt', e: this.evPub() }); }
  },
  evHit(p, ev, arg) { // นับคะแนนระหว่างอีเวนต์
    const e = this.evt; if (!e.key || e.done || Date.now() > e.end) return; const E = S.EVENTS.list.find(x => x.id === e.id); if (!E || E.ev !== ev) return;
    const s = e.scores[p.key] || (e.scores[p.key] = { name: p.name, s: 0, n: 0, nb: S.playLevel(p.rec.skills) < S.EVENTS.newbieLv, seen: [] });
    s.n++; if (E.score === 'max') s.s = Math.max(s.s, +arg || 0); else if (E.score === 'distinct') { if (!s.seen.includes(arg)) { s.seen.push(arg); s.s = s.seen.length; } } else s.s++;
    this.dirty = true; this.evPushAcc = (this.evPushAcc || 0) + 1; if (this.evPushAcc % 3 === 1) this.broadcast({ t: 'evt', e: this.evPub() });
  },
  evSettle() { // จบอีเวนต์: ให้รางวัลแต่ละกลุ่ม (ทั่วไป / มือใหม่)
    const e = this.evt; e.done = true; this.dirty = true; const E = S.EVENTS.list.find(x => x.id === e.id); if (!E) return;
    const lines = [];
    for (const nb of [false, true]) {
      const rank = Object.entries(e.scores).filter(([, x]) => !!x.nb === nb && x.s > 0).sort((a, b) => b[1].s - a[1].s || b[1].n - a[1].n).slice(0, 3);
      rank.forEach(([key, x], i) => { if (!i) this.creditInv(key, S.EVENTS.prize.item, 1); const rec = this.saved[key]; if (rec) { const a = this.arcOf(rec); a.pts += S.EVENTS.prize.pts[i]; a.total += S.EVENTS.prize.pts[i]; const q = [...this.players.values()].find(o => o.key === key); if (q) { send(q, { t: 'arcpts', arc: this.arcPub(rec) }); this.toast(q, `${E.emoji} ได้อันดับ ${i + 1}${nb ? ' (มือใหม่)' : ''}! +${S.EVENTS.prize.pts[i]} แต้มตู้เกม${i ? '' : ' + 🏆 ถ้วยรางวัล'}`); } } });
      if (rank.length) lines.push((nb ? '🌱 มือใหม่: ' : '') + rank.map(([, x], i) => `${['🥇', '🥈', '🥉'][i]} ${x.name} (${x.s})`).join(' '));
    }
    const m = `${E.emoji} จบอีเวนต์ "${E.name}" ${lines.length ? lines.join(' • ') : 'ไม่มีผู้ร่วมแข่ง'}`; this.broadcast({ t: 'msg', text: m }); this.addLog(m); logEv(this.room, 'event', { id: E.id, n: Object.keys(e.scores).length });
    this.broadcast({ t: 'evt', e: this.evPub() });
  },
};
