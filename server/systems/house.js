'use strict';
// บ้านหลังใหญ่ ตกแต่งเฟอร์นิเจอร์ ลีดเดอร์บอร์ดบ้าน: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { TS } = S;
const { send } = require('../util.js');
const { ADMIN_NAME } = require('../consts.js');

module.exports = {
  // ----- บ้านหลังใหญ่: ทุกคนมีบ้านของตัวเองหลังเดียว เป็นแมพแยก (ฉาก p.scene = key เจ้าของ, null = เมือง) เข้าจากเมนู เจ้าของเท่านั้นที่วาง/ย้าย/หมุน/เก็บเฟอร์นิเจอร์ได้ คนอื่นเข้าเยี่ยมจากลีดเดอร์บอร์ด (ของที่เก็บคืนเข้ากระเป๋าเจ้าของ)
  // ตกแต่งอิสระ: houses[key] = { items: { <id>: { f, x, y, r, z, on, wl, u } }, next } พิกัดเป็นหน่วยช่อง ดูกติกาที่ houseCheck ใน shared.js
  loadHouse(d) {
    this.houses = Object.create(null); this.hrects = new Map(); this.hmap = S.makeHouseMap();
    this.initCave();
    const refund = (key, f) => { const inv = this.saved[key].inv || (this.saved[key].inv = {}); inv['furn_' + f] = (inv['furn_' + f] || 0) + 1; this.dirty = true; }; // ของที่โหลดแล้ววางไม่ได้ (ข้อมูลเก่า/ผิดพลาด) คืนเข้ากระเป๋าเจ้าของ ไม่ให้หาย
    const build = (key, list) => { // list = [{f,x,y,r,z,on,wl,u}] → ใส่เข้าบ้านพร้อมตรวจกติกา
      const h = { items: {}, next: 1 };
      for (const it of list) {
        if (!S.FURN[it.f]) continue;
        const r = it.r ? 1 : 0, res = S.houseCheck(h.items, it.f, S.snapQ(+it.x), S.snapQ(+it.y), r, { wl: it.wl, u: it.u });
        if (!res.ok) { refund(key, it.f); continue; }
        h.items[h.next++] = { f: it.f, x: res.x !== undefined ? res.x : S.snapQ(+it.x), y: res.y !== undefined ? res.y : S.snapQ(+it.y), r, z: res.z, on: res.on, wl: res.wl, u: res.u };
      }
      if (Object.keys(h.items).length > S.HOUSE_MAX_ITEMS) { for (const id of Object.keys(h.items).slice(S.HOUSE_MAX_ITEMS)) { refund(key, h.items[id].f); delete h.items[id]; } }
      this.houses[key] = h;
    };
    // ของแต่ละชิ้นที่เก็บแบบเก่า "x,y" → f (ช่องละชิ้น) แปลงเป็นกึ่งกลางช่อง ภาพวาดเก่าแปลงเป็นของติดผนังหลังขวา
    const fromGrid = items => Object.entries(items).map(([k, f]) => { const [x, y] = k.split(',').map(Number); return S.FURN[f] && S.FURN[f].wall ? { f, wl: 'n', u: x + 0.5 } : { f, x: x + 0.5, y: y + 0.5 }; }).filter(it => it.wl || (Number.isFinite(it.x) && Number.isFinite(it.y)));
    if (d.houses && typeof d.houses === 'object') {
      for (const [key, h] of Object.entries(d.houses)) {
        if (!this.saved[key] || !h || typeof h.items !== 'object') continue;
        const vals = Object.values(h.items);
        if (vals.length && typeof vals[0] === 'string') build(key, fromGrid(h.items)); // บ้านรุ่นแรก (ช่องละชิ้น)
        else { // รุ่นปัจจุบัน: เก็บ id เดิมไว้ ตรวจกติกาทีละชิ้นตามลำดับ id
          const out = { items: {}, next: Math.max(1, +h.next || 1) };
          if (S.HOUSE_FLOORS[h.fl]) out.fl = h.fl; if (S.HOUSE_WALLS[h.wp]) out.wp = h.wp; // พื้น/วอลเปเปอร์ที่เลือกไว้
          // ตรวจของที่ไม่ได้วางบนอะไรก่อน แล้วค่อยตรวจของที่วางบนหลังชิ้นอื่น (ไม่งั้นของเล็กที่ id ต่ำกว่าโต๊ะที่ย้ายมาวางทีหลัง จะไปขวางโต๊ะตอนโหลด โต๊ะถูกคืนเข้ากระเป๋า)
          for (const [id, it] of Object.entries(h.items).sort((a, b) => ((a[1] && a[1].on != null) - (b[1] && b[1].on != null)) || a[0] - b[0])) {
            if (!it || !S.FURN[it.f]) continue;
            const res = S.houseCheck(out.items, it.f, S.snapQ(+it.x), S.snapQ(+it.y), it.r ? 1 : 0, { wl: it.wl, u: it.u });
            if (!res.ok || out.items[id]) { refund(key, it.f); continue; }
            out.items[id] = { f: it.f, x: res.x !== undefined ? res.x : S.snapQ(+it.x), y: res.y !== undefined ? res.y : S.snapQ(+it.y), r: it.r ? 1 : 0, z: res.z, on: res.on, wl: res.wl, u: res.u };
            out.next = Math.max(out.next, +id + 1);
          }
          this.houses[key] = out;
        }
      }
    } else if (d.owners) { // ย้ายข้อมูลจากระบบที่ดิน 6 แปลงเดิม: ของในแปลงมาวางในบ้านใหม่ที่ตำแหน่งสัมพันธ์เดิม (มุมซ้ายบนของพื้นบ้าน)
      for (const [i, key] of Object.entries(d.owners)) {
        const x0 = S.HOUSING.plots[i];
        if (x0 === undefined || typeof key !== 'string' || !this.saved[key]) continue;
        const grid = {};
        for (const [k, f] of Object.entries(d.items || {})) { const [x, y] = k.split(',').map(Number); if (S.plotAt(x, y) === +i) grid[(23 + (x - x0)) + ',' + (18 + (y - S.HOUSING.y0))] = f; }
        build(key, fromGrid(grid));
      }
    }
    if (d.houses || d.owners) this.dirty = true;
  },
  houseMap() { return this.hmap; }, // แมพบ้านเป็นผนัง/พื้นเหมือนกันทุกหลัง (ของตกแต่งอยู่นอกตาราง ดู houseRects)
  houseRects(key) { let r = this.hrects.get(key); if (!r) { r = S.houseSolidRects(this.houses[key] ? this.houses[key].items : {}); this.hrects.set(key, r); } return r; },
  houseStyle(key) { const h = this.houses[key] || {}; return { fl: h.fl || S.HOUSE_STYLE_DEFAULT.fl, wp: h.wp || S.HOUSE_STYLE_DEFAULT.wp }; },
  houseItemsPub(key) { const h = this.houses[key]; return h ? Object.entries(h.items).map(([i, it]) => Object.assign({ i: +i }, it)) : []; },
  houseBoard(p) { // ลีดเดอร์บอร์ดบ้านที่ตกแต่งแล้ว: เรียงตามมูลค่าเฟอร์นิเจอร์ แล้วตามจำนวนชิ้น
    const rows = [];
    for (const [key, h] of Object.entries(this.houses)) {
      if (key === ADMIN_NAME.toLowerCase()) continue; // บ้านผู้ดูแลไม่ลงอันดับ ไม่ปนกับผู้เล่น
      const sc = S.houseScore(h.items);
      if (sc.count > 0) rows.push({ n: this.nameOfKey(key), v: sc.value, c: sc.count, on: [...this.players.values()].some(q => q.key === key) ? 1 : 0, me: key === p.key ? 1 : 0 });
    }
    rows.sort((a, b) => b.v - a.v || b.c - a.c || (a.n < b.n ? -1 : 1));
    return rows.slice(0, 100);
  },
  enterHouse(p, key) {
    if (p.veh) this.setVeh(p, ''); // เข้าบ้าน = ลงจากยานพาหนะ
    if (!key || !this.saved[key]) return this.toast(p, 'ไม่พบบ้านหลังนี้');
    if (p.scene === key) return;
    const mine = key === p.key;
    if (!mine && !(this.houses[key] && S.houseScore(this.houses[key].items).count > 0)) return this.toast(p, 'บ้านหลังนี้ยังไม่ได้ตกแต่ง');
    if (!p.scene) { this.arcLeave(p); this.tradeCancel(p, 'ผู้เล่นเข้าบ้าน'); if (this.cinema.viewers.delete(p.id)) this.cinemaBroadcast(); p.ret = { x: p.x, y: p.y }; }
    const first = mine && !this.houses[key];
    if (first) this.houses[key] = { items: {}, next: 1 };
    this.changeScene(p, key, S.HOUSE_SPAWN.x, S.HOUSE_SPAWN.y);
    this.toast(p, first ? '🏠 ยินดีต้อนรับสู่บ้านของคุณ! ซื้อเฟอร์นิเจอร์ที่ร้านเฟอร์นิเจอร์มาตกแต่ง แล้วกดปุ่ม 🏠 เพื่อเข้าโหมดตกแต่ง' : mine ? '🏠 กลับบ้านแล้ว' : `🏘️ มาเยี่ยมบ้านของ ${this.nameOfKey(key)}`);
  },
  leaveHouse(p) {
    if (!p.scene) return;
    const r = this.townPos(p); p.ret = null;
    this.changeScene(p, null, r.x, r.y);
  },
  setItem(key, id, it) { // วาง/แก้ชิ้นที่ id แล้วบอกคนในบ้านหลังนี้
    this.houses[key].items[id] = it; this.hrects.delete(key);
    this.sceneBroadcast(key, { t: 'furn', op: 'set', o: Object.assign({ i: +id }, it) }); this.dirty = true;
  },
  delItem(key, id) {
    const h = this.houses[key]; delete h.items[id]; this.hrects.delete(key);
    for (const q of this.sceneMates(key)) if (q.sit && q.sit.i === +id) q.sit = null; // ที่นั่งหาย = ลุกขึ้น
    this.sceneBroadcast(key, { t: 'furn', op: 'del', i: +id }); this.dirty = true;
  },
  houseHandle(p, m) {
    switch (m.a) {
      case 'board': send(p, { t: 'hboard', list: this.houseBoard(p) }); break;
      case 'enter': { // who ว่าง = บ้านตัวเอง • ไม่งั้นเป็นชื่อเจ้าของบ้านที่จะไปเยี่ยม
        const now = Date.now(); if (now - (p.lastEnter || 0) < 600) return; p.lastEnter = now;
        const who = String(m.who || '').trim().toLowerCase();
        this.enterHouse(p, who && who !== p.key ? who : p.key);
        break;
      }
      case 'exit': this.leaveHouse(p); break;
      case 'style': { // เปลี่ยนพื้น/วอลเปเปอร์ (เฉพาะบ้านตัวเอง ฟรี)
        const key = p.scene;
        if (!key || key !== p.key) return this.toast(p, 'ตกแต่งได้เฉพาะในบ้านของตัวเอง');
        const h = this.houses[key]; if (!h) return;
        if (m.k === 'floor' && S.HOUSE_FLOORS[m.v]) h.fl = m.v; else if (m.k === 'wall' && S.HOUSE_WALLS[m.v]) h.wp = m.v; else return;
        this.sceneBroadcast(key, Object.assign({ t: 'hstyle' }, this.houseStyle(key))); this.sfx(p, 'plant'); this.dirty = true;
        break;
      }
      case 'place': case 'move': case 'rot': case 'remove': {
        const key = p.scene;
        if (!key || key !== p.key) return this.toast(p, 'ตกแต่งได้เฉพาะในบ้านของตัวเอง');
        const h = this.houses[key], mates = this.sceneMates(key).concat(p).map(q => ({ x: q.x, y: q.y }));
        if (m.a === 'place') {
          const f = m.f;
          if (typeof f !== 'string' || !S.FURN[f] || !(p.rec.inv['furn_' + f] > 0)) return;
          if (Object.keys(h.items).length >= S.HOUSE_MAX_ITEMS) return this.toast(p, `บ้านเต็มแล้ว (วางได้สูงสุด ${S.HOUSE_MAX_ITEMS} ชิ้น)`);
          const r = m.r ? 1 : 0, x = S.snapQ(+m.x), y = S.snapQ(+m.y);
          if (!S.FURN[f].wall && (!Number.isFinite(x) || !Number.isFinite(y))) return;
          const res = S.houseCheck(h.items, f, x, y, r, { wl: m.wl, u: S.snapQ(+m.u), mates });
          if (!res.ok) return this.toast(p, res.why);
          this.add(p, 'furn_' + f, -1); this.event(p, 'hplace');
          this.setItem(key, h.next++, { f, x: res.x !== undefined ? res.x : x, y: res.y !== undefined ? res.y : y, r, z: res.z, on: res.on, wl: res.wl, u: res.u });
          this.sfx(p, 'plant');
          return;
        }
        const id = m.i | 0, it = h.items[id];
        if (!it) return;
        if (m.a === 'remove') {
          this.delItem(key, id); this.add(p, 'furn_' + it.f, 1); this.sfx(p, 'collect');
          for (const [cid, c] of Object.entries(h.items)) if (c.on === id) this.setItem(key, cid, Object.assign({}, c, { z: 0, on: null })); // ของที่วางอยู่บนหลังตกลงพื้น
          return;
        }
        const d = S.FURN[it.f];
        let nx = it.x, ny = it.y, nr = it.r, wl = it.wl, u = it.u;
        if (m.a === 'rot') { if (d.wall) return; nr = it.r ? 0 : 1; }
        else if (d.wall) { wl = m.wl === 'w' ? 'w' : 'n'; u = S.snapQ(+m.u); }
        else { nx = S.snapQ(+m.x); ny = S.snapQ(+m.y); if (!Number.isFinite(nx) || !Number.isFinite(ny)) return; }
        const others = Object.assign({}, h.items); delete others[id];
        const res = S.houseCheck(others, it.f, nx, ny, nr, { wl, u, mates });
        if (!res.ok) return this.toast(p, res.why);
        const fx = res.x !== undefined ? res.x : nx, fy = res.y !== undefined ? res.y : ny, dx = fx - it.x, dy = fy - it.y;
        const kids = Object.entries(h.items).filter(([, c]) => c.on === id); // ของบนหลังย้ายตาม ต้องยังอยู่ในพื้นบ้าน
        for (const [, c] of kids) { const r2 = S.furnRect(Object.assign({}, c, { x: c.x + dx, y: c.y + dy })); if (r2.x0 < S.HFLOOR.x0 || r2.y0 < S.HFLOOR.y0 || r2.x1 > S.HFLOOR.x1 || r2.y1 > S.HFLOOR.y1) return this.toast(p, 'ย้ายไปตรงนั้นไม่ได้ ของที่วางบนหลังจะตกขอบ'); }
        this.setItem(key, id, { f: it.f, x: fx, y: fy, r: nr, z: res.z, on: res.on, wl: res.wl, u: res.u });
        for (const [cid, c] of kids) this.setItem(key, cid, Object.assign({}, c, { x: c.x + dx, y: c.y + dy }));
        this.sfx(p, 'plant');
        break;
      }
    }
  },
  houseAct(p, m) { // ในบ้าน แตะเก้าอี้/โซฟาเพื่อนั่ง หรือเตียงเพื่อนอนพัก (เครื่องมือฟาร์มใช้ไม่ได้)
    const now = Date.now(); if (now - p.lastAct < 150) return; p.lastAct = p.activeAt = now;
    const h = this.houses[p.scene], id = m.i | 0, it = h && h.items[id];
    if (!it || !(S.FURN[it.f].seat || S.FURN[it.f].bed)) return;
    if (Math.hypot(it.x * TS - p.x, it.y * TS - p.y) > 4 * TS) return this.toast(p, 'ไกลเกินไป เดินเข้าไปใกล้ๆ ก่อน');
    const spots = S.seatSpots(it), taken = new Set(this.sceneMates(p.scene, p).filter(q => q.sit && q.sit.i === id).map(q => q.sit.k));
    const k = spots.findIndex((_, j) => !taken.has(j)); // ช่องว่างแรกของชิ้นนี้ (เตียงคู่/โซฟา 2 คน)
    if (k < 0) return this.toast(p, S.FURN[it.f].bed ? 'เตียงเต็มแล้ว' : 'ที่นั่งเต็มแล้ว');
    const lie = !!S.FURN[it.f].bed; // lie = นอนท่าราบ (พักเหมือนนั่ง: ความหิว/พลังงานเหมือนกัน)
    p.sit = { i: id, k, lie }; p.x = spots[k].x * TS; p.y = spots[k].y * TS; p.dir = it.r ? 3 : 0; // หันตามแนวชิ้น
    send(p, { t: 'tp', x: p.x, y: p.y }); this.toast(p, lie ? '😴 นอนพักผ่อน... (เดินเพื่อลุก)' : '🪑 นั่งพักผ่อน... (เดินเพื่อลุก)');
  },
  hasFridge(key) { const h = this.houses[key]; return !!(h && Object.values(h.items).some(it => it && it.f === 'fridge')); }, // ตู้เย็นวางในบ้าน = ของในกระเป๋าเสื่อมช้าลง
};
