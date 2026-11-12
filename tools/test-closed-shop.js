// ทดสอบร้านปิดปรับปรุง (ร้านอาวุธ) + ต้นไม้ลานกลางเมือง: act ได้ toast ไม่เปิดร้าน • ซื้อขายตรงๆ ไม่มีผล • layout fire ถูกข้าม • ไม่มีคำว่า 'กองไฟ': node tools/test-closed-shop.js
const assert = require('assert'), fs = require('fs'), path = require('path');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-closed-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, ROOT = path.join(__dirname, '..');

const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('closedshop');
const p = w.join(mkWs(), 'Tester', '#fff').p; p.ws2 = p.ws || null;
const ws = () => w.players.get(p.id) && p.ws;
const wb = S.BUILDINGS.find(b => b.kind === 'weapon');
assert.ok(wb && wb.closed, 'ต้องมีร้านอาวุธที่ปิดอยู่');
assert.ok(!S.SHOPS.weapon, 'ห้ามมี SHOPS.weapon');
p.rec.inv = { coin: 5000, seed_carrot: 3, crop_carrot: 5, bait: 2, wood: 4 }; p.rec.hunger = 100;
const stand = (x, y) => { p.x = (x + 0.5) * TS; p.y = (y + 0.5) * TS; };
const snap = () => JSON.stringify({ inv: p.rec.inv, sk: p.rec.skills, xp: p.rec.xp, lv: p.rec.level, dur: p.rec.dur, fix: p.rec.fix });
// หา ws ที่เก็บข้อความ: ตรวจจาก send ที่ผู้เล่นใช้
const msgsOf = () => { for (const k of ['ws2', 'ws', 'sock']) if (p[k] && p[k].msgs) return p[k].msgs; throw new Error('ไม่พบที่เก็บข้อความของผู้เล่น'); };
const act = (tx, ty) => { w.handle(p, { t: 'act', tool: 'hand', tx, ty }); };
const [cx, cy] = wb.counter[0];

