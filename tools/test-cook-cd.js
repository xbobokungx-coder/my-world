// ทดสอบคูลดาวเตา (cookReady): เซิร์ฟเวอร์ส่ง {t:'cookcd', ms} ทั้งตอนทำสำเร็จและตอนถูกปฏิเสธเพราะเตายังร้อน: node tools/test-cook-cd.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-cookcd-');
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('main'), got = [];
const p = { name: 'K', key: 'k', id: 'K', x: 0, y: 0, ws: { readyState: 1, send(s) { got.push(JSON.parse(s)); } }, rec: { name: 'K', inv: { coin: 1000, crop_carrot: 10, egg: 10 }, skills: { cook: 0 }, starter: { done: {}, final: true } } };
w.players.set('K', p); w.saved.k = p.rec; w.nearShopKind = () => 'food'; w.event = () => {};
const r = S.COOK.find(x => x.lv === 1 && x.in.every(i => i.c || i.k));
w.cook(p, r.id);
const ok = got.filter(m => m.t === 'cookcd'); assert.strictEqual(ok.length, 1, 'ทำสำเร็จส่ง cookcd'); assert.strictEqual(ok[0].ms, r.time);
got.length = 0; w.cook(p, r.id);
const bad = got.filter(m => m.t === 'cookcd'); assert.strictEqual(bad.length, 1, 'เตาร้อนอยู่ ส่ง cookcd'); assert.ok(bad[0].ms > 0 && bad[0].ms <= r.time, 'ms คงเหลือ');
p.cookReady = Date.now() - 1; got.length = 0; w.cook(p, r.id); assert.ok(!got.some(m => m.t === 'cookcd' && m.ms > r.time), 'พ้นคูลดาวทำได้อีก');
console.log('✓ ผ่าน: cookcd');
