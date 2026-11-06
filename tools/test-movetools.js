// ทดสอบเครื่องมือย้ายเมธอด (tools/move-methods.js + tools/check-moved.js) ด้วย server.js จำลองในตัวเอง (สร้างใน temp)
// ไม่ผูกกับเมธอดจริงของ server.js (ย้ายออกไปเรื่อยๆ ไม่ทำให้เทสต์พัง) ยกเว้นเทสต์สุดท้ายที่เช็กว่าเครื่องมือใช้กับ server.js จริงได้
// รัน: node tools/test-movetools.js
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-movetools-'));
process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} });

// server.js จำลอง: class World หลายรูปแบบเมธอด + return ระดับบนสุด + บล็อก mix
const FX = `'use strict';
const { mix } = require('./server/mixin');
const LIMIT = 3;
class World {
  constructor() { this.n = 0; }

  // เควสประจำวัน (คอมเมนต์ติดด้านบน)
  today() { return new Date().getMonth() + 1; }

  // เลือกเควส
  // หลายบรรทัด คอมเมนต์สองบรรทัด
  questPick(list) {
    const out = [];
    for (const x of list) {
      if (x > LIMIT) { out.push(x); }
    }
    return out;
  } // จบ questPick

  // กินของ
  eat(p, item) {
    if (!item) { return; }
    p.hp++;
  }

  // ใกล้น้ำไหม
  nearWater(p, r = 2) { // ดูรอบตัว
    return r > 1;
  }

  evWindow(now = Date.now()) {
    return now % 7;
  }

  other(a) {
    return a;
  }

  tick() {
    this.n++;
  }
}
mix(World, require('./server/systems/cinema.js'));
module.exports = { World };
if (require.main !== module) return;
console.log('start');
`;

function mk(name) {
  const d = path.join(tmp, name);
  fs.mkdirSync(path.join(d, 'tools'), { recursive: true });
  fs.mkdirSync(path.join(d, 'server', 'systems'), { recursive: true });
  for (const f of ['check-moved.js', 'move-methods.js', 'testlib.js']) fs.copyFileSync(path.join(ROOT, 'tools', f), path.join(d, 'tools', f));
  fs.copyFileSync(path.join(ROOT, 'server', 'mixin.js'), path.join(d, 'server', 'mixin.js'));
  fs.writeFileSync(path.join(d, 'server', 'systems', 'cinema.js'), "'use strict';\nmodule.exports = {\n  stub() { return 1; },\n};\n");
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  fs.writeFileSync(path.join(d, 'server.js'), FX);
  return d;
}
const runIn = (d, script, ...args) => cp.spawnSync(process.execPath, [path.join(d, 'tools', script), ...args], { cwd: d, encoding: 'utf8' });
const check = f => cp.spawnSync(process.execPath, ['--check', f]).status === 0;
const rd = f => fs.readFileSync(f, 'utf8');

const D = mk('main'), run = (s, ...a) => runIn(D, s, ...a);
const srv = path.join(D, 'server.js'), sys = path.join(D, 'server', 'systems', 'trial.js'), snap = path.join(D, 'snap.json');
let r = run('check-moved.js', '--snap', snap);
assert.strictEqual(r.status, 0, 'snap ต้องผ่าน: ' + r.stderr);
const before = JSON.parse(rd(snap));
assert.ok(before.today && before.questPick && before.stub, 'snapshot ต้องมีเมธอดของ World (รวมจาก mix)');
assert.strictEqual(run('check-moved.js', '--cmp', snap).status, 0, 'cmp ก่อนย้ายต้องตรง');

// ชื่อผิด/ซ้ำคำสั่ง = exit 1 และไม่แก้ไฟล์ใด (รวมกรณีชื่อแรกถูกแต่ชื่อหลังผิด)
const srv0 = rd(srv);
for (const args of [['nope_xyz'], ['today', 'nope_xyz'], ['today', 'today']]) {
  r = run('move-methods.js', sys, ...args);
  assert.strictEqual(r.status, 1, 'ชื่อผิดต้อง exit 1: ' + args);
  assert.strictEqual(rd(srv), srv0, 'server.js ต้องไม่ถูกแก้');
  assert.ok(!fs.existsSync(sys), 'ไฟล์เป้าต้องไม่ถูกสร้าง');
}

