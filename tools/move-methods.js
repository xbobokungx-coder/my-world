// ย้ายเมธอดจาก class World ใน server.js ไปต่อท้ายไฟล์ระบบ (refactor 1.3a)
//   node tools/move-methods.js server/systems/xxx.js ชื่อเมธอด [ชื่อ…]
// - ตัดตั้งแต่หัวเมธอด (+คอมเมนต์ '  //' ที่ติดด้านบน) ถึงก่อนหัวถัดไป ใส่ ',' หลัง '}' ปิดเมธอด ต่อท้าย module.exports ของไฟล์เป้า
// - ชื่อไม่เจอ/เจอซ้ำ/โครงสร้างไม่ชัด = exit 1 โดยไม่แก้ไฟล์ใดเลย • ไฟล์เป้าไม่มี = สร้างให้
// - ไม่เรียก mix ให้ (เพิ่ม mix(World, require(...)) ใน server.js เอง)
// - พิมพ์ชื่อระดับบนสุดของ server.js ที่โค้ดที่ย้ายอ้างถึง ให้ไป require/ประกาศในไฟล์เป้า (ตรวจแบบกว้าง อาจเกินมาบ้าง แต่ไม่ตกหล่นเงียบ)
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const die = m => { console.error('ผิดพลาด: ' + m + ' (ยังไม่แก้ไฟล์ใดเลย)'); process.exit(1); };

const [targetArg, ...names] = process.argv.slice(2);
if (!targetArg || !names.length) { console.error('ใช้: node tools/move-methods.js <ไฟล์เป้า> ชื่อเมธอด…'); process.exit(2); }
if (new Set(names).size !== names.length) die('ระบุชื่อซ้ำในคำสั่ง');

const serverFile = path.join(ROOT, 'server.js');
const raw = fs.readFileSync(serverFile, 'utf8');
if (raw.includes('\r')) die('server.js มี CRLF ไม่รองรับ');
const src = raw.split('\n');

