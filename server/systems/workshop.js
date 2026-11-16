'use strict';
// โต๊ะแปรรูป WP-30 S2: หลอมแร่ (forge) + อัดฟาง (bale)
// ย้ายเข้า class World ผ่าน mix() ใน server.js (เหมือน crafting.js)
const S = require('../../public/shared.js');
const { send, logEv } = require('../util.js');

// ป้ายกริยาต่อสถานี (ไม่ใช้ if id===... แค่ lookup ตาม st key)
const ST_VERB = { forge: 'หลอม', bale: 'อัดฟาง' };

module.exports = {
  make(p, id, n) {
    // 1. ตรวจ id: ต้องเป็น string และมีในตาราง recipes ป้องกัน __proto__ / numeric input
    if (typeof id !== 'string' || !Object.hasOwn(S.WORKSHOP.recipes, id)) return;

    // 2. ตรวจจำนวน: ต้องเป็นจำนวนเต็ม 1..maxN
    const nInt = Number.isFinite(n) ? Math.trunc(n) : 0;
    if (nInt < 1 || nInt > S.WORKSHOP.maxN) {
      return this.toast(p, `จำนวนต้องเป็น 1–${S.WORKSHOP.maxN}`);
    }

    // 3. ข้อมูลสูตรและสถานี
    const r = S.WORKSHOP.recipes[id];
    const stCfg = S.WORKSHOP.st[r.st];

    // 4. ต้องอยู่ใกล้ร้านที่ถูกต้อง
    if (this.nearShopKind(p) !== stCfg.shop) {
      const shopName = (S.SHOPS[stCfg.shop] && S.SHOPS[stCfg.shop].name) || stCfg.shop;
      return this.toast(p, `ต้องยืนใกล้ประตู${shopName}ถึงจะ${ST_VERB[r.st] || 'แปรรูป'}ได้`);
    }

    // 5. ตรวจเลเวล
    if (this.lv(p, r.skill) < r.lv) {
      const sk = S.SKILLS[r.skill];
      return this.toast(p, `ต้องเป็น${sk.name}เลเวล ${r.lv} ก่อน (ตอนนี้ ${this.lv(p, r.skill)})`);
    }

    // 6. ตรวจคูลดาวน์
    p.mkReady = p.mkReady || {};
    const now = Date.now();
    const ready = p.mkReady[r.st] || 0;
    if (now < ready) {
      send(p, { t: 'mkcd', st: r.st, ms: ready - now });
      return this.toast(p, `รออีก ${Math.ceil((ready - now) / 1000)} วินาที (${ST_VERB[r.st] || 'แปรรูป'}ไม่ทัน)`);
    }

    // 7. ตรวจวัตถุดิบและเหรียญผ่าน makeCheck
    const inv = p.rec.inv;
    const checkErr = S.makeCheck(r, inv, nInt);
    if (checkErr) return this.toast(p, checkErr);

    // ตรวจ once: output ที่ซื้อได้ครั้งเดียว — ถ้ามีแล้วห้ามทำ (รองรับอนาคตที่ผลิตเครื่องมือ once)
    for (const k of Object.keys(r.out)) {
      const info = S.itemInfo(k);
      if (info && info.once && (inv[k] || 0) > 0) {
        return this.toast(p, `คุณมี ${info.emoji} ${info.name} อยู่แล้ว`);
      }
    }

    // 8. หักวัตถุดิบ (เก็บ lots ที่ถูกเอาออกสำหรับคำนวณตัวคูณความสด)
    const allMuls = []; // รวมตัวคูณความสดทุกชิ้นจากทุก input
    for (const [k, qty] of Object.entries(r.in)) {
      const need = qty * nInt;
      const taken = this.add(p, k, -need); // คืน lots ที่ถูกเอา (เฉพาะของเน่าได้)
      if (r.fresh && S.perishable(k) && taken && taken.length) {
        const muls = S.freshMuls(taken, need, now, this.hasFridge(p.key));
        for (const m of muls) allMuls.push(m);
      }
    }

    // 9. ตัวคูณความสดเฉลี่ย (เฉพาะสูตรที่มี fresh flag; ถ้าไม่มีข้อมูล lot = ของสด)
    const avgMul = r.fresh
      ? (allMuls.length > 0 ? allMuls.reduce((a, b) => a + b, 0) / allMuls.length : 1)
      : 1;

    // 10. หักค่าเตา (เข้ากองกลาง)
    const feeTotal = r.fee * nInt;
    if (feeTotal > 0) {
      this.add(p, 'coin', -feeTotal, 'makefee');
      this.toPot(feeTotal);
    }

    // 11. มอบของที่ผลิตได้
    let anyZero = false;
    for (const [k, q] of Object.entries(r.out)) {
      const baseOut = q * nInt;
      const amt = r.fresh ? Math.floor(baseOut * avgMul) : baseOut;
      if (amt > 0) {
        this.add(p, k, amt);
        // รีเซ็ตความทน/ซ่อมสำหรับเครื่องมือใน DURABILITY (รองรับอนาคต เช่น forge → pick_*)
        const tl = k.split('_')[0];
        if (Object.hasOwn(S.DURABILITY, tl)) {
          if (p.rec.dur) delete p.rec.dur[tl];
          if (p.rec.fix) delete p.rec.fix[tl];
          send(p, { t: 'dur', d: this.durPub(p) });
        }
      } else if (baseOut >= 1) {
        anyZero = true; // ผลผลิต 0 จากตัวคูณความสด
      }
    }

    // แจ้งเตือนถ้าความสดต่ำจนได้ 0
    if (anyZero) {
      this.toast(p, `🍂 ผักเก่าเกินไป ได้ผลผลิต 0 ชิ้น — เอาผักสดๆ มา${ST_VERB[r.st] || 'แปรรูป'}ดีกว่านะ`);
    }

    // 12. ตั้งคูลดาวน์ส่งให้ client
    p.mkReady[r.st] = now + r.ms;
    send(p, { t: 'mkcd', st: r.st, ms: r.ms });

    // 13. XP (ตอนนี้ 0 แต่โครงรองรับแล้ว)
    if (r.xp > 0) this.addXp(p, r.skill, r.xp * nInt);

    // 14. บันทึกเหตุการณ์
    logEv(this.room, 'make', { p: p.key, id, n: nInt, fee: feeTotal });

    // 15. event + toast + sfx
    this.event(p, 'make');

    // สร้างข้อความสรุปผลผลิต
    const verb = ST_VERB[r.st] || 'แปรรูป';
    const outParts = Object.entries(r.out).map(([k, q]) => {
      const info = S.itemInfo(k);
      const baseOut = q * nInt;
      const amt = r.fresh ? Math.floor(baseOut * avgMul) : baseOut;
      return `${info ? info.emoji + ' ' + info.name : k} ×${amt}`;
    });
    let toastMsg = `✅ ${verb}สำเร็จ! ได้ ${outParts.join(', ')}`;
    if (feeTotal > 0) toastMsg += ` • ค่าเตา -🪙${feeTotal}`;
    if (r.fresh && allMuls.length > 0 && avgMul < 0.99) {
      toastMsg += ` (ความสดเฉลี่ย ${Math.round(avgMul * 100)}%)`;
    }
    this.toast(p, toastMsg);
    this.sfx(p, 'collect');
  },
};
