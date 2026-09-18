# Step 10 — Legacy alias: use step10-prepare-manual-kds.ps1 (requires db:seed first; no login automation).
Write-Host "Redirecting to step10-prepare-manual-kds.ps1 ..."
powershell -NoProfile -File "$PSScriptRoot\step10-prepare-manual-kds.ps1"
