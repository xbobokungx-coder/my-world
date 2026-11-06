'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
// ผังที่ผู้ดูแลตั้งเอง (ย้ายร้าน/ตู้เกม/กองไฟ) อ่านก่อนโหลด shared.js เพื่อให้ทั้งเซิร์ฟเวอร์และเบราว์เซอร์สร้างแมพจากตำแหน่งเดียวกัน
const LAYOUT_FILE = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'layout.json');
const LAYOUT_HIST = path.join(path.dirname(LAYOUT_FILE), 'layout-history');
const readLayoutFile = f => { try { const d = JSON.parse(fs.readFileSync(f, 'utf8')); return d && typeof d.items === 'object' && d.items ? d : null; } catch (e) { return null; } };
globalThis.__LAYOUT = readLayoutFile(LAYOUT_FILE);
const S = require('./public/shared.js');
const { TS, T, CROPS, FISH, ANIMALS, SPAWN } = S;

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUB = path.join(__dirname, 'public');
// ล็อกให้มีห้องเดียว (ไม่สนค่า ?room= จากผู้เล่น) เปลี่ยนห้องได้ด้วยตัวแปร ROOM
const ROOM = /^[a-z0-9_-]{1,20}$/.test(process.env.ROOM || '') ? process.env.ROOM : 'main';
fs.mkdirSync(DATA_DIR, { recursive: true });

const { HFAST } = require('./server/consts.js'); // ย้ายไป server/consts.js
if (process.env.OCEAN_ANYTIME) S.OCEAN.anytime = true; // ทดสอบ: ออกเรือใหญ่ได้ทุกเวลา (ปกติ 06:00–15:00 เวลาเกม)
const SICK_CHECK = +process.env.SICK_CHECK_MS || S.SICK.checkMs, SICK_GRACE = +process.env.SICK_GRACE_MS || S.SICK.graceMs; // ไว้ทดสอบเท่านั้น // ไว้ทดสอบเท่านั้น: เร่งความหิวของคนและสัตว์
if (process.env.FRESH_START) S.FRESH.startAt = +process.env.FRESH_START; // ไว้ทดสอบ: เริ่มระบบความสดเร็วขึ้น (ms)
if (process.env.EVENT_NOW) { const d = new Date(Date.now() + 3000); S.EVENTS.list.unshift(Object.assign({}, S.EVENTS.list[0], { dow: d.getDay(), hour: d.getHours(), min: d.getMinutes(), mins: 1 })); } // ไว้ทดสอบ: อีเวนต์ตกปลาเริ่มภายในนาทีนี้ ยาว 1 นาที
const { rand, EVENT_DIR, logEv, replacer, send } = require('./server/util.js'); // ย้ายไป server/util.js (mkdir events ทำตอนโหลด ตำแหน่งเดิม)
const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_HAT = '#e8c66a';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const { PARTY } = require('./server/consts.js'); // เกมห้องหลายคน (ย้ายไป server/consts.js)
const TOOLS = new Set(['hand', 'hoe', 'water', 'rod', 'axe', 'pick', 'medicine', ...Object.values(ANIMALS).map(a => a.feedItem), ...Object.keys(CROPS).map(c => 'seed_' + c)]);
// ของที่ตลาดรับซื้อทั้งหมด (ราคาขึ้นลงตามอุปสงค์-อุปทาน)
const SELLABLE = S.SELLABLE; // รายการเดียวกับ shared.js (เคยก๊อปไว้สองที่แล้วตกหล่น เช่น น้ำผึ้ง)
const rodOf = inv => S.rodTier(inv);

// ชาวเมือง NPC: เดินท่องไปทั่วแมพ (หาทางด้วย BFS) และพิมพ์ข้อความสั้นๆ แนะนำเกม ขึ้นเป็นฟองเหนือหัวเท่านั้น (ไม่เข้าแชท)
const { NPC_DEFS } = require('./server/consts.js'); // ย้ายไป server/consts.js

