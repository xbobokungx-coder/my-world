// ทดสอบสระตกปลาจากแพ็ก (public/pondart.js + public/pack/pond/): ไฟล์ภาพครบ ขนาดตรง สคริปต์ถูกเรียกก่อน game.js และ game.js ยังมีทางถอยกลับภาพเดิม
// รัน: node tools/test-pondart.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..', 'public'), src = fs.readFileSync(path.join(root, 'pondart.js'), 'utf8');
const png = f => { const b = fs.readFileSync(f); assert.strictEqual(b.toString('ascii', 1, 4), 'PNG', f + ' ต้องเป็น PNG'); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] }; };

// ชื่อไฟล์ทั้งหมดที่ pondart.js โหลด (ตัดมาจากตาราง FILES ในไฟล์ ไม่ฝังซ้ำในเทสต์)
const files = block => [...block.matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]);
const koi = files(src.match(/koi: \[([^\]]*)\]/)[1]), lily = files(src.match(/lily: \[([^\]]*)\]/)[1]), still = files(src.match(/still: \[([^\]]*)\]/)[1]);
const strips = [...src.matchAll(/(\w+): \['(anim_[a-z0-9_]+)', (\d+)\]/g)].map(m => ({ key: m[1], name: m[2], fw: +m[3] }));
assert.strictEqual(koi.length, 3, 'โคอิ 3 สี'); assert.strictEqual(lily.length, 4, 'ใบบัว 4 แบบ'); assert.strictEqual(strips.length, 3, 'แอนิเมชัน 3 ชุด (นกกระยาง กก กอบัว)');

const dir = path.join(root, 'pack', 'pond');
const expect = (name, w, h) => { const f = path.join(dir, name + '.png'), p = png(f); assert.strictEqual(p.colorType, 6, name + ' ต้องเป็น RGBA (พื้นโปร่งใส)'); assert.deepStrictEqual([p.w, p.h], [w, h], `${name} ขนาด ${p.w}×${p.h} ไม่ตรง ${w}×${h}`); };
koi.forEach(n => expect(n, 64, 64)); lily.forEach(n => expect(n, 32, 32));
expect('b8_giant_lotus', 96, 96); expect('b5_mossy_rocks', 48, 48); expect('b7_yellow_duck', 32, 32);
for (const s of strips) expect(s.name, s.fw * 4, s.fw); // แถบ 4 เฟรมเรียงแนวนอน เฟรมสี่เหลี่ยมจัตุรัส
assert.ok(still.every(n => fs.existsSync(path.join(dir, n + '.png'))), 'ไฟล์นิ่งครบ');
// ไม่มีไฟล์ค้างที่ไม่มีใครใช้ในโฟลเดอร์ (กันของหนักโดยไม่จำเป็นขึ้น git)
const used = new Set([...koi, ...lily, ...still, ...strips.map(s => s.name)].map(n => n + '.png'));
for (const f of fs.readdirSync(dir)) assert.ok(used.has(f), 'ไฟล์ไม่ถูกใช้ใน pondart.js: ' + f);
console.log(`  ไฟล์ภาพ: ok (${used.size} ไฟล์ ${fs.readdirSync(dir).reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0)} ไบต์)`);

// index.html โหลด pondart.js ก่อน game.js • game.js ใช้ PondArt และยังมีภาพเดิมสำรอง
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
assert.ok(html.indexOf('pondart.js') > 0 && html.indexOf('pondart.js') < html.indexOf('src="game.js"'), 'pondart.js ต้องมาก่อน game.js');
assert.ok(/PondArt\.ready\(\)/.test(game), 'game.js ต้องเช็ก PondArt.ready() ก่อนใช้');
assert.ok(/PixelArt\.fish\(i, wag\)/.test(game) && /PixelArt\.lily\(kind\)/.test(game), 'ต้องมีภาพวาดด้วยโค้ดเดิมเป็นทางถอยกลับ (ปลา/ใบบัว)');
console.log('ผ่าน: สระน้ำจากแพ็ก (ไฟล์ครบ ขนาดตรง มีทางถอยกลับ)');
