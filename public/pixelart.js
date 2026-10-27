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
  // hue shift (แนวทางศิลป์ใน STYLE_GUIDE): k<0 = เงา มืดลงและเหลื่อมไปทางน้ำเงิน/ม่วง • k>0 = แสง สว่างขึ้นและเหลื่อมไปทางเหลือง/ส้ม
  function hsl(c) { const [R, G, B] = rgb(c).map(v => v / 255), mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); const h = mx === R ? (G - B) / d + (G < B ? 6 : 0) : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; return [h * 60, s, l]; }
  function fromHsl(h, s, l) { const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return toHex([f(0), f(8), f(4)].map(v => v * 255)); }
  function hue(c, k) {
    let [h, s, l] = hsl(c); const a = Math.abs(k), tgt = k < 0 ? 245 : 45, d = ((tgt - h + 540) % 360) - 180;
    h = (h + Math.sign(d) * Math.min(Math.abs(d), a * 38) + 360) % 360;
    if (k < 0) { l *= 1 + k; s = Math.min(1, s * (1 + a * .12) + a * .03); } else { l += (1 - l) * k; s *= 1 - a * .2; }
    return fromHsl(h, s, l);
  }
  const ramp = (c, d = .3, li = .22) => [hue(c, -d * 1.6), hue(c, -d), c, hue(c, li), hue(c, li * 1.9)]; // [เงาลึก, เงา, หลัก, แสง, ไฮไลต์]
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
  const GRASS = ['#4f9a4a', '#62ae4c', '#76c256', '#8cd062', '#a8de74'].map(rgb); // เงาหญ้าเหลื่อมไปทางเขียวคราม แสงเหลื่อมไปทางเหลือง
  const PATH = ['#c2a06c', '#d2b07a', '#ddbe86'].map(rgb);
  // น้ำใส โทนเทอร์ควอยส์: ลึกกลางสระเข้ม ริมฝั่งอ่อนลง (ไล่ตามระยะจากฝั่ง)
  const WATERC = ['#1a7398', '#2a96b8', '#4ab8cc', '#7ad4e0'].map(rgb);
  const SHALLOW = rgb('#b8efe8'), SANDBED = rgb('#e2cf90'); // ริมฝั่งน้ำตื้นเห็นพื้นทรายใต้น้ำ
  const mixc = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  // พื้นโลก: วาดที่ความละเอียด K เท่าของสไปรต์ (K=2 → 32 px ต่อช่อง = 1 พิกเซลพื้น 1 พิกเซลเกม) ขอบดิน/หญ้า/ทรายเรียบละเอียดขึ้น • ของตกแต่ง (ดอกไม้ กอหญ้า กรวดใหญ่) ยังเป็นก้อนเท่าพิกเซลสไปรต์ให้เข้ากับอาคาร/ต้นไม้
  // สนามสัญญาณสุ่มคำนวณบนกริดพิกเซลศิลป์แล้ว interpolate (เร็วกว่าคำนวณทุกพิกเซลละเอียด)
  function ground(MAP, K = 1) {
    const PA_W = W * U, PA_H = H * U, PW = PA_W * K, PH = PA_H * K, c = cv(PW, PH), x = c.getContext('2d'), img = x.createImageData(PW, PH), a = img.data;
    const TT = new Uint8Array(W * H); for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) TT[ty * W + tx] = gtype(MAP[ty][tx]);
    const tileT = (tx, ty) => (tx < 0 || ty < 0 || tx >= W || ty >= H) ? G : TT[ty * W + tx];
    const field = (sc, seed) => { // สนามสัญญาณบนกริดห่าง st พิกเซลศิลป์ (สเกลใหญ่ใช้กริดห่างขึ้น เร็วขึ้น) แล้วสุ่ม interpolate
      const st = Math.max(1, Math.floor(sc / 4)), gw = Math.ceil(PA_W / st) + 2, gh = Math.ceil(PA_H / st) + 2, f = new Float32Array(gw * gh);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) f[j * gw + i] = vnoise(i * st, j * st, sc, seed); return { f, gw, st };
    };
    const samp = (F, ax, ay) => { ax /= F.st; ay /= F.st; const i = ax | 0, j = ay | 0, tx = ax - i, ty = ay - j, o = j * F.gw + i, f = F.f, g2 = F.gw; return f[o] + (f[o + 1] - f[o]) * tx + (f[o + g2] - f[o]) * ty + (f[o] - f[o + 1] - f[o + g2] + f[o + g2 + 1]) * tx * ty; };
    // ระยะจากฝั่งของน้ำแต่ละช่อง (ไว้ไล่สีน้ำตื้น-ลึก)
    const depth = Array.from({ length: H }, () => new Array(W).fill(0));
    { const q = []; for (let y = 0; y < H; y++) for (let x2 = 0; x2 < W; x2++) if (tileT(x2, y) === WA) depth[y][x2] = 99; else q.push([x2, y]);
      while (q.length) { const [qx, qy] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = qx + dx, ny = qy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; if (depth[ny][nx] > depth[qy][qx] + 1) { depth[ny][nx] = depth[qy][qx] + 1; q.push([nx, ny]); } } } }
    const PVM = new Uint8Array(W * H); for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) PVM[ty * W + tx] = TT[ty * W + tx] === P && isPaved(tx, ty) ? 1 : 0;
    const pv = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && PVM[ty * W + tx] === 1; // ลานปูหิน: ขอบคมตามช่อง ไม่ให้หญ้า/ดินรุกเข้ามา
    const J1 = field(8, 11), J2 = field(8, 12), J3 = field(3, 21), J4 = field(3, 22);
    const types = new Uint8Array(PW * PH);
    // ช่องที่ล้อมรอบด้วยชนิดเดียวกันหมด (ส่วนใหญ่ของแมพ) ไม่ต้องคำนวณขอบ ข้ามไปได้เลย (เร็วขึ้นหลายเท่า)
    const UNI = new Uint8Array(W * H); for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) { let u = 1; const t0 = TT[ty * W + tx]; for (let dy = -1; dy <= 1 && u; dy++) for (let dx = -1; dx <= 1; dx++) if (tileT(tx + dx, ty + dy) !== t0 || (PVM[ty * W + tx] !== (pv(tx + dx, ty + dy) ? 1 : 0))) { u = 0; break; } UNI[ty * W + tx] = u; }
    // ขอบ organic ละมุน: สั่นหลายสเกล ที่ความละเอียดสูงขอบเป็นเส้นโค้งเนียน + dither มุมช่อง
    for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
      const tx0 = Math.floor(px / (K * U)), ty0 = Math.floor(py / (K * U)), t0 = tileT(tx0, ty0); let t = t0;
      if (UNI[ty0 * W + tx0]) { types[py * PW + px] = t; continue; }
      const ax = (px + .5) / K, ay = (py + .5) / K;
      if (BLEND[t0] && !pv(tx0, ty0)) {
        const jx = (samp(J1, ax, ay) - .5) * 11 + (samp(J3, ax, ay) - .5) * 5 + (hash(px, py, 41) - .5) * 1.6;
        const jy = (samp(J2, ax, ay) - .5) * 11 + (samp(J4, ax, ay) - .5) * 5 + (hash(px, py, 42) - .5) * 1.6;
        const tx1 = Math.floor((ax + jx) / U), ty1 = Math.floor((ay + jy) / U), t1 = tileT(tx1, ty1);
        if (BLEND[t1] && !pv(tx1, ty1)) t = t1;
        else if (BLEND[t0]) {
          const lx = Math.floor(ax) & 15, ly = Math.floor(ay) & 15, corner = (lx < 3 || lx > 12) && (ly < 3 || ly > 12);
          if (corner && dith(px, py) > 0.55) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const t2 = tileT(tx0 + dx, ty0 + dy); if (BLEND[t2] && t2 !== t0 && !pv(tx0 + dx, ty0 + dy)) { t = t2; break; } }
        }
      }
      types[py * PW + px] = t;
    }
    const Tp = (px, py) => (px < 0 || py < 0 || px >= PW || py >= PH) ? G : types[py * PW + px]; // พิกัดพิกเซลละเอียด
    const TA = (ax, ay) => Tp(ax * K, ay * K);                                                  // พิกัดพิกเซลศิลป์
    const set = (px, py, col) => { if (px < 0 || py < 0 || px >= PW || py >= PH) return; const i = (py * PW + px) * 4; a[i] = col[0]; a[i + 1] = col[1]; a[i + 2] = col[2]; a[i + 3] = 255; };
    const setA = (ax, ay, col) => { for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) set(ax * K + i, ay * K + j, col); }; // ก้อนเท่าพิกเซลสไปรต์
    const C = {}; const hx = s => C[s] || (C[s] = rgb(s));
    const near = (px, py, n, kind) => Tp(px - n, py) === kind || Tp(px + n, py) === kind || Tp(px, py - n) === kind || Tp(px, py + n) === kind;
    const GV1 = field(56, 1), GV2 = field(14, 2), GV3 = field(5, 7), PV = field(18, 4), SV = field(6, 8), SV2 = field(3, 9);
    for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
      const t = types[py * PW + px], h = hash(px, py, 3), ax = (px + .5) / K, ay = (py + .5) / K, ix = Math.floor(ax), iy = Math.floor(ay), uni = UNI[(iy >> 4) * W + (ix >> 4)] === 1; let col;
      if (t === G) {
        const v = samp(GV1, ax, ay) * .6 + samp(GV2, ax, ay) * .28 + samp(GV3, ax, ay) * .12;
        col = GRASS[clamp(Math.floor(v * 4.4 + dith(px, py) - 1.05), 0, 4)];
        if (h > .992 && v > .55) col = mixc(col, rgb('#fff3b0'), .22); // แดดจุดๆ
        else if (h < .035) col = GRASS[Math.max(0, clamp(Math.floor(v * 4.4 + dith(px, py) - 1.05), 0, 4) - 1)]; // เม็ดเงาเล็กๆ ให้หญ้าไม่เรียบ
        if (!uni && K > 1 && near(px, py, 1, P) && h < .5) col = mixc(col, rgb('#6a8a3e'), .35); // ขอบหญ้าติดถนนเข้มขึ้นเล็กน้อย
      } else if (t === P && pv(ix >> 4, iy >> 4)) { // ปูหินก้อนสี่เหลี่ยมสลับแถว มีรอยต่อ ขอบนอกเข้ม + ลบมุม (bevel) ที่ความละเอียดสูง
        const row = iy >> 3, off = (row & 1) * 4, bx = (ix + off) >> 3, bh = hash(bx, row, 31), lx = Math.floor((ax + off) * K) % (8 * K), ly = Math.floor(ay * K) % (8 * K);
        col = hx(bh < .33 ? '#d2c8b0' : bh < .66 ? '#c9bea4' : '#dbd1ba');
        if (h < .12) col = mixc(col, rgb('#a89d84'), .35); else if (h > .93) col = mixc(col, rgb('#f0e8d4'), .5); // เม็ดหินในก้อน
        if (lx === 0 || ly === 0) col = hx('#a79c80');                                   // ร่องรอยต่อ
        else if (ly === 1 && K > 1) col = hx('#e8e0cc'); else if (ly <= K && K === 1) col = hx('#e8e0cc'); // ขอบบนรับแสง
        else if (lx === 1 && K > 1) col = hx('#e0d7c2');                                 // ขอบซ้ายรับแสง
        else if (ly === 8 * K - 1 || (lx === 8 * K - 1)) col = hx('#b8ad92');             // ขอบล่าง/ขวาเงา
        const pt = (tx, ty) => pv(tx, ty), tx2 = ix >> 4, ty2 = iy >> 4;
        if (!pt(Math.floor((px - 1) / K / 16), ty2) && ((px % (16 * K)) === 0) || !pt(Math.floor((px + 1) / K / 16), ty2) && ((px % (16 * K)) === 16 * K - 1) || !pt(tx2, Math.floor((py - 1) / K / 16)) && ((py % (16 * K)) === 0) || !pt(tx2, Math.floor((py + 1) / K / 16)) && ((py % (16 * K)) === 16 * K - 1)) col = hx('#7d7258'); // ขอบลาน
      } else if (t === P) {
        const dv = samp(PV, ax, ay);
        col = PATH[clamp(Math.floor(dv * 3 + dith(px, py) * .6 - .3), 0, 2)];
        if (h < .04) col = hx('#e8c896'); else if (h > .97) col = hx('#a77a4a'); else if (h > .86 && h < .88) col = hx('#b88958'); // จุดดิน/กรวดเล็ก
        if (K > 1 && samp(SV2, ax, ay) > .74 && dith(px >> 1, py >> 1) > .5) col = mixc(col, rgb('#b08a58'), .35); // ร่องล้อ/รอยเท้าจางๆ
        const nearG = !uni && (near(px, py, 2 * K, G) || Tp(px - 3 * K, py - 2 * K) === G || Tp(px + 3 * K, py + 2 * K) === G);
        if (nearG) { // ขอบทาง: ผสมหญ้ารุกเข้ามา + โทนดินอุ่น (ลบเส้นตัดตรง)
          if (h < .22) col = GRASS[clamp(2 + (h < .1 ? 1 : 0), 0, 4)];
          else col = hx(h < .5 ? '#b4844f' : '#c09458');
        }
        if (!uni && K > 1 && (Tp(px - 1, py - 1) === G && Tp(px + 1, py + 1) !== G)) col = hx('#9a6f40'); // เงาริมถนนด้านซ้ายบน (หญ้ายกสูงกว่า)
      } else if (t === SA) {
        const sv = samp(SV, ax, ay) + dith(px, py) * .3 + (K > 1 ? Math.sin(ay * 1.7 + samp(SV2, ax, ay) * 6) * .06 : 0); // ริ้วทรายเบาๆ
        col = hx(sv > .78 ? '#d6b97c' : sv > .4 ? '#e2c890' : '#efdfa4');
        if (uni) { /* ทรายกลางหาด */ } else if (near(px, py, K + 1, WA)) col = hx('#c5a46a');                                                  // ทรายเปียกริมน้ำ
        else if (!uni && K > 1 && near(px, py, 2 * K + 1, WA) && h < .4) col = hx('#d2b87c');
        if (h < .05) col = hx('#f5e4b8'); else if (h > .97) col = hx('#c9a869');
      } else if (t === WA) {
        const tx = ax / U - .5, ty = ay / U - .5, ix2 = clamp(Math.floor(tx), 0, W - 1), iy2 = clamp(Math.floor(ty), 0, H - 1);
        const fx = tx - ix2, fy = ty - iy2, dv = (k, l) => Math.min(4, depth[clamp(iy2 + l, 0, H - 1)][clamp(ix2 + k, 0, W - 1)]);
        const d = (dv(0, 0) * (1 - fx) + dv(1, 0) * fx) * (1 - fy) + (dv(0, 1) * (1 - fx) + dv(1, 1) * fx) * fy;
        col = WATERC[3 - clamp(Math.floor(d * .9 + dith(px, py) * .8 - .4), 0, 3)];
        const sh = clamp((2.6 - d) / 1.5, 0, 1); // ใกล้ฝั่งน้ำใสขึ้น เห็นทรายข้างล่าง
        col = mixc(mixc(col, SHALLOW, sh * .5), SANDBED, sh * sh * .22);
        if (K > 1) { const cs = samp(SV, ax * .6, ay * 1.5) + samp(SV2, ax + 3, ay * 1.3) * .5; if (cs > 1.12 && d > 1) col = mixc(col, rgb('#aee8f0'), .22); } // ลายแสงใต้น้ำ (caustics) จางๆ
        if (uni) { /* น้ำกลางสระ ไม่มีฟอง */ } else if (Tp(px, py - 1) !== WA || Tp(px - 1, py) !== WA) col = hx('#eafdfd'); // ฟองริมตลิ่ง
        else if (K > 1 && (Tp(px, py - 2) !== WA || Tp(px - 2, py) !== WA) && h < .6) col = hx('#c8f4f6');
      } else { // พื้นไม้ของที่ดิน
        const pid = Math.floor(iy / 5), ix3 = (ix + pid * 11) % 26, iy3 = iy % 5;
        col = hx(hash(pid, Math.floor((ix + pid * 11) / 26), 5) < .5 ? '#b67d45' : '#c08a50');
        if (iy3 === 0) col = hx('#d29a5e');
        if (iy3 === 4 || ix3 === 0) col = hx('#7a4d28');
        if (ix3 === 2 && iy3 === 2) col = hx('#5a3a20');
      }
      set(px, py, col);
    }
    const AW = PA_W, AH = PA_H;
    // รายละเอียดริมสระ: กรวดและกอต้นกกเล็กๆ บนทรายที่ติดน้ำ
    for (let ay = 2; ay < AH - 3; ay++) for (let ax = 2; ax < AW - 2; ax++) {
      if (TA(ax, ay) !== SA) continue;
      if (!(TA(ax, ay - 2) === WA || TA(ax, ay + 2) === WA || TA(ax - 2, ay) === WA || TA(ax + 2, ay) === WA)) continue;
      const r = hash(ax, ay, 21);
      if (r < .018) { setA(ax, ay, hx('#4f8a3a')); setA(ax, ay - 1, hx('#6fa84f')); setA(ax, ay - 2, hx('#8cc463')); setA(ax - 1, ay - 1, hx('#4f8a3a')); }
      else if (r < .045) { setA(ax, ay, hx('#8f9aa1')); setA(ax + 1, ay, hx('#8f9aa1')); setA(ax, ay - 1, hx('#c4ccd0')); }
    }
    // ใบหญ้า กอหญ้า ดอกไม้ป่า กรวด — หนาขึ้นทั้งแมพให้โซนโล่งใกล้ลานกลาง
    for (let ay = 1; ay < AH - 1; ay++) for (let ax = 0; ax < AW; ax++) if (TA(ax, ay) === G && hash(ax, ay, 13) < .045) { setA(ax, ay, GRASS[4]); setA(ax, ay + 1, GRASS[0]); }
    const R = rng(42), area = W * H;
    for (let i = 0; i < area * .78; i++) {
      const ax = Math.floor(R() * AW), ay = Math.floor(R() * AH);
      if (TA(ax, ay) !== G || TA(ax - 3, ay) !== G || TA(ax + 3, ay) !== G) continue;
      const dk = GRASS[0], lt = GRASS[3];
      setA(ax, ay, dk); setA(ax, ay - 1, lt); setA(ax, ay - 2, lt); setA(ax - 1, ay, dk); setA(ax - 2, ay - 1, lt); setA(ax + 1, ay, dk); setA(ax + 2, ay - 1, lt);
    }
    // ดอกจุดเล็ก: เหลือง/ชมพู/ฟ้าเป็นหลัก (ตามภาพอ้างอิง) + ขาวอ่อน
    const FLC = ['#ffe37a', '#ffc9de', '#9fd4ff', '#fff6e0', '#ff9db0', '#c9b6ff'].map(rgb);
    for (let i = 0; i < area * .42; i++) {
      const ax = 2 + Math.floor(R() * (AW - 4)), ay = 2 + Math.floor(R() * (AH - 4));
      let ok = true; for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (TA(ax + dx, ay + dy) !== G) { ok = false; break; }
      if (!ok) continue;
      const pc = FLC[Math.floor(R() * FLC.length)], cc = hx(R() < .55 ? '#ffcf3d' : '#e8743f');
      setA(ax, ay + 2, GRASS[0]); setA(ax - 1, ay, pc); setA(ax + 1, ay, pc); setA(ax, ay - 1, pc); setA(ax, ay + 1, pc); setA(ax, ay, cc);
      if (R() < .45) { setA(ax + 3, ay + 1, pc); setA(ax + 3, ay + 2, GRASS[0]); }
    }
    // กรวดบนทางดิน (ระดับพิกเซลละเอียด ให้ดูเม็ดเล็กละเอียด) + จุดเปียกบางๆ ให้ทางไม่เรียบทึบ
    for (let i = 0; i < area * .16 * K * K; i++) {
      const px = Math.floor(R() * PW), py = Math.floor(R() * PH);
      if (Tp(px, py) !== P || Tp(px + 1, py + 1) !== P || pv(Math.floor(px / K / U), Math.floor(py / K / U))) continue;
      set(px, py, hx('#e2d4b8')); set(px + 1, py, hx('#a89070')); set(px, py + 1, hx('#a89070')); set(px + 1, py + 1, hx('#6e5f52'));
    }
    for (let i = 0; i < area * .06; i++) {
      const ax = Math.floor(R() * AW), ay = Math.floor(R() * AH);
      if (TA(ax, ay) !== SA) continue;
      setA(ax, ay, hx('#f0dcab')); if (TA(ax + 1, ay) === SA) setA(ax + 1, ay, hx('#c9a869'));
    }
    // transition ขอบดิน↔หญ้า: ดอก/กรวด/กอหญ้าแซมตามรอยต่อ ลบเส้นสี่เหลี่ยม
    for (let ay = 2; ay < AH - 2; ay++) for (let ax = 2; ax < AW - 2; ax++) {
      const t = TA(ax, ay); if (t !== G && t !== P) continue;
      if (pv(ax >> 4, ay >> 4)) continue;
      const og = t === G, o = og ? P : G, cross = TA(ax - 1, ay) === o || TA(ax + 1, ay) === o || TA(ax, ay - 1) === o || TA(ax, ay + 1) === o;
      if (!cross) continue;
      const u = hash(ax, ay, 44);
      if (u < .08) setA(ax, ay, hx(u < .04 ? '#8f9aa1' : '#c4ccd0')); // กรวด
      else if (u < .16) { setA(ax, ay, FLC[Math.floor(hash(ax, ay, 45) * FLC.length)]); setA(ax, ay + 1, GRASS[0]); } // ดอกขอบทาง
      else if (u < .28 && og) { setA(ax, ay, GRASS[0]); setA(ax, ay - 1, GRASS[3]); } // กอหญ้า
      else if (u < .22 && !og) setA(ax, ay, GRASS[2]); // หญ้ารุกบนดิน
    }
    x.putImageData(img, 0, 0);
    x.save(); x.scale(K, K); x.imageSmoothingEnabled = false;
    shoreProps(x, tileT, W, H, hash);
    // กรอบที่ดิน (ช่องขอบของแต่ละแปลง) แบบเดิม
    for (let y = 0; y < H; y++) for (let x2 = 0; x2 < W; x2++) {
      if (gtype(MAP[y][x2]) !== FL) continue;
      const pi = plotAt(x2, y); if (pi < 0) continue;
      const px = x2 * U, py = y * U, x0 = HOUSING.plots[pi];
      x.fillStyle = '#6e4524';
      if (y === HOUSING.y0) x.fillRect(px, py, U, 2); if (y === HOUSING.y1) x.fillRect(px, py + U - 2, U, 2);
      if (x2 === x0) x.fillRect(px, py, 2, U); if (x2 === x0 + HOUSING.w - 1) x.fillRect(px + U - 2, py, 2, U);
    }
    x.restore();
    return c;
  }

  // ---------- fences (วาดลงพื้น ต่อกันตามช่องข้างเคียง) — ไม้โทนอุ่นตาม STYLE_GUIDE ----------
  function fences(x, MAP) {
    const isF = (tx, ty) => MAP[ty] && MAP[ty][tx] === T.FENCE;
    const W0 = '#835437', W1 = '#a0692f', W2 = '#d6a05a', W3 = '#5a3a34'; // ไม้ hue shift: เงาอมม่วง แสงอมเหลือง
    for (let y = 0; y < H; y++) for (let x2 = 0; x2 < W; x2++) {
      if (!isF(x2, y)) continue;
      const px = x2 * U, py = y * U, L = isF(x2 - 1, y), Rr = isF(x2 + 1, y), Up = isF(x2, y - 1), Dn = isF(x2, y + 1);
      x.fillStyle = 'rgba(24,34,52,.24)'; x.fillRect(px + 3, py + 13, 12, 2);
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
      r(x, bark[0], cx0 - 3, 26, 6, 22); r(x, bark[1], cx0 - 2, 26, 3, 22); r(x, bark[2], cx0 - 2, 36, 1, 8); // ลำต้นยื่นขึ้นไปซ่อนใต้พุ่ม ไม่ให้พุ่มลอยห่างจากต้น
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
      // พาเลตพุ่มแบบ hue shift: โทนเงาเหลื่อมไปทางเขียวคราม/น้ำเงิน โทนแสงเหลื่อมไปทางเหลือง (แสงซ้ายบน)
      const pal = kind === 2 ? ['#163a36', '#1f5540', '#2e7a46', '#4c9e4a', '#7cc458', '#b4e27a']
        : kind === 5 ? ['#2a4228', '#46662a', '#6a8c2e', '#98b63c', '#c8dc60', '#ecf0a0']
        : kind === 7 ? ['#121f30', '#173634', '#25543c', '#3a7446', '#5a9454', '#86b46a']
        : ['#18463e', '#1f6644', '#348a42', '#5aae48', '#8ad25e', '#c4ec84'];
      const order = blobs.map((b, i) => [b[1] + b[3], i]).sort((a, b) => b[0] - a[0]).map(p => p[1]);
      for (const i of order) softPuffSafe(x, blobs[i][0], blobs[i][1], blobs[i][2], blobs[i][3], pal, R, PAD);
      r(x, 'rgba(26,28,44,.42)', cx0 - 3, 33, 6, 3); r(x, 'rgba(26,28,44,.2)', cx0 - 3, 36, 6, 2); // เงาพุ่มตกบนลำต้น (โปร่งแสง)
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
    const g = c.getContext('2d'); g.globalCompositeOperation = 'destination-over'; ell(g, 27, 51, 13, 2, 'rgba(24,34,52,.3)'); ell(g, 27, 51, 9, 1, 'rgba(24,34,52,.18)'); g.globalCompositeOperation = 'source-over'; // เงาทอดเยื้องขวา (แสงซ้ายบน) อมน้ำเงิน
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
    const g = c.getContext('2d'); g.globalCompositeOperation = 'destination-over'; ell(g, 21, 41, 11, 2, 'rgba(24,34,52,.28)'); g.globalCompositeOperation = 'source-over';
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
          r(x, y === hgt - 1 ? '#173a36' : '#1f5540', x0, top + y, w * 2 + 1, 1); // ด้านเงาขวา + ขอบล่างชั้นอมคราม
          r(x, '#2e7a46', x0, top + y, Math.max(1, w), 1);
          r(x, '#58a84c', 18 - Math.max(0, w - 1), top + y, Math.max(1, Math.floor(w / 2)), 1);
          if (y < 2) r(x, '#9ad468', 17, top + y, 2, 1);
        }
      }
      r(x, '#cdee8a', 17, h0, 2, 2);
    }, TREE_OUT);
    const g = c.getContext('2d'); g.globalCompositeOperation = 'destination-over'; ell(g, 21, 43, 11, 2, 'rgba(24,34,52,.28)'); g.globalCompositeOperation = 'source-over';
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
    const g = c.getContext('2d'); g.globalCompositeOperation = 'destination-over'; ell(g, 23, 43, 12, 2, 'rgba(24,34,52,.28)'); g.globalCompositeOperation = 'source-over';
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
  // หน้าต่าง: กรอบไม้ กระจกไล่แสงบนลงล่าง ประกายสะท้อนเฉียง ซี่กากบาท ขอบหน้าต่าง (+ กระบะดอกไม้ถ้ามี box)
  function win(x, X, Y, w, h, box) {
    r(x, '#3a2418', X - 1, Y - 1, w + 2, h + 2); r(x, '#8f5a2e', X - 1, Y - 1, w + 2, 1);
    r(x, '#4f7fa8', X, Y, w, h); r(x, '#7fb6da', X, Y + 1, w, h - 2); r(x, '#a8dcf2', X, Y + 1, w, 2); r(x, '#355f86', X, Y, w, 1); // เงาใต้กรอบบน
    r(x, '#eaf8ff', X + 1, Y + 2, 1, 2); r(x, '#eaf8ff', X + 2, Y + 1, 1, 1); r(x, '#d6f0fb', X + w - 3, Y + h - 3, 1, 1);
    r(x, '#5a371e', X + (w >> 1), Y, 1, h); r(x, '#5a371e', X, Y + (h >> 1), w, 1);
    r(x, '#c98b4a', X - 2, Y + h + 1, w + 4, 1); r(x, '#6e4524', X - 2, Y + h + 2, w + 4, 1);
    if (box) { r(x, '#7d4f2a', X - 1, Y + h + 2, w + 2, 2); r(x, '#5a371e', X - 1, Y + h + 3, w + 2, 1); for (let i = 0; i < w; i += 2) { r(x, i % 4 ? '#3f8a46' : box, X + i, Y + h, 1, 2); r(x, i % 4 ? '#6cbf55' : '#fff3d6', X + i, Y + h, 1, 1); } }
  }
  // ประตูไม้: c = [เงา, หลัก, แสง] ไม้แผ่นตั้ง ขอบซ้ายรับแสง ขวาเงา ลูกบิดทองมีประกาย
  function door(x, X, Y, w, h, c) {
    r(x, '#2e1c12', X - 1, Y - 1, w + 2, h + 1);
    r(x, c[1], X, Y, w, h); for (let i = 2; i < w - 1; i += 3) r(x, c[0], X + i, Y + 1, 1, h - 1);
    r(x, c[2], X, Y, w, 1); r(x, c[2], X, Y, 1, h); r(x, c[0], X + w - 1, Y, 1, h);
    r(x, '#c9962a', X + w - 3, Y + (h >> 1), 2, 2); r(x, '#ffe9a0', X + w - 3, Y + (h >> 1), 1, 1);
  }
  // กระถางต้นไม้ข้างประตู (ดินเผา + พุ่ม + ดอก)
  function pot(x, X, Y, fl) {
    r(x, '#7a3a20', X, Y + 4, 5, 4); r(x, '#b8653a', X, Y + 4, 4, 3); r(x, '#e08a5a', X, Y + 4, 4, 1);
    r(x, '#2f6b3a', X - 1, Y + 1, 7, 3); r(x, '#4f913b', X - 1, Y, 6, 3); r(x, '#7cc76a', X, Y, 3, 1);
    r(x, fl, X + 1, Y - 1, 1, 1); r(x, fl, X + 4, Y + 1, 1, 1); r(x, '#fff3d6', X + 1, Y, 1, 1);
  }
  const BCACHE = new Map();
  // อาคาร (มุม top-down 3/4): ชั้นวาด เงาทอด → ผนังไม้ตีเกล็ด → ฐานหิน → หลังคากระเบื้องไล่แสง → ชายคา+เงาชายคา → หน้าต่าง/ประตู → รายละเอียดร้าน → ขอบ
  // สีทั้งหมดไล่แบบ hue shift (เงาอมม่วง/น้ำเงิน แสงอมเหลือง) แสงจากซ้ายบน
  const ROOF_UP = 14, OVER = 3;
  function building(b) {
    if (BCACHE.has(b)) return BCACHE.get(b);
    const bw = (b.x1 - b.x0 + 1) * U, bh = (b.y1 - b.y0 + 1) * U, SW = bw + OVER * 2, SH = bh + ROOF_UP;
    const RF = ramp(b.roof, .3, .2), WL = b.kind === 'coop' ? ramp('#b5443a', .25, .2) : ramp(b.wall, .14, .3), ST = ramp('#a39886', .28, .22);
    const roof = [RF[1], RF[2], RF[3], RF[4]], wall = [WL[1], WL[2], WL[4]];
    const rh = 16, wx = OVER, wy = rh - 1, ww = bw, wb = SH;
    const s = mk(SW, SH, (x) => {
      // ผนังไม้ตีเกล็ด: แต่ละแผ่นขอบบนรับแสง ขอบล่างเงา • เสามุมซ้ายสว่าง ขวาเงา
      r(x, WL[2], wx, wy, ww, wb - wy);
      for (let yy = wy + 2; yy < wb - 4; yy += 4) { r(x, WL[3], wx, yy, ww, 1); r(x, WL[1], wx, yy + 3, ww, 1); }
      r(x, WL[3], wx, wy, 2, wb - wy); r(x, WL[4], wx, wy, 1, wb - wy); r(x, WL[1], wx + ww - 3, wy, 3, wb - wy); r(x, WL[0], wx + ww - 1, wy, 1, wb - wy);
      // ฐานหิน + เงาซอกระหว่างผนังกับฐาน (AO)
      r(x, ST[1], wx - 1, wb - 3, ww + 2, 3);
      for (let xx = wx - 1, k = 0; xx < wx + ww + 1; xx += 5, k++) { r(x, k % 2 ? ST[2] : ST[3], xx + 1, wb - 3, 4, 2); r(x, ST[4], xx + 1, wb - 3, 2, 1); r(x, ST[0], xx, wb - 3, 1, 3); }
      r(x, 'rgba(40,24,48,.35)', wx, wb - 4, ww, 1);
      // หลังคากระเบื้อง: สันหลังคาสว่างสุด ไล่เข้มลงหาชายคา • แต่ละแถวมีเงาใต้แถว รอยต่อกระเบื้องสลับ และปลายด้านขวาเข้ม (แสงซ้ายบน)
      r(x, RF[0], 1, 1, SW - 2, rh - 1); r(x, RF[0], 0, 2, SW, rh - 3);
      r(x, RF[1], 1, 0, SW - 2, 2); r(x, RF[4], 2, 0, SW - 5, 1);
      const tones = [3, 3, 2, 2, 1]; // ดัชนีสีของแต่ละแถว ไล่จากสันลงชายคา
      for (let yy = 2, k = 0; yy < rh - 3; yy += 3, k++) {
        const t = tones[Math.min(k, 4)];
        r(x, RF[t], 1, yy, SW - 2, 3); // แผ่นกระเบื้องเกล็ดซ้อน: ขอบล่างแต่ละแผ่นมนเป็นลอน (มุมเข้ม กลางสว่าง) รอยต่อสั้นแค่แถวบน
        const px1 = (c, X, Y, w) => { const a0 = Math.max(1, X), a1 = Math.min(SW - 1, X + w); if (a1 > a0) r(x, c, a0, Y, a1 - a0, 1); };
        for (let xx = (k % 2) * 3 - 2; xx < SW - 1; xx += 6) {
          px1(RF[t - 1], xx, yy, 1); px1(RF[Math.min(4, t + 1)], xx + 1, yy, 2);
          px1(RF[t - 1], xx - 1, yy + 2, 2); px1(RF[t - 1], xx + 5, yy + 2, 2);
        }
      }
      r(x, RF[3], 1, 2, 1, rh - 5); r(x, RF[1], SW - 3, 2, 1, rh - 5); r(x, RF[0], SW - 2, 2, 1, rh - 4);
      // ชายคา: ไม้ปิดชายคา + ลอนย้อย
      r(x, RF[0], 0, rh - 3, SW, 2); r(x, RF[1], 1, rh - 3, SW - 2, 1);
      for (let xx = 0; xx < SW; xx++) { const dip = (xx % 4 === 0 || xx % 4 === 3) ? 1 : 0; r(x, RF[0], xx, rh - 1 + dip, 1, 1 + dip); if (dip) r(x, RF[1], xx, rh - 1, 1, 1); }
      // เงาชายคาตกบนผนัง (rgba(42,27,20,.35) ตามแนวทาง + ซอกลึกอมม่วง)
      r(x, 'rgba(42,27,20,.35)', wx, rh + 1, ww, 2); r(x, 'rgba(42,27,20,.16)', wx, rh + 3, ww, 1);
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
        r(x, ST[3], cx - 6, wb - 2, 12, 2); r(x, ST[4], cx - 5, wb - 2, 10, 1); // ขั้นบันไดหินหน้าประตู
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
      const WD = ramp('#8f5a2e', .3, .25), RF = ramp(b.roof, .3, .25);
      r(x, WD[2], 0, 4, 16, 9); r(x, WD[3], 0, 4, 16, 2); r(x, WD[4], 0, 4, 16, 1); r(x, WD[0], 0, 12, 16, 1); r(x, WD[1], 13, 6, 3, 6);
      for (let i = 3; i < 16; i += 5) { r(x, WD[1], i, 7, 1, 5); r(x, WD[3], i + 1, 7, 1, 1); }
      for (let i = 0; i < 16; i += 4) { r(x, RF[2], i, 0, 2, 3); r(x, '#fff3dc', i + 2, 0, 2, 3); r(x, RF[3], i, 0, 1, 1); }
      r(x, RF[0], 0, 3, 16, 1); r(x, 'rgba(42,27,20,.3)', 0, 4, 16, 1);
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

  // บ้านหลังใหญ่ในเมือง (HOUSE_BLD = 7×4 ช่อง): พิกเซลแบบร้าน · หลังคาจั่ว · ประตูตรงกลาง (ช่องประตูเมือง)
  let BIG_HOUSE = null;
  function bigHouse() {
    if (BIG_HOUSE) return BIG_HOUSE;
    const tw = 7 * U, th = 4 * U, OVERH = 8, ROOFH = 24; // 112×64 + ยื่นหลังคา (ขนาด/จุดยึดเดิม ป้ายชื่อใน game.js วางตรงเดิม)
    const SW = tw + OVERH * 2, SH = th + ROOFH;
    const RF = ramp('#b8382a', .3, .2), WL = ramp('#f0e0bc', .14, .3), ST = ramp('#a39886', .28, .22), WD = ramp('#8f5a2e', .3, .25), SHU = ramp('#4f8a5a', .3, .25);
    const s = mk(SW, SH, (x) => {
      const wx = OVERH, ww = tw, wb = SH, cx = wx + (ww >> 1), eave = 38;
      // ผนังไม้ตีเกล็ด
      r(x, WL[2], wx, eave, ww, wb - eave);
      for (let yy = eave + 2; yy < wb - 4; yy += 4) { r(x, WL[3], wx, yy, ww, 1); r(x, WL[1], wx, yy + 3, ww, 1); }
      r(x, WL[3], wx, eave, 3, wb - eave); r(x, WL[4], wx, eave, 1, wb - eave); r(x, WL[1], wx + ww - 4, eave, 4, wb - eave); r(x, WL[0], wx + ww - 1, eave, 1, wb - eave);
      // ฐานหิน + เงาซอก
      r(x, ST[1], wx - 1, wb - 4, ww + 2, 4);
      for (let xx = wx - 1, k = 0; xx < wx + ww + 1; xx += 6, k++) { r(x, k % 2 ? ST[2] : ST[3], xx + 1, wb - 4, 5, 3); r(x, ST[4], xx + 1, wb - 4, 3, 1); r(x, ST[0], xx, wb - 4, 1, 4); }
      r(x, 'rgba(40,24,48,.35)', wx, wb - 5, ww, 1);
      // หลังคาปั้นหยา: ระนาบหน้า (เกล็ดซ้อนไล่แสงจากสันลงชายคา) + ปีกซ้ายรับแสง + ปีกขวาเงา
      const top = 3, rl = 34, L = 3, Rr = SW - 3;
      const shingle = (xa, xb, y, tone) => { // แถบกระเบื้องเกล็ดซ้อน 1 แถวพิกเซล (แถวละ 4 px: บนมีรอยต่อ+แสง ล่างเป็นลอนเงา)
        if (xb <= xa) return; tone = clamp(tone, 1, 3); const course = Math.floor((y - top) / 4), ly = (y - top) % 4, ph = (course % 2) * 3;
        r(x, ly === 3 ? RF[tone - 1] : RF[tone], xa, y, xb - xa, 1);
        for (let xx = xa - ((xa - ph) % 6 + 6) % 6; xx < xb; xx += 6) {
          const px = (c, X, w) => { const a0 = Math.max(xa, X), a1 = Math.min(xb, X + w); if (a1 > a0) r(x, c, a0, y, a1 - a0, 1); };
          if (ly === 0) { px(RF[tone - 1], xx, 1); px(RF[Math.min(4, tone + 1)], xx + 1, 2); } else if (ly === 2) px(RF[tone - 1], xx - 1, 2);
        }
      };
      for (let y = top; y < eave; y++) {
        const t = (y - top) / (eave - top), hl = Math.round(rl - (rl - L) * t), hr = Math.round(SW - rl + (rl - L) * t), x0 = Math.round(L + (1 - t) * 8), x1 = Math.round(Rr - (1 - t) * 8);
        const tone = 3 - Math.floor(t * 2.2);
        shingle(x0, hl, y, tone + 1); shingle(hl, hr, y, tone); shingle(hr, x1, y, tone - 1); // ปีกซ้ายรับแสง • ระนาบหน้า • ปีกขวาเงา
        r(x, RF[0], hl, y, 1, 1); r(x, RF[0], hr - 1, y, 1, 1); // สันมุมปีก
        if (y > top + 1) { r(x, RF[4], x0, y, 1, 1); r(x, RF[0], x1 - 1, y, 1, 1); }
      }
      r(x, RF[0], rl - 1, top - 1, SW - rl * 2 + 2, 1); r(x, RF[4], rl, top, SW - rl * 2, 1); // สันหลังคา
      // จั่วเล็กกลางหลังคาเหนือประตู
      for (let y = 16; y < eave; y++) { const hw = Math.round((y - 16) * 1.25) + 2; r(x, RF[0], cx - hw - 1, y, hw * 2 + 2, 1); shingle(cx - hw, cx, y, 3); shingle(cx, cx + hw, y, 1); r(x, RF[4], cx - 1, y, 1, 1); }
      r(x, WL[2], cx - 12, 28, 24, eave - 28); for (let yy = 30; yy < eave; yy += 3) r(x, WL[1], cx - 12, yy, 24, 1); disc(x, cx, 31, 3, '#3a2418'); disc(x, cx, 31, 2, '#a8dcf2'); r(x, '#eaf8ff', cx - 1, 30, 1, 1); // หน้าจั่ว + ช่องแสงกลม
      // ปล่องไฟอิฐบนปีกขวา
      const chx = SW - 30; r(x, '#5a2e22', chx, 4, 10, 16); for (let yy = 6; yy < 20; yy += 3) { r(x, '#8e4a36', chx + 1, yy, 8, 2); r(x, '#a85a42', chx + 1, yy, 3, 1); } r(x, '#3d2a24', chx - 1, 2, 12, 3); r(x, '#7d7a84', chx - 1, 2, 12, 1);
      // ชายคา + ลอนย้อย + เงาชายคาบนผนัง
      r(x, RF[0], 1, eave - 1, SW - 2, 3); r(x, RF[1], 2, eave - 1, SW - 4, 1);
      for (let xx = 1; xx < SW - 1; xx++) { const dip = (xx % 4 === 0 || xx % 4 === 3) ? 1 : 0; r(x, RF[0], xx, eave + 2 + dip, 1, 1); }
      r(x, 'rgba(42,27,20,.35)', wx, eave + 2, ww, 3); r(x, 'rgba(42,27,20,.16)', wx, eave + 5, ww, 1);
      // หน้าต่างบานใหญ่ + บานเกล็ดเขียว + กระบะดอกไม้
      for (const ox of [wx + 10, wx + ww - 26]) {
        r(x, SHU[1], ox - 5, 51, 4, 16); r(x, SHU[2], ox - 5, 51, 3, 16); for (let yy = 53; yy < 66; yy += 3) r(x, SHU[0], ox - 5, yy, 4, 1);
        r(x, SHU[1], ox + 17, 51, 4, 16); r(x, SHU[3], ox + 17, 51, 1, 16); for (let yy = 53; yy < 66; yy += 3) r(x, SHU[0], ox + 17, yy, 4, 1);
        win(x, ox, 52, 16, 12, '#ff8fc7');
      }
      // ชายคาประตู + ตะเกียงสองข้าง + ประตูบานคู่
      r(x, WD[0], cx - 13, 57, 26, 3); r(x, WD[3], cx - 12, 57, 24, 1); r(x, 'rgba(42,27,20,.3)', cx - 11, 60, 22, 2);
      for (const lx of [cx - 13, cx + 11]) { r(x, '#3a2418', lx, 63, 3, 5); r(x, '#ffd36a', lx, 64, 2, 3); r(x, '#fff3b0', lx, 64, 1, 1); }
      door(x, cx - 8, 62, 8, wb - 66, [WD[1], WD[2], WD[3]]); door(x, cx, 62, 8, wb - 66, [WD[1], WD[2], WD[3]]); r(x, '#2e1c12', cx - 1, 62, 1, wb - 66);
      // กระถางข้างประตู + ขั้นบันไดหิน
      pot(x, cx - 22, wb - 12, '#ff8fc7'); pot(x, cx + 17, wb - 12, '#ffe37a');
      r(x, ST[3], cx - 12, wb - 4, 24, 2); r(x, ST[4], cx - 11, wb - 4, 22, 1); r(x, ST[2], cx - 14, wb - 2, 28, 2); r(x, ST[4], cx - 13, wb - 2, 26, 1);
      // ป้ายไม้เหนือประตู (ข้อความ/ไอคอนวาดที่ baseHi ใน game.js)
      r(x, WD[0], cx - 22, 43, 44, 12); r(x, '#e8c66a', cx - 20, 45, 40, 8); r(x, '#f6dc8a', cx - 20, 45, 40, 1); r(x, '#c9a24a', cx - 20, 52, 40, 1);
      r(x, '#c9984f', cx - 21, 44, 1, 1); r(x, '#c9984f', cx + 20, 44, 1, 1);
    }, { soft: ['#3d2a1a', '#7a5a3a'] });
    BIG_HOUSE = { spr: s, ox: -(OVERH + 1), oy: -(ROOFH + 1), w: s.width, h: s.height };
    return BIG_HOUSE;
  }


  // ---------- น้ำ: ปลา ใบบัว บ่อเป็ด พืชริมน้ำ ประภาคาร ----------
  // ปลา (มองข้าง หันขวา) 6 สายพันธุ์ × 2 เฟรมหาง: ลำตัวไล่แสงบน→เงาล่างแบบ hue shift ท้องอ่อน ครีบหลัง/อก ตามีประกาย
  // pat: 'koi' ลายแต้มขาว • 'plain' สีเดียว • 'stripe' แถบข้าง
  const FISH_KINDS = [
    { c: '#f0762e', pat: 'koi', patC: '#fff3e0' }, { c: '#e8eef2', pat: 'plain' }, { c: '#ffc83a', pat: 'plain' },
    { c: '#e4482f', pat: 'koi', patC: '#fff3e0' }, { c: '#5a86b0', pat: 'stripe', patC: '#b8dcf0' }, { c: '#f4f4ec', pat: 'koi', patC: '#e4482f' },
  ];
  const FCACHE = new Map();
  function fish(kind, frame) {
    const key = kind + ':' + frame; if (FCACHE.has(key)) return FCACHE.get(key);
    const F = FISH_KINDS[kind % FISH_KINDS.length], C = ramp(F.c, .3, .2), BELLY = hue(F.c, .45), FIN = hue(F.c, -.18);
    const BODY = [[2, 6], [1, 8], [0, 9], [0, 9], [1, 8], [3, 6]]; // [x เริ่ม, x จบ] ต่อแถว (6 แถว)
    const s = mk(16, 9, (x) => {
      const ox = 4, oy = 1;
      // หาง: ก้านหางกว้างขึ้นเป็นง่ามสองแฉก ปลายแกว่งตามเฟรม
      const t = frame ? 1 : -1;
      r(x, FIN, ox - 1, oy + 2, 1, 2); r(x, FIN, ox - 2, oy + 1, 1, 4); r(x, hue(F.c, .2), ox - 2, oy + 1, 1, 1);
      r(x, FIN, ox - 3, oy + (t > 0 ? 0 : 1), 1, 2); r(x, FIN, ox - 3, oy + (t > 0 ? 4 : 3), 1, 2); r(x, C[0], ox - 3, oy + (t > 0 ? 0 : 5), 1, 1);
      // ครีบหลัง
      r(x, FIN, ox + 2, oy - 1, 4, 1); r(x, hue(F.c, .25), ox + 2, oy - 1, 1, 1);
      // ลำตัว
      BODY.forEach(([a, b], y) => {
        const col = y === 0 ? C[3] : y === 1 ? C[2] : y === 2 ? C[2] : y === 3 ? C[1] : y === 4 ? BELLY : BELLY;
        r(x, col, ox + a, oy + y, b - a + 1, 1);
      });
      r(x, C[4], ox + 3, oy + 1, 4, 1); r(x, C[3], ox + 2, oy + 2, 2, 1); // แสงสะท้อนบนหลัง (ซ้ายบน)
      r(x, C[1], ox + 1, oy + 4, 2, 1); r(x, C[0], ox + 3, oy + 5, 3, 1); // เงาท้องลึก
      // ลวดลาย
      if (F.pat === 'koi') { r(x, F.patC, ox + 2, oy + 1, 3, 2); r(x, F.patC, ox + 6, oy + 2, 2, 2); r(x, F.patC, ox + 4, oy + 3, 1, 1); }
      if (F.pat === 'stripe') { r(x, F.patC, ox + 1, oy + 3, 8, 1); r(x, C[0], ox + 1, oy + 4, 7, 1); }
      // ครีบอก + เหงือก + ตา
      r(x, FIN, ox + 5, oy + 3, 2, 2); r(x, C[0], ox + 6, oy + 4, 1, 1); r(x, C[1], ox + 6, oy + 1, 1, 4);
      r(x, '#1a2a3a', ox + 8, oy + 2, 1, 1); r(x, '#ffffff', ox + 8, oy + 1, 1, 1);
    }, { soft: ['#12445e', '#2a6f8a'] });
    FCACHE.set(key, s); return s;
  }
  // ใบบัว: 'big' มีแฉกเว้า (วีด้านขวา) เส้นใบแผ่ • 'small' วงรี • flower = ดอกบัวสีชมพู/ขาว • แต่ละใบมีเงาตกใต้ใบบนน้ำ
  const LCACHE = new Map();
  function lily(kind) { // 0 ใหญ่ 1 เล็ก 2 เล็กอีกแบบ 3 ใหญ่+บัวชมพู 4 ใหญ่+บัวขาว 5 ใหญ่ครึ่งใบ
    if (LCACHE.has(kind)) return LCACHE.get(kind);
    const G3 = ramp('#3f9a46', .3, .22), big = kind === 0 || kind >= 3, rx = big ? 5.5 : 3, ry = big ? 4 : 2.2, W2 = big ? 14 : 8, H2 = big ? 12 : 7;
    const s = mk(W2, H2, (x) => {
      const cx = W2 / 2 - 0.5, cy = H2 / 2 - 0.5 + (kind >= 3 ? 1 : 0);
      // เงาบนน้ำใต้ใบ (โปร่ง อมน้ำเงิน)
      for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) if ((dx / rx) ** 2 + (dy / ry) ** 2 <= 1.05) r(x, 'rgba(12,70,90,.28)', Math.round(cx + dx + 1), Math.round(cy + dy + 1), 1, 1);
      for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
        const d = (dx / rx) ** 2 + (dy / ry) ** 2; if (d > 1) continue;
        const ang = Math.atan2(dy, dx); if (big && kind !== 5 && Math.abs(ang) < 0.42 && dx > 0) continue; // แฉกเว้าด้านขวา
        const lit = clamp(.55 - (dx / rx) * .28 - (dy / ry) * .34 + (1 - d) * .12, 0, 1);
        r(x, d > .72 ? G3[1] : lit > .66 ? G3[3] : lit > .42 ? G3[2] : G3[1], Math.round(cx + dx), Math.round(cy + dy), 1, 1);
      }
      if (big) { for (const a of [0.9, 1.7, 2.5, 3.3, 4.2, 5.2]) { const e = Math.round(rx * .8 * Math.cos(a)), f = Math.round(ry * .8 * Math.sin(a)); r(x, G3[1], Math.round(cx + e / 2), Math.round(cy + f / 2), 1, 1); r(x, G3[1], Math.round(cx + e), Math.round(cy + f), 1, 1); } r(x, G3[0], Math.round(cx), Math.round(cy), 1, 1); }
      r(x, G3[4], Math.round(cx - rx * .45), Math.round(cy - ry * .55), 2, 1); // ประกายแสงบนใบ
      if (kind === 3 || kind === 4) { // ดอกบัว: กลีบ 5 กลีบ + เกสรเหลือง
        const P = kind === 3 ? ['#e0568e', '#ff8cb8', '#ffd0e4'] : ['#b8c6d6', '#f2f6fa', '#ffffff'], fx = Math.round(cx), fy = Math.round(cy - 1);
        r(x, P[0], fx - 2, fy, 5, 2); r(x, P[1], fx - 1, fy - 1, 3, 2); r(x, P[1], fx - 2, fy - 1, 1, 2); r(x, P[1], fx + 2, fy - 1, 1, 2); r(x, P[2], fx - 1, fy - 2, 3, 1); r(x, '#ffd23f', fx, fy - 1, 1, 1);
      }
    }, { soft: ['#14452a', '#2a6a3a'] });
    LCACHE.set(kind, s); return s;
  }
  // พืชริมน้ำ (วาดลงพื้น): กอกกหางกระรอก + ก้อนหินริมตลิ่ง
  function cattail(seed) {
    const R = rng(seed), n = 2 + Math.floor(R() * 2), H2 = 12;
    return mk(10, H2, (x) => {
      r(x, 'rgba(12,70,60,.28)', 1, H2 - 2, 8, 2);
      for (let i = 0; i < n; i++) {
        const bx = 2 + i * 3 + Math.floor(R() * 2), top = 2 + Math.floor(R() * 4), lean = i === 0 ? -1 : i === n - 1 ? 1 : 0;
        for (let y = top; y < H2 - 1; y++) { const xx = bx + Math.round(lean * (H2 - y) / 8); r(x, y > H2 - 4 ? '#4f913b' : '#6cbf55', xx, y, 1, 1); r(x, '#2f6b3a', xx + 1, y, 1, 1); }
        r(x, '#7a4a22', bx + lean * -0, top - 1, 2, 3); r(x, '#b8793c', bx, top - 1, 1, 2); r(x, '#3a2418', bx + 1, top + 1, 1, 1); // รวงสีน้ำตาล
        const lx = bx + (lean ? lean * 2 : 2); r(x, '#8cd468', lx, H2 - 5, 2, 1); r(x, '#8cd468', lx + (lean >= 0 ? 1 : -1), H2 - 6, 1, 1);
      }
    }, { soft: ['#1f4a2a', '#3a6a3a'] });
  }
  function stone(seed) {
    const R = rng(seed), w = 4 + Math.floor(R() * 3), h = 3 + Math.floor(R() * 2), C = ramp('#9a9fa8', .28, .22);
    return mk(w, h, (x) => {
      r(x, 'rgba(12,40,60,.25)', 1, h - 1, w, 1);
      r(x, C[2], 0, 1, w, h - 1); r(x, C[3], 0, 0, w - 1, 2); r(x, C[4], 0, 0, 2, 1); r(x, C[1], w - 2, h - 2, 2, 1); r(x, C[0], 1, h - 1, w - 1, 1);
    }, { soft: ['#3a3f4a', '#6a6f7a'] });
  }
  const SPROP = { cat: [cattail(3), cattail(11), cattail(19), cattail(27)], stone: [stone(1), stone(2), stone(3), stone(4)] };
  // บ่อเป็ดในคอก (ใต้ g ที่สเกลเป็นพิกเซลเกม): ขอบดิน+หิน น้ำไล่เฉด ประกายแสง ใบบัวบัว กอกก ระลอก
  let DPOND = null;
  function duckPond() {
    if (DPOND) return DPOND;
    const w = 34, h = 26, cx = 17, cy = 13, WC = ramp('#3a9fd0', .3, .22), MD = ramp('#b99a5c', .22, .25);
    const s = mk(w, h, (x) => {
      const inE = (px, py, rx, ry) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const wob = vnoise(px, py, 5, 61) * .12;
        if (inE(px, py, 16.5 + wob * 6, 12 + wob * 4)) r(x, (px - cx) * .4 + (py - cy) < -3 ? MD[3] : (px - cx) * .4 + (py - cy) > 4 ? MD[1] : MD[2], px, py, 1, 1); // ขอบดินชื้น: ซ้ายบนสว่าง ขวาล่างเข้ม
      }
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const wob = vnoise(px, py, 5, 62) * .1;
        if (!inE(px, py, 15 + wob * 5, 10.5 + wob * 4)) continue;
        const d = ((px - cx) / 15) ** 2 + ((py - cy) / 10.5) ** 2, v = clamp(Math.floor((1 - d) * 3.4 + dith(px, py) * .9 - .3), 0, 3);
        r(x, WC[clamp(3 - v, 0, 3) ? 3 - v : 0], px, py, 1, 1);
        if (py < cy - 2 && px < cx && dith(px, py) > .6) r(x, WC[4], px, py, 1, 1);
      }
      for (let px = 6; px < 12; px++) r(x, '#eafdfd', px, 5 + Math.round((px - 6) * .3), 1, 1); // แสงสะท้อนขอบบน
      r(x, '#cdf4f8', 9, 9, 3, 1); r(x, '#cdf4f8', 21, 15, 2, 1); r(x, '#ffffff', 12, 7, 1, 1); // ประกาย
      ell(x, 22, 13, 5, 2, 'rgba(255,255,255,.18)'); r(x, '#eafdfd', 17, 11, 6, 1); r(x, '#eafdfd', 16, 15, 8, 1); // ระลอกวง
      r(x, 'rgba(12,70,90,.3)', 13, 9, 7, 4);
    }, { soft: ['#4a3a22', '#8a7040'] });
    const g = s.getContext('2d'); // หินริมตลิ่ง + กอกก + ใบบัว วาดทับ (ผ่านขอบ)
    for (const [sx, sy, k] of [[2, 10, 0], [30, 8, 1], [27, 21, 3], [13, 25, 1]]) g.drawImage(SPROP.stone[k], sx, sy);
    g.drawImage(SPROP.cat[0], 25, 1); // กอกกมุมขวาบนกอเดียว ไม่ให้บังน้ำ
    g.drawImage(lily(1), 22, 13); g.drawImage(lily(4), 8, 15);
    DPOND = { spr: s, w: s.width, h: s.height }; return DPOND;
  }

  // ประภาคาร (กลางสระ): เกาะทราย + ฐานหิน + หอลายแดงขาวเรียวขึ้น + ระเบียงราว + ห้องตะเกียงกระจก + โดมแดง • lampY = แถวกลางห้องตะเกียง (ใช้จัดแนวลำแสง) • cx = แกนกลาง
  let LH = null;
  function lighthouse() {
    if (LH) return LH;
    const w = 40, h = 64, cx = 20, RFd = ramp('#c0392b', .3, .22), WH = ramp('#eee8da', .14, .3), ST = ramp('#8e939e', .28, .22), DK = ramp('#3a3f4a', .3, .2), SD = ramp('#e8d49a', .25, .2);
    const s = mk(w, h, (x) => {
      // เกาะทราย: ขอบเปียกเข้ม → ทรายกลาง → แสงซ้ายบน + กรวด + กอหญ้า
      ell(x, cx, 58, 19, 6, SD[0]); ell(x, cx, 57, 18, 5, SD[1]); ell(x, cx, 57, 16, 4, SD[2]); ell(x, cx - 3, 56, 11, 3, SD[3]);
      for (let k = 0; k < 28; k++) { const a = hash(k, 3, 91), b = hash(k, 5, 92); const px = Math.round(cx - 15 + a * 30), py = Math.round(55 + b * 5); if ((px - cx) ** 2 / 17 ** 2 + (py - 57) ** 2 / 4.5 ** 2 < 1) r(x, k % 3 ? SD[4] : SD[0], px, py, 1, 1); }
      for (const [rx2, ry2] of [[6, 59], [32, 58], [10, 56]]) { r(x, ST[3], rx2, ry2, 3, 2); r(x, ST[4], rx2, ry2, 1, 1); r(x, ST[0], rx2 + 1, ry2 + 2, 2, 1); }
      r(x, '#4f913b', 30, 55, 1, 2); r(x, '#7cc76a', 31, 54, 1, 3); r(x, '#4f913b', 32, 55, 1, 2);
      // ฐานหินกลม + ก้อนหินสลับแถว
      for (let y = 48; y < 57; y++) { const hw = 9 + (y - 48) * .25 | 0; r(x, ST[2], cx - hw, y, hw * 2 + 1, 1); r(x, ST[3], cx - hw, y, 3, 1); r(x, ST[1], cx + hw - 2, y, 3, 1); if ((y - 48) % 3 === 2) r(x, ST[0], cx - hw, y, hw * 2 + 1, 1); else for (let xx = cx - hw + ((y - 48) % 2) * 3; xx < cx + hw; xx += 6) r(x, ST[0], xx, y, 1, 1); }
      r(x, ST[4], cx - 8, 48, 6, 1);
      // ตัวหอ: ลอนแคบลงขึ้นบน แถบสีแดง/ขาวสลับทุก 7 แถว ซ้ายรับแสงขวาเงา + หน้าต่างเรืองแสง + ประตู
      const yT = 23, yB = 48;
      for (let y = yT; y < yB; y++) {
        const t = (y - yT) / (yB - yT), hw = Math.round(5.5 + t * 3.5), band = Math.floor((y - yT) / 7) % 2, P = band ? WH : RFd;
        r(x, P[2], cx - hw, y, hw * 2 + 1, 1); r(x, P[3], cx - hw, y, 2, 1); r(x, P[4], cx - hw, y, 1, 1); r(x, P[1], cx + hw - 3, y, 2, 1); r(x, P[0], cx + hw - 1, y, 2, 1);
        if ((y - yT) % 7 === 0) r(x, band ? RFd[0] : WH[1], cx - hw, y, hw * 2 + 1, 1); // รอยต่อแถบ
      }
      for (const [wy, wh] of [[30, 4], [39, 4]]) { r(x, '#2a1b14', cx - 2, wy, 4, wh); r(x, '#ffe08a', cx - 1, wy + 1, 2, wh - 2); r(x, '#fff6cf', cx - 1, wy + 1, 1, 1); r(x, DK[3], cx - 3, wy + wh, 6, 1); }
      r(x, '#3a2418', cx - 2, 43, 4, 5); r(x, '#6e4524', cx - 1, 43, 2, 5); r(x, '#c9962a', cx + 1, 45, 1, 1);
      // ระเบียง: แผ่นพื้นเหล็ก + เสาราว + ราวบน + ร่มเงาใต้ระเบียงบนตัวหอ
      r(x, 'rgba(26,28,44,.35)', cx - 6, 24, 12, 2);
      r(x, DK[1], cx - 9, 21, 19, 2); r(x, DK[3], cx - 9, 21, 19, 1); r(x, DK[0], cx - 8, 23, 17, 1);
      for (let xx = cx - 8; xx <= cx + 8; xx += 2) r(x, DK[2], xx, 18, 1, 3); r(x, DK[3], cx - 9, 17, 19, 1); r(x, DK[4], cx - 9, 17, 6, 1);
      // ห้องตะเกียง: กรอบโลหะ + กระจกเรืองแสง + เสากลาง + ฐาน/หลังคา
      r(x, DK[1], cx - 6, 9, 13, 8); r(x, '#ffe08a', cx - 5, 10, 11, 6); r(x, '#fff6cf', cx - 3, 11, 5, 4); r(x, '#ffffff', cx - 1, 12, 2, 2); r(x, '#ffd166', cx + 3, 10, 3, 6);
      r(x, DK[0], cx - 6, 9, 1, 8); r(x, DK[0], cx + 6, 9, 1, 8); r(x, DK[2], cx - 1, 10, 1, 6); r(x, DK[3], cx - 6, 16, 13, 1); r(x, DK[1], cx - 6, 8, 13, 1);
      // โดมแดง: ซ้ายสว่างขวาเงา + ปลายทอง
      for (let y = 2; y < 8; y++) { const hw = 1 + (y - 2); r(x, RFd[2], cx - hw, y, hw * 2 + 1, 1); r(x, RFd[3], cx - hw, y, Math.max(1, hw >> 1), 1); r(x, RFd[0], cx + hw - Math.max(1, hw >> 1), y, Math.max(1, hw >> 1) + 0, 1); }
      r(x, RFd[4], cx - 1, 2, 1, 1); r(x, '#f1c40f', cx, 0, 1, 2); r(x, '#fff3a0', cx, 0, 1, 1);
    }, { soft: ['#2a1b14', '#5a4a3a'] });
    LH = { spr: s, w: s.width, h: s.height, cx: cx + 1, lampY: 13 + 1, baseY: 57 + 1 }; return LH;
  }
  // ตกแต่งริมน้ำบนพื้น: กอกก/หินวางบนทรายที่ติดน้ำ (เรียกหลัง putImageData ใน ground)
  function shoreProps(x, tileT, W2, H2, hashf) {
    for (let ty = 1; ty < H2 - 1; ty++) for (let tx = 1; tx < W2 - 1; tx++) {
      if (tileT(tx, ty) !== SA) continue;
      const nearW = tileT(tx, ty - 1) === WA || tileT(tx - 1, ty) === WA || tileT(tx + 1, ty) === WA || tileT(tx, ty + 1) === WA; if (!nearW) continue;
      const h1 = hashf(tx, ty, 301);
      if (h1 < .13) x.drawImage(SPROP.cat[Math.floor(hashf(tx, ty, 302) * 4)], tx * U + 3, ty * U - 2);
      else if (h1 < .24) x.drawImage(SPROP.stone[Math.floor(hashf(tx, ty, 303) * 4)], tx * U + 4 + Math.floor(hashf(tx, ty, 304) * 6), ty * U + 5 + Math.floor(hashf(tx, ty, 305) * 5));
    }
  }

  return { mk, r, ell, disc, shade, ramp, hue, fish, lily, duckPond, lighthouse,  hash, rng, addOutline, cv, U, OUT, ground, GK: 2, fences, tree: treeFor, building, counter, bigHouse, soil: wet => SOIL[wet ? 1 : 0], ROOF_UP, OVER };
})();
