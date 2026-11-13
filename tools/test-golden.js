// Golden test: จับพฤติกรรมเกมที่เปลี่ยนโดยไม่ตั้งใจ (ใช้เป็นตาข่ายตอน refactor server.js)
// เล่นชุดข้อความตายตัวด้วยเวลา/สุ่มปลอม แล้วเทียบไฟล์เซฟที่ save(true) เขียนจริง + ข้อความที่ผู้เล่นได้รับ กับ tools/golden/expected.json
// รัน: node tools/test-golden.js • ตั้งใจเปลี่ยนกติกา: GOLDEN_UPDATE=1 node tools/test-golden.js (แล้วให้ code-reviewer ตรวจ diff ของ expected.json)
process.env.TZ = 'Asia/Bangkok'; // หวย/today() ใช้เวลาท้องถิ่น (ต้องตั้งก่อนมีการใช้ Date ครั้งแรก)
const fs = require('fs'), path = require('path'), assert = require('assert'), crypto = require('crypto');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-golden-');

// ---- สแตบ: เวลา / Math.random / crypto ก่อน require server.js ----
const RealDate = Date, T0 = RealDate.UTC(2026, 10, 6, 3, 0, 0); // 6 พ.ย. 2026 10:00 น. เวลาไทย
let NOW = T0;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
  static now() { return NOW; }
}
global.Date = FakeDate;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(20261106);
Math.random = rnd;
crypto.randomInt = (a, b) => { if (b === undefined) { b = a; a = 0; } return a + Math.floor(rnd() * (b - a)); };
crypto.randomBytes = n => Buffer.from(Array.from({ length: n }, () => Math.floor(rnd() * 256)));

const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;

// ---- โลก + ผู้เล่น 2 คน (ws ปลอม เก็บข้อความที่ได้รับ) ----
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('golden'), wa = mkWs(), wb = mkWs();
w.themeRain = () => 'off'; // golden ล็อกกติกาพื้นฐาน: ปิดฝน (T0 ตรงต้นรอบฝนของฤดูฝนพอดี) ฝนมีเทสต์ของตัวเอง tools/test-rain.js
const a = w.join(wa, 'alice', '#e74c3c').p, b = w.join(wb, 'bob', '#3498db').p;
let steps = 0;
function step(ms) { // เดินเวลาปลอมหนึ่งก้าว แล้วเรียกตัวเดินโลก
  NOW += ms; steps++;
  w.tick(ms / 1000, NOW); w.cropTick(NOW);
  if (steps % 8 === 0) w.oreTick(NOW);
  if (steps % 100 === 0) w.marketTick(NOW);
}
function adv(ms, unit = 600) { for (let left = ms; left > 0; left -= unit) step(Math.min(unit, left)); }
const ctr = (x, y) => [(x + 0.5) * TS, (y + 0.5) * TS];
const at = (p, x, y, dir) => { [p.x, p.y] = ctr(x, y); p.dir = dir; };
const act = (p, tool, tx, ty, extra) => { adv(200); w.handle(p, Object.assign({ t: 'act', tool, tx, ty }, extra)); };

// ---- ชุดข้อความตายตัว ----
// เดิน (ก้าวละไม่เกิน 60 px) + แชท
at(a, 10, 21, 0); at(b, 12, 21, 0);
for (let i = 0; i < 5; i++) { adv(600); w.handle(a, { t: 'm', x: a.x, y: a.y + 12, d: 0 }); w.handle(b, { t: 'm', x: b.x - 10, y: b.y, d: 2 }); }
adv(600); w.handle(a, { t: 'chat', text: 'สวัสดี' });

