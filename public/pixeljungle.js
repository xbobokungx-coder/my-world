// ป่าดงดิบ (J3, 22 พ.ย. 2026): พื้นป่า ต้นไม้ทึบ ค่าย ศาลเจ้า ซากวิหาร พุ่มสมุนไพร ซุ้มประตูป่า วาดด้วยโค้ดทั้งหมด (ไม่ใช้ PNG) • 1 พิกเซลศิลป์ = 2 พิกเซลเกม ช่องละ 32 พิกเซล
// API: PixelJungle.base(rows, W, H, J) = ภาพพื้นทั้งแมพ • tree/tent/fire/sign/shrine/ruin/herb ตั้งฐานที่ขอบล่างของช่อง (วาดเรียงตาม y เอง) • gate = ซุ้มประตูป่าในเมือง
// สไปรต์ที่ไม่ขยับแคชไว้ครั้งเดียว • ต้นไม้ในป่า "ทึบ เข้ม มีรากค้ำ เถาวัลย์ห้อย" ต่างจากต้นไม้ฟาร์ม (สว่าง กลมๆ) ให้รู้ทันทีว่าตัดไม่ได้
const PixelJungle = (() => {
  const TS = 32, U = 2, hash = (x, y, s = 0) => PixelArt.hash(x, y, s);
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };
  const cache = new Map(), memo = (k, f) => { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; };
  const px = (g, col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x * U, y * U, w * U, h * U); }; // วาดเป็นหน่วย 2 พิกเซล

  // ---------- ต้นไม้ทึบ ----------
  const CANOPY = ['', '#0e2615', '#1a3f22', '#2a5a2f', '#3f7d3b', '#4a3422', '#33241a', '#5e4630', '#3b7a36', '#e8a23a', '#07140b'];
  function treeSprite(big, v) {
    const GW = big ? 34 : 26, GH = big ? 42 : 34, cx = GW / 2, [c, g] = mk(GW * U, GH * U), m = new Uint8Array(GW * GH);
    const set = (x, y, i) => { if (x >= 0 && y >= 0 && x < GW && y < GH) m[y * GW + x] = i; }, get = (x, y) => (x >= 0 && y >= 0 && x < GW && y < GH ? m[y * GW + x] : 0);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(GW * U / 2, (GH - 1) * U, big ? 26 : 18, 5, 0, 0, 7); g.fill(); // เงาใต้ต้น
    const j = i => (hash(v * 31 + i, GW, 77) - 0.5) * 2;
    const blobs = big ? [[cx, 12, 13, 11], [cx - 8, 17, 8, 7], [cx + 8, 17, 8, 7], [cx + j(1) * 3, 7, 8, 6]] : [[cx, 11, 9, 8], [cx - 5, 15, 5, 5], [cx + 5, 15, 5, 5]];
    const canopyBottom = big ? 24 : 20;
    for (const [bx, by, rx0, ry0] of blobs) {
      const rx = rx0 + j(bx | 0) * 1.2, ry = ry0 + j(by | 0) * 1;
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const dx = (x + 0.5 - bx) / rx, dy = (y + 0.5 - by) / ry, d = dx * dx + dy * dy; if (d > 1) continue;
        const light = -dx * 0.5 - dy * 0.7 + (hash(x, y, v + 5) - 0.5) * 0.5;
        set(x, y, dy > 0.25 && d > 0.55 ? 1 : light > 0.5 ? 4 : light > 0.12 ? 3 : 2);
      }
    }
    for (let y = 0; y < canopyBottom; y++) for (let x = 0; x < GW; x++) if (get(x, y) && hash(x * 3, y * 5, v + 9) > 0.93) set(x, y, get(x, y) === 1 ? 2 : 4); // ประกายใบสว่าง/เข้มสุ่ม
    // ลำต้น + รากค้ำสองข้าง (ฐานบานออก)
    for (let y = canopyBottom - 2; y < GH - 1; y++) for (let x = cx - 2; x < cx + 2; x++) set(x, y, x < cx ? 7 : 5);
    for (let i = 0; i < 6; i++) {
      const y = GH - 7 + i, lx = cx - 3 - i, rx = cx + 2 + i;
      set(lx, y, 5); set(lx + 1, y, 6); set(rx, y, 5); set(rx - 1, y, 6);
      for (let x = lx + 2; x < cx - 2; x++) set(x, y, i > 2 ? 6 : 5);
      for (let x = cx + 2; x < rx - 1; x++) set(x, y, i > 2 ? 6 : 5);
    }
    for (let x = cx - 9; x <= cx + 8; x++) set(x, GH - 1, 6); // ปลายรากเกาะพื้น
    // เถาวัลย์ห้อยลงจากเรือนยอด
    const nv = big ? 6 : 4;
    for (let k = 0; k < nv; k++) {
      const x = 3 + Math.floor(hash(k, v, 13) * (GW - 6)); let y0 = -1; for (let y = GH - 8; y >= 0; y--) if (get(x, y) >= 1 && get(x, y) <= 4) { y0 = y; break; } if (y0 < 0) continue;
      const len = 3 + Math.floor(hash(k, v, 14) * (big ? 8 : 6));
      for (let i = 1; i <= len && y0 + i < GH - 8; i++) { set(x, y0 + i, 8); if (i % 3 === 0) { set(x + 1, y0 + i, 8); set(x - 1, y0 + i - 1, 8); } }
      if (hash(k, v, 15) > 0.45) set(x, Math.min(GH - 9, y0 + len + 1), 9); // ดอกไม้เล็กปลายเถา
    }
    const out = []; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (!get(x, y) && (get(x - 1, y) || get(x + 1, y) || get(x, y - 1) || get(x, y + 1))) out.push([x, y]);
    for (const [x, y] of out) set(x, y, 10);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const i = get(x, y); if (i) px(g, CANOPY[i], x, y); }
    return c;
  }
  function tree(g, tx, ty, ch) { // ch '#' = ดงทึบ (ใหญ่) • 't' = ต้นเดี่ยว (เล็กกว่า)
    const big = ch !== 't', spr = memo((big ? 'tb' : 'ts') + ((hash(tx, ty, 3) * 4) | 0), () => treeSprite(big, (hash(tx, ty, 3) * 4) | 0));
    g.imageSmoothingEnabled = false; g.drawImage(spr, Math.round(tx * TS + TS / 2 - spr.width / 2), (ty + 1) * TS + 2 - spr.height);
  }

  // ---------- พื้น ----------
  const FLOOR = ['#2f5a2e', '#2a5129', '#34622f'], FDARK = '#16301a', DIRT = ['#8a6a46', '#80613f', '#94744c'], WATER = ['#2b6a73', '#2a6470', '#2f727b'], SHALLOW = ['#a89a74', '#9a8c68', '#b0a47e'];
  function base(rows, W, H, J) {
    const [oc, g] = mk(W * TS, H * TS), at = (x, y) => (rows[y] && rows[y][x]) || '#', isW = ch => ch === '~' || ch === 'H', isTr = ch => ch === '#' || ch === 't';
    const zoneOf = (x, y) => { for (const s of J.safe) if (x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1) return s.id; return ''; };
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const ch = at(tx, ty), X = tx * TS, Y = ty * TS, h1 = hash(tx, ty, 1);
      if (ch === '~' || ch === 'H') { // ลำธาร
        g.fillStyle = WATER[(h1 * 3) | 0]; g.fillRect(X, Y, TS, TS);
        for (let i = 0; i < 3; i++) { const a = hash(tx * 3 + i, ty, 2), b = hash(tx, ty * 3 + i, 3); g.fillStyle = 'rgba(190,235,240,.22)'; g.fillRect(X + ((a * 12) | 0) * 2, Y + ((b * 14) | 0) * 2, 8 + ((a * 3) | 0) * 4, 2); }
        if (!isW(at(tx, ty - 1))) { g.fillStyle = '#1f4f4f'; g.fillRect(X, Y, TS, 4); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(X, Y + 4, TS, 4); } // ตลิ่งเงาริมน้ำ
        if (!isW(at(tx, ty + 1))) { g.fillStyle = '#1f4f4f'; g.fillRect(X, Y + TS - 4, TS, 4); }
      } else if (ch === 'F') { // ที่ข้ามตื้น: เห็นพื้นกรวด น้ำใสบางๆ ทับ
        g.fillStyle = SHALLOW[(h1 * 3) | 0]; g.fillRect(X, Y, TS, TS);
        for (let i = 0; i < 6; i++) { const a = hash(tx * 5 + i, ty, 4), b = hash(tx, ty * 5 + i, 5); g.fillStyle = i & 1 ? '#7d7152' : '#c9bd96'; g.fillRect(X + ((a * 14) | 0) * 2, Y + ((b * 14) | 0) * 2, 4, 2); }
        g.fillStyle = 'rgba(110,190,200,.42)'; g.fillRect(X, Y, TS, TS);
        for (let i = 0; i < 2; i++) { const a = hash(tx * 3 + i, ty, 6), b = hash(tx, ty * 3 + i, 7); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(X + ((a * 10) | 0) * 2, Y + ((b * 14) | 0) * 2, 8, 2); }
        if (at(tx, ty - 1) === '~') { g.fillStyle = 'rgba(30,90,100,.35)'; g.fillRect(X, Y, TS, 6); } if (at(tx, ty + 1) === '~') { g.fillStyle = 'rgba(30,90,100,.35)'; g.fillRect(X, Y + TS - 6, TS, 6); }
      } else if (ch === '=') { // ทางดิน
        g.fillStyle = DIRT[(h1 * 3) | 0]; g.fillRect(X, Y, TS, TS);
        for (let i = 0; i < 5; i++) { const a = hash(tx * 5 + i, ty, 8), b = hash(tx, ty * 5 + i, 9); g.fillStyle = i & 1 ? '#a8885e' : '#5f4630'; g.fillRect(X + ((a * 14) | 0) * 2, Y + ((b * 14) | 0) * 2, 2 + (i & 1) * 2, 2); }
        if (at(tx - 1, ty) !== '=' && at(tx - 1, ty) !== 'H') { g.fillStyle = '#4a3a24'; g.fillRect(X, Y, 4, TS); g.fillStyle = '#2f5a2e'; for (let i = 0; i < 4; i++) g.fillRect(X - 2 + (i & 1) * 2, Y + 4 + ((hash(tx, ty + i, 10) * 6) | 0) * 4, 4, 2); }
        if (at(tx + 1, ty) !== '=' && at(tx + 1, ty) !== 'H') { g.fillStyle = '#4a3a24'; g.fillRect(X + TS - 4, Y, 4, TS); g.fillStyle = '#2f5a2e'; for (let i = 0; i < 4; i++) g.fillRect(X + TS - 2 - (i & 1) * 2, Y + 4 + ((hash(tx, ty + i, 11) * 6) | 0) * 4, 4, 2); }
      } else {
        const zone = ch === 'E' ? '' : zoneOf(tx, ty), tr = isTr(ch);
        g.fillStyle = tr ? FDARK : FLOOR[(h1 * 3) | 0]; g.fillRect(X, Y, TS, TS);
        if (zone === 'camp') { g.fillStyle = 'rgba(120,92,56,.55)'; g.fillRect(X, Y, TS, TS); for (let i = 0; i < 3; i++) { g.fillStyle = '#5a4630'; g.fillRect(X + ((hash(tx * 3 + i, ty, 12) * 14) | 0) * 2, Y + ((hash(tx, ty * 3 + i, 13) * 14) | 0) * 2, 4, 2); } } // ลานค่าย = ดินอัดแน่น
        else if (zone === 'shrine' || zone === 'tower') { g.fillStyle = 'rgba(130,140,120,.5)'; g.fillRect(X, Y, TS, TS); g.fillStyle = 'rgba(40,60,40,.45)'; g.fillRect(X, Y, TS, 2); g.fillRect(X, Y, 2, TS); if ((tx + ty) % 2) { g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(X + 2, Y + 2, TS - 4, TS - 4); } } // ลานหิน (เขตปลอดภัย)
        if (!tr) {
          for (let i = 0; i < 6; i++) { // เศษใบไม้
            const a = hash(tx * 7 + i, ty, 14), b = hash(tx, ty * 7 + i, 15), k = hash(tx + i, ty * 2, 16); g.fillStyle = k < 0.3 ? '#6e5a2e' : k < 0.6 ? '#4d8a38' : k < 0.85 ? '#1f4423' : '#a08a3c';
            g.fillRect(X + ((a * 14) | 0) * 2, Y + ((b * 14) | 0) * 2, 4, 2);
          }
          const d = hash(tx, ty, 21);
          if (d < 0.07) { g.fillStyle = '#3e7a34'; g.fillRect(X + 10, Y + 18, 12, 2); g.fillRect(X + 8, Y + 20, 4, 2); g.fillRect(X + 20, Y + 20, 4, 2); g.fillRect(X + 14, Y + 14, 4, 4); } // เฟิร์นเล็ก
          else if (d < 0.1) { g.fillStyle = '#7a8a5a'; g.fillRect(X + 8, Y + 16, 10, 6); g.fillStyle = '#566a3e'; g.fillRect(X + 10, Y + 14, 6, 4); } // ก้อนหินมีตะไคร่
          if (isW(at(tx, ty - 1)) || at(tx, ty - 1) === 'F') { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(X, Y, TS, 6); } // ริมตลิ่ง
        } else if (hash(tx, ty, 22) > 0.5) { g.fillStyle = '#0e2113'; g.fillRect(X + ((hash(tx, ty, 23) * 12) | 0) * 2, Y + ((hash(tx, ty, 24) * 12) | 0) * 2, 6, 4); }
      }
      if (ch === 'H') { // สะพานไม้: ไม้พาดขวางทางเดิน ราวกั้นสองข้าง
        const L = at(tx - 1, ty) !== 'H', R = at(tx + 1, ty) !== 'H';
        for (let i = 0; i < 4; i++) { g.fillStyle = '#5a3a1c'; g.fillRect(X, Y + i * 8 + 6, TS, 2); g.fillStyle = i & 1 ? '#9a6a38' : '#a8743c'; g.fillRect(X, Y + i * 8, TS, 6); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(X, Y + i * 8, TS, 2); }
        if (L) { g.fillStyle = '#3f2814'; g.fillRect(X, Y, 4, TS); g.fillStyle = '#7a4a24'; g.fillRect(X, Y, 2, TS); }
        if (R) { g.fillStyle = '#3f2814'; g.fillRect(X + TS - 4, Y, 4, TS); g.fillStyle = '#7a4a24'; g.fillRect(X + TS - 4, Y, 2, TS); }
      }
    }
    // ทางออกขอบบน: ช่องแสงเขียวใต้ซุ้มหิน (เสาหิน + คานคลุมเถา)
    const E = J.exit, ex0 = E.x0 * TS, ex1 = (E.x1 + 1) * TS, ey0 = E.y0 * TS, ey1 = (E.y1 + 1) * TS;
    const gr = g.createLinearGradient(0, ey0, 0, ey1); gr.addColorStop(0, 'rgba(210,255,200,.75)'); gr.addColorStop(1, 'rgba(120,200,110,.22)'); g.fillStyle = gr; g.fillRect(ex0, ey0, ex1 - ex0, ey1 - ey0);
    for (const sx of [ex0 - 8, ex1 - 8]) { for (let y = ey0; y < ey1; y += 8) { g.fillStyle = (y / 8) & 1 ? '#6f786a' : '#8a9484'; g.fillRect(sx, y, 16, 8); g.fillStyle = '#434a40'; g.fillRect(sx, y + 6, 16, 2); } g.fillStyle = '#4e7a3a'; g.fillRect(sx, ey0 + 10, 6, 6); g.fillRect(sx + 8, ey0 + 28, 8, 4); }
    g.fillStyle = '#566053'; g.fillRect(ex0 - 8, ey0, ex1 - ex0 + 16, 12); g.fillStyle = '#8a9484'; g.fillRect(ex0 - 8, ey0, ex1 - ex0 + 16, 4); g.fillStyle = '#434a40'; g.fillRect(ex0 - 8, ey0 + 10, ex1 - ex0 + 16, 2);
    g.fillStyle = '#3b7a36'; for (let x = ex0 - 4; x < ex1 + 4; x += 10) { const l = 6 + ((hash(x, 5, 30) * 4) | 0) * 4; g.fillRect(x, ey0 + 12, 2, l); g.fillRect(x + 2, ey0 + 12 + l - 4, 2, 2); } // เถาวัลย์ห้อยจากคาน
    g.font = 'bold 11px "Sukhumvit Set","Thonburi","Noto Sans Thai",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = 'rgba(10,30,15,.85)'; g.strokeText('ทางออก ▲', (ex0 + ex1) / 2, ey1 - 12); g.fillStyle = '#eaffd8'; g.fillText('ทางออก ▲', (ex0 + ex1) / 2, ey1 - 12);
    return oc;
  }

  // ---------- ของในค่าย / ศาลเจ้า / ซากวิหาร / สมุนไพร ----------
  const tentSprite = () => memo('tent', () => { // 3x2 ช่อง (96x64) เต็นท์ผ้าใบทรงจั่ว
    const [c, g] = mk(96, 64), N = 24;
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(48, 58, 46, 5, 0, 0, 7); g.fill();
    for (let r = 0; r < N; r++) { const hw = Math.round(2 + (r / (N - 1)) * 21), y = 6 + r; px(g, '#3a2a18', 24 - hw - 1, y, 1, 1); px(g, '#3a2a18', 24 + hw, y, 1, 1); px(g, '#b8945a', 24 - hw, y, hw, 1); px(g, '#9c7a46', 24, y, hw, 1); if (r % 5 === 4) { px(g, '#8a6a38', 24 - hw, y, hw, 1); px(g, '#7a5c30', 24, y, hw, 1); } }
    for (let r = 0; r < N; r++) { const hw = Math.round(1 + (r / (N - 1)) * 5); if (r > 8) { px(g, '#2a1d12', 24 - hw, 6 + r, hw * 2, 1); } } // ช่องเข้าเต็นท์
    px(g, '#3a2a18', 24, 3, 1, 4); px(g, '#c0392b', 25, 3, 5, 3); px(g, '#e55039', 25, 3, 5, 1); // เสาและธงแดง
    px(g, '#5a4630', 3, 28, 1, 3); px(g, '#5a4630', 44, 28, 1, 3); // หลักเชือก
    return c;
  });
  function tent(g, tx0, ty0) { const s = tentSprite(); g.imageSmoothingEnabled = false; g.drawImage(s, tx0 * TS, (ty0 + 2) * TS + 2 - s.height); }
  function fire(g, tx, ty, now) { // กองไฟค่าย: หินล้อมวง ฟืนไขว้ เปลวไฟวูบ
    const cx = tx * TS + 16, by = (ty + 1) * TS - 4;
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(cx, by + 2, 15, 5, 0, 0, 7); g.fill();
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, sx = cx + Math.cos(a) * 12, sy = by - 3 + Math.sin(a) * 4; g.fillStyle = '#4a4f4a'; g.fillRect(Math.round(sx) - 3, Math.round(sy) - 2, 6, 4); g.fillStyle = '#8a908a'; g.fillRect(Math.round(sx) - 3, Math.round(sy) - 2, 6, 2); }
    g.fillStyle = '#4a2f18'; g.fillRect(cx - 10, by - 6, 20, 4); g.fillRect(cx - 8, by - 9, 4, 8); g.fillRect(cx + 4, by - 9, 4, 8); g.fillStyle = '#2a1a0c'; g.fillRect(cx - 10, by - 3, 20, 1);
    const f1 = Math.sin(now / 90 + tx) * 2, f2 = Math.sin(now / 70 + 1.7) * 2;
    g.fillStyle = '#e8641c'; g.fillRect(cx - 6, by - 16 - f1, 12, 12 + f1); g.fillRect(cx - 4, by - 22 - f2, 8, 8 + f2);
    g.fillStyle = '#ffb02e'; g.fillRect(cx - 4, by - 15 - f2, 8, 10); g.fillRect(cx - 2, by - 20 - f1, 4, 6);
    g.fillStyle = '#fff3c0'; g.fillRect(cx - 2, by - 11, 4, 6);
  }
  function sign(g, tx, ty, text) { // ป้ายไม้ปักดิน
    const cx = tx * TS + 16, by = (ty + 1) * TS - 2;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(cx - 8, by - 3, 16, 4);
    g.fillStyle = '#3f2814'; g.fillRect(cx - 2, by - 22, 4, 22); g.fillStyle = '#7a4a24'; g.fillRect(cx - 2, by - 22, 2, 22);
    g.fillStyle = '#2b1b0e'; g.fillRect(cx - 14, by - 40, 28, 20); g.fillStyle = '#8a5a2c'; g.fillRect(cx - 12, by - 38, 24, 16); g.fillStyle = '#a8743c'; g.fillRect(cx - 12, by - 38, 24, 2);
    g.font = 'bold 9px "Sukhumvit Set","Thonburi","Noto Sans Thai",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2b1b0e'; g.fillText(text, cx, by - 29);
  }
  function shrine(g, tx0, ty0, now) { // 2x2 ช่อง: แท่นหินตะไคร่ + โคมหินเรืองแสงเขียวฟ้า
    const x0 = tx0 * TS, by = (ty0 + 2) * TS - 2;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x0 + 32, by, 30, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#434a40'; g.fillRect(x0 + 2, by - 12, 60, 12); g.fillStyle = '#8a9484'; g.fillRect(x0 + 2, by - 12, 60, 4); g.fillStyle = '#6f786a'; g.fillRect(x0 + 6, by - 20, 52, 8); g.fillStyle = '#9aa494'; g.fillRect(x0 + 6, by - 20, 52, 2);
    g.fillStyle = '#4e7a3a'; g.fillRect(x0 + 4, by - 12, 10, 4); g.fillRect(x0 + 44, by - 20, 12, 4); g.fillRect(x0 + 30, by - 6, 8, 4);
    g.fillStyle = '#5a6256'; g.fillRect(x0 + 26, by - 44, 12, 24); g.fillStyle = '#8a9484'; g.fillRect(x0 + 26, by - 44, 4, 24); g.fillStyle = '#434a40'; g.fillRect(x0 + 34, by - 44, 4, 24); // เสาโคม
    g.fillStyle = '#6f786a'; g.fillRect(x0 + 20, by - 52, 24, 8); g.fillStyle = '#9aa494'; g.fillRect(x0 + 20, by - 52, 24, 2); g.fillStyle = '#566053'; g.fillRect(x0 + 24, by - 58, 16, 6);
    const a = 0.55 + 0.25 * Math.sin(now / 500); g.fillStyle = `rgba(123,224,212,${a})`; g.fillRect(x0 + 28, by - 40, 8, 8); g.fillStyle = `rgba(220,255,248,${a})`; g.fillRect(x0 + 30, by - 38, 4, 4);
    g.fillStyle = '#f4b6c2'; g.fillRect(x0 + 10, by - 24, 4, 4); g.fillStyle = '#ffe28a'; g.fillRect(x0 + 48, by - 24, 4, 4); // ดอกไม้บูชา
  }
  const ruinSprite = (tall, v) => memo('ru' + tall + v, () => { // 1 ช่อง: เศษกำแพงหินเก่า (แถวบนสูง แถวล่างเตี้ย)
    const h = tall ? 48 : 28, [c, g] = mk(32, h); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h - 4, 32, 4);
    const top = tall ? 6 + v * 4 : 6 + v * 3;
    for (let y = top; y < h - 2; y += 8) for (let x = 0; x < 32; x += 16) { const o = ((y - top) / 8 & 1) * 8, xx = x - o; g.fillStyle = hash(x, y, v + 40) > 0.5 ? '#8d9486' : '#767d70'; g.fillRect(Math.max(0, xx), y, Math.min(16, 32 - Math.max(0, xx)) - (xx < 0 ? 0 : 0), 8); g.fillStyle = '#434a40'; g.fillRect(Math.max(0, xx), y + 6, 16, 2); g.fillRect(Math.max(0, xx + 14), y, 2, 8); }
    g.fillStyle = '#9aa494'; g.fillRect(0, top, 32, 2); g.fillStyle = '#4e7a3a'; g.fillRect(2 + v * 4, top - 2, 12, 4); g.fillRect(18, top, 10, 4); g.fillRect(0, h - 12, 8, 6);
    g.fillStyle = '#3b7a36'; for (let i = 0; i < 3; i++) g.fillRect(6 + i * 10 + v, top + 4, 2, 8 + i * 3);
    return c;
  });
  function ruin(g, tx, ty, top) { const v = (hash(tx, ty, 41) * 3) | 0, s = ruinSprite(top, v); g.imageSmoothingEnabled = false; g.drawImage(s, tx * TS, (ty + 1) * TS - s.height); }
  function herb(g, tx, ty, ready = true, now = 0) { // พุ่มสมุนไพร: ใบเขียวสว่างมีดอกขาว (เก็บแล้ว = เหลือแต่ต้นเตี้ย)
    const cx = tx * TS + 16, by = (ty + 1) * TS - 4, sw = Math.sin(now / 900 + tx * 2) * 1;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(cx, by, 12, 4, 0, 0, 7); g.fill();
    const leaf = (dx, dy, w, h, c1, c2) => { g.fillStyle = '#1f5a28'; g.fillRect(cx + dx - 1, by - dy - h - 1, w + 2, h + 2); g.fillStyle = c1; g.fillRect(cx + dx, by - dy - h, w, h); g.fillStyle = c2; g.fillRect(cx + dx, by - dy - h, w, 2); };
    if (!ready) { leaf(-4, 0, 8, 6, '#3f8a38', '#5fbf4a'); return; }
    leaf(-12, 0, 10, 10, '#3f9a3a', '#6fd25a'); leaf(2, 0, 10, 10, '#3f9a3a', '#6fd25a'); leaf(-6 + sw, 4, 12, 14, '#4aac42', '#86e86a');
    g.fillStyle = '#ffffff'; g.fillRect(cx - 8, by - 14, 3, 3); g.fillRect(cx + 5 + sw, by - 18, 3, 3); g.fillStyle = '#ffd1e0'; g.fillRect(cx - 1 + sw, by - 22, 3, 3);
  }

  // ---------- ซุ้มประตูป่าในเมือง (ที่ฐานหอคอยเดิม 4x3 ช่อง) ----------
  const gateStatic = () => memo('gate', () => {
    const [c, g] = mk(128, 96), stone = (x, y, w, h) => { for (let yy = y; yy < y + h; yy += 8) for (let xx = x; xx < x + w; xx += 16) { const o = ((yy - y) / 8 & 1) * 8, x0 = Math.max(x, xx - o), x1 = Math.min(x + w, xx - o + 16); if (x1 <= x0) continue; g.fillStyle = hash(xx, yy, 50) > 0.5 ? '#8a9484' : '#767d70'; g.fillRect(x0, yy, x1 - x0, 8); g.fillStyle = '#434a40'; g.fillRect(x0, yy + 6, x1 - x0, 2); g.fillRect(x1 - 2, yy, 2, 8); } };
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(64, 92, 62, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#0c1c10'; g.fillRect(32, 28, 64, 64); // ช่องประตูมืดเขียว
    const gr = g.createLinearGradient(0, 28, 0, 92); gr.addColorStop(0, '#102c18'); gr.addColorStop(1, '#2f6a3a'); g.fillStyle = gr; g.fillRect(32, 28, 64, 64);
    g.fillStyle = '#0a2012'; for (let i = 0; i < 5; i++) { const x = 36 + i * 12, h = 20 + ((hash(i, 7, 51) * 4) | 0) * 6; g.fillRect(x, 92 - h, 8, h); g.fillRect(x - 3, 92 - h - 6, 14, 8); } // เงาต้นไม้ลึกเข้าไป
    stone(4, 28, 28, 64); stone(96, 28, 28, 64); stone(4, 4, 120, 24); // เสาสองข้าง + คานบน
    g.fillStyle = '#9aa494'; g.fillRect(4, 4, 120, 2); g.fillRect(4, 28, 28, 2); g.fillRect(96, 28, 28, 2);
    g.fillStyle = '#6f786a'; g.fillRect(52, 0, 24, 8); g.fillStyle = '#9aa494'; g.fillRect(52, 0, 24, 2); // หินยอดซุ้ม
    g.fillStyle = '#4e7a3a'; g.fillRect(6, 6, 22, 6); g.fillRect(84, 4, 30, 6); g.fillRect(4, 40, 10, 8); g.fillRect(110, 58, 12, 8); g.fillRect(8, 74, 14, 6); // ตะไคร่
    g.fillStyle = '#3b7a36'; for (const [x, l] of [[8, 34], [18, 22], [34, 28], [46, 16], [84, 20], [100, 34], [112, 24], [120, 30]]) { g.fillRect(x, 28, 2, l); g.fillRect(x + 2, 28 + l - 6, 2, 2); g.fillRect(x - 2, 28 + l - 12, 2, 2); } // เถาวัลย์ห้อย
    g.fillStyle = '#e8a23a'; g.fillRect(19, 48, 3, 3); g.fillRect(101, 60, 3, 3);
    g.fillStyle = '#2b1b0e'; g.fillRect(36, 8, 56, 16); g.fillStyle = '#4a3a24'; g.fillRect(38, 10, 52, 12); // ป้ายชื่อบนคาน
    return c;
  });
  function gate(g, x0, y0, wT, hT, now, open) {
    const s = gateStatic(), X = x0 * TS, Y = y0 * TS; g.imageSmoothingEnabled = false; g.drawImage(s, X, Y + hT * TS - s.height);
    const by = Y + hT * TS - s.height; // ไอหมอกเรืองลอยในช่องประตู
    for (let i = 0; i < 5; i++) { const t = (now / 6000 + i / 5) % 1; g.fillStyle = `rgba(170,240,170,${0.2 * Math.sin(t * Math.PI)})`; g.beginPath(); g.ellipse(X + 40 + ((i * 29) % 48) + Math.sin(now / 1300 + i) * 4, by + 88 - t * 50, 12 + t * 6, 3, 0, 0, 7); g.fill(); }
    for (const lx of [X + 18, X + 110]) { const a = 0.35 + 0.2 * Math.sin(now / 300 + lx); g.fillStyle = `rgba(150,255,170,${a})`; g.beginPath(); g.arc(lx, by + 36, 9, 0, 7); g.fill(); g.fillStyle = '#d8ffd0'; g.fillRect(lx - 2, by + 33, 4, 6); } // โคมหิ่งห้อยบนเสา
    g.font = 'bold 12px "Sukhumvit Set","Thonburi","Noto Sans Thai",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffe9a8'; g.fillText('ป่าดงดิบ', X + 64, by + 16);
    if (!open) { g.fillStyle = 'rgba(21,13,34,.55)'; g.fillRect(X + 34, by + 56, 60, 16); g.font = 'bold 10px "Sukhumvit Set","Thonburi","Noto Sans Thai",sans-serif'; g.fillStyle = `rgba(240,225,255,${0.75 + 0.25 * Math.sin(now / 900)})`; g.fillText('เร็วๆ นี้', X + 64, by + 64); }
  }
  return { base, tree, tent, fire, sign, shrine, ruin, herb, gate };
})();
