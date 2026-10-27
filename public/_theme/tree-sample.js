// ตัวอย่างต้นไม้ v2 — ตามภาพคลอสอัปที่ส่งมา (พุ่ม 3 ชั้นซ้อน · ขอบหยัก · เงาเข้มใต้ชั้น · ไฮไลต์บน)
// ยังไม่ใส่เกม · ขอบ 1 px · ไม่เบลอ
(() => {
  const OUT = '#1a2a14';
  const rgb = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const fill = (x, c, X, Y, w, h) => { x.fillStyle = c; x.fillRect(X | 0, Y | 0, w, h); };
  function ell(x, cx, cy, rx, ry, c) {
    x.fillStyle = c;
    for (let dy = -ry; dy <= ry; dy++) {
      const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))) + .5);
      x.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
    }
  }
  function addOutline(c, col = OUT) {
    const x = c.getContext('2d'), w = c.width, h = c.height, d = x.getImageData(0, 0, w, h), a = d.data;
    const o = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) o[i] = a[i * 4 + 3] > 90 ? 1 : 0;
    const [R, G, B] = rgb(col);
    for (let y = 0; y < h; y++) for (let x2 = 0; x2 < w; x2++) {
      const i = y * w + x2;
      if (o[i]) { a[i * 4 + 3] = 255; continue; }
      if ((x2 > 0 && o[i - 1]) || (x2 < w - 1 && o[i + 1]) || (y > 0 && o[i - w]) || (y < h - 1 && o[i + w])) {
        a[i * 4] = R; a[i * 4 + 1] = G; a[i * 4 + 2] = B; a[i * 4 + 3] = 255;
      } else a[i * 4 + 3] = 0;
    }
    x.putImageData(d, 0, 0);
  }
  function mk(w, h, fn) {
    const c = cv(w + 2, h + 2), x = c.getContext('2d');
    x.translate(1, 1); fn(x, w, h); x.setTransform(1, 0, 0, 1, 0, 0); addOutline(c); return c;
  }

  // พาเลตจากภาพคลอสอัป: ไฮไลต์เหลืองเขียว → กลาง → เงาเขียวอมฟ้าเข้มใต้ชั้น
  const C = {
    hi: '#c8e86a',   // ยอดสว่าง
    lit: '#7cbc42',  // ใบสว่าง
    mid: '#4a9a38',  // กลาง
    deep: '#2f6e30', // เข้ม
    shade: '#1a4a38', // เงาใต้ชั้น (เขียวอมฟ้าเข้ม = มิติ)
    ink: '#14281c',  // ขอบในพุ่ม
    bark0: '#3d2814',
    bark1: '#6b4423',
    bark2: '#8b5a2b',
  };

  // ความกว้างของชั้นที่แถว y (ทรงกรวย: แคบบน กว้างล่าง) + ขอบหยักฟันเลื่อย
  function tierHalf(y, y0, y1, halfTop, halfBot, R, seed) {
    const t = (y - y0) / Math.max(1, y1 - y0);
    let half = Math.round(halfTop + (halfBot - halfTop) * t);
    // หยักขอบล่างของชั้น (jagged scallops)
    const jag = Math.round(Math.sin(y * 1.7 + seed) * 1.2 + Math.sin(y * 0.9 + seed * 2) * 0.8);
    if (t > 0.55) half += jag;
    // ฟันเลื่อยที่ขอบล่างสุด
    if (y >= y1 - 1) half -= (Math.abs((y + seed) % 3) === 0 ? 2 : 0);
    return Math.max(2, half);
  }

  // วาด 1 ชั้นพุ่ม: ไฮไลต์บน · กลาง · เงาเข้มแถบล่าง · ขอบหยัก
  function drawTier(x, cx, y0, y1, halfTop, halfBot, R, seed) {
    const hgt = y1 - y0 + 1;
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, hgt - 1);
      const half = tierHalf(y, y0, y1, halfTop, halfBot, R, seed);
      // แถบบนสุด = ไฮไลต์ · กลาง = mid/lit · แถบล่างสุด = เงาเข้ม (สร้างมิติ)
      let col = C.mid;
      if (t < 0.18) col = C.hi;
      else if (t < 0.38) col = C.lit;
      else if (t < 0.72) col = C.mid;
      else if (t < 0.88) col = C.deep;
      else col = C.shade;
      fill(x, col, cx - half, y, half * 2 + 1, 1);
      // ไฮไลต์ซ้ายบนของชั้น
      if (t < 0.35) {
        const hw = Math.max(1, Math.floor(half * (0.35 - t)));
        fill(x, t < 0.12 ? C.hi : C.lit, cx - half + 1, y, hw, 1);
      }
      // เงาขวาล่าง
      if (t > 0.55) {
        const sw = Math.max(1, Math.floor(half * (t - 0.45)));
        fill(x, t > 0.85 ? C.shade : C.deep, cx + half - sw, y, sw + 1, 1);
      }
      // ขอบซ้าย-ขวาเข้ม
      fill(x, C.ink, cx - half, y, 1, 1);
      fill(x, C.ink, cx + half, y, 1, 1);
    }
    // แถบเงาใต้ชั้น (เส้นเข้มชัด = มิติแบบภาพอ้างอิง)
    {
      const y = y1;
      const half = tierHalf(y, y0, y1, halfTop, halfBot, R, seed);
      fill(x, C.shade, cx - half, y, half * 2 + 1, 1);
      fill(x, C.ink, cx - half, y, half * 2 + 1, 1);
      // หยักฟันเลื่อยใต้ชั้น
      for (let dx = -half; dx <= half; dx++) {
        if (((dx + seed * 3) % 4 + 4) % 4 === 0) fill(x, C.shade, cx + dx, y + 1, 1, 1);
        if (((dx + seed) % 5 + 5) % 5 === 0) fill(x, C.ink, cx + dx, y + 1, 2, 1);
      }
    }
  }

  // ต้นไม้หลักตามภาพคลอสอัป: 3 ชั้นซ้อน ทรงแคบบน-กว้างล่าง
  function layeredTree(seed, variant = 0) {
    return mk(36, 44, (x) => {
      const R = rng(seed + variant * 13);
      const cx = 18;
      // เงาพื้น
      ell(x, cx, 42, 10, 2, 'rgba(20,30,16,.3)');
      // ลำต้นสั้น + รากแผ่
      fill(x, C.bark0, cx - 2, 32, 5, 10);
      fill(x, C.bark1, cx - 1, 32, 2, 10);
      fill(x, C.bark2, cx - 1, 34, 1, 5);
      fill(x, C.bark0, cx - 5, 40, 11, 3);
      fill(x, C.bark1, cx - 4, 40, 3, 1);
      fill(x, C.bark0, cx - 6, 41, 2, 2); // รากซ้าย
      fill(x, C.bark0, cx + 4, 41, 2, 2); // รากขวา
      // หญ้าโคน
      fill(x, '#3f8a46', cx - 7, 41, 2, 1); fill(x, '#5fa844', cx + 6, 41, 2, 1);

      // 3 ชั้น: บนเล็ก · กลาง · ล่างใหญ่ (เหลื่อมกันเล็กน้อย)
      // variant ปรับสัดส่วนเล็กน้อยให้ไม่ซ้ำ
      const lean = variant === 1 ? 1 : variant === 2 ? -1 : 0;
      const tiers = [
        { y0: 2, y1: 12, ht: 4 + (variant === 1 ? 1 : 0), hb: 8 },
        { y0: 11, y1: 23, ht: 7, hb: 12 + (variant === 2 ? 1 : 0) },
        { y0: 21, y1: 34, ht: 10, hb: 15 },
      ];
      // วาดจากล่างขึ้นบน เพื่อให้ชั้นบนทับ
      for (let i = tiers.length - 1; i >= 0; i--) {
        const T = tiers[i];
        drawTier(x, cx + lean * (i === 0 ? 0 : 0), T.y0, T.y1, T.ht, T.hb, R, seed + i * 9);
      }
      // จุดไฮไลต์ยอด
      fill(x, C.hi, cx - 1, 3, 3, 2);
      fill(x, '#e8f8a0', cx, 2, 1, 1);

      // บาง variant: จุดดอก/ผล
      if (variant === 3) {
        for (let i = 0; i < 5; i++) {
          const px = 8 + Math.floor(R() * 20), py = 8 + Math.floor(R() * 22);
          fill(x, '#e8862a', px, py, 2, 2); fill(x, '#ffc06a', px, py, 1, 1);
        }
      }
      if (variant === 4) {
        for (let i = 0; i < 6; i++) {
          const px = 8 + Math.floor(R() * 20), py = 6 + Math.floor(R() * 20);
          fill(x, '#ffc9de', px, py, 2, 1); fill(x, '#fff6e0', px, py, 1, 1);
        }
      }
    });
  }

  // สนโทนเย็น — ยังใช้โครงชั้นเดียวกัน แต่แคบสูงกว่า
  function pineTree(seed) {
    return mk(32, 46, (x) => {
      const R = rng(seed), cx = 16;
      const pine = { hi: '#a8d8b0', lit: '#5aaa78', mid: '#3a8060', deep: '#2a5848', shade: '#1a3840', ink: '#102028' };
      ell(x, cx, 44, 8, 2, 'rgba(20,30,16,.3)');
      fill(x, C.bark0, cx - 1, 36, 3, 8); fill(x, C.bark1, cx, 36, 1, 8);
      fill(x, C.bark0, cx - 4, 42, 9, 3);
      const old = { ...C };
      Object.assign(C, pine);
      const tiers = [
        { y0: 2, y1: 12, ht: 2, hb: 5 },
        { y0: 10, y1: 22, ht: 4, hb: 8 },
        { y0: 20, y1: 32, ht: 6, hb: 11 },
        { y0: 30, y1: 38, ht: 8, hb: 12 },
      ];
      for (let i = tiers.length - 1; i >= 0; i--) {
        const T = tiers[i];
        drawTier(x, cx, T.y0, T.y1, T.ht, T.hb, R, seed + i * 7);
      }
      Object.assign(C, old);
      fill(x, pine.hi, cx, 2, 1, 2);
    });
  }

  window.TreeSample = {
    layered: (seed, v) => layeredTree(seed, v),
    pine: (seed) => pineTree(seed),
    variants: [
      { name: 'ชั้น 3 (หลัก)', make: () => layeredTree(3, 0) },
      { name: 'ชั้น 3 B', make: () => layeredTree(11, 1) },
      { name: 'ชั้น 3 C', make: () => layeredTree(19, 2) },
      { name: 'มีผลส้ม', make: () => layeredTree(29, 3) },
      { name: 'มีดอก', make: () => layeredTree(37, 4) },
      { name: 'สนขั้น', make: () => pineTree(41) },
    ],
  };
})();
