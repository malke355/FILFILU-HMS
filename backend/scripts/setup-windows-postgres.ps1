# Run as Administrator (right-click PowerShell → Run as administrator)
# Optional local Windows PostgreSQL setup for Filfilu HMS.
# Prefer Docker: docker compose -f docker-compose.hms.yml --env-file .env up -d
#
# Requires env:
#   $env:POSTGRES_PASSWORD = "<strong superuser password>"
#   $env:PGPASSWORD        = "<strong app role password for filfilu>"

$ErrorActionPreference = "Stop"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$pgData = "C:\Program Files\PostgreSQL\18\data"
$pgHba = Join-Path $pgData "pg_hba.conf"
$psql = Join-Path $pgBin "psql.exe"
$service = "postgresql-x64-18"
$port = if ($env:PGPORT) { $env:PGPORT } else { "5433" }
$superPass = $env:POSTGRES_PASSWORD
$appPass = $env:PGPASSWORD
$appUser = if ($env:PGUSER) { $env:PGUSER } else { "filfilu" }
$dbName = if ($env:PGDATABASE) { $env:PGDATABASE } else { "hms" }

if (-not $superPass -or $superPass.Length -lt 16) {
  throw "Set `$env:POSTGRES_PASSWORD to a strong password (16+ chars) before running."
}
if (-not $appPass -or $appPass.Length -lt 16) {
  throw "Set `$env:PGPASSWORD to a strong password (16+ chars) for the app role."
}
if ($appUser -eq "postgres") {
  throw "PGUSER must be a least-privilege role (e.g. filfilu), not postgres."
}
if (-not (Test-Path $psql)) { throw "psql not found at $psql" }
if (-not (Test-Path $pgHba)) { throw "pg_hba.conf not found at $pgHba" }

Write-Host "Backing up pg_hba.conf..."
Copy-Item $pgHba "$pgHba.bak-filfilu" -Force

try {
  Write-Host "Temporarily allowing local trust auth..."
  (Get-Content $pgHba) `
    -replace "scram-sha-256", "trust" `
    | Set-Content $pgHba

  Restart-Service $service -Force
  Start-Sleep -Seconds 3

  Write-Host "Setting postgres password and ensuring database $dbName..."
  & $psql -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD '$superPass';"
  $exists = & $psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName'"
  if ($exists -ne "1") {
    & $psql -U postgres -d postgres -c "CREATE DATABASE $dbName OWNER postgres;"
  }

  Write-Host "Creating least-privilege app role $appUser..."
  & $psql -U postgres -d $dbName -c @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$appUser') THEN
    CREATE ROLE $appUser LOGIN PASSWORD '$appPass' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE $appUser WITH LOGIN PASSWORD '$appPass' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
`$`$;
GRANT CONNECT ON DATABASE $dbName TO $appUser;
GRANT USAGE, CREATE ON SCHEMA public TO $appUser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $appUser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $appUser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $appUser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $appUser;
"@
}
finally {
  Write-Host "Restoring scram-sha-256 auth..."
  if (Test-Path "$pgHba.bak-filfilu") {
    Copy-Item "$pgHba.bak-filfilu" $pgHba -Force
  }
  Restart-Service $service -Force
  Start-Sleep -Seconds 3
}

Write-Host "Testing app role login..."
$env:PGPASSWORD = $appPass
& $psql -h 127.0.0.1 -p $port -U $appUser -d $dbName -c "SELECT current_database(), current_user;"
Write-Host "Done. Point backend/.env at 127.0.0.1 / $port / $dbName / $appUser (not postgres)."
