# check-all.ps1 — ตรวจสอบ syntax และรันเทสต์บน Windows ผ่าน Git Bash
# ใช้งาน:
#   .\tools\check-all.ps1         (node --check + รันทุก test-*.js)
#   .\tools\check-all.ps1 -Quick  (แค่ node --check)
param([switch]$Quick)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$bashCandidates = @(
    "C:\Program Files\Git\bin\bash.exe",
    "C:\Program Files\Git\usr\bin\bash.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe"
)

$bash = $bashCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $bash) {
    $cmd = Get-Command bash.exe -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -notmatch "System32") {
        $bash = $cmd.Source
    }
}

if ($bash) {
    $scriptArg = if ($Quick) { "tools/check-all.sh --quick" } else { "tools/check-all.sh" }
    & $bash -c $scriptArg
    exit $LASTEXITCODE
} else {
    Write-Host "ไม่พบ Git Bash, รัน node tools/check.js แทน..."
    node tools/check.js
    exit $LASTEXITCODE
}
