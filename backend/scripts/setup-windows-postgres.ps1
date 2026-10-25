# Run as Administrator (right-click PowerShell → Run as administrator)
# Sets postgres password to 12345678 and creates database "hms" on PostgreSQL 18.

$ErrorActionPreference = "Stop"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$pgData = "C:\Program Files\PostgreSQL\18\data"
$pgHba = Join-Path $pgData "pg_hba.conf"
$psql = Join-Path $pgBin "psql.exe"
$service = "postgresql-x64-18"

if (-not (Test-Path $psql)) { throw "psql not found at $psql" }
if (-not (Test-Path $pgHba)) { throw "pg_hba.conf not found at $pgHba" }

Write-Host "Backing up pg_hba.conf..."
Copy-Item $pgHba "$pgHba.bak-filfilu" -Force

Write-Host "Temporarily allowing local trust auth..."
(Get-Content $pgHba) `
  -replace "scram-sha-256", "trust" `
  | Set-Content $pgHba

Restart-Service $service -Force
Start-Sleep -Seconds 3

Write-Host "Setting password and creating database hms..."
& $psql -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD '12345678';"
$exists = & $psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='hms'"
if ($exists -ne "1") {
  & $psql -U postgres -d postgres -c "CREATE DATABASE hms OWNER postgres;"
}

Write-Host "Restoring scram-sha-256 auth..."
Copy-Item "$pgHba.bak-filfilu" $pgHba -Force
Restart-Service $service -Force
Start-Sleep -Seconds 3

Write-Host "Testing login..."
$env:PGPASSWORD = "12345678"
& $psql -h 127.0.0.1 -p 5433 -U postgres -d hms -c "SELECT current_database(), current_user;"
Write-Host "Done. Use backend .env values: localhost / 5433 / hms / postgres / 12345678"
