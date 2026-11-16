# ข้อมูลชั้น `DG_FLOORS` + `DG_KINGDOM` + `DG_SEAL` (สคีมาสำหรับ shared.js) — ร่าง 15 พ.ย. 2026

ต้นทาง: `dungeon-100-floors.md` ข้อ 1/3/7/8 • ร่างข้อมูล `tools/dungeon-floors.draft.json` (100 แถว จากซิมรอบ 3) • มอนสเตอร์ `dungeon-100-monsters.md`
ตำแหน่ง: `public/shared.js` บล็อก `// ===== DUNGEON =====` (ไม่แยกไฟล์ เพราะ `deploy.sh` รีสตาร์ตตาม `^public/shared\.js`)

## 1. สิ่งที่ย้ายจาก JSON → shared และสิ่งที่ไม่ย้าย
- **ย้าย (กติกา):** ต่อชั้น `f r k kind seals[]` • ต่ออาณาจักร `piecePrice partyLootMul chestCoins questSetCoins xp` + `params.repairMul travelMul hpPartyPerExtra bossMul partyModel.gScale`
- **ไม่ย้าย (ผลซิม ใช้ตรวจเท่านั้น):** `tSolo t2 t4 kills pieces chestUnits offerItems deathLossSec hoursSolo piecePriceRefit105 countMul lengthMul` และบล็อก `fatigue priceCheck cores campRisk partySensitivity partyTotals` — เก็บใน JSON ให้ `dungeonsim` ใช้ต่อ
- `countMul`/`lengthMul` **คูณไว้ใน `n` แล้ว** (ตัวเลขในผนึกคือค่าจริง) ห้ามคูณซ้ำในโค้ด • `chestUnits` แปลงเป็น `DG.chest[kind]` (ค่าย 0.5 • ปกติ อ.1–3 1.25 / อ.4–9 1.75 / อ.10 2.25 • มินิ 2 • บอส 4 • ชั้น 100 6 • เมือง/ค่ายใหญ่ 1) ไม่เก็บรายชั้น
- **เวลาย้าย:** ทั้ง 100 แถวเข้า shared ในขั้น D2-S1 ครั้งเดียว (ตรวจถูกต้องทั้งตารางตั้งแต่แรก) แต่ประตูหอคอยเปิดถึง `DG.open` (D2 = 10, D3 = 40, D4 = 70, D5 = 100) • แก้ราคา อ.1 5 → **4** ตอนย้าย (ข้อ 8.5) แล้วรันซิมซ้ำให้ JSON ตรง

## 2. สคีมา
```js
DG_KINGDOM[r] = {            // r = 1..10 (ช่อง 0 = null)
  name, ore,                 // 'โพรงหิน', 'stone' (ore = ระดับวัสดุ/แท่งสำหรับตีเหล็ก)
  mech,                      // '' | 'dark' | 'poison' | 'mirror' | 'vine' | 'water' | 'cold' | 'rite' | 'shadow' | 'mix'
  seals,                     // ผนึกต่อชั้นปกติ 1 | 2 | 3
  piece, chest, quest,       // ราคาชิ้นส่วน • เหรียญต่อหน่วยหีบ • เหรียญชุดเควส
  xp: { norm, elite, mini, boss },
  partyLoot: { 2, 3, 4 },    // ตัวคูณของตกต่อคน (แทนโบนัส +10/13/15%)
  repairMul,                 // ตัวคูณค่าซ่อมจากตาย
  travel,                    // ตัวคูณระยะผนึกห่างจุดเริ่ม (makeDgMap ใช้วางผนึก)
  pool: ['rslime','cbat','crat'], keyEl: 'ratboss', mini: 'bigslime', boss: 'slimeking'
}
DG_FLOORS[f] = {             // f = 1..100 (ช่อง 0 = null)
  r, k,                      // คำนวณได้จาก f แต่เก็บไว้ให้ตรวจไขว้
  kind,                      // 'camp' | 'norm' | 'mini' | 'boss' | 'final' | 'town'
  seals: [ { t, ...พารามิเตอร์ } ]   // ต้องครบทุกอันจึงเปิดประตู • ลำดับ = ลำดับวางบนแผนที่ (ไกลขึ้นเรื่อยๆ)
}
```
ชื่อชนิดชั้นในภาษาไทยของ JSON (`ค่ายสอน` `ปกติ` …) แปลงเป็นรหัสอังกฤษข้างบน ข้อความไทยอยู่ `DG_TXT`

