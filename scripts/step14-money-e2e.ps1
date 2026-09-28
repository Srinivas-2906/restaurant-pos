# Step 14 — Money & Financial Operations E2E

param(

  [string]$Base = "http://localhost:4000/api",

  [switch]$SkipSeed

)



$ErrorActionPreference = "Stop"

$env:API_BASE = $Base



Write-Host "=== Step 14 Money E2E ===" -ForegroundColor Cyan



if (-not $SkipSeed) {

  Write-Host "Running db:seed..."

  Push-Location (Join-Path $PSScriptRoot ".." "packages" "database")

  npm run db:seed

  Pop-Location

  Start-Sleep -Seconds 2

}



Write-Host "Running Step 14 money validation..."

node (Join-Path $PSScriptRoot "step14-money-e2e.mjs")

exit $LASTEXITCODE

