# ห่วงโซ่ผลิตเฟสแรก (WP-30) — ตั๋วแตกงาน

- ประเภท: feature + balance (ไม่เปลี่ยนรูปแบบเซฟ xpv คง 8)
- ผู้ขอ: ผู้ดูแล   วันที่: 2026-11-14 • แผนหลัก `docs/plans/production-chain.md` (ตัวเลข/ตัวเลือก O-1..O-10)
- ไฟล์นี้อยู่ `docs/plans/` เพราะ architect เขียนได้ที่นี่เท่านั้น ให้โปรดิวเซอร์ย้ายเป็น `docs/tasks/production-chain.md`
- **เริ่มโค้ดได้เมื่อ:** เจ้าของตอบ O-1..O-10 และ E0 ลงนามตัวเลข

## ต้องการอะไร (มุมผู้เล่น)
นักขุดเอาแร่ไปหลอมที่ร้านช่างเหมืองเป็นแท่ง/อัญมณีเจียระไน ขายให้คนที่จะซื้ออุปกรณ์ระดับ 8–10 หรือให้ช่างไม้ทำเฟอร์นิเจอร์ชั้นดี ชาวนาอัดแครอท/ข้าวโพดเป็นหญ้าแห้งขายคนเลี้ยงสัตว์ ใครไม่มีเพื่อนอาชีพนั้นออนไลน์ก็ยังซื้อทุกอย่างจากร้านได้ ราคาอุปกรณ์รวมไม่แพงกว่าวันนี้

## เกณฑ์ว่าเสร็จ
- [x] ซื้ออุปกรณ์ 8–10 โดยไม่มีวัสดุ จ่ายเหรียญเท่า `TOOL_PRICE`/`CANS.price` วันนี้ทุกระดับทุกสาย • ขายคืน/ซ่อม/ซื้อใหม่ ตัวเลขเดิม (S1 implement + Q1 test)
- [x] หลอม/อัดฟาง ทำได้ด้วยปุ่ม Action (เปิดร้าน) + ปุ่มในแท็บ บนมือถือและ PC (C1 + แท็บมือถือแก้แล้ว; ประดิษฐ์เฟอร์ฯ = S3 ยังไม่ทำ)
- [x] levelsim/econsim: ทุกอาชีพ ≤ ~125% ของชาวนาทุกเลเวลทั้งโหมดไม่มีห่วงโซ่และโหมดห่วงโซ่ (E0 simulate OK)
- [x] `tools/test-workshop.js` + `test-workshop-play.js` + `check-structure` • golden ไม่เปลี่ยน

## ตำแหน่งในโค้ด (ตรวจแล้วที่ 137c9b1)
- `public/shared.js:708–718` ORES • `:922–939` DURABILITY/TOOL_PRICE • `:1083–1094` CANS • `:1566–1594` CRAFT/craftFee • `:1545–1552` BOOK • `:1607–1620` SHOPS • `:1623–1680` itemInfo • `:1684–1689` sellback/tradeValue/isTradable • `:1920` SELLABLE
- `server/systems/market.js:44–73` buy • `:109–128` sellback • `server/systems/crafting.js:24–36` craft • `server/systems/achievements.js:50–60` bookAdd
- `server.js:351–352, 378` case cook/craft/buy • `:478–480` Action เปิดร้าน • `:744` mix crafting
- `public/game.js:1670–1676` SHOP_TABS/buyTabOf • `:1801` แถวอุปกรณ์ • `:1878–1890` แท็บสร้าง

## งานตามลำดับ (ไฟล์ชน: shared.js S1→S3, game.js C1→C2 ทำทีละ agent ต่อไฟล์)
**E0 economy-designer (ก่อนโค้ด แตะ `tools/levelsim.js` `tools/econsim.js` เท่านั้น)** — ซิมแล้วตอบในแผนหลักข้อ 4 (14 พ.ย. 2026 ผู้ดูแลอนุมัติแล้ว + เจ้าของลงชุด O-1..O-10):
1. นักขุด Lv15–19: ถ้าขายวัสดุที่ 1.1/1.25/1.4× std (หักภาษีแผง 7%) ตามดีมานด์จริง (นับผู้เล่นจริง Lv13+ แต่ละอาชีพจาก `tools/realplayers.js`) รายได้กี่ % ของชาวนา (ต้อง ≤ ~125%, ตอนนี้ ~115%)
2. `shopMul` 1.3/1.5/2.0 กับ `share` 0.15/0.25/0.30: คืนทุนอุปกรณ์ทั้งทางร้านและทางผู้เล่นยัง ≤ 1.2 ชม. และเพดานปั๊มขายคืน (s < 0.45) มีระยะเผื่อ
3. คนเลี้ยงสัตว์ทุกเลเวล เมื่อ hay ราคา 12/18/22/24 (วัว Lv3 อ่อนไหวสุด) ยัง ≤ 120–125%? ถ้าเกิน เสนอ `std` ของ hay หรืออัตราอัดฟางใหม่
4. ชาวนา: อัดฟาง (แครอท1→1, ข้าวโพด1→2) เทียบขายผักตอนหมวดผักอิ่มตัว (CATFAT 30–100%) ได้มากกว่ากี่ % และมีเลเวลไหนเกินเป้า
5. ช่างไม้ Lv9–19 กับเฟอร์นิเจอร์ 6 ชิ้น: ราคา (≈2× วัตถุดิบ std) XP (คิดจากไม้) ให้ 85–120% และไม่มีช่องซื้อ XP ด้วยเหรียญ
6. ค่าเตาหลอมรวม/วัน (เงินจม) และ `ms` 2000 กินเวลานักขุด ≤ 5% ของชั่วโมง • 7. (ถ้า O-7 ทำ) ปลาป่น: ปลาราคา < 20 กี่ตัวต่ออาหารไก่ 1 ไม่ให้ชาวประมงหรือคนเลี้ยงไก่เกินเป้า

