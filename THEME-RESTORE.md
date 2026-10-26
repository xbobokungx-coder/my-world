# ย้อนธีมกลับก่อนปรับหน้าตา

สร้างเมื่อ: 2026-10-27 01:37  
จุดเซฟ: commit `239ecf630cf4a509d3fa5b335d21e83951d1088e`  
branch: `backup/theme-before-20261027-0137`  
tag: `backup-theme-20261027-0137`  
ไฟล์ภาพ: `public-visual-20261027-0137.tar.gz`  
ภาพอ้างอิง: `refs/plaza-ref.png`

## วิธีย้อน (เลือกอย่างใดอย่างหนึ่ง)

### ก) ย้อนเฉพาะไฟล์ภาพ/UI (แนะนำ — ไม่แตะกติกาเซิร์ฟเวอร์)

```bash
cd /root/my-world
git pull
# สำรองงานปัจจุบันก่อนทับ
mkdir -p backup/theme/failed-$(date +%Y%m%d-%H%M)
cp -a public/game.js public/index.html public/pixelart.js public/pixelchar.js public/pixelui.js STYLE_GUIDE.md backup/theme/failed-$(date +%Y%m%d-%H%M)/ 2>/dev/null || true
# แตก tar จุดเซฟ
tar xzf backup/theme/public-visual-20261027-0137.tar.gz -C /root/my-world
# ถ้าแก้แค่ public/* ไม่ต้อง restart — รีเฟรชเบราว์เซอร์
# ถ้าแตะ server.js ด้วย: systemctl restart my-world
```

### ข) ย้อนทั้ง commit ด้วย git

```bash
cd /root/my-world
git fetch
git checkout backup-theme-20261027-0137 -- public/game.js public/index.html public/pixelart.js public/pixelchar.js public/pixelui.js STYLE_GUIDE.md
# ตรวจแล้ว commit / หรือ checkout ทั้ง branch ชั่วคราว
```

### ค) WIP ที่ยังไม่ commit ตอนทำแบ็กอัป

```bash
cp backup/theme/game.js.wip-20261027-0137 public/game.js
cp backup/theme/index.html.wip-20261027-0137 public/index.html
```

## ห้าม

- อย่า `git reset --hard` บน `main` ที่ push แล้วโดยไม่สำรอง
- อย่าทับโฟลเดอร์ `data/` — แบ็กอัปธีมนี้ไม่เกี่ยวกับเซฟผู้เล่น
