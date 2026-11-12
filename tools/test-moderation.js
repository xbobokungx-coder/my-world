// ทดสอบเครื่องมือดูแลชุมชน (WP-06): node tools/test-moderation.js
// กรองคำ • บล็อก (แชต+rtc+pcall สองทาง) • รายงาน+rate limit • แชตย้อนหลัง/ลบไฟล์เก่า • mute/ban ชั่วคราวหมดเวลา • non-admin เรียก admin ไม่ได้
const fs = require('fs'), path = require('path'), assert = require('assert'), { spawn } = require('child_process');
const DATA = require('./testlib').tmpDataDir('mw-mod-');
process.env.DATA_DIR = DATA;
const { World } = require('../server.js'), S = require('../public/shared.js'), M = S.MODERATION;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const w = new World('main');
const mk = (name, id) => { const msgs = [], p = { name, key: name.toLowerCase(), id, lastChat: 0, x: 0, y: 0, ws: { readyState: 1, send(s) { msgs.push(JSON.parse(s)); } }, msgs, rec: { name, inv: { coin: 100 } } }; w.players.set(id, p); w.saved[p.key] = p.rec; return p; };
const chats = p => p.msgs.filter(m => m.t === 'chat').map(m => m.text);
const say = (p, text) => { p.lastChat = 0; w.handle(p, { t: 'chat', text }); };

