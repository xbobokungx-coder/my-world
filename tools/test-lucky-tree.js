// ทดสอบต้นตะเคียนขอเลขเด็ด (ป่าดงดิบ): node tools/test-lucky-tree.js
const fs = require('fs'), assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-luck-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, J = S.JUNGLE;
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('luck'), p = w.join(mkWs(), 'Luk', '#fff').p;
p.rec.starter = { done: {}, final: true }; p.rec.skills = { farm: 400, fish: 400, animal: 400, wood: 400, cook: 400 }; p.rec.inv.coin = 1000;
const L = w.lotto, P = S.LOTTO.price;
const at = (tx, ty) => { p.x = (tx + 0.5) * TS; p.y = (ty + 0.5) * TS; };
const last = t => [...p.ws.msgs].reverse().find(x => x.t === t);
const txt = () => p.ws.msgs.filter(x => x.t === 'toast' || x.t === 'msg').map(x => x.text || x.m || JSON.stringify(x)).join('|');
const ask = () => { p.ws.msgs.length = 0; w.handle(p, { t: 'lotto', a: 'luck' }); return last('luck'); };
const buy = (nums, luck = 1) => { p.ws.msgs.length = 0; w.handle(p, { t: 'lotto', a: 'buy', nums, luck }); };
const mine = () => (L.tickets[p.key] || []).slice();

// ผัง
assert.strictEqual(J.rows[J.lucky.y][J.lucky.x], 'K'); assert.strictEqual(S.makeJungleMap()[J.lucky.y][J.lucky.x], S.T.BUILD);
assert.ok(S.jungleSafe((J.lucky.x + 0.5) * TS, (J.lucky.y + 0.5) * TS), 'ต้นอยู่ในเขตปลอดภัย');

// นอกป่า ขอไม่ได้
at(J.lucky.x, J.lucky.y + 1); assert.ok(!ask() && !p.luck, 'นอกป่าขอไม่ได้');
w.warpTo(p, 'jungle'); assert.strictEqual(p.scene, '@cave97');
// ไกล ขอไม่ได้
at(J.lucky.x, J.lucky.y + 4); assert.ok(!ask() && !p.luck, 'ไกลขอไม่ได้');
// ใกล้ ขอได้ 3 ชุดไม่ซ้ำ
at(J.lucky.x, J.lucky.y + 2); const r1 = ask();
assert.ok(r1 && r1.nums.length === 3 && new Set(r1.nums).size === 3 && r1.nums.every(x => /^\d{3}$/.test(x)), 'ได้ 3 ชุดไม่ซ้ำ');
assert.deepStrictEqual([r1.round, r1.bought, r1.price, r1.open, r1.lvOk], [L.round, [], P, true, true]);
// ซ้ำในงวดเดิม = ชุดเดิม
const r2 = ask(); assert.deepStrictEqual(r2.nums, r1.nums); assert.ok(txt().includes('รับเลขแล้ว'));
// Action หันหน้า/แตะที่ต้น
{ delete p.luck; at(J.lucky.x, J.lucky.y + 1); p.dir = 1; p.lastAct = 0; p.ws.msgs.length = 0; w.handle(p, { t: 'act', tool: 'hand' }); assert.ok(last('luck'), 'หันหน้าหาต้นแล้ว Action');
  delete p.luck; at(J.lucky.x - 3, J.lucky.y + 1); p.lastAct = 0; p.ws.msgs.length = 0; w.handle(p, { t: 'act', tool: 'hand', tx: J.lucky.x, ty: J.lucky.y }); assert.ok(!last("luck"), "แตะต้นแต่ไกลเกิน 2 ช่อง");
  at(J.lucky.x, J.lucky.y + 2); p.lastAct = 0; p.ws.msgs.length = 0; w.handle(p, { t: 'act', tool: 'hand', tx: J.lucky.x, ty: J.lucky.y }); const rr = last('luck'); assert.ok(rr, 'แตะต้น'); Object.assign(r1, { nums: rr.nums }); }
