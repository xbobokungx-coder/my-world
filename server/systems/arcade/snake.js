'use strict';
// เกมงูในตู้เกม (เล่นคนเดียว ไม่เดิมพัน): เซิร์ฟเวอร์จำลองทุกก้าว ฝั่งเว็บส่งแค่ทิศ • เก็บคะแนนสูงสุดต่อคน (rec.arc.snk) จัดอันดับตลอดกาล + สัปดาห์นี้
// ตัวจำลองกลาง (snakeNew/snakeStep/snakeTurn) อยู่ใน public/shared.js ค่าคงที่ S.SNAKE
const S = require('../../../public/shared.js');
const { logEv, send } = require('../../util.js');
const K = S.SNAKE;

module.exports = {
  newSnakeTable(id, c, idx) { return { id, idx, game: 'snake', cx: c.x, cy: c.y, state: 'idle', bet: 0, host: null, guest: null, players: [], max: 1, watchers: new Set() }; },
  snkRuns() { return this._snk || (this._snk = new Map()); }, // id ผู้เล่น → เกมที่กำลังเล่น (หนึ่งคนหนึ่งเกม หลายคนเล่นตู้เดียวพร้อมกันได้)
  snkOf(rec) { // คะแนนสูงสุดของคนนี้ (สัปดาห์ใหม่ล้างเฉพาะ wk)
    const a = this.arcOf(rec), wk = this.weekKey();
    if (!a.snk || typeof a.snk !== 'object') a.snk = { best: 0, wk: 0, wkKey: wk, plays: 0 };
    if (a.snk.wkKey !== wk) { a.snk.wk = 0; a.snk.wkKey = wk; }
    return a.snk;
  },
  snakeTops() { // Top 10 คะแนนสูงสุด (ตลอดกาล + สัปดาห์นี้) ในห้องนี้
    const arr = [];
    for (const [k, r] of Object.entries(this.saved)) { if (!r.arc || !r.arc.snk) continue; const s = this.snkOf(r); if (s.best > 0) arr.push({ name: r.name || k, best: s.best, wk: s.wk }); }
    const top = key => arr.filter(x => x[key] > 0).sort((x, y) => y[key] - x[key]).slice(0, K.top);
    return { best: top('best'), wk: top('wk') };
  },
  snakeRunPub(r, t, extra) { return Object.assign({ t: 'snk', id: t.id, b: r.body.flat(), f: r.food, sc: r.score, d: r.dir, ms: S.snakeMs(r), over: r.over ? 1 : 0 }, extra); },
  snakePub(t, vid) { // ข้อมูลตู้ตอนเปิด: อันดับ + สถิติตัวเอง (+ เกมที่กำลังเล่นอยู่ถ้ามี)
    const p = this.players.get(vid), run = this.snkRuns().get(vid), me = p ? this.snkOf(p.rec) : { best: 0, wk: 0 };
    return { id: t.id, idx: t.idx, game: 'snake', state: 'idle', bet: 0, max: 1, players: [], top: this.snakeTops(), me: { best: me.best, wk: me.wk }, run: run && !run.over ? this.snakeRunPub(run.r, t) : null };
  },
  snakeHandle(p, m, t) {
    const runs = this.snkRuns(), run = runs.get(p.id), now = Date.now();
    switch (m.a) {
      case 'close': t.watchers.delete(p.id); if (run) this.snakeEnd(p, t); break;
      case 'start': {
        if (run && !run.r.over) return;
        if (Math.hypot(p.x - (t.cx + 0.5) * S.TS, p.y - (t.cy + 0.5) * S.TS) > S.ARC_RANGE * S.TS) return this.toast(p, 'เดินเข้าไปใกล้ตู้เกมอีกนิด');
        if (now < (p.snkCd || 0)) return;
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        p.snkCd = now + K.cooldownMs; t.watchers.add(p.id);
        const r = S.snakeNew(Math.random); runs.set(p.id, { r, t, next: now + K.lead });
        send(p, this.snakeRunPub(r, t, { start: 1 }));
        if (!this._snkTimer) { this._snkTimer = setInterval(() => { try { this.snakeTick(Date.now()); } catch (e) { console.error('[snake]', e); } }, 40); if (this._snkTimer.unref) this._snkTimer.unref(); }
        break;
      }
      case 'dir': if (run && !run.r.over) S.snakeTurn(run.r, m.d); break;
    }
  },
  snakeTick(now) {
    const runs = this.snkRuns();
    for (const [id, run] of runs) {
      const p = this.players.get(id);
      if (!p) { runs.delete(id); continue; }
      if (run.r.over) { runs.delete(id); continue; }
      let moved = false, n = 0;
      while (now >= run.next && !run.r.over && n++ < 3) { S.snakeStep(run.r, Math.random); run.next += S.snakeMs(run.r); moved = true; }
      if (now > run.next + 500) run.next = now; // ค้างนาน (เซิร์ฟเวอร์สะดุด) ไม่เร่งไล่ก้าว
      if (!moved) continue;
      if (run.r.over) this.snakeEnd(p, run.t); else send(p, this.snakeRunPub(run.r, run.t));
    }
    if (!runs.size && this._snkTimer) { clearInterval(this._snkTimer); this._snkTimer = null; }
  },
  snakeEnd(p, t) { // จบเกม (ชน/ชนะเต็มกระดาน/ออกจากตู้): บันทึกสถิติ ให้แต้มตู้เกม ส่งอันดับล่าสุด
    const runs = this.snkRuns(), run = runs.get(p.id); if (!run || run.t !== t) return; // ของตู้อื่นไม่แตะ (เผื่อมีตู้งูหลายตู้)
    runs.delete(p.id); const r = run.r; r.over = true;
    const sn = this.snkOf(p.rec), sc = r.score; sn.plays = (sn.plays || 0) + 1;
    const newBest = sc > sn.best; if (newBest) sn.best = sc; if (sc > sn.wk) sn.wk = sc;
    if (sc > 0) this.dirty = true;
    if (r.foods >= K.minFoods) this.arcAward(p.key, Math.min(K.ptsMax, 1 + Math.floor(r.foods / K.ptsPer)), false);
    if (newBest && sc > 0) this.toast(p, `🐍 สถิติใหม่ของคุณ ${sc} คะแนน!`);
    logEv(this.room, 'snake', { p: p.key, sc, foods: r.foods });
    send(p, this.snakeRunPub(r, t, { best: sn.best, wk: sn.wk, nb: newBest ? 1 : 0, win: r.win ? 1 : 0, top: this.snakeTops() }));
  },
};
