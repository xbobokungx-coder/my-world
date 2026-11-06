'use strict';
// ต่อเมธอดจากไฟล์ระบบเข้า class (ใช้แทน Object.assign): ชื่อซ้ำ = โยน error, define แบบ non-enumerable เหมือนเมธอด class
function mix(Cls, mod) {
  const proto = Cls.prototype;
  for (const name of Object.getOwnPropertyNames(mod)) {
    if (Object.prototype.hasOwnProperty.call(proto, name)) throw new Error('mix: ชื่อซ้ำกับที่มีอยู่ใน ' + (Cls.name || 'class') + ': ' + name);
    const d = Object.getOwnPropertyDescriptor(mod, name);
    d.enumerable = false;
    Object.defineProperty(proto, name, d);
  }
  return Cls;
}
module.exports = { mix };
