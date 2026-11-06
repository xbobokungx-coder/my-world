'use strict';
// ชาเลนจ์ถังน้ำ: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const crypto = require('crypto');
const S = require('../../public/shared.js');
const { send } = require('../util.js');

module.exports = {
  // ----- ชาเลนจ์ถังน้ำ 🪣 (S.CHALLENGE) -----
  chDef(id) { return S.CHALLENGE.list.find(c => c.id === id); },
  chPub(rec) { const c = rec.ch; return { ch: c ? { id: c.id, st: c.st, n: c.n || 0, end: c.end || 0, by: c.byName || '', code: c.code || '', ms: c.ms || 0 } : null, wet: rec.wet > Date.now() ? rec.wet : 0, chain: this.chain }; },
  chPush(p) { send(p, Object.assign({ t: 'ch' }, this.chPub(p.rec))); },
  chStart(p) {
    const rec = p.rec, c = rec.ch, now = Date.now();
    if (c && c.st === 'run') return this.toast(p, 'กำลังทำชาเลนจ์อยู่');
    if (c && c.st === 'pending') { c.st = 'run'; c.start = now; c.end = now + S.CHALLENGE.ms; c.n = 0; }
    else { if (rec.chAt && now - rec.chAt < S.CHALLENGE.retryMs) return this.toast(p, `รับชาเลนจ์ใหม่ได้อีกครั้งใน ${Math.ceil((S.CHALLENGE.retryMs - (now - rec.chAt)) / 60000)} นาที`);
      const d = S.CHALLENGE.list[Math.floor(Math.random() * S.CHALLENGE.list.length)]; rec.ch = { id: d.id, st: 'run', start: now, end: now + S.CHALLENGE.ms, n: 0 }; }
    rec.chAt = now; this.dirty = true; const d = this.chDef(rec.ch.id);
    this.toast(p, `🪣 เริ่มชาเลนจ์! ${d.emoji} ${d.text} ภายใน ${Math.round(S.CHALLENGE.ms / 60000)} นาที`); this.chPush(p);
  },
  chEvent(p, ev) {
    const c = p.rec.ch; if (!c || c.st !== 'run') return; const d = this.chDef(c.id); if (!d || d.ev !== ev) return;
    if (Date.now() > c.end) return this.chExpire(p);
    c.n = (c.n || 0) + 1; this.dirty = true;
    if (c.n < d.goal) return this.chPush(p);
    c.st = 'won'; c.ms = Date.now() - c.start; this.chain++; delete p.rec.wet;
    let code; do { code = crypto.randomBytes(4).toString('hex'); } while (this.invites[code]);
    this.invites[code] = { by: p.key, name: p.name, ch: c.id, t: Date.now() }; c.code = code;
    for (const [k, v] of Object.entries(this.invites)) if (Date.now() - v.t > 7 * 864e5) delete this.invites[k]; // ลิงก์ใช้ได้ 7 วัน
    this.toast(p, `🎉 ชาเลนจ์ถังน้ำสำเร็จใน ${Math.ceil(c.ms / 60000)} นาที! แชร์การ์ดแล้วท้าเพื่อนต่อได้เลย`); this.sfxTo(p, 'levelup');
    this.addLog(`🪣 ${p.name} ทำชาเลนจ์ถังน้ำ "${d.text}" สำเร็จ! (ต้นไม้แห่งการส่งต่อ ${this.chain} ใบ)`);
    this.broadcast({ t: 'chain', n: this.chain }); this.chPush(p);
  },
  chExpire(p) { // หมดเวลา: คนที่ถูกเพื่อนท้ามาแล้วทำไม่ทัน = โดนราดน้ำ • รับเองแล้วไม่ทันแค่จบไป
    const c = p.rec.ch; if (!c) return; const d = this.chDef(c.id);
    if (c.by) { p.rec.wet = Date.now() + S.CHALLENGE.wetMs; this.broadcast({ t: 'wet', id: p.id, on: 1 }); this.addLog(`💦 ${p.name} ทำชาเลนจ์ที่ ${c.byName} ท้าไม่ทัน โดนราดน้ำ!`); this.toast(p, `💦 ไม่ทันเวลา! โดนราดน้ำ 🪣 (ตัวเปียก ${Math.round(S.CHALLENGE.wetMs / 3600e3)} ชม. ไถ่โทษได้ด้วยการจ่ายเหรียญ 🪙${S.CHALLENGE.redeem})`); }
    else this.toast(p, `⏰ ชาเลนจ์ "${d ? d.text : ''}" หมดเวลา ลองใหม่ได้ภายหลัง`);
    p.rec.ch = null; this.dirty = true; this.chPush(p);
  },
  chTick() { const now = Date.now(); for (const p of this.players.values()) { const c = p.rec.ch; if (c && ((c.st === 'run' && now > c.end) || (c.st === 'pending' && now > c.deadline))) this.chExpire(p); } },
  chRedeem(p) {
    if (!(p.rec.wet > Date.now())) return; if ((p.rec.inv.coin || 0) < S.CHALLENGE.redeem) return this.toast(p, 'เหรียญไม่พอ');
    this.add(p, 'coin', -S.CHALLENGE.redeem, 'donate'); this.toPot(S.CHALLENGE.redeem); delete p.rec.wet; this.dirty = true;
    this.broadcast({ t: 'wet', id: p.id, on: 0 }); this.toast(p, '🌞 ไถ่โทษแล้ว ตัวแห้งแล้ว!'); this.chPush(p);
  },
  chJoinInvite(p, code, ip) { // เข้าเกมผ่านลิงก์ท้า: ได้ชาเลนจ์เดียวกับคนท้า มีเวลา 48 ชม.
    const inv = typeof code === 'string' && this.invites[code]; if (!inv || inv.by === p.key || (p.rec.ch && p.rec.ch.st === 'run')) return;
    const by = this.saved[inv.by]; if (by && (by.ips || []).some(x => x.ip === ip)) return; // เครื่องเดียวกับคนท้า ไม่นับ
    p.rec.ch = { id: inv.ch, st: 'pending', by: inv.by, byName: inv.name, deadline: Date.now() + S.CHALLENGE.inviteMs, n: 0 }; if (p.rec.joins === 1) p.rec.invBy = inv.by; this.dirty = true;
    const d = this.chDef(inv.ch); setTimeout(() => { if (p.ws.readyState === 1) { this.toast(p, `🪣 ${inv.name} ท้าคุณ! "${d.text}" ภายใน 15 นาที (เริ่มเมื่อไหร่ก็ได้ใน 48 ชม.) ไม่งั้นโดนราดน้ำ 💦 • ดูที่ 📋 เควส → 🪣`); this.chPush(p); } }, 4000);
  },
};
