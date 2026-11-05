// canvas จำลองเล็กๆ สำหรับเครื่องมือดึงสไปรต์ (vehsheet.js, charsheet.js): ไม่มี dependency เพิ่ม ใช้ได้กับโค้ดพิกเซลอาร์ตของเกม
const zlib = require('zlib');

// ---------- canvas จำลอง (พอสำหรับพิกเซลอาร์ต: fillRect drawImage ellipse/arc getImageData) ----------
function parseColor(s) {
  s = String(s).trim();
  if (s[0] === '#') { let h = s.slice(1); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1]; }
  const m = s.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  return [0, 0, 0, 0];
}
class Ctx {
  constructor(c) { this.canvas = c; this.t = [1, 0, 0, 1, 0, 0]; this.stack = []; this.fillStyle = '#000'; this.globalAlpha = 1; this.path = []; this.polys = []; this.imageSmoothingEnabled = false; }
  save() { this.stack.push({ t: this.t.slice(), f: this.fillStyle, a: this.globalAlpha }); }
  restore() { const s = this.stack.pop(); if (s) { this.t = s.t; this.fillStyle = s.f; this.globalAlpha = s.a; } }
  setTransform(a, b, c, d, e, f) { this.t = [a, b, c, d, e, f]; }
  translate(x, y) { const t = this.t; t[4] += t[0] * x + t[2] * y; t[5] += t[1] * x + t[3] * y; }
  scale(x, y) { const t = this.t; t[0] *= x; t[1] *= x; t[2] *= y; t[3] *= y; }
  pt(x, y) { const t = this.t; return [t[0] * x + t[2] * y + t[4], t[1] * x + t[3] * y + t[5]]; }
  blend(px, py, r, g, b, a) {
    const c = this.canvas; if (px < 0 || py < 0 || px >= c.width || py >= c.height || a <= 0) return;
    const i = (py * c.width + px) * 4, d = c.data, da = d[i + 3] / 255, oa = a + da * (1 - a);
    d[i] = (r * a + d[i] * da * (1 - a)) / oa; d[i + 1] = (g * a + d[i + 1] * da * (1 - a)) / oa; d[i + 2] = (b * a + d[i + 2] * da * (1 - a)) / oa; d[i + 3] = oa * 255;
  }
  fillRect(x, y, w, h) {
    const [ax, ay] = this.pt(x, y), [bx, by] = this.pt(x + w, y + h), [r, g, b, a] = parseColor(this.fillStyle);
    const x0 = Math.round(Math.min(ax, bx)), x1 = Math.round(Math.max(ax, bx)), y0 = Math.round(Math.min(ay, by)), y1 = Math.round(Math.max(ay, by));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.blend(xx, yy, r, g, b, a * this.globalAlpha);
  }
  clearRect() { this.canvas.data.fill(0); }
  drawImage(img, dx, dy, dw = img.width, dh = img.height) {
    const [ax, ay] = this.pt(dx, dy), [bx, by] = this.pt(dx + dw, dy + dh), flipX = bx < ax, flipY = by < ay;
    const x0 = Math.round(Math.min(ax, bx)), x1 = Math.round(Math.max(ax, bx)), y0 = Math.round(Math.min(ay, by)), y1 = Math.round(Math.max(ay, by)), s = img.data;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      let u = Math.floor((xx - x0 + .5) / (x1 - x0) * img.width), v = Math.floor((yy - y0 + .5) / (y1 - y0) * img.height);
      if (flipX) u = img.width - 1 - u; if (flipY) v = img.height - 1 - v;
      const i = (v * img.width + u) * 4; this.blend(xx, yy, s[i], s[i + 1], s[i + 2], s[i + 3] / 255 * this.globalAlpha);
    }
  }
  getImageData(x, y, w, h) { return { data: this.canvas.data, width: w, height: h }; }
  putImageData() {}
  beginPath() { this.path = []; this.polys = []; this.sub = null; }
  ellipse(cx, cy, rx, ry) { this.path.push({ cx, cy, rx, ry, t: this.t.slice() }); }
  arc(cx, cy, rad) { this.path.push({ cx, cy, rx: rad, ry: rad, t: this.t.slice() }); }
  moveTo(x, y) { this.sub = [this.pt(x, y)]; (this.polys || (this.polys = [])).push(this.sub); }
  lineTo(x, y) { if (!this.sub) this.moveTo(x, y); else this.sub.push(this.pt(x, y)); }
  closePath() {}
  fill() {
    const [r, g, b, a] = parseColor(this.fillStyle);
    for (const e of this.path) {
      const sx = Math.abs(e.t[0]), sy = Math.abs(e.t[3]), cx = e.t[0] * e.cx + e.t[4], cy = e.t[3] * e.cy + e.t[5], rx = e.rx * sx, ry = e.ry * sy;
      for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
        const dx = (xx + .5 - cx) / rx, dy = (yy + .5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.blend(xx, yy, r, g, b, a * this.globalAlpha);
      }
    }
    for (const poly of this.polys || []) { // ระบายรูปหลายเหลี่ยม (เติมแบบ even-odd ที่กึ่งกลางพิกเซล)
      if (poly.length < 3) continue;
      const ys = poly.map(q => q[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
      for (let yy = y0; yy <= y1; yy++) {
        const cy = yy + .5, xs = [];
        for (let i = 0; i < poly.length; i++) { const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length]; if ((ay <= cy) !== (by <= cy)) xs.push(ax + (cy - ay) / (by - ay) * (bx - ax)); }
        xs.sort((m, n) => m - n);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let xx = Math.round(xs[k]); xx < Math.round(xs[k + 1]); xx++) this.blend(xx, yy, r, g, b, a * this.globalAlpha);
      }
    }
  }
  stroke() { // ลากเส้นหนา lineWidth ตามจุดที่ผ่านมา (วงรีวาดเป็นเส้นรอบวง)
    const [r, g, b, a] = parseColor(this.strokeStyle || '#000'), w = (this.lineWidth || 1) * Math.abs(this.t[0]), hw = Math.max(.5, w / 2);
    const seg = ([ax, ay], [bx, by]) => { const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2) + 1; for (let i = 0; i <= n; i++) { const px = ax + (bx - ax) * i / n, py = ay + (by - ay) * i / n; for (let yy = Math.floor(py - hw); yy <= Math.ceil(py + hw); yy++) for (let xx = Math.floor(px - hw); xx <= Math.ceil(px + hw); xx++) if (Math.hypot(xx + .5 - px, yy + .5 - py) <= hw) this.blend(xx, yy, r, g, b, a * this.globalAlpha * .6); } };
    for (const poly of this.polys || []) for (let i = 0; i + 1 < poly.length; i++) seg(poly[i], poly[i + 1]);
    for (const e of this.path) { const sx = Math.abs(e.t[0]), sy = Math.abs(e.t[3]), cx = e.t[0] * e.cx + e.t[4], cy = e.t[3] * e.cy + e.t[5]; let prev = null; for (let i = 0; i <= 36; i++) { const an = i / 36 * Math.PI * 2, q = [cx + Math.cos(an) * e.rx * sx, cy + Math.sin(an) * e.ry * sy]; if (prev) seg(prev, q); prev = q; } }
  }
  fillText() {} strokeText() {}
}
class Canvas {
  constructor(w = 1, h = 1) { this._w = w; this._h = h; this.data = new Uint8ClampedArray(w * h * 4); this.ctx = null; }
  get width() { return this._w; } set width(v) { this._w = v; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  get height() { return this._h; } set height(v) { this._h = v; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  getContext() { return this.ctx || (this.ctx = new Ctx(this)); }
}
function png(c) { // เขียน PNG RGBA 8 บิต
  const crcT = Array.from({ length: 256 }, (_, n) => { let k = n; for (let i = 0; i < 8; i++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1; return k >>> 0; });
  const crc = b => { let k = 0xffffffff; for (const v of b) k = crcT[(k ^ v) & 255] ^ (k >>> 8); return (k ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]), cr = Buffer.alloc(4); len.writeUInt32BE(data.length); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
  const hdr = Buffer.alloc(13); hdr.writeUInt32BE(c.width, 0); hdr.writeUInt32BE(c.height, 4); hdr[8] = 8; hdr[9] = 6;
  const raw = Buffer.alloc((c.width * 4 + 1) * c.height);
  for (let y = 0; y < c.height; y++) { raw[y * (c.width * 4 + 1)] = 0; Buffer.from(c.data.buffer, y * c.width * 4, c.width * 4).copy(raw, y * (c.width * 4 + 1) + 1); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

module.exports = { Canvas, png };
