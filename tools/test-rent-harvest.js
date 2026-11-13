// แปลงเช่า: ระหว่างสัญญาคนอื่นเก็บผักในแปลงไม่ได้ แม้สุกค้างเกิน 1 วันในเกม • หมดสัญญาแล้วกลับไปใช้กฎสุกค้าง 1 วันตามปกติ
// node tools/test-rent-harvest.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-rentharvest-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS;

const w = new World('rentharvest');
const mk = name => { const ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }, p = w.join(ws, name, '#fff').p; p.ws2 = ws; p.rec.starter = { done: {}, final: true }; p.rec.hunger = 100; return p; };
const owner = mk('renter'), other = mk('thief');
w.exhausted = () => false;
const P = S.FARM_RENT.plots[0], x = P.x0, y = P.y0, k = x + ',' + y, C = 'carrot';
const ripe = () => { w.farm[k] = { c: C, g: S.CROPS[C].time, o: owner.key, on: owner.name, rm: S.DAY_MS + 1, wu: 0 }; }; // สุกค้างเกิน 1 วันในเกม (กฎปกติ = ใครก็เก็บได้)
const harvest = p => { p.x = (x + 0.5) * TS; p.y = (y + 1.5) * TS; p.dir = 1; p.lastAct = 0; const n0 = p.rec.inv['crop_' + C] || 0; w.act(p, 'hand', Date.now(), x, y); return (p.rec.inv['crop_' + C] || 0) - n0; };

// ระหว่างสัญญา: คนอื่นเก็บไม่ได้
w.rents[P.id] = { key: owner.key, name: owner.name, until: Date.now() + 60e3 };
ripe(); assert.strictEqual(harvest(other), 0, 'คนอื่นเก็บผักในแปลงเช่าระหว่างสัญญาไม่ได้'); assert.ok(w.farm[k].c, 'ผักยังอยู่');
assert.ok(/เช่าอยู่/.test(other.ws2.msgs.filter(m => m.t === 'msg').pop().text), 'บอกว่าแปลงนี้มีคนเช่า');
assert.ok(harvest(owner) >= 1, 'คนเช่าเก็บผักตัวเองได้');

// หมดสัญญา: กลับไปใช้กฎสุกค้าง 1 วัน
w.rents[P.id].until = Date.now() - 1;
ripe(); assert.ok(harvest(other) >= 1, 'หมดสัญญาแล้ว ผักที่สุกค้างเกิน 1 วันใครก็เก็บได้ตามกฎเดิม');

// แปลงกลางที่ไม่ใช่แปลงเช่า: กฎเดิมไม่เปลี่ยน
assert.ok(!S.rentPlotAt(x, S.FARM.y1), 'ช่องล่างสุดของแปลงกลางไม่ใช่แปลงเช่า');
console.log('PASS test-rent-harvest');
process.exit(0);
