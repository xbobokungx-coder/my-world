'use strict';
// ธีมหิมะ (ภาพอย่างเดียว) และฝน (ดินเปียกเอง มีผลต่อการโต): ผู้ดูแลตั้งโหมด auto/on/off ทั้งเซิร์ฟเวอร์ เก็บถาวรที่ data/theme.json
const fs = require('fs');
const path = require('path');
const S = require('../../public/shared.js');
const { send } = require('../util.js');
const THEME_FILE = path.join(process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data'), 'theme.json');
let snow = null, rain = null; // แคชโหมดปัจจุบัน (โหลดจากไฟล์ครั้งแรกที่ใช้)
function load() {
  snow = S.THEME_SNOW[0]; rain = S.THEME_RAIN[0];
  try { const d = JSON.parse(fs.readFileSync(THEME_FILE, 'utf8')); if (d && S.THEME_SNOW.includes(d.snow)) snow = d.snow; if (d && S.THEME_RAIN.includes(d.rain)) rain = d.rain; } catch (e) { /* ไม่มีไฟล์ = ค่าเริ่มต้น */ }
}
function write(by) { fs.writeFileSync(THEME_FILE + '.tmp', JSON.stringify({ v: 1, snow, rain, by, at: Date.now() })); fs.renameSync(THEME_FILE + '.tmp', THEME_FILE); }

module.exports = {
  themeSnow() { // โหมดหิมะปัจจุบัน ไฟล์หาย/เสีย/ค่าแปลก = 'auto'
    if (snow === null) load();
    return snow;
  },
  themeRain() { if (rain === null) load(); return rain; },
  themeSend(p) { send(p, { t: 'theme', snow: this.themeSnow(), rain: this.themeRain() }); },
  rainTick(now) { // ฝนเริ่ม/หยุด บอกคนออนไลน์ครั้งเดียวตอนสถานะเปลี่ยน (รอบแรกแค่จำสถานะ)
    const r = S.rainAt(now, this.themeRain());
    if (this._rainOn !== undefined && r !== this._rainOn && this.players.size) this.broadcast({ t: 'msg', text: r ? '🌧️ ฝนเริ่มตกแล้ว ดินเปียกเองทุกช่อง' : '☀️ ฝนหยุดแล้ว' });
    this._rainOn = r;
  },
  // ผู้ดูแลตั้งโหมด: คืน { err } หรือ { snow } • rooms = ทุกห้องที่ต้องบอก (ค่าเริ่มต้นห้องนี้ห้องเดียว)
  adminSetSnow(p, mode, rooms) {
    if (!p || !p.admin) return { err: 'เฉพาะผู้ดูแลเท่านั้น' };
    if (typeof mode !== 'string' || !S.THEME_SNOW.includes(mode)) return { err: 'โหมดหิมะต้องเป็น ' + S.THEME_SNOW.join(' / ') };
    if (mode !== this.themeSnow()) {
      const old = snow; snow = mode;
      try { write(p.name); } catch (e) { snow = old; console.error('บันทึกธีมไม่ได้', e.message); return { err: 'บันทึกไม่ได้' }; }
      for (const w of (rooms || [this])) w.broadcast({ t: 'theme', snow: mode, rain: this.themeRain() });
    }
    return { snow: mode };
  },
  adminSetRain(p, mode, rooms) { // เหมือน adminSetSnow แต่เป็นฝน: คืน { err } หรือ { rain }
    if (!p || !p.admin) return { err: 'เฉพาะผู้ดูแลเท่านั้น' };
    if (typeof mode !== 'string' || !S.THEME_RAIN.includes(mode)) return { err: 'โหมดฝนต้องเป็น ' + S.THEME_RAIN.join(' / ') };
    if (mode !== this.themeRain()) {
      const old = rain; rain = mode;
      try { write(p.name); } catch (e) { rain = old; console.error('บันทึกธีมไม่ได้', e.message); return { err: 'บันทึกไม่ได้' }; }
      for (const w of (rooms || [this])) w.broadcast({ t: 'theme', snow: this.themeSnow(), rain: mode });
    }
    return { rain: mode };
  },
};
