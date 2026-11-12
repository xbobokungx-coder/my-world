// ศิลป์พิกเซลของโลก (เฟส 1): พื้น ต้นไม้ อาคาร เคาน์เตอร์ รั้ว ดินแปลงผัก
// วาดที่ 16 px ต่อช่อง (U) แล้วให้ game.js ขยาย 2 เท่าเป็นช่อง 32 px แบบไม่เบลอ (imageSmoothingEnabled = false)
// ทุกสไปรต์สร้างครั้งเดียวแล้วเก็บแคช มีเส้นขอบเข้ม 1 px สี OUT และแสงมาจากซ้ายบน
const PixelArt = (() => {
  const { W, H, T, HOUSING, plotAt, isPaved } = Shared;
  const U = 16, OUT = '#2a1b14';

  // ---------- utils ----------
  const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  function vnoise(x, y, sc, s) {
    const fx = x / sc, fy = y / sc, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
  const dith = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const rgb = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const shade = (c, k) => { const a = rgb(c); return toHex(k < 0 ? a.map(v => v * (1 + k)) : a.map(v => v + (255 - v) * k)); }; // k<0 เข้มขึ้น k>0 สว่างขึ้น
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  // hue shift (แนวทางศิลป์ใน STYLE_GUIDE): k<0 = เงา มืดลงและเหลื่อมไปทางน้ำเงิน/ม่วง • k>0 = แสง สว่างขึ้นและเหลื่อมไปทางเหลือง/ส้ม
  function hsl(c) { const [R, G, B] = rgb(c).map(v => v / 255), mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); const h = mx === R ? (G - B) / d + (G < B ? 6 : 0) : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; return [h * 60, s, l]; }
  function fromHsl(h, s, l) { const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return toHex([f(0), f(8), f(4)].map(v => v * 255)); }
  function hue(c, k) {
    let [h, s, l] = hsl(c); const a = Math.abs(k), tgt = k < 0 ? 245 : 45, d = ((tgt - h + 540) % 360) - 180;
    h = (h + Math.sign(d) * Math.min(Math.abs(d), a * 38) + 360) % 360;
    if (k < 0) { l *= 1 + k; s = Math.min(1, s * (1 + a * .12) + a * .03); } else { l += (1 - l) * k; s *= 1 - a * .2; }
    return fromHsl(h, s, l);
  }
  const ramp = (c, d = .3, li = .22) => [hue(c, -d * 1.6), hue(c, -d), c, hue(c, li), hue(c, li * 1.9)]; // [เงาลึก, เงา, หลัก, แสง, ไฮไลต์]
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const r = (x, c, X, Y, w, h) => { x.fillStyle = c; x.fillRect(X, Y, w, h); };
  function disc(x, cx, cy, rad, c) { x.fillStyle = c; for (let dy = -rad; dy <= rad; dy++) { const w = Math.floor(Math.sqrt(rad * rad - dy * dy) + .5); x.fillRect(cx - w, cy + dy, w * 2 + 1, 1); } }
  function ell(x, cx, cy, rx, ry, c) { x.fillStyle = c; for (let dy = -ry; dy <= ry; dy++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))) + .5); x.fillRect(cx - w, cy + dy, w * 2 + 1, 1); } }
  function addOutline(c, col = OUT) {
    const x = c.getContext('2d'), w = c.width, h = c.height, d = x.getImageData(0, 0, w, h), a = d.data;
    const o = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) o[i] = a[i * 4 + 3] > 90 ? 1 : 0;
    const [R, G, B] = rgb(col);
    for (let y = 0; y < h; y++) for (let x2 = 0; x2 < w; x2++) {
      const i = y * w + x2; if (o[i]) { a[i * 4 + 3] = 255; continue; }
      if ((x2 > 0 && o[i - 1]) || (x2 < w - 1 && o[i + 1]) || (y > 0 && o[i - w]) || (y < h - 1 && o[i + w])) { a[i * 4] = R; a[i * 4 + 1] = G; a[i * 4 + 2] = B; a[i * 4 + 3] = 255; }
      else a[i * 4 + 3] = 0;
    }
    x.putImageData(d, 0, 0);
  }
  // ขอบละมุน: เส้นข้าง = สี ink อ่อน · มุมเฉียง = สี mid (pixel AA) ลดความรู้สึกคมเหลี่ยมดำ
  function addSoftOutline(c, ink, mid) {
    const x = c.getContext('2d'), w = c.width, h = c.height, d = x.getImageData(0, 0, w, h), a = d.data;
    const o = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) o[i] = a[i * 4 + 3] > 90 ? 1 : 0;
    const I = rgb(ink), M = rgb(mid);
    for (let y = 0; y < h; y++) for (let x2 = 0; x2 < w; x2++) {
      const i = y * w + x2; if (o[i]) { a[i * 4 + 3] = 255; continue; }
      const n = (x2 > 0 && o[i - 1]) || (x2 < w - 1 && o[i + 1]) || (y > 0 && o[i - w]) || (y < h - 1 && o[i + w]);
      const dgn = (x2 > 0 && y > 0 && o[i - w - 1]) || (x2 < w - 1 && y > 0 && o[i - w + 1])
        || (x2 > 0 && y < h - 1 && o[i + w - 1]) || (x2 < w - 1 && y < h - 1 && o[i + w + 1]);
      if (n) { a[i * 4] = I[0]; a[i * 4 + 1] = I[1]; a[i * 4 + 2] = I[2]; a[i * 4 + 3] = 255; }
      else if (dgn) { a[i * 4] = M[0]; a[i * 4 + 1] = M[1]; a[i * 4 + 2] = M[2]; a[i * 4 + 3] = 200; }
      else a[i * 4 + 3] = 0;
    }
    x.putImageData(d, 0, 0);
  }
  // สไปรต์มีขอบว่าง 1 px ไว้ให้เส้นขอบ: วาดที่ (x-1, y-1) · outline เป็นสีหรือ { soft:[ink,mid] }
  function mk(w, h, fn, outline = true) {
    const c = cv(w + 2, h + 2), x = c.getContext('2d');
    x.translate(1, 1); fn(x, w, h); x.setTransform(1, 0, 0, 1, 0, 0);
    if (outline && outline.soft) addSoftOutline(c, outline.soft[0], outline.soft[1]);
    else if (outline) addOutline(c, outline === true ? OUT : outline);
    return c;
  }
  // วงรีขอบ dither — ทรงมนกว่า disc ตัดเหลี่ยม
  function softPuff(x, cx, cy, rx, ry, pal, R) {
    for (let dy = -ry - 2; dy <= ry + 2; dy++) for (let dx = -rx - 2; dx <= rx + 2; dx++) {
      const nx = dx / (rx + 0.2), ny = dy / (ry + 0.2), d2 = nx * nx + ny * ny;
      if (d2 > 1.15) continue;
      // ขอบนอก dither ให้ไม่ตัดวงกลมเป๊ะ
      if (d2 > 0.92 && dith(cx + dx, cy + dy) > 0.55) continue;
      if (d2 > 1.02 && dith(cx + dx + 1, cy + dy) > 0.35) continue;
      const lit = clamp(0.52 - ny * 0.42 - nx * 0.16 + (1 - Math.min(1, d2)) * 0.3, 0, 1);
      let i = Math.floor(lit * (pal.length - 1.05));
      if (lit * (pal.length - 1) - i > dith(cx + dx, cy + dy)) i++;
      i = clamp(i, 0, pal.length - 1);
      if (d2 > 0.78) i = Math.max(0, i - 1);
      if (ny > 0.35 && d2 < 0.85) i = Math.max(0, i - 1); // เงาใต้ก้อน
      r(x, pal[i], cx + dx, cy + dy, 1, 1);
    }
    // จุดยื่นนอกพุ่ม (ทำลายขอบเรขา)
    for (let k = 0; k < 5 + Math.floor(R() * 6); k++) {
      const a = R() * Math.PI * 2, rr = Math.max(rx, ry) * (0.85 + R() * 0.35);
      const px = Math.round(cx + Math.cos(a) * rr), py = Math.round(cy + Math.sin(a) * rr * 0.9);
      r(x, pal[Math.min(pal.length - 1, 3)], px, py, 2, 1);
      r(x, pal[Math.min(pal.length - 1, 2)], px + (R() < .5 ? 1 : -1), py - 1, 1, 1);
    }
  }

  // ---------- ground ----------
  const G = 0, P = 1, SA = 2, WA = 3, FL = 4;
  const gtype = t => (t === T.WATER || t === T.BRIDGE ? WA : t === T.LANDMARK ? P : t === T.SAND ? SA : t === T.FLOOR || t === T.FURN ? FL : t === T.PATH || t === T.BUILD || t === T.SHOP || t === T.CLIFF || t === T.STAIR ? P : G);
  const BLEND = [true, true, true, true, false];
  // หญ้าเขียวอิ่มแบบ cozy village (ตรง STYLE_GUIDE + ภาพอ้างอิงลานกลางเมือง)
  const GRASS = ['#4f9a4a', '#62ae4c', '#76c256', '#8cd062', '#a8de74'].map(rgb); // เงาหญ้าเหลื่อมไปทางเขียวคราม แสงเหลื่อมไปทางเหลือง
  const PATH = ['#c2a06c', '#d2b07a', '#ddbe86'].map(rgb);
  // น้ำใส โทนเทอร์ควอยส์: ลึกกลางสระเข้ม ริมฝั่งอ่อนลง (ไล่ตามระยะจากฝั่ง)
  const WATERC = ['#1a7398', '#2a96b8', '#4ab8cc', '#7ad4e0'].map(rgb);
  const SHALLOW = rgb('#b8efe8'), SANDBED = rgb('#e2cf90'); // ริมฝั่งน้ำตื้นเห็นพื้นทรายใต้น้ำ
  const mixc = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  // พื้นโลก: วาดที่ความละเอียด K เท่าของสไปรต์ (K=2 → 32 px ต่อช่อง = 1 พิกเซลพื้น 1 พิกเซลเกม) ขอบดิน/หญ้า/ทรายเรียบละเอียดขึ้น • ของตกแต่ง (ดอกไม้ กอหญ้า กรวดใหญ่) ยังเป็นก้อนเท่าพิกเซลสไปรต์ให้เข้ากับอาคาร/ต้นไม้
  // สนามสัญญาณสุ่มคำนวณบนกริดพิกเซลศิลป์แล้ว interpolate (เร็วกว่าคำนวณทุกพิกเซลละเอียด)
  // SUNLIT TERRAIN V4: calm color areas, sparse clusters, no per-pixel grain/dither.
  // K retains the original API; optional density [0..1] controls accent groups only.
  function ground(MAP, K=1, options={}) {
    if(!Number.isInteger(K)||K<1||K>4)throw new RangeError('ground K must be an integer 1..4');
    if(MAP.length!==H||MAP.some(row=>row.length!==W))throw new Error('Unexpected map dimensions');
    const AW=W*U,AH=H*U,N=AW*AH,base=cv(AW,AH),ctx=base.getContext('2d');
    const types=new Uint8Array(N),paved=new Uint8Array(N),cells=new Uint8Array(W*H);
    const density=Math.max(0,Math.min(1,Number.isFinite(options.density)?options.density:.78));
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)cells[y*W+x]=gtype(MAP[y][x]);
    const cell=(x,y)=>x<0||y<0||x>=W||y>=H?G:cells[y*W+x];
    const TZ=Shared.TOWN_PATH_ZONE||{x0:12,y0:9,x1:44,y1:34},PD=Shared.PLAZA_DISC;
    const inTZ=(tx,ty)=>tx>=TZ.x0&&tx<=TZ.x1&&ty>=TZ.y0&&ty<=TZ.y1,inTZflat=(tx,ty)=>inTZ(tx,ty)&&tx<=TZ.x1-1; // flat = ปิด warp (เว้นคอลัมน์ขอบ x1 กันกระทบ x>=45)
    const inDisc=(tx,ty)=>!!PD&&Math.hypot(tx-PD.x,ty-PD.y)<=PD.r;
    // Round only exposed terrain corners, within the original tile footprint.
    // No random boundary jitter and no collision/map-data mutation.
    for(let y=0;y<AH;y++)for(let x=0;x<AW;x++){
      const tx=x>>4,ty=y>>4,lx=x&15,ly=y&15,t=cell(tx,ty),pv=t===P&&isPaved(tx,ty);let out=t;
      if(t!==G&&t!==FL){
        const radius=t===WA?6:4;
        const sx=lx<radius?-1:lx>=16-radius?1:0,sy=ly<radius?-1:ly>=16-radius?1:0;
        if(sx&&sy){const a=cell(tx+sx,ty),b=cell(tx,ty+sy);if(a===b&&a!==t&&a!==FL){const dx=sx<0?radius-lx:lx-(15-radius),dy=sy<0?radius-ly:ly-(15-radius);if(dx*dx+dy*dy>radius*radius)out=a;}}
      }
      // Coherent scallops 1–3 pixels deep; no independent pixel noise.
      // Dirt/sand only: traversable visual edge, never change the map grid.
      if((t===P&&!inTZflat(tx,ty))||t===SA){
        const ex=1+Math.floor(hash(Math.floor(x/5),Math.floor(y/16),810)*3);
        const ey=1+Math.floor(hash(Math.floor(x/16),Math.floor(y/5),811)*3);
        if((cell(tx,ty-1)===G&&ly<ex)||(cell(tx,ty+1)===G&&ly>15-ex)||(cell(tx-1,ty)===G&&lx<ey)||(cell(tx+1,ty)===G&&lx>15-ey))out=G;
      }
      types[y*AW+x]=out;paved[y*AW+x]=pv?1:0;
    }
    // เขตทางแคบสีทรายขอบหิน (TOWN_PATH_ZONE) • ทางในเขตไม่โดน warp/scallop • ลานวงกลม PLAZA_DISC ปูเรียบ มีวงแหวนหิน • x>=45 (เขตเล้า) ใช้ภาพเดิมทุกพิกเซล
    // ขอบพื้นคดเคี้ยวแบบวาดมือ (หญ้า/ทาง/ทราย/น้ำ): บิดพิกัดที่อ่านชนิดพื้นด้วยสัญญาณสุ่มเรียบ ±4 พิกเซลศิลป์ • ไม่ยุ่งพื้นในบ้านและใต้อาคาร/รั้ว • ปิดได้ด้วย options.warp=false • เปลี่ยนเฉพาะภาพ
    if(options.warp!==false){const src=Uint8Array.from(types);for(let y=0;y<AH;y++)for(let x=0;x<AW;x++){const mt=MAP[y>>4][x>>4];if(inTZflat(x>>4,y>>4)&&(src[y*AW+x]===P))continue;if(mt===T.BUILD||mt===T.SHOP||mt===T.FENCE||mt===T.FURN||mt===T.WALL)continue;const sx=Math.min(AW-1,Math.max(0,x+Math.round((vnoise(x,y,26,801)-.5)*9))),sy=Math.min(AH-1,Math.max(0,y+Math.round((vnoise(x,y,26,802)-.5)*9))),sv=src[sy*AW+sx];if(sv===FL||src[y*AW+x]===FL)continue;types[y*AW+x]=sv;}}
    const at=(x,y)=>x<0||y<0||x>=AW||y>=AH?G:types[y*AW+x];
    const near=(x,y,t,n)=>at(x-n,y)===t||at(x+n,y)===t||at(x,y-n)===t||at(x,y+n)===t;
    // Pixel-distance field for broad, clean shallow-water bands.
    const distance=new Uint16Array(N);for(let i=0;i<N;i++)distance[i]=types[i]===WA?4095:0;
    for(let y=0;y<AH;y++)for(let x=0;x<AW;x++){const i=y*AW+x;if(distance[i])distance[i]=Math.min(distance[i],x?distance[i-1]+1:1,y?distance[i-AW]+1:1);}
    for(let y=AH-1;y>=0;y--)for(let x=AW-1;x>=0;x--){const i=y*AW+x;if(distance[i])distance[i]=Math.min(distance[i],x<AW-1?distance[i+1]+1:1,y<AH-1?distance[i+AW]+1:1);}
    const colors={grass:['#72a23f','#79aa44','#80b14b'],path:['#d5ac6c','#deb677','#e4bf82'],sand:['#e8cb86','#efd394'],water:['#b8e3cc','#7acdc5','#51b7bd','#35a4b4','#288da5'],stone:['#c9c6aa','#d1cdb2','#c1bfa3'],wood:['#ac8960','#b6956a']};
    const cache={};const color=c=>cache[c]||(cache[c]=rgb(c));
    const img=ctx.createImageData(AW,AH),a=img.data;
    function set(x,y,col){if(x<0||y<0||x>=AW||y>=AH)return;const i=(y*AW+x)*4,c=color(col);a[i]=c[0];a[i+1]=c[1];a[i+2]=c[2];a[i+3]=255;}
    for(let y=0;y<AH;y++)for(let x=0;x<AW;x++){
      const i=y*AW+x,t=types[i];let c;
      if(t===G){
        const n=vnoise(x,y,96,701)*.72+vnoise(x,y,40,702)*.28;
        c=colors.grass[n<.40?0:n>.64?2:1];
        if(near(x,y,P,1)||near(x,y,SA,1))c='#4f8136';else if(near(x,y,P,3)||near(x,y,SA,3))c='#a1c45d';
      }else if(t===P){
        const n=vnoise(x,y,66,710),tx=x>>4,ty=y>>4;
        if(inTZ(tx,ty)){
          c=['#dcc490','#e3cc9a','#e9d4a4'][n<.38?0:n>.63?2:1];
          const dsc=inDisc(tx,ty),dcx=PD?(PD.x+.5)*U:0,dcy=PD?(PD.y+.5)*U:0,dd=dsc?Math.hypot(x+.5-dcx,y+.5-dcy):0;
          if(dsc){
            if(hash(x>>1,y>>1,717)>.965)c='#bfb49a';else if(hash(x>>1,y>>1,718)>.985)c='#f0dfb4';
            const R0=PD.r*U+.5*U;if(Math.abs(dd-2.4*U)<.6)c='#c8bfa4';
            // วงแหวนหินกว้าง 2 พิกเซล: เว้นตรงปากทางที่ต่อถนน
            if(dd>=R0-2*1.0-1){const ox=(x+.5-dcx)/dd,oy=(y+.5-dcy)/dd,ot=at(Math.round(x+ox*3),Math.round(y+oy*3));if(ot!==P||inDisc(Math.round(x+ox*3)>>4,Math.round(y+oy*3)>>4))c=dd>=R0-1?'#7f7b72':'#b4b0a2';}
          }
          if(near(x,y,G,1))c='#7f7b72';else if(near(x,y,G,2))c='#b4b0a2';
        }else{
          c=colors.path[n<.38?0:n>.63?2:1];
          if(near(x,y,G,1))c='#b78e53';else if(near(x,y,G,3))c='#cda364';
        }
      }else if(t===SA){
        c=colors.sand[vnoise(x,y,48,720)>.5?1:0];
        if(near(x,y,WA,2))c='#b7c28b';else if(near(x,y,WA,5))c='#d8c17f';
      }else if(t===WA){
        const d=distance[i];c=colors.water[d<3?0:d<10?1:d<23?2:d<43?3:4];
        if(d===1&&(at(x,y-1)!==WA||at(x-1,y)!==WA))c='#def2cf';
      }else{
        const row=Math.floor(y/8),off=row%2*16,lx=(x+off)%32,ly=y%8;
        c=colors.wood[Math.floor(hash(Math.floor((x+off)/32),row,730)*2)];
        if(ly===0)c='#ceb48b';else if(ly===7||lx===0)c='#896e52';
      }set(x,y,c);
    }
    // Accents are placed by coarse world cells, never by independent pixel chance.
    let groups=0;
    const stamp=(x,y,w,h,c,t)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(x+i>=0&&y+j>=0&&x+i<AW&&y+j<AH&&at(x+i,y+j)===t)set(x+i,y+j,c);};
    for(let by=0;by<AH;by+=64)for(let bx=0;bx<AW;bx+=64){
      if(hash(bx,by,740)>density*.68)continue;
      const x=bx+12+Math.floor(hash(bx,by,741)*36),y=by+12+Math.floor(hash(bx,by,742)*36);
      if(x>=AW-5||y>=AH-5||at(x,y)!==G||near(x,y,P,8)||near(x,y,SA,8))continue;
      const tile=MAP[y>>4][x>>4];if(tile===T.BUILD||tile===T.SHOP||tile===T.FENCE)continue;
      // One quiet 3-blade tuft with a soft contact shadow.
      stamp(x-4,y+2,10,2,'#6e9c3e',G);stamp(x-3,y-1,2,4,'#a5c85e',G);stamp(x,y-3,2,6,'#a5c85e',G);stamp(x+3,y,2,3,'#96bd53',G);groups++;
    }
    // Water ripples: short paired strokes with large empty areas between groups.
    for(let by=12;by<AH;by+=40)for(let bx=12;bx<AW;bx+=48){
      const x=bx+Math.floor(hash(bx,by,750)*20),y=by+Math.floor(hash(bx,by,751)*14);
      if(at(x,y)!==WA||distance[y*AW+x]<8||hash(bx,by,752)>.45*density)continue;
      stamp(x,y,9,1,'#a0ded1',WA);stamp(x+2,y+2,5,1,'#83d3cd',WA);
    }
    // Broad sand strokes, very sparse; not grains or individual dots.
    for(let by=10;by<AH;by+=48)for(let bx=10;bx<AW;bx+=48){
      const x=bx+Math.floor(hash(bx,by,760)*18),y=by+Math.floor(hash(bx,by,761)*18);
      if(at(x,y)!==SA||hash(bx,by,762)>density*.42)continue;
      stamp(x,y,8,1,'#d9ba73',SA);stamp(x+2,y+1,6,1,'#f5dfa3',SA);
    }
    ctx.putImageData(img,0,0);
    if(options.decorations!==false)ctx.drawImage(mapDecor(MAP),0,0);
    // Existing player-plot boundary treatment is kept.
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      if(gtype(MAP[y][x])!==FL)continue;const pi=plotAt(x,y);if(pi<0)continue;
      const left=HOUSING.plots[pi];ctx.fillStyle='#826548';
      if(y===HOUSING.y0)ctx.fillRect(x*U,y*U,U,2);if(y===HOUSING.y1)ctx.fillRect(x*U,y*U+U-2,U,2);
      if(x===left)ctx.fillRect(x*U,y*U,2,U);if(x===left+HOUSING.w-1)ctx.fillRect(x*U+U-2,y*U,2,U);
    }
    // Metadata is diagnostic only; renderer never writes MAP or Shared.
    base.cleanTerrain={version:4,tuftGroups:groups,density};
    if(K===1)return base;const out=cv(AW*K,AH*K),g=out.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(base,0,0,out.width,out.height);out.cleanTerrain=base.cleanTerrain;return out;
  }

  // ---------- fences (วาดลงพื้น ต่อกันตามช่องข้างเคียง) — ไม้โทนอุ่นตาม STYLE_GUIDE ----------

  // Low ornamental groundcover only. No new solid obstacles or collision cells.
  // Separate layer: set ground(...,{decorations:false}) and draw mapDecor manually.
  function mapDecor(MAP) {
    const c=cv(W*U,H*U),g=c.getContext('2d'),placements=[];
    const px=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h);};
    // Scanline ellipse keeps every pixel hard-edged, including native 1x output.
    const oval=(x,y,rx,ry,col)=>{for(let j=-ry;j<=ry;j++){const w=Math.floor(rx*Math.sqrt(Math.max(0,1-j*j/(ry*ry))));px(x-w,y+j,w*2+1,1,col);}};
    function leaf(x,y,r){oval(x,y+2,r,r-2,'#376d38');oval(x-1,y,r-1,r-3,'#559342');oval(x-2,y-2,r-3,Math.max(1,r-5),'#7fb447');px(x-3,y-3,3,2,'#b1d26a');}
    function bloom(x,y,col){px(x,y,1,5,'#3f7938');px(x-2,y-3,5,5,col);px(x-3,y-2,7,3,col);px(x-1,y-2,2,2,'#f4dc8c');}
    function cluster(x,y,kind){
      oval(x,y+5,23,9,'#6a983c');
      if(kind===0){leaf(x-12,y,9);leaf(x+3,y-3,12);leaf(x+16,y+3,7);bloom(x-8,y-3,'#fff0ca');bloom(x+5,y-6,'#ffe5a2');}
      if(kind===1){for(let i=0;i<6;i++){const xx=x-17+i*6,yy=y+(i%3)*3;leaf(xx,yy+2,5);bloom(xx,yy-3,i%2?'#b27ac9':'#dfa1d4');}}
      if(kind===2){leaf(x-15,y+2,7);leaf(x+14,y-1,9);oval(x,y+3,8,5,'#535e58');oval(x-1,y+1,7,4,'#8f9c8c');px(x-4,y-2,6,2,'#bdc6ad');bloom(x+14,y-5,'#ffdc68');}
      if(kind===3){for(let i=0;i<4;i++){leaf(x-13+i*9,y+(i%2)*4,7);bloom(x-13+i*9,y-2+(i%2)*4,'#fff0bf');}}
    }
    const inside=(tx,ty,b,pad=1)=>b&&tx>=b.x0-pad&&tx<=b.x1+pad&&ty>=b.y0-pad&&ty<=b.y1+pad;
    const reserved=(tx,ty)=>inside(tx,ty,Shared.FARM,1)||inside(tx,ty,Shared.HOUSE_BLD,0)||Object.values(Shared.PENS||{}).some(b=>inside(tx,ty,b,1))|| (Shared.BUILDINGS||[]).some(b=>inside(tx,ty,b,0));
    const safe=(tx,ty)=>{if(tx<2||ty<2||tx>W-3||ty>H-3||reserved(tx,ty))return false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(MAP[ty+dy][tx+dx]!==T.GRASS)return false;return true;};
    // Spaced garden pockets. Stable placement; never put foliage on paths/gates.
    for(let ty=3;ty<H-2;ty+=3)for(let tx=3;tx<W-2;tx+=3){
      const x=tx+Math.floor(hash(tx,ty,840)*3)-1,y=ty+Math.floor(hash(tx,ty,841)*3)-1;
      if(!safe(x,y)||hash(tx,ty,842)>.65)continue;
      const kind=Math.floor(hash(tx,ty,843)*4);cluster(x*U+8,y*U+8,kind);placements.push({tx:x,ty:y,kind,solid:false});
    }
    c.placements=placements;return c;
  }

  function fences(x, MAP) {
    const isF = (tx, ty) => MAP[ty] && MAP[ty][tx] === T.FENCE;
    const W0 = '#835437', W1 = '#a0692f', W2 = '#d6a05a', W3 = '#5a3a34'; // ไม้ hue shift: เงาอมม่วง แสงอมเหลือง
    for (let y = 0; y < H; y++) for (let x2 = 0; x2 < W; x2++) {
      if (!isF(x2, y)) continue;
      const px = x2 * U, py = y * U, L = isF(x2 - 1, y), Rr = isF(x2 + 1, y), Up = isF(x2, y - 1), Dn = isF(x2, y + 1);
      x.fillStyle = 'rgba(24,34,52,.24)'; x.fillRect(px + 3, py + 13, 12, 2);
      if (L || Rr || !(Up || Dn)) { // ราวแนวนอน
        const x0 = L ? px : px + 6, x1 = Rr ? px + U : px + 10;
        for (const ry of [py + 5, py + 9]) { r(x, OUT, x0, ry - 1, x1 - x0, 4); r(x, W0, x0, ry, x1 - x0, 2); r(x, W2, x0, ry, x1 - x0, 1); }
      }
      if (Dn) { r(x, OUT, px + 6, py + 8, 4, 8); r(x, W0, px + 7, py + 8, 2, 8); r(x, W2, px + 7, py + 8, 1, 8); }
      if (Up) { r(x, OUT, px + 6, py, 4, 8); r(x, W0, px + 7, py, 2, 8); r(x, W2, px + 7, py, 1, 8); }
      // เสา
      r(x, OUT, px + 5, py + 1, 6, 14); r(x, W1, px + 6, py + 2, 4, 12); r(x, W2, px + 6, py + 2, 2, 11); r(x, W3, px + 6, py + 2, 4, 1);
      r(x, '#6b8f45', px + 5, py + 14, 2, 1); r(x, '#6b8f45', px + 10, py + 14, 1, 1);
    }
  }

  // ---------- trees ----------
  // ต้นไม้ 11 ชนิด 28 แบบ ออกแบบใหม่โดยผู้ดูแล (30 ต.ค. 2026): PixelTrees.get(ชนิด, แบบ) ขนาดและจุดโคนต้นเท่าเดิม เกมเรียกผ่าน PixelArt.tree(tx, ty, ชนิด)
