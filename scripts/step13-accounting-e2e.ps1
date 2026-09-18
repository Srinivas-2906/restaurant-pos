# Step 13 — Accounting E2E validation
param(
  [string]$Base = "http://localhost:4000/api",
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
$env:API_BASE = $Base

Write-Host "=== Step 13 Accounting E2E ===" -ForegroundColor Cyan

if (-not $SkipSeed) {
  Write-Host "Running db:seed..."
  Push-Location (Join-Path $PSScriptRoot ".." "packages" "database")
  npm run db:seed
  Pop-Location
  Start-Sleep -Seconds 2
}

Write-Host "Running Step 13.1 comprehensive validation..."
node (Join-Path $PSScriptRoot "step13.1-accounting-validation.mjs")
exit $LASTEXITCODE
