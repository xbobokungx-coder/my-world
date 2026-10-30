// สไปรต์ก้อนแร่ในถ้ำ (v2 ออกแบบใหม่โดยผู้ดูแล 30 ต.ค. 2026): ทุกชนิด/ขนาดอยู่ในช่อง 16×16 จุดยึดกลางขอบล่าง game.js วาดขยาย 2 เท่า
/* PixelOre v2 — exact 16×16 cells, bottom-centre anchor (8,16).
 * get(kind,size=2,f=0) is compatible with the previous API.
 * size: 0 small, 1 medium, 2 large; f truthy selects sparkle frame.
 * Returned canvases are cached: do not mutate them.
 * No PixelArt dependency. Browser DOM canvas, or injected canvas factory for Node.
 */
const PixelOre = (() => {
 const TILE=16, OUTLINE='#252735';
 const PAL={"stone":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","c":"#4c536a"},"coal":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#3a3a44","p":"#62626f","q":"#1c1c22"},"copper":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#e8924a","p":"#ffc58a","q":"#b0602a"},"iron":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#c49a82","p":"#e8cbb4","q":"#8a6a58"},"silver":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#eef2f7","p":"#ffffff","q":"#aab4c2","s":"#ffffff"},"gold":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#ffe066","p":"#fff3a8","q":"#d9a21e","s":"#ffffff"},"amethyst":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#b36be0","p":"#e2b8ff","q":"#7a35b0","s":"#ffffff"},"ruby":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#e0334f","p":"#ff9aa8","q":"#9a1630","s":"#ffffff"},"emerald":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#2fcf78","p":"#9bffc4","q":"#13803f","s":"#ffffff"},"crystal":{"h":"#f2fbff","l":"#d3e6f2","m":"#b3cce0","d":"#8aa4c0","x":"#647fa0","n":"#5ec8f0","p":"#d4f8ff","q":"#2a82bd","s":"#ffffff"},"opal":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#e8f0ff","p":"#ffffff","q":"#a8b8d8","s":"#ffd0f0"},"topaz":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#f2c030","p":"#fff0a0","q":"#c08010","s":"#ffffff"},"sapphire":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#3a62d8","p":"#a8c4ff","q":"#1c2f8a","s":"#ffffff"},"garnet":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#b8402c","p":"#ee8c70","q":"#6a1a12"},"jade":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#2fb878","p":"#9af0c0","q":"#12704a","s":"#ffffff"},"obsidian":{"h":"#c8bee0","l":"#9a8cb8","m":"#6a5a8a","d":"#4a3c68","x":"#2c2244","n":"#2a2038","p":"#6a5a8a","q":"#12091c","s":"#ffffff"},"moonstone":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#c4d4ff","p":"#ffffff","q":"#7a8ac0","s":"#ffffff"},"sunstone":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#ff9a3c","p":"#ffd890","q":"#c04a14","s":"#ffffff"},"mythril":{"h":"#e3e7ee","l":"#c3c9d6","m":"#a4abb8","d":"#7c8494","x":"#5b6477","n":"#58d8f0","p":"#d0faff","q":"#2a88b0","s":"#ffffff"},"starcore":{"h":"#fffbe0","l":"#f0e4b0","m":"#d4c080","d":"#a89050","x":"#786830","n":"#ffd84a","p":"#fffbb0","q":"#d08a10","s":"#ffffff"}};
 const BASE={h:'#eee2c9',l:'#bdbdb2',m:'#92979a',d:'#646e80',x:'#424b60',c:'#343c50'};
 for(const [k,p] of Object.entries(PAL)) if(!['crystal','obsidian','starcore'].includes(k)) Object.assign(p,BASE);
 Object.assign(PAL.coal,{p:'#454451',n:'#22232d',q:'#10131d'});
 Object.assign(PAL.copper,{p:'#ffe0a0',n:'#ef923e',q:'#a34d27'});
 Object.assign(PAL.iron,{p:'#e8b6a2',n:'#b97f73',q:'#754f52'});
 Object.assign(PAL.gold,{p:'#fff2b1',n:'#f4bd40',q:'#ac6a25'});
 const rocks=[
 ['..hhl....','.hllmm...','hllmmmdd.','llmmmdddx','.mmddddx.','..dxxxx..'],
 ['...hhll....','..hlllmm...','.hllmmmmd..','hllmmmmmddd','llmmmlmmddx','lmmmlmddddx','.mmmmmdddxx','..ddddxxxx.'],
 ['.....hhll.....','...hhllllm....','..hlllllmmm...','.hlllmmmmmmd..','hllmmmmmmmdddd','llmmmllmmmdddx','lmmmhllmmddddx','lmmmmmmmddddxx','.mmmmmddddxxx.','..dddxxxxxxx..']
 ];
 const crystals=[
 ['....p....','...pnq...','...pnq...','.p.nnq.p.','.pnqnqpnq','..nqqnnq.','..hllmm..','.hllmmdd.','..dddxx..'],
 ['.....p.....','....pnnq...','....pnnq...','.p..pnnq.p.','.pnqnnnqpnq','..pnqnnqnnq','..nnqqnqnq.','...nnqnqq..','..hhlllmm..','.hllmmmddd.','..ddddxxx..'],
 ['......p.......','.....pnnq.....','....ppnnqq....','....pnnnqq....','.p..pnnnqq..p.','.pnqpnnnqq.pnq','..pnqnnnqqpnnq','..pnqqnnqqnnqq','...nnqqnqnnqq.','...nnqqqqnqq..','..hhllmmllmm..','.hlllmmmmmddd.','..mmddddddxx..','...ddxxxxxx...']
 ];
 const dots=new Set(['coal','copper','silver','opal','garnet','moonstone']);
 const veins=new Set(['iron','gold','jade','sunstone','mythril']);
 const cache=new Map(),ART={},own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k); // แทน Object.hasOwn (มือถือรุ่นเก่าไม่มี)
 function body(kind,size){
  const rock=kind==='stone'||dots.has(kind)||veins.has(kind);
  const rows=(rock?rocks:crystals)[size],w=Math.max(...rows.map(r=>r.length));
  const a=Array.from({length:TILE},()=>Array(TILE).fill('.'));
  const ox=Math.floor((TILE-w)/2),oy=TILE-1-rows.length;
  rows.forEach((r,y)=>[...r].forEach((v,x)=>a[oy+y][ox+x]=v));
  const put=(x,y,ch)=>{if(x>0&&x<15&&y>0&&y<15&&a[y][x]!=='.')a[y][x]=ch;};
  if(dots.has(kind)){
   const points=size===0?[[5,10],[9,12]]:size===1?[[6,8],[10,10],[5,12]]:[[8,6],[4,10],[10,9],[9,12]];
   points.forEach(([x,y])=>{put(x,y,'p');put(x+1,y,'n');put(x,y+1,'n');put(x+1,y+1,'q');});
  }
  if(veins.has(kind)){
   const start=[5,4,3][size],end=[10,11,12][size];
   for(let x=start;x<=end;x++) {const y=17-x;put(x,y,'p');put(x,y+1,'n');put(x,y+2,'q');}
  }
  return a.map(r=>r.join(''));
 }
 Object.keys(PAL).forEach(k=>ART[k]=[0,1,2].map(s=>body(k,s)));
 let factory=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 function get(kind,size=2,f=0){
  if(!own(ART,kind)||!Number.isInteger(size)||size<0||size>2)return null;
  const key=`${kind}:${size}:${f?1:0}`;
  if(cache.has(key))return cache.get(key);
  const rows=ART[kind][size],pal=PAL[kind],c=factory(TILE,TILE),g=c.getContext('2d');
  const solid=(x,y)=>x>=0&&x<16&&y>=0&&y<16&&rows[y][x]!=='.';
  g.fillStyle=OUTLINE;
  for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(!solid(x,y)&&(solid(x-1,y)||solid(x+1,y)||solid(x,y-1)||solid(x,y+1)))g.fillRect(x,y,1,1);
  let sparkCount=0;
  rows.forEach((r,y)=>[...r].forEach((ch,x)=>{
   if(ch==='.')return;
   if(!pal[ch])throw Error(`Missing palette ${kind}/${ch}`);
   // Two selective highlight pixels; never flash the entire crystal face.
   g.fillStyle=f&&pal.s&&ch==='p'&&sparkCount++<2?pal.s:pal[ch];g.fillRect(x,y,1,1);
  }));
  cache.set(key,c);return c;
 }
 function sheet(size=2,f=0,kinds=Object.keys(ART).slice(0,10),columns=5){
  if(!Number.isInteger(columns)||columns<1||!kinds.length)throw Error('Invalid sheet layout');
  const c=factory(columns*TILE,Math.ceil(kinds.length/columns)*TILE),g=c.getContext('2d');
  kinds.forEach((k,i)=>{const s=get(k,size,f);if(!s)throw Error('Invalid sprite');g.drawImage(s,(i%columns)*TILE,Math.floor(i/columns)*TILE);});return c;
 }
 return {has:k=>own(ART,k),get,ART,PAL,TILE,sheet,setCanvasFactory(fn){factory=fn;cache.clear();}};
})();
if(typeof module!=='undefined')module.exports=PixelOre;
