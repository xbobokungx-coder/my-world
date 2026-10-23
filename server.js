'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const S = require('./public/shared.js');
const { TS, T, CROPS, FISH, ANIMALS, SPAWN } = S;

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUB = path.join(__dirname, 'public');
// ล็อกให้มีห้องเดียว (ไม่สนค่า ?room= จากผู้เล่น) เปลี่ยนห้องได้ด้วยตัวแปร ROOM
const ROOM = /^[a-z0-9_-]{1,20}$/.test(process.env.ROOM || '') ? process.env.ROOM : 'main';
fs.mkdirSync(DATA_DIR, { recursive: true });

const HFAST = Math.max(1, +process.env.HUNGER_FAST || 1);
const SICK_CHECK = +process.env.SICK_CHECK_MS || S.SICK.checkMs, SICK_GRACE = +process.env.SICK_GRACE_MS || S.SICK.graceMs, RESULT_MS = +process.env.CASINO_RESULT_MS || 8000, EMPTY_MS = +process.env.CIN_EMPTY_MS || 20000; // ไว้ทดสอบเท่านั้น // ไว้ทดสอบเท่านั้น: เร่งความหิวของคนและสัตว์
const SNAP_MS = +process.env.SNAP_MS || 60 * 60 * 1000; // ระยะห่างของ event snap (ไว้ทดสอบ)
const rand = (a, b) => a + Math.random() * (b - a);
// บันทึกเหตุการณ์ไว้วิเคราะห์ (หนึ่งไฟล์ต่อวัน data/events/YYYY-MM-DD.jsonl) สรุปด้วย node tools/stats.js
const EVENT_DIR = path.join(DATA_DIR, 'events');
try { fs.mkdirSync(EVENT_DIR, { recursive: true }); } catch (e) { /* บันทึกไม่ได้ก็ไม่ทำให้เกมล้ม */ }
const logEv = (room, e, o, sync) => { // sync = เขียนทันที (ใช้ตอนปิดเซิร์ฟเวอร์)
  try {
    const d = new Date(), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const ln = JSON.stringify(Object.assign({ t: Date.now(), room, e }, o)) + '\n';
    if (sync) fs.appendFileSync(path.join(EVENT_DIR, day + '.jsonl'), ln); else fs.appendFile(path.join(EVENT_DIR, day + '.jsonl'), ln, () => {});
  } catch (err) { /* ข้าม */ }
};
const PET_DEFS = [{ kind: 'cat', v: 0, max: 15, speed: 36 }, { kind: 'dog', v: 0, max: 20, speed: 54 }, { kind: 'dog', v: 1, max: 20, speed: 50 }]; // max = รัศมีสูงสุดจากกองไฟ (ช่อง)
const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_HAT = '#e8c66a';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const PARTY = new Set(['pok', 'react', 'rps']); // เกมห้องหลายคน (ผู้เล่นหลายคน/บอท) — ดู partyHandle
const TOOLS = new Set(['hand', 'hoe', 'water', 'rod', 'axe', 'medicine', ...Object.values(ANIMALS).map(a => a.feedItem), ...Object.keys(CROPS).map(c => 'seed_' + c)]);
// ของที่ตลาดรับซื้อทั้งหมด (ราคาขึ้นลงตามอุปสงค์-อุปทาน)
const SELLABLE = [...Object.keys(CROPS).map(c => 'crop_' + c), ...FISH.filter(f => f.id !== 'boot').map(f => 'fish_' + f.id), 'egg', 'duck_egg', 'milk', 'wool', 'truffle', 'log', 'hardwood', 'plank', ...S.COOK.map(c => c.id)];
const replacer = (k, v) => (k[0] === '_' ? undefined : v);
const send = (p, o) => { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(o)); };
const rodOf = inv => (inv.rod_3 ? 3 : inv.rod_2 ? 2 : 1);

// ชาวเมือง NPC: เดินท่องไปทั่วแมพ (หาทางด้วย BFS) และพิมพ์ข้อความสั้นๆ แนะนำเกม ขึ้นเป็นฟองเหนือหัวเท่านั้น (ไม่เข้าแชท)
const NPC_DEFS = [
  { name: 'ป้าแก้ว', title: '🏘️ ชาวเมือง', color: '#d6559a', hat: '#e8c66a', pc: '#6b4a8a', wear: { shirt: 'dots', pants: 'skirt', hat: 'flower' }, home: [27, 28],
    lines: ['ปลูกผักแล้วรดน้ำด้วยนะ 💧', 'นั่งพักแล้วหิวไม่ลดนะ 🪑', 'ลงขันกองกลางช่วยสัตว์ได้ 🏦', 'ทำเควสประจำวันที่เมนู 🎒 สิ', 'กลางคืนมืด ซื้อตะเกียง 🏮', 'ซื้อที่ดินสร้างบ้านได้ 🏠', 'สัตว์หิว รีบให้อาหารนะ 🐔']},
  { name: 'ลุงสมชาย', title: '🏘️ ชาวเมือง', color: '#7a9a3a', hat: '#e8c66a', pc: '#4a5b3a', wear: { shirt: 'farmer', pants: 'overall', hat: 'straw' }, home: [38, 31],
    lines: ['ตกปลาต้องมีเหยื่อ 🪱', 'ยืนใกล้สระ แล้วโยนเบ็ดไกลๆ 🎣', 'ตัดไม้ต้องมีขวาน 🪓', 'ขายเยอะๆ ราคาตกนะ 📉', 'อัปเลเวลปลดล็อกของใหม่ ⭐', 'ฝากเงิน ATM ได้ดอกเบี้ย 💳', 'ขวานเบ็ดพังต้องซ่อมนะ 🔧']},
  { name: 'น้องมิ้นท์', title: '🏘️ ชาวเมือง', color: '#3aa0d6', hat: '#ffffff', pc: '#2c3e50', wear: { shirt: 'hoodie', pants: 'shorts', hat: 'cap' }, home: [33, 21],
    lines: ['ตู้เกมเล่นกับบอทได้ 🤖', 'ท้าเพื่อนเล่น XO ไหม ❌⭕', 'ชวนเพื่อนกด 🔗 มาเล่น', 'ช่วยกันทำงาน ติดบัฟ 🎉', 'กด 📰 ดูข่าวเมืองนะ', 'รับของแจกกองกลางวันละครั้ง 🎁', 'กด H ตกแต่งบ้านได้ 🛋️']},
];

