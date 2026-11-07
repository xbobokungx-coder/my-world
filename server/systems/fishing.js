'use strict';
// ตกปลา ทะเลลึก ชักเย่อ: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { TS, T, FISH } = S;
const { send, rand } = require('../util.js');
const { CAVE } = require('../consts.js'); // สตริง '@cave'
const rodOf = inv => S.rodTier(inv);


module.exports = {
  nearWater(p, r = 2) { // มีช่องน้ำอยู่ในระยะ r ช่องรอบตัวผู้เล่นไหม
    const px = Math.floor(p.x / TS), py = Math.floor(p.y / TS);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (this.map[py + dy] && this.map[py + dy][px + dx] === T.WATER) return true;
    return false;
  },
  // ----- ออกทะเล: เรือที่ท่าบนเกาะลึกลับ (S.SEA) → ฉากทะเล (ฉากเดียวกับถ้ำ ชั้น S.SEA.floor) ตกปลาทะเลลึกด้วยเบ็ด จำกัดเวลา -----
  seaFee(p) { return p.rec.inv.boat > 0 ? 0 : S.SEA.fee; },
  seaGo(p) {
    if (p.scene) return;
    if (Math.hypot(p.x - (S.SEA.dock.x + 0.5) * TS, p.y - (S.SEA.dock.y + 0.5) * TS) > 3 * TS) return this.toast(p, '⛵ ไปที่เรือบนเกาะลึกลับกลางสระก่อนนะ');
    if (this.lv(p, 'fish') < S.SEA.minFishLv) return this.toast(p, `⛵ ต้องเป็นชาวประมงเลเวล ${S.SEA.minFishLv} ขึ้นไปถึงจะออกทะเลได้`);
    const boat = p.rec.inv.boat > 0, win = boat ? S.oceanWindow(Date.now()) : null;
    if (boat && !win.ok) return this.toast(p, win.why); // มีเรือ: ขับเรือเองในทะเลใหญ่ ฟรี แต่ต้องออกช่วงเช้า-บ่าย (กลับก่อนตะวันตก)
    const fee = this.seaFee(p); // ไม่มีเรือ: จ่ายค่าเรือขึ้นแพ (ดาดฟ้า ตกปลาจากแพ 15 นาที)
    if ((p.rec.inv.coin || 0) < fee) return this.toast(p, `⛵ ค่าเรือ 🪙 ${fee} เหรียญไม่พอ (ซื้อเรือของตัวเองที่ร้านยานพาหนะ 🪙${S.BOAT.price} ขับเรือออกทะเลใหญ่ได้ฟรี)`);
    if (p.veh) this.setVeh(p, '');
    this.arcLeave(p); this.tradeCancel(p, 'ผู้เล่นออกทะเล'); if (this.cinema.viewers.delete(p.id)) this.cinemaBroadcast();
    if (fee) { this.add(p, 'coin', -fee, 'sea'); this.toPot(fee); } // ค่าเรือเข้ากองกลางหวย (คนมีเรือไม่เสีย)
    p.ret = { x: (S.SEA.ret.x + 0.5) * TS, y: (S.SEA.ret.y + 0.5) * TS }; p.seaW = 0;
    if (boat) {
      p.seaUntil = Date.now() + win.ms;
      this.changeScene(p, CAVE + S.OCEAN.floor, S.OCEAN.spawn.x, S.OCEAN.spawn.y);
      this.toast(p, `⛵ ออกเรือของคุณ! ขับเรือด้วย WASD/จอยสติ๊ก ล่องทะเลใหญ่ได้ราว ${Math.max(1, Math.round(win.ms / 60000))} นาทีจนตะวันตก • คลิก/แตะน้ำใกล้ๆ โยนเบ็ด (ไกลสุด ${S.OCEAN.castRange} ช่อง) • ปลาแพงอยู่ทะเลลึกทางขวา • แล่นกลับท่า (ซ้ายสุด) เพื่อกลับเกาะ`);
      return;
    }
    p.seaUntil = Date.now() + S.SEA.ms;
    this.changeScene(p, CAVE + S.SEA.floor, S.SEA.spawn.x, S.SEA.spawn.y);
    this.toast(p, `⛵ ขึ้นแพออกทะเล! ตกปลาทะเลลึกด้วยเบ็ดได้ ${Math.round(S.SEA.ms / 60000)} นาที (ใช้เหยื่อเหมือนเดิม) • เดินไปท้ายแพเพื่อกลับเกาะ • อยากขับเรือเองออกทะเลใหญ่ ซื้อเรือที่ร้านยานพาหนะ`);
  },
  seaLeave(p, msg) { if (!S.isSeaScene(S.caveFloor(p.scene))) return; p.seaUntil = 0; p.seaW = 0; this.leaveCave(p); this.toast(p, msg); },
  seaAct(p, m) { // บนเรือ: ใช้ได้แค่เบ็ด ตกปลาทะเลลึก (ชุดปลาแยกจากสระ)
    const now = Date.now();
    if (now - p.lastAct < 150) return;
    p.lastAct = p.activeAt = now;
    if (m.tool !== 'rod') return this.toast(p, '🎣 บนเรือใช้เบ็ดตกปลาเท่านั้น (เลือกเบ็ดที่ช่องเครื่องมือ)');
    p.workAt = now; if (now - (p.swAt || 0) > 1500) this.sceneBroadcast(p.scene, { t: 'use', id: p.id }, p);
    p.baitSel = typeof m.bait === 'string' && /^bait(_[23])?$/.test(m.bait) ? m.bait : 'bait';
    if (p.fish) return this.reelFish(p, now);
    if (p.rec.hunger <= 0) return this.toast(p, '😵 หิวจนไม่มีแรง! ไปกินอาหารก่อนนะ (ร้านอาหาร หรือกินผลผลิตจากกระเป๋า)');
    let [tx, ty] = S.facing(p.x, p.y, p.dir);
    if (Number.isInteger(m.tx) && Number.isInteger(m.ty)) { // คลิกเลือกช่องน้ำเอง (โยนไกลแค่ไหนก็ได้)
      tx = m.tx; ty = m.ty; const dx = tx - Math.floor(p.x / TS), dy = ty - Math.floor(p.y / TS);
      if (dx || dy) p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
    }
    const cf = S.caveFloor(p.scene), oc = S.isOcean(cf), map = this.floorOf(cf).map;
    if (!map[ty] || map[ty][tx] !== (oc ? T.CAVE : T.WATER)) return this.toast(p, 'ต้องเลือกช่องที่เป็นน้ำ');
    if (oc && Math.max(Math.abs(tx - Math.floor(p.x / TS)), Math.abs(ty - Math.floor(p.y / TS))) > S.OCEAN.castRange) return this.toast(p, `ไกลเกินไป โยนเบ็ดได้ไกลสุด ${S.OCEAN.castRange} ช่องจากเรือ`);
    this.castFish(p, tx, ty, now, true, oc ? S.oceanZone(tx, ty) : '');
  },
  reelFish(p, now) { // กำลังตกปลาอยู่: กดอีกครั้งเพื่อดึงเบ็ด (ทั้งสระและทะเล ต่างกันที่ชุดปลา p.fish.sea)
    const fi = p.fish;
    if (fi.st === 'fight') return; // กำลังชักเย่อ: กรอผ่านข้อความ reel (กดค้าง) ไม่ใช่การกดดึงครั้งเดียว
    if (fi.st === 'wait') { // ดึงเบ็ดก่อนปลากิน: คืนเหยื่อให้ (เดิมเสียเหยื่อฟรี มือใหม่กดซ้ำแล้วเสียของ)
      if (fi.bk) this.add(p, fi.bk, 1);
      this.toast(p, 'ดึงเบ็ดกลับ ยังไม่มีปลากิน (ได้เหยื่อคืน)'); this.sfx(p, 'miss'); p.fish = null; return;
    }
    // (สถานะอื่นไม่มี: ปลากินเบ็ดแล้ว tick ในเซิร์ฟเวอร์เรียก startFight เข้าชักเย่อทันที)
  },
  startFight(p, now) { // ปลากินเบ็ด → เลือกปลาแล้วเริ่มชักเย่อเลย (ขั้นเดียว) • ใช้อัตราปลาเต็มและจุดเริ่มแบบ "เป๊ะ" เสมอ (เดิมต้องกดเกจให้โดนกลางโซนถึงได้)
    const fi = p.fish;
    const fl = fi.fl, rod = fi.rod, perfect = true;
    const rareCd = (p.rec.rareAt || 0) > Date.now(); // ปลาหายากเพิ่งตกได้ พักรอบก่อน (ยังตกปลาธรรมดาได้)
    const pool = S.fishPool(!!fi.sea).filter(f => f.lv <= fl && !(rareCd && f.sell >= 100)).map(f => ({ f, w: S.fishWeight(f, fl, rod, fi.bt || 1)  * (fi.zone ? S.oceanZoneMul(fi.zone, f.lv) : 1) })).filter(x => x.w > 0); // ทะเลใหญ่: ปลาระดับที่ตรงโซนออกบ่อยขึ้น
    if (!pool.length) { p.fish = null; return this.toast(p, 'ปลาหนีไปแล้ว...'); } // กันสระปลาว่างทำ tick ทั้งห้องค้าง
    let r = Math.random() * pool.reduce((a, x) => a + x.w, 0), f = pool[0].f;
    for (const x of pool) { if ((r -= x.w) < 0) { f = x.f; break; } }
    const firstFish = !fi.sea && !(this.achOf(p.rec).cnt.fish > 0); if (firstFish) f = FISH.find(x => x.id === S.NEWBIE.firstFish) || f; // ปลาตัวแรกในชีวิตการันตีตัวสวย
    const ft = S.fightNew(S.fishClass(f), rod, S.perkLv(fl), perfect, Math.random);
    Object.assign(fi, { st: 'fight', pick: f, perfect: false, firstFish, ft, hold: false, last: now, sync: now, at: now + S.FIGHT.timeoutMs + 5000 });
    send(p, { t: 'fight', cls: ft.cls, sched: ft.sched, dist: ft.dist, ten: ft.ten, str: ft.str, run: ft.run, spd: ft.spd, rise: ft.rise, perfect: !!perfect });
    this.toast(p, '🎣 ปลากินเบ็ดแล้ว! กดค้างเพื่อกรอสาย ปล่อยเมื่อสายตึงเกินไป'); this.sfx(p, 'bite');
  },
  fightAdvance(p, now) { // เดินการชักเย่อของผู้เล่นไปถึงเวลา now ตามสถานะกรอล่าสุด (เรียกตอนรับ input และทุก tick) จบแล้วตัดสินผล
    const fi = p.fish; if (!fi || fi.st !== 'fight') return;
    const ms = Math.max(0, Math.min(2000, now - fi.last)); fi.last = now; S.fightStep(fi.ft, ms, fi.hold);
    if (fi.ft.end) this.fightEnd(p, now);
  },
  fightEnd(p, now) {
    const fi = p.fish, r = fi.ft.end; send(p, { t: 'fe', r });
    if (r === 'win') return this.landFish(p, fi.pick, fi.perfect, fi.firstFish, fi.ft.peak < S.FIGHT.cleanBelow);
    this.toast(p, r === 'snap' ? '💥 สายเอ็นขาด! ปลาหลุดไปแล้ว (อย่ากรอค้างตอนสายตึงจัด)' : '🐟 ปลาหนีไปได้... (ปล่อยสายนานเกินไป)'); this.sfx(p, 'miss'); p.fish = null;
  },
  landFish(p, f, perfect, firstFish, clean) { // ชนะการชักเย่อ: ให้ปลา XP ตามเดิม (ชักเย่อสะอาด = สายไม่เคยตึงจัด ได้ XP เพิ่ม)
    const xpMul = (clean ? S.FIGHT.cleanXp : 1) * S.FIGHT.xpMul[S.fishClass(f)];
      this.add(p, 'fish_' + f.id, 1);
      this.addXp(p, 'fish', Math.round(f.xp * xpMul)); this.tire(p, 'fish', f.sell);
      if (this.petLuck(p, f.emoji + ' ' + f.name)) this.add(p, 'fish_' + f.id, 1);
      if (f.sell >= 100) { p.rec.rareAt = Date.now() + S.RARE_CD_MS; this.enPush(p); this.toast(p, `🐟 ปลาหายากพักรอบ ${Math.round(S.RARE_CD_MS / 60000)} นาที (ตกปลาธรรมดาได้ตามปกติ)`); }
      this.toast(p, firstFish ? `🎉 ปลาตัวแรกของคุณเป็น ${f.emoji} ${f.name}! โชคดีสุดๆ` : `${perfect ? '🎯 เป๊ะ! ' : ''}${clean ? '✨ ชักเย่อสวย! ' : ''}ได้ ${f.emoji} ${f.name}!`); if (firstFish) this.addLog(`🎣 ${p.name} ตกปลาครั้งแรกได้${f.emoji} ${f.name}!`); if (f.sell >= 100) this.addLog(`${f.emoji} ${p.name} ตกได้${f.name}ตัวใหญ่!`);
      this.event(p, 'fish', f.sell); this.bookAdd(p, 'fish', f.id); this.broadcast({ t: 'catch', id: p.id, f: f.id }); // ทุกคนเห็นปลากระโดดขึ้นมาอยู่เหนือหัว
      this.sfx(p, f.sell >= 100 ? 'catch_big' : 'catch');
    p.fish = null;
  },
  castFish(p, tx, ty, now, sea, zone) { // โยนเบ็ด (ตรวจช่องน้ำ/ระยะไว้แล้วที่ผู้เรียก) หักเหยื่อ ตั้งเวลาปลากิน
    const inv = p.rec.inv;
    const bk = p.baitSel || 'bait', binfo = S.itemInfo(bk), bt = binfo ? binfo.bait : 1;
    if (binfo && binfo.lv && this.lv(p, 'fish') < binfo.lv) return this.toast(p, `ต้องเป็นชาวประมงเลเวล ${binfo.lv} ถึงจะใช้${binfo.name}ได้`);
    if (!(inv[bk] > 0)) return this.toast(p, `ไม่มี${binfo ? binfo.name : 'เหยื่อ'} ซื้อได้ที่ร้านตกปลา ${binfo ? binfo.emoji : '🪱'}`);
    this.add(p, bk, -1);
    const fl = this.lv(p, 'fish'), rod = rodOf(inv);
    const wait = rand(5500, 12000) * S.ACTION_TUNE.fish * Math.max(0.4, 1 - 0.05 * (S.perkLv(fl) - 1)) * S.ROD_WAIT[rod] * (this.happyOn(p) ? S.VILLAGE.fishMul : 1);
    p.fish = { st: 'wait', at: now + wait, fx: tx * TS + 16, fy: ty * TS + 16, fl, rod, bt, bk, sea: !!sea, zone: zone || '' };
    this.sfx(p, 'cast'); this.durUse(p, 'rod');
  },
};
