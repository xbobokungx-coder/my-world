# แผน Refactor: แยกระบบให้แก้เป็นส่วนๆ ได้

สรุปจากการวิเคราะห์โค้ดจริง (พ.ย. 2026, commit ล่าสุดตอนวิเคราะห์ ~328 commits) ใช้คู่กับ `docs/plans/AGENTS-PLAN.md`
หลักการสูงสุด: **ย้ายโค้ด ไม่เขียนใหม่ พฤติกรรมเกมต้องเหมือนเดิมทุกขั้น** ทุกขั้นต้องผ่านเทสต์ทั้งหมด + golden test

---

## 1. สภาพปัจจุบัน

| ไฟล์ | ขนาด | ปัญหา |
|---|---|---|
| `server.js` | ~3,780 บรรทัด | `class World` ตัวเดียว ~3,300 บรรทัด **375 เมธอด** รวมทุกระบบ, `handle()` เป็น `switch` 83 case, `act()` ~175 บรรทัด, `tick()` ~137 บรรทัด |
| `public/game.js` | ~4,165 บรรทัด | IIFE เดียว ฟังก์ชัน ~250 ตัว ตัวแปรระดับบน ~235 ตัว `step()` ~248 บรรทัด ใช้ `innerHTML` 52 จุด |
| `public/shared.js` | ~1,550 บรรทัด | ข้อมูลเกม + กติกา + แผนที่ ปนกัน |

จุดที่เจอระหว่างวิเคราะห์ (ต้องจัดการในขั้น 0):
- **`weekKey()` ประกาศซ้ำสองที่ใน `World`** (ราวบรรทัด 474 และ 871) ตัวหลังทับตัวแรกเงียบๆ ต้องดูว่าตัวไหนคือที่ตั้งใจแล้วเหลือตัวเดียว
- **โค้ดคาสิโนค้าง** ทั้งที่ยกเลิกแล้ว: `server.js` ~44 จุด (เช่น `casinoHandle`), `game.js` ~7 จุด
- **`cropTick` เรียก `JSON.stringify` ทุกช่องฟาร์มทุก 1 วินาที** เพื่อเทียบว่าเปลี่ยนไหม (แก้ทีหลังได้ ไม่เร่ง)
- **ไฟล์เซฟไม่มีเลขเวอร์ชัน/ระบบ migration กลาง** (มี `layout: 2` แบบเฉพาะกิจ)
- ไฟล์ `gitignore` (ไม่มีจุด) ซ้ำกับ `.gitignore`
- `public/_theme/` (~6 MB) ถูกเสิร์ฟสาธารณะ มีภาพ `ref*.png` ที่อาจเป็นภาพจากเกมอื่น

ข้อดีที่ต้องรักษา: server-authoritative, ค่าสมดุลรวมใน shared, เซฟแบบ atomic (เขียน `.tmp` แล้ว rename), เทสต์ 13 ไฟล์ผ่านหมด, `module.exports = { World }` ใช้เขียนเทสต์ได้โดยไม่เปิดเซิร์ฟเวอร์, มี `this.event(p, ev, arg)` ใช้เป็น hook อยู่แล้ว (เรียก 26 จุด 21 ชนิด เช่น harvest fish sell mine plant cook craft trade)

---

## 2. หลักการแบ่งระบบ

1. **หนึ่งระบบ = หนึ่งไฟล์** ใช้ชื่อเดียวกันทั้งสามฝั่ง: `server/systems/lotto.js` • `public/client/systems/lotto.js` • `shared/data/lotto.js`
2. **ระบบเป็นเจ้าของ state ของตัวเอง** (เช่น lotto ดูแล `this.lotto`, arcade ดูแล `this.tables`) ไม่แตะ state ระบบอื่นตรงๆ
3. **ระบบคุยกันผ่านบริการกลางเท่านั้น:** `inv` (เพิ่ม/หักของ), `xp`, `toast`, `broadcast`, และ event bus (`event()` เดิม) ให้ progression/village เป็นผู้ฟัง แทนการเรียกข้ามระบบ
4. ไฟล์ระบบควรยาวไม่เกิน ~500 บรรทัด ถ้าเกินให้แตกย่อย (เช่น `arcade/uno.js`)

## 3. โครงสร้างเป้าหมาย

