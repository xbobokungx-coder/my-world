'use strict';
// ที่เก็บของในบ้าน (ตู้เย็น/ลัง): คลังรวมต่อชนิดตู้ เก็บที่ rec.store = { cold: { inv, lots, r, at }, box: { inv } } ต่อกลับด้วย mix() (ดู server/mixin.js)
// กติกา: ของในคลังไม่อยู่ใน inv (เก็บ = ออกจากกระเป๋า, หยิบ = กลับกระเป๋า) • คลังเย็นอายุเดินช้าลง ไม่คิดย้อนหลัง: อายุ = (at−tv) + (now−at)×r (S.storeAge) • ตัวเลขทั้งหมดอยู่ที่ S.HOME
const S = require('../../public/shared.js');
const { TS, HOME } = S;
const { send } = require('../util.js');

const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const sum = inv => { let n = 0; for (const k of Object.keys(inv)) n += inv[k]; return n; };

module.exports = {
  storeOf(rec) { // rec.store แบบสร้างเมื่อใช้ครั้งแรก + ซ่อมโครงที่ขาด (ไม่แตะของที่มี)
    if (!rec.store || typeof rec.store !== 'object') rec.store = {};
    const st = rec.store;
    for (const n of Object.keys(HOME.store)) {
      const o = st[n] && typeof st[n] === 'object' ? st[n] : (st[n] = {});
      if (!o.inv || typeof o.inv !== 'object') o.inv = {};
      if (n === 'cold') { if (!o.lots || typeof o.lots !== 'object') o.lots = {}; for (const k of Object.keys(o.lots)) if (!Array.isArray(o.lots[k])) delete o.lots[k]; /* เซฟเพี้ยน: กองที่ไม่ใช่ array ทิ้ง ไม่ให้ลูปอายุ/โหลดล้ม */ if (!Number.isFinite(o.r) || o.r <= 0) o.r = 1; if (!Number.isFinite(o.at)) o.at = Date.now(); }
    }
    return st;
  },
  storeRate(key) { return S.storeCap((this.houses[key] || {}).items, 'cold') > 0 ? HOME.store.cold.mul : 1; }, // อัตราอายุจริงตอนนี้: มีตู้เย็นวาง = mul ไม่งั้น 1
  storeSync(key, rec) { // อัตราเปลี่ยน (วาง/ถอด/คืนตู้ตอนโหลด) → rebase ทุกกอง ณ เวลานี้ ไม่คิดย้อนหลัง
    const c = rec && rec.store && rec.store.cold; if (!c || typeof c !== 'object') return;
    this.storeOf(rec); const rate = this.storeRate(key);
    if (c.r === rate) return;
    const now = Date.now();
    for (const k of Object.keys(c.lots)) for (const l of c.lots[k]) l[0] = now - S.storeAge(l[0], c, now);
    c.at = now; c.r = rate; this.dirty = true;
  },
  storeOnEvent(p, ev) { if ((ev === 'hplace' || ev === 'hremove') && p.rec && p.rec.store) this.storeSync(p.key, p.rec); }, // วาง/ถอดเฟอร์นิเจอร์ → ซิงก์อัตรา
  storeBlocksRemove(key, f) { // ถอดตู้ f ออกหนึ่งใบแล้วความจุต่ำกว่าของในคลัง → คืนข้อความห้าม ไม่งั้น null (อ่านอย่างเดียว)
    const rec = this.saved[key], st = rec && rec.store, h = this.houses[key]; if (!st || !h) return null;
    const items = Object.assign({}, h.items), id = Object.keys(items).find(i => items[i] && items[i].f === f); if (id === undefined) return null;
    delete items[id];
    for (const n of Object.keys(HOME.store)) {
      if (!HOME.store[n].furn[f] || !st[n] || !st[n].inv || typeof st[n].inv !== 'object') continue;
      const used = sum(st[n].inv); if (used > 0 && S.storeCap(items, n) < used) return HOME.msg.blocked(used);
    }
    return null;
  },
  storePub(p, pool, i) { // สถานะคลังที่ส่งให้เว็บ: cap/used/inv/(l อายุเป็น tv + r at)
    const st = this.storeOf(p.rec), o = st[pool], h = this.houses[p.key];
    const m = { t: 'store', pool, i, cap: S.storeCap(h && h.items, pool), used: sum(o.inv), inv: Object.assign({}, o.inv) };
    if (pool === 'cold') { m.l = {}; for (const k of Object.keys(o.lots)) m.l[k] = o.lots[k].map(x => [x[0], x[1]]); m.r = o.r; m.at = o.at; }
    return m;
  },
  storeHandle(p, m) { // msg {t:'store', a:'open'|'put'|'take'|'putall'|'takeall', i, pool, k, n}
    if (!m || typeof m !== 'object' || typeof m.a !== 'string') return;
    const key = p.scene;
    if (!key || key !== p.key || !p.rec) { p.storeAt = null; return this.toast(p, HOME.msg.mine); } // เฉพาะในบ้านตัวเอง
    const h = this.houses[key]; if (!h) return;
    const now = Date.now();
    const near = (it) => Math.hypot(it.x * TS - p.x, it.y * TS - p.y) <= HOME.near * TS;
    if (m.a === 'open') {
      if (now - (p.lastStore || 0) < HOME.openMs) return; p.lastStore = now;
      const id = Number.isInteger(m.i) ? m.i : NaN, it = h.items[id]; if (!it) return;
      const pool = Object.keys(HOME.store).find(n => has(HOME.store[n].furn, it.f)); if (!pool) return;
      if (!near(it)) return this.toast(p, HOME.msg.far);
      p.storeAt = { pool, i: id }; this.storeSync(key, p.rec); send(p, this.storePub(p, pool, id));
      return;
    }
    if (!['put', 'take', 'putall', 'takeall'].includes(m.a)) return;
    const at = p.storeAt, pool = at && m.pool === at.pool ? at.pool : null; if (!pool) return;
    const it = h.items[at.i]; // ตู้ที่เปิดไว้ต้องยังอยู่ ชนิดตรง และยังอยู่ในระยะ
    if (!it || !has(HOME.store[pool].furn, it.f)) { p.storeAt = null; return; }
    if (!near(it)) { p.storeAt = null; return this.toast(p, HOME.msg.far); }
    const rec = p.rec, st = this.storeOf(rec), o = st[pool], cold = pool === 'cold';
    this.storeSync(key, rec);
    const free = () => Math.max(0, S.storeCap(h.items, pool) - sum(o.inv));
    const put = (k, n) => { // เก็บ n ชิ้นของ k (ตรวจแล้วว่ารับ/มีของ/จุพอ) • ออกจากกระเป๋าผ่าน add() เพื่อให้ lots/อัปเดตกระเป๋าตรงกัน
      const taken = this.add(p, k, -n, 'store');
      if (cold) {
        const L = o.lots[k] || (o.lots[k] = []);
        for (const [t, c] of (taken && taken.length ? taken : [[now, n]])) { const age = Math.max(0, now - Math.max(t, S.FRESH.startAt)); L.push([o.at - (age - (now - o.at) * o.r), c]); }
        L.sort((a, b) => a[0] - b[0]);
        for (let j = L.length - 1; j > 0; j--) if (L[j][0] - L[j - 1][0] < 60000) { L[j - 1][1] += L[j][1]; L.splice(j, 1); } // รวมกองที่อายุใกล้กัน (เหมือน lotPut)
      }
      o.inv[k] = (o.inv[k] || 0) + n;
    };
    const take = (k, n) => { // หยิบ n ชิ้นกลับกระเป๋า: เก่าก่อน อายุแปลงกลับเป็นเวลาได้ในกระเป๋า (ไม่มีโบนัสย้อนหลัง)
      let lots;
      if (cold) { const L = o.lots[k] || [], out = []; let need = n; while (need > 0 && L.length) { const d = Math.min(L[0][1], need); out.push([now - S.storeAge(L[0][0], o, now), d]); L[0][1] -= d; need -= d; if (!L[0][1]) L.shift(); } if (!L.length) delete o.lots[k]; lots = out; n -= need; }
      if (!(n > 0)) return;
      o.inv[k] -= n; if (o.inv[k] <= 0) delete o.inv[k];
      this.add(p, k, n, 'store', lots);
    };
    const okN = v => Number.isInteger(v) && v >= 1;
    if (m.a === 'put' || m.a === 'take') {
      const k = m.k; if (typeof k !== 'string' || !okN(m.n)) return;
      if (m.a === 'put') {
        if (!S.storeAccepts(pool, k)) return this.toast(p, HOME.msg.no);
        if (!has(rec.inv, k)) return;
        const n = Math.min(m.n, rec.inv[k] | 0, free()); if (!(n > 0)) { if (!free()) this.toast(p, HOME.msg.full); } else put(k, n);
      } else {
        if (!has(o.inv, k)) return;
        const n = Math.min(m.n, o.inv[k]); if (n > 0) take(k, n);
      }
    } else if (m.a === 'putall') {
      for (const k of Object.keys(rec.inv)) { if (!free()) { this.toast(p, HOME.msg.full); break; } if (!S.storeAccepts(pool, k) || !(rec.inv[k] > 0)) continue; put(k, Math.min(rec.inv[k], free())); }
    } else { for (const k of Object.keys(o.inv)) take(k, o.inv[k]); }
    this.dirty = true; send(p, this.storePub(p, pool, at.i));
  },
  storeMigrate() { // ย้ายครั้งเดียวต่อบัญชี (ธง rec.frz): ตู้เย็นเดิมเคยชะลออายุของในกระเป๋า ×0.5 → ใส่ครึ่งนั้นลงอายุจริงของกองแล้วเลิกผล ความสดที่เห็นไม่กระโดด • เรียกหลัง loadHouse
    let n = 0; const now = Date.now();
    for (const [key, rec] of Object.entries(this.saved)) {
      if (!rec || typeof rec !== 'object' || rec.frz) continue;
      rec.frz = 1; this.dirty = true;
      if (!this.hasFridge(key) || !rec.inv || typeof rec.inv !== 'object') continue;
      for (const k of Object.keys(rec.inv)) if (S.perishable(k) && rec.inv[k] > 0) for (const l of this.lotsOf(rec, k)) l[0] = now - Math.max(0, now - Math.max(l[0], S.FRESH.startAt)) * HOME.migrate.ageMul;
      rec.frzNote = 1; n++;
    }
    for (const [key, rec] of Object.entries(this.saved)) if (rec && rec.store) { try { this.storeSync(key, rec); } catch (e) { console.error('[store] ซิงก์คลังบัญชีนี้ไม่ได้ ข้าม:', key, e.message); } } // ตู้เย็นถูกคืนตอนโหลด = อัตรากลับเป็น 1 จากจุดนี้
    if (n) console.log(`[migrate] ตู้เย็นเดิม: ย้ายอายุ ${n} บัญชี`);
  },
  storeJoinNote(p) { if (p.rec.frzNote) { delete p.rec.frzNote; this.dirty = true; this.toast(p, HOME.msg.migrated); } }, // แจ้งครั้งเดียวตอนเข้าเกม
};
