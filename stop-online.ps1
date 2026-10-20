# Stops the game, the tunnel and their watchers (the game saves its data on a clean stop).
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'while \(\$true\)' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-Process devtunnel -ErrorAction SilentlyContinue | Stop-Process -Force
$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($c) { Stop-Process -Id $c.OwningProcess -Force }
Write-Host 'Stopped game and tunnel.'
