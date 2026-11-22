'use strict';
// ระบบต่อสู้ในป่าดงดิบ (J5–J6, docs/plans/jungle-map.md ข้อ 5–7): HP ในฉาก p.cb (ไม่เซฟ) ดาบไม้/มือเปล่า ฟีเล็งอัตโนมัติ ฮีล สลบ→ตื่นที่ค่าย ของตก XP นักสู้ พุ่มสมุนไพร
// ห้ามชื่อ fight (ชน S.FIGHT ชักเย่อปลา) • ตัวเลขทั้งหมดอยู่ S.COMBAT / S.JUNGLE_MON / S.JUNGLE • สวิตช์ JUNGLE.mon.on=false = ไม่มี cb/มอนสเตอร์/สมุนไพร (ป่าเปล่า)
// p.cb = { hp, mx, st:'ok'|'faint', last (ms ที่ต่อสู้ล่าสุด), healAt (สมุนไพรกินได้อีกเมื่อ), sentAt, sentKey, pend } • สมุนไพรเกิดใหม่ this.jgHerb (Map 'x,y' → ms ที่งอกใหม่) ใน RAM
const S = require('../../public/shared.js');
const { TS } = S;
const { send, logEv } = require('../util.js');
const { CAVE } = require('../consts.js');

const K = S.COMBAT, JF = S.JUNGLE.floor;