// ไถ รดน้ำ ปลูก (alice ช่อง 6,16 / bob ช่อง 8,14; แถว y 11-13 เป็นแปลงเช่า ล็อกอยู่) แล้วรอโตและเก็บเกี่ยว
Object.assign(a.rec.inv, { coin: 500, seed_carrot: 5 }); Object.assign(b.rec.inv, { coin: 300, seed_carrot: 3 });
a.rec.hunger = b.rec.hunger = 100;
at(a, 6, 17, 1); at(b, 8, 15, 1);
act(a, 'hoe', 6, 16); act(b, 'hoe', 8, 14);
at(a, 10, 22, 0); act(a, 'water', 10, 23); // ตักน้ำจากสระ
at(a, 6, 17, 1); act(a, 'seed_carrot', 6, 16); act(a, 'water', 6, 16);
act(b, 'seed_carrot', 8, 14); at(b, 10, 22, 0); act(b, 'water', 10, 23); at(b, 8, 15, 1); act(b, 'water', 8, 14);
for (let i = 0; i < 400; i++) { // รอพืชสุก (รดน้ำซ้ำเมื่อแห้ง)
  adv(600);
  for (const [p, k] of [[a, '6,16'], [b, '8,14']]) { const t = w.farm[k]; if (t && t.c && S.cropStage(t) < 3 && !(t.wu > NOW + 5000)) { at(p, +k.split(',')[0], +k.split(',')[1] + 1, 1); act(p, 'water', +k.split(',')[0], +k.split(',')[1]); } }
  if (w.farm['6,16'] && S.cropStage(w.farm['6,16']) === 3 && w.farm['8,14'] && S.cropStage(w.farm['8,14']) === 3) break;
}
at(a, 6, 17, 1); act(a, 'hand', 6, 16); at(b, 8, 15, 1); act(b, 'hand', 8, 14);

// ตกปลา (alice ริมสระ): โยน → รอปลากิน → ชักเย่อทันทีจนจบ (ลองซ้ำได้ 4 รอบ)
Object.assign(a.rec.inv, { rod_1: 1, bait: 8 });
at(a, 10, 22, 0);
for (let round = 0; round < 4; round++) {
  act(a, 'rod', 10, 23, { bait: 'bait' });
  for (let i = 0; i < 400 && a.fish && a.fish.st === 'wait'; i++) adv(600);
  let hold = false;
  for (let i = 0; i < 600 && a.fish && a.fish.st === 'fight'; i++) {
    const want = hold ? a.fish.ft.ten < 70 : a.fish.ft.ten < 50;
    if (want !== hold) { hold = want; w.handle(a, { t: 'reel', on: hold }); }
    adv(100, 100);
  }
  adv(600);
}

// ซื้อ-ขาย (ยืนที่เคาน์เตอร์ร้านเมล็ด/ร้านตกปลา)
const bld = k => S.BUILDINGS.find(x => x.kind === k).counter[0];
{ const [cx, cy] = bld('farm'); at(a, cx, cy, 0); at(b, cx, cy, 0); }
adv(600); w.handle(a, { t: 'buy', item: 'seed_carrot', n: 3 }); w.handle(b, { t: 'buy', item: 'seed_carrot', n: 2 });
adv(600); w.handle(a, { t: 'sell', item: 'crop_carrot', n: 'all' });
{ const [cx, cy] = bld('fish'); at(a, cx, cy, 0); }
adv(600); w.handle(a, { t: 'buy', item: 'bait', n: 5 });
for (const k of Object.keys(a.rec.inv)) if (k.startsWith('fish_')) { adv(600); w.handle(a, { t: 'sell', item: k, n: 'all' }); }

// ซื้อหวย (alice ที่ตู้ Lucky Lotto) แล้วเดินเวลาผ่านไปอีกหน่อย
a.rec.skills = { farm: 200, fish: 200, animal: 200, wood: 200, cook: 200, mine: 0 }; a.rec.starter = { done: {}, final: true }; // ผ่านเงื่อนไขซื้อหวย
at(a, S.LUCKY.x, S.LUCKY.y, 0);
adv(600); w.handle(a, { t: 'lotto', a: 'buy', nums: ['123', '456', null] });

// bob: เข้าบ้านตัวเอง วางของ แล้วหมุน/ย้าย
Object.assign(b.rec.inv, { furn_chair: 2, furn_table: 1 });
adv(600); w.handle(b, { t: 'house', a: 'enter' });
b.x = 28 * TS; b.y = 25 * TS;
adv(600); w.handle(b, { t: 'house', a: 'place', f: 'table', x: 26, y: 20, r: 0 });
adv(600); w.handle(b, { t: 'house', a: 'place', f: 'chair', x: 24.5, y: 20.25, r: 0 });
{ const ids = Object.keys(w.houses.bob.items); if (ids[0] != null) { adv(600); w.handle(b, { t: 'house', a: 'rot', i: +ids[0] }); } }

