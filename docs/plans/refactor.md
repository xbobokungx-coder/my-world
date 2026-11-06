# แผนลงมือ Refactor (architect) — อ้างอิง `docs/plans/REFACTOR-PLAN.md`
ตรวจกับโค้ดจริงที่ commit `d2d467e` (6 พ.ย. 2026): `server.js` 3,798 บรรทัด, `class World` บรรทัด 64–3378, `handle()` เป็น `switch` (~84 case, บรรทัด 1521), `module.exports = { World }` อยู่บรรทัด 3382 (`return` ก่อนเปิดเซิร์ฟเวอร์), ยังไม่มีโฟลเดอร์ `server/` หรือ `shared/`, เทสต์ 14 ไฟล์

## 1. เป้าหมาย / ไม่ใช่เป้าหมาย
- เป้าหมาย: แยก `World` เป็นไฟล์ตามระบบ โดย**ย้ายโค้ด ไม่เขียนใหม่** ผลเกมเหมือนเดิมทุกขั้น (พิสูจน์ด้วย golden test)
- ไม่ใช่เป้าหมาย: ปรับตัวเลขสมดุล, เพิ่มฟีเจอร์, เปลี่ยนข้อความ ws, เปลี่ยนรูปแบบไฟล์เซฟก่อนขั้น 4, แก้บั๊กที่เจอระหว่างย้าย (จดลง `docs/tasks/` แยก)

## 2. ระบบที่แตะ / เจ้าของงาน
qa-tester: 0.1–0.3, 0.6, 0.7 และรันชุดเทสต์ทุก commit • server-dev: 0.4 (server), 0.5, ขั้น 1, 2, 4 • client-dev: 0.4 (game.js), ขั้น 3 • code-reviewer: ทุก commit • pixel-artist / economy-designer: ไม่เกี่ยว
ช่วงขั้น 0–1 ทำทีละ agent (ทุกงานแตะ `server.js` ไฟล์เดียวกัน)

## 3. โปรโตคอลข้อความ
ขั้น 0–3 **ไม่เปลี่ยนข้อความ ws ใดๆ** (ชนิด ฟิลด์ ทิศทางเดิมทั้งหมด) • ขั้น 3 เพิ่ม HTTP `GET /shared/<path>.js` (ดู D1) รับเฉพาะ `.js` ผ่านด่าน normalize + `startsWith` แบบเดียวกับ `PUB` (server.js:3465–3466) ตอบ 403 ถ้าหลุดโฟลเดอร์

## 4. State และไฟล์เซฟ
- ขั้น 0–3: **ห้ามเปลี่ยนรูปแบบเซฟ** golden test เทียบ JSON ที่ `save()` เขียนจริงทั้งก้อน จึงจับได้ทันทีถ้ามีฟิลด์เปลี่ยน
- ขั้น 4: เพิ่ม `ver: 1` ระดับบนสุด + `server/persist.js` รวม migration เฉพาะกิจเดิม (`layout<2`, `xpv 3`, `px64`, `treeMix 2`, บ้าน v1/legacy) เป็นรายการเรียงตามเวอร์ชัน ออกแบบแบบ "เพิ่มอย่างเดียว" ให้โค้ดเก่ายังอ่านไฟล์ใหม่ได้ (ถอยได้ไม่ต้องคืนข้อมูล)
- สำรองก่อนขั้น 4: `deploy.sh` tar `data/` ลง `backup/pre-deploy/` อยู่แล้ว + ผู้ใช้ดึงสำรองนอก VPS (`tools/pull-backup.sh`) และทดสอบ migration กับสำเนาสำรองที่เครื่อง dev ก่อน

