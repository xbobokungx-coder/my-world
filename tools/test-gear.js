// ทดสอบอุปกรณ์ 10 ระดับของชาวนา/คนเลี้ยงสัตว์/เชฟ (WP-23: จอบ hoe • ตะกร้า-ถัง pail • กระทะ pan • บัวรดน้ำ can) ฝั่งตาราง/ฟังก์ชันล้วน
// รัน: node tools/test-gear.js • ส่วนที่เล่นผ่าน World อยู่ test-gear-play.js • เรคอร์ดเก่าอยู่ test-gear-compat.js
const assert = require('assert'), fs = require('fs'), path = require('path');
const S = require('../public/shared.js');
const G = S.GEAR_TUNE, MAX = S.GEAR_MAX, TOOLS = ['hoe', 'pail', 'pan'], TBL = { hoe: S.HOES, pail: S.PAILS, pan: S.PANS };
const EMO = { hoe: S.HOE_EMOJI, pail: S.PAIL_EMOJI, pan: S.PAN_EMOJI };
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} ≠ ${b}`);
const R = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// ---- (ก) ตาราง ----
{
  assert.strictEqual(MAX, 10);
  for (const tool of TOOLS) {
    const T = TBL[tool], D = S.DURABILITY[tool], P = S.TOOL_PRICE[tool];
    assert.deepStrictEqual(Object.keys(T).map(Number), R(1, MAX), tool + ' ต้องมี 10 ระดับ');
    assert.strictEqual(new Set(R(1, MAX).map(t => T[t].name)).size, MAX, tool + ' ชื่อไม่ซ้ำ');
    assert.ok(D && D.max.length === MAX + 1 && D.fix.length === MAX + 1 && P.length === MAX + 1, tool + ' DURABILITY/TOOL_PRICE 11 ช่อง (ช่อง 0 ว่าง)');
    assert.strictEqual(D.max[0], 0); assert.strictEqual(P[0], 0);
    for (let t = 1; t <= MAX; t++) {
      assert.ok(Number.isInteger(D.max[t]) && D.max[t] > 0, `${tool}_${t} ความทน > 0`); assert.ok(Number.isInteger(D.fix[t]) && D.fix[t] > 0, `${tool}_${t} ค่าซ่อมแสดงผล > 0`);
      assert.ok(P[t] > 0, `${tool}_${t} ราคา > 0`); assert.strictEqual(T[t].price, P[t], `${tool}_${t} ราคาในตาราง = TOOL_PRICE`);
      assert.strictEqual(T[t].power, t);
      if (t >= 2) { assert.strictEqual(T[t].lv, 2 * t - 1, `${tool}_${t} ปลดที่เลเวล 2t−1`); assert.ok(P[t] > P[t - 1], `${tool}_${t} ราคาเพิ่มตามระดับ`); } else assert.strictEqual(T[t].lv, undefined, tool + ' ระดับ 1 ฟรี ไม่มีเลเวลปลด');
    }
    assert.ok(['farm', 'animal', 'food'].includes(D.shop) && S.SHOPS[D.shop], tool + ' ร้านที่ซ่อม/ซื้อมีจริง');
  }
  assert.strictEqual(S.DURABILITY.hoe.shop, 'farm'); assert.strictEqual(S.DURABILITY.pail.shop, 'animal'); assert.strictEqual(S.DURABILITY.pan.shop, 'food');
  assert.strictEqual(S.DURABILITY.hoe.max[1], 120, 'ล็อก: จอบระดับ 1 ทนสูงสุด 120 เท่าเดิม (ค่า dur.hoe ในเซฟเก่าใช้ต่อได้)');
  // ไม่มีเครื่องมืออื่นหลุดหาย
  for (const t of ['rod', 'axe', 'pick']) assert.ok(S.DURABILITY[t], t + ' ยังอยู่');
  // ตารางเดิมเป๊ะของ "ล็อก"
  assert.strictEqual(S.COOK_FEE, 0.3, 'ค่าเตาพื้น 0.3 (ผู้เล่นไม่มี/พังกระทะต้องได้ค่านี้)'); assert.strictEqual(S.ANIMAL_BONUS, 0.25, 'โอกาสผลผลิตสัตว์พื้น 0.25');
}

// ---- (ข) GEAR_TUNE: อุปกรณ์ต่ำกว่า 1 ระดับไม่มีผล • สูงกว่าไม่ได้เพิ่ม (กำไรไม่ลดเมื่ออัป และไม่มีใครเสียพื้น) ----
{
  for (const tool of TOOLS) {
    assert.strictEqual(G[tool].under, 1, tool + ' under = 1 (ต่ำกว่า 1 ระดับ = ไม่มีผล)');
    assert.strictEqual(G[tool].over.bonus, 0, tool + ' over.bonus = 0'); assert.strictEqual(G[tool].over.wear, 0, tool + ' over.wear = 0');
    assert.ok(G[tool].base > 0 && G[tool].base < 1, tool + ' base อยู่ใน (0,1)'); assert.strictEqual(G[tool].over.cap, G[tool].base, tool + ' เพดานเท่าพื้นโบนัส (over=0)');
  }
  assert.ok(G.pail.max > S.ANIMAL_BONUS && G.pail.max <= 1, 'pail.max ต้องมากกว่าพื้นและไม่เกิน 1'); assert.ok(G.pan.minFee > 0 && G.pan.minFee < S.COOK_FEE, 'pan.minFee ต้องต่ำกว่าค่าเตา');
  assert.ok(S.ANIMAL_BONUS + G.pail.base <= G.pail.max, 'พื้นรวมโบนัสถังไม่เกิน max (ไม่ถูกตัด)'); assert.ok(S.COOK_FEE - G.pan.base >= G.pan.minFee, 'ค่าเตาหลังลดไม่ต่ำกว่า minFee (ไม่ถูกตัด)');
}

// ---- (ค) gearHit: ครบทุกคู่ (tool × tier × itemTier) ----
{
  for (const tool of TOOLS) {
    for (let it = 1; it <= MAX; it++) {
      let prev = null;
      for (let t = 1; t <= MAX; t++) {
        const h = S.gearHit(tool, t, it), d = t - it;
        assert.strictEqual(h.d, d); assert.ok(h.bonus >= 0 && h.wear >= 0 && Number.isFinite(h.bonus) && Number.isFinite(h.wear), `${tool} t${t} i${it} ค่าต้องเป็นเลขไม่ติดลบ`);
        if (d < 0) { assert.strictEqual(h.bonus, 0, `${tool} t${t} item${it}: ต่ำกว่า ${-d} ระดับ ต้องไม่มีผล`); assert.strictEqual(h.wear, 0, `${tool} t${t} item${it}: ไม่มีผลต้องไม่สึก`); }
        else { near(h.bonus, G[tool].base, `${tool} t${t} i${it} โบนัสตรง/เกินระดับ = base`); assert.strictEqual(h.wear, 1, `${tool} t${t} i${it} สึกต่อครั้ง = 1`); }
        assert.ok(h.bonus <= G[tool].base + 1e-12, 'ไม่เกินพื้นโบนัส');
        if (prev) { assert.ok(h.bonus >= prev.bonus - 1e-12, `${tool} อัประดับแล้วโบนัสต้องไม่ลด (t${t} i${it})`); if (d > 0) assert.ok(h.wear <= prev.wear + 1e-12, `${tool} อัประดับแล้วสึกต่อครั้งต้องไม่เพิ่ม`); }
        prev = h;
      }
    }
    // ไม่ใส่ค่า = ระดับ 1 • เศษทศนิยมปัดลง
    assert.deepStrictEqual(S.gearHit(tool), S.gearHit(tool, 1, 1)); assert.deepStrictEqual(S.gearHit(tool, undefined, 3), S.gearHit(tool, 1, 3)); assert.deepStrictEqual(S.gearHit(tool, 3.9, 3.2), S.gearHit(tool, 3, 3));
    // ระดับเดียวกัน = ได้เต็ม • ต่ำ 1 ระดับขึ้นไปไม่ได้เลย (ต่ำเป็น 4 ระดับก็ไม่ติดลบ)
    assert.ok(S.gearHit(tool, 5, 5).bonus > 0); for (const d of [1, 2, 3, 4, 9]) assert.strictEqual(S.gearHit(tool, 10 - d, 10).bonus, 0);
  }
}

// ---- (ง) ระดับไอเทม + ตัวห่อ hoe/pail/pan ----
{
  assert.ok(Object.values(S.CROPS).every(c => S.cropTier(c) === Math.ceil(c.lv / 2) && S.cropTier(c) >= 1 && S.cropTier(c) <= MAX), 'cropTier = ⌈lv/2⌉ ในช่วง 1..10');
  assert.ok(Object.values(S.ANIMALS).every(A => S.animalTier(A) === Math.ceil(A.lv / 2) && S.animalTier(A) <= MAX)); assert.ok(S.COOK.every(r => S.cookTier(r) === Math.ceil(r.lv / 2) && S.cookTier(r) <= MAX), 'cookTier ในช่วง 1..10');
  for (const f of [S.cropTier, S.animalTier, S.cookTier]) { assert.strictEqual(f(null), 1); assert.strictEqual(f({}), 1); }
  // hoeTier/pailTier/panTier: ไม่มีคีย์ = 1 • เลือกคีย์สูงสุด • คีย์ 0/ผิดรูป ไม่นับ
  for (const [fn, key] of [[S.hoeTier, 'hoe'], [S.pailTier, 'pail'], [S.panTier, 'pan'], [S.canTier, 'can']]) {
    assert.strictEqual(fn({}), 1); assert.strictEqual(fn(null), 1); assert.strictEqual(fn(undefined), 1); assert.strictEqual(fn({ coin: 9 }), 1);
    for (let t = 2; t <= MAX; t++) { assert.strictEqual(fn({ [key + '_' + t]: 1 }), t, `${key}_${t}`); assert.strictEqual(fn({ [key + '_' + t]: 1, [key + '_2']: 1 }), t, 'ถือหลายชิ้นใช้ระดับสูงสุด'); }
    assert.strictEqual(fn({ [key + '_5']: 0 }), 1, 'คีย์ 0 ไม่นับว่าถือ'); assert.strictEqual(fn({ [key + '_11']: 1 }), 1, 'ระดับเกิน 10 ไม่นับ');
  }
  // hoeBonus
  const crops = Object.values(S.CROPS);
  for (const c of crops) {
    let prev = -1;
    for (let t = 1; t <= MAX; t++) { const b = S.hoeBonus(t === 1 ? {} : { ['hoe_' + t]: 1 }, c); assert.strictEqual(b, S.hoeHit(t === 1 ? {} : { ['hoe_' + t]: 1 }, c).bonus); assert.ok(b >= prev - 1e-12, 'อัปจอบแล้วโอกาสไม่ลด ' + c.name); prev = b; }
    // ผู้เล่นไม่มีจอบ (ระดับ 1 ฟรี): ได้พื้นเมื่อพืชระดับ 1 ไม่งั้น 0 (ไม่ติดลบ)
    assert.strictEqual(S.hoeBonus({}, c), S.cropTier(c) === 1 ? G.hoe.base : 0, 'จอบฟรี ' + c.name);
    // จอบตรงระดับพืชได้เต็ม • ต่ำกว่า 1 ระดับไม่ได้
    const tc = S.cropTier(c); if (tc >= 2) { near(S.hoeBonus({ ['hoe_' + tc]: 1 }, c), G.hoe.base, 'จอบตรงระดับ ' + c.name); assert.strictEqual(S.hoeBonus(tc >= 3 ? { ['hoe_' + (tc - 1)]: 1 } : {}, c), 0); }
  }
  // pailChance: พื้น ≥ ANIMAL_BONUS เสมอ (ไม่มี/พังไม่ได้แย่กว่าเดิม) • ไม่เกิน max • ไม่ลดเมื่ออัป
  for (const A of Object.values(S.ANIMALS)) {
    let prev = 0;
    for (let t = 1; t <= MAX; t++) { const inv = t === 1 ? {} : { ['pail_' + t]: 1 }, c = S.pailChance(inv, A); assert.ok(c >= S.ANIMAL_BONUS - 1e-12 && c <= G.pail.max + 1e-12, `pail t${t} ${A.name} ช่วง`); assert.ok(c >= prev - 1e-12); prev = c; }
    const at = S.animalTier(A);
    assert.strictEqual(S.pailChance({ ['pail_' + Math.max(2, at)]: 1 }, A), Math.min(G.pail.max, S.ANIMAL_BONUS + G.pail.base), 'ถังตรงระดับสัตว์ ' + A.name);
    if (at >= 2) assert.strictEqual(S.pailChance({}, A), S.ANIMAL_BONUS, 'ตะกร้าฟรีกับสัตว์ระดับสูง = พื้น 0.25 เท่าเดิม ' + A.name);
    assert.strictEqual(S.pailChance({}, A) >= S.ANIMAL_BONUS, true);
  }
  assert.strictEqual(S.pailChance({}, S.ANIMALS.chicken), S.ANIMAL_BONUS + G.pail.base, 'ไก่ (ระดับ 1) + ตะกร้าฟรี = พื้น + base');
  // panFee: ok=false (พัง) = ค่าเตาเดิม 0.3 • ok จริง: minFee ≤ fee ≤ 0.3 ไม่เพิ่มเมื่ออัป
  for (const r of S.COOK) {
    for (let t = 1; t <= MAX; t++) assert.strictEqual(S.panFee(r, t, false), S.COOK_FEE, `${r.id} กระทะพัง ต้องเป็น 0.3`);
    let prev = Infinity;
    for (let t = 1; t <= MAX; t++) { const f = S.panFee(r, t, true); assert.ok(f >= G.pan.minFee - 1e-12 && f <= S.COOK_FEE + 1e-12, `${r.id} t${t} ค่าเตาในช่วง`); assert.ok(f <= prev + 1e-12, `${r.id} อัปกระทะแล้วค่าเตาต้องไม่เพิ่ม`); prev = f; }
    near(S.panFee(r, S.cookTier(r), true), Math.max(G.pan.minFee, S.COOK_FEE - G.pan.base), r.id + ' กระทะตรงระดับ');
    if (S.cookTier(r) >= 2) assert.strictEqual(S.panFee(r, S.cookTier(r) - 1, true), S.COOK_FEE, r.id + ' กระทะต่ำกว่า 1 ระดับ = ไม่ลด');
    assert.strictEqual(S.panFee(r, 1, undefined), S.panFee(r, 1, true), 'ok ไม่ระบุ = ถือว่าใช้ได้ (มีแต่ false ที่ให้ค่าเดิม)');
  }
  assert.strictEqual(S.panFee(S.COOK[0], 10, true) >= G.pan.minFee, true);
}

// ---- (จ) บัวรดน้ำ: can_2/can_3 ความหมายเดิม ----
{
  assert.deepStrictEqual(Object.keys(S.CANS).map(Number), R(1, MAX));
  const OLD = { 1: [10, 90000], 2: [20, 120000], 3: [50, 180000] }, OLD_LV = { 2: 3, 3: 6 };
  for (const t of [1, 2, 3]) { assert.ok(S.CANS[t].cap >= OLD[t][0], `บัว ${t} จุไม่ต่ำกว่าเดิม`); assert.ok(S.CANS[t].wet >= OLD[t][1], `บัว ${t} ดินเปียกไม่ต่ำกว่าเดิม`); }
  assert.strictEqual(S.CANS[1].cap, 10); assert.strictEqual(S.CANS[1].wet, 90000); assert.strictEqual(S.CANS[2].cap, 20); assert.strictEqual(S.CANS[2].wet, 120000); assert.strictEqual(S.CANS[3].cap, 50); assert.strictEqual(S.CANS[3].wet, 180000, 'ล็อก: บัว 1–3 ตัวเลขเท่าเดิม');
  for (const t of [2, 3]) assert.ok(S.CANS[t].lv <= OLD_LV[t], `บัว ${t} เลเวลปลดไม่สูงกว่าเดิม (${OLD_LV[t]})`);
  assert.ok(S.CANS[2].price <= 180 && S.CANS[3].price <= 600, 'ราคาบัว 2/3 ไม่แพงกว่าเดิม');
  assert.strictEqual(S.CANS[1].price, undefined, 'บัว 1 ฟรี ไม่ขาย');
  for (let t = 2; t <= MAX; t++) { assert.ok(S.CANS[t].cap > S.CANS[t - 1].cap, `บัว ${t} จุมากขึ้น`); assert.ok(S.CANS[t].price > (S.CANS[t - 1].price || 0), `บัว ${t} แพงขึ้น`); assert.ok(S.CANS[t].lv >= (S.CANS[t - 1].lv || 0)); assert.ok(S.CANS[t].wet >= S.CANS[t - 1].wet, 'ดินเปียกไม่ลดเมื่ออัป'); if (t >= 4) assert.strictEqual(S.CANS[t].wet, 180000, `บัว ${t} เปียกคงที่ 180 วิ (ตั๋ว ข้อ 3: ไม่ทำ levelsim เพี้ยน)`); }
  // can_2 / can_3 ความหมายเดิม
  assert.strictEqual(S.canTier({ can_2: 1 }), 2); assert.strictEqual(S.canTier({ can_3: 1 }), 3); assert.strictEqual(S.canTier({ can_2: 1, can_3: 1 }), 3); assert.strictEqual(S.canTier({}), 1);
  // cropCan: เกณฑ์เดิม พืช Lv ≤5 → 1, Lv6–7 → 2, Lv8+ → 3 และไม่ขยายเกิน 3
  for (const c of Object.values(S.CROPS)) {
    assert.strictEqual(S.cropCan(c), c.lv >= 8 ? 3 : c.lv >= 6 ? 2 : 1, `cropCan ${c.name} Lv${c.lv}`); assert.ok(S.cropCan(c) <= 3, 'ไม่ขยายด่านไประดับ 4–10');
    for (let t = 3; t <= MAX; t++) assert.ok(S.canTier({ ['can_' + t]: 1 }) >= S.cropCan(c), `บัว ${t} ปลูก ${c.name} ได้เสมอ`);
    assert.ok(S.CANS[S.cropCan(c)].price === undefined || S.CANS[S.cropCan(c)].lv <= 6, 'บัวที่พืชต้องใช้ซื้อได้ภายใน Lv6 (เท่าเดิม)');
  }
  assert.strictEqual(S.cropCan({ lv: 5 }), 1); assert.strictEqual(S.cropCan({ lv: 6 }), 2); assert.strictEqual(S.cropCan({ lv: 7 }), 2); assert.strictEqual(S.cropCan({ lv: 8 }), 3); assert.strictEqual(S.cropCan({ lv: 20 }), 3);
}

// ---- (ฉ) itemInfo ----
{
  assert.strictEqual(S.itemInfo('hoe_1'), null, 'ระดับ 1 ไม่ขาย ไม่มี itemInfo'); assert.strictEqual(S.itemInfo('pail_1'), null); assert.strictEqual(S.itemInfo('pan_1'), null);
  for (const k of ['hoe_0', 'hoe_11', 'pail_11', 'pan_11', 'hoe_', 'hoe_x', 'pail_-1', 'pan_2x', 'hoe_02']) { const i = S.itemInfo(k); assert.ok(i === null || i === undefined, k + ' ต้องไม่มี itemInfo'); }
  const SKILL = { hoe: 'farm', pail: 'animal', pan: 'cook' };
  for (const tool of TOOLS) for (let t = 2; t <= MAX; t++) {
    const i = S.itemInfo(`${tool}_${t}`); assert.ok(i, `${tool}_${t} มี itemInfo`);
    assert.strictEqual(i.name, TBL[tool][t].name); assert.strictEqual(i.emoji, EMO[tool][t]); assert.strictEqual(i.buy, TBL[tool][t].price); assert.strictEqual(i.lv, 2 * t - 1); assert.strictEqual(i.skill, SKILL[tool]);
    assert.strictEqual(i.once, true, 'ซื้อได้ชิ้นเดียว'); assert.strictEqual(i.cat, 'gear'); assert.strictEqual(i[tool], t); assert.strictEqual(i.sell, undefined, 'ขายให้ร้านปกติไม่ได้ (ขายคืนผ่าน sellback)');
  }
  for (let t = 2; t <= MAX; t++) { const i = S.itemInfo('can_' + t); assert.ok(i && i.can === t && i.once && i.buy === S.CANS[t].price && i.emoji === S.CANS[t].emoji && i.skill === 'farm' && i.lv === S.CANS[t].lv, 'can_' + t); }
  // ร้าน
  const sk = k => S.SHOPS[k].buy;
  for (let t = 2; t <= MAX; t++) { assert.ok(sk('farm').includes('hoe_' + t) && sk('farm').includes('can_' + t), 'ร้านเมล็ดขาย hoe/can ' + t); assert.ok(sk('animal').includes('pail_' + t), 'ร้านปศุสัตว์ขายถัง ' + t); assert.ok(sk('food').includes('pan_' + t), 'ร้านอาหารขายกระทะ ' + t); }
  for (const [shop, key] of [['farm', 'hoe_1'], ['farm', 'can_1'], ['animal', 'pail_1'], ['food', 'pan_1']]) assert.ok(!sk(shop).includes(key), `${shop} ไม่ขาย ${key}`);
  assert.ok(!sk('farm').some(k => /^(pail|pan)_/.test(k)) && !sk('animal').some(k => /^(hoe|can|pan)_/.test(k)) && !sk('food').some(k => /^(hoe|can|pail)_/.test(k)), 'ไม่ขายผิดร้าน');
  for (const shop of ['farm', 'animal', 'food']) for (const k of sk(shop)) { const i = S.itemInfo(k); assert.ok(i && (i.buy > 0 || i.animal || true), `${shop}:${k} ต้องมี itemInfo`); }
  // ขายคืน (sellbackValue ล้วน)
  assert.strictEqual(S.SELLBACK, 0.7); assert.strictEqual(S.SELLBACK_MIN_FRAC, 0.1);
  for (const tool of TOOLS) for (let t = 2; t <= MAX; t++) {
    const k = `${tool}_${t}`, p = TBL[tool][t].price;
    assert.strictEqual(S.sellbackValue(k), Math.floor(p * 0.7), k + ' เต็ม 70%'); assert.strictEqual(S.sellbackValue(k, 1), Math.floor(p * 0.7)); assert.strictEqual(S.sellbackValue(k, 0.5), Math.floor(p * 0.7 * 0.5)); assert.strictEqual(S.sellbackValue(k, 0), Math.floor(p * 0.7 * 0.1), k + ' พัง = 10% ของ 70%');
    assert.strictEqual(S.sellbackValue(k, -3), S.sellbackValue(k, 0)); assert.strictEqual(S.sellbackValue(k, 7), S.sellbackValue(k, 1), 'frac เกิน 1 ตัดเหลือ 1'); assert.strictEqual(S.sellbackValue(k, NaN), S.sellbackValue(k)); assert.strictEqual(S.sellbackValue(k, 'x'), S.sellbackValue(k));
    assert.ok(S.sellbackValue(k, 1) < p, 'ขายคืนแล้วได้น้อยกว่าราคาซื้อเสมอ'); assert.ok(S.sellbackValue(k, 0.3) <= S.sellbackValue(k, 0.6) && S.sellbackValue(k, 0.6) <= S.sellbackValue(k, 1));
  }
  assert.strictEqual(S.sellbackValue('hoe_1'), 0); assert.strictEqual(S.sellbackValue('seed_carrot'), 0, 'ของที่ไม่ใช่ once ขายคืนไม่ได้'); assert.strictEqual(S.sellbackValue('nope'), 0);
}

// ---- (ช) อีโมจิ 36 ตัว ----
{
  const mine = []; // จอบ 2–10 (ระดับ 1 คง ⛏ เดิม) • บัว 4–10 • ตะกร้า/ถัง 1–10 • กระทะ 1–10
  for (let t = 2; t <= MAX; t++) mine.push(['hoe_' + t, S.HOE_EMOJI[t]]); for (let t = 4; t <= MAX; t++) mine.push(['can_' + t, S.CANS[t].emoji]);
  for (let t = 1; t <= MAX; t++) mine.push(['pail_' + t, S.PAIL_EMOJI[t]], ['pan_' + t, S.PAN_EMOJI[t]]);
  assert.strictEqual(mine.length, 36, 'อีโมจิใหม่ 36 ตัว');
  const held = /^\p{Extended_Pictographic}️?$/u; // ต้องตรง regex 'held' ใน server.js (case 'held')
  const srv = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'); assert.ok(srv.includes('/^\\p{Extended_Pictographic}\\uFE0F?$/u.test(e)'), 'regex held ใน server.js เปลี่ยน ต้องปรับเทสต์นี้ตาม');
  const seen = new Map();
  for (const [k, e] of mine) {
    assert.ok(typeof e === 'string' && held.test(e), `${k} ${JSON.stringify(e)} ต้องเป็นอีโมจิเดี่ยว ผ่าน regex held`); assert.strictEqual([...e].filter(c => c !== '️').length, 1, k + ' ต้องเป็นตัวเดียว ไม่ใช่ลำดับ ZWJ');
    assert.ok(!seen.has(e), `${k} อีโมจิ ${e} ซ้ำกับ ${seen.get(e)}`); seen.set(e, k);
  }
  assert.strictEqual(S.HOE_EMOJI[1], '⛏', 'จอบระดับ 1 คง ⛏'); assert.ok(held.test('⛏') && held.test(S.HOE_EMOJI[1]));
  // ไม่ซ้ำอีโมจิอื่นในเกม: เก็บอีโมจิทุกค่าใน exports (ฟิลด์ emoji และตาราง *_EMOJI) แล้วเทียบ (ยกเว้นของเราเอง)
  const own = new Set(mine.map(m => m[0])), ownE = new Set(mine.map(m => m[1])), others = new Map(), visit = (o, where, depth) => {
    if (!o || typeof o !== 'object' || depth > 5) return;
    for (const [k, v] of Object.entries(o)) {
      if ((k === 'emoji' || /EMOJI$/.test(where.split('.')[0])) && typeof v === 'string') { if (!ownE.has(v) || !(where.startsWith('CANS.') || /^(HOE|PAIL|PAN)_EMOJI/.test(where))) (others.get(v) || others.set(v, []).get(v)).push(where + '.' + k); }
      else if (v && typeof v === 'object') visit(v, where ? where + '.' + k : k, depth + 1);
      else if (typeof v === 'string' && /EMOJI$/.test(where.split('.')[0]) && !where.includes('.')) (others.get(v) || others.set(v, []).get(v)).push(where + '.' + k);
    }
  };
  for (const [name, val] of Object.entries(S)) if (val && typeof val === 'object') visit(val, name, 0);
  for (const e of ownE) assert.ok(!others.has(e), `อีโมจิ ${e} ของอุปกรณ์ใหม่ไปซ้ำกับของอื่นในเกม: ${(others.get(e) || []).join(', ')}`);
  // ไอเทมจริงทุกชิ้นที่ร้านขาย/รับซื้อ: อีโมจิของอุปกรณ์ใหม่ต้องไม่ถูกใช้ซ้ำ (เทียบผ่าน itemInfo จริง)
  const keys = new Set(); for (const sh of Object.values(S.SHOPS)) for (const k of [...(sh.buy || []), ...(sh.sell || [])]) keys.add(k);
  for (const k of keys) { if (own.has(k)) continue; const i = S.itemInfo(k); if (i && i.emoji) assert.ok(!ownE.has(i.emoji), `${k} ใช้อีโมจิ ${i.emoji} ซ้ำกับอุปกรณ์ใหม่`); }
  // ไม่ซ้ำกับสัญลักษณ์ในซอร์สของเกม (นอก shared.js): ฝั่งเว็บ/เซิร์ฟเวอร์ไม่ควรใช้อีโมจิเหล่านี้เป็นอย่างอื่น
  const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sh = src('public/shared.js');
  for (const [k, e] of mine) assert.strictEqual(sh.split(e).length - 1, 1, `${k} ${e} ต้องปรากฏใน shared.js ครั้งเดียว (ที่นิยาม)`);
  for (const f of ['server.js', ...fs.readdirSync(path.join(__dirname, '..', 'public')).filter(n => /\.js$/.test(n) && n !== 'shared.js').map(n => 'public/' + n)]) { const s = src(f); for (const [k, e] of mine) assert.ok(!s.includes(e), `${f} มีอีโมจิ ${e} ของ ${k} อยู่ (อาจซ้ำกับของอื่น)`); }
}

console.log('PASS test-gear');
