'use strict';
// ระบบโรงหนังกลางแปลง: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { TS } = S;
const { send } = require('../util.js');
const EMPTY_MS = +process.env.CIN_EMPTY_MS || 20000; // ไว้ทดสอบเท่านั้น: เวลารอปิดโรงหนังตอนไม่มีคนดู

module.exports = {
  // ---------- โรงหนังกลางแปลง: ฉายหนังเรื่องเดียวกันให้ทุกคนที่เข้าไปดู (ฝั่งผู้ชมเท่านั้นที่ได้ยินเสียง เพราะเสียงมาจากหน้าต่างหนังของตัวเอง) ----------
  cinemaPos(now) { const c = this.cinema; return c.playing ? c.pos + (now - c.ref) / 1000 : c.pos; },
  cinemaPub() { const c = this.cinema, now = Date.now(); return { movie: c.movie, yt: c.yt, name: c.name, startedAt: c.startedAt, playing: c.playing, pos: this.cinemaPos(now), now, viewers: [...c.viewers] }; },
  cinemaBroadcast(extra) { this.broadcast(Object.assign({ t: 'cin', st: this.cinemaPub() }, extra)); },
  cinemaEnd(msg) { const c = this.cinema; c.movie = null; c.yt = ''; c.name = ''; c.playing = false; c.viewers = new Set(); c.paid = new Set(); this.broadcast({ t: 'msg', text: msg || '🎬 หนังจบแล้ว ขอบคุณที่มาดูนะ' }); this.cinemaBroadcast(); },
  cinemaHandle(p, m) {
    const c = this.cinema, now = Date.now();
    if (m.a === 'sync') { // ผู้ชมคนไหนกด เล่น/หยุด/เลื่อน ทุกคนในโรงจะตามทันที
      if (!c.movie || !c.viewers.has(p.id) || now - (c.lastSync || 0) < 150) return;
      const pos = +m.pos; if (!isFinite(pos)) return;
      c.lastSync = now; c.pos = Math.max(0, Math.min(86400, pos)); c.ref = now; c.playing = !!m.playing;
      this.cinemaBroadcast({ sync: true, by: p.id }); return;
    }
    if (m.a === 'end') { if (c.movie && c.viewers.has(p.id) && this.cinemaPos(now) > 5) this.cinemaEnd(); return; }
    if (Math.hypot(p.x - S.CINEMA_CENTER.x, p.y - S.CINEMA_CENTER.y) > 12 * TS) return this.toast(p, 'เดินเข้าไปใกล้จอหนังอีกนิด');
    const payTicket = () => { if ((p.rec.inv.coin || 0) < S.TICKET) { this.toast(p, `เหรียญไม่พอซื้อตั๋ว (🪙 ${S.TICKET})`); return false; } this.add(p, 'coin', -S.TICKET); c.paid.add(p.key); this.toast(p, `🎟️ ซื้อตั๋วหนัง -🪙 ${S.TICKET}`); this.sfxTo(p, 'coin'); return true; };
    if (m.a === 'play') {
      if (c.movie) return this.toast(p, 'กำลังฉายเรื่องอื่นอยู่ รอให้จบก่อนนะ');
      let yt = '', name = '', id = 'custom';
      const mv = S.MOVIES.find(x => x.id === m.id);
      if (mv) { yt = mv.yt; name = mv.name; id = mv.id; }
      else { const u = String(m.url || '').trim(), g = /(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/.exec(u) || /^([A-Za-z0-9_-]{11})$/.exec(u); if (!g) return this.toast(p, 'ลิงก์ไม่ถูกต้อง ใช้ลิงก์ YouTube เท่านั้นนะ'); yt = g[1]; name = 'วิดีโอจากลิงก์ YouTube'; }
      c.paid = new Set(); if (!payTicket()) return;
      Object.assign(c, { movie: id, yt, name, startedAt: now, pos: 0, ref: now, playing: true, emptyAt: 0 }); c.viewers = new Set([p.id]);
      this.broadcast({ t: 'msg', text: `🎬 ${p.name} เปิดฉาย "${name}" ที่โรงหนังกลางแปลง! ไปดูกันได้ (ตั๋ว 🪙 ${S.TICKET})` });
      send(p, { t: 'cin', watch: true, st: this.cinemaPub() }); this.cinemaBroadcast();
    } else if (m.a === 'watch') {
      if (!c.movie) return;
      if (!c.paid.has(p.key) && !payTicket()) return;
      c.viewers.add(p.id); c.emptyAt = 0; send(p, { t: 'cin', watch: true, st: this.cinemaPub() }); this.cinemaBroadcast();
    } else if (m.a === 'leave') { if (c.viewers.delete(p.id)) this.cinemaBroadcast(); }
  },
  cinemaTick(now) {
    const c = this.cinema; if (!c.movie) return;
    const mv = S.MOVIES.find(x => x.id === c.movie);
    if (mv && this.cinemaPos(now) > mv.sec + 3) return this.cinemaEnd();
    if (!c.viewers.size) { if (!c.emptyAt) c.emptyAt = now; else if (now - c.emptyAt > EMPTY_MS) this.cinemaEnd('🎬 ไม่มีคนดูแล้ว ปิดโรงหนัง'); } else c.emptyAt = 0; // ไม่มีผู้ชมนานเกินไปก็ปิดรอบ
  },
};