const CAT_NAME = { fish: 'ปลา', crop: 'ผัก/ผลไม้', animal: 'ผลผลิตสัตว์', wood: 'ไม้', dish: 'อาหาร' }; // ชื่อหมวดในข้อความแจ้งผู้เล่น
const HOUSE_MSG = new Set(['m', 'act', 'held', 'status', 'deaf', 'voice', 'rtc', 'look', 'eat', 'pet', 'petname', 'petcare', 'lamp', 'chat', 'house']); // ข้อความที่ใช้ได้ตอนอยู่ในบ้าน (ที่เหลือเป็นเรื่องของเมือง)
class World {
  constructor(room) {
    this.room = room;
    this.chatLog = []; // แชท 10 ข้อความล่าสุดของห้อง ส่งให้คนที่เพิ่งเข้ามาอ่านบริบท
    this.map = S.makeMap(); // แมพของห้องนี้เอง ห้องอื่นไม่เกี่ยว
    this.file = path.join(DATA_DIR, room + '.json');
    this.players = new Map();
    this.nextId = 1;
    this.farm = {};
    this.saved = Object.create(null);
    this.dirty = false;
    let counts = {}, mk = {}, houseSaved = {}, townSaved = {};
    this.mktDay = -1;
    try {
      const d = JSON.parse(fs.readFileSync(this.file, 'utf8').replace(/^﻿/, '')); // ตัด BOM ที่โปรแกรมแก้ไขบางตัวเติมให้
      this.farm = d.farm || {};
      this.saved = Object.assign(Object.create(null), d.players); // ไม่มี prototype: ชื่อผู้เล่นอย่าง "__proto__" จะได้ไม่ไปชนของในระบบ
      counts = d.animals || {};
      if (Array.isArray(d.trees)) { // คืนสภาพต้นไม้ที่ตัด/งอกใหม่ไว้ (ต้นไม้ขอบแมพไม่เปลี่ยน)
        for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (S.isChoppable(this.map, x, y)) this.map[y][x] = T.GRASS;
        for (const [x, y] of d.trees) if (Number.isInteger(x) && Number.isInteger(y) && this.map[y] && this.map[y][x] === T.GRASS && x >= 1 && y >= 1 && x <= S.W - 2 && y <= S.H - 2) this.map[y][x] = T.TREE;
      }
      mk = d.market || {}; this.mktDay = Number.isInteger(d.mktDay) ? d.mktDay : -1;
      houseSaved = d.house || {}; townSaved = { log: d.log, chest: d.chest, projects: d.projects, stats: d.stats, village: d.village, week: d.week, orders: d.orders, banned: d.banned };
    } catch (e) {
      // ไม่มีไฟล์ = โลกใหม่ แต่ถ้ามีไฟล์แต่อ่านไม่ได้ ให้สำรองไว้ก่อน ไม่งั้นการบันทึกครั้งต่อไปจะเขียนทับข้อมูลเดิมทิ้ง
      if (e.code !== 'ENOENT') { try { fs.copyFileSync(this.file, this.file + '.broken-' + Date.now()); console.error('อ่านไฟล์บันทึกไม่ได้ สำรองไว้แล้ว:', e.message); } catch (e2) { /* ไม่มีอะไรให้สำรอง */ } }
    }
    this.loadHouse(houseSaved); this.loadTown(townSaved); for (const P of S.PROJECTS) if (S.projectDone(P.id, this.projects[P.id].coin)) S.applyProject(this.map, P.id); this.initNpcs(); this.initPets();
    if (this.mktDay === -1) this.mktDay = Math.floor(Date.now() / S.DAY_MS);
    this.market = {};
    for (const k of SELLABLE) { const o = mk[k] || {}; this.market[k] = { m: S.MARKET.min <= o.m && o.m <= S.MARKET.max ? o.m : 1, t: S.MARKET.min <= o.t && o.t <= S.MARKET.max ? o.t : 1 }; }
    for (const k of Object.keys(this.farm)) { // เก็บกวาดช่องฟาร์มเก่าที่ไม่อยู่ในแปลงของแมพปัจจุบัน
      const [x, y] = k.split(',').map(Number);
      if (!S.inFarm(x, y) || this.map[y][x] !== T.GRASS) delete this.farm[k];
    }
    this.animals = [];
    this.nextAid = 1;
    for (const type of Object.keys(ANIMALS)) {
      const n = Number.isInteger(counts[type]) ? Math.min(counts[type], ANIMALS[type].cap) : ANIMALS[type].init;
      for (let i = 0; i < n; i++) this.spawnAnimal(type);
    }
    this.lastCrop = Date.now();
    this.tables = {};
    S.CABINETS.forEach((c, i) => {
      if (!c.game) return;
      this.tables['cab' + i] = c.game === 'uno' ? this.newUnoTable('cab' + i, c, i) : PARTY.has(c.game) ? this.newPartyTable('cab' + i, c, i) : (c.game === 'bacc' || c.game === 'bj') ? this.newCasinoTable('cab' + i, c, i) : this.newTable('cab' + i, c, i);
    });
    this.treeHp = new Map(); this.treeTimer = 0; this.sickTimer = 0;
    this.trades = new Map(); this.nextTrade = 1;
    this.cinema = { movie: null, yt: '', name: '', startedAt: 0, pos: 0, ref: 0, playing: false, emptyAt: 0, viewers: new Set(), paid: new Set() };
    this.treeCap = S.TREE.cap; // เพดานคงที่ (เดิมบวกเพิ่มทุกครั้งที่ restart ทำให้ต้นไม้แน่นขึ้นเรื่อยๆ)
    { const t = this.treeList(); if (t.length > this.treeCap) { for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } for (const [x, y] of t.slice(this.treeCap)) this.map[y][x] = T.GRASS; this.dirty = true; } } // ถ้าเกินเพดาน สุ่มตัดแต่งให้เหลือพอดี
  }

  // ----- บ้านหลังใหญ่: ทุกคนมีบ้านของตัวเองหลังเดียว เป็นแมพแยก (ฉาก p.scene = key เจ้าของ, null = เมือง) เข้าจากเมนู เจ้าของเท่านั้นที่วาง/ย้าย/หมุน/เก็บเฟอร์นิเจอร์ได้ คนอื่นเข้าเยี่ยมจากลีดเดอร์บอร์ด (ของที่เก็บคืนเข้ากระเป๋าเจ้าของ)
  // ตกแต่งอิสระ: houses[key] = { items: { <id>: { f, x, y, r, z, on, wl, u } }, next } พิกัดเป็นหน่วยช่อง ดูกติกาที่ houseCheck ใน shared.js
  loadHouse(d) {
    this.houses = Object.create(null); this.hrects = new Map(); this.hmap = S.makeHouseMap();
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
          for (const [id, it] of Object.entries(h.items).sort((a, b) => a[0] - b[0])) {
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
  }
  houseMap() { return this.hmap; } // แมพบ้านเป็นผนัง/พื้นเหมือนกันทุกหลัง (ของตกแต่งอยู่นอกตาราง ดู houseRects)
  houseRects(key) { let r = this.hrects.get(key); if (!r) { r = S.houseSolidRects(this.houses[key] ? this.houses[key].items : {}); this.hrects.set(key, r); } return r; }
  mapOf(p) { return p.scene ? this.houseMap() : this.map; }
  blockedFor(p, x, y) { return p.scene ? S.houseBlockedAt(this.houseMap(), this.houseRects(p.scene), x, y, p.x, p.y) : S.blockedAt(this.map, x, y); } // ในบ้านรวมกล่องเฟอร์นิเจอร์ (ถ้าอยู่ในกล่องอยู่แล้ว เช่นเพิ่งลุกจากเก้าอี้ เดินออกได้)
  nameOfKey(key) { return (this.saved[key] && this.saved[key].name) || key; }
  houseItemsPub(key) { const h = this.houses[key]; return h ? Object.entries(h.items).map(([i, it]) => Object.assign({ i: +i }, it)) : []; }
  houseBoard(p) { // ลีดเดอร์บอร์ดบ้านที่ตกแต่งแล้ว: เรียงตามมูลค่าเฟอร์นิเจอร์ แล้วตามจำนวนชิ้น
    const rows = [];
    for (const [key, h] of Object.entries(this.houses)) {
      const sc = S.houseScore(h.items);
      if (sc.count > 0) rows.push({ n: this.nameOfKey(key), v: sc.value, c: sc.count, on: [...this.players.values()].some(q => q.key === key) ? 1 : 0, me: key === p.key ? 1 : 0 });
    }
    rows.sort((a, b) => b.v - a.v || b.c - a.c || (a.n < b.n ? -1 : 1));
    return rows.slice(0, 100);
  }
  sceneMates(scene, except) { const sc = scene || null; return [...this.players.values()].filter(q => q !== except && (q.scene || null) === sc); }
  sceneBroadcast(scene, o, except) { const s = JSON.stringify(o); for (const q of this.sceneMates(scene, except)) if (q.ws.readyState === 1) q.ws.send(s); }
  pubFull(q) { return { id: q.id, held: q.held || '', status: q.status || '', deaf: !!q.deaf, title: q.title, name: q.name, color: q.color, hat: q.hat, pc: q.pc, wear: q.wear, lamp: q.lamp, pet: q.pet, pm: q.pm, pax: q.pax, pay: q.pay, psick: !!(q.pet && this.petSt(q, q.pet).sick), pname: q.pet ? this.petName(q, q.pet) : '', x: q.x, y: q.y, dir: q.dir, voice: !!q.voice }; }
  townPos(p) { const r = p.scene ? p.ret : { x: p.x, y: p.y }; return r && !S.blockedAt(this.map, r.x, r.y) ? r : { x: SPAWN.x, y: SPAWN.y }; } // ตำแหน่งในเมืองที่จะบันทึก/กลับไป (ถ้าอยู่ในบ้านคือที่ที่ยืนก่อนเข้า)
  changeScene(p, scene, x, y) { // ย้ายผู้เล่นไปฉากใหม่: คนฉากเก่าเห็นเขาหายไป คนฉากใหม่เห็นเขาโผล่ ตัวเองได้รับฉากใหม่
    const old = p.scene || null; scene = scene || null;
    this.sceneBroadcast(old, { t: 'p-', id: p.id, quiet: 1 }, p);
    p.scene = scene; p.x = x; p.y = y; p.sit = null; p.dir = 0;
    if (p.fish) { p.fish = null; send(p, { t: 'fg', off: 1 }); }
    this.sceneBroadcast(scene, Object.assign({ t: 'p+', quiet: 1 }, this.pubFull(p)), p);
    send(p, { t: 'scene', sc: scene, owner: scene ? this.nameOfKey(scene) : '', mine: scene === p.key, x, y, items: scene ? this.houseItemsPub(scene) : [], players: [...this.sceneMates(scene, p), p].map(q => this.pubFull(q)) });
    this.dirty = true;
  }
  enterHouse(p, key) {
    if (!key || !this.saved[key]) return this.toast(p, 'ไม่พบบ้านหลังนี้');
    if (p.scene === key) return;
    const mine = key === p.key;
    if (!mine && !(this.houses[key] && S.houseScore(this.houses[key].items).count > 0)) return this.toast(p, 'บ้านหลังนี้ยังไม่ได้ตกแต่ง');
    if (!p.scene) { this.arcLeave(p); this.tradeCancel(p, 'ผู้เล่นเข้าบ้าน'); if (this.cinema.viewers.delete(p.id)) this.cinemaBroadcast(); p.ret = { x: p.x, y: p.y }; }
    const first = mine && !this.houses[key];
    if (first) this.houses[key] = { items: {}, next: 1 };
    this.changeScene(p, key, S.HOUSE_SPAWN.x, S.HOUSE_SPAWN.y);
    this.toast(p, first ? '🏠 ยินดีต้อนรับสู่บ้านของคุณ! ซื้อเฟอร์นิเจอร์ที่ร้านเฟอร์นิเจอร์มาตกแต่ง แล้วกดปุ่ม 🏠 เพื่อเข้าโหมดตกแต่ง' : mine ? '🏠 กลับบ้านแล้ว' : `🏘️ มาเยี่ยมบ้านของ ${this.nameOfKey(key)}`);
  }
  leaveHouse(p) {
    if (!p.scene) return;
    const r = this.townPos(p); p.ret = null;
    this.changeScene(p, null, r.x, r.y);
  }
  setItem(key, id, it) { // วาง/แก้ชิ้นที่ id แล้วบอกคนในบ้านหลังนี้
    this.houses[key].items[id] = it; this.hrects.delete(key);
    this.sceneBroadcast(key, { t: 'furn', op: 'set', o: Object.assign({ i: +id }, it) }); this.dirty = true;
  }
  delItem(key, id) {
    const h = this.houses[key]; delete h.items[id]; this.hrects.delete(key);
    for (const q of this.sceneMates(key)) if (q.sit && q.sit.i === +id) q.sit = null; // ที่นั่งหาย = ลุกขึ้น
    this.sceneBroadcast(key, { t: 'furn', op: 'del', i: +id }); this.dirty = true;
  }
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
          this.add(p, 'furn_' + f, -1);
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
  }
  houseAct(p, m) { // ในบ้าน แตะเก้าอี้/โซฟาเพื่อนั่งได้อย่างเดียว (เครื่องมือฟาร์มใช้ไม่ได้)
    const now = Date.now(); if (now - p.lastAct < 150) return; p.lastAct = p.activeAt = now;
    const h = this.houses[p.scene], id = m.i | 0, it = h && h.items[id];
    if (!it || !S.FURN[it.f].seat) return;
    if (Math.hypot(it.x * TS - p.x, it.y * TS - p.y) > 4 * TS) return this.toast(p, 'ไกลเกินไป เดินเข้าไปใกล้ๆ ก่อน');
    if (this.sceneMates(p.scene, p).some(q => q.sit && q.sit.i === id)) return this.toast(p, 'มีคนนั่งอยู่แล้ว');
    p.sit = { i: id }; p.x = it.x * TS; p.y = it.y * TS; p.dir = 0;
    send(p, { t: 'tp', x: p.x, y: p.y }); this.toast(p, '🪑 นั่งพักผ่อน... (เดินเพื่อลุก)');
  }

  // ----- เมือง: กระดานข่าว (log โลก 50 รายการล่าสุด) + ตู้เซฟกองกลาง (ทุกคนลงขันเหรียญ → จ่ายยา/อาหารสัตว์อัตโนมัติ และชุบสัตว์ที่ตาย) -----
  loadTown(d) {
    this.log = (Array.isArray(d.log) ? d.log : []).filter(e => Array.isArray(e) && Number.isFinite(e[0]) && typeof e[1] === 'string').slice(-S.TOWN.logMax).map(e => [e[0], e[1].slice(0, 120)]);
    this.loadVillage(d.village); this.loadWeek(d.week); this.loadProjects(d.projects); this.loadOrders(d.orders); this.trimNpc(S.ORDER.npcMaxOpen);
    this.banned = new Set(Array.isArray(d.banned) ? d.banned.filter(x => typeof x === 'string').map(x => x.toLowerCase().slice(0, 24)) : []); // ชื่อ (key) ที่ผู้ดูแลแบน: เข้าเกมไม่ได้จนกว่าจะใช้ชื่ออื่น
    const st = d.stats || {}; this.stats = { day: typeof st.day === 'string' ? st.day : '', ev: {} };
    for (const ev of Object.keys(S.FAME)) { const m = Object.create(null), o = st.ev && st.ev[ev]; if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (Number.isFinite(v)) m[k] = v; this.stats.ev[ev] = m; }
    const c = d.chest || {};
    this.chest = { coin: Number.isFinite(c.coin) && c.coin > 0 ? Math.floor(c.coin) : 0, dead: {} };
    for (const t of Object.keys(ANIMALS)) { const n = c.dead && c.dead[t]; this.chest.dead[t] = Number.isInteger(n) ? Math.max(0, Math.min(n, ANIMALS[t].cap)) : 0; }
  }
  addLog(text) { const e = [Date.now(), text]; this.log.push(e); if (this.log.length > S.TOWN.logMax) this.log.shift(); this.dirty = true; this.broadcast({ t: 'log', e }); }
  loadProjects(d) { // โครงการพัฒนาเมือง: เก็บเงินที่ลงขันและชื่อผู้ร่วมสร้าง (ชื่อ → ยอดรวม)
    this.projects = {};
    for (const P of S.PROJECTS) {
      const o = d && d[P.id] || {}, don = Object.create(null);
      if (o.donors && typeof o.donors === 'object') for (const [nm, v] of Object.entries(o.donors)) if (Number.isFinite(v) && v > 0) don[String(nm).slice(0, 12)] = Math.floor(v);
      this.projects[P.id] = { coin: Number.isFinite(o.coin) ? Math.max(0, Math.min(P.goal, Math.floor(o.coin))) : 0, donors: don };
    }
  }
  // ----- กระดานใบสั่งซื้อ: ผู้เล่น/NPC ตั้ง "ต้องการซื้อ X ชิ้น จ่ายเหรียญ" เหรียญถูกกันไว้ (escrow) คนอื่นเอาของมาส่งรับเหรียญ หัก fee -----
  loadOrders(d) {
    this.orders = []; this.orderSeq = 1;
    if (Array.isArray(d)) for (const o of d) {
      if (!o || typeof o !== 'object' || !S.SELLABLE.includes(o.item)) continue;
      const qty = Math.max(1, Math.min(S.ORDER.maxQty, Math.floor(o.qty) || 0)), filled = Math.max(0, Math.min(qty, Math.floor(o.filled) || 0));
      if (filled >= qty) continue;
      const id = Math.floor(o.id) || this.orderSeq;
      this.orders.push({ id, by: typeof o.by === 'string' ? o.by.slice(0, 24) : '', byName: typeof o.byName === 'string' ? o.byName.slice(0, 12) : 'ใครสักคน', npc: !!o.npc,
        item: o.item, qty, filled, perUnit: Math.max(1, Math.floor(o.perUnit) || 1), esc: o.npc ? 0 : Math.max(0, Math.floor(o.esc) || 0),
        exp: Number.isFinite(o.exp) ? o.exp : Date.now() + S.ORDER.expireHours * 3600000 });
      if (id >= this.orderSeq) this.orderSeq = id + 1;
    }
  }
  nearBoard(p) { return Math.hypot(p.x - (S.BOARD.x + 0.5) * TS, p.y - (S.BOARD.y + 0.5) * TS) < 4.5 * TS; }
  ordEarnOf(p) { const day = this.today(), r = p.rec; if (!r.ordEarn || r.ordEarn.day !== day) r.ordEarn = { day, n: 0 }; return r.ordEarn; } // เพดานเหรียญที่รับจากการส่งของต่อวัน (กันบัญชีสำรองฟอกเงิน)
  creditInv(key, item, n) { // เพิ่มของให้ผู้เล่น (อาจออฟไลน์): อัปเดตทั้งในเกมและไฟล์เซฟ
    const p = [...this.players.values()].find(q => q.key === key), rec = (p && p.rec) || this.saved[key]; if (!rec) return;
    rec.inv[item] = Math.max(0, (rec.inv[item] || 0) + n); if (!rec.inv[item]) delete rec.inv[item];
    if (p) send(p, { t: 'inv', inv: rec.inv }); this.dirty = true;
  }
  creditCoin(key, n, why) { // คืน/จ่ายเหรียญให้ผู้เล่น (อาจออฟไลน์)
    const p = [...this.players.values()].find(q => q.key === key);
    if (p) return this.add(p, 'coin', n, why);
    const rec = this.saved[key]; if (rec) { rec.inv.coin = Math.max(0, (rec.inv.coin || 0) + n); this.dirty = true; logEv(this.room, 'coin', { p: key, n, why: why || 'order' }); }
  }
  creditAnimalCare(key, xp) { // ปันผล XP การเลี้ยงให้คนที่ให้อาหารสัตว์ไว้ แม้คนอื่นจะมาเก็บผลผลิต (ออนไลน์/ออฟไลน์)
    const p = [...this.players.values()].find(q => q.key === key);
    if (p) { this.addXp(p, 'animal', xp); this.addPts(p, 1); this.toast(p, '🐄 มีคนเก็บผลผลิตจากสัตว์ที่คุณเลี้ยง — คุณได้ XP การเลี้ยง'); }
    else { const rec = this.saved[key]; if (rec && rec.skills) { rec.skills.animal = (rec.skills.animal || 0) + xp; this.dirty = true; } }
  }
  // ----- แต้มตู้เกม (arcade points): เล่นจบ/ชนะคนจริงได้แต้ม ใช้แลกของโชว์ + จัดอันดับ Leaderboard -----
  weekKey() { return Math.floor(Date.now() / (7 * 86400000)); } // บัคเก็ตสัปดาห์ (Leaderboard รายสัปดาห์รีเซ็ตทุก 7 วัน)
  arcOf(rec) {
    if (!rec.arc || typeof rec.arc !== 'object') rec.arc = { pts: 0, total: 0, wk: 0, wkKey: 0 };
    const wk = this.weekKey(); if (rec.arc.wkKey !== wk) { rec.arc.wk = 0; rec.arc.wkKey = wk; }
    return rec.arc;
  }
  arcPub(rec) { const a = this.arcOf(rec); return { pts: a.pts, total: a.total, wk: a.wk }; }
  arcAward(key, play, won) { // ให้แต้ม (ออนไลน์/ออฟไลน์): play = แต้มเล่นจบ, won = ชนะคนจริงได้โบนัส
    if (!key) return;
    const p = [...this.players.values()].find(q => q.key === key), rec = (p && p.rec) || this.saved[key]; if (!rec) return;
    const a = this.arcOf(rec), gain = play + (won ? S.ARCPTS.win : 0);
    a.pts += gain; a.total += gain; a.wk += gain; this.dirty = true;
    this.achAdd(rec, 'arcplay'); if (won) this.achAdd(rec, 'arcwin');
    if (p) { send(p, { t: 'arcpts', arc: this.arcPub(rec) }); this.toast(p, `🎮 +${gain} แต้มตู้เกม${won ? ' (ชนะ!)' : ''} • มีอยู่ ${a.pts}`); }
  }
  sendLeaderboard(p) { // อันดับแต้มตู้เกมในห้องนี้ (สะสมตลอดกาล + สัปดาห์นี้) Top 10
    const arr = [];
    for (const [k, r] of Object.entries(this.saved)) { const a = this.arcOf(r); if (a.total > 0) arr.push({ name: r.name || k, total: a.total, wk: a.wk }); }
    const top = key => arr.slice().sort((x, y) => y[key] - x[key]).slice(0, 10);
    send(p, { t: 'lb', total: top('total'), wk: top('wk').filter(x => x.wk > 0), me: this.arcPub(p.rec) });
  }
  ordersPub(p) {
    const level = S.playLevel(p.rec.skills), ec = this.ordEarnOf(p);
    const list = this.orders.map(o => { const info = S.itemInfo(o.item) || {}; return { id: o.id, byName: o.byName, npc: o.npc, mine: o.by === p.key, item: o.item, name: info.name, emoji: info.emoji, qty: o.qty, filled: o.filled, perUnit: o.perUnit, net: o.npc ? o.perUnit : Math.round(o.perUnit * (1 - S.ORDER.fee)), exp: o.exp }; }).sort((a, b) => (b.mine - a.mine) || ((a.npc ? 1 : 0) - (b.npc ? 1 : 0)) || (b.id - a.id)); // ใบของเรา → ใบของผู้เล่นอื่น (ใหม่ก่อน) → ใบ NPC
    return { t: 'order', lock: level < S.ORDER.minLevel ? S.ORDER.minLevel : 0, level, fee: S.ORDER.fee, maxQty: S.ORDER.maxQty, maxOpen: S.ORDER.maxOpen, earnLeft: Math.max(0, S.ORDER.earnCapPerDay - ec.n), list };
  }
  orderPush(p) { send(p, this.ordersPub(p)); }
  orderPushAll() { this.dirty = true; for (const p of this.players.values()) send(p, this.ordersPub(p)); }
  npcPick() { // สำรับสลับสินค้า: ไม่ซ้ำกับใบ NPC ที่เปิดอยู่ ไม่เอาของที่ตลาดตกหนัก และพยายามไม่ซ้ำหมวดกับใบก่อนหน้า
    const open = new Set(this.orders.filter(o => o.npc).map(o => o.item));
    for (const sameCatOk of [false, true]) for (let round = 0; round < 2; round++) {
      if (!this.npcDeck || !this.npcDeck.length) { this.npcDeck = S.SELLABLE.slice(); for (let i = this.npcDeck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.npcDeck[i], this.npcDeck[j]] = [this.npcDeck[j], this.npcDeck[i]]; } }
      const skipped = [];
      while (this.npcDeck.length) {
        const it = this.npcDeck.pop(), info = S.itemInfo(it), g = this.market[it];
        if (!info || !info.sell || open.has(it) || (g && g.m < 0.6) || (!sameCatOk && S.sellCat(it) === this.npcLastCat)) { skipped.push(it); continue; }
        this.npcDeck.unshift(...skipped); this.npcLastCat = S.sellCat(it); return it;
      }
      this.npcDeck = skipped.length ? skipped : null; // สำรับหมด: สับใหม่ในรอบถัดไป
    }
    return null;
  }
  trimNpc(keep) { // เหลือใบ NPC ไม่เกิน keep ใบ: เอาใบเก่าสุดที่ยังไม่มีใครส่งของออกก่อน (ใบที่มีคนส่งแล้วเก็บไว้ท้ายสุด)
    const npc = this.orders.filter(o => o.npc); if (npc.length <= keep) return;
    const drop = npc.sort((a, b) => ((a.filled > 0) - (b.filled > 0)) || (a.exp - b.exp)).slice(0, npc.length - keep);
    this.orders = this.orders.filter(o => !drop.includes(o));
  }
  npcPostOrders() { // วันเกมใหม่: NPC ตั้งใบสั่งซื้อ จ่าย 115% ของราคาร้านตอนนั้น (จากระบบ ไม่หัก fee) สินค้าสลับด้วยสำรับ ใบเก่าสุดถูกแทนที่เพื่อไม่ให้ล้นกระดาน
    const names = ['ป้าแก้ว', 'ลุงสมชาย', 'น้องมิ้นท์'];
    this.trimNpc(S.ORDER.npcMaxOpen - S.ORDER.npcDaily);
    for (let i = 0; i < S.ORDER.npcDaily && this.orders.length < 60; i++) {
      const item = this.npcPick(); if (!item) continue;
      const info = S.itemInfo(item), qty = Math.floor(rand(S.ORDER.npcQty[0], S.ORDER.npcQty[1] + 1)), gm = this.market[item] ? this.market[item].m : 1;
      const perUnit = Math.max(1, Math.round(info.sell * gm * S.ORDER.npcPremium));
      this.orders.push({ id: this.orderSeq++, by: '', byName: names[Math.floor(Math.random() * names.length)], npc: true, item, qty, filled: 0, perUnit, esc: 0, exp: Date.now() + S.ORDER.expireHours * 3600000 });
      this.addLog(`📋 ${this.orders[this.orders.length - 1].byName} ตั้งใบสั่งซื้อ ${info.emoji}${info.name} ×${qty} (ชิ้นละ 🪙${perUnit})`);
    }
    this.orderPushAll();
  }
  orderExpire(now) {
    if (!this.orders.length) return; let changed = false;
    for (const o of this.orders.slice()) { if (o.exp > now) continue; if (!o.npc && o.esc > 0) this.creditCoin(o.by, o.esc, 'order_expire'); this.orders = this.orders.filter(x => x !== o); changed = true; }
    if (changed) this.orderPushAll();
  }
  orderHandle(p, m) {
    if (!this.nearBoard(p)) return this.toast(p, 'ต้องยืนใกล้กระดานใบสั่งซื้อที่ลานกองไฟ');
    const level = S.playLevel(p.rec.skills);
    if (level < S.ORDER.minLevel) return this.toast(p, `กระดานใบสั่งซื้อปลดล็อกเมื่อเลเวลรวมทุกอาชีพถึง ${S.ORDER.minLevel} (ตอนนี้ ${level})`);
    if (m.a === 'post') {
      const item = String(m.item || '');
      if (!S.SELLABLE.includes(item)) return this.toast(p, 'สินค้านี้ตั้งใบสั่งซื้อไม่ได้');
      const qty = Math.floor(m.qty) || 0;
      if (qty < 1 || qty > S.ORDER.maxQty) return this.toast(p, `จำนวนต้องอยู่ระหว่าง 1–${S.ORDER.maxQty}`);
      const perUnit = Math.floor(m.perUnit) || 0, band = S.orderBand(S.itemInfo(item).sell);
      if (perUnit < band[0] || perUnit > band[1]) return this.toast(p, `ราคาต่อชิ้นต้องอยู่ ${band[0]}–${band[1]} เหรียญ (60–150% ของราคาฐาน)`);
      if (this.orders.filter(o => o.by === p.key).length >= S.ORDER.maxOpen) return this.toast(p, `คุณมีใบสั่งซื้อค้างครบ ${S.ORDER.maxOpen} ใบแล้ว`);
      if (this.orders.length >= 60) return this.toast(p, 'กระดานเต็ม รอใบอื่นปิดก่อนนะ');
      const cost = qty * perUnit;
      if ((p.rec.inv.coin || 0) < cost) return this.toast(p, `ต้องมีเหรียญ ${cost} เพื่อกันไว้จ่าย (ตอนนี้ ${p.rec.inv.coin || 0})`);
      this.add(p, 'coin', -cost, 'order_post');
      this.orders.push({ id: this.orderSeq++, by: p.key, byName: p.name, npc: false, item, qty, filled: 0, perUnit, esc: cost, exp: Date.now() + S.ORDER.expireHours * 3600000 });
      const info = S.itemInfo(item);
      this.addLog(`📋 ${p.name} ตั้งใบสั่งซื้อ ${info.emoji}${info.name} ×${qty} (ชิ้นละ 🪙${perUnit})`);
      logEv(this.room, 'order_post', { p: p.key, item, qty, perUnit });
      this.toast(p, `📋 ตั้งใบสั่งซื้อแล้ว กัน 🪙${cost} ไว้จ่าย`); this.sfxTo(p, 'coin'); this.orderPushAll();
    } else if (m.a === 'fill') {
      const o = this.orders.find(x => x.id === (m.id | 0));
      if (!o) return this.toast(p, 'ใบสั่งซื้อนี้ถูกปิดไปแล้ว');
      if (o.by === p.key) return this.toast(p, 'ส่งของให้ใบสั่งซื้อของตัวเองไม่ได้');
      const info = S.itemInfo(o.item), stock = p.rec.inv[o.item] || 0;
      if (stock < 1) return this.toast(p, `คุณไม่มี ${info.emoji}${info.name} จะส่ง`);
      const remain = o.qty - o.filled, ec = this.ordEarnOf(p);
      const net1 = o.npc ? o.perUnit : Math.round(o.perUnit * (1 - S.ORDER.fee));
      const maxByCap = net1 > 0 ? Math.floor(Math.max(0, S.ORDER.earnCapPerDay - ec.n) / net1) : remain;
      const want = m.n === 'all' || !(m.n > 0) ? remain : Math.min(remain, m.n | 0);
      const d = Math.max(0, Math.min(remain, stock, want, maxByCap));
      if (d < 1) { if (maxByCap < 1) return this.toast(p, `วันนี้รับเงินจากใบสั่งซื้อครบเพดาน 🪙${S.ORDER.earnCapPerDay} แล้ว พรุ่งนี้มาใหม่นะ`); return this.toast(p, 'ส่งของไม่ได้ตอนนี้'); }
      const pay = d * net1;
      this.add(p, o.item, -d); this.add(p, 'coin', pay, 'order_fill'); ec.n += pay; o.filled += d;
      if (!o.npc) { o.esc -= d * o.perUnit; this.creditInv(o.by, o.item, d); } // ส่วนต่าง fee หายจากระบบ (sink), ผู้ตั้งได้ของ (อาจออฟไลน์)
      this.addPts(p, Math.min(5, d)); this.villageBump(p);
      logEv(this.room, 'order_fill', { p: p.key, by: o.by, item: o.item, n: d, pay });
      this.toast(p, `✅ ส่ง ${info.emoji}${info.name} ×${d} ให้ ${o.byName} ได้ 🪙${pay}${o.npc ? '' : ` (หัก ${Math.round(S.ORDER.fee * 100)}%)`}`); this.sfxTo(p, 'coin');
      const po = [...this.players.values()].find(q => q.key === o.by);
      if (po) this.toast(po, `📦 ${p.name} ส่ง ${info.emoji}${info.name} ×${d} ตามใบสั่งซื้อของคุณแล้ว`);
      if (o.filled >= o.qty) { this.orders = this.orders.filter(x => x !== o); this.addLog(`📦 ใบสั่งซื้อ ${info.emoji}${info.name} ของ ${o.byName} ได้ของครบแล้ว`); }
      this.orderPushAll();
    } else if (m.a === 'cancel') {
      const o = this.orders.find(x => x.id === (m.id | 0));
      if (!o || o.by !== p.key || o.npc) return;
      this.orders = this.orders.filter(x => x !== o);
      if (o.esc > 0) this.add(p, 'coin', o.esc, 'order_refund');
      this.toast(p, `ยกเลิกใบสั่งซื้อแล้ว คืน 🪙${o.esc}`); this.orderPushAll();
    }
  }
  projOpen(i) { return S.PROJECTS.slice(0, i).every(P => this.projects[P.id].coin >= P.goal); } // ปลดล็อกทีละโครงการตามลำดับ
  projPub() {
    return S.PROJECTS.map((P, i) => { const o = this.projects[P.id];
      return { id: P.id, coin: o.coin, open: this.projOpen(i), top: Object.entries(o.donors).sort((a, b) => b[1] - a[1]).slice(0, 5) }; });
  }
  projPush() { this.dirty = true; this.broadcast({ t: 'proj', p: this.projPub() }); }
  projHandle(p, m) {
    if (!this.nearChest(p)) return this.toast(p, 'ต้องอยู่ใกล้ตู้เซฟกองกลางที่ลานกองไฟ');
    const i = S.PROJECTS.findIndex(P => P.id === m.id), P = S.PROJECTS[i], amt = m.amt | 0;
    if (!P || !S.PROJ_DONATE.includes(amt)) return;
    if (!this.projOpen(i)) return this.toast(p, 'ต้องสร้างโครงการก่อนหน้าให้เสร็จก่อน');
    const o = this.projects[P.id], room = P.goal - o.coin;
    if (room <= 0) return this.toast(p, `${P.emoji} ${P.name} สร้างเสร็จแล้ว`);
    const give = Math.min(amt, room, p.rec.inv.coin || 0);
    if (give <= 0) return this.toast(p, 'เหรียญไม่พอ');
    this.add(p, 'coin', -give, 'project'); o.coin += give; o.donors[p.name] = (o.donors[p.name] || 0) + give;
    const names = Object.keys(o.donors); if (names.length > 40) delete o.donors[names.sort((a, b) => o.donors[a] - o.donors[b])[0]]; // เก็บเฉพาะผู้บริจาคสูงสุด
    this.addPts(p, Math.floor(give / 10)); this.sfxTo(p, 'coin');
    this.toast(p, `${P.emoji} ร่วมสร้าง${P.name} 🪙 ${give} (${o.coin}/${P.goal})`);
    if (o.coin >= P.goal) {
      S.applyProject(this.map, P.id); // สร้างเสร็จ: แปลงแมพทันที (client วาดภาพเองเมื่อได้รับ proj)
      const top = Object.entries(o.donors).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nm, v], k) => `${['🥇', '🥈', '🥉'][k]} ${nm} (${v})`).join(' ');
      const news = `🎉 ${P.emoji} ${P.name} สร้างเสร็จแล้ว! ขอบคุณผู้ร่วมสร้าง ${top}`; this.broadcast({ t: 'msg', text: news }); this.addLog(news);
    }
    this.projPush();
  }
  chestPush() { this.dirty = true; this.broadcast({ t: 'chest', c: this.chest }); }
  toChest(fee) { const n = Math.floor(fee * S.TOWN.feeShare); if (n > 0) { this.chest.coin += n; this.chestPush(); } } // แบ่งค่าเตา/ค่าบริการตู้เกมเข้ากองกลาง (ไว้ดูแล/ชุบชีวิตสัตว์)
  nearChest(p) { return Math.hypot(p.x - (S.CHEST.x + 0.5) * TS, p.y - (S.CHEST.y + 0.5) * TS) < 4.5 * TS; }
  chestHandle(p, m) {
    if (!this.nearChest(p)) return this.toast(p, 'ต้องอยู่ใกล้ตู้เซฟกองกลางที่ลานกองไฟ');
    if (m.a === 'donate') {
      const amt = m.amt | 0;
      if (!S.TOWN.donate.includes(amt) || (p.rec.inv.coin || 0) < amt) return this.toast(p, 'เหรียญไม่พอ');
      this.add(p, 'coin', -amt, 'donate'); this.chest.coin += amt; this.chestPush();
      this.addLog(`🪙 ${p.name} ลงขันเข้าตู้เซฟกองกลาง ${amt} เหรียญ`); this.addPts(p, Math.floor(amt / 10)); this.villageBump(p); this.toast(p, `ลงขัน 🪙 ${amt} ขอบคุณที่ช่วยเมือง 💛`); this.sfxTo(p, 'coin');
    } else if (m.a === 'claim') {
      const rec = p.rec, day = this.today(), level = S.playLevel(rec.skills), q = this.questsOf(p), done = q.list.filter(x => x.done).length;
      if (rec.dole === day) return this.toast(p, 'วันนี้คุณรับของแจกไปแล้ว พรุ่งนี้มาใหม่นะ');
      if (done < S.DOLE.needQuests) return this.toast(p, `ต้องทำเควสประจำวันให้สำเร็จอย่างน้อย ${S.DOLE.needQuests} ข้อก่อน (ของแจกสำหรับคนที่ลงมือเล่นจริง)`);
      const tier = S.dolePackage(this.chest.coin, level);
      if (!tier) return this.toast(p, `ยังรับไม่ได้: ต้องมีเงินกองกลางพอและระดับการเล่นถึงเกณฑ์ (ตอนนี้ Lv ${level})`);
      const cost = S.doleCost(tier);
      if (this.chest.coin - cost < S.DOLE.reserve) return this.toast(p, 'เงินกองกลางเหลือน้อยเกินไป ขอเก็บไว้ดูแลสัตว์ก่อน รอเพื่อนๆ ลงขันเพิ่มนะ');
      this.chest.coin -= cost; rec.dole = day;
      this.add(p, 'coin', tier.coin, 'dole'); for (const id of tier.meals) this.add(p, 'meal_' + id, 1);
      this.chestPush(); this.dirty = true; this.questPush(p);
      const names = tier.meals.map(id => { const i = S.itemInfo('meal_' + id); return i.emoji + i.name; }).join(' ');
      this.addLog(`🎁 ${p.name} (Lv ${level}) รับของแจกจากกองกลาง 🪙${tier.coin} + ${names}`);
      this.toast(p, `🎁 ได้รับของแจก: 🪙${tier.coin} + ${names}`); this.sfxTo(p, 'levelup');
    } else if (m.a === 'revive') {
      const type = typeof m.type === 'string' && Object.hasOwn(ANIMALS, m.type) ? m.type : null, A = type && ANIMALS[type];
      if (!A || !(this.chest.dead[type] > 0)) return;
      if (this.count(type) >= A.cap) return this.toast(p, `${A.name}เต็มทุ่งแล้ว`);
      const cost = S.reviveCost(type);
      if (this.chest.coin < cost) return this.toast(p, `เงินกองกลางไม่พอ (ต้องใช้ 🪙 ${cost})`);
      this.chest.coin -= cost; this.chest.dead[type]--; this.spawnAnimal(type); this.chestPush();
      this.addLog(`✨ ${p.name} ใช้เงินกองกลางชุบชีวิต${A.emoji} ${A.name}กลับมา`); this.sfx(p, 'heal');
    }
  }
  careTick(a, A) { // เงินกองกลางดูแลสัตว์ให้อัตโนมัติ เมื่อป่วย/หิวจัดนานพอที่ผู้เล่นยังไม่ได้ช่วย
    const med = S.itemInfo('medicine').buy, food = S.itemInfo(A.feedItem).buy;
    if (a.sick && a.sickMs > S.TOWN.autoAfterMs && this.chest.coin >= med) {
      this.chest.coin -= med; a.sick = false; a.sickMs = 0; this.chestPush();
      this.addLog(`💊 ตู้เซฟกองกลางจ่ายค่ายารักษา${A.emoji} ${A.name}ที่ป่วย (-${med})`);
    } else if (a.hunger <= 0 && a.zero > S.TOWN.autoAfterMs && this.chest.coin >= food) {
      this.chest.coin -= food; a.hunger = 100; a.zero = 0; this.chestPush();
      this.addLog(`🌾 ตู้เซฟกองกลางจ่ายค่าอาหารให้${A.emoji} ${A.name}ที่หิวจัด (-${food})`);
    }
  }

  // ----- เควสประจำวัน + แต้มความดี + บัฟ + สถิติประจำวัน (Hall of Fame) -----
  today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
  questPick(p, r, have) { // สุ่มเควสให้ครบ QUEST_PER_DAY ข้อ: กระจายหลายหมวดก่อน แล้วค่อยเติมให้เต็ม • have = id ที่มีอยู่แล้ว (ไม่ซ้ำ)
    const inv = p.rec.inv, newbie = (p.rec.qtotal || 0) < S.QUEST_NEWBIE, hasAxe = !!(inv.axe_1 || inv.axe_2 || inv.axe_3);
    const ids = Object.keys(S.QUESTS).filter(id => { const d = S.QUESTS[id]; return !have.includes(id) && !(newbie && (d.adv || d.cat === 'cook')) && !(d.cat === 'wood' && !hasAxe); }); // มือใหม่: ข้อง่ายเท่านั้น • เควสไม้ต้องมีขวาน
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const out = [];
    for (const c of shuffle([...new Set(ids.map(id => S.QUESTS[id].cat))])) {
      if (out.length + have.length >= S.QUEST_PER_DAY) break;
      const pool = ids.filter(id => S.QUESTS[id].cat === c); out.push(pool[Math.floor(r() * pool.length)]);
    }
    const rest = shuffle(ids.filter(id => !out.includes(id)));
    while (out.length + have.length < S.QUEST_PER_DAY && rest.length) out.push(rest.pop());
    return out;
  }
  questsOf(p) { // เควสของวันนี้ (สุ่มจากชื่อ+วัน ได้ชุดเดิมทั้งวันแม้ออกแล้วเข้าใหม่) • ถ้าเคยได้น้อยกว่าที่กำหนด (ปรับจำนวนเควสกลางวัน) จะเติมให้ครบโดยไม่ล้างความคืบหน้า
    const day = this.today(); let q = p.rec.quest;
    const valid = !!(q && q.day === day && q.list.every(it => S.QUESTS[it.id]));
    if (valid && q.list.length >= S.QUEST_PER_DAY) return q;
    let h = 2166136261; for (const ch of p.key + day + (valid ? q.list.length : '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const r = S.rng(h >>> 0), mk = id => ({ id, n: 0, done: false, seen: [] });
    if (valid) { for (const id of this.questPick(p, r, q.list.map(it => it.id))) q.list.push(mk(id)); delete q.bonus; this.dirty = true; return q; }
    q = p.rec.quest = { day, list: this.questPick(p, r, []).map(mk) };
    return q;
  }
  ptsOf(p) { const day = this.today(), o = p.rec.pts = p.rec.pts || { bal: 0, earned: 0, day }; if (o.day !== day) { o.day = day; o.earned = 0; } return o; }
  buffOn(p, id) { return !!(p.rec.buffs && p.rec.buffs[id] > Date.now()); }
  questPush(p) {
    const q = this.questsOf(p), pts = this.ptsOf(p), now = Date.now(), buffs = {};
    for (const id of Object.keys(S.BUFFS)) if (this.buffOn(p, id)) buffs[id] = p.rec.buffs[id] - now;
    send(p, { t: 'quests', list: q.list.map(it => [it.id, it.n, it.done ? 1 : 0]), total: p.rec.qtotal || 0, title: this.titleOf(p.rec), dole: p.rec.dole === this.today(),
      starter: { done: Object.keys(this.starterOf(p).done), final: !!this.starterOf(p).final }, streak: { n: (p.rec.streak || {}).n || 0 },
      book: Object.fromEntries(Object.keys(S.BOOK).map(c => [c, Object.keys(this.bookOf(p)[c])])),
      wk: (this.wkRoll(), { mine: this.week.by[p.name] || 0, claimed: !!this.week.claimed[p.key] }), pts: { bal: pts.bal, earned: pts.earned }, buffs });
  }
  addPts(p, n) {
    const o = this.ptsOf(p); n = Math.min(n, S.POINTS.dailyCap - o.earned);
    if (n <= 0) return;
    o.bal += n; o.earned += n; this.dirty = true; this.questPush(p); this.toast(p, `💛 แต้มความดี +${n}`);
  }
  statDay() { // วันใหม่: ประกาศผู้นำของเมื่อวานลงข่าวเมือง แล้วเริ่มนับใหม่
    const day = this.today();
    if (this.stats.day === day) return;
    for (const [ev, [emoji, label]] of Object.entries(S.FAME)) {
      const top = Object.entries(this.stats.ev[ev] || {}).sort((a, b) => b[1] - a[1])[0];
      if (top && this.stats.day) this.addLog(`🏆 ${emoji} ${label}ประจำเมื่อวาน: ${top[0]} (${top[1]} ครั้ง)`);
    }
    this.stats = { day, ev: {} }; this.dirty = true;
  }
  famePub() { const o = {}; for (const ev of Object.keys(S.FAME)) o[ev] = Object.entries(this.stats.ev[ev] || {}).sort((a, b) => b[1] - a[1]).slice(0, 3); return o; }
  event(p, ev, arg) { // เหตุการณ์ที่นับทั้งเควสและสถิติประจำวัน
    this.statDay(); this.starterStep(p, ev);
    if (ev === 'feed' || ev === 'collect' || ev === 'cook' || ev === 'craft') this.telAdd(p, ev, 0); // งานเบาที่ไม่ผ่าน tire()
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
  }
  // ----- ความสำเร็จ (Achievement) + ฉายา: ตัวนับสะสมเก็บใน rec.ach.cnt (นับจาก event ในเกม) • ครบเป้า = ได้เหรียญ + (บางข้อ) ปลดล็อกฉายาให้เลือกใช้ (rec.ttl) -----
  achOf(rec) { const a = rec.ach = rec.ach && typeof rec.ach === 'object' ? rec.ach : {}; if (!a.cnt || typeof a.cnt !== 'object') a.cnt = {}; if (!a.got || typeof a.got !== 'object') a.got = {}; return a; }
  titleOf(rec) { // ฉายาที่แสดงเหนือหัว: ที่เลือกไว้ (ต้องปลดล็อกแล้ว) ไม่งั้นใช้ฉายาตามจำนวนเควสสะสม
    const d = rec.ttl && S.ACH.find(x => x.id === rec.ttl), a = rec.ach;
    return d && d.title && a && a.got && a.got[d.id] ? d.title : S.titleFor(rec.qtotal);
  }
  achAdd(rec, stat, n = 1) { const a = this.achOf(rec); a.cnt[stat] = (a.cnt[stat] || 0) + n; this.dirty = true; this.achCheck(rec); }
  achCheck(rec) {
    const a = this.achOf(rec), p = [...this.players.values()].find(q => q.rec === rec) || null;
    const val = st => st === 'wealth' ? (rec.inv.coin || 0) : st === 'streak' ? ((rec.streak || {}).n || 0) : (a.cnt[st] || 0);
    let any = false;
    for (const d of S.ACH) {
      if (a.got[d.id] || val(d.stat) < d.goal) continue;
      a.got[d.id] = Date.now(); any = true;
      if (p) this.add(p, 'coin', d.coin, 'ach'); else rec.inv.coin = (rec.inv.coin || 0) + d.coin;
      if (p) {
        this.toast(p, `🏆 ความสำเร็จใหม่: ${d.e} ${d.name} (+🪙${d.coin})${d.title ? ` • ปลดล็อกฉายา "${d.title}"` : ''}`); this.sfxTo(p, 'levelup');
        if (d.title) this.addLog(`🏆 ${p.name} ได้ความสำเร็จ "${d.name}" ปลดล็อกฉายา "${d.title}"`);
      }
    }
    if (any) { this.dirty = true; if (p) this.achPush(p); }
  }
  achPush(p) { const a = this.achOf(p.rec); send(p, { t: 'ach', cnt: Object.assign({}, a.cnt, { wealth: p.rec.inv.coin || 0, streak: (p.rec.streak || {}).n || 0 }), got: a.got, sel: p.rec.ttl || '' }); }
  questHandle(p, m) {
    if (m.a === 'ach') return this.achPush(p);
    if (m.a === 'title') { // เลือกฉายาที่ปลดล็อกแล้ว ('' = กลับไปใช้ฉายาตามเควส)
      const id = typeof m.id === 'string' ? m.id : '';
      if (id) { const d = S.ACH.find(x => x.id === id); if (!d || !d.title || !(p.rec.ach && p.rec.ach.got[id])) return; p.rec.ttl = id; } else delete p.rec.ttl;
      p.title = this.titleOf(p.rec); this.broadcast({ t: 'title', id: p.id, title: p.title }); this.dirty = true; this.achPush(p);
      return this.toast(p, p.title ? `🏅 ใช้ฉายา "${p.title}"` : 'เอาฉายาออกแล้ว');
    }
    if (m.a === 'buff') {
      const id = typeof m.id === 'string' && Object.hasOwn(S.BUFFS, m.id) ? m.id : null, B = id && S.BUFFS[id];
      if (!B) return;
      if (this.buffOn(p, id)) return this.toast(p, `${B.emoji} ${B.name} ยังมีผลอยู่`);
      const o = this.ptsOf(p); if (o.bal < B.cost) return this.toast(p, 'แต้มความดีไม่พอ');
      o.bal -= B.cost; (p.rec.buffs || (p.rec.buffs = {}))[id] = Date.now() + B.ms; this.dirty = true;
      this.questPush(p); this.toast(p, `${B.emoji} ${B.name}: ${B.desc} (${Math.round(B.ms / 60000)} นาที)`); this.sfxTo(p, 'levelup');
    } else if (m.a === 'weekly') { this.weeklyClaim(p);
    } else if (m.a === 'fame') { this.statDay(); send(p, { t: 'fame', f: this.famePub() }); }
  }

  // ----- ธนาคาร (ATM) + Happy Village (บัฟร่วมของทั้งเมือง) -----
  bankOf(p) {
    const b = p.rec.bank = p.rec.bank || { bal: 0 };
    if (!Number.isFinite(b.bal) || b.bal < 0) b.bal = 0;
    b.bal = Math.floor(b.bal);
    delete b.acc; // ตัวนับเวลาดอกเบี้ยเดิม (ยกเลิกแล้ว)
    return b;
  }
  // ----- พลังงาน ⚡ (Phase 2) -----
  enOf(p) { const e = p.rec.en = p.rec.en && typeof p.rec.en === 'object' ? p.rec.en : {}; if (!Number.isFinite(e.v)) e.v = S.ENERGY.max; e.v = Math.max(-S.ENERGY.max, Math.min(S.ENERGY.max, e.v)); if (!Number.isFinite(e.at)) e.at = Date.now(); e.ex = !!e.ex; return e; }
  enJoin(p) { const e = this.enOf(p), now = Date.now(); e.v = Math.min(S.ENERGY.max, e.v + Math.max(0, now - e.at) / S.ENERGY.regenMs); e.at = now; if (e.ex && e.v >= S.ENERGY.resume) e.ex = false; } // ฟื้นระหว่างออฟไลน์ด้วย
  enPub(p, spent) { const e = this.enOf(p); return { t: 'en', spent: spent || 0, v: Math.round(e.v * 10) / 10, ex: e.ex, rate: (p.sit ? S.ENERGY.sitMul : 1) / S.ENERGY.regenMs, resume: S.ENERGY.resume, rareUntil: p.rec.rareAt || 0 }; }
  enPush(p, spent) { send(p, this.enPub(p, spent)); }
  tire(p, kind, value) { // งานหนักที่สำเร็จแล้ว หักพลังงานตามมูลค่างาน (S.energyCost) เกินที่มี = ติดลบ ต้องพักจนถึง resume
    if (!S.ENERGY.on) return this.telAdd(p, kind, 0); // ระบบพลังงานปิดอยู่: ไม่หักพลังงาน แต่ยังนับการกระทำ
    const e = this.enOf(p), cost = S.energyCost(kind, value); e.v = Math.max(-S.ENERGY.max, e.v - cost); e.at = Date.now();
    if (e.v <= 0 && !e.ex) {
      e.ex = true; const sec = Math.ceil((S.ENERGY.resume - e.v) * S.ENERGY.regenMs / (p.sit ? S.ENERGY.sitMul : 1) / 1000);
      this.toast(p, `😮‍💨 เหนื่อยแล้ว! ต้องพักราว ${sec >= 60 ? Math.ceil(sec / 60) + ' นาที' : sec + ' วินาที'} (นั่งที่ม้านั่งฟื้นไวขึ้น 3 เท่า) ระหว่างนี้ทำอาหาร เควส หรือลงขันเมืองได้`); logEv(this.room, 'tired', { p: p.key });
    }
    this.dirty = true; this.enPush(p, cost); this.telAdd(p, kind, cost);
  }
  // ----- telemetry: นับจำนวนการกระทำ + พลังงานที่ใช้ต่อคน รวมไว้ในหน่วยความจำ แล้วเขียนเป็น event 'act' ตอนออกจากเกม/ทุกชั่วโมง (ไม่เขียนทุกคลิก) -----
  telAdd(p, kind, en) { const t = p.tel || (p.tel = { n: {}, en: {} }); t.n[kind] = (t.n[kind] || 0) + 1; if (en) t.en[kind] = (t.en[kind] || 0) + en; }
  telFlush(p, sync) { const t = p.tel; if (!t || !Object.keys(t.n).length) return; p.tel = null; logEv(this.room, 'act', { p: p.key, n: t.n, en: t.en }, sync); }
  telTick(now) { // ทุกชั่วโมง: ภาพรวมตลาดกลาง/กองกลาง/ฝูงสัตว์ + เทการกระทำของคนที่ออนไลน์ค้างอยู่
    if (!this.snapAt) this.snapAt = now + Math.min(5 * 60 * 1000, SNAP_MS);
    if (now < this.snapAt) return;
    this.snapAt = now + SNAP_MS;
    const mk = {}; for (const k of Object.keys(this.market)) mk[k] = Math.round(this.market[k].m * 100) / 100;
    const an = {}; for (const a of this.animals) if (!a.dead) an[a.type] = (an[a.type] || 0) + 1;
    logEv(this.room, 'snap', { mk, chest: this.chest.coin, dead: this.chest.dead, an, online: this.players.size });
    for (const p of this.players.values()) this.telFlush(p);
  }
  exhausted(p) { return S.ENERGY.on && this.enOf(p).ex; }
  heavyAction(tool, k) { return ['hoe', 'water', 'axe', 'rod'].includes(tool) || (typeof tool === 'string' && tool.startsWith('seed_')) || (tool === 'hand' && !!(this.farm[k] && this.farm[k].c)); } // เครื่องมือ/การกระทำที่ถูกหยุดเมื่อเหนื่อย (นั่ง/เก็บไข่/ร้านค้า/ให้อาหารสัตว์ไม่ถูกหยุด)
  energyTick(dt) { // ฟื้นพลังงานทุกคนที่ออนไลน์ + ส่งค่าให้ client ทุก ~1 วินาทีเฉพาะคนที่ยังไม่เต็ม
    if (!S.ENERGY.on) return;
    this.enAcc = (this.enAcc || 0) + dt; const push = this.enAcc >= 1; if (push) this.enAcc = 0;
    for (const p of this.players.values()) {
      const e = this.enOf(p); if (e.v >= S.ENERGY.max && !e.ex) continue;
      e.v = Math.min(S.ENERGY.max, e.v + dt * 1000 / S.ENERGY.regenMs * (p.sit ? S.ENERGY.sitMul : 1)); e.at = Date.now(); this.dirty = true;
      if (e.ex && e.v >= S.ENERGY.resume) { e.ex = false; this.toast(p, '⚡ พักพอแล้ว กลับไปทำงานได้'); this.enPush(p); } else if (push) this.enPush(p);
    }
  }
  catJoin(p) { // ความอิ่มตัวของตลาดหมวดฟื้นตามเวลาจริงที่ผ่านไปแม้ออฟไลน์ (เหมือนพลังงาน) catAt = ครั้งล่าสุดที่คิดการฟื้น
    const ct = p.rec.cat, now = Date.now(), min = Math.max(0, (now - (p.rec.catAt || now)) / 60000), f = Math.pow(1 - S.CATFAT.recover, min);
    if (ct) for (const k of Object.keys(ct)) { ct[k] = 1 - (1 - ct[k]) * f; if (ct[k] > 0.995) delete ct[k]; }
    p.rec.catAt = now;
  }
  catOf(p, cat) { const o = p.rec.cat; return o && Number.isFinite(o[cat]) ? o[cat] : 1; }
  catPub(p) { const o = p.rec.cat || {}, c = {}; for (const k of Object.keys(o)) if (o[k] < 0.995) c[k] = Math.round(o[k] * 1000) / 1000; return { t: 'cat', c, recover: S.CATFAT.recover }; }
  catPush(p) { send(p, this.catPub(p)); }
  bankPush(p) { const b = this.bankOf(p); send(p, { t: 'bank', bal: b.bal, cap: S.BANK.cap }); }
  nearAtm(p) { return Math.hypot(p.x - (S.ATM.x + 0.5) * TS, p.y - (S.ATM.y + 0.5) * TS) < 4.5 * TS; }
  bankHandle(p, m) {
    if (!this.nearAtm(p)) return this.toast(p, 'ต้องอยู่ใกล้ตู้ ATM ที่ลานกองไฟ');
    const b = this.bankOf(p), want = m.amt === 'all' ? Infinity : m.amt | 0;
    if (!(want > 0)) return;
    if (m.a === 'dep') {
      const n = Math.min(want, p.rec.inv.coin || 0, S.BANK.cap - b.bal);
      if (n <= 0) return this.toast(p, b.bal >= S.BANK.cap ? `บัญชีเต็มแล้ว (เพดาน 🪙 ${S.BANK.cap})` : 'เหรียญไม่พอ');
      this.add(p, 'coin', -n, 'bank'); b.bal += n; this.toast(p, `ฝาก 🪙 ${n} เข้าบัญชีแล้ว (ยอดฝาก ${b.bal})`);
    } else if (m.a === 'wd') {
      const n = Math.min(want, b.bal);
      if (n <= 0) return this.toast(p, 'ไม่มีเงินให้ถอน');
      b.bal -= n; this.add(p, 'coin', n, 'bank'); this.toast(p, `ถอน 🪙 ${n} แล้ว (ยอดฝาก ${b.bal})`);
    } else return;
    this.sfxTo(p, 'coin'); this.dirty = true; this.bankPush(p);
  }
  loadVillage(d) {
    const v = d || {};
    this.village = { day: typeof v.day === 'string' ? v.day : '', n: Number.isFinite(v.n) ? Math.max(0, Math.floor(v.n)) : 0, peak: Number.isFinite(v.peak) ? Math.max(1, Math.floor(v.peak)) : 1, done: !!v.done, until: Number.isFinite(v.until) ? v.until : 0, by: Object.create(null) };
    for (const [k, x] of Object.entries(v.by || {})) if (Number.isFinite(x)) this.village.by[k] = x;
  }
  villageRoll() { const day = this.today(); if (this.village.day !== day) this.village = { day, n: 0, peak: Math.max(1, this.players.size), done: false, until: this.village.until, by: Object.create(null) }; }
  villageGoal() { return S.VILLAGE.base + S.VILLAGE.per * Math.max(1, this.village.peak); }
  happyOn() { return this.village.until > Date.now(); }
  villagePub() { this.villageRoll(); this.wkRoll(); return { wn: this.week.n, wgoal: this.wkGoal(), wdone: this.week.done, t: 'village', n: this.village.n, goal: this.villageGoal(), done: this.village.done, left: Math.max(0, this.village.until - Date.now()) }; }
  villageBump(p) { if (p) this.wkBump(p); // ทุกครั้งที่ใครช่วยงานของเมือง (นับรวมทุกคน) ครบเป้าของวัน = ทั้งเมืองติดบัฟ
    this.villageRoll(); const v = this.village; this.dirty = true;
    // มีคนเล่นวันนี้ ≥ 2 คน = คนเดียวนับได้ไม่เกิน maxShare ของเป้า ต้องมีผู้ช่วยจึงครบ (ถ้าวันนี้เล่นคนเดียวตลอด ไม่จำกัด)
    const cap = v.peak >= 2 ? Math.ceil(this.villageGoal() * S.VILLAGE.maxShare) : Infinity, who = p ? p.name : '';
    if (!p || (v.by[who] || 0) < cap) { v.n++; if (p) v.by[who] = (v.by[who] || 0) + 1; }
    if (!v.done && v.n >= this.villageGoal()) {
      v.done = true; v.until = Date.now() + S.VILLAGE.ms;
      const mins = Math.round(S.VILLAGE.ms / 60000);
      this.broadcast({ t: 'msg', text: `🎉 Happy Village! ทุกคนช่วยกันครบเป้าแล้ว ตกปลาไวขึ้นและหาไม้เนื้อแข็งง่ายขึ้นเป็นเวลา ${mins} นาที` });
      this.addLog(`🎉 Happy Village! เมืองช่วยกันทำงานครบ ${v.n} ครั้ง ติดบัฟร่วม ${mins} นาที`);
    }
    this.broadcast(this.villagePub());
  }

  // ----- ชาวเมือง NPC: เดินเล่นแถวบ้านตัวเอง และพิมพ์ข้อความให้อ่านเล่นๆ (ไม่ใช่ผู้เล่น ไม่มีเงิน/สถานะ) -----
  initNpcs() {
    this.npcs = NPC_DEFS.map((d, i) => {
      const n = { id: 1000001 + i, name: d.name, title: d.title, color: d.color, hat: d.hat, pc: d.pc, wear: Object.assign({}, S.WEAR_DEFAULT, d.wear), lines: d.lines, home: d.home, path: [], dir: 0, wait: rand(1, 4), lastLine: -1, sayAt: 0 };
      let spot = null; // หาจุดที่เดินได้ใกล้บ้าน
      for (let k = 0; k < 400 && !spot; k++) { const a = k * 2.4, rr = 0.5 + k * 0.05, x = (d.home[0] + 0.5 + Math.cos(a) * rr) * TS, y = (d.home[1] + 0.5 + Math.sin(a) * rr) * TS; if (!S.blockedAt(this.map, x, y)) spot = [x, y]; }
      n.x = n.tx = spot ? spot[0] : (d.home[0] + 0.5) * TS; n.y = n.ty = spot ? spot[1] : (d.home[1] + 0.5) * TS;
      return n;
    });
  }
  npcPub(n) { return { id: n.id, name: n.name, title: n.title, color: n.color, hat: n.hat, pc: n.pc, wear: n.wear, x: Math.round(n.x), y: Math.round(n.y), dir: n.dir }; }
  npcSay(n, now) {
    let i; do { i = Math.floor(Math.random() * n.lines.length); } while (i === n.lastLine && n.lines.length > 1);
    n.lastLine = i;
    const hour = Math.floor((now % S.CLOCK_MS) / S.CLOCK_MS * 24 + 6) % 24;
    const text = n.lines[i]
      .replace('{chest}', this.chest.coin).replace('{online}', this.players.size)
      .replace('{village}', `${this.village.n}/${this.villageGoal()}`).replace('{hour}', String(hour).padStart(2, '0') + ':00');
    this.broadcast({ t: 'chat', id: n.id, name: n.name, text, npc: 1 });
  }
  npcWalkable(x, y) { // ช่องที่ NPC เดินได้: ไม่ชน ไม่ใช่พื้นบ้าน (ไม่เดินเข้าบ้านคนอื่น) ไม่ใช่น้ำ
    if (x < 0 || y < 0 || x >= S.W || y >= S.H) return false;
    const t = this.map[y][x];
    return t !== T.FLOOR && t !== T.FURN && !S.blockedAt(this.map, (x + 0.5) * TS, (y + 0.5) * TS);
  }
  npcPlan(n) { // เลือกจุดหมายไกลๆ ที่เดินถึงจริง แล้วหาเส้นทางด้วย BFS (4 ทิศ)
    const W = S.W, sx = Math.floor(n.x / TS), sy = Math.floor(n.y / TS), prev = new Map(), q = [[sx, sy]], dist = new Map();
    prev.set(sy * W + sx, null); dist.set(sy * W + sx, 0);
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of S.DIRS) {
        const nx = x + dx, ny = y + dy, k = ny * W + nx;
        if (prev.has(k) || !this.npcWalkable(nx, ny)) continue;
        prev.set(k, [x, y]); dist.set(k, dist.get(y * W + x) + 1); q.push([nx, ny]);
      }
    }
    const far = q.filter(([x, y]) => dist.get(y * W + x) >= 8);
    const goal = (far.length ? far : q)[Math.floor(Math.random() * (far.length ? far.length : q.length))];
    const path = []; let c = goal;
    while (c && prev.get(c[1] * W + c[0]) !== null) { path.push(c); c = prev.get(c[1] * W + c[0]); }
    n.path = path.reverse();
  }
  npcTick(dt, now) {
    if (!this.players.size) return; // ไม่มีคนอยู่ NPC ก็พักเหมือนกัน
    for (const n of this.npcs) {
      if (!n.sayAt) n.sayAt = now + rand(6000, 14000);
      if (now >= n.sayAt) { // พูดห่างๆ: ต่อคน 45-110 วินาที และทั้งเมืองห่างกันอย่างน้อย gap (ไม่ให้พูดพร้อมกัน แต่ก็ไม่เหงา)
        if (now - (this.npcLastSay || 0) < S.NPC.gap) n.sayAt = now + rand(3000, 8000);
        else { n.sayAt = now + rand(S.NPC.sayMin, S.NPC.sayMax); this.npcLastSay = now; this.npcSay(n, now); }
      }
      if (!n.path || !n.path.length) {
        n.wait -= dt;
        if (n.wait <= 0) { n.wait = rand(2, 8); this.npcPlan(n); }
        continue;
      }
      const [wx, wy] = n.path[0], tx = (wx + 0.5) * TS, ty = (wy + 0.5) * TS, d = Math.hypot(tx - n.x, ty - n.y);
      if (d < 2) { n.path.shift(); continue; }
      const sp = Math.min(d, S.NPC.speed * dt), nx = n.x + (tx - n.x) / d * sp, ny = n.y + (ty - n.y) / d * sp;
      if (S.blockedAt(this.map, nx, ny)) { n.path = []; n.wait = 1; continue; } // มีของมาขวาง (เช่น เฟอร์นิเจอร์/ต้นไม้งอก) = หยุดแล้วหาทางใหม่
      n.dir = Math.abs(tx - n.x) > Math.abs(ty - n.y) ? (tx < n.x ? 2 : 3) : (ty < n.y ? 1 : 0);
      n.x = nx; n.y = ny;
    }
  }

  // ----- สัตว์เลี้ยงประกอบฉาก: แมว 1 ตัว (ห่างกองไฟไม่เกิน 15 ช่อง) หมา 2 ตัว (ไม่เกิน 20 ช่อง) เดินเล่นไปมา ทุกคนเห็นตรงกัน -----
  initPets() {
    const F = S.FIRE;
    this.pets = PET_DEFS.map((d, i) => {
      const p = { id: 2000001 + i, kind: d.kind, v: d.v, max: d.max, speed: d.speed, path: [], dir: 3, wait: rand(1, 4), moving: false };
      let spot = null;
      for (let k = 0; k < 400 && !spot; k++) { const a = k * 2.4 + i * 2, rr = 2 + k * 0.05, x = Math.floor(F.x + 0.5 + Math.cos(a) * rr), y = Math.floor(F.y + 0.5 + Math.sin(a) * rr); if (this.petOk(x, y, d.max)) spot = [x, y]; }
      spot = spot || [F.x, F.y + 2];
      p.x = p.tx = (spot[0] + 0.5) * TS; p.y = p.ty = (spot[1] + 0.5) * TS;
      return p;
    });
  }
  petPub(p) { return { id: p.id, kind: p.kind, v: p.v, x: Math.round(p.x), y: Math.round(p.y), dir: p.dir }; }
  petOk(x, y, max) { return this.npcWalkable(x, y) && Math.hypot(x - S.FIRE.x, y - S.FIRE.y) <= max; } // เดินได้ และอยู่ในรัศมี max ช่องจากกองไฟ
  petPlan(p) { // BFS เฉพาะช่องในรัศมี แล้วสุ่มจุดหมายห่างไป 3-14 ช่อง (เดินสั้นๆ ไปมา)
    const W = S.W, sx = Math.floor(p.x / TS), sy = Math.floor(p.y / TS), prev = new Map(), q = [[sx, sy]], dist = new Map();
    prev.set(sy * W + sx, null); dist.set(sy * W + sx, 0);
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of S.DIRS) {
        const nx = x + dx, ny = y + dy, k = ny * W + nx;
        if (prev.has(k) || !this.petOk(nx, ny, p.max)) continue;
        prev.set(k, [x, y]); dist.set(k, dist.get(y * W + x) + 1); q.push([nx, ny]);
      }
    }
    const mid = q.filter(([x, y]) => { const d = dist.get(y * W + x); return d >= 3 && d <= 14; });
    const pool = mid.length ? mid : q.slice(1);
    if (!pool.length) { p.path = []; return; }
    const goal = pool[Math.floor(Math.random() * pool.length)], path = []; let c = goal;
    while (c && prev.get(c[1] * W + c[0]) !== null) { path.push(c); c = prev.get(c[1] * W + c[0]); }
    p.path = path.reverse();
  }
  petTick(dt) {
    if (!this.players.size) return;
    for (const p of this.pets) {
      if (!p.path || !p.path.length) {
        p.moving = false; p.wait -= dt;
        if (p.wait <= 0) { p.wait = p.kind === 'cat' ? rand(3, 10) : rand(1.5, 6); this.petPlan(p); }
        continue;
      }
      const [wx, wy] = p.path[0], tx = (wx + 0.5) * TS, ty = (wy + 0.5) * TS, d = Math.hypot(tx - p.x, ty - p.y);
      if (d < 2) { p.path.shift(); continue; }
      const sp = Math.min(d, p.speed * dt), nx = p.x + (tx - p.x) / d * sp, ny = p.y + (ty - p.y) / d * sp;
      if (S.blockedAt(this.map, nx, ny)) { p.path = []; p.wait = 1; p.moving = false; continue; }
      p.dir = Math.abs(tx - p.x) > Math.abs(ty - p.y) ? (tx < p.x ? 2 : 3) : (ty < p.y ? 1 : 0);
      p.x = nx; p.y = ny; p.moving = true;
    }
  }

  // ----- เติบโต/ดึงให้กลับมาเล่น: คู่มือเริ่มต้น + สมุดสะสม + เข้าเกมติดต่อกัน + เป้าหมายรายสัปดาห์ของเมือง -----
  dayStr(offset) { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
  weekKey() { // สัปดาห์แบบ ISO (เริ่มวันจันทร์)
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const w1 = new Date(d.getFullYear(), 0, 4);
    return `${d.getFullYear()}-W${1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7)}`;
  }
  rareOfWeek() { return S.RARE[Math.floor(Date.now() / (7 * 864e5)) % S.RARE.length]; }

  starterOf(p) { // ผู้เล่นเก่าที่เล่นมานานแล้ว (ระดับการเล่น ≥ 8) ข้ามคู่มือเริ่มต้น
    return p.rec.starter || (p.rec.starter = { done: {}, final: S.playLevel(p.rec.skills) >= 8 });
  }
  starterStep(p, ev) { // event starter: sec = วินาทีนับจากเข้าเกมครั้งแรก (รวมเวลาออฟไลน์), ses = วินาทีนับจากเข้าเซสชันนี้
    const st = this.starterOf(p); if (st.final) return;
    let changed = false;
    for (const s of S.STARTER) if (s.ev === ev && !st.done[s.id]) { st.done[s.id] = 1; changed = true; logEv(this.room, 'starter', { p: p.key, step: s.id, n: Object.keys(st.done).length, sec: p.rec.firstSeen ? Math.round((Date.now() - p.rec.firstSeen) / 1000) : null, ses: Math.round((Date.now() - (p.joinedAt || Date.now())) / 1000), joins: p.rec.joins || 1 }); this.add(p, 'coin', s.coin, 'starter'); this.toast(p, `✅ คู่มือเริ่มต้น: ${s.hint} (+🪙${s.coin})`); }
    if (!changed) return;
    if (S.STARTER.every(s => st.done[s.id])) {
      st.final = true; this.add(p, 'coin', S.STARTER_FINAL.coin, 'starter'); for (const it of S.STARTER_FINAL.items) this.add(p, it, 1);
      this.addLog(`🎓 ${p.name} ผ่านคู่มือเริ่มต้นครบแล้ว!`);
      this.toast(p, `🎓 ผ่านคู่มือเริ่มต้นครบ! รับ 🪙${S.STARTER_FINAL.coin} + 🪑 เก้าอี้ + 🪴 ต้นไม้ (เปิดโหมดตกแต่งบ้านด้วยปุ่ม 🏠)`); this.sfxTo(p, 'levelup');
    }
    this.dirty = true; this.questPush(p);
  }

  bookOf(p) { const b = p.rec.book = p.rec.book || {}; for (const c of Object.keys(S.BOOK)) if (!b[c] || typeof b[c] !== 'object') b[c] = {}; return b; }
  bookAdd(p, cat, id) {
    const def = Object.hasOwn(S.BOOK, cat) && S.BOOK[cat]; if (!def || !def.ids.includes(id)) return;
    const b = this.bookOf(p); if (b[cat][id]) return;
    b[cat][id] = 1; this.dirty = true; this.add(p, 'coin', S.BOOK_ENTRY_COIN, 'book');
    const n = Object.keys(b[cat]).length;
    this.toast(p, `📖 สมุดสะสม${def.name}: ${n}/${def.ids.length} (+🪙${S.BOOK_ENTRY_COIN})`);
    if (n === def.ids.length) {
      const r = S.FURN[def.rare]; this.add(p, 'coin', def.coin, 'book'); this.add(p, 'furn_' + def.rare, 1);
      this.addLog(`📖 ${p.name} สะสม${def.name}ครบทุกชนิด!`);
      this.toast(p, `🏅 สมุดสะสม${def.name}ครบ! รับ 🪙${def.coin} + ${r.emoji} ${r.name}`); this.sfxTo(p, 'levelup');
    }
    this.questPush(p);
  }

  streakOnJoin(p) { // เข้าเกมติดต่อกัน: ได้เหรียญทุกวันที่เข้า ครบทุก 7 วันได้ของตกแต่งหายาก ขาดวันแล้วเริ่มนับใหม่
    const today = this.today(), o = p.rec.streak = p.rec.streak || { last: '', n: 0 };
    if (o.last === today) return;
    o.n = o.last === this.dayStr(-1) ? o.n + 1 : 1; o.last = today; this.dirty = true;
    let coin = 10 + 5 * Math.min(o.n, 7), extra = '';
    if (o.n % 7 === 0) { const rare = S.RARE[(o.n / 7 - 1) % S.RARE.length], r = S.FURN[rare]; coin += 100; this.add(p, 'furn_' + rare, 1); extra = ` + ${r.emoji} ${r.name}`; }
    this.add(p, 'coin', coin, 'streak');
    setTimeout(() => { if (p.ws.readyState === 1) this.toast(p, `🔥 เข้าเกมติดต่อกัน ${o.n} วัน! +🪙${coin}${extra}`); }, 2500);
  }

  loadWeek(d) {
    const w = d || {};
    this.week = { key: typeof w.key === 'string' ? w.key : '', n: Number.isFinite(w.n) ? Math.max(0, Math.floor(w.n)) : 0, done: !!w.done, by: Object.create(null), claimed: Object.create(null), cnt: Object.create(null) };
    for (const [k, v] of Object.entries(w.by || {})) if (Number.isFinite(v)) this.week.by[k] = v;
    for (const [k, v] of Object.entries(w.cnt || {})) if (Number.isFinite(v)) this.week.cnt[k] = v;
    for (const k of Object.keys(w.claimed || {})) this.week.claimed[k] = 1;
  }
  wkRoll() { const k = this.weekKey(); if (this.week.key !== k) this.week = { key: k, n: 0, done: false, by: Object.create(null), claimed: Object.create(null), cnt: Object.create(null) }; }
  wkGoal() { return S.WEEKLY.base + S.WEEKLY.per * Math.max(1, Object.keys(this.week.by).length); }
  wkBump(p) {
    this.wkRoll(); const w = this.week; w.by[p.name] = (w.by[p.name] || 0) + 1; this.dirty = true; // by = ครั้งที่ช่วยทั้งหมด (ใช้เช็ก minShare) cnt = ครั้งที่นับเข้าเป้า
    const cap = Object.keys(w.by).length >= 2 ? Math.ceil(this.wkGoal() * S.WEEKLY.maxShare) : Infinity;
    if ((w.cnt[p.name] || 0) < cap) { w.n++; w.cnt[p.name] = (w.cnt[p.name] || 0) + 1; }
    if (!w.done && w.n >= this.wkGoal()) {
      w.done = true;
      this.broadcast({ t: 'msg', text: '🏆 เป้าหมายรายสัปดาห์ของเมืองสำเร็จแล้ว! ใครมีส่วนร่วมไปรับรางวัลที่ 📰 ได้เลย' });
      this.addLog(`🏆 เมืองทำเป้าหมายรายสัปดาห์สำเร็จ (${w.n} ครั้ง)`);
    }
  }
  weeklyClaim(p) {
    this.wkRoll(); const w = this.week;
    if (!w.done) return this.toast(p, 'เป้าหมายรายสัปดาห์ยังไม่สำเร็จ ช่วยกันต่อนะ');
    if (w.claimed[p.key]) return this.toast(p, 'คุณรับรางวัลสัปดาห์นี้ไปแล้ว');
    if ((w.by[p.name] || 0) < S.WEEKLY.minShare) return this.toast(p, `ต้องช่วยงานอย่างน้อย ${S.WEEKLY.minShare} ครั้งในสัปดาห์นี้ถึงรับรางวัลได้ (คุณทำไป ${w.by[p.name] || 0})`);
    w.claimed[p.key] = 1; const rare = this.rareOfWeek(), r = S.FURN[rare];
    this.add(p, 'coin', S.WEEKLY.coin, 'weekly'); this.add(p, 'furn_' + rare, 1); this.dirty = true;
    this.addLog(`🎁 ${p.name} รับรางวัลเป้าหมายรายสัปดาห์ ${r.emoji} ${r.name}`);
    this.toast(p, `🎁 รางวัลสัปดาห์: 🪙${S.WEEKLY.coin} + ${r.emoji} ${r.name}`); this.sfxTo(p, 'levelup'); this.questPush(p);
  }

  cook(p, id) { // เชฟ (อาชีพที่ 5): ใช้วัตถุดิบข้ามสาย (ชนิดที่ถูกที่สุดก่อน) ทำอาหารขายได้แพงกว่าของดิบ ปลดสูตรตามเลเวลเชฟ ได้ XP เชฟ เตาต้องพักระหว่างจาน
    const r = typeof id === 'string' ? S.COOK.find(x => x.id === id) : null; if (!r) return;
    if (this.nearShopKind(p) !== 'food') return this.toast(p, 'ต้องยืนใกล้เคาน์เตอร์ร้านอาหารถึงจะทำอาหารได้');
    if (this.lv(p, 'cook') < r.lv) return this.toast(p, `สูตรนี้ปลดล็อกที่เชฟเลเวล ${r.lv} (ตอนนี้ ${this.lv(p, 'cook')}) — ทำเมนูง่ายขึ้นก่อนเพื่อเก็บเลเวล`);
    const now = Date.now();
    if (now < (p.cookReady || 0)) return this.toast(p, `เตายังร้อนอยู่ รออีก ${Math.ceil((p.cookReady - now) / 1000)} วินาที`);
    const inv = p.rec.inv, use = {};
    for (const need of r.in) {
      if (need.k) { if ((inv[need.k] || 0) < need.n) return this.toast(p, 'วัตถุดิบไม่พอ'); use[need.k] = (use[need.k] || 0) + need.n; continue; }
      if (need.u) { // ต้องเป็นปลาคนละชนิดกัน ชนิดละ 1 ตัว เริ่มจากชนิดที่ถูกที่สุด
        const kinds = Object.keys(inv).filter(k => inv[k] - (use[k] || 0) > 0 && S.cookCat(need.c, k)).sort((x, y) => S.itemInfo(x).sell - S.itemInfo(y).sell);
        if (kinds.length < need.n) return this.toast(p, `วัตถุดิบไม่พอ ต้องใช้ปลาคนละชนิดอย่างน้อย ${need.n} ชนิด`);
        for (const k of kinds.slice(0, need.n)) use[k] = (use[k] || 0) + 1;
        continue;
      }
      const own = Object.keys(inv).filter(k => inv[k] > 0 && S.cookCat(need.c, k)).sort((x, y) => S.itemInfo(x).sell - S.itemInfo(y).sell);
      let left = need.n;
      for (const k of own) { const take = Math.min(left, inv[k] - (use[k] || 0)); if (take > 0) { use[k] = (use[k] || 0) + take; left -= take; } if (!left) break; }
      if (left) return this.toast(p, 'วัตถุดิบไม่พอ');
    }
    const fee = Math.round(r.sell * S.COOK_FEE); // ค่าเช่าเตา: ครึ่งหนึ่งหายไปจากระบบ อีกครึ่งเข้ากองกลาง (TOWN.feeShare) กันครัวเป็นช่องสร้างเงินล้วนๆ
    if ((inv.coin || 0) < fee) return this.toast(p, `ค่าเช่าเตา 🪙 ${fee} เหรียญไม่พอ`);
    for (const [k, n] of Object.entries(use)) this.add(p, k, -n);
    this.add(p, 'coin', -fee, 'cookfee'); this.toChest(fee); this.add(p, r.id, 1);
    this.addXp(p, 'cook', r.xp); p.cookReady = now + r.time;
    this.toast(p, `👨‍🍳 ทำ ${r.emoji} ${r.name} สำเร็จ! (+${r.xp} XP เชฟ • ค่าเตา -🪙${fee} • ขายได้ราว 🪙${r.sell})`); this.sfx(p, 'collect');
    this.event(p, 'cook');
  }
  craft(p, id) { // ประดิษฐ์ที่เคาน์เตอร์ร้านช่างไม้: ใช้ไม้ที่หามาได้ ได้ของ + XP ช่างไม้
    const r = typeof id === 'string' ? S.CRAFT.find(x => x.id === id) : null; if (!r) return;
    if (this.nearShopKind(p) !== 'wood') return this.toast(p, 'ต้องยืนใกล้เคาน์เตอร์ร้านช่างไม้ถึงจะประดิษฐ์ได้');
    if (this.lv(p, 'wood') < r.lv) return this.toast(p, `ต้องเป็นช่างไม้เลเวล ${r.lv} ก่อน`);
    for (const [k, n] of Object.entries(r.in)) if ((p.rec.inv[k] || 0) < n) return this.toast(p, 'วัตถุดิบไม่พอ');
    for (const [k, n] of Object.entries(r.in)) this.add(p, k, -n);
    this.add(p, r.id, 1); this.addXp(p, 'wood', r.xp);
    const info = S.itemInfo(r.id); this.toast(p, `🔨 ประดิษฐ์ ${info.emoji} ${info.name} สำเร็จ! (+${r.xp} XP)`); this.sfx(p, 'collect');
    if (info.furn) this.bookAdd(p, 'furn', info.furn);
    this.event(p, 'craft');
  }

  // ----- ตลาดราคาไดนามิก: ขายเยอะราคาตก ปล่อยไว้ราคาค่อยๆ กลับ และทุก 1 วันในเกมราคาเป้าหมายสุ่มใหม่ (มีข่าวราคาพุ่ง/ตก) -----
  pmOf(p, k) { const o = p.rec.mk; return o && Number.isFinite(o[k]) ? o[k] : 1; }
  varN(p, k) { const day = this.today(), o = p.rec.sold; return (o && o.day === day ? o.items.length + (o.items.includes(k) ? 0 : 1) : 1); }
  effMultN(p, k, n) { const g = this.market[k]; return g ? g.m * this.pmOf(p, k) * this.catOf(p, S.sellCat(k)) * (1 + S.varietyBonus(n)) : 1; }
  effMult(p, k) { return this.effMultN(p, k, this.varN(p, k)); }
  mktFor(p) { const o = {}; for (const k of SELLABLE) o[k] = Math.round(this.effMult(p, k) * 100) / 100; return o; }
  mktSend(keys) { for (const p of this.players.values()) { const o = {}; for (const k of keys || SELLABLE) o[k] = Math.round(this.effMult(p, k) * 100) / 100; send(p, { t: 'mkt', m: o }); } }
  mktPub() { const o = {}; for (const k of SELLABLE) o[k] = Math.round(this.market[k].m * 100) / 100; return o; }
  marketTick(now) {
    if (!this.players.size) return; // โลกจำศีล: ไม่มีคนออนไลน์ ตลาดไม่เดิน
    const day = Math.floor(now / S.DAY_MS);
    if (day !== this.mktDay) {
      this.mktDay = day;
      for (const k of SELLABLE) this.market[k].t = Math.min(1.3, Math.max(0.75, 1 + (Math.random() - 0.5) * 0.4));
      const up = SELLABLE[Math.floor(Math.random() * SELLABLE.length)]; let dn = SELLABLE[Math.floor(Math.random() * SELLABLE.length)];
      if (dn === up) dn = SELLABLE[(SELLABLE.indexOf(up) + 1) % SELLABLE.length];
      this.market[up].t = 1.35; this.market[dn].t = 0.7;
      const iu = S.itemInfo(up), id = S.itemInfo(dn);
      const news = `📰 ข่าวตลาด: ${iu.emoji} ${iu.name}ราคาพุ่ง! • ${id.emoji} ${id.name}ราคาตก`; this.broadcast({ t: 'msg', text: news }); this.addLog(news);
      this.npcPostOrders(); // วันใหม่: NPC ตั้งใบสั่งซื้อประจำวันบนกระดาน (mktDay ถูกบันทึก จึงไม่ซ้ำตอนรีสตาร์ท)
    }
    this.orderExpire(now);
    for (const k of SELLABLE) { const o = this.market[k]; o.m = Math.min(S.MARKET.max, Math.max(S.MARKET.min, o.m + (o.t - o.m) * S.MARKET.recover)); }
    for (const p of this.players.values()) { const mk = p.rec.mk; if (!mk) continue; // ตลาดส่วนตัวค่อยๆ ฟื้นเฉพาะตอนออนไลน์
      for (const k of Object.keys(mk)) { mk[k] += (1 - mk[k]) * S.PMARKET.recover; if (mk[k] > 0.995 || !SELLABLE.includes(k)) delete mk[k]; } }
    for (const p of this.players.values()) { const ct = p.rec.cat; if (!ct) continue; for (const k of Object.keys(ct)) { ct[k] += (1 - ct[k]) * S.CATFAT.recover; if (ct[k] > 0.995) delete ct[k]; } p.rec.catAt = Date.now(); this.catPush(p); } // ความอิ่มตัวต่อหมวดฟื้นเฉพาะตอนออนไลน์
    this.dirty = true;
    this.mktSend();
  }
  sfx(p, k) { this.broadcast({ t: 'sfx', k, id: p.id, x: Math.round(p.x), y: Math.round(p.y) }); }
  sfxTo(p, k) { send(p, { t: 'sfx', k, id: p.id, x: Math.round(p.x), y: Math.round(p.y), self: 1 }); }

  zone(type) { const z = S.PENS[type] || S.PENS.chicken; return { x0: (z.x0 + 0.4) * TS, x1: (z.x1 + 0.6) * TS, y0: (z.y0 + 0.5) * TS, y1: (z.y1 + 0.5) * TS }; }
  hiveBox(i) { const [hx, hy] = S.BEE.hives[i]; return { x0: (hx - 0.6) * TS, x1: (hx + 1.6) * TS, y0: (hy - 0.6) * TS, y1: (hy + 1.6) * TS }; } // ผึ้งบินวนอยู่รอบรังของตัวเอง (ไม่ไกลเกิน 1 ช่อง)
  spawnAnimal(type) {
    const hive = type === 'bee' ? this.animals.filter(a => a.type === 'bee').length % S.BEE.hives.length : 0; // ผึ้งแต่ละตัวผูกกับรังหนึ่งลัง กระจายตามลำดับ
    const z = type === 'bee' ? this.hiveBox(hive) : this.zone(type), x = rand(z.x0, z.x1), y = rand(z.y0, z.y1);
    this.animals.push({ id: this.nextAid++, type, hive, x, y, tx: x, ty: y, wait: rand(0, 3), prod: false, fed: false, feeder: '', layAt: 0, dx: 1, hunger: 90, zero: 0 });
    this.dirty = true;
  }
  count(type) { return this.animals.filter(a => a.type === type).length; }

  // พืชเป็นของคนปลูก (t.o = key, t.on = ชื่อ): เก็บได้เฉพาะเจ้าของ แต่ถ้าสุกแล้วไม่มีใครมาเก็บครบ 1 วันในเกม (t.rm = เวลาที่สุกค้างอยู่ นับเฉพาะตอนมีคนออนไลน์) คนอื่นก็มาเก็บได้ ต้นเก่าที่ไม่มีเจ้าของ = ใครเก็บก็ได้
  cropLocked(t, p) { return !!(t.o && p.key !== t.o && (t.rm || 0) < S.DAY_MS); }
  pub(t, now) { return { c: t.c || null, s: t.c ? S.cropStage(t) : 0, w: t.wu > now ? 1 : 0, o: t.on || '', l: t.c && t.o && S.cropStage(t) === 3 && (t.rm || 0) < S.DAY_MS ? 1 : 0 }; }
  broadcast(o, except) {
    const s = JSON.stringify(o);
    for (const p of this.players.values()) if (p !== except && p.ws.readyState === 1) p.ws.send(s);
  }
  tileUpdate(k, t) {
    if (t) { t._p = JSON.stringify(this.pub(t, Date.now())); this.broadcast({ t: 'tile', k, v: JSON.parse(t._p) }); }
    else this.broadcast({ t: 'tile', k, v: null });
    this.dirty = true;
  }
  toast(p, text) { send(p, { t: 'msg', text }); }
  add(p, key, n, why) {
    const inv = p.rec.inv;
    if (key === 'coin' && n) logEv(this.room, 'coin', { p: p.key, n, why: why || 'other' });
    inv[key] = Math.max(0, (inv[key] || 0) + n);
    if (!inv[key] && key !== 'coin') delete inv[key];
    send(p, { t: 'inv', inv });
    this.dirty = true;
  }
  lv(p, skill) { return S.levelOf(p.rec.skills[skill]); }
  addXp(p, skill, n) {
    const r = p.rec.skills, before = S.levelOf(r[skill]);
    r[skill] = (r[skill] || 0) + n;
    send(p, { t: 'skills', skills: r });
    const after = S.levelOf(r[skill]);
    if (after > before) { logEv(this.room, 'level', { p: p.key, skill, lv: after }); this.toast(p, `🎉 ${S.SKILLS[skill].emoji} ${S.SKILLS[skill].name} เลเวล ${after}!`); this.addLog(`⭐ ${p.name} เลื่อนเป็น ${S.SKILLS[skill].emoji} ${S.SKILLS[skill].name} เลเวล ${after}`); this.sfxTo(p, 'levelup'); }
    this.dirty = true;
  }

  join(ws, name, color, admin) {
    name = Array.from(String(name || '').replace(/\s+/g, ' ').trim()).slice(0, 12).join('');
    if (!name) return { err: 'กรุณาใส่ชื่อตัวละคร' };
    const key = name.toLowerCase();
    if (!admin && this.banned && this.banned.has(key)) return { err: 'ชื่อนี้ถูกระงับโดยผู้ดูแล 🚫 กรุณาใช้ชื่ออื่น' };
    for (const q of this.players.values()) if (q.key === key) return { err: 'ชื่อนี้กำลังเล่นอยู่ ลองใช้ชื่ออื่น' };
    let rec = this.saved[key];
    if (!rec) rec = this.saved[key] = { firstSeen: Date.now(), inv: { coin: 50, seed_carrot: 5, feed: 5, bait: 10 }, mig2: true, x: S.START_SPAWN.x, y: S.START_SPAWN.y, color: HEX.test(color) ? color : '#3498db' };
    if (!rec.mig2) { rec.mig2 = true; rec.inv.bait = (rec.inv.bait || 0) + 10; } // แจกเหยื่อตกปลาชุดแรกให้ผู้เล่นเดิม (ระบบเหยื่อเพิ่งเพิ่ม)
    rec.name = name;
    if (!rec.firstSeen) rec.firstSeen = rec.lastSeen || Date.now(); // บัญชีเก่าก่อนมีตัวนับ: ใช้เวลาเข้าล่าสุดแทน (ใกล้เคียงเท่านั้น)
    if (!HEX.test(rec.color)) rec.color = '#3498db';
    if (!HEX.test(rec.hat)) rec.hat = DEFAULT_HAT;
    rec.skills = Object.assign({ farm: 0, fish: 0, animal: 0, wood: 0, cook: 0 }, rec.skills);
    if (!rec.inv.lamp) rec.lamp = false;
    rec.wear = Object.assign({}, S.WEAR_DEFAULT, rec.wear);
    if (!HEX.test(rec.pc)) rec.pc = S.PANTS_COLOR;
    if (!Number.isFinite(rec.hunger)) rec.hunger = S.PLAYER_HUNGER.start;
    for (const cat of Object.keys(S.WEAR)) { // ตรวจว่าสวมของที่ตัวเองมีจริง
      const it = S.WEAR[cat].find(x => x.id === rec.wear[cat]);
      if (!it || (it.price > 0 && !rec.inv[S.wearKey(cat, it.id)])) rec.wear[cat] = S.WEAR_DEFAULT[cat];
    }
    if (rec.pet && !(S.COMPANIONS[rec.pet] && rec.inv['pet_' + rec.pet])) rec.pet = ''; // พาไปได้เฉพาะสัตว์เลี้ยงที่ซื้อไว้จริง
    rec.pet = rec.pet || ''; rec.pmode = rec.pmode === 'play' ? 'play' : 'follow';
    if (S.blockedAt(this.map, rec.x, rec.y)) { rec.x = SPAWN.x; rec.y = SPAWN.y; }
    const p = { id: this.nextId++, ws, key, name, admin: !!admin, color: rec.color, hat: rec.hat, pc: rec.pc, wear: rec.wear, lamp: !!rec.lamp, pet: rec.pet, pm: rec.pmode, pax: rec.x, pay: rec.y, sit: null, title: this.titleOf(rec), rec, x: rec.x, y: rec.y, dir: 0, fish: null, lastChat: 0, lastAct: 0, activeAt: Date.now(), voice: false };
    this.players.set(p.id, p); p.joinedAt = Date.now(); rec.joins = (rec.joins || 0) + 1;
    logEv(this.room, 'join', { p: key, first: rec.joins === 1, joins: rec.joins, since: rec.firstSeen || null });
    const now = Date.now(), farm = {};
    for (const k in this.farm) farm[k] = this.pub(this.farm[k], now);
    send(p, {
      t: 'w', admin: !!admin, id: p.id, x: p.x, y: p.y, inv: rec.inv, skills: rec.skills, arc: this.arcPub(rec), hunger: Math.round(rec.hunger), dur: this.durPub(p), wtr: this.waterCur(p), cin: this.cinemaPub(), farm, time: now, room: this.room,
      trees: this.treeList(), npcs: this.npcs.map(n => this.npcPub(n)), pets: this.pets.map(q => this.petPub(q)),
      players: [...this.players.values()].filter(q => !q.scene).map(q => this.pubFull(q)),
    });
    send(p, { t: 'pst', pst: rec.pst || {}, names: rec.pnames || {} });
    send(p, { t: 'arcs', a: this.arcsPub() });
    send(p, { t: 'mkt', m: this.mktFor(p) });
    send(p, { t: 'proj', p: this.projPub() }); this.catJoin(p); this.catPush(p); this.enJoin(p); this.enPush(p);
    this.orderPush(p);
    send(p, { t: 'chatlog', list: this.chatLog }); this.starterOf(p); this.streakOnJoin(p); this.achCheck(p.rec); this.achPush(p); this.questPush(p); this.bankPush(p); this.villageRoll(); this.village.peak = Math.max(this.village.peak, this.players.size); send(p, this.villagePub()); send(p, { t: 'log', list: this.log }); send(p, { t: 'chest', c: this.chest });
    this.addLog(`👋 ${name} เข้ามาในเมือง`);
    this.sceneBroadcast(null, { t: 'p+', id: p.id, held: p.held || '', title: p.title, name, color: p.color, hat: p.hat, pc: p.pc, wear: p.wear, lamp: p.lamp, pet: p.pet, pm: p.pm, pax: p.pax, pay: p.pay, psick: !!(p.pet && this.petSt(p, p.pet).sick), pname: p.pet ? this.petName(p, p.pet) : '', x: p.x, y: p.y }, p);
    this.dirty = true;
    return { p };
  }
  leave(p) {
    this.arcLeave(p);
    this.tradeCancel(p, 'ผู้เล่นออกจากเกม');
    if (this.cinema.viewers.delete(p.id)) this.cinemaBroadcast();
    this.telFlush(p);
    logEv(this.room, 'leave', { p: p.key, sec: Math.round((Date.now() - (p.joinedAt || Date.now())) / 1000) });
    p.rec.catAt = Date.now();
    this.players.delete(p.id); this.addLog(`🚪 ${p.name} ออกไปแล้ว`);
    { const r = this.townPos(p); p.rec.x = r.x; p.rec.y = r.y; }
    this.sceneBroadcast(p.scene, { t: 'p-', id: p.id }, p);
    this.dirty = true;
  }

  handle(p, m) {
    if (p.scene && !HOUSE_MSG.has(m.t)) return;
    switch (m.t) {
      case 'm': {
        const x = +m.x, y = +m.y;
        if (!isFinite(x) || !isFinite(y)) return;
        const d = Math.hypot(x - p.x, y - p.y);
        if (d > 60 || this.blockedFor(p, x, y)) { send(p, { t: 'tp', x: p.x, y: p.y }); return; }
        if (d > 3 && p.fish) { p.fish = null; send(p, { t: 'fg', off: 1 }); this.toast(p, 'เลิกตกปลาแล้ว'); }
        if (p.sit && d > 3) p.sit = null; // เดินออกจากที่นั่ง = ลุก
        if (Math.hypot(x - p.x, y - p.y) > 0.5) p.activeAt = Date.now(); // ขยับจริงถึงนับว่ามีกิจกรรม (กันเงินฟรีตอนทิ้งตัวละครไว้)
        p.x = x; p.y = y;
        if (m.d >= 0 && m.d < 4) p.dir = m.d | 0;
        if (p.scene) { if (Math.floor(y / TS) >= S.HOUSE.y1 && S.HOUSE.door.includes(Math.floor(x / TS))) this.leaveHouse(p); break; } // เดินถึงประตูบ้าน = ออกไปเมือง
        this.arcRangeCheck(p);
        break;
      }
      case 'act': {
        if (p.scene) return this.houseAct(p, m);
        const now = Date.now();
        if (now - p.lastAct < 150) return;
        p.lastAct = p.activeAt = now;
        if (TOOLS.has(m.tool)) { p.workAt = now; this.broadcast({ t: 'use', id: p.id }, p); } // ใช้เครื่องมือ = กำลังทำกิจกรรม (ความหิวลดเร็วขึ้น) + ให้คนอื่นเห็นท่าแกว่ง
        if (m.tool === 'rod') p.baitSel = typeof m.bait === 'string' && /^bait(_[23])?$/.test(m.bait) ? m.bait : 'bait'; // เหยื่อที่เลือกไว้ที่ช่องเบ็ด
        if (TOOLS.has(m.tool)) this.act(p, m.tool, now, m.tx, m.ty);
        break;
      }
      case 'held': { // อุปกรณ์ที่ถืออยู่ (อีโมจิเดี่ยวเท่านั้น) ให้ผู้เล่นอื่นเห็นว่าใช้อะไรอยู่
        const e = String(m.e || ''); p.held = /^\p{Extended_Pictographic}\uFE0F?$/u.test(e) ? e : '';
        this.broadcast({ t: 'held', id: p.id, e: p.held }, p);
        break;
      }
      case 'status': { // สถานะของตัวเอง (ข้อความสั้นๆ แสดงใต้ตัวละคร)
        const now = Date.now(); if (now - (p.lastStatus || 0) < 800) return; p.lastStatus = now;
        p.status = Array.from(String(m.text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim()).slice(0, 30).join('');
        this.broadcast({ t: 'status', id: p.id, s: p.status });
        break;
      }
      case 'deaf': { // ผู้เล่นปิดเสียงทุกคน: ให้คนอื่นเห็นป้ายที่ตัวว่าไม่ได้ยินใคร
        p.deaf = !!m.on;
        this.broadcast({ t: 'deaf', id: p.id, on: p.deaf }, p);
        break;
      }
      case 'voice': {
        p.voice = !!m.on;
        this.broadcast({ t: 'voice', id: p.id, on: p.voice }, p);
        break;
      }
      case 'rtc': { // ส่งต่อข้อมูลเชื่อมต่อเสียง (WebRTC signaling) ระหว่างผู้เล่น
        const q = this.players.get(m.to | 0);
        if (q && q !== p && m.d && typeof m.d === 'object') send(q, { t: 'rtc', from: p.id, d: m.d });
        break;
      }
      case 'look': { // เปลี่ยนสี (เสื้อ/กางเกง/หมวก) และสวมเสื้อผ้าที่ซื้อไว้
        if (HEX.test(m.color)) p.color = p.rec.color = m.color;
        if (HEX.test(m.hat)) p.hat = p.rec.hat = m.hat;
        if (HEX.test(m.pc)) p.pc = p.rec.pc = m.pc;
        if (m.wear && typeof m.wear === 'object') {
          for (const cat of Object.keys(S.WEAR)) {
            const it = S.WEAR[cat].find(x => x.id === m.wear[cat]);
            if (it && (it.price === 0 || p.rec.inv[S.wearKey(cat, it.id)])) p.rec.wear[cat] = it.id; // สวมได้เฉพาะของฟรีหรือที่ซื้อแล้ว
          }
        }
        this.broadcastLook(p);
        this.dirty = true;
        break;
      }
      case 'eat': this.eat(p, m.item); break;
      case 'sellback': this.sellback(p, m.item); break;
      case 'pet': { const id = m.pet || ''; if (!id || p.rec.inv['pet_' + id] > 0) this.setPet(p, id, m.mode); break; }
      case 'petname': this.petRename(p, m.pet, m.name); break;
      case 'petcare': this.petCare(p, m.a); break; // เลือกสัตว์เลี้ยงที่จะพาไป หรือเก็บเข้าบ้าน
      case 'repair': this.repair(p, m.tool); break;
      case 'rebuy': this.rebuy(p, m.tool); break;
      case 'trade': this.tradeHandle(p, m); break;
      case 'house': this.houseHandle(p, m); break;
      case 'chest': this.chestHandle(p, m); break;
      case 'order': this.orderHandle(p, m); break;
      case 'proj': this.projHandle(p, m); break;
      case 'cook': this.cook(p, m.id); break;
      case 'craft': this.craft(p, m.id); break;
      case 'quest': this.questHandle(p, m); break;
      case 'bank': this.bankHandle(p, m); break;
      case 'cin': this.cinemaHandle(p, m); break;
      case 'lamp': { // เปิด/ปิดตะเกียงที่ถืออยู่ (ต้องมีตะเกียงในกระเป๋า)
        p.rec.lamp = p.lamp = !!m.on && !!p.rec.inv.lamp;
        this.broadcastLook(p); this.dirty = true;
        send(p, { t: 'look', id: p.id, color: p.color, hat: p.hat, pc: p.pc, wear: p.wear, lamp: p.lamp });
        break;
      }
      case 'chat': {
        const now = Date.now();
        const text = Array.from(String(m.text || '').trim()).slice(0, 80).join('');
        if (!text || now - p.lastChat < 500) return;
        p.lastChat = now;
        this.chatLog.push({ name: p.name, text, t: now }); if (this.chatLog.length > 10) this.chatLog.shift();
        this.broadcast({ t: 'chat', id: p.id, name: p.name, text });
        break;
      }
      case 'arc': this.arcHandle(p, m); break;
      case 'lb': this.sendLeaderboard(p); break;
      case 'buy': this.buy(p, m.item, Math.min(10, Math.max(1, m.n | 0))); break;
      case 'sell': this.sell(p, m.item, m.n); break;
    }
  }

  petSt(p, id) { const o = p.rec.pst || (p.rec.pst = {}); return o[id] || (o[id] = { h: 100, sick: false }); } // สถานะสัตว์เลี้ยงแต่ละตัว: h = ความอิ่ม 0-100, sick = ป่วย (เฉพาะตัวที่พาออกมาถึงจะหิว/ป่วย)
  petPubOf(p) { const id = p.pet || ''; return { t: 'pet', id: p.id, pet: id, mode: p.pm || 'follow', ax: Math.round(p.pax || 0), ay: Math.round(p.pay || 0), sick: !!(id && this.petSt(p, id).sick), name: id ? this.petName(p, id) : '' }; }
  petName(p, id) { const n = p.rec.pnames && p.rec.pnames[id]; return typeof n === 'string' ? n : ''; } // ชื่อที่เจ้าของตั้งให้สัตว์แต่ละตัว (ไม่เกิน 12 ตัวอักษร)
  petRename(p, id, name) {
    if (typeof id !== 'string' || !S.COMPANIONS[id] || !(p.rec.inv['pet_' + id] > 0)) return;
    name = Array.from(String(name || '').replace(/[\u0000-\u001f<>&"]/g, '').replace(/\s+/g, ' ').trim()).slice(0, 12).join('');
    (p.rec.pnames || (p.rec.pnames = {}))[id] = name; this.dirty = true;
    this.toast(p, name ? `ตั้งชื่อ${S.COMPANIONS[id].emoji}เป็น "${name}" แล้ว` : `ล้างชื่อ${S.COMPANIONS[id].emoji}แล้ว`);
    this.petPush(p);
  }
  petPush(p) { const o = this.petPubOf(p); this.broadcast(o, p); send(p, o); send(p, { t: 'pst', pst: p.rec.pst || {}, names: p.rec.pnames || {} }); }
  setPet(p, id, mode) { // id = ชนิดสัตว์เลี้ยงที่พาออกมา ('' = เก็บเข้าบ้าน) ต้องเป็นตัวที่ซื้อไว้แล้ว • mode: follow = เดินตาม, play = ปล่อยวิ่งเล่นรอบจุดที่ยืนอยู่
    id = typeof id === 'string' && S.COMPANIONS[id] && p.rec.inv['pet_' + id] > 0 ? id : '';
    p.rec.pet = p.pet = id; p.rec.pmode = p.pm = mode === 'play' ? 'play' : 'follow';
    p.pax = p.x; p.pay = p.y; this.dirty = true; this.petPush(p);
  }
  petCare(p, a) {
    const id = p.pet; if (!id) return this.toast(p, 'ยังไม่ได้พาสัตว์เลี้ยงออกมา');
    const st = this.petSt(p, id), C = S.COMPANIONS[id];
    if (a === 'feed') {
      if (!(p.rec.inv.petfood > 0)) return this.toast(p, 'ไม่มีอาหารสัตว์เลี้ยง ซื้อได้ที่ร้านสัตว์เลี้ยง');
      if (st.h >= 95) return this.toast(p, `${C.emoji} ${C.name}อิ่มอยู่แล้ว`);
      this.add(p, 'petfood', -1); st.h = Math.min(100, st.h + S.PETCARE.food);
      this.toast(p, `🦴 ให้อาหาร${C.emoji} ${C.name} (อิ่ม ${Math.round(st.h)}/100)`); this.sfx(p, 'eat');
    } else if (a === 'heal') {
      if (!st.sick) return this.toast(p, `${C.emoji} ${C.name}ไม่ได้ป่วย`);
      if (!(p.rec.inv.medicine > 0)) return this.toast(p, 'ไม่มียา 💊 ซื้อได้ที่ร้านสัตว์เลี้ยง');
      this.add(p, 'medicine', -1); st.sick = false; st.h = Math.max(st.h, 30);
      this.toast(p, `💊 รักษา${C.emoji} ${C.name}หายป่วยแล้ว!`); this.sfx(p, 'heal');
    } else return;
    this.dirty = true; this.petPush(p);
  }
  petTick15(p) { // ทุก 15 วินาที: สัตว์ที่พาออกมาหิวลง หิวจัดมีโอกาสป่วย (ไม่ตาย แค่เศร้าและเดินช้า)
    const id = p.pet; if (!id) return;
    const st = this.petSt(p, id), C = S.COMPANIONS[id], was = st.sick;
    st.h = Math.max(0, st.h - S.PETCARE.hungerTick);
    if (!st.sick && st.h < S.PETCARE.sickBelow && Math.random() < S.PETCARE.sickChance) { st.sick = true; this.toast(p, `🤒 ${C.emoji} ${C.name}ป่วยแล้ว! รักษาด้วยยา 💊 ในเมนู 🐾`); }
    if (st.sick !== was) this.petPush(p); else send(p, { t: 'pst', pst: p.rec.pst, names: p.rec.pnames || {} });
  }
  broadcastLook(p) { this.broadcast({ t: 'look', id: p.id, color: p.color, hat: p.hat, pc: p.pc, wear: p.wear, lamp: p.lamp }, p); }
  treeList() { const out = []; for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (S.isChoppable(this.map, x, y)) out.push([x, y]); return out; }
  // ---------- ความทนทานเครื่องมือ (รายจ่ายสม่ำเสมอ): ใช้ทุกครั้งสึก 1 หมดแล้วต้องซ่อมที่ร้านเสียเหรียญ ----------
  toolTier(p, tool) { const inv = p.rec.inv; return tool === 'rod' ? rodOf(inv) : tool === 'axe' ? (inv.axe_3 ? 3 : inv.axe_2 ? 2 : 1) : 1; }
  fixN(p, tool) { return (p.rec.fix && p.rec.fix[tool]) || 0; }
  durMx(p, tool) { return S.durMax(tool, this.toolTier(p, tool), this.fixN(p, tool)); }
  durCur(p, tool) { const mx = this.durMx(p, tool), d = p.rec.dur && p.rec.dur[tool]; return d === undefined ? mx : Math.max(0, Math.min(d, mx)); }
  durPub(p) { const o = {}; for (const t of Object.keys(S.DURABILITY)) o[t] = [this.durCur(p, t), this.durMx(p, t), this.fixN(p, t)]; return o; }
  // ---------- น้ำในบัวรดน้ำ: ตักจากสระได้ครั้งละตามความจุของบัว (S.CANS) แล้วต้องกลับไปตักใหม่ ----------
  canOf(p) { return S.CANS[S.canTier(p.rec.inv)]; }
  waterCur(p) { const cap = this.canOf(p).cap, w = p.rec.wtr; return w === undefined ? cap : Math.max(0, Math.min(w, cap)); }
  waterSet(p, n) { p.rec.wtr = n; send(p, { t: 'wtr', n }); this.dirty = true; }
  durOk(p, tool) {
    if (this.durCur(p, tool) > 0) return true;
    const D = S.DURABILITY[tool], sn = S.SHOPS[D.shop].name;
    this.toast(p, this.fixN(p, tool) >= S.REPAIR.maxFixes ? `💥 ${D.name}ซ่อมไม่ได้แล้ว! ต้องซื้อใหม่ที่${sn}` : `🔧 ${D.name}พังแล้ว! ซ่อมได้ที่${sn}`); return false;
  }
  durUse(p, tool) {
    const W = S.WEAR_RATE, now = Date.now(), H = (p.heat || (p.heat = {}))[tool] || (p.heat[tool] = { h: 0, t: now, carry: 0, warn: false });
    H.h = Math.max(0, H.h - (now - H.t) / 1000 * W.cool) + 1; H.t = now; // ใช้ถี่ๆ ต่อเนื่อง = ร้อนขึ้น พักแล้วเย็นลง
    H.carry += W.base * (1 + Math.min(W.maxBonus, H.h * W.perHeat));
    const take = Math.floor(H.carry); H.carry -= take;
    const before = this.durCur(p, tool), cur = Math.max(0, before - take), mx = this.durMx(p, tool), thr = Math.ceil(mx * 0.1);
    (p.rec.dur || (p.rec.dur = {}))[tool] = cur;
    send(p, { t: 'dur', d: this.durPub(p) }); this.dirty = true;
    if (cur <= 0) this.toast(p, this.fixN(p, tool) >= S.REPAIR.maxFixes ? `💥 ${S.DURABILITY[tool].name}พังจนซ่อมไม่ได้แล้ว! ต้องซื้อใหม่ที่ร้าน` : `🔧 ${S.DURABILITY[tool].name}พังแล้ว! ต้องซ่อมที่ร้านก่อนใช้ต่อ`);
    else if (before > thr && cur <= thr) this.toast(p, `⚠️ ${S.DURABILITY[tool].name}ใกล้พังแล้ว (เหลือ ${cur})`);
    if (H.h >= W.warnHeat && !H.warn) { H.warn = true; this.toast(p, `🔥 ใช้${S.DURABILITY[tool].name}ถี่และนานมาก จะสึกหรอไวกว่าปกติ (ยิ่งใช้ต่อเนื่องยิ่งไว สูงสุด 2 เท่า) พักสักครู่จะเย็นลง`); }
    else if (H.h < W.warnHeat * 0.4) H.warn = false;
  }
  toolShopCheck(p, tool) {
    const D = typeof tool === 'string' && Object.hasOwn(S.DURABILITY, tool) ? S.DURABILITY[tool] : null; if (!D) return null;
    if (this.nearShopKind(p) !== D.shop) { this.toast(p, `ต้องอยู่ที่${S.SHOPS[D.shop].name}ถึงจะซ่อม/ซื้อ${D.name}ได้`); return null; }
    return D;
  }
  repair(p, tool) {
    const D = this.toolShopCheck(p, tool); if (!D) return;
    const tier = this.toolTier(p, tool), n = this.fixN(p, tool), cur = this.durCur(p, tool);
    if (n >= S.REPAIR.maxFixes) return this.toast(p, `💥 ${D.name}ซ่อมครบ ${n} ครั้งแล้ว ซ่อมไม่ได้อีก ต้องซื้อใหม่ (🪙 ${S.toolPrice(tool, tier)})`);
    const nmx = S.durMax(tool, tier, n + 1);
    if (cur >= nmx) return this.toast(p, `${D.name}ยังสภาพดีอยู่`);
    const cost = S.repairCost(tool, tier, cur, n);
    if ((p.rec.inv.coin || 0) < cost) return this.toast(p, `เหรียญไม่พอ ค่าซ่อม 🪙 ${cost}`);
    this.add(p, 'coin', -cost, 'repair'); (p.rec.dur || (p.rec.dur = {}))[tool] = nmx; (p.rec.fix || (p.rec.fix = {}))[tool] = n + 1;
    send(p, { t: 'dur', d: this.durPub(p) });
    this.toast(p, `🔧 ซ่อม${D.name}เรียบร้อย (-🪙 ${cost}) ความทนทานสูงสุดเหลือ ${nmx}${n + 1 >= S.REPAIR.maxFixes ? ' • ซ่อมได้อีกไม่ได้แล้ว' : ''}`); this.sfxTo(p, 'coin'); this.dirty = true;
  }
  rebuy(p, tool) {
    const D = this.toolShopCheck(p, tool); if (!D) return;
    const tier = this.toolTier(p, tool), n = this.fixN(p, tool), cur = this.durCur(p, tool);
    if (!n && cur > 0) return this.toast(p, `${D.name}ยังใหม่อยู่ ไม่ต้องซื้อใหม่`);
    const cost = S.toolPrice(tool, tier);
    if ((p.rec.inv.coin || 0) < cost) return this.toast(p, `เหรียญไม่พอ ราคา 🪙 ${cost}`);
    this.add(p, 'coin', -cost, 'repair'); if (p.rec.dur) delete p.rec.dur[tool]; if (p.rec.fix) delete p.rec.fix[tool];
    send(p, { t: 'dur', d: this.durPub(p) }); this.toast(p, `🛒 ซื้อ${D.name}อันใหม่แล้ว (-🪙 ${cost}) ความทนทานเต็ม`); this.sfxTo(p, 'coin'); this.dirty = true;
  }

  // ---------- เทรดของระหว่างผู้เล่น: ของเท่านั้น (ไม่มีเหรียญ) มูลค่าฝั่งละไม่เกิน 1000 ต่อรอบ ทั้งสองฝ่ายต้องกดยืนยัน ----------
  tradeOf(p) { return p.tradeId ? this.trades.get(p.tradeId) : null; }
  tradeValue(offer) { let v = 0; for (const k in offer) v += S.tradeValue(k) * offer[k]; return v; }
  tradePub(tr, side) {
    const me = tr[side], ot = tr[side === 'a' ? 'b' : 'a'];
    return { t: 'trade', ev: 'state', open: tr.open, max: S.TRADE.maxValue, me: { offer: me.offer, ok: me.ok, value: this.tradeValue(me.offer) }, other: { id: ot.id, name: ot.name, offer: ot.offer, ok: ot.ok, value: this.tradeValue(ot.offer) } };
  }
  tradePush(tr) { for (const side of ['a', 'b']) { const q = this.players.get(tr[side].id); if (q) send(q, this.tradePub(tr, side)); } }
  tradeCancel(p, why) {
    const tr = this.tradeOf(p); if (!tr) return;
    this.trades.delete(tr.id);
    for (const side of ['a', 'b']) { const q = this.players.get(tr[side].id); if (q) { q.tradeId = 0; send(q, { t: 'trade', ev: 'closed', why: why || 'ยกเลิกการเทรด' }); } }
  }
  tradeHandle(p, m) {
    const tr = this.tradeOf(p), side = tr && tr.a.id === p.id ? 'a' : 'b';
    switch (m.a) {
      case 'req': {
        const q = this.players.get(m.to | 0);
        if (!q || q === p || tr || q.tradeId) return this.toast(p, !q ? 'ไม่พบผู้เล่นคนนั้น' : q.tradeId ? 'อีกฝ่ายกำลังเทรดกับคนอื่นอยู่' : 'คุณกำลังเทรดอยู่');
        if (Math.hypot(p.x - q.x, p.y - q.y) > S.TRADE.range * TS) return this.toast(p, `ต้องอยู่ใกล้กัน (ไม่เกิน ${S.TRADE.range} ช่อง) ถึงจะเทรดได้`);
        const t2 = { id: this.nextTrade++, a: { id: p.id, key: p.key, name: p.name, offer: {}, ok: false }, b: { id: q.id, key: q.key, name: q.name, offer: {}, ok: false }, open: false, t0: Date.now() };
        this.trades.set(t2.id, t2); p.tradeId = q.tradeId = t2.id; // จองคู่ไว้ก่อน (ยังไม่เปิดจนกว่าอีกฝ่ายตอบรับ)
        send(q, { t: 'trade', ev: 'req', from: { id: p.id, name: p.name } }); send(p, { t: 'trade', ev: 'wait', to: q.name });
        break;
      }
      case 'accept': if (tr && !tr.open && side === 'b') { tr.open = true; this.tradePush(tr); } break;
      case 'decline': case 'cancel': this.tradeCancel(p, m.a === 'decline' ? `${p.name} ปฏิเสธการเทรด` : `${p.name} ยกเลิกการเทรด`); break;
      case 'offer': {
        if (!tr || !tr.open) return;
        const k = m.item, q = Math.max(0, Math.min(9999, m.qty | 0)), me = tr[side];
        if (!S.isTradable(k)) return this.toast(p, 'ของชิ้นนี้เทรดไม่ได้ (เหรียญ/เสื้อผ้า/อุปกรณ์ผูกกับตัว)');
        const have = p.rec.inv[k] || 0, qty = Math.min(q, have);
        const next = Object.assign({}, me.offer); if (qty > 0) next[k] = qty; else delete next[k];
        if (this.tradeValue(next) > S.TRADE.maxValue) return this.toast(p, `มูลค่ารวมเกิน ${S.TRADE.maxValue} เหรียญต่อรอบ`);
        me.offer = next; tr.a.ok = tr.b.ok = false; // แก้ข้อเสนอแล้วต้องยืนยันใหม่ทั้งคู่
        this.tradePush(tr);
        break;
      }
      case 'ok': {
        if (!tr || !tr.open) return;
        tr[side].ok = !!m.on; this.tradePush(tr);
        if (tr.a.ok && tr.b.ok) this.tradeExecute(tr);
        break;
      }
    }
  }
  tradeExecute(tr) {
    const pa = this.players.get(tr.a.id), pb = this.players.get(tr.b.id);
    if (!pa || !pb) return this.tradeCancel(pa || pb, 'อีกฝ่ายหลุดจากเกม');
    for (const [p, offer] of [[pa, tr.a.offer], [pb, tr.b.offer]]) {
      if (this.tradeValue(offer) > S.TRADE.maxValue) return this.tradeCancel(pa, 'มูลค่าเกินลิมิต');
      for (const k in offer) if (!S.isTradable(k) || (p.rec.inv[k] || 0) < offer[k]) { tr.a.ok = tr.b.ok = false; this.toast(pa, 'ของในกระเป๋าเปลี่ยนไป กรุณาตรวจข้อเสนอใหม่'); this.toast(pb, 'ของในกระเป๋าเปลี่ยนไป กรุณาตรวจข้อเสนอใหม่'); return this.tradePush(tr); }
    }
    for (const k in tr.a.offer) { this.add(pa, k, -tr.a.offer[k]); this.add(pb, k, tr.a.offer[k]); }
    for (const k in tr.b.offer) { this.add(pb, k, -tr.b.offer[k]); this.add(pa, k, tr.b.offer[k]); }
    this.trades.delete(tr.id); pa.tradeId = pb.tradeId = 0;
    send(pa, { t: 'trade', ev: 'done', with: pb.name }); send(pb, { t: 'trade', ev: 'done', with: pa.name });
    this.sfxTo(pa, 'collect'); this.sfxTo(pb, 'collect'); this.dirty = true;
    this.event(pa, 'trade'); this.event(pb, 'trade');
  }

  // ---------- โรงหนังกลางแปลง: ฉายหนังเรื่องเดียวกันให้ทุกคนที่เข้าไปดู (ฝั่งผู้ชมเท่านั้นที่ได้ยินเสียง เพราะเสียงมาจากหน้าต่างหนังของตัวเอง) ----------
  cinemaPos(now) { const c = this.cinema; return c.playing ? c.pos + (now - c.ref) / 1000 : c.pos; }
  cinemaPub() { const c = this.cinema, now = Date.now(); return { movie: c.movie, yt: c.yt, name: c.name, startedAt: c.startedAt, playing: c.playing, pos: this.cinemaPos(now), now, viewers: [...c.viewers] }; }
  cinemaBroadcast(extra) { this.broadcast(Object.assign({ t: 'cin', st: this.cinemaPub() }, extra)); }
  cinemaEnd(msg) { const c = this.cinema; c.movie = null; c.yt = ''; c.name = ''; c.playing = false; c.viewers = new Set(); c.paid = new Set(); this.broadcast({ t: 'msg', text: msg || '🎬 หนังจบแล้ว ขอบคุณที่มาดูนะ' }); this.cinemaBroadcast(); }
  cinemaHandle(p, m) {
    const c = this.cinema, now = Date.now();
    if (m.a === 'sync') { // ผู้ชมคนไหนกด เล่น/หยุด/เลื่อน ทุกคนในโรงจะตามทันที
      if (!c.movie || !c.viewers.has(p.id) || now - (c.lastSync || 0) < 150) return;
      const pos = +m.pos; if (!isFinite(pos)) return;
      c.lastSync = now; c.pos = Math.max(0, Math.min(86400, pos)); c.ref = now; c.playing = !!m.playing;
      this.cinemaBroadcast({ sync: true, by: p.id }); return;
    }
    if (m.a === 'end') { if (c.movie && c.viewers.has(p.id) && this.cinemaPos(now) > 5) this.cinemaEnd(); return; }
    if (Math.hypot(p.x - S.CINEMA_CENTER.x, p.y - S.CINEMA_CENTER.y) > 12 * TS) return this.toast(p, 'เดินเข้าไปใกล้จอหนังอีกนิด');
    const payTicket = () => { if ((p.rec.inv.coin || 0) < S.TICKET) { this.toast(p, `เหรียญไม่พอซื้อตั๋ว (🪙 ${S.TICKET})`); return false; } this.add(p, 'coin', -S.TICKET); c.paid.add(p.key); this.toast(p, `🎟️ ซื้อตั๋วหนัง -🪙 ${S.TICKET}`); this.sfxTo(p, 'coin'); return true; };
    if (m.a === 'play') {
      if (c.movie) return this.toast(p, 'กำลังฉายเรื่องอื่นอยู่ รอให้จบก่อนนะ');
      let yt = '', name = '', id = 'custom';
      const mv = S.MOVIES.find(x => x.id === m.id);
      if (mv) { yt = mv.yt; name = mv.name; id = mv.id; }
      else { const u = String(m.url || '').trim(), g = /(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/.exec(u) || /^([A-Za-z0-9_-]{11})$/.exec(u); if (!g) return this.toast(p, 'ลิงก์ไม่ถูกต้อง ใช้ลิงก์ YouTube เท่านั้นนะ'); yt = g[1]; name = 'วิดีโอจากลิงก์ YouTube'; }
      c.paid = new Set(); if (!payTicket()) return;
      Object.assign(c, { movie: id, yt, name, startedAt: now, pos: 0, ref: now, playing: true, emptyAt: 0 }); c.viewers = new Set([p.id]);
      this.broadcast({ t: 'msg', text: `🎬 ${p.name} เปิดฉาย "${name}" ที่โรงหนังกลางแปลง! ไปดูกันได้ (ตั๋ว 🪙 ${S.TICKET})` });
      send(p, { t: 'cin', watch: true, st: this.cinemaPub() }); this.cinemaBroadcast();
    } else if (m.a === 'watch') {
      if (!c.movie) return;
      if (!c.paid.has(p.key) && !payTicket()) return;
      c.viewers.add(p.id); c.emptyAt = 0; send(p, { t: 'cin', watch: true, st: this.cinemaPub() }); this.cinemaBroadcast();
    } else if (m.a === 'leave') { if (c.viewers.delete(p.id)) this.cinemaBroadcast(); }
  }
  cinemaTick(now) {
    const c = this.cinema; if (!c.movie) return;
    const mv = S.MOVIES.find(x => x.id === c.movie);
    if (mv && this.cinemaPos(now) > mv.sec + 3) return this.cinemaEnd();
    if (!c.viewers.size) { if (!c.emptyAt) c.emptyAt = now; else if (now - c.emptyAt > EMPTY_MS) this.cinemaEnd('🎬 ไม่มีคนดูแล้ว ปิดโรงหนัง'); } else c.emptyAt = 0; // ไม่มีผู้ชมนานเกินไปก็ปิดรอบ
  }

  // ขายของที่ซื้อมาคืนร้าน ได้ 70% ของราคาซื้อ (หัก 30%)
  sellback(p, item) {
    const kind = this.nearShopKind(p);
    if (!kind || typeof item !== 'string' || !S.SHOPS[kind].buy.includes(item) || !(p.rec.inv[item] > 0)) return;
    const v = S.sellbackValue(item), info = S.itemInfo(item);
    if (!v) return;
    this.add(p, item, -1); this.add(p, 'coin', v, 'sellback');
    if (info.wear && p.rec.wear[info.wear.cat] === info.wear.id) p.rec.wear[info.wear.cat] = S.WEAR_DEFAULT[info.wear.cat];
    if (item === 'lamp') p.rec.lamp = p.lamp = false;
    if (info.pet && p.rec.pet === info.pet) this.setPet(p, Object.keys(S.COMPANIONS).find(c => p.rec.inv['pet_' + c] > 0) || '');
    if (info.can) this.waterSet(p, this.waterCur(p)); // ขายคืนบัวใหญ่ น้ำเกินความจุของบัวที่เหลือถูกตัด
    this.broadcastLook(p); send(p, { t: 'look', id: p.id, color: p.color, hat: p.hat, pc: p.pc, wear: p.wear, lamp: p.lamp });
    this.toast(p, `ขายคืน ${info.emoji} ${info.name} ได้ 🪙 ${v} (หัก 30%)`); this.sfxTo(p, 'coin');
  }
  setHunger(p, v, quiet) {
    const old = p.rec.hunger; p.rec.hunger = Math.max(0, Math.min(100, v));
    send(p, { t: 'hun', v: Math.round(p.rec.hunger) });
    if (!quiet) {
      if (old > 20 && p.rec.hunger <= 20 && p.rec.hunger > 5) this.toast(p, '🍗 เริ่มหิวแล้ว! ไปกินอะไรหน่อย (ร้านอาหาร หรือกินผลผลิตที่มี)');
      else if (old > 5 && p.rec.hunger <= 5 && p.rec.hunger > 0) this.toast(p, '⚠️ หิวมาก! เดินช้าลงแล้ว รีบหาอาหารกิน');
      else if (old > 0 && p.rec.hunger <= 0) this.toast(p, '😵 หิวจนไม่มีแรงทำงาน! ต้องกินอาหารก่อนถึงจะใช้เครื่องมือได้');
    }
    this.dirty = true;
  }
  eat(p, item) {
    const info = typeof item === 'string' && S.itemInfo(item);
    if (!info || !info.food || !p.rec.inv[item]) return;
    if (p.rec.hunger >= 99) return this.toast(p, 'อิ่มแล้ว กินไม่ลง 😋');
    const gain = Math.min(info.food, 100 - Math.round(p.rec.hunger));
    this.add(p, item, -1);
    this.setHunger(p, p.rec.hunger + info.food, true);
    if (S.ENERGY.on) { const e = this.enOf(p); e.v = Math.min(S.ENERGY.max, e.v + info.food * S.ENERGY.eatMul); if (e.ex && e.v >= S.ENERGY.resume) e.ex = false; this.enPush(p); }
    this.toast(p, `กิน ${info.emoji} ${info.name} (อิ่มขึ้น +${gain})`);
    this.sfx(p, 'eat'); if (item.startsWith('meal_')) this.bookAdd(p, 'meal', item.slice(5));
    this.event(p, 'eat');
  }

  nearWater(p, r = 2) { // มีช่องน้ำอยู่ในระยะ r ช่องรอบตัวผู้เล่นไหม
    const px = Math.floor(p.x / TS), py = Math.floor(p.y / TS);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (this.map[py + dy] && this.map[py + dy][px + dx] === T.WATER) return true;
    return false;
  }

  // ร้านที่ผู้เล่นยืนอยู่ใกล้เคาน์เตอร์ (หรือ null)
  nearShopKind(p) {
    for (const b of S.BUILDINGS) for (const [cx, cy] of b.counter) {
      if (!S.SHOPS[b.kind]) continue;
      if (Math.hypot(p.x - (cx + 0.5) * TS, p.y - (cy + 0.5) * TS) < 110) return b.kind;
    }
    return null;
  }

  buy(p, item, n) {
    const kind = this.nearShopKind(p);
    if (!kind || typeof item !== 'string' || !S.SHOPS[kind].buy.includes(item)) return;
    const info = S.itemInfo(item);
    if (!info || !info.buy) return;
    if (info.lv && this.lv(p, info.skill) < info.lv) return this.toast(p, `ต้องเป็น${S.SKILLS[info.skill].name}เลเวล ${info.lv} ก่อน`);
    if (info.once) { if (p.rec.inv[item]) return this.toast(p, 'คุณมีของชิ้นนี้อยู่แล้ว'); n = 1; }
    if (info.animal) {
      n = 1;
      if (this.count(info.animal) >= ANIMALS[info.animal].cap) return this.toast(p, `${ANIMALS[info.animal].name}เต็มทุ่งแล้ว`);
    }
    const cost = info.buy * n;
    if ((p.rec.inv.coin || 0) < cost) return this.toast(p, 'เหรียญไม่พอ');
    this.add(p, 'coin', -cost, 'buy');
    if (info.animal) { this.spawnAnimal(info.animal); this.toast(p, `ซื้อ${info.emoji} ${ANIMALS[info.animal].name}ตัวใหม่แล้ว!`); return; }
    this.add(p, item, n); if (info.furn) this.bookAdd(p, 'furn', info.furn);
    if (item === 'feed' || item === 'hay' || item === 'slop') this.event(p, 'buyfeed');
    if (info.can) this.waterSet(p, S.CANS[info.can].cap); // ซื้อบัวใหม่ได้น้ำเต็มให้เลย
    if (/^(rod|axe)_/.test(item)) { const tl = item.slice(0, 3); if (p.rec.dur) delete p.rec.dur[tl]; if (p.rec.fix) delete p.rec.fix[tl]; send(p, { t: 'dur', d: this.durPub(p) }); } // อุปกรณ์ใหม่ความทนทานเต็ม
    this.toast(p, `ซื้อ ${info.emoji} ${info.name}${n > 1 ? ' x' + n : ''}`);
    this.sfxTo(p, 'coin');
    if (info.wear) p.rec.wear[info.wear.cat] = info.wear.id; // ซื้อแล้วสวมให้เลย
    if (info.pet) this.setPet(p, info.pet);                  // ซื้อสัตว์เลี้ยงแล้วให้เดินตามเลย
    if (item === 'lamp') p.rec.lamp = p.lamp = true;         // ซื้อตะเกียงแล้วจุดให้เลย
    if (info.wear || item === 'lamp') { this.broadcastLook(p); send(p, { t: 'look', id: p.id, color: p.color, hat: p.hat, pc: p.pc, wear: p.wear, lamp: p.lamp }); }
  }
  sell(p, item, n) {
    const kind = this.nearShopKind(p);
    if (!kind || typeof item !== 'string' || !S.shopSells(kind, item)) return;
    const info = S.itemInfo(item), have = p.rec.inv[item] || 0;
    if (!info || !info.sell || !have) return;
    const q = n === 'all' || !(n > 0) ? have : Math.min(have, n | 0);
    const g = this.market[item], day0 = this.today(), items0 = p.rec.sold && p.rec.sold.day === day0 ? p.rec.sold.items : [];
    let nUsed = this.varN(p, item), mEff = this.effMultN(p, item, nUsed); // ตลาดกลาง × ส่วนตัว × โบนัสความหลากหลาย
    let quote = S.sellQuote(info.sell, mEff, q); // ขายหลายชิ้นต่อเนื่อง ราคาต่อชิ้นค่อยๆ ลดลง
    // ชนิดนี้นับเป็น "ชนิดที่ขายวันนี้" ได้เมื่อขายจริงจัง (≥ minQty ชิ้น หรือ ≥ minCoin เหรียญ) กันการขายอย่างละ 1 ชิ้นเพื่อเอาโบนัส
    const counted = items0.includes(item) || q >= S.VARIETY.minQty || quote.total >= S.VARIETY.minCoin;
    if (!counted) { nUsed = items0.length; mEff = this.effMultN(p, item, nUsed); quote = S.sellQuote(info.sell, mEff, q); }
    const cat = S.sellCat(item), pay = quote.total; // จ่ายต่อชิ้นตามชนิด ลดชิ้นละ 1% ของราคาฐานจนพื้น 20%
    this.add(p, item, -q);
    this.add(p, 'coin', pay, 'sell');
    const r = mEff > 0 ? Math.min(1, quote.m / mEff) : 1; // สัดส่วนที่ราคารวมลดลงจากการขายชุดนี้ ตลาดจำไว้เท่ากันไม่ว่าขายรวดหรือทยอย (แบ่งครึ่ง: ชนิด/ส่วนตัว กับ หมวด)
    { const ct = p.rec.cat = p.rec.cat || {}; ct[cat] = Math.max(S.CATFAT.min, this.catOf(p, cat) * Math.pow(r, 0.5)); }
    let bonusTxt = '';
    if (g) {
      const bonus = S.varietyBonus(nUsed), ri = Math.sqrt(r);
      g.m = Math.min(S.MARKET.max, Math.max(S.MARKET.min, g.m * Math.pow(ri, 1 - S.PMARKET.share)));
      const mk = p.rec.mk = p.rec.mk || {};
      mk[item] = Math.min(1, Math.max(S.PMARKET.min, this.pmOf(p, item) * Math.pow(ri, S.PMARKET.share)));
      const day = this.today(), so = p.rec.sold = p.rec.sold && p.rec.sold.day === day ? p.rec.sold : { day, items: [] };
      if (counted && !so.items.includes(item)) so.items.push(item);
      if (bonus > 0) bonusTxt = ` (โบนัสขายหลายชนิด +${Math.round(bonus * 100)}%)`;
      this.dirty = true; send(p, { t: 'mkt', m: this.mktFor(p) }); // ผู้ขายเห็นราคาใหม่ทุกชนิด (โบนัสหลากหลายเปลี่ยนทั้งชุด)
      for (const q2 of this.players.values()) if (q2 !== p) send(q2, { t: 'mkt', m: { [item]: Math.round(this.effMult(q2, item) * 100) / 100 } });
    }
    logEv(this.room, 'sell', { p: p.key, item, q, coin: pay, m: Math.round(mEff * 100) / 100, cat, base: info.sell * q });
    this.toast(p, `ขาย ${info.emoji} ${info.name} x${q} ได้ 🪙 ${pay}${bonusTxt}${this.catOf(p, cat) < 0.85 ? ` 📉 ตลาด${CAT_NAME[cat] || 'หมวดนี้'}อิ่มตัว (ราคา ${Math.round(this.catOf(p, cat) * 100)}%)` : ''}`); this.catPush(p); this.event(p, 'sell');
    if (S.SHOPS.animal.sell.includes(item)) this.event(p, 'sellproduct');
    this.sfxTo(p, 'coin');
  }

  act(p, tool, now, cx, cy) {
    const inv = p.rec.inv;
    // กำลังตกปลาอยู่: กดอีกครั้งเพื่อดึงเบ็ด
    if (p.fish) {
      if (p.fish.st === 'bite' && !S.gaugeHit(p.fish, now)) { // กดพลาดโซนกลาง ปลาหลุดทันที
        this.toast(p, '❌ กดไม่ตรงกลาง ปลาหลุดไปแล้ว!'); this.sfx(p, 'miss'); send(p, { t: 'fg', off: 1 }); p.fish = null; return;
      }
      if (p.fish.st === 'bite') {
        send(p, { t: 'fg', off: 1 });
        const fl = p.fish.fl, rod = p.fish.rod, G = S.FISH_GAUGE, perfect = S.gaugeCore(p.fish, now); // กดเป๊ะกลางโซน = อัตราปลาเต็ม / โดนแค่ขอบโซน = ปลาแพงเจอยากลง
        const rareCd = (p.rec.rareAt || 0) > Date.now(); // ปลาหายากเพิ่งตกได้ พักรอบก่อน (ยังตกปลาธรรมดาได้)
        const pool = FISH.filter(f => f.lv <= fl && !(rareCd && f.sell >= 100)).map(f => ({ f, w: f.w * (f.sell >= 100 ? 1 + 0.12 * (fl - 1) + 0.35 * (rod - 1) : 1) / (f.id === 'boot' ? 1 + rod : 1) * S.baitWeight(f, p.fish.bt || 1) * (perfect || f.id === 'boot' ? 1 : G.edgeMul[S.fishClass(f)]) })).filter(x => x.w > 0);
        let r = Math.random() * pool.reduce((a, x) => a + x.w, 0), f = pool[0].f;
        for (const x of pool) { if ((r -= x.w) < 0) { f = x.f; break; } }
        this.add(p, 'fish_' + f.id, 1);
        this.addXp(p, 'fish', f.xp); this.tire(p, 'fish', f.sell);
        if (f.sell >= 100) { p.rec.rareAt = Date.now() + S.ENERGY.rareCdMs; this.enPush(p); this.toast(p, `🐟 ปลาหายากพักรอบ ${Math.round(S.ENERGY.rareCdMs / 60000)} นาที (ตกปลาธรรมดาได้ตามปกติ)`); }
        this.toast(p, `${perfect ? '🎯 เป๊ะ! ' : ''}ได้ ${f.emoji} ${f.name}!`); if (f.sell >= 100) this.addLog(`${f.emoji} ${p.name} ตกได้${f.name}ตัวใหญ่!`);
        this.event(p, 'fish', f.sell); this.bookAdd(p, 'fish', f.id);
        this.sfx(p, f.sell >= 100 ? 'catch_big' : 'catch');
      } else { this.toast(p, 'ดึงเบ็ดเร็วไป ปลาไม่ทันกิน'); this.sfx(p, 'miss'); }
      p.fish = null;
      return;
    }
    let [tx, ty] = S.facing(p.x, p.y, p.dir);
    if (Number.isInteger(cx) && Number.isInteger(cy)) { // คลิกเลือกช่องเอง
      const px = Math.floor(p.x / TS), py = Math.floor(p.y / TS);
      const reach = tool === 'rod' && this.map[cy] && this.map[cy][cx] === T.WATER ? S.W : 2; // เบ็ดโยนไกลแค่ไหนก็ได้ถ้าเป็นน้ำ (แต่ต้องยืนริมสระ ดูด้านล่าง) ของอย่างอื่นต้องอยู่ใกล้
      if (cx < 0 || cy < 0 || cx >= S.W || cy >= S.H || Math.max(Math.abs(cx - px), Math.abs(cy - py)) > reach) {
        return this.toast(p, 'ไกลเกินไป เดินเข้าไปใกล้ๆ ก่อน');
      }
      tx = cx; ty = cy;
      const dx = cx - px, dy = cy - py;
      if (dx || dy) p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
    }
    const k = tx + ',' + ty;
    const tt = this.map[ty] && this.map[ty][tx];
    const tcx = (tx + 0.5) * TS, tcy = (ty + 0.5) * TS;
    if (this.exhausted(p) && this.heavyAction(tool, k) && tt !== T.SHOP) { const e = this.enOf(p), sec = Math.ceil((S.ENERGY.resume - e.v) * S.ENERGY.regenMs / (p.sit ? S.ENERGY.sitMul : 1) / 1000); return this.toast(p, `😮‍💨 เหนื่อยอยู่ พักอีกประมาณ ${sec} วินาทีถึงทำงานหนักได้ (นั่งที่ม้านั่งฟื้นไวขึ้น 3 เท่า)`); }
    if (p.rec.hunger <= 0 && tt !== T.SHOP) return this.toast(p, '😵 หิวจนไม่มีแรง! ไปกินอาหารก่อนนะ (ร้านอาหาร หรือกินผลผลิตจากกระเป๋า)');
    // 0) นั่งที่ม้านั่ง/กองฟาง/เก้าอี้ในลานกลางหมู่บ้าน
    const seat = S.seatAt(tx, ty);
    if (seat) {
      if ([...this.players.values()].some(q => q !== p && q.sit && q.sit.x === seat.x && q.sit.y === seat.y)) return this.toast(p, 'มีคนนั่งอยู่แล้ว');
      p.sit = { x: seat.x, y: seat.y }; p.x = (seat.x + 0.5) * TS; p.y = (seat.y + 0.5) * TS; p.dir = seat.face;
      send(p, { t: 'tp', x: p.x, y: p.y }); this.toast(p, '🪑 นั่งพักผ่อน... ความหิวไม่ลดและค่อยๆ อิ่มขึ้น (เดินเพื่อลุก)'); this.event(p, 'sit');
      return;
    }
    // 1) เก็บผลผลิตจากสัตว์ (ไข่/นม) ที่อยู่ใกล้ตัวหรือที่ช่องที่เลือก
    const near = this.animals.filter(a => a.prod && (Math.hypot(a.x - p.x, a.y - p.y) < 52 || Math.hypot(a.x - tcx, a.y - tcy) < 44));
    const prodLocked = a => !!(a.feeder && a.feeder !== p.key && (a.pm || 0) < S.DAY_MS); // ของคนเลี้ยงคนอื่น และยังไม่ครบ 1 วัน
    const prod = near.find(a => !prodLocked(a));
    if (!prod && near.length && !['feed', 'hay', 'slop', 'medicine'].includes(tool)) { // เหลือแต่ผลผลิตที่ล็อกอยู่ (ถ้ากำลังให้อาหาร/รักษาสัตว์ตัวอื่น ปล่อยให้ทำต่อ)
      const a0 = near[0]; return this.toast(p, `🔒 ${ANIMALS[a0.type].emoji} ผลผลิตนี้เป็นของ ${a0.fn || 'ผู้เลี้ยง'} • ถ้าเขาไม่มาเก็บภายใน 1 วัน (${Math.round(S.DAY_MS / 60000)} นาที) ใครก็เก็บได้`);
    }
    if (prod) {
      const A = ANIMALS[prod.type], info = S.itemInfo(A.product);
      prod.prod = false;
      const mine = prod.feeder && prod.feeder === p.key; // คนที่ให้อาหาร (เลี้ยง) ตัวนี้มาเก็บผลผลิตเอง
      this.add(p, A.product, 1);
      let extra = 0;
      if (mine) { this.addXp(p, 'animal', A.xp); if (Math.random() < 0.5) { extra = 1; this.add(p, A.product, 1); } } // เลี้ยงเอง = XP เต็ม + ลุ้นผลผลิตงาม ×2
      else { this.addXp(p, 'animal', Math.max(1, Math.floor(A.xp / 2))); if (prod.feeder) { this.toast(p, `🦊 เก็บผลผลิตของ ${prod.fn || 'ผู้เลี้ยง'} ที่ไม่มาเก็บเกิน 1 วัน`); this.addLog(`🔓 ${p.name} เก็บ${info.emoji} ${info.name}ของ ${prod.fn || 'ผู้เลี้ยง'} (หมดเวลาจอง 1 วัน)`); } } // คนอื่นเก็บได้เมื่อเจ้าของไม่มาเก็บครบ 1 วัน = XP ครึ่ง เจ้าของเสียผลผลิต
      prod.feeder = ''; prod.fn = ''; prod.pm = 0;
      this.event(p, 'collect');
      this.toast(p, `ได้${info.name} ${info.emoji}${mine ? (extra ? ' ×2 ✨ (คุณเลี้ยงเอง ได้ผลงาม!)' : ' (คุณเลี้ยงเอง)') : ''}`);
      this.sfx(p, 'collect');
      return;
    }
    // 2) เก็บเกี่ยว
    const tile = this.farm[k];
    if (tile && tile.c && S.cropStage(tile) === 3) {
      if (this.cropLocked(tile, p)) return this.toast(p, `🌱 ต้นนี้เป็นของ ${tile.on || 'ผู้เล่นอื่น'} — ถ้าเขาไม่มาเก็บภายใน ${Math.max(1, Math.ceil((S.DAY_MS - (tile.rm || 0)) / 60000))} นาที (1 วันในเกม) คนอื่นถึงจะมาเก็บได้`);
      const c = CROPS[tile.c];
      this.add(p, 'crop_' + tile.c, 1); this.addXp(p, 'farm', c.xp); this.tire(p, 'harvest', c.sell);
      this.toast(p, `เก็บ ${c.emoji} ${c.name}`);
      if (tile.o && tile.o !== p.key) this.addLog(`🔓 ${p.name} เก็บ${c.emoji} ${c.name}ของ ${tile.on || 'ผู้เล่นอื่น'} (หมดเวลาจอง 1 วัน)`); // ข่าว: ใครเก็บผลผลิตของคนอื่นที่ปลดล็อกแล้ว
      else if (c.sell >= 100) this.addLog(`${c.emoji} ${p.name} เก็บเกี่ยว${c.name}สำเร็จ`);
      this.sfx(p, 'harvest'); this.event(p, 'harvest', tile.c); this.bookAdd(p, 'crop', tile.c);
      delete tile.c; delete tile.g; delete tile.m; delete tile.o; delete tile.on; delete tile.rm; tile.idle = 0;
      this.tileUpdate(k, tile);
      return;
    }
    // 3) ตู้เกม
    if (tt === T.BUILD && S.cinemaAt(tx, ty)) { send(p, { t: 'cin', open: true, st: this.cinemaPub() }); return; } // จอหนังกลางแปลง
    const town = tt === T.SHOP ? S.townAt(tx, ty) : null;
    if (town) { if (town === 'board') this.orderPush(p); send(p, { t: 'town', w: town }); return; }
    const cab = tt === T.SHOP ? S.cabinetAt(tx, ty) : null;
    if (cab) { this.arcOpen(p, cab); return; }
    // 4) ร้านค้า
    const shop = tt === T.SHOP ? S.shopAt(tx, ty) : null;
    if (shop && !S.SHOPS[shop]) return;
    if (shop) { if (this.nearShopKind(p) === shop) send(p, { t: 'shop', kind: shop }); else this.toast(p, 'เดินเข้าไปใกล้เคาน์เตอร์อีกนิด'); return; }
    // 5) ใช้เครื่องมือ
    const feedTypes = Object.keys(ANIMALS).filter(k => ANIMALS[k].feedItem === tool); // อาหารชนิดเดียวใช้ได้หลายสัตว์ (ไก่+เป็ด, วัว+แกะ)
    if ((tool === 'hoe' || tool === 'rod' || tool === 'axe') && !this.durOk(p, tool)) return;
    if (tool === 'hoe') {
      if (tile) {
        if (tile.c) return this.toast(p, 'มีพืชอยู่ ขุดไม่ได้');
        delete this.farm[k]; this.tileUpdate(k, null); this.sfx(p, 'hoe'); this.durUse(p, 'hoe');
      } else if (tt === T.GRASS && S.inFarm(tx, ty)) {
        this.farm[k] = {}; this.tileUpdate(k, this.farm[k]); this.addXp(p, 'farm', 1); this.tire(p, 'dig'); this.sfx(p, 'hoe'); this.durUse(p, 'hoe'); this.event(p, 'dig');
      } else this.toast(p, 'ขุดได้เฉพาะในแปลงผัก');
    } else if (tool === 'water') {
      if (tt === T.WATER) { // ตักน้ำจากสระใส่บัวรดน้ำ
        if (!this.nearWater(p)) return this.toast(p, 'ต้องยืนริมสระน้ำถึงจะตักน้ำได้');
        const cap = this.canOf(p).cap;
        if (this.waterCur(p) >= cap) return this.toast(p, `💧 น้ำเต็มบัวแล้ว (${cap}/${cap})`);
        this.waterSet(p, cap); this.sfx(p, 'water'); return this.toast(p, `💧 ตักน้ำเต็มบัว (${cap}/${cap}) ไปรดน้ำได้เลย`);
      }
      if (!tile) return this.toast(p, 'ต้องขุดดินก่อน (หรือแตะสระน้ำเพื่อตักน้ำ)');
      const wl = this.waterCur(p);
      if (wl <= 0) return this.toast(p, '💧 น้ำหมดแล้ว! ไปตักน้ำที่สระ (กดช่อง 1 เลือกบัวรดน้ำ แล้วแตะน้ำ)');
      const dry = !(tile.wu > now);
      tile.wu = now + this.canOf(p).wet;
      this.waterSet(p, wl - 1);
      this.tileUpdate(k, tile); this.sfx(p, 'water');
      if (wl - 1 === 0) this.toast(p, '💧 น้ำหมดแล้ว ไปตักน้ำที่สระก่อนนะ');
      if (dry) { this.addXp(p, 'farm', 1); this.tire(p, 'water'); }
      if (dry && tile.c) { this.event(p, 'water'); this.addPts(p, 1); } // รดน้ำพืชที่แห้งจริงๆ เท่านั้นที่นับ
    } else if (tool.startsWith('seed_')) {
      if (!tile) return this.toast(p, 'ต้องขุดดินก่อน');
      if (tile.c) return this.toast(p, 'มีพืชอยู่แล้ว');
      if (!inv[tool]) return this.toast(p, 'เมล็ดหมด ไปซื้อที่ร้านเมล็ดพันธุ์');
      this.add(p, tool, -1);
      tile.c = tool.slice(5); tile.o = p.key; tile.on = p.name; tile.rm = 0; tile.g = 0; tile.m = 1 + 0.04 * (this.lv(p, 'farm') - 1);
      this.tileUpdate(k, tile); this.addXp(p, 'farm', 2); this.tire(p, 'plant'); this.sfx(p, 'plant'); this.event(p, 'plant');
    } else if (tool === 'rod') {
      if (tt !== T.WATER) return this.toast(p, 'ต้องเลือกช่องที่เป็นน้ำ');
      if (!this.nearWater(p)) return this.toast(p, 'ต้องยืนห่างจากสระน้ำไม่เกิน 2 ช่องถึงจะตกปลาได้');
      const bk = p.baitSel || 'bait', binfo = S.itemInfo(bk), bt = binfo ? binfo.bait : 1;
      if (binfo && binfo.lv && this.lv(p, 'fish') < binfo.lv) return this.toast(p, `ต้องเป็นชาวประมงเลเวล ${binfo.lv} ถึงจะใช้${binfo.name}ได้`);
      if (!(inv[bk] > 0)) return this.toast(p, `ไม่มี${binfo ? binfo.name : 'เหยื่อ'} ซื้อได้ที่ร้านตกปลา ${binfo ? binfo.emoji : '🪱'}`);
      this.add(p, bk, -1);
      const fl = this.lv(p, 'fish'), rod = rodOf(inv);
      const wait = rand(5500, 12000) * Math.max(0.4, 1 - 0.05 * (fl - 1)) * (1 - 0.12 * (rod - 1)) * (this.happyOn() ? S.VILLAGE.fishMul : 1);
      p.fish = { st: 'wait', at: now + wait, fx: tx * TS + 16, fy: ty * TS + 16, fl, rod, bt };
      this.sfx(p, 'cast'); this.durUse(p, 'rod');
    } else if (tool === 'axe') {
      const axe = inv.axe_3 ? 3 : inv.axe_2 ? 2 : inv.axe_1 ? 1 : 0;
      if (!axe) return this.toast(p, 'ต้องมีขวานก่อน ซื้อได้ที่ร้านช่างไม้ 🪓');
      if (!S.isChoppable(this.map, tx, ty)) return this.toast(p, 'ใช้ขวานฟันต้นไม้ 🌳 (ต้นไม้ขอบแมพตัดไม่ได้)');
      const key = tx + ',' + ty; let h = this.treeHp.get(key);
      if (!h || now - h.t > 20000) h = { hp: S.TREE_HP, t: now };
      h.hp -= S.AXES[axe].power; h.t = now;
      this.sfx(p, 'chop'); this.durUse(p, 'axe');
      if (h.hp > 0) { this.treeHp.set(key, h); return; }
      this.treeHp.delete(key); this.map[ty][tx] = T.GRASS; this.dirty = true;
      this.broadcast({ t: 'tree', x: tx, y: ty, on: false });
      const wl = this.lv(p, 'wood'), hard = Math.random() < S.WOOD.hardwood.chance + 0.01 * (wl - 1) + (this.happyOn() ? S.VILLAGE.hardBonus : 0), extra = Math.random() < 0.04 * (wl - 1) ? 1 : 0;
      this.add(p, 'log', 2 + extra); if (hard) this.add(p, 'hardwood', 1); // (4C) ต้นละ 2 ไม้ท่อน ดันรายได้ช่างไม้
      this.addXp(p, 'wood', S.WOOD.log.xp * (2 + extra) + (hard ? S.WOOD.hardwood.xp : 0)); this.tire(p, 'chop', (2 + extra) * S.WOOD.log.sell + (hard ? S.WOOD.hardwood.sell : 0));
      this.toast(p, `🌳 ต้นไม้ล้ม! ได้ 🪵 ไม้ท่อน x${2 + extra}${hard ? ' และ 🟫 ไม้เนื้อแข็ง!' : ''}`); this.sfx(p, 'fell'); this.event(p, 'chop'); if (hard) this.event(p, 'hardwood');
    } else if (tool === 'medicine') {
      const a = this.animals.filter(a => a.sick && (Math.hypot(a.x - tcx, a.y - tcy) < 52 || Math.hypot(a.x - p.x, a.y - p.y) < 52))
        .sort((a, b) => Math.hypot(a.x - tcx, a.y - tcy) - Math.hypot(b.x - tcx, b.y - tcy))[0];
      if (!a) return this.toast(p, 'ไม่มีสัตว์ป่วยอยู่ใกล้ๆ');
      if (!inv.medicine) return this.toast(p, 'ยาหมด ซื้อได้ที่ร้านปศุสัตว์ 💊');
      this.add(p, 'medicine', -1); a.sick = false; a.sickMs = 0;
      this.addLog(`💊 ${p.name} รักษา${ANIMALS[a.type].emoji} ${ANIMALS[a.type].name}ที่ป่วย`); this.addPts(p, 3); this.villageBump(p); this.addXp(p, 'animal', 6); this.toast(p, `💊 รักษา${ANIMALS[a.type].emoji} ${ANIMALS[a.type].name}หายป่วยแล้ว!`); this.sfx(p, 'heal');
    } else if (feedTypes.length) {
      let A = ANIMALS[feedTypes[0]];
      const a = this.animals
        // ให้อาหารได้เมื่อสัตว์ยังไม่ได้เริ่มผลิต หรือเมื่อหิวแล้ว (ความอิ่ม < 60) ที่หิวที่สุดก่อน
        .filter(a => feedTypes.includes(a.type) && (a.hunger < 60 || (!a.prod && !a.fed)) && (Math.hypot(a.x - tcx, a.y - tcy) < 52 || Math.hypot(a.x - p.x, a.y - p.y) < 52))
        .sort((a, b) => a.hunger - b.hunger || Math.hypot(a.x - tcx, a.y - tcy) - Math.hypot(b.x - tcx, b.y - tcy))[0];
      if (!a) return this.toast(p, 'ไม่มีสัตว์หิวอยู่ใกล้ๆ');
      A = ANIMALS[a.type];
      if (!inv[tool]) return this.toast(p, 'อาหารหมด ไปซื้อที่ร้านปศุสัตว์');
      this.add(p, tool, -1);
      if (a.hunger < 25) this.addLog(`🌾 ${p.name} ช่วยให้อาหาร${A.emoji} ${A.name}ที่หิวมาก`);
      if (a.hunger < 25) this.addPts(p, 2); else if (a.hunger < 60) this.addPts(p, 1); // ช่วยสัตว์ที่หิวจริงเท่านั้นได้แต้ม
      this.event(p, 'feed');
      a.hunger = 100; a.zero = 0; // อิ่มเต็ม และหลุดจากอันตรายอดตาย
      if (!a.fed && !a.prod) { a.fed = true; a.feeder = p.key; a.fn = p.name; a.layAt = now + rand(A.time[0], A.time[1]) * Math.max(0.5, 1 - 0.05 * (this.lv(p, 'animal') - 1)); } // จำคนที่เริ่มเลี้ยงรอบนี้ไว้ปันผลตอนเก็บ
      this.addXp(p, 'animal', 3);
      this.toast(p, `${A.name}กินอิ่มแล้ว ${A.emoji}`);
      this.sfx(p, 'feed_' + a.type);
    }
  }

  // ===================== ตู้เกม (Arcade): XO เดิมพันด้วยเหรียญ =====================
  newTable(id, c, idx) {
    return { id, idx, game: c.game, cx: c.x, cy: c.y, state: 'idle', bet: 0, host: null, guest: null, xId: null, oId: null,
      board: Array(9).fill(''), turn: 'X', deadline: 0, winner: null, line: null, msg: '', bot: false, watchers: new Set(), waitUntil: 0, resetAt: 0, botAt: 0, paid: false, g: null };
  }
  tablePub(t, vid) {
    const nm = id => (t.host && t.host.id === id ? t.host.name : t.guest && t.guest.id === id ? t.guest.name : '');
    return { id: t.id, game: t.game, state: t.state, bet: t.bet, bot: t.bot, host: t.host && { id: t.host.id, name: t.host.name }, guest: t.guest && { id: t.guest.id, name: t.guest.name },
      xId: t.xId, oId: t.oId, xName: nm(t.xId), oName: nm(t.oId), board: t.board, turn: t.turn, deadline: t.deadline, winner: t.winner, line: t.line, msg: t.msg,
      g: t.game === 'xo' || !t.g ? null : this.duelPub(t, vid) };
  }
  arcsPub() {
    return Object.values(this.tables).map(t => (t.game === 'uno' || PARTY.has(t.game) || t.game === 'bacc' || t.game === 'bj')
      ? [t.id, t.idx, t.state, t.bet, t.players[0] ? t.players[0].name : '', t.players.length + '/' + t.max, t.bot ? 1 : 0, t.game]
      : [t.id, t.idx, t.state, t.bet, t.host ? t.host.name : '', t.guest ? t.guest.name : '', t.bot ? 1 : 0, t.game]);
  }
  pubFor(t, id) { return t.game === 'uno' ? this.unoPub(t, id) : PARTY.has(t.game) ? this.partyPub(t, id) : (t.game === 'bacc' || t.game === 'bj') ? this.casinoPub(t, id) : this.tablePub(t, id); }
  pushTable(t, openFor) {
    const ids = (t.game === 'uno' || PARTY.has(t.game) || t.game === 'bacc' || t.game === 'bj')
      ? new Set([...t.players.filter(q => !q.bot).map(q => q.id), ...t.watchers])
      : new Set([t.host && t.host.id, t.guest && t.guest.id, ...t.watchers].filter(Boolean));
    for (const id of ids) {
      const q = this.players.get(id); if (!q) continue;
      const o = { t: 'arc', table: this.pubFor(t, id) };
      if (id === openFor) o.open = true;
      send(q, o);
    }
    this.broadcast({ t: 'arcs', a: this.arcsPub() });
  }
  inGame(p) {
    return Object.values(this.tables).some(t => (t.state === 'waiting' || t.state === 'playing') &&
      (t.game === 'uno' || PARTY.has(t.game) ? t.players.some(q => q.id === p.id && !q.out)
        : (t.game === 'bacc' || t.game === 'bj') ? t.players.some(q => q.id === p.id && !q.leaving)
        : (t.host && t.host.id === p.id) || (t.guest && t.guest.id === p.id)));
  }
  // จ่ายเหรียญให้ผู้เล่น (ออนไลน์หรือออฟไลน์ก็ได้)
  payKey(who, n) {
    if (!who || !n) return;
    const q = this.players.get(who.id);
    if (q && q.key === who.key) { this.add(q, 'coin', n, 'arcade'); return; }
    const rec = this.saved[who.key]; if (rec) { rec.inv.coin = (rec.inv.coin || 0) + n; this.dirty = true; }
  }
  who(p) { return { id: p.id, name: p.name, key: p.key }; }
  // เดิมพันกับบอท: กำไรสุทธิจากบอทต่อวันจำกัดไว้ (S.BOTBET.dailyWinCap) เพราะเงินฝั่งบอทคือเหรียญที่สร้างขึ้นใหม่
  botNetOf(key) { const rec = this.saved[key]; if (!rec) return null; const day = this.today(); if (!rec.botNet || rec.botNet.day !== day) rec.botNet = { day, net: 0 }; return rec.botNet; }
  botRemain(key) { const o = this.botNetOf(key); return o ? Math.max(0, S.BOTBET.dailyWinCap - o.net) : 0; }
  botNetAdd(key, d) { const o = this.botNetOf(key); if (o) { o.net += d; this.dirty = true; } }
  botBetOf(p, raw) { // คืนยอดเดิมพันที่ใช้ได้ หรือ -1 ถ้าไม่อนุญาต (แจ้งผู้เล่นแล้ว)
    const b = S.BOTBET.bets.includes(raw | 0) ? raw | 0 : 0;
    if (b && this.botRemain(p.key) <= 0) { this.toast(p, `วันนี้ได้กำไรจากบอทครบโควตา 🪙 ${S.BOTBET.dailyWinCap} แล้ว ซ้อมแบบไม่เดิมพันได้ หรือท้าเล่นกับเพื่อน`); return -1; }
    return b;
  }
  arcOpen(p, cab) {
    if (!cab.game) return this.toast(p, 'ตู้นี้ยังไม่เปิดให้เล่น เร็วๆ นี้!');
    const t = this.tables['cab' + cab.idx];
    if (!t) return;
    if (Math.hypot(p.x - (cab.x + 0.5) * TS, p.y - (cab.y + 0.5) * TS) > S.ARC_RANGE * TS) return this.toast(p, 'เดินเข้าไปใกล้ตู้เกมอีกนิด');
    t.watchers.add(p.id);
    send(p, { t: 'arc', open: true, table: this.pubFor(t, p.id) });
  }
  resetTable(t) {
    Object.assign(t, { state: 'idle', bet: 0, host: null, guest: null, xId: null, oId: null, board: Array(9).fill(''), turn: 'X', deadline: 0, winner: null, line: null, msg: '', bot: false, waitUntil: 0, resetAt: 0, botAt: 0, paid: false, g: null });
  }
  cancelWait(t, msg) {
    if (t.state !== 'waiting') return;
    if (t.bet) this.payKey(t.host, t.bet);
    const h = this.players.get(t.host.id);
    this.resetTable(t); t.msg = msg || '';
    this.pushTable(t);
    if (h) this.toast(h, msg || 'ยกเลิกห้องแล้ว คืนเหรียญให้แล้ว');
  }
  startGame(t) {
    const hostFirst = t.bot ? true : Math.random() < 0.5;
    t.xId = hostFirst ? t.host.id : t.guest.id; t.oId = hostFirst ? t.guest.id : t.host.id;
    Object.assign(t, { state: 'playing', board: Array(9).fill(''), turn: 'X', winner: null, line: null, msg: '', deadline: Date.now() + 30000, botAt: 0, paid: false, g: null });
    if (t.game !== 'xo') this.duelInit(t); // เกมอื่นที่เล่น 2 คน (เป่ายิ้งฉุบ/กดเร็ว/ป๊อก/Connect 4)
    this.pushTable(t);
  }
  checkXO(b) {
    for (const [a, c, d] of [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]) if (b[a] && b[a] === b[c] && b[a] === b[d]) return { win: b[a], line: [a, c, d] };
    return { win: null, draw: b.every(Boolean) };
  }
  finish(t, winner, line, msg) { // winner: 'X' | 'O' | 'draw'
    if (t.state !== 'playing') return;
    t.state = 'over'; t.winner = winner; t.line = line || null; t.resetAt = Date.now() + 15000; t.deadline = 0;
    const X = t.host.id === t.xId ? t.host : t.guest, O = t.host.id === t.xId ? t.guest : t.host;
    const bet = t.bet;
    if (winner === 'draw') { this.payKey(X, bet); this.payKey(O, bet); t.msg = msg || `เสมอ! คืนเหรียญ${bet ? ' 🪙 ' + bet : ''}`; }
    else {
      const W = winner === 'X' ? X : O, pot = bet * 2; let rake = Math.floor(pot * S.RAKE), got = pot - rake, capped = false; // หักค่าบริการตู้เกม 5% (ดูดเหรียญออกจากระบบ)
      if (t.bot && bet) { // เล่นกับบอท: ผู้ชนะเป็นคน → ไม่เกินโควตากำไรต่อวัน, บอทชนะ → คนเสียเดิมพัน
        const rem = this.botRemain(t.host.key);
        if (W === t.host) { if (got - bet > rem) { got = bet + rem; rake = pot - got; capped = true; } this.botNetAdd(t.host.key, got - bet); }
        else this.botNetAdd(t.host.key, -bet);
      }
      this.payKey(W, got); if (!t.bot) this.toChest(rake);
      t.msg = (msg ? `${msg} — ${W.name} ชนะ!` : `${W.name} ชนะ!`) + (bet && (!t.bot || W === t.host) ? ` ได้ 🪙 ${got}${rake ? ` (หักค่าบริการ ${rake})` : ''}${capped ? ' • ครบโควตากำไรจากบอทวันนี้' : ''}` : bet ? ` (เสียเดิมพัน 🪙 ${bet})` : '');
    }
    t.paid = true;
    if (!t.bot) { // แต้มตู้เกม: เฉพาะเล่นกับคนจริง (เสมอ = เล่น, ชนะ = เล่น+โบนัส)
      if (winner === 'draw') { this.arcAward(X.key, S.ARCPTS.play, false); this.arcAward(O.key, S.ARCPTS.play, false); }
      else { this.arcAward((winner === 'X' ? X : O).key, S.ARCPTS.play, true); this.arcAward((winner === 'X' ? O : X).key, S.ARCPTS.play, false); }
    }
    for (const side of ['X', 'O']) { // เสียงชนะ/แพ้ ให้ผู้เล่นที่ออนไลน์
      const who = side === 'X' ? X : O, q = this.players.get(who.id);
      if (q && who.key === q.key) this.sfxTo(q, winner === 'draw' ? 'draw' : winner === side ? 'win' : 'lose');
    }
    this.pushTable(t);
  }
  botMove(t) {
    const b = t.board, free = b.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
    const tryWin = s => free.find(i => { b[i] = s; const w = this.checkXO(b).win === s; b[i] = ''; return w; });
    let i = tryWin('O');
    if (i === undefined) i = tryWin('X');
    if (i === undefined && !b[4]) i = 4;
    if (i === undefined) i = free[Math.floor(Math.random() * free.length)];
    this.applyMove(t, 'O', i);
  }
  applyMove(t, side, i) {
    t.board[i] = side;
    const r = this.checkXO(t.board);
    if (r.win) return this.finish(t, side, r.line);
    if (r.draw) return this.finish(t, 'draw');
    t.turn = side === 'X' ? 'O' : 'X'; t.deadline = Date.now() + 30000;
    t.botAt = t.bot && t.turn === 'O' ? Date.now() + 700 : 0;
    this.pushTable(t);
  }
  arcHandle(p, m) {
    const t = typeof m.id === 'string' && Object.hasOwn(this.tables, m.id) ? this.tables[m.id] : null;
    if (!t) return;
    if (t.game === 'uno') return this.unoHandle(p, m, t);
    if (PARTY.has(t.game)) return this.partyHandle(p, m, t);
    if (t.game === 'bacc' || t.game === 'bj') return this.casinoHandle(p, m, t);
    const coin = p.rec.inv.coin || 0, now = Date.now();
    switch (m.a) {
      case 'close': t.watchers.delete(p.id); break;
      case 'create': case 'bot': {
        if (t.state !== 'idle' && t.state !== 'over') return this.toast(p, 'โต๊ะนี้ไม่ว่าง');
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        const bet = m.a === 'bot' ? this.botBetOf(p, m.bet) : (S.BETS.includes(m.bet | 0) ? m.bet | 0 : 0);
        if (bet < 0) return;
        if (coin < bet) return this.toast(p, 'เหรียญไม่พอสำหรับเดิมพันนี้');
        this.resetTable(t);
        if (bet) this.add(p, 'coin', -bet, 'arcade'); // กันเหรียญเดิมพันไว้ (escrow) จนจบเกม
        t.host = this.who(p); t.bet = bet; t.watchers.add(p.id);
        if (m.a === 'bot') { t.bot = true; t.guest = { id: 0, name: 'บอท 🤖', key: '' }; this.startGame(t); }
        else { t.state = 'waiting'; t.waitUntil = now + 180000; this.pushTable(t, p.id); }
        break;
      }
      case 'cancel': if (t.state === 'waiting' && t.host.id === p.id) this.cancelWait(t); break;
      case 'join': {
        if (t.state !== 'waiting' || t.host.id === p.id) return;
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        if (coin < t.bet) return this.toast(p, 'เหรียญไม่พอสำหรับเดิมพันนี้');
        if (t.bet) this.add(p, 'coin', -t.bet, 'arcade');
        t.guest = this.who(p); t.watchers.add(p.id); this.startGame(t);
        break;
      }
      case 'move': {
        if (t.game !== 'xo') { this.duelMove(t, p, m); break; }
        if (t.state !== 'playing' || !Number.isInteger(m.i) || m.i < 0 || m.i > 8 || t.board[m.i]) return;
        const side = p.id === t.xId ? 'X' : p.id === t.oId ? 'O' : null;
        if (!side || side !== t.turn) return;
        this.applyMove(t, side, m.i);
        break;
      }
      case 'resign': {
        if (t.state !== 'playing') return;
        const side = p.id === t.xId ? 'X' : p.id === t.oId ? 'O' : null;
        if (side) this.finish(t, side === 'X' ? 'O' : 'X', null, `${p.name} ยอมแพ้`);
        break;
      }
    }
  }
  arcLeaveTable(p, t) { // ออกจากโต๊ะนี้: ยกเลิกห้องที่รอ (คืนเหรียญ) หรือแพ้ถ้ากำลังเล่นอยู่
    t.watchers.delete(p.id);
    if (t.game === 'uno') { this.unoLeave(p, t); return; }
    if (PARTY.has(t.game)) { this.partyLeave(p, t); return; }
    if (t.game === 'bacc' || t.game === 'bj') { this.casinoDisconnect(p, t); return; }
    if (t.state === 'waiting' && t.host.id === p.id) this.cancelWait(t, `${p.name} ออกจากเกม ยกเลิกห้อง`);
    else if (t.state === 'playing' && (t.xId === p.id || t.oId === p.id)) this.finish(t, p.id === t.xId ? 'O' : 'X', null, `${p.name} ออกจากเกม`);
  }
  arcLeave(p) { for (const t of Object.values(this.tables)) this.arcLeaveTable(p, t); } // ผู้เล่นหลุด/ออกจากเกม
  arcSeated(p, t) { // นั่งอยู่ที่โต๊ะนี้ (ผู้เล่นจริง ไม่ใช่แค่ดู)
    if (t.game === 'uno' || PARTY.has(t.game) || t.game === 'bacc' || t.game === 'bj') return t.players.some(q => q.id === p.id);
    return !!((t.host && t.host.id === p.id) || (t.guest && t.guest.id === p.id) || t.xId === p.id || t.oId === p.id);
  }
  arcRangeCheck(p) { // เดินห่างจากตู้เกินระยะ = ออกจากโต๊ะทันที (คนที่นั่งเล่นอยู่นับเหมือนออกจากเกม แค่ดูอยู่ก็ปิดหน้าต่างให้)
    for (const t of Object.values(this.tables)) {
      const cab = S.CABINETS[t.idx]; if (!cab) continue;
      const seated = this.arcSeated(p, t);
      if (!seated && !t.watchers.has(p.id)) continue;
      if (Math.hypot(p.x - (cab.x + 0.5) * TS, p.y - (cab.y + 0.5) * TS) <= S.ARC_RANGE * TS) continue;
      this.arcLeaveTable(p, t);
      send(p, { t: 'arc', close: t.id });
      this.toast(p, seated ? `🚶 เดินห่างจากตู้เกินระยะ (${S.ARC_RANGE - 0.5} ช่อง) ออกจากโต๊ะให้แล้ว` : '🚶 เดินห่างจากตู้แล้ว ปิดหน้าตู้เกมให้');
    }
  }
  arcTick(now) {
    for (const t of Object.values(this.tables)) {
      if (t.game === 'uno') { this.unoTick(t, now); continue; }
      if (PARTY.has(t.game)) { this.partyTick(t, now); continue; }
      if (t.game === 'bacc' || t.game === 'bj') { this.casinoTick(t, now); continue; }
      if (t.state === 'waiting' && now > t.waitUntil) this.cancelWait(t, 'หมดเวลารอคู่แข่ง คืนเหรียญให้แล้ว');
      else if (t.state === 'playing' && t.game !== 'xo') this.duelTick(t, now);
      else if (t.state === 'playing') {
        if (t.botAt && now >= t.botAt) { t.botAt = 0; this.botMove(t); }
        else if (now > t.deadline) { const loser = t.turn; const pl = this.players.get(loser === 'X' ? t.xId : t.oId); this.finish(t, loser === 'X' ? 'O' : 'X', null, `${pl ? pl.name : loser} หมดเวลา`); }
      } else if (t.state === 'over' && now > t.resetAt) { this.resetTable(t); this.pushTable(t); }
    }
  }
  arcRefundAll() { // ตอนปิดเซิร์ฟเวอร์: คืนเงินเดิมพันที่ถูกกันไว้
    for (const t of Object.values(this.tables)) {
      if ((t.game === 'bacc' || t.game === 'bj') && t.phase === 'bet' && !t.practice) { for (const q of t.players) if (q.bet) this.payKey(q, q.bet.amt); continue; }
      if (!t.bet) continue;
      if (t.game !== 'uno' && !PARTY.has(t.game) && t.bot) { if (t.state === 'playing') this.payKey(t.host, t.bet); continue; }
      if (t.game === 'uno' || PARTY.has(t.game)) { if (t.state === 'waiting' || t.state === 'playing') for (const q of t.players) if (!q.bot) this.payKey(q, t.bet); continue; }
      if (t.state === 'waiting') this.payKey(t.host, t.bet);
      else if (t.state === 'playing') { this.payKey(t.host, t.bet); this.payKey(t.guest, t.bet); }
    }
  }

  // ===================== เกม 2 ฝ่าย: Connect 4 (XO ใช้ห้อง duel เดียวกัน) =====================
  // ใช้ห้อง/เดิมพัน/escrow/ค่าบริการ/ยอมแพ้/หลุดเกมร่วมกับ XO (ผู้เล่น X = เจ้าของห้องหรือสุ่ม, O = อีกฝ่าย) เก็บสถานะเฉพาะเกมไว้ใน t.g
  sideOf(t, id) { return id === t.xId ? 'X' : id === t.oId ? 'O' : null; }
  other(s) { return s === 'X' ? 'O' : 'X'; }
  sideName(t, s) { const id = s === 'X' ? t.xId : t.oId; return t.host && t.host.id === id ? t.host.name : t.guest ? t.guest.name : ''; }
  duelInit(t) {
    const now = Date.now();
    if (t.game === 'c4') { t.g = { board: Array(42).fill(''), turn: 'X', line: null, last: -1 }; t.deadline = now + 30000; }
  }
  duelPub(t, vid) {
    const g = t.g, side = this.sideOf(t, vid);
    if (t.game === 'c4') return { board: g.board, turn: g.turn, line: g.line, last: g.last };
    return null;
  }
  duelMove(t, p, m) {
    if (t.state !== 'playing' || !t.g) return;
    const side = this.sideOf(t, p.id), g = t.g; if (!side) return;
    if (t.game === 'c4') {
      if (g.turn !== side || !Number.isInteger(m.col) || m.col < 0 || m.col > 6) return;
      this.c4Drop(t, side, m.col);
    }
  }
  duelTick(t, now) {
    const g = t.g; if (!g) return;
    if (t.game === 'c4') {
      if (t.botAt && now >= t.botAt) { t.botAt = 0; this.c4Bot(t); }
      else if (now > t.deadline) { const loser = g.turn, pl = this.players.get(loser === 'X' ? t.xId : t.oId); this.finish(t, this.other(loser), null, `${pl ? pl.name : loser} หมดเวลา`); }
    }
  }
  // ---- Connect 4: 7 คอลัมน์ x 6 แถว เรียง 4 ตัวติดกันชนะ ----
  c4Win(b, side) {
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [];
      for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr > 5 || cc < 0 || cc > 6 || b[rr * 7 + cc] !== side) break; cells.push(rr * 7 + cc); }
      if (cells.length === 4) return cells;
    }
    return null;
  }
  c4Row(b, col) { for (let r = 5; r >= 0; r--) if (!b[r * 7 + col]) return r; return -1; }
  c4Drop(t, side, col) {
    const g = t.g, r = this.c4Row(g.board, col); if (r < 0) return;
    g.board[r * 7 + col] = side; g.last = r * 7 + col;
    const line = this.c4Win(g.board, side);
    if (line) { g.line = line; return this.finish(t, side, line); }
    if (g.board.every(Boolean)) return this.finish(t, 'draw');
    g.turn = this.other(side); t.deadline = Date.now() + 30000;
    t.botAt = t.bot && g.turn === 'O' ? Date.now() + 700 : 0;
    this.pushTable(t);
  }
  c4Bot(t) {
    const g = t.g, cols = [0, 1, 2, 3, 4, 5, 6].filter(c => this.c4Row(g.board, c) >= 0); if (!cols.length) return;
    const test = (c, s) => { const r = this.c4Row(g.board, c); g.board[r * 7 + c] = s; const w = !!this.c4Win(g.board, s); g.board[r * 7 + c] = ''; return w; };
    let pick = cols.find(c => test(c, 'O'));
    if (pick === undefined) pick = cols.find(c => test(c, 'X'));
    if (pick === undefined) pick = [...cols].sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3) + (Math.random() - 0.5))[0];
    this.c4Drop(t, 'O', pick);
  }

  // ===================== เกมหลายคน (ห้องแบบ UNO): ไพ่ป๊อก / ใครกดเร็วกว่า / เป่ายิ้งฉุบ =====================
  // 2–8 คน (เจ้าของห้องกดเริ่มเมื่อ ≥2) • เล่นคนเดียวกับบอทได้ • เติมบอทเข้าห้องได้ (เฉพาะห้องไม่เดิมพัน) • ผู้ชนะหาร pot (หักค่าบริการ) เสมอ = หารเท่ากัน
  // XO / Connect 4 ยังเป็นเกม 2 ฝ่าย (กระดานเล่นได้แค่ 2 คน) ใช้ห้อง duel เดิม
  partyBlank() { return { state: 'idle', bet: 0, max: 8, players: [], bot: false, deadline: 0, winner: '', winners: [], msg: '', waitUntil: 0, resetAt: 0, botAt: 0, g: null }; }
  newPartyTable(id, c, idx) { return Object.assign({ id, idx, game: c.game, cx: c.x, cy: c.y, watchers: new Set() }, this.partyBlank()); }
  resetParty(t) { Object.assign(t, this.partyBlank()); }
  partyPub(t, vid) {
    const g = t.g, me = t.players.find(q => q.id === vid);
    const o = { id: t.id, game: t.game, state: t.state, bet: t.bet, max: t.max, bot: t.bot, hostId: t.players[0] ? t.players[0].id : 0,
      players: t.players.map(q => ({ id: q.id, name: q.name, bot: q.bot, out: q.out, score: q.score || 0, done: !!(q.dec || q.pick) })),
      deadline: t.deadline, winner: t.winner, winners: t.winners, msg: t.msg, g: null };
    if (g) {
      if (t.game === 'pok') o.g = { phase: g.phase, msg: g.msg, mine: me ? me.hand : null, reveal: g.reveal ? t.players.map(q => ({ id: q.id, hand: q.hand, pts: this.pokPts(q.hand), pok: this.pokIs(q), deng: this.pokDeng(q.hand) })) : null };
      else if (t.game === 'react') o.g = { phase: g.phase, msg: g.msg, round: g.round, target: g.target, fs: me ? !!me.fs : false };
      else o.g = { phase: g.phase, msg: g.msg, round: g.round, target: g.target, mine: me ? me.pick : '', reveal: g.reveal };
    }
    return o;
  }
  partyHandle(p, m, t) {
    const coin = p.rec.inv.coin || 0, now = Date.now(), mine = t.players.find(q => q.id === p.id);
    const blank = { hand: [], dec: '', pick: '', score: 0, out: false, fs: false };
    const mkp = () => Object.assign({ id: p.id, name: p.name, key: p.key, bot: false }, blank, { hand: [] });
    const botP = i => Object.assign({ id: -i, name: `บอท ${i} 🤖`, key: '', bot: true }, blank, { hand: [] });
    switch (m.a) {
      case 'close': t.watchers.delete(p.id); break;
      case 'create': case 'bot': {
        if (t.state !== 'idle' && t.state !== 'over') return this.toast(p, 'โต๊ะนี้ไม่ว่าง');
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        const bot = m.a === 'bot', bet = bot ? this.botBetOf(p, m.bet) : (S.BETS.includes(m.bet | 0) ? m.bet | 0 : 0);
        if (bet < 0) return;
        if (coin < bet) return this.toast(p, 'เหรียญไม่พอสำหรับเดิมพันนี้');
        this.resetParty(t);
        if (bet) this.add(p, 'coin', -bet, 'arcade'); // กันเหรียญเดิมพันไว้ (escrow) จนจบเกม
        t.bet = bet; t.bot = bot; t.players = [mkp()]; t.watchers.add(p.id);
        if (bot) { for (let i = 1; i <= (t.game === 'pok' ? 3 : 2); i++) t.players.push(botP(i)); this.partyStart(t); } // เล่นคนเดียว: ป๊อกเจอบอท 3 ตัว ที่เหลือ 2 ตัว
        else { t.state = 'waiting'; t.waitUntil = now + 180000; this.pushTable(t, p.id); }
        break;
      }
      case 'join': {
        if (t.state !== 'waiting' || mine || t.players.length >= t.max) return;
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        if (coin < t.bet) return this.toast(p, 'เหรียญไม่พอสำหรับเดิมพันนี้');
        if (t.bet) this.add(p, 'coin', -t.bet, 'arcade');
        t.players.push(mkp()); t.watchers.add(p.id);
        if (t.players.length >= t.max) this.partyStart(t); else this.pushTable(t);
        break;
      }
      case 'addbot': { // เติมบอทเข้าห้องรอ (เฉพาะห้องที่ไม่เดิมพัน — กันเอาเหรียญเดิมพันไปเล่นกับบอท)
        if (t.state !== 'waiting' || !mine || t.players[0] !== mine || t.bet || t.players.length >= t.max) return;
        const n = t.players.filter(q => q.bot).length + 1; t.players.push(botP(n)); this.pushTable(t);
        break;
      }
      case 'leave': {
        if (t.state !== 'waiting' || !mine || t.players[0] === mine) return;
        if (t.bet) this.payKey(mine, t.bet);
        t.players = t.players.filter(q => q !== mine); this.pushTable(t);
        break;
      }
      case 'cancel': if (t.state === 'waiting' && t.players[0] && t.players[0].id === p.id) this.partyRefundAll(t); break;
      case 'startnow': {
        if (t.state !== 'waiting' || !t.players[0] || t.players[0].id !== p.id || t.players.length < 2) return;
        this.partyStart(t);
        break;
      }
      case 'move': if (t.state === 'playing' && mine && !mine.out) this.partyMove(t, mine, m); break;
      case 'resign': if (t.state === 'playing' && mine && !mine.out) this.partyOut(t, mine, 'ยอมแพ้'); break;
    }
  }
  partyStart(t) {
    for (const q of t.players) Object.assign(q, { hand: [], dec: '', pick: '', score: 0, out: false, fs: false });
    Object.assign(t, { state: 'playing', winner: '', winners: [], msg: '', botAt: 0, deadline: 0 });
    if (t.game === 'pok') this.pokStart(t);
    else if (t.game === 'react') { t.g = { phase: 'wait', round: 0, target: 2, goAt: 0, goTs: 0, next: 0, msg: '', botAt: {} }; this.reactStart(t); }
    else { t.g = { phase: 'pick', round: 0, rounds: 0, target: 2, reveal: null, next: 0, msg: '' }; this.rpsRound(t); }
  }
  partyMove(t, q, m) {
    if (t.game === 'pok') {
      const g = t.g; if (g.phase !== 'decide' || q.dec || !['draw', 'stay'].includes(m.c)) return;
      q.dec = m.c;
      if (t.players.filter(x => !x.out).every(x => x.dec)) this.pokResolve(t); else this.pushTable(t);
    } else if (t.game === 'react') this.reactPress(t, q);
    else {
      const g = t.g; if (g.phase !== 'pick' || q.pick || typeof m.c !== 'string' || m.c.length !== 1 || !'RPS'.includes(m.c)) return;
      q.pick = m.c;
      if (t.players.filter(x => !x.out).every(x => x.pick)) this.rpsReveal(t); else this.pushTable(t);
    }
  }
  // ผู้เล่นออก/ยอมแพ้ระหว่างเล่น: เดิมพันเขายังอยู่ใน pot, เขาไม่มีสิทธิ์ชนะ; เหลือคนเดียว (หรือเหลือแต่บอท) = จบเกม
  partyOut(t, q, why) {
    q.out = true; if (!q.dec) q.dec = 'stay'; if (!q.pick) q.pick = 'x';
    const el = t.players.filter(x => !x.out);
    if (el.length <= 1 || el.every(x => x.bot)) return this.partyFinish(t, el.length === 1 ? el : [], `${q.name} ${why}`);
    const g = t.g;
    if (t.game === 'pok' && g.phase === 'decide' && el.every(x => x.dec)) this.pokResolve(t);
    else if (t.game === 'rps' && g.phase === 'pick' && el.every(x => x.pick)) this.rpsReveal(t);
    else this.pushTable(t);
  }
  partyFinish(t, ws, desc) {
    if (t.state !== 'playing') return;
    const humans = t.players.filter(q => !q.bot), hw = ws.filter(q => !q.bot);
    const seats = t.bot ? t.players.length : humans.length, gross = t.bet * seats; let rake = Math.floor(gross * S.RAKE), pot = gross - rake; // เล่นกับบอท: บอทวางเดิมพันเท่าคน (เหรียญฝั่งบอทมาจากบ้าน)
    if (t.bot && t.bet && humans[0]) { const hk = humans[0].key; if (hw.length) { const rem = this.botRemain(hk); if (pot - t.bet > rem) { pot = t.bet + rem; rake = gross - pot; } this.botNetAdd(hk, pot - t.bet); } else this.botNetAdd(hk, -t.bet); }
    const share = hw.length ? Math.floor(pot / ws.length) : 0;
    for (const q of hw) this.payKey(q, share);
    if (!t.bot) this.toChest(rake);
    const names = ws.map(q => q.name).join(', ');
    Object.assign(t, { state: 'over', winners: ws.map(q => q.id), winner: names, resetAt: Date.now() + 20000, deadline: 0, botAt: 0 });
    t.msg = (ws.length > 1 ? `เสมอ! ${names} ร่วมชนะ` : ws.length ? `${names} ชนะ!` : 'ไม่มีผู้ชนะ') + (desc ? ` — ${desc}` : '') + (share ? ` ได้ 🪙 ${share}${rake ? ` (หักค่าบริการ ${rake})` : ''}` : '');
    for (const q of humans) { const o = this.players.get(q.id); if (o && o.key === q.key) this.sfxTo(o, ws.includes(q) ? 'win' : 'lose'); }
    if (!t.players.some(q => q.bot)) for (const q of humans) if (!q.out) this.arcAward(q.key, S.ARCPTS.play, ws.length === 1 && ws[0] === q); // แต้มตู้เกม: เฉพาะโต๊ะที่เล่นกับคนจริงล้วน (ไม่นับคนที่ออกกลางคัน)
    this.pushTable(t);
  }
  partyRefundAll(t, msg) {
    if (t.bet) for (const q of t.players) if (!q.bot) this.payKey(q, t.bet);
    const ids = t.players.filter(q => !q.bot).map(q => q.id);
    this.resetParty(t); t.msg = msg || '';
    this.pushTable(t);
    for (const id of ids) { const h = this.players.get(id); if (h) this.toast(h, msg || 'ยกเลิกห้องแล้ว คืนเหรียญให้แล้ว'); }
  }
  partyLeave(p, t) {
    const mine = t.players.find(q => q.id === p.id);
    if (!mine) return;
    if (t.state === 'waiting') {
      if (t.players[0] === mine) this.partyRefundAll(t, `${p.name} ออกจากเกม ยกเลิกห้อง`);
      else { if (t.bet) this.payKey(mine, t.bet); t.players = t.players.filter(q => q !== mine); this.pushTable(t); }
    } else if (t.state === 'playing' && !mine.out) this.partyOut(t, mine, 'ออกจากเกม');
  }
  partyTick(t, now) {
    if (t.state === 'waiting' && now > t.waitUntil) return this.partyRefundAll(t, 'หมดเวลารอผู้เล่น คืนเหรียญให้แล้ว');
    if (t.state === 'over' && now > t.resetAt) { this.resetParty(t); this.pushTable(t); return; }
    if (t.state !== 'playing' || !t.g) return;
    const g = t.g, el = t.players.filter(q => !q.out);
    if (t.game === 'pok') {
      if (g.phase === 'decide' && now > t.deadline) { for (const q of el) if (!q.dec) q.dec = 'stay'; this.pokResolve(t); }
    } else if (t.game === 'react') {
      if (g.phase === 'wait' && now >= g.goAt) {
        g.phase = 'go'; g.goTs = now; g.msg = 'กดเลย!'; g.botAt = {};
        for (const q of el) if (q.bot) g.botAt[q.id] = now + 450 + Math.random() * 500;
        this.pushTable(t);
      } else if (g.phase === 'go') {
        let first = null;
        for (const q of el) if (q.bot && !q.fs && g.botAt[q.id] && now >= g.botAt[q.id] && (!first || g.botAt[q.id] < g.botAt[first.id])) first = q;
        if (first) this.reactWin(t, first, Math.round(g.botAt[first.id] - g.goTs));
        else if (now - g.goTs > 4000) { g.msg = 'ไม่มีใครกด รอบนี้ไม่นับ'; this.reactStart(t); }
      } else if (g.phase === 'result' && now >= g.next) {
        const top = Math.max(...el.map(q => q.score));
        if (top >= g.target || g.round >= 12) this.partyFinish(t, el.filter(q => q.score === top), t.players.map(q => `${q.name} ${q.score}`).join(' • '));
        else this.reactStart(t);
      }
    } else {
      if (g.phase === 'pick' && now > t.deadline) this.rpsReveal(t);
      else if (g.phase === 'reveal' && now >= g.next) {
        const top = Math.max(...el.map(q => q.score));
        if (top >= g.target || g.rounds >= 10) this.partyFinish(t, el.filter(q => q.score === top), t.players.map(q => `${q.name} ${q.score}`).join(' • '));
        else this.rpsRound(t);
      }
    }
  }
  // ---- ไพ่ป๊อก: แจกคนละ 2 ใบ ใครมีป๊อก 8/9 เปิดไพ่ทันที ไม่งั้นเลือก "จั่วเพิ่ม" หรือ "อยู่" แล้วเทียบแต้ม • แต้มเท่ากันตัดสินด้วยเด้ง (สองใบดอก/เลขเดียวกัน ×2, สามใบดอกเดียวกัน ×3) • ยังเท่ากัน = หาร pot ----
  pokVal(c) { const r = c.slice(1); return r === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(r) ? 0 : +r; }
  pokPts(h) { return h.reduce((s, c) => s + this.pokVal(c), 0) % 10; }
  pokIs(q) { return q.hand.length === 2 && this.pokPts(q.hand) >= 8; }
  pokDeng(h) { const s = h.map(c => c[0]), r = h.map(c => c.slice(1)); if (h.length === 2) return s[0] === s[1] || r[0] === r[1] ? 2 : 1; return h.length === 3 && s[0] === s[1] && s[1] === s[2] ? 3 : 1; }
  pokStart(t) {
    const deck = [];
    for (const s of 'SHDC') for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) deck.push(s + r);
    this.unoShuffle(deck);
    t.g = { deck, phase: 'decide', reveal: false, msg: 'เลือกจั่วเพิ่มหรืออยู่' };
    for (const q of t.players) { q.hand = [deck.pop(), deck.pop()]; q.dec = ''; if (q.bot) { const pts = this.pokPts(q.hand); q.dec = pts <= 4 || (pts === 5 && Math.random() < 0.5) ? 'draw' : 'stay'; } }
    t.deadline = Date.now() + 15000;
    if (t.players.some(q => this.pokIs(q))) return this.pokResolve(t); // มีป๊อก เปิดไพ่ทันที
    this.pushTable(t);
  }
  pokResolve(t) {
    const g = t.g; if (!g || g.reveal) return;
    if (!t.players.some(q => this.pokIs(q))) for (const q of t.players) if (q.dec === 'draw' && !q.out) q.hand.push(g.deck.pop());
    g.reveal = true; g.phase = 'reveal';
    const el = t.players.filter(q => !q.out), key = q => [this.pokIs(q) ? 1 : 0, this.pokPts(q.hand), this.pokDeng(q.hand)];
    const cmp = (a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
    const best = el.reduce((b, q) => (!b || cmp(q, b) > 0 ? q : b), null);
    this.partyFinish(t, best ? el.filter(q => cmp(q, best) === 0) : [], t.players.map(q => `${q.name} ${this.pokPts(q.hand)} แต้ม${this.pokIs(q) ? ' (ป๊อก!)' : ''}${q.out ? ' (ออก)' : ''}`).join(' • '));
  }
  // ---- ใครกดเร็วกว่า: ใครกดก่อนสัญญาณ GO = ออกจากรอบนั้น, คนแรกที่กดหลังสัญญาณชนะรอบ, ใครชนะครบ 2 รอบก่อนเป็นผู้ชนะ ----
  reactStart(t) {
    const g = t.g, now = Date.now();
    Object.assign(g, { round: g.round + 1, phase: 'wait', goAt: now + 2000 + Math.random() * 4000, goTs: 0, botAt: {}, msg: 'รอสัญญาณ... อย่าเพิ่งกด!' });
    for (const q of t.players) q.fs = false;
    t.deadline = 0; this.pushTable(t);
  }
  reactPress(t, q) {
    const g = t.g, now = Date.now(); if (q.fs) return;
    if (g.phase === 'wait') {
      q.fs = true; g.msg = `${q.name} กดก่อนสัญญาณ! ออกจากรอบนี้`;
      if (!t.players.some(x => !x.out && !x.fs)) { g.msg = 'ทุกคนกดก่อนสัญญาณ รอบนี้ไม่นับ'; return this.reactStart(t); }
      this.pushTable(t);
    } else if (g.phase === 'go') this.reactWin(t, q, now - g.goTs);
  }
  reactWin(t, q, ms) {
    const g = t.g; q.score++; g.phase = 'result'; g.next = Date.now() + 2200;
    g.msg = `${q.name} กดเร็วที่สุด! (${ms} มิลลิวินาที) • ` + t.players.map(x => `${x.name} ${x.score}`).join(' • ');
    this.pushTable(t);
  }
  // ---- เป่ายิ้งฉุบ: ทุกคนเลือกพร้อมกัน เหลือ 2 แบบพอดี = ฝ่ายชนะได้ 1 แต้ม (เสมอ/ครบ 3 แบบ = เล่นรอบนั้นใหม่) ครบ 2 แต้มก่อนชนะ ----
  rpsRound(t) {
    const g = t.g, now = Date.now(); g.round++; g.phase = 'pick'; g.reveal = null; g.msg = 'เลือกหิน กรรไกร หรือกระดาษ';
    for (const q of t.players) q.pick = q.bot && !q.out ? 'RPS'[Math.floor(Math.random() * 3)] : (q.out ? 'x' : '');
    t.deadline = now + 10000; this.pushTable(t);
  }
  rpsReveal(t) {
    const g = t.g, now = Date.now(), alive = t.players.filter(q => !q.out), beats = { R: 'S', S: 'P', P: 'R' };
    for (const q of alive) if (!q.pick) q.pick = 'RPS'[Math.floor(Math.random() * 3)];
    g.reveal = {}; for (const q of alive) g.reveal[q.id] = q.pick;
    const set = [...new Set(alive.map(q => q.pick))];
    g.phase = 'reveal'; g.next = now + 2300; g.rounds++; t.deadline = 0;
    if (set.length !== 2) g.msg = 'เสมอ! เล่นรอบนี้ใหม่';
    else {
      const win = beats[set[0]] === set[1] ? set[0] : set[1], ws = alive.filter(q => q.pick === win);
      for (const q of ws) q.score++;
      g.msg = `${ws.map(q => q.name).join(', ')} ชนะรอบนี้! • ` + t.players.map(x => `${x.name} ${x.score}`).join(' • ');
    }
    this.pushTable(t);
  }

  // ===================== UNO (2-4 คน, เดิมพันด้วยเหรียญ, มีบอท) =====================
  // การ์ด = ตัวอักษรสี (R Y G B หรือ W=ไวลด์) + ค่า (0-9, S=ข้าม, R=กลับทิศ, D=+2, W=เปลี่ยนสี, F=+4 เปลี่ยนสี)
  newUnoTable(id, c, idx) {
    return Object.assign({ id, idx, game: 'uno', cx: c.x, cy: c.y, watchers: new Set() }, this.unoBlank());
  }
  unoBlank() {
    return { state: 'idle', bet: 0, max: 2, players: [], cur: 0, dir: 1, top: '', color: '', deck: [], discard: [], deadline: 0, drawn: -1,
      winner: '', msg: '', log: '', waitUntil: 0, resetAt: 0, botAt: 0, bot: false };
  }
  resetUno(t) { Object.assign(t, this.unoBlank()); }
  unoPub(t, vid) {
    const me = t.players.find(q => q.id === vid), curP = t.state === 'playing' ? t.players[t.cur] : null;
    return { id: t.id, game: 'uno', state: t.state, bet: t.bet, max: t.max, bot: t.bot, hostId: t.players[0] ? t.players[0].id : 0,
      players: t.players.map(q => ({ id: q.id, name: q.name, n: q.hand.length, out: q.out, bot: q.bot })),
      cur: curP ? curP.id : 0, top: t.top, color: t.color, dir: t.dir, deadline: t.deadline,
      hand: me ? me.hand : null, drawn: me && curP === me ? t.drawn : -1, winner: t.winner, msg: t.msg, log: t.log };
  }
  unoShuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  unoDeck() {
    const d = [];
    for (const c of 'RYGB') { d.push(c + '0'); for (let v = 1; v <= 9; v++) d.push(c + v, c + v); for (const s of 'SRD') d.push(c + s, c + s); }
    for (let i = 0; i < 4; i++) d.push('WW', 'WF');
    return this.unoShuffle(d);
  }
  unoName(c) { const col = { R: 'แดง', Y: 'เหลือง', G: 'เขียว', B: 'น้ำเงิน' }; return c[0] === 'W' ? (c[1] === 'F' ? 'Wild +4' : 'Wild') : `${col[c[0]]} ${c[1] === 'S' ? 'ข้าม' : c[1] === 'R' ? 'กลับทิศ' : c[1] === 'D' ? '+2' : c[1]}`; }
  unoDraw(t, q, n) {
    for (let i = 0; i < n; i++) {
      if (!t.deck.length) { // สับกองทิ้งกลับมาเป็นกองจั่ว (เหลือใบบนสุดไว้)
        if (t.discard.length <= 1) break;
        const top = t.discard.pop(); t.deck = this.unoShuffle(t.discard); t.discard = [top];
      }
      q.hand.push(t.deck.pop());
    }
  }
  unoPlayable(t, c) { return c[0] === 'W' || c[0] === t.color || (t.top[0] !== 'W' && c[1] === t.top[1]); }
  unoNext(t, from, steps) {
    const n = t.players.length; let i = from;
    for (let s = 0; s < steps; s++) { do { i = (i + t.dir + n) % n; } while (t.players[i].out); }
    return i;
  }
  unoActive(t) { return t.players.filter(q => !q.out); }
  unoStart(t) {
    const now = Date.now();
    t.deck = this.unoDeck(); t.discard = [];
    for (const q of t.players) { q.hand = []; q.out = false; q.tmo = 0; this.unoDraw(t, q, 7); }
    let k = t.deck.length - 1; while (k > 0 && !/^[RYGB]\d$/.test(t.deck[k])) k--; // ใบเปิดต้องเป็นเลข
    t.top = t.deck.splice(k, 1)[0]; t.discard = [t.top]; t.color = t.top[0];
    Object.assign(t, { state: 'playing', cur: 0, dir: 1, drawn: -1, winner: '', msg: '', log: `เริ่มเกม! ใบเปิด: ${this.unoName(t.top)}`, deadline: now + 30000 });
    t.botAt = t.players[0].bot ? now + 900 : 0;
    this.pushTable(t);
  }
  unoAdvance(t, skip) {
    const now = Date.now();
    t.cur = this.unoNext(t, t.cur, 1 + (skip || 0)); t.drawn = -1; t.deadline = now + 30000;
    t.botAt = t.players[t.cur].bot ? now + 900 : 0;
    this.pushTable(t);
  }
  unoFinish(t, w) {
    const humans = t.players.filter(q => !q.bot), seats = t.bot ? t.players.length : humans.length, gross = t.bet * seats; let rake = Math.floor(gross * S.RAKE), pot = gross - rake; // เล่นกับบอท: บอททุกที่นั่งวางเดิมพันเท่าคน (เงินบ้าน)
    if (t.bot && t.bet && humans[0]) { const hk = humans[0].key; if (w === humans[0]) { const rem = this.botRemain(hk); if (pot - t.bet > rem) { pot = t.bet + rem; rake = gross - pot; } this.botNetAdd(hk, pot - t.bet); } else this.botNetAdd(hk, -t.bet); }
    Object.assign(t, { state: 'over', winner: w.name, resetAt: Date.now() + 20000, deadline: 0, botAt: 0 });
    if (!w.bot) this.payKey(w, pot);
    if (!t.bot) this.toChest(rake);
    t.msg = `${w.name} ชนะ!` + (pot ? ` ได้ 🪙 ${pot}${rake ? ` (หักค่าบริการ ${rake})` : ''}` : '');
    for (const q of humans) { const o = this.players.get(q.id); if (o && o.key === q.key) this.sfxTo(o, q === w ? 'win' : 'lose'); }
    if (!t.bot) for (const q of humans) this.arcAward(q.key, S.ARCPTS.play, q === w); // แต้มตู้เกม: เฉพาะเล่นกับคนจริง
    this.pushTable(t);
  }
  unoPlay(t, q, i, color) {
    const card = q.hand.splice(i, 1)[0];
    t.discard.push(card); t.top = card; t.color = card[0] === 'W' ? color : card[0]; q.tmo = 0;
    t.log = `${q.name} ลง ${this.unoName(card)}${card[0] === 'W' ? ' → ' + ({ R: 'แดง', Y: 'เหลือง', G: 'เขียว', B: 'น้ำเงิน' })[color] : ''}`;
    if (!q.hand.length) return this.unoFinish(t, q);
    let skip = 0; const act = card[1];
    if (act === 'S') skip = 1;
    else if (act === 'R') { if (this.unoActive(t).length === 2) skip = 1; else t.dir *= -1; }
    else if (act === 'D' || act === 'F') {
      const nx = t.players[this.unoNext(t, t.cur, 1)], n = act === 'D' ? 2 : 4;
      this.unoDraw(t, nx, n); skip = 1; t.log += ` • ${nx.name} จั่ว ${n} ใบ`;
    }
    this.unoAdvance(t, skip);
  }
  unoDrawTurn(t, q) { // จั่ว 1 ใบ: ถ้าลงได้ให้เลือกลง/ผ่าน ถ้าลงไม่ได้ข้ามตาเลย
    this.unoDraw(t, q, 1);
    const c = q.hand[q.hand.length - 1];
    t.log = `${q.name} จั่วไพ่`;
    if (c && this.unoPlayable(t, c)) { t.drawn = q.hand.length - 1; t.deadline = Date.now() + 30000; this.pushTable(t); }
    else this.unoAdvance(t, 0);
  }
  unoEliminate(t, q, why) {
    if (q.out) return;
    q.out = true; t.deck.unshift(...q.hand); q.hand = [];
    t.log = `${q.name} ${why}`;
    const left = this.unoActive(t);
    if (left.length <= 1) return left[0] ? this.unoFinish(t, left[0]) : this.pushTable(t);
    if (t.players[t.cur] === q) this.unoAdvance(t, 0); else this.pushTable(t);
  }
  unoBotMove(t) {
    const q = t.players[t.cur]; if (!q || !q.bot) return;
    const pick = () => {
      const ok = q.hand.map((c, i) => [c, i]).filter(([c]) => this.unoPlayable(t, c));
      return ok.find(([c]) => c[0] !== 'W') || ok[0];
    };
    const play = ([c, i]) => {
      const cnt = { R: 0, Y: 0, G: 0, B: 0 }; for (const x of q.hand) if (x[0] !== 'W') cnt[x[0]]++;
      const color = c[0] === 'W' ? Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] : '';
      this.unoPlay(t, q, i, color);
    };
    let m = pick();
    if (m) return play(m);
    this.unoDraw(t, q, 1); t.log = `${q.name} จั่วไพ่`;
    m = pick();
    if (m && m[1] === q.hand.length - 1) return play(m);
    this.unoAdvance(t, 0);
  }
  unoRefundAll(t, msg) {
    if (t.bet) for (const q of t.players) if (!q.bot) this.payKey(q, t.bet);
    const ids = t.players.filter(q => !q.bot).map(q => q.id);
    this.resetUno(t); t.msg = msg || '';
    this.pushTable(t);
    for (const id of ids) { const h = this.players.get(id); if (h) this.toast(h, msg || 'ยกเลิกห้องแล้ว คืนเหรียญให้แล้ว'); }
  }
  unoHandle(p, m, t) {
    const coin = p.rec.inv.coin || 0, now = Date.now();
    const mine = t.players.find(q => q.id === p.id);
    const mkp = () => ({ id: p.id, name: p.name, key: p.key, hand: [], out: false, bot: false, tmo: 0 });
    switch (m.a) {
      case 'close': t.watchers.delete(p.id); break;
      case 'create': case 'bot': {
        if (t.state !== 'idle' && t.state !== 'over') return this.toast(p, 'โต๊ะนี้ไม่ว่าง');
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        const bot = m.a === 'bot', max = bot ? 2 : 12; // ไม่จำกัดจำนวนคน (host กดเริ่มเองเมื่อ ≥2); 12 เป็นเพดานกันสำรับ 108 ใบหมดตอนแจก 7 ใบ/คน; บอท = เล่น 1 ต่อ 1
        const bet = bot ? this.botBetOf(p, m.bet) : (S.BETS.includes(m.bet | 0) ? m.bet | 0 : 0);
        if (bet < 0) return;
        if (coin < bet) return this.toast(p, 'เหรียญไม่พอสำหรับเดิมพันนี้');
        this.resetUno(t);
        if (bet) this.add(p, 'coin', -bet, 'arcade'); // กันเหรียญเดิมพันไว้ (escrow) จนจบเกม
        t.bet = bet; t.max = max; t.bot = bot; t.players = [mkp()]; t.watchers.add(p.id);
        if (bot) { for (let i = 1; i < max; i++) t.players.push({ id: -i, name: `บอท ${i} 🤖`, key: '', hand: [], out: false, bot: true, tmo: 0 }); this.unoStart(t); }
        else { t.state = 'waiting'; t.waitUntil = now + 180000; this.pushTable(t, p.id); }
        break;
      }
      case 'join': {
        if (t.state !== 'waiting' || mine || t.players.length >= t.max) return;
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        if (coin < t.bet) return this.toast(p, 'เหรียญไม่พอสำหรับเดิมพันนี้');
        if (t.bet) this.add(p, 'coin', -t.bet, 'arcade');
        t.players.push(mkp()); t.watchers.add(p.id);
        if (t.players.length >= t.max) this.unoStart(t); else this.pushTable(t);
        break;
      }
      case 'leave': {
        if (t.state !== 'waiting' || !mine || t.players[0] === mine) return;
        if (t.bet) this.payKey(mine, t.bet);
        t.players = t.players.filter(q => q !== mine); this.pushTable(t);
        break;
      }
      case 'cancel': if (t.state === 'waiting' && t.players[0] && t.players[0].id === p.id) this.unoRefundAll(t); break;
      case 'startnow': {
        if (t.state !== 'waiting' || !t.players[0] || t.players[0].id !== p.id || t.players.length < 2) return;
        t.max = t.players.length; this.unoStart(t);
        break;
      }
      case 'play': case 'draw': case 'pass': {
        if (t.state !== 'playing' || !mine || t.players[t.cur] !== mine) return;
        if (m.a === 'draw') { if (t.drawn === -1) this.unoDrawTurn(t, mine); return; }
        if (m.a === 'pass') { if (t.drawn >= 0) this.unoAdvance(t, 0); return; }
        const i = m.i;
        if (!Number.isInteger(i) || i < 0 || i >= mine.hand.length) return;
        if (t.drawn >= 0 && i !== t.drawn) return;
        const c = mine.hand[i];
        if (!this.unoPlayable(t, c)) return;
        if (c[0] === 'W' && !'RYGB'.includes(String(m.color)) ) return;
        this.unoPlay(t, mine, i, c[0] === 'W' ? m.color : '');
        break;
      }
      case 'resign': if (t.state === 'playing' && mine && !mine.out) this.unoEliminate(t, mine, 'ยอมแพ้'); break;
    }
  }
  unoLeave(p, t) {
    const mine = t.players.find(q => q.id === p.id);
    if (!mine) return;
    if (t.state === 'waiting') {
      if (t.players[0] === mine) this.unoRefundAll(t, `${p.name} ออกจากเกม ยกเลิกห้อง`);
      else { if (t.bet) this.payKey(mine, t.bet); t.players = t.players.filter(q => q !== mine); this.pushTable(t); }
    } else if (t.state === 'playing') this.unoEliminate(t, mine, 'ออกจากเกม');
  }
  unoTick(t, now) {
    if (t.state === 'waiting' && now > t.waitUntil) return this.unoRefundAll(t, 'หมดเวลารอผู้เล่น คืนเหรียญให้แล้ว');
    if (t.state === 'over' && now > t.resetAt) { this.resetUno(t); this.pushTable(t); return; }
    if (t.state !== 'playing') return;
    if (t.botAt && now >= t.botAt) { t.botAt = 0; this.unoBotMove(t); return; }
    if (now > t.deadline) { // หมดเวลา: จั่วแล้วผ่านอัตโนมัติ ถ้าหมดเวลา 3 ครั้งติดจะถูกตัดออก
      const q = t.players[t.cur]; if (!q || q.bot) return;
      q.tmo = (q.tmo || 0) + 1;
      if (q.tmo >= 3) return this.unoEliminate(t, q, 'หมดเวลาหลายครั้ง ถูกตัดออก');
      if (t.drawn >= 0) { t.log = `${q.name} หมดเวลา`; this.unoAdvance(t, 0); }
      else { this.unoDraw(t, q, 1); t.log = `${q.name} หมดเวลา จั่วไพ่`; this.unoAdvance(t, 0); }
    }
  }

  // ===================== คาสิโน: บาคาร่า / แบล็คแจ็ค (1-3 คนต่อโต๊ะ เล่นกับเจ้ามือ เดิมพันทุกรอบ) =====================
  // "โชค" ของผู้เล่นแต่ละคนถูกซ่อนไว้: เล่นติดต่อกันนานความล้า F สูงขึ้นแล้วโชคลดลง พักไปสักพัก F ค่อยๆ ลดและโชคกลับมา
  // (ตอนเริ่มโชคดีกว่าปกตินิดหน่อย เล่นวันละนิดๆ จึงได้เล็กน้อย แต่เล่นยาว/ติดหนักจะเสีย) ไม่มีการแจ้งค่านี้ให้ผู้เล่นเห็น
  newCasinoTable(id, c, idx) { return Object.assign({ id, idx, game: c.game, cx: c.x, cy: c.y, watchers: new Set() }, this.casinoBlank()); }
  casinoBlank() {
    return { state: 'idle', max: 2, practice: false, players: [], phase: '', round: 0, deadline: 0, hands: null, dealer: null, seq: [], cur: -1,
      msg: '', log: '', waitUntil: 0, nextAt: 0, idleRounds: 0, shoe: [], bet: 0, bot: false };
  }
  resetCasino(t) { Object.assign(t, this.casinoBlank()); }
  casinoBias(q) { // >0 = โชคดี (ได้เปรียบ), <0 = โชคร้าย  ค่าอยู่ในช่วง -0.6 .. +0.12
    const rec = this.saved[q.key]; if (!rec) return 0;
    const now = Date.now(), L = rec.luck || (rec.luck = { F: 0, t: now });
    L.F = Math.max(0, L.F - (now - L.t) / 3600000 * S.CASINO.recoverPerHour); L.t = now;
    return Math.max(-0.6, 0.12 - 0.55 * L.F);
  }
  casinoTire(q) { const rec = this.saved[q.key]; if (!rec) return; this.casinoBias(q); rec.luck.F += S.CASINO.perRound; this.dirty = true; }
  coinOf(q) { const rec = this.saved[q.key]; return rec ? rec.inv.coin || 0 : 0; }
  casinoPub(t, vid) {
    const cur = t.cur >= 0 && t.seq[t.cur] ? t.seq[t.cur].id : 0, d = t.dealer;
    return { id: t.id, game: t.game, state: t.state, max: t.max, practice: t.practice, hostId: t.players[0] ? t.players[0].id : 0, bets: S.CASINO.bets,
      players: t.players.map(q => ({ id: q.id, name: q.name, bet: q.bet ? { side: q.bet.side, amt: q.bet.amt, dbl: !!q.bet.dbl } : null, net: q.net || 0, hand: q.hand || null, status: q.status || '', done: !!q.done })),
      phase: t.phase, round: t.round, deadline: t.deadline, cur, hands: t.hands, dealer: d ? { hand: d.reveal ? d.hand : [d.hand[0], '??'], reveal: d.reveal, total: d.reveal ? this.bjTotal(d.hand) : null } : null,
      msg: t.msg, log: t.log, me: t.players.some(q => q.id === vid) };
  }
  cardDraw() { return 'SHDC'[Math.floor(Math.random() * 4)] + ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][Math.floor(Math.random() * 13)]; }
  // --- บาคาร่า ---
  baccDeal() {
    const P = [this.cardDraw(), this.cardDraw()], B = [this.cardDraw(), this.cardDraw()];
    let pt = this.pokPts(P), bt = this.pokPts(B);
    if (pt < 8 && bt < 8) {
      let p3 = null;
      if (pt <= 5) { p3 = this.cardDraw(); P.push(p3); }
      if (p3 === null) { if (bt <= 5) B.push(this.cardDraw()); }
      else {
        const v = this.pokVal(p3); let draw = false;
        if (bt <= 2) draw = true; else if (bt === 3) draw = v !== 8; else if (bt === 4) draw = v >= 2 && v <= 7; else if (bt === 5) draw = v >= 4 && v <= 7; else if (bt === 6) draw = v === 6 || v === 7;
        if (draw) B.push(this.cardDraw());
      }
    }
    pt = this.pokPts(P); bt = this.pokPts(B);
    return { P, B, pt, bt, win: pt > bt ? 'P' : bt > pt ? 'B' : 'T' };
  }
  baccNet(bet, win) { // กำไร/ขาดทุนสุทธิ: ผู้เล่น 1:1 เจ้ามือ 0.95:1 เสมอ 8:1 (เสมอ = คืนเดิมพันของฝั่งผู้เล่น/เจ้ามือ)
    const a = bet.amt;
    if (bet.side === 'T') return win === 'T' ? a * 8 : -a;
    if (win === 'T') return 0;
    return bet.side === win ? (bet.side === 'B' ? Math.floor(a * 0.95) : a) : -a;
  }
  baccResolve(t) {
    const bettors = t.players.filter(q => q.bet), cands = []; for (let i = 0; i < 6; i++) cands.push(this.baccDeal());
    let pick = cands[0];
    if (!t.practice && bettors.length) {
      const bs = bettors.map(q => this.casinoBias(q)), strength = Math.min(0.9, bs.reduce((a, b) => a + Math.abs(b), 0) / bs.length);
      if (Math.random() < strength) { let best = -Infinity; for (const c of cands) { let J = 0; bettors.forEach((q, i) => { J += bs[i] * this.baccNet(q.bet, c.win); }); if (J > best) { best = J; pick = c; } } }
    }
    t.hands = pick; t.phase = 'result'; t.nextAt = Date.now() + RESULT_MS; t.deadline = 0;
    t.msg = `ผู้เล่น ${pick.pt} แต้ม • เจ้ามือ ${pick.bt} แต้ม → ${pick.win === 'P' ? '🔵 ฝั่งผู้เล่นชนะ' : pick.win === 'B' ? '🔴 ฝั่งเจ้ามือชนะ' : '🟢 เสมอ'}`;
    for (const q of bettors) this.casinoSettle(t, q, this.baccNet(q.bet, pick.win));
    this.pushTable(t);
  }
  casinoSettle(t, q, net) {
    q.net = net;
    if (!t.practice) { if (net >= 0) this.payKey(q, q.bet.amt + net); this.casinoTire(q); const o = this.players.get(q.id); if (o && o.key === q.key && net !== 0) this.sfxTo(o, net > 0 ? 'win' : 'lose'); }
  }
  // --- แบล็คแจ็ค ---
  bjTotal(h) { let t = 0, a = 0; for (const c of h) { const r = c.slice(1); if (r === 'A') { a++; t += 11; } else if (r !== '?') t += ['10', 'J', 'Q', 'K'].includes(r) ? 10 : +r; } while (t > 21 && a > 0) { t -= 10; a--; } return t; }
  bjIsBJ(h) { return h.length === 2 && this.bjTotal(h) === 21; }
  bjDraw(t, hand, bias) { // จั่ว 1 ใบ: บางครั้งเลือกจาก 3 ใบแบบสุ่มตามโชคที่ซ่อนไว้ (bias>0 ช่วยเจ้าของมือ <0 ขัดขวาง)
    if (!t.shoe || t.shoe.length < 52) { const d = []; for (let k = 0; k < 6; k++) for (const s of 'SHDC') for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) d.push(s + r); t.shoe = this.unoShuffle(d); }
    const idx = [0, 1, 2].map(() => Math.floor(Math.random() * t.shoe.length)); let pick = idx[0];
    if (Math.random() < Math.abs(bias)) {
      const score = i => { const nt = this.bjTotal([...hand, t.shoe[i]]); return nt > 21 ? -100 : nt; };
      pick = idx.reduce((b, i) => ((bias > 0 ? score(i) > score(b) : score(i) < score(b)) ? i : b), idx[0]);
    }
    return t.shoe.splice(pick, 1)[0];
  }
  bjBiasOf(t, q) { return t.practice ? 0 : this.casinoBias(q); }
  bjDealerBias(t) { const b = t.seq.filter(q => !t.practice); return b.length ? -b.reduce((s, q) => s + this.casinoBias(q), 0) / b.length : 0; }
  bjStart(t) {
    const seq = t.players.filter(q => q.bet); t.seq = seq;
    for (const q of seq) { q.hand = []; q.done = false; q.status = ''; q.net = 0; }
    const d = t.dealer = { hand: [], reveal: false }, db = this.bjDealerBias(t);
    for (let r = 0; r < 2; r++) { for (const q of seq) q.hand.push(this.bjDraw(t, q.hand, this.bjBiasOf(t, q))); d.hand.push(this.bjDraw(t, d.hand, db)); }
    t.phase = 'play'; t.msg = '';
    if (this.bjIsBJ(d.hand)) { d.reveal = true; return this.bjFinish(t); } // เจ้ามือได้แบล็คแจ็ค เปิดทันที
    for (const q of seq) if (this.bjIsBJ(q.hand)) { q.done = true; q.status = 'blackjack'; }
    t.cur = -1; this.bjNext(t);
  }
  bjNext(t) {
    let i = t.cur + 1; while (i < t.seq.length && t.seq[i].done) i++;
    if (i >= t.seq.length) return this.bjDealerPlay(t);
    t.cur = i; t.deadline = Date.now() + 20000; this.pushTable(t);
  }
  bjDealerPlay(t) {
    const d = t.dealer, db = this.bjDealerBias(t); d.reveal = true;
    if (t.seq.some(q => q.status !== 'bust')) while (this.bjTotal(d.hand) < 17) d.hand.push(this.bjDraw(t, d.hand, db));
    this.bjFinish(t);
  }
  bjFinish(t) {
    const d = t.dealer, dt = this.bjTotal(d.hand), dbj = this.bjIsBJ(d.hand);
    for (const q of t.seq) {
      const pt = this.bjTotal(q.hand), a = q.bet.amt; let net;
      if (pt > 21) net = -a;
      else if (this.bjIsBJ(q.hand)) net = dbj ? 0 : Math.floor(a * 1.5);
      else if (dbj) net = -a;
      else if (dt > 21) net = a;
      else net = pt > dt ? a : pt === dt ? 0 : -a;
      q.status = pt > 21 ? 'bust' : net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
      this.casinoSettle(t, q, net);
    }
    t.phase = 'result'; t.cur = -1; t.deadline = 0; t.nextAt = Date.now() + RESULT_MS;
    t.msg = `เจ้ามือ ${dt > 21 ? 'ไหม้ (' + dt + ')' : dt + ' แต้ม'}${dbj ? ' (แบล็คแจ็ค)' : ''}`;
    this.pushTable(t);
  }
  casinoStartRound(t) {
    t.players = t.players.filter(q => !q.leaving && !q.gone);
    if (!t.players.some(q => !q.gone)) { this.resetCasino(t); this.pushTable(t); return; }
    Object.assign(t, { phase: 'bet', round: t.round + 1, deadline: Date.now() + 25000, hands: null, dealer: null, seq: [], cur: -1, msg: '' });
    for (const q of t.players) { q.bet = null; q.net = 0; q.hand = null; q.done = false; q.status = ''; }
    this.pushTable(t);
  }
  casinoBeginSession(t) { t.state = 'playing'; t.idleRounds = 0; this.casinoStartRound(t); }
  casinoHandle(p, m, t) {
    const now = Date.now(), mine = t.players.find(q => q.id === p.id), coin = p.rec.inv.coin || 0;
    const mkp = () => ({ id: p.id, name: p.name, key: p.key, bet: null, net: 0, hand: null, done: false, status: '' });
    switch (m.a) {
      case 'close': t.watchers.delete(p.id); break;
      case 'create': case 'practice': case 'solo': {
        if (t.state !== 'idle') return this.toast(p, 'โต๊ะนี้ไม่ว่าง');
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        this.resetCasino(t); t.players = [mkp()]; t.watchers.add(p.id);
        if (m.a === 'practice') { t.practice = true; t.max = 1; this.casinoBeginSession(t); }       // ซ้อม ไม่ใช้เหรียญ
        else if (m.a === 'solo') { t.max = 1; this.casinoBeginSession(t); }                          // เล่นคนเดียวกับเจ้ามือ ใช้เหรียญจริง เริ่มทันที
        else { t.max = 12; t.state = 'waiting'; t.waitUntil = now + 180000; this.pushTable(t, p.id); } // โต๊ะหลายคน: รอเพื่อน host กดเริ่มเอง (ไม่จำกัดจำนวนจริง เพดาน 12 กันกรณีสุดโต่ง)
        break;
      }
      case 'join': {
        if (mine || t.practice || t.players.length >= t.max || (t.state !== 'waiting' && !(t.state === 'playing' && (t.phase === 'bet' || t.phase === 'result')))) return;
        if (this.inGame(p)) return this.toast(p, 'คุณกำลังอยู่ในเกมอื่น');
        t.players.push(mkp()); t.watchers.add(p.id);
        if (t.state === 'waiting' && t.players.length >= t.max) this.casinoBeginSession(t); else this.pushTable(t);
        break;
      }
      case 'startnow': if (t.state === 'waiting' && t.players[0] && t.players[0].id === p.id && t.players.length >= 2) this.casinoBeginSession(t); break;
      case 'cancel': if (t.state === 'waiting' && t.players[0] && t.players[0].id === p.id) { this.resetCasino(t); this.pushTable(t); } break;
      case 'leave': this.casinoLeave(p, t); break;
      case 'bet': {
        if (t.state !== 'playing' || t.phase !== 'bet' || !mine || mine.bet) return;
        const amt = m.amt | 0, side = t.game === 'bacc' ? String(m.side) : 'X';
        if (!S.CASINO.bets.includes(amt) || (t.game === 'bacc' && !['P', 'B', 'T'].includes(side))) return;
        if (!t.practice) { if (coin < amt) return this.toast(p, 'เหรียญไม่พอสำหรับเดิมพันนี้'); this.add(p, 'coin', -amt); }
        mine.bet = { side, amt }; this.pushTable(t);
        break;
      }
      case 'hit': case 'stand': case 'double': {
        if (t.game !== 'bj' || t.state !== 'playing' || t.phase !== 'play' || !mine || t.seq[t.cur] !== mine || mine.done) return;
        if (m.a === 'stand') { mine.done = true; mine.status = mine.status || 'stand'; return this.bjNext(t); }
        if (m.a === 'double') {
          if (mine.hand.length !== 2 || mine.bet.dbl) return;
          if (!t.practice) { if (coin < mine.bet.amt) return this.toast(p, 'เหรียญไม่พอสำหรับดับเบิ้ล'); this.add(p, 'coin', -mine.bet.amt); }
          mine.bet.amt *= 2; mine.bet.dbl = true;
        }
        mine.hand.push(this.bjDraw(t, mine.hand, this.bjBiasOf(t, mine)));
        const tot = this.bjTotal(mine.hand);
        if (tot > 21) { mine.done = true; mine.status = 'bust'; }
        else if (tot === 21 || m.a === 'double') { mine.done = true; mine.status = mine.status || 'stand'; }
        if (mine.done) this.bjNext(t); else { t.deadline = now + 20000; this.pushTable(t); }
        break;
      }
    }
  }
  casinoLeave(p, t) {
    const q = t.players.find(x => x.id === p.id); if (!q) { t.watchers.delete(p.id); return; }
    if (t.state === 'waiting') { t.players = t.players.filter(x => x !== q); if (!t.players.length) this.resetCasino(t); this.pushTable(t); return; }
    if (t.phase === 'bet' && q.bet && !t.practice) { this.payKey(q, q.bet.amt); q.bet = null; } // ยังไม่เริ่มรอบ คืนเดิมพันให้
    if (t.phase === 'bet' || t.phase === 'result' || t.practice) {
      t.players = t.players.filter(x => x !== q);
      if (!t.players.some(x => !x.gone)) this.resetCasino(t);
      this.pushTable(t);
    } else { q.leaving = true; this.toast(p, 'รอให้จบรอบนี้ก่อน แล้วจะออกจากโต๊ะให้เอง'); }
  }
  casinoDisconnect(p, t) { // หลุดจากเกม: ถ้ากำลังเล่นรอบนั้นอยู่ให้ยืน/ผ่านอัตโนมัติ เดิมพันยังคิดผลตามปกติ
    const q = t.players.find(x => x.id === p.id); t.watchers.delete(p.id); if (!q) return;
    q.gone = true;
    if (t.state === 'waiting') { t.players = t.players.filter(x => x !== q); if (!t.players.length) this.resetCasino(t); this.pushTable(t); return; }
    if (t.phase === 'bet' && q.bet && !t.practice) { this.payKey(q, q.bet.amt); q.bet = null; }
    if (t.phase === 'bet' || t.phase === 'result' || t.practice) { t.players = t.players.filter(x => x !== q); if (!t.players.length) this.resetCasino(t); this.pushTable(t); }
    else if (t.game === 'bj' && t.phase === 'play' && t.seq[t.cur] === q) { q.done = true; q.status = q.status || 'stand'; this.bjNext(t); }
  }
  casinoTick(t, now) {
    if (t.state === 'waiting') { if (now > t.waitUntil) { this.resetCasino(t); this.pushTable(t); } return; }
    if (t.state !== 'playing') return;
    if (t.phase === 'bet') {
      const able = t.players.filter(q => !q.gone && (t.practice || this.coinOf(q) >= S.CASINO.bets[0] || q.bet)), allBet = able.length > 0 && able.every(q => q.bet);
      if (allBet || now > t.deadline) {
        if (!t.players.some(q => q.bet)) { if (++t.idleRounds >= 2) { this.resetCasino(t); this.pushTable(t); } else this.casinoStartRound(t); return; }
        t.idleRounds = 0;
        if (t.game === 'bacc') this.baccResolve(t); else this.bjStart(t);
      }
    } else if (t.phase === 'play') {
      const q = t.seq[t.cur];
      if (q && (q.gone || now > t.deadline)) { q.done = true; q.status = q.status || 'stand'; this.bjNext(t); }
    } else if (t.phase === 'result' && now >= t.nextAt) this.casinoStartRound(t);
  }

  tick(dt, now) {
    this.arcTick(now);
    this.cinemaTick(now);
    this.telTick(now);
    this.npcTick(dt, now); this.petTick(dt);
    for (const tr of this.trades.values()) { // เทรดค้าง/อยู่ห่างกันเกินไป = ยกเลิก
      const a = this.players.get(tr.a.id), b = this.players.get(tr.b.id);
      if (!a || !b) { if (a || b) this.tradeCancel(a || b, 'อีกฝ่ายหลุดจากเกม'); else this.trades.delete(tr.id); break; }
      if (Math.hypot(a.x - b.x, a.y - b.y) > S.TRADE.range * 1.6 * TS) { this.tradeCancel(a, 'อยู่ห่างกันเกินไป ยกเลิกการเทรด'); break; }
      if (!tr.open && now - tr.t0 > 30000) { this.tradeCancel(a, 'ไม่มีการตอบรับ ยกเลิกคำขอเทรด'); break; }
    }
    // ความหิว: นับเฉพาะตอนมีผู้เล่นออนไลน์ (กันสัตว์/คนหิวตายตอนทุกคนไม่อยู่)
    if (this.players.size) {
      this.hunTick = (this.hunTick || 0) + dt * 1000;
      if (this.hunTick >= S.PLAYER_HUNGER.tickMs / HFAST) { this.hunTick = 0; for (const p of this.players.values()) this.petTick15(p); for (const p of this.players.values()) { if (p.sit) continue; if (this.buffOn(p, 'hunger') && (p.hunHalf = !p.hunHalf)) continue; const H = S.PLAYER_HUNGER, busy = p.fish || (Date.now() - (p.workAt || 0) < H.workMs); this.setHunger(p, p.rec.hunger - (busy ? H.workMul : H.idleMul)); } } // นั่งพักอยู่ = ความหิวไม่ลด
      this.sitTick = (this.sitTick || 0) + dt * 1000;
      if (this.sitTick >= S.PLAYER_HUNGER.sitMs) { this.sitTick = 0; for (const p of this.players.values()) if (p.sit && p.rec.hunger < 100) this.setHunger(p, p.rec.hunger + S.PLAYER_HUNGER.sitGain, true); } // นั่งพักค่อยๆ อิ่มขึ้นทีละนิด
      this.energyTick(dt);
      for (const a of this.animals) {
        const A = ANIMALS[a.type];
        a.hunger = Math.max(0, a.hunger - dt * HFAST * 100 / (A.starveMin * 60));
        if (a.hunger <= 0) {
          a.zero = (a.zero || 0) + dt * 1000;
          if (!a.warned && a.zero > 1000) { a.warned = true; this.broadcast({ t: 'msg', text: `⚠️ ${A.emoji} ${A.name}หิวจนไม่มีแรงแล้ว! รีบให้อาหารก่อนจะตาย` }); }
          if (a.zero > S.ANIMAL_GRACE_MS / HFAST) {
            a.dead = true;
            this.broadcast({ t: 'msg', text: `💀 ${A.emoji} ${A.name}ตัวหนึ่งหิวตายแล้ว... ช่วยกันดูแลสัตว์ให้ดีนะ (ชุบชีวิตได้ที่ตู้เซฟกองกลาง)` }); this.addLog(`💀 ${A.emoji} ${A.name}ตัวหนึ่งหิวตาย`);
            this.broadcast({ t: 'sfx', k: 'die', id: 0, x: Math.round(a.x), y: Math.round(a.y) });
          }
        } else { a.zero = 0; a.warned = false; }
        if (a.sick && (a.sickMs = (a.sickMs || 0) + dt * 1000 * HFAST) > SICK_GRACE) { // ป่วยแล้วไม่รักษา ตายเร็วกว่าหิวปกติ (นับเฉพาะตอนมีคนออนไลน์)
          a.dead = true;
          this.broadcast({ t: 'msg', text: `💀 ${A.emoji} ${A.name}ตัวหนึ่งป่วยตายแล้ว... ครั้งหน้ารีบรักษาด้วยยา 💊 นะ (ชุบชีวิตได้ที่ตู้เซฟกองกลาง)` }); this.addLog(`💀 ${A.emoji} ${A.name}ตัวหนึ่งป่วยตาย`);
          this.broadcast({ t: 'sfx', k: 'die', id: 0, x: Math.round(a.x), y: Math.round(a.y) });
        }
        if (!a.dead) this.careTick(a, A);
      }
      // ฝูงขั้นต่ำ: ชนิดที่เหลือน้อยกว่าจำนวนเริ่มต้น เกิดใหม่ฟรีทีละตัว (ผู้เล่นใหม่ต้องมีสัตว์ให้ทำคู่มือเสมอ แม้เงินกองกลางหมด)
      this.respawnTimer = (this.respawnTimer || 0) + dt * 1000 * HFAST;
      if (this.respawnTimer >= S.TOWN.respawnMs) {
        this.respawnTimer = 0;
        const type = Object.keys(ANIMALS).find(t => this.animals.filter(a => a.type === t && !a.dead).length < ANIMALS[t].init);
        if (type) {
          const A = ANIMALS[type];
          if (this.chest.dead[type] > 0) this.chest.dead[type]--;
          this.spawnAnimal(type); this.chestPush(); this.addLog(`🐣 ${A.emoji} ${A.name}ตัวใหม่มาอยู่ที่ทุ่ง`);
          this.broadcast({ t: 'msg', text: `🐣 ${A.emoji} ${A.name}ตัวใหม่มาอยู่ที่ทุ่งแล้ว ช่วยกันให้อาหารด้วยนะ` });
        }
      }
      // สุ่มสัตว์ป่วย: เช็กทุก 1 นาที ป่วยพร้อมกันได้ไม่เกิน 3 ตัวรวมทุกชนิด
      this.sickTimer += dt * 1000 * HFAST;
      if (this.sickTimer >= SICK_CHECK) {
        this.sickTimer = 0;
        const healthy = this.animals.filter(a => !a.sick && !a.dead);
        if (this.animals.filter(a => a.sick).length < S.SICK.max && healthy.length && Math.random() < S.SICK.chance) {
          const a = healthy[Math.floor(Math.random() * healthy.length)], A = ANIMALS[a.type];
          a.sick = true; a.sickMs = 0; this.addLog(`🤒 ${A.emoji} ${A.name}ตัวหนึ่งป่วย`);
          this.broadcast({ t: 'msg', text: `🤒 ${A.emoji} ${A.name}ตัวหนึ่งป่วยแล้ว! รีบรักษาด้วยยา 💊 (ซื้อที่ร้านปศุสัตว์) ก่อนจะตาย` });
        }
      }
      // ต้นไม้งอกใหม่ในที่โล่งสีเขียวที่ห่างจากสิ่งปลูกสร้าง
      this.treeTimer += dt;
      if (this.treeTimer >= S.TREE.growMs / 1000) { // ต้นไม้งอกใหม่ (เพดานตาม S.TREE.cap)
        this.treeTimer = 0;
        if (this.treeList().length < this.treeCap) {
          for (let i = 0; i < 40; i++) {
            const x = 2 + Math.floor(Math.random() * (S.W - 4)), y = 2 + Math.floor(Math.random() * (S.H - 4));
            if (!S.treeSpotOk(this.map, x, y)) continue;
            if ([...this.players.values()].some(q => Math.hypot(q.x - (x + 0.5) * TS, q.y - (y + 0.5) * TS) < 4 * TS)) continue;
            if (this.animals.some(a => Math.hypot(a.x - (x + 0.5) * TS, a.y - (y + 0.5) * TS) < 3 * TS)) continue;
            this.map[y][x] = T.TREE; this.dirty = true; this.broadcast({ t: 'tree', x, y, on: true });
            break;
          }
        }
      }
      const before = this.animals.length;
      for (const a of this.animals) if (a.dead) this.chest.dead[a.type] = Math.min(ANIMALS[a.type].cap, this.chest.dead[a.type] + 1);
      this.animals = this.animals.filter(a => !a.dead);
      if (this.animals.length !== before) { this.dirty = true; this.chestPush(); }
    }
    for (const a of this.animals) {
      if (a.fed && now >= a.layAt && a.hunger > 0 && !a.sick) { a.fed = false; a.prod = true; a.pm = 0; }
      if (a.prod && a.feeder && (a.pm || 0) < S.DAY_MS) a.pm = (a.pm || 0) + dt * 1000; // ผลผลิตเป็นของคนเลี้ยง: นับเวลาที่ยังไม่มีใครมาเก็บ ครบ 1 วันคนอื่นเก็บได้ (เหมือนผัก)
      a.wait -= dt;
      if (a.wait <= 0) {
        const bee = a.type === 'bee', z = bee ? this.hiveBox(a.hive) : this.zone(a.type);
        a.tx = rand(z.x0, z.x1); a.ty = rand(z.y0, z.y1); a.wait = bee ? rand(0.8, 2.5) : rand(2, 7);
      }
      const d = Math.hypot(a.tx - a.x, a.ty - a.y), sp = (({ cow: 14, sheep: 15, pig: 16, duck: 18, bee: 30 })[a.type] || 22) * dt;
      if (d > 2) { a.x += (a.tx - a.x) / d * sp; a.y += (a.ty - a.y) / d * sp; a.dx = a.tx > a.x ? 1 : -1; }
    }
    for (const p of this.players.values()) {
      const f = p.fish;
      if (!f) continue;
      if (f.st === 'wait' && now >= f.at) {
        // มินิเกมเกจ: ตัวชี้วิ่งไป-กลับ กดตอนอยู่ตรงกลางโซนเขียวถึงจะดึงปลาขึ้น (คันเบ็ดดีกว่า = โซนกว้างขึ้น ตัวชี้ช้าลง)
        const g = S.FISH_GAUGE, rr = (a, b) => a + Math.random() * (b - a); f.st = 'bite';
        f.per = (g.per + g.perRod * (f.rod - 1)) * rr(g.perVar[0], g.perVar[1]); f.half = (g.half + g.halfRod * (f.rod - 1)) * rr(g.halfVar[0], g.halfVar[1]);
        f.c = rr(g.cMin, g.cMax); const off = rr(0, 2 * f.per); f.gt0 = now - off; f.at = now + g.window; // สุ่มจุดกลางโซน ความเร็ว ความกว้าง และตำแหน่งเริ่มต้นของตัวชี้ทุกครั้ง
        send(p, { t: 'fg', per: f.per, half: f.half, c: f.c, ph: off, win: g.window }); // ph = ระยะที่ตัวชี้วิ่งมาแล้วตอนเริ่ม (ms) (ห้ามใช้ชื่อ off เพราะ off = สัญญาณปิดเกจ)
        this.toast(p, '🎣 ปลากินเบ็ดแล้ว! กดตอนตัวชี้อยู่ตรงกลาง!'); this.sfx(p, 'bite');
      }
      else if (f.st === 'bite' && now >= f.at) { p.fish = null; send(p, { t: 'fg', off: 1 }); this.toast(p, 'ปลาหนีไปแล้ว...'); }
    }
    if (!this.players.size) return;
    const groups = new Map(); // ส่งตำแหน่งแยกตามฉาก: คนในบ้านเห็นเฉพาะคนในบ้านเดียวกัน
    for (const q of this.players.values()) { const k = q.scene || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(q); }
    for (const [k, ps] of groups) {
      const msg = { t: 's', p: ps.map(p => [p.id, Math.round(p.x), Math.round(p.y), p.dir, p.fish ? (p.fish.st === 'bite' ? 2 : 1) : 0, p.fish ? p.fish.fx : 0, p.fish ? p.fish.fy : 0, p.sit ? 1 : 0, p.fish ? p.fish.bt || 1 : 1]), n: [], pt: [], c: [] };
      if (!k) {
        msg.n = this.npcs.map(n => [n.id, Math.round(n.x), Math.round(n.y), n.dir]);
        msg.pt = this.pets.map(q => [q.id, Math.round(q.x), Math.round(q.y), q.dir, q.moving ? 1 : 0]);
        msg.c = this.animals.map(a => [a.id, a.type, Math.round(a.x), Math.round(a.y), a.prod ? 1 : 0, a.fed ? 1 : 0, a.dx, Math.round(a.hunger), a.sick ? 1 : 0, a.prod && a.feeder && (a.pm || 0) < S.DAY_MS ? 1 : 0, a.prod ? a.fn || '' : '']);
      }
      const str = JSON.stringify(msg); for (const q of ps) if (q.ws.readyState === 1) q.ws.send(str);
    }
  }

  cropTick(now) {
    const dt = now - this.lastCrop; this.lastCrop = now;
    if (!this.players.size) return; // โลกจำศีล: ไม่มีคนออนไลน์ พืชไม่โต
    for (const k in this.farm) {
      const t = this.farm[k];
      if (t.c && t.wu > now && S.cropStage(t) < 3) t.g = Math.min(CROPS[t.c].time, (t.g || 0) + dt * (t.m || 1));
      else if (t.c && t.o && S.cropStage(t) === 3 && (t.rm || 0) < S.DAY_MS) { t.rm = (t.rm || 0) + dt; this.dirty = true; } // สุกค้างอยู่ นับเวลาจนครบ 1 วันในเกม
      else if (!t.c) { // แปลงว่างที่ไม่มีใครถาง/ปลูกเกินเวลาที่กำหนด หญ้าขึ้นกลับ
        t.idle = (t.idle || 0) + dt;
        if (t.idle >= S.FARM_REGROW_MS) { delete this.farm[k]; this.tileUpdate(k, null); this.dirty = true; continue; }
      }
      if (JSON.stringify(this.pub(t, now)) !== t._p) this.tileUpdate(k, t);
    }
  }

  save(sync) {
    if (!this.dirty) return;
    this.dirty = false;
    for (const p of this.players.values()) { const r = this.townPos(p); p.rec.x = r.x; p.rec.y = r.y; }
    const animals = {}; for (const t of Object.keys(ANIMALS)) animals[t] = this.count(t);
    const data = JSON.stringify({ farm: this.farm, players: this.saved, animals, market: this.market, mktDay: this.mktDay, trees: this.treeList(), house: { houses: this.houses }, log: this.log, chest: this.chest, projects: this.projects, stats: this.stats, village: this.village, week: this.week, orders: this.orders, banned: [...(this.banned || [])] }, replacer);
    if (sync) { fs.writeFileSync(this.file, data); return; }
    fs.writeFile(this.file + '.tmp', data, err => { if (!err) fs.rename(this.file + '.tmp', this.file, () => {}); });
  }
}

