'use strict';
// แกนตู้เกม (โต๊ะ เดิมพัน แต้มตู้ อันดับ เดิมพันกับบอท เปิด/จัดการ/ออก/tick/คืนเงิน): ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../../public/shared.js'); // object เดียวกับที่ server.js โหลด
const { TS } = S;
const { logEv, send } = require('../../util.js');
const { PARTY } = require('../../consts.js');

module.exports = {
  // ----- แต้มตู้เกม (arcade points): เล่นจบ/ชนะคนจริงได้แต้ม ใช้แลกของโชว์ + จัดอันดับ Leaderboard -----
  arcOf(rec) {
    if (!rec.arc || typeof rec.arc !== 'object') rec.arc = { pts: 0, total: 0, wk: 0, wkKey: 0 };
    const wk = this.weekKey(); if (rec.arc.wkKey !== wk) { rec.arc.wk = 0; rec.arc.wkKey = wk; }
    return rec.arc;
  },
  arcPub(rec) { const a = this.arcOf(rec); return { pts: a.pts, total: a.total, wk: a.wk, tt: a.tt || [] }; },
  arcBuy(p, id) { // ร้านรางวัลแต้มตู้เกม: ใช้แต้ม (ไม่ใช่เหรียญ) แลกของหายาก/ฉายา • ฉายาที่มีแล้วกดซ้ำ = ใช้ฉายานั้น
    const d = S.ARC_SHOP.find(x => x.id === id), a = this.arcOf(p.rec); if (!d) return;
    if (d.title && (a.tt || []).includes(id)) { p.rec.ttl = 'arc:' + id; p.title = this.titleOf(p.rec); this.broadcast({ t: 'title', id: p.id, title: p.title }); this.dirty = true; return this.toast(p, `🏅 ใช้ฉายา "${d.title}"`); }
    if (a.pts < d.pts) return this.toast(p, `แต้มตู้เกมไม่พอ (ต้องใช้ ${d.pts} มี ${a.pts})`);
    a.pts -= d.pts; this.dirty = true;
    if (d.title) { (a.tt || (a.tt = [])).push(id); p.rec.ttl = 'arc:' + id; p.title = this.titleOf(p.rec); this.broadcast({ t: 'title', id: p.id, title: p.title }); this.toast(p, `🏅 แลกฉายา "${d.title}" แล้ว (ใช้อยู่ตอนนี้)`); }
    else { this.add(p, d.id, 1); const i = S.itemInfo(d.id); this.toast(p, `🎁 แลก ${i.emoji} ${i.name} แล้ว (อยู่ในกระเป๋า วางในบ้านได้)`); }
    logEv(this.room, 'arcbuy', { p: p.key, id, pts: d.pts }); this.addLog(`🎮 ${p.name} แลกรางวัลตู้เกม ${d.title ? 'ฉายา "' + d.title + '"' : S.itemInfo(d.id).name}`);
    send(p, { t: 'arcpts', arc: this.arcPub(p.rec) }); this.sfxTo(p, 'levelup');
  },
  arcAward(key, play, won) { // ให้แต้ม (ออนไลน์/ออฟไลน์): play = แต้มเล่นจบ, won = ชนะคนจริงได้โบนัส
    if (!key) return;
    const p = [...this.players.values()].find(q => q.key === key), rec = (p && p.rec) || this.saved[key]; if (!rec) return;
    const a = this.arcOf(rec), day = this.today(); if (a.day !== day) { a.day = day; a.dayPts = 0; }
    const gain = Math.min(play + (won ? S.ARCPTS.win : 0), Math.max(0, S.ARCPTS.dailyCap - a.dayPts)); a.dayPts += gain;
    a.pts += gain; a.total += gain; a.wk += gain; this.dirty = true;
    this.achAdd(rec, 'arcplay'); if (won) this.achAdd(rec, 'arcwin'); if (p) { this.wk1Step(p, 'arcplay'); if (won) this.evHit(p, 'arcwin'); }
    if (p) { send(p, { t: 'arcpts', arc: this.arcPub(rec) }); this.toast(p, gain ? `🎮 +${gain} แต้มตู้เกม${won ? ' (ชนะ!)' : ''} • มีอยู่ ${a.pts}` : `🎮 วันนี้ได้แต้มตู้เกมครบ ${S.ARCPTS.dailyCap} แล้ว พรุ่งนี้มาใหม่นะ`); }
  },
  sendLeaderboard(p) { // อันดับแต้มตู้เกมในห้องนี้ (สะสมตลอดกาล + สัปดาห์นี้) Top 10
    const arr = [];
    for (const [k, r] of Object.entries(this.saved)) { const a = this.arcOf(r); if (a.total > 0) arr.push({ name: r.name || k, total: a.total, wk: a.wk }); }
    const top = key => arr.slice().sort((x, y) => y[key] - x[key]).slice(0, 10);
    send(p, { t: 'lb', total: top('total'), wk: top('wk').filter(x => x.wk > 0), me: this.arcPub(p.rec) });
  },
  arcsPub() {
    return Object.values(this.tables).map(t => (t.game === 'uno' || PARTY.has(t.game))
      ? [t.id, t.idx, t.state, t.bet, t.players[0] ? t.players[0].name : '', t.players.length + '/' + t.max, t.bot ? 1 : 0, t.game]
      : [t.id, t.idx, t.state, t.bet, t.host ? t.host.name : '', t.guest ? t.guest.name : '', t.bot ? 1 : 0, t.game]);
  },
  pubFor(t, id) { return t.game === 'uno' ? this.unoPub(t, id) : PARTY.has(t.game) ? this.partyPub(t, id) : this.tablePub(t, id); },
  pushTable(t, openFor) {
    const ids = (t.game === 'uno' || PARTY.has(t.game))
      ? new Set([...t.players.filter(q => !q.bot).map(q => q.id), ...t.watchers])
      : new Set([t.host && t.host.id, t.guest && t.guest.id, ...t.watchers].filter(Boolean));
    for (const id of ids) {
      const q = this.players.get(id); if (!q) continue;
      const o = { t: 'arc', table: this.pubFor(t, id) };
      if (id === openFor) o.open = true;
      send(q, o);
    }
    this.broadcast({ t: 'arcs', a: this.arcsPub() });
  },
  inGame(p) {
    return Object.values(this.tables).some(t => (t.state === 'waiting' || t.state === 'playing') &&
      (t.game === 'uno' || PARTY.has(t.game) ? t.players.some(q => q.id === p.id && !q.out)
        : (t.host && t.host.id === p.id) || (t.guest && t.guest.id === p.id)));
  },
  // จ่ายเหรียญให้ผู้เล่น (ออนไลน์หรือออฟไลน์ก็ได้)
  payKey(who, n) {
    if (!who || !n) return;
    const q = this.players.get(who.id);
    if (q && q.key === who.key) { this.add(q, 'coin', n, 'arcade'); return; }
    const rec = this.saved[who.key]; if (rec) { rec.inv.coin = (rec.inv.coin || 0) + n; this.dirty = true; }
  },
  who(p) { return { id: p.id, name: p.name, key: p.key }; },
  // เดิมพันกับบอท: กำไรสุทธิจากบอทต่อวันจำกัดไว้ (S.BOTBET.dailyWinCap) เพราะเงินฝั่งบอทคือเหรียญที่สร้างขึ้นใหม่
  botNetOf(key) { const rec = this.saved[key]; if (!rec) return null; const day = this.today(); if (!rec.botNet || rec.botNet.day !== day) rec.botNet = { day, net: 0 }; return rec.botNet; },
  botRemain(key) { const o = this.botNetOf(key); return o ? Math.max(0, S.BOTBET.dailyWinCap - o.net) : 0; },
  botNetAdd(key, d) { const o = this.botNetOf(key); if (o) { o.net += d; this.dirty = true; } },
  botBetOf(p, raw) { // คืนยอดเดิมพันที่ใช้ได้ หรือ -1 ถ้าไม่อนุญาต (แจ้งผู้เล่นแล้ว)
    const b = S.BOTBET.bets.includes(raw | 0) ? raw | 0 : 0;
    if (b && this.botRemain(p.key) <= 0) { this.toast(p, `วันนี้ได้กำไรจากบอทครบโควตา 🪙 ${S.BOTBET.dailyWinCap} แล้ว ซ้อมแบบไม่เดิมพันได้ หรือท้าเล่นกับเพื่อน`); return -1; }
    return b;
  },
  arcOpen(p, cab) {
    if (!cab.game) return this.toast(p, 'ตู้นี้ยังไม่เปิดให้เล่น เร็วๆ นี้!');
    const t = this.tables['cab' + cab.idx];
    if (!t) return;
    if (Math.hypot(p.x - (cab.x + 0.5) * TS, p.y - (cab.y + 0.5) * TS) > S.ARC_RANGE * TS) return this.toast(p, 'เดินเข้าไปใกล้ตู้เกมอีกนิด');
    t.watchers.add(p.id);
    send(p, { t: 'arc', open: true, table: this.pubFor(t, p.id) });
  },
  arcHandle(p, m) {
    const t = typeof m.id === 'string' && Object.hasOwn(this.tables, m.id) ? this.tables[m.id] : null;
    if (!t) return;
    if (t.game === 'uno') return this.unoHandle(p, m, t);
    if (PARTY.has(t.game)) return this.partyHandle(p, m, t);
    const coin = p.rec.inv.coin || 0, now = Date.now();
    switch (m.a) {
      case 'close': t.watchers.delete(p.id); break;
      case 'create': case 'bot': {
        if (t.state !== 'idle' && t.state !== 'over') return this.toast(p, 'โต๊ะนี้ไม่ว่าง');
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        const bet = m.a === 'bot' ? this.botBetOf(p, m.bet) : (S.BETS.includes(m.bet | 0) ? m.bet | 0 : 0);
        if (bet < 0) return;
        if (coin < bet) return this.toast(p, 'เหรียญไม่พอสำหรับเดิมพันนี้');
        this.resetTable(t);
        if (bet) this.add(p, 'coin', -bet, 'arcade'); // กันเหรียญเดิมพันไว้ (escrow) จนจบเกม
        t.host = this.who(p); t.bet = bet; t.watchers.add(p.id);
        if (m.a === 'bot') { t.bot = true; t.guest = { id: 0, name: 'บอท 🤖', key: '' }; this.startGame(t); }
        else { t.state = 'waiting'; t.waitUntil = now + 180000; this.pushTable(t, p.id); }
        break;
      }
      case 'cancel': if (t.state === 'waiting' && t.host.id === p.id) this.cancelWait(t); break;
      case 'join': {
        if (t.state !== 'waiting' || t.host.id === p.id) return;
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        if (coin < t.bet) return this.toast(p, 'เหรียญไม่พอสำหรับเดิมพันนี้');
        if (t.bet) this.add(p, 'coin', -t.bet, 'arcade');
        t.guest = this.who(p); t.watchers.add(p.id); this.startGame(t);
        break;
      }
      case 'move': {
        if (t.game !== 'xo') { this.duelMove(t, p, m); break; }
        if (t.state !== 'playing' || !Number.isInteger(m.i) || m.i < 0 || m.i > 8 || t.board[m.i]) return;
        const side = p.id === t.xId ? 'X' : p.id === t.oId ? 'O' : null;
        if (!side || side !== t.turn) return;
        this.applyMove(t, side, m.i);
        break;
      }
      case 'resign': {
        if (t.state !== 'playing') return;
        const side = p.id === t.xId ? 'X' : p.id === t.oId ? 'O' : null;
        if (side) this.finish(t, side === 'X' ? 'O' : 'X', null, `${p.name} ยอมแพ้`);
        break;
      }
    }
  },
  arcLeaveTable(p, t) { // ออกจากโต๊ะนี้: ยกเลิกห้องที่รอ (คืนเหรียญ) หรือแพ้ถ้ากำลังเล่นอยู่
    t.watchers.delete(p.id);
    if (t.game === 'uno') { this.unoLeave(p, t); return; }
    if (PARTY.has(t.game)) { this.partyLeave(p, t); return; }
    if (t.state === 'waiting' && t.host.id === p.id) this.cancelWait(t, `${p.name} ออกจากเกม ยกเลิกห้อง`);
    else if (t.state === 'playing' && (t.xId === p.id || t.oId === p.id)) this.finish(t, p.id === t.xId ? 'O' : 'X', null, `${p.name} ออกจากเกม`);
  },
  arcLeave(p) { for (const t of Object.values(this.tables)) this.arcLeaveTable(p, t); }, // ผู้เล่นหลุด/ออกจากเกม
  arcSeated(p, t) { // นั่งอยู่ที่โต๊ะนี้ (ผู้เล่นจริง ไม่ใช่แค่ดู)
    if (t.game === 'uno' || PARTY.has(t.game)) return t.players.some(q => q.id === p.id);
    return !!((t.host && t.host.id === p.id) || (t.guest && t.guest.id === p.id) || t.xId === p.id || t.oId === p.id);
  },
  arcRangeCheck(p) { // เดินห่างจากตู้เกินระยะ = ออกจากโต๊ะทันที (คนที่นั่งเล่นอยู่นับเหมือนออกจากเกม แค่ดูอยู่ก็ปิดหน้าต่างให้)
    for (const t of Object.values(this.tables)) {
      const cab = S.CABINETS[t.idx]; if (!cab) continue;
      const seated = this.arcSeated(p, t);
      if (!seated && !t.watchers.has(p.id)) continue;
      if (Math.hypot(p.x - (cab.x + 0.5) * TS, p.y - (cab.y + 0.5) * TS) <= S.ARC_RANGE * TS) continue;
      this.arcLeaveTable(p, t);
      send(p, { t: 'arc', close: t.id });
      this.toast(p, seated ? `🚶 เดินห่างจากตู้เกินระยะ (${S.ARC_RANGE - 0.5} ช่อง) ออกจากโต๊ะให้แล้ว` : '🚶 เดินห่างจากตู้แล้ว ปิดหน้าตู้เกมให้');
    }
  },
  arcTick(now) {
    for (const t of Object.values(this.tables)) {
      if (t.game === 'uno') { this.unoTick(t, now); continue; }
      if (PARTY.has(t.game)) { this.partyTick(t, now); continue; }
      if (t.state === 'waiting' && now > t.waitUntil) this.cancelWait(t, 'หมดเวลารอคู่แข่ง คืนเหรียญให้แล้ว');
      else if (t.state === 'playing' && t.game !== 'xo') this.duelTick(t, now);
      else if (t.state === 'playing') {
        if (t.botAt && now >= t.botAt) { t.botAt = 0; this.botMove(t); }
        else if (now > t.deadline) { const loser = t.turn; const pl = this.players.get(loser === 'X' ? t.xId : t.oId); this.finish(t, loser === 'X' ? 'O' : 'X', null, `${pl ? pl.name : loser} หมดเวลา`); }
      } else if (t.state === 'over' && now > t.resetAt) { this.resetTable(t); this.pushTable(t); }
    }
  },
  arcRefundAll() { // ตอนปิดเซิร์ฟเวอร์: คืนเงินเดิมพันที่ถูกกันไว้
    for (const t of Object.values(this.tables)) {
      if (!t.bet) continue;
      if (t.game !== 'uno' && !PARTY.has(t.game) && t.bot) { if (t.state === 'playing') this.payKey(t.host, t.bet); continue; }
      if (t.game === 'uno' || PARTY.has(t.game)) { if (t.state === 'waiting' || t.state === 'playing') for (const q of t.players) if (!q.bot) this.payKey(q, t.bet); continue; }
      if (t.state === 'waiting') this.payKey(t.host, t.bet);
      else if (t.state === 'playing') { this.payKey(t.host, t.bet); this.payKey(t.guest, t.bet); }
    }
  },
};
