// ไอคอน สัตว์ และพืชในแปลงแบบพิกเซล (เฟส 3)
// - PixelUI.icon(emoji)    : ไอคอนพิกเซลสำหรับ UI (ไอคอนเครื่องมือวาดมือ ที่เหลือแปลงอีโมจิเป็นพิกเซลอัตโนมัติ + ขอบ 1 px)
// - PixelUI.world(ctx,...) : วาดอีโมจิแบบพิกเซลในโลกเกม (1 พิกเซลศิลป์ = 2 พิกเซลเกม)
// - PixelUI.animal(...)    : สัตว์ 5 ชนิด   - PixelUI.crop(stage) : พืช 4 ระยะ
// - PixelUI.dom(el)        : เปลี่ยนอีโมจิในข้อความของ UI เป็น <img> พิกเซลทั้งหมด (ทำงานเองผ่าน MutationObserver)
const PixelUI = (() => {
  const { mk, r, ell, disc, shade, addOutline, cv } = PixelArt;
  const EYE = '#2a1b14';

  // ---------- ไอคอนวาดมือ (13×13) ----------
  // บัวรดน้ำ 13×13: pal = [ตัว, ไฮไลต์, เงา, เส้น], lvl 1 มีแถบรัดกลางตัว, lvl 2 เพิ่มประกายและหัวฝักบัวใหญ่ขึ้น
  function can(x, pal, lvl) {
    const [b, hi, sh, dk] = pal;
    r(x, b, 3, 5, 7, 7); r(x, hi, 4, 5, 1, 6); r(x, sh, 9, 5, 1, 7); r(x, dk, 3, 4, 7, 1); r(x, dk, 3, 12, 7, 1);
    r(x, b, 2, 9, 1, 1); r(x, b, 2, 8, 1, 1); r(x, b, 1, 7, 1, 1); r(x, b, 1, 6, 1, 1); r(x, dk, 0, 4, 3, 2);
    if (lvl >= 2) r(x, dk, 0, 3, 4, 1);
    r(x, dk, 4, 2, 5, 1); r(x, dk, 4, 3, 1, 1); r(x, dk, 8, 3, 1, 1);
    r(x, dk, 10, 6, 2, 1); r(x, dk, 11, 7, 1, 3); r(x, dk, 10, 10, 2, 1);
    if (lvl >= 1) { r(x, sh, 4, 8, 5, 1); r(x, hi, 4, 8, 1, 1); }
    if (lvl >= 2) { r(x, '#ffffff', 5, 6, 1, 1); r(x, '#ffffff', 11, 3, 1, 1); r(x, '#ffffff', 10, 2, 1, 1); r(x, '#ffffff', 12, 2, 1, 1); r(x, '#ffffff', 11, 1, 1, 1); }
    r(x, '#bfe4f8', 0, 7, 1, 1); r(x, '#bfe4f8', 0, 9, 1, 1); r(x, '#8cc8ec', 0, 11, 1, 1);
  }
  const HAND = {
    '⛏'(x) { r(x, '#8d99a6', 1, 2, 11, 2); r(x, '#c9d3dc', 2, 2, 8, 1); r(x, '#6c7782', 0, 3, 2, 3); r(x, '#6c7782', 11, 3, 2, 3); r(x, '#6c7782', 2, 4, 9, 1); r(x, '#9c6636', 6, 4, 2, 9); r(x, '#bd8447', 6, 4, 1, 9); r(x, '#5e3a20', 6, 11, 2, 1); },
    '💧'(x) { const ws = [1, 1, 3, 3, 5, 5, 7, 7, 7, 7, 5, 3]; ws.forEach((w, i) => r(x, '#3d86c2', 6 - (w >> 1), i, w, 1)); ws.forEach((w, i) => { if (w > 2) r(x, '#2a5f99', 6 + (w >> 1) - 1, i, 1, 1); }); r(x, '#bfe4f8', 4, 5, 1, 3); r(x, '#8cc8ec', 5, 4, 1, 1); r(x, '#2a5f99', 4, 11, 5, 1); },
    '🫗'(x) { can(x, ['#5aa0d8', '#a8d4f2', '#3b78ae', '#2f5f8f'], 0); },   // บัวรดน้ำสังกะสี (สีฟ้า)
    '🚿'(x) { can(x, ['#e08a45', '#f6c18e', '#b0622a', '#6e3b17'], 1); },   // บัวรดน้ำทองแดง (มีแถบกลางตัว)
    '🚰'(x) { can(x, ['#f2c14e', '#ffe9a0', '#c99428', '#7a540e'], 2); },   // บัวรดน้ำทองคำ (แถบ + ประกาย)
    '🎣'(x) { for (let i = 0; i < 12; i++) r(x, i < 4 ? '#5e3a20' : '#9c6636', 1 + i, 12 - i, 1, 1); disc(x, 3, 9, 1, '#9aa5ad'); r(x, '#e4f4ff', 12, 1, 1, 7); r(x, '#9aa5ad', 11, 8, 1, 2); r(x, '#9aa5ad', 12, 10, 1, 1); r(x, '#d9473c', 12, 5, 1, 1); },
    '🪓'(x) { for (let i = 0; i < 11; i++) { r(x, i < 3 ? '#5e3a20' : '#9c6636', 1 + i, 12 - i, 2, 1); } r(x, '#9aa5ad', 6, 1, 6, 5); r(x, '#c9d3dc', 6, 1, 2, 5); r(x, '#6c7782', 11, 2, 1, 3); r(x, '#6c7782', 6, 5, 6, 1); },
    '🪙'(x) { disc(x, 6, 6, 6, '#b8801f'); disc(x, 6, 6, 5, '#f2c14e'); disc(x, 5, 5, 3, '#ffe08a'); r(x, '#c99428', 5, 3, 2, 7); r(x, '#c99428', 4, 4, 4, 1); r(x, '#c99428', 4, 8, 4, 1); r(x, '#fff6c8', 3, 3, 1, 1); },
  };
  const norm = e => e.replace(/️/g, '');
  const cache = new Map();
  const FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  // แปลงอีโมจิเป็นพิกเซลอาร์ต: วาดลงผืนเล็ก ตัดขอบโปร่งใส ลดจำนวนสี แล้วใส่เส้นขอบเข้ม 1 px
  function auto(e, res) {
    const t = cv(res, res), x = t.getContext('2d', { willReadFrequently: true });
    x.font = `${Math.round(res * .92)}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, res / 2, res / 2 + res * .06);
    const d = x.getImageData(0, 0, res, res), a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] < 110) { a[i + 3] = 0; continue; }
      a[i + 3] = 255; for (let k = 0; k < 3; k++) a[i + k] = Math.min(255, Math.round(a[i + k] / 46) * 46);
    }
    x.putImageData(d, 0, 0);
    const c = cv(res + 2, res + 2); c.getContext('2d').drawImage(t, 1, 1); addOutline(c); return c;
  }
  function pix(e, res = 14) {
    const k = norm(e), key = k + '@' + res;
    let c = cache.get(key);
    if (!c) { c = HAND[k] ? mk(13, 13, HAND[k]) : auto(e, res); cache.set(key, c); }
    return c;
  }
  const url = new Map();
  const dataUrl = e => { const k = norm(e); let u = url.get(k); if (!u) { u = pix(e, 14).toDataURL(); url.set(k, u); } return u; };
  // ในโลกเกม: gamePx = ขนาดเดิมของอีโมจิ (px เกม) → เลือกความละเอียดพิกเซลศิลป์ให้ตรง แล้วขยาย 2 เท่า
  function world(ctx, e, cx, cy, gamePx) {
    const s = pix(e, Math.max(6, Math.round(gamePx / 2)));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(s, Math.round(cx - s.width), Math.round(cy - s.height), s.width * 2, s.height * 2);
  }

  // ---------- DOM: อีโมจิในข้อความ → <img> พิกเซล ----------
  const EMO = /\p{Extended_Pictographic}(?:️|⃣|\p{Emoji_Modifier}|‍\p{Extended_Pictographic}️?)*/gu;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CANVAS', 'IMG', 'SELECT', 'OPTION', 'TITLE']);
  function textNodes(root, out) {
    if (root.nodeType === 3) { out.push(root); return; }
    if (root.nodeType !== 1 || SKIP.has(root.tagName)) return;
    for (let n = root.firstChild; n; n = n.nextSibling) textNodes(n, out);
  }
  function dom(root) {
    const list = []; textNodes(root, list);
    for (const n of list) {
      const s = n.nodeValue; EMO.lastIndex = 0;
      if (!EMO.test(s) || (n.parentNode && n.parentNode.closest && n.parentNode.closest('[contenteditable],.nopx'))) continue;
      EMO.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, m;
      while ((m = EMO.exec(s))) {
        if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
        const img = document.createElement('img'); img.className = 'pxe'; img.alt = m[0]; img.draggable = false; img.src = dataUrl(m[0]); frag.appendChild(img);
        last = m.index + m[0].length;
      }
      if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
      n.parentNode.replaceChild(frag, n);
    }
  }
  let queued = new Set(), timer = 0;
  function flush() { timer = 0; const q = [...queued]; queued = new Set(); for (const n of q) if (n.isConnected) dom(n); }
  function watch() {
    new MutationObserver(ms => {
      for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 || n.nodeType === 3) queued.add(n.nodeType === 3 ? n.parentNode : n);
      for (const m of ms) if (m.type === 'characterData' && m.target.parentNode) queued.add(m.target.parentNode);
      if (!timer && queued.size) timer = requestAnimationFrame(flush);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    dom(document.body);
  }

  // ---------- สัตว์ (หันขวา ท่าเดิน 2 เฟรม; ซ้ายพลิกกลับ) ----------
  // art = 1 พิกเซลศิลป์ = 2 พิกเซลเกม; cx = คอลัมน์กึ่งกลางลำตัว; fb = แถวล่างสุดของเท้า; ground = ระยะเท้าจาก c.y (px เกม)
  const legs = (x, col, xs, top, h, f, w = 2) => xs.forEach((lx, i) => { const hh = h - (f && i % 2 === 0 ? 1 : 0); r(x, col, lx, top, w, hh); r(x, shade(col, -.25), lx + w - 1, top, 1, hh); });
  const A = {
    chicken: { w: 14, h: 12, cx: 6, ground: 7, fn(x, o) {
      ell(x, 6, 6, 4, 3, '#ffffff'); ell(x, 5, 7, 3, 2, '#e8e8e8'); r(x, '#d9d9d9', 4, 5, 4, 2);
      r(x, '#ffffff', 1, 3, 2, 3); r(x, '#ffffff', 0, 2, 1, 2); r(x, '#e8e8e8', 1, 5, 1, 1);
      disc(x, 10, 3, 2, '#ffffff'); r(x, '#e74c3c', 9, 0, 3, 2); r(x, '#f39c12', 12, 3, 2, 1); r(x, '#e74c3c', 11, 5, 1, 2);
      if (o.blink) r(x, EYE, 10, 3, 2, 1); else r(x, EYE, 10, 2, 1, 2); r(x, '#ffb3b3', 9, 4, 1, 1);
      legs(x, '#f2a33a', [5, 8], 9, 3, o.f, 1);
    } },
    duck: { w: 16, h: 12, cx: 7, ground: 7, fn(x, o) {
      ell(x, 7, 7, 5, 3, '#fff6c9'); ell(x, 6, 7, 3, 2, '#f3e08a'); r(x, '#fff6c9', 1, 5, 2, 2); r(x, '#fff6c9', 0, 4, 1, 2);
      disc(x, 12, 3, 2, '#fff6c9'); r(x, '#f39c12', 14, 3, 2, 2);
      if (o.blink) r(x, EYE, 11, 3, 2, 1); else r(x, EYE, 12, 2, 1, 2); r(x, '#ffb3b3', 11, 4, 1, 1);
      legs(x, '#f39c12', [6, 9], 10, 2, o.f, 1);
    } },
    sheep: { w: 25, h: 17, cx: 10, ground: 10, fn(x, o) {
      legs(x, '#4a4a52', [4, 8, 13, 16], 12, 5, o.f);
      const g = o.prod ? 1 : 0;
      for (const [cx, cy, rd] of [[6, 8, 5], [11, 7, 5], [15, 9, 4], [9, 10, 4], [13, 11, 3]]) disc(x, cx, cy, rd + g, '#ececdf');
      for (const [cx, cy, rd] of [[6, 6, 3], [11, 5, 3], [15, 7, 2], [9, 8, 2]]) disc(x, cx, cy, rd + g, '#fbfbf6');
      r(x, '#d4d4c4', 5, 12, 12, 1);
      ell(x, 20, 9, 3, 3, '#3d3d45'); r(x, '#3d3d45', 17, 5, 2, 2); r(x, '#3d3d45', 22, 5, 2, 2); disc(x, 19, 5, 2, '#fbfbf6');
      if (o.blink) r(x, '#ffffff', 20, 8, 2, 1); else { r(x, '#ffffff', 20, 8, 1, 2); } r(x, '#f2948f', 19, 11, 1, 1);
    } },
    pig: { w: 26, h: 15, cx: 10, ground: 9, fn(x, o) {
      legs(x, '#e891a3', [4, 8, 13, 16], 11, 4, o.f);
      ell(x, 10, 7, 8, 4, '#f7b3c2'); ell(x, 9, 9, 5, 2, '#f0a0b2');
      r(x, '#e891a3', 1, 5, 2, 1); r(x, '#e891a3', 0, 4, 1, 1); r(x, '#e891a3', 1, 3, 1, 1);
      disc(x, 18, 7, 4, '#f7b3c2'); r(x, '#e891a3', 16, 2, 3, 3); r(x, '#e891a3', 20, 3, 2, 2);
      ell(x, 22, 8, 2, 2, '#ee7f98'); r(x, '#9b3a52', 22, 8, 1, 1); r(x, '#9b3a52', 24, 8, 1, 1);
      if (o.blink) r(x, EYE, 18, 7, 2, 1); else r(x, EYE, 18, 6, 1, 2); r(x, '#ff9fb2', 19, 9, 1, 1);
    } },
    cow: { w: 31, h: 20, cx: 12, ground: 11, fn(x, o) {
      legs(x, '#e8e8e8', [5, 9, 16, 20], 14, 6, o.f, 2);
      ell(x, 12, 9, 10, 5, '#ffffff'); ell(x, 12, 12, 8, 2, '#ececec');
      ell(x, 8, 7, 3, 2, '#3a3a3a'); ell(x, 16, 10, 3, 2, '#3a3a3a'); r(x, '#3a3a3a', 20, 6, 2, 2);
      r(x, '#f2b6b6', 12, 14, 3, 1);
      r(x, '#e8e8e8', 1, 6, 1, 6); r(x, '#3a3a3a', 0, 11, 2, 2);
      ell(x, 25, 8, 4, 3, '#ffffff'); ell(x, 28, 10, 2, 2, '#f2b6b6'); r(x, '#9b6a6a', 28, 10, 1, 1);
      r(x, '#d9c9a0', 23, 3, 1, 3); r(x, '#d9c9a0', 27, 3, 1, 3); r(x, '#3a3a3a', 22, 6, 2, 1);
      if (o.blink) r(x, EYE, 25, 7, 2, 1); else r(x, EYE, 25, 6, 1, 2);
    } },
  };
  // ---- สัตว์เลี้ยง: แมว (เดิน/นั่ง) และหมา 2 สี (เดิน/ยืนกระดิกหาง) o.idle = หยุดนิ่ง ----
  const dogArt = (P) => (x, o) => {
    const w = o.f ? 1 : 0;
    legs(x, P.leg, [2, 4, 7, 9], 6, 3, o.idle ? 0 : o.f, 1);
    ell(x, 5, 4, 4, 2, P.body); r(x, P.belly, 3, 5, 4, 1); r(x, P.shade, 2, 3, 2, 1);
    r(x, P.body, 0, 2 - w, 1, 2);                                  // หาง (กระดิกขึ้นลง)
    disc(x, 10, 3, 2, P.body); r(x, P.muzzle, 11, 4, 2, 2); r(x, P.nose, 12, 4, 1, 1);
    r(x, P.ear, 8, 1, 2, 3);
    if (o.blink) r(x, EYE, 10, 3, 2, 1); else r(x, EYE, 11, 3, 1, 1);
  };
  const DOG = [
    { body: '#d9a15a', shade: '#b87f3a', belly: '#f0d9b5', leg: '#c98f48', ear: '#8a5a2a', muzzle: '#f0d9b5', nose: '#2a1b14' },
    { body: '#3d3d46', shade: '#2a2a32', belly: '#f4f4f4', leg: '#35353d', ear: '#222228', muzzle: '#f4f4f4', nose: '#2a1b14' },
  ];
  A.dog0 = { w: 13, h: 9, cx: 5, ground: 7, fn: dogArt(DOG[0]) };
  A.dog1 = { w: 13, h: 9, cx: 5, ground: 7, fn: dogArt(DOG[1]) };
  A.cat = { w: 11, h: 10, cx: 4, ground: 6, fn(x, o) {
    const B = '#e8a33d', D = '#c9781f', L = '#f6c878';
    if (o.idle) { // นั่ง หางโบกเบาๆ
      ell(x, 3, 7, 2, 2, B); r(x, L, 3, 7, 2, 2); r(x, D, 1, 6, 1, 1);
      r(x, B, 5, 9, 3 + (o.f ? 1 : 0), 1);
      disc(x, 4, 3, 2, B); r(x, B, 2, 0, 1, 1); r(x, B, 6, 0, 1, 1); r(x, '#f2948f', 3, 1, 1, 1);
      if (o.blink) r(x, EYE, 4, 3, 2, 1); else r(x, EYE, 5, 3, 1, 1); r(x, '#f2948f', 6, 4, 1, 1);
    } else {
      legs(x, B, [2, 3, 6, 7], 7, 2, o.f, 1);
      ell(x, 4, 5, 3, 2, B); r(x, D, 3, 3, 1, 1); r(x, D, 5, 3, 1, 1); r(x, L, 3, 6, 3, 1);
      r(x, B, 0, 3, 1, 3); r(x, D, 0, 2, 1, 1);                   // หางชี้ขึ้น
      disc(x, 8, 3, 2, B); r(x, B, 6, 0, 1, 1); r(x, B, 9, 0, 1, 1);
      if (o.blink) r(x, EYE, 8, 3, 2, 1); else r(x, EYE, 9, 3, 1, 1); r(x, '#f2948f', 10, 4, 1, 1);
    }
  } };
  const acache = new Map();
  function animal(ctx, type, c, o) { // o: { f: -1|1 ทิศ, step: 0|1 เฟรมเดิน, blink, prod, hop }
    const d = A[type] || A.chicken, key = [type, o.step, o.blink ? 1 : 0, o.prod ? 1 : 0, o.idle ? 1 : 0].join('|');
    let s = acache.get(key);
    if (!s) { s = mk(d.w, d.h, x => d.fn(x, { f: o.step, blink: o.blink, prod: o.prod, idle: !!o.idle })); acache.set(key, s); }
    ctx.imageSmoothingEnabled = false;
    const w = s.width * 2, h = s.height * 2, top = Math.round(c.y + d.ground - (d.h + 1) * 2 - (o.hop || 0));
    if (o.f < 0) { ctx.save(); ctx.translate(Math.round(c.x), 0); ctx.scale(-1, 1); ctx.drawImage(s, -(d.cx + 1) * 2, top, w, h); ctx.restore(); }
    else ctx.drawImage(s, Math.round(c.x) - (d.cx + 1) * 2, top, w, h);
  }

  // ---------- พืชในแปลง (ระยะ 0–3; ระยะ 3 ใบล่างเท่านั้น ผลวาดด้วย world()) ----------
  const crops = [
    mk(14, 8, x => { r(x, '#3f8a2e', 7, 4, 1, 4); r(x, '#8bd36b', 5, 3, 2, 2); r(x, '#6fc050', 8, 2, 2, 2); r(x, '#bff0a0', 5, 3, 1, 1); }),
    mk(14, 12, x => { r(x, '#3f8a2e', 7, 3, 1, 9); r(x, '#4fb34a', 3, 5, 4, 2); r(x, '#7fd465', 2, 4, 2, 1); r(x, '#4fb34a', 8, 7, 4, 2); r(x, '#7fd465', 11, 6, 2, 1); r(x, '#8bd36b', 6, 1, 3, 2); }),
    mk(14, 16, x => { r(x, '#3f8a2e', 7, 2, 1, 14); r(x, '#3f9a3a', 2, 7, 5, 2); r(x, '#7fd465', 1, 6, 2, 1); r(x, '#3f9a3a', 3, 11, 4, 2); r(x, '#3f9a3a', 8, 9, 5, 2); r(x, '#7fd465', 12, 8, 2, 1); r(x, '#3f9a3a', 8, 13, 4, 2); r(x, '#6fd050', 6, 0, 3, 3); r(x, '#bff0a0', 6, 0, 1, 1); }),
    mk(14, 8, x => { r(x, '#3f8a2e', 7, 2, 1, 6); r(x, '#3f9a3a', 1, 3, 6, 3); r(x, '#6fd050', 1, 3, 3, 1); r(x, '#3f9a3a', 8, 2, 6, 3); r(x, '#6fd050', 8, 2, 3, 1); }),
  ];
  const crop = s => crops[Math.max(0, Math.min(3, s))];

  return { icon: pix, url: dataUrl, world, dom, watch, animal, crop, A };
})();
if (document.body) PixelUI.watch(); else addEventListener('DOMContentLoaded', () => PixelUI.watch());