**S1 server-dev** `public/shared.js` ทั้งหมด: `BAR_TUNE` `BARS` (ลูปจาก `ORE_ORDER`) `itemInfo` สาขา `bar_` (ไม่มี `sell`) • `GEAR_BARS` `gearBars` `gearCost(item, inv)` • `WORKSHOP` (st forge/bale, สูตรหลอม 10 + อัดฟาง 2) `makeCheck` • `SHOPS.mine.buy` += bar_* • export • อีโมจิวัสดุ 10 ตัว อีโมจิเดี่ยวไม่ซ้ำของใดในเกม (ตรวจกับ PICK/HOE/PAIL/PAN/AXE/ROD/CANS_EMOJI) — ทดสอบ: `node --check` + test-cave test-economy test-golden ผ่าน (ยังไม่มีคนเรียก)
**Q1 qa-tester** (หลัง S1) `tools/test-workshop.js` pure: ทุกคีย์ใน in/out มี itemInfo • 3×ore.sell < std < shop • `gearCost` ไม่มีวัสดุ = ราคาเดิมเป๊ะ ทุกสาย×ระดับ 8–10 • share จริง ≤ 0.30 • ระดับ 1–7 ไม่มีวัสดุ • bar_* / hay ไม่อยู่ `SELLABLE` • `isTradable(bar_*)` true • หลังเฟอร์นิเจอร์ (S3): วัตถุดิบ std ≥ 1.2 × FURN_SELL × ราคา
**S2 server-dev** (หลัง S1) ใหม่ `server/systems/workshop.js`: `make(p, id, n)` ตรวจตามแผนข้อ 7 • หักวัตถุดิบ (ผักเก่าก่อน + ตัวคูณความสดสำหรับ st bale) • ค่าเตา `add(coin,-fee,'makefee')`+`toPot` • ผลผลิต (`once` = มีแล้วห้ามทำ, คีย์ใน DURABILITY = รีเซ็ต dur/fix) • `p.mkReady[st]` + `send mkcd` • `logEv(room,'make',{p,id,n,fee})` • `event(p,'make')` • `server.js` `case 'make'` + `mix` • `market.js` buy: ถ้า `gearBars(item)` → `gearCost` หักวัสดุแล้วเหรียญ toast บอกที่ใช้/เติม — ทดสอบ: test-workshop test-economy test-persist test-golden check-structure
**Q2 qa-tester** (หลัง S2) `tools/test-workshop-play.js` ผ่าน World: หลอมต้องอยู่ร้านช่างเหมือง/เลเวลถึง/ของพอ/เหรียญพอ/รอ cooldown • n นอกช่วงหรือ id แปลก (`__proto__`, ตัวเลข) ไม่พัง • เหรียญเข้ากอง • ซื้ออีเต้อ 10 มีวัสดุครบ/ขาดบางส่วน/ไม่มี ได้เหรียญตรง `gearCost` • ขายคืนยัง 70%×สภาพของราคาเดิม • อัดฟางผักสด/เก่า • ป้อนวัวด้วย hay ที่อัดเองได้ • เทรด/ฝากแผงวัสดุได้ • โหลดเซฟที่มี bar_* และ furn ใหม่ด้วยโค้ดก่อนห่วงโซ่ (checkout 137c9b1 ในโฟลเดอร์ชั่วคราว) ไม่พังทั้งเซิร์ฟเวอร์และ renderer บ้าน
**C1 client-dev** (หลัง S1 พร้อม S2 ได้) `public/game.js`: `SHOP_TABS.mine` = 🧰 อุปกรณ์ 🔥 หลอม 🧱 วัสดุ 💰 ขาย • `farm` += 🌾 อัดฟาง • ตัววาดเดียว `renderMake(st)` (การ์ดแบบเมนูเชฟ: ชิปวัตถุดิบ มี/ขาด ปุ่ม ×1 ×5 ×10 สูง ≥ 44px ปิดตอน cooldown) • `buyTabOf` วัสดุอยู่ 🧱 • แถวอุปกรณ์ 8–10 โชว์ "🪙เหรียญ + ชิปวัสดุ (มี n/ต้อง m) • ขาดเติม 🪙x" จาก `Shared.gearCost` • รับ `mkcd` • ข้อความไทยสบายๆ — ux-reviewer มือถือ/แท็บเล็ต/PC
**S3 server-dev** (หลัง E0 + P2 ส่งชื่อฟังก์ชันวาด) shared: `FURN` 6 ชิ้น (`noshop`, `nobook` ตาม O-8) + `CRAFT` 6 แถว (XP จากส่วนไม้) • `BOOK.furn` กรอง `nobook` — ทดสอบ: Q1 ข้อเฟอร์นิเจอร์ + test-house + test-golden
**P1 pixel-artist** (พร้อม C1 ได้) `public/pixelui.js`: วาดวัสดุ 3 ทรง (อิฐ แท่ง อัญมณีเจียระไน) + จานสี 10 ตามอีโมจิคีย์ S1 • **P2** `public/pixelfurn.js` เฟอร์นิเจอร์ 6 ชิ้นตาม STYLE_GUIDE ข้อ 8 (0 เครดิต PixelLab) • **C2 client-dev** (หลัง P1) ผูกไอคอนในกระเป๋า/ร้าน/แผง — ux-reviewer
**R1 server-dev** `tools/chain-rollback.js <ไฟล์ห้อง>`: bar_* และ furn ใหม่ (กระเป๋า + วางในบ้าน) → เหรียญตาม std พิมพ์สรุปต่อบัญชี ไม่แตะอย่างอื่น — Q2 ทดสอบกับสำเนา
**D1 doc-writer** GAME-DESIGN (ห่วงโซ่ ตาราง BAR) • HOW-TO-PLAY (หลอม อัดฟาง ซื้ออุปกรณ์ด้วยวัสดุ) • README • ECONOMY-PLAN (เงินจมค่าเตา ร้านวัสดุ) • ประกาศในเกม
**ส่งท้าย:** code-reviewer ทั้ง diff → โปรดิวเซอร์ commit ทีละไฟล์ → deploy แยกรอบ (ไม่รวมกับงานที่ย้ายเซฟ)