if (require.main !== module) { module.exports = { World }; return; } // ใช้ตอนเขียนเทสต์ (require แล้วไม่เปิดเซิร์ฟเวอร์)

const worlds = new Map();
function getWorld(room) {
  let w = worlds.get(room);
  if (!w) {
    if (worlds.size >= 50) return null;
    w = new World(room); worlds.set(room, w);
  }
  return w;
}

// ---------- แจ้งบั๊ก ----------
// ผู้เล่นส่งรายงาน (ข้อความ + ภาพไม่เกิน 1MB) ผ่าน POST /api/bug — ไม่ใช้ WebSocket เพราะจำกัดข้อความไว้ 16KB
// เก็บที่ data/bugs/<id>.json (+ <id>.png|jpg|webp|gif) อ่านด้วย `node tools/bugs.js` ไม่ได้เปิดให้ดาวน์โหลดจากเว็บ
const BUG_DIR = path.join(DATA_DIR, 'bugs'), BUG_IMG_MAX = 1024 * 1024, BUG_BODY_MAX = Math.ceil(BUG_IMG_MAX * 4 / 3) + 16384;
const BUG_PER_IP = 5, BUG_PER_IP_MS = 10 * 60 * 1000, BUG_GLOBAL = 100, BUG_GLOBAL_MS = 60 * 60 * 1000; // กันสแปม: ต่อ IP 5 ครั้ง/10 นาที ทั้งเซิร์ฟเวอร์ 100 ครั้ง/ชม.
const bugHits = new Map(), bugAll = [];
const bugImgExt = b => (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) ? 'png'
  : (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ? 'jpg'
  : (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') ? 'webp'
  : (b.length > 6 && /^GIF8[79]a/.test(b.toString('latin1', 0, 6))) ? 'gif' : ''; // ดูไบต์จริง ไม่เชื่อนามสกุล/ชนิดที่ client บอก
const bugClip = (v, n) => String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n);
const BUG_ID_RE = /^[a-z0-9]{6,24}$/;
function bugList() { // รายงานสำหรับหน้าผู้ดูแล (ไม่รวมตัวภาพ)
  let names = []; try { names = fs.readdirSync(BUG_DIR).filter(f => f.endsWith('.json')); } catch (e) { return []; }
  const out = [];
  for (const f of names) { try { const r = JSON.parse(fs.readFileSync(path.join(BUG_DIR, f), 'utf8')); if (BUG_ID_RE.test(r.id)) out.push({ id: r.id, time: r.time, name: r.name, room: r.room, text: r.text, img: !!r.img, fixed: r.status === 'fixed', fixedAt: r.fixedAt || 0, fixedBy: r.fixedBy || '' }); } catch (e) { /* ไฟล์เสียข้ามไป */ } }
  const open = out.filter(b => !b.fixed).sort((a, b) => b.time - a.time), fixed = out.filter(b => b.fixed).sort((a, b) => b.fixedAt - a.fixedAt);
  return open.slice(0, 200).concat(fixed.slice(0, 100)); // ยังไม่แก้ไม่ตกหล่น ส่วนที่แก้แล้วโชว์ล่าสุด 100 (ไฟล์ยังเก็บครบทั้งหมด)
}
function bugRead(id) { try { return BUG_ID_RE.test(id) ? JSON.parse(fs.readFileSync(path.join(BUG_DIR, id + '.json'), 'utf8')) : null; } catch (e) { return null; } }
const bugMime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
function handleBug(req, res) {
  const out = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
  const ip = ipOf(req), now = Date.now();
  while (bugAll.length && now - bugAll[0] > BUG_GLOBAL_MS) bugAll.shift();
  const mine = (bugHits.get(ip) || []).filter(t => now - t < BUG_PER_IP_MS); bugHits.set(ip, mine);
  if (mine.length >= BUG_PER_IP || bugAll.length >= BUG_GLOBAL) { req.resume(); return out(429, { err: 'แจ้งบ่อยเกินไป รอสักครู่แล้วลองใหม่' }); }
  if (+req.headers['content-length'] > BUG_BODY_MAX) { req.resume(); return out(413, { err: 'ข้อมูลใหญ่เกินไป (ภาพต้องไม่เกิน 1MB)' }); }
  const chunks = []; let size = 0, dead = false;
  req.on('data', c => { if (dead) return; size += c.length; if (size > BUG_BODY_MAX) { dead = true; out(413, { err: 'ข้อมูลใหญ่เกินไป (ภาพต้องไม่เกิน 1MB)' }); req.resume(); } else chunks.push(c); });
  req.on('error', () => {});
  req.on('end', () => {
    if (dead) return;
    let m; try { m = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return out(400, { err: 'ข้อมูลไม่ถูกต้อง' }); }
    if (!m || typeof m !== 'object') return out(400, { err: 'ข้อมูลไม่ถูกต้อง' });
    const text = bugClip(m.text, 1000).trim();
    if (text.length < 5) return out(400, { err: 'อธิบายปัญหาอย่างน้อย 5 ตัวอักษร' });
    let img = null, ext = '';
    if (m.img) {
      const mt = typeof m.img === 'string' && /^data:image\/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(m.img);
      if (!mt) return out(400, { err: 'ไฟล์ภาพไม่ถูกต้อง (รองรับ PNG, JPG, WEBP, GIF)' });
      img = Buffer.from(mt[1], 'base64');
      if (img.length > BUG_IMG_MAX) return out(413, { err: 'ภาพใหญ่เกิน 1MB' });
      ext = bugImgExt(img); if (!ext) return out(400, { err: 'ไฟล์ภาพไม่ถูกต้อง (รองรับ PNG, JPG, WEBP, GIF)' });
    }
    const room = ROOM_RE.test(String(m.room || '')) ? String(m.room) : '';
    const id = now.toString(36) + crypto.randomBytes(3).toString('hex');
    const rec = { id, time: now, name: normName(m.name), room, text, img: img ? id + '.' + ext : null }; // เก็บเฉพาะข้อความ + ภาพ (+ ชื่อ/ห้อง/เวลา) ไม่เก็บ IP หรือข้อมูลอุปกรณ์
    fs.mkdir(BUG_DIR, { recursive: true }, e => {
      if (e) { console.error('สร้างโฟลเดอร์แจ้งบั๊กไม่ได้', e.message); return out(500, { err: 'บันทึกไม่ได้ ลองใหม่อีกครั้ง' }); }
      const done = er => {
        if (er) { console.error('บันทึกแจ้งบั๊กไม่ได้', er.message); return out(500, { err: 'บันทึกไม่ได้ ลองใหม่อีกครั้ง' }); }
        mine.push(now); bugAll.push(now);
        for (const w of worlds.values()) for (const q of w.players.values()) if (q.admin) send(q, { t: 'msg', text: '🐞 มีรายงานบั๊กใหม่จาก ' + (rec.name || 'ผู้เล่น') + ' (เมนู 🛠️ → 🐞 บั๊ก)' });
        console.log('แจ้งบั๊ก:', rec.name || '?', '←', ip, '#' + id, rec.img ? '(มีภาพ)' : '', text.slice(0, 60).replace(/\s+/g, ' '));
        out(200, { ok: true, id });
      };
      const writeJson = () => fs.writeFile(path.join(BUG_DIR, id + '.json'), JSON.stringify(rec, null, 1), done);
      if (img) fs.writeFile(path.join(BUG_DIR, rec.img), img, er => er ? done(er) : writeJson()); else writeJson();
    });
  });
}

const server = http.createServer((req, res) => {
  let u;
  try { u = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (u === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (u === '/api/bug') { if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); return res.end(); } return handleBug(req, res); }
  if (u === '/') u = '/index.html';
  const f = path.join(PUB, u);
  if (!f.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(d);
  });
});