## 3. ผนึก (`DG_SEAL[t]` = ค่าเริ่ม + ผู้ทำ: `split` = แยกทีมทำขนานได้ / `all` = ทั้งปาร์ตี้)
| t | ชื่อ | พารามิเตอร์ในแถวชั้น | ค่าเริ่ม/กติกาใน `DG_SEAL` | ทำ |
|---|---|---|---|---|
| K | ค่าย | `act` ('fire' 'lamp' 'pot' 'mirror' 'axe' 'soup' 'incense' 'pool') | ทุกคนทำเองครั้งเดียว • ไม่มีมอนสเตอร์ • เป็นจุดเซฟ | all |
| Kt | ค่ายสอน (ชั้น 1) | `hits` 5 `dodge` 1 | จุดกองไฟ + ตีหุ่นซ้อม + หลบเส้นเตือน 1 | all |
| Kv | เมืองใต้ดิน (51) | — | คุยผู้เฒ่า + กองไฟใหญ่ • ร้าน ช่างตี ตู้เก็บของ | all |
| Kb | ค่ายใหญ่ (91) | `need` 9 | ลงชื่อสมาชิก แสดงเศษแสงของแต่ละคน | all |
| Ks | ค่ายเล็กท้ายชั้น (97) | `at:'end'` | ★ เลือกพักเอง 45–60 วิ (ซิมใช้ 75) • เป็นจุดเซฟ | all |
| A | กวาดล้าง | `n` ตัว • `hazard?` | ระลอก ≤ `DG.wave.max` 18 • n ≤ 33 | split |
| B | กุญแจ | `adds` | ตัวถือ = `DG_KINGDOM[r].keyEl` อยู่ฝั่งเดียวกับประตู (K5) • หลุด = เกิดใหม่ห้องเดิม | split |
| EB | อีลีทถือกุญแจ | `adds` `el?` | เหมือน B แต่ตัวถือเป็นอีลีทตั้งชื่อ (ตาราง monsters ข้อ 3) | split |
| C | ป้องกันแท่น | `waves` `size` `hazard?` | HP แท่น `DG.altar.hp[r]` • แท่นแตก = เริ่มคลื่น 1 ใหม่ ไม่มีโทษอื่น • size ≤ 18 | split |
| D | รอด | `n` วินาที `mech?` | สภาวะตาม `DG_KINGDOM.mech` (มืด/ฝน/พายุ/น้ำขึ้น/คาถา) • ล้มทั้งทีม = เริ่มนับใหม่ | all |
| E | ล่าหัวโจก | `n` ตัว `adds` `el?` | ไม่ระบุ el = อีลีทสุ่มจาก pool | split |
| F | ปริศนา | `n` ขั้น `puz` | puz: plates rail colors mirror switch bells incense lotus ice water shadowpos • ผิด = ซุ่ม `DG.puz.failMobs` 3 ตัว แล้วลองใหม่ | split |
| G | บุกเร็ว | `n` วินาที `mobs` | ต้องปราบ = round(mobs × (1 + 0.5(คน−1))) เวลาเท่าเดิม • ไม่ทัน = รอบใหม่ ไม่มีโทษ | all |
| H | เครื่องเซ่น | `n` ชิ้น `cats` `alt` | cats จากหมวด itemInfo (veg fish egg ore wood food mushroom) • **ต้องมี `alt`** (ผนึกสู้แทน เช่น `{t:'A',n:18}`) | split |
| I | กลไกอาณาจักร | `n` ขั้น `mech` `hazard?` | mech: glow detox lamp mirror vine seed water fish stove icecrys jade shadow | split |
| L | ศาลเจ้า | `n` ตัว (เลือกพร) `nNo` | ไม่เลือก = nNo (≈ n×1.4) • พร/คำสาปจาก `DG_SHRINE` | all |
| S | เงา | `n` ตัว | shade 1 ตัวต่อเป้า ใช้อาวุธเจ้าของเงา | split |
| M | มินิบอส+ค่าย | `mb` `adds` | ปราบแล้วเปิดค่าย = จุดเซฟ (ชั้น 95 รวม) | all |
| X | บอส | `boss` | ลานบอส ไม่ใช่จุดเซฟ | all |
| Z | บอสสุดท้าย | `boss:'dark'` `need` 9 | ประตูเช็กเศษแสงรายคน • คนขาดเข้าลานไม่ได้ (ไม่บล็อกเพื่อน) | all |
- `hazard:true` = สภาวะของอาณาจักรทำงานระหว่างทำผนึก (ซิมคิดเวลา ×1.2) • ชั้น 92–99 ใช้ `mech` ที่ระบุในผนึก I (ยืมจากอาณาจักร 2–9)
- **ผนึกคงอยู่หลังล้ม (ต้องยืนยัน):** ผนึกที่เสร็จแล้วเก็บใน `room.sealDone` (RAM) ล้มทั้งทีมกลับค่าย → ชั้นที่กำลังทำ **รีเซ็ต** (floors ข้อ 1.5) ส่วนชั้นที่ผ่านแล้วไม่ต้องทำซ้ำ (ซิมสมมติแบบนี้) • ไม่เซฟลงไฟล์ ออกเกม = ชั้นนั้นเริ่มใหม่
- **รางวัลเสริม** สุ่มต่อชั้นจาก `DG.bonus` = [ไม่โดนตีเกิน 3 ครั้ง, ผ่านก่อน ×0.8 ของเวลาเป้า, อีลีทเสริม 1] → หีบเสริม 0.5 หน่วย

