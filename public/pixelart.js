// ศิลป์พิกเซลของโลก (เฟส 1): พื้น ต้นไม้ อาคาร เคาน์เตอร์ รั้ว ดินแปลงผัก
// วาดที่ 16 px ต่อช่อง (U) แล้วให้ game.js ขยาย 2 เท่าเป็นช่อง 32 px แบบไม่เบลอ (imageSmoothingEnabled = false)
// ทุกสไปรต์สร้างครั้งเดียวแล้วเก็บแคช มีเส้นขอบเข้ม 1 px สี OUT และแสงมาจากซ้ายบน
const PixelArt = (() => {
  const { W, H, T, HOUSING, plotAt, isPaved } = Shared;
  const U = 16, OUT = '#2a1b14';

  // ---------- utils ----------
  const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  function vnoise(x, y, sc, s) {
    const fx = x / sc, fy = y / sc, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
  const dith = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const rgb = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const shade = (c, k) => { const a = rgb(c); return toHex(k < 0 ? a.map(v => v * (1 + k)) : a.map(v => v + (255 - v) * k)); }; // k<0 เข้มขึ้น k>0 สว่างขึ้น
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const r = (x, c, X, Y, w, h) => { x.fillStyle = c; x.fillRect(X, Y, w, h); };
  function disc(x, cx, cy, rad, c) { x.fillStyle = c; for (let dy = -rad; dy <= rad; dy++) { const w = Math.floor(Math.sqrt(rad * rad - dy * dy) + .5); x.fillRect(cx - w, cy + dy, w * 2 + 1, 1); } }
  function ell(x, cx, cy, rx, ry, c) { x.fillStyle = c; for (let dy = -ry; dy <= ry; dy++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))) + .5); x.fillRect(cx - w, cy + dy, w * 2 + 1, 1); } }
  function addOutline(c, col = OUT) {
    const x = c.getContext('2d'), w = c.width, h = c.height, d = x.getImageData(0, 0, w, h), a = d.data;
    const o = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) o[i] = a[i * 4 + 3] > 90 ? 1 : 0;
    const [R, G, B] = rgb(col);
    for (let y = 0; y < h; y++) for (let x2 = 0; x2 < w; x2++) {
      const i = y * w + x2; if (o[i]) { a[i * 4 + 3] = 255; continue; }
      if ((x2 > 0 && o[i - 1]) || (x2 < w - 1 && o[i + 1]) || (y > 0 && o[i - w]) || (y < h - 1 && o[i + w])) { a[i * 4] = R; a[i * 4 + 1] = G; a[i * 4 + 2] = B; a[i * 4 + 3] = 255; }
      else a[i * 4 + 3] = 0;
    }
    x.putImageData(d, 0, 0);
  }
  // ขอบละมุน: เส้นข้าง = สี ink อ่อน · มุมเฉียง = สี mid (pixel AA) ลดความรู้สึกคมเหลี่ยมดำ
  function addSoftOutline(c, ink, mid) {
    const x = c.getContext('2d'), w = c.width, h = c.height, d = x.getImageData(0, 0, w, h), a = d.data;
    const o = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) o[i] = a[i * 4 + 3] > 90 ? 1 : 0;
    const I = rgb(ink), M = rgb(mid);
    for (let y = 0; y < h; y++) for (let x2 = 0; x2 < w; x2++) {
      const i = y * w + x2; if (o[i]) { a[i * 4 + 3] = 255; continue; }
      const n = (x2 > 0 && o[i - 1]) || (x2 < w - 1 && o[i + 1]) || (y > 0 && o[i - w]) || (y < h - 1 && o[i + w]);
      const dgn = (x2 > 0 && y > 0 && o[i - w - 1]) || (x2 < w - 1 && y > 0 && o[i - w + 1])
        || (x2 > 0 && y < h - 1 && o[i + w - 1]) || (x2 < w - 1 && y < h - 1 && o[i + w + 1]);
      if (n) { a[i * 4] = I[0]; a[i * 4 + 1] = I[1]; a[i * 4 + 2] = I[2]; a[i * 4 + 3] = 255; }
      else if (dgn) { a[i * 4] = M[0]; a[i * 4 + 1] = M[1]; a[i * 4 + 2] = M[2]; a[i * 4 + 3] = 200; }
      else a[i * 4 + 3] = 0;
    }
    x.putImageData(d, 0, 0);
  }
  // สไปรต์มีขอบว่าง 1 px ไว้ให้เส้นขอบ: วาดที่ (x-1, y-1) · outline เป็นสีหรือ { soft:[ink,mid] }
  function mk(w, h, fn, outline = true) {
    const c = cv(w + 2, h + 2), x = c.getContext('2d');
    x.translate(1, 1); fn(x, w, h); x.setTransform(1, 0, 0, 1, 0, 0);
    if (outline && outline.soft) addSoftOutline(c, outline.soft[0], outline.soft[1]);
    else if (outline) addOutline(c, outline === true ? OUT : outline);
    return c;
  }
  // วงรีขอบ dither — ทรงมนกว่า disc ตัดเหลี่ยม
  function softPuff(x, cx, cy, rx, ry, pal, R) {
    for (let dy = -ry - 2; dy <= ry + 2; dy++) for (let dx = -rx - 2; dx <= rx + 2; dx++) {
      const nx = dx / (rx + 0.2), ny = dy / (ry + 0.2), d2 = nx * nx + ny * ny;
      if (d2 > 1.15) continue;
      // ขอบนอก dither ให้ไม่ตัดวงกลมเป๊ะ
      if (d2 > 0.92 && dith(cx + dx, cy + dy) > 0.55) continue;
      if (d2 > 1.02 && dith(cx + dx + 1, cy + dy) > 0.35) continue;
      const lit = clamp(0.52 - ny * 0.42 - nx * 0.16 + (1 - Math.min(1, d2)) * 0.3, 0, 1);
      let i = Math.floor(lit * (pal.length - 1.05));
      if (lit * (pal.length - 1) - i > dith(cx + dx, cy + dy)) i++;
      i = clamp(i, 0, pal.length - 1);
      if (d2 > 0.78) i = Math.max(0, i - 1);
      if (ny > 0.35 && d2 < 0.85) i = Math.max(0, i - 1); // เงาใต้ก้อน
      r(x, pal[i], cx + dx, cy + dy, 1, 1);
    }
    // จุดยื่นนอกพุ่ม (ทำลายขอบเรขา)
    for (let k = 0; k < 5 + Math.floor(R() * 6); k++) {
      const a = R() * Math.PI * 2, rr = Math.max(rx, ry) * (0.85 + R() * 0.35);
      const px = Math.round(cx + Math.cos(a) * rr), py = Math.round(cy + Math.sin(a) * rr * 0.9);
      r(x, pal[Math.min(pal.length - 1, 3)], px, py, 2, 1);
      r(x, pal[Math.min(pal.length - 1, 2)], px + (R() < .5 ? 1 : -1), py - 1, 1, 1);
    }
  }

  // ---------- ground ----------
  const G = 0, P = 1, SA = 2, WA = 3, FL = 4;
  const gtype = t => (t === T.WATER || t === T.BRIDGE ? WA : t === T.LANDMARK ? P : t === T.SAND ? SA : t === T.FLOOR || t === T.FURN ? FL : t === T.PATH || t === T.BUILD || t === T.SHOP ? P : G);
  const BLEND = [true, true, true, true, false];
  // หญ้าเขียวอิ่มแบบ cozy village (ตรง STYLE_GUIDE + ภาพอ้างอิงลานกองไฟ)
  const GRASS = ['#5fa844', '#6eb850', '#7bc65a', '#8cd468', '#a0e078'].map(rgb);
  const PATH = ['#c9a869', '#d4b478', '#dcbf82'].map(rgb);
  // น้ำใส โทนเทอร์ควอยส์: ลึกกลางสระเข้ม ริมฝั่งอ่อนลง (ไล่ตามระยะจากฝั่ง)
  const WATERC = ['#1a7398', '#2a96b8', '#4ab8cc', '#7ad4e0'].map(rgb);
  const SHALLOW = rgb('#b8efe8'), SANDBED = rgb('#e2cf90'); // ริมฝั่งน้ำตื้นเห็นพื้นทรายใต้น้ำ
  const mixc = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  function ground(MAP) {
    const PW = W * U, PH = H * U, c = cv(PW, PH), x = c.getContext('2d'), img = x.createImageData(PW, PH), a = img.data;
    const tileT = (tx, ty) => (tx < 0 || ty < 0 || tx >= W || ty >= H) ? G : gtype(MAP[ty][tx]);
    // ระยะจากฝั่งของน้ำแต่ละช่อง (ไว้ไล่สีน้ำตื้น-ลึก)
    const depth = Array.from({ length: H }, () => new Array(W).fill(0));
    { const q = []; for (let y = 0; y < H; y++) for (let x2 = 0; x2 < W; x2++) if (tileT(x2, y) === WA) depth[y][x2] = 99; else q.push([x2, y]);
      while (q.length) { const [qx, qy] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = qx + dx, ny = qy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; if (depth[ny][nx] > depth[qy][qx] + 1) { depth[ny][nx] = depth[qy][qx] + 1; q.push([nx, ny]); } } } }
    const types = new Uint8Array(PW * PH);
    const pv = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && tileT(tx, ty) === P && isPaved(tx, ty); // ลานปูหิน: ขอบคมตามช่อง ไม่ให้หญ้า/ดินรุกเข้ามา
    // ขอบ organic ละมุน: สั่นหลายสเกล + dither มุม ลดเส้นตรงกริด (ลานปูหินยังคม)
    for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
      const t0 = tileT(px >> 4, py >> 4); let t = t0;
      if (BLEND[t0] && !pv(px >> 4, py >> 4)) {
        const jx = (vnoise(px, py, 8, 11) - .5) * 11 + (vnoise(px, py, 3, 21) - .5) * 5 + (vnoise(px, py, 2, 31) - .5) * 2;
        const jy = (vnoise(px, py, 8, 12) - .5) * 11 + (vnoise(px, py, 3, 22) - .5) * 5 + (vnoise(px, py, 2, 32) - .5) * 2;
        const tx1 = Math.floor((px + jx) / U), ty1 = Math.floor((py + jy) / U), t1 = tileT(tx1, ty1);
        if (BLEND[t1] && !pv(tx1, ty1)) t = t1;
        // มุมช่อง: สลับชนิดตาม dither ให้ขอบโค้งขึ้นอีก
        else if (BLEND[t0]) {
          const lx = px & 15, ly = py & 15, corner = (lx < 3 || lx > 12) && (ly < 3 || ly > 12);
          if (corner && dith(px, py) > 0.55) {
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const t2 = tileT((px >> 4) + dx, (py >> 4) + dy);
              if (BLEND[t2] && t2 !== t0 && !pv((px >> 4) + dx, (py >> 4) + dy)) { t = t2; break; }
            }
          }
        }
      }
      types[py * PW + px] = t;
    }
    const Tp = (px, py) => (px < 0 || py < 0 || px >= PW || py >= PH) ? G : types[py * PW + px];
    const set = (px, py, col) => { if (px < 0 || py < 0 || px >= PW || py >= PH) return; const i = (py * PW + px) * 4; a[i] = col[0]; a[i + 1] = col[1]; a[i + 2] = col[2]; a[i + 3] = 255; };
    const C = {}; const hx = s => C[s] || (C[s] = rgb(s));
    for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
      const t = types[py * PW + px], h = hash(px, py, 3); let col;
      if (t === G) {
        const v = vnoise(px, py, 56, 1) * .6 + vnoise(px, py, 14, 2) * .28 + vnoise(px, py, 5, 7) * .12;
        col = GRASS[clamp(Math.floor(v * 4.4 + dith(px, py) - 1.05), 0, 4)];
        // จุดไฮไลต์แดดบางๆ บนหญ้า (ไม่แฟลร์)
        if (h > .992 && v > .55) col = mixc(col, rgb('#fff3b0'), .22);
      } else if (t === P && pv(px >> 4, py >> 4)) { // ปูหินก้อนสี่เหลี่ยมสลับแถว มีรอยต่อ ขอบนอกเข้ม
        const row = py >> 3, bx = (px + (row & 1) * 4) >> 3, lx = (px + (row & 1) * 4) & 7, ly = py & 7, bh = hash(bx, row, 31);
        col = hx(bh < .33 ? '#d2c8b0' : bh < .66 ? '#c9bea4' : '#dbd1ba');
        if (lx === 0 || ly === 0) col = hx('#a79c80'); else if (ly === 1) col = hx('#e8e0cc'); else if (lx === 7 && ly > 4) col = hx('#b8ad92');
        if (h < .02) col = hx('#8f8468');
        if (!pv((px - 1) >> 4, py >> 4) && (px & 15) === 0 || !pv((px + 1) >> 4, py >> 4) && (px & 15) === 15 || !pv(px >> 4, (py - 1) >> 4) && (py & 15) === 0 || !pv(px >> 4, (py + 1) >> 4) && (py & 15) === 15) col = hx('#7d7258'); // ขอบลาน
      } else if (t === P) {
        col = PATH[clamp(Math.floor(vnoise(px, py, 18, 4) * 3 + dith(px, py) * .6 - .3), 0, 2)];
        if (h < .04) col = hx('#e8c896'); else if (h > .97) col = hx('#a77a4a');
        else if (h > .86 && h < .88) col = hx('#b88958'); // จุดดิน/กรวดเล็กบนทาง
        // ขอบทาง: ผสมหญ้ารุกเข้ามา + โทนดินอุ่น (ลบเส้นตัดตรง)
        const nearG = Tp(px, py - 2) === G || Tp(px, py + 2) === G || Tp(px - 2, py) === G || Tp(px + 2, py) === G
          || Tp(px - 3, py - 2) === G || Tp(px + 3, py + 2) === G;
        if (nearG) {
          if (h < .22) col = GRASS[clamp(2 + (h < .1 ? 1 : 0), 0, 4)];
          else col = hx(h < .5 ? '#b4844f' : '#c09458');
        }
      } else if (t === SA) {
        const sv = vnoise(px, py, 6, 8) + dith(px, py) * .3;
        col = hx(sv > .78 ? '#d6b97c' : sv > .4 ? '#e2c890' : '#efdfa4');
        if (Tp(px, py - 2) === WA || Tp(px, py + 2) === WA || Tp(px - 2, py) === WA || Tp(px + 2, py) === WA) col = hx('#c5a46a');
        if (h < .05) col = hx('#f5e4b8'); else if (h > .97) col = hx('#c9a869');
      } else if (t === WA) {
        const tx = px / U - .5, ty = py / U - .5, ix = clamp(Math.floor(tx), 0, W - 1), iy = clamp(Math.floor(ty), 0, H - 1);
        const fx = tx - ix, fy = ty - iy, dv = (k, l) => Math.min(4, depth[clamp(iy + l, 0, H - 1)][clamp(ix + k, 0, W - 1)]);
        const d = (dv(0, 0) * (1 - fx) + dv(1, 0) * fx) * (1 - fy) + (dv(0, 1) * (1 - fx) + dv(1, 1) * fx) * fy;
        col = WATERC[3 - clamp(Math.floor(d * .9 + dith(px, py) * .8 - .4), 0, 3)];
        const sh = clamp((2.6 - d) / 1.5, 0, 1); // ใกล้ฝั่งน้ำใสขึ้น เห็นทรายข้างล่าง
        col = mixc(mixc(col, SHALLOW, sh * .5), SANDBED, sh * sh * .22);
        if (Tp(px, py - 1) !== WA || Tp(px - 1, py) !== WA) col = hx('#eafdfd'); // ฟองริมตลิ่ง
      } else { // พื้นไม้ของที่ดิน
        const pid = Math.floor(py / 5), ix = (px + pid * 11) % 26, iy = py % 5;
        col = hx(hash(pid, Math.floor((px + pid * 11) / 26), 5) < .5 ? '#b67d45' : '#c08a50');
        if (iy === 0) col = hx('#d29a5e');
        if (iy === 4 || ix === 0) col = hx('#7a4d28');
        if (ix === 2 && iy === 2) col = hx('#5a3a20');
      }
      set(px, py, col);
    }
    // รายละเอียดริมสระ: กรวดและกอต้นกกเล็กๆ บนทรายที่ติดน้ำ
    for (let py = 2; py < PH - 3; py++) for (let px = 2; px < PW - 2; px++) {
      if (types[py * PW + px] !== SA) continue;
      if (!(Tp(px, py - 2) === WA || Tp(px, py + 2) === WA || Tp(px - 2, py) === WA || Tp(px + 2, py) === WA)) continue;
      const r = hash(px, py, 21);
      if (r < .018) { set(px, py, hx('#4f8a3a')); set(px, py - 1, hx('#6fa84f')); set(px, py - 2, hx('#8cc463')); set(px - 1, py - 1, hx('#4f8a3a')); }
      else if (r < .045) { set(px, py, hx('#8f9aa1')); set(px + 1, py, hx('#8f9aa1')); set(px, py - 1, hx('#c4ccd0')); }
    }
    // ใบหญ้า กอหญ้า ดอกไม้ป่า กรวด — หนาขึ้นทั้งแมพให้โซนโล่งใกล้ลานกลาง
    for (let py = 1; py < PH - 1; py++) for (let px = 0; px < PW; px++) if (types[py * PW + px] === G && hash(px, py, 13) < .045) { set(px, py, GRASS[4]); set(px, py + 1, GRASS[0]); }
    const R = rng(42), area = W * H;
    for (let i = 0; i < area * .78; i++) {
      const px = Math.floor(R() * PW), py = Math.floor(R() * PH);
      if (Tp(px, py) !== G || Tp(px - 3, py) !== G || Tp(px + 3, py) !== G) continue;
      const dk = GRASS[0], lt = GRASS[3];
      set(px, py, dk); set(px, py - 1, lt); set(px, py - 2, lt); set(px - 1, py, dk); set(px - 2, py - 1, lt); set(px + 1, py, dk); set(px + 2, py - 1, lt);
    }
    // ดอกจุดเล็ก: เหลือง/ชมพู/ฟ้าเป็นหลัก (ตามภาพอ้างอิง) + ขาวอ่อน
    const FLC = ['#ffe37a', '#ffc9de', '#9fd4ff', '#fff6e0', '#ff9db0', '#c9b6ff'].map(rgb);
    for (let i = 0; i < area * .42; i++) {
      const px = 2 + Math.floor(R() * (PW - 4)), py = 2 + Math.floor(R() * (PH - 4));
      let ok = true; for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (Tp(px + dx, py + dy) !== G) { ok = false; break; }
      if (!ok) continue;
      const pc = FLC[Math.floor(R() * FLC.length)], cc = hx(R() < .55 ? '#ffcf3d' : '#e8743f');
      set(px, py + 2, GRASS[0]); set(px - 1, py, pc); set(px + 1, py, pc); set(px, py - 1, pc); set(px, py + 1, pc); set(px, py, cc);
      if (R() < .45) { set(px + 3, py + 1, pc); set(px + 3, py + 2, GRASS[0]); }
    }
    // กรวดบนทางดิน + จุดเปียกบางๆ ให้ทางไมเรียบทึบ
    for (let i = 0; i < area * .16; i++) {
      const px = Math.floor(R() * PW), py = Math.floor(R() * PH);
      if (Tp(px, py) !== P || Tp(px + 1, py + 1) !== P || pv(px >> 4, py >> 4)) continue;
      set(px, py, hx('#e2d4b8')); set(px + 1, py, hx('#a89070')); set(px, py + 1, hx('#a89070')); set(px + 1, py + 1, hx('#6e5f52'));
    }
    for (let i = 0; i < area * .06; i++) {
      const px = Math.floor(R() * PW), py = Math.floor(R() * PH);
      if (Tp(px, py) !== SA) continue;
      set(px, py, hx('#f0dcab')); if (Tp(px + 1, py) === SA) set(px + 1, py, hx('#c9a869'));
    }
    // transition ขอบดิน↔หญ้า: ดอก/กรวด/กอหญ้าแซมตามรอยต่อ ลบเส้นสี่เหลี่ยม
    for (let py = 2; py < PH - 2; py++) for (let px = 2; px < PW - 2; px++) {
      const t = Tp(px, py); if (t !== G && t !== P) continue;
      if (pv(px >> 4, py >> 4)) continue;
      const og = t === G, cross = (Tp(px - 1, py) === (og ? P : G)) || (Tp(px + 1, py) === (og ? P : G))
        || (Tp(px, py - 1) === (og ? P : G)) || (Tp(px, py + 1) === (og ? P : G));
      if (!cross) continue;
      const u = hash(px, py, 44);
      if (u < .08) { set(px, py, hx(u < .04 ? '#8f9aa1' : '#c4ccd0')); } // กรวด
      else if (u < .16) { set(px, py, FLC[Math.floor(hash(px, py, 45) * FLC.length)]); set(px, py + 1, GRASS[0]); } // ดอกขอบทาง
      else if (u < .28 && og) { set(px, py, GRASS[0]); set(px, py - 1, GRASS[3]); } // กอหญ้า
      else if (u < .22 && !og) { set(px, py, GRASS[2]); } // หญ้ารุกบนดิน
    }
    x.putImageData(img, 0, 0);
    // กรอบที่ดิน (ช่องขอบของแต่ละแปลง) แบบเดิม
    for (let y = 0; y < H; y++) for (let x2 = 0; x2 < W; x2++) {
      if (gtype(MAP[y][x2]) !== FL) continue;
      const pi = plotAt(x2, y); if (pi < 0) continue;
      const px = x2 * U, py = y * U, x0 = HOUSING.plots[pi];
      x.fillStyle = '#6e4524';
      if (y === HOUSING.y0) x.fillRect(px, py, U, 2); if (y === HOUSING.y1) x.fillRect(px, py + U - 2, U, 2);
      if (x2 === x0) x.fillRect(px, py, 2, U); if (x2 === x0 + HOUSING.w - 1) x.fillRect(px + U - 2, py, 2, U);
    }
    return c;
  }

  // ---------- fences (วาดลงพื้น ต่อกันตามช่องข้างเคียง) — ไม้โทนอุ่นตาม STYLE_GUIDE ----------
  function fences(x, MAP) {
    const isF = (tx, ty) => MAP[ty] && MAP[ty][tx] === T.FENCE;
    const W0 = '#8b5a2b', W1 = '#a0692f', W2 = '#c98b4a', W3 = '#6a4220';
    for (let y = 0; y < H; y++) for (let x2 = 0; x2 < W; x2++) {
      if (!isF(x2, y)) continue;
      const px = x2 * U, py = y * U, L = isF(x2 - 1, y), Rr = isF(x2 + 1, y), Up = isF(x2, y - 1), Dn = isF(x2, y + 1);
      x.fillStyle = 'rgba(38,40,16,.22)'; x.fillRect(px + 2, py + 13, 12, 2);
      if (L || Rr || !(Up || Dn)) { // ราวแนวนอน
        const x0 = L ? px : px + 6, x1 = Rr ? px + U : px + 10;
        for (const ry of [py + 5, py + 9]) { r(x, OUT, x0, ry - 1, x1 - x0, 4); r(x, W0, x0, ry, x1 - x0, 2); r(x, W2, x0, ry, x1 - x0, 1); }
      }
      if (Dn) { r(x, OUT, px + 6, py + 8, 4, 8); r(x, W0, px + 7, py + 8, 2, 8); r(x, W2, px + 7, py + 8, 1, 8); }
      if (Up) { r(x, OUT, px + 6, py, 4, 8); r(x, W0, px + 7, py, 2, 8); r(x, W2, px + 7, py, 1, 8); }
      // เสา
      r(x, OUT, px + 5, py + 1, 6, 14); r(x, W1, px + 6, py + 2, 4, 12); r(x, W2, px + 6, py + 2, 2, 11); r(x, W3, px + 6, py + 2, 4, 1);
      r(x, '#6b8f45', px + 5, py + 14, 2, 1); r(x, '#6b8f45', px + 10, py + 14, 1, 1);
    }
  }

  // ---------- trees ----------
  // kind: 0 ใบกลม • 1 ผลส้ม • 2 ใบเข้ม • 3 สน • 4 ดอกชมพู • 5 สัก • 6 ราชพฤกษ์ • 7 พะยูง
  // พุ่มเมฆกลม มี padding พอให้ขอบไม่ชนแคนวาส (กันภาพตัดตรง) · ขอบ OUT ตาม STYLE_GUIDE
  const TREE_OUT = true; // ขอบ #2a1b14 1 px
  function softPuffSafe(x, cx, cy, rx, ry, pal, R, pad) {
    // เหมือน softPuff แต่ไม่ยื่นจุดสุ่มออกนอกพุ่มมาก (ลดขอบฟันเลื่อย/ตัดแปลก)
    for (let dy = -ry - 1; dy <= ry + 1; dy++) for (let dx = -rx - 1; dx <= rx + 1; dx++) {
      const nx = dx / (rx + 0.35), ny = dy / (ry + 0.35), d2 = nx * nx + ny * ny;
      if (d2 > 1.05) continue;
      if (d2 > 0.88 && dith(cx + dx, cy + dy) > 0.72) continue; // ขอบหยักเบา ไม่กัดลึก
      const lit = clamp(0.55 - ny * 0.4 - nx * 0.14 + (1 - Math.min(1, d2)) * 0.28, 0, 1);
      let i = Math.floor(lit * (pal.length - 1.05));
      if (lit * (pal.length - 1) - i > dith(cx + dx, cy + dy)) i++;
      i = clamp(i, 0, pal.length - 1);
      if (d2 > 0.8) i = Math.max(0, i - 1);
      if (ny > 0.32 && d2 < 0.82) i = Math.max(0, i - 1);
      r(x, pal[i], cx + dx, cy + dy, 1, 1);
    }
    for (let k = 0; k < 3 + Math.floor(R() * 3); k++) {
      const a = R() * Math.PI * 2, rr = Math.max(rx, ry) * (0.72 + R() * 0.18);
      const px = Math.round(cx + Math.cos(a) * rr), py = Math.round(cy + Math.sin(a) * rr * 0.88);
      if (px < pad || py < pad || px >= 48 - pad || py >= 52 - pad) continue;
      r(x, pal[Math.min(pal.length - 1, 3)], px, py, 1, 1);
    }
  }
  function tree(seed, kind) {
    // แคนวาสกว้าง/สูงขึ้น + เว้นขอบใน กันพุ่มโดนตัดตรง
    const TW = 48, TH = 52, PAD = 4;
    const c = mk(TW, TH, (x) => {
      const R = rng(seed), bark = kind === 7 ? ['#4a1f16', '#6b2f22', '#8a3f2c'] : ['#5a371e', '#7d4f2a', '#a07040'];
      const cx0 = 24;
      // ลำต้น + รากแผ่ (วางกลาง โคนอยู่ใกล้ขอบล่าง)
      r(x, bark[0], cx0 - 3, 34, 6, 14); r(x, bark[1], cx0 - 2, 34, 3, 14); r(x, bark[2], cx0 - 2, 36, 1, 8);
      for (let yy = 36; yy < 46; yy += 3) r(x, bark[0], cx0 - 3, yy, 6, 1);
      r(x, bark[0], cx0 - 7, 46, 14, 3); r(x, bark[1], cx0 - 5, 46, 5, 1); // ราก
      r(x, bark[0], cx0 - 8, 47, 3, 2); r(x, bark[0], cx0 + 5, 47, 3, 2);
      ell(x, cx0 - 8, 48, 4, 2, '#3f8a46'); ell(x, cx0 + 8, 48, 4, 2, '#4f913b'); // หญ้าโคนต้น
      // ก้อนเมฆพุ่ม: อยู่ภายใน PAD+รัศมี เสมอ
      let blobs = kind === 1 ? [[24, 18, 11, 9], [12, 20, 8, 6], [35, 20, 8, 6], [24, 24, 8, 6], [16, 12, 6, 5], [32, 12, 6, 5], [17, 26, 6, 4], [31, 26, 6, 4]]
        : kind === 5 ? [[24, 18, 12, 9], [11, 20, 8, 6], [36, 20, 8, 6], [24, 10, 7, 6], [15, 13, 6, 5], [33, 13, 6, 5], [17, 26, 6, 4], [31, 26, 6, 4]]
        : kind === 7 ? [[24, 16, 11, 9], [12, 19, 8, 6], [35, 19, 8, 6], [24, 9, 6, 5], [16, 12, 5, 4], [32, 12, 5, 4], [17, 25, 6, 4], [31, 25, 6, 4]]
        : [[24, 18, 12, 10], [11, 20, 9, 7], [36, 20, 9, 7], [24, 9, 8, 7], [14, 13, 7, 5], [34, 13, 7, 5], [16, 26, 7, 5], [32, 26, 7, 5], [24, 27, 6, 4], [19, 11, 5, 4], [29, 11, 5, 4]];
      for (const b of blobs) {
        b[0] += Math.round(R() * 2 - 1); b[1] += Math.round(R() * 2 - 1);
        b[2] = Math.max(4, b[2] + Math.round(R() * 1.5 - 0.5));
        b[3] = Math.max(3, b[3] + Math.round(R() * 1.5 - 0.5));
        // ดันเข้าในไม่ให้รัศมีชนขอบแคนวาส (+ outline)
        b[0] = clamp(b[0], PAD + b[2] + 1, TW - PAD - b[2] - 1);
        b[1] = clamp(b[1], PAD + b[3] + 1, 32);
      }
      const pal = kind === 2 ? ['#1e4e28', '#2a6a36', '#3d8f44', '#58b054', '#7ed06a', '#a8e888']
        : kind === 5 ? ['#3a5018', '#5a7820', '#7a9a2e', '#a0c044', '#c8e06a', '#e0f0a0']
        : kind === 7 ? ['#142818', '#1c3e26', '#2c5a32', '#3f7844', '#5a9858', '#78b070']
        : ['#1e5a24', '#2f7a2c', '#4a9a3a', '#68bc4e', '#8cdc66', '#b8f090'];
      const order = blobs.map((b, i) => [b[1] + b[3], i]).sort((a, b) => b[0] - a[0]).map(p => p[1]);
      for (const i of order) softPuffSafe(x, blobs[i][0], blobs[i][1], blobs[i][2], blobs[i][3], pal, R, PAD);
      const inside = (px, py) => blobs.some(([bx, by, rx, ry]) => {
        const nx = (px - bx) / (rx + 1), ny = (py - by) / (ry + 1); return nx * nx + ny * ny < 0.95;
      });
      for (let i = 0; i < 36; i++) {
        const px = 12 + Math.floor(R() * 24), py = 8 + Math.floor(R() * 16); if (!inside(px, py)) continue;
        r(x, '#d0f8a8', px, py, 2, 1);
      }
      if (kind === 1) for (let i = 0; i < 9; i++) { const px = 12 + Math.floor(R() * 24), py = 10 + Math.floor(R() * 16); if (!inside(px, py)) continue; r(x, '#e8862a', px, py, 2, 2); r(x, '#ffc06a', px, py, 1, 1); }
      if (kind === 4 || kind === 0) for (let i = 0; i < (kind === 4 ? 12 : 5); i++) {
        const px = 12 + Math.floor(R() * 24), py = 9 + Math.floor(R() * 16); if (!inside(px, py)) continue;
        const fc = R() < .5 ? '#ffc9de' : '#ffe37a'; r(x, fc, px, py, 2, 1); r(x, '#fff6e0', px, py, 1, 1);
      }
      if (kind === 5) for (let i = 0; i < 6; i++) { const px = 12 + Math.floor(R() * 24), py = 10 + Math.floor(R() * 14); if (!inside(px, py)) continue; r(x, '#d8e98a', px, py, 3, 1); }
      if (kind === 6) for (let i = 0; i < 8; i++) { const px = 12 + Math.floor(R() * 24), py = 16 + Math.floor(R() * 10); if (!inside(px, py - 2)) continue; const L = 3 + Math.floor(R() * 3); r(x, '#e0a81e', px, py, 2, L); r(x, '#ffe27a', px, py, 1, L - 1); }
      if (kind === 7) for (let i = 0; i < 8; i++) { const px = 14 + Math.floor(R() * 20), py = 8 + Math.floor(R() * 16); if (!inside(px, py)) continue; r(x, '#1a3522', px, py, 1, 1); }
    }, TREE_OUT);
    const g = c.getContext('2d'); g.globalCompositeOperation = 'destination-over'; ell(g, 25, 51, 11, 2, 'rgba(38,40,16,.22)'); g.globalCompositeOperation = 'source-over';
    return c;
  }
  // กอไผ่: ลำเขียวหลายลำ ข้อปล้องเข้ม ใบเรียวที่ปลาย
  function bamboo(seed) {
    const c = mk(36, 42, (x) => {
      const R = rng(seed), n = 5 + Math.floor(R() * 2);
      ell(x, 10, 39, 4, 2, '#3f8a46'); ell(x, 26, 39, 4, 2, '#4f913b');
      for (let i = 0; i < n; i++) {
        const k = i - (n - 1) / 2, top = 4 + Math.floor(R() * 10) + Math.round(Math.abs(k) * 2), lean = k * 0.35;
        for (let y = top; y < 40; y++) { const sx = Math.round(18 + k * 2.2 + lean * (40 - y) / 6); r(x, i % 2 ? '#5f8f30' : '#6fa63a', sx, y, 2, 1); r(x, '#b4e870', sx, y, 1, 1); if ((y - top) % 4 === 3) r(x, '#3f6420', sx, y, 2, 1); }
        const tx = Math.round(18 + k * 2.2 + lean * (40 - top) / 6), dir = k < 0 ? -1 : 1;
        for (let l = 0; l < 4; l++) { const ly = top + 1 + l * 3; for (let q = 0; q < 5; q++) r(x, q < 2 ? '#4f913b' : '#7cc76a', tx + 1 + dir * (q + 1), ly - Math.floor(q / 2), 1, 1); }
        r(x, '#a0e078', tx, top - 1, 2, 1);
      }
    }, TREE_OUT);
    const g = c.getContext('2d'); g.globalCompositeOperation = 'destination-over'; ell(g, 19, 41, 10, 2, 'rgba(38,40,16,.22)'); g.globalCompositeOperation = 'source-over';
    return c;
  }
  // สน: ทรงกรวยซ้อน ขอบหยักเบา ไม่ตัดแบน
  function conifer(seed) {
    const c = mk(36, 44, (x) => {
      const R = rng(seed);
      r(x, '#5a371e', 16, 32, 4, 9); r(x, '#7d4f2a', 17, 32, 2, 9); r(x, '#5a371e', 12, 40, 12, 2);
      ell(x, 11, 41, 3, 2, '#3f8a46'); ell(x, 25, 41, 3, 2, '#4f913b');
      const tiers = 4, h0 = 4 + Math.floor(R() * 2);
      for (let t = 0; t < tiers; t++) {
        const top = h0 + t * 6, hgt = 9, half = 4 + t * 2 + Math.round(R() * 0.8);
        for (let y = 0; y < hgt; y++) {
          let w = Math.round(half * (y + 1) / hgt);
          if (dith(18 + y, top + y) > 0.7) w += (y > hgt / 2 ? 1 : 0);
          const x0 = 18 - w;
          r(x, '#2a6a36', x0, top + y, w * 2 + 1, 1);
          r(x, '#3d8f44', x0, top + y, Math.max(1, w), 1);
          r(x, '#58b054', 18 - Math.max(0, w - 1), top + y, Math.max(1, Math.floor(w / 2)), 1);
          if (y < 2) r(x, '#7ed06a', 17, top + y, 2, 1);
        }
      }
      r(x, '#a8e888', 17, h0, 2, 2);
    }, TREE_OUT);
    const g = c.getContext('2d'); g.globalCompositeOperation = 'destination-over'; ell(g, 19, 43, 10, 2, 'rgba(38,40,16,.22)'); g.globalCompositeOperation = 'source-over';
    return c;
  }
  // มะพร้าว: ลำต้นโค้งมีวงปล้อง ทางใบแผ่รอบยอด ลูกมะพร้าวใต้ยอด
  function palm(seed) {
    const c = mk(40, 44, (x) => {
      const R = rng(seed), lean = R() < .5 ? -1 : 1;
      ell(x, 12, 41, 3, 2, '#3f8a46'); ell(x, 28, 41, 3, 2, '#4f913b');
      for (let y = 12; y < 42; y++) { const off = Math.round(lean * Math.pow((42 - y) / 28, 2) * 4); r(x, '#7d5a2e', 18 + off, y, 4, 1); r(x, '#a8854a', 19 + off, y, 1, 1); if (y % 3 === 0) r(x, '#5e4220', 18 + off, y, 4, 1); }
      const cx = 20 + lean * 3, cy = 11;
      for (const [dx, dy] of [[-13, 3], [-10, -4], [-2, -9], [6, -8], [12, -2], [13, 4], [-8, 7], [8, 7]]) {
        const n = 12; for (let k = 0; k <= n; k++) {
          const t = k / n, px = Math.round(cx + dx * t), py = Math.round(cy + dy * t + Math.sin(t * 3.1) * 2);
          if (px < 2 || py < 2 || px > 37 || py > 40) continue;
          r(x, '#3d8f44', px - 1, py, 3, 2); r(x, '#7ed06a', px, py, 1, 1);
        }
      }
      for (const [dx, dy] of [[-2, 2], [1, 3], [3, 1]]) { disc(x, cx + dx, cy + dy, 1, '#6b4a22'); r(x, '#9c7440', cx + dx - 1, cy + dy - 1, 1, 1); }
    }, TREE_OUT);
    const g = c.getContext('2d'); g.globalCompositeOperation = 'destination-over'; ell(g, 21, 43, 11, 2, 'rgba(38,40,16,.22)'); g.globalCompositeOperation = 'source-over';
    return c;
  }
  const TREES = [tree(3, 0), tree(9, 1), tree(17, 2), tree(25, 0), conifer(31), tree(44, 4), tree(52, 2), tree(60, 0)];
  // สไปรต์ตามชนิดต้นไม้ของเซิร์ฟเวอร์ (Shared.TREE_KINDS) แต่ละชนิดมีหลายแบบ เลือกตามตำแหน่ง ป่าจึงไม่ซ้ำกัน • ไม่มีชนิด (ต้นไม้ขอบแมพ) = แบบสุ่มเดิม
  const KIND_TREES = {
    broad: [tree(3, 0), tree(25, 0), tree(60, 0), tree(17, 2), tree(52, 2), tree(44, 4)],
    pine: [conifer(31), conifer(33), conifer(37)],
    bamboo: [bamboo(5), bamboo(11), bamboo(23)],
    coconut: [palm(7), palm(19)],
    teak: [tree(41, 5), tree(47, 5)],
    gold: [tree(13, 6), tree(29, 6)],
    rose: [tree(71, 7), tree(83, 7)],
  };
  const treeFor = (tx, ty, kind) => {
    const set = kind && KIND_TREES[kind]; if (set) return set[Math.floor(hash(tx, ty, 78) * set.length)];
    const h = hash(tx, ty, 77); return TREES[h < .08 ? 1 : h < .14 ? 5 : Math.floor(hash(tx, ty, 78) * TREES.length)];
  };

  // ---------- buildings ----------
  function win(x, X, Y, w, h, box) {
    r(x, '#5a371e', X - 1, Y - 1, w + 2, h + 2);
    r(x, '#8fc6e0', X, Y, w, h); r(x, '#5d93b5', X, Y + h - 2, w, 2);
    r(x, '#e4f4ff', X + 1, Y + 1, 1, 2); r(x, '#7d4f2a', X + (w >> 1), Y, 1, h);
    if (box) { r(x, '#7d4f2a', X - 1, Y + h + 1, w + 2, 2); for (let i = 0; i < w; i += 2) r(x, i % 4 ? '#4f913b' : box, X + i, Y + h, 1, 1); }
  }
  function door(x, X, Y, w, h, c) {
    r(x, '#4a2e1b', X - 1, Y - 1, w + 2, h + 1);
    r(x, c[1], X, Y, w, h); for (let i = 2; i < w; i += 3) r(x, c[0], X + i, Y, 1, h);
    r(x, c[2], X, Y, w, 1); r(x, '#f2c14e', X + w - 2, Y + (h >> 1), 1, 1);
  }
  const BCACHE = new Map();
  // อาคาร: หลังคายื่น + ชายคาย้อยโค้ง + เงาใต้ชายคา (ลดทรงสี่เหลี่ยมแบน)
  const ROOF_UP = 14, OVER = 3;
  function building(b) {
    if (BCACHE.has(b)) return BCACHE.get(b);
    const bw = (b.x1 - b.x0 + 1) * U, bh = (b.y1 - b.y0 + 1) * U, SW = bw + OVER * 2, SH = bh + ROOF_UP;
    const roof = [shade(b.roof, -.35), b.roof, shade(b.roof, .18), shade(b.roof, .4)];
    const wall = b.kind === 'coop' ? ['#8c2f27', '#b5443a', '#d0604f'] : [shade(b.wall, -.18), b.wall, shade(b.wall, .45)];
    const rh = 16, wx = OVER, wy = rh - 1, ww = bw, wb = SH;
    const s = mk(SW, SH, (x) => {
      // เงาทอดพื้นใต้ตัวบ้าน (drop shadow)
      r(x, 'rgba(30,18,8,.22)', wx + 2, wb - 1, ww, 3);
      r(x, wall[1], wx, wy, ww, wb - wy);
      for (let yy = wy + 3; yy < wb; yy += 3) r(x, wall[0], wx, yy, ww, 1);
      for (let yy = wy, k = 0; yy < wb; yy += 3, k++) for (let xx = wx + (k % 2 ? 5 : 11); xx < wx + ww; xx += 13) r(x, wall[0], xx, yy, 1, 2);
      r(x, wall[2], wx, wy + 1, ww, 1);
      r(x, wall[0], wx + ww - 2, wy, 2, wb - wy);
      r(x, '#8e8373', wx - 1, wb - 3, ww + 2, 3); for (let xx = wx - 1; xx < wx + ww; xx += 6) { r(x, '#b6aa98', xx + 1, wb - 3, 4, 1); r(x, '#6f6458', xx, wb - 3, 1, 3); }
      // หลังคาเกล็ด + ชายคาหยักย้อย (ไม่ตัดสี่เหลี่ยมเป๊ะ)
      r(x, roof[0], 1, 1, SW - 2, rh - 1);
      r(x, roof[0], 0, 2, SW, rh - 3);
      for (let yy = 3, k = 0; yy < rh - 2; yy += 3, k++) {
        r(x, k < 2 ? roof[2] : roof[1], 2, yy, SW - 4, 2);
        for (let xx = (k % 2) * 2 + 2; xx < SW - 2; xx += 4) { r(x, roof[0], xx, yy + 1, 1, 1); r(x, roof[3], xx + 1, yy, 1, 1); }
      }
      r(x, roof[3], 3, 2, SW - 6, 1);
      // ชายคาหยักลอน
      for (let xx = 0; xx < SW; xx++) {
        const dip = (xx % 4 === 0 || xx % 4 === 3) ? 1 : 0;
        r(x, roof[0], xx, rh - 1 + dip, 1, 1 + dip);
        if (dip) r(x, roof[1], xx, rh - 1, 1, 1);
      }
      // เงาใต้ชายคา (เข้มขึ้นให้มีมิติ)
      r(x, 'rgba(40,22,10,.45)', wx - 1, rh + 1, ww + 2, 3);
      r(x, 'rgba(40,22,10,.2)', wx, rh + 4, ww, 2);
      const cx = wx + (ww >> 1), dy = wb - 16;
      const D = [shade(b.roof, -.45), shade(b.roof, -.25), shade(b.roof, .05)];
      const k = b.kind;
      if (k === 'vehicle') { // ประตูม้วนเปิดครึ่ง + ป้ายประแจ
        r(x, '#4a2e1b', wx + 4, dy - 1, 22, 17); r(x, '#2a2420', wx + 5, dy + 6, 20, 10);
        for (let yy = dy; yy < dy + 6; yy += 2) { r(x, '#9aa5ad', wx + 5, yy, 20, 1); r(x, '#c9d3dc', wx + 5, yy, 20, 1); r(x, '#6c7782', wx + 5, yy + 1, 20, 1); }
        disc(x, wx + 14, dy + 12, 2, '#3a3a3a'); r(x, '#9aa5ad', wx + 20, dy + 9, 1, 7);
        win(x, wx + ww - 14, dy + 1, 9, 7, '#7fbcef');
      } else if (k === 'furn' || k === 'cloth') { // หน้าร้านกระจกเห็นของข้างใน
        const X = wx + 3, Y = dy - 1, Wd = 24, Hd = 13;
        r(x, '#4a2e1b', X - 1, Y - 1, Wd + 2, Hd + 2); r(x, '#e9c58f', X, Y, Wd, Hd); r(x, '#d9ae72', X, Y + 9, Wd, 4);
        for (let i = 0; i < Wd; i += 4) r(x, '#dcb87e', X + i, Y, 2, 9);
        if (k === 'furn') {
          r(x, '#8e2a24', X + 3, Y + 5, 9, 7); r(x, '#c8423a', X + 4, Y + 5, 7, 3); r(x, '#e05a4a', X + 4, Y + 5, 3, 1); r(x, '#d9473c', X + 5, Y + 8, 5, 2);
          r(x, '#5a371e', X + 18, Y + 4, 1, 8); r(x, '#f2c14e', X + 15, Y + 1, 7, 4); r(x, '#ffe7a0', X + 16, Y + 1, 3, 1);
        } else {
          r(x, '#5a371e', X + 2, Y + 1, 20, 1);
          [['#3498db', 3], ['#e74c3c', 9], ['#2ecc71', 15]].forEach(([cc, ox]) => { r(x, '#5a371e', X + ox + 2, Y + 1, 1, 2); r(x, cc, X + ox, Y + 3, 5, 5); r(x, cc, X + ox - 1, Y + 3, 1, 3); r(x, cc, X + ox + 5, Y + 3, 1, 3); r(x, shade(cc, .4), X + ox, Y + 3, 2, 1); });
        }
        r(x, 'rgba(255,255,255,.45)', X + 1, Y + 1, 1, 4); r(x, '#5a371e', X + (Wd >> 1), Y, 1, Hd);
        door(x, wx + ww - 13, dy + 1, 8, 15, D);
        if (k === 'cloth') for (let i = 0; i < ww; i += 6) { r(x, '#d6559a', wx + i, wy + 2, 3, 4); r(x, '#f7e1ee', wx + i + 3, wy + 2, 3, 4); r(x, '#d6559a', wx + i + 1, wy + 6, 1, 1); r(x, '#f7e1ee', wx + i + 4, wy + 6, 1, 1); }
      } else if (k === 'coop') { // เล้าไก่ทรงยุ้งฉางสีแดง ประตูกากบาท
        r(x, '#f6efe2', cx - 7, dy - 1, 14, 17); r(x, '#8c2f27', cx - 6, dy, 12, 16);
        for (let i = 0; i < 12; i++) { r(x, '#f6efe2', cx - 6 + i, dy + Math.round(i * 16 / 12), 1, 1); r(x, '#f6efe2', cx + 5 - i, dy + Math.round(i * 16 / 12), 1, 1); }
        r(x, '#2a1b14', wx + 5, wb - 8, 4, 5); r(x, '#e8c25a', wx + 3, wb - 4, 8, 1); // ช่องไก่
        r(x, '#f6efe2', wx, wy, ww, 1); r(x, '#f6efe2', wx, wy, 1, wb - wy); r(x, '#f6efe2', wx + ww - 1, wy, 1, wb - wy);
      } else {
        door(x, cx - 4, dy + 1, 8, 15, ['#6e4524', '#8f5a2e', '#b67d45']);
        const boxC = { food: '#ff6f6f', farm: '#ffd34d', animal: '#ffffff', wood: '#ff9db0', fish: '#9fd4ff' }[k] || '#ff9db0';
        if (k === 'fish') { // ห่วงชูชีพ + ปลาตาก
          disc(x, wx + ww - 9, dy + 5, 4, '#f6efe2'); r(x, '#d9473c', wx + ww - 13, dy + 4, 2, 2); r(x, '#d9473c', wx + ww - 7, dy + 4, 2, 2); r(x, '#d9473c', wx + ww - 10, dy + 1, 2, 2); r(x, '#d9473c', wx + ww - 10, dy + 7, 2, 2); disc(x, wx + ww - 9, dy + 5, 1, wall[1]);
          r(x, '#5a371e', wx + 2, wy + 3, 14, 1);
          for (let i = 0; i < 3; i++) { const fx = wx + 3 + i * 5, cl = i % 2 ? ['#d07a3a', '#f2a865'] : ['#7f97a8', '#c9d8e2']; r(x, cl[0], fx, wy + 4, 3, 5); r(x, cl[1], fx, wy + 4, 1, 4); r(x, cl[0], fx - 1, wy + 9, 5, 1); }
          win(x, wx + 4, dy + 3, 8, 6, boxC);
        } else {
          win(x, wx + 4, dy + 1, 9, 7, boxC); win(x, wx + ww - 13, dy + 1, 9, 7, boxC);
        }
        if (k === 'food') { // กันสาดลายทาง
          for (let i = 0; i < ww; i += 4) { r(x, '#c8423a', wx + i, wy + 1, 2, 5); r(x, '#f6e7c8', wx + i + 2, wy + 1, 2, 5); r(x, '#9e2f29', wx + i, wy + 6, 2, 1); }
          r(x, '#c8423a', cx - 1, wy + 8, 2, 3); r(x, '#ff7a5a', cx - 1, wy + 8, 1, 3);
        }
        if (k === 'wood') { // ขวานบนผนัง + กองไม้ท่อน
          r(x, '#7d4f2a', cx + 6, wy + 3, 1, 7); r(x, '#9aa5ad', cx + 7, wy + 3, 3, 3); r(x, '#c9d3dc', cx + 7, wy + 3, 1, 3);
          for (const [lx, ly] of [[wx + ww - 9, wb - 6], [wx + ww - 5, wb - 6], [wx + ww - 7, wb - 9]]) { disc(x, lx, ly, 2, '#c9984f'); r(x, '#8f5a2e', lx, ly, 1, 1); }
        }
        if (k === 'farm') { // กระสอบเมล็ด
          for (const sx of [wx + ww - 7, wx + 2]) { r(x, '#d9c08a', sx, wb - 8, 5, 5); r(x, '#b8963a', sx + 1, wb - 9, 3, 1); r(x, '#4f913b', sx + 2, wb - 6, 1, 1); }
        }
        if (k === 'animal') { // ถังนม + ฟาง
          r(x, '#9aa5ad', wx + 2, wb - 9, 4, 6); r(x, '#c9d3dc', wx + 2, wb - 9, 1, 6); r(x, '#6c7782', wx + 2, wb - 10, 4, 1);
          r(x, '#d9b44a', wx + ww - 9, wb - 8, 8, 5); r(x, '#e8cd72', wx + ww - 9, wb - 8, 8, 1); r(x, '#c29a32', wx + ww - 6, wb - 8, 1, 5);
        }
      }
    }, { soft: ['#3d2a1a', '#7a5a3a'] }); // ขอบน้ำตาลอุ่น + AA ลดคมดำ
    const out = { spr: s, ox: -(OVER + 1), oy: -(ROOF_UP + 1), w: s.width, h: s.height };
    BCACHE.set(b, out); return out;
  }
  // เคาน์เตอร์ร้าน 1 ช่อง: ตัวไม้ + ผ้าใบสีหลังคา
  const CCACHE = new Map();
  function counter(b) {
    if (CCACHE.has(b.roof)) return CCACHE.get(b.roof);
    const s = mk(16, 13, (x) => {
      r(x, '#7d4f2a', 0, 4, 16, 9); r(x, '#a8703f', 0, 4, 16, 2); r(x, '#c98b4a', 0, 4, 16, 1); r(x, '#5a371e', 0, 12, 16, 1);
      for (let i = 3; i < 16; i += 5) r(x, '#5a371e', i, 7, 1, 5);
      for (let i = 0; i < 16; i += 4) { r(x, b.roof, i, 0, 2, 3); r(x, shade(b.roof, .55), i + 2, 0, 2, 3); }
      r(x, shade(b.roof, -.3), 0, 3, 16, 1);
    });
    CCACHE.set(b.roof, s); return s;
  }
  // ดินแปลงผัก 1 ช่อง (แห้ง/รดน้ำแล้ว) — โทนอุ่นตาม STYLE_GUIDE
  const SOIL = [false, true].map(wet => { const c = cv(U, U), x = c.getContext('2d');
    for (let py = 0; py < U; py++) for (let px = 0; px < U; px++) {
      const iy = py % 5, h = hash(px, py, wet ? 31 : 30);
      let col = iy < 1 ? (wet ? '#45291a' : '#6b4423') : iy < 4 ? (wet ? '#5c3b22' : '#9a6b3c') : (wet ? '#50331d' : '#7a4f2e');
      if (iy >= 1 && iy < 4 && h < .14) col = wet ? '#6b4728' : '#b07a48';
      if (px === 0 || py === 0) col = wet ? '#3c2416' : '#5b3a22';
      if (px === U - 1 || py === U - 1) col = wet ? '#6b4728' : '#a07040';
      r(x, col, px, py, 1, 1);
    }
    if (wet) { r(x, 'rgba(160,200,255,.25)', 3, 6, 3, 1); r(x, 'rgba(160,200,255,.25)', 10, 11, 2, 1); }
    return c; });

  return { mk, r, ell, disc, shade, hash, rng, addOutline, cv, U, OUT, ground, fences, tree: treeFor, building, counter, soil: wet => SOIL[wet ? 1 : 0], ROOF_UP, OVER };
})();
