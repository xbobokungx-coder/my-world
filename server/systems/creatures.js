'use strict';
// สัตว์ในถ้ำเหมือง (อุปสรรคเบาๆ ตอนขุดแร่ ดู docs/plans/cave-creatures.md) ต่อเข้า class World ด้วย mix() • ไม่ตาย ไม่เสียของ/เหรียญ โดนแล้วผลัก+สตัน+ความหิวลด
// สัตว์เก็บในหน่วยความจำที่ this.floors.get(f).creatures (Map id → obj) ไม่ลงเซฟ • อัปเดตเฉพาะชั้นที่มีคน • ตัวเลขทั้งหมดอยู่ S.CREATURES / S.CREATURE
const S = require('../../public/shared.js');
const { TS, T } = S;
const { send, logEv } = require('../util.js');
const { CAVE } = require('../consts.js');

const C = S.CREATURE;
const dirOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0); // 0 ใต้ 1 เหนือ 2 ตะวันตก 3 ตะวันออก
const rnd = (a, b) => a + Math.random() * (b - a);

module.exports = {
  creatureOn(f) { const pr = S.crProfile(f); return !!pr && pr.on; }, // ชั้นที่มีสัตว์ตามโปรไฟล์ S.crProfile: ถ้ำเหมืองปกติ (ไม่ใช่ทะเล) หรือป่าดงดิบ (JUNGLE.mon.on)
  creatureTotal() { let n = 0; for (const F of this.floors.values()) if (F.creatures) n += F.creatures.size; return n; },
  creatureSafe(F, f, x, y) { // อยู่ในเขตปลอดภัย (รอบจุดเกิดชั้น 1 / ช่องลงจอด / บันไดลง / ทางขึ้น • ป่า = สี่เหลี่ยม JUNGLE.safe) ไหม
    if (S.isJungle(f)) return S.jungleSafe(x, y);
    if (!F.crSafe) {
      const cs = [S.CAVE.spawn, this.caveLanding(f)];
      for (let cy = 0; cy < S.H; cy++) for (let cx = 0; cx < S.W; cx++) { const t = F.map[cy][cx]; if (t === T.DOWN || t === T.MOUTH) cs.push({ x: (cx + 0.5) * TS, y: (cy + 0.5) * TS }); }
      F.crSafe = cs;
    }
    const r = C.safe * TS; return F.crSafe.some(q => Math.hypot(x - q.x, y - q.y) < r);
  },
  creatureLos(F, x1, y1, x2, y2) { // เส้นตรงไม่ถูกผนัง/แร่บัง
    const d = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.ceil(d / (TS / 2))), open = F.crOpen || S.caveOpen; // F.crOpen = ช่องที่สายตาผ่านได้ของชั้น (ตั้งใน creatureOnScene ตามโปรไฟล์)
    for (let i = 1; i < n; i++) { const x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n, row = F.map[Math.floor(y / TS)]; if (!row || !open(row[Math.floor(x / TS)])) return false; }
    return true;
  },
  creatureMove(F, f, c, dx, dy) { // เดินได้เฉพาะช่องโล่ง ไม่เข้าเขตปลอดภัย (ลองเต็มทาง → แกน x → แกน y) • คืนว่าขยับไหม
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4)), sx = dx / n, sy = dy / n; let moved = false; // แบ่งเป็นก้าวย่อย ไม่ทะลุผนังแม้เซิร์ฟเวอร์กระตุก
    for (let i = 0; i < n; i++) {
      let ok = false;
      for (const [mx, my] of [[sx, sy], [sx, 0], [0, sy]]) {
        if (!mx && !my) continue;
        const nx = c.x + mx, ny = c.y + my;
        if (!S.blockedAt(F.map, nx, ny, C.stepR) && !this.creatureSafe(F, f, nx, ny)) { c.x = nx; c.y = ny; ok = moved = true; break; }
      }
      if (!ok) break;
    }
    return moved;
  },
  creatureDash(F, f, c, ux, uy, len) { let left = len; while (left > 0) { const s = Math.min(4, left); if (!this.creatureMove(F, f, c, ux * s, uy * s)) break; left -= s; } }, // ขยับเป็นก้าวสั้นๆ ไม่ทะลุผนัง
  creatureSpawnJg(F, f, spot) { // ป่า: สร้างสัตว์ตัวที่ spot (ลำดับใน JUNGLE.mon.spots) ที่ช่องบ้านก่อน ถ้าผู้เล่นอยู่ใกล้สุ่มช่องพื้นป่าในรัศมีบ้าน • ห่างผู้เล่นทุกคน ≥ spawnGap ช่อง ไม่เกิดในเขตปลอดภัย/บนถนน • ไม่พบ = null
    const pr = S.crProfile(f), sp = pr.spots[spot]; if (!sp) return null;
    const mates = this.sceneMates(CAVE + f), gap = C.spawnGap * TS, R = pr.leash;
    for (let i = 0; i < 60; i++) {
      const cx = i === 0 ? sp[1] : sp[1] + Math.round((Math.random() * 2 - 1) * R), cy = i === 0 ? sp[2] : sp[2] + Math.round((Math.random() * 2 - 1) * R);
      if (!F.map[cy] || F.map[cy][cx] !== T.CAVE || Math.hypot(cx - sp[1], cy - sp[2]) > R) continue;
      const x = (cx + 0.5) * TS, y = (cy + 0.5) * TS;
      if (S.blockedAt(F.map, x, y, C.stepR) || this.creatureSafe(F, f, x, y) || mates.some(q => Math.hypot(q.x - x, q.y - y) < gap)) continue;
      const k = sp[0], hp = S.crHpOf(k, f), c = { id: (this.crSeq = (this.crSeq || 0) + 1), k, x, y, dir: 0, st: 0, hp, hpMax: hp, until: 0, wt: 0, wdx: 0, wdy: 0, tid: 0, sent: null, spot, hx: (sp[1] + 0.5) * TS, hy: (sp[2] + 0.5) * TS, ret: false };
      F.creatures.set(c.id, c); return c;
    }
    return null;
  },
  creatureSpawn(F, f, now, spot) { // สร้างสัตว์ 1 ตัวที่จุดห่างผู้เล่นทุกคน ≥ spawnGap ช่อง นอกเขตปลอดภัย • ไม่พบ = null (spot = ลำดับจุดบ้านในป่า)
    if (this.creatureTotal() >= C.maxTotal) return null;
    if (S.isJungle(f)) return this.creatureSpawnJg(F, f, spot);
    const mates = this.sceneMates(CAVE + f), gap = C.spawnGap * TS;
    for (let i = 0; i < 80; i++) {
      const cx = S.CAVE.x0 + 1 + Math.floor(Math.random() * (S.CAVE.x1 - S.CAVE.x0 - 1)), cy = S.CAVE.y0 + 1 + Math.floor(Math.random() * (S.CAVE.y1 - S.CAVE.y0 - 1));
      if (F.map[cy][cx] !== T.CAVE) continue;
      const x = (cx + 0.5) * TS, y = (cy + 0.5) * TS;
      if (S.blockedAt(F.map, x, y, C.stepR) || this.creatureSafe(F, f, x, y) || mates.some(q => Math.hypot(q.x - x, q.y - y) < gap)) continue;
      const k = S.creaturePick(f), hp = S.creatureHp(k, f), c = { id: (this.crSeq = (this.crSeq || 0) + 1), k, x, y, dir: 0, st: 0, hp, hpMax: hp, until: 0, wt: 0, wdx: 0, wdy: 0, tid: 0, sent: null };
      F.creatures.set(c.id, c); return c;
    }
    return null;
  },
  creatureFill(F, f, now) { // เติมให้ครบ cap (นับรวมคิวเกิดใหม่) • ป่า: เติมทีละจุดบ้านที่ยังว่าง (เกิดไม่ได้ = เข้าคิวลองใหม่)
    if (S.isJungle(f)) {
      const out = [], pr = S.crProfile(f);
      for (let i = 0; i < pr.spots.length; i++) {
        if ([...F.creatures.values()].some(c => c.spot === i) || F.crWait.some(w => w.spot === i)) continue;
        const c = this.creatureSpawn(F, f, now, i); if (c) out.push(c); else F.crWait.push({ at: now + C.spawnRetryMs, spot: i });
      }
      return out;
    }
    const cap = S.creatureCap(f);
    const out = []; for (let i = 0; i < cap && F.creatures.size + F.crWait.length < cap; i++) { const c = this.creatureSpawn(F, f, now); if (!c) break; out.push(c); } return out;
  },
  creatureOnScene(p) { // เรียกท้าย changeScene: เข้าชั้นถ้ำ = ให้สัตว์เกิด + ส่งรายการเต็ม • ออกจากถ้ำ = เลิกนับสลบ
    this.combatOnScene(p); // ป่า: ตั้ง HP/ส่ง cb jh • ฉากอื่น: เคลียร์
    const f = S.caveFloor(p.scene);
    if (p.crFloor !== f) { p.stunUntil = p.faintUntil = p.faintWarp = 0; p.crFloor = f; } // เปลี่ยนชั้น/ออกถ้ำ: เลิกสตัน/สลบค้าง (ไม่วาร์ปผิดชั้น ไม่ค้างสตันในเมือง)
    if (!f) return;
    if (!this.creatureOn(f)) return;
    const F = this.floorOf(f);
    if (!F.creatures) { F.creatures = new Map(); F.crWait = []; }
    F.crOpen = S.crProfile(f).open; F.emptyAt = 0; for (const c of this.creatureFill(F, f, Date.now())) this.sceneBroadcast(CAVE + f, { t: 'crn', c: this.creaturePack(c) }, p); // คนที่อยู่ก่อนเห็นตัวใหม่ผ่าน crn (คนเข้าใหม่ได้ crs เต็มด้านล่าง)
    send(p, { t: 'crs', list: [...F.creatures.values()].map(c => this.creaturePack(c)) });
  },
  creaturePack(c) { return [c.id, c.k, Math.round(c.x), Math.round(c.y), c.dir, c.st, c.hp, c.hpMax]; },
  creatureEligible(F, f, q, now) { return (q.scene || null) === CAVE + f && !((q.faintUntil || 0) > now) && !this.creatureSafe(F, f, q.x, q.y); }, // ผู้เล่นที่ถูกเล็ง/ถูกตีได้
  creatureTick(now) { // เรียกจาก tick() ถี่ๆ ได้ ตัวมันคุมจังหวะ CREATURE.tickMs เอง
    if (!C.on) { for (const F of this.floors.values()) if (F.creatures) { F.creatures = null; F.crWait = null; } return; }
    if (now - (this.crAt || 0) < C.tickMs) return;
    const dt = Math.min(0.25, (now - (this.crAt || now - C.tickMs)) / 1000); this.crAt = now;
    for (const p of this.players.values()) if (p.faintWarp && now >= p.faintWarp) this.creatureWake(p);
    for (const [f, F] of this.floors) {
      if (!F.creatures) continue;
      const mates = this.sceneMates(CAVE + f);
      if (!mates.length) { // ชั้นว่างคน: ไม่อัปเดต รอครบเวลาแล้วเคลียร์ทิ้ง
        if (!F.emptyAt) F.emptyAt = now; else if (now - F.emptyAt >= C.emptyMs) { F.creatures = null; F.crWait = null; F.emptyAt = 0; }
        continue;
      }
      F.emptyAt = 0;
      if (F.crWait.length) { const rest = []; for (const w of F.crWait) { if (now < w.at) { rest.push(w); continue; } const c = this.creatureSpawn(F, f, now, w.spot); if (c) this.sceneBroadcast(CAVE + f, { t: 'crn', c: this.creaturePack(c) }); else { w.at = now + C.spawnRetryMs; rest.push(w); } } F.crWait = rest; }
      const u = [];
      for (const c of F.creatures.values()) {
        this.creatureThink(F, f, c, mates, now, dt);
        const s = [Math.round(c.x), Math.round(c.y), c.dir, c.st, c.hp], o = c.sent;
        if (!o || o[0] !== s[0] || o[1] !== s[1] || o[2] !== s[2] || o[3] !== s[3] || o[4] !== s[4]) { c.sent = s; u.push([c.id, ...s]); }
      }
      if (u.length) this.sceneBroadcast(CAVE + f, { t: 'crm', u });
    }
  },
  creatureThink(F, f, c, mates, now, dt) {
    const K = S.crSpec(c.k), sp = S.crSpeed(c.k, f), pr = S.crProfile(f), el = mates.filter(q => this.creatureEligible(F, f, q, now));
    const tgt = () => { const q = this.players.get(c.tid); return q && el.includes(q) ? q : null; };
    if (c.st === 4) { // พัก/ตกใจ: ค้างคาวถอยห่างจากเป้าหมายระหว่างพัก
      if (K.mode === 'dart' && c.ax !== undefined) { const dx = c.x - c.ax, dy = c.y - c.ay, d = Math.hypot(dx, dy) || 1; this.creatureMove(F, f, c, dx / d * sp * dt, dy / d * sp * dt); }
      if (now >= c.until) { c.st = 0; c.wt = 0; c.tid = 0; }
      return;
    }
    if (c.st === 3) { if (now >= c.until) { c.st = 4; c.until = now + C.restMs; } return; }
    if (c.st === 2) { if (now >= c.until) this.creatureStrike(F, f, c, K, now); return; }
    if (c.st === 0) { // เดินเล่น/ซุ่ม → มองหาผู้เล่น
      if (c.hx !== undefined) { // ผูกจุดบ้าน (ป่า): ออกนอกรัศมี = เดินกลับบ้านก่อน (ไม่สนผู้เล่น) ถึงบ้านแล้วค่อยเดินเล่นต่อ
        const hd = Math.hypot(c.x - c.hx, c.y - c.hy);
        if (!c.ret && hd > pr.leash * TS) c.ret = true;
        if (c.ret) {
          if (hd <= TS * 0.75) { c.ret = false; c.wt = 0; return; }
          const ux = (c.hx - c.x) / hd, uy = (c.hy - c.y) / hd;
          if (this.creatureMove(F, f, c, ux * sp * dt, uy * sp * dt)) c.dir = dirOf(ux, uy); else { c.ret = false; c.wt = 0; }
          return;
        }
      }
      let best = null, bd = K.aggro * TS;
      for (const q of el) { if (c.hx !== undefined && Math.hypot(q.x - c.hx, q.y - c.hy) > (pr.leash + 1) * TS) continue; const d = Math.hypot(q.x - c.x, q.y - c.y); if (d <= bd && this.creatureLos(F, c.x, c.y, q.x, q.y)) { best = q; bd = d; } }
      if (best) { c.tid = best.id; if (K.mode === 'lunge') return this.creatureWind(F, f, c, K, best, now); c.st = 1; return; }
      if (K.mode === 'lunge') return; // งูนอนซุ่มนิ่ง
      if (c.hx !== undefined && Math.hypot(c.x - c.hx, c.y - c.hy) > pr.leash * TS * 0.85) { c.wdx = c.hx - c.x; c.wdy = c.hy - c.y; const n = Math.hypot(c.wdx, c.wdy) || 1; c.wdx /= n; c.wdy /= n; c.wt = now + 600; } // เดินเล่นไกลบ้านเกินไป หันกลับบ้าน
      else if (now >= c.wt) { if (Math.random() < C.wanderIdleP) { c.wdx = c.wdy = 0; c.wt = now + rnd(...C.wanderIdleMs); } else { const a = Math.random() * Math.PI * 2; c.wdx = Math.cos(a); c.wdy = Math.sin(a); c.wt = now + rnd(...C.wanderMoveMs); } }
      if (c.wdx || c.wdy) { if (this.creatureMove(F, f, c, c.wdx * sp * C.wanderMul * dt, c.wdy * sp * C.wanderMul * dt)) c.dir = dirOf(c.wdx, c.wdy); else c.wt = 0; }
      return;
    }
    // st === 1 ไล่
    const q = tgt(); if (!q) { c.st = 0; c.tid = 0; return; }
    const dx = q.x - c.x, dy = q.y - c.y, d = Math.hypot(dx, dy) || 1;
    if (d > K.aggro * TS * C.forget || !this.creatureLos(F, c.x, c.y, q.x, q.y)) { c.st = 0; c.tid = 0; return; }
    if (c.hx !== undefined && Math.hypot(c.x - c.hx, c.y - c.hy) > pr.leash * TS) { c.st = 0; c.tid = 0; c.ret = true; return; } // ไล่เกินรัศมีบ้าน = เลิกไล่ กลับบ้าน
    c.dir = dirOf(dx, dy);
    if (K.mode === 'web' ? d <= K.reach * TS : d <= K.reach * TS * 0.9) return this.creatureWind(F, f, c, K, q, now);
    let ux = dx / d, uy = dy / d;
    if (K.mode === 'dart') { const z = Math.sin(now / 200) * C.dartWobble; ux += -uy * z; uy += ux * z; const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n; } // บินส่าย
    this.creatureMove(F, f, c, ux * sp * dt, uy * sp * dt);
  },
  creatureWind(F, f, c, K, q, now) { // เริ่มง้าง: ส่งวงเตือน cra (วงนี้คือพื้นที่ที่จะโดนจริงตอนจบ)
    const dx = q.x - c.x, dy = q.y - c.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d; c.dir = dirOf(dx, dy); c.ax = q.x; c.ay = q.y; c.ux = ux; c.uy = uy;
    let w;
    if (K.mode === 'web') w = { x: q.x, y: q.y, r: C.webR * TS };
    else if (K.mode === 'lunge') { const L = K.reach * TS; w = { x: c.x + ux * L / 2, y: c.y + uy * L / 2, r: L / 2 + C.lungeR * TS / 2 }; c.len = L; }
    else w = { x: c.x, y: c.y, r: K.reach * TS };
    c.w = w; c.st = 2; c.until = now + K.wind;
    this.sceneBroadcast(CAVE + f, { t: 'cra', id: c.id, x: Math.round(w.x), y: Math.round(w.y), r: Math.round(w.r), ms: K.wind });
  },
  creatureStrike(F, f, c, K, now) { // จบง้าง: ผู้เล่นที่ยังอยู่ในวง = โดน • งู/ค้างคาวพุ่งไปข้างหน้า
    const w = c.w; c.w = null;
    if (K.mode === 'lunge') this.creatureDash(F, f, c, c.ux, c.uy, c.len); else if (K.mode === 'dart') this.creatureDash(F, f, c, c.ux, c.uy, K.reach * TS * C.dartMul);
    if (w) for (const q of this.sceneMates(CAVE + f)) if (this.creatureEligible(F, f, q, now) && Math.hypot(q.x - w.x, q.y - w.y) <= w.r) this.creatureHit(F, f, c, K, q, now);
    c.st = 3; c.until = now + C.tickMs; c.tid = 0;
  },
  creatureKnock(p, c, K) { // ผลักผู้เล่นห่างจากสัตว์ตาม K.knock ช่อง ไม่ทะลุผนัง • คืนว่าขยับไหม
    let moved = false;
    if (K.knock > 0) {
      let dx = p.x - c.x, dy = p.y - c.y; const d = Math.hypot(dx, dy); if (d < 0.01) { dx = 0; dy = 1; } else { dx /= d; dy /= d; }
      for (let left = K.knock * TS; left > 0;) { const s = Math.min(4, left), nx = p.x + dx * s, ny = p.y + dy * s; if (this.blockedFor(p, nx, ny)) break; p.x = nx; p.y = ny; moved = true; left -= s; }
    }
    return moved;
  },
  creatureHit(F, f, c, K, p, now) { // ผลเมื่อผู้เล่นโดน: อมตะชั่วคราว หิวลด สตัน/ใย ผลัก สลบถ้าโดนถี่ • ห้ามตาย ห้ามเสียของ/เหรียญ
    if (now < (p.crInv || 0)) return;
    p.crInv = now + C.invulnMs;
    if (S.crProfile(f).hit === 'hp') return this.combatHit(p, f, c, K, now); // ป่า: โดนตี = เสีย HP (ระบบ combat)
    const web = K.mode === 'web', base = S.creatureHunger(f), want = web ? Math.max(1, Math.round(base / 2)) : base;
    const old = p.rec.hunger; this.setHunger(p, Math.max(0, old - want), true); const lost = Math.round(old - p.rec.hunger); // หิวไม่ต่ำกว่า 0
    const moved = this.creatureKnock(p, c, K);
    if (K.stun > 0) p.stunUntil = Math.max(p.stunUntil || 0, now + K.stun);
    send(p, { t: 'hurt', k: c.k, h: lost, stun: K.stun || 0, x: Math.round(p.x), y: Math.round(p.y) });
    if (moved) send(p, { t: 'tp', x: p.x, y: p.y });
    if (web) send(p, { t: 'web', ms: C.webSlow.ms });
    const Fz = C.faint; p.crHits = (p.crHits || []).filter(t => now - t < Fz.ms); p.crHits.push(now);
    logEv(this.room, 'creature_hit', { p: p.key, f, k: c.k, h: lost });
    if (p.crHits.length >= Fz.hits) { // โดนรัวเกิน = สลบพัก แล้ววาร์ปไปจุดลงบันไดของชั้น
      p.crHits = []; p.faintUntil = now + Fz.restMs; p.stunUntil = Math.max(p.stunUntil || 0, p.faintUntil); p.faintWarp = p.faintUntil;
      send(p, { t: 'faint', ms: Fz.restMs }); logEv(this.room, 'creature_faint', { p: p.key, f, k: c.k });
    }
  },
  creatureWake(p) { // ครบเวลาสลบ: ลุก + วาร์ปไปจุดลงบันไดของชั้น (ชั้น 1 = จุดเกิด)
    p.faintWarp = 0; p.faintUntil = 0; p.stunUntil = 0;
    const f = S.caveFloor(p.scene); if (!f || this.players.get(p.id) !== p) return;
    if (S.isJungle(f)) { this.changeScene(p, CAVE + f, S.JUNGLE.spawn.x, S.JUNGLE.spawn.y); this.combatWake(p); return; } // ป่า: ตื่นที่ค่าย HP ครึ่งหนึ่ง (ไม่เสียของ)
    const at = f === 1 ? S.CAVE.spawn : this.caveLanding(f);
    this.changeScene(p, CAVE + f, at.x, at.y); this.toast(p, '😵 ตื่นแล้ว! ตื่นที่บันไดนะ เดินระวังหน่อย');
  },
  creatureStrikeBy(p, now, tx, ty) { // ผู้เล่นฟาดสัตว์ที่อยู่หน้า (จุดกลางช่อง tx,ty ในรัศมี strikeR ช่อง) • คืน true ถ้าฟาดโดน (ไม่ต้องหาแร่ต่อ)
    const f = S.caveFloor(p.scene); if (!this.creatureOn(f)) return false;
    const F = this.floorOf(f); if (!F.creatures || !F.creatures.size) return false;
    const px = (tx + 0.5) * TS, py = (ty + 0.5) * TS; let best = null, bd = C.strikeR * TS;
    for (const c of F.creatures.values()) { const d = Math.hypot(c.x - px, c.y - py); if (d <= bd) { best = c; bd = d; } }
    if (!best) return false;
    if (Math.hypot(best.x - p.x, best.y - p.y) > C.strikeReach * TS || !this.creatureLos(F, p.x, p.y, best.x, best.y)) return false; // ไกลเกิน/มีผนังบัง ฟาดไม่ได้
    const c = best; this.durUse(p, 'pick'); this.sfx(p, 'chop');
    return this.creatureDamage(F, f, c, p, 1, now);
  },
  creatureDamage(F, f, c, p, dmg, now) { // ผู้เล่นตีสัตว์ได้ dmg (ถ้ำ = 1 จากอีเต้อ • ป่า = ดาบ/มือเปล่า) ตายแล้วเข้าคิวเกิดใหม่ • ป่า: ส่ง d/by ใน crh และแจกของ/XP ให้ทุกคนที่ตีโดน • คืน true
    const pr = S.crProfile(f), jg = pr.id === 'jungle', K = S.crSpec(c.k);
    c.hp -= dmg; if (jg) (c.hitBy || (c.hitBy = new Set())).add(p.id);
    if (c.hp <= 0) {
      F.creatures.delete(c.id); F.crWait.push({ at: now + pr.respawnMs, spot: c.spot });
      if (jg) this.sceneBroadcast(CAVE + f, { t: 'crh', id: c.id, hp: 0, d: dmg, by: p.id });
      this.sceneBroadcast(CAVE + f, { t: 'crd', id: c.id }); logEv(this.room, 'creature_kill', { p: p.key, f, k: c.k });
      if (jg) this.combatKill(c, f, now);
      return true;
    }
    let dx = c.x - p.x, dy = c.y - p.y; const d = Math.hypot(dx, dy) || 1; this.creatureDash(F, f, c, dx / d, dy / d, C.strikeKnock * TS); // ผลักถอย 1 ช่อง
    if (!(jg && K.armor && c.st === 2)) { if (c.st === 2) c.w = null; c.st = 4; c.until = now + C.hitRestMs; c.tid = 0; c.ax = p.x; c.ay = p.y; } // สะดุ้ง ยกเลิกท่าที่ง้างอยู่ (ภูตตอไม้ในป่าทนได้ ท่าไม่ถูกยกเลิก)
    this.sceneBroadcast(CAVE + f, jg ? { t: 'crh', id: c.id, hp: c.hp, d: dmg, by: p.id } : { t: 'crh', id: c.id, hp: c.hp });
    return true;
  },
};
