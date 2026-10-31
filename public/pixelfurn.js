// เฟอร์นิเจอร์ในบ้าน = ชุด furniture-kit-v2 ที่ผู้เล่น/ผู้ออกแบบวาดมาเอง (ห้ามแก้รูปทรงโดยไม่จำเป็น)
// วิธีวาด: รูปทรงเวกเตอร์เดิมของเกม → แรสเตอร์ทีละพิกเซลจำนวนเต็ม (poly/pixelLine/dot) ขอบ INK อยู่ด้านในทุกชิ้นส่วน
// สีผ่าน FURN_COLORS (โทนหม่น) • tint สว่าง = ครีมอุ่น เข้ม = เทาฟ้าเย็น • ไม้มีร่องแผ่น+เส้นแสง ผ้ามีตะเข็บ ขอบบนมี bevel 1 px
// ใช้: PixelFurn.sprite(id, FURN[id], r, now, shadow, W, D) → { cv, ax, ay } วาดที่ iso(X,Y,z) − (ax,ay)
//      PixelFurn.wall(id, FURN[id], wl) → { cv, ax, ay } วาดที่ wallPt(wl,U,0) − (ax,ay) • anim(id) = ภาพขยับตามเวลา (เกมแคชต่อ 150 ms)
//      PixelFurn.room(draw, x0, y0, w, h) → แคนวาสพื้น/ผนังห้อง (เติมสีทีละพิกเซล ไม่มีขอบเบลอ)
const PixelFurn = (() => {
  const TS = 32;
  const hex = s => { const n = parseInt(s.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  let factory = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// ===== เริ่มบล็อกจาก furniture-kit-v2 (furniture-source.js) =====
const HF = Shared.HFLOOR, FX0 = HF.x0 * TS, FX1 = HF.x1 * TS, FY0 = HF.y0 * TS, FY1 = HF.y1 * TS, WALL_H = 96, INK = '#2a1b14';
const iso = (X, Y, z = 0) => [X - Y, (X + Y) / 2 - z];       // พื้นโลก (px) → จอไอโซเมตริก
const unIso = (sx, sy) => [sy + sx / 2, sy - sx / 2];       // จอ → พื้นโลก (ที่ความสูง 0)
// V2: native integer raster, consistent material palette; no image resampling.
const FURN_COLORS={
 '#c98b4a':'#b18b5e','#a8703a':'#957047','#8b5a2b':'#866346','#6b4423':'#604a3a','#7a4a24':'#73523c','#7a4f2a':'#76563f','#7b5a3a':'#766047','#8f6a45':'#a18159','#4a2f18':'#513e34','#5a3a1e':'#604c3c','#b87a3c':'#ac8557','#d9a05c':'#c1a16e',
 '#4a6fa5':'#617f83','#3d5d8f':'#496368','#5e86bd':'#819b99','#d65a4a':'#ae6d57','#d1543e':'#aa6552','#5a8a5a':'#77865c','#7a3a8a':'#8b6c87','#a8553a':'#805747','#c0654a':'#a5735c','#d97a5e':'#c39679',
 '#f0e4c0':'#e1d3ae','#fdf6e3':'#f0e5ca','#f4f4f4':'#e6dfcc','#dfe6ee':'#bdc7c4','#cfd9e6':'#b4bfbd','#e8eef6':'#d7dacc','#7a8aa0':'#697e86','#cfd5dc':'#b7c1c0','#e8e1d0':'#d7cdb4','#3a3f4a':'#414e59','#9aa0aa':'#8d9e9e',
 '#2d6e2a':'#365545','#3f9a3a':'#557b4c','#4fa048':'#7b9659','#6cc65a':'#b3c27b','#c0652d':'#a06c4e',
 '#8e949e':'#7b888b','#c4c8cf':'#b7bdaf','#aab4c4':'#8a9b9d','#cfd6e0':'#c8ccbb','#6cc6d6':'#7caaa8',
 '#e74c3c':'#af6556','#3498db':'#6f94a0','#f1c40f':'#d7b86b','#2ecc71':'#7b9659','#9b59b6':'#947e99','#e67e22':'#c38e55','#e84a5f':'#ba7781','#e8c04a':'#c9a75d','#e8c66a':'#d2bb83',
 '#8fd0f0':'#a4c7c7','#cfe8f5':'#b4c9c7','#9fc5d8':'#88a9af','#3a7bb5':'#648b99','#5fa844':'#80945e','#4a8a3a':'#4d7154','#7bc65a':'#9eaf71','#c0392b':'#a65e4e','#a8584a':'#9f6d5c','#a8552f':'#a06a50','#8a4426':'#745243',
 '#ffd36a':'#e3c888','#c9b458':'#a6ab6a','#b8a24a':'#8d965e','#7d6a2a':'#5e704b','#e8943a':'#bc8b51','#c97a28':'#916c44'
};
const materialColor=c=>FURN_COLORS[String(c).toLowerCase()]||c;
const rgbOf = c => {const m=String(c).match(/[\d.]+/g);if(String(c).startsWith('#')){const n=parseInt(c.slice(1),16);return[n>>16&255,n>>8&255,n&255];}return m?m.slice(0,3).map(Number):[0,0,0];};
const tint=(c,k)=>{const a=rgbOf(materialColor(c));const target=k<0?[42,48,63]:[245,230,193],t=Math.min(.85,Math.abs(k)*1.45);return '#'+a.map((v,i)=>Math.round(v+(target[i]-v)*t).toString(16).padStart(2,'0')).join('');};
function pixelLine(g,a,b,c){g.fillStyle=materialColor(c);let x=Math.round(a[0]),y=Math.round(a[1]),xx=Math.round(b[0]),yy=Math.round(b[1]);const dx=Math.abs(xx-x),sx=x<xx?1:-1,dy=-Math.abs(yy-y),sy=y<yy?1:-1;let err=dx+dy;while(true){g.fillRect(x,y,1,1);if(x===xx&&y===yy)break;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}}
function poly(g,pts,fill,stroke){
 const q=pts.map(([x,y])=>[Math.round(x),Math.round(y)]),lo=Math.min(...q.map(p=>p[1])),hi=Math.max(...q.map(p=>p[1]));
 if(fill){g.fillStyle=materialColor(fill);for(let y=lo;y<hi;y++){const xs=[];for(let i=0;i<q.length;i++){const [x1,y1]=q[i],[x2,y2]=q[(i+1)%q.length];if((y1<=y+.5&&y2>y+.5)||(y2<=y+.5&&y1>y+.5))xs.push(x1+(y+.5-y1)*(x2-x1)/(y2-y1));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2){const l=Math.ceil(xs[i]-.5),r=Math.ceil(xs[i+1]-.5);if(r>l)g.fillRect(l,y,r-l,1);}}}
 if(stroke){
  const inside=(x,y)=>{let on=false;for(let i=0,j=q.length-1;i<q.length;j=i++){const [a,b]=q[i],[c,d]=q[j];if((b>y+.5)!=(d>y+.5)&&x+.5<(c-a)*(y+.5-b)/(d-b)+a)on=!on;}return on;};
  g.fillStyle=materialColor(stroke);const left=Math.min(...q.map(p=>p[0])),right=Math.max(...q.map(p=>p[0]));
  for(let y=lo;y<hi;y++)for(let x=left;x<right;x++)if(inside(x,y)&&(!inside(x-1,y)||!inside(x+1,y)||!inside(x,y-1)||!inside(x,y+1)))g.fillRect(x,y,1,1);
 }
}

const pip = (pts, x, y) => { let on = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) on = !on; } return on; };
// กล่อง 3 ด้าน: (X,Y) = กึ่งกลางฐาน w×d px ตั้งแต่ความสูง z0 สูง h • ซ้ายล่างหันหาผู้เล่น ขวาล่างเข้มกว่า (แสงมาจากซ้ายบน)
function ibox(g,X,Y,w,d,z0,h,c,o={}){
 const raw=c, col=materialColor(c),x0=X-w/2,x1=X+w/2,y0=Y-d/2,y1=Y+d/2,zt=z0+h,st=o.flat?null:INK;
 const L=[iso(x0,y1,zt),iso(x1,y1,zt),iso(x1,y1,z0),iso(x0,y1,z0)],R=[iso(x1,y0,zt),iso(x1,y1,zt),iso(x1,y1,z0),iso(x1,y0,z0)],T=[iso(x0,y0,zt),iso(x1,y0,zt),iso(x1,y1,zt),iso(x0,y1,zt)];
 poly(g,L,o.left||tint(col,-.13),st);poly(g,R,o.right||tint(col,-.35),st);poly(g,T,o.top||tint(col,.17),st);
 const wood=['#c98b4a','#a8703a','#8b5a2b','#6b4423','#7a4a24','#7a4f2a','#7b5a3a','#8f6a45','#4a2f18','#5a3a1e','#b87a3c','#d9a05c'].includes(raw);
 const fabric=['#4a6fa5','#3d5d8f','#5e86bd','#d65a4a','#d1543e','#5a8a5a','#7a3a8a','#a8553a','#c0654a','#d97a5e'].includes(raw);
 if(w>8&&d>8){
  // Bevel highlights sit one pixel inside the original footprint.
  pixelLine(g,iso(x0+1,y0+1,zt),iso(x1-1,y0+1,zt),tint(col,.35));
  pixelLine(g,iso(x0+1,y0+1,zt),iso(x0+1,y1-1,zt),tint(col,.30));
  if(wood){
   for(let a=x0+9;a<x1-3;a+=10){pixelLine(g,iso(a,y0+1,zt),iso(a,y1-1,zt),tint(col,-.13));pixelLine(g,iso(a+1,y0+1,zt),iso(a+1,y1-1,zt),tint(col,.24));}
   if(w>22&&d>15){pixelLine(g,iso(x0+4,y0+5,zt),iso(x0+9,y0+5,zt),tint(col,-.19));pixelLine(g,iso(x1-9,y1-5,zt),iso(x1-4,y1-5,zt),tint(col,-.15));}
  }
  if(fabric){
   const inset=2;poly(g,[iso(x0+inset,y0+inset,zt),iso(x1-inset,y0+inset,zt),iso(x1-inset,y1-inset,zt),iso(x0+inset,y1-inset,zt)],null,tint(col,.28));
   if(w>24&&d>20)for(let a=x0+8;a<x1-5;a+=12){pixelLine(g,iso(a,y1-4,zt),iso(a+3,y1-4,zt),tint(col,-.10));}
  }
 }
 if(wood&&h>14&&w>12){
  for(let a=.18;a<.9;a+=.23){const x=x0+a*w;pixelLine(g,iso(x,y1,z0+3),iso(x,y1,zt-3),tint(col,-.24));pixelLine(g,iso(x+1,y1,z0+4),iso(x+1,y1,zt-4),tint(col,.05));}
  if(d>12)for(let a=.25;a<.9;a+=.3){const y=y0+a*d;pixelLine(g,iso(x1,y,z0+3),iso(x1,y,zt-3),tint(col,-.44));}
 }
 if(raw==='#a8584a'){
  for(let z=z0+6;z<zt-3;z+=7){pixelLine(g,iso(x0+1,y1,z),iso(x1-1,y1,z),tint(col,-.28));pixelLine(g,iso(x1,y0+1,z),iso(x1,y1-1,z),tint(col,-.43));
   for(let a=4+((z%14)>7?4:0);a<w-3;a+=10)pixelLine(g,iso(x0+a,y1,z),iso(x0+a,y1,z+5),tint(col,-.25));}
 }
 if(!o.flat&&h>5){pixelLine(g,L[0],L[1],tint(col,.15));pixelLine(g,R[0],R[1],tint(col,-.12));pixelLine(g,L[1],L[2],INK);}
}

// แผ่นสีบนด้านของกล่อง (u0..u1 = สัดส่วนตามด้าน): L = ด้านซ้ายล่าง (y = y1) R = ด้านขวาล่าง (x = x1)
const faceL = (g, X, Y, w, d, u0, u1, z0, z1, c) => poly(g, [iso(X - w / 2 + u0 * w, Y + d / 2, z1), iso(X - w / 2 + u1 * w, Y + d / 2, z1), iso(X - w / 2 + u1 * w, Y + d / 2, z0), iso(X - w / 2 + u0 * w, Y + d / 2, z0)], c);
const faceR = (g, X, Y, w, d, u0, u1, z0, z1, c) => poly(g, [iso(X + w / 2, Y - d / 2 + u0 * d, z1), iso(X + w / 2, Y - d / 2 + u1 * d, z1), iso(X + w / 2, Y - d / 2 + u1 * d, z0), iso(X + w / 2, Y - d / 2 + u0 * d, z0)], c);
const backSlab = (X, Y, W, D, r, t) => (r ? [X - W / 2 + t / 2, Y, t, D] : [X, Y - D / 2 + t / 2, W, t]); // แผ่นบางชิดด้านหลัง (r=0 ชิดเหนือ, r=1 ชิดตะวันตก)
const dot = (g,X,Y,z,rx,ry,c) => {
 const [px,py]=iso(X,Y,z);g.fillStyle=materialColor(c);
 for(let y=Math.floor(py-ry);y<=Math.ceil(py+ry);y++)for(let x=Math.floor(px-rx);x<=Math.ceil(px+rx);x++)if(((x-px)/(rx+.1))**2+((y-py)/(ry+.1))**2<=1)g.fillRect(x,y,1,1);
};
// สไปรต์เฟอร์นิเจอร์: (g, X, Y = กึ่งกลางฐาน, W, D = ขนาดฐาน px หลังหมุน, r = หมุนไหม, d = ข้อมูลใน FURN, now)
// เตียงสองแบบใช้ร่วมกัน: frame = สีโครง/หัวเตียง, blanket = สีผ้าห่ม, pillows = จำนวนหมอน
const bedArt = (g, X, Y, W, D, r, frame, blanket, pillows) => {
  const [hx, hy, hw, hd] = backSlab(X, Y, W, D, r, 6); ibox(g, hx, hy, hw, hd, 0, 30, frame); ibox(g, X, Y, W, D, 0, 10, tint(frame, 0.12)); ibox(g, X, Y, W - 6, D - 6, 10, 7, '#f0e4c0');
  const pw = pillows > 1 ? 0.36 : 0.6, at = k => (pillows > 1 ? (k ? 0.22 : -0.22) : 0);
  if (r) { ibox(g, X, Y, W * 0.55 - 3, D - 6, 17, 2, blanket, { flat: true }); for (let k = 0; k < pillows; k++) ibox(g, X - W / 2 + 16, Y + D * at(k), 14, D * pw, 17, 5, '#fdf6e3'); }
  else { ibox(g, X, Y + D * 0.18, W - 6, D * 0.55, 17, 2, blanket, { flat: true }); for (let k = 0; k < pillows; k++) ibox(g, X + W * at(k), Y - D / 2 + 16, W * pw, 14, 17, 5, '#fdf6e3'); }
};
// Crisp lamp glint; broad lighting belongs to the game light pass.
const lampGlow=(g,X,Y,z,now)=>{const [x,y]=iso(X,Y,z);g.fillStyle=Math.sin(now/300)>0?'#f9e7b5':'#e9cf91';g.fillRect(Math.round(x)-1,Math.round(y)-2,2,4);};
const ART = {
  rug(g, X, Y, W, D) {
    const q = (k, c, s) => poly(g, [iso(X - W / 2 + k, Y - D / 2 + k, 1), iso(X + W / 2 - k, Y - D / 2 + k, 1), iso(X + W / 2 - k, Y + D / 2 - k, 1), iso(X - W / 2 + k, Y + D / 2 - k, 1)], c, s);
    q(0, '#8c2a22', INK); q(3, '#e8c66a'); q(6, '#c0453a'); q(14, '#a8322a');
    poly(g, [iso(X, Y - 7, 1), iso(X + 12, Y, 1), iso(X, Y + 7, 1), iso(X - 12, Y, 1)], '#e8c66a');
  },
  chair(g, X, Y, W, D, r) {
    const [bx, by, bw, bd] = backSlab(X, Y, W * 0.9, D * 0.9, r, 5);
    ibox(g, bx, by, bw, bd, 0, 30, '#a8703a');
    ibox(g, X, Y, W * 0.9, D * 0.9, 0, 12, '#c98b4a');
    ibox(g, X, Y, W * 0.7, D * 0.7, 12, 3, '#d65a4a', { flat: true });
  },
  sofa(g, X, Y, W, D, r) {
    const c = '#4a6fa5', [bx, by, bw, bd] = backSlab(X, Y, W, D, r, (r ? W : D) * 0.3);
    ibox(g, bx, by, bw, bd, 0, 32, tint(c, -0.1) && '#3d5d8f');
    if (r) ibox(g, X, Y - D / 2 + 5, W, 10, 0, 22, '#3d5d8f'); else ibox(g, X - W / 2 + 5, Y, 10, D, 0, 22, '#3d5d8f');
    ibox(g, X, Y, W, D, 0, 12, c);
    if (r) { ibox(g, X, Y - D * 0.22, W * 0.7, D * 0.4, 12, 4, '#5e86bd', { flat: true }); ibox(g, X, Y + D * 0.22, W * 0.7, D * 0.4, 12, 4, '#5e86bd', { flat: true }); }
    else { ibox(g, X - W * 0.22, Y + D * 0.08, W * 0.4, D * 0.7, 12, 4, '#5e86bd', { flat: true }); ibox(g, X + W * 0.22, Y + D * 0.08, W * 0.4, D * 0.7, 12, 4, '#5e86bd', { flat: true }); }
    if (r) ibox(g, X, Y + D / 2 - 5, W, 10, 0, 22, '#3d5d8f'); else ibox(g, X + W / 2 - 5, Y, 10, D, 0, 22, '#3d5d8f');
  },
  table(g, X, Y, W, D) {
    const lg = (dx, dy) => ibox(g, X + dx * (W / 2 - 5), Y + dy * (D / 2 - 5), 5, 5, 0, 13, '#8b5a2b');
    lg(-1, -1); lg(1, -1); lg(-1, 1); lg(1, 1);
    ibox(g, X, Y, W, D, 13, 4, '#c98b4a');
    ibox(g, X - W * 0.18, Y, 13, 13, 17, 1.5, '#f4f4f4', { flat: true }); ibox(g, X + W * 0.2, Y + D * 0.12, 8, 8, 17, 6, '#e8e1d0');
  },
  bed(g, X, Y, W, D, r) {
    const [hx, hy, hw, hd] = backSlab(X, Y, W, D, r, 6);
    ibox(g, hx, hy, hw, hd, 0, 30, '#7a4a24');
    ibox(g, X, Y, W, D, 0, 10, '#8b5a2b');
    ibox(g, X, Y, W - 6, D - 6, 10, 7, '#f0e4c0');
    if (r) { ibox(g, X, Y, W * 0.55 - 3, D - 6, 17, 2, '#d1543e', { flat: true }); ibox(g, X - W / 2 + 16, Y - D * 0.22, 14, D * 0.36, 17, 5, '#fdf6e3'); ibox(g, X - W / 2 + 16, Y + D * 0.22, 14, D * 0.36, 17, 5, '#fdf6e3'); }
    else { ibox(g, X, Y + D * 0.18, W - 6, D * 0.55, 17, 2, '#d1543e', { flat: true }); ibox(g, X - W * 0.22, Y - D / 2 + 16, W * 0.36, 14, 17, 5, '#fdf6e3'); ibox(g, X + W * 0.22, Y - D / 2 + 16, W * 0.36, 14, 17, 5, '#fdf6e3'); }
  },
  shelf(g, X, Y, W, D, r, d) {
    ibox(g, X, Y, W, D, 0, d.h, '#8b5a2b');
    const f = r ? faceR : faceL, cols = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22'];
    for (let k = 0; k < 3; k++) {
      f(g, X, Y, W, D, 0.06, 0.94, 5 + k * 13, 15 + k * 13, '#4b2e17');
      for (let i = 0; i < 7; i++) f(g, X, Y, W, D, 0.09 + i * 0.125, 0.09 + i * 0.125 + 0.09, 6 + k * 13, 14 + k * 13 - (i % 3), cols[(i + k) % 6]);
    }
  },
  tv(g, X, Y, W, D, r) {
    ibox(g, X, Y, W, D, 0, 14, '#6b4423');
    const [sx, sy, sw, sd] = backSlab(X, Y, W * 0.92, D * 0.92, r, 7);
    ibox(g, sx, sy, sw, sd, 14, 24, '#171a2b');
    const f = r ? faceR : faceL; f(g, sx, sy, sw, sd, 0.05, 0.95, 16, 36, '#2e3c68'); f(g, sx, sy, sw, sd, 0.12, 0.4, 28, 35, '#5a6fa8');
  },
  fridge(g, X, Y, W, D, r, d) {
    ibox(g, X, Y, W, D, 0, d.h, '#dfe6ee');
    const f = r ? faceR : faceL;
    f(g, X, Y, W, D, 0.05, 0.95, d.h * 0.62, d.h - 2, '#cfd9e6'); f(g, X, Y, W, D, 0.05, 0.95, 3, d.h * 0.6, '#e8eef6'); f(g, X, Y, W, D, 0.78, 0.86, 8, d.h * 0.5, '#7a8aa0'); f(g, X, Y, W, D, 0.78, 0.86, d.h * 0.66, d.h - 8, '#7a8aa0');
  },
  plant(g, X, Y, W, D) {
    ibox(g, X, Y, W * 0.7, D * 0.7, 0, 11, '#c0652d');
    dot(g, X, Y, 17, 8, 6.5, '#2d6e2a'); dot(g, X - 6, Y + 3, 21, 6.5, 5.5, '#3f9a3a'); dot(g, X + 6, Y - 2, 23, 6.5, 5.5, '#3f9a3a'); dot(g, X, Y, 28, 6, 5, '#4fa048'); dot(g, X - 2, Y - 3, 33, 4, 3.5, '#6cc65a');
  },
  piano(g, X, Y, W, D, r) {
    ibox(g, X, Y, W, D, 0, 26, '#23232d'); ibox(g, X, Y, W * 0.98, D * 0.98, 26, 5, '#15151c');
    const f = r ? faceR : faceL; f(g, X, Y, W, D, 0.06, 0.94, 15, 21, '#f4f4f4');
    for (let i = 1; i < 12; i++) f(g, X, Y, W, D, 0.06 + i * 0.0733, 0.067 + i * 0.0733, 15, 21, '#2a2a33');
  },
  trophy(g, X, Y) { ibox(g, X, Y, 12, 12, 0, 5, '#7a5a1e'); ibox(g, X, Y, 5, 5, 5, 8, '#e8c04a', { flat: true }); ibox(g, X, Y, 12, 12, 13, 8, '#f1c40f'); },
  teddy(g, X, Y) {
    dot(g, X, Y, 0, 9, 3.5, 'rgba(0,0,0,.2)'); dot(g, X, Y, 6, 6, 6, '#c98b4a'); dot(g, X, Y, 6.5, 3.5, 4, '#e8c78a'); dot(g, X, Y, 15, 5, 5, '#c98b4a');
    dot(g, X - 5, Y, 19, 2, 2, '#c98b4a'); dot(g, X + 5, Y, 19, 2, 2, '#c98b4a'); dot(g, X, Y, 14, 2.2, 1.6, '#e8c78a'); dot(g, X - 2, Y, 16, .8, .8, INK); dot(g, X + 2, Y, 16, .8, .8, INK); dot(g, X, Y, 14.6, .9, .6, INK);
  },
  cat(g, X, Y, W, D, r, d, now) {
    dot(g, X, Y, 0, 10, 3.5, 'rgba(0,0,0,.2)'); dot(g, X, Y, 5, 8, 5, '#e8943a'); dot(g, X - 3, Y, 6, 1.4, 4, '#c97a28'); dot(g, X + 2, Y, 6, 1.4, 4, '#c97a28');
    dot(g, X + 5, Y, 11, 4.8, 4.4, '#e8943a'); poly(g, [iso(X + 2, Y, 14), iso(X + 3, Y, 18), iso(X + 5, Y, 14)], '#e8943a'); poly(g, [iso(X + 6, Y, 14), iso(X + 8, Y, 18), iso(X + 9, Y, 13)], '#e8943a');
    dot(g, X + 4, Y, 11.5, .8, 1, INK); dot(g, X + 7, Y, 11.5, .8, 1, INK);
    const tw=Math.round(Math.sin(now/400)*3),a=iso(X-7,Y,4),b=iso(X-13,Y,10),c=iso(X-11+tw,Y,15);let last=a;for(let t=.1;t<=1.01;t+=.1){const q=[(1-t)**2*a[0]+2*t*(1-t)*b[0]+t*t*c[0],(1-t)**2*a[1]+2*t*(1-t)*b[1]+t*t*c[1]];pixelLine(g,last,q,'#bc8b51');pixelLine(g,[last[0]+1,last[1]],[q[0]+1,q[1]],'#bc8b51');last=q;}
  },
  statue(g, X, Y, W, D) {
    ibox(g, X, Y, W * 0.7, D * 0.7, 0, 18, '#8e949e'); ibox(g, X, Y, W * 0.32, D * 0.32, 18, 26, '#c4c8cf');
    dot(g, X, Y, 49, 7.5, 7.5, INK); dot(g, X, Y, 49, 6.5, 6.5, '#c4c8cf');
  },
  fountain(g, X, Y, W, D, r, d, now) {
    ibox(g, X, Y, W, D, 0, 12, '#aab4c4');
    poly(g, [iso(X - W / 2 + 5, Y - D / 2 + 5, 12), iso(X + W / 2 - 5, Y - D / 2 + 5, 12), iso(X + W / 2 - 5, Y + D / 2 - 5, 12), iso(X - W / 2 + 5, Y + D / 2 - 5, 12)], '#6cc6d6', INK);
    ibox(g, X, Y, 8, 8, 12, 16, '#cfd6e0');
    for (let i = 0; i < 8; i++) { const ph = (now / 700 + i / 8) % 1, a = i * 0.785, rr = ph * 16, [px, py] = iso(X + Math.cos(a) * rr, Y + Math.sin(a) * rr, 30 - ph * ph * 24); g.fillStyle = 'rgba(190,235,250,.95)'; g.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2); }
  },
  flag(g, X, Y, W, D, r, d, now) {
    ibox(g, X, Y, 4, 4, 0, d.h, '#7a4a24'); const [px, py] = iso(X, Y, d.h), w = Math.sin(now / 250) * 2;
    poly(g, [[px, py], [px + 22, py + 3 + w], [px + 22, py + 15 + w], [px, py + 13]], '#e74c3c', INK);
  },
  crate(g, X, Y, W, D, r, d) { ibox(g, X, Y, W, D, 0, d.h, '#c98b4a'); faceL(g, X, Y, W, D, 0.04, 0.96, d.h * 0.42, d.h * 0.52, '#8b5a2b'); faceR(g, X, Y, W, D, 0.04, 0.96, d.h * 0.42, d.h * 0.52, '#6b4423'); },
  barrel(g, X, Y, W, D, r, d) { ibox(g, X, Y, W * 0.9, D * 0.9, 0, d.h, '#8b5a2b'); for (const z of [5, d.h - 8]) ibox(g, X, Y, W * 0.94, D * 0.94, z, 3, '#3a3f4a'); },
  signpost(g, X, Y, W, D, r, d) { ibox(g, X, Y, 5, 5, 0, d.h, '#8b5a2b'); ibox(g, X, Y, 22, 4, d.h - 16, 12, '#e8c66a'); },
  mailbox(g, X, Y) { ibox(g, X, Y, 5, 5, 0, 24, '#6b4423'); ibox(g, X, Y, 18, 10, 24, 13, '#2e7bb5'); const [px, py] = iso(X + 9, Y, 36); poly(g, [[px, py], [px + 8, py - 2], [px + 8, py + 4], [px, py + 4]], '#e74c3c', INK); },
  toolbox(g, X, Y, W, D, r, d) { ibox(g, X, Y, W, D, 0, d.h, '#c0392b'); ibox(g, X, Y, W * 0.5, 4, d.h, 5, '#3a3f4a'); },
  hut(g, X, Y, W, D) {
    ibox(g, X, Y, W, D, 0, 34, '#c9a869');
    const ap = iso(X, Y, 64); poly(g, [iso(X - W / 2, Y + D / 2, 34), iso(X + W / 2, Y + D / 2, 34), ap], '#a8552f', INK); poly(g, [iso(X + W / 2, Y - D / 2, 34), iso(X + W / 2, Y + D / 2, 34), ap], '#8a4426', INK);
    faceL(g, X, Y, W, D, 0.38, 0.62, 0, 20, '#4a2f18');
  },
  lantern(g, X, Y, W, D, r, d, now) {
    ibox(g, X, Y, 5, 5, 0, 18, '#3a3f4a'); ibox(g, X, Y, 12, 12, 18, 11, '#ffd36a');
    lampGlow(g, X, Y, 24, now);
  },
  armchair(g, X, Y, W, D, r) {
    const [bx, by, bw, bd] = backSlab(X, Y, W, D, r, 8); ibox(g, bx, by, bw, bd, 0, 32, '#a8553a');
    if (r) { ibox(g, X, Y - D / 2 + 4, W, 8, 0, 20, '#a8553a'); ibox(g, X, Y + D / 2 - 4, W, 8, 0, 20, '#a8553a'); } else { ibox(g, X - W / 2 + 4, Y, 8, D, 0, 20, '#a8553a'); ibox(g, X + W / 2 - 4, Y, 8, D, 0, 20, '#a8553a'); }
    ibox(g, X, Y, W, D, 0, 12, '#c0654a'); ibox(g, X, Y, W * 0.6, D * 0.6, 12, 4, '#d97a5e', { flat: true });
  },
  coffeetable(g, X, Y, W, D) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ibox(g, X + dx * (W / 2 - 4), Y + dy * (D / 2 - 4), 4, 4, 0, 10, '#8b5a2b');
    ibox(g, X, Y, W, D, 10, 4, '#a8703a'); ibox(g, X + W * 0.15, Y, 8, 8, 14, 5, '#f4f4f4'); dot(g, X + W * 0.15, Y, 19.5, 3.5, 2, '#6b4423');
  },
  stool(g, X, Y, W, D) { for (const dx of [-1, 1]) for (const dy of [-1, 1]) ibox(g, X + dx * (W / 2 - 3), Y + dy * (D / 2 - 3), 3, 3, 0, 10, '#8b5a2b'); ibox(g, X, Y, W, D, 10, 4, '#d65a4a'); },
  fireplace(g, X, Y, W, D, r, d, now) {
    ibox(g, X, Y, W, D, 0, d.h, '#a8584a'); ibox(g, X, Y, W * 1.06, D * 1.06, d.h - 5, 5, '#6b4423');
    const f = r ? faceR : faceL; f(g, X, Y, W, D, 0.22, 0.78, 0, 28, '#2a1a14'); f(g, X, Y, W, D, 0.3, 0.7, 0, 6, '#5a3a24');
    const fx = r ? X + W / 2 - 1 : X, fy = r ? Y : Y + D / 2 - 1, fl = Math.sin(now / 130) * 1.2;
    dot(g, fx, fy, 9, 7, 5 + fl, '#e8541a'); dot(g, fx, fy, 10, 4.5, 4 - fl / 2, '#ffb02e'); dot(g, fx, fy, 11, 2, 2.5, '#fff0a0');
  },
  bedsingle: (g, X, Y, W, D, r) => bedArt(g, X, Y, W, D, r, '#8b5a2b', '#5a8a5a', 1),
  bedking: (g, X, Y, W, D, r) => bedArt(g, X, Y, W, D, r, '#4a2f18', '#7a3a8a', 2),
  wardrobe(g, X, Y, W, D, r, d) {
    ibox(g, X, Y, W, D, 0, d.h, '#8b5a2b'); const f = r ? faceR : faceL;
    f(g, X, Y, W, D, 0.06, 0.48, 4, d.h - 4, '#7a4f2a'); f(g, X, Y, W, D, 0.52, 0.94, 4, d.h - 4, '#7a4f2a'); f(g, X, Y, W, D, 0.41, 0.45, 28, 34, '#e8c04a'); f(g, X, Y, W, D, 0.55, 0.59, 28, 34, '#e8c04a');
  },
  nightstand(g, X, Y, W, D, r, d) { ibox(g, X, Y, W, D, 0, d.h, '#a8703a'); const f = r ? faceR : faceL; f(g, X, Y, W, D, 0.12, 0.88, 3, 12, '#8b5a2b'); f(g, X, Y, W, D, 0.44, 0.56, 7, 9, '#e8c04a'); },
  dresser(g, X, Y, W, D, r, d) {
    ibox(g, X, Y, W, D, 0, d.h, '#a8703a'); const f = r ? faceR : faceL;
    for (let k = 0; k < 3; k++) { f(g, X, Y, W, D, 0.05, 0.95, 3 + k * 8, 9 + k * 8, '#c98b4a'); f(g, X, Y, W, D, 0.45, 0.55, 5 + k * 8, 7 + k * 8, '#e8c04a'); }
  },
  stove(g, X, Y, W, D, r, d) {
    ibox(g, X, Y, W, D, 0, d.h, '#cfd5dc'); const f = r ? faceR : faceL;
    f(g, X, Y, W, D, 0.1, 0.9, 3, 19, '#2a2d36'); f(g, X, Y, W, D, 0.2, 0.8, 6, 16, '#5a5f6b');
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) dot(g, X + dx * W * 0.22, Y + dy * D * 0.22, d.h + 0.5, 5, 2.5, '#2a2d36');
  },
  counter(g, X, Y, W, D, r, d) {
    ibox(g, X, Y, W, D, 0, d.h - 3, '#c98b4a'); ibox(g, X, Y, W * 1.03, D * 1.03, d.h - 3, 3, '#e8e1d0'); const f = r ? faceR : faceL;
    f(g, X, Y, W, D, 0.05, 0.48, 3, d.h - 6, '#a8703a'); f(g, X, Y, W, D, 0.52, 0.95, 3, d.h - 6, '#a8703a');
  },
  sink(g, X, Y, W, D, r, d) {
    ART.counter(g, X, Y, W, D, r, d);
    poly(g, [iso(X - W * 0.3, Y - D * 0.3, d.h + 0.5), iso(X + W * 0.3, Y - D * 0.3, d.h + 0.5), iso(X + W * 0.3, Y + D * 0.3, d.h + 0.5), iso(X - W * 0.3, Y + D * 0.3, d.h + 0.5)], '#9fc5d8', INK);
    const [fx, fy] = r ? [X - W / 2 + 5, Y] : [X, Y - D / 2 + 5]; ibox(g, fx, fy, 3, 3, d.h, 9, '#9aa0aa');
  },
  cupboard(g, X, Y, W, D, r, d) {
    ibox(g, X, Y, W, D, 0, d.h, '#7b5a3a'); const f = r ? faceR : faceL;
    f(g, X, Y, W, D, 0.05, 0.48, 4, d.h - 4, '#8f6a45'); f(g, X, Y, W, D, 0.52, 0.95, 4, d.h - 4, '#8f6a45'); f(g, X, Y, W, D, 0.12, 0.42, d.h * 0.5, d.h - 10, '#8fd0f0'); f(g, X, Y, W, D, 0.58, 0.88, d.h * 0.5, d.h - 10, '#8fd0f0');
  },
  desk(g, X, Y, W, D, r, d) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ibox(g, X + dx * (W / 2 - 4), Y + dy * (D / 2 - 4), 4, 4, 0, d.h - 4, '#6b4423');
    ibox(g, X, Y, W, D, d.h - 4, 4, '#c98b4a'); ibox(g, X - W * 0.2, Y, 12, 9, d.h, 1.5, '#f4f4f4', { flat: true }); ibox(g, X + W * 0.25, Y + D * 0.1, 5, 5, d.h, 8, '#3498db');
  },
  officechair(g, X, Y, W, D, r) {
    dot(g, X, Y, 1.5, 7, 3.5, '#2a2d36'); ibox(g, X, Y, 3, 3, 1, 11, '#3a3f4a'); ibox(g, X, Y, W * 0.8, D * 0.8, 12, 5, '#3d5d8f');
    const [bx, by, bw, bd] = backSlab(X, Y, W * 0.8, D * 0.8, r, 4); ibox(g, bx, by, bw, bd, 17, 15, '#3d5d8f');
  },
  globe(g, X, Y) { ibox(g, X, Y, 10, 10, 0, 4, '#7a4a24'); ibox(g, X, Y, 2, 2, 4, 6, '#9aa0aa'); dot(g, X, Y, 15, 7, 7, '#3a7bb5'); dot(g, X - 2, Y, 16, 3, 3.5, '#5fa844'); dot(g, X + 3, Y, 13, 2, 2.5, '#5fa844'); },
  computer(g, X, Y, W, D, r) {
    ibox(g, X, Y, 8, 8, 0, 3, '#3a3f4a'); const [sx, sy, sw, sd] = backSlab(X, Y, W, D, r, 5); ibox(g, sx, sy, sw, sd, 3, 17, '#171a2b');
    const f = r ? faceR : faceL; f(g, sx, sy, sw, sd, 0.08, 0.92, 5, 18, '#5a8fd0'); f(g, sx, sy, sw, sd, 0.12, 0.5, 12, 17, '#9cc4ee');
  },
  vase(g, X, Y) { ibox(g, X, Y, 8, 8, 0, 10, '#3a7bb5'); dot(g, X - 3, Y, 15, 2.5, 2.5, '#e84a5f'); dot(g, X + 3, Y, 16, 2.5, 2.5, '#f1c40f'); dot(g, X, Y, 18, 2.5, 2.5, '#fff3d6'); dot(g, X, Y, 12, 5, 2, '#3f9a3a'); },
  floorlamp(g, X, Y, W, D, r, d, now) {
    ibox(g, X, Y, 10, 10, 0, 3, '#3a3f4a'); ibox(g, X, Y, 3, 3, 3, 36, '#3a3f4a'); ibox(g, X, Y, 14, 14, 38, 12, '#ffd36a'); lampGlow(g, X, Y, 44, now);
  },
  roundrug(g, X, Y, W, D) {
    const ring = (k, c, s) => { const out = []; for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; out.push(iso(X + Math.cos(a) * (W / 2 - k), Y + Math.sin(a) * (D / 2 - k), 1)); } poly(g, out, c, s); };
    ring(0, '#1f5a78', INK); ring(3, '#e8d6a0'); ring(7, '#3f8fb5'); ring(15, '#2e6e8e'); ring(22, '#e8d6a0');
  },
  aquarium(g, X, Y, W, D, r, d, now) {
    ibox(g, X, Y, W, D, 0, 12, '#6b4423'); ibox(g, X, Y, W * 0.95, D * 0.9, 12, 20, '#6cc6d6', { left: 'rgba(140,215,240,.75)', right: 'rgba(90,170,200,.8)', top: 'rgba(170,230,250,.8)' });
    ibox(g, X, Y, W * 0.9, D * 0.85, 12, 3, '#e8d6a0', { flat: true }); dot(g, X - W * 0.25, Y, 16, 3, 4, '#3f9a3a');
    const sw = Math.sin(now / 700) * W * 0.28; dot(g, X + sw, Y, 24, 3.5, 2, '#ff9a3c'); dot(g, X - sw * 0.7, Y, 20, 3, 1.8, '#e84a5f');
  },
};
// ฉากกั้น: แผ่นบางตั้งพื้น ด้านยาวที่เห็น = faceL (ตั้งตามแกน x) หรือ faceR (หมุนแล้วตามแกน y)
const screenFrame = (g, X, Y, W, D, r, d, c) => { const f = r ? faceR : faceL; ibox(g, X, Y, W, D, 0, d.h, c); return f; };
Object.assign(ART, {
  screen_wood(g, X, Y, W, D, r, d) {
    const f = screenFrame(g, X, Y, W, D, r, d, '#7a4f2a');
    for (let k = 0; k < 3; k++) { const a = k / 3 + 0.02, b = (k + 1) / 3 - 0.02, c = k & 1 ? '#c98b4a' : '#b87a3c'; f(g, X, Y, W, D, a, b, 5, d.h - 6, c); f(g, X, Y, W, D, a + 0.03, b - 0.03, 9, d.h - 12, k & 1 ? '#d9a05c' : '#c98b4a'); }
  },
  screen_shoji(g, X, Y, W, D, r, d) {
    const f = screenFrame(g, X, Y, W, D, r, d, '#5a3a1e');
    f(g, X, Y, W, D, 0.03, 0.97, 4, d.h - 4, '#f6f0dc');
    for (let k = 1; k < 4; k++) f(g, X, Y, W, D, k / 4 - 0.012, k / 4 + 0.012, 4, d.h - 4, '#6b4423');
    for (const z of [d.h * 0.33, d.h * 0.66]) f(g, X, Y, W, D, 0.03, 0.97, z - 1, z + 1, '#6b4423');
  },
  screen_lattice(g, X, Y, W, D, r, d) {
    const f = screenFrame(g, X, Y, W, D, r, d, '#6b4423');
    f(g, X, Y, W, D, 0.04, 0.96, 6, d.h - 6, '#e8d6a0');
    for (let k = 0; k <= 8; k++) f(g, X, Y, W, D, k / 8 * 0.9 + 0.035, k / 8 * 0.9 + 0.065, 6, d.h - 6, '#8b5a2b');
    for (let z = 6; z < d.h - 6; z += 10) f(g, X, Y, W, D, 0.04, 0.96, z, z + 2.5, '#8b5a2b');
  },
  screen_glass(g, X, Y, W, D, r, d) {
    ibox(g, X, Y, W, D, 0, 5, '#9aa0aa'); ibox(g, X, Y, W, D, d.h - 4, 4, '#9aa0aa');
    ibox(g, X, Y, W * 0.97, D * 0.7, 5, d.h - 9, '#cfe8f5', { left: 'rgba(205,230,245,.7)', right: 'rgba(150,190,215,.75)', top: 'rgba(225,242,252,.8)' });
    const f = r ? faceR : faceL; f(g, X, Y, W, D, 0.12, 0.2, 14, d.h - 12, 'rgba(255,255,255,.55)'); f(g, X, Y, W, D, 0.26, 0.29, 22, d.h - 12, 'rgba(255,255,255,.45)');
  },
  screen_bamboo(g, X, Y, W, D, r, d) {
    const f = screenFrame(g, X, Y, W, D, r, d, '#7d6a2a');
    for (let k = 0; k < 8; k++) { const a = k / 8 + 0.008, b = (k + 1) / 8 - 0.008; f(g, X, Y, W, D, a, b, 4, d.h - 3, k & 1 ? '#c9b458' : '#b8a24a'); f(g, X, Y, W, D, a, b, d.h * 0.45, d.h * 0.45 + 2, '#7d6a2a'); f(g, X, Y, W, D, a, b, d.h * 0.8, d.h * 0.8 + 2, '#7d6a2a'); }
  },
  lowwall(g, X, Y, W, D, r, d) {
    ibox(g, X, Y, W, D, 0, d.h - 4, '#e8e1d0'); ibox(g, X, Y, W * 1.04, D * 1.4, d.h - 4, 4, '#c98b4a');
    const f = r ? faceR : faceL; for (let k = 0; k < 4; k++) f(g, X, Y, W, D, k / 4 + 0.03, k / 4 + 0.22, 5, d.h - 8, '#d8d0bc');
  },
});
// V2 silhouette/detail passes. World footprints and authored top heights retained.
const furnitureOriginal={...ART};
ART.chair=(g,X,Y,W,D,r)=>{
 const [bx,by,bw,bd]=backSlab(X,Y,W*.9,D*.9,r,5);
 ibox(g,bx,by,bw,bd,0,30,'#a8703a');
 for(const a of [-1,1])for(const b of [-1,1])ibox(g,X+a*(W*.45-2),Y+b*(D*.45-2),3,3,0,10,'#8b5a2b');
 ibox(g,X,Y,W*.9,D*.9,10,2,'#c98b4a');ibox(g,X,Y,W*.7,D*.7,12,3,'#d65a4a',{flat:true});
 const f=r?faceR:faceL;f(g,bx,by,bw,bd,.14,.86,20,27,'#c98b4a');f(g,bx,by,bw,bd,.22,.78,21,25,'#a8703a');
};
ART.barrel=(g,X,Y,W,D,r,d)=>{
 const N=12,z=d.h,rx=W*.45,ry=D*.45;
 const ring=(h,k=1)=>Array.from({length:N},(_,i)=>{const a=i/N*Math.PI*2;return iso(X+Math.cos(a)*rx*k,Y+Math.sin(a)*ry*k,h);});
 const low=ring(1,.88),mid=ring(z*.5),top=ring(z,.88);
 // Back-to-front face order for visible sides of the cylinder.
 const faces=[];for(let i=0;i<N;i++){const j=(i+1)%N;faces.push({i,j,y:(mid[i][1]+mid[j][1])/2});}faces.sort((a,b)=>a.y-b.y);
 for(const {i,j} of faces){const shade=(i%3)*.06-.12;poly(g,[top[i],top[j],mid[j],low[j],low[i],mid[i]],tint('#8b5a2b',shade),INK);}
 for(const hh of [5,z-7]){const aa=ring(hh,hh<z*.5?.96:.94),bb=ring(hh+3,.95);for(const {i,j} of faces){const ang=(i+.5)/N*Math.PI*2;if(Math.cos(ang)+Math.sin(ang)>0)poly(g,[aa[i],aa[j],bb[j],bb[i]],'#59666b','#414e59');}}
 poly(g,top,'#b18b5e',INK);for(let u=-rx*.5;u<=rx*.5;u+=5)pixelLine(g,iso(X+u,Y-ry*.62,z),iso(X+u,Y+ry*.62,z),'#866346');dot(g,X,Y,z+.5,2,1,'#604a3a');
};
ART.trophy=(g,X,Y)=>{
 ibox(g,X,Y,12,12,0,5,'#7a5a1e');ibox(g,X,Y,4,4,5,8,'#e8c04a',{flat:true});
 const [x,y]=iso(X,Y,19);
 poly(g,[[x-6,y-3],[x+6,y-3],[x+4,y+4],[x,y+7],[x-4,y+4]],'#c9a75d',INK);
 poly(g,[[x-5,y-2],[x-1,y-2],[x-1,y+5],[x-3,y+3]],'#eed69a');
 for(const dir of [-1,1]){pixelLine(g,[x+dir*6,y-2],[x+dir*8,y-2],'#d7b86b');pixelLine(g,[x+dir*8,y-2],[x+dir*7,y+3],'#d7b86b');pixelLine(g,[x+dir*7,y+3],[x+dir*4,y+4],'#d7b86b');}
};
ART.plant=(g,X,Y,W,D)=>{
 ibox(g,X,Y,W*.7,D*.7,0,10,'#c0652d');ibox(g,X,Y,W*.74,D*.74,8,3,'#c0652d');
 dot(g,X,Y,11,8,3,'#453c34');pixelLine(g,iso(X,Y,12),iso(X,Y,30),'#557b4c');
 for(const [dx,dy,z,rx,ry] of [[0,0,17,8,6],[-6,3,21,7,5],[6,-2,23,6,5],[0,0,28,6,5],[-2,-3,33,4,3]]){
  dot(g,X+dx,Y+dy,z,rx,ry,'#365545');dot(g,X+dx-1,Y+dy,z+1,rx-1,ry-1,'#557b4c');dot(g,X+dx-2,Y+dy,z+2,Math.max(1,rx-3),Math.max(1,ry-3),'#9aaf6e');
 }
};
ART.hut=(g,X,Y,W,D,r,d,now)=>{
 furnitureOriginal.hut(g,X,Y,W,D,r,d,now);
 // Roof courses follow each triangular plane, never extend the base.
 const apex=iso(X,Y,64),A=iso(X-W/2,Y+D/2,34),B=iso(X+W/2,Y+D/2,34),C=iso(X+W/2,Y-D/2,34);
 for(let t=.25;t<1;t+=.18){const lerp=q=>[apex[0]+(q[0]-apex[0])*t,apex[1]+(q[1]-apex[1])*t];pixelLine(g,lerp(A),lerp(B),'#c08a65');pixelLine(g,lerp(B),lerp(C),'#624b3e');}
 faceL(g,X,Y,W,D,.08,.27,13,26,'#604a3a');faceL(g,X,Y,W,D,.10,.25,15,24,'#a4c7c7');faceL(g,X,Y,W,D,.16,.18,15,24,'#604a3a');
 faceR(g,X,Y,W,D,.2,.55,12,25,'#604a3a');faceR(g,X,Y,W,D,.23,.52,14,23,'#88a9af');
};
const rawRug=ART.rug;ART.rug=(g,X,Y,W,D)=>{rawRug(g,X,Y,W,D);for(const a of [-1,1])for(const b of [-1,1]){const xx=X+a*W*.28,yy=Y+b*D*.28;poly(g,[iso(xx-3,yy,1),iso(xx,yy-3,1),iso(xx+3,yy,1),iso(xx,yy+3,1)],'#d2bb83');}};

