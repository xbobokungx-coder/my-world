// ดึงสไปรต์ชีตตัวละครผู้เล่น (ชุดเสื้อผ้า/กางเกง/หมวก/ของเสริมทุกแบบ + ชาวเมือง NPC) ออกเป็น PNG พร้อม manifest สำหรับส่งไปปรับปรุงภาพ
// ใช้โค้ดวาดตัวจริงจาก public/pixelart.js + public/pixelchar.js ผ่าน canvas จำลอง (tools/canvasshim.js) ไม่มี dependency เพิ่ม
// รัน: node tools/charsheet.js [โฟลเดอร์ปลายทาง]   (ค่าเริ่มต้น sprites/characters)
// ได้ไฟล์:
//   player-base.png                ชุดเริ่มต้น แถว = ทิศ (ลง ขึ้น ซ้าย ขวา) คอลัมน์ = ยืน เดินเฟรม 1 เดินเฟรม 2 นั่ง
//   wardrobe-<shirt|pants|hat|acc>.png  แถว = ชิ้นในหมวด (ที่เหลือใส่ชุดเริ่มต้น) คอลัมน์ = ลง ขึ้น ขวา(ยืน) ขวา(เดิน1) ขวา(เดิน2) ลง(นั่ง)
//   acc-wings-flap.png             ปีกกระพือ 3 ท่า × ลง/ขึ้น • npc.png ชาวเมือง NPC • frames/ ชุดเริ่มต้นแยกเฟรม
//   character-kit.json             ขนาด/จุดยึด/ลำดับแถว-คอลัมน์/รายการชุด/สี (ใช้อ้างอิงตอนวาดส่งกลับ)
// ภาพทุกไฟล์เป็นพิกเซลศิลป์จริง (1 พิกเซลภาพ = 2 พิกเซลเกม) พื้นโปร่งใส เซลล์ละ 26×32 • ซ้ายคือภาพขวาที่พลิกกลับ (เกมไม่เก็บภาพซ้ายแยก)
const fs = require('fs'), path = require('path'), vm = require('vm');
const { Canvas, png } = require('./canvasshim');
const ROOT = path.join(__dirname, '..'), OUT = path.resolve(process.argv[2] || path.join(ROOT, 'sprites/characters'));

const sandbox = { console, Math, Map, Set, document: { createElement: () => new Canvas() }, performance: { now: () => 0 } };
sandbox.window = sandbox; vm.createContext(sandbox);
for (const f of ['shared.js', 'pixelart.js', 'pixelchar.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', f), 'utf8') + (f === 'shared.js' ? '' : `\n;this.${f === 'pixelart.js' ? 'PixelArt = PixelArt' : 'PixelChar = PixelChar'};`), sandbox, { filename: f });
const { PixelChar, Shared } = sandbox;
const PALETTE = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/game.js'), 'utf8').match(/const PALETTE = (\[.*?\]);/)[1].replace(/'/g, '"')); // สีเสื้อ/หมวกที่ผู้เล่นเลือกได้ (อยู่ใน game.js)
const nm = vm.runInContext(fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8').match(/\nconst NPC_DEFS = \[[\s\S]*?\n\];/)[0].replace('\nconst NPC_DEFS =', '(').replace(/;$/, ')'), sandbox); // ชาวเมืองอยู่ใน server.js (ไม่ได้ export) ดึงเฉพาะอาร์เรย์

// PixelChar.draw วาดสไปรต์ที่แคชไว้ผ่าน drawImage: ดักภาพนั้นตรงๆ ได้พิกเซลศิลป์ 1:1 (ไม่ผ่านการขยาย 2 เท่า/เอฟเฟกต์แสงหมวกคนงานเหมือง)
const grab = (p, now = 0) => { let img = null; const g = { imageSmoothingEnabled: false, globalAlpha: 1, save() {}, restore() {}, translate() {}, scale() {}, fillRect() {}, drawImage(i) { img = i; } }; PixelChar.draw(g, p, now); return img; };
const DIR = { down: [0], up: [1], left: [2], right: [3] }; // dir ในเกม
const WALK1 = .112, WALK2 = .337; // anim ที่ได้เฟรมเดิน 1/2 (sin(anim×14) > .35 / < −.35)
const base = { color: '#3498db', hat: '#e8c66a', pc: Shared.PANTS_COLOR, wear: {}, moving: false, sit: false, anim: 0 };
const pose = { idle: {}, walk1: { moving: true, anim: WALK1 }, walk2: { moving: true, anim: WALK2 }, sit: { sit: true } };
const flip = c => { const o = new Canvas(c.width, c.height); for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) o.data.set(c.data.subarray((y * c.width + x) * 4, (y * c.width + x) * 4 + 4), (y * c.width + c.width - 1 - x) * 4); return o; };
const sprite = (o, dir, ps, now) => { const s = grab(Object.assign({}, base, o, { dir: DIR[dir][0] }, pose[ps]), now); return dir === 'left' ? flip(s) : s; }; // เกมเก็บภาพขวาอย่างเดียว ซ้ายคือพลิก

