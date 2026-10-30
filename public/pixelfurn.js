// เฟอร์นิเจอร์พิกเซล: เอาโค้ดวาดเฟอร์นิเจอร์มุมเอียง (ART ใน game.js) มาเรนเดอร์แบบพิกเซลอาร์ต
// ความละเอียดครึ่งหนึ่ง (1 พิกเซลศิลป์ = 2 พิกเซลเกม เหมือนแร่ ต้นไม้ อาคาร) เติมสีแบบไม่เบลอ ปรับโทนสีให้หม่นอุ่น และใส่ขอบ #2a1b14 รอบตัว
// ใช้: PixelFurn.render(g => วาดด้วย API แคนวาสตามปกติ) → { cv, ax, ay, glows } วาดที่ (sx − ax·2, sy − ay·2) ขยาย 2 เท่า
const PixelFurn = (() => {
  const K = 2, BW = 128, BH = 96, OX = 64, OY = 64, INK = '#2a1b14', INKC = [42, 27, 20, 1];
  let factory = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rgb = s => { s = String(s).trim(); let m;
    if (s[0] === '#') { if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]; const n = parseInt(s.slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, 1]; }
    if ((m = /rgba?\(([^)]+)\)/.exec(s))) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    return [0, 0, 0, 1]; };
  // โทนสีเดียวกับชุดแร่/ต้นไม้/อาคาร: ลดความสด (สีจัดเกินไปดูเป็นพลาสติก) ยกเงาไม่ให้ดำสนิท แล้วอุ่นขึ้นเล็กน้อย
  const graded = new Map();
  function grade(s) {
    if (graded.has(s)) return graded.get(s);
    let out;
    if (s === INK) out = INKC;
    else {
      const [r, g, b, a] = rgb(s), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510;
      let sat = mx === mn ? 0 : (mx - mn) / 255 / (1 - Math.abs(2 * l - 1) || 1);
      const k = sat > 0.55 ? 0.55 / sat * 0.92 + 0.08 * (1 - 0.55 / sat) : 0.92; // ลดสีที่สดจัดมากกว่าสีหม่น
      const grey = (r + g + b) / 3, lift = v => 14 + v * (241 / 255);
      out = [r, g, b].map((v, i) => { const c = lift(grey + (v - grey) * k); return Math.max(0, Math.min(255, c + [6, 2, -6][i] * (1 - l))); });
      out.push(a);
    }
    graded.set(s, out); return out;
  }
  // แคนวาสจำลองที่เติมสีทีละพิกเซล (ไม่มีขอบเบลอ) รองรับเฉพาะคำสั่งที่โค้ดเฟอร์นิเจอร์/ห้องใช้ • bw×bh พิกเซลศิลป์ (ox,oy) = ตำแหน่งของจุด (0,0)
  class Raster {
    constructor(bw, bh, ox, oy) { this.bw = bw; this.bh = bh; this.ox = ox; this.oy = oy; this.d = new Float32Array(bw * bh * 4); this.st = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, tx: 0, ty: 0 }; this.stack = []; this.subs = []; this.cur = null; this.glows = []; }
    get fillStyle() { return this.st.fillStyle; } set fillStyle(v) { this.st.fillStyle = v; }
    get strokeStyle() { return this.st.strokeStyle; } set strokeStyle(v) { this.st.strokeStyle = v; }
    get lineWidth() { return this.st.lineWidth; } set lineWidth(v) { this.st.lineWidth = v; }
    get globalAlpha() { return this.st.globalAlpha; } set globalAlpha(v) { this.st.globalAlpha = v; }
    save() { this.stack.push(Object.assign({}, this.st)); } restore() { if (this.stack.length) this.st = this.stack.pop(); }
    translate(x, y) { this.st.tx += x; this.st.ty += y; }
    P(x, y) { return [this.ox + (x + this.st.tx) / K, this.oy + (y + this.st.ty) / K]; }
    beginPath() { this.subs = []; this.cur = null; }
    moveTo(x, y) { this.cur = [this.P(x, y)]; this.subs.push(this.cur); }
    lineTo(x, y) { if (!this.cur) return this.moveTo(x, y); this.cur.push(this.P(x, y)); }
    closePath() { if (this.cur) this.cur.closed = true; }
    quadraticCurveTo(cx, cy, x, y) { const p = this.cur[this.cur.length - 1], c = this.P(cx, cy), e = this.P(x, y); for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; this.cur.push([u * u * p[0] + 2 * u * t * c[0] + t * t * e[0], u * u * p[1] + 2 * u * t * c[1] + t * t * e[1]]); } }
    ellipse(x, y, rx, ry, rot, a0, a1) { const pts = [], n = 24; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push(this.P(x + Math.cos(a) * rx, y + Math.sin(a) * ry)); } pts.closed = true; this.cur = pts; this.subs.push(pts); }
    arc(x, y, r, a0, a1) { this.ellipse(x, y, r, r, 0, a0, a1); }
    createRadialGradient(x0, y0, r0, x1, y1, r1) { return { glow: true, x: x1, y: y1, r: r1, stops: [], addColorStop(o, c) { this.stops.push([o, c]); } }; }
    px(x, y, c, a) { if (x < 0 || y < 0 || x >= this.bw || y >= this.bh || a <= 0) return; const o = (y * this.bw + x) * 4, da = this.d[o + 3], oa = a + da * (1 - a); for (let k = 0; k < 3; k++) this.d[o + k] = (c[k] * a + this.d[o + k] * da * (1 - a)) / oa; this.d[o + 3] = oa; }
    fillRect(x, y, w, h) {
      const f = this.st.fillStyle;
      if (f && f.glow) { this.glows.push({ x: f.x + this.st.tx, y: f.y + this.st.ty, r: f.r, stops: f.stops.slice() }); return; } // แสงเรืองวาดสดทับทีหลัง ไม่อบลงพิกเซล
      const c = grade(f), a = c[3] * this.st.globalAlpha, [x0, y0] = this.P(x, y), [x1, y1] = this.P(x + w, y + h);
      for (let j = Math.round(y0); j < Math.round(y1); j++) for (let i = Math.round(x0); i < Math.round(x1); i++) this.px(i, j, c, a);
    }
    fill() {
      const f = this.st.fillStyle; if (typeof f !== 'string') return;
      const c = grade(f), a = c[3] * this.st.globalAlpha, all = this.subs.filter(s => s.length > 2); if (!all.length) return;
      let ymin = 1e9, ymax = -1e9; for (const s of all) for (const p of s) { if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1]; }
      for (let y = Math.max(0, Math.floor(ymin)); y <= Math.min(this.bh - 1, Math.ceil(ymax)); y++) {
        const cy = y + 0.5, xs = [];
        for (const s of all) for (let i = 0, j = s.length - 1; i < s.length; j = i++) { const [xi, yi] = s[i], [xj, yj] = s[j]; if ((yi > cy) !== (yj > cy)) xs.push(xi + (cy - yi) / (yj - yi) * (xj - xi)); }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, c, a);
      }
    }
    stroke() {
      const c = grade(this.st.strokeStyle), a = c[3] * this.st.globalAlpha, soft = this.st.strokeStyle === INK && this.subs.every(s => s.closed), w = Math.max(1, Math.round(this.st.lineWidth / K)); // เส้นแบ่งด้านในของกล่อง (เส้นปิด) จางครึ่งหนึ่ง ขอบนอกเข้มเต็มเหมือนชุดอาคาร • เส้นเปิด (เข็มนาฬิกา หาง) เข้มเต็ม
      const line = (p, q) => { const n = Math.ceil(Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])) * 2) + 1; let lx = null, ly = null;
        for (let i = 0; i <= n; i++) { const x = Math.floor(p[0] + (q[0] - p[0]) * i / n), y = Math.floor(p[1] + (q[1] - p[1]) * i / n); if (x === lx && y === ly) continue; lx = x; ly = y; for (let u = 0; u < w; u++) for (let v = 0; v < w; v++) this.px(x + u, y + v, c, soft ? a * 0.5 : a); } };
      for (const s of this.subs) { for (let i = 1; i < s.length; i++) line(s[i - 1], s[i]); if (s.closed && s.length > 2) line(s[s.length - 1], s[0]); }
    }
  }
  // วาด → ขอบเข้มรอบเงาตัว (เฉพาะส่วนทึบ ไม่รวมเงาพื้นจาง ๆ) → ตัดขอบว่าง → แคนวาส
  function render(draw) {
    const R = new Raster(BW, BH, OX, OY); draw(R);
    const d = R.d, solid = i => d[i * 4 + 3] >= 0.5, edge = [];
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) { const i = y * BW + x; if (solid(i)) continue;
      if ((x > 0 && solid(i - 1)) || (x < BW - 1 && solid(i + 1)) || (y > 0 && solid(i - BW)) || (y < BH - 1 && solid(i + BW))) edge.push(i); }
    for (const i of edge) { d[i * 4] = INKC[0]; d[i * 4 + 1] = INKC[1]; d[i * 4 + 2] = INKC[2]; d[i * 4 + 3] = 1; }
    let x0 = BW, y0 = BH, x1 = -1, y1 = -1;
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) if (d[(y * BW + x) * 4 + 3] > 0.02) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, cv = factory(w, h), cx = cv.getContext('2d'), img = cx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = ((y0 + y) * BW + x0 + x) * 4, o = (y * w + x) * 4; img.data[o] = d[s]; img.data[o + 1] = d[s + 1]; img.data[o + 2] = d[s + 2]; img.data[o + 3] = Math.round(d[s + 3] * 255); }
    cx.putImageData(img, 0, 0);
    return { cv, w, h, ax: OX - x0, ay: OY - y0, glows: R.glows };
  }
  // ภาพทั้งฉาก (พื้น/ผนังห้อง): พื้นที่ (x0,y0) ขนาด w×h พิกเซลเกม เติมสีแบบพิกเซล ไม่ใส่ขอบรอบตัว → แคนวาสขนาดเกม (ขยาย 2 เท่าแล้ว)
  function scene(draw, x0, y0, w, h) {
    const bw = Math.ceil(w / K), bh = Math.ceil(h / K), R = new Raster(bw, bh, -x0 / K, -y0 / K); draw(R);
    const small = factory(bw, bh), sx = small.getContext('2d'), img = sx.createImageData(bw, bh), d = R.d;
    for (let i = 0; i < bw * bh * 4; i += 4) { img.data[i] = d[i]; img.data[i + 1] = d[i + 1]; img.data[i + 2] = d[i + 2]; img.data[i + 3] = Math.round(d[i + 3] * 255); }
    sx.putImageData(img, 0, 0);
    const cv = factory(w, h), g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(small, 0, 0, bw * K, bh * K);
    return { cv, small };
  }
  // วาดสไปรต์ลงจอ: (sx, sy) = จุดที่ตรงกับ (0,0) ตอนเรนเดอร์
  function draw(g, s, sx, sy) {
    const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
    g.drawImage(s.cv, Math.round(sx - s.ax * K), Math.round(sy - s.ay * K), s.w * K, s.h * K); g.imageSmoothingEnabled = sm;
    for (const o of s.glows) { const x = sx + o.x, y = sy + o.y, gr = g.createRadialGradient(x, y, 0, x, y, o.r); for (const [p, c] of o.stops) gr.addColorStop(p, c); g.fillStyle = gr; g.fillRect(x - o.r, y - o.r, o.r * 2, o.r * 2); }
  }
  return { render, scene, draw, grade, K, setCanvasFactory(fn) { factory = fn; } };
})();
if (typeof module !== 'undefined') module.exports = PixelFurn;
