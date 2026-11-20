# ที่เก็บของในบ้าน + ผลเฟอร์นิเจอร์ (ตั๋วงานย่อย)

- ประเภท: feature (แตะเซฟ/ความสด/เศรษฐกิจ → ทุกสไลซ์ฝั่ง server ต้องผ่าน `code-reviewer`, งาน UI ใหญ่ต้องผ่าน `ux-reviewer` 360×640 + PC)
- ผู้ขอ: เจ้าของเกม   วันที่: 2026-11-21
- แผนหลัก: `docs/plans/home-storage-buffs.md` (อ่านข้อ 3–8 ก่อนเริ่ม) • **เริ่มได้หลังเจ้าของตอบคำถามข้อ 11** (ถ้าตอบต่างจากข้อเสนอ แก้ตัวเลข/กฎใน `HOME` ไม่ต้องแก้โครง)
- กติกาทุกสไลซ์: ตัวเลขอยู่ใน `HOME` ใน `public/shared.js` เท่านั้น • ข้อความผู้เล่นภาษาไทยสบายๆ • แก้ตรงจุด ไม่จัดรูปแบบไฟล์ใหม่ • ไม่ commit (โปรดิวเซอร์ commit) • จบสไลซ์ต้อง `tools/check-all.sh` ผ่าน

## ต้องการอะไร (มุมผู้เล่น)
กด Space/A ที่ตู้เย็นในบ้านแล้วเก็บผัก ปลา ไข่ นม อาหาร เข้าไปได้ ของในตู้สดนานขึ้นจริง หยิบออกมาขาย/ทำอาหารได้ • ลังไม้/ตู้เก็บวัตถุดิบได้ • บ้านที่ตกแต่งดีนั่งพักฟื้นอิ่มไวขึ้น นอนแล้วได้บัฟหลับสบาย เห็นผลก่อนซื้อและตอนอยู่ในบ้าน

## ตำแหน่งในโค้ด (ตรวจแล้ว 21 พ.ย.)
- `public/shared.js:127` `FURN.fridge` • `:62` `houseScore` • `:1064–1068` `FRESH perishable freshTier freshMuls freshCount` • `:1110` `PLAYER_HUNGER.sitGain` • `:1493` `BUFFS` • `:1717` `itemInfo` (`cat`) • `:1784` `isTradable`
- `server/systems/house.js:14` คืนตู้ตอนโหลด (เขียน inv ตรง) • `:116–155` place/move/rot/remove (`hplace` ไม่มี arg) • `:158` `houseAct` (นั่ง/นอน) • `:170` `hasFridge`
- `server/systems/core.js:41` `creditInv` • `:95` `add` • `:107–117` `lotsOf lotPut lotTake freshPub`
- `server/systems/market.js:107`, `server/systems/workshop.js:65` ส่ง `hasFridge` เข้า `freshMuls` • `server/systems/stall.js:10,37,68` (ไม่นับตู้เย็นอยู่แล้ว / เขียน inv ตรง) • `server/systems/rank.js:39` มูลค่าทรัพย์สิน
- `server.js:41` `HOUSE_MSG` • `:66–74` ลูปย้ายเซฟตอนโหลด • `:181` สร้างบัญชีใหม่ • `:194,334` ตรวจชุดที่มี • `:276–278` act ในบ้าน → `houseAct` • `:613–615` tick ความหิว/นั่ง • `:729` `save()`
- `public/game.js:601–606` `freshSt` (`fz`) • `:609` `tidyShopRows` • `:917` `FLEA_GRPS fleaGrpOf` • `:1610` `BAG_SORTS` • `:1679` `renderBag` • `:2183` `houseAct` (Action ในบ้าน) • `:4891` `houseIsoClick` (แตะของในบ้าน)

---
> **สถานะ 21 พ.ย. 2026:** S1 ลงโค้ดแล้ว (commit แยก ผ่าน code-reviewer) **ห้าม deploy จนกว่า S2 (หน้าต่างคลัง) + S7 (`tools/store-unstash.js` + แก้เอกสารตู้เย็นเดิมที่ GAME-DESIGN.md:443,506 / HOW-TO-PLAY / README) เสร็จ** เพราะ S1 ตัดผลตู้เย็นเดิมแล้วแต่ยังไม่มี UI เก็บของ และ toast ย้ายข้อมูลชวนให้กดตู้เย็น

