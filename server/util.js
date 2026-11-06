'use strict';
// ตัวช่วยร่วมของเซิร์ฟเวอร์ (ย้ายมาจาก server.js ไม่เปลี่ยนพฤติกรรม)
const fs = require('fs');
const path = require('path');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const rand = (a, b) => a + Math.random() * (b - a);
// บันทึกเหตุการณ์ไว้วิเคราะห์ (หนึ่งไฟล์ต่อวัน data/events/YYYY-MM-DD.jsonl) สรุปด้วย node tools/stats.js
const EVENT_DIR = path.join(DATA_DIR, 'events');
try { fs.mkdirSync(EVENT_DIR, { recursive: true }); } catch (e) { /* บันทึกไม่ได้ก็ไม่ทำให้เกมล้ม */ }
const logEv = (room, e, o, sync) => { // sync = เขียนทันที (ใช้ตอนปิดเซิร์ฟเวอร์)
  try {
    const d = new Date(), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const ln = JSON.stringify(Object.assign({ t: Date.now(), room, e }, o)) + '\n';
    if (sync) fs.appendFileSync(path.join(EVENT_DIR, day + '.jsonl'), ln); else fs.appendFile(path.join(EVENT_DIR, day + '.jsonl'), ln, () => {});
  } catch (err) { /* ข้าม */ }
};
const replacer = (k, v) => (k[0] === '_' ? undefined : v);
const send = (p, o) => { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(o)); };
module.exports = { rand, EVENT_DIR, logEv, replacer, send };
