// ทดสอบ: แชตเห็นเฉพาะคนที่อยู่แมพ/ฉากเดียวกัน (เมือง • บ้านหลังเดียวกัน • ถ้ำชั้นเดียวกัน) • NPC พูดในเมืองถึงแต่คนในเมือง • สวิตช์ MODERATION.chatScene ปิดแล้วกลับเป็นทั้งห้อง
// รัน: node tools/test-chat-scope.js
const assert = require('assert');
process.env.DATA_DIR = require('./testlib').tmpDataDir('mw-chatscope-');
const { World } = require('../server.js'), S = require('../public/shared.js');
const w = new World('chatscopetest');
const mk = name => { const ws = { readyState: 1, msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } }; const r = w.join(ws, name, '#3498db', false); assert.ok(r.p, name); return { p: r.p, ws }; };
const heard = u => u.ws.msgs.filter(m => m.t === 'chat').map(m => m.text);
const clear = (...us) => us.forEach(u => { u.ws.msgs.length = 0; });
const say = (u, text) => { u.p.lastChat = 0; w.handle(u.p, { t: 'chat', text }); };

const A = mk('Aaa'), B = mk('Bbb'), C = mk('Ccc'), D = mk('Ddd'), E = mk('Eee');
C.p.scene = 'home-of-c'; D.p.scene = 'home-of-c'; E.p.scene = 'cave-floor-3'; // A,B อยู่ในเมือง (scene null) • C,D บ้านเดียวกัน • E อยู่ถ้ำ
assert.strictEqual(S.MODERATION.chatScene, true, 'ค่าตั้งต้นเปิดโหมดเห็นเฉพาะแมพเดียวกัน');

// เมือง: A พูด → A (ตัวเอง) กับ B เห็น คนในบ้าน/ถ้ำไม่เห็น
clear(A, B, C, D, E); say(A, 'สวัสดีชาวเมือง');
assert.deepStrictEqual([heard(A), heard(B)], [['สวัสดีชาวเมือง'], ['สวัสดีชาวเมือง']], 'คนในเมืองเห็นกัน');
assert.deepStrictEqual([heard(C), heard(D), heard(E)], [[], [], []], 'คนในบ้าน/ถ้ำไม่เห็นแชตในเมือง');

// บ้านหลังเดียวกัน: C พูด → C กับ D เห็น คนในเมืองกับถ้ำไม่เห็น
clear(A, B, C, D, E); say(C, 'อยู่ในบ้าน');
assert.deepStrictEqual([heard(C), heard(D)], [['อยู่ในบ้าน'], ['อยู่ในบ้าน']], 'คนในบ้านเดียวกันเห็นกัน');
assert.deepStrictEqual([heard(A), heard(B), heard(E)], [[], [], []], 'คนนอกบ้านไม่เห็นแชตในบ้าน');

// ถ้ำ: E พูดคนเดียว → เห็นแค่ตัวเอง
clear(A, B, C, D, E); say(E, 'ขุดแร่อยู่');
assert.deepStrictEqual([heard(E), heard(A), heard(C)], [['ขุดแร่อยู่'], [], []], 'ในถ้ำเห็นเฉพาะคนในชั้นเดียวกัน');

// ผู้เล่นย้ายแมพแล้วต้องได้ยินตามแมพใหม่ทันที
D.p.scene = null; clear(A, B, C, D, E); say(A, 'D ออกมาแล้ว');
assert.deepStrictEqual([heard(D), heard(C)], [['D ออกมาแล้ว'], []], 'ย้ายมาเมืองแล้วเห็นแชตเมือง คนที่ยังอยู่ในบ้านไม่เห็น');

// บล็อกยังทำงานในแมพเดียวกัน (ไม่ถูกสวิตช์แมพข้าม)
B.p.rec.blocks = [A.p.name.toLowerCase()]; clear(A, B, D); say(A, 'บล็อกอยู่ไหม');
assert.deepStrictEqual([heard(A), heard(B), heard(D)], [['บล็อกอยู่ไหม'], [], ['บล็อกอยู่ไหม']], 'คนที่บล็อกไม่เห็น แต่คนอื่นในแมพเดียวกันเห็น');
B.p.rec.blocks = [];

// NPC พูดในเมือง: คนในเมืองได้ยิน คนในบ้าน/ถ้ำไม่ได้ยิน
const npc = w.npcs[0]; clear(A, B, C, D, E); w.npcSay(npc, Date.now());
assert.ok(heard(A).length === 1 && heard(B).length === 1 && heard(D).length === 1, 'คนในเมืองได้ยิน NPC (D กลับมาเมืองแล้ว)');
assert.ok(heard(C).length === 0 && heard(E).length === 0, 'คนในบ้าน/ถ้ำไม่ได้ยิน NPC');

// สวิตช์ปิด = กลับเป็นทั้งห้อง
S.MODERATION.chatScene = false; clear(A, B, C, D, E); say(A, 'ทั้งห้อง');
assert.ok([A, B, C, D, E].every(u => heard(u).length === 1), 'ปิดสวิตช์แล้วทุกคนในห้องเห็นเหมือนเดิม');
S.MODERATION.chatScene = true;
console.log('ผ่าน: แชตเห็นเฉพาะคนที่อยู่แมพเดียวกัน');
process.exit(0);
