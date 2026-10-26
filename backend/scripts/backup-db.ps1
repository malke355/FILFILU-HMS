# PostgreSQL backup for Filfilu HMS (Windows).
# Usage (from backend/):
#   .\scripts\backup-db.ps1
#   .\scripts\backup-db.ps1 -OutDir C:\backups\filfilu

param(
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $Root "backups" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$envFile = Join-Path $Root ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $pair = $_ -split '=', 2
    if ($pair.Length -eq 2) {
      $name = $pair[0].Trim()
      $val = $pair[1].Trim().Trim('"').Trim("'")
      [Environment]::SetEnvironmentVariable($name, $val, "Process")
    }
  }
}

$Db = if ($env:PGDATABASE) { $env:PGDATABASE } else { "hms" }
$Super = if ($env:POSTGRES_SUPERUSER) { $env:POSTGRES_SUPERUSER } else { "postgres" }
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$SqlFile = Join-Path $OutDir "hms-$Stamp.sql"
$GzFile = Join-Path $OutDir "hms-$Stamp.sql.gz"

Write-Host "Backing up $Db → $GzFile"

$running = docker ps --format "{{.Names}}" 2>$null | Select-String -Pattern "^filfilu-hms-pg$"
if (-not $running) {
  throw "Container filfilu-hms-pg is not running. Start it with: docker compose -f docker-compose.hms.yml --env-file .env up -d"
}

# Stream dump to a UTF-8 file (avoids PowerShell string/encoding corruption).
$dockerArgs = @("exec")
if ($env:POSTGRES_PASSWORD) {
  $dockerArgs += @("-e", "PGPASSWORD=$($env:POSTGRES_PASSWORD)")
}
$dockerArgs += @(
  "filfilu-hms-pg",
  "pg_dump",
  "-U", $Super,
  "-d", $Db,
  "--no-owner",
  "--format=plain"
)

& docker @dockerArgs | Set-Content -Path $SqlFile -Encoding utf8
if ($LASTEXITCODE -ne 0) {
  Remove-Item -Force $SqlFile -ErrorAction SilentlyContinue
  throw "pg_dump failed with exit code $LASTEXITCODE"
}

$len = (Get-Item $SqlFile).Length
if ($len -lt 64) {
  Remove-Item -Force $SqlFile -ErrorAction SilentlyContinue
  throw "Backup failed: dump is empty or too small ($len bytes)."
}

$inBytes = [System.IO.File]::ReadAllBytes($SqlFile)
$outStream = [System.IO.File]::Create($GzFile)
$gz = New-Object System.IO.Compression.GzipStream($outStream, [System.IO.Compression.CompressionMode]::Compress)
try {
  $gz.Write($inBytes, 0, $inBytes.Length)
} finally {
  $gz.Dispose()
  $outStream.Dispose()
}
Remove-Item -Force $SqlFile

Get-ChildItem "$OutDir\hms-*.sql.gz" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force
Write-Host "Done: $GzFile ($len bytes uncompressed)"
Get-Item $GzFile | Format-List FullName, Length, LastWriteTime
