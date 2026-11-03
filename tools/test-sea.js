// ทดสอบออกทะเล (เรือที่ท่าเกาะลึกลับ → ฉากทะเล ตกปลาทะเลลึก): node tools/test-sea.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-sea-'));
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;

// ชุดปลา: สระไม่มีปลา sea-only • ทะเลมี sea-only + ชนิดทะเล
assert.ok(S.fishPool(false).every(f => !f.sea), 'สระต้องไม่มีปลาทะเลลึก');
assert.ok(S.fishPool(true).every(f => f.sea || S.MARINE.has(f.id)) && S.fishPool(true).some(f => f.sea), 'ทะเล = sea-only + ชนิดทะเล');
assert.ok(!S.fishPool(true).some(f => f.id === 'boot' || f.id === 'carp'), 'ทะเลไม่มีรองเท้า/ปลาน้ำจืด');
for (const f of S.FISH.filter(f => f.sea)) { const near = S.FISH.filter(x => !x.sea && Math.abs(x.lv - f.lv) <= 1 && x.sell > 0).map(x => x.sell); assert.ok(f.sell <= Math.max(...near) * 1.2, `${f.name} ไม่ควรแพงกว่าปลาสระระดับเดียวกันเกิน 20%`); }
// แมพ: ท่าเรือบนเกาะ + ฉากทะเลเดินได้เฉพาะดาดฟ้า
const town = S.makeMap(); for (const P of S.PROJECTS) S.applyProject(town, P.id);
assert.strictEqual(town[S.SEA.dock.y][S.SEA.dock.x], S.T.SHOP); assert.strictEqual(S.townAt(S.SEA.dock.x, S.SEA.dock.y), 'sea');
assert.ok(!S.blockedAt(town, (S.SEA.ret.x + 0.5) * TS, (S.SEA.ret.y + 0.5) * TS), 'จุดกลับต้องยืนได้บนเกาะ');
const sm = S.makeCaveMap(S.SEA.floor); assert.ok(!S.blockedAt(sm, S.SEA.spawn.x, S.SEA.spawn.y) && S.blockedAt(sm, 5 * TS, 5 * TS), 'เดินได้บนดาดฟ้า น้ำตัน');
assert.strictEqual(sm[S.SEA.exit.y][S.SEA.exit.x], S.T.MOUTH);