// Inset joinery on large cabinet doors.
for(const key of ['wardrobe','counter','cupboard']){
 const original=ART[key];ART[key]=(g,X,Y,W,D,r,d,now)=>{
  original(g,X,Y,W,D,r,d,now);const f=r?faceR:faceL;
  for(const [a,b] of [[.09,.45],[.55,.91]]){
   const top=key==='cupboard'?d.h*.43:d.h-8;
   f(g,X,Y,W,D,a,b,6,top,'#604a3a');f(g,X,Y,W,D,a+.025,b-.025,7,top-1,'#a18159');
   f(g,X,Y,W,D,a+.04,a+.06,8,top-2,'#c1a16e');
  }
  if(key!=='cupboard'){f(g,X,Y,W,D,.40,.44,d.h*.42,d.h*.42+3,'#d2bb83');f(g,X,Y,W,D,.56,.60,d.h*.42,d.h*.42+3,'#d2bb83');}
 };
}
function artGeneric(g, X, Y, W, D, r, d) { ibox(g, X, Y, W * 0.85, D * 0.85, 0, (d.h || 24) * 0.8, '#9aa0aa'); }
// ===== จบบล็อก furniture-kit-v2 =====
  // ของติดผนัง (จาก drawWallItem ของชุด) วาดที่ U = 0 แล้วเลื่อนตอนวาดจริง
  const wallPt = (wl, u, z) => (wl === 'n' ? iso(u, FY0, z) : iso(FX0, u, z));
  const wallRect = (g, wl, u0, u1, z0, z1, fill, stroke) => poly(g, [wallPt(wl, u0, z0), wallPt(wl, u1, z0), wallPt(wl, u1, z1), wallPt(wl, u0, z1)], fill, stroke);
  function wallArt(g, f, d, wl) {
    const U = 0, hw = (d.w || 1) * TS / 2, hh = (d.h || 30) / 2, zc = 60;
    const ring = R => { const out = []; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; out.push(wallPt(wl, U + Math.cos(a) * R, zc + Math.sin(a) * R)); } return out; };
  if (f === 'painting') {
    wallRect(g, wl, U - hw, U + hw, zc - hh, zc + hh, '#c98b4a', INK); wallRect(g, wl, U - hw + 4, U + hw - 4, zc - hh + 4, zc + hh - 4, '#8fd0f0');
    wallRect(g, wl, U - hw + 4, U + hw - 4, zc - hh + 4, zc - 2, '#5fa844'); wallRect(g, wl, U - hw + 8, U - 2, zc - 2, zc + 6, '#4a8a3a'); wallRect(g, wl, U + hw - 14, U + hw - 8, zc + 4, zc + 10, '#ffe08a');
  } else if (f === 'clock') {
    poly(g, ring(14), '#3a3f4a', INK); poly(g, ring(11.5), '#fff8e7');
    pixelLine(g,wallPt(wl,U,zc),wallPt(wl,U,zc+8),INK);pixelLine(g,wallPt(wl,U,zc),wallPt(wl,U+6,zc-1),INK);for(const [u,z] of [[0,9],[9,0],[0,-9],[-9,0]])poly(g,[wallPt(wl,U+u-1,zc+z-1),wallPt(wl,U+u+1,zc+z-1),wallPt(wl,U+u+1,zc+z+1),wallPt(wl,U+u-1,zc+z+1)],'#a58d62');
  } else if (f === 'map') {
    wallRect(g, wl, U - hw, U + hw, zc - hh, zc + hh, '#8b5a2b', INK); wallRect(g, wl, U - hw + 3, U + hw - 3, zc - hh + 3, zc + hh - 3, '#e8d6a0');
    wallRect(g, wl, U - hw + 8, U - 6, zc - 8, zc + 8, '#6cc6d6'); wallRect(g, wl, U - 2, U + 18, zc - 2, zc + 10, '#7bc65a'); wallRect(g, wl, U + 4, U + 14, zc - 12, zc - 5, '#5fa844');
  } else if (f === 'records') {
    const cols = ['#e84a5f', '#2e9e6b', '#8a5bd1'], n = 3, sw = hw * 2 / n;
    for (let k = 0; k < n; k++) {
      const u0 = U - hw + k * sw + 1, u1 = u0 + sw - 2; wallRect(g, wl, u0, u1, zc - hh, zc + hh, '#2b2f55', INK);
      const uc = (u0 + u1) / 2; wallRect(g, wl, uc - 5, uc + 5, zc - 5, zc + 5, cols[k]); wallRect(g, wl, uc - 1.5, uc + 1.5, zc - 1.5, zc + 1.5, '#fff3d6');
    }
  } else if (f === 'mirror') {
    wallRect(g, wl, U - hw, U + hw, zc - hh, zc + hh, '#c9a24a', INK); wallRect(g, wl, U - hw + 4, U + hw - 4, zc - hh + 4, zc + hh - 4, '#cfe8f5');
    wallRect(g, wl, U - hw + 7, U - hw + 12, zc + 2, zc + hh - 7, '#f4fbff'); wallRect(g, wl, U - hw + 14, U - hw + 17, zc + 8, zc + hh - 7, '#f4fbff');
  } else if (f === 'poster') {
    wallRect(g, wl, U - hw, U + hw, zc - hh, zc + hh, '#f4ecd8', INK); wallRect(g, wl, U - hw + 4, U + hw - 4, zc - hh + 4, zc + 4, '#e8a33a');
    wallRect(g, wl, U - hw + 4, U + hw - 4, zc - hh + 4, zc - 6, '#3a7bb5'); wallRect(g, wl, U - 6, U + 6, zc - 6, zc + 2, '#c0453a'); wallRect(g, wl, U - hw + 6, U + hw - 6, zc + hh - 8, zc + hh - 5, '#8b5a2b');
  } else if (f === 'wreath') {
    poly(g, ring(13), '#2d6e2a', INK); poly(g, ring(9), '#3f9a3a'); poly(g, ring(5), '#2d6e2a'); wallRect(g, wl, U - 4, U + 4, zc - 13, zc - 7, '#e74c3c');
  } else wallRect(g, wl, U - hw, U + hw, zc - hh, zc + hh, '#c98b4a', INK);
  }
  const ANIM = { cat: 1, fountain: 1, flag: 1, lantern: 1, fireplace: 1, floorlamp: 1, aquarium: 1 };
  const CW = 340, CH = 300, OX = 170, OY = 210; // ผืนวาดชั่วคราว (ชิ้นใหญ่สุด เตียงคิงไซส์ 198×128)
  function trim(cv, ox, oy) { // ตัดขอบโปร่งใสออก คืนจุดยึด
    const w = cv.width, h = cv.height, a = cv.getContext('2d').getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return { cv: factory(1, 1), ax: 0, ay: 0 };
    const out = factory(x1 - x0 + 1, y1 - y0 + 1); out.getContext('2d').drawImage(cv, -x0, -y0); return { cv: out, ax: ox - x0, ay: oy - y0 };
  }
  function sprite(f, d, r, now, shadow, W, D) {
    const cv = factory(CW, CH), g = cv.getContext('2d'); g.translate(OX, OY);
    if (shadow && !d.flat) poly(g, [iso(-W / 2 - 2, -D / 2 - 2), iso(W / 2 + 2, -D / 2 - 2), iso(W / 2 + 2, D / 2 + 2), iso(-W / 2 - 2, D / 2 + 2)], 'rgba(40,20,5,.2)'); // เงาบนพื้น
    (ART[f] || artGeneric)(g, 0, 0, W, D, r, d, now || 0);
    return trim(cv, OX, OY);
  }
  function wall(f, d, wl) {
    const cv = factory(CW, CH), g = cv.getContext('2d'), [bx, by] = wallPt(wl, 0, 0); g.translate(OX - bx, OY - by);
    wallArt(g, f, d, wl); return trim(cv, OX, OY);
  }
  // พื้นและผนังห้อง: วาดด้วยคำสั่งแคนวาสปกติ แต่เติมสีทีละพิกเซล (ไม่มีขอบเบลอ) ที่ 1 px เกม → เส้นคมต่อเนื่อง ไม่เป็นเส้นประ
  const rgba = s => { s = String(s).trim(); let m; if (s[0] === '#') { const [r, g, b] = hex(s.slice(0, 7)); return [r, g, b, 1]; } if ((m = /rgba?\(([^)]+)\)/.exec(s))) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; } return [0, 0, 0, 1]; };
  class Room {
    constructor(x0, y0, w, h) { this.w = w; this.h = h; this.d = new Float32Array(w * h * 4); this.st = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, tx: -x0, ty: -y0 }; this.stack = []; this.subs = []; this.cur = null; }
    get fillStyle() { return this.st.fillStyle; } set fillStyle(v) { this.st.fillStyle = v; }
    get strokeStyle() { return this.st.strokeStyle; } set strokeStyle(v) { this.st.strokeStyle = v; }
    get lineWidth() { return this.st.lineWidth; } set lineWidth(v) { this.st.lineWidth = v; }
    get globalAlpha() { return this.st.globalAlpha; } set globalAlpha(v) { this.st.globalAlpha = v; }
    save() { this.stack.push(Object.assign({}, this.st)); } restore() { if (this.stack.length) this.st = this.stack.pop(); }
    translate(x, y) { this.st.tx += x; this.st.ty += y; }
    P(x, y) { return [x + this.st.tx, y + this.st.ty]; }
    beginPath() { this.subs = []; this.cur = null; }
    moveTo(x, y) { this.cur = [this.P(x, y)]; this.subs.push(this.cur); }
    lineTo(x, y) { if (!this.cur) return this.moveTo(x, y); this.cur.push(this.P(x, y)); }
    closePath() { if (this.cur) this.cur.closed = true; }
    px(x, y, c, a) { if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return; const o = (y * this.w + x) * 4, da = this.d[o + 3], oa = a + da * (1 - a); for (let k = 0; k < 3; k++) this.d[o + k] = (c[k] * a + this.d[o + k] * da * (1 - a)) / oa; this.d[o + 3] = oa; }
    fillRect(x, y, w, h) { const c = rgba(this.st.fillStyle), a = c[3] * this.st.globalAlpha, [x0, y0] = this.P(x, y); for (let j = Math.round(y0); j < Math.round(y0 + h); j++) for (let i = Math.round(x0); i < Math.round(x0 + w); i++) this.px(i, j, c, a); }
    fill() {
      const c = rgba(this.st.fillStyle), a = c[3] * this.st.globalAlpha, all = this.subs.filter(s => s.length > 2); if (!all.length) return;
      let ymin = 1e9, ymax = -1e9; for (const s of all) for (const p of s) { if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1]; }
      for (let y = Math.max(0, Math.floor(ymin)); y <= Math.min(this.h - 1, Math.ceil(ymax)); y++) {
        const cy = y + 0.5, xs = []; for (const s of all) for (let i = 0, j = s.length - 1; i < s.length; j = i++) { const [xi, yi] = s[i], [xj, yj] = s[j]; if ((yi > cy) !== (yj > cy)) xs.push(xi + (cy - yi) / (yj - yi) * (xj - xi)); }
        xs.sort((p, q) => p - q); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x < Math.ceil(xs[k + 1] - 0.5); x++) this.px(x, y, c, a);
      }
    }
    stroke() { // เส้นตรง: เดินทีละพิกเซลตามแกนยาว (เส้นเอียง 2:1 = ขั้นละ 2 px สม่ำเสมอ) ไม่ซ้ำจุด
      const c = rgba(this.st.strokeStyle), a = c[3] * this.st.globalAlpha, w = Math.max(1, Math.round(this.st.lineWidth)), seen = new Set();
      const line = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], n = Math.max(Math.abs(dx), Math.abs(dy)) || 1; for (let i = 0; i <= n; i++) { const x = Math.floor(p[0] + dx * i / n), y = Math.floor(p[1] + dy * i / n); for (let v = 0; v < w; v++) { const k = (y + v) * this.w + x; if (seen.has(k)) continue; seen.add(k); this.px(x, y + v, c, a); } } };
      for (const s of this.subs) { for (let i = 1; i < s.length; i++) line(s[i - 1], s[i]); if (s.closed && s.length > 2) line(s[s.length - 1], s[0]); }
    }
  }
  function room(draw, x0, y0, w, h) {
    const R = new Room(x0, y0, w, h); draw(R);
    const cv = factory(w, h), g = cv.getContext('2d'), img = g.createImageData(w, h), d = R.d;
    for (let i = 0; i < w * h * 4; i += 4) { img.data[i] = d[i]; img.data[i + 1] = d[i + 1]; img.data[i + 2] = d[i + 2]; img.data[i + 3] = Math.round(d[i + 3] * 255); }
    g.putImageData(img, 0, 0); return cv;
  }
  return { sprite, wall, room, anim: f => !!ANIM[f], setCanvasFactory(fn) { factory = fn; } };
})();
if (typeof module !== 'undefined') module.exports = PixelFurn;
