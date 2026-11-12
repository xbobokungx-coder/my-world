// ทดสอบร้านปิดปรับปรุง (ร้านอาวุธ): act ได้ toast ไม่เปิดร้าน • ซื้อขายตรงๆ ไม่มีผล • ร้านอื่นเปิดได้: node tools/test-closed-shop.js
const assert = require('assert'), path = require('path');
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
console.log('OK test-closed-shop');
