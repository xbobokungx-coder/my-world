(() => {
'use strict';
const { QUEST_ALL, ACH, REPAIR, toolPrice, canRepair, TS, W, H, T, FARM, DAY_MS, CLOCK_MS, CANS, canTier, gaugePos, FISH_GAUGE, MAX_LV, CROPS, FISH, ANIMALS, COMPANIONS, PETCARE, RODS, BUILDINGS, SHOPS, SKILLS, DIRS,
  WEAR, WEAR_CATS, WEAR_DEFAULT, wearKey, PANTS_COLOR, MEALS, PLAYER_HUNGER, AXES, SELLBACK, sellbackValue, PLAZA, FIRE, SEATS, seatAt, isChoppable,
  DURABILITY, durMax, repairCost, TRADE, TICKET, MOVIES, cinemaAt, CINEMA_CENTER, isTradable, tradeValue,
  GAME_TITLES, COOK, COOK_FEE, craftFee, COOK_CATS, cookCat, PROJECTS, sellQuote, sellCat, CABINETS, BETS, makeMap, blockedAt, facing, itemInfo, shopSells, shopAt, levelOf, xpFor, woodXp, inFarm, HOUSING, plotAt, plotSignAt, FURN, TOWN, BOARD, RANKBOARD, LUCKY, FLEA, reviveCost, QUESTS, titleFor, TITLES, POINTS, BUFFS, FAME, ATM, BANK, VILLAGE, BOTBET, playLevel, CRAFT, STARTER, STARTER_GO, START_SPAWN, STARTER_FINAL, BOOK, WEEKLY, bookInfo, SELLABLE } = Shared;
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
const TOOL_LIST = ['hoe', 'water', 'rod', 'axe', 'pick'], TOOL_SHORT = { hand: 'มือเปล่า', hoe: 'จอบ', water: 'บัวรดน้ำ', rod: 'เบ็ด', axe: 'ขวาน', pick: 'อุปกรณ์ขุด' };
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
const players = new Map(), animals = new Map(), npcs = new Map(); const roster = new Map();
const presence = (id, fn) => { for (const p of [players.get(id), roster.get(id)]) if (p) fn(p); }; // roster = ทุกคนออนไลน์ในห้อง (ข้ามฉาก) ใช้รายชื่อและการโทร • players = คนในฉากเดียวกัน (วาดและเสียงรอบตัว) // npcs = ชาวเมือง NPC (ไม่นับเป็นผู้เล่น)
let farm = {}, inv = {}, skills = { farm: 0, fish: 0, animal: 0 }, market = {}, hunger = 80;
const furn = new Map();               // เฟอร์นิเจอร์ในบ้านที่เปิดอยู่ (ฉากบ้าน): id -> { i, f, x, y, r, z, on, wl, u } พิกัดหน่วยช่อง
let townLog = [], townTab = 'log', lottoSt = null, rankSt = null, rankTab = 'lv', rankSub = 'all', fleaTab = 'sell', bidSt = [];
// ประกาศถึงผู้เล่น (public/notices.js) ปักหมุดบนสุดของแท็บข่าวเมือง • จำว่าอ่านแล้วต่อเบราว์เซอร์ (localStorage) • ข่าวเมืองซ่อนคนเข้า-ออกได้
const NOTICES = (window.Notices && window.Notices.NOTICES) || [];
const noticeSeenId = () => ls.get('mw_notice_seen') || '', noticeUnread = () => !!NOTICES.length && noticeSeenId() !== NOTICES[0].id;
const lottoPendSum = () => lottoSt && lottoSt.pend ? lottoSt.pend.reduce((n, e) => n + (e[2] > 0 ? e[2] : 0), 0) : 0; // รางวัลหวยรอรับ (เซิร์ฟเวอร์เป็นคนนับ)
function updateNoticeDot() { const b = $('townBtn'); if (b) b.classList.toggle('hasnew', noticeUnread() || lottoPendSum() > 0); }
let noticeToasted = false;
function noticeIntro() { updateNoticeDot(); if (noticeUnread() && !noticeToasted) { noticeToasted = true; toast('📢 มีประกาศใหม่ เปิดดูที่ 📰 ข่าวเมือง'); } } // เด้งครั้งเดียวต่อการเปิดหน้าเว็บ (ต่อใหม่อัตโนมัติไม่เด้งซ้ำ) ถ้ายังไม่ได้อ่าน
let townNoticeOpen = '', townNoticeFreshId = '', newsHideNoise = ls.get('mw_news_noise') !== '0'; // ค่าเริ่มต้นซ่อน 👋 เข้ามา / 🚪 ออกไป ให้เห็นข่าวที่สำคัญก่อน

let arcSt = { pts: 0, total: 0, wk: 0 };                               // แต้มตู้เกมของเรา
let lbSt = { total: [], wk: [], me: null }, hubTab = 'rank';           // Leaderboard + ศูนย์รวมแต้ม/รางวัล
let questSt = { list: [], total: 0, title: '', pts: { bal: 0, earned: 0 } }, fameSt = {};
let enSt = { v: 100, ex: false, rate: 0, resume: 10, rareUntil: 0, at: Date.now() }, catSt = { c: {}, recover: 0.04 }, bankSt = { bal: 0, cap: BANK.cap }, villageSt = { n: 0, goal: 0, done: false, left: 0 };
let villageEnd = 0; // เวลาที่บัฟ Happy Village หมด (ms ของนาฬิกาเครื่องนี้)
const happyOn = () => villageEnd > Date.now();
const buffExp = {}; // บัฟที่ยังมีผลอยู่: id -> เวลาหมด (ms ของนาฬิกาเครื่องนี้)
const buffOn = id => (buffExp[id] || 0) > Date.now();
const build = { on: false, sel: null, erase: false, pick: null, rot: 0 }; // sel = ชนิดที่จะวาง • erase = เก็บคืน • pick = id ของชิ้นที่เลือกไว้จะย้าย/หมุน • rot = ทิศของชิ้นที่จะวาง
let deepFloor = 1, fg = null, ft = null, ftHold = false, wtr = 10, dur = {}, cin = null, cinAt = 0, cinWatching = false, tradeSt = null, tradeReq = null;
const mult = k => market[k] || 1;
const wallNow = () => Date.now() + timeOffset;
let timeOffset = 0, lastSend = 0, lastSent = '', swing = 0, lastAct = 0, actGap = 200, shopKind = null, bagTab = 'status', flash = null;
let miniState = ls.get('mw_mini') || 'small'; // small | big | off
const keys = {}, joy = { x: 0, y: 0 };
let chatFocus = false, walk = null;
const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && !matchMedia('(any-pointer: fine)').matches); // โน้ตบุ๊กจอสัมผัสที่มีเมาส์ ใช้โหมดคอม
if (isTouch) document.body.classList.add('touch');
['gesturestart', 'gesturechange', 'contextmenu'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
const lvl = s => levelOf(skills[s], s);
const rodLevel = () => Shared.rodTier(inv);
const axeLevel = () => Shared.axeTier(inv);
const pickLevel = () => Shared.pickTier(inv);
const toolLocked = t => (t === 'axe' && !axeLevel()) || (t === 'pick' && !pickLevel());

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
$('pin').addEventListener('keydown', e => { if (e.key === 'Enter') joinGame(); });
// ตั้ง/เปลี่ยน PIN ในเกม (เซิร์ฟเวอร์ขอให้ตั้งถ้ายังไม่มี หรือกดจากแท็บข้อมูลฉัน)
function showPinBox(has) { $('pinOld').classList.toggle('hidden', !has); $('pinOld').value = ''; $('pinNew').value = ''; $('pinBox').classList.remove('hidden'); setTimeout(() => (has ? $('pinOld') : $('pinNew')).focus(), 50); }
$('pinLater').onclick = () => $('pinBox').classList.add('hidden');
$('pinSave').onclick = () => { const p = $('pinNew').value.trim(); if (!/^\d{4,6}$/.test(p)) return toast('PIN ต้องเป็นตัวเลข 4–6 หลัก'); send({ t: 'pin', pin: p, old: $('pinOld').value.trim() }); $('pin').value = p; // ค้างไว้ในหน้าเว็บเท่านั้น เพื่อต่อเกมใหม่อัตโนมัติด้วย PIN ใหม่ (ไม่ลง localStorage)
    $('pinBox').classList.add('hidden'); };

// ต่อเกมใหม่อัตโนมัติ (WP-03): หลุดกลางเกมแล้วลองต่อใหม่ถอยหลัง 1,2,4,8,16,30 วิ ด้วยชื่อ/สี/ห้อง/PIN ในหน้าเว็บ (PIN ไม่เก็บลง localStorage)
// ไม่ต่อใหม่เมื่อโดนเตะ/ล็อกอินซ้ำ (kicked) หรือเซิร์ฟเวอร์ปฏิเสธ (err) เพื่อไม่ให้เตะกันวนลูปสองแท็บ
const RC_WAIT = [1, 2, 4, 8, 16, 30, 30, 30, 30, 30]; // วินาที รวมราว 3 นาที แล้วขึ้นกล่องหลุดเดิม
let rc = null, noRetry = false; // rc = { n, timer } ตอนกำลังต่อใหม่
function rcStop(showDc) { if (rc && rc.timer) clearTimeout(rc.timer); rc = null; $('rcBar').classList.add('hidden'); if (showDc) $('dc').classList.remove('hidden'); }
function rcSchedule(name) {
  if (noRetry || !joined) return rcStop(true);
  rc = rc || { n: 0, timer: 0 };
  if (rc.n >= RC_WAIT.length) return rcStop(true);
  const sec = RC_WAIT[rc.n++]; $('rcBar').textContent = `🔄 กำลังเชื่อมต่อใหม่… (ครั้งที่ ${rc.n}/${RC_WAIT.length})`; $('rcBar').classList.remove('hidden');
  rc.timer = setTimeout(() => connect(name), sec * 1000);
}
function connect(name) {
  const sock = ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  sock.onopen = () => sock.send(JSON.stringify({ t: 'join', name, color, room: roomParam(), pin: $('pin').value.trim(), ch: (() => { try { return new URLSearchParams(location.search).get('ch') || ''; } catch (e) { return ''; } })(), akey: $('akey').value || ls.get('mw_akey') || '' }));
  sock.onmessage = e => { if (ws === sock) handle(JSON.parse(e.data)); };
  sock.onclose = () => {
    if (ws !== sock) return;
    if (joined) rcSchedule(name); // หลุดกลางเกม (หรือรอบต่อใหม่ล้มเหลว) → ลองใหม่
    else { $('go').disabled = false; if (!$('loginErr').textContent) $('loginErr').textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'; }
  };
}
const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

// ---------- messages ----------
function mkPlayer(o) {
  return { id: o.id, wet: !!o.wet, veh: o.veh || '', held: o.held || '', status: o.status || '', title: o.title || '', name: o.name, color: o.color, hat: o.hat || '#e8c66a', pc: o.pc || PANTS_COLOR, wear: Object.assign({}, WEAR_DEFAULT, o.wear), pet: o.pet || '', pm: o.pm || 'follow', pax: o.pax || o.x, pay: o.pay || o.y, psick: !!o.psick, plv: o.plv | 0 || 1, pname: o.pname || '', x: o.x, y: o.y, tx: o.x, ty: o.y, dir: o.dir || 0, fs: 0, fx: 0, fy: 0, anim: 0, moving: false, chat: '', chatAt: 0, voice: !!o.voice, speaking: false, lamp: !!o.lamp, sit: false, deaf: !!o.deaf };
}
const treeKinds = new Map(); // 'x,y' → ชนิดต้นไม้ (Shared.TREE_KINDS) จากเซิร์ฟเวอร์ ใช้เลือกสไปรต์
function applyTrees(list) { // ซิงก์ต้นไม้ที่ตัดได้ให้ตรงกับเซิร์ฟเวอร์ (ต้นไม้ขอบแมพไม่เปลี่ยน)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isChoppable(MAP, x, y)) MAP[y][x] = T.GRASS;
  treeKinds.clear();
  for (const [x, y, k] of list) if (MAP[y] && MAP[y][x] === T.GRASS) { MAP[y][x] = T.TREE; if (k) treeKinds.set(x + ',' + y, k); }
}
function applyMapOv(ov) { // ช่องที่ผู้ดูแลวาดทับ (หลังต้นไม้)
  if (!ov) return;
  for (const [k, t] of Object.entries(ov)) {
    const [x, y] = k.split(',').map(Number);
    if (!MAP[y] || x < 1 || y < 1 || x > W - 2 || y > H - 2) continue;
    MAP[y][x] = t;
    if (t === T.TREE) treeKinds.set(x + ',' + y, treeKinds.get(x + ',' + y) || 'broad');
    else treeKinds.delete(x + ',' + y);
  }
  townDirty = true;
}
function applyMapCells(cells) {
  if (!Array.isArray(cells)) return;
  for (const c of cells) {
    const x = c[0], y = c[1], t = c[2];
    if (!MAP[y] || x < 1 || y < 1 || x > W - 2 || y > H - 2) continue;
    MAP[y][x] = t;
    if (t === T.TREE) treeKinds.set(x + ',' + y, treeKinds.get(x + ',' + y) || 'broad');
    else treeKinds.delete(x + ',' + y);
  }
  townDirty = true;
  if (typeof MapEdit !== 'undefined' && MapEdit.shown()) MapEdit.draw();
}
function handle(m) {
  switch (m.t) {
    case 'err': if (joined && rc) { const d = $('dc').firstElementChild; if (d) d.textContent = m.text || 'เชื่อมต่อใหม่ไม่สำเร็จ'; noRetry = true; rcStop(true); break; } $('loginErr').textContent = m.text; $('go').disabled = false; if (m.need === 'pin' || m.need === 'setpin') $('pin').focus(); if (m.need === 'akey') { $('akey').classList.remove('hidden'); $('akey').focus(); ls.set('mw_akey', ''); } break;
    case 'w':
      setTimeout(noticeIntro, 2500); send({ t: 'lotto', a: 'get' }); // ถามหวยรอรับไว้ขึ้นจุดแดง
      if (rc) rcStop(false); resetScene(); lastHeld = null; joined = true; myId = m.id; inv = m.inv; if (m.fr) freshSt = m.fr; farm = m.farm; skills = Object.assign({ farm: 0, fish: 0, animal: 0, wood: 0 }, m.skills); if (m.arc) arcSt = m.arc; timeOffset = m.time - Date.now(); setHunger(m.hunger === undefined ? 80 : m.hunger);
      dur = m.dur || {}; deepFloor = m.deep || 1; wtr = m.wtr === undefined ? CANS[canTier(inv)].cap : m.wtr; setCin(m.cin);
      if (m.trees) applyTrees(m.trees);
      if (m.mapOv) applyMapOv(m.mapOv);
      checkProjects(); // สะพาน/ประภาคาร/เกาะ มีให้เลยตั้งแต่ต้น
      if (m.mocks && typeof MapEdit !== 'undefined') MapEdit.setMocks(m.mocks);
      furn.clear();
      players.clear();
      m.players.forEach(p => players.set(p.id, mkPlayer(p)));
      roster.clear(); (m.roster || []).forEach(q => roster.set(q.id, mkPlayer(q)));
      npcs.clear(); (m.npcs || []).forEach(n => npcs.set(n.id, mkPlayer(n)));
      pets.clear(); (m.pets || []).forEach(q => pets.set(q.id, { id: q.id, kind: q.kind, v: q.v, x: q.x, y: q.y, tx: q.x, ty: q.y, dir: q.dir, dx: q.dir === 2 ? -1 : 1, anim: Math.random() * 6, moving: false }));
      if (m.first) { slot = 0; selTool = 'hoe'; ls.set('mw_tool', 'hoe'); } // เข้าเกมครั้งแรก: ถือจอบพร้อมขุด (คู่มือข้อแรก)
      me = players.get(myId); updateLampBtn(); updatePetBtn(); syncDeaf();
      $('login').classList.add('hidden');
      ['hudTop', 'hotbar', 'chat', 'mini'].forEach(i => $(i).classList.remove('hidden'));
      layoutHud(); setMini(miniState);
      if (isTouch) { $('joy').classList.remove('hidden'); $('abtn').classList.remove('hidden'); }
      roomName = m.room || 'main'; isAdmin = !!m.admin; if (m.admin) setDev(m.dev); setSnowMode(m.snow); if (isAdmin && $('akey').value) ls.set('mw_akey', $('akey').value); $('adminBtn').classList.toggle('hidden', !isAdmin);
      history.replaceState(null, '', roomLink(roomName).slice(location.origin.length)); // คงชื่อห้องไว้ใน URL เผื่อรีเฟรช
      renderHud(); updateOnline();
      players.forEach((p, id) => { if (id < myId) callPeer(id); }); // ผู้เล่นใหม่เป็นฝ่ายโทรหาคนที่อยู่ก่อน
      break;
    case 'chatlog': chatHist.length = 0; for (const e of m.list || []) if (!isBlockedName(e.name)) chatHist.push(e); break;
    case 'ach': achSt = { cnt: m.cnt || {}, got: m.got || {}, sel: m.sel || '' }; if (achShown()) renderAch(); break;
    case 'deaf': presence(m.id, p => { p.deaf = !!m.on; }); break;
    case 'use': { const p = players.get(m.id); if (p) { p.useAt = performance.now(); p.useK = PixelAction.kindOf(p.held) === 'fish' && p.fs ? 'reel' : ''; } break; } // ตกปลาอยู่แล้ว = ท่าดึงเบ็ด
    case 'oh': { const now = performance.now(); oreHit.set(m.x + ',' + m.y, { t: now, f: m.f }); if (m.d > 0 && cave) { oreDmg.push({ x: m.x, y: m.y, t: now, d: m.d, c: !!m.c }); if (oreDmg.length > 12) oreDmg.shift(); if (m.c) playSfx('crit'); } break; } // ก้อนแร่โดนฟาด: สั่น + รอยร้าวตาม HP ที่เหลือ
    case 'th': treeHit.set(m.x + ',' + m.y, { t: performance.now(), f: m.f }); break; // ต้นไม้โดนฟัน: ส่าย + รอยบากที่โคน
    case 'catch': { const p = players.get(m.id), F = Shared.FISH_ALL.find(f => f.id === m.f); if (p && F) p.catchFx = { t: performance.now(), e: F.emoji, big: F.sell >= Shared.RARE_SELL, x: p.fx || p.x, y: p.fy || p.y }; break; } // ปลากระโดดขึ้นมาอยู่เหนือหัว
    case 'held': { const p = players.get(m.id); if (p) p.held = m.e || ''; break; }
    case 'status': presence(m.id, p => { p.status = m.s || ''; }); if (peopleShown()) renderPeople(true); break;
    case 'voice': presence(m.id, p => { p.voice = m.on; if (!m.on) p.speaking = false; }); if (peopleShown()) renderPeople(true); break;
    case 'look': { const p = players.get(m.id); if (p) { p.color = m.color; p.hat = m.hat; if (m.pc) p.pc = m.pc; if (m.wear) p.wear = Object.assign({}, WEAR_DEFAULT, m.wear); if (m.lamp !== undefined) p.lamp = !!m.lamp; if (arcOpenNow() || bagShown() || shopKind) refreshOpen(); updateLampBtn(); } break; }
    case 'pet': { const p = players.get(m.id); if (p) { p.pet = m.pet || ''; p.pm = m.mode || 'follow'; p.pax = m.ax; p.pay = m.ay; p.psick = !!m.sick; p.pname = m.name || ''; p.plv = m.plv | 0 || 1; p.cp = null; if (p.id === myId) { refreshOpen(); updatePetBtn(); } } break; }
    case 'pst': petSt = m.pst || {}; petNames = m.names || {}; refreshOpen(); updatePetBtn(); break;
    case 'ore': { if (cave) { const k = m.x + ',' + m.y; if (m.k) { oreK.set(k, m.k); oreS.set(k, m.s | 0); MAP[m.y][m.x] = T.ORE; oreBurst.delete(k); } else { oreBurst.set(k, { t: performance.now(), k: oreK.get(k), s: oreS.get(k) | 0 }); oreK.delete(k); oreS.delete(k); oreHit.delete(k); MAP[m.y][m.x] = T.CAVE; } } break; } // ก้อนแร่ในถ้ำเกิด/แตก
    case 'tree': { const tm = tmap(); if (tm[m.y]) { if (m.on) { if (tm[m.y][m.x] === T.GRASS) tm[m.y][m.x] = T.TREE; if (m.k) treeKinds.set(m.x + ',' + m.y, m.k); } else if (isChoppable(tm, m.x, m.y)) { const tk = m.x + ',' + m.y; if (inTown()) felled.set(tk, { t: performance.now(), k: treeKinds.get(tk), side: me && me.x > (m.x + 0.5) * TS ? -1 : 1 }); tm[m.y][m.x] = T.GRASS; treeKinds.delete(tk); treeHit.delete(tk); } } break; }
    case 'lotto': lottoSt = m.l; updateNoticeDot(); if (townShown()) renderTown(); break;
    case 'cookcd': cookReadyAt = Date.now() + (+m.ms || 0); if (!$('shop').classList.contains('hidden') && shopKind === 'food' && farmTab === 'cook') renderShop(); break;
    case 'mapcell': applyMapCells(m.cells); break;
    case 'reload': { toast('🗺️ ผู้ดูแลเปลี่ยนผังเมือง กำลังรีเฟรช…'); const tryReload = n => fetch('/healthz', { cache: 'no-store' }).then(r => { if (r.ok) location.reload(); else throw 0; }).catch(() => { if (n < 40) setTimeout(() => tryReload(n + 1), 1000); }); setTimeout(() => tryReload(0), 3000); break; }
    case 'mapreset': {
      const fresh = makeMap(); for (let y = 0; y < H; y++) MAP[y] = fresh[y];
      if (m.trees) applyTrees(m.trees);
      builtProj.clear(); checkProjects(); townDirty = true;
      if (typeof MapEdit !== 'undefined' && MapEdit.shown()) MapEdit.draw();
      break;
    }
    case 'mocks': if (typeof MapEdit !== 'undefined') { MapEdit.setMocks(m.mocks || []); if (MapEdit.shown()) MapEdit.draw(); } break;
    case 'hun': setHunger(m.v); break;
    case 'rtc': onRtc(m.from, m.d); break;
    case 'pcall': onPcall(m.from, m.k); break;
    case 'on': if (m.id !== myId) roster.set(m.id, mkPlayer(m)); updateOnline(); if (peopleShown()) renderPeople(true); break;
    case 'off': { const id = m.id; roster.delete(id); if (callIn === id) { callIn = 0; clearTimeout(callTimer); callBox(false); } if (callWith === id || callPend === id) { const q = roster.get(id); leaveCall(); toast(`📵 ${q ? q.name : 'เพื่อน'} ออกจากเกมแล้ว สายถูกวาง`); } closePeer(id); updateOnline(); if (peopleShown()) renderPeople(true); break; }
    case 'p+': players.set(m.id, mkPlayer(m)); updateOnline(); if (!m.quiet) addChat('', `${m.name} เข้ามาในฟาร์ม 👋`, true); break;
    case 'p-': { const p = players.get(m.id); if (p && !m.quiet) addChat('', `${p.name} ออกไปแล้ว`, true); players.delete(m.id); if (m.id !== callWith) closePeer(m.id); updateOnline(); break; } // ย้ายฉาก: สายโทรส่วนตัวยังต่ออยู่
    case 's': {
      for (const [id, x, y, d, fs, fx, fy, sit, bt] of m.p) {
        const p = players.get(id); if (!p) continue;
        if (fs && !p.fs) p.castAt = performance.now(); // เพิ่งเหวี่ยงเบ็ด: เริ่มแอนิเมชันทุ่นลอยเป็นวงโค้ง
        if (!fs && p.fs && id === myId && fg) { fg = null; $('fgauge').classList.add('hidden'); }
        if (!fs && p.fs && id === myId && ft && !ft.end) { ft = null; ftHold = false; $('ffight').classList.add('hidden'); } // ยกเลิกตกปลา (เดินหนี ฯลฯ) ปิดแผงชักเย่อด้วย
        p.fs = fs; p.fx = fx; p.fy = fy; p.sit = !!sit; p.lie = sit === 2; p.bt = bt || 1;
        if (id !== myId) { p.tx = x; p.ty = y; p.dir = d; }
      }
      for (const [id, x, y, d, fs, fx, fy] of (m.n || [])) { const n = npcs.get(id); if (!n) continue; n.tx = x; n.ty = y; n.dir = d;
        const f = fs || 0; if (f && !n.fs) { n.castAt = performance.now(); n.useAt = n.castAt; n.useK = ''; } if (!f && n.fs) { n.useAt = performance.now(); n.useK = 'reel'; } // เหวี่ยง/ดึงเบ็ด (NPC ตกปลาประกอบฉาก ภาพอย่างเดียว)
        n.fs = f; n.fx = fx || 0; n.fy = fy || 0; n.held = f || n.useK === 'reel' && performance.now() - n.useAt < 700 ? '🎣' : ''; }
      for (const [id, x, y, d, mv] of (m.pt || [])) { const q = pets.get(id); if (q) { q.tx = x; q.ty = y; q.dir = d; q.srvMoving = !!mv; if (d === 2) q.dx = -1; else if (d === 3) q.dx = 1; } }
      const alive = new Set();
      for (const [id, type, x, y, prod, fed, dx, hg, sick, lock, fn, on] of m.c) {
        alive.add(id);
        let a = animals.get(id);
        if (!a) { a = { x, y, anim: Math.random() * 6, id }; animals.set(id, a); }
        const oldH = a.h;
        a.type = type; a.tx = x; a.ty = y; a.prod = prod; a.fed = fed; a.dx = dx; a.h = hg === undefined ? 100 : hg; a.sick = !!sick; a.lock = !!lock; a.fn = fn || ''; a.on = on || ''; if (oldH !== undefined && a.h > oldH + 15) a.happyAt = performance.now(); // เพิ่งได้กิน = ดีใจ
      }
      for (const id of animals.keys()) if (!alive.has(id)) animals.delete(id);
      break;
    }
    case 'tile': if (m.v) farm[m.k] = m.v; else delete farm[m.k]; break;
    case 'deep': deepFloor = m.n | 0 || 1; refreshOpen(); break;
    case 'inv': inv = m.inv; if (m.deep) deepFloor = m.deep; if (m.fr) freshSt = m.fr; renderHud(); refreshOpen(); updateLampBtn(); updatePetBtn(); break;
    case 'skills': { const old = skillBarKey(); const ox = old ? skills[old] || 0 : 0; skills = m.skills; refreshOpen(); if (old && (skills[old] || 0) > ox) showSkillBar(); break; }
    case 'msg': toast(m.text); break;
    case 'lvup': onLvUp(m); break; // ใครสักคนเลเวลอัพ: ฉลอง (เรา = แบนเนอร์ใหญ่, คนอื่น = ประกายเล็ก)
    case 'gift': showGift(m.item); break;
    case 'pinask': pinSt = !!m.has; if (m.show) showPinBox(pinSt); break;
    case 'newbie': showGreet(m.id, m.name); break;
    case 'mkt': Object.assign(market, m.m); refreshOpen(); break;
    case 'sfx': {
      let k = 1;
      if (scene && !m.self && m.id !== myId && !(m.id && players.has(m.id))) break; // อยู่ในบ้าน: ไม่ได้ยินเสียงข้างนอก (ได้ยินเฉพาะเสียงของตัวเองและคนในบ้านเดียวกัน • โทรคุยส่วนตัวไม่ผ่านทางนี้)
      if (!m.self && m.id !== myId && me) k = Math.max(0, 1 - Math.hypot(m.x - me.x, m.y - me.y) / TS / 14); // คนอื่นทำเสียงไกลๆ จะเบาลงตามระยะ
      if (k > 0.05) playSfx(m.k, k * (m.id === myId || m.self ? 1 : 0.7));
      break;
    }
    case 'tp': me.x = m.x; me.y = m.y; walk = null; break;
    case 'chat': { if (!m.npc && isBlockedName(m.name)) break; const p = players.get(m.id) || npcs.get(m.id); if (p) { p.chat = m.text; p.chatAt = performance.now() + (m.npc ? 3000 : 0); } if (!m.npc) addChat(m.name, m.text); break; } // NPC พูดเป็นฟองเหนือหัวอย่างเดียว (อยู่ 8 วินาที) ไม่เข้าแชท
    case 'shop': openShop(m.kind); break;
    case 'arcs': arcStatus = {}; for (const a of m.a) arcStatus[a[1]] = a; break;
    case 'arc': onArc(m); break;
    case 'dur': dur = m.d; refreshOpen(); break;
    case 'wtr': wtr = m.n; renderHud(); break;
    case 'fight': { ft = { cls: m.cls, sched: m.sched, dist: m.dist, ten: m.ten, peak: m.ten, t: 0, snapT: 0, str: m.str, run: m.run, spd: m.spd, rise: m.rise, end: '', last: performance.now(), perfect: !!m.perfect }; ftHold = false; $('ffight').classList.remove('hidden'); fightUI(); if (abHeld || spHeld) setReel(true); break; } // ชักเย่อเริ่ม: เว็บทำนายด้วยสูตรเดียวกับเซิร์ฟเวอร์ ตามค่าที่ได้รับ
    case 'fs': if (ft && !ft.end) { ft.ten = m.ten; ft.dist = m.dist; ft.t = m.el; ft.last = performance.now(); } break; // เซิร์ฟเวอร์ส่งสถานะจริงทุก 150 ms ปรับตามทันที
    case 'fe': { const r = m.r; if (ft) { ft.end = r; ft.shown = performance.now(); $('ftxt').textContent = r === 'win' ? '🎉 ดึงขึ้นมาได้แล้ว!' : r === 'snap' ? '💥 สายเอ็นขาด!' : '🐟 ปลาหนีไปแล้ว...'; } ftHold = false; setTimeout(() => { if (ft && ft.end) { ft = null; $('ffight').classList.add('hidden'); } }, 900); break; }
    case 'fg': { // เกจตกปลา: เริ่ม/ปิด (ตัวชี้คำนวณจากเวลาที่ได้รับ ชดเชยหน่วงเล็กน้อย)
      if (m.off) { fg = null; if (ft && !ft.end) { ft = null; ftHold = false; $('ffight').classList.add('hidden'); } } else { const c = m.c === undefined ? 0.5 : m.c; fg = { per: m.per, half: m.half, c, t0: performance.now() - 40 - (m.ph || 0), win: m.win }; $('fgzone').style.cssText = `left:${(c - m.half) * 100}%;width:${m.half * 200}%`; /* กันหน้าเว็บเก่าค้างแคช: ไม่มีแกนกลางก็สร้างให้ */ let core = $('fgcore'); if (!core) { core = document.createElement('div'); core.id = 'fgcore'; core.className = 'core'; core.style.cssText = 'position:absolute;top:0;bottom:0;background:#2fb64a'; $('fgzone').after(core); } core.style.left = (c - m.half * FISH_GAUGE.perfect) * 100 + '%'; core.style.width = m.half * FISH_GAUGE.perfect * 200 + '%'; }
      $('fgauge').classList.toggle('hidden', !fg); break;
    }
    case 'trade': onTrade(m); break;
    case 'cin': onCin(m); break;
    case 'furn': applyFurnOp(m); break;
    case 'hstyle': houseSt = { fl: m.fl, wp: m.wp }; if (scene) syncHouseBg(); if (build.on) renderBuild(); break;
    case 'admin': onAdmin(m); break;
    case 'dev': if (isAdmin) setDev(m); break;
    case 'theme': setSnowMode(m.snow); if (m.rain !== undefined) setRainMode(m.rain); break;
    case 'kicked': noRetry = true; rcStop(false); { const d = $('dc').firstElementChild; if (d) d.textContent = m.text ? '🔁 ' + m.text : 'คุณถูกผู้ดูแลเตะออกจากห้อง 🦶 กดเชื่อมต่อใหม่เพื่อเข้ามาอีกครั้ง'; } break; // m.text = ล็อกอินซ้ำจากที่อื่น (เซิร์ฟเวอร์ส่งข้อความมา) • ไม่มี text = ผู้ดูแลเตะ
    case 'log': if (m.list) townLog = m.list.slice(); else if (m.e) { townLog.push(m.e); if (townLog.length > TOWN.logMax) townLog.shift(); } if (townShown()) renderTown(); break;
    case 'en': enSt = Object.assign(m, { at: Date.now(), spentAt: m.spent ? Date.now() : (enSt.spentAt || 0), lastSpent: m.spent || enSt.lastSpent || 0 }); renderEnergy(); break;
    case 'cat': catSt = Object.assign(m, { at: Date.now() }); renderSat(); break;
    case 'quests': {
      questSt = { list: m.list, total: m.total, title: m.title, pts: m.pts, starter: m.starter, streak: m.streak, book: m.book, wk: m.wk, wk1: m.wk1 };
      updateGuide(); updateQuestBadge(); if (questShown()) renderQuestPanel(); if (bagShown() && bagTab === 'book') renderBag();
      for (const id of Object.keys(BUFFS)) buffExp[id] = m.buffs[id] ? Date.now() + m.buffs[id] : 0;
      if (me) me.title = m.title;
      if (townShown()) renderTown(); break;
    }
    case 'bank': bankSt = m; if (townShown()) renderTown(); break;
    case 'village': villageSt = m; villageEnd = m.left ? Date.now() + m.left : 0; updateHappyChip(); if (townShown()) renderTown(); break;
    case 'fame': fameSt = m.f; if (townShown()) renderTown(); break;
    case 'title': { const p = players.get(m.id); if (p) p.title = m.title; if (achShown()) renderAch(); break; }
    case 'horn': { if (m.id === myId) break; if (m.on === false) hornOtherStop(m.id); else if (m.on === true) hornOtherStart(m.id, m.v || 'bike'); break; } // แตรกดค้างของคนอื่น: on:true เริ่มเสียงต่อเนื่อง ดังตามระยะ • on:false หยุด • หยุดเองใน 6.5 วิ
    case 'veh': { const p = players.get(m.id); if (p) p.veh = m.v || ''; if (m.id === myId && !$('shop').classList.contains('hidden')) renderShop(); break; }
    case 'ch': chSt = { ch: m.ch, wet: m.wet, chain: m.chain }; if (questShown()) renderQuestPanel(); break;
    case 'chain': chSt.chain = m.n; break;
    case 'stars': starsSt = m.s || {}; if (bagShown()) renderBag(); break;
    case 'evt': evtSt = m.e; renderEvChip(); if (townShown() && townTab === 'log') renderTown(); break;
    case 'wet': { const p = players.get(m.id); if (p) p.wet = !!m.on; break; }
    case 'stall': { const okIt = x => { try { return !!(x && typeof x.item === 'string' && itemInfo(x.item)); } catch (e) { return false; } }; stallSt = (Array.isArray(m.l) ? m.l : []).filter(okIt); bidSt = (Array.isArray(m.b) ? m.b : []).filter(okIt); }  if (townShown() && townTab === 'stall' && !(document.activeElement && $('townBody').contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName))) renderTown(); break; // กำลังพิมพ์ช่องกรอกอยู่ ไม่วาดทับให้หลุดโฟกัส
    case 'orders': ordersSt = m.o; if (townShown() && townTab === 'orders') renderTown(); break;
    case 'orders_upd': if (townShown() && townTab === 'orders') send({ t: 'orders', a: 'list' }); break;
    case 'rents': rentsSt = m.r || {}; if (!$('shop').classList.contains('hidden')) renderShop(); break;
    case 'arcpts': arcSt = m.arc; if (hubShown()) renderHub(); break;
    case 'lb': lbSt = m; if (hubShown()) renderHub(); break;
    case 'rank': rankSt = m; if (townShown() && townTab === 'rank') renderTown(); break;
    case 'town': if (m.w === 'sea') {
      if (m.boat) { // มีเรือเอง: ออกได้ทุกเวลา ไม่จำกัดเวลา ขับเรือเองในทะเลใหญ่
        ask(`⛵ ออกเรือของคุณ ล่องทะเลใหญ่ ฟรี? ออกได้ทุกเวลา ไม่จำกัดเวลา กลับเมื่อไหร่ก็ได้โดยแล่นไปท่าซ้ายสุด • ต้องเป็นชาวประมงเลเวล ${m.min} ขึ้นไป • โยนเบ็ดได้ไกล ${Shared.OCEAN.castRange} ช่อง ปลาแพงอยู่ทะเลลึกทางขวา`, () => send({ t: 'sea' })); break;
      }
      if (m.win && !m.win.ok) { toast(m.win.why); break; }
      ask(`⛵ เช่าเรือออกทะเลใหญ่? ค่าเช่า 🪙${m.fee} • ขับเรือเองได้ราว ${Math.max(1, Math.round(m.win.ms / 60000))} นาทีจนร้านเช่าปิด 19:00 (เปิด 06:00–19:00 เวลาเกม) • ต้องเป็นชาวประมงเลเวล ${m.min} ขึ้นไป • (ซื้อเรือของตัวเองที่ร้านยานพาหนะ ออกได้ทุกเวลาไม่จำกัดเวลา)`, () => send({ t: 'sea' })); break;
    } openTown(m.w === 'atm' ? 'bank' : m.w === 'lotto' ? 'lotto' : m.w === 'rank' ? 'rank' : m.w === 'flea' ? 'stall' : 'log'); break;
    case 'scene': applyScene(m); break;
    case 'hboard': hboard = m; if (plotsShown()) renderPlots(); break;
    case 'blocks': onBlocks(m); break;
    case 'muted': myMuteUntil = +m.until || 0; if (myMuteUntil > Date.now() && micOn) $('micBtn').click(); setMuteNote(); if (peopleShown()) renderPeople(true); break;
    case 'reportres': if (m.ok) { closeReport(); } break;
  }
}

// ---------- บล็อก/รายงานผู้เล่น + สถานะถูกปิดเสียง (เซิร์ฟเวอร์ตัดสิน ฝั่งเว็บแค่แสดงและซ่อน) ----------
let blockList = [], blockKeys = new Set(), myMuteUntil = 0;
const MOD = Shared.MODERATION;
{ const n = $('chatNote'); if (n && MOD) n.textContent = '💬 แชตถูกบันทึกไว้ ' + MOD.chatlogDays + ' วัน ผู้ดูแลเท่านั้นที่เปิดดูได้'; }
const isBlockedName = n => !!n && blockKeys.has(String(n).toLowerCase());
function onBlocks(m) {
  blockList = Array.isArray(m.list) ? m.list : []; blockKeys = new Set(blockList.map(x => x.key));
  for (const id of m.ids || []) { closePeer(id); if (callWith === id || callPend === id || callIn === id) leaveCall(); }
  for (const [id, p] of players) if (isBlockedName(p.name)) p.chat = '';
  if (peopleShown()) renderPeople(true);
}
function setMuteNote() {
  const on = myMuteUntil > Date.now(), c = $('chatIn');
  if (!c.dataset.ph) c.dataset.ph = c.placeholder;
  c.placeholder = on ? '🤐 ปิดเสียง ~' + Math.max(1, Math.ceil((myMuteUntil - Date.now()) / 60000)) + ' น.' : c.dataset.ph;
}
setInterval(() => { if (myMuteUntil) setMuteNote(); }, 30000); // นับถอยหลัง/ล้างข้อความเองเมื่อหมดเวลา
let reportTo = null, reportWhy = '';
const reportShown = () => !$('report').classList.contains('hidden');
function openReport(id) {
  const p = roster.get(id); if (!p) return;
  reportTo = { id: p.id, name: p.name }; reportWhy = '';
  $('reportWho').textContent = p.name; $('reportText').value = ''; $('reportText').maxLength = MOD.reportTextMax;
  $('reportWhy').innerHTML = MOD.reportWhy.map(w => `<button class="chip" data-why="${esc(w.id)}">${esc(w.name)}</button>`).join('');
  $('reportSend').disabled = true; $('report').classList.remove('hidden');
}
function closeReport() { $('report').classList.add('hidden'); $('reportText').blur(); reportTo = null; }
$('reportWhy').addEventListener('click', e => { const b = e.target.closest('[data-why]'); if (!b) return; reportWhy = b.dataset.why; $('reportWhy').querySelectorAll('.chip').forEach(c => c.classList.toggle('sel', c === b)); $('reportSend').disabled = false; });
$('reportSend').onclick = () => { if (!reportTo || !reportWhy) return; send({ t: 'report', id: reportTo.id, why: reportWhy, text: $('reportText').value.trim().slice(0, MOD.reportTextMax) }); $('reportSend').disabled = true; };
$('reportClose').onclick = closeReport;
$('report').addEventListener('pointerdown', e => { if (e.target === $('report')) closeReport(); });
$('reportText').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') closeReport(); });

// ---------- ผู้ดูแล: สร้าง/ลบห้อง (โลกแยกกัน) + ลิงก์ ----------
let adminSt = { rooms: [], current: '', err: '' }, adminTab = 'manage';
const bugImgs = {}; // ภาพรายงานบั๊กที่โหลดแล้ว (id → data URL)
let rView = 'open', clName = '', clDay = '', tgNameVal = '', tgRoomVal = ''; // รายงานผู้เล่น: open/closed • ค้นแชตย้อนหลัง
let bugView = 'open'; // หน้ารายงานบั๊ก: open = ยังไม่แก้ • fixed = แก้แล้ว
const adminShown = () => !$('admin').classList.contains('hidden');
let adminHungerOn = true, devOn = false, devBase = 0, devAt = 0, devAsk = 0; // On Develop: แอดมินออนเกมมานานเท่าไร (เซิร์ฟเวอร์ส่ง sec มา เว็บนับต่อเอง)
function setDev(d) { if (!d) return; devOn = !!d.on; devBase = +d.sec || 0; devAt = Date.now(); devAsk = devAt; tickDev(); }
function devText() { // ข้อความ On Develop ในแท็บสถานะ (เฉพาะแอดมิน)
  if (!isAdmin || !devOn) return '';
  const s = devBase + Math.floor((Date.now() - devAt) / 1000), h = Math.floor(s / 3600), mi = Math.floor(s % 3600 / 60);
  return '🛠️ On Develop (เวลาออนเกมของแอดมิน) ' + (h ? h + ' ชม. ' : '') + mi + ' นาที';
}
function tickDev() { const el = document.getElementById('devRow'); if (el) el.textContent = devText(); }
setInterval(() => { if (!joined || !isAdmin) return; tickDev(); if (Date.now() - devAsk > 120000) { devAsk = Date.now(); send({ t: 'dev' }); } }, 1000);
function openAdmin() { $('admin').classList.remove('hidden'); send({ t: 'admin', a: 'rooms' }); send({ t: 'admin', a: 'users' }); send({ t: 'admin', a: 'bugs' }); send({ t: 'admin', a: 'reports' }); renderAdmin(); }
function setSnowMode(v) { snowMode = v === 'on' || v === 'off' ? v : 'auto'; if (typeof adminShown === 'function' && adminShown()) renderAdmin(); }
function setRainMode(v) { rainMode = v === 'on' || v === 'off' ? v : 'auto'; if (typeof adminShown === 'function' && adminShown()) renderAdmin(); }
function closeAdmin() { $('admin').classList.add('hidden'); }
function onAdmin(m) {
  adminSt = { rooms: m.rooms || [], current: m.current || '', err: m.err || '', users: m.users || (adminSt && adminSt.users) || [], bans: m.bans || (adminSt && adminSt.bans) || [], bugs: m.bugs || (adminSt && adminSt.bugs) || [], warp: m.warp || (adminSt && adminSt.warp) || null, reports: m.reports || (adminSt && adminSt.reports) || [], rview: m.report || (adminSt && adminSt.rview) || null, chatlog: m.chatlog || (adminSt && adminSt.chatlog) || null };
  if (m.bugimg) bugImgs[m.bugimg.id] = m.bugimg.uri;
  if (m.bugmark) toast(m.bugmark === 'fixed' ? '✅ ย้ายไปส่วน「แก้แล้ว」' : '↩️ เปิดรายงานใหม่ (กลับไป「ยังไม่แก้」)');
  if (m.created) { const url = roomLink(m.created); try { navigator.clipboard.writeText(url).catch(() => {}); } catch (e) { /* ไม่ได้ก็ไม่เป็นไร */ } toast('สร้างห้อง ' + m.created + ' แล้ว คัดลอกลิงก์ให้แล้ว 🔗'); }
  if (m.err && m.mapedit) toast('⚠️ ' + m.err);
  if (m.coinmsg) toast(m.coinmsg);
  if (typeof m.hungerOn === 'boolean') { adminHungerOn = m.hungerOn; if (m.ok) toast(m.ok); }
  if (m.warpmsg) toast(m.warpmsg);
  if (m.lvmsg) toast(m.lvmsg);
  if (m.kicked) { toast('เตะ ' + m.kicked + ' ออกแล้ว'); setTimeout(() => send({ t: 'admin', a: 'users' }), 700); }
  if (m.banned) toast(m.until ? '⏳ แบน ' + m.banned + ' ถึง ' + new Date(m.until).toLocaleString('th-TH') : '🚫 แบน ' + m.banned + ' ถาวรแล้ว (เข้าเกมไม่ได้จนกว่าจะใช้ชื่ออื่น)');
  if (m.muted) toast(m.until ? '🤐 ปิดเสียง ' + m.muted + ' ถึง ' + new Date(m.until).toLocaleTimeString('th-TH') : '🔊 เปิดเสียง ' + m.muted + ' แล้ว');
  if (m.unbanned) toast('✅ ปลดแบน ' + m.unbanned + ' แล้ว');
  if (m.removed) toast('เลิกใช้ห้อง ' + m.removed + ' แล้ว');
  if (m.mapedit && typeof MapEdit !== 'undefined') {
    // อัปเดต Mock จากเซิร์ฟเวอร์เฉพาะตอน mapget / บันทึก mocks — ไม่ทับตอนวาดพื้น
    if (m.mocks && !m.painted) MapEdit.setMocks(m.mocks, { fromServer: true });
    if (m.ok && !m.painted) toast(m.ok);
    if (MapEdit.shown()) MapEdit.draw();
  }
  if (adminShown()) renderAdmin();
}
function openMapEdit() {
  if (!isAdmin) return;
  closeAdmin();
  MapEdit.open({ send, toast, getMap: () => MAP, mocks: MapEdit.getMocks() });
  send({ t: 'admin', a: 'mapget' });
}
function renderAdmin() {
  const el = $('adminBody'), esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const ago = t => { if (!t) return '-'; const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 90 ? 'เมื่อสักครู่' : s < 5400 ? Math.round(s / 60) + ' นาทีก่อน' : s < 129600 ? Math.round(s / 3600) + ' ชม.ก่อน' : Math.round(s / 86400) + ' วันก่อน'; };
  const banN = (adminSt.bans || []).length;
  const bugAll = adminSt.bugs || [], bugOpen = bugAll.filter(b => !b.fixed), bugFixed = bugAll.filter(b => b.fixed), bugN = bugOpen.length;
  const repAll = adminSt.reports || [], repN = repAll.filter(r => !r.closed).length, hm = t => new Date(t).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  const whyName = id => { const w = MOD.reportWhy.find(x => x.id === id); return w ? w.name : id; };
  let h = adminSt.err ? `<div class="banner" style="background:#fde0dc">${esc(adminSt.err)}</div>` : '';
  h += `<div class="chips atabs" style="margin-bottom:10px"><button class="chip${adminTab === 'manage' ? ' sel' : ''}" data-atab="manage">🏠 ห้อง & ผู้เล่น</button><button class="chip${adminTab === 'map' ? ' sel' : ''}" data-atab="map">🗺️ แมพ</button><button class="chip${adminTab === 'warp' ? ' sel' : ''}" data-atab="warp">🧭 วาป</button><button class="chip${adminTab === 'blacklist' ? ' sel' : ''}" data-atab="blacklist">🚫 Blacklist${banN ? ' (' + banN + ')' : ''}</button><button class="chip${adminTab === 'bugs' ? ' sel' : ''}" data-atab="bugs">🐞 บั๊ก${bugN ? ' (' + bugN + ')' : ''}</button><button class="chip${adminTab === 'reports' ? ' sel' : ''}" data-atab="reports">🚩 รายงาน${repN ? ' (' + repN + ')' : ''}</button><button class="chip${adminTab === 'chatlog' ? ' sel' : ''}" data-atab="chatlog">💬 แชตย้อนหลัง</button><button class="chip${adminTab === 'mute' ? ' sel' : ''}" data-atab="mute">🤐 ปิดเสียง</button><button class="chip${adminTab === 'tban' ? ' sel' : ''}" data-atab="tban">⏳ แบนตามเวลา</button></div>`;
  if (adminTab === 'map') {
    h += `<p style="font-size:13px;line-height:1.45;margin:0 0 10px">แก้แมพห้องนี้แบบอิสระ: <b>Mock</b> (กล่องวางแผน ขยับ/เพิ่ม/ลบ ได้ — เห็นเฉพาะผู้ดูแล) และ <b>วาดพื้น</b> (เปลี่ยนหญ้า/ทาง/น้ำ/ต้นไม้ ฯลฯ ให้ทุกคนในห้องทันที)</p>`;
    h += `<button class="btn" id="openMapEdit">🗺️ เปิดตัวแก้แมพ</button>`;
  } else if (adminTab === 'bugs') {
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
  } else if (adminTab === 'reports') { // รายงานผู้เล่น (ดู / ปิด / เปิดใหม่)
    const list = repAll.filter(r => rView === 'closed' ? r.closed : !r.closed), rv = adminSt.rview;
    h += `<div class="chips" style="margin-bottom:8px"><button class="chip${rView === 'open' ? ' sel' : ''}" data-rview="open">🔴 ค้างอยู่ (${repN})</button><button class="chip${rView === 'closed' ? ' sel' : ''}" data-rview="closed">✅ ปิดแล้ว (${repAll.length - repN})</button> <button class="btn small" id="repRefresh">🔄 รีเฟรช</button></div>`;
    h += list.length ? list.map(r => `<div class="arow bugrow"><div style="width:100%"><b>${esc(r.by || '?')}</b> รายงาน <b>${esc(r.target || '?')}</b> <small>ห้อง ${esc(r.room || '?')} • ${ago(r.time)}</small><br><small>เหตุผล: ${esc(whyName(r.why))}</small>`
      + (r.text ? `<div style="white-space:pre-wrap;word-break:break-word;margin:4px 0">${esc(r.text)}</div>` : '')
      + (r.closed ? `<br><small style="color:#1b7a2e">✅ ปิดแล้ว ${ago(r.closedAt)}${r.closedBy ? ' โดย ' + esc(r.closedBy) : ''}</small>` : '')
      + (rv && rv.id === r.id ? `<div style="background:rgba(0,0,0,.06);border-radius:8px;padding:6px;margin:6px 0;font-size:13px">${(rv.chat || []).map(c => `<div><small>${hm(c.t)}</small> <b>${esc(c.name)}</b>: ${esc(c.text)}</div>`).join('') || 'ไม่มีแชตแนบ'}</div>` : '')
      + `<div style="margin-top:6px"><button class="btn small" data-rget="${esc(r.id)}">💬 ดูแชตแนบ</button> <button class="btn small muted" data-rmute="${esc(r.target)}" data-rroom="${esc(r.room)}">🤐 ปิดเสียง 1 ชม.</button> `
      + (r.closed ? `<button class="btn small muted" data-ropen="${esc(r.id)}">↩️ เปิดใหม่</button>` : `<button class="btn small" data-rclose="${esc(r.id)}">✅ ปิดรายงาน</button>`) + '</div></div></div>').join('') : `<p style="opacity:.7">${rView === 'closed' ? 'ยังไม่มีรายงานที่ปิดแล้ว' : 'ไม่มีรายงานค้าง 🎉'}</p>`;
  } else if (adminTab === 'chatlog') { // แชตย้อนหลัง (เก็บ MOD.chatlogDays วัน)
    const cl = adminSt.chatlog, days = (cl && cl.days) || [], day = clDay || (cl && cl.day) || '';
    h += `<div class="arow"><input type="text" id="clName" maxlength="12" placeholder="ค้นตามชื่อ (เว้นว่าง = ทุกคน)" value="${esc(clName)}"></div>`;
    h += `<div class="arow"><select id="clDay" style="flex:1;padding:8px;font:inherit;border:2px solid var(--edge);border-radius:8px">${(days.length ? days : [day]).map(d => `<option value="${esc(d)}"${d === day ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select><button class="btn small" id="clGo">🔍 ค้นหา</button></div>`;
    h += cl ? `<div class="sec">วันที่ ${esc(cl.day)} • เจอ ${cl.total} ข้อความ${cl.total > cl.rows.length ? ' (แสดงท้ายสุด ' + cl.rows.length + ')' : ''}</div>`
      + (cl.rows.length ? cl.rows.map(r => `<div style="font-size:13px;padding:2px 0;border-bottom:1px dashed rgba(0,0,0,.12);word-break:break-word"><small>${new Date(r.t).toLocaleTimeString('th-TH')} • ${esc(r.room)}</small> <b>${esc(r.name)}</b>: ${esc(r.text)}</div>`).join('') : '<p style="opacity:.7">ไม่มีข้อความ</p>') : '<p style="opacity:.7">กด 🔍 ค้นหาเพื่อดูแชตของวันนี้</p>';
    h += `<p style="font-size:12px;opacity:.7;margin:8px 0 0">เก็บแชตไว้ ${MOD.chatlogDays} วัน เฉพาะผู้ดูแลเท่านั้นที่เปิดดูได้</p>`;
  } else if (adminTab === 'mute' || adminTab === 'tban') { // ปิดเสียง / แบนตามเวลา เลือกจากรายชื่อผู้เล่น
    const isM = adminTab === 'mute', now = Date.now();
    h += `<p style="font-size:12px;opacity:.7;margin:0 0 6px">${isM ? 'ปิดเสียง = ผู้เล่นพิมพ์แชต/พูดไม่ได้ตามเวลาที่เลือก (เห็นข้อความแจ้ง)' : 'แบนตามเวลา = เข้าเกมไม่ได้จนหมดเวลา (เตะออกทันทีถ้าออนไลน์) ผู้ดูแลเลือกเองทุกครั้ง ไม่มีแบนอัตโนมัติ'}</p>`;
    h += '<div class="arow"><input type="text" id="tgName" maxlength="12" value="' + esc(tgNameVal).replace(/"/g, '&quot;') + '" placeholder="พิมพ์ชื่อ หรือกดชื่อจากรายการด้านล่าง"></div>';
    const durs = isM ? [['10m', '10 นาที'], ['1h', '1 ชม.'], ['1d', '1 วัน'], ['off', 'เปิดเสียง']] : [['1d', '1 วัน'], ['7d', '7 วัน'], ['', 'ถาวร']];
    h += '<div class="chips" style="margin:4px 0 8px">' + durs.map(([k, n], i) => `<button class="chip${i === 0 ? ' sel' : ''}" data-tgdur="${k}" style="min-height:40px">${n}</button>`).join('') + '</div>';
    h += '<button class="btn small" id="tgGo">' + (isM ? '🤐 ปิดเสียง' : '⏳ แบน') + '</button>';
    h += '<div class="sec">👥 ผู้เล่น</div>' + ((adminSt.users || []).filter(u => !u.admin).map(u => `<div class="arow"><span><button class="chip" data-tgname="${esc(u.name)}" data-tgroom="${esc(u.room)}">${u.online ? '🟢' : '⚪'} ${esc(u.name)}</button> <small>ห้อง ${esc(u.room)}</small>${isM && u.mute > now ? ' <small style="color:#c0392b">🤐 ถึง ' + new Date(u.mute).toLocaleTimeString('th-TH') + '</small>' : ''}</span></div>`).join('') || '<p style="opacity:.7">ยังไม่มีข้อมูล</p>');
    if (!isM) h += '<div class="sec">⏳ ที่ถูกแบนตามเวลา</div>' + ((adminSt.bans || []).filter(b => b.until).map(b => `<div class="arow"><span>⏳ <b>${esc(b.name)}</b> <small>ถึง ${hm(b.until)} • ห้อง ${esc(b.room)}</small></span><button class="btn small" data-unban="${esc(b.name)}" data-uroom="${esc(b.room)}">✅ ปลดแบน</button></div>`).join('') || '<p style="opacity:.7">ยังไม่มี</p>');
  } else if (adminTab === 'warp') { // วาปไปฉากต่างๆ ของห้องนี้ (ผู้ดูแลเท่านั้น ข้ามเงื่อนไขเดินและค่าเรือ)
    const W = adminSt.warp || { houses: [], floors: 0 }, btn = to => `<button class="btn small" data-warp="${esc(to)}">🧭 วาป</button>`;
    h += '<div class="sec">🏘️ เมือง</div>' + `<div class="arow"><span>ลานกองไฟกลางเมือง</span>${btn('town')}</div>`;
    h += '<div class="sec">⛏️ ถ้ำเหมือง</div>' + Array.from({ length: W.floors }, (_, i) => `<div class="arow"><span>ชั้น ${i + 1}</span>${btn('cave:' + (i + 1))}</div>`).join('');
    h += '<div class="sec">🌊 ทะเลลึก</div>' + `<div class="arow"><span>เกาะลึกลับกลางสระ (เรือเช่า)</span>${btn('sea')}</div><div class="arow"><span>ทะเลใหญ่ (ขับเรือ)</span>${btn('ocean')}</div>`;
    h += `<div class="sec">🏠 บ้านของผู้เล่น (${W.houses.length})</div>` + W.houses.map(x => `<div class="arow"><span><b>${esc(x.name)}</b></span>${btn('house:' + x.key)}</div>`).join('');
  } else if (adminTab === 'blacklist') {
    h += `<div class="arow"><input type="text" id="banName" maxlength="12" placeholder="พิมพ์ชื่อที่จะแบน (ห้อง ${esc(adminSt.current)})"><button class="btn small" id="banAdd">🚫 แบน</button></div>`;
    h += `<p style="font-size:12px;opacity:.7;margin:4px 0 8px">ชื่อที่ถูกแบนจะเข้าเกมไม่ได้จนกว่าจะใช้ชื่ออื่น (เตะออกทันทีถ้ากำลังออนไลน์) • แบนแยกตามห้อง</p>`;
    h += `<div class="sec">🚫 รายชื่อที่ถูกแบน ทั้งหมด (${banN})</div>`;
    h += banN ? (adminSt.bans || []).map(b => `<div class="arow"><span>${b.until ? '⏳' : '🚫'} <b>${esc(b.name)}</b> <small>ห้อง ${esc(b.room)}${b.until ? ' • ถึง ' + hm(b.until) : ' • ถาวร'}</small></span><span><button class="btn small" data-unban="${esc(b.name)}" data-uroom="${esc(b.room)}">✅ ปลดแบน</button></span></div>`).join('') : '<p style="opacity:.7">ยังไม่มีใครถูกแบน 🎉</p>';
  } else {
    h += '<div class="arow"><input type="text" id="newRoom" maxlength="20" placeholder="ชื่อห้อง (a-z 0-9 _ -) เว้นว่าง = สุ่มให้"><button class="btn small" id="mkRoom">➕ สร้างห้อง</button></div><div class="sec">ห้องทั้งหมด</div>';
    h += adminSt.rooms.map(r => `<div class="arow${r.name === adminSt.current ? ' cur' : ''}"><span><b>${esc(r.name)}</b>${r.main ? ' (ห้องหลัก)' : ''}${r.name === adminSt.current ? ' • คุณอยู่ที่นี่' : ''}<br><small>👥 ${r.online} คน</small></span><span>`
      + `<button class="btn small" data-copy="${esc(r.name)}">🔗 คัดลอกลิงก์</button> `
      + (r.name !== adminSt.current ? `<button class="btn small" data-go="${esc(r.name)}">↪️ ไปห้องนี้</button> ` : '')
      + (!r.main ? `<button class="btn small muted" data-rm="${esc(r.name)}">🗑️ เลิกใช้</button>` : '') + '</span></div>').join('');
    h += `<div class="sec">🔧 ทดสอบ</div><div class="row"><span>🍗 ความหิวของตัวเอง</span><span><button class="btn small${adminHungerOn ? '' : ' muted'}" id="admHunger">${adminHungerOn ? '🍗 เปิดอยู่' : '🍗 ปิดอยู่'}</button> <button class="btn small" id="admCoin1k">🪙 +1,000 เหรียญ</button></span></div>`;
    h += `<div class="sec">🪙 เหรียญของตัวเอง</div><div class="row"><span>${me ? esc(me.name) : ''}</span><span><button class="btn small" data-admcoin="100">➕ 100</button> <button class="btn small muted" data-admcoin="-100">➖ 100</button></span></div>`;
    h += '<div class="sec">❄️ ธีมหิมะตก (ทุกคนในเกม)</div><div class="chips" style="margin-bottom:6px">' + [['auto', 'อัตโนมัติ (ตามฤดูหนาว)'], ['on', 'เปิดตลอด'], ['off', 'ปิด']].map(([k, n]) => `<button class="chip${snowMode === k ? ' sel' : ''}" data-snowmode="${k}" style="min-height:40px">${n}</button>`).join('') + '</div>';
    h += '<div class="sec">🌧️ ฝนตก (ทุกคนในเกม)</div><div class="chips" style="margin-bottom:6px">' + [['auto', 'อัตโนมัติ (ตามฤดูฝน)'], ['on', 'ฝนตกตลอด'], ['off', 'ปิด']].map(([k, n]) => `<button class="chip${rainMode === k ? ' sel' : ''}" data-rainmode="${k}" style="min-height:40px">${n}</button>`).join('') + '</div>';
    h += '<div class="sec">🎚️ เลเวลของตัวเอง (ทดสอบ)</div>';
    h += Object.keys(Shared.SKILLS).map(k => `<div class="row"><span>${Shared.SKILLS[k].emoji} ${esc(Shared.SKILLS[k].name)} <b>Lv ${lvl(k)}</b></span><span><button class="btn small" data-lvskill="${k}" data-d="-1">➖</button> <button class="btn small" data-lvskill="${k}" data-d="1">➕</button> <button class="btn small" data-lvskill="${k}" data-to="${Shared.MAX_LV}">⏫ ${Shared.MAX_LV}</button> <button class="btn small muted" data-lvskill="${k}" data-to="1">⏬ 1</button></span></div>`).join('');
    h += '<div class="sec">👥 ผู้เล่นและ IP <button class="btn small" id="ipRefresh">🔄 รีเฟรช</button></div>';
    h += (adminSt.users || []).map(u => `<div class="arow"><span>${u.online ? '🟢' : '⚪'} <b>${esc(u.name)}</b> <small>ห้อง ${esc(u.room)}</small><br><small>${u.online ? 'IP ตอนนี้: <b>' + esc(u.ip) + '</b>' : 'เข้าล่าสุด ' + ago(u.last)}</small>`
      + `<br><small style="opacity:.7">${u.ips.map(x => esc(x.ip) + ' (' + ago(x.t) + ')').join(' • ') || 'ยังไม่มีประวัติ IP'}</small></span>${!u.admin ? `<span>${u.online ? `<button class="btn small muted" data-kick="${esc(u.name)}" data-kroom="${esc(u.room)}">🦶 เตะ</button> ` : ''}<button class="btn small muted" data-pinreset="${esc(u.name)}" data-proom="${esc(u.room)}">🔓 ล้าง PIN</button> <button class="btn small muted" data-ban="${esc(u.name)}" data-broom="${esc(u.room)}">🚫 แบน</button></span>` : ''}</div>`).join('') || '<p style="opacity:.7">ยังไม่มีข้อมูล</p>';
  }
  el.innerHTML = h;
  el.querySelectorAll('[data-atab]').forEach(b => b.onclick = () => { adminTab = b.dataset.atab; if (adminTab === 'warp') send({ t: 'admin', a: 'warplist' }); if (adminTab === 'reports') send({ t: 'admin', a: 'reports' }); if (adminTab === 'mute' || adminTab === 'tban') send({ t: 'admin', a: 'users' }); renderAdmin(); });
  el.querySelectorAll('[data-rainmode]').forEach(b => b.onclick = () => send({ t: 'admin', a: 'rain', mode: b.dataset.rainmode }));
  el.querySelectorAll('[data-snowmode]').forEach(b => b.onclick = () => send({ t: 'admin', a: 'snow', mode: b.dataset.snowmode }));
  el.querySelectorAll('[data-lvskill]').forEach(b => b.onclick = () => send({ t: 'admin', a: 'lvl', skill: b.dataset.lvskill, d: b.dataset.d ? +b.dataset.d : undefined, to: b.dataset.to ? +b.dataset.to : undefined }));
  el.querySelectorAll('[data-warp]').forEach(b => b.onclick = () => { send({ t: 'admin', a: 'warp', to: b.dataset.warp }); closeAdmin(); });
  const ome = $('openMapEdit'); if (ome) ome.onclick = openMapEdit;
  el.querySelectorAll('[data-bugimg]').forEach(b => b.onclick = () => { b.disabled = true; send({ t: 'admin', a: 'bugimg', id: b.dataset.bugimg }); });
  el.querySelectorAll('[data-bview]').forEach(b => b.onclick = () => { bugView = b.dataset.bview; renderAdmin(); });
  el.querySelectorAll('[data-bugfix]').forEach(b => b.onclick = () => send({ t: 'admin', a: 'bugfix', id: b.dataset.bugfix }));
  el.querySelectorAll('[data-bugreopen]').forEach(b => b.onclick = () => send({ t: 'admin', a: 'bugreopen', id: b.dataset.bugreopen }));
  el.querySelectorAll('[data-rview]').forEach(b => b.onclick = () => { rView = b.dataset.rview; renderAdmin(); });
  el.querySelectorAll('[data-rget]').forEach(b => b.onclick = () => send({ t: 'admin', a: 'reportget', id: b.dataset.rget }));
  el.querySelectorAll('[data-rclose]').forEach(b => b.onclick = () => send({ t: 'admin', a: 'reportclose', id: b.dataset.rclose }));
  el.querySelectorAll('[data-ropen]').forEach(b => b.onclick = () => send({ t: 'admin', a: 'reportopen', id: b.dataset.ropen }));
  el.querySelectorAll('[data-rmute]').forEach(b => b.onclick = () => ask('ปิดเสียง ' + b.dataset.rmute + ' 1 ชั่วโมง?', () => send({ t: 'admin', a: 'mute', room: b.dataset.rroom, name: b.dataset.rmute, dur: '1h' })));
  const rR = $('repRefresh'); if (rR) rR.onclick = () => send({ t: 'admin', a: 'reports' });
  const cn = $('clName'); if (cn) cn.oninput = () => { clName = cn.value; };
  const cd = $('clDay'); if (cd) cd.onchange = () => { clDay = cd.value; };
  const cg = $('clGo'); if (cg) { const go = () => { clName = $('clName').value.trim(); clDay = $('clDay').value; send({ t: 'admin', a: 'chatlog', name: clName, day: clDay || undefined }); }; cg.onclick = go; cn.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') go(); }; if (!adminSt.chatlog && !adminSt._cl) { adminSt._cl = 1; send({ t: 'admin', a: 'chatlog', name: '' }); } }
  { const tn = $('tgName'), room = { v: tgRoomVal || adminSt.current }; let dur = adminTab === 'mute' ? '10m' : '1d';
    if (tn) {
      tn.onkeydown = e => e.stopPropagation(); tn.oninput = () => { tgNameVal = tn.value; }; // เก็บไว้ข้ามการวาดแผงใหม่ (ข้อความ admin เข้ามาแล้วไม่หาย)
      el.querySelectorAll('[data-tgname]').forEach(b => b.onclick = () => { tn.value = tgNameVal = b.dataset.tgname; room.v = tgRoomVal = b.dataset.tgroom; });
      el.querySelectorAll('[data-tgdur]').forEach(b => b.onclick = () => { dur = b.dataset.tgdur; el.querySelectorAll('[data-tgdur]').forEach(c => c.classList.toggle('sel', c === b)); });
      $('tgGo').onclick = () => { const n = tn.value.trim(); if (!n) return toast('เลือกหรือพิมพ์ชื่อก่อนนะ'); tgNameVal = '';
        if (adminTab === 'mute') send({ t: 'admin', a: 'mute', room: room.v, name: n, dur });
        else ask('แบน ' + n + (dur ? ' ' + (dur === '1d' ? '1 วัน' : '7 วัน') : ' ถาวร') + '?', () => send(Object.assign({ t: 'admin', a: 'ban', room: room.v, name: n }, dur ? { dur } : {}))); };
    } }
  const bR = $('bugRefresh'); if (bR) bR.onclick = () => send({ t: 'admin', a: 'bugs' });
  el.querySelectorAll('[data-pinreset]').forEach(b => b.onclick = () => ask('ล้าง PIN ของ ' + b.dataset.pinreset + '? (ให้เขาตั้งใหม่ตอนเข้าเกม)', () => send({ t: 'admin', a: 'pinreset', name: b.dataset.pinreset, room: b.dataset.proom })));
  el.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => ask('เตะ ' + b.dataset.kick + ' ออกจากห้อง?\n(เขาเข้ามาใหม่ได้ทันที)', () => send({ t: 'admin', a: 'kick', room: b.dataset.kroom, name: b.dataset.kick })));
  if ($('admHunger')) $('admHunger').onclick = () => send({ t: 'admin', a: 'hunger', on: !adminHungerOn });
  if ($('admCoin1k')) $('admCoin1k').onclick = () => send({ t: 'admin', a: 'coin1k' });
  el.querySelectorAll('[data-admcoin]').forEach(b => b.onclick = () => send({ t: 'admin', a: 'coin', n: +b.dataset.admcoin }));
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
if (typeof MapEdit !== 'undefined') MapEdit.bind();

// ---------- เมือง: ข่าว + ตู้เซฟกองกลาง ----------
const townShown = () => !$('town').classList.contains('hidden');
function openTown(tab) { closeOthers('town'); townTab = tab || townTab; if (townTab === 'lotto') send({ t: 'lotto', a: 'get' }); if (townTab === 'log') send({ t: 'quest', a: 'fame' }); if (townTab === 'rank') send({ t: 'rank' }); if (townTab === 'stall') send({ t: 'stall', a: 'list' }); $('town').classList.remove('hidden'); renderTown(); }
const nearFlea = () => !!me && Math.hypot(me.x - (FLEA.x + 0.5) * TS, me.y - (FLEA.y + 0.5) * TS) < 4.5 * TS; // ตรงกับ nearFlea ฝั่งเซิร์ฟเวอร์ (ใช้แค่เตือน)
function closeTown() { $('town').classList.add('hidden'); townNoticeFreshId = ''; townNoticeOpen = ''; } // ปิดแล้วเปิดใหม่ = ประกาศเก่าพับกลับ ป้าย 'ใหม่' หาย
function updateHappyChip() {
  const el = $('happyChip'); if (!el) return;
  const on = happyOn(); el.classList.toggle('hidden', !on);
  if (on) el.textContent = '🎉 ' + Math.ceil((villageEnd - Date.now()) / 60000) + ' นาที';
}
setInterval(updateHappyChip, 5000);
function villageCard() {
  const v = villageSt, on = happyOn(), pct = v.goal ? Math.min(100, Math.round(v.n / v.goal * 100)) : 0, need = Math.max(0, (v.full || 0) - (v.mine || 0));
  const mine = need ? `<br><small>คุณช่วยวันนี้ ${v.mine || 0}/${v.full} ครั้ง • ช่วยอีก ${need} ครั้งเพื่อรับบัฟเต็มเวลา (ไม่ได้ช่วยได้แค่ 5 นาทีแรก)</small>` : v.full ? `<br><small>✅ คุณช่วยครบ ${v.full} ครั้งแล้ว ได้บัฟเต็มเวลา</small>` : '';
  return `<div class="vcard${on ? ' on' : ''}"><b>🎉 Happy Village</b> — ${on ? `ติดบัฟอยู่ เหลือ ${Math.ceil((villageEnd - Date.now()) / 60000)} นาที: ตกปลาไวขึ้น 25% และหาไม้เนื้อแข็งง่ายขึ้น` : v.done ? 'วันนี้ทำครบเป้าแล้ว 🎊 (พรุ่งนี้เริ่มใหม่)' : 'ช่วยกันทำงานให้ครบเป้าของวัน ทั้งเมืองจะได้บัฟร่วม'}<div class="bar"><i style="width:${v.done ? 100 : pct}%"></i></div><small>งานของทุกคนวันนี้ ${v.n}/${v.goal} (เก็บเกี่ยว รดน้ำ ให้อาหารสัตว์ ตกปลา โค่นไม้ เก็บผลผลิต รักษาสัตว์ ลงขัน) • เป้าเพิ่มตามจำนวนคนที่ออนไลน์</small>${mine}</div>`;
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
  const WKI = { farm: '🌾', fish: '🎣', wood: '🪓' }, hot = Object.keys(enSt.wk || {}).map(g => [g, Math.round(100 * Math.min(enSt.wkMax, enSt.wk[g] * Math.pow(0.5, (now - enSt.at) / enSt.wkHalf) / enSt.wkScale))]).filter(x => x[1] >= 10 && WKI[x[0]]); // งานกลุ่มที่เริ่มล้า (ทำซ้ำ) แสดง % ต้นทุนที่แพงขึ้น
  const wkTxt = hot.map(x => ` ${WKI[x[0]]}ล้า+${x[1]}%`).join('');
  el.textContent = enSt.ex ? `😮‍💨 เหนื่อย • พักอีก ${fmtLeft(sec * 1000)}${spent}` : `⚡ ${Math.max(0, Math.floor(v))}${spent}${wkTxt}`;
  el.title = enSt.ex ? 'เหนื่อยจนทำงานหนักไม่ได้ (ปลูก/รดน้ำ/ขุด/เก็บเกี่ยว/ตัดไม้/ตกปลา) ไปทำอย่างอื่นก่อน เช่น ทำอาหาร เควส ลงขันเมือง หรือนั่งที่ม้านั่งฟื้นไวขึ้น 3 เท่า' : `พลังงาน ${Math.max(0, Math.floor(v))}/${Shared.ENERGY.max} งานที่ได้เงินมากกินพลังงานมากตามมูลค่า ทำงานกลุ่มเดียวซ้ำๆ (ไร่/ตกปลา/ตัดไม้) จะล้าและแพงขึ้นสูงสุด 1.5 เท่า (🌾ล้า+% บนป้าย) สลับงานหรือนั่งพักที่ม้านั่งช่วยให้หายล้าเร็วขึ้น (ประมาณ ${Shared.ENERGY.coinsPerEnergy} เหรียญต่อ 1 พลังงาน) ฟื้นเองช้าๆ นั่งพักฟื้นไว กินอาหารฟื้นเพิ่มเล็กน้อย`;
  const left = (enSt.rareUntil || 0) - now; cd.classList.toggle('hidden', left <= 0);
  if (left > 0) { cd.classList.add('warn'); cd.textContent = `🐟 ปลาหายากพัก ${fmtLeft(left)}`; cd.title = 'ตกปลาหายากไปแล้ว ต้องรอก่อนถึงจะตกปลาหายากได้อีก (ปลาธรรมดาตกได้ปกติ)'; }
}
$('enChip').onclick = () => toast($('enChip').title); $('cdChip').onclick = () => toast($('cdChip').title);
// อีเวนต์ประจำสัปดาห์: ป้ายแถบบน (กำลังแข่ง = เวลาที่เหลือ • อีกไม่เกิน 24 ชม. = นับถอยหลัง) แตะเพื่อเปิดข่าวเมืองดูอันดับ
function renderEvChip() {
  const el = $('evChip'), e = evtSt, now = Date.now() + timeOffset, E = e && Shared.EVENTS.list.find(x => x.id === e.id);
  const show = !!(E && (now >= e.start ? now < e.end : e.start - now < 24 * 3600e3)); el.classList.toggle('hidden', !show); if (!show) return;
  const on = now >= e.start; el.classList.toggle('warn', on);
  el.textContent = on ? `${E.emoji} ${E.name} เหลือ ${fmtLeft(e.end - now)}` : `${E.emoji} ${E.name} เริ่มใน ${fmtLeft(e.start - now)}`;
  el.title = `${E.name}: แข่งกันที่${E.unit} ${E.mins} นาที • มือใหม่แยกอันดับ • ที่ 1 ได้ถ้วยรางวัล + แต้มตู้เกม`;
}
setInterval(renderEvChip, 1000);
setInterval(() => { const e = $('ckCd'); if (!e) return; const s = Math.ceil((cookReadyAt - Date.now()) / 1000); if (s > 0) e.textContent = `⏳ เตายังร้อน ทำจานต่อไปได้อีก ${s} วิ`; else if (!$('shop').classList.contains('hidden')) renderShop(); }, 1000); // นับถอยหลังเตา แตะแค่ข้อความ ปุ่มไม่หลุด จนครบเวลาค่อยวาดใหม่ครั้งเดียว
$('evChip').onclick = () => openTown('log');
function eventCard() { // การ์ดอีเวนต์ในข่าวเมือง: เวลา + อันดับ 3 คนแรกของแต่ละกลุ่ม
  const e = evtSt, E = e && Shared.EVENTS.list.find(x => x.id === e.id); if (!E) return '';
  const now = Date.now() + timeOffset, on = now >= e.start, rows = (arr, t) => arr.length ? `<div><small>${t}</small> ${arr.map((x, i) => `${['🥇', '🥈', '🥉'][i]} ${esc0(x[0])} (${x[1]})`).join(' ')}</div>` : '';
  return `<div class="vcard${on ? ' on' : ''}"><b>${E.emoji} ${E.name}</b> <small>${on ? `กำลังแข่ง เหลือ ${fmtLeft(e.end - now)}` : `เริ่ม ${new Date(e.start).toLocaleString('th-TH', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`}</small><br><small>แข่งกันที่${E.unit} ${E.mins} นาที • ที่ 1 ได้ 🏆 ถ้วยรางวัล + แต้มตู้เกม • มือใหม่แยกอันดับ</small>${rows(e.top, 'ทั่วไป')}${rows(e.topNb, '🌱 มือใหม่')}</div>`;
}
setInterval(renderEnergy, 1000);
// ความสดของสินค้า (Shared.FRESH): อายุของแต่ละกองในกระเป๋าจากเซิร์ฟเวอร์ คิดระดับสด/ค้าง/เก่าตามเวลาปัจจุบัน
let starsSt = {}, evtSt = null, freshSt = { l: {}, fz: false }, rentsSt = {}, pinSt = false, stallSt = [], ordersSt = null, chSt = { ch: null, wet: 0, chain: 0 }; // chSt = ชาเลนจ์ถังน้ำ // pinSt = บัญชีนี้ตั้ง PIN แล้ว // rentsSt = แปลงเช่า (Shared.FARM_RENT) id → { name, until, key }
const freshMulsOf = (k, q) => Shared.perishable(k) ? Shared.freshMuls(freshSt.l[k], q, Date.now() + timeOffset, freshSt.fz) : null;
function freshBadge(k) { // 🟢12 🟡3 🔴1 (แสดงเมื่อมีของค้าง/เก่า) • ก่อนวันเริ่มระบบไม่แสดง
  if (!Shared.perishable(k) || !freshSt.l[k] || Date.now() + timeOffset < Shared.FRESH.startAt) return '';
  const c = Shared.freshCount(freshSt.l[k], Date.now() + timeOffset, freshSt.fz); if (!c[1] && !c[2]) return '';
  return ' <small title="ความสด: สด 100% • ค้าง 70% • เก่า 40% (ขายของเก่าก่อน • ตู้เย็นในบ้านช่วยชะลอ)">' + c.map((n, i) => n ? Shared.FRESH.emoji[i] + n : '').join(' ') + '</small>';
}
function allTotal(i, m, n, k) { // ขายทั้งหมด: ยอดรวมทั้งชุด (ราคาต่อชิ้นลดลงเรื่อยๆ ถึงพื้น 20%) พร้อมเปอร์เซ็นต์เฉลี่ยเทียบราคาชิ้นแรก
  const t = sellQuote(i.sell, m, n, k ? freshMulsOf(k, n) : null).total, first = Math.max(1, Math.round(i.sell * Math.max(Shared.MARKET.min, m)));
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
function updateQuestBadge() { // เลขบนไอคอนเควส = เควสวันนี้ที่ยังไม่เสร็จ
  const left = questSt.list.filter(x => !x[2]).length, b = $('questBadge');
  b.textContent = left; b.classList.toggle('hidden', !left);
}
$('questBtn').onclick = () => (questShown() ? closeQuest() : openQuest());
// คู่มือ: บท 1 (STARTER 6 ข้อ) แล้วต่อบท 2 (STARTER2 ตัดไม้/ขุดแร่/สัตว์/ทำอาหาร) บท 2 ซ่อนป้ายได้ (จำใน localStorage)
const g2Hidden = () => ls.get('mw_g2hide') === '1';
function guideNext() { // { s: ข้อถัดไป, ch: 1|2, n: ทำแล้วกี่ข้อ, tot: ทั้งหมดกี่ข้อ } หรือ null
  const st = questSt.starter; if (!me || !st) return null;
  if (!st.final) { const s = STARTER.find(x => !st.done.includes(x.id)); return s ? { s, ch: 1, n: st.done.length, tot: STARTER.length } : null; }
  const c2 = st.c2; if (!c2 || c2.final || g2Hidden()) return null;
  const s = Shared.STARTER2.find(x => !c2.done.includes(x.id)); return s ? { s, ch: 2, n: c2.done.length, tot: Shared.STARTER2.length } : null;
}
function updateGuide() {
  const el = $('guide'); if (!el) return;
  const g = guideNext();
  if (!g) { el.classList.add('hidden'); layoutHud(); return; }
  el.classList.remove('hidden'); el.textContent = '👉 ' + (g.ch === 2 ? 'บท 2: ' : '') + g.s.hint + ' (' + g.n + '/' + g.tot + ')';
  layoutHud();
}
$('guide').onclick = () => openQuest('start');
function guideHTML() { // คู่มือเริ่มต้น + เข้าเกมติดต่อกัน (ส่วนบนสุดของแท็บเควส)
  let h = '';
  const st = questSt.starter, sk = questSt.streak;
  if (sk && sk.n) h += `<div class="vcard on"><b>🔥 เข้าเกมติดต่อกัน ${sk.n} วัน</b> <small>ได้เหรียญทุกวัน • ครบ 7 วันได้ของตกแต่งหายาก (ขาดวันแล้วเริ่มนับใหม่)</small></div>`;
  if (st && st.final && st.c2 && !st.c2.final) h += `<div class="vcard"><b>🧭 คู่มือบทที่ 2 ${st.c2.done.length}/${Shared.STARTER2.length}</b>` + Shared.STARTER2.map(s => { const d = st.c2.done.includes(s.id); return `<div style="font-size:13px;opacity:${d ? 0.55 : 1}">${d ? '✅' : '⬜'} ${s.text} <small>+🪙${s.coin}</small></div>`; }).join('') + '</div>';
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
    const got = b[cat] || [], full = got.length >= def.ids.length, r = def.rare && FURN[def.rare];
    h += `<div class="sec">${def.emoji} ${def.name} ${got.length}/${def.ids.length} ${full ? '✅ ครบแล้ว' : `<small>ครบหมวด: 🪙${def.coin}${r ? ` + ${r.emoji}${r.name}` : ''}</small>`}</div><div class="grid">` + def.ids.map(id => { const i = bookInfo(cat, id), has = got.includes(id); return `<div class="card" style="${has ? '' : 'opacity:.35;filter:grayscale(1)'}"><b>${has ? i.emoji : '❔'}</b>${has ? i.name : '???'}</div>`; }).join('') + '</div>';
  }
  el.innerHTML = h;
}
// ---------- 🏅 ฉายา & ความสำเร็จ (Achievement) ----------
let achSt = { cnt: {}, got: {}, sel: '' }, achTab = 'title';
const achShown = () => !$('ach').classList.contains('hidden');
function openAch(tab) { closeOthers('ach'); achTab = tab || achTab; $('ach').classList.remove('hidden'); send({ t: 'quest', a: 'ach' }); renderAch(); }
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
        + `${ok ? '' : `<div class="bar"><i style="width:${pct}%"></i></div><small>${val(a).toLocaleString()}/${a.goal.toLocaleString()}</small>`} <small>🎁 ${a.coin ? `+🪙${a.coin}` : `ฉายา "${a.title}"`}</small></div>`; }).join('');
  }
  el.innerHTML = h;
  el.querySelectorAll('[data-title]').forEach(b => b.onclick = () => send({ t: 'quest', a: 'title', id: b.dataset.title }));
}
// ---------- เมนูเควส (แยกจากกระเป๋า): เริ่มต้น / เควสวันนี้ / แต้มความดี ----------
let questTab = 'daily';
const questShown = () => !$('quest').classList.contains('hidden');
function openQuest(tab) {
  closeOthers('quest');
  const st = questSt.starter;
  questTab = tab || (st && (!st.final || (st.c2 && !st.c2.final)) ? 'start' : 'daily'); // มือใหม่ที่ยังทำคู่มือไม่ครบ เปิดมาเจอหน้าเริ่มต้นก่อน
  $('quest').classList.remove('hidden'); renderQuestPanel();
}
function closeQuest() { $('quest').classList.add('hidden'); }
$('questClose').onclick = closeQuest;
$('quest').addEventListener('pointerdown', e => { if (e.target === $('quest')) closeQuest(); });
function renderQuestPanel() {
  const st = questSt.starter, showStart = !!(st && (!st.final || (st.c2 && !st.c2.final)));
  const tabs = (showStart ? [['start', '🌱 เริ่มต้น']] : []).concat(questSt.wk1 ? [['wk1', '🗓️ สัปดาห์แรก']] : []).concat([['daily', '📋 เควสวันนี้'], ['ch', '🪣 ชาเลนจ์'], ['pts', '💛 แต้ม/บัฟ']]);
  if (!tabs.some(t => t[0] === questTab)) questTab = 'daily';
  $('questTabs').innerHTML = tabs.map(([c, n]) => `<button class="tab${questTab === c ? ' on' : ''}" data-qtab="${c}">${n}</button>`).join('');
  $('questTabs').querySelectorAll('[data-qtab]').forEach(b => b.onclick = () => { questTab = b.dataset.qtab; renderQuestPanel(); });
  const el = $('questBody');
  if (questTab === 'ch') { // ชาเลนจ์ถังน้ำ
    const C = Shared.CHALLENGE, c = chSt.ch, d = c && C.list.find(x => x.id === c.id), now = Date.now() + timeOffset;
    let h = `<div class="tabs-note">🪣 ทำภารกิจสั้นให้ทันใน ${Math.round(C.ms / 60000)} นาที แล้วท้าเพื่อนต่อ เพื่อนมีเวลา 48 ชม. ไม่ทันโดนราดน้ำ 💦 • ต้นไม้แห่งการส่งต่อกลางลานตอนนี้ <b>${chSt.chain}</b> ใบ</div>`;
    if (chSt.wet > now) h += `<div class="banner" style="background:#d9efff">💦 คุณตัวเปียกอยู่อีก ${fmtLeft(chSt.wet - now)} <button class="btn small" data-chredeem="1" ${(inv.coin || 0) < C.redeem ? 'disabled' : ''}>ไถ่โทษ ลงขัน 🪙${C.redeem}</button></div>`;
    if (!c) h += `<div class="center" style="margin:12px 0"><button class="btn" data-chstart="1">🪣 รับชาเลนจ์</button></div><p style="font-size:12px;opacity:.7">สุ่มได้ 1 ใน: ${C.list.map(x => x.emoji + ' ' + x.text).join(' • ')}</p>`;
    else if (c.st === 'pending') h += `<div class="vcard on"><b>🪣 ${esc0(c.by)} ท้าคุณ!</b><br>${d.emoji} ${d.text} ภายใน ${Math.round(C.ms / 60000)} นาที<br><small>กดเริ่มเมื่อพร้อม (เหลือเวลารับคำท้าอีกไม่ถึง 48 ชม.)</small><div class="center" style="margin-top:8px"><button class="btn" data-chstart="1">เริ่มจับเวลา!</button></div></div>`;
    else if (c.st === 'run') h += `<div class="vcard on"><b>${d.emoji} ${d.text}</b><div class="bar"><i style="width:${Math.round(c.n / d.goal * 100)}%"></i></div><small>${c.n}/${d.goal} • เหลือเวลา ${fmtLeft(Math.max(0, c.end - now))}</small></div>`;
    else if (c.st === 'won') h += `<div class="vcard on"><b>🎉 สำเร็จ! ${d.emoji} ${d.text}</b> ใน ${Math.ceil(c.ms / 60000)} นาที<br><small>แชร์การ์ดแล้วท้าเพื่อน 3 คน เพื่อนผ่านคู่มือเมื่อไรคุณได้ฉายา</small><canvas id="chCard" width="600" height="320" style="width:100%;margin:8px 0;border-radius:8px"></canvas><div class="center"><button class="btn small" data-chshare="1">📤 แชร์ท้าเพื่อน</button> <button class="btn small" data-chcopy="1">🔗 คัดลอกลิงก์</button> <button class="btn small muted" data-chsave="1">💾 บันทึกรูป</button></div><div class="center" style="margin-top:8px"><button class="btn small muted" data-chstart="1">รับชาเลนจ์ใหม่</button></div></div>`;
    el.innerHTML = h;
    if (c && c.st === 'won') drawChCard($('chCard'), d, c);
    const link = () => `${location.origin}/?room=${encodeURIComponent(roomName)}&ch=${c.code}`, text = () => `ฉันทำชาเลนจ์ถังน้ำ 🪣 "${d.text}" ใน My World สำเร็จใน ${Math.ceil(c.ms / 60000)} นาที! ท้าคุณทำภายใน 48 ชม. ไม่งั้นโดนราดน้ำ 💦`;
    el.querySelectorAll('[data-chstart]').forEach(b => b.onclick = () => send({ t: 'ch', a: 'start' }));
    el.querySelectorAll('[data-chredeem]').forEach(b => b.onclick = () => send({ t: 'ch', a: 'redeem' }));
    el.querySelectorAll('[data-chcopy]').forEach(b => b.onclick = () => { try { navigator.clipboard.writeText(text() + ' ' + link()); toast('คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย'); } catch (e) { prompt('คัดลอกลิงก์นี้', link()); } });
    el.querySelectorAll('[data-chsave]').forEach(b => b.onclick = () => { const a = document.createElement('a'); a.download = 'myworld-bucket.png'; a.href = $('chCard').toDataURL('image/png'); a.click(); });
    el.querySelectorAll('[data-chshare]').forEach(b => b.onclick = () => $('chCard').toBlob(async blob => {
      const file = new File([blob], 'myworld-bucket.png', { type: 'image/png' }), data = { title: 'ชาเลนจ์ถังน้ำ My World', text: text(), url: link() };
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share(Object.assign({ files: [file] }, data)); else if (navigator.share) await navigator.share(data); else { navigator.clipboard.writeText(text() + ' ' + link()); toast('คัดลอกลิงก์แล้ว (เบราว์เซอร์นี้แชร์ตรงไม่ได้)'); } } catch (e) { /* ผู้ใช้ยกเลิก */ }
    }, 'image/png'));
  } else if (questTab === 'wk1') { // ภารกิจสัปดาห์แรก: ข้อที่ d ปลดล็อกวันที่ d
    const w = questSt.wk1, W1 = Shared.WEEK1;
    el.innerHTML = `<div class="tabs-note">ภารกิจวันละข้อใน 7 วันแรก (ข้อใหม่ปลดล็อกทุกวัน ทำย้อนหลังได้) ข้อละ 🪙${W1.coin} • ครบ 7 ข้อได้ฉายา "${W1.final.title}" + 🪙${W1.final.coin} + ${itemInfo(W1.final.item).emoji} ${itemInfo(W1.final.item).name}</div>`
      + W1.list.map(m => { const done = w.done.includes(m.d), open = m.d <= w.day, n = Math.min(m.goal, w.n[m.d] || 0);
        return `<div class="qrow${done ? ' done' : ''}" style="${open ? '' : 'opacity:.5'}"><div>${done ? '✅' : open ? m.emoji : '🔒'} <b>วันที่ ${m.d}</b> ${m.text}</div><small>${open ? `${n}/${m.goal}` : `ปลดล็อกในอีก ${m.d - w.day} วัน`}</small></div>`; }).join('');
  } else if (questTab === 'start' && st.final) { // บทที่ 2: รู้จักอาชีพอื่น
    const c2 = st.c2, S2 = Shared.STARTER2, next = S2.find(s => !c2.done.includes(s.id)), hid = g2Hidden();
    const steps = S2.map(s => {
      const d = c2.done.includes(s.id), cur = next === s;
      return `<details class="vcard"${cur ? ' open' : ''} style="margin:6px 0;${d ? 'opacity:.55' : ''}"><summary style="cursor:pointer;font-weight:700">${d ? '✅' : cur ? '👉' : '⬜'} ${s.text} <small>+🪙${s.coin}</small></summary>`
        + `<ol style="margin:6px 0 2px;padding-left:20px;font-size:13px">${(s.how || []).map(x => `<li>${x}</li>`).join('')}</ol></details>`;
    }).join('');
    el.innerHTML = '<div class="tabs-note">🧭 บทที่ 2: รู้จักอาชีพอื่นของเมือง ตัดไม้ ขุดแร่ เลี้ยงสัตว์ ทำอาหาร ทำข้อไหนก่อนก็ได้ ลูกศรสีเหลืองจะชี้ทางให้ (ซื้อของที่ร้านก่อน แล้วค่อยชี้ที่ทำงาน)</div>'
      + (next ? `<div class="banner" style="background:#fff3cf">👉 ข้อต่อไป: <b>${next.hint}</b></div>` : '')
      + `<div class="sec">🧭 คู่มือบทที่ 2 ${c2.done.length}/${S2.length}</div>` + steps
      + `<small>ครบทุกข้อรับ 🪙${Shared.STARTER2_FINAL.coin}</small>`
      + `<div class="center" style="margin-top:10px"><button class="btn small muted" id="g2toggle">${hid ? '👁️ แสดงป้าย/ลูกศรนำทางอีกครั้ง' : '🙈 ซ่อนป้ายและลูกศรนำทาง'}</button></div>`;
    $('g2toggle').onclick = () => { ls.set('mw_g2hide', hid ? '0' : '1'); updateGuide(); renderQuestPanel(); };
  } else if (questTab === 'start') {
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
      + '<li><b>ร้านค้า:</b> คลิก/แตะที่ประตูหรือตัวร้าน (ยืนใกล้ๆ ประตู) แล้วเลือกซื้อ/ขายในหน้าต่างที่เปิดขึ้น</li>'
      + '<li><b>เมนูด้านบน:</b> 🎒 กระเป๋า • 📋 เควส • 🏅 ฉายา/ความสำเร็จ • 💬 แชท • 💭 สถานะ</li></ul></details>'
      + (next ? `<div class="banner" style="background:#fff3cf">👉 ข้อต่อไป: <b>${next.hint}</b></div>` : '')
      + (questSt.streak && questSt.streak.n ? `<div class="vcard on"><b>🔥 เข้าเกมติดต่อกัน ${questSt.streak.n} วัน</b> <small>ได้เหรียญทุกวัน • ครบ 7 วันได้ของตกแต่งหายาก</small></div>` : '')
      + `<div class="sec">🌱 คู่มือเริ่มต้น ${st.done.length}/${STARTER.length}</div>` + steps
      + `<small>ครบทุกข้อรับ 🪙${STARTER_FINAL.coin} + เก้าอี้ + ต้นไม้ประดับ • แล้วมี "บทที่ 2" สอนตัดไม้ ขุดแร่ เลี้ยงสัตว์ ทำอาหาร ต่อให้</small>`;
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
let lottoTab = 'buy'; // แท็บหวย: rules กติกา • buy ซื้อตั๋ว • result ผลรางวัล
const LOTTO_INFO = [ // คำอธิบาย/โอกาสของแต่ละรางวัล (ตามลำดับ Shared.LOTTO.prize) — โอกาสเป็นค่าโดยประมาณต่อ 1 ใบ
  ['เลขตรงรางวัล 1 ครบ 3 หลัก', '1 ใน 1,000'], ['2 หลักท้ายตรงเลขชุดที่ 2', '1 ใน 100'], ['2 หลักท้ายตรงเลขชุดที่ 3', '1 ใน 100'],
  ['เลข 3 ตัวเดียวกับรางวัล 1 แต่สลับที่ (ไม่ตรงเป๊ะ)', '1 ใน ~240'], ['2 หลักแรกตรงรางวัล 1', '1 ใน 100'],
  ['เลขมากกว่าหรือน้อยกว่ารางวัล 1 อยู่ 1 (เช่น ออก 123 → 122 / 124)', '1 ใน 500'], ['หลักสุดท้ายตรงรางวัล 1', '1 ใน 10']];
const fmtN = n => Number(n || 0).toLocaleString('en-US');
function lottoPrizeAmt(P, pot) { return Math.max(P.min || 0, Math.min(Math.floor(pot * P.pct), P.cap)); } // เงินรางวัลตอนนี้ตามกองจริง
function lottoCard() { // Lucky Lotto 3 แท็บ: กติกา / ซื้อตั๋ว / ผลรางวัล • เลขชนะสุ่มปิดผนึกไว้ก่อน ตรวจ hash ได้หลังเปิดผล
  const L = lottoSt, esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), LT = Shared.LOTTO, PZ = LT.prize;
  if (!L) return '<p style="opacity:.7">กำลังโหลด…</p>';
  const left = Math.max(0, L.drawAt - (Date.now() + timeOffset)), hh = Math.floor(left / 3600e3), mm = Math.floor(left % 3600e3 / 60e3);
  const room = L.left ?? (L.max - L.mine.length), total = L.buyers.reduce((n, b) => n + b[1], 0);
  const pendSum = lottoPendSum(), pendBar = pendSum ? `<div class="banner" style="background:#fff3cf;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>🎁 มีรางวัลรอรับ 🪙${fmtN(pendSum)}${L.near ? '' : ' <small>(ไปที่ตู้ Lucky Lotto ที่ลานกองไฟก่อนนะ)</small>'}</span><button class="btn small" id="lclaim" style="min-height:44px;min-width:44px">รับรางวัล</button></div>` : '';
  let h = `<div class="ltbar"><div><small>🏦 กองกลาง</small><b>🪙 ${fmtN(L.pot)}</b></div><div><small>⏰ ออกผล ${LT.revealHour}:00</small><b>อีก ${hh} ชม. ${mm} นาที</b></div><div><small>🎫 ตั๋วของฉัน</small><b>${L.mine.length}/${L.max} ใบ</b></div></div>`
    + pendBar + `<div class="chips ltTabs">${[['rules', '📖 กติกา'], ['buy', '🎫 ซื้อตั๋ว'], ['result', '🏆 ผลรางวัล']].map(([k, n]) => `<button class="chip${lottoTab === k ? ' sel' : ''}" data-lt="${k}">${n}</button>`).join('')}</div>`;
  if (lottoTab === 'rules') {
    h += `<div class="sec">วิธีเล่น</div><ul class="ltlist"><li>ซื้อตั๋วเลข <b>3 หลัก</b> ใบละ <b>🪙${LT.price}</b> ซื้อได้ <b>${L.max} ใบต่องวด</b> เลือกเลขเองหรือกดสุ่ม</li>`
      + `<li>ออกผลทุกวัน <b>${LT.revealHour}:00 น.</b> ปิดรับตั๋ว 1 นาทีก่อนออกผล • ต้องยืนใกล้ตู้ผ่านคู่มือเริ่มต้นและระดับการเล่น ≥ ${L.minLv}</li>`
      + `<li>เลขที่ออกมี 3 ชุด (รางวัล 1 / 2 / 3) ตั๋ว 1 ใบ <b>ถูกได้หลายรางวัลพร้อมกัน</b></li>`
      + `<li>เงินรางวัลคิดเป็น % ของ <b>กองกลาง</b> (มีเพดาน) ถ้ามีหลายใบถูกรางวัลเดียวกันจะหารเท่ากัน (🍀 จ่ายเต็มทุกใบ) ไม่มีผู้ถูกกองทบไปงวดหน้า</li></ul>`
      + `<div class="sec">รางวัลทั้ง ${PZ.length} ชนิด</div>` + PZ.map((P, k) => {
        const amt = lottoPrizeAmt(P, L.pot), pay = P.each ? `🪙${fmtN(amt)} <small>ต่อใบ</small>` : `🪙${fmtN(amt)}`, rule = P.each ? `ขั้นต่ำ ${P.min} • ${P.pct * 100}% ของกอง ไม่เกิน ${fmtN(P.cap)}` : `${P.pct * 100}% ของกอง ไม่เกิน ${fmtN(P.cap)}`;
        return `<div class="ltprize"><span class="e">${P.e}</span><span class="d"><b>${esc(P.name)}</b><small>${LOTTO_INFO[k][0]}<br>โอกาส ${LOTTO_INFO[k][1]} ต่อใบ</small></span><span class="a"><b>${pay}</b><small>${rule}</small></span></div>`;
      }).join('')
      + `<p class="ltnote">เงินที่แสดงคำนวณจากกองกลางตอนนี้ (🪙${fmtN(L.pot)}) • รวมทุกรางวัลจ่ายไม่เกินกองกลางเสมอ<br>🔒 เลขของงวดนี้สุ่มและปิดผนึกไว้ก่อนขายตั๋ว (ลายนิ้วมือ <code>${esc(L.hash.slice(0, 16))}…</code>) ตรวจได้ในแท็บผลรางวัลหลังออกผล<br>เงินเข้ากองจากค่าตั๋ว ค่าซ่อม ค่าเตา/ช่างไม้ ค่าเช่าแปลง ค่าบริการตู้เกม และภาษีขาย</p>`;
  } else if (lottoTab === 'buy') {
    h += `<div class="sec">🎫 ตั๋วของฉันงวดนี้ (${L.mine.length}/${L.max})</div><div class="ltmine">${L.mine.length ? L.mine.map(n => `<b class="ltball">${n}</b>`).join('') : '<small style="opacity:.6">ยังไม่มีตั๋ว</small>'}</div>`;
    if (!L.ok) h += `<div class="banner" style="background:#ffe3d6">ซื้อได้เมื่อผ่านคู่มือเริ่มต้นและระดับการเล่นถึง ${L.minLv}</div>`;
    else if (!L.open) h += '<div class="banner">ปิดรับตั๋วแล้ว เปิดขายอีกครั้งหลังออกผล</div>';
    else if (!L.near) h += '<div class="banner" style="background:#ffe3d6">ต้องยืนใกล้ตู้ Lucky Lotto ถึงซื้อตั๋วได้</div>';
    else if (room > 0) h += `<div class="ltbuy"><div class="center"><input id="lnum" maxlength="3" inputmode="numeric" placeholder="เลข 3 หลัก" style="width:104px;text-align:center"> <button class="btn small" id="lbuy">ซื้อเลขนี้ 🪙${LT.price}</button></div><div class="center" style="margin-top:6px"><button class="btn small" id="lr1">🎲 สุ่ม 1 ใบ</button> <button class="btn small" id="lrall">🎲 สุ่มที่เหลือ (${room} ใบ = 🪙${fmtN(room * LT.price)})</button></div></div>`;
    else h += '<div class="banner">ซื้อครบ ' + L.max + ' ใบแล้วสำหรับงวดนี้ 🎉 รอลุ้นผล</div>';
    h += `<div class="sec">👥 ใครซื้อบ้างงวดนี้ (${L.buyers.length} คน • ${total} ใบ)</div>` + (L.buyers.length ? L.buyers.map(([nm, n]) => `<div class="row"><span>${esc(nm)}</span><b>${n} ใบ</b></div>`).join('') : '<p style="opacity:.6;margin:2px 0">ยังไม่มีใครซื้อ</p>');
  } else {
    const hist = L.hist || [], lt = L.last, x = hist[0];
    const sums = w => w.reduce((n, q) => n + q[2], 0);
    const drawn = n => `<div class="ltdraw"><div class="ltb"><small>${PZ[0].e} รางวัล 1 (ตรง 3 หลัก)</small><b class="ltball big">${n[0]}</b></div><div class="ltb"><small>${PZ[1].e} รางวัล 2 (ท้าย 2 หลัก)</small><b class="ltball big">${n[1].slice(1)}</b></div><div class="ltb"><small>${PZ[2].e} รางวัล 3 (ท้าย 2 หลัก)</small><b class="ltball big">${n[2].slice(1)}</b></div></div>`
      + `<div class="ltderived"><span>${PZ[3].e} โต๊ด: เลข ${n[0].split('').sort().join('')} สลับที่</span><span>${PZ[4].e} หน้า 2 ตัว: <b>${n[0].slice(0, 2)}</b></span><span>${PZ[5].e} ข้างเคียง: <b>${String((parseInt(n[0], 10) + 999) % 1000).padStart(3, '0')}</b> / <b>${String((parseInt(n[0], 10) + 1) % 1000).padStart(3, '0')}</b></span><span>${PZ[6].e} ท้าย 1 หลัก: <b>${n[0][2]}</b></span></div>`;
    const winners = w => { if (!w.length) return '<p class="ltnone">ไม่มีผู้ถูกรางวัล (ทบกองไปงวดหน้า)</p>'; const by = {}; for (const [nm, k, a] of w) (by[k] = by[k] || []).push([nm, a]); return Object.keys(by).sort((a, b) => a - b).map(k => `<div class="ltwin"><span class="e">${(PZ[k - 1] || {}).e || '🏅'}</span><span class="n"><b>${esc((PZ[k - 1] || {}).name || 'รางวัล ' + k)}</b><small>${by[k].map(([nm, a]) => esc(nm) + ' +🪙' + fmtN(a)).join(' • ')}</small></span></div>`).join(''); };
    if (!x) h += '<p style="opacity:.7;text-align:center;margin:14px 0">ยังไม่เคยออกรางวัล<br><small>งวดแรกจะออกผลตามเวลาที่แจ้งด้านบน</small></p>';
    else {
      const d = x.round.split('-');
      h += `<div class="sec">🏆 ผลงวดล่าสุด ${d[2]}/${d[1]}/${d[0]} <small>(ตั๋ว ${x.n} ใบ • กอง 🪙${fmtN(x.pot0)} • จ่ายรวม 🪙${fmtN(sums(x.winners))})</small></div>` + drawn(x.nums) + `<div class="sec">🎉 ผู้ถูกรางวัล</div>` + winners(x.winners);
      if (lt) h += `<p class="ltnote">🔒 ตรวจความโปร่งใส: sha256(<code>${esc(lt.salt)}</code>:${lt.nums.join(',')}) = <span id="lchk">…</span></p>`;
      if (hist.length > 1) h += `<div class="sec">🔢 เลขที่ออกย้อนหลัง (${hist.length - 1} งวด)</div>` + hist.slice(1).map(y => { const e = y.round.split('-'); return `<div class="ltold"><b>${e[2]}/${e[1]}</b> <span>${PZ[0].e}<b class="ltball">${y.nums[0]}</b> ${PZ[1].e}<b class="ltball">${y.nums[1].slice(1)}</b> ${PZ[2].e}<b class="ltball">${y.nums[2].slice(1)}</b></span><small>${y.winners.length ? 'ถูก ' + y.winners.length + ' รายการ • จ่าย 🪙' + fmtN(sums(y.winners)) : 'ไม่มีผู้ถูก'}</small></div>`; }).join('');
    }
  }
  return h;
}
function bindLotto(el) {
  el.querySelectorAll('[data-lt]').forEach(b => b.onclick = () => { lottoTab = b.dataset.lt; renderTown(); });
  const buy = nums => send({ t: 'lotto', a: 'buy', nums }), room = lottoSt ? lottoSt.max - lottoSt.mine.length : 0;
  const cl = $('lclaim'); if (cl) cl.onclick = () => { if (!lottoSt.near) return toast('🎟️ ไปยืนใกล้ตู้ Lucky Lotto ที่ลานกองไฟก่อนนะ ถึงจะรับรางวัลได้'); send({ t: 'lotto', a: 'claim' }); };
  const one = $('lbuy'); if (one) one.onclick = () => { const v = $('lnum').value.trim(); if (!/^\d{3}$/.test(v)) return toast('ใส่เลข 3 หลักก่อนนะ (000–999)'); buy([v]); };
  const r1 = $('lr1'); if (r1) r1.onclick = () => buy([null]);
  const ra = $('lrall'); if (ra) ra.onclick = () => buy(Array(room).fill(null));
  const lt = lottoSt && lottoSt.last, chk = $('lchk');
  if (lt && chk && window.crypto && crypto.subtle) crypto.subtle.digest('SHA-256', new TextEncoder().encode(lt.salt + ':' + lt.nums.join(','))).then(b => { const hx = [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); chk.textContent = hx === lt.hash ? '✅ ตรงกับลายนิ้วมือที่ประกาศไว้ก่อนขายตั๋ว' : '❌ ไม่ตรง'; });
}
function renderRankTab(el) {
  const R = rankSt, medal = ['🥇', '🥈', '🥉'], myName = me && me.name;
  const tabs = [['lv', '⭐ เลเวล'], ['wk', '📅 สัปดาห์นี้'], ['rich', '💰 เศรษฐี'], ['on', '⏱️ ออนไลน์สัปดาห์นี้']];
  let h = `<div class="chips" style="margin:0 0 8px">${tabs.map(([k, n]) => `<button class="chip${rankTab === k ? ' sel' : ''}" data-rtab="${k}">${n}</button>`).join('')}</div>`;
  if (!R) { el.innerHTML = h + '<p style="opacity:.7">กำลังโหลด...</p>'; }
  else {
    const mine = R.me || {};
    const list = (arr, unit, rank, label) => {
      let o = (arr && arr.length) ? arr.map((x, i) => `<div class="rkrow${x.n === myName ? ' me' : ''}"><span>${medal[i] || ('#' + (i + 1))} <b>${esc(x.n)}</b>${x.n === myName ? ' <small>(คุณ)</small>' : ''}</span><span>${unit(x)}</span></div>`).join('') : '<p style="opacity:.7">ยังไม่มีใครติดอันดับ</p>';
      if (rank != null) o += `<div class="banner" style="background:#fff3cf;margin-top:8px">${rank > 0 ? `👤 คุณอยู่อันดับที่ <b>${rank}</b>${label || ''}` : '👤 คุณยังไม่ติดอันดับ ลองเล่นเก็บแต้มดูนะ'}</div>`;
      return o;
    };
    if (rankTab === 'lv') {
      const subs = [['all', '🌟 รวม']].concat(Object.keys(R.lv || {}).filter(k => k !== 'all' && SKILLS[k]).map(k => [k, SKILLS[k].emoji + ' ' + SKILLS[k].name]));
      if (!subs.some(x => x[0] === rankSub)) rankSub = 'all';
      h += `<div class="chips" style="margin:0 0 8px">${subs.map(([k, n]) => `<button class="chip${rankSub === k ? ' sel' : ''}" data-rsub="${k}">${esc(n)}</button>`).join('')}</div>`;
      h += '<div class="sec">' + (rankSub === 'all' ? '🌟 เลเวลรวมทุกอาชีพ' : '⭐ เลเวล' + esc(SKILLS[rankSub].name)) + ' (Top 10)</div>'
        + list((R.lv || {})[rankSub], x => rankSub === 'all' ? `รวม <b>${x.lv}</b> เลเวล` : `Lv <b>${x.lv}</b> <small>(${x.xp.toLocaleString()} XP)</small>`, (mine.lv || {})[rankSub]);
    } else if (rankTab === 'wk') {
      h += '<div class="sec">📅 XP สัปดาห์นี้ (Top 10)</div>' + list(R.wk, x => `<b>${x.xp.toLocaleString()}</b> XP`, mine.wk)
        + '<p style="font-size:12px;opacity:.65;margin-top:10px">รีเซ็ตทุกสัปดาห์ คนใหม่ก็ขึ้นอันดับได้</p>';
    } else if (rankTab === 'rich') {
      h += '<div class="sec">💰 เศรษฐี (Top 10)</div>' + list(R.rich, x => `🪙 <b>${esc(x.coin)}</b>`, mine.rich) + '<p style="font-size:12px;opacity:.65;margin-top:10px">จัดอันดับจากความมั่งคั่งรวม: เหรียญ (รวมในธนาคาร) + ของและอุปกรณ์ในกระเป๋า + เฟอร์นิเจอร์ที่วางในบ้าน ปิดบังหลักหน้า เห็นแค่สามหลักท้าย เช่น xxx,xxx,123</p>';
    } else if (rankTab === 'on') {
      h += '<div class="sec">⏱️ ออนไลน์สัปดาห์นี้ (Top 10)</div>' + list(R.on, x => `<b>${x.h}</b> ชม.`, mine.on)
        + '<p style="font-size:12px;opacity:.65;margin-top:10px">นับเฉพาะตอนเชื่อมต่ออยู่ รีเซ็ตทุกวันจันทร์</p>';
    }
    el.innerHTML = h;
  }
  el.querySelectorAll('[data-rtab]').forEach(b => b.onclick = () => { rankTab = b.dataset.rtab; renderTown(); });
  el.querySelectorAll('[data-rsub]').forEach(b => b.onclick = () => { rankSub = b.dataset.rsub; renderTown(); });
}
// ตลาดนัด: จัดกลุ่มไอเทมตามอาชีพ (ใช้ cat จาก itemInfo + ชื่อ key) ไอเทมที่ไม่เข้าพวกไปกลุ่ม "อื่นๆ"
const FLEA_GRPS = [['all', '📦 ทั้งหมด'], ['farm', '🌾 ชาวนา'], ['animal', '🐄 คนเลี้ยงสัตว์'], ['fish', '🎣 ชาวประมง'], ['wood', '🪵 ช่างไม้'], ['ore', '⛏️ นักขุดแร่'], ['chef', '👨‍🍳 เชฟ'], ['other', '🎒 อื่นๆ']];
function fleaGrpOf(k) {
  const i = itemInfo(k), c = i && i.cat;
  if (c === 'crop' || c === 'seed') return 'farm';
  if (c === 'animal' || c === 'feed') return 'animal';
  if (c === 'fish' || (i && i.bait)) return 'fish';
  if (c === 'wood' || /^furn_/.test(k)) return 'wood';
  if (c === 'ore') return 'ore';
  if (c === 'food') return 'chef';
  return 'other';
}
let fleaGrp = (() => { const g = ls.get('mw_flea_grp'); return FLEA_GRPS.some(x => x[0] === g) ? g : 'all'; })();
const fleaGrpOk = k => fleaGrp === 'all' || fleaGrpOf(k) === fleaGrp;
function renderTown() {
  $('townTitle').textContent = ({ log: '📰 ข่าวเมือง', bank: '💳 ตู้ ATM', lotto: '🎟️ Lucky Lotto', rank: '🏆 ป้ายอันดับ', stall: '🛒 ตลาดนัด' })[townTab] || '📰 ข่าวเมือง';
  document.querySelectorAll('[data-ttab]').forEach(t => t.classList.toggle('on', t.dataset.ttab === townTab));
  const el = $('townBody'), esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  if (townTab === 'bank') return renderBankTab(el);
  if (townTab === 'lotto') { el.innerHTML = lottoCard(); bindLotto(el); return; }
  if (townTab === 'fame') return renderFameTab(el);
  if (townTab === 'rank') return renderRankTab(el);
  const tabs = ['log', 'orders'].includes(townTab) ? `<div class="chips" style="margin:0 0 8px">${[['log', '📰 ข่าว'], ['orders', '📋 ใบงาน']].map(([k, n]) => `<button class="chip${townTab === k ? ' sel' : ''}" data-ttab2="${k}">${n}</button>`).join('')}</div>` : '';
  const bindTabs = () => el.querySelectorAll('[data-ttab2]').forEach(b => b.onclick = () => { townTab = b.dataset.ttab2; if (townTab === 'orders') send({ t: 'orders', a: 'list' }); if (townTab === 'log') send({ t: 'quest', a: 'fame' }); renderTown(); });
  if (townTab === 'stall') { // ตลาดนัด (ป้ายที่ลานกองไฟ): แท็บขาย/เสนอขาย + รับซื้อ/เสนอซื้อ
    const S0 = Shared.STALL, myKey = me ? me.name.toLowerCase() : '', coin = inv.coin || 0, tax = Math.round(S0.tax * 100), B44 = 'min-height:44px;min-width:44px';
    const frTxt = f => f ? `<small>🟢${f[0]} 🟡${f[1]} 🔴${f[2]}</small>` : '', frName = ['สดเท่านั้น', 'รับถึงของค้าง', 'รับทุกสภาพ'];
    let h = `<div class="chips" style="margin:0 0 8px">${[['sell', '🛒 ขาย/เสนอขาย'], ['buy', '🤝 รับซื้อ/เสนอซื้อ']].map(([k, n]) => `<button class="chip${fleaTab === k ? ' sel' : ''}" style="${B44}" data-ftab="${k}">${n}</button>`).join('')}</div>`
      + `<p style="font-size:12px;opacity:.7;margin:0 0 6px">ซื้อขายกับผู้เล่นด้วยเหรียญ ตั้งราคาต่อชิ้นได้ ${Math.round(S0.min * 100)}–${Math.round(S0.max * 100)}% ของราคามาตรฐาน • คนขายโดนหักภาษี ${tax}% • ไม่มีคนซื้อใน ${S0.days} วันของคืน • ต้องตั้ง PIN ก่อน • ต้องยืนใกล้ป้ายตลาดนัดถึงจะซื้อขายได้</p>`;
    if (!pinSt) h += '<div class="banner" style="background:#ffe3d6">🔐 ตั้ง PIN ก่อนถึงจะซื้อขายที่ตลาดนัดได้ <button class="btn small" style="' + B44 + '" data-pinset="1">ตั้ง PIN</button></div>';
    h += `<div class="chips" id="fleaGrps" style="margin:0 0 8px;flex-wrap:nowrap;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch">${FLEA_GRPS.map(([k, n]) => `<button class="chip${fleaGrp === k ? ' sel' : ''}" style="${B44};flex:0 0 auto" data-fgrp="${k}">${n}</button>`).join('')}</div>`; // กรองตามอาชีพ (ใช้กับรายการและช่องเลือกของ)
    const fleaFar = () => { if (!nearFlea()) { toast('🛒 เดินไปที่ป้ายตลาดนัดตรงลานกองไฟก่อนนะ'); return true; } return false; };
    const priceBox = (id, sel) => `<input id="${id}" type="number" min="1" inputmode="numeric" style="width:84px;min-height:36px" title="ราคาต่อชิ้น"> <small id="${id}H" style="opacity:.7"></small>`;
    if (fleaTab === 'sell') {
      const others = stallSt.filter(x => x.mine !== myKey && fleaGrpOk(x.item)), mine = stallSt.filter(x => x.mine === myKey && fleaGrpOk(x.item)), mineAll = stallSt.filter(x => x.mine === myKey).length, tradableAll = Object.keys(inv).filter(k => Shared.isTradable(k) && inv[k] > 0), tradable = tradableAll.filter(fleaGrpOk);
      h += '<div class="sec">🛒 ของที่คนอื่นวางขาย</div>' + (others.length ? others.map(x => { const i = itemInfo(x.item); return `<div class="row"><span>${i.emoji} ${i.name} ×${x.n} ${frTxt(x.fr)}<br><small>ชิ้นละ 🪙${x.price} • โดย ${esc(x.name)}</small></span><span><button class="btn small" style="${B44}" data-sbuy="${x.id}" data-sn="1" ${coin < x.price || !pinSt ? 'disabled' : ''}>ซื้อ 1</button>${x.n > 1 ? ` <button class="btn small" style="${B44}" data-sbuy="${x.id}" data-sn="${x.n}" ${coin < x.price * x.n || !pinSt ? 'disabled' : ''}>ทั้งหมด 🪙${x.price * x.n}</button>` : ''}</span></div>`; }).join('') : '<p style="opacity:.7">ยังไม่มีใครวางขาย</p>');
      h += `<div class="sec">📦 ของที่ฉันวางขาย (${mineAll}/${S0.slots})</div>` + (mine.length ? mine.map(x => { const i = itemInfo(x.item); return `<div class="row"><span>${i.emoji} ${i.name} ×${x.n} ${frTxt(x.fr)} • ชิ้นละ 🪙${x.price}</span><button class="btn small muted" style="${B44}" data-scancel="${x.id}">เก็บคืน</button></div>`; }).join('') : '<p style="opacity:.7">ยังไม่ได้วางอะไร</p>');
      if (tradableAll.length && pinSt && mineAll < S0.slots) {
        h += `<div class="sec">➕ ลงประกาศขาย</div><div class="row" style="flex-wrap:wrap;gap:6px"><select id="stItem" style="min-height:44px;max-width:100%">${tradable.length ? '' : '<option value="" disabled selected>(ไม่มีของในกลุ่มนี้)</option>'}${tradable.map(k => { const i = itemInfo(k); return `<option value="${k}">${i.emoji} ${i.name} (มี ${inv[k]})</option>`; }).join('')}</select>`
          + `<input id="stN" type="number" min="1" inputmode="numeric" value="1" style="width:64px;min-height:36px" title="จำนวน"> ${priceBox('stPrice')} <button class="btn small" style="${B44}" id="stPost">วางขาย</button></div><small id="stHint" style="opacity:.7"></small>`;
      }
    } else {
      const myBidsAll = bidSt.filter(x => x.mine === myKey), myBids = myBidsAll.filter(x => fleaGrpOk(x.item)), others = bidSt.filter(x => x.mine !== myKey && fleaGrpOk(x.item));
      h += '<div class="sec">🤝 คำเสนอซื้อ (ขายให้ได้เลย)</div>' + (others.length ? others.map(x => { const i = itemInfo(x.item), have = inv[x.item] || 0, q = Math.min(x.n, have);
        let worst = 0; if (Shared.perishable(x.item) && freshSt.l[x.item]) { const c = Shared.freshCount(freshSt.l[x.item], Date.now() + timeOffset, false); worst = c[2] ? 2 : c[1] ? 1 : 0; }
        const old = worst > x.fresh, off = !pinSt || q < 1 || old, net = p => p * x.price - Math.floor(p * x.price * S0.tax);
        return `<div class="row"><span>${i.emoji} ${i.name} ×${x.n} <small>(${frName[x.fresh]})</small><br><small>ชิ้นละ 🪙${x.price} • โดย ${esc(x.name)} • ฉันมี ${have}${old ? ' • ของเก่าเกินที่เขารับ' : ''}</small></span><span><button class="btn small" style="${B44}" data-sfill="${x.id}" data-sn="1" ${off ? 'disabled' : ''}>ขาย 1 ได้ 🪙${net(1)}</button>${q > 1 ? ` <button class="btn small" style="${B44}" data-sfill="${x.id}" data-sn="${q}" ${off ? 'disabled' : ''}>ขาย ${q} ได้ 🪙${net(q)}</button>` : ''}</span></div>`; }).join('') : '<p style="opacity:.7">ยังไม่มีใครเสนอซื้อ</p>');
      h += `<div class="sec">📋 คำเสนอซื้อของฉัน (${myBidsAll.length}/${S0.bidSlots})</div>` + (myBids.length ? myBids.map(x => { const i = itemInfo(x.item); return `<div class="row"><span>${i.emoji} ${i.name} ×${x.n} • ชิ้นละ 🪙${x.price} <small>(${frName[x.fresh]} • กันเงินไว้ 🪙${x.n * x.price})</small></span><button class="btn small muted" style="${B44}" data-sbcancel="${x.id}">ยกเลิก คืนเงิน</button></div>`; }).join('') : '<p style="opacity:.7">ยังไม่ได้เสนอซื้อ</p>');
      if (pinSt && myBidsAll.length < S0.bidSlots) {
        const all = Shared.SELLABLE.filter(k => Shared.isTradable(k) && fleaGrpOk(k));
        h += `<div class="sec">➕ ตั้งเสนอซื้อ (กันเงินไว้ก่อน คืนเต็มเมื่อยกเลิก)</div><div class="row" style="flex-wrap:wrap;gap:6px"><select id="bdItem" style="min-height:44px;max-width:100%">${all.length ? '' : '<option value="" disabled selected>(ไม่มีของในกลุ่มนี้)</option>'}${all.map(k => { const i = itemInfo(k); return `<option value="${k}">${i.emoji} ${i.name}</option>`; }).join('')}</select>`
          + `<input id="bdN" type="number" min="1" inputmode="numeric" value="1" style="width:64px;min-height:36px" title="จำนวน"> ${priceBox('bdPrice')}</div>`
          + `<div class="row" style="flex-wrap:wrap;gap:6px"><select id="bdFresh" style="min-height:36px"><option value="0">🟢 ${frName[0]}</option><option value="1">🟡 ${frName[1]}</option><option value="2">🔴 ${frName[2]}</option></select> <button class="btn small" style="${B44}" id="bdPost">เสนอซื้อ</button></div><small id="bdHint" style="opacity:.7"></small>`;
      }
    }
    el.innerHTML = h;
    { const g = el.querySelector('#fleaGrps .sel'); if (g) g.scrollIntoView({ block: 'nearest', inline: 'center' }); } // เลื่อนแถวกลุ่มไปที่ชิปที่เลือก
    el.querySelectorAll('[data-ftab]').forEach(b => b.onclick = () => { fleaTab = b.dataset.ftab; renderTown(); });
    el.querySelectorAll('[data-fgrp]').forEach(b => b.onclick = () => { fleaGrp = b.dataset.fgrp; ls.set('mw_flea_grp', fleaGrp); renderTown(); });
    const range = b => `ราคามาตรฐาน 🪙${b} • ตั้งได้ ${Math.max(1, Math.ceil(b * S0.min))}–${Math.floor(b * S0.max)} ต่อชิ้น`;
    const sel = $('stItem'); if (sel && sel.value) { const hint = () => { const b = Shared.tradeValue(sel.value), n = Math.max(1, +$('stN').value || 1), p = +$('stPrice').value || 0; $('stPrice').value = $('stPrice').value || b; $('stHint').textContent = `${range(b)} • ขายครบได้รับสุทธิ ~🪙${n * (+$('stPrice').value) - Math.floor(n * (+$('stPrice').value) * S0.tax)} (หักภาษี ${tax}%)`; };
      sel.onchange = () => { $('stPrice').value = ''; hint(); }; $('stN').oninput = $('stPrice').oninput = hint; hint();
      $('stPost').onclick = () => { if (fleaFar()) return; send({ t: 'stall', a: 'post', item: sel.value, n: +$('stN').value, price: +$('stPrice').value }); }; }
    const bs = $('bdItem'); if (bs && bs.value) { const hint = () => { const b = Shared.tradeValue(bs.value), n = Math.max(1, +$('bdN').value || 1); $('bdPrice').value = $('bdPrice').value || b; $('bdHint').textContent = `${range(b)} • จะกันเงินไว้ 🪙${n * (+$('bdPrice').value || 0)} (มี 🪙${coin})`; };
      bs.onchange = () => { $('bdPrice').value = ''; hint(); }; $('bdN').oninput = $('bdPrice').oninput = hint; hint();
      $('bdPost').onclick = () => { if (fleaFar()) return; send({ t: 'stall', a: 'bid', item: bs.value, n: +$('bdN').value, price: +$('bdPrice').value, fresh: +$('bdFresh').value }); }; }
    el.querySelectorAll('[data-sbuy]').forEach(b => b.onclick = () => { if (fleaFar()) return; ask(`ซื้อ ${b.dataset.sn} ชิ้น?`, () => send({ t: 'stall', a: 'buy', id: +b.dataset.sbuy, n: +b.dataset.sn })); });
    el.querySelectorAll('[data-sfill]').forEach(b => b.onclick = () => { if (fleaFar()) return; ask(`ขาย ${b.dataset.sn} ชิ้นให้คำเสนอซื้อนี้? (หักภาษี ${tax}%)`, () => send({ t: 'stall', a: 'fill', id: +b.dataset.sfill, n: +b.dataset.sn })); });
    el.querySelectorAll('[data-scancel]').forEach(b => b.onclick = () => send({ t: 'stall', a: 'cancel', id: +b.dataset.scancel }));
    el.querySelectorAll('[data-sbcancel]').forEach(b => b.onclick = () => send({ t: 'stall', a: 'bcancel', id: +b.dataset.sbcancel }));
    el.querySelectorAll('[data-pinset]').forEach(b => b.onclick = () => showPinBox(pinSt));
    return;
  }
  if (townTab === 'orders') { // ใบงาน NPC: ส่งของหลายหมวดในใบเดียว
    const o = ordersSt; let h = tabs + '<p style="font-size:12px;opacity:.7;margin:0 0 6px">ชาวเมืองต้องการของหลายอย่างในใบเดียว จ่ายมากกว่าขายที่ร้าน 20% ใบงานใหม่ทุกวัน (คนละไม่เกิน 2 ใบ/วัน) ชวนเพื่อนต่างอาชีพมาช่วยกันหาของ</p>';
    if (!o) h += '<p style="opacity:.7">กำลังโหลด...</p>';
    else h += `<div class="sec">📋 ใบงานวันนี้ (ส่งแล้ว ${o.mine}/${o.max})</div>` + o.list.map(x => { const ok = x.need.every(([k, q]) => (inv[k] || 0) >= q);
      return `<div class="qrow${x.done ? ' done' : ''}"><div>🧑‍🌾 <b>${esc(x.npc)}</b> ต้องการ: ${x.need.map(([k, q]) => { const i = itemInfo(k); return `${i.emoji}${i.name} ×${q} <small>(มี ${inv[k] || 0})</small>`; }).join(' • ')}</div>`
        + `<div class="row" style="margin-top:4px"><span>รางวัล 🪙<b>${x.pay}</b></span>${x.done ? `<span>✅ ${esc(x.done)} ส่งแล้ว</span>` : `<button class="btn small" data-ofill="${x.id}" ${ok && o.mine < o.max ? '' : 'disabled'}>ส่งของ</button>`}</div></div>`; }).join('');
    el.innerHTML = h; bindTabs();
    el.querySelectorAll('[data-ofill]').forEach(b => b.onclick = () => send({ t: 'orders', a: 'fill', id: +b.dataset.ofill }));
    return;
  }
  if (townTab === 'log') {
    if (NOTICES.length && noticeUnread() && !townNoticeOpen) townNoticeOpen = townNoticeFreshId = NOTICES[0].id; // เปิดดูครั้งแรก: คลี่ประกาศใหม่ให้อ่านเลย
    const noisy = x => /^(👋|🚪)/.test(x[1]), rows = (newsHideNoise ? townLog.filter(x => !noisy(x)) : townLog.slice()).reverse(), hid = townLog.length - townLog.filter(x => !noisy(x)).length;
    const nCard = (n, i) => { const open = i === 0 && townNoticeOpen === n.id, fresh = townNoticeFreshId === n.id && i === 0;
      const body = open ? `<p class="nintro">${esc(n.intro || '')}</p>` + n.sections.map(sc => `<div class="nsec">${esc(sc.h)}</div><ul>${sc.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`).join('') + (n.outro ? `<p class="nintro">${esc(n.outro)}</p>` : '') : `<p class="nintro">${esc((n.intro || '').slice(0, 90))}…</p>`;
      return `<div class="ncard${fresh ? ' new' : ''}"><div class="nhead"><b>${n.emoji} ${esc(n.title)}</b>${fresh ? ' <span class="nbadge">ใหม่</span>' : ''}<small>${esc(n.date)}</small></div>${body}<button class="btn small" data-notice="${esc(n.id)}">${open ? 'ย่อ' : 'อ่านทั้งหมด'}</button></div>`; };
    el.innerHTML = tabs + (NOTICES.length ? '<div class="sec">📢 ประกาศจากผู้ดูแล</div>' + NOTICES.map(nCard).join('') : '') + eventCard() + villageCard() + weeklyCard()
      + '<div class="sec">📰 ข่าวล่าสุด</div><div class="chips" style="margin:2px 0 6px"><button class="chip' + (newsHideNoise ? ' sel' : '') + '" data-newsnoise="1">ซ่อนคนเข้า-ออก' + (hid ? ' (' + hid + ')' : '') + '</button></div>'
      + (rows.length ? rows.map(([t, s]) => { const d = new Date(t); return `<div class="logrow"><time>${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</time><span>${esc(s)}</span></div>`; }).join('') : '<p style="opacity:.7">ยังไม่มีข่าว</p>')
      + '<div class="sec">🏆 อันดับวันนี้</div>' + fameHTML();
    if (NOTICES.length && townNoticeOpen === NOTICES[0].id && noticeUnread()) { ls.set('mw_notice_seen', townNoticeOpen); updateNoticeDot(); } // วาดแล้วถือว่าอ่านแล้ว (ป้าย 'ใหม่' โชว์แค่รอบแรก)
    el.querySelectorAll('[data-notice]').forEach(b => b.onclick = () => { const id = b.dataset.notice; townNoticeOpen = townNoticeOpen === id ? '' : id; if (townNoticeOpen && NOTICES[0] && id === NOTICES[0].id) { ls.set('mw_notice_seen', id); updateNoticeDot(); } renderTown(); });
    el.querySelectorAll('[data-newsnoise]').forEach(b => b.onclick = () => { newsHideNoise = !newsHideNoise; ls.set('mw_news_noise', newsHideNoise ? '1' : '0'); renderTown(); });
    bindTabs();
    el.querySelectorAll('[data-wkclaim]').forEach(b => b.onclick = () => send({ t: 'quest', a: 'weekly' }));
    return;
  }
}
document.querySelectorAll('[data-ttab]').forEach(t => t.onclick = () => { townTab = t.dataset.ttab; if (townTab === 'log') send({ t: 'quest', a: 'fame' }); renderTown(); });
$('townBtn').onclick = () => (townShown() ? closeTown() : openTown('log'));
$('townClose').onclick = closeTown;
$('town').addEventListener('pointerdown', e => { if (e.target === $('town')) closeTown(); });

// ---------- บ้าน / ตกแต่ง ----------
const furnKeys = () => Object.keys(inv).filter(k => k.startsWith('furn_') && FURN[k.slice(5)]);
// ---------- บ้านหลังใหญ่: แมพแยก (ฉาก) มุมมองไอโซเมตริก ตกแต่งอิสระ ----------
// ตอนอยู่ในบ้าน MAP ถูกสลับเป็นแมพบ้านชั่วคราว (ผนัง/พื้น/ประตู) เก็บแถวของแมพเมืองไว้ใน townRows ของเมืองที่มาใหม่ระหว่างนั้น (ต้นไม้/โครงการ) แก้ที่ tmap()
let houseSt = { fl: 'oak', wp: 'cream' }, houseBgKey = '', scene = null, houseInfo = null, townRows = null, townDirty = false, hboard = null, houseRects = [], houseBg = null, houseGrid = null;
let cave = false, caveFlr = 0, townCache = null; const oreK = new Map(), oreS = new Map(); // caveFlr = ชั้นของถ้ำที่อยู่ • oreS = ขนาดก้อนแร่ (0 เล็ก 1 กลาง 2 ใหญ่)  // ถ้ำเหมือง: cave = อยู่ในถ้ำ (แมพบน แต่ MAP ถูกสลับเป็นผังถ้ำ) • oreK = ก้อนแร่ 'x,y' → ชนิด
const inTown = () => !scene && !cave;
const inSea = () => cave && Shared.isSeaScene(caveFlr); // ฉากทะเล: แพ (ชั้น 99) หรือทะเลใหญ่ (ชั้น 98) ใช้ระบบฉากเดียวกับถ้ำ
const inOcean = () => cave && Shared.isOcean(caveFlr); // ทะเลใหญ่: ขับเรือเอง (ช่องแล่นได้ = T.CAVE วาดเป็นน้ำ)
let seaEnd = 0; // เวลา (เวลาเซิร์ฟเวอร์) ที่กัปตันจะพากลับเกาะ
const tmap = () => (scene || cave ? townRows : MAP);
const inMyHouse = () => !!scene && !!houseInfo && houseInfo.mine;
const setSceneRows = rows => { for (let y = 0; y < H; y++) MAP[y] = rows[y]; };
const furnObj = skip => { const o = {}; for (const [i, it] of furn) if (i !== skip) o[i] = it; return o; };
const rebuildRects = () => { houseRects = Shared.houseSolidRects(furnObj()); };
// มุมมองตอนตกแต่ง: ซูมให้เห็นทั้งห้องในพื้นที่ที่ไม่ถูกเมนูบัง (bz.z = ซูมเพิ่มจากขนาดพอดีห้อง, bz.px/py = เลื่อนมุมมอง)
const bz = { z: 1, px: 0, py: 0 };
let touchAim = null, dragNew = null, panDrag = null, bfLast = false, bfSuppress = 0; // จุดที่นิ้วชี้ • ของที่ลากมาจากรายการ • ลากเลื่อนมุมมองด้วยเมาส์ปุ่มขวา
const undoStack = []; let undoT = 0, undoUntil = 0; // เก็บคำสั่งย้อนกลับของการวาง/ย้าย/หมุน/เก็บ (สูงสุด 30)
function pushUndo(m) { // บันทึกคำสั่งย้อนกลับจากข้อความที่เซิร์ฟเวอร์ยืนยันแล้ว (ของที่ถูกย้ายตามหลังพ่อ ส่งมาในจังหวะเดียวกัน นับเป็นก้อนเดียว)
  const now = performance.now(); if (now < undoUntil) return;
  const prev = furn.get(m.op === 'del' ? m.i : m.o.i); let inv = null;
  if (m.op === 'del') { if (prev) inv = { a: 'place', f: prev.f, x: prev.x, y: prev.y, r: prev.r | 0, wl: prev.wl, u: prev.u }; }
  else if (!prev) inv = { a: 'remove', i: m.o.i };
  else if ((prev.r | 0) !== (m.o.r | 0)) inv = { a: 'rot', i: m.o.i };
  else inv = { a: 'move', i: m.o.i, x: prev.x, y: prev.y, wl: prev.wl, u: prev.u };
  if (!inv) return;
  if (now - undoT > 150 || !undoStack.length) { undoStack.push(inv); if (undoStack.length > 30) undoStack.shift(); }
  undoT = now;
}
function undoBuild() {
  if (!build.on) return;
  const o = undoStack.pop(); if (!o) { toast('ไม่มีอะไรให้เลิกทำ'); return; }
  undoUntil = performance.now() + 600; send(Object.assign({ t: 'house' }, o)); playSfx('click'); renderBuild();
}
function syncHouseBg() { const k = houseSt.fl + '|' + houseSt.wp; if (!houseBg || houseBgKey !== k) { houseBgKey = k; houseBg = buildHouseIsoBg(); } } // พื้น/วอลเปเปอร์เปลี่ยน = วาดพื้นหลังห้องใหม่
function applyFurnOp(m) { // ข้อความ furn จากเซิร์ฟเวอร์: set = วาง/ย้าย/หมุนชิ้นหนึ่ง • del = เก็บออก
  if (build.on && inMyHouse()) pushUndo(m);
  if (m.op === 'del') { furn.delete(m.i); if (build.pick === m.i) build.pick = null; }
  else if (m.op === 'set') furn.set(m.o.i, m.o);
  rebuildRects(); if (build.on) renderBuild();
}
function resetScene() { // กลับไปแมพเมืองฝั่งเว็บ (ตอนเซิร์ฟเวอร์ส่งฉากเมือง หรือเข้าเกมใหม่)
  if (inTown()) return;
  if (cave) { setSceneRows(townRows); townRows = null; cave = false; caveFlr = 0; oreK.clear(); oreS.clear(); doorLatch = true; base = townCache.base; baseHi = townCache.baseHi; miniBase = townCache.mini; townCache = null; if (townDirty) { base = buildBase(); miniBase = makeMiniBase(); townDirty = false; } return; }
  doorLatch = true; undoStack.length = 0; setSceneRows(townRows); furn.clear(); houseRects = []; scene = null; houseInfo = null; townRows = null; build.on = false; build.pick = null;
  if (townDirty) { base = buildBase(); miniBase = makeMiniBase(); townDirty = false; }
}
function applyScene(m) {
  walk = null; fg = null; $('fgauge').classList.add('hidden'); ft = null; ftHold = false; $('ffight').classList.add('hidden'); hidePicker();
  if (m.cave) { // ถ้ำเหมือง: แมพบนลงมุมสูงเหมือนเมือง ใช้พื้น/ผนังวาดเอง (ไม่ใช่ไอโซเมตริกแบบบ้าน)
    if (!cave) { townRows = MAP.slice(); townCache = { base, baseHi, mini: miniBase }; }
    setSceneRows(Shared.makeCaveMap(m.cave)); cave = true; caveFlr = m.cave; scene = null; houseInfo = null; build.on = false; build.pick = null;
    oreK.clear(); oreS.clear(); for (const [ox, oy, k, sz] of m.ores || []) { MAP[oy][ox] = T.ORE; oreK.set(ox + ',' + oy, k); oreS.set(ox + ',' + oy, sz | 0); }
    seaEnd = inSea() ? m.until || 0 : 0;
    if (inSea()) { if (inOcean()) buildOceanBase(); else buildSeaBase(); selTool = 'rod'; ls.set('mw_tool', 'rod'); slot = 0; renderHud(); }
    else { buildCaveBase();
    if (pickLevel()) { selTool = 'pick'; ls.set('mw_tool', 'pick'); slot = 0; renderHud(); } }
  } else if (m.sc) {
    if (inTown()) townRows = MAP.slice();
    setSceneRows(Shared.makeHouseMap()); furn.clear();
    for (const it of m.items || []) furn.set(it.i, it);
    rebuildRects();
    scene = m.sc; houseInfo = { owner: m.owner, mine: !!m.mine }; build.on = false; build.pick = null;
    houseSt = Object.assign({ fl: 'oak', wp: 'cream' }, m.st || {}); if (!houseGrid) houseGrid = buildHouseGrid(); syncHouseBg();
  } else resetScene();
  const old = me; players.clear();
  for (const q of m.players) { if (q.id === myId) { old.x = old.tx = m.x; old.y = old.ty = m.y; old.sit = false; old.fs = 0; old.cp = null; players.set(myId, old); } else players.set(q.id, mkPlayer(q)); }
  me = players.get(myId); updateOnline(); updateHouseUi(); renderBuild(); closePlots();
  if (inMyHouse()) toggleBuild(true); // เข้าบ้านตัวเองแล้วเปิดเมนูตกแต่งให้เลย
  // เปลี่ยนฉาก: ตัดเสียงกับคนฉากเก่าแล้วโทรหาทุกคนในฉากใหม่ (ผู้เล่นเดิมจะรับสายเองผ่าน onRtc)
  [...peers.keys()].forEach(id => { if (id !== callWith) closePeer(id); }); // สายโทรส่วนตัวยังต่ออยู่ข้ามฉาก
  players.forEach((q, id) => { if (id !== myId && id !== callWith) callPeer(id); });
  if (callWith && !peers.has(callWith)) callPeer(callWith);
}
function updateHouseUi() {
  $('houseBtn').dataset.lbl = inMyHouse() ? 'ตกแต่ง' : 'บ้านฉัน';
  $('houseBtn').title = inMyHouse() ? 'โหมดตกแต่งบ้าน (H)' : 'เข้าบ้านตัวเอง (H)';
  $('mini').style.display = scene || cave ? 'none' : ''; // ในบ้านไม่ใช้แผนที่ย่อ
}
const enterHouse = who => send({ t: 'house', a: 'enter', who: who || '' });
const homeAction = () => { if (inMyHouse()) toggleBuild(); else enterHouse(); }; // อยู่ในบ้านตัวเอง = เปิด/ปิดโหมดตกแต่ง • ที่อื่น = เข้าบ้านตัวเอง
function toggleBuild(on) {
  if (on === undefined) on = !build.on;
  if (on && !inMyHouse()) { enterHouse(); return; }
  build.on = on; build.erase = false; build.pick = null; build.rot = 0; undoStack.length = 0; touchAim = null; dragNew = null;
  if (on && !build.sel && furnKeys().length) build.sel = furnKeys()[0].slice(5);
  renderBuild();
}
function renderBuild() {
  const el = $('build'); el.classList.toggle('dragging', !!dragNew); el.classList.toggle('hidden', !build.on); document.body.classList.toggle('building', build.on);
  $('houseBtn').style.opacity = build.on ? 1 : .8;
  if (!build.on) return;
  const ks = furnKeys();
  if (build.sel && !(inv['furn_' + build.sel] > 0)) build.sel = (ks[0] || '').slice(5) || null;
  if (build.pick != null && !furn.has(build.pick)) build.pick = null;
  const pk = build.pick != null ? furn.get(build.pick) : null;
  const fd = build.sel && FURN[build.sel], pd = pk && FURN[pk.f];
  const hint = build.erase ? '🧹 แตะของที่จะเก็บคืนเข้ากระเป๋า'
    : fd ? `${fd.emoji} ${fd.name}: ${isTouch ? 'ลากลงห้อง (ปล่อยนิ้วเพื่อวาง) หรือแตะที่' : 'คลิกที่'}${fd.wall ? 'ผนัง' : 'พื้น'}เพื่อวาง${fd.small ? ' • ของเล็กวางบนโต๊ะ/เตียงได้' : ''}`
    : pd ? `${pd.emoji} ${pd.name}: ${isTouch ? 'ลากไปปล่อย หรือแตะที่ใหม่เพื่อวาง' : 'ขยับเมาส์จัดตำแหน่ง แล้วคลิกอีกครั้งเพื่อวาง'} • หมุน/เก็บคืนได้ที่ปุ่ม`
    : ks.length ? (isTouch ? 'ลากของในห้องเพื่อย้าย • ลากของจากรายการลงห้อง' : 'คลิกของในห้องเพื่อหยิบ แล้วคลิกอีกครั้งเพื่อวาง • หรือเลือกของจากรายการ') : 'ยังไม่มีเฟอร์นิเจอร์ ไปซื้อที่ 🛋️ ร้านเฟอร์นิเจอร์ (แถวบนสุด ขวามือของลานตู้เกม)';
  const cats = [['living', '🛋️ นั่งเล่น'], ['bedroom', '🛏️ ห้องนอน'], ['kitchen', '🍳 ห้องครัว'], ['study', '📚 โชว์/ทำงาน'], ['decor', '🖼️ ตกแต่ง'], ['divider', '🪟 ฉากกั้น'], ['craft', '🔨 ประดิษฐ์'], ['rare', '⭐ พิเศษ']];
  const styleTabs = [['floor', '🟫 พื้นบ้าน'], ['wall', '🧱 วอลเปเปอร์']], isStyle = build.tab === 'floor' || build.tab === 'wall';
  const tab = isStyle || (build.tab && cats.some(c => c[0] === build.tab)) ? build.tab : 'living';
  const shown = ks.filter(k => (FURN[k.slice(5)].cat || 'other') === tab);
  const kk = t => isTouch ? '' : ` <small class="bkey">${t}</small>`;
  const hintTxt = isStyle ? `🏠 แตะแบบที่ชอบเพื่อเปลี่ยน${tab === 'floor' ? 'พื้นบ้าน' : 'วอลเปเปอร์'}ทันที (เปลี่ยนได้ฟรีไม่จำกัด)` : `🏠 ${hint}`;
  el.innerHTML = `<div class="bhint">${hintTxt}</div>`
    + `<div class="btools"><button class="btn small" data-rot="1" title="หมุน (R)">🔄<span class="blbl"> หมุน${kk('R')}</span></button>`
    + `<button class="btn small muted" data-undo="1" title="เลิกทำ (Ctrl+Z)"${undoStack.length ? '' : ' disabled'}>↩️<span class="blbl"> เลิกทำ${kk('Z')}</span></button>`
    + `<button class="btn small${!build.erase && !build.sel ? ' on' : ''}" data-edit="1" title="เลือก/ย้ายของในห้อง">🖐️<span class="blbl"> เลือก/ย้าย</span></button>`
    + (pk ? `<button class="btn small" data-pickdel="1" title="เก็บชิ้นนี้ (Delete)">🧹<span class="blbl"> เก็บชิ้นนี้${kk('Del')}</span></button>` : '')
    + `<button class="btn small${build.erase ? ' on' : ''}" data-erase="1" title="โหมดเก็บคืน: แตะของที่จะเก็บ">🗑️<span class="blbl"> เก็บคืน</span></button><button class="btn small done" data-bexit="1" title="เสร็จ ออกจากโหมดตกแต่ง">✔<span class="blbl"> เสร็จ</span></button></div>`
    + `<div class="btabs">` + styleTabs.map(([c, n]) => `<button class="btn small${c === tab ? ' on' : ''}" data-btab="${c}">${n}</button>`).join('') + cats.map(([c, n]) => { const cnt = ks.filter(k => (FURN[k.slice(5)].cat || 'other') === c).length; return cnt ? `<button class="btn small${c === tab ? ' on' : ''}" data-btab="${c}">${n}</button>` : ''; }).join('') + `</div>`
    + `<div class="bitems">` + (isStyle ? styleItems(tab) : shown.length ? shown.map(k => { const f = k.slice(5); return `<button class="btn small${!build.erase && build.sel === f ? ' on' : ''}" data-bf="${f}" title="${FURN[f].name}">${FURN[f].emoji}<span class="blbl"> ${FURN[f].name}</span> <small>×${inv[k]}</small></button>`; }).join('') : '<small style="opacity:.7">ไม่มีของในหมวดนี้</small>') + `</div>`
    + (isTouch ? '' : '<div class="bkeys">R หมุน • Del เก็บ • Ctrl+Z เลิกทำ • Esc ยกเลิกที่เลือก • ล้อเมาส์ซูม • ปุ่มขวาลากเลื่อน</div>');
  el.querySelectorAll('[data-sty]').forEach(b => b.onclick = () => { const [k, v] = b.dataset.sty.split(':'); send({ t: 'house', a: 'style', k, v }); playSfx('click'); });
  el.querySelectorAll('[data-btab]').forEach(b => b.onclick = () => { build.tab = b.dataset.btab; playSfx('click'); renderBuild(); });
  el.querySelectorAll('[data-bf]').forEach(b => { b.onclick = () => { if (performance.now() - bfSuppress < 400) return; build.sel = b.dataset.bf; build.erase = false; build.pick = null; playSfx('click'); renderBuild(); }; bindDragNew(b, b.dataset.bf); });
  el.querySelector('[data-undo]').onclick = undoBuild;
  el.querySelector('[data-edit]').onclick = () => { build.sel = null; build.erase = false; playSfx('click'); renderBuild(); };
  el.querySelector('[data-rot]').onclick = rotateBuild;
  if (pk) el.querySelector('[data-pickdel]').onclick = () => { send({ t: 'house', a: 'remove', i: build.pick }); build.pick = null; };
  el.querySelector('[data-erase]').onclick = () => { build.erase = !build.erase; if (build.erase) { build.sel = null; build.pick = null; } playSfx('click'); renderBuild(); };
  el.querySelector('[data-bexit]').onclick = () => toggleBuild(false);
}
function styleItems(tab) { // ตัวอย่างพื้น/วอลเปเปอร์ให้เลือก (สีจากตารางใน shared.js)
  const isF = tab === 'floor', tbl = isF ? Shared.HOUSE_FLOORS : Shared.HOUSE_WALLS, order = isF ? Shared.HOUSE_FLOOR_ORDER : Shared.HOUSE_WALL_ORDER, cur = isF ? houseSt.fl : houseSt.wp;
  return order.map(id => {
    const o = tbl[id], bg = isF ? (o.kind === 'plank' ? `linear-gradient(90deg,${o.c[0]} 0 50%,${o.c[1]} 50% 75%,${o.c[2]} 75%)` : o.kind === 'tile' ? `conic-gradient(${o.c[0]} 25%,${o.c[1]} 0 50%,${o.c[0]} 0 75%,${o.c[1]} 0)` : `repeating-linear-gradient(0deg,${o.c[0]} 0 3px,${o.c[1]} 3px 6px)`) : `linear-gradient(${o.up[0]} 0 55%,${o.rail} 55% 62%,${o.lo[0]} 62%)`;
    return `<button class="btn small swatch${id === cur ? ' on' : ''}" data-sty="${isF ? 'floor' : 'wall'}:${id}" title="${o.name}"><i style="background:${bg}"></i><span class="blbl"> ${o.name}</span></button>`;
  }).join('');
}
function rotateBuild() { // หมุนชิ้นที่เลือกไว้ หรือหมุนทิศของชิ้นที่กำลังจะวาง
  if (!build.on) return;
  if (build.pick != null) send({ t: 'house', a: 'rot', i: build.pick });
  else if (build.sel) { build.rot = build.rot ? 0 : 1; playSfx('click'); }
}
function bindDragNew(btn, f) { // ลากของจากรายการลงห้อง: เงาตามนิ้ว/เมาส์ ปล่อยแล้ววาง (ปล่อยบนเมนู = ยกเลิก)
  btn.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const sx = e.clientX, sy = e.clientY, id = e.pointerId, tray = $('build').offsetWidth > innerWidth * 0.7; let on = false;
    const done = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel); };
    const mv = ev => {
      if (ev.pointerId !== id) return;
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!on) { // แถบล่าง: ต้องลากขึ้น (ลากข้างคือเลื่อนรายการ) • แผงข้าง: ลากไปทางห้อง
        if (Math.hypot(dx, dy) < 10 || (isTouch && (tray ? !(dy < 0 && -dy > Math.abs(dx) * 0.8) : !(dx < 0 && -dx > Math.abs(dy) * 0.8)))) return;
        on = true; build.sel = f; build.erase = false; build.pick = null; dragNew = { x: ev.clientX, y: ev.clientY }; try { btn.setPointerCapture(id); } catch (_) {}
        if (navigator.vibrate) navigator.vibrate(8); renderBuildFlags();
      }
      dragNew.x = ev.clientX; dragNew.y = ev.clientY;
    };
    const up = ev => {
      if (ev.pointerId !== id) return; done();
      if (!on) return;
      bfSuppress = performance.now();
      const d = dragNew; dragNew = null;
      if (d && document.elementFromPoint(ev.clientX, ev.clientY) === canvas) { const [ax, ay] = isoPtr(ev); buildClick(ax, ay, null); }
      renderBuild();
    };
    const cancel = ev => { if (ev.pointerId !== id) return; done(); dragNew = null; if (on) renderBuild(); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', cancel);
  });
}
const renderBuildFlags = () => { if ($('build')) $('build').classList.toggle('dragging', !!dragNew); };
function zoomBy(f) { if (scene && build.on) { bz.z = Math.max(1, Math.min(3, bz.z * f)); resize(); } else setZoom(userZoom * f); }
$('houseBtn').onclick = homeAction;
// บ้านเพื่อน: ลีดเดอร์บอร์ดเรียงตามมูลค่าเฟอร์นิเจอร์ในบ้าน (ราคาร้าน) แล้วตามจำนวนชิ้น • กดชื่อเพื่อเข้าไปเยี่ยม
const plotsShown = () => !$('plots').classList.contains('hidden');
function openPlots() { closeOthers('plots'); $('plots').classList.remove('hidden'); send({ t: 'house', a: 'board' }); renderPlots(); }
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
function openHomeChoice() { walk = null; closeOthers('homeChoice'); $('homeChoice').classList.remove('hidden'); }
function closeHomeChoice() { $('homeChoice').classList.add('hidden'); }
$('hcOwn').onclick = () => { closeHomeChoice(); enterHouse(); };
$('hcFriend').onclick = () => { closeHomeChoice(); openPlots(); };
$('hcNo').onclick = closeHomeChoice;
$('homeChoice').addEventListener('pointerdown', e => { if (e.target === $('homeChoice')) closeHomeChoice(); });
const inHouseBld = (tx, ty) => tx >= Shared.HOUSE_BLD.x0 && tx <= Shared.HOUSE_BLD.x1 && ty >= Shared.HOUSE_BLD.y0 && ty <= Shared.HOUSE_BLD.y1;

// กล่องของขวัญต้อนรับ (เข้าเกมครั้งแรก): กดเปิด → กล่องสั่น → เห็นของที่ได้ (เซิร์ฟเวอร์ให้ของและสวมให้ตอนเปิด)
let giftItem = '';
function showGift(item) { giftItem = item; $('giftBox').textContent = '🎁'; $('giftTitle').textContent = '🎁 ของขวัญต้อนรับ!'; $('giftText').textContent = 'เพื่อนใหม่ของเมืองได้กล่องของขวัญ 1 กล่อง'; $('giftBtn').textContent = 'เปิดกล่อง!'; $('giftBtn').disabled = false; $('gift').classList.remove('hidden'); }
$('giftBtn').onclick = () => {
  if (!giftItem) { $('gift').classList.add('hidden'); return; }
  const item = giftItem, info = itemInfo(item); giftItem = ''; $('giftBtn').disabled = true; $('giftBox').classList.add('shake'); playSfx('click');
  setTimeout(() => {
    $('giftBox').classList.remove('shake'); $('giftBox').textContent = info ? info.emoji : '🎉';
    $('giftTitle').textContent = '🎉 ได้ของแล้ว!'; $('giftText').textContent = info ? `${info.name} (สวมให้แล้ว เปลี่ยนได้ที่ร้านเสื้อผ้า)` : '';
    $('giftBtn').textContent = 'ไปเริ่มเล่นกัน 🌱'; $('giftBtn').disabled = false;
    send({ t: 'gift' });
  }, 800);
};
// ป้ายทักคนใหม่: มีคนเข้าเมืองครั้งแรก กดโบกมือ/ส่งดอกไม้ (ข้อความขึ้นแชทให้ทุกคนเห็น) ปิดเองใน 30 วินาที
let greetId = 0, greetT = 0;
function showGreet(id, name) { greetId = id; $('greetText').textContent = `👋 ${name} เพิ่งมาถึงเมืองครั้งแรก! ทักทายหน่อยไหม`; $('greet').classList.remove('hidden'); clearTimeout(greetT); greetT = setTimeout(() => $('greet').classList.add('hidden'), 30000); }
const greetSend = k => { if (greetId) send({ t: 'greet', id: greetId, k }); greetId = 0; $('greet').classList.add('hidden'); };
$('greetWave').onclick = () => greetSend('wave');
$('greetFlower').onclick = () => greetSend('flower');
$('greetNo').onclick = () => { greetId = 0; $('greet').classList.add('hidden'); };

// การ์ดผลงานชาเลนจ์ถังน้ำ (แชร์ลงโซเชียล): ตัวละครของเราขยาย 4 เท่า + ชาเลนจ์ + เวลา + ลิงก์เกม
const esc0 = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
function drawChCard(cv, d, c) {
  if (!cv || !me) return; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  const g = x.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, '#8fd0ff'); g.addColorStop(1, '#bfe8a6'); x.fillStyle = g; x.fillRect(0, 0, 600, 320);
  x.fillStyle = '#7bc65a'; x.fillRect(0, 250, 600, 70); x.fillStyle = '#2a1b14'; x.fillRect(0, 248, 600, 3); x.lineWidth = 6; x.strokeStyle = '#2a1b14'; x.strokeRect(3, 3, 594, 314);
  x.save(); x.translate(130, 230); x.scale(4, 4); PixelChar.draw(x, Object.assign({}, me, { x: 0, y: 0, dir: 0, moving: false, sit: null, wet: false }), 0); x.restore();
  x.fillStyle = '#2a1b14'; x.font = 'bold 30px sans-serif'; x.fillText('🪣 ชาเลนจ์ถังน้ำ', 240, 60);
  x.font = 'bold 22px sans-serif'; x.fillText(`${me.name} ทำสำเร็จ!`, 240, 100);
  x.font = '20px sans-serif'; x.fillText(`${d.emoji} ${d.text}`, 240, 140); x.fillText(`⏱️ ใน ${Math.ceil(c.ms / 60000)} นาที`, 240, 172);
  x.font = 'bold 20px sans-serif'; x.fillStyle = '#c0392b'; x.fillText('ใครกล้ารับต่อ? 48 ชม. ไม่งั้นโดนราดน้ำ 💦', 240, 212);
  x.fillStyle = '#2a1b14'; x.font = 'bold 18px sans-serif'; x.fillText('🌾 My World • ' + location.host, 240, 290);
}

// กล่องยืนยันในเกม แทน confirm() ที่บางเบราว์เซอร์มือถือ/เว็บวิวไม่แสดง
let askYes = null;
function ask(text, yes) { $('askText').textContent = text; askYes = yes; $('ask').classList.remove('hidden'); }
$('askYes').onclick = () => { $('ask').classList.add('hidden'); const f = askYes; askYes = null; if (f) f(); };
$('askNo').onclick = () => { $('ask').classList.add('hidden'); askYes = null; };
// ปุ่มย่อ/ขยายแถบเมนูด้านบน (ย่อแล้วเหลือแค่เหรียญ ความอิ่ม และปุ่มขยาย) จำค่าไว้ในเครื่อง
// เมนูหลัก: ปุ่มที่ใช้ไม่บ่อยซ่อนในเมนู (ปุ่มเดิมทุกตัวยังอยู่ ตัวจัดการกดเดิมทำงานเหมือนเดิม)
const menuShown = () => !$('hudMenu').classList.contains('hidden');
function fitMenu() { const m = $('hudMenu'); if (m.classList.contains('hidden')) return; const keepScroll = m.scrollTop; m.style.maxHeight = ''; setTimeout(() => { m.scrollTop = keepScroll; }, 0); // เก็บตำแหน่งเลื่อนไว้ (ล้าง maxHeight ทำให้เมนูกระโดดตอนกดปุ่มความละเอียดรัวๆ)
  const top = m.getBoundingClientRect().top, sc = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1); m.style.maxHeight = Math.max(120, Math.floor((innerHeight - top - 12) / (document.body.classList.contains('touch') ? 1 : sc))) + 'px'; } // กล่องเมนูสูงไม่เกินพื้นที่ใต้ตำแหน่งที่เริ่มจริง เลื่อนถึงแถวท้ายสุดได้
addEventListener('resize', fitMenu);
function setMenu(on) { $('hudMenu').classList.toggle('hidden', !on); document.body.classList.toggle('menu-open', on); $('menuBtn').setAttribute('aria-expanded', on ? 'true' : 'false'); if (on) fitMenu(); }
$('menuBtn').onclick = () => setMenu(!menuShown());
// ปุ่มในเมนูบนมือถือที่ย้ายมาจากแถบบน: กดแล้วทำงานเหมือนปุ่มต้นทาง (เมนูปิดให้อัตโนมัติจากตัวดักคลิกด้านบน)
$('bagMenu').onclick = () => $('bagBtn').click();
$('chatMenu').onclick = () => $('chatBtn').click();
$('micMenu').onclick = () => $('micBtn').click();
$('onlineMenu').onclick = () => $('online').click();
$('hudMenu').addEventListener('click', e => { const b = e.target.closest('.btn'); if (b && !['zoomInBtn', 'zoomOutBtn', 'spkBtn', 'sndTog', 'resBtn', 'perfBtn', 'perfCopy'].includes(b.id)) setMenu(false); }); // เลือกแล้วปิดเมนู ยกเว้นปุ่มที่กดซ้ำได้
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
  el.classList.toggle('low', hunger <= 40); // มือถือโชว์ความหิวตอนต่ำเท่านั้น (ดู index.html)
  el.title = 'ความอิ่ม (0 = หิวจนไม่มีแรง) กดเพื่อดูอาหารในตัวและกิน';
  if (bagShown() && bagTab === 'eat') renderBag();
  if (bagShown()) renderBag();
}
function updateOnline() { $('online').textContent = '👥 ' + roster.size + (mute.all ? ' 🔇' : ''); $('onlineMenu').dataset.lbl = 'ออนไลน์ ' + roster.size; }
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
  if (s.id === 'seed') return { e: CROPS[selSeed].emoji, n: 'เมล็ด' + CROPS[selSeed].name, cnt: inv['seed_' + selSeed] || 0, lock: !!plantLock(selSeed) };
  if (s.id === 'feed') { const f = itemInfo(selFeed); return { e: f.emoji, n: f.name, cnt: inv[selFeed] || 0 }; }
  return { e: s.e, n: s.n, cnt: null };
}
// ข้อจำกัดการปลูกตามฤดู (กติกาอยู่ใน Shared • เซิร์ฟเวอร์ตัดสินจริง ฝั่งนี้แค่โชว์ป้าย)
const seasonNow = () => Date.now() + timeOffset;
const waitTxt = ms => (Shared.seasonWaitText ? Shared.seasonWaitText(ms) : fmtLeft(ms));
function plantLock(c) { // null = ปลูกได้ตอนนี้ • ไม่งั้น { s: ฤดูถัดไปที่ปลูกได้, txt: 'อีก ...' }
  const t = seasonNow(); if (!Shared.canPlant || Shared.canPlant(c, t)) return null;
  const w = Shared.plantWait ? Shared.plantWait(c, null, t) : null;
  return { s: w && w.s, txt: w ? waitTxt(w.ms) : '' };
}
function offSeason(c) { // พืชนอกฤดู (ปลูกได้ แต่ติดผลแค่ตามโอกาส) → ข้อความเตือน • ในฤดู = ''
  if (!Shared.inSeason || !Shared.OFFSEASON || Shared.inSeason(c, seasonNow())) return '';
  return '🍂 นอกฤดู ติดผลน้อย (~' + Math.round(Shared.OFFSEASON.chance * 100) + '%)';
}
function cropSeasonTag(c) { // ฤดูที่ปลูกได้ของพืชนี้ (null = ทุกฤดู)
  const S = Shared.SEASONS; if (!S || CROPS[c].lv <= (S.freeLv || 0)) return null;
  return S.list.find(x => x.crops.includes(c)) || null;
}
function seasonInfoText(short) { // ฤดูปัจจุบัน + นับถอยหลัง + พืชที่ปลูกได้เฉพาะฤดูนี้ (ใช้เป็นทูลทิปและ toast ตอนแตะนาฬิกา)
  const t = seasonNow(), se = Shared.seasonAt(t); if (!se.on) return '🌱 ยังไม่เข้าฤดูกาล ปลูกอะไรก็ได้';
  const free = (Shared.SEASONS.freeLv || 0), list = se.s.crops.filter(c => CROPS[c] && CROPS[c].lv > free).map(c => CROPS[c].name), names = list.join(' ');
  if (short) return `${se.s.emoji} ${se.s.name} เหลือ ${waitTxt(se.end - t)}${list.length ? '\nปลูกได้: ' + list.slice(0, 2).join(' ') + (list.length > 2 ? ' +' + (list.length - 2) : '') : ''}`; // toast บนมือถือแคบ ย่อเหลือ 2 ชื่อ
  return `${se.s.emoji} ${se.s.name} เหลือ ${waitTxt(se.end - t)}${names ? ' • ปลูกได้: ' + names : ''}${free ? ' • Lv≤' + free + ' ปลูกได้ทุกฤดู' : ''}`;
}
const GEAR_SETS = { hoe: [Shared.HOES, Shared.HOE_EMOJI, 'farm'], pail: [Shared.PAILS, Shared.PAIL_EMOJI, 'animal'], pan: [Shared.PANS, Shared.PAN_EMOJI, 'cook'] }; // อุปกรณ์ติดตัว 10 ระดับ (ระดับ 1 ฟรี ไม่มีไอเทม)
const gearTierOf = t => t === 'hoe' ? Shared.hoeTier(inv) : t === 'pail' ? Shared.pailTier(inv) : t === 'pan' ? Shared.panTier(inv) : 1;
function toolInfo(t) { // ข้อมูลเครื่องมือในช่อง 1: e = ไอคอน, n = ชื่อเต็ม, sub = บรรทัดย่อในเมนู, cnt = ตัวเลขมุมช่อง (null = ไม่แสดง)
  if (t === 'hand') return { e: '✋', n: 'มือเปล่า (เก็บผลผลิต เปิดร้าน นั่ง)', sub: 'เก็บ/เปิดร้าน', cnt: null };
  if (t === 'hoe') { const ht = Shared.hoeTier(inv); return { e: '⛏️', n: `${Shared.HOES[ht].name} ระดับ ${ht}/${Shared.GEAR_MAX} (ขุดดิน)`, sub: `ระดับ ${ht}/${Shared.GEAR_MAX}`, cnt: null }; } // ไอคอนคง ⛏️ เพราะท่าทาง/ที่ถือผูกกับอีโมจิ (ภาพจอบใหม่รอขั้น 2)
  if (t === 'water') { const c = CANS[canTier(inv)], cap = buffOn('bigcan') ? Math.round(c.cap * BUFFS.bigcan.capMul) : c.cap; return { e: c.emoji, n: `${c.name} (น้ำ ${wtr}/${cap} • แตะสระเพื่อตักน้ำ)`, sub: `น้ำ ${wtr}/${cap}`, cnt: wtr }; }
  if (t === 'rod') { const b = itemInfo(selBait); return { e: Shared.ROD_EMOJI[rodLevel()] || '🎣', n: RODS[rodLevel()].name + ' ระดับ ' + rodLevel() + '/' + Shared.ROD_MAX + ' • ' + b.name.split(' ')[0] + ' ×' + (inv[selBait] || 0), sub: `ระดับ ${rodLevel()}/${Shared.ROD_MAX} • เหยื่อ ×${inv[selBait] || 0}`, cnt: inv[selBait] || 0 }; }
  if (t === 'pick') { const pk = pickLevel(); return { e: pk ? Shared.PICK_EMOJI[pk] : '⚒️', n: pk ? Shared.PICKS[pk].name : 'อุปกรณ์ขุด (ยังไม่มี ซื้อที่ร้านช่างเหมือง)', sub: pk ? Shared.PICKS[pk].name : 'ยังไม่มี', cnt: pk ? null : 0 }; }
  const ax = axeLevel(); return { e: Shared.AXE_EMOJI[ax] || '🪓', n: ax ? AXES[ax].name + ' ระดับ ' + ax + '/' + Shared.AXE_MAX : 'ขวาน (ยังไม่มี ซื้อที่ร้านช่างไม้)', sub: ax ? 'ระดับ ' + ax + '/' + Shared.AXE_MAX : 'ยังไม่มี', cnt: ax ? null : 0 };
}
function renderHud() {
  $('coins').textContent = '🪙 ' + (inv.coin || 0);
  const hb = $('hotbar'); hb.innerHTML = '';
  SLOTS.forEach((s, i) => {
    const info = slotInfo(i), d = document.createElement('div');
    d.className = 'slot' + (i === slot ? ' sel' : '');
    d.innerHTML = `<span class="k">${i + 1}</span>${info.e}${info.cnt === null ? '' : `<span class="n">${info.cnt}</span>`}${info.lock ? '<span class="lk" style="position:absolute;top:1px;right:2px;font-size:10px;line-height:1">🔒</span>' : ''}${s.pick ? '<span class="p">▾</span>' : ''}`;
    if (info.cnt === 0 || info.lock) d.style.opacity = .55; // เมล็ดนอกฤดู: หม่น แต่ยังเลือก/กด Action ได้ ให้เซิร์ฟเวอร์บอกเหตุผล
    d.onpointerdown = e => { e.stopPropagation(); pickSlot(i); };
    hb.appendChild(d);
  });
  const sk = slot + '|' + (SLOTS[slot].id === 'tool' ? selTool : SLOTS[slot].id === 'seed' ? selSeed : selFeed);
  if (sbSel !== null && sk !== sbSel) showSkillBar(); sbSel = sk; // เลือกอุปกรณ์/ช่องใหม่ → โชว์แถบอาชีพ
}
// แถบอาชีพลอยเหนือ hotbar: โชว์ตอนเลือกอุปกรณ์ที่ผูกอาชีพ และตอน XP อาชีพนั้นเพิ่ม แล้วค่อยๆ จางใน ~4 วิ (ตัวเลขเดียวกับแผงสถานะ)
const TOOL_SKILL = { hoe: 'farm', water: 'farm', rod: 'fish', axe: 'wood', pick: 'mine' };
function skillBarKey() { const s = SLOTS[slot].id; return s === 'tool' ? (toolLocked(selTool) ? '' : TOOL_SKILL[selTool] || '') : s === 'seed' ? 'farm' : s === 'feed' ? 'animal' : ''; }
let sbTimer = 0, sbSel = null;
function showSkillBar() {
  const k = skillBarKey(), el = $('skillbar'); if (!k) el.classList.remove('show'); if (!k || !SKILLS[k] || !$('picker').classList.contains('hidden')) return;
  const L = lvl(k), xp = skills[k] || 0, base = xpFor(L, k), need = L >= MAX_LV ? 0 : xpFor(L + 1, k) - base;
  const st = starsSt[k] || 0, M = Shared.MASTERY, nxt = st < M.max && L >= MAX_LV ? xpFor(MAX_LV, k) + (st + 1) * Shared.masteryXp(k) : 0;
  const pct = need ? Math.min(100, Math.round((xp - base) / need * 100)) : nxt ? Math.min(100, Math.round((xp - xpFor(MAX_LV, k) - st * Shared.masteryXp(k)) / Shared.masteryXp(k) * 100)) : 100;
  const num = need ? `${xp - base}/${need}` : nxt ? `XP ${xp.toLocaleString()}/${nxt.toLocaleString()}` : 'เต็ม';
  el.innerHTML = `<div class="r"><span><span class="e"></span> <span class="nm"></span></span><span class="lv"></span></div><div class="bar"><i style="width:${pct}%"></i></div><small class="num"></small>`;
  el.querySelector('.e').textContent = SKILLS[k].emoji; el.querySelector('.nm').textContent = SKILLS[k].name;
  el.querySelector('.lv').textContent = `Lv ${L}${L >= MAX_LV ? ' (สูงสุด)' : ''}${'⭐'.repeat(st)}`; el.querySelector('.num').textContent = num;
  el.classList.add('show'); clearTimeout(sbTimer); sbTimer = setTimeout(() => el.classList.remove('show'), 4000);
}
let lastHeld = null;
function heldEmoji() { const s = SLOTS[slot]; if (!s || s.id === 'hand' || (s.id === 'tool' && toolLocked(selTool))) return ''; return slotInfo(slot).e || ''; } // ช่องที่เลือกอยู่ → อีโมจิที่ถือ (ขวานที่ยังไม่มีไม่ถือ)
function pickSlot(i) {
  if (i === slot && SLOTS[i].pick) { $('picker').classList.contains('hidden') ? showPicker() : hidePicker(); return; }
  slot = i; hidePicker(); renderHud(); toast(`${slotInfo(i).e} ${slotInfo(i).n}`); playSfx('click');
  if (SLOTS[i].id === 'tool') showPicker(); // กดช่อง 1 = เมนูเลือกเครื่องมือเด้งขึ้นเลย
}
function hidePicker() { $('picker').classList.add('hidden'); }
function showPicker() {
  const s = SLOTS[slot].id, el = $('picker'); $('skillbar').classList.remove('show');
  if (s === 'tool') { // เมนูเครื่องมือ: จอบ/บัวรดน้ำ/เบ็ด/ขวาน/มือเปล่า + แถวเหยื่อตกปลา (เลือกเหยื่อ = ถือเบ็ดให้เลย)
    el.innerHTML = '';
    for (const t of TOOL_LIST) {
      const inf = toolInfo(t), locked = toolLocked(t), b = document.createElement('button');
      b.className = 'opt' + (selTool === t ? ' sel' : ''); b.disabled = locked; b.innerHTML = `<b>${inf.e}</b>${TOOL_SHORT[t]}<br>${locked ? '🔒 ยังไม่มี' : inf.sub}`;
      b.onclick = e => { e.stopPropagation(); selTool = t; ls.set('mw_tool', t); hidePicker(); renderHud(); showSkillBar(); toast(`${inf.e} ${TOOL_SHORT[t]}`); playSfx('click'); };
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
  let keysList = s === 'seed' ? Shared.CROP_IDS().map(c => 'seed_' + c).concat(Object.keys(CROPS).filter(c => CROPS[c].legacy && (inv['seed_' + c] || 0) > 0).map(c => 'seed_' + c)) : s === 'rod' ? BAIT_KEYS : FEEDS;
  const isLocked = k => { const i = itemInfo(k); return !!(i.lv && lvl(i.skill) < i.lv && !(inv[k] || 0)); };
  if (isTouch) keysList = keysList.filter(k => !isLocked(k)).concat(keysList.filter(isLocked)); // มือถือ: ของที่ใช้ได้ขึ้นก่อน ของที่ยังล็อกไปท้ายแผง (ลำดับเดิมในแต่ละกลุ่ม)
  el.innerHTML = '';
  keysList.forEach(k => {
    const info = itemInfo(k), have = inv[k] || 0, locked = info.lv && lvl(info.skill) < info.lv && !have;
    const b = document.createElement('button');
    b.className = 'opt' + ((s === 'seed' ? 'seed_' + selSeed : s === 'rod' ? selBait : selFeed) === k ? ' sel' : ''); b.disabled = !!locked;
    const sl = s === 'seed' && !locked ? plantLock(k.slice(5)) : null; // นอกฤดู: หม่น + 🔒 แต่ยังเลือกได้
    b.innerHTML = `<b>${info.emoji}</b>${s === 'seed' ? CROPS[k.slice(5)].name : info.name.split(' ')[0]}<br><span>${locked ? '🔒 Lv' + info.lv : (s === 'seed' && offSeason(k.slice(5)) ? '🍂 ' : '') + (sl ? '🔒' + (sl.s ? sl.s.emoji : '') + ' ' : '') + '×' + have}</span>`;
    if (s === 'seed' && !locked && offSeason(k.slice(5))) b.title = offSeason(k.slice(5));
    b.style.minHeight = '64px';
    if (sl) b.style.opacity = .6;
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
const modalOpen = () => ['bag', 'shop', 'people', 'archub', 'status', 'quest', 'ach', 'bug', 'arcade', 'trade', 'cinema', 'town', 'admin', 'mapEdit', 'plots', 'homeChoice', 'report', 'ask', 'gift', 'pinBox'].some(id => !$(id).classList.contains('hidden'));
// เปิดหน้าต่างใหม่ = ปิดหน้าต่างอื่นในกลุ่มนี้ + เมนูหลัก (ไม่แตะ ask/pinBox/gift/trade/arcade/cinema/admin/mapEdit ที่มีผลข้างเคียง)
function closeOthers(keep) {
  const cl = { bag: closeBag, shop: closeShop, people: closePeople, archub: closeHub, status: closeStatus, bug: closeBug, quest: closeQuest, ach: closeAch, town: closeTown, plots: closePlots, homeChoice: closeHomeChoice };
  for (const id in cl) if (id !== keep && !$(id).classList.contains('hidden')) cl[id]();
  setMenu(false);
}
function openBag(tab) { closeOthers('bag'); if (tab) bagTab = tab; $('bag').classList.remove('hidden'); renderBag(); }
function closeBag() { $('bag').classList.add('hidden'); }
const bagShown = () => !$('bag').classList.contains('hidden');
$('bagBtn').onclick = () => (bagShown() && bagTab === 'items' ? closeBag() : openBag('items'));
$('statBtn').onclick = () => (bagShown() && bagTab === 'status' ? closeBag() : openBag('status'));
$('lookBtn').onclick = () => (bagShown() && bagTab === 'look' ? closeBag() : openBag('look'));
$('bookBtn').onclick = () => (bagShown() && bagTab === 'book' ? closeBag() : openBag('book'));
let volHold = false; // กำลังลากแถบเสียง ห้ามวาดแท็บใหม่ ไม่งั้นแถบหลุดมือ
addEventListener('pointerup', () => { volHold = false; }); addEventListener('pointercancel', () => { volHold = false; });
$('bagBody').addEventListener('pointerdown', e => { if (e.target.closest('[data-vol]')) volHold = true; });
const onVolInput = e => {
  const r = e.target.closest('[data-vol]'); if (!r) return;
  const v = Math.max(0, Math.min(1, (+r.value || 0) / 100)), which = r.dataset.vol;
  if (which === 'sfx') { sfxVol = v; ls.set('mw_sfxvol', String(v)); if (smaster) smaster.gain.value = sfxGain(); } else { musicVol = v; ls.set('mw_musvol', String(v)); }
  syncSndUi(r);
};
function syncSndUi(except) { // แถบเสียงในเมนู ☰ กับแท็บสถานะใช้ค่าเดียวกัน
  document.querySelectorAll('[data-vol]').forEach(r => { const v = r.dataset.vol === 'sfx' ? sfxVol : musicVol; if (r !== except) r.value = Math.round(v * 100); });
  document.querySelectorAll('[data-volv]').forEach(b => { b.textContent = Math.round((b.dataset.volv === 'sfx' ? sfxVol : musicVol) * 100) + '%'; });
  const t = $('sndTog'); if (t) t.textContent = sfxOn ? '🔊 เสียงเกม: เปิด' : '🔇 เสียงเกม: ปิด';
}
$('bagBody').addEventListener('input', onVolInput); $('sndPanel').addEventListener('input', onVolInput);
$('sndPanel').addEventListener('change', e => { if (e.target.closest('[data-vol=sfx]')) playSfx('coin'); });
$('sndTog').onclick = () => { sfxOn = !sfxOn; ls.set('mw_sfx', sfxOn ? '1' : '0'); if (!sfxOn) hornStopAll(); syncSndUi(); playSfx('coin'); };
$('bagBody').addEventListener('change', e => { if (e.target.closest('[data-vol=sfx]')) playSfx('coin'); });
setInterval(() => { if (bagShown() && bagTab === 'status' && !volHold && !(document.activeElement && document.activeElement.type === 'range')) renderBag(); }, 1000);
$('bagClose').onclick = closeBag;
$('bag').addEventListener('pointerdown', e => { if (e.target === $('bag')) closeBag(); });
document.querySelectorAll('.tab[data-tab]').forEach(t => t.onclick = () => { bagTab = t.dataset.tab; renderBag(); });
$('bagBody').addEventListener('click', e => {
  if (e.target.closest('[data-pinset]')) { showPinBox(pinSt); return; }
  { const b = e.target.closest('[data-star]'); if (b) { send({ t: 'star', skill: b.dataset.star }); return; } }
  { const sc = e.target.closest('[data-stat]'), ss = e.target.closest('[data-skillsel]'); if (!e.target.closest('button')) { if (sc) { statSel = statSel === 'c' + sc.dataset.stat ? '' : 'c' + sc.dataset.stat; renderBag(); return; } if (ss) { statSel = statSel === 's' + ss.dataset.skillsel ? '' : 's' + ss.dataset.skillsel; renderBag(); return; } } } // เมนูสถานะ: กดอันไหนก็โชว์รายละเอียดในหน้าเดิม ไม่ปิดหน้าต่าง กดอันอื่นต่อได้
  if (e.target.closest('[data-sfx]')) { sfxOn = !sfxOn; ls.set('mw_sfx', sfxOn ? '1' : '0'); if (!sfxOn) hornStopAll(); syncSndUi(); renderBag(); playSfx('coin'); return; }
  const sb = e.target.closest('[data-sub]'); if (sb) { bagSub = sb.dataset.sub; renderBag(); return; }
  const eb = e.target.closest('[data-eat]'); if (eb) { send({ t: 'eat', item: eb.dataset.eat }); return; }
  const ib = e.target.closest('[data-info]'); if (ib) { const k = ib.dataset.info, i = itemInfo(k); if (i) toast(`${i.emoji} ${i.name} ×${inv[k] || 0}${freshBadge(k).replace(/<[^>]+>/g, '')}` + (i.sell ? ` • ราคาขาย 🪙${i.sell}` : '') + (i.food ? ` • กินได้ +${i.food} ความอิ่ม` : '')); }
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
// ยานพาหนะ: ปุ่มบนแถบบน กดแล้วเลือกรถที่มีขี่ หรือกดลงรถ ไม่ต้องกลับไปร้านยานพาหนะ (ใช้ได้เฉพาะในเมือง เหมือนปุ่ม V)
let vehKey = '';
const setVehMenu = on => { $('vehMenu').classList.toggle('hidden', !on); $('vehBtn').setAttribute('aria-expanded', on ? 'true' : 'false'); };
function syncVehBtn() { // เรียกทุกเฟรม แต่แตะ DOM เฉพาะตอนสถานะเปลี่ยน
  const V = Shared.VEHICLES, own = me && inTown() ? Object.keys(V).filter(v => inv['veh_' + v] > 0) : [], cur = (me && me.veh) || '', key = own.join() + '|' + cur;
  if (key === vehKey) return; vehKey = key;
  const b = $('vehBtn');
  b.classList.toggle('hidden', !own.length); b.classList.toggle('on', !!cur);
  b.textContent = cur && V[cur] ? V[cur].emoji : own.length ? V[own[own.length - 1]].emoji : '🚲';
  if (!own.length) setVehMenu(false);
  $('vehMenu').innerHTML = '<div class="mtitle">🚲 ยานพาหนะ</div>' + own.map(v => `<button class="btn small${v === cur ? ' on' : ''}" data-v="${v}">${V[v].emoji} ${V[v].name}${v === cur ? ' ✅' : ''}</button>`).join('') + (cur ? '<button class="btn small off" data-v="">🚶 ลงรถ</button>' : '');
}
// แตรยานพาหนะ: ปุ่มบนจอ + ปุ่ม N (ขับรถ/จักรยาน/เรือเท่านั้น) กดค้าง = ดังยาวตลอดที่กด ปล่อย = หยุด (ไม่มีคูลดาวน์)
// เว็บ→เซิร์ฟเวอร์ {t:'horn', on:true|false} • เซิร์ฟเวอร์ broadcast {t:'horn', id, v, on} ให้คนในซีน (ข้ามของตัวเอง)
let hornKey = '', hornVoice = null, hornSrc = new Set(), hornWant = false, hornSent = false, hornSentAt = 0, hornTimer = 0, hornMaxT = 0;
const hornOthers = new Map(); // id → { h: เสียงต่อเนื่อง, v, tm: fail-safe timer }
const hornKind = () => me && me.veh && inTown() ? me.veh : me && inOcean() ? 'boat' : '';
function syncHornBtn() {
  const k = hornKind(), b = $('hornBtn');
  if (!k && hornSrc.size) hornRelease(true); // ลงจากพาหนะ/ปุ่มซ่อน = ปล่อยแตรเสมอ
  hornOthers.forEach((o, id) => { const p = players.get(id); if (!p || !me) { hornOtherStop(id); return; } o.h.setK(Math.max(0, 1 - Math.hypot(p.x - me.x, p.y - me.y) / TS / 22)); });
  if (k === hornKey) return; hornKey = k; b.classList.toggle('hidden', !k); b.textContent = k === 'car' ? '📢' : k === 'boat' ? '🚢' : '📣';
}
const HORN = { // คู่เสียงแตร: [ความถี่, ชนิดคลื่น], vol, lowpass
  car: { f: [[400, 'square'], [500, 'square']], vol: 0.2, lp: 2000 },
  boat: { f: [[130, 'sawtooth'], [98, 'sawtooth']], vol: 0.3, lp: 700, att: 0.06 },
  scooter: { f: [[620, 'square'], [780, 'square']], vol: 0.13, lp: 2200 },
  bike: { f: [[880, 'triangle'], [1320, 'triangle']], vol: 0.2, lp: 3000 },
};
function hornStart(v, k) { // เริ่มเสียงแตรต่อเนื่อง คืน handle { setK, stop } (ผ่าน smaster เคารพ sfxOn)
  if (!sfxOn) return { setK() {}, stop() {} };
  const c = sAudio(); if (!c) return { setK() {}, stop() {} };
  const d = HORN[v] || HORN.bike, t0 = c.currentTime, g = c.createGain(), f = c.createBiquadFilter(); let kk = k, done = false;
  f.type = 'lowpass'; f.frequency.value = d.lp; f.connect(g); g.connect(smaster);
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(Math.max(0.0002, d.vol * kk), t0 + (d.att || 0.015));
  const oscs = d.f.map(([fr, ty]) => { const o = c.createOscillator(); o.type = ty; o.frequency.value = fr; o.connect(f); o.start(t0); return o; });
  return {
    setK(x) { if (done || Math.abs(x - kk) < 0.01) return; kk = x; g.gain.setTargetAtTime(Math.max(0.0002, d.vol * kk), c.currentTime, 0.05); },
    stop() { if (done) return; done = true; const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0002, g.gain.value), t); g.gain.linearRampToValueAtTime(0.0001, t + 0.07); oscs.forEach(o => { try { o.stop(t + 0.1); } catch (e) { /* หยุดไปแล้ว */ } }); setTimeout(() => { try { g.disconnect(); } catch (e) { /* ตัดแล้ว */ } }, 250); },
  };
}
function hornOtherStart(id, v) {
  hornOtherStop(id); const p = players.get(id); if (!p || !me) return;
  const k = Math.max(0, 1 - Math.hypot(p.x - me.x, p.y - me.y) / TS / 22);
  hornOthers.set(id, { v, h: hornStart(v, k), tm: setTimeout(() => hornOtherStop(id), 6500) });
}
function hornOtherStop(id) { const o = hornOthers.get(id); if (!o) return; clearTimeout(o.tm); o.h.stop(); hornOthers.delete(id); }
function hornStopAll() { if (hornVoice) { hornVoice.stop(); hornVoice = null; } hornOthers.forEach((o, id) => hornOtherStop(id)); }
function hornFlush() { // ส่งสถานะล่าสุดไปเซิร์ฟเวอร์ ห่างกันอย่างน้อย ~50 ms (ส่งเฉพาะตอนสถานะเปลี่ยน)
  if (hornWant === hornSent) return;
  const wait = 50 - (performance.now() - hornSentAt);
  if (wait > 0) { if (!hornTimer) hornTimer = setTimeout(() => { hornTimer = 0; hornFlush(); }, wait); return; }
  hornSent = hornWant; hornSentAt = performance.now(); send({ t: 'horn', on: hornWant });
}
function hornPress(src) {
  if (!me || !hornKind()) return;
  const was = hornSrc.size > 0; hornSrc.add(src); if (was) return; // หลายนิ้ว: นิ้วแรกเริ่มเสียง นิ้วสุดท้ายที่ปล่อยจึงหยุด
  if (hornVoice) hornVoice.stop();
  hornVoice = hornStart(hornKind(), 1); hornWant = true; hornFlush();
  clearTimeout(hornMaxT); hornMaxT = setTimeout(() => { hornMaxT = 0; if (hornVoice) { hornVoice.stop(); hornVoice = null; } hornWant = false; hornFlush(); }, (Shared.HORN && Shared.HORN.maxMs) || 6000); // เกินเพดานเซิร์ฟเวอร์: หยุดเสียงเอง (ไม่ส่งซ้ำจนกว่าจะปล่อยแล้วกดใหม่)
}
function hornRelease(all, src) {
  if (all) hornSrc.clear(); else hornSrc.delete(src);
  if (hornSrc.size) return;
  clearTimeout(hornMaxT); hornMaxT = 0;
  if (hornVoice) { hornVoice.stop(); hornVoice = null; }
  hornWant = false; hornFlush();
}
const hornBtnEl = $('hornBtn');
hornBtnEl.addEventListener('pointerdown', e => { e.preventDefault(); hornPress('p' + e.pointerId); });
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => hornBtnEl.addEventListener(ev, e => hornRelease(false, 'p' + e.pointerId)));
hornBtnEl.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('blur', () => hornRelease(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) hornRelease(true); });
addEventListener('keyup', e => { if (e.code === 'KeyN') hornRelease(false, 'k'); });
// ตั๋ววาปกลับกองไฟ: ปุ่มบนจอ (ในถ้ำชั้น minFloor+ และมีตั๋ว) + Action ที่ไม่ได้หันหาแร่ กดซ้ำภายใน 3 วิ = ยืนยัน (ตั๋วเสียเงิน)
let recallKey = '', recallAskAt = 0;
const recallOk = () => !!me && cave && !inSea() && caveFlr >= Shared.MINE.recall.minFloor && caveFlr <= Shared.MINE.floors && (inv.recall | 0) > 0;
function syncRecallBtn() { const n = recallOk() ? inv.recall | 0 : 0, k = String(n); if (k === recallKey) return; recallKey = k; const b = $('recallBtn'); b.classList.toggle('hidden', !n); b.textContent = `🎫 ใช้ตั๋ววาป (เหลือ ${n})`; }
function askRecall(now) { if (now - recallAskAt < 3000) { recallAskAt = 0; send({ t: 'recall' }); return; } recallAskAt = now; toast(`🎫 จะใช้ตั๋ววาปกลับกองไฟใช่ไหม (เหลือ ${inv.recall | 0} ใบ) กด Action ซ้ำอีกครั้งเพื่อยืนยัน`); }
$('recallBtn').addEventListener('pointerdown', e => { e.preventDefault(); askRecall(performance.now()); });
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-stat],[role="button"][data-skillsel]')) { e.preventDefault(); e.target.click(); } }); // การ์ดสถานะ/สกิลกดด้วยคีย์บอร์ดได้
$('vehBtn').onclick =() => { setVehMenu($('vehMenu').classList.contains('hidden')); playSfx('click'); };
$('vehMenu').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b || !me) return; send({ t: 'veh', v: b.dataset.v === me.veh ? '' : b.dataset.v }); setVehMenu(false); playSfx('click'); }); // กดรถที่ขี่อยู่ซ้ำ = ลงรถ
addEventListener('pointerdown', e => { if (!$('vehMenu').classList.contains('hidden') && !e.target.closest('#vehMenu') && !e.target.closest('#vehBtn')) setVehMenu(false); });
$('petBtn').onclick = $('petQuick').onclick = () => { if (me) { openPetMenu(); playSfx('click'); } };
$('lampBtn').onclick = () => { if (me) { send({ t: 'lamp', on: !me.lamp }); playSfx('click'); } };

const CATS = [['furn', '🛋️ เฟอร์นิเจอร์ (วางในบ้านด้วยปุ่ม 🏠)'], ['food', '🍽️ อาหารสำเร็จรูป (กินแล้วหายหิว)'], ['seed', '🌱 เมล็ดพันธุ์'], ['crop', '🥬 พืชผล'], ['fish', '🐟 ปลาที่ตกได้'], ['animal', '🥚 ผลผลิตจากสัตว์'], ['feed', '🌾 อาหารสัตว์ / ยา'], ['tool', '🪱 เหยื่อตกปลา'], ['wood', '🪵 ไม้'], ['gear', '🎒 อุปกรณ์ที่ซื้อ']];
// แท็บย่อยในกระเป๋า: ชื่อ, ป้าย, หมวดของที่รวมอยู่ (เหยื่อตกปลาอยู่กับปลา)
const BAG_SUBS = [['furn', '🛋️ เฟอร์นิเจอร์', ['furn']], ['crop', '🥬 ผัก-ผลไม้', ['crop']], ['fish', '🐟 ปลา', ['fish', 'tool']], ['wood', '🪵 ไม้', ['wood']], ['gear', '🧰 อุปกรณ์', ['gear']], ['other', '🗂️ อื่นๆ', ['seed', 'animal', 'feed']]]; // อาหารไม่อยู่ในกระเป๋า กินได้จากไอคอนความหิว
let bagSub = 'furn', statSel = '';
function renderBag() {
  document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.toggle('on', t.dataset.tab === bagTab));
  const el = $('bagBody');
  if (bagTab === 'book') return renderBookTab(el);
  if (bagTab === 'status') {
    const keysOwned = Object.keys(inv).filter(k => k !== 'coin');
    const worth = keysOwned.reduce((s, k) => { const i = itemInfo(k); return s + (i && i.sell ? sellQuote(i.sell, mult(k), inv[k], freshMulsOf(k, inv[k])).total : 0); }, 0);
    const pieces = keysOwned.reduce((s, k) => s + inv[k], 0);
    const [tx, ty] = myTile();
    const cards = [
      ['🪙 เหรียญ', inv.coin || 0], ['💰 ของที่ขายได้ (รวม)', '🪙 ' + worth], ['📦 ของในกระเป๋า', pieces + ' ชิ้น'], ['🎣 คันเบ็ด', RODS[rodLevel()].name], [CANS[canTier(inv)].emoji + ' บัวรดน้ำ', `${CANS[canTier(inv)].name} ระดับ ${canTier(inv)}/${Shared.GEAR_MAX} (${wtr}/${CANS[canTier(inv)].cap})`], [Shared.HOE_EMOJI[Shared.hoeTier(inv)] + ' จอบ', `${Shared.HOES[Shared.hoeTier(inv)].name} ระดับ ${Shared.hoeTier(inv)}/${Shared.GEAR_MAX}`], [Shared.PAIL_EMOJI[Shared.pailTier(inv)] + ' ตะกร้า/ถัง', `${Shared.PAILS[Shared.pailTier(inv)].name} ระดับ ${Shared.pailTier(inv)}/${Shared.GEAR_MAX}`], [Shared.PAN_EMOJI[Shared.panTier(inv)] + ' กระทะ', `${Shared.PANS[Shared.panTier(inv)].name} ระดับ ${Shared.panTier(inv)}/${Shared.GEAR_MAX}`],
      ['📍 ตำแหน่ง', `${tx}, ${ty}`], ['🕒 เวลาในเกม', $('clock').textContent.replace(/^\S+\s/, '')],
      ['👥 ออนไลน์', roster.size + ' คน'], ['🎙️ ไมค์', micOn ? 'เปิดอยู่' : 'ปิดอยู่'],
      ['🐔 ไก่ในฟาร์ม', animalCount('chicken') + ' ตัว'], ['🐄 วัวในฟาร์ม', animalCount('cow') + ' ตัว'], ['🐖 หมูในฟาร์ม', animalCount('pig') + ' ตัว'],
      ['🪱 เหยื่อตกปลา', BAIT_KEYS.map(k => itemInfo(k).emoji + (inv[k] || 0)).join(' ')], ['⭐ ระดับการเล่น', 'Lv ' + playLevel(skills)],
    ];
    const CARD_INFO = { '🪙 เหรียญ': 'เหรียญที่มีอยู่ ใช้ซื้อของ อัปเกรดเครื่องมือ และรับดาวความชำนาญ', '💰 ของที่ขายได้ (รวม)': 'ราคารวมถ้าขายของในกระเป๋าทั้งหมดตอนนี้ (ราคาจริงขึ้นลงตามตลาดและความสด)', '📦 ของในกระเป๋า': 'จำนวนของทุกชิ้นที่ถืออยู่ ไม่นับเหรียญ', '📍 ตำแหน่ง': 'พิกัดช่องที่ยืนอยู่ตอนนี้ (x, y)', '🕒 เวลาในเกม': 'เวลาในเกมตอนนี้ กลางคืนมืดลง ตะเกียงช่วยให้เห็นได้', '👥 ออนไลน์': 'จำนวนผู้เล่นในแมพนี้ตอนนี้ กดปุ่ม 👥 เพื่อดูรายชื่อ', '🎙️ ไมค์': 'สถานะไมค์ของเรา กดปุ่ม 🎤 บนแถบบนเพื่อเปิดหรือปิด', '🪱 เหยื่อตกปลา': 'เหยื่อที่เหลือแต่ละแบบ ใช้ตอนตกปลาเพื่อให้ปลาตัวใหญ่หรือหายากขึ้น', '⭐ ระดับการเล่น': 'ระดับรวมคิดจากเลเวลอาชีพทุกสาย ยิ่งสูงยิ่งปลดล็อกของใหม่' };
    const cardDetail = c => CARD_INFO[c[0]] || (/คันเบ็ด|บัวรดน้ำ|จอบ|ตะกร้า|กระทะ/.test(c[0]) ? 'เครื่องมือที่ใช้อยู่ตอนนี้ อัปเกรดได้ที่ร้านอุปกรณ์เพื่อทำงานได้ไวขึ้นหรือได้ของดีขึ้น' : /ในฟาร์ม/.test(c[0]) ? 'จำนวนสัตว์ที่เลี้ยงไว้ในฟาร์ม ให้อาหารทุกวันเพื่อให้ผลผลิต' : '');
    const hl = hunger <= 0 ? 'หิวจนไม่มีแรง!' : hunger <= 20 ? 'หิวมาก' : hunger <= 50 ? 'เริ่มหิว' : 'อิ่มดี';
    el.innerHTML = `<div class="row"><b style="font-size:17px">👤 ${me.name.replace(/</g, '&lt;')}</b><span><span class="sw" style="display:inline-block;width:18px;height:18px;vertical-align:middle;background:${me.color}"></span> <span class="sw" style="display:inline-block;width:18px;height:18px;vertical-align:middle;background:${me.hat}"></span></span></div>`
      + `<div class="sec">🍖 ความอิ่ม — ${hl} (${hunger}/100)</div><div class="hbar"><i style="width:${hunger}%;${hunger <= 20 ? 'background:#e74c3c' : ''}"></i></div><small style="opacity:.7;font-size:12px">ลดลงเรื่อยๆ ขณะออนไลน์ • ต่ำกว่า 15 เดินช้าลง • ถึง 0 ใช้เครื่องมือไม่ได้ • กินอาหารที่ร้านอาหารหรือกินผลผลิตของตัวเองได้</small>`
      + `<div class="stat">${cards.map((c, i) => `<div data-stat="${i}" tabindex="0" role="button" style="cursor:pointer${statSel === 'c' + i ? ';background:#fff1c9' : ''}">${c[0]}<b>${c[1]}</b></div>`).join('')}</div>`
      + (/^c\d+$/.test(statSel) && cards[+statSel.slice(1)] ? `<div class="skill" style="border:2px solid var(--edge);border-radius:10px;padding:8px;background:#fff8e0;margin-bottom:6px"><b>${cards[+statSel.slice(1)][0]}</b>: ${esc(String(cards[+statSel.slice(1)][1]))}<small style="display:block;opacity:.85">${esc(cardDetail(cards[+statSel.slice(1)]))}</small></div>` : '')
      + `<button class="btn small" data-pinset="1" style="margin:4px 6px 6px 0">🔐 ${pinSt ? 'เปลี่ยน PIN' : 'ตั้ง PIN'}</button>`
      + (devText() ? `<div class="sec">🛠️ สำหรับแอดมิน</div><div class="row" id="devRow">${devText()}</div>` : '')
      + `<div class="sec">🔊 เสียง</div><div class="row"><button class="btn small" data-sfx="1">${sfxOn ? '🔊 เสียงเกม: เปิด' : '🔇 เสียงเกม: ปิด'}</button></div><label class="row" style="font-size:13px"><span>🎮 เสียงเกม</span><input type="range" min="0" max="100" value="${Math.round(sfxVol * 100)}" data-vol="sfx" style="flex:1;margin:0 8px"><b data-volv="sfx">${Math.round(sfxVol * 100)}%</b></label><label class="row" style="font-size:13px"><span>🎵 ดนตรี</span><input type="range" min="0" max="100" value="${Math.round(musicVol * 100)}" data-vol="music" style="flex:1;margin:0 8px"><b data-volv="music">${Math.round(musicVol * 100)}%</b></label><small style="opacity:.65">ดนตรียังไม่มีเพลง ตั้งค่าไว้ก่อนได้เลย</small><div class="sec">เลเวลอาชีพ</div>`
      + Object.keys(SKILLS).map(k => {
        const L = lvl(k), xp = skills[k] || 0, base = xpFor(L, k), need = L >= MAX_LV ? 0 : xpFor(L + 1, k) - base;
        const st = starsSt[k] || 0, M = Shared.MASTERY, nxt = st < M.max && L >= MAX_LV ? xpFor(MAX_LV, k) + (st + 1) * Shared.masteryXp(k) : 0;
        return `<div class="skill" data-skillsel="${k}" tabindex="0" role="button" style="cursor:pointer${statSel === 's' + k ? ';background:#fff8e0' : ''}"><b>${SKILLS[k].emoji} ${SKILLS[k].name}</b> — เลเวล ${L}${L >= MAX_LV ? ' (สูงสุด)' : ''} ${'⭐'.repeat(st)} <small style="display:inline">XP ${xp}</small><div class="bar"><i style="width:${need ? Math.min(100, Math.round((xp - base) / need * 100)) : 100}%"></i></div>`
          + (statSel === 's' + k ? `<small style="opacity:1">${L >= MAX_LV ? 'เลเวลสูงสุดแล้ว' : `อีก ${(need - (xp - base)).toLocaleString()} XP ถึงเลเวล ${L + 1} (ตอนนี้ ${(xp - base).toLocaleString()}/${need.toLocaleString()})`} • ดาวที่ได้ ${st}/${M.max}</small>` : '') + (nxt ? `<small>ดาวความชำนาญที่ ${st + 1}: XP ${nxt.toLocaleString()} + 🪙${M.costBase * (st + 1)} <button class="btn small" data-star="${k}" ${xp < nxt || (inv.coin || 0) < M.costBase * (st + 1) ? 'disabled' : ''}>รับดาว</button></small>` : '') + '</div>';
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
      h += `<div class="sec">🎣 อุปกรณ์ (ความทนทาน)</div><div class="grid">` + Object.keys(DURABILITY).filter(t => (t !== 'axe' || axeLevel() > 0) && (t !== 'pick' || pickLevel() > 0)).map(t => {
        const D = DURABILITY[t], tier = t === 'rod' ? rodLevel() : t === 'axe' ? axeLevel() : t === 'pick' ? pickLevel() : gearTierOf(t), fx = dur[t] ? dur[t][2] || 0 : 0, mx = durMax(t, tier, fx), cur = dur[t] ? dur[t][0] : mx, pct = Math.round(cur / mx * 100);
        const nm = t === 'rod' ? RODS[tier].name : t === 'axe' ? AXES[tier].name : t === 'pick' ? Shared.PICKS[tier].name : GEAR_SETS[t] ? GEAR_SETS[t][0][tier].name : D.name;
        return `<div class="card"><b>${{ hoe: Shared.HOE_EMOJI[tier], pail: Shared.PAIL_EMOJI[tier], pan: Shared.PAN_EMOJI[tier], water: '🫗', rod: Shared.ROD_EMOJI[rodLevel()] || '🎣', axe: Shared.AXE_EMOJI[axeLevel()] || '🪓', pick: Shared.PICK_EMOJI[pickLevel()] || '⚒️' }[t]}</b>${nm}${GEAR_SETS[t] ? ` <small>ระดับ ${tier}/${Shared.GEAR_MAX}</small>` : ''}<br>${cur}/${mx}<br><small style="opacity:.7">ซ่อมแล้ว ${fx}/${REPAIR.maxFixes}${fx >= REPAIR.maxFixes ? ' (ซ่อมไม่ได้แล้ว)' : ''}</small><div class="hbar" style="height:6px"><i style="width:${pct}%;${pct <= 20 ? 'background:#e74c3c' : ''}"></i></div></div>`;
      }).join('') + `</div><p style="font-size:12px;opacity:.65">ซ่อมได้ที่ร้านของสายนั้น ซ่อมแต่ละครั้งความทนทานสูงสุดลด ${Math.round(REPAIR.decay * 100)}% และค่าซ่อมแพงขึ้น ซ่อมได้สูงสุด ${REPAIR.maxFixes} ครั้งแล้วต้องซื้อใหม่</p>`;
    }
    if (!Object.keys(inv).some(k => k !== 'coin' && inv[k] > 0)) h += '<p style="opacity:.7">ยังไม่มีของ ลองปลูกผัก ตกปลา หรือเลี้ยงสัตว์ดูนะ</p>';
    el.innerHTML = h;
  } else if (bagTab === 'skills') {
    const nextCrop = () => Object.values(CROPS).filter(c => !c.legacy && c.lv > lvl('farm')).sort((a, b) => a.lv - b.lv)[0];
    const nextFish = () => FISH.filter(f => !f.sea && f.lv > lvl('fish')).sort((a, b) => a.lv - b.lv)[0];
    const gearHint = (tool, nm) => { const G = GEAR_SETS[tool][0], cur = gearTierOf(tool), nx = Object.keys(G).map(Number).find(t => t > cur && G[t].lv); return nx ? ` • ${nm}ดีขึ้น: ${G[nx].name} (ระดับ ${nx}) ซื้อได้ที่ Lv${G[nx].lv} ... ระดับ ${Shared.GEAR_MAX} ที่ Lv${G[Shared.GEAR_MAX].lv}` : ` • ${nm}ระดับสูงสุดแล้ว`; };
    const hints = {
      farm: () => { const c = nextCrop(); return (c ? `ถัดไป: ปลดล็อก ${c.emoji} ${c.name} ที่ Lv${c.lv}` : 'ปลดล็อกเมล็ดครบแล้ว') + ' • พืชโตเร็วขึ้น 4% ต่อเลเวล' + gearHint('hoe', 'จอบ'); },
      fish: () => { const f = nextFish(); return (f ? `ถัดไป: ตกได้ ${f.emoji} ${f.name} ที่ Lv${f.lv}` : 'ตกปลาได้ครบทุกชนิดแล้ว') + ` • คันเบ็ดดีขึ้นซื้อที่ร้านตกปลา (ระดับ 2 ที่ Lv${RODS[2].lv} ... ระดับ ${Shared.ROD_MAX} ที่ Lv${RODS[Shared.ROD_MAX].lv}) • คันต่ำไปปลาใหญ่จะสู้ยาก`; },
      animal: () => `ซื้อวัวได้ที่ Lv${ANIMALS.cow.lv} • ซื้อหมูได้ที่ Lv${ANIMALS.pig.lv} • ซื้อผึ้งได้ที่ Lv${ANIMALS.bee.lv} (น้ำผึ้งจากรัง 🍯) • แต่ละชนิดมีเล้าของตัวเอง เล้าละ ${ANIMALS.cow.cap} ตัว • ผลผลิตออกเร็วขึ้น 5% ต่อเลเวล • สัตว์ป่วยรักษาด้วยยา 💊` + gearHint('pail', 'ตะกร้า/ถัง'),
      cook: () => 'ทำอาหารที่ครัวร้านอาหาร ยิ่งเลเวลสูงปลดสูตรแพงขึ้น' + gearHint('pan', 'กระทะ'),
      mine: () => { const n = Object.values(Shared.PICKS).find(x => x.lv > lvl('mine')); return (n ? `ถัดไป: ซื้อ ${n.name} ได้ที่ Lv${n.lv}` : 'ซื้ออุปกรณ์ขุดได้ครบทุกชนิดแล้ว') + ' • ยิ่งลงลึก แร่ยิ่งให้ XP เยอะ • อุปกรณ์ต่ำกว่าแร่ขุดได้แต่ช้า (🐌)'; },
      wood: () => { const n = Object.values(AXES).find(x => x.lv > lvl('wood')); return (n ? `ถัดไป: ซื้อ ${n.name} ได้ที่ Lv${n.lv}` : 'ซื้อขวานได้ครบทุกระดับแล้ว') + ' • ขวาน 10 ระดับ ต้นไม้ใหญ่ต้องใช้ขวานดีขึ้น • ขวานต่ำกว่าต้นฟันได้แต่ช้า • เลเวลสูงขึ้นได้ไม้เพิ่มและเจอไม้เนื้อแข็งบ่อยขึ้น'; },
    };
    el.innerHTML = Object.keys(SKILLS).map(k => {
      const L = lvl(k), xp = skills[k] || 0, base = xpFor(L, k), need = L >= MAX_LV ? 0 : xpFor(L + 1, k) - base;
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
function openShop(kind) { closeOthers('shop'); cookFilter = null; cookOpen = null; shopKind = kind; farmTab = SHOP_TABS[kind] ? SHOP_TABS[kind][0][0] : 'gear'; if (kind === 'cloth') { tryWear = Object.assign({}, me.wear); clothTab = 'shirt'; } $('shop').classList.remove('hidden'); renderShop(); }
function closeShop() { shopKind = null; $('shop').classList.add('hidden'); }
$('shopClose').onclick = closeShop;
$('shop').addEventListener('pointerdown', e => { if (e.target === $('shop')) closeShop(); });
const animalCount = type => { let n = 0; const my = me && me.name; animals.forEach(a => { if (a.type === type && (!a.on || a.on === my)) n++; }); return n; }; // นับเฉพาะสัตว์ของฉัน (cap ต่อคน)
let cookPins = []; try { const a = JSON.parse(ls.get('mw_cookpins') || '[]'); if (Array.isArray(a)) cookPins = a.filter(x => typeof x === 'string').slice(0, 100); } catch (e) {} // สูตรที่ปักหมุด (localStorage)
let cookReadyAt = 0; // เตาพักถึงเมื่อไร (ms ของเครื่อง) จาก cookcd
let farmTab = 'gear', cookFilter = null, cookOpen = null; // เมนูเชฟ: ตัวกรอง (null = อัตโนมัติ) / สูตรที่ขยายอยู่
// ทุกร้านที่รับซื้อมีแท็บ 💰 ขาย ไว้ท้ายสุด (แท็บซื้อของร้านที่ไม่มีแท็บเดิม)
const SHOP_TABS = { // ทุกร้านที่มีซื้อขายใช้รูปแบบเดียวกัน: 🛒 ซื้อ → 🧰 อุปกรณ์ → (ทำ/ประดิษฐ์) → 💰 ขาย
  farm: [['buy', '🛒 ซื้อ'], ['gear', '🧰 อุปกรณ์'], ['sell', '💰 ขาย']], fish: [['buy', '🛒 ซื้อ'], ['gear', '🧰 อุปกรณ์'], ['sell', '💰 ขาย']],
  animal: [['buy', '🛒 ซื้อ'], ['gear', '🧰 อุปกรณ์'], ['sell', '💰 ขาย']], food: [['buy', '🛒 ซื้อ'], ['gear', '🧰 อุปกรณ์'], ['cook', '👨‍🍳 ทำอาหาร'], ['sell', '💰 ขาย']],
  wood: [['gear', '🧰 อุปกรณ์'], ['craft', '🔨 สร้าง'], ['sell', '💰 ขาย']], mine: [['gear', '🧰 อุปกรณ์'], ['sell', '💰 ขาย']],
  furn: [['buy', '🛒 ซื้อ'], ['sell', '💰 ขาย']] };
// ของแต่ละชิ้นอยู่แท็บไหนของร้าน (ซื้อ = สินค้า/วัตถุดิบ/สัตว์ • อุปกรณ์ = เครื่องมือ บัวรดน้ำ อาหารสัตว์ ยา)
const buyTabOf = (kind, k) => kind === 'farm' ? (k.startsWith('seed_') ? 'buy' : 'gear') : kind === 'fish' ? (k.startsWith('bait') ? 'buy' : 'gear') : kind === 'animal' ? (itemInfo(k).animal ? 'buy' : 'gear') : kind === 'wood' || kind === 'mine' ? 'gear' : kind === 'food' && k.startsWith('pan_') ? 'gear' : 'buy';
let furnSub = 'living';
const FURN_SUBS = [['living', '🛋️ นั่งเล่น'], ['bedroom', '🛏️ ห้องนอน'], ['kitchen', '🍳 ห้องครัว'], ['study', '📚 โชว์/ทำงาน'], ['decor', '🖼️ ตกแต่ง'], ['divider', '🪟 ฉากกั้น']];
const furnCatOf = k => (FURN[k.slice(5)] || {}).cat; // หมวดของที่ร้านเฟอร์นิเจอร์ (ดูจาก cat ใน FURN)
// เมนูปลาใหม่ขายได้เฉพาะแท็บ 💰 ขาย ของร้านอาหาร (ไม่ขายใต้เมนูทำอาหารเดิม)
const FISH_DISH_SELL_TAB = new Set(['dish_fishsoup', 'dish_sashimi', 'dish_fishburger', 'dish_fishpie']);
const seedProfit = k => { const c = CROPS[k.slice(5)]; return (c.sell - c.seed) / (c.time / 60000); };
let petNames = {}, petSt = {}; // สถานะสัตว์เลี้ยงของเรา: { dog: { h: ความอิ่ม, sick } }
const petLvOf = st => Shared.petLevel(st && st.b); // ระดับสัตว์ 1-5 จากความผูกพัน (คำนวณเหมือนเซิร์ฟเวอร์)
function petBondHtml(st) { // ระดับ + แถบความผูกพันไปเป้าหมายถัดไป
  const N = Shared.PETLV.need, lv = petLvOf(st), b = Math.max(0, (st && st.b) || 0);
  if (lv >= N.length) return `<br><small>💞 ระดับ ${lv} (สูงสุด)</small>`;
  const lo = N[lv - 1], span = N[lv] - lo, got = Math.min(span, Math.max(0, b - lo)), pc = Math.round(got / span * 100);
  return `<br><small>💞 ระดับ ${lv} • ผูกพัน ${Math.floor(got)}/${span} (ถึงระดับ ${lv + 1})</small><div class="hbar" style="width:120px;height:7px"><i style="width:${pc}%;background:#e67eb0"></i></div>`;
}
function petPatLeft(st) { return Math.max(0, ((st && st.pat) || 0) + Shared.PETLV.patCdMs - Date.now()); } // ms ที่ต้องรอก่อนลูบหัวได้อีก
function petStatHtml(c, st, out) { // บรรทัดค่าสถานะ + สถานะผลตอนนี้ (พาออก/หิว/ป่วย)
  const C = COMPANIONS[c], b = Shared.petBonus(c, st.h, st.sick);
  const stats = Shared.PETSTAT.keys.filter(([k]) => C.st && C.st[k]).map(([k, ic, nm]) => `${ic} ${nm} +${Math.round(C.st[k] * Shared.PETSTAT.unit * 100)}%`).join(' • ');
  const eff = !out ? '🏠 พาออกมาถึงจะได้ผล' : st.sick ? '🤒 ป่วย ผลหยุดทำงาน' : b.mood >= 1 ? '✅ ผลทำงานเต็ม' : b.mood > 0 ? '🍖 หิว ผลเหลือครึ่งเดียว ให้อาหารด่วน' : '😣 หิวจัด ผลหยุดทำงาน';
  return `<br><small style="opacity:.9">${stats}</small><br><small><b>${eff}</b></small>`;
}
function petPanelHtml() { // เมนูสัตว์เลี้ยง: พาออกมา/เดินตาม/ปล่อยเล่น/เก็บ + ให้อาหาร + รักษา (ใช้ทั้งในร้านและเมนู 🐾)
  const own = Object.keys(COMPANIONS).filter(c => inv['pet_' + c] > 0), cur = me.pet || '', mode = me.pm || 'follow';
  let h = '<div class="sec">🐾 สัตว์เลี้ยงของคุณ</div>';
  if (!own.length) return h + '<p style="opacity:.7;margin:6px 0">ยังไม่มีสัตว์เลี้ยง ซื้อได้ที่ร้านสัตว์เลี้ยง (36,10) 🐶🐱🐦</p>';
  for (const c of own) {
    const C = COMPANIONS[c], st = petSt[c] || { h: 100, sick: false }, out = cur === c, hp = Math.round(st.h);
    h += `<div class="row"><span>${C.emoji} ${petNames[c] ? esc(petNames[c]) + ' <small>(' + C.name + ')</small>' : C.name}${st.sick ? ' 🤒 <small style="color:#c0392b">ป่วย</small>' : ''}${petStatHtml(c, st, out)}<br><small>${out ? (mode === 'play' ? '🎾 กำลังวิ่งเล่น' : '🚶 เดินตามคุณ') : '🏠 อยู่บ้าน'} • อิ่ม ${hp}/100${out ? '' : ' (ไม่หิวตอนอยู่บ้าน)'}</small><div class="hbar" style="width:120px;height:7px"><i style="width:${hp}%;${hp <= 25 ? 'background:#e74c3c' : ''}"></i></div>${petBondHtml(st)}</span><span>`
      + (out ? `<button class="btn small${mode === 'follow' ? ' muted' : ''}" data-petmode="follow" data-pet="${c}">🚶 เดินตาม</button> <button class="btn small${mode === 'play' ? ' muted' : ''}" data-petmode="play" data-pet="${c}">🎾 ปล่อยเล่น</button> <button class="btn small muted" data-petmode="store" data-pet="">🏠 เก็บ</button>`
        : `<button class="btn small" data-petmode="follow" data-pet="${c}">🐾 พาออกมา</button>`)
      + ` <button class="btn small muted" data-petname="${c}">✏️ ตั้งชื่อ</button></span></div>`;
  }
  const ci = cur ? petSt[cur] || { h: 100, sick: false } : null;
  h += '<div class="sec">🦴 ดูแลสัตว์เลี้ยง</div>'
    + `<div class="row"><span>🦴 ให้อาหาร<br><small>มีอาหาร ${inv.petfood || 0} ชิ้น • +${PETCARE.food} อิ่ม • ซื้อที่ร้านสัตว์เลี้ยง</small></span><span><button class="btn small" data-petcare="feed" ${cur && inv.petfood > 0 && ci.h < 95 ? '' : 'disabled'}>ให้อาหาร</button></span></div>`
    + `<div class="row"><span>🤚 ลูบหัว<br><small>+${Shared.PETLV.pat} ผูกพัน • ${petPatLeft(ci) > 0 ? 'รออีก ' + Math.ceil(petPatLeft(ci) / 60000) + ' นาที' : 'ลูบได้ทุก ' + Math.round(Shared.PETLV.patCdMs / 60000) + ' นาที'} • หันหน้าหาสัตว์แล้วกด Action ก็ได้</small></span><span><button class="btn small" data-petcare="pat" ${cur && !ci.sick && petPatLeft(ci) <= 0 ? '' : 'disabled'}>🤚 ลูบหัว</button></span></div>`
    + `<div class="row"><span>💊 รักษาสัตว์ป่วย<br><small>มียา ${inv.medicine || 0} ขวด • สัตว์หิวจัดจะป่วย (เดินช้า เศร้า)</small></span><span><button class="btn small" data-petcare="heal" ${cur && ci.sick && inv.medicine > 0 ? '' : 'disabled'}>รักษา</button></span></div>`
    + '<p style="font-size:12px;opacity:.65;margin:8px 0 0">📚 ฉลาด = XP ทุกสายเพิ่ม • 🏃 ว่องไว = เดินเร็วขึ้น • 🍀 โชค = ลุ้นได้ผลผลิตเพิ่ม 1 ชิ้น (เก็บผัก ตกปลา ขุดแร่ ตัดไม้ เก็บของจากสัตว์) • ผลทำงานเมื่อพาออกมา ไม่ป่วย และอิ่มพอ (หิว = ครึ่งเดียว)<br>💡 ต้องพาสัตว์ออกมาก่อนถึงจะให้อาหาร/รักษาได้ • ปล่อยเล่นแล้วสัตว์จะซนอยู่รอบจุดที่ปล่อย • เดินตาม: ห่างเกิน 2 ช่องจะวิ่งมาหา ยืนเฉยๆ จะเดินไปมาใกล้ตัว</p>';
  return h;
}
function bindPet(body) {
  body.querySelectorAll('[data-petname]').forEach(b => b.onclick = () => { const c = b.dataset.petname, n = prompt(`ตั้งชื่อ${COMPANIONS[c].emoji} ${COMPANIONS[c].name} (ไม่เกิน 12 ตัวอักษร เว้นว่าง = ล้างชื่อ)`, petNames[c] || ''); if (n !== null) send({ t: 'petname', pet: c, name: n }); });
  body.querySelectorAll('[data-petmode]').forEach(b => b.onclick = () => send({ t: 'pet', pet: b.dataset.pet, mode: b.dataset.petmode }));
  body.querySelectorAll('[data-petcare]').forEach(b => b.onclick = () => send({ t: 'petcare', a: b.dataset.petcare }));
}
// ลิฟต์เหมืองที่ปากถ้ำ: จ่ายเหรียญลงตรงไปชั้นที่เคยเดินลงถึง (ลงเดินเองฟรีเหมือนเดิม) เซิร์ฟเวอร์เช็กระยะ/เหรียญ/ชั้นเอง
function openLift() { closeOthers('shop'); shopKind = 'lift'; $('shop').classList.remove('hidden'); renderShop(); }
function renderLift() {
  const fees = Shared.MINE.fee, coin = inv.coin || 0; let rows = '';
  for (let f = 2; f <= Shared.MINE.floors; f++) {
    const ok = f <= deepFloor, kind = Shared.ORE_ORDER[f - 1], O = Shared.ORES[kind];
    rows += `<div class="row${ok ? '' : ' lock'}"><span>🎫 ชั้น ${f} ${O ? O.emoji : ''}<br><small>${ok ? 'ลงตรงไปชั้นนี้' : '🔒 ยังไม่เคยลงถึง (เดินลงเองให้ถึงก่อนครั้งแรก)'}</small></span><span>🪙${fees[f]} <button class="btn small" data-ticket="${f}" ${!ok || coin < fees[f] ? 'disabled' : ''}>ลงเลย</button></span></div>`;
  }
  $('shopTitle').textContent = '🛗 ลิฟต์เหมือง'; $('shopInfo').textContent = '🪙 ' + coin;
  const body = $('shopBody'); body.innerHTML = `<div class="sec">จ่ายเหรียญลงชั้นลึกได้เลย ข้ามการเดินหาบันได (ไม่อยากเสียเงินก็เดินลงเองฟรี • ลงถึงชั้นลึกสุดที่เคยไปแล้ว: ชั้น ${deepFloor})</div>` + rows;
  body.querySelectorAll('[data-ticket]').forEach(b => b.onclick = () => { const f = +b.dataset.ticket; ask(`จ่าย 🪙${Shared.MINE.fee[f]} ลงลิฟต์ไปชั้น ${f}? (ไม่อยากเสียเงินก็เดินลงเองฟรี)`, () => { send({ t: 'mineticket', f }); closeShop(); }); });
}
function openPetMenu() { closeOthers('shop'); shopKind = 'petmenu'; $('shop').classList.remove('hidden'); renderShop(); }
function petSpeedMul() { // 🏃 สัตว์เลี้ยงที่พาออกมา เดินเร็วขึ้นตามค่าสถานะ (ไม่ป่วย/อิ่มพอ)
  const c = me && me.pet; if (!c || !COMPANIONS[c]) return 1;
  const st = petSt[c] || { h: 100, sick: false }; return 1 + Shared.petBonus(c, st.h, st.sick, petLvOf(st)).spd;
}
function updatePetBtn() {
  const own = Object.keys(COMPANIONS).some(c => inv['pet_' + c] > 0), b = $('petBtn'), q = $('petQuick');
  if (b) b.classList.toggle('hidden', !own);
  if (!q) return;
  const cur = me && me.pet && COMPANIONS[me.pet] ? me.pet : '', st = cur ? petSt[cur] || { h: 100, sick: false } : null, need = !!st && (st.sick || st.h <= PETCARE.sickBelow); // ปุ่มลัดบนแถบบน: ไอคอนตามตัวที่พาออกมา จุดแดง = หิว/ป่วย
  q.classList.toggle('hidden', !own); q.classList.toggle('on', !!cur); q.classList.toggle('alert', need);
  q.textContent = cur ? COMPANIONS[cur].emoji : '🐾';
  q.title = cur ? `${petNames[cur] || COMPANIONS[cur].name} ${Shared.petStatText(cur)}${need ? ' (หิว/ป่วย ต้องดูแล)' : ''} • กดเพื่อเปิดเมนูสัตว์เลี้ยง` : 'สัตว์เลี้ยง: กดเพื่อพาออกมา';
}
function sbValue(k) { // ราคาขายคืนที่ตรงกับเซิร์ฟเวอร์: ชิ้นที่ใช้อยู่ (ระดับสูงสุดของเครื่องมือนั้น) คิดตามความทนที่เหลือ ชิ้นอื่นได้เต็ม
  const m = /^(rod|axe|pick|hoe|pail|pan)_(\d+)$/.exec(k);
  if (m) { const t = m[1], n = +m[2], cur = t === 'rod' ? rodLevel() : t === 'axe' ? axeLevel() : t === 'pick' ? pickLevel() : gearTierOf(t); if (n === cur) return sellbackValue(k, (dur[t] ? dur[t][0] : durMax(t, n, 0)) / DURABILITY[t].max[n]); }
  return sellbackValue(k);
}
function gearNote(tool, t) { // บรรทัดผลของอุปกรณ์ติดตัว: ตัวเลขอ่านจาก shared ทั้งหมด (ระดับ N เต็มที่กับของเลเวล 2N-1..2N)
  const G = Shared.GEAR_TUNE[tool], pc = Math.round(G.base * 100), rng = `Lv ${2 * t - 1}–${2 * t}`;
  const fx = tool === 'hoe' ? `โอกาสได้พืชเพิ่ม ${pc}% (พืช ${rng})` : tool === 'pail' ? `โอกาสได้ผลผลิตสัตว์ ×2 เพิ่ม ${pc}% (สัตว์ ${rng})` : `ค่าเตาถูกลง ${pc}% ของราคาขาย (เมนู ${rng})`;
  return `ระดับ ${t}/${Shared.GEAR_MAX} • ทน ${durMax(tool, t, 0)} • ${fx}`;
}
function renderShop() {
  if (shopKind === 'petmenu') { $('shopTitle').textContent = '🐾 สัตว์เลี้ยง'; $('shopInfo').textContent = '🪙 ' + (inv.coin || 0); $('shopBody').innerHTML = petPanelHtml(); bindPet($('shopBody')); updatePetBtn(); return; }
  if (shopKind === 'lift') { renderLift(); return; }
  const sh = SHOPS[shopKind]; if (!sh) return;
  $('shopTitle').textContent = sh.name;
  $('shopInfo').textContent = (sh.skill ? `${SKILLS[sh.skill].emoji} ${SKILLS[sh.skill].name} เลเวล ${lvl(sh.skill)} • ` : '') + `🪙 ${inv.coin || 0}` + (shopKind === 'food' ? ` • 🍖 ความอิ่ม ${hunger}/100` : '');
  if (shopKind === 'cloth') return renderCloth();
  if (shopKind === 'vehicle') { // ร้านยานพาหนะ: ซื้อแล้วขี่/ลงได้ที่นี่ (หรือกด V) • เรือ ⛵ อยู่ท้ายรายการ (ไม่ได้ขี่ ใช้ออกทะเลฟรี)
    const vrows = sh.buy.filter(k => k.startsWith('veh_')).map(k => { const i = itemInfo(k), v = k.slice(4), own = inv[k] > 0, riding = me && me.veh === v;
      return `<div class="row"><span>${i.emoji} ${i.name}<br><small>${own ? (riding ? 'กำลังขี่อยู่ ✅' : 'มีแล้ว') : `🪙${i.buy}`}</small></span><span>`
        + (own ? `<button class="btn small" data-veh="${riding ? '' : v}">${riding ? 'ลงเดิน' : 'ขี่'}</button> <button class="btn small muted" data-sellback="${k}">↩️ ขายคืน 🪙${sellbackValue(k)}</button>` : `<button class="btn small" data-buy="${k}" data-n="1" ${(inv.coin || 0) < i.buy ? 'disabled' : ''}>ซื้อ</button>`) + '</span></div>'; }).join('');
    const bi = itemInfo('boat'), bown = inv.boat > 0;
    const brow = `<div class="row"><span>${bi.emoji} ${bi.name}<br><small>${bown ? 'มีแล้ว ✅ ขับเรือออกทะเลใหญ่ฟรี (แตะเรือที่ท่าบนเกาะลึกลับ • ออกได้ทุกเวลา ไม่จำกัดเวลา)' : `🪙${bi.buy} • ขับเรือเองในทะเลใหญ่ ฟรีทุกเที่ยว • ไม่มีเรือต้องจ่ายค่าเช่าเรือ 🪙${Shared.SEA.fee} ต่อเที่ยว (ร้านเช่าเปิด 06:00–19:00 เวลาเกม)`}</small></span><span>`
      + (bown ? `<button class="btn small muted" data-sellback="boat">↩️ ขายคืน 🪙${sellbackValue('boat')}</button>` : `<button class="btn small" data-buy="boat" data-n="1" ${(inv.coin || 0) < bi.buy ? 'disabled' : ''}>ซื้อ</button>`) + '</span></div>';
    $('shopBody').innerHTML = '<div class="sec">🚲 ยานพาหนะ (ขี่ได้ในเมือง เดินเร็วขึ้น • กด V ขี่/ลง)</div>' + vrows + '<div class="sec">⛵ ออกทะเล</div>' + brow;
    $('shopBody').querySelectorAll('[data-veh]').forEach(b => b.onclick = () => send({ t: 'veh', v: b.dataset.veh }));
    $('shopBody').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => send({ t: 'buy', item: b.dataset.buy, n: 1 }));
    $('shopBody').querySelectorAll('[data-sellback]').forEach(b => b.onclick = () => ask('ขายคืนร้าน? (คิดตามสภาพ สูงสุด 70% ของราคา)', () => send({ t: 'sellback', item: b.dataset.sellback })));
    return;
  }
  const isFarm = shopKind === 'farm', seedTab = isFarm && farmTab === 'buy', tabs = SHOP_TABS[shopKind], sellTab = !!tabs && farmTab === 'sell', cookTab = shopKind === 'food' && farmTab === 'cook', petTab = shopKind === 'animal' && farmTab === 'buy', craftTab = shopKind === 'wood' && farmTab === 'craft';
  let h = tabs ? `<div class="tabs">${tabs.map(([c, n]) => `<button class="tab${farmTab === c ? ' on' : ''}" data-ftab="${c}">${n}</button>`).join('')}</div>` : '';
  if (shopKind === 'furn' && farmTab === 'buy') h += `<div class="tabs">${FURN_SUBS.map(([c, n]) => `<button class="tab${furnSub === c ? ' on' : ''}" data-fsub="${c}">${n}</button>`).join('')}</div>`;
  h += sellTab || cookTab || craftTab ? '' : seedTab ? '<div class="sec">เมล็ดพันธุ์ (เรียงจากเลเวลต่ำ → สูง)</div>' : '<div class="sec">' + (petTab ? 'ซื้อสัตว์เลี้ยง' : tabs && farmTab === 'gear' ? 'อุปกรณ์' : 'ซื้อ') + '</div>';
  let keys = sellTab || cookTab || craftTab ? [] : tabs ? sh.buy.filter(k => buyTabOf(shopKind, k) === farmTab && (shopKind !== 'furn' || furnCatOf(k) === furnSub)) : sh.buy;
  const profitRank = seedTab ? keys.slice().sort((a, b) => seedProfit(b) - seedProfit(a)) : [];
  if (seedTab) keys = keys.slice().sort((a, b) => CROPS[a.slice(5)].lv - CROPS[b.slice(5)].lv || CROPS[a.slice(5)].sell - CROPS[b.slice(5)].sell);
  let freeHdr = false;
  for (const k of keys) {
    const i = itemInfo(k), locked = i.lv && lvl(i.skill) < i.lv, coin = inv.coin || 0;
    let sub = '';
    if (i.animal) sub = `มี ${animalCount(i.animal)}/${ANIMALS[i.animal].cap} ตัว`;
    else if (i.once) sub = inv[k] ? 'มีแล้ว ✅' : '';
    else sub = `มี ${inv[k] || 0}${i.food ? ` • อิ่ม +${i.food}` : ''}`;
    if (seedTab) {
      const cid = k.slice(5), tg = cropSeasonTag(cid), lk = plantLock(cid);
      if (!tg && !freeHdr) { freeHdr = true; const fl = (Shared.SEASONS && Shared.SEASONS.freeLv) || 0; if (fl) h += `<div class="sec">✅ Lv≤${fl} ปลูกได้ทุกฤดู</div>`; }
      if (tg && freeHdr === true) { freeHdr = 2; h += '<div class="sec">🌦️ ปลูกตามฤดู</div>'; }
      const os = offSeason(cid);
      sub += os && !locked ? ' • ' + os : !tg ? '' : locked ? ` • ${tg.emoji} ${tg.name}` : lk ? ` • 🔒 ${tg.emoji} ${tg.name}${lk.txt ? ' รออีก ' + lk.txt : ''} (ซื้อเก็บไว้ได้)` : ` • ${tg.emoji} ${tg.name} 🌟 ปลูกได้ ราคาดี`;
    }
    if (seedTab) { const c = CROPS[k.slice(5)], pr = seedProfit(k), ix = profitRank.indexOf(k); sub += ` • กำไร ${c.sell - c.seed}/ต้น (${pr.toFixed(1)}/นาที) ${ix < 3 ? '⭐ ดี' : ix >= profitRank.length - 3 ? '▼ ต่ำ' : ''}`; }
    const lockTxt = locked ? ` <small>🔒 Lv${i.lv}</small>` : '';
    const tm = /^(axe|rod|hoe|pail|pan|can)_(\d+)$/.exec(k), tn = tm && tm[2], toolBetter = tn && +tn <= { axe: axeLevel, rod: rodLevel, hoe: () => Shared.hoeTier(inv), pail: () => Shared.pailTier(inv), pan: () => Shared.panTier(inv), can: () => canTier(inv) }[tm[1]](); // ขวาน/คัน/จอบ/ถัง/กระทะ/บัวระดับ ≤ ที่มีอยู่แล้ว = ซื้อไม่ได้
    if (toolBetter && !inv[k]) sub = 'มีที่ดีกว่าแล้ว ✅';
    if (tm && GEAR_SETS[tm[1]]) sub += ' • ' + gearNote(tm[1], +tn); else if (tm && tm[1] === 'can') sub += ` • ระดับ ${tn}/${Shared.GEAR_MAX}`;
    const off = locked || toolBetter || (i.once && inv[k]) || (i.animal && animalCount(i.animal) >= ANIMALS[i.animal].cap);
    const ic = tn ? `<span style="font-size:28px;line-height:1;vertical-align:middle;margin-right:2px">${i.emoji}</span>` : i.emoji; // แถวขวาน/คัน: ไอคอนใหญ่ ~28px ให้แยกระดับออก
    h += `<div class="row${locked ? ' lock' : ''}"><span>${ic} ${i.name}${lockTxt}<br><small>${sub}</small></span><span>🪙${i.buy} `
      + `<button class="btn small" data-buy="${k}" data-n="1" ${off || coin < i.buy ? 'disabled' : ''}>ซื้อ</button>`
      + (i.once || i.animal ? '' : ` <button class="btn small" data-buy="${k}" data-n="5" ${off || coin < i.buy * 5 ? 'disabled' : ''}>×5</button>`)
      + (i.food && inv[k] ? ` <button class="btn small" data-eat="${k}" style="background:#2ecc71;border-bottom-color:#1e8f4e" ${hunger >= 99 ? 'disabled' : ''}>🍴 กิน</button>` : '')
      + (i.once && inv[k] ? ` <button class="btn small muted" data-sellback="${k}">↩️ ขายคืน 🪙${sbValue(k)}</button>` : '') + `</span></div>`;
  }
  if (isFarm && farmTab === 'gear') { // แปลงเช่า
    const R = Shared.FARM_RENT, now = Date.now() + timeOffset, myKey = me ? me.name.toLowerCase() : '';
    h += `<div class="sec">🏡 แปลงเช่า (แปลงละ 12 ช่อง • 🪙${R.price} / 1 วันจริง)</div><p style="font-size:12px;opacity:.7;margin:2px 0 6px">3 แถวบนของแปลงผัก แบ่ง 4 แปลง ขุด/ปลูกได้เฉพาะคนเช่า ต้นในแปลงตัวเองไม่นับเพดานปลูก เช่าได้คนละแปลง รอบละ 1 วันจริง (24 ชม.) ต่ออายุไม่ได้ หมดรอบแล้วค่อยเช่าใหม่</p>`;
    for (const P of R.plots) {
      const r = rentsSt[P.id], active = r && r.until > now, mine = active && r.key === myKey, left = active ? fmtLeft(r.until - now) : '';
      h += `<div class="row"><span>🏡 แปลง ${P.id}<br><small>${active ? (mine ? `ของคุณ • เหลือ ${left}` : `${r.name} เช่าอยู่ • เหลือ ${left}`) : 'ว่าง (ล็อกไว้ ยังไม่มีคนเช่า)'}</small></span><span>${active && !mine ? '' : `<button class="btn small" data-rent="${P.id}" ${(inv.coin || 0) < R.price ? 'disabled' : ''}>${mine ? 'ต่อเวลา' : 'เช่า'} 🪙${R.price}</button>`}</span></div>`;
    }
  }
  if (shopKind === 'pet') h += petPanelHtml();
  const tierOf = t => (t === 'rod' ? rodLevel() : t === 'axe' ? axeLevel() : t === 'pick' ? pickLevel() : gearTierOf(t));
  const fixable = tabs && farmTab !== 'gear' ? [] : Object.keys(DURABILITY).filter(t => DURABILITY[t].shop === shopKind && tierOf(t) > 0);
  if (fixable.length) {
    h += '<div class="sec">🔧 ซ่อมอุปกรณ์ (ใช้แล้วสึกหรอ ถ้าพังต้องซ่อมก่อนใช้ต่อ)</div>';
    for (const t of fixable) {
      const tier = tierOf(t), fx = dur[t] ? dur[t][2] || 0 : 0, mx = durMax(t, tier, fx), cur = dur[t] ? dur[t][0] : mx, pct = Math.round(cur / mx * 100), price = toolPrice(t, tier);
      const can = canRepair(t, tier, cur, fx), cost = can ? repairCost(t, tier, cur, fx) : 0, worn = fx >= REPAIR.maxFixes, better = can && cost >= price * 0.6;
      const note = worn ? 'ซ่อมครบ ' + fx + ' ครั้งแล้ว ซ่อมไม่ได้อีก' : 'ซ่อมแล้ว ' + fx + '/' + REPAIR.maxFixes + ' ครั้ง' + (better ? ' • ซื้อใหม่คุ้มกว่า!' : '');
      h += `<div class="row"><span>${GEAR_SETS[t] ? GEAR_SETS[t][0][tier].name + ' <small>ระดับ ' + tier + '/' + Shared.GEAR_MAX + '</small>' : DURABILITY[t].name} <small>${cur}/${mx}</small><div class="hbar" style="width:120px;height:7px"><i style="width:${pct}%;${pct <= 20 ? 'background:#e74c3c' : ''}"></i></div><small style="opacity:.7;display:block">${note}</small></span>`
        + `<span>${worn ? '' : `<button class="btn small" data-repair="${t}" ${!can || (inv.coin || 0) < cost ? 'disabled' : ''}>${can ? '🔧 ซ่อม 🪙' + cost : 'ยังดีอยู่'}</button>`}`
        + (fx || cur <= 0 ? ` <button class="btn small${better || worn ? '' : ' muted'}" data-rebuy="${t}" ${(inv.coin || 0) < price ? 'disabled' : ''}>🛒 ซื้อใหม่ 🪙${price}</button>` : '') + `</span></div>`;
    }
  }
  const showSell = sh.sell.length && (!tabs || sellTab || cookTab); // ขายอยู่แท็บ 💰 ขายแท็บเดียว (แท็บทำอาหารยังขายจานได้)
  const sellKeys = showSell ? Object.keys(inv).filter(k => shopSells(shopKind, k) && itemInfo(k) && itemInfo(k).sell && !(cookTab && FISH_DISH_SELL_TAB.has(k))) : [];
  if (showSell) h += '<div class="sec">ขาย (เลือกได้ว่าจะขายอะไร)</div>';
  if (showSell && !sellKeys.length) h += '<p style="opacity:.7;margin:6px 0">ยังไม่มีของที่ร้านนี้รับซื้อ</p>';
  for (const k of sellKeys) {
    const i = itemInfo(k), m = mult(k), unit = Math.max(1, Math.round(i.sell * m));
    const trend = (m > 1.03 ? `<span style="color:#1e8f4e">▲ ${Math.round((m - 1) * 100)}%</span>` : m < 0.97 ? `<span style="color:#c0392b">▼ ${Math.round((1 - m) * 100)}%</span>` : '') + (m < 0.5 ? ' <span style="color:#c0392b">⚠️ ตลาดอิ่มตัว รอราคากลับก่อนค่อยขาย</span>' : '');
    h += `<div class="row"><span>${i.emoji} ${i.name} ×${inv[k]}${freshBadge(k)}<br><small>ราคาตลาด 🪙${unit} (ปกติ ${i.sell}) ${trend}</small></span><span>`
      + `<button class="btn small" data-sell="${k}" data-n="1">ขาย 1</button> `
      + (inv[k] > 1 ? `<button class="btn small" data-sell="${k}" data-n="all" title="ราคาต่อชิ้นลดลงเรื่อยๆ ถึงพื้น 20% ของราคาฐาน">ทั้งหมด 🪙${allTotal(i, m, inv[k], k)}</button>` : '') + `</span></div>`;
  }
  if (showSell) h += '<p style="font-size:12px;opacity:.65;margin:8px 0 0">💡 ราคาขึ้นลงตามตลาด: ขายชนิดเดิมซ้ำๆ ราคาของคุณจะตกเร็วและฟื้นช้า (ตกเหลือต่ำสุด ~20–25% ของราคาปกติ) • ขายหมวดหนึ่งเยอะ หมวดนั้นตกเร็ว แต่หมวดอื่นฟื้นเร็วขึ้น • มีข่าวราคาพุ่ง/ตกทุกวันในเกม</p>';
  if (cookTab) {
    const cdLeft = () => Math.max(0, Math.ceil((cookReadyAt - Date.now()) / 1000)), cd = cdLeft() > 0;
    if (cd) h += `<div class="banner" id="ckCd" style="background:#ffe3d6">⏳ เตายังร้อน ทำจานต่อไปได้อีก ${cdLeft()} วิ</div>`;
    h += `<div class="sec">👨‍🍳 ห้องครัวเชฟ — เชฟเลเวล ${lvl('cook')} (ทำอาหารข้ามสาย ได้ XP เชฟ ยิ่งเลเวลสูงปลดสูตรแพงขึ้น)</div>`;
    const have = c => Object.keys(inv).reduce((s, k) => s + (inv[k] > 0 && cookCat(c, k) ? inv[k] : 0), 0);
    const haveU = c => Object.keys(inv).filter(k => inv[k] > 0 && cookCat(c, k)).length; // จำนวนชนิดที่มี (สูตรที่ต้องคนละชนิด)
    const hv = n => n.c ? (n.u ? haveU(n.c) : have(n.c)) : (inv[n.k] || 0);
    const panOk = !dur.pan || dur.pan[0] > 0, fee = r => Math.round(r.sell * Shared.panFee(r, Shared.panTier(inv), panOk)), coin = inv.coin || 0, cl = lvl('cook');
    const st = COOK.map((r, i) => { const locked = cl < r.lv, cu = locked ? null : Shared.cookUse(inv, r), ok = !locked && cu.ok; return { r, i, locked, ok, cu, can: ok && coin >= fee(r) }; }); // ตัดสินด้วย Shared.cookUse (รวมวัตถุดิบทางเลือก) ตรงกับเซิร์ฟเวอร์
    const hvE = n => { let g = hv(n); if (n.k) for (const a of (Shared.COOK_ALT[n.k] || [])) g += Math.floor((inv[a.k] || 0) / a.n); return g; }; // จำนวนที่มีรวมของทางเลือก
    const catOf = (r, c) => r.in.some(n => n.c ? n.c === c : cookCat(c, n.k));
    const filt = cookFilter || (st.some(x => x.can) ? 'now' : 'all');
    const FILTERS = [['now', '✅ ทำได้ตอนนี้'], ['all', 'ทั้งหมด'], ['fish', '🐟 ปลา'], ['crop', '🥕 ผัก'], ['egg', '🥚 ไข่'], ['lock', '🔒 ยังไม่ปลดล็อก']];
    h += `<div class="ck-filters">${FILTERS.map(([c, n]) => `<button class="chip${filt === c ? ' on' : ''}" data-ckf="${c}">${n}</button>`).join('')}</div>`;
    let list = st.filter(x => filt === 'now' ? x.can : filt === 'lock' ? x.locked : filt === 'all' ? true : catOf(x.r, filt));
    const grp = x => x.locked ? 2 : x.ok ? 0 : 1;
    const pinN = x => cookPins.includes(x.r.id) ? 0 : 1; // สูตรที่ปักหมุดขึ้นบนสุด
    list.sort((a, b) => pinN(a) - pinN(b) || grp(a) - grp(b) || a.r.lv - b.r.lv || a.i - b.i);
    const nextLock = st.filter(x => x.locked).reduce((m, x) => !m || x.r.lv < m.r.lv ? x : m, null);
    if (!list.length) h += '<p style="opacity:.7;margin:6px 0">' + (filt === 'now' ? 'ตอนนี้ยังไม่มีสูตรที่ทำได้ ลองดูแท็บ "ทั้งหมด" เพื่อเช็กว่าขาดอะไร' : 'ไม่มีสูตรในหมวดนี้') + '</p>';
    for (const x of list) {
      const r = x.r, f = fee(r);
      if (x.locked) { h += `<div class="ck-card lock${nextLock && nextLock.r.id === r.id ? ' next' : ''}"><div class="ck-head"><span class="ck-ic">${r.emoji}</span><span class="ck-nm">${r.name}<small>🔒 ปลดที่เชฟ Lv ${r.lv}</small></span></div></div>`; continue; }
      const chips = r.in.map((n, ri) => { const emo = n.c ? COOK_CATS[n.c].emoji : itemInfo(n.k).emoji, got = hvE(n), rowOk = x.cu.rows[ri].ok; return `<span class="ck-chip ${rowOk ? 'ok' : 'no'}">${emo}${n.k ? itemInfo(n.k).name.replace(/ \(.*$/, '') : ''}×${n.n}${n.u ? ' คนละชนิด' : ''}${rowOk ? '' : ` (มี ${got})`}</span>`; }).join('') + x.cu.rows.filter(w => w.alt).map(w => { const pk = w.picks.filter(p => p.k !== w.need.k).map(p => itemInfo(p.k).name.replace(/ \(.*$/, '') + ' ×' + p.n).join(', '); return `<span class="ck-chip ok">🔄 ใช้${pk} แทน</span>`; }).join('');
      const mk = Math.min(...r.in.map(n => n.u ? (hv(n) >= n.n ? 1 : 0) : n.c ? Math.floor(hv(n) / r.in.filter(m => m.c === n.c && !m.u).reduce((t, m) => t + m.n, 0)) : Math.floor(hvE(n) / n.n)), f > 0 ? Math.floor(coin / f) : 99), open = cookOpen === r.id;
      h += `<div class="ck-card${x.can ? '' : ' miss'}"><div class="ck-head" data-ckx="${r.id}"><span class="ck-ic">${r.emoji}</span><span class="ck-nm">${r.name}<small>ขายได้ราว 🪙${r.sell} ${open ? '▴' : '▾'}</small></span><button class="btn small${cookPins.includes(r.id) ? '' : ' muted'}" data-ckpin="${r.id}" title="${cookPins.includes(r.id) ? 'เลิกปักหมุด' : 'ปักหมุดสูตรนี้ไว้บนสุด'}" aria-label="ปักหมุด" style="padding:2px 6px">${cookPins.includes(r.id) ? '📌' : '📍'}</button><button class="btn small" data-cook="${r.id}" style="min-height:44px;min-width:44px" ${x.can && !cd ? '' : 'disabled'}>${cd ? '⏳ รอ' : `ทำ (×${Math.max(0, mk)})`}</button></div><div class="ck-chips">${chips}</div>`
        + (open ? `<div class="ck-more">+${r.xp} XP • เวลาทำ ${Math.round(r.time / 1000)} วิ • ค่าเตา 🪙${f}${coin < f ? ' <b style="color:#c0392b">(เหรียญไม่พอ)</b>' : ''} • กำไรสุทธิ 🪙${r.sell - f} • กินอิ่ม +${r.food}</div>` : '') + '</div>';
    }
    h += '<p style="font-size:12px;opacity:.65;margin:8px 0 0">💡 ปลา ผัก ไข่ มาจากคนละสายอาชีพ ลองแลกเปลี่ยนวัตถุดิบกับเพื่อน หรือใช้กระดานใบสั่งซื้อ 📋 • อาหารที่ทำเองขายคืนได้ที่ร้านนี้ (ใช้ชนิดวัตถุดิบที่ถูกที่สุดก่อน)</p>';
  }
  if (shopKind === 'food' && !cookTab) h += '<p style="font-size:12px;opacity:.65;margin:8px 0 0">🍖 ความอิ่มลดลงเรื่อยๆ ขณะออนไลน์ ถึง 0 จะใช้เครื่องมือไม่ได้ • ผลผลิตของตัวเองก็กินได้ (อิ่มน้อยกว่า) ในกระเป๋า 🎒</p>';
  if (shopKind === 'furn') h += `<p style="font-size:12px;opacity:.65;margin:8px 0 0">🏠 ทุกคนมีบ้านหลังใหญ่เป็นของตัวเอง เข้าได้จากเมนู ☰ → 🏠 บ้านฉัน แล้วกดปุ่ม 🏠 อีกครั้ง (หรือ H) เพื่อวางของ • มูลค่าและจำนวนของที่ตกแต่งจะขึ้นอันดับใน 🏘️ บ้านเพื่อน • เก้าอี้/โซฟานั่งได้ • โคมไฟสว่างตอนกลางคืน</p>`;
  if (craftTab) {
    h += '<div class="sec">🔨 โรงงานช่างไม้ (ประดิษฐ์ของจากไม้ที่หามาได้)</div>';
    for (const r of CRAFT) {
      const i = itemInfo(r.id), locked = lvl('wood') < r.lv, ok = Object.entries(r.in).every(([k, n]) => (inv[k] || 0) >= n);
      const need = Object.entries(r.in).map(([k, n]) => { const x = itemInfo(k), have = inv[k] || 0; return x.emoji + n + (have >= n ? '' : ' <small style="color:#c0392b">(มี ' + have + ')</small>'); }).join(' + ');
      h += `<div class="row${locked ? ' lock' : ''}"><span>${i.emoji} ${i.name}${locked ? ` <small>🔒 Lv${r.lv}</small>` : ''}<br><small>ใช้ ${need} • +${woodXp(r.xp, lvl('wood'))} XP${craftFee(r.id) ? ` • ค่าโรงช่าง 🪙${craftFee(r.id)}` : ''}${i.furn ? ' • วางในบ้านได้' : ''}</small></span><span><button class="btn small" data-craft="${r.id}" ${locked || !ok ? 'disabled' : ''}>🔨 ทำ</button></span></div>`;
    }
    h += '<p style="font-size:12px;opacity:.65;margin:8px 0 0">💡 ตัดต้นไม้ด้วยขวานได้ไม้ท่อน 🪵 และไม้เนื้อแข็ง 🟫 • ไม้กระดานขายได้แพงกว่าไม้ท่อน • ลังไม้ ถังไม้ ป้ายชี้ทาง ตู้ไปรษณีย์ ตู้เครื่องมือ และกระท่อม ทำได้เฉพาะช่างไม้ (ตะเกียง 🏮 ย้ายไปขายที่ร้านเฟอร์นิเจอร์แล้ว)</p>';
  }
  const body = $('shopBody'); body.innerHTML = h;
  body.querySelectorAll('[data-ftab]').forEach(b => b.onclick = () => { farmTab = b.dataset.ftab; renderShop(); });
  body.querySelectorAll('[data-fsub]').forEach(b => b.onclick = () => { furnSub = b.dataset.fsub; renderShop(); });
  body.querySelectorAll('[data-craft]').forEach(b => b.onclick = () => send({ t: 'craft', id: b.dataset.craft }));
  body.querySelectorAll('[data-rent]').forEach(b => b.onclick = () => send({ t: 'rent', id: b.dataset.rent }));
  body.querySelectorAll('[data-ckf]').forEach(b => b.onclick = () => { cookFilter = b.dataset.ckf; renderShop(); });
  body.querySelectorAll('[data-ckx]').forEach(b => b.onclick = e => { if (e.target.closest('[data-cook],[data-ckpin]')) return; cookOpen = cookOpen === b.dataset.ckx ? null : b.dataset.ckx; renderShop(); });
  body.querySelectorAll('[data-ckpin]').forEach(b => b.onclick = () => { const id = b.dataset.ckpin, i = cookPins.indexOf(id); if (i >= 0) cookPins.splice(i, 1); else cookPins.push(id); ls.set('mw_cookpins', JSON.stringify(cookPins)); renderShop(); });
  body.querySelectorAll('[data-cook]').forEach(b => b.onclick = () => send({ t: 'cook', id: b.dataset.cook }));
  bindPet(body);
  body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => send({ t: 'buy', item: b.dataset.buy, n: +b.dataset.n }));
  body.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => send({ t: 'sell', item: b.dataset.sell, n: b.dataset.n === 'all' ? 'all' : 1 }));
  body.querySelectorAll('[data-eat]').forEach(b => b.onclick = () => send({ t: 'eat', item: b.dataset.eat }));
  body.querySelectorAll('[data-repair]').forEach(b => b.onclick = () => send({ t: 'repair', tool: b.dataset.repair }));
  body.querySelectorAll('[data-rebuy]').forEach(b => b.onclick = () => send({ t: 'rebuy', tool: b.dataset.rebuy }));
  body.querySelectorAll('[data-sellback]').forEach(b => b.onclick = () => ask(`ขายคืนได้ 🪙${sbValue(b.dataset.sellback)} (ตามสภาพ สูงสุด 70% ของราคา) ยืนยัน?`, () => send({ t: 'sellback', item: b.dataset.sellback })));
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
  if (build.on && c === 'Escape' && (build.sel || build.pick != null || build.erase)) { build.sel = null; build.pick = null; build.erase = false; renderBuild(); return; } // Esc ในโหมดตกแต่ง: ยกเลิกสิ่งที่เลือกอยู่ก่อน
  if (build.on && c === 'KeyZ') { undoBuild(); return; }
  if (build.on && (c === 'Delete' || c === 'Backspace') && build.pick != null) { e.preventDefault(); send({ t: 'house', a: 'remove', i: build.pick }); build.pick = null; return; }
  if (c === 'Escape') { closeReport(); closeShop(); closeBag(); closePeople(); closeQuest(); closeAch(); closeStatus(); closeBug(); closeHub(); setMenu(false); setVehMenu(false); closeArcade(); closeCinema(); closeTown(); closeAdmin(); closePlots(); closeHomeChoice(); $('ask').classList.add('hidden'); if (tradeSt) send({ t: 'trade', a: 'cancel' }); hidePicker(); return; }
  if (c === 'KeyN') { if (!e.repeat) hornPress('k'); return; }
  if (c === 'KeyV' && me && inTown()) { const own = Object.keys(Shared.VEHICLES).filter(v => inv['veh_' + v] > 0); if (me.veh) send({ t: 'veh', v: '' }); else if (own.length) send({ t: 'veh', v: own[own.length - 1] }); else toast('ยังไม่มียานพาหนะ ซื้อได้ที่ร้านยานพาหนะ 🚲'); return; }
  if (c === 'KeyQ') { const i = TOOL_LIST.indexOf(selTool); let n = i; do { n = (n + 1) % TOOL_LIST.length; } while (toolLocked(TOOL_LIST[n])); selTool = TOOL_LIST[n]; ls.set('mw_tool', selTool); slot = 0; hidePicker(); renderHud(); toast(`${toolInfo(selTool).e} ${TOOL_SHORT[selTool]}`); playSfx('click'); return; } // Q = สลับเครื่องมือในช่อง 1
  if (modalOpen() && ((c === 'KeyP' && !peopleShown()) || ((c === 'KeyB' || c === 'KeyI') && !bagShown()) || (c === 'KeyC' && !bagShown()) || c === 'KeyH')) return; // มีหน้าต่างอื่นเปิดอยู่ = ไม่เปิดซ้อน
  if (c === 'KeyP') { peopleShown() ? closePeople() : openPeople(); return; }
  if (c === 'KeyB' || c === 'KeyI') { $('bagBtn').onclick(); return; }
  if (c === 'KeyC') { $('statBtn').onclick(); return; }
  if (c === 'KeyH') { homeAction(); return; }
  if (c === 'KeyR' && build.on) { rotateBuild(); return; }
  if (c === 'KeyL') { if (inv.lamp > 0) $('lampBtn').onclick(); return; }
  if (c === 'KeyM') { setMini(miniState === 'off' ? 'small' : miniState === 'small' ? 'big' : 'off'); return; }
  const dg = /^(?:Digit|Numpad)([1-9])$/.exec(c);
  if (dg && +dg[1] <= SLOTS.length) { pickSlot(+dg[1] - 1); return; }
  if (c === 'Space') { e.preventDefault(); spHeld = true; if (ft) { setReel(true); return; } if (e.repeat) return; act(); holdSpace(); return; } // e.repeat: กดค้างไม่ให้ยิง act ซ้ำ (ไม่งั้นตอนรอปลากินจะดึงเบ็ดกลับเอง ตกไม่ได้) // ชักเย่ออยู่ = กดค้างกรอสาย
  if (c.startsWith('Arrow')) e.preventDefault();
  keys[c] = true;
  mouse.active = false;
});
// กันปุ่มเดินค้าง (ตัวละครเดินเองและยกเลิกการคลิกเดิน): ถ้าไม่ได้รับ keyup (เช่น เปิดเมนูคลิกขวา/สลับหน้าต่าง/IME ภาษาไทย) ปุ่มจะค้างจนรีเฟรช
const keyName = {};
const clearKeys = () => { for (const k in keys) keys[k] = false; };
addEventListener('keyup', e => { if (e.code === 'Space') { spHeld = false; setReel(false); stopHoldAct(); } keys[e.code] = false; for (const k in keyName) if (keyName[k] === e.key.toLowerCase()) keys[k] = false; delete keyName[e.code]; });
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
const reachOf = (tx, ty) => (toolId() === 'rod' && MAP[ty] && (MAP[ty][tx] === T.WATER || (inOcean() && MAP[ty][tx] === T.CAVE)) ? (inOcean() ? Shared.OCEAN.castRange : 999) : 2); // เบ็ดโยนไกลได้เฉพาะไปที่น้ำ ของอย่างอื่นยังต้องอยู่ใกล้
const nearWater = (x, y) => { for (let dy = -FISH_SHORE; dy <= FISH_SHORE; dy++) for (let dx = -FISH_SHORE; dx <= FISH_SHORE; dx++) if (MAP[y + dy] && MAP[y + dy][x + dx] === T.WATER) return true; return false; };
const myTile = () => [Math.floor(me.x / TS), Math.floor(me.y / TS)];
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const inReach = (tx, ty) => { const [px, py] = myTile(); return cheb(tx, ty, px, py) <= reachOf(tx, ty); };
// ปุ่ม A / Space ใช้กับสิ่งที่เดิมแตะได้อย่างเดียว: ลิฟต์เหมือง • ป้าย Arcade Hub • เรือ/ป้ายออกทะเล (กฎ: ของใหม่ที่โต้ตอบได้ ต้องใช้ปุ่ม Action ได้เสมอ)
function contextAct(now) {
  const [fx, fy] = Shared.facing(me.x, me.y, me.dir), [px, py] = myTile(), dk = Shared.SEA.dock;
  if (Shared.nearLift(me.x, me.y)) { stopWalk(); lastAct = now; actGap = 300; openLift(); return true; }
  if (hubSignAt(fx, fy)) { stopWalk(); lastAct = now; actGap = 300; openHub(); return true; }
  if (!holdAct && !Shared.shopAt(fx, fy)) { // ยืนแถวหน้าประตูร้าน (ช่องใต้ประตู ±1 ช่อง) แล้วกด A/Space ทิศไหนก็เปิดร้านนั้น (กฎ Action: เดิมต้องหันหน้าชนอาคารถึงเปิด มือถือหันตรงๆ ยาก) • ร้านปิดจะได้ข้อความจากเซิร์ฟเวอร์เอง
    const sb = BUILDINGS.find(q => q.counter[0] && py === q.counter[0][1] + 1 && Math.abs(px - q.counter[0][0]) <= 1);
    if (sb) { stopWalk(); lastAct = now; actGap = 300; send({ t: 'act', tool: toolId(), tx: sb.counter[0][0], ty: sb.counter[0][1] }); return true; }
  }
  const pcp = me.pet && !me.veh && !me.psick ? me.cp : null, pst0 = me.pet ? petSt[me.pet] : null; // ลูบหัวสัตว์ตัวเอง: หันหน้าหาสัตว์ และพ้นคูลดาวน์ (คูลดาวน์ 10 นาที จึงไม่แย่งปุ่ม Action เวลาทำงานบ่อย)
  if (pcp && pst0 && !pst0.sick && petPatLeft(pst0) <= 0 && Math.hypot(pcp.x - (fx + 0.5) * TS, pcp.y - (fy + 0.5) * TS) <= TS * 0.8) { stopWalk(); lastAct = now; actGap = 300; pst0.pat = Date.now(); send({ t: 'petcare', a: 'pat' }); return true; }
  if ((fx === dk.x && fy === dk.y) || (cheb(px, py, dk.x, dk.y) <= 2 && toolId() !== 'rod')) { stopWalk(); lastAct = now; actGap = 300; send({ t: 'act', tool: toolId(), tx: dk.x, ty: dk.y }); return true; } // บนเกาะ: ยืนใกล้เรือ/ป้ายแล้วกด A = ออกทะเล (ถือเบ็ดต้องหันหน้าหาเรือ ไม่งั้นเป็นการตกปลารอบเกาะ)
  return false;
}
function houseAct(now) { // ปุ่ม A/Space ในบ้าน: เก้าอี้/โซฟา/เตียงที่ใกล้สุด (ไม่เกิน 2.5 ช่อง) = นั่ง/นอน • ยืนที่พรมหน้าประตู = เดินออก (เดิมต้องแตะอย่างเดียว)
  if (build.on) return;
  let best = -1, bd = 2.5 * TS;
  for (const [i, it] of furn) { if (!FURN[it.f] || !(FURN[it.f].seat || FURN[it.f].bed)) continue; const d = Math.hypot(it.x * TS - me.x, it.y * TS - me.y); if (d <= bd) { bd = d; best = i; } }
  if (best >= 0) { stopWalk(); lastAct = now; actGap = 300; send({ t: 'act', tool: '', i: best }); return; }
  const door = Shared.HOUSE;
  if (me.x >= door.door[0] * TS && me.x <= (door.door[1] + 1) * TS && me.y >= (door.y1 - 1.2) * TS && me.y <= door.y1 * TS + 8) { lastAct = now; actGap = 300; walkHouse(Shared.HOUSE_SPAWN.x, (door.y1 + 0.5) * TS); }
}
function act(tx, ty) {
  const now = performance.now();
  if (!me || chatFocus || modalOpen() || now - lastAct < actGap) return;
  if (scene && tx === undefined) { houseAct(now); return; } // ในบ้านใช้เครื่องมือฟาร์มไม่ได้ ปุ่ม A = นั่ง/นอนที่ใกล้สุด หรือออกจากบ้านถ้ายืนที่พรมหน้าประตู
  if (tx === undefined && inTown() && !ft && contextAct(now)) return;
  if (inSea() && toolId() !== 'rod') { toast('บนเรือใช้เบ็ด 🎣 ตกปลา (เลือกที่ช่องเครื่องมือ)'); return; }
  if (tx === undefined && recallOk() && !oreK.has(Shared.facing(me.x, me.y, me.dir).join(','))) { lastAct = now; actGap = 300; askRecall(now); return; } // ไม่ได้หันหาแร่ = ถามยืนยันใช้ตั๋ววาป
  if (cave && !inSea() && toolId() !== 'pick') { toast('ในถ้ำใช้อุปกรณ์ขุด ⚒️ ขุดแร่ (เลือกที่ช่องเครื่องมือ)'); return; }
  const o = { t: 'act', tool: scene ? '' : toolId() }; if (o.tool === 'rod') o.bait = selBait;
  if (tx !== undefined) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return;
    if (!inReach(tx, ty)) { toast('ไกลเกินไป เดินเข้าไปใกล้ๆ ก่อน'); return; }
    const [px, py] = myTile(), dx = tx - px, dy = ty - py;
    if (dx || dy) me.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
    o.tx = tx; o.ty = ty;
  }
  const kind = scene ? '' : PixelAction.kindOf(me.held), reel = kind === 'fish' && !!me.fs, k = reel ? 'reel' : kind; // ท่าทำงาน (pixelaction.js) ตกปลาอยู่แล้ว = ท่าดึงเบ็ด
  lastAct = now; actGap = k ? PixelAction.dur(k) : 200; swing = 0.25; me.useAt = performance.now(); me.useK = k; me.actAt = me.useAt; me.actPt = o.tx !== undefined ? [(o.tx + 0.5) * TS, (o.ty + 0.5) * TS] : null; // จุดกระทบของท่าทำงาน = ช่องที่กด
  if (!k || reel) { send(o); return; } // ดึงเบ็ดส่งทันที (เกจต้องจับจังหวะ) ของอื่นไม่มีท่า
  send({ t: 'sw' }); // เริ่มเงื้อ: คนรอบตัวเห็นท่าพร้อมกัน
  const S = PixelAction.SHEETS[k]; setTimeout(() => { if (me && me.actAt === me.useAt) send(o); }, S.hit * S.ms); // ผลจริง (แร่ร้าว/แตก ต้นไม้สั่น/ล้ม ทุ่นลอย) เกิดตรงจังหวะกระทบของท่า
}

// ---------- คลิก/แตะ: เดินไป หรือใช้งานช่องนั้น ----------
const solidTile = (tx, ty) => {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
  const t = MAP[ty][tx];
  return t === T.WATER || t === T.TREE || t === T.BUILD || t === T.FENCE || t === T.SHOP || t === T.FURN || t === T.LANDMARK || t === T.WALL || t === T.VOID || t === T.CLIFF || t === T.ROCK || t === T.ORE;
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
  if (inSea()) return (t === T.WATER || (inOcean() && t === T.CAVE)) && id === 'rod'; // บนเรือตกปลาได้อย่างเดียว
  if (cave) return t === T.ORE && id === 'pick'; // ในถ้ำมีแค่ก้อนแร่ให้ขุด
  if (t === T.SHOP || (t === T.BUILD && shopAt(tx, ty)) || animalAt(tx, ty) || cinemaAt(tx, ty)) return true;
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
  if (inTown() && (inHouseBld(tx, ty) || (tx === Shared.HOUSE_DOOR.x && ty === Shared.HOUSE_DOOR.y))) { // แตะตัวบ้าน/ประตู = เดินไปที่ประตู (ยืนอยู่แล้วก็ถามเลย)
    const [px, py] = myTile(); if (px === Shared.HOUSE_DOOR.x && py === Shared.HOUSE_DOOR.y) { openHomeChoice(); return; }
    tx = Shared.HOUSE_DOOR.x; ty = Shared.HOUSE_DOOR.y;
  }
  if (inTown() && tx === Shared.MINE.lift.x && ty === Shared.MINE.lift.y) { stopWalk(); if (Shared.nearLift(me.x, me.y)) openLift(); else toast('เดินไปยืนใกล้ลิฟต์เหมือง 🛗 ที่ปากถ้ำก่อน'); return; } // แตะลิฟต์ = เปิดพาเนลตั๋ว (ไกลไป = บอกให้เดินไป)
  if (inTown() && hubSignAt(tx, ty)) { stopWalk(); openHub(); return; } // กดป้าย Arcade Hub = เปิดแต้ม/อันดับ
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
  if (e.pointerType === 'mouse') { if (!me) return; mouse.active = true; [mouse.tx, mouse.ty] = tileAt(e); if (scene) [mouse.sx, mouse.sy] = isoPtr(e); if (dragB && dragB.mouse && Math.hypot(mouse.sx - dragB.sx, mouse.sy - dragB.sy) > 6) dragB.moved = true; if (panDrag) { bz.px -= (e.clientX - panDrag.x) * (canvas.width / innerWidth) / zoom; bz.py -= (e.clientY - panDrag.y) * (canvas.height / innerHeight) / zoom; panDrag.x = e.clientX; panDrag.y = e.clientY; } return; }
  const p = ptrs.get(e.pointerId); if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (dragB && !dragB.mouse && ptrs.size === 1 && scene) { const [x, y] = isoPtr(e); if (Math.hypot(x - dragB.sx, y - dragB.sy) > 8) { dragB.moved = true; clearTimeout(dragB.lpT); } dragB.lx = x; dragB.ly = y; }
  if (scene && build.on && (build.sel || build.pick != null) && ptrs.size === 1 && !dragB) touchAim = isoPtr(e); // เงาตามนิ้ว
  if (pinch && ptrs.size >= 2 && pinch.d0 > 0) { // บีบ/ถ่างสองนิ้ว = ซูม (ตกแต่งบ้าน: ซูมเข้าแล้วลากสองนิ้วเลื่อนมุมมองได้)
    if (scene && build.on) {
      const v = [...ptrs.values()], mx = (v[0].x + v[1].x) / 2, my = (v[0].y + v[1].y) / 2;
      bz.px -= (mx - pinch.mx) * (canvas.width / innerWidth) / zoom; bz.py -= (my - pinch.my) * (canvas.height / innerHeight) / zoom; pinch.mx = mx; pinch.my = my;
      bz.z = Math.max(1, Math.min(3, pinch.b0 * pinchDist() / pinch.d0)); resize();
    } else setZoom(pinch.z0 * pinchDist() / pinch.d0);
  }
});
canvas.addEventListener('pointerleave', () => { mouse.active = false; });
canvas.addEventListener('pointerdown', e => {
  if (!me) return;
  if (e.pointerType === 'mouse') { // เมาส์: แตะช่องทำงานทันทีเหมือนเดิม
    if (e.button !== 0) { if (scene && build.on && (build.sel || build.pick != null || build.erase)) { build.sel = null; build.pick = null; build.erase = false; renderBuild(); } else if (scene && build.on && bz.z > 1) panDrag = { x: e.clientX, y: e.clientY }; return; }
    hidePicker(); if (scene) { [mouse.sx, mouse.sy] = isoPtr(e); mouse.active = true; const h = buildCanDrag() ? hitItem(mouse.sx, mouse.sy) : null; if (h != null) { dragB = { i: h, sx: mouse.sx, sy: mouse.sy, moved: false, mouse: true }; return; } houseIsoClick(mouse.sx, mouse.sy); return; }
    const [tx, ty] = tileAt(e); mouse.active = true; mouse.tx = tx; mouse.ty = ty;
    flash = { tx, ty, t: performance.now() }; onTileClick(tx, ty); return;
  }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() }); // มือถือ: แตะทำงานตอนปล่อยนิ้ว (แยกจาก pinch)
  if (scene && ptrs.size === 1 && inMyHouse() && !build.erase) { // กดค้างที่ของ = หยิบของ เมนูตกแต่งเด้งขึ้นมาให้ลาก/หมุนได้ทันที
    const [sx, sy] = isoPtr(e), h = hitItem(sx, sy);
    if (h != null && (build.pick == null || h === build.pick || !build.on)) { dragB = { i: h, sx, sy, moved: false, lp: false }; dragB.lpT = setTimeout(() => buildLongPick(h), 420); }
    else if (build.on && (build.sel || build.pick != null)) touchAim = [sx, sy];
  }
  if (ptrs.size === 2) { const v = [...ptrs.values()]; touchAim = null; pinch = { d0: pinchDist(), z0: userZoom, b0: bz.z, mx: (v[0].x + v[1].x) / 2, my: (v[0].y + v[1].y) / 2 }; }
});
const endPtr = e => {
  if (e.pointerType === 'mouse') { panDrag = null; if (dragB && dragB.mouse) { const d = dragB; dragB = null; if (d.moved) { const [x, y] = isoPtr(e); buildDrop(d, x, y); } else houseIsoClick(d.sx, d.sy); } return; }
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
  if (dragB && !dragB.mouse && ptrs.size === 0) { const d = dragB; dragB = null; clearTimeout(d.lpT); if (d.moved) { if (build.on) buildDrop(d, d.lx, d.ly); } else if (!d.lp) houseIsoClick(d.sx, d.sy); return; }
  const wasPinch = !!pinch; if (ptrs.size < 2) pinch = null;
  const aim = touchAim; if (ptrs.size === 0) touchAim = null;
  if (p && !wasPinch && aim && ptrs.size === 0 && scene && build.on && (build.sel || build.pick != null) && !modalOpen()) { buildClick(aim[0], aim[1], null); return; } // เลือกของไว้แล้วแตะ/ลากบนพื้น: ปล่อยนิ้วตรงไหนวางตรงนั้น
  if (!p || wasPinch) return; // นิ้วที่เป็นส่วนหนึ่งของ pinch ไม่นับเป็นแตะ
  const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy), dur = performance.now() - p.t;
  if (ptrs.size === 0 && moved < 18 && dur < 400 && scene) { hidePicker(); const [sx, sy] = isoPtr(e); houseIsoClick(sx, sy); return; }
  if (ptrs.size === 0 && moved < 18 && dur < 400) { hidePicker(); const [tx, ty] = tileAt(e); flash = { tx, ty, t: performance.now() }; onTileClick(tx, ty); } // แตะสั้นๆ นิ้วเดียว = ทำงานช่องนั้น
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
// กดค้างปุ่ม A = ทำงานซ้ำตามจังหวะท่าเดิม (ขุด/ตัด/ขุดดิน/รดน้ำ ฯลฯ) ปล่อยนิ้วหยุด • เบ็ดไม่วนซ้ำ (ต้องจับจังหวะเอง) • act() กันจังหวะด้วย actGap เองและเซิร์ฟเวอร์ตัดสินกติกาเหมือนเดิม
let holdAct = 0, abHeld = false, spHeld = false; // abHeld/spHeld = ปุ่ม A/Space กำลังถูกกดค้าง (ตกปลา: กดค้างมาก่อนปลากิน เริ่มชักเย่อแล้วต้องกรอสายทันที) // วนซ้ำเฉพาะช่องเครื่องมือ (ไม่รวมเบ็ด/เมล็ด/อาหาร กันข้อความเตือนรัว)
const stopHoldAct = () => { if (holdAct) { clearInterval(holdAct); holdAct = 0; } };
// PC: กด Space ค้างทำงานซ้ำเหมือนกดค้างปุ่ม A บนมือถือ (เครื่องมือที่ไม่ใช่เบ็ด) ปล่อยแล้วหยุด • เบ็ดยังกดครั้งเดียว (ค้างไว้ใช้กรอสายตอนชักเย่อ) • ตัวจับเวลาเดียวกับปุ่ม A จึงไม่ซ้อนกัน
const holdSpace = () => { if (SLOTS[slot].id !== 'tool' || toolId() === 'rod') return; stopHoldAct(); holdAct = setInterval(() => { if (!spHeld || ft || modalOpen()) { stopHoldAct(); return; } if (SLOTS[slot].id === 'tool' && toolId() !== 'rod') act(); }, 60); };
$('abtn').addEventListener('pointerdown', e => {
  abHeld = true; e.preventDefault(); stopWalk(); if (ft) { setReel(true); return; } act();
  stopHoldAct(); holdAct = setInterval(() => { if (ft || modalOpen()) { stopHoldAct(); return; } if (SLOTS[slot].id === 'tool' && toolId() !== 'rod') act(); }, 60);
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) { $('abtn').addEventListener(ev, () => { abHeld = false; setReel(false); stopHoldAct(); }); $('ffight').addEventListener(ev, () => setReel(false)); }
addEventListener('blur', stopHoldAct);
$('ffight').addEventListener('pointerdown', e => { e.preventDefault(); setReel(true); }); // แตะ/คลิกค้างที่แผงชักเย่อ = กรอสาย (เมาส์และมือถือ)
addEventListener('blur', () => setReel(false));
// กดค้างบนมือถือ (ปุ่ม A / แผงชักเย่อ) ห้ามเบราว์เซอร์เริ่มเลือกข้อความหรือเด้งเมนูคัดลอก: กัน touchstart/selectstart/contextmenu และล้างการเลือกที่หลุดมา
for (const el of [$('abtn'), $('ffight')]) { for (const ev of ['touchstart', 'touchmove']) el.addEventListener(ev, e => { if (e.cancelable) e.preventDefault(); }, { passive: false }); for (const ev of ['contextmenu', 'selectstart', 'dragstart']) el.addEventListener(ev, e => e.preventDefault()); }
document.addEventListener('selectstart', e => { if (ft && !(e.target.closest && e.target.closest('input,textarea'))) e.preventDefault(); }); // ระหว่างชักเย่อไม่ให้เลือกข้อความที่ไหนเลย (นิ้วอาจเลื่อนไปโดนตัวอักษรอื่น)
const clearSel = () => { try { const s = getSelection(); if (s && s.rangeCount) s.removeAllRanges(); } catch (e) {} };
function setReel(on) { if (on) clearSel(); if (!ft || ft.end || ftHold === on) return; ftHold = on; send({ t: 'reel', on }); } // ส่งเฉพาะตอนสถานะเปลี่ยน (กด/ปล่อย) เซิร์ฟเวอร์เดินเวลาตามสถานะนี้

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
window.__mw = { rain(on) { rainForce = on === undefined || on === null ? null : !!on; }, snow(on) { snowForce = on === undefined || on === null ? null : !!on; }, openShop: (k, t) => { openShop(k); if (t) { farmTab = t; renderShop(); } }, get base() { return base; }, actionSheet: () => actionSheet().toDataURL(), petSheet: () => petSheet().toDataURL(), get caveFlr() { return caveFlr; }, get oreS() { return oreS; }, peers, keys, openHub: () => openHub(), hubSignAt: (x, y) => hubSignAt(x, y), renderArcade: () => renderArcade(), setArc: t => { arcTable = t; }, get npcs() { return npcs; }, get pets() { return pets; }, get drawPlayer() { return drawPlayer; }, get me() { return me; }, get cave() { return cave; }, get oreK() { return oreK; }, get inv() { return inv; }, get skills() { return skills; }, get selTool() { return selTool; }, get MAP() { return MAP; }, handle, send, setHour(h) { timeOffset = ((h - 6 + 24) % 24) / 24 * CLOCK_MS - (Date.now() % CLOCK_MS); } }; // สำหรับดีบัก
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
  const q = roster.get(id); callPend = 0; callIn = 0; clearTimeout(callTimer); callBox(false);
  callWith = id; if (!micOn) { callMicOn = true; $('micBtn').click(); }
  setCall(id); toast(`📞 สายต่อกับ ${q ? q.name : 'เพื่อน'} แล้ว เปิดไมค์ทั้งสองฝั่ง — มีแค่คุณสองคนที่ได้ยิน`);
}
function startCall(id) {
  if (callWith || callPend || callIn) leaveCall();
  const q = roster.get(id); if (!q) return;
  callPend = id; pcSend(id, 'ring'); toast(`📞 กำลังโทรหา ${q.name} รอให้รับสาย...`); renderPeople(true);
  clearTimeout(callTimer); callTimer = setTimeout(() => { if (callPend === id) cancelCall(); }, 30000); // ไม่มีคนรับภายใน 30 วินาทีให้ยกเลิกเอง
}
function cancelCall() { // ยกเลิกการโทรที่ยังไม่มีคนรับ
  if (!callPend) return; pcSend(callPend, 'end'); const q = roster.get(callPend); callPend = 0; toast(`📵 ยกเลิกการโทร${q ? 'หา ' + q.name : ''}`); renderPeople(true);
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
    callIn = from; const q = roster.get(from);
    callBox(true, `📞 ${q ? q.name : 'เพื่อน'} โทรหาคุณ`); clearTimeout(callTimer); callTimer = setTimeout(declineCall, 30000);
    renderPeople(true);
  } else if (k === 'ok') { // อีกฝั่งรับสายแล้ว
    if (callPend === from) { beginCall(from); if (!peers.has(from)) callPeer(from); } // ผู้โทรเป็นฝ่ายส่งสัญญาณเสียงก่อน (กรณีคนละฉาก)
  } else if (k === 'no') { // ไม่รับ หรือไม่ว่าง
    if (callPend === from) { callPend = 0; const q = roster.get(from); toast(`📵 ${q ? q.name : 'เพื่อน'} ไม่รับสาย`); renderPeople(true); }
  } else if (k === 'end') { // อีกฝั่งยกเลิกหรือวางสาย
    if (callIn === from) { callIn = 0; clearTimeout(callTimer); callBox(false); renderPeople(true); }
    else if (callWith === from || callPend === from) { const q = roster.get(from); leaveCall(); toast(`📵 ${q ? q.name : 'เพื่อน'} วางสายแล้ว`); }
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
  { const pl = players.get(id); if (pl && isBlockedName(pl.name)) return; } // ไม่ต่อเสียงหาคนที่บล็อกไว้
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
  { const q = roster.get(from); if (q && isBlockedName(q.name)) return; } // คนที่บล็อกไว้ ไม่รับสัญญาณเสียง
  if (!players.has(from) && ![callWith, callPend, callIn].includes(from)) return; // สัญญาณเสียงค้างจากคนอยู่คนละฉาก ไม่รับ (ยกเว้นคู่สายโทรส่วนตัว)
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
    const p = roster.get(id) || players.get(id), partner = id === callWith;
    if (!pe.audio || !p || !me || (!partner && !players.has(id))) return;
    pe.audio.volume = pe.vol = isMuted(p) || (callWith && !partner) ? 0 : partner ? 1 : voiceGain(Math.hypot(p.x - me.x, p.y - me.y) / TS); // ระหว่างโทรส่วนตัวได้ยินคู่สายคนเดียว
  });
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  levels.forEach((l, id) => {
    const p = roster.get(id) || players.get(id); if (!p) return;
    l.an.getByteTimeDomainData(l.buf);
    let s = 0; for (const v of l.buf) s += (v - 128) * (v - 128);
    const pe = peers.get(id);
    p.speaking = p.voice && Math.sqrt(s / l.buf.length) > 4 && (!pe || pe.vol === undefined || pe.vol > 0.05);
  });
}
function setMicUi() { const m = $('micMenu'); m.classList.toggle('on', micOn); m.textContent = micOn ? '🎙️' : '🎤'; m.dataset.lbl = micOn ? 'ไมค์เปิด' : 'ไมค์'; const b = $('micBtn'); b.classList.toggle('on', micOn); b.textContent = micOn ? '🎙️' : '🎤'; b.title = micOn ? 'ไมค์: เปิดอยู่ (กดเพื่อปิด)' : 'ไมค์: ปิดอยู่ (กดเพื่อเปิด)'; } // ไมค์ = 🎙️ เปิด / 🎤 ปิด • ลำโพง = 🔊 เปิด / 🔇 ปิด (ไอคอน 🔇 ข้างชื่อผู้เล่นหมายถึงปิดลำโพง)
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
const volGet = (k, d) => { const v = parseFloat(ls.get(k)); return v >= 0 && v <= 1 ? v : d; };
let sfxVol = volGet('mw_sfxvol', 1), musicVol = volGet('mw_musvol', 0.7); // เสียงเอฟเฟกต์ / เสียงดนตรี (เตรียมไว้ ยังไม่มีเพลง) 0..1 เก็บใน localStorage
syncSndUi(); // ตั้งแถบเสียงในเมนู ☰ ตามค่าที่เก็บไว้
const sfxGain = () => 0.55 * sfxVol; // ตัวคูณเสียงรวมของเอฟเฟกต์ทั้งหมด (ทุกเสียงผ่าน smaster)
function sAudio() {
  if (!sctx) { try { sctx = new (window.AudioContext || window.webkitAudioContext)(); smaster = sctx.createGain(); smaster.gain.value = sfxGain(); smaster.connect(sctx.destination); } catch (e) { return null; } }
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
  lvsparkle: k => { [1568, 2093, 2637].forEach((f, i) => tone(f, 0.28, { type: 'sine', vol: 0.09, k, delay: 0.15 + i * 0.09 })); }, // ติ๊งวิบวับซ้อนเบาๆ ตอนแบนเนอร์เด้ง
  crit: k => { noise(0.1, { f: 1500, to: 7000, q: 0.8, vol: 0.3, k }); tone(180, 0.2, { to: 45, vol: 0.55, k, delay: 0.06 }); noise(0.14, { type: 'lowpass', f: 1400, vol: 0.4, k, delay: 0.06 }); tone(2093, 0.3, { type: 'square', vol: 0.1, lp: 5000, k, delay: 0.07 }); tone(3136, 0.34, { type: 'sine', vol: 0.11, k, delay: 0.07 }); tone(1047, 0.13, { type: 'sawtooth', to: 1568, vol: 0.1, lp: 3500, k, delay: 0.12 }); }, // เสียงต่อสู้: ฟันตัดลม → กระแทกหนัก → โลหะกังวานสั้นๆ
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
  const uno = t.game === 'uno', party = PARTY_GAMES.has(t.game);
  const amPlayer = (uno || party) ? t.players.some(p => p.id === myId && !p.out) : (t.xId === myId || t.oId === myId);
  if (m.open) { arcTable = t; unoWild = -1; openArcade(); return; }
  if (t.state === 'playing' && was !== 'playing' && amPlayer) { arcTable = t; unoWild = -1; openArcade(); toast(uno ? '🃏 เกม UNO เริ่มแล้ว!' : party ? '🎮 เกมเริ่มแล้ว!' : '🎮 เกม XO เริ่มแล้ว!'); return; }
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
  if (b.dataset.arc) send({ t: 'arc', a: b.dataset.arc, id: arcTable.id, bet: b.dataset.arc === 'bot' ? arcBotBet : arcBet, max: arcMax });
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
function openPeople() { closeOthers('people'); $('people').classList.remove('hidden'); renderPeople(true); }
function closePeople() { $('people').classList.add('hidden'); }
// ปิดเสียงทุกคนอยู่ (และไม่ได้เปิดเสียงใครเป็นข้อยกเว้น) = ไม่ได้ยินใครเลย → บอกเซิร์ฟเวอร์ให้ติดป้ายที่ตัวละคร เพื่อนจะได้รู้
const isDeaf = () => mute.all && !Object.values(mute.names).includes(false);
function syncDeaf() { if (!me) return; const d = isDeaf(); if (d !== !!me.deaf) { me.deaf = d; send({ t: 'deaf', on: d }); } }
function setSpkUi() { const b = $('spkBtn'); if (!b) return; b.classList.toggle('off', !!mute.all); b.textContent = mute.all ? '🔇' : '🔊'; b.title = mute.all ? 'ลำโพง: ปิดอยู่ (กดเพื่อเปิดเสียงเพื่อน)' : 'ลำโพง: เปิดอยู่ (กดเพื่อปิดเสียงเพื่อนทั้งหมด)'; }
function applyMute() { saveMute(); syncDeaf(); setSpkUi(); lastLevel = 0; updateSpeaking(performance.now() + 1000); updateOnline(); renderPeople(true); }
function renderPeople(force) {
  if (!peopleShown() || !me) return;
  const list = [...roster.values()].sort((a, b) => (a.id === myId ? -1 : b.id === myId ? 1 : a.name.localeCompare(b.name)));
  const sig = JSON.stringify([mute, callWith, callPend, callIn, list.map(p => [p.id, p.name, p.color, p.voice, p.deaf, p.status]), [...blockKeys], myMuteUntil > Date.now()]);
  if (force || sig !== peopleSig) {
    peopleSig = sig;
    const others = list.filter(p => p.id !== myId), talking = others.filter(p => p.voice).length, off = others.filter(isMuted).length;
    let h = `<div class="row"><span><b>🔊 เสียงเพื่อน</b><br><small>เปิดไมค์ ${talking} คน • ปิดเสียงไว้ ${off}/${others.length} คน</small></span>`
      + `<small style="opacity:.7">ปิด/เปิดทั้งหมดที่ปุ่ม ${mute.all ? '🔇' : '🔊'} ข้างไมค์</small></div>`;
    for (const p of list) {
      const m = p.id !== myId && isMuted(p);
      h += `<div class="row prow" data-id="${p.id}"><span><span class="dot" style="background:${esc(p.color)}"></span> <b>${esc(p.name)}</b>${p.id === myId ? ' (คุณ)' : ''} ${p.voice ? '🎙️' : ''}${p.deaf ? ' 🔇' : ''}<span class="spk"></span>${p.id === myId && myMuteUntil > Date.now() ? '<br><small style="color:#c0392b">🤐 ผู้ดูแลปิดเสียงคุณอยู่</small>' : ''}${p.status ? `<br><small style="opacity:.8">💭 ${esc(p.status)}</small>` : ''}</span>`
        + (p.id === myId ? '' : `<span class="pbtns"><button class="btn small${callWith === p.id || callPend === p.id ? ' on' : ''}" data-call="${p.id}" title="โทรส่วนตัว: ต้องให้อีกฝ่ายรับสายก่อน">${callWith === p.id ? '📵 วางสาย' : callPend === p.id ? '⏳ ยกเลิก' : callIn === p.id ? '📞 รับสาย' : '📞 โทร'}</button> <button class="btn small" data-trade="${p.id}" title="ชวนเทรดของ (ต้องอยู่ใกล้กัน ${TRADE.range} ช่อง)">🤝 เทรด</button> <button class="btn small${m ? ' muted' : ''}" data-mute="${p.id}">${m ? '🔇 เปิดเสียง' : '🔊 ปิดเสียง'}</button> <button class="btn small${isBlockedName(p.name) ? ' on' : ''}" data-block="${p.id}" title="บล็อก: ไม่เห็นแชตและไม่ได้ยินเสียงกันและกัน">${isBlockedName(p.name) ? '✅ เลิกบล็อก' : '🚫 บล็อก'}</button> <button class="btn small muted" data-report="${p.id}" title="รายงานคนรบกวน ให้ผู้ดูแลตรวจสอบ">🚩 รายงาน</button></span>`) + '</div>';
    }
    const onl = new Set(list.map(p => p.name.toLowerCase())), offB = blockList.filter(x => !onl.has(x.key));
    if (offB.length) h += '<div class="sec">🚫 บล็อกไว้ (ไม่ได้อยู่ในห้อง)</div>' + offB.map(x => `<div class="row"><span><b>${esc(x.name)}</b></span><span><button class="btn small" data-unblockname="${esc(x.name)}">✅ เลิกบล็อก</button></span></div>`).join('');
    $('peopleBody').innerHTML = h;
  }
  $('peopleBody').querySelectorAll('.prow').forEach(r => { // ไฟแสดงว่าใครกำลังพูด (อัปเดตโดยไม่วาดรายการใหม่ ปุ่มจะได้ไม่กระตุก)
    const p = roster.get(+r.dataset.id), talk = !!(p && p.speaking);
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
  if (b.dataset.unblockname) { send({ t: 'block', name: b.dataset.unblockname, on: false }); return; }
  if (b.dataset.block) {
    const q = roster.get(+b.dataset.block); if (!q) return;
    if (isBlockedName(q.name)) send({ t: 'block', id: q.id, on: false });
    else ask('บล็อก ' + q.name + '?\n(จะไม่เห็นแชตและไม่ได้ยินเสียงกันและกัน เลิกบล็อกได้ในรายชื่อนี้)', () => send({ t: 'block', id: q.id, on: true }));
    return;
  }
  if (b.dataset.report) { closePeople(); openReport(+b.dataset.report); return; }
  if (b.dataset.call) { const id = +b.dataset.call; if (callIn === id) acceptCall(); else if (callWith === id) endCall(); else if (callPend === id) cancelCall(); else startCall(id); return; }
  const p = roster.get(+b.dataset.mute); if (!p) return;
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
function openStatus() { closeOthers('status'); $('statusChips').innerHTML = STATUS_PRESETS.map((t, i) => `<button class="chip" data-sp="${i}">${esc(t)}</button>`).join(''); $('statusIn').value = (me && me.status) || ''; $('status').classList.remove('hidden'); setTimeout(() => $('statusIn').focus(), 50); }
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
function openBug() { closeOthers('bug'); bugSay(''); $('bug').classList.remove('hidden'); if (!isTouch) $('bugText').focus(); }
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
function openHub() { closeOthers('archub'); $('archub').classList.remove('hidden'); send({ t: 'lb' }); renderHub(); }
function closeHub() { $('archub').classList.add('hidden'); }
function renderHub() {
  const el = $('hubBody'), esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), medal = ['🥇', '🥈', '🥉'];
  let h = `<div class="banner" style="background:#fff3cf">🎮 แต้มตู้เกมของคุณ: <b>${arcSt.pts}</b> • สะสมตลอดกาล ${arcSt.total} • สัปดาห์นี้ ${arcSt.wk}</div>`;
  h += `<div class="chips" style="margin:8px 0"><button class="chip${hubTab === 'rank' ? ' sel' : ''}" data-htab="rank">🏆 อันดับ</button><button class="chip${hubTab === 'shop' ? ' sel' : ''}" data-htab="shop">🎁 ร้านรางวัล</button></div>`;
  if (hubTab === 'shop') {
    h += '<p style="font-size:12px;opacity:.7;margin:4px 0 8px">ใช้แต้มตู้เกม (ไม่ใช่เหรียญ) แลกของหายากและฉายาเฉพาะ ที่หาซื้อด้วยเหรียญไม่ได้</p>';
    for (const d of Shared.ARC_SHOP) {
      const i = d.title ? { emoji: d.emoji, name: `ฉายา "${d.title}"` } : itemInfo(d.id), owned = d.title && (arcSt.tt || []).includes(d.id);
      h += `<div class="qrow"><span>${i.emoji} <b>${esc(i.name)}</b></span><span>${owned ? `<button class="btn small" data-abuy="${d.id}">ใช้ฉายานี้</button>` : `<button class="btn small" data-abuy="${d.id}" ${arcSt.pts < d.pts ? 'disabled' : ''}>🎮 ${d.pts}</button>`}</span></div>`;
    }
  } else {
    const list = (arr, unit) => (arr && arr.length) ? arr.map((x, i) => `<div class="qrow"><span>${medal[i] || ('#' + (i + 1))} <b>${esc(x.name)}</b>${x.name === (me && me.name) ? ' <small>(คุณ)</small>' : ''}</span><span><b>${x[unit]}</b> แต้ม</span></div>`).join('') : '<p style="opacity:.7">ยังไม่มีใครเล่น</p>';
    h += '<div class="sec">🏆 สะสมตลอดกาล (Top 10)</div>' + list(lbSt.total, 'total');
    h += '<div class="sec">📅 สัปดาห์นี้ (Top 10)</div>' + list(lbSt.wk, 'wk');
    h += '<p style="font-size:12px;opacity:.65;margin-top:10px">ได้แต้มจากการเล่นตู้เกมกับคนจริง (เล่นจบ +2 • ชนะ +5) ไม่ได้จากบอท/คาสิโน • อันดับสัปดาห์รีเซ็ตทุก 7 วัน</p>';
  }
  el.innerHTML = h;
  el.querySelectorAll('[data-htab]').forEach(b => b.onclick = () => { hubTab = b.dataset.htab; renderHub(); });
  el.querySelectorAll('[data-abuy]').forEach(b => b.onclick = () => send({ t: 'arcbuy', id: b.dataset.abuy }));
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
// ---------- ความละเอียดแคนวาส + ตัววัดเฟรม ----------
// โหมด mw_res: auto | high | mid | low  • auto เริ่มจากขั้นที่เคยลดไว้ (mw_res_auto) และลดลงอย่างเดียว ไม่เพิ่มกลับเอง (กันภาพสั่น)
const RES_CAPS = { high: Infinity, mid: 1.5, low: 1 };
const RES_STEPS = [2, 1.5, 1.25, 1]; // ขั้น dpr ของโหมดอัตโนมัติ
const RES_LOW_FPS = 40, RES_WIN_MS = 3000, RES_GRACE_MS = 3000; // เกณฑ์ลดขั้น: เฉลี่ยต่ำกว่า 40 FPS ติดกัน 2 รอบ รอบละ 3 วิ ไม่นับ 3 วิแรกหลังเข้าเกม/resize
const RES_LABEL = { auto: 'อัตโนมัติ', high: 'สูง', mid: 'กลาง', low: 'ต่ำ' };
let resMode = RES_LABEL[ls.get('mw_res')] ? ls.get('mw_res') : 'auto';
let resAutoCap = RES_STEPS.includes(+ls.get('mw_res_auto')) ? +ls.get('mw_res_auto') : Infinity, curDpr = 1; // ค่าที่เก็บไว้ต้องอยู่ในขั้นที่รู้จักเท่านั้น (กันค่าเพี้ยนทำแคนวาสกว้าง 0)
const resCap = () => resMode === 'auto' ? resAutoCap : RES_CAPS[resMode];
let perfOn = ls.get('mw_perf') === '1' || /[?&]perf=1\b/.test(location.search);
const perf = { last: 0, ft: [], js: [], grace: 0, n: 0, t0: 0, low: 0, lock: 0, txt: '', m: 0, s: new Float64Array(7), acc: new Float64Array(7), mx: new Float64Array(7), shown: new Float64Array(7), shownMx: new Float64Array(7), fr: 0, cn: new Int32Array(4) };
// ตัวจับเวลาส่วนต่างๆ ของ step(): 0 พื้น(base) 1 ตกแต่งพื้น(น้ำ/ฟาร์ม) 2 วัตถุ 3 กลางคืน 4 ฝน/หิมะ 5 แผนที่ย่อ • 6 = อื่นๆ (UI/DOM/เสียง = JS รวม − ผลรวมส่วนอื่น)
function pm(i) { if (!perfOn) return; const t = performance.now(); if (i < 6) perf.s[i] += t - perf.m; perf.m = t; } // i = 6: แค่เลื่อนจุดเริ่มจับเวลา (ไม่นับ)
let stepT0 = 0;
function perfFrame(now) { // เรียกต้นทุก step: เก็บช่วงห่างระหว่างเฟรมของ rAF (อาการที่ผู้เล่นเห็น) + ตัดสินโหมดอัตโนมัติ
  const dt = perf.last ? now - perf.last : 0; perf.last = now;
  if (!joined || !me || document.visibilityState !== 'visible' || dt > 1000) { perf.grace = now + RES_GRACE_MS; perf.n = 0; perf.low = 0; return; }
  if (perfOn && dt > 0) { perf.ft.push(dt); if (perf.ft.length > 120) perf.ft.shift(); }
  if (resMode !== 'auto' || curDpr <= 1 || now < perf.grace) { perf.n = 0; return; }
  if (!perf.n) { perf.n = 0; perf.t0 = now; perf.lock = 0; }
  perf.n++; if (dt >= 30 && dt <= 37) perf.lock++; // นับเฟรมที่ห่างราว 33ms พอดี = จอ/ระบบล็อก 30Hz (โหมดประหยัดพลังงาน iOS)
  if (now - perf.t0 >= RES_WIN_MS) {
    const fps = perf.n * 1000 / (now - perf.t0), locked30 = perf.lock >= perf.n * 0.85; perf.n = 0;
    if (fps < RES_LOW_FPS && !locked30) { // ล็อก 30Hz เฟรมนิ่งที่ 33ms ไม่ใช่เพราะความละเอียด ไม่ลดให้
      if (++perf.low >= 2) { perf.low = 0; const nx = RES_STEPS.find(v => v < curDpr - 0.01); if (nx) { resAutoCap = nx; ls.set('mw_res_auto', String(nx)); resize(); toast('ปรับความละเอียดลงให้เล่นลื่นขึ้น (ตั้งเองได้ที่เมนู ☰)'); } } } else perf.low = 0;
  }
}
function perfJs(ms) {
  if (!perfOn) return; perf.js.push(ms); if (perf.js.length > 120) perf.js.shift();
  let sum = 0; for (let i = 0; i < 6; i++) { const v = perf.s[i]; perf.acc[i] += v; if (v > perf.mx[i]) perf.mx[i] = v; sum += v; perf.s[i] = 0; }
  const o = Math.max(0, ms - sum); perf.acc[6] += o; if (o > perf.mx[6]) perf.mx[6] = o; perf.fr++;
}
function perfFlush() { // ทุก 500ms: สรุปเป็นเฉลี่ยต่อเฟรม + สูงสุดของช่วง แล้วเริ่มช่วงใหม่
  if (perf.fr) for (let i = 0; i < 7; i++) { perf.shown[i] = perf.acc[i] / perf.fr; perf.shownMx[i] = perf.mx[i]; }
  perf.acc.fill(0); perf.mx.fill(0); perf.fr = 0;
}
function perfParts() { const a = perf.shown; return `ground ${a[0].toFixed(1)} deco ${a[1].toFixed(1)} objs ${a[2].toFixed(1)} night ${a[3].toFixed(1)} rain ${a[4].toFixed(1)} mini ${a[5].toFixed(1)} other ${a[6].toFixed(1)}`; }
function perfCounts() { const c = perf.cn; return `${c[0]}/${c[1]}/${c[2]}/${c[3]}`; }
function perfSummary() {
  const f = perf.ft, avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, srt = f.slice().sort((a, b) => a - b);
  const p95 = srt.length ? srt[Math.min(srt.length - 1, Math.floor(srt.length * 0.95))] : 0, mx = srt.length ? srt[srt.length - 1] : 0, a = avg(f), js = avg(perf.js), mp = canvas.width * canvas.height / 1e6;
  const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
  return { fps: a ? 1000 / a : 0, a, p95, mx, js, jsMax: perf.js.length ? Math.max(...perf.js) : 0, w: canvas.width, h: canvas.height, mp, heap };
}
function perfOneLine() {
  const v = perfSummary();
  return `fps ${v.fps.toFixed(0)} frame avg/p95/max ${v.a.toFixed(1)}/${v.p95.toFixed(1)}/${v.mx.toFixed(0)}ms js ${v.js.toFixed(1)}ms canvas ${v.w}x${v.h} (${v.mp.toFixed(2)}MP) res ${resMode}${resMode === 'auto' && isFinite(resAutoCap) ? '@' + resAutoCap : ''} dpr ${curDpr}/${window.devicePixelRatio || 1} view ${innerWidth}x${innerHeight}${v.heap !== null ? ' heap ' + v.heap + 'MB' : ''} parts ${perfParts()} objs-max ${perf.shownMx[2].toFixed(1)} n(tree/ply/ani/all) ${perfCounts()}`;
}
function perfUi() {
  $('perfBtn').textContent = perfOn ? '📈 ตัววัดเฟรม: เปิด' : '📈 ตัววัดเฟรม: ปิด';
  $('perfCopy').classList.toggle('hidden', !perfOn); $('perfBox').classList.toggle('hidden', !perfOn);
  $('resBtn').textContent = '🖼️ ความละเอียด: ' + RES_LABEL[resMode] + (resMode === 'auto' && isFinite(resAutoCap) ? ' (ลดเหลือ ' + resAutoCap + 'x)' : '') + ' • ตอนนี้ ' + curDpr + 'x'; // บอกค่าจริงที่ใช้อยู่ด้วย ผู้เล่นจะเห็นว่ากดแล้วติดไหม
}
setInterval(() => {
  if (!perfOn) return; perfFlush();
  const v = perfSummary(), box = $('perfBox'), hb = $('hudTop').getBoundingClientRect();
  const mb = $('mini').classList.contains('hidden') ? 0 : $('mini').getBoundingClientRect().bottom; box.style.top = Math.round(Math.max(hb.bottom, mb) + 4) + 'px'; // มุมขวาใต้แผนที่ย่อ ไม่ทับแถบเควสต์ฝั่งซ้าย
  const short = innerHeight < 520; // จอเตี้ย (มือถือนอน): ตัดเหลือ 3 บรรทัดไม่ให้ทับปุ่ม A
  box.textContent = (`FPS ${v.fps.toFixed(0)}  ${v.a.toFixed(1)}ms\np95 ${v.p95.toFixed(1)}  max ${v.mx.toFixed(0)}ms\nJS ${v.js.toFixed(1)}ms (max ${v.jsMax.toFixed(1)})\n${v.w}x${v.h} ${v.mp.toFixed(2)}MP\nres ${RES_LABEL[resMode]} dpr ${curDpr}/${window.devicePixelRatio || 1}` + (v.heap !== null ? `\nheap ${v.heap}MB` : '') + `\nground ${perf.shown[0].toFixed(1)} deco ${perf.shown[1].toFixed(1)} objs ${perf.shown[2].toFixed(1)}\nnight ${perf.shown[3].toFixed(1)} rain ${perf.shown[4].toFixed(1)} mini ${perf.shown[5].toFixed(1)}\nother ${perf.shown[6].toFixed(1)} objsMax ${perf.shownMx[2].toFixed(0)}\nn ${perfCounts()}`).split('\n').slice(0, short ? 3 : 12).join('\n');
}, 500);
$('resBtn').onclick = () => {
  const ks = Object.keys(RES_LABEL); resMode = ks[(ks.indexOf(resMode) + 1) % ks.length]; ls.set('mw_res', resMode);
  if (resMode === 'high') { resAutoCap = Infinity; ls.set('mw_res_auto', ''); } // เลือก "สูง" เอง = รีเซ็ตขั้นที่โหมดอัตโนมัติเคยลดไว้
  perf.low = 0; perfUi(); resize(); toast('ความละเอียด: ' + RES_LABEL[resMode]);
};
$('perfBtn').onclick = () => { perfOn = !perfOn; ls.set('mw_perf', perfOn ? '1' : '0'); perf.ft = []; perf.js = []; perf.s.fill(0); perf.acc.fill(0); perf.mx.fill(0); perf.fr = 0; perfUi(); };
$('perfCopy').onclick = () => {
  const t = perfOneLine();
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast('คัดลอกเลขวัดแล้ว'), () => prompt('คัดลอกข้อความนี้ส่งให้เราได้เลย', t));
  else prompt('คัดลอกข้อความนี้ส่งให้เราได้เลย', t);
};
perfUi();
function resize() {
  const dpr = curDpr = Math.min(window.devicePixelRatio || 1, resCap());
  perf.grace = performance.now() + RES_GRACE_MS; perf.n = 0; perf.low = 0; perfUi();
  // ย่อแคนวาสแล้วให้เบราว์เซอร์ขยาย: ขยายเป็นจำนวนเต็ม (เช่น 2→1 บนจอ dpr 2) ใช้ pixelated คมสะอาด; ขยายเศษส่วน (1.5, 1.25) pixelated ทำพิกเซลกว้างไม่เท่ากันเป็นริ้ว ใช้ auto (นุ่มกว่า) ดูดีกว่า
  const sc = (window.devicePixelRatio || 1) / dpr; canvas.style.imageRendering = sc > 1.01 && Math.abs(sc - Math.round(sc)) < 0.01 ? 'pixelated' : '';
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  baseZoom = Math.max(isTouch ? 1.35 : 1.2, Math.min(innerWidth / 720, innerHeight / 450)) * dpr; // auto-fit ตามขนาดจอ/ความละเอียด
  document.documentElement.style.setProperty('--ui', isTouch ? 1 : Math.max(1, Math.min(1.8, Math.min(innerWidth / 1280, innerHeight / 720))).toFixed(2)); // UI คอมจอใหญ่ขยายตามสเกลจอ
  zoom = baseZoom * userZoom;
  if (scene && build.on) { // ตกแต่งบ้าน: ซูมให้เห็นทั้งห้องในพื้นที่ที่ไม่ถูกแถบบน/เมนูตกแต่งบัง
    const tr = $('build').getBoundingClientRect(), hb = $('hudTop').getBoundingClientRect(), tray = tr.width > innerWidth * 0.7;
    const x0 = 8, x1 = tray ? innerWidth - 8 : tr.left - 8, y0 = Math.max(hb.bottom + 4, 0), y1 = tray ? tr.top - 4 : innerHeight - 8;
    const aw = Math.max(60, x1 - x0), ah = Math.max(60, y1 - y0), fit = Math.min(aw * dpr / ISO_B.w, ah * dpr / ISO_B.h);
    build.view = { cx: (x0 + aw / 2) * dpr, cy: (y0 + ah / 2) * dpr };
    zoom = Math.min(fit, baseZoom * 1.6) * bz.z;
  } else build.view = null;
  vw = canvas.width / zoom; vh = canvas.height / zoom;
}
function setZoom(z) { userZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); ls.set('mw_zoom', userZoom.toFixed(3)); resize(); }
addEventListener('resize', resize); resize();
if ($('zoomInBtn')) $('zoomInBtn').onclick = () => zoomBy(1.15);
if ($('zoomOutBtn')) $('zoomOutBtn').onclick = () => zoomBy(1 / 1.15);
canvas.addEventListener('wheel', e => { if (scene && build.on) { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15); } }, { passive: false });
canvas.addEventListener('contextmenu', e => { if (scene && build.on) e.preventDefault(); });

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
  // เกาะลึกลับกลางสระ: ท่าเรือ ⛵ ออกทะเล + ป้ายไม้บอกชัดๆ (ตัดต้นมะพร้าวกับลังเหยื่อที่ไม่จำเป็นออก 7 พ.ย. 2026) แตะเรือเพื่อออกทะเล
  if (builtProj.has('island')) {
    const I = Shared.ISLAND, cx = Math.round((I.x0 + 1.5) * TS), by = I.y0 * TS - 8, bw = 124, bh = 32, bx = cx - bw / 2; // ป้ายอยู่เหนือเกาะ กลางแถวบน
    g.fillStyle = '#3f2814'; g.fillRect(cx - 4, by + bh - 2, 8, 30); g.fillStyle = '#7a4a24'; g.fillRect(cx - 4, by + bh - 2, 3, 30); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(cx - 9, by + bh + 26, 18, 4); // เสาป้าย+เงา
    g.fillStyle = '#2b1b0e'; g.fillRect(bx, by, bw, bh); g.fillStyle = '#6b4a2a'; g.fillRect(bx + 2, by + 2, bw - 4, bh - 4); g.fillStyle = '#8a6a3e'; g.fillRect(bx + 2, by + 2, bw - 4, 2); g.fillStyle = '#2b1b0e'; g.fillRect(bx + 6, by + 4, 3, 3); g.fillRect(bx + bw - 9, by + 4, 3, 3); // ป้ายไม้ ตะปูมุม
    g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2b1b0e'; g.fillText('ออกทะเล', cx + 9, by + 14); g.fillStyle = '#ffe9a8'; g.fillText('ออกทะเล', cx + 8, by + 13);
    g.font = '9px sans-serif'; g.fillStyle = '#f1c40f'; g.fillText('แตะเรือที่ท่าเพื่อไป', cx, by + 25);
    PixelUI.world(gh, '⛵', bx + 15, by + 15, 13);
    const dk = Shared.SEA.dock, dx = dk.x * TS, dy = dk.y * TS; // เรือที่ท่า: แตะเพื่อออกทะเล
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(dx + 2, dy + 25, 28, 5); g.fillStyle = '#6b3f1c'; g.fillRect(dx + 1, dy + 12, 30, 13); g.fillStyle = '#a8703a'; g.fillRect(dx + 3, dy + 14, 26, 7); g.fillStyle = '#4a2a10'; g.fillRect(dx + 1, dy + 22, 30, 3);
    g.fillStyle = '#7a4a24'; g.fillRect(dx + 15, dy - 8, 3, 22); g.fillStyle = '#f5ecd0'; g.fillRect(dx + 18, dy - 6, 11, 14); g.fillStyle = '#e0d4a8'; g.fillRect(dx + 18, dy + 4, 11, 4);
    PixelUI.world(gh, '⛵', dx + 16, dy - 14, 12);
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
// ถ้ำเหมือง: พื้นถ้ำ/ผนังหิน/ทางออกวาดลงผืนพื้นเอง (3 โทน + เงา ตาม STYLE_GUIDE โทนหินเย็น) แล้วเปลี่ยน base/baseHi ไปใช้ จนกว่าจะออกจากถ้ำ
const oreBurst = new Map(), oreHit = new Map(), treeHit = new Map(), felled = new Map(); // ก้อนแร่ที่เพิ่งแตก ช่อง → {t, k ชนิด, s ขนาด} • oreHit/treeHit ช่อง → {t เวลาโดนฟาด, f HP ที่เหลือ 0–1} • felled ต้นไม้ที่เพิ่งล้ม ช่อง → {t, k, side}
let caveTorches = []; // คบเพลิงบนผนังถ้ำ [x, y] พิกเซลโลก (ตำแหน่งเปลวไฟ) ใช้เจาะแสงใน drawNight
// หินโดดกลางถ้ำ (สิ่งกีดขวาง) วาดเป็นหินงอกปลายแหลมโทนน้ำตาลเข้ม ไม่ให้สับสนกับก้อนแร่ (สีเทา) • กริด 16×16 ×2 แบบ pixelore
const CAVE_ROCK_PAL = { h: '#a8977f', l: '#8a7a66', m: '#6c5f50', d: '#51473c', x: '#3a332c' };
const CAVE_ROCK_ART = [
  ['.......hh.......', '......hlm.......', '......hlmd......', '.....hllmd......', '.....hlmmd......', '....hllmmdd.....', '....hlmmmdd..h..', '...hllmmmmdd.hl.', '...hlmmmmmdd.lmd', '..hllmmmmmddxlmd', '..hlmmmmmmdddmmd', '.hllmmmmmmmddmdx', '.hlmmmmmmmmdddddx', 'hllmmmmmmmmmdddx', '.lmmmmmmmmmddxx.', '..xxdddddddxx...'].map(r => r.padEnd(16, '.').slice(0, 16)),
  ['................', '................', '................', '.....hhhh.......', '...hhlllllm.....', '..hllllmmmmd....', '.hllmmmmmmmdd...', '.hlmmmmmmmmddhh.', 'hllmmmmmmmdddllm', 'hlmmmmmmmdddlmmd', 'lmmmmmmmmddlmmdx', 'lmmmmmmmddmmmmdx', '.mmmmmmmddmmmddx', '..xxddddxxdddxx.', '................', '................'],
];
const caveRockCv = CAVE_ROCK_ART.map(rows => { const c = PixelArt.cv(18, 18), x = c.getContext('2d'); rows.forEach((r, j) => [...r].forEach((ch, i) => { if (CAVE_ROCK_PAL[ch]) { x.fillStyle = CAVE_ROCK_PAL[ch]; x.fillRect(i + 1, j + 1, 1, 1); } })); PixelArt.addOutline(c, '#1b1d24'); return c; });
function buildSeaBase() { // ฉากทะเล: น้ำเป็นหย่อมสีฟ้า + เรือ (ดาดฟ้าไม้ ราวกั้น ท้องเรือ) + เรือเล็กท้ายเรือสำหรับกลับเกาะ
  const oc = document.createElement('canvas'); oc.width = W * TS; oc.height = H * TS; const g = oc.getContext('2d'); g.imageSmoothingEnabled = false;
  const hash = (a, b, c) => PixelArt.hash(a, b, c), D = Shared.SEA.deck, X0 = D.x0 * TS, X1 = (D.x1 + 1) * TS, Y0 = D.y0 * TS, Y1 = (D.y1 + 1) * TS;
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const h = hash(tx, ty, 3); g.fillStyle = h < 0.33 ? '#2f86c0' : h < 0.66 ? '#2a7db6' : '#348fc8'; g.fillRect(tx * TS, ty * TS, TS, TS);
    if (hash(tx, ty, 8) > 0.55) { g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(tx * TS + ((hash(tx, ty, 5) * 20) | 0), ty * TS + ((hash(tx, ty, 6) * 24) | 0), 8, 2); }
  }
  g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(X0 - 4, Y1 + 12, X1 - X0 + 8, 8); // เงาใต้เรือ
  g.fillStyle = '#6b3f1c'; g.fillRect(X0 - 6, Y0 - 6, X1 - X0 + 12, Y1 - Y0 + 20); g.fillStyle = '#8b5a2b'; g.fillRect(X0 - 6, Y1 + 2, X1 - X0 + 12, 12); g.fillStyle = '#4a2a10'; g.fillRect(X0 - 6, Y1 + 12, X1 - X0 + 12, 4); // ตัวเรือ/ท้องเรือ
  for (let y = D.y0; y <= D.y1; y++) for (let x = D.x0; x <= D.x1; x++) { // ดาดฟ้าไม้
    g.fillStyle = (x + y) % 2 ? '#c99357' : '#b9834a'; g.fillRect(x * TS, y * TS, TS, TS); g.fillStyle = '#7a4a24'; g.fillRect(x * TS, y * TS + 15, TS, 2); g.fillRect(x * TS + 10 + (y % 2) * 8, y * TS, 2, TS);
  }
  g.fillStyle = '#4a2a10'; g.fillRect(X0 - 6, Y0 - 6, X1 - X0 + 12, 5); g.fillStyle = '#a8703a'; g.fillRect(X0 - 6, Y0 - 6, X1 - X0 + 12, 2); // ราวเรือด้านบน
  for (let x = D.x0; x <= D.x1 + 1; x += 2) { g.fillStyle = '#4a2a10'; g.fillRect(x * TS - 2, Y0 - 12, 4, 10); }
  const ex = Shared.SEA.exit.x * TS, ey = Shared.SEA.exit.y * TS; // เรือพายเล็กท้ายเรือ: เดินไปถึง = กลับเกาะ
  g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(ex + 2, ey + 26, 28, 5); g.fillStyle = '#7a4a24'; g.fillRect(ex + 1, ey + 12, 30, 14); g.fillStyle = '#a8703a'; g.fillRect(ex + 3, ey + 14, 26, 8); g.fillStyle = '#5a3a1c'; g.fillRect(ex + 1, ey + 24, 30, 2);
  g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText('กลับเกาะ', ex + 16, ey + 8);
  base = oc; baseHi = document.createElement('canvas'); baseHi.width = baseHi.height = 1; caveTorches = [];
}
function buildOceanBase() { // ทะเลใหญ่: น้ำตามโซน (ตื้นฟ้าอ่อน → ลึกน้ำเงินเข้ม) แนวปะการัง เกาะทราย ขอบแมพมืด และท่าเรือซ้ายสุด
  const oc = document.createElement('canvas'); oc.width = W * TS; oc.height = H * TS; const g = oc.getContext('2d'); g.imageSmoothingEnabled = false;
  const hash = (a, b, c) => PixelArt.hash(a, b, c), at = (x, y) => (MAP[y] && MAP[y][x] !== undefined ? MAP[y][x] : T.ROCK), rock = (x, y) => at(x, y) === T.ROCK;
  const ZC = { shallow: ['#47b4e4', '#40abdc', '#4dbbea'], open: ['#2f86c0', '#2a7db6', '#348fc8'], deep: ['#1f64a0', '#1b5b95', '#236ba8'], reef: ['#3aa6c4', '#35a0bd', '#41b0cc'] };
  const border = (x, y) => x === 0 || y === 0 || x === W - 1 || y === H - 1;
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const X = tx * TS, Y = ty * TS, t = at(tx, ty), h = hash(tx, ty, 3);
    if (t !== T.ROCK || border(tx, ty)) { // น้ำ (ขอบแมพเป็นน้ำลึกมืด)
      const zc = border(tx, ty) ? ['#0f3a5f', '#0d3556', '#113f68'] : ZC[Shared.oceanZone(tx, ty)];
      g.fillStyle = zc[h < 0.33 ? 0 : h < 0.66 ? 1 : 2]; g.fillRect(X, Y, TS, TS);
      if (hash(tx, ty, 8) > 0.55) { g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(X + ((hash(tx, ty, 5) * 20) | 0), Y + ((hash(tx, ty, 6) * 24) | 0), 8, 2); }
    }
  }
  for (const o of Shared.oceanLayout().reefs) { // แนวปะการัง: ก้อนปะการังสีชมพู-ส้ม-ม่วงใต้น้ำใส
    for (let ty = Math.floor(o.y - o.r); ty <= Math.ceil(o.y + o.r); ty++) for (let tx = Math.floor(o.x - o.r); tx <= Math.ceil(o.x + o.r); tx++) {
      if ((tx - o.x) ** 2 + (ty - o.y) ** 2 > o.r * o.r || at(tx, ty) === T.ROCK) continue;
      for (let i = 0; i < 3; i++) { const h = hash(tx * 3 + i, ty, 21); if (h < 0.35) continue; const cx = tx * TS + 4 + ((hash(tx, ty * 3 + i, 22) * 22) | 0), cy = ty * TS + 6 + ((hash(tx + i, ty, 23) * 18) | 0), c = ['#e8788a', '#f0a05a', '#b872c8', '#f2c4d0'][(h * 4 | 0) % 4];
        g.fillStyle = 'rgba(30,60,90,.35)'; g.fillRect(cx - 1, cy + 4, 8, 2); g.fillStyle = c; g.fillRect(cx, cy, 6, 4); g.fillRect(cx + 1, cy - 3, 2, 3); g.fillRect(cx + 4, cy - 2, 2, 2); }
    }
  }
  for (let ty = 1; ty < H - 1; ty++) for (let tx = 1; tx < W - 1; tx++) if (rock(tx, ty)) { // เกาะทราย: ขอบเป็นทราย ใจกลางเป็นหญ้า มีฟองคลื่นรอบเกาะ
    const X = tx * TS, Y = ty * TS, inner = rock(tx - 1, ty) && rock(tx + 1, ty) && rock(tx, ty - 1) && rock(tx, ty + 1);
    g.fillStyle = 'rgba(255,255,255,.55)'; if (!rock(tx - 1, ty)) g.fillRect(X - 3, Y + 2, 3, TS - 4); if (!rock(tx + 1, ty)) g.fillRect(X + TS, Y + 2, 3, TS - 4); if (!rock(tx, ty - 1)) g.fillRect(X + 2, Y - 3, TS - 4, 3); if (!rock(tx, ty + 1)) g.fillRect(X + 2, Y + TS, TS - 4, 3);
    g.fillStyle = inner ? '#5aa05a' : (hash(tx, ty, 4) > 0.5 ? '#ead79c' : '#e3cd8e'); g.fillRect(X, Y, TS, TS);
    if (!inner) { g.fillStyle = 'rgba(160,120,60,.35)'; g.fillRect(X, Y + TS - 4, TS, 4); }
    if (inner) { g.fillStyle = '#4a8f4a'; g.fillRect(X + 4 + ((hash(tx, ty, 9) * 14) | 0), Y + 6, 6, 3); if (hash(tx, ty, 12) > 0.5) { g.fillStyle = '#6b3f1c'; g.fillRect(X + 14, Y + 14, 4, 10); g.fillStyle = '#2f7a3a'; g.fillRect(X + 6, Y + 4, 20, 12); g.fillStyle = '#3f9a4a'; g.fillRect(X + 9, Y + 2, 14, 8); } } // ต้นไม้ในเกาะ
  }
  const D = Shared.OCEAN.exit, py0 = D.y0 * TS - 6, py1 = (D.y1 + 1) * TS + 6; // ท่าเรือซ้ายสุด: ทางไม้ + เสา + ป้าย
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(2, py0 + 8, 3 * TS + 6, py1 - py0); g.fillStyle = '#7a4a24'; g.fillRect(0, py0, 3 * TS, py1 - py0);
  for (let i = 0; i < 3 * TS; i += 8) { g.fillStyle = (i / 8) % 2 ? '#c99357' : '#b9834a'; g.fillRect(i, py0 + 2, 7, py1 - py0 - 4); }
  g.fillStyle = '#4a2a10'; for (let y = py0; y < py1; y += 40) { g.fillRect(3 * TS - 4, y, 6, 8); g.fillRect(0, y, 6, 8); }
  g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText('กลับท่า ⚓', 8, py0 - 6);
  base = oc; baseHi = document.createElement('canvas'); baseHi.width = baseHi.height = 1; caveTorches = [];
}
const boatBob = (p, now) => typeof PixelBoat !== 'undefined' ? Math.round((Math.sin(now / 620 + 1) + 1) / 2) : Math.sin(now / 420 + (p.id || 0)) * 1.2; // โยกตามคลื่น (สัตว์บนเรือใช้ค่าเดียวกับตัวเรือ)
function boatPose(p, now) { // ท่าเรือของผู้เล่น: กำลังแล่นไหม ทิศ โยกตามคลื่น (เรียกครั้งเดียวต่อเฟรมต่อลำ เพราะเก็บตำแหน่งก่อนหน้าไว้วัดการเคลื่อนที่)
  const moved = Math.hypot(p.x - (p._lx == null ? p.x : p._lx), p.y - (p._ly == null ? p.y : p._ly)) > 0.25; p._lx = p.x; p._ly = p.y; if (moved) p._mvAt = now;
  const moving = now - (p._mvAt || 0) < 260, d = p.dir || 0, hor = d >= 2, s = d === 3 || d === 0 ? 1 : -1, bob = boatBob(p, now);
  return { moving, d, hor, s, bob };
}
function drawBoat(p, now, layer) { // เรือไม้ใต้ตัวละคร (ทะเลใหญ่): หัวเรือหันตามทิศ โคลงเบาๆ มีฟองคลื่นท้ายเรือตอนแล่น • layer 'back'|'front'|ไม่ส่ง=ทั้งหมด
  const { moving, d, hor, s, bob } = boatPose(p, now);
  if (typeof PixelBoat !== 'undefined') { PixelBoat.draw(ctx, p.x, p.y + 6, d, now, layer); return; } // สไปรต์เรือพิกเซล (pixelboat.js)
  if (layer === 'front') return; // รูปวาดโค้ดสำรองไม่แยกชั้น วาดรอบ back ครั้งเดียว
  const pt = (u, v) => (hor ? [s * u, v] : [v, s * u]), poly = (list, fill, stroke) => { ctx.beginPath(); list.forEach(([u, v], i) => { const [x, y] = pt(u, v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } };
  ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y + 6 + bob)); ctx.scale(1.75, 1.75); // ขยายให้ได้ BOAT.hull (ยาว ~96 กว้าง ~44)
  const [sx0, sy0] = pt(-6, 8); ctx.fillStyle = 'rgba(0,30,60,.28)'; ctx.beginPath(); ctx.ellipse(sx0 * 0.2, sy0 * 0.3 + 6, hor ? 28 : 15, hor ? 9 : 22, 0, 0, 7); ctx.fill(); // เงาใต้ท้องเรือ
  if (moving) for (let i = 0; i < 3; i++) { // ฟองคลื่นท้ายเรือ
    const ph = (now / 280 + i / 3) % 1, [wx, wy] = pt(-22 - ph * 26, 0); ctx.strokeStyle = `rgba(255,255,255,${(1 - ph) * 0.7})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(wx, wy + 6, hor ? 3 + ph * 5 : 8 + ph * 8, hor ? 8 + ph * 8 : 3 + ph * 5, 0, 0, 7); ctx.stroke();
  }
  poly([[-24, -9], [14, -9], [30, 0], [14, 9], [-24, 9]], '#8b5a2b', '#3d2a1a'); // ตัวเรือ
  poly([[-20, -6], [12, -6], [23, 0], [12, 6], [-20, 6]], '#c99357'); // ดาดฟ้า
  ctx.strokeStyle = '#7a4a24'; ctx.lineWidth = 1; for (const u of [-12, -2, 8]) { ctx.beginPath(); const [a, b] = pt(u, -6), [c, e] = pt(u, 6); ctx.moveTo(a, b); ctx.lineTo(c, e); ctx.stroke(); }
  ctx.strokeStyle = '#f3ead0'; ctx.lineWidth = 2; ctx.beginPath(); { const [a, b] = pt(-22, -9), [c, e] = pt(12, -9); ctx.moveTo(a, b); ctx.lineTo(c, e); } ctx.stroke(); // แถบขาวข้างเรือ
  { const [mx, my] = pt(-16, 0); ctx.fillStyle = '#4a2a10'; ctx.fillRect(mx - 1, my - 15, 3, 15); ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(mx + 2, my - 15); ctx.lineTo(mx + 11 + Math.sin(now / 200 + (p.id || 0)) * 1.5, my - 12); ctx.lineTo(mx + 2, my - 9); ctx.closePath(); ctx.fill(); } // ธงท้ายเรือ
  ctx.restore();
}
function buildCaveBase() {
  const oc = document.createElement('canvas'); oc.width = W * TS; oc.height = H * TS; const g = oc.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#0b0a10'; g.fillRect(0, 0, oc.width, oc.height);
  const rock = ['#6a7285', '#525a6b', '#434a58', '#383e4a', '#2a2e38'], floor = ['#867664', '#81715f', '#7c6c5b'], deep = ['#22252e', '#17191f', '#0e0f13'];
  const hash = (a, b, c) => PixelArt.hash(a, b, c), at = (x, y) => (MAP[y] && MAP[y][x] !== undefined ? MAP[y][x] : T.VOID);
  const isRock = (x, y) => { const t = at(x, y); return t === T.ROCK || t === T.VOID; };
  // หินโดด = กลุ่มหินเล็ก (≤ 4 ช่อง) ที่ไม่ติดผนัง → วาดเป็นหินงอกบนพื้น ไม่ใช่ผนัง
  const lone = new Set(), seen = new Set();
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (at(tx, ty) === T.ROCK && !seen.has(tx + ',' + ty)) {
    const grp = [[tx, ty]]; seen.add(tx + ',' + ty); let edge = false;
    for (let i = 0; i < grp.length; i++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = grp[i][0] + dx, y = grp[i][1] + dy, t = at(x, y); if (t === T.VOID) edge = true; if (t === T.ROCK && !seen.has(x + ',' + y)) { seen.add(x + ',' + y); grp.push([x, y]); } }
    if (!edge && grp.length <= 4) for (const [x, y] of grp) lone.add(x + ',' + y);
  }
  const wall = (x, y) => isRock(x, y) && !lone.has(x + ',' + y);
  // ความลึกของผนัง: 1 = ติดพื้น ยิ่งลึกยิ่งมืดจนกลืนไปกับความมืด (ผนังหนาไม่ดูเป็นแถบทึบ)
  const depth = new Map(), q = [];
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (!wall(tx, ty)) { depth.set(tx + ',' + ty, 0); q.push([tx, ty]); }
  for (let i = 0; i < q.length; i++) { const [x, y] = q[i], d = depth.get(x + ',' + y); if (d >= 4) continue; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = (x + dx) + ',' + (y + dy); if (!depth.has(k) && wall(x + dx, y + dy) && at(x + dx, y + dy) !== T.VOID) { depth.set(k, d + 1); q.push([x + dx, y + dy]); } } }
  const step = [12, 8, 6, 4, 2, 2]; // มุมโค้งแบบขั้นบันไดพิกเซล (กว้างที่ตัดออกต่อแถว 2 พิกเซล)
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const t = at(tx, ty); if (t === T.VOID) continue;
    const X = tx * TS, Y = ty * TS;
    // พื้นถ้ำ (ใต้หินโดดและใต้มุมโค้งของผนังด้วย): โทนเป็นหย่อมๆ + กรวด + รอยแตก + แอ่งน้ำนานๆ ที
    const ptch = hash(tx, ty, 11);
    g.fillStyle = floor[(ptch * 3) | 0]; g.fillRect(X, Y, TS, TS);
    for (let i = 0; i < 4; i++) { const h1 = hash(tx * 5 + i, ty * 3, 4), h2 = hash(tx * 3 + i, ty * 7, 5); g.fillStyle = i & 1 ? '#8a7c6a' : '#574c40'; g.fillRect(X + ((h1 * 14) | 0) * 2, Y + ((h2 * 14) | 0) * 2, 2 + (i & 1) * 2, 2); }
    const deco = hash(tx, ty, 21);
    if (t === T.CAVE && deco < 0.035) { g.fillStyle = '#3b4a5c'; g.fillRect(X + 6, Y + 12, 20, 8); g.fillRect(X + 10, Y + 10, 12, 12); g.fillStyle = '#56708a'; g.fillRect(X + 10, Y + 12, 8, 2); } // แอ่งน้ำ
    else if (t === T.CAVE && deco < 0.08) { g.fillStyle = '#54493d'; g.fillRect(X + 8, Y + 14, 10, 2); g.fillRect(X + 16, Y + 16, 2, 6); g.fillRect(X + 18, Y + 20, 6, 2); } // รอยแตกพื้น
    if (!wall(tx, ty)) {
      if (wall(tx, ty - 1)) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(X, Y, TS, 6); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(X, Y + 6, TS, 4); } // เงาใต้ผนัง
      if (wall(tx - 1, ty)) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(X, Y, 4, TS); }
      if (wall(tx + 1, ty)) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(X + TS - 4, Y, 4, TS); }
      if (t === T.MOUTH) { g.fillStyle = caveFlr > 1 ? 'rgba(170,200,255,.5)' : 'rgba(255,236,160,.55)'; g.fillRect(X, Y, TS, TS); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(X + 4, Y + 6, TS - 8, TS - 12); } // แสงวันสาดเข้าทางออก (ชั้นลึกเป็นแสงฟ้า = บันไดขึ้น)
      if (t === T.DOWN) { g.fillStyle = '#0d0b12'; g.fillRect(X, Y, TS, TS); for (let i = 0; i < 4; i++) { g.fillStyle = ['#5a4e42', '#43392f', '#2c251f', '#18141a'][i]; g.fillRect(X + 2, Y + 3 + i * 7, TS - 4, 5); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(X + 2, Y + 3 + i * 7, TS - 4, 1); } } // บันไดลง
      if (lone.has(tx + ',' + ty)) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(X + 4, Y + 24, 24, 6); g.fillRect(X + 2, Y + 26, 28, 2); g.drawImage(caveRockCv[0], X - 2, Y - 4, 36, 36); } // หินงอก
      continue;
    }
    const d = depth.get(tx + ',' + ty) || 4, below = !wall(tx, ty + 1) && at(tx, ty + 1) !== T.VOID, above = !wall(tx, ty - 1);
    const L = !wall(tx - 1, ty), Rr = !wall(tx + 1, ty);
    const body = d === 1 ? rock[2] : deep[Math.min(2, d - 2)];
    // ตัวผนังพร้อมมุมโค้ง: มุมที่สองด้านติดกันเป็นพื้น ตัดเป็นขั้นบันไดให้เห็นพื้นข้างใต้
    g.fillStyle = body;
    for (let r = 0; r < 16; r++) {
      const top = r < step.length, bot = 15 - r < step.length;
      const cl = (top && above && L ? step[r] : 0) || (bot && below && L ? step[15 - r] : 0), cr = (top && above && Rr ? step[r] : 0) || (bot && below && Rr ? step[15 - r] : 0);
      g.fillRect(X + cl, Y + r * 2, TS - cl - cr, 2);
    }
    if (d === 1) {
      for (let i = 0; i < 3; i++) { const h = hash(tx * 7 + i, ty * 13, 9); g.fillStyle = rock[3]; g.fillRect(X + 6 + ((h * 8) | 0) * 2, Y + 8 + i * 6, 4 + (i & 1) * 4, 2); } // ลายหิน
      if (above) { g.fillStyle = rock[0]; g.fillRect(X + (L ? 8 : 0), Y + 2, TS - (L ? 8 : 0) - (Rr ? 8 : 0), 2); g.fillStyle = rock[1]; g.fillRect(X + (L ? 6 : 0), Y + 4, TS - (L ? 6 : 0) - (Rr ? 6 : 0), 4); } // ขอบบนรับแสง
      if (below) { // หน้าผนังที่ยื่นลงมาถึงพื้น: แถบเข้ม + ร่องแนวตั้ง
        g.fillStyle = rock[4]; g.fillRect(X + (L ? 6 : 0), Y + TS - 12, TS - (L ? 6 : 0) - (Rr ? 6 : 0), 10);
        g.fillStyle = rock[3]; g.fillRect(X + (L ? 6 : 0), Y + TS - 12, TS - (L ? 6 : 0) - (Rr ? 6 : 0), 2);
        g.fillStyle = '#1f2229'; for (let i = 0; i < 2; i++) { const h = hash(tx, ty * 3 + i, 17); g.fillRect(X + 8 + ((h * 8) | 0) * 2, Y + TS - 10, 2, 6); }
      }
      if (L && !above && !below) { g.fillStyle = rock[1]; g.fillRect(X, Y, 2, TS); }
    } else if (hash(tx, ty, 41) < 0.12) { g.fillStyle = deep[0]; g.fillRect(X + 10 + ((hash(tx, ty, 42) * 6) | 0) * 2, Y + 12, 4, 2); } // จุดหินจางๆ ในความมืด
  }
  // คบเพลิงบนหน้าผนัง (ช่องผนังที่ข้างล่างเป็นพื้น) ห่างกัน ≥ 7 ช่อง เลือกตายตัวตามผัง
  caveTorches = [];
  const tc = []; for (let ty = 1; ty < H - 1; ty++) for (let tx = 1; tx < W - 1; tx++) if (wall(tx, ty) && at(tx, ty + 1) === T.CAVE && !wall(tx, ty + 1) && wall(tx - 1, ty) && wall(tx + 1, ty)) tc.push([tx, ty, hash(tx, ty, 51)]);
  tc.sort((a, b) => a[2] - b[2]);
  for (const [tx, ty] of tc) {
    if (caveTorches.some(([x, y]) => Math.abs(x / TS - tx) < 7 && Math.abs(y / TS - ty) < 7)) continue;
    const X = tx * TS, Y = ty * TS; caveTorches.push([X + 16, Y + 14]);
    g.fillStyle = '#1b1d24'; g.fillRect(X + 13, Y + 15, 6, 12); g.fillStyle = '#6b4a2b'; g.fillRect(X + 14, Y + 16, 4, 10); g.fillStyle = '#8a6238'; g.fillRect(X + 14, Y + 16, 2, 10); // ด้ามไม้
    g.fillStyle = '#4a4f5c'; g.fillRect(X + 11, Y + 22, 10, 3); // ห่วงเหล็กยึดผนัง
    g.fillStyle = '#ff9a3c'; g.fillRect(X + 13, Y + 8, 6, 8); g.fillStyle = '#ffd36a'; g.fillRect(X + 14, Y + 10, 4, 5); g.fillStyle = '#fff3c0'; g.fillRect(X + 15, Y + 12, 2, 3); // เปลวไฟ
  }
  base = oc; baseHi = document.createElement('canvas'); baseHi.width = baseHi.height = 1;
  const gh = oc.getContext('2d'); if (caveFlr > 1) { const ax = (Shared.CAVE.exit[1] + 0.5) * TS, ay = Shared.CAVE.y1 * TS + 16; gh.fillStyle = '#1b1d24'; gh.fillRect(ax - 11, ay - 11, 22, 22); gh.fillStyle = '#3a4a68'; gh.fillRect(ax - 10, ay - 10, 20, 20); gh.fillStyle = '#e8f0ff'; gh.beginPath(); gh.moveTo(ax, ay - 7); gh.lineTo(ax + 7, ay + 3); gh.lineTo(ax + 3, ay + 3); gh.lineTo(ax + 3, ay + 7); gh.lineTo(ax - 3, ay + 7); gh.lineTo(ax - 3, ay + 3); gh.lineTo(ax - 7, ay + 3); gh.closePath(); gh.fill(); } // ป้ายบันไดขึ้น (ชั้นลึก)
  else PixelUI.world(gh, '🚪', (Shared.CAVE.exit[1] + 0.5) * TS, Shared.CAVE.y1 * TS + 16, 15); // ป้ายทางออกสู่เมือง (ชั้น 1)
  for (let ty = 0; ty < H; ty++) for (let tx = 1; tx < W - 1; tx++) if (MAP[ty][tx] === T.DOWN) { const ax = (tx + 0.5) * TS, ay = (ty + 0.5) * TS; gh.fillStyle = '#e8f0ff'; gh.beginPath(); gh.moveTo(ax, ay + 7); gh.lineTo(ax + 7, ay - 3); gh.lineTo(ax + 3, ay - 3); gh.lineTo(ax + 3, ay - 7); gh.lineTo(ax - 3, ay - 7); gh.lineTo(ax - 3, ay - 3); gh.lineTo(ax - 7, ay - 3); gh.closePath(); gh.fill(); } // ลูกศรลงบนบันได (ช่องเดียว)
}
const oreDmg = []; // เลขดาเมจลอยจากก้อนแร่ {x, y ช่อง, t, d, c คริ} จำกัด 12 ตัวพร้อมกัน
const ORE_DMG_MS = 900;
function drawOreHp(tx, ty, k, sz, now) { // แถบ HP เหนือก้อนแร่ที่ถูกตี (ไม่โชว์เมื่อเต็ม/ไม่มีใครตีเกิน 20 วิ)
  const hit = oreHit.get(tx + ',' + ty); if (!hit || hit.f >= 1 || now - hit.t > 20000) return;
  const spr = PixelOre.has(k) && PixelOre.get(k, sz | 0, 0), sc = ORE_SCALE[sz | 0] || 2, w = Math.max(22, [9, 11, 14][sz | 0] * sc * 0.9 | 0), x = tx * TS + 16, top = ty * TS + 31 - (spr ? spr.height * sc : 20) - 6;
  const f = Math.max(0, Math.min(1, hit.f)), bx = Math.round(x - w / 2), by = Math.round(top);
  mainCtx.fillStyle = '#1b1d24'; mainCtx.fillRect(bx - 2, by - 2, w + 4, 8); mainCtx.fillStyle = '#5a3030'; mainCtx.fillRect(bx, by, w, 4);
  mainCtx.fillStyle = f > 0.55 ? '#6cc04a' : f > 0.25 ? '#f1c40f' : '#e5453a'; mainCtx.fillRect(bx, by, Math.round(w * f), 4);
  mainCtx.fillStyle = 'rgba(255,255,255,.45)'; mainCtx.fillRect(bx, by, Math.round(w * f), 1);
}
function drawOreDmg(now) {
  for (let i = oreDmg.length - 1; i >= 0; i--) {
    const o = oreDmg[i], t = now - o.t; if (t > (o.c ? ORE_DMG_MS + 300 : ORE_DMG_MS)) { oreDmg.splice(i, 1); continue; }
    const u = t / (o.c ? ORE_DMG_MS + 300 : ORE_DMG_MS), pop = o.c ? 1 + 0.5 * Math.max(0, 1 - t / 220) : 1, shake = o.c && t < 300 ? Math.sin(t / 22) * 3 * (1 - t / 300) : 0;
    const x = o.x * TS + 16 + shake + (o.c ? 0 : ((o.x * 7 + o.y * 3 + (o.t | 0)) % 9) - 4), y = o.y * TS - 16 - u * 26, txt = '-' + (o.d >= 10 ? Math.round(o.d) : (Math.round(o.d * 10) / 10).toFixed(1));
    ctx.save(); ctx.globalAlpha = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1b1d24'; ctx.fillStyle = o.c ? '#ffb02e' : '#fff';
    ctx.font = `bold ${Math.round((o.c ? 20 : 14) * pop)}px sans-serif`; ctx.lineWidth = o.c ? 4 : 3; ctx.strokeText(txt, x, y); ctx.fillText(txt, x, y);
    if (o.c) { ctx.font = `bold ${Math.round(11 * pop)}px sans-serif`; ctx.fillStyle = '#ff7a2e'; ctx.strokeText('CRIT!', x, y - 17); ctx.fillText('CRIT!', x, y - 17); }
    ctx.restore();
  }
}
const ORE_SCALE = [2, 3, 4]; // ขยายสไปรต์แร่ (ช่อง 16×16) ตามขนาดก้อน: เล็ก 32 px • กลาง 48 px • ใหญ่ 64 px
// ก้อนที่ขุดไม่ได้ตอนนี้ (เลเวลนักขุดไม่ถึง หรือไม่มีอุปกรณ์ขุดเลย) ทำให้หม่นและมี 🔒 • อุปกรณ์ต่ำกว่าแร่ (ขุดได้แต่ช้า) ขึ้น 🐌 + "ช้า ×N" (N = จำนวนระดับที่ต่ำกว่า จาก S.mineHit.down)
function drawOreLock(tx, ty, k) {
  const O = Shared.ORES[k]; if (!O) return; const pk = pickLevel(), lockedLv = lvl('mine') < O.lv, lockedPick = !pk;
  const mh = !lockedLv && !lockedPick ? Shared.mineHit(inv, k, oreS.get(tx + ',' + ty) | 0) : null, down = mh ? mh.down : 0, slow = down > 0;
  if (!lockedLv && !lockedPick && !slow) return;
  const x = tx * TS, y = ty * TS;
  if (!slow) { ctx.fillStyle = 'rgba(16,20,34,.42)'; ctx.fillRect(x + 3, y + 5, TS - 6, TS - 9); }
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2a1b14'; ctx.lineWidth = 3;
  const t = slow ? '🐌' + (down > 0 ? ' ×' + down : '') : '🔒', ty2 = y + 12; ctx.strokeText(t, x + TS / 2, ty2); ctx.fillText(t, x + TS / 2, ty2);
}
function drawOre(tx, ty, k, now, sz, ctx = mainCtx) {
  const spr = PixelOre.has(k) && PixelOre.get(k, sz | 0, (now / 500 | 0) & 1); // สไปรต์พิกเซลวาดมือ (ชนิดที่ยังไม่มีใช้แบบเดิมด้านล่าง)
  if (spr) {
    const hit = oreHit.get(tx + ',' + ty), [sx, fl] = hit ? PixelAction.oreShake(now - hit.t) : [0, 0]; // โดนฟาด: สั่น + กะพริบขาว + รอยร้าว
    if (hit && now - hit.t > 20000) oreHit.delete(tx + ',' + ty); // เซิร์ฟเวอร์คืน HP เต็มหลังไม่มีใครขุด 20 วินาที
    const sc = ORE_SCALE[sz | 0] || 2, w = spr.width * sc, h = spr.height * sc, x = tx * TS + 16, y = ty * TS + 31, sm = ctx.imageSmoothingEnabled; // ขยายตามขนาดก้อน (แบบเดิมทุกพิกเซล ก้อนใหญ่ใหญ่ขึ้นจริง)
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y - sc, [9, 11, 14][sz | 0] * sc / 2, 2 + sc, 0, 0, 7); ctx.fill(); // เงากว้างเท่าตัวก้อน (แบบ v2 กว้าง 9/11/14 พิกเซลศิลป์)
    ctx.imageSmoothingEnabled = false; ctx.drawImage(spr, Math.round(x - w / 2) + sx, y - h, w, h); ctx.imageSmoothingEnabled = sm;
    if (hit) PixelAction.crack(ctx, x + sx, Math.round(y - [5, 6, 7][sz | 0] * sc), hit.f, tx * 31 + ty); // รอยร้าวกลางตัวก้อน
    if (fl) { ctx.globalAlpha = fl; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(spr, Math.round(x - w / 2) + sx, y - h, w, h); ctx.drawImage(spr, Math.round(x - w / 2) + sx, y - h, w, h); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    return;
  }
  const x = tx * TS + 16, y = ty * TS + 18, glow = Shared.ORES[k].lv >= 5, sc = [0.78, 1, 1.28][sz | 0] || 1;
  ctx.save(); ctx.translate(x, y + 11); ctx.scale(sc, sc); ctx.translate(-x, -(y + 11)); // ขนาดก้อน: เล็ก/กลาง/ใหญ่ (ย่อ/ขยายรอบพื้นก้อน)
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y + 11, 13, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a2e38'; ctx.beginPath(); ctx.ellipse(x, y + 3, 14, 12, 0, 0, 7); ctx.fill(); // ขอบเข้ม 1 px
  ctx.fillStyle = '#4b5160'; ctx.beginPath(); ctx.ellipse(x, y + 3, 13, 11, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#6a7285'; ctx.beginPath(); ctx.ellipse(x - 2, y, 9, 7, 0, 0, 7); ctx.fill();
  const c = ORE_COL[k], tw = glow ? 0.5 + 0.5 * Math.sin(now / 380 + tx * 2 + ty) : 0; // ก้อนแร่เป็นเกล็ดสีบนหิน (สไปรต์พิกเซล ไม่ใช้อีโมจิ) แร่มีค่าระยิบ
  [[-7, -5, 6], [1, -8, 5], [-2, -1, 7], [6, -2, 5], [-9, 3, 5], [3, 4, 6]].forEach(([dx, dy, w], i) => {
    const cx = x + dx, cy = y + dy; ctx.fillStyle = '#1b1d24'; ctx.fillRect(cx - 1, cy - 1, w + 2, w + 2);
    ctx.fillStyle = c[1]; ctx.fillRect(cx, cy, w, w); ctx.fillStyle = c[0]; ctx.fillRect(cx, cy, w - 2, w - 2);
    ctx.fillStyle = `rgba(255,255,255,${0.55 + (i & 1 ? tw * 0.4 : 0)})`; ctx.fillRect(cx + 1, cy + 1, 2, 2);
  });
  ctx.restore();
}
const ORE_COL = { stone: ['#a4abb8', '#7c8494'], coal: ['#3a3a44', '#23232b'], copper: ['#e8924a', '#b0602a'], iron: ['#c9b09a', '#8a6a58'], silver: ['#eef2f7', '#aab4c2'], gold: ['#ffe066', '#d9a21e'], amethyst: ['#d9a6ff', '#9a4fd6'], ruby: ['#ff8a98', '#c2223f'], emerald: ['#86ffb4', '#1fa35a'], crystal: ['#8af0ff', '#3aa6d8'], opal: ['#f4f8ff', '#a8b8d8'], topaz: ['#ffe27a', '#d89a1a'], sapphire: ['#7aa8ff', '#2a50c0'], garnet: ['#d27a5a', '#7a2a1c'], jade: ['#7ae0a8', '#1f8a5a'], obsidian: ['#6a5a8a', '#1c1428'], moonstone: ['#d8e4ff', '#7a8ac0'], sunstone: ['#ffb060', '#d85a1a'], mythril: ['#8af4ff', '#4a98c8'], starcore: ['#fff6a0', '#e8a020'] }; // [สว่าง, เข้ม]
function drawCaveWorld(now) {
  ctx.drawImage(base, 0, 0, W * TS, H * TS);
  const ocean = inOcean();
  if (inSea()) { // ระลอกคลื่นขยับ + ธงบนเรือ
    const x0s = Math.max(0, Math.floor(camX / TS)), x1s = Math.min(W - 1, Math.ceil((camX + canvas.width / zoom) / TS)), y0s = Math.max(0, Math.floor(camY / TS)), y1s = Math.min(H - 1, Math.ceil((camY + canvas.height / zoom) / TS));
    for (let ty = y0s; ty <= y1s; ty++) for (let tx = x0s; tx <= x1s; tx++) if (MAP[ty][tx] === T.WATER || (ocean && MAP[ty][tx] === T.CAVE)) { const h = PixelArt.hash(tx, ty, 11); if (h < 0.7) continue; const a = 0.1 + 0.18 * Math.sin(now / 600 + h * 40); ctx.fillStyle = `rgba(255,255,255,${Math.max(0, a)})`; ctx.fillRect(tx * TS + 4 + ((now / 90 + h * 50) % 18), ty * TS + 6 + ((h * 30) | 0), 10, 2); }
  }
  const vw = canvas.width / zoom, vh = canvas.height / zoom, x0 = Math.max(0, Math.floor(camX / TS) - 1), x1 = Math.min(W - 1, Math.ceil((camX + vw) / TS) + 1), y0 = Math.max(0, Math.floor(camY / TS) - 1), y1 = Math.min(H - 1, Math.ceil((camY + vh) / TS) + 1);
  const list = [];
  for (const [k, id] of oreK) { const [tx, ty] = k.split(',').map(Number); if (tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1) list.push({ y: (ty + 1) * TS - 2, f: () => { drawOre(tx, ty, id, now, oreS.get(k)); drawOreLock(tx, ty, id); drawOreHp(tx, ty, id, oreS.get(k), now); } }); }
  for (const [k, b] of oreBurst) { // ก้อนแร่แตก: สไปรต์ชีตแตกกระจาย (PixelAction.shatter ~0.65 วินาที)
    const t = now - b.t; if (t >= 650) { oreBurst.delete(k); continue; }
    const [tx, ty] = k.split(',').map(Number); list.push({ y: (ty + 1) * TS + 20, f: () => PixelAction.shatter(ctx, tx * TS + 16, ty * TS + 18, t, b.k && ORE_COL[b.k], tx * 7 + ty, b.s === 2) });
  }

  if (ocean) for (const p of players.values()) list.push({ y: p.y + 12, f: () => { // เรือ + คน + สัตว์ของเจ้าของเดียวกันวาดเป็นกลุ่ม: เรือหลัง → สัตว์หลังคน → คน → สัตว์หน้าคน → เรือหน้า
    drawBoat(p, now, 'back');
    const behind = p.cp && p.cp.y + 8 < p.y + 12; if (behind) drawCompanion(p.cp, now);
    drawPlayer(p, now);
    if (p.cp && !behind) drawCompanion(p.cp, now);
    drawBoat(p, now, 'front');
  } });
  else {
    for (const p of players.values()) if (p.cp) list.push({ y: p.cp.y + 8, f: () => drawCompanion(p.cp, now) });
    for (const p of players.values()) list.push({ y: p.y + 12, f: () => drawPlayer(p, now) });
  }
  list.sort((a, b) => a.y - b.y).forEach(o => safeDraw(o, 'list'));
  if (oreDmg.length) drawOreDmg(now);
  if (inSea()) for (const p of players.values()) if (p.fs) drawFishing(p, now); // เอ็นเบ็ด ทุ่น ระลอกน้ำ น้ำกระเซ็น (เดิมวาดเฉพาะรอบวาดของเมือง ฉากทะเลเลยไม่เห็นแอนิเมชันตกปลา)
}
// หน้าผา/บันได (ผังเมืองใหม่): วาดทับพื้นทางหลังสร้างพื้นโลก ใช้พาเลตดินหิน-น้ำตาลตาม STYLE_GUIDE
let caveLamp = [0, 0]; // ตำแหน่งตะเกียงหน้าถ้ำ (พิกเซลเกม) ตั้งตอนวาดภูเขา ใช้ใน drawNight
function drawCliffs(gx) {
  const rock = ['#a89478', '#8f7e68', '#7a6a58', '#665848', '#4a3d30'];
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const t = MAP[ty][tx]; if (t !== T.CLIFF && t !== T.STAIR && t !== T.MOUTH) continue;
    const X = tx * TS, Y = ty * TS;
    const HL = Shared.MINE.hill; if (tx >= HL.x0 && tx <= HL.x1 && ty <= Shared.MINE.y) continue; // ภูเขาถ้ำวาดเป็นภาพเดียวด้านล่าง
    if (t === T.CLIFF) {
      gx.fillStyle = rock[2]; gx.fillRect(X, Y, TS, TS);
      gx.fillStyle = rock[0]; gx.fillRect(X, Y, TS, 5); gx.fillStyle = rock[1]; gx.fillRect(X, Y + 5, TS, 3);
      for (let i = 0; i < 4; i++) { const h = PixelArt.hash(tx * 7 + i, ty * 13, 5); gx.fillStyle = rock[3]; gx.fillRect(X + ((h * 24) | 0), Y + 10 + i * 5, 6 + (i & 1) * 4, 2); }
      gx.fillStyle = rock[4]; gx.fillRect(X, Y + TS - 7, TS, 7); gx.fillStyle = 'rgba(0,0,0,.18)'; gx.fillRect(X, Y + TS - 9, TS, 2);
    } else {
      gx.fillStyle = '#c9a56a'; gx.fillRect(X, Y, TS, TS);
      for (let i = 0; i < 4; i++) { gx.fillStyle = '#ddbe86'; gx.fillRect(X + 2, Y + i * 8, TS - 4, 3); gx.fillStyle = '#9a7a4a'; gx.fillRect(X + 2, Y + i * 8 + 3, TS - 4, 2); }
      gx.fillStyle = '#7a5a30'; gx.fillRect(X, Y, 2, TS); gx.fillRect(X + TS - 2, Y, 2, TS);
    }
  }
  // ภูเขาถ้ำเหมือง (pixelart.js caveHill) ภาพ ×2 ปากถ้ำอยู่ตีนเขาตรงช่อง MINE.door + ป้าย ⚒️ บนคาน
  const HL = Shared.MINE.hill, hill = PixelArt.caveHill(Shared.hillTop, HL.peaks, (HL.x1 - HL.x0 + 1) * 16, (Shared.MINE.door[0] - HL.x0) * 16 + 8), sm = gx.imageSmoothingEnabled, at = p => [HL.x0 * TS + p.x * 2, p.y * 2]; // พิกเซลภาพ → พิกเซลเกม (ภาพมีขอบ 1 วางที่ −2)
  gx.imageSmoothingEnabled = false; gx.drawImage(hill, HL.x0 * TS - 2, -2, hill.width * 2, hill.height * 2); gx.imageSmoothingEnabled = sm;
  PixelUI.world(gx, '⚒️', ...at(hill.sign), 9); caveLamp = at(hill.lamp);
  { // ลิฟต์เหมือง: ตู้เหล็ก+ไม้ติดหน้าผาข้างปากถ้ำ ประตูตะแกรง ลูกศรลง + ป้ายไม้บอกว่าจ่ายเหรียญลงชั้นล่างได้ (ตำแหน่งตาม Shared.MINE.lift)
    const L = Shared.MINE.lift, X = L.x * TS, Y = L.y * TS, c = (col, x, y, w, h) => { gx.fillStyle = col; gx.fillRect(X + x, Y + y, w, h); };
    c('rgba(0,0,0,.25)', 1, 29, 30, 3); c('#2b2b33', 2, 2, 28, 28); c('#7d8794', 3, 3, 26, 26); c('#5a4630', 5, 5, 22, 22); c('#14121a', 7, 7, 18, 20);
    for (let i = 0; i < 5; i++) c('#9aa4b0', 8 + i * 4, 7, 2, 20); for (let i = 0; i < 4; i++) c('#6b7480', 7, 10 + i * 5, 18, 2);
    c('#2b2b33', 2, 2, 28, 3); c('#f1c40f', 4, 3, 4, 2); c('#f1c40f', 24, 3, 4, 2); c('#c0392b', 13, 27, 6, 2);
    c('#6b4a2a', 34, -26, 116, 26); c('#2b1b0e', 34, -26, 116, 2); c('#2b1b0e', 34, -2, 116, 2); c('#2b1b0e', 34, -26, 2, 26); c('#2b1b0e', 148, -26, 2, 26); c('#8a6a3e', 36, -24, 112, 2); // ป้ายไม้ ติดผนังหน้าผาขวาของลิฟต์ (เลี่ยงต้นไม้ซ้าย)
    c('#2b1b0e', 30, 2, 4, 3); // ขอเกี่ยวป้ายติดตู้
    gx.font = 'bold 12px sans-serif'; gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillStyle = '#2b1b0e'; gx.fillText('ลิฟต์เหมือง', X + 101, Y - 17); gx.fillStyle = '#ffe9a8'; gx.fillText('ลิฟต์เหมือง', X + 100, Y - 18);
    gx.font = '9px sans-serif'; gx.fillStyle = '#f1c40f'; gx.fillText('จ่ายเหรียญลงชั้นล่าง', X + 100, Y - 6);
    PixelUI.world(gx, '🛗', X + 49, Y - 13, 14);
    c('#f1c40f', 14, 14, 4, 6); c('#f1c40f', 11, 19, 10, 2); c('#f1c40f', 12, 21, 8, 2); c('#f1c40f', 14, 23, 4, 2); // ลูกศรลง
  }
}
function buildBase() {
  const U = PixelArt.U, K = PixelArt.GK, GU = U * K, oc = document.createElement('canvas'); oc.width = W * GU; oc.height = H * GU; // พื้นโลกละเอียด K เท่า (GU = 32 px ต่อช่อง = พิกเซลเกม)
  const g = oc.getContext('2d');
  g.drawImage(PixelArt.ground(MAP.map((row, y) => Array.from(row, (t, x) => (Shared.hillAt(x, y) ? T.GRASS : t))), K), 0, 0); // ใต้ภูเขาถ้ำเป็นหญ้า (ขอบภาพเขาไม่เต็มช่อง)
  g.save(); g.scale(K, K); g.imageSmoothingEnabled = false; // รั้ว/เคาน์เตอร์ยังเป็นสไปรต์ 16 px ต่อช่อง ขยายเท่าตัวตามพื้น
  PixelArt.fences(g, MAP);
  g.restore();
  baseHi = document.createElement('canvas'); baseHi.width = W * TS; baseHi.height = H * TS;
  const gh = baseHi.getContext('2d');
  gh.textAlign = 'center'; gh.textBaseline = 'middle';
  drawCliffs(gh);
  g.scale(GU / TS, GU / TS); // = 1 เมื่อ K = 2 (พื้นอยู่ในหน่วยพิกเซลเกมแล้ว)
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
  }
  { // บ้านหลังใหญ่: สไปรต์พิกเซล (PixelArt.bigHouse) · ประตูตรง HOUSE_DOOR
    const B = Shared.HOUSE_BLD, bx = B.x0 * TS, by = B.y0 * TS, bw = (B.x1 - B.x0 + 1) * TS, bh = (B.y1 - B.y0 + 1) * TS, dx = Shared.HOUSE_DOOR.x * TS;
    g.drawImage(oc, 44 * GU, 2 * GU, (B.x1 - B.x0 + 1) * GU, (B.y1 - B.y0 + 1) * GU, bx, by, bw, bh); // พื้นหญ้าใต้ตัวบ้าน (ช่องตัน)
    const H = PixelArt.bigHouse();
    g.imageSmoothingEnabled = false;
    g.drawImage(H.spr, bx + H.ox * 2, by + H.oy * 2, H.w * 2, H.h * 2); // ×2 ชดเชย g.scale(U/TS)
    PixelUI.world(gh, '🏠', dx + 16, by + 36, 14);
    gh.font = `bold 11px ${FONT}`; gh.fillStyle = '#3d2a1a'; gh.fillText('บ้านหลังใหญ่', dx + 16, by + 52);
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
    const pond = (cx, cy) => { const D = PixelArt.duckPond(); g.imageSmoothingEnabled = false; g.drawImage(D.spr, Math.round(cx - D.w), Math.round(cy - D.h), D.w * 2, D.h * 2); }; // บ่อเป็ดพิกเซล (ขอบดิน หิน กอกก ใบบัว)
    const nest = (px, py) => { g.fillStyle = '#e0bd5a'; g.beginPath(); g.ellipse(px + 16, py + 20, 14, 8, 0, 0, 7); g.fill(); g.fillStyle = '#c9a143'; g.beginPath(); g.ellipse(px + 16, py + 22, 10, 4, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; for (const ex of [-5, 1, 6]) { g.beginPath(); g.ellipse(px + 16 + ex, py + 19, 2.2, 3, 0, 0, 7); g.fill(); } };
    const CH = Shared.PENS.chicken, DK = Shared.PENS.duck, PA = Shared.PENS.cow, SH = Shared.PENS.sheep, PG = Shared.PENS.pig;
    { const AL = Shared.PENS.alpaca, HO = Shared.PENS.horse, BO = Shared.PENS.boar; trough(AL.x0 * TS + 4, AL.y1 * TS); bale(AL.x1 * TS, AL.y0 * TS); trough(HO.x0 * TS + 4, HO.y1 * TS); trough((HO.x0 + 1) * TS + 8, HO.y1 * TS); bale(BO.x1 * TS, BO.y0 * TS); }
    { const TU = Shared.PENS.turkey, GO = Shared.PENS.goat; trough(TU.x0 * TS + 4, TU.y1 * TS); bale(TU.x1 * TS, TU.y1 * TS); trough(GO.x0 * TS + 4, GO.y1 * TS); bale(GO.x1 * TS, GO.y1 * TS); } // คอกแถวบนสุด (ไก่งวง/แพะ) ฟ่อนหญ้ามุมขวาล่าง ไม่ทับป้ายที่แถวบนในเล้า // คอกแถวที่ 3
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
  { const rx = RANKBOARD.x * TS, ry = RANKBOARD.y * TS; // ป้ายอันดับ: กระดานไม้เหมือนป้ายข่าว มีถ้วยทองกับแท่งอันดับ
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(rx + 2, ry + 27, 28, 5);
    g.fillStyle = '#6b4423'; g.fillRect(rx + 5, ry + 10, 4, 21); g.fillRect(rx + 23, ry + 10, 4, 21);
    g.fillStyle = '#8b5a2b'; g.fillRect(rx, ry - 8, 32, 24); g.fillStyle = '#2f3f5c'; g.fillRect(rx + 3, ry - 5, 26, 18);
    g.fillStyle = '#f1c40f'; g.fillRect(rx + 12, ry - 3, 8, 5); g.fillRect(rx + 14, ry + 2, 4, 3); g.fillRect(rx + 12, ry + 5, 8, 2);
    g.fillStyle = '#c9a869'; g.fillRect(rx + 5, ry + 6, 6, 5); g.fillRect(rx + 21, ry + 8, 6, 3); g.fillStyle = '#e8e8e8'; g.fillRect(rx + 13, ry + 8, 6, 3);
    g.fillStyle = '#d63a2f'; g.fillRect(rx + 14, ry - 6, 4, 3); }
  { const ax = ATM.x * TS, ay = ATM.y * TS; // ตู้ ATM
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(ax + 2, ay + 27, 28, 5);
    g.fillStyle = '#4b5d73'; g.fillRect(ax + 4, ay - 8, 24, 37); g.fillStyle = '#6c819b'; g.fillRect(ax + 4, ay - 8, 24, 5);
    g.fillStyle = '#12351f'; g.fillRect(ax + 8, ay - 1, 16, 11); g.fillStyle = '#5dff8a'; g.fillRect(ax + 10, ay + 1, 12, 2); g.fillRect(ax + 10, ay + 5, 8, 2);
    g.fillStyle = '#222'; g.fillRect(ax + 9, ay + 13, 14, 6); g.fillStyle = '#f1c40f'; g.fillRect(ax + 11, ay + 15, 10, 2); g.fillStyle = '#111'; g.fillRect(ax + 10, ay + 22, 12, 3); }
  { const lx = LUCKY.x * TS, ly = LUCKY.y * TS; // ตู้ Lucky Lotto: ตู้แดงมีหลังคาทอง ช่องใส่ตั๋ว ตัวเลขสามหลัก
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(lx + 2, ly + 27, 28, 5);
    g.fillStyle = '#8f2620'; g.fillRect(lx + 4, ly - 8, 24, 37); g.fillStyle = '#c0392b'; g.fillRect(lx + 4, ly - 8, 24, 5);
    g.fillStyle = '#f1c40f'; g.fillRect(lx + 3, ly - 10, 26, 3); g.fillStyle = '#7a1a16'; g.fillRect(lx + 4, ly + 28, 24, 1);
    g.fillStyle = '#fff3c4'; g.fillRect(lx + 8, ly - 2, 16, 11); g.fillStyle = '#c0392b'; g.fillRect(lx + 10, ly + 1, 3, 5); g.fillRect(lx + 14, ly + 1, 3, 5); g.fillRect(lx + 18, ly + 1, 3, 5);
    g.fillStyle = '#222'; g.fillRect(lx + 9, ly + 13, 14, 6); g.fillStyle = '#f1c40f'; g.fillRect(lx + 11, ly + 15, 10, 2); g.fillStyle = '#111'; g.fillRect(lx + 10, ly + 22, 12, 3); }
  { const fx = FLEA.x * TS, fy = FLEA.y * TS; // ป้ายตลาดนัด: กระดานไม้ มีถุงเหรียญกับกล่องของวางบนแผง
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(fx + 2, fy + 27, 28, 5);
    g.fillStyle = '#6b4423'; g.fillRect(fx + 5, fy + 10, 4, 21); g.fillRect(fx + 23, fy + 10, 4, 21);
    g.fillStyle = '#8b5a2b'; g.fillRect(fx, fy - 8, 32, 24); g.fillStyle = '#e9f2dc'; g.fillRect(fx + 3, fy - 5, 26, 18);
    g.fillStyle = '#e8a33d'; g.fillRect(fx + 6, fy - 2, 9, 9); g.fillStyle = '#f1c40f'; g.fillRect(fx + 20, fy + 2, 6, 6); g.fillStyle = '#a8731f'; g.fillRect(fx + 22, fy + 4, 2, 2);
    g.fillStyle = '#c9a869'; g.fillRect(fx + 6, fy + 9, 20, 2);
    g.fillStyle = '#d63a2f'; g.fillRect(fx + 14, fy - 6, 4, 3); }
  { const tag = (txt, cx, y) => { gh.font = 'bold 8px sans-serif'; const w = gh.measureText(txt).width + 8; g.fillStyle = 'rgba(40,28,14,.85)'; g.fillRect(cx - w / 2, y, w, 11); gh.fillStyle = '#fff'; gh.textAlign = 'center'; gh.textBaseline = 'middle'; gh.fillText(txt, cx, y + 5.5); }; // ป้ายชื่อเหนือกระดานข่าว ATM และตู้กองกลาง
    tag('ข่าวเมือง', BOARD.x * TS + 16, BOARD.y * TS - 22); tag('อันดับ', RANKBOARD.x * TS + 16, RANKBOARD.y * TS - 22); tag('ATM', ATM.x * TS + 16, ATM.y * TS - 22); tag('Lucky Lotto', LUCKY.x * TS + 16, LUCKY.y * TS - 22); tag('ตลาดนัด', FLEA.x * TS + 16, FLEA.y * TS - 22); }
  // เสาไฟ + กระถางดอกไม้รอบลาน (ภาพพื้นอย่างเดียว ไม่ชนการเดิน/เคาน์เตอร์) ให้หนาแน่นใกล้ภาพอ้างอิง
  { const lamp = (tx, ty) => {
      const px = tx * TS, py = ty * TS;
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(px + 10, py + 28, 12, 4);
      g.fillStyle = '#2a1b14'; g.fillRect(px + 14, py + 2, 4, 28); g.fillStyle = '#4a3a2a'; g.fillRect(px + 14, py + 2, 2, 26);
      g.fillStyle = '#2a1b14'; g.fillRect(px + 10, py - 2, 12, 8); g.fillStyle = '#f2c14e'; g.fillRect(px + 12, py, 8, 5);
      g.fillStyle = '#ffe9a0'; g.fillRect(px + 13, py + 1, 3, 2);
    };
    const pot = (tx, ty, col) => {
      const px = tx * TS + 8, py = ty * TS + 14;
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(px + 1, py + 14, 14, 3);
      g.fillStyle = '#6b4423'; g.fillRect(px, py + 8, 16, 10); g.fillStyle = '#a0692f'; g.fillRect(px, py + 8, 16, 3);
      g.fillStyle = '#3f9a3a'; g.fillRect(px + 4, py + 2, 8, 7); g.fillStyle = col; g.fillRect(px + 2, py, 4, 4); g.fillRect(px + 10, py, 4, 4); g.fillStyle = '#ffe37a'; g.fillRect(px + 6, py - 1, 3, 3);
    };
    const P = PLAZA; // เสาไฟ/กระถางวางตามมุมลานกองไฟ (ย้ายตามลานเมื่อผู้ดูแลย้ายกองไฟ)
    for (const [x, y] of [[P.x0, P.y0 + 1], [P.x1, P.y0 + 1], [P.x0, P.y1], [P.x1, P.y1]]) lamp(x, y);
    for (const [x, y, c] of [[P.x0, P.y0, '#ff8fc7'], [P.x1, P.y0, '#9fd4ff'], [P.x0 + 1, P.y1, '#ffd24a'], [P.x1 - 1, P.y1, '#ff8fc7']]) pot(x, y, c);
  }
  // สิ่งก่อสร้างจากโครงการพัฒนาเมือง (วาดเมื่อครบเป้า) • ฟังก์ชันใน drawStructures ด้านล่าง
  drawStructures(g, gh);
  return oc;
}
const builtProj = new Set(); // โครงการที่ครบเป้าและแปลงลง MAP ของหน้านี้แล้ว
let base = buildBase();
function checkProjects() { // โครงการไหนครบเป้า: แปลงช่องบน MAP แล้ววาดพื้นและแผนที่ย่อใหม่ครั้งเดียว (ไม่ว่าจะครบทีละโครงการหรือพร้อมกันตอนเข้าเกม)
  let changed = false;
  for (const P of Shared.PROJECTS) {
    if (!builtProj.has(P.id)) { builtProj.add(P.id); Shared.applyProject(tmap(), P.id); changed = true; }
  }
  if (changed) { if (!inTown()) townDirty = true; else { base = buildBase(); miniBase = makeMiniBase(); } }
}

// ---------- drawing helpers ----------
function darken(hex, a) { const n = parseInt(hex.slice(1), 16); const f = c => Math.max(0, Math.round(c * (1 - a))); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; }
function drawSeat(s) {
  const px = s.x * TS, py = s.y * TS;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(px + 3, py + 24, 26, 5);
  if (s.kind === 'bench') { // ม้านั่งไม้พิกเซล (3 โทน + ขอบ) ให้ใกล้ภาพอ้างอิง
    ctx.fillStyle = '#5a371e'; ctx.fillRect(px + 1, py + 17, 5, 10); ctx.fillRect(px + 26, py + 17, 5, 10);
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(px + 2, py + 18, 3, 8); ctx.fillRect(px + 27, py + 18, 3, 8);
    ctx.fillStyle = '#a0692f'; ctx.fillRect(px, py + 12, 32, 8); ctx.fillStyle = '#c98b4a'; ctx.fillRect(px, py + 12, 32, 3);
    ctx.fillStyle = '#6a4220'; ctx.fillRect(px, py + 19, 32, 1); for (const lx of [8, 16, 24]) ctx.fillRect(px + lx, py + 13, 1, 6);
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(px + 1, py + (s.face === 1 ? 20 : 4), 30, 5);
    ctx.fillStyle = '#c98b4a'; ctx.fillRect(px + 1, py + (s.face === 1 ? 20 : 4), 30, 2);
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
function drawTree(x, y, kind, rot = 0, alpha = 1, ctx = mainCtx) { // สไปรต์ต้นไม้พิกเซล · โคนต้นกลางขอบล่างช่อง · ไม่เบลอตอนขยาย • rot = เอียงรอบโคน (ส่ายตอนโดนฟัน/ล้ม)
  const key = x + ',' + y, s0 = PixelArt.tree(x, y, kind || treeKinds.get(key)), s = winterFlag ? snowSprite(s0, WINTER.tree) : s0, hit = kind ? null : treeHit.get(key), now = performance.now();
  if (hit && now - hit.t > 20000) treeHit.delete(key);
  if (hit) rot = PixelAction.treeSway(now - hit.t);
  ctx.imageSmoothingEnabled = false;
  const dw = s.width * 2, dh = s.height * 2, bx = x * TS + TS / 2, by = y * TS + TS;
  if (rot || alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; ctx.translate(bx, by - 4); ctx.rotate(rot); ctx.translate(-bx, -(by - 4)); }
  ctx.drawImage(s, Math.round(bx - dw / 2), Math.round(by - dh), dw, dh);
  if (rot || alpha < 1) ctx.restore();
  if (hit && hit.f < 0.8) { // รอยบากที่โคนต้น ลึกขึ้นตาม HP ที่หายไป (เนื้อไม้สีอ่อนข้างใน)
    const d = hit.f < 0.3 ? 3 : hit.f < 0.55 ? 2 : 1; ctx.fillStyle = '#2a1b14'; ctx.fillRect(bx - 4, by - 10, 2 + d * 2, 4); ctx.fillStyle = '#e8c08a'; ctx.fillRect(bx - 3, by - 9, d * 2, 2);
  }
}
function drawFelled(k, f, now, ctx = mainCtx) { // ต้นไม้ที่เพิ่งล้ม (PixelAction.treeFall): เอียงล้มรอบโคน → กระแทกพื้นมีใบไม้/ฝุ่นกระจาย → จาง + ตอไม้
  const [x, y] = k.split(',').map(Number), t = now - f.t, st = PixelAction.treeFall(t); if (!st) { felled.delete(k); return; }
  const bx = x * TS + TS / 2, by = y * TS + TS;
  ctx.fillStyle = '#4a3020'; ctx.fillRect(bx - 5, by - 7, 10, 6); ctx.fillStyle = '#e8c08a'; ctx.fillRect(bx - 4, by - 7, 8, 2); ctx.fillStyle = '#b07a44'; ctx.fillRect(bx - 2, by - 7, 4, 1); // ตอไม้
  drawTree(x, y, f.k, st.ang * f.side, st.alpha, ctx);
  if (st.land) PixelAction.burst(ctx, 'chop', bx + f.side * 40, by - 6, t - 520, x * 13 + y, ['#5fa844', '#3f8a34'], f.side); // ยอดไม้กระแทกพื้น: ใบไม้กระจาย
}
// ร้านค้า: สไปรต์อาคาร + อีโมจิบนหลังคา + ป้ายชื่อกระดานไม้
function drawBuilding(b) {
  const a = PixelArt.building(b), bx = b.x0 * TS, by = b.y0 * TS, bw = (b.x1 - b.x0 + 1) * TS;
  ctx.drawImage(winterFlag ? snowSprite(a.spr, WINTER.roof) : a.spr, bx + a.ox * 2, by + a.oy * 2, a.w * 2, a.h * 2);
  if (b.closed && PixelArt.closedBoards) { // ร้านปิดปรับปรุง: แผ่นไม้ไขว้ปิดประตู + ป้ายแขวน (ไม่มีตัวอักษรในสไปรต์)
    const cb = PixelArt.closedBoards(); ctx.drawImage(cb.spr, bx + cb.ox * 2, by + cb.oy * 2, cb.w * 2, cb.h * 2);
    const sg = cb.sign, sx0 = bx + (cb.ox + sg.x) * 2, sy0 = by + (cb.oy + sg.y) * 2, sw = sg.w * 2, sh = sg.h * 2, txt = 'ปิดปรับปรุง';
    let fs = 11; ctx.font = `bold ${fs}px ${FONT}`; while (fs > 6 && ctx.measureText(txt).width > sw - 4) { fs--; ctx.font = `bold ${fs}px ${FONT}`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#2a1b14'; ctx.fillText(txt, sx0 + sw / 2, sy0 + sh / 2 + 0.5);
  }
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
const rodAngle = p => { const F = PixelAction.frame(p, performance.now()); return F ? F.a : (p.dir || 0) >= 2 ? 0.8 : 0.15; }; // มุมคันเบ็ด: ตอนเหวี่ยงตามเฟรมท่าตกปลา (pixelaction.js)
const ROD_E = new Set(Object.values(Shared.ROD_EMOJI)), AXE_E = new Set(Object.values(Shared.AXE_EMOJI)); // อีโมจิขวาน/คันทุกระดับ (ไอคอน+ท่าถือสีตามระดับ)
const isRodHeld = p => !!p.held && ROD_E.has(p.held.replace(/\uFE0F/g, '')) && !p.sit;
function rodTip(p) { // ปลายคันเบ็ด (ตรงกับที่ drawHeldTool วาด: จุดปลาย 12,-19 หมุนตามมุมคัน + มือที่เลื่อนตามเฟรมท่า)
  let [hx, hy, fx] = heldHand(p); const a = rodAngle(p), F = PixelAction.frame(p, performance.now());
  if (F) { const lx = (p.dir || 0) >= 2 ? F.lean * fx : 0; hx += F.hx * fx + lx; hy += F.hy + F.bob; }
  return [hx + fx * (12 * Math.cos(a) + 19 * Math.sin(a)), hy + 12 * Math.sin(a) - 19 * Math.cos(a)];
}
function drawHeldTool(p, now, ctx = mainCtx) {
  const e = p.held.replace(/️/g, ''), OUT = PixelArt.OUT, dir = p.dir || 0;
  const sn = p.moving && !p.sit ? Math.sin((p.anim || 0) * 14) : 0, f = sn > .35 ? 1 : sn < -.35 ? 2 : 0;
  const lampSide = dir === 2 || dir === 1 ? -1 : 1, hs = p.lamp ? -lampSide : lampSide;
  let hx, fx, hy = p.y + 3;
  if (dir < 2) { fx = hs; hx = p.x + hs * 8; if (f === (hs > 0 ? 2 : 1)) hy += 2; }                      // หน้า/หลัง: มือซ้าย/ขวา (แขนที่ก้าวลงต่ำกว่า)
  else { fx = dir === 3 ? 1 : -1; hx = p.x + fx * (1 + 2 * (f === 1 ? -1 : f === 2 ? 1 : 0)); }          // ข้าง: แขนอยู่กลางลำตัว
  const F = PixelAction.frame(p, performance.now()); // เฟรมท่าทำงาน (ขุด/ตัด/ตกปลา) จากสไปรต์ชีต null = ท่าถือปกติ
  if (F) hx += F.hx * fx, hy += F.hy;
  const k = p.useAt ? (performance.now() - p.useAt) / 260 : 2, sw = k < 1 ? Math.sin(k * Math.PI) : 0; // ท่าใช้งาน 0→1→0 (บัวรดน้ำ/ของในมือ)
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const WOOD = '#9c6a35', WD = '#6b4423', STEEL = '#b9c2cc', STH = '#e8eef3';
  const a0 = dir >= 2 ? 0.95 : 0.3; // มุมถือจอบ/ขวาน/อีเต้อตอนไม่ได้ใช้: ด้านข้างถือเอียงไปข้างหน้ามากกว่า (ไม่พาดหน้า) ตอนใช้ตามเฟรม PixelAction
  const isHoe = e === '⛏', isAxe = AXE_E.has(e), isRod = ROD_E.has(e), isCan = WATER_EMOJIS.has(e), isPick = !isHoe && PixelAction.kindOf(e) === 'mine', ang = F ? F.a : a0;
  if (isHoe || isAxe || isRod || isCan || isPick) {
    ctx.save(); ctx.translate(hx, hy); ctx.scale(fx, 1);
    if (isPick) { // อีเต้อ: ด้ามไม้ + หัวโค้งปลายแหลมสองข้าง สีตามระดับ (PixelUI.PICK_PAL) ขนาดเท่าขวาน
      const [pb, ph, ps] = PixelUI.PICK_PAL[e] || ['#8d99a6', '#c9d3dc', '#6c7782'];
      ctx.rotate(ang); R(-2, -12, 4, 14, OUT); R(-1, -11, 2, 12, WOOD); R(0, -11, 1, 12, WD);
      R(-8, -16, 17, 5, OUT); R(-10, -13, 3, 4, OUT); R(8, -13, 3, 4, OUT); R(-7, -15, 15, 3, pb); R(-7, -15, 15, 1, ph); R(-9, -12, 2, 2, ps); R(8, -12, 2, 2, ps); R(-2, -13, 4, 2, ps);
      if (/[💨🔌🧨💣]/u.test(e) && Math.floor(now / 280) % 2) { R(-5, -15, 1, 1, '#ffffff'); R(5, -14, 1, 1, '#ffffff'); } } // ทองคำ/มรกต/เพชร/มิทริลมีประกาย
    else if (isHoe) { ctx.rotate(ang); R(-2, -12, 4, 14, OUT); R(-1, -11, 2, 12, WOOD); R(0, -11, 1, 12, WD); R(-6, -14, 13, 5, OUT); R(-5, -13, 11, 3, STEEL); R(-5, -13, 11, 1, STH); R(-5, -11, 2, 2, STEEL); R(4, -11, 2, 2, STEEL); }
    else if (isAxe) { const [ab, ah, as] = PixelUI.AXE_PAL[e] || [STEEL, STH, '#6c7782']; ctx.rotate(ang); R(-2, -12, 4, 14, OUT); R(-1, -11, 2, 12, WOOD); R(0, -11, 1, 12, WD); R(0, -14, 8, 8, OUT); R(1, -13, 6, 6, ab); R(1, -13, 6, 1, ah); R(6, -13, 2, 6, ah); R(1, -8, 5, 1, as); if (e === '🪢' && Math.floor(now / 280) % 2) R(4, -12, 1, 1, '#ffffff'); } // หัวขวานสีตามระดับ (PixelUI.AXE_PAL)
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
      const rp = PixelUI.ROD_PAL[e] || [WOOD, '#e8d6a8', WD, '#9aa0a6']; ctx.rotate(rodAngle(p)); // ด้านข้างชี้คันเบ็ดไปข้างหน้า ไม่พาดหน้า • สีคัน/รอกตามระดับ (PixelUI.ROD_PAL)
      ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(3, -9); ctx.lineTo(12, -19); ctx.stroke();
      ctx.strokeStyle = rp[0]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(3, -9); ctx.lineTo(12, -19); ctx.stroke();
      R(-2, -3, 4, 4, OUT); R(-1, -2, 2, 2, rp[3]);
      if (!p.fs) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(12, -19); ctx.lineTo(12, -8); ctx.stroke(); R(11, -8, 2, 2, '#e04b4b'); } // ตอนตกปลาใช้สายเอ็นจริง (drawFishing) แทน
    }
    ctx.restore();
  } else { // เมล็ด / อาหาร / ยา: ไอคอนเล็กในมือ (เด้งตอนใช้)
    PixelUI.world(ctx, p.held, Math.round(hx + fx * 3), Math.round(hy - 3 - sw * 3), 10);
  }
}
// เศษหิน/ประกายไฟ (ขุด) • เศษไม้/ใบไม้ (ตัดไม้) • ดิน (จอบ) กระเด็นที่จุดกระทบ หลังจังหวะฟาดของสไปรต์ชีต (ตกปลาใช้น้ำกระเซ็นตอนทุ่นตกน้ำใน drawFishing)
// สไปรต์ชีตตัวอย่างของท่าทำงาน (ดีบัก/เอกสาร: __mw.actionSheet()) แถว = ท่า × ทิศ (ข้าง/หน้า/หลัง) คอลัมน์ = เฟรม ใช้ชุดตัวละครของเรา
function actionSheet() {
  const P = Shared.PICK_EMOJI[6], rows = [['mine', P, 3], ['mine', P, 0], ['mine', P, 1], ['chop', '🪓', 3], ['chop', '🪓', 0], ['chop', '🪓', 1], ['fish', '🎣', 3], ['fish', '🎣', 0], ['fish', '🎣', 1]], cw = 80, chh = 84, n = 7;
  const c = document.createElement('canvas'); c.width = cw * n; c.height = chh * rows.length; let g = c.getContext('2d');
  g.fillStyle = '#8bbf5a'; g.fillRect(0, 0, c.width, c.height);
  rows.forEach(([k, e, d], r) => { const S = PixelAction.SHEETS[k], fr = d >= 2 ? S.side : d === 1 ? S.back : S.front; g.fillStyle = r & 1 ? '#7fb452' : '#8bbf5a'; g.fillRect(0, r * chh, c.width, chh);
    fr.forEach((_, i) => { const now = performance.now(); drawPlayer(Object.assign({}, me, { name: '', x: i * cw + 40, y: r * chh + 54, dir: d, held: e, moving: false, sit: null, lamp: false, veh: '', wet: false, speaking: false, chat: '', useAt: now - i * S.ms - 1, useK: k, actPt: null, catchFx: null }), now, g); }); });
  // ชีตเอฟเฟกต์ที่เป้าหมาย: แถวละลำดับเวลา (ms) • แร่โดนฟาด/ร้าว • แร่แตก • ต้นไม้โดนฟัน • ต้นไม้ล้ม • ปลาที่ตกได้
  const fx = [
    { h: 70, cells: [[0, 1], [40, 0.9], [120, 0.9], [400, 0.6], [400, 0.35], [400, 0.1]], f: (x, y, [t, f], now) => { oreHit.set('0,0', { t: now - t, f }); g.save(); g.translate(x - 16, y - 40); drawOre(0, 0, 'gold', now, 1, g); g.restore(); oreHit.delete('0,0'); } },
    { h: 70, cells: [0, 60, 140, 250, 380, 500, 620], f: (x, y, t) => PixelAction.shatter(g, x, y - 22, t, ORE_COL.gold, 7, false) },
    { h: 130, cells: [[0, 1], [40, 0.7], [110, 0.7], [400, 0.5], [400, 0.25]], f: (x, y, [t, f], now) => { treeHit.set('0,0', { t: now - t, f }); g.save(); g.translate(x - 16, y - 32); drawTree(0, 0, undefined, 0, 1, g); g.restore(); treeHit.delete('0,0'); } },
    { h: 130, cells: [0, 160, 320, 460, 560, 700, 860], f: (x, y, t, now) => { g.save(); g.translate(x - 40, y - 32); drawFelled('1,0', { t: now - t, k: 'broad', side: 1 }, now, g); g.restore(); felled.clear(); } },
    { h: 110, cells: [0, 120, 260, 420, 560, 900, 1300], f: (x, y, t, now) => drawPlayer(Object.assign({}, me, { name: '', x, y, dir: 0, held: '🎣', moving: false, sit: null, lamp: false, veh: '', wet: false, speaking: false, chat: '', useAt: 0, catchFx: { t: now - t, e: '🐟', big: false, x: x + 34, y: y + 20 } }), now, g) },
  ];
  const c2 = document.createElement('canvas'); c2.width = c.width; c2.height = c.height + fx.reduce((a, r) => a + r.h, 0); const g2 = c2.getContext('2d'); g2.drawImage(c, 0, 0);
  let oy = c.height; const g0 = g;
  fx.forEach((r, ri) => { g2.fillStyle = ri & 1 ? '#5a5f6e' : '#4d5260'; g2.fillRect(0, oy, c2.width, r.h); r.cells.forEach((cell, i) => { const now = performance.now(); g2.save(); g2.beginPath(); g2.rect(i * cw, oy, cw, r.h); g2.clip(); g = g2; r.f(i * cw + 40, oy + r.h - 14, cell, now); g2.restore(); }); oy += r.h; });
  g = g0; return c2;
}
function drawCatch(p, ctx) { // ปลากระโดดจากทุ่นเป็นวงโค้ง หมุนทีละ 45° มาชูค้างเหนือหัว + น้ำกระเซ็นตอนหลุดจากน้ำ (ปลาหายากมีแสงทอง)
  const c = p.catchFx, t = performance.now() - c.t, a = PixelAction.fishArc(t, c.x, c.y, p.x, p.y - 38); if (!a) { p.catchFx = null; return; }
  PixelAction.burst(ctx, 'splash', c.x, c.y, t, (c.t * 5) | 0);
  ctx.save(); ctx.globalAlpha = a.alpha;
  if (c.big || a.held) { const g = ctx.createRadialGradient(a.x, a.y, 1, a.x, a.y, c.big ? 22 : 14); g.addColorStop(0, c.big ? 'rgba(255,224,110,.6)' : 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,224,110,0)'); ctx.fillStyle = g; ctx.fillRect(a.x - 22, a.y - 22, 44, 44); }
  ctx.translate(Math.round(a.x), Math.round(a.y)); ctx.rotate(a.rot); ctx.scale(a.flip, 1); PixelUI.world(ctx, c.e, 0, 0, 20); ctx.restore();
  if (a.held) { const k = ((t / 120) | 0) % 4; ctx.fillStyle = '#ffffff'; for (const [dx, dy, i] of [[-14, -8, 0], [13, -12, 2], [10, 6, 1], [-11, 8, 3]]) if (i === k || i === (k + 2) % 4) { ctx.fillRect(a.x + dx, a.y + dy - 2, 1, 5); ctx.fillRect(a.x + dx - 2, a.y + dy, 5, 1); } } // ประกายรอบปลา
}
function drawActionBurst(p, ctx) {
  const k = PixelAction.kindOf(p.held); if (!k || k === 'fish' || !p.useAt || p.sit) return;
  const S = PixelAction.SHEETS[k], t = performance.now() - p.useAt - S.hit * S.ms; if (t < 0 || t > PixelAction.BURST[k].life) return;
  const [x, y] = p.actPt && p.actAt === p.useAt ? p.actPt : PixelAction.front(p), tx = Math.floor(x / TS), ty = Math.floor(y / TS);
  const hoe = (p.held || '').replace(/\uFE0F/g, '') === '⛏', ore = cave && oreK.get(tx + ',' + ty);
  const cols = hoe ? ['#b07a44', '#6b4423'] : ore ? ORE_COL[ore] : null;
  PixelAction.burst(ctx, k, x, y, t, (p.useAt * 7) | 0, cols, (p.dir || 0) === 2 ? -1 : (p.dir || 0) === 3 ? 1 : 0);
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
  const fight = p.fs === 3, bite = p.fs === 2 || fight, ph = (p.id || 0) * 1.7; // fs 3 = กำลังชักเย่อ: สายตึง ทุ่นดิ้น น้ำกระเซ็น
  const bob = fight ? Math.sin(t / 60 + ph) * 4 + Math.sin(t / 23) * 1.5 + 2 : bite ? Math.sin(t / 45) * 3.5 + 3 : Math.sin(t / 420 + ph) * 1.6;
  const bx = sx + (p.fx - sx) * e + (bite ? Math.sin(t / 38) * 1.5 : 0);
  const by = sy + (p.fy - sy) * e - Math.sin(Math.PI * k) * 34 + (k >= 1 ? bob : 0);
  const sag = k < 1 ? 6 : bite ? 2 : 9 + Math.sin(t / 700 + ph) * 3;             // ตึงตอนกัด หย่อนตอนรอ
  const mx = (sx + bx) / 2 + Math.sin(t / 900 + ph) * (bite ? 0.5 : 2.5), my = (sy + by) / 2 + sag;
  if (k >= 1) PixelAction.burst(ctx, 'splash', p.fx, p.fy, t - (p.castAt || 0) - 480, ((p.castAt || 0) * 3) | 0); // น้ำกระเซ็นตอนทุ่นตกน้ำ
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
  if (fight) PixelAction.burst(ctx, 'splash', p.fx + Math.sin(t / 330 + ph) * 10, p.fy, t % 520, (Math.floor(t / 520) * 7 + (p.id || 0)) | 0); // ปลาดิ้นน้ำกระเซ็นเป็นระยะ
  if (p.fs === 2) { ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3d2a1a'; ctx.lineWidth = 3; ctx.strokeText('❗', p.fx, p.fy - 14); ctx.fillText('❗', p.fx, p.fy - 14 + Math.sin(t / 60) * 1.5); }
}
// ===== เอฟเฟกต์เลเวลอัพ (ตกแต่งล้วน: ตารางสีตามช่วงเลเวล) =====
const LV_TIERS = [ // ใช้ช่วง from ที่ใหญ่สุดที่ไม่เกินเลเวล • เลเวลสูงสุด (MAX_LV) = สายรุ้ง
  { from: 1, cols: ['#e0955a', '#ffd2a8', '#8fd3f4', '#fff3d6'], n: 14, rings: 1 },
  { from: 5, cols: ['#e8eef5', '#b9c7d8', '#8fd3f4', '#ffffff'], n: 22, rings: 1 },
  { from: 10, cols: ['#ffd24a', '#fff1a0', '#ffb02e', '#ffffff'], n: 32, rings: 2 },
];
const LV_RAINBOW = { cols: ['#ff5a5a', '#ffb02e', '#ffe14a', '#4ad66d', '#4ab8ff', '#b06bff'], n: 44, rings: 3, rb: true };
const lvReduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const lvRnd = (i, s) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
function lvTier(lv) { if (lv >= MAX_LV) return LV_RAINBOW; let t = LV_TIERS[0]; for (const x of LV_TIERS) if (lv >= x.from) t = x; return t; }
function lvHop(p) { const f = p.lvFx; if (!f || !f.hop) return 0; const t = performance.now() - f.t, d = 340 * f.hop; return t >= 0 && t < d ? -Math.round(Math.abs(Math.sin(t / 340 * Math.PI)) * 7) : 0; } // กระโดดดีใจ 1–2 จังหวะ (ของเรา)
function onLvUp(m) {
  const p = players.get(m.id), lv = Math.max(1, m.lv | 0), n = Math.max(1, m.n | 0), mine = m.id === myId;
  if (!p) return; // ไม่อยู่ในฉากเดียวกัน = ข้าม
  const T = lvTier(lv), mile = lv % 5 === 0, red = lvReduced(), sc = (mine ? 1 : 0.5) * (mile ? 1.25 : 1) * (1 + 0.12 * Math.min(4, n - 1));
  let cnt = Math.min(mine ? 60 : 8, Math.round(T.n * (mile ? 1.5 : 1) * (mine ? 1 : 0.25) * (1 + 0.2 * (n - 1)))); if (red) cnt = Math.ceil(cnt / 3);
  p.lvFx = { t: performance.now(), lv, tier: T, n: cnt, rings: mine ? T.rings + (mile ? 1 : 0) : 1, sc, mine, dur: mine ? 3200 : 1500, hop: mine && !red ? (mile ? 2 : 1) : 0, seed: lv * 13 + (m.id | 0) };
  if (!mine) return;
  const sk = SKILLS[m.skill], b = $('lvBanner'), fl = $('lvFlash'); if (!b) return;
  b.className = T.rb ? 'rb' : ''; b.style.setProperty('--lc1', T.cols[0]); b.style.setProperty('--lc2', T.cols[1]); b.style.setProperty('--ls', String(Math.min(1.5, 1 + 0.1 * (n - 1) + (mile ? 0.12 : 0))));
  b.querySelector('.lvK').textContent = sk ? `${sk.emoji} ${sk.name}` : '✨'; b.querySelector('.lvN').textContent = n > 1 ? `Lv ${Math.max(1, lv - n)} → ${lv}` : `Lv ${lv}`;
  b.querySelector('.lvX').textContent = lv >= MAX_LV ? '🌈 สูงสุดแล้ว! สุดยอดเลย' : mile ? '⭐ ก้าวสำคัญ! เก่งสุดๆ' : n > 1 ? `ขึ้นรวดเดียว ${n} เลเวล!` : 'เก่งขึ้นอีกขั้นแล้ว';
  void b.offsetWidth; b.classList.add('go'); // เริ่มแอนิเมชันใหม่ทุกครั้ง
  if (fl && !red) { fl.className = ''; fl.style.setProperty('--lc1', T.cols[1]); void fl.offsetWidth; fl.classList.add('go'); }
  playSfx('lvsparkle', mile ? 1 : 0.7);
}
function drawLvFx(p, ctx, y) {
  const f = p.lvFx, t = performance.now() - f.t; if (t > f.dur) { p.lvFx = null; return; }
  const x = p.x, T = f.tier, c0 = T.cols[0], cy = y - 6, u = t / f.dur;
  ctx.save();
  const R = 34 * f.sc, gr = ctx.createRadialGradient(x, cy, 2, x, cy, R); gr.addColorStop(0, T.rb ? '#ffffff' : c0); gr.addColorStop(1, (T.rb ? '#ffffff' : c0) + '00'); // แสงเรืองรอบตัว
  ctx.globalAlpha = Math.max(0, (1 - u) * (0.55 + 0.15 * Math.sin(t / 70))); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, cy, R, 0, 7); ctx.fill();
  for (let r = 0; r < f.rings; r++) { // วงแหวนขยายออกจากเท้า
    const s = (t - r * 220) / 750; if (s <= 0 || s >= 1) continue; const rad = (10 + s * 40) * f.sc;
    ctx.globalAlpha = 1 - s; ctx.lineWidth = 1 + 2.5 * (1 - s); ctx.strokeStyle = T.rb ? `hsl(${(r * 90 + t / 4) % 360},90%,65%)` : T.cols[r % T.cols.length]; ctx.beginPath(); ctx.ellipse(x, y + 10, rad, rad * 0.4, 0, 0, 7); ctx.stroke();
  }
  for (let i = 0; i < f.n; i++) { // ประกายดาว/คอนเฟตติพุ่งขึ้นแล้วร่วงเป็นโค้ง
    const s = (t - lvRnd(i, f.seed) * 260) / 1100; if (s < 0 || s > 1) continue;
    const a = -Math.PI / 2 + (lvRnd(i, f.seed + 1) - 0.5) * 2.6, sp = (45 + lvRnd(i, f.seed + 2) * 75) * f.sc;
    const px = Math.round(x + Math.cos(a) * sp * s), py = Math.round(cy + Math.sin(a) * sp * s + 0.5 * 150 * s * s * f.sc), sz = 2 + Math.floor(lvRnd(i, f.seed + 3) * 3);
    ctx.globalAlpha = Math.min(1, (1 - s) * 1.6); ctx.fillStyle = T.rb ? `hsl(${(i * 47 + t / 5) % 360},90%,62%)` : T.cols[i % T.cols.length];
    if (i % 3 === 0) { ctx.fillRect(px - sz - 1, py, 2 * sz + 2, 2); ctx.fillRect(px - 1, py - sz - 1, 2, 2 * sz + 2); } // ดาวสี่แฉก
    else { const w = Math.max(1, Math.round(sz * 2 * Math.abs(Math.cos(s * 9 + i)))); ctx.fillRect(px, py, w, sz + 1); } // คอนเฟตติพลิกหมุน
  }
  if (!f.mine) { ctx.globalAlpha = Math.min(1, (1 - u) * 2); ctx.font = `bold 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = PixelArt.OUT; const txt = `⭐ Lv ${f.lv}`, ty = y - 54 - u * 14; ctx.strokeText(txt, x, ty); ctx.fillStyle = '#ffe266'; ctx.fillText(txt, x, ty); } // คนอื่นเลเวลอัพ: ตัวอักษรลอย
  ctx.restore();
}
function drawPlayer(p, now, cx) {
  const ctx = cx || mainCtx, x = p.x, riding = !!(p.veh && !p.sit && Shared.VEHICLES[p.veh] && PixelVehicle.sprite);
  let y = p.y;
  if (riding) PixelVehicle.draw(ctx, p, now, PixelChar); // ผู้ขี่นั่งบนยานพาหนะพิกเซล (ล้อหมุน 4 ทิศ ขาปั่น ควันท่อ) ใน pixelchar.js
  const F = !riding && PixelAction.frame(p, performance.now()), bx = F && (p.dir || 0) >= 2 ? F.lean * (p.dir === 2 ? -1 : 1) : 0, ct = p.catchFx ? performance.now() - p.catchFx.t : -1, by = (F ? F.bob : 0) + lvHop(p) + (ct > 550 && ct < 750 ? -Math.round(Math.sin((ct - 550) / 200 * Math.PI) * 4) : 0); // ได้ปลา: กระโดดดีใจตอนรับปลา // ท่าทำงาน: ตัวโน้ม/ยุบตามเฟรม
  if (!riding) { ctx.fillStyle = 'rgba(38,40,16,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 9, 3.5, 0, 0, 7); ctx.fill();
    if (p.lie) { // นอนบนเตียง: หมุนตัวละครยืนเป็นท่านอนราบ (ชื่อ/ฟองแชทไม่หมุน)
      ctx.save(); ctx.translate(bx, by); ctx.translate(x, y - 8); ctx.rotate(p.lieRot || Math.PI / 2); ctx.translate(-x, -(y - 8));
      PixelChar.draw(ctx, Object.assign({}, p, { sit: false, moving: false }), now); ctx.restore();
    } else { ctx.save(); ctx.translate(bx, by); PixelChar.draw(ctx, inOcean() ? Object.assign({}, p, { moving: false }) : p, now); ctx.restore(); } } // ตัวละครพิกเซล (ขับเรือในทะเลใหญ่: ยืนนิ่งไม่ก้าวขา) chibi (pixelchar.js)
  if (p.lvFx) drawLvFx(p, ctx, y);
  if (riding) y -= PixelVehicle.lift(p.veh); // ผู้ขี่ตัวสูงขึ้น ป้ายชื่อ/ฟองแชท/ไอคอนเลื่อนตาม
  if (p.wet) { PixelUI.world(ctx, '🪣', x, y - 20, 16); ctx.fillStyle = 'rgba(120,190,255,.85)'; for (let i = 0; i < 4; i++) { const t = (now / 600 + i / 4) % 1; ctx.fillRect(x - 10 + i * 7, y - 14 + t * 24, 2, 4); } } // โดนราดน้ำจากชาเลนจ์
  if (p.lamp) drawHeldLamp(p, now);
  if (p.held && !p.sit && !riding) { ctx.save(); ctx.translate(bx, by); drawHeldTool(p, now, ctx); ctx.restore(); drawActionBurst(p, ctx); }
  if (p.catchFx) drawCatch(p, ctx); // ปลาที่เพิ่งตกได้ลอยมาชูเหนือหัว // ถืออุปกรณ์ที่เลือกอยู่ในมือ (ตะเกียงอยู่มืออีกข้าง) + เศษกระเด็นตอนกระทบ
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
const ANIMAL_SHADOW = { chicken: [7, 3, 7], duck: [7, 3, 7], sheep: [13, 4, 10], cow: [15, 5, 11], pig: [12, 4, 9], alpaca: [13, 4, 10], horse: [16, 5, 12], boar: [12, 4, 9], turkey: [11, 4, 10], goat: [13, 4, 10]};
const ANIMAL_STEP = { chicken: 5, duck: 4.5, pig: 4, sheep: 3.5, cow: 3, alpaca: 3.5, horse: 3.5, boar: 4, turkey: 4.5, goat: 3.5}; // เฟรมเดินต่อวินาที (ตัวใหญ่ก้าวช้ากว่า)
function drawAnimalPx(type, c, now, top, prodE) {
  const x = c.x, y = c.y, moving = !!c.moving, sh = ANIMAL_SHADOW[type] || ANIMAL_SHADOW.pig; // กันสัตว์ชนิดใหม่ที่ลืมใส่เงา (เคยทำให้วาดล้มทั้งเฟรม)
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
function drawAlpaca(c, now) { drawAnimalPx('alpaca', c, now, 22, '🧵'); }
function drawHorse(c, now) { drawAnimalPx('horse', c, now, 20, '🍼'); }
function drawBoar(c, now) { drawAnimalPx('boar', c, now, 18, '🌰'); }
function drawTurkey(c, now) { drawAnimalPx('turkey', c, now, 26, '🪺'); }
function drawGoat(c, now) { drawAnimalPx('goat', c, now, 28, '🧉'); }
const ANIMAL_DRAW = { duck: drawDuck, sheep: drawSheep, bee: drawBee, alpaca: drawAlpaca, horse: drawHorse, boar: drawBoar, turkey: drawTurkey, goat: drawGoat }, ANIMAL_TOP = { chicken: 14, duck: 14, pig: 18, cow: 20, sheep: 20, bee: 9, alpaca: 20, horse: 20, boar: 18, turkey: 22, goat: 24 };
function animalFx(c, now, top) { // หัวใจลอยตอนเพิ่งได้กินอาหาร / ความสุขเล็กๆ ตอนอิ่มดี / ประกายตอนมีผลผลิตพร้อมเก็บ
  const h = c.h === undefined ? 100 : c.h, t = now / 1000, ph = (t + (c.id || 0) * 3.7) % 9;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (c.happyAt && now - c.happyAt < 1800) { const k = (now - c.happyAt) / 1800; ctx.globalAlpha = 1 - k; for (let i = 0; i < 3; i++) PixelUI.world(ctx, '💗', c.x + (i - 1) * 9, c.y - top - k * 26 - i * 4 - 3, 11); ctx.globalAlpha = 1; }
  else if (!c.sick && h >= 80 && !c.prod && ph < 1.3) { const k = ph / 1.3; ctx.globalAlpha = 1 - k; PixelUI.world(ctx, '💕', c.x + Math.sin(t * 3) * 3, c.y - top - k * 14 - 3, 10); ctx.globalAlpha = 1; }
  if (c.prod) { const a = t * 2 + (c.id || 0); PixelUI.world(ctx, '✨', c.x + Math.cos(a) * 13, c.y - top * 0.5 + Math.sin(a) * 5, 11); }
  if (c.prod && c.lock && me && c.fn !== me.name) { // ผลผลิตของคนอื่น ยังเก็บไม่ได้ (เหมือนผัก): 🔒 + ชื่อคนเลี้ยง
    PixelUI.world(ctx, '🔒', c.x + 12, c.y - top - 6, 11);
    ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = '#3d2a1a'; ctx.strokeText(c.fn, c.x, c.y + 18); ctx.fillStyle = '#ffe9a8'; ctx.fillText(c.fn, c.x, c.y + 18);
  } else if (c.on && (!me || c.on !== me.name)) { // สัตว์ของคนอื่น: แสดงชื่อเจ้าของใต้ตัว
    ctx.font = `bold 8px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.strokeStyle = '#2a2218'; ctx.strokeText(c.on, c.x, c.y + 16); ctx.fillStyle = '#d8c8a8'; ctx.fillText(c.on, c.x, c.y + 16);
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
function drawPet(q, now, ctx = mainCtx) { // แมว (นั่งเมื่อหยุด) และหมา 2 สี (ยืนกระดิกหางเมื่อหยุด)
  const type = q.kind === 'dog' ? 'dog' + (q.v || 0) : 'cat', cat = q.kind !== 'dog', idle = !q.moving;
  ctx.fillStyle = 'rgba(38,40,16,.3)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + (cat ? 6 : 7), cat ? 4 : 6, cat ? 1.6 : 2, 0, 0, 7); ctx.fill();
  const ph = Math.sin(q.anim * (cat ? 9 : 11)), wag = Math.floor(now / (cat ? 700 : 220)) % 2;
  PixelUI.animal(ctx, type, q, { f: q.dx || 1, step: idle ? wag : (ph > 0 ? 1 : 0), blink: blinkOf(q, now), idle });
}
const PET_TOP = { dog: 14, cat: 12, bird: 20, monkey: 18, capy: 14 }; // ความสูงจากพื้นถึงหัว ใช้วางชื่อ/อีโมจิ
function drawCompanionBody(q, now, ctx = mainCtx) { // ตัวสัตว์อย่างเดียว (ไม่มีชื่อ/อีโมจิ) คืนระยะที่ตัวลอยจากพื้น (ติดลบ = ลอยขึ้น) ไว้วางของประดับ
  let dy = 0;
  if (q.kind === 'bird') {
    const fly = q.moving, hop = fly ? Math.abs(Math.sin(q.anim * 14)) * 3 : Math.max(0, Math.sin(now / 900 + q.id) * 2 - 1.2), by = q.y - 4 - (fly ? 7 : 0) - hop, f = q.dx || 1; dy = by - q.y;
    if (!q.boat) { ctx.fillStyle = 'rgba(38,40,16,.3)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + 6, 4, 1.4, 0, 0, 7); ctx.fill(); }
    const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(q.x + x * f - (f < 0 ? w : 0)), Math.round(by + y), w, h); };
    R(PixelArt.OUT, -5, -5, 10, 9); R(PixelArt.OUT, 3, -8, 6, 6);                        // ขอบ 1 px
    R('#4aa8e8', -4, -4, 8, 7); R('#8fd0ff', -3, -3, 5, 3); R('#f4efe0', -3, 1, 6, 2);   // ตัวสีฟ้า ท้องขาว
    R('#4aa8e8', 4, -7, 4, 4); R('#8fd0ff', 4, -7, 2, 2); R('#1b1d33', 6, -6, 1, 1);      // หัว + ตา
    R('#f2a33a', 8, -5, 2, 2);                                                           // จะงอยปาก
    R('#2f7fb8', -7, -2, 3, 2);                                                          // หาง
    R('#2f7fb8', -2, fly ? -6 - Math.round(Math.sin(q.anim * 28) * 2) : -2, 4, 2);       // ปีก (กระพือเมื่อบิน)
    if (!fly) { R('#f2a33a', -1, 4, 1, 2); R('#f2a33a', 1, 4, 1, 2); }
  } else if (q.kind === 'monkey' || q.kind === 'capy') {
    const f = q.dx || 1, walk = q.moving, ph = Math.sin(q.anim * 12), bob = walk ? Math.abs(ph) * 1.5 : 0, y0 = q.y - bob, O = PixelArt.OUT; dy = -bob;
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
    drawPet(q, now, ctx);
  }
  return dy;
}
// ---- สัตว์เลี้ยงตามระดับ 1–5: วาดลงแคนวาสแยก 1× แล้วขยายแบบไม่เบลอ ยึดที่เท้า + ของประดับ (L2 ปลอกคอ L3 ผ้าพันคอ L4 กระดิ่ง L5 มงกุฎดอกไม้+ประกาย สะสมขึ้นไป) ----
const PETLV_W = 96, PETLV_H = 80, PETLV_FX = 48, PETLV_FY = 64;
let petLvCv = null;
const PET_NECK = { dog: [5, -5, 9, -11], cat: [4, -6, 6, -14], catIdle: [-2, -6, -2, -14], bird: [4, -2, 6, -7], monkey: [3, -5, 6, -14], capy: [8, -2, 12, -10] }; // [คอ x, คอ y, ยอดหัว x, ยอดหัว y] เทียบเท้า ทิศหน้า = +x
function petLvScale(q) { const P = Shared.PETLV, lv = Math.max(1, Math.min(P.scale.length, q.lv | 0 || 1)), s = P.scale[lv - 1]; return q.boat ? Math.min(s, P.seaMax) : s; }
function drawPetGear(g, q, now, lv, dy) { // ของประดับลงแคนวาสแยก (1×) ที่ตำแหน่งหัว/คอของสัตว์แต่ละชนิด
  const key = q.kind === 'cat' && !q.moving ? 'catIdle' : q.kind, A = PET_NECK[key] || PET_NECK.dog, f = q.dx || 1, fx = Math.round(q.x), fy = Math.round(q.y), oy = Math.round(dy);
  const R = (c, x, y, w, h) => { x = Math.round(x); g.fillStyle = c; g.fillRect(fx + x * f - (f < 0 ? w : 0), fy + oy + y, w, h); };
  const nx = A[0], ny = A[1], hx = A[2], hy = A[3];
  if (lv === 2) { R('#b8322e', nx - 2, ny, 5, 2); R('#e0524a', nx - 2, ny, 5, 1); } // ปลอกคอแดง
  if (lv >= 3) { R('#2f6fb0', nx - 3, ny - 1, 6, 3); R('#5aa0e0', nx - 3, ny - 1, 6, 1); R('#2f6fb0', nx - 3, ny + 2, 2, 3); R('#1f4f86', nx - 3, ny + 4, 2, 1); } // ผ้าพันคอฟ้า มีชายห้อย
  if (lv >= 4) { R('#8a5a14', nx, ny + 2, 3, 3); R('#f2c94c', nx, ny + 2, 2, 2); R('#fff3a8', nx, ny + 2, 1, 1); } // กระดิ่งทอง
  if (lv >= 5) { // มงกุฎดอกไม้ + ประกายเบาๆ (เปลี่ยนตำแหน่ง 4 ครั้ง/วินาที)
    const cy = hy - 1, cols = ['#ff8fc7', '#fff3a8', '#b99cff', '#ff8fc7', '#fff3a8'];
    R('#3f9a3a', hx - 3, cy + 1, 7, 1);
    for (let i = 0; i < 5; i++) R(cols[i], hx - 3 + i * 1.5, cy - (i % 2), 2, 2);
    const k = Math.floor(now / 250);
    for (let i = 0; i < 2; i++) { const sx = ((k * 7 + i * 5) % 11) - 5, sy = -((k * 3 + i * 4) % 9) - 2; R('#fffbe0', hx + sx, hy + sy, 1, 1); if ((k + i) % 2) { R('#fffbe0', hx + sx - 1, hy + sy, 1, 1); R('#fffbe0', hx + sx + 1, hy + sy, 1, 1); } }
  }
}
function drawCompanion(q, now, ctx = mainCtx, noCull = false) { // สัตว์เลี้ยงคู่ใจ: หมา/แมวใช้ภาพเดียวกับสัตว์ประกอบฉาก นกวาดเองตัวเล็กๆ บินต่ำเกาะตามหลังเจ้าของ
  if (!noCull && (q.x < camX - 40 || q.x > camX + vw + 40 || q.y < camY - 40 || q.y > camY + vh + 40)) return;
  const lv = Math.max(1, Math.min(5, q.lv | 0 || 1)), sc = lv > 1 ? petLvScale(q) : 1;
  let top = PET_TOP[q.kind] || 12;
  if (lv > 1) {
    if (!petLvCv) { petLvCv = document.createElement('canvas'); petLvCv.width = PETLV_W; petLvCv.height = PETLV_H; }
    const g = petLvCv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, PETLV_W, PETLV_H); g.imageSmoothingEnabled = false;
    g.translate(PETLV_FX - Math.round(q.x), PETLV_FY - Math.round(q.y));
    const dy = drawCompanionBody(q, now, g); drawPetGear(g, q, now, lv, dy);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(petLvCv, Math.round(q.x - PETLV_FX * sc), Math.round(q.y - PETLV_FY * sc), Math.round(PETLV_W * sc), Math.round(PETLV_H * sc));
    top = top * sc + (lv >= 5 ? 3 : 0);
  } else drawCompanionBody(q, now, ctx);
  if (q.name) { ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; const ny = q.y - top, nw = Math.ceil(ctx.measureText(q.name).width) + 6; ctx.fillStyle = 'rgba(42,27,20,.75)'; ctx.fillRect(Math.round(q.x - nw / 2), ny - 10, nw, 11); ctx.fillStyle = '#fff3d6'; ctx.fillText(q.name, q.x, ny - 1); }
  if (q.sick) PixelUI.world(ctx, '🤒', q.x, q.y - top - 4 + Math.sin(now / 200), 13);
  else if (q.sayAt && now - q.sayAt < 1800) { const t = (now - q.sayAt) / 1800; PixelUI.world(ctx, '💕', q.x + 6, q.y - top - 2 - t * 12, 11); }
}
function petSheet() { // ชีตตัวอย่างสัตว์เลี้ยง แถว = ชนิด (หมา 2 สี แมว นก ลิง คาปิบารา) คอลัมน์ = ระดับ 1–5 (ดีบัก: __mw.petSheet())
  const kinds = [['dog', 0], ['dog', 1], ['cat', 0], ['bird', 0], ['monkey', 0], ['capy', 0]], cw = 110, ch = 100, c = document.createElement('canvas'); c.width = cw * 5; c.height = ch * kinds.length;
  const g = c.getContext('2d');
  kinds.forEach(([kind, v], r) => { for (let lv = 1; lv <= 5; lv++) { g.fillStyle = (r + lv) & 1 ? '#7fb452' : '#8bbf5a'; g.fillRect((lv - 1) * cw, r * ch, cw, ch);
    drawCompanion({ id: 1, kind, v, x: (lv - 1) * cw + 55, y: r * ch + 80, dx: 1, anim: 0, moving: false, lv, name: 'L' + lv }, 1000, g, true); } });
  return c;
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
// ผีเสื้อ/แมลงเบาๆ กระจายหลายโซน (ลานกลาง คอก แปลง ย่านบ้าน) ไม่รกตา
const BFLY = [
  ...Array.from({ length: 6 }, (_, i) => ({ cx: 47 + (i * 7) % 13, cy: 10 + (i * 5) % 15, ph: i * 1.7, col: ['#ff8fc7', '#ffd24a', '#8fd0ff', '#c79bff'][i % 4] })),
  ...Array.from({ length: 4 }, (_, i) => ({ cx: 22 + (i * 5) % 12, cy: 26 + (i * 3) % 8, ph: i * 2.1 + 3, col: ['#ffd24a', '#ff8fc7', '#9fd4ff', '#ffe37a'][i % 4] })),
  ...Array.from({ length: 3 }, (_, i) => ({ cx: 8 + (i * 6) % 14, cy: 18 + (i * 4) % 10, ph: i * 1.4 + 7, col: ['#8fd0ff', '#ffc9de', '#ffd24a'][i % 3] })),
];
function drawButterflies(now) {
  for (const b of BFLY) {
    const t = now / 1000 + b.ph, bx = (b.cx + Math.sin(t * 0.7) * 3.2) * TS, by = (b.cy + Math.sin(t * 0.9 + 1) * 2.2) * TS - 10 + Math.sin(t * 5) * 2;
    if (bx < camX - 20 || bx > camX + vw + 20 || by < camY - 20 || by > camY + vh + 20) continue;
    const w = Math.abs(Math.sin(t * 14)) * 4 + 1; ctx.fillStyle = b.col; ctx.beginPath(); ctx.ellipse(bx - 2, by, w, 3, -0.3, 0, 7); ctx.ellipse(bx + 2, by, w, 3, 0.3, 0, 7); ctx.fill(); ctx.fillStyle = '#4a3a2a'; ctx.fillRect(bx - 0.6, by - 2, 1.2, 4);
  }
}
// จุดละอองแดดอุ่นลอยเบาๆ (กลางวันเท่านั้น วาดหลังพื้น ก่อนตัวละคร)
function drawSunMotes(now, dark) {
  if (dark > 0.15) return;
  const n = 18;
  for (let i = 0; i < n; i++) {
    const ph = i * 2.17, t = now / 7000 + ph;
    const bx = ((Math.sin(t * 0.9 + i) * 0.5 + 0.5) * W) * TS, by = ((Math.cos(t * 0.7 + i * 1.3) * 0.5 + 0.5) * H) * TS;
    if (bx < camX - 8 || bx > camX + vw + 8 || by < camY - 8 || by > camY + vh + 8) continue;
    const a = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(now / 900 + ph));
    ctx.fillStyle = `rgba(255,236,160,${a})`; ctx.fillRect(Math.round(bx), Math.round(by), 2, 2);
  }
}
// รหัสพืชในเกม → รหัสในชุดภาพ pixelcrops.js (พืช legacy ไม่มีในชุด ใช้ภาพเดิม)
const CROP_KIT = { carrot: 'carrot', cabbage: 'cabbage', corn: 'corn', tomato: 'tomato', eggplant: 'eggplant', strawberry: 'strawberry', pumpkin: 'pumpkin', grape: 'grape', pineapple: 'pineapple', melon: 'watermelon', mango: 'mango', peach: 'peach', kiwi: 'kiwi', coconut: 'coconut', avocado: 'avocado', blueberry: 'blueberry', beans: 'cacao', mushroom: 'truffle', sunflower: 'golden_sunflower', tulip: 'golden_tulip' };
function drawCrop(tile, px, py, now, pass) { // pass 0 = ดินทุกช่องก่อน • pass 1 = ต้นเรียงจากแถวบนลงล่าง (ต้นโตใหญ่เกินช่องได้ ไม่โดนดินช่องข้างๆ ทับ)
  if (!pass) { ctx.drawImage(PixelArt.soil(tile.w), px, py, TS, TS); return; }
  if (!tile.c) return;
  const cx = px + 16, cy = py + 27, s = tile.s, kit = CROP_KIT[tile.c], f = tile.f == null ? Math.min(6, s * 2) : tile.f;
  ctx.imageSmoothingEnabled = false;
  if (f === 0 && kit) { // เพาะปลูก: โรยเมล็ดเป็นเม็ดๆ กระจายบนดิน (ตำแหน่งคงที่ตามช่อง)
    const sd = [[7, 14], [14, 19], [21, 13], [11, 24], [19, 23], [25, 19], [16, 15]];
    for (let i = 0; i < sd.length; i++) { const x = px + sd[i][0] + (px * 7 + i * 3) % 3 - 1, y = py + sd[i][1] + (py * 5 + i) % 3 - 1; ctx.fillStyle = '#4a3322'; ctx.fillRect(x - 1, y, 4, 3); ctx.fillStyle = '#e8cf8e'; ctx.fillRect(x, y, 3, 2); ctx.fillStyle = '#fff3c4'; ctx.fillRect(x, y, 1, 1); }
  } else if (kit && typeof PixelCrops !== 'undefined') { // ชุดภาพโตทีละระยะ 8 เฟรม (48×64 โคนต้นอยู่ที่ 24,60) วาดขนาดจริง 48×64 ใหญ่เกินช่อง 32px ให้เห็นต้นโตชัด
    const sp = PixelCrops.get(kit, f);
    ctx.drawImage(sp, cx - 24, cy + 2 - 60, 48, 64);
  } else {
    const sp = PixelUI.crop(s);
    ctx.drawImage(sp, cx - sp.width, cy - sp.height * 2, sp.width * 2, sp.height * 2);
  }
  if (tile.os) PixelUI.world(ctx, '🍂', px + 7, py + 25, 10); // ต้นนอกฤดู: ใบไม้ร่วงเล็กๆ ที่โคนต้น (อาจไม่ติดผล)
  if (s >= 3) {
    PixelUI.world(ctx, CROPS[tile.c].emoji, px + 8, py + 8 + Math.sin(now / 400 + px) * 1, 11); // ไอคอนผลผลิตเล็กๆ มุมช่อง ไม่บังต้น
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
const lightMask = { key: '', cv: null, x: 0, y: 0 };
function houseLightMask() { // ภาพรูแสงของโคมในบ้าน (พิกัดไอโซเมตริก) สร้างใหม่เฉพาะตอนโคมเปลี่ยนที่/จำนวน
  const lamps = []; for (const o of furn.values()) if (FURN[o.f].light) lamps.push(o.x + ',' + o.y + ',' + (o.z || 0)); lamps.sort();
  const key = lamps.join(';'); if (key === lightMask.key) return lightMask.cv ? lightMask : null;
  lightMask.key = key; lightMask.cv = null; if (!lamps.length) return null;
  const R = TS * 3.2, x = ISO_B.x0 - R, y = ISO_B.y0 - R, c = document.createElement('canvas'); c.width = Math.ceil(ISO_B.w + R * 2); c.height = Math.ceil(ISO_B.h + R * 2);
  const g = c.getContext('2d'); g.translate(-x, -y);
  for (const o of furn.values()) if (FURN[o.f].light) { const [hx, hy] = iso(o.x * TS, o.y * TS, (o.z || 0) + 22), gr = g.createRadialGradient(hx, hy, 0, hx, hy, R); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(hx, hy, R, 0, 7); g.fill(); }
  lightMask.cv = c; lightMask.x = x; lightMask.y = y; return lightMask;
}
let nightKey = '';
function drawNightHouse(dark, now) { // ชั้นมืดในบ้าน: ทุกอย่างนิ่งตามกล้อง/โคม/ไฟผู้เล่น จึงแคชไว้ แล้วสร้างใหม่เฉพาะตอนข้อใดข้อหนึ่งเปลี่ยน (เดิมล้างเทสีและเจาะรูทั้งจอทุกเฟรม)
  if (dark <= 0.02) return;
  if (lightCv.width !== canvas.width || lightCv.height !== canvas.height) { lightCv.width = canvas.width; lightCv.height = canvas.height; nightKey = ''; }
  const m = houseLightMask(), qd = Math.round(dark * 60) / 60, lamps = [];
  for (const p of players.values()) if (p.lamp) lamps.push([p.x - p.y, (p.x + p.y) / 2 - 4]); // จุดบนจอไอโซเมตริกของหมวก/ตะเกียงผู้เล่น
  const key = [qd, canvas.width, canvas.height, zoom, camX, camY, m ? m.key : '', lamps.map(l => l[0].toFixed(1) + ',' + l[1].toFixed(1)).join(';')].join('|');
  if (key !== nightKey) {
    nightKey = key;
    lctx.globalCompositeOperation = 'source-over'; lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, lightCv.width, lightCv.height);
    lctx.fillStyle = `rgba(5,9,32,${qd})`; lctx.fillRect(0, 0, lightCv.width, lightCv.height);
    lctx.globalCompositeOperation = 'destination-out'; lctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
    if (m) lctx.drawImage(m.cv, m.x, m.y); // รูแสงของโคมในบ้าน (ภาพแคช)
    for (const [x, y] of lamps) { const g = lctx.createRadialGradient(x, y, 0, x, y, TS * 5); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.82, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.beginPath(); lctx.arc(x, y, TS * 5, 0, 7); lctx.fill(); }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lightCv, 0, 0);
  if (lamps.length) { // แสงอุ่นสีส้มรอบไฟผู้เล่น
    ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom); ctx.globalCompositeOperation = 'lighter';
    for (const [x, y] of lamps) { const g = ctx.createRadialGradient(x, y, 0, x, y, TS * 5); g.addColorStop(0, `rgba(255,150,50,${0.16 * Math.min(1, dark * 1.2)})`); g.addColorStop(1, 'rgba(255,150,50,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, TS * 5, 0, 7); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
function drawNight(dark, now) {
  if (scene && !cave) return drawNightHouse(dark, now);
  if (dark <= 0.02) return;
  if (lightCv.width !== canvas.width || lightCv.height !== canvas.height) { lightCv.width = canvas.width; lightCv.height = canvas.height; }
  lctx.globalCompositeOperation = 'source-over'; lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, lightCv.width, lightCv.height);
  lctx.fillStyle = `rgba(${winterFlag ? WINTER.nightRGB : '5,9,32'},${dark})`; lctx.fillRect(0, 0, lightCv.width, lightCv.height);
  lctx.globalCompositeOperation = 'destination-out'; lctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
  const hole = (x, y, r, inner) => { const g = lctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(inner, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.beginPath(); lctx.arc(x, y, r, 0, 7); lctx.fill(); };
  const fx = FIRE.x * TS + 16, fy = FIRE.y * TS + 12, fr = TS * 10.5 * (1 + Math.sin(now / 130) * 0.02 + Math.sin(now / 71) * 0.015);
  if (inTown()) hole(fx, fy, fr, 0.3);
  const [hl, hy] = caveLamp; if (inTown()) hole(hl, hy, TS * 2, 0.35); // ตะเกียงหน้าถ้ำเหมือง
  const LH = inTown() && builtProj.has('lighthouse') && Shared.LIGHTHOUSE, lx = LH ? (LH.x0 + (LH.x1 - LH.x0 + 1) / 2) * TS : 0, ly = LH ? LH.y0 * TS + 39 : 0, lAng = now / 1800; // ประภาคาร: ห้องตะเกียงอยู่ใกล้ยอดหอ ลำแสงหมุนรอบ ~11 วินาที
  const beam = (r, half, ang, a0) => { const g = lctx.createRadialGradient(lx, ly, 0, lx, ly, r); g.addColorStop(0, `rgba(0,0,0,${a0})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.beginPath(); lctx.moveTo(lx, ly); lctx.arc(lx, ly, r, ang - half, ang + half); lctx.closePath(); lctx.fill(); };
  if (LH) { hole(lx, ly, TS * 7 * (1 + Math.sin(now / 400) * 0.02), 0.25); beam(TS * 18, 0.2, lAng, 0.95); beam(TS * 18, 0.2, lAng + Math.PI, 0.95); }
  const pj = (x, y, z = 0) => (scene ? [x - y, (x + y) / 2 - z] : [x, y]); // ในบ้านวาดแบบไอโซเมตริก ฉายตำแหน่งแสงด้วย
  for (const p of players.values()) if (p.lamp) hole(...pj(p.x, p.y, 4), TS * 5, 0.82);
  if (cave && !inSea()) { // ในถ้ำ: ทุกคนมีแสงรอบตัวเล็กน้อย หมวกนักขุดสว่างกว่า (ไม่มีไฟ = เห็นแคบ) และแร่มีค่าเรืองแสงจางๆ
    for (const p of players.values()) hole(p.x, p.y, TS * (p.wear && p.wear.hat === 'miner' ? 6 : 4.2), 0.5);
    for (const [x, y] of caveTorches) hole(x, y, TS * 4 * (1 + Math.sin(now / 110 + x) * 0.03), 0.3); // คบเพลิงบนผนัง
    for (const [k, id] of oreK) if (Shared.ORES[id].lv >= 5) { const [ox, oy] = k.split(',').map(Number); hole((ox + 0.5) * TS, (oy + 0.5) * TS, TS * 1.6, 0.3); }
  }
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
  if (cave) for (const [x, y] of caveTorches) { warm(x, y, TS * 3.2, 0.22 + Math.sin(now / 90 + y) * 0.03); ctx.fillStyle = 'rgba(255,190,90,.55)'; ctx.fillRect(x - 3, y - 6 - (Math.sin(now / 80 + x) > 0 ? 2 : 0), 6, 6); } // แสงอุ่น + ไฟวูบ
  if (inTown()) { warm(fx, fy, fr * 0.8, 0.28 * Math.min(1, dark * 1.2)); warm(hl, hy, TS * 1.8, 0.25 * Math.min(1, dark * 1.2)); } for (const p of players.values()) if (p.lamp) warm(...pj(p.x, p.y, 4), TS * 5, 0.16 * Math.min(1, dark * 1.2));
  ctx.globalCompositeOperation = 'source-over'; ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------- Mini map (ย่อ/ขยาย/ซ่อนได้ ทั้ง PC และมือถือ) ----------
let miniBase = makeMiniBase();
function makeMiniBase() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const col = { [T.GRASS]: '#7bc65a', [T.WATER]: '#4aa3df', [T.TREE]: '#3f9a3a', [T.BUILD]: '#c9a86a', [T.PATH]: '#dcbf82', [T.FENCE]: '#8b5a2b', [T.SAND]: '#efdfa4', [T.SHOP]: '#a0692f', [T.FLOOR]: '#c99a5b', [T.FURN]: '#c99a5b', [T.BRIDGE]: '#a8703a', [T.LANDMARK]: '#b0453a', [T.WALL]: '#8b5a2b', [T.VOID]: '#17110d', [T.CLIFF]: '#7a6a58', [T.STAIR]: '#d2b07a' };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { g.fillStyle = (MAP[y][x] === T.GRASS && inFarm(x, y)) ? '#8bbf5a' : col[MAP[y][x]]; g.fillRect(x, y, 1, 1); }
  if (inTown()) for (const b of BUILDINGS) { g.fillStyle = b.roof; g.fillRect(b.x0, b.y0, b.x1 - b.x0 + 1, 1); }
  return c;
}
function layoutHud() { // แผนที่อยู่มุมบนขวาสุด แถบปุ่มด้านบนเว้นที่ให้ ไม่ทับกัน • คู่มือ/แชทอยู่ใต้แถบปุ่ม
  const mw = $('mini').classList.contains('hidden') ? 0 : $('mini').offsetWidth;
  $('hudTop').style.right = `calc(${mw ? mw + 24 : 8}px + var(--sar, 0px))`;
  const top = Math.round($('hudTop').getBoundingClientRect().bottom + 6);
  $('guide').style.top = top + 'px';
  if (isTouch) {
    // มือถือ: ป้ายคำแนะนำ/แชตอยู่ใต้แถบปุ่ม จำกัดความกว้างไม่ให้ทับแผนที่ย่อ และแชตเลื่อนลงใต้ป้ายคำแนะนำ
    const mr = $('mini').getBoundingClientRect(), hit = mw && mr.bottom > top, avail = Math.floor(mr.left - 16);
    $('guide').style.maxWidth = hit && avail > 80 ? avail + 'px' : '';
    const gEl = $('guide'), gb = gEl.classList.contains('hidden') ? 0 : gEl.getBoundingClientRect().bottom;
    $('chat').style.top = (gb > top ? Math.round(gb + 4) : top) + 'px';
    $('chat').style.width = hit && avail > 80 ? Math.min(avail, 320) + 'px' : '';
    { const jy = $('joy').getBoundingClientRect(), ct = parseFloat($('chat').style.top) || top, lg = $('chatLog'), room = jy.height && jy.top > ct + 60 ? Math.floor(jy.top - ct - 8 - ($('chatHist').offsetHeight || 0) - ($('chatIn').offsetHeight || 0)) : 0; lg.style.maxHeight = room > 0 ? Math.max(40, room) + 'px' : ''; lg.style.overflow = room > 0 ? 'hidden' : ''; lg.style.display = room > 0 ? 'flex' : ''; lg.style.flexDirection = 'column'; lg.style.justifyContent = 'flex-end'; } // ข้อความแชตไม่ล้นไปทับจอยสติ๊ก (จอเตี้ย 360x640) ตัดข้อความเก่าสุดก่อน ช่องพิมพ์ไม่โดนตัด
  }
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
const bldDoor = k => { const b = BUILDINGS.find(q => q.kind === k); return b && b.counter[0] ? [b.counter[0][0], b.counter[0][1] + 1] : null; }; // หน้าประตูร้านชนิด k (ตามผังจริง)
const treeNear = { at: 0, p: null };
function nearestTree() { // ต้นไม้ที่ตัดได้ใกล้ตัวที่สุด (คำนวณใหม่ทุก 0.5 วินาที)
  const t = performance.now(); if (t - treeNear.at < 500) return treeNear.p; treeNear.at = t;
  const mx = Math.floor(me.x / TS), my = Math.floor(me.y / TS); let best = null, bd = Infinity;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (isChoppable(MAP, x, y)) { const d = (x - mx) * (x - mx) + (y - my) * (y - my); if (d < bd) { bd = d; best = [x, y]; } }
  return treeNear.p = best;
}
function guideGo(g) { // จุดหมายของลูกศร (ช่อง x,y): บท 1 ตามตาราง • บท 2 ชี้ร้านก่อน ถ้ามีของแล้วค่อยชี้ที่ทำงาน
  if (g.ch === 1) return STARTER_GO[g.s.id];
  switch (g.s.id) {
    case 'chop': return Shared.axeTier(inv) > 0 ? nearestTree() : bldDoor('wood');
    case 'mine': return Shared.pickTier(inv) > 0 ? [Shared.MINE.door[0], Shared.MINE.y] : bldDoor('mine');
    case 'feed': return inv.feed > 0 ? Shared.PENS.chicken.gate[0] : bldDoor('animal');
    case 'collect': return Shared.PENS.chicken.gate[0];
    case 'cook': return bldDoor('food');
  }
  return null;
}
function drawGuideArrow(now) { // ลูกศรนำทางไปข้อถัดไปของคู่มือ บท 1/2 (หายเมื่อเดินถึงที่หมายแล้ว)
  const g = guideNext(), go = g && guideGo(g);
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
let arcNear = false;
function drawMini(now) {
  if (miniState === 'off' || now - lastMini < 90) return;
  lastMini = now;
  if (isTouch) { // มือถือแนวตั้ง: อยู่แถวตู้เกมในเมือง = ซ่อนแผนที่ย่อชั่วคราว (CSS ซ่อนเฉพาะแนวตั้ง) ไม่ให้บังตู้แถวบน • ไม่ซ่อนถ้าผู้เล่นเปิดแผนที่ใหญ่เอง และคืนแผนที่เมื่อเข้าบ้าน/ถ้ำ
    const [mx, my] = me ? myTile() : [0, 0], near = !!me && inTown() && miniState !== 'big' && CABINETS.some(c => Math.abs(c.x - mx) <= 7 && Math.abs(c.y - my) <= 7);
    if (near !== arcNear) { arcNear = near; document.body.classList.toggle('arc-near', near); layoutHud(); }
  }
  const cv = $('miniMap'), g = cv.getContext('2d'), cw = cv.width, ch = cv.height, sx = cw / W, sy = ch / H, k = cw / parseFloat(cv.style.width), big = miniState === 'big';
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false; g.drawImage(miniBase, 0, 0, cw, ch);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${Math.round((big ? 15 : 11) * k)}px sans-serif`;
  if (inTown()) for (const b of BUILDINGS) g.fillText(b.sign, (b.x0 + b.x1 + 1) / 2 * sx, (b.y0 + b.y1 + 1) / 2 * sy + 2 * k);
  if (inTown()) { g.fillText('🏠', (Shared.HOUSE_DOOR.x + 0.5) * sx, (Shared.HOUSE_BLD.y0 + 1.5) * sy); g.fillText('🌾', 10.5 * sx, 15.5 * sy); g.fillText('🐄', 54 * sx, 21 * sy); g.fillText('🌊', 43 * sx, 38 * sy); g.fillText('🐖', 59.5 * sx, 11.5 * sy); g.fillText('🔥', FIRE.x * sx + sx / 2, FIRE.y * sy + sy / 2); }
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 1.5 * k; g.strokeRect(camX / TS * sx, camY / TS * sy, vw / TS * sx, vh / TS * sy);
  const list = [...players.values()].sort((a, b) => (a === me) - (b === me));
  g.font = `bold ${Math.round((big ? 11 : 9) * k)}px ${FONT}`;
  for (const p of list) {
    const x = p.x / TS * sx, y = p.y / TS * sy, r = (p.id === myId ? 5 : 4) * k;
    if (p.id === myId) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2 * k; g.beginPath(); g.arc(x, y, r + 3 * k + Math.sin(now / 200) * 1.5 * k, 0, 7); g.stroke(); }
    g.fillStyle = p.color; g.strokeStyle = '#fff'; g.lineWidth = 1.8 * k; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
    g.lineWidth = 3 * k; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(p.name, x, y - r - 5 * k);
    g.fillStyle = p.id === myId ? '#ffe680' : '#fff'; g.fillText(p.name, x, y - r - 5 * k);
  }
}

// ---------- main loop ----------
let last = performance.now();
// ประภาคารกลางน้ำ: วาดเป็นชั้นบนสุดของโลก (ทับปลา ใบบัว และประกายน้ำ) • ฐานเป็นเกาะทราย
function drawLighthouse(g, now) {
  if (!builtProj.has('lighthouse')) return;
  const L = Shared.LIGHTHOUSE, bx = L.x0 * TS, by = L.y0 * TS, w = (L.x1 - L.x0 + 1) * TS, h = (L.y1 - L.y0 + 1) * TS, cx = bx + w / 2;
  const LHS = PixelArt.lighthouse(), sx = Math.round(cx - LHS.cx * 2), sy = Math.round(by + 39 - LHS.lampY * 2); // ตะเกียงอยู่ที่ by+39 ตรงกับจุดกำเนิดลำแสงตอนกลางคืน
  g.imageSmoothingEnabled = false; g.drawImage(LHS.spr, sx, sy, LHS.w * 2, LHS.h * 2);
  { const pulse = 0.5 + 0.5 * Math.sin(now / 420), lx = cx, ly = by + 39; // ตะเกียงกะพริบนุ่มๆ: วงแสงอุ่นบนกระจกห้องตะเกียง (กลางคืนเข้มขึ้นผ่านชั้นความมืดอยู่แล้ว)
    g.fillStyle = `rgba(255,236,150,${0.22 + pulse * 0.2})`; g.fillRect(lx - 10, ly - 10, 20, 14); g.fillStyle = `rgba(255,255,230,${0.3 + pulse * 0.3})`; g.fillRect(lx - 4, ly - 6, 8, 8); }
  g.save(); g.translate(cx + 14, by + 42); g.scale(0.8, 0.8); g.translate(-(cx + 14), -(by + 42)); // นกนางนวลเกาะราวระเบียง
  // นกนางนวลเกาะอยู่บนยอดหอ ขยับตัวเบาๆ (แกว่งหัว กระพือปีกเล็กน้อย) กะพริบตานานๆ
  const gx = cx + 14, bob = Math.sin(now / 700) * 0.5, sway = Math.sin(now / 1300) * 0.6, flap = Math.sin(now / 260) * 0.35;
  const gy = by + 42 + bob, blink = now % 4200 < 130;
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
function poly(g, pts, fill, stroke) {
  g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
}
const pip = (pts, x, y) => { let on = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) on = !on; } return on; };
// เฟอร์นิเจอร์ = ชุด furniture-kit-v2 ใน pixelfurn.js แคชเป็นภาพต่อ ชิ้น|หมุน|เงา (ชิ้นที่ขยับได้วาดใหม่ทุก 150 ms)
const furnPx = new Map();
// ภาพที่ขยับน้อยแบบสลับไม่กี่ท่า (โคมไฟ 2 ท่า หางแมว 7 ท่า) แคชครบทุกท่าไว้เลย ไม่วาดใหม่ทุก 150 ms (วาด+trim ผืน 340×300 แพง บ้านที่มีโคมหลายดวงเลยกระตุก)
const FURN_POSE = { lantern: now => Math.sin(now / 300) > 0 ? 1 : 0, floorlamp: now => Math.sin(now / 300) > 0 ? 1 : 0, cat: now => Math.round(Math.sin(now / 400) * 3) };
const FURN_POSE_T = { lantern: p => (p ? 1 : -1) * 300 * Math.PI / 2, floorlamp: p => (p ? 1 : -1) * 300 * Math.PI / 2, cat: p => Math.asin(p / 3) * 400 };
// ของที่ขยับเป็นวงรอบเวลาคงที่ (น้ำพุ ธง เตาผิง ตู้ปลา): แบ่งรอบเป็น N ท่าแล้วแคชทุกท่า (เดิมวาดใหม่+อ่านพิกเซลตัดขอบทุก 150 ms)
for (const [f, P, N] of [['fountain', 700, 10], ['flag', 1571, 10], ['fireplace', 817, 8], ['aquarium', 4398, 24]]) { FURN_POSE[f] = now => Math.floor(now % P / P * N); FURN_POSE_T[f] = k => k * P / N; }
function furnSprite(f, r, shadow, W, D, now) {
  const pose = FURN_POSE[f], an = PixelFurn.anim(f), key = f + '|' + (r ? 1 : 0) + (shadow ? 's' : '') + W + 'x' + D;
  if (pose) { const p = pose(now), k = key + '|' + p; let c = furnPx.get(k); if (!c) { c = { s: PixelFurn.sprite(f, FURN[f], r, FURN_POSE_T[f](p), shadow, W, D) }; furnPx.set(k, c); } return c.s; }
  const fr = an ? Math.floor(now / 150) : 0;
  let c = furnPx.get(key); if (!c || c.fr !== fr) { c = { fr, s: PixelFurn.sprite(f, FURN[f], r, an ? now : 0, shadow, W, D) }; furnPx.set(key, c); } return c.s;
}
const hits = []; // พื้นที่แตะของแต่ละชิ้นที่วาดในเฟรมนี้ (เรียงตามลำดับวาด ตัวท้ายสุดอยู่หน้าสุด)
function drawFurnIso(g, it, now, alpha, ghost) {
  const d = FURN[it.f], [w, dd] = Shared.furnDims(it.f, it.r), X = it.x * TS, Y = it.y * TS, W = w * TS, D = dd * TS, z = it.z || 0;
  const s = furnSprite(it.f, it.r, !z, W, D, now), [sx, sy] = iso(X, Y, z), sm = g.imageSmoothingEnabled;
  g.save(); if (alpha != null) g.globalAlpha = alpha;
  g.imageSmoothingEnabled = false; g.drawImage(s.cv, Math.round(sx - s.ax), Math.round(sy - s.ay)); g.imageSmoothingEnabled = sm;
  g.restore();
  if (ghost) return;
  if (d.flat) hits.push({ i: it.i, test: (sx, sy) => pip([iso(X - W / 2, Y - D / 2), iso(X + W / 2, Y - D / 2), iso(X + W / 2, Y + D / 2), iso(X - W / 2, Y + D / 2)], sx, sy) });
  else { const [cx, cy] = iso(X, Y, z), hw = (W + D) / 2, h = (d.h || 24) + 4; hits.push({ i: it.i, test: (sx, sy) => sx >= cx - hw && sx <= cx + hw && sy >= cy - hw / 2 - h && sy <= cy + hw / 2 }); }
}
// ของติดผนัง: wl 'n' = ผนังหลังขวา (แนวแกน x) 'w' = ผนังหลังซ้าย (แนวแกน y) u = ตำแหน่งตามแนวผนัง (ช่อง)
const wallPt = (wl, u, z) => (wl === 'n' ? iso(u, FY0, z) : iso(FX0, u, z));
const wallRect = (g, wl, u0, u1, z0, z1, fill, stroke) => poly(g, [wallPt(wl, u0, z0), wallPt(wl, u1, z0), wallPt(wl, u1, z1), wallPt(wl, u0, z1)], fill, stroke);
const wallPx = new Map(); // ของติดผนังพิกเซล แคชต่อ ชิ้น|ผนัง
function drawWallItem(g, it, alpha) {
  const d = FURN[it.f], U = it.u * TS, hw = (d.w || 1) * TS / 2, hh = (d.h || 30) / 2, zc = 60, wl = it.wl;
  const key = it.f + '|' + wl; let s = wallPx.get(key); if (!s) { s = PixelFurn.wall(it.f, d, wl); wallPx.set(key, s); }
  const [sx, sy] = wallPt(wl, U, 0), sm = g.imageSmoothingEnabled; g.save(); if (alpha != null) g.globalAlpha = alpha;
  g.imageSmoothingEnabled = false; g.drawImage(s.cv, Math.round(sx - s.ax), Math.round(sy - s.ay)); g.imageSmoothingEnabled = sm; g.restore();
  const quad = [wallPt(wl, U - hw, zc - hh), wallPt(wl, U + hw, zc - hh), wallPt(wl, U + hw, zc + hh), wallPt(wl, U - hw, zc + hh)];
  if (it.i >= 0 && alpha == null) hits.push({ i: it.i, test: (px, py) => pip(quad, px, py) });
}
function buildHouseIsoBg() { // พื้นไม้ + ผนังหลัง 2 ด้าน + หน้าต่าง + พรมหน้าประตู (วาดครั้งเดียว)
  return PixelFurn.room(g => { // เติมสีทีละพิกเซล ไม่มีขอบเบลอ → เส้นต่อเนื่องคม (pixelfurn.js)
  g.fillStyle = '#17110d'; g.fillRect(ISO_B.x0, ISO_B.y0, ISO_B.w, ISO_B.h);
  const hs = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const FL = Shared.HOUSE_FLOORS[houseSt.fl] || Shared.HOUSE_FLOORS.oak, WP = Shared.HOUSE_WALLS[houseSt.wp] || Shared.HOUSE_WALLS.cream;
  poly(g, [iso(FX0, FY1), iso(FX1, FY1), iso(FX1, FY1, -12), iso(FX0, FY1, -12)], FL.edge[0], INK); // ความหนาแผ่นพื้น
  poly(g, [iso(FX1, FY0), iso(FX1, FY1), iso(FX1, FY1, -12), iso(FX1, FY0, -12)], FL.edge[1], INK);
  if (FL.kind === 'plank') {
    for (let row = 0, y = FY0; y < FY1; row++, y += 16) { // ไม้กระดานเรียงตามแกน x ต่อกันสลับรอยต่อ
      let x = FX0 - Math.floor(hs(row, 7) * 8) * 16; // แผ่นยาว 128 รอยต่อลงตารางทุก 16 px (จุดมุมเป็นจำนวนเต็ม เส้นไม่สะดุด)
      for (let k = 0; x < FX1; k++, x += 128) {
        const xa = Math.max(x, FX0), xb = Math.min(x + 128, FX1); if (xb <= xa) continue;
        const q = [iso(xa, y), iso(xb, y), iso(xb, y + 16), iso(xa, y + 16)];
        poly(g, q, FL.c[Math.floor(hs(row, k) * FL.c.length)]);
        g.strokeStyle = FL.seam; g.lineWidth = 1; g.beginPath(); g.moveTo(...q[0]); g.lineTo(...q[3]); g.lineTo(...q[2]); g.lineTo(...q[1]); g.stroke();
      }
    }
  } else if (FL.kind === 'tile') { // กระเบื้อง 32 px: หมากรุกสลับสี หรือหินสุ่มโทน
    for (let j = 0, y = FY0; y < FY1; j++, y += TS) for (let i = 0, x = FX0; x < FX1; i++, x += TS) {
      const q = [iso(x, y), iso(Math.min(x + TS, FX1), y), iso(Math.min(x + TS, FX1), Math.min(y + TS, FY1)), iso(x, Math.min(y + TS, FY1))];
      poly(g, q, houseSt.fl === 'check' ? FL.c[(i + j) & 1] : FL.c[hs(i, j) > 0.5 ? 1 : 0]);
      g.strokeStyle = FL.seam; g.lineWidth = 1; g.beginPath(); g.moveTo(...q[3]); g.lineTo(...q[0]); g.lineTo(...q[1]); g.stroke();
    }
  } else { // พรมปูทั้งห้อง: ผืนเดียว มีเส้นทอสลับแถบและขอบเย็บ
    poly(g, [iso(FX0, FY0), iso(FX1, FY0), iso(FX1, FY1), iso(FX0, FY1)], FL.c[0]);
    for (let y = FY0, k = 0; y < FY1; y += 8, k++) if (k & 1) poly(g, [iso(FX0, y), iso(FX1, y), iso(FX1, Math.min(y + 8, FY1)), iso(FX0, Math.min(y + 8, FY1))], FL.c[1]);
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(...iso(FX0 + 10, FY0 + 10)); g.lineTo(...iso(FX1 - 10, FY0 + 10)); g.lineTo(...iso(FX1 - 10, FY1 - 10)); g.lineTo(...iso(FX0 + 10, FY1 - 10)); g.closePath(); g.stroke();
  }
  const WH = WALL_H;
  for (const wl of ['n', 'w']) { // ผนัง: วอลเปเปอร์ลายขีด + แผ่นไม้ครึ่งล่าง + ราว + บัวพื้น
    const u0 = wl === 'n' ? FX0 : FY0, u1 = wl === 'n' ? FX1 : FY1;
    wallRect(g, wl, u0, u1, 34, WH, WP.up[0]); if (WP.pat === 'stripe') for (let u = u0; u < u1; u += 24) wallRect(g, wl, u, Math.min(u + 12, u1), 34, WH, WP.up[1]);
    if (WP.pat === 'brick') for (let z = 34, row = 0; z < WH; z += 8, row++) { wallRect(g, wl, u0, u1, z, z + 1, WP.up[1]); for (let u = u0 + (row & 1 ? 12 : 0); u < u1; u += 24) wallRect(g, wl, u, Math.min(u + 2, u1), z, Math.min(z + 8, WH), WP.up[1]); } // อิฐก้อนสลับแถว
    wallRect(g, wl, u0, u1, 0, 34, WP.lo[0]); for (let u = u0 + 8; u < u1; u += 16) wallRect(g, wl, u, u + 2, 4, 33, WP.lo[1]);
    wallRect(g, wl, u0, u1, 34, 38, WP.rail); wallRect(g, wl, u0, u1, 0, 5, WP.skirt);
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
  }, ISO_B.x0, ISO_B.y0, ISO_B.w, ISO_B.h);
}
function buildHouseGrid() { // เส้นตารางจาง ๆ ตอนตกแต่ง (ทุกครึ่งช่อง เส้นหนักทุกช่อง)
  const c = document.createElement('canvas'); c.width = ISO_B.w; c.height = ISO_B.h;
  const g = c.getContext('2d'); g.translate(-ISO_B.x0, -ISO_B.y0); g.lineWidth = 1;
  for (let X = FX0, k = 0; X <= FX1; X += TS / 2, k++) { g.strokeStyle = k % 2 ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.26)'; g.beginPath(); g.moveTo(...iso(X, FY0)); g.lineTo(...iso(X, FY1)); g.stroke(); }
  for (let Y = FY0, k = 0; Y <= FY1; Y += TS / 2, k++) { g.strokeStyle = k % 2 ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.26)'; g.beginPath(); g.moveTo(...iso(FX0, Y)); g.lineTo(...iso(FX1, Y)); g.stroke(); }
  return c;
}
function drawIsoPlayer(p, now, sit) { // ตัวละครเดิมวาดที่พิกัดโลก → เลื่อนไปยังพิกัดไอโซเมตริก (นั่งแล้วยกขึ้นตามที่นั่ง)
  const [sx, sy] = iso(p.x, p.y); let lift = 0, q = p;
  const it = sit; // นั่ง/นอนอยู่บนชิ้นไหน (drawHouseWorld หาให้แล้วรอบเดียวต่อเฟรม): ยกตามความสูงและหันตามแนวชิ้น
  if (it) { lift = FURN[it.f].bed ? 12 : 8; q = Object.assign({}, p, { dir: it.r ? 3 : 0 }, p.lie ? { lieRot: lieAngle(it) } : {}); }
  ctx.save(); ctx.translate(sx - p.x, sy - p.y - 10 - lift); drawPlayer(q, now); ctx.restore();
}
function sitNear(p) { // ชิ้นนั่ง/นอนที่อยู่ใกล้ตัวละคร (จุดนั่งอยู่ห่างกลางชิ้นไม่เกิน 1 ช่อง)
  let best = null, bd = 1.6 * TS;
  for (const it of furn.values()) { const d = FURN[it.f]; if (!(d.seat || d.bed)) continue; const dist = Math.hypot(it.x * TS - p.x, it.y * TS - p.y); if (dist < bd) { bd = dist; best = it; } }
  return best;
}
function lieAngle(it) { // มุมหมุนท่านอน: หัวชี้ขึ้นบนจอเสมอ ตามแนวยาวของเตียง (หมุนตามทิศของชิ้น)
  const [W, D] = Shared.furnDims(it.f, it.r), horiz = W >= D, hx = horiz ? -1 : 0, hy = horiz ? 0 : -1;
  return Math.atan2((hx + hy) / 2, hx - hy) + Math.PI / 2;
}
function drawIsoCompanion(cp, now) { const [sx, sy] = iso(cp.x, cp.y); ctx.save(); ctx.translate(sx - cp.x, sy - cp.y - 6); drawCompanion(cp, now); ctx.restore(); }
function drawHouseWorld(now) {
  ctx.drawImage(houseBg, ISO_B.x0, ISO_B.y0);
  hits.length = 0;
  const its = [...furn.values()], list = [];
  const held = build.on && !isTouch && mouse.active && build.pick != null ? furn.get(build.pick) : null; // ของที่หยิบอยู่บนคอม ซ่อนตัวจริงไว้ ให้เงาติดเมาส์แทน
  for (const it of its) if (it !== held && FURN[it.f].wall) drawWallItem(ctx, it);
  if (build.on) ctx.drawImage(houseGrid, ISO_B.x0, ISO_B.y0);
  for (const it of its) if (it !== held && FURN[it.f].flat) drawFurnIso(ctx, it, now);
  for (const it of its) { if (it === held) continue; const d = FURN[it.f]; if (!d.wall && !d.flat) list.push({ k: (it.x + it.y) * TS + (it.on ? 1 : 0), f: () => drawFurnIso(ctx, it, now) }); }
  // นั่ง/นอนอยู่บนเตียง/โซฟา: วาดทับหลังตัวเฟอร์นิเจอร์นั้น ไม่ให้ตัวละครไปอยู่ข้างหลัง (ดันลำดับวาดให้ไม่ต่ำกว่าชิ้นนั้น)
  for (const p of players.values()) { const sit = p.sit ? sitNear(p) : null; list.push({ k: sit ? Math.max(p.x + p.y, (sit.x + sit.y) * TS + 2) : p.x + p.y, f: () => drawIsoPlayer(p, now, sit) }); if (p.cp) list.push({ k: p.cp.x + p.cp.y, f: () => drawIsoCompanion(p.cp, now) }); }
  list.sort((a, b) => a.k - b.k).forEach(o => safeDraw(o, 'caveList'));
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
function buildAim() { // จุดบนจอที่เงาของที่จะวางควรอยู่: ของที่ลากจากรายการ / ของในห้องที่กำลังลาก / นิ้วที่แตะ / เมาส์
  if (dragNew) return document.elementFromPoint(dragNew.x, dragNew.y) === canvas ? isoPtr({ clientX: dragNew.x, clientY: dragNew.y }) : null;
  if (dragB && dragB.moved) return dragB.mouse ? [mouse.sx, mouse.sy] : [dragB.lx, dragB.ly];
  if (touchAim) return touchAim;
  return mouse.active && !isTouch ? [mouse.sx, mouse.sy] : null;
}
function drawHouseOverlay(now) {
  if (!inMyHouse() || !build.on) return;
  const pulse = 0.55 + 0.45 * Math.sin(now / 160);
  if (build.pick != null && furn.has(build.pick) && (isTouch || !mouse.active)) outlineItem(furn.get(build.pick), `rgba(255,255,255,${pulse})`);
  const aim = buildAim(); if (!aim) return;
  const [ax, ay] = aim, hv = hitItem(ax, ay); let g = null;
  if (build.erase) { if (hv != null) outlineItem(furn.get(hv), 'rgba(255,90,90,.95)'); return; }
  if (dragB && dragB.moved) { const it = furn.get(dragB.i); if (it) g = ghostFor(it.f, ax, ay, dragB.i, it.r); }
  else if (build.sel) g = ghostFor(build.sel, ax, ay, null, build.rot);
  else if (build.pick != null) { const it = furn.get(build.pick); if (it) g = ghostFor(it.f, ax, ay, build.pick, it.r); }
  else { if (hv != null && !isTouch) outlineItem(furn.get(hv), 'rgba(255,255,255,.6)'); return; }
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
    if (it && (FURN[it.f].seat || FURN[it.f].bed)) { // แตะเก้าอี้/โซฟา/เตียง: ถ้าอยู่ใกล้ก็นั่ง/นอนเลย ไม่งั้นเดินไปก่อน
      if (Math.hypot(it.x * TS - me.x, it.y * TS - me.y) <= 3.5 * TS) { stopWalk(); send({ t: 'act', tool: '', i: hit }); }
      else walkHouse(it.x * TS, it.y * TS + FURN[it.f].d * TS / 2 + 14, { sit: hit });
      return;
    }
  }
  const door = Shared.HOUSE; // แตะพรมหน้าประตู = เดินออกจากบ้าน
  if (X >= door.door[0] * TS && X <= (door.door[1] + 1) * TS && Y >= (door.y1 - 1.2) * TS && Y <= door.y1 * TS) { walkHouse(Shared.HOUSE_SPAWN.x, (door.y1 + 0.5) * TS); return; }
  walkHouse(X, Y);
}
let dragB = null; // ของที่กำลังลาก (โหมดตกแต่ง): {i, sx, sy, moved, mouse}
function buildLongPick(i) { // กดค้างแล้วยังไม่ลาก = หยิบชิ้นนี้ เปิดเมนูตกแต่งให้ลาก/หมุน/เก็บได้ทันที
  if (!dragB || dragB.i !== i || dragB.moved) return;
  dragB.lp = true; build.on = true; build.sel = null; build.erase = false; build.pick = i;
  const f = furn.get(i); if (f) build.tab = FURN[f.f].cat || build.tab;
  if (navigator.vibrate) navigator.vibrate(12); playSfx('click'); renderBuild();
}
const buildCanDrag = () => inMyHouse() && build.on && !build.sel && !build.erase && build.pick == null; // เมาส์: คลิกหยิบ-คลิกวาง (ไม่ลาก) • ถ้าเลือกอยู่ ไม่เริ่มลาก
function buildDrop(d, sx, sy) { // ปล่อยของที่ลากตรงช่องใหม่ (ถ้าวางไม่ได้จะบอกเหตุผล)
  const it = furn.get(d.i); if (!it) return;
  const g = ghostFor(it.f, sx, sy, d.i, it.r);
  if (!g.res.ok) { toast(g.res.why); return; }
  send({ t: 'house', a: 'move', i: d.i, x: g.x, y: g.y, wl: g.wl, u: g.u }); build.pick = null; renderBuild();
}
function buildClick(sx, sy, hit) {
  if (build.erase) { if (hit != null) send({ t: 'house', a: 'remove', i: hit }); else toast('แตะของที่จะเก็บคืน'); return; }
  if (build.sel) {
    const g = ghostFor(build.sel, sx, sy, null, build.rot);
    if (!g.res.ok) { toast(g.res.why); return; }
    send({ t: 'house', a: 'place', f: build.sel, x: g.x, y: g.y, r: build.rot, wl: g.wl, u: g.u }); return;
  }
  if (build.pick != null) { // ถือของอยู่ (หยิบแล้วเงาติดเมาส์): คลิก/แตะที่ไหนก็วางตรงนั้น วางสำเร็จ = จบ (วางไม่ได้ = ยังถืออยู่ ขยับหาที่ใหม่)
    const it = furn.get(build.pick), g = it && ghostFor(it.f, sx, sy, build.pick, it.r);
    if (!it) { build.pick = null; renderBuild(); return; }
    if (!g.res.ok) { toast(g.res.why); return; }
    send({ t: 'house', a: 'move', i: build.pick, x: g.x, y: g.y, wl: g.wl, u: g.u }); build.pick = null; renderBuild(); return;
  }
  if (hit != null) { build.pick = hit; renderBuild(); return; } // คลิก/แตะของ = หยิบ (เงาติดเมาส์)
  toast(isTouch ? 'ลากของในห้องเพื่อย้าย หรือลากของจากรายการลงห้อง' : 'คลิกของในห้องเพื่อหยิบ แล้วคลิกอีกครั้งเพื่อวาง');
}

const FT_TXT = { calm: '🎣 กดค้างเพื่อกรอสาย!', warn: '⚠️ ปลากำลังจะกระชาก! ปล่อยสายผ่อนไว้!', surge: '💢 ปลากระชากแรง! ปล่อยสาย!', tired: '😮‍💨 ปลาอ่อนแรงแล้ว! กรอเลย!' }, FT_SIZE = ['🐟 ตัวเล็ก', '🐠 ตัวกลาง', '🦈 ตัวใหญ่', '🐋 ตัวยักษ์!'];
function fightUI() { // อัปเดตแผงชักเย่อ: หลอดความตึงสาย (เขียว = กรอเร็ว แดง = ใกล้ขาด) หลอดระยะปลา และข้อความตามช่วงของปลา
  if (!ft) return;
  const ph = Shared.fightPhase(ft), F = Shared.FIGHT;
  $('ftten').style.width = Math.min(100, ft.ten) + '%'; $('ffight').classList.toggle('danger', ft.ten >= 85 && !ft.end); $('ffight').classList.toggle('warn', ph === 'warn' || ph === 'surge'); $('ffight').classList.toggle('hold', ftHold);
  $('ftdist').style.width = Math.max(0, Math.min(100, 100 - ft.dist)) + '%'; $('ftfish').style.left = Math.max(0, Math.min(100, 100 - ft.dist)) + '%';
  if (!ft.end) $('ftxt').textContent = `${FT_SIZE[ft.cls] || ''}  ${ft.ten >= 85 ? '🔥 สายใกล้ขาด! ปล่อย!' : FT_TXT[ph]}`;
}
// ===== หิมะตก (เอฟเฟกต์หน้าจอล้วน ไม่เกี่ยวกติกา) ตกเฉพาะฤดูหนาวของเกม ตอนอยู่กลางแจ้งในเมือง =====
const SNOW = { areaPer: 4500, maxDesk: 120, maxTouch: 60, reducedMul: 1 / 3, seasonCheckMs: 30000, sizes: [3, 4, 6], cols: ['#ffffff', '#ffffff', '#eef8ff', '#d6ecfb'], edge: 'rgba(90,140,190,.55)', vyMin: 28, vyMax: 70, sway: 14, swayHz: 0.8, wind: 10, slowMs: 40, slowRun: 20, fastRun: 120, reducedSlow: 0.5, alpha: 0.95 };
let snowMode = 'auto', snowForce = null, snowWinter = false, snowChk = -1e9, snowPool = [], snowLast = 0, snowScale = 1, snowSlow = 0, snowFast = 0;
function snowActive(now) { // เกล็ดหิมะที่ลอยตก: ตอนฝนตกหิมะหยุดตก (เปลี่ยนเป็นฝนแทน) แต่ฉากหิมะ/โทนหนาวของเมืองยังอยู่ (ดู snowScene)
  return snowScene(now) && !rainActive(now);
}
function snowScene(now) { // ฉากหิมะ/เมืองโทนหนาว (ภาพล้วน): ไม่หายตอนฝนตก
  if (snowForce !== null) return snowForce;
  if (snowMode === 'off') return false;
  if (snowMode === 'on') return true;
  if (now - snowChk > SNOW.seasonCheckMs) { snowChk = now; const se = Shared.seasonAt(Date.now() + timeOffset); snowWinter = se.on && se.s.id === 'cool'; }
  return snowWinter;
}
function drawSnow(now) {
  if (document.hidden) { snowLast = 0; return; }
  const dt = snowLast ? Math.min(0.1, (now - snowLast) / 1000) : 0; snowLast = now;
  if (dt > 0) { // เฟรมยาวต่อเนื่อง: ลดจำนวนเกล็ด / เฟรมลื่นต่อเนื่อง: ค่อยเพิ่มคืน
    if (dt * 1000 > SNOW.slowMs) { snowSlow++; snowFast = 0; if (snowSlow >= SNOW.slowRun) { snowScale = Math.max(0.25, snowScale * 0.8); snowSlow = 0; } }
    else { snowSlow = 0; if (++snowFast >= SNOW.fastRun) { snowScale = Math.min(1, snowScale * 1.1); snowFast = 0; } }
  }
  const W = canvas.width, H = canvas.height, dpr = W / innerWidth, red = lvReduced();
  const cap = isTouch ? SNOW.maxTouch : SNOW.maxDesk, want = Math.max(8, Math.round(Math.min(cap, W * H / (dpr * dpr) / SNOW.areaPer) * snowScale * (red ? SNOW.reducedMul : 1)));
  while (snowPool.length < want) snowPool.push({ x: Math.random() * W, y: Math.random() * H, k: Math.random(), ph: Math.random() * 6.28 });
  const sp = red ? SNOW.reducedSlow : 1;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = SNOW.alpha;
  for (let i = 0; i < want; i++) {
    const f = snowPool[i], z = Math.min(SNOW.sizes.length - 1, Math.floor(f.k * SNOW.sizes.length)), sz = Math.max(1, Math.round(SNOW.sizes[z] * dpr));
    const v = (SNOW.vyMin + (SNOW.vyMax - SNOW.vyMin) * (z + f.k) / (SNOW.sizes.length + 1)) * dpr * sp;
    f.y += v * dt;
    if (!red) f.x += (Math.sin(now / 1000 * SNOW.swayHz * 6.28 + f.ph) * SNOW.sway + SNOW.wind) * dpr * dt * (0.5 + z * 0.3);
    if (f.y > H) { f.y = -sz; f.x = Math.random() * W; }
    if (f.x > W) f.x -= W + sz; else if (f.x < -sz) f.x += W;
    const px = Math.round(f.x), py = Math.round(f.y); ctx.fillStyle = SNOW.edge; ctx.fillRect(px - 1, py - 1, sz + 2, sz + 2); ctx.fillStyle = SNOW.cols[(i + z) % SNOW.cols.length]; ctx.fillRect(px, py, sz, sz); // เส้นขอบฟ้าเข้มบางๆ ให้เห็นบนพื้นหญ้าสว่าง
  }
  ctx.restore();
}
// ===== ฝนตก (ภาพ+เสียงเบาๆ เซิร์ฟเวอร์จัดการกติกา/ดินเปียก) เฉพาะกลางแจ้งในเมือง =====
const RAIN_FX = { areaPer: 6000, maxDesk: 240, maxTouch: 80, reducedMul: 1 / 3, reducedSlow: 0.6, chkMs: 5000, vyMin: 520, vyMax: 800, wind: 90, lenMin: 6, lenMax: 12, cols: ['#d4e6f5', '#c0d9ee', '#e6f2fa'], alpha: 0.9, slowMs: 40, slowRun: 20, fastRun: 120, rippleMax: 40, rippleMs: 420, rippleCol: '#d6e6f2', tint: '90,110,135', tintA: 0.2, tintNight: 0.06 };
let rainMode = 'auto', rainForce = null, rainOn = false, rainChk = -1e9, rainPool = [], rainRip = [], rainLast = 0, rainScale = 1, rainSlow = 0, rainFast = 0;
function rainNow() { return !!(Shared.rainAt && Shared.rainAt(Date.now() + timeOffset, 'auto')); }
function rainActive(now) {
  if (rainForce !== null) return rainForce;
  if (rainMode === 'off') return false;
  if (rainMode === 'on') return true;
  if (now - rainChk > RAIN_FX.chkMs) { rainChk = now; rainOn = rainNow(); }
  return rainOn;
}
function drawRain(now, dark) {
  if (document.hidden) { rainLast = 0; return; }
  const R = RAIN_FX, dt = rainLast ? Math.min(0.1, (now - rainLast) / 1000) : 0; rainLast = now;
  if (dt > 0) {
    if (dt * 1000 > R.slowMs) { rainSlow++; rainFast = 0; if (rainSlow >= R.slowRun) { rainScale = Math.max(0.25, rainScale * 0.8); rainSlow = 0; } }
    else { rainSlow = 0; if (++rainFast >= R.fastRun) { rainScale = Math.min(1, rainScale * 1.1); rainFast = 0; } }
  }
  const W = canvas.width, H = canvas.height, dpr = W / innerWidth, red = lvReduced();
  const cap = isTouch ? R.maxTouch : R.maxDesk, want = Math.max(8, Math.round(Math.min(cap, W * H / (dpr * dpr) / R.areaPer) * rainScale * (red ? R.reducedMul : 1)));
  while (rainPool.length < want) rainPool.push({ x: Math.random() * W, y: Math.random() * H, k: Math.random(), gy: 0 });
  const sp = red ? R.reducedSlow : 1;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `rgba(${R.tint},${R.tintA + (R.tintNight - R.tintA) * Math.min(1, dark / 0.75)})`; ctx.fillRect(0, 0, W, H); // โทนหม่นเทาฟ้า (กลางคืนจางลง ไม่มืดซ้ำ)
  ctx.globalAlpha = R.alpha;
  for (let i = 0; i < want; i++) {
    const f = rainPool[i], v = (R.vyMin + (R.vyMax - R.vyMin) * f.k) * dpr * sp, wx = R.wind * dpr * sp, len = Math.round((R.lenMin + (R.lenMax - R.lenMin) * f.k) * dpr), w = f.k > 0.6 ? Math.max(2, Math.round(2 * dpr)) : Math.max(1, Math.round(dpr));
    if (!f.gy) f.gy = Math.max(f.y + 40 * dpr, (0.1 + 0.9 * Math.random()) * H); // จุดที่หยดตกถึงพื้น สุ่มทั่วทั้งจอ (เดิมสุ่มแค่ 300px จากขอบบน เลยตกแค่ครึ่งบนของจอใหญ่)
    f.y += v * dt; f.x += wx * dt;
    if (f.y >= f.gy) { if (!red && rainRip.length < R.rippleMax) rainRip.push({ x: f.x, y: f.gy, t: now }); f.y = -len; f.x = Math.random() * W; f.gy = 0; continue; }
    if (f.x > W) f.x -= W;
    ctx.fillStyle = R.cols[i % R.cols.length];
    const n = Math.max(1, Math.round(len / (3 * dpr))); // เส้นเอียงเป็นขั้นบันไดพิกเซล
    for (let j = 0; j < n; j++) ctx.fillRect(Math.round(f.x - j * wx / v * 3 * dpr), Math.round(f.y - j * 3 * dpr), w, Math.round(3 * dpr));
  }
  ctx.fillStyle = R.rippleCol;
  for (let i = rainRip.length - 1; i >= 0; i--) { // ระลอกวงรีพิกเซลสั้นๆ ที่พื้น
    const r = rainRip[i], a = (now - r.t) / R.rippleMs; if (a >= 1) { rainRip.splice(i, 1); continue; }
    const rw = Math.round((2 + a * 5) * dpr), px = Math.round(r.x), py = Math.round(r.y), th = Math.max(1, Math.round(dpr));
    ctx.globalAlpha = 0.75 * (1 - a); ctx.fillRect(px - rw, py, rw * 2, th); if (a > 0.35) { ctx.fillRect(px - rw - th, py + th, th, th); ctx.fillRect(px + rw, py + th, th, th); }
  }
  ctx.restore();
}
// ---------- ธีมหิมะ ระดับ 2: โทนสีหนาวของเมือง (ภาพล้วน เปิดตาม snowActive() เฉพาะในเมือง) ----------
// ค่าสี/พารามิเตอร์ทั้งหมดอยู่ที่นี่ที่เดียว • พื้นฤดูหนาว (baseWinter) สร้างครั้งเดียวต่อการเปลี่ยนโหมด/ผังเมือง แบ่งทำทีละช่วงหลายเฟรมไม่ให้กระตุก แล้วคืนหน่วยความจำเมื่อปิดโหมด
const WINTER = {
  snow: ['#b9d3ea', '#c9ddf0', '#d9e8f6', '#e8f2fb', '#f7fbff'], sparkle: '#ffffff', sparkleDark: '#a9c8e6', sparkleDen: 0.014, // หญ้า → หิมะ (เงาฟ้าอ่อน → สว่าง) + ประกายพิกเซลตำแหน่งคงที่
  path: ['#7fa6c6', '#91b5d2', '#a4c4de'], sand: ['#9dbfd8', '#b0cde3', '#c2d9ea'], // ทางเดิน/ลาน และทราย → น้ำแข็ง/หิมะบาง (เข้มกว่าพื้นหิมะ ยังเห็นเป็นทาง)
  waterMix: [118, 150, 174, 0.55], iceMinR: 150, ice: ['#cfe5f2', '#e4f3fb'], iceEdge: '#e8f5fc', // น้ำเย็นลง (ผสมเทาฟ้า) · ริมตื้น/ขอบฝั่งเป็นน้ำแข็ง
  fence: '#f4faff', fenceShade: '#bcd4ea', // หิมะบนสันรั้ว
  tree: { depth: 4, white: '#f6fbff', blue: '#c2dbf0', dark: 70 }, roof: { depth: 3, white: '#f2f8fe', blue: '#bcd6ec', dark: 70 }, // หิมะบนยอดไม้/หลังคา (แถวพิกเซลบนสุดต่อคอลัมน์ ข้ามเส้นขอบมืด)
  rentLine: 'rgba(60,110,160,.6)', destLine: 'rgba(40,80,130,.65)', // เส้นขอบแปลงเช่าว่าง/วงจุดหมายที่คลิก บนพื้นหิมะ
  dayRGB: '175,215,255', dayA: 0.09, nightRGB: '6,16,58', // แสงกลางวันโทนเย็นฟ้า · กลางคืนฟ้าเข้มกว่าเดิม (เดิม 5,9,32)
  sliceMs: 5, rowsPerSlice: 96,
};
let winterFlag = false, wJob = null, wCv = null, wSrc = null, wSpr = new WeakMap();
const wRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
function snowSprite(spr, o) { // สำเนาสไปรต์ที่มีหิมะเกาะด้านบน (แคชต่อสไปรต์ ไม่แตะต้นฉบับ)
  let c = wSpr.get(spr); if (c) return c;
  const w = spr.width, h = spr.height; c = document.createElement('canvas'); c.width = w; c.height = h;
  const cg = c.getContext('2d'); cg.drawImage(spr, 0, 0);
  const im = cg.getImageData(0, 0, w, h), d = im.data, wh = wRgb(o.white), bl = wRgb(o.blue);
  for (let x = 0; x < w; x++) {
    const edge = Math.min(x, w - 1 - x) / (w / 2), dep = Math.max(1, Math.round(o.depth * (0.45 + edge) * (0.8 + hash(x, w, 77) * 0.4)));
    let y = 0, n = 0;
    while (y < h && d[(y * w + x) * 4 + 3] < 200) y++;
    while (y < h && d[(y * w + x) * 4 + 3] >= 200 && d[(y * w + x) * 4] + d[(y * w + x) * 4 + 1] + d[(y * w + x) * 4 + 2] < o.dark * 3) y++; // ข้ามเส้นขอบมืดบนสุด
    for (; y < h && n < dep; y++, n++) {
      const i = (y * w + x) * 4; if (d[i + 3] < 200) break;
      const k = n === dep - 1 && dep > 1 ? bl : wh; d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2];
    }
  }
  cg.putImageData(im, 0, 0); wSpr.set(spr, c); return c;
}
function winterStart() { // เริ่มงานสร้างพื้นฤดูหนาวจากพื้นปัจจุบัน (อ่านพิกเซลครั้งเดียว แล้วแปลงทีละแถบ)
  const src = base, w = src.width, h = src.height, S = w / W, im = src.getContext('2d').getImageData(0, 0, w, h);
  const types = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) types[y * W + x] = MAP[y][x];
  const rows = MAP.map(r => r.slice());
  const P = k => WINTER[k].map(wRgb);
  wJob = { src, w, h, S, im, types, rows, y: 0, snow: P('snow'), path: P('path'), sand: P('sand'), ice: P('ice'), iceEdge: wRgb(WINTER.iceEdge), sp: wRgb(WINTER.sparkle), spd: wRgb(WINTER.sparkleDark) };
}
function winterStep() {
  const J = wJob, { w, h, S, types, snow, path, sand, ice } = J, d = J.im.data, t0 = performance.now(), wm = WINTER.waterMix, ice0 = WINTER.iceMinR, den = WINTER.sparkleDen;
  const ty = (px, py) => (px < 0 || py < 0 || px >= w || py >= h) ? -1 : types[((py / S) | 0) * W + ((px / S) | 0)];
  while (J.y < h) {
    const y = J.y, cy = (y / S) | 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2], tt = types[cy * W + ((x / S) | 0)];
      let c = null;
      if (g > r && g > b && r >= g * 0.42 && r <= g * 0.85 && b <= g * 0.65) { // หญ้า (เฉดเขียวเหลืองของพื้น) → หิมะ + ประกาย
        let k = Math.floor((g - 150) / 75 * snow.length); k = k < 0 ? 0 : k >= snow.length ? snow.length - 1 : k;
        c = snow[k]; if (hash(x >> 1, y >> 1, 901) < den) c = k >= 3 ? J.spd : J.sp;
      } else if (r > g && g > b && g >= 140 && r - b >= 20 && r - b <= 120 && tt !== T.FENCE && tt !== T.TREE && (tt === T.PATH || tt === T.SAND || tt === T.LANDMARK || tt === T.BUILD || tt === T.SHOP)) { // ดิน/ทราย/ลานปู → น้ำแข็ง
        const pal = tt === T.SAND ? sand : path, l = (r + g + b) / 3; let k = Math.floor((l - 120) / 80 * pal.length); k = k < 0 ? 0 : k >= pal.length ? pal.length - 1 : k; c = pal[k];
      } else if ((tt === T.WATER || tt === T.BRIDGE) && b > r + 40 && b >= g * 0.85) { // น้ำ → โทนเย็น
        if (tt === T.WATER && (ty(x - 3, y) !== T.WATER && ty(x - 3, y) !== T.BRIDGE || ty(x + 3, y) !== T.WATER && ty(x + 3, y) !== T.BRIDGE || ty(x, y - 3) !== T.WATER && ty(x, y - 3) !== T.BRIDGE || ty(x, y + 3) !== T.WATER && ty(x, y + 3) !== T.BRIDGE)) c = J.iceEdge; // ขอบฝั่งเป็นน้ำแข็งบางๆ
        else if (r >= ice0) c = ice[(r + g + b) / 3 > 215 ? 1 : 0]; // น้ำตื้นริมฝั่ง
        else { const m = wm[3]; d[i] = Math.round(r + (wm[0] - r) * m); d[i + 1] = Math.round(g + (wm[1] - g) * m); d[i + 2] = Math.round(b + (wm[2] - b) * m); }
      }
      if (c) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
    }
    J.y++;
    if ((J.y % 16 === 0 || J.y === h) && performance.now() - t0 > WINTER.sliceMs) break; // พอแล้วสำหรับเฟรมนี้ ที่เหลือเฟรมหน้า
  }
  if (J.y < h) return false;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.putImageData(J.im, 0, 0);
  const U2 = S / PixelArt.U, isF = (x, y) => J.rows[y] && J.rows[y][x] === T.FENCE, u = (n) => n * U2; // รั้ว: หิมะบางๆ บนสันราวและหัวเสา (หน่วยสไปรต์ 16 px ต่อช่อง)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!isF(x, y)) continue;
    const px = x * PixelArt.U, py = y * PixelArt.U, L = isF(x - 1, y), R = isF(x + 1, y), Up = isF(x, y - 1), Dn = isF(x, y + 1);
    if (L || R || !(Up || Dn)) { const x0 = L ? px : px + 6, x1 = R ? px + PixelArt.U : px + 10; g.fillStyle = WINTER.fence; g.fillRect(u(x0), u(py + 4), u(x1 - x0), u(1)); g.fillStyle = WINTER.fenceShade; g.fillRect(u(x0), u(py + 5), u(x1 - x0), u(1) / 2); }
    g.fillStyle = WINTER.fence; g.fillRect(u(px + 5), u(py + 1), u(6), u(2)); g.fillStyle = WINTER.fenceShade; g.fillRect(u(px + 6), u(py + 3), u(4), u(1) / 2);
  }
  { const B = Shared.HOUSE_BLD, hs = PixelArt.bigHouse(), bx = B.x0 * TS, by = B.y0 * TS; g.imageSmoothingEnabled = false; g.drawImage(snowSprite(hs.spr, WINTER.roof), bx + hs.ox * 2, by + hs.oy * 2, hs.w * 2, hs.h * 2); } // บ้านหลังใหญ่ (วาดอยู่ในพื้น) ทับด้วยสไปรต์ที่มีหิมะ
  wCv = cv; wSrc = J.src; wJob = null; return true;
}
function winterBase(on) { // พื้นที่จะวาดตอนนี้: ฤดูหนาวถ้าพร้อม ไม่งั้นพื้นเดิม (ระหว่างสร้างใช้พื้นเดิมไปก่อน) • ปิดโหมดแล้วคืนหน่วยความจำ
  if (!on) { if (wCv || wJob) { wCv = null; wSrc = null; wJob = null; wSpr = new WeakMap(); } return base; }
  if (wCv && wSrc === base) return wCv;
  if (wJob && wJob.src !== base) wJob = null;
  if (!wJob) winterStart();
  winterStep();
  return wCv && wSrc === base ? wCv : base;
}
function frameTail(now, wall) { // กลางวัน/กลางคืน + นาฬิกา + แผนที่ย่อ (ใช้ทั้งในเมืองและในบ้าน)
  if (ft && !ft.end) { const n = performance.now(); Shared.fightStep(ft, Math.min(250, n - ft.last), ftHold); ft.last = n; fightUI(); if (ft.end) fightUI(); } // ทำนายล่วงหน้า (ผลจริงตัดสินที่เซิร์ฟเวอร์ ส่งสถานะมาปรับทุก 150 ms)
  if (fg) { // ตัวชี้เกจตกปลา (เส้นทางเดียวกับที่เซิร์ฟเวอร์คำนวณ) อยู่ที่นี่เพื่อให้ขยับทุกฉาก ทั้งเมือง บ้าน ถ้ำ และทะเล (เดิมอยู่ในรอบวาดเมืองอย่างเดียว ในทะเลตัวชี้เลยค้างอยู่ซ้ายสุด)
    const pos = gaugePos({ gt0: fg.t0, per: fg.per }, performance.now()), inZ = Math.abs(pos - fg.c) <= fg.half;
    $('fgmk').style.left = pos * 100 + '%'; $('fgauge').classList.toggle('hit', inZ);
  }
  const hour = ((wall % CLOCK_MS) / CLOCK_MS * 24 + 6) % 24;
  const dark = daylight(hour);
  ctx.setTransform(1, 0, 0, 1, 0, 0); pm(6);
  if (winterFlag && dark < 0.75) { ctx.fillStyle = `rgba(${WINTER.dayRGB},${WINTER.dayA * (1 - dark / 0.75)})`; ctx.fillRect(0, 0, canvas.width, canvas.height); } // แสงกลางวันโทนเย็นฟ้าอ่อน จางลงตอนมืด
  drawNight(inSea() ? dark : cave ? 0.6 : scene ? dark * 0.4 : dark, now); pm(3); // ในบ้านมืดน้อยกว่า มีแค่โคมไฟ/ตะเกียงที่สว่างกว่า
  if (inTown() && rainActive(now)) drawRain(now, dark); else rainLast = 0;
  if (inTown() && snowActive(now)) drawSnow(now); else snowLast = 0;
  pm(4);
  if (inTown()) drawGuideArrow(now);
  if (inSea()) { // ป้ายทะเล: โซน + นับถอยหลังกลับเกาะ (ตะวันตก/ครบเวลา)
    const left = seaEnd ? Math.max(0, seaEnd - (Date.now() + timeOffset)) : 0, cd = Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0');
    const zn = inOcean() && me ? (Shared.OCEAN_ZONE[Shared.oceanZone(Math.floor(me.x / TS), Math.floor(me.y / TS))] || {}).name : '';
    const t = inOcean() ? `⛵ ทะเลใหญ่${zn ? ' • ' + zn : ''} ${seaEnd ? ' • เรือเช่าหมดเวลาในอีก ' + cd : ' • ไม่จำกัดเวลา'} • เบ็ด 🎣 • แล่นซ้ายสุดเพื่อกลับท่า` : `🛶 ทะเลลึก (แพ) • เหลือ ${cd} • เบ็ด 🎣 ตกปลาทะเล • เดินไปท้ายแพเพื่อกลับเกาะ`;
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(10, 62, ctx.measureText(t).width + 16, 26); ctx.fillStyle = '#fff'; ctx.fillText(t, 18, 80);
  }
  else if (cave) { const t = '⛏️ ถ้ำเหมือง ชั้น ' + caveFlr + '/' + Shared.MINE.floors; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(10, 96, ctx.measureText(t).width + 16, 26); ctx.fillStyle = '#ffe9a8'; ctx.fillText(t, 18, 115); }
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  const icon = dark > 0.45 ? '🌙' : hour < 8 || hour >= 17 ? '🌅' : '☀️';
  const se = Shared.seasonAt(Date.now() + timeOffset), rn = rainActive(now), sem = rn ? '🌧️' : se.s.id === 'rain' && rainMode !== 'off' ? '☁️' : se.s.emoji, txt = `${se.on || rn ? sem + ' ' : ''}${icon} ${String(hh).padStart(2, '0')}:${String(mm - mm % 10).padStart(2, '0')}`; // ฤดูกาล + เวลาในเกม
  if ($('clock').textContent !== txt) $('clock').textContent = txt;
  const ck = $('clock'); if (!ck.onclick) { ck.style.cursor = 'pointer'; ck.onclick = e => { e.stopPropagation(); toast(seasonInfoText(true)); }; }
  if (se.on) { const tt = seasonInfoText(); if (ck.title !== tt) ck.title = tt; }
  pm(6); drawMini(now); pm(5);
}
const blk = (x, y, fx, fy) => (scene ? Shared.houseBlockedAt(MAP, houseRects, x, y, fx, fy) : inOcean() ? blockedAt(MAP, x, y, Shared.BOAT.hull.r) : blockedAt(MAP, x, y)); // ชนผนัง/ของ (ในบ้านรวมเฟอร์นิเจอร์ตัน)
// กันของหายทั้งเฟรม: ถ้าของชิ้นใดชิ้นหนึ่งวาดพัง (error) ชิ้นอื่นที่ต้องวาดต่อจากนั้นไม่หายตามไปด้วย + รายงานกลับเซิร์ฟเวอร์ครั้งเดียวต่อข้อความ
const drawErrSeen = new Set();
function reportClientErr(tag, e) {
  const msg = tag + ': ' + String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e).slice(0, 220);
  if (drawErrSeen.has(msg) || drawErrSeen.size >= 12) return; drawErrSeen.add(msg); console.error('[draw]', msg);
  try { send({ t: 'cerr', m: msg }); } catch (_) { /* ยังไม่ได้ต่อ */ }
}
window.addEventListener('error', e => /^ResizeObserver/.test(e.message || '') || reportClientErr('win', (e.message || '') + ' @' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || 0)));
const safeDraw = (o, tag) => { ctx.save(); try { o.f(); } catch (e) { reportClientErr(tag, e); } finally { ctx.restore(); } };
function step(now) {
  requestAnimationFrame(step);
  stepT0 = perf.m = performance.now(); perfFrame(now);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!joined || !me) return;
  syncVehBtn(); syncHornBtn(); syncRecallBtn();
  { const bf = !!(scene && build.on); if (bf !== bfLast) { bfLast = bf; bz.z = 1; bz.px = bz.py = 0; resize(); } }
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
    const sp = 110 * dt * (hunger <= 0 ? 0.5 : hunger <= 15 ? 0.8 : 1) * (buffOn('speed') ? 1.1 : 1) * petSpeedMul() * (inOcean() ? Shared.OCEAN.speed : 1) * (me.veh && inTown() && Shared.VEHICLES[me.veh] ? Shared.VEHICLES[me.veh].speed : 1), ox = me.x, oy = me.y; // หิวมากจะเดินช้าลง
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
    if (p.id === myId) continue;
    const dx = p.tx - p.x, dy = p.ty - p.y;
    p.moving = Math.hypot(dx, dy) > 1;
    p.x += dx * Math.min(1, dt * 12); p.y += dy * Math.min(1, dt * 12);
    if (p.moving) p.anim += dt;
  }
  for (const p of players.values()) { // สัตว์เลี้ยงคู่ใจ (จำลองฝั่งเว็บ ไม่ต้องส่งตำแหน่ง)
    if (!p.pet || !COMPANIONS[p.pet]) { p.cp = null; continue; }
    const C = COMPANIONS[p.pet], bird = C.kind === 'bird', play = p.pm === 'play';
    const cp = p.cp || (p.cp = { id: p.id, kind: C.kind, v: C.v, x: p.x - 18, y: p.y + 6, dx: 1, anim: Math.random() * 6, moving: false, chase: false, wait: 0, gx: p.x, gy: p.y, nextSay: now + 8000 + Math.random() * 15000 });
    cp.sick = p.psick; cp.name = p.pname; cp.lv = p.id === myId ? Shared.petLevel((petSt[p.pet] || {}).b) : (p.plv | 0) || 1; // ระดับสัตว์: ของเรา = คำนวณจากแต้มผูกพัน คนอื่น = plv จากเซิร์ฟเวอร์
    if (inOcean() && !bird) { // ทะเลใหญ่: สัตว์เดินล็อกที่ที่นั่งบนเรือ (นกบินตามเรือเองด้านล่าง ไม่ล็อก) ไม่มี AI เดิน ไม่ลงน้ำ โยกตามคลื่นเท่าเรือ • นกเกาะยอดเสา
      const H = Shared.BOAT.hull, dir = p.dir | 0, bob = boatBob(p, now), o = Shared.boatSeat(dir, 0), dd = Shared.DIRS[dir] || Shared.DIRS[0];
      if (bird) { cp.x = p.x + dd[0] * H.mast.u - dd[1] * H.mast.v; cp.y = p.y + 6 + bob + dd[1] * H.mast.u + dd[0] * H.mast.v - H.mast.h - 2; }
      else { cp.x = p.x + o.x; cp.y = p.y + 3 + bob + o.y; }
      cp.gx = cp.x; cp.gy = cp.y; cp.moving = false; cp.chase = false; cp.boat = true;
      if (dir === 2) cp.dx = -1; else if (dir === 3) cp.dx = 1; // เรือขึ้น/ลงคง dx เดิม
      if (now > cp.nextSay) { cp.sayAt = now; cp.nextSay = now + 20000 + Math.random() * 30000; }
      continue;
    }
    cp.boat = false;
    const ax = play && !inOcean() ? p.pax : p.x, ay = play && !inOcean() ? p.pay : p.y, od = Math.hypot(p.x - cp.x, p.y - cp.y);
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
    const onDoor = inTown() && Math.floor(me.x / TS) === Shared.HOUSE_DOOR.x && Math.floor(me.y / TS) === Shared.HOUSE_DOOR.y;
    if (onDoor && !doorLatch && !modalOpen()) { doorLatch = true; openHomeChoice(); } else if (!onDoor && inTown()) doorLatch = false;
  }
  // กล้อง
  if (scene && build.on && build.view) { // ตกแต่ง: กล้องนิ่งกลางห้อง (ซูมเข้าแล้วเลื่อนได้ด้วยสองนิ้ว/เมาส์ปุ่มขวา)
    const mx = ISO_B.w / 2 * (1 - 1 / bz.z), my = ISO_B.h / 2 * (1 - 1 / bz.z);
    bz.px = Math.max(-mx, Math.min(mx, bz.px)); bz.py = Math.max(-my, Math.min(my, bz.py));
    camX = ISO_B.x0 + ISO_B.w / 2 + bz.px - build.view.cx / zoom; camY = ISO_B.y0 + ISO_B.h / 2 + bz.py - build.view.cy / zoom;
  } else if (scene) { // ในบ้านกล้องตามตัวละครบนจอไอโซเมตริก ไม่ออกนอกตัวบ้าน
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
  ctx.fillStyle = scene ? '#17110d' : inSea() ? '#1c5f8f' : cave ? '#0b0a10' : '#2d4a2b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
  ctx.imageSmoothingEnabled = false;
  winterFlag = inTown() && snowScene(now); // ธีมหิมะระดับ 2 (โทนหนาว) ใช้เงื่อนไขเดียวกับหิมะตก เฉพาะในเมือง
  if (scene) { pm(6); drawHouseWorld(now); pm(2); frameTail(now, wall); perfJs(performance.now() - stepT0); return; } // ในบ้านวาดแยกแบบไอโซเมตริก
  if (cave) { pm(6); drawCaveWorld(now); pm(2); frameTail(now, wall); perfJs(performance.now() - stepT0); return; } // ในถ้ำวาดแยก: พื้น/ผนังถ้ำ ก้อนแร่ ผู้เล่น
  pm(6); ctx.drawImage(winterBase(winterFlag), 0, 0, W * TS, H * TS);
  ctx.drawImage(baseHi, 0, 0); pm(0);

  const x0 = Math.max(0, Math.floor(camX / TS)), x1 = Math.min(W - 1, Math.ceil((camX + vw) / TS));
  const y0 = Math.max(0, Math.floor(camY / TS)), y1 = Math.min(H - 1, Math.ceil((camY + vh) / TS));
  // น้ำเคลื่อนไหว: ริ้วคลื่นช้า + ประกายพิกเซล (ตรงตาราง 2 px) กะพริบไม่พร้อมกัน
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (MAP[y][x] === T.WATER) {
    const band = Math.sin(now / 700 + y * 0.55 + hash(x, y, 2) * 3);
    if (band > 0.72) {
      ctx.fillStyle = 'rgba(232,253,255,.35)';
      ctx.fillRect(x * TS + 2, y * TS + 8 + Math.floor((band - 0.72) * 20), TS - 4, 2);
    }
    for (let i = 0; i < 2; i++) {
      const v = Math.sin(now / 620 + hash(x, y, i) * 40);
      if (v < 0.55) continue;
      ctx.fillStyle = v > 0.88 ? '#f2feff' : '#b6ecf2';
      ctx.fillRect(x * TS + 2 + Math.floor(hash(x, y, i + 3) * 11) * 2, y * TS + 4 + Math.floor(hash(x, y, i + 6) * 12) * 2, 4 + (i ? 2 : 0), 2);
    }
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
    const fs = PixelArt.fish(i, wag), bob = Math.round(Math.sin(now / 520 + i * 1.7)); // ว่ายขึ้นลงเล็กน้อย
    ctx.save(); ctx.translate(Math.round(fx), Math.round(fy) + bob); ctx.scale(ahead, 1);
    ctx.fillStyle = 'rgba(8,60,86,.22)'; ctx.fillRect(-12, 6, 24, 3); // เงาปลาบนพื้นสระ
    ctx.globalAlpha = 0.78; ctx.drawImage(fs, -9 * 2, -5 * 2, fs.width * 2, fs.height * 2); // อยู่ใต้น้ำ สีจางอมฟ้า
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  ctx.restore();
  // ใบบัวกระจายทั่วสระ มีทั้งใบใหญ่และเล็ก (วางตายตัวตามพิกัดช่อง ไม่ขยับ) อยู่เหนือปลา
  // ใบใหญ่มีแฉกเว้าเป็นรูปตัววี (ตัดออกจากขอบด้านขวา) ส่วนใบเล็กเป็นวงรีเต็ม
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (MAP[y][x] !== T.WATER || hash(x, y, 9) > 0.09) continue;
    const big = hash(x, y, 11) < 0.5, fl = hash(x, y, 13), kind = big ? (fl < .22 ? 3 : fl < .36 ? 4 : fl < .5 ? 5 : 0) : (hash(x, y, 15) < .5 ? 1 : 2);
    const ls = PixelArt.lily(kind), px = Math.round((x + 0.5) * TS), py = Math.round((y + 0.5) * TS);
    ctx.drawImage(ls, px - ls.width, py - ls.height, ls.width * 2, ls.height * 2); // ใบบัวพิกเซล (ใบใหญ่/เล็ก/มีดอกบัว) วางตายตัวตามช่อง
  }
  // แปลงเช่า: เส้นขอบประ + ป้ายชื่อคนเช่า (แปลงว่างเส้นจาง)
  if (inTown()) for (const P of Shared.FARM_RENT.plots) {
    if (P.x1 < x0 || P.x0 > x1 || P.y1 < y0 || P.y0 > y1) continue;
    const r = rentsSt[P.id], active = r && r.until > Date.now() + timeOffset;
    ctx.save(); ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.strokeStyle = active ? 'rgba(255,214,90,.9)' : winterFlag ? WINTER.rentLine : 'rgba(255,255,255,.35)';
    ctx.strokeRect(P.x0 * TS + 2, P.y0 * TS + 2, (P.x1 - P.x0 + 1) * TS - 4, (P.y1 - P.y0 + 1) * TS - 4); ctx.restore();
    if (active) { ctx.font = 'bold 11px sans-serif'; const t = `🏡 ${r.name}`, w = ctx.measureText(t).width + 8; ctx.fillStyle = 'rgba(42,27,20,.75)'; ctx.fillRect(P.x0 * TS + 4, P.y0 * TS + 4, w, 15); ctx.fillStyle = '#ffe9a8'; ctx.fillText(t, P.x0 * TS + 8, P.y0 * TS + 15); }
  }
  // ช่องฟาร์ม
  if (inTown()) {
    const vis = [];
    for (const k in farm) { const [fx, fy] = k.split(',').map(Number); if (fx < x0 - 1 || fx > x1 + 1 || fy < y0 || fy > y1 + 2) continue; vis.push([fx, fy, farm[k]]); } // +2 แถวล่าง: ต้นสูงยื่นขึ้นมาในจอ
    for (const [fx, fy, t] of vis) if (fx >= x0 && fx <= x1 && fy >= y0 && fy <= y1) drawCrop(t, fx * TS, fy * TS, now, 0);
    vis.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    for (const [fx, fy, t] of vis) drawCrop(t, fx * TS, fy * TS, now, 1);
  }
  // จุดหมายที่คลิกให้เดิน
  if (walk && walk.dest) {
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(walk.dest[0] * TS + 16, walk.dest[1] * TS + 16, 6 + Math.sin(now / 150) * 2, 0, 7);
    if (winterFlag) { ctx.strokeStyle = WINTER.destLine; ctx.lineWidth = 4; ctx.stroke(); ctx.lineWidth = 2; } // บนพื้นหิมะวงขาวจม: ใส่ขอบเข้มรองใต้วง
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
  }
  // ไม่วาดกรอบสี่เหลี่ยมบนพื้นแล้ว (ช่องที่ชี้/ช่องที่คลิก) — ใช้เคอร์เซอร์เมาส์เปลี่ยนเป็นรูปมือเมื่อชี้ของที่กดได้แทน
  { let cur = ''; if (mouse.active && !isTouch && mouse.tx >= 0 && mouse.ty >= 0 && mouse.tx < W && mouse.ty < H && (interactive(mouse.tx, mouse.ty) || hubSignAt(mouse.tx, mouse.ty))) cur = 'pointer'; if (canvas.style.cursor !== cur) canvas.style.cursor = cur; }

  if (inTown()) { const hourNow = ((wall % CLOCK_MS) / CLOCK_MS * 24 + 6) % 24; drawSunMotes(now, daylight(hourNow)); drawButterflies(now); }
  // วาดตามลำดับ y
  pm(1); const list = []; let nTree = 0;
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1 + 2); y++) for (let x = Math.max(0, x0 - 1); x <= Math.min(W - 1, x1 + 1); x++) if (MAP[y][x] === T.TREE) { nTree++; list.push({ y: y * TS + 30, f: () => drawTree(x, y) }); }
  for (const [k, f] of felled) { const ty = +k.split(',')[1]; list.push({ y: ty * TS + 30, f: () => drawFelled(k, f, now) }); } // ต้นไม้กำลังล้ม
  if (inTown()) for (const b of BUILDINGS) if (b.kind !== 'sign' && b.kind !== 'cinema' && b.x1 >= x0 - 1 && b.x0 <= x1 + 1 && b.y1 >= y0 - 1 && b.y0 <= y1 + 2) list.push({ y: (b.y1 + 1) * TS - 2, f: () => drawBuilding(b) });
  // กองไฟ + ที่นั่งในลานกลางหมู่บ้าน (ที่นั่งไม่ใช่สิ่งกีดขวาง วาดอยู่ใต้ตัวละคร)
  if (inTown()) for (const s of SEATS) if (s.x >= x0 - 1 && s.x <= x1 + 1 && s.y >= y0 - 1 && s.y <= y1 + 1) list.push({ y: s.y * TS + 12, f: () => drawSeat(s) });
  if (inTown()) if (FIRE.x >= x0 - 1 && FIRE.x <= x1 + 1 && FIRE.y >= y0 - 1 && FIRE.y <= y1 + 1) list.push({ y: FIRE.y * TS + 28, f: () => drawFire(now) });
  if (inTown()) for (const [hx, hy] of Shared.BEE.hives) list.push({ y: (hy + 1) * TS - 2, f: () => drawHive(hx, hy, now) });
  if (inTown()) for (const key of Object.keys(Shared.PENS)) list.push({ y: (Shared.PENS[key].sign[1] + 1) * TS, f: () => drawPenSign(key) });
  if (inTown()) for (const c of animals.values()) list.push({ y: c.y + 8, f: () => { (c.type === 'cow' ? drawCow : c.type === 'pig' ? drawPig : ANIMAL_DRAW[c.type] || drawChicken)(c, now); animalFx(c, now, ANIMAL_TOP[c.type] || 14); hungerMark(c, now); } });
  if (inTown()) for (const q of pets.values()) list.push({ y: q.y + 8, f: () => drawPet(q, now) });
  for (const p of players.values()) if (p.cp) list.push({ y: p.cp.y + 8, f: () => drawCompanion(p.cp, now) });
  for (const p of players.values()) list.push({ y: p.y + 12, f: () => drawPlayer(p, now) });
  if (inTown()) for (const n of npcs.values()) if (n.x > camX - 40 && n.x < camX + vw + 40 && n.y > camY - 60 && n.y < camY + vh + 60) list.push({ y: n.y + 12, f: () => drawPlayer(n, now) });
  if (perfOn) { perf.cn[0] = nTree; perf.cn[1] = players.size; perf.cn[2] = animals.size; perf.cn[3] = list.length; }
  list.sort((a, b) => a.y - b.y).forEach(o => safeDraw(o, 'list'));

  // โรงหนัง: ป้ายสถานะใต้จอ + 🍿 เหนือหัวคนที่กำลังดู (เลิกมีอาคารจอแล้ว)
  if (cin && inTown() && BUILDINGS.some(b => b.kind === 'cinema')) {
    const mv = cin.movie ? { name: cin.name } : null, txt = mv ? `▶ ${mv.name} • 🍿 ${cin.viewers.length} คน` : '🎬 ว่าง กดที่จอเพื่อฉายหนัง';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold 11px ${FONT}`;
    const w = ctx.measureText(txt).width + 12, cx = 17 * TS, cy = 35 * TS - 4;
    ctx.fillStyle = mv ? 'rgba(160,30,30,.85)' : 'rgba(0,0,0,.6)'; ctx.fillRect(cx - w / 2, cy - 9, w, 18);
    ctx.fillStyle = '#fff'; ctx.fillText(txt, cx, cy);
    for (const id of cin.viewers) { const p = players.get(id); if (p) { ctx.font = '14px sans-serif'; ctx.fillText('🍿', p.x + 14, p.y - 34); } }
  }
  // ป้าย Arcade Hub: ให้รู้ว่ากดได้ — กรอบเรืองแสงกะพริบ + ป้ายเล็ก "แตะ" ลอยเหนือป้าย + เมาส์ชี้เปลี่ยนเป็นรูปมือ
  if (hubSign && inTown()) {
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
    const uno = ['uno', 'pok', 'react', 'rps'].includes(s[7]);
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
  if (inTown()) for (const n of npcs.values()) if (n.fs) drawFishing(n, performance.now()); // NPC ตกปลาประกอบฉาก

  if (inTown()) drawLighthouse(ctx, now);
  pm(2);
  frameTail(now, wall);
  perfJs(performance.now() - stepT0);
}
requestAnimationFrame(step);
})();
