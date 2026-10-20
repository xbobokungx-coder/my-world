# Makes the game + tunnel start by themselves every time you log in to Windows (no admin rights needed).
# Remove with: powershell -ExecutionPolicy Bypass -File .\install-autostart.ps1 -Remove
param([switch]$Remove)
$name = 'MyWorld-Online'
if ($Remove) {
    Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host 'Autostart removed.'
    return
}
$script = Join-Path $PSScriptRoot 'start-online.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "Done: game + tunnel will start at every login ($name)."