## 5. คำตัดสิน
**D1 เสิร์ฟ shared ให้เบราว์เซอร์ → โฟลเดอร์ `shared/` ที่ราก + route `/shared/` ใน server.js**
- `public/shared.js` ตอนนี้เป็น UMD: `(function (root) {...})(this)` ท้ายไฟล์ `module.exports = api` หรือ `root.Shared = api` (บรรทัด 2, 1581) โหลดด้วย `<script>` ธรรมดา (index.html:611 ต่อจาก `layout.js`) และอ่าน `globalThis.__LAYOUT` ตอนโหลด
- ทาง B (`public/shared/`) เสีย: regex restart ใน `tools/deploy.sh:72` จับ `^public/shared\.js` และ `^shared/` แต่**ไม่จับ `public/shared/`** → แก้ตัวเลขแล้วเซิร์ฟเวอร์ไม่ restart ผู้เล่นเห็นราคาใหม่แต่เซิร์ฟเวอร์คิดราคาเก่า และทำลายกติกา "ไฟล์ใต้ public/ = ไม่ต้อง restart"
- ทาง A (เลือก) ได้: deploy.sh รองรับ `^shared/` อยู่แล้ว, Caddy ส่งทุกคำขอเข้า Node จึงใช้ route ได้, `require('../shared/...')` ตรงไปตรงมา • เสีย: route ใหม่ ~4 บรรทัดที่ต้องกัน path traversal (มีเทสต์)
- รูปแบบไฟล์ shared คง **UMD/สคริปต์ธรรมดา ไม่ใช้ ES module** (`this` ใน module เป็น `undefined` และ require ESM จาก Node ขึ้นกับเวอร์ชัน) โมดูลฝั่ง client อ่านจาก `globalThis.Shared` ลำดับโหลด: `layout.js` → `/shared/*` → `pixel*` → client
- ช่วงเปลี่ยนผ่าน `public/shared.js` เหลือเป็น shim ฝั่ง Node `module.exports = require('../shared')` เพราะเทสต์ 14 ไฟล์ + `levelsim/econsim/economy/check.js` require path นี้ ลบเมื่อแก้ path ครบ

**D2 ชื่อบริการกลาง = ชื่อเดิมในโค้ด (ไม่เปลี่ยนชื่อ ไม่ห่อใหม่)**
- inv: `add(p, key, n, why, lots)` (server.js:1415, n<0 = หัก คืนกองที่หัก) + `creditInv(key, item, n)` (474, ผู้เล่นออฟไลน์) — ไม่สร้าง `take`
- xp: `addXp(p, skill, n)` (1440) • toast: `toast(p, text)` (1414) • broadcast: `broadcast(o, except)` (1405), `sceneBroadcast(scene, o, except)` (341), `send(p, o)` ฟังก์ชันระดับโมดูล (48)
- event bus: `event(p, ev, arg)` (567, เรียก 23 จุด) • เพิ่มที่เจอจริง: `toPot(n)` กองกลาง (1194, ถูกเรียก 13 จุดจาก 9 ระบบ) state เป็นของ lotto แต่นับเป็นบริการกลาง, `addLog(text)` ข่าวเมือง, `sfx/sfxTo`, `logEv(room, e, o)` สถิติ
- ข้อสังเกตขั้น 2: `add` → `freshPub` → `hasFridge` อ่าน `this.houses` (core พึ่ง house); "ออกจากเมือง" ซ้ำ 5 จุด (`arcLeave`+`tradeCancel`+`cinema.viewers.delete` ที่ 243, 255, 359, 1509, 2046) ควรเป็น event `leaveTown`

**D3 กลไก mixin**: `server/mixin.js` ฟังก์ชัน `mix(World, mod)` ใช้แทน `Object.assign` — โยน error ถ้าชื่อซ้ำกับที่มีบน prototype (กันทับเงียบแบบ `weekKey`) และ define แบบ non-enumerable เหมือนเมธอด class • เรียก `mix` หลังปิด class (3378) **ก่อน** บรรทัด 3382 ไม่งั้นเทสต์ไม่เห็นเมธอด • เมธอดใช้ตัวแปรระดับโมดูล (`send`, `logEv`, `rand`, `crypto`, `S`, `TS` ฯลฯ) จึงต้องย้ายตัวช่วยไป `server/util.js` ก่อน (ขั้น 1.0) ค่าคงที่เฉพาะระบบย้ายไปกับระบบ (`NPC_DEFS`→npc, `PET_DEFS`→pets, `PARTY`/`RESULT_MS`→arcade, `EMPTY_MS`→cinema) • ไฟล์ระบบ `require('../../public/shared.js')` ได้ object เดียวกับที่ server.js โหลด (หลังตั้ง `__LAYOUT`) ห้ามเทสต์ require ไฟล์ระบบก่อน server.js