## S1 — server-dev: คลังเย็นฝั่งเซิร์ฟเวอร์ + ตัดผลตู้เย็นเดิม + ย้ายข้อมูล + มูลค่าอันดับ
ไฟล์: `public/shared.js`, `server/systems/storage.js` (ใหม่), `server/systems/core.js`, `server/systems/house.js`, `server/systems/market.js`, `server/systems/workshop.js`, `server/systems/rank.js`, `server.js`, `server/mixin.js`/รายการ mix (ถ้าต้องลงทะเบียน), `tools/economy.js`
1. shared: `HOME.store = { cold: { furn: { fridge: 60 }, max: 4, mul: 0.25, accept: 'fresh' }, box: { furn: { crate: 80, cupboard: 60, dresser: 60, toolbox: 60, barrel: 40, nightstand: 20 }, max: 6, accept: 'dry' } }` + `storeAccepts(pool,k)` (cold = `perishable`; dry = มี itemInfo, ไม่ perishable, ไม่ `once`, ไม่ใช่ coin/pet/animalbuy) + `storeAge(tv, pool, now)` = `(pool.at − tv) + (now − pool.at) × pool.r` + `storeCap(items, pool)` (นับตู้ชนิดนั้นสูงสุด `max` ใบ) + `storeValue(store)` (มูลค่าแบบ `holdingsValue`) • export ทั้งหมด
2. `storage.js`: `storeOf(rec)` (สร้าง lazy) • `storeSync(key, rec)` (อัตราจริง = `mul` ถ้ามีตู้เย็นวาง ไม่งั้น 1; ต่างจาก `r` → rebase `tv = now − อายุ`, `at = now`) • `storeHandle(p, m)` a: open/put/take/putall/takeall ตามตารางแผนข้อ 6 • put: `taken = this.add(p, k, -n)` → แปลงแต่ละกอง `[t,n]` อายุ `now − max(t, FRESH.startAt)` → `tv` • take: `lotTake` แบบในคลัง (เก่าก่อน) → `this.add(p, k, n, 'store', [[now − อายุ, n], ...])` • ของไม่เสีย (box) ไม่มี lots • ส่ง `{ t:'store', ... }` หลังทุกคำสั่ง • ล้าง `p.storeAt` เมื่อเปลี่ยนฉาก/ออกนอกระยะ • `storeBlocksRemove(key, f)` คืนข้อความถ้าถอดแล้วความจุ < ของในคลัง • `storeOnEvent(p, ev, arg)` รับ `hplace/hremove` ของตู้ → `storeSync`
3. ตัดผลเดิม: `freshPub` ส่ง `fz:false` (คงฟิลด์ไว้ให้เว็บเก่า) • `market.js:107` / `workshop.js:65` ส่ง `false` แทน `hasFridge` • `hasFridge` ใช้เฉพาะใน storage (หรือแทนด้วย `storeCap`)
4. house.js: `hplace` ส่ง `f` เป็น arg • remove เรียก `storeBlocksRemove` ก่อน (เตือน "ตู้ยังมีของ X ชิ้น หยิบออกก่อนหรือวางตู้เพิ่ม") แล้ว `event(p,'hremove', f)` • `core.event()` เรียก `this.storeOnEvent(p, ev, arg)` ต่อท้ายลำดับเดิม (อย่าสลับลำดับเดิม golden เห็น)
5. ย้ายข้อมูล: หลัง `loadHouse` ใน constructor วนทุก rec ที่ไม่มี `frz`: ถ้าบ้านมีตู้เย็น → `rec.lots[k]` ทุกกอง `t' = now − (now − max(t, startAt)) × 0.5` • ตั้ง `rec.frz = 1` ทุก rec • บัญชีใหม่ (`server.js:181`) มี `frz:1` • log `[migrate] ตู้เย็นเดิม: ย้ายอายุ N บัญชี` • toast ครั้งเดียวตอนเข้าเกมสำหรับคนที่ถูกย้าย (`rec.frzNote`)
6. `HOUSE_MSG` เพิ่ม `'store'` + case `'store'` → `this.storeHandle(p, m)` • `rank.js:39` บวก `S.storeValue(r.store)` • `tools/economy.js` นับของในคลังรวมทรัพย์สิน
- เทสต์ (qa-tester เขียน `tools/test-storage.js` คู่กัน): เก็บ/หยิบรักษาผลรวม `inv + คลัง` และ `sum(lots) == inv` ทั้งสองฝั่ง • ของอายุ 20 ชม. เก็บ 40 ชม. → หยิบออกยัง "สด" (20+10) และกระเป๋าหลังหยิบแก่ต่อปกติ • **วางตู้เย็นก่อนขายไม่เปลี่ยนราคาของในกระเป๋า** (เทียบ `sell` ก่อน/หลังวาง) • เก็บของไม่เสียเข้าคลังเย็นไม่ได้ • ของ `once`/coin เก็บไม่ได้ • เกินจุไม่ได้ • คนมาเยี่ยม/อยู่ไกล/ไม่ได้ open เปิดไม่ได้ • ถอดตู้เย็นใบสุดท้ายขณะมีของ = ถูกปฏิเสธ • ตู้ถูกคืนตอนโหลด → ของยังอยู่ หยิบได้ อัตรากลับเป็น 1 จากจุดนั้น • ย้ายข้อมูล: รันโหลดสองรอบ อายุไม่ถูกหารซ้ำ บัญชีไม่มีตู้เย็นไม่เปลี่ยน • persist: เซฟ/โหลด `rec.store` ครบ • rank นับมูลค่าในคลัง • ใช้ `FRESH_START`/สลับ `Date.now` แบบ test-golden
- เทสต์เดิมที่ต้องผ่าน: `test-house` `test-stall` `test-workshop*` `test-economy` `test-golden` `test-persist`

