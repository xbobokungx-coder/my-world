'use strict';
// ชั้นแก้แมพ ต้นไม้: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { T } = S;

module.exports = {
  // ชั้นแก้แมพของผู้ดูแล: mapOv ทับช่องหลัง makeMap/ต้นไม้/โครงการ • mocks เป็นกล่องวางแผน (ไม่ชน ไม่มีผลกติกา)
  applyMapOv() {
    if (!this.mapOv) this.mapOv = {};
    for (const [k, t] of Object.entries(this.mapOv)) {
      const [x, y] = k.split(',').map(Number);
      if (!this.map[y] || x < 1 || y < 1 || x > S.W - 2 || y > S.H - 2) continue; // ขอบแมพต้นไม้คงที่
      const prev = this.map[y][x]; this.map[y][x] = t;
      if (this.treeKind) {
        if (t === T.TREE && prev !== T.TREE) this.treeKind.set(x + ',' + y, S.pickTreeKind(this.map, x, y, S.rng(x * 7919 + y * 104729)));
        else if (t !== T.TREE) this.treeKind.delete(x + ',' + y);
      }
    }
  },
  paintCells(cells) { // [[x,y,t],...] วาดพื้นแมพสด เก็บใน mapOv
    if (!Array.isArray(cells) || !cells.length || cells.length > 500) return null;
    if (!this.mapOv) this.mapOv = {};
    const out = [], ok = new Set(S.MAP_PAINT.map(p => p.t));
    for (const c of cells) {
      if (!Array.isArray(c) || c.length < 3) continue;
      const x = Math.trunc(+c[0]), y = Math.trunc(+c[1]), t = Math.trunc(+c[2]);
      if (!Number.isInteger(x) || !Number.isInteger(y) || !ok.has(t)) continue;
      if (x < 1 || y < 1 || x > S.W - 2 || y > S.H - 2) continue;
      this.map[y][x] = t; this.mapOv[x + ',' + y] = t;
      if (t === T.TREE) { if (!this.treeKind.has(x + ',' + y)) this.treeKind.set(x + ',' + y, S.pickTreeKind(this.map, x, y, Math.random)); }
      else { this.treeKind.delete(x + ',' + y); if (this.treeHp) this.treeHp.delete(x + ',' + y); }
      out.push([x, y, t]);
    }
    if (!out.length) return null;
    this.dirty = true;
    this.broadcast({ t: 'mapcell', cells: out });
    return out;
  },
  treeList() { const out = []; for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (S.isChoppable(this.map, x, y)) out.push([x, y, (this.treeKind && this.treeKind.get(x + ',' + y)) || 'broad']); return out; },
};
