'use strict';
// ค่าคงที่ของเซิร์ฟเวอร์ (ย้ายมาจาก server.js ไม่เปลี่ยนค่า) — ไม่ require shared
const HFAST = Math.max(1, +process.env.HUNGER_FAST || 1);
const PARTY = new Set(['pok', 'react', 'rps']); // เกมห้องหลายคน (ผู้เล่นหลายคน/บอท) — ดู partyHandle
const NPC_DEFS = [
  { name: 'ป้าแก้ว', title: '🏘️ ชาวเมือง', color: '#d6559a', hat: '#e8c66a', pc: '#6b4a8a', wear: { shirt: 'dots', pants: 'skirt', hat: 'flower' }, home: [27, 28],
    lines: ['ปลูกผักแล้วรดน้ำด้วยนะ 💧', 'นั่งพักแล้วหิวไม่ลดนะ 🪑', 'ทำเควสประจำวันที่เมนู 🎒 สิ', 'กลางคืนมืด ซื้อตะเกียง 🏮', 'ซื้อที่ดินสร้างบ้านได้ 🏠', 'สัตว์หิว รีบให้อาหารนะ 🐔']},
  { name: 'ลุงสมชาย', title: '🏘️ ชาวเมือง', color: '#7a9a3a', hat: '#e8c66a', pc: '#4a5b3a', wear: { shirt: 'farmer', pants: 'overall', hat: 'straw' }, home: [41, 32],
    lines: ['ตกปลาต้องมีเหยื่อ 🪱', 'ยืนใกล้สระ แล้วโยนเบ็ดไกลๆ 🎣', 'ตัดไม้ต้องมีขวาน 🪓', 'ขายเยอะๆ ราคาตกนะ 📉', 'อัปเลเวลปลดล็อกของใหม่ ⭐', 'ฝากเงิน ATM ได้ดอกเบี้ย 💳', 'ขวานเบ็ดพังต้องซ่อมนะ 🔧']},
  { name: 'น้องมิ้นท์', title: '🏘️ ชาวเมือง', color: '#3aa0d6', hat: '#ffffff', pc: '#2c3e50', wear: { shirt: 'hoodie', pants: 'shorts', hat: 'cap' }, home: [33, 21],
    lines: ['ตู้เกมเล่นกับบอทได้ 🤖', 'ท้าเพื่อนเล่น XO ไหม ❌⭕', 'ชวนเพื่อนกด 🔗 มาเล่น', 'ช่วยกันทำงาน ติดบัฟ 🎉', 'กด 📰 ดูข่าวเมืองนะ', 'กด H ตกแต่งบ้านได้ 🛋️']},
];
const CAVE = '@cave'; // ฉากถ้ำเหมือง (p.scene) ร่วมกันทั้งห้อง: ชื่อผู้เล่นไม่มี @ จึงไม่ชนกับคีย์บ้าน
const ADMIN_NAME = (process.env.ADMIN_NAME || 'Sira').trim();
module.exports = { CAVE, HFAST, ADMIN_NAME, PARTY, NPC_DEFS };
