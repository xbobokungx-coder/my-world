/* PixelCrops V1 — 48x64 transparent art, anchor (24,60).
   Eight hand-structured growth states. Integer raster only.
   Stage 0..6 = planted to harvest-ready; 7 = after harvest.
   Timing is normalized game progression, not agronomic advice. */
const PixelCrops = (()=>{
const catalog=[
 ['carrot','แครอท','root','single'],['cabbage','กะหล่ำปลี','cabbage','single'],['corn','ข้าวโพด','corn','single'],['tomato','มะเขือเทศ','bush','repeat'],['eggplant','มะเขือม่วง','bush','repeat'],['strawberry','สตรอว์เบอร์รี','low','repeat'],['pumpkin','ฟักทอง','vine','single'],['grape','องุ่น','trellis','repeat'],['pineapple','สับปะรด','pineapple','single'],['watermelon','แตงโม','vine','single'],['mango','มะม่วง','tree','repeat'],['peach','พีช','tree','repeat'],['kiwi','กีวี','trellis','repeat'],['coconut','มะพร้าวน้ำหอม','palm','repeat'],['avocado','อะโวคาโด','tree','repeat'],['blueberry','บลูเบอร์รี','bush','repeat'],['cacao','เมล็ดโกโก้','tree','repeat'],['truffle','เห็ดทรัฟเฟิล','underground','repeat'],['golden_sunflower','ทานตะวันทอง','sunflower','single'],['golden_tulip','ทิวลิปทอง','tulip','single']
].map(([id,name,form,harvestMode])=>({id,name,form,harvestMode}));
const stages=['planted','sprout','seedling','growing','flowering','unripe','ready','harvested'];
const thresholds=[0,.08,.2,.4,.6,.8,1];
let factory=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};const cache=new Map;
const O='#263b32',D='#326141',G='#508846',L='#80b84e',H='#b4d66b',B='#755039',BL='#b17b4a';
function get(id,stage=6){const spec=catalog.find(c=>c.id===id);if(!spec||!Number.isInteger(stage)||stage<0||stage>7)return null;const key=id+'/'+stage;if(cache.has(key))return cache.get(key);
 const W=48,HH=64,c=factory(W,HH),g=c.getContext('2d'),a=Array.from({length:HH},()=>Array(W).fill(null));
 const dot=(x,y,col)=>{x=Math.round(x);y=Math.round(y);if(x>0&&x<W-1&&y>0&&y<HH-1)a[y][x]=col;};
 const rect=(x,y,w,h,col)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)dot(x+i,y+j,col);};
 const ell=(x,y,rx,ry,col)=>{for(let j=-Math.ceil(ry);j<=ry;j++)for(let i=-Math.ceil(rx);i<=rx;i++)if(i*i/(rx*rx)+j*j/(ry*ry)<=1)dot(x+i,y+j,col);};
 const line=(x,y,xx,yy,col,width=1)=>{let n=Math.ceil(Math.max(Math.abs(x-xx),Math.abs(y-yy)));for(let t=0;t<=n;t++)rect(Math.round(x+(xx-x)*t/(n||1)),Math.round(y+(yy-y)*t/(n||1)),width,width,col);};
 const poly=(pts,col)=>{for(let y=Math.max(1,Math.floor(Math.min(...pts.map(p=>p[1]))));y<=Math.min(62,Math.ceil(Math.max(...pts.map(p=>p[1]))));y++)for(let x=1;x<47;x++){let yes=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){let p=pts[i],q=pts[j];if((p[1]>y+.5)!=(q[1]>y+.5)&&(x+.5<(q[0]-p[0])*(y+.5-p[1])/(q[1]-p[1])+p[0]))yes=!yes;}if(yes)dot(x,y,col);}};
 const leaf=(x,y,dx,dy,n=1)=>{poly([[x,y],[x+dx*.35-dy*.22*n,y+dy*.35+dx*.22*n],[x+dx,y+dy],[x+dx*.6+dy*.2*n,y+dy*.6-dx*.2*n]],G);line(x,y,x+dx*.85,y+dy*.85,L);};
 const clump=(x,y,rx,ry)=>{ell(x,y,rx,ry,D);ell(x-1,y-2,Math.max(1,rx-1),Math.max(1,ry-1),G);ell(x-rx*.25,y-ry*.4,Math.max(1,rx*.55),Math.max(1,ry*.4),L);};
 const flower=(x,y,col='#f4e7bc')=>{rect(x-2,y-1,5,3,col);rect(x-1,y-2,3,5,col);dot(x,y,'#dba448');};
 const soil=()=>{ell(24,59,10,2,'#9e7446');line(17,59,21,59,'#c79c5a');line(27,60,31,60,'#795738');};
 const fruit=(x,y,type,ripe=true)=>{const palette={tomato:['#a54235','#e26440','#ffb06a'],eggplant:['#493650','#795376','#ae7fa0'],strawberry:['#af3640','#e95a54','#ffbc82'],pumpkin:['#a86227','#df9134','#f5c45e'],grape:['#51456f','#8066a9','#bba2db'],pineapple:['#aa7d32','#d7ad4e','#f2d887'],watermelon:['#245d45','#55934e','#a2bf68'],mango:['#c37c37','#edb44e','#f9dc88'],peach:['#bb6557','#eea27b','#ffd1a0'],kiwi:['#705640','#aa8554','#d0b17b'],coconut:['#548a41','#8eb24c','#c8d473'],avocado:['#2e5741','#5d8545','#a5b76b'],blueberry:['#344b77','#607eae','#a4c1d3'],cacao:['#a54e2c','#d88735','#f3bb58']}[type]||['#a47b35','#e5ba4f','#ffe29a'];
 const p=ripe?palette:['#365f3e','#6b9c48','#aac76a'];
 if(type==='grape'||type==='blueberry'){for(const [dx,dy] of [[-2,0],[2,0],[0,3],[-2,3],[2,3],[0,6]]){ell(x+dx,y+dy,2,2,p[0]);rect(x+dx-1,y+dy-1,2,2,p[1]);dot(x+dx-1,y+dy-1,p[2]);}return;}
 let rx=3,ry=4;if(['pumpkin','watermelon'].includes(type)){rx=9;ry=6;}if(['eggplant','cacao'].includes(type)){rx=3;ry=6;}if(type==='pineapple'){rx=6;ry=8;}if(type==='avocado'){rx=3;ry=5;}
 ell(x,y,rx,ry,p[0]);ell(x-1,y-1,Math.max(1,rx-1),Math.max(1,ry-1),p[1]);line(x-1,y-ry+2,x-2,y-1,p[2]);
 if(['pumpkin','watermelon','cacao'].includes(type))for(let dx=-rx+3;dx<rx;dx+=4)line(x+dx,y-ry+2,x+dx+1,y+ry-2,p[0]);
 if(type==='strawberry'){dot(x+1,y,p[2]);dot(x-1,y+2,p[2]);}
 if(type==='pineapple'){for(let yy=-5;yy<7;yy+=3)for(let xx=-3;xx<=3;xx+=3)dot(x+xx+(yy%2),y+yy,p[0]);leaf(x,y-7,-5,-7);leaf(x,y-7,0,-9);leaf(x,y-7,5,-7);}
 if(['tomato','eggplant','strawberry','pumpkin'].includes(type)){line(x-2,y-ry,x+2,y-ry,D);dot(x,y-ry-1,L);}
 };
 const seed=()=>{soil();line(22,57,26,57,'#684b35');dot(23,57,'#dab783');};
 if(stage===0){seed();}
 else if(stage===1&&spec.form==='underground'){soil();rect(10,48,2,11,B);rect(8,45,7,4,BL);line(19,57,28,57,'#b99265');}
 else if(stage===1){soil();line(24,58,24,53,D);leaf(24,54,-6,-4);leaf(24,53,5,-4);}
 else if(stage===7&&spec.harvestMode==='single'){soil();if(['corn','golden_sunflower','golden_tulip'].includes(id)){rect(23,54,2,6,B);leaf(24,57,5,-3);}else{line(20,57,28,57,'#674e38');leaf(20,58,-4,-2);}}
 else{
 const s=stage===7?4:stage,ready=stage===6,fruiting=stage===5||ready,flowering=stage===4,young=s===2,small=s<=3;
 soil();
 if(spec.form==='tree'){
 const top=young?40:s===3?31:15,spread=young?5:s===3?10:id==='cacao'?12:id==='peach'?16:15;
 rect(22,top+5,4,59-top-5,B);rect(22,top+6,1,58-top-6,BL);line(24,Math.min(53,top+18),24-spread*.6,top+7,B,2);line(24,Math.min(53,top+18),24+spread*.6,top+8,B,2);
 clump(24-spread*.6,top+10,spread*.65,spread*.55);clump(24+spread*.6,top+8,spread*.65,spread*.6);clump(24,top+2,spread*.75,spread*.6);clump(24,top+13,spread*.7,spread*.45);
 if(flowering&&stage!==7)for(const [x,y] of [[15,23],[29,18],[33,29]])flower(x,y,id==='peach'?'#efb5b4':'#e9d9a2');
 if(fruiting){const pts=id==='cacao'?[[23,40],[27,48],[19,35]]:[[13,29],[28,22],[35,33]];pts.forEach(([x,y])=>fruit(x,y,id,ready));}
 }else if(spec.form==='palm'){
 const top=young?49:s===3?35:17,lean=young?0:4;for(let y=top;y<60;y++){let xx=24+Math.round(lean*(60-y)/(60-top));rect(xx-2,y,4,1,B);rect(xx-1,y,2,1,BL);if(y%5===0)rect(xx-2,y,4,1,'#d0a263');}
 const len=young?9:s===3?15:20;for(const [dx,dy] of [[-1,.15],[-.8,-.45],[-.4,-.7],[.5,-.6],[1,-.2],[.9,.5],[-.7,.6]]){leaf(24+lean,top,dx*len,dy*len,1.2);}
 if(flowering&&stage!==7)line(27,20,32,27,'#d8c379',2);if(fruiting)[[24,24],[30,25],[33,21]].forEach(([x,y])=>fruit(x,y,id,ready));
 }else if(spec.form==='trellis'){
 if(!young){rect(9,27,2,33,B);rect(36,27,2,33,B);rect(8,29,31,2,BL);rect(10,42,28,1,B);}
 const top=young?49:s===3?39:28;line(24,59,22,top,D,2);for(let y=top;y<56;y+=7){leaf(23,y,-10,-4);leaf(23,y,10,-5);}
 if(!small){line(13,32,33,31,D,2);clump(13,33,6,4);clump(33,33,6,4);}
 if(flowering&&stage!==7)[[15,38],[30,40]].forEach(([x,y])=>flower(x,y));if(fruiting)[[14,41],[31,44]].forEach(([x,y])=>fruit(x,y,id,ready));
 }else if(spec.form==='vine'){
 const len=young?6:s===3?11:18;line(24,58,24-len,55,D,2);line(22,56,24+len,52,D,2);
 for(const [x,y] of [[24-len,54],[24+len-2,51],[22,50]]){leaf(x,y,-5,-5);leaf(x,y,6,-4);}
 if(flowering)[[15,54],[32,52]].forEach(([x,y])=>flower(x,y,'#f5cb62'));
 if(fruiting)fruit(25,53,id,ready);
 }else if(spec.form==='cabbage'){
 const rad=young?4:s===3?7:s===4?10:s===5?12:14;
 for(const dx of [-1,1]){ell(24+dx*rad*.7,55,rad*.65,5,D);ell(24+dx*rad*.6,53,rad*.65,5,G);}
 ell(24,53-rad*.4,rad*.8,rad*.8,G);ell(23,51-rad*.4,rad*.65,rad*.6,L);ell(21,49-rad*.4,rad*.4,rad*.35,H);
 line(24,55,19,47-rad*.2,G);line(25,54,31,48-rad*.2,D);
 }else if(spec.form==='root'){
 const ht=young?6:s===3?12:s===4?15:s===5?17:19;
 if(s>=4){poly([[19,55],[29,55],[27,60],[22,61]],ready?'#e69a3c':'#bd8038');rect(21,55,5,2,ready?'#f8c05b':'#d49b4d');}
 for(const dx of [-8,0,8]){line(24,56,24+dx,56-ht,D);leaf(24+dx*.5,56-ht*.5,-6,-5);leaf(24+dx*.7,56-ht*.7,6,-4);}if(ready)line(18,59,20,58,'#684e32');
 }else if(spec.form==='pineapple'){
 const len=young?7:s===3?12:17;for(const [dx,dy] of [[-1,-.3],[-.8,-.8],[-.4,-1],[.3,-1],[.9,-.7],[1,-.2]])leaf(24,58,dx*len,dy*len,1.3);
 if(flowering)flower(24,40,'#c398c6');if(fruiting)fruit(24,43,id,ready);
 }else if(spec.form==='corn'){
 const top=young?47:s===3?35:17;line(24,59,24,top,D,2);line(24,58,24,top,L);for(let y=top+8;y<56;y+=8){leaf(24,y,-13,-7);leaf(24,y+4,13,-6);}if(s>=4){line(24,top,20,top-5,'#cfb869');line(24,top,27,top-6,'#e4ce83');}
 if(fruiting)for(const [x,y] of [[19,39],[28,45]]){ell(x,y,3,7,D);ell(x,y-1,2,5,ready?'#efc956':'#a7b86b');line(x-1,y-4,x-1,y+2,ready?'#ffe69b':H);leaf(x,y+6,4,-8);}
 }else if(spec.form==='sunflower'||spec.form==='tulip'){
 const top=young?49:s===3?40:spec.form==='sunflower'?22:36;line(24,59,24,top,D,2);leaf(24,53,-11,-10);leaf(25,48,10,-10);
 if(s>=4){if(spec.form==='sunflower'){if(s===4){ell(24,22,5,6,D);ell(23,21,3,4,L);}else{for(let i=0;i<8;i++){const t=i*Math.PI/4;ell(24+Math.round(Math.cos(t)*7),22+Math.round(Math.sin(t)*7),3,4,ready?'#eab541':'#c3a959');}ell(24,22,6,6,'#795532');ell(23,21,4,4,ready?'#bb8238':'#9b7c46');line(20,19,23,18,'#f2d37b');}}
 else{poly([[17,31],[21,34],[24,29],[27,34],[31,31],[29,41],[24,44],[19,40]],s===4?G:ready?'#e6b549':'#b9a85b');if(s>=5)poly([[19,34],[23,37],[24,32],[25,40],[23,42],[20,39]],ready?'#ffe5a0':'#d5c47c');}}
 }else if(spec.form==='underground'){
 // Truffles stay underground. Surface patch and marker indicate bed progress.
 ell(24,57,young?8:s===3?10:s===4?12:s===5?14:15,3,'#866449');ell(23,56,young?7:s===3?9:s===4?11:s===5?13:14,2,'#ac8454');
 rect(10,46,2,12,B);rect(8,43,7,5,BL);dot(11,45,'#d7bd7b');
 if(s>=3){leaf(35,55,4,-5);leaf(35,55,-3,-4);}
 if(s>=5){line(20,55,23,56,'#634f3d');line(23,56,25,54,'#634f3d');}
 if(ready){line(29,57,32,55,'#594638');rect(9,44,5,1,'#efcf6d');}
 }else{
 // Low rosettes and upright fruit shrubs.
 const low=spec.form==='low',top=young?50:s===3?(low?49:40):(low?46:31),rx=young?5:s===3?9:13;
 line(24,59,24,top,D,2);clump(24-rx*.55,top+5,rx*.6,low?4:7);clump(24+rx*.55,top+4,rx*.6,low?4:7);clump(24,top,rx*.6,low?5:8);
 if(id==='tomato'&&!young){rect(28,29,1,30,BL);line(22,44,29,44,'#d6bf82');}
 if(flowering&&stage!==7)[[16,top+4],[29,top-1],[32,top+9]].forEach(([x,y])=>flower(x,y,id==='eggplant'?'#bba1d2':id==='tomato'?'#ead071':'#eee4c2'));
 if(fruiting)[[15,top+9],[29,top+3],[33,top+12]].forEach(([x,y])=>fruit(x,y,id,ready));
 }
 }
 // Outline applied once after all clusters are assembled.
 for(let y=0;y<HH;y++)for(let x=0;x<W;x++){let col=a[y][x];if(!col&&[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([u,v])=>a[v]?.[u]))col=O;if(col){g.fillStyle=col;g.fillRect(x,y,1,1);}}
 cache.set(key,c);return c;
}
function stageForProgress(progress){if(!Number.isFinite(progress))throw new TypeError('progress must be finite');let i=0;while(i<6&&progress>=thresholds[i+1])i++;return i;}
function stageForElapsed(elapsedSeconds,durationSeconds){if(!Number.isFinite(durationSeconds)||durationSeconds<=0)throw new RangeError('positive durationSeconds required');return stageForProgress(elapsedSeconds/durationSeconds);}
function stageForRegrowth(progress){if(!Number.isFinite(progress))throw new TypeError("progress must be finite");return progress<=0?7:progress<.4?4:progress<1?5:6;}
return {catalog,stages,thresholds,get,stageForProgress,stageForElapsed,stageForRegrowth,setCanvasFactory(fn){factory=fn;cache.clear();}};
})();
if(typeof module!=='undefined')module.exports=PixelCrops;
