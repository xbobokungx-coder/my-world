# ขัดเงาพื้นแมพเมือง (visual-only)

- ประเภท: art
- ผู้ขอ: ผู้ดูแล   วันที่: 2026-11-23

## ต้องการอะไร (มุมผู้เล่น)
พื้นแมพเมืองดูมีชีวิตขึ้น: ดอกไม้ พุ่ม ขอบทางคดเคี้ยว ลายลานหิน ชายน้ำ โดยผังเมืองเดิมทุกพิกัด ไม่เปลี่ยนการเดิน/ชน

## เกณฑ์ว่าเสร็จ
- [ ] `PixelArt.ground` / `mapDecor` ใน `public/pixelart.js` ขัดเงาตามแผน (V5)
- [ ] ไม่แตะ `makeMap` / พิกัดร้าน / collision
- [ ] พรีวิว `art/town-bg.png` อ่านทางเดินและลานได้ชัด
- [ ] `check-all` ผ่าน

## ตำแหน่งในโค้ด
- `public/pixelart.js:113–211` — `ground` (scallop, paved, shore, tufts)
- `public/pixelart.js:217–241` — `mapDecor` (พุ่ม/ดอก)

## งานของแต่ละตำแหน่ง
- pixel-artist: แก้ `pixelart.js` ตามแผนขัดเงา
- server-dev / client-dev / economy / doc-writer: ไม่ต้อง

## บันทึก / คำตัดสินใจ
visual-only • ไม่สร้างไฟล์พื้นหลัง PNG ใหม่ • ไม่คืน PackArt
