# Starts the game server + Dev Tunnel with watchers that restart them if they die.
# Use: double-click start-online.bat (or run install-autostart.ps1 once to start at every login).
# NOTE: keep this file ASCII-only (Windows PowerShell 5.1 misreads non-ASCII text in files without a BOM).
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
$tunnel = 'fun-chair-c12rr24.asse'
$port = 3000
Set-Location $root

function Test-Port($p) { return [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) }

# 1) game server (restarted automatically if it exits)
if (-not (Test-Port $port)) {
    $cmd = "Set-Location '$root'; while (`$true) { node server.js; Start-Sleep 3 }"
    Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command', $cmd
    Write-Host "Game server started (port $port)"
} else {
    Write-Host "Game server already running (port $port)"
}

# 2) Dev Tunnel (restarted automatically). Needs a one-time login: devtunnel user login -g -d
if (-not (Get-Process devtunnel -ErrorAction SilentlyContinue)) {
    $cmd = "`$env:Path = [Environment]::GetEnvironmentVariable('Path','User') + ';' + [Environment]::GetEnvironmentVariable('Path','Machine'); while (`$true) { devtunnel host $tunnel; Start-Sleep 5 }"
    Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command', $cmd
    Write-Host "Tunnel started: https://jvt9v1n4-3000.asse.devtunnels.ms/"
} else {
    Write-Host "Tunnel already running"
}
