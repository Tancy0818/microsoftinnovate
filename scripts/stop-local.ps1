$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
foreach ($serviceName in @('api','web')) {
 $pidFile = Join-Path $projectRoot ".local/$serviceName.pid"
 if (Test-Path $pidFile) {
  $servicePid = [int](Get-Content $pidFile)
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$servicePid"
  $expected = if($serviceName -eq 'api') {'backend/src/server.ts'} else {'node_modules/vite/bin/vite.js'}
  if ($process -and $process.Name -eq 'node.exe' -and $process.CommandLine.Contains($expected)) { Stop-Process -Id $servicePid }
  Remove-Item -LiteralPath $pidFile
 }
}
& "$projectRoot/.local/pgsql/bin/pg_ctl.exe" -D "$projectRoot/.local/pgdata" -m fast -w stop
