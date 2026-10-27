// ตัวอย่างร้านอาหารตามภาพอ้างอิง (ยังไม่ใส่เกม) — วาดที่ 16 px ต่อช่อง แล้วขยาย ×2 แบบเกม
// หลังคาจั่ว + ปล่องไฟ + กันสาดลายทางขอบหยัก + หน้าต่างไฟอุ่น + ตะกร้าดอกไม้ + ของแต่งหน้าร้าน
(() => {
  const { mk, r, ell, disc } = PixelArt;
  const SOFT = { soft: ['#3d2a1a', '#7a5a3a'] };
  const BX = 12, BW = 64;    // ตัวร้านกว้าง 64 (4 ช่อง) เว้นซ้ายให้ผ้าใบ ขวาให้ถังไม้
  const OY = 12, W0 = BX + BW + 13, H0 = 76 + OY;   // OY = ที่ว่างให้ควัน

  const ROOF = ['#4a2c18', '#6e4426', '#8a5634', '#a86e44', '#c48a58'];
  const WOOD = ['#4a2e18', '#6b4423', '#8b5a2b', '#a8703f'];
  const CREAM = ['#d8c49c', '#efe0c0', '#fbf2dc'];

  function gableRoof(x) {
    const cx = BX + BW / 2, top = 4, base = 34;
    for (let y = top; y <= base; y++) {
      const hw = Math.round((y - top + 1) * (BW / 2 + 3) / (base - top + 1));
      for (let xx = cx - hw; xx <= cx + hw; xx++) {
        const row = Math.floor((y - top) / 3), lx = (xx + row * 2) & 3, ly = (y - top) % 3;
        let c = ROOF[2];
        if (ly === 0) c = ROOF[1];
        else if (lx === 0) c = ROOF[1];
        else if (ly === 1 && lx === 1) c = ROOF[3];
        if (xx < cx - hw * 0.35 && ly !== 0) c = ROOF[3];           // แสงซ้าย
        if (xx > cx + hw * 0.55 && ly !== 0) c = ROOF[1];           // เงาขวา
        r(x, c, xx, y, 1, 1);
      }
      // ไม้ปิดจั่ว (bargeboard) ขอบหนา
      r(x, WOOD[1], cx - hw - 1, y, 3, 1); r(x, WOOD[3], cx - hw, y, 1, 1);
      r(x, WOOD[1], cx + hw - 1, y, 3, 1); r(x, WOOD[0], cx + hw + 1, y, 1, 1);
    }
    // ยอดจั่ว + ชายคาหยักลอน
    r(x, WOOD[0], cx - 2, top - 2, 5, 3); r(x, WOOD[3], cx - 1, top - 2, 2, 1);
    for (let xx = BX - 3; xx <= BX + BW + 3; xx++) {
      const dip = (xx & 3) === 1 || (xx & 3) === 2;
      r(x, WOOD[1], xx, base + 1, 1, dip ? 3 : 2);
      if (dip) r(x, WOOD[2], xx, base + 1, 1, 1);
    }
  }

  function chimney(x) {
    const X = BX + 44, Y = 6;
    r(x, '#5c5a62', X, Y, 9, 16);
    for (let yy = Y; yy < Y + 16; yy += 3) for (let xx = X + ((yy / 3) & 1 ? 0 : 2); xx < X + 9; xx += 4) { r(x, '#8d8a94', xx, yy, 3, 2); r(x, '#b0adb8', xx, yy, 1, 1); }
    r(x, '#3e3c44', X - 1, Y - 1, 11, 3); r(x, '#7a7882', X, Y - 1, 9, 1);
  }

  function gableFace(x) {
    // หน้าจั่วสีครีม + โครงไม้ (half-timber) + ป้ายไอคอน
    const cx = BX + BW / 2, top = 14, base = 34;
    for (let y = top; y <= base; y++) {
      const hw = Math.round((y - top + 1) * 15 / (base - top + 1));
      r(x, CREAM[1], cx - hw, y, hw * 2 + 1, 1);
      r(x, CREAM[2], cx - hw, y, Math.max(1, hw >> 1), 1);
      r(x, CREAM[0], cx + hw - 1, y, 2, 1);
      r(x, WOOD[1], cx - hw - 1, y, 2, 1); r(x, WOOD[1], cx + hw, y, 2, 1);
    }
    // ป้ายไอคอน (ถ้วยแดง) กรอบไม้
    r(x, WOOD[0], cx - 6, 18, 13, 11); r(x, '#f6efe2', cx - 5, 19, 11, 9);
    r(x, '#c8423a', cx - 3, 22, 7, 5); r(x, '#e8604e', cx - 3, 22, 7, 1); r(x, '#9e2f29', cx - 3, 26, 7, 1);
    r(x, '#c8423a', cx + 4, 23, 2, 2); r(x, '#e8c04a', cx - 2, 20, 2, 2); r(x, '#e8c04a', cx + 1, 20, 2, 2);
  }

  function nameBoard(x) {
    const X = BX + 12, Y = 34, Wd = BW - 24;
    r(x, WOOD[0], X - 1, Y - 1, Wd + 2, 10); r(x, WOOD[2], X, Y, Wd, 8);
    r(x, WOOD[3], X, Y, Wd, 1); r(x, WOOD[1], X, Y + 7, Wd, 1);
    r(x, '#c9984f', X + 2, Y + 3, 1, 1); r(x, '#c9984f', X + Wd - 3, Y + 3, 1, 1);
  }

  function wallBody(x) {
    const Y = 36, B = 70;
    r(x, CREAM[1], BX + 2, Y, BW - 4, B - Y);
    for (let yy = Y + 4; yy < B; yy += 4) r(x, CREAM[0], BX + 2, yy, BW - 4, 1);
    r(x, CREAM[2], BX + 2, Y + 1, BW - 4, 1);
    // เสาไม้มุมตึก + คานล่าง
    for (const px of [BX, BX + BW - 4]) { r(x, WOOD[1], px, Y - 2, 4, B - Y + 2); r(x, WOOD[3], px + 1, Y - 2, 1, B - Y + 2); }
    r(x, '#8e8373', BX - 1, B - 2, BW + 2, 3);
    for (let xx = BX - 1; xx < BX + BW + 1; xx += 6) { r(x, '#b6aa98', xx + 1, B - 2, 4, 1); r(x, '#6f6458', xx, B - 2, 1, 3); }
    // เงาใต้ชายคา
    r(x, 'rgba(60,32,14,.35)', BX + 2, Y, BW - 4, 2);
  }

  function awning(x) {
    // กันสาดลายทาง แดง/ขาว/ฟ้า ขอบล่างหยักครึ่งวงกลม
    const X = BX + 10, Y = 44, Wd = BW - 20, cols = ['#d24a3a', '#f6efe2', '#4a7ac8', '#f6efe2'];
    for (let i = 0; i < Wd; i++) {
      const c = cols[Math.floor(i / 4) % 4];
      r(x, c, X + i, Y, 1, 6);
      r(x, 'rgba(255,255,255,.35)', X + i, Y, 1, 1);
      const k = i % 4, dropH = k === 0 || k === 3 ? 1 : 2;
      r(x, c, X + i, Y + 6, 1, dropH);
    }
    r(x, '#7a2a22', X - 1, Y - 1, Wd + 2, 1);
    r(x, 'rgba(60,32,14,.3)', X, Y + 8, Wd, 2);
  }

  function windowWarm(x, X, Y) {
    r(x, WOOD[0], X - 1, Y - 1, 12, 11);
    r(x, '#f8d060', X, Y, 10, 9); r(x, '#fff0a8', X + 1, Y + 1, 3, 3); r(x, '#e0a838', X, Y + 7, 10, 2);
    r(x, WOOD[1], X + 4, Y, 2, 9); r(x, WOOD[1], X, Y + 4, 10, 1);
    r(x, WOOD[2], X - 1, Y + 9, 12, 2); // ขอบหน้าต่าง
  }

  function door(x) {
    const X = BX + BW / 2 - 5, Y = 54;
    r(x, WOOD[0], X - 1, Y - 2, 12, 18);
    r(x, '#2f7a78', X, Y, 10, 16); r(x, '#48a09a', X, Y, 2, 16); r(x, '#1f5a58', X + 8, Y, 2, 16);
    // ช่องกระจกโค้ง
    r(x, '#f8d060', X + 3, Y + 2, 4, 5); r(x, '#f8d060', X + 2, Y + 3, 6, 3); r(x, '#fff0a8', X + 3, Y + 3, 2, 1);
    r(x, '#e8c04a', X + 7, Y + 9, 1, 2);
  }

  function hangingBasket(x, cx) {
    r(x, '#3a2a1a', cx, 40, 1, 6);
    r(x, '#3a2a1a', cx - 3, 45, 1, 3); r(x, '#3a2a1a', cx + 3, 45, 1, 3);
    ell(x, cx, 50, 5, 2, '#3f9a3a'); ell(x, cx - 1, 49, 3, 1, '#5cb84a');
    for (const [dx, dy, c] of [[-4, 47, '#ff8fc7'], [-1, 46, '#d86ab0'], [2, 47, '#ff8fc7'], [4, 49, '#f6b0d8'], [-3, 50, '#d86ab0'], [1, 49, '#ffd0e8']]) { r(x, c, cx + dx, dy, 2, 2); r(x, '#fff0f6', cx + dx, dy, 1, 1); }
    r(x, WOOD[1], cx - 4, 52, 9, 4); r(x, WOOD[3], cx - 4, 52, 9, 1); r(x, WOOD[0], cx - 3, 55, 7, 1);
    r(x, '#3f9a3a', cx - 4, 56, 1, 3); r(x, '#3f9a3a', cx + 4, 56, 1, 2); r(x, '#5cb84a', cx - 1, 56, 1, 2);
  }

  function sideAwning(x, X, cols, dir) {
    // ผ้าใบเฉียงด้านข้าง กางออกจากชายคา (ม่วง/ขาว ซ้าย · แดง/ครีม ขวา) ขอบล่างหยัก
    const Y = 24, H = 22, Wd = 13;
    for (let y = 0; y < H; y++) {
      const off = Math.floor(y / 3) * dir, shade = y > H - 6;
      for (let i = 0; i < Wd; i++) {
        const k = Math.floor((i + (dir > 0 ? y >> 1 : 0)) / 3) & 1;
        let c = cols[k];
        if (shade) c = k ? cols[3] : cols[2];
        if (i === (dir < 0 ? 0 : Wd - 1)) c = cols[2];
        r(x, c, X + i + off, Y + y, 1, 1);
      }
    }
    const offB = Math.floor(H / 3) * dir;
    for (let i = 0; i < Wd; i++) if (i % 3 === 1) r(x, cols[Math.floor(i / 3) & 1 ? 3 : 2], X + i + offB, Y + H, 1, 1);
    // เสาค้ำ
    const px = dir < 0 ? X + offB : X + Wd - 1 + offB;
    r(x, WOOD[0], px, Y + H, 2, 70 - Y - H); r(x, WOOD[2], px, Y + H, 1, 70 - Y - H);
  }

  function chalkboard(x, X, Y) {
    r(x, WOOD[0], X, Y, 9, 12); r(x, '#2f3a32', X + 1, Y + 1, 7, 9);
    r(x, '#e8e8e0', X + 2, Y + 3, 4, 1); r(x, '#e8e8e0', X + 2, Y + 5, 5, 1); r(x, '#f8d060', X + 2, Y + 7, 3, 1);
    r(x, WOOD[1], X + 1, Y + 12, 1, 3); r(x, WOOD[1], X + 7, Y + 12, 1, 3);
  }

  function flowerBox(x, X, Y) {
    r(x, WOOD[1], X, Y + 4, 16, 6); r(x, WOOD[3], X, Y + 4, 16, 1); r(x, WOOD[0], X, Y + 9, 16, 1);
    r(x, '#3f9a3a', X + 1, Y + 1, 14, 4);
    for (const [dx, c] of [[1, '#ff8fc7'], [4, '#ffe37a'], [7, '#c79bff'], [10, '#ff8fc7'], [13, '#9fd4ff']]) { r(x, c, X + dx, Y, 2, 2); r(x, '#fff6e0', X + dx, Y, 1, 1); }
  }

  function roundTable(x, cx, cy) {
    ell(x, cx, cy, 6, 3, WOOD[2]); ell(x, cx, cy - 1, 5, 2, WOOD[3]);
    r(x, WOOD[1], cx - 1, cy + 2, 2, 4); r(x, WOOD[0], cx - 3, cy + 6, 6, 1);
  }

  function barrel(x, X, Y) {
    r(x, WOOD[1], X, Y, 9, 10); r(x, WOOD[2], X + 1, Y, 3, 10); r(x, WOOD[0], X + 7, Y, 2, 10);
    r(x, '#5c5a62', X, Y + 2, 9, 1); r(x, '#5c5a62', X, Y + 7, 9, 1);
    ell(x, X + 4, Y, 4, 1, '#6b4423'); r(x, '#4a2e18', X + 2, Y, 5, 1);
  }

  function makeFoodShop() {
    const spr = mk(W0, H0, (x) => {
      x.translate(0, OY);
      ell(x, BX + BW / 2, 71, BW / 2 + 4, 3, 'rgba(30,18,8,.25)'); // เงาพื้น
      sideAwning(x, BX - 4, ['#8a5ac8', '#f2ecf8', '#5e3a92', '#c8bcdc'], -1);
      sideAwning(x, BX + BW - 9, ['#d24a3a', '#f6e7c8', '#9e2f29', '#d8c4a0'], 1);
      wallBody(x);
      chimney(x);
      gableRoof(x);
      gableFace(x);
      nameBoard(x);
      awning(x);
      windowWarm(x, BX + 10, 54); windowWarm(x, BX + BW - 20, 54);
      door(x);
      hangingBasket(x, BX + 6); hangingBasket(x, BX + BW - 7);
      chalkboard(x, BX - 4, 58);
      chalkboard(x, BX + BW - 5, 58);
      flowerBox(x, BX + BW / 2 + 8, 64);
      roundTable(x, BX + 14, 70);
      barrel(x, BX + BW + 3, 52); barrel(x, BX + BW + 2, 62);
    }, SOFT);
    // ควันปล่องไฟ (ไม่มีขอบ)
    const g = spr.getContext('2d');
    for (const [dx, dy, rd, a] of [[0, 0, 3, .55], [2, -5, 4, .45], [-1, -11, 5, .3]]) {
      g.fillStyle = `rgba(230,228,236,${a})`;
      for (let yy = -rd; yy <= rd; yy++) { const w = Math.floor(Math.sqrt(rd * rd - yy * yy) + .5); g.fillRect(1 + BX + 48 + dx - w, 1 + OY + 2 + dy + yy, w * 2 + 1, 1); }
    }
    return spr;
  }

  // พิกัดป้ายชื่อ (หน่วยพิกเซลสไปรต์ รวมขอบ 1 px) ให้หน้าตัวอย่างเขียนตัวอักษรทับ
  window.ShopSample = { food: makeFoodShop, label: { x: 1 + BX + BW / 2, y: 1 + OY + 38 } };
})();
