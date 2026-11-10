// ทดสอบป้ายอันดับกลางเมือง: node tools/test-rank.js
process.env.TZ = 'Asia/Bangkok';
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-rank-');
const RealDate = Date; let NOW = RealDate.UTC(2026, 10, 4, 3, 0, 0); // พุธ 4 พ.ย. 2026
class FakeDate extends RealDate { constructor(...a) { if (a.length === 0) super(NOW); else super(...a); } static now() { return NOW; } }
global.Date = FakeDate;
const { World } = require('../server.js'), S = require('../public/shared.js'), { ADMIN_NAME } = require('../server/consts.js');

// ผังเมือง: ป้ายอันดับเป็น T.SHOP + townAt = 'rank' (ให้ปุ่ม Action ที่เซิร์ฟเวอร์ใช้ได้)
{
  const m = S.makeMap();
  assert.strictEqual(S.townAt(S.RANKBOARD.x, S.RANKBOARD.y), 'rank');
  assert.strictEqual(m[S.RANKBOARD.y][S.RANKBOARD.x], S.T.SHOP);
  assert.strictEqual(S.townAt(S.ATM.x, S.ATM.y), 'atm'); assert.strictEqual(m[S.ATM.y][S.ATM.x], S.T.SHOP);
  assert.strictEqual(S.townAt(S.BOARD.x, S.BOARD.y), 'board');
  assert.deepStrictEqual([S.BOARD.x, S.RANKBOARD.x, S.ATM.x, S.LUCKY.x], [30, 32, 34, 36]);
  assert.ok([30, 32, 34, 36].every((x, i, a) => !i || x - a[i - 1] === 2), 'ป้ายเรียงห่างเท่ากัน 2 ช่อง');
}

const w = new World('rank');
const sent = []; // ข้อความที่ส่งถึงผู้เล่น
const mk = (name, skills, coin = 100, extra = {}) => {
  const p = { name, key: name.toLowerCase(), id: name, x: 0, y: 0, ws: { readyState: 1, send(s) { sent.push([name, JSON.parse(s)]); } }, rec: Object.assign({ name, inv: { coin }, skills }, extra) };
  w.players.set(name, p); w.saved[p.key] = p.rec; return p;
};
const ask = p => { sent.length = 0; w.sendRank(p); const m = sent.find(x => x[0] === p.name && x[1].t === 'rank'); assert.ok(m, 'ต้องได้ข้อความ rank'); return m[1]; };
const fresh = () => { w._rank = null; };

const a = mk('Aaa', { farm: 5000, fish: 100, wood: 0 }, 500, { arc: { pts: 0, total: 30, wk: 10, wkKey: w.weekKey() }, wkx: { k: w.weekKey(), xp: 70 } });
const b = mk('Bbb', { farm: 3000, fish: 3000 }, 9000, { arc: { pts: 0, total: 90, wk: 0, wkKey: 'old' }, wkx: { k: w.weekKey(), xp: 200 } });
const c = mk('Ccc', { farm: 5000, fish: 100 }, 500); // ผู้เล่นเก่า ไม่มี wkx / arc
const bot = mk('Bot1', { farm: 10 }, 99999);          // XP น้อย = ไม่ใช่ผู้เล่นจริง
const adm = mk(ADMIN_NAME, { farm: 90000, fish: 90000 }, 999999, { arc: { total: 999, wk: 999, wkKey: w.weekKey() }, wkx: { k: w.weekKey(), xp: 99999 } });
fresh();

// ตัดผู้ดูแลและบัญชีที่ไม่ใช่ผู้เล่นจริง
let r = ask(a);
const names = x => x.map(y => y.n);
for (const list of [r.lv.all, r.lv.farm, r.wk, r.rich, r.arc.total, r.arc.wk]) assert.ok(!names(list).includes(ADMIN_NAME) && !names(list).includes('Bot1'), 'ต้องไม่มี Sira/บัญชีทดลอง');
assert.deepStrictEqual(me(ask(adm)), me({ me: { lv: Object.fromEntries(Object.keys(r.me.lv).map(k => [k, 0])), wk: 0, rich: 0, arc: 0 } }), 'ผู้ดูแลได้ me เป็น 0');
function me(x) { return x.me; }

