// ตัวอย่างร้านอาหาร 64 px ต่อช่อง (ยังไม่ใส่เกม) — วาดทีละพิกเซลลงบัฟเฟอร์ ใส่พื้นผิวไม้ กระเบื้อง ผ้า ปูน + เงา dither
// โครงเหมือนตัวอย่าง HD (shop-sample.js) แต่ละเอียดกว่า 2 เท่า
(() => {
  const W = 272, H = 330, OY = 62, CX = 124;
  const RT = -24, GT = 12, EAVE = 112, SLOPE = 0.95;
  const roofHw = y => 10 + (y - RT) * 0.82;
  const gHw = (y, k) => (y - GT) * SLOPE + 4 + k;

  const P = {
    wood: ['#2a170c', '#432716', '#5e381f', '#784a2a', '#946038', '#b07a4a', '#cc9662'],
    shg: ['#381e12', '#54301c', '#6e3e24', '#88502e', '#a2633a', '#bb7a4a', '#d4945e'],
    cream: ['#b0946c', '#c8ae86', '#dcc8a2', '#ecdcbc', '#f8eed6', '#fffaec'],
    stone: ['#3a3640', '#524e5a', '#6a6672', '#86828e', '#a29eaa', '#c2beca'],
    light: ['#b8681c', '#dc902e', '#f2b446', '#ffd46c', '#ffe8a0', '#fff8dc'],
    teal: ['#103634', '#1a504c', '#266a64', '#38867e', '#52a49a', '#7cc2b6'],
    leaf: ['#1a4420', '#265e2c', '#367a36', '#4e9446', '#6cb05a', '#92ca72'],
    red: ['#681a16', '#922820', '#bc382c', '#d85242', '#ee7a64'],
    blue: ['#1c3870', '#2a5094', '#3c6cbe', '#5888d6', '#80a8e8'],
    white: ['#b4aa9a', '#d2c8b8', '#e8e0d2', '#f6f0e6', '#ffffff'],
    purp: ['#36205c', '#523486', '#704eac', '#8e6eca', '#b298e0'],
    pink: ['#982c68', '#c84c8a', '#ea74ac', '#ffa2ca', '#ffd2e6'],
    chalk: ['#1c2620', '#24302a', '#2c3a32', '#36463c'],
  };
  const HEX = {}; const rgb = h => HEX[h] || (HEX[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  const h2 = (x, y) => { let n = (x | 0) * 374761393 + (y | 0) * 668265263; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t);
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
    const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  // เลือกสีจากพาเลตตามระดับ (ทศนิยม) ผสมสองระดับด้วย dither
  const pick = (pal, v, x, y) => { const b = Math.floor(v), i = (v - b) > bay(x, y) ? b + 1 : b; return pal[Math.max(0, Math.min(pal.length - 1, i))]; };

  let buf;
  const BW = W + 2, BH = H + 2;
  function px(x, y, c, a = 1) {
    x = Math.round(x) + 1; y = Math.round(y) + OY + 1;
    if (x < 0 || y < 0 || x >= BW || y >= BH || !c) return;
    const [r, g, b] = rgb(c), i = (y * BW + x) * 4, da = buf[i + 3] / 255, oa = a + da * (1 - a);
    if (a >= 1) { buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; return; }
    buf[i] = (r * a + buf[i] * da * (1 - a)) / oa; buf[i + 1] = (g * a + buf[i + 1] * da * (1 - a)) / oa; buf[i + 2] = (b * a + buf[i + 2] * da * (1 - a)) / oa; buf[i + 3] = oa * 255;
  }
  const tex = (t, x, y) => typeof t === 'function' ? t(x, y) : t;
  function rect(X, Y, w, h, t) { for (let y = Y; y < Y + h; y++) for (let x = X; x < X + w; x++) px(x, y, tex(t, x, y)); }
  function ellipse(cx, cy, rx, ry, t) { for (let dy = -ry; dy <= ry; dy++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - dy * dy / (ry * ry)))); for (let x = cx - w; x <= cx + w; x++) px(x, cy + dy, tex(t, x, cy + dy)); } }
  function rrect(X, Y, w, h, rad, t) {
    for (let y = Y; y < Y + h; y++) for (let x = X; x < X + w; x++) {
      const dx = Math.max(X + rad - x, 0, x - (X + w - 1 - rad)), dy = Math.max(Y + rad - y, 0, y - (Y + h - 1 - rad));
      if (dx * dx + dy * dy <= rad * rad + rad * .8) px(x, y, tex(t, x, y));
    }
  }
  // ไม้ลายเสี้ยน: dir 'h' ลายวิ่งแนวนอน / 'v' แนวตั้ง
  const woodT = (lvl, dir = 'h', amp = 1.4) => (x, y) => {
    const g = dir === 'h' ? vn(x * .09, y * .9) : vn(x * .9, y * .09);
    const knot = vn(x * .05 + 40, y * .05) > .82 ? -1 : 0;
    return pick(P.wood, lvl + (g - .5) * amp + knot, x, y);
  };
  function flower(x, y, pal, k = 3) {
    for (const [dx, dy] of [[0, -2], [-2, 0], [2, 0], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) px(x + dx, y + dy, pal[Math.abs(dx) + Math.abs(dy) === 2 && dx && dy ? k - 1 : k]);
    px(x - 1, y - 2, pal[k + 1] || pal[k]); px(x, y, '#ffe37a'); px(x + 1, y, '#e8b030');
  }
  function bush(cx, cy, rx, ry) {
    ellipse(cx, cy, rx, ry, (x, y) => pick(P.leaf, 2.4 + ((cx - x) / rx + (cy - y) / ry) * .9 + (vn(x * .4, y * .4) - .5) * 1.2, x, y));
  }

  function roof() {
    for (let y = RT; y <= EAVE - 4; y++) {
      const t = y - RT, hw = Math.round(roofHw(y)), row = Math.floor(t / 7), ly = t % 7;
      for (let x = CX - hw; x <= CX + hw; x++) {
        const d = Math.abs(x - CX), side = x < CX ? 0 : 1, u = d + row * 5, sx = u % 11, id = h2(Math.floor(u / 11) * 7 + side, row);
        if (d > hw - 4) { px(x, y, pick(P.wood, (side ? 2 : 4) + (d === hw ? -1.5 : 0) + (vn(y * .1, d) - .5), x, y)); continue; }
        let v = (side ? 3 : 4.2) + (id - .5) * 1.1 + (1 - t / (EAVE - RT)) * .5;
        if (ly < 2) v -= 1.3;
        else if (ly === 5 && sx > 1 && sx < 10) v += .6;
        if (ly === 6 || sx === 0 || (ly === 5 && (sx === 1 || sx === 10))) v = side ? .7 : 1.2;
        if (d > hw - 9) v -= side ? .8 : -.3;
        if (ly > 1 && ly < 6 && sx > 1 && vn(x * .18, y * .18) > .8 && id > .55) { px(x, y, pick(P.leaf, 2.5 + (bay(x, y) - .5), x, y)); continue; }
        px(x, y, pick(P.shg, v, x, y));
      }
    }
    for (let y = RT - 4; y < GT + 6; y++) for (let x = CX - 4; x <= CX + 4; x++) {
      const seg = ((y - RT) & 7) === 7;
      px(x, y, pick(P.wood, seg ? 1 : (x < CX ? 5 : x === CX ? 3.5 : 2.2) + (x === CX - 4 ? -1 : 0), x, y));
    }
    ellipse(CX, RT - 6, 6, 4, (x, y) => pick(P.wood, 4 + (CX - x) / 4 + (RT - 6 - y) / 3, x, y));
  }

  function chimney() {
    const X = CX + 40, Y = -12, w = 24, h = 40;
    for (let y = Y; y < Y + h; y++) for (let x = X; x < X + w; x++) {
      const row = Math.floor((y - Y) / 8), ly = (y - Y) % 8, off = row & 1 ? 5 : 0, sw = 10, sx = (x - X + off) % sw, id = h2(Math.floor((x - X + off) / sw), row + 9);
      let v = 2.6 + (id - .5) * 1.2 + (x - X < 4 ? .6 : 0) - (x - X > w - 6 ? .9 : 0);
      if (ly === 7 || sx === 0) v = .8; else if (ly === 0 || sx === 1) v += 1; else if (ly === 6 || sx === sw - 1) v -= .7;
      px(x, y, pick(P.stone, v, x, y));
    }
    rect(X - 4, Y - 6, w + 8, 7, (x, y) => pick(P.stone, y === Y - 6 ? 4.6 : y === Y ? 1 : 2.6 + (X + w / 2 - x) / 20, x, y));
    rect(X + 3, Y - 6, w - 6, 2, P.stone[0]);
  }

  function gable() {
    for (let y = GT; y <= EAVE; y++) {
      const hw = gHw(y, -14); if (hw <= 0) continue;
      for (let x = Math.ceil(CX - hw); x <= CX + hw; x++) {
        const e = hw - Math.abs(x - CX);
        let v = 3.1 + (vn(x * .3, y * .3) - .5) * .9 + (x < CX - hw * .35 ? .6 : 0) - (x > CX + hw * .6 ? .7 : 0);
        if (e < 5) v -= (5 - e) * .35;
        if (y > EAVE - 8) v -= (y - EAVE + 8) * .12;
        if (h2(x, y) > .975) v -= 1;
        px(x, y, pick(P.cream, v, x, y));
      }
    }
    for (const X of [CX - 36, CX + 30]) rect(X, GT + 50, 7, EAVE - GT - 50, (x, y) => pick(P.wood, x === X ? 5 : x === X + 6 ? 1.5 : 3.3 + (vn(x * .9, y * .08) - .5) * 1.4, x, y));
    // ป้ายไอคอนถ้วย
    const bx = CX - 21, by = 50, bw = 42, bh = 38;
    rrect(bx, by, bw, bh, 3, (x, y) => pick(P.wood, (y < by + 3 || x < bx + 3 ? 5 : y > by + bh - 4 || x > bx + bw - 4 ? 1.8 : 3.4) + (vn(x * .2, y * .5) - .5), x, y));
    rect(bx + 5, by + 5, bw - 10, bh - 10, (x, y) => pick(P.cream, 4.3 + (vn(x * .4, y * .4) - .5) * .7 - (y > by + bh - 9 ? .8 : 0) - (x < bx + 7 || y < by + 7 ? .7 : 0), x, y));
    const cx0 = bx + 12, cy0 = by + 15;
    rect(cx0, cy0, 17, 13, (x, y) => pick(P.red, 3.4 - (x - cx0) / 17 * 2.4 + (x - cx0 === 3 ? 1 : 0) - (y > cy0 + 10 ? .6 : 0), x, y));
    ellipse(cx0 + 8, cy0, 8, 2, (x, y) => pick(P.red, y < cy0 ? 3.6 : 1.2, x, y));
    for (let a = 0; a < 18; a++) { const t = a / 17 * Math.PI, X = cx0 + 18 + Math.sin(t) * 4, Y = cy0 + 2 + (1 - Math.cos(t)) * 4; px(X, Y, P.red[2]); px(X + 1, Y, P.red[1]); }
    ellipse(cx0 + 8, cy0 + 14, 12, 2, (x, y) => pick(P.white, 2.6 - (x - cx0) / 24, x, y));
    for (let i = 0; i < 9; i++) { px(cx0 + 5 + Math.sin(i * .8) * 1.5, cy0 - 3 - i, P.white[3], .8); px(cx0 + 11 + Math.sin(i * .8 + 2) * 1.5, cy0 - 3 - i, P.white[3], .7); }
  }

  function bargeboards() {
    for (let y = GT; y <= EAVE + 4; y++) {
      const o = gHw(y, 0), i = Math.max(0, gHw(y, -14));
      for (const s of [-1, 1]) for (let x = Math.round(CX + s * i); s < 0 ? x >= CX + s * o : x <= CX + s * o; x += s) {
        const u = o - Math.abs(x - CX);
        let v = (s < 0 ? 3.6 : 2.7) + (vn(y * .11 + u * .08, u * .55) - .5) * 1.5;
        if (u < 2) v = s < 0 ? 5.6 : 4.2; else if (u > 12.5) v = 1;
        if (u > 6 && u < 9 && (y % 24) > 10 && (y % 24) < 13) v = u < 7.5 ? .6 : 4.5;
        px(x, y, pick(P.wood, v, x, y));
      }
    }
    rrect(CX - 9, GT - 8, 18, 15, 3, (x, y) => pick(P.wood, 3.4 + (CX - x) / 8 + (GT - y) / 7, x, y));
    ellipse(CX, GT - 11, 3, 3, (x, y) => pick(P.wood, 4 + (CX - x) / 2, x, y));
  }

  function beam() {
    rect(16, EAVE - 2, 222, 12, (x, y) => pick(P.wood, y < EAVE ? 5.4 : y > EAVE + 7 ? 1.2 : 3.2 + (vn(x * .07, y * .9) - .5) * 1.5, x, y));
    for (const X of [22, 52, 196, 228]) { rect(X, EAVE + 3, 3, 3, P.wood[0]); px(X, EAVE + 3, P.stone[4]); }
  }

  function nameBoard() {
    const X = CX - 57, Y = EAVE - 18, w = 115, h = 30;
    for (const X2 of [X + 20, X + w - 21]) for (let y = Y - 10; y < Y; y++) { px(X2, y, (y & 3) < 2 ? P.stone[3] : P.stone[1]); px(X2 + 1, y, (y & 3) < 2 ? P.stone[1] : P.stone[3]); }
    rrect(X - 1, Y - 1, w + 2, h + 2, 6, P.wood[0]);
    rrect(X, Y, w, h, 5, (x, y) => {
      let v = 3.2 + (vn(x * .06, y * .8) - .5) * 1.6;
      if (y < Y + 2) v = 5.4; else if (x < X + 2) v = 4.6; else if (y > Y + h - 4) v = 1.6; else if (x > X + w - 3) v = 2;
      return pick(P.wood, v, x, y);
    });
    for (const X2 of [X + 7, X + w - 9]) { rect(X2, Y + 13, 3, 3, P.wood[0]); px(X2, Y + 13, '#e0c088'); }
  }

  function walls() {
    for (const [X0, X1] of [[22, 52], [196, 226]]) {
      rect(X0, EAVE + 8, X1 - X0, 216 - EAVE - 8, (x, y) => {
        const pl = (x - X0) % 9; let v = 1.1 + (vn(x * .9, y * .07) - .5) * .8 - (y < EAVE + 24 ? (EAVE + 24 - y) * .05 : 0);
        if (pl === 0) v = .2;
        return pick(P.wood, v, x, y);
      });
      // ชั้นวางโหลแยม
      rect(X0 + 2, 196, X1 - X0 - 4, 4, (x, y) => pick(P.wood, y === 196 ? 4.6 : 2.6, x, y));
      [[4, P.red], [12, P.light], [20, P.leaf]].forEach(([dx, pal]) => {
        rect(X0 + dx, 188, 6, 8, (x, y) => pick(pal, (y < 190 ? 2 : 3) - (x - X0 - dx) * .3, x, y));
        rect(X0 + dx, 186, 6, 2, P.white[2]); px(X0 + dx + 1, 191, '#ffffff', .8);
      });
    }
    rect(52, EAVE + 8, 144, 216 - EAVE - 8, (x, y) => {
      const ly = (y - EAVE - 8) % 10;
      let v = ly < 2 ? 4.8 : ly === 8 ? 1.6 : ly === 9 ? .6 : 3.2 + (vn(x * .05, y * .6) - .5) * .9;
      if (y < EAVE + 20) v -= (EAVE + 20 - y) * .12;
      return pick(P.cream, v, x, y);
    });
    for (const X of [16, 46, 190, 224]) rect(X, EAVE + 8, 8, 216 - EAVE - 8, (x, y) => pick(P.wood, x === X ? 5.2 : x === X + 7 ? 1 : 3.2 + (vn(x * .9, y * .07) - .5) * 1.5, x, y));
    for (let y = 212; y < 226; y++) for (let x = 12; x < 240; x++) {
      const row = y < 219 ? 0 : 1, ly = row ? y - 219 : y - 212, off = row ? 7 : 0, sw = 13 + (h2(Math.floor((x + off) / 13), row) * 4 | 0), sx = (x + off) % 13, id = h2(Math.floor((x + off) / 13), row + 3);
      let v = 2.8 + (id - .5) * 1.3;
      if (ly === 6 || sx === 0) v = .9; else if (ly === 0 || sx === 1) v += 1.1; else if (ly === 5) v -= .7;
      px(x, y, pick(P.stone, v + (sw > 15 ? 0 : 0), x, y));
    }
  }

  function sideAwning(L) {
    const Y = L ? EAVE + 4 : EAVE - 20, Hh = L ? 48 : 68, Wd = L ? 40 : 44, k = L ? .55 : .45;
    const A = L ? P.purp : P.red, B = L ? P.white : ['#a88c64', '#c8ae84', '#e2cca4', '#f4e4c4', '#fff4dc'];
    for (let y = 0; y < Hh; y++) {
      const out = Math.floor(y * k);
      for (let i = 0; i < Wd; i++) {
        const x = L ? 52 - i - out : 196 + i + out, yy = (L ? Y : Y + Math.floor(i * .5)) + y;
        const band = L ? Math.floor(y / 8) & 1 : Math.floor((i + y) / 10) & 1;
        let v = 2.5 + Math.sin(i / Wd * Math.PI * 3) * .55 + (y < 4 ? .7 : 0) - (y > Hh - 6 ? 1 : 0) - (i > Wd - 3 ? 1.2 : 0);
        px(x, yy, pick(band ? B : A, v, x, yy));
      }
    }
    const out = Math.floor(Hh * k);
    for (let i = 0; i < Wd; i += 8) for (let dy = 0; dy < 4; dy++) for (let dx = -3 + dy; dx <= 3 - dy; dx++) {
      const x = L ? 52 - i - out - 4 + dx : 196 + i + out + 4 + dx, yy = (L ? Y : Y + Math.floor((i + 4) * .5)) + Hh + dy;
      px(x, yy, pick(L ? P.purp : P.red, 1.6 - dy * .3, x, yy));
    }
  }

  function awning() {
    const X = 54, Y = EAVE + 12, w = 140, sw = 14, pals = [P.red, P.white, P.blue, P.white];
    rect(X, Y + 17, w, 8, (x, y) => '#3a2010');
    for (let y = Y + 23; y < Y + 31; y++) for (let x = X; x < X + w; x++) px(x, y, '#2a1408', .28 - (y - Y - 23) * .03);
    for (let x = X; x < X + w; x++) {
      const s = Math.floor((x - X) / sw), pal = pals[s % 4], lx = (x - X) % sw;
      for (let y = Y; y < Y + 16; y++) {
        const v = 2.7 + Math.cos(lx / sw * Math.PI * 2) * .5 + (y < Y + 3 ? .9 : 0) - (y > Y + 12 ? .9 : 0);
        px(x, y, pick(pal, v, x, y));
      }
    }
    for (let s = 0; s < w / sw; s++) {
      const pal = pals[s % 4], cx = X + s * sw + sw / 2 - .5;
      for (let dy = 0; dy <= 7; dy++) { const hw = Math.sqrt(Math.max(0, 49 - dy * dy)); for (let x = Math.ceil(cx - hw); x <= cx + hw; x++) px(x, Y + 16 + dy, pick(pal, dy > 5 || Math.abs(x - cx) > hw - 1.5 ? 1 : 2.1 - dy * .12, x, Y + 16 + dy)); }
    }
    rect(X - 2, Y - 3, w + 4, 4, (x, y) => pick(P.wood, y === Y - 3 ? 5 : 1.6, x, y));
  }

  function windowWarm(X, Y) {
    rect(X - 5, Y - 5, 38, 38, (x, y) => pick(P.wood, x < X - 3 || y < Y - 3 ? 5 : x > X + 29 || y > Y + 29 ? 1.4 : 3.3 + (vn(x * .3, y * .3) - .5), x, y));
    rect(X, Y, 28, 28, (x, y) => {
      let v = 4.7 - (y - Y) / 28 * 2.6 + (vn(x * .2, y * .2) - .5) * .5;
      const d = (x - X) + (y - Y);
      if ((d > 6 && d < 9) || (d > 12 && d < 14)) v += 1;
      return pick(P.light, v, x, y);
    });
    rect(X + 12, Y, 4, 28, (x, y) => pick(P.wood, x === X + 12 ? 4.4 : 2.4, x, y));
    rect(X, Y + 12, 28, 4, (x, y) => pick(P.wood, y === Y + 12 ? 4.4 : 2.4, x, y));
    for (const s of [0, 1]) for (let y = 0; y < 9; y++) for (let i = 0; i < 9 - y; i++) { const x = s ? X + 27 - i : X + i; px(x, Y + y, pick(P.pink, 2.8 - i * .15 - (y & 1 ? .4 : 0), x, Y + y)); }
    rect(X - 7, Y + 31, 42, 6, (x, y) => pick(P.wood, y === Y + 31 ? 5.4 : y > Y + 34 ? 1.2 : 3.4, x, y));
  }

  function door() {
    const cx = CX, X = cx - 17, Y = 152, w = 34, h = 62, R = 17;
    const inArch = (x, y, rad, top) => y >= top + rad ? true : (x - cx) ** 2 + (y - top - rad) ** 2 <= rad * rad;
    for (let y = Y - 5; y < Y + h; y++) for (let x = X - 5; x < X + w + 5; x++) if (inArch(x + .5, y + .5, R + 5, Y - 5)) px(x, y, pick(P.wood, (x < X - 2 ? 5 : x > X + w + 2 ? 1.4 : 3.2) + (vn(x * .3, y * .3) - .5), x, y));
    for (let y = Y; y < Y + h; y++) for (let x = X; x < X + w; x++) if (inArch(x + .5, y + .5, R, Y)) {
      const pl = (x - X) % 8; let v = 2.6 + (vn(x * .9, y * .06) - .5) * 1.2 + (x < X + 3 ? 1.2 : 0) - (x > X + w - 4 ? 1 : 0);
      if (pl === 0 && x > X) v = 1;
      px(x, y, pick(P.teal, v, x, y));
    }
    for (let y = Y + 6; y < Y + 32; y++) for (let x = cx - 11; x <= cx + 11; x++) if (inArch(x + .5, y + .5, 11, Y + 6)) {
      const rim = !inArch(x + .5, y + .5, 9, Y + 8) || x < cx - 9 || x > cx + 9 || y > Y + 29;
      px(x, y, rim ? pick(P.wood, 2.4, x, y) : pick(P.light, 4.8 - (y - Y - 8) / 22 * 2.4, x, y));
    }
    rect(cx - 1, Y + 8, 2, 22, P.wood[2]); rect(cx - 9, Y + 18, 18, 2, P.wood[2]);
    for (const hy of [Y + 36, Y + 52]) { rect(X, hy, 12, 3, P.stone[1]); px(X + 2, hy, P.stone[4]); rect(X + 9, hy - 1, 3, 5, P.stone[1]); }
    ellipse(X + w - 7, Y + 40, 2, 2, (x, y) => pick(['#8a6010', '#c89a2a', '#f2c14e', '#fff0a0'], 2 + (X + w - 7 - x) / 2 + (Y + 40 - y) / 2, x, y));
    rect(X - 8, Y + h, w + 16, 5, (x, y) => pick(P.stone, y === Y + h ? 4.6 : 2.6 + (vn(x * .3, y) - .5), x, y));
  }

  function basket(cx, Y) {
    for (let i = 0; i <= 22; i++) { px(cx, Y - 26 + i * .4, '#1e140c'); px(cx - i * .6, Y - 17 + i * .8, '#1e140c'); px(cx + i * .6, Y - 17 + i * .8, '#1e140c'); }
    for (let v = 0; v < 4; v++) { const x0 = cx - 10 + v * 6, len = 10 + (h2(v, cx) * 10 | 0); for (let i = 0; i < len; i++) { px(x0 + Math.sin(i * .5) * 1.2, Y + 14 + i, P.leaf[2]); if (i % 4 === 2) { px(x0 + 1, Y + 14 + i, P.leaf[4]); px(x0 - 1, Y + 15 + i, P.leaf[3]); } } }
    for (const [dx, dy, rx, ry] of [[-9, 1, 7, 5], [9, 1, 7, 5], [-3, -3, 7, 5], [5, -4, 6, 5], [0, 2, 9, 5]]) bush(cx + dx, Y + dy, rx, ry);
    for (const [dx, dy, k] of [[-11, 0, 3], [-6, -5, 2], [0, -7, 3], [6, -5, 3], [11, -1, 2], [-3, 1, 3], [4, 0, 2]]) flower(cx + dx, Y + dy, P.pink, k);
    for (let y = Y + 4; y < Y + 18; y++) { const hw = 16 - Math.max(0, y - Y - 10) * 1.2; for (let x = Math.ceil(cx - hw); x <= cx + hw; x++) {
      const wv = (((x >> 1) + (y >> 1)) & 1); px(x, y, pick(P.wood, (y < Y + 6 ? 5 : 3.4 + wv * 1 - (y - Y - 4) * .1) - (Math.abs(x - cx) > hw - 2 ? 1.2 : 0), x, y)); } }
  }

  function chalkboard(X, Y, icon) {
    for (const lx of [X + 3, X + 29]) rect(lx, Y + 36, 4, 16, (x, y) => pick(P.wood, x === lx ? 4.4 : 2, x, y));
    rect(X, Y, 36, 38, (x, y) => pick(P.wood, x < X + 2 || y < Y + 2 ? 5.2 : x > X + 33 || y > Y + 35 ? 1.4 : 3.4 + (vn(x * .4, y * .4) - .5), x, y));
    rect(X + 4, Y + 4, 28, 30, (x, y) => pick(P.chalk, 1.6 + (vn(x * .25, y * .25) - .5) * 1.6 + (y < Y + 6 ? 1 : 0), x, y));
    if (icon) {
      for (let a = 0; a <= 16; a++) { const t = a / 16 * Math.PI; px(X + 18 + Math.cos(t) * 8, Y + 11 + Math.sin(t) * 5, '#ecece4'); }
      rect(X + 10, Y + 11, 17, 1, '#ecece4');
      for (let i = 0; i < 4; i++) { px(X + 14 + Math.sin(i) , Y + 9 - i, '#c8d4c8'); px(X + 20 + Math.sin(i + 1), Y + 9 - i, '#c8d4c8'); }
    }
    for (const [dy, w, c] of icon ? [[20, 18, '#ecece4'], [24, 14, '#c8d4c8'], [28, 10, '#f8d060']] : [[8, 16, '#f8d060'], [13, 20, '#ecece4'], [18, 14, '#c8d4c8'], [23, 18, '#ecece4'], [28, 9, '#f8d060']])
      for (let i = 0; i < w; i++) px(X + 7 + i, Y + dy + Math.round(Math.sin(i * .9 + dy) * .6), c, h2(i, dy) > .15 ? 1 : .4);
  }

  function table(cx, cy) {
    ellipse(cx - 28, cy + 17, 8, 4, (x, y) => pick(P.wood, 3.6 + (cx - 28 - x) / 6 - (y > cy + 18 ? 1 : 0), x, y));
    rect(cx - 30, cy + 20, 4, 10, (x, y) => pick(P.wood, x === cx - 30 ? 4 : 1.8, x, y));
    rect(cx - 3, cy + 4, 7, 22, (x, y) => pick(P.wood, x < cx - 1 ? 4.4 : 2, x, y));
    ellipse(cx, cy + 26, 11, 3, (x, y) => pick(P.wood, 2.2 + (cx - x) / 10, x, y));
    ellipse(cx, cy + 2, 22, 10, (x, y) => pick(P.wood, 1.6, x, y));
    ellipse(cx, cy, 21, 9, (x, y) => { const d = Math.hypot((x - cx) / 2.2, y - cy); return pick(P.wood, 3.9 + Math.sin(d * 1.3) * .35 + (cx - x) / 30 + (cy - y) / 14, x, y); });
    rect(cx + 6, cy - 9, 7, 7, (x, y) => pick(P.white, 3.4 - (x - cx - 6) * .3, x, y));
    ellipse(cx + 9, cy - 9, 3, 1, P.wood[1]);
    for (let i = 0; i < 3; i++) px(cx + 14, cy - 8 + i, P.white[2]);
  }

  function flowerBox(X, Y) {
    for (const [dx, dy, rx, ry] of [[6, 2, 8, 6], [20, -1, 9, 7], [34, 0, 9, 7], [48, 2, 8, 6], [27, 4, 14, 5]]) bush(X + dx, Y + dy, rx, ry);
    const fl = [[3, 0, P.pink], [10, -4, ['#a07a10', '#d8a820', '#ffd84a', '#ffec90', '#fff8d0']], [17, -7, P.purp], [24, -3, P.pink], [31, -7, P.blue], [38, -3, ['#a07a10', '#d8a820', '#ffd84a', '#ffec90', '#fff8d0']], [45, -5, P.purp], [52, 0, P.pink], [14, 2, P.white], [42, 2, P.pink], [28, 3, P.white]];
    for (const [dx, dy, pal] of fl) flower(X + dx, Y + dy, pal, 3);
    rect(X - 2, Y + 8, 62, 22, (x, y) => {
      const ly = y - Y - 8; let v = 3.3 + (vn(x * .08, y * .9) - .5) * 1.5;
      if (ly < 2) v = 5.2; else if (ly === 10) v = 1; else if (ly > 19) v = 1.2; else if (x - X === 28 || x - X === 29) v = 1.6;
      if (x < X) v += 1; if (x > X + 57) v -= 1.2;
      return pick(P.wood, v, x, y);
    });
  }

  function barrel(X, Y) {
    for (let y = Y; y < Y + 40; y++) {
      const bulge = Math.sin((y - Y) / 40 * Math.PI) * 2;
      for (let x = Math.round(X - bulge); x <= X + 32 + bulge; x++) {
        const t = (x - X + bulge) / (32 + bulge * 2), st = Math.floor(t * 7), edge = (t * 7) % 1 < .12;
        let v = 2 + Math.cos((t - .32) * Math.PI) * 2.2 + (h2(st, Y) - .5) * .8 + (vn(x * .6, y * .1) - .5) * .8;
        if (edge) v -= 1.2;
        const hoop = (y - Y > 5 && y - Y < 10) || (y - Y > 29 && y - Y < 34);
        px(x, y, hoop ? pick(P.stone, 1.4 + Math.cos((t - .3) * Math.PI) * 2.4 + (y - Y === 6 || y - Y === 30 ? .8 : 0), x, y) : pick(P.wood, v, x, y));
      }
    }
    ellipse(X + 16, Y, 16, 4, (x, y) => pick(P.wood, 1.4, x, y));
    ellipse(X + 16, Y, 14, 3, (x, y) => { const d = Math.hypot((x - X - 16) / 3.5, y - Y); return pick(P.wood, 3 + Math.sin(d * 3) * .5 + (X + 16 - x) / 20, x, y); });
  }

  function shadowGround() {
    for (let y = 206; y < 240; y++) for (let x = 0; x < W; x++) {
      const d = ((x - CX - 4) / 128) ** 2 + ((y - 222) / 14) ** 2;
      if (d < 1) px(x, y, '#1e1208', .3 * (1 - d));
    }
    for (const [cx, rad] of [[78, 30], [CX, 26], [170, 30]]) for (let y = 222; y < 250; y++) for (let x = cx - rad; x < cx + rad; x++) {
      const d = ((x - cx) / rad) ** 2 + ((y - 226) / 12) ** 2; if (d < 1) px(x, y, '#ffd46c', .1 * (1 - d));
    }
  }

  function outline() {
    const n = BW * BH, o = new Uint8Array(n), I = rgb('#3a2416'), M = rgb('#6e4a30');
    for (let i = 0; i < n; i++) o[i] = buf[i * 4 + 3] > 90 ? 1 : 0;
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
      const i = y * BW + x; if (o[i]) { buf[i * 4 + 3] = 255; continue; }
      const side = (x > 0 && o[i - 1]) || (x < BW - 1 && o[i + 1]) || (y > 0 && o[i - BW]) || (y < BH - 1 && o[i + BW]);
      const diag = !side && ((x > 0 && y > 0 && o[i - BW - 1]) || (x < BW - 1 && y > 0 && o[i - BW + 1]) || (x > 0 && y < BH - 1 && o[i + BW - 1]) || (x < BW - 1 && y < BH - 1 && o[i + BW + 1]));
      const c = side ? I : diag ? M : null;
      if (c) { buf[i * 4] = c[0]; buf[i * 4 + 1] = c[1]; buf[i * 4 + 2] = c[2]; buf[i * 4 + 3] = side ? 255 : 200; }
    }
  }

  function glow(cx, cy, rad, c, a) {
    const [r, g, b] = rgb(c);
    for (let y = cy - rad; y < cy + rad; y++) for (let x = cx - rad; x < cx + rad; x++) {
      const d = Math.hypot(x - cx, y - cy) / rad; if (d >= 1) continue;
      const X = x + 1, Y = y + OY + 1; if (X < 0 || Y < 0 || X >= BW || Y >= BH) continue;
      const i = (Y * BW + X) * 4; if (buf[i + 3] < 200) continue;
      const k = a * (1 - d) * (1 - d);
      buf[i] += (r - buf[i]) * k; buf[i + 1] += (g - buf[i + 1]) * k; buf[i + 2] += (b - buf[i + 2]) * k;
    }
  }

  function makeFoodShop() {
    buf = new Uint8ClampedArray(BW * BH * 4);
    shadowGround();
    barrel(232, 144); barrel(228, 184);
    roof(); chimney(); gable(); bargeboards();
    walls();
    sideAwning(true); sideAwning(false);
    beam(); awning();
    windowWarm(64, 160); windowWarm(156, 160);
    door();
    basket(37, 168); basket(211, 168);
    nameBoard();
    chalkboard(12, 210, true); chalkboard(204, 210, false);
    table(80, 228);
    flowerBox(146, 230);
    outline();
    for (const [x, y] of [[78, 174], [170, 174], [CX, 170]]) glow(x, y, 30, '#ffc860', .22);
    const c = document.createElement('canvas'); c.width = BW; c.height = BH;
    const g = c.getContext('2d'), img = g.createImageData(BW, BH);
    img.data.set(buf); g.putImageData(img, 0, 0);
    for (const [dx, dy, rd, a] of [[0, 0, 7, .5], [5, -13, 9, .38], [1, -27, 11, .24]]) {
      g.fillStyle = `rgba(232,230,238,${a})`;
      for (let yy = -rd; yy <= rd; yy++) { const w = Math.floor(Math.sqrt(rd * rd - yy * yy) + .5); g.fillRect(1 + CX + 52 + dx - w, 1 + OY - 22 + dy + yy, w * 2 + 1, 1); }
    }
    return c;
  }

  window.ShopSample64 = { food: makeFoodShop, label: { x: 1 + CX, y: 1 + OY + EAVE - 3, size: 20 } };
})();
