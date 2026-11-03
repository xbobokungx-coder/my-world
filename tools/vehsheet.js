// ดึงสไปรต์ชีตท่าขับขี่ยานพาหนะ (จักรยาน มอเตอร์ไซค์ รถยนต์) ออกเป็นไฟล์ PNG โดยไม่ต้องเปิดเบราว์เซอร์
// ใช้โค้ดวาดตัวจริงจาก public/pixelart.js + public/pixelchar.js ผ่าน canvas จำลองเล็กๆ (ไม่มี dependency เพิ่ม)
// รัน: node tools/vehsheet.js [โฟลเดอร์ปลายทาง]   (ค่าเริ่มต้น sprites/vehicles)
// ได้ไฟล์:
//   vehicles-riding.png          ชีตรวม แถว = ยานพาหนะ × ทิศ (ขวา ซ้าย ลง ขึ้น) คอลัมน์ = จอด + เฟรมแล่น 0–3 (มีผู้ขี่ เงา ควัน)
//   <ยาน>-<ทิศ>-<idle|f0..f3>.png แต่ละเฟรมแยกไฟล์ (ขนาดเกมจริง ×2)
//   <ยาน>-layers.png             ชั้นดิบของสไปรต์ (หลัง/หน้า แยกกัน) ขนาดพิกเซลศิลป์ 1:1 ไว้แก้ลายเส้น
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..'), OUT = path.resolve(process.argv[2] || path.join(ROOT, 'sprites/vehicles'));

// ---------- canvas จำลอง (พอสำหรับพิกเซลอาร์ต: fillRect drawImage ellipse/arc getImageData) ----------
function parseColor(s) {
  s = String(s).trim();
  if (s[0] === '#') { let h = s.slice(1); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1]; }
  const m = s.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  return [0, 0, 0, 0];
}
class Ctx {
  constructor(c) { this.canvas = c; this.t = [1, 0, 0, 1, 0, 0]; this.stack = []; this.fillStyle = '#000'; this.globalAlpha = 1; this.path = []; this.imageSmoothingEnabled = false; }
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
  beginPath() { this.path = []; }
  ellipse(cx, cy, rx, ry) { this.path.push({ cx, cy, rx, ry, t: this.t.slice() }); }
  arc(cx, cy, rad) { this.path.push({ cx, cy, rx: rad, ry: rad, t: this.t.slice() }); }
  fill() {
    const [r, g, b, a] = parseColor(this.fillStyle);
    for (const e of this.path) {
      const sx = Math.abs(e.t[0]), sy = Math.abs(e.t[3]), cx = e.t[0] * e.cx + e.t[4], cy = e.t[3] * e.cy + e.t[5], rx = e.rx * sx, ry = e.ry * sy;
      for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
        const dx = (xx + .5 - cx) / rx, dy = (yy + .5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.blend(xx, yy, r, g, b, a * this.globalAlpha);
      }
    }
  }
  stroke() {} moveTo() {} lineTo() {} closePath() {} fillText() {} strokeText() {}
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

// ---------- โหลดโค้ดวาดจริงของเกม ----------
const sandbox = { console, Math, Map, Set, document: { createElement: () => new Canvas() }, performance: { now: () => 0 } };
sandbox.window = sandbox; vm.createContext(sandbox);
for (const f of ['shared.js', 'pixelart.js', 'pixelchar.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', f), 'utf8') + (f === 'shared.js' ? '' : `\n;this.${f === 'pixelart.js' ? 'PixelArt = PixelArt' : 'PixelChar = PixelChar; this.PixelVehicle = PixelVehicle'};`), sandbox, { filename: f });
const { PixelChar, PixelVehicle, Shared } = sandbox;

