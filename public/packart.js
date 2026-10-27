// โหลดสไปรต์จาก asset pack (PNG) มาวาดแทนพิกเซลวาดโค้ด — เฟสร้านค้า
const PackArt = (() => {
  // ร้านที่มีในแพ็ก (vehicle/cinema/sign ยังใช้ PixelArt เดิม)
  const BUILD = {
    farm:   { src: 'pack/farm.png',   scale: 1.28 },
    fish:   { src: 'pack/fish.png',   scale: 1.28 },
    animal: { src: 'pack/animal.png', scale: 1.32 },
    pet:    { src: 'pack/pet.png',    scale: 1.28 },
    cloth:  { src: 'pack/cloth.png',  scale: 1.30 },
    food:   { src: 'pack/food.png',   scale: 1.42 }, // กว้างกว่านิด รวมกันสาดข้าง
    wood:   { src: 'pack/wood.png',   scale: 1.35 },
    furn:   { src: 'pack/furn.png',   scale: 1.28 },
  };
  const imgs = Object.create(null);
  let loaded = 0, total = 0, ready = false;
  const waiters = [];

  function load() {
    const keys = Object.keys(BUILD);
    total = keys.length; loaded = 0; ready = false;
    keys.forEach(k => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = im.onerror = () => {
        if (im.naturalWidth) imgs[k] = im;
        loaded++;
        if (loaded >= total) { ready = true; waiters.splice(0).forEach(fn => fn()); }
      };
      im.src = BUILD[k].src + '?v=pack1';
    });
  }

  function whenReady(fn) { if (ready) fn(); else waiters.push(fn); }

  // คืนค่าตำแหน่งวาดในพิกัดโลก (พิกเซลจอ) หรือ null ถ้ายังไม่พร้อม/ไม่มีในแพ็ก
  function building(b) {
    const conf = BUILD[b.kind], im = imgs[b.kind];
    if (!conf || !im) return null;
    const ts = (typeof Shared !== 'undefined' && Shared.TS) || 32;
    const bw = (b.x1 - b.x0 + 1) * ts, bh = (b.y1 - b.y0 + 1) * ts;
    const tw = bw * conf.scale, th = im.naturalHeight * (tw / im.naturalWidth);
    // จัดกลางแนวนอน · ชิดขอบล่าง footprint (หลังคา/ปล่องยื่นขึ้นเหนือ y0)
    return { img: im, x: b.x0 * ts + (bw - tw) / 2, y: b.y0 * ts + bh - th, w: tw, h: th };
  }

  function has(kind) { return !!imgs[kind]; }
  function isReady() { return ready; }

  load();
  return { load, whenReady, building, has, isReady, BUILD };
})();
