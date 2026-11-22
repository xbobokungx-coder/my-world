// ภาพสระปลา (ชุด Cozy Pixel Pond ใน public/pack/pond/): ย่อให้ได้ความละเอียดพิกเซลเท่าของเกม (1 พิกเซลศิลป์ = 2 พิกเซลเกม ช่องละ 16)
// ตัดขอบนุ่มให้เป็นพิกเซลแข็ง แล้วแคชไว้ • ถ้าภาพยังโหลดไม่เสร็จ/โหลดไม่ได้ ready() เป็นเท็จ เกมใช้ภาพโค้ดเดิมใน pixelart.js แทน
const PondArt = (() => {
  const BASE = '/pack/pond/';
  const FILES = ['anim_koi_swim_strip_4f', 'b3_2_koi_gold', 'b3_3_koi_white_black', 'b1_lotus_cluster', 'anim_lotus_sway_strip_4f',
    'b2_1_lilypad_plain', 'b2_2_lilypad_bud', 'b2_3_lilypad_ladybug', 'b2_4_lilypad_frog', 'anim_reeds_sway_strip_4f', 'anim_egret_idle_strip_4f',
    'anim_duck_bob_strip_4f', 'b5_mossy_rocks'];
  const imgs = Object.create(null);
  let left = FILES.length, ok = true;
  for (const n of FILES) {
    const im = new Image();
    im.onload = () => { left--; };
    im.onerror = () => { left--; ok = false; };
    im.src = BASE + n + '.png';
    imgs[n] = im;
  }
  const ready = () => ok && left === 0;

  // ย่อภาพส่วน (sx,sy,sw,sh) ลงเป็น tw×th แล้วทำให้ขอบโปร่งแข็ง (พิกเซลอาร์ต) • rot = หมุน (เรเดียน) บนผืนเล็กที่กว้างขึ้นให้พอดี
  function shrink(img, sx, sy, sw, sh, tw, th, rot) {
    const t = document.createElement('canvas'); t.width = tw; t.height = th;
    const x = t.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
    const d = x.getImageData(0, 0, tw, th), a = d.data;
    for (let i = 3; i < a.length; i += 4) a[i] = a[i] < 110 ? 0 : 255;
    x.putImageData(d, 0, 0);
    if (!rot) return t;
    const n = Math.ceil(Math.hypot(tw, th)), o = document.createElement('canvas'); o.width = n; o.height = n;
    const y = o.getContext('2d'); y.imageSmoothingEnabled = false; y.translate(n / 2, n / 2); y.rotate(rot); y.drawImage(t, -tw / 2, -th / 2);
    return o;
  }
  const cache = new Map();
  const memo = (key, fn) => { let v = cache.get(key); if (!v) { v = fn(); cache.set(key, v); } return v; };

  // ปลาโคอิ (มองจากบน หัวชี้ขึ้นในภาพต้นฉบับ) 3 สายพันธุ์: 0 ส้มขาว (อนิเมชันหางครบ 4 เฟรม) • 1 เหลืองทอง • 2 ขาวจุดดำ (2 สายพันธุ์หลังไม่มีเฟรมหาง ส่ายตัวเล็กน้อยแทน)
  // dir16 = ทิศที่ว่ายไป 0..15 (0 = ขึ้นบน หมุนตามเข็ม) • คืนผืนผ้าใบพิกเซลศิลป์ ขนาดเท่ากันทุกทิศ (วาดด้วย drawImage กว้าง ×2 กึ่งกลางที่จุดปลา)
  const KOI_SIZE = 22;
  function koi(variant, frame, dir16) {
    return memo('k' + variant + ':' + frame + ':' + dir16, () => {
      const rot = (dir16 / 16) * Math.PI * 2 + (variant && frame % 2 ? 0.1 : variant ? -0.1 : 0);
      if (variant === 0) return shrink(imgs.anim_koi_swim_strip_4f, (frame % 4) * 64, 0, 64, 64, KOI_SIZE, KOI_SIZE, rot);
      return shrink(imgs[variant === 1 ? 'b3_2_koi_gold' : 'b3_3_koi_white_black'], 0, 0, 64, 64, KOI_SIZE, KOI_SIZE, rot);
    });
  }
  // ใบบัวเดี่ยว 4 แบบ (ธรรมดา/ตูมบัว/เต่าทอง/กบ) 32 → 14
  const PAD_FILES = ['b2_1_lilypad_plain', 'b2_2_lilypad_bud', 'b2_3_lilypad_ladybug', 'b2_4_lilypad_frog'];
  const pad = k => memo('p' + k, () => shrink(imgs[PAD_FILES[k % 4]], 0, 0, 32, 32, 14, 14));
  const lotus = f => memo('l' + (f % 4), () => shrink(imgs.anim_lotus_sway_strip_4f, (f % 4) * 64, 0, 64, 64, 30, 30));
  const reeds = f => memo('r' + (f % 4), () => shrink(imgs.anim_reeds_sway_strip_4f, (f % 4) * 48, 0, 48, 48, 22, 22));
  const egret = f => memo('e' + (f % 4), () => shrink(imgs.anim_egret_idle_strip_4f, (f % 4) * 48, 0, 48, 48, 22, 22));
  const duck = f => memo('d' + (f % 4), () => shrink(imgs.anim_duck_bob_strip_4f, (f % 4) * 32, 0, 32, 32, 15, 15));
  const rocks = () => memo('rk', () => shrink(imgs.b5_mossy_rocks, 0, 0, 48, 48, 20, 20));
  return { ready, koi, pad, lotus, reeds, egret, duck, rocks, KOI_SIZE };
})();
