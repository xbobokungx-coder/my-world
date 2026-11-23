// เครื่องมือวาดแผนที่เมืองหลัก 64x46 เป็นไฟล์ภาพ PNG
const fs = require('fs'), path = require('path');
const { Canvas, png } = require('./canvasshim.js');
const S = require('../public/shared.js');

const W = S.W || 64, H = S.H || 46;
const TILE = 20; // 20px ต่อ 1 ช่อง (รวม = 1280 x 920 px)
const MARGIN = 30; // ขอบสำหรับเขียนเลขพิกัด
const canvas = new Canvas(W * TILE + MARGIN * 2, H * TILE + MARGIN * 2);
const ctx = canvas.getContext();

const m = S.makeMap();

// พื้นหลัง
ctx.fillStyle = '#1e241c';
ctx.fillRect(0, 0, canvas.width, canvas.height);

const tileColors = {
  [S.T.GRASS]: '#487d36',
  [S.T.PATH]: '#c4ae7e',
  [S.T.SAND]: '#ddba77',
  [S.T.WATER]: '#2f76bd',
  [S.T.TREE]: '#26541d',
  [S.T.FENCE]: '#6e441f',
  [S.T.CLIFF]: '#554f48',
  [S.T.STAIR]: '#948d84',
  [S.T.MOUTH]: '#141414',
  [S.T.LANDMARK]: '#52341e',
  [S.T.BUILD]: '#7e4228',
  [S.T.SHOP]: '#e6a100'
};

// วาดช่องพื้นฐาน
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const px = MARGIN + x * TILE, py = MARGIN + y * TILE;
    const t = m[y][x];
    let col = tileColors[t] || '#487d36';

    // ถ้าเป็นพื้นปูหิน (Paved)
    if (t === S.T.PATH && S.isPaved && S.isPaved(x, y)) {
      col = '#8f8a84';
    }

    ctx.fillStyle = col;
    ctx.fillRect(px, py, TILE, TILE);

    // เส้นขอบช่องบางๆ เพื่อให้อ่านตารางง่าย
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(px, py, TILE, 1);
    ctx.fillRect(px, py, 1, TILE);

    // ลวดลายต้นไม้
    if (t === S.T.TREE) {
      ctx.fillStyle = '#1c3e15';
      ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      ctx.fillStyle = '#346d29';
      ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
    }
  }
}

// ไฮไลต์แปลงผัก (FARM)
ctx.fillStyle = 'rgba(102, 63, 31, 0.45)';
ctx.fillRect(MARGIN + S.FARM.x0 * TILE, MARGIN + S.FARM.y0 * TILE, (S.FARM.x1 - S.FARM.x0 + 1) * TILE, (S.FARM.y1 - S.FARM.y0 + 1) * TILE);

// ไฮไลต์อาคารร้านค้าตาม roof color
for (const b of S.BUILDINGS) {
  if (b.kind === 'sign') continue;
  const bx = MARGIN + b.x0 * TILE, by = MARGIN + b.y0 * TILE;
  const bw = (b.x1 - b.x0 + 1) * TILE, bh = (b.y1 - b.y0 + 1) * TILE;
  // ผนัง
  ctx.fillStyle = b.wall || '#f0dcae';
  ctx.fillRect(bx, by, bw, bh);
  // หลังคา
  ctx.fillStyle = b.roof || '#8b4513';
  ctx.fillRect(bx + 1, by + 1, bw - 2, Math.floor(bh * 0.7));
  // เคาน์เตอร์
  for (const [cx, cy] of b.counter) {
    ctx.fillStyle = '#ffb300';
    ctx.fillRect(MARGIN + cx * TILE + 2, MARGIN + cy * TILE + 2, TILE - 4, TILE - 4);
  }
}

// บ้านหลังใหญ่
{
  const hx = MARGIN + S.HOUSE_BLD.x0 * TILE, hy = MARGIN + S.HOUSE_BLD.y0 * TILE;
  const hw = (S.HOUSE_BLD.x1 - S.HOUSE_BLD.x0 + 1) * TILE, hh = (S.HOUSE_BLD.y1 - S.HOUSE_BLD.y0 + 1) * TILE;
  ctx.fillStyle = '#f0dcae';
  ctx.fillRect(hx, hy, hw, hh);
  ctx.fillStyle = '#8b2500';
  ctx.fillRect(hx + 2, hy + 2, hw - 4, hh - 6);
  // ประตู
  ctx.fillStyle = '#4a2505';
  ctx.fillRect(MARGIN + S.HOUSE_DOOR.x * TILE + 2, MARGIN + S.HOUSE_BLD.y1 * TILE - 2, TILE - 4, 8);
}

