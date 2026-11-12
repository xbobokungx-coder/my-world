// เรือประมงลำใหญ่ (pet-on-boat ขั้น 3) — วาดด้วยโค้ดพิกเซลตาม STYLE_GUIDE (ขอบเข้ม แสงซ้ายบน ไม้โทนอุ่น)
// ขนาดตาม BOAT.hull: ยาว 96 กว้าง 44 px เกม (1 พิกเซลศิลป์ = 2 px เกม → 48×22) • helm = กึ่งกลางเรือ = พิกัดตัวละคร
// API: PixelBoat.draw(ctx, x, y, dir, now, layer)  x,y = จุด helm บนจอ (px เกม) • dir 0 ใต้ 1 เหนือ 2 ซ้าย 3 ขวา (ตามลำดับ DIRS)
//   layer 'back' = ท้องเรือ/ดาดฟ้า/กราบ/เสา/ใบ/ฟอง (วาดก่อนตัวละคร+สัตว์) • 'front' = กราบด้านใกล้ตา + พวงมาลัย (ทับตัวละคร) • ไม่ส่ง = ทั้งหมด
// ตะวันตกพลิกจากตะวันออก • ธง/ฟอง/การโยกตามคลื่น (0–1 px) ใช้ now
const PixelBoat = (() => {
  const { mk, r } = PixelArt;
  const SC = 2;
  const C = {
    rimL: '#d49a58', rim: '#b87a3d', rimD: '#8b5a2b', // กราบ: ไฮไลต์ / หลัก / เงา
    side: '#8b5a2b', sideD: '#6b4423', sideDD: '#4a2f1a', // ข้างลำเรือ
    deck: '#c28a4a', deckL: '#d19a58', deckD: '#a0692f', deckLine: '#7e5226', // ดาดฟ้า (เส้นไม้ + เงา)
    red: '#c8553d', redL: '#e0735a', cream: '#f3e6c4', creamD: '#d6c298', creamDD: '#b8a27a',
    mastL: '#c98b4a', mast: '#a0692f', mastD: '#7a4a22', rope: '#e2cf90', ropeD: '#b89a5a',
    wheelL: '#d9a441', wheel: '#a0692f', iron: '#6a6f7a'
  };
  const LEN = 24, MAXW = 11; // ครึ่งยาว / ครึ่งกว้าง (พิกเซลศิลป์)
  const hw = u => { // ครึ่งกว้างของลำเรือที่ตำแหน่ง u (ท้ายแบน → ลำป้อม → หัวเรือเรียว)
    if (u < -14) return Math.round(8 + (u + LEN) * 0.3);
    if (u <= 6) return MAXW;
    const t = (u - 6) / (LEN - 6); return Math.max(0, Math.round(MAXW * (1 - Math.pow(t, 1.7))));
  };
  const plank = (a, b) => ((a * 7 + b * 13) % 5 === 0); // ลายสุ่มบนดาดฟ้า

  // ---- มองข้าง (ตะวันออก หัวเรือไปทางขวา) ----
  const EW = 52, EH = 37, ECX = 26, ECY = 24;
  function east(fr) {
    const fn = (x) => {
      const P = (X, Y, c) => { x.fillStyle = c; x.fillRect(X, Y, 1, 1); };
      for (let u = -LEN; u <= LEN; u++) {
        const h = hw(u), X = ECX + u, top = ECY - h, nb = ECY + h;
        for (let y = top; y <= nb + 1; y++) {
          const near = y >= nb - 2; // กราบใกล้ตา (อยู่ชั้นหน้า)
          let c;
          if (h < 3) c = y === top ? C.rimL : C.rim;
          else if (y === top) c = C.rimL;
          else if (y === top + 1) c = C.rimD;
          else if (y < nb - 2) { c = (y - top) % 3 === 0 ? C.deckLine : (y - top) === 2 ? C.deckD : C.deck; if (c === C.deck && plank(u, y)) c = C.deckL; if (u < -22) c = C.rimD; }
          else if (y === nb - 2) c = u % 6 === 0 ? C.rimD : C.rimL;
          else if (y === nb - 1) c = C.red;
          else if (y === nb) c = C.side;
          else c = C.sideDD;
          if (fr && !near) continue;
          if (fr === 'only' && !near) continue;
          P(X, y, c);
        }
        // ใต้ท้องเรือ: คิ้วท้ายเรือ (ทรานซัม) ด้านซ้ายสุด
        if (!fr && u === -LEN) for (let y = top; y <= nb; y++) P(X, y, C.sideD);
        if (!fr && u === -LEN + 1) for (let y = top + 2; y < nb - 2; y++) P(X, y, C.rimD);
      }
      if (!fr) {
        // ของบนดาดฟ้า: ลังปลาท้ายเรือ + เชือกม้วนหัวเรือ
        r(x, '#6b4423', ECX - 21, ECY - 3, 5, 4); r(x, '#a8703a', ECX - 21, ECY - 3, 5, 1); r(x, '#8b5a2b', ECX - 20, ECY - 1, 3, 1); r(x, '#e8c066', ECX - 20, ECY - 2, 1, 1);
        r(x, C.ropeD, ECX + 14, ECY - 2, 4, 3); r(x, C.rope, ECX + 14, ECY - 2, 4, 1); r(x, C.rope, ECX + 15, ECY, 2, 1);
        r(x, C.rimL, ECX + 22, ECY - 1, 1, 1); // หัวเรือมีหมุด
        // เสากระโดง u=-3 (= -6 px เกม) สูง 19
        const mx = ECX - 3;
        r(x, C.mastD, mx, ECY - 19, 2, 19); r(x, C.mastL, mx, ECY - 19, 1, 19); r(x, '#e8c04a', mx, ECY - 20, 2, 1);
        r(x, C.mastD, mx - 12, ECY - 6, 13, 1); r(x, C.mast, mx - 12, ECY - 7, 13, 1); // บูม
        // ใบเรือสามเหลี่ยมด้านท้าย
        for (let y = ECY - 17; y <= ECY - 7; y++) { const w = Math.round((y - (ECY - 17)) * 11 / 10) + 1; for (let i = 0; i < w; i++) { const X = mx - 1 - i; r(x, i < 2 ? C.creamD : (y > ECY - 10 ? C.creamD : C.cream), X, y, 1, 1); } }
        r(x, C.creamDD, mx - 11, ECY - 8, 11, 1); // ชายล่างใบ
        for (let k = 0; k < 3; k++) r(x, C.creamDD, mx - 3 - k * 3, ECY - 16 + k * 4, 1, 1); // รอยพับ
        r(x, C.rope, mx + 2, ECY - 12, 1, 6); // เชือกผูกหัวใบไปหัวเรือสั้นๆ
      } else if (fr === 'only') {
        // พวงมาลัยมองข้าง: วงรีบาง + แกน (อยู่หน้าตัวละคร)
        const wx = ECX + 3, wy = ECY - 1;
        r(x, C.wheel, wx, wy - 3, 1, 7); r(x, C.wheelL, wx + 1, wy - 3, 1, 7); r(x, C.wheel, wx - 1, wy - 2, 1, 5);
        r(x, C.iron, wx - 2, wy, 3, 1); r(x, '#e8c04a', wx, wy, 1, 1);
        r(x, C.sideD, wx - 1, wy + 3, 3, 1);
      }
    };
    return fn;
  }
  function build(w, h, fn, fnFront) {
    return { back: mk(w, h, (x) => fn(x), { soft: ['#2a1b14', '#5a4a3a'] }), front: mk(w, h, (x) => fnFront(x), false) };
  }

  // ---- มองตรงจากหัว/ท้าย (ใต้: หัวเรือชี้ลงจอ, เหนือ: หัวเรือชี้ขึ้น) ----
  const VW = 30, VH = 56, VCX = 15, VCY = 28;
  function vert(south) {
    const sg = south ? 1 : -1; // ทิศของหัวเรือบนจอ
    const fn = (x, front) => {
      const P = (X, Y, c) => { x.fillStyle = c; x.fillRect(X, Y, 1, 1); };
      if (!front) { // ใต้ท้องเรือ (ผนังข้างที่เห็นเยื้องลงมา) ก่อน
        for (let u = -LEN; u <= LEN; u++) { const h = hw(u), Y = VCY + sg * u; for (let k = 1; k <= 2; k++) for (let dx = -h; dx <= h; dx++) P(VCX + dx, Y + k, k === 2 ? C.sideDD : C.sideD); }
      }
      for (let u = -LEN; u <= LEN; u++) {
        const h = hw(u), Y = VCY + sg * u, bowRows = (u >= 8);
        for (let dx = -h; dx <= h; dx++) {
          const ad = Math.abs(dx), rim = ad >= h - 1 || h < 3, inner = ad === h - 2 && h >= 3;
          if (front && !(rim && (sg * u >= 6 || false))) continue; // ชั้นหน้า: กราบช่วงหัวเรือที่ใกล้ตา (ใต้) / ไม่มี (เหนือ ไม่ทับคน)
          let c;
          if (rim) c = dx <= 0 ? (ad === h ? C.rimL : C.rim) : (ad === h ? C.rimD : C.rimD);
          else if (inner) c = dx < 0 ? C.rimD : C.deckD;
          else { c = (u + 40) % 3 === 0 ? C.deckLine : C.deck; if (c === C.deck && plank(dx, u)) c = C.deckL; if (dx < -h + 4) c = c === C.deckLine ? c : C.deckD; }
          if (rim && u % 5 === 0 && ad === h - 1 && h >= 3) c = C.red; // แถบสีแดงตามกราบ (จุดๆ)
          P(VCX + dx, Y, c);
        }
      }
      // ทรานซัมท้ายเรือ
      if (!front) { const Y = VCY - sg * LEN, h = hw(-LEN); for (let dx = -h; dx <= h; dx++) { P(VCX + dx, Y, C.rimL); P(VCX + dx, Y - sg, dx === 0 ? C.sideDD : C.rim); } if (!south) { for (let dx = -h; dx <= h; dx++) P(VCX + dx, Y - sg * 2, C.sideD); } }
      if (!front) {
        const my = VCY - sg * 6; // เสา u=-3
        // ลังปลา (ท้ายเรือ) + เชือกม้วน (หัวเรือ)
        const by = VCY - sg * 18; r(x, '#6b4423', VCX - 3, by - 2, 7, 5); r(x, '#a8703a', VCX - 3, by - 2, 7, 1); r(x, '#8b5a2b', VCX - 2, by, 5, 1); r(x, '#e8c066', VCX - 1, by - 1, 1, 1);
        r(x, C.ropeD, VCX - 2, VCY + sg * 14 - 1, 5, 3); r(x, C.rope, VCX - 2, VCY + sg * 14 - 1, 5, 1);
        // เสา + ใบเรือที่เห็นเกือบด้านข้าง (แถบผ้าตามเสา) + บูม
        r(x, C.mastD, VCX, my - 19, 2, 19); r(x, C.mastL, VCX, my - 19, 1, 19); r(x, '#e8c04a', VCX, my - 20, 2, 1);
        for (let y = my - 17; y <= my - 7; y++) { const w = Math.round((y - (my - 17)) * 5 / 10) + 2; r(x, y > my - 11 ? C.creamD : C.cream, VCX + 2, y, w, 1); r(x, C.creamDD, VCX + 1 + w, y, 1, 1); }
        r(x, C.mast, VCX - 5, my - 7, 14, 1); r(x, C.mastD, VCX - 5, my - 6, 14, 1);
        if (!south) { r(x, C.wheel, VCX - 3, VCY - 6, 7, 1); r(x, C.wheelL, VCX - 2, VCY - 8, 5, 1); r(x, C.iron, VCX, VCY - 7, 1, 1); } // พวงมาลัยเหนือ (หันหลัง) อยู่ชั้นหลัง ตัวละครบังเอง
      } else if (south) { // พวงมาลัยมองตรงหน้า: วงล้อมีก้าน (ชั้นหน้า ทับตัวละคร)
        const wx = VCX, wy = VCY + 4;
        for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; P(Math.round(wx + Math.cos(t) * 4), Math.round(wy + Math.sin(t) * 3.2), a % 2 ? C.wheelL : C.wheel); }
        r(x, C.iron, wx - 4, wy, 9, 1); r(x, C.iron, wx, wy - 3, 1, 7); r(x, '#e8c04a', wx, wy, 1, 1);
      }
    };
    return { back: mk(VW, VH, (x) => fn(x, false), { soft: ['#2a1b14', '#5a4a3a'] }), front: mk(VW, VH, (x) => fn(x, true), false) };
  }

  let SPR = null;
  const sprites = () => SPR || (SPR = (() => {
    const e = east(false), ef = east('only');
    return { 3: { back: mk(EW, EH, (x) => east(false)(x), { soft: ['#2a1b14', '#5a4a3a'] }), front: mk(EW, EH, (x) => ef(x), false), w: EW, h: EH, cx: ECX, cy: ECY, flag: [ECX - 3, ECY - 20] }, 0: Object.assign(vert(true), { w: VW, h: VH, cx: VCX, cy: VCY, flag: [VCX, VCY - 6 - 20] }), 1: Object.assign(vert(false), { w: VW, h: VH, cx: VCX, cy: VCY, flag: [VCX, VCY + 6 - 20] }) };
  })());

  function draw(ctx, x, y, dir, now, layer) {
    const S = sprites(), d = dir === 2 ? 3 : dir, s = S[d] || S[3], flip = dir === 2;
    const bob = Math.round((Math.sin(now / 620 + 1) + 1) / 2); // 0–1 px เกม ตามคลื่น
    const gx = Math.round(x), gy = Math.round(y) + bob;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(gx, gy); if (flip) ctx.scale(-1, 1);
    const ox = -(s.cx + 1) * SC, oy = -(s.cy + 1) * SC;
    if (layer !== 'front') {
      // เงา/ฟองน้ำใต้ท้องเรือ (ไม่โยกตามคลื่น)
      ctx.save(); ctx.translate(0, -bob);
      const vertical = d !== 3, rx = vertical ? 25 : 50, ry = vertical ? 50 : 25, cyo = vertical ? 4 : 10;
      ctx.fillStyle = 'rgba(8,48,70,.22)'; ctx.beginPath(); ctx.ellipse(0, cyo + 3, rx, ry * .62, 0, 0, 7); ctx.fill();
      const ph = (now / 900) % 1; ctx.strokeStyle = `rgba(255,255,255,${.34 * (1 - ph)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, cyo, rx * (.94 + ph * .1), ry * (.6 + ph * .08), 0, 0, 7); ctx.stroke();
      ctx.restore();
      ctx.drawImage(s.back, ox, oy, s.w + 2 > 0 ? (s.w + 2) * SC : 0, (s.h + 2) * SC);
      // ธงปลายเสา โบกตามเวลา
      const fx = (s.flag[0] - s.cx) * SC, fy = (s.flag[1] - s.cy) * SC;
      for (let i = 0; i < 5; i++) { // ธงสามเหลี่ยมโบกไปทางท้ายเรือ (มองข้าง) / ไปทางขวา (มองหน้า-หลัง)
        const wv = Math.round(Math.sin(now / 170 - i * .9) * .7) * SC, h = (i < 3 ? 2 : 1) * SC, X = d === 3 ? fx - (i + 1) * SC : fx + (i + 2) * SC;
        ctx.fillStyle = i < 2 ? C.redL : C.red; ctx.fillRect(X, fy - 2 * SC + wv - SC + (i < 3 ? 0 : SC / 2 | 0) + SC, SC, h);
      }
    }
    if (layer !== 'back') ctx.drawImage(s.front, ox, oy, (s.w + 2) * SC, (s.h + 2) * SC);
    ctx.restore();
  }
  // ขนาด/จุดยึดไว้ให้ client-dev (px เกม): กล่องรูป + จุด helm ในรูป
  const info = { len: 96, wid: 44, scale: SC };
  return { draw, info };
})();
if (typeof window !== 'undefined') window.PixelBoat = PixelBoat;
