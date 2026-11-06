# pull-backup.ps1 — ดึงไฟล์สำรองข้อมูลผู้เล่นล่าสุดจาก VPS มาเก็บที่เครื่องนี้ (กันกรณี VPS เสีย)
# ใช้: powershell -NoProfile -ExecutionPolicy Bypass -File tools\pull-backup.ps1
# ตั้งเวลาทุกวัน 21:00 (รันครั้งเดียว):
#   schtasks /Create /SC DAILY /ST 21:00 /TN "MyWorld pull backup" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File `"$PWD\tools\pull-backup.ps1`""
# ต้องตั้ง ssh alias "my-world" ไว้แล้ว และคีย์ SSH ต้องใช้ได้โดยไม่ถามรหัส (ไม่งั้นงานตั้งเวลาจะค้าง)
# ไฟล์สำรองมี IP ผู้เล่น: เก็บไว้นอกโฟลเดอร์รีโปเสมอ ห้าม commit
param(
  [string]$Dest = "$env:USERPROFILE\my-world-backups",
  [int]$Keep = 30
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$log = Join-Path $Dest 'pull.log'
function Log($m) { $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $log -Value $line -Encoding UTF8 }
try {
  $remote = (ssh -o BatchMode=yes -o ConnectTimeout=15 my-world "ls -1t /root/my-world/backup/auto/daily/*.tar.gz 2>/dev/null | head -1").Trim()
  if (-not $remote) { throw 'ไม่พบไฟล์สำรองรายวันบน VPS (เช็ก cron my-world-backup)' }
  $name = Split-Path $remote -Leaf
  $local = Join-Path $Dest $name
  if (Test-Path $local) { Log "มีแล้ว: $name"; exit 0 }
  scp -q -o BatchMode=yes "my-world:$remote" "$local.part"
  if ((Get-Item "$local.part").Length -lt 100) { throw "ไฟล์ที่ได้เล็กผิดปกติ: $name" }
  Move-Item "$local.part" $local
  Log "ดึงสำเร็จ: $name ($([math]::Round((Get-Item $local).Length/1KB)) KB)"
  Get-ChildItem $Dest -Filter 'data-*.tar.gz' | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep | Remove-Item -Force
} catch {
  Log "ล้มเหลว: $($_.Exception.Message)"
  exit 1
}