/* My World • PixelTrees v2. Original sprite bounds, anchors and 28 variants.
   Integer raster shapes; no gradients, antialiasing or random per-frame noise.
   get(kind,variant) returns cached read-only canvas. */
const PixelTrees = (() => {
 const specs={broad:[50,54,6],pine:[38,46,3],coconut:[42,46,2],teak:[50,54,2],bamboo:[38,44,3],gold:[50,54,2],rose:[50,54,2],maple:[50,54,2],sakura:[50,54,2],ebony:[50,54,2],ancient:[50,54,2],padauk:[50,54,2],oak:[50,54,2],willow:[50,54,2],dipt:[50,54,2],takian:[50,54,2],ginkgo:[50,54,2],makha:[50,54,2],raintree:[50,54,2],shingchan:[50,54,2]};
 const palettes={broad:['#243d37','#365943','#527946','#7b9e54','#b5c77b'],pine:['#203735','#2b5048','#3c7160','#649174','#a0b48b'],coconut:['#293d34','#3c6040','#688746','#94ac5b','#c6cf87'],teak:['#353e2d','#52623a','#7a8748','#a5a75d','#d2c57e'],bamboo:['#273c36','#3f6247','#6c9251','#a3b66c','#d1ce8d'],gold:['#4d492c','#7b7139','#b49a44','#dfbc56','#f6dda0'],rose:['#263a37','#354e40','#506b4b','#7a9161','#b0b784'],maple:['#583739','#874738','#b9653f','#df9150','#f1c17b'],sakura:['#603b54','#9b5a75','#ca8095','#e9b0bb','#f9dcd0'],ebony:['#252d35','#303f3d','#435c4a','#657b57','#929b6b'],ancient:['#243b40','#30564f','#4d7b65','#80a187','#b9c79b'],padauk:['#2c4130','#44603a','#6a8a45','#98ad59','#c6c97a'],oak:['#3b3220','#5a4a2a','#7f6a37','#a89048','#d0b870'],willow:['#35513a','#58794a','#82a35b','#acc66f','#d6e49b'],dipt:['#1f3a33','#2e5648','#47775a','#6e9c6e','#a3c392'],takian:['#34502a','#4f7a30','#78a63a','#a4cc4e','#d3ec86'],ginkgo:['#6b5a1f','#9a8329','#cdb23a','#ecd35a','#faeaa0'],makha:['#2f3a4a','#475a6e','#667f90','#8fa8b0','#bcd0d0'],raintree:['#2e4a38','#44704a','#639658','#8fbf6c','#c4e096'],shingchan:['#4a2630','#6e3a40','#935650','#b87a64','#dba98a']};
 const cache=new Map();let factory=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 function get(kind,variant=0){
  if(!Object.prototype.hasOwnProperty.call(specs,kind)||!Number.isInteger(variant)||variant<0||variant>=specs[kind][2])return null;
  const key=kind+'/'+variant;if(cache.has(key))return cache.get(key);
  const [W,H]=specs[kind],cx=W/2,base=H-4,p=palettes[kind],c=factory(W,H),g=c.getContext('2d'),a=Array.from({length:H},()=>Array(W).fill(null));
  function dot(x,y,col){x=Math.round(x);y=Math.round(y);if(x>=2&&x<W-2&&y>=2&&y<=base)a[y][x]=col;}
  function rect(x,y,w,h,col){for(let j=0;j<h;j++)for(let i=0;i<w;i++)dot(x+i,y+j,col);}
  function poly(pts,col){const ymin=Math.floor(Math.min(...pts.map(p=>p[1]))),ymax=Math.ceil(Math.max(...pts.map(p=>p[1])));for(let y=ymin;y<=ymax;y++){let xs=[];for(let i=0;i<pts.length;i++){const [x1,y1]=pts[i],[x2,y2]=pts[(i+1)%pts.length];if((y1<=y+.5&&y2>y+.5)||(y2<=y+.5&&y1>y+.5))xs.push(x1+(y+.5-y1)*(x2-x1)/(y2-y1));}xs.sort((a,b)=>a-b);for(let i=0;i<xs.length;i+=2)for(let x=Math.ceil(xs[i]-.5);x<xs[i+1]-.5;x++)dot(x,y,col);}}
  function line(x1,y1,x2,y2,col,width=1){let n=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));for(let t=0;t<=n;t++)rect(Math.round(x1+(x2-x1)*t/(n||1)),Math.round(y1+(y2-y1)*t/(n||1)),width,width,col);}
  const bark=kind==='ebony'?['#303039','#4b4446','#73604e','#9a8367']:(kind==='rose'||kind==='shingchan'||kind==='makha')?['#452d30','#704338','#a16b4b','#c49866']:['#443337','#71503e','#a47b52','#c7a473'];
  function trunk(w=6,top=23){
   poly([[cx-2,top],[cx+2,top],[cx+w/2-1,base-3],[cx+w+2,base],[cx-w-2,base],[cx-w/2+1,base-3]],bark[0]);
   poly([[cx-1,top],[cx+1,top],[cx+2,base-3],[cx+5,base],[cx-5,base],[cx-2,base-4]],bark[1]);
   line(cx-1,top+2,cx-2,base-3,bark[2],2);line(cx-1,top+8,cx-1,top+13,bark[3]);
   if(kind!=='pine'){line(cx,top+10,cx-10,top-1,bark[1],3);line(cx+1,top+9,cx+10,top-3,bark[0],3);}
   line(cx,base-4,cx+5,base-1,bark[2]);line(cx-2,base-4,cx-7,base,bark[2]);
   for(let y=top+13;y<base-3;y+=7){line(cx+2,y,cx+1,y+3,bark[0]);dot(cx-2,y+2,bark[3]);}
  }
  // Hand-designed stepped leaf cluster, with contiguous highlight planes.
  function crown(x,y,rx,ry,seed=0,colors=p,pointed=false){
   let shape=pointed?[[0,-1],[.3,-.65],[.65,-.85],[.64,-.4],[1,-.2],[.8,.2],[1,.48],[.5,.7],[.2,1],[0,.8],[-.5,1],[-.55,.6],[-1,.4],[-.8,0],[-1,-.4],[-.5,-.5],[-.35,-.9]]:[[-.35,-1],[.25,-1],[.4,-.8],[.7,-.8],[.7,-.6],[.93,-.45],[1,-.1],[.9,.1],[1,.35],[.7,.6],[.45,.6],[.35,.88],[-.1,1],[-.4,.8],[-.7,.8],[-.75,.55],[-1,.4],[-1,-.1],[-.8,-.3],[-.8,-.6],[-.55,-.65]];
   poly(shape.map(([u,v])=>[x+Math.round(u*rx),y+Math.round(v*ry)]),colors[0]);
   // Paint within this cluster only, preserving the stepped boundary.
   const temp=[];for(let yy=Math.max(2,y-ry);yy<=Math.min(base,y+ry);yy++)for(let xx=Math.max(2,x-rx);xx<=Math.min(W-3,x+rx);xx++){
    // point-in-polygon at pixel centre
    const pts=shape.map(([u,v])=>[x+Math.round(u*rx),y+Math.round(v*ry)]);let inside=false;
    for(let i=0,j=pts.length-1;i<pts.length;j=i++){const A=pts[i],B=pts[j];if((A[1]>yy+.5)!=(B[1]>yy+.5)&&(xx+.5<(B[0]-A[0])*(yy+.5-A[1])/(B[1]-A[1])+A[0]))inside=!inside;}
    if(!inside)continue;
    let u=(xx-x)/rx,v=(yy-y)/ry,idx=1;
    if(v<.36&&u<.65)idx=2;if(v<-.03&&u<.25)idx=3;if(v<-.4&&u<-.06&&u>-.72)idx=4;
    if(v>.55||(u>.7&&v>-.15))idx=0;
    // Sparse 2–3px leaf facets, not single-pixel dithering.
    if(idx===2&&((Math.floor((xx+seed)/4)+Math.floor((yy-seed)/3)*3)%7===0)&&v<.25)idx=3;
    temp.push([xx,yy,colors[idx]]);
   }temp.forEach(v=>dot(...v));
  }
  const v=variant;
  if(kind==='pine'){
   trunk(4,24);const tilt=[0,-1,1][v];
   for(let t=3;t>=0;t--){const top=4+t*7,hw=4+t*3+(v===1?1:0),mid=cx+tilt;
    poly([[mid,top],[mid+hw,top+12],[mid+hw-4,top+11],[mid+hw-2,top+14],[mid-2,top+13],[mid-hw,top+14],[mid-hw+3,top+10]],p[0]);
    poly([[mid,top],[mid+hw-2,top+11],[mid,top+12],[mid-hw+2,top+11]],p[1]);
    poly([[mid,top],[mid-1,top+9],[mid-hw+2,top+11]],p[2]);
    line(mid-1,top+3,mid-hw+3,top+10,p[3]);dot(mid-1,top+2,p[4]);
   }
  }else if(kind==='coconut'){
   const lean=v? -4:4,tx=cx+lean,ty=14;
   for(let y=ty;y<=base;y++){let x=cx+Math.round(lean*((base-y)/(base-ty))**2);rect(x-2,y,5,1,bark[0]);rect(x-1,y,3,1,bark[2]);dot(x-1,y,bark[3]);if((y-ty)%5===3)rect(x-2,y,4,1,bark[1]);}
   const ends=[[3,17],[5,7],[15,3],[W-10,4],[W-4,11],[W-4,24],[9,27],[W-12,29]];
   for(const [ex,ey] of ends){const mx=Math.round((tx+ex)/2),my=Math.min(ty,ey)-3;
    poly([[tx,ty],[mx-1,my-2],[ex,ey],[mx+2,my+3]],p[1]);line(tx,ty,mx,my,p[3]);line(mx,my,ex,ey,p[2]);
    for(let q=1;q<4;q++){const t=q/4,x=Math.round(mx+(ex-mx)*t),y=Math.round(my+(ey-my)*t);line(x,y,x+(ex<tx?-2:2),y+3,p[2]);}
   }
   [[-3,1],[0,3],[3,1]].forEach(([x,y])=>{rect(tx+x,ty+y,3,3,bark[0]);rect(tx+x,ty+y,2,2,bark[2]);dot(tx+x,ty+y,bark[3]);});
  }else if(kind==='bamboo'){
   for(let i=0;i<4;i++){const x=cx-7+i*4,top=5+((i*5+v*3)%10);
    rect(x,top,3,base-top,p[1]);rect(x,top,1,base-top,p[3]);
    for(let y=top+5;y<base;y+=6){rect(x-1,y,4,1,p[0]);rect(x,y+1,3,1,p[4]);}
    for(let j=0;j<3;j++){const y=top+3+j*7,dir=(i+j)%2?1:-1;
     line(x,y,x+dir*7,y-3,p[1]);poly([[x+dir*2,y-1],[x+dir*8,y-6],[x+dir*5,y-1]],p[3]);poly([[x+dir*3,y-1],[x+dir*9,y],[x+dir*6,y+2]],p[2]);}
   }
  }else{
   trunk(kind==='ancient'?10:kind==='ebony'?8:6,22);
   let clusters;const LK=({padauk:'teak',oak:'broad',willow:'gold',dipt:'rose',takian:'teak',ginkgo:'maple',makha:'rose',raintree:'gold',shingchan:'rose'})[kind]||kind;
   if(LK==='broad')clusters=[[-10,23,10,10],[9,22,12,10],[0,28,11,8],[-8,14,10,10],[7,12,11,9],[0,8,9,6]];
   if(LK==='teak')clusters=[[-10,21,9,11],[10,21,9,10],[0,26,10,9],[-7,12,8,10],[7,11,8,9],[0,7,7,5]];
   if(LK==='gold')clusters=[[-12,19,9,7],[11,19,10,8],[0,24,12,7],[-5,11,11,8],[8,11,10,7]];
   if(LK==='rose')clusters=[[-11,25,10,7],[11,23,9,8],[0,27,11,7],[-9,16,9,8],[7,14,10,9],[0,9,8,6]];
   if(LK==='maple')clusters=[[-12,23,9,9],[11,21,10,10],[0,27,10,8],[-7,14,10,10],[7,12,9,10],[0,8,7,6]];
   if(kind==='sakura')clusters=[[-13,25,9,7],[12,23,10,7],[0,27,12,8],[-8,16,11,8],[9,15,10,7],[0,10,11,6]];
   if(kind==='ebony')clusters=[[-8,25,10,10],[9,23,10,12],[0,28,9,9],[-6,14,9,10],[7,12,8,9],[0,8,7,6]];
   if(kind==='ancient')clusters=[[-12,24,10,10],[12,23,10,10],[0,28,12,9],[-10,14,10,9],[8,12,12,9],[0,8,10,6]];
   clusters.forEach(([x,y,rx,ry],i)=>{const dx=((v+i*2)%3)-1,dy=((v*2+i)%3)-1;crown(cx+x+dx,y+dy,rx-(v===3?1:0),ry,v+i,p,LK==='maple');});
   if(kind==='gold'||kind==='willow')for(let i=0;i<7;i++){const x=9+i*5,y=23+((i+v)%3)*2,L=5+(i*3+v)%6;const wl=kind==='willow';line(x,y,x-1,y+L,wl?'#4f6f3a':'#9b7936',2);for(let j=0;j<L;j+=2){rect(x-1,y+j,3,2,wl?'#8fbf5f':'#dfb94d');dot(x-1,y+j,wl?'#cfe8a0':'#f6dfa1');}dot(x-1,y+L,wl?'#cfe8a0':'#f6dfa1');}
   if(kind==='teak')for(const [x,y] of [[14,17],[28,12],[33,23],[22,27]]){poly([[x-3,y],[x,y-3],[x+4,y],[x,y+3]],p[3]);line(x-2,y,x+2,y,p[2]);}
   if(kind==='sakura')for(const [x,y] of [[11,19],[20,12],[33,17],[27,26],[15,28]]){rect(x-1,y,3,1,p[4]);rect(x,y-1,1,3,p[4]);dot(x,y,'#e4a766');}
   if(kind==='padauk'||kind==='raintree')for(const [x,y] of [[11,19],[20,12],[33,17],[27,26],[15,28],[24,19]]){const c=kind==='padauk'?'#f0902f':'#f2a6c4';rect(x-1,y,3,2,c);dot(x,y-1,c);dot(x,y,'#fff0c0');}
   if(kind==='ancient'){
    poly([[cx-3,37],[cx+2,36],[cx+4,45],[cx-4,46]],'#293036');line(cx-3,38,cx-4,45,bark[2]);dot(cx-2,39,'#c3b58b');
    line(cx-5,34,cx-7,base-2,p[2],2);line(cx+6,41,cx+9,base,p[1],2);
    for(const [x,y] of [[12,29],[35,26]]){line(x,y,x,y+10,p[1]);dot(x,y+5,p[3]);}
   }
   if(kind==='ebony'){line(cx+1,37,cx+2,46,'#292c35',2);line(cx-2,38,cx-2,43,bark[3]);}
  }
  // Sparse grass at the root; no wide grassy pedestal.
  [[cx-7,base],[cx+7,base]].forEach(([x,y])=>{line(x,y,x-2,y-2,'#465f43');line(x,y,x+1,y-3,'#80925c');});
  // Outline derived only from opaque art, ground shadow kept separate.
  g.fillStyle='rgba(25,32,44,0.28)';for(let yy=-1;yy<=1;yy++){let rw=yy===0?11:8;g.fillRect(cx+2-rw,H-3+yy,rw*2+1,1);}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   let col=a[y][x];if(!col&&[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([u,v])=>(a[v]&&a[v][u])))col='#2a1b14';
   if(col){g.fillStyle=col;g.fillRect(x,y,1,1);}
  }
  cache.set(key,c);return c;
 }
 return {get,specs,palettes,setCanvasFactory(fn){factory=fn;cache.clear();}};
})();


  // Preserve coordinate-based deterministic selection and original fallback mix.
  const treeFor = (tx,ty,kind) => {
    if(Object.prototype.hasOwnProperty.call(PixelTrees.specs,kind)) return PixelTrees.get(kind,Math.floor(hash(tx,ty,78)*PixelTrees.specs[kind][2]));
    const h=hash(tx,ty,77),i=h<.08?1:h<.14?5:Math.floor(hash(tx,ty,78)*8);
    const fallback=[['broad',0],['broad',1],['broad',3],['broad',1],['pine',0],['broad',5],['broad',4],['broad',2]];
    return PixelTrees.get(...fallback[i]);
  };

  // ---------- buildings ----------
  // หน้าต่าง: กรอบไม้ กระจกไล่แสงบนลงล่าง ประกายสะท้อนเฉียง ซี่กากบาท ขอบหน้าต่าง (+ กระบะดอกไม้ถ้ามี box)
  function win(x, X, Y, w, h, box) {
    r(x, '#3a2418', X - 1, Y - 1, w + 2, h + 2); r(x, '#8f5a2e', X - 1, Y - 1, w + 2, 1);
    r(x, '#4f7fa8', X, Y, w, h); r(x, '#7fb6da', X, Y + 1, w, h - 2); r(x, '#a8dcf2', X, Y + 1, w, 2); r(x, '#355f86', X, Y, w, 1); // เงาใต้กรอบบน
    r(x, '#eaf8ff', X + 1, Y + 2, 1, 2); r(x, '#eaf8ff', X + 2, Y + 1, 1, 1); r(x, '#d6f0fb', X + w - 3, Y + h - 3, 1, 1);
    r(x, '#5a371e', X + (w >> 1), Y, 1, h); r(x, '#5a371e', X, Y + (h >> 1), w, 1);
    r(x, '#c98b4a', X - 2, Y + h + 1, w + 4, 1); r(x, '#6e4524', X - 2, Y + h + 2, w + 4, 1);
    if (box) { r(x, '#7d4f2a', X - 1, Y + h + 2, w + 2, 2); r(x, '#5a371e', X - 1, Y + h + 3, w + 2, 1); for (let i = 0; i < w; i += 2) { r(x, i % 4 ? '#3f8a46' : box, X + i, Y + h, 1, 2); r(x, i % 4 ? '#6cbf55' : '#fff3d6', X + i, Y + h, 1, 1); } }
  }
  // ประตูไม้: c = [เงา, หลัก, แสง] ไม้แผ่นตั้ง ขอบซ้ายรับแสง ขวาเงา ลูกบิดทองมีประกาย
  function door(x, X, Y, w, h, c) {
    r(x, '#2e1c12', X - 1, Y - 1, w + 2, h + 1);
    r(x, c[1], X, Y, w, h); for (let i = 2; i < w - 1; i += 3) r(x, c[0], X + i, Y + 1, 1, h - 1);
    r(x, c[2], X, Y, w, 1); r(x, c[2], X, Y, 1, h); r(x, c[0], X + w - 1, Y, 1, h);
    r(x, '#c9962a', X + w - 3, Y + (h >> 1), 2, 2); r(x, '#ffe9a0', X + w - 3, Y + (h >> 1), 1, 1);
  }
  // กระถางต้นไม้ข้างประตู (ดินเผา + พุ่ม + ดอก)
  function pot(x, X, Y, fl) {
    r(x, '#7a3a20', X, Y + 4, 5, 4); r(x, '#b8653a', X, Y + 4, 4, 3); r(x, '#e08a5a', X, Y + 4, 4, 1);
    r(x, '#2f6b3a', X - 1, Y + 1, 7, 3); r(x, '#4f913b', X - 1, Y, 6, 3); r(x, '#7cc76a', X, Y, 3, 1);
    r(x, fl, X + 1, Y - 1, 1, 1); r(x, fl, X + 4, Y + 1, 1, 1); r(x, '#fff3d6', X + 1, Y, 1, 1);
  }
  const BCACHE = new Map();
  // อาคาร (มุม top-down 3/4): ชั้นวาด เงาทอด → ผนังไม้ตีเกล็ด → ฐานหิน → หลังคากระเบื้องไล่แสง → ชายคา+เงาชายคา → หน้าต่าง/ประตู → รายละเอียดร้าน → ขอบ
  // สีทั้งหมดไล่แบบ hue shift (เงาอมม่วง/น้ำเงิน แสงอมเหลือง) แสงจากซ้ายบน
  const ROOF_UP = 14, OVER = 3;
  function legacyBuilding(b) {
    if (BCACHE.has(b)) return BCACHE.get(b);
    const bw = (b.x1 - b.x0 + 1) * U, bh = (b.y1 - b.y0 + 1) * U, SW = bw + OVER * 2, SH = bh + ROOF_UP;
    const RF = ramp(b.roof, .3, .2), WL = b.kind === 'coop' ? ramp('#b5443a', .25, .2) : ramp(b.wall, .14, .3), ST = ramp('#a39886', .28, .22);
    const roof = [RF[1], RF[2], RF[3], RF[4]], wall = [WL[1], WL[2], WL[4]];
    const rh = 16, wx = OVER, wy = rh - 1, ww = bw, wb = SH;
    const s = mk(SW, SH, (x) => {
      // ผนังไม้ตีเกล็ด: แต่ละแผ่นขอบบนรับแสง ขอบล่างเงา • เสามุมซ้ายสว่าง ขวาเงา
      r(x, WL[2], wx, wy, ww, wb - wy);
      for (let yy = wy + 2; yy < wb - 4; yy += 4) { r(x, WL[3], wx, yy, ww, 1); r(x, WL[1], wx, yy + 3, ww, 1); }
      r(x, WL[3], wx, wy, 2, wb - wy); r(x, WL[4], wx, wy, 1, wb - wy); r(x, WL[1], wx + ww - 3, wy, 3, wb - wy); r(x, WL[0], wx + ww - 1, wy, 1, wb - wy);
      // ฐานหิน + เงาซอกระหว่างผนังกับฐาน (AO)
      r(x, ST[1], wx - 1, wb - 3, ww + 2, 3);
      for (let xx = wx - 1, k = 0; xx < wx + ww + 1; xx += 5, k++) { r(x, k % 2 ? ST[2] : ST[3], xx + 1, wb - 3, 4, 2); r(x, ST[4], xx + 1, wb - 3, 2, 1); r(x, ST[0], xx, wb - 3, 1, 3); }
      r(x, 'rgba(40,24,48,.35)', wx, wb - 4, ww, 1);
      // หลังคากระเบื้อง: สันหลังคาสว่างสุด ไล่เข้มลงหาชายคา • แต่ละแถวมีเงาใต้แถว รอยต่อกระเบื้องสลับ และปลายด้านขวาเข้ม (แสงซ้ายบน)
      r(x, RF[0], 1, 1, SW - 2, rh - 1); r(x, RF[0], 0, 2, SW, rh - 3);
      r(x, RF[1], 1, 0, SW - 2, 2); r(x, RF[4], 2, 0, SW - 5, 1);
      const tones = [3, 3, 2, 2, 1]; // ดัชนีสีของแต่ละแถว ไล่จากสันลงชายคา
      for (let yy = 2, k = 0; yy < rh - 3; yy += 3, k++) {
        const t = tones[Math.min(k, 4)];
        r(x, RF[t], 1, yy, SW - 2, 3); // แผ่นกระเบื้องเกล็ดซ้อน: ขอบล่างแต่ละแผ่นมนเป็นลอน (มุมเข้ม กลางสว่าง) รอยต่อสั้นแค่แถวบน
        const px1 = (c, X, Y, w) => { const a0 = Math.max(1, X), a1 = Math.min(SW - 1, X + w); if (a1 > a0) r(x, c, a0, Y, a1 - a0, 1); };
        for (let xx = (k % 2) * 3 - 2; xx < SW - 1; xx += 6) {
          px1(RF[t - 1], xx, yy, 1); px1(RF[Math.min(4, t + 1)], xx + 1, yy, 2);
          px1(RF[t - 1], xx - 1, yy + 2, 2); px1(RF[t - 1], xx + 5, yy + 2, 2);
        }
      }
      r(x, RF[3], 1, 2, 1, rh - 5); r(x, RF[1], SW - 3, 2, 1, rh - 5); r(x, RF[0], SW - 2, 2, 1, rh - 4);
      // ชายคา: ไม้ปิดชายคา + ลอนย้อย
      r(x, RF[0], 0, rh - 3, SW, 2); r(x, RF[1], 1, rh - 3, SW - 2, 1);
      for (let xx = 0; xx < SW; xx++) { const dip = (xx % 4 === 0 || xx % 4 === 3) ? 1 : 0; r(x, RF[0], xx, rh - 1 + dip, 1, 1 + dip); if (dip) r(x, RF[1], xx, rh - 1, 1, 1); }
      // เงาชายคาตกบนผนัง (rgba(42,27,20,.35) ตามแนวทาง + ซอกลึกอมม่วง)
      r(x, 'rgba(42,27,20,.35)', wx, rh + 1, ww, 2); r(x, 'rgba(42,27,20,.16)', wx, rh + 3, ww, 1);
      const cx = wx + (ww >> 1), dy = wb - 16;
      const D = [shade(b.roof, -.45), shade(b.roof, -.25), shade(b.roof, .05)];
      const k = b.kind;
      if (k === 'vehicle') { // ประตูม้วนเปิดครึ่ง + ป้ายประแจ
        r(x, '#4a2e1b', wx + 4, dy - 1, 22, 17); r(x, '#2a2420', wx + 5, dy + 6, 20, 10);
        for (let yy = dy; yy < dy + 6; yy += 2) { r(x, '#9aa5ad', wx + 5, yy, 20, 1); r(x, '#c9d3dc', wx + 5, yy, 20, 1); r(x, '#6c7782', wx + 5, yy + 1, 20, 1); }
        disc(x, wx + 14, dy + 12, 2, '#3a3a3a'); r(x, '#9aa5ad', wx + 20, dy + 9, 1, 7);
      } else if (k === 'furn' || k === 'cloth') { // ประตูกลางหน้าร้าน (ไม่มีตู้โชว์/หน้าต่างแล้ว เข้าซื้อทางประตูอย่างเดียว)
        door(x, cx - 4, dy + 1, 8, 15, D);
        if (k === 'cloth') for (let i = 0; i < ww; i += 6) { r(x, '#d6559a', wx + i, wy + 2, 3, 4); r(x, '#f7e1ee', wx + i + 3, wy + 2, 3, 4); r(x, '#d6559a', wx + i + 1, wy + 6, 1, 1); r(x, '#f7e1ee', wx + i + 4, wy + 6, 1, 1); }
      } else if (k === 'coop') { // เล้าไก่ทรงยุ้งฉางสีแดง ประตูกากบาท
        r(x, '#f6efe2', cx - 7, dy - 1, 14, 17); r(x, '#8c2f27', cx - 6, dy, 12, 16);
        for (let i = 0; i < 12; i++) { r(x, '#f6efe2', cx - 6 + i, dy + Math.round(i * 16 / 12), 1, 1); r(x, '#f6efe2', cx + 5 - i, dy + Math.round(i * 16 / 12), 1, 1); }
        r(x, '#2a1b14', wx + 5, wb - 8, 4, 5); r(x, '#e8c25a', wx + 3, wb - 4, 8, 1); // ช่องไก่
        r(x, '#f6efe2', wx, wy, ww, 1); r(x, '#f6efe2', wx, wy, 1, wb - wy); r(x, '#f6efe2', wx + ww - 1, wy, 1, wb - wy);
      } else {
        door(x, cx - 4, dy + 1, 8, 15, ['#6e4524', '#8f5a2e', '#b67d45']);
        if (k === 'fish') { // ห่วงชูชีพ + ปลาตาก
          disc(x, wx + ww - 9, dy + 5, 4, '#f6efe2'); r(x, '#d9473c', wx + ww - 13, dy + 4, 2, 2); r(x, '#d9473c', wx + ww - 7, dy + 4, 2, 2); r(x, '#d9473c', wx + ww - 10, dy + 1, 2, 2); r(x, '#d9473c', wx + ww - 10, dy + 7, 2, 2); disc(x, wx + ww - 9, dy + 5, 1, wall[1]);
          r(x, '#5a371e', wx + 2, wy + 3, 14, 1);
          for (let i = 0; i < 3; i++) { const fx = wx + 3 + i * 5, cl = i % 2 ? ['#d07a3a', '#f2a865'] : ['#7f97a8', '#c9d8e2']; r(x, cl[0], fx, wy + 4, 3, 5); r(x, cl[1], fx, wy + 4, 1, 4); r(x, cl[0], fx - 1, wy + 9, 5, 1); }
        }
        if (k === 'food') { // กันสาดลายทาง
          for (let i = 0; i < ww; i += 4) { r(x, '#c8423a', wx + i, wy + 1, 2, 5); r(x, '#f6e7c8', wx + i + 2, wy + 1, 2, 5); r(x, '#9e2f29', wx + i, wy + 6, 2, 1); }
          r(x, '#c8423a', cx - 1, wy + 8, 2, 3); r(x, '#ff7a5a', cx - 1, wy + 8, 1, 3);
        }
        if (k === 'wood') { // ขวานบนผนัง + กองไม้ท่อน
          r(x, '#7d4f2a', cx + 6, wy + 3, 1, 7); r(x, '#9aa5ad', cx + 7, wy + 3, 3, 3); r(x, '#c9d3dc', cx + 7, wy + 3, 1, 3);
          for (const [lx, ly] of [[wx + ww - 9, wb - 6], [wx + ww - 5, wb - 6], [wx + ww - 7, wb - 9]]) { disc(x, lx, ly, 2, '#c9984f'); r(x, '#8f5a2e', lx, ly, 1, 1); }
        }
        if (k === 'farm') { // กระสอบเมล็ด
          for (const sx of [wx + ww - 7, wx + 2]) { r(x, '#d9c08a', sx, wb - 8, 5, 5); r(x, '#b8963a', sx + 1, wb - 9, 3, 1); r(x, '#4f913b', sx + 2, wb - 6, 1, 1); }
        }
        if (k === 'animal') { // ถังนม + ฟาง
          r(x, '#9aa5ad', wx + 2, wb - 9, 4, 6); r(x, '#c9d3dc', wx + 2, wb - 9, 1, 6); r(x, '#6c7782', wx + 2, wb - 10, 4, 1);
          r(x, '#d9b44a', wx + ww - 9, wb - 8, 8, 5); r(x, '#e8cd72', wx + ww - 9, wb - 8, 8, 1); r(x, '#c29a32', wx + ww - 6, wb - 8, 1, 5);
        }
        r(x, ST[3], cx - 6, wb - 2, 12, 2); r(x, ST[4], cx - 5, wb - 2, 10, 1); // ขั้นบันไดหินหน้าประตู
      }
    }, { soft: ['#3d2a1a', '#7a5a3a'] }); // ขอบน้ำตาลอุ่น + AA ลดคมดำ
    const out = { spr: s, ox: -(OVER + 1), oy: -(ROOF_UP + 1), w: s.width, h: s.height };
    BCACHE.set(b, out); return out;
  }
  // V2 shop art: opaque integer pixel clusters, existing footprint and doors.
  function building(b) {
    const known=['farm','fish','animal','pet','cloth','food','wood','vehicle','furn','mine','weapon'];
    if(!known.includes(b.kind)||(b.x1-b.x0!==2)||(b.y1-b.y0!==1))return legacyBuilding(b);
    if(BCACHE.has(b))return BCACHE.get(b);
    const RF=[shade(b.roof,-.53),shade(b.roof,-.28),b.roof,shade(b.roof,.23),shade(b.roof,.43)];
    const wall=b.wall, k=b.kind, wood=['#463332','#75523f','#ae8458','#d3b680'];
    const s=mk(54,46,(g)=>{
      const R=(c,x,y,w,h)=>r(g,c,x,y,w,h);
      // Plaster, cool right plane and half timber framing.
      R('#514843',3,15,48,31);R(wall,4,16,45,26);R(shade(wall,-.17),44,17,6,26);R(shade(wall,.10),5,19,37,1);
      R(wood[0],3,17,2,27);R(wood[2],4,19,1,24);R(wood[0],48,17,3,27);R(wood[1],48,19,1,24);
      R(wood[1],5,27,43,2);R(wood[2],5,27,42,1);
      // Stone foundation: fewer, broader blocks.
      R('#5c5b60',2,42,50,4);for(let x=3;x<51;x+=7){R('#9a998a',x,43,6,3);R('#c5bc9e',x,43,5,1);R('#73767a',x+5,44,1,2);}
      // Quiet roof face leaves room for labels drawn by the game.
      for(let y=1;y<15;y++){const inset=y<5?5-y:0;R(RF[0],inset,y,54-inset*2,1);R(RF[y<5?3:y<10?2:1],inset+1,y,51-inset*2,1);}
      R(RF[0],4,0,46,1);R(RF[4],5,1,43,1);
      for(let y=5;y<14;y+=4){R(RF[0],1,y,51,1);R(RF[y<9?3:2],2,y+1,49,1);for(let x=(y===9?7:3);x<51;x+=10)R(RF[1],x,y-2,1,2);}
      R(wood[0],0,14,54,3);R(wood[2],1,14,51,1);R(wood[1],2,16,50,1);R(shade(wall,-.38),5,17,43,2);R(shade(wall,-.19),5,19,43,1);
      // Support brackets underneath eaves.
      for(const x of [6,45]){R(wood[1],x,19,2,4);R(wood[2],x,19,1,2);}
      const D=['#503931','#89603e','#c39a60'];
      if(k==='vehicle'){
       // Same left garage footprint as the original sprite.
       R(wood[0],7,29,22,17);R('#28333a',8,36,20,10);
       for(let y=30;y<36;y+=2){R('#b0b9b7',8,y,20,1);R('#6b7c83',8,y+1,20,1);}
       R('#e0d8bd',8,30,20,1);
      }else{
       R(wood[0],21,29,12,17);R(wood[2],22,30,1,15);door(g,23,31,8,15,D);
       R('#435058',25,33,4,4);R('#a4c7c4',25,33,3,2);R('#f3e4b9',25,33,1,1);
       R('#a4a391',21,44,12,2);R('#d5ccb1',22,44,10,1);
      }
      // Windows are wall decoration; collisions and purchase interaction stay unchanged.
      if(k!=='vehicle')win(g,9,22,9,7,false);
      if(!['fish','cloth','animal','pet','vehicle'].includes(k))win(g,37,22,8,7,false);
      const line=(x,y,xx,yy,c)=>{const n=Math.max(Math.abs(xx-x),Math.abs(yy-y));for(let i=0;i<=n;i++)R(c,Math.round(x+(xx-x)*i/(n||1)),Math.round(y+(yy-y)*i/(n||1)),1,1);};
      const crate=(x,y)=>{R(wood[0],x,y,10,7);R(wood[2],x+1,y+1,8,5);R(wood[1],x+1,y+3,8,1);line(x+1,y+1,x+8,y+5,wood[3]);};
      if(k==='farm'){
       crate(7,36);for(const [x,y] of [[9,34],[13,33],[16,35]]){R('#456246',x,y,1,3);R('#7b9856',x-1,y,3,1);R('#bbc47c',x-1,y-1,1,1);}
       R('#9b8254',38,36,8,7);R('#d2bd87',39,36,6,6);R('#e6d4a6',39,37,2,2);R('#685d43',40,35,4,1);R('#68824c',41,39,2,2);
      }
      if(k==='fish'){
       disc(g,40,25,4,'#e8dfc6');disc(g,40,25,2,wall);R('#b75a4a',36,24,2,2);R('#b75a4a',43,24,2,2);R('#b75a4a',39,21,2,2);R('#b75a4a',39,28,2,2);
       crate(36,36);R('#668c9c',38,36,5,2);R('#c1d3d0',39,36,3,1);R('#668c9c',43,35,2,3);R('#3a4146',38,36,1,1);
       line(8,35,9,20,wood[1]);line(9,20,14,20,'#aebeb9');
      }
      if(k==='animal'){
       R('#6c7b81',8,35,6,8);R('#b5c3c1',9,35,4,7);R('#e1dfca',9,36,1,5);R('#6c7b81',9,33,4,2);
       R('#9f8247',36,36,11,7);R('#d0b665',36,36,10,5);R('#e8cf86',36,36,10,1);R('#8d7444',39,36,1,7);R('#8d7444',44,36,1,7);
       R(wood[0],37,23,8,5);R('#e5dfc9',38,23,6,4);R('#453e39',39,24,2,2);R('#453e39',43,25,1,2);
      }
      if(k==='pet'){
       // Paw motif and miniature kennel; no text baked into art.
       R('#9f6873',39,25,4,3);[[37,23],[40,21],[43,23]].forEach(([x,y])=>R('#9f6873',x,y,2,2));
       R('#a78058',37,37,10,6);for(let y=33;y<38;y++)R('#795151',41-(y-33),y,2*(y-33)+2,1);R('#3c3c39',40,39,4,4);R('#dbad7d',38,38,1,4);
       R('#668b95',8,40,8,3);R('#becfca',9,40,6,1);
      }
      if(k==='cloth'){
       for(let x=6;x<48;x+=6){R('#b86187',x,20,3,2);R('#eee0c6',x+3,20,3,2);}
       R(wood[1],36,24,11,1);R(wood[0],36,24,1,17);R(wood[0],46,24,1,17);
       R('#e6c7c0',38,26,7,3);R('#e6c7c0',40,29,4,7);R('#ad7386',42,28,2,8);R('#f2decb',40,27,1,7);
      }
      if(k==='food'){
       for(let x=6;x<48;x+=6){R('#ab5143',x,19,3,3);R('#e7d6af',x+3,19,3,3);}
       R(wood[0],7,38,11,2);R(wood[1],8,40,2,3);R(wood[1],15,40,2,3);
       R('#bd864d',9,35,7,3);R('#e8c68b',10,34,5,2);R('#f3dbaa',11,35,1,1);R('#a36e46',13,35,1,2);
       R('#536a71',38,37,8,5);R('#c8c9b6',37,36,10,1);R('#dcd9bc',41,34,3,2);
      }
      if(k==='wood'){
       [[39,40],[44,40],[41,36]].forEach(([x,y])=>{disc(g,x,y,3,wood[0]);disc(g,x,y,2,wood[2]);R(wood[3],x-1,y-1,2,1);R(wood[1],x,y,1,1);});
       line(9,40,15,32,wood[1]);R('#788b92',13,32,5,3);R('#c2d0c8',13,32,4,1);
      }
      if(k==='vehicle'){
       for(const x of [35,46]){disc(g,x,40,3,'#333c43');disc(g,x,40,2,'#a5b5b5');disc(g,x,40,1,wall);}
       line(35,40,39,34,'#b88855');line(39,34,46,40,'#b88855');line(35,40,42,40,'#b88855');line(42,40,39,34,'#b88855');line(42,40,44,33,'#b88855');R('#3b4041',37,33,4,1);line(44,33,47,33,'#8a999e');
       R('#697f88',36,23,8,2);R('#c9d5cd',37,23,5,1);
      }
      if(k==='furn'){
       R('#51434a',7,34,11,9);R('#9a7f94',8,34,9,6);R('#c3a7b0',9,35,7,1);R('#786078',8,39,9,2);R(wood[1],8,42,2,1);R(wood[1],15,42,2,1);
       R(wood[1],40,35,2,8);R('#e1c58f',37,34,8,3);R('#f2dfb5',38,33,6,1);R(wood[1],37,42,8,1);
      }
      if(k==='weapon'){
       // ดาบไขว้บนผนังหน้า (เหนือประตู) + โล่เล็กตรงกลาง
       line(21,20,32,27,'#2a1b14');line(32,20,21,27,'#2a1b14');
       line(22,20,31,26,'#d6dde0');line(31,20,22,26,'#9aa7ad');
       R('#c9a04a',21,26,3,1);R('#c9a04a',30,26,3,1);R('#c9a04a',21,19,2,1);R('#c9a04a',31,19,2,1);
       R('#2a1b14',24,21,6,6);R(b.roof,25,22,4,4);R(shade(b.roof,.3),25,22,2,1);R('#e8c670',26,23,2,2);
       R('#9a7f4a',8,38,12,5);R('#c9ae6c',9,38,10,1);R('#6a6e74',10,33,1,6);R('#aab4b8',10,33,1,3);R('#6a6e74',14,34,1,5);R('#aab4b8',14,34,1,3);
      }
      if(k==='mine'){
       crate(36,36);[[38,35],[42,33],[45,35]].forEach(([x,y])=>{R('#667481',x,y,3,3);R('#bec3b5',x,y,2,1);});
       line(8,40,16,32,wood[2]);line(10,32,17,36,'#738892');line(10,31,17,35,'#c2c9bd');R('#d3af5f',10,38,3,3);R('#f1d995',11,38,1,2);
      }
    }, '#3d2a1a');
    const out={spr:s,ox:-4,oy:-15,w:s.width,h:s.height};BCACHE.set(b,out);return out;
  }

  // ภาพปิดร้าน: แผ่นไม้ตอกไขว้ปิดประตู + ป้ายแขวน (ไม่มีตัวอักษร game.js วาดทับ) • ใช้ซ้อนบน PixelArt.building(b) ของอาคาร 3x2 ที่ ox/oy เดียวกัน
  // ขนาดสไปรต์ = ขนาดอาคาร (54x46) • ป้ายมีพื้นครีมให้วาดตัวอักษรที่ sign:{x:16,y:30,w:22,h:7} ในพิกเซลของสไปรต์ (กรอบป้ายรวม 26x11)
  let CBOARDS = null;
  function closedBoards() {
    if (CBOARDS) return CBOARDS;
    const W2 = ['#463332', '#75523f', '#ae8458', '#d3b680'];
    const s = mk(54, 46, (g) => {
      const R = (c, x, y, w, h) => r(g, c, x, y, w, h);
      const line = (x, y, xx, yy, c) => { const n = Math.max(Math.abs(xx - x), Math.abs(yy - y)); for (let i = 0; i <= n; i++) R(c, Math.round(x + (xx - x) * i / (n || 1)), Math.round(y + (yy - y) * i / (n || 1)), 1, 1); };
      R('rgba(42,27,20,.28)', 21, 31, 12, 15); // เงาในช่องประตู
      // แผ่นไม้ 3 แผ่น: ขวาง 2 แผ่น + ทแยง 1
      for (const y of [33, 40]) { R(W2[0], 19, y, 16, 4); R(W2[2], 20, y + 1, 14, 2); R(W2[3], 20, y + 1, 14, 1); R(W2[1], 20, y + 3, 14, 1); R('#2a1b14', 21, y + 1, 1, 1); R('#2a1b14', 32, y + 1, 1, 1); }
      line(21, 45, 33, 30, W2[0]);line(22, 45, 34, 30, W2[1]);line(23, 45, 35, 30, W2[2]);
      // ป้ายแขวน: โซ่ 2 เส้นจากชายคา
      R(W2[0], 17, 19, 1, 9);R(W2[0], 36, 19, 1, 9);R('#9a9a92', 17, 21, 1, 1);R('#9a9a92', 36, 22, 1, 1);
      R('#2a1b14', 14, 28, 26, 11);R(W2[1], 15, 29, 24, 9);R('#efe0b4', 16, 30, 22, 7);R('#fff4d0', 16, 30, 22, 1);R('#cdb88a', 16, 36, 22, 1);
      R('#c9a04a', 15, 29, 1, 1);R('#c9a04a', 38, 29, 1, 1);
    }, false);
    CBOARDS = { spr: s, ox: -4, oy: -15, w: s.width, h: s.height, sign: { x: 16, y: 30, w: 22, h: 7 } };
    return CBOARDS;
  }

  // เคาน์เตอร์ร้าน 1 ช่อง: ตัวไม้ + ผ้าใบสีหลังคา
  const CCACHE = new Map();
  function counter(b) {
    if (CCACHE.has(b.roof)) return CCACHE.get(b.roof);
    const s = mk(16, 13, (x) => {
      const WD = ramp('#8f5a2e', .3, .25), RF = ramp(b.roof, .3, .25);
      r(x, WD[2], 0, 4, 16, 9); r(x, WD[3], 0, 4, 16, 2); r(x, WD[4], 0, 4, 16, 1); r(x, WD[0], 0, 12, 16, 1); r(x, WD[1], 13, 6, 3, 6);
      for (let i = 3; i < 16; i += 5) { r(x, WD[1], i, 7, 1, 5); r(x, WD[3], i + 1, 7, 1, 1); }
      for (let i = 0; i < 16; i += 4) { r(x, RF[2], i, 0, 2, 3); r(x, '#fff3dc', i + 2, 0, 2, 3); r(x, RF[3], i, 0, 1, 1); }
      r(x, RF[0], 0, 3, 16, 1); r(x, 'rgba(42,27,20,.3)', 0, 4, 16, 1);
    });
    CCACHE.set(b.roof, s); return s;
  }
  // ดินแปลงผัก 1 ช่อง (แห้ง/รดน้ำแล้ว) — โทนอุ่นตาม STYLE_GUIDE
  const SOIL = [false, true].map(wet => { const c = cv(U, U), x = c.getContext('2d');
    for (let py = 0; py < U; py++) for (let px = 0; px < U; px++) {
      const iy = py % 5, h = hash(px, py, wet ? 31 : 30);
      let col = iy < 1 ? (wet ? '#45291a' : '#6b4423') : iy < 4 ? (wet ? '#5c3b22' : '#9a6b3c') : (wet ? '#50331d' : '#7a4f2e');
      if (iy >= 1 && iy < 4 && h < .14) col = wet ? '#6b4728' : '#b07a48';
      if (px === 0 || py === 0) col = wet ? '#3c2416' : '#5b3a22';
      if (px === U - 1 || py === U - 1) col = wet ? '#6b4728' : '#a07040';
      r(x, col, px, py, 1, 1);
    }
    if (wet) { r(x, 'rgba(160,200,255,.25)', 3, 6, 3, 1); r(x, 'rgba(160,200,255,.25)', 10, 11, 2, 1); }
    return c; });

  // บ้านหลังใหญ่ในเมือง (HOUSE_BLD = 7×4 ช่อง): พิกเซลแบบร้าน · หลังคาจั่ว · ประตูตรงกลาง (ช่องประตูเมือง)
  let BIG_HOUSE = null;
  function bigHouse() {
    if (BIG_HOUSE) return BIG_HOUSE;
    const tw = 7 * U, th = 4 * U, OVERH = 8, ROOFH = 24; // 112×64 + ยื่นหลังคา (ขนาด/จุดยึดเดิม ป้ายชื่อใน game.js วางตรงเดิม)
    const SW = tw + OVERH * 2, SH = th + ROOFH;
    const RF = ramp('#a95643', .26, .16), WL = ramp('#e1d0ab', .13, .16), ST = ramp('#a39886', .28, .22), WD = ramp('#8f5a2e', .3, .25), SHU = ramp('#657d56', .24, .18);
    const s = mk(SW, SH, (x) => {
      const wx = OVERH, ww = tw, wb = SH, cx = wx + (ww >> 1), eave = 38;
      // ผนังไม้ตีเกล็ด
      r(x, WL[2], wx, eave, ww, wb - eave);
      for (let yy = eave + 2; yy < wb - 4; yy += 4) { r(x, WL[3], wx, yy, ww, 1); r(x, WL[1], wx, yy + 3, ww, 1); }
      r(x, WL[3], wx, eave, 3, wb - eave); r(x, WL[4], wx, eave, 1, wb - eave); r(x, WL[1], wx + ww - 4, eave, 4, wb - eave); r(x, WL[0], wx + ww - 1, eave, 1, wb - eave);
      r(x, '#d6c29b', wx+3, eave+4, ww-7, wb-eave-8);
      r(x, '#e4d3ae', wx+4, eave+6, ww-14, wb-eave-12);
      for(const px of [wx+2,wx+34,wx+ww-37,wx+ww-5]){r(x,'#624939',px,eave+4,3,wb-eave-8);r(x,'#ae8657',px,eave+5,1,wb-eave-10);}
      r(x,'#826040',wx+3,71,ww-6,2);r(x,'#bc9969',wx+4,71,ww-8,1);
      // ฐานหิน + เงาซอก
      r(x, ST[1], wx - 1, wb - 4, ww + 2, 4);
      for (let xx = wx - 1, k = 0; xx < wx + ww + 1; xx += 6, k++) { r(x, k % 2 ? ST[2] : ST[3], xx + 1, wb - 4, 5, 3); r(x, ST[4], xx + 1, wb - 4, 3, 1); r(x, ST[0], xx, wb - 4, 1, 4); }
      r(x, 'rgba(40,24,48,.35)', wx, wb - 5, ww, 1);
      // หลังคาปั้นหยา: ระนาบหน้า (เกล็ดซ้อนไล่แสงจากสันลงชายคา) + ปีกซ้ายรับแสง + ปีกขวาเงา
      const top = 3, rl = 34, L = 3, Rr = SW - 3;
      const shingle = (xa,xb,y,tone) => {
        if(xb<=xa)return; tone=clamp(tone,1,3);
        const course=Math.floor((y-top)/5),ly=(y-top)%5;
        r(x,RF[ly===4?Math.max(0,tone-1):tone],xa,y,xb-xa,1);
        if(ly===0)r(x,RF[Math.min(4,tone+1)],xa,y,xb-xa,1);
        if(ly===1||ly===2)for(let xx=xa+((course%2)*5);xx<xb;xx+=11)r(x,RF[tone-1],xx,y,1,1);
      };
      for (let y = top; y < eave; y++) {
        const t = (y - top) / (eave - top), hl = Math.round(rl - (rl - L) * t), hr = Math.round(SW - rl + (rl - L) * t), x0 = Math.round(L + (1 - t) * 8), x1 = Math.round(Rr - (1 - t) * 8);
        const tone = 3 - Math.floor(t * 2.2);
        shingle(x0, hl, y, tone + 1); shingle(hl, hr, y, tone); shingle(hr, x1, y, tone - 1); // ปีกซ้ายรับแสง • ระนาบหน้า • ปีกขวาเงา
        r(x, RF[0], hl, y, 1, 1); r(x, RF[0], hr - 1, y, 1, 1); // สันมุมปีก
        if (y > top + 1) { r(x, RF[4], x0, y, 1, 1); r(x, RF[0], x1 - 1, y, 1, 1); }
      }
      r(x, RF[0], rl - 1, top - 1, SW - rl * 2 + 2, 1); r(x, RF[4], rl, top, SW - rl * 2, 1); // สันหลังคา
      // จั่วเล็กกลางหลังคาเหนือประตู
      for (let y = 16; y < eave; y++) { const hw = Math.round((y - 16) * 1.25) + 2; r(x, RF[0], cx - hw - 1, y, hw * 2 + 2, 1); shingle(cx - hw, cx, y, 3); shingle(cx, cx + hw, y, 1); r(x, RF[4], cx - 1, y, 1, 1); }
      r(x, WL[2], cx - 12, 28, 24, eave - 28); for (let yy = 30; yy < eave; yy += 3) r(x, WL[1], cx - 12, yy, 24, 1); disc(x, cx, 31, 3, '#3a2418'); disc(x, cx, 31, 2, '#a8dcf2'); r(x, '#eaf8ff', cx - 1, 30, 1, 1); // หน้าจั่ว + ช่องแสงกลม
      // ปล่องไฟอิฐบนปีกขวา
      const chx = SW - 30; r(x, '#5a2e22', chx, 4, 10, 16); for (let yy = 6; yy < 20; yy += 3) { r(x, '#8e4a36', chx + 1, yy, 8, 2); r(x, '#a85a42', chx + 1, yy, 3, 1); } r(x, '#3d2a24', chx - 1, 2, 12, 3); r(x, '#7d7a84', chx - 1, 2, 12, 1);
      // ชายคา + ลอนย้อย + เงาชายคาบนผนัง
      r(x, RF[0], 1, eave - 1, SW - 2, 3); r(x, RF[1], 2, eave - 1, SW - 4, 1);
      for (let xx = 1; xx < SW - 1; xx++) { const dip = (xx % 4 === 0 || xx % 4 === 3) ? 1 : 0; r(x, RF[0], xx, eave + 2 + dip, 1, 1); }
      r(x, 'rgba(42,27,20,.35)', wx, eave + 2, ww, 3); r(x, 'rgba(42,27,20,.16)', wx, eave + 5, ww, 1);
      // หน้าต่างบานใหญ่ + บานเกล็ดเขียว + กระบะดอกไม้
      for (const ox of [wx + 10, wx + ww - 26]) {
        r(x, SHU[1], ox - 5, 51, 4, 16); r(x, SHU[2], ox - 5, 51, 3, 16); for (let yy = 53; yy < 66; yy += 3) r(x, SHU[0], ox - 5, yy, 4, 1);
        r(x, SHU[1], ox + 17, 51, 4, 16); r(x, SHU[3], ox + 17, 51, 1, 16); for (let yy = 53; yy < 66; yy += 3) r(x, SHU[0], ox + 17, yy, 4, 1);
        win(x, ox, 52, 16, 12, '#ff8fc7');
      }
      // ชายคาประตู + ตะเกียงสองข้าง + ประตูบานคู่
      r(x, WD[0], cx - 13, 57, 26, 3); r(x, WD[3], cx - 12, 57, 24, 1); r(x, 'rgba(42,27,20,.3)', cx - 11, 60, 22, 2);
      for (const lx of [cx - 13, cx + 11]) { r(x, '#3a2418', lx, 63, 3, 5); r(x, '#ffd36a', lx, 64, 2, 3); r(x, '#fff3b0', lx, 64, 1, 1); }
      door(x, cx - 8, 62, 8, wb - 66, [WD[1], WD[2], WD[3]]); door(x, cx, 62, 8, wb - 66, [WD[1], WD[2], WD[3]]); r(x, '#2e1c12', cx - 1, 62, 1, wb - 66);
      // กระถางข้างประตู + ขั้นบันไดหิน
      pot(x, cx - 22, wb - 12, '#ff8fc7'); pot(x, cx + 17, wb - 12, '#ffe37a');
      r(x, ST[3], cx - 12, wb - 4, 24, 2); r(x, ST[4], cx - 11, wb - 4, 22, 1); r(x, ST[2], cx - 14, wb - 2, 28, 2); r(x, ST[4], cx - 13, wb - 2, 26, 1);
      // ป้ายไม้เหนือประตู (ข้อความ/ไอคอนวาดที่ baseHi ใน game.js)
      r(x, WD[0], cx - 22, 43, 44, 12); r(x, '#e8c66a', cx - 20, 45, 40, 8); r(x, '#f6dc8a', cx - 20, 45, 40, 1); r(x, '#c9a24a', cx - 20, 52, 40, 1);
      r(x, '#c9984f', cx - 21, 44, 1, 1); r(x, '#c9984f', cx + 20, 44, 1, 1);
    }, '#3d2a1a');
    BIG_HOUSE = { spr: s, ox: -(OVERH + 1), oy: -(ROOFH + 1), w: s.width, h: s.height };
    return BIG_HOUSE;
  }


  // ---------- น้ำ: ปลา ใบบัว บ่อเป็ด พืชริมน้ำ ประภาคาร ----------
  // ปลา (มองข้าง หันขวา) 6 สายพันธุ์ × 2 เฟรมหาง: ลำตัวไล่แสงบน→เงาล่างแบบ hue shift ท้องอ่อน ครีบหลัง/อก ตามีประกาย
  // pat: 'koi' ลายแต้มขาว • 'plain' สีเดียว • 'stripe' แถบข้าง
  const FISH_KINDS = [
    { c: '#f0762e', pat: 'koi', patC: '#fff3e0' }, { c: '#e8eef2', pat: 'plain' }, { c: '#ffc83a', pat: 'plain' },
    { c: '#e4482f', pat: 'koi', patC: '#fff3e0' }, { c: '#5a86b0', pat: 'stripe', patC: '#b8dcf0' }, { c: '#f4f4ec', pat: 'koi', patC: '#e4482f' },
  ];
  const FCACHE = new Map();
  function fish(kind, frame) {
    const key = kind + ':' + frame; if (FCACHE.has(key)) return FCACHE.get(key);
    const F = FISH_KINDS[kind % FISH_KINDS.length], C = ramp(F.c, .3, .2), BELLY = hue(F.c, .45), FIN = hue(F.c, -.18);
    const BODY = [[2, 6], [1, 8], [0, 9], [0, 9], [1, 8], [3, 6]]; // [x เริ่ม, x จบ] ต่อแถว (6 แถว)
    const s = mk(16, 9, (x) => {
      const ox = 4, oy = 1;
      // หาง: ก้านหางกว้างขึ้นเป็นง่ามสองแฉก ปลายแกว่งตามเฟรม
      const t = frame ? 1 : -1;
      r(x, FIN, ox - 1, oy + 2, 1, 2); r(x, FIN, ox - 2, oy + 1, 1, 4); r(x, hue(F.c, .2), ox - 2, oy + 1, 1, 1);
      r(x, FIN, ox - 3, oy + (t > 0 ? 0 : 1), 1, 2); r(x, FIN, ox - 3, oy + (t > 0 ? 4 : 3), 1, 2); r(x, C[0], ox - 3, oy + (t > 0 ? 0 : 5), 1, 1);
      // ครีบหลัง
      r(x, FIN, ox + 2, oy - 1, 4, 1); r(x, hue(F.c, .25), ox + 2, oy - 1, 1, 1);
      // ลำตัว
      BODY.forEach(([a, b], y) => {
        const col = y === 0 ? C[3] : y === 1 ? C[2] : y === 2 ? C[2] : y === 3 ? C[1] : y === 4 ? BELLY : BELLY;
        r(x, col, ox + a, oy + y, b - a + 1, 1);
      });
      r(x, C[4], ox + 3, oy + 1, 4, 1); r(x, C[3], ox + 2, oy + 2, 2, 1); // แสงสะท้อนบนหลัง (ซ้ายบน)
      r(x, C[1], ox + 1, oy + 4, 2, 1); r(x, C[0], ox + 3, oy + 5, 3, 1); // เงาท้องลึก
      // ลวดลาย
      if (F.pat === 'koi') { r(x, F.patC, ox + 2, oy + 1, 3, 2); r(x, F.patC, ox + 6, oy + 2, 2, 2); r(x, F.patC, ox + 4, oy + 3, 1, 1); }
      if (F.pat === 'stripe') { r(x, F.patC, ox + 1, oy + 3, 8, 1); r(x, C[0], ox + 1, oy + 4, 7, 1); }
      // ครีบอก + เหงือก + ตา
      r(x, FIN, ox + 5, oy + 3, 2, 2); r(x, C[0], ox + 6, oy + 4, 1, 1); r(x, C[1], ox + 6, oy + 1, 1, 4);
      r(x, '#1a2a3a', ox + 8, oy + 2, 1, 1); r(x, '#ffffff', ox + 8, oy + 1, 1, 1);
    }, { soft: ['#12445e', '#2a6f8a'] });
    FCACHE.set(key, s); return s;
  }
  // ใบบัว: 'big' มีแฉกเว้า (วีด้านขวา) เส้นใบแผ่ • 'small' วงรี • flower = ดอกบัวสีชมพู/ขาว • แต่ละใบมีเงาตกใต้ใบบนน้ำ
  const LCACHE = new Map();
  function lily(kind) { // 0 ใหญ่ 1 เล็ก 2 เล็กอีกแบบ 3 ใหญ่+บัวชมพู 4 ใหญ่+บัวขาว 5 ใหญ่ครึ่งใบ
    if (LCACHE.has(kind)) return LCACHE.get(kind);
    const G3 = ramp('#3f9a46', .3, .22), big = kind === 0 || kind >= 3, rx = big ? 5.5 : 3, ry = big ? 4 : 2.2, W2 = big ? 14 : 8, H2 = big ? 12 : 7;
    const s = mk(W2, H2, (x) => {
      const cx = W2 / 2 - 0.5, cy = H2 / 2 - 0.5 + (kind >= 3 ? 1 : 0);
      // เงาบนน้ำใต้ใบ (โปร่ง อมน้ำเงิน)
      for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) if ((dx / rx) ** 2 + (dy / ry) ** 2 <= 1.05) r(x, 'rgba(12,70,90,.28)', Math.round(cx + dx + 1), Math.round(cy + dy + 1), 1, 1);
      for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
        const d = (dx / rx) ** 2 + (dy / ry) ** 2; if (d > 1) continue;
        const ang = Math.atan2(dy, dx); if (big && kind !== 5 && Math.abs(ang) < 0.42 && dx > 0) continue; // แฉกเว้าด้านขวา
        const lit = clamp(.55 - (dx / rx) * .28 - (dy / ry) * .34 + (1 - d) * .12, 0, 1);
        r(x, d > .72 ? G3[1] : lit > .66 ? G3[3] : lit > .42 ? G3[2] : G3[1], Math.round(cx + dx), Math.round(cy + dy), 1, 1);
      }
      if (big) { for (const a of [0.9, 1.7, 2.5, 3.3, 4.2, 5.2]) { const e = Math.round(rx * .8 * Math.cos(a)), f = Math.round(ry * .8 * Math.sin(a)); r(x, G3[1], Math.round(cx + e / 2), Math.round(cy + f / 2), 1, 1); r(x, G3[1], Math.round(cx + e), Math.round(cy + f), 1, 1); } r(x, G3[0], Math.round(cx), Math.round(cy), 1, 1); }
      r(x, G3[4], Math.round(cx - rx * .45), Math.round(cy - ry * .55), 2, 1); // ประกายแสงบนใบ
      if (kind === 3 || kind === 4) { // ดอกบัว: กลีบ 5 กลีบ + เกสรเหลือง
        const P = kind === 3 ? ['#e0568e', '#ff8cb8', '#ffd0e4'] : ['#b8c6d6', '#f2f6fa', '#ffffff'], fx = Math.round(cx), fy = Math.round(cy - 1);
        r(x, P[0], fx - 2, fy, 5, 2); r(x, P[1], fx - 1, fy - 1, 3, 2); r(x, P[1], fx - 2, fy - 1, 1, 2); r(x, P[1], fx + 2, fy - 1, 1, 2); r(x, P[2], fx - 1, fy - 2, 3, 1); r(x, '#ffd23f', fx, fy - 1, 1, 1);
      }
    }, { soft: ['#14452a', '#2a6a3a'] });
    LCACHE.set(kind, s); return s;
  }
  // พืชริมน้ำ (วาดลงพื้น): กอกกหางกระรอก + ก้อนหินริมตลิ่ง
  function cattail(seed) {
    const R = rng(seed), n = 2 + Math.floor(R() * 2), H2 = 12;
    return mk(10, H2, (x) => {
      r(x, 'rgba(12,70,60,.28)', 1, H2 - 2, 8, 2);
      for (let i = 0; i < n; i++) {
        const bx = 2 + i * 3 + Math.floor(R() * 2), top = 2 + Math.floor(R() * 4), lean = i === 0 ? -1 : i === n - 1 ? 1 : 0;
        for (let y = top; y < H2 - 1; y++) { const xx = bx + Math.round(lean * (H2 - y) / 8); r(x, y > H2 - 4 ? '#4f913b' : '#6cbf55', xx, y, 1, 1); r(x, '#2f6b3a', xx + 1, y, 1, 1); }
        r(x, '#7a4a22', bx + lean * -0, top - 1, 2, 3); r(x, '#b8793c', bx, top - 1, 1, 2); r(x, '#3a2418', bx + 1, top + 1, 1, 1); // รวงสีน้ำตาล
        const lx = bx + (lean ? lean * 2 : 2); r(x, '#8cd468', lx, H2 - 5, 2, 1); r(x, '#8cd468', lx + (lean >= 0 ? 1 : -1), H2 - 6, 1, 1);
      }
    }, { soft: ['#1f4a2a', '#3a6a3a'] });
  }
  function stone(seed) {
    const R = rng(seed), w = 4 + Math.floor(R() * 3), h = 3 + Math.floor(R() * 2), C = ramp('#9a9fa8', .28, .22);
    return mk(w, h, (x) => {
      r(x, 'rgba(12,40,60,.25)', 1, h - 1, w, 1);
      r(x, C[2], 0, 1, w, h - 1); r(x, C[3], 0, 0, w - 1, 2); r(x, C[4], 0, 0, 2, 1); r(x, C[1], w - 2, h - 2, 2, 1); r(x, C[0], 1, h - 1, w - 1, 1);
    }, { soft: ['#3a3f4a', '#6a6f7a'] });
  }
  const SPROP = { cat: [cattail(3), cattail(11), cattail(19), cattail(27)], stone: [stone(1), stone(2), stone(3), stone(4)] };
  // บ่อเป็ดในคอก (ใต้ g ที่สเกลเป็นพิกเซลเกม): ขอบดิน+หิน น้ำไล่เฉด ประกายแสง ใบบัวบัว กอกก ระลอก
  let DPOND = null;
  function duckPond() {
    if (DPOND) return DPOND;
    const w = 34, h = 26, cx = 17, cy = 13, WC = ramp('#3a9fd0', .3, .22), MD = ramp('#b99a5c', .22, .25);
    const s = mk(w, h, (x) => {
      const inE = (px, py, rx, ry) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const wob = vnoise(px, py, 5, 61) * .12;
        if (inE(px, py, 16.5 + wob * 6, 12 + wob * 4)) r(x, (px - cx) * .4 + (py - cy) < -3 ? MD[3] : (px - cx) * .4 + (py - cy) > 4 ? MD[1] : MD[2], px, py, 1, 1); // ขอบดินชื้น: ซ้ายบนสว่าง ขวาล่างเข้ม
      }
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const wob = vnoise(px, py, 5, 62) * .1;
        if (!inE(px, py, 15 + wob * 5, 10.5 + wob * 4)) continue;
        const d = ((px - cx) / 15) ** 2 + ((py - cy) / 10.5) ** 2, v = clamp(Math.floor((1 - d) * 3.4 + dith(px, py) * .9 - .3), 0, 3);
        r(x, WC[clamp(3 - v, 0, 3) ? 3 - v : 0], px, py, 1, 1);
        if (py < cy - 2 && px < cx && dith(px, py) > .6) r(x, WC[4], px, py, 1, 1);
      }
      for (let px = 6; px < 12; px++) r(x, '#eafdfd', px, 5 + Math.round((px - 6) * .3), 1, 1); // แสงสะท้อนขอบบน
      r(x, '#cdf4f8', 9, 9, 3, 1); r(x, '#cdf4f8', 21, 15, 2, 1); r(x, '#ffffff', 12, 7, 1, 1); // ประกาย
      ell(x, 22, 13, 5, 2, 'rgba(255,255,255,.18)'); r(x, '#eafdfd', 17, 11, 6, 1); r(x, '#eafdfd', 16, 15, 8, 1); // ระลอกวง
      r(x, 'rgba(12,70,90,.3)', 13, 9, 7, 4);
    }, { soft: ['#4a3a22', '#8a7040'] });
    const g = s.getContext('2d'); // หินริมตลิ่ง + กอกก + ใบบัว วาดทับ (ผ่านขอบ)
    for (const [sx, sy, k] of [[2, 10, 0], [30, 8, 1], [27, 21, 3], [13, 25, 1]]) g.drawImage(SPROP.stone[k], sx, sy);
    g.drawImage(SPROP.cat[0], 25, 1); // กอกกมุมขวาบนกอเดียว ไม่ให้บังน้ำ
    g.drawImage(lily(1), 22, 13); g.drawImage(lily(4), 8, 15);
    DPOND = { spr: s, w: s.width, h: s.height }; return DPOND;
  }

  // ประภาคาร (กลางสระ): เกาะทราย + ฐานหิน + หอลายแดงขาวเรียวขึ้น + ระเบียงราว + ห้องตะเกียงกระจก + โดมแดง • lampY = แถวกลางห้องตะเกียง (ใช้จัดแนวลำแสง) • cx = แกนกลาง
  let LH = null;
  function lighthouse() {
    if (LH) return LH;
    const w = 40, h = 64, cx = 20, RFd = ramp('#a95643', .24, .16), WH = ramp('#e4d8b9', .16, .15), ST = ramp('#848a8c', .23, .17), DK = ramp('#3a3f4a', .3, .2), SD = ramp('#e8d49a', .25, .2);
    const s = mk(w, h, (x) => {
      // เกาะทราย: ขอบเปียกเข้ม → ทรายกลาง → แสงซ้ายบน + กรวด + กอหญ้า
      ell(x, cx, 58, 19, 6, SD[0]); ell(x, cx, 57, 18, 5, SD[1]); ell(x, cx, 57, 16, 4, SD[2]); ell(x, cx - 3, 56, 11, 3, SD[3]);
      for (let k = 0; k < 8; k++) { const a = hash(k, 3, 91), b = hash(k, 5, 92); const px = Math.round(cx - 15 + a * 30), py = Math.round(55 + b * 5); if ((px - cx) ** 2 / 17 ** 2 + (py - 57) ** 2 / 4.5 ** 2 < 1) r(x, k % 3 ? SD[4] : SD[0], px, py, 1, 1); }
      for (const [rx2, ry2] of [[6, 59], [32, 58], [10, 56]]) { r(x, ST[3], rx2, ry2, 3, 2); r(x, ST[4], rx2, ry2, 1, 1); r(x, ST[0], rx2 + 1, ry2 + 2, 2, 1); }
      r(x, '#4f913b', 30, 55, 1, 2); r(x, '#7cc76a', 31, 54, 1, 3); r(x, '#4f913b', 32, 55, 1, 2);
      // ฐานหินกลม + ก้อนหินสลับแถว
      for (let y = 48; y < 57; y++) { const hw = 9 + (y - 48) * .25 | 0; r(x, ST[2], cx - hw, y, hw * 2 + 1, 1); r(x, ST[3], cx - hw, y, 3, 1); r(x, ST[1], cx + hw - 2, y, 3, 1); if ((y - 48) % 3 === 2) r(x, ST[0], cx - hw, y, hw * 2 + 1, 1); else for (let xx = cx - hw + ((y - 48) % 2) * 3; xx < cx + hw; xx += 6) r(x, ST[0], xx, y, 1, 1); }
      r(x, ST[4], cx - 8, 48, 6, 1);
      // ตัวหอ: ลอนแคบลงขึ้นบน แถบสีแดง/ขาวสลับทุก 7 แถว ซ้ายรับแสงขวาเงา + หน้าต่างเรืองแสง + ประตู
      const yT = 23, yB = 48;
      for (let y = yT; y < yB; y++) {
        const t = (y - yT) / (yB - yT), hw = Math.round(5.5 + t * 3.5), band = Math.floor((y - yT) / 7) % 2, P = band ? WH : RFd;
        r(x, P[2], cx - hw, y, hw * 2 + 1, 1); r(x, P[3], cx - hw, y, 2, 1); r(x, P[4], cx - hw, y, 1, 1); r(x, P[1], cx + hw - 3, y, 2, 1); r(x, P[0], cx + hw - 1, y, 2, 1);
        if ((y - yT) % 7 === 0) r(x, band ? RFd[0] : WH[1], cx - hw, y, hw * 2 + 1, 1); // รอยต่อแถบ
      }
      for (const [wy, wh] of [[30, 4], [39, 4]]) { r(x, '#2a1b14', cx - 2, wy, 4, wh); r(x, '#ffe08a', cx - 1, wy + 1, 2, wh - 2); r(x, '#fff6cf', cx - 1, wy + 1, 1, 1); r(x, DK[3], cx - 3, wy + wh, 6, 1); }
      r(x, '#3a2418', cx - 2, 43, 4, 5); r(x, '#6e4524', cx - 1, 43, 2, 5); r(x, '#c9962a', cx + 1, 45, 1, 1);
      // ระเบียง: แผ่นพื้นเหล็ก + เสาราว + ราวบน + ร่มเงาใต้ระเบียงบนตัวหอ
      r(x, 'rgba(26,28,44,.35)', cx - 6, 24, 12, 2);
      r(x, DK[1], cx - 9, 21, 19, 2); r(x, DK[3], cx - 9, 21, 19, 1); r(x, DK[0], cx - 8, 23, 17, 1);
      for (let xx = cx - 8; xx <= cx + 8; xx += 2) r(x, DK[2], xx, 18, 1, 3); r(x, DK[3], cx - 9, 17, 19, 1); r(x, DK[4], cx - 9, 17, 6, 1);
      // ห้องตะเกียง: กรอบโลหะ + กระจกเรืองแสง + เสากลาง + ฐาน/หลังคา
      r(x, DK[1], cx - 6, 9, 13, 8); r(x, '#ffe08a', cx - 5, 10, 11, 6); r(x, '#fff6cf', cx - 3, 11, 5, 4); r(x, '#ffffff', cx - 1, 12, 2, 2); r(x, '#ffd166', cx + 3, 10, 3, 6);
      r(x, DK[0], cx - 6, 9, 1, 8); r(x, DK[0], cx + 6, 9, 1, 8); r(x, DK[2], cx - 1, 10, 1, 6); r(x, DK[3], cx - 6, 16, 13, 1); r(x, DK[1], cx - 6, 8, 13, 1);
      // โดมแดง: ซ้ายสว่างขวาเงา + ปลายทอง
      for (let y = 2; y < 8; y++) { const hw = 1 + (y - 2); r(x, RFd[2], cx - hw, y, hw * 2 + 1, 1); r(x, RFd[3], cx - hw, y, Math.max(1, hw >> 1), 1); r(x, RFd[0], cx + hw - Math.max(1, hw >> 1), y, Math.max(1, hw >> 1) + 0, 1); }
      r(x, RFd[4], cx - 1, 2, 1, 1); r(x, '#f1c40f', cx, 0, 1, 2); r(x, '#fff3a0', cx, 0, 1, 1);
    }, '#3d2a1a');
    LH = { spr: s, w: s.width, h: s.height, cx: cx + 1, lampY: 13 + 1, baseY: 57 + 1 }; return LH;
  }
  // ตกแต่งริมน้ำบนพื้น: กอกก/หินวางบนทรายที่ติดน้ำ (เรียกหลัง putImageData ใน ground)
  function shoreProps(x, tileT, W2, H2, hashf) {
    for (let ty = 1; ty < H2 - 1; ty++) for (let tx = 1; tx < W2 - 1; tx++) {
      if (tileT(tx, ty) !== SA) continue;
      const nearW = tileT(tx, ty - 1) === WA || tileT(tx - 1, ty) === WA || tileT(tx + 1, ty) === WA || tileT(tx, ty + 1) === WA; if (!nearW) continue;
      const h1 = hashf(tx, ty, 301);
      if (h1 < .13) x.drawImage(SPROP.cat[Math.floor(hashf(tx, ty, 302) * 4)], tx * U + 3, ty * U - 2);
      else if (h1 < .24) x.drawImage(SPROP.stone[Math.floor(hashf(tx, ty, 303) * 4)], tx * U + 4 + Math.floor(hashf(tx, ty, 304) * 6), ty * U + 5 + Math.floor(hashf(tx, ty, 305) * 5));
    }
  }


  // ภูเขาถ้ำเหมือง v2 (cave-kit-v2 ผู้ดูแลออกแบบ 31 ต.ค. 2026) ภาพ 66×146 (ขอบใส 1) ×2 = พิกเซลเกม วางที่ช่อง x MINE.hill.x0 แถว 0 ลบ 2 px • วาดรูปทรงตายตัวสำหรับกว้าง 64 cx 40
  // มวลหินเป็นก้อนใหญ่ ปากถ้ำโค้งซ้อนเงา มอสและผลึกเป็นกลุ่ม ไม่มี noise • สีหินเข้มกว่าชุดต้นฉบับ (ถ้ำหิน) • top/peaks รับไว้ตาม API เดิม (ช่องทึบยังใช้ Shared.hillTop) • คืน c.sign / c.lamp
  function caveHill(top, peaks, w = 64, cx = 40) {
    const c=cv(w+2,146), g=c.getContext('2d');
    const P={edge:'#252b29',dark:'#404543',shade:'#57594f',rock:'#6f7062',light:'#8f8b76',sun:'#aca58a',moss:'#498346',leaf:'#75af48',tip:'#acd45c'};
    const put=(x,y,col)=>{if(x>=0&&x<w&&y>=0&&y<144){g.fillStyle=col;g.fillRect(x+1,y+1,1,1);}};
    const rect=(x,y,a,b,col)=>{for(let j=y;j<y+b;j++)for(let i=x;i<x+a;i++)put(i,j,col);};
    // Integer rasterisation: no antialiasing or scattered random grain.
    const poly=(pts,col)=>{for(let y=Math.max(0,Math.min(...pts.map(p=>p[1])));y<=Math.min(143,Math.max(...pts.map(p=>p[1])));y++)for(let x=0;x<w;x++){let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){let a=pts[i],b=pts[j];if(((a[1]>y+.5)!=(b[1]>y+.5))&&(x+.5<(b[0]-a[0])*(y+.5-a[1])/(b[1]-a[1])+a[0]))inside=!inside;}if(inside)put(x,y,col);}};
    // Preserve existing occupied tile-centres while replacing pointed peaks with ledges.
    poly([[0,127],[3,116],[7,109],[9,104],[14,101],[21,103],[25,99],[31,95],[35,87],[43,87],[48,95],[52,102],[58,105],[62,115],[64,129],[63,141],[57,144],[8,144],[1,140]],P.edge);
    poly([[2,126],[5,116],[10,109],[11,105],[16,103],[22,106],[28,101],[33,97],[37,89],[43,89],[48,98],[50,105],[57,108],[61,118],[62,137],[55,142],[8,142],[3,138]],P.rock);
    poly([[39,95],[46,97],[49,105],[56,108],[61,120],[61,138],[54,142],[46,137],[48,120]],P.shade);
    poly([[3,128],[8,116],[13,112],[22,113],[26,124],[23,140],[8,140],[4,137]],P.light);
    poly([[25,105],[33,98],[38,94],[42,94],[36,104],[28,112],[24,112]],P.light);
    poly([[30,106],[36,100],[43,101],[45,108],[40,112],[31,113]],P.sun);
    poly([[26,114],[31,112],[42,113],[49,119],[50,126],[46,128],[39,119],[32,119],[27,124],[23,124]],P.dark);
    // Broken sediment ledges, grouped in large blocks.
    poly([[6,119],[11,114],[18,114],[22,117],[21,120],[10,121]],P.sun);
    poly([[8,122],[20,121],[23,124],[20,126],[7,127]],P.shade);
    poly([[48,111],[55,112],[58,116],[51,116]],P.light);
    poly([[52,120],[59,121],[61,126],[55,125]],P.dark);
    poly([[8,131],[16,129],[22,132],[21,138],[12,140],[6,137]],P.rock);
    rect(9,130,9,1,P.sun);rect(11,140,10,2,P.shade);
    // Large natural stone arch: darker successive rims make the mouth feel deep.
    poly([[cx-14,143],[cx-14,132],[cx-12,125],[cx-8,121],[cx-2,119],[cx+5,121],[cx+10,126],[cx+12,134],[cx+12,143]],P.light);
    poly([[cx-11,143],[cx-11,131],[cx-8,125],[cx-3,122],[cx+3,123],[cx+8,128],[cx+9,143]],P.dark);
    poly([[cx-8,143],[cx-8,133],[cx-5,128],[cx,126],[cx+4,129],[cx+6,134],[cx+6,143]],'#303b3f');
    poly([[cx-5,143],[cx-5,134],[cx-2,130],[cx+2,131],[cx+4,135],[cx+4,143]],'#17272d');
    poly([[cx-7,143],[cx-4,139],[cx+4,139],[cx+6,143]],'#50544a');
    // Small supports follow the arch, leaving the threshold unobstructed.
    rect(cx-11,132,2,11,'#654a33');rect(cx-11,132,1,10,'#bc8a4a');
    rect(cx+8,134,2,9,'#654a33');rect(cx+8,134,1,8,'#aa7840');
    for(let y=139;y<144;y+=3)rect(cx-4,y,8,1,'#b18b58');
    rect(cx-3,139,1,5,'#a4b6ac');rect(cx+3,139,1,5,'#a4b6ac');
    const moss=(x,y,n)=>{rect(x,y,n,2,P.moss);rect(x+1,y-1,n-2,2,P.leaf);rect(x+2,y-2,n-4,1,P.tip);rect(x+n-2,y+2,1,2,P.moss);};
    moss(10,105,10);moss(34,94,10);moss(5,126,7);moss(53,135,8);
    // Mineral accent only on the left buttress, away from the entrance.
    poly([[16,126],[14,121],[16,116],[19,120],[19,126]],'#317a85');
    poly([[16,124],[15,120],[16,117],[17,121],[17,124]],'#9cddd0');
    poly([[19,126],[19,122],[21,120],[22,125]],'#58acaf');
    // Keep sign and lamp anchors identical to the original game contract.
    rect(cx-5,118,11,6,'#4e4535');rect(cx-4,119,9,4,'#bb8b4e');rect(cx-3,119,7,1,'#e0b66a');
    rect(cx+11,126,2,2,P.edge);rect(cx+12,127,1,2,P.edge);
    rect(cx+11,128,3,4,'#414b45');rect(cx+12,129,1,2,'#ffe3a0');rect(cx+11,132,3,1,'#a77a3d');
    c.sign={x:cx+.5,y:121};c.lamp={x:cx+12.5,y:130};return c;
  }
  return { mk, r, ell, disc, shade, ramp, hue, fish, lily, duckPond, lighthouse,  hash, rng, addOutline, caveHill, cv, U, OUT, ground, GK: 2, mapDecor, fences, tree: treeFor, building, closedBoards, counter, bigHouse, soil: wet => SOIL[wet ? 1 : 0], ROOF_UP, OVER };
})();