## 4. ตาราง `DG_KINGDOM` (ค่าจากซิมรอบ 3 + ข้อ 8)
| r | ชื่อ / ore / mech | ผนึก | piece | chest | quest | xp n/e/m/b | partyLoot 2/3/4 | repairMul | travel |
|---|---|---|---|---|---|---|---|---|---|
| 1 | โพรงหิน / stone / — | 1 | 4 | 15 | 510 | 5/15/40/100 | 1.10/1.05/1.05 | 1 | 1.75 |
| 2 | ท่อเหมืองทองแดง / copper / dark | 1 | 8 | 30 | 830 | 7/21/56/140 | 1/1/1 | 1 | 1.25 |
| 3 | ป่าเห็ดเงิน / silver / poison | 1 | 14 | 55 | 1280 | 11/33/88/220 | 1/1/1 | 0.7 | 1.25 |
| 4 | ถ้ำอเมทิสต์ / amethyst / mirror | 2 | 17 | 75 | 1710 | 11/33/88/220 | .95/.95/.90 | 0.5 | 1.1 |
| 5 | ป่าลึกมรกต / emerald / vine | 2 | 20 | 115 | 2130 | 13/39/104/260 | 1/.95/.90 | 0.38 | 1.1 |
| 6 | ทะเลสาบโอปอล / opal / water | 2 | 28 | 155 | 2860 | 16/48/128/320 | 1/.95/.95 | 0.32 | 1.05 |
| 7 | ธารน้ำแข็งไพลิน / sapphire / cold | 2 | 35 | 190 | 3350 | 23/69/184/460 | .95/.95/.90 | 0.25 | 1.2 |
| 8 | วัดหยก / jade / rite | 2 | 43 | 220 | 3460 | 32/96/256/640 | 1/.95/.90 | 0.18 | 1.05 |
| 9 | ทะเลทรายมูนสโตน / moonstone / shadow | 2 | 46 | 235 | 3770 | 33/99/264/660 | 1/1/.95 | 0.14 | 1.5 |
| 10 | ปราสาทมิทริล / mythril / mix | 3 | 59 | 290 | 4110 | 47/141/376/940 | .90/.85/.80 | 0.11 | 1.05 |
ค่ากลางใน `DG`: `party.hpPer` 0.6 • `tierMul` {elite 3, mini 8, boss 14, final 37} • `wave.max` 18 • `party.gScale` 0.5 • `open` (เพดานชั้นที่เปิด)

