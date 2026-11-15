// สัตว์ในถ้ำเหมือง (14–15 พ.ย. 2026): หนู ค้างคาว แมงมุม งู ยักษ์หิน วาดด้วยโค้ดระบบ PixelArt ไม่ใช้ PixelLab • 1 พิกเซลศิลป์ = 1 พิกเซลเกม
// API: PixelCreature.draw(ctx, c, now) คืน true ถ้าวาดแล้ว (c = {k,x,y,dir,st,id?}; x,y = จุดเท้ากลางตัว) • PixelCreature.size(k) = { w, h }
// ทิศ 0 ใต้(หน้า) 1 เหนือ(หลัง) 3 ตะวันออก (2 = พลิกจาก 3) • st 0/1 เดิน/ไล่ (4 เฟรมตามเวลา) 2 ง้าง (ย่อ/เงื้อ ตาแดง) 3 โจมตี 4 ตกใจ (ตัวซีด ตาหลับ สั่น)
// โทนถ้ำ: เทาม่วง ตาเรืองแสงเหลืองอำพัน (ง้าง/โจมตี = แดง) ขอบนุ่ม soft outline แบบเดียวกับมอเตอร์ไซค์/หอคอย • แคชต่อ (ชนิด,ทิศ,ท่า,เฟรม)
const PixelCreature = (() => {
  const { mk, r, ell, disc, shade, ramp, hash } = PixelArt;
  const SOFT = { soft: ['#2a2033', '#4a3d58'] };
  const SIZE = { rat: { w: 20, h: 12 }, bat: { w: 24, h: 16 }, spider: { w: 26, h: 16 }, snake: { w: 32, h: 14 }, golem: { w: 40, h: 44 } };
  const PAL = { rat: ramp('#8f7f90', .3, .2), bat: ramp('#6a5688', .3, .2), spider: ramp('#5a4866', .3, .2), snake: ramp('#b2a27a', .3, .2), golem: ramp('#908c9e', .3, .2) };
  const PINK = '#e6a4ae', PINK2 = '#b8707f', BONE = '#efe6d2', MOSS = '#6f8f5a', MOSS2 = '#527044';
  const pal = (k, pose) => (pose === 'h' ? PAL[k].map(c => shade(c, .38)) : PAL[k]);
  const eyeCol = pose => (pose === 'w' || pose === 'a' ? '#ff3a2a' : '#ffd04a');
  const px = (x, c, X, Y) => r(x, c, Math.round(X), Math.round(Y), 1, 1);
  function ln(x, c, x0, y0, x1, y1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; x.fillStyle = c;
    for (let n = 0; n < 200; n++) { x.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function tri(x, c, a, b, d) { // สามเหลี่ยมทึบ
    const x0 = Math.floor(Math.min(a[0], b[0], d[0])), x1 = Math.ceil(Math.max(a[0], b[0], d[0])), y0 = Math.floor(Math.min(a[1], b[1], d[1])), y1 = Math.ceil(Math.max(a[1], b[1], d[1]));
    const den = (b[1] - d[1]) * (a[0] - d[0]) + (d[0] - b[0]) * (a[1] - d[1]); if (!den) return; x.fillStyle = c;
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
      const u = ((b[1] - d[1]) * (X - d[0]) + (d[0] - b[0]) * (Y - d[1])) / den, v = ((d[1] - a[1]) * (X - d[0]) + (a[0] - d[0]) * (Y - d[1])) / den;
      if (u >= -.02 && v >= -.02 && u + v <= 1.02) x.fillRect(X, Y, 1, 1);
    }
  }
  // ก้อนทรงรีมีแสงซ้ายบน: ไล่ 4 ระดับสีตามมุมเอียง + ผงสุ่มเล็กน้อย (ขน/หิน)
  function blob(x, cx, cy, rx, ry, F, seed, nz = .12) {
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
      const u = dx / (rx + .4), v = dy / (ry + .4); if (u * u + v * v > 1) continue;
      const l = -(u * .45 + v * .8) + (hash(dx + cx, dy + cy, seed) - .5) * nz * 2;
      r(x, l > .8 ? F[4] : l > .42 ? F[3] : l > -.2 ? F[2] : l > -.62 ? F[1] : F[0], Math.round(cx + dx), Math.round(cy + dy), 1, 1);
    }
  }
  const eye = (x, c, X, Y, w = 1, h = 1) => { r(x, c, X, Y, w, h); };
  const closed = (x, X, Y) => { px(x, '#2a2033', X, Y); px(x, '#2a2033', X + 1, Y + 1); px(x, '#2a2033', X, Y + 2); }; // ตาหลับ ">"

  // ---------- หนู ----------
  function rat(d, fr, pose) {
    const { w, h } = SIZE.rat, F = pal('rat', pose), E = eyeCol(pose), cr = pose === 'w' ? 1 : 0, lu = pose === 'a' ? 2 : 0, cx = w / 2;
    return mk(w, h, (x) => {
      if (d === 3) {
        const tw = [0, 1, 0, -1][fr & 3], bx = 8 + (lu ? 1 : 0), hx = 15 + lu;
        ln(x, PINK2, 2, 8 + cr, 0, 6 + tw); ln(x, PINK, 1, 8 + cr, 0, 7 + tw); px(x, PINK, 0, 6 + tw);
        const bk = [-1, 0, 1, 0][fr & 3], fk = -bk;
        r(x, F[0], 4 + bk, 10, 3, 2); r(x, F[1], 4 + bk, 10, 2, 1); r(x, F[0], 12 + fk + lu, 10, 3, 2); r(x, F[1], 12 + fk + lu, 10, 2, 1);
        blob(x, bx, 7 + cr, 6, 3, F, 1);
        blob(x, hx, 7 + cr, 3, 3, F, 2); r(x, F[2], hx + 2, 8 + cr, 3, 2); r(x, PINK, hx + 4, 8 + cr, 1, 1);
        disc(x, hx - 2, 4 + cr, 1, F[1]); px(x, PINK, hx - 2, 4 + cr); px(x, PINK, hx - 1, 4 + cr);
        if (pose === 'h') closed(x, hx + 1, 5 + cr); else { eye(x, E, hx + 1, 6 + cr); px(x, '#fff7d0', hx + 1, 6 + cr); }
        if (pose === 'a') { r(x, '#3a1a22', hx + 3, 9, 2, 1); px(x, BONE, hx + 3, 10); }
      } else {
        const back = d === 1, sw = [0, 1, 0, -1][fr & 3], by = 8 + cr;
        if (back) { ln(x, PINK2, cx, 10, cx + sw * 2, 11); px(x, PINK, cx + sw * 2, 11); }
        const lf = fr & 1 ? 1 : 0;
        r(x, F[0], cx - 4, 10 - lf, 3, 2 + lf * 0); r(x, F[0], cx + 2, 10 - (1 - lf), 3, 2); r(x, F[1], cx - 4, 10 - lf, 2, 1); r(x, F[1], cx + 2, 10 - (1 - lf), 2, 1);
        blob(x, cx, by, 5, 3, F, 3);
        blob(x, cx, 5 + cr + lu, 3, 3, F, 4);
        disc(x, cx - 4, 2 + cr + lu, 1, F[1]); disc(x, cx + 4, 2 + cr + lu, 1, F[1]); px(x, PINK, cx - 4, 2 + cr + lu); px(x, PINK, cx + 4, 2 + cr + lu);
        if (!back) {
          if (pose === 'h') { closed(x, cx - 3, 4 + cr + lu); closed(x, cx + 2, 4 + cr + lu); } else { eye(x, E, cx - 2, 5 + cr + lu); eye(x, E, cx + 2, 5 + cr + lu); px(x, '#fff7d0', cx - 2, 5 + cr + lu); px(x, '#fff7d0', cx + 2, 5 + cr + lu); }
          px(x, PINK, cx, 7 + cr + lu); if (pose === 'a') { px(x, BONE, cx - 1, 8 + cr + lu); px(x, BONE, cx + 1, 8 + cr + lu); }
        }
      }
    }, SOFT);
  }

  // ---------- ค้างคาว ----------
  const WT = [[2, 0], [0, 6], [2, 14], [0, 8]]; // ปลายปีกตามเฟรม (ครึ่งซ้าย/หน้า): ยก ระดับ กด ระดับ
  function bat(d, fr, pose) {
    const { w, h } = SIZE.bat, F = pal('bat', pose), E = eyeCol(pose), cx = w / 2, MEM = shade(F[2], .1), MEM2 = F[1];
    const tw = pose === 'w' ? WT[0] : pose === 'a' ? [3, 9] : pose === 'h' ? [6, 12] : WT[fr & 3];
    return mk(w, h, (x) => {
      if (d === 3) {
        const far = [tw[0] + 1, Math.max(0, tw[1] - 1)];
        tri(x, MEM2, [11, 8], [far[0] + 5, far[1]], [8, 10]); // ปีกไกล
        blob(x, 11, 9, 4, 3, F, 5); blob(x, 15, 7, 3, 3, F, 6);
        tri(x, F[1], [14, 3], [15, 0], [16, 4]); tri(x, F[2], [12, 4], [11, 1], [14, 4]); px(x, PINK, 12, 3);
        px(x, F[2], 18, 8); px(x, F[1], 18, 9);
        if (pose === 'h') closed(x, 15, 5); else { eye(x, E, 16, 6); px(x, '#fff7d0', 16, 6); }
        if (pose === 'a' || pose === 'w') { px(x, BONE, 17, 10); px(x, BONE, 15, 10); }
        tri(x, MEM, [11, 8], [tw[0] + 4, tw[1]], [6, 10]); ln(x, F[0], 11, 8, tw[0] + 4, tw[1]); ln(x, F[1], 6, 10, tw[0] + 4, tw[1]); // ปีกใกล้
        r(x, F[3], 10, 8, 2, 1);
      } else {
        const back = d === 1, mx = v => 2 * cx - v;
        const wl = [tw[0], tw[1]];
        tri(x, MEM2, [cx - 3, 8], [wl[0], wl[1]], [cx - 4, 13]); tri(x, MEM2, [cx + 3, 8], [mx(wl[0]), wl[1]], [cx + 4, 13]);
        tri(x, MEM, [cx - 3, 8], [wl[0] + 1, wl[1] + (wl[1] < 5 ? 1 : 0)], [cx - 5, 11]); tri(x, MEM, [cx + 3, 8], [mx(wl[0] + 1), wl[1] + (wl[1] < 5 ? 1 : 0)], [cx + 5, 11]);
        ln(x, F[0], cx - 3, 8, wl[0], wl[1]); ln(x, F[0], cx + 3, 8, mx(wl[0]), wl[1]);
        blob(x, cx, 10, 3, 4, F, 7); blob(x, cx, 6, 3, 3, F, 8);
        tri(x, F[1], [cx - 3, 5], [cx - 4, 1], [cx - 1, 3]); tri(x, F[1], [cx + 3, 5], [cx + 4, 1], [cx + 1, 3]); px(x, PINK, cx - 3, 3); px(x, PINK, cx + 3, 3);
        if (!back) {
          if (pose === 'h') { closed(x, cx - 3, 5); closed(x, cx + 2, 5); } else { eye(x, E, cx - 2, 6); eye(x, E, cx + 1, 6); px(x, '#fff7d0', cx - 2, 6); px(x, '#fff7d0', cx + 1, 6); }
          px(x, PINK, cx - 1, 8); if (pose === 'a' || pose === 'w') { px(x, BONE, cx - 1, 9); px(x, BONE, cx, 9); }
        } else r(x, F[1], cx - 1, 9, 2, 4);
      }
    }, SOFT);
  }

  // ---------- แมงมุม ----------
  const SK = [[7, 3, 11, 7], [9, 5, 12, 11], [9, 8, 11, 14], [7, 10, 8, 15]]; // [kneeX,kneeY,footX,footY] ครึ่งขวา (หน้า)
  const SS = [[15, 10, 21, 5, 24, 13], [14, 10, 18, 4, 20, 15], [12, 10, 9, 4, 7, 15], [11, 10, 5, 6, 3, 13]]; // ด้านข้าง [rootX,rootY,kneeX,kneeY,footX,footY]
  function spider(d, fr, pose) {
    const { w, h } = SIZE.spider, F = pal('spider', pose), E = eyeCol(pose), cx = w / 2, cr = pose === 'w' ? 2 : 0, up = pose === 'a' ? 2 : 0, big = pose === 'a' ? 1 : 0;
    return mk(w, h, (x) => {
      const lift = i => (pose === 'n' ? ((i + fr) & 1 ? 1 : 0) : 0);
      if (d === 3) {
        for (const [far, off] of [[true, -1], [false, 0]]) SS.forEach((l, i) => {
          if (far === (i % 2 === 0)) { /* สลับสองชุดให้ดูเป็น 8 ขา */ }
          const col = far ? F[0] : F[1], fy = l[5] - lift(i) - (pose === 'w' ? 0 : 0), ky = l[3] - up;
          ln(x, col, l[0] + off, l[1] - 1 + off - cr, l[2] + off, ky + off); ln(x, col, l[2] + off, ky + off, l[4] + off, Math.min(15, fy + (far ? -1 : 0)));
          if (!far) px(x, F[3], l[2], ky);
        });
        blob(x, 8, 8 + cr, 6 + big, 5 + big, F, 9, .15); r(x, '#c25a4a', 6, 6 + cr, 3, 1); r(x, '#a04438', 7, 7 + cr, 1, 2);
        blob(x, 16, 9 + cr, 4, 3, F, 10);
        if (pose === 'h') closed(x, 18, 7 + cr); else { eye(x, E, 19, 8 + cr, 1, 2); eye(x, E, 17, 7 + cr); px(x, '#fff7d0', 19, 8 + cr); }
        r(x, BONE, 20, 11 + cr, 1, 2);
      } else {
        const back = d === 1;
        for (const s of [-1, 1]) SK.forEach((l, i) => {
          const col = i < 2 ? F[1] : F[0], fx = cx + s * l[2], fy = Math.min(15, l[3] - lift(i + (s > 0 ? 1 : 0)) + (pose === 'w' ? 0 : 0)), ky = l[1] - up + cr * 0;
          ln(x, col, cx + s * 3, 9 + cr, cx + s * l[0], ky); ln(x, col, cx + s * l[0], ky, fx, fy); px(x, F[3], cx + s * l[0], ky);
        });
        if (back) { blob(x, cx, 9 + cr, 6 + big, 6 + big, F, 11, .15); r(x, '#c25a4a', cx - 1, 6 + cr, 3, 1); r(x, '#a04438', cx, 7 + cr, 1, 3); r(x, '#c25a4a', cx - 1, 11 + cr, 3, 1); }
        else {
          blob(x, cx, 6 + cr, 6 + big, 5 + big, F, 12, .15); r(x, '#c25a4a', cx - 1, 3 + cr, 3, 1); r(x, '#a04438', cx, 4 + cr, 1, 3); r(x, '#c25a4a', cx - 1, 7 + cr, 3, 1);
          blob(x, cx, 11 + cr, 4, 3, F, 13);
          if (pose === 'h') { closed(x, cx - 3, 9 + cr); closed(x, cx + 2, 9 + cr); } else { eye(x, E, cx - 3, 10 + cr, 2, 2); eye(x, E, cx + 2, 10 + cr, 2, 2); eye(x, E, cx - 1, 9 + cr); eye(x, E, cx + 1, 9 + cr); px(x, '#fff7d0', cx - 3, 10 + cr); px(x, '#fff7d0', cx + 2, 10 + cr); }
          r(x, BONE, cx - 2, 13 + cr, 1, 2); r(x, BONE, cx + 1, 13 + cr, 1, 2);
        }
      }
    }, SOFT);
  }

  // ---------- งู ----------
  function snake(d, fr, pose) {
    const { w, h } = SIZE.snake, F = pal('snake', pose), E = eyeCol(pose), cx = w / 2, ph = fr * Math.PI / 2;
    return mk(w, h, (x) => {
      const stamp = (X, Y, rad, i) => {
        ell(x, Math.round(X), Math.round(Y) + 1, rad, rad, F[1]); ell(x, Math.round(X), Math.round(Y), rad, rad, i % 5 === 4 ? F[0] : F[2]);
        if (rad > 1) px(x, F[3], X - 1, Y - 1); if (i % 5 === 2) px(x, F[0], X, Y);
      };
      if (d === 3) {
        const N = 26, pts = []; let hx, hy;
        for (let i = 0; i <= N; i++) {
          const t = i / N; let X, Y;
          if (pose === 'w') { X = 5 + t * 14; Y = 9 + Math.sin(t * 9) * 2.6 * (1 - t * .3) - t * t * t * 5; }
          else if (pose === 'a') { X = 2 + t * 24; Y = 9 + Math.sin(t * 5) * .6; }
          else { X = 3 + t * 21; Y = 8.5 + Math.sin(t * 7 + ph) * 2.4 * (1 - t * .6); }
          pts.push([X, Y]);
        }
        pts.forEach((p, i) => stamp(p[0], p[1], i < 5 ? 1 : 2, i));
        [hx, hy] = pts[N];
        ell(x, hx + 2, hy, 4, 2, F[2]); r(x, F[3], hx, hy - 2, 4, 1); r(x, F[1], hx - 1, hy + 2, 6, 1); r(x, F[2], hx + 4, hy, 2, 1);
        if (pose === 'h') closed(x, hx + 1, hy - 2); else { eye(x, E, hx + 2, hy - 1); px(x, '#fff7d0', hx + 2, hy - 1); }
        if (pose === 'a') { r(x, '#3a1a22', hx + 3, hy + 1, 3, 1); px(x, BONE, hx + 3, hy + 2); px(x, BONE, hx + 5, hy + 2); }
        else if (pose !== 'h') { const t = (fr & 1); r(x, '#d94a3a', hx + 6, hy, 2, 1); px(x, '#d94a3a', hx + 8, hy - 1 + t * 2); px(x, '#d94a3a', hx + 8, hy + 1 - t * 2 + (t ? 0 : 0)); }
      } else {
        const back = d === 1, sway = pose === 'n' ? Math.round(Math.sin(ph) * 1) : 0, hy = pose === 'w' ? 3 : pose === 'a' ? 7 : 5, hx = cx + sway;
        blob(x, cx, 11, 8, 2, F, 14); r(x, F[0], cx - 5, 11, 1, 2); r(x, F[0], cx + 4, 11, 1, 2); r(x, F[0], cx, 12, 1, 2);
        for (let i = 0; i < 8; i++) stamp(cx + (hx - cx) * (1 - i / 8) * 0 + (hx - cx) * (i < 4 ? 0 : (i - 3) / 5), hy + 3 + i, 2, i);
        const hw = pose === 'a' ? 4 : 3; blob(x, hx, hy, hw, hw, F, 15);
        if (back) { px(x, F[0], hx - 1, hy); px(x, F[0], hx + 1, hy); px(x, F[0], hx, hy + 1); px(x, F[0], hx, hy - 1); }
        else {
          if (pose === 'h') { closed(x, hx - 3, hy - 2); closed(x, hx + 2, hy - 2); } else { eye(x, E, hx - 2, hy - 1); eye(x, E, hx + 2, hy - 1); px(x, '#fff7d0', hx - 2, hy - 1); px(x, '#fff7d0', hx + 2, hy - 1); }
          if (pose === 'a') { r(x, '#3a1a22', hx - 2, hy + 1, 5, 2); px(x, BONE, hx - 2, hy + 3); px(x, BONE, hx + 2, hy + 3); }
          else if (pose !== 'h') { r(x, '#d94a3a', hx, hy + hw, 1, 2); px(x, '#d94a3a', hx - 1 + (fr & 1) * 2, hy + hw + 2); }
        }
      }
    }, SOFT);
  }

  // ---------- ยักษ์หิน ----------
  function golem(d, fr, pose) {
    const { w, h } = SIZE.golem, F = pal('golem', pose), E = eyeCol(pose), cx = w / 2, bob = pose === 'n' ? (fr & 1) : 0, cr = pose === 'w' ? 1 : pose === 'a' ? 3 : 0;
    const crack = (x, X, Y, n) => { let a = X, b = Y; for (let i = 0; i < n; i++) { px(x, F[0], a, b); a += i % 2 ? 1 : 0; b += 1; if (i % 3 === 2) a -= 1; } };
    const moss = (x, X, Y) => { r(x, MOSS, X, Y, 3, 1); r(x, MOSS2, X + 1, Y + 1, 2, 1); px(x, '#8cae72', X, Y); };
    const lA = pose === 'n' ? (fr === 0 ? -2 : fr === 2 ? 2 : 0) : 0; // แกว่งแขน
    return mk(w, h, (x) => {
      const ey = (X, Y, ww) => { if (pose === 'h') { closed(x, X, Y - 1); } else { r(x, E, X, Y, ww, 2); px(x, '#fff7d0', X, Y); } };
      if (d === 3) {
        const lf = fr === 1 ? -2 : 0, lb = fr === 3 ? -2 : 0;
        blob(x, cx - 5, 38 + lb, 4, 5, [F[0], F[0], F[1], F[1], F[2]], 20); // ขาหลัง (เข้ม)
        // แขนไกล
        blob(x, cx - 2, 21 + cr, 3, 6, [F[0], F[0], F[1], F[1], F[2]], 21); blob(x, cx - 2, 29 + cr + (pose === 'n' ? -lA / 2 : 0), 4, 3, [F[0], F[0], F[1], F[1], F[2]], 22);
        blob(x, cx + 3, 38 + lf, 4, 5, F, 23);
        blob(x, cx - 1, 21 + bob + cr, 9, 10, F, 24); moss(x, cx - 6, 13 + bob + cr); crack(x, cx - 3, 22 + bob + cr, 5); r(x, F[3], cx + 2, 28 + bob + cr, 4, 1);
        blob(x, cx + 5, 9 + bob + cr, 5, 5, F, 25); r(x, F[0], cx + 5, 7 + bob + cr, 5, 1); ey(cx + 8, 9 + bob + cr, 2); moss(x, cx + 2, 4 + bob + cr);
        if (pose === 'w') { blob(x, cx + 3, 11, 3, 7, F, 26); blob(x, cx + 3, 3, 4, 4, F, 27); }
        else if (pose === 'a') { blob(x, cx + 7, 31, 3, 7, F, 26); blob(x, cx + 11, 38, 5, 4, F, 27); }
        else { blob(x, cx + 3 + lA, 22 + bob, 3, 7, F, 26); blob(x, cx + 3 + lA * 1, 30 + bob, 4, 4, F, 27); }
      } else {
        const back = d === 1, lf = fr === 1 ? -2 : 0, rt = fr === 3 ? -2 : 0, sA = pose === 'n' ? (fr === 0 ? -2 : fr === 2 ? 2 : 0) : 0;
        blob(x, cx - 6, 38 + lf, 4, 5, F, 30); blob(x, cx + 6, 38 + rt, 4, 5, F, 31); r(x, F[3], cx - 8, 34 + lf, 2, 1); r(x, F[3], cx + 4, 34 + rt, 2, 1);
        blob(x, cx, 21 + bob + cr, 11, 10, F, 32);
        if (!back) { r(x, F[0], cx - 4, 17 + bob + cr, 9, 1); r(x, E, cx - 1, 20 + bob + cr, 3, 3); if (pose === 'n' || pose === 'h') r(x, shade(E, -.3), cx - 1, 22 + bob + cr, 3, 1); crack(x, cx + 5, 22 + bob + cr, 6); }
        else { crack(x, cx - 2, 15 + bob + cr, 8); crack(x, cx + 4, 22 + bob + cr, 5); r(x, F[1], cx - 6, 27 + bob + cr, 12, 1); }
        moss(x, cx - 9, 14 + bob + cr); moss(x, cx + 5, 13 + bob + cr); if (back) moss(x, cx - 4, 25 + bob + cr);
        blob(x, cx, 9 + bob + cr, 6, 5, F, 33); r(x, F[0], cx - 5, 7 + bob + cr, 11, 1);
        if (!back) { ey(cx - 4, 9 + bob + cr, 3); ey(cx + 2, 9 + bob + cr, 3); r(x, F[0], cx - 2, 13 + bob + cr, 5, 1); } else { r(x, F[1], cx - 3, 6 + bob + cr, 6, 1); moss(x, cx - 2, 4 + bob + cr); }
        if (pose === 'w') { for (const s of [-1, 1]) { blob(x, cx + s * 13, 11, 3, 6, F, 34 + s); blob(x, cx + s * 13, 3, 4, 4, F, 36 + s); } }
        else if (pose === 'a') { for (const s of [-1, 1]) { blob(x, cx + s * 13, 30, 3, 7, F, 34 + s); blob(x, cx + s * 11, 39, 5, 4, F, 36 + s); } }
        else for (const [s, a] of [[-1, sA], [1, -sA]]) { blob(x, cx + s * 14, 22 + bob, 3, 7, F, 34 + s); blob(x, cx + s * 14, 30 + bob + a, 4, 4, F, 36 + s); }
      }
    }, SOFT);
  }

  const BUILD = { rat, bat, spider, snake, golem };
  const SH = { rat: [8, 3], bat: [7, 2.5], spider: [10, 3.5], snake: [13, 3.5], golem: [16, 5] }; // เงาครึ่งกว้าง/ครึ่งสูง
  const cache = new Map();
  function sprite(k, d, pose, fr) {
    const key = k + '|' + d + '|' + pose + '|' + fr; let s = cache.get(key);
    if (!s) { s = BUILD[k](d, fr, pose); cache.set(key, s); } return s;
  }
  function draw(ctx, c, now) {
    const B = BUILD[c.k]; if (!B) return false;
    const st = c.st | 0, pose = st === 2 ? 'w' : st === 3 ? 'a' : st === 4 ? 'h' : 'n', dir = c.dir | 0, flip = dir === 2, d = flip ? 3 : dir;
    const fr = pose === 'n' ? (Math.floor(now / (st === 1 ? 100 : 170)) + (c.id | 0)) & 3 : Math.floor(now / 90) & 1;
    const { w, h } = SIZE[c.k], spr = sprite(c.k, d, pose, fr), gx = Math.round(c.x), gy = Math.round(c.y);
    const lift = c.k === 'bat' ? 9 + Math.round(Math.sin(now / 180 + (c.id | 0)) * 2) : 0, sh = SH[c.k], sw = sh[0] * (d === 3 ? 1 : c.k === 'snake' ? .6 : 1);
    let jx = 0; if (pose === 'w') jx = (fr & 1) ? 1 : -1; else if (pose === 'h') jx = (Math.floor(now / 50) & 1) ? 2 : -2;
    ctx.fillStyle = 'rgba(24,34,52,' + (c.k === 'bat' ? .22 : .3) + ')'; ctx.beginPath(); ctx.ellipse(gx, gy, sw, sh[1], 0, 0, 7); ctx.fill();
    ctx.imageSmoothingEnabled = false;
    const ax = (w >> 1) + 1, top = gy - h - lift;
    if (flip) { ctx.save(); ctx.translate(gx + jx, 0); ctx.scale(-1, 1); ctx.drawImage(spr, -ax, top); ctx.restore(); } else ctx.drawImage(spr, gx + jx - ax, top);
    return true;
  }
  const size = k => SIZE[k] || { w: 24, h: 24 };
  return { draw, size };
})();
