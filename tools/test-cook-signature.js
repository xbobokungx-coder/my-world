// ทดสอบเมนูเจาะจงวัตถุดิบ (COOK ที่ in.k ระบุปลา/ผัก/ไข่/นมตรงตัว): ของมีจริง ใช้ของชนิดนั้นเท่านั้น ขาดชนิดนั้นแล้วทำไม่ได้ ราคา/เลเวลสมเหตุสมผล: node tools/test-cook-signature.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-cooksig-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;

// เมนูเจาะจง = สูตรที่ทุกวัตถุดิบระบุ k (ไม่มีหมวดกว้าง c) และไม่ใช่เมนูเก่า (feast/fishburger มี k แต่ปนหมวด c)
const SIG = S.COOK.filter(r => r.in.every(x => x.k && !x.c) && r.in.some(x => /^(fish_|crop_|egg$|duck_egg$|milk$)/.test(x.k)));
assert.ok(SIG.length >= 20, `ต้องมีเมนูเจาะจงอย่างน้อย 20 สูตร (ตอนนี้ ${SIG.length})`);

// ---- ข้อมูล: id/ของ/เลเวล/ราคา ----
{
  const ids = new Set();
  for (const r of S.COOK) { assert.ok(/^dish_/.test(r.id), r.id + ' ต้องขึ้นต้น dish_'); assert.ok(!ids.has(r.id), 'id ซ้ำ ' + r.id); ids.add(r.id); }
  const legacyFish = new Set(S.FISH_ALL.filter(f => f.legacy).map(f => 'fish_' + f.id)), legacyCrop = new Set(Object.keys(S.CROPS).filter(c => S.CROPS[c].legacy).map(c => 'crop_' + c));
  const dupFish = new Set(S.FISH_ALL.map(f => f.id).filter((id, i, a) => a.indexOf(id) !== i)); // turtle/seal ซ้ำชื่อ ห้ามอ้างถึง
  const lvs = new Set();
  for (const r of SIG) {
    assert.ok(S.itemInfo(r.id) && S.itemInfo(r.id).sell === r.sell, r.id + ' ต้องขายได้ในราคา sell');
    assert.ok(r.lv >= 1 && r.lv <= S.MAX_LV, r.id + ' เลเวลอยู่ในช่วง'); lvs.add(r.lv);
    let raw = 0;
    for (const x of r.in) {
      const i = S.itemInfo(x.k); assert.ok(i, `${r.id}: ไม่มีของ ${x.k}`); assert.ok(x.n >= 1, `${r.id}: จำนวนต้อง ≥ 1`);
      assert.ok(!legacyFish.has(x.k) && !legacyCrop.has(x.k), `${r.id}: ${x.k} เลิกหาได้แล้ว (legacy) ห้ามใช้เป็นวัตถุดิบ`);
      if (/^fish_/.test(x.k)) { const id = x.k.slice(5); assert.ok(S.FISH_ALL.some(f => f.id === id) && x.k !== 'fish_boot', `${r.id}: ปลา ${x.k} ไม่มีใน FISH_ALL`); assert.ok(!dupFish.has(id), `${r.id}: id ปลา ${id} ซ้ำ ห้ามใช้`); }
      raw += x.n * i.sell;
    }
    assert.ok(r.sell * (1 - S.COOK_FEE) >= raw * 1.15, `${r.id}: ขายหลังค่าเตาต้องเกินมูลค่าวัตถุดิบดิบอย่างน้อย 15% (ไม่งั้นไม่มีใครทำ) sell ${r.sell} raw ${raw}`);
    assert.ok(r.sell <= raw * 2.8, `${r.id}: ราคาขาย ${r.sell} สูงเกิน 2.8 เท่าของวัตถุดิบ ${raw} (เป็นทางปั๊มเงิน)`);
    // เลเวลสูตรต้องไม่ต่ำกว่าเลเวลที่ของนั้นหาได้ (ผักที่ปลูกได้เลเวลชาวนาสูง → สูตรเชฟสูง)
    for (const x of r.in) {
      const cl = /^crop_/.test(x.k) ? S.CROPS[x.k.slice(5)].lv : /^fish_/.test(x.k) ? S.FISH.find(f => f.id === x.k.slice(5)).lv : x.k === 'milk' ? 3 : x.k === 'duck_egg' ? 2 : 1;
      assert.ok(r.lv >= cl - 1, `${r.id}: เลเวลสูตร ${r.lv} ต่ำกว่าเลเวลที่หา ${x.k} ได้ (${cl}) เกิน 1`);
    }
    // ไม่ให้เมนูเจาะจงแซงเมนูเก่าเลเวลสูงกว่ามาก
    const oldAtLv = S.COOK.filter(q => !SIG.includes(q) && q.lv <= r.lv).reduce((a, q) => Math.max(a, q.sell), 0);
    assert.ok(r.sell <= Math.max(oldAtLv, 100) * 1.35, `${r.id}: ราคา ${r.sell} สูงกว่าสูตรเดิมที่เลเวลเท่ากัน (${oldAtLv}) เกิน 35%`);
  }
  assert.ok([1, 3, 5, 8, 12, 16, 19].every(l => [...lvs].some(x => Math.abs(x - l) <= 1)), 'ต้องมีเมนูใหม่กระจายทุกช่วงเลเวล');
  console.log(`  ข้อมูล: ${SIG.length} สูตร ของมีจริง ไม่ใช้ legacy ราคา/เลเวลสมเหตุสมผล`);
}

