# Step 15 — Production Offline-First POS E2E

param(
  [string]$Base = "http://localhost:4000/api",
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
$env:API_BASE = $Base

Write-Host "=== Step 15 Offline POS E2E ===" -ForegroundColor Cyan

if (-not $SkipSeed) {
  Write-Host "Running db:seed..."
  Push-Location (Join-Path $PSScriptRoot ".." "packages" "database")
  npm run db:seed
  Pop-Location
  Start-Sleep -Seconds 2
}

Write-Host "Running Step 15 offline POS validation..."
node (Join-Path $PSScriptRoot "step15-offline-pos-e2e.mjs")
exit $LASTEXITCODE
