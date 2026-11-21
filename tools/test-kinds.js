// ทดสอบหมวดของชุดเดียว (S.kindOf / S.KINDS) และกลุ่มอาชีพ (S.jobOf เท่ากับ fleaGrpOf เดิมใน public/game.js ทุก key)
// รัน: node tools/test-kinds.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const S = require('../public/shared.js');
const ids = new Set(S.KINDS.map(k => k.id));
assert.strictEqual(S.KINDS.length, 9, '9 หมวด'); assert.strictEqual(ids.size, 9);
for (const k of S.KINDS) assert.ok(k.emoji && k.name, 'หมวดต้องมี emoji+ชื่อ: ' + k.id);
// รายการ key ทั้งหมดที่ต้องมีหมวด: ขายได้ + ของร้านทุกชิ้น (buy/sell ที่เป็น key เต็ม) + เฟอร์นิเจอร์/ของที่เก็บในกระเป๋า
const keys = new Set(S.SELLABLE || []);
for (const sh of Object.values(S.SHOPS)) for (const k of sh.buy) keys.add(k);
for (const f of Object.keys(S.FURN)) keys.add('furn_' + f);
for (const k of ['coin', 'plank', 'recall', 'lamp', 'bait', 'bait_2', 'medicine', 'petfood', 'shoot', 'boat', 'feed', 'hay', 'slop', 'nectar', 'egg', 'milk', 'wool', 'honey']) keys.add(k);
let n = 0;
for (const k of keys) {
  if (k === 'coin') continue; const i = S.itemInfo(k); if (!i) continue; n++;
  const v = S.kindOf(k); assert.ok(ids.has(v), `kindOf(${k}) ต้องอยู่ใน KINDS ได้ ${v}`);
}
assert.ok(n > 150, 'ต้องตรวจของจริงหลายชิ้น ' + n);
// ผลที่คาดของตัวอย่าง
const exp = { crop_carrot: 'fresh', fish_carp: 'fresh', egg: 'fresh', milk: 'fresh', shoot: 'fresh', dish_bread: 'food', meal_bread: 'food', plank: 'material', bar_copper: 'material', wool: 'material', honey: 'material', seed_carrot: 'farm', feed: 'farm', medicine: 'farm', bait: 'supply', recall: 'supply', pick_1: 'tool', lamp: 'tool', boat: 'tool', furn_chair: 'furn', wear_hat_cap: 'wear', pet_dog: 'other', nothing: 'other' };
for (const [k, v] of Object.entries(exp)) { if (!S.itemInfo(k) && v !== 'other') continue; assert.strictEqual(S.kindOf(k), v, 'kindOf ' + k); }
assert.strictEqual(S.kindOf(undefined), 'other'); assert.strictEqual(S.kindOf(null), 'other'); assert.strictEqual(S.kindOf({}), 'other'); assert.strictEqual(S.kindOf('__proto__'), 'other');
// jobOf เท่ากับตารางเดิม: เทียบกับสำเนาตรงตัวของ fleaGrpOf เดิม (ก่อน 21 พ.ย. 2026 ที่ย้ายไป shared) เพราะ game.js เรียก Shared.jobOf แล้ว
const OLD_FLEA_SRC = `function fleaGrpOf(k) {
  const i = itemInfo(k), c = i && i.cat;
  if (c === 'crop' || c === 'seed') return 'farm';
  if (c === 'animal' || c === 'feed') return 'animal';
  if (c === 'fish' || (i && i.bait)) return 'fish';
  if (c === 'wood' || /^furn_/.test(k)) return 'wood';
  if (c === 'ore') return 'ore';
  if (c === 'food') return 'chef';
  return 'other';
}`;
const old = new Function('itemInfo', OLD_FLEA_SRC + '; return fleaGrpOf;')(S.itemInfo);
// game.js ต้องใช้ Shared.jobOf (ไม่มีตารางซ้ำ)
const gsrc = fs.readFileSync(path.join(__dirname, '../public/game.js'), 'utf8'); assert.ok(/Shared\.jobOf/.test(gsrc), 'game.js ต้องเรียก Shared.jobOf');
let c = 0; for (const k of keys) { assert.strictEqual(S.jobOf(k), old(k), 'jobOf ต้องเท่า fleaGrpOf: ' + k); c++; }
for (const k of ['nothing', 'furn_chair', 'bait_3', 'seed_carrot', 'bar_gold']) assert.strictEqual(S.jobOf(k), old(k), k);
console.log('test-kinds OK', n, 'keys,', c, 'jobOf');
