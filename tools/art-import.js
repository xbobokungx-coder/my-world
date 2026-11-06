// art-import.js — นำภาพจาก PixelLab (หรือที่ไหนก็ได้) เข้าเกมให้เข้ากับ STYLE_GUIDE ไม่มี dependency เพิ่ม
//
// ใช้:  node tools/art-import.js <ภาพต้นฉบับ.png> <ชื่อ> [ตัวเลือก]
//   --size 32           ขนาดกล่องปลายทาง (กว้าง=สูง) หรือ --size 64x32  (ค่าเริ่มต้น 32)
//   --palette style     ปรับสีเข้าพาเลตจาก STYLE_GUIDE.md (ค่าเริ่มต้น) | none = ไม่ปรับ | ไฟล์.txt ที่มีรหัส #hex
//   --keep-dark         เก็บสีเข้มมาก (เส้นขอบ) ไว้ตามเดิม ไม่บังคับเข้าพาเลต (ค่าเริ่มต้น: เปิด)
//   --no-keep-dark      บังคับทุกสีเข้าพาเลต
//   --section items     หมวดใน public/pack/manifest.json (ค่าเริ่มต้น items)
//   --dry               แค่รายงาน ไม่เขียนไฟล์
// ผลลัพธ์: public/pack/<section>/<ชื่อ>.png + บันทึกใน manifest.json ภายใต้ section
// ขั้นตอน: อ่าน PNG → ตัดขอบโปร่งใส → ย่อแบบ nearest-neighbor ให้พอดีกล่อง (ไม่ขยายภาพเล็ก) → ปรับสี → วางกลางล่างของกล่อง
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
if (args.length < 2 || args.includes('-h')) {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 12).join('\n'));
  process.exit(args.length < 2 ? 1 : 0);
}
const [src, name] = args;
const opt = (k, d) => { const i = args.indexOf(k); return i > 1 && args[i + 1] ? args[i + 1] : d; };
const flag = k => args.includes(k);
if (!/^[a-z0-9_-]+$/i.test(name)) { console.error('ชื่อใช้ได้แค่ a-z 0-9 _ -'); process.exit(1); }
const sz = opt('--size', '32').split('x').map(Number);
const BW = sz[0], BH = sz[1] || sz[0];
if (!(BW > 0 && BH > 0)) { console.error('--size ไม่ถูกต้อง เช่น 32 หรือ 64x32'); process.exit(1); }
const section = opt('--section', 'items');
const keepDark = !flag('--no-keep-dark');

// ---------- PNG อ่าน/เขียน (8 บิต: RGBA, RGB, palette, gray, gray+alpha) ----------
function readPNG(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('ไม่ใช่ไฟล์ PNG');
  let p = 8, w, h, depth, type, inter, plte = null, trns = null; const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), t = b.toString('ascii', p + 4, p + 8), d = b.slice(p + 8, p + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; inter = d[12]; }
    else if (t === 'PLTE') plte = d; else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  if (depth !== 8 || inter) throw new Error('รองรับเฉพาะ PNG 8 บิตแบบไม่ interlace (ให้ export ใหม่)');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = Buffer.from(raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0, up = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const q = a + up - c, pa = Math.abs(q - a), pb = Math.abs(q - up), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      line[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * ch;
      if (type === 6) line.copy(px, o, s, s + 4);
      else if (type === 2) { px[o] = line[s]; px[o + 1] = line[s + 1]; px[o + 2] = line[s + 2]; px[o + 3] = 255; }
      else if (type === 0) { px[o] = px[o + 1] = px[o + 2] = line[s]; px[o + 3] = 255; }
      else if (type === 4) { px[o] = px[o + 1] = px[o + 2] = line[s]; px[o + 3] = line[s + 1]; }
      else { const k = line[s]; px[o] = plte[k * 3]; px[o + 1] = plte[k * 3 + 1]; px[o + 2] = plte[k * 3 + 2]; px[o + 3] = trns && k < trns.length ? trns[k] : 255; }
    }
    prev = line;
  }
  return { w, h, px };
}
function writePNG(file, w, h, px) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = buf => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