// ---------- เรนเดอร์ ----------
const KINDS = ['bike', 'scooter', 'car'], DIRS = [[3, 'right', 'ขวา'], [2, 'left', 'ซ้าย'], [0, 'down', 'ลง'], [1, 'up', 'ขึ้น']];
const RATE = { bike: 9, scooter: 12, car: 14 }; // เฟรมต่อหน่วย anim ตาม PixelVehicle.draw → anim = fr / RATE ได้เฟรม fr พอดี
const COLS = [['idle', null], ['f0', 0], ['f1', 1], ['f2', 2], ['f3', 3]], CW = 96, CH = 84;
const rider = { id: 1, name: '', color: '#3498db', pc: Shared.PANTS_COLOR, wear: {}, held: '', sit: null };
const cell = (kind, dir, fr, bg) => {
  const c = new Canvas(CW, CH), g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, CW, CH); }
  const moving = fr !== null, p = Object.assign({}, rider, { veh: kind, dir, x: CW / 2, y: CH - 22, moving, anim: moving ? (fr + .5) / RATE[kind] : 0 });
  PixelVehicle.draw(g, p, moving ? 210 : 0, PixelChar); return c;
};
fs.mkdirSync(OUT, { recursive: true });
let files = 0; const write = (name, c) => { fs.writeFileSync(path.join(OUT, name), png(c)); files++; };

// 1) ชีตรวม: หัวคอลัมน์ 14 px + แถว
const HEAD = 14, sheet = new Canvas(CW * COLS.length, HEAD + CH * KINDS.length * DIRS.length), sg = sheet.getContext('2d');
sg.fillStyle = '#4d5260'; sg.fillRect(0, 0, sheet.width, HEAD);
KINDS.forEach((kind, ki) => DIRS.forEach(([dir, dn], di) => {
  const row = ki * DIRS.length + di, bg = ['#8bbf5a', '#7fb452'][row & 1];
  COLS.forEach(([cn, fr], ci) => {
    sg.drawImage(cell(kind, dir, fr, bg), ci * CW, HEAD + row * CH);
    write(`${kind}-${dn}-${cn}.png`, cell(kind, dir, fr, null));
  });
}));
// แถบสีหัวคอลัมน์ (จอด = เทา, เฟรมแล่น = ฟ้า) และแถบสีซ้ายแต่ละยาน (จักรยานแดง มอไซค์เขียวมิ้นต์ รถแดงเข้ม) แทนตัวอักษร
COLS.forEach((_, ci) => { sg.fillStyle = ci ? '#5dade2' : '#aab2bd'; sg.fillRect(ci * CW + 2, 4, ci ? 8 + ci * 6 : 8, 6); });
KINDS.forEach((k, ki) => { sg.fillStyle = { bike: '#d94a3a', scooter: '#3fbf9f', car: '#8a1f14' }[k]; sg.fillRect(0, HEAD + ki * DIRS.length * CH, 3, DIRS.length * CH); });
write('vehicles-riding.png', sheet);

// 2) ชั้นดิบ 1:1 ต่อยาน: แถว = ทิศ (ข้าง หน้า หลัง) × ชั้น (หลัง หน้า) คอลัมน์ = เฟรม 0–3 + จอด
for (const kind of KINDS) {
  const items = []; for (const [dir] of [[3], [0], [1]]) for (const layer of ['back', 'front']) items.push([0, 1, 2, 3, null].map(fr => PixelVehicle.sprite(kind, dir, fr ?? 0, rider.pc, fr === null, rider.color)[layer]));
  const cw = Math.max(...items.flat().map(s => s.width)) + 2, ch = Math.max(...items.flat().map(s => s.height)) + 2;
  const c = new Canvas(cw * 5, ch * items.length), g = c.getContext('2d');
  items.forEach((row, ri) => row.forEach((s, ci) => { g.fillStyle = (ri + ci) & 1 ? '#e8ecef' : '#d5dbe0'; g.fillRect(ci * cw, ri * ch, cw, ch); g.drawImage(s, ci * cw + 1, ri * ch + 1); }));
  write(`${kind}-layers.png`, c);
}
console.log(`เขียน ${files} ไฟล์ที่ ${path.relative(ROOT, OUT) || OUT}`);
