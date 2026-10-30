// สไปรต์ชีตท่าทางตอนทำงาน (ขุดแร่ ตัดไม้ ตกปลา + จอบใช้ท่าขุด): เล่นทุกครั้งที่กดใช้เครื่องมือ (p.useAt) ทั้งตัวเราและคนอื่น (ข้อความ 'use')
// แต่ละท่าเป็นเฟรมตายตัว (ไม่เกลี่ยระหว่างเฟรม ให้ดูเป็นพิกเซลอาร์ต) • 1 เฟรม = [มุมเครื่องมือ, เลื่อนมือ x, เลื่อนมือ y, ตัวโน้มไปข้างหน้า, ตัวยุบ/ยืด]
// มุม: 0 = ด้ามตั้งชี้ขึ้น • +π/2 = ชี้ไปข้างหน้า • π = ชี้ลงพื้น • ค่าลบ = เงื้อไปหลังหัว (ด้านข้าง) • หันหน้า: เงื้อเหนือหัวแล้วฟาดลงหน้าตัว • หันหลัง: เงื้อลงมาทางกล้องแล้วฟาดขึ้นไปข้างหน้า
// เศษหิน/ประกายไฟ/เศษไม้/น้ำกระเซ็น คำนวณจากเวลาที่ผ่านไปหลังจังหวะกระแทก (ไม่เก็บสถานะ อนุภาคสุ่มตายตัวจาก seed)
const PixelAction = (() => {
  const SHEETS = {
    mine: { ms: 55, hit: 3, // อีเต้อ/จอบ: เงื้อสูงเหนือหัว → ฟาดลงแรง → ค้างตอนกระแทก → เก็บท่า
      side:  [[0.2, 0, 0, 0, 0], [-0.9, -2, -4, -1, -1], [-1.6, -3, -7, -2, -2], [1.9, 4, 0, 2, 1], [2.2, 4, 1, 2, 1], [1.2, 2, 0, 1, 0]],
      front: [[0.2, 0, 0, 0, 0], [-0.4, -1, -8, 0, -1], [-0.6, -2, -12, 0, -2], [2.6, 0, 4, 0, 1], [2.8, 0, 5, 0, 1], [1.4, 0, 2, 0, 0]],
      back:  [[0.2, 0, 0, 0, 0], [2.4, 0, -1, 0, -1], [2.8, 0, 1, 0, -2], [-0.1, 0, -8, 0, 1], [0, 0, -9, 0, 1], [0.3, 0, -4, 0, 0]] },
    chop: { ms: 55, hit: 3, // ขวาน: เหวี่ยงไปด้านหลังระดับไหล่ → ฟันเข้าลำต้นแนวนอน
      side:  [[0.3, 0, 0, 0, 0], [-0.6, -3, -3, -1, 0], [-1.3, -4, -4, -2, -1], [1.6, 5, 1, 2, 0], [1.8, 5, 1, 2, 0], [1.0, 2, 0, 1, 0]],
      front: [[0.3, 0, 0, 0, 0], [-0.3, -1, -6, 0, -1], [-0.8, -2, -9, 0, -1], [2.0, -3, 2, 0, 1], [2.2, -3, 3, 0, 1], [1.2, 0, 1, 0, 0]],
      back:  [[0.3, 0, 0, 0, 0], [2.2, 0, -1, 0, 0], [2.6, 0, 0, 0, -1], [-0.3, -2, -7, 0, 1], [-0.4, -2, -8, 0, 1], [0.2, 0, -3, 0, 0]] },
    fish: { ms: 60, hit: 4, // เบ็ด: ง้างคันไปหลังไหล่ → ค้างจังหวะ → สะบัดไปข้างหน้า (ปล่อยสาย) → ตามแรง
      side:  [[0.15, 0, 0, 0, 0], [-0.6, -2, -2, -1, 0], [-1.3, -3, -4, -2, -1], [-1.0, -2, -3, -1, -1], [0.9, 3, -1, 2, 0], [1.3, 4, 0, 2, 0], [0.6, 1, 0, 1, 0]],
      front: [[0.15, 0, 0, 0, 0], [-0.4, 0, -5, 0, 0], [-0.9, 0, -9, 0, -1], [-0.7, 0, -8, 0, -1], [0.9, 0, -2, 0, 0], [1.2, 0, 0, 0, 0], [0.6, 0, 0, 0, 0]],
      back:  [[0.15, 0, 0, 0, 0], [2.4, 0, -1, 0, 0], [2.8, 0, 0, 0, -1], [2.7, 0, 0, 0, -1], [0.2, 0, -6, 0, 0], [0, 0, -7, 0, 0], [0.3, 0, -3, 0, 0]] },
  };
  const PICKS = new Set(['🪝', '🧲', '⚓', '🔱', '🏹', '🪃', '⚒', '⛏']); // อีเต้อทุกระดับ (ไอคอนพิกเซลใน pixelui.js) + จอบ
  const kindOf = held => { const e = (held || '').replace(/️/g, ''); return PICKS.has(e) ? 'mine' : e === '🪓' ? 'chop' : e === '🎣' ? 'fish' : ''; };
  // เฟรมปัจจุบันของผู้เล่น: null = ไม่ได้ทำท่า (ใช้ท่าถือปกติ) • t = ms หลังเริ่มท่า
  function frame(p, now) {
    const k = kindOf(p.held), S = SHEETS[k]; if (!S || !p.useAt || p.sit) return null;
    const t = now - p.useAt, rows = (p.dir || 0) >= 2 ? S.side : p.dir === 1 ? S.back : S.front, i = Math.floor(t / S.ms);
    if (t < 0 || i >= rows.length) return null;
    const [a, hx, hy, lean, bob] = rows[i];
    return { kind: k, i, t, a, hx, hy, lean, bob, hitT: S.hit * S.ms, n: rows.length };
  }
  const dur = k => SHEETS[k] ? SHEETS[k].ms * SHEETS[k].side.length : 0;
  // จุดกระทบด้านหน้าตัว (ทิศ 0 ล่าง 1 บน 2 ซ้าย 3 ขวา) ใช้เมื่อไม่รู้ช่องเป้าหมายจริง (ผู้เล่นอื่น)
  const front = p => { const d = p.dir || 0; return d === 2 ? [p.x - 22, p.y + 4] : d === 3 ? [p.x + 22, p.y + 4] : d === 1 ? [p.x + 6, p.y - 14] : [p.x + 6, p.y + 18]; };
  // อนุภาคแบบไม่มีสถานะ: ตำแหน่ง = จุดเริ่ม + ความเร็ว×t + แรงโน้มถ่วง×t² สุ่มตายตัวจาก seed (คนเดียวกันฟาดครั้งเดียวกันได้ภาพเดียวกันทุกเฟรม)
  const rnd = (s, i) => { let h = (s * 374761393 + i * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const BURST = {
    mine:  { life: 420, n: 8, spd: [50, 120], up: 90, g: 420, size: [2, 4], spark: 4, dust: '#c9c2b4' },
    chop:  { life: 520, n: 7, spd: [40, 100], up: 110, g: 380, size: [2, 4], leaf: 2, dust: '#d9c39a' },
    splash:{ life: 520, n: 9, spd: [20, 60],  up: 120, g: 360, size: [2, 3], dust: null },
  };
  // วาดชุดอนุภาคตอนกระทบ: t = ms หลังกระทบ • cols = สีเศษ [สว่าง, เข้ม] • dir = ±1 ทิศที่หันอยู่ (เศษกระเด็นกลับมาทางคนฟาดนิดๆ)
  function burst(ctx, kind, x, y, t, seed, cols, dir = 0) {
    const B = BURST[kind]; if (!B || t < 0 || t > B.life) return;
    const s = t / 1000, fade = 1 - t / B.life;
    ctx.save();
    if (B.dust && t < 260) { // ฝุ่นฟุ้ง 3 เฟรม (วงพิกเซลขยายแล้วจาง)
      const f = Math.min(2, Math.floor(t / 90)), rr = [5, 9, 12][f]; ctx.globalAlpha = [0.55, 0.38, 0.18][f]; ctx.fillStyle = B.dust;
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(a) * rr) - 2, Math.round(y + Math.sin(a) * rr * 0.55) - 2, 4, 4); }
    }
    if (kind === 'splash' && t < 300) { // วงน้ำกระเพื่อม
      ctx.globalAlpha = 0.7 * (1 - t / 300); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y + 2, 4 + t / 20, (4 + t / 20) * 0.4, 0, 0, 7); ctx.stroke();
    }
    for (let i = 0; i < B.n; i++) { // เศษหิน/เศษไม้/หยดน้ำ
      const a = -Math.PI / 2 + (rnd(seed, i) - 0.5) * 2.4 - dir * 0.35, v = B.spd[0] + rnd(seed, i + 40) * (B.spd[1] - B.spd[0]);
      const px = x + Math.cos(a) * v * s, py = y + Math.sin(a) * v * s - B.up * s * rnd(seed, i + 80) + B.g * s * s;
      const sz = Math.round(B.size[0] + rnd(seed, i + 120) * (B.size[1] - B.size[0]));
      ctx.globalAlpha = Math.min(1, fade * 1.6);
      ctx.fillStyle = kind === 'splash' ? (i & 1 ? '#bfe6ff' : '#ffffff') : cols ? cols[i & 1] : (kind === 'chop' ? (i & 1 ? '#8b5a2b' : '#e8c08a') : (i & 1 ? '#7c8494' : '#c3c9d6'));
      ctx.fillRect(Math.round(px) - (sz >> 1), Math.round(py) - (sz >> 1), sz, sz);
      if (sz >= 3 && kind !== 'splash') { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(Math.round(px) - (sz >> 1), Math.round(py) + (sz >> 1) - 1, sz, 1); } // ขอบล่างเข้มให้ดูเป็นก้อน
    }
    if (B.spark && t < 200) { // ประกายไฟจากเหล็กกระทบหิน: เส้นสั้นสีเหลืองขาวพุ่งออก
      ctx.globalAlpha = 1 - t / 200;
      for (let i = 0; i < B.spark; i++) { const a = -Math.PI / 2 + (rnd(seed, i + 200) - 0.5) * 3, r1 = 3 + t / 14, r2 = r1 + 5;
        ctx.fillStyle = i & 1 ? '#fff6c0' : '#ffd24a';
        for (let k = 0; k < 3; k++) { const rr = r1 + (r2 - r1) * k / 2; ctx.fillRect(Math.round(x + Math.cos(a) * rr) - 1, Math.round(y + Math.sin(a) * rr) - 1, 2, 2); } }
    }
    if (B.leaf) for (let i = 0; i < B.leaf; i++) { // ใบไม้ร่วงช้าๆ ส่ายไปมา
      const lx = x + (rnd(seed, i + 300) - 0.5) * 20 + Math.sin(t / 90 + i * 2) * 4, ly = y - 18 + t / 14;
      ctx.globalAlpha = fade; ctx.fillStyle = i & 1 ? '#5fa844' : '#3f8a34'; ctx.fillRect(Math.round(lx) - 2, Math.round(ly) - 1, 4, 2); ctx.fillRect(Math.round(lx) - 1, Math.round(ly) - 2, 2, 4);
    }
    ctx.restore();
  }
  return { SHEETS, kindOf, frame, dur, front, burst, BURST };
})();
if (typeof module !== 'undefined') module.exports = PixelAction;
