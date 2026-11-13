'use strict';
// ร้านค้า (ซื้อ/ขาย/ขายคืน) ตลาดราคาไดนามิก และความอิ่มตัวของตลาดรายหมวด: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { CROPS, ANIMALS } = S;
const { logEv, send } = require('../util.js');
const SELLABLE = S.SELLABLE; // รายการเดียวกับ shared.js
const CAT_NAME = { fish: 'ปลา', crop: 'ผัก/ผลไม้', animal: 'ผลผลิตสัตว์', wood: 'ไม้', ore: 'แร่', dish: 'อาหาร' }; // ชื่อหมวดในข้อความแจ้งผู้เล่น

module.exports = {
  // ----- ตลาดราคาไดนามิก: ขายเยอะราคาตก ปล่อยไว้ราคาค่อยๆ กลับ และทุก 1 วันในเกมราคาเป้าหมายสุ่มใหม่ (มีข่าวราคาพุ่ง/ตก) -----
  pmOf(p, k) { const o = p.rec.mk; return o && Number.isFinite(o[k]) ? o[k] : 1; },
  effMult(p, k) { const g = this.market[k]; return g ? g.m * this.pmOf(p, k) * this.catOf(p, S.sellCat(k)) : 1; }, // ตลาดกลาง × ตลาดส่วนตัว × ความอิ่มตัวของหมวด
  mktFor(p) { const o = {}; for (const k of SELLABLE) o[k] = Math.round(this.effMult(p, k) * 100) / 100; return o; },
  mktSend(keys) { for (const p of this.players.values()) { const o = {}; for (const k of keys || SELLABLE) o[k] = Math.round(this.effMult(p, k) * 100) / 100; send(p, { t: 'mkt', m: o }); } },
  mktPub() { const o = {}; for (const k of SELLABLE) o[k] = Math.round(this.market[k].m * 100) / 100; return o; },
  marketTick(now) {
    if (!this.players.size) return; // โลกจำศีล: ไม่มีคนออนไลน์ ตลาดไม่เดิน
    const day = Math.floor(now / S.DAY_MS);
    if (day !== this.mktDay) {
      this.mktDay = day;
      for (const k of SELLABLE) { const sz = k.startsWith('crop_') ? S.cropSeason(k.slice(5), now) : 0; this.market[k].t = Math.min(S.MARKET.max, Math.min(1.3, Math.max(0.75, 1 + (Math.random() - 0.5) * 0.4)) * (sz > 0 ? S.SEASONS.inMul : sz < 0 ? S.SEASONS.outMul : 1)); } // ฤดูกาล: พืชในฤดูราคาดีกว่า
      { const se = S.seasonAt(now); if (se.on && this.seasonId !== se.s.id) { if (this.seasonId) { const m = `${se.s.emoji} เข้าสู่${se.s.name}แล้ว! ปลูกได้ตอนนี้: ${se.s.crops.map(c => CROPS[c].emoji).join(' ')} ราคาดี (พืชเลเวล ${S.SEASONS.freeLv + 1} ขึ้นไปปลูกได้เฉพาะฤดูของมัน)`; this.broadcast({ t: 'msg', text: m }); this.addLog(m); } this.seasonId = se.s.id; } }
      const up = SELLABLE[Math.floor(Math.random() * SELLABLE.length)]; let dn = SELLABLE[Math.floor(Math.random() * SELLABLE.length)];
      if (dn === up) dn = SELLABLE[(SELLABLE.indexOf(up) + 1) % SELLABLE.length];
      this.market[up].t = 1.35; this.market[dn].t = 0.7;
      const iu = S.itemInfo(up), id = S.itemInfo(dn);
      const news = `📰 ข่าวตลาด: ${iu.emoji} ${iu.name}ราคาพุ่ง! • ${id.emoji} ${id.name}ราคาตก`; this.broadcast({ t: 'msg', text: news }); this.addLog(news);
    }
    for (const k of SELLABLE) { const o = this.market[k]; o.m = Math.min(S.MARKET.max, Math.max(S.MARKET.min, o.m + (o.t - o.m) * S.MARKET.recover)); }
    for (const p of this.players.values()) { const mk = p.rec.mk; if (!mk) continue; // ตลาดส่วนตัวค่อยๆ ฟื้นเฉพาะตอนออนไลน์
      for (const k of Object.keys(mk)) { mk[k] += (1 - mk[k]) * S.PMARKET.recover; if (mk[k] > 0.995 || !SELLABLE.includes(k)) delete mk[k]; } }
    for (const p of this.players.values()) { const ct = p.rec.cat; if (!ct) continue; for (const k of Object.keys(ct)) { ct[k] += (1 - ct[k]) * S.CATFAT.recover; if (ct[k] > 0.995) delete ct[k]; } p.rec.catAt = Date.now(); this.catPush(p); } // ความอิ่มตัวต่อหมวดฟื้นเฉพาะตอนออนไลน์
    this.dirty = true;
    this.mktSend();
  },
  catJoin(p) { // ความอิ่มตัวของตลาดหมวดฟื้นตามเวลาจริงที่ผ่านไปแม้ออฟไลน์ (เหมือนพลังงาน) catAt = ครั้งล่าสุดที่คิดการฟื้น
    const ct = p.rec.cat, now = Date.now(), min = Math.max(0, (now - (p.rec.catAt || now)) / 60000), f = Math.pow(1 - S.CATFAT.recover, min);
    if (ct) for (const k of Object.keys(ct)) { ct[k] = 1 - (1 - ct[k]) * f; if (ct[k] > 0.995) delete ct[k]; }
    p.rec.catAt = now;
  },
  catOf(p, cat) { const o = p.rec.cat; return o && Number.isFinite(o[cat]) ? o[cat] : 1; },
  catPub(p) { const o = p.rec.cat || {}, c = {}; for (const k of Object.keys(o)) if (o[k] < 0.995) c[k] = Math.round(o[k] * 1000) / 1000; return { t: 'cat', c, recover: S.CATFAT.recover }; },
  catPush(p) { send(p, this.catPub(p)); },
  buy(p, item, n) {
    const kind = this.nearShopKind(p);
    if (!kind || typeof item !== 'string' || !S.SHOPS[kind].buy.includes(item)) return;
    const info = S.itemInfo(item);
    if (!info || !info.buy) return;
    if (info.lv && this.lv(p, info.skill) < info.lv) return this.toast(p, `ต้องเป็น${S.SKILLS[info.skill].name}เลเวล ${info.lv} ก่อน`);
    if (info.once) { if (p.rec.inv[item]) return this.toast(p, 'คุณมีของชิ้นนี้อยู่แล้ว'); n = 1; }
    { const tm = /^(rod|axe|pick|hoe|can|pail|pan)_(\d+)$/.exec(item); // อุปกรณ์ระดับ ≤ ที่ใช้อยู่ ซื้อไม่ได้ (กันซื้อของถูกกว่าเพื่อรีเซ็ตความทนของระดับสูงแล้วขายคืนกำไร) ซ่อม/ซื้อใหม่ใช้เมนูซ่อมแทน
      if (tm) { n = 1; const inv = p.rec.inv, cur = tm[1] === 'rod' ? S.rodTier(inv) : tm[1] === 'axe' ? (S.axeTier(inv) || 0) : tm[1] === 'pick' ? (S.pickTier(inv) || 0) : tm[1] === 'hoe' ? S.hoeTier(inv) : tm[1] === 'can' ? S.canTier(inv) : tm[1] === 'pail' ? S.pailTier(inv) : S.panTier(inv); if (+tm[2] <= cur) return this.toast(p, 'คุณมีของระดับนี้หรือดีกว่าอยู่แล้ว'); } }
    if (info.animal) {
      n = 1;
      if (this.ownerCount(p.key, info.animal) >= ANIMALS[info.animal].cap) return this.toast(p, `คุณเลี้ยง${ANIMALS[info.animal].name}ครบ ${ANIMALS[info.animal].cap} ตัวแล้ว`);
    }
    const cost = info.buy * n;
    if ((p.rec.inv.coin || 0) < cost) return this.toast(p, 'เหรียญไม่พอ');
    this.add(p, 'coin', -cost, 'buy'); logEv(this.room, 'buy', { p: p.key, item, q: n, coin: cost, cat: info.cat || 'other' }); // ซื้ออะไร: แยกต้นทุนผลิต (เมล็ด อาหารสัตว์ เหยื่อ) กับของสะสม/ความสะดวก
    if (info.animal) { this.spawnAnimal(info.animal, p); this.syncHerd(p); this.toast(p, `ซื้อ${info.emoji} ${ANIMALS[info.animal].name}ตัวใหม่แล้ว! (ของคุณ ${this.ownerCount(p.key, info.animal)}/${ANIMALS[info.animal].cap})`); return; }
    this.add(p, item, n); if (info.furn) this.bookAdd(p, 'furn', info.furn);
    if (item === 'feed' || item === 'hay' || item === 'slop') this.event(p, 'buyfeed');
    if (info.can) this.waterSet(p, S.CANS[info.can].cap); // ซื้อบัวใหม่ได้น้ำเต็มให้เลย
    if (/^(rod|axe|pick|hoe|pail|pan)_/.test(item)) { const tl = item.split('_')[0]; if (p.rec.dur) delete p.rec.dur[tl]; if (p.rec.fix) delete p.rec.fix[tl]; send(p, { t: 'dur', d: this.durPub(p) }); } // อุปกรณ์ใหม่ความทนทานเต็ม
    this.toast(p, `ซื้อ ${info.emoji} ${info.name}${n > 1 ? ' x' + n : ''}`);
    if (item.startsWith('seed_')) { const sw = S.plantWait(item.slice(5), null, Date.now()); if (sw) this.toast(p, `🔒 ซื้อได้ แต่ปลูกได้ตอน${sw.s.emoji} ${sw.s.name} (อีก ${S.seasonWaitText(sw.ms)}) เก็บเมล็ดไว้ก่อนนะ`); } // เมล็ดนอกฤดู: ซื้อเก็บได้ แต่ปลูกไม่ได้
    this.sfxTo(p, 'coin');
    if (info.wear) p.rec.wear[info.wear.cat] = info.wear.id; // ซื้อแล้วสวมให้เลย
    if (info.pet) this.setPet(p, info.pet);                  // ซื้อสัตว์เลี้ยงแล้วให้เดินตามเลย
    if (info.veh) this.setVeh(p, info.veh);                  // ซื้อยานพาหนะแล้วขี่เลย
    if (item === 'lamp') p.rec.lamp = p.lamp = true;         // ซื้อตะเกียงแล้วจุดให้เลย
    if (info.wear || item === 'lamp') { this.broadcastLook(p); send(p, { t: 'look', id: p.id, color: p.color, hat: p.hat, pc: p.pc, wear: p.wear, lamp: p.lamp }); }
  },
  sell(p, item, n) {
    const kind = this.nearShopKind(p);
    if (!kind || typeof item !== 'string' || !S.shopSells(kind, item)) return;
    const info = S.itemInfo(item), have = p.rec.inv[item] || 0;
    if (!info || !info.sell || !have) return;
    const q = n === 'all' || !(n > 0) ? have : Math.min(have, n | 0);
    const g = this.market[item], mEff = this.effMult(p, item);
    const muls = S.perishable(item) ? S.freshMuls(this.lotsOf(p.rec, item), q, Date.now(), this.hasFridge(p.key)) : null; // ของเก่าขายก่อน ราคาตามความสด
    const quote = S.sellQuote(info.sell, mEff, q, muls); // ขายหลายชิ้นต่อเนื่อง ราคาต่อชิ้นค่อยๆ ลดลง
    const cat = S.sellCat(item), pay = quote.total; // จ่ายต่อชิ้นตามชนิด ลดชิ้นละ 1% ของราคาฐานจนพื้น 20%
    this.add(p, item, -q);
    const nowT = Date.now(), sales = p.rec.sales = (p.rec.sales || []).filter(x => nowT - x[0] < S.TAX.fadeMs), tax = S.saleTax(S.heatOf(sales, nowT), pay); // ภาษีขาย: ขั้นบันไดจากยอดขายสะสมที่ค่อยๆ จางใน 24 ชม. (ขายทีละชิ้นหรือรวดเดียวเสียเท่ากัน)
    const lastS = sales[sales.length - 1]; if (lastS && nowT - lastS[0] < 60000) lastS[1] += pay; else sales.push([nowT, pay]);
    this.add(p, 'coin', pay, 'sell'); if (tax) { this.add(p, 'coin', -tax, 'tax'); this.toPot(tax); }
    const r = mEff > 0 ? Math.min(1, quote.m / mEff) : 1; // สัดส่วนที่ราคารวมลดลงจากการขายชุดนี้ ตลาดจำไว้เท่ากันไม่ว่าขายรวดหรือทยอย (แบ่งครึ่ง: ชนิด/ส่วนตัว กับ หมวด)
    { // หมวดที่ขายจะตกตามปริมาณที่ขาย ส่วนหมวดอื่นฟื้นเร็วขึ้นตามปริมาณนั้น (ได้ตรงนี้ต้องแลกกับหมวดที่ขาย)
      const ct = p.rec.cat = p.rec.cat || {}; ct[cat] = Math.max(S.CATFAT.min, this.catOf(p, cat) * Math.pow(r, 0.5));
      const lift = Math.min(S.CATFAT.spreadMax, S.CATFAT.spread * q);
      for (const c of S.CAT_KEYS) if (c !== cat) { const v = this.catOf(p, c) + (1 - this.catOf(p, c)) * lift; if (v > 0.995) delete ct[c]; else ct[c] = v; }
    }
    if (g) {
      const ri = Math.sqrt(r);
      g.m = Math.min(S.MARKET.max, Math.max(S.MARKET.min, g.m * Math.pow(ri, 1 - S.PMARKET.share)));
      const mk = p.rec.mk = p.rec.mk || {};
      mk[item] = Math.min(1, Math.max(S.PMARKET.min, this.pmOf(p, item) * Math.pow(ri, S.PMARKET.share)));
      this.dirty = true; send(p, { t: 'mkt', m: this.mktFor(p) }); // ผู้ขายเห็นราคาใหม่ทุกชนิด
      for (const q2 of this.players.values()) if (q2 !== p) send(q2, { t: 'mkt', m: { [item]: Math.round(this.effMult(q2, item) * 100) / 100 } });
    }
    const fm = muls ? muls.reduce((a, b) => a + b, 0) / q : 1;
    logEv(this.room, 'sell', { p: p.key, item, q, coin: pay, tax, m: Math.round(mEff * 100) / 100, cat, base: info.sell * q, fm: Math.round(fm * 100) / 100 });
    this.toast(p, `ขาย ${info.emoji} ${info.name} x${q} ได้ 🪙 ${pay - tax}${tax ? ` (หักภาษี 🪙${tax} • ยอดขายสะสม ${Math.round(S.heatOf(sales, nowT))})` : ''}${fm < 0.99 ? ` (ของค้าง/เก่าปนอยู่ ราคาความสดเฉลี่ย ${Math.round(fm * 100)}%)` : ''}${this.catOf(p, cat) < 0.85 ? ` 📉 ตลาด${CAT_NAME[cat] || 'หมวดนี้'}อิ่มตัว (ราคา ${Math.round(this.catOf(p, cat) * 100)}%)` : ''}`); this.catPush(p); this.event(p, 'sell');
    if (S.SHOPS.animal.sell.includes(item)) this.event(p, 'sellproduct');
    this.sfxTo(p, 'coin');
  },
  // ขายของที่ซื้อมาคืนร้าน ได้ 70% ของราคาซื้อ (หัก 30%)
  sellback(p, item) {
    const kind = this.nearShopKind(p);
    if (!kind || typeof item !== 'string' || !S.SHOPS[kind].buy.includes(item) || !(p.rec.inv[item] > 0)) return;
    if (!(p.rec.inv[item] > S.tmigLocked(p.rec, item))) return this.toast(p, 'ชิ้นนี้ได้มาตอนอัปเกรดระบบ ขายคืนไม่ได้นะ เก็บไว้ใช้ได้เลย');
    const info = S.itemInfo(item);
    let frac = 1; // อุปกรณ์ที่มีความทน: ขายคืนตามสภาพ = 70% × ทนเหลือ ÷ ทนเต็มของระดับ (ต่ำสุด SELLBACK_MIN_FRAC) • เฉพาะชิ้นที่ใช้อยู่ (ระดับสูงสุด) เพราะความทนเก็บแยกตามเครื่องมือ
    { const gm = /^(rod|axe|pick|hoe|pail|pan)_(\d+)$/.exec(item);
      if (gm && Object.hasOwn(S.DURABILITY, gm[1]) && this.toolTier(p, gm[1]) === +gm[2]) frac = this.durCur(p, gm[1]) / S.DURABILITY[gm[1]].max[+gm[2]]; }
    const v = S.sellbackValue(item, frac);
    if (!v) return;
    if (item === p.rec.giftItem) return this.toast(p, '🎁 ของขวัญต้อนรับขายคืนไม่ได้ เก็บไว้เป็นที่ระลึกนะ');
    this.add(p, item, -1); this.add(p, 'coin', v, 'sellback');
    if (info.wear && p.rec.wear[info.wear.cat] === info.wear.id) p.rec.wear[info.wear.cat] = S.WEAR_DEFAULT[info.wear.cat];
    if (item === 'lamp') p.rec.lamp = p.lamp = false;
    if (info.veh && p.veh === info.veh) this.setVeh(p, '');
    if (info.pet && p.rec.pet === info.pet) this.setPet(p, Object.keys(S.COMPANIONS).find(c => p.rec.inv['pet_' + c] > 0) || '');
    if (info.can) this.waterSet(p, this.waterCur(p)); // ขายคืนบัวใหญ่ น้ำเกินความจุของบัวที่เหลือถูกตัด
    this.broadcastLook(p); send(p, { t: 'look', id: p.id, color: p.color, hat: p.hat, pc: p.pc, wear: p.wear, lamp: p.lamp });
    this.toast(p, `ขายคืน ${info.emoji} ${info.name} ได้ 🪙 ${v} (หัก 30%)`); this.sfxTo(p, 'coin');
  },
};
