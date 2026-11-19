// ทดสอบ: คนเข้าห้องใหม่ต้องไม่ได้แชตเก่า (เห็นเฉพาะข้อความหลังเข้าห้อง)
// รัน: node tools/test-chat-join.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-chatjoin-');
const { World } = require('../server.js');
const w = new World('chatjointest');
const mk = name => { const ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }; const r = w.join(ws, name, '#3498db', false); assert.ok(r.p, name); return { p: r.p, ws }; };
const chatlog = ws => ws.msgs.filter(m => m.t === 'chatlog').pop();

const a = mk('Aaa');
w.handle(a.p, { t: 'chat', text: 'ข้อความเก่า' });
assert.ok(w.chatLog.some(c => c.text === 'ข้อความเก่า'), 'เซิร์ฟเวอร์ยังเก็บแชตไว้ใช้แนบรายงาน');

const b = mk('Bbb');
assert.deepStrictEqual(chatlog(b.ws).list, [], 'คนเข้าใหม่ไม่ได้รับแชตเก่า');
assert.ok(!JSON.stringify(b.ws.msgs).includes('ข้อความเก่า'), 'ไม่มีข้อความเก่าหลุดไปกับ message อื่นตอนเข้าห้อง');

b.ws.msgs.length = 0; a.p.lastChat = 0; w.handle(a.p, { t: 'chat', text: 'ข้อความใหม่' });
assert.ok(b.ws.msgs.some(m => m.t === 'chat' && m.text === 'ข้อความใหม่'), 'ข้อความหลังเข้าห้องยังเห็นตามปกติ');
console.log('ผ่าน: คนเข้าใหม่ไม่เห็นแชตเก่า');
