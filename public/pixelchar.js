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
