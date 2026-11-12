// แก้แมพสำหรับผู้ดูแล: ขยับ/เพิ่ม/ลบ Mock วางแผน + วาดพื้นห้อง (server-authoritative)
(function (root) {
  const { W, H, T, MAP_PAINT, MOCK_MAX, sanitizeMocks, BUILDINGS, FIRE, ATM, BOARD, RANKBOARD, LUCKY, CABINETS, HOUSE_BLD, FARM, PENS } = Shared;
  let mocks = [], sel = null, mode = 'move', brush = T.WATER, drag = null, dirty = false, cell = 14;
  let sendFn = () => {}, toastFn = () => {}, onClose = () => {}, getMap = () => null;
  let paintQ = [], paintTimer = null, ignoreServerMocksUntil = 0;

  const $ = id => document.getElementById(id);
  const shown = () => $("mapEdit") && !$("mapEdit").classList.contains("hidden");

  function seedMocks() {
    const out = [];
    const add = (id, x, y, w, h, label, color) => out.push({ id, x, y, w, h, label, color: color || '#ffd24a' });
    for (const b of BUILDINGS) {
      if (b.kind === 'sign') add('b_' + b.kind, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, b.name || 'Arcade', '#c9a0ff');
      else add('b_' + b.kind, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, b.name || b.kind, '#ffd24a');
    }
    add('house', HOUSE_BLD.x0, HOUSE_BLD.y0, HOUSE_BLD.x1 - HOUSE_BLD.x0 + 1, HOUSE_BLD.y1 - HOUSE_BLD.y0 + 1, 'บ้านใหญ่', '#ffe08a');
    add('plazatree', FIRE.x, FIRE.y, 1, 1, 'ต้นไม้ลาน', '#6fcf6f'); // ตายตัว ไม่อยู่ใน MOVABLE
    add('atm', ATM.x, ATM.y, 1, 1, 'ATM', '#7dffb0');
    add('board', BOARD.x, BOARD.y, 1, 1, 'ข่าว', '#ffffff');
    add('rank', RANKBOARD.x, RANKBOARD.y, 1, 1, 'อันดับ', '#ffd24a');
    add('lotto', LUCKY.x, LUCKY.y, 1, 1, 'Lucky Lotto', '#f1c40f');
    add('farm', FARM.x0, FARM.y0, FARM.x1 - FARM.x0 + 1, FARM.y1 - FARM.y0 + 1, 'แปลงผัก', '#b8f090');
    for (const [k, P] of Object.entries(PENS || {})) add('pen_' + k, P.x0, P.y0, P.x1 - P.x0 + 1, P.y1 - P.y0 + 1, 'คอก ' + k, '#e8b88a');
    CABINETS.forEach((c, i) => add('cab' + i, c.x, c.y, 1, 1, c.label || c.name || 'ตู้', '#b39ddb'));
    return sanitizeMocks(out);
  }

  const MOVABLE = /^(b_[a-z]+|cab[0-9]|atm|board|lotto)$/;
  // กล่องที่ลากไปตำแหน่งต่างจากร้าน/ตู้ในเกมจริง (บันทึก Mock อย่างเดียวยังไม่ย้ายของจริง ต้องกด 🚀)
  function pending() { const live = new Map(seedMocks().map(m => [m.id, m])); return mocks.filter(m => MOVABLE.test(m.id) && live.has(m.id) && (live.get(m.id).x !== m.x || live.get(m.id).y !== m.y)).map(m => ({ m, o: live.get(m.id) })); }

  function setMocks(list, opts) {
    if (opts && opts.fromServer && (dirty || Date.now() < ignoreServerMocksUntil)) return;
    mocks = sanitizeMocks(list);
    if (!(opts && opts.keepDirty)) dirty = false;
    if (shown()) { renderToolbar(); draw(); }
  }
  function getMocks() { return mocks.slice(); }

  function open(opts) {
    sendFn = opts.send; toastFn = opts.toast; onClose = opts.onClose || (() => {}); getMap = opts.getMap;
    const incoming = Array.isArray(opts.mocks) ? sanitizeMocks(opts.mocks) : [];
    mocks = incoming.length ? incoming : seedMocks();
    dirty = !incoming.length;
    mode = "move"; brush = T.WATER; sel = null; ignoreServerMocksUntil = Date.now() + 800;
    $("mapEdit").classList.remove("hidden");
    renderToolbar();
    requestAnimationFrame(() => { draw(); toastFn("✋ ลากกล่องเหลืองเพื่อขยับ · กด「วาดพื้น」แล้วเลือกสีเพื่อทาสี"); });
  }
  function close() {
    if (dirty && !confirm("มี Mock ที่ยังไม่บันทึก ปิดเลยไหม?")) return;
    $("mapEdit").classList.add("hidden");
    onClose();
  }

  function renderToolbar() {
    const bar = $("mapEditBar"); if (!bar) return;
    const paint = (MAP_PAINT || []).map(p =>
      `<button type="button" class="chip me-brush${brush === p.t && mode === "paint" ? " sel" : ""}" data-brush="${p.t}" title="${p.name}" style="background:${p.col};color:#111;font-weight:700">${p.name}</button>`
    ).join("");
    bar.innerHTML =
      `<div class="chips" style="margin:0">`
      + `<button type="button" class="chip${mode === "move" ? " sel" : ""}" data-mode="move">✋ ขยับ Mock</button>`
      + `<button type="button" class="chip${mode === "paint" ? " sel" : ""}" data-mode="paint">🖌️ วาดพื้น</button>`
      + `<button type="button" class="chip${mode === "add" ? " sel" : ""}" data-mode="add">➕ เพิ่ม Mock</button>`
      + `<button type="button" class="chip" data-act="del">🗑️ ลบที่เลือก</button>`
      + `<button type="button" class="chip" data-act="save">💾 บันทึก Mock</button>`
      + `<button type="button" class="chip" data-act="seed">📦 โหลดจุดสำคัญ</button>`
      + `<button type="button" class="chip" data-act="ovclear">↩️ ล้างพื้นที่วาด</button>`
      + `<button type="button" class="chip" data-act="apply" style="background:#2e9e4f;color:#fff;font-weight:700">🚀 ใช้ผังนี้กับเกม</button>`
      + `<button type="button" class="chip" data-act="undo">⏪ ย้อนผังก่อนหน้า</button>`
      + `<button type="button" class="chip" data-act="lreset">♻️ คืนผังตั้งต้น</button>`
      + `</div>`
      + `<div class="chips" style="margin:6px 0 0">${paint}</div>`
      + `<p style="font-size:13px;opacity:.9;margin:6px 0 0;font-weight:700">ตอนนี้: ${
        mode === "paint" ? "🖌️ วาดพื้น — เลือกสีด้านบน แล้วลากบนแมพ (แนะนำลอง「น้ำ」จะเห็นชัด)"
        : mode === "add" ? "➕ คลิกบนแมพเพื่อวาง Mock ใหม่"
        : "✋ คลิกกล่องแล้วลากเพื่อขยับ · [ ] กว้าง · ; ' สูง · Delete ลบ"
      } · ${mocks.length} Mock${dirty ? " · ยังไม่บันทึก" : ""}</p>`
      + (pending().length ? `<p style="font-size:13px;margin:4px 0 0;font-weight:700;color:#d62828">⚠️ ${pending().length} กล่องยังไม่ตรงกับเกมจริง (กรอบเส้นประแดง = ตำแหน่งในเกมตอนนี้) — ต้องกด 🚀 ใช้ผังนี้กับเกม ร้านถึงจะย้ายจริง การบันทึก Mock อย่างเดียวไม่ย้ายของจริง</p>` : "");
    bar.querySelectorAll("[data-mode]").forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); mode = b.dataset.mode; renderToolbar(); });
    bar.querySelectorAll("[data-brush]").forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); mode = "paint"; brush = +b.dataset.brush; renderToolbar(); });
    bar.querySelectorAll("[data-act]").forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); act(b.dataset.act); });
  }

  function flushPaint() {
    paintTimer = null;
    if (!paintQ.length) return;
    const seen = new Set(), cells = [];
    for (const c of paintQ) { const k = c[0] + "," + c[1]; if (seen.has(k)) continue; seen.add(k); cells.push(c); }
    paintQ = [];
    if (!cells.length) return;
    const MAP = getMap();
    if (MAP) for (const [x, y, t] of cells) if (MAP[y] && x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2) MAP[y][x] = t;
    ignoreServerMocksUntil = Date.now() + 500;
    sendFn({ t: "admin", a: "mappaint", cells });
    draw();
  }
  function queuePaint(x, y) {
    if (x < 1 || y < 1 || x > W - 2 || y > H - 2) return;
    paintQ.push([x, y, brush]);
    const MAP = getMap();
    if (MAP && MAP[y]) MAP[y][x] = brush;
    draw();
    if (!paintTimer) paintTimer = setTimeout(flushPaint, 50);
  }

  function act(a) {
    if (a === "del") {
      if (!sel) return toastFn("เลือก Mock ก่อน (โหมดขยับ แล้วคลิกกล่อง)");
      mocks = mocks.filter(m => m.id !== sel); sel = null; dirty = true; renderToolbar(); draw(); return;
    }
    if (a === "save") {
      ignoreServerMocksUntil = 0;
      sendFn({ t: "admin", a: "mocks", mocks }); dirty = false; toastFn(pending().length ? "บันทึก Mock แล้ว แต่ร้าน/ตู้ในเกมจริงยังไม่ย้าย — กด 🚀 ใช้ผังนี้กับเกม" : "กำลังบันทึก Mock…"); renderToolbar(); return;
    }
    if (a === "seed") {
      mocks = seedMocks(); dirty = true; sel = null; mode = "move"; renderToolbar(); draw(); toastFn("โหลดจุดสำคัญแล้ว — ลากกล่องได้"); return;
    }
    if (a === "apply") {
      const live = seedMocks(), liveById = new Map(live.map(m => [m.id, m])), items = {}, moved = [];
      for (const m of mocks) { if (!/^(b_[a-z]+|cab[0-9]|fire|atm|board|lotto)$/.test(m.id)) continue; items[m.id] = { x: m.x, y: m.y }; const o = liveById.get(m.id); if (o && (o.x !== m.x || o.y !== m.y)) moved.push(m.label || m.id); }
      if (!moved.length) return toastFn("ยังไม่ได้ขยับร้าน/ตู้/ATM/กระดาน (ตำแหน่งตรงกับเกมอยู่แล้ว)");
      if (!confirm("ใช้ผังนี้กับเกมจริง?\n\nจะย้าย: " + moved.join(", ") + "\n\nเกมจะรีสตาร์ท 3–5 วินาที ผู้เล่นทุกคนหลุดชั่วครู่แล้วหน้าเว็บรีเฟรชเอง\n(ขนาดร้านคงเดิม ใช้ตำแหน่งมุมซ้ายบนของกล่อง • ย้อนกลับได้ด้วย ⏪)")) return;
      sendFn({ t: "admin", a: "layoutapply", items }); toastFn("กำลังตรวจผัง…"); return;
    }
    if (a === "undo") { if (confirm("ย้อนกลับไปผังก่อนหน้า? เกมจะรีสตาร์ท")) sendFn({ t: "admin", a: "layoutundo" }); return; }
    if (a === "lreset") { if (confirm("คืนผังตั้งต้นของโค้ด (ทิ้งการย้ายที่ใช้ไว้)? เกมจะรีสตาร์ท")) sendFn({ t: "admin", a: "layoutreset" }); return; }
    if (a === "ovclear") {
      if (!confirm("ล้างทุกช่องที่วาดทับ คืนพื้นแมพเดิมของห้องนี้?\n(Mock ไม่ถูกลบ)")) return;
      sendFn({ t: "admin", a: "mapovclear" });
    }
  }

  function tileAt(ev) {
    const c = $("mapEditCv"); if (!c) return null;
    const r = c.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    const px = (ev.clientX - r.left) / r.width;
    const py = (ev.clientY - r.top) / r.height;
    if (px < 0 || py < 0 || px > 1 || py > 1) return null;
    const x = Math.min(W - 1, Math.max(0, Math.floor(px * W)));
    const y = Math.min(H - 1, Math.max(0, Math.floor(py * H)));
    return { x, y };
  }

  function hitMock(tx, ty) {
    for (let i = mocks.length - 1; i >= 0; i--) {
      const m = mocks[i];
      if (tx >= m.x && tx < m.x + m.w && ty >= m.y && ty < m.y + m.h) return m;
    }
    return null;
  }

  function draw() {
    const c = $("mapEditCv"), stage = $("mapEditStage"); if (!c || !stage) return;
    const sw = Math.max(64, stage.clientWidth), sh = Math.max(64, stage.clientHeight);
    cell = Math.max(6, Math.floor(Math.min(sw / W, sh / H)));
    const bw = W * cell, bh = H * cell;
    if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    const MAP = getMap();
    const col = { [T.GRASS]: "#7bc65a", [T.WATER]: "#4ab8cc", [T.TREE]: "#3f9a3a", [T.BUILD]: "#a0692f", [T.PATH]: "#dcbf82", [T.FENCE]: "#8b5a2b", [T.SAND]: "#efdfa4", [T.SHOP]: "#c9894a", [T.BRIDGE]: "#b8956a", [T.LANDMARK]: "#9b7bb8", [T.CLIFF]: "#8a7a6a", [T.STAIR]: "#c9a56a" };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      g.fillStyle = (MAP && MAP[y] && col[MAP[y][x]] != null) ? col[MAP[y][x]] : "#7bc65a";
      g.fillRect(x * cell, y * cell, cell, cell);
    }
    g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 1;
    for (let x = 0; x <= W; x++) { g.beginPath(); g.moveTo(x * cell + 0.5, 0); g.lineTo(x * cell + 0.5, bh); g.stroke(); }
    for (let y = 0; y <= H; y++) { g.beginPath(); g.moveTo(0, y * cell + 0.5); g.lineTo(bw, y * cell + 0.5); g.stroke(); }
    for (const m of mocks) {
      g.fillStyle = (m.color || "#ffd24a") + "bb";
      g.strokeStyle = m.id === sel ? "#fff" : "#5a3a00";
      g.lineWidth = m.id === sel ? 3 : 2;
      g.fillRect(m.x * cell, m.y * cell, m.w * cell, m.h * cell);
      g.strokeRect(m.x * cell + 1, m.y * cell + 1, m.w * cell - 2, m.h * cell - 2);
      g.fillStyle = "#111"; g.font = `bold ${Math.max(10, Math.floor(cell * 0.7))}px sans-serif`;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(m.label, (m.x + m.w / 2) * cell, (m.y + m.h / 2) * cell);
    }
    for (const { m, o } of pending()) { // ตำแหน่งจริงในเกม (ยังไม่ย้าย) วาดเป็นเส้นประแดง + กรอบแดงที่กล่องที่ลากมา
      g.save(); g.setLineDash([5, 4]); g.strokeStyle = "#d62828"; g.lineWidth = 2;
      g.strokeRect(o.x * cell + 1, o.y * cell + 1, o.w * cell - 2, o.h * cell - 2);
      g.setLineDash([]); g.strokeRect(m.x * cell + 1, m.y * cell + 1, m.w * cell - 2, m.h * cell - 2);
      g.fillStyle = "#d62828"; g.font = `bold ${Math.max(9, Math.floor(cell * 0.55))}px sans-serif`; g.textAlign = "center"; g.textBaseline = "bottom";
      g.fillText("ในเกมตอนนี้", (o.x + o.w / 2) * cell, o.y * cell - 1); g.restore();
    }
    const tip = mode === "paint" ? "ลากเพื่อทาสี" : mode === "add" ? "คลิกเพื่อวาง Mock" : (sel ? "ลากเพื่อขยับ · Delete ลบ" : "คลิกกล่องเหลืองเพื่อเลือก/ลาก");
    if ($("mapEditMeta")) $("mapEditMeta").textContent = tip + (dirty ? " · ยังไม่บันทึก Mock" : "");
  }

  function onDown(ev) {
    if (!shown()) return;
    if (ev.target !== $("mapEditCv")) return;
    const t = tileAt(ev); if (!t) return;
    ev.preventDefault();
    try { $("mapEditCv").setPointerCapture(ev.pointerId); } catch (e) { /* */ }
    if (mode === "paint") { drag = { paint: true }; queuePaint(t.x, t.y); return; }
    if (mode === "add") {
      if (mocks.length >= MOCK_MAX) return toastFn("Mock เต็มแล้ว");
      const id = "m" + Date.now().toString(36);
      let label = "จุดใหม่";
      try { label = window.prompt("ชื่อ Mock", "จุดใหม่") || "จุดใหม่"; } catch (e) { /* */ }
      mocks.push({ id, x: Math.min(t.x, W - 3), y: Math.min(t.y, H - 2), w: 3, h: 2, label: String(label).slice(0, 24), color: "#ffd24a" });
      sel = id; dirty = true; mode = "move"; renderToolbar(); draw(); return;
    }
    const m = hitMock(t.x, t.y);
    if (m) { sel = m.id; drag = { id: m.id, ox: t.x - m.x, oy: t.y - m.y }; draw(); }
    else { sel = null; draw(); }
  }
  function onMove(ev) {
    if (!drag || !shown()) return;
    const t = tileAt(ev); if (!t) return;
    if (drag.paint) { queuePaint(t.x, t.y); return; }
    const m = mocks.find(x => x.id === drag.id); if (!m) return;
    m.x = Math.max(0, Math.min(W - m.w, t.x - drag.ox));
    m.y = Math.max(0, Math.min(H - m.h, t.y - drag.oy));
    dirty = true; draw();
  }
  function onUp(ev) {
    if (drag && drag.paint) flushPaint();
    drag = null;
    try { if (ev && $("mapEditCv").hasPointerCapture(ev.pointerId)) $("mapEditCv").releasePointerCapture(ev.pointerId); } catch (e) { /* */ }
  }

  function bind() {
    const c = $("mapEditCv");
    if (!c || c.dataset.bound) return;
    c.dataset.bound = "1";
    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);
    c.addEventListener("lostpointercapture", () => { drag = null; });
    $("mapEditClose").onclick = close;
    window.addEventListener("keydown", e => {
      if (!shown()) return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "Escape") { close(); e.preventDefault(); return; }
      if (!sel) return;
      const m = mocks.find(x => x.id === sel); if (!m) return;
      if (e.key === "Delete" || e.key === "Backspace") { act("del"); e.preventDefault(); }
      if (e.key === "]") { m.w = Math.min(16, m.w + 1); if (m.x + m.w > W) m.x = W - m.w; dirty = true; draw(); }
      if (e.key === "[") { m.w = Math.max(1, m.w - 1); dirty = true; draw(); }
      if (e.key === "'") { m.h = Math.min(16, m.h + 1); if (m.y + m.h > H) m.y = H - m.h; dirty = true; draw(); }
      if (e.key === ";") { m.h = Math.max(1, m.h - 1); dirty = true; draw(); }
    });
    window.addEventListener("resize", () => { if (shown()) draw(); });
  }

  root.MapEdit = { open, close, shown, setMocks, getMocks, draw, bind };
})(this);
