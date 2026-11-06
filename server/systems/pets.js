'use strict';
// สัตว์เลี้ยงของผู้เล่น: ย้ายมาจาก class World ใน server.js ต่อกลับด้วย mix() (ดู server/mixin.js)
const S = require('../../public/shared.js');
const { HFAST } = require('../consts.js');
const { send } = require('../util.js');

module.exports = {
  petSt(p, id) { const o = p.rec.pst || (p.rec.pst = {}); return o[id] || (o[id] = { h: 100, sick: false }); }, // สถานะสัตว์เลี้ยงแต่ละตัว: h = ความอิ่ม 0-100, sick = ป่วย (เฉพาะตัวที่พาออกมาถึงจะหิว/ป่วย)
  petBonus(p) { return p.pet ? S.petBonus(p.pet, this.petSt(p, p.pet).h, this.petSt(p, p.pet).sick) : { xp: 0, spd: 0, luck: 0, mood: 0 }; }, // โบนัสสัตว์เลี้ยงที่พาออกมาอยู่ (ดู PETSTAT ใน shared.js)
  petLuck(p, label) { // 🍀 ลุ้นได้ผลผลิตเพิ่ม 1 ชิ้น คืน true ถ้าได้ (ผู้เรียกเป็นคนเพิ่มของ)
    const b = this.petBonus(p).luck; if (!(b > 0) || Math.random() >= b) return false;
    const C = S.COMPANIONS[p.pet]; this.toast(p, `🍀 ${C.emoji} ${C.name}นำโชค! ได้${label}เพิ่ม 1`); return true;
  },
  petPubOf(p) { const id = p.pet || ''; return { t: 'pet', id: p.id, pet: id, mode: p.pm || 'follow', ax: Math.round(p.pax || 0), ay: Math.round(p.pay || 0), sick: !!(id && this.petSt(p, id).sick), name: id ? this.petName(p, id) : '' }; },
  petName(p, id) { const n = p.rec.pnames && p.rec.pnames[id]; return typeof n === 'string' ? n : ''; }, // ชื่อที่เจ้าของตั้งให้สัตว์แต่ละตัว (ไม่เกิน 12 ตัวอักษร)
  petRename(p, id, name) {
    if (typeof id !== 'string' || !S.COMPANIONS[id] || !(p.rec.inv['pet_' + id] > 0)) return;
    name = Array.from(String(name || '').replace(/[\u0000-\u001f<>&"]/g, '').replace(/\s+/g, ' ').trim()).slice(0, 12).join('');
    (p.rec.pnames || (p.rec.pnames = {}))[id] = name; this.dirty = true;
    this.toast(p, name ? `ตั้งชื่อ${S.COMPANIONS[id].emoji}เป็น "${name}" แล้ว` : `ล้างชื่อ${S.COMPANIONS[id].emoji}แล้ว`);
    this.petPush(p);
  },
  petPush(p) { const o = this.petPubOf(p); this.broadcast(o, p); send(p, o); send(p, { t: 'pst', pst: p.rec.pst || {}, names: p.rec.pnames || {} }); },
  setPet(p, id, mode) { // id = ชนิดสัตว์เลี้ยงที่พาออกมา ('' = เก็บเข้าบ้าน) ต้องเป็นตัวที่ซื้อไว้แล้ว • mode: follow = เดินตาม, play = ปล่อยวิ่งเล่นรอบจุดที่ยืนอยู่
    id = typeof id === 'string' && S.COMPANIONS[id] && p.rec.inv['pet_' + id] > 0 ? id : '';
    p.rec.pet = p.pet = id; p.rec.pmode = p.pm = mode === 'play' ? 'play' : 'follow';
    p.pax = p.x; p.pay = p.y; this.dirty = true; this.petPush(p);
  },
  petCare(p, a) {
    const id = p.pet; if (!id) return this.toast(p, 'ยังไม่ได้พาสัตว์เลี้ยงออกมา');
    const st = this.petSt(p, id), C = S.COMPANIONS[id];
    if (a === 'feed') {
      if (!(p.rec.inv.petfood > 0)) return this.toast(p, 'ไม่มีอาหารสัตว์เลี้ยง ซื้อได้ที่ร้านสัตว์เลี้ยง');
      if (st.h >= 95) return this.toast(p, `${C.emoji} ${C.name}อิ่มอยู่แล้ว`);
      this.add(p, 'petfood', -1); st.h = Math.min(100, st.h + S.PETCARE.food);
      this.toast(p, `🦴 ให้อาหาร${C.emoji} ${C.name} (อิ่ม ${Math.round(st.h)}/100)`); this.sfx(p, 'eat');
    } else if (a === 'heal') {
      if (!st.sick) return this.toast(p, `${C.emoji} ${C.name}ไม่ได้ป่วย`);
      if (!(p.rec.inv.medicine > 0)) return this.toast(p, 'ไม่มียา 💊 ซื้อได้ที่ร้านสัตว์เลี้ยง');
      this.add(p, 'medicine', -1); st.sick = false; st.sickMs = 0; st.h = Math.max(st.h, 30);
      this.toast(p, `💊 รักษา${C.emoji} ${C.name}หายป่วยแล้ว!`); this.sfx(p, 'heal');
    } else return;
    this.dirty = true; this.petPush(p);
  },
  petTick15(p) { // ทุก 15 วินาที: สัตว์ที่พาออกมาหิวลง หิวจัดมีโอกาสป่วย ป่วยแล้วไม่รักษาเกิน 1 วันในเกมจะตาย
    const id = p.pet; if (!id) return;
    const st = this.petSt(p, id), C = S.COMPANIONS[id], was = st.sick;
    st.h = Math.max(0, st.h - S.PETCARE.hungerTick);
    if (!st.sick && st.h < S.PETCARE.sickBelow && Math.random() < S.PETCARE.sickChance) { st.sick = true; st.sickMs = 0; this.toast(p, `🤒 ${C.emoji} ${C.name}ป่วยแล้ว! รักษาด้วยยา 💊 ในเมนู 🐾 ไม่งั้นจะตายใน 1 วัน`); }
    if (st.sick) {
      st.sickMs = (st.sickMs || 0) + S.PLAYER_HUNGER.tickMs / HFAST;
      if (st.sickMs >= S.PETCARE.sickDieMs) { // ตาย: เอาออกจากกระเป๋า ซื้อใหม่ได้ที่ร้านสัตว์เลี้ยง
        this.add(p, 'pet_' + id, -1, 'petdie'); delete p.rec.pst[id]; if (p.rec.pnames) delete p.rec.pnames[id];
        p.rec.pet = p.pet = ''; this.dirty = true;
        this.toast(p, `💀 ${C.emoji} ${C.name}ตายแล้ว เพราะป่วยนานเกิน 1 วัน ซื้อตัวใหม่ได้ที่ 🐾 ร้านสัตว์เลี้ยง`); this.sfx(p, 'die');
        this.petPush(p); return;
      }
    } else st.sickMs = 0;
    if (st.sick !== was) this.petPush(p); else send(p, { t: 'pst', pst: p.rec.pst, names: p.rec.pnames || {} });
  },
};
