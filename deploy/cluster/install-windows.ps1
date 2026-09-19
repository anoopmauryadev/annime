# Run in an elevated PowerShell after checking the repository and env file.
# Credentials are entered locally and stored by Task Scheduler, never in this repo.
param([string]$Repo='C:\annime')
$ErrorActionPreference='Stop'
if(-not(Test-Path "$Repo\media-node.env")){throw 'Create media-node.env first'}
Get-Command node.exe,ffmpeg.exe,ffprobe.exe -ErrorAction Stop | Out-Null
$credential=Get-Credential -Message 'Dedicated Windows account for Anime Zone media tasks'
$account=$credential.UserName
icacls "$Repo\media-node.env" /inheritance:r /grant:r "${account}:(R)" 'SYSTEM:(F)' 'Administrators:(F)' | Out-Null
foreach($role in @('media','worker')) {
 $action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$Repo\deploy\cluster\run-windows.ps1`" -Role $role -Repo `"$Repo`"" -WorkingDirectory $Repo
 $trigger=New-ScheduledTaskTrigger -AtStartup
 $settings=New-ScheduledTaskSettingsSet -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable
 Register-ScheduledTask -TaskName "AnimeZone-$role" -Action $action -Trigger $trigger -Settings $settings -User $account -Password $credential.GetNetworkCredential().Password -RunLevel Limited -Force | Out-Null
}
Write-Output 'Tasks registered. Grant this account write access to MEDIA_DIR, TRANSCODE_WORK_DIR and data/node-logs, then start tasks.'