// ย้ายจริง (บรรทัดเดียว + คอมเมนต์ด้านบน)
r = run('move-methods.js', sys, 'today');
assert.strictEqual(r.status, 0, 'ย้ายต้องผ่าน: ' + r.stderr + r.stdout);
const srv1 = rd(srv), sysSrc = rd(sys);
assert.ok(!/^  today\(\)/m.test(srv1), 'today ต้องหายจาก server.js');
assert.ok(/^  today\(\) \{.*\},$/m.test(sysSrc), 'today ต้องอยู่ในไฟล์ระบบพร้อมเครื่องหมาย ,');
assert.ok(/เควสประจำวัน/.test(sysSrc), 'คอมเมนต์ที่ติดด้านบนต้องย้ายไปด้วย');
assert.ok(/module\.exports = \{/.test(sysSrc) && sysSrc.startsWith("'use strict';"), 'ต้องสร้างไฟล์เป้าตามแบบ');
assert.ok(/ชื่อระดับบนสุด|ไม่อ้างชื่อ/.test(r.stdout), 'ต้องพิมพ์รายงานชื่อที่อ้างถึง');
assert.ok(!/mix\(World, require\('\.\/server\/systems\/trial/.test(srv1), 'ห้าม mix ให้อัตโนมัติ');
assert.ok(/^  questPick\(/m.test(srv1) && /^  eat\(/m.test(srv1), 'เมธอดอื่นต้องอยู่ที่เดิม');
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

// ย้ายเมธอดหลายบรรทัด + คอมเมนต์ท้ายบรรทัดปิด ไปไฟล์ที่มีอยู่แล้ว (ต่อท้าย) แล้ว cmp ผ่าน
fs.writeFileSync(sys, sysSrc);
r = run('move-methods.js', sys, 'questPick');
assert.strictEqual(r.status, 0, 'ย้ายเพิ่มต้องผ่าน: ' + r.stderr);
assert.ok(/^  questPick\(/m.test(rd(sys)) && !/^  questPick\(/m.test(rd(srv)));
assert.ok(/เลือกเควส\n  \/\/ หลายบรรทัด/.test(rd(sys)) && /^  \},( \/\/ จบ questPick)$/m.test(rd(sys)), 'คอมเมนต์สองบรรทัดและคอมเมนต์ท้ายปิดต้องย้ายไปด้วย');
assert.strictEqual(run('check-moved.js', '--cmp', snap).status, 0, 'ย้ายเพิ่มแล้ว cmp ต้องผ่าน');
assert.ok(check(sys), 'ไฟล์ระบบต้อง syntax ถูก');
assert.ok(check(srv), 'server.js ต้อง syntax ถูก');

// ไฟล์เป้านอก repo = exit 1 ไม่แก้อะไร
const srvB = rd(srv), outside = path.join(os.tmpdir(), 'mw-outside-' + process.pid + '.js');
r = run('move-methods.js', outside, 'eat');
assert.strictEqual(r.status, 1, 'ไฟล์เป้านอก repo ต้อง exit 1');
assert.ok(!fs.existsSync(outside) && rd(srv) === srvB, 'นอก repo ต้องไม่เขียนอะไร');

// ไฟล์เป้ามีเมธอดชื่อเดียวกันอยู่แล้ว = exit 1 ไม่แก้อะไร
const dup = path.join(D, 'server', 'systems', 'dup.js');
fs.writeFileSync(dup, "'use strict';\nmodule.exports = {\n  tick() { return 1; },\n};\n");
const dupB = rd(dup), srvC = rd(srv);
r = run('move-methods.js', dup, 'tick');
assert.strictEqual(r.status, 1, 'ชื่อซ้ำในไฟล์เป้าต้อง exit 1: ' + r.stdout + r.stderr);
assert.strictEqual(rd(dup), dupB, 'ไฟล์เป้าต้องไม่ถูกแก้');
assert.strictEqual(rd(srv), srvC, 'server.js ต้องไม่ถูกแก้');
assert.ok(!fs.existsSync(dup + '.tmp') && !fs.existsSync(srv + '.tmp'), 'ต้องไม่มี .tmp ค้าง');

// บั๊กขอบเขต: ย้าย eat ต้องไม่ดึง nearWater(p, r = 2) ที่อยู่ถัดไปไปด้วย
{
  const d = mk('eat'), s = path.join(d, 'server.js'), t = path.join(d, 'server', 'systems', 'e.js');
  r = runIn(d, 'move-methods.js', t, 'eat');
  assert.strictEqual(r.status, 0, 'ย้าย eat ต้องผ่าน: ' + r.stderr);
  assert.ok(/^  eat\(p, item\) \{/m.test(rd(t)) && !/nearWater|evWindow|other/.test(rd(t)), 'ต้องไม่ดึงเมธอดถัดไปไปด้วย');
  assert.ok(/^  nearWater\(p, r = 2\)/m.test(rd(s)) && /^  other\(a\)/m.test(rd(s)) && !/^  eat\(/m.test(rd(s)));
  assert.ok(check(t) && check(s), 'ทั้งสองไฟล์ต้อง syntax ถูก');
}
// ย้ายเมธอดที่มี default param เอง (nearWater, evWindow(now = Date.now())) ตรงๆ ได้ และ cmp ผ่านหลัง mix
{
  const d = mk('dflt'), s = path.join(d, 'server.js'), t = path.join(d, 'server', 'systems', 'w.js'), sn = path.join(d, 'snap.json');
  assert.strictEqual(runIn(d, 'check-moved.js', '--snap', sn).status, 0);
  r = runIn(d, 'move-methods.js', t, 'nearWater', 'evWindow');
  assert.strictEqual(r.status, 0, 'ย้าย default param ตรงๆ ต้องผ่าน: ' + r.stderr);
  assert.ok(/^  nearWater\(p, r = 2\) \{/m.test(rd(t)) && /^  evWindow\(now = Date\.now\(\)\) \{/m.test(rd(t)) && !/^  (eat|other|tick)\(/m.test(rd(t)), 'ได้เฉพาะสองตัวที่สั่ง');
  assert.ok(/^  eat\(/m.test(rd(s)) && /^  other\(/m.test(rd(s)) && /^  tick\(/m.test(rd(s)), 'เมธอดข้างเคียงต้องอยู่ใน server.js');
  assert.ok(check(t) && check(s));
  fs.writeFileSync(s, rd(s).replace(/^(mix\(World, require\('\.\/server\/systems\/cinema\.js'\)\).*)$/m, "$1\nmix(World, require('./server/systems/w.js'));"));
  r = runIn(d, 'check-moved.js', '--cmp', sn);
  assert.strictEqual(r.status, 0, 'cmp ต้องผ่าน: ' + r.stdout + r.stderr);
}
// เนื้อที่ตัดมีเมธอดอื่นปน/ขอบเขตไม่ชัด (หัวหลายบรรทัดที่ไม่รู้จัก) = exit 1 ไม่แก้ไฟล์
{
  const d = mk('bad'), s = path.join(d, 'server.js'), t = path.join(d, 'server', 'systems', 'e.js');
  const BAD = FX.replace("  other(a) {\n    return a;\n  }\n", "  other(a,\n    b) {\n    return a;\n  }\n");
  assert.notStrictEqual(BAD, FX);
  fs.writeFileSync(s, BAD);
  r = runIn(d, 'move-methods.js', t, 'nearWater', 'evWindow');
  assert.strictEqual(r.status, 1, 'ขอบเขตไม่ชัดต้อง exit 1: ' + r.stdout);
  assert.strictEqual(rd(s), BAD, 'server.js ต้องไม่ถูกแก้');
  assert.ok(!fs.existsSync(t) && !fs.existsSync(s + '.tmp') && !fs.existsSync(t + '.tmp'), 'ต้องไม่เขียนไฟล์ใด');
}

// เครื่องมือใช้กับ server.js จริงได้ (ไม่ผูกชื่อเมธอด): snap + cmp บนสำเนา และ check-structure
{
  const d = path.join(tmp, 'real');
  fs.mkdirSync(path.join(d, 'public'), { recursive: true }); fs.mkdirSync(path.join(d, 'tools'));
  fs.copyFileSync(path.join(ROOT, 'server.js'), path.join(d, 'server.js'));
  fs.copyFileSync(path.join(ROOT, 'public', 'shared.js'), path.join(d, 'public', 'shared.js'));
  fs.cpSync(path.join(ROOT, 'server'), path.join(d, 'server'), { recursive: true });
  for (const f of ['check-moved.js', 'move-methods.js', 'testlib.js']) fs.copyFileSync(path.join(ROOT, 'tools', f), path.join(d, 'tools', f));
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(d, 'node_modules'));
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  const sn = path.join(d, 'snap.json');
  r = runIn(d, 'check-moved.js', '--snap', sn);
  assert.strictEqual(r.status, 0, 'snap server.js จริงต้องผ่าน: ' + r.stderr);
  assert.ok(Object.keys(JSON.parse(rd(sn))).length > 20, 'World จริงต้องมีเมธอดมาก');
  assert.strictEqual(runIn(d, 'check-moved.js', '--cmp', sn).status, 0, 'cmp จริงต้องตรง');
}
console.log('ok test-movetools');
