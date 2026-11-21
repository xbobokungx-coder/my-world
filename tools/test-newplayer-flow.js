// เล่นจริงผ่านข้อความ: ผู้เล่นใหม่ (เหรียญเริ่มต้นเท่าที่เกมให้ ไม่เกิน 65) ทำคู่มือเริ่มต้น 6 ข้อครบโดยไม่ต้องเช่าแปลง
// + แปลงเช่ายังล็อกอยู่ และข้อความที่บอกมือใหม่ต้องชี้ไปแถวฟรี • รัน: node tools/test-newplayer-flow.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-newplayer-');
let NOW = Date.now(); Date.now = () => NOW;
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;
const w = new World('newplayer'); w.themeRain = () => 'off';
const ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } };
const p = w.join(ws, 'NewKid', '#fff').p;
const toasts = () => ws.msgs.filter(m => m.t === 'msg').map(m => m.text);
const act = (tool, tx, ty) => { NOW += 1000; w.handle(p, { t: 'act', tool, tx, ty }); };
const at = (x, y, dir) => { p.x = (x + 0.5) * TS; p.y = (y + 0.5) * TS; p.dir = dir; };
const done = () => w.starterOf(p).done;
assert.ok((p.rec.inv.coin || 0) <= 100, 'เริ่มจากเหรียญน้อย');
assert.ok((p.rec.inv.seed_carrot || 0) >= 1, 'ได้เมล็ดตั้งต้น');

// แปลงเช่าบนสุด: ขุดไม่ได้ ข้อความต้องบอกทางออก (ขุดฟรีแถวล่าง + ราคา + ที่เช่า)
ws.msgs.length = 0; at(5, 12, 1); act('hoe', 5, 12);
assert.ok(!w.farm['5,12'], 'แปลงเช่าว่างยังล็อก');
{ const t = toasts().pop() || ''; assert.ok(/แถวล่าง/.test(t) && t.includes(String(S.FARM_RENT.price)) && /ร้านเมล็ดพันธุ์/.test(t), 'ข้อความล็อกชี้ทางมือใหม่: ' + t); }
// เป้าลูกศรของข้อ dig/plant/water/harvest ต้องอยู่นอกแปลงเช่า และอยู่ในแปลงผัก
for (const id of ['dig', 'plant', 'water', 'harvest']) { const [x, y] = S.STARTER_GO[id]; assert.ok(!S.rentPlotAt(x, y) && S.inFarm(x, y), id + ' ลูกศรชี้แถวฟรี'); }

// 1) ขุด → 2) ปลูก → 3) รดน้ำ (ตักน้ำที่สระก่อน) → 4) เก็บเกี่ยว
const [gx, gy] = S.STARTER_GO.dig; at(gx, gy + 1, 1); act('hoe', gx, gy);
assert.ok(done().dig, 'ขุดดินในแปลงฟรีผ่านข้อ dig');
act('seed_carrot', gx, gy); assert.ok(done().plant, 'ปลูกผ่าน');
// ตักน้ำ: ยืนริมสระ
{ let spot = null; for (let y = 0; y < S.H && !spot; y++) for (let x = 0; x < S.W && !spot; x++) if (w.map[y][x] === S.T.WATER && y >= 14 && y <= 26 && x < 26) spot = [x, y]; assert.ok(spot, 'มีสระใกล้แปลง'); at(spot[0] + 1, spot[1], 2); act('water', spot[0], spot[1]); }
at(gx, gy + 1, 1); act('water', gx, gy); assert.ok(done().water, 'รดน้ำผ่าน');
w.farm[gx + ',' + gy].g = S.CROPS.carrot.time; act('hand', gx, gy); assert.ok(done().harvest, 'เก็บเกี่ยวผ่าน');
assert.ok((p.rec.inv.crop_carrot || 0) >= 1, 'ได้ผลผลิต');
// 5) ขายที่ร้านเมล็ดพันธุ์
{ const [cx, cy] = S.BUILDINGS.find(b => b.kind === 'farm').counter[0]; at(cx, cy, 0); const c0 = p.rec.inv.coin; w.handle(p, { t: 'sell', item: 'crop_carrot', n: 1 }); assert.ok(p.rec.inv.coin > c0, 'ขายได้เหรียญ'); assert.ok(done().sell, 'ขายผ่าน'); }
// 6) ตกปลา: โยนเบ็ดริมสระ แล้วชนะการชักเย่อ (ข้ามมินิเกม) ปลาตัวแรกเป็นตัวสวย
{ let spot = null; for (let y = 14; y < 30 && !spot; y++) for (let x = 2; x < 26 && !spot; x++) if (w.map[y][x] === S.T.WATER) spot = [x, y]; at(spot[0] + 1, spot[1], 2); act('rod', spot[0], spot[1]); assert.ok(p.fish, 'เหวี่ยงเบ็ดสำเร็จ (มีเหยื่อตั้งต้น)'); }
const koi = S.FISH.find(f => f.id === S.NEWBIE.firstFish); p.fish = null; w.landFish(p, koi, true, true, true);
assert.ok(done().fish, 'ตกปลาผ่านข้อ fish');
assert.ok(w.starterOf(p).final, 'ครบ 6 ข้อ ได้รางวัลใหญ่');
console.log('ผ่าน: ผู้เล่นใหม่ทำคู่มือเริ่มต้นครบด้วยเหรียญเริ่มต้น เหรียญตอนจบ ' + p.rec.inv.coin);
process.exit(0);
