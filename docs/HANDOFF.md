# สถานะงานล่าสุด (ส่งต่อระหว่างเครื่อง)

ไฟล์นี้คือ "ความจำร่วม" ของทุกเครื่อง Claude Code อ่านส่วนต้นอัตโนมัติตอนเปิด session
อัปเดตด้วย `/handoff` ก่อนเลิกงานหรือก่อนย้ายเครื่องทุกครั้ง

## ตอนนี้
- **12 พ.ย. 2026 (Mac เครื่องหลัก) ผังเมือง v4 + จักรยาน AI พร้อมแล้วบน branch ในเครื่อง `town-v4`** (แยกจาก `origin/main` สะอาด ไม่มีงานตกปลา/xpv 5 ปน • ยังไม่ push ยังไม่ deploy): ต้นไม้ใหญ่กลางลานวงกลม (= ต้นไม้แห่งโซ่ ไม่มีกองไฟแล้ว ที่นั่ง 12) • **ร้านอาวุธ ร้านที่ 11 ปิดปรับปรุง** (`BUILDINGS.closed` ไม่มี `SHOPS.weapon`) • ทางทรายขอบหินเทา โคม 14 ต้น `TOWN_LAMPS` + แสงกลางคืน กระถางหน้าร้าน • แถวป้ายขอบเหนือลาน y21 = ข่าว 30 / อันดับ 32 / ATM 34 / Lotto 36 • ปุ่ม A/Space ยืนแถวหน้าประตูร้านเปิดร้านทุกทิศ • เอาเมนู `fire` ออกจากแผงผู้ดูแล (layout.json เก่าที่มี fire ถูกข้าม) • จักรยานสไปรต์ AI `pack/bike-rider.png` (`BikeAI` ใน `pixelchar.js`) • แผน/ตั๋ว `docs/plans/town-plaza-tree.md` `docs/tasks/town-plaza-tree.md` • เทสต์ใหม่ `test-town-ring` `test-closed-shop` + `tools/town-ascii.js` • เทสต์ 34/34 ผ่าน • golden สร้างใหม่ (ต่างเฉพาะต้นไม้/ข้อความ/แมพ ไม่มีเหรียญ XP ทักษะเปลี่ยน)
  - **งานตกปลา/นักขุดแร่ที่ session อื่นค้างไว้ (xpv 5 `XP_TABLE_STD` `migrateStdV5` ฯลฯ) ไม่ได้อยู่ใน branch นี้** อยู่ที่ branch `wip/town-v4-merge` (รวมทุกอย่าง ยังไม่ผ่าน economy-designer/code-reviewer ห้าม deploy ก่อนตรวจ) • สำรองก่อนแยก `/Users/sira_c/mw-backups/town-v4-*.patch/.tgz`
  - **ก่อน deploy `town-v4`:** รวมเข้า `main` (fast-forward ได้ ฐานเป็น `origin/main` `c37f0ab`) • เปิดแผงผังในเกมจริงดู `data/layout.json` ถ้ามี `b_*`/`fire` ค้างให้กด "คืนผังตั้งต้น" หลัง deploy • `ops` รัน `deploy.sh --check` • หลัง deploy ตรวจโปรเซส Claude ค้างบน VPS • `ux-reviewer` ตรวจมือถือแล้วบางส่วน ยังไม่ครบ PC/แท็บเล็ต/ป้ายลาน/กลางคืน
  - ของชั่วคราว: `art/map-export/` • `.claude/launch.json` (dev-local/dev-town) • ตัวละครทดสอบใน `data-dev` • worktree `/Users/sira_c/CODING/My-World_Studio-town` (branch `town-v4`) ลบด้วย `git worktree remove` เมื่อรวมเสร็จ • เซิร์ฟเวอร์ dev พอร์ต 3002/3003
- เครื่อง: Mac (Sira-MAC) • วันที่ 2026-11-11 • `main` = `c5c0553` = **VPS รันอยู่เวอร์ชันนี้** (deploy แล้วทั้งหมด) • งานค้างอยู่ที่ branch **`wip/season-planting`** (`14030a0`)
- กำลังทำ: **ข้อจำกัดการปลูกตามฤดู** `docs/plans/season-planting.md` + `docs/plans/season-planting-economy.md` (โค้ดเสร็จทั้งเซิร์ฟเวอร์/เว็บ เทสต์ 31 ไฟล์ผ่าน แต่ **ยังไม่ผ่าน code-reviewer/ux-reviewer ยังไม่ได้ลองบน dev และยังไม่ merge**) • ต้อง rebase บน main (main มี hotfix 3 คอมมิตที่แตะ game.js/server.js/test-fight)
- เสร็จแล้ว (7–11 พ.ย. ทั้งหมด deploy แล้ว):
  - ลิฟต์เหมือง, ขุดแร่ Critical 10% ×3 + เสียง + แถบ HP, เอฟเฟกต์เลเวลอัพ, กดค้างปุ่ม A, เสียงอยู่แมพเดียวกัน, ปุ่ม Action ใช้ได้กับลิฟต์/เรือ/ป้าย Hub/ในบ้าน (กฎใน CLAUDE.md + agent `ux-reviewer` ใหม่) • ปรับ UX มือถือ/แท็บเล็ต/PC 15 ข้อ (`docs/tasks/ux-pass1.md`)
  - ตกปลาขั้นเดียว (ตัดเกจ) • **ออกทะเล: เรือตัวเองไม่จำกัดเวลา เลิกแพ เช่าเรือ 200 (ร้านเปิด 06:00–19:00 เช่าได้ถึง 17:00)** • ป้าย "ออกทะเล" บนเกาะ
  - ป้ายอันดับกลางเมือง 3 แท็บ (เลเวล/XP สัปดาห์/เศรษฐีโชว์ `xxx,xxx,123`) แถวป้าย 30/32/34/36 (`docs/tasks/leaderboard.md`) • หิมะตก+เมืองโทนหนาว (ระดับ 1–2) • ฝนสุ่มตามฤดู (ฤดูฝน ~37%) ดินเปียกเองตอนฝน • ผู้ดูแลคุมหิมะ/ฝน auto-on-off ที่แผงผู้ดูแล (`data/theme.json`)
  - hotfix วันนี้: **ข้อความ `reel` ถูกทิ้งตอนอยู่ในทะเล/ถ้ำ (HOUSE_MSG) ทำให้ตกปลาทะเลไม่ได้เลย** • กด Space/A ค้างตั้งแต่โยนเบ็ด • **ตารางเงาสัตว์ขาด alpaca/horse/boar ทำให้วาดล้มทั้งเฟรม**