const CAT_NAME = { fish: 'ปลา', crop: 'ผัก/ผลไม้', animal: 'ผลผลิตสัตว์', wood: 'ไม้', ore: 'แร่', dish: 'อาหาร' }; // ชื่อหมวดในข้อความแจ้งผู้เล่น
const { CAVE, ADMIN_NAME } = require('./server/consts.js'); // ฉากถ้ำเหมือง (ย้ายไป server/consts.js)
const HOUSE_MSG = new Set(['m', 'act', 'sw', 'held', 'status', 'deaf', 'voice', 'rtc', 'pcall', 'look', 'eat', 'pet', 'petname', 'petcare', 'lamp', 'chat', 'house', 'gift', 'greet']); // ข้อความที่ใช้ได้ตอนอยู่ในบ้าน (ที่เหลือเป็นเรื่องของเมือง)
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
    let counts = {}, mk = {}, houseSaved = {}, townSaved = {}; const treeKinds = {};
    this.mktDay = -1;
    try {
      const d = JSON.parse(fs.readFileSync(this.file, 'utf8').replace(/^﻿/, '')); // ตัด BOM ที่โปรแกรมแก้ไขบางตัวเติมให้
      this.farm = d.farm || {};
      if ((d.layout | 0) < 2) { // ผังเมืองใหม่ (v2): แปลงผักย้ายจาก x6–21,y8–17 ไป x3–18,y11–20 (ขนาดเท่าเดิม แค่เลื่อน −3,+3) ย้ายข้อมูลแปลงเดิมตามไปด้วย
        const moved = {};
        for (const [k, v] of Object.entries(this.farm)) { const [x, y] = k.split(',').map(Number); if (x >= 6 && x <= 21 && y >= 8 && y <= 17) moved[(x - 3) + ',' + (y + 3)] = v; }
        this.farm = moved; this.dirty = true;
      }
      this.saved = Object.assign(Object.create(null), d.players); // ไม่มี prototype: ชื่อผู้เล่นอย่าง "__proto__" จะได้ไม่ไปชนของในระบบ
      for (const rec of Object.values(this.saved)) { // ย้าย XP มาตาราง XP_TABLE (ครั้งเดียวต่อบัญชี) เลเวลเท่าเดิม
        if (!rec || rec.xpv === 3) continue;
        if (rec.xpv !== 2 && rec.skills) for (const k of Object.keys(rec.skills)) if (Number.isFinite(rec.skills[k])) rec.skills[k] = S.xpFromV1(rec.skills[k]);
        if (rec.skills) for (const k of Object.keys(rec.skills)) if (Number.isFinite(rec.skills[k])) rec.skills[k] = S.xpFromV2(rec.skills[k]); // xpv 3 (31 ต.ค. 2026): ยืดเลเวลต้น เลเวลเท่าเดิม
        rec.xpv = 3; this.dirty = true;
      }
      for (const rec of Object.values(this.saved)) { // ย้อนพิกัดจากทดลอง TS=64 กลับ TS=32
        if (!rec || !rec.px64) continue;
        if (Number.isFinite(rec.x)) rec.x /= 2;
        if (Number.isFinite(rec.y)) rec.y /= 2;
        delete rec.px64; this.dirty = true;
      }
      counts = d.animals || {}; this.treeMixV = d.treeMix | 0;
      if (Array.isArray(d.trees)) { // คืนสภาพต้นไม้ที่ตัด/งอกใหม่ไว้ (ต้นไม้ขอบแมพไม่เปลี่ยน)
        for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (S.isChoppable(this.map, x, y)) this.map[y][x] = T.GRASS;
        for (const [x, y, k] of d.trees) if (Number.isInteger(x) && Number.isInteger(y) && this.map[y] && this.map[y][x] === T.GRASS && x >= 1 && y >= 1 && x <= S.W - 2 && y <= S.H - 2 && !(x >= S.MINE.hill.x0 && x <= S.MINE.hill.x1 && y <= 7) && !Object.values(S.PENS).some(P => x >= P.x0 - 1 && x <= P.x1 + 1 && y >= P.y0 - 1 && y <= P.y1 + 1)) { this.map[y][x] = T.TREE; if (Object.hasOwn(S.TREE_KINDS, k)) treeKinds[x + ',' + y] = k; }
      }
      mk = d.market || {}; this.mktDay = Number.isInteger(d.mktDay) ? d.mktDay : -1;
      houseSaved = d.house || {}; townSaved = { evt: d.evt, chain: d.chain, invites: d.invites, stall: d.stall, orders: d.orders, rents: d.rents, log: d.log, lotto: d.lotto, stats: d.stats, village: d.village, week: d.week, banned: d.banned };
      this._loadMocks = d.mocks; this._loadMapOv = d.mapOv;
    } catch (e) {
      // ไม่มีไฟล์ = โลกใหม่ แต่ถ้ามีไฟล์แต่อ่านไม่ได้ ให้สำรองไว้ก่อน ไม่งั้นการบันทึกครั้งต่อไปจะเขียนทับข้อมูลเดิมทิ้ง
      if (e.code !== 'ENOENT') { try { fs.copyFileSync(this.file, this.file + '.broken-' + Date.now()); console.error('อ่านไฟล์บันทึกไม่ได้ สำรองไว้แล้ว:', e.message); } catch (e2) { /* ไม่มีอะไรให้สำรอง */ } }
    }
    this.mocks = S.sanitizeMocks(this._loadMocks); this.mapOv = S.sanitizeMapOv(this._loadMapOv); delete this._loadMocks; delete this._loadMapOv;
    for (const rec of Object.values(this.saved)) if (rec && rec.inv) this.achCheck(rec); // ผ่านความสำเร็จสายลงขันให้ผู้เล่นทุกคนที่มีเซฟ (รวมคนที่ออฟไลน์)
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
    // สัตว์เป็นของแต่ละคน (rec.herd) โผล่เล้าเฉพาะตอนเจ้าของออน — ไม่โหลดฝูงกลางเก่าจาก counts
    this.lastCrop = Date.now();
    this.tables = {};
    S.CABINETS.forEach((c, i) => {
      if (!c.game) return;
      this.tables['cab' + i] = c.game === 'uno' ? this.newUnoTable('cab' + i, c, i) : PARTY.has(c.game) ? this.newPartyTable('cab' + i, c, i) : this.newTable('cab' + i, c, i);
    });
    this.treeHp = new Map(); this.treeTimer = 0; this.sickTimer = 0;
    this.treeKind = new Map(); // ชนิดต้นไม้ต่อช่อง 'x,y' (S.TREE_KINDS) ต้นที่ยังไม่มีชนิด (เซฟเก่า/แมพใหม่) สุ่มตามที่เกิดแบบคงที่จากตำแหน่ง
    for (const [x, y] of this.treeList()) { const k = treeKinds[x + ',' + y]; this.treeKind.set(x + ',' + y, k || S.pickTreeKind(this.map, x, y, S.rng(x * 7919 + y * 104729))); }
    if (this.treeMixV !== 2) { // ย้ายครั้งเดียว (30 ต.ค. 2026): แจกชนิดต้นไม้ใหม่ทั้งแมพตามโควตา % จากง่ายไปยาก (S.TREE_KINDS[..].pct)
      const plan = S.planTreeMix(this.map, this.treeList().map(([x, y]) => [x, y]), S.rng(20261030));
      for (const [x, y] of plan.drop) { this.map[y][x] = T.GRASS; this.treeKind.delete(x + ',' + y); }
      for (const [x, y] of plan.add) this.map[y][x] = T.TREE;
      for (const [k, v] of plan.kinds) this.treeKind.set(k, v);
      this.treeMixV = 2; this.dirty = true;
    }
    this.applyMapOv(); // ทับช่องที่ผู้ดูแลวาดไว้ (หลังต้นไม้จากเซฟ) ให้การแก้แมพติดถาวร
    this.trades = new Map(); this.nextTrade = 1;
    this.cinema = { movie: null, yt: '', name: '', startedAt: 0, pos: 0, ref: 0, playing: false, emptyAt: 0, viewers: new Set(), paid: new Set() };
    this.treeCap = S.TREE.cap; // เพดานคงที่ (เดิมบวกเพิ่มทุกครั้งที่ restart ทำให้ต้นไม้แน่นขึ้นเรื่อยๆ)
    { const t = this.treeList(); if (t.length > this.treeCap) { for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } for (const [x, y] of t.slice(this.treeCap)) this.map[y][x] = T.GRASS; this.dirty = true; } } // ถ้าเกินเพดาน สุ่มตัดแต่งให้เหลือพอดี
  }

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
  }
  // ----- ถ้ำเหมือง 10 ชั้น: แต่ละชั้นเป็นฉากร่วมของทั้งห้อง (p.scene = CAVE + เลขชั้น เช่น '@cave3') ผังสุ่มตายตัวจาก S.makeCaveMap(ชั้น) ก้อนแร่ขุดแล้วเกิดใหม่ตามเวลา (ไม่เก็บลงไฟล์ เริ่มเซิร์ฟเวอร์ใหม่ = แร่เต็ม)
  // ชั้นสร้างตอนมีคนเข้าครั้งแรก: { map: ผัง (ก้อนแร่เป็น T.ORE), ores: Map 'x,y' → {k ชนิด, s ขนาด}, hp: Map HP ที่เหลือ, wait: คิวเกิดใหม่ }
  initCave() { this.floors = new Map(); }
  floorOf(f) {
    let F = this.floors.get(f); if (F) return F;
    const map = S.makeCaveMap(f), ores = new Map();
    if (!S.isSeaScene(f)) for (const o of S.caveOreSpots(map, f)) { ores.set(o.x + ',' + o.y, { k: o.k, s: o.s }); map[o.y][o.x] = T.ORE; }
    F = { map, ores, hp: new Map(), wait: [], cap: Math.max(1, ores.size) }; this.floors.set(f, F); return F; // cap = จำนวนก้อนเต็มของชั้น (ไว้คิดโควตาชนิดแร่ตอนเกิดใหม่)
  }
  oresPub(f) { return [...this.floorOf(f).ores].map(([k, o]) => { const [x, y] = k.split(',').map(Number); return [x, y, o.k, o.s]; }); }
  oreSpot(F, f, mates, old) { // ช่องสำหรับก้อนแร่ใหม่ในชั้น f (ช่องเดิม old ก่อน ไม่ได้ค่อยสุ่ม): เป็นพื้นว่าง ไม่ใกล้ทางออก/บันไดลง/ผู้เล่น และพื้นที่เดินที่เหลือยังต่อถึงกันหมด ทุกก้อนยังมีที่ยืนขุด (กติกาเดียวกับตอนวางครั้งแรก) • ไม่พบ = null
    if (F.open === undefined) { let n = 0; for (const r of F.map) for (const c of r) if (S.caveOpen(c)) n++; F.open = n + F.ores.size; } // พื้นเดินได้ทั้งหมดถ้าไม่มีก้อนแร่
    const m = F.map, free = (x, y) => S.DIRS.filter(([dx, dy]) => S.caveOpen(m[y + dy][x + dx])).length;
    const cand = []; // ทุกช่องที่ผ่านเงื่อนไขเบื้องต้น แล้วสุ่มลำดับ (แร่ห่างกันหลายช่อง ช่องที่ใช้ได้มีน้อย สุ่มเดาจะพลาดบ่อย)
    for (let y = S.CAVE.y0 + 1; y < S.CAVE.y1; y++) for (let x = S.CAVE.x0 + 1; x < S.CAVE.x1; x++) {
      if (m[y][x] !== T.CAVE || Math.hypot(x - 31, y - (S.CAVE.y1 - 1)) < 5 || !free(x, y) || S.oreNear(m, x, y)) continue; // ห่างก้อนอื่นอย่างน้อย MINE.oreGap ช่อง
      if ([-1, 0, 1].some(dy => [-1, 0, 1].some(dx => m[y + dy][x + dx] === S.T.DOWN))) continue;
      if (mates.some(q => Math.abs(q.x - (x + 0.5) * TS) < TS * 1.5 && Math.abs(q.y - (y + 0.5) * TS) < TS * 1.5)) continue;
      cand.push([x, y]);
    }
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    const at = old ? cand.findIndex(([x, y]) => x === old.x && y === old.y) : -1; if (at > 0) cand.unshift(cand.splice(at, 1)[0]); // ช่องเดิมที่เพิ่งขุด (old) ลองก่อน ถ้าไม่ผ่านเงื่อนไขค่อยใช้ช่องสุ่มอื่น
    for (const [x, y] of cand.slice(0, 40)) {
      m[y][x] = T.ORE;
      const ok = S.caveReach(m) === F.open - F.ores.size - 1 && !S.DIRS.some(([dx, dy]) => m[y + dy][x + dx] === T.ORE && !free(x + dx, y + dy));
      m[y][x] = T.CAVE;
      if (ok) return [x, y];
    }
    return null;
  }
  oreTick(now) { // ก้อนแร่ที่ขุดไปครบเวลา MINE.respawnMs เกิดใหม่ที่ช่องเดิม (ถ้าไม่ว่างค่อยสุ่มช่องใหม่) ในชั้นเดิม (สุ่มชนิด/ขนาดใหม่ตามชั้น ไม่มีช่องใหม่ = เกิดที่เดิม)
    for (const [f, F] of this.floors) {
      if (!F.wait.length) continue;
      const rest = [], mates = this.sceneMates(CAVE + f), counts = {}; for (const o of F.ores.values()) counts[o.k] = (counts[o.k] || 0) + 1;
      for (const w of F.wait) {
        if (now < w.at) { rest.push(w); continue; }
        const spot = this.oreSpot(F, f, mates, w) || (S.oreNear(F.map, w.x, w.y) || mates.some(q => Math.abs(q.x - (w.x + 0.5) * TS) < TS && Math.abs(q.y - (w.y + 0.5) * TS) < TS) ? null : [w.x, w.y]);
        if (!spot) { w.at = now + 5000; rest.push(w); continue; } // ไม่มีที่ให้เกิด/มีคนยืนทับที่เดิม รอรอบหน้า
        const [x, y] = spot, o = { k: S.rollOreQuota(f, Math.random, counts, F.cap), s: S.rollSize(Math.random, f) }; counts[o.k] = (counts[o.k] || 0) + 1;
        F.ores.set(x + ',' + y, o); F.map[y][x] = T.ORE;
        this.sceneBroadcast(CAVE + f, { t: 'ore', x, y, k: o.k, s: o.s });
      }
      F.wait = rest;
    }
  }
  enterCave(p) {
    if (p.scene) return;
    if (p.veh) this.setVeh(p, '');
    this.arcLeave(p); this.tradeCancel(p, 'ผู้เล่นเข้าถ้ำ'); if (this.cinema.viewers.delete(p.id)) this.cinemaBroadcast();
    p.ret = { x: (Math.floor(p.x / TS) + 0.5) * TS, y: (S.MINE.y + 1.5) * TS }; // ออกมายืนหน้าปากถ้ำ (ไม่ทับช่องปากถ้ำ ไม่งั้นเข้าซ้ำ)
    this.changeScene(p, CAVE + 1, S.CAVE.spawn.x, S.CAVE.spawn.y);
    this.toast(p, '⛏️ เข้าถ้ำเหมือง ชั้น 1! ใช้อีเต้อ ⚒️ (ร้านช่างเหมือง) ขุดก้อนแร่ • บันไดลงอยู่ห้องไกลสุด ยิ่งลึกยิ่งได้แร่ดี • พกตะเกียง 🔦 จะเห็นไกลขึ้น • ทางออกกลางผนังล่าง');
  }
  leaveCave(p) {
    if (!S.caveFloor(p.scene)) return;
    const r = this.townPos(p); p.ret = null;
    this.changeScene(p, null, r.x, r.y);
  }
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
  }
  caveLanding(f) { // ช่องยืนข้างบันไดลงของชั้น f (ขึ้นมาจากชั้นล่างแล้วไม่ทับบันไดจนลงซ้ำ)
    const F = this.floorOf(f); if (F.landing) return F.landing;
    let best = null;
    for (let y = 0; y < S.H && !best; y++) for (let x = 0; x < S.W && !best; x++) if (F.map[y][x] === T.DOWN) {
      for (const [dx, dy] of S.DIRS) if (F.map[y + dy][x + dx] === T.CAVE) { best = { x: (x + dx + 0.5) * TS, y: (y + dy + 0.5) * TS }; break; }
    }
    return F.landing = best || S.CAVE.spawn;
  }
  caveMove(p, f, to) { // ย้ายชั้น (to = ชั้นใหม่) ขึ้นมาจากชั้นล่างยืนข้างบันไดลง ลงมาจากชั้นบนยืนที่จุดเกิด
    const at = to < f ? this.caveLanding(to) : S.CAVE.spawn;
    if (!S.isSeaScene(to) && to > (p.rec.deep || 1) && to <= S.MINE.floors) { p.rec.deep = to; send(p, { t: 'deep', n: to }); this.dirty = true; } // จำชั้นลึกสุดที่เดินลงถึง (ไว้ซื้อตั๋วลงตรง)
    this.changeScene(p, CAVE + to, at.x, at.y);
    this.toast(p, `⛏️ ถ้ำเหมือง ชั้น ${to}${to === S.MINE.floors ? ' (ชั้นลึกสุด มิทริล 70% มูนสโตน 30%)' : ''} • แร่ส่วนใหญ่ระดับ ${to}`);
  }
  mineTicket(p, f) { // ตั๋วลงเหมือง: จ่ายเหรียญลงตรงไปชั้น f (≤ ชั้นลึกสุดที่เดินลงถึงเอง) ต้องอยู่ในเมืองใกล้ร้านช่างเหมือง • เงินจมล้วน (ลงเดินเองฟรีเหมือนเดิม)
    if (!Number.isInteger(f) || f < 2 || f > S.MINE.floors) return;
    if (p.scene) return this.toast(p, 'ซื้อตั๋วลงเหมืองได้ตอนอยู่ในเมือง');
    if (this.nearShopKind(p) !== 'mine') return this.toast(p, 'ต้องยืนใกล้ร้านช่างเหมือง ⚒️ ถึงซื้อตั๋วได้');
    if (f > (p.rec.deep || 1)) return this.toast(p, `ยังไม่เคยลงถึงชั้น ${f} ลงเดินเองให้ถึงชั้นนี้ก่อนครั้งแรก แล้วค่อยซื้อตั๋วได้`);
    const fee = S.MINE.fee[f]; if ((p.rec.inv.coin || 0) < fee) return this.toast(p, `เหรียญไม่พอ ตั๋วลงชั้น ${f} ราคา 🪙${fee}`);
    this.add(p, 'coin', -fee, 'mineticket'); logEv(this.room, 'mineticket', { p: p.key, f, fee });
    this.enterCave(p); if (S.caveFloor(p.scene) !== 1) { this.add(p, 'coin', fee, 'mineticket'); return; } // เข้าถ้ำไม่ได้ (เช่นมีเงื่อนไขอื่นขวาง) คืนเงิน
    this.caveMove(p, 1, f); this.toast(p, `🎫 ใช้ตั๋วลงชั้น ${f} (-🪙${fee})`); this.sfxTo(p, 'coin');
  }
  houseMap() { return this.hmap; } // แมพบ้านเป็นผนัง/พื้นเหมือนกันทุกหลัง (ของตกแต่งอยู่นอกตาราง ดู houseRects)
  houseRects(key) { let r = this.hrects.get(key); if (!r) { r = S.houseSolidRects(this.houses[key] ? this.houses[key].items : {}); this.hrects.set(key, r); } return r; }
  mapOf(p) { const f = S.caveFloor(p.scene); return f ? this.floorOf(f).map : p.scene ? this.houseMap() : this.map; }
  blockedFor(p, x, y) { const f = S.caveFloor(p.scene); return f ? S.blockedAt(this.floorOf(f).map, x, y) : p.scene ? S.houseBlockedAt(this.houseMap(), this.houseRects(p.scene), x, y, p.x, p.y) : S.blockedAt(this.map, x, y); } // ในบ้านรวมกล่องเฟอร์นิเจอร์ (ถ้าอยู่ในกล่องอยู่แล้ว เช่นเพิ่งลุกจากเก้าอี้ เดินออกได้)
  adminSend(o) { for (const q of this.players.values()) if (q.admin) send(q, o); }
  nameOfKey(key) { return (this.saved[key] && this.saved[key].name) || key; }
  houseStyle(key) { const h = this.houses[key] || {}; return { fl: h.fl || S.HOUSE_STYLE_DEFAULT.fl, wp: h.wp || S.HOUSE_STYLE_DEFAULT.wp }; }
  houseItemsPub(key) { const h = this.houses[key]; return h ? Object.entries(h.items).map(([i, it]) => Object.assign({ i: +i }, it)) : []; }
  houseBoard(p) { // ลีดเดอร์บอร์ดบ้านที่ตกแต่งแล้ว: เรียงตามมูลค่าเฟอร์นิเจอร์ แล้วตามจำนวนชิ้น
    const rows = [];
    for (const [key, h] of Object.entries(this.houses)) {
      if (key === ADMIN_NAME.toLowerCase()) continue; // บ้านผู้ดูแลไม่ลงอันดับ ไม่ปนกับผู้เล่น
      const sc = S.houseScore(h.items);
      if (sc.count > 0) rows.push({ n: this.nameOfKey(key), v: sc.value, c: sc.count, on: [...this.players.values()].some(q => q.key === key) ? 1 : 0, me: key === p.key ? 1 : 0 });
    }
    rows.sort((a, b) => b.v - a.v || b.c - a.c || (a.n < b.n ? -1 : 1));
    return rows.slice(0, 100);
  }
  sceneMates(scene, except) { const sc = scene || null; return [...this.players.values()].filter(q => q !== except && (q.scene || null) === sc); }
  sceneBroadcast(scene, o, except) { const s = JSON.stringify(o); for (const q of this.sceneMates(scene, except)) if (q.ws.readyState === 1) q.ws.send(s); }
  pubFull(q) { return { id: q.id, wet: q.rec && q.rec.wet > Date.now() ? 1 : 0, veh: q.veh || '', held: q.held || '', status: q.status || '', deaf: !!q.deaf, title: q.title, name: q.name, color: q.color, hat: q.hat, pc: q.pc, wear: q.wear, lamp: q.lamp, pet: q.pet, pm: q.pm, pax: q.pax, pay: q.pay, psick: !!(q.pet && this.petSt(q, q.pet).sick), pname: q.pet ? this.petName(q, q.pet) : '', x: q.x, y: q.y, dir: q.dir, voice: !!q.voice }; }
  townPos(p) { const r = p.scene ? p.ret : { x: p.x, y: p.y }; return r && !S.blockedAt(this.map, r.x, r.y) ? r : { x: SPAWN.x, y: SPAWN.y }; } // ตำแหน่งในเมืองที่จะบันทึก/กลับไป (ถ้าอยู่ในบ้านคือที่ที่ยืนก่อนเข้า)
  changeScene(p, scene, x, y) { // ย้ายผู้เล่นไปฉากใหม่: คนฉากเก่าเห็นเขาหายไป คนฉากใหม่เห็นเขาโผล่ ตัวเองได้รับฉากใหม่
    const old = p.scene || null; scene = scene || null;
    this.sceneBroadcast(old, { t: 'p-', id: p.id, quiet: 1 }, p);
    p.scene = scene; p.x = x; p.y = y; p.sit = null; p.dir = 0;
    if (p.fish) { p.fish = null; send(p, { t: 'fg', off: 1 }); }
    this.sceneBroadcast(scene, Object.assign({ t: 'p+', quiet: 1 }, this.pubFull(p)), p);
    send(p, { t: 'scene', sc: scene, owner: scene && !S.caveFloor(scene) ? this.nameOfKey(scene) : '', mine: scene === p.key, x, y, items: scene && !S.caveFloor(scene) ? this.houseItemsPub(scene) : [], st: scene && !S.caveFloor(scene) ? this.houseStyle(scene) : null, cave: S.caveFloor(scene), until: S.isSeaScene(S.caveFloor(scene)) ? p.seaUntil || 0 : 0, ores: S.caveFloor(scene) ? this.oresPub(S.caveFloor(scene)) : [], players: [...this.sceneMates(scene, p), p].map(q => this.pubFull(q)) });
    this.dirty = true;
  }
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
  }
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
  }

  // ----- เมือง: กระดานข่าว (log โลก 50 รายการล่าสุด) -----
  loadTown(d) {
    this.evt = d.evt && typeof d.evt === 'object' ? d.evt : { key: '', scores: {}, done: true }; // อีเวนต์ประจำสัปดาห์ที่กำลังนับคะแนน
    this.chain = Number.isFinite(d.chain) ? d.chain : 0; this.invites = d.invites && typeof d.invites === 'object' ? d.invites : {}; // ชาเลนจ์ถังน้ำ: จำนวนที่ทำสำเร็จทั้งเมือง + รหัสลิงก์ท้า
    this.stall = (Array.isArray(d.stall) ? d.stall : []).filter(x => x && typeof x.seller === 'string' && typeof x.item === 'string' && x.n > 0 && x.price > 0); this.stallNext = this.stall.reduce((a, x) => Math.max(a, x.id || 0), 0) + 1;
    this.orders = d.orders && Array.isArray(d.orders.list) ? d.orders : { day: '', list: [], by: {} };
    this.rents = {}; for (const P of S.FARM_RENT.plots) { const r = d.rents && d.rents[P.id]; if (r && typeof r.key === 'string' && Number.isFinite(r.until)) { if (r.until - Date.now() > S.FARM_RENT.ms) { this.dirty = true; continue; } /* เช่าเกิน 1 วันจริง (สัญญาเก่า) ตัดออกเลย */ this.rents[P.id] = { key: r.key, name: String(r.name || r.key).slice(0, 12), until: r.until }; } } // แปลงเช่า
    this.log = (Array.isArray(d.log) ? d.log : []).filter(e => Array.isArray(e) && Number.isFinite(e[0]) && typeof e[1] === 'string').slice(-S.TOWN.logMax).map(e => [e[0], e[1].slice(0, 120)]);
    this.loadVillage(d.village); this.loadWeek(d.week); this.loadProjects(d.projects); this.loadLotto(d.lotto);
    this.banned = new Set(Array.isArray(d.banned) ? d.banned.filter(x => typeof x === 'string').map(x => x.toLowerCase().slice(0, 24)) : []); // ชื่อ (key) ที่ผู้ดูแลแบน: เข้าเกมไม่ได้จนกว่าจะใช้ชื่ออื่น
    const st = d.stats || {}; this.stats = { day: typeof st.day === 'string' ? st.day : '', ev: {} };
    for (const ev of Object.keys(S.FAME)) { const m = Object.create(null), o = st.ev && st.ev[ev]; if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (Number.isFinite(v)) m[k] = v; this.stats.ev[ev] = m; }
  }
  addLog(text) { const e = [Date.now(), text]; this.log.push(e); if (this.log.length > S.TOWN.logMax) this.log.shift(); this.dirty = true; this.broadcast({ t: 'log', e }); }
  loadProjects(d) { // โครงการพัฒนาเมือง: เก็บเงินที่ลงขันและชื่อผู้ร่วมสร้าง (ชื่อ → ยอดรวม)
    this.projects = {};
    for (const P of S.PROJECTS) {
      const o = d && d[P.id] || {}, don = Object.create(null);
      if (o.donors && typeof o.donors === 'object') for (const [nm, v] of Object.entries(o.donors)) if (Number.isFinite(v) && v > 0) don[String(nm).slice(0, 12)] = Math.floor(v);
      this.projects[P.id] = { coin: P.goal, donors: don }; // สะพาน/ประภาคาร/เกาะ มีให้เลยตั้งแต่ต้น (ไม่ต้องลงขัน)
    }
  }
  creditInv(key, item, n) { // เพิ่มของให้ผู้เล่น (อาจออฟไลน์): อัปเดตทั้งในเกมและไฟล์เซฟ
    const p = [...this.players.values()].find(q => q.key === key), rec = (p && p.rec) || this.saved[key]; if (!rec) return;
    rec.inv[item] = Math.max(0, (rec.inv[item] || 0) + n); if (!rec.inv[item]) delete rec.inv[item];
    if (p) send(p, { t: 'inv', inv: rec.inv }); this.dirty = true;
  }
  // ----- แต้มตู้เกม (arcade points): เล่นจบ/ชนะคนจริงได้แต้ม ใช้แลกของโชว์ + จัดอันดับ Leaderboard -----
  arcOf(rec) {
    if (!rec.arc || typeof rec.arc !== 'object') rec.arc = { pts: 0, total: 0, wk: 0, wkKey: 0 };
    const wk = this.weekKey(); if (rec.arc.wkKey !== wk) { rec.arc.wk = 0; rec.arc.wkKey = wk; }
    return rec.arc;
  }
  arcPub(rec) { const a = this.arcOf(rec); return { pts: a.pts, total: a.total, wk: a.wk, tt: a.tt || [] }; }
  arcBuy(p, id) { // ร้านรางวัลแต้มตู้เกม: ใช้แต้ม (ไม่ใช่เหรียญ) แลกของหายาก/ฉายา • ฉายาที่มีแล้วกดซ้ำ = ใช้ฉายานั้น
    const d = S.ARC_SHOP.find(x => x.id === id), a = this.arcOf(p.rec); if (!d) return;
    if (d.title && (a.tt || []).includes(id)) { p.rec.ttl = 'arc:' + id; p.title = this.titleOf(p.rec); this.broadcast({ t: 'title', id: p.id, title: p.title }); this.dirty = true; return this.toast(p, `🏅 ใช้ฉายา "${d.title}"`); }
    if (a.pts < d.pts) return this.toast(p, `แต้มตู้เกมไม่พอ (ต้องใช้ ${d.pts} มี ${a.pts})`);
    a.pts -= d.pts; this.dirty = true;
    if (d.title) { (a.tt || (a.tt = [])).push(id); p.rec.ttl = 'arc:' + id; p.title = this.titleOf(p.rec); this.broadcast({ t: 'title', id: p.id, title: p.title }); this.toast(p, `🏅 แลกฉายา "${d.title}" แล้ว (ใช้อยู่ตอนนี้)`); }
    else { this.add(p, d.id, 1); const i = S.itemInfo(d.id); this.toast(p, `🎁 แลก ${i.emoji} ${i.name} แล้ว (อยู่ในกระเป๋า วางในบ้านได้)`); }
    logEv(this.room, 'arcbuy', { p: p.key, id, pts: d.pts }); this.addLog(`🎮 ${p.name} แลกรางวัลตู้เกม ${d.title ? 'ฉายา "' + d.title + '"' : S.itemInfo(d.id).name}`);
    send(p, { t: 'arcpts', arc: this.arcPub(p.rec) }); this.sfxTo(p, 'levelup');
  }
  arcAward(key, play, won) { // ให้แต้ม (ออนไลน์/ออฟไลน์): play = แต้มเล่นจบ, won = ชนะคนจริงได้โบนัส
    if (!key) return;
    const p = [...this.players.values()].find(q => q.key === key), rec = (p && p.rec) || this.saved[key]; if (!rec) return;
    const a = this.arcOf(rec), day = this.today(); if (a.day !== day) { a.day = day; a.dayPts = 0; }
    const gain = Math.min(play + (won ? S.ARCPTS.win : 0), Math.max(0, S.ARCPTS.dailyCap - a.dayPts)); a.dayPts += gain;
    a.pts += gain; a.total += gain; a.wk += gain; this.dirty = true;
    this.achAdd(rec, 'arcplay'); if (won) this.achAdd(rec, 'arcwin'); if (p) { this.wk1Step(p, 'arcplay'); if (won) this.evHit(p, 'arcwin'); }
    if (p) { send(p, { t: 'arcpts', arc: this.arcPub(rec) }); this.toast(p, gain ? `🎮 +${gain} แต้มตู้เกม${won ? ' (ชนะ!)' : ''} • มีอยู่ ${a.pts}` : `🎮 วันนี้ได้แต้มตู้เกมครบ ${S.ARCPTS.dailyCap} แล้ว พรุ่งนี้มาใหม่นะ`); }
  }
  sendLeaderboard(p) { // อันดับแต้มตู้เกมในห้องนี้ (สะสมตลอดกาล + สัปดาห์นี้) Top 10
    const arr = [];
    for (const [k, r] of Object.entries(this.saved)) { const a = this.arcOf(r); if (a.total > 0) arr.push({ name: r.name || k, total: a.total, wk: a.wk }); }
    const top = key => arr.slice().sort((x, y) => y[key] - x[key]).slice(0, 10);
    send(p, { t: 'lb', total: top('total'), wk: top('wk').filter(x => x.wk > 0), me: this.arcPub(p.rec) });
  }
  // ----- เควสประจำวัน + แต้มความดี + บัฟ + สถิติประจำวัน (Hall of Fame) -----
  today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
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
  }

  catJoin(p) { // ความอิ่มตัวของตลาดหมวดฟื้นตามเวลาจริงที่ผ่านไปแม้ออฟไลน์ (เหมือนพลังงาน) catAt = ครั้งล่าสุดที่คิดการฟื้น
    const ct = p.rec.cat, now = Date.now(), min = Math.max(0, (now - (p.rec.catAt || now)) / 60000), f = Math.pow(1 - S.CATFAT.recover, min);
    if (ct) for (const k of Object.keys(ct)) { ct[k] = 1 - (1 - ct[k]) * f; if (ct[k] > 0.995) delete ct[k]; }
    p.rec.catAt = now;
  }
  catOf(p, cat) { const o = p.rec.cat; return o && Number.isFinite(o[cat]) ? o[cat] : 1; }
  catPub(p) { const o = p.rec.cat || {}, c = {}; for (const k of Object.keys(o)) if (o[k] < 0.995) c[k] = Math.round(o[k] * 1000) / 1000; return { t: 'cat', c, recover: S.CATFAT.recover }; }
  catPush(p) { send(p, this.catPub(p)); }

  // ----- เติบโต/ดึงให้กลับมาเล่น: คู่มือเริ่มต้น + สมุดสะสม + เข้าเกมติดต่อกัน + เป้าหมายรายสัปดาห์ของเมือง -----
  dayStr(offset) { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
  weekKey() { // สัปดาห์แบบ ISO (เริ่มวันจันทร์)
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const w1 = new Date(d.getFullYear(), 0, 4);
    return `${d.getFullYear()}-W${1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7)}`;
  }


  dayOf(t) { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }


  // ----- ตลาดราคาไดนามิก: ขายเยอะราคาตก ปล่อยไว้ราคาค่อยๆ กลับ และทุก 1 วันในเกมราคาเป้าหมายสุ่มใหม่ (มีข่าวราคาพุ่ง/ตก) -----
  pmOf(p, k) { const o = p.rec.mk; return o && Number.isFinite(o[k]) ? o[k] : 1; }
  effMult(p, k) { const g = this.market[k]; return g ? g.m * this.pmOf(p, k) * this.catOf(p, S.sellCat(k)) : 1; } // ตลาดกลาง × ตลาดส่วนตัว × ความอิ่มตัวของหมวด
  mktFor(p) { const o = {}; for (const k of SELLABLE) o[k] = Math.round(this.effMult(p, k) * 100) / 100; return o; }
  mktSend(keys) { for (const p of this.players.values()) { const o = {}; for (const k of keys || SELLABLE) o[k] = Math.round(this.effMult(p, k) * 100) / 100; send(p, { t: 'mkt', m: o }); } }
  mktPub() { const o = {}; for (const k of SELLABLE) o[k] = Math.round(this.market[k].m * 100) / 100; return o; }
  marketTick(now) {
    if (!this.players.size) return; // โลกจำศีล: ไม่มีคนออนไลน์ ตลาดไม่เดิน
    const day = Math.floor(now / S.DAY_MS);
    if (day !== this.mktDay) {
      this.mktDay = day;
      for (const k of SELLABLE) { const sz = k.startsWith('crop_') ? S.cropSeason(k.slice(5), now) : 0; this.market[k].t = Math.min(S.MARKET.max, Math.min(1.3, Math.max(0.75, 1 + (Math.random() - 0.5) * 0.4)) * (sz > 0 ? S.SEASONS.inMul : sz < 0 ? S.SEASONS.outMul : 1)); } // ฤดูกาล: พืชในฤดูราคาดีกว่า
      { const se = S.seasonAt(now); if (se.on && this.seasonId !== se.s.id) { if (this.seasonId) { const m = `${se.s.emoji} เข้าสู่${se.s.name}แล้ว! พืชในฤดู: ${se.s.crops.map(c => CROPS[c].emoji).join(' ')} ราคาดี โตเร็ว (พืชนอกฤดูโตช้าลง)`; this.broadcast({ t: 'msg', text: m }); this.addLog(m); } this.seasonId = se.s.id; } }
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
  }
  sfx(p, k) { this.broadcast({ t: 'sfx', k, id: p.id, x: Math.round(p.x), y: Math.round(p.y) }); }
  sfxTo(p, k) { send(p, { t: 'sfx', k, id: p.id, x: Math.round(p.x), y: Math.round(p.y), self: 1 }); }


  broadcast(o, except) {
    const s = JSON.stringify(o);
    for (const p of this.players.values()) if (p !== except && p.ws.readyState === 1) p.ws.send(s);
  }
  toast(p, text) { send(p, { t: 'msg', text }); }
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
  }
  // ----- ความสดของสินค้า (S.FRESH): rec.lots[ชนิด] = [[เวลาที่ได้, จำนวน], ...] เรียงของเก่าก่อน รวมแล้วเท่ากับจำนวนในกระเป๋าเสมอ -----
  lotsOf(rec, k) { // ปรับให้ตรงกับกระเป๋า (ของที่เข้ากระเป๋าโดยไม่ผ่าน add เช่น ผู้ดูแลให้ = นับเป็นของใหม่)
    const L = (rec.lots || (rec.lots = {}))[k] || (rec.lots[k] = []), have = rec.inv[k] || 0;
    let sum = L.reduce((a, x) => a + x[1], 0);
    if (sum < have) L.push([Date.now(), have - sum]);
    while (sum > have && L.length) { const d = Math.min(L[0][1], sum - have); L[0][1] -= d; sum -= d; if (!L[0][1]) L.shift(); }
    if (!L.length) delete rec.lots[k];
    return L;
  }
  lotPut(rec, k, lots) { const L = this.lotsOf(rec, k); for (const [t, n] of lots) { if (!(n > 0)) continue; const last = L[L.length - 1]; if (last && Math.abs(last[0] - t) < 60000) last[1] += n; else L.push([t, n]); } L.sort((a, b) => a[0] - b[0]); rec.lots[k] = L; }
  lotTake(rec, k, n) { const L = this.lotsOf(rec, k), out = []; while (n > 0 && L.length) { const d = Math.min(L[0][1], n); out.push([L[0][0], d]); L[0][1] -= d; n -= d; if (!L[0][1]) L.shift(); } if (!L.length) delete rec.lots[k]; return out; }
  hasFridge(key) { const h = this.houses[key]; return !!(h && Object.values(h.items).some(it => it && it.f === 'fridge')); } // ตู้เย็นวางในบ้าน = ของในกระเป๋าเสื่อมช้าลง
  freshPub(rec, key) { const o = {}; for (const k of Object.keys(rec.inv)) if (S.perishable(k) && rec.inv[k] > 0) o[k] = this.lotsOf(rec, k).map(([t, n]) => [t, n]); return { l: o, fz: this.hasFridge(key) }; }
  lv(p, skill) { return S.levelOf(p.rec.skills[skill]); }
  addXp(p, skill, n) {
    const xb = this.petBonus(p).xp; if (xb > 0 && n > 0) { const f = n * (1 + xb); n = Math.floor(f) + (Math.random() < f - Math.floor(f) ? 1 : 0); } // 📚 สัตว์เลี้ยง: XP เพิ่ม (ปัดแบบสุ่มตามเศษ ไม่ให้ค่าน้อยๆ สูญ)
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
    if (!rec) rec = this.saved[key] = { firstSeen: Date.now(), inv: { coin: 50, seed_carrot: 5, feed: 5, bait: 10, meal_bread: 3 }, mig2: true, xpv: 3, gift: S.NEWBIE.gift[Math.floor(Math.random() * S.NEWBIE.gift.length)], x: S.START_SPAWN.x, y: S.START_SPAWN.y, color: HEX.test(color) ? color : '#3498db' };
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
    if (rec.veh && !(S.VEHICLES[rec.veh] && rec.inv['veh_' + rec.veh])) rec.veh = '';
    if (S.blockedAt(this.map, rec.x, rec.y)) { rec.x = SPAWN.x; rec.y = SPAWN.y; }
    const p = { id: this.nextId++, ws, key, name, admin: !!admin, color: rec.color, hat: rec.hat, pc: rec.pc, wear: rec.wear, lamp: !!rec.lamp, pet: rec.pet, veh: rec.veh || '', pm: rec.pmode, pax: rec.x, pay: rec.y, sit: null, title: this.titleOf(rec), rec, x: rec.x, y: rec.y, dir: 0, fish: null, lastChat: 0, lastAct: 0, activeAt: Date.now(), voice: false };
    this.players.set(p.id, p); p.joinedAt = Date.now(); rec.joins = (rec.joins || 0) + 1;
    this.loadHerd(p); // สัตว์ของบัญชีนี้โผล่ในเล้าตอนเข้าเกม
    logEv(this.room, 'join', { p: key, first: rec.joins === 1, joins: rec.joins, since: rec.firstSeen || null });
    const now = Date.now(), farm = {};
    for (const k in this.farm) farm[k] = this.pub(this.farm[k], now);
    send(p, {
      t: 'w', deep: rec.deep || 1, first: rec.joins === 1, admin: !!admin, id: p.id, x: p.x, y: p.y, inv: rec.inv, fr: this.freshPub(rec, key), skills: rec.skills, arc: this.arcPub(rec), hunger: Math.round(rec.hunger), dur: this.durPub(p), wtr: this.waterCur(p), cin: this.cinemaPub(), farm, time: now, room: this.room,
      trees: this.treeList(), npcs: this.npcs.map(n => this.npcPub(n)), pets: this.pets.map(q => this.petPub(q)),
      players: [...this.players.values()].filter(q => !q.scene).map(q => this.pubFull(q)),
      roster: [...this.players.values()].map(q => Object.assign({ voice: !!q.voice }, this.pubFull(q))), // ทุกคนออนไลน์ในห้อง (ข้ามฉาก) ใช้ทำรายชื่อและการโทร
      mapOv: this.mapOv && Object.keys(this.mapOv).length ? this.mapOv : undefined,
      mocks: admin ? (this.mocks || []) : undefined, // Mock วางแผนแมพ เห็นเฉพาะผู้ดูแล
    });
    send(p, { t: 'pst', pst: rec.pst || {}, names: rec.pnames || {} });
    send(p, { t: 'arcs', a: this.arcsPub() }); send(p, { t: 'rents', r: this.rentsPub() }); this.chPush(p); send(p, { t: 'evt', e: this.evPub() }); send(p, { t: 'stars', s: rec.stars || {} });
    send(p, { t: 'mkt', m: this.mktFor(p) });
    this.catJoin(p); this.catPush(p); this.enJoin(p); this.enPush(p);
    send(p, { t: 'chatlog', list: this.chatLog }); this.lottoJoin(p); this.starterOf(p); this.streakOnJoin(p); this.achCheck(p.rec); this.achPush(p); this.questPush(p); this.bankPush(p); this.villageRoll(); this.village.peak = Math.max(this.village.peak, this.players.size); send(p, this.villagePub(p)); send(p, { t: 'log', list: this.log });
    if (rec.gift) send(p, { t: 'gift', item: rec.gift });
    this.awaySummary(p, rec.leftAt || rec.lastSeen);
    if (Date.now() < S.FRESH.startAt && rec.freshNote !== 1) { rec.freshNote = 1; setTimeout(() => { if (p.ws.readyState === 1) this.toast(p, `📢 ตั้งแต่ ${new Date(S.FRESH.startAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} ผัก ปลา ไข่ นม อาหาร จะค่อยๆ เสื่อมราคาถ้าเก็บไว้นาน (สด 1 วัน = 100% • 1–3 วัน 70% • เกิน 40%) ของที่มีตอนนี้นับเป็นของสดวันนั้น • มีตู้เย็นในบ้านช่วยชะลอ`); }, 5000); }
    if (rec.joins === 1) this.broadcast({ t: 'newbie', id: p.id, name }, p); // ให้คนที่ออนไลน์ทักคนใหม่ (GROWTH-PLAN N1)
    this.starterStep(p, '');
    this.addLog(`👋 ${name} เข้ามาในเมือง`);
    this.broadcast(Object.assign({ t: 'on', voice: !!p.voice }, this.pubFull(p)), p); // รายชื่อออนไลน์ทุกฉาก
    this.sceneBroadcast(null, { t: 'p+', id: p.id, held: p.held || '', title: p.title, name, color: p.color, hat: p.hat, pc: p.pc, wear: p.wear, lamp: p.lamp, pet: p.pet, pm: p.pm, pax: p.pax, pay: p.pay, psick: !!(p.pet && this.petSt(p, p.pet).sick), pname: p.pet ? this.petName(p, p.pet) : '', x: p.x, y: p.y }, p);
    this.dirty = true;
    return { p };
  }
  leave(p) {
    this.arcLeave(p);
    this.tradeCancel(p, 'ผู้เล่นออกจากเกม');
    if (this.cinema.viewers.delete(p.id)) this.cinemaBroadcast();
    this.telFlush(p); this.wealthLog(p);
    this.unloadHerd(p); // สัตว์หายจากเล้า + เซฟสถานะแช่แข็งใน rec.herd
    logEv(this.room, 'leave', { p: p.key, sec: Math.round((Date.now() - (p.joinedAt || Date.now())) / 1000) });
    p.rec.catAt = p.rec.leftAt = Date.now(); // leftAt = เวลาออกจากเกมล่าสุด (สรุประหว่างที่ไม่อยู่)
    this.players.delete(p.id); this.addLog(`🚪 ${p.name} ออกไปแล้ว`);
    { const r = this.townPos(p); p.rec.x = r.x; p.rec.y = r.y; }
    this.sceneBroadcast(p.scene, { t: 'p-', id: p.id }, p);
    this.broadcast({ t: 'off', id: p.id }, p); // ออกจากห้อง: เลิกแสดงในรายชื่อทุกฉาก
    this.dirty = true;
  }

  handle(p, m) {
    if (p.scene && !HOUSE_MSG.has(m.t)) return;
    if (S.caveFloor(p.scene) && (m.t === 'house' || m.t === 'gift')) return; // ในถ้ำไม่มีบ้าน/ส่งของขวัญ
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
        { const cf = S.caveFloor(p.scene); if (cf) { const t = this.floorOf(cf).map[Math.floor(y / TS)][Math.floor(x / TS)]; if (t === T.MOUTH) { if (S.isSeaScene(cf)) this.seaLeave(p, S.isOcean(cf) ? '⛵ เทียบท่ากลับเกาะแล้ว' : '⛵ ลงเรือเล็กกลับเกาะ'); else if (cf === 1) this.leaveCave(p); else this.caveMove(p, cf, cf - 1); } else if (t === T.DOWN) this.caveMove(p, cf, cf + 1); break; } } // เดินถึงทางออก = ขึ้นชั้นบน (ชั้น 1 = กลับเมือง) • เดินลงบันไดลง = ชั้นถัดไป
        if (!p.scene && this.map[Math.floor(y / TS)][Math.floor(x / TS)] === T.MOUTH) { this.enterCave(p); break; } // เดินเข้าปากถ้ำบนหน้าผา
        if (p.scene) { if (Math.floor(y / TS) >= S.HOUSE.y1 && S.HOUSE.door.includes(Math.floor(x / TS))) this.leaveHouse(p); break; } // เดินถึงประตูบ้าน = ออกไปเมือง
        this.arcRangeCheck(p);
        break;
      }
      case 'sw': { // เริ่มเงื้อเครื่องมือ (ท่าทำงาน pixelaction.js): บอกคนรอบตัวให้เล่นท่าพร้อมกัน ส่วนผลจริงมากับ 'act' ตอนจังหวะกระทบ
        const now = Date.now(); if (now - (p.swAt || 0) < 300) return; p.swAt = now;
        if (p.scene) this.sceneBroadcast(p.scene, { t: 'use', id: p.id }, p); else this.broadcast({ t: 'use', id: p.id }, p);
        break;
      }
      case 'reel': { // ชักเย่อ: on = กำลังกดค้าง (กรอสาย) off = ปล่อย • เดินการต่อสู้ถึงตอนนี้ด้วยสถานะเดิมก่อนค่อยเปลี่ยน
        if (p.fish && p.fish.st === 'fight') { this.fightAdvance(p, Date.now()); if (p.fish && p.fish.st === 'fight') p.fish.hold = !!m.on; }
        break;
      }
      case 'act': {
        if (S.caveFloor(p.scene)) return S.isSeaScene(S.caveFloor(p.scene)) ? this.seaAct(p, m) : this.caveAct(p, m);
        if (p.scene) return this.houseAct(p, m);
        const now = Date.now();
        if (now - p.lastAct < 150) return;
        p.lastAct = p.activeAt = now;
        if (TOOLS.has(m.tool)) { p.workAt = now; if (now - (p.swAt || 0) > 1500) this.broadcast({ t: 'use', id: p.id }, p); } // ใช้เครื่องมือ = กำลังทำกิจกรรม (ความหิวลดเร็วขึ้น) + ให้คนอื่นเห็นท่าแกว่ (ส่ง 'sw' มาก่อนแล้วไม่ต้องซ้ำ)ง
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
      case 'pcall': { // โทรส่วนตัว: แจ้งคู่สายทุกฉาก ให้ฝั่งนั้นส่งเสียงให้กันคนเดียว
        const q = this.players.get(m.to | 0);
        const k = ['ring', 'ok', 'no', 'end'].includes(m.k) ? m.k : '';
        if (k && q && q !== p) send(q, { t: 'pcall', from: p.id, k }); // โทรส่วนตัวข้ามฉากได้
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
      case 'gift': this.giftOpen(p); break;
      case 'greet': this.greet(p, m.id, m.k); break;
      case 'sellback': this.sellback(p, m.item); break;
      case 'pet': { const id = m.pet || ''; if (!id || p.rec.inv['pet_' + id] > 0) this.setPet(p, id, m.mode); break; }
      case 'petname': this.petRename(p, m.pet, m.name); break;
      case 'petcare': this.petCare(p, m.a); break; // เลือกสัตว์เลี้ยงที่จะพาไป หรือเก็บเข้าบ้าน
      case 'repair': this.repair(p, m.tool); break;
      case 'rebuy': this.rebuy(p, m.tool); break;
      case 'trade': this.tradeHandle(p, m); break;
      case 'house': this.houseHandle(p, m); break;
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
      case 'arcbuy': this.arcBuy(p, m.id); break;
      case 'rent': this.rentHandle(p, String(m.id || '')); break;
      case 'veh': this.setVeh(p, m.v); break;
      case 'star': this.starClaim(p, String(m.skill || '')); break;
      case 'ch': if (m.a === 'start') this.chStart(p); else if (m.a === 'redeem') this.chRedeem(p); else this.chPush(p); break;
      case 'stall': if (m.a === 'list') send(p, { t: 'stall', l: this.stallPub() }); else this.stallHandle(p, m); break;
      case 'orders': if (m.a === 'fill') this.orderFill(p, m.id); send(p, { t: 'orders', o: this.ordersPub(p) }); break;
      case 'mineticket': this.mineTicket(p, m.f | 0); break;
      case 'buy': this.buy(p, m.item, Math.min(10, Math.max(1, m.n | 0))); break;
      case 'sell': this.sell(p, m.item, m.n); break;
      case 'sea': this.seaGo(p); break;
      case 'lotto': if (m.a === 'buy') this.lottoBuy(p, m); send(p, { t: 'lotto', l: this.lottoPub(p) }); break;
    }
  }

  setVeh(p, v) { // ขี่/ลงยานพาหนะ (ต้องมีของ อยู่ในเมือง)
    v = typeof v === 'string' && S.VEHICLES[v] && p.rec.inv['veh_' + v] > 0 && !p.scene ? v : '';
    if ((p.veh || '') === v) return; p.veh = p.rec.veh = v; this.dirty = true;
    this.broadcast({ t: 'veh', id: p.id, v }); if (v) this.toast(p, `${S.VEHICLES[v].emoji} ขี่${S.VEHICLES[v].name}แล้ว (กด V เพื่อลง)`);
  }
  broadcastLook(p) { this.broadcast({ t: 'look', id: p.id, color: p.color, hat: p.hat, pc: p.pc, wear: p.wear, lamp: p.lamp }, p); }

  // ขายของที่ซื้อมาคืนร้าน ได้ 70% ของราคาซื้อ (หัก 30%)
  sellback(p, item) {
    const kind = this.nearShopKind(p);
    if (!kind || typeof item !== 'string' || !S.SHOPS[kind].buy.includes(item) || !(p.rec.inv[item] > 0)) return;
    const v = S.sellbackValue(item), info = S.itemInfo(item);
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
  }

  nearWater(p, r = 2) { // มีช่องน้ำอยู่ในระยะ r ช่องรอบตัวผู้เล่นไหม
    const px = Math.floor(p.x / TS), py = Math.floor(p.y / TS);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (this.map[py + dy] && this.map[py + dy][px + dx] === T.WATER) return true;
    return false;
  }

  // ร้านที่ผู้เล่นยืนอยู่ใกล้ประตู (หรือ null)
  nearShopKind(p) { // ร้านที่ใกล้ที่สุดในระยะ (เดิมคืนร้านแรกที่เจอ ร้านที่อยู่ติดกันจึงเปิดผิดร้าน เช่น ร้านยานพาหนะได้ร้านตกปลา)
    let best = null, bd = 110;
    for (const b of S.BUILDINGS) for (const [cx, cy] of b.counter) {
      if (!S.SHOPS[b.kind]) continue;
      const d = Math.hypot(p.x - (cx + 0.5) * TS, p.y - (cy + 0.5) * TS); if (d < bd) { bd = d; best = b.kind; }
    }
    return best;
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
      if (this.ownerCount(p.key, info.animal) >= ANIMALS[info.animal].cap) return this.toast(p, `คุณเลี้ยง${ANIMALS[info.animal].name}ครบ ${ANIMALS[info.animal].cap} ตัวแล้ว`);
    }
    const cost = info.buy * n;
    if ((p.rec.inv.coin || 0) < cost) return this.toast(p, 'เหรียญไม่พอ');
    this.add(p, 'coin', -cost, 'buy'); logEv(this.room, 'buy', { p: p.key, item, q: n, coin: cost, cat: info.cat || 'other' }); // ซื้ออะไร: แยกต้นทุนผลิต (เมล็ด อาหารสัตว์ เหยื่อ) กับของสะสม/ความสะดวก
    if (info.animal) { this.spawnAnimal(info.animal, p); this.syncHerd(p); this.toast(p, `ซื้อ${info.emoji} ${ANIMALS[info.animal].name}ตัวใหม่แล้ว! (ของคุณ ${this.ownerCount(p.key, info.animal)}/${ANIMALS[info.animal].cap})`); return; }
    this.add(p, item, n); if (info.furn) this.bookAdd(p, 'furn', info.furn);
    if (item === 'feed' || item === 'hay' || item === 'slop') this.event(p, 'buyfeed');
    if (info.can) this.waterSet(p, S.CANS[info.can].cap); // ซื้อบัวใหม่ได้น้ำเต็มให้เลย
    if (/^(rod|axe|pick)_/.test(item)) { const tl = item.split('_')[0]; if (p.rec.dur) delete p.rec.dur[tl]; if (p.rec.fix) delete p.rec.fix[tl]; send(p, { t: 'dur', d: this.durPub(p) }); } // อุปกรณ์ใหม่ความทนทานเต็ม
    this.toast(p, `ซื้อ ${info.emoji} ${info.name}${n > 1 ? ' x' + n : ''}`);
    this.sfxTo(p, 'coin');
    if (info.wear) p.rec.wear[info.wear.cat] = info.wear.id; // ซื้อแล้วสวมให้เลย
    if (info.pet) this.setPet(p, info.pet);                  // ซื้อสัตว์เลี้ยงแล้วให้เดินตามเลย
    if (info.veh) this.setVeh(p, info.veh);                  // ซื้อยานพาหนะแล้วขี่เลย
    if (item === 'lamp') p.rec.lamp = p.lamp = true;         // ซื้อตะเกียงแล้วจุดให้เลย
    if (info.wear || item === 'lamp') { this.broadcastLook(p); send(p, { t: 'look', id: p.id, color: p.color, hat: p.hat, pc: p.pc, wear: p.wear, lamp: p.lamp }); }
  }
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
  }

  caveAct(p, m) { // ใช้เครื่องมือในถ้ำ: ขุดแร่ด้วยอีเต้ออย่างเดียว
    const now = Date.now();
    if (now - p.lastAct < 150) return;
    p.lastAct = p.activeAt = now;
    if (m.tool !== 'pick') return;
    p.workAt = now; if (now - (p.swAt || 0) > 1500) this.sceneBroadcast(p.scene, { t: 'use', id: p.id }, p);
    if (now - (p.hitAt || 0) < S.SWING_MS - 150) return; p.hitAt = now; // ฟาดได้ไม่ถี่กว่าความยาวท่า (เผื่อเน็ตแกว่ง 150 ms)
    this.pickAct(p, now, m.tx, m.ty);
  }
  pickAct(p, now, cx, cy) {
    const inv = p.rec.inv, pick = S.pickTier(inv), cf = S.caveFloor(p.scene), F = this.floorOf(cf);
    if (!pick) return this.toast(p, 'ต้องมีอีเต้อก่อน ซื้อได้ที่ร้านช่างเหมือง ⚒️ (หน้าถ้ำ)');
    if (p.rec.hunger <= 0) return this.toast(p, '😵 หิวจนไม่มีแรง! ไปกินอาหารก่อนนะ (ร้านอาหาร หรือกินผลผลิตจากกระเป๋า)');
    if (!this.durOk(p, 'pick')) return;
    let [tx, ty] = S.facing(p.x, p.y, p.dir);
    if (Number.isInteger(cx) && Number.isInteger(cy)) { // คลิกเลือกก้อนแร่เอง ต้องอยู่ใกล้
      const px = Math.floor(p.x / TS), py = Math.floor(p.y / TS);
      if (cx < 0 || cy < 0 || cx >= S.W || cy >= S.H || Math.max(Math.abs(cx - px), Math.abs(cy - py)) > 2) return this.toast(p, 'ไกลเกินไป เดินเข้าไปใกล้ๆ ก่อน');
      tx = cx; ty = cy;
      const dx = cx - px, dy = cy - py;
      if (dx || dy) p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
    }
    const key = tx + ',' + ty, ore = F.ores.get(key);
    if (!ore) return this.toast(p, 'ใช้อีเต้อขุดก้อนแร่ในถ้ำ 🪨 (หันหน้าหาก้อนแร่ หรือแตะที่ก้อนแร่)');
    const kid = ore.k, O = S.ORES[kid], ml = this.lv(p, 'mine');
    if (ml < O.lv) return this.toast(p, `🔒 ${O.emoji} ${O.name}ต้องเป็นนักขุดแร่ Lv${O.lv} ขึ้นไป`);
    const mh = S.mineHit(inv, kid, ore.s); // ดาเมจ/สึก/โบนัสตามอีเต้อ ถุงมือ ค้อน เทียบแร่ (ต่ำกว่าแร่ 1 ระดับ = ขุดได้แต่ช้า)
    if (!mh) return this.toast(p, `🔒 ${O.emoji} ${O.name}ต้องใช้${S.PICKS[Math.max(1, O.pick - 1)].name}ขึ้นไป (ต่ำกว่านี้ขุดไม่ได้)`);
    let h = F.hp.get(key);
    if (!h || now - h.t > 20000) h = { hp: S.oreHp(kid, ore.s), t: now };
    if (!h.slowWarn && mh.slow) { h.slowWarn = true; this.toast(p, `🐌 ${S.PICKS[pick].name}ต่ำกว่าที่${O.name}ต้องการ ขุดได้แต่ช้าและอีเต้อสึกไว`); }
    h.hp -= mh.dmg; h.t = now; h.n = (h.n || 0) + 1;
    this.sfx(p, 'chop');
    if (h.hp > 0) { F.hp.set(key, h); this.sceneBroadcast(p.scene, { t: 'oh', x: tx, y: ty, f: +(h.hp / S.oreHp(kid, ore.s)).toFixed(2) }); const left = Math.ceil(h.hp / mh.dmg - 1e-9); if (left <= 3 || left % 5 === 0) this.toast(p, `⚒️ ${O.emoji} ${O.name}ก้อน${S.ORE_SIZES[ore.s].name} อีก ${left} ครั้ง`); return; }
    { const wf = Math.floor(mh.wear), wn = wf + (Math.random() < mh.wear - wf ? 1 : 0); for (let i = 0; i < wn; i++) { if (!this.durCur(p, 'pick')) break; this.durUse(p, 'pick'); } } // ขุดแตก 1 ก้อน = อีเต้อสึก ~1 ครั้ง (ไม่นับทุกครั้งที่ฟาด) ×ตัวคูณ: ต่ำกว่าแร่ ×2 / สูงกว่าแร่และถุงมือสึกน้อยลง
    F.hp.delete(key); F.ores.delete(key); F.map[ty][tx] = T.CAVE;
    F.wait.push({ x: tx, y: ty, at: now + S.MINE.respawnMs });
    this.sceneBroadcast(p.scene, { t: 'ore', x: tx, y: ty, k: '' });
    let n = S.rollDrop(ore.s, Math.random); const xp = O.xp * n; let bonus = false; // XP นับจากชิ้นปกติ (อีเต้อแรงเกินแร่ไม่ได้ XP เพิ่ม)
    if (Math.random() < mh.extra) { n++; bonus = true; }
    const val = O.sell * n;
    this.add(p, kid, n);
    this.addXp(p, 'mine', S.oreXp(xp, ml)); this.tire(p, 'mine', val);
    if (!this.bookOf(p).ore[kid]) { const dx = Math.round(O.xp * S.MINE.discover); this.addXp(p, 'mine', dx); this.toast(p, `✨ ค้นพบแร่ใหม่ ${O.emoji} ${O.name}! โบนัส XP +${dx}`); this.bookAdd(p, 'ore', kid); } // ครั้งแรกของแร่ชนิดนี้
    if (this.petLuck(p, O.emoji + ' ' + O.name)) this.add(p, kid, 1);
    this.toast(p, `⛏️ ขุดได้ ${O.emoji} ${O.name} x${n} (ก้อน${S.ORE_SIZES[ore.s].name})${bonus ? ' ✨ อีเต้อแรง ได้เพิ่ม' : ''}`); this.sfx(p, 'fell'); this.event(p, 'mine');
    logEv(this.room, 'mine', { p: p.key, f: cf, k: kid, s: ore.s, n, hits: h.n, pk: pick, gl: S.gloveTier(inv), hm: S.hammerTier(inv), slow: mh.slow ? 1 : 0, ml }); // บันทึกการขุดละเอียด (ชนิด ขนาด ชั้น อีเต้อ ครั้งที่ฟาด) ไว้วัดก้อน/ชม. และเวลาต่อเลเวล • tools/stats.js สรุป
  }
  // ----- ออกทะเล: เรือที่ท่าบนเกาะลึกลับ (S.SEA) → ฉากทะเล (ฉากเดียวกับถ้ำ ชั้น S.SEA.floor) ตกปลาทะเลลึกด้วยเบ็ด จำกัดเวลา -----
  seaFee(p) { return p.rec.inv.boat > 0 ? 0 : S.SEA.fee; }
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
  }
  seaLeave(p, msg) { if (!S.isSeaScene(S.caveFloor(p.scene))) return; p.seaUntil = 0; p.seaW = 0; this.leaveCave(p); this.toast(p, msg); }
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
  }
  reelFish(p, now) { // กำลังตกปลาอยู่: กดอีกครั้งเพื่อดึงเบ็ด (ทั้งสระและทะเล ต่างกันที่ชุดปลา p.fish.sea)
    const fi = p.fish;
    if (fi.st === 'fight') return; // กำลังชักเย่อ: กรอผ่านข้อความ reel (กดค้าง) ไม่ใช่การกดดึงครั้งเดียว
    if (fi.st === 'wait') { // ดึงเบ็ดก่อนปลากิน: คืนเหยื่อให้ (เดิมเสียเหยื่อฟรี มือใหม่กดซ้ำแล้วเสียของ)
      if (fi.bk) this.add(p, fi.bk, 1);
      this.toast(p, 'ดึงเบ็ดกลับ ยังไม่มีปลากิน (ได้เหยื่อคืน)'); this.sfx(p, 'miss'); p.fish = null; return;
    }
    if (!S.gaugeHit(fi, now)) { // กดพลาดโซนกลาง ปลาหลุดทันที
      this.toast(p, '❌ กดไม่ตรงกลาง ปลาหลุดไปแล้ว!'); this.sfx(p, 'miss'); send(p, { t: 'fg', off: 1 }); p.fish = null; return;
    }
    // กดเกจโดน = ตั้งเบ็ดติด → เลือกปลาตัวนี้เลย (ความแรงของปลาขึ้นกับกลุ่มราคา) แล้วเริ่มชักเย่อ (ชนะแล้วถึงได้ปลา)
    send(p, { t: 'fg', off: 1 });
    const fl = fi.fl, rod = fi.rod, G = S.FISH_GAUGE, perfect = S.gaugeCore(fi, now); // กดเป๊ะกลางโซน = อัตราปลาเต็ม / โดนแค่ขอบโซน = ปลาแพงเจอยากลง
    const rareCd = (p.rec.rareAt || 0) > Date.now(); // ปลาหายากเพิ่งตกได้ พักรอบก่อน (ยังตกปลาธรรมดาได้)
    const pool = S.fishPool(!!fi.sea).filter(f => f.lv <= fl && !(rareCd && f.sell >= 100)).map(f => ({ f, w: S.fishWeight(f, fl, rod, fi.bt || 1) * (perfect || f.id === 'boot' ? 1 : G.edgeMul[S.fishClass(f)]) * (fi.zone ? S.oceanZoneMul(fi.zone, f.lv) : 1) })).filter(x => x.w > 0); // ทะเลใหญ่: ปลาระดับที่ตรงโซนออกบ่อยขึ้น
    let r = Math.random() * pool.reduce((a, x) => a + x.w, 0), f = pool[0].f;
    for (const x of pool) { if ((r -= x.w) < 0) { f = x.f; break; } }
    const firstFish = !fi.sea && !(this.achOf(p.rec).cnt.fish > 0); if (firstFish) f = FISH.find(x => x.id === S.NEWBIE.firstFish) || f; // ปลาตัวแรกในชีวิตการันตีตัวสวย
    const ft = S.fightNew(S.fishClass(f), rod, S.perkLv(fl), perfect, Math.random);
    Object.assign(fi, { st: 'fight', pick: f, perfect, firstFish, ft, hold: false, last: now, sync: now, at: now + S.FIGHT.timeoutMs + 5000 });
    send(p, { t: 'fight', cls: ft.cls, sched: ft.sched, dist: ft.dist, ten: ft.ten, str: ft.str, run: ft.run, spd: ft.spd, rise: ft.rise, perfect: !!perfect });
    this.toast(p, perfect ? '🎯 ตั้งเบ็ดเป๊ะ! ปลาติดแล้ว กดค้างเพื่อกรอสาย' : '🎣 ปลาติดเบ็ด! กดค้างเพื่อกรอสาย ปล่อยเมื่อสายตึงเกินไป');
  }
  fightAdvance(p, now) { // เดินการชักเย่อของผู้เล่นไปถึงเวลา now ตามสถานะกรอล่าสุด (เรียกตอนรับ input และทุก tick) จบแล้วตัดสินผล
    const fi = p.fish; if (!fi || fi.st !== 'fight') return;
    const ms = Math.max(0, Math.min(2000, now - fi.last)); fi.last = now; S.fightStep(fi.ft, ms, fi.hold);
    if (fi.ft.end) this.fightEnd(p, now);
  }
  fightEnd(p, now) {
    const fi = p.fish, r = fi.ft.end; send(p, { t: 'fe', r });
    if (r === 'win') return this.landFish(p, fi.pick, fi.perfect, fi.firstFish, fi.ft.peak < S.FIGHT.cleanBelow);
    this.toast(p, r === 'snap' ? '💥 สายเอ็นขาด! ปลาหลุดไปแล้ว (อย่ากรอค้างตอนสายตึงจัด)' : '🐟 ปลาหนีไปได้... (ปล่อยสายนานเกินไป)'); this.sfx(p, 'miss'); p.fish = null;
  }
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
  }
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
  }
  act(p, tool, now, cx, cy) {
    const inv = p.rec.inv;
    // กำลังตกปลาอยู่: กดอีกครั้งเพื่อดึงเบ็ด
    if (p.fish) return this.reelFish(p, now);
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
      if (this.petLuck(p, info.emoji + ' ' + info.name)) this.add(p, A.product, 1);
      let extra = 0;
      const al = this.lv(p, 'animal');
      if (mine) { this.addXp(p, 'animal', S.animalXp(A.xp, al)); if (Math.random() < S.ANIMAL_BONUS) { extra = 1; this.add(p, A.product, 1); } } // เลี้ยงเอง = XP เต็ม + ลุ้นผลผลิตงาม ×2
      else { this.addXp(p, 'animal', Math.max(1, Math.floor(S.animalXp(A.xp, al) / 2))); if (prod.feeder) { this.toast(p, `🦊 เก็บผลผลิตของ ${prod.fn || 'ผู้เลี้ยง'} ที่ไม่มาเก็บเกิน 1 วัน`); this.addLog(`🔓 ${p.name} เก็บ${info.emoji} ${info.name}ของ ${prod.fn || 'ผู้เลี้ยง'} (หมดเวลาจอง 1 วัน)`); } } // คนอื่นเก็บได้เมื่อเจ้าของไม่มาเก็บครบ 1 วัน = XP ครึ่ง เจ้าของเสียผลผลิต
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
      if (this.petLuck(p, c.emoji + ' ' + c.name)) this.add(p, 'crop_' + tile.c, 1);
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
    if (town) { send(p, { t: 'town', w: town, fee: town === 'sea' ? this.seaFee(p) : undefined, boat: town === 'sea' ? p.rec.inv.boat > 0 : undefined, win: town === 'sea' && p.rec.inv.boat > 0 ? S.oceanWindow(Date.now()) : undefined, min: town === 'sea' ? S.SEA.minFishLv : undefined, ms: town === 'sea' ? S.SEA.ms : undefined }); return; }
    const cab = tt === T.SHOP ? S.cabinetAt(tx, ty) : null;
    if (cab) { this.arcOpen(p, cab); return; }
    // 4) ร้านค้า
    const shop = (tt === T.SHOP || tt === T.BUILD) ? S.shopAt(tx, ty) : null; // ประตูร้าน (SHOP) หรือตัวอาคารร้าน (BUILD)
    if (shop && !S.SHOPS[shop]) return;
    if (shop) { if (this.nearShopKind(p) === shop) send(p, { t: 'shop', kind: shop }); else this.toast(p, 'เดินเข้าไปใกล้ประตูร้านอีกนิด'); return; }
    // 5) ใช้เครื่องมือ
    const feedTypes = Object.keys(ANIMALS).filter(k => ANIMALS[k].feedItem === tool); // อาหารชนิดเดียวใช้ได้หลายสัตว์ (ไก่+เป็ด, วัว+แกะ)
    if ((tool === 'hoe' || tool === 'rod' || tool === 'axe') && !this.durOk(p, tool)) return;
    if (tool === 'hoe') {
      { const rb = this.rentBlock(tx, ty, p); if (rb) return this.toast(p, rb); }
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
      { const rb = this.rentBlock(tx, ty, p); if (rb && tile.o !== p.key) return this.toast(p, rb); } // รดน้ำต้นของตัวเองในแปลงที่หมดสัญญาได้
      const wl = this.waterCur(p);
      if (wl <= 0) return this.toast(p, '💧 น้ำหมดแล้ว! ไปตักน้ำที่สระ (กดช่อง 1 เลือกบัวรดน้ำ แล้วแตะน้ำ)');
      const dry = !(tile.wu > now);
      tile.wu = now + this.canOf(p).wet;
      this.waterSet(p, wl - 1);
      this.tileUpdate(k, tile); this.sfx(p, 'water');
      if (wl - 1 === 0) this.toast(p, '💧 น้ำหมดแล้ว ไปตักน้ำที่สระก่อนนะ');
      if (dry) { this.addXp(p, 'farm', 1); this.tire(p, 'water'); }
      if (dry && tile.c) { this.event(p, 'water'); if (tile.o && tile.o !== p.key) { this.addPts(p, 1); this.event(p, 'help'); } } // รดน้ำพืชที่แห้งจริงๆ เท่านั้นที่นับ • แต้มความดีเฉพาะแปลงของคนอื่น
    } else if (tool.startsWith('seed_')) {
      if (!tile) return this.toast(p, 'ต้องขุดดินก่อน');
      if (tile.c) return this.toast(p, 'มีพืชอยู่แล้ว');
      if (!inv[tool]) return this.toast(p, 'เมล็ดหมด ไปซื้อที่ร้านเมล็ดพันธุ์');
      { const rb = this.rentBlock(tx, ty, p); if (rb) return this.toast(p, rb); }
      const rr = this.rentAt(tx, ty);
      const C0 = CROPS[tool.slice(5)], need = S.cropCan(C0);
      if (S.canTier(inv) < need) return this.toast(p, `${C0.emoji} ${C0.name}ต้องใช้${S.CANS[need].name}ดูแล ซื้อได้ที่ร้านเมล็ดพันธุ์ (🪙 ${S.CANS[need].price})`);
      const cap = Math.min(S.FARM_CAP.max, S.FARM_CAP.base + S.FARM_CAP.perLv * (this.lv(p, 'farm') - 1));
      let mine = 0; for (const q in this.farm) if (this.farm[q].c && this.farm[q].o === p.key) { const [qx, qy] = q.split(',').map(Number), r2 = this.rentAt(qx, qy); if (!(r2 && r2.key === p.key)) mine++; } // ต้นในแปลงเช่าของตัวเองไม่นับ
      if (!(rr && rr.key === p.key) && mine >= cap) return this.toast(p, `🌱 ปลูกค้างอยู่ครบ ${cap} ต้นแล้ว เก็บเกี่ยวก่อน หรือแบ่งที่ให้คนอื่นปลูกบ้างนะ (เลเวลชาวนาสูงขึ้นปลูกได้มากขึ้น)`);
      this.add(p, tool, -1);
      tile.c = tool.slice(5); tile.o = p.key; tile.on = p.name; tile.rm = 0; tile.g = 0; tile.m = 1 + 0.04 * (S.perkLv(this.lv(p, 'farm')) - 1);
      if ((p.rec.quick || 0) < S.NEWBIE.quickSeeds && !this.starterOf(p).final) { p.rec.quick = (p.rec.quick || 0) + 1; tile.m = S.NEWBIE.quickMul; this.toast(p, `🌱 เมล็ดมือใหม่ โตไวพิเศษ! (${p.rec.quick}/${S.NEWBIE.quickSeeds}) รดน้ำแล้วรอแป๊บเดียว`); }
      this.tileUpdate(k, tile); this.addXp(p, 'farm', 2); this.tire(p, 'plant'); this.sfx(p, 'plant'); this.event(p, 'plant');
    } else if (tool === 'rod') {
      if (tt !== T.WATER) return this.toast(p, 'ต้องเลือกช่องที่เป็นน้ำ');
      if (!this.nearWater(p)) return this.toast(p, 'ต้องยืนห่างจากสระน้ำไม่เกิน 2 ช่องถึงจะตกปลาได้');
      this.castFish(p, tx, ty, now);
    } else if (tool === 'axe') {
      const axe = S.axeTier(inv);
      if (!axe) return this.toast(p, 'ต้องมีขวานก่อน ซื้อได้ที่ร้านช่างไม้ 🪓');
      if (!S.isChoppable(this.map, tx, ty)) return this.toast(p, 'ใช้ขวานฟันต้นไม้ 🌳 (ต้นไม้ขอบแมพตัดไม่ได้)');
      const key = tx + ',' + ty, kid = this.treeKind.get(key) || 'broad', K = S.TREE_KINDS[kid], wl = this.lv(p, 'wood');
      if (wl < K.lv || axe < K.axe) return this.toast(p, `🔒 ${K.emoji} ${K.name}ต้องเป็นช่างไม้ Lv${K.lv} และใช้${S.AXES[K.axe].name}ขึ้นไป`);
      let h = this.treeHp.get(key);
      if (now - (p.hitAt || 0) < S.SWING_MS - 150) return; p.hitAt = now; // ฟันได้ไม่ถี่กว่าความยาวท่า
      if (!h || now - h.t > 20000) h = { hp: K.hp, t: now };
      h.hp -= S.AXES[axe].power; h.t = now;
      this.sfx(p, 'chop'); this.durUse(p, 'axe');
      if (h.hp > 0) { this.treeHp.set(key, h); this.broadcast({ t: 'th', x: tx, y: ty, f: +(h.hp / K.hp).toFixed(2) }); if (K.hp > 4) this.toast(p, `🪓 ${K.emoji} ${K.name} อีก ${Math.ceil(h.hp / S.AXES[axe].power)} ครั้ง`); return; }
      this.treeHp.delete(key); this.treeKind.delete(key); this.map[ty][tx] = T.GRASS; this.dirty = true;
      this.broadcast({ t: 'tree', x: tx, y: ty, on: false });
      const got = {}; for (const [it, n] of K.drop) got[it] = (got[it] || 0) + n;
      if (Math.random() < 0.04 * (S.perkLv(wl) - 1)) got[K.drop[0][0]]++; // ฝีมือ: ได้ชิ้นหลักเพิ่ม
      for (const [it, ch] of K.bonus || []) if (Math.random() < ch + 0.01 * (S.perkLv(wl) - 1) + (this.happyOn(p) ? S.VILLAGE.hardBonus : 0)) got[it] = (got[it] || 0) + 1;
      let xp = 0, val = 0; for (const [it, n] of Object.entries(got)) { this.add(p, it, n); xp += S.WOOD_ITEMS[it].xp * n; val += S.WOOD_ITEMS[it].sell * n; this.bookAdd(p, 'wood', it); }
      this.addXp(p, 'wood', S.woodXp(xp, wl)); this.tire(p, 'chop', val);
      { const mi = K.drop[0][0], W0 = S.WOOD_ITEMS[mi]; if (this.petLuck(p, W0.emoji + ' ' + W0.name)) { this.add(p, mi, 1); got[mi]++; } }
      this.toast(p, `${K.emoji} ${K.name}ล้ม! ได้ ${Object.entries(got).map(([it, n]) => `${S.WOOD_ITEMS[it].emoji} ${S.WOOD_ITEMS[it].name} x${n}`).join(' ')}`); this.sfx(p, 'fell'); this.event(p, 'chop'); if (got.hardwood) this.event(p, 'hardwood');
      if (kid === 'rose') this.addLog(`🟥 ${p.name} โค่นต้นพะยูงได้!`);
    } else if (tool === 'medicine') {
      const a = this.animals.filter(a => a.sick && (Math.hypot(a.x - tcx, a.y - tcy) < 52 || Math.hypot(a.x - p.x, a.y - p.y) < 52))
        .sort((a, b) => Math.hypot(a.x - tcx, a.y - tcy) - Math.hypot(b.x - tcx, b.y - tcy))[0];
      if (!a) return this.toast(p, 'ไม่มีสัตว์ป่วยอยู่ใกล้ๆ');
      if (!inv.medicine) return this.toast(p, 'ยาหมด ซื้อได้ที่ร้านปศุสัตว์ 💊');
      this.add(p, 'medicine', -1); a.sick = false; a.sickMs = 0;
      this.addLog(`💊 ${p.name} รักษา${ANIMALS[a.type].emoji} ${ANIMALS[a.type].name}ที่ป่วย`); if (a.owner !== p.key) { this.addPts(p, 3); this.event(p, 'help'); } this.villageBump(p); this.addXp(p, 'animal', 6); this.toast(p, `💊 รักษา${ANIMALS[a.type].emoji} ${ANIMALS[a.type].name}หายป่วยแล้ว!`); this.sfx(p, 'heal');
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
      if (a.owner !== p.key && a.hunger < 60) { this.addPts(p, a.hunger < 25 ? 2 : 1); this.event(p, 'help'); } // ช่วยสัตว์ของคนอื่นที่หิวจริงเท่านั้นได้แต้ม
      this.event(p, 'feed');
      a.hunger = 100; a.zero = 0; // อิ่มเต็ม และหลุดจากอันตรายอดตาย
      if (!a.fed && !a.prod) { a.fed = true; a.feeder = p.key; a.fn = p.name; a.layAt = now + rand(A.time[0], A.time[1]) * Math.max(0.5, 1 - 0.05 * (S.perkLv(this.lv(p, 'animal')) - 1)); } // จำคนที่เริ่มเลี้ยงรอบนี้ไว้ปันผลตอนเก็บ
      this.addXp(p, 'animal', S.animalXp(3, this.lv(p, 'animal')));
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
    return Object.values(this.tables).map(t => (t.game === 'uno' || PARTY.has(t.game))
      ? [t.id, t.idx, t.state, t.bet, t.players[0] ? t.players[0].name : '', t.players.length + '/' + t.max, t.bot ? 1 : 0, t.game]
      : [t.id, t.idx, t.state, t.bet, t.host ? t.host.name : '', t.guest ? t.guest.name : '', t.bot ? 1 : 0, t.game]);
  }
  pubFor(t, id) { return t.game === 'uno' ? this.unoPub(t, id) : PARTY.has(t.game) ? this.partyPub(t, id) : this.tablePub(t, id); }
  pushTable(t, openFor) {
    const ids = (t.game === 'uno' || PARTY.has(t.game))
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
      this.payKey(W, got); if (!t.bot) this.toPot(rake);
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
    if (t.state === 'waiting' && t.host.id === p.id) this.cancelWait(t, `${p.name} ออกจากเกม ยกเลิกห้อง`);
    else if (t.state === 'playing' && (t.xId === p.id || t.oId === p.id)) this.finish(t, p.id === t.xId ? 'O' : 'X', null, `${p.name} ออกจากเกม`);
  }
  arcLeave(p) { for (const t of Object.values(this.tables)) this.arcLeaveTable(p, t); } // ผู้เล่นหลุด/ออกจากเกม
  arcSeated(p, t) { // นั่งอยู่ที่โต๊ะนี้ (ผู้เล่นจริง ไม่ใช่แค่ดู)
    if (t.game === 'uno' || PARTY.has(t.game)) return t.players.some(q => q.id === p.id);
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
    if (!t.bot) this.toPot(rake);
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


  tick(dt, now) {
    this.lottoTick(now);
    for (const p of this.players.values()) {
      const cf = S.caveFloor(p.scene); if (!S.isSeaScene(cf)) continue;
      if (now >= (p.seaUntil || 0)) this.seaLeave(p, S.isOcean(cf) ? '🌇 ตะวันตกดินแล้ว กัปตันพากลับเกาะ' : '⛵ ครบเวลาออกทะเล กัปตันพากลับเกาะแล้ว');
      else if (S.isOcean(cf)) { const left = p.seaUntil - now; if (left <= 60000 && !(p.seaW & 1)) { p.seaW |= 1; this.toast(p, '🌇 ตะวันใกล้ตกแล้ว อีก 1 นาทีกัปตันจะพากลับ แล่นกลับท่า (ซ้ายสุดของแมพ) ได้ก่อน'); } else if (left <= 15000 && !(p.seaW & 2)) { p.seaW |= 2; this.toast(p, '⛵ เรือกำลังจะกลับท่าแล้ว!'); } }
    }
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
      this.energyTick(dt); this.chAcc = (this.chAcc || 0) + dt; if (this.chAcc >= 2) { this.chAcc = 0; this.chTick(); this.evTick(); }
      const byKey = new Map(); for (const q of this.players.values()) byKey.set(q.key, q); // เจ้าของสัตว์ที่ออนไลน์
      const away = a => { const o = byKey.get(a.owner); return !!(o && o.scene); }; // เจ้าของอยู่ในบ้าน/ถ้ำ/ทะเล = ไม่อยู่เล้า หยุดนับหิว/ป่วย (เดิมนับต่อ ขุดแร่นานๆ สัตว์ตายโดยไม่รู้ตัว • 5 พ.ย. 2026)
      for (const a of this.animals) {
        const A = ANIMALS[a.type];
        if (away(a)) continue;
        a.hunger = Math.max(0, a.hunger - dt * HFAST * 100 / (A.starveMin * 60));
        if (a.hunger <= 0) {
          a.zero = (a.zero || 0) + dt * 1000;
          if (!a.warned && a.zero > 1000) { a.warned = true; this.broadcast({ t: 'msg', text: `⚠️ ${A.emoji} ${A.name}ของ ${a.on || 'ใครบางคน'} หิวจนไม่มีแรงแล้ว! รีบให้อาหารก่อนจะตาย` }); }
          if (a.zero > S.ANIMAL_GRACE_MS / HFAST) {
            a.dead = true;
            logEv(this.room, 'animal_die', { p: a.owner, type: a.type, why: 'hunger' });
            this.broadcast({ t: 'msg', text: `💀 ${A.emoji} ${A.name}ของ ${a.on || 'ใครบางคน'} หิวตายแล้ว (ต้องซื้อใหม่ที่ร้านปศุสัตว์)` }); this.addLog(`💀 ${A.emoji} ${A.name}ของ ${a.on || '?'} หิวตาย`);
            this.broadcast({ t: 'sfx', k: 'die', id: 0, x: Math.round(a.x), y: Math.round(a.y) });
          }
        } else { a.zero = 0; a.warned = false; }
        if (a.sick && (a.sickMs = (a.sickMs || 0) + dt * 1000 * HFAST) > SICK_GRACE) {
          a.dead = true; logEv(this.room, 'animal_die', { p: a.owner, type: a.type, why: 'sick' });
          this.broadcast({ t: 'msg', text: `💀 ${A.emoji} ${A.name}ของ ${a.on || 'ใครบางคน'} ป่วยตายแล้ว ครั้งหน้ารีบรักษาด้วยยา 💊 นะ` }); this.addLog(`💀 ${A.emoji} ${A.name}ของ ${a.on || '?'} ป่วยตาย`);
          this.broadcast({ t: 'sfx', k: 'die', id: 0, x: Math.round(a.x), y: Math.round(a.y) });
        }
      }
      // สุ่มสัตว์ป่วย: เฉพาะตัวที่เจ้าของออน (อยู่ในเล้า) • ป่วยพร้อมกันได้ไม่เกิน SICK.max
      this.sickTimer += dt * 1000 * HFAST;
      if (this.sickTimer >= SICK_CHECK) {
        this.sickTimer = 0;
        const healthy = this.animals.filter(a => !a.sick && !a.dead && !away(a)); // ไม่สุ่มตัวที่เจ้าของไม่อยู่เล้า (จะได้ทันรักษา)
        if (this.animals.filter(a => a.sick).length < S.SICK.max && healthy.length && Math.random() < S.SICK.chance) {
          const a = healthy[Math.floor(Math.random() * healthy.length)], A = ANIMALS[a.type];
          a.sick = true; a.sickMs = 0; this.addLog(`🤒 ${A.emoji} ${A.name}ของ ${a.on || '?'} ป่วย`);
          this.broadcast({ t: 'msg', text: `🤒 ${A.emoji} ${A.name}ของ ${a.on || 'ใครบางคน'} ป่วยแล้ว! รีบรักษาด้วยยา 💊 (ซื้อที่ร้านปศุสัตว์)` });
          const so = byKey.get(a.owner); if (so) this.toast(so, `🤒 ${A.emoji} ${A.name}ของคุณป่วย! รักษาด้วยยา 💊 ภายใน ${Math.round(SICK_GRACE / 60000)} นาที (ซื้อที่ร้านปศุสัตว์)`);
        }
      }
      // ต้นไม้งอกใหม่ในที่โล่งสีเขียวที่ห่างจากสิ่งปลูกสร้าง
      if (this.treeTimer < 0) this.treeTimer = 0; // กันค่าติดลบจากนาฬิกาย้อน (ก่อนแก้ dt)
      this.treeTimer += dt;
      if (this.treeTimer >= S.TREE.growMs / 1000) { // ต้นไม้งอกใหม่ (เพดานตาม S.TREE.cap)
        this.treeTimer = 0;
        const tl = this.treeList(), counts = {}; for (const t of tl) counts[t[2]] = (counts[t[2]] || 0) + 1; let n = tl.length;
        // ถ้าน้อยกว่าครึ่งเพดาน งอกทีละหลายต้น (ไล่ทันหลังถูกตัดเกลี้ยง/นาฬิกาพัง) ไม่เกิน 8 ต้น/รอบ
        const want = n >= this.treeCap ? 0 : Math.min(n * 2 < this.treeCap ? 8 : 1, this.treeCap - n);
        for (let spawned = 0; spawned < want; spawned++) {
          const spots = []; // ช่องที่งอกได้ตอนนี้ (ห่างผู้เล่น 4 ช่อง ห่างสัตว์ 3 ช่อง)
          for (let y = 2; y < S.H - 2; y++) for (let x = 2; x < S.W - 2; x++) {
            if (!S.treeSpotOk(this.map, x, y)) continue;
            if ([...this.players.values()].some(q => Math.hypot(q.x - (x + 0.5) * TS, q.y - (y + 0.5) * TS) < 4 * TS)) continue;
            if (this.animals.some(a => Math.hypot(a.x - (x + 0.5) * TS, a.y - (y + 0.5) * TS) < 3 * TS)) continue;
            spots.push([x, y]);
          }
          const pick = S.pickTreeSpawn(this.map, Math.random, spots, counts, this.treeCap); if (!pick) break; if (pick.skip) continue; // ชนิดที่สุ่มได้เต็มโควตาแล้ว รอบนี้ไม่งอก
          const { x, y, k } = pick; this.treeKind.set(x + ',' + y, k); counts[k] = (counts[k] || 0) + 1;
          this.map[y][x] = T.TREE; this.dirty = true; this.broadcast({ t: 'tree', x, y, on: true, k }); n++;
        }
        { // ถอนต้นที่เกินโควตาทีละต้นต่อรอบ (ไม่ถอนต้นที่มีคนอยู่ใกล้หรือกำลังฟัน) เพื่อเปิดที่ให้ชนิดที่ขาด • ปกติไม่มีต้นเกินโควตา (งอกกันไว้แล้ว) ใช้เคลียร์แมพเก่าที่ต้นแพงสะสมไว้
          const pl = [...this.players.values()], cut = S.pickTreeTrim(this.treeList(), this.treeCap, Math.random, (x, y) => !(this.treeHp && this.treeHp.has(x + ',' + y)) && !pl.some(q => Math.hypot(q.x - (x + 0.5) * TS, q.y - (y + 0.5) * TS) < 4 * TS));
          if (cut) { const [x, y] = cut; this.map[y][x] = T.GRASS; this.treeKind.delete(x + ',' + y); this.dirty = true; this.broadcast({ t: 'tree', x, y, on: false }); }
        }
      }
      const died = this.animals.filter(a => a.dead);
      if (died.length) {
        const keys = new Set(died.map(a => a.owner).filter(Boolean));
        for (const a of died) {
          const op = [...this.players.values()].find(q => q.key === a.owner);
          if (op) this.toast(op, `💀 ${ANIMALS[a.type].emoji} ${ANIMALS[a.type].name}ของคุณตายแล้ว ต้องซื้อใหม่ที่ร้านปศุสัตว์`);
        }
        this.animals = this.animals.filter(a => !a.dead);
        for (const key of keys) { const op = [...this.players.values()].find(q => q.key === key); if (op) this.syncHerd(op); }
        this.dirty = true;
      }
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
      else if (f.st === 'fight') { // ชักเย่อ: เดินเวลาตามสถานะกรอ + ส่งสถานะจริงให้เว็บปรับ (เว็บทำนายเองระหว่างนั้น)
        this.fightAdvance(p, now);
        const g = p.fish; if (g && g.st === 'fight' && now - g.sync >= 150) { g.sync = now; send(p, { t: 'fs', ten: +g.ft.ten.toFixed(1), dist: +g.ft.dist.toFixed(1), el: Math.round(g.ft.t) }); }
      }
    }
    if (!this.players.size) return;
    const groups = new Map(); // ส่งตำแหน่งแยกตามฉาก: คนในบ้านเห็นเฉพาะคนในบ้านเดียวกัน
    for (const q of this.players.values()) { const k = q.scene || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(q); }
    for (const [k, ps] of groups) {
      const msg = { t: 's', p: ps.map(p => [p.id, Math.round(p.x), Math.round(p.y), p.dir, p.fish ? (p.fish.st === 'bite' ? 2 : p.fish.st === 'fight' ? 3 : 1) : 0, p.fish ? p.fish.fx : 0, p.fish ? p.fish.fy : 0, p.sit ? (p.sit.lie ? 2 : 1) : 0, p.fish ? p.fish.bt || 1 : 1]), n: [], pt: [], c: [] };
      if (!k) {
        msg.n = this.npcs.map(n => [n.id, Math.round(n.x), Math.round(n.y), n.dir]);
        msg.pt = this.pets.map(q => [q.id, Math.round(q.x), Math.round(q.y), q.dir, q.moving ? 1 : 0]);
        msg.c = this.animals.map(a => [a.id, a.type, Math.round(a.x), Math.round(a.y), a.prod ? 1 : 0, a.fed ? 1 : 0, a.dx, Math.round(a.hunger), a.sick ? 1 : 0, a.prod && a.feeder && (a.pm || 0) < S.DAY_MS ? 1 : 0, a.prod ? a.fn || '' : '', a.on || '']);
      }
      const str = JSON.stringify(msg); for (const q of ps) if (q.ws.readyState === 1) q.ws.send(str);
    }
  }


  save(sync) {
    if (!this.dirty) return;
    this.dirty = false;
    for (const p of this.players.values()) { const r = this.townPos(p); p.rec.x = r.x; p.rec.y = r.y; this.syncHerd(p); } // เซฟฝูงลง rec.herd ก่อนเขียนไฟล์
    const data = JSON.stringify({ evt: this.evt, chain: this.chain, invites: this.invites, layout: 2, rents: this.rents, farm: this.farm, players: this.saved, animals: {}, market: this.market, mktDay: this.mktDay, trees: this.treeList(), treeMix: this.treeMixV | 0, house: { houses: this.houses }, log: this.log, lotto: this.lotto, stats: this.stats, village: this.village, week: this.week, orders: this.orders, stall: this.stall, banned: [...(this.banned || [])], mocks: this.mocks || [], mapOv: this.mapOv || {} }, replacer);
    if (sync) { fs.writeFileSync(this.file, data); return; }
    fs.writeFile(this.file + '.tmp', data, err => { if (!err) fs.rename(this.file + '.tmp', this.file, () => {}); });
  }
}
const { mix } = require('./server/mixin.js');
mix(World, require('./server/systems/lotto.js')); // ระบบหวย (ย้ายไป server/systems/lotto.js)
mix(World, require('./server/systems/cinema.js')); // ระบบโรงหนัง (ย้ายไป server/systems/cinema.js)
mix(World, require('./server/systems/npc.js')); // ชาวเมืองและสัตว์ประกอบฉาก (ย้ายไป server/systems/npc.js)
mix(World, require('./server/systems/telemetry.js')); // สถิติการกระทำ/ความมั่งคั่ง (ย้ายไป server/systems/telemetry.js)
mix(World, require('./server/systems/bank.js')); // ธนาคาร ATM (ย้ายไป server/systems/bank.js)
mix(World, require('./server/systems/crafting.js')); // เชฟและคราฟต์ (ย้ายไป server/systems/crafting.js)
mix(World, require('./server/systems/orders.js')); // ใบงาน NPC (ย้ายไป server/systems/orders.js)
mix(World, require('./server/systems/stall.js')); // แผงฝากขาย (ย้ายไป server/systems/stall.js)
mix(World, require('./server/systems/trade.js')); // เทรดระหว่างผู้เล่น (ย้ายไป server/systems/trade.js)
mix(World, require('./server/systems/events.js')); // อีเวนต์ประจำสัปดาห์ (ย้ายไป server/systems/events.js)
mix(World, require('./server/systems/challenge.js')); // ชาเลนจ์ถังน้ำ (ย้ายไป server/systems/challenge.js)
mix(World, require('./server/systems/village.js')); // หมู่บ้านและสัปดาห์เมือง (ย้ายไป server/systems/village.js)
mix(World, require('./server/systems/energy.js')); // พลังงานและความล้า (ย้ายไป server/systems/energy.js)
mix(World, require('./server/systems/tools.js')); // ความทนทานเครื่องมือและบัวรดน้ำ (ย้ายไป server/systems/tools.js)
mix(World, require('./server/systems/hunger.js')); // ความหิวและการกิน (ย้ายไป server/systems/hunger.js)
mix(World, require('./server/systems/pets.js')); // สัตว์เลี้ยงของผู้เล่น (ย้ายไป server/systems/pets.js)
mix(World, require('./server/systems/quests.js')); // เควสประจำวัน แต้ม บัฟ ข่าวชื่อเสียง (ย้ายไป server/systems/quests.js)
mix(World, require('./server/systems/achievements.js')); // ความสำเร็จ ฉายา ดาว สมุดสะสม (ย้ายไป server/systems/achievements.js)
mix(World, require('./server/systems/onboarding.js')); // คู่มือเริ่มต้น สัปดาห์แรก ของขวัญ ทักทาย สตรีค (ย้ายไป server/systems/onboarding.js)
mix(World, require('./server/systems/farm.js')); // ไร่ แปลงปลูก แปลงเช่า (ย้ายไป server/systems/farm.js)
mix(World, require('./server/systems/animals.js')); // สัตว์ในฟาร์ม ฝูง คอก ผึ้ง (ย้ายไป server/systems/animals.js)
mix(World, require('./server/systems/map.js')); // ชั้นแก้แมพ ต้นไม้ (ย้ายไป server/systems/map.js)
mix(World, require('./server/systems/arcade/uno.js')); // UNO ในตู้เกม (ย้ายไป server/systems/arcade/uno.js)

