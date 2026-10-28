// แก้แมพสำหรับผู้ดูแล: ขยับ/เพิ่ม/ลบ Mock วางแผน + วาดพื้นห้อง (server-authoritative)
(function (root) {
  const { W, H, T, MAP_PAINT, MOCK_MAX, sanitizeMocks } = Shared;
  const CELL = 14; // พิกเซลต่อช่องในแคนวาสแก้แมพ
  let mocks = [], sel = null, mode = 'move', brush = T.PATH, drag = null, dirty = false;
  let sendFn = () => {}, toastFn = () => {}, onClose = () => {}, getMap = () => null;
  let paintQ = [], paintTimer = null;

  const $ = id => document.getElementById(id);
  const shown = () => $("mapEdit") && !$("mapEdit").classList.contains("hidden");

  function setMocks(list) { mocks = sanitizeMocks(list); dirty = false; if (shown()) draw(); }
  function getMocks() { return mocks.slice(); }

  function open(opts) {
    sendFn = opts.send; toastFn = opts.toast; onClose = opts.onClose || (() => {}); getMap = opts.getMap;
    if (Array.isArray(opts.mocks)) mocks = sanitizeMocks(opts.mocks);
    mode = "move"; sel = null; dirty = false;
    $("mapEdit").classList.remove("hidden");
    renderToolbar();
    draw();
  }
  function close() {
    if (dirty && !confirm("มี Mock ที่ยังไม่บันทึก ปิดเลยไหม?")) return;
    $("mapEdit").classList.add("hidden");
    onClose();
  }

  function renderToolbar() {
    const paint = MAP_PAINT.map(p =>
      `<button type="button" class="chip${mode === "paint" && brush === p.t ? " sel" : ""}" data-brush="${p.t}" style="border-color:${p.col}">${p.name}</button>`
    ).join("");
    $("mapEditBar").innerHTML =
      `<div class="chips" style="margin:0">`
      + `<button type="button" class="chip${mode === "move" ? " sel" : ""}" data-mode="move">✋ ขยับ</button>`
      + `<button type="button" class="chip${mode === "add" ? " sel" : ""}" data-mode="add">➕ เพิ่ม Mock</button>`
      + `<button type="button" class="chip${mode === "paint" ? " sel" : ""}" data-mode="paint">🖌️ วาดพื้น</button>`
      + `<button type="button" class="chip" data-act="del">🗑️ ลบที่เลือก</button>`
      + `<button type="button" class="chip" data-act="save">💾 บันทึก Mock</button>`
      + `<button type="button" class="chip" data-act="ovclear">↩️ ล้างพื้นที่วาด</button>`
      + `</div>`
      + `<div class="chips" style="margin:6px 0 0">${paint}</div>`
      + `<p style="font-size:12px;opacity:.75;margin:6px 0 0">Mock = กล่องวางแผน (เห็นเฉพาะผู้ดูแล) • วาดพื้น = เปลี่ยนแมพจริงให้ทุกคนในห้อง • ${mocks.length}/${MOCK_MAX} Mock</p>`;
    $("mapEditBar").querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { mode = b.dataset.mode; renderToolbar(); });
    $("mapEditBar").querySelectorAll("[data-brush]").forEach(b => b.onclick = () => { mode = "paint"; brush = +b.dataset.brush; renderToolbar(); });
    $("mapEditBar").querySelectorAll("[data-act]").forEach(b => b.onclick = () => act(b.dataset.act));
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
    sendFn({ t: "admin", a: "mappaint", cells });
    draw();
  }
  function queuePaint(x, y) {
    paintQ.push([x, y, brush]);
    if (!paintTimer) paintTimer = setTimeout(flushPaint, 40);
  }

  function act(a) {
    if (a === "del") {
      if (!sel) return toastFn("เลือก Mock ก่อน");
      mocks = mocks.filter(m => m.id !== sel); sel = null; dirty = true; draw(); return;
    }
    if (a === "save") {
      sendFn({ t: "admin", a: "mocks", mocks }); dirty = false; toastFn("กำลังบันทึก Mock…"); return;
    }
    if (a === "ovclear") {
      if (!confirm("ล้างทุกช่องที่วาดทับ คืนพื้นแมพเดิมของห้องนี้?\n(Mock ไม่ถูกลบ)")) return;
      sendFn({ t: "admin", a: "mapovclear" });
    }
  }

  function tileAt(ev) {
    const c = $("mapEditCv"), r = c.getBoundingClientRect();
    const x = Math.floor((ev.clientX - r.left) / (r.width / W));
    const y = Math.floor((ev.clientY - r.top) / (r.height / H));
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
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
    const c = $("mapEditCv"), g = c.getContext("2d");
    c.width = W * CELL; c.height = H * CELL;
    g.imageSmoothingEnabled = false;
    const MAP = getMap();
    const col = { [T.GRASS]: "#7bc65a", [T.WATER]: "#4ab8cc", [T.TREE]: "#3f9a3a", [T.BUILD]: "#a0692f", [T.PATH]: "#dcbf82", [T.FENCE]: "#8b5a2b", [T.SAND]: "#efdfa4", [T.SHOP]: "#c9894a", [T.BRIDGE]: "#b8956a", [T.LANDMARK]: "#9b7bb8" };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      g.fillStyle = (MAP && MAP[y] && col[MAP[y][x]]) || "#7bc65a";
      g.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
    // กริดจางๆ
    g.strokeStyle = "rgba(0,0,0,.08)"; g.lineWidth = 1;
    for (let x = 0; x <= W; x++) { g.beginPath(); g.moveTo(x * CELL, 0); g.lineTo(x * CELL, H * CELL); g.stroke(); }
    for (let y = 0; y <= H; y++) { g.beginPath(); g.moveTo(0, y * CELL); g.lineTo(W * CELL, y * CELL); g.stroke(); }
    for (const m of mocks) {
      g.fillStyle = m.color + "99";
      g.strokeStyle = m.id === sel ? "#fff" : "#a06a00";
      g.lineWidth = m.id === sel ? 3 : 2;
      g.fillRect(m.x * CELL, m.y * CELL, m.w * CELL, m.h * CELL);
      g.strokeRect(m.x * CELL + 1, m.y * CELL + 1, m.w * CELL - 2, m.h * CELL - 2);
      g.fillStyle = "#111"; g.font = "bold 10px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(m.label, (m.x + m.w / 2) * CELL, (m.y + m.h / 2) * CELL);
    }
    $("mapEditMeta").textContent = dirty ? "• ยังไม่บันทึก Mock" : (sel ? "เลือก: " + (mocks.find(m => m.id === sel) || {}).label : "พร้อมแก้");
  }

  function onDown(ev) {
    if (!shown()) return;
    const t = tileAt(ev); if (!t) return;
    ev.preventDefault();
    if (mode === "paint") {
      drag = { paint: true };
      queuePaint(t.x, t.y);
      return;
    }
    if (mode === "add") {
      if (mocks.length >= MOCK_MAX) return toastFn("Mock เต็มแล้ว");
      const id = "m" + Date.now().toString(36);
      const label = prompt("ชื่อ Mock", "จุดใหม่") || "จุดใหม่";
      mocks.push({ id, x: t.x, y: t.y, w: 3, h: 2, label: String(label).slice(0, 24), color: "#ffd24a" });
      sel = id; dirty = true; mode = "move"; renderToolbar(); draw(); return;
    }
    const m = hitMock(t.x, t.y);
    if (m) { sel = m.id; drag = { id: m.id, ox: t.x - m.x, oy: t.y - m.y }; draw(); }
    else { sel = null; draw(); }
  }
  function onMove(ev) {
    if (!drag || !shown()) return;
    const t = tileAt(ev); if (!t) return;
    if (drag.paint) {
      queuePaint(t.x, t.y);
      return;
    }
    const m = mocks.find(x => x.id === drag.id); if (!m) return;
    m.x = Math.max(0, Math.min(W - m.w, t.x - drag.ox));
    m.y = Math.max(0, Math.min(H - m.h, t.y - drag.oy));
    dirty = true; draw();
  }
  function onUp() { drag = null; }

  function bind() {
    const c = $("mapEditCv");
    c.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    $("mapEditClose").onclick = close;
    $("mapEdit").addEventListener("pointerdown", e => { if (e.target === $("mapEdit")) close(); });
    // ย่อ/ขยาย mock ด้วยปุ่ม
    window.addEventListener("keydown", e => {
      if (!shown() || !sel) return;
      const m = mocks.find(x => x.id === sel); if (!m) return;
      if (e.key === "Delete" || e.key === "Backspace") { act("del"); e.preventDefault(); }
      if (e.key === "]" ) { m.w = Math.min(16, m.w + 1); if (m.x + m.w > W) m.x = W - m.w; dirty = true; draw(); }
      if (e.key === "[" ) { m.w = Math.max(1, m.w - 1); dirty = true; draw(); }
      if (e.key === "'") { m.h = Math.min(16, m.h + 1); if (m.y + m.h > H) m.y = H - m.h; dirty = true; draw(); }
      if (e.key === ";") { m.h = Math.max(1, m.h - 1); dirty = true; draw(); }
    });
  }

  root.MapEdit = { open, close, shown, setMocks, getMocks, draw, bind };
})(this);