module.exports = {
  combatMax(p) { return K.hpBase + K.hpPerLv * (S.levelOf(p.rec.skills && p.rec.skills.fight, 'fight') - 1); },
  combatAtk(p) { const t = S.swordTier(p.rec.inv); return t && K.swordDmg[t] ? K.swordDmg[t] : K.bareDmg; }, // ดาเมจต่อครั้ง: ถือดาบ sword_N ในกระเป๋า = ตามระดับ • ไม่มี = มือเปล่า
  herbList(now) { const m = this.jgHerb || (this.jgHerb = new Map()); return S.JUNGLE.herbs.map(([x, y]) => [x, y, (m.get(x + ',' + y) || 0) > now ? 0 : 1]); },
  combatOnScene(p) { // เรียกจาก creatureOnScene (ท้าย changeScene): เข้าป่า = HP เต็ม + ส่ง cb/jh • อยู่ในป่าอยู่แล้ว (ตื่นที่ค่าย) = คง HP • ออกจากป่า = ทิ้ง HP
    if (!S.isJungle(S.caveFloor(p.scene)) || !S.JUNGLE.mon.on) { p.cb = null; return; }
    const mx = this.combatMax(p);
    if (!p.cb) p.cb = { hp: mx, mx, st: 'ok', last: 0, healAt: 0, sentAt: 0, sentKey: '', pend: false }; else { p.cb.mx = mx; p.cb.hp = Math.min(p.cb.hp, mx); }
    this.combatPush(p, true);
    send(p, { t: 'jh', list: this.herbList(Date.now()) });
  },
  combatPush(p, force, at) { // ส่ง cb {hp,mx,st,ms?} เมื่อค่าเปลี่ยน ไม่ถี่เกิน K.pushMs (≤4/วิ) • force = เหตุการณ์สำคัญ (เข้าป่า สลบ ตื่น)
    const b = p.cb; if (!b) return; const now = at || Date.now();
    const hp = b.hp <= 0 ? 0 : Math.max(1, Math.min(b.mx, Math.round(b.hp))), key = hp + '|' + b.mx + '|' + b.st;
    if (!force) { if (key === b.sentKey) { b.pend = false; return; } if (now - b.sentAt < K.pushMs) { b.pend = true; return; } }
    b.sentAt = now; b.sentKey = key; b.pend = false;
    const m = { t: 'cb', hp, mx: b.mx, st: b.st }; if (b.st === 'faint') m.ms = Math.max(0, (p.faintUntil || 0) - now);
    send(p, m);
  },
  combatHeal(p, n) { const b = p.cb; if (!b || b.st !== 'ok' || !(n > 0)) return; b.hp = Math.min(b.mx, b.hp + n); this.combatPush(p); },
  combatHit(p, f, c, JK, now) { // มอนสเตอร์ตีโดนผู้เล่น (เรียกจาก creatureHit หลังเช็กอมตะแล้ว): ผลัก/สตันตามชนิด เสีย HP ถึง 0 = สลบ
    const b = p.cb; if (!b || b.st !== 'ok') return;
    const dmg = JK.dmg; b.last = now; b.hp = Math.max(0, b.hp - dmg);
    const moved = this.creatureKnock(p, c, JK);
    if (JK.stun > 0) p.stunUntil = Math.max(p.stunUntil || 0, now + JK.stun);
    send(p, { t: 'hurt', k: c.k, d: dmg, stun: JK.stun || 0, x: Math.round(p.x), y: Math.round(p.y) });
    if (moved) send(p, { t: 'tp', x: p.x, y: p.y });
    logEv(this.room, 'creature_hit', { p: p.key, f, k: c.k, d: dmg });
    if (b.hp <= 0) { // สลบ: ไม่เสียของ/เหรียญ/ความทน ครบเวลาแล้ว creatureWake พาไปตื่นที่ค่าย
      b.st = 'faint'; p.faintUntil = now + K.faintMs; p.stunUntil = Math.max(p.stunUntil || 0, p.faintUntil); p.faintWarp = p.faintUntil;
      send(p, { t: 'faint', ms: K.faintMs }); this.toast(p, '😵 สลบแล้ว! เดี๋ยวพากลับเมืองนะ ของกับเหรียญไม่หายไหน');
      logEv(this.room, 'creature_faint', { p: p.key, f, k: c.k }); this.combatPush(p, true);
    } else this.combatPush(p);
  },
  combatWake(p) { // ตื่นที่ค่าย (หลัง creatureWake ย้ายฉากแล้ว): HP ครึ่งหนึ่ง
    const b = p.cb; if (!b) return; const now = Date.now();
    b.hp = Math.max(1, Math.ceil(b.mx * K.wakePct)); b.st = 'ok'; b.last = now; this.combatPush(p, true);
    this.toast(p, '😵 ตื่นแล้ว! อยู่ที่ค่าย ฟื้น HP มาครึ่งหนึ่ง พักให้เต็มก่อนออกไปลุยใหม่ได้นะ');
  },
  combatXp(p, n) { // XP นักสู้ (rec.skills.fight ตารางเดิม ไม่ใช่ S.SKILLS เลยไม่ผ่าน addXp) • เลเวลขึ้น = HP เต็มสูงขึ้น
    const r = p.rec.skills, before = S.levelOf(r.fight, 'fight'); r.fight = (r.fight || 0) + n;
    send(p, { t: 'skills', skills: r }); const after = S.levelOf(r.fight, 'fight');
    if (after > before) { logEv(this.room, 'level', { p: p.key, skill: 'fight', lv: after }); this.toast(p, `🎉 ⚔️ นักสู้ เลเวล ${after}! HP เต็มเพิ่มขึ้นแล้ว`); this.sfxTo(p, 'levelup'); if (p.cb) { p.cb.mx = this.combatMax(p); this.combatPush(p, true); } }
    this.dirty = true;
  },
  combatKill(c, f, now) { // สัตว์ตาย: ทุกคนที่ตีโดนได้ XP นักสู้ + ลุ้นของตก (แยกกันต่อคน) • ต้องยังอยู่ในป่า
    const JK = S.JUNGLE_MON[c.k]; if (!JK || !c.hitBy) return;
    for (const id of c.hitBy) {
      const q = this.players.get(id); if (!q || (q.scene || null) !== CAVE + f) continue;
      this.combatXp(q, JK.xp);
      if (Math.random() < JK.drop.p) { this.add(q, JK.drop.item, 1, 'jgdrop'); this.toast(q, `${S.JM_ITEMS[JK.drop.item].emoji} ได้ ${S.JM_ITEMS[JK.drop.item].name} x1`); logEv(this.room, 'jg_drop', { p: q.key, k: c.k, item: JK.drop.item }); }
    }
  },
  combatSwing(p, m) { // กด Action ในป่า: มอนสเตอร์ในกรวยหน้า > พุ่มสมุนไพร > ป้ายออก > ฟันลม • เซิร์ฟเวอร์เลือกเอง ไม่สน m.tool
    const now = Date.now(), b = p.cb; if (!b || b.st !== 'ok' || now < (p.stunUntil || 0)) return;
    if (now - (p.hitAt || 0) < S.SWING_MS - K.swingGrace) return; // จังหวะไม่ถี่กว่าความยาวท่า (เผื่อเน็ตแกว่ง)
    const px = Math.floor(p.x / TS), py = Math.floor(p.y / TS); let tx, ty;
    if (Number.isInteger(m.tx) && Number.isInteger(m.ty)) { // แตะเลือกช่องเอง ต้องอยู่ใกล้ (เหมือนขุดแร่)
      if (m.tx < 0 || m.ty < 0 || m.tx >= S.W || m.ty >= S.H || Math.max(Math.abs(m.tx - px), Math.abs(m.ty - py)) > 2) return this.toast(p, 'ไกลเกินไป เดินเข้าไปใกล้ๆ ก่อน');
      tx = m.tx; ty = m.ty; const dx = tx - px, dy = ty - py;
      if (dx || dy) p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
    } else [tx, ty] = S.facing(p.x, p.y, p.dir);
    p.hitAt = p.activeAt = now; if (now - (p.swAt || 0) > 1500) this.sceneBroadcast(p.scene, { t: 'use', id: p.id }, p);
    // 1) มอนสเตอร์ในกรวย (ระยะ K.reach ช่อง มุม K.cone องศา มีสายตาถึง) ใกล้สุดก่อน
    const F = this.floorOf(JF), v = S.DIRS[p.dir] || S.DIRS[0], cosHalf = Math.cos(K.cone / 2 * Math.PI / 180);
    let best = null, bd = K.reach * TS;
    if (F.creatures) for (const c of F.creatures.values()) {
      const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy); if (d > bd) continue;
      if (d > 1e-3 && (dx * v[0] + dy * v[1]) / d < cosHalf - 1e-9) continue;
      if (!this.creatureLos(F, p.x, p.y, c.x, c.y)) continue;
      best = c; bd = d;
    }
    if (best) {
      if (S.jungleSafe(p.x, p.y)) return this.toast(p, '🏕️ ในเขตปลอดภัยฟันไม่ได้นะ เดินออกมานอกเขตก่อน');
      b.last = now; this.sfx(p, 'chop'); return this.creatureDamage(F, JF, best, p, this.combatAtk(p), now);
    }
    // 2) พุ่มสมุนไพร
    if (S.JUNGLE.herbs.some(h => h[0] === tx && h[1] === ty)) {
      const key = tx + ',' + ty, hm = this.jgHerb || (this.jgHerb = new Map());
      if ((hm.get(key) || 0) > now) return this.toast(p, '🌿 พุ่มนี้ยังไม่งอก รอสักพักนะ');
      hm.set(key, now + S.JUNGLE.herbMs); this.add(p, 'jherb', S.JUNGLE.herbN, 'jgherb');
      this.sceneBroadcast(p.scene, { t: 'jh1', x: tx, y: ty, r: 0 }); this.sfx(p, 'collect');
      this.toast(p, `🌿 เก็บสมุนไพรป่า x${S.JUNGLE.herbN} (กินแล้วฟื้น HP ${K.herbHeal})`); logEv(this.room, 'jg_herb', { p: p.key }); return;
    }
    // 3) ป้ายกลับหมู่บ้านในค่าย
    if (tx === S.JUNGLE.sign.x && ty === S.JUNGLE.sign.y) return this.jungleLeave(p);
    // 4) ฟันลม (แจ้งไม่ถี่)
    if (now - (p.cbIdleAt || 0) >= K.idleToastMs) { p.cbIdleAt = now; this.toast(p, '⚔️ ยังไม่มีอะไรให้ฟัน มอนสเตอร์ต้องอยู่ข้างหน้าใกล้ๆ นะ'); }
  },
  combatUseHerb(p) { // กิน jherb (eat {item:'jherb'}): ฟื้น HP ในป่าเท่านั้น คูลดาวน์ K.herbCdMs • HP เต็มไม่กิน (ไม่เสียของ)
    const b = p.cb, now = Date.now();
    if (!b) return this.toast(p, '🌿 สมุนไพรป่าใช้ฟื้น HP ได้ตอนอยู่ในป่าดงดิบเท่านั้นนะ');
    if (b.st !== 'ok' || !(p.rec.inv.jherb > 0)) return;
    if (b.hp >= b.mx - 0.5) return this.toast(p, '💚 HP เต็มอยู่แล้ว เก็บสมุนไพรไว้ก่อนนะ');
    if (now < b.healAt) return this.toast(p, `🌿 เพิ่งกินไป รออีก ${Math.ceil((b.healAt - now) / 1000)} วิ`);
    b.healAt = now + K.herbCdMs; this.add(p, 'jherb', -1, 'jgherb'); this.combatHeal(p, K.herbHeal);
    this.toast(p, `🌿 กินสมุนไพร ฟื้น HP +${K.herbHeal}`); this.sfx(p, 'eat');
  },
  combatTick(now) { // ฟื้น HP ตามเวลา (พ้นการต่อสู้ K.regenIdleMs +regenRate/วิ • เขตปลอดภัย +regenSafe/วิ) ส่ง cb ที่ค้างรอ • สมุนไพรที่ครบเวลางอกใหม่ (jh1 r:1)
    if (now - (this.cbAt || 0) < K.pushMs) return;
    const dt = Math.min(0.5, (now - (this.cbAt || now - K.pushMs)) / 1000); this.cbAt = now;
    for (const p of this.players.values()) {
      const b = p.cb; if (!b) continue;
      if (b.st === 'ok' && b.hp < b.mx) {
        const rate = S.jungleSafe(p.x, p.y) ? K.regenSafe : now - b.last >= K.regenIdleMs ? K.regenRate : 0;
        if (rate > 0) b.hp = Math.min(b.mx, b.hp + rate * dt);
      }
      this.combatPush(p, false, now);
    }
    const hm = this.jgHerb; if (hm && hm.size) for (const [key, at] of hm) if (now >= at) { hm.delete(key); const [x, y] = key.split(',').map(Number); this.sceneBroadcast(CAVE + JF, { t: 'jh1', x, y, r: 1 }); }
  },
};