// ---------- พาเลต ----------
function loadPalette() {
  const p = opt('--palette', 'style');
  if (p === 'none') return null;
  let text;
  if (p === 'style') {
    const sg = fs.readFileSync(path.join(ROOT, 'STYLE_GUIDE.md'), 'utf8');
    const m = sg.match(/## 2\)[\s\S]*?(?=\n## )/); // เฉพาะหัวข้อพาเลตสี
    text = m ? m[0] : sg;
  } else text = fs.readFileSync(p, 'utf8');
  const cols = [...new Set((text.match(/#[0-9a-f]{6}\b/gi) || []).map(s => s.toLowerCase()))];
  if (!cols.length) throw new Error('ไม่เจอรหัสสีในพาเลต');
  return cols.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
}

// ---------- ทำงาน ----------
const img = readPNG(src);
const A = (x, y) => img.px[(y * img.w + x) * 4 + 3];
let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (A(x, y) > 24) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
if (x1 < 0) { console.error('ภาพโปร่งใสทั้งภาพ'); process.exit(1); }
const cw = x1 - x0 + 1, chh = y1 - y0 + 1;
const scale = Math.min(1, BW / cw, BH / chh); // ไม่ขยาย (ขยายพิกเซลอาร์ตให้เกมทำตอนวาด)
const tw = Math.max(1, Math.round(cw * scale)), th = Math.max(1, Math.round(chh * scale));
const pal = loadPalette();
const out = Buffer.alloc(BW * BH * 4), ox = Math.floor((BW - tw) / 2), oy = BH - th; // กลางล่าง (ยืนบนพื้นช่อง)
const used = new Set(); let kept = 0;
for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
  const sx = x0 + Math.min(cw - 1, Math.floor((x + 0.5) / scale)), sy = y0 + Math.min(chh - 1, Math.floor((y + 0.5) / scale));
  const s = (sy * img.w + sx) * 4, a = img.px[s + 3];
  if (a <= 24) continue;
  let r = img.px[s], g = img.px[s + 1], b = img.px[s + 2];
  const dark = r + g + b < 120;
  if (pal && !(keepDark && dark)) {
    let best = 0, bd = 1e9;
    pal.forEach(([pr, pg, pb], i) => { const d = 0.3 * (r - pr) ** 2 + 0.59 * (g - pg) ** 2 + 0.11 * (b - pb) ** 2; if (d < bd) { bd = d; best = i; } });
    [r, g, b] = pal[best];
  } else if (dark) kept++;
  const o = ((oy + y) * BW + ox + x) * 4;
  out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a < 128 ? 128 : 255; // alpha 2 ระดับ ขอบคมแบบพิกเซลอาร์ต
  used.add((r << 16) | (g << 8) | b);
}
const rel = `${section}/${name}.png`, dest = path.join(ROOT, 'public', 'pack', rel);
console.log(`ต้นฉบับ ${img.w}x${img.h} → ตัดขอบ ${cw}x${chh} → ${tw}x${th} ในกล่อง ${BW}x${BH} | สีที่ใช้ ${used.size}${pal ? ` (พาเลต ${pal.length} สี, เก็บเส้นเข้ม ${kept} px)` : ''}`);
if (scale < 0.5) console.log('เตือน: ย่อลงมากกว่าครึ่ง รายละเอียดอาจหาย ลองสั่ง PixelLab ให้สร้างขนาดใกล้ปลายทางแทน');
if (flag('--dry')) process.exit(0);
writePNG(dest, BW, BH, out);
const mf = path.join(ROOT, 'public', 'pack', 'manifest.json');
const m = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : {};
m[section] = m[section] || {};
m[section][name] = { file: rel, w: BW, h: BH, source: path.basename(src), imported: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(mf, JSON.stringify(m, null, 2) + '\n');
console.log(`เขียน public/pack/${rel} และบันทึกใน manifest.json → ${section}.${name}`);
