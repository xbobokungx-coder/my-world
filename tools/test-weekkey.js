// ทดสอบ weekKey/arcOf: wk คงในสัปดาห์เดียวกัน รีเซ็ตเมื่อข้ามวันจันทร์ (ใช้ Date ปลอม): node tools/test-weekkey.js
process.env.TZ = 'Asia/Bangkok';
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-weekkey-');
const RealDate = Date; let NOW = RealDate.UTC(2026, 10, 4, 3, 0, 0); // พุธ 4 พ.ย. 2026
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
  static now() { return NOW; }
}
global.Date = FakeDate;
const { World } = require('../server.js');
const w = new World('weekkey');
assert.strictEqual(typeof w.weekKey(), 'string', 'weekKey ต้องเป็นสตริง ISO ไม่ใช่ตัวเลข');
assert.ok(/^\d{4}-W\d+$/.test(w.weekKey()));
const rec = {};
const a = w.arcOf(rec); a.wk = 50;
NOW = RealDate.UTC(2026, 10, 8, 16, 0, 0); // อาทิตย์ 8 พ.ย. 23:00 ไทย (สัปดาห์เดิม)
assert.strictEqual(w.arcOf(rec).wk, 50, 'สัปดาห์เดียวกัน wk ต้องคงเดิม');
NOW = RealDate.UTC(2026, 10, 8, 17, 30, 0); // จันทร์ 9 พ.ย. 00:30 ไทย
assert.strictEqual(w.arcOf(rec).wk, 0, 'ข้ามวันจันทร์ wk ต้องรีเซ็ต');
assert.strictEqual(rec.arc.wkKey, w.weekKey());
console.log('weekkey ok');
process.exit(0);
