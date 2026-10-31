$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
$environmentFile = Join-Path $projectDirectory '.env.local'
$workerFile = Join-Path $PSScriptRoot 'research-reminders.ts'
$action = New-ScheduledTaskAction -Execute $nodeExecutable -Argument ('--env-file="' + $environmentFile + '" "' + $workerFile + '" --send') -WorkingDirectory $projectDirectory
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Hours 1)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
# No credentials are copied into the task. Node reads the ignored .env.local.
Register-ScheduledTask -TaskName 'BPBD-Pengingat-Penelitian' -Action $action -Trigger $trigger -Settings $settings -Description 'Memeriksa pengingat tenggat penelitian per jam; pengiriman mingguan mulai H-30.'