(async () => {
  // ---- 1) กรองคำหยาบ ----
  {
    assert.strictEqual(w.modFilter('สวัสดีครับ วันนี้อากาศดี'), 'สวัสดีครับ วันนี้อากาศดี', 'ข้อความปกติไม่ถูกแตะ');
    assert.strictEqual(w.modFilter('ขอหีบไม้หน่อย class pass'), 'ขอหีบไม้หน่อย class pass', 'คำปกติที่หน้าตาคล้ายต้องไม่โดนกรอง');
    assert.strictEqual(w.modFilter('you are a Fuck'), 'you are a ***');
    assert.strictEqual(w.modFilter('f u c k you'), '*** you', 'เว้นวรรคเลี่ยงได้ไม่ได้');
    assert.strictEqual(w.modFilter('fuuuuck'), '***', 'ซ้ำตัวเลี่ยงไม่ได้');
    assert.strictEqual(w.modFilter('SHIT'), '***'); assert.strictEqual(w.modFilter('sh1t'), '***', 'เลขแทนตัวอักษร');
    assert.ok(w.modFilter('ไอ้เหี้ยยย ทำไรอยู่').includes('***') && !w.modFilter('ไอ้เหี้ยยย ทำไรอยู่').includes('เหี้ย'), 'คำไทยซ้ำตัว');
    assert.ok(w.modFilter('ค ว ย').includes('***'), 'เว้นวรรคคำไทย');
    assert.ok(w.modFilter('55555 😀 ok') === '55555 😀 ok', 'เลข/อีโมจิไม่ถูกกรอง');
    fs.writeFileSync(path.join(DATA, 'badwords.txt'), '# คอมเมนต์\n\nโง่มาก\n'); // ไฟล์เสริมแก้ได้โดยไม่แก้โค้ด (แคชรีเฟรชตามเวลา)
    await sleep(5); const m0 = M.wordsRefreshMs; M.wordsRefreshMs = 0;
    assert.strictEqual(w.modFilter('เธอโง่มากเลย'), 'เธอ***เลย', 'badwords.txt มีผล'); M.wordsRefreshMs = m0;
    console.log('  กรองคำ: ok');
  }

  // ---- 2) บล็อก ----
  const A = mk('Aaa', 1), B = mk('Bbb', 2), C = mk('Ccc', 3), ADM = mk('Sira', 4); ADM.admin = true;
  {
    say(A, 'fuck สวัสดี'); assert.deepStrictEqual(chats(B), ['*** สวัสดี'], 'แชตถูกกรองก่อนส่ง'); assert.deepStrictEqual(chats(A), ['*** สวัสดี'], 'ผู้พูดเห็นข้อความของตัวเอง');
    for (const bad of [{ id: 2 }, { id: 2, on: 1 }, { id: 'x', on: true }, { id: 99, on: true }, { id: 1, on: true }, { on: true }, { name: 'bbb', on: true }]) w.handle(A, Object.assign({ t: 'block' }, bad));
    assert.strictEqual(A.rec.blocks, undefined, 'ข้อมูลเสียรูป/บล็อกตัวเอง/บล็อกด้วยชื่อ (ต้องใช้ id) ไม่มีผล');
    w.handle(A, { t: 'block', id: 2, on: true });
    assert.deepStrictEqual(A.rec.blocks, ['bbb']); assert.ok(w.dirty, 'dirty'); w.handle(A, { t: 'block', id: 2, on: true }); assert.strictEqual(A.rec.blocks.length, 1, 'บล็อกซ้ำไม่เพิ่ม');
    const bl = A.msgs.filter(m => m.t === 'blocks').pop(); assert.deepStrictEqual(bl.list, [{ key: 'bbb', name: 'Bbb' }]); assert.deepStrictEqual(bl.ids, [2]);
    B.msgs.length = 0; A.msgs.length = 0; C.msgs.length = 0;
    say(B, 'ทักทาย'); assert.deepStrictEqual(chats(A), [], 'A บล็อก B: A ไม่เห็นแชต B'); assert.deepStrictEqual(chats(C), ['ทักทาย']); assert.deepStrictEqual(chats(B), ['ทักทาย']);
    say(A, 'ตอบ'); assert.deepStrictEqual(chats(B), ['ทักทาย', 'ตอบ'].slice(0, 1), 'B ไม่เห็นแชต A (บล็อกสองทาง)');
    // rtc / pcall ทั้งสองทาง
    A.msgs.length = 0; B.msgs.length = 0; C.msgs.length = 0;
    w.handle(A, { t: 'rtc', to: 2, d: { x: 1 } }); w.handle(B, { t: 'rtc', to: 1, d: { x: 1 } }); w.handle(A, { t: 'pcall', to: 2, k: 'ring' }); w.handle(B, { t: 'pcall', to: 1, k: 'ring' });
    assert.ok(!A.msgs.some(m => m.t === 'rtc' || m.t === 'pcall') && !B.msgs.some(m => m.t === 'rtc' || m.t === 'pcall'), 'rtc/pcall ไม่ถูกส่งต่อระหว่างคู่ที่บล็อก');
    w.handle(A, { t: 'rtc', to: 3, d: { x: 1 } }); assert.ok(C.msgs.some(m => m.t === 'rtc'), 'คนอื่นยังส่ง rtc ได้'); w.handle(C, { t: 'pcall', to: 1, k: 'ring' }); assert.ok(A.msgs.some(m => m.t === 'pcall' && m.from === 3));
    // แชตเก่าในห้อง: คนที่บล็อกไม่เห็นตอนเข้า
    assert.ok(w.chatLog.some(c => c.name === 'Bbb') && !w.chatLog.filter(c => !A.rec.blocks.includes(c.name.toLowerCase())).some(c => c.name === 'Bbb'));
    w.handle(A, { t: 'block', id: 2, on: false }); assert.deepStrictEqual(A.rec.blocks, []); B.msgs.length = 0; say(A, 'กลับมาคุยกัน'); assert.deepStrictEqual(chats(B), ['กลับมาคุยกัน'], 'เลิกบล็อกแล้วเห็นกัน');
    w.handle(A, { t: 'block', name: 'zzz', on: false }); assert.deepStrictEqual(A.rec.blocks, [], 'เลิกบล็อกชื่อที่ไม่มีอยู่ไม่พัง');
    // เพดาน
    for (let i = 0; i < M.blockMax + 5; i++) { const q = mk('Dum' + i, 100 + i); w.handle(A, { t: 'block', id: q.id, on: true }); }
    assert.strictEqual(A.rec.blocks.length, M.blockMax, 'บล็อกไม่เกินเพดาน');
    for (let i = 0; i < M.blockMax + 5; i++) w.players.delete(100 + i);
    console.log('  บล็อก: ok');
  }

  // ---- 3) รายงาน ----
  {
    const D = mk('Ddd', 5), RD = path.join(DATA, 'reports'), now0 = Date.now(), nfiles = () => { try { return fs.readdirSync(RD).length; } catch (e) { return 0; } };
    const rep = (p, o) => w.handle(p, Object.assign({ t: 'report' }, o));
    for (const bad of [{ id: 5, why: 'abuse' }, { id: 1, why: 'bogus' }, { id: 4, why: 'abuse' }, { name: 'sira', why: 'abuse' }, { id: 99, why: 'abuse' }, { why: 'abuse' }, { id: 'x', why: 'abuse' }, { name: 'ไม่มีคนนี้', why: 'abuse' }]) rep(C, bad.id === 5 ? Object.assign({}, bad, { id: 3 }) : bad);
    assert.strictEqual(nfiles(), 0, 'รายงานเสียรูป/ตัวเอง/ผู้ดูแล/ไม่มีคน ไม่เขียนไฟล์');
    rep(D, { id: 5, why: 'abuse' }); assert.strictEqual(nfiles(), 0, 'รายงานตัวเองไม่ได้');
    rep(D, { id: 4, why: 'abuse' }); assert.strictEqual(nfiles(), 0, 'รายงานผู้ดูแลไม่ได้');
    D.msgs.length = 0; say(A, 'ข้อความก่อนรายงาน'); say(B, 'อีกข้อความ');
    ADM.msgs.length = 0; rep(D, { id: 2, why: 'abuse', text: 'ก'.repeat(300) + '\u0007' });
    assert.strictEqual(nfiles(), 1); const f = fs.readdirSync(RD)[0], r = JSON.parse(fs.readFileSync(path.join(RD, f), 'utf8'));
    assert.strictEqual(r.by, 'Ddd'); assert.strictEqual(r.targetKey, 'bbb'); assert.strictEqual(r.why, 'abuse'); assert.strictEqual(r.text.length, M.reportTextMax, 'text ถูกตัด'); assert.ok(r.chat.length >= 2 && r.chat.length <= M.reportChatLines && r.chat.every(c => c.name && c.text));
    assert.ok(ADM.msgs.some(m => m.t === 'msg' && /รายงาน/.test(m.text)), 'แจ้งผู้ดูแลที่ออนไลน์');
    rep(D, { id: 3, why: 'cheat' }); assert.strictEqual(nfiles(), 1, 'ห่างไม่ถึง 30 วิ ถูกทิ้ง');
    // ผ่านไป 30 วิ แล้วรายงานต่อจนครบ 10 ครั้ง/ชม.
    const E = mk('Eee', 6); let sent = 0;
    const realNow = Date.now; let fake = realNow();
    Date.now = () => fake;
    try { for (let i = 0; i < 14; i++) { const before = nfiles(); rep(E, { id: 1 + (i % 3), why: 'other', text: 'x' }); if (nfiles() > before) sent++; fake += 31000; } } finally { Date.now = realNow; }
    assert.strictEqual(sent, M.reportPerHour, 'ไม่เกิน 10 ครั้ง/ชม. (ส่งได้ ' + sent + ')');
    // รายการ/ปิด/เปิด
    const list = w.modReportList(); assert.ok(list.length >= 11 && !('chat' in list[0])); const id = list.find(x => x.by === 'Ddd').id;
    assert.ok(w.modReportRead(id).chat.length); assert.strictEqual(w.modReportRead('../x'), null, 'id แปลกไม่อ่านไฟล์นอกโฟลเดอร์');
    assert.ok(w.modReportSet(id, true, 'Sira')); assert.strictEqual(w.modReportList().find(x => x.id === id).closed, true); assert.ok(w.modReportSet(id, false, 'Sira')); assert.strictEqual(w.modReportList().find(x => x.id === id).closed, false); assert.strictEqual(w.modReportSet('nope12345', true, 'x'), false);
    // tools/reports.js อ่านได้
    const o = require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'reports.js')], { env: Object.assign({}, process.env, { DATA_DIR: DATA }) }).toString();
    assert.ok(o.includes('ยังไม่ปิด') && o.includes(id));
    assert.ok(Date.now() - now0 < 60000);
    w.players.delete(5); w.players.delete(6);
    console.log('  รายงาน: ok');
  }

  // ---- 4) แชตย้อนหลัง ----
  {
    await sleep(150);
    const CL = path.join(DATA, 'chatlog'), today = new Date(), ds = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    assert.ok(fs.existsSync(path.join(CL, ds(today) + '.jsonl')), 'เขียน chatlog วันนี้');
    const q = w.modChatlogQuery({ name: 'aaa' }); assert.ok(q.rows.length >= 1 && q.rows.every(r => r.name === 'Aaa' && r.room === 'main' && r.t > 0) && q.rows.some(r => r.text.startsWith('***')), 'เก็บข้อความหลังกรอง');
    assert.strictEqual(w.modChatlogQuery({ name: 'bbb' }).rows.every(r => r.name === 'Bbb'), true); assert.strictEqual(w.modChatlogQuery({ name: 'nobody' }).rows.length, 0);
    assert.strictEqual(w.modChatlogQuery({ day: '../../etc' }).day, ds(Date.now()), 'วันแปลกตกเป็นวันนี้');
    // จำกัดแถว
    fs.writeFileSync(path.join(CL, '2020-01-02.jsonl'), Array.from({ length: M.chatlogRows + 50 }, (_, i) => JSON.stringify({ t: i, room: 'main', name: 'X', text: 'm' + i })).join('\n') + '\n');
    const big = w.modChatlogQuery({ day: '2020-01-02' }); assert.strictEqual(big.rows.length, M.chatlogRows); assert.strictEqual(big.total, M.chatlogRows + 50); assert.strictEqual(big.rows[big.rows.length - 1].text, 'm' + (M.chatlogRows + 49));
    // ลบไฟล์เก่ากว่า 14 วัน
    const day = 86400000, now = Date.now(); for (const n of [30, 20, 16, 13, 5, 0]) fs.writeFileSync(path.join(CL, ds(now - n * day) + '.jsonl'), '{}\n'); fs.writeFileSync(path.join(CL, 'note.txt'), 'x');
    const gone = w.modPrune(now); const left = fs.readdirSync(CL);
    assert.ok(!left.includes(ds(now - 30 * day) + '.jsonl') && !left.includes(ds(now - 20 * day) + '.jsonl') && !left.includes('2020-01-02.jsonl') && !left.includes(ds(now - 16 * day) + '.jsonl'), 'ไฟล์เก่ากว่า 14 วันถูกลบ');
    assert.ok(left.includes(ds(now - 13 * day) + '.jsonl') && left.includes(ds(now - 5 * day) + '.jsonl') && left.includes(ds(now) + '.jsonl') && left.includes('note.txt'), 'ไฟล์ใหม่/ไฟล์อื่นไม่ถูกแตะ'); assert.ok(gone >= 4);
    assert.strictEqual(M.chatlogDays, 14);
    console.log('  แชตย้อนหลัง/ลบไฟล์เก่า: ok');
  }

  // ---- 5) mute / ban ชั่วคราว (ระดับ World) ----
  {
    const r = w.modSetMute('Bbb', '10m'); assert.ok(r.until > Date.now() && B.rec.muteUntil === r.until); assert.ok(w.modMuted(B));
    assert.ok(w.modSetMute('sira', '1h').err && w.modSetMute('nobody', '1h').err && w.modSetMute('Bbb', 'forever').err && w.modSetMute('Bbb', '__proto__').err, 'ปิดเสียงผู้ดูแล/ไม่มีคน/ระยะเวลาแปลก ไม่ได้');
    A.msgs.length = 0; C.msgs.length = 0; B.msgs.length = 0; say(B, 'ไม่ควรถึงใคร'); assert.deepStrictEqual(chats(A).concat(chats(C)), [], 'แชตของคนที่ถูกปิดเสียงถูกทิ้ง'); assert.ok(B.msgs.some(m => m.t === 'msg' && /ปิดเสียง/.test(m.text)), 'เขาเห็นข้อความแจ้ง');
    w.handle(B, { t: 'rtc', to: 3, d: {} }); w.handle(B, { t: 'pcall', to: 3, k: 'ring' }); assert.ok(!C.msgs.some(m => m.t === 'rtc' || m.t === 'pcall'), 'เสียงจากคนถูกปิดเสียงถูกทิ้ง'); w.handle(B, { t: 'voice', on: true }); assert.strictEqual(B.voice, false, 'เปิดไมค์ไม่ได้');
    B.rec.muteUntil = Date.now() - 1; assert.ok(!w.modMuted(B), 'หมดเวลา = พูดได้เอง'); say(B, 'พูดได้แล้ว'); assert.ok(chats(C).includes('พูดได้แล้ว'));
    w.modSetMute('Bbb', '1d'); assert.strictEqual(B.rec.muteUntil - Date.now() > 86000000, true); w.modSetMute('Bbb', 'off'); assert.ok(!w.modMuted(B) && B.rec.muteUntil === undefined);
    // แบนชั่วคราว
    assert.strictEqual(w.modTempBan('ccc', 'perm'), 0, 'dur ที่ไม่ใช่ 1d/7d ไม่ใช่แบนชั่วคราว'); assert.strictEqual(w.modTempBan('ccc', '__proto__'), 0);
    const until = w.modTempBan('ccc', '1d'); assert.ok(until > Date.now() + 86000000 && w.banUntil.ccc === until); assert.ok(w.modTempBan('ddd', '7d') > Date.now() + 6 * 86400000);
    assert.ok(/พักการเล่น/.test(w.modJoinCheck('ccc', false)), 'ติดแบนอยู่เข้าไม่ได้'); assert.strictEqual(w.modJoinCheck('ccc', true), '', 'ผู้ดูแลไม่ติดแบน');
    assert.strictEqual(w.banned.has('ccc'), false, 'แบนชั่วคราวไม่แตะ banned เดิม');
    w.banUntil.ccc = Date.now() - 1; assert.strictEqual(w.modJoinCheck('ccc', false), '', 'หมดเวลาแล้วเข้าได้เอง'); assert.strictEqual(w.banUntil.ccc, undefined);
    w.banUntil.old = Date.now() - 1000; w.modTick(Date.now()); assert.strictEqual(w.banUntil.old, undefined, 'modTick เก็บโทษที่หมดแล้ว');
    w.modUnban('ddd'); assert.strictEqual(w.banUntil.ddd, undefined);
    // บันทึก/โหลดกลับ: banUntil เพิ่มอย่างเดียว ไม่มีคีย์ตอนไม่มีโทษ
    w.modTempBan('eee', '1d'); w.dirty = true; w.save(true); const sv = JSON.parse(fs.readFileSync(w.file, 'utf8')); assert.ok(sv.banUntil.eee > Date.now()); assert.ok(Array.isArray(sv.banned));
    const w2 = new World('main'); assert.ok(w2.banUntil.eee > Date.now(), 'โหลด banUntil กลับมา'); w2.modUnban('eee'); w2.dirty = true; w2.save(true); assert.strictEqual('banUntil' in JSON.parse(fs.readFileSync(w2.file, 'utf8')), false, 'ไม่มีโทษ = ไม่มีคีย์ในเซฟ');
    // ทักทายคนใหม่ (greet) ต้องผ่านระบบปิดเสียง/บล็อกเหมือนแชตปกติ
    { A.msgs.length = 0; C.msgs.length = 0; B.msgs.length = 0; C.rec.firstSeen = Date.now(); delete C.greeted; B.rec.muteUntil = Date.now() + 60000;
      w.greet(B, C.id, 'wave'); assert.deepStrictEqual(chats(A).concat(chats(C)), [], 'คนถูกปิดเสียงทักทายผ่านแชตไม่ได้'); B.rec.muteUntil = undefined; delete C.greeted; }
    console.log('  mute/ban ชั่วคราว: ok');
  }

  // ---- 6) ผ่าน WebSocket จริง: non-admin เรียก admin ไม่ได้ • admin mute/ban/ปิดรายงาน ----
  {
    const PORT = 3900 + Math.floor(Math.random() * 90), DD = require('./testlib').tmpDataDir('mw-mod2-');
    const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DD, ADMIN_KEY: 'test-admin-key' }), stdio: ['ignore', 'ignore', 'inherit'] });
    const WebSocket = require('ws'); let n = 0;
    const open = (name, extra) => new Promise((res, rej) => { const msgs = [], ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { headers: { 'x-forwarded-for': '9.9.9.' + (++n) } }); ws.on('open', () => ws.send(JSON.stringify(Object.assign({ t: 'join', name, color: '#3498db', pin: '4321' }, extra)))); ws.on('message', d => { try { msgs.push(JSON.parse(d)); } catch (e) {} }); ws.on('error', rej); setTimeout(() => res({ ws, msgs, send: o => ws.send(JSON.stringify(o)) }), 800); });
    try {
      for (let i = 0; i < 50; i++) { try { (await open('probe' + i)).ws.close(); break; } catch (e) { await sleep(200); } }
      await sleep(300);
      const adm = await open('Sira', { akey: 'test-admin-key', pin: '' }), u1 = await open('Uone'), u2 = await open('Utwo');
      assert.ok(adm.msgs.some(m => m.t === 'pinask') && u1.msgs.some(m => m.t === 'pinask'), 'เข้าเกมได้');
      for (const a of ['reports', 'chatlog', 'mute', 'reportclose', 'reportget', 'ban', 'users']) u1.send({ t: 'admin', a, room: 'main', name: 'utwo', dur: '1d', id: 'abcdefgh' });
      await sleep(300); assert.ok(!u1.msgs.some(m => m.t === 'admin'), 'non-admin เรียก admin action ไม่ได้');
      u2.msgs.length = 0; u1.msgs.length = 0; u1.send({ t: 'chat', text: 'hello shit' }); await sleep(300);
      assert.ok(u2.msgs.some(m => m.t === 'chat' && m.text === 'hello ***'), 'กรองคำผ่านเซิร์ฟเวอร์จริง');
      adm.msgs.length = 0; adm.send({ t: 'admin', a: 'chatlog', name: 'uone' }); await sleep(300); const cl = adm.msgs.find(m => m.t === 'admin' && m.chatlog); assert.ok(cl && cl.chatlog.rows.some(r => r.text === 'hello ***'), 'ผู้ดูแลค้นแชตย้อนหลังได้');
      u1.send({ t: 'report', id: 2, why: 'abuse', text: 'ทดสอบ' }); await sleep(300); // id ของผู้เล่นตามลำดับเข้า (Sira=1? ไม่แน่ใจ) ใช้ชื่อแทน
      adm.send({ t: 'admin', a: 'reports' }); await sleep(300);
      adm.msgs.length = 0; adm.send({ t: 'admin', a: 'mute', room: 'main', name: 'Utwo', dur: '1h' }); await sleep(300);
      assert.ok(adm.msgs.some(m => m.t === 'admin' && m.muted === 'utwo' && m.until > Date.now() && m.users.find(x => x.name === 'Utwo').mute > 0), 'admin mute สำเร็จ');
      assert.ok(u2.msgs.some(m => m.t === 'muted' && m.until > Date.now()), 'ผู้ถูกปิดเสียงได้รับแจ้ง');
      u1.msgs.length = 0; u2.send({ t: 'chat', text: 'ฉันพูดอยู่นะ' }); await sleep(300); assert.ok(!u1.msgs.some(m => m.t === 'chat'), 'แชตจากคนถูกปิดเสียงไม่ถึงคนอื่น');
      adm.msgs.length = 0; adm.send({ t: 'admin', a: 'ban', room: 'main', name: 'Utwo', dur: '1d' }); await sleep(400);
      const br = adm.msgs.find(m => m.t === 'admin' && m.banned === 'utwo'); assert.ok(br && br.until > Date.now() && br.bans.some(b => b.name === 'utwo' && b.until > Date.now()), 'แบน 1 วัน: ตอบ until + อยู่ในรายการ');
      assert.ok(u2.msgs.some(m => m.t === 'kicked'), 'แบนชั่วคราวเตะออก');
      const re = await open('Utwo'); assert.ok(re.msgs.some(m => m.t === 'err' && /พักการเล่น/.test(m.text)), 'ระหว่างแบนชั่วคราวเข้าไม่ได้');
      adm.send({ t: 'admin', a: 'unban', room: 'main', name: 'Utwo' }); await sleep(300);
      const re2 = await open('Utwo'); assert.ok(re2.msgs.some(m => m.t === 'pinask'), 'ปลดแบนแล้วเข้าได้');
      adm.msgs.length = 0; adm.send({ t: 'admin', a: 'ban', room: 'main', name: 'Uone' }); await sleep(400); // ไม่ระบุ dur = ถาวรแบบเดิม
      assert.ok(adm.msgs.some(m => m.t === 'admin' && m.banned === 'uone' && !m.until) && (await open('Uone')).msgs.some(m => m.t === 'err' && /ระงับ/.test(m.text)), 'แบนถาวรแบบเดิมยังใช้ได้');
      adm.msgs.length = 0; adm.send({ t: 'admin', a: 'ban', room: 'main', name: 'Sira', dur: '1d' }); await sleep(300); assert.ok(adm.msgs.some(m => m.err), 'แบนผู้ดูแลไม่ได้');
      adm.send({ t: 'admin', a: 'mute', room: 'main', name: 'Sira', dur: '1h' }); await sleep(300); assert.ok(adm.msgs.filter(m => m.err).length >= 2, 'ปิดเสียงผู้ดูแลไม่ได้');
      console.log('  WebSocket จริง (admin gating, mute, ban ชั่วคราว): ok');
    } finally { srv.kill(); }
  }
  console.log('✓ ผ่าน: เครื่องมือดูแลชุมชน');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