## S2 — client-dev: หน้าต่างคลังเย็น + ปุ่ม Action
ไฟล์: `public/game.js`, `public/index.html` (CSS เท่าที่จำเป็น)
1. `houseAct` (`:2183`): หาเป้าหมายใกล้สุดรวม "ตู้ใน `HOME.store`" กับที่นั่ง/เตียง (ระยะ 2.5 ช่องเดิม) → ตู้ = `send({t:'store', a:'open', i})` • `houseIsoClick` (`:4897`): แตะตู้ = เปิด/เดินไปก่อนแบบเก้าอี้ (เฉพาะบ้านตัวเอง บ้านคนอื่นแตะแล้ว toast "ตู้ของเจ้าของบ้าน")
2. รับ `t:'store'` → modal "❄️ ตู้เย็น" หลอด `ใช้ x/y` แถว `.row` + `tidyShopRows` (ไอคอน ชื่อ ×จำนวน ป้ายสด 🟢🟡🔴 จาก `S.storeAge` → `freshTier` ด้วยอายุ ปุ่ม [1] [ทั้งหมด]) • PC สองคอลัมน์ ในตู้ | ในกระเป๋า (เฉพาะที่ `storeAccepts`) • มือถือเป็นแท็บ • ปุ่ม "เก็บของสดทั้งหมด" / "หยิบทั้งหมด" • Space/Enter = กดปุ่มที่โฟกัส, Esc ปิด, ลูกศรเลื่อนโฟกัส • ปุ่ม ≥44px ที่ 360×640
3. `freshSt.fz` เลิกใช้ (ปล่อย false) • tooltip `:606` เปลี่ยนเป็น "เก็บในตู้เย็นช่วยชะลอ"
- เทสต์: `node --check public/game.js` • ux-reviewer ตรวจ 360×640, 768×1024, 1366×768 (เปิดด้วย Space/A, แตะ, ไม่ทับ HUD/ปุ่มมือถือ) • qa-tester: ถ้ามีเทสต์ client-ish (`test-closed-shop` แบบ) เพิ่มกรณีข้อความ store ไม่ทำให้เว็บพัง

## S3 — server-dev + client-dev: คลังของ (ลัง/ตู้)
- server: เปิด pool `box` (โค้ด S1 รองรับแล้ว เปลี่ยนแค่ข้อมูล/เปิดใช้) • ตรวจว่าลังที่วางบนหลังของอื่น (`on`) ยังเปิดได้ตามระยะ
- client: modal เดียวกับ S2 หัวข้อ "📦 คลังของ" ไม่มีป้ายสด ปุ่ม "เก็บวัตถุดิบทั้งหมด" (ไม่เก็บเมล็ด/เหยื่อ อัตโนมัติ — ของที่ใช้บ่อย)
- เทสต์ (`test-storage.js` เพิ่ม): ของเสียเข้าคลังของไม่ได้ • เฟอร์นิเจอร์ยังไม่วางเก็บได้ หยิบออกมาวางได้ • เครื่องมือ `once` ปฏิเสธ • ความจุรวมหลายชนิดตู้ + เพดาน `max`

