'use strict';
// บริการกลางของ World: ส่งข้อความ/เสียง/ข้อความลอย กระเป๋า+ของสด XP เหตุการณ์ ฉาก(เมือง/บ้าน/ถ้ำ/ทะเล) วาป วันที่ (ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() ดู server/mixin.js)
const S = require('../../public/shared.js');
const { TS, SPAWN } = S;
const { CAVE } = require('../consts.js'); // สตริง '@cave' (ไม่ใช่ S.CAVE)
const { logEv, send } = require('../util.js');

module.exports = {
  warpTo(p, to) { // ผู้ดูแลวาปไปฉากไหนก็ได้ทันที (ข้ามเงื่อนไขเดิน/ค่าเรือ): town | cave:N | sea | house:<ชื่อ>; คืนข้อความผิดพลาด หรือ null
    const back = p.scene ? this.townPos(p) : { x: p.x, y: p.y };
    if (p.veh) this.setVeh(p, ''); this.arcLeave(p); this.tradeCancel(p, 'ผู้ดูแลวาป'); if (this.cinema.viewers.delete(p.id)) this.cinemaBroadcast();
    p.seaUntil = 0;
    if (to === 'town') { p.ret = null; this.changeScene(p, null, SPAWN.x, SPAWN.y); return null; }
    p.ret = { x: back.x, y: back.y }; // กลับจากฉากนี้จะไปยืนตรงที่ยืนอยู่ในเมือง
    if (to === 'sea') { p.seaUntil = Date.now() + S.SEA.ms; this.changeScene(p, CAVE + S.SEA.floor, S.SEA.spawn.x, S.SEA.spawn.y); return null; }
    if (to === 'ocean') { p.seaUntil = Date.now() + 10 * 60e3; p.seaW = 0; this.changeScene(p, CAVE + S.OCEAN.floor, S.OCEAN.spawn.x, S.OCEAN.spawn.y); return null; } // ผู้ดูแลวาปไปทะเลใหญ่ (ข้ามเงื่อนไขเวลา/เรือ) อยู่ได้ 10 นาที
    const cave = /^cave:(\d+)$/.exec(to);
    if (cave) { const f = +cave[1]; if (f < 1 || f > S.MINE.floors) return 'ไม่มีถ้ำชั้นนี้'; const at = this.caveLanding(f); this.changeScene(p, CAVE + f, at.x, at.y); return null; }
    if (to.startsWith('house:')) { const key = to.slice(6); if (!this.saved[key]) return 'ไม่พบบ้านหลังนี้'; if (!this.houses[key]) this.houses[key] = { items: {}, next: 1 }; this.changeScene(p, key, S.HOUSE_SPAWN.x, S.HOUSE_SPAWN.y); return null; }
    return 'ไม่รู้จักจุดหมายนี้';
  },
  mapOf(p) { const f = S.caveFloor(p.scene); return f ? this.floorOf(f).map : p.scene ? this.houseMap() : this.map; },
  blockedFor(p, x, y) { const f = S.caveFloor(p.scene); return f ? S.blockedAt(this.floorOf(f).map, x, y) : p.scene ? S.houseBlockedAt(this.houseMap(), this.houseRects(p.scene), x, y, p.x, p.y) : S.blockedAt(this.map, x, y); }, // ในบ้านรวมกล่องเฟอร์นิเจอร์ (ถ้าอยู่ในกล่องอยู่แล้ว เช่นเพิ่งลุกจากเก้าอี้ เดินออกได้)
  adminSend(o) { for (const q of this.players.values()) if (q.admin) send(q, o); },
  nameOfKey(key) { return (this.saved[key] && this.saved[key].name) || key; },
  sceneMates(scene, except) { const sc = scene || null; return [...this.players.values()].filter(q => q !== except && (q.scene || null) === sc); },
  sceneBroadcast(scene, o, except) { const s = JSON.stringify(o); for (const q of this.sceneMates(scene, except)) if (q.ws.readyState === 1) q.ws.send(s); },
  pubFull(q) { return { id: q.id, wet: q.rec && q.rec.wet > Date.now() ? 1 : 0, veh: q.veh || '', held: q.held || '', status: q.status || '', deaf: !!q.deaf, title: q.title, name: q.name, color: q.color, hat: q.hat, pc: q.pc, wear: q.wear, lamp: q.lamp, pet: q.pet, pm: q.pm, pax: q.pax, pay: q.pay, psick: !!(q.pet && this.petSt(q, q.pet).sick), pname: q.pet ? this.petName(q, q.pet) : '', x: q.x, y: q.y, dir: q.dir, voice: !!q.voice }; },
  townPos(p) { const r = p.scene ? p.ret : { x: p.x, y: p.y }; return r && !S.blockedAt(this.map, r.x, r.y) ? r : { x: SPAWN.x, y: SPAWN.y }; }, // ตำแหน่งในเมืองที่จะบันทึก/กลับไป (ถ้าอยู่ในบ้านคือที่ที่ยืนก่อนเข้า)
  changeScene(p, scene, x, y) { // ย้ายผู้เล่นไปฉากใหม่: คนฉากเก่าเห็นเขาหายไป คนฉากใหม่เห็นเขาโผล่ ตัวเองได้รับฉากใหม่
    const old = p.scene || null; scene = scene || null;
    this.sceneBroadcast(old, { t: 'p-', id: p.id, quiet: 1 }, p);
    p.scene = scene; p.x = x; p.y = y; p.sit = null; p.dir = 0;
    if (p.fish) { p.fish = null; send(p, { t: 'fg', off: 1 }); }
    this.sceneBroadcast(scene, Object.assign({ t: 'p+', quiet: 1 }, this.pubFull(p)), p);
    send(p, { t: 'scene', sc: scene, owner: scene && !S.caveFloor(scene) ? this.nameOfKey(scene) : '', mine: scene === p.key, x, y, items: scene && !S.caveFloor(scene) ? this.houseItemsPub(scene) : [], st: scene && !S.caveFloor(scene) ? this.houseStyle(scene) : null, cave: S.caveFloor(scene), until: S.isSeaScene(S.caveFloor(scene)) ? p.seaUntil || 0 : 0, ores: S.caveFloor(scene) ? this.oresPub(S.caveFloor(scene)) : [], players: [...this.sceneMates(scene, p), p].map(q => this.pubFull(q)) });
    this.dirty = true;
  },
  addLog(text) { const e = [Date.now(), text]; this.log.push(e); if (this.log.length > S.TOWN.logMax) this.log.shift(); this.dirty = true; this.broadcast({ t: 'log', e }); },
  creditInv(key, item, n) { // เพิ่มของให้ผู้เล่น (อาจออฟไลน์): อัปเดตทั้งในเกมและไฟล์เซฟ
    const p = [...this.players.values()].find(q => q.key === key), rec = (p && p.rec) || this.saved[key]; if (!rec) return;
    rec.inv[item] = Math.max(0, (rec.inv[item] || 0) + n); if (!rec.inv[item]) delete rec.inv[item];
    if (p) send(p, { t: 'inv', inv: rec.inv }); this.dirty = true;
  },
  // ----- เควสประจำวัน + แต้มความดี + บัฟ + สถิติประจำวัน (Hall of Fame) -----
  today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; },
  event(p, ev, arg) { // เหตุการณ์ที่นับทั้งเควสและสถิติประจำวัน
    this.statDay(); this.starterStep(p, ev);
    if (ev === 'feed' || ev === 'collect' || ev === 'cook' || ev === 'craft') this.telAdd(p, ev, 0);
    if (ev === 'harvest' || ev === 'collect' || ev === 'chop' || ev === 'cook' || ev === 'hplace') this.wk1Step(p, ev);
    this.chEvent(p, ev); this.evHit(p, ev, arg); // งานเบาที่ไม่ผ่าน tire()
    { const c = this.achOf(p.rec).cnt; c[ev] = (c[ev] || 0) + 1; if (ev === 'fish' && arg >= 55) c.fishbig = (c.fishbig || 0) + 1; } // ตัวนับสะสมสำหรับ Achievement
    if (S.FAME[ev]) { this.villageBump(p); }
    if (S.FAME[ev]) { const m = this.stats.ev[ev] || (this.stats.ev[ev] = Object.create(null)); m[p.name] = (m[p.name] || 0) + 1; this.dirty = true; }
    const q = this.questsOf(p); let changed = false, doneNow = false;
    for (const it of q.list) {
      const d = S.QUESTS[it.id];
      if (it.done || !d || d.ev !== ev) continue;
      if (d.min && !(arg >= d.min)) continue;
      if (d.distinct) { if (it.seen.includes(arg)) continue; it.seen.push(arg); }
      changed = true;
      if (++it.n < d.goal) continue;
      it.done = true; doneNow = true;
      this.addXp(p, d.skill, d.xp); this.add(p, 'coin', d.coin, 'quest');
      p.rec.qtotal = (p.rec.qtotal || 0) + 1;
      this.toast(p, `✅ เควสสำเร็จ: ${d.text} (+${d.xp} XP, +🪙${d.coin})`); this.sfxTo(p, 'levelup');
      const title = this.titleOf(p.rec);
      if (title !== p.title) { p.title = title; this.broadcast({ t: 'title', id: p.id, title }); this.toast(p, `🏅 ได้ฉายา "${title}"`); }
      if (q.list.every(x => x.done) && !q.bonus) { // ทำเควสวันนี้ครบทุกข้อ: โบนัส + นับ Achievement
        q.bonus = true; this.add(p, 'coin', S.QUEST_ALL.coin, 'quest'); this.addLog(`⭐ ${p.name} ทำเควสประจำวันครบทั้ง ${q.list.length} ข้อ`);
        this.toast(p, `🌟 เควสวันนี้ครบทุกข้อ! โบนัส +🪙${S.QUEST_ALL.coin}`); this.achAdd(p.rec, 'allq');
      }
    }
    if (changed) { this.dirty = true; this.questPush(p); }
    this.achCheck(p.rec);
    if (doneNow) this.event(p, 'questdone');
  },
  // ----- เติบโต/ดึงให้กลับมาเล่น: คู่มือเริ่มต้น + สมุดสะสม + เข้าเกมติดต่อกัน + เป้าหมายรายสัปดาห์ของเมือง -----
  dayStr(offset) { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; },
  weekKey() { // สัปดาห์แบบ ISO (เริ่มวันจันทร์)
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const w1 = new Date(d.getFullYear(), 0, 4);
    return `${d.getFullYear()}-W${1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7)}`;
  },
  dayOf(t) { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; },
  sfx(p, k) { this.broadcast({ t: 'sfx', k, id: p.id, x: Math.round(p.x), y: Math.round(p.y) }); },
  sfxTo(p, k) { send(p, { t: 'sfx', k, id: p.id, x: Math.round(p.x), y: Math.round(p.y), self: 1 }); },
  broadcast(o, except) {
    const s = JSON.stringify(o);
    for (const p of this.players.values()) if (p !== except && p.ws.readyState === 1) p.ws.send(s);
  },
  toast(p, text) { send(p, { t: 'msg', text }); },
  add(p, key, n, why, lots) { // lots = อายุของที่ได้มา (ของเน่าได้ ใช้ตอนเทรดให้อายุติดไปด้วย) • คืนค่า = กองที่ถูกเอาออก (เมื่อ n < 0)
    const inv = p.rec.inv;
    if (key === 'coin' && n) logEv(this.room, 'coin', { p: p.key, n, why: why || 'other' });
    let taken;
    if (S.perishable(key) && n) { if (n > 0) this.lotPut(p.rec, key, lots || [[Date.now(), n]]); else taken = this.lotTake(p.rec, key, -n); }
    inv[key] = Math.max(0, (inv[key] || 0) + n);
    if (!inv[key] && key !== 'coin') delete inv[key];
    send(p, { t: 'inv', inv, fr: this.freshPub(p.rec, p.key), deep: p.rec.deep || 1 });
    this.dirty = true;
    return taken;
  },
  // ----- ความสดของสินค้า (S.FRESH): rec.lots[ชนิด] = [[เวลาที่ได้, จำนวน], ...] เรียงของเก่าก่อน รวมแล้วเท่ากับจำนวนในกระเป๋าเสมอ -----
  lotsOf(rec, k) { // ปรับให้ตรงกับกระเป๋า (ของที่เข้ากระเป๋าโดยไม่ผ่าน add เช่น ผู้ดูแลให้ = นับเป็นของใหม่)
    const L = (rec.lots || (rec.lots = {}))[k] || (rec.lots[k] = []), have = rec.inv[k] || 0;
    let sum = L.reduce((a, x) => a + x[1], 0);
    if (sum < have) L.push([Date.now(), have - sum]);
    while (sum > have && L.length) { const d = Math.min(L[0][1], sum - have); L[0][1] -= d; sum -= d; if (!L[0][1]) L.shift(); }
    if (!L.length) delete rec.lots[k];
    return L;
  },
  lotPut(rec, k, lots) { const L = this.lotsOf(rec, k); for (const [t, n] of lots) { if (!(n > 0)) continue; const last = L[L.length - 1]; if (last && Math.abs(last[0] - t) < 60000) last[1] += n; else L.push([t, n]); } L.sort((a, b) => a[0] - b[0]); rec.lots[k] = L; },
  lotTake(rec, k, n) { const L = this.lotsOf(rec, k), out = []; while (n > 0 && L.length) { const d = Math.min(L[0][1], n); out.push([L[0][0], d]); L[0][1] -= d; n -= d; if (!L[0][1]) L.shift(); } if (!L.length) delete rec.lots[k]; return out; },
  freshPub(rec, key) { const o = {}; for (const k of Object.keys(rec.inv)) if (S.perishable(k) && rec.inv[k] > 0) o[k] = this.lotsOf(rec, k).map(([t, n]) => [t, n]); return { l: o, fz: this.hasFridge(key) }; },
  lv(p, skill) { return S.levelOf(p.rec.skills[skill], skill); },
  addXp(p, skill, n) {
    const xb = this.petBonus(p).xp; if (xb > 0 && n > 0) { const f = n * (1 + xb); n = Math.floor(f) + (Math.random() < f - Math.floor(f) ? 1 : 0); } // 📚 สัตว์เลี้ยง: XP เพิ่ม (ปัดแบบสุ่มตามเศษ ไม่ให้ค่าน้อยๆ สูญ)
    const r = p.rec.skills, before = S.levelOf(r[skill], skill);
    r[skill] = (r[skill] || 0) + n;
    send(p, { t: 'skills', skills: r });
    const after = S.levelOf(r[skill], skill);
    if (after > before) { logEv(this.room, 'level', { p: p.key, skill, lv: after }); this.toast(p, `🎉 ${S.SKILLS[skill].emoji} ${S.SKILLS[skill].name} เลเวล ${after}!`); this.addLog(`⭐ ${p.name} เลื่อนเป็น ${S.SKILLS[skill].emoji} ${S.SKILLS[skill].name} เลเวล ${after}`); this.sfxTo(p, 'levelup'); }
    this.dirty = true;
  },
  setVeh(p, v) { // ขี่/ลงยานพาหนะ (ต้องมีของ อยู่ในเมือง)
    v = typeof v === 'string' && S.VEHICLES[v] && p.rec.inv['veh_' + v] > 0 && !p.scene ? v : '';
    if ((p.veh || '') === v) return; p.veh = p.rec.veh = v; this.dirty = true;
    this.broadcast({ t: 'veh', id: p.id, v }); if (v) this.toast(p, `${S.VEHICLES[v].emoji} ขี่${S.VEHICLES[v].name}แล้ว (กด V เพื่อลง)`);
  },
  broadcastLook(p) { this.broadcast({ t: 'look', id: p.id, color: p.color, hat: p.hat, pc: p.pc, wear: p.wear, lamp: p.lamp }, p); },
  // ร้านที่ผู้เล่นยืนอยู่ใกล้ประตู (หรือ null)
  nearShopKind(p) { // ร้านที่ใกล้ที่สุดในระยะ (เดิมคืนร้านแรกที่เจอ ร้านที่อยู่ติดกันจึงเปิดผิดร้าน เช่น ร้านยานพาหนะได้ร้านตกปลา)
    let best = null, bd = 110;
    for (const b of S.BUILDINGS) for (const [cx, cy] of b.counter) {
      if (!S.SHOPS[b.kind]) continue;
      const d = Math.hypot(p.x - (cx + 0.5) * TS, p.y - (cy + 0.5) * TS); if (d < bd) { bd = d; best = b.kind; }
    }
    return best;
  },
};
