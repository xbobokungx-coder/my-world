// โค้ดที่ใช้ร่วมกันระหว่างเซิร์ฟเวอร์และเบราว์เซอร์ (แมพ, ข้อมูลพืช/ปลา/สัตว์/ร้าน, เลเวล, การชน)
(function (root) {
  const TS = 32, W = 64, H = 46;
  const T = { GRASS: 0, WATER: 1, TREE: 2, BUILD: 3, PATH: 4, FENCE: 5, SAND: 6, SHOP: 7, FLOOR: 8, FURN: 9 };
  // บ้าน: ที่ดิน 6 แปลงเรียงแถวบนสุดของแมพ (ซื้อได้คนละแปลง) พื้นไม้ เจ้าของวาง/เก็บเฟอร์นิเจอร์ได้ คนอื่นเดินเข้าชมได้
  const HOUSING = { price: 400, refund: 0.7, y0: 2, y1: 5, w: 6, plots: [2, 9, 16, 23, 30, 37] };
  const plotAt = (tx, ty) => {
    if (ty < HOUSING.y0 || ty > HOUSING.y1) return -1;
    for (let i = 0; i < HOUSING.plots.length; i++) if (tx >= HOUSING.plots[i] && tx < HOUSING.plots[i] + HOUSING.w) return i;
    return -1;
  };
  const plotSignAt = (tx, ty) => ty === HOUSING.y0 - 1 ? plotAt(tx, HOUSING.y0) : -1; // ป้ายหน้าที่ดิน (แถวเหนือพื้นไม้)
  // เฟอร์นิเจอร์: solid = เดินผ่านไม่ได้, seat = นั่งได้, flat = พรมปูพื้น, light = ให้แสงตอนกลางคืน
  const FURN_SELL = 0.35; // ร้านเฟอร์นิเจอร์รับซื้อคืนกี่เปอร์เซ็นต์ของราคาซื้อ (ตั้งต่ำไว้ให้เป็นของตกแต่ง ไม่ใช่ช่องทางทำเงิน)
  const FURN = {
    rug:      { name: 'พรมปูพื้น',     emoji: '🟥', price: 150,  flat: true },
    chair:    { name: 'เก้าอี้',        emoji: '🪑', price: 120,  seat: true },
    sofa:     { name: 'โซฟา',         emoji: '🛋️', price: 400, seat: true },
    table:    { name: 'โต๊ะอาหาร',     emoji: '🍽️', price: 250,  solid: true },
    bed:      { name: 'เตียงนอน',      emoji: '🛏️', price: 600, solid: true, size: 30 },
    shelf:    { name: 'ชั้นหนังสือ',    emoji: '📚', price: 350, solid: true },
    tv:       { name: 'ทีวี',          emoji: '📺', price: 700, solid: true },
    fridge:   { name: 'ตู้เย็น',        emoji: '🧊', price: 500, solid: true },
    plant:    { name: 'ต้นไม้ในกระถาง', emoji: '🪴', price: 90,  solid: true },
    piano:    { name: 'เปียโน',        emoji: '🎹', price: 1200, solid: true },
    trophy:   { name: 'ถ้วยรางวัล',    emoji: '🏆', price: 800, solid: true },
    painting: { name: 'ภาพวาด',       emoji: '🖼️', price: 200 },
    teddy:    { name: 'ตุ๊กตาหมี',      emoji: '🧸', price: 160 },
    statue:   { name: 'รูปปั้นหินประจำเมือง', emoji: '🗿', price: 1500, solid: true, rare: true },
    fountain: { name: 'น้ำพุ',               emoji: '⛲', price: 1500, solid: true, rare: true },
    cat:      { name: 'แมวเฝ้าบ้าน',          emoji: '🐈', price: 1500, rare: true },
    flag:     { name: 'ธงหมู่บ้าน',           emoji: '🚩', price: 1500, rare: true },
    // ของที่ช่างไม้ประดิษฐ์เองเท่านั้น (ไม่วางขายในร้าน)
    crate:    { name: 'ลังไม้',            emoji: '📦', price: 180,  solid: true, craft: true },
    barrel:   { name: 'ถังไม้โอ๊ก',         emoji: '🛢️', price: 270,  solid: true, craft: true },
    signpost: { name: 'ป้ายชี้ทาง',         emoji: '🪧', price: 285,  craft: true },
    mailbox:  { name: 'ตู้ไปรษณีย์',        emoji: '📮', price: 360, solid: true, craft: true },
    toolbox:  { name: 'ตู้เครื่องมือช่าง',   emoji: '🧰', price: 465, solid: true, craft: true },
    hut:      { name: 'กระท่อมไม้น้อย',     emoji: '🛖', price: 1400, solid: true, craft: true, size: 31 },
    lantern:  { name: 'โคมไฟ (สว่างตอนกลางคืน)', emoji: '🏮', price: 350, light: true },
  };
  const FARM = { x0: 6, y0: 8, x1: 21, y1: 17 };       // แปลงผัก (ช่องที่ขุดได้)
  const YARD = { x0: 47, y0: 9, x1: 53, y1: 13 };      // คอกไก่
  const PASTURE = { x0: 47, y0: 17, x1: 60, y1: 25 };  // ทุ่งวัว
  const PIGPEN = { x0: 57, y0: 9, x1: 61, y1: 13 };    // คอกหมู
  const SPAWN = { x: 31 * TS + 16, y: 22 * TS + 16 };
  const START_SPAWN = { x: 14 * TS, y: 19 * TS + 16 }; // ผู้เล่นที่เข้าเกมครั้งแรกเกิดตรงประตูแปลงผัก (ใกล้ข้อแรกของคู่มือ) คนเก่าอยู่ตรงที่ออกไว้
  const DAY_MS = 12 * 60 * 1000;                       // 1 วันในเกม = 12 นาทีจริง
  const WATER_MS = 90000;                              // ดินเปียกนานเท่าไร
  const MAX_LV = 10;

  // อาชีพ 4 สาย (ช่างไม้เพิ่งเริ่ม: ตัดไม้ขาย ยังไม่มีงานฝีมือ)
  const SKILLS = {
    farm:   { name: 'ชาวนา',     emoji: '🌾' },
    fish:   { name: 'ชาวประมง',  emoji: '🎣' },
    animal: { name: 'คนเลี้ยงสัตว์', emoji: '🐄' },
    wood:   { name: 'ช่างไม้',    emoji: '🪵' },
  };
  const xpFor = lv => 30 * (lv - 1) * (lv - 1);        // XP สะสมที่ต้องใช้ถึงเลเวลนั้น
  const levelOf = xp => Math.min(MAX_LV, Math.floor(Math.sqrt((xp || 0) / 30)) + 1);

  // เมล็ดพืช: lv = เลเวลชาวนาที่ปลดล็อก, time = เวลาโต (ms) เมื่อรดน้ำต่อเนื่อง, xp = XP ตอนเก็บเกี่ยว
  // หลักการตั้งราคา: ใช้เวลาโตนานราคาสูง • กำไรต่อวินาทีต่อแปลง ≈ 0.20-0.25 (ต่ำกว่าสายอื่น เพราะปลูกได้ทีละหลายสิบแปลง)
  const CROPS = {
    carrot:     { name: 'แครอท',      emoji: '🥕', seed: 10, sell: 20,  time: 60000,  lv: 1, xp: 5 },
    cabbage:    { name: 'กะหล่ำปลี',   emoji: '🥬', seed: 15, sell: 28,  time: 80000,  lv: 1, xp: 7 },
    corn:       { name: 'ข้าวโพด',     emoji: '🌽', seed: 20, sell: 39,  time: 100000, lv: 2, xp: 9 },
    tomato:     { name: 'มะเขือเทศ',   emoji: '🍅', seed: 25, sell: 50,  time: 120000, lv: 3, xp: 12 },
    eggplant:   { name: 'มะเขือม่วง',  emoji: '🍆', seed: 35, sell: 67,  time: 140000, lv: 4, xp: 16 },
    strawberry: { name: 'สตรอว์เบอร์รี', emoji: '🍓', seed: 45, sell: 84,  time: 160000, lv: 5, xp: 20 },
    pumpkin:    { name: 'ฟักทอง',      emoji: '🎃', seed: 60, sell: 113, time: 200000, lv: 6, xp: 26 },
    potato:     { name: 'มันฝรั่ง',     emoji: '🥔', seed: 18,  sell: 35,  time: 90000,  lv: 2, xp: 10 },
    chili:      { name: 'พริก',        emoji: '🌶️', seed: 28,  sell: 55,  time: 130000, lv: 3, xp: 14 },
    broccoli:   { name: 'บรอกโคลี',     emoji: '🥦', seed: 38,  sell: 72,  time: 150000, lv: 4, xp: 18 },
    cherry:     { name: 'เชอร์รี',      emoji: '🍒', seed: 55,  sell: 99, time: 180000, lv: 5, xp: 22 },
    grape:      { name: 'องุ่น',        emoji: '🍇', seed: 70,  sell: 131, time: 230000, lv: 6, xp: 28 },
    pineapple:  { name: 'สับปะรด',      emoji: '🍍', seed: 85,  sell: 162, time: 270000, lv: 7, xp: 34 },
    mango:      { name: 'มะม่วง',       emoji: '🥭', seed: 110, sell: 215, time: 320000, lv: 9, xp: 42 },
    melon:      { name: 'แตงโม',       emoji: '🍉', seed: 90, sell: 170, time: 260000, lv: 8, xp: 38 },
  };
  // ปลา: lv = เลเวลชาวประมงที่เริ่มตกได้, w = น้ำหนักความน่าจะเป็น (หายาก = ราคาแพง: ราคาแปรผันตามความหายาก)
  const FISH = [
    { id: 'boot',    name: 'รองเท้าเก่า',  emoji: '👢', sell: 1,   xp: 1,  w: 8,  lv: 1 },
    { id: 'carp',    name: 'ปลาตะเพียน',  emoji: '🐟', sell: 12,  xp: 6,  w: 40, lv: 1 },
    { id: 'catfish', name: 'ปลาดุก',      emoji: '🐡', sell: 16,  xp: 8,  w: 25, lv: 1 },
    { id: 'bass',    name: 'ปลากะพง',     emoji: '🐠', sell: 20,  xp: 12, w: 20, lv: 2 },
    { id: 'shrimp',  name: 'กุ้ง',        emoji: '🦐', sell: 26,  xp: 15, w: 15, lv: 3 },
    { id: 'crab',    name: 'ปู',          emoji: '🦀', sell: 32,  xp: 20, w: 12, lv: 4 },
    { id: 'koi',     name: 'ปลาคอยทอง',   emoji: '🎏', sell: 50,  xp: 35, w: 6,  lv: 5 },
    { id: 'lobster', name: 'กุ้งมังกร',    emoji: '🦞', sell: 55,  xp: 40, w: 5,  lv: 6 },
    { id: 'squid',   name: 'หมึก',        emoji: '🦑', sell: 65,  xp: 50, w: 4,  lv: 7 },
    { id: 'shell',   name: 'หอยเชลล์',     emoji: '🐚', sell: 18,  xp: 9,   w: 22, lv: 2 },
    { id: 'frog',    name: 'กบน้อย',      emoji: '🐸', sell: 24,  xp: 12,  w: 18, lv: 3 },
    { id: 'oyster',  name: 'หอยนางรม',    emoji: '🦪', sell: 36,  xp: 22,  w: 12, lv: 4 },
    { id: 'turtle',  name: 'เต่าน้อย',     emoji: '🐢', sell: 44,  xp: 30,  w: 6,  lv: 5 },
    { id: 'shark',   name: 'ฉลามน้อย',    emoji: '🦈', sell: 90, xp: 85,  w: 1.3, lv: 9 },
    { id: 'whale',   name: 'วาฬน้อย',     emoji: '🐳', sell: 120, xp: 120, w: 0.7, lv: 10 },
    { id: 'octopus', name: 'ปลาหมึกยักษ์', emoji: '🐙', sell: 75, xp: 70, w: 3,  lv: 8 },
    { id: 'otter',   name: 'นากน้ำ',       emoji: '🦦', sell: 55,  xp: 45, w: 4,  lv: 6 },
    { id: 'croc',    name: 'จระเข้น้อย',    emoji: '🐊', sell: 85, xp: 80, w: 1.6, lv: 8 },
    { id: 'seal',    name: 'แมวน้ำ',       emoji: '🦭', sell: 105, xp: 100, w: 0.9, lv: 9 },
    { id: 'dolphin', name: 'โลมา',         emoji: '🐬', sell: 140, xp: 140, w: 0.5, lv: 10 },
    { id: 'humpback', name: 'วาฬหลังค่อม', emoji: '🐋', sell: 190, xp: 200, w: 0.25, lv: 10 },
  ];
  // ช่างไม้: ตัดต้นไม้ด้วยขวาน (ขวานแรงกว่าตัดเร็วกว่า) ได้ไม้ท่อน หายากได้ไม้เนื้อแข็งราคาแพง
  const AXES = { 1: { name: 'ขวานหิน', price: 50, power: 1 }, 2: { name: 'ขวานเหล็ก', price: 220, lv: 3, power: 2 }, 3: { name: 'ขวานเหล็กกล้า', price: 700, lv: 6, power: 3 } };
  const TREE_HP = 4;                       // ต้องฟันกี่แต้มถึงล้ม (ขวานหิน = 4 ครั้ง, เหล็ก 2, เหล็กกล้า 2)
  const WOOD = { log: { sell: 10, xp: 5 }, hardwood: { sell: 35, xp: 14, chance: 0.12 } };
  // สัตว์ป่วย: ป่วยได้พร้อมกันไม่เกิน max ตัว (รวมทุกชนิด) รักษาด้วยยาตัวเดียวกัน ป่วยแล้วถ้าไม่รักษาจะตายเร็วกว่าหิวปกติ
  const SICK = { max: 1, graceMs: 150000, checkMs: DAY_MS, chance: 0.3 }; // สัตว์ป่วยทีละ 1 ตัวเท่านั้น สุ่มวันละครั้ง (1 วันในเกม = 12 นาทีที่มีคนออนไลน์) โอกาส 30% วันไหนไม่ป่วยก็ข้ามไปวันถัดไปเลย
  const SELLBACK = 0.7;                    // ขายของที่ซื้อมา (เสื้อผ้า คันเบ็ด ขวาน ตะเกียง) คืนร้านได้ 70% ของราคาซื้อ (หัก 30%)
  const CASINO = { bets: [10, 25, 50, 100], perRound: 0.04, recoverPerHour: 0.15 }; // คาสิโน: ความล้า/โชคของผู้เล่น (ซ่อนจากผู้เล่น)
  // เศรษฐกิจ: ตลาดรับซื้อมีราคาขึ้นลง (ขายเยอะราคาตก ปล่อยไว้ราคากลับมา) ค่าบริการตู้เกม 5% ของเงินรางวัลเป็นตัวดูดเหรียญออกจากระบบ
  // เหยื่อ 3 ระดับ: ยิ่งแพงยิ่งเจอปลาแพง (mul = ตัวคูณน้ำหนักสุ่มตามกลุ่มราคาปลา: <20 / <60 / <120 / 120+, boot = รองเท้าเก่า)
  const BAITS = {
    1: { id: 'bait',   name: 'ไส้เดือน',        emoji: '🪱', price: 2,  mul: [1, 1, 1, 1],           boot: 1 },
    2: { id: 'bait_2', name: 'กุ้งฝอยสด',       emoji: '🍤', price: 8,  lv: 4, mul: [0.4, 1.4, 3, 5], boot: 0.3 },
    3: { id: 'bait_3', name: 'ปลอมทองคำ', emoji: '✨', price: 25, lv: 6, mul: [0.03, 0.35, 5, 14],  boot: 0 },
  };
  const fishClass = f => (f.sell < 20 ? 0 : f.sell < 60 ? 1 : f.sell < 120 ? 2 : 3);
  const baitWeight = (f, tier) => { const b = BAITS[tier] || BAITS[1]; return f.id === 'boot' ? b.boot : b.mul[fishClass(f)]; };
  const BAIT_PRICE = 2;       // เหยื่อตกปลา: ใช้ 1 ชิ้นต่อการเหวี่ยง 1 ครั้ง
  const RAKE = 0.05;          // ค่าบริการตู้เกม (หักจากรางวัลของผู้ชนะที่มีเดิมพัน)
  // ตลาดมีลิมิต: ขายต่อเนื่องยิ่งขายเยอะ ราคาต่อชิ้นยิ่งถูกลงเรื่อยๆ (ชิ้นละ -4% ทบต่อกัน ต่ำสุด 20% ของราคาปกติ) และฟื้นตัวช้า
  const MARKET = { step: 0.96, min: 0.2, max: 1.4, recover: 0.06 };
  // ตลาดแยกต่อคน: ราคาที่ผู้เล่นเห็น = ตลาดกลาง × ตลาดส่วนตัว × โบนัสความหลากหลาย ขายชนิดเดิมซ้ำๆ ตลาดส่วนตัวของคนนั้นตกหนัก (share = สัดส่วนที่ตกเป็นของส่วนตัว) และฟื้นช้า (recover ต่อ 1 นาทีที่ออนไลน์)
  const PMARKET = { share: 0.75, min: 0.25, recover: 0.03 };
  // โบนัสความหลากหลาย: ขายหลายชนิดในวันเดียว (วันจริง) ได้ตัวคูณเพิ่มต่อชนิดที่ต่างกัน
  const VARIETY = { per: 0.05, max: 0.4, minQty: 3, minCoin: 40 }; // ชนิดที่ขายนับเข้าโบนัสเมื่อขาย ≥ minQty ชิ้น หรือได้ ≥ minCoin เหรียญ
  const varietyBonus = n => Math.min(VARIETY.max, VARIETY.per * Math.max(0, n - 1)); // n = จำนวนชนิดที่ขายวันนี้ รวมชนิดที่กำลังขาย
  // ความทนทานเครื่องมือ: ใช้งานทุกครั้งสึกหรอ 1 หน่วย ใช้ครบแล้วใช้ไม่ได้จนกว่าจะซ่อมที่ร้านเสียเหรียญ (ค่าซ่อมคิดตามส่วนที่สึกหรอ) = รายจ่ายที่เกิดขึ้นสม่ำเสมอ
  const DURABILITY = {
    hoe:   { max: [0, 120, 120, 120], fix: [0, 24, 24, 24],  shop: 'farm',   name: 'จอบ' },
    rod:   { max: [0, 100, 140, 200], fix: [0, 30, 72, 168], shop: 'fish',   name: 'เบ็ดตกปลา' },
    axe:   { max: [0, 90, 140, 220],  fix: [0, 36, 96, 216], shop: 'wood',   name: 'ขวาน' },
  };
  // อัตราสึกหรอ: เกจเท่าเดิม แต่ใช้ 1 ครั้งสึก base หน่วย (เดิม 1) และ "ความร้อน" สะสมเมื่อใช้ถี่ๆ ต่อเนื่อง: ทุกครั้งที่ใช้ +1, เย็นลง cool ต่อวินาที
  // ตัวคูณการสึก = 1 + min(maxBonus, ความร้อน × perHeat) → ใช้ถี่และนานได้สูงสุด 2 เท่า (พักสักครู่ก็เย็นลง) เตือนเมื่อความร้อนถึง warnHeat
  const WEAR_RATE = { base: 1.35, cool: 0.2, perHeat: 0.01, maxBonus: 1, warnHeat: 35 };
  // ซ่อมได้จำกัด: ซ่อมแต่ละครั้งความทนทานสูงสุดลดลง decay ของค่าเดิม ค่าซ่อมแพงขึ้น growth ต่อครั้ง ซ่อมครบ maxFixes ครั้งแล้วซ่อมไม่ได้อีก ต้องซื้อใหม่ (ราคา TOOL_PRICE)
  // สมดุล: ค่าซ่อมเต็ม = pct × ราคาซื้อ × (1 + growth × ครั้งที่ซ่อมมาแล้ว) แต่ได้ความทนทานน้อยลงเรื่อยๆ → ซ่อมครั้งที่ ~4 ขึ้นไปต่อหน่วยการใช้งานแพงกว่าซื้อใหม่
  const REPAIR = { decay: 0.15, maxFixes: 5, growth: 0.5, pct: 0.25 };
  const TOOL_PRICE = { hoe: [0, 80, 80, 80], rod: [0, 100, 250, 900], axe: [0, 50, 220, 700] };
  const tierN = t => Math.max(1, Math.min(3, t || 1));
  const durMax = (tool, tier, fixes) => Math.max(1, Math.floor(DURABILITY[tool].max[tierN(tier)] * (1 - REPAIR.decay * Math.min(REPAIR.maxFixes, fixes || 0))));
  const toolPrice = (tool, tier) => TOOL_PRICE[tool][tierN(tier)];
  // ค่าซ่อมครั้งถัดไป (ซ่อมแล้วเต็มที่ความทนทานสูงสุดใหม่ที่ต่ำลง) เทียบกับความเสียหายของค่าสูงสุดปัจจุบัน
  const repairCost = (tool, tier, cur, fixes) => { const n = fixes || 0, mx = durMax(tool, tier, n); return Math.max(1, Math.ceil(toolPrice(tool, tier) * REPAIR.pct * (1 + REPAIR.growth * n) * Math.max(0, mx - cur) / mx)); };
  const canRepair = (tool, tier, cur, fixes) => (fixes || 0) < REPAIR.maxFixes && cur < durMax(tool, tier, (fixes || 0) + 1);
  // เทรดของระหว่างผู้เล่น: เทรดเหรียญไม่ได้ เทรดได้เฉพาะของที่ไม่ผูกกับตัว มูลค่ารวมฝั่งละไม่เกิน maxValue ต่อรอบ
  const TRADE = { maxValue: 1000, range: 8 };
  // โรงหนังกลางแปลง: ฉายวิดีโอเดียวกันให้ทุกคนที่เข้าไปดู (ได้ยินเสียงเฉพาะคนที่ดู) ตั๋วชิ้นละ TICKET เหรียญต่อการฉาย 1 รอบ
  const TICKET = 15;
  const MOVIES = [
    { id: 'bbb',    name: 'Big Buck Bunny',  emoji: '🐰', yt: 'aqz-KE-bpKQ', sec: 596 },
    { id: 'sintel', name: 'Sintel',          emoji: '🐉', yt: 'eRsGyueVLvQ', sec: 888 },
    { id: 'tos',    name: 'Tears of Steel',  emoji: '🤖', yt: 'R6MlUcmOul8', sec: 734 },
    { id: 'ed',     name: "Elephant's Dream", emoji: '🐘', yt: 'TLkA0RELQ1g', sec: 654 },
  ];
  function sellQuote(base, m, q) { // ราคารวมเมื่อขาย q ชิ้นต่อเนื่อง และตัวคูณใหม่
    let total = 0;
    for (let i = 0; i < q; i++) { total += Math.max(1, Math.round(base * m)); m = Math.max(MARKET.min, m * MARKET.step); }
    return { total, m };
  }
  // สัตว์ที่เลี้ยงได้ (ใช้ร่วมกันทั้งโลก): cap = จำนวนสูงสุด, feedItem = อาหารที่กิน
  const ANIMALS = {
    // starveMin = กี่นาที (ที่มีผู้เล่นออนไลน์) ที่สัตว์หิวจากอิ่มเต็มจนหมด, หลังหมดแล้วเหลือเวลาอีก graceMs ก่อนจะตาย
    chicken: { name: 'ไก่', emoji: '🐔', product: 'egg',  feedItem: 'feed', price: 120, lv: 1, cap: 8, init: 4, time: [25000, 45000], xp: 4, starveMin: 25 },
    cow:     { name: 'วัว', emoji: '🐄', product: 'milk', feedItem: 'hay',  price: 600, lv: 3, cap: 4, init: 1, time: [45000, 75000], xp: 8, starveMin: 35 },
    duck:    { name: 'เป็ด', emoji: '🦆', product: 'duck_egg', feedItem: 'feed', price: 220, lv: 2, cap: 5, init: 0, time: [30000, 50000], xp: 5, starveMin: 25 },
    sheep:   { name: 'แกะ', emoji: '🐑', product: 'wool',     feedItem: 'hay',  price: 850, lv: 4, cap: 4, init: 0, time: [50000, 80000], xp: 10, starveMin: 35 },
    pig:     { name: 'หมู', emoji: '🐖', product: 'truffle', feedItem: 'slop', price: 1100, lv: 5, cap: 4, init: 0, time: [60000, 90000], xp: 12, starveMin: 35 },
  };
  const ANIMAL_GRACE_MS = 4 * 60 * 1000;   // สัตว์ที่หิวจนหมดแล้ว ถ้าไม่มีใครให้อาหารภายใน 4 นาทีจะตาย
  const PLAYER_HUNGER = { tickMs: 15000, start: 80, sitMs: 5000, sitGain: 1 }; // ผู้เล่นหิวลง 1 แต้มทุก 15 วินาที (เต็ม 100 อยู่ได้ ~25 นาที) ออฟไลน์ไม่ลด
  // บัวรดน้ำ 3 ระดับ: cap = ตักน้ำได้ครั้งละกี่ครั้งรด (หมดต้องกลับไปตักที่สระ), wet = ดินเปียกนานแค่ไหนหลังรด (ms), ต้องมีเลเวลชาวนาตามกำหนดถึงซื้อได้
  const CANS = {
    1: { name: 'บัวรดน้ำสังกะสี', emoji: '🫗', cap: 10, wet: 90000 },
    2: { name: 'บัวรดน้ำทองแดง', emoji: '🚿', price: 180, lv: 3, cap: 20, wet: 120000 },
    3: { name: 'บัวรดน้ำทองคำ',  emoji: '🚰', price: 600, lv: 6, cap: 50, wet: 180000 },
  };
  const canTier = inv => (inv.can_3 ? 3 : inv.can_2 ? 2 : 1);
  // มินิเกมเกจตอนปลากินเบ็ด: ตัวชี้วิ่ง 0→1→0 ไป-กลับ (per = เวลาวิ่งทางเดียว ms) กดตอนอยู่ในโซนกลาง |ตำแหน่ง-0.5| <= half ถึงจะได้ปลา
  const FISH_GAUGE = { per: 650, perRod: 70, half: 0.07, halfRod: 0.015, window: 4200, lag: 60,
    // สุ่มใหม่ทุกครั้งที่ปลากินเบ็ด: จุดกึ่งกลางโซน cMin–cMax, ความเร็วตัวชี้ ×perVar, ความกว้างโซน ×halfVar, จุดเริ่มของตัวชี้ (จับทางไม่ได้)
    // กดโดนกลางโซนจริงๆ (ในระยะ perfect × ครึ่งโซน) = ได้ปลาตามอัตราปกติเต็มที่ ถ้าโดนแค่ขอบโซนปลาแพงจะเจอยากลง (edgeMul ตามกลุ่มราคาปลา 0–3)
    cMin: 0.2, cMax: 0.8, perVar: [0.75, 1.2], halfVar: [0.85, 1.1], perfect: 0.4, edgeMul: [1, 0.75, 0.45, 0.3] };
  const gaugePos = (f, t) => { const ph = ((t - f.gt0) / f.per) % 2; return ph < 1 ? ph : 2 - ph; };
  // lag: ชดเชยเวลาส่งข้อมูล (เช็คทั้งตอนกดจริงและย้อนหลังเล็กน้อย) ให้คนเน็ตช้าไม่เสียเปรียบ
  const gaugeDist = (f, t) => { const c = f.c === undefined ? 0.5 : f.c; return Math.min(Math.abs(gaugePos(f, t) - c), Math.abs(gaugePos(f, t - FISH_GAUGE.lag) - c)); };
  const gaugeHit = (f, t) => gaugeDist(f, t) <= f.half;
  // "เป๊ะ" = ตำแหน่งตัวชี้ (ชดเชยหน่วง lag แบบเดียวกันทุกครั้ง ไม่ขยายโซนข้างเดียว) อยู่ในแกนกลางโซน
  const gaugeCore = (f, t) => Math.abs(gaugePos(f, t - FISH_GAUGE.lag / 2) - (f.c === undefined ? 0.5 : f.c)) <= f.half * FISH_GAUGE.perfect; // ชดเชยหน่วงครึ่งเดียว: คนเน็ตเร็ว/ช้าผิดพลาดไม่เกินครึ่งหนึ่งของแกนกลาง
  const RODS = { 1: { name: 'คันเบ็ดไม้ไผ่' }, 2: { name: 'คันเบ็ดไฟเบอร์', price: 250, lv: 3 }, 3: { name: 'คันเบ็ดคาร์บอน', price: 900, lv: 6 } };

  // เสื้อผ้า: ซื้อแล้วสวมได้ (ราคา 0 = มีให้ฟรีตั้งแต่ต้น) สีของเสื้อ/กางเกง/หมวกเลือกเองได้ฟรีในแท็บ "ตัวละคร"
  const WEAR = {
    shirt: [
      { id: 'tee', name: 'เสื้อยืด', price: 0 }, { id: 'stripe', name: 'เสื้อลายทาง', price: 60 }, { id: 'dots', name: 'เสื้อลายจุด', price: 80 },
      { id: 'vest', name: 'เสื้อกั๊ก', price: 120 }, { id: 'hoodie', name: 'เสื้อฮู้ด', price: 180 }, { id: 'farmer', name: 'ชุดเอี๊ยมชาวนา', price: 250 },
      { id: 'royal', name: 'เสื้อราชาสีทอง', price: 700 },
      { id: 'sailor', name: 'เสื้อกะลาสี', price: 110 }, { id: 'jersey', name: 'เสื้อกีฬาเบอร์ 7', price: 120 }, { id: 'sweater', name: 'เสื้อไหมพรมถัก', price: 140 },
      { id: 'chef', name: 'ชุดเชฟ', price: 160 }, { id: 'jacket', name: 'แจ็กเก็ตยีนส์', price: 200 }, { id: 'kimono', name: 'กิโมโน', price: 260 },
    ],
    pants: [
      { id: 'jeans', name: 'กางเกงขายาว', price: 0 }, { id: 'shorts', name: 'กางเกงขาสั้น', price: 50 }, { id: 'cargo', name: 'กางเกงคาร์โก้', price: 90 },
      { id: 'skirt', name: 'กระโปรง', price: 90 }, { id: 'overall', name: 'กางเกงเอี๊ยม', price: 140 }, { id: 'royal', name: 'กางเกงสีทอง', price: 600 },
      { id: 'jogger', name: 'กางเกงวอร์ม', price: 80 }, { id: 'plaid', name: 'กระโปรงลายสก็อต', price: 110 }, { id: 'hakama', name: 'กางเกงฮากามะ', price: 150 },
    ],
    hat: [
      { id: 'straw', name: 'หมวกฟาง', price: 0 }, { id: 'none', name: 'ไม่สวมหมวก', price: 0 }, { id: 'cap', name: 'หมวกแก๊ป', price: 70 },
      { id: 'beanie', name: 'หมวกไหมพรม', price: 90 }, { id: 'party', name: 'หมวกปาร์ตี้', price: 100 }, { id: 'flower', name: 'มงกุฎดอกไม้', price: 120 },
      { id: 'cowboy', name: 'หมวกคาวบอย', price: 150 }, { id: 'crown', name: 'มงกุฎทองคำ', price: 900 },
      { id: 'headband', name: 'ที่คาดผม', price: 60 }, { id: 'chef', name: 'หมวกเชฟ', price: 100 }, { id: 'bunny', name: 'หูกระต่าย', price: 130 },
      { id: 'miner', name: 'หมวกนิรภัยมีไฟ', price: 180 }, { id: 'pirate', name: 'หมวกโจรสลัด', price: 220 }, { id: 'wizard', name: 'หมวกพ่อมด', price: 260 },
    ],
  };
  // อุปกรณ์เสริม (หมวดที่ 4): สีของชิ้นนี้ใช้สีเดียวกับ "สีหมวก" ในตู้เสื้อผ้า
  WEAR.acc = [
    { id: 'none', name: 'ไม่ใส่', price: 0 }, { id: 'glasses', name: 'แว่นตากลม', price: 60 }, { id: 'shades', name: 'แว่นกันแดด', price: 90 },
    { id: 'bowtie', name: 'โบว์ผูกคอ', price: 70 }, { id: 'scarf', name: 'ผ้าพันคอ', price: 80 }, { id: 'lei', name: 'สร้อยดอกไม้', price: 90 },
    { id: 'backpack', name: 'เป้สะพายหลัง', price: 120 }, { id: 'headphones', name: 'หูฟังครอบหู', price: 150 }, { id: 'cape', name: 'ผ้าคลุมฮีโร่', price: 250 }, { id: 'wings', name: 'ปีกนางฟ้า', price: 400 },
  ];
  const WEAR_CATS = { shirt: { name: 'เสื้อ', emoji: '👕' }, pants: { name: 'กางเกง', emoji: '👖' }, hat: { name: 'หมวก', emoji: '🎩' }, acc: { name: 'อุปกรณ์เสริม', emoji: '🕶️' } };
  const WEAR_DEFAULT = { shirt: 'tee', pants: 'jeans', hat: 'straw', acc: 'none' };
  const wearKey = (cat, id) => 'wear_' + cat + '_' + id;
  const PANTS_COLOR = '#5b4a8a';
  // อาหาร: กินแล้วหายหิว (ค่า = แต้มความอิ่มที่ได้ เต็ม 100) ของที่ผลิตเองกินได้ แต่อิ่มน้อยกว่าอาหารจากร้าน
  const MEALS = [
    { id: 'bread',    name: 'ขนมปัง',            emoji: '🍞', price: 8 },
    { id: 'sandwich', name: 'แซนด์วิช',          emoji: '🥪', price: 15 },
    { id: 'soup',     name: 'ซุปร้อน',           emoji: '🍲', price: 20 },
    { id: 'rice',     name: 'ข้าวผัดไข่',         emoji: '🍛', price: 28 },
    { id: 'cake',     name: 'เค้กสตรอว์เบอร์รี',  emoji: '🍰', price: 40 },
  ];
  // ห้องครัวที่ร้านอาหาร: ทำอาหารจากวัตถุดิบข้ามสาย (ปลา + ผัก + ไข่/นม) ได้ราคาขายสูงกว่าขายของดิบแยกหลายเท่า
  // in: c = หมวด (fish = ปลาชนิดใดก็ได้ [ใช้ชนิดที่ถูกสุดก่อน], crop = ผัก, egg = ไข่ไก่/ไข่เป็ด) หรือ k = ไอเทมระบุชนิด
  const COOK_FEE = 0.2; // ค่าเช่าเตา = สัดส่วนของราคาขายอาหาร จ่ายเป็นเหรียญทุกครั้งที่ทำ
  const COOK_CATS = { fish: { name: 'ปลา/สัตว์น้ำ', emoji: '🐟' }, crop: { name: 'ผัก/ผลไม้', emoji: '🥕' }, egg: { name: 'ไข่', emoji: '🥚' } };
  const COOK = [
    { id: 'dish_grill',   name: 'ปลาย่างผักสด',     emoji: '🍱', sell: 60,  food: 45, in: [{ c: 'fish', n: 1 }, { c: 'crop', n: 1 }] },
    { id: 'dish_omelet',  name: 'ไข่เจียวผักรวม',    emoji: '🍳', sell: 80,  food: 55, in: [{ c: 'egg', n: 2 }, { c: 'crop', n: 1 }] },
    { id: 'dish_seafood', name: 'ซีฟู้ดไข่นุ่ม',     emoji: '🍤', sell: 135, food: 70, in: [{ c: 'fish', n: 2 }, { c: 'egg', n: 1 }, { c: 'crop', n: 1 }] },
    { id: 'dish_feast',   name: 'ชุดเลี้ยงฉลอง',     emoji: '🍽️', sell: 330, food: 100, in: [{ c: 'fish', n: 2 }, { c: 'crop', n: 2 }, { c: 'egg', n: 2 }, { k: 'milk', n: 1 }] },
  ];
  const cookCat = (c, k) => c === 'fish' ? /^fish_/.test(k) && k !== 'fish_boot' : c === 'crop' ? /^crop_/.test(k) : c === 'egg' ? (k === 'egg' || k === 'duck_egg') : false;
  // โครงการพัฒนาเมือง: ที่เก็บเงินขนาดใหญ่ ทุกคนลงขันที่ตู้เซฟกองกลาง ปลดล็อกตามลำดับ ครบเป้าแล้วขึ้นข่าวและประกาศชื่อผู้ร่วมสร้าง
  const PROJECTS = [
    { id: 'bridge',   name: 'สะพานไม้ข้ามสระ',     emoji: '🌉', goal: 5000 },
    { id: 'lighthouse', name: 'ประภาคารริมน้ำ',    emoji: '🗼', goal: 12000 },
    { id: 'island',   name: 'เกาะตกปลาลับ',        emoji: '🏝️', goal: 25000 },
    { id: 'festival', name: 'ลานเทศกาลกลางเมือง',   emoji: '🎪', goal: 40000 },
  ];
  const PROJ_DONATE = [100, 500, 2000];
  const FOOD = {
    meal_bread: 20, meal_sandwich: 35, meal_soup: 40, meal_rice: 60, meal_cake: 35,
    crop_carrot: 6, crop_cabbage: 8, crop_corn: 12, crop_tomato: 8, crop_eggplant: 10, crop_strawberry: 10, crop_pumpkin: 15, crop_melon: 15,
    crop_potato: 12, crop_chili: 6, crop_broccoli: 10, crop_cherry: 10, crop_grape: 12, crop_pineapple: 15, crop_mango: 18,
    egg: 8, milk: 15, truffle: 5, duck_egg: 8,
    dish_grill: 45, dish_omelet: 55, dish_seafood: 70, dish_feast: 100,
  };

  // อาคาร: เคาน์เตอร์ร้าน (counter) อยู่ใกล้กับสิ่งที่ผู้เล่นทำในสายนั้น
  const BUILDINGS = [
    { kind: 'farm',   x0: 25, y0: 10,  x1: 27, y1: 11, counter: [[26, 12], [27, 12]], name: 'ร้านเมล็ดพันธุ์', sign: '🌱', roof: '#3a8f3a', wall: '#f0dcae' },
    { kind: 'fish',   x0: 36, y0: 26, x1: 38, y1: 27, counter: [[37, 28], [38, 28]], name: 'ร้านตกปลา',      sign: '🎣', roof: '#2e7bb5', wall: '#e6d9b5' },
    { kind: 'animal', x0: 40, y0: 14, x1: 42, y1: 15, counter: [[41, 16], [42, 16]], name: 'ร้านปศุสัตว์',    sign: '🐄', roof: '#a8552f', wall: '#f0dcae' },
    { kind: 'coop',   x0: 48, y0: 6,  x1: 50, y1: 7,  counter: [],                  name: 'เล้าไก่',        sign: '🐔', roof: '#8c2f27', wall: '#b5443a' },
    { kind: 'cloth',  x0: 12, y0: 26, x1: 14, y1: 27, counter: [[13, 28], [14, 28]], name: 'ร้านเสื้อผ้า',    sign: '👕', roof: '#d6559a', wall: '#f7e1ee' },
    { kind: 'food',   x0: 20, y0: 26, x1: 22, y1: 27, counter: [[21, 28], [22, 28]], name: 'ร้านอาหาร',      sign: '🍜', roof: '#e08a1e', wall: '#fdeccb' },
    { kind: 'wood',   x0: 6,  y0: 26, x1: 8,  y1: 27, counter: [[7, 28], [8, 28]],   name: 'ร้านช่างไม้',     sign: '🪓', roof: '#8a5a2b', wall: '#f3e2c3' },
    { kind: 'vehicle', x0: 40, y0: 26, x1: 42, y1: 27, counter: [[41, 28], [42, 28]], name: 'ร้านยานพาหนะ',   sign: '🚲', roof: '#3b6ea5', wall: '#e4ecf5' },
    { kind: 'furn',   x0: 36, y0: 19, x1: 38, y1: 20, counter: [[37, 21], [38, 21]], name: 'ร้านเฟอร์นิเจอร์', sign: '🛋️', roof: '#7b4fa3', wall: '#efe4f7' },
    // จอหนังกลางแปลง (ผ้าขาวขึงกับเสา) มีที่นั่งกองฟางเรียงอยู่ด้านล่าง
    { kind: 'cinema', x0: 15, y0: 33, x1: 18, y1: 34, counter: [],                  name: 'หนังกลางแปลง',   sign: '🎬', roof: '#2b2f55', wall: '#f4f4f4' },
    // ป้ายลานตู้เกม (ไม่ใช่อาคาร): ตู้เกมวางเรียงเป็นรูปตัว U อยู่ด้านล่างป้าย
    { kind: 'sign',   x0: 32, y0: 13, x1: 35, y1: 13, counter: [],                  name: 'ตู้เกม',         sign: '🎮', roof: '#6a3fb5', wall: '#8b5a2b' },
  ];
  // ตู้เกม 2 แถว แถวละ 4 ตู้ วางสลับฟันปลาเว้นห่างตู้ละ 1 ช่อง (ไม่ชิดกัน) เดินในแถวกลาง (y=16) ใช้ได้ทั้งสองแถว
  // game = null คือยังไม่เปิด เพิ่มเกมใหม่โดยใส่ game และเขียนกติกาฝั่งเซิร์ฟเวอร์
  const CABINETS = [
    { x: 30, y: 15, game: 'rps',   name: 'เป่ายิ้งฉุบ',      label: 'RPS', emoji: '✊' },
    { x: 32, y: 15, game: 'xo',    name: 'XO',             label: 'XO',  emoji: '❌⭕' },
    { x: 34, y: 15, game: 'uno',   name: 'UNO',            label: 'UNO', emoji: '🃏' },
    { x: 36, y: 15, game: 'react', name: 'ใครกดเร็วกว่า',    label: 'GO!', emoji: '⚡' },
    { x: 31, y: 17, game: 'pok',   name: 'ไพ่ป๊อก',         label: 'POK', emoji: '🎴' },
    { x: 33, y: 17, game: 'c4',    name: 'Connect 4',      label: 'C4',  emoji: '🔴' },
    { x: 35, y: 17, game: 'bacc',  name: 'บาคาร่า',         label: 'BAC', emoji: '🎴' },
    { x: 37, y: 17, game: 'bj',    name: 'แบล็คแจ็ค',       label: '21',  emoji: '🂡' },
  ];
  const GAME_TITLES = { xo: '❌⭕ XO', uno: '🃏 UNO', rps: '✊ เป่ายิ้งฉุบ', react: '⚡ ใครกดเร็วกว่า', pok: '🎴 ไพ่ป๊อก', c4: '🔴 Connect 4', bacc: '🎴 บาคาร่า', bj: '🂡 แบล็คแจ็ค' };
  // ลานพักผ่อนกลางหมู่บ้าน: กองไฟตรงกลาง รอบๆ มีม้านั่ง กองฟาง และเก้าอี้ให้นั่งเล่น (กดที่ที่นั่งเพื่อนั่ง) กลางคืนสว่างเฉพาะรอบกองไฟ
  const PLAZA = { x0: 24, y0: 24, x1: 33, y1: 31 };
  const FIRE = { x: 29, y: 28 };
  const SEATS = [
    { x: 28, y: 26, kind: 'bench', face: 0 }, { x: 30, y: 26, kind: 'bench', face: 0 },
    { x: 28, y: 30, kind: 'bench', face: 1 }, { x: 30, y: 30, kind: 'bench', face: 1 },
    { x: 26, y: 27, kind: 'hay',   face: 3 }, { x: 26, y: 29, kind: 'hay',   face: 3 },
    { x: 32, y: 27, kind: 'chair', face: 2 }, { x: 32, y: 29, kind: 'chair', face: 2 },
  ];
  // ที่นั่งหน้าจอหนัง (กองฟาง หันหน้าขึ้นไปทางจอ)
  for (const x of [15, 16, 17, 18]) SEATS.push({ x, y: 36, kind: 'chair', face: 1 }); // เก้าอี้ 4 ตัวแถวเดียวติดกัน ตรงใต้จอ
  // กระดานข่าว (log ของโลก) และตู้เซฟกองกลาง อยู่ขอบเหนือของลานกองไฟ (ช่องเดินผ่านไม่ได้ กดจากช่องติดกัน)
  const BOARD = { x: 26, y: 24 }, ATM = { x: 29, y: 24 }, CHEST = { x: 32, y: 24 };
  const TOWN = { logMax: 15, donate: [10, 50, 100], autoAfterMs: 60000, revive: 0.5 }; // autoAfterMs = สัตว์ป่วย/หิวจัดนานเท่าไรก่อนเงินกองกลางจ่ายให้เอง, revive = ค่าชุบชีวิตเป็นสัดส่วนของราคาซื้อ
  const townAt = (tx, ty) => (tx === BOARD.x && ty === BOARD.y ? 'board' : tx === CHEST.x && ty === CHEST.y ? 'chest' : tx === ATM.x && ty === ATM.y ? 'atm' : null);
  const reviveCost = type => Math.round(ANIMALS[type].price * TOWN.revive);
  // เควสประจำวัน (วันตามปฏิทินของเซิร์ฟเวอร์): แต่ละคนได้ 3 เควสจาก 3 สายอาชีพที่ต่างกัน ทำเสร็จได้ XP + เหรียญทันที ยิ่งทำสะสมยิ่งได้ฉายา
  // ev = เหตุการณ์ที่นับ, distinct = นับเฉพาะชนิดที่ยังไม่เคยทำวันนี้, min = เฉพาะปลาที่ราคาขายตั้งแต่นี้ขึ้นไป
  const QUESTS = {
    harvest6: { skill: 'farm',   ev: 'harvest', goal: 6, text: 'เก็บเกี่ยวผลผลิต',               xp: 40, coin: 30 },
    kinds3:   { skill: 'farm',   ev: 'harvest', goal: 3, distinct: true, text: 'เก็บเกี่ยวพืช 3 ชนิดที่ต่างกัน', xp: 45, coin: 35 },
    plant8:   { skill: 'farm',   ev: 'plant',   goal: 8, text: 'ปลูกเมล็ดพันธุ์',                xp: 30, coin: 25 },
    water10:  { skill: 'farm',   ev: 'water',   goal: 10, text: 'รดน้ำพืชที่แห้ง',               xp: 30, coin: 25 },
    fish5:    { skill: 'fish',   ev: 'fish',    goal: 5, text: 'ตกปลา',                         xp: 40, coin: 30 },
    fishbig:  { skill: 'fish',   ev: 'fish',    goal: 1, min: 55, text: 'ตกปลามีค่า (ขายได้ 55 ขึ้นไป)', xp: 55, coin: 45 },
    chop4:    { skill: 'wood',   ev: 'chop',    goal: 4, text: 'โค่นต้นไม้',                    xp: 40, coin: 30 },
    craft2:   { skill: 'wood',   ev: 'craft',    goal: 2, text: 'ประดิษฐ์ของที่โรงช่างไม้',        xp: 45, coin: 35 },
    hard1:    { skill: 'wood',   ev: 'hardwood', goal: 1, text: 'หาไม้เนื้อแข็งให้ได้',         xp: 50, coin: 40 },
    collect6: { skill: 'animal', ev: 'collect', goal: 6, text: 'เก็บไข่/นม/เห็ดจากสัตว์',        xp: 40, coin: 30 },
    feed5:    { skill: 'animal', ev: 'feed',    goal: 5, text: 'ให้อาหารสัตว์',                  xp: 35, coin: 25 },
  };
  const QUEST_PER_DAY = 3;
  const TITLES = [[1, 'หน้าใหม่ใจสู้'], [5, 'ชาวเมืองขยัน'], [15, 'ผู้ช่วยแห่งหมู่บ้าน'], [40, 'ปรมาจารย์ฟาร์ม'], [100, 'ตำนานแห่งเมือง']]; // [จำนวนเควสที่ทำสำเร็จสะสม, ฉายา]
  const titleFor = n => { let t = ''; for (const [c, name] of TITLES) if ((n || 0) >= c) t = name; return t; };
  // แต้มความดี: ได้จากการช่วยงานที่จำเป็นจริง (ให้อาหารสัตว์ที่หิว รักษาสัตว์ป่วย รดน้ำพืชที่แห้ง ลงขันตู้เซฟ) จำกัดต่อวัน ใช้แลกบัฟส่วนตัวชั่วคราว
  const POINTS = { dailyCap: 30 };
  const BUFFS = {
    speed:  { name: 'เท้าเบา',  emoji: '🏃', desc: 'เดินเร็วขึ้น 10%',             cost: 10, ms: 15 * 60000 },
    hunger: { name: 'อิ่มทน',   emoji: '🍖', desc: 'ความหิวลดช้าลงครึ่งหนึ่ง',      cost: 8,  ms: 15 * 60000 },
  };
  const FAME = { harvest: ['🌾', 'นักเก็บเกี่ยว'], water: ['💧', 'ผู้ขยันรดน้ำ'], feed: ['🥣', 'พ่อบ้านใส่ใจสัตว์'], fish: ['🎣', 'เซียนตกปลา'], chop: ['🪓', 'นักโค่นไม้'], collect: ['🥚', 'ผู้เก็บผลผลิต'], craft: ['🔨', 'ช่างฝีมือ'] };
  // ตู้ ATM: ฝาก/ถอนเหรียญได้ มีเพดานเงินฝาก ดอกเบี้ย rate ต่อ 1 วันในเกม (12 นาที) นับเฉพาะตอนผู้ฝากออนไลน์ (ไม่รวยเองตอนออฟไลน์)
  const BANK = { cap: 100000, rate: 0.01, tiers: [[1000, 0.01], [10000, 0.004], [100000, 0.0015]], amts: [100, 1000, 10000], idleMs: 180000 }; // ฝากได้สูงสุด cap เพื่อเก็บกินดอก ดอกเบี้ยแบบขั้นบันได: ส่วนแรกอัตราสูง ส่วนที่เกินได้อัตราต่ำลง (กันเงินเฟ้อ) ต่อ 1 วันในเกม
  const bankInterest = bal => { let sum = 0, lo = 0; for (const [hi, rt] of BANK.tiers) { if (bal > lo) sum += (Math.min(bal, hi) - lo) * rt; lo = hi; } return bal > 0 ? Math.max(1, Math.floor(sum)) : 0; };
  // Happy Village: ทั้งเมืองช่วยกันทำงานสะสมครบเป้าของวัน (เป้า = base + per × จำนวนคนออนไลน์สูงสุดของวัน) → ทุกคนได้บัฟร่วม ms มิลลิวินาที
  const VILLAGE = { maxShare: 0.5, base: 30, per: 20, ms: 20 * 60000, fishMul: 0.75, hardBonus: 0.1 };
  // เดิมพันกับบอท: เงินเดิมพันฝั่งบอทมาจากบ้าน (สร้างเหรียญใหม่) จึงจำกัดวงเงินต่อครั้ง และกำไรสุทธิจากบอทต่อวันไม่เกิน dailyWinCap (ขาดทุนไม่จำกัด)
  const BOTBET = { bets: [0], dailyWinCap: 0 }; // ปิดการจ่ายเหรียญจากบอท (ซ้อมฟรีเท่านั้น) จนกว่าจะมีแต้มตู้เกม เดิมคือ bets [0,10,50,100,200,300] และ dailyWinCap 500
  // ของแจกจากกองกลาง: รับได้วันละ 1 ครั้ง ต้อง "เล่นจริง" = ระดับการเล่น (ผลรวมเลเวลทุกอาชีพ) ถึงเกณฑ์ และทำเควสประจำวันสำเร็จอย่างน้อย needQuests ข้อวันนี้
  // ยิ่งเงินกองกลางเยอะยิ่งปลดล็อกชุดแจกที่ใหญ่ขึ้น (ต้องผ่านทั้ง chest และ lv) ต้นทุนทั้งหมดจ่ายจากเงินกองกลาง และต้องเหลือสำรอง reserve ไว้ดูแลสัตว์
  const DOLE = {
    reserve: 60, needQuests: 1,
    tiers: [
      { chest: 100,  lv: 5,  coin: 10,  meals: ['bread'] },
      { chest: 300,  lv: 8,  coin: 25,  meals: ['bread', 'sandwich'] },
      { chest: 600,  lv: 12, coin: 50,  meals: ['sandwich', 'soup'] },
      { chest: 1000, lv: 16, coin: 90,  meals: ['soup', 'rice'] },
      { chest: 2000, lv: 22, coin: 150, meals: ['rice', 'soup', 'cake'] },
    ],
  };
  const playLevel = skills => Object.keys(SKILLS).reduce((n, k) => n + levelOf(skills && skills[k]), 0);
  const doleCost = t => t.coin + t.meals.reduce((n, id) => n + MEALS.find(m => m.id === id).price, 0);
  const dolePackage = (chestCoin, level) => { for (let i = DOLE.tiers.length - 1; i >= 0; i--) { const t = DOLE.tiers[i]; if (chestCoin >= t.chest && level >= t.lv) return t; } return null; };
  const NPC = { sayMin: 45000, sayMax: 110000, gap: 12000, speed: 50 }; // ชาวเมือง NPC: พิมพ์ข้อความทุก sayMin-sayMax ms, เดินด้วยความเร็ว speed px/วินาที
  // คู่มือเริ่มต้น: ทำครบทุกข้อ (ลำดับไหนก็ได้) ได้ของรางวัลเล็กทีละข้อ + รางวัลใหญ่ตอนจบ ปุ่มช่วยบนจอบอก "ข้อถัดไป" ให้เสมอ
  const STARTER = [
    { id: 'dig',     ev: 'dig',       hint: 'ขุดดินในรั้วแปลงผัก ⛏️',     text: 'ขุดดินในรั้วแปลงผัก (เลือกจอบ ⛏️ แล้วแตะพื้นหญ้าในรั้ว)', coin: 15 },
    { id: 'plant',   ev: 'plant',     hint: 'ปลูกเมล็ดลงดินที่ขุด 🥕',    text: 'ปลูกเมล็ดพันธุ์ (เลือกเมล็ด 🥕 แล้วแตะดินที่ขุดไว้)',      coin: 15 },
    { id: 'water',   ev: 'water',     hint: 'รดน้ำต้นพืช 💧',            text: 'รดน้ำต้นพืช (เลือกบัวรดน้ำ 💧 แล้วแตะต้นพืช)',            coin: 15 },
    { id: 'harvest', ev: 'harvest',   hint: 'เก็บเกี่ยวผลผลิตที่โตแล้ว 🌽', text: 'เก็บเกี่ยวผลผลิตเมื่อโตเต็มที่ (แตะต้นพืชที่โตแล้ว)',        coin: 20 },
    { id: 'sell',    ev: 'sell',      hint: 'ขายของที่ร้านเมล็ดพันธุ์ 🪙', text: 'ขายผลผลิตที่ร้านเมล็ดพันธุ์ (ยืนหน้าเคาน์เตอร์แล้วแตะ)',    coin: 20 },
    { id: 'fish',    ev: 'fish',      hint: 'ตกปลาริมสระ 🎣',            text: 'ตกปลา 1 ตัว (เลือกเบ็ด 🎣 ยืนริมสระ แล้วแตะน้ำ)',         coin: 20 },
    { id: 'quest',   ev: 'questdone', hint: 'ทำเควสสักข้อ (เมนู 🎒 แท็บเควส)',     text: 'ทำเควสประจำวันให้สำเร็จ 1 ข้อ (เมนู 🎒 แท็บเควส)',    coin: 30 },
    { id: 'sit',     ev: 'sit',       hint: 'แตะม้านั่งเพื่อนั่งพัก 🪑',  text: 'นั่งพักที่ม้านั่งหรือกองฟางที่ลานกองไฟ (แตะที่นั่ง)',       coin: 10 },
  ];
  // จุดหมายของลูกศรนำทางแต่ละข้อ (ช่อง x,y) • null = ไม่มีลูกศร
  const STARTER_GO = { dig: [14, 13], plant: [14, 13], water: [14, 13], harvest: [14, 13], sell: [26, 12], fish: [18, 19], quest: null, sit: [29, 26] };
  const STARTER_FINAL = { coin: 100, items: ['furn_chair', 'furn_plant'] };
  // สมุดสะสม: ได้ครบทุกชนิดในหมวดไหนรับรางวัลหมวดนั้น (ชนิดใหม่แต่ละชนิดได้ BOOK_ENTRY_COIN) rare = เฟอร์นิเจอร์หายากที่เป็นรางวัล
  const BOOK_ENTRY_COIN = 8;
  const BOOK = {
    fish: { name: 'ปลา',        emoji: '🐟', ids: FISH.filter(f => f.id !== 'boot').map(f => f.id), coin: 300, rare: 'statue' },
    crop: { name: 'พืชผล',      emoji: '🥬', ids: Object.keys(CROPS),                               coin: 250, rare: 'fountain' },
    furn: { name: 'เฟอร์นิเจอร์', emoji: '🛋️', ids: Object.keys(FURN).filter(k => !FURN[k].rare),      coin: 400, rare: 'cat' },
    meal: { name: 'อาหาร',      emoji: '🍜', ids: MEALS.map(m => m.id),                              coin: 100, rare: 'flag' },
  };
  const bookInfo = (cat, id) => {
    if (cat === 'fish') { const f = FISH.find(x => x.id === id); return { emoji: f.emoji, name: f.name }; }
    if (cat === 'crop') return { emoji: CROPS[id].emoji, name: CROPS[id].name };
    if (cat === 'furn') return { emoji: FURN[id].emoji, name: FURN[id].name };
    const m = MEALS.find(x => x.id === id); return { emoji: m.emoji, name: m.name };
  };
  // เป้าหมายรายสัปดาห์ของเมือง: งานรวมของทุกคน (นับเหมือน Happy Village) ถึงเป้า base + per × จำนวนคนที่ลงมือสัปดาห์นี้ → คนที่มีส่วนร่วมอย่างน้อย minShare ครั้งรับรางวัลได้ (ไม่ให้รอรับฟรี)
  const WEEKLY = { maxShare: 0.5, base: 150, per: 100, minShare: 10, coin: 120 };
  const RARE = ['statue', 'fountain', 'cat', 'flag']; // วนเป็นรางวัลประจำสัปดาห์ / ครบ 7 วันติดต่อกัน
  // โรงงานช่างไม้ (ร้านช่างไม้): แปรรูปไม้ท่อนเป็นไม้กระดาน และประดิษฐ์เฟอร์นิเจอร์เอง (ถูกกว่าซื้อ + ได้ XP ช่างไม้) ของที่ทำได้แค่ช่างไม้: ลังไม้ ถังไม้ ป้ายชี้ทาง ตู้ไปรษณีย์ ตู้เครื่องมือ กระท่อมไม้
  // id = ไอเทมที่ได้ (1 ชิ้น), in = วัตถุดิบ, lv = เลเวลช่างไม้ที่ต้องมี
  const CRAFT = [
    { id: 'plank',         in: { log: 2 },                   lv: 1, xp: 4 },
    { id: 'furn_chair',    in: { log: 8 },                   lv: 1, xp: 14 },
    { id: 'furn_crate',    in: { plank: 4 },                 lv: 1, xp: 18 },
    { id: 'furn_table',    in: { log: 16 },                  lv: 2, xp: 28 },
    { id: 'furn_barrel',   in: { plank: 6 },                 lv: 2, xp: 26 },
    { id: 'furn_signpost', in: { plank: 5, log: 4 },         lv: 2, xp: 26 },
    { id: 'furn_shelf',    in: { log: 22 },                  lv: 3, xp: 36 },
    { id: 'furn_mailbox',  in: { plank: 8 },                 lv: 3, xp: 36 },
    { id: 'furn_toolbox',  in: { plank: 8, hardwood: 2 },    lv: 4, xp: 46 },
    { id: 'furn_bed',      in: { log: 30, hardwood: 3 },     lv: 5, xp: 60 },
    { id: 'furn_hut',      in: { plank: 24, hardwood: 6 },   lv: 6, xp: 110 },
  ];
  const seatAt = (tx, ty) => SEATS.find(s => s.x === tx && s.y === ty) || null;
  const cinemaAt = (tx, ty) => tx >= 15 && tx <= 18 && ty >= 33 && ty <= 34;
  const CINEMA_CENTER = { x: 17 * TS, y: 35 * TS };
  const ARC_RANGE = 3.5;              // ระยะ (ช่อง) ที่ต้องอยู่ใกล้ตู้เกมถึงจะเปิด/นั่งเล่นได้ เดินห่างเกิน 3 ช่องจะถูกพาออกจากโต๊ะ
  const BETS = [0, 10, 50, 100, 500]; // ยอดเดิมพันที่เลือกได้ในตู้เกม
  const cabinetAt = (tx, ty) => { for (let i = 0; i < CABINETS.length; i++) if (CABINETS[i].x === tx && CABINETS[i].y === ty) return Object.assign({ idx: i }, CABINETS[i]); return null; };
  // ร้านแต่ละสาย: buy = สินค้าที่ขาย, sell = คำนำหน้าไอเทมที่ร้านรับซื้อ
  const SHOPS = {
    farm:   { name: '🌱 ร้านเมล็ดพันธุ์', skill: 'farm',   buy: Object.keys(CROPS).map(c => 'seed_' + c).concat(['can_2', 'can_3']), sell: ['crop_'] },
    fish:   { name: '🎣 ร้านตกปลา',      skill: 'fish',   buy: ['bait', 'bait_2', 'bait_3', 'rod_2', 'rod_3'],                  sell: ['fish_'] },
    animal: { name: '🐄 ร้านปศุสัตว์',    skill: 'animal', buy: ['feed', 'hay', 'slop', 'medicine', 'animal_chicken', 'animal_duck', 'animal_cow', 'animal_sheep', 'animal_pig'], sell: ['egg', 'duck_egg', 'milk', 'wool', 'truffle'] },
    wood:   { name: '🪓 ร้านช่างไม้',     skill: 'wood',   buy: ['axe_1', 'axe_2', 'axe_3'], sell: ['log', 'hardwood', 'plank'] },
    // ร้านยานพาหนะ: เตรียมไว้ก่อน ยังไม่เปิดขาย (soon = รายการที่จะมาในอนาคต)
    vehicle: { name: '🚲 ร้านยานพาหนะ',  skill: null,     buy: [], sell: [], soon: [
      { emoji: '🚲', name: 'จักรยาน', price: 300 }, { emoji: '🛵', name: 'มอเตอร์ไซค์', price: 1500 }, { emoji: '🚗', name: 'รถยนต์', price: 6000 }, { emoji: '⛵', name: 'เรือ', price: 4000 },
    ] },
    cloth:  { name: '👕 ร้านเสื้อผ้า',    skill: null,     buy: Object.keys(WEAR).flatMap(c => WEAR[c].filter(i => i.price > 0).map(i => wearKey(c, i.id))), sell: [] },
    food:   { name: '🍜 ร้านอาหาร',      skill: null,     buy: MEALS.map(m => 'meal_' + m.id), sell: ['dish_'] },
    furn:   { name: '🛋️ ร้านเฟอร์นิเจอร์', skill: null,     buy: Object.keys(FURN).filter(f => !FURN[f].rare && !FURN[f].craft).map(f => 'furn_' + f).concat('lamp'), sell: ['furn_'] }, // รับซื้อเฟอร์นิเจอร์ในกระเป๋า (ที่ยังไม่ได้วาง) คืนที่ SELLBACK ของราคา
  };

  // ข้อมูลของแต่ละไอเทม: buy/sell = ราคา, lv + skill = เงื่อนไขเลเวลตอนซื้อ
  function itemInfo(k) { const i = itemInfo0(k); if (i && FOOD[k]) i.food = FOOD[k]; return i; }
  function itemInfo0(k) {
    let wm = /^wear_(shirt|pants|hat|acc)_(\w+)$/.exec(k);
    if (wm) { const it = WEAR[wm[1]].find(x => x.id === wm[2]); return it ? { name: it.name, emoji: WEAR_CATS[wm[1]].emoji, buy: it.price, once: true, cat: 'wear', wear: { cat: wm[1], id: it.id } } : null; }
    wm = /^meal_(\w+)$/.exec(k);
    if (wm) { const ml = MEALS.find(x => x.id === wm[1]); return ml ? { name: ml.name, emoji: ml.emoji, buy: ml.price, cat: 'food' } : null; }
    wm = /^dish_(\w+)$/.exec(k);
    if (wm) { const d = COOK.find(x => x.id === k); return d ? { name: d.name, emoji: d.emoji, sell: d.sell, cat: 'food' } : null; }
    if (k === 'log') return { name: 'ไม้ท่อน', emoji: '🪵', sell: WOOD.log.sell, cat: 'wood' };
    if (k === 'plank') return { name: 'ไม้กระดาน', emoji: '🟧', sell: 30, cat: 'wood' };
    if (k === 'hardwood') return { name: 'ไม้เนื้อแข็ง', emoji: '🟫', sell: WOOD.hardwood.sell, cat: 'wood' };
    if (k === 'lamp') return { name: 'ตะเกียง (สว่างรอบตัว 5 ช่อง)', emoji: '🏮', buy: 150, once: true, cat: 'gear' };
    if (k === 'medicine') return { name: 'ยารักษาสัตว์', emoji: '💊', buy: 30, cat: 'feed' };
    const fm = /^furn_(\w+)$/.exec(k);
    if (fm) return FURN[fm[1]] ? { name: FURN[fm[1]].name, emoji: FURN[fm[1]].emoji, buy: FURN[fm[1]].price, sell: FURN[fm[1]].rare ? undefined : Math.floor(FURN[fm[1]].price * FURN_SELL), cat: 'furn', furn: fm[1] } : null;
    const cm = /^can_(\d)$/.exec(k);
    if (cm && CANS[cm[1]] && CANS[cm[1]].price) { const c = CANS[cm[1]]; return { name: `${c.name} (น้ำ ${c.cap} ครั้ง • ดินเปียก ${c.wet / 1000} วิ)`, emoji: c.emoji, buy: c.price, lv: c.lv, skill: 'farm', once: true, cat: 'gear', can: +cm[1] }; }
    let am = /^axe_(\d)$/.exec(k);
    if (am && AXES[am[1]]) return { name: AXES[am[1]].name, emoji: '🪓', buy: AXES[am[1]].price, lv: AXES[am[1]].lv, skill: 'wood', once: true, cat: 'gear', axe: +am[1] };
    if (k === 'egg')  return { name: 'ไข่ไก่', emoji: '🥚', sell: 14, cat: 'animal' };
    if (k === 'duck_egg') return { name: 'ไข่เป็ด', emoji: '🥚', sell: 22, cat: 'animal' };
    if (k === 'wool') return { name: 'ขนแกะ', emoji: '🧶', sell: 62, cat: 'animal' };
    if (k === 'milk') return { name: 'นมวัว', emoji: '🥛', sell: 40, cat: 'animal' };
    if (k === 'feed') return { name: 'อาหารไก่', emoji: '🌾', buy: 5, cat: 'feed' };
    if (k === 'hay')  return { name: 'หญ้าแห้ง (อาหารวัว)', emoji: '🌿', buy: 12, cat: 'feed' };
    if (k === 'slop') return { name: 'อาหารหมู', emoji: '🥣', buy: 15, cat: 'feed' };
    if (k === 'truffle') return { name: 'เห็ดทรัฟเฟิล', emoji: '🍄', sell: 80, cat: 'animal' };
    if (k === 'bait') return { name: 'เหยื่อตกปลา (ไส้เดือน)', emoji: '🪱', buy: BAIT_PRICE, cat: 'tool', bait: 1 };
    const bm = /^bait_(\d)$/.exec(k);
    if (bm && BAITS[bm[1]]) { const b = BAITS[bm[1]]; return { name: `เหยื่อ${b.name} (ปลาแพงขึ้น)`, emoji: b.emoji, buy: b.price, lv: b.lv, skill: 'fish', cat: 'tool', bait: +bm[1] }; }
    let m = /^rod_(\d)$/.exec(k);
    if (m && RODS[m[1]] && RODS[m[1]].price) return { name: RODS[m[1]].name, emoji: '🎣', buy: RODS[m[1]].price, lv: RODS[m[1]].lv, skill: 'fish', once: true, cat: 'gear' };
    m = /^animal_(\w+)$/.exec(k);
    if (m && ANIMALS[m[1]]) { const a = ANIMALS[m[1]]; return { name: 'ซื้อ' + a.name + 'เพิ่ม', emoji: a.emoji, buy: a.price, lv: a.lv, skill: 'animal', animal: m[1], cat: 'animalbuy' }; }
    const i = k.indexOf('_'), a = k.slice(0, i), b = k.slice(i + 1);
    if (a === 'seed' && CROPS[b]) return { name: 'เมล็ด' + CROPS[b].name, emoji: CROPS[b].emoji, buy: CROPS[b].seed, lv: CROPS[b].lv, skill: 'farm', cat: 'seed' };
    if (a === 'crop' && CROPS[b]) return { name: CROPS[b].name, emoji: CROPS[b].emoji, sell: CROPS[b].sell, cat: 'crop' };
    if (a === 'fish') { const f = FISH.find(f => f.id === b); if (f) return { name: f.name, emoji: f.emoji, sell: f.sell, cat: 'fish' }; }
    return null;
  }
  // ขายของที่ซื้อมาคืนร้านได้ในราคา 70% ของราคาซื้อ (เฉพาะของชิ้นเดียวที่ซื้อครั้งเดียว: เสื้อผ้า คันเบ็ด ขวาน ตะเกียง)
  const sellbackValue = k => { const i = itemInfo(k); return i && i.once && i.buy ? Math.floor(i.buy * SELLBACK) : 0; };
  // ของที่เทรดได้: ไม่ใช่เหรียญ ไม่ใช่ของชิ้นเดียวที่ผูกกับตัว (เสื้อผ้า คันเบ็ด ขวาน ตะเกียง) ไม่ใช่สัตว์ที่ซื้อ
  const tradeValue = k => { const i = itemInfo(k); return i ? (i.sell || i.buy || 0) : 0; };
  const isTradable = k => { if (typeof k !== 'string' || k === 'coin') return false; const i = itemInfo(k); return !!(i && !i.once && !i.animal && tradeValue(k) > 0); };
  const shopSells = (kind, key) => !!SHOPS[kind] && SHOPS[kind].sell.some(p => key === p || (p.endsWith('_') && key.startsWith(p)));
  const shopAt = (tx, ty) => { for (const b of BUILDINGS) if (b.counter.some(c => c[0] === tx && c[1] === ty)) return b.kind; return null; };

  function cropStage(tile) {
    const c = CROPS[tile.c]; if (!c) return 0;
    return tile.g >= c.time ? 3 : Math.floor(tile.g / c.time * 3);
  }

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function makeMap() {
    const m = Array.from({ length: H }, () => new Array(W).fill(T.GRASS));
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) m[y][x] = v; };
    const setIfGrass = (x, y, v) => { if (m[y] && m[y][x] === T.GRASS) m[y][x] = v; };
    const road = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setIfGrass(x, y, T.PATH); };
    const fence = (x0, y0, x1, y1) => {
      for (let x = x0; x <= x1; x++) { set(x, y0, T.FENCE); set(x, y1, T.FENCE); }
      for (let y = y0; y <= y1; y++) { set(x0, y, T.FENCE); set(x1, y, T.FENCE); }
    };
    // สระน้ำใหญ่ + ชายหาด
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - 43) / 12, dy = (y - 38) / 5, d = dx * dx + dy * dy;
      if (d < 1) m[y][x] = T.WATER; else if (d < 1.45) m[y][x] = T.SAND;
    }
    // บ่อน้ำเล็กข้างสวนผัก (ใต้รั้วฝั่งขวาล่าง): ยืนในสวนแถวล่างสุดก็ตักน้ำได้ ไม่ต้องเดินไปสระใหญ่
    for (let x = 17; x <= 20; x++) set(x, 19, T.WATER);
    for (let x = 16; x <= 21; x++) { set(x, 20, T.WATER); set(x, 21, T.SAND); }
    set(16, 19, T.SAND); set(21, 19, T.SAND);
    // ถนน
    road(8, 22, 45, 23);   // ถนนหลัก
    road(13, 18, 14, 21);  // ประตูแปลงผัก
    road(26, 13, 27, 21);  // ร้านเมล็ดพันธุ์
    road(34, 24, 35, 29); road(34, 29, 39, 29); // ร้านตกปลา
    road(41, 17, 42, 21);  // ร้านปศุสัตว์
    road(44, 11, 45, 21); road(43, 16, 43, 16);  // ไปคอกไก่/ทุ่งวัว
    road(30, 14, 37, 18);  // พื้นลานในวงตัว U ของตู้เกม
    road(32, 19, 32, 21);  // ทางเข้าลานตู้เกม (ตรงกลางฐาน U) ต่อกับถนนหลัก
    road(17, 24, 18, 29); road(12, 29, 23, 29); // ลานเล็กๆ ระหว่างร้านเสื้อผ้า (ซ้าย) กับร้านอาหาร (ขวา) และทางเดินหน้าเคาน์เตอร์
    road(10, 24, 11, 29); road(6, 29, 11, 29);   // ร้านช่างไม้
    road(34, 29, 43, 29);                        // ต่อทางไปร้านยานพาหนะ
    road(PLAZA.x0, PLAZA.y0, PLAZA.x1, PLAZA.y1); // ลานรวมพลกลางหมู่บ้าน (กองไฟ + ที่นั่ง)
    road(14, 30, 19, 37);                         // ลานดูหนังกลางแปลง
    road(2, HOUSING.y1 + 1, 42, HOUSING.y1 + 1); road(23, HOUSING.y1 + 1, 24, 21); // ทางหน้าย่านบ้านและทางลงมาต่อถนนหลัก
    for (const x0 of HOUSING.plots) for (let y = HOUSING.y0; y <= HOUSING.y1; y++) for (let x = x0; x < x0 + HOUSING.w; x++) set(x, y, T.FLOOR); // พื้นไม้ของที่ดิน
    // รั้ว + ประตู
    fence(FARM.x0 - 1, FARM.y0 - 1, FARM.x1 + 1, FARM.y1 + 1); set(13, 18, T.PATH); set(14, 18, T.PATH); set(22, 12, T.PATH); set(22, 13, T.PATH); // ประตูสวน: กลางล่าง + กลางขวา
    fence(YARD.x0 - 1, YARD.y0 - 1, YARD.x1 + 1, YARD.y1 + 1); set(46, 11, T.PATH); set(46, 12, T.PATH);
    fence(PASTURE.x0 - 1, PASTURE.y0 - 1, PASTURE.x1 + 1, PASTURE.y1 + 1); set(46, 21, T.PATH); set(46, 22, T.PATH);
    fence(PIGPEN.x0 - 1, PIGPEN.y0 - 1, PIGPEN.x1 + 1, PIGPEN.y1 + 1); set(56, 11, T.PATH); set(56, 12, T.PATH);
    // อาคารและเคาน์เตอร์
    for (const b of BUILDINGS) {
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) set(x, y, T.BUILD);
      for (const [x, y] of b.counter) set(x, y, T.SHOP);
    }
    // ลานหน้าร้าน: ช่องหน้าอาคารที่ไม่ใช่เคาน์เตอร์ปูทางให้ต่อกับถนน ร้านจะได้ไม่ลอยอยู่กลางหญ้า
    for (const b of BUILDINGS) if (b.counter.length) for (let x = b.x0; x <= b.x1; x++) setIfGrass(x, b.y1 + 1, T.PATH);
    for (const c of CABINETS) set(c.x, c.y, T.SHOP); // ตู้เกมเป็นช่องที่เดินผ่านไม่ได้ แต่ใช้งานได้จากช่องติดกัน
    set(ATM.x, ATM.y, T.SHOP); set(BOARD.x, BOARD.y, T.SHOP); set(CHEST.x, CHEST.y, T.SHOP); // กระดานข่าว + ตู้เซฟกองกลาง
    set(FIRE.x, FIRE.y, T.BUILD);                    // กองไฟ (เดินผ่านไม่ได้)
    // ต้นไม้ขอบแมพ + กระจายในที่ว่าง
    for (let x = 0; x < W; x++) { set(x, 0, T.TREE); set(x, H - 1, T.TREE); }
    for (let y = 0; y < H; y++) { set(0, y, T.TREE); set(W - 1, y, T.TREE); }
    const r = rng(11);
    const reserved = [[4, 6, 23, 19], [24, 8, 29, 22], [7, 21, 46, 24], [33, 23, 40, 30], [29, 30, 57, 45], [43, 2, 62, 28], [39, 12, 45, 22], [27, 12, 38, 21], [55, 7, 63, 15], [5, 24, 44, 31], [8, 30, 24, 40], [1, 1, 43, 6], [34, 16, 41, 22]];
    for (let i = 0; i < 330; i++) {
      const x = 1 + Math.floor(r() * (W - 2)), y = 1 + Math.floor(r() * (H - 2));
      if (reserved.some(b => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3])) continue;
      setIfGrass(x, y, T.TREE);
    }
    return m;
  }

  // ต้นไม้: ตัดได้ทุกต้นที่ไม่ใช่แนวต้นไม้ขอบแมพ • ต้นไม้ใหม่จะงอกเฉพาะที่สนามหญ้าเขียวที่ห่างจากสิ่งปลูกสร้าง/ถนน/รั้ว/น้ำ อย่างน้อย 3 ช่อง
  const NO_TREE = [FARM, YARD, PASTURE, PIGPEN, PLAZA, { x0: 13, y0: 30, x1: 20, y1: 38 }, { x0: 2, y0: 1, x1: 42, y1: 6 }].map(z => ({ x0: z.x0 - 2, y0: z.y0 - 2, x1: z.x1 + 2, y1: z.y1 + 2 }));
  const isChoppable = (m, x, y) => !!(m[y] && m[y][x] === T.TREE && x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  function treeSpotOk(m, x, y) {
    if (x < 2 || y < 2 || x > W - 3 || y > H - 3 || m[y][x] !== T.GRASS) return false;
    if (NO_TREE.some(z => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)) return false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const t = m[y + dy][x + dx]; if (t !== T.GRASS && t !== T.TREE) return false; }
    return true;
  }
  function solid(m, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
    const t = m[ty][tx];
    return t === T.WATER || t === T.TREE || t === T.BUILD || t === T.FENCE || t === T.SHOP || t === T.FURN;
  }
  function blockedAt(m, x, y) {
    const r = 8;
    return solid(m, Math.floor((x - r) / TS), Math.floor((y - r) / TS)) ||
           solid(m, Math.floor((x + r) / TS), Math.floor((y - r) / TS)) ||
           solid(m, Math.floor((x - r) / TS), Math.floor((y + r) / TS)) ||
           solid(m, Math.floor((x + r) / TS), Math.floor((y + r) / TS));
  }
  const DIRS = [[0, 1], [0, -1], [-1, 0], [1, 0]]; // ลง, ขึ้น, ซ้าย, ขวา
  function facing(x, y, dir) {
    return [Math.floor(x / TS) + DIRS[dir][0], Math.floor(y / TS) + DIRS[dir][1]];
  }
  function inFarm(tx, ty) { return tx >= FARM.x0 && tx <= FARM.x1 && ty >= FARM.y0 && ty <= FARM.y1; }

  const api = { gaugeCore, gaugeDist, gaugeHit, fishClass, WEAR_RATE, bankInterest, CRAFT, ARC_RANGE, STARTER, STARTER_FINAL, BOOK, BOOK_ENTRY_COIN, bookInfo, WEEKLY, RARE, NPC, BOTBET, DOLE, playLevel, doleCost, dolePackage, ATM, BANK, VILLAGE, QUESTS, QUEST_PER_DAY, TITLES, titleFor, POINTS, BUFFS, FAME, BOARD, CHEST, TOWN, townAt, reviveCost, HOUSING, plotAt, plotSignAt, FURN, TS, W, H, T, FARM, YARD, PASTURE, PIGPEN, SPAWN, START_SPAWN, STARTER_GO, DAY_MS, WATER_MS, CANS, canTier, FISH_GAUGE, gaugePos, gaugeHit, MAX_LV, SKILLS, CROPS, FISH, ANIMALS, RODS, BUILDINGS, SHOPS, DIRS,
    DURABILITY, durMax, repairCost, REPAIR, TOOL_PRICE, toolPrice, canRepair, TRADE, TICKET, MOVIES, cinemaAt, CINEMA_CENTER, isTradable, tradeValue,
    AXES, TREE_HP, WOOD, SICK, SELLBACK, CASINO, PLAZA, FIRE, SEATS, seatAt, sellbackValue, isChoppable, treeSpotOk,
    ANIMAL_GRACE_MS, PLAYER_HUNGER, WEAR, WEAR_CATS, WEAR_DEFAULT, wearKey, PANTS_COLOR, MEALS, FOOD,
    BAIT_PRICE, BAITS, baitWeight, RAKE, MARKET, PMARKET, VARIETY, varietyBonus, COOK, COOK_FEE, COOK_CATS, cookCat, PROJECTS, PROJ_DONATE, sellQuote, GAME_TITLES, CABINETS, BETS, cabinetAt, xpFor, levelOf, itemInfo, shopSells, shopAt, cropStage, rng, makeMap, blockedAt, facing, inFarm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Shared = api;
})(this);
