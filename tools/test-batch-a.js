// ทดสอบชุด A: ฤดู 1 วัน • ล็อกผลผลิตสัตว์ (ตัวเอง 1 วันเกม / เพื่อน 3 นาที) • ผู้ดูแล (ความหิว/+1,000/On Develop) • ลงจากรถตอนทำงาน
// รัน: node tools/test-batch-a.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-batcha-');
let NOW = Date.now(); Date.now = () => NOW;
const { World, adminHandle: A, devStatus, devReply, worlds } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('batcha'); w.themeRain = () => 'off'; worlds.set('batcha', w);
let seq = 0;
const mk = (admin) => { const ws = mkWs(), p = w.join(ws, 'ba' + (++seq), '#fff', !!admin).p; p.ws2 = ws; p.rec.inv = { coin: 0 }; p.rec.hunger = 100; p.rec.starter = { done: {}, final: true }; return p; };
const at = (p, x, y, d) => { p.x = (x + 0.5) * TS; p.y = (y + 0.5) * TS; p.dir = d; };
const act = (p, tool) => { NOW += 1000; w.handle(p, { t: 'act', tool }); };

// 1) ฤดูเปลี่ยนวันละครั้ง
assert.strictEqual(S.SEASONS.days, 1);
{ const a = S.seasonAt(S.SEASONS.epoch + 3600e3), b = S.seasonAt(S.SEASONS.epoch + 25 * 3600e3), c = S.seasonAt(S.SEASONS.epoch + 49 * 3600e3), d = S.seasonAt(S.SEASONS.epoch + 73 * 3600e3);
  assert.deepStrictEqual([a.s.id, b.s.id, c.s.id, d.s.id], ['hot', 'rain', 'cool', 'hot']); assert.strictEqual(a.end - S.SEASONS.epoch, 864e5); }

// 2) ล็อกผลผลิตสัตว์
{
  const o = mk(), f = mk();
  const hen = (owner, feeder, pm) => { const a = w.spawnAnimal('chicken', owner); a.prod = true; a.fed = false; a.feeder = feeder.key; a.fn = feeder.name; a.pm = pm; return a; };
  assert.strictEqual(S.animalLockMs({ owner: 'x', feeder: 'x' }), S.DAY_MS); assert.strictEqual(S.animalLockMs({ owner: 'x', feeder: 'y' }), 180000);
  // เพื่อนป้อนสัตว์ของเจ้าของ: ล็อก 3 นาที เจ้าของเก็บไม่ได้ก่อนครบ
  let a = hen(o, f, 0); at(o, 47, 12, 0); a.x = o.x; a.y = o.y; o.rec.inv.egg = 0; act(o, 'hand'); assert.ok(!o.rec.inv.egg && a.prod, 'ก่อนครบ 3 นาที เจ้าของยังเก็บไม่ได้');
  a.pm = 180000; act(o, 'hand'); assert.strictEqual(o.rec.inv.egg, 1, 'ครบ 3 นาที เจ้าของเก็บได้'); a.dead = true; w.animals = w.animals.filter(x => x !== a);
  // เจ้าของป้อนเอง: 3 นาทียังล็อก (คนอื่นเก็บไม่ได้) จนครบ 1 วันเกม
  a = hen(o, o, 180000); at(f, 47, 12, 0); a.x = f.x; a.y = f.y; f.rec.inv.egg = 0; act(f, 'hand'); assert.ok(!f.rec.inv.egg, 'ของเจ้าของเอง ยังล็อก 1 วัน');
  a.pm = S.DAY_MS; act(f, 'hand'); assert.strictEqual(f.rec.inv.egg, 1); w.animals = w.animals.filter(x => x !== a);
}

// 3) ผู้ดูแล (โหมดเทสต์ require ไม่ได้ตั้ง ROOMS/roomsPub ที่ reply ใช้ จึงกลืน ReferenceError ตอนตอบกลับ ผลที่ตรวจคือสถานะที่เปลี่ยนก่อนตอบ)
{
  const adminHandle = (p, w, m) => { try { return A(p, w, m); } catch (e) { if (!(e instanceof ReferenceError)) throw e; } };
  const adm = mk(true), pl = mk(false), c0 = pl.rec.inv.coin;
  adminHandle(pl, w, { a: 'coin1k' }); adminHandle(pl, w, { a: 'hunger', on: false }); assert.strictEqual(pl.rec.inv.coin, c0); assert.ok(!pl.noHunger, 'ผู้เล่นทั่วไปสั่งไม่ได้');
  adminHandle(adm, w, { a: 'coin1k' }); assert.strictEqual(adm.rec.inv.coin, 1000); adminHandle(adm, w, { a: 'coin1k' }); assert.strictEqual(adm.rec.inv.coin, 2000);
  adminHandle(adm, w, { a: 'hunger', on: 'no' }); assert.ok(!adm.noHunger, 'ค่าไม่ใช่ boolean ถูกปฏิเสธ');
  adminHandle(adm, w, { a: 'hunger', on: false }); assert.strictEqual(adm.noHunger, true);
  adminHandle(adm, w, { a: 'hunger', on: true }); assert.strictEqual(adm.noHunger, false);
  const d = devStatus(); assert.strictEqual(d.on, true); assert.ok(d.sec >= 0);
  worlds.delete('batcha'); const off = devStatus(); assert.strictEqual(off.on, false); worlds.set('batcha', w);
  assert.strictEqual(devStatus().t, 'dev');
  // On Develop เฉพาะผู้ดูแล: ผู้เล่นทั่วไปไม่ได้ข้อมูล (ทั้งข้อความ w ตอนเข้าเกม และตอบ {t:'dev'})
  assert.ok(devReply(adm) && devReply(adm).t === 'dev', 'ผู้ดูแลได้ dev'); assert.strictEqual(devReply(pl), null, 'ผู้เล่นทั่วไปไม่ได้ dev (ไม่ตอบ)');
  { const wa = mkWs(), wp = mkWs(); w.join(wa, 'devadm', '#fff', true); w.join(wp, 'devplr', '#fff', false);
    const wa0 = wa.msgs.find(m => m.t === 'w'), wp0 = wp.msgs.find(m => m.t === 'w');
    assert.ok(wa0.dev && wa0.dev.t === 'dev' && wa0.dev.on === true, 'ผู้ดูแลมี dev ใน w'); assert.ok(!('dev' in wp0), 'ผู้เล่นทั่วไปไม่มีฟิลด์ dev ใน w'); }
}

// 4) ขับรถแล้วทำงาน = ลงจากรถ ไม่ทำการกระทำนั้น
{
  const p = mk(); p.rec.inv.veh_bike = 1; const vk = Object.keys(S.VEHICLES)[0]; p.rec.inv['veh_' + vk] = 1; p.scene = null;
  at(p, 30, 30, 0); w.setVeh(p, vk); assert.strictEqual(p.veh, vk);
  const before = JSON.stringify(p.rec.inv); p.ws2.msgs.length = 0; act(p, 'axe');
  assert.strictEqual(p.veh, ''); assert.strictEqual(p.rec.veh, ''); assert.ok(p.ws2.msgs.some(m => m.t === 'veh' && m.v === ''), 'แจ้งฝั่งเว็บ'); assert.strictEqual(JSON.stringify(p.rec.inv), before, 'ไม่ทำการกระทำ');
  w.setVeh(p, vk); act(p, 'rod'); assert.strictEqual(p.veh, '', 'ตกปลาตอนขับ = ลงรถ'); assert.ok(!p.fish, 'ไม่เริ่มตกปลา');
}
console.log('test-batch-a ผ่านทั้งหมด'); process.exit(0);
