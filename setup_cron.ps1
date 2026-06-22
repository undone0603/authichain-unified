<#
.SYNOPSIS
Sets up a Windows Scheduled Task to run AgentZ daily.
#>

$TaskName = "AgentZ Daily Auto-Run"
$ActionScript = "C:\Python314\python.exe" # Fallback if python is not in path for system
$WorkingDir = (Get-Item .).FullName

# Try to find python in path, otherwise assume it's C:\Python314\python.exe
$PythonExe = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
if (-not $PythonExe) {
    $PythonExe = "python.exe"
}

$ActionArgs = "-m agentz.cli run --all --mode auto --continue-on-error"

Write-Host "Creating Scheduled Task: $TaskName"
Write-Host "Action: $PythonExe $ActionArgs"
Write-Host "Working Directory: $WorkingDir"

# Create trigger (daily at 8:00 AM)
$Trigger = New-ScheduledTaskTrigger -Daily -At 8:00AM

# Create action
$Action = New-ScheduledTaskAction -Execute $PythonExe -Argument $ActionArgs -WorkingDirectory $WorkingDir

# Create settings (allow starting if missed, don't stop if running on batteries)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

# Register task
try {
    Register-ScheduledTask -TaskName $TaskName -Trigger $Trigger -Action $Action -Settings $Settings -Description "Runs AgentZ daily workflows autonomously." -Force
    Write-Host "Task '$TaskName' registered successfully." -ForegroundColor Green
    Write-Host "You can manage this task by opening 'Task Scheduler' (taskschd.msc)."
} catch {
    Write-Host "Failed to register task. Run this script as Administrator." -ForegroundColor Red
    Write-Host $_.Exception.Message
}
