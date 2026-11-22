# ตั๋ว: เปิดร้านอาวุธ (ดาบไม้) + ร้านชุดเกราะ (ชุดเกราะไม้) — ร่าง 22 พ.ย. 2026 • ฐาน `7eceecb` xpv 8
> architect เขียนได้เฉพาะ `docs/plans/` → โปรดิวเซอร์คัดลอกไป `docs/tasks/wood-sword-armor.md` ได้ทันที (เนื้อหาเดียวกัน)

## 1. เป้าหมาย / ไม่ใช่เป้าหมาย
- **เป้า:** ร้านอาวุธ (BUILDINGS `weapon` shared.js:1390) ขาย 🗡️ ดาบไม้ `sword_1` • ร้านชุดเกราะ (`armor` :1392) ขาย 🦺 ชุดเกราะไม้ `armor_1` (1 ชุดเต็ม) • ซื้อ / ถือในมือ / สวมบนตัว / ขายคืน 70% ได้ • ผู้เล่นอื่นเห็น
- **ไม่ใช่เป้า:** ไม่มีผลการต่อสู้ ไม่มีความทน/ซ่อม (`DURABILITY.sword/armor` ไปทำตอน J5 ของ `jungle-map.md` พร้อมระบบ `combat`) ไม่มีระดับ 2–10 ไม่แจกฟรี ไม่เทรด
- **ยกเลิกข้อห้าม:** "ห้ามเพิ่ม SHOPS.weapon" ใน `town-plaza-tree.md:28` และคอมเมนต์ shared.js:1389/1391 ถูกยกเลิกตามคำสั่งเจ้าของเกม
- ชื่อคีย์ `sword_1` `armor_1` ตรงกับ `dungeon-100-spec.md:286` และ `jungle-map.md:65` (หอคอย/ป่าใช้ต่อได้เลย)

## 2. ระบบที่แตะและเจ้าของ
| ระบบ | ไฟล์:บรรทัด | งาน | เจ้าของ |
|---|---|---|---|
| shared data | `public/shared.js` ใกล้ :432 (หลัง AXES) | `WEAPON = { sword: { 1: { name:'ดาบไม้', price:60 } } }` • `ARMOR = { 1: { name:'ชุดเกราะไม้', price:120 } }` • `SWORD_EMOJI = {1:'🗡️'}` `ARMOR_EMOJI = {1:'🦺'}` • `swordTier(inv)` `armorTier(inv)` (แบบ `axeTier` :433) • export :2126 | server-dev |
| itemInfo | shared.js:1729–1730 (ต่อจากขวาน) | `sword_N` → `{name, emoji, buy, once:true, cat:'gear', sword:N}` • `armor_N` → `{..., cat:'gear', armor:N}` ไม่มี `lv` ไม่มี `sell` | server-dev |
| SHOPS | shared.js:1690–1703 | `weapon: { name:'⚔️ ร้านอาวุธ', skill:null, buy: Object.keys(WEAPON.sword).map(t=>'sword_'+t), sell:[] }` • `armor: { name:'🛡️ ร้านชุดเกราะ', skill:null, buy: Object.keys(ARMOR).map(t=>'armor_'+t), sell:[] }` (แบบ vehicle :1698) | server-dev |
| BUILDINGS | shared.js:1389–1392 | ลบ `closed:` ทั้งสองร้าน + แก้คอมเมนต์ • พิกัดไม่ขยับ (ผัง/golden/hash ไม่เปลี่ยน) | server-dev |
| market | `server/systems/market.js:94–98` buy • :147–152 sellback | ซื้อ `armor_N` = สวมให้เลย `p.rec.wear.arm = N` + `broadcastLook` • ขายคืนชิ้นที่สวม = ถอด (`delete rec.wear.arm`) • `once` กันซื้อซ้ำอยู่แล้ว (:50) • ขายคืน `sellbackValue` 70% (:1768) ไม่ต้องแก้ | server-dev |
| look/join | `server.js:189–195` join • :328–341 `look` | join: `rec.wear.arm` ไม่มีของจริงใน inv → ลบ • look: รับ `m.wear.arm` เป็น 0 (ถอด) หรือ N ที่ `inv['armor_'+N] > 0` เท่านั้น | server-dev |
| act | `server.js:32` `TOOLS` • :283–289 • :585 ท้าย act | เพิ่ม `'sword'` ใน TOOLS → ผ่านสาขามือเปล่าเดิม (เก็บไข่/เก็บผัก/ตู้/ร้าน/นั่ง ใช้ได้ = ปุ่ม Action ใช้ได้เสมอ) • ท้าย act `else if (tool==='sword')` toast จำกัด 1 ครั้ง/30 วิ "🗡️ ยังไม่มีอะไรให้ฟัน รอเปิดป่าดงดิบนะ" • :284 `onShop` ให้นับ `'sword'` เหมือน `'hand'` (ขี่รถแล้วกดร้านไม่โดนลง) • `heavyAction` energy.js:36 ไม่แตะ (ดาบไม่ใช่งานหนัก) • caveAct mining.js:106 / seaAct fishing.js:42 ไม่แตะ (ไม่ใช่อีเต้อ/เบ็ด = ไม่ทำอะไร) | server-dev |
| hotbar/doll | `public/game.js:21` TOOL_LIST/TOOL_SHORT • :70 toolLocked • :1551 toolInfo • :1589 heldEmoji • :1854–1885 doll | `'sword'` ต่อท้าย TOOL_LIST, `TOOL_SHORT.sword='ดาบ'`, ล็อกเมื่อ `!swordTier(inv)` • toolInfo สาขาดาบ (`cnt:null`) • doll: ช่องใหม่ `armor` "เกราะ" คอลัมน์ขวาใต้โล่ → แถบ "สวม/ถอด" ส่ง `look {wear:{arm}}` • ร้าน: ทางทั่วไป renderShop :2167–2213 ใช้ได้เลย (ไม่มี SHOP_TABS, `once` → "มีแล้ว ✅" + ปุ่มขายคืน :837) | client-dev |
| วาดตัวละคร | `public/pixelchar.js:138–144` | คีย์แคช :142 เพิ่ม `wr.arm` • `build()` วาดเกราะทับเสื้อเมื่อ `wr.arm` | pixel-artist |
| ของในมือ | `game.js:4295–4330` drawHeldTool • `pixelaction.js:26` kindOf | สาขา `isSword` (ใบไม้ ด้ามพันเชือก) • kindOf `🗡` → `'chop'` (ยืมท่าขวานตาม jungle-map ข้อ 9) | pixel-artist |
| ไอคอน | `public/pixelui.js` ใกล้ :130 | `'🗡️'(x)` `'🦺'(x)` วาดมือ 13×13 (ก่อนวาด PixelUI แปลงอีโมจิเป็นพิกเซลอัตโนมัติอยู่แล้ว ใช้ได้ทันที) | pixel-artist |