## S4 — client-dev (+ server-dev ส่วน shared): หมวดของชุดเดียว
ไฟล์: `public/shared.js`, `public/game.js`
1. shared: `KINDS` (9 หมวดตามแผนข้อ 5 พร้อม emoji/ชื่อ) + `kindOf(k)` จาก `cat`+`perishable` (`bar` → วัตถุดิบ, `shoot` → ของสด, `meal_` → อาหาร, `bait`/`recall` → สิ้นเปลือง) • ย้าย `fleaGrpOf` → `S.jobOf` (ย้ายตัวเนื้อ ไม่เขียนใหม่ เว็บเรียกผ่านชื่อเดิมได้)
2. กระเป๋า: ปุ่มสลับ "จัดตาม: ชนิด | อาชีพ" (`ls mw_bag_mode`) ชิปตามโหมด • คลัง: ชิปชนิด เรียง ชนิด → เก่าก่อน → ชื่อ
- เทสต์ (เพิ่มใน `test-storage.js` หรือ `tools/test-kinds.js`): ทุก key ใน `SELLABLE` + ของร้านทุกชิ้นได้หมวดที่ไม่ใช่ undefined • `jobOf` ให้ผลเท่าเดิมทุก key (เทียบตารางก่อนย้าย)

## S5 — server-dev + client-dev: ความสบาย + ป้ายผล
1. shared: `HOME.comfort = { pts: { def: 1, lux: 2, luxPrice: 900, rare: 3 }, cap: { living: 6, bedroom: 6, kitchen: 6, decor: 6, study: 4, craft: 4, rare: 4, divider: 2 }, tiers: [0, 6, 14, 24], names: [...], sitMul: [1, 1.5, 2, 2.5] }` + `houseComfort(items)` → `{ v, tier, sets }` (ชนิดไม่ซ้ำ ตัดเพดานหมวด)
2. server: house เก็บแคช comfort ต่อบ้าน (ล้างใน `setItem/delItem` เหมือน `hrects`) • `server.js:615` นั่งในบ้าน (`p.scene` เป็นบ้าน ไม่ใช่ถ้ำ) ได้ `sitGain × sitMul[tier]` สะสมเศษใน `p.sitAcc` • ขั้น 0 ต้องเหมือนเดิมเป๊ะ • ส่ง `hcomfort` ตอนเข้าบ้าน/วาง/ถอด
3. client: ชิป `🏠 สบาย 14 · อบอุ่น` ในบ้าน แตะ/Action เปิดรายละเอียด (ผลตอนนี้ ขั้นถัดไปขาดอะไร) • การ์ดร้านเฟอร์นิเจอร์/ช่างไม้แสดงป้าย `❄️ +60` `📦 +80` `✨ สบาย +N` • (ถ้าเจ้าของเลือก ข้อ 8) ลีดเดอร์บอร์ดบ้านเพิ่มคอลัมน์ความสบาย
- เทสต์ `tools/test-home-comfort.js`: วางต้นไม้ 50 ต้น = สบาย 1 • หมวดตัดที่เพดาน • ขั้นถูกตามเกณฑ์ • นั่งในบ้านขั้น 2 ฟื้น ×2 ใน 5 วิ • ม้านั่งในเมืองเท่าเดิม • `test-golden` ไม่เปลี่ยน

