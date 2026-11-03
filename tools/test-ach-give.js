// ทดสอบ: ตู้เซฟกองกลางถูกยกเลิก → ความสำเร็จสายลงขัน (give2k/10k/30k) ผ่านให้ทุกคนทันที ไม่ได้เหรียญ ไม่ลงข่าวเมือง
// รัน: node tools/test-ach-give.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-ach-'));
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('achtest');
const ids = S.ACH.filter(d => d.stat === 'give').map(d => d.id);
assert.deepStrictEqual(ids, ['give2k', 'give10k', 'give30k'], 'ยังมีความสำเร็จสายลงขัน 3 ข้อ');

// ผู้เล่นออฟไลน์ (เซฟเก่า ไม่เคยลงขัน): ตรวจแล้วผ่านทั้ง 3 ข้อ เหรียญไม่เพิ่ม
const rec = { inv: { coin: 5 }, ach: { cnt: {}, got: {} } }, logN = w.log.length;
w.achCheck(rec);
for (const id of ids) assert.ok(rec.ach.got[id], id + ' ผ่านแล้ว');
assert.strictEqual(rec.inv.coin, 5, 'ไม่แจกเหรียญ'); assert.strictEqual(w.log.length, logN, 'ไม่ลงข่าวเมืองซ้ำซ้อน');
// ที่เคยได้ไปแล้ว ไม่ถูกเขียนทับ
const t0 = 1700000000000, rec2 = { inv: { coin: 0 }, ach: { cnt: { give: 2500 }, got: { give2k: t0 } } }; w.achCheck(rec2);
assert.strictEqual(rec2.ach.got.give2k, t0, 'ข้อที่ได้แล้วคงเวลาเดิม'); assert.ok(rec2.ach.got.give10k && rec2.ach.got.give30k);

// ผู้เล่นที่เข้าเกม: ได้รับ toast บอกเหตุผล และฉายาใช้ได้
const ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } };
const p = w.join(ws, 'Giver', '#3498db', false).p;
for (const id of ids) assert.ok(p.rec.ach.got[id], 'ผู้เล่นใหม่ผ่าน ' + id);
assert.ok(ws.msgs.some(m => m.t === 'msg' && /ยกเลิกตู้เซฟ/.test(m.text)), 'แจ้งผู้เล่นเหตุผล');
console.log('ผ่าน: ความสำเร็จสายลงขันผ่านให้ทุกคน');
process.exit(0);
