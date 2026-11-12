// ทดสอบล็อกอินซ้ำ: เตะ session เก่าออกแล้วเข้าใหม่ได้ทันที (ซ็อกเก็ตจริง): node tools/test-relogin.js
const assert = require('assert'), { spawn } = require('child_process'), path = require('path');
const WebSocket = require('ws');
const PORT = 3900 + Math.floor(Math.random() * 90), DATA = require('./testlib').tmpDataDir('mw-relogin-');
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA, ADMIN_KEY: 'test-admin-key' }), stdio: 'ignore' });
const done = code => { try { srv.kill(); } catch (e) {} setTimeout(() => process.exit(code), 100); };
process.on('uncaughtException', e => { console.error(e); done(1); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
// เปิดซ็อกเก็ต ส่ง join แล้วรวบรวมข้อความ • ip = ปลอมด้วย x-forwarded-for เพื่อจำลองคนละเครื่อง
const open = (name, { ip, pin, wait } = {}) => new Promise((res, rej) => {
  const msgs = [], ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { headers: ip ? { 'x-forwarded-for': ip } : {} });
  const c = { ws, msgs, closed: false, has: t => msgs.some(m => m.t === t), err: () => (msgs.find(m => m.t === 'err') || {}).text };
  ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name, color: '#3498db', pin: pin || '' })));
  ws.on('message', d => { try { msgs.push(JSON.parse(d)); } catch (e) {} });
  ws.on('close', () => { c.closed = true; });
  ws.on('error', rej);
  setTimeout(() => res(c), wait || 700);
});
(async () => {
  for (let i = 0; i < 50; i++) { try { await open('probe' + i, {}).then(c => c.ws.close()); break; } catch (e) { await sleep(200); } }
  await sleep(300);
  // 1) IP เดิม ไม่มี PIN: เตะเก่า เข้าใหม่ได้ทันที
  const a1 = await open('DupA'); assert.ok(a1.has('init') || a1.has('welcome') || !a1.err(), 'เข้าครั้งแรกได้: ' + a1.err());
  const a2 = await open('DupA'); await sleep(300);
  assert.ok(!a2.err(), 'ล็อกอินซ้ำจาก IP เดิมต้องเข้าได้ ไม่ใช่ "กำลังเล่นอยู่": ' + a2.err());
  assert.ok(a1.has('kicked'), 'session เก่าต้องได้ข้อความ kicked'); assert.ok(a1.closed, 'ซ็อกเก็ตเก่าต้องถูกปิด');
  assert.ok(a2.msgs.length > 1 && !a2.closed, 'session ใหม่ต้องอยู่ในเกม');
  // 2) บัญชีไม่มี PIN จาก IP อื่น ขณะ session เดิมยังทำงานอยู่ (ไม่เงียบ): ยังเข้าไม่ได้ (กันแอบอ้างชื่อ)
  const a3 = await open('DupA', { ip: '9.9.9.9', wait: 2300 });
  assert.ok(/กำลังเล่นอยู่/.test(a3.err() || ''), 'ไม่มี PIN + IP อื่น + อีกฝั่งยังเล่นอยู่ ต้องถูกปฏิเสธ: ' + a3.err());
  assert.ok(!a2.closed && !a2.has('kicked'), 'session ที่ยังเล่นอยู่ต้องไม่ถูกเตะ');
  // 3) บัญชีมี PIN: ใส่ PIN ถูกจากที่ไหนก็เตะเก่าได้ • PIN ผิดห้ามเตะ
  const b1 = await open('DupB', { ip: '1.1.1.1', pin: '1234' });
  const bBad = await open('DupB', { ip: '2.2.2.2', pin: '9999' });
  assert.ok(bBad.err(), 'PIN ผิดต้องถูกปฏิเสธ'); assert.ok(!b1.closed && !b1.has('kicked'), 'PIN ผิดห้ามเตะ session เก่า');
  const bOk = await open('DupB', { ip: '2.2.2.2', pin: '1234' }); await sleep(300);
  assert.ok(!bOk.err(), 'PIN ถูกต้องเข้าได้: ' + bOk.err()); assert.ok(b1.has('kicked') && b1.closed, 'PIN ถูก = เตะ session เก่า');
  // 3.5) ซ็อกเก็ตค้าง (ไม่ตอบ ping) บัญชีไม่มี PIN คนละ IP: เซิร์ฟเวอร์ ping ตรวจแล้วเตะได้ภายในไม่กี่วินาที (เคสเน็ตหลุดแต่ยังเห็นออนไลน์)
  const z1 = await open('DupZ', { ip: '3.3.3.3' }); z1.ws._socket.pause(); // หยุดอ่านซ็อกเก็ต = ไม่ตอบ pong เหมือนเครื่องหาย
  const t0 = Date.now(); const z2 = await open('DupZ', { ip: '4.4.4.4', wait: 2500 });
  assert.ok(!z2.err(), 'session เก่าที่ไม่ตอบ ping ต้องถูกเตะ เข้าใหม่ได้: ' + z2.err()); assert.ok(Date.now() - t0 < 4500, 'ต้องเข้าได้เร็ว');
  z1.ws.terminate();
  // 4) หลังเตะแล้ว ซ็อกเก็ตเก่าปิดตาม ไม่ทำให้ session ใหม่หลุด/ออกซ้ำ
  await sleep(500); assert.ok(!bOk.closed && !a2.closed, 'ปิดซ็อกเก็ตเก่าแล้ว session ใหม่ต้องยังอยู่');
  console.log('relogin ok'); done(0);
})().catch(e => { console.error(e); done(1); });
