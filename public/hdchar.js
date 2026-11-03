// ต้นแบบตัวละครความละเอียดสูง (HD) — ทดลองเท่านั้น เปิดเฉพาะเครื่องที่สั่ง ?hd=1 (ปิด ?hd=0) ผู้เล่นคนอื่นไม่เห็นผล
// วาดด้วยเส้นโค้ง/ไล่สี (เวกเตอร์) แล้วแคชเป็นภาพ 4 พิกเซลจอต่อ 1 หน่วยเกม (สไปรต์พิกเซลเดิม = 0.5) ขนาดในโลกเกมเท่าเดิม
// → กล่องชน/ตำแหน่งมือถืออุปกรณ์/เท้า ไม่เปลี่ยน เกมเพลย์เหมือนเดิมทุกอย่าง
// รองรับชุด: เสื้อ tee stripe hoodie • กางเกง jeans shorts skirt • หมวก straw cap none • ของเสริม none
// ชุดอื่นที่ยังไม่ได้วาด HD ใช้ตัวพิกเซลเดิม (PixelChar) แทน • ดูตัวชี้วัดในคอนโซล: __hd.stats() • ภาพเทียบ: __hd.sheet()
const HDChar = (() => {
  const RES = 4, VW = 32, VH = 46, OX = 16, OY = 42, MAXC = 150; // สไปรต์กว้าง 32 สูง 46 หน่วยเกม (ตัดพอดีปีกหมวก) • เท้าอยู่ที่ (16, 42) = p.y + 12 ในโลก • แคชสูงสุด 150 ภาพ ≈ 14 MB (ภาพละ ~92 KB)
  const SUP = { shirt: ['tee', 'stripe', 'hoodie'], pants: ['jeans', 'shorts', 'skirt'], hat: ['straw', 'cap', 'none'], acc: ['none'] };
  const SKIN = '#f6d2a8', SKIN_D = '#e2ad80', HAIR = '#5b3a1e', HAIR_L = '#8a5a30', INK = '#3a2418', SHOE = '#4a3426', EYE = '#2f2016';
  const { WEAR_DEFAULT, PANTS_COLOR } = Shared;
  const cache = new Map(), st = { builds: 0, buildMs: 0, draws: 0, drawMs: 0 };

  const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const shade = (c, k) => { const [r, g, b] = hex(c), f = v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k); return `rgb(${f(r)},${f(g)},${f(b)})`; };
  const rrect = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }; // เบราว์เซอร์เก่าไม่มี roundRect = สี่เหลี่ยมธรรมดา
  const ellP = (g, cx, cy, rx, ry) => { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); };
  const paint = (g, fill, ink = INK, lw = 0.7) => { g.fillStyle = fill; g.fill(); if (ink) { g.lineWidth = lw; g.strokeStyle = ink; g.stroke(); } };
  const grad = (g, y0, y1, c) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, shade(c, .18)); gr.addColorStop(1, shade(c, -.18)); return gr; };
  const limb = (g, x0, y0, x1, y1, w, fill) => { // แขน/ขาเป็นแคปซูล: ขอบเข้มก่อน แล้วเนื้อทับ
    g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
    g.lineWidth = w + 1.4; g.strokeStyle = INK; g.stroke(); g.lineWidth = w; g.strokeStyle = fill; g.stroke();
  };

  function build(k) {
    const { dir, ph, sit, wr, col, hat, pc } = k, back = dir === 1, side = dir >= 2;
    const cv = document.createElement('canvas'); cv.width = VW * RES; cv.height = VH * RES;
    const g = cv.getContext('2d'); g.scale(RES, RES); g.translate(OX, OY); g.lineJoin = 'round';
    const sw = Math.sin(ph / 8 * Math.PI * 2), bob = sit ? 2 : -Math.abs(sw) * 0.8; // ก้าวขา −1..1 • ตัวเด้งขึ้นตอนก้าว
    const pk = wr.pants, sk = wr.shirt, legC = pk === 'jeans' ? pc : pk === 'shorts' ? SKIN : SKIN, legTop = sit ? -5 : -9;
    // ---- ขา + รองเท้า ----
    const legs = side ? [[-sw * 3, -1], [sw * 3, 1]] : [[-3.3, 0], [3.3, 0]];
    legs.forEach(([lx, z], i) => {
      const lift = side ? 0 : Math.max(0, (i ? sw : -sw)) * 1.6, fx = side ? lx : lx, y1 = (sit ? -1 : -1.2) - lift;
      const c = side && z < 0 ? shade(legC, -.15) : legC;
      limb(g, side ? 0 : lx * 0.85, legTop + bob, fx, y1, 4.2, c);
      if (pk === 'shorts') limb(g, side ? 0 : lx * 0.85, legTop + bob, side ? fx * 0.45 : lx * 0.92, legTop + 3.4 + bob, 4.6, pc);
      ellP(g, fx + (side ? 1.2 : 0), y1 + 0.6, side ? 3 : 2.6, 1.7); paint(g, SHOE);
    });
    // ---- ลำตัว (เสื้อ) ----
    const ty = -17 + bob, tw = side ? 9 : 12, tx = -tw / 2, body = sk === 'hoodie' ? shade(col, -.05) : col;
    rrect(g, tx, ty, tw, 10, 3.2); paint(g, grad(g, ty, ty + 10, body));
    g.save(); rrect(g, tx, ty, tw, 10, 3.2); g.clip();
    if (sk === 'stripe') { g.fillStyle = shade(col, -.35); for (const yy of [2.2, 5.2, 8.2]) g.fillRect(tx, ty + yy, tw, 1.3); }
    if (sk === 'hoodie' && !back && !side) { rrect(g, -4, ty + 5.5, 8, 3.6, 1.4); paint(g, shade(col, -.2), shade(col, -.45), .4); g.strokeStyle = '#fff'; g.lineWidth = .6; g.beginPath(); g.moveTo(-1.6, ty + .6); g.lineTo(-1.8, ty + 4.4); g.moveTo(1.6, ty + .6); g.lineTo(1.8, ty + 4.4); g.stroke(); }
    if (sk === 'hoodie' && back) { ellP(g, 0, ty + 1.4, 5, 3.4); paint(g, shade(col, -.25), null); }
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(tx, ty, tw, 1.4); // ไฮไลต์ไหล่
    g.restore();
    if (pk === 'jeans' || pk === 'shorts') { g.fillStyle = shade(pc, -.1); rrect(g, tx + .4, ty + 8.2, tw - .8, 2.4, 1); paint(g, shade(pc, -.05), INK, .5); } // ขอบเอว
    if (pk === 'skirt') { g.beginPath(); g.moveTo(tx + .6, ty + 7.5); g.lineTo(tx + tw - .6, ty + 7.5); g.lineTo(tx + tw + 2, ty + 13); g.quadraticCurveTo(0, ty + 14.2, tx - 2, ty + 13); g.closePath(); paint(g, grad(g, ty + 7, ty + 14, pc)); g.strokeStyle = shade(pc, -.3); g.lineWidth = .5; g.beginPath(); for (const xx of [-3, 0, 3]) { g.moveTo(xx * .7, ty + 8.4); g.lineTo(xx, ty + 13.4); } g.stroke(); }
    // ---- แขน (แขนสั้นโชว์ผิว / ฮู้ดแขนยาว) ----
    const sleeve = sk === 'hoodie' ? shade(col, -.15) : col, armSkin = sk === 'hoodie' ? sleeve : SKIN;
    const arm = (sx, sy, hx, hy) => { limb(g, sx, sy, hx, hy, 3.4, armSkin); limb(g, sx, sy, sx + (hx - sx) * .45, sy + (hy - sy) * .45, 3.9, sleeve); ellP(g, hx, hy, 1.7, 1.7); paint(g, SKIN, INK, .5); };
    if (side) arm(0, ty + 1.8, sw * -3.2, ty + 8.3);
    else { arm(-6.2, ty + 1.8, -7.6, ty + 8.2 + Math.max(0, sw) * .9); arm(6.2, ty + 1.8, 7.6, ty + 8.2 + Math.max(0, -sw) * .9); }
    // ---- หัว ----
    const hy = -25 + bob;
    ellP(g, 0, hy, 10.4, 9.2); const hg = g.createRadialGradient(-3, hy - 3, 2, 0, hy, 11); hg.addColorStop(0, '#ffe2bd'); hg.addColorStop(1, SKIN_D); paint(g, back ? HAIR : hg);
    if (back) { // หลังหัว: ผมทั้งหมด + ประกาย
      g.save(); ellP(g, 0, hy, 10.4, 9.2); g.clip(); g.fillStyle = shade(HAIR, -.25); g.fillRect(-11, hy + 5, 22, 5); g.strokeStyle = HAIR_L; g.lineWidth = .8; g.beginPath(); g.arc(-2, hy - 2, 5, Math.PI * 1.1, Math.PI * 1.6); g.stroke(); g.restore();
    } else {
      g.save(); ellP(g, 0, hy, 10.4, 9.2); g.clip(); // ผมทับครึ่งบน + ปอยหน้าม้า
      g.beginPath();
      if (side) { g.moveTo(-11, hy + 7); g.lineTo(-11, hy - 10); g.lineTo(11, hy - 10); g.lineTo(11, hy - 2.5); g.quadraticCurveTo(7, hy - 4.8, 4, hy - 2.2); g.quadraticCurveTo(1, hy - 3.6, -1.5, hy - 1); g.quadraticCurveTo(-3, hy + 3, -4.5, hy + 7); }
      else { g.moveTo(-11, hy + 3); g.lineTo(-11, hy - 10); g.lineTo(11, hy - 10); g.lineTo(11, hy + 3); g.quadraticCurveTo(9.5, hy - 2.5, 7, hy - 2.8); g.quadraticCurveTo(5, hy - 1, 3, hy - 3.6); g.quadraticCurveTo(0, hy - 1.2, -2.6, hy - 3.6); g.quadraticCurveTo(-5, hy - 1, -7, hy - 2.8); g.quadraticCurveTo(-9.5, hy - 2.5, -11, hy + 3); }
      g.closePath(); g.fillStyle = HAIR; g.fill(); g.strokeStyle = HAIR_L; g.lineWidth = .7; g.beginPath(); g.arc(-3, hy - 5, 4.5, Math.PI * 1.1, Math.PI * 1.55); g.stroke();
      g.restore(); ellP(g, 0, hy, 10.4, 9.2); g.lineWidth = .7; g.strokeStyle = INK; g.stroke();
      const eyes = side ? [5.2] : [-3.9, 3.9]; // ตาโต + ประกาย 2 จุด
      for (const ex of eyes) { ellP(g, ex, hy + 2, side ? 1.3 : 1.6, 2.2); g.fillStyle = EYE; g.fill(); ellP(g, ex + .5, hy + 1.1, .6, .7); g.fillStyle = '#fff'; g.fill(); ellP(g, ex - .4, hy + 3, .3, .35); g.fill(); }
      g.fillStyle = 'rgba(242,128,128,.45)'; for (const cx of side ? [3.4] : [-6.3, 6.3]) { ellP(g, cx, hy + 4.6, 1.8, 1.1); g.fill(); }
      g.strokeStyle = '#8c4a3a'; g.lineWidth = .55; g.beginPath(); const mx = side ? 7.4 : 0; g.arc(mx, hy + 4.6, 1, Math.PI * .15, Math.PI * .85); g.stroke();
    }
    // ---- หมวก ----
    if (wr.hat === 'straw') {
      ellP(g, 0, hy - 5.4, 13.6, side ? 3.6 : 4); paint(g, grad(g, hy - 9, hy - 1.5, '#e8c66a'));
      g.beginPath(); g.ellipse(0, hy - 6.4, 7.6, 6.4, 0, Math.PI, 0); g.closePath(); paint(g, grad(g, hy - 13, hy - 6, '#f0d27a'));
      g.fillStyle = hat; g.fillRect(-7.5, hy - 8.4, 15, 1.9); g.strokeStyle = 'rgba(150,110,40,.5)'; g.lineWidth = .35; g.beginPath(); for (let i = -10; i <= 10; i += 2.5) { g.moveTo(i, hy - 5.4 - 3); g.lineTo(i * 1.15, hy - 5.4 + 3); } g.stroke();
    } else if (wr.hat === 'cap') {
      g.beginPath(); g.ellipse(0, hy - 4.2, 10.6, 7.6, 0, Math.PI, 0); g.closePath(); paint(g, grad(g, hy - 12, hy - 4, hat));
      if (!back) { g.beginPath(); if (side) g.ellipse(9, hy - 4.2, 6, 1.6, 0, 0, Math.PI * 2); else g.ellipse(0, hy - 3.6, 11.5, 2.6, 0, 0, Math.PI); paint(g, shade(hat, -.2)); }
      ellP(g, 0, hy - 11.6, 1.1, .8); paint(g, shade(hat, -.3), null);
    }
    return cv;
  }

  const supported = wr => Object.keys(SUP).every(c => SUP[c].includes(wr[c]));
  function draw(ctx, p, now) {
    const wr = Object.assign({}, WEAR_DEFAULT, p.wear); if (!supported(wr)) return false;
    const t0 = performance.now(), dir = p.dir || 0, sit = !!p.sit;
    const ph = p.moving && !sit ? ((Math.floor((p.anim || 0) * 14 / (Math.PI * 2) * 8) % 8) + 8) % 8 : 0; // 8 เฟรมเดิน (ตัวพิกเซลมี 3)
    const col = p.color || '#3498db', hat = p.hat || '#e8c66a', pc = p.pc || PANTS_COLOR, d = dir === 2 ? 3 : dir;
    const key = [d, ph, sit ? 1 : 0, wr.shirt, wr.pants, wr.hat, col, hat, pc].join('|');
    let spr = cache.get(key);
    if (!spr) { const b0 = performance.now(); if (cache.size >= MAXC) cache.clear(); spr = build({ dir: d, ph, sit, wr, col, hat, pc }); cache.set(key, spr); st.builds++; st.buildMs += performance.now() - b0; }
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const y0 = p.y + 12 - OY;
    if (dir === 2) { ctx.translate(p.x, 0); ctx.scale(-1, 1); ctx.drawImage(spr, -OX, y0, VW, VH); } else ctx.drawImage(spr, p.x - OX, y0, VW, VH);
    ctx.restore(); st.draws++; st.drawMs += performance.now() - t0; return true;
  }

  function stats() { // ตัวชี้วัดต้นแบบ: เวลาสร้างสไปรต์ เวลาวาดต่อครั้ง หน่วยความจำแคช
    let px = 0; for (const c of cache.values()) px += c.width * c.height;
    return { sprites: cache.size, cacheMB: +(px * 4 / 1048576).toFixed(1), builds: st.builds, buildMsAvg: +(st.buildMs / (st.builds || 1)).toFixed(2), draws: st.draws, drawMsAvg: +(st.drawMs / (st.draws || 1)).toFixed(4), spritePx: VW * RES + '×' + VH * RES };
  }
  function sheet() { // ภาพเทียบ พิกเซลเดิม (แถวบน) กับ HD (แถวล่าง) 4 ทิศ × เดิน 4 จังหวะ ขยาย 3 เท่า → dataURL
    const c = document.createElement('canvas'), Z = 3, cw = 64; c.width = cw * 16 * Z; c.height = 2 * 80 * Z; const g = c.getContext('2d');
    g.fillStyle = '#8bbf5a'; g.fillRect(0, 0, c.width, c.height); g.scale(Z, Z);
    let i = 0; for (const dir of [0, 3, 1, 2]) for (const a of [0, .1, .22, .34]) {
      const p = { x: cw * i + cw / 2, y: 52, dir, moving: a > 0, anim: a, wear: { shirt: 'hoodie', pants: 'jeans', hat: 'straw', acc: 'none' }, color: '#e8734a' };
      orig(g, p, 0); draw(g, Object.assign({}, p, { y: 132 }), 0); i++;
    }
    return c.toDataURL();
  }

  const q = new URLSearchParams(location.search).get('hd');
  try { if (q === '1') localStorage.setItem('mw_hd', '1'); else if (q === '0') localStorage.removeItem('mw_hd'); } catch (e) {}
  let on = false; try { on = localStorage.getItem('mw_hd') === '1'; } catch (e) {}
  const orig = PixelChar.draw;
  if (on) PixelChar.draw = (ctx, p, now) => { if (!draw(ctx, p, now)) orig(ctx, p, now); };
  return { on, draw, stats, sheet, supported };
})();
window.__hd = HDChar;