```
server/
  index.js        # http + ws + ห้อง (ส่วนท้าย server.js ตอนนี้)
  world.js        # แกนกลาง: players, tick loop, registry ของระบบ, บริการกลาง
  dispatch.js     # ตาราง ชนิดข้อความ → handler ของระบบ (แทน switch)
  persist.js      # save/load + เลขเวอร์ชันเซฟ + migration
  admin/          # rooms, bugs, layout, auth (PIN, admin key, rate limit)
  systems/        # ตามตารางหัวข้อ 4
shared/
  data/           # ตัวเลขสมดุลแยกตามระบบ (crops fish animals wear furn cabinets market ...)
  rules/          # กติกาที่สองฝั่งใช้ร่วม (houseCheck, cropStage, แมพ)
public/client/
  main.js net.js state.js input.js
  systems/        # UI + การวาดของแต่ละระบบ ชื่อตรงกับฝั่ง server
  render/         # pixel*.js เดิม
```
ยังเสิร์ฟ `public/` เป็น webroot ไม่มี build step ฝั่ง Node ใช้ `require` ฝั่งเบราว์เซอร์ใช้ ES modules (`<script type="module">`)
`shared/` ต้องเสิร์ฟให้เบราว์เซอร์ด้วย (เพิ่ม route หรือวางไว้ใต้ `public/shared/`) ให้ architect ตัดสินใน `docs/plans/refactor.md`

## 4. แบ่งระบบจาก `World` (บรรทัดเป็นค่าประมาณ ณ ตอนวิเคราะห์ ให้ Explore ยืนยันก่อนย้าย)

| ระบบ | เมธอดเดิม | state ที่เป็นเจ้าของ | เทสต์เดิม |
|---|---|---|---|
| core | join/leave/handle, toast, add/lots, addXp, pub, broadcast, save (1403–1510, ~3351) | players, saved, dirty | test-persist |
| scene | mapOf, blockedFor, applyMapOv, paintCells, changeScene, warpTo (253–341) | mapOv | test-warp |
| farm | cropTick, cropLocked, rent*, ต้นไม้ | farm, rents, treeKind/treeHp/treeCap | test-trees |
| fishing + sea | reelFish, fightAdvance, fightEnd, landFish, castFish, sea* (2017–2114) | – | test-fight, test-sea |
| mining | initCave…caveMove, oreTick, caveAct, pickAct (197–252, ~1975–2016) | ore/cave | test-cave, test-ore-mix |
| house | loadHouse…houseAct, houseHandle (148–196, 279–441) | houses | test-house |
| animals | herdOf, spawnAnimal, loadHerd, ป่วย (1346–1392) | animals | test-herd |
| pets | initPets, pet* (821–869, 1643–1695) | – | test-pet |
| npc | initNpcs…npcTick (757–820) | – | – |
| economy | ตลาด, buy/sell/sellback, ธนาคาร, ออเดอร์ (1318–1342, 1913–1975, 1099–1125) | market, mktDay | **ไม่มี** |
| energy | พลังงาน ความล้า ความหิว (644–700, 1874–1897) | – | – |
| tools | ความทนทาน ซ่อม (1704–1758) | – | – |
| progression | เควส ความสำเร็จ starter ชาเลนจ์ สมุด streak (507–635, 878–1033, 1148–1172, 1253–1274) | stats | test-ach-give, test-starter |
| village + events | 726–756, 928–965 | village, evt, week | – |
| social | เทรด แผงลอย ของขวัญ (1034–1098, 1759–1819) | stall | **ไม่มี** |
| arcade | ตู้เกม UNO duel party XO (2290–3197) | tables | **ไม่มี** |
| lotto | 1180–1252 | lotto | test-lotto |
| cinema | 1820–1858 | cinema | **ไม่มี** |
| cooking | cook, craft (1275–1317) | – | – |
| admin/rooms/bugs/layout | ส่วนท้ายไฟล์นอก class | – | – |

## 5. สัญญาของแต่ละระบบ (เป้าหมายขั้น 2)

```js
// server/systems/lotto.js
module.exports = {
  name: 'lotto',
  init(w) { w.lotto = { round: 0, tickets: {} }; },   // สร้าง state slice
  load(w, d) { ... },  save(w) { ... },                // เซฟ/โหลดเฉพาะส่วนตัวเอง
  handlers: { lottobuy(w, p, m) { ... } },             // ชนิดข้อความที่ระบบนี้รับ
  tick(w, now, dt) { ... },
  on: { sell(w, p, arg) { ... } },                     // สมัครรับ event
};
```
ฝั่ง client ใช้รูปแบบเดียวกัน: handler ของข้อความจาก server + ฟังก์ชันวาด/UI

## 6. ขั้นตอน

