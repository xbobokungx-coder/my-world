// สระน้ำตกแต่งจากแพ็กภาพ pond-art-pack v1.0 (public/pack/pond/) • ย่อภาพให้พอดีสเกลเกม (ช่อง 32 px) ครั้งเดียวตอนโหลด
// ภาพโหลดไม่ครบ/โหลดไม่ได้ → PondArt.ready() เป็น false ตลอด แล้ว game.js ถอยกลับไปใช้ภาพวาดด้วยโค้ดเดิม (PixelArt.fish / PixelArt.lily)
// ภาพในแพ็กออกแบบสำหรับช่อง 48 px จึงย่อ ×0.75 (ปลา 64→48 px, ใบบัว 32→24 px, ดอกบัวใหญ่ 96→72 px)
const PondArt = (() => {
  const DIR = 'pack/pond/', SCALE = 0.75;
  const FILES = {
    koi: ['b3_1_koi_orange_white', 'b3_2_koi_gold', 'b3_3_koi_white_black'],
    lily: ['b2_1_lilypad_plain', 'b2_2_lilypad_bud', 'b2_3_lilypad_ladybug', 'b2_4_lilypad_frog'],
    still: ['b8_giant_lotus', 'b5_mossy_rocks', 'b7_yellow_duck'],
    strips: { egret: ['anim_egret_idle_strip_4f', 48], reeds: ['anim_reeds_sway_strip_4f', 48], lotus: ['anim_lotus_sway_strip_4f', 64] }, // [ไฟล์, กว้างต่อเฟรม]
  };
  // ทิศหัวปลาในภาพต้นฉบับ (องศา 0 = ขวา, 90 = ลง) ใช้หมุนปลาให้หันตามทางว่าย • ตรวจด้วยตาจากภาพ จึงเป็นค่าประมาณ
  const KOI_HEAD = [105, 110, 135];
  const PING = [0, 1, 2, 3, 2, 1]; // ลำดับเฟรมไป-กลับ ให้ไหวต่อเนื่องไม่กระตุกตอนวนรอบ
  const imgs = Object.create(null), spr = Object.create(null);
  let total = 0, loaded = 0, failed = false;

  function shrink(im, sx, sy, sw, sh) { // ตัดส่วนของภาพแล้วย่อด้วย smoothing คุณภาพสูงลงแคนวาสใหม่ (วาดทีหลังแบบไม่เบลอ)
    const w = Math.max(1, Math.round(sw * SCALE)), h = Math.max(1, Math.round(sh * SCALE)), c = document.createElement('canvas');
    c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(im, sx, sy, sw, sh, 0, 0, w, h); return c;
  }
  function load(key, name, done) {
    total++; const im = new Image();
    im.onload = () => { imgs[key] = im; done && done(im); if (++loaded >= total) finish(); };
    im.onerror = () => { failed = true; loaded++; };
    im.src = DIR + name + '.png?v=pond1';
  }
  function finish() {
    if (failed) return;
    for (const k of Object.keys(imgs)) if (!k.startsWith('s:')) spr[k] = shrink(imgs[k], 0, 0, imgs[k].naturalWidth, imgs[k].naturalHeight);
    for (const [k, [, fw]] of Object.entries(FILES.strips)) {
      const im = imgs['s:' + k]; spr['s:' + k] = [0, 1, 2, 3].map(i => shrink(im, i * fw, 0, fw, im.naturalHeight));
    }
  }
  FILES.koi.forEach((n, i) => load('koi' + i, n));
  FILES.lily.forEach((n, i) => load('lily' + i, n));
  FILES.still.forEach(n => load(n, n));
  for (const [k, [n]] of Object.entries(FILES.strips)) load('s:' + k, n);

  const ready = () => loaded >= total && !failed && !!spr.koi0;
  const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const frame = (k, now, seed, ms) => spr['s:' + k][PING[(Math.floor(now / ms) + Math.floor(hash(seed, 7, 3) * 6)) % PING.length]]; // แต่ละชิ้นเริ่มคนละเฟรม ไม่ไหวพร้อมกัน
  return {
    ready,
    koi: i => ({ c: spr['koi' + (i % 3)], head: KOI_HEAD[i % 3] }), // { c: แคนวาส, head: ทิศหัว (องศา) }
    lily: kind => spr['lily' + kind],                               // 0 ธรรมดา 1 มีตูมขาว 2 เต่าทอง 3 กบ
    cluster: (now, seed) => frame('lotus', now, seed, 360),         // กอใบบัวกับดอกบัวชมพู (ไหวช้า)
    giant: () => spr.b8_giant_lotus,                                // ดอกบัวใหญ่ (นิ่ง)
    rocks: () => spr.b5_mossy_rocks,
    duck: () => spr.b7_yellow_duck,
    egret: (now, seed) => frame('egret', now, seed, 520),
    reeds: (now, seed) => frame('reeds', now, seed, 340),
    hash,
  };
})();
