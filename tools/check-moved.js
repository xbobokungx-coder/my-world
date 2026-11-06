// ตรวจว่าการย้ายเมธอดออกจาก class World ไม่ได้เขียนใหม่ (refactor 1.3a)
//   node tools/check-moved.js --snap <ไฟล์>   เขียน { ชื่อ: ข้อความเมธอด } ของทุกเมธอดบน World.prototype (รวม non-enumerable จาก mix)
//   node tools/check-moved.js --cmp <ไฟล์>    เทียบกับ snapshot: ชุดชื่อ + ข้อความต้องตรงเป๊ะ (exit 1 ถ้าต่าง)
// ถ้า snapshot ก่อนย้าย กับหลังย้าย+mix ตรงกัน = ย้ายแต่ที่อยู่ ไม่ได้แก้เนื้อโค้ด
const fs = require('fs');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-chkmoved-');
const { World } = require('../server.js');

function take() {
  const out = {};
  for (const name of Object.getOwnPropertyNames(World.prototype)) {
    if (name === 'constructor') continue;
    const d = Object.getOwnPropertyDescriptor(World.prototype, name);
    // getter/setter อ่านจาก descriptor (ห้ามเรียก getter) ส่วนที่ไม่ใช่ฟังก์ชันจดชนิดไว้
    if (typeof d.value === 'function') out[name] = d.value.toString();
    else if (d.get || d.set) out[name] = (d.get ? 'get:' + d.get.toString() : '') + (d.set ? '\nset:' + d.set.toString() : '');
    else out[name] = '[ไม่ใช่ฟังก์ชัน: ' + typeof d.value + ']';
  }
  return out;
}

const [mode, file] = process.argv.slice(2);
if ((mode !== '--snap' && mode !== '--cmp') || !file) { console.error('ใช้: node tools/check-moved.js --snap|--cmp <ไฟล์>'); process.exit(2); }
const now = take();
if (mode === '--snap') {
  fs.writeFileSync(file, JSON.stringify(now, null, 1));
  console.log(`snapshot ${Object.keys(now).length} เมธอด -> ${file}`);
  process.exit(0);
}
let old;
try { old = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('อ่าน snapshot ไม่ได้: ' + e.message); process.exit(2); }
let bad = 0;
for (const k of Object.keys(old)) if (!(k in now)) { bad++; console.log('หายไป: ' + k); }
for (const k of Object.keys(now)) if (!(k in old)) { bad++; console.log('เกินมา: ' + k); }
for (const k of Object.keys(old)) if (k in now && old[k] !== now[k]) {
  bad++;
  const a = old[k], b = now[k]; let i = 0; while (i < a.length && a[i] === b[i]) i++;
  console.log(`ข้อความต่าง: ${k} (ตำแหน่ง ${i}) เดิม ...${JSON.stringify(a.slice(i, i + 40))} ใหม่ ...${JSON.stringify(b.slice(i, i + 40))}`);
}
console.log(bad ? `ไม่ตรง ${bad} รายการ` : `ตรงเป๊ะ ${Object.keys(old).length} เมธอด`);
process.exit(bad ? 1 : 0);
