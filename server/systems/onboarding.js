'use strict';
// คู่มือเริ่มต้น ภารกิจสัปดาห์แรก สรุปตอนกลับมา ของขวัญต้อนรับ ทักคนใหม่ สตรีคเข้าเกม: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { send, logEv } = require('../util.js');

module.exports = {
  starterOf(p) { // ผู้เล่นเก่าที่เล่นมานานแล้ว (ระดับการเล่น ≥ 8) ข้ามคู่มือเริ่มต้น
    const st = p.rec.starter || (p.rec.starter = { done: {}, final: S.playLevel(p.rec.skills) >= 8 });
    if (!st.c2) st.c2 = { done: {}, final: S.playLevel(p.rec.skills) >= 8 }; // คู่มือบทที่ 2 (ตัดไม้ ขุดแร่ สัตว์ ทำอาหาร): แยกสถานะ ผู้เล่นเก่าระดับ ≥ 8 ข้าม
    return st;
  },
  starterStep2(p, ev) { // บทที่ 2: นับทุกเหตุการณ์ที่ตรงข้อ (ไม่ต้องรอจบบทแรก) ได้เหรียญต่อข้อ ครบแล้วรับรางวัลรวม
    const c2 = this.starterOf(p).c2; if (c2.final) return;
    let changed = false;
    for (const s of S.STARTER2) if (s.ev === ev && !c2.done[s.id]) {
      c2.done[s.id] = 1; changed = true; this.add(p, 'coin', s.coin, 'starter');
      logEv(this.room, 'starter2', { p: p.key, step: s.id, n: Object.keys(c2.done).length, sec: p.rec.firstSeen ? Math.round((Date.now() - p.rec.firstSeen) / 1000) : null });
      this.toast(p, `✅ ${s.text} +🪙${s.coin} (บท 2: ${Object.keys(c2.done).length}/${S.STARTER2.length})`);
    }
    if (!changed) return;
    if (S.STARTER2.every(s => c2.done[s.id])) {
      c2.final = true; this.add(p, 'coin', S.STARTER2_FINAL.coin, 'starter');
      this.addLog(`🎓 ${p.name} ผ่านคู่มือบทที่ 2 (รู้จักอาชีพอื่น) ครบแล้ว!`);
      this.toast(p, `🎓 ผ่านคู่มือบทที่ 2 ครบ! รับ 🪙${S.STARTER2_FINAL.coin} — ตัดไม้ ขุดแร่ เลี้ยงสัตว์ ทำอาหารเป็นแล้ว`); this.sfxTo(p, 'levelup');
    }
    this.dirty = true; this.questPush(p);
  },
  starterStep(p, ev) { // event starter: sec = วินาทีนับจากเข้าเกมครั้งแรก (รวมเวลาออฟไลน์), ses = วินาทีนับจากเข้าเซสชันนี้
    const st = this.starterOf(p); this.starterStep2(p, ev); if (st.final) return;
    let changed = false;
    for (const s of S.STARTER) if (s.ev === ev && !st.done[s.id]) { st.done[s.id] = 1; changed = true; logEv(this.room, 'starter', { p: p.key, step: s.id, n: Object.keys(st.done).length, sec: p.rec.firstSeen ? Math.round((Date.now() - p.rec.firstSeen) / 1000) : null, ses: Math.round((Date.now() - (p.joinedAt || Date.now())) / 1000), joins: p.rec.joins || 1 }); this.add(p, 'coin', s.coin, 'starter'); this.toast(p, `✅ คู่มือเริ่มต้น: ${s.hint} (+🪙${s.coin})`); }
    if (!changed && !S.STARTER.every(s => st.done[s.id])) return; // ไม่มีข้อใหม่ แต่ครบทุกข้อแล้ว (คู่มือถูกย่อเหลือ 6 ข้อ) ก็ปิดคู่มือให้
    if (S.STARTER.every(s => st.done[s.id])) {
      st.final = true; this.add(p, 'coin', S.STARTER_FINAL.coin, 'starter'); for (const it of S.STARTER_FINAL.items) this.add(p, it, 1);
      this.addLog(`🎓 ${p.name} ผ่านคู่มือเริ่มต้นครบแล้ว!`);
      { const by = p.rec.invBy && this.saved[p.rec.invBy]; if (by) { const wk = this.weekKey(); if (by.invWk !== wk) { by.invWk = wk; by.invN = 0; } if (by.invN < S.CHALLENGE.perWeek) { by.invN++; this.achAdd(by, 'invite'); const q = [...this.players.values()].find(x => x.key === p.rec.invBy); if (q) this.toast(q, `🪣 ${p.name} ที่คุณท้ามา ผ่านคู่มือเริ่มต้นแล้ว!`); } } }
      for (const g of p.rec.greetedBy || []) { const rg = this.saved[g]; if (!rg) continue; this.achAdd(rg, 'mentor'); const q = [...this.players.values()].find(x => x.key === g); if (q) { this.addPts(q, 5); this.toast(q, `🤗 ${p.name} ที่คุณทักต้อนรับ ผ่านคู่มือเริ่มต้นแล้ว! (+แต้มความดี)`); } }
      this.toast(p, `🎓 ผ่านคู่มือเริ่มต้นครบ! รับ 🪙${S.STARTER_FINAL.coin} + 🪑 เก้าอี้ + 🪴 ต้นไม้ + 🔦 ตะเกียง (เปิดโหมดตกแต่งบ้านด้วยปุ่ม 🏠)`); this.sfxTo(p, 'levelup');
    }
    this.dirty = true; this.questPush(p);
  },
  // ----- ภารกิจสัปดาห์แรก (S.WEEK1) -----
  wk1Of(rec) { if (!rec.firstSeen || rec.firstSeen < S.WEEK1.since) return null; return rec.wk1 || (rec.wk1 = { n: {}, done: {}, final: false }); },
  wk1Day(rec) { const a = new Date(rec.firstSeen), b = new Date(); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 864e5) + 1; },
  wk1Pub(rec) { const w = this.wk1Of(rec); return w && !w.final ? { day: this.wk1Day(rec), n: w.n, done: Object.keys(w.done).map(Number) } : null; },
  wk1Step(p, ev) {
    const rec = p.rec, w = this.wk1Of(rec); if (!w || w.final) return;
    const day = this.wk1Day(rec); let ch = false;
    for (const m of S.WEEK1.list) {
      if (m.ev !== ev || m.d > day || w.done[m.d]) continue;
      w.n[m.d] = (w.n[m.d] || 0) + 1; ch = true;
      if (w.n[m.d] >= m.goal) { w.done[m.d] = 1; this.add(p, 'coin', S.WEEK1.coin, 'week1'); this.toast(p, `🗓️ ภารกิจวันที่ ${m.d} สำเร็จ: ${m.text} (+🪙${S.WEEK1.coin})`); this.sfxTo(p, 'levelup'); }
    }
    if (S.WEEK1.list.every(m => w.done[m.d])) {
      w.final = true; const F = S.WEEK1.final; this.add(p, 'coin', F.coin, 'week1'); this.add(p, F.item, 1); rec.ttl = 'wk1'; p.title = this.titleOf(rec); this.broadcast({ t: 'title', id: p.id, title: p.title });
      this.toast(p, `🏅 ภารกิจสัปดาห์แรกครบ! ได้ฉายา "${F.title}" + 🪙${F.coin} + ${S.itemInfo(F.item).emoji} ${S.itemInfo(F.item).name}`); this.addLog(`🏅 ${p.name} ผ่านภารกิจสัปดาห์แรกครบ ได้ฉายา "${F.title}"`);
    }
    if (ch) { this.dirty = true; this.questPush(p); }
  },
  awaySummary(p, last) { // กลับมาหลังหายไป ≥ 30 นาที: สรุปสิ่งที่รออยู่
    if (!last || Date.now() - last < 30 * 60000) return;
    let ripe = 0; for (const t of Object.values(this.farm)) if (t.c && t.o === p.key && S.cropStage(t) === 3) ripe++;
    const prod = this.animals.filter(a => a.prod && a.feeder === p.key).length, news = this.log.filter(e => e[0] > last).length;
    const parts = []; if (ripe) parts.push(`🌾 ผักสุกรอเก็บ ${ripe} ต้น`); if (prod) parts.push(`🥚 ผลผลิตสัตว์ของคุณรอเก็บ ${prod}`); if (news) parts.push(`📰 ข่าวเมืองใหม่ ${news} เรื่อง`);
    if (parts.length) setTimeout(() => { if (p.ws.readyState === 1) this.toast(p, '👋 ระหว่างที่คุณไม่อยู่: ' + parts.join(' • ')); }, 7000);
  },
  giftOpen(p) { // เปิดกล่องของขวัญต้อนรับ: ได้ของแต่งตัว 1 ชิ้นและสวมให้เลย
    const item = p.rec.gift; if (!item) return; delete p.rec.gift; p.rec.giftItem = item; // ของขวัญขายคืนร้านไม่ได้ (กันสร้างบัญชีปลอมมาเอาเงิน)
    const info = S.itemInfo(item); if (!info || !info.wear) return;
    if (!p.rec.inv[item]) this.add(p, item, 1);
    p.rec.wear[info.wear.cat] = info.wear.id; p.wear = p.rec.wear; this.dirty = true;
    this.broadcastLook(p); send(p, { t: 'look', id: p.id, color: p.color, hat: p.hat, pc: p.pc, wear: p.wear, lamp: p.lamp });
    logEv(this.room, 'gift_open', { p: p.key, item, ses: Math.round((Date.now() - (p.joinedAt || Date.now())) / 1000) });
    this.sfxTo(p, 'levelup');
  },
  greet(p, id, k) { // ทักคนใหม่: โบกมือ/ส่งดอกไม้ ขึ้นเป็นข้อความแชทของผู้ทัก (ทุกคนเห็น) ทักคนเดิมได้ครั้งเดียว
    const q = this.players.get(id | 0); if (!q || q === p || Date.now() - (q.rec.firstSeen || 0) > S.NEWBIE.greetMs) return;
    q.greeted = q.greeted || new Set(); if (q.greeted.has(p.key)) return; q.greeted.add(p.key);
    q.rec.greetedBy = (q.rec.greetedBy || []).concat(p.key).slice(0, 3); // พี่เลี้ยง: ได้เครดิตเมื่อคนใหม่ผ่านคู่มือ
    const text = k === 'flower' ? `🌸 ส่งดอกไม้ต้อนรับ ${q.name} สู่เมืองนะ!` : `👋 ยินดีต้อนรับ ${q.name}!`, now = Date.now();
    this.chatLog.push({ name: p.name, text, t: now }); if (this.chatLog.length > 10) this.chatLog.shift();
    if (!this.modMuted(p)) { const s = JSON.stringify({ t: 'chat', id: p.id, name: p.name, text }); for (const r of this.players.values()) if (r.ws.readyState === 1 && (r === p || !this.modBlocked(p, r))) r.ws.send(s); } // ผ่านระบบบล็อก/ปิดเสียง
    this.toast(q, `${k === 'flower' ? '🌸' : '👋'} ${p.name} ทักทายต้อนรับคุณ!`); this.sfxTo(q, 'collect');
    this.addPts(p, S.NEWBIE.greetPts);
    logEv(this.room, 'welcome', { p: q.key, by: p.key, k: k === 'flower' ? 'flower' : 'wave', sec: Math.round((now - q.rec.firstSeen) / 1000), n: q.greeted.size });
  },
  streakOnJoin(p) { // เข้าเกมติดต่อกัน: ได้เหรียญทุกวันที่เข้า ครบทุก 7 วันได้ของตกแต่งหายาก ขาดวันแล้วเริ่มนับใหม่
    const today = this.today(), o = p.rec.streak = p.rec.streak || { last: '', n: 0 };
    if (o.last === today) return;
    o.n = o.last === this.dayStr(-1) ? o.n + 1 : 1; o.last = today; this.dirty = true;
    let coin = 10 + 5 * Math.min(o.n, 7), extra = '';
    if (o.n % 7 === 0) { const rare = S.RARE[(o.n / 7 - 1) % S.RARE.length], r = S.FURN[rare]; coin += 100; this.add(p, 'furn_' + rare, 1); extra = ` + ${r.emoji} ${r.name}`; }
    this.add(p, 'coin', coin, 'streak');
    setTimeout(() => { if (p.ws.readyState === 1) this.toast(p, `🔥 เข้าเกมติดต่อกัน ${o.n} วัน! +🪙${coin}${extra}`); }, 2500);
  },
};