**D4 golden test ให้ผลคงที่ → สแตบในเทสต์ ไม่ฉีด clock/rng เข้า World**: `World` รับแค่ `constructor(room)`, `DATA_DIR` อ่านตอนโหลดโมดูล, มี `Date.now`/`new Date`/`Math.random` 186 จุด + `crypto.randomInt/randomBytes` (หวย 1200, 1256, ลิงก์ชวน 995) การฉีดต้องแก้ทุกจุด = เขียนใหม่ จึงสแตบก่อน require: `process.env.TZ='Asia/Bangkok'` บรรทัดแรก (หวย/`today()` ใช้เวลาท้องถิ่น) • แทน `Date` ทั้งคลาสด้วยคลาสลูกที่ `new Date()` ไม่มีอาร์กิวเมนต์และ `Date.now()` คืนเวลาปลอม `T` (สแตบแค่ `Date.now` ไม่พอ `today()`/`weekKey()` ใช้ `new Date()`) • `Math.random` = PRNG มี seed (mulberry32) • แพตช์ `crypto.randomInt/randomBytes` บน object โมดูล (server.js เรียกผ่าน `crypto.x`) ข้อดี: ไม่ต้องตัดฟิลด์สุ่มทิ้ง และจับได้แม้ลำดับการสุ่มเปลี่ยน

