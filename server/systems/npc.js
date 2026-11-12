'use strict';
// ชาวเมืองและสัตว์ประกอบฉาก: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { TS, T } = S;
const { rand } = require('../util.js');
const { NPC_DEFS } = require('../consts.js');
const PET_DEFS = [{ kind: 'cat', v: 0, max: 15, speed: 36 }, { kind: 'dog', v: 0, max: 20, speed: 54 }, { kind: 'dog', v: 1, max: 20, speed: 50 }]; // max = รัศมีสูงสุดจากศูนย์กลางลาน (ช่อง)

module.exports = {
  // ----- ชาวเมือง NPC: เดินเล่นแถวบ้านตัวเอง และพิมพ์ข้อความให้อ่านเล่นๆ (ไม่ใช่ผู้เล่น ไม่มีเงิน/สถานะ) -----
  initNpcs() {
    this.npcs = NPC_DEFS.map((d, i) => {
      const n = { id: 1000001 + i, name: d.name, title: d.title, color: d.color, hat: d.hat, pc: d.pc, wear: Object.assign({}, S.WEAR_DEFAULT, d.wear), lines: d.lines, home: d.home, job: d.job, path: [], dir: 0, wait: rand(1, 4), lastLine: -1, sayAt: 0 };
      let spot = null; // หาจุดที่เดินได้ใกล้บ้าน
      for (let k = 0; k < 400 && !spot; k++) { const a = k * 2.4, rr = 0.5 + k * 0.05, x = (d.home[0] + 0.5 + Math.cos(a) * rr) * TS, y = (d.home[1] + 0.5 + Math.sin(a) * rr) * TS; if (!S.blockedAt(this.map, x, y)) spot = [x, y]; }
      n.x = n.tx = spot ? spot[0] : (d.home[0] + 0.5) * TS; n.y = n.ty = spot ? spot[1] : (d.home[1] + 0.5) * TS;
      return n;
    });
  },
  npcPub(n) { return { fs: n.fs || 0, fx: n.fx || 0, fy: n.fy || 0, held: n.fs ? '🎣' : '', id: n.id, name: n.name, title: n.title, color: n.color, hat: n.hat, pc: n.pc, wear: n.wear, x: Math.round(n.x), y: Math.round(n.y), dir: n.dir }; },
  npcSay(n, now) {
    let i; do { i = Math.floor(Math.random() * n.lines.length); } while (i === n.lastLine && n.lines.length > 1);
    n.lastLine = i;
    const hour = Math.floor((now % S.CLOCK_MS) / S.CLOCK_MS * 24 + 6) % 24;
    const text = n.lines[i]
      .replace('{online}', this.players.size)
      .replace('{village}', `${this.village.n}/${this.villageGoal()}`).replace('{hour}', String(hour).padStart(2, '0') + ':00');
    this.broadcast({ t: 'chat', id: n.id, name: n.name, text, npc: 1 });
  },
  npcWalkable(x, y) { // ช่องที่ NPC เดินได้: ไม่ชน ไม่ใช่พื้นบ้าน (ไม่เดินเข้าบ้านคนอื่น) ไม่ใช่น้ำ
    if (x < 0 || y < 0 || x >= S.W || y >= S.H) return false;
    const t = this.map[y][x];
    return t !== T.FLOOR && t !== T.FURN && !S.blockedAt(this.map, (x + 0.5) * TS, (y + 0.5) * TS);
  },
  npcFishSpots() { // ช่องเดินได้ที่ติดน้ำของสระใหญ่ (ยืนตกปลาได้) + ทิศหันหาน้ำ + จุดทุ่น (ช่องน้ำที่ไกลสุดภายใน 3 ช่อง) • คำนวณครั้งเดียว
    if (this._fishSpots) return this._fishSpots;
    const out = [];
    const F = S.NPC.fish, sc = F.scan;
    for (let y = sc.y0; y <= sc.y1; y++) for (let x = sc.x0; x <= sc.x1; x++) {
      if (!this.npcWalkable(x, y)) continue;
      for (const [dx, dy] of S.DIRS) {
        let w = 0; while (w < F.reach && this.map[y + dy * (w + 1)] && this.map[y + dy * (w + 1)][x + dx * (w + 1)] === T.WATER) w++;
        if (w >= 2) { out.push({ x, y, dir: dx < 0 ? 2 : dx > 0 ? 3 : dy < 0 ? 1 : 0, fx: (x + dx * w + 0.5) * TS, fy: (y + dy * w + 0.5) * TS }); break; }
      }
    }
    return (this._fishSpots = out);
  },
  npcFishStart(n, now) { // งานประจำตัว (ภาพอย่างเดียว): เดินไปริมสระ แล้วตั้งสถานะตกปลา — ไม่แตะปลา/ตลาด/เซฟ
    const spots = this.npcFishSpots(); if (!spots.length) return false;
    const sp = spots[Math.floor(Math.random() * spots.length)];
    if (!this.npcPlan(n, [sp.x, sp.y])) return false;
    n.fishGo = sp; return true;
  },
  npcFishTick(n, now) { // คืน true = กำลังตกปลาอยู่ (ไม่ต้องเดิน)
    if (!n.fish) return false;
    const f = n.fish, left = f.until - now;
    n.fs = left < S.NPC.fish.biteMs ? 2 : 1; // ท้ายรอบปลากินเบ็ด
    if (left <= 0) { n.fish = null; n.fs = 0; n.fx = n.fy = 0; n.wait = rand(S.NPC.fish.restMin, S.NPC.fish.restMax); return false; }
    return true;
  },
  npcPlan(n, want) { // เลือกจุดหมายไกลๆ ที่เดินถึงจริง แล้วหาเส้นทางด้วย BFS (4 ทิศ) • want = [x,y] ช่องที่ต้องการ (ถ้าไปไม่ถึงคืน false)
    const W = S.W, sx = Math.floor(n.x / TS), sy = Math.floor(n.y / TS), prev = new Map(), q = [[sx, sy]], dist = new Map();
    prev.set(sy * W + sx, null); dist.set(sy * W + sx, 0);
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of S.DIRS) {
        const nx = x + dx, ny = y + dy, k = ny * W + nx;
        if (prev.has(k) || !this.npcWalkable(nx, ny)) continue;
        prev.set(k, [x, y]); dist.set(k, dist.get(y * W + x) + 1); q.push([nx, ny]);
      }
    }
    let goal;
    if (want) { if (!prev.has(want[1] * W + want[0])) return false; goal = want; } else {
      const far = q.filter(([x, y]) => dist.get(y * W + x) >= 8);
      goal = (far.length ? far : q)[Math.floor(Math.random() * (far.length ? far.length : q.length))];
    }
    const path = []; let c = goal;
    while (c && prev.get(c[1] * W + c[0]) !== null) { path.push(c); c = prev.get(c[1] * W + c[0]); }
    n.path = path.reverse(); return true;
  },
  npcTick(dt, now) {
    if (!this.players.size) return; // ไม่มีคนอยู่ NPC ก็พักเหมือนกัน
    for (const n of this.npcs) {
      if (!n.sayAt) n.sayAt = now + rand(6000, 14000);
      if (now >= n.sayAt) { // พูดห่างๆ: ต่อคน 45-110 วินาที และทั้งเมืองห่างกันอย่างน้อย gap (ไม่ให้พูดพร้อมกัน แต่ก็ไม่เหงา)
        if (now - (this.npcLastSay || 0) < S.NPC.gap) n.sayAt = now + rand(3000, 8000);
        else { n.sayAt = now + rand(S.NPC.sayMin, S.NPC.sayMax); this.npcLastSay = now; this.npcSay(n, now); }
      }
      if (this.npcFishTick(n, now)) continue;
      if (!n.path || !n.path.length) {
        if (n.fishGo) { // ถึงริมสระแล้ว: หันหน้าหาน้ำ เหวี่ยงเบ็ด 10–30 วินาที
          const g = n.fishGo; n.fishGo = null;
          if (Math.hypot(n.x - (g.x + 0.5) * TS, n.y - (g.y + 0.5) * TS) < TS) { n.dir = g.dir; n.fish = { until: now + rand(S.NPC.fish.minMs, S.NPC.fish.maxMs) }; n.fs = 1; n.fx = Math.round(g.fx); n.fy = Math.round(g.fy); continue; }
        }
        n.wait -= dt;
        if (n.wait <= 0) { n.wait = rand(2, 8); if (!(n.job === 'fish' && Math.random() < S.NPC.fish.chance && this.npcFishStart(n, now))) this.npcPlan(n); }
        continue;
      }
      const [wx, wy] = n.path[0], tx = (wx + 0.5) * TS, ty = (wy + 0.5) * TS, d = Math.hypot(tx - n.x, ty - n.y);
      if (d < 2) { n.path.shift(); continue; }
      const sp = Math.min(d, S.NPC.speed * dt), nx = n.x + (tx - n.x) / d * sp, ny = n.y + (ty - n.y) / d * sp;
      if (S.blockedAt(this.map, nx, ny)) { n.path = []; n.wait = 1; continue; } // มีของมาขวาง (เช่น เฟอร์นิเจอร์/ต้นไม้งอก) = หยุดแล้วหาทางใหม่
      n.dir = Math.abs(tx - n.x) > Math.abs(ty - n.y) ? (tx < n.x ? 2 : 3) : (ty < n.y ? 1 : 0);
      n.x = nx; n.y = ny;
    }
  },
  // ----- สัตว์เลี้ยงประกอบฉาก: แมว 1 ตัว (ห่างศูนย์กลางลานไม่เกิน 15 ช่อง) หมา 2 ตัว (ไม่เกิน 20 ช่อง) เดินเล่นไปมา ทุกคนเห็นตรงกัน -----
  initPets() {
    const F = S.FIRE;
    this.pets = PET_DEFS.map((d, i) => {
      const p = { id: 2000001 + i, kind: d.kind, v: d.v, max: d.max, speed: d.speed, path: [], dir: 3, wait: rand(1, 4), moving: false };
      let spot = null;
      for (let k = 0; k < 400 && !spot; k++) { const a = k * 2.4 + i * 2, rr = 2 + k * 0.05, x = Math.floor(F.x + 0.5 + Math.cos(a) * rr), y = Math.floor(F.y + 0.5 + Math.sin(a) * rr); if (this.petOk(x, y, d.max)) spot = [x, y]; }
      spot = spot || [F.x, F.y + 2];
      p.x = p.tx = (spot[0] + 0.5) * TS; p.y = p.ty = (spot[1] + 0.5) * TS;
      return p;
    });
  },
  petPub(p) { return { id: p.id, kind: p.kind, v: p.v, x: Math.round(p.x), y: Math.round(p.y), dir: p.dir }; },
  petOk(x, y, max) { return this.npcWalkable(x, y) && Math.hypot(x - S.FIRE.x, y - S.FIRE.y) <= max; }, // เดินได้ และอยู่ในรัศมี max ช่องจากศูนย์กลางลาน
  petPlan(p) { // BFS เฉพาะช่องในรัศมี แล้วสุ่มจุดหมายห่างไป 3-14 ช่อง (เดินสั้นๆ ไปมา)
    const W = S.W, sx = Math.floor(p.x / TS), sy = Math.floor(p.y / TS), prev = new Map(), q = [[sx, sy]], dist = new Map();
    prev.set(sy * W + sx, null); dist.set(sy * W + sx, 0);
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of S.DIRS) {
        const nx = x + dx, ny = y + dy, k = ny * W + nx;
        if (prev.has(k) || !this.petOk(nx, ny, p.max)) continue;
        prev.set(k, [x, y]); dist.set(k, dist.get(y * W + x) + 1); q.push([nx, ny]);
      }
    }
    const mid = q.filter(([x, y]) => { const d = dist.get(y * W + x); return d >= 3 && d <= 14; });
    const pool = mid.length ? mid : q.slice(1);
    if (!pool.length) { p.path = []; return; }
    const goal = pool[Math.floor(Math.random() * pool.length)], path = []; let c = goal;
    while (c && prev.get(c[1] * W + c[0]) !== null) { path.push(c); c = prev.get(c[1] * W + c[0]); }
    p.path = path.reverse();
  },
  petTick(dt) {
    if (!this.players.size) return;
    for (const p of this.pets) {
      if (!p.path || !p.path.length) {
        p.moving = false; p.wait -= dt;
        if (p.wait <= 0) { p.wait = p.kind === 'cat' ? rand(3, 10) : rand(1.5, 6); this.petPlan(p); }
        continue;
      }
      const [wx, wy] = p.path[0], tx = (wx + 0.5) * TS, ty = (wy + 0.5) * TS, d = Math.hypot(tx - p.x, ty - p.y);
      if (d < 2) { p.path.shift(); continue; }
      const sp = Math.min(d, p.speed * dt), nx = p.x + (tx - p.x) / d * sp, ny = p.y + (ty - p.y) / d * sp;
      if (S.blockedAt(this.map, nx, ny)) { p.path = []; p.wait = 1; p.moving = false; continue; }
      p.dir = Math.abs(tx - p.x) > Math.abs(ty - p.y) ? (tx < p.x ? 2 : 3) : (ty < p.y ? 1 : 0);
      p.x = nx; p.y = ny; p.moving = true;
    }
  },
};