### ขั้น 0 — ตาข่ายนิรภัย (ห้ามข้าม)
- [ ] ลบโค้ดคาสิโน (server + client) แล้วรันเทสต์
- [ ] แก้ `weekKey()` ซ้ำ: หาว่าที่เรียกใช้คาดหวังรูปแบบไหน เหลือตัวเดียว เพิ่มเทสต์สั้นๆ
- [ ] **golden test** `tools/test-golden.js`: คัดลอกเซฟตัวอย่าง (สร้างจากเกมใหม่ใน DATA_DIR ชั่วคราว หรือไฟล์สำรองที่ลบ IP ออกแล้ว) → `new World(...)` → ยิงข้อความชุดตายตัว (เข้าเกม เดิน ปลูก รดน้ำ เก็บเกี่ยว ตกปลา ขาย ซื้อ วางของในบ้าน ซื้อหวย) → รัน tick จำนวนคงที่ด้วยเวลาปลอม → เทียบ JSON state กับ `tools/golden/expected.json` (ตัดฟิลด์ที่สุ่มหรือเป็นเวลาออก) ครั้งแรกบันทึก expected แล้วหลังจากนั้นต้องตรงทุกครั้ง
- [ ] เทสต์ระบบที่ยังไม่มี: economy (buy/sell/ราคา), arcade (เริ่มโต๊ะ/ออกจากโต๊ะ/คืนเงินเดิมพันตอนหลุด), social/trade (escrow คืนของตอนยกเลิก/หลุด), cinema
- [ ] `tools/check-structure.js`: ตรวจชื่อเมธอดซ้ำข้ามไฟล์ระบบ + `node --check` ทุกไฟล์ (ใช้ตอนขั้น 1)
- [x] ล้างของค้าง (ทำแล้ว): ลบ `gitignore` ซ้ำ, ย้าย `public/_theme/` ไป `art/theme-samples/` (ยังไม่ลบภาพ `ref*` รอเจ้าของตัดสินว่าภาพไหนไม่ใช่ของเรา), ย้ายเอกสารแผนที่รากเข้า `docs/` และอัปเดตลิงก์แล้ว

### ขั้น 1 — ย้ายแบบ mixin (เสี่ยงต่ำสุด)
ตัดเมธอดของระบบหนึ่งไปไว้ `server/systems/<ระบบ>.js` แล้วต่อกลับด้วย
`Object.assign(World.prototype, require('./server/systems/<ระบบ>'))`
`this` เหมือนเดิมทุกอย่าง จึงเป็นการย้ายไฟล์ล้วนๆ
- ทีละระบบ **หนึ่งระบบ = หนึ่ง commit** ทุกครั้งรัน: `node --check`, เทสต์ทั้งหมด, golden test, check-structure
- ลำดับ: lotto → cinema → arcade → npc → pets → house → mining → fishing/sea → animals → farm → cooking → tools → energy → social → economy → village/events → progression → scene → core เป็นอันดับสุดท้าย
- ห้ามแก้ลอจิกระหว่างย้าย เจออะไรแปลกให้จดลง `docs/tasks/` แยก

### ขั้น 2 — ขีดเส้นขอบเขต
- `dispatch.js`: แต่ละระบบลงทะเบียน `handlers` แทน `switch` ใน `handle()` ทีละกลุ่มข้อความ
- `World.tick` วนเรียก `tick` ของทุกระบบ
- เปลี่ยน `this.event` เป็น bus ที่ progression/village สมัครรับ
- ให้ระบบเข้าถึง state ผ่าน slice ของตัวเอง

### ขั้น 3 — client และ shared
- แยก `game.js` ตามชื่อระบบด้วย ES modules (เริ่มจาก UI panel ที่แยกง่าย: shop bag quests admin trade arcade)
- แตก `shared.js` เป็น `shared/data/` กับ `shared/rules/`
- ระหว่างแยก ให้ escape ข้อความผู้เล่นก่อนใส่ `innerHTML` (หรือเปลี่ยนเป็น `textContent`)

### ขั้น 4 — persist
- เพิ่มเลขเวอร์ชันไฟล์เซฟ + migration ในที่เดียว (`persist.js`) แต่ละระบบ save/load slice ตัวเอง
- สำรองข้อมูลก่อน deploy ขั้นนี้ และทดสอบ migration กับไฟล์สำรองจริงก่อน

### หลังเสร็จ
อัปเดตขอบเขตไฟล์ใน `.claude/agents/*-dev.md` ให้ชี้ `server/systems/`, `public/client/systems/`, `shared/data/` แล้วเปิดให้ dev ทำงานขนานกันได้

## 7. ใครทำอะไร
- `architect`: เขียน `docs/plans/refactor.md` จากไฟล์นี้ (ตัดสินเรื่องเสิร์ฟ shared/, ชื่อบริการกลาง)
- `qa-tester`: ขั้น 0 ทั้งหมดที่เป็นเทสต์ + รันทุกขั้น
- `server-dev`: ลบคาสิโน, weekKey, ขั้น 1–2, 4
- `client-dev`: ขั้น 3
- `code-reviewer`: ทุก commit
- ช่วงขั้น 0–1 ทำทีละ agent เพราะยังเป็นไฟล์ใหญ่ไฟล์เดียว
