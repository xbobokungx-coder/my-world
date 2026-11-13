// ตัวละครพิกเซล chibi (เฟส 2, v2 เล็กและน่ารักขึ้น): หัวกว้างกว่าสูง ตาใหญ่มีประกาย แก้มแดง ตัวสั้นป้อม
// ประกอบจากชั้น ตัว/เสื้อ/กางเกง/ผม/หมวก/ของเสริมตามชุดที่สวม 1 พิกเซลศิลป์ = 2 พิกเซลเกม
// 4 ทิศ (ซ้ายคือภาพขวาที่พลิกกลับ) × 3 เฟรมเดิน × ท่านั่ง เก็บแคชตามชุด/สี
const PixelChar = (() => {
  const { mk, r, ell, shade } = PixelArt;
  const { WEAR_DEFAULT, PANTS_COLOR } = Shared;
  const S = ['#f5cfa0', '#dca878'], HAIR = ['#5b3a1e', '#3f2712', '#80552f'], EYE = '#2f2016', SHOE = '#3a2a1e', GOLD = '#e8c04a', PINK = '#f28f8f';
  const CW = 24, CH = 30, CX = 12, FB = 29; // กึ่งกลางแนวนอน = คอลัมน์ 12 (ขอบ) • เท้าอยู่ที่ขอบแถว 29
  const LONG = ['vest', 'hoodie', 'farmer', 'royal', 'sweater', 'chef', 'jacket', 'kimono'];
  const HY = 14; // แถวบนสุดของหัว

  function build(k) {
    const { dir, f, sit, wr, col, hat, pc, wing } = k;
    const back = dir === 1, side = dir >= 2, front = dir === 0;
    return mk(CW, CH, (x) => {
      const dk = c => shade(c, -.25), lt = c => shade(c, .4);
      const sk = wr.shirt, pk = wr.pants, hk = wr.hat, ak = wr.acc;
      if (sit) x.translate(0, 1);
      // ---- ของเสริมด้านหลัง ----
      const drawBack = () => {
        if (ak === 'wings') {
          for (const sd of [-1, 1]) { const cx = CX + sd * 7, h = 3 + wing; ell(x, cx, 24 - wing, 3, h, '#ffffff'); ell(x, cx + sd, 23 - wing, 1, Math.max(1, h - 2), '#cfe6ff'); }
        } else if (ak === 'cape') {
          r(x, hat, 8, 22, 8, 7); r(x, dk(hat), 8, 22, 2, 7); r(x, dk(hat), 8, 28, 8, 1); r(x, '#fff3b0', 11, 22, 2, 1);
        } else if (ak === 'backpack') {
          if (back) { r(x, hat, 8, 22, 8, 5); r(x, dk(hat), 8, 22, 8, 2); r(x, '#fff3b0', 11, 24, 2, 1); r(x, dk(hat), 8, 26, 8, 1); }
          else if (side) { r(x, hat, 6, 22, 3, 5); r(x, dk(hat), 6, 22, 3, 2); }
        }
      };
      if (!back) drawBack();
      // ---- ขา ----
      const lh = sit ? 1 : 3, top = 26, lc = pk === 'royal' ? GOLD : pc;
      const lL = lh - (f === 1 && !sit ? 1 : 0), lR = lh - (f === 2 && !sit ? 1 : 0);
      const wide = pk === 'hakama';
      const legs = side ? [[10 + (f === 1 ? -1 : f === 2 ? 1 : 0), 2, lL], [11 + (f === 2 ? -1 : f === 1 ? 1 : 0), 2, lR]]
        : wide ? [[8, 3, lL], [13, 3, lR]] : [[9, 2, lL], [13, 2, lR]];
      legs.forEach(([lx, w, h], i) => {
        const cl = side && i === 0 ? dk(lc) : lc;
        if (pk === 'shorts') { r(x, cl, lx, top, w, 1); r(x, S[0], lx, top + 1, w, h - 1); }
        else if (pk === 'skirt' || pk === 'plaid') r(x, S[0], lx, top + 1, w, h - 1);
        else {
          r(x, cl, lx, top, w, h); r(x, dk(cl), lx + w - 1, top, 1, h);
          if (pk === 'cargo') r(x, dk(lc), lx, top, w, 1);
          if (pk === 'jogger') { r(x, '#ffffff', lx, top, 1, h - 1); r(x, dk(lc), lx, top + h - 2, w, 1); }
          if (pk === 'royal') r(x, '#fff3b0', lx + 1, top, 1, h - 1);
          if (pk === 'hakama') r(x, dk(lc), lx + 1, top, 1, h);
        }
        r(x, SHOE, lx, top + h - 1, w + (side && i === 1 ? 1 : 0), 1);
      });
      // ---- ลำตัว ----
      const tx = side ? 10 : 9, tw = side ? 4 : 6;
      const body = sk === 'royal' ? GOLD : sk === 'farmer' || sk === 'vest' ? '#f4f4f4' : sk === 'sailor' || sk === 'chef' ? '#f6f6f6' : sk === 'jacket' ? shade(col, -.1) : col;
      r(x, body, tx, 22, tw, 4); r(x, dk(body), tx, 25, tw, 1); r(x, dk(body), tx + tw - 1, 22, 1, 4); r(x, lt(body), tx, 22, 1, 2);
      const fr = !back;
      if (sk === 'stripe') for (const yy of [23, 25]) r(x, dk(col), tx, yy, tw, 1);
      if (sk === 'dots') for (const [a, b] of [[1, 22], [3, 23], [1, 24], [4, 24]]) if (a < tw) r(x, '#ffffff', tx + a, b, 1, 1);
      if (sk === 'vest') { r(x, col, tx, 22, 2, 4); r(x, col, tx + tw - 2, 22, 2, 4); }
      if (sk === 'hoodie') { r(x, dk(col), tx, 22, tw, 1); r(x, dk(col), tx + 1, 24, tw - 2, 1); if (fr) { r(x, '#ffffff', tx + 1, 23, 1, 2); r(x, '#ffffff', tx + tw - 2, 23, 1, 2); } if (back) r(x, dk(col), tx + 1, 21, tw - 2, 1); }
      if (sk === 'farmer' && fr) { r(x, col, tx + 1, 24, tw - 2, 2); r(x, col, tx + 1, 22, 1, 2); r(x, col, tx + tw - 2, 22, 1, 2); r(x, '#fff3b0', tx + 2, 24, 1, 1); }
      if (sk === 'royal') { r(x, '#c0392b', tx, 24, tw, 1); if (fr) r(x, '#c0392b', tx + (tw >> 1) - 1, 22, 2, 4); r(x, '#ffffff', tx + 1, 23, 1, 1); r(x, '#ffffff', tx + tw - 2, 25, 1, 1); }
      if (sk === 'sailor') { r(x, col, tx, 22, tw, 1); r(x, col, tx, 24, tw, 1); if (fr) r(x, '#d63a2f', tx + (tw >> 1) - 1, 23, 2, 1); }
      if (sk === 'jersey') { r(x, '#ffffff', tx, 22, 1, 4); r(x, '#ffffff', tx + tw - 1, 22, 1, 4); r(x, '#ffffff', tx, 22, tw, 1); const nx = tx + (tw >> 1) - 1; r(x, '#ffffff', nx, 23, 2, 1); r(x, '#ffffff', nx + 1, 24, 1, 2); }
      if (sk === 'sweater') { for (const [a, b] of [[1, 23], [3, 23], [2, 24], [4, 24]]) if (a < tw) r(x, dk(col), tx + a, b, 1, 1); r(x, dk(col), tx, 22, tw, 1); }
      if (sk === 'chef') { r(x, '#cfcfcf', tx + (tw >> 1), 22, 1, 4); if (fr) { r(x, '#555555', tx + 1, 23, 1, 1); r(x, '#555555', tx + tw - 2, 24, 1, 1); } }
      if (sk === 'jacket') { r(x, dk(col), tx, 22, tw, 1); if (fr) { r(x, '#dcdcdc', tx + (tw >> 1), 23, 1, 3); r(x, dk(col), tx + 1, 24, 1, 1); r(x, dk(col), tx + tw - 2, 24, 1, 1); } }
      if (sk === 'kimono') { r(x, dk(col), tx, 22, tw >> 1, 4); if (fr) for (let i = 0; i < 3; i++) r(x, '#f6f6f6', tx + 1 + i, 22 + i, 1, 1); r(x, '#c0392b', tx, 24, tw, 1); if (fr) r(x, GOLD, tx + (tw >> 1) - 1, 24, 2, 1); }
      if (pk === 'skirt' || pk === 'plaid') {
        r(x, lc, 8, 25, 8, 1); r(x, lc, 7, 26, 10, 2); r(x, dk(lc), 7, 27, 10, 1); r(x, lt(lc), 8, 25, 3, 1);
        if (pk === 'plaid') { for (const xx of [9, 12, 14]) r(x, dk(lc), xx, 25, 1, 3); r(x, '#ffffff', 7, 26, 10, 1); }
      }
      if (pk === 'overall') { r(x, pc, tx + 1, 24, tw - 2, 2); r(x, dk(pc), tx + 1, 24, tw - 2, 1); r(x, pc, tx + 1, 22, 1, 2); r(x, pc, tx + tw - 2, 22, 1, 2); if (fr) r(x, '#fff3b0', tx + 1, 24, 1, 1); }
      // ---- แขน ----
      const long = LONG.includes(sk);
      const sleeve = long ? ({ royal: GOLD, hoodie: dk(col), vest: '#f4f4f4', farmer: '#f4f4f4', chef: '#f6f6f6', jacket: dk(col) }[sk] || col) : S[0];
      const kim = sk === 'kimono';
      const arm = (ax, ay, w) => { r(x, sleeve, ax, ay, w, 3); r(x, dk(sleeve), ax + w - 1, ay, 1, 3); if (long) r(x, S[0], ax, ay + 2, w, 1); if (kim) { r(x, col, ax - 1, ay, w + 1, 4); r(x, dk(col), ax - 1, ay + 3, w + 1, 1); } };
      if (side) arm(11 + (f === 1 ? -1 : f === 2 ? 1 : 0), 22, 2);
      else { arm(7, 22 + (f === 1 ? 1 : 0), 2); arm(15, 22 + (f === 2 ? 1 : 0), 2); }
      if (back) drawBack();
      // ---- ของเสริมที่คอ ----
      if (ak === 'scarf') { r(x, hat, tx - 1, 21, tw + 2, 2); r(x, dk(hat), tx - 1, 22, tw + 2, 1); if (!back) { r(x, hat, tx + tw - 2, 23, 2, 3); r(x, dk(hat), tx + tw - 2, 25, 2, 1); } }
      if (ak === 'bowtie' && !back) { const bx = side ? 12 : 10; r(x, '#d63a2f', bx, 22, 4, 2); r(x, '#8e1f17', bx + 1, 22, 2, 2); r(x, '#d63a2f', bx - 1, 21, 1, 1); r(x, '#d63a2f', bx + 4, 21, 1, 1); }
      if (ak === 'lei' && !back) { const cs = ['#ff7eb6', '#ffd24a', '#ffffff', '#ff9a3c', '#9be36b']; const n = side ? 4 : 6; for (let i = 0; i < n; i++) r(x, cs[i % 5], (side ? 10 : 9) + i, 22 + (i === 0 || i === n - 1 ? 0 : 1), 1, 1); }
      if (ak === 'backpack' && !back && !side) { r(x, dk(hat), 9, 22, 1, 4); r(x, dk(hat), 14, 22, 1, 4); }
      // ---- หัว (กว้าง 10 สูง 8) ----
      r(x, S[0], 8, HY, 8, 1); r(x, S[0], 7, HY + 1, 10, 6); r(x, S[0], 8, HY + 7, 8, 1);
      r(x, S[1], 16, HY + 1, 1, 6); r(x, S[1], 8, HY + 7, 8, 1);
      if (side) r(x, S[0], 17, HY + 4, 1, 2);
      // ผม
      if (back) {
        r(x, HAIR[0], 8, HY, 8, 1); r(x, HAIR[0], 7, HY + 1, 10, 6); r(x, HAIR[1], 7, HY + 6, 10, 1); r(x, HAIR[2], 9, HY + 1, 3, 1); r(x, HAIR[1], 11, HY + 3, 1, 3); r(x, HAIR[1], 14, HY + 3, 1, 3);
      } else if (side) {
        r(x, HAIR[0], 8, HY, 8, 1); r(x, HAIR[0], 7, HY + 1, 10, 2); r(x, HAIR[0], 7, HY + 3, 5, 4); r(x, HAIR[1], 7, HY + 6, 5, 1); r(x, HAIR[0], 12, HY + 2, 5, 1); r(x, HAIR[0], 12, HY + 3, 2, 1); r(x, HAIR[2], 9, HY + 1, 3, 1);
      } else {
        r(x, HAIR[0], 8, HY, 8, 1); r(x, HAIR[0], 7, HY + 1, 10, 1); r(x, HAIR[0], 7, HY + 2, 4, 1); r(x, HAIR[0], 13, HY + 2, 4, 1); r(x, HAIR[0], 7, HY + 3, 2, 2); r(x, HAIR[0], 15, HY + 3, 2, 2); r(x, HAIR[2], 9, HY + 1, 3, 1); r(x, HAIR[1], 11, HY + 2, 2, 1);
      }
      // หน้า: ตาโตมีประกาย แก้มแดง ปากเล็ก
      if (!back) {
        const ex = side ? [13] : [9, 13];
        for (const e of ex) { r(x, EYE, e, HY + 3, 2, 3); r(x, '#ffffff', e, HY + 3, 1, 1); r(x, '#6a4a3a', e + 1, HY + 5, 1, 1); }
        if (side) { r(x, PINK, 11, HY + 6, 2, 1); r(x, '#a8453a', 15, HY + 6, 1, 1); }
        else { r(x, PINK, 8, HY + 6, 1, 1); r(x, PINK, 15, HY + 6, 1, 1); r(x, '#a8453a', 11, HY + 6, 2, 1); }
        if (ak === 'glasses' || ak === 'shades') {
          const sh = ak === 'shades';
          const lens = side ? [12] : [8, 12];
          for (const lx of lens) {
            if (sh) { r(x, '#15151f', lx, HY + 2, 4, 4); r(x, '#ffffff', lx + 1, HY + 3, 1, 1); }
            else { const c = '#b07a3a'; r(x, c, lx, HY + 2, 4, 1); r(x, c, lx, HY + 6, 4, 1); r(x, c, lx, HY + 3, 1, 3); r(x, c, lx + 3, HY + 3, 1, 3); }
          }
        }
      }
      if (ak === 'headphones') {
        r(x, dk(hat), 7, HY - 1, 10, 1); r(x, dk(hat), 6, HY, 1, 4); r(x, dk(hat), 17, HY, 1, 4);
        if (side) { r(x, hat, 10, HY + 2, 4, 4); r(x, dk(hat), 10, HY + 2, 1, 4); }
        else { r(x, hat, 5, HY + 3, 2, 4); r(x, hat, 17, HY + 3, 2, 4); r(x, dk(hat), 5, HY + 3, 1, 4); r(x, dk(hat), 17, HY + 6, 2, 1); }
      }
      // ---- หมวก ----
      const hdk = dk(hat);
      if (hk === 'straw') { r(x, hat, 3, HY - 2, 18, 2); r(x, hdk, 3, HY - 1, 18, 1); r(x, hat, 8, HY - 5, 8, 3); r(x, hdk, 8, HY - 3, 8, 1); r(x, lt(hat), 9, HY - 5, 3, 1); }
      else if (hk === 'cap') { r(x, hat, 7, HY - 3, 10, 4); r(x, hat, 8, HY - 4, 8, 1); r(x, lt(hat), 9, HY - 4, 3, 1); r(x, hdk, 7, HY, 10, 1); if (front) r(x, hdk, 8, HY + 1, 8, 1); else if (side) { r(x, hdk, 17, HY, 4, 1); r(x, hat, 17, HY - 1, 3, 1); } else r(x, hdk, 11, HY - 5, 2, 1); }
      else if (hk === 'beanie') { r(x, hat, 7, HY - 3, 10, 5); r(x, hat, 8, HY - 4, 8, 1); r(x, lt(hat), 9, HY - 4, 3, 1); r(x, hdk, 7, HY, 10, 2); for (let i = 7; i < 17; i += 2) r(x, shade(hdk, -.2), i, HY, 1, 2); r(x, '#ffffff', 11, HY - 6, 2, 2); }
      else if (hk === 'party') { for (let i = 0; i < 10; i++) { const w = Math.max(2, 10 - i); r(x, hat, 12 - (w >> 1), HY - 1 - i, w, 1); } r(x, hdk, 7, HY - 1, 10, 1); for (const [a, b] of [[11, 3], [13, 5], [12, 7], [14, 2]]) r(x, '#ffffff', a, HY - b, 1, 1); r(x, '#ffd24a', 11, HY - 12, 2, 2); }
      else if (hk === 'flower') { r(x, '#3f9a3a', 7, HY - 1, 10, 2); for (const [a, b] of [[8, -2], [11, -3], [14, -3], [16, -2]]) { r(x, hat, a - 1, HY + b, 3, 2); r(x, '#ffe66d', a, HY + b, 1, 1); } }
      else if (hk === 'cowboy') { r(x, hat, 3, HY - 2, 18, 2); r(x, hat, 2, HY - 3, 2, 1); r(x, hat, 20, HY - 3, 2, 1); r(x, hdk, 4, HY - 1, 16, 1); r(x, hat, 8, HY - 6, 8, 4); r(x, hdk, 8, HY - 3, 8, 1); r(x, '#fff3b0', 11, HY - 3, 2, 1); r(x, lt(hat), 9, HY - 6, 3, 1); r(x, hat, 9, HY - 7, 6, 1); }
      else if (hk === 'crown') { r(x, GOLD, 8, HY - 4, 8, 4); for (const a of [8, 10, 13, 15]) r(x, GOLD, a, HY - 6, 1, 2); r(x, '#fff3b0', 8, HY - 4, 8, 1); r(x, '#c9932c', 8, HY - 1, 8, 1); r(x, '#e74c3c', 11, HY - 3, 2, 2); r(x, '#3498db', 9, HY - 3, 1, 1); r(x, '#3498db', 14, HY - 3, 1, 1); }
      else if (hk === 'headband') { r(x, hat, 7, HY + 1, 10, 2); r(x, hdk, 7, HY + 2, 10, 1); if (!front) r(x, hat, side ? 6 : 8, HY + 3, 2, 3); }
      else if (hk === 'chef') { r(x, '#ffffff', 6, HY - 7, 12, 6); r(x, '#ffffff', 8, HY - 9, 8, 3); r(x, '#dcdcdc', 7, HY - 1, 10, 2); for (const [a, b] of [[8, -5], [13, -7], [16, -4]]) r(x, '#e6e6e6', a, HY + b, 1, 2); }
      else if (hk === 'bunny') { for (const ex2 of [8, 13]) { r(x, '#ffffff', ex2, HY - 10, 3, 9); r(x, '#ffb6c8', ex2 + 1, HY - 8, 1, 6); } r(x, hat, 7, HY, 10, 1); }
      else if (hk === 'wizard') { r(x, hat, 3, HY - 2, 18, 2); r(x, hdk, 3, HY - 1, 18, 1); for (let i = 0; i < 12; i++) { const w = Math.max(2, 8 - (i * .7 | 0)); r(x, hat, 12 - (w >> 1) + (i > 8 ? 1 : 0), HY - 3 - i, w, 1); } r(x, hdk, 8, HY - 3, 8, 1); for (const [a, b] of [[11, 5], [14, 8], [12, 10]]) r(x, '#fff6a0', a, HY - b, 1, 1); }
      else if (hk === 'miner') { r(x, '#f1c40f', 6, HY - 3, 12, 4); r(x, '#f1c40f', 8, HY - 4, 8, 1); r(x, '#d4a90c', 5, HY, 14, 1); r(x, '#d4a90c', 11, HY - 5, 2, 5); r(x, '#fffbe0', 11, HY - 3, 2, 2); r(x, '#ffffff', 11, HY - 3, 1, 1); }
      else if (hk === 'pirate') { r(x, '#25252d', 4, HY - 1, 16, 2); r(x, '#25252d', 6, HY - 4, 12, 3); r(x, '#25252d', 9, HY - 6, 6, 2); r(x, hat, 6, HY - 2, 12, 1); r(x, '#ffffff', 11, HY - 4, 2, 2); r(x, '#25252d', 11, HY - 2, 2, 1); }
    });
  }

  const cache = new Map();
  function draw(ctx, p, now) {
    const dir = p.dir || 0, sit = !!p.sit;
    const wr = Object.assign({}, WEAR_DEFAULT, p.wear);
    const s = p.moving && !sit ? Math.sin((p.anim || 0) * 14) : 0, f = s > .35 ? 1 : s < -.35 ? 2 : 0;
    const wing = wr.acc === 'wings' ? Math.max(0, Math.min(2, Math.round(1 + Math.sin(now / 170) * (p.moving ? 1 : .5)))) : 0;
    const col = p.color || '#3498db', hat = p.hat || '#e8c66a', pc = p.pc || PANTS_COLOR;
    const key = [dir === 2 ? 3 : dir, f, sit ? 1 : 0, wr.shirt, wr.pants, wr.hat, wr.acc, col, hat, pc, wing].join('|');
    let spr = cache.get(key);
    if (!spr) { if (cache.size > 400) cache.clear(); spr = build({ dir: dir === 2 ? 3 : dir, f, sit, wr, col, hat, pc, wing }); cache.set(key, spr); }
    ctx.imageSmoothingEnabled = false;
    const w = spr.width * 2, h = spr.height * 2, y0 = p.y + 12 - (FB + 1) * 2, x0 = (CX + 1) * 2;
    if (dir === 2) { ctx.save(); ctx.translate(p.x, 0); ctx.scale(-1, 1); ctx.drawImage(spr, -x0, y0, w, h); ctx.restore(); }
    else ctx.drawImage(spr, p.x - x0, y0, w, h);
    if (wr.hat === 'miner') { ctx.fillStyle = 'rgba(255,240,150,.28)'; const hx = p.x + (dir === 2 ? -2 : dir === 3 ? 2 : 0), hy2 = y0 + (HY - 3 + 1) * 2 + 2 + (sit ? 2 : 0); ctx.fillRect(hx - 6, hy2 - 8, 12, 12); ctx.fillRect(hx - 8, hy2 - 4, 16, 4); }
  }
  return { draw, CW, CH };
})();

