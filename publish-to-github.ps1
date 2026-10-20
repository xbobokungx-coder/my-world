$ErrorActionPreference = 'Stop'
$remote = 'git@github.com:xbobokungx-coder/my-world.git'

if (-not (Test-Path .git)) { git init -b main }
if (-not (git remote)) { git remote add origin $remote } else { git remote set-url origin $remote }

git add .
Write-Host "`n=== ไฟล์ที่จะถูก commit (ต้องไม่มี admin.key / data / node_modules) ===" -ForegroundColor Yellow
git status --short
$bad = git ls-files | Select-String -Pattern '^(admin\.key|data/|node_modules/|backup/)'
if ($bad) { Write-Host "พบไฟล์ต้องห้าม หยุดการทำงาน:`n$bad" -ForegroundColor Red; exit 1 }

git commit -m "Initial commit"
git push -u origin main
