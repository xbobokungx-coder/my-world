(() => {
'use strict';
const { REPAIR, toolPrice, canRepair, TS, W, H, T, FARM, DAY_MS, CANS, canTier, gaugePos, FISH_GAUGE, MAX_LV, CROPS, FISH, ANIMALS, RODS, BUILDINGS, SHOPS, SKILLS, DIRS,
  WEAR, WEAR_CATS, WEAR_DEFAULT, wearKey, PANTS_COLOR, MEALS, PLAYER_HUNGER, AXES, SELLBACK, sellbackValue, PLAZA, FIRE, SEATS, seatAt, isChoppable, CASINO,
  DURABILITY, durMax, repairCost, TRADE, TICKET, MOVIES, cinemaAt, CINEMA_CENTER, isTradable, tradeValue,
  GAME_TITLES, COOK, COOK_CATS, cookCat, PROJECTS, PROJ_DONATE, sellQuote, CABINETS, BETS, makeMap, blockedAt, facing, itemInfo, shopSells, shopAt, levelOf, xpFor, inFarm, HOUSING, plotAt, plotSignAt, FURN, TOWN, BOARD, CHEST, reviveCost, QUESTS, titleFor, TITLES, POINTS, BUFFS, FAME, ATM, BANK, VILLAGE, BOTBET, DOLE, playLevel, dolePackage, doleCost, bankInterest, CRAFT, STARTER, STARTER_FINAL, BOOK, WEEKLY, bookInfo } = Shared;
const MAP = makeMap();
const $ = id => document.getElementById(id);
const canvas = $('c'), ctx = canvas.getContext('2d'), mainCtx = ctx;
const PALETTE = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#fd79a8', '#ffffff', '#2c3e50', '#8e5b3a', '#95a5a6'];
const HATS = ['#e8c66a'].concat(PALETTE);
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

// ---------- เครื่องมือบน hotbar ----------
const SLOTS = [
  { id: 'hoe', e: '⛏️', n: 'จอบ' },
  { id: 'water', e: '🫗', n: 'บัวรดน้ำ' },
  { id: 'seed', n: 'เมล็ดพันธุ์', pick: true },
  { id: 'rod', e: '🎣', n: 'เบ็ดตกปลา', pick: true },
  { id: 'feed', n: 'อาหารสัตว์/ยา', pick: true },
  { id: 'axe', e: '🪓', n: 'ขวาน' },
];
const FEEDS = ['feed', 'hay', 'slop', 'medicine'], BAIT_KEYS = ['bait', 'bait_2', 'bait_3'];
let selBait = ls.get('mw_bait') || 'bait';
let slot = 0, selSeed = 'carrot', selFeed = 'feed';
const toolId = () => { const s = SLOTS[slot].id; return s === 'seed' ? 'seed_' + selSeed : s === 'feed' ? selFeed : s; };

// ---------- state ----------
let ws, joined = false, myId = 0, me = null, roomName = '', isAdmin = false;
const roomParam = () => { try { return new URLSearchParams(location.search).get('room') || ''; } catch (e) { return ''; } };
const roomLink = name => location.origin + location.pathname + (name && name !== 'main' ? '?room=' + encodeURIComponent(name) : '');
const pets = new Map(); // สัตว์เลี้ยงประกอบฉาก (แมว/หมา) เซิร์ฟเวอร์คุมการเดิน
const players = new Map(), animals = new Map(), npcs = new Map(); // npcs = ชาวเมือง NPC (ไม่นับเป็นผู้เล่น)
let farm = {}, inv = {}, skills = { farm: 0, fish: 0, animal: 0 }, market = {}, hunger = 80;
const furn = new Map();               // เฟอร์นิเจอร์ในบ้านทุกหลัง: "x,y" -> { x, y, f }
let plotOwners = [];                  // ชื่อเจ้าของที่ดินแต่ละแปลง (null = ว่าง)
let townLog = [], chestSt = { coin: 0, dead: {} }, townTab = 'log';
let projSt = [];
let questSt = { list: [], total: 0, title: '', pts: { bal: 0, earned: 0 } }, fameSt = {};
let bankSt = { bal: 0, cap: BANK.cap, rate: BANK.rate, next: 0 }, villageSt = { n: 0, goal: 0, done: false, left: 0 };
let villageEnd = 0; // เวลาที่บัฟ Happy Village หมด (ms ของนาฬิกาเครื่องนี้)
const happyOn = () => villageEnd > Date.now();
const buffExp = {}; // บัฟที่ยังมีผลอยู่: id -> เวลาหมด (ms ของนาฬิกาเครื่องนี้)
const buffOn = id => (buffExp[id] || 0) > Date.now();
const build = { on: false, sel: null, erase: false };
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
  return { id: o.id, title: o.title || '', name: o.name, color: o.color, hat: o.hat || '#e8c66a', pc: o.pc || PANTS_COLOR, wear: Object.assign({}, WEAR_DEFAULT, o.wear), x: o.x, y: o.y, tx: o.x, ty: o.y, dir: o.dir || 0, fs: 0, fx: 0, fy: 0, anim: 0, moving: false, chat: '', chatAt: 0, voice: !!o.voice, speaking: false, lamp: !!o.lamp, sit: false, deaf: !!o.deaf };
}
function applyTrees(list) { // ซิงก์ต้นไม้ที่ตัดได้ให้ตรงกับเซิร์ฟเวอร์ (ต้นไม้ขอบแมพไม่เปลี่ยน)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isChoppable(MAP, x, y)) MAP[y][x] = T.GRASS;
  for (const [x, y] of list) if (MAP[y] && MAP[y][x] === T.GRASS) MAP[y][x] = T.TREE;
}
function handle(m) {
  switch (m.t) {
    case 'err': $('loginErr').textContent = m.text; $('go').disabled = false; if (m.need === 'akey') { $('akey').classList.remove('hidden'); $('akey').focus(); ls.set('mw_akey', ''); } break;
    case 'w':
      joined = true; myId = m.id; inv = m.inv; farm = m.farm; skills = Object.assign({ farm: 0, fish: 0, animal: 0, wood: 0 }, m.skills); timeOffset = m.time - Date.now(); setHunger(m.hunger === undefined ? 80 : m.hunger);
      dur = m.dur || {}; wtr = m.wtr === undefined ? CANS[canTier(inv)].cap : m.wtr; setCin(m.cin);
      if (m.trees) applyTrees(m.trees);
      furn.clear(); plotOwners = (m.house && m.house.plots) || [];
      for (const [x, y, f] of (m.house ? m.house.items : [])) setFurn(x, y, f);
      players.clear();
      m.players.forEach(p => players.set(p.id, mkPlayer(p)));
      npcs.clear(); (m.npcs || []).forEach(n => npcs.set(n.id, mkPlayer(n)));
      pets.clear(); (m.pets || []).forEach(q => pets.set(q.id, { id: q.id, kind: q.kind, v: q.v, x: q.x, y: q.y, tx: q.x, ty: q.y, dir: q.dir, dx: q.dir === 2 ? -1 : 1, anim: Math.random() * 6, moving: false }));
      me = players.get(myId); updateLampBtn(); syncDeaf();
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
    case 'deaf': { const p = players.get(m.id); if (p) p.deaf = !!m.on; break; }
    case 'voice': { const p = players.get(m.id); if (p) { p.voice = m.on; if (!m.on) p.speaking = false; } break; }
    case 'look': { const p = players.get(m.id); if (p) { p.color = m.color; p.hat = m.hat; if (m.pc) p.pc = m.pc; if (m.wear) p.wear = Object.assign({}, WEAR_DEFAULT, m.wear); if (m.lamp !== undefined) p.lamp = !!m.lamp; if (arcOpenNow() || bagShown() || shopKind) refreshOpen(); updateLampBtn(); } break; }
    case 'tree': if (MAP[m.y]) { if (m.on) { if (MAP[m.y][m.x] === T.GRASS) MAP[m.y][m.x] = T.TREE; } else if (isChoppable(MAP, m.x, m.y)) MAP[m.y][m.x] = T.GRASS; } break;
    case 'hun': setHunger(m.v); break;
    case 'rtc': onRtc(m.from, m.d); break;
    case 'p+': players.set(m.id, mkPlayer(m)); updateOnline(); addChat('', `${m.name} เข้ามาในฟาร์ม 👋`, true); break;
    case 'p-': { const p = players.get(m.id); if (p) addChat('', `${p.name} ออกไปแล้ว`, true); players.delete(m.id); closePeer(m.id); updateOnline(); break; }
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
      for (const [id, type, x, y, prod, fed, dx, hg, sick] of m.c) {
        alive.add(id);
        let a = animals.get(id);
        if (!a) { a = { x, y, anim: Math.random() * 6, id }; animals.set(id, a); }
        const oldH = a.h;
        a.type = type; a.tx = x; a.ty = y; a.prod = prod; a.fed = fed; a.dx = dx; a.h = hg === undefined ? 100 : hg; a.sick = !!sick; if (oldH !== undefined && a.h > oldH + 15) a.happyAt = performance.now(); // เพิ่งได้กิน = ดีใจ
      }
      for (const id of animals.keys()) if (!alive.has(id)) animals.delete(id);
      break;
    }
    case 'tile': if (m.v) farm[m.k] = m.v; else delete farm[m.k]; break;
    case 'inv': inv = m.inv; renderHud(); refreshOpen(); updateLampBtn(); break;
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
    case 'furn': setFurn(m.x, m.y, m.f); break;
    case 'admin': onAdmin(m); break;
    case 'kicked': { const d = $('dc').firstElementChild; if (d) d.textContent = 'คุณถูกผู้ดูแลเตะออกจากห้อง 🦶 กดเชื่อมต่อใหม่เพื่อเข้ามาอีกครั้ง'; } break;
    case 'log': if (m.list) townLog = m.list.slice(); else if (m.e) { townLog.push(m.e); if (townLog.length > TOWN.logMax) townLog.shift(); } if (townShown()) renderTown(); break;
    case 'chest': chestSt = m.c; if (townShown()) renderTown(); break;
    case 'proj': projSt = m.p; if (townShown()) renderTown(); break;
    case 'quests': {
      questSt = { list: m.list, total: m.total, title: m.title, pts: m.pts, dole: m.dole, starter: m.starter, streak: m.streak, book: m.book, wk: m.wk };
      updateGuide(); updateQuestBadge(); if (bagShown() && (bagTab === 'quest' || bagTab === 'book')) renderBag();
      for (const id of Object.keys(BUFFS)) buffExp[id] = m.buffs[id] ? Date.now() + m.buffs[id] : 0;
      if (me) me.title = m.title;
      if (townShown()) renderTown(); break;
    }
    case 'bank': bankSt = m; if (townShown()) renderTown(); break;
    case 'village': villageSt = m; villageEnd = m.left ? Date.now() + m.left : 0; updateHappyChip(); if (townShown()) renderTown(); break;
    case 'fame': fameSt = m.f; if (townShown()) renderTown(); break;
    case 'title': { const p = players.get(m.id); if (p) p.title = m.title; break; }
    case 'town': openTown(m.w === 'chest' ? 'chest' : m.w === 'atm' ? 'bank' : 'log'); break;
    case 'plot': plotOwners[m.i] = m.owner; if (plotsShown()) renderPlots(); if (build.on && myPlot() < 0) { build.on = false; renderBuild(); } break;
  }
}