// ผู้ดูแล: ชื่อตัวละคร ADMIN_NAME (ค่าเริ่มต้น Sira) ต้องใส่รหัสถึงจะเข้าได้ — รหัสมาจากตัวแปร ADMIN_KEY หรือไฟล์ admin.key (ไม่มีก็สุ่มสร้างให้ ไม่เคยส่งไปกับหน้าเว็บ)
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
  if (u === '/layout.js') { res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }); return res.end('window.__LAYOUT=' + JSON.stringify(globalThis.__LAYOUT || null) + ';'); }
  if (u === '/api/bug') { if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); return res.end(); } return handleBug(req, res); }
  if (u === '/') u = '/index.html';
  if (u.includes('\0') || u.includes('%00')) { res.writeHead(400); return res.end(); } // กัน path แปลกที่เคยทำให้เซิร์ฟล่ม
  const f = path.normalize(path.join(PUB, u));
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
const KEY_FILE = path.join(__dirname, 'admin.key');
let ADMIN_KEY = process.env.ADMIN_KEY || '';
if (!ADMIN_KEY) { try { ADMIN_KEY = fs.readFileSync(KEY_FILE, 'utf8').trim(); } catch (e) { /* ยังไม่มีไฟล์ */ } }
if (!ADMIN_KEY) { ADMIN_KEY = crypto.randomBytes(9).toString('base64url'); try { fs.writeFileSync(KEY_FILE, ADMIN_KEY + '\n'); console.log('สร้างรหัสผู้ดูแลใหม่ไว้ที่ ' + KEY_FILE); } catch (e) { console.log('รหัสผู้ดูแล (ชั่วคราว ไม่ได้บันทึก):', ADMIN_KEY); } }
const sha = x => crypto.createHash('sha256').update(String(x)).digest();
const keyOk = x => crypto.timingSafeEqual(sha(x), sha(ADMIN_KEY));
const normName = n => Array.from(String(n || '').replace(/\s+/g, ' ').trim()).slice(0, 12).join('');
// PIN ของบัญชี (ต่อห้อง): เก็บเป็น scrypt + salt ไม่เก็บตัวเลขจริง • ผิดเกิน 5 ครั้งใน 1 นาทีต่อชื่อ ล็อก 1 นาที
const PIN_RE = /^\d{4,6}$/;
const pinMake = pin => { const s = crypto.randomBytes(8).toString('hex'); return { s, h: crypto.scryptSync(pin, s, 32).toString('hex') }; };
const pinOk = (rec, pin) => { const p = rec && rec.pin; if (!p || typeof pin !== 'string' || !PIN_RE.test(pin)) return false; return crypto.timingSafeEqual(Buffer.from(p.h, 'hex'), crypto.scryptSync(pin, p.s, 32)); };
const pinFails = new Map(); // 'ห้อง/ชื่อ' → [เวลาที่ใส่ผิด]
const pinLocked = k => { const now = Date.now(), a = (pinFails.get(k) || []).filter(t => now - t < 60000); pinFails.set(k, a); return a.length >= 5; };
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
// ----- ผังเมืองที่ผู้ดูแลย้ายได้ (ร้าน/ป้าย Arcade/ตู้เกม/กองไฟ+ลาน/ATM/กระดานข่าว/ตู้เซฟ) -----
const LAYOUT_IDS = /^(b_[a-z]+|cab[0-9]|fire|atm|board|lotto)$/;
const cleanLayoutItems = raw => { const out = {}; if (raw && typeof raw === 'object') for (const [id, v] of Object.entries(raw)) { if (!LAYOUT_IDS.test(id) || !v) continue; const x = Math.trunc(+v.x), y = Math.trunc(+v.y); if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < S.W && y < S.H) out[id] = { x, y }; } return out; };
const liveLayoutItems = (Sx) => { const o = {}; for (const b of Sx.BUILDINGS) o['b_' + b.kind] = { x: b.x0, y: b.y0 }; Sx.CABINETS.forEach((c, i) => { o['cab' + i] = { x: c.x, y: c.y }; }); o.fire = { x: Sx.FIRE.x, y: Sx.FIRE.y }; o.atm = { x: Sx.ATM.x, y: Sx.ATM.y }; o.board = { x: Sx.BOARD.x, y: Sx.BOARD.y }; o.lotto = { x: Sx.LUCKY.x, y: Sx.LUCKY.y }; return o; };
const LAYOUT_NAMES = { fire: 'กองไฟ', atm: 'ATM', board: 'กระดานข่าว', lotto: 'Lucky Lotto' };
const layoutName = id => LAYOUT_NAMES[id] || (/^cab/.test(id) ? 'ตู้เกม ' + (+id.slice(3) + 1) : (S.BUILDINGS.find(b => 'b_' + b.kind === id) || {}).name || id);
function loadSharedWith(lay) { // สร้างสำเนา shared.js ที่ใช้ผังทดลอง โดยไม่แตะตัวที่เกมใช้อยู่
  const key = require.resolve('./public/shared.js'), cached = require.cache[key], prev = globalThis.__LAYOUT;
  delete require.cache[key]; globalThis.__LAYOUT = lay;
  try { return require('./public/shared.js'); } finally { globalThis.__LAYOUT = prev; delete require.cache[key]; if (cached) require.cache[key] = cached; }
}
function unreachableCount(Sx, m) { // ช่องเดินได้ที่เดินไปไม่ถึงจากจุดเกิด + ตัวช่วยดูว่าช่องไหนไปถึง
  const { W, H, TS } = Sx, walk = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !Sx.blockedAt(m, x * TS + 16, y * TS + 16);
  const sx = Math.floor(Sx.SPAWN.x / TS), sy = Math.floor(Sx.SPAWN.y / TS), seen = new Set([sy * 1000 + sx]), q = [[sx, sy]];
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of Sx.DIRS) { const nx = x + dx, ny = y + dy; if (walk(nx, ny) && !seen.has(ny * 1000 + nx)) { seen.add(ny * 1000 + nx); q.push([nx, ny]); } } }
  let n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (walk(x, y) && !seen.has(y * 1000 + x)) n++;
  return { n, seen, walk };
}
function validateLayout(items) { // คืนรายการข้อผิดพลาด (ว่าง = ใช้ได้)
  const errs = [], Sx = loadSharedWith({ items }), { W, H, T } = Sx, m = Sx.makeMap(), bare = Sx.makeMap({ bare: true });
  const occ = new Map(), okTerrain = new Set([T.GRASS, T.PATH, T.SAND, T.TREE]);
  const inRect = (x, y, r, pad) => x >= r.x0 - pad && x <= r.x1 + pad && y >= r.y0 - pad && y <= r.y1 + pad;
  const claim = (name, x, y, floating) => {
    if (x < 1 || y < 1 || x > W - 2 || y > H - 2) { errs.push(name + ' อยู่นอกแมพ'); return; }
    if (!okTerrain.has(bare[y][x])) errs.push(`${name} ทับน้ำ/รั้ว/หน้าผา/ถนนไม่ได้ที่ช่อง (${x},${y})`);
    if (inRect(x, y, Sx.FARM, 1)) errs.push(`${name} ทับแปลงผักที่ช่อง (${x},${y})`);
    for (const P of Object.values(Sx.PENS)) if (inRect(x, y, P, 1)) errs.push(`${name} ทับคอกสัตว์ที่ช่อง (${x},${y})`);
    if (inRect(x, y, Sx.HOUSE_BLD, 0)) errs.push(`${name} ทับบ้านหลังใหญ่ที่ช่อง (${x},${y})`);
    if (floating) return;
    const k = y * 1000 + x; if (occ.has(k)) errs.push(`${name} ซ้อนกับ ${occ.get(k)} ที่ช่อง (${x},${y})`); else occ.set(k, name);
  };
  for (const b of Sx.BUILDINGS) {
    const nm = b.name || b.kind;
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) claim(nm, x, y, b.kind === 'sign');
    if (b.counter.length) { const [cx, cy] = b.counter[0]; claim(nm + ' (ช่องยืนหน้าประตู)', cx, cy + 1, true); }
  }
  Sx.CABINETS.forEach((c, i) => claim('ตู้เกม ' + (i + 1), c.x, c.y));
  claim('กองไฟ', Sx.FIRE.x, Sx.FIRE.y); claim('ATM', Sx.ATM.x, Sx.ATM.y); claim('กระดานข่าว', Sx.BOARD.x, Sx.BOARD.y); claim('Lucky Lotto', Sx.LUCKY.x, Sx.LUCKY.y);
  for (const q of Sx.SEATS) claim('ที่นั่งลานกองไฟ', q.x, q.y);
  if (errs.length) return [...new Set(errs)];
  const now = unreachableCount(S, S.makeMap()), nw = unreachableCount(Sx, m);
  if (nw.n > now.n) errs.push(`มีช่องเดินได้ ${nw.n - now.n} ช่องที่เดินไปไม่ถึง (ร้าน/ตู้อาจล้อมช่องว่างไว้)`);
  for (const b of Sx.BUILDINGS) if (b.counter.length) { const [cx, cy] = b.counter[0]; if (!nw.walk(cx, cy + 1) || !nw.seen.has((cy + 1) * 1000 + cx)) errs.push(`เดินไปหน้าประตู ${b.name} ไม่ถึง`); }
  const adj = (nm, x, y) => { if (!Sx.DIRS.some(([dx, dy]) => nw.seen.has((y + dy) * 1000 + (x + dx)))) errs.push(nm + ' ไม่มีช่องเดินติดอยู่เลย (ใช้งานไม่ได้)'); };
  Sx.CABINETS.forEach((c, i) => adj('ตู้เกม ' + (i + 1), c.x, c.y)); adj('ATM', Sx.ATM.x, Sx.ATM.y); adj('กระดานข่าว', Sx.BOARD.x, Sx.BOARD.y); adj('Lucky Lotto', Sx.LUCKY.x, Sx.LUCKY.y);
  return [...new Set(errs)];
}
function layoutHistory() { try { return fs.readdirSync(LAYOUT_HIST).filter(f => f.endsWith('.json')).sort(); } catch (e) { return []; } }
function commitLayout(world, p, items, how) { // เก็บของเดิมเข้าประวัติ → เขียนไฟล์ใหม่ → เซฟโลก → สั่งทุกเครื่องรีเฟรช → รีสตาร์ท (systemd เปิดให้ใหม่)
  fs.mkdirSync(LAYOUT_HIST, { recursive: true });
  const cur = readLayoutFile(LAYOUT_FILE);
  fs.writeFileSync(path.join(LAYOUT_HIST, 'layout-' + Date.now() + '.json'), JSON.stringify(cur || { items: {} }));
  const old = layoutHistory(); for (const f of old.slice(0, Math.max(0, old.length - 30))) { try { fs.unlinkSync(path.join(LAYOUT_HIST, f)); } catch (e) { /* ลบไม่ได้ก็ข้าม */ } }
  if (items) { fs.writeFileSync(LAYOUT_FILE + '.tmp', JSON.stringify({ v: 1, items, by: p.name, at: Date.now() })); fs.renameSync(LAYOUT_FILE + '.tmp', LAYOUT_FILE); } else { try { fs.unlinkSync(LAYOUT_FILE); } catch (e) { /* ไม่มีไฟล์ก็คือค่าเดิมอยู่แล้ว */ } }
  console.log('ผู้ดูแลเปลี่ยนผังเมือง (' + how + '):', p.name, '→ รีสตาร์ทเพื่อใช้ผังใหม่');
  for (const w of worlds.values()) { try { w.save(true); } catch (e) { console.error('เซฟก่อนรีสตาร์ทไม่ได้:', e.message); } }
  world.broadcast({ t: 'reload', why: 'layout' });
  if (!process.env.LAYOUT_NO_EXIT) setTimeout(() => process.exit(0), 1500);
}
function adminHandle(p, world, m) {
  const reply = o => send(p, Object.assign({ t: 'admin', rooms: roomsPub(), current: world.room }, o));
  if (m.a === 'rooms') return reply({});
  if (m.a === 'news') { // ประกาศจากผู้ดูแล: ขึ้นข่าวเมือง (ค้างใน 15 ข่าวล่าสุด) + ป้ายข้อความให้ทุกคนที่ออนไลน์ในห้องนั้น
    const text = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 300); if (!text) return reply({ err: 'ไม่มีข้อความ' });
    world.addLog('📢 ' + text); world.broadcast({ t: 'msg', text: '📢 ' + text }); console.log('ประกาศ (ห้อง ' + world.room + '):', text); return reply({ ok: 'ประกาศแล้ว' });
  }
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
  if (m.a === 'pinreset') { // ผู้ดูแลล้าง PIN ให้คนที่ลืม (ให้ตั้งใหม่ตอนเข้าเกม)
    const w = ROOMS.has(String(m.room || '')) ? getWorld(String(m.room)) : world, key = normName(m.name).toLowerCase(), rec = w && w.saved[key]; if (!rec) return reply({ err: 'ไม่พบชื่อนี้ในห้อง' });
    delete rec.pin; w.dirty = true; console.log('ล้าง PIN:', key, '(โดย ' + p.name + ')'); return reply({ err: `ล้าง PIN ของ ${rec.name || key} แล้ว ให้เขาตั้งใหม่ตอนเข้าเกม` });
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
  if (m.a === 'coin') { // ผู้ดูแลปรับเหรียญของตัวเองเท่านั้น (ห้องที่กำลังอยู่) n = จำนวน (ติดลบ = ลด ลดได้ไม่ต่ำกว่า 0)
    const n = Math.trunc(Number(m.n));
    if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 1000000) return reply({ err: 'จำนวนต้องเป็นตัวเลขที่ไม่ใช่ 0 และไม่เกิน 1,000,000', users: userList() });
    world.add(p, 'coin', n, 'admin');
    console.log('ผู้ดูแลปรับเหรียญตัวเอง:', p.name, (n > 0 ? '+' : '') + n, '→', p.rec.inv.coin, '(ห้อง ' + world.room + ')');
    return reply({ coinmsg: `🪙 ${p.name}: ${n > 0 ? '+' : ''}${n} (เหลือ ${p.rec.inv.coin})`, users: userList() });
  }
  if (m.a === 'lvl') { // ผู้ดูแลปรับเลเวลอาชีพของตัวเองเพื่อทดสอบ: d = +1/-1 เลเวล หรือ to = เลเวลที่ต้องการ (ตั้ง XP ให้พอดีขั้นนั้น)
    const sk = String(m.skill || ''); if (!Object.hasOwn(S.SKILLS, sk)) return reply({ err: 'ไม่รู้จักอาชีพนี้' });
    const cur = world.lv(p, sk), to = Number.isFinite(+m.to) ? Math.trunc(+m.to) : cur + Math.trunc(+m.d || 0);
    if (!(to >= 1 && to <= S.MAX_LV)) return reply({ err: `เลเวลต้องอยู่ระหว่าง 1–${S.MAX_LV}` });
    p.rec.skills[sk] = S.xpFor(to); world.dirty = true;
    send(p, { t: 'skills', skills: p.rec.skills });
    console.log('ผู้ดูแลปรับเลเวล:', p.name, S.SKILLS[sk].name, cur, '→', to, '(ห้อง ' + world.room + ')');
    return reply({ lvmsg: `🎚️ ${S.SKILLS[sk].emoji} ${S.SKILLS[sk].name} เลเวล ${to}` });
  }
  if (m.a === 'warplist') { // รายการจุดวาปในห้องนี้: บ้านของทุกคนที่เคยเข้าเกมในห้องนี้ + จำนวนชั้นถ้ำ
    const houses = Object.keys(world.saved).map(k => ({ key: k, name: world.saved[k].name || k })).sort((a, b) => a.name.localeCompare(b.name, 'th'));
    return reply({ warp: { houses, floors: S.MINE.floors } });
  }
  if (m.a === 'warp') { const err = world.warpTo(p, String(m.to || '')); return reply(err ? { err } : { warpmsg: '🧭 วาปแล้ว' }); }
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
  // ----- แก้แมพ (ผู้ดูแล): Mock วางแผนอิสระ + วาดพื้นห้องนี้ -----
  if (m.a === 'layoutapply') {
    const want = cleanLayoutItems(m.items), live = liveLayoutItems(S), changed = Object.keys(want).filter(id => live[id] && (live[id].x !== want[id].x || live[id].y !== want[id].y));
    if (!changed.length) return reply({ mapedit: true, ok: 'ตำแหน่งตรงกับผังที่ใช้อยู่แล้ว ไม่มีอะไรต้องเปลี่ยน' });
    const items = Object.assign({}, (globalThis.__LAYOUT && globalThis.__LAYOUT.items) || {}, want), errs = validateLayout(items);
    if (errs.length) return reply({ mapedit: true, err: 'ใช้ผังนี้ไม่ได้ — ' + errs.slice(0, 5).join(' • ') });
    reply({ mapedit: true, ok: 'ย้าย ' + changed.map(layoutName).join(', ') + ' แล้ว กำลังรีสตาร์ทเกม…' });
    return commitLayout(world, p, items, 'ใช้ผังใหม่ ' + changed.length + ' รายการ');
  }
  if (m.a === 'layoutundo') {
    const hist = layoutHistory(); if (!hist.length) return reply({ mapedit: true, err: 'ยังไม่มีผังเก่าให้ย้อนกลับ' });
    const last = path.join(LAYOUT_HIST, hist[hist.length - 1]), prev = readLayoutFile(last);
    const items = prev ? prev.items : null, errs = items && Object.keys(items).length ? validateLayout(items) : [];
    if (errs.length) return reply({ mapedit: true, err: 'ย้อนกลับไม่ได้ — ' + errs.slice(0, 3).join(' • ') });
    try { fs.unlinkSync(last); } catch (e) { /* ลบไม่ได้ก็ไม่เป็นไร */ }
    reply({ mapedit: true, ok: 'ย้อนกลับไปผังก่อนหน้า กำลังรีสตาร์ทเกม…' });
    return commitLayout(world, p, items && Object.keys(items).length ? items : null, 'ย้อนกลับ');
  }
  if (m.a === 'layoutreset') {
    reply({ mapedit: true, ok: 'คืนผังตั้งต้นของโค้ด กำลังรีสตาร์ทเกม…' });
    return commitLayout(world, p, null, 'คืนผังตั้งต้น');
  }
  if (m.a === 'mapget') return reply({ mapedit: true, mocks: world.mocks || [], mapOv: world.mapOv || {}, paint: S.MAP_PAINT });
  if (m.a === 'mocks') {
    const mocks = S.sanitizeMocks(m.mocks);
    world.mocks = mocks; world.dirty = true;
    world.adminSend({ t: 'mocks', mocks });
    console.log('ผู้ดูแลแก้ Mock แมพ:', p.name, mocks.length, 'ชิ้น (ห้อง ' + world.room + ')');
    return reply({ mapedit: true, mocks, ok: 'บันทึก Mock แล้ว (' + mocks.length + ' ชิ้น)' });
  }
  if (m.a === 'mappaint') {
    const cells = world.paintCells(m.cells);
    if (!cells) return reply({ err: 'วาดแมพไม่สำเร็จ (ช่องไม่ถูกต้องหรือว่าง)', mapedit: true });
    return reply({ mapedit: true, painted: cells.length }); // ไม่ส่ง mocks/ok ทุกครั้ง — กันทับของที่กำลังแก้และสแปม toast
  }
  if (m.a === 'mapovclear') { // ล้างเฉพาะช่องที่วาดทับ คืนพื้นจาก makeMap + ต้นไม้ที่ยังอยู่ใน treeKind + โครงการ
    const keep = world.treeList();
    world.mapOv = {};
    world.map = S.makeMap();
    for (const P of S.PROJECTS) if (S.projectDone(P.id, world.projects[P.id].coin)) S.applyProject(world.map, P.id);
    world.treeKind = new Map();
    for (const [x, y, k] of keep) {
      if (world.map[y] && world.map[y][x] === T.GRASS && x >= 1 && y >= 1 && x <= S.W - 2 && y <= S.H - 2) {
        world.map[y][x] = T.TREE; world.treeKind.set(x + ',' + y, k || 'broad');
      }
    }
    world.dirty = true;
    world.broadcast({ t: 'mapreset', trees: world.treeList() });
    console.log('ผู้ดูแลล้างการวาดแมพ:', p.name, '(ห้อง ' + world.room + ')');
    return reply({ mapedit: true, mocks: world.mocks || [], mapOv: {}, ok: 'ล้างพื้นที่วาดทับแล้ว (Mock ยังอยู่)' });
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
      const pkey = normName(m.name).toLowerCase(), prec = w.saved[pkey], pk = room + '/' + pkey, pin = typeof m.pin === 'string' ? m.pin.trim() : '';
      if (!admin && prec && prec.pin) { // บัญชีที่ตั้ง PIN แล้ว ต้องใส่ PIN ถูก
        if (pinLocked(pk)) return err('ใส่ PIN ผิดบ่อยเกินไป รอ 1 นาทีแล้วลองใหม่', { need: 'pin' });
        if (!pinOk(prec, pin)) { pinFails.get(pk).push(Date.now()); if (++authFails > 8) { ws.close(); return; } return err(pin ? 'PIN ไม่ถูกต้อง' : 'ชื่อนี้ตั้ง PIN ไว้ กรุณาใส่ PIN', { need: 'pin' }); }
      }
      const r = w.join(ws, m.name, m.color, admin);
      if (!r.err && !prec && PIN_RE.test(pin)) { r.p.rec.pin = pinMake(pin); w.dirty = true; } // บัญชีใหม่ที่ใส่ PIN มาตั้งแต่สมัคร
      if (!r.err && m.ch) w.chJoinInvite(r.p, String(m.ch).slice(0, 16), ip); // เข้ามาจากลิงก์ชาเลนจ์ถังน้ำ
      if (r.err) err(r.err);
      else {
        player = r.p; world = w; player.ip = ip;
        const rec = player.rec, now = Date.now(); rec.lastSeen = now; rec.ips = [{ ip, t: now }].concat((rec.ips || []).filter(x => x && x.ip !== ip)).slice(0, 5); w.dirty = true;
        console.log('เข้าเกม:', player.name, '←', ip, '(ห้อง ' + w.room + ')');
        ws.send(JSON.stringify({ t: 'pinask', has: !!rec.pin, show: !rec.pin && !admin && (rec.joins || 1) > 1 })); // บัญชีเก่าที่ยังไม่มี PIN: ขอให้ตั้ง (คนใหม่ให้เล่นก่อน ค่อยถามครั้งถัดไป)
      }
      return;
    }
    if (m.t === 'pin') { // ตั้ง/เปลี่ยน PIN ในเกม (มี PIN อยู่แล้วต้องใส่ PIN เดิม)
      const rec = player.rec, pin = String(m.pin || ''), k = world.room + '/' + player.key;
      if (!PIN_RE.test(pin)) return world.toast(player, 'PIN ต้องเป็นตัวเลข 4–6 หลัก');
      if (rec.pin) { if (pinLocked(k)) return world.toast(player, 'ใส่ PIN ผิดบ่อยเกินไป รอ 1 นาที'); if (!pinOk(rec, String(m.old || ''))) { pinFails.get(k).push(Date.now()); return world.toast(player, 'PIN เดิมไม่ถูกต้อง'); } }
      rec.pin = pinMake(pin); world.dirty = true; ws.send(JSON.stringify({ t: 'pinask', has: true })); return world.toast(player, '🔐 ตั้ง PIN แล้ว ครั้งหน้าเข้าเกมใส่ PIN ด้วยนะ');
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
  const now = Date.now();
  let dt = (now - last) / 1000; last = now;
  // นาฬิกาเครื่องกระโดด (NTP/VM): dt ติดลบจะทำให้ treeTimer/ความหิวย้อนหลัง ต้นไม้ไม่งอกเป็นชั่วโมง — ข้ามเฟรมนั้น
  if (!Number.isFinite(dt) || dt < 0 || dt > 5) dt = 0;
  else dt = Math.min(0.5, dt);
  for (const w of worlds.values()) guard(() => w.tick(dt, now));
}, 100);
setInterval(() => { const now = Date.now(); for (const w of worlds.values()) guard(() => w.cropTick(now)); }, 1000);
setInterval(() => { const now = Date.now(); for (const w of worlds.values()) guard(() => w.oreTick(now)); }, 5000);
setInterval(() => { for (const w of worlds.values()) guard(() => w.save(false)); }, 30000);
setInterval(() => { const now = Date.now(); for (const w of worlds.values()) guard(() => w.marketTick(now)); }, +process.env.MARKET_TICK_MS || 60000); // ตลาดปรับราคาทุก 1 นาที

function shutdown() { for (const w of worlds.values()) { for (const p of w.players.values()) w.telFlush(p, true); w.arcRefundAll(); w.dirty = true; w.save(true); } process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => {
  const w = getWorld(DEFAULT_ROOM); // โหลดห้องหลักตอนสตาร์ท ให้รัน migrate (เช่น ย้อน px64) แล้วเซฟ
  if (w && w.dirty) w.save(true);
  console.log(`My World รันอยู่ที่ http://localhost:${PORT}`);
});
