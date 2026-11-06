// ตรวจโครงสร้าง (refactor 0.7): ชื่อเมธอดซ้ำใน class World, ซ้ำข้าม server/systems/**, และ node --check ทุกไฟล์ .js
// รัน: node tools/check-structure.js  → exit 1 ถ้าพบปัญหา, exit 0 ถ้าไม่พบ
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const rel = f => path.relative(ROOT, f);
let problems = 0;
const bad = m => { problems++; console.log('ปัญหา: ' + m); };

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else if (e.name.endsWith('.js')) out.push(p);
  }
  return out.sort();
}

// เมธอดระดับ class/object (เยื้อง 2 ช่อง) -> [{key,name,line}]
const SKIP = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return']);
function methods(lines, from, to) {
  const out = [];
  for (let i = from; i < to; i++) {
    const m = /^  (static\s+|async\s+|get\s+|set\s+)*\*?([A-Za-z_$][\w$]*)\s*\(/.exec(lines[i]);
    // ต้องเป็นหัวเมธอด: มี ) แล้วตามด้วย { (ก่อนคอมเมนต์ท้ายบรรทัดจะมีหรือไม่ก็ได้) ไม่ใช่การเรียกฟังก์ชันเฉยๆ
    if (!m || SKIP.has(m[2]) || !/^\s+[^;=]*\)\s*\{/.test(lines[i])) continue;
    const km = /^\s*(?:static\s+)?(?:async\s+)?(get|set)\s+[A-Za-z_$]/.exec(lines[i]);
    const kind = km ? km[1] : '';
    const st = /^\s*static\s/.test(lines[i]) ? 'static ' : '';
    out.push({ key: st + kind + ' ' + m[2], name: m[2], line: i + 1 });
  }
  return out;
}

const serverFile = path.join(ROOT, 'server.js');
const src = fs.readFileSync(serverFile, 'utf8').split(/\r?\n/);
const start = src.findIndex(l => /^class World\b/.test(l));
if (start < 0) bad('หา class World ใน server.js ไม่เจอ');
else {
  let end = src.findIndex((l, i) => i > start && l.replace(/\r$/, '') === '}');
  if (end < 0) end = src.length;
  const cls = methods(src, start + 1, end);
  const seen = new Map();
  for (const m of cls) {
    if (seen.has(m.key)) bad(`เมธอดซ้ำใน class World: ${m.name} (server.js:${seen.get(m.key)} และ server.js:${m.line})`);
    else seen.set(m.key, m.line);
  }
  // ซ้ำข้าม server/systems/**
  const owners = new Map();
  for (const f of walk(path.join(ROOT, 'server', 'systems'))) {
    const ls = fs.readFileSync(f, 'utf8').split(/\r?\n/);
    for (const m of methods(ls, 0, ls.length)) {
      if (seen.has(m.key)) bad(`เมธอดซ้ำข้าม class กับระบบ: ${m.name} (server.js:${seen.get(m.key)} และ ${rel(f)}:${m.line})`);
      if (owners.has(m.key)) bad(`เมธอดซ้ำข้ามระบบ: ${m.name} (${owners.get(m.key)} และ ${rel(f)}:${m.line})`);
      else owners.set(m.key, `${rel(f)}:${m.line}`);
    }
  }
}

// node --check
const files = [serverFile, ...['server', 'shared', 'public'].flatMap(d => walk(path.join(ROOT, d)))];
let ok = 0;
for (const f of files) {
  const r = cp.spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) bad(`node --check ไม่ผ่าน: ${rel(f)}\n${(r.stderr || '').split(/\r?\n/).slice(0, 6).join('\n')}`); else ok++;
}
console.log(`node --check ผ่าน ${ok}/${files.length} ไฟล์`);
console.log(problems ? `พบปัญหา ${problems} รายการ` : 'โครงสร้างปกติ');
process.exit(problems ? 1 : 0);
