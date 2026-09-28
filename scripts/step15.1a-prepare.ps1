# Step 15.1A — Prepare online POS bootstrap (no db:seed after terminal activation)
$ErrorActionPreference = "Stop"
$RepoRoot = "C:\Users\kanas\Kaana-foods"
$ShotDir = "$RepoRoot\docs\validation\step15\android"
$Base = "http://localhost:4000/api"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$EmulatorApi = "http://10.0.2.2:4000/api"

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

New-Item -ItemType Directory -Force -Path $ShotDir | Out-Null

Write-Host "=== 1. Clean seed ==="
Set-Location $RepoRoot
npm run db:seed | Out-Host

Write-Host "`n=== 2. API health ==="
$health = Invoke-RestMethod -Uri "$Base/health"
Write-Host "  API OK: $($health.status)"

Write-Host "`n=== 3. Baseline ==="
$owner = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST `
  -Body (@{ email = "owner@kaanafoods.in"; password = "password123" } | ConvertTo-Json) `
  -ContentType "application/json"
$oh = @{ Authorization = "Bearer $($owner.accessToken)" }
$floor = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $oh
$live = Invoke-RestMethod -Uri "$Base/orders/live?outletId=$OutletId" -Headers $oh
$free = @($floor.tables | Where-Object { $_.status -eq "free" }).Count
Write-Host "  Tables free: $free/6"
Write-Host "  Live orders: $($live.orders.Count)"

Write-Host "`n=== 4. Metro ==="
$metroBytes = (Invoke-WebRequest -Uri "http://127.0.0.1:8081/status" -UseBasicParsing).Content
$metro = if ($metroBytes -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($metroBytes) } else { [string]$metroBytes }
if ($metro -notmatch "running") { throw "Metro not running on :8081" }
Write-Host "  Metro OK"

Write-Host "`n=== 5. Emulator API connectivity ==="
adb reverse tcp:4000 tcp:4000 | Out-Null
adb reverse tcp:8081 tcp:8081 | Out-Null
Write-Host "  Mobile EXPO_PUBLIC_API_URL should be: $EmulatorApi"
Write-Host "  adb reverse: tcp:4000 and tcp:8081 enabled"
Write-Host "  Host API reachable at localhost:4000 (verified above)"

Write-Host "`n=== 6. Fresh STEP15-ANDROID-POS terminal ==="
$terms = Invoke-RestMethod -Uri "$Base/terminals" -Headers $oh
foreach ($old in ($terms | Where-Object { $_.name -eq "STEP15-ANDROID-POS" })) {
  if ($old.isRegistered) {
    Invoke-RestMethod -Uri "$Base/terminals/$($old.id)/revoke" -Method POST -Headers $oh -ContentType "application/json" | Out-Null
  }
}
Start-Sleep -Seconds 1
$term = Invoke-RestMethod -Uri "$Base/terminals" -Method POST -Headers $oh `
  -Body (@{ outletId = $OutletId; name = "STEP15-ANDROID-POS"; deviceType = "pos" } | ConvertTo-Json) `
  -ContentType "application/json"
$act = Invoke-RestMethod -Uri "$Base/terminals/$($term.id)/activation-code" -Method POST -Headers $oh -ContentType "application/json"
Write-Host "  Terminal id=$($term.id)"
Write-Host "  Activation code=$($act.activationCodeDisplay) raw=$($act.activationCode)"

