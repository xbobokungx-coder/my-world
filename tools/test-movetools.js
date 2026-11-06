// ทดสอบเครื่องมือย้ายเมธอด (tools/move-methods.js + tools/check-moved.js) ในสำเนา temp ไม่แตะ server.js จริง: node tools/test-movetools.js
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-movetools-'));
process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} });

// สำเนาเฉพาะที่ต้องใช้
fs.mkdirSync(path.join(tmp, 'public')); fs.mkdirSync(path.join(tmp, 'tools'));
fs.copyFileSync(path.join(ROOT, 'server.js'), path.join(tmp, 'server.js'));
fs.copyFileSync(path.join(ROOT, 'public', 'shared.js'), path.join(tmp, 'public', 'shared.js'));
fs.cpSync(path.join(ROOT, 'server'), path.join(tmp, 'server'), { recursive: true });
for (const f of ['check-moved.js', 'move-methods.js', 'testlib.js']) fs.copyFileSync(path.join(ROOT, 'tools', f), path.join(tmp, 'tools', f));
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'));
fs.writeFileSync(path.join(tmp, 'package.json'), '{}');

const run = (script, ...args) => cp.spawnSync(process.execPath, [path.join(tmp, 'tools', script), ...args], { cwd: tmp, encoding: 'utf8' });
const srv = path.join(tmp, 'server.js'), sys = path.join(tmp, 'server', 'systems', 'trial.js'), snap = path.join(tmp, 'snap.json');

let r = run('check-moved.js', '--snap', snap);
assert.strictEqual(r.status, 0, 'snap ต้องผ่าน: ' + r.stderr);
const before = JSON.parse(fs.readFileSync(snap, 'utf8'));
assert.ok(before.today && before.questPick, 'snapshot ต้องมีเมธอดของ World');
assert.strictEqual(run('check-moved.js', '--cmp', snap).status, 0, 'cmp ก่อนย้ายต้องตรง');

// ชื่อผิด/ซ้ำคำสั่ง = exit 1 และไม่แก้ไฟล์ใด (รวมกรณีชื่อแรกถูกแต่ชื่อหลังผิด)
const srv0 = fs.readFileSync(srv, 'utf8');
for (const args of [['nope_xyz'], ['today', 'nope_xyz'], ['today', 'today']]) {
  r = run('move-methods.js', sys, ...args);
  assert.strictEqual(r.status, 1, 'ชื่อผิดต้อง exit 1: ' + args);
  assert.strictEqual(fs.readFileSync(srv, 'utf8'), srv0, 'server.js ต้องไม่ถูกแก้');
  assert.ok(!fs.existsSync(sys), 'ไฟล์เป้าต้องไม่ถูกสร้าง');
}

