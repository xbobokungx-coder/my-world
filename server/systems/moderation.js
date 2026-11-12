'use strict';
// ดูแลชุมชน (WP-06): กรองคำหยาบ บล็อก รายงานผู้เล่น บันทึกแชต 14 วัน ปิดเสียง/แบนตามเวลา
// ต่อเข้า class World ด้วย mix() (ดู server/mixin.js) • ตัวเลขอยู่ใน S.MODERATION • ผู้ดูแลเป็นคนตัดสินโทษทุกครั้ง ไม่มีโทษอัตโนมัติ
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const S = require('../../public/shared.js');
const { send } = require('../util.js');
const { ADMIN_NAME } = require('../consts.js');

const M = S.MODERATION, DAY = 86400000;
const dataDir = () => process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const dirOf = n => path.join(dataDir(), n);
const REPORT_ID_RE = /^[a-z0-9]{6,24}$/, DAY_RE = /^\d{4}-\d{2}-\d{2}$/, LOG_FILE_RE = /^(\d{4})-(\d{2})-(\d{2})\.jsonl$/;
const dayStr = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const clip = (v, n) => Array.from(String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim()).slice(0, n).join('');

// ----- กรองคำหยาบ: รายการตั้งต้น + data/badwords.txt (บรรทัดละคำ ขึ้นต้น # = คอมเมนต์) -----
const DEFAULT_WORDS = ['ควย', 'เหี้ย', 'สัส', 'เย็ดแม่', 'เย็ด', 'ชิบหาย', 'ระยำ', 'อีดอก', 'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'faggot', 'whore', 'slut'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', '@': 'a', $: 's' };
const SKIP = /[\s._\-*+,!?'"`~|\\/:;()[\]{}<>=^&%#​-‍่-์]/; // เว้นวรรค/เครื่องหมาย/วรรณยุกต์ ไม่นับตอนเทียบ
let wordCache = { at: 0, list: [] };
// ย่อข้อความให้เทียบง่าย: ตัวพิมพ์เล็ก ตัดตัวคั่น แปลงเลขที่ใช้แทนตัวอักษร ยุบตัวซ้ำติดกัน • map: ตำแหน่งต้น/ท้ายในข้อความเดิมของแต่ละตัวที่เหลือ
function norm(text) {
  const chars = Array.from(String(text)), s = [], a = [], b = [];
  for (let i = 0; i < chars.length; i++) {
    let c = chars[i].toLowerCase(); if (SKIP.test(c)) continue;
    c = LEET[c] || c; if (c.length > 1) c = '\u0001'; // อีโมจิ/ตัวนอก BMP ใช้ตัวแทน 1 ตัว ให้ตำแหน่งตรงกับ map
    if (s.length && s[s.length - 1] === c) { b[b.length - 1] = i; continue; }
    s.push(c); a.push(i); b.push(i);
  }
  return { chars, s: s.join(''), a, b };
}
function badWords(now) {
  if (now - wordCache.at < M.wordsRefreshMs && wordCache.at) return wordCache.list;
  let extra = []; try { extra = fs.readFileSync(path.join(dataDir(), 'badwords.txt'), 'utf8').split(/\r?\n/); } catch (e) { /* ไม่มีไฟล์เสริมก็ใช้ค่าตั้งต้น */ }
  const set = new Set(); for (const w of DEFAULT_WORDS.concat(extra)) { const t = w.trim(); if (!t || t[0] === '#') continue; const n = norm(t).s; if (n.length >= 2) set.add(n); }
  wordCache = { at: now, list: [...set] };
  return wordCache.list;
}

module.exports = {
  // แทนคำหยาบด้วย *** (ช่วงที่ซ้อนกันรวมเป็นช่วงเดียว)
  modFilter(text) {
    const n = norm(text), hit = [];
    if (!n.s) return String(text);
    for (const w of badWords(Date.now())) { let i = n.s.indexOf(w); while (i >= 0) { hit.push([n.a[i], n.b[i + Array.from(w).length - 1]]); i = n.s.indexOf(w, i + 1); } }
    if (!hit.length) return String(text);
    hit.sort((x, y) => x[0] - y[0]);
    const rg = []; for (const h of hit) { const l = rg[rg.length - 1]; if (l && h[0] <= l[1] + 1) l[1] = Math.max(l[1], h[1]); else rg.push(h.slice()); }
    let out = '', pos = 0; for (const [x, y] of rg) { out += n.chars.slice(pos, x).join('') + M.mask; pos = y + 1; }
    return out + n.chars.slice(pos).join('');
  },

  // ----- แชต: ตัดโทษปิดเสียง กรองคำ บันทึกถาวร แล้วส่งเฉพาะคนที่ไม่ได้บล็อกกัน -----
  modChat(p, m) {
    const now = Date.now();
    const text = Array.from(String(m.text || '').trim()).slice(0, M.chatMax).join('');
    if (!text || now - p.lastChat < 500) return;
    p.lastChat = now;
    if (this.modMuted(p)) { this.toast(p, `🔇 คุณถูกปิดเสียงอยู่ (อีก ${this.modLeftText(p.rec.muteUntil - now)}) ข้อความนี้ไม่ถึงคนอื่นนะ`); return; }
    const clean = Array.from(this.modFilter(text)).slice(0, M.chatMax).join('');
    this.chatLog.push({ name: p.name, text: clean, t: now }); if (this.chatLog.length > 10) this.chatLog.shift();
    this.modLogChat(p, clean, now);
    const s = JSON.stringify({ t: 'chat', id: p.id, name: p.name, text: clean });
    for (const q of this.players.values()) if (q.ws.readyState === 1 && (q === p || !this.modBlocked(p, q))) q.ws.send(s);
  },
  modLogChat(p, text, now) { // data/chatlog/YYYY-MM-DD.jsonl (เวลา ห้อง ชื่อ ข้อความหลังกรอง) เข้าถึงได้เฉพาะผู้ดูแล
    try { fs.mkdirSync(dirOf('chatlog'), { recursive: true }); fs.appendFile(path.join(dirOf('chatlog'), dayStr(now) + '.jsonl'), JSON.stringify({ t: now, room: this.room, name: p.name, text }) + '\n', () => {}); } catch (e) { /* บันทึกไม่ได้ก็ไม่ทำให้แชตล้ม */ }
  },
  modLeftText(ms) { const m = Math.max(1, Math.ceil(ms / 60000)); return m >= 1440 ? Math.ceil(m / 1440) + ' วัน' : m >= 60 ? Math.ceil(m / 60) + ' ชม.' : m + ' นาที'; },
  modMuted(p) { return Number.isFinite(p.rec.muteUntil) && p.rec.muteUntil > Date.now(); },

  // ----- บล็อก -----
  modBlockList(rec) { return Array.isArray(rec.blocks) ? rec.blocks.filter(x => typeof x === 'string') : []; },
  modBlocked(a, b) { // บล็อกกันทางใดทางหนึ่ง = ไม่ส่งแชต/เสียงให้กัน
    if (a === b) return false;
    return this.modBlockList(a.rec).includes(b.key) || this.modBlockList(b.rec).includes(a.key);
  },
  modBlocksPub(p) { const list = this.modBlockList(p.rec); return { t: 'blocks', list: list.map(k => ({ key: k, name: this.saved[k] && this.saved[k].name || k })), ids: [...this.players.values()].filter(q => list.includes(q.key)).map(q => q.id) }; },
  modJoin(p) { if (this.modBlockList(p.rec).length) send(p, this.modBlocksPub(p)); }, // ไม่มีรายการ = ไม่ต้องส่ง (ฝั่งเว็บเริ่มจากว่าง)
  modBlockHandle(p, m) {
    if (typeof m.on !== 'boolean') return;
    let key = '';
    if (Number.isInteger(m.id)) { const q = this.players.get(m.id); if (q) key = q.key; }
    else if (typeof m.name === 'string' && m.on === false) key = clip(m.name, 12).toLowerCase(); // เลิกบล็อกคนที่ออฟไลน์ได้ด้วยชื่อ
    if (!key || key === p.key) return;
    const list = this.modBlockList(p.rec), has = list.includes(key);
    if (m.on) {
      if (has) return;
      if (list.length >= M.blockMax) return this.toast(p, `บล็อกได้สูงสุด ${M.blockMax} คนนะ ลองเลิกบล็อกบางคนก่อน`);
      if (!this.saved[key]) return;
      p.rec.blocks = list.concat(key);
      const q = [...this.players.values()].find(o => o.key === key); if (q) { send(q, { t: 'pcall', from: p.id, k: 'end' }); send(p, { t: 'pcall', from: q.id, k: 'end' }); } // วางสายที่คุยอยู่
    } else { if (!has) return; p.rec.blocks = list.filter(x => x !== key); }
    this.dirty = true;
    send(p, this.modBlocksPub(p));
    this.toast(p, m.on ? '🚫 บล็อกแล้ว คุณกับเขาจะไม่เห็นแชตและไม่ได้ยินเสียงกัน' : 'เลิกบล็อกแล้ว');
  },
  modRelayDenied(p, q) { return this.modMuted(p) || this.modBlocked(p, q); }, // ใช้กับ rtc/pcall: ถูกปิดเสียง/บล็อกกัน = ทิ้ง

  // ----- รายงานผู้เล่น: data/reports/<id>.json -----
  modReport(p, m) {
    const now = Date.now(), why = M.reportWhy.find(w => w.id === m.why);
    if (!why) return this.toast(p, 'เลือกเหตุผลที่รายงานก่อนนะ');
    let q = null;
    if (Number.isInteger(m.id)) q = this.players.get(m.id) || null;
    const tkey = q ? q.key : (typeof m.name === 'string' ? clip(m.name, 12).toLowerCase() : '');
    if (!tkey || tkey === p.key) return this.toast(p, 'รายงานตัวเองไม่ได้นะ');
    if (tkey === ADMIN_NAME.toLowerCase() || (q && q.admin)) return this.toast(p, 'รายงานผู้ดูแลไม่ได้นะ');
    const rec = this.saved[tkey]; if (!rec) return this.toast(p, 'ไม่พบผู้เล่นคนนี้');
    const hits = ((this._repHits || (this._repHits = new Map())).get(p.key) || []).filter(t => now - t < 3600000);
    if (hits.length && now - hits[hits.length - 1] < M.reportGapMs) return this.toast(p, 'รายงานถี่ไปหน่อย รอสักครู่แล้วค่อยส่งใหม่นะ');
    if (hits.length >= M.reportPerHour) return this.toast(p, 'ชั่วโมงนี้รายงานครบแล้ว รอสักพักค่อยส่งใหม่นะ');
    const id = now.toString(36) + crypto.randomBytes(3).toString('hex');
    const r = { id, time: now, room: this.room, by: p.name, byKey: p.key, target: rec.name || tkey, targetKey: tkey, why: why.id, text: clip(m.text, M.reportTextMax), chat: this.chatLog.slice(-M.reportChatLines).map(c => ({ name: c.name, text: c.text, t: c.t })) };
    try { fs.mkdirSync(dirOf('reports'), { recursive: true }); fs.writeFileSync(path.join(dirOf('reports'), id + '.json'), JSON.stringify(r, null, 1)); }
    catch (e) { console.error('บันทึกรายงานผู้เล่นไม่ได้', e.message); return this.toast(p, 'บันทึกไม่ได้ ลองใหม่อีกครั้งนะ'); }
    hits.push(now); this._repHits.set(p.key, hits); // (ผู้ที่ไม่เคยรายงานไม่มีคีย์ในแมป)
    this.toast(p, '🚩 ส่งรายงานแล้ว ขอบคุณที่ช่วยดูแลนะ'); send(p, { t: 'reportres', ok: true });
    for (const a of this.players.values()) if (a.admin) this.toast(a, `🚩 มีรายงานผู้เล่นใหม่: ${r.target} (${why.name}) (เมนู 🛠️ ผู้ดูแล)`);
    console.log('รายงานผู้เล่น:', r.by, '→', r.target, why.id, '#' + id);
  },
  modReportRead(id) { try { return REPORT_ID_RE.test(id) ? JSON.parse(fs.readFileSync(path.join(dirOf('reports'), id + '.json'), 'utf8')) : null; } catch (e) { return null; } },
  modReportList() { // สรุปสำหรับแผงผู้ดูแล (ไม่รวมแชตแนบ ใช้ reportget ดูทีละใบ) ใหม่สุดก่อน
    let names = []; try { names = fs.readdirSync(dirOf('reports')).filter(f => f.endsWith('.json')); } catch (e) { return []; }
    const out = [];
    for (const f of names) { const r = this.modReportRead(f.slice(0, -5)); if (r) out.push({ id: r.id, time: r.time, room: r.room, by: r.by, target: r.target, targetKey: r.targetKey, why: r.why, text: r.text, closed: r.status === 'closed', closedBy: r.closedBy || '', closedAt: r.closedAt || 0 }); }
    out.sort((a, b) => b.time - a.time); return out.slice(0, M.reportKeep);
  },
  modReportSet(id, closed, by) { // ปิด/เปิดรายงานใหม่ (ไม่ลบ เก็บเป็นประวัติ)
    const r = this.modReportRead(id); if (!r) return false;
    if (closed) { r.status = 'closed'; r.closedAt = Date.now(); r.closedBy = by; } else { delete r.status; delete r.closedAt; delete r.closedBy; }
    try { const f = path.join(dirOf('reports'), r.id + '.json'); fs.writeFileSync(f + '.tmp', JSON.stringify(r, null, 1)); fs.renameSync(f + '.tmp', f); } catch (e) { console.error('บันทึกสถานะรายงานไม่ได้', e.message); return false; }
    return true;
  },

  // ----- แชตย้อนหลัง (ผู้ดูแล): กรองตามชื่อ (บางส่วน) ห้อง วัน • ส่งท้ายสุดไม่เกิน chatlogRows แถว -----
  modChatlogQuery(m, now) {
    now = now || Date.now();
    let files = []; try { files = fs.readdirSync(dirOf('chatlog')).filter(f => LOG_FILE_RE.test(f)).sort(); } catch (e) { /* ยังไม่มีบันทึก */ }
    const days = files.map(f => f.slice(0, -6)), day = DAY_RE.test(String(m.day || '')) ? String(m.day) : dayStr(now);
    const nm = clip(m.name, M.chatlogQueryMax).toLowerCase(), room = typeof m.room === 'string' ? m.room.slice(0, 20) : '';
    const rows = [];
    if (days.includes(day)) { let txt = ''; try { txt = fs.readFileSync(path.join(dirOf('chatlog'), day + '.jsonl'), 'utf8'); } catch (e) { /* อ่านไม่ได้ */ }
      for (const ln of txt.split('\n')) { if (!ln) continue; let r; try { r = JSON.parse(ln); } catch (e) { continue; } if (!r || typeof r.name !== 'string') continue; if (nm && !r.name.toLowerCase().includes(nm)) continue; if (room && r.room !== room) continue; rows.push({ t: r.t, room: r.room, name: r.name, text: r.text }); } }
    return { day, days, rows: rows.slice(-M.chatlogRows), total: rows.length };
  },
  modPrune(now) { // ลบไฟล์แชตที่ทั้งวันเก่ากว่า chatlogDays วัน
    let n = 0, files = []; try { files = fs.readdirSync(dirOf('chatlog')); } catch (e) { return 0; }
    for (const f of files) { const x = LOG_FILE_RE.exec(f); if (!x) continue; const t = new Date(+x[1], +x[2] - 1, +x[3]).getTime(); if (Number.isFinite(t) && t + DAY < now - M.chatlogDays * DAY) { try { fs.unlinkSync(path.join(dirOf('chatlog'), f)); n++; } catch (e) { /* ลบไม่ได้ก็ข้าม */ } } }
    return n;
  },
  modTick(now) { // เรียกทุกชั่วโมง: ลบแชตเก่าวันละครั้ง + เก็บโทษแบนชั่วคราวที่หมดแล้ว
    const d = dayStr(now); if (this._modDay !== d) { this._modDay = d; this.modPrune(now); }
    for (const [k, u] of Object.entries(this.banUntil || {})) if (!(u > now)) { delete this.banUntil[k]; this.dirty = true; }
  },

  // ----- แบนชั่วคราว (banUntil: คีย์ชื่อ -> เวลาหมด) ไม่แตะ banned เดิม -----
  modLoad(d) { this.banUntil = {}; const o = d && d.banUntil; if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (typeof k === 'string' && k.length <= 24 && Number.isFinite(v) && v > Date.now()) this.banUntil[k.toLowerCase()] = v; },
  modJoinCheck(key, admin) { // คืนข้อความปฏิเสธ หรือ '' ถ้าเข้าได้ (หมดเวลาแล้วเข้าได้เอง)
    const u = this.banUntil && this.banUntil[key]; if (admin || !u) return '';
    if (u > Date.now()) return 'ชื่อนี้ถูกพักการเล่นชั่วคราว 🚫 เข้าได้อีกครั้งหลัง ' + new Date(u).toLocaleString('th-TH', { hour12: false, dateStyle: 'medium', timeStyle: 'short' });
    delete this.banUntil[key]; this.dirty = true; return '';
  },
  modTempBan(key, dur) { const ms = Object.hasOwn(M.banMs, dur) ? M.banMs[dur] : 0; if (!ms) return 0; (this.banUntil || (this.banUntil = {}))[key] = Date.now() + ms; this.dirty = true; return this.banUntil[key]; },
  modUnban(key) { if (this.banUntil && this.banUntil[key]) { delete this.banUntil[key]; this.dirty = true; } },

  // ----- ปิดเสียงตามเวลา (rec.muteUntil) dur = '10m' | '1h' | '1d' | 'off' -----
  modSetMute(name, dur) {
    const key = clip(name, 12).toLowerCase(); if (!key) return { err: 'ไม่มีชื่อ' };
    if (key === ADMIN_NAME.toLowerCase()) return { err: 'ปิดเสียงผู้ดูแลไม่ได้' };
    const rec = this.saved[key]; if (!rec) return { err: 'ไม่พบชื่อนี้ในห้อง' };
    const q = [...this.players.values()].find(o => o.key === key);
    if (q && q.admin) return { err: 'ปิดเสียงผู้ดูแลไม่ได้' };
    if (dur === 'off') { delete rec.muteUntil; this.dirty = true; if (q) { this.toast(q, '🔊 ผู้ดูแลเปิดเสียงให้คุณแล้ว'); send(q, { t: 'muted', until: 0 }); } return { key, until: 0 }; }
    if (!Object.hasOwn(M.muteMs, dur)) return { err: 'ระยะเวลาไม่ถูกต้อง' };
    rec.muteUntil = Date.now() + M.muteMs[dur]; this.dirty = true;
    if (q) { q.voice = false; this.broadcast({ t: 'voice', id: q.id, on: false }, q); this.toast(q, `🔇 คุณถูกผู้ดูแลปิดเสียงเป็นเวลา ${this.modLeftText(M.muteMs[dur])} แชตและเสียงของคุณจะไม่ถึงคนอื่น`); send(q, { t: 'muted', until: rec.muteUntil }); }
    return { key, until: rec.muteUntil };
  },
};