// regex หัวเมธอดชุดเดียวกับ tools/check-structure.js
const SKIP = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return']);
function headerName(line) {
  const m = /^  (static\s+|async\s+|get\s+|set\s+)*\*?([A-Za-z_$][\w$]*)\s*\(/.exec(line);
  if (!m || SKIP.has(m[2]) || !/^\s+(?:[^;=]|= Date\.now\(\))*\)\s*\{/.test(line)) return null;
  return m[2];
}

// หัวเมธอดแบบกว้าง (รวม default param '=') ใช้หาขอบเขตเท่านั้น
function broadName(line) {
  const m = /^  (?:static\s+|async\s+|get\s+|set\s+)*\*?([A-Za-z_$][\w$]*)\s*\(.*\)\s*\{/.exec(line);
  return m && !SKIP.has(m[1]) ? m[1] : null;
}

const start = src.findIndex(l => /^class World\b/.test(l));
if (start < 0) die('หา class World ไม่เจอ');
let end = src.findIndex((l, i) => i > start && l === '}');
if (end < 0) die('หาท้าย class World ไม่เจอ');

const heads = []; // [{name, line}] line = index
for (let i = start + 1; i < end; i++) { const n = broadName(src[i]); if (n) heads.push({ name: n, line: i, narrow: !!headerName(src[i]) }); }
// จุดเริ่มจริงของแต่ละหัว = รวมคอมเมนต์ '  //' ที่ติดด้านบน
for (let k = 0; k < heads.length; k++) {
  let s = heads[k].line;
  const floor = k ? heads[k - 1].line + 1 : start + 1;
  while (s - 1 >= floor && /^  \/\//.test(src[s - 1])) s--;
  heads[k].from = s;
}
for (let k = 0; k < heads.length; k++) heads[k].to = k + 1 < heads.length ? heads[k + 1].from : end; // exclusive

const picked = [];
for (const n of names) {
  const hit = heads.filter(h => h.name === n);
  if (!hit.length) die('ไม่เจอเมธอด ' + n + ' ใน class World');
  if (hit.length > 1) die('เจอเมธอดชื่อ ' + n + ' ซ้ำ ' + hit.length + ' ที่ (บรรทัด ' + hit.map(h => h.line + 1).join(', ') + ')');
  picked.push(hit[0]);
}

const blocks = [], cut = [];
for (const h of picked) {
  let a = h.from, b = h.to;
  while (b - 1 > h.line && src[b - 1].trim() === '') b--; // ตัดบรรทัดว่างท้ายบล็อก
  const body = src.slice(a, b);
  for (let i = h.line + 1; i < b; i++) if (broadName(src[i])) die(`เมธอด ${h.name}: เนื้อที่ตัดมีเมธอดอื่นปนอยู่ (server.js:${i + 1} ${broadName(src[i])})`);
  if (b - 1 > h.line) { // '}' ปิดของตัวเองที่เยื้อง 2 ช่อง ต้องเป็นบรรทัดสุดท้ายของบล็อกเท่านั้น
    const closes = []; for (let i = h.line + 1; i < b; i++) if (/^  \}/.test(src[i])) closes.push(i);
    if (closes.length !== 1 || closes[0] !== b - 1) die(`เมธอด ${h.name}: หา '}' ปิดของตัวเองที่เยื้อง 2 ช่องไม่ชัด (server.js:${h.line + 1}-${b})`);
  }
  const last = body[body.length - 1];
  if (!/\}(\s*\/\/.*)?$/.test(last)) die(`เมธอด ${h.name}: บรรทัดสุดท้ายของบล็อก (server.js:${b}) ไม่ใช่ '}' ปิดเมธอด`);
  if (b - 1 > h.line && !/^  \}/.test(last) && !/; \}(\s*\/\/.*)?$/.test(last)) die(`เมธอด ${h.name}: '}' ปิดเมธอดไม่เยื้อง 2 ช่องตามที่คาด (server.js:${b})`);
  if (b - 1 === h.line && !/^  /.test(last)) die(`เมธอด ${h.name}: รูปแบบบรรทัดเดียวไม่ตรงที่คาด`);
  if (/^\s*\/\//.test(last)) die(`เมธอด ${h.name}: บรรทัดสุดท้ายเป็นคอมเมนต์`);
  body[body.length - 1] = last.replace(/\}(\s*\/\/.*)?$/, (m, c) => '},' + (c || ''));
  blocks.push(body.join('\n'));
  cut.push([a, b]);
}
cut.sort((x, y) => x[0] - y[0]);
for (let i = 1; i < cut.length; i++) if (cut[i][0] < cut[i - 1][1]) die('ช่วงบรรทัดที่จะตัดทับกัน');

// ไฟล์เป้า
const target = path.resolve(process.cwd(), targetArg);
{
  let anc = target; while (!fs.existsSync(anc)) anc = path.dirname(anc); // รองรับ symlink เช่น /var -> /private/var
  const real = path.join(fs.realpathSync(anc), path.relative(anc, target)), rl = path.relative(fs.realpathSync(ROOT), real); if (rl === '' || rl.startsWith('..') || path.isAbsolute(rl)) die('ไฟล์เป้าต้องอยู่ใน repo');
}
let tsrc;
if (fs.existsSync(target)) {
  tsrc = fs.readFileSync(target, 'utf8');
  if (tsrc.includes('\r')) die('ไฟล์เป้ามี CRLF ไม่รองรับ');
  const tl = tsrc.split('\n');
  for (let i = 0; i < tl.length; i++) { const n = broadName(tl[i]); if (n && names.includes(n)) die('ไฟล์เป้ามีเมธอดชื่อ ' + n + ' อยู่แล้ว (บรรทัด ' + (i + 1) + ')'); }
  let e = tl.length - 1; while (e >= 0 && tl[e].trim() === '') e--;
  if (e < 0 || !/^\};?\s*$/.test(tl[e])) die("ท้ายไฟล์เป้าไม่ใช่ '};' ของ module.exports");
  let p = e - 1; while (p >= 0 && tl[p].trim() === '') p--;
  const prev = tl[p].replace(/\s*\/\/.*$/, '').trimEnd();
  if (!/[,{]$/.test(prev)) die("สมาชิกสุดท้ายในไฟล์เป้าไม่ลงท้ายด้วย ',' (บรรทัด " + (p + 1) + ')');
  tl.splice(e, 0, ...blocks.join('\n').split('\n'));
  tsrc = tl.join('\n');
} else {
  const rel = path.relative(ROOT, target);
  tsrc = "'use strict';\n// TODO: อธิบายระบบนี้ (ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() ดู server/mixin.js)\n// TODO: เพิ่ม require ตามรายการที่สคริปต์ย้ายพิมพ์ไว้ (" + rel + ")\n\nmodule.exports = {\n" + blocks.join('\n') + '\n};\n';
}