// ---------- ผู้ดูแล: สร้าง/ลบห้อง (โลกแยกกัน) + ลิงก์ ----------
let adminSt = { rooms: [], current: '', err: '' };
const adminShown = () => !$('admin').classList.contains('hidden');
function openAdmin() { $('admin').classList.remove('hidden'); send({ t: 'admin', a: 'rooms' }); send({ t: 'admin', a: 'users' }); renderAdmin(); }
function closeAdmin() { $('admin').classList.add('hidden'); }
function onAdmin(m) {
  adminSt = { rooms: m.rooms || [], current: m.current || '', err: m.err || '', users: m.users || (adminSt && adminSt.users) || [] };
  if (m.created) { const url = roomLink(m.created); try { navigator.clipboard.writeText(url).catch(() => {}); } catch (e) { /* ไม่ได้ก็ไม่เป็นไร */ } toast('สร้างห้อง ' + m.created + ' แล้ว คัดลอกลิงก์ให้แล้ว 🔗'); }
  if (m.kicked) { toast('เตะ ' + m.kicked + ' ออกแล้ว'); setTimeout(() => send({ t: 'admin', a: 'users' }), 700); }
  if (m.removed) toast('เลิกใช้ห้อง ' + m.removed + ' แล้ว');
  if (adminShown()) renderAdmin();
}
function renderAdmin() {
  const el = $('adminBody'), esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let h = adminSt.err ? `<div class="banner" style="background:#fde0dc">${esc(adminSt.err)}</div>` : '';
  h += '<div class="arow"><input type="text" id="newRoom" maxlength="20" placeholder="ชื่อห้อง (a-z 0-9 _ -) เว้นว่าง = สุ่มให้"><button class="btn small" id="mkRoom">➕ สร้างห้อง</button></div><div class="sec">ห้องทั้งหมด</div>';
  h += adminSt.rooms.map(r => `<div class="arow${r.name === adminSt.current ? ' cur' : ''}"><span><b>${esc(r.name)}</b>${r.main ? ' (ห้องหลัก)' : ''}${r.name === adminSt.current ? ' • คุณอยู่ที่นี่' : ''}<br><small>👥 ${r.online} คน</small></span><span>`
    + `<button class="btn small" data-copy="${esc(r.name)}">🔗 คัดลอกลิงก์</button> `
    + (r.name !== adminSt.current ? `<button class="btn small" data-go="${esc(r.name)}">↪️ ไปห้องนี้</button> ` : '')
    + (!r.main ? `<button class="btn small muted" data-rm="${esc(r.name)}">🗑️ เลิกใช้</button>` : '') + '</span></div>').join('');
  const ago = t => { if (!t) return '-'; const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 90 ? 'เมื่อสักครู่' : s < 5400 ? Math.round(s / 60) + ' นาทีก่อน' : s < 129600 ? Math.round(s / 3600) + ' ชม.ก่อน' : Math.round(s / 86400) + ' วันก่อน'; };
  h += '<div class="sec">👥 ผู้เล่นและ IP <button class="btn small" id="ipRefresh">🔄 รีเฟรช</button></div>';
  h += (adminSt.users || []).map(u => `<div class="arow"><span>${u.online ? '🟢' : '⚪'} <b>${esc(u.name)}</b> <small>ห้อง ${esc(u.room)}</small><br><small>${u.online ? 'IP ตอนนี้: <b>' + esc(u.ip) + '</b>' : 'เข้าล่าสุด ' + ago(u.last)}</small>`
    + `<br><small style="opacity:.7">${u.ips.map(x => esc(x.ip) + ' (' + ago(x.t) + ')').join(' • ') || 'ยังไม่มีประวัติ IP'}</small></span>${u.online && !u.admin ? `<span><button class="btn small muted" data-kick="${esc(u.name)}" data-kroom="${esc(u.room)}">🦶 เตะ</button></span>` : ''}</div>`).join('') || '<p style="opacity:.7">ยังไม่มีข้อมูล</p>';
  el.innerHTML = h;
  el.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => ask('เตะ ' + b.dataset.kick + ' ออกจากห้อง?\n(เขาเข้ามาใหม่ได้ทันที)', () => send({ t: 'admin', a: 'kick', room: b.dataset.kroom, name: b.dataset.kick })));
  $('ipRefresh').onclick = () => send({ t: 'admin', a: 'users' });
  $('mkRoom').onclick = () => { send({ t: 'admin', a: 'create', name: $('newRoom').value }); $('newRoom').value = ''; };
  el.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => { const url = roomLink(b.dataset.copy); try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว 🔗'); } catch (e) { prompt('คัดลอกลิงก์นี้:', url); } });
  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { location.href = roomLink(b.dataset.go); });
  el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => ask('เลิกใช้ห้อง ' + b.dataset.rm + '?\n(ข้อมูลเซฟยังอยู่ในโฟลเดอร์ data แต่เข้าผ่านลิงก์ไม่ได้แล้ว)', () => send({ t: 'admin', a: 'remove', name: b.dataset.rm })));
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
function renderBankTab(el) {
  const coin = inv.coin || 0, room = Math.max(0, bankSt.cap - bankSt.bal), nextInt = bankInterest(bankSt.bal);
  let h = `<div class="row"><span>💳 ยอดเงินฝาก</span><b>🪙 ${bankSt.bal} / ${bankSt.cap}</b></div><div class="bar"><i style="width:${Math.round(bankSt.bal / bankSt.cap * 100)}%"></i></div>`
    + `<p style="font-size:12px;opacity:.7;margin:6px 0 8px">ดอกเบี้ยขั้นบันไดต่อ 12 นาทีที่คุณออนไลน์: ${BANK.tiers.map(([hi, rt], i) => (i ? (BANK.tiers[i - 1][0] + 1).toLocaleString() : "1") + "–" + hi.toLocaleString() + " เหรียญ " + "→ " + +(rt * 100).toFixed(2) + "%").join(" • ")} ${bankSt.bal > 0 ? `• รอบหน้าได้ประมาณ +${nextInt} ในอีก ${Math.max(1, Math.ceil(bankSt.next / 60000))} นาที` : '• ฝากเงินเพื่อเริ่มได้ดอกเบี้ย'} • ฝากสะสมกินดอกได้สูงสุด ${bankSt.cap.toLocaleString()} เหรียญ</p>`
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
$('questBtn').onclick = () => (bagShown() && bagTab === 'quest' ? closeBag() : openBag('quest'));
function updateGuide() {
  const el = $('guide'); if (!el) return;
  const st = questSt.starter, next = st && !st.final && STARTER.find(s => !st.done.includes(s.id));
  if (!me || !next) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden'); el.textContent = '👉 ' + next.hint + ' (' + st.done.length + '/' + STARTER.length + ')';
}
$('guide').onclick = () => openBag('quest');
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
function renderQuestTab(el) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const next = TITLES.find(t => t[0] > questSt.total);
  let h = `<div class="row"><span>🏅 ${questSt.title ? esc(questSt.title) : 'ยังไม่มีฉายา'}</span><small>เควสสำเร็จสะสม ${questSt.total}</small></div>`
    + (next ? `<div class="tabs-note">อีก ${next[0] - questSt.total} เควสจะได้ฉายา "${next[1]}" (แสดงเหนือหัวตัวละคร)</div>` : '<div class="tabs-note">ได้ฉายาสูงสุดแล้ว 👑</div>')
    + '<div class="sec">📋 เควสวันนี้ (เปลี่ยนใหม่ทุกวัน)</div>';
  for (const [id, n, done] of questSt.list) {
    const d = QUESTS[id]; if (!d) continue;
    h += `<div class="qrow${done ? ' done' : ''}"><div>${SKILLS[d.skill].emoji} ${done ? '✅ ' : ''}${d.text} <b>${Math.min(n, d.goal)}/${d.goal}</b></div><div class="bar"><i style="width:${Math.round(Math.min(n, d.goal) / d.goal * 100)}%"></i></div><small>🎁 +${d.xp} XP  +🪙${d.coin}</small></div>`;
  }
  if (!questSt.list.length) h += '<p style="opacity:.7">กำลังโหลด...</p>';
  h += `<div class="sec">💛 แต้มความดี: <b>${questSt.pts.bal}</b> <small>(วันนี้ได้ ${questSt.pts.earned}/${POINTS.dailyCap})</small></div><div class="tabs-note">ได้จากการช่วยงานที่จำเป็นจริง: ให้อาหารสัตว์ที่หิว รักษาสัตว์ป่วย รดน้ำพืชที่แห้ง ลงขันตู้เซฟ</div>`;
  for (const [id, B] of Object.entries(BUFFS)) {
    const left = Math.max(0, (buffExp[id] || 0) - Date.now()), on = left > 0;
    h += `<div class="row"><span>${B.emoji} ${B.name}<br><small>${B.desc} • ${Math.round(B.ms / 60000)} นาที</small></span><span>${on ? `<small>เหลือ ${Math.ceil(left / 60000)} นาที</small>` : `<button class="btn small" data-buff="${id}" ${questSt.pts.bal < B.cost ? 'disabled' : ''}>แลก 💛${B.cost}</button>`}</span></div>`;
  }
  el.innerHTML = guideHTML() + h;
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
function setFurn(x, y, f) {
  const k = x + ',' + y;
  if (f && FURN[f]) { furn.set(k, { x, y, f }); MAP[y][x] = FURN[f].solid ? T.FURN : T.FLOOR; }
  else { furn.delete(k); if (MAP[y][x] === T.FURN) MAP[y][x] = T.FLOOR; }
}
const myPlot = () => (me ? plotOwners.indexOf(me.name) : -1);
const furnKeys = () => Object.keys(inv).filter(k => k.startsWith('furn_') && FURN[k.slice(5)]);
function toggleBuild(on) {
  if (on === undefined) on = !build.on;
  if (on && myPlot() < 0) { openPlots(); return; }
  if (false) { toast(`🏠 ยังไม่มีบ้าน — กดที่ป้าย "ที่ดินว่าง" แถวบนสุดของแมพเพื่อซื้อ (🪙${HOUSING.price})`); on = false; }
  build.on = on; build.erase = false;
  if (on && !build.sel) build.sel = (furnKeys()[0] || '').slice(5) || null;
  renderBuild();
}
function renderBuild() {
  const el = $('build'); el.classList.toggle('hidden', !build.on); document.body.classList.toggle('building', build.on);
  $('houseBtn').style.opacity = build.on ? 1 : .8;
  if (!build.on) return;
  const ks = furnKeys();
  if (build.sel && !(inv['furn_' + build.sel] > 0)) build.sel = (ks[0] || '').slice(5) || null;
  el.innerHTML = `<div class="bhint">🏠 โหมดตกแต่งบ้าน — ${build.erase ? 'แตะของในบ้านเพื่อเก็บคืนเข้ากระเป๋า' : build.sel ? 'แตะช่องพื้นไม้เพื่อวางของ' : 'ยังไม่มีเฟอร์นิเจอร์ ไปซื้อที่ 🛋️ ร้านเฟอร์นิเจอร์ (ริมถนนหลัก)'}</div><div class="bitems">`
    + ks.map(k => { const f = k.slice(5); return `<button class="btn small${!build.erase && build.sel === f ? ' on' : ''}" data-bf="${f}" title="${FURN[f].name}">${FURN[f].emoji} ×${inv[k]}</button>`; }).join('')
    + `<button class="btn small${build.erase ? ' on' : ''}" data-erase="1">🧹 เก็บคืน</button><button class="btn small muted" data-bleave="1">🏷️ คืนที่ดิน</button><button class="btn small muted" data-bexit="1">✖ ออก</button></div>`;
  el.querySelectorAll('[data-bf]').forEach(b => b.onclick = () => { build.sel = b.dataset.bf; build.erase = false; playSfx('click'); renderBuild(); });
  el.querySelector('[data-erase]').onclick = () => { build.erase = !build.erase; playSfx('click'); renderBuild(); };
  el.querySelector('[data-bexit]').onclick = () => toggleBuild(false);
  el.querySelector('[data-bleave]').onclick = () => ask(`คืนที่ดิน?\nเฟอร์นิเจอร์ทั้งหมดจะกลับเข้ากระเป๋า และได้เงินคืน 🪙${Math.floor(HOUSING.price * HOUSING.refund)} (70%)`, () => { send({ t: 'house', a: 'leave' }); toggleBuild(false); });
}
$('houseBtn').onclick = () => toggleBuild();
const plotsShown = () => !$('plots').classList.contains('hidden');
function openPlots() { $('plots').classList.remove('hidden'); renderPlots(); }
function closePlots() { $('plots').classList.add('hidden'); }
function renderPlots() {
  const el = $('plotsBody'), esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), mine = myPlot(), coin = inv.coin || 0;
  let h = `<p style="font-size:13px;opacity:.75;margin:0 0 8px">คนละ 1 แปลง พื้นไม้ ${HOUSING.w}×${HOUSING.y1 - HOUSING.y0 + 1} ช่อง ตกแต่งด้วยเฟอร์นิเจอร์ได้ คืนที่ดินได้ 70% • ที่ดินอยู่แถวบนสุดของแมพ (เหนือถนนฝั่งเหนือ)</p>`;
  h += HOUSING.plots.map((_, i) => {
    const owner = plotOwners[i], isMine = owner && me && owner === me.name;
    return `<div class="row"><span>🏠 แปลงที่ ${i + 1}<br><small>${owner ? (isMine ? '✅ ของคุณ' : 'บ้านของ ' + esc(owner)) : '🪙' + HOUSING.price + ' • ว่าง'}</small></span><span>`
      + (!owner ? `<button class="btn small" data-buyplot="${i}" ${mine >= 0 || coin < HOUSING.price ? 'disabled' : ''}>${mine >= 0 ? 'มีบ้านแล้ว' : coin < HOUSING.price ? 'เหรียญไม่พอ' : 'ซื้อ'}</button>` : isMine ? '<button class="btn small" data-buildnow="1">🛠️ ตกแต่ง</button>' : '') + '</span></div>';
  }).join('');
  el.innerHTML = h;
  el.querySelectorAll('[data-buyplot]').forEach(b => b.onclick = () => ask(`ซื้อที่ดินแปลงที่ ${+b.dataset.buyplot + 1} ราคา 🪙${HOUSING.price} ?\n(ซื้อได้คนละ 1 แปลง คืนที่ดินได้ 70%)`, () => send({ t: 'house', a: 'buy', plot: +b.dataset.buyplot })));
  el.querySelectorAll('[data-buildnow]').forEach(b => b.onclick = () => { closePlots(); toggleBuild(true); });
}
$('plotsClose').onclick = closePlots;
$('plots').addEventListener('pointerdown', e => { if (e.target === $('plots')) closePlots(); });
function houseClick(tx, ty) { // คืน true ถ้าการแตะนี้ถูกใช้กับระบบบ้านแล้ว
  const si = plotSignAt(tx, ty), pi = plotAt(tx, ty);
  if (si >= 0) {
    const owner = plotOwners[si];
    if (!owner) openPlots();
    else if (si === myPlot()) toggleBuild();
    else toast(`🏠 บ้านของ ${owner} — เดินเข้าไปชมได้เลย`);
    return true;
  }
  if (build.on && pi >= 0 && pi === myPlot()) {
    const cur = furn.get(tx + ',' + ty);
    if (build.erase || (cur && !build.sel)) { if (cur) send({ t: 'house', a: 'remove', x: tx, y: ty }); else toast('ช่องนี้ไม่มีของให้เก็บ'); }
    else if (cur) toast('ช่องนี้มีของอยู่แล้ว (กด 🧹 เก็บคืน เพื่อเก็บออก)');
    else if (build.sel) send({ t: 'house', a: 'place', f: build.sel, x: tx, y: ty });
    else toast('เลือกเฟอร์นิเจอร์ก่อน');
    return true;
  }
  return false;
}