- ค้างอยู่ / ขั้นต่อไป:
  - season-planting: ตัดสินใจแล้ว (Lv≤5 ปลูกได้ทุกฤดู, Lv6+ เฉพาะฤดู, inMul 1.15→1.08, ต้นไม้ 9 ชนิดงอกตามฤดู) → `git checkout wip/season-planting && git rebase origin/main` → รันเทสต์ → code-reviewer + ux-reviewer → ให้เจ้าของลอง dev → ประกาศในเกมให้คนตุนเมล็ดก่อน → deploy
  - ตกปลา: ความยากแทบขึ้นกับคันเบ็ดไม่ใช่เลเวล (ปลายักษ์ชนะ 77%→99% ตามคัน เลเวลเพิ่มแค่ ~4%) เสนอ: ปลาแรงขึ้นตามเลเวลปลา (ยังไม่ตัด) • ให้ economy-designer ตรวจรายได้ชาวประมง (เรือไม่จำกัดเวลา + ไม่มีเกจ) และเรือเช่าสั้น 2–13 นาที
  - รอเจ้าของตอบ: โหมดตกแต่งในบ้านซ่อนปุ่ม A บนมือถือ • ปุ่ม "ขึ้นจากถ้ำ" • PC/มือถือให้เหมือนกัน (ไอคอนหิว/แชต/ป้ายคีย์ลัด) • iPhone เต็มจอ (ทำ manifest+ไอคอน+ข้อความแนะนำ+notch)
  - เก็บกวาดโค้ดตาย: `FISH_GAUGE`/`gaugeHit`/UI เกจ, ฉากแพ floor 99 • แผนเดิมรอเจ้าของ: ชาวนา `farm-rework.md`, ชาวประมง `fish-rework.md` (ยัง untracked ในเครื่องหลัก), refactor ขั้น 2–3
- ตัดสินใจแล้ว:
  - dev → push GitHub → `tools/deploy.sh -y` บน VPS • commit ไทย `user.name = xbobokungx-coder` agent ไม่ commit • ของโต้ตอบได้ต้องใช้ปุ่ม Action ได้เสมอ • งานแตะ UI ต้องผ่าน `ux-reviewer`
  - เศรษฐี: ปิดบังหลักหน้าเหลือสามหลักท้าย (เซิร์ฟเวอร์ปิดบังก่อนส่ง) • อันดับตู้เกมไม่อยู่ในป้ายอันดับ (ยังอยู่ใน Arcade Hub) • หิมะ/ฝนเป็นภาพ+ฝนลดการรดน้ำ ผู้ดูแลเท่านั้นสลับได้
- ระวัง:
  - **VPS RAM 961 MB:** แอป Claude Desktop ต่อรีโมตกับ VPS แล้วโปรเซส `ccd-cli` โตถึง ~600 MB ภายใน 40 นาที และขึ้นใหม่เองหลังฆ่า → **หลัง deploy ทุกครั้งตรวจ `ps`/`free` แล้วฆ่า (ฆ่าตามเลข PID ห้ามใช้ pkill -f) หรือปิดการเชื่อมต่อรีโมตในแอป** • อย่าแตะ `node server.js`/caddy
  - golden ล็อก `themeRain='off'` (T0 อยู่ต้นรอบฝน) • เทสต์ที่ใช้ `Date.now()` ขึ้นกับฤดูจริง (ปรับ test-trees แล้วใน wip)
  - เครื่องหลัก `/Users/sira_c/CODING/My-World_Studio` ยังมีไฟล์แก้ค้างของ session อื่น (ชาวประมง/ชาวนา xpv 5, fishing.js ฯลฯ) ห้าม commit ปนของเรา pull อาจชน • worktree ที่ใช้อยู่ `.claude/worktrees/{agent-a6caa80a5532e0e70,hotfix-fish-hold,investigate-alpaca}` ลบได้เมื่อเสร็จ • เซิร์ฟเวอร์ dev พอร์ต 3001 (`data-dev`) ยังรันโค้ดเก่า ปิดด้วย `lsof -ti :3001 | xargs kill`
  - macOS ไม่มี `timeout` • ห้ามอ่าน/เขียน `admin.key`, `data/`, รหัสผ่าน • รหัสผู้ดูแล (ทั้ง dev และจริง) ไม่เขียนลงเอกสาร ตั้งผ่านตัวแปร `ADMIN_KEY` ตอนรันเครื่อง dev • Node เครื่องนี้ v25 VPS v24

## ก่อนหน้า
- 2026-11-06: นักขุดแร่ปรับใหม่ (`44daacc`) อุปกรณ์ขุด 10 ชนิด หลอด XP รายอาชีพ ย้ายเซฟ xpv 4 • แก้ `deploy.sh` exit 141
- 2026-11-06: refactor ขั้น 0–1 เสร็จ (server.js 3,798→1,139 บรรทัด) ดู `docs/plans/refactor.md`