// เรียงถูก + me ถูก
assert.strictEqual(r.rich[0].n, 'Bbb'); // เศรษฐีเรียงเหรียญมาก→น้อย
assert.deepStrictEqual(r.rich.map(x => x.coin), [9000, 500, 500]);
assert.strictEqual(r.me.rich, names(r.rich).indexOf('Aaa') + 1); assert.ok(r.me.rich >= 2);
assert.deepStrictEqual(names(r.wk), ['Bbb', 'Aaa']); assert.deepStrictEqual(r.wk.map(x => x.xp), [200, 70]);
assert.strictEqual(r.me.wk, 2); assert.strictEqual(ask(b).me.wk, 1); assert.strictEqual(ask(c).me.wk, 0, 'ไม่มี wkx = ยังไม่ติดสัปดาห์นี้ ไม่พัง');
assert.deepStrictEqual(r.arc.total.map(x => x.total), [90, 30]); assert.deepStrictEqual(r.arc.wk.map(x => x.wk), [10]);
assert.strictEqual(ask(b).me.arc, 1); assert.strictEqual(ask(c).me.arc, 0);
assert.ok(r.lv.all[0].lv >= r.lv.all[1].lv && r.lv.all[1].lv >= r.lv.all[2].lv, 'อันดับรวมเรียงตามผลรวมเลเวล');
assert.ok(r.lv.farm[0].lv >= r.lv.farm[1].lv); assert.deepStrictEqual(names(r.lv.wood), [], 'ไม่มี XP สาย wood = ลิสต์ว่าง');
for (const k of Object.keys(S.SKILLS)) assert.ok(Array.isArray(r.lv[k]), 'ต้องมีลิสต์ lv.' + k);
assert.ok(r.me.lv.all >= 1 && r.me.lv.wood === 0 && ask(bot).me.lv.all === 0, 'me รายอาชีพ/บัญชีตัดออก');
// เสมอเลเวล: ตัดสินด้วย XP (Aaa ฟาร์ม 5000 = Ccc ฟาร์ม 5000 เสมอ → ลำดับต้องคงที่ไม่ล่ม)
assert.ok(r.me.lv.farm >= 1 && r.me.lv.farm <= 3);

// ไม่ส่งข้อมูลเกินกำหนด: มีแต่ชื่อกับตัวเลข ไม่มีคีย์/อินเวนทอรี/PIN
{
  const raw = JSON.stringify(r);
  for (const bad of ['"k"', 'inv', 'pin', 'bank', 'key', 'ip']) assert.ok(!raw.includes('"' + bad.replace(/"/g, '') + '"'), 'ห้ามหลุดฟิลด์ ' + bad);
  const rowKeys = x => Object.keys(x).sort().join();
  assert.ok(r.lv.all.every(x => rowKeys(x) === 'lv,n')); assert.ok(r.lv.farm.every(x => rowKeys(x) === 'lv,n,xp'));
  assert.ok(r.wk.every(x => rowKeys(x) === 'n,xp')); assert.ok(r.rich.every(x => rowKeys(x) === 'coin,n'));
  assert.ok(r.arc.total.every(x => rowKeys(x) === 'n,total')); assert.ok(r.arc.wk.every(x => rowKeys(x) === 'n,wk'));
  assert.ok(r.lv.all.length <= S.RANK.top);
}

// Top 10 ตัดแค่ 10 แถว แต่ me บอกอันดับจริงเกิน 10
{
  for (let i = 0; i < 14; i++) mk('Pl' + i, { farm: 1000 + i }, 10 + i);
  fresh(); const q = ask(a);
  assert.strictEqual(q.rich.length, S.RANK.top); assert.ok(q.me.rich > 0);
  const lowest = w.players.get('Pl0');
  assert.ok(ask(lowest).me.rich > S.RANK.top, 'คนท้ายตารางได้อันดับจริงเกิน 10');
}

// แคช: เปลี่ยนเซฟแล้วไม่เห็นผลจนกว่าแคชหมดอายุ
{
  fresh(); ask(a); const before = ask(a).rich[0].coin;
  b.rec.inv.coin = 1; assert.strictEqual(ask(a).rich[0].coin, before, 'ในอายุแคชต้องได้ผลเดิม');
  NOW += S.RANK.cacheMs + 1000; assert.notStrictEqual(ask(a).rich[0].n, 'Bbb', 'แคชหมดอายุแล้วคำนวณใหม่');
}

// XP รายสัปดาห์: addXp สะสม และรีเซ็ตเมื่อ weekKey เปลี่ยน ผู้เล่นเก่าไม่มี wkx ไม่พัง
{
  const p = mk('Dee', { farm: 400 }, 0); fresh();
  assert.doesNotThrow(() => w.addXp(p, 'farm', 25)); assert.strictEqual(p.rec.wkx.xp, 25); assert.strictEqual(p.rec.wkx.k, w.weekKey());
  w.addXp(p, 'farm', 10); assert.strictEqual(p.rec.wkx.xp, 35);
  w.addXp(p, 'fish', 0); assert.strictEqual(p.rec.wkx.xp, 35, 'XP 0 ไม่นับ');
  fresh(); assert.ok(ask(p).me.wk > 0);
  assert.ok(names(ask(p).wk).includes('Dee'));
  const k0 = w.weekKey(); NOW = RealDate.UTC(2026, 10, 8, 17, 30, 0); // จันทร์ถัดไป 00:30 ไทย
  assert.notStrictEqual(w.weekKey(), k0);
  fresh(); assert.ok(!names(ask(p).wk).includes('Dee'), 'ข้ามสัปดาห์ XP เก่าไม่นับ');
  assert.deepStrictEqual(ask(p).arc.wk, [], 'แต้มตู้เกมรายสัปดาห์รีเซ็ตด้วย');
  w.addXp(p, 'farm', 5); assert.deepStrictEqual(p.rec.wkx, { k: w.weekKey(), xp: 5 }, 'addXp รีเซ็ตเริ่มสัปดาห์ใหม่');
}
console.log('rank ok');
process.exit(0);
