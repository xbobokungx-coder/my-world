// จำลองความผูกพันสัตว์เลี้ยง: ผู้เล่นออนไลน์ใช้งานตลอดพร้อมพาสัตว์ออก ดูว่ากี่ชั่วโมงถึงแต่ละระดับ
//   node tools/petsim.js            ใช้ค่าจาก shared.js (PETLV.walk/feed/pat/patCdMs/need)
//   node tools/petsim.js 0.5 6 8    ลองค่า walk feed pat (ไม่แก้ไฟล์)
// สไตล์การเล่น: care = ให้อาหารเมื่ออิ่มต่ำกว่า feedAt (ซื้ออาหารเอง) + ลูบหัวทุกครั้งที่พ้นคูลดาวน์ • lazy = ลูบ/ให้อาหารทีละ 30 นาที • spam = ให้อาหารทุกครั้งที่ทำได้
const S = require('../public/shared.js'), L = S.PETLV, P = S.PETCARE;
const walk = +process.argv[2] || L.walk || 0, feed = +process.argv[3] || L.feed, pat = +process.argv[4] || L.pat;
function run(style) {
  let h = 100, b = 0, t = 0, lastPat = -1e9, lastCare = -1e9, feeds = 0; const hit = [], tick = 15000;
  while (t < 400 * 3600e3 && hit.length < 4) {
    t += tick; h = Math.max(0, h - P.hungerTick);
    b += walk * S.petMood(h, false); // เดินเล่น (ใช้งานอยู่) × อารมณ์ตามความอิ่ม
    const can = t - lastPat >= L.patCdMs;
    if (style === 'care') { if (h < 50 && h < 95) { h = Math.min(100, h + P.food); b += feed; feeds++; } if (can) { lastPat = t; b += pat; } }
    if (style === 'spam') { if (h < 95) { h = Math.min(100, h + P.food); b += feed; feeds++; } if (can) { lastPat = t; b += pat; } }
    if (style === 'lazy' && t - lastCare >= 1800e3) { lastCare = t; if (h < 95) { h = Math.min(100, h + P.food); b += feed; feeds++; } lastPat = t; b += pat; }
    if (style === 'walk') { if (h < 50) { h = Math.min(100, h + P.food); b += feed; feeds++; } } // ไม่ลูบหัวเลย ให้อาหารพอเลี้ยงรอด
    while (hit.length < 4 && S.petLevel(b) > hit.length + 1) hit.push((t / 3600e3).toFixed(1));
  }
  return { style, 'ระดับ2/3/4/5 (ชม.)': hit.join(' / '), 'ค่าอาหารถึงระดับ5 (เหรียญ)': feeds * 8 };
}
console.log('need', L.need.join(','), '• เดิน', walk, '/ติ๊ก(15วิ) • อาหาร', feed, '• ลูบ', pat, '/', L.patCdMs / 60000, 'นาที');
console.table(['care', 'lazy', 'walk', 'spam'].map(run));
