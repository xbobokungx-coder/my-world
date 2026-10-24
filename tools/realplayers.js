'use strict';
// "ผู้เล่นจริง" สำหรับรายงานเศรษฐกิจ/ความเหลื่อมล้ำ: ตัดบัญชีที่แค่เข้ามาดู (ชื่อทดลอง ไอดีที่ไม่ได้ใช้) ออก ตัวเลขจะได้สะท้อนว่าคนที่เล่นจริงทำอะไร
// เกณฑ์: เวลาออนไลน์สะสม (ผลรวม sec ของ event leave) ≥ MIN_MINUTES นาที
//        บัญชีที่ไม่มี event join เลย (เล่นก่อนเริ่มเก็บ event) ใช้ XP รวมทุกอาชีพ ≥ MIN_XP แทน
// ไม่ลบบัญชีใดๆ ใช้กรองตอนวิเคราะห์เท่านั้น • ตัวเลขคู่มือเริ่มต้น/retention ยังต้องนับทุกบัญชี (คนที่หลุดเร็วคือสิ่งที่ต้องวัด)
const MIN_MINUTES = 5, MIN_XP = 150;

function onlineMinutes(evs) { // 'ห้อง/key' → นาทีออนไลน์สะสม
  const m = new Map();
  for (const e of evs) if (e.e === 'leave' && e.sec > 0) { const k = e.room + '/' + e.p; m.set(k, (m.get(k) || 0) + e.sec / 60); }
  return m;
}
// players: [{ room, key, rec }] • evs: event ทั้งหมด (ทุกวัน ไม่ใช่แค่ช่วงรายงาน) → Set ของ 'ห้อง/key'
function realSet(players, evs) {
  const mins = onlineMinutes(evs), joined = new Set(evs.filter(e => e.e === 'join').map(e => e.room + '/' + e.p)), out = new Set();
  for (const p of players) {
    const k = p.room + '/' + p.key, xp = Object.values((p.rec && p.rec.skills) || {}).reduce((a, b) => a + (b || 0), 0);
    if (joined.has(k) ? (mins.get(k) || 0) >= MIN_MINUTES : xp >= MIN_XP) out.add(k);
  }
  return out;
}
module.exports = { MIN_MINUTES, MIN_XP, onlineMinutes, realSet };
