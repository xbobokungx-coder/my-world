// ทดสอบโหลด (WP-08): เปิด ws หลายตัว เดินและแชต วัดความหน่วงข้อความ + CPU/RAM ของเซิร์ฟเวอร์
// ใช้: node tools/loadtest.js --url ws://127.0.0.1:3002/ws --players 20 --minutes 10 [--container mw-load | --pid 1234]
// ห้ามชี้ไปที่ VPS เกมจริงตอนมีคนเล่น • บอททุกตัวใช้ชื่อ lt<N> + PIN 1234 ในห้องหลัก (ห้องอื่นต้องให้ผู้ดูแลสร้างก่อน ใส่ --rooms main,r2 ได้)
// ใช้ DATA_DIR ชั่วคราวเสมอ (บอทสร้างบัญชี lt<N> จริงในเซฟ) • ยิงนอกเครื่อง/วงแลนต้องใส่ --allow-remote และห้ามชี้ VPS เกมจริงตอนมีคนเล่น
// ความหน่วง = เวลาตั้งแต่ส่งแชตจนได้รับแชตของตัวเองคืน (broadcast ไปกลับ) • เดิน 10 ครั้ง/วินาทีต่อบอท • แชตตัวละ ~1 ครั้ง/10 วินาที
const { execFileSync } = require('child_process');
const WebSocket = require('ws');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : d; };
const num = (k, d, lo, hi) => { const v = +arg(k, d); if (!Number.isFinite(v) || v < lo || v > hi) { console.error(`--${k} ต้องเป็นตัวเลข ${lo}-${hi}`); process.exit(2); } return v; };
const URL = arg('url', 'ws://127.0.0.1:3002/ws'), N = num('players', 10, 1, 200), MIN = num('minutes', 10, 0.1, 120), CONT = arg('container', ''), PID = arg('pid', '');
const ROOMS = arg('rooms', '').split(',').filter(Boolean), P95_LIMIT = num('p95', 200, 1, 60000);
if (!/^[\w.-]*$/.test(CONT) || !/^\d*$/.test(PID)) { console.error('--container ใช้ได้เฉพาะ a-z 0-9 _ . - และ --pid เป็นตัวเลขล้วน'); process.exit(2); }
{ let host = ''; try { host = new (require('url').URL)(URL).hostname; } catch (e) { console.error('--url ไม่ถูกต้อง'); process.exit(2); }
  if (!/^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(host) && !process.argv.includes('--allow-remote')) { console.error('ไม่ยิงนอกเครื่อง/วงแลนโดยไม่ใส่ --allow-remote (กันเผลอยิงใส่ VPS เกมจริง)'); process.exit(2); } }
const lat = [], samples = [], names = new Set(), stats = { joined: 0, failed: 0, closed: 0, errs: 0, chats: 0, lost: 0, tp: 0 };
const pct = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const stopAt = Date.now() + MIN * 60000;

function bot(i) {
  const name = 'lt' + i, room = ROOMS.length ? ROOMS[i % ROOMS.length] : undefined;
  let ws, id = 0, x = 0, y = 0, dir = 0, sentAt = 0, timers = [];
  const clear = () => timers.forEach(clearInterval);
  const connect = () => {
    ws = new WebSocket(URL);
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name, color: '#3498db', pin: '1234', room })));
    ws.on('message', d => {
      let m; try { m = JSON.parse(d); } catch (e) { return; }
      if (m.t === 'w') { id = m.id; x = m.x; y = m.y; stats.joined++; names.add(name); sentAt = 0; start(); }
      else if (m.t === 'tp') { x = m.x; y = m.y; stats.tp++; }
      else if (m.t === 'err') stats.errs++;
      else if (m.t === 'chat' && m.id === id && sentAt) { lat.push(Date.now() - sentAt); sentAt = 0; stats.chats++; }
    });
    ws.on('close', () => { if (id) stats.closed++; id = 0; sentAt = 0; clear(); if (Date.now() < stopAt) setTimeout(connect, 2000 + Math.random() * 2000); });
    ws.on('error', () => { stats.failed++; });
  };
  const start = () => {
    clear(); timers = [];
    timers.push(setInterval(() => { // เดินสุ่ม ก้าวละไม่เกิน 6px (เซิร์ฟเวอร์ยอม ≤ 60) ถูกชนก็ได้ tp กลับ
      if (ws.readyState !== 1) return;
      if (Math.random() < 0.1) dir = Math.floor(Math.random() * 4);
      x += [0, 0, -6, 6][dir] || 0; y += [6, -6, 0, 0][dir] || 0;
      ws.send(JSON.stringify({ t: 'm', x, y, d: dir }));
    }, 100));
    timers.push(setInterval(() => { if (sentAt && Date.now() - sentAt > 5000) { stats.lost++; sentAt = 0; } // แชตหายเกิน 5 วิ นับเป็นแชตหาย (ขึ้นในรายงาน)
      if (ws.readyState === 1 && !sentAt) { sentAt = Date.now(); ws.send(JSON.stringify({ t: 'chat', text: 'โหลดเทสต์ ' + Math.floor(Math.random() * 1000) })); } }, 8000 + Math.random() * 4000));
  };
  setTimeout(connect, i * 300); // ทยอยเข้า ไม่รุมพร้อมกัน
}

