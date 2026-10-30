// ก้อนแร่ในถ้ำแบบพิกเซลอาร์ตวาดมือ (กริดตัวอักษร) • 1 พิกเซลศิลป์ = 2 พิกเซลเกม (กริด 16 พิกเซลต่อช่อง) แสงจากซ้ายบน 3+ โทน ขอบเข้ม 1 พิกเซลเติมอัตโนมัติ
// - PixelOre.has(kind)         : มีสไปรต์วาดมือของแร่ชนิดนี้แล้วหรือยัง (ยังไม่มี game.js ใช้แบบเดิมไปก่อน)
// - PixelOre.get(kind, size, f): แคนวาสสไปรต์ (size 0 เล็ก 1 กลาง 2 ใหญ่, f = เฟรมประกาย) วาดด้วย drawImage ขยาย 2 เท่า ไม่เบลอ จุดยึดคือกึ่งกลางด้านล่าง
// เพิ่มแร่ชนิดใหม่: ใส่พาเลต PAL[kind] (ตัวอักษร → สี) และกริด ART[kind] = [เล็ก, กลาง, ใหญ่] (แต่ละอันเป็นแถวตัวอักษรกว้างเท่ากัน '.' = โปร่งใส) ตัวเลือก ART[kind].alt = เฟรมประกาย (ชุดกริดเดียวกันที่ต่างเฉพาะจุดประกาย)
const PixelOre = (() => {
  const OUTLINE = '#1b1d24';
  // พาเลตตัวอักษร: h ไฮไลต์ • l สว่าง • m หลัก • d เงา • x เงาเข้ม • c รอยแตก
  const STONE = { h: '#e3e7ee', l: '#c3c9d6', m: '#a4abb8', d: '#7c8494', x: '#5b6477' };
  const PAL = {
    stone: { h: '#e3e7ee', l: '#c3c9d6', m: '#a4abb8', d: '#7c8494', x: '#5b6477', c: '#4c536a' },
    // แร่ชนิดอื่น: หินฐานโทนเดียวกับหิน (h l m d x) + เม็ดแร่ n หลัก • p ไฮไลต์ • q เงา • s ประกาย (เฟสสลับ p → s)
    coal:     { ...STONE, n: '#3a3a44', p: '#62626f', q: '#1c1c22' },
    copper:   { ...STONE, n: '#e8924a', p: '#ffc58a', q: '#b0602a' },
    iron:     { ...STONE, n: '#c49a82', p: '#e8cbb4', q: '#8a6a58' },
    silver:   { ...STONE, n: '#eef2f7', p: '#ffffff', q: '#aab4c2', s: '#ffffff' },
    gold:     { ...STONE, n: '#ffe066', p: '#fff3a8', q: '#d9a21e', s: '#ffffff' },
    amethyst: { ...STONE, n: '#b36be0', p: '#e2b8ff', q: '#7a35b0', s: '#ffffff' },
    ruby:     { ...STONE, n: '#e0334f', p: '#ff9aa8', q: '#9a1630', s: '#ffffff' },
    emerald:  { ...STONE, n: '#2fcf78', p: '#9bffc4', q: '#13803f', s: '#ffffff' },
    crystal:  { h: '#f2fbff', l: '#d3e6f2', m: '#b3cce0', d: '#8aa4c0', x: '#647fa0', n: '#5ec8f0', p: '#d4f8ff', q: '#2a82bd', s: '#ffffff' },
    opal:      { ...STONE, n: '#e8f0ff', p: '#ffffff', q: '#a8b8d8', s: '#ffd0f0' },
    topaz:     { ...STONE, n: '#f2c030', p: '#fff0a0', q: '#c08010', s: '#ffffff' },
    sapphire:  { ...STONE, n: '#3a62d8', p: '#a8c4ff', q: '#1c2f8a', s: '#ffffff' },
    garnet:    { ...STONE, n: '#b8402c', p: '#ee8c70', q: '#6a1a12' },
    jade:      { ...STONE, n: '#2fb878', p: '#9af0c0', q: '#12704a', s: '#ffffff' },
    obsidian:  { h: '#c8bee0', l: '#9a8cb8', m: '#6a5a8a', d: '#4a3c68', x: '#2c2244', n: '#2a2038', p: '#6a5a8a', q: '#12091c', s: '#ffffff' },
    moonstone: { ...STONE, n: '#c4d4ff', p: '#ffffff', q: '#7a8ac0', s: '#ffffff' },
    sunstone:  { ...STONE, n: '#ff9a3c', p: '#ffd890', q: '#c04a14', s: '#ffffff' },
    mythril:   { ...STONE, n: '#58d8f0', p: '#d0faff', q: '#2a88b0', s: '#ffffff' },
    starcore:  { h: '#fffbe0', l: '#f0e4b0', m: '#d4c080', d: '#a89050', x: '#786830', n: '#ffd84a', p: '#fffbb0', q: '#d08a10', s: '#ffffff' },
  };
  // แม่แบบก้อนหินมีแร่ 3 แบบ × 3 ขนาด: A เม็ดกระจาย (ถ่าน ทองแดง เงิน) • B เส้นแร่เฉียง (เหล็ก ทอง) • C ผลึกชี้ขึ้นจากหินฐาน (อเมทิสต์ ทับทิม มรกต คริสตัล)
  const TPL_A = [
    ['....hhhh....','..hhllllmm..','.hlpnmmmmmd.','hlmnqmmpnmdx','lmmmmmmnqmdx','lmpnmmmmmddx','.mnqmmmdddx.','..xxddddxx..'],
    ['....hhhhhh......','..hhlllllllm....','.hlllpnlmmmmmmd.','hllmmnqmmmmpnmdx','lmmmmmmmmmmnqmdx','lmpnmmmmmmmmmmdx','lmnqmmmmpnmmmddx','llmmmmmmnqmmdddx','.mmpnmmmmmmddxxx','..xxdddddddddxx.'],
    ['......hhhhhhh.......','....hhlllllllllm....','...hlllpnllllmmmmm..','..hllllnqlmmmmmmmmd.','.hllllllllmmmmpnmmdd','hlmmpnmmmmmmmmnqmmdx','lmmmnqmmmmmmmmmmmddx','lmmmmmmmpnmmmmmmmddx','lmmpnmmmnqmmmmmmmdxx','lmmnqmmmmmmmmmpnmdxx','llmmmmmmmmmmmmmdddxx','.mmmpnmmmmmmmdddxxx.','..xdmmnqmmmmmddddxx.','...xxdddddddddddxx..'],
  ];
  const TPL_B = [
    ['....hhhh....','..hhllllmm..','.hlmmmmnpmd.','hlmmmmnnmmdx','lmmmmnnqmmdx','lmmmnnqmmddx','.mmnnqmdddx.','..xxddddxx..'],
    ['....hhhhhh......','..hhlllllllm....','.hllllmmmmmnpmd.','hllmmmmmmmnnpmdx','lmmmmmmmmnnqmmdx','lmmmmmmmnnqmmmdx','lmmmmmmnnqmmmddx','llmmmmnnqmmmdddx','.mmmmnnqmmmddxxx','..xxdddddddddxx.'],
    ['......hhhhhhh.......','....hhlllllllllm....','...hlllllllllmmmmm..','..hllllllllmmmmmnpd.','.hllllllllmmmmmnnpdd','hlmmmmmmmmmmmmnnqmdx','lmmmmmmmmmmmmnnqmmdx','lmmmmmmmmmmmnnqmmddx','lmmmmmmmmmmnnqmmmddx','lmmmmmmmmmnnqmmmdddx','llmmmmmmmnnqmmmmdddx','.mmmmmmmnnqmmmdddxx.','..xdmmmmnqmmmmddddxx','...xxdddddddddddxx..'],
  ];
  const TPL_C = [
    ['.....p......','....pnq..p..','...pnnq.pnq.','...nnnqpnnq.','..hnnqmnnqd.','.hlmmnqmmmdx','lmmmmmmmmmdx','.xxddddddxx.'],
    ['......p.........','.....pnq...p....','....pnnq..pnq...','....nnnq.pnnnq..','...pnnnqpnnnnq..','...nnnnqnnnnqq..','..hnnnqmmnnqmd..','.hlmmnqmmmmmmmd.','lmmmmmmmmmmmmmdx','.xxdddddddddddx.'],
    ['.........p..........','........pnq.....p...','.......pnnq....pnq..','.......nnnq...pnnnq.','......pnnnnq..nnnnq.','.....pnnnnnqpnnnnnq.','.....nnnnnnqnnnnnnq.','....pnnnnnnqnnnnnqq.','...hnnnnnnqmmnnnnqd.','..hlmmnnnqmmmmnnqmdd','.hlmmmmnnqmmmmmmmmdx','hlmmmmmmmmmmmmmmmmdx','lmmmmmmmmmmmmmmmmddx','.xxddddddddddddddxx.'],
  ];
  const ART = {
    stone: [
      [ // เล็ก 12×8
        '....hhhh....',
        '..hhllllmm..',
        '.hllmmmmmmd.',
        'hlmmmmmcmmdx',
        'lmmmmmcmmmdx',
        'lmmmmmmmmddx',
        '.mmmmmmmdddx',
        '..xxddddxx..',
      ],
      [ // กลาง 16×10
        '....hhhhhh......',
        '..hhlllllllm....',
        '.hlllllllmmmmmd.',
        'hllmmmmmmmmmmmdx',
        'lmmmmmmcmmmmmddx',
        'lmmmmmcmmmmmmddx',
        'lmmmmcmmmmmmmddx',
        'llmmmmmmmmmmdddx',
        '.mmmmmmmmmmddxxx',
        '..xxdddddddddxx.',
      ],
      [ // ใหญ่ 20×14
        '......hhhhhhh.......',
        '....hhlllllllllm....',
        '...hllllllllllmmmm..',
        '..hlllllllllmmmmmmd.',
        '.hllllllllmmmmmmmmdd',
        'hlmmmmmmmmmmmmmmmmdx',
        'lmmmmmmmmcmmmmmmmddx',
        'lmmmmmmmcmmmmmmmmddx',
        'lmmmmmmcmmmmmmmmdddx',
        'lmmmmmcmmmmmmmmmdddx',
        'llmmmmmmmmmmmmmdddxx',
        '.mmmmmmmmmmmmmdddxxx',
        '..xdmmmmmmmmmddddxx.',
        '...xxdddddddddddxx..',
      ],
    ],
    coal: TPL_A, copper: TPL_A, iron: TPL_B, silver: TPL_A, gold: TPL_B, amethyst: TPL_C, ruby: TPL_C, emerald: TPL_C, crystal: TPL_C,
    opal: TPL_A, topaz: TPL_C, sapphire: TPL_C, garnet: TPL_A, jade: TPL_B, obsidian: TPL_C, moonstone: TPL_A, sunstone: TPL_B, mythril: TPL_B, starcore: TPL_C,
  };
  const cache = new Map();
  function get(kind, size, f) {
    const key = kind + size + (f ? 'b' : ''), hit = cache.get(key); if (hit) return hit;
    const set = ART[kind], pal = PAL[kind], rows = set && ((f && set.alt && set.alt[size]) || set[size]); if (!rows) return null;
    const spark = f && pal.s && !(set.alt && set.alt[size]), w = rows[0].length, h = rows.length; // เฟสสลับของแร่ที่มีประกาย: จุดไฮไลต์ p เปลี่ยนเป็นสีประกาย s
    const c = PixelArt.cv(w + 2, h + 2), x = c.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let ch = rows[j][i]; if (spark && ch === 'p') ch = 's'; if (ch !== '.' && pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i + 1, j + 1, 1, 1); } }
    PixelArt.addOutline(c, OUTLINE);
    cache.set(key, c); return c;
  }
  return { has: kind => !!ART[kind], get, ART, PAL };
})();
if (typeof module !== 'undefined') module.exports = PixelOre;
