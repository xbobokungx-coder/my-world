// ตัวช่วยร่วมของเทสต์: สร้างโฟลเดอร์ชั่วคราวและลบทิ้งตอนจบ (แม้ assert พัง)
const fs = require('fs'), os = require('os'), path = require('path');
// หมายเหตุ: ถ้าโปรเซสถูก SIGKILL/ไฟดับ โฟลเดอร์อาจค้าง (OS ล้างเอง) และ logEv ของ server.js ที่ appendFile ค้างตอนออก
// อาจทำให้ rmSync ได้ ENOTEMPTY ซึ่งถูกกลืนไว้ (เล็กน้อย ไม่กระทบผลเทสต์)
function tmpDataDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} });
  return dir;
}
module.exports = { tmpDataDir };