const w = new World('main');
const mk = (name, coin = 1000, fishXp = 5000) => { const p = { name, key: name.toLowerCase(), id: name, x: (S.SEA.dock.x + 1.5) * TS, y: (S.SEA.dock.y + 0.5) * TS, dir: 0, ws: { readyState: 0, send() {} }, lastAct: 0, rec: { name, inv: { coin, bait: 20 }, skills: { farm: 0, fish: fishXp, animal: 0, wood: 0, cook: 0 }, hunger: 100, starter: { done: {}, final: true } } }; w.players.set(name, p); w.saved[p.key] = p.rec; return p; };
const a = mk('A'), low = mk('Low', 1000, 0), poor = mk('Poor', 10), far = mk('Far'); far.x = 5 * TS; far.y = 5 * TS;
const pot0 = w.lotto.pot;
w.seaGo(far); assert.ok(!far.scene, 'อยู่ไกลท่าเรือ ขึ้นเรือไม่ได้');
w.seaGo(low); assert.ok(!low.scene, 'เลเวลตกปลาไม่ถึง');
w.seaGo(poor); assert.ok(!poor.scene && poor.rec.inv.coin === 10, 'เหรียญไม่พอ');
w.seaGo(a);
assert.strictEqual(S.caveFloor(a.scene), S.SEA.floor, 'ขึ้นเรือแล้ว อยู่ฉากทะเล'); assert.strictEqual(a.rec.inv.coin, 1000 - S.SEA.fee); assert.strictEqual(w.lotto.pot, pot0 + S.SEA.fee, 'ค่าเรือเข้ากองกลาง');
assert.ok(a.seaUntil > Date.now() && a.ret.x === (S.SEA.ret.x + 0.5) * TS);
// ตกปลา: เบ็ดเท่านั้น ต้องเป็นช่องน้ำ
w.seaAct(a, { tool: 'hoe' }); assert.ok(!a.fish, 'ไม่ใช่เบ็ด ตกไม่ได้');
a.lastAct = 0; w.seaAct(a, { tool: 'rod', tx: S.SEA.deck.x0, ty: S.SEA.deck.y0 }); assert.ok(!a.fish, 'ดาดฟ้าไม่ใช่น้ำ');
const bait0 = a.rec.inv.bait; a.lastAct = 0; w.seaAct(a, { tool: 'rod', tx: 20, ty: 10, bait: 'bait' });
assert.ok(a.fish && a.fish.sea === true && a.rec.inv.bait === bait0 - 1, 'โยนเบ็ดลงทะเล ใช้เหยื่อ 1 ชิ้น และตั้งธงทะเล');
// ดึงเบ็ด: ได้ปลาจากชุดทะเลเท่านั้น (ทดสอบหลายครั้ง)
const gh = S.gaugeHit, gc = S.gaugeCore; S.gaugeHit = () => true; S.gaugeCore = () => true;
const seaIds = new Set(S.fishPool(true).map(f => 'fish_' + f.id)); let gotSea = 0;
for (let i = 0; i < 200; i++) { a.rec.inv = { coin: 1000, bait: 5 }; a.rec.rareAt = 0; a.fish = { st: 'bite', at: Date.now(), fl: 20, rod: 7, bt: 1, fx: 0, fy: 0, sea: true }; w.reelFish(a, Date.now()); const fk = Object.keys(a.rec.inv).filter(k => k.startsWith('fish_')); assert.strictEqual(fk.length, 1); assert.ok(seaIds.has(fk[0]), 'ได้ปลานอกชุดทะเล ' + fk[0]); if (S.FISH.find(f => 'fish_' + f.id === fk[0]).sea) gotSea++; }
assert.ok(gotSea > 20, 'ปลา sea-only ต้องตกได้บ่อยพอ (ได้ ' + gotSea + '/200)');
for (let i = 0; i < 200; i++) { a.rec.inv = { coin: 1000, bait: 5 }; a.rec.rareAt = 0; a.fish = { st: 'bite', at: Date.now(), fl: 20, rod: 7, bt: 1, fx: 0, fy: 0 }; w.reelFish(a, Date.now()); assert.ok(!Object.keys(a.rec.inv).some(k => /^fish_(sardine|mackerel|tuna|puffer|hammer|bluewhale)$/.test(k)), 'สระต้องไม่ได้ปลาทะเลลึก'); }
S.gaugeHit = gh; S.gaugeCore = gc;
// กลับเกาะ: เดินถึงท้ายเรือ / หมดเวลา
a.rec.inv.coin = 1000; a.x = (S.SEA.exit.x + 0.5) * TS; a.y = (S.SEA.exit.y + 0.5) * TS; a.lastMove = 0;
w.handle(a, { t: 'm', x: a.x, y: a.y, d: 0 }); assert.ok(!a.scene, 'เดินถึงท้ายเรือแล้วกลับเกาะ'); assert.ok(Math.abs(a.x - (S.SEA.ret.x + 0.5) * TS) < 1, 'ลงที่เกาะ');
w.seaGo(a); a.seaUntil = Date.now() - 1; w.tick(0.05, Date.now()); assert.ok(!a.scene, 'หมดเวลา กัปตันพากลับเกาะ');
// เรือขาย: ร้านยานพาหนะขาย 'boat' (ซื้อครั้งเดียว ขายคืน 70%) มีเรือ = ออกทะเลฟรี ไม่เข้ากองกลาง • ไม่มี = จ่าย SEA.fee
{
  assert.ok(S.SHOPS.vehicle.buy.includes('boat') && !S.SHOPS.vehicle.soon, 'ร้านยานพาหนะเปิดขายเรือแล้ว');
  const bi = S.itemInfo('boat'); assert.strictEqual(bi.buy, S.BOAT.price); assert.ok(bi.once && !bi.veh, 'เรือเป็นของชิ้นเดียว ไม่ใช่ยานพาหนะขี่บนบก');
  assert.strictEqual(S.sellbackValue('boat'), Math.floor(S.BOAT.price * S.SELLBACK), 'ขายคืนเรือ 70%');
  const q = mk('Skipper', 5000); w.nearShopKind = () => 'vehicle';
  assert.strictEqual(w.seaFee(q), S.SEA.fee, 'ไม่มีเรือ = จ่ายค่าเรือ');
  w.buy(q, 'boat', 1); assert.strictEqual(q.rec.inv.boat, 1, 'ซื้อเรือได้'); assert.strictEqual(q.rec.inv.coin, 5000 - S.BOAT.price);
  w.buy(q, 'boat', 1); assert.strictEqual(q.rec.inv.coin, 5000 - S.BOAT.price, 'ซื้อซ้ำไม่ได้');
  assert.strictEqual(w.seaFee(q), 0, 'มีเรือ = ออกฟรี');
  const pot1 = w.lotto.pot, c1 = q.rec.inv.coin; w.seaGo(q);
  assert.strictEqual(S.caveFloor(q.scene), S.SEA.floor, 'มีเรือ ออกทะเลได้'); assert.strictEqual(q.rec.inv.coin, c1, 'ไม่เสียค่าเรือ'); assert.strictEqual(w.lotto.pot, pot1, 'ไม่มีเงินเข้ากองกลาง');
  w.seaLeave(q, 'ทดสอบ');
  // เหรียญน้อยแต่มีเรือ ก็ออกได้
  q.rec.inv.coin = 0; w.seaGo(q); assert.strictEqual(S.caveFloor(q.scene), S.SEA.floor, 'มีเรือ เหรียญ 0 ก็ออกได้'); w.seaLeave(q, 'ทดสอบ');
  w.sellback(q, 'boat'); assert.ok(!q.rec.inv.boat && q.rec.inv.coin === S.sellbackValue('boat'), 'ขายคืนเรือได้ 70%'); assert.strictEqual(w.seaFee(q), S.SEA.fee);
}
console.log('✓ ผ่าน: ออกทะเล (ท่าเรือ ค่าเรือเข้ากองกลาง ชุดปลาแยก ตกปลา หมดเวลา/ท้ายเรือกลับเกาะ)');
fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); process.exit(0);
