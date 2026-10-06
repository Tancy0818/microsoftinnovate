$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22.12+ before running setup.' }
if (-not (Test-Path 'node_modules/pg')) { throw 'Run npm install first.' }
if (-not (Test-Path '.local/pgsql/bin/pg_ctl.exe')) {
 New-Item -ItemType Directory -Force '.local/downloads' | Out-Null
 $archive = Join-Path $projectRoot '.local/downloads/postgresql.zip'
 Invoke-WebRequest 'https://get.enterprisedb.com/postgresql/postgresql-17.11-3-windows-x64-binaries.zip' -OutFile $archive
 tar.exe -xf $archive -C .local pgsql/bin pgsql/lib pgsql/share pgsql/server_license.txt
 if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL extraction failed.' }
}
node scripts/setup-database.mjs
if ($LASTEXITCODE -ne 0) { throw 'Database setup failed.' }
node --env-file=.env backend/src/cli.ts migrate
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
