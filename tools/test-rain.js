// ทดสอบระบบฝน: node tools/test-rain.js
const assert = require('assert'), fs = require('fs'), path = require('path');
const dir = process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-rain-');
const S = require('../public/shared.js');
assert.deepStrictEqual(S.THEME_RAIN, ['auto', 'on', 'off']);
// ฤดูฝนรอบที่ 2 (n=1): เริ่ม epoch + 3.5 วัน
const L = S.SEASONS.days * 864e5, E = S.SEASONS.epoch, rs = E + L, R = S.RAIN;
assert.strictEqual(S.seasonAt(rs + 1).s.id, 'rain');
// deterministic: เรียกซ้ำเวลาเดิมได้ผลเดิม
for (let k = 0; k < 500; k++) { const t = E + k * 97e3; assert.strictEqual(S.rainAt(t, 'auto'), S.rainAt(t, 'auto')); }
// สัดส่วนเวลาฝนตกต่อฤดู (สุ่มตัวอย่างทุกฤดูในรอบ 3 ฤดู x 4 รอบ)
const frac = id => { let c = 0, n = 0; for (let r = 0; r < 4; r++) { const i = S.SEASONS.list.findIndex(x => x.id === id); const st = E + (r * 3 + i) * L; for (let k = 0; k < 3000; k++) { n++; if (S.rainAt(st + (k + 0.5) / 3000 * L, 'auto')) c++; } } return c / n; };
const fr = frac('rain'), fh = frac('hot'), fc = frac('cool');
assert.ok(fr > 0.30 && fr < 0.45, 'ฤดูฝน ' + fr); assert.ok(fh > 0.01 && fh < 0.06, 'ฤดูร้อน ' + fh); assert.strictEqual(fc, 0, 'ฤดูหนาวไม่ตก');
// ฝนไม่ข้ามช่อง และความยาวอยู่ในช่วง min-max (สแกนทีละ 10 วินาที)
for (const id of ['rain', 'hot']) {
  const cfg = R.season[id], i = S.SEASONS.list.findIndex(x => x.id === id), st = E + i * L; let run = 0, runs = 0;
  for (let t = st; t < st + L; t += 10e3) {
    if (S.rainAt(t, 'auto')) run += 10e3;
    else if (run) { runs++; assert.ok(run >= cfg.minMs - 10e3 && run <= cfg.maxMs + 10e3, id + ' ยาว ' + run); run = 0; }
    if (run && t % R.slotMs === 0 && t > st) assert.ok(false, 'ฝนข้ามช่อง');
  }
  assert.ok(runs > 5, id + ' มีฝนหลายครั้ง');
}
assert.strictEqual(S.rainAt(E - 1, 'auto'), false, 'ก่อนเริ่มฤดู');
assert.strictEqual(S.rainAt(E - 1, 'on'), true); assert.strictEqual(S.rainAt(rs + 1, 'off'), false);
assert.strictEqual(S.rainAt(E + 5 * L, 'xx') === S.rainAt(E + 5 * L, 'auto'), true, 'ค่าอื่น = auto');
// หาเวลาฝนตก/ไม่ตกจริงในฤดูฝน
let wet = 0, dry = 0; for (let t = rs; t < rs + L && !(wet && dry); t += 60e3) { if (S.rainAt(t, 'auto')) { if (!wet) wet = t; } else if (wet && !dry) dry = t; }
assert.ok(wet && dry);
let { World } = require('../server.js');
const sent = [];
const mk = (w, name, admin) => { const p = { name, key: name.toLowerCase(), id: name, admin, ws: { readyState: 1, send(s) { sent.push([name, JSON.parse(s)]); } }, rec: { inv: { coin: 1 }, skills: {} } }; w.players.set(name, p); return p; };
const w = new World('main'); const adm = mk(w, 'Sira', true), pl = mk(w, 'Joe', false);
assert.strictEqual(w.themeRain(), 'auto');
// สิทธิ์/ค่าผิด
assert.ok(w.adminSetRain(pl, 'on').err); assert.ok(!fs.existsSync(path.join(dir, 'theme.json')));
for (const bad of ['rain', '', 'ON', null, undefined, 1, {}, ['on'], '__proto__']) assert.ok(w.adminSetRain(adm, bad).err);
assert.strictEqual(w.themeRain(), 'auto');
// พืชโต: ฝนตก vs ไม่ตก
w.farm['1,1'] = { c: 'carrot', g: 0, m: 1 };
w.lastCrop = dry - 1000; w.cropTick(dry); assert.strictEqual(w.farm['1,1'].g, 0, 'ฝนหยุดไม่รดไม่โต');
assert.strictEqual(w.pub(w.farm['1,1'], dry).w, 0);
w.lastCrop = wet - 1000; w.cropTick(wet); assert.ok(w.farm['1,1'].g > 0, 'ฝนตกโตเอง');
assert.strictEqual(w.pub(w.farm['1,1'], wet).w, 1);
// ตั้ง off = ไม่โตแม้ในช่วงฝน
w.adminSetRain(adm, 'off'); const g0 = w.farm['1,1'].g; w.lastCrop = wet + 1000; w.cropTick(wet + 2000); assert.strictEqual(w.farm['1,1'].g, g0);
assert.strictEqual(w.pub(w.farm['1,1'], wet).w, 0);
// หลังฝนหยุด ดินยังเปียกต่อ RAIN.afterMs (เหมือนรดน้ำ) แล้วค่อยแห้ง (ปิดฝนด้วยมือก็เหมือนกัน)
w.adminSetRain(adm, 'auto'); w.rainEnd = 0; w.farm['2,2'] = { c: 'carrot', g: 0, m: 1 };
w.rainTick(wet); assert.strictEqual(w.rainEnd, wet);
w.adminSetRain(adm, 'off'); w.rainTick(wet + 1000);
assert.strictEqual(w.pub(w.farm['2,2'], wet + S.RAIN.afterMs - 1).w, 1, 'ฝนหยุดแล้วดินยังเปียก');
w.lastCrop = wet + 1000; w.cropTick(wet + 2000); assert.ok(w.farm['2,2'].g > 0, 'ช่วงเปียกหลังฝน พืชยังโต');
assert.strictEqual(w.pub(w.farm['2,2'], wet + S.RAIN.afterMs + 1).w, 0, 'พ้นเวลาแล้วแห้ง');
w.rainEnd = 0;
// ตั้ง on = ตกตลอด, broadcast รวม snow+rain
sent.length = 0; assert.deepStrictEqual(w.adminSetRain(adm, 'on', [w]), { rain: 'on' });
assert.deepStrictEqual(sent.filter(([k, m]) => k === 'Joe' && m.t === 'theme').map(([, m]) => m), [{ t: 'theme', snow: 'auto', rain: 'on' }]);
// ข้อความฝนเริ่ม/หยุด ไม่ซ้ำ
w.adminSetRain(adm, 'auto'); sent.length = 0;
w.rainTick(dry); w.rainTick(dry + 1000); w.rainTick(wet); w.rainTick(wet + 1000); w.rainTick(dry);
const msgs = sent.filter(([k, m]) => k === 'Joe' && m.t === 'msg').map(([, m]) => m.text);
assert.strictEqual(msgs.length, 2); assert.ok(/ฝนเริ่มตก/.test(msgs[0]) && /ฝนหยุด/.test(msgs[1]));
// รดน้ำตอนฝนตก: ไม่ให้ XP ไม่หักน้ำ
const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
assert.ok(/rainAt\(now, this\.themeRain\(\)\)\) return this\.toast\(p, '🌧️ ฝนตกอยู่/.test(src));
// บันทึก-โหลดกลับ + ไฟล์เก่าไม่มี rain = auto
const f = JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8')); assert.strictEqual(f.rain, 'auto'); assert.strictEqual(f.snow, 'auto');
const reload = () => { for (const k of Object.keys(require.cache)) if (/server\.js$|systems[\\/]theme\.js$/.test(k)) delete require.cache[k]; ({ World } = require('../server.js')); return new World('main'); };
w.adminSetRain(adm, 'on'); assert.strictEqual(reload().themeRain(), 'on');
fs.writeFileSync(path.join(dir, 'theme.json'), '{"snow":"on"}'); const w3 = reload(); assert.strictEqual(w3.themeRain(), 'auto'); assert.strictEqual(w3.themeSnow(), 'on');
fs.writeFileSync(path.join(dir, 'theme.json'), '{"rain":"monsoon"}'); assert.strictEqual(reload().themeRain(), 'auto');
console.log('ผ่าน: ฝน');
