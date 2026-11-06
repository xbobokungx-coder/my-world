// ทดสอบโรงหนัง: จ่ายค่าตั๋ว/ไม่จ่ายซ้ำ/ปิดเมื่อไม่มีคนดู/หนังจบ (characterization): node tools/test-cinema.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-cinema-');
delete process.env.CIN_EMPTY_MS; // ใช้ค่าตั้งต้น 20 วินาที
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;

const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('cinema'), c = w.cinema;
function mk(name, coin = 1000) {
  const ws = mkWs(), p = w.join(ws, name, '#fff').p; p.ws2 = ws; p.rec.inv = { coin };
  p.rec.starter = { done: {}, final: true };
  const q = w.questsOf(p); for (const it of q.list) it.done = true; q.bonus = true;
  p.rec.ach = { cnt: {}, got: Object.fromEntries(S.ACH.map(d => [d.id, 1])) }; // กันเหรียญโบนัสปนกับค่าตั๋ว
  p.x = S.CINEMA_CENTER.x; p.y = S.CINEMA_CENTER.y;
  return p;
}
const cin = (p, m) => w.handle(p, Object.assign({ t: 'cin' }, m));
const coin = p => p.rec.inv.coin || 0;
const mv = S.MOVIES[0];

const a = mk('CinA'), b = mk('CinB'), far = mk('CinFar'); far.x = 0; far.y = 0;
assert.strictEqual(c.movie, null);

// ---- เปิดฉาย ----
cin(far, { a: 'play', id: mv.id }); assert.strictEqual(c.movie, null, 'อยู่ไกลจอเปิดฉายไม่ได้'); assert.strictEqual(coin(far), 1000, 'ไม่เสียค่าตั๋ว');
cin(a, { a: 'play', id: 'nope' }); assert.strictEqual(c.movie, null, 'ลิงก์/รหัสไม่ถูกต้องไม่เปิด'); assert.strictEqual(coin(a), 1000, 'เปิดไม่สำเร็จไม่หักเงิน');
a.rec.inv.coin = S.TICKET - 1; cin(a, { a: 'play', id: mv.id }); assert.strictEqual(c.movie, null, 'เหรียญไม่พอซื้อตั๋วเปิดฉายไม่ได้'); assert.strictEqual(coin(a), S.TICKET - 1); assert.deepStrictEqual([...c.paid], []);
a.rec.inv.coin = 1000;
cin(a, { a: 'play', id: mv.id });
assert.strictEqual(c.movie, mv.id); assert.strictEqual(coin(a), 1000 - S.TICKET, 'ผู้เปิดฉายจ่ายค่าตั๋ว'); assert.ok(c.paid.has(a.key)); assert.ok(c.viewers.has(a.id) && c.viewers.size === 1); assert.strictEqual(c.playing, true);
assert.ok(b.ws2.msgs.some(m => m.t === 'msg' && /เปิดฉาย/.test(m.text)), 'ประกาศให้ทุกคนรู้');
cin(b, { a: 'play', id: S.MOVIES[1].id }); assert.strictEqual(c.movie, mv.id, 'กำลังฉายอยู่เปิดซ้อนไม่ได้'); assert.strictEqual(coin(b), 1000);
console.log('  เปิดฉาย: ไกลจอ/รหัสผิด/เหรียญไม่พอ ไม่หักเงิน • สำเร็จหักค่าตั๋ว + เป็นผู้ชมคนแรก');

// ---- เข้าชม: จ่ายครั้งเดียวต่อรอบ ----
cin(far, { a: 'watch' }); assert.ok(!c.viewers.has(far.id), 'อยู่ไกลจอเข้าชมไม่ได้'); assert.strictEqual(coin(far), 1000);
b.rec.inv.coin = S.TICKET - 1; cin(b, { a: 'watch' }); assert.ok(!c.viewers.has(b.id), 'เหรียญไม่พอเข้าชมไม่ได้'); assert.strictEqual(coin(b), S.TICKET - 1);
b.rec.inv.coin = 1000; cin(b, { a: 'watch' }); assert.ok(c.viewers.has(b.id)); assert.strictEqual(coin(b), 1000 - S.TICKET); assert.ok(c.paid.has(b.key));
cin(b, { a: 'leave' }); assert.ok(!c.viewers.has(b.id), 'ออกจากโรง'); cin(b, { a: 'watch' }); assert.ok(c.viewers.has(b.id)); assert.strictEqual(coin(b), 1000 - S.TICKET, 'ซื้อตั๋วแล้วกลับเข้าชมใหม่ในรอบเดียวกันไม่เสียซ้ำ');
console.log('  เข้าชม: จ่ายครั้งเดียวต่อรอบ ออก-เข้าใหม่ไม่เสียซ้ำ');