## 3. โปรโตคอล (ไม่มีข้อความใหม่)
- C→S `buy {item:'sword_1'|'armor_1'}` `sellback {item}` เดิม • `act {tool:'sword', tx?, ty?}` เดิม (ตรวจ TOOLS) • `look {wear:{..., arm:0|N}}` เพิ่มฟิลด์ `arm` (ตรวจ: จำนวนเต็ม, 0 หรือมีของจริง; ค่าอื่นทิ้งเงียบ)
- S→C `look`/`held` เดิม: `wear.arm` ติดไปกับ wear เอง • `held e:'🗡️'` ผ่าน regex server.js:297 (ต้องเช็กด้วยเทสต์ว่าผ่าน `️?`)

## 4. เซฟ / xpv
- **ไม่ bump xpv (คง 8)**: เพิ่มล้วน `inv.sword_1` `inv.armor_1` `rec.wear.arm` • ไม่ใส่ `arm` ใน `WEAR_DEFAULT` (เซฟ/golden ผู้เล่นเดิมไม่ต่าง) • ไม่มีฟิลด์เดิมเปลี่ยนความหมาย
- ถอยกลับโค้ดเก่า: `wear.arm` โค้ดเก่าไม่อ่าน (join :192 วนเฉพาะ WEAR cats) • **ต้องเช็ก** โค้ดเก่าเจอคีย์ inv ที่ `itemInfo` = null แล้วไม่พัง (`game.js` renderBag, `holdingsValue` shared.js:1772 ข้ามแล้ว, `S.kindOf`) ถ้าพัง → สคริปต์ถอย `tools/wsa-rollback.js` ย้ายสองคีย์ไป `rec.wsaPark` • ops สำรอง `backup/pre-deploy/` ก่อน deploy

## 5. เศรษฐกิจ
- ดาบไม้ 🪙60 (= อีเต้อ/เบ็ด ระดับ 1, ขวานหิน 50) • ชุดเกราะไม้ 🪙120 (สองเท่า เพราะชุดเต็ม; สเปกหอคอยให้ ≈ อีเต้อ×1.5 ต่อชิ้น) ตัวเลขอยู่ shared เท่านั้น
- เป็นตัวดูดเหรียญครั้งเดียว (ไม่สร้างเหรียญ) • ขายคืนได้ 70% = 42/84 < ราคา → วนซื้อ-ขายขาดทุนเสมอ • ไม่มีความทน = ไม่มีช่องโหว่รีเซ็ตความทน • `once` → เทรด/แผงไม่ได้ (`isTradable` :1875) เก็บลังได้ไม่ได้ตามกติกา box • ไม่ต้องรัน econsim; economy-designer แค่ยืนยันตัวเลข (S)
- ตอน J5: เพิ่ม `DURABILITY.sword` + regex sellback market.js:141 / game.js:2098 ให้รวม `sword` (ไม่งั้นขายคืนดาบพังได้ราคาเต็ม)

