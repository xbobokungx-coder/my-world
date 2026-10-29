// ก้อนแร่ในถ้ำแบบพิกเซลอาร์ตวาดมือ (กริดตัวอักษร) • 1 พิกเซลศิลป์ = 2 พิกเซลเกม (กริด 16 พิกเซลต่อช่อง) แสงจากซ้ายบน 3+ โทน ขอบเข้ม 1 พิกเซลเติมอัตโนมัติ
// - PixelOre.has(kind)         : มีสไปรต์วาดมือของแร่ชนิดนี้แล้วหรือยัง (ยังไม่มี game.js ใช้แบบเดิมไปก่อน)
// - PixelOre.get(kind, size, f): แคนวาสสไปรต์ (size 0 เล็ก 1 กลาง 2 ใหญ่, f = เฟรมประกาย) วาดด้วย drawImage ขยาย 2 เท่า ไม่เบลอ จุดยึดคือกึ่งกลางด้านล่าง
// เพิ่มแร่ชนิดใหม่: ใส่พาเลต PAL[kind] (ตัวอักษร → สี) และกริด ART[kind] = [เล็ก, กลาง, ใหญ่] (แต่ละอันเป็นแถวตัวอักษรกว้างเท่ากัน '.' = โปร่งใส) ตัวเลือก ART[kind].alt = เฟรมประกาย (ชุดกริดเดียวกันที่ต่างเฉพาะจุดประกาย)
const PixelOre = (() => {
  const OUTLINE = '#1b1d24';
  // พาเลตตัวอักษร: h ไฮไลต์ • l สว่าง • m หลัก • d เงา • x เงาเข้ม • c รอยแตก
  const PAL = {
    stone: { h: '#e3e7ee', l: '#c3c9d6', m: '#a4abb8', d: '#7c8494', x: '#5b6477', c: '#4c536a' },
  };
  const ART = {
    stone: [
      [ // เล็ก 12×8
        '....hhhh....',
        '..hhllllmm..',
        '.hllmmmmmmd.',
        'hlmmmmmcmmdx',
        'lmmmmmcmmmdx',
        'lmmmmmmmmddx',
        '.mmmmmmmdddx',
        '..xxddddxx..',
      ],
      [ // กลาง 16×10
        '....hhhhhh......',
        '..hhlllllllm....',
        '.hlllllllmmmmmd.',
        'hllmmmmmmmmmmmdx',
        'lmmmmmmcmmmmmddx',
        'lmmmmmcmmmmmmddx',
        'lmmmmcmmmmmmmddx',
        'llmmmmmmmmmmdddx',
        '.mmmmmmmmmmddxxx',
        '..xxdddddddddxx.',
      ],
      [ // ใหญ่ 20×14
        '......hhhhhhh.......',
        '....hhlllllllllm....',
        '...hllllllllllmmmm..',
        '..hlllllllllmmmmmmd.',
        '.hllllllllmmmmmmmmdd',
        'hlmmmmmmmmmmmmmmmmdx',
        'lmmmmmmmmcmmmmmmmddx',
        'lmmmmmmmcmmmmmmmmddx',
        'lmmmmmmcmmmmmmmmdddx',
        'lmmmmmcmmmmmmmmmdddx',
        'llmmmmmmmmmmmmmdddxx',
        '.mmmmmmmmmmmmmdddxxx',
        '..xdmmmmmmmmmddddxx.',
        '...xxdddddddddddxx..',
      ],
    ],
  };
  const cache = new Map();
  function get(kind, size, f) {
    const key = kind + size + (f ? 'b' : ''), hit = cache.get(key); if (hit) return hit;
    const set = ART[kind], rows = set && ((f && set.alt && set.alt[size]) || set[size]); if (!rows) return null;
    const pal = PAL[kind], w = rows[0].length, h = rows.length;
    const c = PixelArt.cv(w + 2, h + 2), x = c.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = rows[j][i]; if (ch !== '.' && pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i + 1, j + 1, 1, 1); } }
    PixelArt.addOutline(c, OUTLINE);
    cache.set(key, c); return c;
  }
  return { has: kind => !!ART[kind], get, ART, PAL };
})();
if (typeof module !== 'undefined') module.exports = PixelOre;
