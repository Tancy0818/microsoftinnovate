$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
if (-not (Test-Path '.env')) { throw 'Run scripts/setup-local.ps1 first.' }
$pgControl = Join-Path $projectRoot '.local/pgsql/bin/pg_ctl.exe'
$pgData = Join-Path $projectRoot '.local/pgdata'
& $pgControl -D $pgData status | Out-Null
if ($LASTEXITCODE -ne 0) { & $pgControl -D $pgData -l "$projectRoot/.local/logs/postgres.log" -w start }
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js 22.18+ is required. Install Node.js, then run this launcher again.' }
& $nodePath --env-file=.env backend/src/cli.ts migrate
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed; see the error above.' }
$services = @(@{Name='api';Port=3001;Args=@('--env-file=.env','backend/src/server.ts')},@{Name='web';Port=5173;Args=@('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort')})
foreach ($service in $services) {
 if (Get-NetTCPConnection -State Listen -LocalPort $service.Port -ErrorAction SilentlyContinue) { Write-Host "$($service.Name): port $($service.Port) already in use; leaving its process running."; continue }
 $process = Start-Process $nodePath -ArgumentList $service.Args -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "$projectRoot/.local/logs/$($service.Name).log" -RedirectStandardError "$projectRoot/.local/logs/$($service.Name)-error.log"
 $process.Id | Set-Content "$projectRoot/.local/$($service.Name).pid"
}
Write-Host 'Dashboard: http://127.0.0.1:5173/ | API: http://127.0.0.1:3001/api/health'
