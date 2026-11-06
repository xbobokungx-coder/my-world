// ทดสอบวาปของผู้ดูแล (ไปเมือง/ถ้ำทุกชั้น/ทะเล/บ้านผู้เล่น): node tools/test-warp.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-warp-');
const { World } = require('../server.js'), S = require('../public/shared.js'), TS = S.TS, CAVE = '@cave';

const w = new World('main');
const mk = name => { const p = { name, key: name.toLowerCase(), id: name, x: 5 * TS, y: 5 * TS, dir: 0, ws: { readyState: 0, send() {} }, lastAct: 0, rec: { name, inv: { coin: 0 }, skills: { farm: 0, fish: 0, animal: 0, wood: 0, cook: 0 }, hunger: 100, starter: { done: {}, final: true } } }; w.players.set(name, p); w.saved[p.key] = p.rec; return p; };
const admin = mk('Sira'), guest = mk('Guest');

// เมือง → ถ้ำชั้น 3 → ทะเล → บ้านของ Guest → เมือง
assert.strictEqual(w.warpTo(admin, 'cave:3'), null); assert.strictEqual(admin.scene, CAVE + 3, 'ไปถ้ำชั้น 3');
assert.ok(admin.ret && admin.ret.x === 5 * TS, 'จำจุดเดิมในเมืองไว้ให้กลับมาได้');
assert.strictEqual(w.warpTo(admin, 'sea'), null); assert.strictEqual(admin.scene, CAVE + S.SEA.floor, 'ไปทะเล');
assert.ok(admin.seaUntil > Date.now(), 'ทะเลต้องมีเวลาอยู่');
assert.strictEqual(w.warpTo(admin, 'house:guest'), null); assert.strictEqual(admin.scene, 'guest', 'ไปบ้านผู้เล่น');
assert.ok(!admin.seaUntil, 'ออกจากทะเลแล้วเวลาทะเลต้องถูกเคลียร์');
assert.strictEqual(w.warpTo(admin, 'town'), null); assert.strictEqual(admin.scene, null, 'กลับเมือง');
assert.strictEqual(admin.x, S.SPAWN.x); assert.strictEqual(admin.y, S.SPAWN.y);

// ผิดพลาด: ชั้นเกินจำนวน, บ้านที่ไม่มี, จุดหมายที่ไม่รู้จัก
assert.ok(w.warpTo(admin, 'cave:' + (S.MINE.floors + 1)), 'ชั้นเกินต้องไม่ผ่าน');
assert.ok(w.warpTo(admin, 'cave:0'), 'ชั้น 0 ต้องไม่ผ่าน');
assert.ok(w.warpTo(admin, 'house:nobody'), 'บ้านที่ไม่มีต้องไม่ผ่าน');
assert.ok(w.warpTo(admin, 'moon'), 'จุดหมายไม่รู้จักต้องไม่ผ่าน');
assert.strictEqual(admin.scene, null, 'ผิดพลาดแล้วต้องอยู่ที่เดิม');

console.log('ผ่าน test-warp');
