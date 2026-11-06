'use strict';
// ถ้ำเหมือง ก้อนแร่ ตั๋วลงเหมือง ขุดแร่: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { TS, T } = S;
const { send, logEv } = require('../util.js');
const { CAVE } = require('../consts.js'); // สตริง '@cave' (ไม่ใช่ S.CAVE ที่เป็นกล่องพิกัดถ้ำ)

module.exports = {
  // ----- ถ้ำเหมือง 10 ชั้น: แต่ละชั้นเป็นฉากร่วมของทั้งห้อง (p.scene = CAVE + เลขชั้น เช่น '@cave3') ผังสุ่มตายตัวจาก S.makeCaveMap(ชั้น) ก้อนแร่ขุดแล้วเกิดใหม่ตามเวลา (ไม่เก็บลงไฟล์ เริ่มเซิร์ฟเวอร์ใหม่ = แร่เต็ม)
  // ชั้นสร้างตอนมีคนเข้าครั้งแรก: { map: ผัง (ก้อนแร่เป็น T.ORE), ores: Map 'x,y' → {k ชนิด, s ขนาด}, hp: Map HP ที่เหลือ, wait: คิวเกิดใหม่ }
  initCave() { this.floors = new Map(); },
  floorOf(f) {
    let F = this.floors.get(f); if (F) return F;
    const map = S.makeCaveMap(f), ores = new Map();
    if (!S.isSeaScene(f)) for (const o of S.caveOreSpots(map, f)) { ores.set(o.x + ',' + o.y, { k: o.k, s: o.s }); map[o.y][o.x] = T.ORE; }
    F = { map, ores, hp: new Map(), wait: [], cap: Math.max(1, ores.size) }; this.floors.set(f, F); return F; // cap = จำนวนก้อนเต็มของชั้น (ไว้คิดโควตาชนิดแร่ตอนเกิดใหม่)
  },
  oresPub(f) { return [...this.floorOf(f).ores].map(([k, o]) => { const [x, y] = k.split(',').map(Number); return [x, y, o.k, o.s]; }); },
  oreSpot(F, f, mates, old) { // ช่องสำหรับก้อนแร่ใหม่ในชั้น f (ช่องเดิม old ก่อน ไม่ได้ค่อยสุ่ม): เป็นพื้นว่าง ไม่ใกล้ทางออก/บันไดลง/ผู้เล่น และพื้นที่เดินที่เหลือยังต่อถึงกันหมด ทุกก้อนยังมีที่ยืนขุด (กติกาเดียวกับตอนวางครั้งแรก) • ไม่พบ = null
    if (F.open === undefined) { let n = 0; for (const r of F.map) for (const c of r) if (S.caveOpen(c)) n++; F.open = n + F.ores.size; } // พื้นเดินได้ทั้งหมดถ้าไม่มีก้อนแร่
    const m = F.map, free = (x, y) => S.DIRS.filter(([dx, dy]) => S.caveOpen(m[y + dy][x + dx])).length;
    const cand = []; // ทุกช่องที่ผ่านเงื่อนไขเบื้องต้น แล้วสุ่มลำดับ (แร่ห่างกันหลายช่อง ช่องที่ใช้ได้มีน้อย สุ่มเดาจะพลาดบ่อย)
    for (let y = S.CAVE.y0 + 1; y < S.CAVE.y1; y++) for (let x = S.CAVE.x0 + 1; x < S.CAVE.x1; x++) {
      if (m[y][x] !== T.CAVE || Math.hypot(x - 31, y - (S.CAVE.y1 - 1)) < 5 || !free(x, y) || S.oreNear(m, x, y)) continue; // ห่างก้อนอื่นอย่างน้อย MINE.oreGap ช่อง
      if ([-1, 0, 1].some(dy => [-1, 0, 1].some(dx => m[y + dy][x + dx] === S.T.DOWN))) continue;
      if (mates.some(q => Math.abs(q.x - (x + 0.5) * TS) < TS * 1.5 && Math.abs(q.y - (y + 0.5) * TS) < TS * 1.5)) continue;
      cand.push([x, y]);
    }
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    const at = old ? cand.findIndex(([x, y]) => x === old.x && y === old.y) : -1; if (at > 0) cand.unshift(cand.splice(at, 1)[0]); // ช่องเดิมที่เพิ่งขุด (old) ลองก่อน ถ้าไม่ผ่านเงื่อนไขค่อยใช้ช่องสุ่มอื่น
    for (const [x, y] of cand.slice(0, 40)) {
      m[y][x] = T.ORE;
      const ok = S.caveReach(m) === F.open - F.ores.size - 1 && !S.DIRS.some(([dx, dy]) => m[y + dy][x + dx] === T.ORE && !free(x + dx, y + dy));
      m[y][x] = T.CAVE;
      if (ok) return [x, y];
    }
    return null;
  },
  oreTick(now) { // ก้อนแร่ที่ขุดไปครบเวลา MINE.respawnMs เกิดใหม่ที่ช่องเดิม (ถ้าไม่ว่างค่อยสุ่มช่องใหม่) ในชั้นเดิม (สุ่มชนิด/ขนาดใหม่ตามชั้น ไม่มีช่องใหม่ = เกิดที่เดิม)
    for (const [f, F] of this.floors) {
      if (!F.wait.length) continue;
      const rest = [], mates = this.sceneMates(CAVE + f), counts = {}; for (const o of F.ores.values()) counts[o.k] = (counts[o.k] || 0) + 1;
      for (const w of F.wait) {
        if (now < w.at) { rest.push(w); continue; }
        const spot = this.oreSpot(F, f, mates, w) || (S.oreNear(F.map, w.x, w.y) || mates.some(q => Math.abs(q.x - (w.x + 0.5) * TS) < TS && Math.abs(q.y - (w.y + 0.5) * TS) < TS) ? null : [w.x, w.y]);
        if (!spot) { w.at = now + 5000; rest.push(w); continue; } // ไม่มีที่ให้เกิด/มีคนยืนทับที่เดิม รอรอบหน้า
        const [x, y] = spot, o = { k: S.rollOreQuota(f, Math.random, counts, F.cap), s: S.rollSize(Math.random, f) }; counts[o.k] = (counts[o.k] || 0) + 1;
        F.ores.set(x + ',' + y, o); F.map[y][x] = T.ORE;
        this.sceneBroadcast(CAVE + f, { t: 'ore', x, y, k: o.k, s: o.s });
      }
      F.wait = rest;
    }
  },
  enterCave(p) {
    if (p.scene) return;
    if (p.veh) this.setVeh(p, '');
    this.arcLeave(p); this.tradeCancel(p, 'ผู้เล่นเข้าถ้ำ'); if (this.cinema.viewers.delete(p.id)) this.cinemaBroadcast();
    p.ret = { x: (Math.floor(p.x / TS) + 0.5) * TS, y: (S.MINE.y + 1.5) * TS }; // ออกมายืนหน้าปากถ้ำ (ไม่ทับช่องปากถ้ำ ไม่งั้นเข้าซ้ำ)
    this.changeScene(p, CAVE + 1, S.CAVE.spawn.x, S.CAVE.spawn.y);
    this.toast(p, '⛏️ เข้าถ้ำเหมือง ชั้น 1! ใช้อีเต้อ ⚒️ (ร้านช่างเหมือง) ขุดก้อนแร่ • บันไดลงอยู่ห้องไกลสุด ยิ่งลึกยิ่งได้แร่ดี • พกตะเกียง 🔦 จะเห็นไกลขึ้น • ทางออกกลางผนังล่าง');
  },
  leaveCave(p) {
    if (!S.caveFloor(p.scene)) return;
    const r = this.townPos(p); p.ret = null;
    this.changeScene(p, null, r.x, r.y);
  },
  caveLanding(f) { // ช่องยืนข้างบันไดลงของชั้น f (ขึ้นมาจากชั้นล่างแล้วไม่ทับบันไดจนลงซ้ำ)
    const F = this.floorOf(f); if (F.landing) return F.landing;
    let best = null;
    for (let y = 0; y < S.H && !best; y++) for (let x = 0; x < S.W && !best; x++) if (F.map[y][x] === T.DOWN) {
      for (const [dx, dy] of S.DIRS) if (F.map[y + dy][x + dx] === T.CAVE) { best = { x: (x + dx + 0.5) * TS, y: (y + dy + 0.5) * TS }; break; }
    }
    return F.landing = best || S.CAVE.spawn;
  },
  caveMove(p, f, to) { // ย้ายชั้น (to = ชั้นใหม่) ขึ้นมาจากชั้นล่างยืนข้างบันไดลง ลงมาจากชั้นบนยืนที่จุดเกิด
    const at = to < f ? this.caveLanding(to) : S.CAVE.spawn;
    if (!S.isSeaScene(to) && to > (p.rec.deep || 1) && to <= S.MINE.floors) { p.rec.deep = to; send(p, { t: 'deep', n: to }); this.dirty = true; } // จำชั้นลึกสุดที่เดินลงถึง (ไว้ซื้อตั๋วลงตรง)
    this.changeScene(p, CAVE + to, at.x, at.y);
    this.toast(p, `⛏️ ถ้ำเหมือง ชั้น ${to}${to === S.MINE.floors ? ' (ชั้นลึกสุด มิทริล 70% มูนสโตน 30%)' : ''} • แร่ส่วนใหญ่ระดับ ${to}`);
  },
  mineTicket(p, f) { // ตั๋วลงเหมือง: จ่ายเหรียญลงตรงไปชั้น f (≤ ชั้นลึกสุดที่เดินลงถึงเอง) ต้องอยู่ในเมืองใกล้ร้านช่างเหมือง • เงินจมล้วน (ลงเดินเองฟรีเหมือนเดิม)
    if (!Number.isInteger(f) || f < 2 || f > S.MINE.floors) return;
    if (p.scene) return this.toast(p, 'ซื้อตั๋วลงเหมืองได้ตอนอยู่ในเมือง');
    if (this.nearShopKind(p) !== 'mine') return this.toast(p, 'ต้องยืนใกล้ร้านช่างเหมือง ⚒️ ถึงซื้อตั๋วได้');
    if (f > (p.rec.deep || 1)) return this.toast(p, `ยังไม่เคยลงถึงชั้น ${f} ลงเดินเองให้ถึงชั้นนี้ก่อนครั้งแรก แล้วค่อยซื้อตั๋วได้`);
    const fee = S.MINE.fee[f]; if ((p.rec.inv.coin || 0) < fee) return this.toast(p, `เหรียญไม่พอ ตั๋วลงชั้น ${f} ราคา 🪙${fee}`);
    this.add(p, 'coin', -fee, 'mineticket'); logEv(this.room, 'mineticket', { p: p.key, f, fee });
    this.enterCave(p); if (S.caveFloor(p.scene) !== 1) { this.add(p, 'coin', fee, 'mineticket'); return; } // เข้าถ้ำไม่ได้ (เช่นมีเงื่อนไขอื่นขวาง) คืนเงิน
    this.caveMove(p, 1, f); this.toast(p, `🎫 ใช้ตั๋วลงชั้น ${f} (-🪙${fee})`); this.sfxTo(p, 'coin');
  },
  caveAct(p, m) { // ใช้เครื่องมือในถ้ำ: ขุดแร่ด้วยอีเต้ออย่างเดียว
    const now = Date.now();
    if (now - p.lastAct < 150) return;
    p.lastAct = p.activeAt = now;
    if (m.tool !== 'pick') return;
    p.workAt = now; if (now - (p.swAt || 0) > 1500) this.sceneBroadcast(p.scene, { t: 'use', id: p.id }, p);
    if (now - (p.hitAt || 0) < S.SWING_MS - 150) return; p.hitAt = now; // ฟาดได้ไม่ถี่กว่าความยาวท่า (เผื่อเน็ตแกว่ง 150 ms)
    this.pickAct(p, now, m.tx, m.ty);
  },
  pickAct(p, now, cx, cy) {
    const inv = p.rec.inv, pick = S.pickTier(inv), cf = S.caveFloor(p.scene), F = this.floorOf(cf);
    if (!pick) return this.toast(p, 'ต้องมีอีเต้อก่อน ซื้อได้ที่ร้านช่างเหมือง ⚒️ (หน้าถ้ำ)');
    if (p.rec.hunger <= 0) return this.toast(p, '😵 หิวจนไม่มีแรง! ไปกินอาหารก่อนนะ (ร้านอาหาร หรือกินผลผลิตจากกระเป๋า)');
    if (!this.durOk(p, 'pick')) return;
    let [tx, ty] = S.facing(p.x, p.y, p.dir);
    if (Number.isInteger(cx) && Number.isInteger(cy)) { // คลิกเลือกก้อนแร่เอง ต้องอยู่ใกล้
      const px = Math.floor(p.x / TS), py = Math.floor(p.y / TS);
      if (cx < 0 || cy < 0 || cx >= S.W || cy >= S.H || Math.max(Math.abs(cx - px), Math.abs(cy - py)) > 2) return this.toast(p, 'ไกลเกินไป เดินเข้าไปใกล้ๆ ก่อน');
      tx = cx; ty = cy;
      const dx = cx - px, dy = cy - py;
      if (dx || dy) p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
    }
    const key = tx + ',' + ty, ore = F.ores.get(key);
    if (!ore) return this.toast(p, 'ใช้อีเต้อขุดก้อนแร่ในถ้ำ 🪨 (หันหน้าหาก้อนแร่ หรือแตะที่ก้อนแร่)');
    const kid = ore.k, O = S.ORES[kid], ml = this.lv(p, 'mine');
    if (ml < O.lv) return this.toast(p, `🔒 ${O.emoji} ${O.name}ต้องเป็นนักขุดแร่ Lv${O.lv} ขึ้นไป`);
    const mh = S.mineHit(inv, kid, ore.s); // ดาเมจ/สึก/โบนัสตามอุปกรณ์ขุดเทียบแร่ (ต่ำกว่าแร่กี่ระดับก็ขุดได้ ยิ่งต่ำยิ่งช้า)
    if (!mh) return;
    let h = F.hp.get(key);
    if (!h || now - h.t > 20000) h = { hp: S.oreHp(kid, ore.s), t: now };
    if (!h.slowWarn && mh.slow) { h.slowWarn = true; this.toast(p, `🐌 ${S.PICKS[pick].name}ต่ำกว่าที่${O.name}ต้องการ ${mh.down} ระดับ ขุดได้แต่ช้าและของสึกไว`); }
    h.hp -= mh.dmg; h.t = now; h.n = (h.n || 0) + 1;
    this.sfx(p, 'chop');
    if (h.hp > 0) { F.hp.set(key, h); this.sceneBroadcast(p.scene, { t: 'oh', x: tx, y: ty, f: +(h.hp / S.oreHp(kid, ore.s)).toFixed(2) }); const left = Math.ceil(h.hp / mh.dmg - 1e-9); if (left <= 3 || left % 5 === 0) this.toast(p, `⚒️ ${O.emoji} ${O.name}ก้อน${S.ORE_SIZES[ore.s].name} อีก ${left} ครั้ง`); return; }
    { const wf = Math.floor(mh.wear), wn = wf + (Math.random() < mh.wear - wf ? 1 : 0); for (let i = 0; i < wn; i++) { if (!this.durCur(p, 'pick')) break; this.durUse(p, 'pick'); } } // ขุดแตก 1 ก้อน = อีเต้อสึก ~1 ครั้ง (ไม่นับทุกครั้งที่ฟาด) ×ตัวคูณ: ต่ำกว่าแร่ ×2 / สูงกว่าแร่และถุงมือสึกน้อยลง
    F.hp.delete(key); F.ores.delete(key); F.map[ty][tx] = T.CAVE;
    F.wait.push({ x: tx, y: ty, at: now + S.MINE.respawnMs });
    this.sceneBroadcast(p.scene, { t: 'ore', x: tx, y: ty, k: '' });
    let n = S.rollDrop(ore.s, Math.random); let bonus = false;
    if (Math.random() < mh.extra) { n++; bonus = true; }
    const xp = O.xp * n; // XP นับทุกชิ้น รวมชิ้นโบนัสจากอุปกรณ์สูงกว่าแร่
    const val = O.sell * n;
    this.add(p, kid, n);
    this.addXp(p, 'mine', S.oreXp(xp, ml)); this.tire(p, 'mine', val);
    if (!this.bookOf(p).ore[kid]) { const dx = Math.round(O.xp * S.MINE.discover); this.addXp(p, 'mine', dx); this.toast(p, `✨ ค้นพบแร่ใหม่ ${O.emoji} ${O.name}! โบนัส XP +${dx}`); this.bookAdd(p, 'ore', kid); } // ครั้งแรกของแร่ชนิดนี้
    if (this.petLuck(p, O.emoji + ' ' + O.name)) this.add(p, kid, 1);
    this.toast(p, `⛏️ ขุดได้ ${O.emoji} ${O.name} x${n} (ก้อน${S.ORE_SIZES[ore.s].name})${bonus ? ' ✨ อุปกรณ์แรง ได้เพิ่ม' : ''}`); this.sfx(p, 'fell'); this.event(p, 'mine');
    logEv(this.room, 'mine', { p: p.key, f: cf, k: kid, s: ore.s, n, hits: h.n, pk: pick, slow: mh.slow ? 1 : 0, ml }); // บันทึกการขุดละเอียด (ชนิด ขนาด ชั้น อีเต้อ ครั้งที่ฟาด) ไว้วัดก้อน/ชม. และเวลาต่อเลเวล • tools/stats.js สรุป
  },
};
