// ตรวจก่อน commit/deploy: node tools/check.js
// 1) syntax ของไฟล์ JS  2) $('id') ที่ game.js ผูกไว้ตอนโหลด (ต้นบรรทัด) ต้องมีใน index.html
// 3) เตือนถ้า staged diff ลบโค้ดเยอะผิดปกติ (กันวางไฟล์เก่าทับ)  — exit 1 เมื่อพบปัญหา
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let bad = 0;
const fail = m => { console.error('✗ ' + m); bad++; };

for (const f of ['server.js', 'public/game.js', 'public/shared.js', 'public/pixelart.js', 'public/pixelchar.js', 'public/pixelui.js', 'public/mapedit.js']) {
  try { new vm.Script('(function(exports,require,module,__filename,__dirname){' + read(f).replace(/^#!.*/, '') + '\n})', { filename: f }); } catch (e) { fail(`syntax ${f}: ${e.message}`); }
}

const html = read('public/index.html');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const seen = new Set();
read('public/game.js').split('\n').forEach((line, i) => {
  const m = line.match(/^\$\('([A-Za-z0-9_-]+)'\)\./); // คำสั่งระดับบนสุดที่แตะ element ทันทีตอนโหลด
  if (m && !ids.has(m[1]) && !seen.has(m[1])) { seen.add(m[1]); fail(`game.js:${i + 1} ใช้ $('${m[1]}') ตอนโหลด แต่ index.html ไม่มี id นี้ → สคริปต์จะหยุด จอว่าง`); }
});

try {
  const out = cp.execSync('git diff --cached --numstat -- server.js public', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  let add = 0, del = 0;
  for (const l of out.trim().split('\n').filter(Boolean)) { const [a, d] = l.split('\t'); add += +a || 0; del += +d || 0; }
  if (del > 300 && del > add * 1.5 && !process.env.ALLOW_BIG_DELETE) fail(`staged diff ลบ ${del} บรรทัด เพิ่ม ${add} — ผิดปกติ อาจวางไฟล์เก่าทับ (ถ้าตั้งใจ: ALLOW_BIG_DELETE=1)`);
} catch (e) { /* ไม่ใช่ git repo หรือไม่มี staged */ }

if (bad) { console.error(`\nพบ ${bad} ปัญหา`); process.exit(1); }
console.log('✓ ผ่าน: syntax, id ใน index.html, ขนาด diff');
