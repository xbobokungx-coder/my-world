// ทดสอบธีมหิมะที่ผู้ดูแลตั้ง: node tools/test-theme.js
const assert = require('assert'), fs = require('fs'), path = require('path');
const dir = process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-theme-');
const S = require('../public/shared.js');
assert.deepStrictEqual(S.THEME_SNOW, ['auto', 'on', 'off']);
let { World } = require('../server.js');
const sent = [];
const mk = (w, name, admin) => { const p = { name, key: name.toLowerCase(), id: name, admin, ws: { readyState: 1, send(s) { sent.push([name, JSON.parse(s)]); } }, rec: { inv: { coin: 1 }, skills: {} } }; w.players.set(name, p); return p; };
const themes = n => sent.filter(([k, m]) => k === n && m.t === 'theme').map(([, m]) => m.snow);
let w = new World('main'); const adm = mk(w, 'Sira', true), pl = mk(w, 'Joe', false);
assert.strictEqual(w.themeSnow(), 'auto', 'ค่าเริ่มต้น auto');
// ผู้เล่นทั่วไปตั้งไม่ได้
assert.ok(w.adminSetSnow(pl, 'on').err); assert.strictEqual(w.themeSnow(), 'auto'); assert.ok(!fs.existsSync(path.join(dir, 'theme.json')));
// ค่าผิดถูกปฏิเสธ
for (const bad of ['snow', '', 'ON', null, undefined, 1, {}, ['on'], '__proto__']) assert.ok(w.adminSetSnow(adm, bad).err, 'ต้องปฏิเสธ ' + String(bad));
assert.strictEqual(w.themeSnow(), 'auto');
// ผู้ดูแลตั้งได้ + broadcast ถึงทุกคน (รวมห้องอื่น)
const w2 = new World('other'); const far = mk(w2, 'Far', false);
assert.deepStrictEqual(w.adminSetSnow(adm, 'on', [w, w2]), { snow: 'on' });
assert.deepStrictEqual(themes('Joe'), ['on']); assert.deepStrictEqual(themes('Far'), ['on']); assert.deepStrictEqual(themes('Sira'), ['on']);
// ตั้งค่าเดิมซ้ำไม่ broadcast ซ้ำ
w.adminSetSnow(adm, 'on', [w, w2]); assert.deepStrictEqual(themes('Joe'), ['on']);
// ผู้เล่นใหม่ได้ค่าปัจจุบัน
w.themeSend(pl); assert.deepStrictEqual(themes('Joe'), ['on', 'on']);
// บันทึกถาวร: โหลดกลับหลังรีสตาร์ต (ล้างแคชโมดูล)
const f = JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8')); assert.strictEqual(f.snow, 'on'); assert.ok(!('akey' in f));
for (const k of Object.keys(require.cache)) if (/server\.js$|systems[\\/]theme\.js$/.test(k)) delete require.cache[k];
({ World } = require('../server.js')); w = new World('main');
assert.strictEqual(w.themeSnow(), 'on', 'หลังรีสตาร์ตยังเป็น on');
w.adminSetSnow({ name: 'Sira', admin: true }, 'off'); assert.strictEqual(w.themeSnow(), 'off');
// ไฟล์เสีย/ค่าแปลก = auto
fs.writeFileSync(path.join(dir, 'theme.json'), '{"snow":"blizzard"}');
for (const k of Object.keys(require.cache)) if (/server\.js$|systems[\\/]theme\.js$/.test(k)) delete require.cache[k];
({ World } = require('../server.js')); assert.strictEqual(new World('main').themeSnow(), 'auto');
// ช่องทาง ws: ข้อความ admin ของผู้เล่นทั่วไปถูกทิ้ง (เช็ค player.admin ก่อน adminHandle)
assert.ok(/m\.t === 'admin'\) \{ if \(player\.admin\)/.test(fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8')));
console.log('ผ่าน: ธีมหิมะ');
