// ทดสอบว่าข้อมูลเมืองที่ save แล้วถูกโหลดกลับมาครบหลังรีสตาร์ต: node tools/test-persist.js
// (บั๊กเดิม: โครงการพัฒนาเมืองถูกบันทึกแต่ไม่ถูกโหลด → ยอดลงขันรีเซ็ตเป็น 0 ทุกครั้งที่รีสตาร์ตเซิร์ฟเวอร์)
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-persist-'));
const { World } = require('../server.js');
const w = new World('main'); w.nearChest = () => true;
const p = { name: 'tester', key: 'tester', x: 0, y: 0, ws: { readyState: 0, send() {} }, rec: { inv: { coin: 20000 }, pts: 0, arc: { pts: 0, total: 0, wk: 0 } } };
w.players.set(1, p); w.saved.tester = p.rec;
for (let i = 0; i < 4; i++) w.projHandle(p, { id: 'bridge', amt: 2000 });
w.projHandle(p, { id: 'bridge', amt: 500 }); w.projHandle(p, { id: 'lighthouse', amt: 500 });
w.dirty = true; w.save(true);
const w2 = new World('main');
assert.strictEqual(w2.projects.bridge.coin, 5000, 'bridge coin lost after reload');
assert.strictEqual(w2.projects.lighthouse.coin, 500, 'lighthouse coin lost after reload');
assert.strictEqual(w2.projects.bridge.donors.tester, 5000, 'donors lost after reload');
console.log('✓ ผ่าน: ยอดโครงการและรายชื่อผู้ลงขันอยู่ครบหลังโหลดใหม่');
fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); process.exit(0);