// ---- พฤติกรรม: ใช้ของชนิดนั้นจริง / ขาดแล้วทำไม่ได้ ----
const mkWs = () => ({ readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } });
const w = new World('cooksig');
let nameSeq = 0; // ชื่อผู้เล่นตัดที่ 12 ตัวอักษรและห้ามซ้ำ ใช้ลำดับแทน
function mk() {
  const ws = mkWs(), p = w.join(ws, 'chef' + (++nameSeq), '#fff').p; p.ws2 = ws;
  p.rec.inv = { coin: 100000 }; p.rec.hunger = 100; p.rec.skills = { farm: 0, fish: 0, animal: 0, wood: 0, cook: 1e9, mine: 0 };
  const [cx, cy] = S.BUILDINGS.find(b => b.kind === 'food').counter[0]; p.x = (cx + 0.5) * TS; p.y = (cy + 0.5) * TS;
  return p;
}
const have = (p, k) => p.rec.inv[k] || 0;
const cook = (p, id) => { p.cookReady = 0; w.handle(p, { t: 'cook', id }); };
{
  const r = SIG.find(x => x.id === 'dish_mackegg'); assert.ok(r, 'ต้องมี ปลาทูทอดไข่ดาว (ปลาทู + ไข่ไก่)');
  assert.deepStrictEqual(r.in, [{ k: 'fish_mackerel', n: 1 }, { k: 'egg', n: 1 }]);
  // ใช้ของชนิดนั้นจริง และไม่แตะปลา/ไข่ชนิดอื่น
  const p = mk(); Object.assign(p.rec.inv, { fish_mackerel: 2, fish_sardine: 5, fish_carp: 5, egg: 3, duck_egg: 4 });
  cook(p, r.id);
  assert.strictEqual(have(p, r.id), 1, 'ทำสำเร็จได้ 1 จาน');
  assert.strictEqual(have(p, 'fish_mackerel'), 1, 'ใช้ปลาทู 1 ตัว'); assert.strictEqual(have(p, 'egg'), 2, 'ใช้ไข่ไก่ 1 ฟอง');
  assert.strictEqual(have(p, 'fish_sardine'), 5, 'ไม่แตะปลาซาร์ดีน'); assert.strictEqual(have(p, 'fish_carp'), 5, 'ไม่แตะปลาตะเพียน'); assert.strictEqual(have(p, 'duck_egg'), 4, 'ไม่แตะไข่เป็ด');
  // ขาดชนิดนั้นแล้วทำไม่ได้ แม้มีปลาอื่น/ไข่ชนิดอื่นเยอะ
  const q = mk(); Object.assign(q.rec.inv, { fish_sardine: 9, fish_carp: 9, fish_seabass: 9, egg: 9, duck_egg: 9, milk: 9 });
  const c0 = have(q, 'coin'); cook(q, r.id);
  assert.strictEqual(have(q, r.id), 0, 'ไม่มีปลาทูทำไม่ได้แม้มีปลาอื่นเต็มกระเป๋า'); assert.strictEqual(have(q, 'coin'), c0, 'ทำไม่ได้ไม่เสียค่าเตา'); assert.strictEqual(have(q, 'egg'), 9, 'ของไม่ถูกหัก');
  // มีปลาทูแต่ขาดไข่ไก่ (มีแต่ไข่เป็ด) ก็ทำไม่ได้
  const t = mk(); Object.assign(t.rec.inv, { fish_mackerel: 3, duck_egg: 5 }); cook(t, r.id);
  assert.strictEqual(have(t, r.id), 0, 'มีแต่ไข่เป็ดแทนไข่ไก่ไม่ได้'); assert.strictEqual(have(t, 'fish_mackerel'), 3);
  // เลเวลไม่ถึงทำไม่ได้
  const u = mk(); u.rec.skills.cook = 0; Object.assign(u.rec.inv, { fish_mackerel: 1, egg: 1 }); cook(u, r.id);
  assert.strictEqual(have(u, r.id), 0, 'เชฟเลเวลต่ำกว่าสูตรทำไม่ได้'); assert.strictEqual(have(u, 'fish_mackerel'), 1);
  console.log('  พฤติกรรม: ปลาทู+ไข่ไก่ ใช้ของชนิดนั้น ไม่กินของอื่น ขาดแล้วทำไม่ได้ เลเวลไม่ถึงทำไม่ได้');
}
{
  // ทุกสูตรเจาะจง: ใส่ครบพอดี → ทำได้และหักตรงตาม in เท่านั้น • ขาดทีละชนิด (ใส่ของอื่นแทน) → ทำไม่ได้
  for (const r of SIG) {
    const p = mk(), filler = { fish_carp: 9, fish_sardine: 9, crop_carrot: 9, egg: 9, duck_egg: 9, milk: 9, fish_seabass: 9, crop_cabbage: 9 };
    for (const x of r.in) delete filler[x.k];
    Object.assign(p.rec.inv, filler); for (const x of r.in) p.rec.inv[x.k] = x.n;
    const before = { ...p.rec.inv }; cook(p, r.id);
    assert.strictEqual(have(p, r.id), 1, r.id + ' ใส่ครบต้องทำได้');
    for (const x of r.in) assert.strictEqual(have(p, x.k), before[x.k] - x.n, `${r.id}: หัก ${x.k} ตามสูตร`);
    for (const k of Object.keys(filler)) assert.strictEqual(have(p, k), 9, `${r.id}: ไม่แตะ ${k}`);
    for (const x of r.in) { // ขาดวัตถุดิบนี้ทีละชนิด
      const q = mk(); Object.assign(q.rec.inv, filler); for (const y of r.in) if (y.k !== x.k) q.rec.inv[y.k] = y.n;
      cook(q, r.id); assert.strictEqual(have(q, r.id), 0, `${r.id}: ขาด ${x.k} ต้องทำไม่ได้`);
    }
  }
  console.log(`  ทุกสูตร (${SIG.length}): ใส่ครบทำได้/หักตรง/ขาดทีละชนิดทำไม่ได้`);
}
console.log('test-cook-signature: ผ่านทั้งหมด'); process.exit(0);
