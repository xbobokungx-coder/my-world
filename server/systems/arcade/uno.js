'use strict';
// ระบบ UNO ในตู้เกม (2-4 คน เดิมพันเหรียญ มีบอท): ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../../public/shared.js'); // object เดียวกับที่ server.js โหลด

module.exports = {
  // ===================== UNO (2-4 คน, เดิมพันด้วยเหรียญ, มีบอท) =====================
  // การ์ด = ตัวอักษรสี (R Y G B หรือ W=ไวลด์) + ค่า (0-9, S=ข้าม, R=กลับทิศ, D=+2, W=เปลี่ยนสี, F=+4 เปลี่ยนสี)
  newUnoTable(id, c, idx) {
    return Object.assign({ id, idx, game: 'uno', cx: c.x, cy: c.y, watchers: new Set() }, this.unoBlank());
  },
  unoBlank() {
    return { state: 'idle', bet: 0, max: 2, players: [], cur: 0, dir: 1, top: '', color: '', deck: [], discard: [], deadline: 0, drawn: -1,
      winner: '', msg: '', log: '', waitUntil: 0, resetAt: 0, botAt: 0, bot: false };
  },
  resetUno(t) { Object.assign(t, this.unoBlank()); },
  unoPub(t, vid) {
    const me = t.players.find(q => q.id === vid), curP = t.state === 'playing' ? t.players[t.cur] : null;
    return { id: t.id, game: 'uno', state: t.state, bet: t.bet, max: t.max, bot: t.bot, hostId: t.players[0] ? t.players[0].id : 0,
      players: t.players.map(q => ({ id: q.id, name: q.name, n: q.hand.length, out: q.out, bot: q.bot })),
      cur: curP ? curP.id : 0, top: t.top, color: t.color, dir: t.dir, deadline: t.deadline,
      hand: me ? me.hand : null, drawn: me && curP === me ? t.drawn : -1, winner: t.winner, msg: t.msg, log: t.log };
  },
  unoShuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  unoDeck() {
    const d = [];
    for (const c of 'RYGB') { d.push(c + '0'); for (let v = 1; v <= 9; v++) d.push(c + v, c + v); for (const s of 'SRD') d.push(c + s, c + s); }
    for (let i = 0; i < 4; i++) d.push('WW', 'WF');
    return this.unoShuffle(d);
  },
  unoName(c) { const col = { R: 'แดง', Y: 'เหลือง', G: 'เขียว', B: 'น้ำเงิน' }; return c[0] === 'W' ? (c[1] === 'F' ? 'Wild +4' : 'Wild') : `${col[c[0]]} ${c[1] === 'S' ? 'ข้าม' : c[1] === 'R' ? 'กลับทิศ' : c[1] === 'D' ? '+2' : c[1]}`; },
  unoDraw(t, q, n) {
    for (let i = 0; i < n; i++) {
      if (!t.deck.length) { // สับกองทิ้งกลับมาเป็นกองจั่ว (เหลือใบบนสุดไว้)
        if (t.discard.length <= 1) break;
        const top = t.discard.pop(); t.deck = this.unoShuffle(t.discard); t.discard = [top];
      }
      q.hand.push(t.deck.pop());
    }
  },
  unoPlayable(t, c) { return c[0] === 'W' || c[0] === t.color || (t.top[0] !== 'W' && c[1] === t.top[1]); },
  unoNext(t, from, steps) {
    const n = t.players.length; let i = from;
    for (let s = 0; s < steps; s++) { do { i = (i + t.dir + n) % n; } while (t.players[i].out); }
    return i;
  },
  unoActive(t) { return t.players.filter(q => !q.out); },
  unoStart(t) {
    const now = Date.now();
    t.deck = this.unoDeck(); t.discard = [];
    for (const q of t.players) { q.hand = []; q.out = false; q.tmo = 0; this.unoDraw(t, q, 7); }
    let k = t.deck.length - 1; while (k > 0 && !/^[RYGB]\d$/.test(t.deck[k])) k--; // ใบเปิดต้องเป็นเลข
    t.top = t.deck.splice(k, 1)[0]; t.discard = [t.top]; t.color = t.top[0];
    Object.assign(t, { state: 'playing', cur: 0, dir: 1, drawn: -1, winner: '', msg: '', log: `เริ่มเกม! ใบเปิด: ${this.unoName(t.top)}`, deadline: now + 30000 });
    t.botAt = t.players[0].bot ? now + 900 : 0;
    this.pushTable(t);
  },
  unoAdvance(t, skip) {
    const now = Date.now();
    t.cur = this.unoNext(t, t.cur, 1 + (skip || 0)); t.drawn = -1; t.deadline = now + 30000;
    t.botAt = t.players[t.cur].bot ? now + 900 : 0;
    this.pushTable(t);
  },
  unoFinish(t, w) {
    const humans = t.players.filter(q => !q.bot), seats = t.bot ? t.players.length : humans.length, gross = t.bet * seats; let rake = Math.floor(gross * S.RAKE), pot = gross - rake; // เล่นกับบอท: บอททุกที่นั่งวางเดิมพันเท่าคน (เงินบ้าน)
    if (t.bot && t.bet && humans[0]) { const hk = humans[0].key; if (w === humans[0]) { const rem = this.botRemain(hk); if (pot - t.bet > rem) { pot = t.bet + rem; rake = gross - pot; } this.botNetAdd(hk, pot - t.bet); } else this.botNetAdd(hk, -t.bet); }
    Object.assign(t, { state: 'over', winner: w.name, resetAt: Date.now() + 20000, deadline: 0, botAt: 0 });
    if (!w.bot) this.payKey(w, pot);
    if (!t.bot) this.toPot(rake);
    t.msg = `${w.name} ชนะ!` + (pot ? ` ได้ 🪙 ${pot}${rake ? ` (หักค่าบริการ ${rake})` : ''}` : '');
    for (const q of humans) { const o = this.players.get(q.id); if (o && o.key === q.key) this.sfxTo(o, q === w ? 'win' : 'lose'); }
    if (!t.bot) for (const q of humans) this.arcAward(q.key, S.ARCPTS.play, q === w); // แต้มตู้เกม: เฉพาะเล่นกับคนจริง
    this.pushTable(t);
  },
  unoPlay(t, q, i, color) {
    const card = q.hand.splice(i, 1)[0];
    t.discard.push(card); t.top = card; t.color = card[0] === 'W' ? color : card[0]; q.tmo = 0;
    t.log = `${q.name} ลง ${this.unoName(card)}${card[0] === 'W' ? ' → ' + ({ R: 'แดง', Y: 'เหลือง', G: 'เขียว', B: 'น้ำเงิน' })[color] : ''}`;
    if (!q.hand.length) return this.unoFinish(t, q);
    let skip = 0; const act = card[1];
    if (act === 'S') skip = 1;
    else if (act === 'R') { if (this.unoActive(t).length === 2) skip = 1; else t.dir *= -1; }
    else if (act === 'D' || act === 'F') {
      const nx = t.players[this.unoNext(t, t.cur, 1)], n = act === 'D' ? 2 : 4;
      this.unoDraw(t, nx, n); skip = 1; t.log += ` • ${nx.name} จั่ว ${n} ใบ`;
    }
    this.unoAdvance(t, skip);
  },
  unoDrawTurn(t, q) { // จั่ว 1 ใบ: ถ้าลงได้ให้เลือกลง/ผ่าน ถ้าลงไม่ได้ข้ามตาเลย
    this.unoDraw(t, q, 1);
    const c = q.hand[q.hand.length - 1];
    t.log = `${q.name} จั่วไพ่`;
    if (c && this.unoPlayable(t, c)) { t.drawn = q.hand.length - 1; t.deadline = Date.now() + 30000; this.pushTable(t); }
    else this.unoAdvance(t, 0);
  },
  unoEliminate(t, q, why) {
    if (q.out) return;
    q.out = true; t.deck.unshift(...q.hand); q.hand = [];
    t.log = `${q.name} ${why}`;
    const left = this.unoActive(t);
    if (left.length <= 1) return left[0] ? this.unoFinish(t, left[0]) : this.pushTable(t);
    if (t.players[t.cur] === q) this.unoAdvance(t, 0); else this.pushTable(t);
  },
  unoBotMove(t) {
    const q = t.players[t.cur]; if (!q || !q.bot) return;
    const pick = () => {
      const ok = q.hand.map((c, i) => [c, i]).filter(([c]) => this.unoPlayable(t, c));
      return ok.find(([c]) => c[0] !== 'W') || ok[0];
    };
    const play = ([c, i]) => {
      const cnt = { R: 0, Y: 0, G: 0, B: 0 }; for (const x of q.hand) if (x[0] !== 'W') cnt[x[0]]++;
      const color = c[0] === 'W' ? Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] : '';
      this.unoPlay(t, q, i, color);
    };
    let m = pick();
    if (m) return play(m);
    this.unoDraw(t, q, 1); t.log = `${q.name} จั่วไพ่`;
    m = pick();
    if (m && m[1] === q.hand.length - 1) return play(m);
    this.unoAdvance(t, 0);
  },
  unoRefundAll(t, msg) {
    if (t.bet) for (const q of t.players) if (!q.bot) this.payKey(q, t.bet);
    const ids = t.players.filter(q => !q.bot).map(q => q.id);
    this.resetUno(t); t.msg = msg || '';
    this.pushTable(t);
    for (const id of ids) { const h = this.players.get(id); if (h) this.toast(h, msg || 'ยกเลิกห้องแล้ว คืนเหรียญให้แล้ว'); }
  },
  unoHandle(p, m, t) {
    const coin = p.rec.inv.coin || 0, now = Date.now();
    const mine = t.players.find(q => q.id === p.id);
    const mkp = () => ({ id: p.id, name: p.name, key: p.key, hand: [], out: false, bot: false, tmo: 0 });
    switch (m.a) {
      case 'close': t.watchers.delete(p.id); break;
      case 'create': case 'bot': {
        if (t.state !== 'idle' && t.state !== 'over') return this.toast(p, 'โต๊ะนี้ไม่ว่าง');
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        const bot = m.a === 'bot', max = bot ? 2 : 12; // ไม่จำกัดจำนวนคน (host กดเริ่มเองเมื่อ ≥2); 12 เป็นเพดานกันสำรับ 108 ใบหมดตอนแจก 7 ใบ/คน; บอท = เล่น 1 ต่อ 1
        const bet = bot ? this.botBetOf(p, m.bet) : (S.BETS.includes(m.bet | 0) ? m.bet | 0 : 0);
        if (bet < 0) return;
        if (coin < bet) return this.toast(p, 'เหรียญไม่พอสำหรับเดิมพันนี้');
        this.resetUno(t);
        if (bet) this.add(p, 'coin', -bet, 'arcade'); // กันเหรียญเดิมพันไว้ (escrow) จนจบเกม
        t.bet = bet; t.max = max; t.bot = bot; t.players = [mkp()]; t.watchers.add(p.id);
        if (bot) { for (let i = 1; i < max; i++) t.players.push({ id: -i, name: `บอท ${i} 🤖`, key: '', hand: [], out: false, bot: true, tmo: 0 }); this.unoStart(t); }
        else { t.state = 'waiting'; t.waitUntil = now + 180000; this.pushTable(t, p.id); }
        break;
      }
      case 'join': {
        if (t.state !== 'waiting' || mine || t.players.length >= t.max) return;
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        if (coin < t.bet) return this.toast(p, 'เหรียญไม่พอสำหรับเดิมพันนี้');
        if (t.bet) this.add(p, 'coin', -t.bet, 'arcade');
        t.players.push(mkp()); t.watchers.add(p.id);
        if (t.players.length >= t.max) this.unoStart(t); else this.pushTable(t);
        break;
      }
      case 'leave': {
        if (t.state !== 'waiting' || !mine || t.players[0] === mine) return;
        if (t.bet) this.payKey(mine, t.bet);
        t.players = t.players.filter(q => q !== mine); this.pushTable(t);
        break;
      }
      case 'cancel': if (t.state === 'waiting' && t.players[0] && t.players[0].id === p.id) this.unoRefundAll(t); break;
      case 'startnow': {
        if (t.state !== 'waiting' || !t.players[0] || t.players[0].id !== p.id || t.players.length < 2) return;
        t.max = t.players.length; this.unoStart(t);
        break;
      }
      case 'play': case 'draw': case 'pass': {
        if (t.state !== 'playing' || !mine || t.players[t.cur] !== mine) return;
        if (m.a === 'draw') { if (t.drawn === -1) this.unoDrawTurn(t, mine); return; }
        if (m.a === 'pass') { if (t.drawn >= 0) this.unoAdvance(t, 0); return; }
        const i = m.i;
        if (!Number.isInteger(i) || i < 0 || i >= mine.hand.length) return;
        if (t.drawn >= 0 && i !== t.drawn) return;
        const c = mine.hand[i];
        if (!this.unoPlayable(t, c)) return;
        if (c[0] === 'W' && !'RYGB'.includes(String(m.color)) ) return;
        this.unoPlay(t, mine, i, c[0] === 'W' ? m.color : '');
        break;
      }
      case 'resign': if (t.state === 'playing' && mine && !mine.out) this.unoEliminate(t, mine, 'ยอมแพ้'); break;
    }
  },
  unoLeave(p, t) {
    const mine = t.players.find(q => q.id === p.id);
    if (!mine) return;
    if (t.state === 'waiting') {
      if (t.players[0] === mine) this.unoRefundAll(t, `${p.name} ออกจากเกม ยกเลิกห้อง`);
      else { if (t.bet) this.payKey(mine, t.bet); t.players = t.players.filter(q => q !== mine); this.pushTable(t); }
    } else if (t.state === 'playing') this.unoEliminate(t, mine, 'ออกจากเกม');
  },
  unoTick(t, now) {
    if (t.state === 'waiting' && now > t.waitUntil) return this.unoRefundAll(t, 'หมดเวลารอผู้เล่น คืนเหรียญให้แล้ว');
    if (t.state === 'over' && now > t.resetAt) { this.resetUno(t); this.pushTable(t); return; }
    if (t.state !== 'playing') return;
    if (t.botAt && now >= t.botAt) { t.botAt = 0; this.unoBotMove(t); return; }
    if (now > t.deadline) { // หมดเวลา: จั่วแล้วผ่านอัตโนมัติ ถ้าหมดเวลา 3 ครั้งติดจะถูกตัดออก
      const q = t.players[t.cur]; if (!q || q.bot) return;
      q.tmo = (q.tmo || 0) + 1;
      if (q.tmo >= 3) return this.unoEliminate(t, q, 'หมดเวลาหลายครั้ง ถูกตัดออก');
      if (t.drawn >= 0) { t.log = `${q.name} หมดเวลา`; this.unoAdvance(t, 0); }
      else { this.unoDraw(t, q, 1); t.log = `${q.name} หมดเวลา จั่วไพ่`; this.unoAdvance(t, 0); }
    }
  },
};