## 5. ตัวอย่าง 6 ชั้น (รูปแบบที่จะอยู่ใน shared)
```js
DG_FLOORS[1]   = { r:1,  k:1,  kind:'camp',  seals:[{ t:'Kt', act:'fire', hits:5, dodge:1 }] }
DG_FLOORS[26]  = { r:3,  k:6,  kind:'norm',  seals:[{ t:'I', n:7, mech:'lamp' }] }            // ตะเกียง 3 ดวงเปิดประตู (สเปก 1.2) n = ขั้นหลังคูณ
DG_FLOORS[50]  = { r:5,  k:10, kind:'boss',  seals:[{ t:'X', boss:'sylvan' }] }
DG_FLOORS[51]  = { r:6,  k:1,  kind:'town',  seals:[{ t:'Kv', act:'fire' }] }
DG_FLOORS[95]  = { r:10, k:5,  kind:'mini',  seals:[{ t:'M', mb:'mithguard', adds:9 }] }        // ค่ายเล็กอยู่ใน M
DG_FLOORS[100] = { r:10, k:10, kind:'final', seals:[{ t:'Z', boss:'dark', need:9 }] }
// อ้างอิงแบบหลายผนึก: DG_FLOORS[97] = { r:10, k:7, kind:'norm', seals:[{t:'I',n:5,mech:'stove'},{t:'C',waves:3,size:18},{t:'D',n:117,mech:'cold'},{t:'Ks',at:'end'}] }
```
แถวอื่นแปลงจาก JSON ตามกฎ: `ค่าย*`→camp (Kt/Kv/Kb/K) • `ปกติ`→norm • `มินิบอส+ค่าย`→mini • `บอส`→boss • `บอสสุดท้าย`→final • เติม `act/mech/puz/cats/alt/el/mb/boss/nNo` จากตาราง floors ข้อ 3 (JSON ไม่มีฟิลด์เหล่านี้ — **server-dev เติมตามข้อความในตาราง** แล้ว economy-designer รีวิว)

## 6. กติกาตรวจข้อมูล (`tools/test-dg-floors.js` pure ไม่มี I/O)
1. `DG_FLOORS` มีครบ f = 1..100 ไม่มีช่องว่าง • r = ceil(f/10) • k = f − 10(r−1)
2. k=1 → kind camp/town ผนึก K* • k=5 → mini ผนึก M (`mb` = `DG_KINGDOM[r].mini`) • k=10 → boss X (`boss` ตรงอาณาจักร) • f100 → final Z need 9 • f51 → town
3. ชั้นปกติ: จำนวนผนึกที่ไม่ใช่ K* = `DG_KINGDOM[r].seals` (1/2/3) • f97 มี Ks หนึ่งอันอยู่ท้าย
4. ทุก `t` อยู่ใน `DG_SEAL` • ทุกพารามิเตอร์ที่ต้องมีครบและเป็นจำนวนเต็มบวก • `el` `mb` `boss` มีใน `DG_ELITE`/`DG_BOSS` • ชนิดใน pool มีใน `DG_MON` และ `r` ตรง
5. เพดานความเหนื่อย: A n ≤ 33 • C size ≤ 18 waves ≤ 3 • D 60–150 วิ • G 90–150 วิ mobs ≤ 18 • F/I n 1–10 • ระลอกพร้อมกัน ≤ 18
6. H ทุกอันมี `alt` ที่เป็นผนึกสู้ (A/E/G) • L มี nNo > n
7. ชั้นปกติติดกันห้ามชุดชนิดผนึกเหมือนกันเป๊ะ
8. ราคา piece เพิ่มขึ้นตาม r (ไม่ลด) • partyLoot อยู่ 0.8–1.1 • repairMul ไม่เพิ่มตาม r • `DG.party.hpPer` = 0.6
9. ไม่มีตัวเลขสมดุลในไฟล์ `server/systems/dungeon/*` (grep ตัวเลข > 2 หลักนอก const ที่ยอมรับ) — ใช้แนวเดียวกับ `test-dg-data`
10. ตรวจไขว้ JSON: ลำดับชนิดผนึกและค่า `n/waves/size/mobs/adds` ทุกชั้นตรงกับ `seals` ใน `tools/dungeon-floors.draft.json` เป๊ะ (กันข้อมูลเกมกับซิมเพี้ยนกัน • แก้ตัวเลขต้องรันซิมแล้วเขียน JSON ใหม่ก่อน)
