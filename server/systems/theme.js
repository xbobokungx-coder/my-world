'use strict';
// ธีมหิมะ (ภาพอย่างเดียว ไม่แตะกติกาฤดูของพืช): ผู้ดูแลตั้งโหมด auto/on/off ทั้งเซิร์ฟเวอร์ เก็บถาวรที่ data/theme.json
const fs = require('fs');
const path = require('path');
const S = require('../../public/shared.js');
const { send } = require('../util.js');
const THEME_FILE = path.join(process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data'), 'theme.json');
let snow = null; // แคชโหมดปัจจุบัน (โหลดจากไฟล์ครั้งแรกที่ใช้)

module.exports = {
  themeSnow() { // โหมดหิมะปัจจุบัน ไฟล์หาย/เสีย/ค่าแปลก = 'auto'
    if (snow === null) {
      snow = S.THEME_SNOW[0];
      try { const d = JSON.parse(fs.readFileSync(THEME_FILE, 'utf8')); if (d && S.THEME_SNOW.includes(d.snow)) snow = d.snow; } catch (e) { /* ไม่มีไฟล์ = ค่าเริ่มต้น */ }
    }
    return snow;
  },
  themeSend(p) { send(p, { t: 'theme', snow: this.themeSnow() }); },
  // ผู้ดูแลตั้งโหมด: คืน { err } หรือ { snow } • rooms = ทุกห้องที่ต้องบอก (ค่าเริ่มต้นห้องนี้ห้องเดียว)
  adminSetSnow(p, mode, rooms) {
    if (!p || !p.admin) return { err: 'เฉพาะผู้ดูแลเท่านั้น' };
    if (typeof mode !== 'string' || !S.THEME_SNOW.includes(mode)) return { err: 'โหมดหิมะต้องเป็น ' + S.THEME_SNOW.join(' / ') };
    if (mode !== this.themeSnow()) {
      try { fs.writeFileSync(THEME_FILE + '.tmp', JSON.stringify({ v: 1, snow: mode, by: p.name, at: Date.now() })); fs.renameSync(THEME_FILE + '.tmp', THEME_FILE); } catch (e) { console.error('บันทึกธีมไม่ได้', e.message); return { err: 'บันทึกไม่ได้' }; }
      snow = mode;
      for (const w of (rooms || [this])) w.broadcast({ t: 'theme', snow: mode });
    }
    return { snow: mode };
  },
};
