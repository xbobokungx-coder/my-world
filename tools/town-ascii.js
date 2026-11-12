// พิมพ์ผังเมือง ASCII x10–45 y8–35 (ใช้ดูผังก่อน/หลังแก้) • TOWN_RING_SHARED=<path> เลือกไฟล์ shared.js ได้เหมือนเทสต์
// . หญ้า  = ทาง  s ทราย  ~ น้ำ  # รั้ว  B อาคาร  $ เคาน์เตอร์  T ต้นไม้  L ตัวอื่น (หน้าผา บันได สะพาน ปากถ้ำ ฯลฯ)
const path = require('path');
const S = require(process.env.TOWN_RING_SHARED ? path.resolve(process.env.TOWN_RING_SHARED) : '../public/shared.js');
const { T } = S, m = S.makeMap();
const X0 = 10, X1 = 45, Y0 = 8, Y1 = 35;
const ch = t => t === T.GRASS ? '.' : t === T.PATH ? '=' : t === T.SAND ? 's' : t === T.WATER ? '~' : t === T.FENCE ? '#' : t === T.BUILD ? 'B' : t === T.SHOP ? '$' : t === T.TREE ? 'T' : 'L';
let tens = '   ', ones = '   ';
for (let x = X0; x <= X1; x++) { tens += x % 10 === 0 ? String(Math.floor(x / 10) % 10) : ' '; ones += x % 10; }
console.log(tens); console.log(ones);
for (let y = Y0; y <= Y1; y++) { let row = String(y).padStart(2) + ' '; for (let x = X0; x <= X1; x++) row += ch(m[y][x]); console.log(row); }
