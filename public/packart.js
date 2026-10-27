// โหลดสไปรต์จาก asset pack (PNG) — ร้านค้า + พื้นหลังแมพ
const PackArt = (() => {
  const BUILD = {
    farm:   { src: '/pack/farm.png',   scale: 1.28 },
    fish:   { src: '/pack/fish.png',   scale: 1.28 },
    animal: { src: '/pack/animal.png', scale: 1.32 },
    pet:    { src: '/pack/pet.png',    scale: 1.28 },
    cloth:  { src: '/pack/cloth.png',  scale: 1.30 },
    food:   { src: '/pack/food.png',   scale: 1.42 },
    wood:   { src: '/pack/wood.png',   scale: 1.35 },
    furn:   { src: '/pack/furn.png',   scale: 1.28 },
  };
  // กระเบื้องพื้นจากแพ็ก (ยังไม่เปิดใช้ในเกม — รอทำลานปูหิน/ขอบให้ครบ)
  const TILES = {
    grass: { atlas: '/pack/tiles/grass_atlas.png', n: 8, fill: '#9bd646' },
    path:  { atlas: '/pack/tiles/path_atlas.png',  n: 6, fill: '#e0a86a' },
    water: { atlas: '/pack/tiles/water_atlas.png', n: 6, fill: '#4cc9b6' },
    sand:  { atlas: '/pack/tiles/sand_atlas.png',  n: 4, fill: '#d2af78' },
  };
  const STAMPS = {
    bush:  '/pack/tiles/stamp_bush.png',
    rocks: '/pack/tiles/stamp_rocks.png',
  };

  const imgs = Object.create(null);
  const tileImgs = Object.create(null);
  const stampImgs = Object.create(null);
  let loaded = 0, total = 0, ready = false, tilesReady = false;
  const waiters = [];
  const mapWaiters = [];
  let mapBg = null, mapBgReady = false;
  let groundCache = null, groundKey = '';

  function bump() {
    loaded++;
    if (loaded >= total) {
      ready = true; tilesReady = Object.keys(TILES).every(k => tileImgs[k]);
      waiters.splice(0).forEach(fn => fn());
    }
  }

  function loadOne(src, into, key) {
    const im = new Image();
    im.decoding = 'async';
    im.onload = im.onerror = () => { if (im.naturalWidth) into[key] = im; bump(); };
    im.src = src + '?v=pack3';
  }

  function loadMapBg() {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      if (!im.naturalWidth) return;
      mapBg = im; mapBgReady = true;
      mapWaiters.splice(0).forEach(fn => fn());
    };
    im.onerror = () => { mapBgReady = false; };
    im.src = '/pack/map-bg.png?v=bg1';
  }

  function load() {
    const bKeys = Object.keys(BUILD), tKeys = Object.keys(TILES), sKeys = Object.keys(STAMPS);
    total = bKeys.length + tKeys.length + sKeys.length; loaded = 0; ready = false; tilesReady = false;
    groundCache = null; groundKey = '';
    bKeys.forEach(k => loadOne(BUILD[k].src, imgs, k));
    tKeys.forEach(k => loadOne(TILES[k].atlas, tileImgs, k));
    sKeys.forEach(k => loadOne(STAMPS[k], stampImgs, k));
    loadMapBg();
  }

  function whenReady(fn) { if (ready) fn(); else waiters.push(fn); }
  function whenMapReady(fn) { if (mapBgReady) fn(); else mapWaiters.push(fn); }

  // วาดพื้นแมพทั้งใบจากภาพ bg (ขนาด W*U × H*U) หรือ null ถ้ายังไม่พร้อม
  function mapBackground() {
    if (!mapBgReady || !mapBg) return null;
    const U = PixelArt.U, w = Shared.W * U, h = Shared.H * U;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.drawImage(mapBg, 0, 0, w, h);
    return c;
  }

  function building(b) {
    const conf = BUILD[b.kind], im = imgs[b.kind];
    if (!conf || !im) return null;
    const ts = (typeof Shared !== 'undefined' && Shared.TS) || 32;
    const bw = (b.x1 - b.x0 + 1) * ts, bh = (b.y1 - b.y0 + 1) * ts;
    const tw = bw * conf.scale, th = im.naturalHeight * (tw / im.naturalWidth);
    return { img: im, x: b.x0 * ts + (bw - tw) / 2, y: b.y0 * ts + bh - th, w: tw, h: th };
  }

  // ---------- พื้นหลังแมพ ----------
  const hash = (x, y, s = 0) => {
    let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  function gtype(t) {
    const T = Shared.T;
    if (t === T.WATER || t === T.BRIDGE) return 'water';
    if (t === T.SAND) return 'sand';
    if (t === T.PATH || t === T.BUILD || t === T.SHOP || t === T.LANDMARK) return 'path';
    if (t === T.FLOOR || t === T.FURN) return 'floor';
    return 'grass'; // GRASS, TREE, FENCE, ...
  }

  function stampTile(g, kind, tx, ty, U) {
    const atlas = tileImgs[kind], conf = TILES[kind];
    if (!atlas || !conf) { g.fillStyle = (conf && conf.fill) || '#7bc65a'; g.fillRect(tx * U, ty * U, U, U); return; }
    const ts = atlas.naturalHeight || 48; // กระเบื้องจัตุรัสในแอตลาส
    const idx = Math.floor(hash(tx, ty, kind.length) * conf.n) % conf.n;
    const ox = Math.floor(hash(tx, ty, 11) * (ts - U + 1));
    const oy = Math.floor(hash(tx, ty, 17) * (ts - U + 1));
    g.drawImage(atlas, idx * ts + ox, oy, U, U, tx * U, ty * U, U, U);
  }

  // ขอบระหว่างชนิด: ทับด้วยกระเบื้องข้างแบบโปร่งตามระยะจากขอบช่อง
  function blendEdge(g, MAP, tx, ty, U) {
    const me = gtype(MAP[ty][tx]);
    if (me === 'floor') return;
    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of neighbors) {
      const nx = tx + dx, ny = ty + dy;
      if (ny < 0 || nx < 0 || ny >= Shared.H || nx >= Shared.W) continue;
      const other = gtype(MAP[ny][nx]);
      if (other === me || other === 'floor') continue;
      // ไม่ให้หญ้ารุกเข้าลานปูหิน
      if (me === 'path' && Shared.isPaved(tx, ty)) continue;
      const atlas = tileImgs[other];
      if (!atlas) continue;
      const ts = atlas.naturalHeight || 48;
      const idx = Math.floor(hash(nx, ny, other.length) * TILES[other].n) % TILES[other].n;
      g.save();
      g.beginPath();
      if (dx === 1) g.rect(tx * U + U * 0.62, ty * U, U * 0.38, U);
      else if (dx === -1) g.rect(tx * U, ty * U, U * 0.38, U);
      else if (dy === 1) g.rect(tx * U, ty * U + U * 0.62, U, U * 0.38);
      else g.rect(tx * U, ty * U, U, U * 0.38);
      g.clip();
      g.globalAlpha = 0.72;
      const ox = Math.floor(hash(tx + dx, ty + dy, 21) * (ts - U + 1));
      const oy = Math.floor(hash(tx + dx, ty + dy, 27) * (ts - U + 1));
      g.drawImage(atlas, idx * ts + ox, oy, U, U, tx * U, ty * U, U, U);
      g.restore();
    }
  }

  function decorate(g, MAP, U) {
    const { W, H, T } = Shared;
    // พุ่มเล็กบนหญ้า
    const bush = stampImgs.bush, rocks = stampImgs.rocks;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (MAP[y][x] !== T.GRASS) continue;
      if (Shared.isPaved && Shared.isPaved(x, y)) continue;
      const h = hash(x, y, 90);
      if (h < 0.018 && bush) {
        const s = U * (0.7 + hash(x, y, 91) * 0.5);
        g.drawImage(bush, x * U + (U - s) / 2, y * U + U - s * 0.85, s, s * 0.85);
      } else if (h > 0.985 && rocks) {
        const s = U * (0.55 + hash(x, y, 92) * 0.35);
        g.drawImage(rocks, x * U + (U - s) / 2, y * U + U - s * 0.7, s, s * 0.7);
      }
    }
    // จุดโฟมริมน้ำ (เส้นขอบน้ำ)
    g.fillStyle = 'rgba(234,253,253,.85)';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (MAP[y][x] !== T.WATER) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (ny < 0 || nx < 0 || ny >= H || nx >= W) continue;
        if (MAP[ny][nx] === T.WATER || MAP[ny][nx] === T.BRIDGE) continue;
        if (hash(x, y, 33) > 0.55) continue;
        const px = x * U + (dx === 1 ? U - 2 : dx === -1 ? 0 : U * 0.3);
        const py = y * U + (dy === 1 ? U - 2 : dy === -1 ? 0 : U * 0.3);
        g.fillRect(px, py, dx ? 2 : U * 0.4, dy ? 2 : U * 0.4);
      }
    }
  }

  // คืนแคนวาสขนาดเดียวกับ PixelArt.ground (W*U × H*U) หรือ null ถ้ายังไม่พร้อม
  function ground(MAP) {
    if (!tilesReady) return null;
    const U = PixelArt.U, { W, H, T } = Shared;
    const key = W + 'x' + H + ':' + U; // MAP เปลี่ยนโครงสร้างน้อย — แคชตามขนาด + invalidate นอก
    // สร้างใหม่ทุกครั้งที่เรียก (buildBase เรียกเมื่อ dirty) — ไม่แคช MAP ทั้งก้อนเพื่อความถูกต้องตอนตัดไม้/ขุด
    const c = document.createElement('canvas'); c.width = W * U; c.height = H * U;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;

    // พื้นไม้ในบ้านแปลง (floor)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const kind = gtype(MAP[y][x]);
      if (kind === 'floor') {
        g.fillStyle = hash(x, y, 5) < 0.5 ? '#b67d45' : '#c08a50';
        g.fillRect(x * U, y * U, U, U);
        g.fillStyle = '#7a4d28'; g.fillRect(x * U, y * U + U - 1, U, 1);
      } else {
        stampTile(g, kind, x, y, U);
      }
    }
    // ขอบ organic ระหว่างชนิด
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) blendEdge(g, MAP, x, y, U);

    // สะพาน: ทับไม้บนน้ำ
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (MAP[y][x] === T.BRIDGE) {
      g.fillStyle = '#a8703a'; g.fillRect(x * U + 1, y * U + 1, U - 2, U - 2);
      g.fillStyle = '#6e4624'; g.fillRect(x * U + 1, y * U + 1, U - 2, 1);
      for (let i = 0; i < 3; i++) g.fillRect(x * U + 2 + i * 5, y * U + 2, 1, U - 3);
    }

    decorate(g, MAP, U);
    g.imageSmoothingEnabled = false;
    return c;
  }

  function has(kind) { return !!imgs[kind]; }
  function isReady() { return ready; }
  function groundReady() { return tilesReady; }
  function mapReady() { return mapBgReady; }
  function invalidate() { groundCache = null; groundKey = ''; }

  load();
  return { load, whenReady, whenMapReady, building, ground, mapBackground, mapReady, has, isReady, groundReady, invalidate, BUILD };
})();