// ตรวจ syntax ก่อนเขียนจริง (ไฟล์เป้า และ server.js หลังตัด)
const keep = src.filter((_, i) => !cut.some(([a, b]) => i >= a && i < b));
for (const [label, code] of [['ไฟล์เป้า', tsrc], ['server.js หลังตัด', keep.join('\n')]]) {
  try { new vm.Script('(function (require, module, exports, __dirname, __filename) {' + code + '\n})', { filename: label }); } catch (e) { die(label + ' syntax ผิดหลังย้าย: ' + e.message); }
}

// ชื่อระดับบนสุดของ server.js ที่โค้ดที่ย้ายอ้างถึง
const top = new Set();
for (let i = 0; i < src.length; i++) {
  if (i > start && i <= end) continue; // ข้ามในตัว class
  const l = src[i];
  let m;
  if ((m = /^(?:async\s+)?(?:function\*?|class)\s+([A-Za-z_$][\w$]*)/.exec(l))) top.add(m[1]);
  else if ((m = /^(?:const|let|var)\s+(.*)$/.exec(l))) {
    const d = /^\s*[{[]/.test(m[1]);
    if (d) { // destructuring: เก็บ identifier ทั้งหมดก่อน '=' (ตัวที่ตามหลัง ':' คือชื่อจริง)
      const lhs = m[1].split('=')[0].replace(/[{}[\]]/g, '');
      for (const part of lhs.split(',')) { const id = part.split(':').pop().trim(); if (/^[A-Za-z_$][\w$]*$/.test(id)) top.add(id); }
    } else {
      const f = /^([A-Za-z_$][\w$]*)/.exec(m[1]); if (f) top.add(f[1]);
      // const a = 1, b = 2 บนบรรทัดเดียว (หยาบๆ: เก็บ ", ชื่อ =" ที่เห็น)
      for (const x of m[1].matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g)) top.add(x[1]);
    }
  }
}
const used = new Set();
for (const t of blocks.join('\n').matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)/g)) if (top.has(t[1])) used.add(t[1]);
const inTarget = new Set();
for (const l of tsrc.split('\n')) { const m = /^(?:const|let|var|function)\s+\{?\s*([A-Za-z_$][\w$]*)/.exec(l); if (m) inTarget.add(m[1]); }
for (const l of tsrc.split('\n')) { const m = /^(?:const|let|var)\s+\{([^}]*)\}/.exec(l); if (m) for (const p of m[1].split(',')) inTarget.add(p.split(':').pop().trim()); }

// เขียนไฟล์ (เป้าก่อน แล้วค่อยตัด server.js)
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target + '.tmp', tsrc);
fs.writeFileSync(serverFile + '.tmp', keep.join('\n'));
fs.renameSync(target + '.tmp', target);
fs.renameSync(serverFile + '.tmp', serverFile);

console.log(`ย้าย ${names.length} เมธอด (${cut.reduce((s, [a, b]) => s + b - a, 0)} บรรทัด) -> ${path.relative(ROOT, target)}`);
const need = [...used].filter(n => !inTarget.has(n)).sort();
console.log(need.length ? 'ชื่อระดับบนสุดของ server.js ที่โค้ดที่ย้ายอ้างถึง (ต้อง require/ประกาศในไฟล์เป้า ถ้ายังไม่มี): ' + need.join(', ') : 'โค้ดที่ย้ายไม่อ้างชื่อระดับบนสุดของ server.js ที่ตรวจพบ');
console.log('อย่าลืม: ใส่ mix(World, require(...)) ใน server.js เอง แล้วรัน node tools/check-moved.js --cmp และ node tools/check-structure.js');
