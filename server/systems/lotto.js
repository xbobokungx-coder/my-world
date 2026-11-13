'use strict';
// ระบบกองกลาง + หวยประจำวัน: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const crypto = require('crypto');
const S = require('../../public/shared.js'); // object เดียวกับที่ server.js โหลด (หลังตั้ง __LAYOUT)
const { TS } = S;
const { logEv, send } = require('../util.js');

module.exports = {
  // ----- กองกลาง + หวยประจำวัน (S.LOTTO, ภาษีขาย S.TAX) -----
  // เงินเข้ากองกลาง: ค่าซ่อม ค่าเตา ค่าช่างไม้ ค่าเช่าแปลง ค่าบริการตู้เกม ไถ่โทษชาเลนจ์ ภาษีขาย (ร้านและแผง) และค่าตั๋ว • ไม่มีบริจาค
  toPot(n) { n = Math.floor(n); if (n > 0) { this.lotto.pot += n; this.dirty = true; } },
  lottoDate(ts) { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }, // วันตามเวลาเซิร์ฟเวอร์ (TZ=Asia/Bangkok)
  lottoDrawAt(round) { const [y, m, d] = round.split('-').map(Number); return new Date(y, m - 1, d, S.LOTTO.revealHour, 0, 0).getTime(); },
  lottoRoundAfter(ts) { const t = new Date(ts), r = this.lottoDate(ts); return ts < this.lottoDrawAt(r) ? r : this.lottoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1).getTime()); }, // งวดที่กำลังขายตั๋วอยู่ ณ เวลา ts
  lottoHash(nums, salt) { return crypto.createHash('sha256').update(salt + ':' + nums.join(',')).digest('hex'); },
  lottoSeal() { // สุ่มเลขชนะ 3 ชุดไว้ก่อนเปิดขายตั๋วงวดนั้น ผู้เล่นเห็นแค่ hash จนกว่าจะเปิดผล
    const nums = [0, 1, 2].map(() => String(crypto.randomInt(1000)).padStart(3, '0')), salt = crypto.randomBytes(8).toString('hex');
    return { nums, salt, hash: this.lottoHash(nums, salt) };
  },
  loadLotto(d) {
    const o = d && typeof d === 'object' ? d : {}, ok3 = x => typeof x === 'string' && /^\d{3}$/.test(x);
    this.lotto = { pot: Number.isFinite(o.pot) && o.pot >= 0 ? Math.floor(o.pot) : S.LOTTO.seed, round: typeof o.round === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(o.round) ? o.round : '', sealed: null, tickets: {}, last: null, hist: [] }; // ครั้งแรก: กองตั้งต้น S.LOTTO.seed
    const sl = o.sealed; if (sl && Array.isArray(sl.nums) && sl.nums.length === 3 && sl.nums.every(ok3) && typeof sl.salt === 'string') this.lotto.sealed = { nums: sl.nums.slice(), salt: sl.salt.slice(0, 32), hash: this.lottoHash(sl.nums, sl.salt.slice(0, 32)) };
    if (o.tickets && typeof o.tickets === 'object') for (const [k, v] of Object.entries(o.tickets)) if (Array.isArray(v)) { const l = v.filter(ok3).slice(0, S.LOTTO.maxTickets); if (l.length) this.lotto.tickets[k] = l; }
    if (o.ipTickets && typeof o.ipTickets === 'object') for (const [k, v] of Object.entries(o.ipTickets)) if (k && k.length <= 64 && Number.isFinite(v) && v > 0) (this.lotto.ipTickets || (this.lotto.ipTickets = {}))[k] = Math.min(Math.floor(v), S.LOTTO.ipMax); // นับตั๋วต่อ IP ของงวดนี้ (เพิ่มใหม่ มีเฉพาะเมื่อมีตั๋ว เซฟเก่าไม่มี = ว่าง)
    const okH = l => l && Array.isArray(l.nums) && l.nums.length === 3 && l.nums.every(ok3) && Array.isArray(l.winners), cleanH = l => ({ round: String(l.round || ''), nums: l.nums.slice(), n: Number.isFinite(l.n) ? l.n : 0, pot0: Number.isFinite(l.pot0) ? l.pot0 : 0, winners: l.winners.slice(0, 40).filter(w => Array.isArray(w) && w.length === 3) });
    this.lotto.hist = Array.isArray(o.hist) ? o.hist.filter(okH).slice(0, 30).map(cleanH) : []; // ประวัติเลขที่ออกย้อนหลัง 30 งวด
    const l = o.last; if (l && Array.isArray(l.nums) && Array.isArray(l.winners)) this.lotto.last = { round: String(l.round || ''), nums: l.nums.filter(ok3), salt: String(l.salt || ''), hash: String(l.hash || ''), n: Number.isFinite(l.n) ? l.n : 0, pot0: Number.isFinite(l.pot0) ? l.pot0 : 0, winners: l.winners.slice(0, 40).filter(w => Array.isArray(w) && w.length === 3) };
    if (!this.lotto.round || !this.lotto.sealed) { this.lotto.round = this.lotto.round || this.lottoRoundAfter(Date.now()); this.lotto.sealed = this.lottoSeal(); this.dirty = true; }
    if (S.LOTTO.claimMs > 0 && this.saved) for (const r of Object.values(this.saved)) this.lottoExpire(r, Date.now()); // รางวัลที่ไม่มารับเกินกำหนดคืนกองกลางตอนโหลด
  },
  lottoExpire(rec, now) { // claimMs > 0: รายการรอรับที่เก่ากว่าเวลาที่กำหนด (e[3] = เวลาที่ได้) หมดอายุ คืนกองกลาง • 0 = ไม่หมดอายุ
    if (!(S.LOTTO.claimMs > 0) || !rec || !Array.isArray(rec.lottoPend)) return;
    const keep = []; let back = 0;
    for (const e of rec.lottoPend) { if (Array.isArray(e) && Number.isFinite(e[3]) && Number.isFinite(e[2]) && e[2] > 0 && now - e[3] > S.LOTTO.claimMs) back += Math.floor(e[2]); else keep.push(e); }
    if (!back) return;
    if (keep.length) rec.lottoPend = keep; else delete rec.lottoPend;
    this.toPot(back); this.dirty = true;
  },
  lottoTick(now) { let n = 0; while (now >= this.lottoDrawAt(this.lotto.round) && n++ < 30) this.lottoDraw(); }, // ถึงเวลาแล้วออกผล (ถ้าเซิร์ฟเวอร์ดับข้ามเวลา ออกย้อนหลังด้วยเลขที่ปิดผนึกไว้)
  lottoDraw() {
    const L = this.lotto, { nums, salt, hash } = L.sealed, base = L.pot, wins = []; let paid = 0, nTickets = 0;
    for (const list of Object.values(L.tickets)) nTickets += list.length;
    const srt = x => x.split('').sort().join(''), a = nums[0]; // โต๊ด: เลข 3 ตัวเดียวกับรางวัล 1 สลับที่ (ตรงเป๊ะนับเป็นรางวัล 1 ไม่ซ้อน)
    const isHit = (P, k, t) => P.tote ? t !== a && srt(t) === srt(a) : P.front ? t.slice(0, P.front) === a.slice(0, P.front) : P.near ? ((d) => d === 1 || d === 999)((parseInt(t, 10) - parseInt(a, 10) + 1000) % 1000) : P.last1 ? t[2] === a[2] : t.slice(3 - P.digits) === nums[k].slice(3 - P.digits);
    S.LOTTO.prize.forEach((P, k) => {
      const hit = []; for (const [key, list] of Object.entries(L.tickets)) for (const t of list) if (isHit(P, k, t)) hit.push(key); // ตั๋วเลขซ้ำถูกกี่ใบ ได้กี่ส่วน
      if (!hit.length) return;
      const amt = Math.max(P.min || 0, Math.min(Math.floor(base * P.pct), P.cap)), by = {}; // เงินรางวัลก้อนนี้ (min = ขั้นต่ำต่อใบของรางวัลแบบ each)
      if (P.each) { for (const key of hit) { const g = Math.min(amt, Math.max(0, base - paid)); if (g <= 0) break; by[key] = (by[key] || 0) + g; paid += g; } } // ทุกใบที่ถูกได้เต็ม ไม่หาร จนกว่ากองจะหมด
      else { const each = Math.floor(Math.min(amt, Math.max(0, base - paid)) / hit.length); if (each <= 0) return; for (const key of hit) by[key] = (by[key] || 0) + each; paid += each * hit.length; } // รวมทุกรางวัลไม่เกินกองกลาง
      for (const [key, g] of Object.entries(by)) wins.push([key, k + 1, g]);
    });
    L.pot = Math.max(0, L.pot - paid);
    const winners = wins.map(([key, k, amt]) => { const rec = this.saved[key]; return [rec && rec.name || key, k, amt]; });
    for (const [key, k, amt] of wins) {
      this.lottoAward(key, k, amt); // เงินรางวัลรอรับที่ตู้ (ไม่เข้ากระเป๋าเอง) ย้ายเข้ากระเป๋าตอนรับ
    }
    L.last = { round: L.round, nums, salt, hash, n: nTickets, pot0: base, winners };
    L.hist.unshift({ round: L.round, nums, n: nTickets, pot0: base, winners }); if (L.hist.length > 30) L.hist.length = 30;
    logEv(this.room, 'lotto', { round: L.round, nums, tickets: nTickets, pot: base, paid, winners: wins.length });
    const prize = [...new Set(wins.map(w => w[1]))];
    this.broadcast({ t: 'msg', text: prize.length ? `🎟️ Lucky Lotto ${nums[0]} / ${nums[1].slice(1)} / ${nums[2].slice(1)} ออกแล้ว มีผู้ถูกรางวัล ${prize.map(k => S.LOTTO.prize[k - 1] ? S.LOTTO.prize[k - 1].e : k).join(' ')} จ่าย 🪙 ${paid} กองกลางเหลือ 🪙 ${L.pot}` : `🎟️ Lucky Lotto ${nums[0]} / ${nums[1].slice(1)} / ${nums[2].slice(1)} ออกแล้ว ไม่มีผู้ถูกรางวัล ทบกองกลาง 🪙 ${L.pot}` }); // ประกาศผลแบบข้อความลอย ไม่ลงข่าวเมือง
    const nx = new Date(this.lottoDrawAt(L.round)); nx.setDate(nx.getDate() + 1);
    L.round = this.lottoDate(nx.getTime()); L.sealed = this.lottoSeal(); L.tickets = {}; delete L.ipTickets; this.dirty = true; // สุ่มและปิดผนึกเลขงวดถัดไปก่อนเปิดขายตั๋ว
    for (const p of this.players.values()) send(p, { t: 'lotto', l: this.lottoPub(p) });
  },
  lottoAward(key, k, amt) { // มอบรางวัล = เขียนลง rec.lottoPend [[งวด, รางวัล, เหรียญ]] + แจ้งคนออนไลน์ให้ไปรับที่ตู้ (e[3] = เวลาที่ได้ • ไม่หมดอายุถ้า claimMs = 0 ถ้า > 0 หมดอายุแล้วคืน lotto.pot ตอนโหลด/เข้าเกม)
    amt = Math.floor(amt); const rec = this.saved[key]; if (!rec || !Number.isFinite(amt) || amt <= 0) return false;
    const pend = rec.lottoPend || (rec.lottoPend = []); pend.push([this.lotto.round, k, amt, Date.now()]);
    while (pend.length > S.LOTTO.pendMax) { const a = pend.shift(), b = pend[0]; pend[0] = [b[0], 0, a[2] + b[2], Math.min(Number.isFinite(a[3]) ? a[3] : Infinity, Number.isFinite(b[3]) ? b[3] : Infinity)].filter(x => x !== Infinity); } // เกินเพดาน รวมรายการเก่าสุดเป็นก้อนเดียว (k 0 = รวมหลายรางวัล)
    this.dirty = true;
    const q = [...this.players.values()].find(o => o.key === key);
    if (q) { this.toast(q, `🎟️ ถูก Lucky Lotto ${this.lottoPrizeName(k)}! ไปรับ 🪙 ${amt} ที่ตู้ Lucky Lotto ได้เลย`); this.sfxTo(q, 'levelup'); }
    return true;
  },
  lottoPendSum(rec) { let s = 0; for (const e of (rec && Array.isArray(rec.lottoPend) ? rec.lottoPend : [])) if (Array.isArray(e) && Number.isFinite(e[2]) && e[2] > 0) s += Math.floor(e[2]); return s; },
  lottoClaim(p, quiet) { // รับรางวัลรอรับ: ต้องยืนใกล้ตู้ • ลบรายการก่อนค่อยเพิ่มเหรียญ (รับซ้ำได้ 0)
    const rec = p.rec, sum = this.lottoPendSum(rec); if (!sum) { if (rec.lottoPend) { delete rec.lottoPend; this.dirty = true; } return 0; }
    if (!this.nearLucky(p)) { if (!quiet) this.toast(p, '🎟️ ต้องยืนใกล้ตู้ Lucky Lotto ที่ลานกองไฟถึงจะรับรางวัลได้'); return 0; }
    delete rec.lottoPend; this.add(p, 'coin', sum, 'lotto'); this.dirty = true;
    this.toast(p, `🎟️ รับรางวัล Lucky Lotto รวม 🪙 ${sum} เรียบร้อย!`); this.sfxTo(p, 'coin'); send(p, { t: 'inv', inv: S.invPub(rec) });
    return sum;
  },
  lottoPrizeName(k) { if (!k) return 'รางวัลรวม'; const P = S.LOTTO.prize[k - 1]; return P ? (k <= 3 ? `รางวัลที่ ${k}` : P.e + ' ' + P.name) : `รางวัลที่ ${k}`; }, // ชื่อรางวัลในข้อความ (1–3 เรียกเลขที่ 4+ เรียกชื่อ)
  nearLucky(p) { return Math.hypot(p.x - (S.LUCKY.x + 0.5) * TS, p.y - (S.LUCKY.y + 0.5) * TS) < 4.5 * TS; },
  lottoOk(p) { return !!this.starterOf(p).final && S.playLevel(p.rec.skills) >= S.LOTTO.minLv; },
  // left ใน lottoPub ส่งเฉพาะตอนโควตาเครือข่ายตึงกว่าโควตาบัญชี (ไม่มี = ใช้ max - mine.length)
  lottoIpLeft(p) { const L = this.lotto, ip = p.ip; return ip ? Math.max(0, S.LOTTO.ipMax - ((L.ipTickets || {})[ip] || 0)) : Infinity; }, // โควตาตั๋วที่เหลือของเครือข่าย (ไม่รู้ IP = ไม่จำกัดตามเครือข่าย)
  lottoPub(p) {
    const L = this.lotto, now = Date.now(), heat = Math.round(S.heatOf(p.rec.sales, now));
    const buyers = Object.entries(L.tickets).map(([k, l]) => [(this.saved[k] && this.saved[k].name) || k, l.length]).sort((a, b) => b[1] - a[1]); // ใครซื้อกี่ใบ (ไม่เผยเลขของแต่ละคน)
    return { buyers, hist: L.hist.map(h => ({ round: h.round, nums: h.nums, n: h.n, pot0: h.pot0, winners: h.winners })), near: this.nearLucky(p), pot: L.pot, drawAt: this.lottoDrawAt(L.round), now, hash: L.sealed.hash, mine: L.tickets[p.key] || [], max: S.LOTTO.maxTickets, ...(this.lottoIpLeft(p) < S.LOTTO.maxTickets - (L.tickets[p.key] || []).length ? { left: this.lottoIpLeft(p) } : {}), price: S.LOTTO.price, minLv: S.LOTTO.minLv, ok: this.lottoOk(p), open: now < this.lottoDrawAt(L.round) - S.LOTTO.closeMs, last: L.last, ...(this.lottoPendSum(p.rec) ? { pend: p.rec.lottoPend.filter(e => Array.isArray(e) && e[2] > 0).map(e => e.slice(0, 3)) } : {}), heat, rate: S.taxRate(heat) };
  },
  lottoBuy(p, m) {
    const L = this.lotto, now = Date.now(), mine = L.tickets[p.key] || [];
    if (!this.nearLucky(p)) return this.toast(p, '🎟️ ต้องยืนใกล้ตู้ Lucky Lotto ที่ลานกองไฟ');
    if (now >= this.lottoDrawAt(L.round) - S.LOTTO.closeMs) return this.toast(p, '🎟️ ปิดรับตั๋วงวดนี้แล้ว เปิดขายอีกครั้งหลังออกรางวัล');
    if (!this.lottoOk(p)) return this.toast(p, `🎟️ ซื้อหวยได้เมื่อผ่านคู่มือเริ่มต้นและระดับการเล่นถึง ${S.LOTTO.minLv}`);
    const want = Array.isArray(m.nums) ? m.nums.slice(0, S.LOTTO.maxTickets) : [], ipLeft = this.lottoIpLeft(p), n = Math.min(want.length, S.LOTTO.maxTickets - mine.length, ipLeft);
    if (n <= 0 && want.length && mine.length < S.LOTTO.maxTickets && ipLeft <= 0) return this.toast(p, '🎟️ โควตาตั๋วของเครือข่ายนี้เต็มแล้วสำหรับงวดนี้ งวดหน้ามาใหม่ได้เลยนะ');
    if (n <= 0) return this.toast(p, mine.length >= S.LOTTO.maxTickets ? `🎟️ ซื้อครบ ${S.LOTTO.maxTickets} ใบแล้วสำหรับงวดนี้` : '🎟️ ยังไม่ได้เลือกเลข');
    const cost = n * S.LOTTO.price; if ((p.rec.inv.coin || 0) < cost) return this.toast(p, 'เหรียญไม่พอ');
    const nums = want.slice(0, n).map(w => typeof w === 'string' && /^\d{3}$/.test(w) ? w : String(crypto.randomInt(1000)).padStart(3, '0')); // เลขที่ไม่ถูกรูปแบบ/ว่าง = สุ่มให้
    this.add(p, 'coin', -cost, 'lotto'); this.toPot(cost); L.tickets[p.key] = mine.concat(nums); if (p.ip) { L.ipTickets = L.ipTickets || {}; L.ipTickets[p.ip] = (L.ipTickets[p.ip] || 0) + n; } this.dirty = true;
    this.toast(p, `🎟️ ซื้อ Lucky Lotto ${nums.join(' ')} (🪙 ${cost}) ออกผล ${S.LOTTO.revealHour}:00 น.`); this.sfxTo(p, 'coin');
  },
  lottoJoin(p) { // ส่งสถานะหวยตอนเข้าเกม + แจ้งรางวัลที่ถูกตอนออฟไลน์
    this.lottoExpire(p.rec, Date.now());
    send(p, { t: 'lotto', l: this.lottoPub(p) });
    const ps = this.lottoPendSum(p.rec); if (ps) setTimeout(() => { if (p.ws.readyState === 1 && this.lottoPendSum(p.rec)) this.toast(p, `🎟️ มีรางวัล Lucky Lotto รอรับ 🪙 ${this.lottoPendSum(p.rec)} ที่ตู้ลานกองไฟ`); }, 3000);
    const w = p.rec.lottoWins; if (w && w.length) { delete p.rec.lottoWins; this.dirty = true; setTimeout(() => { if (p.ws.readyState === 1) for (const [k, amt] of w) this.toast(p, `🎟️ คุณถูก Lucky Lotto ${this.lottoPrizeName(k)} ขณะออฟไลน์! ได้ 🪙 ${amt}`); }, 3000); }
  },
};
