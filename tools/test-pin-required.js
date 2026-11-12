// ทดสอบ PIN บังคับ (WP-02): ชื่อใหม่ต้องตั้ง PIN • ชื่อเดิมที่ยังไม่มี PIN ต้องตั้งตอนเข้า • PIN ผิดโดนล็อก • PIN ถูกเข้าได้ : node tools/test-pin-required.js
const assert = require('assert'), { spawn } = require('child_process'), path = require('path'), fs = require('fs');
const WebSocket = require('ws');
const PORT = 3800 + Math.floor(Math.random() * 90), DATA = require('./testlib').tmpDataDir('mw-pinreq-');
// บัญชีเก่า (ก่อนบังคับ PIN) ที่ไม่มี PIN: เขียนเซฟไว้ก่อนเปิดเซิร์ฟเวอร์
fs.writeFileSync(path.join(DATA, 'main.json'), JSON.stringify({ players: { oldtimer: { name: 'OldTimer', inv: { coin: 123 }, skills: {}, joins: 5, x: 22 * 32, y: 22 * 32 } } }));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA, ADMIN_KEY: 'test-admin-key' }), stdio: ['ignore', 'ignore', 'inherit'] });
const done = code => { try { srv.kill(); } catch (e) {} setTimeout(() => process.exit(code), 100); };
process.on('uncaughtException', e => { console.error(e); done(1); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const open = (name, pin, ip) => new Promise((res, rej) => {
  const msgs = [], ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { headers: ip ? { 'x-forwarded-for': ip } : {} });
  const c = { ws, msgs, err: () => msgs.find(m => m.t === 'err'), inGame: () => msgs.some(m => m.t === 'pinask') };
  ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name, color: '#3498db', pin })));
  ws.on('message', d => { try { msgs.push(JSON.parse(d)); } catch (e) {} });
  ws.on('error', rej); setTimeout(() => res(c), 700);
});
(async () => {
  for (let i = 0; i < 50; i++) { try { await open('probe' + i, '1234').then(c => c.ws.close()); break; } catch (e) { await sleep(200); } }
  await sleep(300);
  // 1) ชื่อใหม่ไม่ใส่ PIN (หรือ PIN ผิดรูปแบบ) ถูกปฏิเสธ และไม่สร้างบัญชี
  for (const bad of ['', '12', '1234567', 'abcd']) { const c = await open('NewbieA', bad); assert.ok(c.err() && c.err().need === 'pin' && !c.inGame(), 'ชื่อใหม่ PIN "' + bad + '" ต้องถูกปฏิเสธ (need pin)'); c.ws.close(); }
  // 2) ชื่อใหม่ใส่ PIN ถูกรูปแบบ เข้าได้ และ PIN ถูกบันทึก
  const n1 = await open('NewbieA', '4821'); assert.ok(!n1.err() && n1.inGame(), 'ชื่อใหม่ใส่ PIN เข้าได้: ' + JSON.stringify(n1.err())); n1.ws.close(); await sleep(300);
  const n2 = await open('NewbieA', '', '5.5.5.5'); assert.ok(n2.err() && n2.err().need === 'pin', 'เข้าซ้ำไม่ใส่ PIN ต้องถูกขอ PIN'); n2.ws.close();
  // 3) ชื่อเดิมที่ยังไม่มี PIN: เข้าโดยไม่ใส่ต้องได้ need setpin • ใส่ PIN ใหม่แล้วเข้าได้ และ PIN นั้นกลายเป็นรหัสจริง
  const o1 = await open('OldTimer', ''); assert.ok(o1.err() && o1.err().need === 'setpin' && !o1.inGame(), 'บัญชีเก่าไม่มี PIN ต้องถูกขอตั้ง PIN (need setpin): ' + JSON.stringify(o1.err())); o1.ws.close();
  const o2 = await open('OldTimer', '7777'); assert.ok(!o2.err() && o2.inGame(), 'บัญชีเก่าตั้ง PIN ตอนเข้าได้ ' + JSON.stringify(o2.msgs.map(m => m.t + (m.text ? ':' + m.text : '')))); o2.ws.close(); await sleep(300);
  // 4) PIN ผิดตามตัวล็อกเดิม (ผิดเกิน 5 ครั้งใน 1 นาทีล็อก) • PIN ถูกเข้าได้
  const w1 = await open('OldTimer', '1111', '6.6.6.6'); assert.ok(w1.err() && /PIN/.test(w1.err().text) && !w1.inGame(), 'PIN ผิดต้องไม่ได้เข้า'); w1.ws.close();
  const ok = await open('OldTimer', '7777', '6.6.6.6'); assert.ok(!ok.err() && ok.inGame(), 'PIN ถูกเข้าได้'); ok.ws.close();
  for (let i = 0; i < 5; i++) { const c = await open('NewbieA', '0000', '7.7.7.7'); c.ws.close(); }
  const lk = await open('NewbieA', '4821', '7.7.7.7'); assert.ok(lk.err() && /เกินไป/.test(lk.err().text), 'ผิดเกิน 5 ครั้งต้องล็อก 1 นาที (แม้ใส่ถูก): ' + JSON.stringify(lk.err())); lk.ws.close();
  console.log('pin-required ok'); done(0);
})().catch(e => { console.error(e); done(1); });