Write-Host "`n=== 7. Verify eligibility via temporary activation (revoked before manual walkthrough) ==="
$deviceId = "step15-eligibility-probe"
$activated = Invoke-RestMethod -Uri "$Base/terminals/activate" -Method POST `
  -Body (@{
    code = $act.activationCode
    deviceId = $deviceId
    deviceMetadata = @{ platform = "android"; appVersion = "1.0.0"; probe = $true }
  } | ConvertTo-Json) -ContentType "application/json"
$probeSecret = $activated.deviceCredential
$termAuth = @{ Authorization = "Terminal $($term.id):$probeSecret" }

$termCheck = Invoke-RestMethod -Uri "$Base/terminals" -Headers $oh | Where-Object { $_.id -eq $term.id } | Select-Object -First 1
Write-Host "  probe isRegistered=$($termCheck.isRegistered) isActive=$($termCheck.isActive) revokedAt=$($termCheck.revokedAt)"
Write-Host "  outlet=$($termCheck.outletId) deviceType=$($termCheck.deviceType)"

Write-Host "`n=== 8. Eligible staff (same API as mobile login) ==="
$eligible = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers $termAuth
foreach ($s in $eligible) {
  Write-Host "  ELIGIBLE: $($s.employeeCode) $($s.displayName)"
}
$emp001 = $eligible | Where-Object { $_.employeeCode -eq "EMP001" } | Select-Object -First 1
$emp002 = $eligible | Where-Object { $_.employeeCode -eq "EMP002" } | Select-Object -First 1
$emp003 = $eligible | Where-Object { $_.employeeCode -eq "EMP003" } | Select-Object -First 1
$emp004 = $eligible | Where-Object { $_.employeeCode -eq "EMP004" } | Select-Object -First 1
if (-not $emp001) { throw "ROOT CAUSE: EMP001 missing from eligible-staff on STEP15-ANDROID-POS" }
if ($emp002) { Write-Host "  WARN: EMP002 unexpectedly eligible for POS" }
if ($emp003) { Write-Host "  WARN: EMP003 unexpectedly eligible for POS" }
if ($emp004) { Write-Host "  NOTE: EMP004 eligible (multi-role)" }

Write-Host "`n=== 9. Pin login API (EMP001 / 1111) ==="
$login = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers $termAuth `
  -Body (@{ staffProfileId = $emp001.id; pin = "1111" } | ConvertTo-Json) -ContentType "application/json"
Write-Host "  Login OK: $($login.staff.employeeCode) role=$($login.staff.role)"
Write-Host "  offlineAuthValidUntil=$($login.offlineAuth.offlineAuthValidUntil)"

Write-Host "`n=== 10. Revoke probe + fresh activation code for emulator ==="
Invoke-RestMethod -Uri "$Base/terminals/$($term.id)/revoke" -Method POST -Headers $oh -ContentType "application/json" | Out-Null
Start-Sleep -Seconds 1
$actFresh = Invoke-RestMethod -Uri "$Base/terminals/$($term.id)/activation-code" -Method POST -Headers $oh -ContentType "application/json"
Write-Host "  Fresh code for emulator: $($actFresh.activationCodeDisplay) raw=$($actFresh.activationCode)"

@{
  terminalId = $term.id
  activationCode = $actFresh.activationCode
  activationCodeDisplay = $actFresh.activationCodeDisplay
  apiUrlEmulator = $EmulatorApi
  apiUrlHost = $Base
  adbReverse = @("tcp:4000 tcp:4000", "tcp:8081 tcp:8081")
  eligibleStaff = @($eligible | ForEach-Object { $_.employeeCode })
  preparedAt = (Get-Date).ToUniversalTime().ToString("o")
  manualSteps = @(
    "Launch app: adb shell am start -n in.kaanafoods.mobile/.MainActivity -a android.intent.action.VIEW -d `"in.kaanafoods.mobile://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081`""
    "Set Up Restaurant Device -> enter activation code (only if pm clear; else skip if already activated)"
    "Sign in EMP001 / 1111 manually (no adb taps)"
    "Verify POS home + screenshot 01-online-cached.png"
    "Inspect SQLite: adb shell run-as in.kaanafoods.mobile ls databases"
    "For offline: stop API only AFTER online bootstrap proven (do not disable Wi-Fi if Metro needed)"
  )
} | ConvertTo-Json -Depth 5 | Set-Content "$ShotDir\step15.1a-session.json"

Write-Host "`n=== READY FOR MANUAL WALKTHROUGH ==="
Write-Host "Session: $ShotDir\step15.1a-session.json"
Write-Host "Do NOT run db:seed until walkthrough complete."