// ---- ผู้ชมกดเล่น/หยุด/เลื่อน (sync) ----
cin(far, { a: 'sync', pos: 50, playing: false }); assert.strictEqual(c.pos, 0, 'คนนอกโรงสั่งไม่ได้');
cin(b, { a: 'sync', pos: 50, playing: false }); assert.strictEqual(c.pos, 50); assert.strictEqual(c.playing, false); assert.strictEqual(w.cinemaPos(Date.now() + 99999), 50, 'หยุดอยู่ ตำแหน่งไม่เดิน');
c.lastSync = 0; cin(b, { a: 'sync', pos: 'x' }); assert.strictEqual(c.pos, 50, 'ตำแหน่งไม่ใช่ตัวเลขไม่รับ');
c.lastSync = 0; cin(a, { a: 'sync', pos: 10, playing: true }); assert.strictEqual(c.pos, 10); assert.strictEqual(c.playing, true);

// ---- ไม่มีคนดู: ปิดหลังเกิน EMPTY_MS (ใช้ now ที่ส่งเข้า cinemaTick ไม่ใช้เวลาจริง) ----
const EMPTY = 20000, t0 = Date.now();
w.cinemaTick(t0); assert.strictEqual(c.emptyAt, 0, 'ยังมีผู้ชม ไม่นับเวลาว่าง');
w.leave(b); assert.ok(!c.viewers.has(b.id), 'ผู้ชมหลุดจากเกม ถูกเอาออกจากโรง'); assert.ok(c.viewers.has(a.id));
cin(a, { a: 'leave' }); assert.strictEqual(c.viewers.size, 0); assert.strictEqual(c.movie, mv.id, 'ผู้ชมออกหมดแล้ว หนังยังไม่ปิดทันที');
w.cinemaTick(t0); assert.strictEqual(c.emptyAt, t0, 'เริ่มนับเวลาว่าง'); assert.strictEqual(c.movie, mv.id);
w.cinemaTick(t0 + EMPTY - 1); assert.strictEqual(c.movie, mv.id); w.cinemaTick(t0 + EMPTY); assert.strictEqual(c.movie, mv.id, 'ต้องเกิน EMPTY_MS ถึงปิด (ไม่ใช่เท่ากับ)');
// กลับมาดูก่อนปิด → รีเซ็ตตัวนับ
cin(a, { a: 'watch' }); assert.strictEqual(c.emptyAt, 0); assert.strictEqual(coin(a), 1000 - S.TICKET, 'เคยจ่ายแล้ว กลับมาดูไม่เสียซ้ำ'); w.cinemaTick(t0 + EMPTY * 5); assert.strictEqual(c.movie, mv.id, 'มีผู้ชมอยู่ ไม่ปิด');
cin(a, { a: 'leave' }); w.cinemaTick(t0 + 100000); w.cinemaTick(t0 + 100000 + EMPTY + 1);
assert.strictEqual(c.movie, null, 'ไม่มีคนดูนานเกิน EMPTY_MS ปิดโรง'); assert.strictEqual(c.viewers.size, 0); assert.strictEqual(c.paid.size, 0, 'ปิดแล้วล้างรายชื่อผู้ซื้อตั๋ว');
assert.ok(a.ws2.msgs.some(m => m.t === 'msg' && /ไม่มีคนดูแล้ว ปิดโรงหนัง/.test(m.text)), 'ประกาศปิดโรง');
cin(b, { a: 'watch' }); assert.ok(!c.viewers.has(b.id), 'โรงปิดอยู่ เข้าชมไม่ได้');
console.log('  ปิดเมื่อไม่มีคนดู: เกิน EMPTY_MS ถึงปิด/กลับมาดูรีเซ็ต/หลุดเกมถูกเอาออก/ล้างตั๋ว');

// ---- ตั๋วรอบใหม่ + ลิงก์ YouTube + หนังจบเอง ----
const b2 = mk('CinB2'); a.rec.inv.coin = 1000;
cin(a, { a: 'play', url: 'https://youtu.be/dQw4w9WgXcQ' }); assert.strictEqual(c.movie, 'custom'); assert.strictEqual(c.yt, 'dQw4w9WgXcQ'); assert.strictEqual(coin(a), 1000 - S.TICKET);
cin(b2, { a: 'watch' }); assert.strictEqual(coin(b2), 1000 - S.TICKET, 'รอบใหม่ ต้องซื้อตั๋วใหม่');
cin(a, { a: 'end' }); assert.strictEqual(c.movie, 'custom', 'กดจบก่อนฉายเกิน 5 วินาทีไม่ได้');
w.cinemaEnd(); assert.strictEqual(c.movie, null);
cin(a, { a: 'play', id: mv.id }); cin(b2, { a: 'watch' });
w.cinemaTick(Date.now() + (mv.sec + 2) * 1000); assert.strictEqual(c.movie, mv.id, 'ยังไม่เกินความยาวหนัง + 3 วินาที');
w.cinemaTick(Date.now() + (mv.sec + 10) * 1000); assert.strictEqual(c.movie, null, 'ฉายจบตามความยาวหนัง ปิดรอบเอง'); assert.strictEqual(c.viewers.size, 0);
assert.ok(b2.ws2.msgs.some(m => m.t === 'msg' && /หนังจบแล้ว/.test(m.text)));
console.log('  รอบใหม่ซื้อตั๋วใหม่/ลิงก์ YouTube/หนังจบตามความยาว');

console.log('cinema ok');
process.exit(0);