// กล่องยืนยันในเกม แทน confirm() ที่บางเบราว์เซอร์มือถือ/เว็บวิวไม่แสดง
let askYes = null;
function ask(text, yes) { $('askText').textContent = text; askYes = yes; $('ask').classList.remove('hidden'); }
$('askYes').onclick = () => { $('ask').classList.add('hidden'); const f = askYes; askYes = null; if (f) f(); };
$('askNo').onclick = () => { $('ask').classList.add('hidden'); askYes = null; };
// ปุ่มย่อ/ขยายแถบเมนูด้านบน (ย่อแล้วเหลือแค่เหรียญ ความอิ่ม และปุ่มขยาย) จำค่าไว้ในเครื่อง
function setHudFold(on) { $('hudTop').classList.toggle('folded', on); $('hudFold').textContent = on ? '☰' : '▴'; $('hudFold').title = on ? 'ขยายแถบเมนู' : 'ย่อแถบเมนู'; ls.set('mw_hudfold', on ? '1' : '0'); if (typeof layoutHud === 'function') layoutHud(); }
$('hudFold').onclick = () => setHudFold(!$('hudTop').classList.contains('folded'));
setHudFold(ls.get('mw_hudfold') === '1');
// ---------- HUD ----------
let toastT;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400); }
function setHunger(v) {
  hunger = Math.max(0, Math.min(100, Math.round(v)));
  const el = $('hungerChip'); if (!el) return;
  el.textContent = (hunger <= 0 ? '😵 ' : hunger <= 20 ? '🍗 ' : '🍖 ') + hunger;
  el.style.color = hunger <= 5 ? '#c0392b' : hunger <= 20 ? '#c47a00' : '';
  el.classList.toggle('blink', hunger <= 5);
  el.title = 'ความอิ่ม (0 = หิวจนไม่มีแรง) กดเพื่อเปิดกระเป๋าไปกินอาหาร';
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
  if (s.id === 'seed') return { e: CROPS[selSeed].emoji, n: 'เมล็ด' + CROPS[selSeed].name, cnt: inv['seed_' + selSeed] || 0 };
  if (s.id === 'feed') { const f = itemInfo(selFeed); return { e: f.emoji, n: f.name, cnt: inv[selFeed] || 0 }; }
  if (s.id === 'water') { const c = CANS[canTier(inv)]; return { e: c.emoji, n: `${c.name} (น้ำ ${wtr}/${c.cap} • แตะสระเพื่อตักน้ำ)`, cnt: wtr }; }
  if (s.id === 'rod') { const b = itemInfo(selBait); return { e: s.e, n: RODS[rodLevel()].name + ' (' + b.name.split(' ')[0] + ' ' + (inv[selBait] || 0) + ')', cnt: inv[selBait] || 0 }; }
  if (s.id === 'axe') { const ax = axeLevel(); return { e: s.e, n: ax ? AXES[ax].name : 'ขวาน (ยังไม่มี ซื้อที่ร้านช่างไม้)', cnt: ax ? null : 0 }; }
  return { e: s.e, n: s.n, cnt: null };
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
function pickSlot(i) {
  if (i === slot && SLOTS[i].pick) { $('picker').classList.contains('hidden') ? showPicker() : hidePicker(); return; }
  slot = i; hidePicker(); renderHud(); toast(`${slotInfo(i).e} ${slotInfo(i).n}`); playSfx('click');
}
function hidePicker() { $('picker').classList.add('hidden'); }
function showPicker() {
  const s = SLOTS[slot].id, el = $('picker');
  const keysList = s === 'seed' ? Object.keys(CROPS).map(c => 'seed_' + c) : s === 'rod' ? BAIT_KEYS : FEEDS;
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
const modalOpen = () => ['bag', 'shop', 'people', 'arcade', 'trade', 'cinema', 'town', 'admin', 'plots', 'ask'].some(id => !$(id).classList.contains('hidden'));
function openBag(tab) { if (tab) bagTab = tab; $('bag').classList.remove('hidden'); renderBag(); }
function closeBag() { $('bag').classList.add('hidden'); }
const bagShown = () => !$('bag').classList.contains('hidden');
$('bagBtn').onclick = () => (bagShown() && bagTab === 'items' ? closeBag() : openBag('items'));
$('statBtn').onclick = () => (bagShown() && bagTab === 'status' ? closeBag() : openBag('status'));
setInterval(() => { if (bagShown() && bagTab === 'status') renderBag(); }, 1000);
$('bagClose').onclick = closeBag;
$('bag').addEventListener('pointerdown', e => { if (e.target === $('bag')) closeBag(); });
document.querySelectorAll('.tab[data-tab]').forEach(t => t.onclick = () => { bagTab = t.dataset.tab; renderBag(); });
$('bagBody').addEventListener('click', e => {
  if (e.target.closest('[data-sfx]')) { sfxOn = !sfxOn; ls.set('mw_sfx', sfxOn ? '1' : '0'); renderBag(); playSfx('coin'); return; }
  const eb = e.target.closest('[data-eat]'); if (eb) { send({ t: 'eat', item: eb.dataset.eat }); }
});
$('hungerChip').onclick = () => openBag('items');
// ตะเกียง: ปุ่ม 🏮 (หรือกด L) เปิด/ปิดแสงรอบตัว 3 ช่อง เห็นเฉพาะตอนกลางคืน (เพื่อนเห็นแสงของคุณด้วย)
function updateLampBtn() {
  const b = $('lampBtn'); if (!b) return;
  b.classList.toggle('hidden', !(inv.lamp > 0));
  const on = !!(me && me.lamp); b.style.opacity = on ? 1 : .55; b.title = on ? 'ตะเกียง: เปิดอยู่ (L)' : 'ตะเกียง: ปิดอยู่ (L)'; b.textContent = on ? '🏮' : '🔦';
}
$('lampBtn').onclick = () => { if (me) { send({ t: 'lamp', on: !me.lamp }); playSfx('click'); } };

const CATS = [['furn', '🛋️ เฟอร์นิเจอร์ (วางในบ้านด้วยปุ่ม 🏠)'], ['food', '🍽️ อาหารสำเร็จรูป (กินแล้วหายหิว)'], ['seed', '🌱 เมล็ดพันธุ์'], ['crop', '🥬 พืชผล'], ['fish', '🐟 ปลาที่ตกได้'], ['animal', '🥚 ผลผลิตจากสัตว์'], ['feed', '🌾 อาหารสัตว์ / ยา'], ['tool', '🪱 เหยื่อตกปลา'], ['wood', '🪵 ไม้'], ['gear', '🎒 อุปกรณ์ที่ซื้อ']];
function renderBag() {
  document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.toggle('on', t.dataset.tab === bagTab));
  const el = $('bagBody');
  if (bagTab === 'quest') return renderQuestTab(el);
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
  } else if (bagTab === 'items') {
    let h = `<div class="row"><span>🪙 เหรียญ</span><b>${inv.coin || 0}</b></div>`;
    let any = false;
    for (const [cat, title] of CATS) {
      const ks = Object.keys(inv).filter(k => { const i = itemInfo(k); return i && i.cat === cat; });
      if (!ks.length) continue; any = true;
      h += `<div class="sec">${title}</div><div class="grid">` + ks.map(k => { const i = itemInfo(k); return `<div class="card"><b>${i.emoji}</b>${i.name}<br>×${inv[k]}${i.food ? `<br><button class="btn small" data-eat="${k}" style="margin-top:4px;padding:3px 8px;font-size:12px" ${hunger >= 99 ? 'disabled' : ''}>🍴 กิน +${i.food}</button>` : ''}</div>`; }).join('') + '</div>';
    }
    // ของกินได้ที่อยู่ในหมวดอื่น (ผลผลิตดิบ) ก็มีปุ่มกินในการ์ดของมันเอง
    h += `<div class="sec">🎣 อุปกรณ์ (ความทนทาน)</div><div class="grid">` + Object.keys(DURABILITY).filter(t => t !== 'axe' || axeLevel() > 0).map(t => {
      const D = DURABILITY[t], tier = t === 'rod' ? rodLevel() : t === 'axe' ? axeLevel() : 1, fx = dur[t] ? dur[t][2] || 0 : 0, mx = durMax(t, tier, fx), cur = dur[t] ? dur[t][0] : mx, pct = Math.round(cur / mx * 100);
      const nm = t === 'rod' ? RODS[tier].name : t === 'axe' ? AXES[tier].name : D.name;
      return `<div class="card"><b>${{ hoe: '⛏️', water: '🫗', rod: '🎣', axe: '🪓' }[t]}</b>${nm}<br>${cur}/${mx}<br><small style="opacity:.7">ซ่อมแล้ว ${fx}/${REPAIR.maxFixes}${fx >= REPAIR.maxFixes ? ' (ซ่อมไม่ได้แล้ว)' : ''}</small><div class="hbar" style="height:6px"><i style="width:${pct}%;${pct <= 20 ? 'background:#e74c3c' : ''}"></i></div></div>`;
    }).join('') + `</div><p style="font-size:12px;opacity:.65">ซ่อมได้ที่ร้านของสายนั้น ซ่อมแต่ละครั้งความทนทานสูงสุดลด ${Math.round(REPAIR.decay * 100)}% และค่าซ่อมแพงขึ้น ซ่อมได้สูงสุด ${REPAIR.maxFixes} ครั้งแล้วต้องซื้อใหม่</p>`;
    if (!any) h += '<p style="opacity:.7">ยังไม่มีของ ลองปลูกผัก ตกปลา หรือเลี้ยงสัตว์ดูนะ</p>';
    el.innerHTML = h;
  } else if (bagTab === 'skills') {
    const nextCrop = () => Object.values(CROPS).filter(c => c.lv > lvl('farm')).sort((a, b) => a.lv - b.lv)[0];
    const nextFish = () => FISH.filter(f => f.lv > lvl('fish')).sort((a, b) => a.lv - b.lv)[0];
    const hints = {
      farm: () => { const c = nextCrop(); return (c ? `ถัดไป: ปลดล็อก ${c.emoji} ${c.name} ที่ Lv${c.lv}` : 'ปลดล็อกเมล็ดครบแล้ว') + ' • พืชโตเร็วขึ้น 4% ต่อเลเวล'; },
      fish: () => { const f = nextFish(); return (f ? `ถัดไป: ตกได้ ${f.emoji} ${f.name} ที่ Lv${f.lv}` : 'ตกปลาได้ครบทุกชนิดแล้ว') + ' • คันเบ็ดดีขึ้นซื้อที่ร้านตกปลา (Lv3, Lv6)'; },
      animal: () => `ซื้อวัวได้ที่ Lv${ANIMALS.cow.lv} • ซื้อหมูได้ที่ Lv${ANIMALS.pig.lv} • ผลผลิตออกเร็วขึ้น 5% ต่อเลเวล • สัตว์ป่วยรักษาด้วยยา 💊`,
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
function openShop(kind) { shopKind = kind; farmTab = 'gear'; if (kind === 'cloth') { tryWear = Object.assign({}, me.wear); clothTab = 'shirt'; } $('shop').classList.remove('hidden'); renderShop(); }
function closeShop() { shopKind = null; $('shop').classList.add('hidden'); }
$('shopClose').onclick = closeShop;
$('shop').addEventListener('pointerdown', e => { if (e.target === $('shop')) closeShop(); });
const animalCount = type => { let n = 0; animals.forEach(a => { if (a.type === type) n++; }); return n; };
let farmTab = 'gear';
const SHOP_TABS = { farm: [['gear', '🧰 อุปกรณ์'], ['seed', '🌱 เมล็ดพันธุ์']], fish: [['gear', '🎣 อุปกรณ์ตกปลา'], ['sell', '🐟 ขายปลา']] };
const seedProfit = k => { const c = CROPS[k.slice(5)]; return (c.sell - c.seed) / (c.time / 60000); };
function renderShop() {
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
  const isFarm = shopKind === 'farm', seedTab = isFarm && farmTab === 'seed', tabs = SHOP_TABS[shopKind], sellTab = shopKind === 'fish' && farmTab === 'sell';
  let h = tabs ? `<div class="tabs">${tabs.map(([c, n]) => `<button class="tab${farmTab === c ? ' on' : ''}" data-ftab="${c}">${n}</button>`).join('')}</div>` : '';
  h += sellTab ? '' : seedTab ? '<div class="sec">เมล็ดพันธุ์ (เรียงจากกำไรต่อนาทีดีที่สุด → แย่ที่สุด)</div>' : '<div class="sec">ซื้อ</div>';
  let keys = sellTab ? [] : isFarm ? sh.buy.filter(k => k.startsWith('seed_') === seedTab) : sh.buy;
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
  const showSell = sh.sell.length && (!tabs || seedTab || sellTab);
  const sellKeys = showSell ? Object.keys(inv).filter(k => shopSells(shopKind, k) && itemInfo(k) && itemInfo(k).sell) : [];
  if (showSell) h += '<div class="sec">ขาย (เลือกได้ว่าจะขายอะไร)</div>';
  if (showSell && !sellKeys.length) h += '<p style="opacity:.7;margin:6px 0">ยังไม่มีของที่ร้านนี้รับซื้อ</p>';
  for (const k of sellKeys) {
    const i = itemInfo(k), m = mult(k), unit = Math.max(1, Math.round(i.sell * m));
    const trend = (m > 1.03 ? `<span style="color:#1e8f4e">▲ ${Math.round((m - 1) * 100)}%</span>` : m < 0.97 ? `<span style="color:#c0392b">▼ ${Math.round((1 - m) * 100)}%</span>` : '') + (m < 0.5 ? ' <span style="color:#c0392b">⚠️ ตลาดอิ่มตัว รอราคากลับก่อนค่อยขาย</span>' : '');
    h += `<div class="row"><span>${i.emoji} ${i.name} ×${inv[k]}<br><small>ราคาตลาด 🪙${unit} (ปกติ ${i.sell}) ${trend}</small></span><span>`
      + `<button class="btn small" data-sell="${k}" data-n="1">ขาย 1</button> `
      + (inv[k] > 1 ? `<button class="btn small" data-sell="${k}" data-n="all">ทั้งหมด 🪙${sellQuote(i.sell, m, inv[k]).total}</button>` : '') + `</span></div>`;
  }
  if (showSell) h += '<p style="font-size:12px;opacity:.65;margin:8px 0 0">💡 ราคาขึ้นลงตามตลาด: ขายเยอะราคาจะตก ทิ้งไว้ราคาจะค่อยๆ กลับมา และมีข่าวราคาพุ่ง/ตกทุกวันในเกม</p>';
  if (shopKind === 'food') {
    h += '<div class="sec">👨‍🍳 ห้องครัว (ทำอาหารจากวัตถุดิบหลายสาย ขายได้แพงกว่าของดิบ)</div>';
    const have = c => Object.keys(inv).reduce((s, k) => s + (inv[k] > 0 && cookCat(c, k) ? inv[k] : 0), 0);
    for (const r of COOK) {
      const parts = r.in.map(n => { const emo = n.c ? COOK_CATS[n.c].emoji : itemInfo(n.k).emoji, nm = n.c ? COOK_CATS[n.c].name : itemInfo(n.k).name, got = n.c ? have(n.c) : (inv[n.k] || 0); return `${emo}${nm} ×${n.n}` + (got >= n.n ? '' : ` <small style="color:#c0392b">(มี ${got})</small>`); }).join(' + ');
      const ok = r.in.every(n => (n.c ? have(n.c) : (inv[n.k] || 0)) >= n.n);
      h += `<div class="row"><span>${r.emoji} ${r.name}<br><small>ใช้ ${parts} • ขายได้ราว 🪙${r.sell} • กินอิ่ม +${r.food}</small></span><span><button class="btn small" data-cook="${r.id}" ${ok ? '' : 'disabled'}>ทำ</button></span></div>`;
    }
    h += '<p style="font-size:12px;opacity:.65;margin:8px 0 0">💡 ปลา ผัก ไข่ มาจากคนละสายอาชีพ ลองแลกเปลี่ยนวัตถุดิบกับเพื่อน • อาหารที่ทำเองขายคืนได้ที่ร้านนี้ ('+'ใช้ชนิดวัตถุดิบที่ถูกที่สุดก่อน)</p>';
  }
  if (shopKind === 'food') h += '<p style="font-size:12px;opacity:.65;margin:8px 0 0">🍖 ความอิ่มลดลงเรื่อยๆ ขณะออนไลน์ ถึง 0 จะใช้เครื่องมือไม่ได้ • ผลผลิตของตัวเองก็กินได้ (อิ่มน้อยกว่า) ในกระเป๋า 🎒</p>';
  if (shopKind === 'furn') h += `<p style="font-size:12px;opacity:.65;margin:8px 0 0">🏠 ซื้อที่ดินได้ที่ป้าย "ที่ดินว่าง" แถวบนสุดของแมพ (🪙${HOUSING.price}) แล้วกดปุ่ม 🏠 เพื่อวางของ • เก้าอี้/โซฟานั่งได้ • โคมไฟสว่างตอนกลางคืน</p>`;
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
addEventListener('keydown', e => {
  if (!joined) return;
  if (chatFocus) {
    if (e.key === 'Enter') { const v = $('chatIn').value.trim(); if (v) send({ t: 'chat', text: v }); closeChat(); }
    else if (e.key === 'Escape') closeChat();
    return;
  }
  // ใช้ e.code (ตำแหน่งปุ่มจริงบนคีย์บอร์ด) ไม่ใช่ e.key เพื่อให้ WASD และปุ่มลัดทำงานได้แม้เปลี่ยนเป็นแป้นพิมพ์ภาษาไทย
  const c = e.code;
  if (c === 'Enter' || c === 'NumpadEnter') { e.preventDefault(); openChat(); return; }
  if (c === 'Escape') { closeShop(); closeBag(); closePeople(); closeArcade(); closeCinema(); closeTown(); closeAdmin(); closePlots(); $('ask').classList.add('hidden'); if (tradeSt) send({ t: 'trade', a: 'cancel' }); hidePicker(); return; }
  if (c === 'KeyP') { peopleShown() ? closePeople() : openPeople(); return; }
  if (c === 'KeyB' || c === 'KeyI') { $('bagBtn').onclick(); return; }
  if (c === 'KeyC') { $('statBtn').onclick(); return; }
  if (c === 'KeyH') { toggleBuild(); return; }
  if (c === 'KeyL') { if (inv.lamp > 0) $('lampBtn').onclick(); return; }
  if (c === 'KeyM') { setMini(miniState === 'off' ? 'small' : miniState === 'small' ? 'big' : 'off'); return; }
  const dg = /^(?:Digit|Numpad)([1-9])$/.exec(c);
  if (dg && +dg[1] <= SLOTS.length) { pickSlot(+dg[1] - 1); return; }
  if (c === 'Space') { e.preventDefault(); act(); return; }
  if (c.startsWith('Arrow')) e.preventDefault();
  keys[c] = true;
  mouse.active = false;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function openChat() { $('chatIn').classList.remove('hidden'); $('chatIn').focus(); chatFocus = true; renderChatHist(); $('chatHist').classList.remove('hidden'); $('chatLog').style.display = 'none'; for (const k in keys) keys[k] = false; }
function closeChat() { $('chatHist').classList.add('hidden'); $('chatLog').style.display = ''; $('chatIn').value = ''; $('chatIn').classList.add('hidden'); $('chatIn').blur(); chatFocus = false; }

// act() = ใช้กับช่องที่หันหน้าไป (Space / ปุ่ม A), act(tx,ty) = ใช้กับช่องที่คลิก/แตะ
const FISH_SHORE = 2; // ตกปลาต้องยืนห่างจากน้ำไม่เกิน 2 ช่อง แต่โยนเหยื่อไปไกลแค่ไหนก็ได้
const reachOf = () => (toolId() === 'rod' ? 999 : 2);
const nearWater = (x, y) => { for (let dy = -FISH_SHORE; dy <= FISH_SHORE; dy++) for (let dx = -FISH_SHORE; dx <= FISH_SHORE; dx++) if (MAP[y + dy] && MAP[y + dy][x + dx] === T.WATER) return true; return false; };
const myTile = () => [Math.floor(me.x / TS), Math.floor(me.y / TS)];
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const inReach = (tx, ty) => { const [px, py] = myTile(); return cheb(tx, ty, px, py) <= reachOf(); };
function act(tx, ty) {
  const now = performance.now();
  if (!me || chatFocus || modalOpen() || now - lastAct < 200) return;
  const o = { t: 'act', tool: toolId() }; if (o.tool === 'rod') o.bait = selBait;
  if (tx !== undefined) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return;
    if (!inReach(tx, ty)) { toast('ไกลเกินไป เดินเข้าไปใกล้ๆ ก่อน'); return; }
    const [px, py] = myTile(), dx = tx - px, dy = ty - py;
    if (dx || dy) me.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
    o.tx = tx; o.ty = ty;
  }
  lastAct = now; swing = 0.25;
  send(o);
}

// ---------- คลิก/แตะ: เดินไป หรือใช้งานช่องนั้น ----------
const solidTile = (tx, ty) => {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
  const t = MAP[ty][tx];
  return t === T.WATER || t === T.TREE || t === T.BUILD || t === T.FENCE || t === T.SHOP || t === T.FURN;
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
  const fu = furn.get(tx + ',' + ty); if (fu && FURN[fu.f].seat) return true; // แตะเก้าอี้/โซฟาเพื่อนั่ง
  if (f && f.c && f.s === 3) return true;
  if (id === 'hoe') return !!f || (t === T.GRASS && inFarm(tx, ty));
  if (id === 'water') return !!f || t === T.WATER;
  if (id.startsWith('seed_')) return !!f && !f.c;
  if (id === 'rod') return t === T.WATER;
  return false;
}
function stopWalk() { walk = null; }
function onTileClick(tx, ty) {
  if (!me || chatFocus || modalOpen() || tx < 0 || ty < 0 || tx >= W || ty >= H) return;
  if (houseClick(tx, ty)) { stopWalk(); return; }
  const [px, py] = myTile();
  if (interactive(tx, ty)) {
    if (inReach(tx, ty) && ((toolId() !== 'rod' && !(toolId() === 'water' && MAP[ty][tx] === T.WATER)) || nearWater(px, py))) { stopWalk(); act(tx, ty); return; }
    const rod = toolId() === 'rod' || (toolId() === 'water' && MAP[ty][tx] === T.WATER); // เดินเข้าไปใกล้พอแล้วค่อยทำให้เอง (เบ็ด: ริมสระไม่เกิน 2 ช่อง)
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

const mouse = { active: false, tx: 0, ty: 0 };
const tileAt = e => [Math.floor((camX + e.clientX * (canvas.width / innerWidth) / zoom) / TS), Math.floor((camY + e.clientY * (canvas.height / innerHeight) / zoom) / TS)];
canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || !me) return; mouse.active = true; [mouse.tx, mouse.ty] = tileAt(e); });
canvas.addEventListener('pointerleave', () => { mouse.active = false; });
canvas.addEventListener('pointerdown', e => {
  if (!me || (e.pointerType === 'mouse' && e.button !== 0)) return;
  hidePicker();
  const [tx, ty] = tileAt(e);
  if (e.pointerType === 'mouse') { mouse.active = true; mouse.tx = tx; mouse.ty = ty; }
  flash = { tx, ty, t: performance.now() }; // กะพริบช่องที่แตะ ให้เห็นเหมือนกันทั้ง PC และมือถือ
  onTileClick(tx, ty);
});
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
window.__mw = { peers, get npcs() { return npcs; }, get pets() { return pets; }, get drawPlayer() { return drawPlayer; }, get me() { return me; }, handle, send, setHour(h) { timeOffset = ((h - 6 + 24) % 24) / 24 * DAY_MS - (Date.now() % DAY_MS); } }; // สำหรับดีบัก
let micStream = null, micTrack = null, micOn = false, actx = null;

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
const attachMic = p => p.pc.getTransceivers().forEach(t => { if (t.sender) t.sender.replaceTrack(micOn ? micTrack : null).catch(() => {}); });
async function flushIce(p) { for (const c of p.pending.splice(0)) await p.pc.addIceCandidate(c).catch(() => {}); }
async function callPeer(id) {
  try {
    const p = getPeer(id);
    p.pc.addTransceiver('audio', { direction: 'sendrecv' });
    attachMic(p);
    await p.pc.setLocalDescription(await p.pc.createOffer());
    send({ t: 'rtc', to: id, d: { o: p.pc.localDescription } });
  } catch (e) { console.warn('call failed', e); }
}
async function onRtc(from, d) {
  try {
    const p = getPeer(from), pc = p.pc;
    if (d.o) {
      await pc.setRemoteDescription(d.o);
      pc.getTransceivers().forEach(t => { t.direction = 'sendrecv'; });
      attachMic(p);
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
    pe.audio.volume = pe.vol = isMuted(p) ? 0 : voiceGain(Math.hypot(p.x - me.x, p.y - me.y) / TS);
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
function setMicUi() { const b = $('micBtn'); b.classList.toggle('on', micOn); b.textContent = micOn ? '🎙️' : '🔇'; }
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
  const uno = t.game === 'uno', casino = t.game === 'bacc' || t.game === 'bj';
  const amPlayer = (uno || casino) ? t.players.some(p => p.id === myId && !p.out) : (t.xId === myId || t.oId === myId);
  if (m.open) { arcTable = t; unoWild = -1; openArcade(); return; }
  if (t.state === 'playing' && was !== 'playing' && amPlayer) { arcTable = t; unoWild = -1; openArcade(); toast(uno ? '🃏 เกม UNO เริ่มแล้ว!' : casino ? '🎰 โต๊ะเริ่มแล้ว วางเดิมพันได้เลย!' : '🎮 เกม XO เริ่มแล้ว!'); return; }
  if (arcTable && arcTable.id === t.id) { if (uno && t.cur !== myId) unoWild = -1; arcTable = t; if (arcOpenNow()) renderArcade(); }
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
    h += `<div class="sec">เปิดโต๊ะ (เล่นได้ 1-3 คน)</div><div class="chips">${[1, 2, 3].map(n => `<button class="chip${n === cMax ? ' sel' : ''}" data-cmax="${n}">${n === 1 ? 'เล่นคนเดียว' : n + ' คน'}</button>`).join('')}</div>`
      + `<button class="btn" data-arc="create" style="width:100%">${cMax === 1 ? '🎰 เล่นคนเดียวกับเจ้ามือ (ใช้เหรียญจริง)' : '🎰 เปิดโต๊ะ รอเพื่อน (' + cMax + ' คน)'}</button>`
      + `<button class="btn" data-arc="practice" style="width:100%;margin-top:8px;background:#8a6fd1;border-bottom-color:#5d47a1">🧪 ซ้อมเล่นคนเดียว (ไม่ใช้เหรียญ)</button>`
      + `<p style="font-size:12px;opacity:.7">${rules}<br>เดิมพันต่อรอบ ${bets.join(' / ')} เหรียญ • ผลเป็นการสุ่ม เล่นเพื่อความสนุก ไม่ควรเล่นนานติดต่อกัน 🙏</p>`;
  } else if (t.state === 'waiting') {
    h += `<div class="banner" style="background:#e9e0ff">⏳ รอผู้เล่น ${t.players.length}/${t.max}</div><div class="opps">${t.players.map(p => `<div class="opp">${p.id === t.hostId ? '👑 ' : ''}${esc(p.name)}</div>`).join('')}</div>`;
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
  const lobby = () => `<div class="sec">จำนวนผู้เล่น</div><div class="chips">${[2, 3, 4].map(n => `<button class="chip${n === arcMax ? ' sel' : ''}" data-max="${n}">${n} คน</button>`).join('')}</div>`
    + `<div class="sec">เลือกเดิมพัน (ต่อคน)</div><div class="chips">${BETS.map(b => `<button class="chip${b === arcBet ? ' sel' : ''}" data-bet="${b}" ${coin < b ? 'disabled' : ''}>${b ? '🪙 ' + b : 'ไม่เดิมพัน'}</button>`).join('')}</div>`
    + `<button class="btn" data-arc="create" style="width:100%">⚔️ สร้างห้อง UNO ${arcMax} คน${arcBet ? ' (เดิมพัน ' + arcBet + ')' : ''}</button>`
    + `<div class="sec">🤖 เดิมพันกับบอท <small>(ได้กำไรสุทธิไม่เกิน 🪙${BOTBET.dailyWinCap}/วัน • เสียได้ไม่จำกัด)</small></div><div class="chips">${BOTBET.bets.map(b => `<button class="chip${b === arcBotBet ? ' sel' : ''}" data-botbet="${b}" ${coin < b ? 'disabled' : ''}>${b ? '🪙 ' + b : 'ซ้อมฟรี'}</button>`).join('')}</div>`
    + `<button class="btn" data-arc="bot" style="width:100%;margin-top:8px;background:#8a6fd1;border-bottom-color:#5d47a1">🤖 เล่นกับบอท ${arcMax} คน${arcBotBet ? ' (เดิมพัน ' + arcBotBet + ')' : ' (ซ้อม ไม่เดิมพัน)'}</button>`
    + `<p style="font-size:12px;opacity:.7">คนแรกที่ไพ่หมดมือชนะ ได้เหรียญเดิมพันของทุกคน • ตาละ 30 วินาที หมดเวลาจะจั่วให้อัตโนมัติ (หมดเวลา 3 ครั้งติดถูกตัดออก) • ออกจากเกมกลางคัน = เสียเดิมพัน</p>`;
  if (t.state === 'idle') h += lobby();
  else if (t.state === 'waiting') {
    h += `<div class="banner" style="background:#e9e0ff">⏳ รอผู้เล่น ${t.players.length}/${t.max} • เดิมพัน ${t.bet ? '🪙 ' + t.bet : 'ไม่มี'} ต่อคน</div>`
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
  if (t.game === 'bacc' || t.game === 'bj') return renderCasino();
  const coin = inv.coin || 0;
  if (arcBet > coin) arcBet = [...BETS].reverse().find(b => b <= coin) || 0;
  if (arcBotBet > coin) arcBotBet = [...BOTBET.bets].reverse().find(b => b <= coin) || 0;
  const isHost = t.host && t.host.id === myId, player = t.xId === myId || t.oId === myId;
  const mySide = t.xId === myId ? 'X' : t.oId === myId ? 'O' : null;
  let h = `<div class="center" style="font-size:13px;opacity:.75">🪙 เหรียญของคุณ ${coin}</div>`;
  const lobby = () => `<div class="sec">เลือกเดิมพัน (ต่อฝ่าย)</div><div class="chips">${BETS.map(b => `<button class="chip${b === arcBet ? ' sel' : ''}" data-bet="${b}" ${coin < b ? 'disabled' : ''}>${b ? '🪙 ' + b : 'ไม่เดิมพัน'}</button>`).join('')}</div>`
    + `<button class="btn" data-arc="create" style="width:100%">⚔️ สร้างห้อง รอคู่แข่ง${arcBet ? ' (เดิมพัน ' + arcBet + ')' : ''}</button>`
    + `<div class="sec">🤖 เดิมพันกับบอท <small>(ได้กำไรสุทธิไม่เกิน 🪙${BOTBET.dailyWinCap}/วัน • เสียได้ไม่จำกัด)</small></div><div class="chips">${BOTBET.bets.map(b => `<button class="chip${b === arcBotBet ? ' sel' : ''}" data-botbet="${b}" ${coin < b ? 'disabled' : ''}>${b ? '🪙 ' + b : 'ซ้อมฟรี'}</button>`).join('')}</div>`
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
  rps: 'ชนะ 2 ใน 3 รอบ เลือกภายใน 10 วินาที เสมอเล่นรอบเดิมซ้ำ',
  react: 'ชนะ 2 ใน 3 รอบ กดทันทีที่เห็นสัญญาณสีเขียว ใครกดก่อนสัญญาณแพ้รอบนั้น',
  pok: 'แจกไพ่คนละ 2 ใบ ป๊อก 8/9 ชนะทันที ไม่งั้นเลือกจั่วเพิ่มหรืออยู่ แล้วเทียบแต้ม (ไพ่ A = 1, 10/J/Q/K = 0)',
  c4: 'หยอดเหรียญลงคอลัมน์ เรียง 4 ตัวติดกันให้ได้ก่อน ตาละ 30 วินาที',
};
const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
const pokCard = (c, back) => back ? '<span class="pcard back">🂠</span>' : `<span class="pcard ${c[0] === 'H' || c[0] === 'D' ? 'red' : ''}">${c.slice(1)}<small>${SUIT[c[0]]}</small></span>`;
function duelBody(t, mySide, player, myTurn) { // ส่วนกลางหน้าเกมของเป่ายิ้งฉุบ / ใครกดเร็วกว่า / ไพ่ป๊อก / Connect 4
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
  if (t.game === 'rps') {
    const ICON = { R: '✊', P: '✋', S: '✌️' };
    let h = `<div class="ulog">${esc(g.msg || '')}</div>`;
    if (g.phase === 'reveal' && g.reveal) h += `<div class="utable" style="font-size:54px"><span>${ICON[g.reveal.X]}</span><span style="font-size:22px">VS</span><span style="transform:scaleX(-1)">${ICON[g.reveal.O]}</span></div>`;
    else if (playing && player) h += g.mine ? `<div class="center" style="font-size:44px;margin:10px">${ICON[g.mine]}<br><span style="font-size:14px">เลือกแล้ว ⏳ รอคู่แข่ง</span></div>`
      : `<div class="colorpick">${['R', 'S', 'P'].map(c => `<button data-rps="${c}" style="background:#fff;font-size:34px;border-color:#8a6fd1">${ICON[c]}</button>`).join('')}</div><div class="center" style="font-size:12px">หิน ✊ • กรรไกร ✌️ • กระดาษ ✋</div>`;
    else if (!playing && g.reveal) h += `<div class="utable" style="font-size:40px"><span>${ICON[g.reveal.X]}</span><span style="font-size:18px">VS</span><span style="transform:scaleX(-1)">${ICON[g.reveal.O]}</span></div>`;
    return h;
  }
  if (t.game === 'react') {
    const ph = g.phase || 'wait', cls = ph === 'go' ? 'go' : ph === 'result' ? 'res' : 'wait';
    return `<div class="center" style="font-size:13px">รอบที่ ${g.round || 1} • ชนะ 2 ใน 3 รอบ</div><button class="pad ${cls}" data-press="1" ${player && playing ? '' : 'disabled'}>${ph === 'go' ? '⚡ กด!!' : ph === 'result' ? '🏁' : '🔴 รอสัญญาณ... อย่าเพิ่งกด!'}</button><div class="ulog">${esc(g.msg || '')}</div>`;
  }
  if (t.game === 'pok') {
    let h = '';
    if (g.reveal) {
      h += `<div class="sec center">ไพ่ของ ${esc(t.xName)} (${g.reveal.pts.X} แต้ม)</div><div class="center">${g.reveal.X.map(c => pokCard(c)).join('')}</div>`
        + `<div class="sec center">ไพ่ของ ${esc(t.oName)} (${g.reveal.pts.O} แต้ม)</div><div class="center">${g.reveal.O.map(c => pokCard(c)).join('')}</div>`;
    } else {
      h += `<div class="sec center">ไพ่ของคู่แข่ง</div><div class="center">${Array.from({ length: g.oppN || 2 }, () => pokCard('', true)).join('')}</div>`;
      if (g.mine) {
        const pts = g.mine.reduce((s, c) => s + (c[1] === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(c.slice(1)) ? 0 : +c.slice(1)), 0) % 10;
        h += `<div class="sec center">ไพ่ของคุณ • ${pts} แต้ม</div><div class="center">${g.mine.map(c => pokCard(c)).join('')}</div>`;
        const decided = g.decided && g.decided[mySide];
        h += playing ? (decided ? `<div class="center" style="margin-top:8px;font-weight:700">⏳ รอคู่แข่งตัดสินใจ...</div>`
          : `<div class="center" style="margin-top:10px;display:flex;gap:8px;justify-content:center"><button class="btn" data-pok="draw">🎴 จั่วเพิ่ม</button><button class="btn" data-pok="stay" style="background:#8a6fd1;border-bottom-color:#5d47a1">✋ อยู่</button></div>`) : '';
      }
    }
    return h;
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
function applyMute() { saveMute(); syncDeaf(); lastLevel = 0; updateSpeaking(performance.now() + 1000); updateOnline(); renderPeople(true); }
function renderPeople(force) {
  if (!peopleShown() || !me) return;
  const list = [...players.values()].sort((a, b) => (a === me ? -1 : b === me ? 1 : a.name.localeCompare(b.name)));
  const sig = JSON.stringify([mute, list.map(p => [p.id, p.name, p.color, p.voice, p.deaf])]);
  if (force || sig !== peopleSig) {
    peopleSig = sig;
    const others = list.filter(p => p !== me), talking = others.filter(p => p.voice).length, off = others.filter(isMuted).length;
    let h = `<div class="row"><span><b>🔊 เสียงเพื่อน</b><br><small>เปิดไมค์ ${talking} คน • ปิดเสียงไว้ ${off}/${others.length} คน</small></span>`
      + `<button class="btn small${mute.all ? ' muted' : ''}" data-all="1">${mute.all ? '🔇 เปิดเสียงทั้งหมด' : '🔊 ปิดเสียงทั้งหมด'}</button></div>`;
    for (const p of list) {
      const m = p !== me && isMuted(p);
      h += `<div class="row prow" data-id="${p.id}"><span><span class="dot" style="background:${esc(p.color)}"></span> <b>${esc(p.name)}</b>${p === me ? ' (คุณ)' : ''} ${p.voice ? '🎙️' : ''}${p.deaf ? ' 🔇' : ''}<span class="spk"></span></span>`
        + (p === me ? '' : `<span><button class="btn small" data-trade="${p.id}" title="ชวนเทรดของ (ต้องอยู่ใกล้กัน ${TRADE.range} ช่อง)">🤝 เทรด</button> <button class="btn small${m ? ' muted' : ''}" data-mute="${p.id}">${m ? '🔇 เปิดเสียง' : '🔊 ปิดเสียง'}</button></span>`) + '</div>';
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
  if (b.dataset.all) { mute.all = !mute.all; mute.names = {}; applyMute(); toast(mute.all ? '🔇 ปิดเสียงทั้งหมดแล้ว (เพื่อนจะเห็นไอคอน 🔇 ที่ตัวคุณ)' : '🔊 เปิดเสียงแล้ว'); return; }
  const p = players.get(+b.dataset.mute); if (!p) return;
  const key = p.name.toLowerCase(), now = isMuted(p);
  mute.names[key] = !now;
  if (mute.names[key] === mute.all) delete mute.names[key];
  applyMute();
});
$('online').onclick = () => (peopleShown() ? closePeople() : openPeople());
$('peopleClose').onclick = closePeople;
$('people').addEventListener('pointerdown', e => { if (e.target === $('people')) closePeople(); });
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
let zoom = 1, vw = 0, vh = 0, camX = 0, camY = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  zoom = Math.max(isTouch ? 1.35 : 1.2, Math.min(innerWidth / 720, innerHeight / 450)) * dpr;
  vw = canvas.width / zoom; vh = canvas.height / zoom;
}
addEventListener('resize', resize); resize();

const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const trees = [];
const GOODS = { furn: ['🛋️', '🪑'], farm: ['🥕', '🌽'], fish: ['🐟', '🎣'], animal: ['🥛', '🥚'], cloth: ['👕', '👖'], food: ['🍞', '🍜'], wood: ['🪵', '🪓'], vehicle: ['🚲', '🛵'] };
const FONT = '"Noto Sans Thai","Leelawadee UI",Tahoma,sans-serif';

// พื้นโลกวาดเป็นพิกเซลที่ครึ่งความละเอียด (16 px ต่อช่อง ดู pixelart.js) แล้วขยาย 2 เท่าตอนวาด
// ของตกแต่งเดิมวาดที่พิกัดเกมผ่าน g.scale(0.5) จึงกลายเป็นพิกเซลไปด้วย ส่วนตัวหนังสือ/อีโมจิไปอยู่ชั้น baseHi (ความละเอียดเต็ม) จะได้คมชัด
let baseHi;
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
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(bx + 4, by + 24, bw - 8, 8);
      g.fillStyle = '#6b4423'; g.fillRect(bx + 10, by + 6, 8, 26); g.fillRect(bx + bw - 18, by + 6, 8, 26);
      g.fillStyle = b.roof; g.fillRect(bx, by - 2, bw, 22); g.fillStyle = '#fff'; g.fillRect(bx + 3, by + 1, bw - 6, 16);
      g.fillStyle = b.roof; g.fillRect(bx + 5, by + 3, bw - 10, 12);
      gh.font = `bold 14px ${FONT}`; gh.fillStyle = '#fff'; gh.fillText(`${b.sign} ${b.name} ${b.sign}`, bx + bw / 2, by + 9.5);
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
  // ตู้เกม (เรียงเป็นรูปตัว U) + พื้นลานตู้เกมมีลวดลาย
  for (const cab of CABINETS) {
    const px = cab.x * TS, py = cab.y * TS;
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(px + 2, py + 28, 28, 5);
    g.fillStyle = cab.game ? '#2b2f55' : '#4a4a55'; g.fillRect(px + 3, py - 8, 26, 38);
    g.fillStyle = cab.game ? '#6a3fb5' : '#6b6b75'; g.fillRect(px + 3, py - 8, 26, 6);
    g.fillStyle = cab.game ? '#0c1a2e' : '#2d2d33'; g.fillRect(px + 7, py - 1, 18, 14);
    gh.fillStyle = cab.game ? '#7fd8ff' : '#777'; gh.font = 'bold 11px sans-serif'; gh.fillText(cab.game ? cab.label : '?', px + 16, py + 6);
    g.fillStyle = cab.game ? '#e74c3c' : '#666'; g.beginPath(); g.arc(px + 10, py + 21, 2.6, 0, 7); g.fill();
    g.fillStyle = cab.game ? '#f1c40f' : '#666'; g.beginPath(); g.arc(px + 22, py + 21, 2.6, 0, 7); g.fill();
    g.fillStyle = '#111'; g.fillRect(px + 12, py + 25, 8, 3);
  }
  // กระดานข่าวเมือง + ตู้เซฟกองกลาง (ขอบเหนือลานกองไฟ)
  // ตกแต่งคอกสัตว์ให้ดูสดใส (ภาพพื้นล้วนๆ ไม่ขวางทาง): บ่อเป็ด รังฟาง รางน้ำ กองฟาง แอ่งโคลนหมู ดอกไม้
  { const bale = (px, py) => { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(px + 2, py + 23, 28, 5); g.fillStyle = '#d9b44a'; g.fillRect(px + 3, py + 10, 26, 15); g.fillStyle = '#e8cd72'; g.fillRect(px + 3, py + 10, 26, 4); g.fillStyle = '#c29a32'; for (const dx of [9, 16, 23]) g.fillRect(px + dx, py + 10, 1.5, 15); };
    const trough = (px, py) => { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(px + 1, py + 24, 30, 4); g.fillStyle = '#8b5a2b'; g.fillRect(px + 1, py + 13, 30, 12); g.fillStyle = '#59b6ec'; g.fillRect(px + 4, py + 15, 24, 6); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(px + 7, py + 16, 8, 1.5); };
    const pond = (cx, cy, rx, ry) => { g.fillStyle = '#c9a869'; g.beginPath(); g.ellipse(cx, cy, rx + 3, ry + 3, 0, 0, 7); g.fill(); g.fillStyle = '#4aa3df'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill(); g.fillStyle = '#7cc4f0'; g.beginPath(); g.ellipse(cx - rx * 0.25, cy - ry * 0.25, rx * 0.5, ry * 0.3, 0, 0, 7); g.fill(); g.fillStyle = '#3f9a3a'; g.beginPath(); g.ellipse(cx + rx * 0.45, cy + ry * 0.2, 5, 3, 0, 0, 7); g.fill(); g.fillStyle = '#ff8fc7'; g.fillRect(cx + rx * 0.45 - 1, cy + ry * 0.2 - 2, 2.5, 2.5); };
    const nest = (px, py) => { g.fillStyle = '#e0bd5a'; g.beginPath(); g.ellipse(px + 16, py + 20, 14, 8, 0, 0, 7); g.fill(); g.fillStyle = '#c9a143'; g.beginPath(); g.ellipse(px + 16, py + 22, 10, 4, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; for (const ex of [-5, 1, 6]) { g.beginPath(); g.ellipse(px + 16 + ex, py + 19, 2.2, 3, 0, 0, 7); g.fill(); } };
    const YA = Shared.YARD, PA = Shared.PASTURE, PG = Shared.PIGPEN;
    pond((YA.x1 - 1) * TS, (YA.y1 - 0.4) * TS, TS * 1.25, TS * 0.8); nest(YA.x0 * TS, YA.y0 * TS); bale(YA.x1 * TS, YA.y0 * TS);
    trough(PA.x0 * TS + 4, PA.y1 * TS); trough((PA.x0 + 1) * TS + 8, PA.y1 * TS); bale(PA.x1 * TS, PA.y0 * TS); bale((PA.x1 - 1) * TS + 18, (PA.y0 + 1) * TS - 8);
    g.fillStyle = '#654225'; g.beginPath(); g.ellipse((PG.x1 - 1) * TS, (PG.y1 - 0.5) * TS, TS * 1.15, TS * 0.7, 0, 0, 7); g.fill(); g.fillStyle = '#7a5230'; g.beginPath(); g.ellipse((PG.x1 - 1) * TS - 4, (PG.y1 - 0.5) * TS - 3, TS * 0.8, TS * 0.4, 0, 0, 7); g.fill(); trough(PG.x0 * TS, PG.y0 * TS);
    for (const z of [YA, PA, PG]) for (let yy = z.y0; yy <= z.y1; yy++) for (let xx = z.x0; xx <= z.x1; xx++) if (hash(xx, yy, 21) < 0.2) { const fx = xx * TS + 4 + hash(xx, yy, 22) * 22, fy = yy * TS + 6 + hash(xx, yy, 23) * 20; g.fillStyle = ['#ffffff', '#ffd6e8', '#fff3a0', '#d6c2ff'][Math.floor(hash(xx, yy, 24) * 4)]; g.fillRect(fx - 2, fy, 2, 2); g.fillRect(fx + 2, fy, 2, 2); g.fillRect(fx, fy - 2, 2, 2); g.fillRect(fx, fy + 2, 2, 2); g.fillStyle = '#f1c40f'; g.fillRect(fx, fy, 2, 2); } }
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
  return oc;
}
const base = buildBase();

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
function drawFurn(o) {
  const d = FURN[o.f], px = o.x * TS, py = o.y * TS;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(px + 16, py + 27, 12, 4, 0, 0, 7); ctx.fill();
  ctx.font = `${d.size || 27}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
  PixelUI.world(ctx, d.emoji, px + 16, py + 17, d.size || 27);
}
function drawFire(now) {
  const px = FIRE.x * TS + 16, py = FIRE.y * TS + 22;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(px, py + 6, 20, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#777'; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; ctx.beginPath(); ctx.arc(px + Math.cos(a) * 15, py + 3 + Math.sin(a) * 6, 4, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#5a3a1c'; ctx.save(); ctx.translate(px, py + 2); ctx.rotate(0.5); ctx.fillRect(-12, -2, 24, 4); ctx.rotate(-1); ctx.fillRect(-12, -2, 24, 4); ctx.restore();
  const f = 1 + Math.sin(now / 90) * 0.12 + Math.sin(now / 53) * 0.08;
  ctx.fillStyle = '#e8541c'; ctx.beginPath(); ctx.moveTo(px - 9, py); ctx.quadraticCurveTo(px - 8, py - 14 * f, px, py - 24 * f); ctx.quadraticCurveTo(px + 8, py - 14 * f, px + 9, py); ctx.fill();
  ctx.fillStyle = '#ff9a2e'; ctx.beginPath(); ctx.moveTo(px - 6, py); ctx.quadraticCurveTo(px - 5, py - 10 * f, px, py - 17 * f); ctx.quadraticCurveTo(px + 5, py - 10 * f, px + 6, py); ctx.fill();
  ctx.fillStyle = '#ffe48a'; ctx.beginPath(); ctx.moveTo(px - 3, py); ctx.quadraticCurveTo(px - 3, py - 6 * f, px, py - 10 * f); ctx.quadraticCurveTo(px + 3, py - 6 * f, px + 3, py); ctx.fill();
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
  const sx = p.x + (p.dir === 2 ? -8 : p.dir === 3 ? 8 : 0), sy = p.y - 8;       // ปลายคันเบ็ด
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
function drawAnimalPx(type, c, now, top, prodE) {
  const x = c.x, y = c.y, moving = Math.hypot(c.tx - c.x, c.ty - c.y) > 2, sh = ANIMAL_SHADOW[type];
  ctx.fillStyle = 'rgba(38,40,16,.3)'; ctx.beginPath(); ctx.ellipse(x, y + sh[2], sh[0], sh[1], 0, 0, 7); ctx.fill();
  const ph = Math.sin(c.anim * (type === 'cow' ? 6 : 8));
  PixelUI.animal(ctx, type, c, { f: c.dx || 1, step: moving && ph > 0 ? 1 : 0, blink: blinkOf(c, now), prod: !!c.prod, hop: type === 'chicken' && moving ? Math.round(Math.abs(ph) * 2) : 0 });
  if (c.prod) PixelUI.world(ctx, prodE, x, y - top - 3 + Math.sin(now / 250) * 2, 14);
  else if (c.fed) PixelUI.world(ctx, '💗', x, y - top - 3, 14);
}
function drawDuck(c, now) { drawAnimalPx('duck', c, now, 14, '🥚'); }
function drawSheep(c, now) { drawAnimalPx('sheep', c, now, 22, '🧶'); }
const ANIMAL_DRAW = { duck: drawDuck, sheep: drawSheep }, ANIMAL_TOP = { chicken: 14, duck: 14, pig: 18, cow: 20, sheep: 20 };
function animalFx(c, now, top) { // หัวใจลอยตอนเพิ่งได้กินอาหาร / ความสุขเล็กๆ ตอนอิ่มดี / ประกายตอนมีผลผลิตพร้อมเก็บ
  const h = c.h === undefined ? 100 : c.h, t = now / 1000, ph = (t + (c.id || 0) * 3.7) % 9;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (c.happyAt && now - c.happyAt < 1800) { const k = (now - c.happyAt) / 1800; ctx.globalAlpha = 1 - k; for (let i = 0; i < 3; i++) PixelUI.world(ctx, '💗', c.x + (i - 1) * 9, c.y - top - k * 26 - i * 4 - 3, 11); ctx.globalAlpha = 1; }
  else if (!c.sick && h >= 80 && !c.prod && ph < 1.3) { const k = ph / 1.3; ctx.globalAlpha = 1 - k; PixelUI.world(ctx, '💕', c.x + Math.sin(t * 3) * 3, c.y - top - k * 14 - 3, 10); ctx.globalAlpha = 1; }
  if (c.prod) { const a = t * 2 + (c.id || 0); PixelUI.world(ctx, '✨', c.x + Math.cos(a) * 13, c.y - top * 0.5 + Math.sin(a) * 5, 11); }
}
function drawChicken(c, now) { drawAnimalPx('chicken', c, now, 14, '🥚'); }
function drawCow(c, now) { drawAnimalPx('cow', c, now, 20, '🥛'); }
function drawPig(c, now) { drawAnimalPx('pig', c, now, 18, '🍄'); }
function drawPet(q, now) { // แมว (นั่งเมื่อหยุด) และหมา 2 สี (ยืนกระดิกหางเมื่อหยุด)
  const type = q.kind === 'dog' ? 'dog' + (q.v || 0) : 'cat', cat = q.kind !== 'dog', idle = !q.moving;
  ctx.fillStyle = 'rgba(38,40,16,.3)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + (cat ? 6 : 7), cat ? 4 : 6, cat ? 1.6 : 2, 0, 0, 7); ctx.fill();
  const ph = Math.sin(q.anim * (cat ? 9 : 11)), wag = Math.floor(now / (cat ? 700 : 220)) % 2;
  PixelUI.animal(ctx, type, q, { f: q.dx || 1, step: idle ? wag : (ph > 0 ? 1 : 0), blink: blinkOf(q, now), idle });
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
function daylight(h) { // ความมืด 0..0.9 (กลางคืนมืดมาก มองเห็นเฉพาะรอบกองไฟ/ตะเกียง)
  const MAXD = 0.9;
  if (h >= 7 && h < 17.5) return 0;
  if (h >= 17.5 && h < 21) return (h - 17.5) / 3.5 * MAXD;
  if (h >= 21 || h < 4.5) return MAXD;
  return MAXD * (1 - (h - 4.5) / 2.5);
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
  hole(fx, fy, fr, 0.3);
  for (const p of players.values()) if (p.lamp) hole(p.x, p.y - 4, TS * 5, 0.82);
  for (const o of furn.values()) if (FURN[o.f].light) hole((o.x + 0.5) * TS, (o.y + 0.5) * TS, TS * 3.2, 0.6); // โคมไฟในบ้าน
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lightCv, 0, 0);
  // แสงอุ่นสีส้มบางๆ ซ้อนทับบริเวณที่สว่าง
  ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom); ctx.globalCompositeOperation = 'lighter';
  const warm = (x, y, r, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,150,50,${a})`); g.addColorStop(1, 'rgba(255,150,50,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  warm(fx, fy, fr * 0.8, 0.28 * Math.min(1, dark * 1.2)); for (const p of players.values()) if (p.lamp) warm(p.x, p.y - 4, TS * 5, 0.16 * Math.min(1, dark * 1.2));
  ctx.globalCompositeOperation = 'source-over'; ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------- Mini map (ย่อ/ขยาย/ซ่อนได้ ทั้ง PC และมือถือ) ----------
const miniBase = (() => {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const col = { [T.GRASS]: '#7bc65a', [T.WATER]: '#4aa3df', [T.TREE]: '#3f9a3a', [T.BUILD]: '#c9a86a', [T.PATH]: '#dcbf82', [T.FENCE]: '#8b5a2b', [T.SAND]: '#efdfa4', [T.SHOP]: '#a0692f', [T.FLOOR]: '#c99a5b', [T.FURN]: '#c99a5b' };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { g.fillStyle = (MAP[y][x] === T.GRASS && inFarm(x, y)) ? '#8bbf5a' : col[MAP[y][x]]; g.fillRect(x, y, 1, 1); }
  for (const b of BUILDINGS) { g.fillStyle = b.roof; g.fillRect(b.x0, b.y0, b.x1 - b.x0 + 1, 1); }
  return c;
})();
function layoutHud() { // วางแผนที่/แชทใต้แถบปุ่มด้านบน ไม่ให้ทับกันเมื่อปุ่มขึ้นบรรทัดใหม่
  const top = Math.round($('hudTop').getBoundingClientRect().bottom + 6);
  $('mini').style.top = top + 'px'; $('guide').style.top = top + 'px';
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
function drawMini(now) {
  if (miniState === 'off' || now - lastMini < 90) return;
  lastMini = now;
  const cv = $('miniMap'), g = cv.getContext('2d'), cw = cv.width, ch = cv.height, sx = cw / W, sy = ch / H, k = cw / parseFloat(cv.style.width), big = miniState === 'big';
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false; g.drawImage(miniBase, 0, 0, cw, ch);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${Math.round((big ? 15 : 11) * k)}px sans-serif`;
  for (const b of BUILDINGS) g.fillText(b.sign, (b.x0 + b.x1 + 1) / 2 * sx, (b.y0 + b.y1 + 1) / 2 * sy + 2 * k);
  g.fillText('🌾', 14 * sx, 12.5 * sy); g.fillText('🐄', 54 * sx, 21 * sy); g.fillText('🌊', 43 * sx, 38 * sy); g.fillText('🐖', 59.5 * sx, 11.5 * sy); g.fillText('🔥', FIRE.x * sx + sx / 2, FIRE.y * sy + sy / 2);
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
function step(now) {
  requestAnimationFrame(step);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!joined || !me) return;
  const wall = Date.now() + timeOffset;

  // เดิน: คีย์บอร์ด/จอยสติ๊ก (ยกเลิกการเดินจากคลิก) หรือเดินตามเส้นทางที่คลิกไว้
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  let iy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
  if (chatFocus || modalOpen()) { ix = iy = 0; walk = null; }
  let mag = Math.hypot(ix, iy);
  if (mag > 0.1) walk = null;
  else if (walk) {
    const wp = walk.pts[0];
    if (!wp) { const a = walk.act; walk = null; if (a) act(a.tx, a.ty); }
    else {
      const dx = wp[0] * TS + 16 - me.x, dy = wp[1] * TS + 16 - me.y, d = Math.hypot(dx, dy);
      if (d < 3) walk.pts.shift(); else { ix = dx / d; iy = dy / d; mag = 1; }
    }
  }
  me.moving = mag > 0.1;
  if (me.moving) {
    if (mag > 1) { ix /= mag; iy /= mag; }
    const sp = 110 * dt * (hunger <= 0 ? 0.5 : hunger <= 15 ? 0.8 : 1) * (buffOn('speed') ? 1.1 : 1), ox = me.x, oy = me.y; // หิวมากจะเดินช้าลง
    if (!blockedAt(MAP, me.x + ix * sp, me.y)) me.x += ix * sp;
    if (!blockedAt(MAP, me.x, me.y + iy * sp)) me.y += iy * sp;
    me.dir = Math.abs(ix) > Math.abs(iy) ? (ix < 0 ? 2 : 3) : (iy < 0 ? 1 : 0);
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
  for (const n of npcs.values()) { const dx = n.tx - n.x, dy = n.ty - n.y; n.moving = Math.hypot(dx, dy) > 1; n.x += dx * Math.min(1, dt * 12); n.y += dy * Math.min(1, dt * 12); if (n.moving) n.anim += dt; }
  for (const q of pets.values()) { const dx = q.tx - q.x, dy = q.ty - q.y; q.moving = q.srvMoving || Math.hypot(dx, dy) > 1.5; q.x += dx * Math.min(1, dt * 8); q.y += dy * Math.min(1, dt * 8); if (q.moving) q.anim += dt; }
  for (const c of animals.values()) { c.x += (c.tx - c.x) * Math.min(1, dt * 8); c.y += (c.ty - c.y) * Math.min(1, dt * 8); c.anim += dt; }
  swing = Math.max(0, swing - dt);
  updateSpeaking(now);

  // กล้อง
  const mw = W * TS, mh = H * TS;
  camX = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, me.x - vw / 2));
  camY = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, me.y - vh / 2));
  camX = Math.round(camX); camY = Math.round(camY);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#2d4a2b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0, W * TS, H * TS);
  ctx.drawImage(baseHi, 0, 0);

  const x0 = Math.max(0, Math.floor(camX / TS)), x1 = Math.min(W - 1, Math.ceil((camX + vw) / TS));
  const y0 = Math.max(0, Math.floor(camY / TS)), y1 = Math.min(H - 1, Math.ceil((camY + vh) / TS));
  // น้ำเคลื่อนไหว: ประกายแสงเป็นขีดพิกเซล (ตรงกับตาราง 2 px) กะพริบไม่พร้อมกัน
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (MAP[y][x] === T.WATER) for (let i = 0; i < 2; i++) {
    const v = Math.sin(now / 520 + hash(x, y, i) * 40);
    if (v < 0.5) continue;
    ctx.fillStyle = v > 0.85 ? '#e4f4ff' : '#9fd0f0';
    ctx.fillRect(x * TS + 2 + Math.floor(hash(x, y, i + 3) * 11) * 2, y * TS + 4 + Math.floor(hash(x, y, i + 6) * 12) * 2, 4 + (i ? 2 : 0), 2);
  }
  // ช่องฟาร์ม
  for (const k in farm) {
    const [fx, fy] = k.split(',').map(Number);
    if (fx < x0 || fx > x1 || fy < y0 || fy > y1) continue;
    drawCrop(farm[k], fx * TS, fy * TS, now);
  }
  // พรมปูพื้นในบ้าน (อยู่ใต้ทุกอย่าง)
  for (const o of furn.values()) if (FURN[o.f].flat && o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1) {
    const px = o.x * TS, py = o.y * TS;
    ctx.fillStyle = '#a8322a'; ctx.fillRect(px + 2, py + 3, TS - 4, TS - 6);
    ctx.fillStyle = '#e8c66a'; ctx.fillRect(px + 5, py + 6, TS - 10, TS - 12);
    ctx.fillStyle = '#c0453a'; ctx.fillRect(px + 8, py + 9, TS - 16, TS - 18);
  }
  // จุดหมายที่คลิกให้เดิน
  if (walk && walk.dest) {
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(walk.dest[0] * TS + 16, walk.dest[1] * TS + 16, 6 + Math.sin(now / 150) * 2, 0, 7); ctx.stroke();
  }
  // ช่องที่ชี้/หันหน้าไป
  let tx, ty, col = 'rgba(255,255,255,.8)';
  if (mouse.active && !isTouch) {
    tx = mouse.tx; ty = mouse.ty;
    if (tx >= 0 && ty >= 0 && tx < W && ty < H) {
      if (interactive(tx, ty)) col = inReach(tx, ty) ? 'rgba(255,255,255,.9)' : 'rgba(255,215,90,.95)';
      else col = solidTile(tx, ty) ? 'rgba(255,255,255,.3)' : 'rgba(140,200,255,.9)';
    }
  } else[tx, ty] = facing(me.x, me.y, me.dir);
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.strokeRect(tx * TS + 2, ty * TS + 2, TS - 4, TS - 4);
  if (mouse.active) { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(tx * TS + 2, ty * TS + 2, TS - 4, TS - 4); }
  if (flash && now - flash.t < 450) { // แตะ/คลิกที่ช่องไหน ช่องนั้นจะกะพริบ (เหมือนกันทั้ง PC และมือถือ)
    const a = 1 - (now - flash.t) / 450;
    ctx.fillStyle = `rgba(255,255,255,${0.35 * a})`; ctx.fillRect(flash.tx * TS, flash.ty * TS, TS, TS);
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 3; ctx.strokeRect(flash.tx * TS + 1, flash.ty * TS + 1, TS - 2, TS - 2);
  }

  drawButterflies(now);
  // วาดตามลำดับ y
  const list = [];
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1 + 2); y++) for (let x = Math.max(0, x0 - 1); x <= Math.min(W - 1, x1 + 1); x++) if (MAP[y][x] === T.TREE) list.push({ y: y * TS + 30, f: () => drawTree(x, y) });
  for (const b of BUILDINGS) if (b.kind !== 'sign' && b.kind !== 'cinema' && b.x1 >= x0 - 1 && b.x0 <= x1 + 1 && b.y1 >= y0 - 1 && b.y0 <= y1 + 2) list.push({ y: (b.y1 + 1) * TS - 2, f: () => drawBuilding(b) });
  // กองไฟ + ที่นั่งในลานกลางหมู่บ้าน (ที่นั่งไม่ใช่สิ่งกีดขวาง วาดอยู่ใต้ตัวละคร)
  for (const s of SEATS) if (s.x >= x0 - 1 && s.x <= x1 + 1 && s.y >= y0 - 1 && s.y <= y1 + 1) list.push({ y: s.y * TS + 12, f: () => drawSeat(s) });
  if (FIRE.x >= x0 - 1 && FIRE.x <= x1 + 1 && FIRE.y >= y0 - 1 && FIRE.y <= y1 + 1) list.push({ y: FIRE.y * TS + 28, f: () => drawFire(now) });
  for (const o of furn.values()) {
    const d = FURN[o.f]; if (d.flat || o.x < x0 - 1 || o.x > x1 + 1 || o.y < y0 - 1 || o.y > y1 + 1) continue;
    list.push({ y: o.y * TS + (d.seat ? 12 : 28), f: () => drawFurn(o) });
  }
  for (const c of animals.values()) list.push({ y: c.y + 8, f: () => { (c.type === 'cow' ? drawCow : c.type === 'pig' ? drawPig : ANIMAL_DRAW[c.type] || drawChicken)(c, now); animalFx(c, now, ANIMAL_TOP[c.type] || 14); hungerMark(c, now); } });
  for (const q of pets.values()) list.push({ y: q.y + 8, f: () => drawPet(q, now) });
  for (const p of players.values()) list.push({ y: p.y + 12, f: () => drawPlayer(p, now) });
  for (const n of npcs.values()) if (n.x > camX - 40 && n.x < camX + vw + 40 && n.y > camY - 60 && n.y < camY + vh + 60) list.push({ y: n.y + 12, f: () => drawPlayer(n, now) });
  list.sort((a, b) => a.y - b.y).forEach(o => o.f());

  // ป้ายหน้าที่ดิน: ที่ดินว่าง (ซื้อได้) หรือบ้านของใคร
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold 11px ${FONT}`;
  HOUSING.plots.forEach((px0, i) => {
    if (px0 + HOUSING.w < x0 || px0 > x1 || HOUSING.y0 - 1 < y0 - 1 || HOUSING.y0 - 1 > y1) return;
    const owner = plotOwners[i], mineP = owner && me && owner === me.name;
    const txt = owner ? `🏠 บ้านของ ${owner}` : `🏷️ ที่ดินว่าง 🪙${HOUSING.price}`;
    const w = ctx.measureText(txt).width + 12, cx = (px0 + HOUSING.w / 2) * TS, cy = (HOUSING.y0 - 1) * TS + 16;
    ctx.fillStyle = mineP ? 'rgba(46,160,90,.92)' : owner ? 'rgba(0,0,0,.55)' : 'rgba(214,140,30,.92)'; ctx.fillRect(cx - w / 2, cy - 9, w, 18);
    ctx.fillStyle = '#fff'; ctx.fillText(txt, cx, cy);
  });
  // โรงหนัง: ป้ายสถานะใต้จอ + 🍿 เหนือหัวคนที่กำลังดู
  if (cin) {
    const mv = cin.movie ? { name: cin.name } : null, txt = mv ? `▶ ${mv.name} • 🍿 ${cin.viewers.length} คน` : '🎬 ว่าง กดที่จอเพื่อฉายหนัง';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold 11px ${FONT}`;
    const w = ctx.measureText(txt).width + 12, cx = 17 * TS, cy = 35 * TS - 4;
    ctx.fillStyle = mv ? 'rgba(160,30,30,.85)' : 'rgba(0,0,0,.6)'; ctx.fillRect(cx - w / 2, cy - 9, w, 18);
    ctx.fillStyle = '#fff'; ctx.fillText(txt, cx, cy);
    for (const id of cin.viewers) { const p = players.get(id); if (p) { ctx.font = '14px sans-serif'; ctx.fillText('🍿', p.x + 14, p.y - 34); } }
  }
  // ป้ายสถานะเหนือตู้เกม (ว่าง / รอคู่ / กำลังเล่น)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold 10px ${FONT}`;
  CABINETS.forEach((c, i) => {
    if (!c.game || c.x < x0 - 1 || c.x > x1 + 1 || c.y < y0 - 1 || c.y > y1 + 1) return;
    const s = arcStatus[i]; if (!s) return;
    const uno = ['uno', 'bacc', 'bj'].includes(s[7]);
    const txt = s[2] === 'waiting' ? `⏳ ${s[4]}${uno ? ' ' + s[5] : ''}${s[3] ? ' 🪙' + s[3] : ''}` : s[2] === 'playing' ? (uno ? `${s[7] === 'uno' ? '🃏 กำลังเล่น' : '🎰 เล่นอยู่'} ${s[5]}` : `⚔️ ${s[4]} vs ${s[5]}`) : s[2] === 'over' ? '🏁 จบเกม' : '🎮 ว่าง';
    const w = ctx.measureText(txt).width + 10, cx = c.x * TS + 16, cy = c.y * TS - 16;
    ctx.fillStyle = s[2] === 'idle' ? 'rgba(0,0,0,.45)' : 'rgba(138,111,209,.92)'; ctx.fillRect(cx - w / 2, cy - 7, w, 14);
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
  if (swing > 0) { const d = DIRS[me.dir]; PixelUI.world(ctx, slotInfo(slot).e, me.x + d[0] * 16, me.y + d[1] * 14 - 2 + (0.25 - swing) * 10, 18); }

  // กลางวัน/กลางคืน
  const hour = ((wall % DAY_MS) / DAY_MS * 24 + 6) % 24;
  const dark = daylight(hour);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawNight(dark, now);
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  const icon = dark > 0.45 ? '🌙' : hour < 8 || hour >= 17 ? '🌅' : '☀️';
  const txt = `${icon} ${String(hh).padStart(2, '0')}:${String(mm - mm % 10).padStart(2, '0')}`;
  if ($('clock').textContent !== txt) $('clock').textContent = txt;
  drawMini(now);
}
requestAnimationFrame(step);
})();