// ขุดแร่ (alice ในถ้ำชั้น 1): ฟาดก้อนแรกจนแตก
{ const F = w.floorOf(1), spot = [...F.ores.keys()][0].split(',').map(Number);
  Object.assign(a.rec.inv, { pick_3: 1 }); a.rec.dur = {}; a.rec.skills.mine = 5000;
  adv(600); a.scene = '@cave1'; at(a, spot[0], spot[1] + 1, 1);
  for (let i = 0; i < 200 && F.ores.has(spot.join(',')); i++) { a.lastAct = a.hitAt = 0; act(a, 'pick', spot[0], spot[1]); adv(600); } }

adv(30000); // ปล่อยโลกเดินต่อ (หวย ตลาด ความหิว ฯลฯ)

// ---- เก็บผล: ไฟล์เซฟจริง + ข้อความที่ผู้เล่นได้รับ ----
w.dirty = true; w.save(true);
const BULK = new Set(['init', 's', 'scene']); // ข้อความก้อนใหญ่/ถี่: เก็บเป็นจำนวน + แฮช
const digest = ws => {
  const out = { msgs: [], bulk: {} };
  for (const m of ws.msgs) {
    if (BULK.has(m.t)) { const o = out.bulk[m.t] || (out.bulk[m.t] = { n: 0, h: crypto.createHash('sha1') }); o.n++; o.h.update(JSON.stringify(m)); }
    else out.msgs.push(m);
  }
  for (const k of Object.keys(out.bulk)) out.bulk[k] = { n: out.bulk[k].n, sha1: out.bulk[k].h.digest('hex') };
  return out;
};
const actual = JSON.parse(JSON.stringify({ save: JSON.parse(fs.readFileSync(w.file, 'utf8')), alice: digest(wa), bob: digest(wb) }));

// ---- เทียบกับ expected ----
const EXP = path.join(__dirname, 'golden', 'expected.json');
if (process.env.GOLDEN_UPDATE) {
  fs.mkdirSync(path.dirname(EXP), { recursive: true }); fs.writeFileSync(EXP, JSON.stringify(actual, null, 1) + '\n');
  console.log('GOLDEN_UPDATE: เขียน ' + EXP + ' ใหม่แล้ว (' + fs.statSync(EXP).size + ' bytes)'); process.exit(0);
}
const expected = JSON.parse(fs.readFileSync(EXP, 'utf8'));
function firstDiff(x, y, p) {
  if (x === y) return null;
  if (typeof x !== typeof y || x === null || y === null || typeof x !== 'object' || Array.isArray(x) !== Array.isArray(y)) return `${p || '(root)'}: expected ${JSON.stringify(x)} but got ${JSON.stringify(y)}`;
  const ks = [...new Set([...Object.keys(x), ...Object.keys(y)])];
  for (const k of ks) {
    if (!(k in x)) return `${p}.${k}: ไม่มีใน expected แต่ได้ ${JSON.stringify(y[k]).slice(0, 200)}`;
    if (!(k in y)) return `${p}.${k}: มีใน expected (${JSON.stringify(x[k]).slice(0, 200)}) แต่ไม่ได้ค่านี้`;
    const d = firstDiff(x[k], y[k], p + (Array.isArray(x) ? `[${k}]` : '.' + k)); if (d) return d;
  }
  return null;
}
const d = firstDiff(expected, actual, '');
if (d) { console.error('FAIL golden: พฤติกรรมเกมต่างจาก expected ที่ path แรก\n  ' + d.slice(0, 600) + '\n(ถ้าตั้งใจเปลี่ยนกติกา: GOLDEN_UPDATE=1 node tools/test-golden.js แล้วให้ code-reviewer ตรวจ diff)'); process.exit(1); }
console.log('golden: ผ่าน (save ' + Object.keys(actual.save).length + ' คีย์, ข้อความ alice ' + actual.alice.msgs.length + ' bob ' + actual.bob.msgs.length + ')');
process.exit(0);
