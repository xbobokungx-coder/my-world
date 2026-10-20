# My World control: game server and online tunnel, each on/off/restart independently.
# Usage: control.ps1 <game-start|game-stop|game-restart|online-on|online-off|online-restart|all-start|all-stop|status>
# NOTE: keep this file ASCII-only (Windows PowerShell 5.1 misreads non-ASCII text in files without a BOM).
param([Parameter(Mandatory = $true)][string]$Action)
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
$port = 3000
$tunnel = 'fun-chair-c12rr24.asse'
$url = 'https://jvt9v1n4-3000.asse.devtunnels.ms/'
Set-Location $root

function Test-Port($p) { return [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) }

function Stop-Watcher($marker) {
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
        Where-Object { $_.CommandLine -match $marker } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Game-Stop {
    Stop-Watcher 'node server\.js'  # also catches watchers started by the old start-online.ps1
    $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }
    Write-Host 'Game server stopped.'
}

function Game-Start {
    if (Test-Port $port) { Write-Host "Game server already running (port $port)"; return }
    $cmd = "`$MYWORLD_GAME = 1; Set-Location '$root'; while (`$true) { node server.js; Start-Sleep 3 }"
    Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command', $cmd
    Write-Host "Game server started: http://localhost:$port"
}

function Online-Stop {
    Stop-Watcher 'devtunnel host'   # also catches watchers started by the old start-online.ps1
    Get-Process devtunnel -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep 1
    Get-Process devtunnel -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host 'Online (tunnel) is OFF. Game still runs locally.'
}

function Online-Start {
    # Always clear leftovers first: two hosts for one tunnel kick each other off and nothing works.
    Stop-Watcher 'devtunnel host'
    Get-Process devtunnel -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep 2
    $cmd = "`$MYWORLD_TUNNEL = 1; `$env:Path = [Environment]::GetEnvironmentVariable('Path','User') + ';' + [Environment]::GetEnvironmentVariable('Path','Machine'); while (`$true) { devtunnel host $tunnel; Start-Sleep 5 }"
    Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command', $cmd
    Write-Host "Online is ON: $url"
}

function Status {
    if (Test-Port $port) { Write-Host "Game server : RUNNING  (http://localhost:$port)" } else { Write-Host 'Game server : STOPPED' }
    if (Get-Process devtunnel -ErrorAction SilentlyContinue) { Write-Host "Online      : ON       ($url)" } else { Write-Host 'Online      : OFF' }
}

switch ($Action) {
    'game-start'     { Game-Start }
    'game-stop'      { Game-Stop }
    'game-restart'   { Game-Stop; Start-Sleep 2; Game-Start }
    'online-on'      { Online-Start }
    'online-off'     { Online-Stop }
    'online-restart' { Online-Stop; Start-Sleep 2; Online-Start }
    'all-start'      { Game-Start; Online-Start }
    'all-stop'       { Online-Stop; Game-Stop }
    'status'         { }
    default          { Write-Host "Unknown action: $Action"; exit 1 }
}
Start-Sleep 1
Status