// ---------- ห้อง (โลกแยกกัน) และผู้ดูแล ----------
// ผู้เล่นคนละห้องไม่เจอกัน (แชท ไมค์ แมพ เซฟ แยกหมด) ห้องใหม่สร้างได้เฉพาะผู้ดูแลเท่านั้น แล้วส่งลิงก์ ?room=ชื่อห้อง ให้เพื่อน
const ROOM_RE = /^[a-z0-9_-]{1,20}$/, DEFAULT_ROOM = ROOM, ROOMS_FILE = path.join(DATA_DIR, 'rooms.meta.json');
const ROOMS = new Map([[DEFAULT_ROOM, { name: DEFAULT_ROOM, created: 0 }]]);
try { for (const r of JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8').replace(/^\uFEFF/, '')).rooms || []) if (r && typeof r.name === 'string' && ROOM_RE.test(r.name) && !ROOMS.has(r.name)) ROOMS.set(r.name, { name: r.name, created: +r.created || 0 }); } catch (e) { /* ยังไม่มีห้องเพิ่ม */ }
const saveRooms = () => { try { fs.writeFileSync(ROOMS_FILE, JSON.stringify({ rooms: [...ROOMS.values()].filter(r => r.name !== DEFAULT_ROOM) })); } catch (e) { console.error('บันทึกรายชื่อห้องไม่ได้', e.message); } };
// ผู้ดูแล: ชื่อตัวละคร ADMIN_NAME (ค่าเริ่มต้น Sira) ต้องใส่รหัสถึงจะเข้าได้ — รหัสมาจากตัวแปร ADMIN_KEY หรือไฟล์ admin.key (ไม่มีก็สุ่มสร้างให้ ไม่เคยส่งไปกับหน้าเว็บ)
const ADMIN_NAME = (process.env.ADMIN_NAME || 'Sira').trim();
const KEY_FILE = path.join(__dirname, 'admin.key');
let ADMIN_KEY = process.env.ADMIN_KEY || '';
if (!ADMIN_KEY) { try { ADMIN_KEY = fs.readFileSync(KEY_FILE, 'utf8').trim(); } catch (e) { /* ยังไม่มีไฟล์ */ } }
if (!ADMIN_KEY) { ADMIN_KEY = crypto.randomBytes(9).toString('base64url'); try { fs.writeFileSync(KEY_FILE, ADMIN_KEY + '\n'); console.log('สร้างรหัสผู้ดูแลใหม่ไว้ที่ ' + KEY_FILE); } catch (e) { console.log('รหัสผู้ดูแล (ชั่วคราว ไม่ได้บันทึก):', ADMIN_KEY); } }
const sha = x => crypto.createHash('sha256').update(String(x)).digest();
const keyOk = x => crypto.timingSafeEqual(sha(x), sha(ADMIN_KEY));
const normName = n => Array.from(String(n || '').replace(/\s+/g, ' ').trim()).slice(0, 12).join('');
const adminFails = []; // เวลาที่ใส่รหัสผิด (กันเดารหัส: ผิดเกิน 8 ครั้งใน 1 นาที ปฏิเสธทุกการเข้าผู้ดูแลชั่วคราว)
const adminLocked = () => { const now = Date.now(); while (adminFails.length && now - adminFails[0] > 60000) adminFails.shift(); return adminFails.length >= 8; };
const roomsPub = () => [...ROOMS.values()].map(r => ({ name: r.name, online: worlds.has(r.name) ? worlds.get(r.name).players.size : 0, main: r.name === DEFAULT_ROOM }));
const randomRoomName = () => { const al = 'abcdefghjkmnpqrstuvwxyz23456789', b = crypto.randomBytes(8); let o = ''; for (const x of b) o += al[x % al.length]; return o; };
function userList() {
  const users = [];
  for (const r of ROOMS.values()) { const w = getWorld(r.name); if (!w) continue;
    const on = new Map(); for (const q of w.players.values()) on.set(q.key, q);
    for (const [key, rec] of Object.entries(w.saved)) { const q = on.get(key); if (!q && !(rec.ips && rec.ips.length)) continue;
      users.push({ room: r.name, name: rec.name || key, online: !!q, admin: !!(q && q.admin), ip: q ? q.ip : '', ips: rec.ips || [], last: q ? Date.now() : rec.lastSeen || 0 }); } }
  users.sort((a, b) => (b.online - a.online) || (b.last - a.last));
  return users;
}
function banList() { // รายชื่อที่ถูกแบนทุกห้อง
  const out = [];
  for (const r of ROOMS.values()) { const w = worlds.get(r.name); if (!w || !w.banned) continue; for (const key of w.banned) out.push({ room: r.name, name: key }); }
  return out;
}
function adminHandle(p, world, m) {
  const reply = o => send(p, Object.assign({ t: 'admin', rooms: roomsPub(), current: world.room }, o));
  if (m.a === 'rooms') return reply({});
  if (m.a === 'bugs') return reply({ bugs: bugList() });
  if (m.a === 'bugimg') { // ส่งภาพของรายงานนั้นให้แอดมินดู (data URL ไม่เกิน 1MB)
    const r = bugRead(String(m.id || '')); if (!r || !r.img) return reply({ err: 'ไม่พบภาพ', bugs: bugList() });
    let b; try { b = fs.readFileSync(path.join(BUG_DIR, path.basename(r.img))); } catch (e) { return reply({ err: 'อ่านภาพไม่ได้', bugs: bugList() }); }
    return reply({ bugimg: { id: r.id, uri: 'data:' + (bugMime[path.extname(r.img).slice(1)] || 'application/octet-stream') + ';base64,' + b.toString('base64') } });
  }
  if (m.a === 'bugfix' || m.a === 'bugreopen') { // ทำเครื่องหมาย แก้แล้ว / เปิดใหม่ — ไม่ลบ เก็บรายงานและภาพไว้ตลอด
    const r = bugRead(String(m.id || '')); if (!r) return reply({ err: 'ไม่พบรายงานนี้', bugs: bugList() });
    if (m.a === 'bugfix') { r.status = 'fixed'; r.fixedAt = Date.now(); r.fixedBy = p.name; } else { delete r.status; delete r.fixedAt; delete r.fixedBy; }
    try { const f = path.join(BUG_DIR, r.id + '.json'); fs.writeFileSync(f + '.tmp', JSON.stringify(r, null, 1)); fs.renameSync(f + '.tmp', f); } catch (e) { console.error('บันทึกสถานะบั๊กไม่ได้', e.message); return reply({ err: 'บันทึกไม่ได้', bugs: bugList() }); }
    console.log((m.a === 'bugfix' ? 'บั๊กแก้แล้ว #' : 'เปิดบั๊กใหม่ #') + r.id, '(โดย ' + p.name + ')');
    return reply({ bugs: bugList(), bugmark: m.a === 'bugfix' ? 'fixed' : 'open' });
  }

  if (m.a === 'ban' || m.a === 'unban') { // แบน/ปลดแบนชื่อตัวละคร: ถูกแบนแล้วเข้าเกมไม่ได้จนกว่าจะใช้ชื่ออื่น (เตะออกทันทีถ้าออนไลน์)
    const w = worlds.get(String(m.room || '')) || getWorld(String(m.room || ''));
    if (!w) return reply({ err: 'ไม่พบห้องนี้', users: userList(), bans: banList() });
    const key = String(m.name || '').toLowerCase().slice(0, 24);
    if (!key) return reply({ err: 'ไม่มีชื่อ', users: userList(), bans: banList() });
    if (!w.banned) w.banned = new Set();
    if (m.a === 'ban') {
      if (key === ADMIN_NAME.toLowerCase()) return reply({ err: 'แบนผู้ดูแลไม่ได้', users: userList(), bans: banList() });
      w.banned.add(key); w.dirty = true;
      for (const q of [...w.players.values()]) if (q.key === key && !q.admin) { send(q, { t: 'kicked' }); try { q.ws.close(); } catch (e) { /* ปิดไม่ได้ก็ไม่เป็นไร */ } }
      console.log('แบนผู้เล่น:', key, '(ห้อง ' + w.room + ', โดย ' + p.name + ')');
      return reply({ banned: key, users: userList(), bans: banList() });
    }
    w.banned.delete(key); w.dirty = true;
    return reply({ unbanned: key, users: userList(), bans: banList() });
  }
  if (m.a === 'kick') { // เตะผู้เล่นออกจากห้อง (เข้ามาใหม่ได้ทันที)
    const w = worlds.get(String(m.room || '')); let t = null;
    if (w) for (const q of w.players.values()) if (q.key === String(m.name || '').toLowerCase()) t = q;
    if (!t) return reply({ err: 'ไม่พบผู้เล่นคนนี้ (อาจออกไปแล้ว)', users: null });
    if (t.admin) return reply({ err: 'เตะผู้ดูแลไม่ได้' });
    send(t, { t: 'kicked' }); console.log('เตะผู้เล่น:', t.name, '←', t.ip, '(โดย ' + p.name + ')');
    try { t.ws.close(); } catch (e) { /* ปิดไม่ได้ก็ไม่เป็นไร */ }
    return reply({ kicked: t.name });
  }
  if (m.a === 'users') { // รายชื่อผู้เล่นทุกห้องพร้อม IP (ออนไลน์ก่อน แล้วเรียงตามเวลาเข้าล่าสุด) + รายชื่อที่ถูกแบน
    return reply({ users: userList(), bans: banList() });
  }
  if (m.a === 'create') {
    if (ROOMS.size >= 21) return reply({ err: 'สร้างห้องได้สูงสุด 20 ห้อง' });
    let name = typeof m.name === 'string' ? m.name.trim().toLowerCase() : '';
    if (!name) name = randomRoomName();
    if (!ROOM_RE.test(name)) return reply({ err: 'ชื่อห้องใช้ได้เฉพาะ a-z 0-9 _ - ยาว 1-20 ตัว' });
    if (ROOMS.has(name)) return reply({ err: 'มีห้องชื่อนี้อยู่แล้ว' });
    ROOMS.set(name, { name, created: Date.now() }); saveRooms(); getWorld(name);
    console.log('ห้องใหม่:', name, '(สร้างโดย ' + p.name + ')');
    return reply({ created: name });
  }
  if (m.a === 'remove') { // เลิกใช้ห้อง (ข้อมูลเซฟยังอยู่ในโฟลเดอร์ data แต่เข้าผ่านลิงก์ไม่ได้แล้ว) ห้องหลักลบไม่ได้ และต้องไม่มีคนอยู่
    const name = String(m.name || '');
    if (name === DEFAULT_ROOM || !ROOMS.has(name)) return reply({ err: 'ลบห้องนี้ไม่ได้' });
    const w = worlds.get(name);
    if (w && w.players.size) return reply({ err: 'ยังมีคนอยู่ในห้องนี้' });
    if (w) { w.dirty = true; w.save(true); worlds.delete(name); }
    ROOMS.delete(name); saveRooms();
    return reply({ removed: name });
  }
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16384 });
// IP ของผู้เล่น: ถ้าอยู่หลัง proxy/tunnel (เช่น Cloudflare, ngrok) ใช้ค่าจาก header ไม่งั้นใช้ IP ของ socket (ผู้ดูแลเห็นเท่านั้น)
const ipOf = req => { const h = req.headers || {}, f = String(h['cf-connecting-ip'] || h['x-forwarded-for'] || '').split(',')[0].trim(); return (f || (req.socket && req.socket.remoteAddress) || '?').replace(/^::ffff:/, '').slice(0, 64); };
wss.on('connection', (ws, req) => {
  const ip = ipOf(req); let world = null, player = null, count = 0, authFails = 0;
  const rate = setInterval(() => { count = 0; }, 1000);
  const err = (text, extra) => ws.send(JSON.stringify(Object.assign({ t: 'err', text }, extra)));
  ws.on('message', raw => {
    if (++count > 60) return;
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (!player) {
      if (m.t !== 'join') return;
      const room = typeof m.room === 'string' && m.room ? m.room : DEFAULT_ROOM;
      if (!ROOM_RE.test(room) || !ROOMS.has(room)) return err('ไม่พบห้องนี้ ลิงก์อาจผิดหรือถูกปิดแล้ว');
      const w = getWorld(room);
      if (!w) return err('เซิร์ฟเวอร์มีห้องเต็มแล้ว');
      let admin = false;
      if (normName(m.name).toLowerCase() === ADMIN_NAME.toLowerCase()) { // ชื่อผู้ดูแลถูกสงวนไว้ ต้องมีรหัสเท่านั้น
        if (adminLocked()) return err('ใส่รหัสผิดบ่อยเกินไป รอสักครู่แล้วลองใหม่');
        if (!keyOk(m.akey || '')) {
          adminFails.push(Date.now()); console.warn('ใส่รหัสผู้ดูแลผิด');
          if (++authFails > 5) { ws.close(); return; }
          return err(m.akey ? 'รหัสผู้ดูแลไม่ถูกต้อง' : 'ชื่อนี้สงวนไว้สำหรับผู้ดูแล กรุณาใส่รหัสผู้ดูแล', { need: 'akey' });
        }
        admin = true;
      }
      const r = w.join(ws, m.name, m.color, admin);
      if (r.err) err(r.err);
      else {
        player = r.p; world = w; player.ip = ip;
        const rec = player.rec, now = Date.now(); rec.lastSeen = now; rec.ips = [{ ip, t: now }].concat((rec.ips || []).filter(x => x && x.ip !== ip)).slice(0, 5); w.dirty = true;
        console.log('เข้าเกม:', player.name, '←', ip, '(ห้อง ' + w.room + ')');
      }
      return;
    }
    if (m.t === 'admin') { if (player.admin) { try { adminHandle(player, world, m); } catch (e) { console.error('admin error', e); } } return; }
    try { world.handle(player, m); } catch (e) { console.error('handle error', m.t, e); } // ข้อความแปลกๆ จากผู้เล่นคนเดียวต้องไม่ทำให้เซิร์ฟเวอร์ล้ม
  });
  ws.on('close', () => { clearInterval(rate); if (player) world.leave(player); });
  ws.on('error', () => {});
});

const guard = fn => { try { fn(); } catch (e) { console.error('loop error', e); } }; // ลูปหลักพลาดครั้งเดียวไม่ควรทำให้ทั้งเกมดับ
let last = Date.now();
setInterval(() => {
  const now = Date.now(), dt = Math.min(0.5, (now - last) / 1000); last = now;
  for (const w of worlds.values()) guard(() => w.tick(dt, now));
}, 100);
setInterval(() => { const now = Date.now(); for (const w of worlds.values()) guard(() => w.cropTick(now)); }, 1000);
setInterval(() => { for (const w of worlds.values()) guard(() => w.save(false)); }, 30000);
setInterval(() => { const now = Date.now(); for (const w of worlds.values()) guard(() => w.marketTick(now)); }, +process.env.MARKET_TICK_MS || 60000); // ตลาดปรับราคาทุก 1 นาที

function shutdown() { for (const w of worlds.values()) { for (const p of w.players.values()) w.telFlush(p, true); w.arcRefundAll(); w.dirty = true; w.save(true); } process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => console.log(`My World รันอยู่ที่ http://localhost:${PORT}`));