// (1) ที่ประตูและที่ตัวอาคาร: toast = closed และไม่มี {t:'shop'}
{
  const m = msgsOf(); stand(cx, cy + 1);
  for (const [tx, ty, nm] of [[cx, cy, 'ประตู'], [wb.x0, wb.y0, 'ตัวอาคาร'], [wb.x1, wb.y0, 'ตัวอาคาร']]) {
    m.length = 0; p.lastAct = 0; act(tx, ty);
    assert.ok(m.some(x => x.t === 'msg' && x.text === wb.closed), nm + ' ต้องได้ข้อความร้านปิด: ' + JSON.stringify(m));
    assert.ok(!m.some(x => x.t === 'shop'), nm + ' ต้องไม่เปิดร้าน');
  }
  console.log('  (1) act ที่ร้านอาวุธ: toast closed ไม่เปิดร้าน');
}
// (2) ส่งข้อความระบบต่างๆ ตรงๆ ที่หน้าร้านอาวุธ: เหรียญ/ของ/XP ไม่เปลี่ยน
{
  stand(cx, cy + 1); const before = snap();
  for (const msg of [
    { t: 'buy', item: 'seed_carrot', n: 1 }, { t: 'buy', item: 'bait', n: 1 }, { t: 'buy', item: 'lamp', n: 1 },
    { t: 'sell', item: 'crop_carrot', n: 'all' }, { t: 'sell', item: 'wood', n: 1 }, { t: 'sellback', item: 'lamp' },
    { t: 'cook', id: 'bread' }, { t: 'craft', id: 'plank' }, { t: 'repair', tool: 'axe' }, { t: 'rent', id: '0' }, { t: 'rent', id: 'a' },
  ]) { try { w.handle(p, msg); } catch (e) { assert.fail('ส่ง ' + msg.t + ' แล้วพัง: ' + e.message); } assert.strictEqual(snap(), before, msg.t + ' หน้าร้านอาวุธต้องไม่เปลี่ยนอะไร'); }
  assert.strictEqual(w.nearShopKind(p), null, 'ร้านอาวุธไม่นับเป็นร้านที่ยืนอยู่');
  console.log('  (2) buy/sell/sellback/cook/craft/repair/rent หน้าร้านอาวุธ ไม่มีผล');
}
// (3) ร้านอื่นยังเปิดได้
{
  const fb = S.BUILDINGS.find(b => b.kind === 'farm'), [fx, fy] = fb.counter[0]; stand(fx, fy + 1); const m = msgsOf();
  for (const [tx, ty] of [[fx, fy], [fb.x0, fb.y0]]) { m.length = 0; p.lastAct = 0; act(tx, ty); assert.ok(m.some(x => x.t === 'shop' && x.kind === 'farm'), 'ร้านเมล็ดพันธุ์ต้องเปิดได้ที่ ' + tx + ',' + ty); }
  console.log('  (3) ร้านอื่นเปิดได้ปกติ');
}
// (4) item fire ใน layout ถูกทิ้ง: shared ไม่ย้ายต้นไม้ลาน/ที่นั่ง และ validateLayout ไม่ error • server ลบ fire ก่อนเขียนไฟล์
const sharedWith = lay => { const key = require.resolve('../public/shared.js'), cached = require.cache[key], prev = globalThis.__LAYOUT; delete require.cache[key]; globalThis.__LAYOUT = lay; try { return require('../public/shared.js'); } finally { globalThis.__LAYOUT = prev; delete require.cache[key]; if (cached) require.cache[key] = cached; } };
{
  const Sx = sharedWith({ items: { fire: { x: 20, y: 12 } } });
  assert.deepStrictEqual([Sx.FIRE.x, Sx.FIRE.y], [S.FIRE.x, S.FIRE.y], 'FIRE ไม่ถูกย้าย');
  assert.deepStrictEqual([Sx.PLAZA_TREE.x, Sx.PLAZA_TREE.y], [S.PLAZA_TREE.x, S.PLAZA_TREE.y], 'ต้นไม้ลานไม่ถูกย้าย');
  assert.deepStrictEqual(Sx.SEATS, S.SEATS, 'ที่นั่งไม่ถูกย้าย');
  assert.deepStrictEqual(Sx.PLAZA, S.PLAZA);
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(/layoutapply[\s\S]{0,900}delete items\.fire/.test(src), 'layoutapply ต้อง delete items.fire ก่อน validate/commit');
  console.log('  (4) layout fire ถูกข้าม');
}
// (5) validateLayout (ดึงฟังก์ชันจากซอร์ส server.js มารันในกล่องแยก เพราะไม่ได้ export)
{
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'), a = src.indexOf('function loadSharedWith'), b = src.indexOf('function layoutHistory');
  assert.ok(a > 0 && b > a, 'หา validateLayout ในซอร์สไม่เจอ');
  const req = id => require(id.startsWith('.') ? path.join(ROOT, id) : id); req.resolve = id => require.resolve(id.startsWith('.') ? path.join(ROOT, id) : id); req.cache = require.cache;
  const { validateLayout } = new Function('require', 'S', src.slice(a, b) + '\nreturn { validateLayout };')(req, S);
  assert.deepStrictEqual(validateLayout({}), [], 'ผังตั้งต้นต้องผ่าน');
  const errs = validateLayout({ b_farm: { x: S.PLAZA_TREE.x - 1, y: S.PLAZA_TREE.y - 1 } });
  assert.ok(errs.some(e => e.includes('ต้นไม้ลานกลางเมือง')), 'ย้ายร้านทับต้นไม้ลานต้องถูกฟ้อง: ' + JSON.stringify(errs));
  console.log('  (5) validateLayout ฟ้องร้านทับต้นไม้ลาน');
}
// (6) ข้อความที่ผู้เล่นเห็นไม่มี 'กองไฟ' (ตัดคอมเมนต์ // ท้ายบรรทัดและบรรทัดที่ขึ้นต้นด้วย //)
{
  const files = ['public/shared.js', 'server.js', 'public/game.js'];
  const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
  files.push(...walk('server'));
  const bad = [];
  for (const f of files) fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((ln, i) => {
    const t = ln.trim(); if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    const code = ln.replace(/\s\/\/.*$/, ''); if (code.includes('กองไฟ')) bad.push(f + ':' + (i + 1) + ' ' + code.trim().slice(0, 80));
  });
  assert.deepStrictEqual(bad, [], "ยังมีคำว่า 'กองไฟ' ในข้อความ/โค้ด");
  console.log("  (6) ไม่มีคำว่า 'กองไฟ' ในข้อความผู้เล่น");
}
console.log('OK test-closed-shop');