// ตัวอย่างทรัพยากรเซิร์ฟเวอร์ทุก 5 วินาที: Docker (--container) หรือโปรเซส (--pid)
function sample() {
  try {
    if (CONT) { const o = execFileSync('docker', ['stats', '--no-stream', '--format', '{{.CPUPerc}}|{{.MemUsage}}', CONT], { encoding: 'utf8' }).trim().split('|'); const mem = o[1].split('/')[0].trim(), v = parseFloat(mem); const mb = /GiB/.test(mem) ? v * 1024 : /KiB|kB/.test(mem) ? v / 1024 : v; samples.push({ cpu: parseFloat(o[0]), mb }); }
    else if (PID) { const o = execFileSync('ps', ['-o', '%cpu=,rss=', '-p', PID], { encoding: 'utf8' }).trim().split(/\s+/); samples.push({ cpu: parseFloat(o[0]), mb: parseInt(o[1], 10) / 1024 }); }
  } catch (e) { /* วัดไม่ได้ก็ข้าม */ }
}

(async () => {
  console.log(`loadtest: ${N} บอท • ${MIN} นาที • ${URL}${CONT ? ' • container ' + CONT : PID ? ' • pid ' + PID : ' • ไม่วัดทรัพยากร (ใส่ --container หรือ --pid)'}`);
  for (let i = 1; i <= N; i++) bot(i);
  const t0 = Date.now();
  let nextPrint = t0 + 60000;
  while (Date.now() < stopAt) { await sleep(5000); sample(); if (Date.now() >= nextPrint) { nextPrint += 60000; console.log(`  ${Math.round((Date.now() - t0) / 60000)} นาที: เข้าเกม ${names.size} หลุด ${stats.closed} แชต ${stats.chats} p95 ${pct(lat, 0.95)} ms`); } }
  const peak = a => a.length ? Math.max(...a) : 0, avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const rep = { players: N, minutes: MIN, botsJoined: names.size, joinMsgs: stats.joined, dropsAfterJoin: stats.closed, connectFails: stats.failed, errs: stats.errs, chatsLost: stats.lost, tpResets: stats.tp, chats: stats.chats, latencyMs: { p50: pct(lat, 0.5), p95: pct(lat, 0.95), max: lat.length ? Math.max(...lat) : 0 }, cpuPct: { avg: +avg(samples.map(s => s.cpu)).toFixed(1), peak: peak(samples.map(s => s.cpu)) }, memMB: { peak: Math.round(peak(samples.map(s => s.mb))), last: samples.length ? Math.round(samples[samples.length - 1].mb) : 0 } };
  const ok = names.size === N && rep.latencyMs.p95 <= P95_LIMIT && rep.chats >= N * 3 && stats.lost === 0 && stats.errs === 0;
  console.log(JSON.stringify(rep, null, 1)); console.log(ok ? `✓ ผ่าน (p95 ≤ ${P95_LIMIT} ms)` : `✗ ไม่ผ่าน (เข้าเกมครบ=${names.size === N} p95=${rep.latencyMs.p95} แชต=${rep.chats} หาย=${stats.lost} err=${stats.errs})`);
  process.exit(ok ? 0 : 1);
})();