## 6. ลำดับงาน (ทีละขั้น จบด้วย `tools/check-all.sh`)
| ขั้น | งาน (ส่งให้) | ขนาด | เทสต์ที่พิสูจน์ |
|---|---|---|---|
| W1 | shared ข้อ 2 แถว 1–4 + market + look/join + TOOLS/toast (server-dev) | S | ใหม่ `tools/test-weapon-armor.js`: ยืนหน้าประตูแต่ละร้าน act → `{t:'shop',kind}` • ซื้อ sword_1/armor_1 หักเหรียญตามตาราง • ซื้อซ้ำ = "มีอยู่แล้ว" • เหรียญไม่พอไม่ได้ของ • ซื้อเกราะ → `wear.arm=1` + broadcast look • look arm ปลอม (ไม่มีของ/9/"x") ไม่เปลี่ยน • ขายคืนได้ 42/84 และถอดเกราะ • join ลบ arm ที่ไม่มีของ • act tool sword ที่ร้าน/ผักสุก ทำงานเหมือน hand • `held` 🗡️ ผ่าน • **แก้** `test-closed-shop.js` (:11–13 ตอนนี้ weapon/armor เปิด → เปลี่ยนเป็นทดสอบกลไก closed ด้วยร้านปลอมที่ push ชั่วคราวลง BUILDINGS แล้วเอาออก) • `test-town-ring` ผ่านไม่แก้ (ข้อ 5 ประตู weapon/armor ต้องได้ร้านตัวเอง; HOUSE_DOOR (29,15) ห่าง counter ใหม่ 115px > 110 — ระยะเฉียด จดไว้) • `test-kinds` ผ่าน (**ต้องเช็ก** `S.kindOf` ของ `cat:'gear'` ได้ 'tool') • `test-gear` :186–191 อีโมจิไม่ซ้ำ • golden ต้องไม่ต่าง |
| W2 | hotbar ดาบ + doll ช่องเกราะ + คีย์แคช pixelchar (client-dev) | S | `node --check` • dev: ซื้อ→ถือ→กด Space ที่ร้าน/ผัก ใช้ได้ • ไม่มีดาบ = 🔒 • สวม/ถอดในแผง • อีกแท็บเห็นเกราะ/ดาบ |
| W3 | ไอคอน 🗡️ 🦺 + ดาบในมือ + เกราะบนตัว 4 ทิศ (S/E/N พลิก W) วาดด้วยโค้ด ตาม STYLE_GUIDE (pixel-artist) | M | ภาพบน dev + `__mw.actionSheet()` ท่าฟัน • ไม่ต้องใช้ PixelLab |
| W4 | economy-designer ยืนยันราคา • `code-reviewer` (แตะ server/เซฟ/เงิน) • `ux-reviewer` แผง doll มือถือ/PC ≤ 25 เทิร์น • doc-writer GAME-DESIGN/HOW-TO-PLAY/README + หมายเหตุใน `town-plaza-tree.md`/`jungle-map.md` ข้อ 6 | S | check-all ผ่าน |
- W2 และ W3 ทำขนานได้ยกเว้น `pixelchar.js` (W2 แตะแค่คีย์แคช :142 → ให้ W3 ทำแทนทั้งไฟล์ถ้าชนกัน)

## 7. ความเสี่ยงและการถอย
| เสี่ยง | แก้ / ถอย |
|---|---|
| ผู้เล่นซื้อแล้วคิดว่ามีผลต่อสู้ | ชื่อสินค้า/ป้าย: "(ยังไม่มีผล รอป่าดงดิบ)" ใน itemInfo name + toast ตอนฟัน |
| ดาบอยู่ใน TOOLS แล้วกระทบสาขาอื่น (ขี่รถ/หิว/เหนื่อย) | เทสต์ W1 act ด้วย sword เทียบ hand ทุกสาขาเมือง |
| คีย์แคช pixelchar ลืม arm → เกราะค้าง/ไม่ขึ้น | เพิ่มคีย์ใน W2 ก่อนวาด W3 |
| ถอยทั้งหมด | revert + ใส่ `closed` คืน (ร้านกลับเป็นปิด เซฟไม่แตะ ของยังอยู่ใน inv) • ร้ายแรง: `wsa-rollback.js` ก่อนสตาร์ตโค้ดเก่า |
