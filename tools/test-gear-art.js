// ทดสอบภาพอุปกรณ์ 10 ระดับ (บัว/จอบ/ถัง/กระทะ): ทุกอีโมจิต้องมีไอคอนพิกเซลวาดมือ + HOE_PAL ครบ 10 + drawHeldTool ไม่โยน error ทุกระดับ
// รัน: node tools/test-gear-art.js [--sheet]   (--sheet = วาดภาพเทียบลง art/gear-art/ : icons.png ไอคอนทุกระดับ, held.png บัว/จอบในมือ)
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const { Canvas, png } = require('./canvasshim');
const ROOT = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, 'public', f), 'utf8');
const sb = { console, Math, Map, Set, Object, Array, document: { createElement: () => new Canvas(), body: {} }, performance: { now: () => 0 }, addEventListener() {}, MutationObserver: class { observe() {} } };
sb.window = sb; vm.createContext(sb);
for (const [f, g] of [['shared.js', ''], ['pixelart.js', 'PixelArt'], ['pixelui.js', 'PixelUI']]) vm.runInContext(rd(f) + (g ? `\n;this.${g}=${g};` : ''), sb);
const { Shared: S, PixelUI: UI } = sb;
const norm = e => e.replace(/️/g, '');
// (ก) ทุกอีโมจิของ 4 ชนิดมีภาพวาดมือ (ไม่ตกไปใช้อีโมจิระบบ)
const sets = { บัว: Object.values(S.CANS).map(c => c.emoji), จอบ: Object.values(S.HOE_EMOJI), ถัง: Object.values(S.PAIL_EMOJI), กระทะ: Object.values(S.PAN_EMOJI) };
for (const [k, list] of Object.entries(sets)) {
  assert.strictEqual(list.length, 10, k + ' ต้อง 10 ระดับ'); assert.strictEqual(new Set(list.map(norm)).size, 10, k + ' อีโมจิไม่ซ้ำ');
  for (const e of list) assert.ok(UI.HAND[norm(e)], `${k}: ${e} ไม่มีไอคอนพิกเซลวาดมือ`);
}
const all = Object.values(sets).flat().map(norm); assert.strictEqual(new Set(all).size, 40, 'อีโมจิข้ามชนิดต้องไม่ชนกัน');
for (const k of ['AXE_EMOJI', 'ROD_EMOJI', 'PICK_EMOJI']) for (const e of Object.values(S[k])) assert.ok(!all.includes(norm(e)), `${e} ชนกับ ${k}`);
// (ข) HOE_PAL / HOE_H ครบ 10 และแต่ละระดับสีหัวไม่ซ้ำ
const hk = Object.values(S.HOE_EMOJI);
for (const e of hk) { assert.ok(UI.HOE_PAL[e] && UI.HOE_PAL[e].length === 3, 'HOE_PAL ' + e); assert.ok(UI.HOE_H[e] && UI.HOE_H[e].length === 3, 'HOE_H ' + e); }
assert.strictEqual(Object.keys(UI.HOE_PAL).length, 10); assert.strictEqual(new Set(hk.map(e => UI.HOE_PAL[e][0])).size, 10, 'สีหัวจอบ 10 ระดับต้องต่างกัน');
// (ค) ไอคอนแต่ละระดับต้องต่างกันจริง (พิกเซลไม่เหมือนกัน) และไม่ว่าง
const px = e => Buffer.from(UI.icon(e).data).toString('hex');
for (const [k, list] of Object.entries(sets)) { const h = list.map(px); assert.strictEqual(new Set(h).size, 10, k + ' ไอคอน 10 ระดับต้องต่างกัน'); h.forEach((v, i) => assert.ok(/[1-9a-f]/.test(v.replace(/0/g, '')), `${k} ${i + 1} ว่าง`)); }
// (ง) drawHeldTool ไม่โยน error กับทุกระดับของบัว/จอบ (ดึงโค้ดจริงจาก game.js มารันกับ ctx จำลอง)
const g = rd('game.js'), a = g.indexOf('const CAN_HELD'), b = g.indexOf('function drawActionBurst');
const src = g.slice(a, b), mainCtx = null;
function heldRun(ctx, held, now, dir = 3) {
  const s2 = { console, Math, Map, Set, Object, performance: { now: () => now }, PixelUI: UI, PixelArt: sb.PixelArt, Shared: S, CANS: S.CANS, mainCtx: ctx, TS: 32,
    PixelAction: { frame: () => null, kindOf: e => e === '⛏' || hk.includes(e) ? 'mine' : '' } };
  vm.createContext(s2); vm.runInContext(src + '\n;this.run=drawHeldTool;', s2);
  s2.run({ held, dir, x: 0, y: 0, moving: false, sit: null, useAt: 0, anim: 0 }, now, ctx);
}
const rec = new Proxy({}, { get: (_, k) => k === 'save' || k === 'restore' || k === 'translate' || k === 'scale' || k === 'rotate' || k === 'fillRect' || k === 'beginPath' || k === 'moveTo' || k === 'lineTo' || k === 'stroke' ? () => {} : undefined, set: () => true });
for (const e of [...sets.บัว, ...sets.จอบ]) for (const now of [0, 300, 900]) heldRun(rec, e, now);
console.log('test-gear-art: ผ่านทั้งหมด (40 ไอคอน, HOE_PAL 10, ถือในมือ 20 ระดับ × 3 เวลา)');

