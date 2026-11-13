# บันทึกการสร้างภาพ (PixelLab)

หนึ่งบรรทัดต่อชิ้น: วันที่ | ชื่อ | เครื่องมือ | พารามิเตอร์หลัก | prompt | ไฟล์ที่เลือก
ภาพดิบอยู่ใน `art/raw/` (ไม่ขึ้น git) ถ้าหายสร้างใหม่ได้จากบรรทัดในไฟล์นี้

2026-11-12 | test-pickaxe | create_object_pro_flash | 64x64 1dir low top-down, style_image=pack/chest.png | iron mining pickaxe with wooden handle, single item, transparent background | art/raw/test-pickaxe.png
2026-11-12 | test-fish-item | create_object_pro_flash | 64x64 1dir low top-down, style_image=pack/chest.png | small silver fish with orange fins, single item, transparent background | art/raw/test-fish-item.png
2026-11-12 | test-chick | create_object_pro_flash | 64x64 1dir low top-down, style_image=pack/dog.png | cute yellow chick farm animal, single sprite, transparent background | art/raw/test-chick.png
2026-11-12 | bike-rider-sheet | create_object_pro_flash 8 ทิศ + animate_object v3 (south/east/north) | 96x96 low top-down, style_image=pack/char_boy.png, pedal | cute chibi boy riding a small red bicycle, big head, wearing t-shirt and cap, single sprite, transparent background / pedaling the bicycle, legs pumping and wheels turning, smooth looping cycle | art/raw/bike-rider-sheet.png (แถว 0 = 8 ทิศนิ่ง, 1 = ปั่นใต้ 9 เฟรม, 2 = ปั่นตะวันออก 5 เฟรม, 3 = ปั่นเหนือ 9 เฟรม; ตะวันตกพลิกจากตะวันออก) id dce6540e-c8f7-45db-b884-3347c858e472
2026-11-13 | car-driver-sheet | create_object_pro_flash 8 ทิศ + animate_object v3 (south/east/north) | 96x96 low top-down, style_image=char_boy.png, drive (ใต้ 4 เฟรม+ต้น=5, ตะวันออก 9, เหนือ 5) | cute chibi boy driving a small red toy-like car, big head visible, wearing t-shirt and cap, single sprite, transparent background / driving the car forward, wheels turning, slight body bounce, smooth looping cycle | art/raw/car-driver-sheet.png (แถว 0 = ใต้, 1 = ตะวันออก, 2 = เหนือ; ตะวันตกพลิก) id 55b34675-1cc4-4611-8d1e-e863e7b12345
