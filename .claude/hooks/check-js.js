// PostToolUse hook: หลัง Edit/Write ไฟล์ .js ให้รัน node --check ทันที ถ้า syntax พังจะส่ง error กลับให้ Claude แก้ (exit 2)
const { spawnSync } = require('child_process');
const fs = require('fs');
let raw = '';
process.stdin.on('data', d => (raw += d));
process.stdin.on('end', () => {
  let file = '';
  try { file = (JSON.parse(raw).tool_input || {}).file_path || ''; } catch (e) { process.exit(0); }
  if (!/\.(c|m)?js$/.test(file) || !fs.existsSync(file)) process.exit(0);
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write('node --check ไม่ผ่าน: ' + file + '\n' + (r.stderr || '').split('\n').slice(0, 8).join('\n'));
    process.exit(2);
  }
  process.exit(0);
});
