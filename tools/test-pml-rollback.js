// เทสต์ pml-rollback: เซฟจำลองในโฟลเดอร์ชั่วคราว
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), assert = require('assert');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pml-')), f = path.join(dir, 'main.json');
const save = { players: { a: { inv: { coin: 100 }, lottoPend: [[1, 3, 50], [2, 4, 25], [3, 5, 40, 1763000000000]] }, b: { inv: {}, lottoPend: [] }, d: { inv: { coin: 1 }, lottoPend: [[9, 1, 70, 1763000000000], [9, 3, 30]] }, c: { inv: { coin: 5 } } },
  bids: [{ id: 1, buyer: 'b', item: 'x', n: 2, price: 10, coin: 20 }, { id: 2, buyer: 'a', item: 'x', n: 1, price: 7, coin: 7 }], lotto: { pot: 999 } };
fs.writeFileSync(f, JSON.stringify(save));
const run = (...a) => cp.execFileSync('node', [path.join(__dirname, 'pml-rollback.js'), ...a], { env: { ...process.env, DATA_DIR: dir }, encoding: 'utf8' });
const total = d => Object.values(d.players).reduce((s, r) => s + ((r.inv && r.inv.coin) || 0), 0);
const pend = d => Object.values(d.players).reduce((s, r) => s + (r.lottoPend || []).reduce((x, e) => x + e[2], 0), 0);
const before = total(save) + pend(save) + save.bids.reduce((s, b) => s + b.coin, 0);
const raw = fs.readFileSync(f, 'utf8');
run(); assert.strictEqual(fs.readFileSync(f, 'utf8'), raw, 'dry-run ห้ามแก้ไฟล์');
run('--dry-run'); assert.strictEqual(fs.readFileSync(f, 'utf8'), raw);
run('--apply', '--force');
const d = JSON.parse(fs.readFileSync(f, 'utf8'));
assert.strictEqual(total(d), before, 'เหรียญรวมต้องเท่าเดิม'); assert.strictEqual(pend(d), 0); assert.ok(!('lottoPend' in d.players.a)); assert.deepStrictEqual(d.bids, []);
assert.strictEqual(d.players.a.inv.coin, 222, 'รายการ 4 ช่อง (มีเวลา) รวมเฉพาะช่องที่ 3'); assert.strictEqual(d.players.d.inv.coin, 101, '4 ช่องปน 3 ช่อง'); assert.ok(!('lottoPend' in d.players.d)); assert.strictEqual(d.players.b.inv.coin, 20); assert.strictEqual(d.lotto.pot, 999);
assert.ok(fs.existsSync(f + '.pre-pml')); assert.ok(!fs.existsSync(f + '.tmp'));
const after1 = fs.readFileSync(f, 'utf8'); run('--apply', '--force');
assert.strictEqual(fs.readFileSync(f, 'utf8'), after1, 'รันซ้ำต้องไม่คืนซ้ำ'); assert.strictEqual(total(JSON.parse(after1)), before);
fs.rmSync(dir, { recursive: true }); console.log('test-pml-rollback: ผ่านทั้งหมด');