// ยานพาหนะของตัวละคร (จักรยาน มอเตอร์ไซค์ รถเปิดประทุน): สไปรต์ 4 ทิศ × 4 เฟรมล้อหมุน ซ้ายคือภาพขวาพลิกกลับ
// ชั้นวาด: หลัง (ตัวถัง/ล้อหลัง) → ตัวละครนั่งท่านั่ง → หน้า (ขาปั่น/แฮนด์/มือจับ/กระโปรงรถ) • ควัน/ฝุ่นวาดแบบเลื่อนตามเวลา (ไม่เก็บสถานะ)
const PixelVehicle = (() => {
  const { mk, r, ell, shade, ramp, hue } = PixelArt;
  const INK = ['#2a1b14', '#5a4a3a'], TIRE = '#262a33', RIM = '#c9d3dc', RIM2 = '#8d99a6';
  const SC = 2; // 1 พิกเซลศิลป์ = 2 พิกเซลเกม
  function line(x, c, x0, y0, x1, y1) { // Bresenham 1 px
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    x.fillStyle = c;
    for (let n = 0; n < 200; n++) { x.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function wheel(x, cx, cy, rad, fr, hub = '#e8c04a') { // ล้อมองข้าง: ยาง → ขอบ → ซี่ 2 ก้านหมุนตามเฟรม (22.5° ต่อเฟรม)
    for (let dy = -rad - 1; dy <= rad + 1; dy++) for (let dx = -rad - 1; dx <= rad + 1; dx++) { const d = Math.hypot(dx, dy); if (d <= rad + .35) r(x, d > rad - 1 ? TIRE : RIM2, Math.round(cx + dx), Math.round(cy + dy), 1, 1); }
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (Math.hypot(dx, dy) <= rad - 1.1) r(x, '#9aa5ad', Math.round(cx + dx), Math.round(cy + dy), 1, 1);
    const a = fr * Math.PI / 8; for (const k of [0, 1]) { const ax = Math.cos(a + k * Math.PI / 2) * (rad - 1.2), ay = Math.sin(a + k * Math.PI / 2) * (rad - 1.2); line(x, '#e8eef2', cx - ax, cy - ay, cx + ax, cy + ay); }
    r(x, hub, Math.round(cx), Math.round(cy), 1, 1);
  }
  const soft = { soft: INK };
  // ---- จักรยาน ----
  function bikeSide(fr, pc, idle, sc) { // หันขวา กว้าง 30 สูง 16 พื้นอยู่แถว 15 • ที่นั่งสะโพก (10,5)
    const F = ramp('#d94a3a', .3, .22), W = 30, H = 16;
    const back = mk(W, H, (x) => {
      wheel(x, 6, 12, 3.5, fr); wheel(x, 23, 12, 3.5, fr);
      r(x, 'rgba(26,28,44,.22)', 5, 15, 20, 1);
      // เฟรม: ท่อนั่ง/ท่อบน/ท่อล่าง/โซ่สเตย์/ขาตะเกียบ
      line(x, F[2], 13, 12, 10, 5); line(x, F[2], 10, 5, 20, 5); line(x, F[2], 20, 5, 21, 8); line(x, F[1], 13, 12, 20, 8); line(x, F[3], 13, 12, 6, 12); line(x, F[2], 10, 5, 6, 12); line(x, F[2], 21, 8, 23, 12);
      r(x, F[4], 11, 5, 8, 1);
      r(x, '#8a8f99', 12, 12, 3, 1); r(x, '#c9d3dc', 12, 12, 1, 1); // ศูนย์กลางแป้นเหยียบ + โซ่
      line(x, '#6a6f7a', 13, 13, 6, 13);
      r(x, '#3a2418', 7, 4, 5, 1); r(x, '#6e4524', 7, 3, 5, 1); r(x, '#a8703a', 8, 3, 2, 1); // เบาะ
      // ตะกร้าหน้า
      r(x, '#7a4a22', 24, 2, 6, 5); r(x, '#d9a441', 24, 2, 6, 1); r(x, '#e8c066', 25, 3, 5, 1); r(x, '#b8832e', 24, 4, 6, 1); r(x, '#b8832e', 24, 6, 6, 1);
      for (let xx = 25; xx < 30; xx += 2) r(x, '#9a6a24', xx, 3, 1, 4);
      r(x, '#5fa844', 25, 1, 2, 1); r(x, '#ff8fc7', 26, 0, 1, 1); r(x, '#ffd23f', 28, 1, 1, 1);
      r(x, '#4a4f5a', 20, 1, 1, 4); r(x, '#4a4f5a', 19, 1, 4, 1); r(x, '#e8c04a', 22, 1, 1, 1); // แฮนด์ + กริ่งเล็ก
    }, soft);
    const ang = idle ? 0 : fr * Math.PI / 2 * .5; // แป้นเหยียบหมุนตามเฟรม (ครึ่งรอบต่อ 4 เฟรม ล้อเลยหมุนช้ากว่าขา ดูปั่นเป็นจังหวะ)
    const front = mk(W, H, (x) => {
      const px1 = 13 + Math.cos(ang) * 3, py1 = 12 + Math.sin(ang) * 2.6, px2 = 13 - Math.cos(ang) * 3, py2 = 12 - Math.sin(ang) * 2.6;
      const leg = (px, py, far) => { const c = far ? shade(pc, -.3) : pc; line(x, c, 10, 6, px, py - 1); line(x, c, 11, 6, px + 1, py - 1); r(x, '#3a2a1e', Math.round(px), Math.round(py), 3, 1); r(x, '#6a4a3a', Math.round(px) + 1, Math.round(py) - 1, 1, 1); };
      if (idle) { line(x, pc, 10, 6, 12, 11); line(x, pc, 11, 6, 13, 11); r(x, '#3a2a1e', 12, 12, 3, 1); } else { leg(px2, py2, true); leg(px1, py1, false); }
      line(x, sc, 11, 2, 18, 2); line(x, shade(sc, -.2), 11, 3, 18, 3); r(x, '#f5cfa0', 19, 2, 2, 2); r(x, '#dca878', 19, 3, 2, 1); // แขนเสื้อยื่นไปจับแฮนด์ + มือ
    }, soft);
    return { back, front, seat: { x: 11, y: 6 }, ax: 15, ay: 16, lift: 6 };
  }
  function bikeFront(fr, pc, idle, rear) { // ล้อหน้า/หลังตั้งตรง กว้าง 12 สูง 16 พื้น 15 • ที่นั่ง (6,5)
    const F = ramp('#d94a3a', .3, .22), W = 12, H = 16;
    const back = mk(W, H, (x) => { r(x, 'rgba(26,28,44,.22)', 3, 15, 7, 1); if (rear) { r(x, F[1], 5, 3, 2, 7); } }, soft);
    const front = mk(W, H, (x) => {
      // ล้อมองตรง: ยางสูง 8 กว้าง 3 มีซี่ไล่ขึ้นลงตามเฟรม
      r(x, TIRE, 5, 8, 3, 8); r(x, RIM2, 6, 9, 1, 6); r(x, '#e8eef2', 6, 9 + (fr % 4) * 2 % 6, 1, 1); r(x, '#e8eef2', 6, 12 + (fr % 3), 1, 1);
      r(x, F[2], 5, 6, 3, 2); r(x, F[4], 5, 6, 1, 1); // ตะเกียบ/บังโคลน
      if (!rear) { r(x, F[2], 5, 3, 3, 4); r(x, F[1], 7, 3, 1, 4); r(x, '#4a4f5a', 0, 2, 12, 1); r(x, '#2a2d36', 0, 1, 2, 2); r(x, '#2a2d36', 10, 1, 2, 2); // แฮนด์ + กริป
        r(x, '#d9a441', 3, 4, 6, 4); r(x, '#e8c066', 3, 4, 6, 1); r(x, '#9a6a24', 3, 7, 6, 1); r(x, '#ffe08a', 5, 3, 2, 1); // ตะกร้าหน้า + ไฟ
      } else { r(x, '#c0392b', 5, 7, 3, 1); r(x, '#ff6b5a', 6, 7, 1, 1); r(x, '#7a4a22', 3, 4, 6, 3); r(x, '#d9a441', 3, 4, 6, 1); }
      if (!idle) { const k = fr % 2; r(x, pc, 2, 5 + k, 3, 2); r(x, pc, 7, 6 - k, 3, 2); r(x, '#3a2a1e', 2, 7 + k, 3, 1); r(x, '#3a2a1e', 7, 8 - k, 3, 1); }
      else { r(x, pc, 3, 5, 2, 4); r(x, pc, 7, 5, 2, 4); r(x, '#3a2a1e', 3, 9, 2, 1); r(x, '#3a2a1e', 7, 9, 2, 1); }
    }, soft);
    return { back, front, seat: { x: 6, y: 5 }, ax: 7, ay: 16, lift: 6 };
  }
  // ---- มอเตอร์ไซค์สกูตเตอร์ ----
  function scooterSide(fr, pc, idle, sc) { // หันขวา กว้าง 32 สูง 18 พื้น 17 • ที่นั่ง (10,6)
    const B = ramp('#3fbf9f', .3, .22), W = 32, H = 18;
    const back = mk(W, H, (x) => {
      wheel(x, 6, 14, 3, fr, '#c9d3dc'); wheel(x, 25, 14, 3, fr, '#c9d3dc');
      r(x, 'rgba(26,28,44,.22)', 4, 17, 24, 1);
      // ท่อไอเสีย
      r(x, '#6a6f7a', 1, 12, 5, 2); r(x, '#a3a8b2', 1, 12, 5, 1); r(x, '#3a3f4a', 1, 13, 1, 1);
      // ตัวถังท้าย (โค้งมน) + ฝาข้าง
      r(x, B[2], 4, 8, 11, 6); r(x, B[2], 5, 7, 9, 1); r(x, B[3], 5, 8, 9, 1); r(x, B[4], 6, 7, 4, 1); r(x, B[1], 4, 13, 11, 1); r(x, B[0], 4, 14, 11, 1); r(x, B[1], 13, 8, 2, 5);
      r(x, B[3], 6, 10, 5, 1); r(x, '#e8eef2', 7, 11, 3, 1); // แผ่นโลโก้
      // พื้นวางเท้า + กันชนใต้
      r(x, B[1], 14, 13, 6, 2); r(x, B[0], 14, 15, 6, 1); r(x, '#4a4f5a', 15, 12, 5, 1);
      // เบาะ
      r(x, '#2a2d36', 6, 5, 8, 2); r(x, '#4a4f5a', 6, 5, 8, 1); r(x, '#6a6f7a', 7, 5, 3, 1);
      // บังโคลนหน้า + คอแฮนด์ + หน้ากาก
      r(x, B[2], 21, 6, 4, 8); r(x, B[3], 21, 6, 1, 8); r(x, B[1], 24, 6, 1, 8); r(x, B[2], 22, 4, 3, 2); r(x, B[3], 22, 4, 1, 2);
      r(x, B[1], 24, 12, 4, 2); r(x, B[3], 24, 12, 4, 1);
      r(x, '#fff3b0', 25, 8, 3, 2); r(x, '#ffffff', 25, 8, 1, 1); r(x, '#ffd23f', 27, 8, 1, 2); // ไฟหน้า
      r(x, '#e74c3c', 4, 9, 1, 2); // ไฟท้าย
      line(x, '#4a4f5a', 23, 4, 23, 1); r(x, '#2a2d36', 20, 1, 5, 1); r(x, '#e8eef2', 24, 0, 2, 1); r(x, '#8fd0f0', 25, 0, 1, 1); // แฮนด์ + กระจกมองข้าง
    }, soft);
    const front = mk(W, H, (x) => { // ขาพับวางบนพื้นวางเท้า
      line(x, pc, 11, 7, 17, 7); line(x, pc, 11, 8, 17, 8); line(x, pc, 17, 8, 18, 12); line(x, pc, 18, 8, 19, 12); r(x, '#3a2a1e', 17, 13, 4, 1); r(x, '#6a4a3a', 18, 12, 1, 1);
      line(x, sc, 13, 3, 20, 2); line(x, shade(sc, -.2), 13, 4, 20, 3); r(x, '#f5cfa0', 21, 1, 2, 3); r(x, '#dca878', 21, 3, 2, 1); // แขนเสื้อจับแฮนด์ + มือ
    }, soft);
    return { back, front, seat: { x: 11, y: 7 }, ax: 16, ay: 18, lift: 5, puff: [2, 13] };
  }
  function scooterFront(fr, pc, idle, rear) { // กว้าง 14 สูง 18 พื้น 17 • ที่นั่ง (7,6)
    const B = ramp('#3fbf9f', .3, .22), W = 14, H = 18;
    const back = mk(W, H, (x) => { r(x, 'rgba(26,28,44,.22)', 3, 17, 8, 1); if (rear) { r(x, B[2], 3, 8, 8, 6); r(x, B[3], 3, 8, 2, 6); r(x, B[1], 9, 8, 2, 6); r(x, '#e74c3c', 4, 10, 2, 1); r(x, '#e74c3c', 8, 10, 2, 1); r(x, '#ff6b5a', 4, 10, 1, 1); } }, soft);
    const front = mk(W, H, (x) => {
      r(x, TIRE, 6, 11, 3, 7); r(x, '#c9d3dc', 7, 12, 1, 5); r(x, '#ffffff', 7, 12 + (fr % 3) * 2 % 4, 1, 1);
      if (rear) { r(x, TIRE, 6, 12, 3, 6); r(x, '#6a6f7a', 5, 13, 1, 3); r(x, '#a3a8b2', 5, 13, 1, 1); r(x, '#2a2d36', 5, 6, 5, 1); r(x, '#4a4f5a', 5, 6, 5, 1); }
      else { r(x, B[2], 3, 6, 8, 7); r(x, B[3], 3, 6, 2, 7); r(x, B[1], 9, 6, 2, 7); r(x, B[0], 3, 12, 8, 1); r(x, '#fff3b0', 5, 8, 4, 3); r(x, '#ffffff', 5, 8, 1, 1); r(x, '#ffd23f', 8, 9, 1, 2);
        r(x, '#2a2d36', 0, 4, 14, 1); r(x, '#4a4f5a', 0, 3, 3, 2); r(x, '#4a4f5a', 11, 3, 3, 2); r(x, '#8fd0f0', 0, 1, 2, 2); r(x, '#8fd0f0', 12, 1, 2, 2); r(x, '#e8eef2', 0, 1, 1, 1); } // แฮนด์ + กระจกข้าง
      if (idle) { r(x, pc, 3, 7, 3, 5); r(x, pc, 8, 7, 3, 5); r(x, '#3a2a1e', 3, 12, 3, 1); r(x, '#3a2a1e', 8, 12, 3, 1); }
      else { r(x, pc, 3, 6, 3, 6); r(x, pc, 8, 6, 3, 6); r(x, '#3a2a1e', 3, 12, 3, 1); r(x, '#3a2a1e', 8, 12, 3, 1); }
    }, soft);
    return { back, front, seat: { x: 7, y: 6 }, ax: 7, ay: 18, lift: 5, puff: [7, 14] };
  }
  // ---- รถยนต์เปิดประทุนสีแดง ----
  function carSide(fr, pc, idle) { // หันขวา กว้าง 38 สูง 20 พื้น 19 • ที่นั่ง (16,9)
    const B = ramp('#d8402f', .3, .22), W = 38, H = 20;
    const back = mk(W, H, (x) => {
      r(x, 'rgba(26,28,44,.25)', 3, 19, 32, 1);
      // ตัวถัง: ใต้ท้อง → ข้างรถ → ฝากระโปรง/ท้าย
      r(x, '#2a2d36', 5, 15, 28, 2);
      r(x, B[2], 2, 8, 34, 8); r(x, B[3], 3, 8, 32, 1); r(x, B[4], 5, 8, 10, 1); r(x, B[1], 2, 13, 34, 2); r(x, B[0], 2, 15, 34, 1);
      r(x, B[3], 24, 7, 11, 1); r(x, B[2], 25, 6, 9, 1); r(x, B[3], 25, 6, 3, 1); // ฝากระโปรงหน้าสูง
      r(x, B[1], 2, 8, 2, 8); r(x, B[3], 35, 9, 1, 6); // ขอบท้าย/หน้า
      r(x, '#f1c40f', 31, 10, 4, 2); r(x, '#fff3b0', 32, 10, 3, 1); r(x, '#ffffff', 34, 10, 1, 1); // ไฟหน้า
      r(x, '#a82f23', 2, 10, 2, 2); r(x, '#ff6b5a', 2, 10, 1, 1); // ไฟท้าย
      r(x, '#c9d3dc', 36, 13, 2, 3); r(x, '#8d99a6', 36, 15, 2, 1); r(x, '#c9d3dc', 1, 14, 2, 2); // กันชน
      r(x, '#e8eef2', 11, 12, 12, 1); r(x, B[0], 11, 13, 12, 1); // เส้นข้างรถ
      r(x, '#2a1b14', 17, 9, 1, 5); r(x, '#fff3b0', 16, 10, 1, 1); // รอยประตู + มือจับ
      r(x, '#4a4f5a', 1, 16, 3, 1); // ท่อไอเสียท้าย
      wheel(x, 9, 16, 3.5, fr, '#e8c04a'); wheel(x, 29, 16, 3.5, fr, '#e8c04a'); // ล้อ (ทับขอบตัวถัง)
      // เบาะหลังใน cockpit
      r(x, '#6e2f22', 5, 5, 8, 3); r(x, '#9a4a38', 5, 5, 8, 1); r(x, '#6e2f22', 14, 7, 9, 1);
    }, soft);
    const front = mk(W, H, (x) => {
      // กระจกบังลมเอียง + เบาะหน้าด้านใน (ทับตัวละครช่วงล่าง) ขอบประตูตัดกับสะโพก
      r(x, B[2], 14, 8, 10, 3); r(x, B[3], 14, 8, 10, 1); r(x, B[1], 14, 10, 10, 1);
      r(x, '#8fd0f0', 24, 3, 1, 4); r(x, '#cfeeff', 24, 3, 1, 2); line(x, '#c9d3dc', 23, 7, 26, 3); r(x, '#6a6f7a', 23, 7, 1, 1);
      r(x, '#cfeeff', 25, 3, 2, 1);
    }, soft);
    return { back, front, seat: { x: 17, y: 8 }, ax: 19, ay: 20, lift: 6, puff: [2, 16], hands: { x: 21, y: 4 } };
  }
  function carFront(fr, pc, idle, rear) { // กว้าง 24 สูง 22 พื้น 21 • ที่นั่ง (12,8)
    const B = ramp('#d8402f', .3, .22), W = 24, H = 22;
    const back = mk(W, H, (x) => { r(x, 'rgba(26,28,44,.25)', 3, 21, 18, 1);
      if (!rear) { r(x, '#6e2f22', 6, 6, 12, 5); r(x, '#9a4a38', 6, 6, 12, 1); } // เบาะ/ห้องโดยสารข้างหลังคนขับ
    }, soft);
    const front = mk(W, H, (x) => {
      // ล้อมองตรง (2 ข้าง) + ตัวถังหน้า/หลัง + กันชน
      r(x, TIRE, 1, 13, 4, 8); r(x, TIRE, 19, 13, 4, 8); r(x, RIM2, 2, 14, 2, 6); r(x, RIM2, 20, 14, 2, 6); r(x, '#e8eef2', 2, 14 + (fr % 3) * 2, 2, 1); r(x, '#e8eef2', 20, 14 + (fr % 3) * 2, 2, 1);
      if (!rear) {
        r(x, B[2], 3, 7, 18, 12); r(x, B[3], 3, 7, 18, 1); r(x, B[4], 5, 7, 5, 1); r(x, B[1], 17, 8, 4, 11); r(x, B[0], 3, 18, 18, 1); r(x, B[3], 3, 8, 2, 10); // ฝากระโปรง + ข้าง
        r(x, '#2a2d36', 8, 13, 8, 4); r(x, '#4a4f5a', 8, 13, 8, 1); for (let xx = 9; xx < 16; xx += 2) r(x, '#6a6f7a', xx, 14, 1, 3); // กระจังหน้า
        r(x, '#fff3b0', 4, 11, 4, 3); r(x, '#ffffff', 4, 11, 1, 1); r(x, '#ffd23f', 7, 12, 1, 2); r(x, '#fff3b0', 16, 11, 4, 3); r(x, '#ffd23f', 19, 12, 1, 2); // ไฟหน้า
        r(x, '#c9d3dc', 4, 19, 16, 2); r(x, '#8d99a6', 4, 20, 16, 1); r(x, '#ffffff', 5, 19, 4, 1); // กันชนหน้า
        r(x, '#8fd0f0', 4, 4, 16, 3); r(x, '#cfeeff', 5, 4, 7, 1); r(x, '#c9d3dc', 3, 4, 1, 4); r(x, '#c9d3dc', 20, 4, 1, 4); r(x, '#6a6f7a', 3, 7, 18, 1); // กระจกบังลม
      } else {
        r(x, B[2], 3, 7, 18, 12); r(x, B[3], 3, 7, 18, 1); r(x, B[1], 17, 8, 4, 11); r(x, B[0], 3, 18, 18, 1);
        r(x, '#a82f23', 4, 11, 4, 3); r(x, '#ff6b5a', 4, 11, 2, 1); r(x, '#a82f23', 16, 11, 4, 3); r(x, '#ff6b5a', 16, 11, 2, 1); // ไฟท้าย
        r(x, '#e8eef2', 9, 12, 6, 3); r(x, '#6a6f7a', 9, 12, 6, 1); r(x, '#4a4f5a', 10, 13, 4, 1); // ป้ายทะเบียน
        r(x, '#c9d3dc', 4, 19, 16, 2); r(x, '#8d99a6', 4, 20, 16, 1);
        r(x, '#4a4f5a', 17, 20, 2, 1); // ท่อไอเสีย
      }
    }, soft);
    return { back, front, seat: { x: 12, y: 8 }, ax: 12, ay: 22, lift: 6, puff: [18, 21], steer: !rear };
  }
  const BUILD = {
    bike: (d, fr, pc, idle, sc) => d >= 2 ? bikeSide(fr, pc, idle, sc) : bikeFront(fr, pc, idle, d === 1),
    scooter: (d, fr, pc, idle, sc) => d >= 2 ? scooterSide(fr, pc, idle, sc) : scooterFront(fr, pc, idle, d === 1),
    car: (d, fr, pc, idle) => d >= 2 ? carSide(fr, pc, idle) : carFront(fr, pc, idle, d === 1),
  };
  const cache = new Map();
  function sprite(kind, dir, fr, pc, idle, sc) {
    const d = dir === 2 ? 3 : dir, key = [kind, d, fr, kind === 'car' ? '' : pc + sc, idle ? 1 : 0].join('|');
    let s = cache.get(key); if (!s) { if (cache.size > 300) cache.clear(); s = BUILD[kind](d, fr, pc, idle, sc); cache.set(key, s); }
    return s;
  }
  // จักรยานสไปรต์ AI (PixelLab 12 พ.ย. 2026): คนปั่นทั้งตัวจากชีต public/pack/bike-rider.png (ช่อง 96×96 แถว 1 ใต้ 2 ตะวันออก 3 เหนือ แถว 0 คือภาพนิ่ง 8 ทิศ ไม่ใช้) ตะวันตกพลิกจากตะวันออก • ภาพยังไม่โหลด/โหลดไม่ได้ → ใช้จักรยานวาดด้วยโค้ดเดิม
  const BikeAI = (() => {
    const img = new Image(); let ok = false; img.onload = () => { ok = true; }; img.src = 'pack/bike-rider.png';
    const CELL = 96, ROWS = { 0: [1, 9, 46], 1: [3, 9, 48], 2: [2, 5, 48], 3: [2, 5, 48] }, FOOT = 84, S = 0.75; // dir → [แถว, จำนวนเฟรม, x กลางตัวในช่อง] • FOOT = แถวพื้นใต้ล้อ
    const ready = () => ok && img.naturalWidth >= CELL * 9;
    function draw(ctx, p, now) {
      if (!ready()) return false;
      const dir = p.dir || 0, moving = !!p.moving, [row, n, cx] = ROWS[dir] || ROWS[0], f = moving ? Math.floor((p.anim || 0) * 10) % n : 0;
      const gx = Math.round(p.x), gy = Math.round(p.y + 12), sgn = dir === 2 ? -1 : 1, dw = CELL * S;
      ctx.fillStyle = 'rgba(24,34,52,.3)'; ctx.beginPath(); ctx.ellipse(gx + (dir >= 2 ? sgn * 2 : 0), gy + 1, dir >= 2 ? 13 : 7, 4, 0, 0, 7); ctx.fill();
      ctx.imageSmoothingEnabled = false;
      const dy = gy - FOOT * S + 1;
      if (dir === 2) { ctx.save(); ctx.translate(gx, 0); ctx.scale(-1, 1); ctx.drawImage(img, f * CELL, row * CELL, CELL, CELL, -cx * S, dy, dw, dw); ctx.restore(); }
      else ctx.drawImage(img, f * CELL, row * CELL, CELL, CELL, gx - cx * S, dy, dw, dw);
      return true;
    }
    return { draw, ready, lift: 23 };
  })();
  // รถยนต์สไปรต์ AI (PixelLab 13 พ.ย. 2026): เด็กขับรถแดงทั้งคันจากชีต public/pack/car-driver.png (ช่อง 96×96 แถว 0 ใต้ 5 เฟรม แถว 1 ตะวันออก 9 เฟรม แถว 2 เหนือ 5 เฟรม) ตะวันตกพลิกจากตะวันออก • ภาพยังไม่โหลด/โหลดไม่ได้ → ใช้รถวาดด้วยโค้ดเดิม
  const CarAI = (() => {
    const img = new Image(); let ok = false; img.onload = () => { ok = true; }; img.src = 'pack/car-driver.png';
    const CELL = 96, ROWS = { 0: [0, 5, 46], 1: [2, 5, 48], 2: [1, 9, 49], 3: [1, 9, 49] }, FOOT = 79, S = 0.75; // dir → [แถว, จำนวนเฟรม, x กลางตัวในช่อง] • FOOT = แถวพื้นใต้ล้อ
    const ready = () => ok && img.naturalWidth >= CELL * 9 && img.naturalHeight >= CELL * 3;
    function draw(ctx, p, now) {
      if (!ready()) return false;
      const dir = p.dir || 0, moving = !!p.moving, [row, n, cx] = ROWS[dir] || ROWS[0], f = moving ? Math.floor((p.anim || 0) * 10) % n : 0;
      const gx = Math.round(p.x), gy = Math.round(p.y + 12), sgn = dir === 2 ? -1 : 1, dw = CELL * S;
      ctx.fillStyle = 'rgba(24,34,52,.3)'; ctx.beginPath(); ctx.ellipse(gx + (dir >= 2 ? sgn * 1 : 0), gy + 1, dir >= 2 ? 22 : 14, 5, 0, 0, 7); ctx.fill();
      ctx.imageSmoothingEnabled = false;
      const dy = gy - FOOT * S + 1;
      if (dir === 2) { ctx.save(); ctx.translate(gx, 0); ctx.scale(-1, 1); ctx.drawImage(img, f * CELL, row * CELL, CELL, CELL, -cx * S, dy, dw, dw); ctx.restore(); }
      else ctx.drawImage(img, f * CELL, row * CELL, CELL, CELL, gx - cx * S, dy, dw, dw);
      return true;
    }
    return { draw, ready, lift: 17 };
  })();
  const lift = kind => (kind === 'bike' && BikeAI.ready() ? BikeAI.lift : kind === 'car' && CarAI.ready() ? CarAI.lift : ({ bike: 6, scooter: 5, car: 6 }[kind] || 0) * SC); // ความสูงที่ตัวละครยกขึ้นจากพื้น (พิกเซลเกม) ไว้เลื่อนป้ายชื่อ/ฟองแชทตาม
  // วาดผู้ขี่ + ยานพาหนะ: p.veh = bike|scooter|car, p.moving/p.anim ใช้เป็นจังหวะล้อ
  function draw(ctx, p, now, PC) {
    const kind = p.veh, dir = p.dir || 0, moving = !!p.moving, anim = p.anim || 0;
    if (kind === 'bike' && BikeAI.draw(ctx, p, now)) return; // สไปรต์ AI ทั้งตัว (ถ้าโหลดภาพแล้ว)
    if (kind === 'car' && CarAI.draw(ctx, p, now)) return;
    const wr = Object.assign({}, Shared.WEAR_DEFAULT, p.wear), pc = (p.pc || Shared.PANTS_COLOR);
    const fr = moving ? Math.floor(anim * (kind === 'car' ? 14 : kind === 'scooter' ? 12 : 9)) & 3 : 0;
    const v = sprite(kind, dir, fr, pc, !moving, p.color || '#3498db'), sgn = dir === 2 ? -1 : 1;
    const shake = moving ? (kind === 'bike' ? Math.round(Math.sin(anim * 20) * 0.6) : kind === 'scooter' ? Math.round(Math.sin(anim * 60) * 0.5) : Math.round(Math.sin(anim * 26) * 0.5)) : (kind === 'scooter' ? ((now / 90 | 0) & 1 ? 0 : 0) : 0); // ตัวรถสั่น/โยกเล็กน้อย
    const idleBob = !moving && kind !== 'bike' ? ((now / 380 + (p.id || 0)) % 2 < 1 ? 0 : -1) * 0 : 0;
    const gx = p.x, gy = p.y + 12; // จุดสัมผัสพื้นกลางตัวรถ
    const oy = gy - v.ay * SC - SC + shake * SC, ox = Math.round(gx - v.ax * SC);
    // เงาใหญ่ตามขนาดรถ
    const sh = { bike: [13, 4], scooter: [15, 4.5], car: [20, 5.5] }[kind] || [10, 4];
    ctx.fillStyle = 'rgba(24,34,52,.3)'; ctx.beginPath(); ctx.ellipse(gx + (dir >= 2 ? sgn * 2 : 0), gy + 1, dir >= 2 ? sh[0] : sh[0] * .55, sh[1], 0, 0, 7); ctx.fill();
    ctx.imageSmoothingEnabled = false;
    const blit = (spr) => { const w = spr.width * SC, h = spr.height * SC; if (dir === 2) { ctx.save(); ctx.translate(gx, 0); ctx.scale(-1, 1); ctx.drawImage(spr, -(v.ax * SC), oy, w, h); ctx.restore(); } else ctx.drawImage(spr, ox, oy, w, h); };
    blit(v.back);
    // ตัวละครนั่ง: สะโพกอยู่ที่ที่นั่ง (ชดเชยจากตำแหน่งสะโพกเดิม x=p.x, y=p.y+8)
    const hipX = gx + sgn * (v.seat.x - v.ax) * SC, hipY = oy + v.seat.y * SC + (kind === 'bike' ? -2 : 0) * 0;
    const q = Object.assign({}, p, { x: hipX, y: hipY - 8 + 0, sit: true, moving: false });
    PC.draw(ctx, q, now);
    blit(v.front);
    // ท่าทางเพิ่ม: ควันท่อไอเสีย (รถ/สกูตเตอร์) ลอยตามเวลา
    if (v.puff && kind !== 'bike') {
      const back = dir === 3 ? -1 : dir === 2 ? 1 : 0, n = moving ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const t = ((now / (moving ? 420 : 900) + i / n + (p.id || 0) * .13) % 1), px = gx + (dir >= 2 ? sgn * (v.puff[0] - v.ax) * SC : (v.puff[0] - v.ax) * SC) + back * t * 14, py = gy - (v.ay - v.puff[1]) * SC - 2 - t * (dir >= 2 ? 6 : 4) + (dir === 0 ? t * 8 : 0);
        ctx.fillStyle = `rgba(214,214,222,${(1 - t) * (moving ? .5 : .28)})`; const rr = 1.5 + t * 2.5; ctx.beginPath(); ctx.arc(Math.round(px), Math.round(py), rr, 0, 7); ctx.fill();
      }
    }
    if (moving && kind === 'car' && fr % 2 === 0) { ctx.fillStyle = 'rgba(190,160,110,.35)'; ctx.fillRect(Math.round(gx - sgn * (dir >= 2 ? 18 : 0)) - 2, gy - 1, 3, 2); } // ฝุ่นเบาๆ จากล้อ
  }
  return { draw, lift, sprite };
})();

