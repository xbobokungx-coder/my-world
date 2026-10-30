// โค้ดที่ใช้ร่วมกันระหว่างเซิร์ฟเวอร์และเบราว์เซอร์ (แมพ, ข้อมูลพืช/ปลา/สัตว์/ร้าน, เลเวล, การชน)
(function (root) {
  const TS = 32, W = 64, H = 46;
  const T = { GRASS: 0, WATER: 1, TREE: 2, BUILD: 3, PATH: 4, FENCE: 5, SAND: 6, SHOP: 7, FLOOR: 8, FURN: 9, BRIDGE: 10, LANDMARK: 11, WALL: 12, VOID: 13, CLIFF: 14, STAIR: 15, CAVE: 16, ROCK: 17, ORE: 18, MOUTH: 19, DOWN: 20 };
  // ชนิดพื้นที่ผู้ดูแลวาดแก้แมพได้ (ไม่รวม FLOOR/FURN/WALL/VOID ของบ้าน)
  const MAP_PAINT = [
    { t: T.GRASS, name: 'หญ้า', col: '#7bc65a' }, { t: T.PATH, name: 'ทาง', col: '#dcbf82' },
    { t: T.WATER, name: 'น้ำ', col: '#4ab8cc' }, { t: T.SAND, name: 'ทราย', col: '#efdfa4' },
    { t: T.TREE, name: 'ต้นไม้', col: '#3f9a3a' }, { t: T.FENCE, name: 'รั้ว', col: '#8b5a2b' },
    { t: T.BUILD, name: 'สิ่งก่อสร้าง', col: '#a0692f' }, { t: T.SHOP, name: 'เคาน์เตอร์', col: '#c9894a' },
    { t: T.BRIDGE, name: 'สะพาน', col: '#b8956a' }, { t: T.LANDMARK, name: 'แลนด์มาร์ก', col: '#9b7bb8' },
    { t: T.CLIFF, name: 'หน้าผา', col: '#8a7a6a' }, { t: T.STAIR, name: 'บันได', col: '#c9a56a' },
  ];
  const MOCK_MAX = 120, MOCK_LABEL = 24;
  const sanitizeMocks = list => {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const m of list.slice(0, MOCK_MAX)) {
      if (!m || typeof m !== 'object') continue;
      const x = Math.trunc(+m.x), y = Math.trunc(+m.y), w = Math.trunc(+m.w) || 1, h = Math.trunc(+m.h) || 1;
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= W || y >= H) continue;
      const ww = Math.max(1, Math.min(16, w)), hh = Math.max(1, Math.min(16, h));
      if (x + ww > W || y + hh > H) continue;
      const id = String(m.id || '').slice(0, 24) || ('m' + out.length);
      const label = String(m.label || 'Mock').slice(0, MOCK_LABEL);
      const color = /^#[0-9a-fA-F]{6}$/.test(m.color) ? m.color : '#ffd24a';
      out.push({ id, x, y, w: ww, h: hh, label, color });
    }
    return out;
  };
  const sanitizeMapOv = obj => {
    if (!obj || typeof obj !== 'object') return {};
    const out = {}, ok = new Set(MAP_PAINT.map(p => p.t));
    for (const [k, v] of Object.entries(obj)) {
      const [xs, ys] = String(k).split(','), x = +xs, y = +ys, t = Math.trunc(+v);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= W || y >= H) continue;
      if (!ok.has(t)) continue;
      out[x + ',' + y] = t;
    }
    return out;
  };
  // บ้าน (ระบบเดิม): ที่ดิน 6 แปลงแถวบนสุดของแมพ ตอนนี้เลิกใช้แล้ว เหลือไว้ให้ server ย้ายข้อมูลเก่าเข้าบ้านหลังใหญ่ (ดู HOUSE ด้านล่าง)
  const HOUSING = { price: 400, refund: 0.7, y0: 2, y1: 5, w: 6, plots: [2, 9, 16, 23, 30, 37] };
  const plotAt = (tx, ty) => {
    if (ty < HOUSING.y0 || ty > HOUSING.y1) return -1;
    for (let i = 0; i < HOUSING.plots.length; i++) if (tx >= HOUSING.plots[i] && tx < HOUSING.plots[i] + HOUSING.w) return i;
    return -1;
  };
  // บ้านหลังใหญ่ของทุกคน: แมพแยก (ฉาก) ใช้พิกัดช่วงเดียวกับแมพเมือง กรอบนอกรวมผนัง: ผนังบน 2 แถว ผนังซ้าย/ขวา/ล่าง 1 ช่อง ประตูอยู่ผนังล่าง
  const HOUSE_DOOR = { x: 29, y: 15 };                          // ประตูบ้านหลังใหญ่ในเมือง: เดินเข้ามายืนที่ช่องนี้ = เลือกเข้าบ้านตัวเอง/บ้านเพื่อน
  const HOUSE_BLD = { x0: 26, y0: 11, x1: 32, y1: 14 };        // ตัวบ้านในเมือง (ช่องตัน) อยู่เหนือประตู
  const HOUSE = { x0: 20, y0: 14, x1: 43, y1: 31, door: [31, 32] };
  const houseInside = (x, y) => x > HOUSE.x0 && x < HOUSE.x1 && y >= HOUSE.y0 + 2 && y < HOUSE.y1; // ช่องพื้นที่วางของได้
  const houseKeep = (x, y) => y === HOUSE.y1 - 1 && HOUSE.door.includes(x); // ช่องหน้าประตู เว้นว่างไว้ ไม่ให้วางของปิดทางออก
  const HOUSE_SPAWN = { x: HOUSE.door[1] * 32, y: (HOUSE.y1 - 0.5) * 32 };  // จุดเกิดตอนเข้าบ้าน (กลางประตู ด้านใน)
  function makeHouseMap() {
    const m = Array.from({ length: H }, () => new Array(W).fill(T.VOID));
    for (let y = HOUSE.y0; y <= HOUSE.y1; y++) for (let x = HOUSE.x0; x <= HOUSE.x1; x++) m[y][x] = houseInside(x, y) ? T.FLOOR : T.WALL;
    for (const x of HOUSE.door) m[HOUSE.y1][x] = T.PATH; // ช่องประตู เดินออกได้
    return m;
  }
  const houseScore = items => { let value = 0, count = 0; for (const it of Object.values(items)) if (it && FURN[it.f]) { value += FURN[it.f].price; count++; } return { value, count }; }; // คะแนนลีดเดอร์บอร์ด: มูลค่า (ตามราคาร้าน) และจำนวนชิ้น
  // ตกแต่งอิสระ: ชิ้นหนึ่ง = { f, x, y, r, z, on, wl, u } พิกัด x,y เป็นหน่วยช่อง (จุดกึ่งกลางฐาน) r=1 หมุน (สลับกว้าง/ลึก) z=ความสูงที่วางบนของอื่น on=id ของที่รองรับ
  // ของติดผนัง: wl='n' (ผนังหลังขวา, y คงที่) หรือ 'w' (ผนังหลังซ้าย, x คงที่) u=ตำแหน่งตามแนวผนัง
  const HFLOOR = { x0: HOUSE.x0 + 1, y0: HOUSE.y0 + 2, x1: HOUSE.x1, y1: HOUSE.y1 };            // พื้นบ้านหน่วยช่อง [x0,x1) × [y0,y1)
  const HKEEP = { x0: HOUSE.door[0] - 0.25, y0: HOUSE.y1 - 1.5, x1: HOUSE.door[1] + 1.25, y1: HOUSE.y1 }; // หน้าประตู ห้ามวางของตัน
  const HOUSE_MAX_ITEMS = 300, SNAP = 4;                                                        // ชิ้นสูงสุดต่อบ้าน • ละเอียด 1/4 ช่อง
  const snapQ = v => Math.round(v * SNAP) / SNAP;
  const furnDims = (f, r) => { const d = FURN[f], w = d.w || 1, dd = d.d || 1; return r ? [dd, w] : [w, dd]; };
  const furnRect = it => { const [w, d] = furnDims(it.f, it.r); return { x0: it.x - w / 2, y0: it.y - d / 2, x1: it.x + w / 2, y1: it.y + d / 2 }; };
  const rectOvl = (a, b, e = 0.04) => a.x0 < b.x1 - e && a.x1 > b.x0 + e && a.y0 < b.y1 - e && a.y1 > b.y0 + e;
  const rectHas = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  const isFloorItem = it => { const d = FURN[it.f]; return !d.wall; };
  function houseSolidRects(items) { // กล่องชนของเฟอร์นิเจอร์ตัน (หน่วยพิกเซล) ไว้ใช้ตอนเดิน: เฉพาะชิ้นที่อยู่บนพื้น
    const out = [];
    for (const it of Object.values(items)) { const d = FURN[it.f]; if (!d || !d.solid || d.wall || d.flat || it.z > 0) continue; const r = furnRect(it); out.push({ x0: r.x0 * TS, y0: r.y0 * TS, x1: r.x1 * TS, y1: r.y1 * TS }); }
    return out;
  }
  function houseBlockedAt(map, rects, x, y, fx, fy) { // เดินชนผนัง/ขอบบ้าน หรือเฟอร์นิเจอร์ตัวไหนไหม (ตัวละครกว้าง 16 px) • fx,fy = ตำแหน่งก่อนเดิน: ถ้าเดิมอยู่ในกล่องของชิ้นนั้นอยู่แล้ว (เช่นเพิ่งลุกจากเก้าอี้) ให้เดินออกได้
    if (blockedAt(map, x, y)) return true;
    const r = 8, hit = (b, px, py) => px + r > b.x0 + 1 && px - r < b.x1 - 1 && py + r > b.y0 + 1 && py - r < b.y1 - 1;
    for (const b of rects) if (hit(b, x, y) && !(fx !== undefined && hit(b, fx, fy))) return true;
    return false;
  }
  function houseTopAt(items, x, y, selfId) { // ชิ้นที่วางของบนหลังได้ (top) และจุด x,y อยู่บนหลังมัน: เอาตัวที่สูงสุด
    let best = null;
    for (const [id, it] of Object.entries(items)) { if (+id === selfId) continue; const d = FURN[it.f]; if (!d || !d.top || it.z > 0) continue; if (rectHas(furnRect(it), x, y) && (!best || d.h > best.h)) best = { id: +id, h: d.h || 20 }; }
    return best;
  }
  // ตรวจว่าวางชิ้น f ที่ (x,y) ได้ไหม (ใช้ทั้งเซิร์ฟเวอร์และเว็บ) opts: selfId (ตอนย้าย) wl,u (ของติดผนัง) mates (ตัวละครที่ยืนอยู่ {x,y} พิกเซล)
  function houseCheck(items, f, x, y, r, opts = {}) {
    const d = FURN[f]; if (!d) return { ok: false, why: 'ไม่รู้จักของชิ้นนี้' };
    const self = opts.selfId;
    if (d.wall) {
      const wl = opts.wl === 'w' ? 'w' : 'n', u = Number(opts.u);
      if (!Number.isFinite(u)) return { ok: false, why: 'แตะที่ผนังเพื่อติดของ' };
      const half = (d.w || 1) / 2, lo = wl === 'n' ? HFLOOR.x0 : HFLOOR.y0, hi = wl === 'n' ? HFLOOR.x1 : HFLOOR.y1;
      if (u - half < lo - 1e-6 || u + half > hi + 1e-6) return { ok: false, why: 'ติดผนังตรงนี้ไม่ได้ (เกินขอบผนัง)' };
      for (const [id, it] of Object.entries(items)) { if (+id === self || !FURN[it.f].wall || it.wl !== wl) continue; if (Math.abs(it.u - u) < half + (FURN[it.f].w || 1) / 2 - 0.04) return { ok: false, why: 'มีของติดผนังอยู่แล้วตรงนี้' }; }
      return { ok: true, z: 0, on: null, wl, u, x: wl === 'n' ? u : HFLOOR.x0, y: wl === 'n' ? HFLOOR.y0 : u };
    }
    const [w, dd] = furnDims(f, r), rect = { x0: x - w / 2, y0: y - dd / 2, x1: x + w / 2, y1: y + dd / 2 };
    if (rect.x0 < HFLOOR.x0 - 1e-6 || rect.y0 < HFLOOR.y0 - 1e-6 || rect.x1 > HFLOOR.x1 + 1e-6 || rect.y1 > HFLOOR.y1 + 1e-6) return { ok: false, why: 'วางนอกพื้นบ้านไม่ได้' };
    if (d.flat) return { ok: true, z: 0, on: null };
    if (d.solid && rectOvl(rect, HKEEP, 0)) return { ok: false, why: 'เว้นทางหน้าประตูไว้ วางตรงนี้ไม่ได้' };
    let z = 0, on = null;
    if (d.small) { const t = houseTopAt(items, x, y, self); if (t) { z = t.h; on = t.id; } }
    if (d.solid && !on) {
      for (const [id, it] of Object.entries(items)) { if (+id === self) continue; const o = FURN[it.f]; if (!o.solid || o.wall || o.flat || it.z > 0) continue; if (rectOvl(rect, furnRect(it))) return { ok: false, why: 'ชนกับของอื่น วางตรงนี้ไม่ได้' }; }
      for (const m of opts.mates || []) if (m.x + 8 > rect.x0 * TS && m.x - 8 < rect.x1 * TS && m.y + 8 > rect.y0 * TS && m.y - 8 < rect.y1 * TS) return { ok: false, why: 'มีคนยืนอยู่ตรงนั้น วางไม่ได้' };
    }
    return { ok: true, z, on };
  }
  const plotSignAt = (tx, ty) => ty === HOUSING.y0 - 1 ? plotAt(tx, HOUSING.y0) : -1; // ป้ายหน้าที่ดิน (แถวเหนือพื้นไม้)
  // เฟอร์นิเจอร์: solid = เดินผ่านไม่ได้, seat = นั่งได้, flat = พรมปูพื้น, light = ให้แสงตอนกลางคืน
  const FURN_SELL = 0.35; // ร้านเฟอร์นิเจอร์รับซื้อคืนกี่เปอร์เซ็นต์ของราคาซื้อ (ตั้งต่ำไว้ให้เป็นของตกแต่ง ไม่ใช่ช่องทางทำเงิน)
  const FURN = {
    rug:      { cat: 'decor', name: 'พรมปูพื้น',     emoji: '🟥', price: 150,  flat: true, w: 2, d: 2 },
    chair:    { cat: 'living', name: 'เก้าอี้',        emoji: '🪑', price: 120,  seat: true, solid: true, w: 0.75, d: 0.75, h: 26 },
    sofa:     { cat: 'living', name: 'โซฟา',         emoji: '🛋️', price: 400, seat: true, solid: true, w: 2, d: 1, h: 30 },
    table:    { cat: 'kitchen', name: 'โต๊ะอาหาร',     emoji: '🍽️', price: 250,  solid: true, w: 2, d: 1.25, h: 16, top: true },
    bed:      { cat: 'bedroom', name: 'เตียงนอน',      emoji: '🛏️', price: 600, solid: true, size: 30, w: 2, d: 3, h: 24, top: true },
    shelf:    { cat: 'study', name: 'ชั้นหนังสือ',    emoji: '📚', price: 350, solid: true, w: 1.5, d: 0.5, h: 42, top: true },
    tv:       { cat: 'living', name: 'ทีวี',          emoji: '📺', price: 700, solid: true, w: 1.5, d: 0.75, h: 34 },
    fridge:   { cat: 'kitchen', name: 'ตู้เย็น',        emoji: '🧊', price: 500, solid: true, w: 1, d: 1, h: 50 },
    plant:    { cat: 'decor', name: 'ต้นไม้ในกระถาง', emoji: '🪴', price: 90,  solid: true, w: 0.75, d: 0.75, h: 30, small: true },
    piano:    { cat: 'living', name: 'เปียโน',        emoji: '🎹', price: 1200, solid: true, w: 2, d: 1, h: 34, top: true },
    trophy:   { cat: 'study', name: 'ถ้วยรางวัล',    emoji: '🏆', price: 800, solid: true, w: 0.5, d: 0.5, h: 20, small: true },
    painting: { cat: 'decor', name: 'ภาพวาด',       emoji: '🖼️', price: 200, wall: true, w: 1.25, h: 34 },
    clock:    { cat: 'decor', name: 'นาฬิกาแขวนผนัง', emoji: '🕰️', price: 260, wall: true, w: 0.75, h: 30 },
    map:      { cat: 'decor', name: 'แผนที่โลก',     emoji: '🗺️', price: 220, wall: true, w: 1.5, h: 34 },
    records:  { cat: 'decor', name: 'แผ่นเสียงติดผนัง', emoji: '💿', price: 320, wall: true, w: 1.5, h: 34 },
    teddy:    { cat: 'decor', name: 'ตุ๊กตาหมี',      emoji: '🧸', price: 160, w: 0.5, d: 0.5, h: 16, small: true },
    statue:   { cat: 'rare', name: 'รูปปั้นหินประจำเมือง', emoji: '🗿', price: 1500, solid: true, rare: true, w: 1.5, d: 1.5, h: 56 },
    fountain: { cat: 'rare', name: 'น้ำพุ',               emoji: '⛲', price: 1500, solid: true, rare: true, w: 2, d: 2, h: 40 },
    cat:      { cat: 'rare', name: 'แมวเฝ้าบ้าน',          emoji: '🐈', price: 1500, rare: true, w: 0.5, d: 0.5, h: 16, small: true },
    flag:     { cat: 'rare', name: 'ธงหมู่บ้าน',           emoji: '🚩', price: 1500, rare: true, w: 0.5, d: 0.5, h: 52, small: true },
    // ของที่ช่างไม้ประดิษฐ์เองเท่านั้น (ไม่วางขายในร้าน)
    crate:    { cat: 'craft', name: 'ลังไม้',            emoji: '📦', price: 180,  solid: true, craft: true, w: 1, d: 1, h: 24, top: true },
    barrel:   { cat: 'craft', name: 'ถังไม้โอ๊ก',         emoji: '🛢️', price: 270,  solid: true, craft: true, w: 0.75, d: 0.75, h: 30 },
    signpost: { cat: 'craft', name: 'ป้ายชี้ทาง',         emoji: '🪧', price: 285,  craft: true, w: 0.5, d: 0.5, h: 44, small: true },
    mailbox:  { cat: 'craft', name: 'ตู้ไปรษณีย์',        emoji: '📮', price: 360, solid: true, craft: true, w: 0.5, d: 0.5, h: 40, small: true },
    toolbox:  { cat: 'craft', name: 'ตู้เครื่องมือช่าง',   emoji: '🧰', price: 465, solid: true, craft: true, w: 1, d: 0.6, h: 30, top: true },
    hut:      { cat: 'craft', name: 'กระท่อมไม้น้อย',     emoji: '🛖', price: 1400, solid: true, craft: true, size: 31, w: 2, d: 2, h: 60 },
    lantern:  { cat: 'decor', name: 'โคมไฟ (สว่างตอนกลางคืน)', emoji: '🏮', price: 350, light: true, w: 0.5, d: 0.5, h: 30, small: true },
    // ของใหม่ในร้านแต่ละหมวด (ราคาไล่ตามขนาด/ความยาก: ของเล็ก 60-300 • เครื่องเรือนหลัก 300-700 • ของใหญ่/หรู 900-1,100)
    armchair:   { cat: 'living', name: 'เก้าอี้พักผ่อน',   emoji: '💺', price: 220,  seat: true, solid: true, w: 1, d: 1, h: 28 },
    coffeetable:{ cat: 'living', name: 'โต๊ะกลางโซฟา',     emoji: '☕', price: 180,  solid: true, w: 1.5, d: 1, h: 14, top: true },
    stool:      { cat: 'living', name: 'สตูลไม้',          emoji: '🪑', price: 70,   seat: true, solid: true, w: 0.5, d: 0.5, h: 14 },
    fireplace:  { cat: 'living', name: 'เตาผิงอิฐ',        emoji: '🔥', price: 950,  solid: true, light: true, w: 2, d: 0.75, h: 50 },
    bedsingle:  { cat: 'bedroom', name: 'เตียงเดี่ยว',     emoji: '🛏️', price: 350,  solid: true, w: 1.5, d: 2.5, h: 20, top: true },
    bedking:    { cat: 'bedroom', name: 'เตียงคิงไซส์',    emoji: '🛌', price: 1100, solid: true, w: 3, d: 3, h: 26, top: true },
    wardrobe:   { cat: 'bedroom', name: 'ตู้เสื้อผ้า',      emoji: '🚪', price: 550,  solid: true, w: 1.5, d: 0.75, h: 60 },
    nightstand: { cat: 'bedroom', name: 'ตู้ข้างเตียง',     emoji: '🗄️', price: 150,  solid: true, w: 0.75, d: 0.75, h: 16, top: true },
    dresser:    { cat: 'bedroom', name: 'ตู้ลิ้นชัก',       emoji: '🗃️', price: 420,  solid: true, w: 1.5, d: 0.75, h: 28, top: true },
    stove:      { cat: 'kitchen', name: 'เตาแก๊ส',         emoji: '🔥', price: 450,  solid: true, w: 1, d: 1, h: 30, top: true },
    counter:    { cat: 'kitchen', name: 'เคาน์เตอร์ครัว',   emoji: '🍽️', price: 320,  solid: true, w: 2, d: 1, h: 28, top: true },
    sink:       { cat: 'kitchen', name: 'อ่างล้างจาน',      emoji: '🚰', price: 400,  solid: true, w: 1.5, d: 1, h: 28, top: true },
    cupboard:   { cat: 'kitchen', name: 'ตู้เก็บของครัว',   emoji: '🗄️', price: 360,  solid: true, w: 1.5, d: 0.5, h: 52, top: true },
    desk:       { cat: 'study', name: 'โต๊ะทำงาน',        emoji: '🖥️', price: 380,  solid: true, w: 2, d: 1, h: 20, top: true },
    officechair:{ cat: 'study', name: 'เก้าอี้ทำงาน',      emoji: '💺', price: 180,  seat: true, solid: true, w: 0.75, d: 0.75, h: 30 },
    globe:      { cat: 'study', name: 'ลูกโลกจำลอง',      emoji: '🌐', price: 240,  solid: true, w: 0.5, d: 0.5, h: 22, small: true },
    computer:   { cat: 'study', name: 'คอมพิวเตอร์',      emoji: '💻', price: 900,  solid: true, w: 0.75, d: 0.5, h: 22, small: true },
    vase:       { cat: 'decor', name: 'แจกันดอกไม้',      emoji: '💐', price: 110,  w: 0.5, d: 0.5, h: 20, small: true },
    floorlamp:  { cat: 'decor', name: 'โคมไฟตั้งพื้น (สว่างตอนกลางคืน)', emoji: '💡', price: 300, light: true, solid: true, w: 0.5, d: 0.5, h: 50, small: true },
    roundrug:   { cat: 'decor', name: 'พรมกลม',          emoji: '🔵', price: 220,  flat: true, w: 2, d: 2 },
    aquarium:   { cat: 'decor', name: 'ตู้ปลา',           emoji: '🐠', price: 650,  solid: true, w: 1.5, d: 0.75, h: 32, top: true },
    mirror:     { cat: 'decor', name: 'กระจกเงา',         emoji: '🪞', price: 280,  wall: true, w: 1, h: 44 },
    poster:     { cat: 'decor', name: 'โปสเตอร์',         emoji: '📜', price: 140,  wall: true, w: 1, h: 34 },
    wreath:     { cat: 'decor', name: 'พวงหรีดประดับผนัง', emoji: '🌿', price: 130,  wall: true, w: 0.75, h: 26 },
    // ฉากกั้นห้อง: แผ่นบางตั้งพื้น (กว้าง 2 ช่อง หนา ¼ ช่อง) กั้นเป็นโซนในห้องได้ หมุนได้ เดินทะลุไม่ได้
    screen_wood:   { cat: 'divider', name: 'ฉากไม้พับ',        emoji: '🪟', price: 280, solid: true, w: 2, d: 0.25, h: 56 },
    screen_shoji:  { cat: 'divider', name: 'ฉากกระดาษชิโจ',    emoji: '📄', price: 340, solid: true, w: 2, d: 0.25, h: 56 },
    screen_lattice:{ cat: 'divider', name: 'ฉากระแนงไม้',      emoji: '🔳', price: 300, solid: true, w: 2, d: 0.25, h: 56 },
    screen_glass:  { cat: 'divider', name: 'ฉากกระจกฝ้า',      emoji: '🔲', price: 420, solid: true, w: 2, d: 0.25, h: 56 },
    screen_bamboo: { cat: 'divider', name: 'ฉากไม้ไผ่',        emoji: '🎍', price: 260, solid: true, w: 2, d: 0.25, h: 56 },
    lowwall:       { cat: 'divider', name: 'ผนังกั้นเตี้ย',     emoji: '🧱', price: 220, solid: true, w: 2, d: 0.25, h: 30, top: true },
  };
  // พื้นบ้าน/วอลเปเปอร์: เลือกเปลี่ยนได้ฟรีไม่จำกัดครั้ง (เก็บ id ไว้ในข้อมูลบ้านเป็น fl / wp) เพิ่มแบบใหม่ได้ที่นี่ + ใส่ไว้ใน HOUSE_*_ORDER
  // kind: plank = ไม้กระดานเรียงยาว • tile = กระเบื้องสี่เหลี่ยม (c[0],c[1] สลับหมากรุก) • carpet = พรมปูทั้งห้อง | edge = [สีขอบพื้นด้านหน้า, ด้านขวา]
  const HOUSE_FLOORS = {
    oak:    { name: 'ไม้โอ๊ก',       emoji: '🟫', kind: 'plank',  c: ['#c98a56', '#be7f4b', '#d29560', '#b87846'], seam: 'rgba(70,35,15,.55)', edge: ['#8a5430', '#6b3f22'] },
    dark:   { name: 'ไม้เข้ม',       emoji: '🟤', kind: 'plank',  c: ['#8a5a36', '#7e4f2e', '#946240', '#74482a'], seam: 'rgba(30,15,5,.6)',   edge: ['#5a3820', '#44281a'] },
    birch:  { name: 'ไม้เบิร์ชอ่อน',  emoji: '🟨', kind: 'plank',  c: ['#e3c79a', '#d9bc8b', '#ecd2a6', '#d3b583'], seam: 'rgba(110,80,40,.45)', edge: ['#b69460', '#957749'] },
    check:  { name: 'กระเบื้องหมากรุก', emoji: '⬜', kind: 'tile',   c: ['#f1ead8', '#6b7f8a'], seam: 'rgba(40,40,40,.35)', edge: ['#8a9096', '#6c7278'] },
    stone:  { name: 'หินเทา',        emoji: '⬛', kind: 'tile',   c: ['#c9ccd2', '#bdc1c8'], seam: 'rgba(60,60,70,.4)',  edge: ['#8c9098', '#6f737b'] },
    carpetr:{ name: 'พรมแดง',        emoji: '🟥', kind: 'carpet', c: ['#a8322a', '#9b2c25'], seam: 'rgba(60,10,10,.25)', edge: ['#6e1f1a', '#521612'] },
    bamboo: { name: 'ไม้ไผ่',        emoji: '🎍', kind: 'plank',  c: ['#c9b458', '#bda84c', '#d4c066', '#b39e44'], seam: 'rgba(80,65,20,.5)',  edge: ['#8d7c34', '#6b5d24'] },
    pine:   { name: 'ไม้สนขาว',      emoji: '🤍', kind: 'plank',  c: ['#efe6d4', '#e6dcc6', '#f4ecdc', '#ddd1b8'], seam: 'rgba(120,100,70,.4)', edge: ['#bdb094', '#9a8e74'] },
    terra:  { name: 'กระเบื้องดินเผา', emoji: '🟧', kind: 'tile',   c: ['#c4673a', '#b85a30'], seam: 'rgba(70,25,10,.45)', edge: ['#8a4220', '#6a3118'] },
    tatami: { name: 'เสื่อทาทามิ',    emoji: '🌾', kind: 'carpet', c: ['#c8c58a', '#bdba7e'], seam: 'rgba(80,80,40,.25)', edge: ['#8e8c58', '#6c6a40'] },
    carpetg:{ name: 'พรมเขียวสนาม',  emoji: '🟢', kind: 'carpet', c: ['#5f9a4a', '#558f41'], seam: 'rgba(20,50,15,.25)', edge: ['#3e6a30', '#2e5024'] },
    carpetb:{ name: 'พรมฟ้า',        emoji: '🟦', kind: 'carpet', c: ['#4a78a8', '#416d9c'], seam: 'rgba(10,25,50,.25)', edge: ['#2f5073', '#233c57'] },
  };
  // วอลเปเปอร์: up = ผนังครึ่งบน (base + ลาย) • lo = แผ่นผนังครึ่งล่าง (base + ร่อง) • rail = ราวคาด • skirt = บัวพื้น | pat: stripe ลายขีด / plain เรียบ
  const HOUSE_WALLS = {
    cream:  { name: 'ครีมลายขีด',   emoji: '🟨', pat: 'stripe', up: ['#efe3c2', '#e2d1a4'], lo: ['#b9602f', '#8a4420'], rail: '#d98a4b', skirt: '#7a3f1d' },
    sky:    { name: 'ฟ้าอ่อน',      emoji: '🟦', pat: 'stripe', up: ['#cfe6f2', '#bcd9ea'], lo: ['#5c7fa8', '#46688f'], rail: '#8fb3d6', skirt: '#34506f' },
    pink:   { name: 'ชมพูหวาน',     emoji: '🟪', pat: 'stripe', up: ['#f8dfe4', '#f0cdd5'], lo: ['#b86a7a', '#965062'], rail: '#e49aab', skirt: '#7a3a4a' },
    mint:   { name: 'เขียวมินต์',    emoji: '🟩', pat: 'stripe', up: ['#dcefd9', '#c9e3c5'], lo: ['#5f8f63', '#487349'], rail: '#8cc291', skirt: '#35583a' },
    royal:  { name: 'ม่วงหรู',       emoji: '🟣', pat: 'stripe', up: ['#6d5a8a', '#5f4d7b'], lo: ['#3b2f52', '#2b2140'], rail: '#a88ccc', skirt: '#1f1730' },
    white:  { name: 'ขาวเรียบ',      emoji: '⬜', pat: 'plain',  up: ['#f4f1ea', '#f4f1ea'], lo: ['#cfc6b3', '#b3a98f'], rail: '#e2dccd', skirt: '#9d9378' },
    lemon:  { name: 'เหลืองเนย',     emoji: '🟨', pat: 'stripe', up: ['#faf0b8', '#f2e49c'], lo: ['#c8963a', '#a67a28'], rail: '#e8c060', skirt: '#7a5a1a' },
    lavender:{ name: 'ลาเวนเดอร์',   emoji: '🟪', pat: 'stripe', up: ['#e3d9f2', '#d3c6ea'], lo: ['#8a72b0', '#6f5a94'], rail: '#b8a4d8', skirt: '#4a3a6a' },
    peach:  { name: 'พีชอ่อน',       emoji: '🟧', pat: 'stripe', up: ['#fbdcc4', '#f4c9a8'], lo: ['#c8744a', '#a45a36'], rail: '#e8a070', skirt: '#6e3a20' },
    sage:   { name: 'เขียวเซจ',      emoji: '🟩', pat: 'plain',  up: ['#cfd8c0', '#cfd8c0'], lo: ['#6b7f5a', '#566846'], rail: '#9db08a', skirt: '#3a4a2c' },
    brick:  { name: 'ผนังอิฐแดง',    emoji: '🧱', pat: 'brick',  up: ['#b5573a', '#d8c0a8'], lo: ['#5a3a2a', '#3f281c'], rail: '#8a4a30', skirt: '#2e1c12' },
    wood:   { name: 'ผนังไม้',       emoji: '🟫', pat: 'stripe', up: ['#b9783f', '#a96a36'], lo: ['#8a5430', '#6b3f22'], rail: '#d29560', skirt: '#4a2a14' },
  };
  const HOUSE_FLOOR_ORDER = ['oak', 'dark', 'birch', 'pine', 'bamboo', 'check', 'stone', 'terra', 'tatami', 'carpetr', 'carpetb', 'carpetg'], HOUSE_WALL_ORDER = ['cream', 'sky', 'pink', 'mint', 'lemon', 'lavender', 'peach', 'sage', 'royal', 'white', 'brick', 'wood'];
  const HOUSE_STYLE_DEFAULT = { fl: 'oak', wp: 'cream' };
  const FARM = { x0: 3, y0: 11, x1: 18, y1: 20 };       // แปลงผัก (ช่องที่ขุดได้)
  // เล้า 6 เล้า ขนาดเท่ากัน (ภายใน 3×4 ช่อง) เรียง 2 แถวๆละ 3 เล้า มีรั้วล้อมรอบ 1 ช่อง • gate = ช่องประตู (ด้านซ้ายของเล้า) • sign = ป้ายประจำเล้า (ชื่อสัตว์อยู่บนป้าย)
  const PENS = {
    chicken: { x0: 47, y0: 10, x1: 49, y1: 13, gate: [[46, 11], [46, 12]], sign: [48, 8] },
    duck:    { x0: 53, y0: 10, x1: 55, y1: 13, gate: [[52, 11], [52, 12]], sign: [54, 8] },
    pig:     { x0: 59, y0: 10, x1: 61, y1: 13, gate: [[58, 11], [58, 12]], sign: [60, 8] },
    cow:     { x0: 47, y0: 18, x1: 49, y1: 21, gate: [[46, 19], [46, 20]], sign: [48, 16] },
    sheep:   { x0: 53, y0: 18, x1: 55, y1: 21, gate: [[52, 19], [52, 20]], sign: [54, 16] },
    bee:     { x0: 59, y0: 18, x1: 61, y1: 21, gate: [[58, 19], [58, 20]], sign: [60, 16] },
    alpaca:  { x0: 47, y0: 27, x1: 49, y1: 30, gate: [[46, 28], [46, 29]], sign: [48, 25] }, // แถวที่ 3 (เลเวล 11–20)
    horse:   { x0: 53, y0: 27, x1: 55, y1: 30, gate: [[52, 28], [52, 29]], sign: [54, 25] },
    boar:    { x0: 59, y0: 27, x1: 61, y1: 30, gate: [[58, 28], [58, 29]], sign: [60, 25] },
  };
  // เล้าผึ้ง: ต้นไม้ถาวร 1 ต้น (ตัดไม่ได้) และรังผึ้ง (ลัง) 2 ลังวางในเล้า • ผึ้งบินวนรอบรัง
  const BEE = { trees: [[61, 18]], hives: [[59, 20], [61, 21]] };
  const SPAWN = { x: 33 * TS + 16, y: 22 * TS + 16 };     // หัวลานกลางเมือง ใกล้กองไฟ/กระดานข่าว/ATM
  const START_SPAWN = { x: 10 * TS, y: 16 * TS + 16 }; // ผู้เล่นที่เข้าเกมครั้งแรกเกิดในแปลงผัก ถือจอบพร้อมขุด (ข้อแรกของคู่มือ) คนเก่าอยู่ตรงที่ออกไว้
  const DAY_MS = 12 * 60 * 1000;                       // หน่วย "วัน" ของเศรษฐกิจ (ดอกเบี้ย ผักสุกค้าง สัตว์ป่วย ตลาด) = 12 นาที
  const FARM_REGROW_MS = DAY_MS;                       // แปลงที่ถางแล้วแต่ไม่มีใครปลูกหรือถางต่อเกินเวลานี้ (นับเฉพาะตอนมีคนออนไลน์) หญ้าขึ้นกลับเป็นเหมือนเดิม ต้องถางใหม่
  // แปลงเช่า (ขั้น 2 ใน ECONOMY-PLAN.md): 3 แถวบนของแปลงกลางแบ่งเป็น 4 แปลง แปลงละ 12 ช่อง เช่าได้คนละแปลง ราคา price ต่อ days วันในเกม (DAY_MS) ต่อเวลาล่วงหน้าได้ไม่เกิน maxAhead วันในเกม
  // แปลงที่มีคนเช่า: ขุด/ปลูกได้เฉพาะคนเช่า และต้นในแปลงตัวเองไม่นับเพดาน FARM_CAP • แปลงว่าง = ล็อกทั้งหมด
  const FARM_RENT = { price: 500, ms: 24 * 60 * 60 * 1000, /* 1 วันจริง */ plots: [{ id: 'A', x0: 3, y0: 11, x1: 6, y1: 13 }, { id: 'B', x0: 7, y0: 11, x1: 10, y1: 13 }, { id: 'C', x0: 11, y0: 11, x1: 14, y1: 13 }, { id: 'D', x0: 15, y0: 11, x1: 18, y1: 13 }] };
  const rentPlotAt = (x, y) => FARM_RENT.plots.find(q => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1) || null;
  const FARM_CAP = { base: 20, perLv: 2, max: 40 };       // เพดานจำนวนต้นที่ผู้เล่นหนึ่งคนปลูกค้างในแปลงกลางได้พร้อมกัน (ฐาน + เลเวลชาวนา×perLv) กันคนเดียวปลูกเต็มจนคนอื่นไม่มีที่ ช่องว่างหลังเก็บเกี่ยวนับคืนทันที
  // พืชชั้นสูงต้องมีบัวรดน้ำระดับสูงถึงปลูกได้: Lv6–7 บัวทองแดง • Lv8+ บัวทอง (ใช้เงินระหว่างทาง) • ลองให้พืชใหญ่กินโควตาแปลงมากกว่าแล้ว XP/ชม. ของ Lv9–10 ตกต่ำกว่า Lv7 จึงไม่ใช้
  const cropCan = c => (c.lv >= 8 ? 3 : c.lv >= 6 ? 2 : 1);
  const CLOCK_MS = 24 * 60 * 1000;                     // 1 รอบกลางวัน-กลางคืนบนนาฬิกาเกม = 24 นาทีจริง (แยกจาก DAY_MS เพื่อไม่ให้เศรษฐกิจช้าลง)
  const TREE = { cap: 132, growMs: 20000 };            // เพดานต้นไม้ในแมพ (ตัดทั้งแมพก็ไม่ใช่ทางรวยสุด) + งอกใหม่ทุก growMs
  const WATER_MS = 90000;                              // ดินเปียกนานเท่าไร
  const MAX_LV = 20;                                   // เลเวลสูงสุดทุกอาชีพ (ขยายจาก 10 → 20 เมื่อ 29 ต.ค. 2026)
  const PERK_LV = 10;                                  // โบนัสผลผลิต/ความเร็วที่ผูกเลเวล (พืช ตกปลา ไม้ สัตว์) คิดสูงสุดที่ Lv10 เหมือนเดิม เลเวล 11–20 ให้ของใหม่แทน ไม่ให้เศรษฐกิจพอง
  const perkLv = lv => Math.min(lv, PERK_LV);

  // อาชีพ 4 สาย (ช่างไม้เพิ่งเริ่ม: ตัดไม้ขาย ยังไม่มีงานฝีมือ)
  const SKILLS = {
    farm:   { name: 'ชาวนา',     emoji: '🌾' },
    fish:   { name: 'ชาวประมง',  emoji: '🎣' },
    animal: { name: 'คนเลี้ยงสัตว์', emoji: '🐄' },
    wood:   { name: 'ช่างไม้',    emoji: '🪵' },
    cook:   { name: 'เชฟ',       emoji: '👨‍🍳' },
    mine:   { name: 'นักขุดแร่',   emoji: '⚒️' },
  };
  // XP สะสมที่ต้องใช้ถึงเลเวลนั้น (ช่อง = เลเวล) ตั้งตามเวลาเล่นเป้าหมายต่ออาชีพ: Lv2 ~5 นาที • Lv4 ~45 นาที • Lv5 ~1.5 ชม. • Lv7 ~5 ชม. • Lv10 ~18 ชม. (ดู ECONOMY-PLAN.md ขั้น 1B)
  const XP_TABLE = [0, 0, 150, 600, 1500, 3500, 8000, 14500, 24000, 36000, 64000, 95000, 130000, 169000, 213000, 262000, 317000, 379000, 448000, 525000, 612000]; // Lv11–20 ขั้นละ ×1.12 ของขั้นก่อน (ถึง Lv20 ≈ 100 ชม.เล่นจริง)
  const xpFor = lv => XP_TABLE[Math.max(1, Math.min(MAX_LV, lv))];
  const levelOf = xp => { let lv = 1; while (lv < MAX_LV && (xp || 0) >= XP_TABLE[lv + 1]) lv++; return lv; };
  // ย้าย XP ตามสูตรเดิม (30×(lv−1)², ใช้ถึง ต.ค. 2026) มาตารางใหม่: เลเวลเท่าเดิม และความคืบหน้าในเลเวลนั้นเป็นสัดส่วนเท่าเดิม
  const xpFromV1 = xp => {
    xp = Math.max(0, xp || 0); const old = lv => 30 * (lv - 1) * (lv - 1), L = Math.min(MAX_LV, Math.floor(Math.sqrt(xp / 30)) + 1);
    if (L >= MAX_LV) return XP_TABLE[MAX_LV] + Math.floor(xp - old(MAX_LV));
    return XP_TABLE[L] + Math.floor((xp - old(L)) / (old(L + 1) - old(L)) * (XP_TABLE[L + 1] - XP_TABLE[L]));
  };

  // เมล็ดพืช: lv = เลเวลชาวนาที่ปลดล็อก, time = เวลาโต (ms) เมื่อรดน้ำต่อเนื่อง, xp = XP ตอนเก็บเกี่ยว
  // ราคาเมล็ดลด 25% (25 ต.ค. 2026) ชาวนาเคยได้กำไรน้อยสุดในทุกอาชีพ (tools/econsim.js) เมล็ด ≈ 38–45% ของราคาขาย
  // เวลาโตผูกกำไร (sell−seed) ≈ 0.22 เหรียญ/วิ (ขั้นต่ำ 60 วิ สูงสุด 480 วิ) ให้พืชแพงไม่คุ้มเวลากว่าพืชกลาง — สลับชนิดแทนจ้องแต่ของแพง (พลังงานปิด)
  const CROPS = {
    carrot:     { name: 'แครอท',      emoji: '🥕', seed: 8, sell: 20,  time: 60000,  lv: 1, xp: 5 },
    cabbage:    { name: 'กะหล่ำปลี',   emoji: '🥬', seed: 11, sell: 28,  time: 77000,  lv: 1, xp: 7 },
    corn:       { name: 'ข้าวโพด',     emoji: '🌽', seed: 15, sell: 39,  time: 109000, lv: 2, xp: 9 },
    tomato:     { name: 'มะเขือเทศ',   emoji: '🍅', seed: 19, sell: 50,  time: 141000, lv: 3, xp: 12 },
    eggplant:   { name: 'มะเขือม่วง',  emoji: '🍆', seed: 26, sell: 67,  time: 186000, lv: 4, xp: 16 },
    strawberry: { name: 'สตรอว์เบอร์รี', emoji: '🍓', seed: 34, sell: 84,  time: 227000, lv: 5, xp: 20 },
    pumpkin:    { name: 'ฟักทอง',      emoji: '🎃', seed: 45, sell: 102, time: 259000, lv: 6, xp: 26 },
    potato:     { name: 'มันฝรั่ง',     emoji: '🥔', seed: 14,  sell: 35,  time: 95000,  lv: 2, xp: 10 },
    chili:      { name: 'พริก',        emoji: '🌶️', seed: 21,  sell: 55,  time: 155000, lv: 3, xp: 14 },
    broccoli:   { name: 'บรอกโคลี',     emoji: '🥦', seed: 28,  sell: 72,  time: 200000, lv: 4, xp: 18 },
    cherry:     { name: 'เชอร์รี',      emoji: '🍒', seed: 41,  sell: 99, time: 264000, lv: 5, xp: 22 },
    grape:      { name: 'องุ่น',        emoji: '🍇', seed: 52,  sell: 116, time: 291000, lv: 6, xp: 28 },
    pineapple:  { name: 'สับปะรด',      emoji: '🍍', seed: 64,  sell: 143, time: 359000, lv: 7, xp: 34 },
    mango:      { name: 'มะม่วง',       emoji: '🥭', seed: 82, sell: 188, time: 480000, lv: 9, xp: 42 },
    melon:      { name: 'แตงโม',       emoji: '🍉', seed: 68, sell: 150, time: 373000, lv: 8, xp: 38 },
    // เลเวล 11–20 (30 ต.ค. 2026): เมล็ด ≈ 43% ของราคาขาย เวลาโตตามกำไร (≈ 0.22 เหรียญ/วิ) สูงสุด 12 นาที
    peach: { name: 'พีช', emoji: '🍑', seed: 86, sell: 200, time: 518000, lv: 11, xp: 44 },
    kiwi: { name: 'กีวี', emoji: '🥝', seed: 90, sell: 210, time: 545000, lv: 12, xp: 45 },
    coconut: { name: 'มะพร้าวน้ำหอม', emoji: '🥥', seed: 95, sell: 222, time: 577000, lv: 13, xp: 46 },
    avocado: { name: 'อะโวคาโด', emoji: '🥑', seed: 101, sell: 234, time: 605000, lv: 14, xp: 47 },
    blueberry: { name: 'บลูเบอร์รี', emoji: '🫐', seed: 106, sell: 246, time: 636000, lv: 15, xp: 49 },
    olive: { name: 'มะกอก', emoji: '🫒', seed: 111, sell: 258, time: 668000, lv: 16, xp: 50 },
    beans: { name: 'เมล็ดโกโก้', emoji: '🫘', seed: 115, sell: 268, time: 695000, lv: 17, xp: 51 },
    mushroom: { name: 'เห็ดทรัฟเฟิล', emoji: '🍄', seed: 120, sell: 278, time: 718000, lv: 18, xp: 52 },
    sunflower: { name: 'ทานตะวันทอง', emoji: '🌻', seed: 124, sell: 288, time: 720000, lv: 19, xp: 53 },
    tulip: { name: 'ทิวลิปทอง', emoji: '🌷', seed: 128, sell: 298, time: 720000, lv: 20, xp: 54 },
  };
  // ฤดูกาล (ขั้น 4 ใน ECONOMY-PLAN.md): ร้อน → ฝน → หนาว วนทุก days วันจริง นับจาก epoch • พืชในฤดู: ราคาเป้าตลาด ×inMul • นอกฤดู: โตช้าลง (เวลา ×outGrow) และราคา ×outMul
  // พืชเลเวล 1 (แครอท กะหล่ำ) โตปกติทุกฤดู คนใหม่ไม่โดน
  const SEASONS = { epoch: Date.parse('2026-11-01T00:00:00+07:00'), days: 3.5, inMul: 1.15, outMul: 0.9, outGrow: 1.5, list: [
    { id: 'hot',  name: 'ฤดูร้อน', emoji: '☀️', crops: ['corn', 'chili', 'tomato', 'melon', 'pineapple', 'peach', 'avocado', 'olive'] },
    { id: 'rain', name: 'ฤดูฝน',  emoji: '🌧️', crops: ['eggplant', 'pumpkin', 'potato', 'cherry', 'grape', 'kiwi', 'blueberry', 'beans'] },
    { id: 'cool', name: 'ฤดูหนาว', emoji: '❄️', crops: ['broccoli', 'strawberry', 'mango', 'carrot', 'cabbage', 'coconut', 'mushroom', 'sunflower', 'tulip'] },
  ] };
  const seasonAt = t => { const L = SEASONS.days * 864e5, n = Math.floor((t - SEASONS.epoch) / L), i = ((n % 3) + 3) % 3; return { s: SEASONS.list[i], end: SEASONS.epoch + (n + 1) * L, on: t >= SEASONS.epoch }; };
  const cropSeason = (c, t) => { const se = seasonAt(t); if (!se.on || !CROPS[c] || CROPS[c].lv <= 1) return 0; return se.s.crops.includes(c) ? 1 : -1; }; // 1 ในฤดู • -1 นอกฤดู • 0 ไม่มีผล
  // ความชำนาญหลัง Lv10: ดาว 1–max ต่ออาชีพ ดาวที่ n ต้องมี XP ≥ XP Lv10 + n × xpPer และจ่าย costBase × n เหรียญ (ใช้เงินระยะยาว ไม่เพิ่มพลังหรือรายได้) ครบ max ดาวได้ฉายา "ปรมาจารย์<อาชีพ>"
  const MASTERY = { xpPer: 25000, costBase: 2000, max: 5 };
  // ปลา: lv = เลเวลชาวประมงที่เริ่มตกได้, w = น้ำหนักความน่าจะเป็น (หายาก = ราคาแพง: ราคาแปรผันตามความหายาก)
  // XP ปลา ≈ 6 × ราคา^0.36 (ปลาแพงให้ XP มากขึ้นแต่ไม่ตามราคา) ให้ XP/ชม. ใกล้ชาวนาที่เลเวลเดียวกัน ตรวจด้วย node tools/levelsim.js
  const FISH = [
    { id: 'boot',    name: 'รองเท้าเก่า',  emoji: '👢', sell: 1,   xp: 1,  w: 8,  lv: 1 },
    { id: 'carp',    name: 'ปลาตะเพียน',  emoji: '🐟', sell: 12,  xp: 15,  w: 40, lv: 1 },
    { id: 'catfish', name: 'ปลาดุก',      emoji: '🐡', sell: 16,  xp: 16,  w: 25, lv: 1 },
    { id: 'bass',    name: 'ปลากะพง',     emoji: '🐠', sell: 20,  xp: 18, w: 20, lv: 2 },
    { id: 'shrimp',  name: 'กุ้ง',        emoji: '🦐', sell: 26,  xp: 19, w: 15, lv: 3 },
    { id: 'crab',    name: 'ปู',          emoji: '🦀', sell: 32,  xp: 21, w: 12, lv: 4 },
    { id: 'koi',     name: 'ปลาคอยทอง',   emoji: '🎏', sell: 50,  xp: 25, w: 6,  lv: 5 },
    { id: 'lobster', name: 'กุ้งมังกร',    emoji: '🦞', sell: 55,  xp: 25, w: 5,  lv: 6 },
    { id: 'squid',   name: 'หมึก',        emoji: '🦑', sell: 65,  xp: 27, w: 4,  lv: 7 },
    { id: 'shell',   name: 'หอยเชลล์',     emoji: '🐚', sell: 18,  xp: 17,   w: 22, lv: 2 },
    { id: 'frog',    name: 'กบน้อย',      emoji: '🐸', sell: 24,  xp: 19,  w: 18, lv: 3 },
    { id: 'oyster',  name: 'หอยนางรม',    emoji: '🦪', sell: 36,  xp: 22,  w: 12, lv: 4 },
    { id: 'turtle',  name: 'เต่าน้อย',     emoji: '🐢', sell: 44,  xp: 23,  w: 6,  lv: 5 },
    { id: 'shark',   name: 'ฉลามน้อย',    emoji: '🦈', sell: 90, xp: 30,  w: 1.3, lv: 9 },
    { id: 'whale',   name: 'วาฬน้อย',     emoji: '🐳', sell: 120, xp: 34, w: 0.7, lv: 10 },
    { id: 'octopus', name: 'ปลาหมึกยักษ์', emoji: '🐙', sell: 75, xp: 28, w: 3,  lv: 8 },
    { id: 'otter',   name: 'นากน้ำ',       emoji: '🦦', sell: 55,  xp: 25, w: 4,  lv: 6 },
    { id: 'croc',    name: 'จระเข้น้อย',    emoji: '🐊', sell: 85, xp: 30, w: 1.6, lv: 8 },
    { id: 'seal',    name: 'แมวน้ำ',       emoji: '🦭', sell: 105, xp: 32, w: 0.9, lv: 9 },
    { id: 'dolphin', name: 'โลมา',         emoji: '🐬', sell: 140, xp: 36, w: 0.5, lv: 10 },
    { id: 'humpback', name: 'วาฬหลังค่อม', emoji: '🐋', sell: 190, xp: 40, w: 0.25, lv: 10 },
    // เลเวล 11–20 (29 ต.ค. 2026): rod = ระดับคันเบ็ดขั้นต่ำที่ตกได้ ทุกตัวราคา ≥ 100 จึงติดคูลดาวน์ปลาหายากและกดเป๊ะเหมือนปลากลุ่ม 3
    { id: 'jelly', name: 'แมงกะพรุน', emoji: '🪼', sell: 210, xp: 41, w: 3, lv: 11, rod: 4 },
    { id: 'penguin', name: 'เพนกวิน', emoji: '🐧', sell: 230, xp: 42, w: 2.5, lv: 11, rod: 4 },
    { id: 'beaver', name: 'บีเวอร์', emoji: '🦫', sell: 250, xp: 44, w: 2, lv: 12, rod: 4 },
    { id: 'dino', name: 'ไดโนน้ำ', emoji: '🦕', sell: 310, xp: 47, w: 1.2, lv: 13, rod: 5 },
    { id: 'flamingo', name: 'ฟลามิงโก', emoji: '🦩', sell: 290, xp: 46, w: 1.6, lv: 13, rod: 5 },
    { id: 'coral', name: 'ปะการังแดง', emoji: '🪸', sell: 330, xp: 48, w: 1.4, lv: 14, rod: 5 },
    { id: 'swan', name: 'หงส์ดำ', emoji: '🦢', sell: 380, xp: 51, w: 1.1, lv: 15, rod: 5 },
    { id: 'mermaid', name: 'นางเงือกน้อย', emoji: '🧜', sell: 450, xp: 55, w: 0.8, lv: 16, rod: 6 },
    { id: 'dragon', name: 'มังกรน้ำ', emoji: '🐉', sell: 520, xp: 58, w: 0.6, lv: 17, rod: 6 },
    { id: 'sdragon', name: 'มังกรทะเล', emoji: '🐲', sell: 600, xp: 62, w: 0.45, lv: 18, rod: 6 },
    { id: 'unicorn', name: 'ม้าน้ำวิเศษ', emoji: '🦄', sell: 700, xp: 66, w: 0.3, lv: 19, rod: 7 },
    { id: 'star', name: 'ดาวทะเลทอง', emoji: '🌟', sell: 800, xp: 70, w: 0.2, lv: 20, rod: 7 },
  ];
  // ช่างไม้: ตัดต้นไม้ด้วยขวาน (ขวานแรงกว่าตัดเร็วกว่า) ได้ไม้ท่อน หายากได้ไม้เนื้อแข็งราคาแพง
  const AXES = { 1: { name: 'ขวานหิน', price: 50, power: 1 }, 2: { name: 'ขวานเหล็ก', price: 220, lv: 3, power: 2 }, 3: { name: 'ขวานเหล็กกล้า', price: 700, lv: 6, power: 3 }, 4: { name: 'ขวานทองคำ', price: 2000, lv: 11, power: 4 }, 5: { name: 'ขวานเพชร', price: 5500, lv: 16, power: 5 } };
  const axeTier = inv => { for (let t = 5; t >= 1; t--) if (inv && inv['axe_' + t]) return t; return 0; }; // ระดับขวานสูงสุดที่มี (0 = ไม่มี)
  const TREE_HP = 4;                       // ต้องฟันกี่แต้มถึงล้ม (ขวานหิน = 4 ครั้ง, เหล็ก 2, เหล็กกล้า 2)
  const WOOD = { log: { sell: 16, xp: 5 }, hardwood: { sell: 66, xp: 14, chance: 0.16 }, xpPerLv: 0.1 }; // xpPerLv (0.15 → 0.1 เมื่อมีต้นไม้หลายชนิด 25 ต.ค. 2026): XP ช่างไม้ (โค่น+ประดิษฐ์) ×(1 + xpPerLv×(เลเวล−1)) เพราะต้นไม้ทั้งห้องงอกได้จำกัด ไม้จึงโตตามเลเวลด้วยตัวคูณแทนของแพงขึ้น
  const woodXp = (xp, lv) => Math.round(xp * (1 + WOOD.xpPerLv * (perkLv(lv) - 1)));
  // ของที่ได้จากต้นไม้ (ขายที่ร้านช่างไม้ หมวด "ไม้" ไม่เสื่อม) • xp = XP ช่างไม้ต่อชิ้นก่อนคูณเลเวล (≈ 0.3 XP ต่อเหรียญเหมือนไม้ท่อน)
  const WOOD_ITEMS = {
    log:       { name: 'ไม้ท่อน',      emoji: '🪵', sell: WOOD.log.sell,      xp: WOOD.log.xp },
    hardwood:  { name: 'ไม้เนื้อแข็ง',  emoji: '🟫', sell: WOOD.hardwood.sell, xp: WOOD.hardwood.xp },
    bamboo:    { name: 'ไม้ไผ่',       emoji: '🎋', sell: 9,   xp: 3 },
    shoot:     { name: 'หน่อไม้',      emoji: '🌱', sell: 12,  xp: 3 },
    pinewood:  { name: 'ไม้สน',        emoji: '🌲', sell: 18,  xp: 7 },
    resin:     { name: 'ยางสน',        emoji: '🍯', sell: 32,  xp: 10 },
    palmwood:  { name: 'ไม้มะพร้าว',    emoji: '🌴', sell: 20,  xp: 8 },
    coconut:   { name: 'ลูกมะพร้าว',    emoji: '🥥', sell: 30,  xp: 6 },
    teak:      { name: 'ไม้สัก',        emoji: '🍂', sell: 36,  xp: 13 },
    goldwood:  { name: 'ไม้ราชพฤกษ์',   emoji: '🌼', sell: 48,  xp: 16 },
    kunflower: { name: 'ดอกคูน',        emoji: '💛', sell: 28,  xp: 8 },
    rosewood:  { name: 'ไม้พะยูง',      emoji: '🟥', sell: 96, xp: 30 },
    // เลเวล 11–20 (30 ต.ค. 2026)
    maplewood: { name: 'ไม้เมเปิล',     emoji: '🍁', sell: 70,  xp: 22 },
    syrup:     { name: 'น้ำเชื่อมเมเปิล', emoji: '🫙', sell: 55,  xp: 14 },
    sakurawood: { name: 'ไม้ซากุระ',    emoji: '🌸', sell: 110, xp: 30 },
    petal:     { name: 'กลีบซากุระ',    emoji: '🪷', sell: 45,  xp: 10 },
    ebony:     { name: 'ไม้มะเกลือ',    emoji: '⬛', sell: 180, xp: 44 },
    amber:     { name: 'อำพัน',        emoji: '🔶', sell: 120, xp: 25 },
    ancientwood: { name: 'ไม้พันปี',   emoji: '🎄', sell: 300, xp: 62 },
  };
  // ต้นไม้หลายชนิด (B5 ใน ECONOMY-PLAN.md): lv/axe = เลเวลช่างไม้และระดับขวานที่ต้องมี • hp = แต้มฟัน (ขวานหิน 1/ครั้ง เหล็ก 2 เหล็กกล้า 3)
  // drop = ได้แน่ [ชิ้น, จำนวน] (ชิ้นแรกมีโอกาส +1 อีก 4%/เลเวล) • bonus = ลุ้น [ชิ้น, โอกาส] (+1%/เลเวล, +10% ช่วง Happy Village)
  // w = น้ำหนักตอนงอกใหม่ • where = ที่เกิดได้ (water ใกล้น้ำ ≤ 4 ช่อง • sand ใกล้ทราย ≤ 3 ช่อง • north แถว y < 14 • deep ห่างทาง/อาคาร 4 ช่อง)
  // pct = สัดส่วน % ของต้นไม้ทั้งแมพ (รวม 100) เรียงจากง่ายไปยาก มาก → น้อย • ไผ่/มะพร้าวถูกจำกัดด้วยที่เกิด (ริมน้ำ/ริมทราย) จึงได้น้อยกว่าลำดับ
  const TREE_KINDS = {
    broad:   { name: 'ต้นไม้ใบกว้าง', emoji: '🌳', lv: 1, axe: 1, hp: 4,  pct: 38, drop: [['log', 2]],                    bonus: [['hardwood', WOOD.hardwood.chance]] },
    bamboo:  { name: 'กอไผ่',        emoji: '🎋', lv: 1, axe: 1, hp: 2,  pct: 8, drop: [['bamboo', 2]],                 bonus: [['shoot', 0.15]], where: 'water' },
    pine:    { name: 'ต้นสน',        emoji: '🌲', lv: 2, axe: 1, hp: 5,  pct: 14, drop: [['pinewood', 2]],               bonus: [['resin', 0.12]], where: 'north' },
    coconut: { name: 'ต้นมะพร้าว',    emoji: '🌴', lv: 3, axe: 1, hp: 5,  pct: 11, drop: [['palmwood', 1], ['coconut', 1]], bonus: [['coconut', 0.5]], where: 'sand' },
    teak:    { name: 'ต้นสัก',        emoji: '🍂', lv: 4, axe: 2, hp: 8,  pct: 9, drop: [['teak', 1], ['log', 1]],       bonus: [['hardwood', 0.25]] },
    gold:    { name: 'ต้นราชพฤกษ์',   emoji: '🌼', lv: 6, axe: 3, hp: 8,  pct: 7,  drop: [['goldwood', 1]],               bonus: [['kunflower', 0.3]] },
    rose:    { name: 'ต้นพะยูง',      emoji: '🟥', lv: 8, axe: 3, hp: 14, pct: 5,  drop: [['rosewood', 1]],               bonus: [['rosewood', 0.1]], where: 'deep' },
    // เลเวล 11–20 (30 ต.ค. 2026): ต้นหายาก (w ต่ำ) ต้องขวานทองคำ/เพชร
    maple:   { name: 'ต้นเมเปิล',     emoji: '🍁', lv: 12, axe: 4, hp: 14, pct: 3.5,   drop: [['maplewood', 1]],  bonus: [['syrup', 0.3]], where: 'north' },
    sakura:  { name: 'ต้นซากุระ',     emoji: '🌸', lv: 15, axe: 5, hp: 20, pct: 2.5,   drop: [['sakurawood', 1]], bonus: [['petal', 0.4]] },
    ebony:   { name: 'ต้นมะเกลือ',    emoji: '⬛', lv: 18, axe: 5, hp: 28, pct: 1.2, drop: [['ebony', 1]],      bonus: [['amber', 0.25]], where: 'deep' },
    ancient: { name: 'ไม้พันปี',      emoji: '🎄', lv: 20, axe: 5, hp: 36, pct: 0.8, drop: [['ancientwood', 1]], bonus: [['ebony', 0.3]], where: 'deep' },
  };
  // ขุดเหมือง (ถ้ำ 10 ชั้น): เดินเข้าปากถ้ำบนหน้าผาเหนือ ใช้อีเต้อขุดก้อนแร่ ลงบันไดไปชั้นลึกขึ้นเรื่อยๆ ยิ่งลึกยิ่งได้แร่แพง (แต่ละชั้นเป็นฉากร่วมของทั้งห้อง เห็นกันและแย่งแร่กัน)
  // อีเต้อ 6 ระดับ ไม้→หิน→เหล็ก→ทองคำ→มรกต→เพชร: power = แต้มต่อครั้ง lv = เลเวลนักขุดแร่ที่ซื้อได้ (ระดับแรกซื้อได้เลย)
  const PICKS = {
    1: { name: 'อีเต้อไม้',    price: 60,   power: 1 },
    2: { name: 'อีเต้อหิน',    price: 260,  lv: 3,  power: 2 },
    3: { name: 'อีเต้อเหล็ก',  price: 800,  lv: 5,  power: 3 },
    4: { name: 'อีเต้อทองคำ',  price: 2000, lv: 7,  power: 4 },
    5: { name: 'อีเต้อมรกต',   price: 4500, lv: 9,  power: 5 },
    6: { name: 'อีเต้อเพชร',   price: 9000, lv: 10, power: 6 },
  };
  const PICK_EMOJI = { 1: '🪝', 2: '🧲', 3: '⚓', 4: '🔱', 5: '🏹', 6: '🪃' }; // คีย์ไอคอนอีเต้อพิกเซลแต่ละระดับ (วาดใน pixelui.js)
  const pickTier = inv => { for (let t = 6; t >= 1; t--) if (inv && inv['pick_' + t]) return t; return 0; }; // ระดับอีเต้อสูงสุดที่มี (0 = ไม่มี)
  const SWING_MS = 570; // ความยาวท่าขุดแร่/ตัดไม้ (pixelaction.js 6 เฟรม × 95 ms) = ระยะห่างขั้นต่ำระหว่างการฟาด (levelsim คิด 0.7 วินาที/ครั้ง)
  const MINE = {
    xpPerLv: 0.1,                                  // XP นักขุดแร่ ×(1 + xpPerLv×(เลเวล−1)) เหมือนช่างไม้ (ก้อนแร่มีจำกัด จึงโตตามเลเวลด้วยตัวคูณ)
    floors: 20,                                    // จำนวนชั้นของถ้ำ (ชั้น f = แร่ระดับ f เป็นหลัก)
    mix: [70, 20, 10],                             // ชั้น f: แร่ระดับ f 70% / f+1 20% / f+2 10% (เกินชนิดสุดท้ายนับเป็นชนิดสุดท้าย → ชั้น 10 เป็นคริสตัลล้วน)
    maxOres: 45,                                   // ก้อนแร่สูงสุดต่อชั้น (ปกติราว 1 ก้อนต่อพื้น orePer ช่อง ≈ 30–40 ก้อน)
    orePer: 18,                                    // พื้นเดินได้กี่ช่องต่อแร่ 1 ก้อน (ยิ่งมาก แร่ยิ่งบาง ต้องเดินหา)
    oreGap: 3,                                     // ก้อนแร่ห่างกันอย่างน้อย 3 ช่อง (ไม่เกาะกันเป็นพืด ต้องเดินหา)
    respawnMs: DAY_MS / 3,                         // ก้อนแร่ที่ขุดหมดเกิดใหม่หลัง 1/3 วันในเกม (4 นาที แร่น้อยลงจึงเกิดไวขึ้น) ที่ช่องสุ่มใหม่ในชั้นเดิม (ไม่ใช่ที่เดิม) พร้อมสุ่มชนิด/ขนาดใหม่
    hpBase: 13,                                    // HP ก้อนเล็ก = hpBase × ระดับอีเต้อขั้นต่ำของแร่ (ใช้อีเต้อที่พอดีกับแร่ ≈ 21 ครั้งต่อก้อนเฉลี่ย)
    door: [25, 26, 27], y: 8,                       // ปากถ้ำบนหน้าผา (แถว y=8) เดินเข้าจากด้านล่าง (y=9)
  };
  // ขนาดก้อน: ไม่เท่ากัน สุ่มตอนเกิด w = น้ำหนักฐานของแมพ 50/40/10 (ชั้นจริงใช้ SIZE_MIX ด้านล่าง) hp = ตัวคูณ HP drop = ชิ้นที่ได้ [ต่ำสุด, สูงสุด] สุ่มทุกครั้งที่ขุดแตก
  const ORE_SIZES = [
    { id: 's', name: 'เล็ก',  w: 50, hp: 1,   drop: [1, 3] },
    { id: 'm', name: 'กลาง', w: 40, hp: 2,   drop: [3, 5] },
    { id: 'l', name: 'ใหญ่', w: 10, hp: 3.5, drop: [5, 8] },
  ];
  // แร่ 10 ระดับ (ขายที่ร้านช่างเหมือง หมวด "แร่" ไม่เสื่อม) • lv = เลเวลนักขุดแร่ที่ต้องมี • pick = ระดับอีเต้อต่ำสุด • sell/xp = ต่อ 1 ชิ้น (ปรับให้เหรียญและ XP ต่อชม. ใกล้ชาวนา ดู tools/levelsim.js)
  const ORES = {
    stone:    { name: 'หิน',       emoji: '🪨', lv: 1,  pick: 1, sell: 5,  xp: 5 },
    coal:     { name: 'ถ่านหิน',    emoji: '⚫', lv: 2,  pick: 1, sell: 6,  xp: 5 },
    copper:   { name: 'ทองแดง',    emoji: '🟠', lv: 3,  pick: 2, sell: 9,  xp: 6 },
    iron:     { name: 'เหล็ก',      emoji: '🔩', lv: 4,  pick: 2, sell: 11, xp: 7 },
    silver:   { name: 'เงิน',       emoji: '🥈', lv: 5,  pick: 3, sell: 14, xp: 7 },
    gold:     { name: 'ทองคำ',     emoji: '🥇', lv: 6,  pick: 3, sell: 17, xp: 8 },
    amethyst: { name: 'อเมทิสต์',   emoji: '🟣', lv: 7,  pick: 4, sell: 19, xp: 9 },
    ruby:     { name: 'ทับทิม',     emoji: '🔴', lv: 8,  pick: 4, sell: 21, xp: 9 },
    emerald:  { name: 'มรกต',      emoji: '🟢', lv: 9,  pick: 5, sell: 24, xp: 9 },
    crystal:  { name: 'คริสตัล',    emoji: '💎', lv: 10, pick: 6, sell: 27, xp: 10 },
    // ชั้น 11–20 (30 ต.ค. 2026): ใช้อีเต้อเพชร (ระดับ 6) ทุกชนิด hpm = ตัวคูณ HP (แข็งขึ้นทีละนิด) ชั้น 20 เป็นแกนดวงดาวล้วน
    opal:      { name: 'โอปอล',      emoji: '🤍', lv: 11, pick: 6, sell: 29, xp: 12, hpm: 1.1 },
    topaz:     { name: 'โทแพซ',      emoji: '🟡', lv: 12, pick: 6, sell: 31, xp: 13, hpm: 1.2 },
    sapphire:  { name: 'ไพลิน',      emoji: '🔵', lv: 13, pick: 6, sell: 33, xp: 14, hpm: 1.3 },
    garnet:    { name: 'การ์เน็ต',    emoji: '🟤', lv: 14, pick: 6, sell: 35, xp: 15, hpm: 1.4 },
    jade:      { name: 'หยก',        emoji: '🍀', lv: 15, pick: 6, sell: 37, xp: 16, hpm: 1.5 },
    obsidian:  { name: 'ออบซิเดียน',   emoji: '⬛', lv: 16, pick: 6, sell: 39, xp: 17, hpm: 1.6 },
    moonstone: { name: 'มูนสโตน',    emoji: '🌙', lv: 17, pick: 6, sell: 41, xp: 18, hpm: 1.7 },
    sunstone:  { name: 'ซันสโตน',    emoji: '🌞', lv: 18, pick: 6, sell: 43, xp: 19, hpm: 1.8 },
    mythril:   { name: 'มิทริล',      emoji: '🔷', lv: 19, pick: 6, sell: 45, xp: 20, hpm: 1.9 },
    starcore:  { name: 'แกนดวงดาว',  emoji: '⭐', lv: 20, pick: 6, sell: 47, xp: 21, hpm: 2.0 },
  };
  // สัดส่วนขนาดก้อน [เล็ก, กลาง, ใหญ่] % ต่อชั้น (ตารางปรับรายชั้นได้): ชั้นตื้นมีแต่ก้อนเล็กเป็นส่วนใหญ่ ชั้นลึกก้อนกลาง/ใหญ่มากขึ้น ชั้น 5–6 ≈ ฐาน 50/40/10
  const SIZE_MIX = [[60, 35, 5], [58, 36, 6], [56, 37, 7], [53, 38, 9], [51, 40, 9], [49, 41, 10], [46, 42, 12], [44, 43, 13], [42, 44, 14], [40, 45, 15], [39, 45, 16], [38, 45, 17], [37, 45, 18], [36, 45, 19], [35, 45, 20], [34, 45, 21], [33, 45, 22], [32, 45, 23], [31, 45, 24], [30, 45, 25]];
  const ORE_ORDER = Object.keys(ORES);
  for (const o of Object.values(ORES)) o.hp = Math.round(MINE.hpBase * o.pick * (o.hpm || 1));
  const oreXp = (xp, lv) => Math.round(xp * (1 + MINE.xpPerLv * (perkLv(lv) - 1)));
  const oreHp = (kind, size) => Math.round(ORES[kind].hp * ORE_SIZES[size].hp);
  const floorMix = f => { const d = {}; MINE.mix.forEach((w, i) => { const k = ORE_ORDER[Math.min(ORE_ORDER.length, f + i) - 1]; d[k] = (d[k] || 0) + w; }); return d; }; // สัดส่วน % ของแร่แต่ละชนิดในชั้น f
  const rollOre = (f, R) => { let t = R() * 100, k = ORE_ORDER[ORE_ORDER.length - 1]; for (const [id, w] of Object.entries(floorMix(f))) { if ((t -= w) < 0) { k = id; break; } } return k; };
  const sizeMix = f => SIZE_MIX[Math.max(1, Math.min(SIZE_MIX.length, f | 0)) - 1] || ORE_SIZES.map(z => z.w); // สัดส่วนขนาด % ของชั้น f (ไม่ระบุชั้น = ฐาน)
  const rollSize = (R, f) => { const mx = f ? sizeMix(f) : ORE_SIZES.map(z => z.w); let t = R() * 100; for (let i = 0; i < mx.length; i++) if ((t -= mx[i]) < 0) return i; return mx.length - 1; };
  const rollDrop = (size, R) => { const d = ORE_SIZES[size].drop; return d[0] + Math.floor(R() * (d[1] - d[0] + 1)); };
  const caveFloor = scene => { const m = typeof scene === 'string' && /^@cave(\d+)$/.exec(scene); return m ? +m[1] : 0; }; // p.scene ของถ้ำคือ '@cave<ชั้น>' (0 = ไม่ใช่ถ้ำ)
  // แผนที่ถ้ำ: ตารางขนาดเท่าแมพเมือง (นอกถ้ำเป็น VOID) ทางออก/บันไดขึ้นอยู่ล่างกลาง จุดเกิดหน้าทางออก บันไดลงอยู่ห้องไกลสุด • ทุกอย่างคำนวณแบบตายตัวจากเลขชั้น (เซิร์ฟเวอร์กับหน้าเว็บได้ผังเดียวกัน)
  const CAVE = { x0: 11, y0: 13, x1: 52, y1: 43, exit: [30, 31, 32], spawn: { x: 31.5 * TS, y: 40.5 * TS } }; // กรอบถ้ำ 42×31 (ครึ่งหนึ่งของแบบเดิม 60×42) วางกลางล่างของตาราง
  const caveOpen = t => t === T.CAVE || t === T.MOUTH || t === T.DOWN;
  function caveReach(m) { // จำนวนช่องเดินได้ที่ไปถึงจากหน้าทางออก (4 ทิศ ก้อนแร่/หินกั้น)
    const sx = 31, sy = CAVE.y1 - 1, seen = new Uint8Array(W * H), q = [sy * W + sx]; seen[q[0]] = 1; let n = 0;
    for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c / W) | 0; n++;
      for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, k = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[k] || !caveOpen(m[ny][nx])) continue; seen[k] = 1; q.push(k); } }
    return n;
  }
  // ผังถ้ำแบบธรรมชาติ: โถงโล่งขอบโค้งไม่เรียบ 7–8 โถง ต่อกันด้วยอุโมงค์คดเคี้ยวกว้าง ~3 ช่อง เกลาขอบด้วย cellular automata แล้ววางหินก้อนโดดๆ (ก้อนละ 1–3 ช่อง) ห่างกันเป็นสิ่งกีดขวางบางๆ
  function makeCaveMap(floor) {
    const f = Math.max(1, Math.min(MINE.floors, floor | 0 || 1)), R = rng(20261030 + f * 7919);
    const m = Array.from({ length: H }, () => new Array(W).fill(T.VOID));
    for (let y = CAVE.y0; y <= CAVE.y1; y++) for (let x = CAVE.x0; x <= CAVE.x1; x++) m[y][x] = T.ROCK;
    const inner = (x, y) => x > CAVE.x0 && x < CAVE.x1 && y > CAVE.y0 && y < CAVE.y1; // ขอบกรอบเป็นหินเสมอ
    const dig = (cx, cy, r) => { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && inner(x, y)) m[y][x] = T.CAVE; };
    const halls = [{ x: 31, y: 38, r: 5 }], want = 7 + Math.floor(R() * 2); // โถงแรกอยู่หน้าทางออก
    for (let i = 0; i < 500 && halls.length < want; i++) {
      const h = { x: CAVE.x0 + 6 + R() * (CAVE.x1 - CAVE.x0 - 12), y: CAVE.y0 + 5 + R() * (CAVE.y1 - CAVE.y0 - 13), r: 4.5 + R() * 2.5 };
      if (halls.some(o => Math.hypot(o.x - h.x, o.y - h.y) < o.r + h.r)) continue;
      halls.push(h);
    }
    for (const h of halls) { dig(h.x, h.y, h.r); for (let k = 0; k < 5; k++) { const a = R() * Math.PI * 2, d = h.r * (0.4 + R() * 0.5); dig(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d * 0.8, h.r * (0.45 + R() * 0.35)); } } // วงกลมซ้อนกันให้ขอบโถงเป็นหยัก
    const tunnel = (a, b) => { let x = a.x, y = a.y; for (let i = 0; i < 200; i++) { const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy); if (d < 1.5) break; x += dx / d + (R() - 0.5) * 0.9; y += dy / d + (R() - 0.5) * 0.9; dig(x, y, 1.6 + R() * 0.8); } };
    for (let i = 1; i < halls.length; i++) { let best = 0, bd = 1e9; for (let j = 0; j < i; j++) { const d = Math.hypot(halls[i].x - halls[j].x, halls[i].y - halls[j].y); if (d < bd) { bd = d; best = j; } } tunnel(halls[best], halls[i]); }
    for (let i = 0; i < 2 && halls.length > 3; i++) { const a = 1 + Math.floor(R() * (halls.length - 1)), b = 1 + Math.floor(R() * (halls.length - 1)); if (a !== b) tunnel(halls[a], halls[b]); } // ทางวน
    for (let pass = 0; pass < 2; pass++) { // เกลาขอบ: ช่องที่รอบตัวเป็นหินเกินครึ่งกลายเป็นหิน หินที่โดดเดี่ยวกลายเป็นพื้น
      const n = m.map(r => r.slice());
      for (let y = CAVE.y0 + 1; y < CAVE.y1; y++) for (let x = CAVE.x0 + 1; x < CAVE.x1; x++) { let c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && m[y + dy][x + dx] === T.ROCK) c++; if (c > 4) n[y][x] = T.ROCK; else if (c < 4) n[y][x] = T.CAVE; }
      for (let y = CAVE.y0 + 1; y < CAVE.y1; y++) m[y] = n[y];
    }
    for (let y = CAVE.y1 - 3; y < CAVE.y1; y++) for (let x = 29; x <= 33; x++) m[y][x] = T.CAVE; // หน้าทางออกโล่งเสมอ
    for (const x of CAVE.exit) m[CAVE.y1][x] = T.MOUTH; // ทางออก/บันไดขึ้นกลางผนังล่าง
    { // ตัดพื้นที่ที่เดินไปไม่ถึงทิ้ง แล้วหาจุดไกลสุดจากทางออก (ไว้วางบันไดลง)
      const dist = new Map(), q = [[31, CAVE.y1 - 1]]; dist.set(q[0].join(), 0); let far = q[0];
      for (let i = 0; i < q.length; i++) { const [x, y] = q[i], d = dist.get(x + ',' + y); if (d > dist.get(far.join())) far = q[i]; for (const [dx, dy] of DIRS) { const k = (x + dx) + ',' + (y + dy); if (!dist.has(k) && m[y + dy][x + dx] === T.CAVE) { dist.set(k, d + 1); q.push([x + dx, y + dy]); } } }
      for (let y = CAVE.y0; y < CAVE.y1; y++) for (let x = CAVE.x0; x <= CAVE.x1; x++) if (m[y][x] === T.CAVE && !dist.has(x + ',' + y)) m[y][x] = T.ROCK;
      if (f < MINE.floors) { // บันไดลง 3 ช่องที่จุดไกลสุด (ชั้นสุดท้ายไม่มี) เปิดพื้นรอบบันได 5×3 ให้ยืนได้
        const cx = Math.max(CAVE.x0 + 3, Math.min(CAVE.x1 - 3, far[0])), cy = Math.max(CAVE.y0 + 2, Math.min(CAVE.y1 - 4, far[1]));
        for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 2; x <= cx + 2; x++) m[y][x] = T.CAVE;
        for (let x = cx - 1; x <= cx + 1; x++) m[cy][x] = T.DOWN;
      }
    }
    // หินก้อนโดดเป็นสิ่งกีดขวางบางๆ: วางกลางพื้นโล่ง (รอบตัวเป็นพื้นทั้งหมด) ห่างกัน ≥ 4 ช่อง ไม่ใกล้ทางออก/บันไดลง และพื้นที่ที่เหลือยังเดินถึงกันหมด
    let total = caveReach(m); const rocks = [], nearDown = (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (m[y + dy] && m[y + dy][x + dx] === T.DOWN) return true; return false; };
    for (let i = 0, goal = 9 + Math.floor(R() * 6); i < 400 && rocks.length < goal; i++) {
      const x = CAVE.x0 + 2 + Math.floor(R() * (CAVE.x1 - CAVE.x0 - 3)), y = CAVE.y0 + 2 + Math.floor(R() * (CAVE.y1 - CAVE.y0 - 3));
      if (Math.hypot(x - 31, y - (CAVE.y1 - 1)) < 5 || nearDown(x, y) || rocks.some(([a, b]) => Math.abs(a - x) < 4 && Math.abs(b - y) < 4)) continue;
      const cells = [[x, y]]; if (R() < 0.5) cells.push(R() < 0.5 ? [x + 1, y] : [x, y + 1]); if (cells.length > 1 && R() < 0.4) cells.push([x + 1, y + 1]);
      const mine = (a, b) => cells.some(([c, d]) => c === a && d === b);
      if (!cells.every(([a, b]) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!mine(a + dx, b + dy) && m[b + dy][a + dx] !== T.CAVE) return false; return true; })) continue;
      for (const [a, b] of cells) m[b][a] = T.ROCK;
      if (caveReach(m) === total - cells.length) { total -= cells.length; rocks.push([x, y]); } else for (const [a, b] of cells) m[b][a] = T.CAVE;
    }
    return m;
  }
  // ตำแหน่งก้อนแร่ในชั้น f (ตายตัว): ราว 1 ก้อนต่อพื้น MINE.orePer ช่อง (ไม่เกิน MINE.maxOres) ห่างกันอย่างน้อย MINE.oreGap ช่อง ชอบเกาะผนังถ้ำมากกว่ากลางโถง
  // วางเมื่อพื้นที่เหลือยังเดินถึงกันหมด และทุกก้อนยังมีช่องว่างให้ยืนขุดอย่างน้อย 1 ด้าน • คืน [{x,y,k,s}] (ช่องยังเป็นพื้นถ้ำ ผู้เรียกใส่ ORE เอง)
  const oreNear = (m, x, y) => { for (let dy = -MINE.oreGap; dy <= MINE.oreGap; dy++) for (let dx = -MINE.oreGap; dx <= MINE.oreGap; dx++) if (m[y + dy] && m[y + dy][x + dx] === T.ORE) return true; return false; };
  function caveOreSpots(m, floor) {
    const f = Math.max(1, Math.min(MINE.floors, floor | 0 || 1)), R = rng(777 + f * 104729), cand = [];
    let total = 0;
    for (let y = CAVE.y0; y <= CAVE.y1; y++) for (let x = CAVE.x0; x <= CAVE.x1; x++) {
      if (caveOpen(m[y][x])) total++;
      if (y > CAVE.y0 && y < CAVE.y1 && x > CAVE.x0 && x < CAVE.x1 && m[y][x] === T.CAVE && Math.hypot(x - 31, y - (CAVE.y1 - 1)) >= 5 && ![-1, 0, 1].some(dy => [-1, 0, 1].some(dx => m[y + dy][x + dx] === T.DOWN))) {
        const wall = DIRS.some(([dx, dy]) => m[y + dy][x + dx] === T.ROCK); cand.push([x, y, R() * (wall ? 0.45 : 1)]);
      }
    }
    cand.sort((a, b) => a[2] - b[2]);
    const cap = Math.min(MINE.maxOres, Math.round(total / MINE.orePer)), out = [], free = (x, y) => DIRS.filter(([dx, dy]) => caveOpen(m[y + dy][x + dx])).length;
    for (const [x, y] of cand) {
      if (out.length >= cap) break;
      if (!free(x, y) || oreNear(m, x, y)) continue;
      m[y][x] = T.ORE;
      if (caveReach(m) !== total - out.length - 1) { m[y][x] = T.CAVE; continue; }
      out.push({ x, y, k: rollOre(f, R), s: rollSize(R, f) });
    }
    for (const o of out) m[o.y][o.x] = T.CAVE;
    return out;
  }
  const treeWhereOk = (m, x, y, where) => {
    if (!where) return true;
    if (where === 'north') return y < 14;
    // ต้นไม้ต้องห่างของที่ไม่ใช่หญ้า 2 ช่องอยู่แล้ว (treeSpotOk) ระยะที่หาน้ำ/ทรายจึงต้องเกิน 2
    const R = where === 'water' ? 4 : where === 'sand' ? 3 : 4, want = where === 'water' ? [T.WATER] : where === 'sand' ? [T.SAND] : null;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const t = m[y + dy] && m[y + dy][x + dx]; if (t === undefined) continue;
      if (want ? want.includes(t) : (t !== T.GRASS && t !== T.TREE)) return !!want; }
    return !want;
  };
  const pickTreeKind = (m, x, y, rnd) => { // สุ่มชนิดต้นไม้ที่ช่องนี้ตามที่เกิดได้และน้ำหนัก
    const ok = Object.entries(TREE_KINDS).filter(([, k]) => treeWhereOk(m, x, y, k.where)); let t = rnd() * ok.reduce((a, [, k]) => a + k.pct, 0);
    for (const [id, k] of ok) if ((t -= k.pct) < 0) return id; return 'broad';
  };
  // ต้นไม้งอกใหม่: สุ่มชนิดตามสัดส่วน % (pct) เฉพาะชนิดที่ตอนนี้มีช่องให้เกิด แล้วเลือกช่องที่ชนิดนั้นเกิดได้ • spots = [[x,y]] ช่องที่งอกได้ • คืน {x,y,k} หรือ null
  // (ชนิดที่ถูกตัดไปไม่ได้งอกคืนเร็วกว่าสัดส่วนของมัน ไม่ใช่ทางลัดฟาร์มไม้หายาก: อัตราที่ไม้หายากงอก = งอกรวม × pct ของมัน)
  function pickTreeSpawn(m, rnd, spots) {
    const kinds = Object.entries(TREE_KINDS).map(([id, K]) => ({ id, pct: K.pct, ok: spots.filter(([x, y]) => treeWhereOk(m, x, y, K.where)) })).filter(o => o.ok.length);
    let t = rnd() * kinds.reduce((a, o) => a + o.pct, 0);
    for (const o of kinds) if ((t -= o.pct) < 0) { const [x, y] = o.ok[Math.floor(rnd() * o.ok.length)]; return { x, y, k: o.id }; }
    return null;
  }
  // ปรับสัดส่วนชนิดต้นไม้ที่มีอยู่แล้วให้ได้ตามโควตา % (ใช้ครั้งเดียวตอนย้ายระบบ) • list = [[x,y]] • คืน { kinds: Map 'x,y' → ชนิด, add: [[x,y]] ต้องปลูกเพิ่ม, drop: [[x,y]] ต้องถอน } จำนวนต้นรวมเท่าเดิม
  // ไผ่/มะพร้าว/เมเปิล/สนเกิดได้เฉพาะริมน้ำ/ริมทราย/ทางเหนือ: ใช้ต้นเดิมที่อยู่ถูกที่ก่อน ขาดเท่าไรปลูกใหม่ในช่องที่เหมาะแล้วถอนต้นอื่นออกเท่ากัน • ที่เหลือแจกตามโควตา ต้นที่เกิดได้น้อยชนิดเลือกก่อน
  function planTreeMix(m, list, rnd) {
    const n = list.length, quota = id => TREE_KINDS[id].pct * n / 100, got = {}, kinds = new Map(), add = [], drop = [];
    const m2 = m.map(r => r.slice()); for (const [x, y] of list) m2[y][x] = T.GRASS;
    const live = new Map(list.map(([x, y]) => [x + ',' + y, [x, y]])), fresh = new Set();
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const elig = (x, y) => Object.entries(TREE_KINDS).filter(([, K]) => treeWhereOk(m2, x, y, K.where)).map(([id]) => id);
    const PLACED = ['bamboo', 'coconut', 'maple', 'pine']; // ชนิดที่เกิดได้เฉพาะที่ (ริมน้ำ ริมทราย ทางเหนือ) จัดก่อน ชนิดที่หายากกว่าก่อน
    for (const id of PLACED) {
      const K = TREE_KINDS[id]; let need = Math.round(quota(id));
      for (const [k, [x, y]] of shuffle([...live])) { if (!need) break; if (!kinds.has(k) && treeWhereOk(m2, x, y, K.where)) { kinds.set(k, id); got[id] = (got[id] || 0) + 1; need--; } }
      if (need > 0) {
        const free = []; for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (!live.has(x + ',' + y) && treeSpotOk(m2, x, y) && treeWhereOk(m2, x, y, K.where)) free.push([x, y]);
        for (const [x, y] of shuffle(free)) {
          if (!need) break;
          const spare = [...live].filter(([k]) => !kinds.has(k)).sort((a, b) => elig(...b[1]).length - elig(...a[1]).length)[0]; if (!spare) break; // ถอนต้นที่เกิดได้หลายชนิดสุด (กระทบสัดส่วนน้อยสุด)
          if (fresh.has(spare[0])) { fresh.delete(spare[0]); const i = add.findIndex(q => q[0] + ',' + q[1] === spare[0]); if (i >= 0) add.splice(i, 1); } else drop.push(spare[1]);
          live.delete(spare[0]); const k = x + ',' + y; live.set(k, [x, y]); fresh.add(k); add.push([x, y]); kinds.set(k, id); got[id] = (got[id] || 0) + 1; need--;
        }
      }
    }
    const rest = [...live].filter(([k]) => !kinds.has(k)).map(([k, [x, y]]) => ({ k, ok: elig(x, y).filter(id => !PLACED.includes(id)), r: rnd() })).sort((a, b) => a.ok.length - b.ok.length || a.r - b.r);
    for (const it of rest) {
      let best = 'broad', bs = -1e9;
      for (const id of it.ok) { const sc = quota(id) - (got[id] || 0) + rnd() * 0.3; if (sc > bs) { bs = sc; best = id; } }
      got[best] = (got[best] || 0) + 1; kinds.set(it.k, best);
    }
    return { kinds, add, drop };
  }
  // สัตว์ป่วย: ป่วยได้พร้อมกันไม่เกิน max ตัว (รวมทุกชนิด) รักษาด้วยยาตัวเดียวกัน ป่วยแล้วถ้าไม่รักษาจะตายเร็วกว่าหิวปกติ
  const SICK = { max: 1, graceMs: 150000, checkMs: DAY_MS, chance: 0.3 }; // สัตว์ป่วยทีละ 1 ตัวเท่านั้น สุ่มวันละครั้ง (1 วันในเกม = 12 นาทีที่มีคนออนไลน์) โอกาส 30% วันไหนไม่ป่วยก็ข้ามไปวันถัดไปเลย
  const SELLBACK = 0.7;                    // ขายของที่ซื้อมา (เสื้อผ้า คันเบ็ด ขวาน ตะเกียง) คืนร้านได้ 70% ของราคาซื้อ (หัก 30%)
  const CASINO = { bets: [10, 25, 50, 100], perRound: 0.04, recoverPerHour: 0.15 }; // คาสิโน: ความล้า/โชคของผู้เล่น (ซ่อนจากผู้เล่น)
  // เศรษฐกิจ: ตลาดรับซื้อมีราคาขึ้นลง (ขายเยอะราคาตก ปล่อยไว้ราคากลับมา) ค่าบริการตู้เกม 5% ของเงินรางวัลเป็นตัวดูดเหรียญออกจากระบบ
  // เหยื่อ 3 ระดับ: ยิ่งแพงยิ่งเจอปลาแพง (mul = ตัวคูณน้ำหนักสุ่มตามกลุ่มราคาปลา: <20 / <60 / <120 / 120+, boot = รองเท้าเก่า)
  const BAITS = {
    1: { id: 'bait',   name: 'ไส้เดือน',        emoji: '🪱', price: 2,  mul: [1, 1, 1, 1],           boot: 1 },
    2: { id: 'bait_2', name: 'กุ้งฝอยสด',       emoji: '🍤', price: 8,  lv: 4, mul: [0.4, 1.4, 3, 5], boot: 0.3 },
    3: { id: 'bait_3', name: 'ปลอมทองคำ', emoji: '✨', price: 25, lv: 6, mul: [0.03, 0.35, 5, 14],  boot: 0 },
  };
  const fishClass = f => (f.sell < 20 ? 0 : f.sell < 60 ? 1 : f.sell < 120 ? 2 : 3);
  const baitWeight = (f, tier) => { const b = BAITS[tier] || BAITS[1]; return f.id === 'boot' ? b.boot : b.mul[fishClass(f)]; };
  const BAIT_PRICE = 2;       // เหยื่อตกปลา: ใช้ 1 ชิ้นต่อการเหวี่ยง 1 ครั้ง
  const RAKE = 0.05;          // ค่าบริการตู้เกม (หักจากรางวัลของผู้ชนะที่มีเดิมพัน)
  // ตลาดมีลิมิต: ขายต่อเนื่องยิ่งขายเยอะ ราคาต่อชิ้นยิ่งถูกลงเรื่อยๆ (ชิ้นละ -4% ทบต่อกัน ต่ำสุด 20% ของราคาปกติ) และฟื้นตัวช้า
  const MARKET = { drop: 0.01, min: 0.2, max: 1.4, recover: 0.06 }; // drop = ราคาต่อชิ้นลดลงชิ้นละ 1 จุดเปอร์เซ็นต์ของราคาฐาน (เชิงเส้น: ชิ้นที่ N ได้ (101-N)% เมื่อราคาตั้งต้น 100%) • min = พื้นราคาต่อชิ้น = 20% ของราคาฐาน (ถึงพื้นที่ชิ้นที่ 81)
  // ตลาดแยกต่อคน: ราคาที่ผู้เล่นเห็น = ตลาดกลาง × ตลาดส่วนตัว × โบนัสความหลากหลาย ขายชนิดเดิมซ้ำๆ ตลาดส่วนตัวของคนนั้นตกหนัก (share = สัดส่วนที่ตกเป็นของส่วนตัว) และฟื้นช้า (recover ต่อ 1 นาทีที่ออนไลน์)
  const PMARKET = { share: 0.75, min: 0.25, recover: 0.03 };
  // ความทนทานเครื่องมือ: ใช้งานทุกครั้งสึกหรอ 1 หน่วย ใช้ครบแล้วใช้ไม่ได้จนกว่าจะซ่อมที่ร้านเสียเหรียญ (ค่าซ่อมคิดตามส่วนที่สึกหรอ) = รายจ่ายที่เกิดขึ้นสม่ำเสมอ
  const DURABILITY = {
    hoe:   { max: [0, 120, 120, 120], fix: [0, 24, 24, 24],  shop: 'farm',   name: 'จอบ' },
    rod:   { max: [0, 100, 140, 200, 280, 360, 450, 560], fix: [0, 30, 72, 168, 400, 900, 2400, 6000], shop: 'fish',   name: 'เบ็ดตกปลา' },
    axe:   { max: [0, 90, 140, 220, 320, 450],  fix: [0, 36, 96, 216, 480, 1320], shop: 'wood',   name: 'ขวาน' },
    pick:  { max: [0, 100, 180, 400, 700, 1100, 1800], fix: [0, 40, 110, 240, 600, 1350, 2700], shop: 'mine',  name: 'อีเต้อ' }, // ขุดแตก 1 ก้อน = สึก 1 ครั้ง (ไม่ใช่ทุกครั้งที่ฟาด) ตัวเลขเป็นจำนวนก้อน
  };
  // อัตราสึกหรอ: เกจเท่าเดิม แต่ใช้ 1 ครั้งสึก base หน่วย (เดิม 1) และ "ความร้อน" สะสมเมื่อใช้ถี่ๆ ต่อเนื่อง: ทุกครั้งที่ใช้ +1, เย็นลง cool ต่อวินาที
  // ตัวคูณการสึก = 1 + min(maxBonus, ความร้อน × perHeat) → ใช้ถี่และนานได้สูงสุด 2 เท่า (พักสักครู่ก็เย็นลง) เตือนเมื่อความร้อนถึง warnHeat
  const WEAR_RATE = { base: 1.35, cool: 0.2, perHeat: 0.01, maxBonus: 1, warnHeat: 35 };
  // ซ่อมได้จำกัด: ซ่อมแต่ละครั้งความทนทานสูงสุดลดลง decay ของค่าเดิม ค่าซ่อมแพงขึ้น growth ต่อครั้ง ซ่อมครบ maxFixes ครั้งแล้วซ่อมไม่ได้อีก ต้องซื้อใหม่ (ราคา TOOL_PRICE)
  // สมดุล: ค่าซ่อมเต็ม = pct × ราคาซื้อ × (1 + growth × ครั้งที่ซ่อมมาแล้ว) แต่ได้ความทนทานน้อยลงเรื่อยๆ → ซ่อมครั้งที่ ~4 ขึ้นไปต่อหน่วยการใช้งานแพงกว่าซื้อใหม่
  const REPAIR = { decay: 0.15, maxFixes: 3, growth: 0.5, pct: 0.25 };
  const TOOL_PRICE = { hoe: [0, 80, 80, 80], rod: [0, 100, 250, 900, 2500, 6000, 16000, 40000], axe: [0, 50, 220, 700, 2000, 5500], pick: [0, 60, 260, 800, 2000, 4500, 9000] };
  const tierN = t => Math.max(1, Math.min(7, t || 1)); // ระดับ 4 มีเฉพาะคันเบ็ด ระดับ 4–6 ของอีเต้อ
  const durMax = (tool, tier, fixes) => Math.max(1, Math.floor(DURABILITY[tool].max[tierN(tier)] * (1 - REPAIR.decay * Math.min(REPAIR.maxFixes, fixes || 0))));
  const toolPrice = (tool, tier) => TOOL_PRICE[tool][tierN(tier)];
  // ค่าซ่อมครั้งถัดไป (ซ่อมแล้วเต็มที่ความทนทานสูงสุดใหม่ที่ต่ำลง) เทียบกับความเสียหายของค่าสูงสุดปัจจุบัน
  const repairCost = (tool, tier, cur, fixes) => { const n = fixes || 0, mx = durMax(tool, tier, n); return Math.max(1, Math.ceil(toolPrice(tool, tier) * REPAIR.pct * (1 + REPAIR.growth * n) * Math.max(0, mx - cur) / mx)); };
  const canRepair = (tool, tier, cur, fixes) => (fixes || 0) < REPAIR.maxFixes && cur < durMax(tool, tier, (fixes || 0) + 1);
  // เทรดของระหว่างผู้เล่น: เทรดเหรียญไม่ได้ เทรดได้เฉพาะของที่ไม่ผูกกับตัว มูลค่ารวมฝั่งละไม่เกิน maxValue ต่อรอบ
  const TRADE = { maxValue: 1000, range: 8 };
  // แผงฝากขาย (ขั้น 3): วางของขายให้ผู้เล่นอื่นด้วยเหรียญ ราคาต่อชิ้นได้ min–max เท่าของมูลค่ามาตรฐาน (กันโอนเงินผ่านบัญชีสำรอง) • ภาษี tax หายจากระบบ
  // ต้องตั้ง PIN ทั้งคนขายและคนซื้อ • คนละไม่เกิน slots รายการ • ไม่มีคนซื้อภายใน days วัน ของคืนกระเป๋าคนขาย (อายุของ/ความสดติดไปด้วย)
  const STALL = { tax: 0.08, slots: 6, min: 0.5, max: 2, days: 3, maxN: 200 };
  // ใบงาน NPC (ขั้น 3): ทุกวันมีใบงานที่ต้องใช้ของ 2–3 หมวดในใบเดียว จ่าย pay เท่าของมูลค่ามาตรฐาน จำนวนใบ = perPlayer × คนที่เข้าเกมวันนี้ (minN–maxN) คนละไม่เกิน perDay ใบ/วัน
  const ORDERS = { pay: 1.2, perPlayer: 1, minN: 2, maxN: 8, perDay: 2, qty: [3, 6] };
  // โรงหนังกลางแปลง: ฉายวิดีโอเดียวกันให้ทุกคนที่เข้าไปดู (ได้ยินเสียงเฉพาะคนที่ดู) ตั๋วชิ้นละ TICKET เหรียญต่อการฉาย 1 รอบ
  const TICKET = 15;
  const MOVIES = [
    { id: 'bbb',    name: 'Big Buck Bunny',  emoji: '🐰', yt: 'aqz-KE-bpKQ', sec: 596 },
    { id: 'sintel', name: 'Sintel',          emoji: '🐉', yt: 'eRsGyueVLvQ', sec: 888 },
    { id: 'tos',    name: 'Tears of Steel',  emoji: '🤖', yt: 'R6MlUcmOul8', sec: 734 },
    { id: 'ed',     name: "Elephant's Dream", emoji: '🐘', yt: 'TLkA0RELQ1g', sec: 654 },
  ];
  // พลังงาน ⚡ และคูลดาวน์ปลาหายาก (Phase 2): งานหนักกินพลังงาน ฟื้นเองช้าๆ (แม้ออฟไลน์) นั่งพักที่ม้านั่งฟื้นไวกว่า กินอาหารฟื้นเพิ่มนิดหน่อย
  // **พลังงานที่เสียผูกกับรายได้ของงานนั้น**: ทุกงานแลกพลังงาน 1 หน่วย ต่อมูลค่าผลงาน coinsPerEnergy เหรียญ (ราคาฐานของของที่ได้) จึงทำเงินได้ไม่เกิน ~ (60000/regenMs × coinsPerEnergy) เหรียญฐาน/นาที ไม่ว่าทำงานอะไร
  //   ผักหนึ่งรอบ (ขุด+ปลูก+รดน้ำ+เก็บ) รวม = ราคาขาย/coinsPerEnergy (ขั้นต่ำ 4) • ปลา = ราคาปลาที่ได้ • ตัดไม้ = มูลค่าไม้ที่ได้
  // เกินพลังงานที่มี = ติด "หนี้พลังงาน" (ค่าติดลบ ต่ำสุด -max) ต้องพักจนถึง resume: งานแพงๆ จึงพักนานตามมูลค่า ไม่มีช่องโหว่ทำงานแพงตอนเหลือพลังงานนิดเดียว
  // regenMs = กี่ มิลลิวินาทีต่อ 1 หน่วย • rareCdMs = ตกปลาหายาก (ราคา ≥ 100) ได้อีกครั้งหลังพักกี่มิลลิวินาที
  const ENERGY = { on: false, max: 100, regenMs: 4000, sitMul: 3, resume: 10, eatMul: 0.4, rareCdMs: 6 * 60 * 1000, coinsPerEnergy: 6, cost: { dig: 1, water: 1, plant: 1 },
    // ความล้างานซ้ำกลุ่มเดียว: ทำงานกลุ่มเดียวต่อเนื่อง (ไร่/ตกปลา/ตัดไม้) ต้นทุนพลังงานของกลุ่มนั้นแพงขึ้นสูงสุด +max (×1.5) สลับกลุ่มจึงทำเงินต่อพลังงานได้ดีกว่า
    // ความล้าของกลุ่ม += ต้นทุนฐานของงาน, เพิ่มต้นทุน = ความล้า/scale (เพดาน max), ลดครึ่งหนึ่งทุก halfLifeMs (นั่งที่ม้านั่งลดเร็วขึ้น sitMul เท่า, นับแม้ออฟไลน์ กันออกเกมเข้าใหม่เพื่อล้างค่า) • ใส่ var: null เพื่อปิด
    var: { scale: 50, max: 0.5, halfLifeMs: 120000, group: { dig: 'farm', water: 'farm', plant: 'farm', harvest: 'farm', fish: 'fish', chop: 'wood' } } };
  const energyCost = (kind, value) => ENERGY.cost[kind] !== undefined ? ENERGY.cost[kind]
    : Math.max(1, Math.round(value / ENERGY.coinsPerEnergy) - (kind === 'harvest' ? ENERGY.cost.dig + ENERGY.cost.plant + ENERGY.cost.water : 0)); // เก็บเกี่ยว = ส่วนที่เหลือของรอบ หลังหักขุด/ปลูก/รดน้ำ
  // ความอิ่มตัวของตลาดต่อ "หมวด" (ต่อผู้เล่น): เดิมแต่ละชนิดอิ่มตัวแยกกัน คนขายเยอะจึงสลับชนิดหนีได้ (ข้อมูลจริง: ขายทีละ ~4 ชิ้น หลายสิบชนิด ได้ราคา ~100% ของราคาฐาน)
  // ตอนนี้ขายของหมวดเดียวกันต่อเนื่อง ต่อให้สลับชนิด ราคาทั้งหมวดก็ลดลงด้วย (การลดต่อชิ้นแบ่งครึ่ง: ครึ่งหนึ่งเข้าตลาดของชนิดนั้น อีกครึ่งเข้าตลาดของหมวด) และฟื้นช้าๆ ตามเวลา (recover ของช่องว่างต่อนาที แม้ออฟไลน์) • ไม่มีเพดาน/ลิมิตรายวัน
  // ความอิ่มตัวของหมวด: ขายหมวดไหนเยอะ หมวดนั้นตกเร็ว (ตามปริมาณ) แต่หมวดอื่นฟื้นเร็วขึ้น spread ต่อชิ้น สูงสุด spreadMax
  // perCoin (B3 ใน ECONOMY-PLAN.md): ราคาต่อชิ้นในชุดลดลงตาม "มูลค่า" ของชิ้นนั้น = ราคาฐาน × perCoin (เดิมลดชิ้นละ MARKET.drop เท่ากันทุกชนิด) ของถูกลดน้อย ของแพงลดมาก ขายของแพงเป็นภูเขาโดนกดเร็วเท่าของถูกที่มูลค่าเท่ากัน
  //   0.00015 = ของราคา 67 ลดชิ้นละ 1% (เท่าเดิม) • แครอท 20 ลด 0.3% • มะม่วง 188 ลด 2.8% • ชุดเลี้ยงฉลอง 330 ลด 5% (ไม่เกิน dropMax) เลือกจาก tools/econsim.js (G2 ผ่าน Gini 0.37 ชาวนายังมีกำไร)
  const CATFAT = { min: 0.3, recover: 0.03, spread: 0.01, spreadMax: 0.25, perCoin: 0.00015, dropMax: 0.1 };
  const CAT_KEYS = ['fish', 'crop', 'animal', 'wood', 'ore', 'dish', 'other'];
  const sellCat = k => /^fish_/.test(k) ? 'fish' : /^crop_/.test(k) ? 'crop' : /^dish_/.test(k) ? 'dish' : ['egg', 'duck_egg', 'milk', 'wool', 'truffle', 'honey', 'alpaca_wool', 'horse_milk', 'chestnut'].includes(k) ? 'animal' : (k === 'plank' || Object.hasOwn(WOOD_ITEMS, k)) ? 'wood' : Object.hasOwn(ORES, k) ? 'ore' : 'other';
  // ขายเป็นชุดใหญ่ (ถือของได้ไม่จำกัดจำนวน): คิดราคาทีละชิ้นตามชนิด ราคาต่อชิ้นลดลงเชิงเส้นชิ้นละ 1% ของราคาฐาน (MARKET.drop) จนถึงพื้น 20% แล้วคงที่
  // ตัวอย่างขาย 100 ชิ้นเมื่อราคาตั้งต้น 100%: ชิ้นที่ 1 = 100%, 2 = 99% … 80 = 21%, ชิ้นที่ 81-100 = 20% รวม 5,240 จากราคาฐาน 100/ชิ้น (กด "ขายทั้งหมด" คำนวณทั้งชุดให้เลย)
  // ตลาดจำการขายด้วยการลดเท่ากันทุกชิ้น (server แบ่งเข้าตลาดชนิด/ส่วนตัว/หมวด) ขายรวดหรือทยอยขายติดกันทีละชิ้นจึงได้เงินเท่ากัน ต่างกันเฉพาะ "รอให้ตลาดฟื้น" ที่ได้ราคาดีขึ้น
  const sellDrop = base => CATFAT.perCoin ? Math.min(CATFAT.dropMax, base * CATFAT.perCoin) : MARKET.drop; // ตัวคูณราคาที่ลดต่อชิ้น (ตามมูลค่า)
  function sellQuote(base, m, q, muls) { // ราคารวมเมื่อขาย q ชิ้นต่อเนื่อง และตัวคูณใหม่ • ราคาต่อชิ้นไม่ต่ำกว่า MARKET.min ของราคาฐาน • muls = ตัวคูณความสดต่อชิ้น (ไม่ใส่ = สดทุกชิ้น)
    let total = 0; const drop = sellDrop(base);
    for (let i = 0; i < q; i++) { total += Math.max(1, Math.round(base * (muls ? muls[i] : 1) * Math.max(MARKET.min, m))); m = Math.max(MARKET.min, m - drop); }
    return { total, m };
  }
  // ความสดของสินค้า (ขั้น 1 ใน ECONOMY-PLAN.md): ผัก ผลไม้ ปลา ไข่ นม อาหาร หน่อไม้ ราคาลดตามอายุในกระเป๋า สด < freshMs = 100% • ค้าง < staleMs = 70% • เก่า = 40% (ยังขาย/ทำอาหาร/กินได้)
  // ของคงทน (ไม้ ขนแกะ น้ำผึ้ง ทรัฟเฟิล มะพร้าว) ไม่เสื่อม • ใช้/ขาย/เทรด ของเก่าก่อนเสมอ (เทรดแล้วอายุติดไปด้วย) • มีตู้เย็นวางในบ้าน = อายุนับช้าลงครึ่งหนึ่ง
  // startAt: วันเริ่มระบบ ของที่ได้ก่อนวันนี้นับเป็นของสด ณ วันนั้น (ผู้เล่นมีเวลาขายของที่ตุนไว้ก่อน)
  const FRESH = { startAt: Date.parse('2026-11-01T00:00:00+07:00'), freshMs: 24 * 3600e3, staleMs: 72 * 3600e3, mul: [1, 0.7, 0.4], fridgeMul: 0.5, names: ['สด', 'ค้าง', 'เก่า'], emoji: ['🟢', '🟡', '🔴'] };
  const perishable = k => /^(crop_|fish_|dish_)/.test(k) || ['egg', 'duck_egg', 'milk', 'shoot'].includes(k);
  const freshTier = (t, now, fridge) => { if (now < FRESH.startAt) return 0; const age = (now - Math.max(t, FRESH.startAt)) * (fridge ? FRESH.fridgeMul : 1); return age < FRESH.freshMs ? 0 : age < FRESH.staleMs ? 1 : 2; };
  const freshMuls = (lots, q, now, fridge) => { const out = []; for (const [t, n] of lots || []) for (let i = 0; i < n && out.length < q; i++) out.push(FRESH.mul[freshTier(t, now, fridge)]); while (out.length < q) out.push(1); return out; }; // ตัวคูณต่อชิ้น เรียงของเก่าก่อน
  const freshCount = (lots, now, fridge) => { const c = [0, 0, 0]; for (const [t, n] of lots || []) c[freshTier(t, now, fridge)] += n; return c; };
  // สัตว์ฟาร์ม: เป็นของคนซื้อ (owner) • cap = สูงสุดต่อชนิดต่อคน • โผล่ในเล้าเฉพาะตอนเจ้าของออนไลน์ (ออฟ = หายจากเล้า + แช่แข็งไม่หิว/ไม่ผลิต)
  // init ไม่ใช้แล้ว (เคยเป็นฝูงกลาง) • มือใหม่ได้ไก่ตัวแรกใน rec.herd • ตายแล้วจบ ไม่มีชุบจากกองกลาง
  const ANIMALS = {
    // starveMin = กี่นาที (เจ้าของออนไลน์) ที่สัตว์หิวจากอิ่มเต็มจนหมด, หลังหมดแล้วเหลือเวลาอีก ANIMAL_GRACE_MS ก่อนจะตาย
    chicken: { name: 'ไก่', emoji: '🐔', product: 'egg',  feedItem: 'feed', price: 120, lv: 1, cap: 4, init: 0, time: [25000, 45000], xp: 4, starveMin: 25 },
    cow:     { name: 'วัว', emoji: '🐄', product: 'milk', feedItem: 'hay',  price: 600, lv: 3, cap: 4, init: 0, time: [45000, 75000], xp: 8, starveMin: 35 },
    duck:    { name: 'เป็ด', emoji: '🦆', product: 'duck_egg', feedItem: 'feed', price: 220, lv: 2, cap: 4, init: 0, time: [30000, 50000], xp: 5, starveMin: 25 },
    sheep:   { name: 'แกะ', emoji: '🐑', product: 'wool',     feedItem: 'hay',  price: 850, lv: 4, cap: 4, init: 0, time: [50000, 80000], xp: 10, starveMin: 35 },
    pig:     { name: 'หมู', emoji: '🐖', product: 'truffle', feedItem: 'slop', price: 1100, lv: 5, cap: 4, init: 0, time: [60000, 90000], xp: 12, starveMin: 35 },
    // เลเวล 11–20 (30 ต.ค. 2026): คอกแถวที่ 3 (PENS ด้านล่าง) ราคาสัตว์สูง ผลผลิตแพงตามเลเวล
    alpaca:  { name: 'อัลปากา', emoji: '🦙', product: 'alpaca_wool', feedItem: 'hay', price: 2400, lv: 12, cap: 4, init: 0, time: [70000, 100000], xp: 14, starveMin: 35 },
    horse:   { name: 'ม้าด่าง', emoji: '🐴', product: 'horse_milk', feedItem: 'hay', price: 4200, lv: 15, cap: 4, init: 0, time: [80000, 110000], xp: 17, starveMin: 35 },
    boar:    { name: 'หมูป่า', emoji: '🐗', product: 'chestnut', feedItem: 'slop', price: 7000, lv: 18, cap: 4, init: 0, time: [90000, 120000], xp: 20, starveMin: 35 },
    bee:     { name: 'ผึ้ง', emoji: '🐝', product: 'honey', feedItem: 'nectar', price: 360, lv: 2, cap: 4, init: 0, time: [40000, 60000], xp: 6, starveMin: 30 },
  };
  // สัตว์เลี้ยงคู่ใจ (ซื้อที่ร้านสัตว์เลี้ยง): เดินตามเจ้าของ ทุกคนเห็น ไม่ต้องให้อาหาร • ซื้อได้หลายตัว แต่พาไปได้ทีละตัว (เลือกในร้าน)
  const COMPANIONS = {
    dog:  { name: 'ลูกสุนัข', emoji: '🐶', price: 500, kind: 'dog', v: 1, say: 'โฮ่ง โฮ่ง! 🐶' },
    cat:  { name: 'ลูกแมว',  emoji: '🐱', price: 450, kind: 'cat', v: 0, say: 'เหมียว~ 🐱' },
    bird: { name: 'นกน้อย',  emoji: '🐦', price: 300, kind: 'bird', v: 0, say: 'จิ๊บ จิ๊บ 🐦' },
    monkey: { name: 'ลิงน้อย', emoji: '🐒', price: 700, kind: 'monkey', v: 0, say: 'อุ๊ก อุ๊ก 🐒' },
    capybara: { name: 'คาปิบาร่า', emoji: '🦫', price: 900, kind: 'capy', v: 0, say: 'ฟี้~ 🦫' },
  };
  const PETCARE = { food: 40, hungerTick: 1, sickBelow: 25, sickChance: 0.12, sickDieMs: DAY_MS }; // ป่วยแล้วไม่รักษาเกิน 1 วันในเกม (นับเฉพาะตอนมีคนออนไลน์) สัตว์เลี้ยงจะตาย ต้องซื้อใหม่ // อาหาร 1 ชิ้นเพิ่มความอิ่ม 40 • ความอิ่มลด 1 ทุก 15 วินาทีที่พาออกมา (เต็มอยู่ได้ ~25 นาที) ต่ำกว่า 25 มีโอกาสป่วยทุกรอบ
  const ANIMAL_XP = { from: 5, perLv: 0.2 }; // XP เลี้ยงสัตว์ ×(1 + perLv × (เลเวล − from)) เมื่อเลเวลเกิน from (สัตว์ปลดครบที่ Lv5 แล้ว XP/ชม. ตันที่ 52% ของชาวนา ดู tools/levelsim.js)
  const animalXp = (xp, lv) => Math.round(xp * (1 + ANIMAL_XP.perLv * Math.max(0, perkLv(lv) - ANIMAL_XP.from)));
  const ANIMAL_BONUS = 0.25; // โอกาสได้ผลผลิต ×2 เมื่อเก็บจากสัตว์ที่ตัวเองเลี้ยง (เดิม 0.5 ลดเมื่อ 25 ต.ค. 2026: เลี้ยงสัตว์ได้มากกว่าอาชีพอื่นใน tools/econsim.js)
  const ANIMAL_GRACE_MS = 4 * 60 * 1000;   // สัตว์ที่หิวจนหมดแล้ว ถ้าไม่มีใครให้อาหารภายใน 4 นาทีจะตาย
  const PLAYER_HUNGER = { tickMs: 15000, start: 80, sitMs: 5000, sitGain: 1, workMul: 1.8, idleMul: 0.5, workMs: 20000 }; // ทำกิจกรรม (ตัดไม้/ตกปลา/ปลูก/ให้อาหารสัตว์ ฯลฯ ภายใน workMs) หิวเร็ว ×workMul • เดินเฉยๆ/ไม่ทำอะไร หิวช้า ×idleMul • // ผู้เล่นหิวลง 1 แต้มทุก 15 วินาที (เต็ม 100 อยู่ได้ ~25 นาที) ออฟไลน์ไม่ลด
  // บัวรดน้ำ 3 ระดับ: cap = ตักน้ำได้ครั้งละกี่ครั้งรด (หมดต้องกลับไปตักที่สระ), wet = ดินเปียกนานแค่ไหนหลังรด (ms), ต้องมีเลเวลชาวนาตามกำหนดถึงซื้อได้
  const CANS = {
    1: { name: 'บัวรดน้ำสังกะสี', emoji: '🫗', cap: 10, wet: 90000 },
    2: { name: 'บัวรดน้ำทองแดง', emoji: '🚿', price: 180, lv: 3, cap: 20, wet: 120000 },
    3: { name: 'บัวรดน้ำทองคำ',  emoji: '🚰', price: 600, lv: 6, cap: 50, wet: 180000 },
  };
  const canTier = inv => (inv.can_3 ? 3 : inv.can_2 ? 2 : 1);
  // มินิเกมเกจตอนปลากินเบ็ด: ตัวชี้วิ่ง 0→1→0 ไป-กลับ (per = เวลาวิ่งทางเดียว ms) กดตอนอยู่ในโซนกลาง |ตำแหน่ง-0.5| <= half ถึงจะได้ปลา
  const FISH_GAUGE = { per: 1000, perRod: 70, half: 0.07, halfRod: 0.015, window: 4200, lag: 60,
    // สุ่มใหม่ทุกครั้งที่ปลากินเบ็ด: จุดกึ่งกลางโซน cMin–cMax, ความเร็วตัวชี้ ×perVar, ความกว้างโซน ×halfVar, จุดเริ่มของตัวชี้ (จับทางไม่ได้)
    // กดโดนกลางโซนจริงๆ (ในระยะ perfect × ครึ่งโซน) = ได้ปลาตามอัตราปกติเต็มที่ ถ้าโดนแค่ขอบโซนปลาแพงจะเจอยากลง (edgeMul ตามกลุ่มราคาปลา 0–3)
    cMin: 0.2, cMax: 0.8, perVar: [0.75, 1.2], halfVar: [0.85, 1.1], perfect: 0.4, edgeMul: [1, 0.75, 0.45, 0] };
  const gaugePos = (f, t) => { const ph = ((t - f.gt0) / f.per) % 2; return ph < 1 ? ph : 2 - ph; };
  // lag: ชดเชยเวลาส่งข้อมูล (เช็คทั้งตอนกดจริงและย้อนหลังเล็กน้อย) ให้คนเน็ตช้าไม่เสียเปรียบ
  const gaugeDist = (f, t) => { const c = f.c === undefined ? 0.5 : f.c; return Math.min(Math.abs(gaugePos(f, t) - c), Math.abs(gaugePos(f, t - FISH_GAUGE.lag) - c)); };
  const gaugeHit = (f, t) => gaugeDist(f, t) <= f.half;
  // "เป๊ะ" = ตำแหน่งตัวชี้ (ชดเชยหน่วง lag แบบเดียวกันทุกครั้ง ไม่ขยายโซนข้างเดียว) อยู่ในแกนกลางโซน
  const gaugeCore = (f, t) => Math.abs(gaugePos(f, t - FISH_GAUGE.lag / 2) - (f.c === undefined ? 0.5 : f.c)) <= f.half * FISH_GAUGE.perfect; // ชดเชยหน่วงครึ่งเดียว: คนเน็ตเร็ว/ช้าผิดพลาดไม่เกินครึ่งหนึ่งของแกนกลาง
  const RODS = { 1: { name: 'คันเบ็ดไม้ไผ่' }, 2: { name: 'คันเบ็ดไฟเบอร์', price: 250, lv: 3 }, 3: { name: 'คันเบ็ดคาร์บอน', price: 900, lv: 6 }, 4: { name: 'คันเบ็ดไทเทเนียม', price: 2500, lv: 9 }, 5: { name: 'คันเบ็ดทองคำ', price: 6000, lv: 12 }, 6: { name: 'คันเบ็ดมรกต', price: 16000, lv: 15 }, 7: { name: 'คันเบ็ดเพชร', price: 40000, lv: 18 } };
  const rodTier = inv => { for (let t = 7; t >= 2; t--) if (inv && inv['rod_' + t]) return t; return 1; }; // ระดับคันเบ็ดสูงสุดที่มี
  const ROD_WAIT = [0, 1, 0.88, 0.76, 0.64, 0.59, 0.54, 0.49];   // ตัวคูณเวลารอปลากินเบ็ด (ระดับ 1–4 ลด 12%/ระดับ ระดับ 5–7 ลด 5%/ระดับ)
  const ROD_RARE = [0, 0, 0.35, 0.7, 1.05, 1.25, 1.45, 1.65];    // โบนัสความถี่ปลาราคา ≥ 100 ตามคันเบ็ด (เดิม 0.35×(ระดับ−1))
  // คันเบ็ดปลดความหายากเป็นขั้น (fishClass: 0 = ราคา < 20, 1 = < 60, 2 = < 120, 3 = 120+): ไม้ไผ่ตกได้ถึงกลุ่ม 1 • ไฟเบอร์ถึงกลุ่ม 2 • คาร์บอนขึ้นไปได้ทุกกลุ่ม
  // ปลาราคา ≥ 100 เจอบ่อยขึ้นตามเลเวล (+12%/เลเวล) และคันเบ็ด (+35%/ระดับ) • ปลากลุ่ม 3 ต้องกด "เป๊ะ" (FISH_GAUGE.edgeMul[3] = 0) • ตกปลา ≥ 100 ได้แล้วพักรอบ RARE_CD_MS
  const ROD_MAXCLASS = [0, 1, 2, 3, 3, 3, 3, 3], RARE_CD_MS = 6 * 60 * 1000;
  const fishWeight = (f, fl, rod, bait) => fishClass(f) > ROD_MAXCLASS[rod] ? 0 : (rod < (f.rod || 0) ? 0 : f.w * (f.sell >= 100 ? 1 + 0.12 * (perkLv(fl) - 1) + ROD_RARE[rod] : 1)) / (f.id === 'boot' ? 1 + rod : 1) * baitWeight(f, bait);

  // เสื้อผ้า: ซื้อแล้วสวมได้ (ราคา 0 = มีให้ฟรีตั้งแต่ต้น) สีของเสื้อ/กางเกง/หมวกเลือกเองได้ฟรีในแท็บ "ตัวละคร"
  const WEAR = {
    shirt: [
      { id: 'tee', name: 'เสื้อยืด', price: 0 }, { id: 'stripe', name: 'เสื้อลายทาง', price: 60 }, { id: 'dots', name: 'เสื้อลายจุด', price: 80 },
      { id: 'vest', name: 'เสื้อกั๊ก', price: 120 }, { id: 'hoodie', name: 'เสื้อฮู้ด', price: 180 }, { id: 'farmer', name: 'ชุดเอี๊ยมชาวนา', price: 250 },
      { id: 'royal', name: 'เสื้อราชาสีทอง', price: 700 },
      { id: 'sailor', name: 'เสื้อกะลาสี', price: 110 }, { id: 'jersey', name: 'เสื้อกีฬาเบอร์ 7', price: 120 }, { id: 'sweater', name: 'เสื้อไหมพรมถัก', price: 140 },
      { id: 'chef', name: 'ชุดเชฟ', price: 160 }, { id: 'jacket', name: 'แจ็กเก็ตยีนส์', price: 200 }, { id: 'kimono', name: 'กิโมโน', price: 260 },
    ],
    pants: [
      { id: 'jeans', name: 'กางเกงขายาว', price: 0 }, { id: 'shorts', name: 'กางเกงขาสั้น', price: 50 }, { id: 'cargo', name: 'กางเกงคาร์โก้', price: 90 },
      { id: 'skirt', name: 'กระโปรง', price: 90 }, { id: 'overall', name: 'กางเกงเอี๊ยม', price: 140 }, { id: 'royal', name: 'กางเกงสีทอง', price: 600 },
      { id: 'jogger', name: 'กางเกงวอร์ม', price: 80 }, { id: 'plaid', name: 'กระโปรงลายสก็อต', price: 110 }, { id: 'hakama', name: 'กางเกงฮากามะ', price: 150 },
    ],
    hat: [
      { id: 'straw', name: 'หมวกฟาง', price: 0 }, { id: 'none', name: 'ไม่สวมหมวก', price: 0 }, { id: 'cap', name: 'หมวกแก๊ป', price: 70 },
      { id: 'beanie', name: 'หมวกไหมพรม', price: 90 }, { id: 'party', name: 'หมวกปาร์ตี้', price: 100 }, { id: 'flower', name: 'มงกุฎดอกไม้', price: 120 },
      { id: 'cowboy', name: 'หมวกคาวบอย', price: 150 }, { id: 'crown', name: 'มงกุฎทองคำ', price: 900 },
      { id: 'headband', name: 'ที่คาดผม', price: 60 }, { id: 'chef', name: 'หมวกเชฟ', price: 100 }, { id: 'bunny', name: 'หูกระต่าย', price: 130 },
      { id: 'miner', name: 'หมวกนิรภัยมีไฟ', price: 180 }, { id: 'pirate', name: 'หมวกโจรสลัด', price: 220 }, { id: 'wizard', name: 'หมวกพ่อมด', price: 260 },
    ],
  };
  // อุปกรณ์เสริม (หมวดที่ 4): สีของชิ้นนี้ใช้สีเดียวกับ "สีหมวก" ในตู้เสื้อผ้า
  WEAR.acc = [
    { id: 'none', name: 'ไม่ใส่', price: 0 }, { id: 'glasses', name: 'แว่นตากลม', price: 60 }, { id: 'shades', name: 'แว่นกันแดด', price: 90 },
    { id: 'bowtie', name: 'โบว์ผูกคอ', price: 70 }, { id: 'scarf', name: 'ผ้าพันคอ', price: 80 }, { id: 'lei', name: 'สร้อยดอกไม้', price: 90 },
    { id: 'backpack', name: 'เป้สะพายหลัง', price: 120 }, { id: 'headphones', name: 'หูฟังครอบหู', price: 150 }, { id: 'cape', name: 'ผ้าคลุมฮีโร่', price: 250 }, { id: 'wings', name: 'ปีกนางฟ้า', price: 400 },
  ];
  const WEAR_CATS = { shirt: { name: 'เสื้อ', emoji: '👕' }, pants: { name: 'กางเกง', emoji: '👖' }, hat: { name: 'หมวก', emoji: '🎩' }, acc: { name: 'อุปกรณ์เสริม', emoji: '🕶️' } };
  const WEAR_DEFAULT = { shirt: 'tee', pants: 'jeans', hat: 'straw', acc: 'none' };
  const wearKey = (cat, id) => 'wear_' + cat + '_' + id;
  const PANTS_COLOR = '#5b4a8a';
  // อาหาร: กินแล้วหายหิว (ค่า = แต้มความอิ่มที่ได้ เต็ม 100) ของที่ผลิตเองกินได้ แต่อิ่มน้อยกว่าอาหารจากร้าน
  const MEALS = [
    { id: 'bread',    name: 'ขนมปัง',            emoji: '🍞', price: 6 },
    { id: 'sandwich', name: 'แซนด์วิช',          emoji: '🥪', price: 10 },
    { id: 'soup',     name: 'ซุปร้อน',           emoji: '🍲', price: 13 },
    { id: 'rice',     name: 'ข้าวผัดไข่',         emoji: '🍛', price: 16 },
  ];
  // ห้องครัวที่ร้านอาหาร: ทำอาหารจากวัตถุดิบข้ามสาย (ปลา + ผัก + ไข่/นม) ได้ราคาขายสูงกว่าขายของดิบแยกหลายเท่า
  // in: c = หมวด (fish = ปลาชนิดใดก็ได้ [ใช้ชนิดที่ถูกสุดก่อน], crop = ผัก, egg = ไข่ไก่/ไข่เป็ด) หรือ k = ไอเทมระบุชนิด
  const COOK_FEE = 0.3; // ค่าเช่าเตา = สัดส่วนของราคาขายอาหาร จ่ายเป็นเหรียญทุกครั้งที่ทำ (0.2 → 0.3 เมื่อ 25 ต.ค. 2026: เชฟได้มากกว่าอาชีพอื่นใน tools/econsim.js)
  const COOK_CATS = { fish: { name: 'ปลา/สัตว์น้ำ', emoji: '🐟' }, crop: { name: 'ผัก/ผลไม้', emoji: '🥕' }, egg: { name: 'ไข่', emoji: '🥚' } };
  // เชฟ (อาชีพที่ 5): แต่ละสูตรปลดล็อกตามเลเวลเชฟ (lv) ได้ XP เชฟ (xp) และใช้เวลาทำ (time มิลลิวินาที = เตาต้องพักก่อนทำจานถัดไป)
  // XP สูตร = XP เดิม × (2.3 − 0.08×เลเวลสูตร) (ปรับ 25 ต.ค. 2026) ให้ XP/ชม. ของเชฟรวมเวลาหาวัตถุดิบใกล้ชาวนา ตรวจด้วย node tools/levelsim.js
  const COOK = [
    { id: 'dish_grill',   name: 'ปลาย่างผักสด',     emoji: '🍱', sell: 60,  food: 45,  lv: 1, xp: 27, time: 3000,  in: [{ c: 'fish', n: 1 }, { c: 'crop', n: 1 }] },
    { id: 'dish_omelet',  name: 'ไข่เจียวผักรวม',    emoji: '🍳', sell: 80,  food: 55,  lv: 3, xp: 41, time: 4000,  in: [{ c: 'egg', n: 2 }, { c: 'crop', n: 1 }] },
    { id: 'dish_seafood', name: 'ซีฟู้ดไข่นุ่ม',     emoji: '🍤', sell: 135, food: 70,  lv: 5, xp: 65, time: 6000,  in: [{ c: 'fish', n: 2 }, { c: 'egg', n: 1 }, { c: 'crop', n: 1 }] },
    { id: 'dish_feast',   name: 'ชุดเลี้ยงฉลอง',     emoji: '🍽️', sell: 330, food: 100, lv: 7, xp: 122, time: 9000,  in: [{ c: 'fish', n: 2 }, { c: 'crop', n: 2 }, { c: 'egg', n: 2 }, { k: 'milk', n: 1 }] },
    // เมนูปลา: ปลาทุกชนิดในกระเป๋า (ยกเว้นรองเท้าเก่า) ใช้ทำได้
    { id: 'dish_fishsoup', name: 'ต้มยำปลา',         emoji: '🍲', sell: 75,  food: 50,  lv: 2, xp: 34, time: 3500,  in: [{ c: 'fish', n: 1 }, { c: 'crop', n: 1 }] },
    { id: 'dish_sashimi',  name: 'ซาชิมิปลา',         emoji: '🍣', sell: 120, food: 55,  lv: 4, xp: 51, time: 4000,  in: [{ c: 'fish', n: 2 }] },
    { id: 'dish_fishburger', name: 'เบอร์เกอร์ปลา',   emoji: '🍔', sell: 170, food: 80,  lv: 6, xp: 69, time: 5000,  in: [{ c: 'fish', n: 1 }, { k: 'meal_bread', n: 1 }, { c: 'crop', n: 1 }] },
    { id: 'dish_fishpie',  name: 'พายปลาไข่',         emoji: '🥧', sell: 250, food: 90,  lv: 8, xp: 83, time: 7000,  in: [{ c: 'fish', n: 2 }, { c: 'egg', n: 1 }, { c: 'crop', n: 1 }] },
    // เมนูปลารวม: u = ปลาต้องเป็นคนละชนิดกัน (ชนิดละ 1 ตัว) ปลาชนิดเดียวกันหลายตัวใช้ทำไม่ได้
    { id: 'dish_fishmix',  name: 'ปลารวมทอดกรอบ',    emoji: '🥘', sell: 110, food: 65,  lv: 3, xp: 45, time: 4000,  in: [{ c: 'fish', n: 2, u: true }, { c: 'crop', n: 1 }] },
    { id: 'dish_fishstew', name: 'แกงปลารวมหม้อใหญ่', emoji: '🫕', sell: 220, food: 85,  lv: 6, xp: 80, time: 7000,  in: [{ c: 'fish', n: 3, u: true }, { c: 'crop', n: 1 }] },
    { id: 'dish_platter',  name: 'จานปลาทะเลรวม',    emoji: '🥡', sell: 380, food: 105, lv: 8, xp: 133, time: 10000, in: [{ c: 'fish', n: 4, u: true }, { c: 'egg', n: 1 }] },
    // เลเวล 11–20 (30 ต.ค. 2026)
    { id: 'dish_curry', name: 'แกงเขียวหวานปลา', emoji: '🍛', sell: 430, food: 105, lv: 11, xp: 150, time: 10000, in: [{ c: 'fish', n: 2 }, { c: 'crop', n: 2 }] },
    { id: 'dish_salad', name: 'สลัดผักผลไม้รวม', emoji: '🥗', sell: 450, food: 105, lv: 12, xp: 160, time: 10000, in: [{ c: 'crop', n: 4, u: true }] },
    { id: 'dish_noodle', name: 'ก๋วยเตี๋ยวทะเลรวม', emoji: '🍜', sell: 480, food: 105, lv: 13, xp: 170, time: 11000, in: [{ c: 'fish', n: 3, u: true }, { c: 'crop', n: 1 }, { c: 'egg', n: 1 }] },
    { id: 'dish_pizza', name: 'พิซซ่าซีฟู้ด', emoji: '🍕', sell: 450, food: 105, lv: 14, xp: 180, time: 11000, in: [{ c: 'fish', n: 2 }, { c: 'egg', n: 2 }, { c: 'crop', n: 2 }] },
    { id: 'dish_pasta', name: 'สปาเกตตีกุ้งซอสครีม', emoji: '🍝', sell: 480, food: 105, lv: 15, xp: 190, time: 12000, in: [{ c: 'fish', n: 2, u: true }, { c: 'egg', n: 1 }, { c: 'crop', n: 2 }] },
    { id: 'dish_pie', name: 'พายผลไม้อบร้อน', emoji: '🥮', sell: 510, food: 105, lv: 16, xp: 195, time: 12000, in: [{ c: 'egg', n: 2 }, { c: 'crop', n: 3, u: true }] },
    { id: 'dish_cake', name: 'เค้กไข่สตรอว์เบอร์รี', emoji: '🍰', sell: 550, food: 105, lv: 17, xp: 205, time: 13000, in: [{ c: 'egg', n: 3 }, { c: 'crop', n: 3 }] },
    { id: 'dish_sharksoup', name: 'ซุปปลารวมมหาสมุทร', emoji: '🥣', sell: 590, food: 105, lv: 18, xp: 215, time: 14000, in: [{ c: 'fish', n: 5, u: true }, { c: 'egg', n: 1 }] },
    { id: 'dish_party', name: 'เค้กฉลองงานเมือง', emoji: '🎂', sell: 640, food: 105, lv: 19, xp: 235, time: 14000, in: [{ c: 'egg', n: 4 }, { c: 'crop', n: 4 }] },
    { id: 'dish_banquet', name: 'โต๊ะจีนมหาราช', emoji: '🥂', sell: 720, food: 105, lv: 20, xp: 270, time: 16000, in: [{ c: 'fish', n: 6, u: true }, { c: 'crop', n: 3 }, { c: 'egg', n: 3 }] },
  ];
  const cookCat = (c, k) => c === 'fish' ? /^fish_/.test(k) && k !== 'fish_boot' : c === 'crop' ? /^crop_/.test(k) : c === 'egg' ? (k === 'egg' || k === 'duck_egg') : false;
  // โครงการพัฒนาเมือง: ที่เก็บเงินขนาดใหญ่ ทุกคนลงขันที่ตู้เซฟกองกลาง ปลดล็อกตามลำดับ ครบเป้าแล้วขึ้นข่าวและประกาศชื่อผู้ร่วมสร้าง
  const PROJECTS = [
    { id: 'bridge',   name: 'สะพานไม้ข้ามสระ',     emoji: '🌉', goal: 5000 },
    { id: 'lighthouse', name: 'ประภาคารริมน้ำ',    emoji: '🗼', goal: 12000 },
    { id: 'island',   name: 'เกาะตกปลาลับ',        emoji: '🏝️', goal: 25000 },
    { id: 'festival', name: 'ลานเทศกาลกลางเมือง',   emoji: '🎪', goal: 40000 },
  ];
  const PROJ_DONATE = [100, 500, 2000];
  // หลังสร้างโครงการครบ: เทศกาลประจำสัปดาห์ (ลงขันได้ไม่สิ้นสุด) เป้า = perPlayer × จำนวนคนที่ช่วยงานเมืองสัปดาห์นี้ (อย่างน้อย minPlayers) ครบแล้วทั้งเมืองได้บัฟ Happy Village buffMs
  const FEST = { perPlayer: 1500, minPlayers: 3, minShare: 10, buffMs: 24 * 3600e3 }; // นับเฉพาะคนที่ช่วยงานเมือง ≥ minShare ครั้งในสัปดาห์
  // ประมูลประจำสัปดาห์: ของหายากหมุนตามสัปดาห์ ราคาเริ่ม start ต้องสูงกว่าเดิม step (5%) เงินผู้ชนะหายจากระบบ คนที่ถูกประมูลแซงได้เงินคืนทันที
  const AUCTION = { start: 2000, step: 0.05 };
  const FOOD = {
    meal_bread: 15, meal_sandwich: 25, meal_soup: 32, meal_rice: 40, // อาหารร้าน ฟื้นความอิ่มน้อยกว่าเมนูที่ทำเองทุกสูตร (ต่ำสุดของเมนูทำเองคือ 45)
    crop_carrot: 6, crop_cabbage: 8, crop_corn: 12, crop_tomato: 8, crop_eggplant: 10, crop_strawberry: 10, crop_pumpkin: 15, crop_melon: 15,
    crop_potato: 12, crop_chili: 6, crop_broccoli: 10, crop_cherry: 10, crop_grape: 12, crop_pineapple: 15, crop_mango: 18, shoot: 6, coconut: 20,
    egg: 8, milk: 15, truffle: 5, duck_egg: 8,
    dish_grill: 45, dish_omelet: 55, dish_seafood: 70, dish_feast: 100,
    dish_fishsoup: 50, dish_sashimi: 55, dish_fishburger: 80, dish_fishpie: 90,
    dish_fishmix: 65, dish_fishstew: 85, dish_platter: 105,
  };

  // อาคาร: counter = ช่อง "ประตูร้าน" (1 ช่อง แถวล่างของอาคาร) กดที่ประตูหรือยืนหน้าประตูเพื่อเปิดร้าน ไม่มีเคาน์เตอร์ตั้งหน้าร้านแล้ว
  // ผังเมือง v3 (30 ต.ค. 2026): ร้านอยู่ติดย่านงานของตัวเอง • ย่านร้านค้าขวาถนนสายกลาง 2 แถว (ประตูหันลงทาง) • บ้านหลังใหญ่ซ้ายถนนสายกลาง มีลานหน้าบ้าน • ร้านสัตว์ข้างเล้า • ร้านตกปลาริมสระ • ร้านช่างไม้ชายป่า • ร้านช่างเหมืองหน้าถ้ำ
  const BUILDINGS = [
    { kind: 'farm',   x0: 21, y0: 16, x1: 23, y1: 17, counter: [[22, 17]], name: 'ร้านเมล็ดพันธุ์', sign: '🌱', roof: '#3a8f3a', wall: '#f0dcae' },
    { kind: 'fish',   x0: 36, y0: 31, x1: 38, y1: 32, counter: [[37, 32]], name: 'ร้านตกปลา',      sign: '🎣', roof: '#2e7bb5', wall: '#e6d9b5' },
    { kind: 'animal', x0: 42, y0: 22, x1: 44, y1: 23, counter: [[43, 23]], name: 'ร้านปศุสัตว์',    sign: '🐄', roof: '#a8552f', wall: '#f0dcae' },
    { kind: 'pet',    x0: 42, y0: 27, x1: 44, y1: 28, counter: [[43, 28]], name: 'ร้านสัตว์เลี้ยง',  sign: '🐾', roof: '#e0748a', wall: '#fdeef0' },
    { kind: 'cloth',  x0: 40, y0: 16, x1: 42, y1: 17, counter: [[41, 17]], name: 'ร้านเสื้อผ้า',    sign: '👕', roof: '#d6559a', wall: '#f7e1ee' },
    { kind: 'food',   x0: 36, y0: 16, x1: 38, y1: 17, counter: [[37, 17]], name: 'ร้านอาหาร',      sign: '🍜', roof: '#e08a1e', wall: '#fdeccb' },
    { kind: 'wood',   x0: 21, y0: 27, x1: 23, y1: 28, counter: [[22, 28]], name: 'ร้านช่างไม้',     sign: '🪓', roof: '#8a5a2b', wall: '#f3e2c3' },
    { kind: 'vehicle', x0: 40, y0: 12, x1: 42, y1: 13, counter: [[41, 13]], name: 'ร้านยานพาหนะ',   sign: '🚲', roof: '#3b6ea5', wall: '#e4ecf5' },
    { kind: 'furn',   x0: 36, y0: 12, x1: 38, y1: 13, counter: [[37, 13]], name: 'ร้านเฟอร์นิเจอร์', sign: '🛋️', roof: '#7b4fa3', wall: '#efe4f7' },
    { kind: 'mine',   x0: 21, y0: 10, x1: 23, y1: 11, counter: [[22, 11]], name: 'ร้านช่างเหมือง',  sign: '⚒️', roof: '#5a6470', wall: '#e2dcd0' },
    // ป้ายลานตู้เกม (ไม่ใช่อาคาร): ตู้เกมวางอยู่ด้านล่างป้าย
    { kind: 'sign',   x0: 30, y0: 1, x1: 33, y1: 1, counter: [],                  name: 'Arcade Hub',     sign: '🎮', roof: '#6a3fb5', wall: '#8b5a2b' },
  ];
  // พื้นปูหิน (ลานหน้าร้าน ลานกองไฟ ลานตู้เกม ลานหนัง ทางเข้าบ้าน) ต่างจากถนนดิน ให้ผังเมืองอ่านง่าย: ถนน = ดิน • ลาน = ปูหิน (ใช้ตอนวาดพื้นใน pixelart.js)
  const PAVED_RECTS = [{ x0: 24, y0: 1, x1: 41, y1: 7 }, { x0: 24, y0: 15, x1: 32, y1: 15 }, { x0: 36, y0: 14, x1: 38, y1: 14 }, { x0: 26, y0: 21, x1: 40, y1: 30 }]; // [ลานตู้เกม, ทางหน้าบ้านใหญ่, หน้าร้านเฟอร์นิเจอร์, ลานกองไฟ] (ลำดับใช้ใน applyLayout)
  const pavedSet = new Set();
  const rebuildPaved = () => { pavedSet.clear();
    const add = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) pavedSet.add(y * 1000 + x); };
    for (const r of PAVED_RECTS) add(r.x0, r.y0, r.x1, r.y1);
    for (const b of BUILDINGS) if (b.counter.length) add(b.x0, b.y1 + 1, b.x1, b.y1 + 1); }; // แถวยืนหน้าประตูทุกร้าน
  rebuildPaved();
  const isPaved = (x, y) => pavedSet.has(y * 1000 + x);
  // ตู้เกม 2 แถว แถวละ 4 ตู้ วางสลับฟันปลาเว้นห่างตู้ละ 1 ช่อง (ไม่ชิดกัน) เดินในแถวกลาง (y=16) ใช้ได้ทั้งสองแถว
  // game = null คือยังไม่เปิด เพิ่มเกมใหม่โดยใส่ game และเขียนกติกาฝั่งเซิร์ฟเวอร์
  const CABINETS = [
    { x: 28, y: 3, game: 'rps',   name: 'เป่ายิ้งฉุบ',      label: 'RPS', emoji: '✊' },
    { x: 30, y: 3, game: 'xo',    name: 'XO',             label: 'XO',  emoji: '❌⭕' },
    { x: 32, y: 3, game: 'uno',   name: 'UNO',            label: 'UNO', emoji: '🃏' },
    { x: 34, y: 3, game: 'react', name: 'ใครกดเร็วกว่า',    label: 'GO!', emoji: '⚡' },
    { x: 29, y: 5, game: 'pok',   name: 'ไพ่ป๊อก',         label: 'POK', emoji: '🎴' },
    { x: 33, y: 5, game: 'c4',    name: 'Connect 4',      label: 'C4',  emoji: '🔴' },
  ];
  const GAME_TITLES = { xo: '❌⭕ XO', uno: '🃏 UNO', rps: '✊ เป่ายิ้งฉุบ', react: '⚡ ใครกดเร็วกว่า', pok: '🎴 ไพ่ป๊อก', c4: '🔴 Connect 4', bacc: '🎴 บาคาร่า', bj: '🂡 แบล็คแจ็ค' };
  // ลานพักผ่อนกลางหมู่บ้าน: กองไฟตรงกลาง รอบๆ มีม้านั่ง กองฟาง และเก้าอี้ให้นั่งเล่น (กดที่ที่นั่งเพื่อนั่ง) กลางคืนสว่างเฉพาะรอบกองไฟ
  const PLAZA = { x0: 26, y0: 21, x1: 40, y1: 30 };
  const FIRE = { x: 33, y: 26 };
  const SEATS = [
    { x: 32, y: 23, kind: 'bench', face: 0 }, { x: 34, y: 23, kind: 'bench', face: 0 },
    { x: 32, y: 29, kind: 'bench', face: 1 }, { x: 34, y: 29, kind: 'bench', face: 1 },
    { x: 30, y: 25, kind: 'hay',   face: 3 }, { x: 30, y: 27, kind: 'hay',   face: 3 },
    { x: 36, y: 25, kind: 'chair', face: 2 }, { x: 36, y: 27, kind: 'chair', face: 2 },
  ];
  // กระดานข่าว (log ของโลก) และตู้เซฟกองกลาง อยู่ขอบเหนือของลานกองไฟ (ช่องเดินผ่านไม่ได้ กดจากช่องติดกัน)
  const BOARD = { x: 29, y: 21 }, ATM = { x: 31, y: 21 }, CHEST = { x: 36, y: 21 };
  // feeShare = สัดส่วนค่าเตา/ตู้เกมเข้ากองกลาง • autoAfterMs/revive/respawnMs เลิกใช้ (สัตว์ของคนซื้อ ตายแล้วจบ ไม่ชุบ) คงค่าไว้กันโค้ดเก่า
  const TOWN = { logMax: 15, donate: [10, 50, 100], autoAfterMs: 60000, revive: 0.5, respawnMs: 5 * 60 * 1000, feeShare: 0.5 };
  const townAt = (tx, ty) => (tx === BOARD.x && ty === BOARD.y ? 'board' : tx === CHEST.x && ty === CHEST.y ? 'chest' : tx === ATM.x && ty === ATM.y ? 'atm' : null);
  const reviveCost = type => Math.round(ANIMALS[type].price * TOWN.revive); // เลิกใช้ใน UI แล้ว
  // เควสประจำวัน (วันตามปฏิทินของเซิร์ฟเวอร์): แต่ละคนได้ 3 เควสจาก 3 สายอาชีพที่ต่างกัน ทำเสร็จได้ XP + เหรียญทันที ยิ่งทำสะสมยิ่งได้ฉายา
  // ev = เหตุการณ์ที่นับ, distinct = นับเฉพาะชนิดที่ยังไม่เคยทำวันนี้, min = เฉพาะปลาที่ราคาขายตั้งแต่นี้ขึ้นไป
  const QUESTS = { // cat = หมวดสำหรับสุ่มให้ครบหลายสาย • adv = ข้อที่ยากกว่า/ต้องลุ้น (ผู้เล่นใหม่ยังไม่โดนสุ่มให้) • emoji = ไอคอนเฉพาะข้อ (ไม่ใส่ = ใช้ของสาย skill) • เป้าหมายตั้งให้ทำจบได้ใน 5–10 นาที
    dig4:     { cat: 'farm',   skill: 'farm',   ev: 'dig',     goal: 4, text: 'ขุดดินเตรียมแปลงผัก',            xp: 25, coin: 20 },
    plant5:   { cat: 'farm',   skill: 'farm',   ev: 'plant',   goal: 5, text: 'ปลูกเมล็ดพันธุ์',                xp: 30, coin: 25 },
    water6:   { cat: 'farm',   skill: 'farm',   ev: 'water',   goal: 6, text: 'รดน้ำพืชที่แห้ง',               xp: 30, coin: 25 },
    harvest4: { cat: 'farm',   skill: 'farm',   ev: 'harvest', goal: 4, text: 'เก็บเกี่ยวผลผลิต',               xp: 40, coin: 30 },
    harvest10:{ cat: 'farm',   skill: 'farm',   ev: 'harvest', goal: 10, adv: true, text: 'เก็บเกี่ยวผลผลิตให้ได้ 10 ต้น', xp: 70, coin: 55 },
    kinds2:   { cat: 'farm',   skill: 'farm',   ev: 'harvest', goal: 2, distinct: true, adv: true, text: 'เก็บเกี่ยวพืช 2 ชนิดที่ต่างกัน', xp: 45, coin: 35 },
    fish3:    { cat: 'fish',   skill: 'fish',   ev: 'fish',    goal: 3, text: 'ตกปลา',                         xp: 40, coin: 30 },
    fish6:    { cat: 'fish',   skill: 'fish',   ev: 'fish',    goal: 6, adv: true, text: 'ตกปลาให้ได้ 6 ตัว',        xp: 65, coin: 50 },
    fishbig:  { cat: 'fish',   skill: 'fish',   ev: 'fish',    goal: 1, min: 40, adv: true, text: 'ตกปลามีค่า (ขายได้ 40 ขึ้นไป)', xp: 55, coin: 45 },
    chop3:    { cat: 'wood',   skill: 'wood',   ev: 'chop',    goal: 3, text: 'โค่นต้นไม้',                    xp: 40, coin: 30 },
    chop6:    { cat: 'wood',   skill: 'wood',   ev: 'chop',    goal: 6, adv: true, text: 'โค่นต้นไม้ 6 ต้น',         xp: 65, coin: 50 },
    craft1:   { cat: 'wood',   skill: 'wood',   ev: 'craft',   goal: 1, adv: true, text: 'ประดิษฐ์ของที่โรงช่างไม้',   xp: 45, coin: 35 },
    hard1:    { cat: 'wood',   skill: 'wood',   ev: 'hardwood', goal: 1, adv: true, text: 'หาไม้เนื้อแข็งให้ได้',    xp: 50, coin: 40 },
    feed3:    { cat: 'animal', skill: 'animal', ev: 'feed',    goal: 3, text: 'ให้อาหารสัตว์',                  xp: 35, coin: 25 },
    collect3: { cat: 'animal', skill: 'animal', ev: 'collect', goal: 3, text: 'เก็บไข่/นม/เห็ดจากสัตว์',        xp: 40, coin: 30 },
    collect6: { cat: 'animal', skill: 'animal', ev: 'collect', goal: 6, adv: true, text: 'เก็บผลผลิตสัตว์ 6 ครั้ง',  xp: 70, coin: 55 },
    sellprod2:{ cat: 'animal', skill: 'animal', ev: 'sellproduct', goal: 2, text: 'ขายไข่/นม/ขนแกะที่ร้านปศุสัตว์', xp: 35, coin: 30 },
    cook1:    { cat: 'cook',   skill: 'cook',   ev: 'cook',    goal: 1, adv: true, text: 'ทำอาหารที่ห้องครัวร้านอาหาร', xp: 50, coin: 40 },
    cook3:    { cat: 'cook',   skill: 'cook',   ev: 'cook',    goal: 3, adv: true, text: 'ทำอาหาร 3 จาน',            xp: 90, coin: 70 },
    eat1:     { cat: 'life',   skill: 'cook',   emoji: '🍜', ev: 'eat',  goal: 1, text: 'กินอาหารให้อิ่ม (ผลผลิตของตัวเองหรือซื้อจากร้านอาหาร)', xp: 20, coin: 15 },
    sell3:    { cat: 'life',   skill: 'farm',   emoji: '🪙', ev: 'sell', goal: 3, text: 'ขายของที่ร้านค้า 3 ครั้ง',  xp: 30, coin: 30 },
    sit1:     { cat: 'life',   skill: 'animal', emoji: '🪑', ev: 'sit',  goal: 1, text: 'นั่งพักที่ม้านั่งลานกองไฟ', xp: 15, coin: 10 },
  };
  const QUEST_NEWBIE = 5; // เควสสำเร็จสะสมน้อยกว่านี้ = มือใหม่: สุ่มเฉพาะสายฟาร์ม/ตกปลา/(ไม้ถ้ามีขวาน) และเฉพาะข้อง่าย
  const QUEST_PER_DAY = 6;                  // เควสประจำวัน 6 ข้อ (สุ่มให้ครบหลายหมวด) ครบทุกข้อได้โบนัสเพิ่ม
  const QUEST_ALL = { coin: 80 };             // โบนัสทำเควสวันนี้ครบทุกข้อ
  const TITLES = [[1, 'หน้าใหม่ใจสู้'], [5, 'ชาวเมืองขยัน'], [15, 'ผู้ช่วยแห่งหมู่บ้าน'], [40, 'ปรมาจารย์ฟาร์ม'], [100, 'ตำนานแห่งเมือง']]; // [จำนวนเควสที่ทำสำเร็จสะสม, ฉายา]
  const titleFor = n => { let t = ''; for (const [c, name] of TITLES) if ((n || 0) >= c) t = name; return t; };
  // แต้มความดี: ได้จากการช่วยงานที่จำเป็นจริง (ให้อาหารสัตว์ที่หิว รักษาสัตว์ป่วย รดน้ำพืชที่แห้ง ลงขันตู้เซฟ) จำกัดต่อวัน ใช้แลกบัฟส่วนตัวชั่วคราว
  const POINTS = { dailyCap: 30 };
  const ARCPTS = { play: 2, win: 5, dailyCap: 60 }; // dailyCap: แต้มสูงสุดต่อวันต่อคน (กันจับคู่เล่นปั่นแต้ม)
  // ร้านรางวัลแต้มตู้เกม (สกุลแยกจากเหรียญ แลกข้ามไม่ได้): ของหายาก + ฉายาเฉพาะ • title = ฉายาที่ได้ (เลือกใช้ได้ภายหลังในร้านเดียวกัน)
  const ARC_SHOP = [
    { id: 'furn_cat', pts: 300 }, { id: 'furn_flag', pts: 300 }, { id: 'furn_statue', pts: 450 }, { id: 'furn_fountain', pts: 450 },
    { id: 't_lucky', pts: 150, title: 'มือขึ้นประจำลาน', emoji: '🍀' }, { id: 't_pro', pts: 350, title: 'นักกีฬาตู้เกม', emoji: '🕹️' }, { id: 't_king', pts: 800, title: 'ราชาตู้เกม', emoji: '👑' },
  ]; // แต้มตู้เกม: เล่นจบได้ +play, ชนะคนจริงได้ +win เพิ่ม (ไม่ได้จากบอท/คาสิโน) — ใช้แลกของโชว์ในร้านรางวัล + จัดอันดับ Leaderboard
  const BUFFS = {
    speed:  { name: 'เท้าเบา',  emoji: '🏃', desc: 'เดินเร็วขึ้น 10%',             cost: 10, ms: 15 * 60000 },
    hunger: { name: 'อิ่มทน',   emoji: '🍖', desc: 'ความหิวลดช้าลงครึ่งหนึ่ง',      cost: 8,  ms: 15 * 60000 },
  };
  const FAME = { harvest: ['🌾', 'นักเก็บเกี่ยว'], water: ['💧', 'ผู้ขยันรดน้ำ'], feed: ['🥣', 'พ่อบ้านใส่ใจสัตว์'], fish: ['🎣', 'เซียนตกปลา'], chop: ['🪓', 'นักโค่นไม้'], collect: ['🥚', 'ผู้เก็บผลผลิต'], craft: ['🔨', 'ช่างฝีมือ'], mine: ['⚒️', 'นักขุดเหมือง'] };
  // ตู้ ATM: ที่เก็บเหรียญอย่างเดียว (ไม่มีดอกเบี้ย: คนมีเงินต้องไม่ได้เงินเพิ่มจากการฝากเฉยๆ เราอยากให้ออกมาเล่น) มีเพดานเงินฝาก
  const BANK = { cap: 100000, amts: [100, 1000, 10000] };
  // Happy Village: ทั้งเมืองช่วยกันทำงานสะสมครบเป้าของวัน (เป้า = base + per × จำนวนคนออนไลน์สูงสุดของวัน) → ทุกคนได้บัฟร่วม ms มิลลิวินาที
  const VILLAGE = { maxShare: 0.5, base: 30, per: 20, ms: 20 * 60000, fishMul: 0.75, hardBonus: 0.1 };
  // เดิมพันกับบอท: เงินเดิมพันฝั่งบอทมาจากบ้าน (สร้างเหรียญใหม่) จึงจำกัดวงเงินต่อครั้ง และกำไรสุทธิจากบอทต่อวันไม่เกิน dailyWinCap (ขาดทุนไม่จำกัด)
  const BOTBET = { bets: [0], dailyWinCap: 0 }; // ปิดการจ่ายเหรียญจากบอท (ซ้อมฟรีเท่านั้น) จนกว่าจะมีแต้มตู้เกม เดิมคือ bets [0,10,50,100,200,300] และ dailyWinCap 500
  // ของแจกจากกองกลาง: รับได้วันละ 1 ครั้ง ต้อง "เล่นจริง" = ระดับการเล่น (ผลรวมเลเวลทุกอาชีพ) ถึงเกณฑ์ และทำเควสประจำวันสำเร็จอย่างน้อย needQuests ข้อวันนี้
  // ยิ่งเงินกองกลางเยอะยิ่งปลดล็อกชุดแจกที่ใหญ่ขึ้น (ต้องผ่านทั้ง chest และ lv) ต้นทุนจ่ายจากกองกลาง ต้องเหลือสำรอง reserve
  const DOLE = {
    reserve: 60, needQuests: 1,
    tiers: [
      { chest: 100,  lv: 5,  coin: 10,  meals: ['bread'] },
      { chest: 300,  lv: 8,  coin: 25,  meals: ['bread', 'sandwich'] },
      { chest: 600,  lv: 12, coin: 50,  meals: ['sandwich', 'soup'] },
      { chest: 1000, lv: 16, coin: 90,  meals: ['soup', 'rice'] },
      { chest: 2000, lv: 22, coin: 150, meals: ['rice', 'soup', 'sandwich'] },
    ],
  };
  const LEGACY_SKILLS = 5; // อาชีพที่มีมาตั้งแต่ต้น (นักขุดแร่เพิ่มทีหลัง): หักเลเวลตั้งต้นของอาชีพใหม่ออก เกณฑ์มือใหม่/เงินช่วยเหลือที่ตั้งไว้ตามช่วง 5–50 จะได้ไม่เลื่อน
  const playLevel = skills => Object.keys(SKILLS).reduce((n, k) => n + levelOf(skills && skills[k]), 0) - (Object.keys(SKILLS).length - LEGACY_SKILLS);
  const doleCost = t => t.coin + t.meals.reduce((n, id) => n + MEALS.find(m => m.id === id).price, 0);
  const dolePackage = (chestCoin, level) => { for (let i = DOLE.tiers.length - 1; i >= 0; i--) { const t = DOLE.tiers[i]; if (chestCoin >= t.chest && level >= t.lv) return t; } return null; };
  const NPC = { sayMin: 45000, sayMax: 110000, gap: 12000, speed: 50 }; // ชาวเมือง NPC: พิมพ์ข้อความทุก sayMin-sayMax ms, เดินด้วยความเร็ว speed px/วินาที
  // คู่มือเริ่มต้น 6 ข้อ (เดิม 12: ข้อสัตว์/เควส/นั่ง ผ่านแค่ 13–25% ตัดออก 25 ต.ค. 2026 จะย้ายไปภารกิจวันที่ 2 ใน GROWTH-PLAN N2): ทำครบทุกข้อ (ลำดับไหนก็ได้) ได้ของรางวัลเล็กทีละข้อ + รางวัลใหญ่ตอนจบ ปุ่มช่วยบนจอบอก "ข้อถัดไป" ให้เสมอ
  // how = วิธีกดทีละขั้น (แสดงในเมนู 📋 เควส → เริ่มต้น) • ตัวเลข 1–7 = ช่องเครื่องมือด้านล่างจอ (กดเลขบนคีย์บอร์ด หรือแตะที่ช่องบนมือถือ)
  const STARTER = [
    { id: 'dig',     ev: 'dig',       hint: 'ขุดดินในรั้วแปลงผัก ⛏️',     text: 'ขุดดินในรั้วแปลงผัก', coin: 15,
      how: ['กดช่อง 1 (เลข 1 หรือแตะช่องแรกด้านล่างจอ) แล้วเลือก ⛏️ จอบ จากเมนูที่เด้งขึ้น (หรือกด Q สลับเครื่องมือ)', 'ตามลูกศรสีเหลืองไปที่แปลงผักที่ล้อมรั้ว', 'คลิก/แตะที่พื้นหญ้าในรั้ว ตัวละครจะเดินไปขุดให้เอง'] },
    { id: 'plant',   ev: 'plant',     hint: 'ปลูกเมล็ดลงดินที่ขุด 🥕',    text: 'ปลูกเมล็ดพันธุ์', coin: 15,
      how: ['กดช่อง 2 (เลข 2) 🥕 แล้วเลือกชนิดเมล็ดจากเมนู', 'คลิก/แตะที่ดินที่ขุดไว้ (ดินสีน้ำตาลเข้ม)'] },
    { id: 'water',   ev: 'water',     hint: 'รดน้ำต้นพืช 💧',            text: 'รดน้ำต้นพืช', coin: 15,
      how: ['กดช่อง 1 แล้วเลือก 🫗 บัวรดน้ำ', 'ถ้าน้ำหมด: ถือบัวแล้วคลิก/แตะที่สระน้ำเพื่อตักน้ำ', 'คลิก/แตะที่ต้นพืช (พืชโตเฉพาะตอนดินเปียก)'] },
    { id: 'harvest', ev: 'harvest',   hint: 'เก็บเกี่ยวผลผลิตที่โตแล้ว 🌽', text: 'เก็บเกี่ยวผลผลิตเมื่อโตเต็มที่', coin: 20,
      how: ['รอจนต้นโตเต็มที่ (มีผลให้เห็น)', 'คลิก/แตะที่ต้นนั้น (ใช้ ✋ มือเปล่าหรือเครื่องมืออะไรก็ได้)', 'ผักเป็นของคนปลูก ถ้าไม่มาเก็บภายใน 1 วันในเกม คนอื่นเก็บได้'] },
    { id: 'sell',    ev: 'sell',      hint: 'ขายของที่ร้านเมล็ดพันธุ์ 🪙', text: 'ขายผลผลิตที่ร้านเมล็ดพันธุ์', coin: 20,
      how: ['เดินไปที่ร้านเมล็ดพันธุ์ 🌱 (ลูกศรชี้ทาง)', 'คลิก/แตะที่เคาน์เตอร์ร้านใต้หลังคาเขียว', 'ในหน้าร้าน เลื่อนลงไปที่ "ขาย" แล้วกดปุ่ม ขาย / ทั้งหมด'] },
    { id: 'fish',    ev: 'fish',      hint: 'ตกปลาริมสระ 🎣',            text: 'ตกปลา 1 ตัว', coin: 20,
      how: ['ซื้อเหยื่อที่ร้านตกปลา 🎣 (ไส้เดือนราคาถูก) แล้วกดช่อง 1 เลือก 🎣 เบ็ด (เมนูเดียวกันมีแถวให้เลือกเหยื่อ)', 'ยืนริมสระ คลิก/แตะที่น้ำเพื่อเหวี่ยงเบ็ด', 'พอขึ้น ❗ ให้กดตอนตัวชี้อยู่ในโซนเขียวของเกจ'] },
  ];
  // จุดหมายของลูกศรนำทางแต่ละข้อ (ช่อง x,y) • null = ไม่มีลูกศร
  const STARTER_GO = { dig: [10, 16], plant: [10, 16], water: [10, 16], harvest: [10, 16], sell: [22, 18], fish: [10, 22], buyfeed: [43, 24], feed: [48, 11], collect: [48, 11], sellprod: [43, 24], quest: null, sit: [32, 24] };
  // ความสำเร็จ (Achievement): stat = ตัวนับสะสมของผู้เล่น (นับจากเหตุการณ์ในเกม) • ได้เหรียญรางวัล และบางข้อปลดล็อกฉายาให้เลือกใช้ (title) • tier ใช้จัดกลุ่ม/ความเท่
  const ACH = [
    { id: 'harvest1',   e: '🌾', name: 'ต้นแรกของฉัน',     desc: 'เก็บเกี่ยวผลผลิตครั้งแรก',            stat: 'harvest', goal: 1,   coin: 10 },
    { id: 'harvest50',  e: '🌾', name: 'ชาวไร่มือทอง',      desc: 'เก็บเกี่ยวผลผลิต 50 ครั้ง',           stat: 'harvest', goal: 50,  coin: 60,   title: 'ชาวไร่มือทอง' },
    { id: 'harvest300', e: '🌽', name: 'เจ้าพ่อไร่นา',      desc: 'เก็บเกี่ยวผลผลิต 300 ครั้ง',          stat: 'harvest', goal: 300, coin: 300,  title: 'เจ้าพ่อไร่นา' },
    { id: 'fish1',      e: '🎣', name: 'ปลาตัวแรก',        desc: 'ตกปลาได้ครั้งแรก',                    stat: 'fish',    goal: 1,   coin: 10 },
    { id: 'fish40',     e: '🐟', name: 'ขาประจำริมสระ',     desc: 'ตกปลา 40 ตัว',                        stat: 'fish',    goal: 40,  coin: 70,   title: 'ขาประจำริมสระ' },
    { id: 'fish250',    e: '🐋', name: 'เซียนเบ็ดทอง',      desc: 'ตกปลา 250 ตัว',                       stat: 'fish',    goal: 250, coin: 350,  title: 'เซียนเบ็ดทอง' },
    { id: 'fishbig1',   e: '🦈', name: 'โชคดีได้ปลาใหญ่',   desc: 'ตกปลามีค่า (ขายได้ 55 ขึ้นไป) 1 ตัว',  stat: 'fishbig', goal: 1,   coin: 40 },
    { id: 'fishbig20',  e: '🐬', name: 'นักล่าปลายักษ์',    desc: 'ตกปลามีค่า 20 ตัว',                   stat: 'fishbig', goal: 20,  coin: 250,  title: 'นักล่าปลายักษ์' },
    { id: 'chop1',      e: '🪓', name: 'ขวานเล่มแรก',      desc: 'โค่นต้นไม้ครั้งแรก',                  stat: 'chop',    goal: 1,   coin: 10 },
    { id: 'chop40',     e: '🪵', name: 'ช่างตัดไม้',        desc: 'โค่นต้นไม้ 40 ต้น',                   stat: 'chop',    goal: 40,  coin: 80,   title: 'ช่างตัดไม้' },
    { id: 'mine1',      e: '⚒️', name: 'ก้าวแรกในถ้ำ',     desc: 'ขุดก้อนแร่ครั้งแรก',                  stat: 'mine',    goal: 1,   coin: 10 },
    { id: 'mine50',     e: '⛏️', name: 'นักขุดมือใหม่',    desc: 'ขุดก้อนแร่ 50 ก้อน',                  stat: 'mine',    goal: 50,  coin: 90,   title: 'นักขุดมือใหม่' },
    { id: 'mine300',    e: '💎', name: 'จอมเหมือง',        desc: 'ขุดก้อนแร่ 300 ก้อน',                 stat: 'mine',    goal: 300, coin: 400,  title: 'จอมเหมือง' },
    { id: 'chop200',    e: '🌲', name: 'จอมขวานแห่งป่า',    desc: 'โค่นต้นไม้ 200 ต้น',                  stat: 'chop',    goal: 200, coin: 350,  title: 'จอมขวานแห่งป่า' },
    { id: 'hard1',      e: '🟫', name: 'ไม้เนื้อแข็ง',       desc: 'หาไม้เนื้อแข็งได้ครั้งแรก',            stat: 'hardwood', goal: 1,  coin: 40 },
    { id: 'collect1',   e: '🥚', name: 'ไข่ใบแรก',          desc: 'เก็บผลผลิตจากสัตว์ครั้งแรก',           stat: 'collect', goal: 1,   coin: 10 },
    { id: 'collect40',  e: '🐔', name: 'พ่อบ้านฟาร์ม',      desc: 'เก็บผลผลิตสัตว์ 40 ครั้ง',             stat: 'collect', goal: 40,  coin: 80,   title: 'พ่อบ้านฟาร์ม' },
    { id: 'collect200', e: '🐄', name: 'ราชาปศุสัตว์',      desc: 'เก็บผลผลิตสัตว์ 200 ครั้ง',            stat: 'collect', goal: 200, coin: 350,  title: 'ราชาปศุสัตว์' },
    { id: 'feed30',     e: '🌾', name: 'ใจดีต่อสัตว์',       desc: 'ให้อาหารสัตว์ 30 ครั้ง',               stat: 'feed',    goal: 30,  coin: 60 },
    { id: 'cook1',      e: '🍳', name: 'เชฟมือใหม่',        desc: 'ทำอาหารจานแรก',                       stat: 'cook',    goal: 1,   coin: 20 },
    { id: 'cook25',     e: '👨‍🍳', name: 'เชฟประจำเมือง',     desc: 'ทำอาหาร 25 จาน',                      stat: 'cook',    goal: 25,  coin: 200,  title: 'เชฟประจำเมือง' },
    { id: 'sell10',     e: '🪙', name: 'พ่อค้าแม่ค้า',       desc: 'ขายของ 10 ครั้ง',                     stat: 'sell',    goal: 10,  coin: 30 },
    { id: 'sell150',    e: '💰', name: 'เจ้าสัวตลาดสด',     desc: 'ขายของ 150 ครั้ง',                    stat: 'sell',    goal: 150, coin: 300,  title: 'เจ้าสัวตลาดสด' },
    { id: 'allq1',      e: '📋', name: 'เควสครบวัน',        desc: 'ทำเควสประจำวันครบทุกข้อใน 1 วัน',      stat: 'allq',    goal: 1,   coin: 60 },
    { id: 'allq10',     e: '⭐', name: 'ขยันไม่มีวันหยุด',   desc: 'ทำเควสประจำวันครบทุกข้อ 10 วัน',       stat: 'allq',    goal: 10,  coin: 400,  title: 'ขยันไม่มีวันหยุด' },
    { id: 'arcplay5',   e: '🎮', name: 'นักเล่นตู้เกม',      desc: 'เล่นตู้เกมกับคนจริงจบ 5 เกม',          stat: 'arcplay', goal: 5,   coin: 40 },
    { id: 'arcwin5',    e: '🏆', name: 'เซียนตู้เกม',        desc: 'ชนะตู้เกมกับคนจริง 5 ครั้ง',           stat: 'arcwin',  goal: 5,   coin: 100,  title: 'เซียนตู้เกม' },
    { id: 'arcwin30',   e: '👑', name: 'แชมป์อาร์เคด',       desc: 'ชนะตู้เกมกับคนจริง 30 ครั้ง',          stat: 'arcwin',  goal: 30,  coin: 500,  title: 'แชมป์อาร์เคด' },
    { id: 'mentor3',    e: '🤗', name: 'พี่เลี้ยงใจดี',       desc: 'ทักคนใหม่แล้วเขาผ่านคู่มือเริ่มต้น 3 คน',  stat: 'mentor',  goal: 3,   coin: 100,  title: 'พี่เลี้ยงใจดี' },
    { id: 'invite1',    e: '🪣', name: 'ผู้จุดไฟ',            desc: 'ท้าเพื่อนด้วยชาเลนจ์ถังน้ำ แล้วเพื่อนผ่านคู่มือ 1 คน', stat: 'invite', goal: 1,  coin: 0,    title: 'ผู้จุดไฟ' },
    { id: 'invite3',    e: '🪣', name: 'นักส่งต่อถังน้ำ',      desc: 'ท้าเพื่อนสำเร็จ 3 คน',                 stat: 'invite',  goal: 3,   coin: 0,    title: 'นักส่งต่อถังน้ำ' },
    { id: 'invite10',   e: '🌳', name: 'ตำนานส่งต่อ',          desc: 'ท้าเพื่อนสำเร็จ 10 คน',                stat: 'invite',  goal: 10,  coin: 0,    title: 'ตำนานส่งต่อ' },
    { id: 'trade1',     e: '🤝', name: 'พ่อค้าแลกเปลี่ยน',   desc: 'เทรดของกับผู้เล่นอื่นสำเร็จ',          stat: 'trade',   goal: 1,   coin: 30 },
    { id: 'sit1',       e: '🪑', name: 'พักผ่อนบ้าง',        desc: 'นั่งพักที่ลานกองไฟ',                  stat: 'sit',     goal: 1,   coin: 10 },
    { id: 'streak3',    e: '🔥', name: 'มาทุกวัน',          desc: 'เข้าเกมติดต่อกัน 3 วัน',               stat: 'streak',  goal: 3,   coin: 50 },
    { id: 'streak7',    e: '🌟', name: 'ชาวเมืองตัวจริง',    desc: 'เข้าเกมติดต่อกัน 7 วัน',               stat: 'streak',  goal: 7,   coin: 200,  title: 'ชาวเมืองตัวจริง' },
    { id: 'rich1k',     e: '💵', name: 'เศรษฐีน้อย',         desc: 'มีเหรียญในกระเป๋าถึง 1,000',          stat: 'wealth',  goal: 1000, coin: 50 },
    { id: 'rich10k',    e: '💎', name: 'เศรษฐีเมือง',        desc: 'มีเหรียญในกระเป๋าถึง 10,000',         stat: 'wealth',  goal: 10000, coin: 500, title: 'เศรษฐีเมือง' },
  ];
  // ภารกิจสัปดาห์แรก (GROWTH-PLAN N2): ข้อที่ d ปลดล็อกในวันที่ d นับจากวันแรกที่เข้าเกม (ทำย้อนหลังได้) • ข้อละ coin • ครบ 7 ข้อได้ฉายา + ของหายาก
  // ใช้กับบัญชีที่สร้างตั้งแต่ since เท่านั้น (คนเก่าเล่นผ่านมาแล้ว)
  const WEEK1 = { since: Date.parse('2026-10-25T00:00:00+07:00'), coin: 40, final: { coin: 150, item: 'furn_flag', title: 'ชาวเมืองรุ่นบุกเบิก' }, list: [
    { d: 1, ev: 'harvest', goal: 3, emoji: '🌾', text: 'เก็บเกี่ยวผัก 3 ครั้ง' },
    { d: 2, ev: 'collect', goal: 2, emoji: '🐔', text: 'ให้อาหารสัตว์แล้วเก็บไข่/นม 2 ครั้ง (อาหารสัตว์ที่ร้านปศุสัตว์)' },
    { d: 3, ev: 'chop', goal: 2, emoji: '🪓', text: 'โค่นต้นไม้ 2 ต้น (ขวานที่ร้านช่างไม้)' },
    { d: 4, ev: 'cook', goal: 1, emoji: '🍳', text: 'ทำอาหารที่ร้านอาหาร 1 จาน' },
    { d: 5, ev: 'hplace', goal: 3, emoji: '🏠', text: 'วางของแต่งบ้าน 3 ชิ้น (ปุ่ม 🏠 บ้านฉัน)' },
    { d: 6, ev: 'arcplay', goal: 1, emoji: '🎮', text: 'เล่นตู้เกมกับคนจริงจนจบ 1 ตา' },
    { d: 7, ev: 'help', goal: 3, emoji: '💛', text: 'ช่วยงานเมือง 3 ครั้ง (รดน้ำพืชที่แห้ง ให้อาหารสัตว์ที่หิว ลงขัน)' },
  ] };
  // ชาเลนจ์ถังน้ำ 🪣 (GROWTH-PLAN N3): ทำภารกิจสั้นให้ทันเวลา ms → ได้การ์ดผลงาน + ลิงก์ท้าเพื่อน • เพื่อนที่ถูกท้ามีเวลา inviteMs ถ้าไม่สำเร็จโดนราดน้ำ (ตัวเปียก + ถังบนหัว wetMs) หรือไถ่โทษลงขันกองกลาง redeem
  // รางวัลเป็นฉายาเท่านั้น (ไม่ใช่เหรียญ กันสร้างบัญชีปลอม) นับเมื่อคนที่ถูกท้าผ่านคู่มือเริ่มต้น สูงสุด perWeek คน/สัปดาห์ • ทุกครั้งที่มีคนทำสำเร็จ ต้นไม้แห่งการส่งต่อกลางลานโตขึ้น
  const CHALLENGE = { ms: 15 * 60e3, inviteMs: 48 * 3600e3, wetMs: 24 * 3600e3, redeem: 50, retryMs: 60 * 60e3, perWeek: 10, list: [
    { id: 'harvest5', ev: 'harvest', goal: 5, emoji: '🌾', text: 'เก็บเกี่ยวผัก 5 ต้น' },
    { id: 'fish3',    ev: 'fish',    goal: 3, emoji: '🎣', text: 'ตกปลาให้ได้ 3 ตัว' },
    { id: 'water8',   ev: 'water',   goal: 8, emoji: '💧', text: 'รดน้ำพืชที่ดินแห้ง 8 ครั้ง' },
    { id: 'sell5',    ev: 'sell',    goal: 5, emoji: '🪙', text: 'ขายของที่ร้าน 5 ครั้ง' },
  ] };
  // อีเวนต์ประจำสัปดาห์ (GROWTH-PLAN N4) ช่วงที่คนเข้าเยอะ: dow = วัน (0 อาทิตย์ … 5 ศุกร์ 6 เสาร์) เวลาเริ่ม hour:min ยาว mins นาที
  // score: max = ค่าสูงสุดครั้งเดียว (ราคาปลาตัวใหญ่สุด) • distinct = จำนวนชนิดที่ต่างกัน • count = จำนวนครั้ง (เสมอกันดูจำนวนครั้ง) • แยกอันดับมือใหม่ (ระดับการเล่น < newbieLv)
  // รางวัล: ที่ 1 ของแต่ละกลุ่มได้ถ้วยรางวัล + แต้มตู้เกม • ที่ 2–3 ได้แต้มตู้เกม (ของโชว์/แต้ม ไม่ใช่เหรียญ)
  const EVENTS = { newbieLv: 15, prize: { item: 'furn_trophy', pts: [30, 15, 10] }, list: [
    { id: 'derby',   name: 'ดาร์บี้ตกปลา',  emoji: '🎣', dow: 5, hour: 21, min: 0, mins: 30, ev: 'fish',    score: 'max',      unit: 'ราคาปลาตัวใหญ่สุด' },
    { id: 'harvest', name: 'ไร่ใครขยัน',    emoji: '🌾', dow: 6, hour: 21, min: 0, mins: 60, ev: 'harvest', score: 'distinct', unit: 'ชนิดผักที่เก็บ' },
    { id: 'arcade',  name: 'ศึกตู้เกม',     emoji: '🎮', dow: 0, hour: 21, min: 0, mins: 60, ev: 'arcwin',  score: 'count',    unit: 'ครั้งที่ชนะคนจริง' },
  ] };
  const STARTER_FINAL = { coin: 150, items: ['furn_chair', 'furn_plant', 'lamp'] }; // 150 (เดิม 100 ตอนคู่มือมี 12 ข้อ) เงินช่วงแรกรวมใกล้เดิม
  // 60 วินาทีแรกของคนใหม่ (GROWTH-PLAN.md N1): กล่องของขวัญสุ่มของแต่งตัว 1 ชิ้น • เมล็ดเร่งโตสำหรับการปลูก quickSeeds ครั้งแรก (โตเร็ว ×quickMul) • ปลาตัวแรกในชีวิตเป็น firstFish
  // ต้อนรับจากเมือง: คนที่ออนไลน์ทักคนใหม่ได้ภายใน greetMs หลังเข้าเกมครั้งแรก (ไม่มีของ/เงิน ผู้ทักได้แต้มความดี greetPts)
  const NEWBIE = { gift: [...WEAR.hat, ...WEAR.acc].filter(i => i.price >= 60 && i.price <= 150).map(i => wearKey(WEAR.hat.includes(i) ? 'hat' : 'acc', i.id)), quickSeeds: 3, quickMul: 3, firstFish: 'koi', greetMs: 10 * 60 * 1000, greetPts: 1 };
  // สมุดสะสม: ได้ครบทุกชนิดในหมวดไหนรับรางวัลหมวดนั้น (ชนิดใหม่แต่ละชนิดได้ BOOK_ENTRY_COIN) rare = เฟอร์นิเจอร์หายากที่เป็นรางวัล
  const BOOK_ENTRY_COIN = 8;
  const BOOK = {
    fish: { name: 'ปลา',        emoji: '🐟', ids: FISH.filter(f => f.id !== 'boot').map(f => f.id), coin: 300, rare: 'statue' },
    crop: { name: 'พืชผล',      emoji: '🥬', ids: Object.keys(CROPS),                               coin: 250, rare: 'fountain' },
    furn: { name: 'เฟอร์นิเจอร์', emoji: '🛋️', ids: Object.keys(FURN).filter(k => !FURN[k].rare),      coin: 400, rare: 'cat' },
    meal: { name: 'อาหาร',      emoji: '🍜', ids: MEALS.map(m => m.id),                              coin: 100, rare: 'flag' },
    wood: { name: 'ไม้และของจากป่า', emoji: '🌳', ids: Object.keys(WOOD_ITEMS),                       coin: 300 }, // ไม่มีของหายาก (rare) ได้แค่เหรียญ
  };
  const bookInfo = (cat, id) => {
    if (cat === 'fish') { const f = FISH.find(x => x.id === id); return { emoji: f.emoji, name: f.name }; }
    if (cat === 'crop') return { emoji: CROPS[id].emoji, name: CROPS[id].name };
    if (cat === 'furn') return { emoji: FURN[id].emoji, name: FURN[id].name };
    if (cat === 'wood') return { emoji: WOOD_ITEMS[id].emoji, name: WOOD_ITEMS[id].name };
    const m = MEALS.find(x => x.id === id); return { emoji: m.emoji, name: m.name };
  };
  // เป้าหมายรายสัปดาห์ของเมือง: งานรวมของทุกคน (นับเหมือน Happy Village) ถึงเป้า base + per × จำนวนคนที่ลงมือสัปดาห์นี้ → คนที่มีส่วนร่วมอย่างน้อย minShare ครั้งรับรางวัลได้ (ไม่ให้รอรับฟรี)
  const WEEKLY = { maxShare: 0.5, base: 150, per: 100, minShare: 10, coin: 120 };
  const RARE = ['statue', 'fountain', 'cat', 'flag']; // วนเป็นรางวัลประจำสัปดาห์ / ครบ 7 วันติดต่อกัน
  // โรงงานช่างไม้ (ร้านช่างไม้): แปรรูปไม้ท่อนเป็นไม้กระดาน และประดิษฐ์เฟอร์นิเจอร์เอง (ถูกกว่าซื้อ + ได้ XP ช่างไม้) ของที่ทำได้แค่ช่างไม้: ลังไม้ ถังไม้ ป้ายชี้ทาง ตู้ไปรษณีย์ ตู้เครื่องมือ กระท่อมไม้
  // id = ไอเทมที่ได้ (1 ชิ้น), in = วัตถุดิบ, lv = เลเวลช่างไม้ที่ต้องมี
  const CRAFT = [
    { id: 'plank',         in: { log: 2 },                   lv: 1, xp: 4 },
    { id: 'furn_chair',    in: { log: 8 },                   lv: 1, xp: 14 },
    { id: 'furn_crate',    in: { plank: 4 },                 lv: 1, xp: 18 },
    { id: 'furn_table',    in: { log: 16 },                  lv: 2, xp: 28 },
    { id: 'furn_barrel',   in: { plank: 6 },                 lv: 2, xp: 26 },
    { id: 'furn_signpost', in: { plank: 5, log: 4 },         lv: 2, xp: 26 },
    { id: 'furn_shelf',    in: { log: 22 },                  lv: 3, xp: 36 },
    { id: 'furn_mailbox',  in: { plank: 8 },                 lv: 3, xp: 36 },
    { id: 'furn_toolbox',  in: { plank: 8, hardwood: 2 },    lv: 4, xp: 46 },
    { id: 'furn_bed',      in: { log: 30, hardwood: 3 },     lv: 5, xp: 60 },
    { id: 'furn_hut',      in: { plank: 24, hardwood: 6 },   lv: 6, xp: 110 },
    // จากไม้ชนิดใหม่ (B5): XP ≈ 0.27 ต่อเหรียญของวัตถุดิบ เท่ากับลังไม้
    { id: 'furn_screen_bamboo', in: { bamboo: 8 },             lv: 1, xp: 20 },
    { id: 'furn_stool',    in: { pinewood: 3 },               lv: 2, xp: 18 },
    { id: 'furn_armchair', in: { palmwood: 4, plank: 2 },     lv: 3, xp: 45 },
    { id: 'furn_wardrobe', in: { teak: 5, plank: 2 },         lv: 4, xp: 75 },
    { id: 'furn_dresser',  in: { goldwood: 4 },               lv: 6, xp: 65 },
    { id: 'furn_bedking',  in: { rosewood: 5, teak: 3 },      lv: 8, xp: 200 },
  ];
  const seatAt = (tx, ty) => SEATS.find(s => s.x === tx && s.y === ty) || null;
  const cinemaAt = () => false; // เลิกมีโรงหนังกลางแปลงแล้ว (ผังเมืองใหม่) ระบบฉายหนังเดิมยังค้างในโค้ด ไม่มีทางเข้า
  const CINEMA_CENTER = { x: 17 * TS, y: 35 * TS };
  const ARC_RANGE = 3.5;              // ระยะ (ช่อง) ที่ต้องอยู่ใกล้ตู้เกมถึงจะเปิด/นั่งเล่นได้ เดินห่างเกิน 3 ช่องจะถูกพาออกจากโต๊ะ
  const BETS = [0, 10, 50, 100, 500]; // ยอดเดิมพันที่เลือกได้ในตู้เกม
  const cabinetAt = (tx, ty) => { for (let i = 0; i < CABINETS.length; i++) if (CABINETS[i].x === tx && CABINETS[i].y === ty) return Object.assign({ idx: i }, CABINETS[i]); return null; };
  // ยานพาหนะ: ซื้อครั้งเดียว ขี่/ลงได้ที่ร้านยานพาหนะหรือกด V • speed = ตัวคูณความเร็วเดิน (เฉพาะในเมือง ในบ้านลงเดิน) • ขายคืนได้ 70%
  const VEHICLES = { bike: { name: 'จักรยาน', emoji: '🚲', price: 300, speed: 1.2 }, scooter: { name: 'มอเตอร์ไซค์', emoji: '🛵', price: 1500, speed: 1.4 }, car: { name: 'รถยนต์', emoji: '🚗', price: 6000, speed: 1.6 } };
  const WISH_EXTRA = Object.values(VEHICLES).map(v => ({ k: 'veh', p: v.price })); // ที่ใช้เงินแบบซื้อครั้งเดียวที่เพิ่มในขั้น 2 (tools/econsim.js ใช้ทำรายการของที่อยากได้)
  // ร้านแต่ละสาย: buy = สินค้าที่ขาย, sell = คำนำหน้าไอเทมที่ร้านรับซื้อ
  const SHOPS = {
    farm:   { name: '🌱 ร้านเมล็ดพันธุ์', skill: 'farm',   buy: Object.keys(CROPS).map(c => 'seed_' + c).concat(['can_2', 'can_3']), sell: ['crop_'] },
    fish:   { name: '🎣 ร้านตกปลา',      skill: 'fish',   buy: ['bait', 'bait_2', 'bait_3', 'rod_2', 'rod_3', 'rod_4', 'rod_5', 'rod_6', 'rod_7'],                  sell: ['fish_'] },
    animal: { name: '🐄 ร้านปศุสัตว์',    skill: 'animal', buy: ['feed', 'hay', 'slop', 'nectar', 'medicine', 'animal_chicken', 'animal_duck', 'animal_cow', 'animal_sheep', 'animal_pig', 'animal_bee', 'animal_alpaca', 'animal_horse', 'animal_boar'], sell: ['egg', 'duck_egg', 'milk', 'wool', 'truffle', 'honey', 'alpaca_wool', 'horse_milk', 'chestnut'] },
    pet:    { name: '🐾 ร้านสัตว์เลี้ยง', skill: null,     buy: Object.keys(COMPANIONS).map(c => 'pet_' + c).concat(['petfood', 'medicine']), sell: [] }, // ซื้อแล้วพาติดตัวไปไหนก็ได้ ขายคืนได้ 70%
    mine:   { name: '⚒️ ร้านช่างเหมือง', skill: 'mine',   buy: ['pick_1', 'pick_2', 'pick_3', 'pick_4', 'pick_5', 'pick_6', 'lamp'], sell: Object.keys(ORES) }, // รับซื้อแร่ทุกชนิด
    wood:   { name: '🪓 ร้านช่างไม้',     skill: 'wood',   buy: ['axe_1', 'axe_2', 'axe_3', 'axe_4', 'axe_5'], sell: [...Object.keys(WOOD_ITEMS), 'plank'] }, // รับซื้อของจากต้นไม้ทุกชนิด
    // ร้านยานพาหนะ (ขั้น 2 ใน ECONOMY-PLAN.md): ซื้อแล้วขี่ได้ในเมือง เดินเร็วขึ้นตาม VEHICLES.speed • เรือยังไม่เปิด (soon)
    vehicle: { name: '🚲 ร้านยานพาหนะ',  skill: null,     buy: Object.keys(VEHICLES).map(v => 'veh_' + v), sell: [], soon: [{ emoji: '⛵', name: 'เรือ (แล่นในสระ)', price: 4000 }] },
    cloth:  { name: '👕 ร้านเสื้อผ้า',    skill: null,     buy: Object.keys(WEAR).flatMap(c => WEAR[c].filter(i => i.price > 0).map(i => wearKey(c, i.id))), sell: [] },
    food:   { name: '🍜 ร้านอาหาร',      skill: null,     buy: MEALS.map(m => 'meal_' + m.id), sell: ['dish_'] },
    furn:   { name: '🛋️ ร้านเฟอร์นิเจอร์', skill: null,     buy: Object.keys(FURN).filter(f => !FURN[f].rare && !FURN[f].craft).map(f => 'furn_' + f), sell: ['furn_'] }, // รับซื้อเฟอร์นิเจอร์ในกระเป๋า (ที่ยังไม่ได้วาง) คืนที่ SELLBACK ของราคา
  };

  // ข้อมูลของแต่ละไอเทม: buy/sell = ราคา, lv + skill = เงื่อนไขเลเวลตอนซื้อ
  function itemInfo(k) { const i = itemInfo0(k); if (i && FOOD[k]) i.food = FOOD[k]; return i; }
  function itemInfo0(k) {
    let wm = /^wear_(shirt|pants|hat|acc)_(\w+)$/.exec(k);
    if (wm) { const it = WEAR[wm[1]].find(x => x.id === wm[2]); return it ? { name: it.name, emoji: WEAR_CATS[wm[1]].emoji, buy: it.price, once: true, cat: 'wear', wear: { cat: wm[1], id: it.id } } : null; }
    wm = /^meal_(\w+)$/.exec(k);
    if (wm) { const ml = MEALS.find(x => x.id === wm[1]); return ml ? { name: ml.name, emoji: ml.emoji, buy: ml.price, cat: 'food' } : null; }
    wm = /^dish_(\w+)$/.exec(k);
    if (wm) { const d = COOK.find(x => x.id === k); return d ? { name: d.name, emoji: d.emoji, sell: d.sell, cat: 'food' } : null; }
    if (WOOD_ITEMS[k]) { const w = WOOD_ITEMS[k]; return { name: w.name, emoji: w.emoji, sell: w.sell, cat: 'wood' }; }
    if (ORES[k]) { const o = ORES[k]; return { name: o.name, emoji: o.emoji, sell: o.sell, cat: 'ore' }; }
    const pm = /^pick_(\d)$/.exec(k);
    if (pm && PICKS[pm[1]]) return { name: PICKS[pm[1]].name, emoji: PICK_EMOJI[pm[1]], buy: PICKS[pm[1]].price, lv: PICKS[pm[1]].lv, skill: 'mine', once: true, cat: 'gear', pick: +pm[1] };
    if (k === 'plank') return { name: 'ไม้กระดาน', emoji: '🟧', sell: 58, cat: 'wood' };
    if (k === 'lamp') return { name: 'ตะเกียง/ไฟฉาย (สว่างรอบตัว 5 ช่อง)', emoji: '🔦', buy: 120, once: true, cat: 'gear' }; // ซื้อได้ที่ร้านช่างเหมือง (ใช้ส่องถ้ำ) หรือได้จากรางวัลคู่มือเริ่มต้น • ขายต่อไม่ได้
    if (k === 'medicine') return { name: 'ยารักษาสัตว์', emoji: '💊', buy: 20, cat: 'feed' };
    const fm = /^furn_(\w+)$/.exec(k);
    if (fm) return FURN[fm[1]] ? { name: FURN[fm[1]].name, emoji: FURN[fm[1]].emoji, buy: FURN[fm[1]].price, sell: FURN[fm[1]].rare ? undefined : Math.floor(FURN[fm[1]].price * FURN_SELL), cat: 'furn', furn: fm[1] } : null;
    const cm = /^can_(\d)$/.exec(k);
    if (cm && CANS[cm[1]] && CANS[cm[1]].price) { const c = CANS[cm[1]]; return { name: `${c.name} (น้ำ ${c.cap} ครั้ง • ดินเปียก ${c.wet / 1000} วิ)`, emoji: c.emoji, buy: c.price, lv: c.lv, skill: 'farm', once: true, cat: 'gear', can: +cm[1] }; }
    let am = /^axe_(\d)$/.exec(k);
    if (am && AXES[am[1]]) return { name: AXES[am[1]].name, emoji: '🪓', buy: AXES[am[1]].price, lv: AXES[am[1]].lv, skill: 'wood', once: true, cat: 'gear', axe: +am[1] };
    if (k === 'egg')  return { name: 'ไข่ไก่', emoji: '🥚', sell: 20, cat: 'animal' };
    if (k === 'duck_egg') return { name: 'ไข่เป็ด', emoji: '🥚', sell: 30, cat: 'animal' };
    if (k === 'wool') return { name: 'ขนแกะ', emoji: '🧶', sell: 85, cat: 'animal' };
    if (k === 'milk') return { name: 'นมวัว', emoji: '🥛', sell: 55, cat: 'animal' };
    if (k === 'feed') return { name: 'อาหารไก่', emoji: '🌾', buy: 5, cat: 'feed' };
    if (k === 'hay')  return { name: 'หญ้าแห้ง (อาหารวัว)', emoji: '🌿', buy: 12, cat: 'feed' };
    if (k === 'slop') return { name: 'อาหารหมู', emoji: '🥣', buy: 15, cat: 'feed' };
    if (k === 'nectar') return { name: 'น้ำหวานดอกไม้ (อาหารผึ้ง)', emoji: '🌼', buy: 10, cat: 'feed' };
    if (k === 'honey') return { name: 'น้ำผึ้ง', emoji: '🍯', sell: 80, cat: 'animal' };
    if (k === 'truffle') return { name: 'เห็ดทรัฟเฟิล', emoji: '🍄', sell: 110, cat: 'animal' };
    if (k === 'alpaca_wool') return { name: 'ขนอัลปากา', emoji: '🧵', sell: 95, cat: 'animal' };
    if (k === 'horse_milk') return { name: 'นมม้า', emoji: '🍼', sell: 110, cat: 'animal' };
    if (k === 'chestnut') return { name: 'เกาลัดป่า', emoji: '🌰', sell: 130, cat: 'animal' };
    if (k === 'bait') return { name: 'เหยื่อตกปลา (ไส้เดือน)', emoji: '🪱', buy: BAIT_PRICE, cat: 'tool', bait: 1 };
    const bm = /^bait_(\d)$/.exec(k);
    if (bm && BAITS[bm[1]]) { const b = BAITS[bm[1]]; return { name: `เหยื่อ${b.name} (ปลาแพงขึ้น)`, emoji: b.emoji, buy: b.price, lv: b.lv, skill: 'fish', cat: 'tool', bait: +bm[1] }; }
    let m = /^rod_(\d)$/.exec(k);
    if (m && RODS[m[1]] && RODS[m[1]].price) return { name: RODS[m[1]].name, emoji: '🎣', buy: RODS[m[1]].price, lv: RODS[m[1]].lv, skill: 'fish', once: true, cat: 'gear' };
    if (k === 'petfood') return { name: 'อาหารสัตว์เลี้ยง (+' + PETCARE.food + ' อิ่ม)', emoji: '🦴', buy: 8, cat: 'feed' };
    m = /^veh_(\w+)$/.exec(k);
    if (m && VEHICLES[m[1]]) { const v = VEHICLES[m[1]]; return { name: `${v.name} (เร็วขึ้น ${Math.round((v.speed - 1) * 100)}%)`, emoji: v.emoji, buy: v.price, once: true, cat: 'gear', veh: m[1] }; }
    m = /^pet_(\w+)$/.exec(k);
    if (m && COMPANIONS[m[1]]) { const c = COMPANIONS[m[1]]; return { name: c.name, emoji: c.emoji, buy: c.price, once: true, cat: 'pet', pet: m[1] }; }
    m = /^animal_(\w+)$/.exec(k);
    if (m && ANIMALS[m[1]]) { const a = ANIMALS[m[1]]; return { name: 'ซื้อ' + a.name + 'เพิ่ม', emoji: a.emoji, buy: a.price, lv: a.lv, skill: 'animal', animal: m[1], cat: 'animalbuy' }; }
    const i = k.indexOf('_'), a = k.slice(0, i), b = k.slice(i + 1);
    if (a === 'seed' && CROPS[b]) return { name: 'เมล็ด' + CROPS[b].name, emoji: CROPS[b].emoji, buy: CROPS[b].seed, lv: CROPS[b].lv, skill: 'farm', cat: 'seed' };
    if (a === 'crop' && CROPS[b]) return { name: CROPS[b].name, emoji: CROPS[b].emoji, sell: CROPS[b].sell, cat: 'crop' };
    if (a === 'fish') { const f = FISH.find(f => f.id === b); if (f) return { name: f.name, emoji: f.emoji, sell: f.sell, cat: 'fish' }; }
    return null;
  }
  // ขายของที่ซื้อมาคืนร้านได้ในราคา 70% ของราคาซื้อ (เฉพาะของชิ้นเดียวที่ซื้อครั้งเดียว: เสื้อผ้า คันเบ็ด ขวาน ตะเกียง)
  const sellbackValue = k => { const i = itemInfo(k); return i && i.once && i.buy ? Math.floor(i.buy * SELLBACK) : 0; };
  // ของที่เทรดได้: ไม่ใช่เหรียญ ไม่ใช่ของชิ้นเดียวที่ผูกกับตัว (เสื้อผ้า คันเบ็ด ขวาน ตะเกียง) ไม่ใช่สัตว์ที่ซื้อ
  const tradeValue = k => { const i = itemInfo(k); return i ? (i.sell || i.buy || 0) : 0; };
  const isTradable = k => { if (typeof k !== 'string' || k === 'coin') return false; const i = itemInfo(k); return !!(i && !i.once && !i.animal && tradeValue(k) > 0); };
  const shopSells = (kind, key) => !!SHOPS[kind] && SHOPS[kind].sell.some(p => key === p || (p.endsWith('_') && key.startsWith(p)));
  const shopAt = (tx, ty) => { for (const b of BUILDINGS) if (b.counter.length && tx >= b.x0 && tx <= b.x1 && ty >= b.y0 && ty <= b.y1) return b.kind; return null; }; // กดที่ไหนก็ได้บนตัวอาคารร้าน (ประตูคือจุดที่ใช้วัดระยะ)

  function cropStage(tile) {
    const c = CROPS[tile.c]; if (!c) return 0;
    return tile.g >= c.time ? 3 : Math.floor(tile.g / c.time * 3);
  }

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function makeMap(opts) { // opts.bare = ภูมิประเทศล้วน ไม่วางร้าน/ตู้/กองไฟ (ใช้ตรวจว่าตำแหน่งใหม่ซ้อนน้ำ รั้ว ผา ฯลฯ ไหม)
    const bare = !!(opts && opts.bare);
    const m = Array.from({ length: H }, () => new Array(W).fill(T.GRASS));
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) m[y][x] = v; };
    const setIfGrass = (x, y, v) => { if (m[y] && m[y][x] === T.GRASS) m[y][x] = v; };
    const road = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setIfGrass(x, y, T.PATH); };
    const fence = (x0, y0, x1, y1) => {
      for (let x = x0; x <= x1; x++) { set(x, y0, T.FENCE); set(x, y1, T.FENCE); }
      for (let y = y0; y <= y1; y++) { set(x0, y, T.FENCE); set(x1, y, T.FENCE); }
    };
    // สระน้ำใหญ่ + ชายหาด
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - 43) / 12, dy = (y - 38) / 5, d = dx * dx + dy * dy;
      if (d < 1) m[y][x] = T.WATER; else if (d < 1.45) m[y][x] = T.SAND;
    }
    // บ่อน้ำ (well) ใต้แปลงผัก: ตักน้ำรดผักได้ ไม่ต้องเดินไปสระใหญ่
    for (let x = 8; x <= 13; x++) { set(x, 23, T.WATER); set(x, 24, T.WATER); }
    for (let x = 7; x <= 14; x++) { set(x, 22, T.SAND); set(x, 25, T.SAND); }
    for (let y = 23; y <= 24; y++) { set(7, y, T.SAND); set(14, y, T.SAND); }
    // ถนน / ลานปูหิน (ผังเมือง v3): ถนนหลักรูปกากบาท ตัดกันที่ลานกองไฟ • เหนือ = ที่ราบ Arcade/เทศกาล (ขึ้นบันได) • ตะวันตก = แปลงผัก+บ่อ
    // • ตะวันออก = เล้าสัตว์ 3 แถว • ใต้ = สระใหญ่ • ตะวันตกเฉียงใต้ = ป่า (ร้านช่างไม้) • เหนือถนนหลัก = แถวร้าน + บ้านหลังใหญ่ + ร้านช่างเหมือง
    road(24, 1, 41, 7);                                       // ลานตู้เกม (Arcade Hub) บนที่ราบเหนือ
    road(21, 9, 45, 9);                                       // ทางเลียบหน้าผา: ปากถ้ำ → บันได → เล้าสัตว์
    road(33, 9, 34, 33);                                      // ถนนสายกลาง เหนือ→ใต้ (บันได → ลานกองไฟ → ชายสระ)
    road(19, 19, 45, 20);                                     // ถนนหลักตะวันออก–ตะวันตก (ประตูแปลงผัก → เล้าสัตว์)
    road(24, 9, 24, 15); road(24, 15, 32, 15);                // ทางหน้าร้านช่างเหมือง + ทางหน้าบ้านหลังใหญ่
    road(35, 14, 44, 14);                                     // ซอยร้านค้า (ร้านเฟอร์นิเจอร์/ยานพาหนะ) ออกถนนสายกลางและทางเล้าสัตว์
    road(26, 21, 40, 30);                                     // ลานกองไฟกลางเมือง
    road(41, 21, 41, 32); road(39, 31, 45, 32);               // ทางข้างลานไปร้านปศุสัตว์/สัตว์เลี้ยง และลงสะพานริมสระ
    road(12, 29, 25, 30);                                     // ทางเข้าป่า (ร้านช่างไม้) จากลานกองไฟ
    road(45, 9, 45, 31);                                      // ทางเลียบเล้าสัตว์ฝั่งตะวันตก
    road(46, 15, 62, 16); road(46, 24, 62, 25);               // ทางเดินระหว่างเล้า 3 แถว
    // หน้าผาเหนือ (บันได x32–35) แบ่งที่ราบ Arcade ออกจากตัวเมือง • เลิกใช้หน้าผาตะวันออก (เล้าสัตว์อยู่ระดับเดียวกับเมือง เดินถึงง่าย)
    for (let x = 0; x < W; x++) set(x, 8, (x >= 32 && x <= 35) ? T.STAIR : T.CLIFF);
    for (const x of MINE.door) set(x, MINE.y, T.MOUTH);       // ปากถ้ำเหมืองบนหน้าผาเหนือ (เดินเข้า = เข้าถ้ำ)
    // รั้ว + ประตู
    fence(FARM.x0 - 1, FARM.y0 - 1, FARM.x1 + 1, FARM.y1 + 1); set(10, FARM.y1 + 1, T.PATH); set(11, FARM.y1 + 1, T.PATH); set(FARM.x1 + 1, 19, T.PATH); set(FARM.x1 + 1, 20, T.PATH); // ประตูสวน: กลางล่าง (ไปบ่อน้ำ) + ขวาล่าง (ไปถนนหลัก)
    for (const P of Object.values(PENS)) { fence(P.x0 - 1, P.y0 - 1, P.x1 + 1, P.y1 + 1); for (const [x, y] of P.gate) set(x, y, T.PATH); }
    for (const [x, y] of BEE.trees) set(x, y, T.TREE);
    for (const [x, y] of BEE.hives) set(x, y, T.BUILD); // รังผึ้ง (ลัง) เดินผ่านไม่ได้
    for (let y = HOUSE_BLD.y0; y <= HOUSE_BLD.y1; y++) for (let x = HOUSE_BLD.x0; x <= HOUSE_BLD.x1; x++) set(x, y, T.BUILD); // บ้านหลังใหญ่ + ขั้นหน้าประตู
    for (const x of [HOUSE_DOOR.x - 1, HOUSE_DOOR.x, HOUSE_DOOR.x + 1]) set(x, HOUSE_DOOR.y, T.PATH);
    // อาคารและเคาน์เตอร์
    if (!bare) for (const b of BUILDINGS) {
      if (b.kind !== 'sign') for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) set(x, y, T.BUILD); // ป้าย Arcade เป็นป้ายลอย เดินผ่านได้ (แตะได้จากพื้นที่ป้าย)
      for (const [x, y] of b.counter) set(x, y, T.SHOP);
    }
    // แถวยืนหน้าประตูปูทางทุกร้าน ให้ต่อกับถนน ร้านจะได้ไม่ลอยอยู่กลางหญ้า
    if (!bare) for (const b of BUILDINGS) if (b.counter.length) for (let x = b.x0; x <= b.x1; x++) setIfGrass(x, b.y1 + 1, T.PATH);
    if (!bare) for (const c of CABINETS) set(c.x, c.y, T.SHOP); // ตู้เกมเป็นช่องที่เดินผ่านไม่ได้ แต่ใช้งานได้จากช่องติดกัน
    if (!bare) { set(ATM.x, ATM.y, T.SHOP); set(BOARD.x, BOARD.y, T.SHOP); set(CHEST.x, CHEST.y, T.SHOP); } // กระดานข่าว + ตู้เซฟกองกลาง
    if (!bare) set(FIRE.x, FIRE.y, T.BUILD);                    // กองไฟ (เดินผ่านไม่ได้)
    // ต้นไม้ขอบแมพ + กระจายในที่ว่าง
    for (let x = 0; x < W; x++) { set(x, 0, T.TREE); set(x, H - 1, T.TREE); }
    for (let y = 0; y < H; y++) { set(0, y, T.TREE); set(W - 1, y, T.TREE); }
    const r = rng(11);
    const reserved = [[2, 9, 20, 26], [19, 9, 34, 33], [35, 9, 46, 34], [21, 0, 53, 8], [29, 30, 57, 45], [44, 8, 63, 32], [10, 27, 26, 31]]; // ที่โล่งของเมือง (ต้นไม้ขึ้นได้ที่ป่าตะวันตกเฉียงใต้ ที่ราบเหนือฝั่งซ้าย และมุมตะวันออกเฉียงใต้)
    for (let i = 0; i < 330; i++) {
      const x = 1 + Math.floor(r() * (W - 2)), y = 1 + Math.floor(r() * (H - 2));
      if (reserved.some(b => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3])) continue;
      setIfGrass(x, y, T.TREE);
    }
    return m;
  }

  // สิ่งก่อสร้างจากโครงการพัฒนาเมือง (PROJECTS): ยอดลงขันครบเป้าเมื่อไร ก็แปลงช่องบนแมพตามตารางนี้ทันที
  // server กับ client เรียก applyProject ตัวเดียวกัน (server ใช้คุมการเดินตัน/ทะลุ client ใช้วาดภาพ) เพิ่มโครงการใหม่ = เพิ่มแถวใน STRUCTS
  const BRIDGE = { x0: 43, y0: 34, x1: 44, y1: 42 };                        // สะพานไม้กว้าง 2 ช่อง พาดเหนือ(y33)→ใต้(y43) กลางสระ
  const LIGHTHOUSE = { x0: 48, y0: 36, x1: 49, y1: 39 };                    // ประภาคาร 2x4 ช่อง ตั้งกลางน้ำในสระฝั่งขวา (ฐานหินตัน ยืนจากน้ำได้)
  const ISLAND = { x0: 39, y0: 37, x1: 41, y1: 39, walk: { x: 42, y: 38 } }; // เกาะทราย 3x3 ข้างสะพาน + ทางไม้สั้นๆ ต่อกับสะพาน
  const FESTIVAL = { plaza: { x0: 38, y0: 3, x1: 51, y1: 6 }, stage: { x0: 43, y0: 2, x1: 46, y1: 3 }, tents: [{ x0: 39, y0: 4, x1: 40, y1: 5 }, { x0: 49, y0: 4, x1: 50, y1: 5 }] }; // ลานเทศกาลบนที่ราบเหนือ ข้างลานตู้เกม (ผังเมือง v3)
  const GROUND = [T.GRASS, T.TREE];
  function put(m, r, v, from) { for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (m[y] && from.includes(m[y][x])) m[y][x] = v; } // แปลงเฉพาะช่องชนิดที่อนุญาต ไม่ทับอาคาร/รั้วอื่น
  const STRUCTS = {
    bridge: m => put(m, BRIDGE, T.BRIDGE, [T.WATER]),
    lighthouse: () => {}, // ตัวหอวาดทับบนน้ำ ไม่เปลี่ยนชนิดช่อง (น้ำเดินไม่ได้อยู่แล้ว) พื้นจึงเป็นน้ำ ไม่เชื่อมกับตัวหอเป็นทางเดิน
    island: m => { put(m, ISLAND, T.SAND, [T.WATER]); put(m, { x0: ISLAND.walk.x, y0: ISLAND.walk.y, x1: ISLAND.walk.x, y1: ISLAND.walk.y }, T.BRIDGE, [T.WATER]); },
    festival: m => { put(m, FESTIVAL.plaza, T.PATH, GROUND); for (const r of [FESTIVAL.stage, ...FESTIVAL.tents]) put(m, r, T.LANDMARK, [...GROUND, T.PATH]); },
  };
  const projectDone = (id, coin) => coin >= PROJECTS.find(P => P.id === id).goal;
  const applyProject = (m, id) => { if (STRUCTS[id]) STRUCTS[id](m); };

  // ต้นไม้: ตัดได้ทุกต้นที่ไม่ใช่แนวต้นไม้ขอบแมพ • ต้นไม้ใหม่จะงอกเฉพาะที่สนามหญ้าเขียวที่ห่างจากสิ่งปลูกสร้าง/ถนน/รั้ว/น้ำ อย่างน้อย 3 ช่อง
  // ===== ผังที่ผู้ดูแลตั้งเอง: data/layout.json (เซิร์ฟเวอร์ส่งเป็น /layout.js → globalThis.__LAYOUT) =====
  // รูปแบบ { items: { id: {x,y} } } id = b_<kind> (ร้าน/ป้าย Arcade) • cab0..cab5 (ตู้เกม) • fire (กองไฟ+ลาน+ที่นั่งย้ายตามกัน) • atm • board • chest
  // x,y = มุมซ้ายบนของกล่อง ขนาดร้านคงเดิม แก้ค่าในที่เดิม (อ้างอิงเดิมใน server/client ยังชี้ถูก) ต้องเรียกก่อนสร้างแมพ
  const LAYOUT_SHIFT = { x: 0, y: 0 }; // กองไฟถูกย้ายไปกี่ช่อง (ใช้ขยับเสาไฟ/กระถางรอบลานฝั่งหน้าเว็บ)
  function applyLayout(lay) {
    const it = lay && lay.items; if (!it || typeof it !== 'object') return;
    const num = v => Number.isFinite(+v) ? Math.trunc(+v) : null;
    const shiftRect = (r, dx, dy) => { r.x0 += dx; r.x1 += dx; r.y0 += dy; r.y1 += dy; };
    const furnOld = BUILDINGS.find(b => b.kind === 'furn');
    const furnPrev = { x: furnOld.x0, y: furnOld.y0 };
    const f = it.fire;
    if (f && num(f.x) !== null && num(f.y) !== null) {
      const dx = num(f.x) - FIRE.x, dy = num(f.y) - FIRE.y;
      FIRE.x += dx; FIRE.y += dy; shiftRect(PLAZA, dx, dy); shiftRect(PAVED_RECTS[3], dx, dy);
      for (const q of SEATS) { q.x += dx; q.y += dy; }
      for (const o of [BOARD, ATM, CHEST]) { o.x += dx; o.y += dy; }
      SPAWN.x += dx * TS; SPAWN.y += dy * TS; STARTER_GO.sit = [STARTER_GO.sit[0] + dx, STARTER_GO.sit[1] + dy];
      LAYOUT_SHIFT.x = dx; LAYOUT_SHIFT.y = dy;
    }
    for (const [id, o] of [['board', BOARD], ['atm', ATM], ['chest', CHEST]]) { const v = it[id]; if (v && num(v.x) !== null && num(v.y) !== null) { o.x = num(v.x); o.y = num(v.y); } }
    CABINETS.forEach((c, i) => { const v = it['cab' + i]; if (v && num(v.x) !== null && num(v.y) !== null) { c.x = num(v.x); c.y = num(v.y); } });
    for (const b of BUILDINGS) {
      const v = it['b_' + b.kind]; if (!v || num(v.x) === null || num(v.y) === null) continue;
      const dx = num(v.x) - b.x0, dy = num(v.y) - b.y0;
      b.x0 += dx; b.x1 += dx; b.y0 += dy; b.y1 += dy; b.counter = b.counter.map(([x, y]) => [x + dx, y + dy]);
    }
    const fb = BUILDINGS.find(b => b.kind === 'furn'); shiftRect(PAVED_RECTS[2], fb.x0 - furnPrev.x, fb.y0 - furnPrev.y); // ลานหน้าร้านเฟอร์นิเจอร์ตามร้าน
    const door = k => { const b = BUILDINGS.find(q => q.kind === k); return b && b.counter[0] ? [b.counter[0][0], b.counter[0][1] + 1] : null; };
    STARTER_GO.sell = door('farm') || STARTER_GO.sell; STARTER_GO.buyfeed = STARTER_GO.sellprod = door('animal') || STARTER_GO.buyfeed; // จุดนำทางมือใหม่ตามประตูร้าน
    rebuildPaved();
  }
  applyLayout(typeof globalThis !== 'undefined' ? globalThis.__LAYOUT : null);
  const NO_TREE = [FARM, ...Object.values(PENS), PLAZA, { x0: 24, y0: 1, x1: 41, y1: 7 }, FESTIVAL.plaza].map(z => ({ x0: z.x0 - 2, y0: z.y0 - 2, x1: z.x1 + 2, y1: z.y1 + 2 }));
  const PERM_TREE = new Set(BEE.trees.map(([x, y]) => x + ',' + y)); // ต้นไม้ถาวรของเล้าผึ้ง ตัดไม่ได้
  const isChoppable = (m, x, y) => !!(m[y] && m[y][x] === T.TREE && x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2 && !PERM_TREE.has(x + ',' + y));
  function treeSpotOk(m, x, y) {
    if (x < 2 || y < 2 || x > W - 3 || y > H - 3 || m[y][x] !== T.GRASS) return false;
    if (NO_TREE.some(z => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)) return false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const t = m[y + dy][x + dx]; if (t !== T.GRASS && t !== T.TREE) return false; }
    return true;
  }
  function solid(m, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
    const t = m[ty][tx];
    return t === T.WATER || t === T.TREE || t === T.BUILD || t === T.FENCE || t === T.SHOP || t === T.FURN || t === T.LANDMARK || t === T.WALL || t === T.VOID || t === T.CLIFF || t === T.ROCK || t === T.ORE;
  }
  function blockedAt(m, x, y) {
    const r = 8;
    return solid(m, Math.floor((x - r) / TS), Math.floor((y - r) / TS)) ||
           solid(m, Math.floor((x + r) / TS), Math.floor((y - r) / TS)) ||
           solid(m, Math.floor((x - r) / TS), Math.floor((y + r) / TS)) ||
           solid(m, Math.floor((x + r) / TS), Math.floor((y + r) / TS));
  }
  const DIRS = [[0, 1], [0, -1], [-1, 0], [1, 0]]; // ลง, ขึ้น, ซ้าย, ขวา
  function facing(x, y, dir) {
    return [Math.floor(x / TS) + DIRS[dir][0], Math.floor(y / TS) + DIRS[dir][1]];
  }
  function inFarm(tx, ty) { return tx >= FARM.x0 && tx <= FARM.x1 && ty >= FARM.y0 && ty <= FARM.y1; }
  // ของที่ตลาดรับซื้อทั้งหมด (ใช้เป็นรายการสินค้าที่ตั้งใบสั่งซื้อได้ด้วย) — ต้องตรงกับ SELLABLE ฝั่งเซิร์ฟเวอร์
  const SELLABLE = [...Object.keys(CROPS).map(c => 'crop_' + c), ...FISH.filter(f => f.id !== 'boot').map(f => 'fish_' + f.id), 'egg', 'duck_egg', 'milk', 'wool', 'truffle', 'honey', 'alpaca_wool', 'horse_milk', 'chestnut', ...Object.keys(WOOD_ITEMS), 'plank', ...Object.keys(ORES), ...COOK.map(c => c.id)]; // honey: เดิมตกหล่น ขายทีละชิ้นได้ราคาเต็มตลอด (แก้ 25 ต.ค. 2026)

  const api = { axeTier, rodTier, ROD_WAIT, ROD_RARE, perkLv, PERK_LV, gaugeCore, gaugeDist, gaugeHit, fishClass, WEAR_RATE, CRAFT, ARC_RANGE, STARTER, STARTER_FINAL, NEWBIE, WEEK1, CHALLENGE, EVENTS, BOOK, BOOK_ENTRY_COIN, bookInfo, WEEKLY, RARE, NPC, BOTBET, DOLE, playLevel, doleCost, dolePackage, ATM, BANK, VILLAGE, QUESTS, QUEST_NEWBIE, QUEST_PER_DAY, QUEST_ALL, ACH, TITLES, titleFor, POINTS, ARCPTS, ARC_SHOP, VEHICLES, WISH_EXTRA, BUFFS, FAME, BOARD, CHEST, TOWN, townAt, reviveCost, HOUSING, HOUSE, HOUSE_DOOR, HOUSE_BLD, HOUSE_SPAWN, HFLOOR, HKEEP, HOUSE_MAX_ITEMS, isPaved, HOUSE_FLOORS, HOUSE_WALLS, HOUSE_FLOOR_ORDER, HOUSE_WALL_ORDER, HOUSE_STYLE_DEFAULT, snapQ, furnDims, furnRect, houseSolidRects, houseBlockedAt, houseTopAt, houseCheck, houseInside, houseKeep, makeHouseMap, houseScore, plotAt, plotSignAt, FURN, TS, W, H, T, MAP_PAINT, MOCK_MAX, sanitizeMocks, sanitizeMapOv, FARM, PENS, BEE, SPAWN, START_SPAWN, STARTER_GO, DAY_MS, FARM_REGROW_MS, FARM_CAP, FARM_RENT, rentPlotAt, CLOCK_MS, TREE, WATER_MS, CANS, canTier, STALL, ORDERS, SEASONS, seasonAt, cropSeason, MASTERY, FISH_GAUGE, gaugePos, gaugeHit, MAX_LV, SKILLS, CROPS, FISH, ANIMALS, COMPANIONS, PETCARE, RODS, BUILDINGS, SHOPS, DIRS,
    DURABILITY, durMax, repairCost, REPAIR, TOOL_PRICE, toolPrice, canRepair, TRADE, TICKET, MOVIES, cinemaAt, CINEMA_CENTER, isTradable, tradeValue,
    SWING_MS, AXES, PICKS, PICK_EMOJI, pickTier, caveReach, caveOpen, MINE, ORES, ORE_ORDER, ORE_SIZES, oreXp, oreHp, floorMix, sizeMix, SIZE_MIX, rollOre, rollSize, rollDrop, caveFloor, CAVE, makeCaveMap, caveOreSpots, oreNear, TREE_HP, WOOD, woodXp, WOOD_ITEMS, TREE_KINDS, treeWhereOk, pickTreeKind, pickTreeSpawn, planTreeMix, SICK, SELLBACK, CASINO, PLAZA, FIRE, SEATS, LAYOUT_SHIFT, seatAt, sellbackValue, isChoppable, treeSpotOk, BRIDGE, LIGHTHOUSE, ISLAND, FESTIVAL, projectDone, applyProject,
    ANIMAL_XP, animalXp, ANIMAL_BONUS, ANIMAL_GRACE_MS, ROD_MAXCLASS, RARE_CD_MS, fishWeight, cropCan, PLAYER_HUNGER, WEAR, WEAR_CATS, WEAR_DEFAULT, wearKey, PANTS_COLOR, MEALS, FOOD,
    BAIT_PRICE, BAITS, baitWeight, RAKE, MARKET, PMARKET, ENERGY, energyCost, CATFAT, sellDrop, CAT_KEYS, sellCat, FRESH, perishable, freshTier, freshMuls, freshCount, COOK, COOK_FEE, COOK_CATS, cookCat, PROJECTS, PROJ_DONATE, FEST, AUCTION, sellQuote, GAME_TITLES, CABINETS, BETS, cabinetAt, XP_TABLE, xpFor, xpFromV1, levelOf, itemInfo, shopSells, shopAt, cropStage, rng, makeMap, blockedAt, facing, inFarm,
    SELLABLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Shared = api;
})(this);