## บันทึก / คำตัดสินใจ
- ไม่ต้อง migration: ราคา/คีย์/ความทนเดิมไม่แตะ ของใหม่เป็นคีย์ใหม่ล้วน (แนวเดียวกับ WP-23) • ถอยกลับ = `chain-rollback.js` → `git revert` → deploy
- โครง WORKSHOP เผื่อ Dungeon: สถานีใหม่ = เพิ่ม `st` + สูตร ใน shared, โค้ดโครงรองรับ `once`/รีเซ็ตความทนแล้ว ห้ามเพิ่ม `if` เฉพาะสูตรใน workshop.js
- ห้ามแก้ golden ด้วย `GOLDEN_UPDATE=1` ถ้าเปลี่ยนต้องอธิบายสาเหตุให้ code-reviewer

## สถานะปัจจุบัน (16 พ.ย. 2026)
- **S1–Q2 + C1:** เสร็จ (shared BARS/WORKSHOP/gearCost • workshop.js make • market gearCost • game แท็บหลอม/อัดฟาง • test-workshop + test-workshop-play ผ่าน • code-reviewer OK)
- **S3 เฟอร์นิเจอร์ 6 + P1/P2/C2:** ยังไม่ทำ (นอกสไลซ์โต๊ะหลอม)
- **D1 เอกสาร:** เสร็จ GAME-DESIGN / HOW-TO-PLAY / README / HANDOFF ส่วน forge/bale
- **ส่งท้าย:** รอเจ้าของสั่ง commit / push / deploy — แล้วค่อยเริ่มโค้ดดันเจี้ยน

## ข้อแก้หลังซิม E0 (ทำตามนี้ ทับข้อความด้านบน)
- S1: `gearCost` ใช้ `Math.floor` ส่วนวัสดุ (`share` ≤ 0.25) • `hay` มูลค่ามาตรฐาน 44 • เฟอร์นิเจอร์ใหม่ `nobook`
- Q1: เพิ่มเทสต์ H1 (เครดิตวัสดุ ÷ ราคา ≤ 0.25 ทุกอุปกรณ์ + ซื้อ→ขายคืนไม่กำไร) • H4 (ขายวัสดุให้ระบบถูกปฏิเสธ)
- S3: ใส่ `nobook` + เทสต์ `bookAdd` ไม่จ่ายซ้ำ (H3)
- E1 (หลังปล่อย): รัน `economy.js 7` กับข้อมูล VPS แทนค่าสมมติ X ในซิม (H7) เฝ้า H5/H6 สองสัปดาห์
- รายละเอียดช่องโหว่ H1–H7: `docs/plans/production-chain.md` หัวข้อท้ายไฟล์
- สถานะ: **เจ้าของอนุมัติแผน 14 พ.ย. 2026 + สั่งเริ่ม S1 16 พ.ย. 2026** — ลำดับ: ทำก่อนเริ่มโค้ดดันเจี้ยน • `st.smith` ของดันเจี้ยนอยู่ที่หอคอย (แยกจาก `st.forge` ที่นี่)
