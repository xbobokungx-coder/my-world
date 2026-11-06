// ตัวอย่างร้านอาหารตามภาพอ้างอิง (ยังไม่ใส่เกม) — ความละเอียด HD: 1 พิกเซลอาร์ต = 1 พิกเซลจอในเกม (32 ต่อช่อง)
// โครง: จั่วชันไม้ปิดจั่วหนา · หน้าจั่วครีมโครงไม้ + ป้ายถ้วย · ป้ายชื่อไม้มน · กันสาดลอนกลางร้าน
// ช่องข้างมืดมีตะกร้าดอกไม้ · ผ้าใบเฉียงซ้าย(ม่วง)ขวา(แดง) · ถังไม้ กระดานเมนู โต๊ะ กระบะดอกไม้
(() => {
  const { mk, r, ell, disc } = PixelArt;
  const SOFT = { soft: ['#3a2416', '#6e4a30'] };
  const OY = 30, W = 134, H = 132 + OY, CX = 62;

  const WOOD = ['#3e2414', '#5e3a20', '#7e5030', '#a06a40', '#c08a58'];
  const SH = ['#4e2e1c', '#6a3e26', '#86522f', '#a2683c', '#bc8250'];   // กระเบื้องไม้หลังคา
  const CREAM = ['#cdb48a', '#e6d3ae', '#f6ead0', '#fff6e4'];
  const LIGHT = ['#d88a2a', '#f0b440', '#ffd868', '#fff2b0'];
  // หลังคามองจากหน้า-บน: สันหลังคาวิ่งลงกลางจอ เห็นผืนกระเบื้องสองฝั่ง แล้วจั่วหน้าอยู่ด้านล่าง
  const RT = -12, GT = 6, EAVE = 56, SLOPE = 0.95;
  const roofHw = y => 5 + (y - RT) * 0.82;
  const lerpHw = (y, k) => (y - GT) * SLOPE + 2 + k;

  function roof(x) {
    for (let y = RT; y <= EAVE - 2; y++) {
      const t = y - RT, hw = Math.round(roofHw(y)), row = t >> 2, ly = t & 3;
      for (let xx = CX - hw; xx <= CX + hw; xx++) {
        const side = xx < CX ? 0 : 1, d = Math.abs(xx - CX), sx = ((d + row * 3) % 7 + 7) % 7;
        let k = side ? 2 : 3;
        if (ly === 3) k -= 2; else if (sx === 0) k -= 1; else if (ly === 0 && sx < 4) k += 1;
        if (d > hw - 3) k += side ? -1 : 1;
        r(x, SH[Math.max(0, Math.min(4, k))], xx, y, 1, 1);
      }
      // ขอบชายคาไม้ด้านนอก
      r(x, WOOD[1], CX - hw - 1, y, 2, 1); r(x, WOOD[0], CX + hw, y, 2, 1);
    }
    // สันหลังคา
    for (let y = RT - 2; y < GT + 2; y++) { r(x, WOOD[3], CX - 2, y, 2, 1); r(x, WOOD[1], CX, y, 2, 1); r(x, WOOD[0], CX + 2, y, 1, 1); }
    r(x, WOOD[0], CX - 3, RT - 4, 7, 3); r(x, WOOD[3], CX - 2, RT - 4, 3, 1);
  }

  function bargeboards(x) {
    // ไม้ปิดจั่วหนา 6 px รูปตัว A + ยอดจั่ว
    for (let y = GT; y <= EAVE + 2; y++) {
      const o = Math.round(lerpHw(y, 0)), i = Math.round(lerpHw(y, -7));
      for (const s of [-1, 1]) {
        const a = CX + s * Math.max(i, 0), b = CX + s * o;
        const lo = Math.min(a, b), hi = Math.max(a, b);
        r(x, WOOD[2], lo, y, hi - lo + 1, 1);
        r(x, s < 0 ? WOOD[4] : WOOD[3], s < 0 ? lo : hi - 1, y, 1, 1);   // ขอบบนรับแสง
        r(x, WOOD[0], s < 0 ? hi : lo, y, 1, 1);                          // ขอบใน
        if ((y & 7) === 0) r(x, WOOD[1], lo + 2, y, hi - lo - 3, 1);       // ลายไม้
      }
    }
    r(x, WOOD[1], CX - 4, GT - 3, 9, 6); r(x, WOOD[3], CX - 3, GT - 3, 4, 1); r(x, WOOD[0], CX - 4, GT + 2, 9, 1);
  }

  function gable(x) {
    // หน้าจั่วครีม + เสาไม้ 2 ต้น + ป้ายถ้วยแดง
    for (let y = GT; y <= EAVE; y++) {
      const hw = Math.round(lerpHw(y, -7));
      if (hw <= 0) continue;
      r(x, CREAM[1], CX - hw, y, hw * 2 + 1, 1);
      r(x, CREAM[2], CX - hw, y, Math.max(1, Math.round(hw * .45)), 1);
      r(x, CREAM[0], CX + hw - 2, y, 3, 1);
    }
    for (const px of [CX - 17, CX + 15]) {
      const y0 = GT + 24;
      r(x, WOOD[1], px, y0, 3, EAVE - y0); r(x, WOOD[3], px, y0, 1, EAVE - y0);
    }
    // ป้ายไอคอน
    const bx = CX - 10, by = 23;
    r(x, WOOD[0], bx, by, 21, 19); r(x, WOOD[2], bx + 1, by + 1, 19, 17); r(x, '#f8efde', bx + 3, by + 3, 15, 13);
    r(x, '#e8dcc4', bx + 3, by + 14, 15, 2);
    // ถ้วยแดงมีหูจับ + ไอ
    r(x, '#a82e2a', bx + 6, by + 7, 9, 7); r(x, '#d8443a', bx + 6, by + 7, 7, 6); r(x, '#f07060', bx + 7, by + 8, 2, 3);
    r(x, '#a82e2a', bx + 15, by + 8, 2, 4); r(x, '#f8efde', bx + 15, by + 9, 1, 2);
    r(x, '#7e2420', bx + 5, by + 13, 11, 1);
    r(x, '#f2c14e', bx + 8, by + 4, 2, 2); r(x, '#f2c14e', bx + 11, by + 5, 2, 2);
  }

  function chimney(x) {
    const X = CX + 20, Y = -6, Wd = 12, Hh = 20;
    r(x, '#4e4c56', X, Y, Wd, Hh);
    for (let yy = Y; yy < Y + Hh; yy += 4) for (let xx = X + ((yy >> 2) & 1 ? 0 : 3); xx < X + Wd; xx += 6) {
      r(x, '#86838e', xx, yy, 5, 3); r(x, '#a8a5b0', xx, yy, 4, 1); r(x, '#6a6872', xx + 4, yy, 1, 3);
    }
    r(x, '#3a3842', X - 2, Y - 2, Wd + 4, 4); r(x, '#7a7882', X - 1, Y - 2, Wd + 2, 1); r(x, '#24222a', X + 2, Y - 1, Wd - 4, 1);
  }

  function beam(x) {
    // คานขวางใต้ชายคา
    r(x, WOOD[0], 8, EAVE - 1, 110, 6); r(x, WOOD[2], 9, EAVE, 108, 4); r(x, WOOD[3], 9, EAVE, 108, 1);
    for (const px of [10, 26, 98, 114]) r(x, WOOD[4], px, EAVE + 2, 1, 1);
  }

  function nameBoard(x) {
    // ป้ายไม้มนมุม ทับคาน
    const X = CX - 28, Y = EAVE - 9, Wd = 57, Hh = 15;
    r(x, WOOD[0], X + 2, Y, Wd - 4, Hh); r(x, WOOD[0], X, Y + 2, Wd, Hh - 4); r(x, WOOD[0], X + 1, Y + 1, Wd - 2, Hh - 2);
    r(x, WOOD[2], X + 2, Y + 2, Wd - 4, Hh - 4); r(x, WOOD[1], X + 2, Y + Hh - 4, Wd - 4, 2);
    r(x, WOOD[3], X + 3, Y + 2, Wd - 6, 1);
    for (const px of [X + 4, X + Wd - 5]) { r(x, '#d8b070', px, Y + 6, 1, 1); }
    r(x, '#2e1a0e', X + 10, Y - 4, 1, 4); r(x, '#2e1a0e', X + Wd - 11, Y - 4, 1, 4);   // โซ่แขวน
  }

  function walls(x) {
    // ช่องข้างมืด (ซ้าย/ขวา) + ผนังครีมกลาง + เสา + ฐานหิน
    for (const [X0, X1] of [[11, 26], [98, 113]]) {
      r(x, '#3a2a1e', X0, EAVE + 4, X1 - X0, 108 - EAVE - 4);
      r(x, '#4a3626', X0, EAVE + 4, X1 - X0, 3);
      r(x, '#2a1e16', X0, 100, X1 - X0, 8);
      for (let yy = EAVE + 12; yy < 100; yy += 9) r(x, '#46342a', X0 + 1, yy, X1 - X0 - 2, 1);   // ไม้ฝาด้านใน
    }
    r(x, CREAM[1], 26, EAVE + 4, 72, 108 - EAVE - 4);
    for (let yy = EAVE + 9; yy < 108; yy += 5) r(x, CREAM[0], 26, yy, 72, 1);
    for (let yy = EAVE + 6; yy < 108; yy += 5) r(x, CREAM[2], 26, yy, 72, 1);
    r(x, 'rgba(60,30,12,.22)', 26, EAVE + 4, 72, 3);
    for (const px of [8, 24, 96, 113]) { r(x, WOOD[1], px, EAVE + 4, 4, 108 - EAVE - 4); r(x, WOOD[3], px + 1, EAVE + 4, 1, 108 - EAVE - 4); r(x, WOOD[0], px + 3, EAVE + 4, 1, 108 - EAVE - 4); }
    // ฐานหิน
    r(x, '#6e6458', 6, 106, 113, 6);
    for (let xx = 6, k = 0; xx < 119; xx += 7, k++) { r(x, k & 1 ? '#a89c8a' : '#968a78', xx + 1, 107, 5, 3); r(x, '#c2b6a2', xx + 1, 107, 3, 1); }
  }

  function awning(x) {
    // กันสาดลายแดง ขาว ฟ้า ขาว ขอบลอนครึ่งวงกลม
    const X = 27, Y = EAVE + 6, Wd = 70, cols = ['#cc3a30', '#f6efe2', '#3e6ec0', '#f6efe2'], dark = ['#962a24', '#d8cfc0', '#2c5090', '#d8cfc0'];
    for (let i = 0; i < Wd; i++) {
      const k = Math.floor(i / 7) % 4;
      r(x, cols[k], X + i, Y, 1, 8);
      r(x, dark[k], X + i, Y + 6, 1, 2);
      r(x, 'rgba(255,255,255,.3)', X + i, Y, 1, 1);
    }
    for (let s = 0; s < Wd / 7; s++) {
      const k = s % 4, cx = X + s * 7 + 3;
      ell(x, cx, Y + 8, 3, 3, dark[k]); ell(x, cx, Y + 7, 3, 2, cols[k]);
    }
    r(x, WOOD[0], X - 1, Y - 1, Wd + 2, 2);
    r(x, 'rgba(50,24,10,.3)', X, Y + 11, Wd, 3);
  }

  function windowWarm(x, X, Y) {
    r(x, WOOD[0], X - 2, Y - 2, 18, 19); r(x, WOOD[2], X - 1, Y - 1, 16, 17);
    r(x, LIGHT[1], X, Y, 14, 14);
    r(x, LIGHT[2], X, Y, 14, 9); r(x, LIGHT[3], X + 1, Y + 1, 4, 3); r(x, LIGHT[3], X + 8, Y + 1, 2, 2);
    r(x, LIGHT[0], X, Y + 12, 14, 2);
    r(x, WOOD[1], X + 6, Y, 2, 14); r(x, WOOD[1], X, Y + 6, 14, 2);
    r(x, WOOD[3], X - 3, Y + 15, 20, 3); r(x, WOOD[1], X - 3, Y + 17, 20, 1);
  }

  function door(x) {
    const X = CX - 8, Y = 76, Wd = 17, Hh = 31;
    r(x, WOOD[0], X - 2, Y + 2, Wd + 4, Hh); r(x, WOOD[0], X, Y - 1, Wd, 4); r(x, WOOD[0], X - 1, Y, Wd + 2, 3);
    r(x, '#2a6e6a', X, Y + 2, Wd, Hh - 2); r(x, '#2a6e6a', X + 2, Y, Wd - 4, 2); r(x, '#2a6e6a', X + 1, Y + 1, Wd - 2, 1);
    r(x, '#409890', X + 1, Y + 3, 2, Hh - 4); r(x, '#1c4e4a', X + Wd - 2, Y + 3, 2, Hh - 4);
    for (const yy of [Y + 18, Y + 24]) r(x, '#22605c', X + 2, yy, Wd - 4, 1);
    // หน้าต่างโค้งบนประตู
    r(x, WOOD[1], X + 3, Y + 4, 11, 10); r(x, LIGHT[2], X + 5, Y + 4, 7, 9); r(x, LIGHT[2], X + 4, Y + 6, 9, 7);
    r(x, LIGHT[3], X + 5, Y + 6, 3, 2); r(x, LIGHT[1], X + 4, Y + 11, 9, 2);
    r(x, '#f2c14e', X + Wd - 4, Y + 17, 2, 2);
    r(x, '#8e8272', X - 3, Y + Hh, Wd + 6, 2); r(x, '#b2a690', X - 3, Y + Hh, Wd + 6, 1);   // ขั้นบันได
  }

  function basket(x, cx, Y) {
    r(x, '#1e140c', cx, Y - 10, 1, 4);
    for (let i = 0; i < 6; i++) { r(x, '#1e140c', cx - 1 - i, Y - 6 + i, 1, 1); r(x, '#1e140c', cx + 1 + i, Y - 6 + i, 1, 1); }
    ell(x, cx, Y + 1, 7, 3, '#2e7a30'); ell(x, cx - 1, Y, 5, 2, '#4ca444');
    for (const [dx, dy, c] of [[-6, -1, '#ff8fc7'], [-3, -2, '#d86ab0'], [0, -3, '#ffb0dc'], [3, -2, '#ff8fc7'], [5, 0, '#d86ab0'], [-4, 1, '#ffb0dc'], [1, 0, '#e070b8']]) {
      r(x, c, cx + dx, Y + dy, 3, 2); r(x, '#fff0f6', cx + dx, Y + dy, 1, 1);
    }
    r(x, WOOD[0], cx - 7, Y + 3, 15, 7); r(x, WOOD[2], cx - 6, Y + 3, 13, 5); r(x, WOOD[3], cx - 6, Y + 3, 13, 1);
    for (let xx = cx - 5; xx < cx + 6; xx += 3) r(x, WOOD[1], xx, Y + 4, 1, 4);
    r(x, '#2e7a30', cx - 6, Y + 10, 1, 4); r(x, '#4ca444', cx + 5, Y + 10, 1, 3); r(x, '#2e7a30', cx - 1, Y + 10, 1, 2);
  }

  function sideAwning(x, side) {
    // ผ้าใบเฉียงกางออกด้านข้าง: ซ้ายลายนอนม่วง/ขาว ขวาลายเฉียงแดง/ครีม
    const L = side < 0;
    const cols = L ? ['#7e52b8', '#efe8f6', '#56368a', '#c4b8d8'] : ['#c8402e', '#f4e4c4', '#902a1e', '#d4bc94'];
    const Y = L ? EAVE + 2 : EAVE - 10, Hh = L ? 24 : 34, Wd = L ? 20 : 22;
    for (let y = 0; y < Hh; y++) {
      const out = Math.floor(y * (L ? .55 : .45));
      for (let i = 0; i < Wd; i++) {
        const xx = L ? 26 - i - out : 98 + i + out;
        const band = L ? Math.floor(y / 4) & 1 : Math.floor((i + y) / 5) & 1;
        let c = cols[band];
        if (y >= Hh - 3) c = cols[band + 2];
        if (i === Wd - 1) c = cols[2];
        r(x, c, xx, (L ? Y : Y + Math.floor(i * .5)) + y, 1, 1);
      }
    }
    // ขอบล่างลอน
    for (let i = 0; i < Wd; i += 4) {
      const out = Math.floor(Hh * (L ? .55 : .45)), xx = L ? 26 - i - out - 2 : 98 + i + out + 1, yy = (L ? Y : Y + Math.floor(i * .5)) + Hh;
      r(x, cols[2], xx, yy, 2, 1);
    }
  }

  function chalkboard(x, X, Y, lines) {
    r(x, WOOD[0], X + 2, Y + 18, 2, 8); r(x, WOOD[0], X + 14, Y + 18, 2, 8);
    r(x, WOOD[0], X, Y, 18, 20); r(x, WOOD[2], X + 1, Y + 1, 16, 18);
    r(x, '#24302a', X + 2, Y + 2, 14, 15); r(x, '#2e3c34', X + 2, Y + 2, 14, 1);
    lines.forEach(([dy, w, c]) => r(x, c, X + 4, Y + 4 + dy, w, 1));
  }

  function table(x, cx, cy) {
    r(x, WOOD[0], cx - 1, cy + 3, 3, 9); r(x, WOOD[0], cx - 5, cy + 11, 11, 2);
    ell(x, cx, cy, 10, 5, WOOD[1]); ell(x, cx, cy - 1, 9, 4, WOOD[3]); ell(x, cx - 2, cy - 2, 5, 2, WOOD[4]);
    // ม้านั่งเล็ก
    ell(x, cx - 14, cy + 8, 4, 2, WOOD[2]); r(x, WOOD[0], cx - 15, cy + 9, 2, 5);
  }

  function flowerBox(x, X, Y) {
    for (const [dx, dy, rx, c] of [[3, 3, 4, '#2e7a30'], [10, 1, 5, '#3e9038'], [17, 2, 5, '#2e7a30'], [24, 3, 4, '#3e9038']]) ell(x, X + dx, Y + dy, rx, 3, c);
    for (const [dx, dy, c] of [[1, 0, '#ff8fc7'], [5, -2, '#ffe37a'], [9, -3, '#c79bff'], [13, -1, '#ff8fc7'], [16, -3, '#9fd4ff'], [20, -1, '#ffe37a'], [24, 0, '#c79bff'], [7, 2, '#ffb0dc'], [18, 2, '#ff8fc7']]) {
      r(x, c, X + dx, Y + dy, 3, 3); r(x, '#fff8e8', X + dx + 1, Y + dy + 1, 1, 1);
    }
    r(x, WOOD[0], X - 1, Y + 5, 30, 11); r(x, WOOD[2], X, Y + 6, 28, 9); r(x, WOOD[3], X, Y + 6, 28, 1);
    r(x, WOOD[1], X, Y + 10, 28, 1); r(x, WOOD[1], X + 13, Y + 6, 1, 9);
  }

  function barrel(x, X, Y) {
    r(x, WOOD[0], X, Y + 1, 16, 18); r(x, WOOD[1], X + 1, Y, 14, 20);
    r(x, WOOD[2], X + 2, Y, 10, 20); r(x, WOOD[3], X + 3, Y, 3, 20); r(x, WOOD[0], X + 13, Y, 2, 20);
    for (const yy of [Y + 3, Y + 15]) { r(x, '#4e4c56', X, yy, 16, 2); r(x, '#8a8894', X + 2, yy, 6, 1); }
    ell(x, X + 8, Y, 7, 2, WOOD[0]); ell(x, X + 8, Y, 6, 1, WOOD[1]);
  }

  function makeFoodShop() {
    const spr = mk(W, H, (x) => {
      x.translate(0, OY);
      ell(x, CX, 112, 60, 6, 'rgba(30,18,8,.22)');
      barrel(x, 116, 72); barrel(x, 114, 92);
      roof(x);
      chimney(x);
      gable(x);
      bargeboards(x);
      walls(x);
      sideAwning(x, -1); sideAwning(x, 1);
      beam(x);
      awning(x);
      windowWarm(x, 32, 80); windowWarm(x, 78, 80);
      door(x);
      basket(x, 18, 84); basket(x, 106, 84);
      nameBoard(x);
      chalkboard(x, 6, 104, [[0, 9, '#e8e8e0'], [3, 7, '#c8d8c8'], [6, 10, '#e8e8e0'], [9, 5, '#f8d060']]);
      chalkboard(x, 102, 104, [[0, 8, '#f8d060'], [3, 10, '#e8e8e0'], [6, 6, '#e8e8e0'], [9, 8, '#c8d8c8']]);
      table(x, 40, 114);
      flowerBox(x, 72, 114);
    }, SOFT);
    // ควันปล่องไฟ (ไม่มีขอบ)
    const g = spr.getContext('2d');
    for (const [dx, dy, rd, a] of [[0, 0, 4, .55], [3, -7, 5, .42], [0, -14, 6, .28]]) {
      g.fillStyle = `rgba(232,230,238,${a})`;
      for (let yy = -rd; yy <= rd; yy++) { const w = Math.floor(Math.sqrt(rd * rd - yy * yy) + .5); g.fillRect(1 + CX + 26 + dx - w, 1 + OY - 12 + dy + yy, w * 2 + 1, 1); }
    }
    return spr;
  }

  // พิกัดกลางป้ายชื่อ (พิกเซลสไปรต์ รวมขอบ 1 px) และขนาดตัวอักษร ให้หน้าตัวอย่างเขียนทับ
  window.ShopSample = { food: makeFoodShop, label: { x: 1 + CX, y: 1 + OY + EAVE - 3, size: 10 } };
})();
