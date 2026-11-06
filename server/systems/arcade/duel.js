'use strict';
// เกม 2 ฝ่ายในตู้เกม (XO / Connect 4): โต๊ะ ตา เสมอ/ชนะ บอท • ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../../public/shared.js'); // object เดียวกับที่ server.js โหลด

module.exports = {
  // ===================== ตู้เกม (Arcade): XO เดิมพันด้วยเหรียญ =====================
  newTable(id, c, idx) {
    return { id, idx, game: c.game, cx: c.x, cy: c.y, state: 'idle', bet: 0, host: null, guest: null, xId: null, oId: null,
      board: Array(9).fill(''), turn: 'X', deadline: 0, winner: null, line: null, msg: '', bot: false, watchers: new Set(), waitUntil: 0, resetAt: 0, botAt: 0, paid: false, g: null };
  },
  tablePub(t, vid) {
    const nm = id => (t.host && t.host.id === id ? t.host.name : t.guest && t.guest.id === id ? t.guest.name : '');
    return { id: t.id, game: t.game, state: t.state, bet: t.bet, bot: t.bot, host: t.host && { id: t.host.id, name: t.host.name }, guest: t.guest && { id: t.guest.id, name: t.guest.name },
      xId: t.xId, oId: t.oId, xName: nm(t.xId), oName: nm(t.oId), board: t.board, turn: t.turn, deadline: t.deadline, winner: t.winner, line: t.line, msg: t.msg,
      g: t.game === 'xo' || !t.g ? null : this.duelPub(t, vid) };
  },
  resetTable(t) {
    Object.assign(t, { state: 'idle', bet: 0, host: null, guest: null, xId: null, oId: null, board: Array(9).fill(''), turn: 'X', deadline: 0, winner: null, line: null, msg: '', bot: false, waitUntil: 0, resetAt: 0, botAt: 0, paid: false, g: null });
  },
  cancelWait(t, msg) {
    if (t.state !== 'waiting') return;
    if (t.bet) this.payKey(t.host, t.bet);
    const h = this.players.get(t.host.id);
    this.resetTable(t); t.msg = msg || '';
    this.pushTable(t);
    if (h) this.toast(h, msg || 'ยกเลิกห้องแล้ว คืนเหรียญให้แล้ว');
  },
  startGame(t) {
    const hostFirst = t.bot ? true : Math.random() < 0.5;
    t.xId = hostFirst ? t.host.id : t.guest.id; t.oId = hostFirst ? t.guest.id : t.host.id;
    Object.assign(t, { state: 'playing', board: Array(9).fill(''), turn: 'X', winner: null, line: null, msg: '', deadline: Date.now() + 30000, botAt: 0, paid: false, g: null });
    if (t.game !== 'xo') this.duelInit(t); // เกมอื่นที่เล่น 2 คน (เป่ายิ้งฉุบ/กดเร็ว/ป๊อก/Connect 4)
    this.pushTable(t);
  },
  checkXO(b) {
    for (const [a, c, d] of [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]) if (b[a] && b[a] === b[c] && b[a] === b[d]) return { win: b[a], line: [a, c, d] };
    return { win: null, draw: b.every(Boolean) };
  },
  finish(t, winner, line, msg) { // winner: 'X' | 'O' | 'draw'
    if (t.state !== 'playing') return;
    t.state = 'over'; t.winner = winner; t.line = line || null; t.resetAt = Date.now() + 15000; t.deadline = 0;
    const X = t.host.id === t.xId ? t.host : t.guest, O = t.host.id === t.xId ? t.guest : t.host;
    const bet = t.bet;
    if (winner === 'draw') { this.payKey(X, bet); this.payKey(O, bet); t.msg = msg || `เสมอ! คืนเหรียญ${bet ? ' 🪙 ' + bet : ''}`; }
    else {
      const W = winner === 'X' ? X : O, pot = bet * 2; let rake = Math.floor(pot * S.RAKE), got = pot - rake, capped = false; // หักค่าบริการตู้เกม 5% (ดูดเหรียญออกจากระบบ)
      if (t.bot && bet) { // เล่นกับบอท: ผู้ชนะเป็นคน → ไม่เกินโควตากำไรต่อวัน, บอทชนะ → คนเสียเดิมพัน
        const rem = this.botRemain(t.host.key);
        if (W === t.host) { if (got - bet > rem) { got = bet + rem; rake = pot - got; capped = true; } this.botNetAdd(t.host.key, got - bet); }
        else this.botNetAdd(t.host.key, -bet);
      }
      this.payKey(W, got); if (!t.bot) this.toPot(rake);
      t.msg = (msg ? `${msg} — ${W.name} ชนะ!` : `${W.name} ชนะ!`) + (bet && (!t.bot || W === t.host) ? ` ได้ 🪙 ${got}${rake ? ` (หักค่าบริการ ${rake})` : ''}${capped ? ' • ครบโควตากำไรจากบอทวันนี้' : ''}` : bet ? ` (เสียเดิมพัน 🪙 ${bet})` : '');
    }
    t.paid = true;
    if (!t.bot) { // แต้มตู้เกม: เฉพาะเล่นกับคนจริง (เสมอ = เล่น, ชนะ = เล่น+โบนัส)
      if (winner === 'draw') { this.arcAward(X.key, S.ARCPTS.play, false); this.arcAward(O.key, S.ARCPTS.play, false); }
      else { this.arcAward((winner === 'X' ? X : O).key, S.ARCPTS.play, true); this.arcAward((winner === 'X' ? O : X).key, S.ARCPTS.play, false); }
    }
    for (const side of ['X', 'O']) { // เสียงชนะ/แพ้ ให้ผู้เล่นที่ออนไลน์
      const who = side === 'X' ? X : O, q = this.players.get(who.id);
      if (q && who.key === q.key) this.sfxTo(q, winner === 'draw' ? 'draw' : winner === side ? 'win' : 'lose');
    }
    this.pushTable(t);
  },
  botMove(t) {
    const b = t.board, free = b.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
    const tryWin = s => free.find(i => { b[i] = s; const w = this.checkXO(b).win === s; b[i] = ''; return w; });
    let i = tryWin('O');
    if (i === undefined) i = tryWin('X');
    if (i === undefined && !b[4]) i = 4;
    if (i === undefined) i = free[Math.floor(Math.random() * free.length)];
    this.applyMove(t, 'O', i);
  },
  applyMove(t, side, i) {
    t.board[i] = side;
    const r = this.checkXO(t.board);
    if (r.win) return this.finish(t, side, r.line);
    if (r.draw) return this.finish(t, 'draw');
    t.turn = side === 'X' ? 'O' : 'X'; t.deadline = Date.now() + 30000;
    t.botAt = t.bot && t.turn === 'O' ? Date.now() + 700 : 0;
    this.pushTable(t);
  },
  // ===================== เกม 2 ฝ่าย: Connect 4 (XO ใช้ห้อง duel เดียวกัน) =====================
  // ใช้ห้อง/เดิมพัน/escrow/ค่าบริการ/ยอมแพ้/หลุดเกมร่วมกับ XO (ผู้เล่น X = เจ้าของห้องหรือสุ่ม, O = อีกฝ่าย) เก็บสถานะเฉพาะเกมไว้ใน t.g
  sideOf(t, id) { return id === t.xId ? 'X' : id === t.oId ? 'O' : null; },
  other(s) { return s === 'X' ? 'O' : 'X'; },
  sideName(t, s) { const id = s === 'X' ? t.xId : t.oId; return t.host && t.host.id === id ? t.host.name : t.guest ? t.guest.name : ''; },
  duelInit(t) {
    const now = Date.now();
    if (t.game === 'c4') { t.g = { board: Array(42).fill(''), turn: 'X', line: null, last: -1 }; t.deadline = now + 30000; }
  },
  duelPub(t, vid) {
    const g = t.g, side = this.sideOf(t, vid);
    if (t.game === 'c4') return { board: g.board, turn: g.turn, line: g.line, last: g.last };
    return null;
  },
  duelMove(t, p, m) {
    if (t.state !== 'playing' || !t.g) return;
    const side = this.sideOf(t, p.id), g = t.g; if (!side) return;
    if (t.game === 'c4') {
      if (g.turn !== side || !Number.isInteger(m.col) || m.col < 0 || m.col > 6) return;
      this.c4Drop(t, side, m.col);
    }
  },
  duelTick(t, now) {
    const g = t.g; if (!g) return;
    if (t.game === 'c4') {
      if (t.botAt && now >= t.botAt) { t.botAt = 0; this.c4Bot(t); }
      else if (now > t.deadline) { const loser = g.turn, pl = this.players.get(loser === 'X' ? t.xId : t.oId); this.finish(t, this.other(loser), null, `${pl ? pl.name : loser} หมดเวลา`); }
    }
  },
  // ---- Connect 4: 7 คอลัมน์ x 6 แถว เรียง 4 ตัวติดกันชนะ ----
  c4Win(b, side) {
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [];
      for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr > 5 || cc < 0 || cc > 6 || b[rr * 7 + cc] !== side) break; cells.push(rr * 7 + cc); }
      if (cells.length === 4) return cells;
    }
    return null;
  },
  c4Row(b, col) { for (let r = 5; r >= 0; r--) if (!b[r * 7 + col]) return r; return -1; },
  c4Drop(t, side, col) {
    const g = t.g, r = this.c4Row(g.board, col); if (r < 0) return;
    g.board[r * 7 + col] = side; g.last = r * 7 + col;
    const line = this.c4Win(g.board, side);
    if (line) { g.line = line; return this.finish(t, side, line); }
    if (g.board.every(Boolean)) return this.finish(t, 'draw');
    g.turn = this.other(side); t.deadline = Date.now() + 30000;
    t.botAt = t.bot && g.turn === 'O' ? Date.now() + 700 : 0;
    this.pushTable(t);
  },
  c4Bot(t) {
    const g = t.g, cols = [0, 1, 2, 3, 4, 5, 6].filter(c => this.c4Row(g.board, c) >= 0); if (!cols.length) return;
    const test = (c, s) => { const r = this.c4Row(g.board, c); g.board[r * 7 + c] = s; const w = !!this.c4Win(g.board, s); g.board[r * 7 + c] = ''; return w; };
    let pick = cols.find(c => test(c, 'O'));
    if (pick === undefined) pick = cols.find(c => test(c, 'X'));
    if (pick === undefined) pick = [...cols].sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3) + (Math.random() - 0.5))[0];
    this.c4Drop(t, 'O', pick);
  },
};
