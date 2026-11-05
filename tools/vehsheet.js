// ดึงสไปรต์ชีตท่าขับขี่ยานพาหนะ (จักรยาน มอเตอร์ไซค์ รถยนต์) ออกเป็นไฟล์ PNG โดยไม่ต้องเปิดเบราว์เซอร์
// ใช้โค้ดวาดตัวจริงจาก public/pixelart.js + public/pixelchar.js ผ่าน canvas จำลองเล็กๆ (ไม่มี dependency เพิ่ม)
// รัน: node tools/vehsheet.js [โฟลเดอร์ปลายทาง]   (ค่าเริ่มต้น sprites/vehicles)
// ได้ไฟล์:
//   vehicles-riding.png          ชีตรวม แถว = ยานพาหนะ × ทิศ (ขวา ซ้าย ลง ขึ้น) คอลัมน์ = จอด + เฟรมแล่น 0–3 (มีผู้ขี่ เงา ควัน)
//   <ยาน>-<ทิศ>-<idle|f0..f3>.png แต่ละเฟรมแยกไฟล์ (ขนาดเกมจริง ×2)
//   boat-sheet.png / boat-<ทิศ>-<idle|f0..f3>.png  เรือ (ทะเลใหญ่) ใช้โค้ด drawBoat จริง วาดบนพื้นน้ำ/โปร่งใส (ผู้เล่นถูกวาดทับในเกม ไม่ติดมา)\n//   <ยาน>-layers.png             ชั้นดิบของสไปรต์ (หลัง/หน้า แยกกัน) ขนาดพิกเซลศิลป์ 1:1 ไว้แก้ลายเส้น
const fs = require('fs'), path = require('path'), vm = require('vm');
const { Canvas, png } = require('./canvasshim');
const ROOT = path.join(__dirname, '..'), OUT = path.resolve(process.argv[2] || path.join(ROOT, 'sprites/vehicles'));

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
// 3) เรือ: ดึงฟังก์ชัน drawBoat จริงจาก game.js (วาดด้วยเวกเตอร์ ไม่ใช่สไปรต์) มาเรนเดอร์ตามทิศ × จอด/แล่น × 4 เฟรมคลื่น
const gsrc = fs.readFileSync(path.join(ROOT, 'public/game.js'), 'utf8'), bm = gsrc.match(/function drawBoat\(p, now\) \{[\s\S]*?\n\}\n/);
if (bm) {
  const BW = 140, BH = 140, SEA = '#3d8fd1', SEA2 = '#378ac9', BCOLS = [['idle', null], ['f0', 0], ['f1', 1], ['f2', 2], ['f3', 3]];
  const bsb = { Math, ctx: null }; vm.createContext(bsb); vm.runInContext(bm[0] + '\nthis.drawBoat = drawBoat;', bsb);
  const bcell = (dir, fr, bg) => {
    const c = new Canvas(BW, BH), g = c.getContext('2d'); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, BW, BH); }
    bsb.ctx = g; const now = fr === null ? 9000 : 1000 + fr * 70, p = { id: 1, x: BW / 2, y: BH / 2 - 6, dir, _lx: BW / 2 - (fr === null ? 0 : 1), _ly: BH / 2 - 6 };
    if (fr !== null) p._mvAt = now; bsb.drawBoat(p, now); return c;
  };
  const bs = new Canvas(BW * BCOLS.length, HEAD + BH * DIRS.length), bg2 = bs.getContext('2d');
  bg2.fillStyle = '#4d5260'; bg2.fillRect(0, 0, bs.width, HEAD);
  DIRS.forEach(([dir, dn], di) => BCOLS.forEach(([cn, fr], ci) => { bg2.drawImage(bcell(dir, fr, di & 1 ? SEA2 : SEA), ci * BW, HEAD + di * BH); write(`boat-${dn}-${cn}.png`, bcell(dir, fr, null)); }));
  BCOLS.forEach((_, ci) => { bg2.fillStyle = ci ? '#5dade2' : '#aab2bd'; bg2.fillRect(ci * BW + 2, 4, ci ? 8 + ci * 6 : 8, 6); });
  write('boat-sheet.png', bs);
}
// 4) ชั้นแยกเฟรม 1:1 (ไฟล์ที่ผู้ดูแลแก้แล้วส่งกลับ): layers/<ยาน>-<ทิศ>-<back|front>-<idle|f0..f3>.png • ซ้ายคือภาพขวาพลิก จึงมีเฉพาะ right/down/up
fs.mkdirSync(path.join(OUT, 'layers'), { recursive: true });
const meta = { note: 'ชุดยานพาหนะ My World: 1 พิกเซลภาพ = 2 พิกเซลเกม • สไปรต์มีขอบใส 1 พิกเซลรอบด้าน • ax,ay = จุดสัมผัสพื้นกลางตัวรถ • seat = สะโพกผู้ขี่ (พิกเซลภาพ ไม่รวมขอบ) • ทิศซ้าย = พลิกภาพขวา', speedMul: {}, vehicles: {} };
for (const kind of KINDS) {
  meta.speedMul[kind] = Shared.VEHICLES[kind].speed; meta.vehicles[kind] = { name: Shared.VEHICLES[kind].name, price: Shared.VEHICLES[kind].price, dirs: {} };
  for (const [dir, dn] of [[3, 'right'], [0, 'down'], [1, 'up']]) {
    const v0 = PixelVehicle.sprite(kind, dir, 0, rider.pc, false, rider.color);
    meta.vehicles[kind].dirs[dn] = { size: [v0.back.width, v0.back.height], ax: v0.ax, ay: v0.ay, seat: v0.seat, lift: v0.lift, puff: v0.puff || null, frames: ['idle', 'f0', 'f1', 'f2', 'f3'] };
    for (const layer of ['back', 'front']) [null, 0, 1, 2, 3].forEach(fr => { const sp = PixelVehicle.sprite(kind, dir, fr ?? 0, rider.pc, fr === null, rider.color)[layer]; fs.writeFileSync(path.join(OUT, 'layers', `${kind}-${dn}-${layer}-${fr === null ? 'idle' : 'f' + fr}.png`), png(sp)); files++; });
  }
}
fs.writeFileSync(path.join(OUT, 'vehicle-kit.json'), JSON.stringify(meta, null, 1));
console.log(`เขียน ${files} ไฟล์ที่ ${path.relative(ROOT, OUT) || OUT}`);
