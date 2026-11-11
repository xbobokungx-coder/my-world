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

const { CAVE, ADMIN_NAME } = require('./server/consts.js'); // ฉากถ้ำเหมือง (ย้ายไป server/consts.js)
const HOUSE_MSG = new Set(['m', 'act', 'sw', 'reel', 'held', 'status', 'deaf', 'voice', 'rtc', 'pcall', 'look', 'eat', 'pet', 'petname', 'petcare', 'lamp', 'chat', 'house', 'gift', 'greet']); // ข้อความที่ใช้ได้ตอนอยู่ในบ้าน (ที่เหลือเป็นเรื่องของเมือง)
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
      let mineRefund = 0, mineMoved = 0; // สรุปการย้ายเซฟนักขุดแร่ (xpv 4) ลง log ครั้งเดียว เหรียญที่คืนไม่ผ่าน telemetry
      for (const rec of Object.values(this.saved)) { // ย้าย XP มาตาราง XP_TABLE (ครั้งเดียวต่อบัญชี) เลเวลเท่าเดิม
        if (!rec || rec.xpv >= 4) continue;
        if (rec.xpv === 3) { const r = S.migrateMineV4(rec); if (r) { mineMoved++; mineRefund += r.refund || 0; } this.dirty = true; continue; } // xpv 4 (6 พ.ย. 2026): นักขุดแร่ตารางหลอดใหม่ + อีเต้อ 10 ชนิด + คืนเหรียญถุงมือ/ค้อน
        if (rec.xpv !== 2 && rec.skills) for (const k of Object.keys(rec.skills)) if (Number.isFinite(rec.skills[k])) rec.skills[k] = S.xpFromV1(rec.skills[k]);
        if (rec.skills) for (const k of Object.keys(rec.skills)) if (Number.isFinite(rec.skills[k])) rec.skills[k] = S.xpFromV2(rec.skills[k]); // xpv 3 (31 ต.ค. 2026): ยืดเลเวลต้น เลเวลเท่าเดิม
        rec.xpv = 3; const r = S.migrateMineV4(rec); if (r) { mineMoved++; mineRefund += r.refund || 0; } this.dirty = true;
      }
      if (mineMoved) console.log(`[migrate] นักขุดแร่ xpv 4: ย้าย ${mineMoved} บัญชี คืนเหรียญถุงมือ/ค้อนรวม ${mineRefund}`);
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
  loadProjects(d) { // โครงการพัฒนาเมือง: เก็บเงินที่ลงขันและชื่อผู้ร่วมสร้าง (ชื่อ → ยอดรวม)
    this.projects = {};
    for (const P of S.PROJECTS) {
      const o = d && d[P.id] || {}, don = Object.create(null);
      if (o.donors && typeof o.donors === 'object') for (const [nm, v] of Object.entries(o.donors)) if (Number.isFinite(v) && v > 0) don[String(nm).slice(0, 12)] = Math.floor(v);
      this.projects[P.id] = { coin: P.goal, donors: don }; // สะพาน/ประภาคาร/เกาะ มีให้เลยตั้งแต่ต้น (ไม่ต้องลงขัน)
    }
  }









  join(ws, name, color, admin) {
    name = Array.from(String(name || '').replace(/\s+/g, ' ').trim()).slice(0, 12).join('');
    if (!name) return { err: 'กรุณาใส่ชื่อตัวละคร' };
    const key = name.toLowerCase();
    if (!admin && this.banned && this.banned.has(key)) return { err: 'ชื่อนี้ถูกระงับโดยผู้ดูแล 🚫 กรุณาใช้ชื่ออื่น' };
    for (const q of this.players.values()) if (q.key === key) return { err: 'ชื่อนี้กำลังเล่นอยู่ ลองใช้ชื่ออื่น' };
    let rec = this.saved[key];
    if (!rec) rec = this.saved[key] = { firstSeen: Date.now(), inv: { coin: 50, seed_carrot: 5, feed: 5, bait: 10, meal_bread: 3 }, mig2: true, xpv: 4, gift: S.NEWBIE.gift[Math.floor(Math.random() * S.NEWBIE.gift.length)], x: S.START_SPAWN.x, y: S.START_SPAWN.y, color: HEX.test(color) ? color : '#3498db' };
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
    this.themeSend(p); // โหมดหิมะปัจจุบัน
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
      case 'rank': this.sendRank(p); break;
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
    if (town) { send(p, { t: 'town', w: town, fee: town === 'sea' ? this.seaFee(p) : undefined, boat: town === 'sea' ? p.rec.inv.boat > 0 : undefined, win: town === 'sea' && !(p.rec.inv.boat > 0) ? S.oceanWindow(Date.now()) : undefined, min: town === 'sea' ? S.SEA.minFishLv : undefined, ms: town === 'sea' ? S.SEA.ms : undefined }); return; }
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
      if (S.rainAt(now, this.themeRain())) return this.toast(p, '🌧️ ฝนตกอยู่ ดินเปียกเองแล้ว ไม่ต้องรดน้ำ'); // ฝนตก: ไม่ให้ XP ไม่หักน้ำ ไม่เสียความทนทาน
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





  tick(dt, now) {
    this.rainTick(now);
    this.lottoTick(now);
    for (const p of this.players.values()) {
      const cf = S.caveFloor(p.scene); if (!S.isSeaScene(cf)) continue;
      if (p.seaUntil === Infinity) continue; // เรือของตัวเอง ไม่จำกัดเวลา
      if (now >= (p.seaUntil || 0)) this.seaLeave(p, S.isOcean(cf) ? '🌇 ร้านเช่าเรือปิดแล้ว (19:00) กัปตันพากลับเกาะ' : '⛵ ครบเวลาออกทะเล กัปตันพากลับเกาะแล้ว');
      else if (S.isOcean(cf)) { const left = p.seaUntil - now; if (left <= 60000 && !(p.seaW & 1)) { p.seaW |= 1; this.toast(p, '🌇 เรือเช่าใกล้หมดเวลา (ร้านปิด 19:00) อีก 1 นาทีกัปตันจะพากลับ แล่นกลับท่า (ซ้ายสุดของแมพ) ได้ก่อน'); } else if (left <= 15000 && !(p.seaW & 2)) { p.seaW |= 2; this.toast(p, '⛵ เรือกำลังจะกลับท่าแล้ว!'); } }
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
            this.sceneBroadcast(null, { t: 'sfx', k: 'die', id: 0, x: Math.round(a.x), y: Math.round(a.y) });
          }
        } else { a.zero = 0; a.warned = false; }
        if (a.sick && (a.sickMs = (a.sickMs || 0) + dt * 1000 * HFAST) > SICK_GRACE) {
          a.dead = true; logEv(this.room, 'animal_die', { p: a.owner, type: a.type, why: 'sick' });
          this.broadcast({ t: 'msg', text: `💀 ${A.emoji} ${A.name}ของ ${a.on || 'ใครบางคน'} ป่วยตายแล้ว ครั้งหน้ารีบรักษาด้วยยา 💊 นะ` }); this.addLog(`💀 ${A.emoji} ${A.name}ของ ${a.on || '?'} ป่วยตาย`);
          this.sceneBroadcast(null, { t: 'sfx', k: 'die', id: 0, x: Math.round(a.x), y: Math.round(a.y) });
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
      if (f.st === 'wait' && now >= f.at) this.startFight(p, now); // ปลากินเบ็ด → ชักเย่อเลย ขั้นเดียว (ไม่มีเกจจับจังหวะ 7 พ.ย. 2026)
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
        msg.n = this.npcs.map(n => n.fs ? [n.id, Math.round(n.x), Math.round(n.y), n.dir, n.fs, n.fx, n.fy] : [n.id, Math.round(n.x), Math.round(n.y), n.dir]);
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
mix(World, require('./server/systems/rank.js')); // ป้ายอันดับกลางเมือง (server/systems/rank.js)
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
mix(World, require('./server/systems/arcade/party.js')); // เกมหลายคนในตู้ ป๊อกเด้ง/กดเร็ว/เป่ายิ้งฉุบ (ย้ายไป server/systems/arcade/party.js)
mix(World, require('./server/systems/arcade/duel.js')); // เกม 2 ฝ่าย XO/Connect 4 (ย้ายไป server/systems/arcade/duel.js)
mix(World, require('./server/systems/arcade/core.js')); // แกนตู้เกม โต๊ะ เดิมพัน แต้มตู้ (ย้ายไป server/systems/arcade/core.js)
mix(World, require('./server/systems/mining.js')); // ถ้ำเหมือง ก้อนแร่ ตั๋วลงเหมือง ขุดแร่ (ย้ายไป server/systems/mining.js)
mix(World, require('./server/systems/fishing.js')); // ตกปลา ทะเลลึก ชักเย่อ (ย้ายไป server/systems/fishing.js)
mix(World, require('./server/systems/house.js')); // บ้าน ตกแต่งเฟอร์นิเจอร์ ลีดเดอร์บอร์ดบ้าน (ย้ายไป server/systems/house.js)
mix(World, require('./server/systems/market.js')); // ร้านค้า ตลาดราคาไดนามิก ความอิ่มตัวหมวด (ย้ายไป server/systems/market.js)
mix(World, require('./server/systems/theme.js')); // ธีมหิมะที่ผู้ดูแลตั้ง (server/systems/theme.js)
mix(World, require('./server/systems/core.js')); // บริการกลาง ฉาก วันที่ (ย้ายไป server/systems/core.js)

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
const LAYOUT_IDS = /^(b_[a-z]+|cab[0-9]|fire|atm|board|rank|lotto)$/;
const cleanLayoutItems = raw => { const out = {}; if (raw && typeof raw === 'object') for (const [id, v] of Object.entries(raw)) { if (!LAYOUT_IDS.test(id) || !v) continue; const x = Math.trunc(+v.x), y = Math.trunc(+v.y); if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < S.W && y < S.H) out[id] = { x, y }; } return out; };
const liveLayoutItems = (Sx) => { const o = {}; for (const b of Sx.BUILDINGS) o['b_' + b.kind] = { x: b.x0, y: b.y0 }; Sx.CABINETS.forEach((c, i) => { o['cab' + i] = { x: c.x, y: c.y }; }); o.fire = { x: Sx.FIRE.x, y: Sx.FIRE.y }; o.atm = { x: Sx.ATM.x, y: Sx.ATM.y }; o.board = { x: Sx.BOARD.x, y: Sx.BOARD.y }; o.rank = { x: Sx.RANKBOARD.x, y: Sx.RANKBOARD.y }; o.lotto = { x: Sx.LUCKY.x, y: Sx.LUCKY.y }; return o; };
const LAYOUT_NAMES = { fire: 'กองไฟ', atm: 'ATM', board: 'กระดานข่าว', rank: 'ป้ายอันดับ', lotto: 'Lucky Lotto' };
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
  claim('กองไฟ', Sx.FIRE.x, Sx.FIRE.y); claim('ATM', Sx.ATM.x, Sx.ATM.y); claim('ป้ายอันดับ', Sx.RANKBOARD.x, Sx.RANKBOARD.y); claim('กระดานข่าว', Sx.BOARD.x, Sx.BOARD.y); claim('Lucky Lotto', Sx.LUCKY.x, Sx.LUCKY.y);
  for (const q of Sx.SEATS) claim('ที่นั่งลานกองไฟ', q.x, q.y);
  if (errs.length) return [...new Set(errs)];
  const now = unreachableCount(S, S.makeMap()), nw = unreachableCount(Sx, m);
  if (nw.n > now.n) errs.push(`มีช่องเดินได้ ${nw.n - now.n} ช่องที่เดินไปไม่ถึง (ร้าน/ตู้อาจล้อมช่องว่างไว้)`);
  for (const b of Sx.BUILDINGS) if (b.counter.length) { const [cx, cy] = b.counter[0]; if (!nw.walk(cx, cy + 1) || !nw.seen.has((cy + 1) * 1000 + cx)) errs.push(`เดินไปหน้าประตู ${b.name} ไม่ถึง`); }
  const adj = (nm, x, y) => { if (!Sx.DIRS.some(([dx, dy]) => nw.seen.has((y + dy) * 1000 + (x + dx)))) errs.push(nm + ' ไม่มีช่องเดินติดอยู่เลย (ใช้งานไม่ได้)'); };
  Sx.CABINETS.forEach((c, i) => adj('ตู้เกม ' + (i + 1), c.x, c.y)); adj('ATM', Sx.ATM.x, Sx.ATM.y); adj('ป้ายอันดับ', Sx.RANKBOARD.x, Sx.RANKBOARD.y); adj('กระดานข่าว', Sx.BOARD.x, Sx.BOARD.y); adj('Lucky Lotto', Sx.LUCKY.x, Sx.LUCKY.y);
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
  if (m.a === 'rooms') return reply({ snow: world.themeSnow(), rain: world.themeRain() });
  if (m.a === 'snowget') return reply({ snow: world.themeSnow(), rain: world.themeRain() });
  if (m.a === 'rainget') return reply({ snow: world.themeSnow(), rain: world.themeRain() });
  if (m.a === 'rain') { // ตั้งโหมดฝนทั้งเซิร์ฟเวอร์: m.mode = 'auto' | 'on' | 'off'
    const r = world.adminSetRain(p, m.mode, worlds.values());
    if (!r.err) console.log('ผู้ดูแลตั้งธีมฝน:', r.rain, '(โดย ' + p.name + ')');
    return reply(r.err ? { err: r.err, rain: world.themeRain() } : { rain: r.rain, snow: world.themeSnow(), ok: '🌧️ ตั้งฝนเป็น "' + ({ auto: 'อัตโนมัติ (ฤดูฝนตกเป็นรอบ)', on: 'ตกตลอด', off: 'ปิด' }[r.rain] || r.rain) + '" แล้ว' });
  }
  if (m.a === 'snow') { // ตั้งโหมดหิมะทั้งเซิร์ฟเวอร์: m.mode = 'auto' | 'on' | 'off'
    const r = world.adminSetSnow(p, m.mode, worlds.values());
    if (!r.err) console.log('ผู้ดูแลตั้งธีมหิมะ:', r.snow, '(โดย ' + p.name + ')');
    return reply(r.err ? { err: r.err, snow: world.themeSnow() } : { snow: r.snow, ok: '❄️ ตั้งหิมะเป็น "' + ({ auto: 'อัตโนมัติ (ตามฤดูหนาว)', on: 'เปิดตลอด', off: 'ปิด' }[r.snow] || r.snow) + '" แล้ว' });
  }
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
    p.rec.skills[sk] = S.xpFor(to, sk); world.dirty = true;
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
