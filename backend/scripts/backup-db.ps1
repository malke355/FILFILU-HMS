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

$PgHost = if ($env:PGHOST) { $env:PGHOST } else { "127.0.0.1" }
$PgPort = if ($env:PGPORT) { $env:PGPORT } else { "5434" }
$Db = if ($env:PGDATABASE) { $env:PGDATABASE } else { "hms" }
$Super = if ($env:POSTGRES_SUPERUSER) { $env:POSTGRES_SUPERUSER } else { "postgres" }
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$File = Join-Path $OutDir "hms-$Stamp.sql.gz"

Write-Host "Backing up $Db @ ${PgHost}:${PgPort} → $File"

$running = docker ps --format "{{.Names}}" 2>$null | Select-String -Pattern "^filfilu-hms-pg$"
if ($running) {
  $dump = docker exec -e "PGPASSWORD=$($env:POSTGRES_PASSWORD)" filfilu-hms-pg `
    pg_dump -U $Super -d $Db --no-owner --format=plain
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($dump -join "`n") + "`n")
  $ms = New-Object System.IO.MemoryStream
  $gz = New-Object System.IO.Compression.GzipStream($ms, [System.IO.Compression.CompressionMode]::Compress)
  $gz.Write($bytes, 0, $bytes.Length)
  $gz.Close()
  [System.IO.File]::WriteAllBytes($File, $ms.ToArray())
} else {
  throw "Container filfilu-hms-pg is not running. Start it with docker compose -f docker-compose.hms.yml --env-file .env up -d"
}

Get-ChildItem "$OutDir\hms-*.sql.gz" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force
Write-Host "Done: $File"
Get-Item $File | Format-List FullName, Length, LastWriteTime