## 6. ขั้นตอน (ทีละข้อ = หนึ่งรอบ agent = หนึ่ง commit)
ลำดับขั้น 0: 0.1 → 0.2 → 0.3 → 0.7 → 0.5 → 0.4 → 0.6 (สร้างตาข่ายก่อนลบโค้ดใดๆ) • ถอยทุกข้อ = `git revert` commit นั้น (ไม่แตะเซฟ)
- **0.1 temp dir ค้าง** (qa) `tools/testlib.js` ฟังก์ชัน `tmpDataDir(prefix)` = `mkdtempSync` + `process.on('exit', rmSync recursive)` (ล้างแม้ assert พัง) แล้วแก้บรรทัดตั้ง `DATA_DIR` ใน 14 เทสต์ — ตอนนี้มีแค่ sea/lotto/persist ที่ลบ (และลบเฉพาะตอนผ่าน) อีก 11 ไฟล์ไม่ลบเลย: ach-give cave fight herd house mining ore-mix pet starter trees warp (บน VPS deploy.sh ตั้ง `DATA_DIR` ให้แต่เทสต์เขียนทับด้วย `os.tmpdir()` จึงค้างที่ /tmp ของ VPS ด้วย) • เสร็จเมื่อ: จำนวน `/tmp/mw-*` ก่อน/หลังรันเทสต์ทั้งหมดเท่ากัน รวมกรณีบังคับให้พัง 1 ข้อ
- **0.2 test-mining พังเป็นช่วงๆ** (qa) ที่มาหลัก: ข้อสุดท้าย (tools/test-mining.js:66–68) อ่าน "บรรทัดสุดท้าย" ของไฟล์ events แต่ `logEv` ใช้ `fs.appendFile` แยกครั้ง (~90 ครั้งในรอบเดียว) ผ่าน threadpool จึงเขียนลงไฟล์สลับลำดับได้ บรรทัดท้ายอาจเป็น event จากบล็อกก่อน (`gl:0`) + รอแค่ 300 ms คงที่ • ตรวจแล้วตัดทิ้ง: `extra>0` ใน 80 รอบ (พลาด ≈ 0.85^80 ≈ 2e-6), `rollDrop` (ขั้นต่ำ 1), การสึกเศษส่วนไม่ถูก assert • ยืนยันก่อนแก้: รัน 25 รอบ เก็บข้อความ assert ที่พังต้องเป็น "event mine ครบข้อมูล" แก้ในเทสต์: หา event ที่ `k==='stone' && gl===1` แทนตัวท้าย + วนรอสูงสุด 3 วินาที • เสร็จเมื่อ: 50/50 รอบผ่าน (ถ้าข้อความพังเป็นข้ออื่น หยุดแล้วรายงาน)
- **0.3 golden** (qa) `tools/test-golden.js` + `tools/golden/expected.json` ตาม D4: โลกใหม่ใน temp dir, ผู้เล่น 2 คน mock ws, ชุดข้อความตายตัว (เดิน ไถ รดน้ำ ปลูก เก็บเกี่ยว ตกปลาถึงจบ ขาย ซื้อ วางของในบ้าน ซื้อหวย ขุดแร่) เดินเวลา `T` ทีละ 600 ms, เรียก `tick/cropTick/oreTick/marketTick` ด้วย `T` จำนวนคงที่ แล้ว `save(true)` อ่านไฟล์ + รายการข้อความที่ผู้เล่นได้รับ → deep-equal กับ expected แสดง path ที่ต่างจุดแรก • `GOLDEN_UPDATE=1` เขียน expected ใหม่ (ใช้เฉพาะตั้งใจเปลี่ยนกติกา ต้องผ่าน code-reviewer) • ไม่มีข้อมูลผู้เล่นจริง • จบด้วย `process.exit` (กัน `setTimeout` แจ้งเตือนใน join) • เสร็จเมื่อ: ผ่าน 5 รอบติด และทดลองแก้ตัวเลขใน shared 1 จุดแล้วพัง
- **0.7 check-structure** (qa) `tools/check-structure.js`: สแกนชื่อเมธอดใน body ของ `class World` หาชื่อซ้ำ + ชื่อซ้ำข้าม `server/systems/**/*.js` กับ class, `node --check` ทุก .js ใน `server.js server/ shared/ public/` exit 1 เมื่อพบ • เสร็จเมื่อ: รันกับโค้ดตอนนี้แล้วรายงาน `weekKey` ซ้ำ (พิสูจน์ว่าจับได้)
- **0.5 weekKey** (server-dev) ตัวที่มีผลจริงคือตัวหลัง ISO `"2026-W45"` (882) เพราะทับตัวแรก (485) → **ลบตัวแรกที่ 485** พฤติกรรมเหมือนเดิม 100% (`rec.arc.wkKey` ในเซฟเป็นสตริง ISO อยู่แล้ว ถ้าเลือกตัวเลขจะรีเซ็ตอันดับรายสัปดาห์ทุกคนหนึ่งครั้ง) • เทสต์: `arcOf` คง `wk` ในสัปดาห์เดียวกันและรีเซ็ตเมื่อข้ามวันจันทร์ (Date ปลอม) • golden ไม่เปลี่ยน, check-structure ผ่าน
- **0.4 ลบคาสิโน** (server-dev แล้ว client-dev) server.js 54 จุด (`newCasinoTable`, `casinoHandle`, bacc/bj, `RESULT_MS`/`CASINO_RESULT_MS`), game.js 14 จุด, `GAME_TITLES` ใน shared.js:1036 • `CABINETS` ไม่มีเกม bacc/bj แล้ว จึงเป็นโค้ดตาย • ห้ามลบฟิลด์ในเซฟ (ถ้ามี `rec` ฟิลด์คาสิโนให้ปล่อยผ่าน) • เสร็จเมื่อ: grep `casino|bacc|'bj'` = 0, เทสต์ + golden ไม่เปลี่ยน
- **0.6 เทสต์ระบบที่ยังไม่มี** (qa) แยกไฟล์: economy (ซื้อ/ขาย/ราคาตก/ภาษีเข้า `toPot`), arcade (เริ่ม/ออกโต๊ะ/คืนเดิมพันตอนหลุดและ `arcRefundAll`), social (เทรด escrow คืนของตอนยกเลิก/หลุด), cinema (จ่ายค่าตั๋ว/ปิดเมื่อไม่มีคนดู) • เสร็จเมื่อ: ผ่าน 5 รอบติด
- **1.0** (server-dev) `server/util.js` (`send`, `logEv`+`EVENT_DIR`, `rand`, `replacer`) วาง require ตรงตำแหน่งเดิมเพื่อคงลำดับ side effect + `server/mixin.js` (D3) • golden ไม่เปลี่ยน
- **1.1 lotto** 14 เมธอด 1194–1263 (~70 บรรทัด) แยกง่ายจริง: เรียกออกไปแค่ `starterOf` (progression) + บริการกลาง; ถูกเรียกจาก join (1494), `case 'lotto'` (1651), `tick` (3218), `loadTown`, `save`, snap (691) ซึ่งใช้ได้เหมือนเดิมเพราะ `this` เดิม • ต้อง `require('crypto')` ในไฟล์ระบบ
- **1.2 cinema** (1832–~1875 + `EMPTY_MS`) state เริ่มต้นยังอยู่ใน constructor จนขั้น 2 • **1.3 arcade** ใหญ่สุด (~900 บรรทัด 2290–3197 + แต้มตู้ 484–516 + `payKey`) แตก 4 commit: `arcade/core.js` `uno.js` `party.js` `duel.js` ต้องทำหลัง 0.4/0.6 • ต่อจากนั้นตามลำดับเดิม npc → pets → house → … → core สุดท้าย
- ประตูทุก commit ขั้น 1: `node --check` + เทสต์ทั้งหมด + golden + check-structure + code-reviewer • ขั้น 2–4 เขียนแผนย่อยแยกเมื่อขั้น 1 จบ