const first = sprite({}, 'down', 'idle'), CW = first.width, CH = first.height; // 26×32 (สไปรต์ 24×30 + ขอบใส 1 พิกเซล)
const sheet = (rows, cols, fn) => { // rows × cols เซลล์ พื้นโปร่งใส
  const c = new Canvas(CW * cols.length, CH * rows.length), g = c.getContext('2d');
  rows.forEach((r, ri) => cols.forEach((cl, ci) => { const s = fn(r, cl); if (s) g.drawImage(s, ci * CW, ri * CH); })); return c;
};
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
let files = 0; const write = (name, c) => { fs.writeFileSync(path.join(OUT, name), png(c)); files++; };
const kit = { note: 'ตัวละคร My World (chibi พิกเซล): 1 พิกเซลภาพ = 2 พิกเซลเกม • เซลล์ 26×32 (สไปรต์ 24×30 + ขอบใส 1 พิกเซลรอบด้าน) • ซ้ายคือภาพขวาที่พลิกกลับ (เกมวาดตัวละครจากโค้ด ส่งภาพที่แก้แล้วกลับมาเพื่อให้ผู้ดูแลต่อเข้าโค้ด)', cell: [CW, CH], art: { w: 24, h: 30, cx: 12, feetRow: 29, headTopRow: 14, hair: 'หัวกว้างกว่าสูง ตาใหญ่' }, defaults: Shared.WEAR_DEFAULT, base: { shirtColor: base.color, hatColor: base.hat, pantsColor: base.pc }, palette: PALETTE, hatColors: ['#e8c66a'].concat(PALETTE), sheets: {} };

// 1) ชุดเริ่มต้น: ทิศ × ท่า
const DIRS = ['down', 'up', 'left', 'right'], POSES = ['idle', 'walk1', 'walk2', 'sit'];
write('player-base.png', sheet(DIRS, POSES, (d, ps) => sprite({}, d, ps)));
kit.sheets['player-base.png'] = { rows: DIRS, cols: POSES };
for (const d of DIRS) for (const ps of POSES) write(`frames/base-${d}-${ps}.png`, sheet([d], [ps], (r, c) => sprite({}, r, c)));

// 2) คลังชุด: ทีละหมวด
const VIEWS = [['down', 'idle'], ['up', 'idle'], ['right', 'idle'], ['right', 'walk1'], ['right', 'walk2'], ['down', 'sit']], VCOLS = VIEWS.map(([d, p]) => `${d}-${p}`);
kit.wardrobe = {};
for (const cat of Object.keys(Shared.WEAR)) {
  const items = Shared.WEAR[cat]; kit.wardrobe[cat] = items.map(i => ({ id: i.id, name: i.name, price: i.price }));
  write(`wardrobe-${cat}.png`, sheet(items, VIEWS, (it, [d, p]) => sprite({ wear: { [cat]: it.id } }, d, p)));
  kit.sheets[`wardrobe-${cat}.png`] = { rows: items.map(i => i.id), cols: VCOLS, category: Shared.WEAR_CATS[cat].name };
}
// ปีกกระพือ: ท่าเฟรม = round(1 + sin(now/170) × แอมพลิจูด) ดักค่า 0/1/2 ด้วยเวลาที่เลือกไว้
const FLAP = [['flap0', -267], ['flap1', 0], ['flap2', 267]];
write('acc-wings-flap.png', sheet(['down', 'up'], FLAP, (d, [, now]) => sprite({ wear: { acc: 'wings' } }, d, 'walk1', now)));
kit.sheets['acc-wings-flap.png'] = { rows: ['down', 'up'], cols: FLAP.map(f => f[0]) };

// 3) ชาวเมือง NPC (ชุด/สีกำหนดตายตัวใน server.js NPC_DEFS)
write('npc.png', sheet(nm, VIEWS, (n, [d, p]) => sprite({ color: n.color, hat: n.hat, pc: n.pc, wear: n.wear }, d, p)));
kit.sheets['npc.png'] = { rows: nm.map(n => n.name), cols: VCOLS };
kit.npcs = nm.map(n => ({ name: n.name, title: n.title, color: n.color, hat: n.hat, pc: n.pc, wear: Object.assign({}, Shared.WEAR_DEFAULT, n.wear) }));

fs.writeFileSync(path.join(OUT, 'character-kit.json'), JSON.stringify(kit, null, 1)); files++;
console.log(`เขียน ${files} ไฟล์ที่ ${path.relative(ROOT, OUT) || OUT}`);