if (process.argv.includes('--sheet')) {
  const out = path.join(ROOT, 'art/gear-art'); fs.mkdirSync(out, { recursive: true });
  const SC = 6, cell = 15 * SC, rows = [sets.บัว, sets.จอบ, sets.ถัง, sets.กระทะ];
  const sheet = new Canvas(cell * 10 + 8, cell * 4 + 8), sg = sheet.getContext('2d'); sg.fillStyle = '#d9cfa8'; sg.fillRect(0, 0, sheet.width, sheet.height);
  rows.forEach((l, ri) => l.forEach((e, ci) => { const ic = UI.icon(e); sg.drawImage(ic, 4 + ci * cell + 3 * SC / 2, 4 + ri * cell, ic.width * SC, ic.height * SC); }));
  fs.writeFileSync(path.join(out, 'icons.png'), png(sheet));
  // ในมือ: ตัวละครจำลอง = ก้อนผิวเบจ เพื่อดูสีเทียบ (ท่าตั้งตรง ไม่หมุน)
  const HS = 5, hw = 44 * HS, hh = 48 * HS, picks = [['🔔', '🔘', '🔛'], ['🔬', '🔰', '🔽']];
  const hs = new Canvas(hw * 3, hh * 2), hg = hs.getContext('2d'); hg.fillStyle = '#9ec08a'; hg.fillRect(0, 0, hs.width, hs.height);
  picks.forEach((row, ri) => row.forEach((e, ci) => {
    const c = new Canvas(44, 48), cg = c.getContext('2d'); cg.fillStyle = '#e8b890'; cg.fillRect(15, 14, 14, 24); cg.fillStyle = '#3498db'; cg.fillRect(15, 24, 14, 12);
    const sh = { save: () => cg.save(), restore: () => cg.restore(), translate: (x, y) => cg.translate(x, y), scale: (x, y) => cg.scale(x, y), rotate() {}, fillRect: (x, y, w, h) => cg.fillRect(x, y, w, h), set fillStyle(v) { cg.fillStyle = v; } };
    cg.translate(22, 26); heldRun(sh, e, 0); hg.drawImage(c, ci * hw, ri * hh, 44 * HS, 48 * HS);
  }));
  fs.writeFileSync(path.join(out, 'held.png'), png(hs));
  console.log('วาดภาพ: art/gear-art/icons.png, held.png');
}
