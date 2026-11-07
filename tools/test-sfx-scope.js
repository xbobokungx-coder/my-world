// ทดสอบ: เสียง (sfx) ได้ยินเฉพาะคนในแมพ/ฉากเดียวกัน • ตัวเองได้ยินเสมอ
// รัน: node tools/test-sfx-scope.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-sfxscope-');
const { World } = require('../server.js');
const w = new World('sfxscope');
const mk = name => { const ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }; return { ws, p: w.join(ws, name, '#3498db', false).p }; };
const a = mk('SfA'), b = mk('SfB'), c = mk('SfC'), d = mk('SfD');
const got = x => x.ws.msgs.filter(m => m.t === 'sfx' && m.k === 'chop').length;
const clear = () => [a, b, c, d].forEach(x => { x.ws.msgs.length = 0; });
// a,b อยู่เมือง • c อยู่ถ้ำชั้น 1 • d อยู่ถ้ำชั้น 2
c.p.scene = '@cave1'; d.p.scene = '@cave2';

clear(); w.sfx(a.p, 'chop');
assert.strictEqual(got(a), 1, 'ตัวเองได้ยิน'); assert.strictEqual(got(b), 1, 'คนในเมืองได้ยิน');
assert.strictEqual(got(c), 0, 'คนในถ้ำไม่ได้ยินเสียงในเมือง'); assert.strictEqual(got(d), 0);

clear(); w.sfx(c.p, 'chop');
assert.strictEqual(got(c), 1, 'ตัวเองในถ้ำได้ยิน'); assert.strictEqual(got(a), 0, 'คนในเมืองไม่ได้ยินเสียงในถ้ำ');
assert.strictEqual(got(d), 0, 'คนต่างชั้นถ้ำไม่ได้ยิน');

d.p.scene = '@cave1'; clear(); w.sfx(c.p, 'chop');
assert.strictEqual(got(d), 1, 'ชั้นถ้ำเดียวกันได้ยิน');
console.log('ผ่าน: sfx scope');
process.exit(0);
