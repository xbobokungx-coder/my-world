(() => {
'use strict';
const { QUEST_ALL, ACH, REPAIR, toolPrice, canRepair, TS, W, H, T, FARM, DAY_MS, CLOCK_MS, CANS, canTier, gaugePos, FISH_GAUGE, MAX_LV, CROPS, FISH, ANIMALS, COMPANIONS, PETCARE, RODS, BUILDINGS, SHOPS, SKILLS, DIRS,
  WEAR, WEAR_CATS, WEAR_DEFAULT, wearKey, PANTS_COLOR, MEALS, PLAYER_HUNGER, AXES, SELLBACK, sellbackValue, PLAZA, FIRE, SEATS, seatAt, isChoppable, CASINO,
  DURABILITY, durMax, repairCost, TRADE, TICKET, MOVIES, cinemaAt, CINEMA_CENTER, isTradable, tradeValue,
  GAME_TITLES, COOK, COOK_FEE, COOK_CATS, cookCat, PROJECTS, PROJ_DONATE, sellQuote, sellCat, CABINETS, BETS, makeMap, blockedAt, facing, itemInfo, shopSells, shopAt, levelOf, xpFor, inFarm, HOUSING, plotAt, plotSignAt, FURN, TOWN, BOARD, CHEST, reviveCost, QUESTS, titleFor, TITLES, POINTS, BUFFS, FAME, ATM, BANK, VILLAGE, BOTBET, DOLE, playLevel, dolePackage, doleCost, CRAFT, STARTER, STARTER_GO, START_SPAWN, STARTER_FINAL, BOOK, WEEKLY, bookInfo, SELLABLE } = Shared;
const MAP = makeMap();
const $ = id => document.getElementById(id);
const canvas = $('c'), ctx = canvas.getContext('2d'), mainCtx = ctx;
const PALETTE = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#fd79a8', '#ffffff', '#2c3e50', '#8e5b3a', '#95a5a6'];
const HATS = ['#e8c66a'].concat(PALETTE);
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

// ---------- เครื่องมือบน hotbar ----------
const SLOTS = [ // ช่อง 1 = เครื่องมือ (จอบ/บัวรดน้ำ/เบ็ด/ขวาน เลือกจากเมนู) • 2 = เมล็ด • 3 = อาหารสัตว์/ยา • 4 = มือเปล่า (ไม่มีเมนู)
  { id: 'tool', n: 'เครื่องมือ', pick: true },
  { id: 'seed', n: 'เมล็ดพันธุ์', pick: true },
  { id: 'feed', n: 'อาหารสัตว์/ยา', pick: true },
  { id: 'hand', n: 'มือเปล่า' },
];
const TOOL_LIST = ['hoe', 'water', 'rod', 'axe'], TOOL_SHORT = { hand: 'มือเปล่า', hoe: 'จอบ', water: 'บัวรดน้ำ', rod: 'เบ็ด', axe: 'ขวาน' };
const FEEDS = ['feed', 'hay', 'slop', 'nectar', 'medicine'], BAIT_KEYS = ['bait', 'bait_2', 'bait_3'];
let selBait = ls.get('mw_bait') || 'bait';
let slot = 0, selSeed = 'carrot', selFeed = 'feed';
let selTool = TOOL_LIST.includes(ls.get('mw_tool')) ? ls.get('mw_tool') : 'hoe';
const toolId = () => { const s = SLOTS[slot].id; return s === 'tool' ? selTool : s === 'hand' ? 'hand' : s === 'seed' ? 'seed_' + selSeed : selFeed; };

// ---------- state ----------
let ws, joined = false, myId = 0, me = null, roomName = '', isAdmin = false;
const roomParam = () => { try { return new URLSearchParams(location.search).get('room') || ''; } catch (e) { return ''; } };
const roomLink = name => location.origin + location.pathname + (name && name !== 'main' ? '?room=' + encodeURIComponent(name) : '');
const pets = new Map(); // สัตว์เลี้ยงประกอบฉาก (แมว/หมา) เซิร์ฟเวอร์คุมการเดิน
const players = new Map(), animals = new Map(), npcs = new Map(); // npcs = ชาวเมือง NPC (ไม่นับเป็นผู้เล่น)
let farm = {}, inv = {}, skills = { farm: 0, fish: 0, animal: 0 }, market = {}, hunger = 80;
const furn = new Map();               // เฟอร์นิเจอร์ในบ้านที่เปิดอยู่ (ฉากบ้าน): id -> { i, f, x, y, r, z, on, wl, u } พิกัดหน่วยช่อง
let townLog = [], chestSt = { coin: 0, dead: {} }, townTab = 'log';
let arcSt = { pts: 0, total: 0, wk: 0 };                               // แต้มตู้เกมของเรา
let lbSt = { total: [], wk: [], me: null }, hubTab = 'rank';           // Leaderboard + ศูนย์รวมแต้ม/รางวัล
let projSt = [];
let questSt = { list: [], total: 0, title: '', pts: { bal: 0, earned: 0 } }, fameSt = {};
let enSt = { v: 100, ex: false, rate: 0, resume: 10, rareUntil: 0, at: Date.now() }, catSt = { c: {}, recover: 0.04 }, bankSt = { bal: 0, cap: BANK.cap }, villageSt = { n: 0, goal: 0, done: false, left: 0 };
let villageEnd = 0; // เวลาที่บัฟ Happy Village หมด (ms ของนาฬิกาเครื่องนี้)
const happyOn = () => villageEnd > Date.now();
const buffExp = {}; // บัฟที่ยังมีผลอยู่: id -> เวลาหมด (ms ของนาฬิกาเครื่องนี้)
const buffOn = id => (buffExp[id] || 0) > Date.now();
const build = { on: false, sel: null, erase: false, pick: null, rot: 0 }; // sel = ชนิดที่จะวาง • erase = เก็บคืน • pick = id ของชิ้นที่เลือกไว้จะย้าย/หมุน • rot = ทิศของชิ้นที่จะวาง
let fg = null, wtr = 10, dur = {}, cin = null, cinAt = 0, cinWatching = false, tradeSt = null, tradeReq = null;
const mult = k => market[k] || 1;
let timeOffset = 0, lastSend = 0, lastSent = '', swing = 0, lastAct = 0, shopKind = null, bagTab = 'status', flash = null;
let miniState = ls.get('mw_mini') || 'small'; // small | big | off
const keys = {}, joy = { x: 0, y: 0 };
let chatFocus = false, walk = null;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
['gesturestart', 'gesturechange', 'contextmenu'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
const lvl = s => levelOf(skills[s]);
const rodLevel = () => (inv.rod_3 ? 3 : inv.rod_2 ? 2 : 1);
const axeLevel = () => (inv.axe_3 ? 3 : inv.axe_2 ? 2 : inv.axe_1 ? 1 : 0);

// ---------- login ----------
let color = ls.get('mw_color') || PALETTE[Math.floor(Math.random() * 8)];
PALETTE.forEach(c => {
  const d = document.createElement('div'); d.className = 'sw' + (c === color ? ' sel' : ''); d.style.background = c;
  d.onclick = () => { color = c; ls.set('mw_color', c); document.querySelectorAll('#swatches .sw').forEach(s => s.classList.toggle('sel', s === d)); };
  $('swatches').appendChild(d);
});
$('name').value = ls.get('mw_name') || '';
const joinGame = () => {
  const name = $('name').value.trim();
  if (!name) { $('loginErr').textContent = 'กรุณาใส่ชื่อตัวละคร'; return; }
  ls.set('mw_name', name);
  $('go').disabled = true; $('loginErr').textContent = '';
  connect(name);
};
$('go').onclick = joinGame;
$('name').addEventListener('keydown', e => { if (e.key === 'Enter') joinGame(); });

function connect(name) {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name, color, room: roomParam(), akey: $('akey').value || ls.get('mw_akey') || '' }));
  ws.onmessage = e => handle(JSON.parse(e.data));
  ws.onclose = () => {
    if (joined) $('dc').classList.remove('hidden');
    else { $('go').disabled = false; if (!$('loginErr').textContent) $('loginErr').textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'; }
  };
}
const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

// ---------- messages ----------
function mkPlayer(o) {
  return { id: o.id, held: o.held || '', status: o.status || '', title: o.title || '', name: o.name, color: o.color, hat: o.hat || '#e8c66a', pc: o.pc || PANTS_COLOR, wear: Object.assign({}, WEAR_DEFAULT, o.wear), pet: o.pet || '', pm: o.pm || 'follow', pax: o.pax || o.x, pay: o.pay || o.y, psick: !!o.psick, pname: o.pname || '', x: o.x, y: o.y, tx: o.x, ty: o.y, dir: o.dir || 0, fs: 0, fx: 0, fy: 0, anim: 0, moving: false, chat: '', chatAt: 0, voice: !!o.voice, speaking: false, lamp: !!o.lamp, sit: false, deaf: !!o.deaf };
}
function applyTrees(list) { // ซิงก์ต้นไม้ที่ตัดได้ให้ตรงกับเซิร์ฟเวอร์ (ต้นไม้ขอบแมพไม่เปลี่ยน)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isChoppable(MAP, x, y)) MAP[y][x] = T.GRASS;
  for (const [x, y] of list) if (MAP[y] && MAP[y][x] === T.GRASS) MAP[y][x] = T.TREE;
}
function handle(m) {
  switch (m.t) {
    case 'err': $('loginErr').textContent = m.text; $('go').disabled = false; if (m.need === 'akey') { $('akey').classList.remove('hidden'); $('akey').focus(); ls.set('mw_akey', ''); } break;
    case 'w':
      resetScene(); lastHeld = null; joined = true; myId = m.id; inv = m.inv; farm = m.farm; skills = Object.assign({ farm: 0, fish: 0, animal: 0, wood: 0 }, m.skills); if (m.arc) arcSt = m.arc; timeOffset = m.time - Date.now(); setHunger(m.hunger === undefined ? 80 : m.hunger);
      dur = m.dur || {}; wtr = m.wtr === undefined ? CANS[canTier(inv)].cap : m.wtr; setCin(m.cin);
      if (m.trees) applyTrees(m.trees);
      furn.clear();
      players.clear();
      m.players.forEach(p => players.set(p.id, mkPlayer(p)));
      npcs.clear(); (m.npcs || []).forEach(n => npcs.set(n.id, mkPlayer(n)));
      pets.clear(); (m.pets || []).forEach(q => pets.set(q.id, { id: q.id, kind: q.kind, v: q.v, x: q.x, y: q.y, tx: q.x, ty: q.y, dir: q.dir, dx: q.dir === 2 ? -1 : 1, anim: Math.random() * 6, moving: false }));
      me = players.get(myId); updateLampBtn(); updatePetBtn(); syncDeaf();
      $('login').classList.add('hidden');
      ['hudTop', 'hotbar', 'chat', 'mini'].forEach(i => $(i).classList.remove('hidden'));
      layoutHud(); setMini(miniState);
      if (isTouch) { $('joy').classList.remove('hidden'); $('abtn').classList.remove('hidden'); }
      roomName = m.room || 'main'; isAdmin = !!m.admin; if (isAdmin && $('akey').value) ls.set('mw_akey', $('akey').value); $('adminBtn').classList.toggle('hidden', !isAdmin);
      history.replaceState(null, '', roomLink(roomName).slice(location.origin.length)); // คงชื่อห้องไว้ใน URL เผื่อรีเฟรช
      renderHud(); updateOnline();
      players.forEach((p, id) => { if (id < myId) callPeer(id); }); // ผู้เล่นใหม่เป็นฝ่ายโทรหาคนที่อยู่ก่อน
      break;
    case 'chatlog': chatHist.length = 0; for (const e of m.list || []) chatHist.push(e); break;
    case 'ach': achSt = { cnt: m.cnt || {}, got: m.got || {}, sel: m.sel || '' }; if (achShown()) renderAch(); break;
    case 'deaf': { const p = players.get(m.id); if (p) p.deaf = !!m.on; break; }
    case 'use': { const p = players.get(m.id); if (p) p.useAt = performance.now(); break; }
    case 'held': { const p = players.get(m.id); if (p) p.held = m.e || ''; break; }
    case 'status': { const p = players.get(m.id); if (p) { p.status = m.s || ''; if (peopleShown()) renderPeople(true); } break; }
    case 'voice': { const p = players.get(m.id); if (p) { p.voice = m.on; if (!m.on) p.speaking = false; } break; }
    case 'look': { const p = players.get(m.id); if (p) { p.color = m.color; p.hat = m.hat; if (m.pc) p.pc = m.pc; if (m.wear) p.wear = Object.assign({}, WEAR_DEFAULT, m.wear); if (m.lamp !== undefined) p.lamp = !!m.lamp; if (arcOpenNow() || bagShown() || shopKind) refreshOpen(); updateLampBtn(); } break; }
    case 'pet': { const p = players.get(m.id); if (p) { p.pet = m.pet || ''; p.pm = m.mode || 'follow'; p.pax = m.ax; p.pay = m.ay; p.psick = !!m.sick; p.pname = m.name || ''; p.cp = null; if (p === me) refreshOpen(); } break; }
    case 'pst': petSt = m.pst || {}; petNames = m.names || {}; refreshOpen(); updatePetBtn(); break;
    case 'tree': { const tm = tmap(); if (tm[m.y]) { if (m.on) { if (tm[m.y][m.x] === T.GRASS) tm[m.y][m.x] = T.TREE; } else if (isChoppable(tm, m.x, m.y)) tm[m.y][m.x] = T.GRASS; } break; }
    case 'hun': setHunger(m.v); break;
    case 'rtc': onRtc(m.from, m.d); break;
    case 'pcall': onPcall(m.from, m.k); break;
    case 'p+': players.set(m.id, mkPlayer(m)); updateOnline(); if (!m.quiet) addChat('', `${m.name} เข้ามาในฟาร์ม 👋`, true); break;
    case 'p-': { const p = players.get(m.id); if (p && !m.quiet) addChat('', `${p.name} ออกไปแล้ว`, true); players.delete(m.id); closePeer(m.id); if (callWith === m.id || callPend === m.id || callIn === m.id) { if (callIn === m.id) callBox(false); if (callWith === m.id || callPend === m.id) leaveCall(); else { callIn = 0; clearTimeout(callTimer); } } updateOnline(); break; }
    case 's': {
      for (const [id, x, y, d, fs, fx, fy, sit, bt] of m.p) {
        const p = players.get(id); if (!p) continue;
        if (fs && !p.fs) p.castAt = performance.now(); // เพิ่งเหวี่ยงเบ็ด: เริ่มแอนิเมชันทุ่นลอยเป็นวงโค้ง
        if (!fs && p.fs && id === myId && fg) { fg = null; $('fgauge').classList.add('hidden'); }
        p.fs = fs; p.fx = fx; p.fy = fy; p.sit = !!sit; p.bt = bt || 1;
        if (id !== myId) { p.tx = x; p.ty = y; p.dir = d; }
      }
      for (const [id, x, y, d] of (m.n || [])) { const n = npcs.get(id); if (n) { n.tx = x; n.ty = y; n.dir = d; } }
      for (const [id, x, y, d, mv] of (m.pt || [])) { const q = pets.get(id); if (q) { q.tx = x; q.ty = y; q.dir = d; q.srvMoving = !!mv; if (d === 2) q.dx = -1; else if (d === 3) q.dx = 1; } }
      const alive = new Set();
      for (const [id, type, x, y, prod, fed, dx, hg, sick, lock, fn] of m.c) {
        alive.add(id);
        let a = animals.get(id);
        if (!a) { a = { x, y, anim: Math.random() * 6, id }; animals.set(id, a); }
        const oldH = a.h;
        a.type = type; a.tx = x; a.ty = y; a.prod = prod; a.fed = fed; a.dx = dx; a.h = hg === undefined ? 100 : hg; a.sick = !!sick; a.lock = !!lock; a.fn = fn || ''; if (oldH !== undefined && a.h > oldH + 15) a.happyAt = performance.now(); // เพิ่งได้กิน = ดีใจ
      }
      for (const id of animals.keys()) if (!alive.has(id)) animals.delete(id);
      break;
    }
    case 'tile': if (m.v) farm[m.k] = m.v; else delete farm[m.k]; break;
    case 'inv': inv = m.inv; renderHud(); refreshOpen(); updateLampBtn(); updatePetBtn(); break;
    case 'skills': skills = m.skills; refreshOpen(); break;
    case 'msg': toast(m.text); break;
    case 'mkt': Object.assign(market, m.m); refreshOpen(); break;
    case 'sfx': {
      let k = 1;
      if (!m.self && m.id !== myId && me) k = Math.max(0, 1 - Math.hypot(m.x - me.x, m.y - me.y) / TS / 14); // คนอื่นทำเสียงไกลๆ จะเบาลงตามระยะ
      if (k > 0.05) playSfx(m.k, k * (m.id === myId || m.self ? 1 : 0.7));
      break;
    }
    case 'tp': me.x = m.x; me.y = m.y; walk = null; break;
    case 'chat': { const p = players.get(m.id) || npcs.get(m.id); if (p) { p.chat = m.text; p.chatAt = performance.now() + (m.npc ? 3000 : 0); } if (!m.npc) addChat(m.name, m.text); break; } // NPC พูดเป็นฟองเหนือหัวอย่างเดียว (อยู่ 8 วินาที) ไม่เข้าแชท
    case 'shop': openShop(m.kind); break;
    case 'arcs': arcStatus = {}; for (const a of m.a) arcStatus[a[1]] = a; break;
    case 'arc': onArc(m); break;
    case 'dur': dur = m.d; refreshOpen(); break;
    case 'wtr': wtr = m.n; renderHud(); break;
    case 'fg': { // เกจตกปลา: เริ่ม/ปิด (ตัวชี้คำนวณจากเวลาที่ได้รับ ชดเชยหน่วงเล็กน้อย)
      if (m.off) fg = null; else { const c = m.c === undefined ? 0.5 : m.c; fg = { per: m.per, half: m.half, c, t0: performance.now() - 40 - (m.ph || 0), win: m.win }; $('fgzone').style.cssText = `left:${(c - m.half) * 100}%;width:${m.half * 200}%`; /* กันหน้าเว็บเก่าค้างแคช: ไม่มีแกนกลางก็สร้างให้ */ let core = $('fgcore'); if (!core) { core = document.createElement('div'); core.id = 'fgcore'; core.className = 'core'; core.style.cssText = 'position:absolute;top:0;bottom:0;background:#2fb64a'; $('fgzone').after(core); } core.style.left = (c - m.half * FISH_GAUGE.perfect) * 100 + '%'; core.style.width = m.half * FISH_GAUGE.perfect * 200 + '%'; }
      $('fgauge').classList.toggle('hidden', !fg); break;
    }
    case 'trade': onTrade(m); break;
    case 'cin': onCin(m); break;
    case 'furn': applyFurnOp(m); break;
    case 'admin': onAdmin(m); break;
    case 'kicked': { const d = $('dc').firstElementChild; if (d) d.textContent = 'คุณถูกผู้ดูแลเตะออกจากห้อง 🦶 กดเชื่อมต่อใหม่เพื่อเข้ามาอีกครั้ง'; } break;
    case 'log': if (m.list) townLog = m.list.slice(); else if (m.e) { townLog.push(m.e); if (townLog.length > TOWN.logMax) townLog.shift(); } if (townShown()) renderTown(); break;
    case 'chest': chestSt = m.c; if (townShown()) renderTown(); break;
    case 'en': enSt = Object.assign(m, { at: Date.now(), spentAt: m.spent ? Date.now() : (enSt.spentAt || 0), lastSpent: m.spent || enSt.lastSpent || 0 }); renderEnergy(); break;
    case 'cat': catSt = Object.assign(m, { at: Date.now() }); renderSat(); break;
    case 'proj': projSt = m.p; checkProjects(); if (townShown()) renderTown(); break;
    case 'quests': {
      questSt = { list: m.list, total: m.total, title: m.title, pts: m.pts, dole: m.dole, starter: m.starter, streak: m.streak, book: m.book, wk: m.wk };
      updateGuide(); updateQuestBadge(); if (questShown()) renderQuestPanel(); if (bagShown() && bagTab === 'book') renderBag();
      for (const id of Object.keys(BUFFS)) buffExp[id] = m.buffs[id] ? Date.now() + m.buffs[id] : 0;
      if (me) me.title = m.title;
      if (townShown()) renderTown(); break;
    }
    case 'bank': bankSt = m; if (townShown()) renderTown(); break;
    case 'village': villageSt = m; villageEnd = m.left ? Date.now() + m.left : 0; updateHappyChip(); if (townShown()) renderTown(); break;
    case 'fame': fameSt = m.f; if (townShown()) renderTown(); break;
    case 'title': { const p = players.get(m.id); if (p) p.title = m.title; if (achShown()) renderAch(); break; }
    case 'arcpts': arcSt = m.arc; if (hubShown()) renderHub(); break;
    case 'lb': lbSt = m; if (hubShown()) renderHub(); break;
    case 'town': openTown(m.w === 'chest' ? 'chest' : m.w === 'atm' ? 'bank' : 'log'); break;
    case 'scene': applyScene(m); break;
    case 'hboard': hboard = m; if (plotsShown()) renderPlots(); break;
  }
}

// ---------- ผู้ดูแล: สร้าง/ลบห้อง (โลกแยกกัน) + ลิงก์ ----------
let adminSt = { rooms: [], current: '', err: '' }, adminTab = 'manage';
const bugImgs = {}; // ภาพรายงานบั๊กที่โหลดแล้ว (id → data URL)
let bugView = 'open'; // หน้ารายงานบั๊ก: open = ยังไม่แก้ • fixed = แก้แล้ว
const adminShown = () => !$('admin').classList.contains('hidden');
function openAdmin() { $('admin').classList.remove('hidden'); send({ t: 'admin', a: 'rooms' }); send({ t: 'admin', a: 'users' }); send({ t: 'admin', a: 'bugs' }); renderAdmin(); }
function closeAdmin() { $('admin').classList.add('hidden'); }
function onAdmin(m) {
  adminSt = { rooms: m.rooms || [], current: m.current || '', err: m.err || '', users: m.users || (adminSt && adminSt.users) || [], bans: m.bans || (adminSt && adminSt.bans) || [], bugs: m.bugs || (adminSt && adminSt.bugs) || [] };
  if (m.bugimg) bugImgs[m.bugimg.id] = m.bugimg.uri;
  if (m.bugmark) toast(m.bugmark === 'fixed' ? '✅ ย้ายไปส่วน「แก้แล้ว」' : '↩️ เปิดรายงานใหม่ (กลับไป「ยังไม่แก้」)');
  if (m.created) { const url = roomLink(m.created); try { navigator.clipboard.writeText(url).catch(() => {}); } catch (e) { /* ไม่ได้ก็ไม่เป็นไร */ } toast('สร้างห้อง ' + m.created + ' แล้ว คัดลอกลิงก์ให้แล้ว 🔗'); }
  if (m.kicked) { toast('เตะ ' + m.kicked + ' ออกแล้ว'); setTimeout(() => send({ t: 'admin', a: 'users' }), 700); }
  if (m.banned) toast('🚫 แบน ' + m.banned + ' แล้ว (เข้าเกมไม่ได้จนกว่าจะใช้ชื่ออื่น)');
  if (m.unbanned) toast('✅ ปลดแบน ' + m.unbanned + ' แล้ว');
  if (m.removed) toast('เลิกใช้ห้อง ' + m.removed + ' แล้ว');
  if (adminShown()) renderAdmin();
}
function renderAdmin() {
  const el = $('adminBody'), esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const ago = t => { if (!t) return '-'; const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 90 ? 'เมื่อสักครู่' : s < 5400 ? Math.round(s / 60) + ' นาทีก่อน' : s < 129600 ? Math.round(s / 3600) + ' ชม.ก่อน' : Math.round(s / 86400) + ' วันก่อน'; };
  const banN = (adminSt.bans || []).length;
  const bugAll = adminSt.bugs || [], bugOpen = bugAll.filter(b => !b.fixed), bugFixed = bugAll.filter(b => b.fixed), bugN = bugOpen.length;
  let h = adminSt.err ? `<div class="banner" style="background:#fde0dc">${esc(adminSt.err)}</div>` : '';
  h += `<div class="chips" style="margin-bottom:10px"><button class="chip${adminTab === 'manage' ? ' sel' : ''}" data-atab="manage">🏠 ห้อง & ผู้เล่น</button><button class="chip${adminTab === 'blacklist' ? ' sel' : ''}" data-atab="blacklist">🚫 Blacklist${banN ? ' (' + banN + ')' : ''}</button><button class="chip${adminTab === 'bugs' ? ' sel' : ''}" data-atab="bugs">🐞 บั๊ก${bugN ? ' (' + bugN + ')' : ''}</button></div>`;
  if (adminTab === 'bugs') {
    const list = bugView === 'fixed' ? bugFixed : bugOpen;
    h += `<div class="chips" style="margin-bottom:8px"><button class="chip${bugView === 'open' ? ' sel' : ''}" data-bview="open">🔴 ยังไม่แก้ (${bugOpen.length})</button><button class="chip${bugView === 'fixed' ? ' sel' : ''}" data-bview="fixed">✅ แก้แล้ว (${bugFixed.length})</button> <button class="btn small" id="bugRefresh">🔄 รีเฟรช</button></div>`;
    h += list.length ? list.map(b => {
      return `<div class="arow bugrow"><div style="width:100%"><b>${esc(b.name || 'ไม่ระบุชื่อ')}</b> <small>ห้อง ${esc(b.room || '?')} • แจ้ง ${ago(b.time)}</small>`
        + (b.fixed ? `<br><small style="color:#1b7a2e">✅ แก้แล้ว ${ago(b.fixedAt)}${b.fixedBy ? ' โดย ' + esc(b.fixedBy) : ''}</small>` : '')
        + `<div style="white-space:pre-wrap;word-break:break-word;margin:4px 0">${esc(b.text)}</div>`
        + (bugImgs[b.id] ? `<img src="${bugImgs[b.id]}" alt="ภาพแนบ" style="max-width:100%;max-height:260px;display:block;margin:6px 0;border:2px solid var(--edge);border-radius:8px">` : '')
        + `<div style="margin-top:6px">${b.img && !bugImgs[b.id] ? `<button class="btn small" data-bugimg="${esc(b.id)}">🖼 ดูภาพ</button> ` : ''}`
        + (b.fixed ? `<button class="btn small muted" data-bugreopen="${esc(b.id)}">↩️ เปิดใหม่</button>` : `<button class="btn small" data-bugfix="${esc(b.id)}">✅ แก้แล้ว</button>`) + '</div></div></div>';
    }).join('') : `<p style="opacity:.7">${bugView === 'fixed' ? 'ยังไม่มีบั๊กที่แก้แล้ว' : 'ไม่มีบั๊กค้าง 🎉'}</p>`;
  } else if (adminTab === 'blacklist') {
    h += `<div class="arow"><input type="text" id="banName" maxlength="12" placeholder="พิมพ์ชื่อที่จะแบน (ห้อง ${esc(adminSt.current)})"><button class="btn small" id="banAdd">🚫 แบน</button></div>`;
    h += `<p style="font-size:12px;opacity:.7;margin:4px 0 8px">ชื่อที่ถูกแบนจะเข้าเกมไม่ได้จนกว่าจะใช้ชื่ออื่น (เตะออกทันทีถ้ากำลังออนไลน์) • แบนแยกตามห้อง</p>`;
    h += `<div class="sec">🚫 รายชื่อที่ถูกแบน ทั้งหมด (${banN})</div>`;
    h += banN ? (adminSt.bans || []).map(b => `<div class="arow"><span>🚫 <b>${esc(b.name)}</b> <small>ห้อง ${esc(b.room)}</small></span><span><button class="btn small" data-unban="${esc(b.name)}" data-uroom="${esc(b.room)}">✅ ปลดแบน</button></span></div>`).join('') : '<p style="opacity:.7">ยังไม่มีใครถูกแบน 🎉</p>';
  } else {
    h += '<div class="arow"><input type="text" id="newRoom" maxlength="20" placeholder="ชื่อห้อง (a-z 0-9 _ -) เว้นว่าง = สุ่มให้"><button class="btn small" id="mkRoom">➕ สร้างห้อง</button></div><div class="sec">ห้องทั้งหมด</div>';
    h += adminSt.rooms.map(r => `<div class="arow${r.name === adminSt.current ? ' cur' : ''}"><span><b>${esc(r.name)}</b>${r.main ? ' (ห้องหลัก)' : ''}${r.name === adminSt.current ? ' • คุณอยู่ที่นี่' : ''}<br><small>👥 ${r.online} คน</small></span><span>`
      + `<button class="btn small" data-copy="${esc(r.name)}">🔗 คัดลอกลิงก์</button> `
      + (r.name !== adminSt.current ? `<button class="btn small" data-go="${esc(r.name)}">↪️ ไปห้องนี้</button> ` : '')
      + (!r.main ? `<button class="btn small muted" data-rm="${esc(r.name)}">🗑️ เลิกใช้</button>` : '') + '</span></div>').join('');
    h += '<div class="sec">👥 ผู้เล่นและ IP <button class="btn small" id="ipRefresh">🔄 รีเฟรช</button></div>';
    h += (adminSt.users || []).map(u => `<div class="arow"><span>${u.online ? '🟢' : '⚪'} <b>${esc(u.name)}</b> <small>ห้อง ${esc(u.room)}</small><br><small>${u.online ? 'IP ตอนนี้: <b>' + esc(u.ip) + '</b>' : 'เข้าล่าสุด ' + ago(u.last)}</small>`
      + `<br><small style="opacity:.7">${u.ips.map(x => esc(x.ip) + ' (' + ago(x.t) + ')').join(' • ') || 'ยังไม่มีประวัติ IP'}</small></span>${!u.admin ? `<span>${u.online ? `<button class="btn small muted" data-kick="${esc(u.name)}" data-kroom="${esc(u.room)}">🦶 เตะ</button> ` : ''}<button class="btn small muted" data-ban="${esc(u.name)}" data-broom="${esc(u.room)}">🚫 แบน</button></span>` : ''}</div>`).join('') || '<p style="opacity:.7">ยังไม่มีข้อมูล</p>';
  }
  el.innerHTML = h;
  el.querySelectorAll('[data-atab]').forEach(b => b.onclick = () => { adminTab = b.dataset.atab; renderAdmin(); });
  el.querySelectorAll('[data-bugimg]').forEach(b => b.onclick = () => { b.disabled = true; send({ t: 'admin', a: 'bugimg', id: b.dataset.bugimg }); });
  el.querySelectorAll('[data-bview]').forEach(b => b.onclick = () => { bugView = b.dataset.bview; renderAdmin(); });
  el.querySelectorAll('[data-bugfix]').forEach(b => b.onclick = () => send({ t: 'admin', a: 'bugfix', id: b.dataset.bugfix }));
  el.querySelectorAll('[data-bugreopen]').forEach(b => b.onclick = () => send({ t: 'admin', a: 'bugreopen', id: b.dataset.bugreopen }));
  const bR = $('bugRefresh'); if (bR) bR.onclick = () => send({ t: 'admin', a: 'bugs' });
  el.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => ask('เตะ ' + b.dataset.kick + ' ออกจากห้อง?\n(เขาเข้ามาใหม่ได้ทันที)', () => send({ t: 'admin', a: 'kick', room: b.dataset.kroom, name: b.dataset.kick })));
  el.querySelectorAll('[data-ban]').forEach(b => b.onclick = () => ask('แบน ' + b.dataset.ban + '?\n(เข้าเกมด้วยชื่อนี้ไม่ได้อีก จนกว่าจะใช้ชื่ออื่น • เตะออกทันทีถ้าออนไลน์)', () => send({ t: 'admin', a: 'ban', room: b.dataset.broom, name: b.dataset.ban })));
  el.querySelectorAll('[data-unban]').forEach(b => b.onclick = () => send({ t: 'admin', a: 'unban', room: b.dataset.uroom, name: b.dataset.unban }));
  el.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => { const url = roomLink(b.dataset.copy); try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว 🔗'); } catch (e) { prompt('คัดลอกลิงก์นี้:', url); } });
  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { location.href = roomLink(b.dataset.go); });
  el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => ask('เลิกใช้ห้อง ' + b.dataset.rm + '?\n(ข้อมูลเซฟยังอยู่ในโฟลเดอร์ data แต่เข้าผ่านลิงก์ไม่ได้แล้ว)', () => send({ t: 'admin', a: 'remove', name: b.dataset.rm })));
  const ipR = $('ipRefresh'); if (ipR) ipR.onclick = () => send({ t: 'admin', a: 'users' });
  const mk = $('mkRoom'); if (mk) mk.onclick = () => { send({ t: 'admin', a: 'create', name: $('newRoom').value }); $('newRoom').value = ''; };
  const ba = $('banAdd'); if (ba) ba.onclick = () => { const n = ($('banName').value || '').trim(); if (n) ask('แบน ' + n + '?\n(เข้าเกมด้วยชื่อนี้ไม่ได้จนกว่าจะใช้ชื่ออื่น)', () => { send({ t: 'admin', a: 'ban', room: adminSt.current, name: n }); $('banName').value = ''; }); };
}
$('adminBtn').onclick = () => (adminShown() ? closeAdmin() : openAdmin());
$('adminClose').onclick = closeAdmin;
$('admin').addEventListener('pointerdown', e => { if (e.target === $('admin')) closeAdmin(); });

// ---------- เมือง: ข่าว + ตู้เซฟกองกลาง ----------
const townShown = () => !$('town').classList.contains('hidden');
function openTown(tab) { townTab = tab || townTab; if (townTab === 'log') send({ t: 'quest', a: 'fame' }); $('town').classList.remove('hidden'); renderTown(); }
function closeTown() { $('town').classList.add('hidden'); }
function updateHappyChip() {
  const el = $('happyChip'); if (!el) return;
  const on = happyOn(); el.classList.toggle('hidden', !on);
  if (on) el.textContent = '🎉 ' + Math.ceil((villageEnd - Date.now()) / 60000) + ' นาที';
}
setInterval(updateHappyChip, 5000);
function villageCard() {
  const v = villageSt, on = happyOn(), pct = v.goal ? Math.min(100, Math.round(v.n / v.goal * 100)) : 0;
  return `<div class="vcard${on ? ' on' : ''}"><b>🎉 Happy Village</b> — ${on ? `ติดบัฟอยู่ เหลือ ${Math.ceil((villageEnd - Date.now()) / 60000)} นาที: ตกปลาไวขึ้น 25% และหาไม้เนื้อแข็งง่ายขึ้น` : v.done ? 'วันนี้ทำครบเป้าแล้ว 🎊 (พรุ่งนี้เริ่มใหม่)' : 'ช่วยกันทำงานให้ครบเป้าของวัน ทั้งเมืองจะได้บัฟร่วม'}<div class="bar"><i style="width:${v.done ? 100 : pct}%"></i></div><small>งานของทุกคนวันนี้ ${v.n}/${v.goal} (เก็บเกี่ยว รดน้ำ ให้อาหารสัตว์ ตกปลา โค่นไม้ เก็บผลผลิต รักษาสัตว์ ลงขัน) • เป้าเพิ่มตามจำนวนคนที่ออนไลน์</small></div>`;
}
// ความอิ่มตัวของตลาดต่อหมวด: ป้ายแถบบนบอกหมวดที่ราคาตกเพราะขายซ้ำๆ และเวลาที่ราคาจะกลับมา (ไม่มีลิมิต ขายต่อได้ แค่ได้ราคาต่ำลง)
const CAT_TH = { fish: 'ปลา', crop: 'ผัก/ผลไม้', animal: 'ผลผลิตสัตว์', wood: 'ไม้', dish: 'อาหาร' };
function fmtLeft(ms) { if (ms < 60000) return `${Math.max(1, Math.ceil(ms / 1000))} วินาที`; const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที`; }
function renderSat() {
  const el = $('satChip'), now = Date.now(), min = (now - (catSt.at || now)) / 60000;
  const rows = Object.entries(catSt.c || {}).map(([k, c0]) => [k, 1 - (1 - c0) * Math.pow(1 - (catSt.recover || 0.04), min)]).filter(([, c]) => c < 0.9).sort((a, b) => a[1] - b[1]); // ฟื้นต่อเนื่องระหว่างรอข้อมูลจาก server
  if (!rows.length) { el.classList.add('hidden'); return; }
  const [k, c] = rows[0], back = Math.ceil(Math.log(0.1 / (1 - c)) / Math.log(1 - (catSt.recover || 0.04))); // นาทีที่ราคากลับถึง ~90%
  el.classList.remove('hidden'); el.classList.toggle('over', c < 0.55); el.classList.toggle('warn', c >= 0.55);
  el.textContent = `📉 ตลาด${CAT_TH[k] || 'หมวดนี้'} ${Math.round(c * 100)}%`;
  el.title = rows.map(([kk, cc]) => `${CAT_TH[kk] || kk} ได้ราคา ${Math.round(cc * 100)}%`).join(' • ') + ` — ขายของหมวดเดียวกันซ้ำๆ ราคาทั้งหมวดตกลง (สลับชนิดก็ตก) พักขาย ~${Math.max(1, back)} นาทีราคากลับมา หรือขายหมวดอื่น/ทำอย่างอื่นก่อน`;
}
$('satChip').onclick = () => toast($('satChip').title);
setInterval(renderSat, 20000);
// พลังงาน ⚡ + คูลดาวน์ปลาหายาก: ป้ายแถบบน บอกสถานะและเวลาที่เหลือ (ค่าจริงมาจาก server ทุก ~1 วินาที ระหว่างนั้นคำนวณต่อเองตามอัตราฟื้น)
function renderEnergy() {
  const el = $('enChip'), cd = $('cdChip'), now = Date.now(); el.classList.toggle('hidden', !Shared.ENERGY.on); // ระบบพลังงานปิดอยู่: ซ่อนป้าย ⚡
  const v = Math.min(Shared.ENERGY.max, enSt.v + (enSt.v < Shared.ENERGY.max ? (now - enSt.at) * enSt.rate : 0));
  const sec = Math.max(1, Math.ceil((enSt.resume - v) / (enSt.rate || 1e-9) / 1000));
  el.classList.toggle('over', enSt.ex); el.classList.toggle('warn', !enSt.ex && v < 30);
  const spent = now - (enSt.spentAt || 0) < 3000 && enSt.lastSpent ? ` (-${enSt.lastSpent})` : ''; // เพิ่งใช้พลังงานไปเท่าไร โชว์ 3 วินาที ให้เห็นว่างานแพงกินพลังงานมากกว่า
  el.textContent = enSt.ex ? `😮‍💨 เหนื่อย • พักอีก ${fmtLeft(sec * 1000)}${spent}` : `⚡ ${Math.max(0, Math.floor(v))}${spent}`;
  el.title = enSt.ex ? 'เหนื่อยจนทำงานหนักไม่ได้ (ปลูก/รดน้ำ/ขุด/เก็บเกี่ยว/ตัดไม้/ตกปลา) ไปทำอย่างอื่นก่อน เช่น ทำอาหาร เควส ลงขันเมือง หรือนั่งที่ม้านั่งฟื้นไวขึ้น 3 เท่า' : `พลังงาน ${Math.max(0, Math.floor(v))}/${Shared.ENERGY.max} งานที่ได้เงินมากกินพลังงานมากตามมูลค่า (ประมาณ ${Shared.ENERGY.coinsPerEnergy} เหรียญต่อ 1 พลังงาน) ฟื้นเองช้าๆ นั่งพักฟื้นไว กินอาหารฟื้นเพิ่มเล็กน้อย`;
  const left = (enSt.rareUntil || 0) - now; cd.classList.toggle('hidden', left <= 0);
  if (left > 0) { cd.classList.add('warn'); cd.textContent = `🐟 ปลาหายากพัก ${fmtLeft(left)}`; cd.title = 'ตกปลาหายากไปแล้ว ต้องรอก่อนถึงจะตกปลาหายากได้อีก (ปลาธรรมดาตกได้ปกติ)'; }
}
$('enChip').onclick = () => toast($('enChip').title); $('cdChip').onclick = () => toast($('cdChip').title);
setInterval(renderEnergy, 1000);
function allTotal(i, m, n) { // ขายทั้งหมด: ยอดรวมทั้งชุด (ราคาต่อชิ้นลดลงเรื่อยๆ ถึงพื้น 20%) พร้อมเปอร์เซ็นต์เฉลี่ยเทียบราคาชิ้นแรก
  const t = sellQuote(i.sell, m, n).total, first = Math.max(1, Math.round(i.sell * Math.max(Shared.MARKET.min, m)));
  return `${t} <small>(เฉลี่ย ${Math.round(t / (first * n) * 100)}%)</small>`;
}
function renderBankTab(el) {
  const coin = inv.coin || 0, room = Math.max(0, bankSt.cap - bankSt.bal);
  let h = `<div class="row"><span>💳 ยอดเงินฝาก</span><b>🪙 ${bankSt.bal} / ${bankSt.cap}</b></div><div class="bar"><i style="width:${Math.round(bankSt.bal / bankSt.cap * 100)}%"></i></div>`
    + `<p style="font-size:12px;opacity:.7;margin:6px 0 8px">ที่เก็บเหรียญปลอดภัย ไม่มีดอกเบี้ย (ฝากไว้เฉยๆ ไม่ได้เงินเพิ่ม) ออกไปทำงาน ขายของ หรือลงขันสร้างเมืองดีกว่า 😉</p>`
    + `<div class="sec">⬇️ ฝาก (เหรียญในมือ 🪙 ${coin})</div><div class="center">` + BANK.amts.map(a => `<button class="btn small" data-bank="dep:${a}" ${coin < a || room < 1 ? 'disabled' : ''}>+${a}</button>`).join(' ') + ` <button class="btn small" data-bank="dep:all" ${coin < 1 || room < 1 ? 'disabled' : ''}>ทั้งหมด</button></div>`
    + `<div class="sec">⬆️ ถอน</div><div class="center">` + BANK.amts.map(a => `<button class="btn small" data-bank="wd:${a}" ${bankSt.bal < a ? 'disabled' : ''}>-${a}</button>`).join(' ') + ` <button class="btn small" data-bank="wd:all" ${bankSt.bal < 1 ? 'disabled' : ''}>ทั้งหมด</button></div>`
    + '<p style="font-size:12px;opacity:.65;margin-top:10px">💡 ต้องยืนใกล้ตู้ ATM ที่ลานกองไฟถึงจะฝาก/ถอนได้</p>';
  el.innerHTML = h;
  el.querySelectorAll('[data-bank]').forEach(b => b.onclick = () => { const [a, amt] = b.dataset.bank.split(':'); send({ t: 'bank', a, amt: amt === 'all' ? 'all' : +amt }); });
}
function doleSection() {
  const level = playLevel(skills), done = questSt.list.filter(x => x[2]).length, tier = dolePackage(chestSt.coin, level), claimed = !!questSt.dole;
  const okQuest = done >= DOLE.needQuests;
  const meals = t => t.meals.map(id => { const i = itemInfo('meal_' + id); return i.emoji + i.name; }).join(' ');
  let h = '<div class="sec">🎁 ของแจกกองกลางประจำวัน</div><div class="tabs-note">ยิ่งเงินกองกลางเยอะ ชุดแจกยิ่งใหญ่ แต่ต้อง "เล่นจริง": ระดับการเล่นถึงเกณฑ์ และทำเควสประจำวันสำเร็จก่อน วันละ 1 ครั้ง</div>';
  h += `<div class="row"><span>⭐ ระดับการเล่นของคุณ <small>(รวมเลเวลทุกอาชีพ)</small></span><b>Lv ${level}</b></div><div class="row"><span>📋 เควสวันนี้ที่ทำสำเร็จ</span><b>${okQuest ? '✅' : '❌'} ${done}/${DOLE.needQuests}</b></div>`;
  h += DOLE.tiers.map(t => { const chestOk = chestSt.coin >= t.chest, lvOk = level >= t.lv, mine = tier === t; return `<div class="qrow${mine ? '' : ' done'}"><div>${mine ? '👉 ' : ''}🪙${t.coin} + ${meals(t)}</div><small>${chestOk ? '✅' : '🔒'} เงินกองกลาง ≥ ${t.chest} &nbsp; ${lvOk ? '✅' : '🔒'} ระดับการเล่น ≥ Lv ${t.lv}</small></div>`; }).join('');
  h += `<div class="center" style="margin-top:6px"><button class="btn small" data-claim="1" ${!tier || claimed || !okQuest ? 'disabled' : ''}>${claimed ? 'รับของแจกวันนี้แล้ว ✅' : !okQuest ? 'ทำเควสก่อนถึงจะรับได้' : tier ? '🎁 รับของแจก' : 'ยังไม่ถึงเกณฑ์'}</button></div>`;
  return h;
}
function updateQuestBadge() { // เลขบนไอคอนเควส = เควสวันนี้ที่ยังไม่เสร็จ
  const left = questSt.list.filter(x => !x[2]).length, b = $('questBadge');
  b.textContent = left; b.classList.toggle('hidden', !left);
}
$('questBtn').onclick = () => (questShown() ? closeQuest() : openQuest());
function updateGuide() {
  const el = $('guide'); if (!el) return;
  const st = questSt.starter, next = st && !st.final && STARTER.find(s => !st.done.includes(s.id));
  if (!me || !next) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden'); el.textContent = '👉 ' + next.hint + ' (' + st.done.length + '/' + STARTER.length + ')';
}
$('guide').onclick = () => openQuest('start');
function guideHTML() { // คู่มือเริ่มต้น + เข้าเกมติดต่อกัน (ส่วนบนสุดของแท็บเควส)
  let h = '';
  const st = questSt.starter, sk = questSt.streak;
  if (sk && sk.n) h += `<div class="vcard on"><b>🔥 เข้าเกมติดต่อกัน ${sk.n} วัน</b> <small>ได้เหรียญทุกวัน • ครบ 7 วันได้ของตกแต่งหายาก (ขาดวันแล้วเริ่มนับใหม่)</small></div>`;
  if (st && !st.final) h += `<div class="vcard"><b>🌱 คู่มือเริ่มต้น ${st.done.length}/${STARTER.length}</b>` + STARTER.map(s => { const d = st.done.includes(s.id); return `<div style="font-size:13px;opacity:${d ? 0.55 : 1}">${d ? '✅' : '⬜'} ${s.text} <small>+🪙${s.coin}</small></div>`; }).join('') + `<small>ครบทุกข้อรับ 🪙${STARTER_FINAL.coin} + เก้าอี้ + ต้นไม้ประดับ (ทำข้อไหนก่อนก็ได้)</small></div>`;
  return h;
}
function weeklyCard() {
  const v = villageSt, wk = questSt.wk || { mine: 0, claimed: false }, goal = v.wgoal || 0, n = v.wn || 0, pct = goal ? Math.min(100, Math.round(n / goal * 100)) : 0, enough = wk.mine >= WEEKLY.minShare;
  return `<div class="vcard"><b>🏆 เป้าหมายรายสัปดาห์ของเมือง</b> — ${v.wdone ? 'ทำครบแล้ว! 🎊' : 'ทุกคนช่วยกันสะสมงานตลอดสัปดาห์'}<div class="bar"><i style="width:${v.wdone ? 100 : pct}%"></i></div><small>${n}/${goal} • งานของคุณ ${wk.mine} (ต้องมีอย่างน้อย ${WEEKLY.minShare} ถึงรับรางวัลได้) • รางวัล 🪙${WEEKLY.coin} + ของตกแต่งหายาก</small>${v.wdone ? `<div class="center" style="margin-top:6px"><button class="btn small" data-wkclaim="1" ${wk.claimed || !enough ? 'disabled' : ''}>${wk.claimed ? 'รับแล้ว ✅' : enough ? '🎁 รับรางวัลสัปดาห์' : 'งานของคุณยังไม่พอ'}</button></div>` : ''}</div>`;
}
function fameHTML() {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), medal = ['🥇', '🥈', '🥉'];
  return Object.entries(FAME).map(([ev, [emoji, label]]) => { const top = fameSt[ev] || []; return `<div class="qrow"><b>${emoji} ${label}</b><br>` + (top.length ? top.map(([nm, c], i) => `${medal[i]} ${esc(nm)} <small>${c} ครั้ง</small>`).join(' &nbsp; ') : '<small style="opacity:.6">ยังไม่มีใครวันนี้</small>') + '</div>'; }).join('');
}
function renderBookTab(el) {
  const b = questSt.book || {};
  let h = `<div class="tabs-note">เก็บของให้ครบทุกชนิดในแต่ละหมวด: ชนิดใหม่ได้ 🪙8 และครบหมวดได้รางวัลใหญ่ + ของตกแต่งหายาก (ที่ซื้อไม่ได้)</div>`;
  for (const [cat, def] of Object.entries(BOOK)) {
    const got = b[cat] || [], full = got.length >= def.ids.length, r = FURN[def.rare];
    h += `<div class="sec">${def.emoji} ${def.name} ${got.length}/${def.ids.length} ${full ? '✅ ครบแล้ว' : `<small>ครบหมวด: 🪙${def.coin} + ${r.emoji}${r.name}</small>`}</div><div class="grid">` + def.ids.map(id => { const i = bookInfo(cat, id), has = got.includes(id); return `<div class="card" style="${has ? '' : 'opacity:.35;filter:grayscale(1)'}"><b>${has ? i.emoji : '❔'}</b>${has ? i.name : '???'}</div>`; }).join('') + '</div>';
  }
  el.innerHTML = h;
}
// ---------- 🏅 ฉายา & ความสำเร็จ (Achievement) ----------
let achSt = { cnt: {}, got: {}, sel: '' }, achTab = 'title';
const achShown = () => !$('ach').classList.contains('hidden');
function openAch(tab) { achTab = tab || achTab; $('ach').classList.remove('hidden'); send({ t: 'quest', a: 'ach' }); renderAch(); }
function closeAch() { $('ach').classList.add('hidden'); }
$('achBtn').onclick = () => (achShown() ? closeAch() : openAch());
$('achClose').onclick = closeAch;
$('ach').addEventListener('pointerdown', e => { if (e.target === $('ach')) closeAch(); });
function renderAch() {
  const el = $('achBody'), got = achSt.got || {}, cnt = achSt.cnt || {}, n = ACH.filter(a => got[a.id]).length, cur = (me && players.get(myId) && players.get(myId).title) || '';
  $('achTabs').innerHTML = [['title', '🏅 ฉายา'], ['ach', `🏆 ความสำเร็จ ${n}/${ACH.length}`]].map(([c, t]) => `<button class="tab${achTab === c ? ' on' : ''}" data-atab="${c}">${t}</button>`).join('');
  $('achTabs').querySelectorAll('[data-atab]').forEach(b => b.onclick = () => { achTab = b.dataset.atab; renderAch(); });
  const val = a => Math.min(a.goal, cnt[a.stat] || 0);
  let h = '';
  if (achTab === 'title') {
    h += `<div class="banner" style="background:#fff3cf">ฉายาที่ใช้อยู่: <b>${cur ? esc(cur) : 'ยังไม่มี'}</b> <small>(แสดงเหนือหัวตัวละคร)</small></div>`
      + `<div class="row"><span>🤖 ฉายาอัตโนมัติ (ตามจำนวนเควสสะสม)</span><span>${achSt.sel ? '<button class="btn small" data-title="">ใช้อันนี้</button>' : '<small>กำลังใช้</small>'}</span></div>`
      + '<div class="sec">📋 ฉายาจากเควส <small>(ทำเควสสะสม ' + questSt.total + ' ข้อ)</small></div>'
      + TITLES.map(([c, nm]) => `<div class="row${questSt.total >= c ? '' : ' lock'}"><span>${questSt.total >= c ? '✅' : '🔒'} <b>${esc(nm)}</b><br><small>ทำเควสสำเร็จสะสม ${c} ข้อ${questSt.total >= c ? '' : ` (อีก ${c - questSt.total})`}</small></span><span></span></div>`).join('')
      + '<div class="sec">🏆 ฉายาจากความสำเร็จ <small>(ปลดล็อกแล้วกด "ใช้" เพื่อเปลี่ยนฉายา)</small></div>'
      + ACH.filter(a => a.title).map(a => { const ok = !!got[a.id], on = achSt.sel === a.id;
        return `<div class="row${ok ? '' : ' lock'}"><span>${ok ? a.e : '🔒'} <b>${esc(a.title)}</b><br><small>${esc(a.desc)}${ok ? '' : ` • ${val(a)}/${a.goal}`}</small></span><span>${ok ? (on ? '<small>กำลังใช้</small>' : `<button class="btn small" data-title="${a.id}">ใช้</button>`) : ''}</span></div>`; }).join('');
  } else {
    h += `<div class="tabs-note">ทำกิจกรรมในเกมไปเรื่อยๆ ความสำเร็จจะปลดล็อกเอง ได้เหรียญรางวัล และบางข้อได้ฉายาใหม่</div>`;
    const list = ACH.slice().sort((a, b) => (!!got[b.id] - !!got[a.id]) || (val(b) / b.goal - val(a) / a.goal));
    h += list.map(a => { const ok = !!got[a.id], pct = Math.round(val(a) / a.goal * 100);
      return `<div class="qrow${ok ? ' done' : ''}" style="${ok ? 'border-color:#e8a33d;background:#fff4d6' : ''}"><div>${a.e} <b>${esc(a.name)}</b> ${ok ? '✅' : ''}${a.title ? ` <small>🏅 ฉายา "${esc(a.title)}"</small>` : ''}</div><small>${esc(a.desc)}</small>`
        + `${ok ? '' : `<div class="bar"><i style="width:${pct}%"></i></div><small>${val(a).toLocaleString()}/${a.goal.toLocaleString()}</small>`} <small>🎁 +🪙${a.coin}</small></div>`; }).join('');
  }
  el.innerHTML = h;
  el.querySelectorAll('[data-title]').forEach(b => b.onclick = () => send({ t: 'quest', a: 'title', id: b.dataset.title }));
}
// ---------- เมนูเควส (แยกจากกระเป๋า): เริ่มต้น / เควสวันนี้ / แต้มความดี ----------
let questTab = 'daily';
const questShown = () => !$('quest').classList.contains('hidden');
function openQuest(tab) {
  const st = questSt.starter;
  questTab = tab || (st && !st.final ? 'start' : 'daily'); // มือใหม่ที่ยังทำคู่มือไม่ครบ เปิดมาเจอหน้าเริ่มต้นก่อน
  $('quest').classList.remove('hidden'); renderQuestPanel();
}
function closeQuest() { $('quest').classList.add('hidden'); }
$('questClose').onclick = closeQuest;
$('quest').addEventListener('pointerdown', e => { if (e.target === $('quest')) closeQuest(); });
function renderQuestPanel() {
  const st = questSt.starter, showStart = !!(st && !st.final);
  const tabs = (showStart ? [['start', '🌱 เริ่มต้น']] : []).concat([['daily', '📋 เควสวันนี้'], ['pts', '💛 แต้ม/บัฟ']]);
  if (!tabs.some(t => t[0] === questTab)) questTab = 'daily';
  $('questTabs').innerHTML = tabs.map(([c, n]) => `<button class="tab${questTab === c ? ' on' : ''}" data-qtab="${c}">${n}</button>`).join('');
  $('questTabs').querySelectorAll('[data-qtab]').forEach(b => b.onclick = () => { questTab = b.dataset.qtab; renderQuestPanel(); });
  const el = $('questBody');
  if (questTab === 'start') {
    const next = STARTER.find(s => !st.done.includes(s.id));
    const steps = STARTER.map(s => {
      const d = st.done.includes(s.id), cur = next === s;
      return `<details class="vcard"${cur ? ' open' : ''} style="margin:6px 0;${d ? 'opacity:.55' : ''}"><summary style="cursor:pointer;font-weight:700">${d ? '✅' : cur ? '👉' : '⬜'} ${s.text} <small>+🪙${s.coin}</small></summary>`
        + `<ol style="margin:6px 0 2px;padding-left:20px;font-size:13px">${(s.how || []).map(x => `<li>${x}</li>`).join('')}</ol></details>`;
    }).join('');
    el.innerHTML = '<div class="tabs-note">ยินดีต้อนรับสู่ My World 🌱 ทำตามทีละข้อ ได้เหรียญทุกข้อ (ทำข้อไหนก่อนก็ได้) ลูกศรสีเหลืองในเกมจะชี้ทางให้ • กดที่ข้อเพื่อดูวิธีกดทีละขั้น</div>'
      + `<details class="vcard" ${st.done.length ? '' : 'open'}><summary style="cursor:pointer;font-weight:700">🖱️ วิธีควบคุมเบื้องต้น</summary><ul style="margin:6px 0 2px;padding-left:20px;font-size:13px">`
      + '<li><b>เดิน:</b> คลิก/แตะที่พื้น หรือกด WASD / ลูกศร (มือถือใช้จอยสติ๊กมุมซ้ายล่าง)</li>'
      + '<li><b>เลือกเครื่องมือ:</b> กดเลข 1–3 หรือแตะช่องแถบด้านล่างจอ • ช่อง 1 = เครื่องมือ (จอบ บัวรดน้ำ เบ็ด ขวาน มือเปล่า เลือกจากเมนู หรือกด Q สลับ) • ช่อง 2 = เมล็ด • ช่อง 3 = อาหารสัตว์/ยา</li>'
      + '<li><b>ใช้งาน:</b> คลิก/แตะที่ต้นพืช สัตว์ น้ำ หรือร้านค้า ตัวละครจะเดินไปทำให้เอง (หรือกด Space / ปุ่ม A ใช้กับช่องที่หันหน้าไป)</li>'
      + '<li><b>ร้านค้า:</b> คลิก/แตะที่เคาน์เตอร์ร้านใต้หลังคา แล้วเลือกซื้อ/ขายในหน้าต่างที่เปิดขึ้น</li>'
      + '<li><b>เมนูด้านบน:</b> 🎒 กระเป๋า • 📋 เควส • 🏅 ฉายา/ความสำเร็จ • 💬 แชท • 💭 สถานะ</li></ul></details>'
      + (next ? `<div class="banner" style="background:#fff3cf">👉 ข้อต่อไป: <b>${next.hint}</b></div>` : '')
      + (questSt.streak && questSt.streak.n ? `<div class="vcard on"><b>🔥 เข้าเกมติดต่อกัน ${questSt.streak.n} วัน</b> <small>ได้เหรียญทุกวัน • ครบ 7 วันได้ของตกแต่งหายาก</small></div>` : '')
      + `<div class="sec">🌱 คู่มือเริ่มต้น ${st.done.length}/${STARTER.length}</div>` + steps
      + `<small>ครบทุกข้อรับ 🪙${STARTER_FINAL.coin} + เก้าอี้ + ต้นไม้ประดับ</small>`;
  } else if (questTab === 'pts') {
    renderPtsTab(el);
  } else renderDailyTab(el);
}
function renderDailyTab(el) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const next = TITLES.find(t => t[0] > questSt.total);
  let h = '<div class="tabs-note">เควสวันนี้ทำเสร็จได้ XP + เหรียญ และเปลี่ยนใหม่ทุกวัน • ทำไปเรื่อยๆ ตามปกติ ความคืบหน้านับให้เอง</div>'
    + `<div class="row"><span>🏅 ${questSt.title ? esc(questSt.title) : 'ยังไม่มีฉายา'}</span><small>เควสสำเร็จสะสม ${questSt.total}</small></div>`
    + (next ? `<div class="tabs-note">อีก ${next[0] - questSt.total} เควสจะได้ฉายา "${next[1]}" (แสดงเหนือหัวตัวละคร)</div>` : '<div class="tabs-note">ได้ฉายาสูงสุดแล้ว 👑</div>')
    + `<div class="sec">📋 เควสวันนี้ (${questSt.list.filter(x => x[2]).length}/${questSt.list.length}) <small>ครบทุกข้อรับโบนัส 🪙${QUEST_ALL.coin}</small></div>`;
  for (const [id, n, done] of questSt.list) {
    const d = QUESTS[id]; if (!d) continue;
    h += `<div class="qrow${done ? ' done' : ''}"><div>${d.emoji || SKILLS[d.skill].emoji} ${done ? '✅ ' : ''}${d.text} <b>${Math.min(n, d.goal)}/${d.goal}</b></div><div class="bar"><i style="width:${Math.round(Math.min(n, d.goal) / d.goal * 100)}%"></i></div><small>🎁 +${d.xp} XP  +🪙${d.coin}</small></div>`;
  }
  if (!questSt.list.length) h += '<p style="opacity:.7">กำลังโหลด...</p>';
  el.innerHTML = h;
}
function renderPtsTab(el) {
  let h = `<div class="sec">💛 แต้มความดี: <b>${questSt.pts.bal}</b> <small>(วันนี้ได้ ${questSt.pts.earned}/${POINTS.dailyCap})</small></div><div class="tabs-note">ได้จากการช่วยงานที่จำเป็นจริง: ให้อาหารสัตว์ที่หิว รักษาสัตว์ป่วย รดน้ำพืชที่แห้ง ลงขันตู้เซฟ • แลกบัฟชั่วคราวได้ด้านล่าง</div>`;
  for (const [id, B] of Object.entries(BUFFS)) {
    const left = Math.max(0, (buffExp[id] || 0) - Date.now()), on = left > 0;
    h += `<div class="row"><span>${B.emoji} ${B.name}<br><small>${B.desc} • ${Math.round(B.ms / 60000)} นาที</small></span><span>${on ? `<small>เหลือ ${Math.ceil(left / 60000)} นาที</small>` : `<button class="btn small" data-buff="${id}" ${questSt.pts.bal < B.cost ? 'disabled' : ''}>แลก 💛${B.cost}</button>`}</span></div>`;
  }
  el.innerHTML = h;
  el.querySelectorAll('[data-buff]').forEach(b => b.onclick = () => send({ t: 'quest', a: 'buff', id: b.dataset.buff }));
}
function renderFameTab(el) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), medal = ['🥇', '🥈', '🥉'];
  let h = '<div class="tabs-note">อันดับของวันนี้ (นับใหม่ทุกวัน ผู้นำของเมื่อวานจะประกาศในข่าวเมือง)</div>';
  for (const [ev, [emoji, label]] of Object.entries(FAME)) {
    const top = fameSt[ev] || [];
    h += `<div class="qrow"><b>${emoji} ${label}</b><br>` + (top.length ? top.map(([nm, c], i) => `${medal[i]} ${esc(nm)} <small>${c} ครั้ง</small>`).join(' &nbsp; ') : '<small style="opacity:.6">ยังไม่มีใครวันนี้</small>') + '</div>';
  }
  el.innerHTML = h;
}
function projectSection(coin) { // โครงการพัฒนาเมือง: ลงขันเงินก้อนใหญ่ร่วมกัน ทีละโครงการตามลำดับ
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let h = '<div class="sec">🏗️ โครงการพัฒนาเมือง (ลงขันร่วมกันทั้งเมือง)</div>';
  PROJECTS.forEach((P, i) => {
    const st = projSt.find(x => x.id === P.id) || { coin: 0, open: i === 0, top: [] }, done = st.coin >= P.goal, pct = Math.min(100, Math.floor(st.coin / P.goal * 100));
    h += `<div class="qrow${done ? ' done' : ''}"><b>${P.emoji} ${P.name}</b> ${done ? '✅ สร้างเสร็จแล้ว' : st.open ? '' : '🔒 ต้องสร้างโครงการก่อนหน้าให้เสร็จก่อน'}`
      + `<div style="background:#e9d9b0;border-radius:6px;height:8px;margin:5px 0"><div style="background:#e8a33d;height:8px;border-radius:6px;width:${pct}%"></div></div>`
      + `<small>🪙 ${st.coin}/${P.goal} (${pct}%)</small>`
      + (st.top.length ? `<br><small>ผู้ร่วมสร้าง: ${st.top.map(([nm, v], k) => `${['🥇', '🥈', '🥉', '', ''][k]} ${esc(nm)} ${v}`).join(' • ')}</small>` : '')
      + (!done && st.open ? `<div class="center" style="margin-top:4px">` + PROJ_DONATE.map(a => `<button class="btn small" data-proj="${P.id}" data-amt="${a}" ${coin < a ? 'disabled' : ''}>+${a}</button>`).join(' ') + '</div>' : '') + '</div>';
  });
  return h;
}
function renderTown() {
  $('townTitle').textContent = ({ log: '📰 ข่าวเมือง', bank: '💳 ตู้ ATM', chest: '🏦 เงินกองกลาง' })[townTab] || '📰 ข่าวเมือง';
  document.querySelectorAll('[data-ttab]').forEach(t => t.classList.toggle('on', t.dataset.ttab === townTab));
  const el = $('townBody'), esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  if (townTab === 'bank') return renderBankTab(el);
  if (townTab === 'fame') return renderFameTab(el);
  if (townTab === 'log') {
    el.innerHTML = villageCard() + weeklyCard() + '<div class="sec">🏆 อันดับวันนี้</div>' + fameHTML() + '<div class="sec">📰 ข่าวล่าสุด (' + TOWN.logMax + ' ข่าว)</div>' + (townLog.length ? townLog.slice().reverse().map(([t, s]) => { const d = new Date(t); return `<div class="logrow"><time>${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</time><span>${esc(s)}</span></div>`; }).join('') : '<p style="opacity:.7">ยังไม่มีข่าว</p>');
    el.querySelectorAll('[data-wkclaim]').forEach(b => b.onclick = () => send({ t: 'quest', a: 'weekly' }));
    return;
  }
  const dead = Object.keys(ANIMALS).filter(t => chestSt.dead[t] > 0), coin = inv.coin || 0;
  el.innerHTML = `<div class="row"><span>🏦 เงินกองกลาง</span><b>🪙 ${chestSt.coin}</b></div>`
    + `<p style="font-size:12px;opacity:.7;margin:4px 0 8px">ทุกคนลงขันได้ เงินนี้จะจ่ายค่ายาและอาหารให้สัตว์ที่ป่วย/หิวจัดนานเกิน 1 นาทีโดยอัตโนมัติ และใช้ชุบชีวิตสัตว์ที่ตายได้ในราคาครึ่งหนึ่งของการซื้อใหม่ (ถอนออกเป็นเหรียญไม่ได้)</p>`
    + `<div class="sec">🪙 ลงขัน (ต้องยืนใกล้ตู้เซฟ)</div><div class="center">` + TOWN.donate.map(a => `<button class="btn small" data-donate="${a}" ${coin < a ? 'disabled' : ''}>+${a}</button>`).join(' ') + '</div>'
    + projectSection(coin)
    + doleSection()
    + `<div class="sec">✨ ชุบชีวิตสัตว์</div>` + (dead.length ? dead.map(t => { const cost = reviveCost(t); return `<div class="row"><span>${ANIMALS[t].emoji} ${ANIMALS[t].name} ที่ตายไป ×${chestSt.dead[t]}</span><span><button class="btn small" data-revive="${t}" ${chestSt.coin < cost ? 'disabled' : ''}>ชุบ 🪙${cost}</button></span></div>`; }).join('') : '<p style="opacity:.7;margin:4px 0">ตอนนี้ไม่มีสัตว์ที่ต้องชุบ 🎉</p>');
  el.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => send({ t: 'chest', a: 'claim' }));
  el.querySelectorAll('[data-donate]').forEach(b => b.onclick = () => send({ t: 'chest', a: 'donate', amt: +b.dataset.donate }));
  el.querySelectorAll('[data-revive]').forEach(b => b.onclick = () => send({ t: 'chest', a: 'revive', type: b.dataset.revive }));
  el.querySelectorAll('[data-proj]').forEach(b => b.onclick = () => send({ t: 'proj', id: b.dataset.proj, amt: +b.dataset.amt }));
}
document.querySelectorAll('[data-ttab]').forEach(t => t.onclick = () => { townTab = t.dataset.ttab; if (townTab === 'log') send({ t: 'quest', a: 'fame' }); renderTown(); });
$('townBtn').onclick = () => (townShown() ? closeTown() : openTown('log'));
$('townClose').onclick = closeTown;
$('town').addEventListener('pointerdown', e => { if (e.target === $('town')) closeTown(); });

// ---------- บ้าน / ตกแต่ง ----------
const furnKeys = () => Object.keys(inv).filter(k => k.startsWith('furn_') && FURN[k.slice(5)]);
// ---------- บ้านหลังใหญ่: แมพแยก (ฉาก) มุมมองไอโซเมตริก ตกแต่งอิสระ ----------
// ตอนอยู่ในบ้าน MAP ถูกสลับเป็นแมพบ้านชั่วคราว (ผนัง/พื้น/ประตู) เก็บแถวของแมพเมืองไว้ใน townRows ของเมืองที่มาใหม่ระหว่างนั้น (ต้นไม้/โครงการ) แก้ที่ tmap()
let scene = null, houseInfo = null, townRows = null, townDirty = false, hboard = null, houseRects = [], houseBg = null, houseGrid = null;
const tmap = () => (scene ? townRows : MAP);
const inMyHouse = () => !!scene && !!houseInfo && houseInfo.mine;
const setSceneRows = rows => { for (let y = 0; y < H; y++) MAP[y] = rows[y]; };
const furnObj = skip => { const o = {}; for (const [i, it] of furn) if (i !== skip) o[i] = it; return o; };
const rebuildRects = () => { houseRects = Shared.houseSolidRects(furnObj()); };
function applyFurnOp(m) { // ข้อความ furn จากเซิร์ฟเวอร์: set = วาง/ย้าย/หมุนชิ้นหนึ่ง • del = เก็บออก
  if (m.op === 'del') { furn.delete(m.i); if (build.pick === m.i) build.pick = null; }
  else if (m.op === 'set') furn.set(m.o.i, m.o);
  rebuildRects(); if (build.on) renderBuild();
}
function resetScene() { // กลับไปแมพเมืองฝั่งเว็บ (ตอนเซิร์ฟเวอร์ส่งฉากเมือง หรือเข้าเกมใหม่)
  if (!scene) return;
  doorLatch = true; setSceneRows(townRows); furn.clear(); houseRects = []; scene = null; houseInfo = null; townRows = null; build.on = false; build.pick = null;
  if (townDirty) { base = buildBase(); miniBase = makeMiniBase(); townDirty = false; }
}
function applyScene(m) {
  if (callWith || callPend || callIn) { if (callWith) pcSend(callWith, 'end'); if (callPend) pcSend(callPend, 'end'); if (callIn) pcSend(callIn, 'no'); leaveCall(); } // เปลี่ยนฉากแล้ววางสายอัตโนมัติ
  walk = null; fg = null; $('fgauge').classList.add('hidden'); hidePicker();
  if (m.sc) {
    if (!scene) townRows = MAP.slice();
    setSceneRows(Shared.makeHouseMap()); furn.clear();
    for (const it of m.items || []) furn.set(it.i, it);
    rebuildRects();
    scene = m.sc; houseInfo = { owner: m.owner, mine: !!m.mine }; build.on = false; build.pick = null;
    if (!houseBg) { houseBg = buildHouseIsoBg(); houseGrid = buildHouseGrid(); }
  } else resetScene();
  const old = me; players.clear();
  for (const q of m.players) { if (q.id === myId) { old.x = old.tx = m.x; old.y = old.ty = m.y; old.sit = false; old.fs = 0; players.set(myId, old); } else players.set(q.id, mkPlayer(q)); }
  me = players.get(myId); updateOnline(); updateHouseUi(); renderBuild(); closePlots();
  // เปลี่ยนฉาก: ตัดเสียงกับคนฉากเก่าแล้วโทรหาทุกคนในฉากใหม่ (ผู้เล่นเดิมจะรับสายเองผ่าน onRtc)
  [...peers.keys()].forEach(closePeer);
  players.forEach((q, id) => { if (id !== myId) callPeer(id); });
}
function updateHouseUi() {
  $('houseBtn').dataset.lbl = inMyHouse() ? 'ตกแต่ง' : 'บ้านฉัน';
  $('houseBtn').title = inMyHouse() ? 'โหมดตกแต่งบ้าน (H)' : 'เข้าบ้านตัวเอง (H)';
  $('mini').style.display = scene ? 'none' : ''; // ในบ้านไม่ใช้แผนที่ย่อ
}
const enterHouse = who => send({ t: 'house', a: 'enter', who: who || '' });
const homeAction = () => { if (inMyHouse()) toggleBuild(); else enterHouse(); }; // อยู่ในบ้านตัวเอง = เปิด/ปิดโหมดตกแต่ง • ที่อื่น = เข้าบ้านตัวเอง
function toggleBuild(on) {
  if (on === undefined) on = !build.on;
  if (on && !inMyHouse()) { enterHouse(); return; }
  build.on = on; build.erase = false; build.pick = null; build.rot = 0;
  if (on && !build.sel && furnKeys().length) build.sel = furnKeys()[0].slice(5);
  renderBuild();
}
function renderBuild() {
  const el = $('build'); el.classList.toggle('hidden', !build.on); document.body.classList.toggle('building', build.on);
  $('houseBtn').style.opacity = build.on ? 1 : .8;
  if (!build.on) return;
  const ks = furnKeys();
  if (build.sel && !(inv['furn_' + build.sel] > 0)) build.sel = (ks[0] || '').slice(5) || null;
  if (build.pick != null && !furn.has(build.pick)) build.pick = null;
  const pk = build.pick != null ? furn.get(build.pick) : null;
  const hint = build.erase ? 'แตะของในบ้านเพื่อเก็บคืนเข้ากระเป๋า'
    : build.sel ? `แตะที่พื้นเพื่อวาง ${FURN[build.sel].emoji}${FURN[build.sel].wall ? ' (ของติดผนัง: แตะที่ผนัง)' : FURN[build.sel].small ? ' (ของเล็กวางบนโต๊ะ/เตียงได้)' : ''} • 🔄 หมุน • วางได้ละเอียดทีละ ¼ ช่อง ซ้อนใกล้กันได้`
    : pk ? `เลือก ${FURN[pk.f].emoji} ${FURN[pk.f].name} แล้ว • แตะพื้น/ผนังเพื่อย้าย • 🔄 หมุน • 🧹 เก็บคืน`
    : ks.length ? 'แตะของในบ้านเพื่อเลือก แล้วแตะที่ใหม่เพื่อย้าย • หรือเลือกของจากกระเป๋าด้านล่างเพื่อวาง' : 'ยังไม่มีเฟอร์นิเจอร์ ไปซื้อที่ 🛋️ ร้านเฟอร์นิเจอร์ (ริมถนนหลัก) • แตะของในบ้านเพื่อเลือกย้ายได้';
  el.innerHTML = `<div class="bhint">🏠 โหมดตกแต่งบ้าน — ${hint}</div><div class="bitems">`
    + ks.map(k => { const f = k.slice(5); return `<button class="btn small${!build.erase && build.sel === f ? ' on' : ''}" data-bf="${f}" title="${FURN[f].name}">${FURN[f].emoji} ×${inv[k]}</button>`; }).join('')
    + `<button class="btn small${!build.erase && !build.sel ? ' on' : ''}" data-edit="1">🖐️ เลือก/ย้าย</button><button class="btn small" data-rot="1">🔄 หมุน</button>`
    + (pk ? '<button class="btn small" data-pickdel="1">🧹 เก็บชิ้นนี้</button>' : '')
    + `<button class="btn small${build.erase ? ' on' : ''}" data-erase="1">🧹 เก็บคืน</button><button class="btn small muted" data-bexit="1">✖ ออก</button></div>`;
  el.querySelectorAll('[data-bf]').forEach(b => b.onclick = () => { build.sel = b.dataset.bf; build.erase = false; build.pick = null; playSfx('click'); renderBuild(); });
  el.querySelector('[data-edit]').onclick = () => { build.sel = null; build.erase = false; playSfx('click'); renderBuild(); };
  el.querySelector('[data-rot]').onclick = rotateBuild;
  if (pk) el.querySelector('[data-pickdel]').onclick = () => { send({ t: 'house', a: 'remove', i: build.pick }); build.pick = null; };
  el.querySelector('[data-erase]').onclick = () => { build.erase = !build.erase; if (build.erase) { build.sel = null; build.pick = null; } playSfx('click'); renderBuild(); };
  el.querySelector('[data-bexit]').onclick = () => toggleBuild(false);
}
function rotateBuild() { // หมุนชิ้นที่เลือกไว้ หรือหมุนทิศของชิ้นที่กำลังจะวาง
  if (!build.on) return;
  if (build.pick != null) send({ t: 'house', a: 'rot', i: build.pick });
  else if (build.sel) { build.rot = build.rot ? 0 : 1; playSfx('click'); }
}
$('houseBtn').onclick = homeAction;
// บ้านเพื่อน: ลีดเดอร์บอร์ดเรียงตามมูลค่าเฟอร์นิเจอร์ในบ้าน (ราคาร้าน) แล้วตามจำนวนชิ้น • กดชื่อเพื่อเข้าไปเยี่ยม
const plotsShown = () => !$('plots').classList.contains('hidden');
function openPlots() { $('plots').classList.remove('hidden'); send({ t: 'house', a: 'board' }); renderPlots(); }
function closePlots() { $('plots').classList.add('hidden'); }
function renderPlots() {
  const el = $('plotsBody'), esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let h = `<p style="font-size:13px;opacity:.75;margin:0 0 8px">จัดอันดับตามมูลค่าเฟอร์นิเจอร์ในบ้าน (ตามราคาร้าน) และจำนวนชิ้นที่ตกแต่ง • กดที่ชื่อเพื่อเข้าไปเยี่ยมบ้านหลังนั้น</p>`
    + `<div class="center" style="margin:0 0 8px"><button class="btn small" data-homego="1">🏠 เข้าบ้านตัวเอง</button></div>`;
  if (!hboard) h += '<p class="center" style="opacity:.6">กำลังโหลด…</p>';
  else if (!hboard.list.length) h += '<p class="center" style="opacity:.6">ยังไม่มีใครตกแต่งบ้าน — เป็นคนแรกเลย! 🛋️</p>';
  else h += hboard.list.map((r, i) => `<div class="row"><span>${['🥇', '🥈', '🥉'][i] || '<small>' + (i + 1) + '.</small>'} <a href="#" data-visit="${esc(r.n)}" style="color:inherit;font-weight:800;text-decoration:underline">${esc(r.n)}</a>${r.me ? ' <small>(ฉัน)</small>' : ''}${r.on ? ' <small title="ออนไลน์">🟢</small>' : ''}</span><span>🪙 ${r.v.toLocaleString()} • 🛋️ ${r.c} ชิ้น</span></div>`).join('');
  el.innerHTML = h;
  el.querySelector('[data-homego]').onclick = () => { closePlots(); enterHouse(); };
  el.querySelectorAll('[data-visit]').forEach(a => a.onclick = e => { e.preventDefault(); closePlots(); enterHouse(a.dataset.visit); });
}
$('plotsClose').onclick = closePlots;
$('plots').addEventListener('pointerdown', e => { if (e.target === $('plots')) closePlots(); });
$('friendsBtn').onclick = openPlots;
// ประตูบ้านหลังใหญ่ในเมือง (HOUSE_DOOR): เดินเข้ามายืนที่ช่องนี้ (หรือแตะตัวบ้าน) แล้วเลือกเข้าบ้านตัวเอง/บ้านเพื่อน
let doorLatch = false; // ยืนอยู่บนช่องประตูแล้วถามไปแล้ว ไม่ถามซ้ำจนกว่าจะเดินออกจากช่อง
const homeChoiceShown = () => !$('homeChoice').classList.contains('hidden');
function openHomeChoice() { walk = null; setMenu(false); $('homeChoice').classList.remove('hidden'); }
function closeHomeChoice() { $('homeChoice').classList.add('hidden'); }
$('hcOwn').onclick = () => { closeHomeChoice(); enterHouse(); };
$('hcFriend').onclick = () => { closeHomeChoice(); openPlots(); };
$('hcNo').onclick = closeHomeChoice;
$('homeChoice').addEventListener('pointerdown', e => { if (e.target === $('homeChoice')) closeHomeChoice(); });
const inHouseBld = (tx, ty) => tx >= Shared.HOUSE_BLD.x0 && tx <= Shared.HOUSE_BLD.x1 && ty >= Shared.HOUSE_BLD.y0 && ty <= Shared.HOUSE_BLD.y1;

// กล่องยืนยันในเกม แทน confirm() ที่บางเบราว์เซอร์มือถือ/เว็บวิวไม่แสดง
let askYes = null;
function ask(text, yes) { $('askText').textContent = text; askYes = yes; $('ask').classList.remove('hidden'); }
$('askYes').onclick = () => { $('ask').classList.add('hidden'); const f = askYes; askYes = null; if (f) f(); };
$('askNo').onclick = () => { $('ask').classList.add('hidden'); askYes = null; };
// ปุ่มย่อ/ขยายแถบเมนูด้านบน (ย่อแล้วเหลือแค่เหรียญ ความอิ่ม และปุ่มขยาย) จำค่าไว้ในเครื่อง
// เมนูหลัก: ปุ่มที่ใช้ไม่บ่อยซ่อนในเมนู (ปุ่มเดิมทุกตัวยังอยู่ ตัวจัดการกดเดิมทำงานเหมือนเดิม)
const menuShown = () => !$('hudMenu').classList.contains('hidden');
function setMenu(on) { $('hudMenu').classList.toggle('hidden', !on); document.body.classList.toggle('menu-open', on); $('menuBtn').setAttribute('aria-expanded', on ? 'true' : 'false'); }
$('menuBtn').onclick = () => setMenu(!menuShown());
$('hudMenu').addEventListener('click', e => { const b = e.target.closest('.btn'); if (b && !['zoomInBtn', 'zoomOutBtn', 'spkBtn'].includes(b.id)) setMenu(false); }); // เลือกแล้วปิดเมนู ยกเว้นปุ่มที่กดซ้ำได้
addEventListener('pointerdown', e => { if (menuShown() && !e.target.closest('#hudMenu') && !e.target.closest('#menuBtn')) setMenu(false); });
{ // แสดงจุดแดงเควสที่ปุ่มเมนูด้วย (เควสอยู่ในเมนู จะได้ไม่พลาดเควสใหม่)
  const qb = $('questBadge'), mb = $('menuBadge');
  const sync = () => { mb.textContent = qb.textContent; mb.classList.toggle('hidden', qb.classList.contains('hidden') || !qb.textContent.trim()); };
  new MutationObserver(sync).observe(qb, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] }); sync();
}
// ---------- HUD ----------
let toastT;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400); }
function setHunger(v) {
  hunger = Math.max(0, Math.min(100, Math.round(v)));
  const el = $('hungerChip'); if (!el) return;
  el.textContent = (hunger <= 0 ? '😵 ' : hunger <= 20 ? '🍗 ' : '🍖 ') + hunger;
  el.style.color = hunger <= 5 ? '#c0392b' : hunger <= 20 ? '#c47a00' : '';
  el.classList.toggle('blink', hunger <= 5);
  el.title = 'ความอิ่ม (0 = หิวจนไม่มีแรง) กดเพื่อดูอาหารในตัวและกิน';
  if (bagShown() && bagTab === 'eat') renderBag();
  if (bagShown()) renderBag();
}
function updateOnline() { $('online').textContent = '👥 ' + players.size + (mute.all ? ' 🔇' : ''); }
const chatHist = []; // แชทผู้เล่นล่าสุด 10 ข้อความ (ไม่รวมข้อความระบบ) แสดงเป็นแผงโปร่งแสงตอนเปิดช่องแชท
function renderChatHist() {
  const el = $('chatHist'), esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  el.innerHTML = chatHist.length ? chatHist.map(e => { const d = new Date(e.t || Date.now()); return `<div class="ch"><time>${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</time><b>${esc(e.name)}</b>: ${esc(e.text)}</div>`; }).join('') : '<div class="empty">ยังไม่มีข้อความ ลองทักทายเพื่อนดูสิ 👋</div>';
  el.scrollTop = el.scrollHeight;
}
function addChat(name, text, sys) {
  if (!sys) { chatHist.push({ name, text, t: Date.now() }); if (chatHist.length > 10) chatHist.shift(); if (chatFocus) renderChatHist(); }
  const d = document.createElement('div');
  d.textContent = sys ? text : `${name}: ${text}`;
  if (sys) d.style.opacity = .8;
  $('chatLog').appendChild(d);
  while ($('chatLog').children.length > 6) $('chatLog').firstChild.remove();
  setTimeout(() => d.remove(), 12000);
}
function slotInfo(i) {
  const s = SLOTS[i];
  if (s.id === 'hand') return { e: '✋', n: 'มือเปล่า (เก็บผลผลิต เปิดร้าน นั่ง)', sub: 'เก็บ/เปิดร้าน', cnt: null };
  if (s.id === 'tool') return toolInfo(selTool);
  if (s.id === 'seed') return { e: CROPS[selSeed].emoji, n: 'เมล็ด' + CROPS[selSeed].name, cnt: inv['seed_' + selSeed] || 0 };
  if (s.id === 'feed') { const f = itemInfo(selFeed); return { e: f.emoji, n: f.name, cnt: inv[selFeed] || 0 }; }
  return { e: s.e, n: s.n, cnt: null };
}
function toolInfo(t) { // ข้อมูลเครื่องมือในช่อง 1: e = ไอคอน, n = ชื่อเต็ม, sub = บรรทัดย่อในเมนู, cnt = ตัวเลขมุมช่อง (null = ไม่แสดง)
  if (t === 'hand') return { e: '✋', n: 'มือเปล่า (เก็บผลผลิต เปิดร้าน นั่ง)', sub: 'เก็บ/เปิดร้าน', cnt: null };
  if (t === 'hoe') return { e: '⛏️', n: 'จอบ', sub: 'ขุดดิน', cnt: null };
  if (t === 'water') { const c = CANS[canTier(inv)]; return { e: c.emoji, n: `${c.name} (น้ำ ${wtr}/${c.cap} • แตะสระเพื่อตักน้ำ)`, sub: `น้ำ ${wtr}/${c.cap}`, cnt: wtr }; }
  if (t === 'rod') { const b = itemInfo(selBait); return { e: '🎣', n: RODS[rodLevel()].name + ' (' + b.name.split(' ')[0] + ' ' + (inv[selBait] || 0) + ')', sub: `เหยื่อ ×${inv[selBait] || 0}`, cnt: inv[selBait] || 0 }; }
  const ax = axeLevel(); return { e: '🪓', n: ax ? AXES[ax].name : 'ขวาน (ยังไม่มี ซื้อที่ร้านช่างไม้)', sub: ax ? AXES[ax].name : 'ยังไม่มี', cnt: ax ? null : 0 };
}
function renderHud() {
  $('coins').textContent = '🪙 ' + (inv.coin || 0);
  const hb = $('hotbar'); hb.innerHTML = '';
  SLOTS.forEach((s, i) => {
    const info = slotInfo(i), d = document.createElement('div');
    d.className = 'slot' + (i === slot ? ' sel' : '');
    d.innerHTML = `<span class="k">${i + 1}</span>${info.e}${info.cnt === null ? '' : `<span class="n">${info.cnt}</span>`}${s.pick ? '<span class="p">▾</span>' : ''}`;
    if (info.cnt === 0) d.style.opacity = .55;
    d.onpointerdown = e => { e.stopPropagation(); pickSlot(i); };
    hb.appendChild(d);
  });
}
let lastHeld = null;
function heldEmoji() { const s = SLOTS[slot]; if (!s || s.id === 'hand' || (s.id === 'tool' && selTool === 'axe' && !axeLevel())) return ''; return slotInfo(slot).e || ''; } // ช่องที่เลือกอยู่ → อีโมจิที่ถือ (ขวานที่ยังไม่มีไม่ถือ)
function pickSlot(i) {
  if (i === slot && SLOTS[i].pick) { $('picker').classList.contains('hidden') ? showPicker() : hidePicker(); return; }
  slot = i; hidePicker(); renderHud(); toast(`${slotInfo(i).e} ${slotInfo(i).n}`); playSfx('click');
  if (SLOTS[i].id === 'tool') showPicker(); // กดช่อง 1 = เมนูเลือกเครื่องมือเด้งขึ้นเลย
}
function hidePicker() { $('picker').classList.add('hidden'); }
function showPicker() {
  const s = SLOTS[slot].id, el = $('picker');
  if (s === 'tool') { // เมนูเครื่องมือ: จอบ/บัวรดน้ำ/เบ็ด/ขวาน/มือเปล่า + แถวเหยื่อตกปลา (เลือกเหยื่อ = ถือเบ็ดให้เลย)
    el.innerHTML = '';
    for (const t of TOOL_LIST) {
      const inf = toolInfo(t), locked = t === 'axe' && !axeLevel(), b = document.createElement('button');
      b.className = 'opt' + (selTool === t ? ' sel' : ''); b.disabled = locked; b.innerHTML = `<b>${inf.e}</b>${TOOL_SHORT[t]}<br>${locked ? '🔒 ยังไม่มี' : inf.sub}`;
      b.onclick = e => { e.stopPropagation(); selTool = t; ls.set('mw_tool', t); hidePicker(); renderHud(); toast(`${inf.e} ${TOOL_SHORT[t]}`); playSfx('click'); };
      el.appendChild(b);
    }
    const hd = document.createElement('div'); hd.textContent = '🎣 เหยื่อตกปลา'; hd.style.cssText = 'width:100%;flex-basis:100%;font-weight:700;font-size:12px;margin-top:4px'; el.appendChild(hd);
    for (const k of BAIT_KEYS) {
      const info = itemInfo(k), have = inv[k] || 0, locked = info.lv && lvl(info.skill) < info.lv && !have, b = document.createElement('button');
      b.className = 'opt' + (selBait === k ? ' sel' : ''); b.disabled = !!locked; b.innerHTML = `<b>${info.emoji}</b>${info.name.split(' ')[0]}<br>${locked ? '🔒 Lv' + info.lv : '×' + have}`;
      b.onclick = e => { e.stopPropagation(); selBait = k; ls.set('mw_bait', k); selTool = 'rod'; ls.set('mw_tool', 'rod'); hidePicker(); renderHud(); };
      el.appendChild(b);
    }
    el.classList.remove('hidden'); return;
  }
  let keysList = s === 'seed' ? Object.keys(CROPS).map(c => 'seed_' + c) : s === 'rod' ? BAIT_KEYS : FEEDS;
  const isLocked = k => { const i = itemInfo(k); return !!(i.lv && lvl(i.skill) < i.lv && !(inv[k] || 0)); };
  if (isTouch) keysList = keysList.filter(k => !isLocked(k)).concat(keysList.filter(isLocked)); // มือถือ: ของที่ใช้ได้ขึ้นก่อน ของที่ยังล็อกไปท้ายแผง (ลำดับเดิมในแต่ละกลุ่ม)
  el.innerHTML = '';
  keysList.forEach(k => {
    const info = itemInfo(k), have = inv[k] || 0, locked = info.lv && lvl(info.skill) < info.lv && !have;
    const b = document.createElement('button');
    b.className = 'opt' + ((s === 'seed' ? 'seed_' + selSeed : s === 'rod' ? selBait : selFeed) === k ? ' sel' : ''); b.disabled = !!locked;
    b.innerHTML = `<b>${info.emoji}</b>${s === 'seed' ? CROPS[k.slice(5)].name : info.name.split(' ')[0]}<br>${locked ? '🔒 Lv' + info.lv : '×' + have}`;
    b.onclick = e => { e.stopPropagation(); if (s === 'seed') selSeed = k.slice(5); else if (s === 'rod') { selBait = k; ls.set('mw_bait', k); } else selFeed = k; hidePicker(); renderHud(); };
    el.appendChild(b);
  });
  el.classList.remove('hidden');
}
document.addEventListener('pointerdown', e => { if (!$('picker').contains(e.target) && !$('hotbar').contains(e.target)) hidePicker(); });
function refreshOpen() { if (!$('bag').classList.contains('hidden')) renderBag(); if (shopKind) renderShop(); if (arcOpenNow()) renderArcade(); if (tradeSt && tradeShown()) renderTrade(); if (build.on) renderBuild(); if (plotsShown()) renderPlots(); }

$('invite').onclick = async () => {
  const url = roomLink(roomName);
  try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย! 🔗'); }
  catch (e) { prompt('คัดลอกลิงก์นี้ส่งให้เพื่อน:', url); }
};
$('chatBtn').onclick = () => { if (chatFocus) closeChat(); else openChat(); };
$('chatIn').addEventListener('blur', () => setTimeout(() => { if (chatFocus && !$('chatIn').value) closeChat(); }, 150));
if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
  $('fsBtn').onclick = () => {
    const d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  };
} else $('fsBtn').remove();

// ---------- กระเป๋า / อาชีพ / ตัวละคร ----------
const modalOpen = () => ['bag', 'shop', 'people', 'archub', 'status', 'quest', 'ach', 'bug', 'arcade', 'trade', 'cinema', 'town', 'admin', 'plots', 'homeChoice', 'ask'].some(id => !$(id).classList.contains('hidden'));
function openBag(tab) { if (tab) bagTab = tab; $('bag').classList.remove('hidden'); renderBag(); }
function closeBag() { $('bag').classList.add('hidden'); }
const bagShown = () => !$('bag').classList.contains('hidden');
$('bagBtn').onclick = () => (bagShown() && bagTab === 'items' ? closeBag() : openBag('items'));
$('statBtn').onclick = () => (bagShown() && bagTab === 'status' ? closeBag() : openBag('status'));
$('lookBtn').onclick = () => (bagShown() && bagTab === 'look' ? closeBag() : openBag('look'));
$('bookBtn').onclick = () => (bagShown() && bagTab === 'book' ? closeBag() : openBag('book'));
setInterval(() => { if (bagShown() && bagTab === 'status') renderBag(); }, 1000);
$('bagClose').onclick = closeBag;
$('bag').addEventListener('pointerdown', e => { if (e.target === $('bag')) closeBag(); });
document.querySelectorAll('.tab[data-tab]').forEach(t => t.onclick = () => { bagTab = t.dataset.tab; renderBag(); });
$('bagBody').addEventListener('click', e => {
  if (e.target.closest('[data-sfx]')) { sfxOn = !sfxOn; ls.set('mw_sfx', sfxOn ? '1' : '0'); renderBag(); playSfx('coin'); return; }
  const sb = e.target.closest('[data-sub]'); if (sb) { bagSub = sb.dataset.sub; renderBag(); return; }
  const eb = e.target.closest('[data-eat]'); if (eb) { send({ t: 'eat', item: eb.dataset.eat }); return; }
  const ib = e.target.closest('[data-info]'); if (ib) { const k = ib.dataset.info, i = itemInfo(k); if (i) toast(`${i.emoji} ${i.name} ×${inv[k] || 0}` + (i.sell ? ` • ราคาขาย 🪙${i.sell}` : '') + (i.food ? ` • กินได้ +${i.food} ความอิ่ม` : '')); }
});
$('hungerChip').onclick = () => openBag('eat');
// ตะเกียง/ไฟฉาย: ปุ่มบนแถบบน (หรือกด L) เปิด/ปิดแสงรอบตัว 5 ช่อง เห็นเฉพาะตอนกลางคืน (เพื่อนเห็นแสงของคุณด้วย)
function updateLampBtn() {
  const b = $('lampBtn'); if (!b) return;
  b.classList.toggle('hidden', !(inv.lamp > 0));
  const on = !!(me && me.lamp);
  b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.title = on ? 'ตะเกียง: เปิดอยู่ (กดหรือ L เพื่อปิด)' : 'ตะเกียง: ปิดอยู่ (กดหรือ L เพื่อเปิด)'; b.textContent = '🔦';
}
$('petBtn').onclick = () => { if (me) { openPetMenu(); playSfx('click'); } };
$('lampBtn').onclick = () => { if (me) { send({ t: 'lamp', on: !me.lamp }); playSfx('click'); } };

const CATS = [['furn', '🛋️ เฟอร์นิเจอร์ (วางในบ้านด้วยปุ่ม 🏠)'], ['food', '🍽️ อาหารสำเร็จรูป (กินแล้วหายหิว)'], ['seed', '🌱 เมล็ดพันธุ์'], ['crop', '🥬 พืชผล'], ['fish', '🐟 ปลาที่ตกได้'], ['animal', '🥚 ผลผลิตจากสัตว์'], ['feed', '🌾 อาหารสัตว์ / ยา'], ['tool', '🪱 เหยื่อตกปลา'], ['wood', '🪵 ไม้'], ['gear', '🎒 อุปกรณ์ที่ซื้อ']];
// แท็บย่อยในกระเป๋า: ชื่อ, ป้าย, หมวดของที่รวมอยู่ (เหยื่อตกปลาอยู่กับปลา)
const BAG_SUBS = [['furn', '🛋️ เฟอร์นิเจอร์', ['furn']], ['crop', '🥬 ผัก-ผลไม้', ['crop']], ['fish', '🐟 ปลา', ['fish', 'tool']], ['wood', '🪵 ไม้', ['wood']], ['gear', '🧰 อุปกรณ์', ['gear']], ['other', '🗂️ อื่นๆ', ['seed', 'animal', 'feed']]]; // อาหารไม่อยู่ในกระเป๋า กินได้จากไอคอนความหิว
let bagSub = 'furn';
function renderBag() {
  document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.toggle('on', t.dataset.tab === bagTab));
  const el = $('bagBody');
  if (bagTab === 'book') return renderBookTab(el);
  if (bagTab === 'status') {
    const keysOwned = Object.keys(inv).filter(k => k !== 'coin');
    const worth = keysOwned.reduce((s, k) => { const i = itemInfo(k); return s + (i && i.sell ? sellQuote(i.sell, mult(k), inv[k]).total : 0); }, 0);
    const pieces = keysOwned.reduce((s, k) => s + inv[k], 0);
    const [tx, ty] = myTile();
    const cards = [
      ['🪙 เหรียญ', inv.coin || 0], ['💰 ของที่ขายได้ (รวม)', '🪙 ' + worth], ['📦 ของในกระเป๋า', pieces + ' ชิ้น'], ['🎣 คันเบ็ด', RODS[rodLevel()].name], [CANS[canTier(inv)].emoji + ' บัวรดน้ำ', `${CANS[canTier(inv)].name} (${wtr}/${CANS[canTier(inv)].cap})`],
      ['📍 ตำแหน่ง', `${tx}, ${ty}`], ['🕒 เวลาในเกม', $('clock').textContent.replace(/^\S+\s/, '')],
      ['👥 ออนไลน์', players.size + ' คน'], ['🎙️ ไมค์', micOn ? 'เปิดอยู่' : 'ปิดอยู่'],
      ['🐔 ไก่ในฟาร์ม', animalCount('chicken') + ' ตัว'], ['🐄 วัวในฟาร์ม', animalCount('cow') + ' ตัว'], ['🐖 หมูในฟาร์ม', animalCount('pig') + ' ตัว'],
      ['🪱 เหยื่อตกปลา', BAIT_KEYS.map(k => itemInfo(k).emoji + (inv[k] || 0)).join(' ')], ['⭐ ระดับการเล่น', 'Lv ' + playLevel(skills)],
    ];
    const hl = hunger <= 0 ? 'หิวจนไม่มีแรง!' : hunger <= 20 ? 'หิวมาก' : hunger <= 50 ? 'เริ่มหิว' : 'อิ่มดี';
    el.innerHTML = `<div class="row"><b style="font-size:17px">👤 ${me.name.replace(/</g, '&lt;')}</b><span><span class="sw" style="display:inline-block;width:18px;height:18px;vertical-align:middle;background:${me.color}"></span> <span class="sw" style="display:inline-block;width:18px;height:18px;vertical-align:middle;background:${me.hat}"></span></span></div>`
      + `<div class="sec">🍖 ความอิ่ม — ${hl} (${hunger}/100)</div><div class="hbar"><i style="width:${hunger}%;${hunger <= 20 ? 'background:#e74c3c' : ''}"></i></div><small style="opacity:.7;font-size:12px">ลดลงเรื่อยๆ ขณะออนไลน์ • ต่ำกว่า 15 เดินช้าลง • ถึง 0 ใช้เครื่องมือไม่ได้ • กินอาหารที่ร้านอาหารหรือกินผลผลิตของตัวเองได้</small>`
      + `<div class="stat">${cards.map(c => `<div>${c[0]}<b>${c[1]}</b></div>`).join('')}</div>`
      + `<button class="btn small" data-sfx="1" style="margin:4px 0 6px">${sfxOn ? '🔊 เอฟเฟกต์เสียง: เปิด' : '🔇 เอฟเฟกต์เสียง: ปิด'}</button><div class="sec">เลเวลอาชีพ</div>`
      + Object.keys(SKILLS).map(k => {
        const L = lvl(k), xp = skills[k] || 0, base = xpFor(L), need = L >= MAX_LV ? 0 : xpFor(L + 1) - base;
        return `<div class="skill"><b>${SKILLS[k].emoji} ${SKILLS[k].name}</b> — เลเวล ${L}${L >= MAX_LV ? ' (สูงสุด)' : ''} <small style="display:inline">XP ${xp}</small><div class="bar"><i style="width:${need ? Math.min(100, Math.round((xp - base) / need * 100)) : 100}%"></i></div></div>`;
      }).join('');
  } else if (bagTab === 'eat') { // กดไอคอนความหิว: แสดงอาหารที่มีในตัวให้กินได้ ถ้าไม่มีก็แสดงเมนูว่าง ๆ
    const ks = Object.keys(inv).filter(k => { const i = itemInfo(k); return i && i.food && inv[k] > 0; });
    let h = `<div class="sec">🍖 ความอิ่ม — ${hunger}/100</div><div class="hbar"><i style="width:${hunger}%;${hunger <= 20 ? 'background:#e74c3c' : ''}"></i></div>`;
    if (!ks.length) h += `<div class="sec">🍽️ เมนูอาหาร</div><p style="opacity:.75">ไม่มีอาหารในตัวเลย ไปซื้ออาหารที่ร้านอาหาร หรือเก็บผลผลิตของตัวเองมากิน</p>`;
    else h += `<div class="sec">🍽️ อาหารในตัว (กดกินได้เลย)</div><div class="grid">` + ks.map(k => { const i = itemInfo(k); return `<div class="card"><b>${i.emoji}</b>${i.name}<br>×${inv[k]}<br><button class="btn small" data-eat="${k}" style="margin-top:4px;padding:3px 8px;font-size:12px" ${hunger >= 99 ? 'disabled' : ''}>🍴 กิน +${i.food}</button></div>`; }).join('') + '</div>';
    el.innerHTML = h;
  } else if (bagTab === 'items') {
    const sub = BAG_SUBS.find(x => x[0] === bagSub) || BAG_SUBS[0];
    let h = `<div class="row"><span>🪙 เหรียญ</span><b>${inv.coin || 0}</b></div>`;
    h += `<div class="tabs">` + BAG_SUBS.map(([id, t]) => `<button class="tab${id === sub[0] ? ' on' : ''}" data-sub="${id}">${t}</button>`).join('') + '</div>';
    const ks = Object.keys(inv).filter(k => { const i = itemInfo(k); return i && sub[2].includes(i.cat) && inv[k] > 0; });
    h += ks.length ? `<div class="grid mini">` + ks.map(k => { const i = itemInfo(k); return `<div class="card mini" data-info="${k}" title="${i.name} ×${inv[k]}"><b>${i.emoji}</b><span class="nm">${i.name}</span><span class="cnt">${inv[k]}</span></div>`; }).join('') + '</div>' : '<p style="opacity:.7">หมวดนี้ยังไม่มีของ</p>';
    if (sub[0] === 'gear') { // อุปกรณ์ความทนทาน (ซ่อมได้) อยู่ในแท็บอุปกรณ์
      h += `<div class="sec">🎣 อุปกรณ์ (ความทนทาน)</div><div class="grid">` + Object.keys(DURABILITY).filter(t => t !== 'axe' || axeLevel() > 0).map(t => {
        const D = DURABILITY[t], tier = t === 'rod' ? rodLevel() : t === 'axe' ? axeLevel() : 1, fx = dur[t] ? dur[t][2] || 0 : 0, mx = durMax(t, tier, fx), cur = dur[t] ? dur[t][0] : mx, pct = Math.round(cur / mx * 100);
        const nm = t === 'rod' ? RODS[tier].name : t === 'axe' ? AXES[tier].name : D.name;
        return `<div class="card"><b>${{ hoe: '⛏️', water: '🫗', rod: '🎣', axe: '🪓' }[t]}</b>${nm}<br>${cur}/${mx}<br><small style="opacity:.7">ซ่อมแล้ว ${fx}/${REPAIR.maxFixes}${fx >= REPAIR.maxFixes ? ' (ซ่อมไม่ได้แล้ว)' : ''}</small><div class="hbar" style="height:6px"><i style="width:${pct}%;${pct <= 20 ? 'background:#e74c3c' : ''}"></i></div></div>`;
      }).join('') + `</div><p style="font-size:12px;opacity:.65">ซ่อมได้ที่ร้านของสายนั้น ซ่อมแต่ละครั้งความทนทานสูงสุดลด ${Math.round(REPAIR.decay * 100)}% และค่าซ่อมแพงขึ้น ซ่อมได้สูงสุด ${REPAIR.maxFixes} ครั้งแล้วต้องซื้อใหม่</p>`;
    }
    if (!Object.keys(inv).some(k => k !== 'coin' && inv[k] > 0)) h += '<p style="opacity:.7">ยังไม่มีของ ลองปลูกผัก ตกปลา หรือเลี้ยงสัตว์ดูนะ</p>';
    el.innerHTML = h;
  } else if (bagTab === 'skills') {
    const nextCrop = () => Object.values(CROPS).filter(c => c.lv > lvl('farm')).sort((a, b) => a.lv - b.lv)[0];
    const nextFish = () => FISH.filter(f => f.lv > lvl('fish')).sort((a, b) => a.lv - b.lv)[0];
    const hints = {
      farm: () => { const c = nextCrop(); return (c ? `ถัดไป: ปลดล็อก ${c.emoji} ${c.name} ที่ Lv${c.lv}` : 'ปลดล็อกเมล็ดครบแล้ว') + ' • พืชโตเร็วขึ้น 4% ต่อเลเวล'; },
      fish: () => { const f = nextFish(); return (f ? `ถัดไป: ตกได้ ${f.emoji} ${f.name} ที่ Lv${f.lv}` : 'ตกปลาได้ครบทุกชนิดแล้ว') + ' • คันเบ็ดดีขึ้นซื้อที่ร้านตกปลา (Lv3, Lv6)'; },
      animal: () => `ซื้อวัวได้ที่ Lv${ANIMALS.cow.lv} • ซื้อหมูได้ที่ Lv${ANIMALS.pig.lv} • ซื้อผึ้งได้ที่ Lv${ANIMALS.bee.lv} (น้ำผึ้งจากรัง 🍯) • แต่ละชนิดมีเล้าของตัวเอง เล้าละ ${ANIMALS.cow.cap} ตัว • ผลผลิตออกเร็วขึ้น 5% ต่อเลเวล • สัตว์ป่วยรักษาด้วยยา 💊`,
      wood: () => `ขวานเหล็กซื้อได้ที่ Lv${AXES[2].lv} • ขวานเหล็กกล้า Lv${AXES[3].lv} • เลเวลสูงขึ้นได้ไม้เพิ่มและเจอไม้เนื้อแข็งบ่อยขึ้น • (งานช่างไม้อื่นๆ จะมาเร็วๆ นี้)`,
    };
    el.innerHTML = Object.keys(SKILLS).map(k => {
      const L = lvl(k), xp = skills[k] || 0, base = xpFor(L), need = L >= MAX_LV ? 0 : xpFor(L + 1) - base;
      const pct = need ? Math.min(100, Math.round((xp - base) / need * 100)) : 100;
      return `<div class="skill"><b>${SKILLS[k].emoji} ${SKILLS[k].name}</b> — เลเวล ${L}${L >= MAX_LV ? ' (สูงสุด)' : ''}
        <div class="bar"><i style="width:${pct}%"></i></div>
        <small>${need ? `XP ${xp - base} / ${need}` : 'XP เต็มแล้ว'}</small><small>${hints[k]()}</small></div>`;
    }).join('');
  } else {
    // ตู้เสื้อผ้า: สวมเสื้อ/กางเกง/หมวกที่ซื้อไว้ + เลือกสีของแต่ละชิ้น (ฟรี)
    const sw = (list, cur, kind) => `<div class="swrow">` + list.map(c => `<div class="sw${c === cur ? ' sel' : ''}" data-${kind}="${c}" style="background:${c}"></div>`).join('') + `<input type="color" data-${kind}-custom value="${cur}"></div>`;
    const have = (cat, it) => it.price === 0 || !!inv[wearKey(cat, it.id)];
    let h = '<canvas id="preview" width="150" height="150"></canvas>';
    for (const cat of Object.keys(WEAR)) {
      h += `<div class="sec">${WEAR_CATS[cat].emoji} ${WEAR_CATS[cat].name}</div><div class="wrow">` + WEAR[cat].map(it => {
        const own = have(cat, it), on = me.wear[cat] === it.id;
        return `<button class="witem${on ? ' on' : ''}${own ? '' : ' lockw'}" data-wear="${cat}:${it.id}" ${own ? '' : 'disabled'}><b>${it.name}</b>${on ? '✅ สวมอยู่' : own ? 'กดเพื่อสวม' : '🔒 ' + it.price + ' 🪙'}</button>`;
      }).join('') + '</div>';
    }
    h += `<div class="sec">สีเสื้อ</div>${sw(PALETTE, me.color, 'shirt')}<div class="sec">สีกางเกง</div>${sw(PALETTE.concat(['#5b4a8a']), me.pc, 'pants')}<div class="sec">สีหมวก / ของเสริม</div>${sw(HATS, me.hat, 'hat')}`
      + `<p style="font-size:13px;opacity:.7">ซื้อเสื้อผ้าเพิ่มได้ที่ 👕 ร้านเสื้อผ้า (ลานกลางเมือง ทางใต้ถนนหลักฝั่งซ้าย) เพื่อนๆ จะเห็นชุดที่คุณสวมทันที</p>`;
    el.innerHTML = h;
    const pv = $('preview').getContext('2d'); pv.clearRect(0, 0, 150, 150); pv.save(); pv.translate(75, 105); pv.scale(4, 4);
    drawPlayer({ x: 0, y: 0, dir: 0, moving: false, anim: 0, color: me.color, hat: me.hat, pc: me.pc, wear: me.wear, name: '' }, 0, pv); pv.restore();
    const apply = (o) => { Object.assign(me, o.me || {}); if (o.wear) Object.assign(me.wear, o.wear); send({ t: 'look', color: me.color, hat: me.hat, pc: me.pc, wear: me.wear }); ls.set('mw_color', me.color); renderBag(); };
    el.querySelectorAll('[data-wear]').forEach(d => d.onclick = () => { const [cat, id] = d.dataset.wear.split(':'); apply({ wear: { [cat]: id } }); playSfx('click'); });
    el.querySelectorAll('[data-shirt]').forEach(d => d.onclick = () => apply({ me: { color: d.dataset.shirt } }));
    el.querySelectorAll('[data-pants]').forEach(d => d.onclick = () => apply({ me: { pc: d.dataset.pants } }));
    el.querySelectorAll('[data-hat]').forEach(d => d.onclick = () => apply({ me: { hat: d.dataset.hat } }));
    el.querySelector('[data-shirt-custom]').onchange = e => apply({ me: { color: e.target.value } });
    el.querySelector('[data-pants-custom]').onchange = e => apply({ me: { pc: e.target.value } });
    el.querySelector('[data-hat-custom]').onchange = e => apply({ me: { hat: e.target.value } });
  }
}

// ---------- ร้านค้า ----------
function openShop(kind) { shopKind = kind; farmTab = SHOP_TABS[kind] ? SHOP_TABS[kind][0][0] : 'gear'; if (kind === 'cloth') { tryWear = Object.assign({}, me.wear); clothTab = 'shirt'; } $('shop').classList.remove('hidden'); renderShop(); }
function closeShop() { shopKind = null; $('shop').classList.add('hidden'); }
$('shopClose').onclick = closeShop;
$('shop').addEventListener('pointerdown', e => { if (e.target === $('shop')) closeShop(); });
const animalCount = type => { let n = 0; animals.forEach(a => { if (a.type === type) n++; }); return n; };
let farmTab = 'gear';
// ทุกร้านที่รับซื้อมีแท็บ 💰 ขาย ไว้ท้ายสุด (แท็บซื้อของร้านที่ไม่มีแท็บเดิม)
const SHOP_TABS = { farm: [['gear', '🧰 อุปกรณ์'], ['seed', '🌱 เมล็ดพันธุ์'], ['sell', '💰 ขายผลผลิต']], fish: [['gear', '🎣 อุปกรณ์ตกปลา'], ['sell', '🐟 ขายปลา']],
  food: [['buy', '🍜 ซื้ออาหาร'], ['cook', '👨‍🍳 ทำอาหาร'], ['sell', '💰 ขาย']], animal: [['feed', '🌾 อาหาร / ยา'], ['pets', '🐾 สัตว์เลี้ยง'], ['sell', '💰 ขาย']],
  wood: [['buy', '🛒 ซื้อ'], ['sell', '💰 ขาย']], furn: [['buy', '🛒 ซื้อ'], ['sell', '💰 ขาย']] };
// เมนูปลาใหม่ขายได้เฉพาะแท็บ 💰 ขาย ของร้านอาหาร (ไม่ขายใต้เมนูทำอาหารเดิม)
const FISH_DISH_SELL_TAB = new Set(['dish_fishsoup', 'dish_sashimi', 'dish_fishburger', 'dish_fishpie']);
const seedProfit = k => { const c = CROPS[k.slice(5)]; return (c.sell - c.seed) / (c.time / 60000); };
let petNames = {}, petSt = {}; // สถานะสัตว์เลี้ยงของเรา: { dog: { h: ความอิ่ม, sick } }
function petPanelHtml() { // เมนูสัตว์เลี้ยง: พาออกมา/เดินตาม/ปล่อยเล่น/เก็บ + ให้อาหาร + รักษา (ใช้ทั้งในร้านและเมนู 🐾)
  const own = Object.keys(COMPANIONS).filter(c => inv['pet_' + c] > 0), cur = me.pet || '', mode = me.pm || 'follow';
  let h = '<div class="sec">🐾 สัตว์เลี้ยงของคุณ</div>';
  if (!own.length) return h + '<p style="opacity:.7;margin:6px 0">ยังไม่มีสัตว์เลี้ยง ซื้อได้ที่ร้านสัตว์เลี้ยง (36,10) 🐶🐱🐦</p>';
  for (const c of own) {
    const C = COMPANIONS[c], st = petSt[c] || { h: 100, sick: false }, out = cur === c, hp = Math.round(st.h);
    h += `<div class="row"><span>${C.emoji} ${petNames[c] ? esc(petNames[c]) + ' <small>(' + C.name + ')</small>' : C.name}${st.sick ? ' 🤒 <small style="color:#c0392b">ป่วย</small>' : ''}<br><small>${out ? (mode === 'play' ? '🎾 กำลังวิ่งเล่น' : '🚶 เดินตามคุณ') : '🏠 อยู่บ้าน'} • อิ่ม ${hp}/100${out ? '' : ' (ไม่หิวตอนอยู่บ้าน)'}</small><div class="hbar" style="width:120px;height:7px"><i style="width:${hp}%;${hp <= 25 ? 'background:#e74c3c' : ''}"></i></div></span><span>`
      + (out ? `<button class="btn small${mode === 'follow' ? ' muted' : ''}" data-petmode="follow" data-pet="${c}">🚶 เดินตาม</button> <button class="btn small${mode === 'play' ? ' muted' : ''}" data-petmode="play" data-pet="${c}">🎾 ปล่อยเล่น</button> <button class="btn small muted" data-petmode="store" data-pet="">🏠 เก็บ</button>`
        : `<button class="btn small" data-petmode="follow" data-pet="${c}">🐾 พาออกมา</button>`)
      + ` <button class="btn small muted" data-petname="${c}">✏️ ตั้งชื่อ</button></span></div>`;
  }
  const ci = cur ? petSt[cur] || { h: 100, sick: false } : null;
  h += '<div class="sec">🦴 ดูแลสัตว์เลี้ยง</div>'
    + `<div class="row"><span>🦴 ให้อาหาร<br><small>มีอาหาร ${inv.petfood || 0} ชิ้น • +${PETCARE.food} อิ่ม • ซื้อที่ร้านสัตว์เลี้ยง</small></span><span><button class="btn small" data-petcare="feed" ${cur && inv.petfood > 0 && ci.h < 95 ? '' : 'disabled'}>ให้อาหาร</button></span></div>`
    + `<div class="row"><span>💊 รักษาสัตว์ป่วย<br><small>มียา ${inv.medicine || 0} ขวด • สัตว์หิวจัดจะป่วย (เดินช้า เศร้า)</small></span><span><button class="btn small" data-petcare="heal" ${cur && ci.sick && inv.medicine > 0 ? '' : 'disabled'}>รักษา</button></span></div>`
    + '<p style="font-size:12px;opacity:.65;margin:8px 0 0">💡 ต้องพาสัตว์ออกมาก่อนถึงจะให้อาหาร/รักษาได้ • ปล่อยเล่นแล้วสัตว์จะซนอยู่รอบจุดที่ปล่อย • เดินตาม: ห่างเกิน 2 ช่องจะวิ่งมาหา ยืนเฉยๆ จะเดินไปมาใกล้ตัว</p>';
  return h;
}
function bindPet(body) {
  body.querySelectorAll('[data-petname]').forEach(b => b.onclick = () => { const c = b.dataset.petname, n = prompt(`ตั้งชื่อ${COMPANIONS[c].emoji} ${COMPANIONS[c].name} (ไม่เกิน 12 ตัวอักษร เว้นว่าง = ล้างชื่อ)`, petNames[c] || ''); if (n !== null) send({ t: 'petname', pet: c, name: n }); });
  body.querySelectorAll('[data-petmode]').forEach(b => b.onclick = () => send({ t: 'pet', pet: b.dataset.pet, mode: b.dataset.petmode }));
  body.querySelectorAll('[data-petcare]').forEach(b => b.onclick = () => send({ t: 'petcare', a: b.dataset.petcare }));
}
function openPetMenu() { shopKind = 'petmenu'; $('shop').classList.remove('hidden'); renderShop(); }
function updatePetBtn() { const b = $('petBtn'); if (b) b.classList.toggle('hidden', !Object.keys(COMPANIONS).some(c => inv['pet_' + c] > 0)); }
function renderShop() {
  if (shopKind === 'petmenu') { $('shopTitle').textContent = '🐾 สัตว์เลี้ยง'; $('shopInfo').textContent = '🪙 ' + (inv.coin || 0); $('shopBody').innerHTML = petPanelHtml(); bindPet($('shopBody')); updatePetBtn(); return; }
  const sh = SHOPS[shopKind]; if (!sh) return;
  $('shopTitle').textContent = sh.name;
  $('shopInfo').textContent = (sh.skill ? `${SKILLS[sh.skill].emoji} ${SKILLS[sh.skill].name} เลเวล ${lvl(sh.skill)} • ` : '') + `🪙 ${inv.coin || 0}` + (shopKind === 'food' ? ` • 🍖 ความอิ่ม ${hunger}/100` : '');
  if (shopKind === 'cloth') return renderCloth();
  if (sh.soon) { // ร้านยานพาหนะ: เตรียมไว้ก่อน ยังไม่เปิดขาย
    $('shopBody').innerHTML = '<div class="banner" style="background:#e9e0ff">🚧 เร็วๆ นี้! ร้านกำลังเตรียมของ</div><div class="sec">สินค้าที่จะมาในอนาคต</div>'
      + sh.soon.map(s => `<div class="row lock"><span>${s.emoji} ${s.name}<br><small>ราคาประมาณ 🪙${s.price}</small></span><span><button class="btn small" disabled>ยังไม่เปิดขาย</button></span></div>`).join('')
      + '<p style="font-size:12px;opacity:.65">เมื่อเปิดขายแล้วจะใช้เดินทางได้เร็วขึ้น</p>';
    return;
  }
  const isFarm = shopKind === 'farm', seedTab = isFarm && farmTab === 'seed', tabs = SHOP_TABS[shopKind], sellTab = !!tabs && farmTab === 'sell', cookTab = shopKind === 'food' && farmTab === 'cook', petTab = shopKind === 'animal' && farmTab === 'pets';
  let h = tabs ? `<div class="tabs">${tabs.map(([c, n]) => `<button class="tab${farmTab === c ? ' on' : ''}" data-ftab="${c}">${n}</button>`).join('')}</div>` : '';
  h += sellTab || cookTab ? '' : seedTab ? '<div class="sec">เมล็ดพันธุ์ (เรียงจากกำไรต่อนาทีดีที่สุด → แย่ที่สุด)</div>' : '<div class="sec">' + (petTab ? 'ซื้อสัตว์เลี้ยง' : 'ซื้อ') + '</div>';
  let keys = sellTab || cookTab ? [] : isFarm ? sh.buy.filter(k => k.startsWith('seed_') === seedTab) : shopKind === 'animal' ? sh.buy.filter(k => !!itemInfo(k).animal === petTab) : sh.buy;
  if (seedTab) keys = keys.slice().sort((a, b) => seedProfit(b) - seedProfit(a));
  for (const k of keys) {
    const i = itemInfo(k), locked = i.lv && lvl(i.skill) < i.lv, coin = inv.coin || 0;
    let sub = '';
    if (i.animal) sub = `มี ${animalCount(i.animal)}/${ANIMALS[i.animal].cap} ตัว`;
    else if (i.once) sub = inv[k] ? 'มีแล้ว ✅' : '';
    else sub = `มี ${inv[k] || 0}${i.food ? ` • อิ่ม +${i.food}` : ''}`;
    if (seedTab) { const c = CROPS[k.slice(5)], pr = seedProfit(k), ix = keys.indexOf(k); sub += ` • กำไร ${c.sell - c.seed}/ต้น (${pr.toFixed(1)}/นาที) ${ix < 3 ? '⭐ ดี' : ix >= keys.length - 3 ? '▼ ต่ำ' : ''}`; }
    const lockTxt = locked ? ` <small>🔒 Lv${i.lv}</small>` : '';
    const off = locked || (i.once && inv[k]) || (i.animal && animalCount(i.animal) >= ANIMALS[i.animal].cap);
    h += `<div class="row${locked ? ' lock' : ''}"><span>${i.emoji} ${i.name}${lockTxt}<br><small>${sub}</small></span><span>🪙${i.buy} `
      + `<button class="btn small" data-buy="${k}" data-n="1" ${off || coin < i.buy ? 'disabled' : ''}>ซื้อ</button>`
      + (i.once || i.animal ? '' : ` <button class="btn small" data-buy="${k}" data-n="5" ${off || coin < i.buy * 5 ? 'disabled' : ''}>×5</button>`)
      + (i.food && inv[k] ? ` <button class="btn small" data-eat="${k}" style="background:#2ecc71;border-bottom-color:#1e8f4e" ${hunger >= 99 ? 'disabled' : ''}>🍴 กิน</button>` : '')
      + (i.once && inv[k] ? ` <button class="btn small muted" data-sellback="${k}">↩️ ขายคืน 🪙${sellbackValue(k)}</button>` : '') + `</span></div>`;
  }
  if (shopKind === 'pet') h += petPanelHtml();
  const tierOf = t => (t === 'rod' ? rodLevel() : t === 'axe' ? axeLevel() : 1);
  const fixable = seedTab || sellTab ? [] : Object.keys(DURABILITY).filter(t => DURABILITY[t].shop === shopKind && tierOf(t) > 0);
  if (fixable.length) {
    h += '<div class="sec">🔧 ซ่อมอุปกรณ์ (ใช้แล้วสึกหรอ ถ้าพังต้องซ่อมก่อนใช้ต่อ)</div>';
    for (const t of fixable) {
      const tier = tierOf(t), fx = dur[t] ? dur[t][2] || 0 : 0, mx = durMax(t, tier, fx), cur = dur[t] ? dur[t][0] : mx, pct = Math.round(cur / mx * 100), price = toolPrice(t, tier);
      const can = canRepair(t, tier, cur, fx), cost = can ? repairCost(t, tier, cur, fx) : 0, worn = fx >= REPAIR.maxFixes, better = can && cost >= price * 0.6;
      const note = worn ? 'ซ่อมครบ ' + fx + ' ครั้งแล้ว ซ่อมไม่ได้อีก' : 'ซ่อมแล้ว ' + fx + '/' + REPAIR.maxFixes + ' ครั้ง' + (better ? ' • ซื้อใหม่คุ้มกว่า!' : '');
      h += `<div class="row"><span>${DURABILITY[t].name} <small>${cur}/${mx}</small><div class="hbar" style="width:120px;height:7px"><i style="width:${pct}%;${pct <= 20 ? 'background:#e74c3c' : ''}"></i></div><small style="opacity:.7;display:block">${note}</small></span>`
        + `<span>${worn ? '' : `<button class="btn small" data-repair="${t}" ${!can || (inv.coin || 0) < cost ? 'disabled' : ''}>${can ? '🔧 ซ่อม 🪙' + cost : 'ยังดีอยู่'}</button>`}`
        + (fx || cur <= 0 ? ` <button class="btn small${better || worn ? '' : ' muted'}" data-rebuy="${t}" ${(inv.coin || 0) < price ? 'disabled' : ''}>🛒 ซื้อใหม่ 🪙${price}</button>` : '') + `</span></div>`;
    }
  }
  const showSell = sh.sell.length && (!tabs || seedTab || sellTab || cookTab || petTab);
  const sellKeys = showSell ? Object.keys(inv).filter(k => shopSells(shopKind, k) && itemInfo(k) && itemInfo(k).sell && !(cookTab && FISH_DISH_SELL_TAB.has(k))) : [];
  if (showSell) h += '<div class="sec">ขาย (เลือกได้ว่าจะขายอะไร)</div>';
  if (showSell && !sellKeys.length) h += '<p style="opacity:.7;margin:6px 0">ยังไม่มีของที่ร้านนี้รับซื้อ</p>';
  for (const k of sellKeys) {
    const i = itemInfo(k), m = mult(k), unit = Math.max(1, Math.round(i.sell * m));
    const trend = (m > 1.03 ? `<span style="color:#1e8f4e">▲ ${Math.round((m - 1) * 100)}%</span>` : m < 0.97 ? `<span style="color:#c0392b">▼ ${Math.round((1 - m) * 100)}%</span>` : '') + (m < 0.5 ? ' <span style="color:#c0392b">⚠️ ตลาดอิ่มตัว รอราคากลับก่อนค่อยขาย</span>' : '');
    h += `<div class="row"><span>${i.emoji} ${i.name} ×${inv[k]}<br><small>ราคาตลาด 🪙${unit} (ปกติ ${i.sell}) ${trend}</small></span><span>`
      + `<button class="btn small" data-sell="${k}" data-n="1">ขาย 1</button> `
      + (inv[k] > 1 ? `<button class="btn small" data-sell="${k}" data-n="all" title="ราคาต่อชิ้นลดลงเรื่อยๆ ถึงพื้น 20% ของราคาฐาน">ทั้งหมด 🪙${allTotal(i, m, inv[k])}</button>` : '') + `</span></div>`;
  }
  if (showSell) h += '<p style="font-size:12px;opacity:.65;margin:8px 0 0">💡 ราคาขึ้นลงตามตลาด: ขายชนิดเดิมซ้ำๆ ราคาของคุณจะตกเร็วและฟื้นช้า (ตกเหลือต่ำสุด ~20–25% ของราคาปกติ) • ขายหมวดหนึ่งเยอะ หมวดนั้นตกเร็ว แต่หมวดอื่นฟื้นเร็วขึ้น • มีข่าวราคาพุ่ง/ตกทุกวันในเกม</p>';
  if (cookTab) {
    h += `<div class="sec">👨‍🍳 ห้องครัวเชฟ — เชฟเลเวล ${lvl('cook')} (ทำอาหารข้ามสาย ได้ XP เชฟ ยิ่งเลเวลสูงปลดสูตรแพงขึ้น)</div>`;
    const have = c => Object.keys(inv).reduce((s, k) => s + (inv[k] > 0 && cookCat(c, k) ? inv[k] : 0), 0);
    const haveU = c => Object.keys(inv).filter(k => inv[k] > 0 && cookCat(c, k)).length; // จำนวนชนิดที่มี (สูตรที่ต้องคนละชนิด)
    const hv = n => n.c ? (n.u ? haveU(n.c) : have(n.c)) : (inv[n.k] || 0);
    for (const r of COOK) {
      const parts = r.in.map(n => { const emo = n.c ? COOK_CATS[n.c].emoji : itemInfo(n.k).emoji, nm = n.c ? COOK_CATS[n.c].name + (n.u ? ' (คนละชนิด)' : '') : itemInfo(n.k).name, got = hv(n); return `${emo}${nm} ×${n.n}` + (got >= n.n ? '' : ` <small style="color:#c0392b">(มี ${got})</small>`); }).join(' + ');
      const locked = lvl('cook') < r.lv, ok = r.in.every(n => hv(n) >= n.n);
      h += `<div class="row${locked ? ' lock' : ''}"><span>${r.emoji} ${r.name}${locked ? ` <small>🔒 เชฟ Lv${r.lv}</small>` : ''}<br><small>ใช้ ${parts} • +${r.xp} XP • เวลาทำ ${Math.round(r.time / 1000)} วิ • ค่าเตา 🪙${Math.round(r.sell * COOK_FEE)} • ขายได้ราว 🪙${r.sell} • กินอิ่ม +${r.food}</small></span><span><button class="btn small" data-cook="${r.id}" ${!locked && ok && (inv.coin || 0) >= Math.round(r.sell * COOK_FEE) ? '' : 'disabled'}>ทำ</button></span></div>`;
    }
    h += '<p style="font-size:12px;opacity:.65;margin:8px 0 0">💡 ปลา ผัก ไข่ มาจากคนละสายอาชีพ ลองแลกเปลี่ยนวัตถุดิบกับเพื่อน หรือใช้กระดานใบสั่งซื้อ 📋 • อาหารที่ทำเองขายคืนได้ที่ร้านนี้ (ใช้ชนิดวัตถุดิบที่ถูกที่สุดก่อน)</p>';
  }
  if (shopKind === 'food' && !cookTab) h += '<p style="font-size:12px;opacity:.65;margin:8px 0 0">🍖 ความอิ่มลดลงเรื่อยๆ ขณะออนไลน์ ถึง 0 จะใช้เครื่องมือไม่ได้ • ผลผลิตของตัวเองก็กินได้ (อิ่มน้อยกว่า) ในกระเป๋า 🎒</p>';
  if (shopKind === 'furn') h += `<p style="font-size:12px;opacity:.65;margin:8px 0 0">🏠 ทุกคนมีบ้านหลังใหญ่เป็นของตัวเอง เข้าได้จากเมนู ☰ → 🏠 บ้านฉัน แล้วกดปุ่ม 🏠 อีกครั้ง (หรือ H) เพื่อวางของ • มูลค่าและจำนวนของที่ตกแต่งจะขึ้นอันดับใน 🏘️ บ้านเพื่อน • เก้าอี้/โซฟานั่งได้ • โคมไฟสว่างตอนกลางคืน</p>`;
  if (shopKind === 'wood') {
    h += '<div class="sec">🔨 โรงงานช่างไม้ (ประดิษฐ์ของจากไม้ที่หามาได้)</div>';
    for (const r of CRAFT) {
      const i = itemInfo(r.id), locked = lvl('wood') < r.lv, ok = Object.entries(r.in).every(([k, n]) => (inv[k] || 0) >= n);
      const need = Object.entries(r.in).map(([k, n]) => { const x = itemInfo(k), have = inv[k] || 0; return x.emoji + n + (have >= n ? '' : ' <small style="color:#c0392b">(มี ' + have + ')</small>'); }).join(' + ');
      h += `<div class="row${locked ? ' lock' : ''}"><span>${i.emoji} ${i.name}${locked ? ` <small>🔒 Lv${r.lv}</small>` : ''}<br><small>ใช้ ${need} • +${r.xp} XP${i.furn ? ' • วางในบ้านได้' : ''}</small></span><span><button class="btn small" data-craft="${r.id}" ${locked || !ok ? 'disabled' : ''}>🔨 ทำ</button></span></div>`;
    }
    h += '<p style="font-size:12px;opacity:.65;margin:8px 0 0">💡 ตัดต้นไม้ด้วยขวานได้ไม้ท่อน 🪵 และไม้เนื้อแข็ง 🟫 • ไม้กระดานขายได้แพงกว่าไม้ท่อน • ลังไม้ ถังไม้ ป้ายชี้ทาง ตู้ไปรษณีย์ ตู้เครื่องมือ และกระท่อม ทำได้เฉพาะช่างไม้ (ตะเกียง 🏮 ย้ายไปขายที่ร้านเฟอร์นิเจอร์แล้ว)</p>';
  }
  const body = $('shopBody'); body.innerHTML = h;
  body.querySelectorAll('[data-ftab]').forEach(b => b.onclick = () => { farmTab = b.dataset.ftab; renderShop(); });
  body.querySelectorAll('[data-craft]').forEach(b => b.onclick = () => send({ t: 'craft', id: b.dataset.craft }));
  body.querySelectorAll('[data-cook]').forEach(b => b.onclick = () => send({ t: 'cook', id: b.dataset.cook }));
  bindPet(body);
  body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => send({ t: 'buy', item: b.dataset.buy, n: +b.dataset.n }));
  body.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => send({ t: 'sell', item: b.dataset.sell, n: b.dataset.n === 'all' ? 'all' : 1 }));
  body.querySelectorAll('[data-eat]').forEach(b => b.onclick = () => send({ t: 'eat', item: b.dataset.eat }));
  body.querySelectorAll('[data-repair]').forEach(b => b.onclick = () => send({ t: 'repair', tool: b.dataset.repair }));
  body.querySelectorAll('[data-rebuy]').forEach(b => b.onclick = () => send({ t: 'rebuy', tool: b.dataset.rebuy }));
  body.querySelectorAll('[data-sellback]').forEach(b => b.onclick = () => ask(`ขายคืนได้ 🪙${sellbackValue(b.dataset.sellback)} (70% ของราคาซื้อ หัก 30%) ยืนยัน?`, () => send({ t: 'sellback', item: b.dataset.sellback })));
}
// ร้านเสื้อผ้า: 3 แท็บ (เสื้อ / หมวก / กางเกง) ลองสวมดูตัวอย่างก่อนซื้อได้ ซื้อแล้วสวมให้เลย ขายคืนได้ 70% ของราคาซื้อ
let clothTab = 'shirt', tryWear = null;
const CLOTH_TABS = [['shirt', '👕 เสื้อ'], ['hat', '🎩 หมวก'], ['pants', '👖 กางเกง'], ['acc', '🕶️ ของเสริม']];
function renderCloth() {
  if (!tryWear) tryWear = Object.assign({}, me.wear);
  const coin = inv.coin || 0, own = (cat, it) => it.price === 0 || !!inv[wearKey(cat, it.id)];
  let h = `<canvas id="clothPreview" width="150" height="150"></canvas><div class="center" style="font-size:12px;opacity:.7;margin-bottom:4px">ตัวอย่างชุดที่ลองอยู่ (ยังไม่ซื้อก็ลองได้)</div>`
    + `<div class="tabs">${CLOTH_TABS.map(([c, n]) => `<button class="tab${clothTab === c ? ' on' : ''}" data-ctab="${c}">${n}</button>`).join('')}</div>`;
  for (const it of WEAR[clothTab]) {
    const o = own(clothTab, it), key = wearKey(clothTab, it.id), trying = tryWear[clothTab] === it.id, worn = me.wear[clothTab] === it.id;
    h += `<div class="row"><span>${trying ? '👀 ' : ''}${it.name}<br><small>${worn ? '✅ สวมอยู่' : o ? (it.price ? 'มีแล้ว' : 'ของฟรี') : '🪙' + it.price}</small></span><span>`
      + `<button class="btn small${trying ? ' muted' : ''}" data-try="${it.id}">ลอง</button> `
      + (o ? (worn ? '' : `<button class="btn small" data-wearnow="${it.id}">สวม</button> `) : `<button class="btn small" data-buy="${key}" ${coin < it.price ? 'disabled' : ''}>ซื้อ</button> `)
      + (o && it.price ? `<button class="btn small muted" data-sellback="${key}">↩️ ขายคืน 🪙${sellbackValue(key)}</button>` : '') + `</span></div>`;
  }
  h += `<div class="center" style="margin-top:8px"><button class="btn small muted" data-tryreset="1">↺ กลับไปชุดที่สวมอยู่</button></div>`
    + `<p style="font-size:12px;opacity:.65;margin:8px 0 0">💡 ซื้อแล้วสวมให้ทันที • ขายคืนได้ 70% ของราคาซื้อ (หักค่าธรรมเนียม 30%) • เปลี่ยนสีได้ที่ 🎒 → 👕 ตัวละคร</p>`;
  const bd = $('shopBody'); bd.innerHTML = h;
  const pv = $('clothPreview').getContext('2d'); pv.clearRect(0, 0, 150, 150); pv.save(); pv.translate(75, 105); pv.scale(4, 4);
  drawPlayer({ x: 0, y: 0, dir: 0, moving: false, anim: 0, color: me.color, hat: me.hat, pc: me.pc, wear: tryWear, name: '' }, 0, pv); pv.restore();
  bd.querySelectorAll('[data-ctab]').forEach(b => b.onclick = () => { clothTab = b.dataset.ctab; renderCloth(); });
  bd.querySelectorAll('[data-try]').forEach(b => b.onclick = () => { tryWear[clothTab] = b.dataset.try; playSfx('click'); renderCloth(); });
  bd.querySelectorAll('[data-tryreset]').forEach(b => b.onclick = () => { tryWear = Object.assign({}, me.wear); renderCloth(); });
  bd.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => send({ t: 'buy', item: b.dataset.buy, n: 1 }));
  bd.querySelectorAll('[data-wearnow]').forEach(b => b.onclick = () => { me.wear[clothTab] = tryWear[clothTab] = b.dataset.wearnow; send({ t: 'look', color: me.color, hat: me.hat, pc: me.pc, wear: me.wear }); playSfx('click'); renderCloth(); });
  bd.querySelectorAll('[data-sellback]').forEach(b => b.onclick = () => ask(`ขายคืนได้ 🪙${sellbackValue(b.dataset.sellback)} (70% ของราคาซื้อ หัก 30%) ยืนยัน?`, () => send({ t: 'sellback', item: b.dataset.sellback })));
}

// ---------- input ----------
let lastKeyEvt = 0; // เวลาที่ได้รับ keydown ล่าสุด (รวมตัวซ้ำตอนกดค้าง) ใช้ตรวจปุ่มค้าง
addEventListener('keydown', e => {
  lastKeyEvt = performance.now();
  if (!joined) return;
  if (chatFocus) {
    if (e.key === 'Enter') { const v = $('chatIn').value.trim(); if (v) send({ t: 'chat', text: v }); closeChat(); }
    else if (e.key === 'Escape') closeChat();
    return;
  }
  // ใช้ e.code (ตำแหน่งปุ่มจริงบนคีย์บอร์ด) ไม่ใช่ e.key เพื่อให้ WASD และปุ่มลัดทำงานได้แม้เปลี่ยนเป็นแป้นพิมพ์ภาษาไทย
  const c = e.code;
  if (c === 'Enter' || c === 'NumpadEnter') { e.preventDefault(); openChat(); return; }
  if (c === 'Escape') { closeShop(); closeBag(); closePeople(); closeQuest(); closeAch(); closeStatus(); closeBug(); closeHub(); setMenu(false); closeArcade(); closeCinema(); closeTown(); closeAdmin(); closePlots(); closeHomeChoice(); $('ask').classList.add('hidden'); if (tradeSt) send({ t: 'trade', a: 'cancel' }); hidePicker(); return; }
  if (c === 'KeyQ') { const i = TOOL_LIST.indexOf(selTool); let n = i; do { n = (n + 1) % TOOL_LIST.length; } while (TOOL_LIST[n] === 'axe' && !axeLevel()); selTool = TOOL_LIST[n]; ls.set('mw_tool', selTool); slot = 0; hidePicker(); renderHud(); toast(`${toolInfo(selTool).e} ${TOOL_SHORT[selTool]}`); playSfx('click'); return; } // Q = สลับเครื่องมือในช่อง 1
  if (c === 'KeyP') { peopleShown() ? closePeople() : openPeople(); return; }
  if (c === 'KeyB' || c === 'KeyI') { $('bagBtn').onclick(); return; }
  if (c === 'KeyC') { $('statBtn').onclick(); return; }
  if (c === 'KeyH') { homeAction(); return; }
  if (c === 'KeyR' && build.on) { rotateBuild(); return; }
  if (c === 'KeyL') { if (inv.lamp > 0) $('lampBtn').onclick(); return; }
  if (c === 'KeyM') { setMini(miniState === 'off' ? 'small' : miniState === 'small' ? 'big' : 'off'); return; }
  const dg = /^(?:Digit|Numpad)([1-9])$/.exec(c);
  if (dg && +dg[1] <= SLOTS.length) { pickSlot(+dg[1] - 1); return; }
  if (c === 'Space') { e.preventDefault(); act(); return; }
  if (c.startsWith('Arrow')) e.preventDefault();
  keys[c] = true;
  mouse.active = false;
});
// กันปุ่มเดินค้าง (ตัวละครเดินเองและยกเลิกการคลิกเดิน): ถ้าไม่ได้รับ keyup (เช่น เปิดเมนูคลิกขวา/สลับหน้าต่าง/IME ภาษาไทย) ปุ่มจะค้างจนรีเฟรช
const keyName = {};
const clearKeys = () => { for (const k in keys) keys[k] = false; };
addEventListener('keyup', e => { keys[e.code] = false; for (const k in keyName) if (keyName[k] === e.key.toLowerCase()) keys[k] = false; delete keyName[e.code]; });
addEventListener('keydown', e => { keyName[e.code] = String(e.key).toLowerCase(); }, true);
addEventListener('blur', clearKeys);
addEventListener('focusout', e => { if (!e.relatedTarget) clearKeys(); });
addEventListener('contextmenu', clearKeys);
document.addEventListener('visibilitychange', clearKeys);
const KEY_STALE_MS = 1800; // กดค้างจริงเบราว์เซอร์ส่ง keydown ซ้ำเรื่อยๆ ถ้าเงียบเกินนี้ถือว่าปล่อยปุ่มแล้ว
function openChat() { $('chatIn').classList.remove('hidden'); $('chatIn').focus(); chatFocus = true; renderChatHist(); $('chatHist').classList.remove('hidden'); $('chatLog').style.display = 'none'; for (const k in keys) keys[k] = false; }
function closeChat() { $('chatHist').classList.add('hidden'); $('chatLog').style.display = ''; $('chatIn').value = ''; $('chatIn').classList.add('hidden'); $('chatIn').blur(); chatFocus = false; }

// act() = ใช้กับช่องที่หันหน้าไป (Space / ปุ่ม A), act(tx,ty) = ใช้กับช่องที่คลิก/แตะ
const FISH_SHORE = 2; // ตกปลาต้องยืนห่างจากน้ำไม่เกิน 2 ช่อง แต่โยนเหยื่อไปไกลแค่ไหนก็ได้
const reachOf = (tx, ty) => (toolId() === 'rod' && MAP[ty] && MAP[ty][tx] === T.WATER ? 999 : 2); // เบ็ดโยนไกลได้เฉพาะไปที่น้ำ ของอย่างอื่นยังต้องอยู่ใกล้
const nearWater = (x, y) => { for (let dy = -FISH_SHORE; dy <= FISH_SHORE; dy++) for (let dx = -FISH_SHORE; dx <= FISH_SHORE; dx++) if (MAP[y + dy] && MAP[y + dy][x + dx] === T.WATER) return true; return false; };
const myTile = () => [Math.floor(me.x / TS), Math.floor(me.y / TS)];
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const inReach = (tx, ty) => { const [px, py] = myTile(); return cheb(tx, ty, px, py) <= reachOf(tx, ty); };
function act(tx, ty) {
  const now = performance.now();
  if (!me || chatFocus || modalOpen() || now - lastAct < 200) return;
  if (scene && tx === undefined) return; // ในบ้านใช้เครื่องมือฟาร์มไม่ได้ (แตะที่นั่งเพื่อนั่งอย่างเดียว)
  const o = { t: 'act', tool: scene ? '' : toolId() }; if (o.tool === 'rod') o.bait = selBait;
  if (tx !== undefined) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return;
    if (!inReach(tx, ty)) { toast('ไกลเกินไป เดินเข้าไปใกล้ๆ ก่อน'); return; }
    const [px, py] = myTile(), dx = tx - px, dy = ty - py;
    if (dx || dy) me.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
    o.tx = tx; o.ty = ty;
  }
  lastAct = now; swing = 0.25; me.useAt = performance.now();
  send(o);
}

// ---------- คลิก/แตะ: เดินไป หรือใช้งานช่องนั้น ----------
const solidTile = (tx, ty) => {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
  const t = MAP[ty][tx];
  return t === T.WATER || t === T.TREE || t === T.BUILD || t === T.FENCE || t === T.SHOP || t === T.FURN || t === T.LANDMARK || t === T.WALL || t === T.VOID;
};
function findPath(sx, sy, goal) { // BFS แบบ 4 ทิศ คืนรายการช่องที่ต้องเดิน (ไม่รวมช่องเริ่ม)
  const prev = new Map(), q = [[sx, sy]], key = (x, y) => y * W + x;
  prev.set(key(sx, sy), null);
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    if (goal(x, y)) {
      const out = []; let c = [x, y];
      while (prev.get(key(c[0], c[1])) !== null) { out.push(c); c = prev.get(key(c[0], c[1])); }
      return out.reverse();
    }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (solidTile(nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), [x, y]); q.push([nx, ny]);
    }
  }
  return null;
}
const animalAt = (tx, ty) => { for (const a of animals.values()) if (Math.hypot(a.x - (tx + 0.5) * TS, a.y - (ty + 0.5) * TS) < 40) return a; return null; };
function interactive(tx, ty) { // ช่องนี้มีอะไรให้ทำด้วยเครื่องมือที่ถืออยู่ไหม
  const id = toolId(), t = MAP[ty][tx], f = farm[tx + ',' + ty];
  if (t === T.SHOP || animalAt(tx, ty) || cinemaAt(tx, ty)) return true;
  if (seatAt(tx, ty)) return true;
  if (f && f.c && f.s === 3) return true;
  if (id === 'hoe') return !!f || (t === T.GRASS && inFarm(tx, ty));
  if (id === 'water') return !!f || t === T.WATER;
  if (id.startsWith('seed_')) return !!f && !f.c;
  if (id === 'rod') return t === T.WATER;
  return false;
}
function stopWalk() { walk = null; }
const hubSign = BUILDINGS.find(b => b.kind === 'sign');
const hubSignAt = (tx, ty) => !!hubSign && tx >= hubSign.x0 && tx <= hubSign.x1 && ty >= hubSign.y0 - 1 && ty <= hubSign.y1;
function onTileClick(tx, ty) {
  if (!me || chatFocus || modalOpen() || tx < 0 || ty < 0 || tx >= W || ty >= H) return;
  if (!scene && (inHouseBld(tx, ty) || (tx === Shared.HOUSE_DOOR.x && ty === Shared.HOUSE_DOOR.y))) { // แตะตัวบ้าน/ประตู = เดินไปที่ประตู (ยืนอยู่แล้วก็ถามเลย)
    const [px, py] = myTile(); if (px === Shared.HOUSE_DOOR.x && py === Shared.HOUSE_DOOR.y) { openHomeChoice(); return; }
    tx = Shared.HOUSE_DOOR.x; ty = Shared.HOUSE_DOOR.y;
  }
  if (!scene && hubSignAt(tx, ty)) { stopWalk(); openHub(); return; } // กดป้าย Arcade Hub = เปิดแต้ม/อันดับ
  const [px, py] = myTile();
  if (interactive(tx, ty)) {
    const onWater = MAP[ty][tx] === T.WATER, rod = (toolId() === 'rod' || toolId() === 'water') && onWater; // เบ็ด/บัวรดน้ำกับน้ำ ต้องยืนริมสระ (ไม่เกิน 2 ช่อง)
    if (inReach(tx, ty) && (!rod || nearWater(px, py))) { stopWalk(); act(tx, ty); return; }
    // เดินเข้าไปใกล้พอแล้วค่อยทำให้เอง
    const pts = findPath(px, py, (x, y) => rod ? nearWater(x, y) : cheb(x, y, tx, ty) <= 1);
    if (!pts) { toast('เดินไปไม่ถึงตรงนั้น'); return; }
    walk = { pts, act: { tx, ty }, dest: pts.length ? pts[pts.length - 1] : [px, py], stuck: 0 };
    return;
  }
  const pts = solidTile(tx, ty)
    ? findPath(px, py, (x, y) => Math.abs(x - tx) + Math.abs(y - ty) === 1)
    : findPath(px, py, (x, y) => x === tx && y === ty);
  if (!pts) { toast('เดินไปไม่ถึงตรงนั้น'); return; }
  walk = pts.length ? { pts, act: null, dest: pts[pts.length - 1], stuck: 0 } : null;
}

const mouse = { active: false, tx: 0, ty: 0, sx: 0, sy: 0 };
const tileAt = e => [Math.floor((camX + e.clientX * (canvas.width / innerWidth) / zoom) / TS), Math.floor((camY + e.clientY * (canvas.height / innerHeight) / zoom) / TS)];
const ptrs = new Map(); let pinch = null; // นิ้วที่แตะบน canvas (สำหรับ pinch-zoom + แยกแตะ/ลาก บนมือถือ)
const pinchDist = () => { const v = [...ptrs.values()]; return Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y); };
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { if (!me) return; mouse.active = true; [mouse.tx, mouse.ty] = tileAt(e); if (scene) [mouse.sx, mouse.sy] = isoPtr(e); return; }
  const p = ptrs.get(e.pointerId); if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (pinch && ptrs.size >= 2 && pinch.d0 > 0) setZoom(pinch.z0 * pinchDist() / pinch.d0); // บีบ/ถ่างสองนิ้ว = ซูม
});
canvas.addEventListener('pointerleave', () => { mouse.active = false; });
canvas.addEventListener('pointerdown', e => {
  if (!me) return;
  if (e.pointerType === 'mouse') { // เมาส์: แตะช่องทำงานทันทีเหมือนเดิม
    if (e.button !== 0) return;
    hidePicker(); if (scene) { [mouse.sx, mouse.sy] = isoPtr(e); mouse.active = true; houseIsoClick(mouse.sx, mouse.sy); return; }
    const [tx, ty] = tileAt(e); mouse.active = true; mouse.tx = tx; mouse.ty = ty;
    flash = { tx, ty, t: performance.now() }; onTileClick(tx, ty); return;
  }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() }); // มือถือ: แตะทำงานตอนปล่อยนิ้ว (แยกจาก pinch)
  if (ptrs.size === 2) pinch = { d0: pinchDist(), z0: userZoom };
});
const endPtr = e => {
  if (e.pointerType === 'mouse') return;
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
  const wasPinch = !!pinch; if (ptrs.size < 2) pinch = null;
  if (!p || wasPinch) return; // นิ้วที่เป็นส่วนหนึ่งของ pinch ไม่นับเป็นแตะ
  const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy), dur = performance.now() - p.t;
  if (ptrs.size === 0 && moved < 18 && dur < 400 && scene) { hidePicker(); const [sx, sy] = isoPtr(e); houseIsoClick(sx, sy); return; }
  if (ptrs.size === 0 && moved < 18 && dur < 400) { hidePicker(); const [tx, ty] = tileAt(e); flash = { tx, ty, t: performance.now() }; onTileClick(tx, ty); } // แตะสั้นๆ นิ้วเดียว = ทำงานช่องนั้น
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
$('abtn').addEventListener('pointerdown', e => { e.preventDefault(); stopWalk(); act(); });

// จอยสติ๊กมือถือ
(() => {
  const el = $('joy'), knob = $('knob'); let id = null;
  const move = e => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), max = r.width / 2 - 14;
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    joy.x = Math.abs(dx) > max * 0.22 ? dx / max : 0; joy.y = Math.abs(dy) > max * 0.22 ? dy / max : 0;
  };
  el.addEventListener('pointerdown', e => { id = e.pointerId; el.setPointerCapture(id); move(e); });
  el.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
  const end = e => { if (e.pointerId !== id) return; id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
})();

// ---------- แชทเสียง (WebRTC, ต่อตรงระหว่างผู้เล่น / signaling ผ่าน WebSocket เดิม) ----------
const RTC_CFG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
const peers = new Map(), levels = new Map();
window.__mw = { peers, keys, openHub: () => openHub(), hubSignAt: (x, y) => hubSignAt(x, y), renderArcade: () => renderArcade(), setArc: t => { arcTable = t; }, get npcs() { return npcs; }, get pets() { return pets; }, get drawPlayer() { return drawPlayer; }, get me() { return me; }, handle, send, setHour(h) { timeOffset = ((h - 6 + 24) % 24) / 24 * CLOCK_MS - (Date.now() % CLOCK_MS); } }; // สำหรับดีบัก
let micStream = null, micTrack = null, micOn = false, actx = null;
let callWith = 0, callPend = 0, callIn = 0, callMicOn = false, callTimer = 0; // callWith = คู่สายที่ต่อแล้ว, callPend = เรากำลังโทรหา, callIn = กำลังมีคนโทรหาเรา
const pcSend = (to, k) => send({ t: 'pcall', to, k });
function callBox(show, text) { // กล่องรับสายที่มุมบน
  const b = $('callBox'); if (!b) return; b.classList.toggle('hidden', !show); if (text) $('callText').textContent = text;
}
function setCall(id) { callWith = id; peers.forEach(attachMic); renderPeople(true); }
function leaveCall() { // วางสายทั้งหมดและคืนสถานะไมค์ถ้าไมค์ถูกเปิดให้สายนี้
  clearTimeout(callTimer); callBox(false); callPend = 0; callIn = 0; setCall(0);
  if (callMicOn) { callMicOn = false; if (micOn) $('micBtn').click(); }
}
function beginCall(id) { // สายต่อแล้ว: เปิดไมค์ทั้งสองฝั่ง และส่งเสียงให้คู่สายคนเดียว
  const q = players.get(id); callPend = 0; callIn = 0; clearTimeout(callTimer); callBox(false);
  callWith = id; if (!micOn) { callMicOn = true; $('micBtn').click(); }
  setCall(id); toast(`📞 สายต่อกับ ${q ? q.name : 'เพื่อน'} แล้ว เปิดไมค์ทั้งสองฝั่ง — มีแค่คุณสองคนที่ได้ยิน`);
}
function startCall(id) {
  if (callWith || callPend || callIn) leaveCall();
  const q = players.get(id); if (!q) return;
  callPend = id; pcSend(id, 'ring'); toast(`📞 กำลังโทรหา ${q.name} รอให้รับสาย...`); renderPeople(true);
  clearTimeout(callTimer); callTimer = setTimeout(() => { if (callPend === id) cancelCall(); }, 30000); // ไม่มีคนรับภายใน 30 วินาทีให้ยกเลิกเอง
}
function cancelCall() { // ยกเลิกการโทรที่ยังไม่มีคนรับ
  if (!callPend) return; pcSend(callPend, 'end'); const q = players.get(callPend); callPend = 0; toast(`📵 ยกเลิกการโทร${q ? 'หา ' + q.name : ''}`); renderPeople(true);
}
function endCall() { // วางสายที่ต่ออยู่
  const id = callWith; if (!id) return; pcSend(id, 'end'); leaveCall(); toast('📵 วางสายแล้ว');
}
function acceptCall() { const id = callIn; if (!id) return; pcSend(id, 'ok'); beginCall(id); }
function declineCall() { const id = callIn; if (!id) return; pcSend(id, 'no'); callIn = 0; clearTimeout(callTimer); callBox(false); renderPeople(true); }
$('callAccept').onclick = acceptCall; $('callDecline').onclick = declineCall;
function onPcall(from, k) {
  if (k === 'ring') {
    if (callWith || callPend || callIn) { pcSend(from, 'no'); return; } // กำลังสายอยู่ ตอบว่าไม่ว่าง
    callIn = from; const q = players.get(from);
    callBox(true, `📞 ${q ? q.name : 'เพื่อน'} โทรหาคุณ`); clearTimeout(callTimer); callTimer = setTimeout(declineCall, 30000);
    renderPeople(true);
  } else if (k === 'ok') { // อีกฝั่งรับสายแล้ว
    if (callPend === from) beginCall(from);
  } else if (k === 'no') { // ไม่รับ หรือไม่ว่าง
    if (callPend === from) { callPend = 0; const q = players.get(from); toast(`📵 ${q ? q.name : 'เพื่อน'} ไม่รับสาย`); renderPeople(true); }
  } else if (k === 'end') { // อีกฝั่งยกเลิกหรือวางสาย
    if (callIn === from) { callIn = 0; clearTimeout(callTimer); callBox(false); renderPeople(true); }
    else if (callWith === from || callPend === from) { const q = players.get(from); leaveCall(); toast(`📵 ${q ? q.name : 'เพื่อน'} วางสายแล้ว`); }
  }
}
const attachMic = (p, id) => p.pc.getTransceivers().forEach(t => { if (t.sender) t.sender.replaceTrack(micOn && (!callWith || id === callWith) ? micTrack : null).catch(() => {}); }); // ระหว่างสายต่อ ส่งเสียงให้คู่สายคนเดียว
function getPeer(id) {
  let p = peers.get(id);
  if (p) return p;
  const pc = new RTCPeerConnection(RTC_CFG);
  p = { pc, pending: [], audio: null };
  peers.set(id, p);
  pc.onicecandidate = e => { if (e.candidate) send({ t: 'rtc', to: id, d: { c: e.candidate } }); };
  pc.ontrack = e => {
    if (p.audio) return;
    const stream = e.streams[0] || new MediaStream([e.track]);
    p.audio = new Audio(); p.audio.autoplay = true; p.audio.srcObject = stream;
    p.audio.volume = 0; // ปรับตามระยะใน updateSpeaking
    p.audio.play().catch(() => {});
    watchLevel(id, stream);
  };
  return p;
}
function closePeer(id) {
  const p = peers.get(id); if (!p) return;
  p.pc.close(); if (p.audio) p.audio.srcObject = null;
  peers.delete(id); levels.delete(id);
}
async function flushIce(p) { for (const c of p.pending.splice(0)) await p.pc.addIceCandidate(c).catch(() => {}); }
async function callPeer(id) {
  try {
    closePeer(id); // เริ่มการเชื่อมต่อใหม่เสมอ ไม่ใช้การเชื่อมต่อเก่าที่อาจค้างจากฉากก่อน
    const p = getPeer(id);
    p.pc.addTransceiver('audio', { direction: 'sendrecv' });
    attachMic(p, id);
    await p.pc.setLocalDescription(await p.pc.createOffer());
    send({ t: 'rtc', to: id, d: { o: p.pc.localDescription } });
  } catch (e) { console.warn('call failed', e); }
}
async function onRtc(from, d) {
  try {
    if (d.o) closePeer(from); // ข้อเสนอใหม่ = เริ่มการเชื่อมต่อใหม่ ไม่ต่อกับท่อเสียงเก่าที่เงียบแล้ว
    const p = getPeer(from), pc = p.pc;
    if (d.o) {
      await pc.setRemoteDescription(d.o);
      pc.getTransceivers().forEach(t => { t.direction = 'sendrecv'; });
      attachMic(p, from);
      await pc.setLocalDescription(await pc.createAnswer());
      send({ t: 'rtc', to: from, d: { a: pc.localDescription } });
      await flushIce(p);
    } else if (d.a) { await pc.setRemoteDescription(d.a); await flushIce(p); }
    else if (d.c) { if (pc.remoteDescription) await pc.addIceCandidate(d.c).catch(() => {}); else p.pending.push(d.c); }
  } catch (e) { console.warn('rtc failed', e); }
}
function watchLevel(id, stream) { // ตรวจว่าใครกำลังพูดอยู่ (แสดงกรอบเขียวที่ชื่อ)
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const an = actx.createAnalyser(); an.fftSize = 256;
    actx.createMediaStreamSource(stream).connect(an);
    levels.set(id, { an, buf: new Uint8Array(an.fftSize) });
  } catch (e) { /* ไม่รองรับก็แค่ไม่มีไฟแสดงเสียงพูด */ }
}
// ระยะเสียง (หน่วยเป็นช่อง): ใกล้กว่า VOICE_FULL ได้ยินดังเต็มที่ ไกลกว่านั้นค่อยๆ เบาลง จนเงียบที่ VOICE_MAX (เกินนี้ไม่ได้ยินเลย)
// ปิดเสียงเพื่อน: all = ปิดทุกคน, names = ข้อยกเว้นรายคน (true = ปิด, false = เปิด) จำไว้ในเครื่องนี้ตามชื่อผู้เล่น
const mute = { all: false, names: {} };
try { const m = JSON.parse(ls.get('mw_mute') || '{}'); mute.all = !!m.all; if (m.names && typeof m.names === 'object') for (const k of Object.keys(m.names).slice(0, 200)) mute.names[k] = !!m.names[k]; } catch (e) {}
const saveMute = () => ls.set('mw_mute', JSON.stringify(mute));
const isMuted = p => { const o = mute.names[p.name.toLowerCase()]; return o === undefined ? mute.all : o; };
// VOICE_GLOBAL = true คือได้ยินกันทั่วแมพ (ตอนนี้ปิดระบบระยะไว้ชั่วคราว) ตั้งเป็น false เพื่อกลับไปใช้ระยะ 3-7 ช่อง
const VOICE_GLOBAL = true, VOICE_FULL = 3, VOICE_MAX = 7;
const voiceGain = d => (VOICE_GLOBAL || d <= VOICE_FULL ? 1 : Math.max(0, 1 - (d - VOICE_FULL) / (VOICE_MAX - VOICE_FULL)));
let lastLevel = 0;
function updateSpeaking(now) {
  if (now - lastLevel < 100) return; lastLevel = now;
  peers.forEach((pe, id) => {
    const p = players.get(id);
    if (!pe.audio || !p || !me) return;
    pe.audio.volume = pe.vol = isMuted(p) || (callWith && id !== callWith) ? 0 : voiceGain(Math.hypot(p.x - me.x, p.y - me.y) / TS); // ระหว่างโทรส่วนตัวได้ยินคู่สายคนเดียว
  });
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  levels.forEach((l, id) => {
    const p = players.get(id); if (!p) return;
    l.an.getByteTimeDomainData(l.buf);
    let s = 0; for (const v of l.buf) s += (v - 128) * (v - 128);
    const pe = peers.get(id);
    p.speaking = p.voice && Math.sqrt(s / l.buf.length) > 4 && (!pe || pe.vol === undefined || pe.vol > 0.05);
  });
}
function setMicUi() { const b = $('micBtn'); b.classList.toggle('on', micOn); b.textContent = micOn ? '🎙️' : '🎤'; b.title = micOn ? 'ไมค์: เปิดอยู่ (กดเพื่อปิด)' : 'ไมค์: ปิดอยู่ (กดเพื่อเปิด)'; } // ไมค์ = 🎙️ เปิด / 🎤 ปิด • ลำโพง = 🔊 เปิด / 🔇 ปิด (ไอคอน 🔇 ข้างชื่อผู้เล่นหมายถึงปิดลำโพง)
$('micBtn').onclick = async () => {
  if (!micOn) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('เปิดไมค์ไม่ได้: ต้องเข้าผ่านลิงก์ https'); return; }
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) { toast('เปิดไมค์ไม่ได้ ตรวจสอบสิทธิ์ไมโครโฟนของเบราว์เซอร์'); return; }
    micTrack = micStream.getAudioTracks()[0]; micOn = true;
    peers.forEach(attachMic); watchLevel(myId, micStream);
    toast(VOICE_GLOBAL ? 'เปิดไมค์แล้ว 🎙️ ทุกคนในแมพได้ยินคุณ' : 'เปิดไมค์แล้ว 🎙️ คนที่อยู่ใกล้ได้ยินคุณ');
  } else {
    micOn = false; micStream.getTracks().forEach(t => t.stop()); micStream = micTrack = null;
    peers.forEach(attachMic); levels.delete(myId); if (me) me.speaking = false;
    toast('ปิดไมค์แล้ว 🔇');
  }
  if (me) me.voice = micOn;
  send({ t: 'voice', on: micOn }); setMicUi();
};

// ---------- เสียงเอฟเฟกต์ (สังเคราะห์ด้วย WebAudio ไม่ต้องใช้ไฟล์เสียง) ----------
let sfxOn = ls.get('mw_sfx') !== '0', sctx = null, smaster = null;
function sAudio() {
  if (!sctx) { try { sctx = new (window.AudioContext || window.webkitAudioContext)(); smaster = sctx.createGain(); smaster.gain.value = 0.55; smaster.connect(sctx.destination); } catch (e) { return null; } }
  if (sctx.state === 'suspended') sctx.resume().catch(() => {});
  return sctx;
}
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => sAudio(), { once: true })); // เบราว์เซอร์ต้องมีการกด/แตะก่อนถึงจะเล่นเสียงได้
function tone(freq, dur, o = {}) {
  const c = sAudio(); if (!c) return;
  const t0 = c.currentTime + (o.delay || 0), osc = c.createOscillator(), g = c.createGain(), v = (o.vol === undefined ? 0.3 : o.vol) * (o.k === undefined ? 1 : o.k);
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t0 + (o.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); f.connect(g); } else osc.connect(g);
  g.connect(smaster); osc.start(t0); osc.stop(t0 + dur + 0.05);
  if (o.vib) { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = o.vib; lg.gain.value = freq * 0.05; lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t0); lfo.stop(t0 + dur + 0.05); }
}
function noise(dur, o = {}) {
  const c = sAudio(); if (!c) return;
  const t0 = c.currentTime + (o.delay || 0), n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t0); if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur); f.Q.value = o.q || 1;
  const g = c.createGain(), v = (o.vol === undefined ? 0.3 : o.vol) * (o.k === undefined ? 1 : o.k);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t0 + (o.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(smaster); src.start(t0);
}
const SFX = {
  hoe: k => { tone(110, 0.14, { to: 55, vol: 0.5, k }); noise(0.1, { type: 'lowpass', f: 700, vol: 0.3, k }); },
  water: k => { noise(0.45, { f: 2500, to: 1200, q: 0.8, vol: 0.28, k }); tone(900, 0.12, { to: 500, vol: 0.1, k, delay: 0.05 }); },
  plant: k => { tone(330, 0.08, { type: 'triangle', to: 520, vol: 0.3, k }); tone(520, 0.1, { type: 'triangle', to: 780, vol: 0.25, k, delay: 0.07 }); },
  harvest: k => { [523, 659, 784].forEach((f, i) => tone(f, i === 2 ? 0.22 : 0.12, { type: 'triangle', vol: 0.3, k, delay: i * 0.09 })); },
  cast: k => { noise(0.35, { f: 600, to: 3000, q: 0.7, vol: 0.25, k }); tone(260, 0.18, { to: 90, vol: 0.3, k, delay: 0.3 }); noise(0.18, { f: 1800, q: 1.5, vol: 0.2, k, delay: 0.32 }); },
  bite: k => { tone(1175, 0.5, { vol: 0.35, k }); tone(1568, 0.45, { vol: 0.2, k, delay: 0.12 }); },
  catch: k => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, { type: 'triangle', vol: 0.28, k, delay: i * 0.07 })); noise(0.2, { f: 2000, vol: 0.15, k }); },
  catch_big: k => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.3, k, delay: i * 0.07 })); noise(0.3, { f: 2500, vol: 0.2, k }); },
  miss: k => { tone(220, 0.25, { type: 'sawtooth', to: 110, vol: 0.18, lp: 900, k }); },
  feed_cow: k => { tone(150, 0.7, { type: 'sawtooth', to: 105, vol: 0.35, lp: 600, vib: 6, k }); tone(300, 0.55, { to: 210, vol: 0.1, k }); }, // มอออ
  feed_chicken: k => { for (let i = 0; i < 3; i++) tone(520 - i * 40, 0.07, { type: 'square', to: 380, vol: 0.14, lp: 2400, k, delay: i * 0.1 }); },
  feed_pig: k => { tone(190, 0.16, { type: 'sawtooth', to: 130, vol: 0.3, lp: 700, k }); tone(170, 0.2, { type: 'sawtooth', to: 110, vol: 0.3, lp: 700, k, delay: 0.2 }); noise(0.12, { f: 400, q: 2, vol: 0.12, k, delay: 0.15 }); },
  feed_duck: k => SFX.feed_chicken(k), feed_sheep: k => SFX.feed_cow(k),
  collect: k => { tone(880, 0.1, { type: 'triangle', vol: 0.28, k }); tone(1320, 0.18, { type: 'triangle', vol: 0.25, k, delay: 0.08 }); },
  coin: k => { tone(1319, 0.09, { type: 'square', vol: 0.12, lp: 3000, k }); tone(1976, 0.22, { type: 'square', vol: 0.12, lp: 3500, k, delay: 0.08 }); },
  levelup: k => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.3, k, delay: i * 0.1 })); },
  win: k => { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.18, { type: 'square', vol: 0.15, lp: 3000, k, delay: i * 0.1 })); },
  lose: k => { [392, 330, 262].forEach((f, i) => tone(f, 0.25, { type: 'sawtooth', vol: 0.12, lp: 900, k, delay: i * 0.16 })); },
  draw: k => { tone(440, 0.2, { type: 'triangle', vol: 0.2, k }); tone(440, 0.2, { type: 'triangle', vol: 0.2, k, delay: 0.25 }); },
  click: k => tone(700, 0.05, { type: 'square', vol: 0.07, lp: 2000, k }),
  go: k => { tone(880, 0.25, { type: 'square', vol: 0.2, lp: 3000, k }); },
  eat: k => { for (let i = 0; i < 3; i++) { noise(0.07, { type: 'lowpass', f: 900, vol: 0.28, k, delay: i * 0.12 }); tone(180 + i * 25, 0.06, { type: 'triangle', vol: 0.12, k, delay: i * 0.12 }); } },
  die: k => { tone(330, 0.5, { type: 'sawtooth', to: 80, vol: 0.18, lp: 700, k }); tone(260, 0.6, { type: 'sine', to: 60, vol: 0.15, k, delay: 0.2 }); },
  chop: k => { noise(0.07, { type: 'lowpass', f: 1200, vol: 0.4, k }); tone(180, 0.1, { type: 'square', to: 90, vol: 0.18, lp: 900, k }); },
  fell: k => { noise(0.5, { type: 'lowpass', f: 600, to: 200, vol: 0.35, k }); tone(120, 0.45, { type: 'sawtooth', to: 50, vol: 0.2, lp: 500, k, delay: 0.05 }); noise(0.25, { f: 3000, vol: 0.15, k, delay: 0.1 }); },
  heal: k => { [660, 880, 1100].forEach((f, i) => tone(f, 0.16, { type: 'sine', vol: 0.22, k, delay: i * 0.09 })); },
};
function playSfx(kind, k = 1) { if (!sfxOn || !SFX[kind]) return; try { SFX[kind](k); } catch (e) { /* ไม่รองรับเสียงก็ข้าม */ } }

// ---------- ตู้เกม (เดิมพันด้วยเหรียญ) ----------
let arcTable = null, arcStatus = {}, arcBet = 10, arcBotBet = 0;
const arcLast = {};
const arcOpenNow = () => !$('arcade').classList.contains('hidden');
function openArcade() { $('arcade').classList.remove('hidden'); renderArcade(); }
function closeArcade() { if (!arcOpenNow()) return; if (arcTable) send({ t: 'arc', a: 'close', id: arcTable.id }); $('arcade').classList.add('hidden'); arcTable = null; }
function onArc(m) {
  if (m.close) { if (arcTable && arcTable.id === m.close) { arcTable = null; closeArcade(); } return; } // เดินห่างตู้เกินระยะ: เซิร์ฟเวอร์พาออกจากโต๊ะแล้ว
  const t = m.table, was = arcLast[t.id]; arcLast[t.id] = t.state;
  if (t.game === 'react' && t.g) { const ph = arcLast[t.id + ':ph']; arcLast[t.id + ':ph'] = t.g.phase; if (t.g.phase === 'go' && ph !== 'go' && arcOpenNow()) playSfx('go'); }
  const uno = t.game === 'uno', casino = t.game === 'bacc' || t.game === 'bj', party = PARTY_GAMES.has(t.game);
  const amPlayer = (uno || casino || party) ? t.players.some(p => p.id === myId && !p.out) : (t.xId === myId || t.oId === myId);
  if (m.open) { arcTable = t; unoWild = -1; openArcade(); return; }
  if (t.state === 'playing' && was !== 'playing' && amPlayer) { arcTable = t; unoWild = -1; openArcade(); toast(uno ? '🃏 เกม UNO เริ่มแล้ว!' : casino ? '🎰 โต๊ะเริ่มแล้ว วางเดิมพันได้เลย!' : party ? '🎮 เกมเริ่มแล้ว!' : '🎮 เกม XO เริ่มแล้ว!'); return; }
  if (arcTable && arcTable.id === t.id) { if (uno && t.cur !== myId) unoWild = -1; arcTable = t; if (arcOpenNow()) renderArcade(); }
}
// ----- เกมหลายคน: ไพ่ป๊อก / ใครกดเร็วกว่า / เป่ายิ้งฉุบ (ห้องแบบ UNO: 2–8 คน เริ่มเมื่อ ≥2 • เล่นคนเดียวกับบอท • เติมบอทได้) -----
const PARTY_GAMES = new Set(['pok', 'react', 'rps']);
const PARTY_RULES = {
  pok: 'แจกไพ่คนละ 2 ใบ ใครมีป๊อก 8/9 เปิดไพ่ทันที ไม่งั้นเลือกจั่วเพิ่มหรืออยู่ แล้วเทียบแต้ม (A = 1, 10/J/Q/K = 0) • แต้มเท่ากันตัดสินด้วยเด้ง (สองใบดอก/เลขเดียวกัน ×2, สามใบดอกเดียวกัน ×3) ยังเท่ากันหาร pot',
  react: 'ทุกคนจ้องสัญญาณ ใครกดก่อนสัญญาณเขียวออกจากรอบนั้น คนแรกที่กดหลังสัญญาณชนะรอบ ใครชนะครบ 2 รอบก่อนเป็นผู้ชนะ',
  rps: 'ทุกคนเลือกพร้อมกันภายใน 10 วินาที ถ้าเหลือ 2 แบบ ฝ่ายชนะได้ 1 แต้ม (เสมอ/ครบ 3 แบบ เล่นรอบนั้นใหม่) ครบ 2 แต้มก่อนเป็นผู้ชนะ',
};
const RPS_ICON = { R: '✊', P: '✋', S: '✌️' };
const pokPtsC = h => (h || []).reduce((s, c) => s + (c.slice(1) === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(c.slice(1)) ? 0 : +c.slice(1)), 0) % 10;
function renderParty() {
  const t = arcTable, coin = inv.coin || 0, g = t.g || {}, name = GAME_TITLES[t.game] || '';
  if (arcBet > coin) arcBet = [...BETS].reverse().find(b => b <= coin) || 0;
  if (arcBotBet > coin) arcBotBet = [...BOTBET.bets].reverse().find(b => b <= coin) || 0;
  const mine = t.players.find(p => p.id === myId), isHost = t.hostId === myId, playing = t.state === 'playing', alive = !!(mine && !mine.out);
  const nBots = t.game === 'pok' ? 3 : 2;
  let h = `<div class="center" style="font-size:13px;opacity:.75">🪙 เหรียญของคุณ ${coin}</div>`;
  const lobby = () => `<div class="sec">เลือกเดิมพัน (ต่อคน)</div><div class="chips">${BETS.map(b => `<button class="chip${b === arcBet ? ' sel' : ''}" data-bet="${b}" ${coin < b ? 'disabled' : ''}>${b ? '🪙 ' + b : 'ไม่เดิมพัน'}</button>`).join('')}</div>`
    + `<button class="btn" data-arc="create" style="width:100%">⚔️ สร้างห้อง ${esc(name)} (รอเพื่อนมาเข้าร่วม แล้วกดเริ่ม)${arcBet ? ' • เดิมพัน ' + arcBet : ''}</button>`
    + `<div class="sec">🤖 เล่นคนเดียวกับบอท <small>(บอท ${nBots} ตัว • ซ้อมฟรี ไม่เดิมพัน)</small></div><div class="chips">${BOTBET.bets.map(b => `<button class="chip${b === arcBotBet ? ' sel' : ''}" data-botbet="${b}" ${coin < b ? 'disabled' : ''}>${b ? '🪙 ' + b : 'ซ้อมฟรี'}</button>`).join('')}</div>`
    + `<button class="btn" data-arc="bot" style="width:100%;margin-top:8px;background:#8a6fd1;border-bottom-color:#5d47a1">🤖 เล่นกับบอท${arcBotBet ? ' (เดิมพัน ' + arcBotBet + ')' : ' (ซ้อม ไม่เดิมพัน)'}</button>`
    + `<p style="font-size:12px;opacity:.7">${esc(PARTY_RULES[t.game] || '')} • เล่นได้ 2–8 คน เจ้าของห้องกดเริ่มเมื่อมีอย่างน้อย 2 คน (เติมบอทได้ถ้าไม่เดิมพัน) • ผู้ชนะได้เหรียญเดิมพันทั้งโต๊ะ (หักค่าบริการ 5%) เสมอหารเท่ากัน • ออกกลางคันถือว่าแพ้</p>`;
  if (t.state === 'idle') h += lobby();
  else if (t.state === 'waiting') {
    h += `<div class="banner" style="background:#e9e0ff">⏳ รอผู้เล่น • ตอนนี้ ${t.players.length}/${t.max} คน • เดิมพัน ${t.bet ? '🪙 ' + t.bet : 'ไม่มี'} ต่อคน</div>`
      + `<div class="opps">${t.players.map(p => `<div class="opp">${p.id === t.hostId ? '👑 ' : ''}${esc(p.name)}</div>`).join('')}</div>`;
    if (isHost) h += (t.players.length >= 2 ? `<button class="btn" data-arc="startnow" style="width:100%;margin-top:8px">▶️ เริ่มเลย (${t.players.length} คน)</button>` : '<p class="center" style="font-size:13px">ให้เพื่อนเดินมาที่ตู้นี้แล้วกด "เข้าร่วม" หรือเติมบอทเพื่อเริ่มเล่น</p>')
      + (!t.bet && t.players.length < t.max ? `<button class="btn" data-arc="addbot" style="width:100%;margin-top:8px;background:#8a6fd1;border-bottom-color:#5d47a1">🤖 เติมบอท</button>` : '')
      + `<button class="btn" data-arc="cancel" style="width:100%;margin-top:8px;background:#9aa0a6;border-bottom-color:#6f757b">ยกเลิกห้อง</button>`;
    else if (mine) h += `<button class="btn" data-arc="leave" style="width:100%;margin-top:8px;background:#9aa0a6;border-bottom-color:#6f757b">ออกจากห้อง (ได้เหรียญคืน)</button>`;
    else h += `<button class="btn" data-arc="join" style="width:100%;margin-top:8px" ${coin < t.bet || t.players.length >= t.max ? 'disabled' : ''}>🎮 เข้าร่วม</button>${coin < t.bet ? '<p class="center" style="color:#c0392b">เหรียญไม่พอ</p>' : ''}`;
  } else {
    const showScore = t.game !== 'pok', win = id => (t.winners || []).includes(id);
    h += `<div class="opps">${t.players.map(p => `<div class="opp${p.out ? ' out' : ''}${t.state === 'over' && win(p.id) ? ' cur' : ''}">${p.id === myId ? '⭐ ' : ''}${esc(p.name)}${showScore ? `<br>⭐ ${p.score}` : ''}${playing && !p.out && t.game !== 'react' ? `<br>${p.done ? '✅' : '🤔'}` : ''}${p.out ? '<br>(ออก)' : ''}</div>`).join('')}</div>`;
    if (t.bet && !t.bot) h += `<div class="center" style="font-size:12px;opacity:.75">เดิมพัน 🪙 ${t.bet} ต่อคน • รางวัลรวม 🪙 ${t.bet * t.players.length}</div>`;
    if (t.game === 'pok') {
      if (g.reveal) h += g.reveal.map(r => { const p = t.players.find(x => x.id === r.id) || {}; return `<div class="sec center">${win(r.id) ? '👑 ' : ''}${esc(p.name || '')} • ${r.pts} แต้ม${r.pok ? ' • ป๊อก!' : ''}${r.deng > 1 ? ` • เด้ง ×${r.deng}` : ''}${p.out ? ' (ออก)' : ''}</div><div class="center">${r.hand.map(c => pokCard(c)).join('')}</div>`; }).join('');
      else if (g.mine) {
        h += `<div class="sec center">ไพ่ของคุณ • ${pokPtsC(g.mine)} แต้ม</div><div class="center">${g.mine.map(c => pokCard(c)).join('')}</div>`;
        const decided = mine && mine.done;
        h += playing && alive ? (decided ? `<div class="center" style="margin-top:8px;font-weight:700">⏳ รอคนอื่นตัดสินใจ...</div>`
          : `<div class="center" style="margin-top:10px;display:flex;gap:8px;justify-content:center"><button class="btn" data-pok="draw">🎴 จั่วเพิ่ม</button><button class="btn" data-pok="stay" style="background:#8a6fd1;border-bottom-color:#5d47a1">✋ อยู่</button></div>`) : '';
      } else h += `<div class="center" style="margin:12px">${t.players.map(() => pokCard('', true)).join('')}</div>`;
    } else if (t.game === 'react') {
      const ph = g.phase || 'wait', cls = ph === 'go' ? 'go' : ph === 'result' ? 'res' : 'wait';
      h += `<div class="center" style="font-size:13px">รอบที่ ${g.round || 1} • ใครชนะครบ ${g.target || 2} รอบก่อนเป็นผู้ชนะ</div><button class="pad ${cls}" data-press="1" ${playing && alive && !g.fs ? '' : 'disabled'}>${g.fs && ph === 'wait' ? '🚫 กดก่อนสัญญาณ ออกจากรอบนี้' : ph === 'go' ? '⚡ กด!!' : ph === 'result' ? '🏁' : '🔴 รอสัญญาณ... อย่าเพิ่งกด!'}</button><div class="ulog">${esc(g.msg || '')}</div>`;
    } else {
      h += `<div class="ulog">${esc(g.msg || '')}</div>`;
      if (g.reveal) h += `<div class="utable" style="font-size:40px;flex-wrap:wrap">${t.players.filter(p => g.reveal[p.id]).map(p => `<span style="text-align:center">${RPS_ICON[g.reveal[p.id]] || ''}<br><small style="font-size:12px">${esc(p.name)}</small></span>`).join('')}</div>`;
      else if (playing && alive) h += g.mine ? `<div class="center" style="font-size:44px;margin:10px">${RPS_ICON[g.mine] || ''}<br><span style="font-size:14px">เลือกแล้ว ⏳ รอคนอื่น</span></div>`
        : `<div class="colorpick">${['R', 'S', 'P'].map(c => `<button data-rps="${c}" style="background:#fff;font-size:34px;border-color:#8a6fd1">${RPS_ICON[c]}</button>`).join('')}</div><div class="center" style="font-size:12px">หิน ✊ • กรรไกร ✌️ • กระดาษ ✋ • รอบที่ ${g.round || 1}</div>`;
    }
    if (playing) {
      h += `<div class="center" style="font-weight:700;margin-top:6px">${alive ? '' : mine ? 'คุณออกจากเกมแล้ว' : '👀 กำลังดูเกม'} <span id="arcTimer"></span></div>`;
      if (alive) h += `<div class="center" style="margin-top:8px"><button class="btn small" data-arc="resign" style="background:#9aa0a6;border-bottom-color:#6f757b">🏳️ ยอมแพ้</button></div>`;
    } else {
      const won = mine && (t.winners || []).includes(myId);
      h += `<div class="banner">${mine ? (won ? ((t.winners || []).length > 1 ? '🤝 ' : '🎉 ') : '😢 ') : '🏁 '}${esc(t.msg)}</div>` + lobby();
    }
  }
  $('arcBody').innerHTML = h;
  updateArcTimer();
}
// ----- UNO -----
let arcMax = 3, unoWild = -1;
const cardLabel = c => (c[1] === 'S' ? '⛔' : c[1] === 'R' ? '🔄' : c[1] === 'D' ? '+2' : c[1] === 'F' ? '+4' : c[1] === 'W' ? '🌈' : c[1]);
const cardTag = (c, cls = '', attrs = '') => `<button class="uc c${c[0]} ${cls}" ${attrs}>${cardLabel(c)}</button>`;
const unoOk = (t, c) => c[0] === 'W' || c[0] === t.color || (t.top[0] !== 'W' && c[1] === t.top[1]);
const UCOL = { R: '#e04b4b', Y: '#f1c40f', G: '#3fae52', B: '#2b7bd6' };
// ----- คาสิโน: บาคาร่า / แบล็คแจ็ค (เล่นกับเจ้ามือ 1-3 คนต่อโต๊ะ) -----
let cMax = 1, cBet = 25, cSide = 'P';
const bjTotalC = h => { let t = 0, a = 0; for (const c of h) { const r = c.slice(1); if (r === 'A') { a++; t += 11; } else if (r !== '?') t += ['10', 'J', 'Q', 'K'].includes(r) ? 10 : +r; } while (t > 21 && a > 0) { t -= 10; a--; } return t; };
const cardsHTML = (h, hide) => (h || []).map(c => (c === '??' ? pokCard('', true) : pokCard(c))).join('');
function renderCasino() {
  const t = arcTable, coin = inv.coin || 0, bacc = t.game === 'bacc', bets = CASINO.bets;
  if (!bets.includes(cBet)) cBet = bets[1];
  const mine = t.players.find(p => p.id === myId), isHost = t.hostId === myId;
  let h = `<div class="center" style="font-size:13px;opacity:.75">🪙 เหรียญของคุณ ${coin}${t.practice ? ' • 🧪 โหมดซ้อม (ไม่ใช้เหรียญจริง)' : ''}</div>`;
  const rules = bacc ? 'ทายว่าฝั่งไหนจะได้แต้มใกล้ 9 ที่สุด: 🔵 ผู้เล่น จ่าย 1:1 • 🔴 เจ้ามือ จ่าย 0.95:1 • 🟢 เสมอ จ่าย 8:1 (เสมอคืนเดิมพันฝั่งผู้เล่น/เจ้ามือ)'
    : 'แต้มรวมใกล้ 21 ที่สุดโดยไม่เกิน ชนะเจ้ามือจ่าย 1:1 • แบล็คแจ็ค (21 ด้วยไพ่ 2 ใบ) จ่าย 3:2 • ดับเบิ้ลได้ตอนมีไพ่ 2 ใบ • เจ้ามือจั่วจนถึง 17';
  if (t.state === 'idle') {
    h += `<div class="sec">เลือกวิธีเล่น</div>`
      + `<button class="btn" data-arc="solo" style="width:100%">🎰 เล่นคนเดียวกับเจ้ามือ (ใช้เหรียญจริง)</button>`
      + `<button class="btn" data-arc="create" style="width:100%;margin-top:8px">👥 เปิดโต๊ะหลายคน (รอเพื่อน แล้วกดเริ่ม • เล่นได้หลายคน)</button>`
      + `<button class="btn" data-arc="practice" style="width:100%;margin-top:8px;background:#8a6fd1;border-bottom-color:#5d47a1">🧪 ซ้อมเล่นคนเดียว (ไม่ใช้เหรียญ)</button>`
      + `<p style="font-size:12px;opacity:.7">${rules}<br>เดิมพันต่อรอบ ${bets.join(' / ')} เหรียญ • เปิดโต๊ะหลายคน: คนแรก (เจ้าของโต๊ะ) กดเริ่มได้เมื่อมี ≥2 คน • ผลเป็นการสุ่ม เล่นเพื่อความสนุก ไม่ควรเล่นนานติดต่อกัน 🙏</p>`;
  } else if (t.state === 'waiting') {
    h += `<div class="banner" style="background:#e9e0ff">⏳ รอผู้เล่น • ตอนนี้ ${t.players.length} คน</div><div class="opps">${t.players.map(p => `<div class="opp">${p.id === t.hostId ? '👑 ' : ''}${esc(p.name)}</div>`).join('')}</div>`;
    if (isHost) h += (t.players.length >= 2 ? `<button class="btn" data-arc="startnow" style="width:100%;margin-top:8px">▶️ เริ่มเลย (${t.players.length} คน)</button>` : '<p class="center" style="font-size:13px">ให้เพื่อนเดินมาที่ตู้นี้แล้วกด "เข้าร่วม" (ต้องมีอย่างน้อย 2 คนถึงเริ่มได้)</p>')
      + `<button class="btn" data-arc="cancel" style="width:100%;margin-top:8px;background:#9aa0a6;border-bottom-color:#6f757b">ยกเลิกโต๊ะ</button>`;
    else if (mine) h += `<button class="btn" data-arc="leave" style="width:100%;margin-top:8px;background:#9aa0a6;border-bottom-color:#6f757b">ลุกจากโต๊ะ</button>`;
    else h += `<button class="btn" data-arc="join" style="width:100%;margin-top:8px" ${t.players.length >= t.max ? 'disabled' : ''}>🎰 เข้าร่วมโต๊ะ</button>`;
  } else {
    h += `<div class="opps">${t.players.map(p => `<div class="opp${t.cur === p.id ? ' cur' : ''}">${p.id === myId ? '⭐ ' : ''}${esc(p.name)}<br><small>${p.bet ? '🪙 ' + p.bet.amt + (bacc ? ' ' + ({ P: '🔵', B: '🔴', T: '🟢' })[p.bet.side] : '') : t.phase === 'bet' ? 'กำลังเลือก...' : 'ข้ามรอบ'}${t.phase === 'result' && p.bet ? `<br><b style="color:${p.net > 0 ? '#1e8f4e' : p.net < 0 ? '#c0392b' : '#666'}">${p.net > 0 ? '+' : ''}${p.net}</b>` : ''}</small></div>`).join('')}</div>`;
    h += `<div class="ulog">รอบที่ ${t.round}${t.msg ? ' • ' + esc(t.msg) : ''}</div>`;
    if (bacc && t.hands) {
      const wn = t.hands.win;
      h += `<div class="sec center">🔵 ผู้เล่น — ${t.hands.pt} แต้ม ${wn === 'P' ? '👑' : ''}</div><div class="center">${cardsHTML(t.hands.P)}</div><div class="sec center">🔴 เจ้ามือ — ${t.hands.bt} แต้ม ${wn === 'B' ? '👑' : ''}</div><div class="center">${cardsHTML(t.hands.B)}</div>`;
    }
    if (!bacc && t.dealer) {
      h += `<div class="sec center">เจ้ามือ${t.dealer.reveal ? ' — ' + t.dealer.total + ' แต้ม' : ''}</div><div class="center">${cardsHTML(t.dealer.hand)}</div>`;
      for (const p of t.players) if (p.hand) h += `<div class="sec center">${p.id === myId ? '⭐ ' : ''}${esc(p.name)} — ${bjTotalC(p.hand)} แต้ม ${({ bust: '💥 ไหม้', blackjack: '🂡 แบล็คแจ็ค!', stand: '', win: '🎉 ชนะ', lose: '😢 แพ้', push: '🤝 เสมอ' })[p.status] || ''}</div><div class="center">${cardsHTML(p.hand)}</div>`;
    }
    const iAmCur = t.phase === 'play' && t.cur === myId;
    if (t.phase === 'bet') {
      h += `<div class="center" style="font-weight:700;margin-top:6px">วางเดิมพัน <span id="arcTimer"></span></div>`;
      if (mine && !mine.bet) {
        if (bacc) h += `<div class="chips" style="justify-content:center">${[['P', '🔵 ผู้เล่น 1:1'], ['B', '🔴 เจ้ามือ 0.95:1'], ['T', '🟢 เสมอ 8:1']].map(([s, n]) => `<button class="chip${cSide === s ? ' sel' : ''}" data-cside="${s}">${n}</button>`).join('')}</div>`;
        h += `<div class="chips" style="justify-content:center">${bets.map(b => `<button class="chip${cBet === b ? ' sel' : ''}" data-cbet="${b}" ${!t.practice && coin < b ? 'disabled' : ''}>🪙 ${b}</button>`).join('')}</div>`
          + `<div class="center"><button class="btn" data-cplace="1" ${!t.practice && coin < cBet ? 'disabled' : ''}>✅ วางเดิมพัน ${cBet}${bacc ? ' ' + ({ P: '🔵', B: '🔴', T: '🟢' })[cSide] : ''}</button></div>`;
      } else if (mine) h += `<div class="center">วางเดิมพันแล้ว ⏳ รอผู้เล่นคนอื่น</div>`;
      else h += `<div class="center">👀 กำลังดูอยู่</div>` + (t.players.length < t.max && !t.practice ? `<div class="center"><button class="btn small" data-arc="join">เข้าร่วมโต๊ะ</button></div>` : '');
    } else if (t.phase === 'play') {
      h += `<div class="center" style="font-weight:700;margin-top:6px">${iAmCur ? '👉 ตาของคุณ' : '⏳ รอ ' + esc((t.players.find(p => p.id === t.cur) || {}).name || '') + '...'} <span id="arcTimer"></span></div>`;
      if (iAmCur) { const mp = t.players.find(p => p.id === myId); h += `<div class="center" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px"><button class="btn" data-arc="hit">🃏 จั่ว</button><button class="btn" data-arc="stand" style="background:#8a6fd1;border-bottom-color:#5d47a1">✋ อยู่</button>${mp.hand && mp.hand.length === 2 && !mp.bet.dbl ? `<button class="btn" data-arc="double" ${!t.practice && coin < mp.bet.amt ? 'disabled' : ''}>✖️2 ดับเบิ้ล</button>` : ''}</div>`; }
    } else if (t.phase === 'result') h += `<div class="center" style="font-size:13px;opacity:.75;margin-top:6px">รอบถัดไปเริ่มเร็วๆ นี้...</div>`;
    if (mine) h += `<div class="center" style="margin-top:10px"><button class="btn small muted" data-arc="leave">🚪 ลุกจากโต๊ะ</button></div>`;
  }
  $('arcBody').innerHTML = h;
  updateArcTimer();
}
function renderUno() {
  const t = arcTable, coin = inv.coin || 0;
  if (arcBet > coin) arcBet = [...BETS].reverse().find(b => b <= coin) || 0;
  if (arcBotBet > coin) arcBotBet = [...BOTBET.bets].reverse().find(b => b <= coin) || 0;
  const mine = t.players.find(p => p.id === myId), isHost = t.hostId === myId;
  let h = `<div class="center" style="font-size:13px;opacity:.75">🪙 เหรียญของคุณ ${coin}</div>`;
  const lobby = () => `<div class="sec">เลือกเดิมพัน (ต่อคน)</div><div class="chips">${BETS.map(b => `<button class="chip${b === arcBet ? ' sel' : ''}" data-bet="${b}" ${coin < b ? 'disabled' : ''}>${b ? '🪙 ' + b : 'ไม่เดิมพัน'}</button>`).join('')}</div>`
    + `<button class="btn" data-arc="create" style="width:100%">⚔️ สร้างห้อง UNO (รอเพื่อนมาเข้าร่วม แล้วกดเริ่ม)${arcBet ? ' • เดิมพัน ' + arcBet : ''}</button>`
    + `<div class="sec">🤖 ซ้อมกับบอท <small>(เล่น 1 ต่อ 1)</small></div><div class="chips">${BOTBET.bets.map(b => `<button class="chip${b === arcBotBet ? ' sel' : ''}" data-botbet="${b}" ${coin < b ? 'disabled' : ''}>${b ? '🪙 ' + b : 'ซ้อมฟรี'}</button>`).join('')}</div>`
    + `<button class="btn" data-arc="bot" style="width:100%;margin-top:8px;background:#8a6fd1;border-bottom-color:#5d47a1">🤖 เล่นกับบอท${arcBotBet ? ' (เดิมพัน ' + arcBotBet + ')' : ' (ซ้อม ไม่เดิมพัน)'}</button>`
    + `<p style="font-size:12px;opacity:.7">สร้างห้องแล้วรอเพื่อนเดินมาที่ตู้กด "เข้าร่วม" • คนแรก (เจ้าของห้อง) กดเริ่มได้เมื่อมีอย่างน้อย 2 คน (เล่นได้หลายคน) • คนแรกที่ไพ่หมดมือชนะ ได้เหรียญเดิมพันของทุกคน • ตาละ 30 วิ ออกกลางคัน = เสียเดิมพัน</p>`;
  if (t.state === 'idle') h += lobby();
  else if (t.state === 'waiting') {
    h += `<div class="banner" style="background:#e9e0ff">⏳ รอผู้เล่น • ตอนนี้ ${t.players.length} คน • เดิมพัน ${t.bet ? '🪙 ' + t.bet : 'ไม่มี'} ต่อคน</div>`
      + `<div class="opps">${t.players.map(p => `<div class="opp">${p.id === t.hostId ? '👑 ' : ''}${esc(p.name)}</div>`).join('')}</div>`;
    if (isHost) h += (t.players.length >= 2 ? `<button class="btn" data-arc="startnow" style="width:100%;margin-top:8px">▶️ เริ่มเลย (${t.players.length} คน)</button>` : '<p class="center" style="font-size:13px">ให้เพื่อนเดินมาที่ตู้นี้แล้วกด "เข้าร่วม" (ต้องมีอย่างน้อย 2 คน) เหรียญเดิมพันถูกกันไว้ ยกเลิกแล้วได้คืน</p>')
      + `<button class="btn" data-arc="cancel" style="width:100%;margin-top:8px;background:#9aa0a6;border-bottom-color:#6f757b">ยกเลิกห้อง</button>`;
    else if (mine) h += `<button class="btn" data-arc="leave" style="width:100%;margin-top:8px;background:#9aa0a6;border-bottom-color:#6f757b">ออกจากห้อง (ได้เหรียญคืน)</button>`;
    else h += `<button class="btn" data-arc="join" style="width:100%;margin-top:8px" ${coin < t.bet || t.players.length >= t.max ? 'disabled' : ''}>🃏 เข้าร่วม</button>${coin < t.bet ? '<p class="center" style="color:#c0392b">เหรียญไม่พอ</p>' : ''}`;
  } else {
    const playing = t.state === 'playing', myTurn = playing && t.cur === myId, drawn = t.drawn;
    h += `<div class="opps">${t.players.map(p => `<div class="opp${p.id === t.cur && playing ? ' cur' : ''}${p.out ? ' out' : ''}">${p.id === myId ? '⭐ ' : ''}${esc(p.name)}<br>🃏 ×${p.n}${p.out ? ' (ออก)' : ''}</div>`).join('')}</div>`;
    h += `<div class="utable"><span class="uc c${t.top[0]} big">${cardLabel(t.top)}</span><span style="text-align:center;font-size:12px">สีที่ต้องลง<br><span class="cdot" style="background:${UCOL[t.color] || '#999'}"></span><br>${t.dir === 1 ? '↻ ตามเข็ม' : '↺ ทวนเข็ม'}</span></div>`;
    h += `<div class="ulog">${esc(t.log || '')}</div>`;
    if (t.bet && !t.bot) h += `<div class="center" style="font-size:12px;opacity:.75">เดิมพัน 🪙 ${t.bet} ต่อคน • รางวัลรวม 🪙 ${t.bet * t.players.length}</div>`;
    if (unoWild >= 0 && myTurn) {
      h += `<div class="center" style="font-weight:700;margin-top:8px">เลือกสีที่ต้องการ</div><div class="colorpick">${'RYGB'.split('').map(c => `<button data-color="${c}" style="background:${UCOL[c]}" aria-label="${c}"></button>`).join('')}</div><div class="center"><button class="btn small" data-unocancel="1" style="background:#9aa0a6;border-bottom-color:#6f757b">ยกเลิก</button></div>`;
    } else if (t.hand && mine && !mine.out) {
      h += `<div class="hand">${t.hand.map((c, i) => { const ok = myTurn && (drawn < 0 || drawn === i) && unoOk(t, c); return cardTag(c, ok ? 'ok' : 'dim', `data-play="${i}" ${ok ? '' : 'disabled'}`); }).join('')}</div>`;
    }
    if (playing) {
      if (mine && !mine.out) {
        h += `<div class="center" style="font-weight:700">${myTurn ? '👉 ตาของคุณ' : '⏳ รอ ' + esc((t.players.find(p => p.id === t.cur) || {}).name || '') + '...'} <span id="arcTimer"></span></div>`;
        h += '<div class="center" style="margin-top:8px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
          + (myTurn && drawn < 0 ? `<button class="btn" data-arc="draw">🎴 จั่วไพ่</button>` : '')
          + (myTurn && drawn >= 0 ? `<button class="btn" data-arc="pass">⏭️ ผ่าน (ไม่ลง)</button>` : '')
          + `<button class="btn small" data-arc="resign" style="background:#9aa0a6;border-bottom-color:#6f757b">🏳️ ยอมแพ้</button></div>`;
      } else h += `<div class="center" style="font-weight:700">${mine && mine.out ? 'คุณออกจากเกมแล้ว' : '👀 กำลังดูเกม'} <span id="arcTimer"></span></div>`;
    } else {
      const won = t.winner && mine && t.winner === mine.name;
      h += `<div class="banner">${mine ? (won ? '🎉 ' : '😢 ') : '🏁 '}${esc(t.msg)}</div>` + lobby();
    }
  }
  $('arcBody').innerHTML = h;
  updateArcTimer();
}
function boardHTML(t, enabled) {
  const win = new Set(t.line || []);
  return '<div class="board">' + t.board.map((v, i) => `<button class="cell${v ? ' ' + v.toLowerCase() : ''}${win.has(i) ? ' win' : ''}" data-cell="${i}" ${enabled && !v ? '' : 'disabled'}>${v}</button>`).join('') + '</div>';
}
function renderArcade() {
  const t = arcTable; if (!t) return;
  $('arcTitle').textContent = '🎮 ตู้เกม ' + (GAME_TITLES[t.game] || '');
  if (t.game === 'uno') return renderUno();
  if (PARTY_GAMES.has(t.game)) return renderParty();
  if (t.game === 'bacc' || t.game === 'bj') return renderCasino();
  const coin = inv.coin || 0;
  if (arcBet > coin) arcBet = [...BETS].reverse().find(b => b <= coin) || 0;
  if (arcBotBet > coin) arcBotBet = [...BOTBET.bets].reverse().find(b => b <= coin) || 0;
  const isHost = t.host && t.host.id === myId, player = t.xId === myId || t.oId === myId;
  const mySide = t.xId === myId ? 'X' : t.oId === myId ? 'O' : null;
  let h = `<div class="center" style="font-size:13px;opacity:.75">🪙 เหรียญของคุณ ${coin}</div>`;
  const lobby = () => `<div class="sec">เลือกเดิมพัน (ต่อฝ่าย)</div><div class="chips">${BETS.map(b => `<button class="chip${b === arcBet ? ' sel' : ''}" data-bet="${b}" ${coin < b ? 'disabled' : ''}>${b ? '🪙 ' + b : 'ไม่เดิมพัน'}</button>`).join('')}</div>`
    + `<button class="btn" data-arc="create" style="width:100%">⚔️ สร้างห้อง รอคู่แข่ง${arcBet ? ' (เดิมพัน ' + arcBet + ')' : ''}</button>`
    + `<div class="sec">🤖 ซ้อมกับบอท <small>(ซ้อมฟรี ไม่มีเดิมพัน)</small></div><div class="chips">${BOTBET.bets.map(b => `<button class="chip${b === arcBotBet ? ' sel' : ''}" data-botbet="${b}" ${coin < b ? 'disabled' : ''}>${b ? '🪙 ' + b : 'ซ้อมฟรี'}</button>`).join('')}</div>`
    + `<button class="btn" data-arc="bot" style="width:100%;margin-top:8px;background:#8a6fd1;border-bottom-color:#5d47a1">🤖 เล่นคนเดียวกับบอท${arcBotBet ? ' (เดิมพัน ' + arcBotBet + ')' : ' (ซ้อม ไม่เดิมพัน)'}</button>`
    + `<p style="font-size:12px;opacity:.7">${DUEL_RULES[t.game] || ''} • ผู้ชนะได้เหรียญเดิมพันของทั้งสองฝ่าย (หักค่าบริการตู้เกม 5%) เสมอคืนเหรียญ ออกจากเกมกลางคันถือว่าแพ้</p>`;
  if (t.state === 'idle') h += lobby();
  else if (t.state === 'waiting') {
    h += isHost
      ? `<div class="banner">⏳ รอคู่แข่ง... เดิมพัน ${t.bet ? '🪙 ' + t.bet : 'ไม่มี'}</div><p class="center" style="font-size:13px">ให้เพื่อนเดินมาที่ตู้นี้แล้วกด "รับคำท้า" เหรียญเดิมพันถูกกันไว้ ยกเลิกแล้วได้คืน</p><button class="btn" data-arc="cancel" style="width:100%">ยกเลิกห้อง</button>`
      : `<div class="banner">${esc(t.host.name)} ท้าเล่น ${esc(GAME_TITLES[t.game] || '')}</div><div class="center">เดิมพัน ${t.bet ? '🪙 ' + t.bet : 'ไม่มี (เล่นสนุก)'}</div><button class="btn" data-arc="join" style="width:100%;margin-top:10px" ${coin < t.bet ? 'disabled' : ''}>⚔️ รับคำท้า</button>${coin < t.bet ? '<p class="center" style="color:#c0392b">เหรียญไม่พอ</p>' : ''}`;
  } else {
    const playing = t.state === 'playing', xo = t.game === 'xo', c4 = t.game === 'c4';
    const turn = xo ? t.turn : c4 && t.g ? t.g.turn : null, myTurn = playing && turn && mySide === turn;
    const sc = t.g && t.g.score ? t.g.score : null, sym = { xo: ['X', 'O'], c4: ['🔴', '🟡'] }[t.game] || ['🅰️', '🅱️'];
    h += `<div class="vs"><span class="${playing && turn === 'X' ? 'turn' : ''}"><span style="color:#e04b4b;border:0;background:none;padding:0">${sym[0]}</span> ${esc(t.xName)}${sc ? ` <b>${sc.X}</b>` : ''}</span><span class="${playing && turn === 'O' ? 'turn' : ''}"><span style="color:#2b7bd6;border:0;background:none;padding:0">${sym[1]}</span> ${esc(t.oName)}${sc ? ` <b>${sc.O}</b>` : ''}</span></div>`;
    h += `<div class="center" style="font-size:13px;opacity:.75;margin-top:4px">${t.bot ? (t.bet ? `เล่นกับบอท • เดิมพัน 🪙 ${t.bet}` : 'ซ้อมกับบอท') : t.bet ? `เดิมพัน 🪙 ${t.bet} ต่อฝ่าย • รางวัล 🪙 ${t.bet * 2}` : 'เล่นสนุก ไม่มีเดิมพัน'}</div>`;
    h += xo ? boardHTML(t, myTurn) : duelBody(t, mySide, player, myTurn);
    if (playing) {
      h += turn ? `<div class="center" style="font-weight:700">${player ? (myTurn ? '👉 ตาของคุณ' : '⏳ รอ' + esc(turn === 'X' ? t.xName : t.oName) + '...') : '👀 กำลังดูเกม'} <span id="arcTimer"></span></div>`
        : `<div class="center" style="font-weight:700">${player ? '' : '👀 กำลังดูเกม'} <span id="arcTimer"></span></div>`;
      if (player) h += `<button class="btn small" data-arc="resign" style="margin-top:8px;background:#9aa0a6;border-bottom-color:#6f757b">🏳️ ยอมแพ้</button>`;
    } else {
      const won = t.winner !== 'draw' && t.winner === mySide;
      h += `<div class="banner">${player ? (t.winner === 'draw' ? '🤝 ' : won ? '🎉 ' : '😢 ') : '🏁 '}${esc(t.msg)}</div>` + lobby();
    }
  }
  $('arcBody').innerHTML = h;
  updateArcTimer();
}
const DUEL_RULES = {
  xo: 'เรียง 3 ตัวติดกันให้ได้ก่อน ตาละ 30 วินาที',
  c4: 'หยอดเหรียญลงคอลัมน์ เรียง 4 ตัวติดกันให้ได้ก่อน ตาละ 30 วินาที',
};
const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
const pokCard = (c, back) => back ? '<span class="pcard back">🂠</span>' : `<span class="pcard ${c[0] === 'H' || c[0] === 'D' ? 'red' : ''}">${c.slice(1)}<small>${SUIT[c[0]]}</small></span>`;
function duelBody(t, mySide, player, myTurn) { // ส่วนกลางหน้าเกมของ Connect 4 (XO ใช้ boardHTML)
  const g = t.g || {}, playing = t.state === 'playing';
  if (t.game === 'c4') {
    const win = new Set(g.line || []);
    let cells = '';
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
      const v = (g.board || [])[r * 7 + c] || '', full = (g.board || [])[c];
      cells += `<button class="c4c ${v ? 'p' + v : ''}${win.has(r * 7 + c) ? ' win' : ''}${r * 7 + c === g.last ? ' last' : ''}" data-col="${c}" ${myTurn && !full ? '' : 'disabled'}></button>`;
    }
    return `<div class="c4">${cells}</div>`;
  }
  return '';
}
function updateArcTimer() {
  const el = $('arcTimer'); if (!el || !arcTable || arcTable.state !== 'playing') return;
  if (!arcTable.deadline) { el.textContent = ''; return; }
  el.textContent = '⏱ ' + Math.max(0, Math.ceil((arcTable.deadline - (Date.now() + timeOffset)) / 1000)) + ' วิ';
}
setInterval(updateArcTimer, 250);
$('arcBody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !arcTable) return;
  if (b.dataset.bet !== undefined) { arcBet = +b.dataset.bet; renderArcade(); return; }
  if (b.dataset.botbet !== undefined) { arcBotBet = +b.dataset.botbet; renderArcade(); return; }
  if (b.dataset.max !== undefined) { arcMax = +b.dataset.max; renderArcade(); return; }
  if (b.dataset.cell !== undefined) { send({ t: 'arc', a: 'move', id: arcTable.id, i: +b.dataset.cell }); return; }
  if (b.dataset.col !== undefined) { send({ t: 'arc', a: 'move', id: arcTable.id, col: +b.dataset.col }); playSfx('click'); return; }
  if (b.dataset.rps) { send({ t: 'arc', a: 'move', id: arcTable.id, c: b.dataset.rps }); playSfx('click'); return; }
  if (b.dataset.pok) { send({ t: 'arc', a: 'move', id: arcTable.id, c: b.dataset.pok }); playSfx('click'); return; }
  if (b.dataset.play !== undefined) {
    const i = +b.dataset.play, c = arcTable.hand && arcTable.hand[i]; if (!c) return;
    if (c[0] === 'W') { unoWild = i; renderArcade(); } else send({ t: 'arc', a: 'play', id: arcTable.id, i });
    return;
  }
  if (b.dataset.color) { const i = unoWild; unoWild = -1; send({ t: 'arc', a: 'play', id: arcTable.id, i, color: b.dataset.color }); return; }
  if (b.dataset.unocancel) { unoWild = -1; renderArcade(); return; }
  if (b.dataset.cmax !== undefined) { cMax = +b.dataset.cmax; renderArcade(); return; }
  if (b.dataset.cbet !== undefined) { cBet = +b.dataset.cbet; renderArcade(); return; }
  if (b.dataset.cside) { cSide = b.dataset.cside; renderArcade(); return; }
  if (b.dataset.cplace) { send({ t: 'arc', a: 'bet', id: arcTable.id, side: cSide, amt: cBet }); playSfx('coin'); return; }
  if (b.dataset.arc) send({ t: 'arc', a: b.dataset.arc, id: arcTable.id, bet: b.dataset.arc === 'bot' ? arcBotBet : arcBet, max: (arcTable.game === 'bacc' || arcTable.game === 'bj') ? cMax : arcMax });
});
// ปุ่ม "กด" ของเกมใครกดเร็วกว่า ใช้ pointerdown เพื่อให้ตอบสนองทันที (ไม่รอปล่อยนิ้ว)
$('arcBody').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-press]'); if (!b || !arcTable || b.disabled) return;
  e.preventDefault(); send({ t: 'arc', a: 'move', id: arcTable.id });
});
$('arcClose').onclick = closeArcade;
$('arcade').addEventListener('pointerdown', e => { if (e.target === $('arcade')) closeArcade(); });

// ---------- เมนูคนในแมพ (Dashboard รายชื่อ + ปิดเสียงรายคน/ทั้งหมด) ----------
const peopleShown = () => !$('people').classList.contains('hidden');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let peopleSig = '';
function openPeople() { $('people').classList.remove('hidden'); renderPeople(true); }
function closePeople() { $('people').classList.add('hidden'); }
// ปิดเสียงทุกคนอยู่ (และไม่ได้เปิดเสียงใครเป็นข้อยกเว้น) = ไม่ได้ยินใครเลย → บอกเซิร์ฟเวอร์ให้ติดป้ายที่ตัวละคร เพื่อนจะได้รู้
const isDeaf = () => mute.all && !Object.values(mute.names).includes(false);
function syncDeaf() { if (!me) return; const d = isDeaf(); if (d !== !!me.deaf) { me.deaf = d; send({ t: 'deaf', on: d }); } }
function setSpkUi() { const b = $('spkBtn'); if (!b) return; b.classList.toggle('off', !!mute.all); b.textContent = mute.all ? '🔇' : '🔊'; b.title = mute.all ? 'ลำโพง: ปิดอยู่ (กดเพื่อเปิดเสียงเพื่อน)' : 'ลำโพง: เปิดอยู่ (กดเพื่อปิดเสียงเพื่อนทั้งหมด)'; }
function applyMute() { saveMute(); syncDeaf(); setSpkUi(); lastLevel = 0; updateSpeaking(performance.now() + 1000); updateOnline(); renderPeople(true); }
function renderPeople(force) {
  if (!peopleShown() || !me) return;
  const list = [...players.values()].sort((a, b) => (a === me ? -1 : b === me ? 1 : a.name.localeCompare(b.name)));
  const sig = JSON.stringify([mute, callWith, callPend, callIn, list.map(p => [p.id, p.name, p.color, p.voice, p.deaf, p.status])]);
  if (force || sig !== peopleSig) {
    peopleSig = sig;
    const others = list.filter(p => p !== me), talking = others.filter(p => p.voice).length, off = others.filter(isMuted).length;
    let h = `<div class="row"><span><b>🔊 เสียงเพื่อน</b><br><small>เปิดไมค์ ${talking} คน • ปิดเสียงไว้ ${off}/${others.length} คน</small></span>`
      + `<small style="opacity:.7">ปิด/เปิดทั้งหมดที่ปุ่ม ${mute.all ? '🔇' : '🔊'} ข้างไมค์</small></div>`;
    for (const p of list) {
      const m = p !== me && isMuted(p);
      h += `<div class="row prow" data-id="${p.id}"><span><span class="dot" style="background:${esc(p.color)}"></span> <b>${esc(p.name)}</b>${p === me ? ' (คุณ)' : ''} ${p.voice ? '🎙️' : ''}${p.deaf ? ' 🔇' : ''}<span class="spk"></span>${p.status ? `<br><small style="opacity:.8">💭 ${esc(p.status)}</small>` : ''}</span>`
        + (p === me ? '' : `<span><button class="btn small${callWith === p.id || callPend === p.id ? ' on' : ''}" data-call="${p.id}" title="โทรส่วนตัว: ต้องให้อีกฝ่ายรับสายก่อน">${callWith === p.id ? '📵 วางสาย' : callPend === p.id ? '⏳ ยกเลิก' : callIn === p.id ? '📞 รับสาย' : '📞 โทร'}</button> <button class="btn small" data-trade="${p.id}" title="ชวนเทรดของ (ต้องอยู่ใกล้กัน ${TRADE.range} ช่อง)">🤝 เทรด</button> <button class="btn small${m ? ' muted' : ''}" data-mute="${p.id}">${m ? '🔇 เปิดเสียง' : '🔊 ปิดเสียง'}</button></span>`) + '</div>';
    }
    $('peopleBody').innerHTML = h;
  }
  $('peopleBody').querySelectorAll('.prow').forEach(r => { // ไฟแสดงว่าใครกำลังพูด (อัปเดตโดยไม่วาดรายการใหม่ ปุ่มจะได้ไม่กระตุก)
    const p = players.get(+r.dataset.id), talk = !!(p && p.speaking);
    r.classList.toggle('talk', talk); r.querySelector('.spk').textContent = talk ? '🟢 กำลังพูด' : '';
  });
}
$('peopleBody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.trade) {
    const q = players.get(+b.dataset.trade); if (!q) return;
    if (Math.hypot(q.x - me.x, q.y - me.y) > TRADE.range * TS) { toast(`ต้องเดินเข้าไปใกล้ ${q.name} ก่อน (ไม่เกิน ${TRADE.range} ช่อง)`); return; }
    closePeople(); send({ t: 'trade', a: 'req', to: q.id }); return;
  }
  if (b.dataset.call) { const id = +b.dataset.call; if (callIn === id) acceptCall(); else if (callWith === id) endCall(); else if (callPend === id) cancelCall(); else startCall(id); return; }
  const p = players.get(+b.dataset.mute); if (!p) return;
  const key = p.name.toLowerCase(), now = isMuted(p);
  mute.names[key] = !now;
  if (mute.names[key] === mute.all) delete mute.names[key];
  applyMute();
});
$('spkBtn').onclick = () => { mute.all = !mute.all; mute.names = {}; applyMute(); toast(mute.all ? '🔇 ปิดเสียงเพื่อนทั้งหมดแล้ว (เพื่อนจะเห็นไอคอน 🔇 ที่ตัวคุณ)' : '🔊 เปิดเสียงเพื่อนแล้ว'); };
setSpkUi();
// ---------- สถานะของฉัน ----------
const STATUS_PRESETS = ['🟢 ว่าง คุยได้', '🌾 กำลังทำฟาร์ม', '🎣 กำลังตกปลา', '🪓 กำลังตัดไม้', '🍜 พักกินข้าว', '🎮 อยู่ที่ตู้เกม', '💤 ไม่อยู่หน้าจอ', '🙏 มือใหม่ ช่วยหน่อย'];
const statusShown = () => !$('status').classList.contains('hidden');
function openStatus() { $('statusChips').innerHTML = STATUS_PRESETS.map((t, i) => `<button class="chip" data-sp="${i}">${esc(t)}</button>`).join(''); $('statusIn').value = (me && me.status) || ''; $('status').classList.remove('hidden'); setTimeout(() => $('statusIn').focus(), 50); }
function closeStatus() { $('status').classList.add('hidden'); $('statusIn').blur(); }
function saveStatus(text) { send({ t: 'status', text }); closeStatus(); toast(text ? '💭 ตั้งสถานะแล้ว' : 'ล้างสถานะแล้ว'); }
$('myStatusBtn').onclick = () => (statusShown() ? closeStatus() : openStatus());
$('statusClose').onclick = closeStatus;
// ---------- 🐞 แจ้งบั๊ก (ข้อความ + ภาพไม่เกิน 1MB ส่งผ่าน POST /api/bug) ----------
const BUG_IMG_MAX = 1024 * 1024;
let bugFile = null, bugPrevUrl = '', bugBusy = false;
const bugShown = () => !$('bug').classList.contains('hidden');
function bugSay(t, cls) { const el = $('bugMsg'); el.textContent = t || ''; el.className = cls || ''; }
function bugClearImg() {
  bugFile = null; $('bugFile').value = '';
  if (bugPrevUrl) { URL.revokeObjectURL(bugPrevUrl); bugPrevUrl = ''; }
  $('bugPrev').classList.add('hidden'); $('bugPrev').removeAttribute('src'); $('bugImgClear').classList.add('hidden');
  $('bugFileInfo').textContent = 'PNG / JPG / WEBP / GIF ไม่เกิน 1MB';
}
function openBug() { bugSay(''); $('bug').classList.remove('hidden'); if (!isTouch) $('bugText').focus(); }
function closeBug() { $('bug').classList.add('hidden'); $('bugText').blur(); }
$('bugBtn').onclick = () => (bugShown() ? closeBug() : openBug());
$('bugClose').onclick = closeBug;
$('bug').addEventListener('pointerdown', e => { if (e.target === $('bug')) closeBug(); });
$('bugText').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') closeBug(); }); // พิมพ์ได้โดยไม่ไปกดปุ่มลัดของเกม
$('bugImgClear').onclick = () => { bugClearImg(); bugSay(''); };
$('bugFile').onchange = () => {
  const f = $('bugFile').files[0];
  bugClearImg();
  if (!f) return;
  if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return bugSay('รองรับเฉพาะภาพ PNG, JPG, WEBP, GIF', 'err');
  if (f.size > BUG_IMG_MAX) return bugSay(`ภาพใหญ่เกินไป (${(f.size / 1048576).toFixed(2)} MB) ต้องไม่เกิน 1 MB`, 'err');
  bugFile = f; bugPrevUrl = URL.createObjectURL(f);
  $('bugPrev').src = bugPrevUrl; $('bugPrev').classList.remove('hidden'); $('bugImgClear').classList.remove('hidden');
  $('bugFileInfo').textContent = `${f.name.slice(0, 24)} (${f.size < 1024 ? f.size + ' B' : (f.size / 1024).toFixed(0) + ' KB'})`;
  bugSay('');
};
$('bugSend').onclick = async () => {
  if (bugBusy) return;
  const text = $('bugText').value.trim();
  if (text.length < 5) return bugSay('อธิบายปัญหาอย่างน้อย 5 ตัวอักษร', 'err');
  bugBusy = true; $('bugSend').disabled = true; bugSay('กำลังส่ง…');
  try {
    let img = '';
    if (bugFile) img = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error('อ่านไฟล์ภาพไม่ได้')); r.readAsDataURL(bugFile); });
    const res = await fetch('/api/bug', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, img, name: me ? me.name : '', room: roomName }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw new Error(j.err || 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง');
    $('bugText').value = ''; bugClearImg(); closeBug(); toast('ส่งรายงานแล้ว ขอบคุณที่ช่วยแจ้งบั๊ก 🐞');
  } catch (e) { bugSay(e.message || 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง', 'err'); }
  bugBusy = false; $('bugSend').disabled = false;
};
$('statusSave').onclick = () => saveStatus($('statusIn').value);
$('statusClear').onclick = () => saveStatus('');
$('statusChips').addEventListener('click', e => { const b = e.target.closest('[data-sp]'); if (b) saveStatus(STATUS_PRESETS[+b.dataset.sp]); });
$('statusIn').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') saveStatus($('statusIn').value); else if (e.key === 'Escape') closeStatus(); });
$('status').addEventListener('pointerdown', e => { if (e.target === $('status')) closeStatus(); });
$('online').onclick = () => (peopleShown() ? closePeople() : openPeople());
$('peopleClose').onclick = closePeople;
$('people').addEventListener('pointerdown', e => { if (e.target === $('people')) closePeople(); });

// ---------- Arcade Hub: แต้มตู้เกม + Leaderboard + ร้านรางวัล ----------
const hubShown = () => !$('archub').classList.contains('hidden');
function openHub() { $('archub').classList.remove('hidden'); send({ t: 'lb' }); renderHub(); }
function closeHub() { $('archub').classList.add('hidden'); }
function renderHub() {
  const el = $('hubBody'), esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), medal = ['🥇', '🥈', '🥉'];
  let h = `<div class="banner" style="background:#fff3cf">🎮 แต้มตู้เกมของคุณ: <b>${arcSt.pts}</b> • สะสมตลอดกาล ${arcSt.total} • สัปดาห์นี้ ${arcSt.wk}</div>`;
  h += `<div class="chips" style="margin:8px 0"><button class="chip${hubTab === 'rank' ? ' sel' : ''}" data-htab="rank">🏆 อันดับ</button><button class="chip${hubTab === 'shop' ? ' sel' : ''}" data-htab="shop">🎁 ร้านรางวัล</button></div>`;
  if (hubTab === 'shop') {
    h += '<p style="opacity:.75;text-align:center;margin:18px 0">🎁 ร้านแลกของรางวัล (ของโชว์เฉพาะแต้ม) กำลังมา เร็วๆ นี้!</p>';
  } else {
    const list = (arr, unit) => (arr && arr.length) ? arr.map((x, i) => `<div class="qrow"><span>${medal[i] || ('#' + (i + 1))} <b>${esc(x.name)}</b>${x.name === (me && me.name) ? ' <small>(คุณ)</small>' : ''}</span><span><b>${x[unit]}</b> แต้ม</span></div>`).join('') : '<p style="opacity:.7">ยังไม่มีใครเล่น</p>';
    h += '<div class="sec">🏆 สะสมตลอดกาล (Top 10)</div>' + list(lbSt.total, 'total');
    h += '<div class="sec">📅 สัปดาห์นี้ (Top 10)</div>' + list(lbSt.wk, 'wk');
    h += '<p style="font-size:12px;opacity:.65;margin-top:10px">ได้แต้มจากการเล่นตู้เกมกับคนจริง (เล่นจบ +2 • ชนะ +5) ไม่ได้จากบอท/คาสิโน • อันดับสัปดาห์รีเซ็ตทุก 7 วัน</p>';
  }
  el.innerHTML = h;
  el.querySelectorAll('[data-htab]').forEach(b => b.onclick = () => { hubTab = b.dataset.htab; renderHub(); });
}
$('hubClose').onclick = closeHub;
$('archub').addEventListener('pointerdown', e => { if (e.target === $('archub')) closeHub(); });
setInterval(() => renderPeople(false), 250);

// ---------- เทรดของกับผู้เล่นอื่น (ของเท่านั้น ไม่มีเหรียญ มูลค่าฝั่งละไม่เกิน TRADE.maxValue ต่อรอบ) ----------
const tradeShown = () => !$('trade').classList.contains('hidden');
function closeTradeUi() { tradeSt = null; tradeReq = null; $('trade').classList.add('hidden'); }
function onTrade(m) {
  if (m.ev === 'req') { tradeReq = { id: m.from.id, name: m.from.name, wait: false }; tradeSt = null; $('trade').classList.remove('hidden'); playSfx('click'); renderTrade(); }
  else if (m.ev === 'wait') { tradeReq = { name: m.to, wait: true }; tradeSt = null; $('trade').classList.remove('hidden'); renderTrade(); }
  else if (m.ev === 'state') { tradeReq = null; tradeSt = m; $('trade').classList.remove('hidden'); renderTrade(); }
  else if (m.ev === 'closed') { closeTradeUi(); toast(m.why || 'ยกเลิกการเทรด'); }
  else if (m.ev === 'done') { closeTradeUi(); toast(`🤝 เทรดกับ ${m.with} สำเร็จ!`); playSfx('collect'); }
}
function renderTrade() {
  const el = $('tradeBody');
  if (!tradeSt) {
    if (!tradeReq) return;
    el.innerHTML = tradeReq.wait
      ? `<p class="center">⏳ รอ <b>${esc(tradeReq.name)}</b> ตอบรับคำขอเทรด...</p><div class="center"><button class="btn small muted" data-tr="cancel">ยกเลิก</button></div>`
      : `<p class="center">🤝 <b>${esc(tradeReq.name)}</b> ขอเทรดของกับคุณ</p><div class="center"><button class="btn" data-tr="accept">ตอบรับ</button> <button class="btn small muted" data-tr="decline">ปฏิเสธ</button></div>`;
    return;
  }
  const s = tradeSt, itemRow = (k, q) => { const i = itemInfo(k); return i ? `<div class="row"><span>${i.emoji} ${i.name} ×${q}</span><b>🪙${tradeValue(k) * q}</b></div>` : ''; };
  const mine = Object.keys(s.me.offer).map(k => itemRow(k, s.me.offer[k])).join('') || '<small style="opacity:.6">ยังไม่ได้ใส่ของ</small>';
  const theirs = Object.keys(s.other.offer).map(k => itemRow(k, s.other.offer[k])).join('') || '<small style="opacity:.6">ยังไม่ได้ใส่ของ</small>';
  const mineKeys = Object.keys(inv).filter(k => isTradable(k) && inv[k] > 0);
  let h = `<div class="sec">📤 ของที่คุณให้ <small>(มูลค่า 🪙${s.me.value}/${s.max})</small> ${s.me.ok ? '✅ ยืนยันแล้ว' : ''}</div>${mine}`
    + `<div class="sec">📥 ของที่ ${esc(s.other.name)} ให้ <small>(มูลค่า 🪙${s.other.value}/${s.max})</small> ${s.other.ok ? '✅ ยืนยันแล้ว' : ''}</div>${theirs}`
    + `<div class="sec">🎒 เลือกของจากกระเป๋า (ของที่ขายได้เท่านั้น ไม่มีเหรียญ)</div>`;
  h += mineKeys.length ? mineKeys.map(k => {
    const i = itemInfo(k), on = s.me.offer[k] || 0;
    return `<div class="row"><span>${i.emoji} ${i.name} <small>มี ${inv[k]} • 🪙${tradeValue(k)}/ชิ้น</small></span><span><button class="btn small muted" data-off="${k}" data-q="${Math.max(0, on - 1)}" ${on ? '' : 'disabled'}>−</button> <b>${on}</b> <button class="btn small" data-off="${k}" data-q="${on + 1}" ${on >= inv[k] ? 'disabled' : ''}>+</button> <button class="btn small muted" data-off="${k}" data-q="${Math.min(inv[k], on + 10)}" ${on >= inv[k] ? 'disabled' : ''}>+10</button></span></div>`;
  }).join('') : '<p style="opacity:.7">ไม่มีของที่เทรดได้ในกระเป๋า</p>';
  h += `<div class="center" style="margin-top:10px"><button class="btn${s.me.ok ? ' muted' : ''}" data-tr="ok" data-on="${s.me.ok ? 0 : 1}">${s.me.ok ? 'ยกเลิกการยืนยัน' : '✅ ยืนยันการเทรด'}</button> <button class="btn small muted" data-tr="cancel">ยกเลิกเทรด</button></div>`
    + `<p style="font-size:12px;opacity:.65">ทั้งสองฝ่ายต้องกดยืนยัน • แก้ของเมื่อไรการยืนยันจะถูกรีเซ็ต • อยู่ห่างกันเกิน ${TRADE.range} ช่องการเทรดจะถูกยกเลิก</p>`;
  const top = el.scrollTop; el.innerHTML = h; el.scrollTop = top;
}
$('trade').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.off) send({ t: 'trade', a: 'offer', item: b.dataset.off, qty: +b.dataset.q });
  else if (b.dataset.tr === 'ok') send({ t: 'trade', a: 'ok', on: b.dataset.on === '1' });
  else if (b.dataset.tr) send({ t: 'trade', a: b.dataset.tr });
  if (b.dataset.tr === 'accept') playSfx('click');
});
$('tradeClose').onclick = () => { if (tradeSt || tradeReq) send({ t: 'trade', a: tradeReq && !tradeReq.wait && !tradeSt ? 'decline' : 'cancel' }); };

// ---------- โรงหนังกลางแปลง: ทุกคนในโรงดูจอเดียวกัน (ซิงก์เวลาจากเซิร์ฟเวอร์) เสียงมาจากหน้าต่างหนังของคนที่เข้าไปดูเท่านั้น ----------
const cinemaShown = () => !$('cinema').classList.contains('hidden');
const movieOf = id => MOVIES.find(x => x.id === id);
function setCin(st) { cin = st; if (st) cin.skew = Date.now() - st.now; }
// ตำแหน่งที่ควรอยู่ตอนนี้ (วินาที) คำนวณจากสถานะที่เซิร์ฟเวอร์ส่งมา + เวลาที่ผ่านไป
const cinPos = () => (cin && cin.movie ? Math.max(0, cin.pos + (cin.playing ? (Date.now() - cin.skew - cin.now) / 1000 : 0)) : 0);
function onCin(m) {
  const wasMovie = cin && cin.movie;
  if (m.st) setCin(m.st);
  if (m.watch) cinWatching = true;
  if (cinWatching && (!cin.movie || !cin.viewers.includes(myId))) { stopCinFrame(); if (!cin.movie && wasMovie) toast('🎬 หนังจบแล้ว ขอบคุณที่มาดู'); }
  if (m.open || m.watch) openCinema(); else if (cinemaShown()) renderCinema();
  if (m.sync && cinWatching && m.by !== myId) { applyCinRemote(); const who = players.get(m.by); if (who) toast(`🎬 ${who.name} ${cin.playing ? 'กดเล่น / เลื่อน' : 'กดหยุด'}`); }
}
// ---- ตัวเล่น YouTube (IFrame API) ซิงก์กับทุกคนในโรง: ใครกดเล่น/หยุด/เลื่อน จะส่งให้เซิร์ฟเวอร์แล้วทุกคนทำตาม ----
let ytApi = null, ytPlayer = null, ytReady = false, cinApplyUntil = 0, cinLastT = 0, cinPoll = null;
function loadYtApi() {
  if (ytApi) return ytApi;
  ytApi = new Promise(res => {
    if (window.YT && window.YT.Player) return res();
    window.onYouTubeIframeAPIReady = res;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
  });
  return ytApi;
}
const cinApplying = () => performance.now() < cinApplyUntil;
function applyCinRemote(force) {
  if (!ytPlayer || !ytReady || !cin || !cin.movie) return;
  try {
    const target = cinPos(), t = ytPlayer.getCurrentTime(), st = ytPlayer.getPlayerState();
    cinApplyUntil = performance.now() + 2200;
    if (force || Math.abs(t - target) > 1.5) ytPlayer.seekTo(target, true);
    if (cin.playing && st !== 1 && st !== 3) ytPlayer.playVideo();
    if (!cin.playing && st === 1) ytPlayer.pauseVideo();
    cinLastT = target;
  } catch (e) { /* ตัวเล่นยังไม่พร้อม */ }
}
function sendCinSync(playing) { try { send({ t: 'cin', a: 'sync', playing, pos: ytPlayer.getCurrentTime() }); } catch (e) { /* ignore */ } }
function startCinPlayer(mv) {
  const fr = $('cinFrame'); fr.innerHTML = '<div id="cinPlayer"></div>'; ytReady = false;
  loadYtApi().then(() => {
    if (!cinWatching || fr.dataset.key !== mv.key) return;
    ytPlayer = new YT.Player('cinPlayer', {
      host: 'https://www.youtube-nocookie.com', videoId: mv.yt, width: '100%', height: '100%',
      playerVars: { autoplay: 1, start: Math.floor(cinPos()), rel: 0, playsinline: 1, modestbranding: 1 },
      events: {
        onReady: () => { ytReady = true; applyCinRemote(true); },
        onStateChange: e => {
          if (!cinWatching) return;
          if (e.data === 0) { send({ t: 'cin', a: 'end' }); return; }
          if (cinApplying() || (e.data !== 1 && e.data !== 2)) return;
          sendCinSync(e.data === 1); cinLastT = ytPlayer.getCurrentTime();
        },
      },
    });
  });
  clearInterval(cinPoll); cinLastT = 0;
  cinPoll = setInterval(() => { // ตรวจการเลื่อนเวลา (กดบนแถบเวลา) และดึงให้ตรงกับทุกคนถ้าเพี้ยน
    if (!ytReady || !cinWatching) return;
    try {
      const t = ytPlayer.getCurrentTime(), st = ytPlayer.getPlayerState();
      if (!cinApplying()) {
        const expectLocal = cinLastT + (st === 1 ? 0.5 : 0);
        if (Math.abs(t - expectLocal) > 2) { sendCinSync(st === 1); } // ผู้ใช้เลื่อนเอง
        else if (st === 1 || st === 2) { if (Math.abs(t - cinPos()) > 4 && cin.playing === (st === 1)) applyCinRemote(true); else if (cin.playing !== (st === 1) && st !== 3) applyCinRemote(); }
      }
      cinLastT = t;
    } catch (e) { /* ignore */ }
  }, 500);
}
function stopCinFrame() {
  cinWatching = false; clearInterval(cinPoll); cinPoll = null; ytReady = false;
  try { if (ytPlayer && ytPlayer.destroy) ytPlayer.destroy(); } catch (e) { /* ignore */ }
  ytPlayer = null; $('cinFrame').innerHTML = ''; $('cinFrame').dataset.key = '';
}
function openCinema() { $('cinema').classList.remove('hidden'); renderCinema(); }
function closeCinema() { if (!cinemaShown()) return; if (cinWatching) { send({ t: 'cin', a: 'leave' }); stopCinFrame(); } $('cinema').classList.add('hidden'); }
function renderCinema() {
  const mv = cin && cin.movie ? { yt: cin.yt, name: cin.name } : null, el = $('cinBody'), fr = $('cinFrame');
  if (cinWatching && mv) {
    const key = cin.movie + '@' + cin.startedAt;
    if (fr.dataset.key !== key) { fr.dataset.key = key; startCinPlayer({ yt: mv.yt, key }); } // สร้างตัวเล่นครั้งเดียวต่อรอบฉาย
    el.innerHTML = `<div class="center"><b>🎬 กำลังดู: ${esc(mv.name)}</b><br><small>🍿 ผู้ชม ${cin.viewers.length} คน • ใครกดเล่น/หยุด/เลื่อนเวลา ทุกคนจะตามกันหมด • เสียงได้ยินเฉพาะคนที่เข้ามาดู</small><br><small>ถ้าภาพหรือเสียงไม่ตรงกัน กด "ซิงก์ใหม่" • ถ้าไม่มีเสียงให้กดเล่นที่หน้าต่างหนัง</small></div>`
      + `<div class="center" style="margin-top:8px"><button class="btn small" data-cin="resync">🔄 ซิงก์ใหม่</button> <button class="btn small muted" data-cin="leave">🚪 ออกจากโรงหนัง</button></div>`;
    return;
  }
  if (fr.innerHTML) stopCinFrame();
  const coin = inv.coin || 0, keep = $('cinUrl') ? $('cinUrl').value : '';
  if (mv) {
    el.innerHTML = `<div class="banner" style="background:#ffe9b8">🎬 กำลังฉาย <b>${esc(mv.name)}</b> (ผ่านไป ${Math.floor(cinPos() / 60)} นาที) • ผู้ชม ${cin.viewers.length} คน</div>`
      + `<div class="center"><button class="btn" data-cin="watch" ${coin < TICKET ? 'disabled' : ''}>🎟️ ซื้อตั๋วเข้าไปดู 🪙${TICKET}</button></div><p style="font-size:12px;opacity:.65">เข้าไปแล้วดูต่อจากช่วงที่กำลังฉายอยู่ จอเดียวกับทุกคน</p>`;
  } else {
    el.innerHTML = `<p class="center">วางลิงก์ YouTube ที่อยากดูด้วยกัน (ตั๋ว 🪙${TICKET})</p>`
      + `<div class="row"><input id="cinUrl" placeholder="https://www.youtube.com/watch?v=..." style="flex:1;min-width:0;padding:8px;border:2px solid #c9b48a;border-radius:8px;font:inherit" value="${esc(keep)}"><button class="btn small" data-cin="playurl" ${coin < TICKET ? 'disabled' : ''}>▶ ฉาย 🪙${TICKET}</button></div>`
      + `<div class="sec">หรือเลือกหนังฟรี</div>`
      + MOVIES.map(x => `<div class="row"><span>🎞️ ${x.name}<br><small>ความยาว ~${Math.round(x.sec / 60)} นาที</small></span><button class="btn small" data-cin="play" data-id="${x.id}" ${coin < TICKET ? 'disabled' : ''}>▶ ฉาย 🪙${TICKET}</button></div>`).join('')
      + `<p style="font-size:12px;opacity:.65">ใช้ได้เฉพาะลิงก์ YouTube ที่เจ้าของอนุญาตให้ฝังเล่นในเว็บอื่น (บางคลิปไม่อนุญาต จะเล่นไม่ได้) • ทุกคนดูผ่านเน็ตของตัวเอง</p>`;
  }
}
$('cinema').addEventListener('click', e => {
  const b = e.target.closest('[data-cin]'); if (!b) return;
  const a = b.dataset.cin;
  if (a === 'leave') closeCinema();
  else if (a === 'resync') applyCinRemote(true);
  else if (a === 'playurl') { const u = $('cinUrl').value.trim(); if (u) send({ t: 'cin', a: 'play', url: u }); else toast('วางลิงก์ YouTube ก่อนนะ'); }
  else send({ t: 'cin', a, id: b.dataset.id });
});
$('cinClose').onclick = closeCinema;
$('cinema').addEventListener('pointerdown', e => { if (e.target === $('cinema') && !cinWatching) closeCinema(); });
setInterval(() => { if (cinemaShown() && !cinWatching && document.activeElement !== $('cinUrl')) renderCinema(); }, 5000);

// ---------- render setup ----------
let zoom = 1, baseZoom = 1, vw = 0, vh = 0, camX = 0, camY = 0;
const ZOOM_MIN = 0.5, ZOOM_MAX = 2.6;
let userZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +ls.get('mw_zoom') || 1)); // ผู้เล่นปรับซูมเองได้ (คูณบนสเกล auto-fit) จำไว้ในเครื่อง
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  baseZoom = Math.max(isTouch ? 1.35 : 1.2, Math.min(innerWidth / 720, innerHeight / 450)) * dpr; // auto-fit ตามขนาดจอ/ความละเอียด
  zoom = baseZoom * userZoom;
  vw = canvas.width / zoom; vh = canvas.height / zoom;
}
function setZoom(z) { userZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); ls.set('mw_zoom', userZoom.toFixed(3)); resize(); }
addEventListener('resize', resize); resize();
if ($('zoomInBtn')) $('zoomInBtn').onclick = () => setZoom(userZoom * 1.15);
if ($('zoomOutBtn')) $('zoomOutBtn').onclick = () => setZoom(userZoom / 1.15);

const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const trees = [];
const GOODS = { furn: ['🛋️', '🪑'], farm: ['🥕', '🌽'], fish: ['🐟', '🎣'], animal: ['🥛', '🥚'], cloth: ['👕', '👖'], food: ['🍞', '🍜'], wood: ['🪵', '🪓'], vehicle: ['🚲', '🛵'], pet: ['🐶', '🐱'] };
const FONT = '"Noto Sans Thai","Leelawadee UI",Tahoma,sans-serif';

// พื้นโลกวาดเป็นพิกเซลที่ครึ่งความละเอียด (16 px ต่อช่อง ดู pixelart.js) แล้วขยาย 2 เท่าตอนวาด
// ของตกแต่งเดิมวาดที่พิกัดเกมผ่าน g.scale(0.5) จึงกลายเป็นพิกเซลไปด้วย ส่วนตัวหนังสือ/อีโมจิไปอยู่ชั้น baseHi (ความละเอียดเต็ม) จะได้คมชัด
let baseHi;
// ---------- สิ่งก่อสร้างจากโครงการพัฒนาเมือง ----------
function drawStructures(g, gh) {
  const B = Shared.BRIDGE, wat = (x, y) => !!MAP[y] && MAP[y][x] === T.WATER;
  // ทางไม้ (สะพาน + ทางต่อเกาะ): พื้นไม้กระดาน ราวไม้ตรงด้านที่ติดน้ำ เสาเป็นช่วงๆ เงาบนน้ำ
  const isDeck = (x, y) => !!MAP[y] && MAP[y][x] === T.BRIDGE;
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    if (!isDeck(tx, ty)) continue;
    const bx = tx * TS, by = ty * TS, N = wat(tx, ty - 1), S2 = wat(tx, ty + 1), Wd = wat(tx - 1, ty), E = wat(tx + 1, ty);
    g.fillStyle = 'rgba(10,40,80,.28)';
    if (Wd) g.fillRect(bx - 5, by + 3, 5, TS); if (E) g.fillRect(bx + TS, by + 3, 5, TS); if (N) g.fillRect(bx, by - 2, TS, 4); if (S2) g.fillRect(bx, by + TS, TS, 5);
    const vertical = !Wd && !E; // ไม่มีน้ำซ้าย/ขวา = ทางเดินแนวซ้าย-ขวา (ทางต่อเกาะ) วางกระดานแนวตั้ง
    for (let i = 0; i < 4; i++) {
      const c1 = (i + tx + ty) % 2 ? '#b57f46' : '#a8703a';
      if (vertical) { g.fillStyle = c1; g.fillRect(bx + i * 8, by, 8, TS); g.fillStyle = '#c99357'; g.fillRect(bx + i * 8, by, 2, TS); g.fillStyle = '#6e4624'; g.fillRect(bx + i * 8 + 7, by, 1, TS); }
      else { g.fillStyle = c1; g.fillRect(bx, by + i * 8, TS, 8); g.fillStyle = '#c99357'; g.fillRect(bx, by + i * 8, TS, 2); g.fillStyle = '#6e4624'; g.fillRect(bx, by + i * 8 + 7, TS, 1); }
    }
    const rail = (x, y, w, h) => { g.fillStyle = '#5a3a1c'; g.fillRect(x, y, w, h); g.fillStyle = '#8b5a2b'; g.fillRect(x, y, Math.min(w, 2), Math.min(h, 2)); if (w > h) g.fillRect(x, y, w, 2); else g.fillRect(x, y, 2, h); };
    const post = (x, y) => { g.fillStyle = '#3f2814'; g.fillRect(x, y, 6, 7); g.fillStyle = '#a8703a'; g.fillRect(x, y - 1, 6, 3); };
    if (Wd) { rail(bx, by, 4, TS); if (ty % 3 === 0 || !(isDeck(tx, ty - 1) && wat(tx - 1, ty - 1)) || !(isDeck(tx, ty + 1) && wat(tx - 1, ty + 1))) post(bx - 1, by + 2); }
    if (E) { rail(bx + TS - 4, by, 4, TS); if (ty % 3 === 0 || !(isDeck(tx, ty - 1) && wat(tx + 1, ty - 1)) || !(isDeck(tx, ty + 1) && wat(tx + 1, ty + 1))) post(bx + TS - 5, by + 2); }
    if (N) { rail(bx, by, TS, 4); if (tx % 3 === 0) post(bx + 2, by - 1); }
    if (S2) { rail(bx, by + TS - 4, TS, 4); if (tx % 3 === 0) post(bx + 2, by + TS - 5); }
  }
  // เกาะตกปลาลับ: ต้นมะพร้าวบนเกาะทราย + ลังเหยื่อ (ตัวเกาะเป็นช่องทราย พื้นวาดจาก ground)
  if (builtProj.has('island')) {
    const I = Shared.ISLAND, px = (I.x0 + 1) * TS + 16, py = (I.y0 + 1) * TS + 22;
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(px - 10, py + 2, 24, 5);
    g.fillStyle = '#7a4a24'; g.fillRect(px - 2, py - 34, 5, 38); g.fillRect(px - 4, py - 30, 4, 4); g.fillRect(px + 1, py - 18, 4, 4); g.fillStyle = '#a8703a'; g.fillRect(px - 2, py - 34, 2, 38);
    for (const [dx, dy, ww] of [[-22, -34, 22], [0, -38, 22], [-14, -42, 18], [-24, -28, 16], [8, -32, 16]]) { g.fillStyle = '#2f7d32'; g.fillRect(px + dx, py + dy, ww, 5); g.fillStyle = '#58b04a'; g.fillRect(px + dx + 2, py + dy, ww - 6, 2); }
    g.fillStyle = '#5a3a1c'; g.fillRect(px - 5, py - 30, 4, 4); g.fillRect(px, py - 30, 4, 4);
    g.fillStyle = '#8b5a2b'; g.fillRect(px + 12, py - 8, 14, 12); g.fillStyle = '#c98b4a'; g.fillRect(px + 12, py - 8, 14, 3); g.fillStyle = '#5a3a1c'; g.fillRect(px + 12, py - 1, 14, 1);
    PixelUI.world(gh, '🎣', px + 19, py - 14, 11);
  }
  // ลานเทศกาลกลางเมือง: เวที (ม่านแดง ป้าย) เต็นท์ลายสองหลัง และธงราวขึงหน้าเวที (พื้นลานเป็นช่องทางเดินจาก ground)
  if (builtProj.has('festival')) {
    const F = Shared.FESTIVAL, sg = F.stage, sx = sg.x0 * TS, sy = sg.y0 * TS, sw = (sg.x1 - sg.x0 + 1) * TS, sh = (sg.y1 - sg.y0 + 1) * TS;
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(sx + 2, sy + sh - 4, sw - 4, 7);
    g.fillStyle = '#6b4423'; g.fillRect(sx, sy + 26, sw, sh - 26); g.fillStyle = '#a8703a'; g.fillRect(sx, sy + 26, sw, 6); g.fillStyle = '#c99357'; g.fillRect(sx, sy + 26, sw, 2);
    g.fillStyle = '#2b2f55'; g.fillRect(sx + 6, sy - 14, sw - 12, 40); g.fillStyle = '#3c4380'; g.fillRect(sx + 6, sy - 14, sw - 12, 6);
    g.fillStyle = '#c0392b'; g.fillRect(sx + 2, sy - 18, 16, 46); g.fillRect(sx + sw - 18, sy - 18, 16, 46); g.fillStyle = '#e25c4d'; g.fillRect(sx + 2, sy - 18, 5, 46); g.fillRect(sx + sw - 18, sy - 18, 5, 46);
    g.fillStyle = '#f1c40f'; g.fillRect(sx, sy - 20, sw, 4);
    gh.textAlign = 'center'; gh.font = `bold 13px ${FONT}`; gh.fillStyle = '#ffe08a'; gh.fillText('เทศกาล', sx + sw / 2, sy + 2); PixelUI.world(gh, '🎪', sx + sw / 2, sy - 10, 13);
    for (const t of F.tents) {
      const tx0 = t.x0 * TS, ty0 = t.y0 * TS, tw = (t.x1 - t.x0 + 1) * TS, th = (t.y1 - t.y0 + 1) * TS, mid = tx0 + tw / 2;
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(tx0 + 2, ty0 + th - 5, tw - 4, 7);
      g.fillStyle = '#efe6cf'; g.fillRect(tx0 + 4, ty0 + 26, tw - 8, th - 30);
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#c0392b' : '#efe6cf'; g.fillRect(tx0 + 4 + i * ((tw - 8) / 4), ty0 + 26, (tw - 8) / 4, th - 30); }
      for (let r = 0; r < 7; r++) { g.fillStyle = r % 2 ? '#c0392b' : '#e25c4d'; const half = 6 + r * 4.3; g.fillRect(mid - half, ty0 + 2 + r * 4, half * 2, 4); }
      g.fillStyle = '#3a2418'; g.fillRect(mid - 7, ty0 + th - 22, 14, 18);
      g.fillStyle = '#f1c40f'; g.fillRect(mid - 1, ty0 - 4, 2, 7); g.fillRect(mid + 1, ty0 - 4, 7, 4);
    }
    const y0 = F.plaza.y0 * TS + 5, xa = F.plaza.x0 * TS + 6, xb = (F.plaza.x1 + 1) * TS - 6;
    g.fillStyle = '#5a3a1c'; g.fillRect(xa - 2, y0 - 2, 3, 22); g.fillRect(xb - 1, y0 - 2, 3, 22); // เสาธงราวสองข้าง
    const cols = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#9b59b6'];
    for (let x = xa, i = 0; x < xb - 8; x += 12, i++) { const sag = Math.round(Math.sin((x - xa) / (xb - xa) * Math.PI) * 7); g.fillStyle = '#3a2418'; g.fillRect(x, y0 + sag, 12, 1); g.fillStyle = cols[i % cols.length]; g.fillRect(x + 1, y0 + sag + 1, 9, 3); g.fillRect(x + 2, y0 + sag + 4, 7, 2); g.fillRect(x + 4, y0 + sag + 6, 3, 2); }
  }
}
// พื้นและผนังข้างในบ้านหลังใหญ่ (ภาพพิกเซลที่ 16 px ต่อช่อง ขยาย 2 เท่าเหมือนพื้นเมือง) • ฟังก์ชันนี้สลับใช้แทน buildBase() ตอนอยู่ในบ้าน
function buildHouseBase() {
  const U = PixelArt.U, HS = Shared.HOUSE, oc = document.createElement('canvas'); oc.width = W * U; oc.height = H * U;
  const g = oc.getContext('2d'), R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const hh = (x, y, sd = 0) => { let h = (x * 374761393 + y * 668265263 + sd * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  R('#17110d', 0, 0, oc.width, oc.height);
  const fx0 = (HS.x0 + 1) * U, fy0 = (HS.y0 + 2) * U, fw = (HS.x1 - HS.x0 - 1) * U, fh = (HS.y1 - HS.y0 - 2) * U;
  const PL = ['#c99a5b', '#c4944f', '#d1a265', '#bf8f50'];
  for (let r = 0, ry = fy0; ry < fy0 + fh; r++, ry += 8) { // พื้นไม้กระดาน แถวละ 8 px ยาวสลับรอยต่อ
    let px = fx0 - ((r * 11) % 24);
    while (px < fx0 + fw) {
      const x = Math.max(px, fx0), w = Math.min(px + 24, fx0 + fw) - x;
      if (w > 0) { R(PL[Math.floor(hh(px, ry) * 4)], x, ry, w, 8); R('rgba(255,235,190,.18)', x, ry, w, 1); R('#a9794a', x, ry + 7, w, 1); if (px >= fx0) R('#a9794a', px, ry, 1, 8); }
      px += 24;
    }
  }
  const wallTop = HS.y0 * U, wallH = 2 * U;
  R('#e8d9b8', HS.x0 * U, wallTop, (HS.x1 - HS.x0 + 1) * U, wallH); // ผนังบน: วอลเปเปอร์ลายขีด + ราวไม้ + บัวพื้น
  for (let x = HS.x0 * U; x < (HS.x1 + 1) * U; x += 8) R('#dccaa0', x, wallTop, 1, U + 2);
  R('#c98b4a', HS.x0 * U, wallTop + U + 2, (HS.x1 - HS.x0 + 1) * U, 2); R('#a0692f', HS.x0 * U, wallTop + U + 4, (HS.x1 - HS.x0 + 1) * U, U - 6); R('#7a4a24', HS.x0 * U, wallTop + wallH - 2, (HS.x1 - HS.x0 + 1) * U, 2);
  for (const wx of [HS.x0 + 4, Math.floor((HS.x0 + HS.x1) / 2) - 1, HS.x1 - 6]) { // หน้าต่าง 3 บาน
    const x = wx * U, y = wallTop + 3;
    R('#5a3a1c', x - 1, y - 1, 34, 18); R('#a8dcf2', x + 1, y + 1, 30, 14); R('#d6f0fb', x + 1, y + 1, 30, 4); R('#5a3a1c', x + 15, y + 1, 2, 14); R('#5a3a1c', x - 3, y + 15, 38, 3); R('#c98b4a', x - 3, y + 15, 38, 1);
  }
  const sideC = ['#b87a3d', '#a0692f'];
  for (let y = HS.y0 + 2; y <= HS.y1; y++) for (const x of [HS.x0, HS.x1]) { // ผนังซ้าย/ขวา
    R(sideC[0], x * U, y * U, U, U); R(sideC[1], x * U + (x === HS.x0 ? U - 3 : 0), y * U, 3, U); R('#c98b4a', x * U + (x === HS.x0 ? 0 : U - 2), y * U, 2, U);
  }
  for (let x = HS.x0; x <= HS.x1; x++) { // ผนังล่าง + ช่องประตู
    if (HS.door.includes(x)) { R('#2a1b14', x * U, HS.y1 * U, U, U); continue; }
    R(sideC[0], x * U, HS.y1 * U, U, U); R(sideC[1], x * U, HS.y1 * U, U, 3); R('#c98b4a', x * U, HS.y1 * U + U - 2, U, 2);
  }
  const dx = HS.door[0] * U - 3, dw = HS.door.length * U + 6; // กรอบประตู + พรมเช็ดเท้าหน้าประตู
  R('#5a3a1c', dx, HS.y1 * U - 2, 3, U + 2); R('#5a3a1c', dx + dw - 3, HS.y1 * U - 2, 3, U + 2); R('#5a3a1c', dx, HS.y1 * U - 3, dw, 3);
  R('#8c2a22', HS.door[0] * U + 2, (HS.y1 - 1) * U + 2, HS.door.length * U - 4, U - 4); R('#e8c66a', HS.door[0] * U + 4, (HS.y1 - 1) * U + 4, HS.door.length * U - 8, 2); R('#e8c66a', HS.door[0] * U + 4, (HS.y1 - 1) * U + U - 6, HS.door.length * U - 8, 2);
  baseHi = document.createElement('canvas'); baseHi.width = W * TS; baseHi.height = H * TS;
  const gh = baseHi.getContext('2d'); gh.textAlign = 'center'; gh.textBaseline = 'middle';
  PixelUI.world(gh, '🚪', (HS.door[0] + 1) * TS, HS.y1 * TS + 16, 15); // ป้ายประตูทางออก
  return oc;
}
function buildBase() {
  const U = PixelArt.U, oc = document.createElement('canvas'); oc.width = W * U; oc.height = H * U;
  const g = oc.getContext('2d');
  g.drawImage(PixelArt.ground(MAP), 0, 0);
  PixelArt.fences(g, MAP);
  for (const b of BUILDINGS) for (const [cx, cy] of b.counter) g.drawImage(PixelArt.counter(b), cx * U - 1, cy * U + 2);
  baseHi = document.createElement('canvas'); baseHi.width = W * TS; baseHi.height = H * TS;
  const gh = baseHi.getContext('2d');
  gh.textAlign = 'center'; gh.textBaseline = 'middle';
  g.scale(U / TS, U / TS);
  // อาคาร: ร้านค้าทั่วไปวาดเป็นสไปรต์เรียงตามแกน y ใน step() ส่วนป้ายลานตู้เกมกับจอหนังยังวาดลงพื้นแบบเดิม
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const b of BUILDINGS) {
    const bx = b.x0 * TS, by = b.y0 * TS, bw = (b.x1 - b.x0 + 1) * TS, bh = (b.y1 - b.y0 + 1) * TS;
    if (b.kind === 'sign') { // ป้ายใหญ่ของลานตู้เกม (ไม่ใช่อาคาร)
      const sw = bw * 0.5, sx = bx + (bw - sw) / 2; // ป้ายเล็กลงครึ่งความกว้าง เขียนแค่ Arcade (พื้นที่กดยังเท่าเดิม)
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(sx + 2, by + 20, sw - 4, 5);
      g.fillStyle = '#6b4423'; g.fillRect(sx + 4, by + 6, 4, 16); g.fillRect(sx + sw - 8, by + 6, 4, 16);
      g.fillStyle = b.roof; g.fillRect(sx, by + 1, sw, 16); g.fillStyle = '#fff'; g.fillRect(sx + 2, by + 3, sw - 4, 12);
      g.fillStyle = b.roof; g.fillRect(sx + 3, by + 4, sw - 6, 10);
      gh.font = `bold 12px ${FONT}`; gh.fillStyle = '#fff'; gh.fillText('Arcade', bx + bw / 2, by + 9.5);
      continue;
    }
    if (b.kind === 'cinema') { // จอหนังกลางแปลง: เสา 2 ต้น + จอขาวใหญ่
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(bx + 4, by + bh - 6, bw - 8, 8);
      g.fillStyle = '#5a4a3a'; g.fillRect(bx + 8, by + 6, 8, bh - 4); g.fillRect(bx + bw - 16, by + 6, 8, bh - 4);
      g.fillStyle = '#1b1d33'; g.fillRect(bx + 2, by - 6, bw - 4, bh - 6);
      g.fillStyle = '#f7f7ef'; g.fillRect(bx + 8, by - 1, bw - 16, bh - 16);
      g.fillStyle = '#dcdcd0'; g.fillRect(bx + 8, by + bh - 20, bw - 16, 3);
      gh.font = `bold 13px ${FONT}`; gh.fillStyle = '#2b2f55'; gh.fillText(`${b.sign} ${b.name} ${b.sign}`, bx + bw / 2, by + (bh - 16) / 2 - 1);
      continue;
    }
    b.counter.forEach(([cx, cy], i) => { PixelUI.world(gh, GOODS[b.kind][i % 2], cx * TS + 16, cy * TS + 22, 15); });
  }
  { // บ้านหลังใหญ่: หน้าบ้านเหนือประตู HOUSE_DOOR (27,5) เดินเข้าประตูแล้วเลือกเข้าบ้านตัวเอง/บ้านเพื่อน
    const B = Shared.HOUSE_BLD, bx = B.x0 * TS, by = B.y0 * TS, bw = (B.x1 - B.x0 + 1) * TS, bh = (B.y1 - B.y0 + 1) * TS, dx = Shared.HOUSE_DOOR.x * TS;
    g.drawImage(oc, (B.x0 - 7) * U, B.y0 * U, (B.x1 - B.x0 + 1) * U, (B.y1 - B.y0 + 1) * U, bx, by, bw, bh); // พื้นหญ้าใต้ตัวบ้าน (ช่องตัน) คัดลอกลายหญ้าข้างๆ มาปิดสีทางเดิน
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(bx + 6, by + bh - 6, bw - 8, 10);
    g.fillStyle = '#7a4a24'; g.fillRect(bx + 8, by + 48, bw - 16, bh - 48); g.fillStyle = '#f0e0bc'; g.fillRect(bx + 11, by + 51, bw - 22, bh - 54);
    for (let x = bx + 11; x < bx + bw - 11; x += 14) { g.fillStyle = '#e2cf9e'; g.fillRect(x, by + 51, 2, bh - 54); }
    g.fillStyle = '#b9602f'; g.fillRect(bx + 11, by + bh - 20, bw - 22, 14); g.fillStyle = '#7a3f1d'; g.fillRect(bx + 11, by + bh - 8, bw - 22, 2);
    g.fillStyle = '#a82f23'; g.beginPath(); g.moveTo(bx - 4, by + 54); g.lineTo(bx + bw / 2, by + 2); g.lineTo(bx + bw + 4, by + 54); g.closePath(); g.fill();
    g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(bx + 6, by + 50); g.lineTo(bx + bw / 2, by + 8); g.lineTo(bx + bw - 6, by + 50); g.closePath(); g.fill();
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(bx + bw / 2 - 2 + i * 18, by + 14 + i * 6, 2, 34 - i * 6); }
    g.fillStyle = '#5a3a1c'; g.fillRect(bx + bw - 50, by + 16, 14, 24); g.fillStyle = '#8d8a94'; g.fillRect(bx + bw - 52, by + 13, 18, 5); // ปล่องไฟ
    g.fillStyle = '#5a3a1c'; g.fillRect(dx - 3, by + bh - 52, 38, 52); g.fillStyle = '#9a5a2a'; g.fillRect(dx, by + bh - 49, 32, 49); g.fillStyle = '#b87a3d'; g.fillRect(dx + 3, by + bh - 46, 12, 22); g.fillRect(dx + 17, by + bh - 46, 12, 22);
    g.fillStyle = '#f1c40f'; g.fillRect(dx + 25, by + bh - 24, 3, 3);
    for (const wx of [bx + 24, bx + bw - 68]) { g.fillStyle = '#5a3a1c'; g.fillRect(wx, by + 74, 44, 32); g.fillStyle = '#a8dcf2'; g.fillRect(wx + 3, by + 77, 38, 26); g.fillStyle = '#d6f0fb'; g.fillRect(wx + 3, by + 77, 38, 8); g.fillStyle = '#5a3a1c'; g.fillRect(wx + 20, by + 77, 3, 26); g.fillRect(wx, by + 105, 44, 4); }
    g.fillStyle = '#5a3a1c'; g.fillRect(dx - 24, by + 56, 80, 16); g.fillStyle = '#e8c66a'; g.fillRect(dx - 22, by + 58, 76, 12); // ป้ายเหนือประตู
    gh.font = `bold 11px ${FONT}`; gh.fillStyle = '#3d2a1a'; gh.fillText('🏠 บ้านหลังใหญ่', dx + 16, by + 64.5);
  }
  // ตู้เกม (เรียงเป็นรูปตัว U) + พื้นลานตู้เกมมีลวดลาย
  // ตู้เกม: สีไม่ซ้ำกันแต่กลมกลืนกับธีม และมี 3 ทรงหน้าตา (สลับตามลำดับตู้) • ตู้ว่างเป็นสีเทา
  const CAB_PAL = [
    { body: '#2b2f55', acc: '#6a3fb5', trim: '#8a6fd1' }, // ม่วง
    { body: '#1e3d33', acc: '#2e9e6b', trim: '#6fd3a0' }, // เขียวเข้ม
    { body: '#4a1f1f', acc: '#c9402c', trim: '#f08a6a' }, // แดง
    { body: '#1f3550', acc: '#2f80c9', trim: '#7fb8ea' }, // น้ำเงิน
    { body: '#4a3216', acc: '#d9982a', trim: '#f5cf7a' }, // ทองอำพัน
    { body: '#3d1f4a', acc: '#c9488a', trim: '#f09acb' }, // ชมพู
    { body: '#1a3f4a', acc: '#1f9fb3', trim: '#7fdbe8' }, // ฟ้าอมเขียว
    { body: '#33384a', acc: '#6f7ca3', trim: '#b8c2dc' }, // เทาน้ำเงิน
  ];
  for (const [ci, cab] of CABINETS.entries()) {
    const px = cab.x * TS, py = cab.y * TS, game = !!cab.game, pal = game ? CAB_PAL[ci % CAB_PAL.length] : { body: '#4a4a55', acc: '#6b6b75', trim: '#8a8a95' }, style = ci % 3;
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(px + 2, py + 28, 28, 4);            // เงา
    g.fillStyle = pal.body; g.fillRect(px + 3, py - 6, 26, 34);                      // ตัวตู้
    g.fillStyle = pal.trim; g.fillRect(px + 3, py - 6, 3, 34); g.fillRect(px + 26, py - 6, 3, 34); // เสาข้าง
    if (style === 2) { g.fillStyle = pal.acc; g.fillRect(px + 2, py + 21, 28, 7); } // แท่นล่างสีเน้น (ทรงที่ 3)
    if (style === 1) { g.fillStyle = pal.trim; g.fillRect(px + 12, py + 1, 8, 1); g.fillRect(px + 12, py + 25, 8, 1); } // ลายเส้นกลางตัวตู้ (ทรงที่ 2)
    g.fillStyle = pal.acc; g.fillRect(px + 2, py - 11, 28, 6); g.fillRect(px + 2, py - 11, 28, 1); // ป้ายหัวตู้ (marquee)
    if (style === 1) { g.fillStyle = pal.acc; g.fillRect(px + 3, py - 14, 3, 4); g.fillRect(px + 26, py - 14, 3, 4); } // หัวเสาสูง (ทรงที่ 2)
    g.fillStyle = game ? '#f4f0ff' : '#c9c9d2'; g.fillRect(px + 4, py - 10, 24, 1);  // ขอบสว่างบนป้าย
    g.fillStyle = '#2d2d33'; g.fillRect(px + 7, py - 2, 18, 14);                     // กรอบจอ
    g.fillStyle = game ? '#0c1a2e' : '#1d2230'; g.fillRect(px + 8, py - 1, 16, 12);  // จอ
    g.fillStyle = 'rgba(170,225,255,.3)'; g.fillRect(px + 10, py + 1, 3, 9); g.fillRect(px + 16, py + 1, 2, 9); // แสงสะท้อนบนจอ
    g.fillStyle = pal.trim; g.fillRect(px + 4, py + 13, 24, 4);                      // แผงควบคุม
    g.fillStyle = '#2d2d33'; g.fillRect(px + 7, py + 11, 2, 3);                      // ก้านจอย
    g.fillStyle = game ? '#e74c3c' : '#666'; g.beginPath(); g.arc(px + 8, py + 10.5, 2.2, 0, 7); g.fill(); // หัวจอย
    g.fillStyle = game ? '#f1c40f' : '#666'; g.beginPath(); g.arc(px + 14, py + 15, 1.4, 0, 7); g.fill();
    g.fillStyle = game ? '#2ecc71' : '#666'; g.beginPath(); g.arc(px + 18, py + 15, 1.4, 0, 7); g.fill();
    g.fillStyle = game ? '#3498db' : '#666'; g.beginPath(); g.arc(px + 22, py + 15, 1.4, 0, 7); g.fill();
    g.fillStyle = pal.acc; g.fillRect(px + 3, py + 18, 26, 3);                       // แถบล่างตัวตู้
    g.fillStyle = '#3a3a48'; g.fillRect(px + 9, py + 21, 14, 7);                    // ช่องลำโพง
    g.fillStyle = game ? '#ff6b8a' : '#666'; g.fillRect(px + 11, py + 23, 2, 1); g.fillRect(px + 19, py + 23, 2, 1); // ตาสองดวง
    g.fillStyle = '#111'; g.fillRect(px + 12, py + 25, 8, 1);                        // ปาก
    gh.fillStyle = game ? '#ffffff' : '#ddd'; gh.font = 'bold 8px sans-serif'; gh.fillText(game ? cab.label : '?', px + 16, py - 5); // ชื่อบนป้ายหัวตู้
  }
  // กระดานข่าวเมือง + ตู้เซฟกองกลาง (ขอบเหนือลานกองไฟ)
  // ตกแต่งคอกสัตว์ให้ดูสดใส (ภาพพื้นล้วนๆ ไม่ขวางทาง): บ่อเป็ด รังฟาง รางน้ำ กองฟาง แอ่งโคลนหมู ดอกไม้
  { const bale = (px, py) => { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(px + 2, py + 23, 28, 5); g.fillStyle = '#d9b44a'; g.fillRect(px + 3, py + 10, 26, 15); g.fillStyle = '#e8cd72'; g.fillRect(px + 3, py + 10, 26, 4); g.fillStyle = '#c29a32'; for (const dx of [9, 16, 23]) g.fillRect(px + dx, py + 10, 1.5, 15); };
    const trough = (px, py) => { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(px + 1, py + 24, 30, 4); g.fillStyle = '#8b5a2b'; g.fillRect(px + 1, py + 13, 30, 12); g.fillStyle = '#59b6ec'; g.fillRect(px + 4, py + 15, 24, 6); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(px + 7, py + 16, 8, 1.5); };
    const pond = (cx, cy, rx, ry) => { g.fillStyle = '#c9a869'; g.beginPath(); g.ellipse(cx, cy, rx + 3, ry + 3, 0, 0, 7); g.fill(); g.fillStyle = '#4aa3df'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill(); g.fillStyle = '#7cc4f0'; g.beginPath(); g.ellipse(cx - rx * 0.25, cy - ry * 0.25, rx * 0.5, ry * 0.3, 0, 0, 7); g.fill(); g.fillStyle = '#3f9a3a'; g.beginPath(); g.ellipse(cx + rx * 0.45, cy + ry * 0.2, 5, 3, 0, 0, 7); g.fill(); g.fillStyle = '#ff8fc7'; g.fillRect(cx + rx * 0.45 - 1, cy + ry * 0.2 - 2, 2.5, 2.5); };
    const nest = (px, py) => { g.fillStyle = '#e0bd5a'; g.beginPath(); g.ellipse(px + 16, py + 20, 14, 8, 0, 0, 7); g.fill(); g.fillStyle = '#c9a143'; g.beginPath(); g.ellipse(px + 16, py + 22, 10, 4, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; for (const ex of [-5, 1, 6]) { g.beginPath(); g.ellipse(px + 16 + ex, py + 19, 2.2, 3, 0, 0, 7); g.fill(); } };
    const CH = Shared.PENS.chicken, DK = Shared.PENS.duck, PA = Shared.PENS.cow, SH = Shared.PENS.sheep, PG = Shared.PENS.pig;
    pond((DK.x1 - 1) * TS, (DK.y1 - 0.4) * TS, TS * 0.9, TS * 0.7); nest(CH.x0 * TS, CH.y0 * TS); bale(CH.x1 * TS, CH.y0 * TS);
    trough(PA.x0 * TS + 4, PA.y1 * TS); trough((PA.x0 + 1) * TS + 8, PA.y1 * TS); bale(SH.x1 * TS, SH.y0 * TS); bale((SH.x0 + 1) * TS + 2, (SH.y0 + 1) * TS - 8);
    g.fillStyle = '#654225'; g.beginPath(); g.ellipse((PG.x1 - 1) * TS, (PG.y1 - 0.5) * TS, TS * 1, TS * 0.6, 0, 0, 7); g.fill(); g.fillStyle = '#7a5230'; g.beginPath(); g.ellipse((PG.x1 - 1) * TS - 4, (PG.y1 - 0.5) * TS - 3, TS * 0.8, TS * 0.4, 0, 0, 7); g.fill(); trough(PG.x0 * TS, PG.y0 * TS);
    for (const z of [CH, DK, PA, SH, PG]) for (let yy = z.y0; yy <= z.y1; yy++) for (let xx = z.x0; xx <= z.x1; xx++) if (hash(xx, yy, 21) < 0.2) { const fx = xx * TS + 4 + hash(xx, yy, 22) * 22, fy = yy * TS + 6 + hash(xx, yy, 23) * 20; g.fillStyle = ['#ffffff', '#ffd6e8', '#fff3a0', '#d6c2ff'][Math.floor(hash(xx, yy, 24) * 4)]; g.fillRect(fx - 2, fy, 2, 2); g.fillRect(fx + 2, fy, 2, 2); g.fillRect(fx, fy - 2, 2, 2); g.fillRect(fx, fy + 2, 2, 2); g.fillStyle = '#f1c40f'; g.fillRect(fx, fy, 2, 2); } }
  { const bx = BOARD.x * TS, by = BOARD.y * TS;
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(bx + 2, by + 27, 28, 5);
    g.fillStyle = '#6b4423'; g.fillRect(bx + 5, by + 10, 4, 21); g.fillRect(bx + 23, by + 10, 4, 21);
    g.fillStyle = '#8b5a2b'; g.fillRect(bx, by - 8, 32, 24); g.fillStyle = '#f4ecd2'; g.fillRect(bx + 3, by - 5, 26, 18);
    g.fillStyle = '#c9a869'; g.fillRect(bx + 6, by - 2, 9, 7); g.fillRect(bx + 17, by - 2, 9, 5); g.fillRect(bx + 8, by + 7, 12, 3);
    g.fillStyle = '#d63a2f'; g.fillRect(bx + 14, by - 6, 4, 4); }
  { const ax = ATM.x * TS, ay = ATM.y * TS; // ตู้ ATM
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(ax + 2, ay + 27, 28, 5);
    g.fillStyle = '#4b5d73'; g.fillRect(ax + 4, ay - 8, 24, 37); g.fillStyle = '#6c819b'; g.fillRect(ax + 4, ay - 8, 24, 5);
    g.fillStyle = '#12351f'; g.fillRect(ax + 8, ay - 1, 16, 11); g.fillStyle = '#5dff8a'; g.fillRect(ax + 10, ay + 1, 12, 2); g.fillRect(ax + 10, ay + 5, 8, 2);
    g.fillStyle = '#222'; g.fillRect(ax + 9, ay + 13, 14, 6); g.fillStyle = '#f1c40f'; g.fillRect(ax + 11, ay + 15, 10, 2); g.fillStyle = '#111'; g.fillRect(ax + 10, ay + 22, 12, 3); }
  { const cx = CHEST.x * TS, cy = CHEST.y * TS;
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(cx + 2, cy + 27, 28, 5);
    g.fillStyle = '#7a4a24'; g.fillRect(cx + 3, cy + 8, 26, 21); g.fillStyle = '#a8703a'; g.fillRect(cx + 3, cy + 8, 26, 9);
    g.fillStyle = '#c98b4a'; g.fillRect(cx + 3, cy + 8, 26, 3); g.fillStyle = '#f1c40f'; g.fillRect(cx + 3, cy + 16, 26, 2); g.fillRect(cx + 13, cy + 14, 6, 7);
    g.fillStyle = '#5a3a1c'; g.fillRect(cx + 15, cy + 17, 2, 3); PixelUI.world(gh, '🪙', cx + 16, cy + 2, 14); }
  { const tag = (txt, cx, y) => { gh.font = 'bold 8px sans-serif'; const w = gh.measureText(txt).width + 8; g.fillStyle = 'rgba(40,28,14,.85)'; g.fillRect(cx - w / 2, y, w, 11); gh.fillStyle = '#fff'; gh.textAlign = 'center'; gh.textBaseline = 'middle'; gh.fillText(txt, cx, y + 5.5); }; // ป้ายชื่อเหนือกระดานข่าว ATM และตู้กองกลาง
    tag('ข่าวเมือง', BOARD.x * TS + 16, BOARD.y * TS - 22); tag('ATM', ATM.x * TS + 16, ATM.y * TS - 22); tag('กองกลาง', CHEST.x * TS + 16, CHEST.y * TS - 14); }
  // สิ่งก่อสร้างจากโครงการพัฒนาเมือง (วาดเมื่อครบเป้า) • ฟังก์ชันใน drawStructures ด้านล่าง
  drawStructures(g, gh);
  return oc;
}
const builtProj = new Set(); // โครงการที่ครบเป้าและแปลงลง MAP ของหน้านี้แล้ว
const DEMO_STRUCTS = (new URLSearchParams(location.search).get('demo') || '').split(','); // ?demo=lighthouse,island,festival = ดูภาพสิ่งก่อสร้างบนเครื่องตัวเองก่อนยอดครบ (อ่านตอนโหลดหน้า เพราะ URL ถูกเขียนทับหลังเข้าห้อง • ไม่กระทบคนอื่น/เซิร์ฟเวอร์ เดินจริงอาจสะดุด)
let base = buildBase();
function checkProjects() { // โครงการไหนครบเป้า: แปลงช่องบน MAP แล้ววาดพื้นและแผนที่ย่อใหม่ครั้งเดียว (ไม่ว่าจะครบทีละโครงการหรือพร้อมกันตอนเข้าเกม)
  let changed = false;
  for (const P of Shared.PROJECTS) {
    const st = projSt.find(x => x.id === P.id);
    if (!builtProj.has(P.id) && ((st && Shared.projectDone(P.id, st.coin)) || DEMO_STRUCTS.includes(P.id))) { builtProj.add(P.id); Shared.applyProject(tmap(), P.id); changed = true; }
  }
  if (changed) { if (scene) townDirty = true; else { base = buildBase(); miniBase = makeMiniBase(); } }
}

// ---------- drawing helpers ----------
function darken(hex, a) { const n = parseInt(hex.slice(1), 16); const f = c => Math.max(0, Math.round(c * (1 - a))); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; }
function drawSeat(s) {
  const px = s.x * TS, py = s.y * TS;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(px + 3, py + 24, 26, 5);
  if (s.kind === 'bench') {
    ctx.fillStyle = '#7a4a24'; ctx.fillRect(px + 2, py + 18, 4, 9); ctx.fillRect(px + 26, py + 18, 4, 9);
    ctx.fillStyle = '#a8703a'; ctx.fillRect(px, py + 12, 32, 8); ctx.fillStyle = '#c98b4a'; ctx.fillRect(px, py + 12, 32, 3);
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(px + 1, py + (s.face === 1 ? 20 : 4), 30, 5); // พนักพิงอยู่ด้านหลัง
  } else if (s.kind === 'hay') {
    ctx.fillStyle = '#d9b44a'; ctx.beginPath(); ctx.ellipse(px + 16, py + 20, 14, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#c29a32'; for (let i = -10; i <= 10; i += 5) ctx.fillRect(px + 16 + i, py + 12, 1.5, 15);
    ctx.fillStyle = '#e8cd72'; ctx.beginPath(); ctx.ellipse(px + 16, py + 14, 12, 5, 0, 0, 7); ctx.fill();
  } else if (s.face === 0 || s.face === 1) { // เก้าอี้หันหน้าขึ้น/ลง (แถวโรงหนัง): พนักพิงเป็นแถบยาวด้านหลัง เบาะสีแดง
    ctx.fillStyle = '#6b4423'; ctx.fillRect(px + 6, py + 20, 3, 8); ctx.fillRect(px + 23, py + 20, 3, 8);
    ctx.fillStyle = '#b5793a'; ctx.fillRect(px + 3, py + 11, 26, 10);
    ctx.fillStyle = '#c0453a'; ctx.fillRect(px + 5, py + 12, 22, 7);
    ctx.fillStyle = '#9a6430'; ctx.fillRect(px + 3, py + (s.face === 1 ? 19 : 4), 26, 6);
  } else { // เก้าอี้
    ctx.fillStyle = '#6b4423'; ctx.fillRect(px + 7, py + 20, 3, 8); ctx.fillRect(px + 22, py + 20, 3, 8);
    ctx.fillStyle = '#b5793a'; ctx.fillRect(px + 6, py + 14, 20, 7);
    ctx.fillStyle = '#9a6430'; ctx.fillRect(px + (s.face === 2 ? 20 : 6), py + 2, 6, 14);
  }
}
// กองไฟพิกเซล: วงหิน + ฟืนไขว้ + ถ่านแดง (สไปรต์เดียว) แล้วซ้อนเปลวไฟ 4 เฟรม (ขอบส้มเข้ม) + ประกายไฟลอยขึ้น
const FIRE_ART = (() => {
  const { mk, r, ell, addOutline } = PixelArt;
  const stone = (x, sx, sy, w) => { r(x, '#8d8a94', sx, sy, w, 3); r(x, '#b9b6bf', sx, sy, w - 1, 1); r(x, '#5f5c68', sx + 1, sy + 2, w - 1, 1); };
  const RING = [[-11, 0], [-9, -3], [-5, -4], [0, -5], [5, -4], [9, -3], [11, 0], [9, 3], [5, 4], [0, 5], [-5, 4], [-9, 3]];
  const log = (x, x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) { const X = Math.round(x0 + (x1 - x0) * i / n), Y = Math.round(y0 + (y1 - y0) * i / n); r(x, '#7a4a24', X, Y, 2, 2); r(x, '#a8703c', X, Y, 1, 1); } r(x, '#e0bb85', x0, y0, 2, 2); r(x, '#c99a5e', x0 + 1, y0 + 1, 1, 1); r(x, '#e0bb85', x1, y1, 2, 2); };
  const base = mk(28, 13, x => {
    const cx = 13, cy = 6;
    ell(x, cx, cy, 10, 4, '#4a3f38'); ell(x, cx, cy, 7, 3, '#3a302b');
    for (const [dx, dy] of RING) if (dy < 0) stone(x, cx + dx - 1, cy + dy - 1, 4);
    log(x, cx - 7, cy + 2, cx + 6, cy - 2); log(x, cx - 7, cy - 2, cx + 6, cy + 2);
    for (const [ex, ey, c] of [[-2, 0, '#e8541c'], [1, 1, '#ff9a2e'], [3, -1, '#e8541c'], [-4, 1, '#c0392b'], [0, -1, '#ffd36a']]) r(x, c, cx + ex, cy + ey, 1, 1);
    for (const [dx, dy] of RING) if (dy >= 0) stone(x, cx + dx - 1, cy + dy - 1, 4);
  });
  const L = ['#e8541c', '#ff8a2a', '#ffc94a', '#fff2b8'];
  const flames = [0, 1, 2, 3].map(k => {
    const c = mk(16, 20, x => {
      const H = 20, cx = 8;
      const tongue = (bx, h, wMax, ph, layer) => { // เปลวหนึ่งลิ้น: กว้างที่ฐาน แคบลงด้านบน ปลายส่ายตามเฟรม
        for (let y = 0; y < h; y++) { const t = y / h, w = Math.max(0, Math.round(wMax * Math.pow(1 - t, 0.8) * (t < 0.15 ? 0.8 + t : 1))), off = Math.round(Math.sin(t * 3.2 + ph) * t * 2); if (w > 0 || y < h - 1) r(x, L[layer], bx - w + off, H - 1 - y, w * 2 + 1, 1); }
      };
      const sw = [0, 1, 2, 1][k], ph = k * 1.6;
      tongue(cx - 4, 8 + sw, 2, ph + 1, 0); tongue(cx + 4, 10 - sw, 2, ph + 2.5, 0);
      tongue(cx, 18 - (k % 2), 5, ph, 0); tongue(cx, 13 - (k % 2), 3, ph + .4, 1); tongue(cx, 8, 2, ph + .8, 2); tongue(cx, 4, 1, ph + 1.2, 3);
    }, false);
    addOutline(c, '#7a240c'); return c;
  });
  return { base, flames };
})();
function drawFire(now) {
  const px = FIRE.x * TS + 16, py = FIRE.y * TS + 22, A = FIRE_ART;
  ctx.imageSmoothingEnabled = false;
  const f = 1 + Math.sin(now / 90) * 0.12 + Math.sin(now / 53) * 0.08;
  const g = ctx.createRadialGradient(px, py, 2, px, py, 34 * f); g.addColorStop(0, 'rgba(255,170,70,.32)'); g.addColorStop(1, 'rgba(255,150,50,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py + 2, 34 * f, 16 * f, 0, 0, 7); ctx.fill(); // แสงอุ่นบนพื้นรอบกองไฟ
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(px, py + 6, 26, 8, 0, 0, 7); ctx.fill();
  ctx.drawImage(A.base, px - 28, py - 12, A.base.width * 2, A.base.height * 2);
  const fl = A.flames[Math.floor(now / 160) % 4], fh = Math.round(fl.height * 2 * (0.94 + (f - 1) * 0.4)); // 4 เฟรม ~6 ภาพ/วิ + ยืดหดเบาๆ ตามจังหวะกะพริบ
  ctx.drawImage(fl, px - fl.width, py - 1 - fh, fl.width * 2, fh); // ฐานเปลวอยู่เหนือจุดไขว้ฟืน ให้ยังเห็นฟืน
  for (let i = 0; i < 5; i++) { // ประกายไฟลอยขึ้นแล้วจาง
    const t = ((now / 1000) * 0.6 + i * 0.37) % 1, sx = Math.round(px + Math.sin(i * 2.3 + t * 5) * (4 + t * 8)), sy = Math.round(py - 22 - t * 30);
    ctx.globalAlpha = 1 - t; ctx.fillStyle = t < 0.5 ? '#ffd36a' : '#ff8a2a'; ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
}
function drawTree(x, y) { // สไปรต์ต้นไม้พิกเซล (สุ่มแบบตามตำแหน่ง) โคนต้นอยู่กลางขอบล่างของช่อง
  const s = PixelArt.tree(x, y);
  ctx.drawImage(s, x * TS + 16 - 28, y * TS + 32 - 64, s.width * 2, s.height * 2);
}
// ร้านค้า: สไปรต์อาคาร + อีโมจิบนหลังคา + ป้ายชื่อกระดานไม้
function drawBuilding(b) {
  const a = PixelArt.building(b), bx = b.x0 * TS, by = b.y0 * TS, bw = (b.x1 - b.x0 + 1) * TS;
  ctx.drawImage(a.spr, bx + a.ox * 2, by + a.oy * 2, a.w * 2, a.h * 2);
  const cx = bx + bw / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  PixelUI.world(ctx, b.sign, cx, by - 10, 18);
  ctx.font = `bold 11px ${FONT}`;
  const tw = Math.ceil(ctx.measureText(b.name).width) + 12, ty = by + 6, th = 16, x0 = Math.round(cx - tw / 2);
  ctx.fillStyle = PixelArt.OUT; ctx.fillRect(x0 - 2, ty, tw + 4, th); ctx.fillRect(x0, ty - 2, tw, th + 4);
  ctx.fillStyle = '#8f5a2e'; ctx.fillRect(x0, ty, tw, th);
  ctx.fillStyle = '#b67d45'; ctx.fillRect(x0, ty, tw, 2); ctx.fillStyle = '#6e4524'; ctx.fillRect(x0, ty + th - 2, tw, 2);
  ctx.fillStyle = '#c9984f'; ctx.fillRect(x0 + 2, ty + 3, 2, 2); ctx.fillRect(x0 + tw - 4, ty + 3, 2, 2);
  ctx.fillStyle = '#fff3cf'; ctx.fillText(b.name, cx, ty + th / 2 + 0.5);
}
const SKIN = '#f5cfa0', GOLD = '#e8c04a';
// วาดตัวละคร (รองรับเสื้อ/กางเกง/หมวกหลายแบบ) cx = canvas context อื่น (ใช้กับตัวอย่างในตู้เสื้อผ้า)
// ตะเกียงที่ตัวละครถือไว้ตอนเปิดไฟ: ถือข้างตัว (หันซ้าย/ขึ้น = มือซ้าย นอกนั้นมือขวา) แสงกะพริบเบาๆ
// ---------- อุปกรณ์ในมือ: วาดเป็นพิกเซลอาร์ตขนาดพอดีมือ (มือหน้า/หลัง = ขวา x+8, ด้านข้าง = กลางลำตัว) มีท่าแกว่งตอนใช้งาน ----------
const WATER_EMOJIS = new Set(Object.values(CANS).map(c => c.emoji.replace(/️/g, '')));
function heldHand(p) { // ตำแหน่งมือที่ถืออุปกรณ์ [x, y, ทิศออกด้านนอก/ข้างหน้า ±1]
  const dir = p.dir || 0, sn = p.moving && !p.sit ? Math.sin((p.anim || 0) * 14) : 0, f = sn > .35 ? 1 : sn < -.35 ? 2 : 0;
  const lampSide = dir === 2 || dir === 1 ? -1 : 1, hs = p.lamp ? -lampSide : lampSide;
  if (dir < 2) return [p.x + hs * 8, p.y + 3 + (f === (hs > 0 ? 2 : 1) ? 2 : 0), hs];
  const fx = dir === 3 ? 1 : -1; return [p.x + fx * (1 + 2 * (f === 1 ? -1 : f === 2 ? 1 : 0)), p.y + 3, fx];
}
const rodAngle = p => { const k = p.useAt ? (performance.now() - p.useAt) / 260 : 2; return ((p.dir || 0) >= 2 ? 0.8 : 0.15) - 0.72 * Math.sin(k < 1 ? k * Math.PI * 2 : 0); };
const isRodHeld = p => !!p.held && p.held.replace(/\uFE0F/g, '') === '🎣' && !p.sit;
function rodTip(p) { // ปลายคันเบ็ด (ตรงกับที่ drawHeldTool วาด: จุดปลาย 12,-19 หมุนตามมุมคัน)
  const [hx, hy, fx] = heldHand(p), a = rodAngle(p);
  return [hx + fx * (12 * Math.cos(a) + 19 * Math.sin(a)), hy + 12 * Math.sin(a) - 19 * Math.cos(a)];
}
function drawHeldTool(p, now) {
  const e = p.held.replace(/️/g, ''), OUT = PixelArt.OUT, dir = p.dir || 0;
  const sn = p.moving && !p.sit ? Math.sin((p.anim || 0) * 14) : 0, f = sn > .35 ? 1 : sn < -.35 ? 2 : 0;
  const lampSide = dir === 2 || dir === 1 ? -1 : 1, hs = p.lamp ? -lampSide : lampSide;
  let hx, fx, hy = p.y + 3;
  if (dir < 2) { fx = hs; hx = p.x + hs * 8; if (f === (hs > 0 ? 2 : 1)) hy += 2; }                      // หน้า/หลัง: มือซ้าย/ขวา (แขนที่ก้าวลงต่ำกว่า)
  else { fx = dir === 3 ? 1 : -1; hx = p.x + fx * (1 + 2 * (f === 1 ? -1 : f === 2 ? 1 : 0)); }          // ข้าง: แขนอยู่กลางลำตัว
  const k = p.useAt ? (performance.now() - p.useAt) / 260 : 2, sw = k < 1 ? Math.sin(k * Math.PI) : 0; // ท่าใช้งาน 0→1→0
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const WOOD = '#9c6a35', WD = '#6b4423', STEEL = '#b9c2cc', STH = '#e8eef3';
  const a0 = dir >= 2 ? 0.95 : 0.3, a1 = dir >= 2 ? 1.5 : 1.25; // มุมจอบ/ขวาน: ด้านข้างถือเอียงไปข้างหน้ามากกว่า (ไม่พาดหน้า)
  const isHoe = e === '⛏', isAxe = e === '🪓', isRod = e === '🎣', isCan = WATER_EMOJIS.has(e);
  if (isHoe || isAxe || isRod || isCan) {
    ctx.save(); ctx.translate(hx, hy); ctx.scale(fx, 1);
    if (isHoe) { ctx.rotate(a0 + (a1 - a0) * sw); R(-2, -12, 4, 14, OUT); R(-1, -11, 2, 12, WOOD); R(0, -11, 1, 12, WD); R(-6, -14, 13, 5, OUT); R(-5, -13, 11, 3, STEEL); R(-5, -13, 11, 1, STH); R(-5, -11, 2, 2, STEEL); R(4, -11, 2, 2, STEEL); }
    else if (isAxe) { ctx.rotate(a0 + (a1 - a0) * sw); R(-2, -12, 4, 14, OUT); R(-1, -11, 2, 12, WOOD); R(0, -11, 1, 12, WD); R(0, -14, 8, 8, OUT); R(1, -13, 6, 6, STEEL); R(1, -13, 6, 1, STH); R(6, -13, 2, 6, STH); }
    else if (isCan) { // บัวรดน้ำตามระดับที่ซื้อ: 1 สังกะสี (เทาเงิน) • 2 ทองแดง • 3 ทองคำ (ประกาย) ใหญ่ขึ้นตามความจุ
      const T = +Object.keys(CANS).find(k => CANS[k].emoji.replace(/\uFE0F/g, '') === e) || 1, bw = 7 + T, bh = 7 + T, x0 = -(bw >> 1), y0 = -bh - 1, sx = x0 + bw;
      const pal = { 1: { b: '#9fb4c8', l: '#dbe6f0', d: '#6d839a' }, 2: { b: '#c8763a', l: '#f2a868', d: '#8c4a20' }, 3: { b: '#f0c030', l: '#fff2a0', d: '#b08a10' } }[T];
      ctx.translate(3, 2); ctx.rotate(0.05 + 0.85 * sw);
      R(x0 - 1, y0 - 1, bw + 2, bh + 2, OUT); R(x0, y0, bw, bh, pal.b); R(x0, y0, bw, 2, pal.l); R(x0, y0 + bh - 1, bw, 1, pal.d); R(x0, y0, 1, bh, pal.l);
      if (T >= 2) R(x0, y0 + 3, bw, 1, pal.d);                                                // แถบหมุดย้ำ
      R(sx, -7, 4, 3, OUT); R(sx, -6, 3, 1, pal.b); R(sx + 2, -9, 3, 4, OUT); R(sx + 3, -8, 1, 2, pal.l); // ปากเทน้ำ
      R(x0 - 4, -8, 4, 7, OUT); R(x0 - 3, -7, 1, 5, pal.d); R(x0 - 3, -7, 3, 1, pal.d);       // หูหิ้ว
      if (T === 3 && Math.floor(now / 280) % 2) { R(x0 + 2, y0 + 1, 1, 1, '#ffffff'); R(x0 + bw - 3, y0 + 3, 1, 1, '#ffffff'); }
      if (sw > 0.4) { R(sx + 4, -4 + Math.round(sw * 6), 1, 3, '#8fd0ff'); R(sx + 3, -1 + Math.round(sw * 6), 1, 2, '#8fd0ff'); }
    }
    else { // เบ็ด: ปลายคันงอ + สายเอ็น แกว่งตอนเหวี่ยง
      ctx.rotate(rodAngle(p)); // ด้านข้างชี้คันเบ็ดไปข้างหน้า ไม่พาดหน้า
      ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(3, -9); ctx.lineTo(12, -19); ctx.stroke();
      ctx.strokeStyle = WOOD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(3, -9); ctx.lineTo(12, -19); ctx.stroke();
      R(-2, -3, 4, 4, OUT); R(-1, -2, 2, 2, '#9aa0a6');
      if (!p.fs) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(12, -19); ctx.lineTo(12, -8); ctx.stroke(); R(11, -8, 2, 2, '#e04b4b'); } // ตอนตกปลาใช้สายเอ็นจริง (drawFishing) แทน
    }
    ctx.restore();
  } else { // เมล็ด / อาหาร / ยา: ไอคอนเล็กในมือ (เด้งตอนใช้)
    PixelUI.world(ctx, p.held, Math.round(hx + fx * 3), Math.round(hy - 3 - sw * 3), 10);
  }
}
function drawHeldLamp(p, now) {
  const side = p.dir === 2 || p.dir === 1 ? -1 : 1, hx = Math.round(p.x + side * 11), hy = Math.round(p.y + 1 + (p.moving ? Math.round(Math.sin(p.anim * 8)) : 0));
  const fl = 0.85 + Math.sin(now / 130 + (p.id || 0)) * 0.1;
  const g = ctx.createRadialGradient(hx, hy - 2, 1, hx, hy - 2, 16); g.addColorStop(0, `rgba(255,214,110,${0.55 * fl})`); g.addColorStop(1, 'rgba(255,214,110,0)');
  ctx.fillStyle = g; ctx.fillRect(hx - 16, hy - 18, 32, 32);
  ctx.fillStyle = '#3d2a1a'; ctx.fillRect(hx, hy - 9, 1, 3); ctx.fillRect(hx - 3, hy - 7, 7, 1); // หูหิ้ว + ฝาบน
  ctx.fillRect(hx - 3, hy - 1, 7, 2);                                                           // ฐาน
  ctx.fillRect(hx - 3, hy - 6, 1, 5); ctx.fillRect(hx + 3, hy - 6, 1, 5);                      // เสากรอบ
  ctx.fillStyle = fl > 0.9 ? '#ffe08a' : '#ffc94d'; ctx.fillRect(hx - 2, hy - 6, 5, 5);        // แก้วเรืองแสง
  ctx.fillStyle = '#fff6c8'; ctx.fillRect(hx - 1, hy - 5, 2, 3);
}
// เบ็ดตกปลา: เหวี่ยงทุ่นเป็นวงโค้ง สายเอ็นห้อยโค้งตามแรงตึง/ลมพัด ทุ่นลอยตามคลื่น มีระลอกน้ำ และกระตุกแรงตอนปลากินเบ็ด
function drawFishing(p, t) {
  let sx = p.x + (p.dir === 2 ? -8 : p.dir === 3 ? 8 : 0), sy = p.y - 8;       // ปลายคันเบ็ด (ไม่ได้ถือเบ็ดอยู่: ใช้ตำแหน่งเดิม)
  if (isRodHeld(p)) [sx, sy] = rodTip(p);                                        // ถือเบ็ดอยู่: สายออกจากปลายคันจริง ไม่ออกจากหน้าตัวละคร
  const k = Math.min(1, (t - (p.castAt || 0)) / 480), e = 1 - (1 - k) * (1 - k); // ease-out
  const bite = p.fs === 2, ph = (p.id || 0) * 1.7;
  const bob = bite ? Math.sin(t / 45) * 3.5 + 3 : Math.sin(t / 420 + ph) * 1.6;
  const bx = sx + (p.fx - sx) * e + (bite ? Math.sin(t / 38) * 1.5 : 0);
  const by = sy + (p.fy - sy) * e - Math.sin(Math.PI * k) * 34 + (k >= 1 ? bob : 0);
  const sag = k < 1 ? 6 : bite ? 2 : 9 + Math.sin(t / 700 + ph) * 3;             // ตึงตอนกัด หย่อนตอนรอ
  const mx = (sx + bx) / 2 + Math.sin(t / 900 + ph) * (bite ? 0.5 : 2.5), my = (sy + by) / 2 + sag;
  if (k >= 1) { // ระลอกน้ำรอบทุ่น (กัดแรงขึ้นและถี่ขึ้น)
    ctx.lineWidth = 1;
    for (let i = 0; i < (bite ? 3 : 2); i++) {
      const rp = ((t / (bite ? 500 : 1100) + i / (bite ? 3 : 2)) % 1);
      ctx.strokeStyle = `rgba(255,255,255,${(1 - rp) * (bite ? .7 : .45)})`; ctx.beginPath(); ctx.ellipse(p.fx, p.fy + 3, 4 + rp * (bite ? 14 : 10), (4 + rp * (bite ? 14 : 10)) * .45, 0, 0, 7); ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
  // ทุ่นเปลี่ยนตามเหยื่อ: 1 แดง-ขาวกลม / 2 ส้มชมพูทรงหยดน้ำมีแถบ / 3 ทองคำเรืองแสงมีประกายหมุน
  const bt = p.bt || 1;
  if (bt === 1) {
    ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(bx, by, 3.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(bx - 3.5, by - 1, 7, 2);
  } else if (bt === 2) {
    ctx.fillStyle = '#3d2a1a'; ctx.beginPath(); ctx.ellipse(bx, by, 4.6, 5.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff8a4c'; ctx.beginPath(); ctx.ellipse(bx, by, 3.6, 4.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff1d6'; ctx.fillRect(bx - 3.4, by - 1, 6.8, 2); ctx.fillStyle = '#ffd0b0'; ctx.fillRect(bx - 1.6, by - 3.6, 1.6, 1.6);
    ctx.fillStyle = '#3d2a1a'; ctx.fillRect(bx - 0.5, by - 8, 1, 3); // หางเสาอากาศสั้น
  } else {
    const gl = ctx.createRadialGradient(bx, by, 1, bx, by, 13); gl.addColorStop(0, `rgba(255,224,110,${0.55 + Math.sin(t / 160) * 0.15})`); gl.addColorStop(1, 'rgba(255,224,110,0)');
    ctx.fillStyle = gl; ctx.fillRect(bx - 13, by - 13, 26, 26);
    ctx.fillStyle = '#7a540e'; ctx.beginPath(); ctx.arc(bx, by, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(bx, by, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(bx - 2.5, by - 3, 2, 2);
    const a = t / 300 + ph; ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { const aa = a + i * 2.09; ctx.fillRect(Math.round(bx + Math.cos(aa) * 8) - 1, Math.round(by + Math.sin(aa) * 6) - 1, 2, 2); }
  }
  if (bite) { ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3d2a1a'; ctx.lineWidth = 3; ctx.strokeText('❗', p.fx, p.fy - 14); ctx.fillText('❗', p.fx, p.fy - 14 + Math.sin(t / 60) * 1.5); }
}
function drawPlayer(p, now, cx) {
  const ctx = cx || mainCtx, x = p.x, y = p.y;
  ctx.fillStyle = 'rgba(38,40,16,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 9, 3.5, 0, 0, 7); ctx.fill();
  PixelChar.draw(ctx, p, now); // ตัวละครพิกเซล chibi (pixelchar.js)
  if (p.lamp) drawHeldLamp(p, now);
  if (p.held && !p.sit) drawHeldTool(p, now); // ถืออุปกรณ์ที่เลือกอยู่ในมือ (ตะเกียงอยู่มืออีกข้าง)
  if (!p.name) return; // ตัวอย่างในตู้เสื้อผ้า ไม่ต้องวาดชื่อ
  // ป้ายชื่อ: กล่องกระดาษขอบเข้ม (สูงกว่าหัวตัวละครใหม่ ~9 px)
  const OUT = PixelArt.OUT, sp = !!p.speaking;
  ctx.font = `bold 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const w = Math.ceil(ctx.measureText(p.name).width) + 10, nx = Math.round(x - w / 2), ny = y - 40;
  ctx.fillStyle = OUT; ctx.fillRect(nx - 1, ny, w + 2, 14); ctx.fillRect(nx, ny - 1, w, 16);
  ctx.fillStyle = sp ? '#8fe6ac' : '#fff3d6'; ctx.fillRect(nx, ny, w, 14);
  ctx.fillStyle = sp ? '#4ab36e' : '#e2c896'; ctx.fillRect(nx, ny + 12, w, 2);
  ctx.fillStyle = '#3d2a1a'; ctx.fillText(p.name, x, y - 29);
  if (p.deaf) { const dt = '🔇'; ctx.font = `bold 10px ${FONT}`; const dw = Math.ceil(ctx.measureText(dt).width) + 8, dx = nx - dw - 3; ctx.fillStyle = OUT; ctx.fillRect(dx - 1, ny, dw + 2, 14); ctx.fillStyle = '#e07a66'; ctx.fillRect(dx, ny, dw, 14); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(dt, dx + 4, y - 28.5); ctx.textAlign = 'center'; ctx.font = `bold 11px ${FONT}`; }
  if (p.status) { ctx.font = `bold 10px ${FONT}`; const st = p.status, sw = Math.ceil(Math.min(150, ctx.measureText(st).width)) + 10; ctx.textAlign = 'center'; ctx.fillStyle = OUT; ctx.fillRect(Math.round(x - sw / 2) - 1, y + 15, sw + 2, 14); ctx.fillStyle = '#fff3d6'; ctx.fillRect(Math.round(x - sw / 2), y + 16, sw, 12); ctx.fillStyle = '#3d2a1a'; ctx.textBaseline = 'alphabetic'; ctx.fillText(st, x, y + 26, 140); }
  if (p.title) { ctx.font = `bold 9px ${FONT}`; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.strokeText(p.title, x, y - 43); ctx.fillStyle = '#ffd966'; ctx.fillText(p.title, x, y - 43); }
  if (p.voice) {
    ctx.font = '11px sans-serif'; ctx.fillText('🎙️', x + w / 2 + 8, y - 29);
    if (sp) { ctx.strokeStyle = 'rgba(46,204,113,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y + 12, 12 + Math.sin(now / 120) * 2, 0, 7); ctx.stroke(); }
  }
  // ฟองแชท
  if (p.chat && performance.now() - p.chatAt < 5000) {
    ctx.font = `12px ${FONT}`;
    const tw = Math.ceil(Math.min(160, ctx.measureText(p.chat).width)) + 14, bx = Math.round(x - tw / 2), by = y - 65;
    ctx.fillStyle = OUT; ctx.fillRect(bx - 1, by, tw + 2, 20); ctx.fillRect(bx, by - 1, tw, 22); ctx.fillRect(x - 5, by + 21, 10, 4);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, tw, 20); ctx.fillRect(x - 4, by + 20, 8, 4);
    ctx.fillStyle = '#333'; ctx.fillText(p.chat, x, y - 50, 150);
  }
}
const blinkOf = (c, now) => ((now / 1000 + (c.id || 0) * 1.3) % 4) < 0.14;
const blush = (bx, by, r) => { ctx.fillStyle = 'rgba(255,120,145,.55)'; ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill(); };
// สัตว์: สไปรต์พิกเซลจาก pixelui.js (หันขวา ซ้ายพลิกกลับ) ส่วนอีโมจิผลผลิต/หัวใจลอยเหนือหัววาดแบบพิกเซลเช่นกัน
const ANIMAL_SHADOW = { chicken: [7, 3, 7], duck: [7, 3, 7], sheep: [13, 4, 10], cow: [15, 5, 11], pig: [12, 4, 9] };
const ANIMAL_STEP = { chicken: 5, duck: 4.5, pig: 4, sheep: 3.5, cow: 3 }; // เฟรมเดินต่อวินาที (ตัวใหญ่ก้าวช้ากว่า)
function drawAnimalPx(type, c, now, top, prodE) {
  const x = c.x, y = c.y, moving = !!c.moving, sh = ANIMAL_SHADOW[type];
  const eat = !moving && (c.still || 0) > 0.8 && !c.sick && !c.prod && ((c.happyAt && now - c.happyAt < 1800) || ((now / 1000 + (c.id || 0) * 2.7) % 11) < 3); // หยุดนิ่งสักพักแล้วค่อยก้มกิน ไม่ก้มทันทีที่หยุด
  ctx.fillStyle = 'rgba(38,40,16,.3)'; ctx.beginPath(); ctx.ellipse(x, y + sh[2], sh[0], sh[1], 0, 0, 7); ctx.fill();
  const step = eat ? (((now / (type === 'chicken' ? 900 : 1500) + (c.id || 0) * 0.37) % 1) > 0.8 ? 1 : 0) : moving ? Math.floor(c.anim * (ANIMAL_STEP[type] || 4)) % 2 : 0;
  const hop = moving && (type === 'chicken' || type === 'duck') ? step : 0; // ไก่/เป็ดเด้งตัว 1 px ตามจังหวะก้าว
  PixelUI.animal(ctx, type, c, { f: c.lr || c.dx || 1, v: eat ? 's' : c.face || 's', eat, step, blink: blinkOf(c, now), prod: !!c.prod, hop });
  if (c.prod) PixelUI.world(ctx, prodE, x, y - top - 3 + Math.sin(now / 250) * 2, 14);
  else if (c.fed) PixelUI.world(ctx, '💗', x, y - top - 3, 14);
}
function drawDuck(c, now) { drawAnimalPx('duck', c, now, 14, '🥚'); }
function drawSheep(c, now) { drawAnimalPx('sheep', c, now, 22, '🧶'); }
const ANIMAL_DRAW = { duck: drawDuck, sheep: drawSheep, bee: drawBee }, ANIMAL_TOP = { chicken: 14, duck: 14, pig: 18, cow: 20, sheep: 20, bee: 9 };
function animalFx(c, now, top) { // หัวใจลอยตอนเพิ่งได้กินอาหาร / ความสุขเล็กๆ ตอนอิ่มดี / ประกายตอนมีผลผลิตพร้อมเก็บ
  const h = c.h === undefined ? 100 : c.h, t = now / 1000, ph = (t + (c.id || 0) * 3.7) % 9;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (c.happyAt && now - c.happyAt < 1800) { const k = (now - c.happyAt) / 1800; ctx.globalAlpha = 1 - k; for (let i = 0; i < 3; i++) PixelUI.world(ctx, '💗', c.x + (i - 1) * 9, c.y - top - k * 26 - i * 4 - 3, 11); ctx.globalAlpha = 1; }
  else if (!c.sick && h >= 80 && !c.prod && ph < 1.3) { const k = ph / 1.3; ctx.globalAlpha = 1 - k; PixelUI.world(ctx, '💕', c.x + Math.sin(t * 3) * 3, c.y - top - k * 14 - 3, 10); ctx.globalAlpha = 1; }
  if (c.prod) { const a = t * 2 + (c.id || 0); PixelUI.world(ctx, '✨', c.x + Math.cos(a) * 13, c.y - top * 0.5 + Math.sin(a) * 5, 11); }
  if (c.prod && c.lock && me && c.fn !== me.name) { // ผลผลิตของคนอื่น ยังเก็บไม่ได้ (เหมือนผัก): 🔒 + ชื่อเจ้าของ
    PixelUI.world(ctx, '🔒', c.x + 12, c.y - top - 6, 11);
    ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = '#3d2a1a'; ctx.strokeText(c.fn, c.x, c.y + 18); ctx.fillStyle = '#ffe9a8'; ctx.fillText(c.fn, c.x, c.y + 18);
  }
}
function drawChicken(c, now) { drawAnimalPx('chicken', c, now, 14, '🥚'); }
function drawCow(c, now) { drawAnimalPx('cow', c, now, 20, '🥛'); }
function drawPig(c, now) { drawAnimalPx('pig', c, now, 18, '🍄'); }
function drawBee(c, now) { // ผึ้ง: บินวนรอบรังเล็กๆ ปีกกระพือเร็ว ลอยเหนือพื้นนิดหน่อย • มีน้ำผึ้งพร้อมเก็บให้เห็นเป็น 🍯 เหนือหัว
  const hov = 9 + Math.sin(now / 180 + (c.id || 0)) * 1.5;
  ctx.fillStyle = 'rgba(38,40,16,.22)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 6, 4, 1.4, 0, 0, 7); ctx.fill();
  PixelUI.animal(ctx, 'bee', c, { f: c.lr || c.dx || 1, step: Math.floor(now / 90) % 2, hop: hov });
  if (c.prod) PixelUI.world(ctx, '🍯', c.x, c.y - hov - 14 + Math.sin(now / 250) * 2, 12);
}
// รังผึ้ง (ลัง) ตั้งข้างต้นไม้ถาวร • ขึ้นไอคอนน้ำผึ้งเมื่อมีผึ้งที่รังนี้ผลิตน้ำผึ้งเสร็จแล้ว
function drawHive(hx, hy, now) {
  const x = hx * TS + 5, y = hy * TS + 2;
  let ready = false; animals.forEach(a => { if (a.type === 'bee' && a.prod && Math.hypot(a.x - (hx + 0.5) * TS, a.y - (hy + 0.5) * TS) < 1.8 * TS) ready = true; });
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + 1, y + 24, 20, 4);
  ctx.fillStyle = '#c98b3c'; ctx.fillRect(x + 1, y + 9, 20, 16);   // ตัวลัง
  ctx.fillStyle = '#e0a552'; ctx.fillRect(x + 1, y + 9, 20, 3);    // ขอบบน
  ctx.fillStyle = '#9a6328'; ctx.fillRect(x + 1, y + 15, 20, 1); ctx.fillRect(x + 1, y + 20, 20, 1); // ร่องไม้
  ctx.fillStyle = '#7a4a1e'; ctx.fillRect(x - 1, y + 6, 24, 4);    // ฝาลัง
  ctx.fillStyle = '#2a1b0e'; ctx.fillRect(x + 8, y + 16, 6, 3);    // ช่องทางเข้าของผึ้ง
  if (ready) PixelUI.world(ctx, '🍯', x + 11, y + 2 + Math.sin(now / 250) * 2, 12);
}
// ป้ายเล็กประจำคอก: อีโมจิ ชื่อ และจำนวนตัวปัจจุบัน/ความจุ
function drawPenSign(key) {
  const P = Shared.PENS[key], A = ANIMALS[key], cx = (P.sign[0] + 0.5) * TS, cy = (P.sign[1] + 0.5) * TS;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(cx - 27, cy + 2, 56, 3);
  ctx.fillStyle = '#6b4423'; ctx.fillRect(cx - 1.5, cy - 1, 3, 11);                       // เสาป้าย
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(cx - 28, cy - 12, 56, 14);                      // กรอบป้าย
  ctx.fillStyle = '#e8c48a'; ctx.fillRect(cx - 26, cy - 10, 52, 10);                      // แผ่นไม้
  ctx.font = `bold 8px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#3d2a1a';
  ctx.fillText(`${A.emoji} ${A.name} ${animalCount(key)}/${A.cap}`, cx, cy - 6);
}
function drawPet(q, now) { // แมว (นั่งเมื่อหยุด) และหมา 2 สี (ยืนกระดิกหางเมื่อหยุด)
  const type = q.kind === 'dog' ? 'dog' + (q.v || 0) : 'cat', cat = q.kind !== 'dog', idle = !q.moving;
  ctx.fillStyle = 'rgba(38,40,16,.3)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + (cat ? 6 : 7), cat ? 4 : 6, cat ? 1.6 : 2, 0, 0, 7); ctx.fill();
  const ph = Math.sin(q.anim * (cat ? 9 : 11)), wag = Math.floor(now / (cat ? 700 : 220)) % 2;
  PixelUI.animal(ctx, type, q, { f: q.dx || 1, step: idle ? wag : (ph > 0 ? 1 : 0), blink: blinkOf(q, now), idle });
}
const PET_TOP = { dog: 14, cat: 12, bird: 20, monkey: 18, capy: 14 }; // ความสูงจากพื้นถึงหัว ใช้วางชื่อ/อีโมจิ
function drawCompanion(q, now) { // สัตว์เลี้ยงคู่ใจ: หมา/แมวใช้ภาพเดียวกับสัตว์ประกอบฉาก นกวาดเองตัวเล็กๆ บินต่ำเกาะตามหลังเจ้าของ
  if (q.x < camX - 40 || q.x > camX + vw + 40 || q.y < camY - 40 || q.y > camY + vh + 40) return;
  if (q.kind === 'bird') {
    const fly = q.moving, hop = fly ? Math.abs(Math.sin(q.anim * 14)) * 3 : Math.max(0, Math.sin(now / 900 + q.id) * 2 - 1.2), by = q.y - 4 - (fly ? 7 : 0) - hop, f = q.dx || 1;
    ctx.fillStyle = 'rgba(38,40,16,.3)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + 6, 4, 1.4, 0, 0, 7); ctx.fill();
    const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(q.x + x * f - (f < 0 ? w : 0)), Math.round(by + y), w, h); };
    R(PixelArt.OUT, -5, -5, 10, 9); R(PixelArt.OUT, 3, -8, 6, 6);                        // ขอบ 1 px
    R('#4aa8e8', -4, -4, 8, 7); R('#8fd0ff', -3, -3, 5, 3); R('#f4efe0', -3, 1, 6, 2);   // ตัวสีฟ้า ท้องขาว
    R('#4aa8e8', 4, -7, 4, 4); R('#8fd0ff', 4, -7, 2, 2); R('#1b1d33', 6, -6, 1, 1);      // หัว + ตา
    R('#f2a33a', 8, -5, 2, 2);                                                           // จะงอยปาก
    R('#2f7fb8', -7, -2, 3, 2);                                                          // หาง
    R('#2f7fb8', -2, fly ? -6 - Math.round(Math.sin(q.anim * 28) * 2) : -2, 4, 2);       // ปีก (กระพือเมื่อบิน)
    if (!fly) { R('#f2a33a', -1, 4, 1, 2); R('#f2a33a', 1, 4, 1, 2); }
  } else if (q.kind === 'monkey' || q.kind === 'capy') {
    const f = q.dx || 1, walk = q.moving, ph = Math.sin(q.anim * 12), bob = walk ? Math.abs(ph) * 1.5 : 0, y0 = q.y - bob, O = PixelArt.OUT;
    ctx.fillStyle = 'rgba(38,40,16,.3)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + 6, q.kind === 'capy' ? 8 : 5, 2, 0, 0, 7); ctx.fill();
    const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(q.x + x * f - (f < 0 ? w : 0)), Math.round(y0 + y), w, h); };
    const blink = blinkOf(q, now);
    if (q.kind === 'monkey') {
      const tail = Math.sin(now / 260) > 0 ? 0 : 1;
      R(O, -9, -6 - tail, 3, 9); R(O, -9, -8 - tail, 5, 3); R('#6b4423', -8, -5 - tail, 1, 8); R('#6b4423', -8, -7 - tail, 3, 1); // หางโค้งชูขึ้น
      R(O, -5, -7, 10, 11); R('#7a4d28', -4, -6, 8, 9); R('#a8703c', -4, -6, 3, 3); R('#d9b183', -2, -2, 5, 4); // ตัว ท้องสีครีม
      R(O, 1, -14, 10, 9); R('#7a4d28', 2, -13, 8, 7); R('#d9b183', 4, -11, 6, 5); R('#a8703c', 2, -13, 3, 2); // หัว หน้าสีครีม
      R(O, -1, -12, 4, 4); R('#d9b183', 0, -11, 2, 2);                                                         // หู
      R(blink ? '#d9b183' : '#1b1d33', 6, -10, 1, blink ? 0 : 2); R('#1b1d33', 9, -8, 1, 1);                  // ตา จมูก
      const s1 = walk ? Math.round(ph * 2) : 0;
      R(O, -4, 3, 3, 4); R('#6b4423', -3 + s1, 3, 2, 3); R(O, 1, 3, 3, 4); R('#6b4423', 2 - s1, 3, 2, 3);      // ขา
      R('#7a4d28', 3, -3, 3, 2);                                                                              // แขน
    } else {
      R(O, -11, -6, 22, 12); R('#9a6b3d', -10, -5, 20, 10); R('#b98652', -9, -5, 12, 3); R('#7d5430', -10, 2, 20, 3); // ลำตัวอ้วนกลม
      R(O, 8, -8, 8, 10); R('#9a6b3d', 9, -7, 6, 8); R('#b98652', 9, -7, 4, 2); R('#6e4a2a', 14, -3, 2, 4);      // หัว/จมูกบื้อ
      R(O, 9, -10, 3, 3); R('#7d5430', 10, -9, 1, 1);                                                          // หู
      R(blink ? '#9a6b3d' : '#1b1d33', 12, -6, 1, blink ? 0 : 2); R('#2a1b14', 15, -3, 1, 1);                  // ตา รูจมูก
      const s1 = walk ? Math.round(ph * 2) : 0;
      R(O, -8, 5, 4, 4); R('#7d5430', -7 + s1, 5, 2, 3); R(O, 4, 5, 4, 4); R('#7d5430', 5 - s1, 5, 2, 3);      // ขาสั้นๆ
    }
  } else {
    drawPet(q, now);
  }
  if (q.name) { ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; const ny = q.y - (PET_TOP[q.kind] || 12), nw = Math.ceil(ctx.measureText(q.name).width) + 6; ctx.fillStyle = 'rgba(42,27,20,.75)'; ctx.fillRect(Math.round(q.x - nw / 2), ny - 10, nw, 11); ctx.fillStyle = '#fff3d6'; ctx.fillText(q.name, q.x, ny - 1); }
  if (q.sick) PixelUI.world(ctx, '🤒', q.x, q.y - (PET_TOP[q.kind] || 12) - 4 + Math.sin(now / 200), 13);
  else if (q.sayAt && now - q.sayAt < 1800) { const t = (now - q.sayAt) / 1800; PixelUI.world(ctx, '💕', q.x + 6, q.y - (PET_TOP[q.kind] || 12) - 2 - t * 12, 11); }
}
function hungerMark(c, now) { // สัตว์ที่หิว: แถบความอิ่มเล็กๆ + หน้าตาเศร้า (หิวจนหมดแล้วจะตายถ้าไม่มีใครให้อาหาร) / สัตว์ป่วยมี 🤒
  const h = c.h === undefined ? 100 : c.h;
  const x = c.x, y = c.y - (({ cow: 28, sheep: 26, pig: 24 })[c.type] || 20);
  if (c.sick) { PixelUI.world(ctx, '🤒', x, y - 9 + Math.sin(now / 180) * 1.5, 15); ctx.fillStyle = 'rgba(80,200,120,.22)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 2, 16, 12, 0, 0, 7); ctx.fill(); }
  if (h >= 60) return;
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - 11, y, 22, 4);
  ctx.fillStyle = h <= 0 ? '#e74c3c' : h < 35 ? '#e67e22' : '#f1c40f'; ctx.fillRect(x - 10, y + 1, 20 * Math.max(0.06, h / 100), 2);
  if (h < 35) { PixelUI.world(ctx, h <= 0 ? (Math.sin(now / 200) > 0 ? '💀' : '😢') : '🥺', x + 15, y + 1, 13); }
}
const BFLY = Array.from({ length: 8 }, (_, i) => ({ cx: 47 + (i * 7) % 13, cy: 10 + (i * 5) % 15, ph: i * 1.7, col: ['#ff8fc7', '#ffd24a', '#8fd0ff', '#c79bff'][i % 4] }));
function drawButterflies(now) { // ผีเสื้อบินวนแถวคอกสัตว์ ให้ฟาร์มดูมีชีวิต
  for (const b of BFLY) {
    const t = now / 1000 + b.ph, bx = (b.cx + Math.sin(t * 0.7) * 3.2) * TS, by = (b.cy + Math.sin(t * 0.9 + 1) * 2.2) * TS - 10 + Math.sin(t * 5) * 2;
    if (bx < camX - 20 || bx > camX + vw + 20 || by < camY - 20 || by > camY + vh + 20) continue;
    const w = Math.abs(Math.sin(t * 14)) * 4 + 1; ctx.fillStyle = b.col; ctx.beginPath(); ctx.ellipse(bx - 2, by, w, 3, -0.3, 0, 7); ctx.ellipse(bx + 2, by, w, 3, 0.3, 0, 7); ctx.fill(); ctx.fillStyle = '#4a3a2a'; ctx.fillRect(bx - 0.6, by - 2, 1.2, 4);
  }
}
function drawCrop(tile, px, py, now) {
  ctx.drawImage(PixelArt.soil(tile.w), px, py, TS, TS);
  if (!tile.c) return;
  const cx = px + 16, cy = py + 27, s = tile.s, sp = PixelUI.crop(s);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sp, cx - sp.width, cy - sp.height * 2, sp.width * 2, sp.height * 2);
  if (s >= 3) {
    PixelUI.world(ctx, CROPS[tile.c].emoji, cx, cy - 14 + Math.sin(now / 400 + px) * 1, 22);
    if (tile.o && me && tile.o !== me.name) PixelUI.world(ctx, tile.l ? '🔒' : '✨', px + 25, py + 8, 12); // ผักของคนอื่น: 🔒 ยังเก็บไม่ได้ / ✨ เจ้าของไม่มาเก็บเกิน 1 วัน คนอื่นเก็บได้แล้ว
  }
}
function daylight(h) { // ความมืด 0..0.75 (กลางคืนยังพอเห็นทาง สว่างที่กองไฟ/ตะเกียงชัดกว่า) สว่างนาน มืดสั้น
  const MAXD = 0.75;
  if (h >= 6.5 && h < 19) return 0;
  if (h >= 19 && h < 21) return (h - 19) / 2 * MAXD;
  if (h >= 21 || h < 4) return MAXD;
  if (h < 5.5) return MAXD * (1 - (h - 4) / 1.5); // 04:00–05:30 ค่อยๆ สว่าง
  return 0;
}
// ชั้นความมืด: เติมสีทึบแล้ว "เจาะ" วงสว่างที่กองไฟกลางลานและรอบตัวคนที่ถือตะเกียง (รัศมี 3 ช่อง)
const lightCv = document.createElement('canvas'), lctx = lightCv.getContext('2d');
function drawNight(dark, now) {
  if (dark <= 0.02) return;
  if (lightCv.width !== canvas.width || lightCv.height !== canvas.height) { lightCv.width = canvas.width; lightCv.height = canvas.height; }
  lctx.globalCompositeOperation = 'source-over'; lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, lightCv.width, lightCv.height);
  lctx.fillStyle = `rgba(5,9,32,${dark})`; lctx.fillRect(0, 0, lightCv.width, lightCv.height);
  lctx.globalCompositeOperation = 'destination-out'; lctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
  const hole = (x, y, r, inner) => { const g = lctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(inner, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.beginPath(); lctx.arc(x, y, r, 0, 7); lctx.fill(); };
  const fx = FIRE.x * TS + 16, fy = FIRE.y * TS + 12, fr = TS * 10.5 * (1 + Math.sin(now / 130) * 0.02 + Math.sin(now / 71) * 0.015);
  if (!scene) hole(fx, fy, fr, 0.3);
  const LH = !scene && builtProj.has('lighthouse') && Shared.LIGHTHOUSE, lx = LH ? (LH.x0 + (LH.x1 - LH.x0 + 1) / 2) * TS : 0, ly = LH ? LH.y0 * TS + 39 : 0, lAng = now / 1800; // ประภาคาร: ห้องตะเกียงอยู่ใกล้ยอดหอ ลำแสงหมุนรอบ ~11 วินาที
  const beam = (r, half, ang, a0) => { const g = lctx.createRadialGradient(lx, ly, 0, lx, ly, r); g.addColorStop(0, `rgba(0,0,0,${a0})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.beginPath(); lctx.moveTo(lx, ly); lctx.arc(lx, ly, r, ang - half, ang + half); lctx.closePath(); lctx.fill(); };
  if (LH) { hole(lx, ly, TS * 7 * (1 + Math.sin(now / 400) * 0.02), 0.25); beam(TS * 18, 0.2, lAng, 0.95); beam(TS * 18, 0.2, lAng + Math.PI, 0.95); }
  const pj = (x, y, z = 0) => (scene ? [x - y, (x + y) / 2 - z] : [x, y]); // ในบ้านวาดแบบไอโซเมตริก ฉายตำแหน่งแสงด้วย
  for (const p of players.values()) if (p.lamp) hole(...pj(p.x, p.y, 4), TS * 5, 0.82);
  for (const o of furn.values()) if (FURN[o.f].light) hole(...pj(o.x * TS, o.y * TS, (o.z || 0) + 22), TS * 3.2, 0.6); // โคมไฟในบ้าน
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lightCv, 0, 0);
  // แสงอุ่นสีส้มบางๆ ซ้อนทับบริเวณที่สว่าง
  ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom); ctx.globalCompositeOperation = 'lighter';
  const warm = (x, y, r, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,150,50,${a})`); g.addColorStop(1, 'rgba(255,150,50,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  if (LH) { // แสงเหลืองนวลรอบห้องตะเกียงและตามลำแสง
    const wg = (x, y, r, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,232,150,${a})`); g.addColorStop(1, 'rgba(255,232,150,0)'); ctx.fillStyle = g; };
    wg(lx, ly, TS * 6, 0.4 * Math.min(1, dark * 1.3)); ctx.beginPath(); ctx.arc(lx, ly, TS * 6, 0, 7); ctx.fill();
    for (const a of [lAng, lAng + Math.PI]) { wg(lx, ly, TS * 18, 0.22 * Math.min(1, dark * 1.3)); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.arc(lx, ly, TS * 18, a - 0.2, a + 0.2); ctx.closePath(); ctx.fill(); }
  }
  if (!scene) warm(fx, fy, fr * 0.8, 0.28 * Math.min(1, dark * 1.2)); for (const p of players.values()) if (p.lamp) warm(...pj(p.x, p.y, 4), TS * 5, 0.16 * Math.min(1, dark * 1.2));
  ctx.globalCompositeOperation = 'source-over'; ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------- Mini map (ย่อ/ขยาย/ซ่อนได้ ทั้ง PC และมือถือ) ----------
let miniBase = makeMiniBase();
function makeMiniBase() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const col = { [T.GRASS]: '#7bc65a', [T.WATER]: '#4aa3df', [T.TREE]: '#3f9a3a', [T.BUILD]: '#c9a86a', [T.PATH]: '#dcbf82', [T.FENCE]: '#8b5a2b', [T.SAND]: '#efdfa4', [T.SHOP]: '#a0692f', [T.FLOOR]: '#c99a5b', [T.FURN]: '#c99a5b', [T.BRIDGE]: '#a8703a', [T.LANDMARK]: '#b0453a', [T.WALL]: '#8b5a2b', [T.VOID]: '#17110d' };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { g.fillStyle = (MAP[y][x] === T.GRASS && inFarm(x, y)) ? '#8bbf5a' : col[MAP[y][x]]; g.fillRect(x, y, 1, 1); }
  if (!scene) for (const b of BUILDINGS) { g.fillStyle = b.roof; g.fillRect(b.x0, b.y0, b.x1 - b.x0 + 1, 1); }
  return c;
}
function layoutHud() { // แผนที่อยู่มุมบนขวาสุด แถบปุ่มด้านบนเว้นที่ให้ ไม่ทับกัน • คู่มือ/แชทอยู่ใต้แถบปุ่ม
  const mw = $('mini').classList.contains('hidden') ? 0 : $('mini').offsetWidth;
  $('hudTop').style.right = `calc(${mw ? mw + 24 : 8}px + var(--sar, 0px))`;
  const top = Math.round($('hudTop').getBoundingClientRect().bottom + 6);
  $('guide').style.top = top + 'px';
  if (isTouch) $('chat').style.top = top + 'px';
}
function sizeMini() {
  const dpr = window.devicePixelRatio || 1, cv = $('miniMap');
  const w = miniState === 'big' ? Math.min(innerWidth * 0.62, 380) : Math.min(innerWidth * (isTouch ? 0.3 : 0.4), isTouch ? 130 : 190), h = w * H / W;
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
}
function setMini(s) {
  miniState = s; ls.set('mw_mini', s);
  $('mini').classList.toggle('off', s === 'off');
  $('miniHide').textContent = s === 'off' ? '➕' : '➖';
  sizeMini(); layoutHud();
}
$('miniSize').onclick = () => setMini(miniState === 'big' ? 'small' : 'big');
$('miniMap').onclick = () => setMini(miniState === 'big' ? 'small' : 'big');
$('miniHide').onclick = () => setMini(miniState === 'off' ? 'small' : 'off');
addEventListener('resize', () => { sizeMini(); layoutHud(); });
if (window.ResizeObserver) new ResizeObserver(layoutHud).observe($('hudTop'));
let lastMini = 0;
function drawGuideArrow(now) { // ลูกศรนำทางไปข้อถัดไปของคู่มือเริ่มต้น (หายเมื่อเดินถึงที่หมายแล้ว)
  const st = questSt.starter, next = me && st && !st.final && STARTER.find(s => !st.done.includes(s.id)), go = next && STARTER_GO[next.id];
  if (!go) return;
  const dx = (go[0] + 0.5) * TS - me.x, dy = (go[1] + 0.5) * TS - me.y, dist = Math.hypot(dx, dy) / TS;
  if (dist < 4) return;
  const a = Math.atan2(dy, dx), sx = (me.x - camX) * zoom, sy = (me.y - camY) * zoom, r = 64 + Math.sin(now / 250) * 4, ax = sx + Math.cos(a) * r, ay = sy + Math.sin(a) * r;
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
  ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-3, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.font = `bold 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
  const tx = sx + Math.cos(a) * (r + 26), ty = sy + Math.sin(a) * (r + 26), t = Math.round(dist) + ' ช่อง';
  ctx.strokeText(t, tx, ty); ctx.fillStyle = '#fff'; ctx.fillText(t, tx, ty);
}
function drawMini(now) {
  if (miniState === 'off' || now - lastMini < 90) return;
  lastMini = now;
  const cv = $('miniMap'), g = cv.getContext('2d'), cw = cv.width, ch = cv.height, sx = cw / W, sy = ch / H, k = cw / parseFloat(cv.style.width), big = miniState === 'big';
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false; g.drawImage(miniBase, 0, 0, cw, ch);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${Math.round((big ? 15 : 11) * k)}px sans-serif`;
  if (!scene) for (const b of BUILDINGS) g.fillText(b.sign, (b.x0 + b.x1 + 1) / 2 * sx, (b.y0 + b.y1 + 1) / 2 * sy + 2 * k);
  if (!scene) { g.fillText('🏠', (Shared.HOUSE_DOOR.x + 0.5) * sx, 3 * sy); g.fillText('🌾', 14 * sx, 12.5 * sy); g.fillText('🐄', 54 * sx, 21 * sy); g.fillText('🌊', 43 * sx, 38 * sy); g.fillText('🐖', 59.5 * sx, 11.5 * sy); g.fillText('🔥', FIRE.x * sx + sx / 2, FIRE.y * sy + sy / 2); }
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 1.5 * k; g.strokeRect(camX / TS * sx, camY / TS * sy, vw / TS * sx, vh / TS * sy);
  const list = [...players.values()].sort((a, b) => (a === me) - (b === me));
  g.font = `bold ${Math.round((big ? 11 : 9) * k)}px ${FONT}`;
  for (const p of list) {
    const x = p.x / TS * sx, y = p.y / TS * sy, r = (p === me ? 5 : 4) * k;
    if (p === me) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2 * k; g.beginPath(); g.arc(x, y, r + 3 * k + Math.sin(now / 200) * 1.5 * k, 0, 7); g.stroke(); }
    g.fillStyle = p.color; g.strokeStyle = '#fff'; g.lineWidth = 1.8 * k; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
    g.lineWidth = 3 * k; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(p.name, x, y - r - 5 * k);
    g.fillStyle = p === me ? '#ffe680' : '#fff'; g.fillText(p.name, x, y - r - 5 * k);
  }
}

// ---------- main loop ----------
let last = performance.now();
// ประภาคารกลางน้ำ: วาดเป็นชั้นบนสุดของโลก (ทับปลา ใบบัว และประกายน้ำ) • ฐานเป็นเกาะทราย
function drawLighthouse(g, now) {
  if (!builtProj.has('lighthouse')) return;
  const L = Shared.LIGHTHOUSE, bx = L.x0 * TS, by = L.y0 * TS, w = (L.x1 - L.x0 + 1) * TS, h = (L.y1 - L.y0 + 1) * TS, cx = bx + w / 2;
  g.save(); g.translate(cx, by + h); g.scale(0.8, 0.8); g.translate(-cx, -(by + h)); // ย่อ 80% จากฐาน (ตัวตันยังเท่าเดิม แค่ภาพเล็กลง)
  // ฐานเป็นเกาะทรายเล็กๆ รอบตัวหอ (ขอบเข้มก่อน แล้วทรายทับ)
  g.fillStyle = '#d9c383'; g.beginPath(); g.ellipse(cx, by + h - 6, 42, 20, 0, 0, 7); g.fill();
  g.fillStyle = '#efdfa4'; g.beginPath(); g.ellipse(cx, by + h - 8, 40, 18, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(bx + 2, by + h - 8, w - 4, 9);
  g.fillStyle = '#7d828c'; g.fillRect(bx + 4, by + h - 22, w - 8, 18); g.fillStyle = '#a3a8b2'; g.fillRect(bx + 4, by + h - 22, w - 8, 4);
  const top = by + 30, bottom = by + h - 22;
  for (let y = top; y < bottom; y += 4) {
    const t = (y - top) / (bottom - top), half = 13 + t * 9, stripe = Math.floor((y - top) / 18) % 2;
    g.fillStyle = stripe ? '#c0392b' : '#eee8da'; g.fillRect(cx - half, y, half * 2, 4);
    g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(cx + half - 5, y, 5, 4); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(cx - half, y, 3, 4);
  }
  g.fillStyle = '#3a3f4a'; g.fillRect(cx - 19, by + 24, 38, 6); g.fillRect(cx - 17, by + 30, 3, 5); g.fillRect(cx + 14, by + 30, 3, 5);
  g.fillStyle = '#ffe08a'; g.fillRect(cx - 11, by + 10, 22, 14); g.fillStyle = '#fff6cf'; g.fillRect(cx - 8, by + 12, 8, 9);
  g.fillStyle = '#3a3f4a'; g.fillRect(cx - 12, by + 9, 24, 2); g.fillRect(cx - 12, by + 23, 24, 2); g.fillRect(cx - 1, by + 10, 2, 14);
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#a82f23' : '#c0392b'; g.fillRect(cx - 14 + i * 2, by + 9 - i * 2, 28 - i * 4, 2); }
  g.fillStyle = '#f1c40f'; g.fillRect(cx - 1, by - 5, 2, 4);
  // นกนางนวลเกาะอยู่บนยอดหอ ขยับตัวเบาๆ (แกว่งหัว กระพือปีกเล็กน้อย) กะพริบตานานๆ
  const gx = cx + 6, bob = Math.sin(now / 700) * 0.5, sway = Math.sin(now / 1300) * 0.6, flap = Math.sin(now / 260) * 0.35;
  const gy = by - 2 + bob, blink = now % 4200 < 130;
  g.fillStyle = '#3a3f4a'; g.beginPath(); g.ellipse(gx, gy, 5.5, 3.8, -0.1, 0, 7); g.fill(); // ขอบลำตัว
  g.fillStyle = '#f4f4f4'; g.beginPath(); g.ellipse(gx, gy, 4.5, 2.8, -0.1, 0, 7); g.fill();
  g.fillStyle = '#b8c4cc'; g.beginPath(); g.ellipse(gx - 1.5, gy - 0.5 - flap, 3.6, 1.8 + flap * 0.4, -0.25, 0, 7); g.fill(); // ปีก
  g.fillStyle = '#3a3f4a'; g.fillRect(gx - 6.5, gy + 1.2, 2.5, 3.8); // ขา
  g.fillStyle = '#f39c12'; g.fillRect(gx - 6, gy + 3.5, 1.5, 1.5);
  const hx = gx + 3.8, hy = gy - 3.6 + sway;
  g.fillStyle = '#3a3f4a'; g.beginPath(); g.arc(hx, hy, 3.3, 0, 7); g.fill(); // ขอบหัว
  g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(hx, hy, 2.6, 0, 7); g.fill();
  g.fillStyle = '#f1c40f'; g.beginPath(); g.moveTo(hx + 2.2, hy - 0.6); g.lineTo(hx + 5.4, hy + 0.2); g.lineTo(hx + 2.2, hy + 0.9); g.fill(); // จงอย
  g.fillStyle = '#ffb3b3'; g.fillRect(hx - 0.4, hy + 0.9, 1.4, 1); // แก้มชมพู
  if (blink) { g.fillStyle = '#3a3f4a'; g.fillRect(hx + 0.2, hy - 0.7, 1.6, 0.6); }
  else { g.fillStyle = '#1b1f2a'; g.beginPath(); g.arc(hx + 0.9, hy - 0.5, 0.95, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(hx + 0.4, hy - 1.1, 0.5, 0.5); } // ตาดำมีประกาย
  g.restore();
}

// ---------- บ้านหลังใหญ่: ภาพไอโซเมตริก + ตกแต่งอิสระ ----------
// พิกัดโลกของบ้านยังเป็นพิกเซลแบบเดิม (ช่อง = TS px) แต่วาดฉายเป็นมุมเฉียง 2:1: จอ x = X − Y, จอ y = (X + Y) / 2 − ความสูง
// ของแต่ละชิ้นวาดจากกล่อง 3 ด้านซ้อนกันเป็นสไปรต์ (ไม่ใช้อีโมจิ) วางตำแหน่งอิสระละเอียด ¼ ช่อง ดูกติกาที่ houseCheck ใน shared.js
const HF = Shared.HFLOOR, FX0 = HF.x0 * TS, FX1 = HF.x1 * TS, FY0 = HF.y0 * TS, FY1 = HF.y1 * TS, WALL_H = 96, INK = '#2a1b14';
const iso = (X, Y, z = 0) => [X - Y, (X + Y) / 2 - z];       // พื้นโลก (px) → จอไอโซเมตริก
const unIso = (sx, sy) => [sy + sx / 2, sy - sx / 2];       // จอ → พื้นโลก (ที่ความสูง 0)
const ISO_B = { x0: FX0 - FY1 - 40, y0: (FX0 + FY0) / 2 - WALL_H - 40, x1: FX1 - FY0 + 40, y1: (FX1 + FY1) / 2 + 60 };
ISO_B.w = ISO_B.x1 - ISO_B.x0; ISO_B.h = ISO_B.y1 - ISO_B.y0;
const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const tint = (hex, k) => `rgb(${rgbOf(hex).map(v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)))).join(',')})`; // k<0 เข้มขึ้น k>0 สว่างขึ้น
function poly(g, pts, fill, stroke) {
  g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
}
const pip = (pts, x, y) => { let on = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) on = !on; } return on; };
// กล่อง 3 ด้าน: (X,Y) = กึ่งกลางฐาน w×d px ตั้งแต่ความสูง z0 สูง h • ซ้ายล่างหันหาผู้เล่น ขวาล่างเข้มกว่า (แสงมาจากซ้ายบน)
function ibox(g, X, Y, w, d, z0, h, c, o = {}) {
  const x0 = X - w / 2, x1 = X + w / 2, y0 = Y - d / 2, y1 = Y + d / 2, zt = z0 + h, st = o.flat ? null : INK;
  poly(g, [iso(x0, y1, zt), iso(x1, y1, zt), iso(x1, y1, z0), iso(x0, y1, z0)], o.left || tint(c, -0.1), st);
  poly(g, [iso(x1, y0, zt), iso(x1, y1, zt), iso(x1, y1, z0), iso(x1, y0, z0)], o.right || tint(c, -0.3), st);
  poly(g, [iso(x0, y0, zt), iso(x1, y0, zt), iso(x1, y1, zt), iso(x0, y1, zt)], o.top || tint(c, 0.15), st);
}
// แผ่นสีบนด้านของกล่อง (u0..u1 = สัดส่วนตามด้าน): L = ด้านซ้ายล่าง (y = y1) R = ด้านขวาล่าง (x = x1)
const faceL = (g, X, Y, w, d, u0, u1, z0, z1, c) => poly(g, [iso(X - w / 2 + u0 * w, Y + d / 2, z1), iso(X - w / 2 + u1 * w, Y + d / 2, z1), iso(X - w / 2 + u1 * w, Y + d / 2, z0), iso(X - w / 2 + u0 * w, Y + d / 2, z0)], c);
const faceR = (g, X, Y, w, d, u0, u1, z0, z1, c) => poly(g, [iso(X + w / 2, Y - d / 2 + u0 * d, z1), iso(X + w / 2, Y - d / 2 + u1 * d, z1), iso(X + w / 2, Y - d / 2 + u1 * d, z0), iso(X + w / 2, Y - d / 2 + u0 * d, z0)], c);
const backSlab = (X, Y, W, D, r, t) => (r ? [X - W / 2 + t / 2, Y, t, D] : [X, Y - D / 2 + t / 2, W, t]); // แผ่นบางชิดด้านหลัง (r=0 ชิดเหนือ, r=1 ชิดตะวันตก)
const dot = (g, X, Y, z, rx, ry, c) => { const [px, py] = iso(X, Y, z); g.fillStyle = c; g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, 7); g.fill(); };
// สไปรต์เฟอร์นิเจอร์: (g, X, Y = กึ่งกลางฐาน, W, D = ขนาดฐาน px หลังหมุน, r = หมุนไหม, d = ข้อมูลใน FURN, now)
const ART = {
  rug(g, X, Y, W, D) {
    const q = (k, c, s) => poly(g, [iso(X - W / 2 + k, Y - D / 2 + k, 1), iso(X + W / 2 - k, Y - D / 2 + k, 1), iso(X + W / 2 - k, Y + D / 2 - k, 1), iso(X - W / 2 + k, Y + D / 2 - k, 1)], c, s);
    q(0, '#8c2a22', INK); q(3, '#e8c66a'); q(6, '#c0453a'); q(14, '#a8322a');
    poly(g, [iso(X, Y - 7, 1), iso(X + 12, Y, 1), iso(X, Y + 7, 1), iso(X - 12, Y, 1)], '#e8c66a');
  },
  chair(g, X, Y, W, D, r) {
    const [bx, by, bw, bd] = backSlab(X, Y, W * 0.9, D * 0.9, r, 5);
    ibox(g, bx, by, bw, bd, 0, 30, '#a8703a');
    ibox(g, X, Y, W * 0.9, D * 0.9, 0, 12, '#c98b4a');
    ibox(g, X, Y, W * 0.7, D * 0.7, 12, 3, '#d65a4a', { flat: true });
  },
  sofa(g, X, Y, W, D, r) {
    const c = '#4a6fa5', [bx, by, bw, bd] = backSlab(X, Y, W, D, r, (r ? W : D) * 0.3);
    ibox(g, bx, by, bw, bd, 0, 32, tint(c, -0.1) && '#3d5d8f');
    if (r) ibox(g, X, Y - D / 2 + 5, W, 10, 0, 22, '#3d5d8f'); else ibox(g, X - W / 2 + 5, Y, 10, D, 0, 22, '#3d5d8f');
    ibox(g, X, Y, W, D, 0, 12, c);
    if (r) { ibox(g, X, Y - D * 0.22, W * 0.7, D * 0.4, 12, 4, '#5e86bd', { flat: true }); ibox(g, X, Y + D * 0.22, W * 0.7, D * 0.4, 12, 4, '#5e86bd', { flat: true }); }
    else { ibox(g, X - W * 0.22, Y + D * 0.08, W * 0.4, D * 0.7, 12, 4, '#5e86bd', { flat: true }); ibox(g, X + W * 0.22, Y + D * 0.08, W * 0.4, D * 0.7, 12, 4, '#5e86bd', { flat: true }); }
    if (r) ibox(g, X, Y + D / 2 - 5, W, 10, 0, 22, '#3d5d8f'); else ibox(g, X + W / 2 - 5, Y, 10, D, 0, 22, '#3d5d8f');
  },
  table(g, X, Y, W, D) {
    const lg = (dx, dy) => ibox(g, X + dx * (W / 2 - 5), Y + dy * (D / 2 - 5), 5, 5, 0, 13, '#8b5a2b');
    lg(-1, -1); lg(1, -1); lg(-1, 1); lg(1, 1);
    ibox(g, X, Y, W, D, 13, 4, '#c98b4a');
    ibox(g, X - W * 0.18, Y, 13, 13, 17, 1.5, '#f4f4f4', { flat: true }); ibox(g, X + W * 0.2, Y + D * 0.12, 8, 8, 17, 6, '#e8e1d0');
  },
  bed(g, X, Y, W, D, r) {
    const [hx, hy, hw, hd] = backSlab(X, Y, W, D, r, 6);
    ibox(g, hx, hy, hw, hd, 0, 30, '#7a4a24');
    ibox(g, X, Y, W, D, 0, 10, '#8b5a2b');
    ibox(g, X, Y, W - 6, D - 6, 10, 7, '#f0e4c0');
    if (r) { ibox(g, X, Y, W * 0.55 - 3, D - 6, 17, 2, '#d1543e', { flat: true }); ibox(g, X - W / 2 + 16, Y - D * 0.22, 14, D * 0.36, 17, 5, '#fdf6e3'); ibox(g, X - W / 2 + 16, Y + D * 0.22, 14, D * 0.36, 17, 5, '#fdf6e3'); }
    else { ibox(g, X, Y + D * 0.18, W - 6, D * 0.55, 17, 2, '#d1543e', { flat: true }); ibox(g, X - W * 0.22, Y - D / 2 + 16, W * 0.36, 14, 17, 5, '#fdf6e3'); ibox(g, X + W * 0.22, Y - D / 2 + 16, W * 0.36, 14, 17, 5, '#fdf6e3'); }
  },
  shelf(g, X, Y, W, D, r, d) {
    ibox(g, X, Y, W, D, 0, d.h, '#8b5a2b');
    const f = r ? faceR : faceL, cols = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22'];
    for (let k = 0; k < 3; k++) {
      f(g, X, Y, W, D, 0.06, 0.94, 5 + k * 13, 15 + k * 13, '#4b2e17');
      for (let i = 0; i < 7; i++) f(g, X, Y, W, D, 0.09 + i * 0.125, 0.09 + i * 0.125 + 0.09, 6 + k * 13, 14 + k * 13 - (i % 3), cols[(i + k) % 6]);
    }
  },
  tv(g, X, Y, W, D, r) {
    ibox(g, X, Y, W, D, 0, 14, '#6b4423');
    const [sx, sy, sw, sd] = backSlab(X, Y, W * 0.92, D * 0.92, r, 7);
    ibox(g, sx, sy, sw, sd, 14, 24, '#171a2b');
    const f = r ? faceR : faceL; f(g, sx, sy, sw, sd, 0.05, 0.95, 16, 36, '#2e3c68'); f(g, sx, sy, sw, sd, 0.12, 0.4, 28, 35, '#5a6fa8');
  },
  fridge(g, X, Y, W, D, r, d) {
    ibox(g, X, Y, W, D, 0, d.h, '#dfe6ee');
    const f = r ? faceR : faceL;
    f(g, X, Y, W, D, 0.05, 0.95, d.h * 0.62, d.h - 2, '#cfd9e6'); f(g, X, Y, W, D, 0.05, 0.95, 3, d.h * 0.6, '#e8eef6'); f(g, X, Y, W, D, 0.78, 0.86, 8, d.h * 0.5, '#7a8aa0'); f(g, X, Y, W, D, 0.78, 0.86, d.h * 0.66, d.h - 8, '#7a8aa0');
  },
  plant(g, X, Y, W, D) {
    ibox(g, X, Y, W * 0.7, D * 0.7, 0, 11, '#c0652d');
    dot(g, X, Y, 17, 8, 6.5, '#2d6e2a'); dot(g, X - 6, Y + 3, 21, 6.5, 5.5, '#3f9a3a'); dot(g, X + 6, Y - 2, 23, 6.5, 5.5, '#3f9a3a'); dot(g, X, Y, 28, 6, 5, '#4fa048'); dot(g, X - 2, Y - 3, 33, 4, 3.5, '#6cc65a');
  },
  piano(g, X, Y, W, D, r) {
    ibox(g, X, Y, W, D, 0, 26, '#23232d'); ibox(g, X, Y, W * 0.98, D * 0.98, 26, 5, '#15151c');
    const f = r ? faceR : faceL; f(g, X, Y, W, D, 0.06, 0.94, 15, 21, '#f4f4f4');
    for (let i = 1; i < 12; i++) f(g, X, Y, W, D, 0.06 + i * 0.0733, 0.067 + i * 0.0733, 15, 21, '#2a2a33');
  },
  trophy(g, X, Y) { ibox(g, X, Y, 12, 12, 0, 5, '#7a5a1e'); ibox(g, X, Y, 5, 5, 5, 8, '#e8c04a', { flat: true }); ibox(g, X, Y, 12, 12, 13, 8, '#f1c40f'); },
  teddy(g, X, Y) {
    dot(g, X, Y, 0, 9, 3.5, 'rgba(0,0,0,.2)'); dot(g, X, Y, 6, 6, 6, '#c98b4a'); dot(g, X, Y, 6.5, 3.5, 4, '#e8c78a'); dot(g, X, Y, 15, 5, 5, '#c98b4a');
    dot(g, X - 5, Y, 19, 2, 2, '#c98b4a'); dot(g, X + 5, Y, 19, 2, 2, '#c98b4a'); dot(g, X, Y, 14, 2.2, 1.6, '#e8c78a'); dot(g, X - 2, Y, 16, .8, .8, INK); dot(g, X + 2, Y, 16, .8, .8, INK); dot(g, X, Y, 14.6, .9, .6, INK);
  },
  cat(g, X, Y, W, D, r, d, now) {
    dot(g, X, Y, 0, 10, 3.5, 'rgba(0,0,0,.2)'); dot(g, X, Y, 5, 8, 5, '#e8943a'); dot(g, X - 3, Y, 6, 1.4, 4, '#c97a28'); dot(g, X + 2, Y, 6, 1.4, 4, '#c97a28');
    dot(g, X + 5, Y, 11, 4.8, 4.4, '#e8943a'); poly(g, [iso(X + 2, Y, 14), iso(X + 3, Y, 18), iso(X + 5, Y, 14)], '#e8943a'); poly(g, [iso(X + 6, Y, 14), iso(X + 8, Y, 18), iso(X + 9, Y, 13)], '#e8943a');
    dot(g, X + 4, Y, 11.5, .8, 1, INK); dot(g, X + 7, Y, 11.5, .8, 1, INK);
    const tw = Math.sin(now / 400) * 3; g.strokeStyle = '#e8943a'; g.lineWidth = 2; g.beginPath(); g.moveTo(...iso(X - 7, Y, 4)); g.quadraticCurveTo(...iso(X - 13, Y, 10), ...iso(X - 11 + tw, Y, 15)); g.stroke();
  },
  statue(g, X, Y, W, D) {
    ibox(g, X, Y, W * 0.7, D * 0.7, 0, 18, '#8e949e'); ibox(g, X, Y, W * 0.32, D * 0.32, 18, 26, '#c4c8cf');
    dot(g, X, Y, 49, 7.5, 7.5, INK); dot(g, X, Y, 49, 6.5, 6.5, '#c4c8cf');
  },
  fountain(g, X, Y, W, D, r, d, now) {
    ibox(g, X, Y, W, D, 0, 12, '#aab4c4');
    poly(g, [iso(X - W / 2 + 5, Y - D / 2 + 5, 12), iso(X + W / 2 - 5, Y - D / 2 + 5, 12), iso(X + W / 2 - 5, Y + D / 2 - 5, 12), iso(X - W / 2 + 5, Y + D / 2 - 5, 12)], '#6cc6d6', INK);
    ibox(g, X, Y, 8, 8, 12, 16, '#cfd6e0');
    for (let i = 0; i < 8; i++) { const ph = (now / 700 + i / 8) % 1, a = i * 0.785, rr = ph * 16, [px, py] = iso(X + Math.cos(a) * rr, Y + Math.sin(a) * rr, 30 - ph * ph * 24); g.fillStyle = 'rgba(190,235,250,.95)'; g.fillRect(px - 1, py - 1, 2, 2); }
  },
  flag(g, X, Y, W, D, r, d, now) {
    ibox(g, X, Y, 4, 4, 0, d.h, '#7a4a24'); const [px, py] = iso(X, Y, d.h), w = Math.sin(now / 250) * 2;
    poly(g, [[px, py], [px + 22, py + 3 + w], [px + 22, py + 15 + w], [px, py + 13]], '#e74c3c', INK);
  },
  crate(g, X, Y, W, D, r, d) { ibox(g, X, Y, W, D, 0, d.h, '#c98b4a'); faceL(g, X, Y, W, D, 0.04, 0.96, d.h * 0.42, d.h * 0.52, '#8b5a2b'); faceR(g, X, Y, W, D, 0.04, 0.96, d.h * 0.42, d.h * 0.52, '#6b4423'); },
  barrel(g, X, Y, W, D, r, d) { ibox(g, X, Y, W * 0.9, D * 0.9, 0, d.h, '#8b5a2b'); for (const z of [5, d.h - 8]) ibox(g, X, Y, W * 0.94, D * 0.94, z, 3, '#3a3f4a'); },
  signpost(g, X, Y, W, D, r, d) { ibox(g, X, Y, 5, 5, 0, d.h, '#8b5a2b'); ibox(g, X, Y, 22, 4, d.h - 16, 12, '#e8c66a'); },
  mailbox(g, X, Y) { ibox(g, X, Y, 5, 5, 0, 24, '#6b4423'); ibox(g, X, Y, 18, 10, 24, 13, '#2e7bb5'); const [px, py] = iso(X + 9, Y, 36); poly(g, [[px, py], [px + 8, py - 2], [px + 8, py + 4], [px, py + 4]], '#e74c3c', INK); },
  toolbox(g, X, Y, W, D, r, d) { ibox(g, X, Y, W, D, 0, d.h, '#c0392b'); ibox(g, X, Y, W * 0.5, 4, d.h, 5, '#3a3f4a'); },
  hut(g, X, Y, W, D) {
    ibox(g, X, Y, W, D, 0, 34, '#c9a869');
    const ap = iso(X, Y, 64); poly(g, [iso(X - W / 2, Y + D / 2, 34), iso(X + W / 2, Y + D / 2, 34), ap], '#a8552f', INK); poly(g, [iso(X + W / 2, Y - D / 2, 34), iso(X + W / 2, Y + D / 2, 34), ap], '#8a4426', INK);
    faceL(g, X, Y, W, D, 0.38, 0.62, 0, 20, '#4a2f18');
  },
  lantern(g, X, Y, W, D, r, d, now) {
    ibox(g, X, Y, 5, 5, 0, 18, '#3a3f4a'); ibox(g, X, Y, 12, 12, 18, 11, '#ffd36a');
    const [px, py] = iso(X, Y, 24), gr = g.createRadialGradient(px, py, 0, px, py, 22); gr.addColorStop(0, `rgba(255,220,120,${0.5 + Math.sin(now / 300) * 0.06})`); gr.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gr; g.fillRect(px - 22, py - 22, 44, 44);
  },
};
function artGeneric(g, X, Y, W, D, r, d) { ibox(g, X, Y, W * 0.85, D * 0.85, 0, (d.h || 24) * 0.8, '#9aa0aa'); }
const hits = []; // พื้นที่แตะของแต่ละชิ้นที่วาดในเฟรมนี้ (เรียงตามลำดับวาด ตัวท้ายสุดอยู่หน้าสุด)
function drawFurnIso(g, it, now, alpha, ghost) {
  const d = FURN[it.f], [w, dd] = Shared.furnDims(it.f, it.r), X = it.x * TS, Y = it.y * TS, W = w * TS, D = dd * TS, z = it.z || 0;
  g.save(); if (alpha != null) g.globalAlpha = alpha;
  if (!z && !d.flat) poly(g, [iso(X - W / 2 - 2, Y - D / 2 - 2), iso(X + W / 2 + 2, Y - D / 2 - 2), iso(X + W / 2 + 2, Y + D / 2 + 2), iso(X - W / 2 - 2, Y + D / 2 + 2)], 'rgba(40,20,5,.2)'); // เงาบนพื้น
  g.translate(0, -z);
  (ART[it.f] || artGeneric)(g, X, Y, W, D, it.r, d, now);
  g.restore();
  if (ghost) return;
  if (d.flat) hits.push({ i: it.i, test: (sx, sy) => pip([iso(X - W / 2, Y - D / 2), iso(X + W / 2, Y - D / 2), iso(X + W / 2, Y + D / 2), iso(X - W / 2, Y + D / 2)], sx, sy) });
  else { const [cx, cy] = iso(X, Y, z), hw = (W + D) / 2, h = (d.h || 24) + 4; hits.push({ i: it.i, test: (sx, sy) => sx >= cx - hw && sx <= cx + hw && sy >= cy - hw / 2 - h && sy <= cy + hw / 2 }); }
}
// ของติดผนัง: wl 'n' = ผนังหลังขวา (แนวแกน x) 'w' = ผนังหลังซ้าย (แนวแกน y) u = ตำแหน่งตามแนวผนัง (ช่อง)
const wallPt = (wl, u, z) => (wl === 'n' ? iso(u, FY0, z) : iso(FX0, u, z));
const wallRect = (g, wl, u0, u1, z0, z1, fill, stroke) => poly(g, [wallPt(wl, u0, z0), wallPt(wl, u1, z0), wallPt(wl, u1, z1), wallPt(wl, u0, z1)], fill, stroke);
function drawWallItem(g, it, alpha) {
  const d = FURN[it.f], U = it.u * TS, hw = (d.w || 1) * TS / 2, hh = (d.h || 30) / 2, zc = 60, wl = it.wl;
  g.save(); if (alpha != null) g.globalAlpha = alpha;
  if (it.f === 'painting') {
    wallRect(g, wl, U - hw, U + hw, zc - hh, zc + hh, '#c98b4a', INK); wallRect(g, wl, U - hw + 4, U + hw - 4, zc - hh + 4, zc + hh - 4, '#8fd0f0');
    wallRect(g, wl, U - hw + 4, U + hw - 4, zc - hh + 4, zc - 2, '#5fa844'); wallRect(g, wl, U - hw + 8, U - 2, zc - 2, zc + 6, '#4a8a3a'); wallRect(g, wl, U + hw - 14, U + hw - 8, zc + 4, zc + 10, '#ffe08a');
  } else if (it.f === 'clock') {
    const ring = R => { const out = []; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; out.push(wallPt(wl, U + Math.cos(a) * R, zc + Math.sin(a) * R)); } return out; };
    poly(g, ring(14), '#3a3f4a', INK); poly(g, ring(11.5), '#fff8e7');
    g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(...wallPt(wl, U, zc)); g.lineTo(...wallPt(wl, U, zc + 8)); g.moveTo(...wallPt(wl, U, zc)); g.lineTo(...wallPt(wl, U + 6, zc - 1)); g.stroke();
  } else if (it.f === 'map') {
    wallRect(g, wl, U - hw, U + hw, zc - hh, zc + hh, '#8b5a2b', INK); wallRect(g, wl, U - hw + 3, U + hw - 3, zc - hh + 3, zc + hh - 3, '#e8d6a0');
    wallRect(g, wl, U - hw + 8, U - 6, zc - 8, zc + 8, '#6cc6d6'); wallRect(g, wl, U - 2, U + 18, zc - 2, zc + 10, '#7bc65a'); wallRect(g, wl, U + 4, U + 14, zc - 12, zc - 5, '#5fa844');
  } else if (it.f === 'records') {
    const cols = ['#e84a5f', '#2e9e6b', '#8a5bd1'], n = 3, sw = hw * 2 / n;
    for (let k = 0; k < n; k++) {
      const u0 = U - hw + k * sw + 1, u1 = u0 + sw - 2; wallRect(g, wl, u0, u1, zc - hh, zc + hh, '#2b2f55', INK);
      const uc = (u0 + u1) / 2; wallRect(g, wl, uc - 5, uc + 5, zc - 5, zc + 5, cols[k]); wallRect(g, wl, uc - 1.5, uc + 1.5, zc - 1.5, zc + 1.5, '#fff3d6');
    }
  } else wallRect(g, wl, U - hw, U + hw, zc - hh, zc + hh, '#c98b4a', INK);
  g.restore();
  const quad = [wallPt(wl, U - hw, zc - hh), wallPt(wl, U + hw, zc - hh), wallPt(wl, U + hw, zc + hh), wallPt(wl, U - hw, zc + hh)];
  if (it.i >= 0 && alpha == null) hits.push({ i: it.i, test: (sx, sy) => pip(quad, sx, sy) });
}
function buildHouseIsoBg() { // พื้นไม้ + ผนังหลัง 2 ด้าน + หน้าต่าง + พรมหน้าประตู (วาดครั้งเดียว)
  const c = document.createElement('canvas'); c.width = ISO_B.w; c.height = ISO_B.h;
  const g = c.getContext('2d'); g.translate(-ISO_B.x0, -ISO_B.y0);
  g.fillStyle = '#17110d'; g.fillRect(ISO_B.x0, ISO_B.y0, ISO_B.w, ISO_B.h);
  const hs = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  poly(g, [iso(FX0, FY1), iso(FX1, FY1), iso(FX1, FY1, -12), iso(FX0, FY1, -12)], '#8a5430', INK); // ความหนาแผ่นพื้น
  poly(g, [iso(FX1, FY0), iso(FX1, FY1), iso(FX1, FY1, -12), iso(FX1, FY0, -12)], '#6b3f22', INK);
  const PL = ['#c98a56', '#be7f4b', '#d29560', '#b87846'];
  for (let row = 0, y = FY0; y < FY1; row++, y += 16) { // ไม้กระดานเรียงตามแกน x ต่อกันสลับรอยต่อ
    let x = FX0 - Math.floor(hs(row, 7) * 96);
    for (let k = 0; x < FX1; k++, x += 96) {
      const xa = Math.max(x, FX0), xb = Math.min(x + 96, FX1); if (xb <= xa) continue;
      const q = [iso(xa, y), iso(xb, y), iso(xb, y + 16), iso(xa, y + 16)];
      poly(g, q, PL[Math.floor(hs(row, k) * 4)]);
      g.strokeStyle = 'rgba(70,35,15,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(...q[0]); g.lineTo(...q[3]); g.lineTo(...q[2]); g.lineTo(...q[1]); g.stroke();
      g.strokeStyle = 'rgba(255,230,190,.16)'; g.beginPath(); g.moveTo(...q[0]); g.lineTo(...q[1]); g.stroke();
    }
  }
  const WH = WALL_H;
  for (const wl of ['n', 'w']) { // ผนัง: วอลเปเปอร์ลายขีด + แผ่นไม้ครึ่งล่าง + ราว + บัวพื้น
    const u0 = wl === 'n' ? FX0 : FY0, u1 = wl === 'n' ? FX1 : FY1;
    wallRect(g, wl, u0, u1, 34, WH, '#efe3c2'); for (let u = u0; u < u1; u += 20) wallRect(g, wl, u, Math.min(u + 10, u1), 34, WH, '#e2d1a4');
    wallRect(g, wl, u0, u1, 0, 34, '#b9602f'); for (let u = u0 + 7; u < u1; u += 14) wallRect(g, wl, u, u + 1.5, 4, 33, '#8a4420');
    wallRect(g, wl, u0, u1, 34, 38, '#d98a4b'); wallRect(g, wl, u0, u1, 0, 5, '#7a3f1d');
    const wins = wl === 'n' ? [4.5, 11, 17.5] : [4.5, 10];
    for (const wc of wins) { // หน้าต่างบานเกล็ด
      const uc = (wl === 'n' ? FX0 : FY0) + wc * TS, a = uc - 30, b = uc + 30;
      wallRect(g, wl, a - 3, b + 3, 42, 90, '#7a3f1d', INK); wallRect(g, wl, a, b, 46, 86, '#a8dcf2');
      for (let z = 48; z < 86; z += 5) wallRect(g, wl, a, b, z, z + 3, '#f3ead0');
      wallRect(g, wl, uc - 1, uc + 1, 46, 86, '#7a3f1d'); wallRect(g, wl, a - 5, b + 5, 38, 42, '#c98b4a', INK);
    }
    if (wl === 'w') { poly(g, [iso(FX0, FY0), iso(FX0, FY1), iso(FX0, FY1, WH), iso(FX0, FY0, WH)], 'rgba(60,30,10,.16)'); }
  }
  const cap = 14; // ขอบบนของผนัง (หนา)
  poly(g, [iso(FX0 - cap, FY0 - cap, WH + 10), iso(FX1, FY0 - cap, WH + 10), iso(FX1, FY0, WH + 10), iso(FX0 - cap, FY0, WH + 10)], '#f09a5a', INK);
  poly(g, [iso(FX0 - cap, FY0, WH), iso(FX1, FY0, WH), iso(FX1, FY0, WH + 10), iso(FX0 - cap, FY0, WH + 10)], '#d9743a', INK);
  poly(g, [iso(FX0 - cap, FY0 - cap, WH + 10), iso(FX0, FY0 - cap, WH + 10), iso(FX0, FY1, WH + 10), iso(FX0 - cap, FY1, WH + 10)], '#e88a4a', INK);
  poly(g, [iso(FX0, FY0, WH), iso(FX0, FY1, WH), iso(FX0, FY1, WH + 10), iso(FX0, FY0, WH + 10)], '#b85a28', INK);
  poly(g, [iso(FX1, FY0 - cap, WH + 10), iso(FX1, FY0, WH + 10), iso(FX1, FY0, 0), iso(FX1, FY0 - cap, 0)], '#8a4a22', INK);
  poly(g, [iso(FX0 - cap, FY1, WH + 10), iso(FX0, FY1, WH + 10), iso(FX0, FY1, 0), iso(FX0 - cap, FY1, 0)], '#8a4a22', INK);
  poly(g, [iso(FX0, FY0, 0), iso(FX1, FY0, 0), iso(FX1, FY0 + 12), iso(FX0 + 12, FY0 + 12)], 'rgba(40,20,5,.16)'); poly(g, [iso(FX0, FY0, 0), iso(FX0 + 12, FY0 + 12), iso(FX0 + 12, FY1), iso(FX0, FY1, 0)], 'rgba(40,20,5,.12)'); // เงาโคนผนังบนพื้น
  const mx0 = Shared.HOUSE.door[0] * TS, mx1 = (Shared.HOUSE.door[1] + 1) * TS, my0 = (Shared.HOUSE.y1 - 1.2) * TS, my1 = Shared.HOUSE.y1 * TS; // พรมหน้าประตู + ลูกศรออก
  poly(g, [iso(mx0, my0, 1), iso(mx1, my0, 1), iso(mx1, my1, 1), iso(mx0, my1, 1)], '#8c2a22', INK); poly(g, [iso(mx0 + 3, my0 + 3, 1), iso(mx1 - 3, my0 + 3, 1), iso(mx1 - 3, my1 - 3, 1), iso(mx0 + 3, my1 - 3, 1)], '#e8c66a'); poly(g, [iso(mx0 + 6, my0 + 6, 1), iso(mx1 - 6, my0 + 6, 1), iso(mx1 - 6, my1 - 6, 1), iso(mx0 + 6, my1 - 6, 1)], '#a8322a');
  const mc = (mx0 + mx1) / 2; g.strokeStyle = '#e8c66a'; g.lineWidth = 2; for (const o of [-6, 4]) { g.beginPath(); g.moveTo(...iso(mc - 12, (my0 + my1) / 2 + o - 3, 1)); g.lineTo(...iso(mc, (my0 + my1) / 2 + o + 4, 1)); g.lineTo(...iso(mc + 12, (my0 + my1) / 2 + o - 3, 1)); g.stroke(); }
  return c;
}
function buildHouseGrid() { // เส้นตารางจาง ๆ ตอนตกแต่ง (ทุกครึ่งช่อง เส้นหนักทุกช่อง)
  const c = document.createElement('canvas'); c.width = ISO_B.w; c.height = ISO_B.h;
  const g = c.getContext('2d'); g.translate(-ISO_B.x0, -ISO_B.y0); g.lineWidth = 1;
  for (let X = FX0, k = 0; X <= FX1; X += TS / 2, k++) { g.strokeStyle = k % 2 ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.26)'; g.beginPath(); g.moveTo(...iso(X, FY0)); g.lineTo(...iso(X, FY1)); g.stroke(); }
  for (let Y = FY0, k = 0; Y <= FY1; Y += TS / 2, k++) { g.strokeStyle = k % 2 ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.26)'; g.beginPath(); g.moveTo(...iso(FX0, Y)); g.lineTo(...iso(FX1, Y)); g.stroke(); }
  return c;
}
function drawIsoPlayer(p, now) { // ตัวละครเดิมวาดที่พิกัดโลก → เลื่อนไปยังพิกัดไอโซเมตริก (นั่งแล้วยกขึ้นตามที่นั่ง)
  const [sx, sy] = iso(p.x, p.y); let lift = 0;
  if (p.sit) for (const it of furn.values()) if (FURN[it.f].seat && Math.abs(it.x * TS - p.x) < 6 && Math.abs(it.y * TS - p.y) < 6) lift = 8;
  ctx.save(); ctx.translate(sx - p.x, sy - p.y - 10 - lift); drawPlayer(p, now); ctx.restore();
}
function drawIsoCompanion(cp, now) { const [sx, sy] = iso(cp.x, cp.y); ctx.save(); ctx.translate(sx - cp.x, sy - cp.y - 6); drawCompanion(cp, now); ctx.restore(); }
function drawHouseWorld(now) {
  ctx.drawImage(houseBg, ISO_B.x0, ISO_B.y0);
  hits.length = 0;
  const its = [...furn.values()], list = [];
  for (const it of its) if (FURN[it.f].wall) drawWallItem(ctx, it);
  if (build.on) ctx.drawImage(houseGrid, ISO_B.x0, ISO_B.y0);
  for (const it of its) if (FURN[it.f].flat) drawFurnIso(ctx, it, now);
  for (const it of its) { const d = FURN[it.f]; if (!d.wall && !d.flat) list.push({ k: (it.x + it.y) * TS + (it.on ? 1 : 0), f: () => drawFurnIso(ctx, it, now) }); }
  for (const p of players.values()) { list.push({ k: p.x + p.y, f: () => drawIsoPlayer(p, now) }); if (p.cp) list.push({ k: p.cp.x + p.cp.y, f: () => drawIsoCompanion(p.cp, now) }); }
  list.sort((a, b) => a.k - b.k).forEach(o => o.f());
  drawHouseOverlay(now);
}
function footprintPts(it, z = 0) { const [w, d] = Shared.furnDims(it.f, it.r), X = it.x * TS, Y = it.y * TS, W = w * TS / 2, D = d * TS / 2; return [iso(X - W, Y - D, z), iso(X + W, Y - D, z), iso(X + W, Y + D, z), iso(X - W, Y + D, z)]; }
function outlineItem(it, color) {
  if (!it) return;
  if (FURN[it.f].wall) { const U = it.u * TS, hw = (FURN[it.f].w || 1) * TS / 2, hh = (FURN[it.f].h || 30) / 2; poly(ctx, [wallPt(it.wl, U - hw, 60 - hh), wallPt(it.wl, U + hw, 60 - hh), wallPt(it.wl, U + hw, 60 + hh), wallPt(it.wl, U - hw, 60 + hh)], null, color); return; }
  ctx.save(); ctx.lineWidth = 2; poly(ctx, footprintPts(it, it.z || 0), null, color); ctx.restore();
}
function ghostFor(f, sx, sy, selfId, r) { // ชิ้น f ถ้าวางตรงเมาส์/นิ้วตอนนี้ จะอยู่ตรงไหน (ปัด ¼ ช่อง) และวางได้ไหม
  const d = FURN[f], items = furnObj(selfId), mates = [...players.values()].map(q => ({ x: q.x, y: q.y }));
  if (d.wall) {
    const [X, Y] = unIso(sx, sy + 60), toN = Math.abs(Y - FY0) <= Math.abs(X - FX0), wl = toN ? 'n' : 'w', u = Shared.snapQ((toN ? X : Y) / TS);
    const res = Shared.houseCheck(items, f, 0, 0, 0, { wl, u });
    return { f, r: 0, wl, u: res.u !== undefined ? res.u : u, x: res.x, y: res.y, z: 0, res };
  }
  let [X, Y] = unIso(sx, sy);
  if (d.small) { // ชี้ที่หลังโต๊ะ/เตียง ฯลฯ: ลองยกจุดชี้ขึ้นตามความสูงของแต่ละตัว เอาตัวที่สูงสุดที่ชี้ถูก
    let best = 0;
    for (const [id, it] of furn) { if (id === selfId) continue; const o = FURN[it.f]; if (!o.top || it.z > 0 || o.h <= best) continue; const [px, py] = unIso(sx, sy + o.h), rc = Shared.furnRect(it); if (px / TS >= rc.x0 && px / TS <= rc.x1 && py / TS >= rc.y0 && py / TS <= rc.y1) { best = o.h; X = px; Y = py; } }
  }
  const x = Shared.snapQ(X / TS), y = Shared.snapQ(Y / TS), res = Shared.houseCheck(items, f, x, y, r, { mates });
  return { f, r, x, y, z: res.z || 0, on: res.on, res };
}
function drawHouseOverlay(now) {
  if (!inMyHouse() || !build.on) return;
  const pulse = 0.55 + 0.45 * Math.sin(now / 160);
  if (build.pick != null && furn.has(build.pick)) outlineItem(furn.get(build.pick), `rgba(255,255,255,${pulse})`);
  if (!mouse.active || isTouch) return;
  const hv = hitItem(mouse.sx, mouse.sy); let g = null;
  if (build.erase) { if (hv != null) outlineItem(furn.get(hv), 'rgba(255,90,90,.95)'); return; }
  if (build.sel) g = ghostFor(build.sel, mouse.sx, mouse.sy, null, build.rot);
  else if (build.pick != null) { const it = furn.get(build.pick); if (it) g = ghostFor(it.f, mouse.sx, mouse.sy, build.pick, it.r); }
  else { if (hv != null) outlineItem(furn.get(hv), 'rgba(255,255,255,.6)'); return; }
  if (!g) return;
  const gi = { i: -1, f: g.f, x: g.x, y: g.y, r: g.r, z: g.z, wl: g.wl, u: g.u }, ok = g.res.ok;
  if (FURN[g.f].wall) { drawWallItem(ctx, gi, 0.65); outlineItem(gi, ok ? 'rgba(80,230,120,.95)' : 'rgba(255,80,80,.95)'); }
  else { poly(ctx, footprintPts(gi, gi.z), ok ? 'rgba(80,220,120,.35)' : 'rgba(240,70,70,.4)'); drawFurnIso(ctx, gi, now, 0.7, true); }
}
// ---------- แตะ/คลิกในบ้าน ----------
const isoPtr = e => [camX + e.clientX * (canvas.width / innerWidth) / zoom, camY + e.clientY * (canvas.height / innerHeight) / zoom];
function hitItem(sx, sy) { for (let k = hits.length - 1; k >= 0; k--) if (hits[k].test(sx, sy)) return hits[k].i; return null; }
function findHousePath(sx, sy, gx, gy) { // หาทางเดินบนกริด 16 px (หลบเฟอร์นิเจอร์) คืนจุดพิกเซล หรือ null
  const C = 16, x0 = FX0, y0 = FY0, cols = Math.ceil((FX1 - FX0) / C), rows = Math.ceil((FY1 + TS - FY0) / C);
  const cell = (x, y) => [Math.max(0, Math.min(cols - 1, Math.floor((x - x0) / C))), Math.max(0, Math.min(rows - 1, Math.floor((y - y0) / C)))];
  const center = (cx, cy) => [x0 + cx * C + C / 2, y0 + cy * C + C / 2];
  const bad = (cx, cy) => { const [x, y] = center(cx, cy); return Shared.houseBlockedAt(MAP, houseRects, x, y); };
  const [scx, scy] = cell(sx, sy), [gcx, gcy] = cell(gx, gy), prev = new Map(), q = [[scx, scy]], key = (a, b) => b * cols + a;
  prev.set(key(scx, scy), null);
  let best = [scx, scy], bd = Infinity;
  for (let i = 0; i < q.length; i++) {
    const [cx, cy] = q[i], dd = Math.abs(cx - gcx) + Math.abs(cy - gcy);
    if (dd < bd) { bd = dd; best = [cx, cy]; }
    if (dd === 0) break;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || prev.has(key(nx, ny)) || bad(nx, ny)) continue;
      prev.set(key(nx, ny), [cx, cy]); q.push([nx, ny]);
    }
  }
  const out = []; let c = best; while (prev.get(key(c[0], c[1])) !== null) { out.push(center(c[0], c[1])); c = prev.get(key(c[0], c[1])); }
  out.reverse();
  if (bd === 0 && !bad(gcx, gcy)) out[out.length - 1] = [gx, gy]; // จุดสุดท้ายเดินตรงถึงจุดที่แตะ
  const clear = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6); for (let k = 1; k < n; k++) if (Shared.houseBlockedAt(MAP, houseRects, a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n)) return false; return true; };
  const res = []; let from = [sx, sy], i = 0; // ตัดจุดกลางทางที่เดินตรงถึงได้
  while (i < out.length) { let j = out.length - 1; while (j > i && !clear(from, out[j])) j--; res.push(out[j]); from = out[j]; i = j + 1; }
  return res;
}
function walkHouse(X, Y, act) {
  X = Math.max(FX0 + 10, Math.min(FX1 - 10, X)); Y = Math.max(FY0 + 10, Math.min(FY1 + TS * 0.5, Y));
  const pts = findHousePath(me.x, me.y, X, Y);
  if (!pts || !pts.length) { toast('เดินไปไม่ถึงตรงนั้น'); return; }
  walk = { pts, px: true, act: act || null, dest: pts[pts.length - 1], stuck: 0 };
}
function houseIsoClick(sx, sy) {
  if (!me || chatFocus || modalOpen()) return;
  const [X, Y] = unIso(sx, sy), hit = hitItem(sx, sy);
  if (inMyHouse() && build.on) return buildClick(sx, sy, hit);
  if (hit != null) {
    const it = furn.get(hit);
    if (it && FURN[it.f].seat) { // แตะเก้าอี้/โซฟา: ถ้าอยู่ใกล้ก็นั่งเลย ไม่งั้นเดินไปก่อนแล้วนั่ง
      if (Math.hypot(it.x * TS - me.x, it.y * TS - me.y) <= 3.5 * TS) { stopWalk(); send({ t: 'act', tool: '', i: hit }); }
      else walkHouse(it.x * TS, it.y * TS + FURN[it.f].d * TS / 2 + 14, { sit: hit });
      return;
    }
  }
  const door = Shared.HOUSE; // แตะพรมหน้าประตู = เดินออกจากบ้าน
  if (X >= door.door[0] * TS && X <= (door.door[1] + 1) * TS && Y >= (door.y1 - 1.2) * TS && Y <= door.y1 * TS) { walkHouse(Shared.HOUSE_SPAWN.x, (door.y1 + 0.5) * TS); return; }
  walkHouse(X, Y);
}
function buildClick(sx, sy, hit) {
  if (build.erase) { if (hit != null) send({ t: 'house', a: 'remove', i: hit }); else toast('แตะของที่จะเก็บคืน'); return; }
  if (build.sel) {
    const g = ghostFor(build.sel, sx, sy, null, build.rot);
    if (!g.res.ok) { toast(g.res.why); return; }
    send({ t: 'house', a: 'place', f: build.sel, x: g.x, y: g.y, r: build.rot, wl: g.wl, u: g.u }); return;
  }
  if (hit != null) { build.pick = hit === build.pick ? null : hit; renderBuild(); return; } // แตะของ = เลือก (แตะซ้ำ = เลิกเลือก)
  if (build.pick == null) { toast('แตะของในบ้านเพื่อเลือก แล้วแตะที่ใหม่เพื่อย้าย'); return; }
  const it = furn.get(build.pick), g = ghostFor(it.f, sx, sy, build.pick, it.r);
  if (!g.res.ok) { toast(g.res.why); return; }
  send({ t: 'house', a: 'move', i: build.pick, x: g.x, y: g.y, wl: g.wl, u: g.u });
}

function frameTail(now, wall) { // กลางวัน/กลางคืน + นาฬิกา + แผนที่ย่อ (ใช้ทั้งในเมืองและในบ้าน)
  const hour = ((wall % CLOCK_MS) / CLOCK_MS * 24 + 6) % 24;
  const dark = daylight(hour);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawNight(scene ? dark * 0.4 : dark, now); // ในบ้านมืดน้อยกว่า มีแค่โคมไฟ/ตะเกียงที่สว่างกว่า
  if (!scene) drawGuideArrow(now);
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  const icon = dark > 0.45 ? '🌙' : hour < 8 || hour >= 17 ? '🌅' : '☀️';
  const txt = `${icon} ${String(hh).padStart(2, '0')}:${String(mm - mm % 10).padStart(2, '0')}`;
  if ($('clock').textContent !== txt) $('clock').textContent = txt;
  drawMini(now);
}
const blk = (x, y, fx, fy) => (scene ? Shared.houseBlockedAt(MAP, houseRects, x, y, fx, fy) : blockedAt(MAP, x, y)); // ชนผนัง/ของ (ในบ้านรวมเฟอร์นิเจอร์ตัน)
function step(now) {
  requestAnimationFrame(step);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!joined || !me) return;
  const wall = Date.now() + timeOffset;

  // เดิน: คีย์บอร์ด/จอยสติ๊ก (ยกเลิกการเดินจากคลิก) หรือเดินตามเส้นทางที่คลิกไว้
  if (performance.now() - lastKeyEvt > KEY_STALE_MS) clearKeys(); // ปุ่มค้าง: ไม่มี keydown เข้ามานานผิดปกติ → เคลียร์ทั้งหมด
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  let iy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
  if (scene) { const jx = ix + iy, jy = iy - ix; ix = jx; iy = jy; } // ในบ้านมุมไอโซเมตริก: ปุ่มเดินตามทิศบนจอ (ขวาจอ = +x −y, ลงจอ = +x +y)
  if (chatFocus || modalOpen()) { ix = iy = 0; walk = null; }
  let mag = Math.hypot(ix, iy);
  if (mag > 0.1) walk = null;
  else if (walk) {
    const wp = walk.pts[0];
    if (!wp) { const a = walk.act; walk = null; if (a && a.sit !== undefined) send({ t: 'act', tool: '', i: a.sit }); else if (a) act(a.tx, a.ty); }
    else {
      const dx = (walk.px ? wp[0] : wp[0] * TS + 16) - me.x, dy = (walk.px ? wp[1] : wp[1] * TS + 16) - me.y, d = Math.hypot(dx, dy);
      if (d < 3) walk.pts.shift(); else { ix = dx / d; iy = dy / d; mag = 1; }
    }
  }
  me.moving = mag > 0.1;
  if (me.moving) {
    if (mag > 1) { ix /= mag; iy /= mag; }
    const sp = 110 * dt * (hunger <= 0 ? 0.5 : hunger <= 15 ? 0.8 : 1) * (buffOn('speed') ? 1.1 : 1), ox = me.x, oy = me.y; // หิวมากจะเดินช้าลง
    if (!blk(me.x + ix * sp, me.y, me.x, me.y)) me.x += ix * sp;
    if (!blk(me.x, me.y + iy * sp, me.x, me.y)) me.y += iy * sp;
    const dsx = scene ? ix - iy : ix, dsy = scene ? (ix + iy) / 2 : iy; // ทิศที่หันตามหน้าจอ
    me.dir = Math.abs(dsx) > Math.abs(dsy) ? (dsx < 0 ? 2 : 3) : (dsy < 0 ? 1 : 0);
    me.anim += dt;
    if (walk) { walk.stuck = Math.hypot(me.x - ox, me.y - oy) < sp * 0.2 ? walk.stuck + dt : 0; if (walk.stuck > 0.5) walk = null; }
  }
  const sig = Math.round(me.x) + ',' + Math.round(me.y) + ',' + me.dir;
  if (sig !== lastSent && now - lastSend > 66) { send({ t: 'm', x: me.x, y: me.y, d: me.dir }); lastSent = sig; lastSend = now; }
  // คนอื่น/สัตว์
  for (const p of players.values()) {
    if (p === me) continue;
    const dx = p.tx - p.x, dy = p.ty - p.y;
    p.moving = Math.hypot(dx, dy) > 1;
    p.x += dx * Math.min(1, dt * 12); p.y += dy * Math.min(1, dt * 12);
    if (p.moving) p.anim += dt;
  }
  for (const p of players.values()) { // สัตว์เลี้ยงคู่ใจ (จำลองฝั่งเว็บ ไม่ต้องส่งตำแหน่ง)
    if (!p.pet || !COMPANIONS[p.pet]) { p.cp = null; continue; }
    const C = COMPANIONS[p.pet], bird = C.kind === 'bird', play = p.pm === 'play';
    const cp = p.cp || (p.cp = { id: p.id, kind: C.kind, v: C.v, x: p.x - 18, y: p.y + 6, dx: 1, anim: Math.random() * 6, moving: false, chase: false, wait: 0, gx: p.x, gy: p.y, nextSay: now + 8000 + Math.random() * 15000 });
    cp.sick = p.psick; cp.name = p.pname;
    const ax = play ? p.pax : p.x, ay = play ? p.pay : p.y, od = Math.hypot(p.x - cp.x, p.y - cp.y);
    const base = (bird ? 120 : C.kind === 'dog' ? 100 : 85) * (cp.sick ? 0.5 : 1);
    const free = (x, y) => bird || !blk(x, y);
    if (!play) { // เดินตาม: ห่างเกิน 2 ช่องจะวิ่งตามมาให้เหลือ 1 ช่อง • ยืนเฉยๆ เดินไปมาไม่เกิน 2 ช่อง
      if (od > TS * 14) { cp.x = p.x - 18; cp.y = p.y + 6; cp.chase = false; }
      if (od > TS * 2) cp.chase = true; else if (od <= TS) cp.chase = false;
      if (cp.chase) { const side = [[0, -1], [0, 1], [1, 0], [-1, 0]][p.dir | 0] || [0, -1]; cp.gx = p.x + side[0] * 22; cp.gy = p.y + side[1] * 14 + 4; cp.wait = 0; }
      else if (!cp.moving && (cp.wait -= dt) <= 0) { // สุ่มจุดเดินเล่นรอบเจ้าของ รัศมีไม่เกิน 2 ช่อง
        for (let k = 0; k < 8; k++) { const a = Math.random() * 6.283, r = (0.3 + Math.random() * 1.6) * TS, gx = p.x + Math.cos(a) * r, gy = p.y + Math.sin(a) * r; if (free(gx, gy)) { cp.gx = gx; cp.gy = gy; break; } }
        cp.wait = 1.2 + Math.random() * 3;
      }
    } else if (!cp.moving && (cp.wait -= dt) <= 0) { // ปล่อยวิ่งเล่น: ซนไปทั่วรัศมี 6 ช่องรอบจุดที่ปล่อย
      for (let k = 0; k < 10; k++) { const a = Math.random() * 6.283, r = Math.random() * 6 * TS, gx = ax + Math.cos(a) * r, gy = ay + Math.sin(a) * r; if (free(gx, gy)) { cp.gx = gx; cp.gy = gy; break; } }
      cp.wait = 0.4 + Math.random() * 2;
    }
    const d = Math.hypot(cp.gx - cp.x, cp.gy - cp.y), run = cp.chase ? (od > 70 ? 1.8 : 1.2) : play ? 1.25 : 0.45;
    if (d > 3) {
      const sp = Math.min(d, base * run * dt), nx = cp.x + (cp.gx - cp.x) / d * sp, ny = cp.y + (cp.gy - cp.y) / d * sp;
      if (free(nx, ny)) { cp.x = nx; cp.y = ny; cp.moving = true; cp.anim += dt * (cp.chase || play ? 1.4 : 1); if (Math.abs(cp.gx - cp.x) > 3) cp.dx = cp.gx > cp.x ? 1 : -1; } else { cp.gx = cp.x; cp.gy = cp.y; cp.moving = false; }
    } else { cp.moving = false; if (bird) cp.anim += dt * 0.5; }
    if (now > cp.nextSay) { cp.sayAt = now; cp.nextSay = now + 20000 + Math.random() * 30000; }
  }
  for (const n of npcs.values()) { const dx = n.tx - n.x, dy = n.ty - n.y; n.moving = Math.hypot(dx, dy) > 1; n.x += dx * Math.min(1, dt * 12); n.y += dy * Math.min(1, dt * 12); if (n.moving) n.anim += dt; }
  for (const q of pets.values()) { const dx = q.tx - q.x, dy = q.ty - q.y; q.moving = q.srvMoving || Math.hypot(dx, dy) > 1.5; q.x += dx * Math.min(1, dt * 8); q.y += dy * Math.min(1, dt * 8); if (q.moving) q.anim += dt; }
  for (const c of animals.values()) { // ขยับให้ลื่น: วัดความเร็วจริงแบบเฉลี่ย แล้วตัดสินเดิน/หยุด/ทิศหันแบบมีช่วงกันสั่น (ไม่สลับท่าไปมาทุกเฟรม)
    const ox = c.x, oy = c.y; c.x += (c.tx - c.x) * Math.min(1, dt * 6); c.y += (c.ty - c.y) * Math.min(1, dt * 6);
    if (dt > 0) { const k = Math.min(1, dt * 5); c.vx = (c.vx || 0) + ((c.x - ox) / dt - (c.vx || 0)) * k; c.vy = (c.vy || 0) + ((c.y - oy) / dt - (c.vy || 0)) * k; }
    const sp = Math.hypot(c.vx || 0, c.vy || 0); c.moving = c.moving ? sp > 3 : sp > 7;
    if (c.moving) { c.anim += dt; c.still = 0; if (Math.abs(c.vx) > 4) c.lr = c.vx > 0 ? 1 : -1; } else c.still = (c.still || 0) + dt;
    const ax = Math.abs(c.vx || 0), ay = Math.abs(c.vy || 0);
    const cand = !c.moving ? c.face : ay > ax * 1.4 ? (c.vy > 0 ? 'f' : 'b') : ax > ay * 0.8 ? 's' : c.face;
    if (!c.face) c.face = 's';
    if (cand && cand !== c.face) { c.faceT = (c.faceT || 0) + dt; if (c.faceT > 0.3) { c.face = cand; c.faceT = 0; } } else c.faceT = 0; // ทิศใหม่ต้องค้างอย่างน้อย 0.3 วิ ถึงเปลี่ยนท่า
  }
  swing = Math.max(0, swing - dt);
  { const he = heldEmoji(); if (he !== lastHeld) { lastHeld = he; me.held = he; send({ t: 'held', e: he }); } } // อุปกรณ์ในมือเปลี่ยน → บอกเซิร์ฟเวอร์
  updateSpeaking(now);

  { // เดินเข้าประตูบ้านหลังใหญ่ในเมือง → ถามว่าจะเข้าบ้านใคร
    const onDoor = !scene && Math.floor(me.x / TS) === Shared.HOUSE_DOOR.x && Math.floor(me.y / TS) === Shared.HOUSE_DOOR.y;
    if (onDoor && !doorLatch && !modalOpen()) { doorLatch = true; openHomeChoice(); } else if (!onDoor && !scene) doorLatch = false;
  }
  // กล้อง
  if (scene) { // ในบ้านกล้องตามตัวละครบนจอไอโซเมตริก ไม่ออกนอกตัวบ้าน
    const ex = me.x - me.y, ey = (me.x + me.y) / 2 - 14;
    camX = ISO_B.w <= vw ? ISO_B.x0 + (ISO_B.w - vw) / 2 : Math.max(ISO_B.x0, Math.min(ISO_B.x0 + ISO_B.w - vw, ex - vw / 2));
    camY = ISO_B.h <= vh ? ISO_B.y0 + (ISO_B.h - vh) / 2 : Math.max(ISO_B.y0, Math.min(ISO_B.y0 + ISO_B.h - vh, ey - vh / 2));
  } else {
    const mw = W * TS, mh = H * TS;
    camX = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, me.x - vw / 2));
    camY = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, me.y - vh / 2));
  }
  camX = Math.round(camX); camY = Math.round(camY);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = scene ? '#17110d' : '#2d4a2b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
  ctx.imageSmoothingEnabled = false;
  if (scene) { drawHouseWorld(now); frameTail(now, wall); return; } // ในบ้านวาดแยกแบบไอโซเมตริก
  ctx.drawImage(base, 0, 0, W * TS, H * TS);
  ctx.drawImage(baseHi, 0, 0);

  const x0 = Math.max(0, Math.floor(camX / TS)), x1 = Math.min(W - 1, Math.ceil((camX + vw) / TS));
  const y0 = Math.max(0, Math.floor(camY / TS)), y1 = Math.min(H - 1, Math.ceil((camY + vh) / TS));
  // น้ำเคลื่อนไหว: ประกายแสงเป็นขีดพิกเซล (ตรงกับตาราง 2 px) กะพริบไม่พร้อมกัน
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (MAP[y][x] === T.WATER) for (let i = 0; i < 2; i++) {
    const v = Math.sin(now / 520 + hash(x, y, i) * 40);
    if (v < 0.5) continue;
    ctx.fillStyle = v > 0.85 ? '#f2feff' : '#b6ecf2';
    ctx.fillRect(x * TS + 2 + Math.floor(hash(x, y, i + 3) * 11) * 2, y * TS + 4 + Math.floor(hash(x, y, i + 6) * 12) * 2, 4 + (i ? 2 : 0), 2);
  }
  // สระใหญ่ด้านล่าง (ตรงกับ shared.js: วงรีศูนย์กลาง (43,38) รัศมี 12×5 ช่อง): ปลา 6 ตัว ว่ายแยกกันคนละความเร็วและทิศ
  // ว่ายใต้สะพานได้ แต่สะพานกับเกาะทรายวาดทับ (ตัดตรงนี้ออกจากการวาดปลา)
  const POND = { cx: 43, cy: 38, rx: 12, ry: 5 }, B = Shared.BRIDGE, I = Shared.ISLAND;
  ctx.save(); ctx.beginPath(); ctx.rect(camX, camY, vw, vh);
  ctx.rect(B.x0 * TS, B.y0 * TS, (B.x1 - B.x0 + 1) * TS, (B.y1 - B.y0 + 1) * TS);
  ctx.rect(I.x0 * TS, I.y0 * TS, (I.x1 - I.x0 + 1) * TS, (I.y1 - I.y0 + 1) * TS);
  ctx.clip('evenodd');
  for (let i = 0; i < (scene ? 0 : 6); i++) {
    const ph = i * 2.3 + 0.7, fa = now * (0.00010 + i * 0.000025) + ph, fb = now * (0.00008 + i * 0.00002) + ph * 1.7;
    const ahead = Math.cos(fa) > 0 ? 1 : -1, wag = Math.sin(now / 150 + i) > 0 ? 1 : 0; // หางกระดิกสลับไปมา
    // ใช้ 0.7·rx กับ 0.6·ry ทำให้ทุกจุดอยู่ในสระแน่นอน (0.7² + 0.6² < 1)
    const fx = (POND.cx + 0.7 * POND.rx * Math.sin(fa) + 0.5) * TS, fy = (POND.cy + 0.6 * POND.ry * Math.sin(fb) + 0.5) * TS;
    if (fx < camX - TS || fx > camX + vw + TS || fy < camY - TS || fy > camY + vh + TS) continue;
    ctx.save(); ctx.translate(fx, fy); ctx.scale(ahead, 1);
    ctx.globalAlpha = 0.6; // อยู่ใต้น้ำ สีจึงจางและอมฟ้าตามน้ำ
    ctx.fillStyle = '#1d5a78'; ctx.fillRect(-7, -3 + wag, 3, 6); ctx.fillRect(-4, -4, 9, 8); // ขอบเข้ม 1 px
    ctx.fillStyle = ['#ff9a3c', '#f4f4f4', '#ffd23f', '#ff7a45', '#ffb347', '#f4f4f4'][i]; ctx.fillRect(-6, -2 + wag, 1, 4); ctx.fillRect(-3, -3, 7, 6);
    ctx.fillStyle = '#1d5a78'; ctx.fillRect(2, -2, 1, 1); // ตา
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  ctx.restore();
  // ใบบัวกระจายทั่วสระ มีทั้งใบใหญ่และเล็ก (วางตายตัวตามพิกัดช่อง ไม่ขยับ) อยู่เหนือปลา
  // ใบใหญ่มีแฉกเว้าเป็นรูปตัววี (ตัดออกจากขอบด้านขวา) ส่วนใบเล็กเป็นวงรีเต็ม
  const lilyPath = (px, py, rx, ry, notch) => {
    ctx.beginPath();
    if (notch) { ctx.moveTo(px, py); ctx.ellipse(px, py, rx, ry, 0, 0.4, Math.PI * 2 - 0.4); ctx.closePath(); }
    else ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (MAP[y][x] !== T.WATER || hash(x, y, 9) > 0.09) continue;
    const px = (x + 0.5) * TS, py = (y + 0.5) * TS, big = hash(x, y, 11) < 0.5;
    const rx = big ? 11 : 5, ry = big ? 8 : 3.6; // ใบใหญ่ 22×16 px • ใบเล็ก 10×7 px
    ctx.fillStyle = '#1f4f1f'; lilyPath(px, py, rx + 1, ry + 1, big); // ขอบเข้ม 1 px
    ctx.fillStyle = '#2d6e2a'; lilyPath(px, py, rx, ry, big); // ใบ
    ctx.fillStyle = '#4fa048'; ctx.beginPath(); ctx.ellipse(px - rx * 0.15, py - ry * 0.2, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2); ctx.fill(); // ไฮไลต์
  }
  // ช่องฟาร์ม
  if (!scene) for (const k in farm) {
    const [fx, fy] = k.split(',').map(Number);
    if (fx < x0 || fx > x1 || fy < y0 || fy > y1) continue;
    drawCrop(farm[k], fx * TS, fy * TS, now);
  }
  // จุดหมายที่คลิกให้เดิน
  if (walk && walk.dest) {
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(walk.dest[0] * TS + 16, walk.dest[1] * TS + 16, 6 + Math.sin(now / 150) * 2, 0, 7); ctx.stroke();
  }
  // ไม่วาดกรอบสี่เหลี่ยมบนพื้นแล้ว (ช่องที่ชี้/ช่องที่คลิก) — ใช้เคอร์เซอร์เมาส์เปลี่ยนเป็นรูปมือเมื่อชี้ของที่กดได้แทน
  { let cur = ''; if (mouse.active && !isTouch && mouse.tx >= 0 && mouse.ty >= 0 && mouse.tx < W && mouse.ty < H && (interactive(mouse.tx, mouse.ty) || hubSignAt(mouse.tx, mouse.ty))) cur = 'pointer'; if (canvas.style.cursor !== cur) canvas.style.cursor = cur; }

  if (!scene) drawButterflies(now);
  // วาดตามลำดับ y
  const list = [];
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1 + 2); y++) for (let x = Math.max(0, x0 - 1); x <= Math.min(W - 1, x1 + 1); x++) if (MAP[y][x] === T.TREE) list.push({ y: y * TS + 30, f: () => drawTree(x, y) });
  if (!scene) for (const b of BUILDINGS) if (b.kind !== 'sign' && b.kind !== 'cinema' && b.x1 >= x0 - 1 && b.x0 <= x1 + 1 && b.y1 >= y0 - 1 && b.y0 <= y1 + 2) list.push({ y: (b.y1 + 1) * TS - 2, f: () => drawBuilding(b) });
  // กองไฟ + ที่นั่งในลานกลางหมู่บ้าน (ที่นั่งไม่ใช่สิ่งกีดขวาง วาดอยู่ใต้ตัวละคร)
  if (!scene) for (const s of SEATS) if (s.x >= x0 - 1 && s.x <= x1 + 1 && s.y >= y0 - 1 && s.y <= y1 + 1) list.push({ y: s.y * TS + 12, f: () => drawSeat(s) });
  if (!scene) if (FIRE.x >= x0 - 1 && FIRE.x <= x1 + 1 && FIRE.y >= y0 - 1 && FIRE.y <= y1 + 1) list.push({ y: FIRE.y * TS + 28, f: () => drawFire(now) });
  if (!scene) for (const [hx, hy] of Shared.BEE.hives) list.push({ y: (hy + 1) * TS - 2, f: () => drawHive(hx, hy, now) });
  if (!scene) for (const key of Object.keys(Shared.PENS)) list.push({ y: (Shared.PENS[key].sign[1] + 1) * TS, f: () => drawPenSign(key) });
  if (!scene) for (const c of animals.values()) list.push({ y: c.y + 8, f: () => { (c.type === 'cow' ? drawCow : c.type === 'pig' ? drawPig : ANIMAL_DRAW[c.type] || drawChicken)(c, now); animalFx(c, now, ANIMAL_TOP[c.type] || 14); hungerMark(c, now); } });
  if (!scene) for (const q of pets.values()) list.push({ y: q.y + 8, f: () => drawPet(q, now) });
  for (const p of players.values()) if (p.cp) list.push({ y: p.cp.y + 8, f: () => drawCompanion(p.cp, now) });
  for (const p of players.values()) list.push({ y: p.y + 12, f: () => drawPlayer(p, now) });
  if (!scene) for (const n of npcs.values()) if (n.x > camX - 40 && n.x < camX + vw + 40 && n.y > camY - 60 && n.y < camY + vh + 60) list.push({ y: n.y + 12, f: () => drawPlayer(n, now) });
  list.sort((a, b) => a.y - b.y).forEach(o => o.f());

  // โรงหนัง: ป้ายสถานะใต้จอ + 🍿 เหนือหัวคนที่กำลังดู
  if (cin && !scene) {
    const mv = cin.movie ? { name: cin.name } : null, txt = mv ? `▶ ${mv.name} • 🍿 ${cin.viewers.length} คน` : '🎬 ว่าง กดที่จอเพื่อฉายหนัง';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold 11px ${FONT}`;
    const w = ctx.measureText(txt).width + 12, cx = 17 * TS, cy = 35 * TS - 4;
    ctx.fillStyle = mv ? 'rgba(160,30,30,.85)' : 'rgba(0,0,0,.6)'; ctx.fillRect(cx - w / 2, cy - 9, w, 18);
    ctx.fillStyle = '#fff'; ctx.fillText(txt, cx, cy);
    for (const id of cin.viewers) { const p = players.get(id); if (p) { ctx.font = '14px sans-serif'; ctx.fillText('🍿', p.x + 14, p.y - 34); } }
  }
  // ป้าย Arcade Hub: ให้รู้ว่ากดได้ — กรอบเรืองแสงกะพริบ + ป้ายเล็ก "แตะ" ลอยเหนือป้าย + เมาส์ชี้เปลี่ยนเป็นรูปมือ
  if (hubSign && !scene) {
    const bx = hubSign.x0 * TS, by = hubSign.y0 * TS, bw = (hubSign.x1 - hubSign.x0 + 1) * TS, hov = mouse.active && hubSignAt(mouse.tx, mouse.ty), pl = 0.5 + 0.5 * Math.sin(now / 320);
    const lt = hov ? '👆 กดเลย!' : '👆 คะแนน', ly = by - 14 - (hov ? 0 : pl * 2);
    ctx.font = `bold 8px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const lw = bw * 0.5; // กว้างเท่าป้าย Arcade
    ctx.fillStyle = '#3d2a1a'; ctx.fillRect(bx + bw / 2 - lw / 2 - 1, ly - 8, lw + 2, 17); ctx.fillStyle = hov ? '#ffe266' : '#fff3d6'; ctx.fillRect(bx + bw / 2 - lw / 2, ly - 7, lw, 15);
    ctx.fillStyle = '#3d2a1a'; ctx.fillText(lt, bx + bw / 2, ly);
  }
  // ป้ายสถานะเหนือตู้เกม (ว่าง / รอคู่ / กำลังเล่น)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold 10px ${FONT}`;
  CABINETS.forEach((c, i) => {
    if (scene || !c.game || c.x < x0 - 1 || c.x > x1 + 1 || c.y < y0 - 1 || c.y > y1 + 1) return;
    const s = arcStatus[i]; if (!s) return;
    const uno = ['uno', 'bacc', 'bj', 'pok', 'react', 'rps'].includes(s[7]);
    const txt = s[2] === 'waiting' ? `⏳ ${s[4]}${uno ? ' ' + s[5] : ''}${s[3] ? ' 🪙' + s[3] : ''}` : s[2] === 'playing' ? (uno ? `${s[7] === 'uno' ? '🃏 กำลังเล่น' : PARTY_GAMES.has(s[7]) ? '🎮 กำลังเล่น' : '🎰 เล่นอยู่'} ${s[5]}` : `⚔️ ${s[4]} vs ${s[5]}`) : s[2] === 'over' ? '🏁 จบเกม' : '🎮 ว่าง';
    if (s[2] === 'idle') { // ว่าง = จุดสีเขียวบนป้ายตู้ (ไม่ใช้คำว่าว่าง)
      ctx.fillStyle = '#1b5e20'; ctx.beginPath(); ctx.arc(c.x * TS + 24, c.y * TS - 8, 3.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(c.x * TS + 24, c.y * TS - 8, 2.4, 0, 7); ctx.fill();
      return;
    }
    const w = ctx.measureText(txt).width + 10, cx = c.x * TS + 16, cy = c.y * TS - 16;
    ctx.fillStyle = 'rgba(138,111,209,.92)'; ctx.fillRect(cx - w / 2, cy - 7, w, 14);
    ctx.fillStyle = '#fff'; ctx.fillText(txt, cx, cy);
  });
  // เบ็ด + แอนิเมชันเครื่องมือ
  for (const p of players.values()) {
    if (p.fs) drawFishing(p, performance.now());
  }
  if (fg) { // ตัวชี้เกจตกปลา (เส้นทางเดียวกับที่เซิร์ฟเวอร์คำนวณ)
    const pos = gaugePos({ gt0: fg.t0, per: fg.per }, performance.now()), inZ = Math.abs(pos - fg.c) <= fg.half;
    $('fgmk').style.left = pos * 100 + '%'; $('fgauge').classList.toggle('hit', inZ);
  }

  if (!scene) drawLighthouse(ctx, now);
  frameTail(now, wall);
}
requestAnimationFrame(step);
})();
