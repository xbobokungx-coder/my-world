'use strict';
// เกมหลายคนในตู้เกม (ไพ่ป๊อกเด้ง / ใครกดเร็วกว่า / เป่ายิ้งฉุบ): ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../../public/shared.js'); // object เดียวกับที่ server.js โหลด

module.exports = {
  // ===================== เกมหลายคน (ห้องแบบ UNO): ไพ่ป๊อก / ใครกดเร็วกว่า / เป่ายิ้งฉุบ =====================
  // 2–8 คน (เจ้าของห้องกดเริ่มเมื่อ ≥2) • เล่นคนเดียวกับบอทได้ • เติมบอทเข้าห้องได้ (เฉพาะห้องไม่เดิมพัน) • ผู้ชนะหาร pot (หักค่าบริการ) เสมอ = หารเท่ากัน
  // XO / Connect 4 ยังเป็นเกม 2 ฝ่าย (กระดานเล่นได้แค่ 2 คน) ใช้ห้อง duel เดิม
  partyBlank() { return { state: 'idle', bet: 0, max: 8, players: [], bot: false, deadline: 0, winner: '', winners: [], msg: '', waitUntil: 0, resetAt: 0, botAt: 0, g: null }; },
  newPartyTable(id, c, idx) { return Object.assign({ id, idx, game: c.game, cx: c.x, cy: c.y, watchers: new Set() }, this.partyBlank()); },
  resetParty(t) { Object.assign(t, this.partyBlank()); },
  partyPub(t, vid) {
    const g = t.g, me = t.players.find(q => q.id === vid);
    const o = { id: t.id, game: t.game, state: t.state, bet: t.bet, max: t.max, bot: t.bot, hostId: t.players[0] ? t.players[0].id : 0,
      players: t.players.map(q => ({ id: q.id, name: q.name, bot: q.bot, out: q.out, score: q.score || 0, done: !!(q.dec || q.pick) })),
      deadline: t.deadline, winner: t.winner, winners: t.winners, msg: t.msg, g: null };
    if (g) {
      if (t.game === 'pok') o.g = { phase: g.phase, msg: g.msg, mine: me ? me.hand : null, reveal: g.reveal ? t.players.map(q => ({ id: q.id, hand: q.hand, pts: this.pokPts(q.hand), pok: this.pokIs(q), deng: this.pokDeng(q.hand) })) : null };
      else if (t.game === 'react') o.g = { phase: g.phase, msg: g.msg, round: g.round, target: g.target, fs: me ? !!me.fs : false };
      else o.g = { phase: g.phase, msg: g.msg, round: g.round, target: g.target, mine: me ? me.pick : '', reveal: g.reveal };
    }
    return o;
  },
  partyHandle(p, m, t) {
    const coin = p.rec.inv.coin || 0, now = Date.now(), mine = t.players.find(q => q.id === p.id);
    const blank = { hand: [], dec: '', pick: '', score: 0, out: false, fs: false };
    const mkp = () => Object.assign({ id: p.id, name: p.name, key: p.key, bot: false }, blank, { hand: [] });
    const botP = i => Object.assign({ id: -i, name: `บอท ${i} 🤖`, key: '', bot: true }, blank, { hand: [] });
    switch (m.a) {
      case 'close': t.watchers.delete(p.id); break;
      case 'create': case 'bot': {
        if (t.state !== 'idle' && t.state !== 'over') return this.toast(p, 'โต๊ะนี้ไม่ว่าง');
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        const bot = m.a === 'bot', bet = bot ? this.botBetOf(p, m.bet) : (S.BETS.includes(m.bet | 0) ? m.bet | 0 : 0);
        if (bet < 0) return;
        if (coin < bet) return this.toast(p, 'เหรียญไม่พอสำหรับเดิมพันนี้');
        this.resetParty(t);
        if (bet) this.add(p, 'coin', -bet, 'arcade'); // กันเหรียญเดิมพันไว้ (escrow) จนจบเกม
        t.bet = bet; t.bot = bot; t.players = [mkp()]; t.watchers.add(p.id);
        if (bot) { for (let i = 1; i <= (t.game === 'pok' ? 3 : 2); i++) t.players.push(botP(i)); this.partyStart(t); } // เล่นคนเดียว: ป๊อกเจอบอท 3 ตัว ที่เหลือ 2 ตัว
        else { t.state = 'waiting'; t.waitUntil = now + 180000; this.pushTable(t, p.id); }
        break;
      }
      case 'join': {
        if (t.state !== 'waiting' || mine || t.players.length >= t.max) return;
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        if (coin < t.bet) return this.toast(p, 'เหรียญไม่พอสำหรับเดิมพันนี้');
        if (t.bet) this.add(p, 'coin', -t.bet, 'arcade');
        t.players.push(mkp()); t.watchers.add(p.id);
        if (t.players.length >= t.max) this.partyStart(t); else this.pushTable(t);
        break;
      }
      case 'addbot': { // เติมบอทเข้าห้องรอ (เฉพาะห้องที่ไม่เดิมพัน — กันเอาเหรียญเดิมพันไปเล่นกับบอท)
        if (t.state !== 'waiting' || !mine || t.players[0] !== mine || t.bet || t.players.length >= t.max) return;
        const n = t.players.filter(q => q.bot).length + 1; t.players.push(botP(n)); this.pushTable(t);
        break;
      }
      case 'leave': {
        if (t.state !== 'waiting' || !mine || t.players[0] === mine) return;
        if (t.bet) this.payKey(mine, t.bet);
        t.players = t.players.filter(q => q !== mine); this.pushTable(t);
        break;
      }
      case 'cancel': if (t.state === 'waiting' && t.players[0] && t.players[0].id === p.id) this.partyRefundAll(t); break;
      case 'startnow': {
        if (t.state !== 'waiting' || !t.players[0] || t.players[0].id !== p.id || t.players.length < 2) return;
        this.partyStart(t);
        break;
      }
      case 'move': if (t.state === 'playing' && mine && !mine.out) this.partyMove(t, mine, m); break;
      case 'resign': if (t.state === 'playing' && mine && !mine.out) this.partyOut(t, mine, 'ยอมแพ้'); break;
    }
  },
  partyStart(t) {
    for (const q of t.players) Object.assign(q, { hand: [], dec: '', pick: '', score: 0, out: false, fs: false });
    Object.assign(t, { state: 'playing', winner: '', winners: [], msg: '', botAt: 0, deadline: 0 });
    if (t.game === 'pok') this.pokStart(t);
    else if (t.game === 'react') { t.g = { phase: 'wait', round: 0, target: 2, goAt: 0, goTs: 0, next: 0, msg: '', botAt: {} }; this.reactStart(t); }
    else { t.g = { phase: 'pick', round: 0, rounds: 0, target: 2, reveal: null, next: 0, msg: '' }; this.rpsRound(t); }
  },
  partyMove(t, q, m) {
    if (t.game === 'pok') {
      const g = t.g; if (g.phase !== 'decide' || q.dec || !['draw', 'stay'].includes(m.c)) return;
      q.dec = m.c;
      if (t.players.filter(x => !x.out).every(x => x.dec)) this.pokResolve(t); else this.pushTable(t);
    } else if (t.game === 'react') this.reactPress(t, q);
    else {
      const g = t.g; if (g.phase !== 'pick' || q.pick || typeof m.c !== 'string' || m.c.length !== 1 || !'RPS'.includes(m.c)) return;
      q.pick = m.c;
      if (t.players.filter(x => !x.out).every(x => x.pick)) this.rpsReveal(t); else this.pushTable(t);
    }
  },
  // ผู้เล่นออก/ยอมแพ้ระหว่างเล่น: เดิมพันเขายังอยู่ใน pot, เขาไม่มีสิทธิ์ชนะ; เหลือคนเดียว (หรือเหลือแต่บอท) = จบเกม
  partyOut(t, q, why) {
    q.out = true; if (!q.dec) q.dec = 'stay'; if (!q.pick) q.pick = 'x';
    const el = t.players.filter(x => !x.out);
    if (el.length <= 1 || el.every(x => x.bot)) return this.partyFinish(t, el.length === 1 ? el : [], `${q.name} ${why}`);
    const g = t.g;
    if (t.game === 'pok' && g.phase === 'decide' && el.every(x => x.dec)) this.pokResolve(t);
    else if (t.game === 'rps' && g.phase === 'pick' && el.every(x => x.pick)) this.rpsReveal(t);
    else this.pushTable(t);
  },
  partyFinish(t, ws, desc) {
    if (t.state !== 'playing') return;
    const humans = t.players.filter(q => !q.bot), hw = ws.filter(q => !q.bot);
    const seats = t.bot ? t.players.length : humans.length, gross = t.bet * seats; let rake = Math.floor(gross * S.RAKE), pot = gross - rake; // เล่นกับบอท: บอทวางเดิมพันเท่าคน (เหรียญฝั่งบอทมาจากบ้าน)
    if (t.bot && t.bet && humans[0]) { const hk = humans[0].key; if (hw.length) { const rem = this.botRemain(hk); if (pot - t.bet > rem) { pot = t.bet + rem; rake = gross - pot; } this.botNetAdd(hk, pot - t.bet); } else this.botNetAdd(hk, -t.bet); }
    const share = hw.length ? Math.floor(pot / ws.length) : 0;
    for (const q of hw) this.payKey(q, share);
    if (!t.bot) this.toPot(rake);
    const names = ws.map(q => q.name).join(', ');
    Object.assign(t, { state: 'over', winners: ws.map(q => q.id), winner: names, resetAt: Date.now() + 20000, deadline: 0, botAt: 0 });
    t.msg = (ws.length > 1 ? `เสมอ! ${names} ร่วมชนะ` : ws.length ? `${names} ชนะ!` : 'ไม่มีผู้ชนะ') + (desc ? ` — ${desc}` : '') + (share ? ` ได้ 🪙 ${share}${rake ? ` (หักค่าบริการ ${rake})` : ''}` : '');
    for (const q of humans) { const o = this.players.get(q.id); if (o && o.key === q.key) this.sfxTo(o, ws.includes(q) ? 'win' : 'lose'); }
    if (!t.players.some(q => q.bot)) for (const q of humans) if (!q.out) this.arcAward(q.key, S.ARCPTS.play, ws.length === 1 && ws[0] === q); // แต้มตู้เกม: เฉพาะโต๊ะที่เล่นกับคนจริงล้วน (ไม่นับคนที่ออกกลางคัน)
    this.pushTable(t);
  },
  partyRefundAll(t, msg) {
    if (t.bet) for (const q of t.players) if (!q.bot) this.payKey(q, t.bet);
    const ids = t.players.filter(q => !q.bot).map(q => q.id);
    this.resetParty(t); t.msg = msg || '';
    this.pushTable(t);
    for (const id of ids) { const h = this.players.get(id); if (h) this.toast(h, msg || 'ยกเลิกห้องแล้ว คืนเหรียญให้แล้ว'); }
  },
  partyLeave(p, t) {
    const mine = t.players.find(q => q.id === p.id);
    if (!mine) return;
    if (t.state === 'waiting') {
      if (t.players[0] === mine) this.partyRefundAll(t, `${p.name} ออกจากเกม ยกเลิกห้อง`);
      else { if (t.bet) this.payKey(mine, t.bet); t.players = t.players.filter(q => q !== mine); this.pushTable(t); }
    } else if (t.state === 'playing' && !mine.out) this.partyOut(t, mine, 'ออกจากเกม');
  },
  partyTick(t, now) {
    if (t.state === 'waiting' && now > t.waitUntil) return this.partyRefundAll(t, 'หมดเวลารอผู้เล่น คืนเหรียญให้แล้ว');
    if (t.state === 'over' && now > t.resetAt) { this.resetParty(t); this.pushTable(t); return; }
    if (t.state !== 'playing' || !t.g) return;
    const g = t.g, el = t.players.filter(q => !q.out);
    if (t.game === 'pok') {
      if (g.phase === 'decide' && now > t.deadline) { for (const q of el) if (!q.dec) q.dec = 'stay'; this.pokResolve(t); }
    } else if (t.game === 'react') {
      if (g.phase === 'wait' && now >= g.goAt) {
        g.phase = 'go'; g.goTs = now; g.msg = 'กดเลย!'; g.botAt = {};
        for (const q of el) if (q.bot) g.botAt[q.id] = now + 450 + Math.random() * 500;
        this.pushTable(t);
      } else if (g.phase === 'go') {
        let first = null;
        for (const q of el) if (q.bot && !q.fs && g.botAt[q.id] && now >= g.botAt[q.id] && (!first || g.botAt[q.id] < g.botAt[first.id])) first = q;
        if (first) this.reactWin(t, first, Math.round(g.botAt[first.id] - g.goTs));
        else if (now - g.goTs > 4000) { g.msg = 'ไม่มีใครกด รอบนี้ไม่นับ'; this.reactStart(t); }
      } else if (g.phase === 'result' && now >= g.next) {
        const top = Math.max(...el.map(q => q.score));
        if (top >= g.target || g.round >= 12) this.partyFinish(t, el.filter(q => q.score === top), t.players.map(q => `${q.name} ${q.score}`).join(' • '));
        else this.reactStart(t);
      }
    } else {
      if (g.phase === 'pick' && now > t.deadline) this.rpsReveal(t);
      else if (g.phase === 'reveal' && now >= g.next) {
        const top = Math.max(...el.map(q => q.score));
        if (top >= g.target || g.rounds >= 10) this.partyFinish(t, el.filter(q => q.score === top), t.players.map(q => `${q.name} ${q.score}`).join(' • '));
        else this.rpsRound(t);
      }
    }
  },
  // ---- ไพ่ป๊อก: แจกคนละ 2 ใบ ใครมีป๊อก 8/9 เปิดไพ่ทันที ไม่งั้นเลือก "จั่วเพิ่ม" หรือ "อยู่" แล้วเทียบแต้ม • แต้มเท่ากันตัดสินด้วยเด้ง (สองใบดอก/เลขเดียวกัน ×2, สามใบดอกเดียวกัน ×3) • ยังเท่ากัน = หาร pot ----
  pokVal(c) { const r = c.slice(1); return r === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(r) ? 0 : +r; },
  pokPts(h) { return h.reduce((s, c) => s + this.pokVal(c), 0) % 10; },
  pokIs(q) { return q.hand.length === 2 && this.pokPts(q.hand) >= 8; },
  pokDeng(h) { const s = h.map(c => c[0]), r = h.map(c => c.slice(1)); if (h.length === 2) return s[0] === s[1] || r[0] === r[1] ? 2 : 1; return h.length === 3 && s[0] === s[1] && s[1] === s[2] ? 3 : 1; },
  pokStart(t) {
    const deck = [];
    for (const s of 'SHDC') for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) deck.push(s + r);
    this.unoShuffle(deck);
    t.g = { deck, phase: 'decide', reveal: false, msg: 'เลือกจั่วเพิ่มหรืออยู่' };
    for (const q of t.players) { q.hand = [deck.pop(), deck.pop()]; q.dec = ''; if (q.bot) { const pts = this.pokPts(q.hand); q.dec = pts <= 4 || (pts === 5 && Math.random() < 0.5) ? 'draw' : 'stay'; } }
    t.deadline = Date.now() + 15000;
    if (t.players.some(q => this.pokIs(q))) return this.pokResolve(t); // มีป๊อก เปิดไพ่ทันที
    this.pushTable(t);
  },
  pokResolve(t) {
    const g = t.g; if (!g || g.reveal) return;
    if (!t.players.some(q => this.pokIs(q))) for (const q of t.players) if (q.dec === 'draw' && !q.out) q.hand.push(g.deck.pop());
    g.reveal = true; g.phase = 'reveal';
    const el = t.players.filter(q => !q.out), key = q => [this.pokIs(q) ? 1 : 0, this.pokPts(q.hand), this.pokDeng(q.hand)];
    const cmp = (a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
    const best = el.reduce((b, q) => (!b || cmp(q, b) > 0 ? q : b), null);
    this.partyFinish(t, best ? el.filter(q => cmp(q, best) === 0) : [], t.players.map(q => `${q.name} ${this.pokPts(q.hand)} แต้ม${this.pokIs(q) ? ' (ป๊อก!)' : ''}${q.out ? ' (ออก)' : ''}`).join(' • '));
  },
  // ---- ใครกดเร็วกว่า: ใครกดก่อนสัญญาณ GO = ออกจากรอบนั้น, คนแรกที่กดหลังสัญญาณชนะรอบ, ใครชนะครบ 2 รอบก่อนเป็นผู้ชนะ ----
  reactStart(t) {
    const g = t.g, now = Date.now();
    Object.assign(g, { round: g.round + 1, phase: 'wait', goAt: now + 2000 + Math.random() * 4000, goTs: 0, botAt: {}, msg: 'รอสัญญาณ... อย่าเพิ่งกด!' });
    for (const q of t.players) q.fs = false;
    t.deadline = 0; this.pushTable(t);
  },
  reactPress(t, q) {
    const g = t.g, now = Date.now(); if (q.fs) return;
    if (g.phase === 'wait') {
      q.fs = true; g.msg = `${q.name} กดก่อนสัญญาณ! ออกจากรอบนี้`;
      if (!t.players.some(x => !x.out && !x.fs)) { g.msg = 'ทุกคนกดก่อนสัญญาณ รอบนี้ไม่นับ'; return this.reactStart(t); }
      this.pushTable(t);
    } else if (g.phase === 'go') this.reactWin(t, q, now - g.goTs);
  },
  reactWin(t, q, ms) {
    const g = t.g; q.score++; g.phase = 'result'; g.next = Date.now() + 2200;
    g.msg = `${q.name} กดเร็วที่สุด! (${ms} มิลลิวินาที) • ` + t.players.map(x => `${x.name} ${x.score}`).join(' • ');
    this.pushTable(t);
  },
  // ---- เป่ายิ้งฉุบ: ทุกคนเลือกพร้อมกัน เหลือ 2 แบบพอดี = ฝ่ายชนะได้ 1 แต้ม (เสมอ/ครบ 3 แบบ = เล่นรอบนั้นใหม่) ครบ 2 แต้มก่อนชนะ ----
  rpsRound(t) {
    const g = t.g, now = Date.now(); g.round++; g.phase = 'pick'; g.reveal = null; g.msg = 'เลือกหิน กรรไกร หรือกระดาษ';
    for (const q of t.players) q.pick = q.bot && !q.out ? 'RPS'[Math.floor(Math.random() * 3)] : (q.out ? 'x' : '');
    t.deadline = now + 10000; this.pushTable(t);
  },
  rpsReveal(t) {
    const g = t.g, now = Date.now(), alive = t.players.filter(q => !q.out), beats = { R: 'S', S: 'P', P: 'R' };
    for (const q of alive) if (!q.pick) q.pick = 'RPS'[Math.floor(Math.random() * 3)];
    g.reveal = {}; for (const q of alive) g.reveal[q.id] = q.pick;
    const set = [...new Set(alive.map(q => q.pick))];
    g.phase = 'reveal'; g.next = now + 2300; g.rounds++; t.deadline = 0;
    if (set.length !== 2) g.msg = 'เสมอ! เล่นรอบนี้ใหม่';
    else {
      const win = beats[set[0]] === set[1] ? set[0] : set[1], ws = alive.filter(q => q.pick === win);
      for (const q of ws) q.score++;
      g.msg = `${ws.map(q => q.name).join(', ')} ชนะรอบนี้! • ` + t.players.map(x => `${x.name} ${x.score}`).join(' • ');
    }
    this.pushTable(t);
  },
};
