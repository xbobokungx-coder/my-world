// โค้ดที่ใช้ร่วมกันระหว่างเซิร์ฟเวอร์และเบราว์เซอร์ (แมพ, ข้อมูลพืช/ปลา/สัตว์/ร้าน, เลเวล, การชน)
(function (root) {
  const TS = 32, W = 64, H = 46;
  const T = { GRASS: 0, WATER: 1, TREE: 2, BUILD: 3, PATH: 4, FENCE: 5, SAND: 6, SHOP: 7, FLOOR: 8, FURN: 9, BRIDGE: 10, LANDMARK: 11, WALL: 12, VOID: 13 };
  // บ้าน (ระบบเดิม): ที่ดิน 6 แปลงแถวบนสุดของแมพ ตอนนี้เลิกใช้แล้ว เหลือไว้ให้ server ย้ายข้อมูลเก่าเข้าบ้านหลังใหญ่ (ดู HOUSE ด้านล่าง)
  const HOUSING = { price: 400, refund: 0.7, y0: 2, y1: 5, w: 6, plots: [2, 9, 16, 23, 30, 37] };
  const plotAt = (tx, ty) => {
    if (ty < HOUSING.y0 || ty > HOUSING.y1) return -1;
    for (let i = 0; i < HOUSING.plots.length; i++) if (tx >= HOUSING.plots[i] && tx < HOUSING.plots[i] + HOUSING.w) return i;
    return -1;
  };
  // บ้านหลังใหญ่ของทุกคน: แมพแยก (ฉาก) ใช้พิกัดช่วงเดียวกับแมพเมือง กรอบนอกรวมผนัง: ผนังบน 2 แถว ผนังซ้าย/ขวา/ล่าง 1 ช่อง ประตูอยู่ผนังล่าง
  const HOUSE_DOOR = { x: 27, y: 5 };                          // ประตูบ้านหลังใหญ่ในเมือง: เดินเข้ามายืนที่ช่องนี้ = เลือกเข้าบ้านตัวเอง/บ้านเพื่อน
  const HOUSE_BLD = { x0: 24, y0: 1, x1: 30, y1: 4 };        // ตัวบ้านในเมือง (ช่องตัน) อยู่เหนือประตู
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
  };
  const FARM = { x0: 6, y0: 8, x1: 21, y1: 17 };       // แปลงผัก (ช่องที่ขุดได้)
  // เล้า 6 เล้า ขนาดเท่ากัน (ภายใน 3×4 ช่อง) เรียง 2 แถวๆละ 3 เล้า มีรั้วล้อมรอบ 1 ช่อง • gate = ช่องประตู (ด้านซ้ายของเล้า) • sign = ป้ายประจำเล้า (ชื่อสัตว์อยู่บนป้าย)
  const PENS = {
    chicken: { x0: 47, y0: 10, x1: 49, y1: 13, gate: [[46, 11], [46, 12]], sign: [48, 8] },
    duck:    { x0: 53, y0: 10, x1: 55, y1: 13, gate: [[52, 11], [52, 12]], sign: [54, 8] },
    pig:     { x0: 59, y0: 10, x1: 61, y1: 13, gate: [[58, 11], [58, 12]], sign: [60, 8] },
    cow:     { x0: 47, y0: 18, x1: 49, y1: 21, gate: [[46, 19], [46, 20]], sign: [48, 16] },
    sheep:   { x0: 53, y0: 18, x1: 55, y1: 21, gate: [[52, 19], [52, 20]], sign: [54, 16] },
    bee:     { x0: 59, y0: 18, x1: 61, y1: 21, gate: [[58, 19], [58, 20]], sign: [60, 16] },
  };
  // เล้าผึ้ง: ต้นไม้ถาวร 1 ต้น (ตัดไม่ได้) และรังผึ้ง (ลัง) 2 ลังวางในเล้า • ผึ้งบินวนรอบรัง
  const BEE = { trees: [[61, 18]], hives: [[59, 20], [61, 21]] };
  const SPAWN = { x: 31 * TS + 16, y: 22 * TS + 16 };
  const START_SPAWN = { x: 14 * TS, y: 19 * TS + 16 }; // ผู้เล่นที่เข้าเกมครั้งแรกเกิดตรงประตูแปลงผัก (ใกล้ข้อแรกของคู่มือ) คนเก่าอยู่ตรงที่ออกไว้
  const DAY_MS = 12 * 60 * 1000;                       // หน่วย "วัน" ของเศรษฐกิจ (ดอกเบี้ย ผักสุกค้าง สัตว์ป่วย ตลาด) = 12 นาที
  const FARM_REGROW_MS = DAY_MS;                       // แปลงที่ถางแล้วแต่ไม่มีใครปลูกหรือถางต่อเกินเวลานี้ (นับเฉพาะตอนมีคนออนไลน์) หญ้าขึ้นกลับเป็นเหมือนเดิม ต้องถางใหม่
  const CLOCK_MS = 24 * 60 * 1000;                     // 1 รอบกลางวัน-กลางคืนบนนาฬิกาเกม = 24 นาทีจริง (แยกจาก DAY_MS เพื่อไม่ให้เศรษฐกิจช้าลง)
  const TREE = { cap: 110, growMs: 20000 };            // เพดานต้นไม้ในแมพ (ตัดทั้งแมพก็ไม่ใช่ทางรวยสุด) + งอกใหม่ทุก growMs
  const WATER_MS = 90000;                              // ดินเปียกนานเท่าไร
  const MAX_LV = 10;

  // อาชีพ 4 สาย (ช่างไม้เพิ่งเริ่ม: ตัดไม้ขาย ยังไม่มีงานฝีมือ)
  const SKILLS = {
    farm:   { name: 'ชาวนา',     emoji: '🌾' },
    fish:   { name: 'ชาวประมง',  emoji: '🎣' },
    animal: { name: 'คนเลี้ยงสัตว์', emoji: '🐄' },
    wood:   { name: 'ช่างไม้',    emoji: '🪵' },
    cook:   { name: 'เชฟ',       emoji: '👨‍🍳' },
  };
  const xpFor = lv => 30 * (lv - 1) * (lv - 1);        // XP สะสมที่ต้องใช้ถึงเลเวลนั้น
  const levelOf = xp => Math.min(MAX_LV, Math.floor(Math.sqrt((xp || 0) / 30)) + 1);

  // เมล็ดพืช: lv = เลเวลชาวนาที่ปลดล็อก, time = เวลาโต (ms) เมื่อรดน้ำต่อเนื่อง, xp = XP ตอนเก็บเกี่ยว
  // หลักการตั้งราคา: ใช้เวลาโตนานราคาสูง • กำไรต่อวินาทีต่อแปลง ≈ 0.20-0.25 (ต่ำกว่าสายอื่น เพราะปลูกได้ทีละหลายสิบแปลง)
  const CROPS = {
    carrot:     { name: 'แครอท',      emoji: '🥕', seed: 10, sell: 20,  time: 60000,  lv: 1, xp: 5 },
    cabbage:    { name: 'กะหล่ำปลี',   emoji: '🥬', seed: 15, sell: 28,  time: 80000,  lv: 1, xp: 7 },
    corn:       { name: 'ข้าวโพด',     emoji: '🌽', seed: 20, sell: 39,  time: 100000, lv: 2, xp: 9 },
    tomato:     { name: 'มะเขือเทศ',   emoji: '🍅', seed: 25, sell: 50,  time: 120000, lv: 3, xp: 12 },
    eggplant:   { name: 'มะเขือม่วง',  emoji: '🍆', seed: 35, sell: 67,  time: 140000, lv: 4, xp: 16 },
    strawberry: { name: 'สตรอว์เบอร์รี', emoji: '🍓', seed: 45, sell: 84,  time: 160000, lv: 5, xp: 20 },
    pumpkin:    { name: 'ฟักทอง',      emoji: '🎃', seed: 60, sell: 102, time: 200000, lv: 6, xp: 26 },
    potato:     { name: 'มันฝรั่ง',     emoji: '🥔', seed: 18,  sell: 35,  time: 90000,  lv: 2, xp: 10 },
    chili:      { name: 'พริก',        emoji: '🌶️', seed: 28,  sell: 55,  time: 130000, lv: 3, xp: 14 },
    broccoli:   { name: 'บรอกโคลี',     emoji: '🥦', seed: 38,  sell: 72,  time: 150000, lv: 4, xp: 18 },
    cherry:     { name: 'เชอร์รี',      emoji: '🍒', seed: 55,  sell: 99, time: 180000, lv: 5, xp: 22 },
    grape:      { name: 'องุ่น',        emoji: '🍇', seed: 70,  sell: 116, time: 230000, lv: 6, xp: 28 },
    pineapple:  { name: 'สับปะรด',      emoji: '🍍', seed: 85,  sell: 143, time: 270000, lv: 7, xp: 34 },
    mango:      { name: 'มะม่วง',       emoji: '🥭', seed: 110, sell: 188, time: 320000, lv: 9, xp: 42 },
    melon:      { name: 'แตงโม',       emoji: '🍉', seed: 90, sell: 150, time: 260000, lv: 8, xp: 38 },
  };
  // ปลา: lv = เลเวลชาวประมงที่เริ่มตกได้, w = น้ำหนักความน่าจะเป็น (หายาก = ราคาแพง: ราคาแปรผันตามความหายาก)
  const FISH = [
    { id: 'boot',    name: 'รองเท้าเก่า',  emoji: '👢', sell: 1,   xp: 1,  w: 8,  lv: 1 },
    { id: 'carp',    name: 'ปลาตะเพียน',  emoji: '🐟', sell: 12,  xp: 6,  w: 40, lv: 1 },
    { id: 'catfish', name: 'ปลาดุก',      emoji: '🐡', sell: 16,  xp: 8,  w: 25, lv: 1 },
    { id: 'bass',    name: 'ปลากะพง',     emoji: '🐠', sell: 20,  xp: 12, w: 20, lv: 2 },
    { id: 'shrimp',  name: 'กุ้ง',        emoji: '🦐', sell: 26,  xp: 15, w: 15, lv: 3 },
    { id: 'crab',    name: 'ปู',          emoji: '🦀', sell: 32,  xp: 20, w: 12, lv: 4 },
    { id: 'koi',     name: 'ปลาคอยทอง',   emoji: '🎏', sell: 50,  xp: 35, w: 6,  lv: 5 },
    { id: 'lobster', name: 'กุ้งมังกร',    emoji: '🦞', sell: 55,  xp: 40, w: 5,  lv: 6 },
    { id: 'squid',   name: 'หมึก',        emoji: '🦑', sell: 65,  xp: 50, w: 4,  lv: 7 },
    { id: 'shell',   name: 'หอยเชลล์',     emoji: '🐚', sell: 18,  xp: 9,   w: 22, lv: 2 },
    { id: 'frog',    name: 'กบน้อย',      emoji: '🐸', sell: 24,  xp: 12,  w: 18, lv: 3 },
    { id: 'oyster',  name: 'หอยนางรม',    emoji: '🦪', sell: 36,  xp: 22,  w: 12, lv: 4 },
    { id: 'turtle',  name: 'เต่าน้อย',     emoji: '🐢', sell: 44,  xp: 30,  w: 6,  lv: 5 },
    { id: 'shark',   name: 'ฉลามน้อย',    emoji: '🦈', sell: 90, xp: 85,  w: 1.3, lv: 9 },
    { id: 'whale',   name: 'วาฬน้อย',     emoji: '🐳', sell: 120, xp: 120, w: 0.7, lv: 10 },
    { id: 'octopus', name: 'ปลาหมึกยักษ์', emoji: '🐙', sell: 75, xp: 70, w: 3,  lv: 8 },
    { id: 'otter',   name: 'นากน้ำ',       emoji: '🦦', sell: 55,  xp: 45, w: 4,  lv: 6 },
    { id: 'croc',    name: 'จระเข้น้อย',    emoji: '🐊', sell: 85, xp: 80, w: 1.6, lv: 8 },
    { id: 'seal',    name: 'แมวน้ำ',       emoji: '🦭', sell: 105, xp: 100, w: 0.9, lv: 9 },
    { id: 'dolphin', name: 'โลมา',         emoji: '🐬', sell: 140, xp: 140, w: 0.5, lv: 10 },
    { id: 'humpback', name: 'วาฬหลังค่อม', emoji: '🐋', sell: 190, xp: 200, w: 0.25, lv: 10 },
  ];
  // ช่างไม้: ตัดต้นไม้ด้วยขวาน (ขวานแรงกว่าตัดเร็วกว่า) ได้ไม้ท่อน หายากได้ไม้เนื้อแข็งราคาแพง
  const AXES = { 1: { name: 'ขวานหิน', price: 50, power: 1 }, 2: { name: 'ขวานเหล็ก', price: 220, lv: 3, power: 2 }, 3: { name: 'ขวานเหล็กกล้า', price: 700, lv: 6, power: 3 } };
  const TREE_HP = 4;                       // ต้องฟันกี่แต้มถึงล้ม (ขวานหิน = 4 ครั้ง, เหล็ก 2, เหล็กกล้า 2)
  const WOOD = { log: { sell: 16, xp: 5 }, hardwood: { sell: 66, xp: 14, chance: 0.16 } };
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
    rod:   { max: [0, 100, 140, 200], fix: [0, 30, 72, 168], shop: 'fish',   name: 'เบ็ดตกปลา' },
    axe:   { max: [0, 90, 140, 220],  fix: [0, 36, 96, 216], shop: 'wood',   name: 'ขวาน' },
  };
  // อัตราสึกหรอ: เกจเท่าเดิม แต่ใช้ 1 ครั้งสึก base หน่วย (เดิม 1) และ "ความร้อน" สะสมเมื่อใช้ถี่ๆ ต่อเนื่อง: ทุกครั้งที่ใช้ +1, เย็นลง cool ต่อวินาที
  // ตัวคูณการสึก = 1 + min(maxBonus, ความร้อน × perHeat) → ใช้ถี่และนานได้สูงสุด 2 เท่า (พักสักครู่ก็เย็นลง) เตือนเมื่อความร้อนถึง warnHeat
  const WEAR_RATE = { base: 1.35, cool: 0.2, perHeat: 0.01, maxBonus: 1, warnHeat: 35 };
  // ซ่อมได้จำกัด: ซ่อมแต่ละครั้งความทนทานสูงสุดลดลง decay ของค่าเดิม ค่าซ่อมแพงขึ้น growth ต่อครั้ง ซ่อมครบ maxFixes ครั้งแล้วซ่อมไม่ได้อีก ต้องซื้อใหม่ (ราคา TOOL_PRICE)
  // สมดุล: ค่าซ่อมเต็ม = pct × ราคาซื้อ × (1 + growth × ครั้งที่ซ่อมมาแล้ว) แต่ได้ความทนทานน้อยลงเรื่อยๆ → ซ่อมครั้งที่ ~4 ขึ้นไปต่อหน่วยการใช้งานแพงกว่าซื้อใหม่
  const REPAIR = { decay: 0.15, maxFixes: 3, growth: 0.5, pct: 0.25 };
  const TOOL_PRICE = { hoe: [0, 80, 80, 80], rod: [0, 100, 250, 900], axe: [0, 50, 220, 700] };
  const tierN = t => Math.max(1, Math.min(3, t || 1));
  const durMax = (tool, tier, fixes) => Math.max(1, Math.floor(DURABILITY[tool].max[tierN(tier)] * (1 - REPAIR.decay * Math.min(REPAIR.maxFixes, fixes || 0))));
  const toolPrice = (tool, tier) => TOOL_PRICE[tool][tierN(tier)];
  // ค่าซ่อมครั้งถัดไป (ซ่อมแล้วเต็มที่ความทนทานสูงสุดใหม่ที่ต่ำลง) เทียบกับความเสียหายของค่าสูงสุดปัจจุบัน
  const repairCost = (tool, tier, cur, fixes) => { const n = fixes || 0, mx = durMax(tool, tier, n); return Math.max(1, Math.ceil(toolPrice(tool, tier) * REPAIR.pct * (1 + REPAIR.growth * n) * Math.max(0, mx - cur) / mx)); };
  const canRepair = (tool, tier, cur, fixes) => (fixes || 0) < REPAIR.maxFixes && cur < durMax(tool, tier, (fixes || 0) + 1);
  // เทรดของระหว่างผู้เล่น: เทรดเหรียญไม่ได้ เทรดได้เฉพาะของที่ไม่ผูกกับตัว มูลค่ารวมฝั่งละไม่เกิน maxValue ต่อรอบ
  const TRADE = { maxValue: 1000, range: 8 };
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
  const CATFAT = { min: 0.3, recover: 0.04, spread: 0.01, spreadMax: 0.25 };
  const CAT_KEYS = ['fish', 'crop', 'animal', 'wood', 'dish', 'other'];
  const sellCat = k => /^fish_/.test(k) ? 'fish' : /^crop_/.test(k) ? 'crop' : /^dish_/.test(k) ? 'dish' : ['egg', 'duck_egg', 'milk', 'wool', 'truffle', 'honey'].includes(k) ? 'animal' : ['log', 'hardwood', 'plank'].includes(k) ? 'wood' : 'other';
  // ขายเป็นชุดใหญ่ (ถือของได้ไม่จำกัดจำนวน): คิดราคาทีละชิ้นตามชนิด ราคาต่อชิ้นลดลงเชิงเส้นชิ้นละ 1% ของราคาฐาน (MARKET.drop) จนถึงพื้น 20% แล้วคงที่
  // ตัวอย่างขาย 100 ชิ้นเมื่อราคาตั้งต้น 100%: ชิ้นที่ 1 = 100%, 2 = 99% … 80 = 21%, ชิ้นที่ 81-100 = 20% รวม 5,240 จากราคาฐาน 100/ชิ้น (กด "ขายทั้งหมด" คำนวณทั้งชุดให้เลย)
  // ตลาดจำการขายด้วยการลดเท่ากันทุกชิ้น (server แบ่งเข้าตลาดชนิด/ส่วนตัว/หมวด) ขายรวดหรือทยอยขายติดกันทีละชิ้นจึงได้เงินเท่ากัน ต่างกันเฉพาะ "รอให้ตลาดฟื้น" ที่ได้ราคาดีขึ้น
  function sellQuote(base, m, q) { // ราคารวมเมื่อขาย q ชิ้นต่อเนื่อง และตัวคูณใหม่ • ราคาต่อชิ้นไม่ต่ำกว่า MARKET.min ของราคาฐาน
    let total = 0;
    for (let i = 0; i < q; i++) { total += Math.max(1, Math.round(base * Math.max(MARKET.min, m))); m = Math.max(MARKET.min, m - MARKET.drop); }
    return { total, m };
  }
  // สัตว์ที่เลี้ยงได้ (ใช้ร่วมกันทั้งโลก): cap = จำนวนสูงสุด, feedItem = อาหารที่กิน
  const ANIMALS = {
    // starveMin = กี่นาที (ที่มีผู้เล่นออนไลน์) ที่สัตว์หิวจากอิ่มเต็มจนหมด, หลังหมดแล้วเหลือเวลาอีก graceMs ก่อนจะตาย
    // cap = จำนวนสูงสุดต่อเล้า (ทุกชนิด 6 ตัว) • แต่ละชนิดอยู่คนละเล้า (PENS)
    chicken: { name: 'ไก่', emoji: '🐔', product: 'egg',  feedItem: 'feed', price: 120, lv: 1, cap: 6, init: 4, time: [25000, 45000], xp: 4, starveMin: 25 },
    cow:     { name: 'วัว', emoji: '🐄', product: 'milk', feedItem: 'hay',  price: 600, lv: 3, cap: 6, init: 1, time: [45000, 75000], xp: 8, starveMin: 35 },
    duck:    { name: 'เป็ด', emoji: '🦆', product: 'duck_egg', feedItem: 'feed', price: 220, lv: 2, cap: 6, init: 0, time: [30000, 50000], xp: 5, starveMin: 25 },
    sheep:   { name: 'แกะ', emoji: '🐑', product: 'wool',     feedItem: 'hay',  price: 850, lv: 4, cap: 6, init: 0, time: [50000, 80000], xp: 10, starveMin: 35 },
    pig:     { name: 'หมู', emoji: '🐖', product: 'truffle', feedItem: 'slop', price: 1100, lv: 5, cap: 6, init: 0, time: [60000, 90000], xp: 12, starveMin: 35 },
    bee:     { name: 'ผึ้ง', emoji: '🐝', product: 'honey', feedItem: 'nectar', price: 360, lv: 2, cap: 6, init: 0, time: [40000, 60000], xp: 6, starveMin: 30 },
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
    cMin: 0.2, cMax: 0.8, perVar: [0.75, 1.2], halfVar: [0.85, 1.1], perfect: 0.4, edgeMul: [1, 0.75, 0.45, 0.3] };
  const gaugePos = (f, t) => { const ph = ((t - f.gt0) / f.per) % 2; return ph < 1 ? ph : 2 - ph; };
  // lag: ชดเชยเวลาส่งข้อมูล (เช็คทั้งตอนกดจริงและย้อนหลังเล็กน้อย) ให้คนเน็ตช้าไม่เสียเปรียบ
  const gaugeDist = (f, t) => { const c = f.c === undefined ? 0.5 : f.c; return Math.min(Math.abs(gaugePos(f, t) - c), Math.abs(gaugePos(f, t - FISH_GAUGE.lag) - c)); };
  const gaugeHit = (f, t) => gaugeDist(f, t) <= f.half;
  // "เป๊ะ" = ตำแหน่งตัวชี้ (ชดเชยหน่วง lag แบบเดียวกันทุกครั้ง ไม่ขยายโซนข้างเดียว) อยู่ในแกนกลางโซน
  const gaugeCore = (f, t) => Math.abs(gaugePos(f, t - FISH_GAUGE.lag / 2) - (f.c === undefined ? 0.5 : f.c)) <= f.half * FISH_GAUGE.perfect; // ชดเชยหน่วงครึ่งเดียว: คนเน็ตเร็ว/ช้าผิดพลาดไม่เกินครึ่งหนึ่งของแกนกลาง
  const RODS = { 1: { name: 'คันเบ็ดไม้ไผ่' }, 2: { name: 'คันเบ็ดไฟเบอร์', price: 250, lv: 3 }, 3: { name: 'คันเบ็ดคาร์บอน', price: 900, lv: 6 } };

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
  const COOK_FEE = 0.2; // ค่าเช่าเตา = สัดส่วนของราคาขายอาหาร จ่ายเป็นเหรียญทุกครั้งที่ทำ
  const COOK_CATS = { fish: { name: 'ปลา/สัตว์น้ำ', emoji: '🐟' }, crop: { name: 'ผัก/ผลไม้', emoji: '🥕' }, egg: { name: 'ไข่', emoji: '🥚' } };
  // เชฟ (อาชีพที่ 5): แต่ละสูตรปลดล็อกตามเลเวลเชฟ (lv) ได้ XP เชฟ (xp) และใช้เวลาทำ (time มิลลิวินาที = เตาต้องพักก่อนทำจานถัดไป)
  const COOK = [
    { id: 'dish_grill',   name: 'ปลาย่างผักสด',     emoji: '🍱', sell: 60,  food: 45,  lv: 1, xp: 12, time: 3000,  in: [{ c: 'fish', n: 1 }, { c: 'crop', n: 1 }] },
    { id: 'dish_omelet',  name: 'ไข่เจียวผักรวม',    emoji: '🍳', sell: 80,  food: 55,  lv: 3, xp: 20, time: 4000,  in: [{ c: 'egg', n: 2 }, { c: 'crop', n: 1 }] },
    { id: 'dish_seafood', name: 'ซีฟู้ดไข่นุ่ม',     emoji: '🍤', sell: 135, food: 70,  lv: 5, xp: 34, time: 6000,  in: [{ c: 'fish', n: 2 }, { c: 'egg', n: 1 }, { c: 'crop', n: 1 }] },
    { id: 'dish_feast',   name: 'ชุดเลี้ยงฉลอง',     emoji: '🍽️', sell: 330, food: 100, lv: 7, xp: 70, time: 9000,  in: [{ c: 'fish', n: 2 }, { c: 'crop', n: 2 }, { c: 'egg', n: 2 }, { k: 'milk', n: 1 }] },
    // เมนูปลา: ปลาทุกชนิดในกระเป๋า (ยกเว้นรองเท้าเก่า) ใช้ทำได้
    { id: 'dish_fishsoup', name: 'ต้มยำปลา',         emoji: '🍲', sell: 75,  food: 50,  lv: 2, xp: 16, time: 3500,  in: [{ c: 'fish', n: 1 }, { c: 'crop', n: 1 }] },
    { id: 'dish_sashimi',  name: 'ซาชิมิปลา',         emoji: '🍣', sell: 120, food: 55,  lv: 4, xp: 26, time: 4000,  in: [{ c: 'fish', n: 2 }] },
    { id: 'dish_fishburger', name: 'เบอร์เกอร์ปลา',   emoji: '🍔', sell: 170, food: 80,  lv: 6, xp: 38, time: 5000,  in: [{ c: 'fish', n: 1 }, { k: 'meal_bread', n: 1 }, { c: 'crop', n: 1 }] },
    { id: 'dish_fishpie',  name: 'พายปลาไข่',         emoji: '🥧', sell: 250, food: 90,  lv: 8, xp: 50, time: 7000,  in: [{ c: 'fish', n: 2 }, { c: 'egg', n: 1 }, { c: 'crop', n: 1 }] },
    // เมนูปลารวม: u = ปลาต้องเป็นคนละชนิดกัน (ชนิดละ 1 ตัว) ปลาชนิดเดียวกันหลายตัวใช้ทำไม่ได้
    { id: 'dish_fishmix',  name: 'ปลารวมทอดกรอบ',    emoji: '🥘', sell: 110, food: 65,  lv: 3, xp: 22, time: 4000,  in: [{ c: 'fish', n: 2, u: true }, { c: 'crop', n: 1 }] },
    { id: 'dish_fishstew', name: 'แกงปลารวมหม้อใหญ่', emoji: '🫕', sell: 220, food: 85,  lv: 6, xp: 44, time: 7000,  in: [{ c: 'fish', n: 3, u: true }, { c: 'crop', n: 1 }] },
    { id: 'dish_platter',  name: 'จานปลาทะเลรวม',    emoji: '🥡', sell: 380, food: 105, lv: 8, xp: 80, time: 10000, in: [{ c: 'fish', n: 4, u: true }, { c: 'egg', n: 1 }] },
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
  const FOOD = {
    meal_bread: 15, meal_sandwich: 25, meal_soup: 32, meal_rice: 40, // อาหารร้าน ฟื้นความอิ่มน้อยกว่าเมนูที่ทำเองทุกสูตร (ต่ำสุดของเมนูทำเองคือ 45)
    crop_carrot: 6, crop_cabbage: 8, crop_corn: 12, crop_tomato: 8, crop_eggplant: 10, crop_strawberry: 10, crop_pumpkin: 15, crop_melon: 15,
    crop_potato: 12, crop_chili: 6, crop_broccoli: 10, crop_cherry: 10, crop_grape: 12, crop_pineapple: 15, crop_mango: 18,
    egg: 8, milk: 15, truffle: 5, duck_egg: 8,
    dish_grill: 45, dish_omelet: 55, dish_seafood: 70, dish_feast: 100,
    dish_fishsoup: 50, dish_sashimi: 55, dish_fishburger: 80, dish_fishpie: 90,
    dish_fishmix: 65, dish_fishstew: 85, dish_platter: 105,
  };

  // อาคาร: เคาน์เตอร์ร้าน (counter) อยู่ใกล้กับสิ่งที่ผู้เล่นทำในสายนั้น
  const BUILDINGS = [
    { kind: 'farm',   x0: 25, y0: 10,  x1: 27, y1: 11, counter: [[26, 12], [27, 12]], name: 'ร้านเมล็ดพันธุ์', sign: '🌱', roof: '#3a8f3a', wall: '#f0dcae' },
    { kind: 'fish',   x0: 36, y0: 26, x1: 38, y1: 27, counter: [[37, 28], [38, 28]], name: 'ร้านตกปลา',      sign: '🎣', roof: '#2e7bb5', wall: '#e6d9b5' },
    { kind: 'animal', x0: 40, y0: 14, x1: 42, y1: 15, counter: [[41, 16], [42, 16]], name: 'ร้านปศุสัตว์',    sign: '🐄', roof: '#a8552f', wall: '#f0dcae' },
    { kind: 'pet',   x0: 36, y0: 10, x1: 38, y1: 11, counter: [[37, 12], [38, 12]], name: 'ร้านสัตว์เลี้ยง',  sign: '🐾', roof: '#e0748a', wall: '#fdeef0' },
    { kind: 'cloth',  x0: 12, y0: 26, x1: 14, y1: 27, counter: [[13, 28], [14, 28]], name: 'ร้านเสื้อผ้า',    sign: '👕', roof: '#d6559a', wall: '#f7e1ee' },
    { kind: 'food',   x0: 20, y0: 26, x1: 22, y1: 27, counter: [[21, 28], [22, 28]], name: 'ร้านอาหาร',      sign: '🍜', roof: '#e08a1e', wall: '#fdeccb' },
    { kind: 'wood',   x0: 6,  y0: 26, x1: 8,  y1: 27, counter: [[7, 28], [8, 28]],   name: 'ร้านช่างไม้',     sign: '🪓', roof: '#8a5a2b', wall: '#f3e2c3' },
    { kind: 'vehicle', x0: 40, y0: 26, x1: 42, y1: 27, counter: [[41, 28], [42, 28]], name: 'ร้านยานพาหนะ',   sign: '🚲', roof: '#3b6ea5', wall: '#e4ecf5' },
    { kind: 'furn',   x0: 33, y0: 2,  x1: 35, y1: 3,  counter: [[34, 4], [35, 4]], name: 'ร้านเฟอร์นิเจอร์', sign: '🛋️', roof: '#7b4fa3', wall: '#efe4f7' },
    // จอหนังกลางแปลง (ผ้าขาวขึงกับเสา) มีที่นั่งกองฟางเรียงอยู่ด้านล่าง
    { kind: 'cinema', x0: 15, y0: 33, x1: 18, y1: 34, counter: [],                  name: 'หนังกลางแปลง',   sign: '🎬', roof: '#2b2f55', wall: '#f4f4f4' },
    // ป้ายลานตู้เกม (ไม่ใช่อาคาร): ตู้เกมวางเรียงเป็นรูปตัว U อยู่ด้านล่างป้าย
    { kind: 'sign',   x0: 32, y0: 13, x1: 35, y1: 13, counter: [],                  name: 'Arcade Hub',     sign: '🎮', roof: '#6a3fb5', wall: '#8b5a2b' },
  ];
  // ตู้เกม 2 แถว แถวละ 4 ตู้ วางสลับฟันปลาเว้นห่างตู้ละ 1 ช่อง (ไม่ชิดกัน) เดินในแถวกลาง (y=16) ใช้ได้ทั้งสองแถว
  // game = null คือยังไม่เปิด เพิ่มเกมใหม่โดยใส่ game และเขียนกติกาฝั่งเซิร์ฟเวอร์
  const CABINETS = [
    { x: 30, y: 15, game: 'rps',   name: 'เป่ายิ้งฉุบ',      label: 'RPS', emoji: '✊' },
    { x: 32, y: 15, game: 'xo',    name: 'XO',             label: 'XO',  emoji: '❌⭕' },
    { x: 34, y: 15, game: 'uno',   name: 'UNO',            label: 'UNO', emoji: '🃏' },
    { x: 36, y: 15, game: 'react', name: 'ใครกดเร็วกว่า',    label: 'GO!', emoji: '⚡' },
    { x: 31, y: 17, game: 'pok',   name: 'ไพ่ป๊อก',         label: 'POK', emoji: '🎴' },
    { x: 33, y: 17, game: 'c4',    name: 'Connect 4',      label: 'C4',  emoji: '🔴' },
    { x: 35, y: 17, game: 'bacc',  name: 'บาคาร่า',         label: 'BAC', emoji: '🎴' },
    { x: 37, y: 17, game: 'bj',    name: 'แบล็คแจ็ค',       label: '21',  emoji: '🂡' },
  ];
  const GAME_TITLES = { xo: '❌⭕ XO', uno: '🃏 UNO', rps: '✊ เป่ายิ้งฉุบ', react: '⚡ ใครกดเร็วกว่า', pok: '🎴 ไพ่ป๊อก', c4: '🔴 Connect 4', bacc: '🎴 บาคาร่า', bj: '🂡 แบล็คแจ็ค' };
  // ลานพักผ่อนกลางหมู่บ้าน: กองไฟตรงกลาง รอบๆ มีม้านั่ง กองฟาง และเก้าอี้ให้นั่งเล่น (กดที่ที่นั่งเพื่อนั่ง) กลางคืนสว่างเฉพาะรอบกองไฟ
  const PLAZA = { x0: 24, y0: 24, x1: 33, y1: 31 };
  const FIRE = { x: 29, y: 28 };
  const SEATS = [
    { x: 28, y: 26, kind: 'bench', face: 0 }, { x: 30, y: 26, kind: 'bench', face: 0 },
    { x: 28, y: 30, kind: 'bench', face: 1 }, { x: 30, y: 30, kind: 'bench', face: 1 },
    { x: 26, y: 27, kind: 'hay',   face: 3 }, { x: 26, y: 29, kind: 'hay',   face: 3 },
    { x: 32, y: 27, kind: 'chair', face: 2 }, { x: 32, y: 29, kind: 'chair', face: 2 },
  ];
  // ที่นั่งหน้าจอหนัง (กองฟาง หันหน้าขึ้นไปทางจอ)
  for (const x of [15, 16, 17, 18]) SEATS.push({ x, y: 36, kind: 'chair', face: 1 }); // เก้าอี้ 4 ตัวแถวเดียวติดกัน ตรงใต้จอ
  // กระดานข่าว (log ของโลก) และตู้เซฟกองกลาง อยู่ขอบเหนือของลานกองไฟ (ช่องเดินผ่านไม่ได้ กดจากช่องติดกัน)
  const BOARD = { x: 26, y: 24 }, ATM = { x: 29, y: 24 }, CHEST = { x: 32, y: 24 };
  const TOWN = { logMax: 15, donate: [10, 50, 100], autoAfterMs: 60000, revive: 0.5, respawnMs: 5 * 60 * 1000, feeShare: 0.5 }; // autoAfterMs = สัตว์ป่วย/หิวจัดนานเท่าไรก่อนเงินกองกลางจ่ายให้เอง, revive = ค่าชุบชีวิตเป็นสัดส่วนของราคาซื้อ, respawnMs = สัตว์ชนิดที่เหลือน้อยกว่าจำนวนเริ่มต้น (ANIMALS.init) เกิดใหม่ฟรีทีละตัวทุกเท่านี้ (นับเฉพาะตอนมีคนออนไลน์) กันฝูงหมด, feeShare = สัดส่วนค่าเตาครัว/ค่าบริการตู้เกมที่เข้าเงินกองกลาง (ที่เหลือหายจากระบบ)
  const townAt = (tx, ty) => (tx === BOARD.x && ty === BOARD.y ? 'board' : tx === CHEST.x && ty === CHEST.y ? 'chest' : tx === ATM.x && ty === ATM.y ? 'atm' : null);
  const reviveCost = type => Math.round(ANIMALS[type].price * TOWN.revive);
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
  const ARCPTS = { play: 2, win: 5 }; // แต้มตู้เกม: เล่นจบได้ +play, ชนะคนจริงได้ +win เพิ่ม (ไม่ได้จากบอท/คาสิโน) — ใช้แลกของโชว์ในร้านรางวัล + จัดอันดับ Leaderboard
  const BUFFS = {
    speed:  { name: 'เท้าเบา',  emoji: '🏃', desc: 'เดินเร็วขึ้น 10%',             cost: 10, ms: 15 * 60000 },
    hunger: { name: 'อิ่มทน',   emoji: '🍖', desc: 'ความหิวลดช้าลงครึ่งหนึ่ง',      cost: 8,  ms: 15 * 60000 },
  };
  const FAME = { harvest: ['🌾', 'นักเก็บเกี่ยว'], water: ['💧', 'ผู้ขยันรดน้ำ'], feed: ['🥣', 'พ่อบ้านใส่ใจสัตว์'], fish: ['🎣', 'เซียนตกปลา'], chop: ['🪓', 'นักโค่นไม้'], collect: ['🥚', 'ผู้เก็บผลผลิต'], craft: ['🔨', 'ช่างฝีมือ'] };
  // ตู้ ATM: ที่เก็บเหรียญอย่างเดียว (ไม่มีดอกเบี้ย: คนมีเงินต้องไม่ได้เงินเพิ่มจากการฝากเฉยๆ เราอยากให้ออกมาเล่น) มีเพดานเงินฝาก
  const BANK = { cap: 100000, amts: [100, 1000, 10000] };
  // Happy Village: ทั้งเมืองช่วยกันทำงานสะสมครบเป้าของวัน (เป้า = base + per × จำนวนคนออนไลน์สูงสุดของวัน) → ทุกคนได้บัฟร่วม ms มิลลิวินาที
  const VILLAGE = { maxShare: 0.5, base: 30, per: 20, ms: 20 * 60000, fishMul: 0.75, hardBonus: 0.1 };
  // เดิมพันกับบอท: เงินเดิมพันฝั่งบอทมาจากบ้าน (สร้างเหรียญใหม่) จึงจำกัดวงเงินต่อครั้ง และกำไรสุทธิจากบอทต่อวันไม่เกิน dailyWinCap (ขาดทุนไม่จำกัด)
  const BOTBET = { bets: [0], dailyWinCap: 0 }; // ปิดการจ่ายเหรียญจากบอท (ซ้อมฟรีเท่านั้น) จนกว่าจะมีแต้มตู้เกม เดิมคือ bets [0,10,50,100,200,300] และ dailyWinCap 500
  // ของแจกจากกองกลาง: รับได้วันละ 1 ครั้ง ต้อง "เล่นจริง" = ระดับการเล่น (ผลรวมเลเวลทุกอาชีพ) ถึงเกณฑ์ และทำเควสประจำวันสำเร็จอย่างน้อย needQuests ข้อวันนี้
  // ยิ่งเงินกองกลางเยอะยิ่งปลดล็อกชุดแจกที่ใหญ่ขึ้น (ต้องผ่านทั้ง chest และ lv) ต้นทุนทั้งหมดจ่ายจากเงินกองกลาง และต้องเหลือสำรอง reserve ไว้ดูแลสัตว์
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
  const playLevel = skills => Object.keys(SKILLS).reduce((n, k) => n + levelOf(skills && skills[k]), 0);
  const doleCost = t => t.coin + t.meals.reduce((n, id) => n + MEALS.find(m => m.id === id).price, 0);
  const dolePackage = (chestCoin, level) => { for (let i = DOLE.tiers.length - 1; i >= 0; i--) { const t = DOLE.tiers[i]; if (chestCoin >= t.chest && level >= t.lv) return t; } return null; };
  const NPC = { sayMin: 45000, sayMax: 110000, gap: 12000, speed: 50 }; // ชาวเมือง NPC: พิมพ์ข้อความทุก sayMin-sayMax ms, เดินด้วยความเร็ว speed px/วินาที
  // คู่มือเริ่มต้น: ทำครบทุกข้อ (ลำดับไหนก็ได้) ได้ของรางวัลเล็กทีละข้อ + รางวัลใหญ่ตอนจบ ปุ่มช่วยบนจอบอก "ข้อถัดไป" ให้เสมอ
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
    { id: 'buyfeed', ev: 'buyfeed',   hint: 'ซื้ออาหารไก่ที่ร้านปศุสัตว์ 🌾', text: 'ซื้ออาหารสัตว์ที่ร้านปศุสัตว์', coin: 15,
      how: ['เดินไปร้านปศุสัตว์ 🐄 (หลังคาส้ม ลูกศรชี้ทาง)', 'คลิก/แตะที่เคาน์เตอร์ร้าน', 'แท็บ "อาหาร / ยา" กดซื้อ 🌾 อาหารสัตว์ (อาหารไก่ราคา 5)'] },
    { id: 'feed',    ev: 'feed',      hint: 'ให้อาหารไก่ในคอก 🐔',       text: 'ให้อาหารสัตว์ที่คอก', coin: 20,
      how: ['กดช่อง 3 (เลข 3) 🌾 แล้วเลือกอาหารสัตว์จากเมนู', 'เดินเข้าคอกไก่ (รั้วทางขวาของแมพ) แล้วคลิก/แตะที่ตัวไก่', 'สัตว์ที่ให้อาหารแล้วจะผลิตไข่ใน 25–45 วินาที ผู้ที่ให้อาหารคือเจ้าของผลผลิตรอบนั้น'] },
    { id: 'collect', ev: 'collect',   hint: 'เก็บไข่จากไก่ 🥚',          text: 'เก็บไข่/นม จากสัตว์', coin: 20,
      how: ['รอจนมี 🥚 ลอยเหนือหัวไก่ที่คุณเลี้ยง', 'คลิก/แตะที่ไก่ตัวนั้นด้วยมือเปล่า', 'ต้องเก็บภายใน 1 วันในเกม ไม่งั้นคนอื่นมาเก็บแทนได้'] },
    { id: 'sellprod', ev: 'sellproduct', hint: 'ขายไข่ที่ร้านปศุสัตว์ 🪙', text: 'ขายไข่/นมที่ร้านปศุสัตว์', coin: 20,
      how: ['กลับไปที่ร้านปศุสัตว์ 🐄 คลิก/แตะที่เคาน์เตอร์', 'เลื่อนลงไปที่ "ขาย" กดปุ่ม ขาย หรือ ทั้งหมด ที่ 🥚 ไข่'] },
    { id: 'quest',   ev: 'questdone', hint: 'ทำเควสสักข้อ (ปุ่ม 📋 เควส)',    text: 'ทำเควสประจำวันให้สำเร็จ 1 ข้อ', coin: 30,
      how: ['กดปุ่ม 📋 ที่แถบเมนูด้านบน → แท็บ "เควสวันนี้"', 'เลือกข้อที่ง่ายที่สุด (เช่น ขุดดิน ปลูก รดน้ำ) แล้วทำตามนั้น ความคืบหน้านับให้เอง'] },
    { id: 'sit',     ev: 'sit',       hint: 'แตะม้านั่งเพื่อนั่งพัก 🪑',  text: 'นั่งพักที่ม้านั่งหรือกองฟางที่ลานกองไฟ', coin: 10,
      how: ['เดินไปลานกองไฟกลางหมู่บ้าน', 'คลิก/แตะที่ม้านั่งหรือกองฟาง นั่งแล้วความหิวไม่ลดและค่อยๆ อิ่มขึ้น'] },
  ];
  // จุดหมายของลูกศรนำทางแต่ละข้อ (ช่อง x,y) • null = ไม่มีลูกศร
  const STARTER_GO = { dig: [14, 13], plant: [14, 13], water: [14, 13], harvest: [14, 13], sell: [26, 12], fish: [18, 19], buyfeed: [41, 16], feed: [48, 11], collect: [48, 11], sellprod: [41, 16], quest: null, sit: [29, 26] };
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
    { id: 'trade1',     e: '🤝', name: 'พ่อค้าแลกเปลี่ยน',   desc: 'เทรดของกับผู้เล่นอื่นสำเร็จ',          stat: 'trade',   goal: 1,   coin: 30 },
    { id: 'sit1',       e: '🪑', name: 'พักผ่อนบ้าง',        desc: 'นั่งพักที่ลานกองไฟ',                  stat: 'sit',     goal: 1,   coin: 10 },
    { id: 'streak3',    e: '🔥', name: 'มาทุกวัน',          desc: 'เข้าเกมติดต่อกัน 3 วัน',               stat: 'streak',  goal: 3,   coin: 50 },
    { id: 'streak7',    e: '🌟', name: 'ชาวเมืองตัวจริง',    desc: 'เข้าเกมติดต่อกัน 7 วัน',               stat: 'streak',  goal: 7,   coin: 200,  title: 'ชาวเมืองตัวจริง' },
    { id: 'rich1k',     e: '💵', name: 'เศรษฐีน้อย',         desc: 'มีเหรียญในกระเป๋าถึง 1,000',          stat: 'wealth',  goal: 1000, coin: 50 },
    { id: 'rich10k',    e: '💎', name: 'เศรษฐีเมือง',        desc: 'มีเหรียญในกระเป๋าถึง 10,000',         stat: 'wealth',  goal: 10000, coin: 500, title: 'เศรษฐีเมือง' },
  ];
  const STARTER_FINAL = { coin: 100, items: ['furn_chair', 'furn_plant', 'lamp'] };
  // สมุดสะสม: ได้ครบทุกชนิดในหมวดไหนรับรางวัลหมวดนั้น (ชนิดใหม่แต่ละชนิดได้ BOOK_ENTRY_COIN) rare = เฟอร์นิเจอร์หายากที่เป็นรางวัล
  const BOOK_ENTRY_COIN = 8;
  const BOOK = {
    fish: { name: 'ปลา',        emoji: '🐟', ids: FISH.filter(f => f.id !== 'boot').map(f => f.id), coin: 300, rare: 'statue' },
    crop: { name: 'พืชผล',      emoji: '🥬', ids: Object.keys(CROPS),                               coin: 250, rare: 'fountain' },
    furn: { name: 'เฟอร์นิเจอร์', emoji: '🛋️', ids: Object.keys(FURN).filter(k => !FURN[k].rare),      coin: 400, rare: 'cat' },
    meal: { name: 'อาหาร',      emoji: '🍜', ids: MEALS.map(m => m.id),                              coin: 100, rare: 'flag' },
  };
  const bookInfo = (cat, id) => {
    if (cat === 'fish') { const f = FISH.find(x => x.id === id); return { emoji: f.emoji, name: f.name }; }
    if (cat === 'crop') return { emoji: CROPS[id].emoji, name: CROPS[id].name };
    if (cat === 'furn') return { emoji: FURN[id].emoji, name: FURN[id].name };
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
  ];
  const seatAt = (tx, ty) => SEATS.find(s => s.x === tx && s.y === ty) || null;
  const cinemaAt = (tx, ty) => tx >= 15 && tx <= 18 && ty >= 33 && ty <= 34;
  const CINEMA_CENTER = { x: 17 * TS, y: 35 * TS };
  const ARC_RANGE = 3.5;              // ระยะ (ช่อง) ที่ต้องอยู่ใกล้ตู้เกมถึงจะเปิด/นั่งเล่นได้ เดินห่างเกิน 3 ช่องจะถูกพาออกจากโต๊ะ
  const BETS = [0, 10, 50, 100, 500]; // ยอดเดิมพันที่เลือกได้ในตู้เกม
  const cabinetAt = (tx, ty) => { for (let i = 0; i < CABINETS.length; i++) if (CABINETS[i].x === tx && CABINETS[i].y === ty) return Object.assign({ idx: i }, CABINETS[i]); return null; };
  // ร้านแต่ละสาย: buy = สินค้าที่ขาย, sell = คำนำหน้าไอเทมที่ร้านรับซื้อ
  const SHOPS = {
    farm:   { name: '🌱 ร้านเมล็ดพันธุ์', skill: 'farm',   buy: Object.keys(CROPS).map(c => 'seed_' + c).concat(['can_2', 'can_3']), sell: ['crop_'] },
    fish:   { name: '🎣 ร้านตกปลา',      skill: 'fish',   buy: ['bait', 'bait_2', 'bait_3', 'rod_2', 'rod_3'],                  sell: ['fish_'] },
    animal: { name: '🐄 ร้านปศุสัตว์',    skill: 'animal', buy: ['feed', 'hay', 'slop', 'nectar', 'medicine', 'animal_chicken', 'animal_duck', 'animal_cow', 'animal_sheep', 'animal_pig', 'animal_bee'], sell: ['egg', 'duck_egg', 'milk', 'wool', 'truffle', 'honey'] },
    pet:    { name: '🐾 ร้านสัตว์เลี้ยง', skill: null,     buy: Object.keys(COMPANIONS).map(c => 'pet_' + c).concat(['petfood', 'medicine']), sell: [] }, // ซื้อแล้วพาติดตัวไปไหนก็ได้ ขายคืนได้ 70%
    wood:   { name: '🪓 ร้านช่างไม้',     skill: 'wood',   buy: ['axe_1', 'axe_2', 'axe_3'], sell: ['log', 'hardwood', 'plank'] },
    // ร้านยานพาหนะ: เตรียมไว้ก่อน ยังไม่เปิดขาย (soon = รายการที่จะมาในอนาคต)
    vehicle: { name: '🚲 ร้านยานพาหนะ',  skill: null,     buy: [], sell: [], soon: [
      { emoji: '🚲', name: 'จักรยาน', price: 300 }, { emoji: '🛵', name: 'มอเตอร์ไซค์', price: 1500 }, { emoji: '🚗', name: 'รถยนต์', price: 6000 }, { emoji: '⛵', name: 'เรือ', price: 4000 },
    ] },
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
    if (k === 'log') return { name: 'ไม้ท่อน', emoji: '🪵', sell: WOOD.log.sell, cat: 'wood' };
    if (k === 'plank') return { name: 'ไม้กระดาน', emoji: '🟧', sell: 58, cat: 'wood' };
    if (k === 'hardwood') return { name: 'ไม้เนื้อแข็ง', emoji: '🟫', sell: WOOD.hardwood.sell, cat: 'wood' };
    if (k === 'lamp') return { name: 'ตะเกียง/ไฟฉาย (สว่างรอบตัว 5 ช่อง)', emoji: '🔦', cat: 'gear' }; // ไม่มีขายในร้านและขายต่อไม่ได้ ได้จากรางวัลคู่มือเริ่มต้น
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
    if (k === 'bait') return { name: 'เหยื่อตกปลา (ไส้เดือน)', emoji: '🪱', buy: BAIT_PRICE, cat: 'tool', bait: 1 };
    const bm = /^bait_(\d)$/.exec(k);
    if (bm && BAITS[bm[1]]) { const b = BAITS[bm[1]]; return { name: `เหยื่อ${b.name} (ปลาแพงขึ้น)`, emoji: b.emoji, buy: b.price, lv: b.lv, skill: 'fish', cat: 'tool', bait: +bm[1] }; }
    let m = /^rod_(\d)$/.exec(k);
    if (m && RODS[m[1]] && RODS[m[1]].price) return { name: RODS[m[1]].name, emoji: '🎣', buy: RODS[m[1]].price, lv: RODS[m[1]].lv, skill: 'fish', once: true, cat: 'gear' };
    if (k === 'petfood') return { name: 'อาหารสัตว์เลี้ยง (+' + PETCARE.food + ' อิ่ม)', emoji: '🦴', buy: 8, cat: 'feed' };
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
  const shopAt = (tx, ty) => { for (const b of BUILDINGS) if (b.counter.some(c => c[0] === tx && c[1] === ty)) return b.kind; return null; };

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

  function makeMap() {
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
    // บ่อน้ำเล็กข้างสวนผัก (ใต้รั้วฝั่งขวาล่าง): ยืนในสวนแถวล่างสุดก็ตักน้ำได้ ไม่ต้องเดินไปสระใหญ่
    for (let x = 17; x <= 20; x++) set(x, 19, T.WATER);
    for (let x = 16; x <= 21; x++) { set(x, 20, T.WATER); set(x, 21, T.SAND); }
    set(16, 19, T.SAND); set(21, 19, T.SAND);
    // ถนน
    road(8, 22, 45, 23);   // ถนนหลัก
    road(13, 18, 14, 21);  // ประตูแปลงผัก
    road(26, 13, 27, 21);  // ร้านเมล็ดพันธุ์
    road(34, 24, 35, 29); road(34, 29, 39, 29); // ร้านตกปลา
    road(41, 17, 42, 21);  // ร้านปศุสัตว์
    road(44, 11, 45, 21); road(43, 16, 43, 16);  // ไปคอกไก่/ทุ่งวัว
    road(30, 14, 37, 18);  // พื้นลานในวงตัว U ของตู้เกม
    road(32, 19, 32, 21);  // ทางเข้าลานตู้เกม (ตรงกลางฐาน U) ต่อกับถนนหลัก
    road(17, 24, 18, 29); road(12, 29, 23, 29); // ลานเล็กๆ ระหว่างร้านเสื้อผ้า (ซ้าย) กับร้านอาหาร (ขวา) และทางเดินหน้าเคาน์เตอร์
    road(10, 24, 11, 29); road(6, 29, 11, 29);   // ร้านช่างไม้
    road(34, 29, 43, 29);                        // ต่อทางไปร้านยานพาหนะ
    road(33, 5, 35, 5);                          // ทางจากร้านเฟอร์นิเจอร์ (ขวามือตัวบ้าน) ลงมาต่อถนนหลัก
    road(PLAZA.x0, PLAZA.y0, PLAZA.x1, PLAZA.y1); // ลานรวมพลกลางหมู่บ้าน (กองไฟ + ที่นั่ง)
    road(14, 30, 19, 37);                         // ลานดูหนังกลางแปลง
    road(2, HOUSING.y1 + 1, 42, HOUSING.y1 + 1); road(23, HOUSING.y1 + 1, 24, 21); // ทางหน้าย่านบ้านและทางลงมาต่อถนนหลัก
    // รั้ว + ประตู
    fence(FARM.x0 - 1, FARM.y0 - 1, FARM.x1 + 1, FARM.y1 + 1); set(13, 18, T.PATH); set(14, 18, T.PATH); set(22, 12, T.PATH); set(22, 13, T.PATH); // ประตูสวน: กลางล่าง + กลางขวา
    for (const P of Object.values(PENS)) { fence(P.x0 - 1, P.y0 - 1, P.x1 + 1, P.y1 + 1); for (const [x, y] of P.gate) set(x, y, T.PATH); }
    for (const [x, y] of BEE.trees) set(x, y, T.TREE);
    for (const [x, y] of BEE.hives) set(x, y, T.BUILD); // รังผึ้ง (ลัง) เดินผ่านไม่ได้
    for (let y = HOUSE_BLD.y0; y <= HOUSE_BLD.y1; y++) for (let x = HOUSE_BLD.x0; x <= HOUSE_BLD.x1; x++) set(x, y, T.BUILD); // บ้านหลังใหญ่ + ขั้นหน้าประตู
    for (const x of [HOUSE_DOOR.x - 1, HOUSE_DOOR.x, HOUSE_DOOR.x + 1]) set(x, HOUSE_DOOR.y, T.PATH);
    // อาคารและเคาน์เตอร์
    for (const b of BUILDINGS) {
      if (b.kind !== 'sign') for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) set(x, y, T.BUILD); // ป้าย Arcade เป็นป้ายลอย เดินผ่านได้ (แตะได้จากพื้นที่ป้าย)
      for (const [x, y] of b.counter) set(x, y, T.SHOP);
    }
    // ลานหน้าร้าน: ช่องหน้าอาคารที่ไม่ใช่เคาน์เตอร์ปูทางให้ต่อกับถนน ร้านจะได้ไม่ลอยอยู่กลางหญ้า
    for (const b of BUILDINGS) if (b.counter.length) for (let x = b.x0; x <= b.x1; x++) setIfGrass(x, b.y1 + 1, T.PATH);
    for (const c of CABINETS) set(c.x, c.y, T.SHOP); // ตู้เกมเป็นช่องที่เดินผ่านไม่ได้ แต่ใช้งานได้จากช่องติดกัน
    set(ATM.x, ATM.y, T.SHOP); set(BOARD.x, BOARD.y, T.SHOP); set(CHEST.x, CHEST.y, T.SHOP); // กระดานข่าว + ตู้เซฟกองกลาง
    set(FIRE.x, FIRE.y, T.BUILD);                    // กองไฟ (เดินผ่านไม่ได้)
    // ต้นไม้ขอบแมพ + กระจายในที่ว่าง
    for (let x = 0; x < W; x++) { set(x, 0, T.TREE); set(x, H - 1, T.TREE); }
    for (let y = 0; y < H; y++) { set(0, y, T.TREE); set(W - 1, y, T.TREE); }
    const r = rng(11);
    const reserved = [[4, 6, 23, 19], [24, 8, 29, 22], [7, 21, 46, 24], [33, 23, 40, 30], [29, 30, 57, 45], [43, 2, 62, 28], [39, 12, 45, 22], [27, 12, 38, 21], [55, 7, 63, 15], [5, 24, 44, 31], [8, 30, 24, 40], [1, 1, 43, 6], [34, 16, 41, 22]];
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
  const FESTIVAL = { plaza: { x0: 46, y0: 25, x1: 59, y1: 28 }, stage: { x0: 51, y0: 24, x1: 54, y1: 25 }, tents: [{ x0: 47, y0: 26, x1: 48, y1: 27 }, { x0: 57, y0: 26, x1: 58, y1: 27 }] };
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
  const NO_TREE = [FARM, ...Object.values(PENS), PLAZA, { x0: 13, y0: 30, x1: 20, y1: 38 }, { x0: 2, y0: 1, x1: 42, y1: 6 }].map(z => ({ x0: z.x0 - 2, y0: z.y0 - 2, x1: z.x1 + 2, y1: z.y1 + 2 }));
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
    return t === T.WATER || t === T.TREE || t === T.BUILD || t === T.FENCE || t === T.SHOP || t === T.FURN || t === T.LANDMARK || t === T.WALL || t === T.VOID;
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
  const SELLABLE = [...Object.keys(CROPS).map(c => 'crop_' + c), ...FISH.filter(f => f.id !== 'boot').map(f => 'fish_' + f.id), 'egg', 'duck_egg', 'milk', 'wool', 'truffle', 'log', 'hardwood', 'plank', ...COOK.map(c => c.id)];

  const api = { gaugeCore, gaugeDist, gaugeHit, fishClass, WEAR_RATE, CRAFT, ARC_RANGE, STARTER, STARTER_FINAL, BOOK, BOOK_ENTRY_COIN, bookInfo, WEEKLY, RARE, NPC, BOTBET, DOLE, playLevel, doleCost, dolePackage, ATM, BANK, VILLAGE, QUESTS, QUEST_NEWBIE, QUEST_PER_DAY, QUEST_ALL, ACH, TITLES, titleFor, POINTS, ARCPTS, BUFFS, FAME, BOARD, CHEST, TOWN, townAt, reviveCost, HOUSING, HOUSE, HOUSE_DOOR, HOUSE_BLD, HOUSE_SPAWN, HFLOOR, HKEEP, HOUSE_MAX_ITEMS, snapQ, furnDims, furnRect, houseSolidRects, houseBlockedAt, houseTopAt, houseCheck, houseInside, houseKeep, makeHouseMap, houseScore, plotAt, plotSignAt, FURN, TS, W, H, T, FARM, PENS, BEE, SPAWN, START_SPAWN, STARTER_GO, DAY_MS, FARM_REGROW_MS, CLOCK_MS, TREE, WATER_MS, CANS, canTier, FISH_GAUGE, gaugePos, gaugeHit, MAX_LV, SKILLS, CROPS, FISH, ANIMALS, COMPANIONS, PETCARE, RODS, BUILDINGS, SHOPS, DIRS,
    DURABILITY, durMax, repairCost, REPAIR, TOOL_PRICE, toolPrice, canRepair, TRADE, TICKET, MOVIES, cinemaAt, CINEMA_CENTER, isTradable, tradeValue,
    AXES, TREE_HP, WOOD, SICK, SELLBACK, CASINO, PLAZA, FIRE, SEATS, seatAt, sellbackValue, isChoppable, treeSpotOk, BRIDGE, LIGHTHOUSE, ISLAND, FESTIVAL, projectDone, applyProject,
    ANIMAL_GRACE_MS, PLAYER_HUNGER, WEAR, WEAR_CATS, WEAR_DEFAULT, wearKey, PANTS_COLOR, MEALS, FOOD,
    BAIT_PRICE, BAITS, baitWeight, RAKE, MARKET, PMARKET, ENERGY, energyCost, CATFAT, CAT_KEYS, sellCat, COOK, COOK_FEE, COOK_CATS, cookCat, PROJECTS, PROJ_DONATE, sellQuote, GAME_TITLES, CABINETS, BETS, cabinetAt, xpFor, levelOf, itemInfo, shopSells, shopAt, cropStage, rng, makeMap, blockedAt, facing, inFarm,
    SELLABLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Shared = api;
})(this);
