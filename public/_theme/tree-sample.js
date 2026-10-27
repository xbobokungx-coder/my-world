// ตัวอย่างต้นไม้แนวภาพอ้างอิง (ยังไม่ใส่เกม) — พุ่มฟู dither + เงาชั้น + ลายใบรูป U
// วาดพิกเซลคม imageSmoothingEnabled = false · ขอบ 1 px #2a1b14 · แสงซ้ายบน
(() => {
  const OUT = '#2a1b14';
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
  const dith = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const rgb = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const fill = (x, c, X, Y, w, h) => { x.fillStyle = c; x.fillRect(X, Y, w, h); };
  function disc(x, cx, cy, rad, c) {
    x.fillStyle = c;
    for (let dy = -rad; dy <= rad; dy++) {
      const w = Math.floor(Math.sqrt(rad * rad - dy * dy) + .5);
      x.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
    }
  }
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

  // พาเลตจากภาพอ้างอิง: เข้มล่าง → กลาง → ไฮไลต์บน (เขียวสด cozy)
  const PAL = {
    broad: ['#1f5a28', '#2f7a34', '#4a9e42', '#6bc24e', '#9ee06a', '#c8f090'],
    dark: ['#1a4a28', '#275e34', '#3a7a42', '#549a52', '#7aba68', '#a8d888'],
    pine: ['#1a3f32', '#245848', '#357060', '#4a9078', '#6ab090', '#98d0b0'],
    fruit: ['#1f5a28', '#2f7a34', '#4a9e42', '#6bc24e', '#9ee06a', '#c8f090'],
    blossom: ['#1f5a28', '#2f7a34', '#4a9e42', '#6bc24e', '#9ee06a', '#c8f090'],
  };

  // วาดพุ่มก้อนเดียว: ชั้นสี + dither ขอบ + ลายใบรูป U
  function puff(x, cx, cy, rx, ry, pal, R, opts = {}) {
    const cells = [];
    for (let dy = -ry - 1; dy <= ry + 1; dy++) for (let dx = -rx - 1; dx <= rx + 1; dx++) {
      const nx = dx / (rx + 0.01), ny = dy / (ry + 0.01), d2 = nx * nx + ny * ny;
      if (d2 > 1.05) continue;
      // ความสูงในพุ่ม: 0 ล่างเงา → 1 บนไฮไลต์ + เยื้องแสงซ้ายบน
      const lit = Math.max(0, Math.min(1, 0.55 - ny * 0.45 - nx * 0.18 + (1 - d2) * 0.25));
      let band = lit * (pal.length - 1.01);
      // dither ระหว่างชั้นให้ฟู ไม่แบน
      const frac = band - Math.floor(band);
      let i = Math.floor(band);
      if (frac > dith(cx + dx, cy + dy)) i += 1;
      i = Math.max(0, Math.min(pal.length - 1, i));
      // ขอบนอกเข้มขึ้นนิด
      if (d2 > 0.82) i = Math.max(0, i - 1);
      cells.push([cx + dx, cy + dy, i]);
    }
    for (const [px, py, i] of cells) fill(x, pal[i], px, py, 1, 1);
    // ลายใบ/เงาก้อนรูป U กระจายในพุ่ม (ตามภาพอ้างอิง)
    const nMark = opts.marks == null ? 10 : opts.marks;
    for (let k = 0; k < nMark; k++) {
      const a = R() * Math.PI * 2, rr = R() * 0.55;
      const mx = Math.round(cx + Math.cos(a) * rx * rr), my = Math.round(cy + Math.sin(a) * ry * rr * 0.9);
      if ((mx - cx) ** 2 / (rx * rx) + (my - cy) ** 2 / (ry * ry) > 0.7) continue;
      const c = pal[Math.max(0, Math.min(2, Math.floor(R() * 2)))];
      fill(x, c, mx - 1, my, 3, 1); fill(x, c, mx - 1, my - 1, 1, 1); fill(x, c, mx + 1, my - 1, 1, 1);
    }
  }

  // ต้นใบกลมฟู (แบบลานกลางในภาพอ้างอิง)
  function broadTree(seed, variant = 0) {
    return mk(40, 48, (x) => {
      const R = rng(seed + variant * 17);
      const pal = variant === 1 ? PAL.dark : PAL.broad;
      const bark = ['#4a2e18', '#6b4423', '#8b5a2b'];
      // เงาพื้น
      ell(x, 20, 46, 12, 3, 'rgba(38,40,16,.28)');
      // โคนหญ้า
      ell(x, 11, 45, 5, 2, '#3f8a46'); ell(x, 29, 45, 5, 2, '#4f913b');
      fill(x, '#8ccc5e', 10, 44, 2, 1); fill(x, '#8ccc5e', 28, 44, 2, 1);
      // ลำต้นสั้นโผล่ใต้พุ่ม
      fill(x, bark[0], 17, 30, 6, 16); fill(x, bark[1], 18, 30, 3, 16); fill(x, bark[2], 18, 32, 1, 10);
      for (let yy = 32; yy < 44; yy += 3) fill(x, bark[0], 17, yy, 6, 1);
      fill(x, bark[0], 14, 44, 12, 3); fill(x, bark[1], 15, 44, 4, 1);
      // พุ่มเมฆซ้อนหลายก้อน (ใหญ่กลาง + ข้าง + บน)
      const blobs = [
        [20, 18, 14, 11],
        [9, 20, 9, 8],
        [31, 20, 9, 8],
        [20, 9, 10, 8],
        [13, 12, 7, 6],
        [27, 12, 7, 6],
        [15, 24, 7, 5],
        [25, 24, 7, 5],
      ];
      for (const b of blobs) {
        b[0] += Math.round(R() * 2 - 1);
        b[1] += Math.round(R() * 2 - 1);
        b[2] = Math.max(5, b[2] + Math.round(R() * 2 - 1));
        b[3] = Math.max(4, b[3] + Math.round(R() * 2 - 1));
      }
      // วาดเงาก้อนใหญ่ก่อน แล้วไฮไลต์
      for (const [bx, by, rx, ry] of blobs) puff(x, bx, by, rx, ry, pal, R, { marks: 7 + Math.floor(R() * 5) });
      // จุดไฮไลต์แดดซ้ายบนคมๆ
      for (let i = 0; i < 22; i++) {
        const px = 6 + Math.floor(R() * 14), py = 4 + Math.floor(R() * 10);
        if ((px - 14) ** 2 / 120 + (py - 12) ** 2 / 80 > 1) continue;
        fill(x, pal[5], px, py, 2, 1);
      }
      // ดอกจุดเล็ก (บางต้น)
      if (variant === 2) for (let i = 0; i < 8; i++) {
        const px = 8 + Math.floor(R() * 24), py = 6 + Math.floor(R() * 18);
        const fc = R() < .5 ? '#ffc9de' : '#ffe37a';
        fill(x, fc, px, py, 2, 1); fill(x, '#fff6e0', px, py, 1, 1);
      }
      if (variant === 3) for (let i = 0; i < 7; i++) {
        const px = 10 + Math.floor(R() * 20), py = 10 + Math.floor(R() * 14);
        fill(x, '#e8862a', px, py, 2, 2); fill(x, '#ffc06a', px, py, 1, 1);
      }
    });
  }

  // สนทรงขั้นบันได โทนเขียวอมฟ้า (มุมล่างซ้ายในภาพอ้างอิง)
  function pineTree(seed) {
    return mk(36, 48, (x) => {
      const R = rng(seed), pal = PAL.pine;
      const bark = ['#4a2e18', '#6b4423', '#8b5a2b'];
      ell(x, 18, 46, 10, 3, 'rgba(38,40,16,.28)');
      fill(x, bark[0], 16, 34, 4, 12); fill(x, bark[1], 17, 34, 2, 12);
      fill(x, bark[0], 13, 44, 10, 3);
      const tiers = [
        [18, 6, 4, 5],
        [18, 12, 7, 6],
        [18, 19, 10, 7],
        [18, 27, 13, 7],
      ];
      for (const [cx, top, half, hgt] of tiers) {
        for (let y = 0; y < hgt; y++) {
          const t = y / (hgt - 1 || 1);
          const w = Math.max(1, Math.round(half * (0.35 + t * 0.75)));
          const lit = 1 - t * 0.55;
          let i = Math.floor(lit * (pal.length - 1.2));
          if (dith(cx, top + y) > 0.5) i = Math.min(pal.length - 1, i + 1);
          fill(x, pal[Math.max(0, i)], cx - w, top + y, w * 2 + 1, 1);
          fill(x, pal[Math.min(pal.length - 1, i + 1)], cx - Math.floor(w * 0.45), top + y, Math.max(1, Math.floor(w * 0.5)), 1);
          // ขอบขั้นเข้ม
          fill(x, pal[0], cx - w, top + y, 1, 1); fill(x, pal[0], cx + w, top + y, 1, 1);
        }
        // เงาใต้แต่ละชั้น
        fill(x, pal[0], cx - half, top + hgt - 1, half * 2 + 1, 1);
      }
      fill(x, pal[5], 17, 5, 2, 2);
      for (let i = 0; i < 10; i++) {
        const px = 8 + Math.floor(R() * 20), py = 10 + Math.floor(R() * 22);
        fill(x, pal[1], px, py, 2, 1);
      }
    });
  }

  window.TreeSample = {
    broad: (seed, v) => broadTree(seed, v),
    pine: (seed) => pineTree(seed),
    variants: [
      { name: 'พุ่มกลม (หลัก)', make: () => broadTree(3, 0) },
      { name: 'พุ่มเข้ม', make: () => broadTree(11, 1) },
      { name: 'พุ่มดอกชมพู', make: () => broadTree(19, 2) },
      { name: 'พุ่มผลส้ม', make: () => broadTree(29, 3) },
      { name: 'สนขั้น', make: () => pineTree(41) },
      { name: 'พุ่มกลม B', make: () => broadTree(47, 0) },
    ],
  };
})();
