# Inspect kaana_pos_offline.db on a connected Android device WITHOUT wiping app data.
param(
  [string]$Package = "in.kaanafoods.mobile",
  [string]$PullPath = "$env:TEMP\kaana_pos_offline.db"
)

$ErrorActionPreference = "Stop"

Write-Host "Checking adb devices..."
$devices = adb devices | Select-String "device$"
if (-not $devices) {
  Write-Host ""
  Write-Host "No authorized adb device found."
  Write-Host "On the Samsung tablet:"
  Write-Host "  1. Settings > About > tap Build number 7x (if Developer options missing)"
  Write-Host "  2. Settings > Developer options > USB debugging ON"
  Write-Host "  3. Connect USB, choose File transfer / MTP"
  Write-Host "  4. Accept the RSA fingerprint prompt on the tablet"
  Write-Host "  5. Run: adb devices   (must show device, not unauthorized)"
  exit 1
}

Write-Host "Device connected. Locating SQLite DB..."
$dbPaths = @(
  "files/SQLite/kaana_pos_offline.db",
  "databases/kaana_pos_offline.db"
)

$found = $null
foreach ($rel in $dbPaths) {
  $probe = adb shell "run-as $Package ls $rel" 2>$null
  if ($LASTEXITCODE -eq 0 -and $probe) {
    $found = $rel
    break
  }
}

if (-not $found) {
  Write-Host "DB not found under expected paths. Listing app storage..."
  adb shell "run-as $Package ls -R files" 2>&1
  adb shell "run-as $Package ls databases" 2>&1
  exit 1
}

Write-Host "Found: $found"
# Binary-safe pull (PowerShell > corrupts SQLite; /sdcard copy often blocked on Samsung)
cmd /c "adb exec-out run-as $Package cat $found > `"$PullPath`""

if (-not (Test-Path $PullPath)) {
  Write-Host "Failed to pull DB to $PullPath"
  exit 1
}

$header = [System.IO.File]::ReadAllBytes($PullPath)[0..14]
$magic = [System.Text.Encoding]::ASCII.GetString($header)
if ($magic -notlike "SQLite format 3*") {
  Write-Host "Pulled file is not a valid SQLite DB (header: $magic)"
  exit 1
}

Write-Host ""
Write-Host "=== Cache inspection ($PullPath) ==="
$queries = @{
  "schema_version" = "SELECT value FROM hub_meta WHERE key='schema_version'"
  "menu_cached_outlet_id" = "SELECT value FROM hub_meta WHERE key='menu_cached_outlet_id'"
  "menu_synced_at" = "SELECT key, value FROM hub_meta WHERE key LIKE 'menu_synced_at:%'"
  "category_count" = "SELECT COUNT(*) FROM menu_categories"
  "item_count" = "SELECT COUNT(*) FROM menu_items"
  "sample_categories" = "SELECT id, name FROM menu_categories LIMIT 5"
}

foreach ($label in $queries.Keys) {
  Write-Host ""
  Write-Host "-- $label --"
  node "$PSScriptRoot\step15.1-sqlite-query.mjs" $PullPath $queries[$label]
}

Write-Host ""
Write-Host "Done. DB preserved on device; pulled copy at $PullPath"
