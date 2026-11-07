// ทดสอบออกทะเล (เรือที่ท่าเกาะลึกลับ → ฉากทะเล ตกปลาทะเลลึก): node tools/test-sea.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-sea-');
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
S.OCEAN.anytime = true; // ไม่ผูกกับนาฬิกาจริง (ร้านเช่าเรือเปิด 06:00–19:00 ทดสอบด้านล่าง)
w.seaGo(a);
assert.strictEqual(S.caveFloor(a.scene), S.OCEAN.floor, 'เช่าเรือแล้ว อยู่ทะเลใหญ่ (แพเลิกใช้แล้ว)'); assert.strictEqual(a.rec.inv.coin, 1000 - S.SEA.fee); assert.strictEqual(w.lotto.pot, pot0 + S.SEA.fee, 'ค่าเช่าเรือเข้ากองกลาง');
assert.ok(Number.isFinite(a.seaUntil) && a.seaUntil > Date.now() && a.ret.x === (S.SEA.ret.x + 0.5) * TS, 'เรือเช่ามีเวลาจำกัด');
// ตกปลา: เบ็ดเท่านั้น ต้องเป็นช่องน้ำ
w.seaAct(a, { tool: 'hoe' }); assert.ok(!a.fish, 'ไม่ใช่เบ็ด ตกไม่ได้');
const bait0 = a.rec.inv.bait; a.lastAct = 0; w.seaAct(a, { tool: 'rod', tx: Math.floor(a.x / TS) + 3, ty: Math.floor(a.y / TS), bait: 'bait' });
assert.ok(a.fish && a.fish.sea === true && a.rec.inv.bait === bait0 - 1, 'โยนเบ็ดลงทะเล ใช้เหยื่อ 1 ชิ้น และตั้งธงทะเล');
// ดึงเบ็ด: ได้ปลาจากชุดทะเลเท่านั้น (ทดสอบหลายครั้ง)
const reelWin = p => { w.startFight(p, Date.now()); if (p.fish && p.fish.st === 'fight') { p.fish.ft.end = 'win'; w.fightEnd(p, Date.now()); } }; // กดเกจโดน → ชักเย่อ (บังคับชนะทันที ตรวจชุดปลา/โซนอย่างเดียว ตัวชักเย่ออยู่ใน test-fight.js)
const seaIds = new Set(S.fishPool(true).map(f => 'fish_' + f.id)); let gotSea = 0;
for (let i = 0; i < 200; i++) { a.rec.inv = { coin: 1000, bait: 5 }; a.rec.rareAt = 0; a.fish = { st: 'bite', at: Date.now(), fl: 20, rod: 7, bt: 1, fx: 0, fy: 0, sea: true }; reelWin(a); const fk = Object.keys(a.rec.inv).filter(k => k.startsWith('fish_')); assert.strictEqual(fk.length, 1); assert.ok(seaIds.has(fk[0]), 'ได้ปลานอกชุดทะเล ' + fk[0]); if (S.FISH.find(f => 'fish_' + f.id === fk[0]).sea) gotSea++; }
assert.ok(gotSea > 20, 'ปลา sea-only ต้องตกได้บ่อยพอ (ได้ ' + gotSea + '/200)');
for (let i = 0; i < 200; i++) { a.rec.inv = { coin: 1000, bait: 5 }; a.rec.rareAt = 0; a.fish = { st: 'bite', at: Date.now(), fl: 20, rod: 7, bt: 1, fx: 0, fy: 0 }; reelWin(a); assert.ok(!Object.keys(a.rec.inv).some(k => /^fish_(sardine|mackerel|tuna|puffer|hammer|bluewhale)$/.test(k)), 'สระต้องไม่ได้ปลาทะเลลึก'); }
// กลับเกาะ: เดินถึงท้ายเรือ / หมดเวลา
a.rec.inv.coin = 1000; a.x = (S.SEA.exit.x + 0.5) * TS; a.y = (S.SEA.exit.y + 0.5) * TS; a.lastMove = 0;
a.fish = null; w.seaLeave(a, 'ทดสอบ'); assert.ok(!a.scene, 'กลับเกาะได้');
w.seaGo(a); a.seaUntil = Date.now() - 1; w.tick(0.05, Date.now()); assert.ok(!a.scene, 'เรือเช่าหมดเวลา กัปตันพากลับเกาะ'); S.OCEAN.anytime = false;
// เรือขาย: ร้านยานพาหนะขาย 'boat' (ซื้อครั้งเดียว ขายคืน 70%) มีเรือ = ออกทะเลฟรี ไม่เข้ากองกลาง • ไม่มี = จ่าย SEA.fee
{
  assert.ok(S.SHOPS.vehicle.buy.includes('boat') && !S.SHOPS.vehicle.soon, 'ร้านยานพาหนะเปิดขายเรือแล้ว');
  const bi = S.itemInfo('boat'); assert.strictEqual(bi.buy, S.BOAT.price); assert.ok(bi.once && !bi.veh, 'เรือเป็นของชิ้นเดียว ไม่ใช่ยานพาหนะขี่บนบก');
  assert.strictEqual(S.sellbackValue('boat'), Math.floor(S.BOAT.price * S.SELLBACK), 'ขายคืนเรือ 70%');
  const q = mk('Skipper', 5000); w.nearShopKind = () => 'vehicle'; S.OCEAN.anytime = true; // (เรือเช่าตรวจนาฬิกา) เรือของตัวเองไม่ผูกกับนาฬิกาอยู่แล้ว
  assert.strictEqual(w.seaFee(q), S.SEA.fee, 'ไม่มีเรือ = จ่ายค่าเรือ');
  w.buy(q, 'boat', 1); assert.strictEqual(q.rec.inv.boat, 1, 'ซื้อเรือได้'); assert.strictEqual(q.rec.inv.coin, 5000 - S.BOAT.price);
  w.buy(q, 'boat', 1); assert.strictEqual(q.rec.inv.coin, 5000 - S.BOAT.price, 'ซื้อซ้ำไม่ได้');
  assert.strictEqual(w.seaFee(q), 0, 'มีเรือ = ออกฟรี');
  const pot1 = w.lotto.pot, c1 = q.rec.inv.coin; w.seaGo(q);
  assert.strictEqual(S.caveFloor(q.scene), S.OCEAN.floor, 'มีเรือ ออกทะเลใหญ่ได้'); assert.strictEqual(q.rec.inv.coin, c1, 'ไม่เสียค่าเรือ'); assert.strictEqual(w.lotto.pot, pot1, 'ไม่มีเงินเข้ากองกลาง');
  w.seaLeave(q, 'ทดสอบ');
  // เหรียญน้อยแต่มีเรือ ก็ออกได้
  q.rec.inv.coin = 0; w.seaGo(q); assert.strictEqual(S.caveFloor(q.scene), S.OCEAN.floor, 'มีเรือ เหรียญ 0 ก็ออกได้'); w.seaLeave(q, 'ทดสอบ');
  w.sellback(q, 'boat'); assert.ok(!q.rec.inv.boat && q.rec.inv.coin === S.sellbackValue('boat'), 'ขายคืนเรือได้ 70%'); assert.strictEqual(w.seaFee(q), S.SEA.fee); S.OCEAN.anytime = false;
}
// ทะเลใหญ่ (คนมีเรือขับเอง): แมพ เกาะชน โซนน้ำ ช่วงเวลาออกเรือ ค่าเรือฟรี โยนเบ็ดระยะจำกัด กลับท่า ตะวันตก
{
  const T = S.T, m = S.makeOceanMap(), O = S.OCEAN, L = S.oceanLayout();
  assert.ok(L.islands.length >= 5 && L.reefs.length >= 4, 'มีเกาะและแนวปะการัง');
  const sx = Math.floor(O.spawn.x / TS), sy = Math.floor(O.spawn.y / TS); assert.strictEqual(m[sy][sx], T.CAVE, 'จุดเกิดเป็นน้ำแล่นได้');
  const seen = new Set([sx + ',' + sy]), q = [[sx, sy]]; let water = 0; m.forEach(r => r.forEach(c => { if (c === T.CAVE || c === T.MOUTH) water++; }));
  while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of S.DIRS) { const k = (x + dx) + ',' + (y + dy), t = m[y + dy] && m[y + dy][x + dx]; if (seen.has(k) || !(t === T.CAVE || t === T.MOUTH)) continue; seen.add(k); q.push([x + dx, y + dy]); } }
  assert.strictEqual(seen.size, water, 'แล่นถึงน้ำทุกช่อง (เกาะไม่ปิดทาง)');
  for (let y = O.exit.y0; y <= O.exit.y1; y++) assert.strictEqual(m[y][O.exit.x], T.MOUTH, 'ทางกลับท่า'); assert.ok(seen.has(O.exit.x + ',' + O.exit.y0), 'แล่นจากจุดเกิดถึงท่าได้');
  assert.ok(S.blockedAt(m, 0.5 * TS, 5.5 * TS) && S.blockedAt(m, (W0 = S.W - 0.5) * TS, 5.5 * TS), 'ขอบแมพชน'); var W0;
  const z = {}; m.forEach((r, y) => r.forEach((c, x) => { if (c === T.CAVE) { const k = S.oceanZone(x, y); z[k] = (z[k] || 0) + 1; } }));
  assert.ok(z.shallow > 100 && z.reef > 100 && z.open > 100 && z.deep > 100, 'มีครบ 4 โซน ' + JSON.stringify(z));
  assert.ok(S.oceanZoneMul('deep', 18) > S.oceanZoneMul('deep', 3) && S.oceanZoneMul('shallow', 2) > 1, 'ปลาระดับตรงโซนออกบ่อยกว่า');
  // ช่วงเวลา: เช้ามีเวลานาน บ่ายแก่เหลือน้อย 15:00 เป็นต้นไป/กลางคืนออกไม่ได้
  const at = h => ((h - 6 + 24) % 24) / 24 * S.CLOCK_MS + S.CLOCK_MS * 5000;
  const w6 = S.oceanWindow(at(6)), w10 = S.oceanWindow(at(10)), w149 = S.oceanWindow(at(16.9));
  assert.ok(w6.ok && Math.abs(w6.ms - 13 * 60e3) < 2000 && w10.ok && Math.abs(w10.ms - 9 * 60e3) < 2000 && w149.ok && w149.ms >= 2 * 60e3 - 2000, 'เรือเช่าอยู่ได้ = จนร้านปิด 19:00 (16:54 ยังเหลือ ≥ 2 นาที)');
  for (const h of [5, 17, 18, 19, 22]) assert.ok(!S.oceanWindow(at(h)).ok && S.oceanWindow(at(h)).why, 'ร้านเช่าเรือปิด/ใกล้ปิด ตอน ' + h + ':00');
  assert.ok(S.oceanWindow(at(15)).ok && S.oceanWindow(at(16)).ok, 'เช่าได้ตอน 15–16:00 (แต่เดิมออกไม่ได้)');

  S.OCEAN.anytime = true; // ทดสอบกติกาที่เหลือโดยไม่ผูกกับนาฬิกาจริง
  const own = mk('Owner', 100), raft = mk('Raft', 1000); own.rec.inv.boat = 1; w.nearShopKind = () => '';
  const c0 = own.rec.inv.coin, pot2 = w.lotto.pot; w.seaGo(own);
  assert.strictEqual(S.caveFloor(own.scene), O.floor, 'มีเรือ → ทะเลใหญ่'); assert.strictEqual(own.rec.inv.coin, c0, 'ฟรี'); assert.strictEqual(w.lotto.pot, pot2);
  assert.ok(Math.abs(own.x - O.spawn.x) < 1 && own.seaUntil === Infinity, 'เกิดที่ท่าซ้ายสุด เรือตัวเองไม่จำกัดเวลา');
  { const sent = []; own.ws = { readyState: 1, send: s => sent.push(JSON.parse(s)) }; w.tick(0.05, Date.now() + 10 * 3600e3); assert.strictEqual(S.caveFloor(own.scene), O.floor, 'ผ่านไป 10 ชม. ก็ไม่ถูกส่งกลับ'); S.OCEAN.anytime = false; w.seaLeave(own, 't'); S.OCEAN.anytime = true; w.seaGo(own); assert.ok(sent.some(m => m.t === 'scene' && m.until === 0), 'ส่ง until=0 (ไม่มีนาฬิกานับถอยหลัง)'); }
  w.seaGo(raft); assert.strictEqual(S.caveFloor(raft.scene), O.floor, 'ไม่มีเรือ → เช่าเรือขับเองในทะเลใหญ่ (จ่ายค่าเช่า)'); assert.ok(Number.isFinite(raft.seaUntil), 'เรือเช่ามีเวลาจำกัด'); assert.strictEqual(raft.rec.inv.coin, 1000 - S.SEA.fee);
  // เดิน/ชน: น้ำเดินได้ เกาะชน ขอบชน
  const F = w.floorOf(O.floor); assert.ok(!w.blockedFor(own, O.spawn.x, O.spawn.y) && w.blockedFor(own, 0.5 * TS, 5.5 * TS));
  const isl = L.islands[0]; assert.ok(w.blockedFor(own, (Math.round(isl.x) + 0.5) * TS, (Math.round(isl.y) + 0.5) * TS), 'ชนเกาะ');
  // โยนเบ็ด: ต้องเป็นน้ำ (T.CAVE) ไม่เกินระยะ castRange • ปลาโซนที่ตก
  own.lastAct = 0; const px = Math.floor(own.x / TS), py = Math.floor(own.y / TS);
  w.seaAct(own, { tool: 'rod', tx: px + O.castRange + 3, ty: py }); assert.ok(!own.fish, 'ไกลเกินระยะโยน');
  own.lastAct = 0; w.seaAct(own, { tool: 'rod', tx: 0, ty: py }); assert.ok(!own.fish, 'ขอบแมพ ไม่ใช่น้ำ');
  own.rec.inv.bait = 5; own.lastAct = 0; w.seaAct(own, { tool: 'rod', tx: px + 3, ty: py, bait: 'bait' });
  assert.ok(own.fish && own.fish.sea && own.fish.zone === S.oceanZone(px + 3, py), 'โยนใกล้เรือได้ และจำโซนของน้ำที่โยน');
  // เทียบสัดส่วนปลา: โซนลึกออกปลาเลเวลสูงบ่อยกว่าโซนตื้น (ผู้เล่นเลเวลสูง)
    const lvAvg = zone => { let sum = 0, n = 0; for (let i = 0; i < 400; i++) { own.rec.inv = { coin: 1000, bait: 5, boat: 1 }; own.rec.rareAt = 0; own.fish = { st: 'bite', at: Date.now(), fl: 20, rod: 7, bt: 1, fx: 0, fy: 0, sea: true, zone }; reelWin(own); for (const k of Object.keys(own.rec.inv)) if (k.startsWith('fish_')) { const f = S.fishPool(true).find(x => 'fish_' + x.id === k); if (f) { sum += f.lv * own.rec.inv[k]; n += own.rec.inv[k]; } } } return sum / n; };
  const sh = lvAvg('shallow'), dp = lvAvg('deep');   assert.ok(dp > sh + 3, `ปลาทะเลลึกเลเวลสูงกว่าทะเลตื้น (ตื้น ${sh.toFixed(1)} • ลึก ${dp.toFixed(1)})`);
  // กลับท่า (แล่นถึง MOUTH) และตะวันตก (หมดเวลา)
  own.rec.inv.boat = 1; own.fish = null; own.x = (O.exit.x + 0.5) * TS; own.y = (O.exit.y0 + 1.5) * TS; own.lastMove = 0; w.handle(own, { t: 'm', x: own.x, y: own.y, d: 2 });
  assert.ok(!own.scene && Math.abs(own.x - (S.SEA.ret.x + 0.5) * TS) < 2, 'แล่นถึงท่า กลับเกาะ');
  w.seaGo(own); const toasts = [], toast0 = w.toast.bind(w); w.toast = (pl, t) => { toasts.push(t); return toast0(pl, t); }; own.seaUntil = Date.now() + 50000; w.tick(0.05, Date.now()); assert.ok(toasts.some(t => /เรือเช่าใกล้หมดเวลา/.test(t)), 'เตือน 1 นาทีสุดท้าย'); w.toast = toast0;
  own.seaUntil = Date.now() - 1; w.tick(0.05, Date.now()); assert.ok(!own.scene, 'ตะวันตก กัปตันพากลับเกาะ');
  S.OCEAN.anytime = false;
  // ออกเรือไม่ได้ตอนกลางคืน/บ่ายแก่ (ใช้นาฬิกาจริงของเกมอาจเป็นเวลาไหนก็ได้ จึงเช็กผ่าน oceanWindow ด้านบนแล้ว)
}
console.log('✓ ผ่าน: ออกทะเล (ท่าเรือ ค่าเรือเข้ากองกลาง ชุดปลาแยก ตกปลา หมดเวลา/ท้ายเรือกลับเกาะ)');
process.exit(0);