// ตู้เกม (Cabinets)
for (const c of S.CABINETS) {
  ctx.fillStyle = '#7e57c2';
  ctx.fillRect(MARGIN + c.x * TILE + 2, MARGIN + c.y * TILE + 2, TILE - 4, TILE - 4);
  ctx.fillStyle = '#b388ff';
  ctx.fillRect(MARGIN + c.x * TILE + 5, MARGIN + c.y * TILE + 5, TILE - 10, TILE - 10);
}

// ป้าย/ตู้ลานเหนือ
for (const p of [S.BOARD, S.RANKBOARD, S.ATM, S.LUCKY, S.FLEA]) {
  ctx.fillStyle = '#ffb300';
  ctx.fillRect(MARGIN + p.x * TILE + 2, MARGIN + p.y * TILE + 2, TILE - 4, TILE - 4);
}

// กองไฟกลางเมือง
{
  const fx = MARGIN + S.FIRE.x * TILE, fy = MARGIN + S.FIRE.y * TILE;
  ctx.fillStyle = '#ff5722';
  ctx.fillRect(fx + 2, fy + 2, TILE - 4, TILE - 4);
  ctx.fillStyle = '#ffeb3b';
  ctx.fillRect(fx + 6, fy + 6, TILE - 12, TILE - 12);
}

// ซุ้มประตูป่า JGATE (ล่างสุด)
{
  const jx = MARGIN + S.JGATE.x0 * TILE, jy = MARGIN + S.JGATE.y0 * TILE;
  const jw = (S.JGATE.x1 - S.JGATE.x0 + 1) * TILE, jh = (S.JGATE.y1 - S.JGATE.y0 + 1) * TILE;
  ctx.fillStyle = '#3e2723';
  ctx.fillRect(jx, jy, jw, jh);
  // ช่องประตูเดินทะลุ
  ctx.fillStyle = '#c4ae7e';
  ctx.fillRect(MARGIN + S.JGATE.door[0] * TILE, jy, (S.JGATE.door[2] - S.JGATE.door[0] + 1) * TILE, jh);
}

// สะพานและเกาะลึกลับ
{
  ctx.fillStyle = '#795548';
  ctx.fillRect(MARGIN + S.BRIDGE.x0 * TILE, MARGIN + S.BRIDGE.y0 * TILE, (S.BRIDGE.x1 - S.BRIDGE.x0 + 1) * TILE, (S.BRIDGE.y1 - S.BRIDGE.y0 + 1) * TILE);
  ctx.fillStyle = '#ddba77';
  ctx.fillRect(MARGIN + S.ISLAND.x0 * TILE, MARGIN + S.ISLAND.y0 * TILE, (S.ISLAND.x1 - S.ISLAND.x0 + 1) * TILE, (S.ISLAND.y1 - S.ISLAND.y0 + 1) * TILE);
  // ประภาคาร
  ctx.fillStyle = '#d32f2f';
  ctx.fillRect(MARGIN + S.LIGHTHOUSE.x0 * TILE, MARGIN + S.LIGHTHOUSE.y0 * TILE, (S.LIGHTHOUSE.x1 - S.LIGHTHOUSE.x0 + 1) * TILE, (S.LIGHTHOUSE.y1 - S.LIGHTHOUSE.y0 + 1) * TILE);
}

// เล้าสัตว์ (PENS)
for (const p of Object.values(S.PENS)) {
  ctx.fillStyle = 'rgba(110, 68, 31, 0.25)';
  ctx.fillRect(MARGIN + p.x0 * TILE, MARGIN + p.y0 * TILE, (p.x1 - p.x0 + 1) * TILE, (p.y1 - p.y0 + 1) * TILE);
}

// จุดมาร์กเกอร์เลขพิกัดขอบบนและซ้าย (ทุก 5 และ 10 ช่อง)
for (let x = 0; x < W; x += 5) {
  const px = MARGIN + x * TILE;
  ctx.fillStyle = x % 10 === 0 ? '#ffea00' : '#ffffff';
  ctx.fillRect(px, MARGIN - 6, 2, 6);
  ctx.fillRect(px, MARGIN + H * TILE, 2, 6);
}
for (let y = 0; y < H; y += 5) {
  const py = MARGIN + y * TILE;
  ctx.fillStyle = y % 10 === 0 ? '#ffea00' : '#ffffff';
  ctx.fillRect(MARGIN - 6, py, 6, 2);
  ctx.fillRect(MARGIN + W * TILE, py, 6, 2);
}

const outDir = path.join(__dirname, '..', 'art');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'town-map.png');
fs.writeFileSync(outPath, png(canvas));
console.log('Saved map image to:', outPath);