## S6 — server-dev + client-dev: บัฟหลับสบาย + ชุดห้อง
1. shared: `HOME.rest = { lieMs: 60000, mul: 0.75, mins: [0, 15, 25, 35] }`, `HOME.sets = { kitchen: {...need, eatMul: 1.2}, bedroom: {..., restMul: 1.5}, living: {..., sitTier: 1}, study: {..., comfort: 2} }`
2. server: นอนเตียง *บ้านตัวเอง* ครบ `lieMs` → `rec.rest = now + นาที` (ต่อเวลาได้ ไม่สะสม) toast 😴 • tick ความหิว: ถ้า `rec.rest > now` ลดช้าลงตาม `mul` (ไม่ซ้อน `BUFFS.hunger` ใช้ตัวที่ลดมากกว่า) • กินในบ้านที่มีชุดครัว อิ่ม ×`eatMul` (ใน `hunger.eat` อ่านจาก house ผ่านเมธอดอ่านอย่างเดียว) • ส่งเวลาบัฟในข้อความ `hcomfort`/สถานะ
3. client: ไอคอนบัฟ 😴 นับถอยหลังแบบบัฟเดิม • รายละเอียดชุดห้อง "ครัว 2/3 ขาด เตาแก๊ส"
- เทสต์ (`test-home-comfort.js` เพิ่ม): นอน 59 วิ ไม่ได้ / 60 วิ ได้ • นอนบ้านคนอื่นไม่ได้บัฟ • บัฟไม่สะสมเกินค่าขั้น • ไม่ซ้อนกับ `BUFFS.hunger` • ชุดครัวกินแล้วอิ่มเพิ่ม 20% ไม่เกิน 100

## S7 — server-dev + doc-writer: เครื่องมือถอยกลับ + เอกสาร (ต้องเสร็จก่อน deploy S1)
- `tools/store-unstash.js <data/main.json>`: ย้าย `rec.store` ทุกคลังกลับ `inv` + `lots` (อายุ `now − storeAge`) ลบ `rec.store` พิมพ์สรุป • ใช้เมื่อปิดเซิร์ฟเวอร์และสำรองแล้วเท่านั้น • เทสต์: เซฟจำลอง → unstash → ผลรวมของเท่าเดิม
- `docs/OPS.md` ส่วนย้อนโค้ด: ขั้นตอนสำรอง → unstash → ถอย • `GAME-DESIGN.md:443,506` `HOW-TO-PLAY.md:81,198` `ECONOMY-PLAN.md:157` เปลี่ยนคำอธิบายตู้เย็น + เพิ่มคลัง/ความสบาย
- ops (เมื่อผู้ใช้สั่ง): นับบัญชีที่วางตู้เย็นบน VPS ก่อน deploy (อ่าน houses ด้วยสคริปต์ ไม่แก้ไฟล์)

## S8 — (รอเจ้าของ) คลังเสื้อผ้า
- ต้องมี `S.owns(rec, k)` = inv หรือคลัง ใช้แทน `rec.inv[wearKey]` ที่ `server.js:194,334` + ร้านกันซื้อซ้ำ/ขายคืนของ `once` • เทสต์: ชุดในตู้ยังสวมได้/ไม่ถูกถอดตอนเข้าเกม ซื้อซ้ำไม่ได้

## economy-designer (ขนานกับ S1 ก่อน deploy)
- ซิม coldMul 0.25 vs 0.5 กับความจุ 60×4: เหรียญ/ชม.ที่เพิ่มจากรอราคาฟื้น (ใช้ `tools/econsim.js`) ต้องไม่เกินกรอบ ECONOMY-PLAN • ความสบาย/บัฟ: ประหยัดค่าอาหารต่อชม. สูงสุด (ขั้น 3 + ชุดครบ) เทียบราคามื้อ • ความจุลังไม้เทียบราคาทำ (ดีมานด์ช่างไม้) • ส่งตัวเลขสุดท้ายเป็นแก้ `HOME` ใน shared

## pixel-artist (ไม่บังคับ ขนานได้)
- `public/pixelfurn.js`: ท่าเปิดประตูตู้เย็น/ฝาลัง (เฟรมเดียว แสดงตอน modal เปิด) ตาม STYLE_GUIDE ข้อ 8 • ไอคอนหมวด 9 อันใน `pixelui.js` (ขนาดเดียวกับไอคอนของเดิม) • 4 ทิศเท่านั้นตามกติกาภาพ

## เกณฑ์ว่าเสร็จ (รวม)
- [ ] เก็บ/หยิบผ่าน Space/A และแตะได้ทั้งมือถือและ PC • [ ] ของไม่หายทุกกรณี (ถอดตู้ คืนตู้ตอนโหลด ย้ายข้อมูล ถอยโค้ด) • [ ] ช่องโหว่วางตู้ก่อนขายหายพร้อมเทสต์ • [ ] ขั้นความสบาย 0 = พฤติกรรมเดิม • [ ] เทสต์ใหม่+เดิมผ่าน `tools/check-all.sh`