## 7. ความเสี่ยงและการถอย
- ย้ายผิดที่ทำให้ลอจิกเปลี่ยนเงียบๆ → golden + `mix()` โยน error ชื่อซ้ำ ถอย `git revert` commit ระบบนั้น เซฟใช้ได้ต่อเพราะรูปแบบไม่เปลี่ยน (ขั้น 0–3 ถอยไม่ต้องคืนข้อมูล)
- golden เปราะ (ทุกการเปลี่ยนลำดับการสุ่มทำให้พัง) — ตั้งใจให้เป็นแบบนั้นในขั้น 1 ถ้าพังห้าม `GOLDEN_UPDATE` เพื่อให้ผ่าน ต้องหาว่าย้ายอะไรผิด
- deploy: ไฟล์ใน `server/`, `shared/`, `server.js`, `public/shared.js` ทำให้ restart → ผู้เล่นออนไลน์หลุดทุกคน ไม่มีต่อใหม่อัตโนมัติ (game.js:89 แสดงกล่องหลุด ต้องรีเฟรช) ตอนปิด SIGTERM เรียก `arcRefundAll` + `save(true)` ของไม่หาย แต่การตกปลา/เทรด/รอบหนังที่ค้างหายไป → รวม deploy เป็นชุด (หลายระบบต่อครั้ง) ช่วงคนน้อย ดูจำนวนออนไลน์จากเมนูผู้ดูแลก่อน และรัน `deploy.sh --check` ก่อนเสมอ
- health ผ่านแต่ลอจิกเพี้ยน → deploy.sh ไม่ย้อนเอง ต้อง `git revert` + deploy ใหม่ (ไม่ต้องคืน data ในขั้น 0–3)
- ขั้น 4 เท่านั้นที่ต้องคืนข้อมูลจาก `backup/pre-deploy/` หากถอย และออกแบบให้โค้ดเก่าอ่านไฟล์ใหม่ได้

## 8. คำตัดสินของเจ้าของ (6 พ.ย. 2026)
1. D1 ยืนยัน: `shared/` ที่ราก + route `/shared/` ใน server.js
2. `weekKey` เก็บแบบ ISO (ลบตัวที่บรรทัด 485)
3. deploy ช่วง refactor: ทีละระบบ ช่วงคนน้อย ตัดสินเวลาจริงก่อน deploy แต่ละครั้ง (ดูจำนวนออนไลน์ + `deploy.sh --check` ก่อนเสมอ)
4. commit `tools/golden/expected.json` ได้ (ข้อมูลโลกจำลอง ไม่มีผู้เล่นจริง ไม่มี IP)
กติกาทำงาน: ทำทีละข้อ จบแต่ละข้อหยุดรอเจ้าของตรวจก่อนข้อต่อไป ตั๋วอยู่ที่ `docs/tasks/refactor-step0-tests.md`
