'use strict';
// ป่าดงดิบ (แผน docs/plans/jungle-map.md): ฉาก '@cave97' เข้า-ออก ยังไม่มีมอนสเตอร์/ต่อสู้/สมุนไพร (ขั้น J4+) ต่อกลับด้วย mix() (ดู server/mixin.js)
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
  jungleAct(p) { // ขั้น J2: ในป่ายังไม่มีอะไรให้กด (ต่อสู้/สมุนไพรทำขั้น J5–J6) กันคลิกถี่เท่านั้น ไม่ตกไป caveAct (อีเต้อ)
    const now = Date.now(); if (now - p.lastAct < 150) return; p.lastAct = now; // ยังไม่ตั้ง activeAt: ในป่าเฟสนี้ยังไม่มีอะไรให้ทำ กดค้างไม่นับเป็นกิจกรรม (J5 ค่อยตั้งเมื่อทำอะไรจริง)
  },
};
