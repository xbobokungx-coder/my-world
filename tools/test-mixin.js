// ทดสอบ server/mixin.js: node tools/test-mixin.js
const assert = require('assert');
const { mix } = require('../server/mixin.js');
class W { a() { return 1; } }
mix(W, { b() { return 2; }, get g() { return this._g || 7; }, set g(v) { this._g = v; } });
const w = new W();
assert.strictEqual(w.b(), 2, 'mix เพิ่มเมธอดได้');
assert.strictEqual(w.a(), 1, 'เมธอดเดิมยังอยู่');
assert.ok(!Object.keys(W.prototype).includes('b') && !Object.getOwnPropertyDescriptor(W.prototype, 'b').enumerable, 'ต้อง non-enumerable');
assert.strictEqual(w.g, 7); w.g = 9; assert.strictEqual(w.g, 9, 'getter/setter ใช้ได้');
assert.ok(!Object.getOwnPropertyDescriptor(W.prototype, 'g').enumerable);
assert.throws(() => mix(W, { a() {} }), /ชื่อซ้ำ/, 'ชื่อซ้ำโยน error');
assert.throws(() => mix(W, { b() {} }), /ชื่อซ้ำ/, 'ชื่อซ้ำกับที่ mix ไว้ก่อนก็โยน');
assert.strictEqual(w.a(), 1, 'ชื่อซ้ำแล้วของเดิมไม่ถูกทับ');
console.log('ok test-mixin');