const nums = r1.nums;
// ซื้อ: เลขนอกชุด/ซ้ำในคำขอ/ว่าง ปฏิเสธ ไม่สุ่มแทน
const c0 = p.rec.inv.coin;
for (const bad of [['000', '111'].filter(x => !nums.includes(x)), [nums[0], nums[0]], [], 'abc', [123], [nums[0], '999'].filter(x => x !== nums[0] && !nums.includes(x)).concat(nums[0]), nums.concat(nums[0])]) { buy(bad); assert.strictEqual(mine().length, 0, 'ปฏิเสธ ' + JSON.stringify(bad)); assert.strictEqual(p.rec.inv.coin, c0); }
// ซื้อไม่ได้ถ้าไกลต้น (ไม่ข้ามด้วย nearLucky)
at(J.lucky.x + 6, J.lucky.y); buy([nums[0]]); assert.strictEqual(mine().length, 0, 'ไกลต้นซื้อไม่ได้');
// ซื้อได้ในป่าใกล้ต้น ใช้เหรียญ/กองกลางเหมือนปกติ
at(J.lucky.x, J.lucky.y + 3); const pot0 = L.pot; buy([nums[0], nums[1]]);
assert.deepStrictEqual(mine(), [nums[0], nums[1]]); assert.strictEqual(p.rec.inv.coin, c0 - 2 * P); assert.strictEqual(L.pot, pot0 + 2 * P);
assert.deepStrictEqual(last('luck').bought, [nums[0], nums[1]]);
// ซื้อชุดเดิมซ้ำไม่ได้
buy([nums[0]]); assert.strictEqual(mine().length, 2); buy([nums[2]]); assert.strictEqual(mine().length, 3);
// ปิดรับ / เลเวล / ครบใบ / โควตา IP
{ const o = S.LOTTO.closeMs; p.rec.inv.coin = 1000;
  // ขอเลขใหม่ด้วยการสร้างชุดใหม่ในงวดเดียวกัน (จำลอง) แล้วลองปฏิเสธต่างๆ
  const fresh = () => { p.luck = { round: L.round, nums: ['101', '202', '303'], bought: [] }; L.tickets[p.key] = []; delete L.ipTickets; };
  fresh(); S.LOTTO.closeMs = 1e12; buy(['101']); assert.strictEqual(mine().length, 0, 'ปิดรับ'); assert.ok(txt().includes('ปิดรับ')); assert.strictEqual(w.luckPub(p).open, false); S.LOTTO.closeMs = o;
  fresh(); const sk = p.rec.starter; p.rec.starter = { done: {}, final: false }; buy(['101']); assert.strictEqual(mine().length, 0, 'ยังไม่ผ่านคู่มือ/เลเวลไม่ถึง'); assert.strictEqual(w.lottoOk(p), false); p.rec.starter = sk; const mn = S.LOTTO.minLv; S.LOTTO.minLv = 999; fresh(); buy(['101']); assert.strictEqual(mine().length, 0, 'เลเวลไม่ถึง'); S.LOTTO.minLv = mn;
  fresh(); L.tickets[p.key] = Array(S.LOTTO.maxTickets).fill('555'); buy(['101']); assert.strictEqual(mine().length, S.LOTTO.maxTickets, 'ครบใบ');
  fresh(); p.ip = '9.9.9.9'; L.ipTickets = { '9.9.9.9': S.LOTTO.ipMax }; buy(['101']); assert.strictEqual(mine().length, 0, 'โควตา IP'); delete p.ip;
  fresh(); p.rec.inv.coin = P - 1; buy(['101']); assert.strictEqual(mine().length, 0, 'เหรียญไม่พอ'); p.rec.inv.coin = 1000; }
// งวดเปลี่ยน: ซื้อด้วยชุดเก่าไม่ได้ ขอใหม่ได้
{ const old = p.luck.nums.slice(); L.tickets = {}; w.lottoDraw(); assert.notStrictEqual(p.luck.round, L.round);
  at(J.lucky.x, J.lucky.y + 1); buy([old[0]]); assert.strictEqual(mine().length, 0, 'ชุดงวดเก่าซื้อไม่ได้');
  const rn = ask(); assert.ok(rn && rn.round === L.round && rn.bought.length === 0, 'งวดใหม่ขอใหม่ได้'); }
// ออกจากป่า: ซื้อด้วย luck:1 ไม่ข้าม nearLucky
w.leaveCave(p); at(J.lucky.x, J.lucky.y + 1); buy([p.luck.nums[0]]); assert.strictEqual(mine().length, 0, 'นอกป่าซื้อด้วย luck ไม่ได้');
// เลขไม่รั่วจากเลขที่ล็อก: โค้ด handler ไม่แตะ sealed
{ const src = fs.readFileSync(require.resolve('../server/systems/lotto.js'), 'utf8'); const seg = src.slice(src.indexOf('luckNear('), src.indexOf('lottoJoin(p)'));
  assert.ok(!/sealed/.test(seg.replace(/\/\/.*$/gm, '')), 'ส่วนต้นตะเคียน/ซื้อไม่อ่าน L.sealed'); }
console.log('✓ ผ่าน: ต้นตะเคียนขอเลขเด็ด');
// ช่องโหว่ที่ reviewer พบ: ในป่าส่ง claim/buy ที่มี luck ปลอม หรืออยู่ใกล้พิกัดตู้เมืองบนผืนแมพป่า ต้องไม่ผ่านด่านตู้ Lucky Lotto
{ const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8'); assert.ok(/m\.a === 'buy' && \(m\.luck === 1 \|\| m\.luck === true\)/.test(src), 'ด่านต้น handle ยกเว้นเฉพาะ buy+luck:1');
  const ls = require('fs').readFileSync(require('path').join(__dirname, '..', 'server', 'systems', 'lotto.js'), 'utf8'); assert.ok(/nearLucky\(p\) \{ if \(p\.scene\) return false;/.test(ls), 'nearLucky ปฏิเสธเมื่ออยู่ในฉากแยก'); }
console.log('✓ ผ่าน: lucky-tree gate');

process.exit(0);
