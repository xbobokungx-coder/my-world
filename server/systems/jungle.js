'use strict';
// ป่าดงดิบ (แผน docs/plans/jungle-map.md): ฉาก '@cave97' เข้า-ออก • มอนสเตอร์ = creatures.js (โปรไฟล์ jungle) ต่อสู้/สมุนไพร = combat.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { TS } = S;
const { CAVE } = require('../consts.js'); // สตริง '@cave'

module.exports = {
  jungleGateFront() { const G = S.JGATE; return { x: (G.door[0] + G.door[2] + 1) / 2 * TS, y: (G.y0 - 0.5) * TS }; }, // ช่องเหนือซุ้มประตูป่า (ไม่ซ้อนช่อง trigger) ออกจากป่ามายืนตรงนี้
  jungleDoorAt(x, y) { const G = S.JGATE, tx = Math.floor(x / TS), ty = Math.floor(y / TS); return tx >= G.door[0] && tx <= G.door[2] && ty >= G.door[1] && ty <= G.door[3]; }, // พิกัดพิกเซลอยู่ในช่องประตู (เดินทับ = เข้า)
  jungleWalk(p) { // เดินทับช่องประตู: กันยิงรัว (toast ตอนปิดสวิตช์) • ตอนเพิ่งออกจากป่ายืนที่ช่องเหนือซุ้ม ไม่ซ้อน trigger จึงไม่วนเข้าซ้ำ
    const now = Date.now(); if (now - (p.jgWalkAt || 0) < 1500) return; p.jgWalkAt = now;
    this.jungleEnter(p);
  },
  jungleEnter(p) { // เรียกตอน act ที่ช่อง jgateAt (ก่อนด่านหิว/เหนื่อย)
    if (p.scene) return;
    if (!S.JUNGLE.open) return this.toast(p, '🌿 ป่าดงดิบกำลังเตรียมตัว เร็วๆ นี้!');
    if (p.veh) this.setVeh(p, '');
    this.arcLeave(p); this.tradeCancel(p, 'ผู้เล่นเข้าป่า'); if (this.cinema.viewers.delete(p.id)) this.cinemaBroadcast();
    p.ret = this.jungleGateFront();
    this.changeScene(p, CAVE + S.JUNGLE.floor, S.JUNGLE.spawn.x, S.JUNGLE.spawn.y);
    this.toast(p, '🌿 เข้าป่าดงดิบแล้ว! ต้นไม้ในป่าตัดไม่ได้ • ทางออกอยู่ขอบบน');
  },
  jungleLeave(p, msg) { // เดินถึง T.MOUTH ขอบบน → กลับหน้าประตูเมือง (townPos ใช้ p.ret ที่ตั้งตอนเข้า)
    if (!S.isJungle(S.caveFloor(p.scene))) return;
    this.leaveCave(p); this.toast(p, msg || '🌿 ออกจากป่าดงดิบแล้ว');
  },
  jungleAct(p, m) { // กด Action ในป่า: ฟัน/เก็บสมุนไพร/ป้ายออก ตัดสินใน combatSwing (สวิตช์ JUNGLE.mon.on=false = ไม่ทำอะไร ไม่ตกไป caveAct อีเต้อ)
    const now = Date.now(); if (now - p.lastAct < 150) return; p.lastAct = now;
    { const J = S.JUNGLE.lucky, hasT = m && Number.isInteger(m.tx) && Number.isInteger(m.ty), [fx, fy] = hasT ? [m.tx, m.ty] : S.facing(p.x, p.y, p.dir); if (fx === J.x && fy === J.y) return this.luckAsk(p); } // ต้นตะเคียน = ขอเลขเด็ด
    if (p.cb) this.combatSwing(p, m && typeof m === 'object' ? m : {});
  },
};
