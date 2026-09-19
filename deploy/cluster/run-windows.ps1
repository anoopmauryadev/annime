param([ValidateSet('media','worker')][string]$Role,[string]$Repo='C:\annime')
$ErrorActionPreference='Stop'
Set-Location $Repo
$node=(Get-Command node.exe -ErrorAction Stop).Source
$script=if($Role -eq 'media'){'deploy/media-node/server.js'}else{'scripts/cluster-worker.cjs'}
New-Item -ItemType Directory -Force "$Repo\data\node-logs" | Out-Null
& $node "--env-file=$Repo\media-node.env" $script >> "$Repo\data\node-logs\$Role.log" 2>&1
exit $LASTEXITCODE
