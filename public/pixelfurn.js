// เฟอร์นิเจอร์พิกเซลมุมเอียง (วาดใหม่ทั้งชุด) — ทุกจุดอยู่บนตารางพิกเซลพอดี เส้นเอียง 2:1 ขั้นละ 1 px เกม ไม่แตก
// หน่วยท้องถิ่น: u (ซ้าย→ขวาของชิ้น), v (หลัง→หน้า) = 1/8 ช่อง (4 px โลก) • z = 2 px โลก • ภาพออกมาที่ 1 px เกมต่อ 1 px
// ใช้: PixelFurn.sprite(id, FURN[id], r, ph, shadow) → { cv, w, h, ax, ay } วาดที่ (iso(X,Y,z) − (ax,ay)) • ของติดผนังใช้ wall(id, d, wl)
// แนวศิลป์: แสงซ้ายบน (บน = สว่าง, หน้าซ้าย = หลัก, ขวา = เงา) ขอบบนด้านหน้ามีเส้นแสง ชิ้นที่ซ้อนกันมีเส้นเข้มแบ่ง ขอบนอก #2a1b14
const PixelFurn = (() => {
  const INK = '#2a1b14', K = 2;
  const hex = s => { const n = parseInt(s.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  let factory = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // พาเลต 5 โทน [เงาลึก, เงา, หลัก, แสง, ไฮไลต์] โทนหม่นอุ่นตามชุดอาคาร v2
  const P = {
    wood:  ['#463332', '#75523f', '#ae8458', '#d3b680', '#e9d6a6'],
    dwood: ['#33241f', '#553a2d', '#7a5540', '#a07656', '#c09a70'],
    linen: ['#7d725f', '#ab9e84', '#d8ccae', '#eee4c9', '#faf4e2'],
    rose:  ['#5a2e31', '#874544', '#b4635a', '#d38c78', '#ebb79f'],
    blue:  ['#2c3650', '#45587a', '#64809f', '#8ea8c0', '#bdd0db'],
    plum:  ['#3d2a44', '#5e4166', '#83628a', '#a988ad', '#cdb4cc'],
    sage:  ['#33473a', '#4f6a52', '#71906d', '#9db58f', '#c9d6b0'],
    metal: ['#4b525a', '#7b858e', '#aeb7bc', '#d4dad8', '#f0f2ea'],
    char:  ['#1f1d22', '#2f2c33', '#423e46', '#5c5760', '#7d7780'],
    leaf:  ['#24402b', '#356338', '#538a40', '#87b356', '#c6d978'],
    clay:  ['#55302a', '#83483a', '#ae6a4c', '#cf8f66', '#e8b88c'],
    gold:  ['#6e5226', '#a17f3e', '#cfae5f', '#ead08a', '#f9ecb6'],
    brick: ['#4a2724', '#713933', '#985046', '#b9705d', '#d39a83'],
    glass: ['#3f6f86', '#6a9fb5', '#9cc7d6', '#c6e2e8', '#eef8f6'],
    stone: ['#4e4a4c', '#7a7577', '#a6a09c', '#c9c3bb', '#e6e1d8'],
    ginger:['#6b3a1c', '#a35a26', '#d4823a', '#eba45c', '#f7cb8e'],
    bamboo:['#5a5222', '#857a34', '#b3a352', '#cfc172', '#e6dc9c'],
  };
  class S {
    constructor(W, D, r) { this.W = W; this.D = D; this.r = r; this.bw = 300; this.bh = 260; this.ox = 150; this.oy = 190; const n = this.bw * this.bh; this.px = new Uint8ClampedArray(n * 4); this.face = new Int32Array(n).fill(-1); this.part = new Int32Array(n).fill(-1); this.fid = 0; this.pid = 0; this.detail = false; }
    W2(u, v) { return this.r ? [v, u] : [u, v]; } // หมุน 90° = สลับแกน (หลังของชิ้นไปอยู่ฝั่งตะวันตก)
    sp(X, Y, z) { return [this.ox + 2 * K * (X - Y), this.oy + K * (X + Y - z)]; }
    at(u, v, z) { const [X, Y] = this.W2(u, v); return this.sp(X, Y, z); }
    set(x, y, c, a = 1) {
      x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.bw || y >= this.bh) return;
      if (c === 'clear') { const j = y * this.bw + x; this.px[j * 4 + 3] = 0; this.part[j] = -1; return; } // เจาะรู
      const i = y * this.bw + x, o = i * 4, [R, G, B] = hex(c); if (a >= 0.5) this.part[i] = this.detail ? -1 : this.pid;
      if (a >= 1) { this.px[o] = R; this.px[o + 1] = G; this.px[o + 2] = B; this.px[o + 3] = 255; return; }
      const da = this.px[o + 3] / 255, oa = a + da * (1 - a); this.px[o] = (R * a + this.px[o] * da * (1 - a)) / oa; this.px[o + 1] = (G * a + this.px[o + 1] * da * (1 - a)) / oa; this.px[o + 2] = (B * a + this.px[o + 2] * da * (1 - a)) / oa; this.px[o + 3] = oa * 255;
    }
    // เติมรูปหลายเหลี่ยมบนจอ (ใช้จุดกึ่งกลางพิกเซล) คืนพิกเซลที่เติม
    fillScr(pts, c, a = 1, id) {
      let y0 = 1e9, y1 = -1e9; for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } const out = [];
      for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
        const cy = y + 0.5, xs = [];
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > cy) !== (yj > cy)) xs.push(xi + (cy - yi) / (yj - yi) * (xj - xi)); }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x < Math.ceil(xs[k + 1] - 0.5); x++) { if (c) this.set(x, y, c, a); if (id != null && x >= 0 && y >= 0 && x < this.bw && y < this.bh) this.face[y * this.bw + x] = id; out.push([x, y]); }
      }
      return out;
    }
    quad(pts, c, a) { this.pid++; return this.fillScr(pts.map(p => this.at(p[0], p[1], p[2])), c, a); }
    fp(v, pts, c, a) { return this.quad(pts.map(q => [q[0], v, q[1]]), c, a); }                 // แผ่นบนระนาบ v (หน้าของชิ้น): จุด [u, z]
    fcirc(v, cu, cz, R, c) { const pts = []; for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; pts.push([cu + Math.cos(t) * R, cz + Math.sin(t) * R * 2]); } return this.fp(v, pts, c); }
    top(z, pts, c, a) { return this.quad(pts.map(q => [q[0], q[1], z]), c, a); }               // แผ่นแนวนอนที่ความสูง z: จุด [u, v]
    // กล่อง (u0..u1, v0..v1, z0..z1)
    box(u0, v0, z0, u1, v1, z1, pal, o = {}) {
      this.pid++;
      const [a0, b0] = this.W2(u0, v0), [a1, b1] = this.W2(u1, v1), x0 = Math.min(a0, a1), x1 = Math.max(a0, a1), y0 = Math.min(b0, b1), y1 = Math.max(b0, b1), sp = (X, Y, z) => this.sp(X, Y, z);
      if (z1 > z0) { this.fillScr([sp(x0, y1, z0), sp(x1, y1, z0), sp(x1, y1, z1), sp(x0, y1, z1)], o.left || pal[2], o.a, ++this.fid); this.fillScr([sp(x1, y0, z0), sp(x1, y1, z0), sp(x1, y1, z1), sp(x1, y0, z1)], o.right || pal[1], o.a, ++this.fid); }
      const tid = ++this.fid, T = this.fillScr([sp(x0, y0, z1), sp(x1, y0, z1), sp(x1, y1, z1), sp(x0, y1, z1)], o.top || pal[3], o.a, tid);
      if (!o.noRim) for (const [x, y] of T) if (y + 1 < this.bh && this.face[(y + 1) * this.bw + x] !== tid) this.set(x, y, o.rim || pal[4]); // ขอบบนด้านหน้าสว่าง
    }
    shadow(pad = 1) { const W = this.W / 2 + pad, D = this.D / 2 + pad; this.quad([[-W, -D, 0], [W, -D, 0], [W, D, 0], [-W, D, 0]], '#3a2c48', 0.28); }
    line(p, q, c, a = 1) { this.detail = true; const [x0, y0] = this.at(...p), [x1, y1] = this.at(...q), n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) this.set(Math.round(x0 + (x1 - x0) * i / n - (x1 < x0 ? 0.001 : 0)), Math.round(y0 + (y1 - y0) * i / n), c, a); this.detail = false; }
    dot(u, v, z, c) { const [x, y] = this.at(u, v, z); this.detail = true; for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) this.set(Math.round(x) + i, Math.round(y) + j, c); this.detail = false; } // จุดเล็กสุด 2×2 (มือจับ ปุ่ม)
    disc(u, v, z, rx, ry, c) { this.pid++; let [cx, cy] = this.at(u, v, z); cx = Math.round(cx); cy = Math.round(cy); rx *= K; ry *= K; for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx + 0.6) + (y * y) / (ry * ry + 0.6) <= 1) this.set(cx + x, cy + y, c); }
    done() {
      const bw = this.bw, bh = this.bh, d = this.px, pt = this.part, mark = [], ink = hex(INK);
      // เส้นเข้มแบ่งชิ้น: ชิ้นที่อยู่หน้า (วาดทีหลัง) ตรงที่ชนชิ้นหลัง → อ่านเป็นชิ้น ๆ ชัด
      for (let y = 1; y < bh - 1; y++) for (let x = 1; x < bw - 1; x++) { const i = y * bw + x, a = pt[i]; if (a < 0 || d[i * 4 + 3] < 128) continue; for (const n of [i - bw, i - 1, i + 1]) { const b = pt[n]; if (b >= 0 && b < a && d[n * 4 + 3] >= 128) { mark.push(i); break; } } }
      for (const i of mark) for (let k = 0; k < 3; k++) d[i * 4 + k] = d[i * 4 + k] * 0.45 + ink[k] * 0.55;
      for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const m = (d[i] + d[i + 1] + d[i + 2]) / 3; for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, (m + (d[i + k] - m) * 1.2 - 128) * 1.1 + 128)); } // สีชัดขึ้นเล็กน้อย
      const solid = i => d[i * 4 + 3] >= 128, edge = [];
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = y * bw + x; if (solid(i)) continue; if ((x > 0 && solid(i - 1)) || (x < bw - 1 && solid(i + 1)) || (y > 0 && solid(i - bw)) || (y < bh - 1 && solid(i + bw))) edge.push(i); }
      for (const i of edge) { d[i * 4] = ink[0]; d[i * 4 + 1] = ink[1]; d[i * 4 + 2] = ink[2]; d[i * 4 + 3] = 255; }
      let x0 = bw, y0 = bh, x1 = -1, y1 = -1; for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (d[(y * bw + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) { x0 = y0 = x1 = y1 = 0; }
      const w = x1 - x0 + 1, h = y1 - y0 + 1, cv = factory(w, h), g = cv.getContext('2d'), img = g.createImageData(w, h);
      for (let y = 0; y < h; y++) img.data.set(d.subarray(((y0 + y) * bw + x0) * 4, ((y0 + y) * bw + x0 + w) * 4), y * w * 4);
      g.putImageData(img, 0, 0);
      return { cv, w, h, ax: this.ox - x0, ay: this.oy - y0 };
    }
  }
  const legs = (S, u0, v0, u1, v1, h, pal, t = 1) => { for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]) S.box(u - (u > 0 ? t : 0), v - (v > 0 ? t : 0), 0, u + (u > 0 ? 0 : t), v + (v > 0 ? 0 : t), h, pal, { noRim: true }); };
  const knob = (S, u, v, z) => S.dot(u, v, z, P.gold[4]);
  // เตียง: โครง หัวเตียงมีแผงลึก ฟูก หมอน ผ้าห่มพับปลาย
  const bedArt = (S, w, bl, pillows) => {
    const W = S.W / 2, D = S.D / 2;
    S.box(-W, -D, 0, W, D, 5, w); S.box(-W + 1, -D + 1, 5, W - 1, D - 1, 9, P.linen);
    S.box(-W, -D, 0, W, -D + 2, 18, w); S.box(-W + 2, -D + 1, 9, W - 2, -D + 2, 16, w, { left: w[1], top: w[2], right: w[0], noRim: true });
    const ps = pillows > 1 ? [[-W + 2, -1], [1, W - 2]] : [[-W + 2, W - 2]];
    for (const [a, b] of ps) S.box(a, -D + 3, 9, b, -D + 7, 11, P.linen, { rim: P.linen[4] });
    S.box(-W + 1, -D + 9, 9, W - 1, D - 1, 10, bl, { rim: bl[4] }); S.box(-W + 1, -D + 9, 9, W - 1, -D + 11, 11, P.linen);
  };
  // ฉากกั้น: แผ่นบาง 2 ช่อง หน้าตกแต่งด้วย fn(หน้า, ซ้าย, ขวา, สูง)
  const screen = (S, pal, fn) => { const W = S.W / 2, D = S.D / 2, H = 28; S.box(-W, -D, 0, W, D, H, pal); fn(D, -W, W, H); };

  const DES = {
    rug(S) { const W = S.W / 2, D = S.D / 2, r = P.rose, ring = (k, c) => S.top(0, [[-W + k, -D + k], [W - k, -D + k], [W - k, D - k], [-W + k, D - k]], c);
      ring(0, r[1]); ring(1, P.gold[3]); ring(2, r[2]); S.top(0, [[0, -4], [4, 0], [0, 4], [-4, 0]], P.gold[3]); S.top(0, [[0, -2], [2, 0], [0, 2], [-2, 0]], r[1]); },
    roundrug(S) { const b = P.blue; [[8, b[0]], [7, P.linen[3]], [6, b[2]], [4, b[1]], [2, P.linen[3]]].forEach(([R, c]) => S.disc(0, 0, 0, 2 * R, R, c)); },
    chair(S) { const W = S.W / 2, D = S.D / 2, w = P.wood;
      legs(S, -W, -D, W, D, 6, w); S.box(-W, -D, 6, W, D, 8, w); S.box(-W + 1, -D + 1, 8, W - 1, D - 1, 9, P.rose, { rim: P.rose[4] });
      S.box(-W, -D, 8, W, -D + 1, 18, w); S.box(-W + 1, -D, 12, W - 1, -D + 1, 16, w, { left: w[1], right: w[0], top: w[2], noRim: true }); },
    stool(S) { legs(S, -2, -2, 2, 2, 5, P.wood); S.box(-2, -2, 5, 2, 2, 7, P.rose, { rim: P.rose[4] }); },
    sofa(S) { const W = S.W / 2, D = S.D / 2, b = P.blue, k = P.dwood;
      for (const [u, v] of [[-W + 1, -D + 1], [W - 2, -D + 1], [-W + 1, D - 2], [W - 2, D - 2]]) S.box(u, v, 0, u + 1, v + 1, 2, k, { noRim: true });
      S.box(-W, -D, 2, W, D, 6, b, { left: b[1], right: b[0] }); S.box(-W, -D, 6, W, -D + 3, 17, b);
      S.box(-W + 2, -D + 3, 6, -1, D, 9, b, { rim: b[4] }); S.box(0, -D + 3, 6, W - 2, D, 9, b, { rim: b[4] });
      S.box(-W + 2, -D + 3, 9, -1, -D + 5, 15, b, { rim: b[4] }); S.box(0, -D + 3, 9, W - 2, -D + 5, 15, b, { rim: b[4] });
      S.box(-W, -D + 3, 6, -W + 2, D, 12, b, { rim: b[4] }); S.box(W - 2, -D + 3, 6, W, D, 12, b, { rim: b[4] }); },
    armchair(S) { const W = S.W / 2, D = S.D / 2, c = P.clay, k = P.dwood;
      for (const [u, v] of [[-W + 1, -D + 1], [W - 2, -D + 1], [-W + 1, D - 2], [W - 2, D - 2]]) S.box(u, v, 0, u + 1, v + 1, 2, k, { noRim: true });
      S.box(-W, -D, 2, W, D, 6, c, { left: c[1], right: c[0] }); S.box(-W, -D, 6, W, -D + 2, 16, c);
      S.box(-W + 2, -D + 2, 6, W - 2, D, 9, c, { rim: c[4] }); S.box(-W, -D + 2, 6, -W + 2, D, 12, c, { rim: c[4] }); S.box(W - 2, -D + 2, 6, W, D, 12, c, { rim: c[4] }); },
    officechair(S) { const b = P.blue, k = P.char;
      for (const [u, v] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) S.dot(u, v, 0, k[1]);
      S.box(-2, 0, 1, 2, 1, 2, k, { noRim: true }); S.box(0, -2, 1, 1, 2, 2, k, { noRim: true }); S.box(0, 0, 2, 1, 1, 6, k, { noRim: true });
      S.box(-3, -3, 6, 3, 3, 8, b, { rim: b[4] }); S.box(-3, -3, 8, 3, -2, 16, b, { rim: b[4] }); },
    table(S) { const W = S.W / 2, D = S.D / 2, w = P.wood;
      legs(S, -W + 1, -D + 1, W - 1, D - 1, 6, w); S.box(-W, -D, 6, W, D, 8, w);
      S.top(8, [[-4, -2], [0, -2], [0, 2], [-4, 2]], P.linen[4]); S.box(2, -1, 8, 4, 1, 11, P.metal); },
    coffeetable(S) { const W = S.W / 2, D = S.D / 2, w = P.dwood;
      legs(S, -W + 1, -D + 1, W - 1, D - 1, 5, w); S.box(-W, -D, 5, W, D, 7, w); S.box(1, -1, 7, 3, 1, 9, P.linen); S.disc(2, 0, 9, 1, 1, P.dwood[1]); },
    desk(S) { const W = S.W / 2, D = S.D / 2, w = P.wood;
      legs(S, -W + 1, -D + 1, W - 1, D - 1, 8, w); S.box(2, -D + 1, 5, W - 1, D - 1, 8, w); knob(S, W - 4, D - 1, 6);
      S.box(-W, -D, 8, W, D, 10, w); S.top(10, [[-6, -2], [-1, -2], [-1, 2], [-6, 2]], P.linen[4]); S.box(3, -1, 10, 5, 1, 14, P.blue); },
    bed(S) { bedArt(S, P.dwood, P.rose, 2); },
    bedsingle(S) { bedArt(S, P.wood, P.sage, 1); },
    bedking(S) { bedArt(S, P.dwood, P.plum, 2); },
    shelf(S) { const W = S.W / 2, D = S.D / 2, w = P.dwood, books = [P.rose, P.blue, P.sage, P.gold, P.plum];
      S.box(-W, -D, 0, W, D, 21, w);
      for (const [z0, z1] of [[2, 9], [11, 19]]) { S.fp(D, [[-W + 1, z0], [W - 1, z0], [W - 1, z1], [-W + 1, z1]], w[0]);
        for (let u = -W + 1, n = 0; u < W - 1; u += 2, n++) { const pal = books[(n * 2 + (z0 > 5 ? 1 : 0)) % 5], top = z1 - 1 - ((n + (z0 > 5 ? 1 : 0)) % 3 === 0 ? 1 : 0); S.fp(D, [[u, z0], [Math.min(u + 2, W - 1), z0], [Math.min(u + 2, W - 1), top], [u, top]], pal[2]); } } },
    tv(S) { const W = S.W / 2, D = S.D / 2, w = P.dwood;
      S.box(-W, -D, 0, W, D, 7, w); S.fp(D, [[-W + 1, 2], [-1, 2], [-1, 6], [-W + 1, 6]], w[1]); S.fp(D, [[1, 2], [W - 1, 2], [W - 1, 6], [1, 6]], w[1]); knob(S, -2, D, 4); knob(S, 2, D, 4);
      S.box(-1, -1, 7, 1, 1, 8, P.char); S.box(-W + 1, -1, 8, W - 1, 0, 18, P.char); S.fp(0, [[-W + 2, 9], [W - 2, 9], [W - 2, 17], [-W + 2, 17]], '#3b5677'); },
    computer(S) { const k = P.char; S.box(-1, -1, 0, 1, 1, 1, k); S.box(0, -1, 1, 1, 0, 3, k, { noRim: true }); S.box(-3, -2, 3, 3, -1, 11, k); S.fp(-1, [[-2, 4], [2, 4], [2, 10], [-2, 10]], '#5a8fd0'); S.fp(-1, [[-2, 8], [0, 8], [0, 10], [-2, 10]], '#9cc4ee'); },
    fridge(S) { const W = S.W / 2, D = S.D / 2, m = P.metal;
      S.box(-W, -D, 0, W, D, 25, m); S.line([-W, D, 17], [W, D, 17], m[1]);
      S.fp(D, [[-W + 1, 9], [-W + 2, 9], [-W + 2, 14], [-W + 1, 14]], m[0]); S.fp(D, [[-W + 1, 19], [-W + 2, 19], [-W + 2, 23], [-W + 1, 23]], m[0]); S.fp(D, [[W - 3, 20], [W - 1, 20], [W - 1, 22], [W - 3, 22]], P.rose[3]); },
    stove(S) { const W = S.W / 2, D = S.D / 2, m = P.metal;
      S.box(-W, -D, 0, W, D, 15, m); S.fp(D, [[-W + 1, 2], [W - 1, 2], [W - 1, 10], [-W + 1, 10]], P.char[2]); S.fp(D, [[-W + 2, 4], [W - 2, 4], [W - 2, 8], [-W + 2, 8]], '#d98a4a');
      for (const u of [-2, 0, 2]) knob(S, u, D, 12);
      for (const [u, v] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) S.disc(u, v, 15, 2, 1, P.char[1]); },
    counter(S) { const W = S.W / 2, D = S.D / 2, w = P.wood;
      S.box(-W, -D, 0, W, D, 13, w); S.fp(D, [[-W + 1, 1], [-1, 1], [-1, 12], [-W + 1, 12]], w[1]); S.fp(D, [[1, 1], [W - 1, 1], [W - 1, 12], [1, 12]], w[1]); knob(S, -2, D, 8); knob(S, 1, D, 8);
      S.box(-W, -D, 13, W, D, 14, P.linen); },
    sink(S) { DES.counter(S); const W = S.W / 2, D = S.D / 2; S.top(14, [[-W + 2, -D + 2], [W - 2, -D + 2], [W - 2, D - 2], [-W + 2, D - 2]], P.metal[1]); S.top(14, [[-W + 3, -D + 3], [W - 2, -D + 3], [W - 2, D - 2], [-W + 3, D - 2]], P.glass[2]); S.box(0, -D, 14, 1, -D + 1, 19, P.metal); S.box(0, -D + 1, 18, 1, -D + 3, 19, P.metal); },
    cupboard(S) { const W = S.W / 2, D = S.D / 2, w = P.wood;
      S.box(-W, -D, 0, W, D, 26, w); for (const [a, b] of [[-W + 1, -1], [1, W - 1]]) { S.fp(D, [[a, 1], [b, 1], [b, 12], [a, 12]], w[1]); S.fp(D, [[a, 14], [b, 14], [b, 25], [a, 25]], w[1]); S.fp(D, [[a + 1, 15], [b - 1, 15], [b - 1, 24], [a + 1, 24]], P.glass[2]); }
      knob(S, -2, D, 7); knob(S, 1, D, 7); },
    wardrobe(S) { const W = S.W / 2, D = S.D / 2, w = P.dwood;
      S.box(-W, -D, 0, W, D, 29, w); S.box(-W, -D, 29, W, D, 30, w, { top: w[4] }); S.line([0, D, 2], [0, D, 28], w[0]); knob(S, -2, D, 15); knob(S, 1, D, 15); },
    nightstand(S) { const W = S.W / 2, D = S.D / 2, w = P.wood; S.box(-W, -D, 0, W, D, 8, w); S.fp(D, [[-W + 1, 1], [W - 1, 1], [W - 1, 6], [-W + 1, 6]], w[1]); knob(S, -1, D, 4); },
    dresser(S) { const W = S.W / 2, D = S.D / 2, w = P.wood; S.box(-W, -D, 0, W, D, 14, w); for (const z of [1, 5, 9]) { S.fp(D, [[-W + 1, z], [W - 1, z], [W - 1, z + 3], [-W + 1, z + 3]], w[1]); knob(S, -1, D, z + 2); } },
    crate(S) { const W = S.W / 2, D = S.D / 2, w = P.wood; S.box(-W, -D, 0, W, D, 12, w); S.fp(D, [[-W, 5], [W, 5], [W, 7], [-W, 7]], w[1]); S.line([-W + 1, D, 1], [W - 1, D, 11], w[1]); S.line([-W + 1, -D, 12], [-W + 1, D, 12], w[2]); S.line([1, -D, 12], [1, D, 12], w[2]); },
    barrel(S) { const w = P.wood, k = P.char; S.box(-3, -3, 0, 3, 3, 15, w); for (const z of [2, 11]) S.box(-3, -3, z, 3, 3, z + 1, k, { noRim: true }); S.top(15, [[-2, -2], [2, -2], [2, 2], [-2, 2]], w[2]); },
    toolbox(S) { const r = P.rose, k = P.char; S.box(-4, -2, 0, 4, 2, 12, r); S.box(-4, -2, 11, 4, 2, 12, k, { noRim: true }); S.box(-2, 0, 12, 2, 1, 15, k, { noRim: true }); knob(S, 0, 2, 9); },
    trophy(S) { const g = P.gold; S.box(-2, -2, 0, 2, 2, 2, P.dwood); S.box(0, 0, 2, 1, 1, 5, g, { noRim: true }); S.box(-2, -2, 5, 2, 2, 10, g, { rim: g[4] }); S.dot(-3, 0, 8, g[2]); S.dot(2, 0, 8, g[2]); },
    teddy(S) { const t = P.ginger; S.disc(0, 0, 4, 2, 3, t[2]); S.disc(0, 1, 4, 1, 2, t[4]); S.disc(0, 0, 11, 3, 3, t[2]); S.disc(-2, 0, 15, 1, 1, t[2]); S.disc(2, 0, 15, 1, 1, t[2]); S.disc(0, 1, 10, 1, 1, t[4]); S.dot(-1, 1, 12, INK); S.dot(1, 1, 12, INK); },
    cat(S, ph) { const t = P.ginger, sw = Math.round(Math.sin(ph * Math.PI * 2) * 1.5); // แมวนั่ง หางแกว่ง
      S.line([-2, 0, 2], [-4, 0, 4], t[1]); S.line([-4, 0, 4], [-4 + sw, 0, 8], t[1]); S.disc(0, 0, 4, 2, 3, t[2]); S.disc(0, 1, 4, 1, 2, t[4]);
      S.disc(1, 0, 10, 3, 3, t[2]); S.quad([[-1, 0, 12], [0, 0, 16], [1, 0, 12]], t[2]); S.quad([[2, 0, 12], [3, 0, 16], [4, 0, 12]], t[2]); S.dot(0, 1, 10, INK); S.dot(2, 1, 10, INK); },
    plant(S) { const c = P.clay, l = P.leaf;
      S.box(-2, -2, 0, 2, 2, 6, c); S.box(-3, -3, 6, 3, 3, 7, c); S.disc(0, 0, 7, 3, 1, '#4a3328');
      const blobs = [[-2, 1, 12, 4, 3], [2, -1, 13, 4, 3], [1, 1, 11, 3, 2], [0, 0, 18, 4, 3], [-1, 0, 22, 3, 2]];
      for (const [u, v, z, rx, ry] of blobs) S.disc(u, v, z, rx, ry, l[1]); for (const [u, v, z, rx, ry] of blobs) S.disc(u - 1, v + 1, z + 1, rx - 1, ry - 1, l[2]); for (const [u, v, z, rx] of blobs) S.disc(u - 1, v, z + 2, Math.max(1, rx - 3), 1, l[3]); },
    vase(S) { const b = P.blue; S.box(-1, -1, 0, 1, 1, 7, b); S.box(-1, -1, 7, 1, 1, 8, b, { top: b[0] }); S.disc(0, 0, 9, 3, 1, P.leaf[2]); S.disc(-2, 0, 11, 1, 1, P.rose[3]); S.disc(1, 0, 12, 1, 1, P.gold[3]); S.disc(0, 1, 10, 1, 1, P.linen[4]); },
    globe(S) { S.box(-2, -2, 0, 2, 2, 1, P.dwood); S.box(0, 0, 1, 1, 1, 4, P.metal, { noRim: true }); S.disc(0, 0, 8, 3, 3, P.blue[2]); S.disc(-1, 0, 9, 1, 2, P.sage[3]); S.disc(1, 1, 7, 1, 1, P.sage[3]); S.dot(-1, 0, 11, P.blue[4]); },
    floorlamp(S) { const g = P.gold, k = P.char; S.box(-2, -2, 0, 2, 2, 1, k); S.box(0, 0, 1, 1, 1, 19, k, { noRim: true }); S.box(-2, -2, 18, 3, 3, 24, g, { rim: g[4] }); },
    lantern(S) { const g = P.gold, k = P.char; S.box(0, 0, 0, 1, 1, 9, k, { noRim: true }); S.box(-2, -2, 9, 2, 2, 15, g, { rim: g[4] }); S.box(-2, -2, 15, 2, 2, 16, k); },
    piano(S) { const W = S.W / 2, D = S.D / 2, k = P.char;
      S.box(-W, -D, 0, W, -D + 4, 17, k); S.box(-W, -D + 4, 0, -W + 1, D, 11, k, { noRim: true }); S.box(W - 1, -D + 4, 0, W, D, 11, k, { noRim: true });
      S.box(-W + 1, -D + 4, 8, W - 1, D - 1, 10, k); S.top(10, [[-W + 1, -D + 4], [W - 1, -D + 4], [W - 1, -D + 7], [-W + 1, -D + 7]], P.linen[4]);
      for (let u = -W + 2; u < W - 1; u += 2) if ((u + 20) % 7 !== 3) S.top(10, [[u, -D + 4], [u + 1, -D + 4], [u + 1, -D + 6], [u, -D + 6]], k[0]);
      S.box(-W, -D, 17, W, -D + 4, 18, k, { top: k[4] }); },
    statue(S) { const s = P.stone; S.box(-5, -5, 0, 5, 5, 6, s); S.box(-3, -3, 6, 3, 3, 14, s); S.box(-2, -2, 14, 2, 2, 22, s, { rim: s[4] }); S.disc(0, 0, 25, 2, 2, s[3]); S.dot(-1, 0, 26, s[4]); },
    fountain(S, ph) { const s = P.stone, gl = P.glass;
      S.box(-8, -8, 0, 8, 8, 6, s); S.top(6, [[-7, -7], [7, -7], [7, 7], [-7, 7]], gl[1]); S.top(6, [[-6, -6], [6, -6], [6, 6], [-6, 6]], gl[2]);
      S.box(-1, -1, 6, 1, 1, 14, s); S.box(-3, -3, 13, 3, 3, 14, s, { rim: s[4] }); S.top(14, [[-2, -2], [2, -2], [2, 2], [-2, 2]], gl[2]); S.box(0, 0, 14, 1, 1, 17, gl, { noRim: true });
      for (let i = 0; i < 6; i++) { const p = (ph + i / 6) % 1, a = i * 1.047, r = 1 + p * 5; S.dot(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r), Math.round(17 - p * p * 11), gl[4]); } },
    flag(S, ph) { const w = Math.round(Math.sin(ph * Math.PI * 2)); S.box(-1, -1, 0, 1, 1, 2, P.dwood); S.box(0, 0, 2, 1, 1, 26, P.dwood, { noRim: true });
      S.fp(1, [[1, 25], [4, 25 + w], [7, 24], [7, 18], [4, 18 + w], [1, 19]], P.rose[2]); S.fp(1, [[1, 25], [4, 25 + w], [4, 23 + w], [1, 23]], P.rose[3]); },
    signpost(S) { S.box(0, 0, 0, 1, 1, 22, P.dwood, { noRim: true }); S.box(-4, 0, 14, 5, 1, 19, P.wood); S.line([-3, 1, 17], [3, 1, 17], P.wood[1]); },
    mailbox(S) { S.box(0, 0, 0, 1, 1, 12, P.dwood, { noRim: true }); S.box(-2, -2, 12, 2, 2, 18, P.blue, { rim: P.blue[4] }); S.box(2, 0, 15, 2, 1, 20, P.rose, { left: P.rose[2], right: P.rose[2] }); S.fp(2, [[-1, 13], [1, 13], [1, 15], [-1, 15]], P.blue[0]); },
    hut(S) { const w = P.wood, b = P.brick; S.box(-7, -7, 0, 7, 7, 16, P.gold);
      S.fp(7, [[-2, 0], [2, 0], [2, 9], [-2, 9]], P.dwood[0]); S.quad([[-8, 8, 16], [8, 8, 16], [0, 0, 30]], b[2]); S.quad([[8, -8, 16], [8, 8, 16], [0, 0, 30]], b[1]); S.line([-8, 8, 16], [8, 8, 16], b[4]); },
    fireplace(S, ph) { const W = S.W / 2, D = S.D / 2, b = P.brick, f = Math.round(Math.sin(ph * Math.PI * 2));
      S.box(-W, -D, 0, W, D, 23, b); S.box(-W, -D, 23, W, D, 25, P.dwood, { rim: P.dwood[4] });
      S.fp(D, [[-4, 0], [4, 0], [4, 12], [-4, 12]], P.char[0]); S.fp(D, [[-3, 1], [3, 1], [3, 2], [-3, 2]], P.dwood[1]);
      S.fp(D, [[-3, 2], [3, 2], [2, 6 + f], [0, 9 - f], [-2, 6 + f]], '#e8641e'); S.fp(D, [[-2, 2], [2, 2], [1, 5 - f], [0, 7 + f], [-1, 5]], '#ffb02e'); S.fp(D, [[-1, 2], [1, 2], [0, 4]], '#fff0a0');
      S.fp(D, [[-W, 0], [W, 0], [W, 1], [-W, 1]], P.stone[2]); },
    aquarium(S, ph) { const W = S.W / 2, D = S.D / 2, sw = Math.round(Math.sin(ph * Math.PI * 2) * 3);
      S.box(-W, -D, 0, W, D, 6, P.dwood); S.box(-W, -D, 6, W, D, 16, P.glass, { a: 0.85, top: P.glass[3] }); S.fp(D, [[-W, 6], [W, 6], [W, 8], [-W, 8]], P.linen[3]);
      S.fp(D, [[-W + 2, 8], [-W + 3, 8], [-W + 3, 13], [-W + 2, 13]], P.leaf[2]); S.dot(sw, D, 12, '#ff9a3c'); S.dot(-sw + 1, D, 10, '#e84a5f'); S.line([-W, D, 16], [W, D, 16], P.char[3]); },
    screen_wood(S) { screen(S, P.dwood, (D, a, b, H) => { for (let k = 0; k < 3; k++) { const u0 = a + 1 + k * 5 + (k ? 0 : 0), u1 = u0 + 4; S.fp(D, [[u0, 2], [u1, 2], [u1, H - 2], [u0, H - 2]], P.wood[2]); S.fp(D, [[u0 + 1, 4], [u1 - 1, 4], [u1 - 1, H - 4], [u0 + 1, H - 4]], P.wood[3]); } }); },
    screen_shoji(S) { screen(S, P.dwood, (D, a, b, H) => { S.fp(D, [[a + 1, 2], [b - 1, 2], [b - 1, H - 2], [a + 1, H - 2]], P.linen[4]); for (let u = a + 4; u < b - 1; u += 4) S.line([u, D, 2], [u, D, H - 2], P.dwood[2]); for (const z of [10, 19]) S.line([a + 1, D, z], [b - 1, D, z], P.dwood[2]); }); },
    screen_lattice(S) { screen(S, P.dwood, (D, a, b, H) => { S.fp(D, [[a + 1, 2], [b - 1, 2], [b - 1, H - 2], [a + 1, H - 2]], P.linen[2]); for (let u = a + 2; u < b - 1; u += 2) S.line([u, D, 2], [u, D, H - 2], P.wood[1]); for (let z = 5; z < H - 2; z += 4) S.line([a + 1, D, z], [b - 1, D, z], P.wood[1]); }); },
    screen_glass(S) { const W = S.W / 2, D = S.D / 2, m = P.metal; S.box(-W, -D, 0, W, D, 3, m); S.box(-W, -D, 3, W, D, 26, P.glass, { a: 0.8 }); S.box(-W, -D, 26, W, D, 28, m);
      S.line([-W + 3, D, 8], [-W + 3, D, 22], P.glass[4]); S.line([-W + 5, D, 12], [-W + 5, D, 22], P.glass[4]); },
    screen_bamboo(S) { screen(S, P.bamboo, (D, a, b, H) => { for (let u = a; u < b; u += 2) { S.fp(D, [[u, 1], [u + 2, 1], [u + 2, H - 1], [u, H - 1]], ((u - a) / 2) & 1 ? P.bamboo[2] : P.bamboo[3]); for (const z of [9, 19]) S.line([u, D, z], [u + 2, D, z], P.bamboo[0]); } }); },
    lowwall(S) { const W = S.W / 2, D = S.D / 2; S.box(-W, -D, 0, W, D, 13, P.linen); for (let k = 0; k < 4; k++) S.fp(D, [[-W + 1 + k * 4, 2], [-W + 3 + k * 4, 2], [-W + 3 + k * 4, 11], [-W + 1 + k * 4, 11]], P.linen[1]); S.box(-W, -D, 13, W, D, 15, P.wood); },
  };
  // ของติดผนัง: ระนาบ v = 0 คือผนัง ชิ้นยื่นออกมาหาห้อง 1 หน่วย กึ่งกลางสูง 30 (60 px โลก)
  const WALL = {
    painting(S, W, H) { S.box(-W, 0, 30 - H, W, 1, 30 + H, P.gold); S.fp(1, [[-W + 1, 31 - H], [W - 1, 31 - H], [W - 1, 29 + H], [-W + 1, 29 + H]], '#8fc3d8'); S.fp(1, [[-W + 1, 31 - H], [W - 1, 31 - H], [W - 1, 28], [2, 31], [-W + 1, 27]], P.leaf[2]); S.fcirc(1, W - 3, 29 + H - 4, 1, P.gold[4]); },
    clock(S, W, H) { S.fcirc(1, 0, 30, 3, P.char[2]); S.fcirc(1, 0, 30, 2.5, P.linen[4]); S.line([0, 1, 30], [0, 1, 34], INK); S.line([0, 1, 30], [1, 1, 30], INK); S.box(0, 0, 30, 0, 1, 30, P.char); },
    map(S, W, H) { S.box(-W, 0, 30 - H, W, 1, 30 + H, P.dwood); S.fp(1, [[-W + 1, 31 - H], [W - 1, 31 - H], [W - 1, 29 + H], [-W + 1, 29 + H]], P.blue[3]); S.fcirc(1, -2, 31, 2.2, P.sage[2]); S.fcirc(1, 3, 28, 1.6, P.sage[2]); S.fcirc(1, 2, 34, 1.1, P.sage[3]); S.dot(-2, 1, 32, P.rose[2]); },
    records(S, W, H) { const cols = [P.rose, P.sage, P.plum], sw = Math.floor(W * 2 / 3); for (let k = 0; k < 3; k++) { const u0 = -W + k * sw, u1 = u0 + sw - 1, uc = (u0 + u1) / 2; S.box(u0, 0, 30 - H, u1, 1, 30 + H, P.char); S.fcirc(1, uc, 30, 1.5, cols[k][2]); S.fcirc(1, uc, 30, 0.5, P.linen[4]); } },
    mirror(S, W, H) { S.box(-W, 0, 30 - H, W, 1, 30 + H, P.gold); S.fp(1, [[-W + 1, 31 - H], [W - 1, 31 - H], [W - 1, 29 + H], [-W + 1, 29 + H]], P.glass[3]); S.line([-W + 2, 1, 32], [-W + 4, 1, 38], P.glass[4]); S.line([-W + 2, 1, 26], [-W + 5, 1, 34], P.glass[4]); },
    poster(S, W, H) { S.box(-W, 0, 30 - H, W, 1, 30 + H, P.linen); S.fp(1, [[-W + 1, 31], [W - 1, 31], [W - 1, 29 + H], [-W + 1, 29 + H]], P.blue[2]); S.fp(1, [[-W + 1, 26], [W - 1, 26], [W - 1, 31], [-W + 1, 31]], P.gold[3]); S.fcirc(1, 0, 32, 1.5, P.rose[2]); S.fp(1, [[-W + 1, 31 - H + 1], [W - 1, 31 - H + 1], [W - 1, 31 - H + 2], [-W + 1, 31 - H + 2]], P.dwood[2]); },
  };
  WALL.wreath = (S, W, H) => { // พวงหรีด: วงใบไม้ เจาะรูกลาง โบว์แดง
    S.fcirc(1, 0, 30, 3, P.leaf[1]); S.fcirc(1, 0, 30, 2.2, P.leaf[2]); S.fcirc(1, 0, 30, 1.2, 'clear'); S.fp(1, [[-1, 35], [1, 35], [1, 37], [-1, 37]], P.rose[2]); S.dot(-2, 1, 29, P.rose[3]); S.dot(1, 1, 32, P.rose[3]); S.dot(1, 1, 27, P.gold[3]); };
  const ANIM = { cat: 1, fountain: 1, flag: 1, fireplace: 1, aquarium: 1 };
  function sprite(f, d, r, ph, shadow) { const s = new S(Math.round((d.w || 1) * 8), Math.round((d.d || 1) * 8), r ? 1 : 0); if (shadow && !d.flat) s.shadow(); DES[f](s, ph || 0); return s.done(); }
  function wall(f, d, wl) { const s = new S(Math.round((d.w || 1) * 8), 0, wl === 'w' ? 1 : 0), W = Math.round((d.w || 1) * 4), H = Math.round((d.h || 30) / 4); WALL[f](s, W, H); return s.done(); }
  return { sprite, wall, has: f => !!DES[f], hasWall: f => !!WALL[f], anim: f => !!ANIM[f], P, setCanvasFactory(fn) { factory = fn; } };
})();
if (typeof module !== 'undefined') module.exports = PixelFurn;