// ย้ายจริง
r = run('move-methods.js', sys, 'today');
assert.strictEqual(r.status, 0, 'ย้ายต้องผ่าน: ' + r.stderr + r.stdout);
const srv1 = fs.readFileSync(srv, 'utf8'), sysSrc = fs.readFileSync(sys, 'utf8');
assert.ok(!/^  today\(\)/m.test(srv1), 'today ต้องหายจาก server.js');
assert.ok(/^  today\(\) \{.*\},$/m.test(sysSrc), 'today ต้องอยู่ในไฟล์ระบบพร้อมเครื่องหมาย ,');
assert.ok(/เควสประจำวัน/.test(sysSrc), 'คอมเมนต์ที่ติดด้านบนต้องย้ายไปด้วย');
assert.ok(/module\.exports = \{/.test(sysSrc) && sysSrc.startsWith("'use strict';"), 'ต้องสร้างไฟล์เป้าตามแบบ');
assert.ok(/ชื่อระดับบนสุด|ไม่อ้างชื่อ/.test(r.stdout), 'ต้องพิมพ์รายงานชื่อที่อ้างถึง');
assert.ok(!/mix\(World, require\('\.\/server\/systems\/trial/.test(srv1), 'ห้าม mix ให้อัตโนมัติ');
assert.ok(run('check-moved.js', '--cmp', snap).status !== 0, 'ยังไม่ mix cmp ต้องบอกว่าหายไป');

// เพิ่ม mix เอง
fs.writeFileSync(srv, srv1.replace(/^(mix\(World, require\('\.\/server\/systems\/cinema\.js'\)\).*)$/m, "$1\nmix(World, require('./server/systems/trial.js'));"));
r = run('check-moved.js', '--cmp', snap);
assert.strictEqual(r.status, 0, 'หลังย้าย+mix cmp ต้องผ่าน: ' + r.stdout + r.stderr);

// ย้ายซ้ำชื่อที่ไม่อยู่ใน class แล้ว = exit 1
assert.strictEqual(run('move-methods.js', sys, 'today').status, 1, 'ย้ายซ้ำต้อง exit 1');

// แก้ 1 ตัวอักษรในไฟล์ระบบ -> cmp พัง
fs.writeFileSync(sys, sysSrc.replace('getMonth() + 1', 'getMonth() + 2'));
r = run('check-moved.js', '--cmp', snap);
assert.strictEqual(r.status, 1, 'แก้ 1 ตัวอักษรแล้ว cmp ต้องพัง');
assert.ok(/ข้อความต่าง: today/.test(r.stdout), 'ต้องชี้ว่า today ต่าง: ' + r.stdout);

// ย้ายเมธอดที่มีหลายบรรทัด + คอมเมนต์ท้ายบรรทัดปิด ไปไฟล์ที่มีอยู่แล้ว (ต่อท้าย) แล้ว cmp ผ่าน
fs.writeFileSync(sys, sysSrc);
r = run('move-methods.js', sys, 'questPick');
assert.strictEqual(r.status, 0, 'ย้ายเพิ่มต้องผ่าน: ' + r.stderr);
assert.ok(/^  questPick\(/m.test(fs.readFileSync(sys, 'utf8')) && !/^  questPick\(/m.test(fs.readFileSync(srv, 'utf8')));
assert.strictEqual(run('check-moved.js', '--cmp', snap).status, 0, 'ย้ายเพิ่มแล้ว cmp ต้องผ่าน');
assert.strictEqual(cp.spawnSync(process.execPath, ['--check', sys]).status, 0, 'ไฟล์ระบบต้อง syntax ถูก');
// ไฟล์เป้านอก repo = exit 1 ไม่แก้อะไร
const srvB = fs.readFileSync(srv, 'utf8'), outside = path.join(os.tmpdir(), 'mw-outside-' + process.pid + '.js');
r = run('move-methods.js', outside, 'today');
assert.strictEqual(r.status, 1, 'ไฟล์เป้านอก repo ต้อง exit 1');
assert.ok(!fs.existsSync(outside) && fs.readFileSync(srv, 'utf8') === srvB, 'นอก repo ต้องไม่เขียนอะไร');
// ไฟล์เป้ามีเมธอดชื่อเดียวกันอยู่แล้ว = exit 1 ไม่แก้อะไร (ไฟล์เป้ามี tick อยู่แล้ว ลองย้าย tick จาก class)
const dup = path.join(tmp, 'server', 'systems', 'dup.js');
fs.writeFileSync(dup, "'use strict';\nmodule.exports = {\n  tick() { return 1; },\n};\n");
const dupB2 = fs.readFileSync(dup, 'utf8'), srvC = fs.readFileSync(srv, 'utf8');
r = run('move-methods.js', dup, 'tick');
assert.strictEqual(r.status, 1, 'ชื่อซ้ำในไฟล์เป้าต้อง exit 1: ' + r.stdout + r.stderr);
assert.strictEqual(fs.readFileSync(dup, 'utf8'), dupB2, 'ไฟล์เป้าต้องไม่ถูกแก้');
assert.strictEqual(fs.readFileSync(srv, 'utf8'), srvC, 'server.js ต้องไม่ถูกแก้');
assert.ok(!fs.existsSync(dup + '.tmp') && !fs.existsSync(srv + '.tmp'), 'ต้องไม่มี .tmp ค้าง');
console.log('ok test-movetools');
