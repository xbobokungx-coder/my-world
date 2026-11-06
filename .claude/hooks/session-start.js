// SessionStart hook: ตอนเปิด Claude Code บอกสถานะ git เทียบกับ GitHub และแปะ "สถานะงานล่าสุด" จาก docs/HANDOFF.md
// ข้อความที่พิมพ์ออกมาจะเข้า context ของ Claude จึงเก็บให้สั้น
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const sh = c => { try { return execSync(c, { cwd: root, encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return ''; } };
const out = [];
sh('git fetch -q origin');
const branch = sh('git rev-parse --abbrev-ref HEAD');
const counts = sh('git rev-list --left-right --count HEAD...@{u}').split(/\s+/);
const ahead = +counts[0] || 0, behind = +counts[1] || 0;
const dirty = sh('git status --porcelain --untracked-files=no').split('\n').filter(Boolean).length;
out.push(`[git] branch ${branch}: ahead ${ahead}, behind ${behind}, uncommitted files ${dirty}`);
if (behind) out.push('[git] เครื่องนี้ตามหลัง GitHub — ให้ git pull ก่อนเริ่มแก้');
if (ahead) out.push('[git] มี commit ที่ยังไม่ push');
const ho = path.join(root, 'docs', 'HANDOFF.md');
if (fs.existsSync(ho)) {
  const lines = fs.readFileSync(ho, 'utf8').split('\n').slice(0, 40);
  out.push('[handoff] docs/HANDOFF.md (ส่วนต้น):', ...lines);
}
process.stdout.write(out.join('\n') + '\n');
