# Step 10 - Prepare clean manual KDS session (steps A-K). NO login automation. NO db:seed after terminal create.
$ErrorActionPreference = "Stop"
$ShotDir = "C:\Users\kanas\Kaana-foods\docs\validation\step10-kds-human"
$RepoRoot = "C:\Users\kanas\Kaana-foods"
$Base = "http://localhost:4000/api"
$OutletId = "cmtpu12qg0004u92svflt7odc"

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

New-Item -ItemType Directory -Force -Path $ShotDir | Out-Null

function Assert($cond, $msg) { if (-not $cond) { throw $msg } }

Write-Host "=== A. db:seed ==="
Set-Location $RepoRoot
npm run db:seed | Out-Host

Write-Host "`n=== B. Verify baseline ==="
$owner = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST `
  -Body (@{ email = "owner@kaanafoods.in"; password = "password123" } | ConvertTo-Json) `
  -ContentType "application/json"
$oh = @{ Authorization = "Bearer $($owner.accessToken)" }

$floor = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $oh
$live = Invoke-RestMethod -Uri "$Base/orders/live?outletId=$OutletId" -Headers $oh
$freeCount = @($floor.tables | Where-Object { $_.status -eq "free" }).Count
Assert ($freeCount -eq 6) "Expected 6/6 tables free, got $freeCount/6"
Assert ($live.orders.Count -eq 0) "Expected 0 live orders, got $($live.orders.Count)"
foreach ($t in $floor.tables | Sort-Object { [int]$_.number }) {
  Write-Host "  Table $($t.number) = $($t.status)"
}

$terms = Invoke-RestMethod -Uri "$Base/terminals" -Headers $oh
foreach ($name in @("POS-01", "CAPTAIN-01", "KDS-01")) {
  $t = $terms | Where-Object { $_.name -eq $name -and $_.isActive -eq $true } | Select-Object -First 1
  Assert ($null -ne $t) "Missing active seeded terminal: $name"
  Write-Host "  $name id=$($t.id) registered=$($t.isRegistered)"
}

Write-Host "`n=== C. Clear app data (once) ==="
adb shell pm clear in.kaanafoods.mobile | Out-Null

Write-Host "`n=== D/E. Check API + Metro ==="
try {
  Invoke-RestMethod -Uri "http://localhost:4000/api/health" -UseBasicParsing | Out-Null
  Write-Host "  API :4000 OK"
} catch {
  throw "API not running on :4000. Start the API before continuing."
}
try {
  $metro = (Invoke-WebRequest -Uri "http://127.0.0.1:8081/status" -UseBasicParsing).Content
  Assert ($metro -match "running") "Metro status unexpected: $metro"
  Write-Host "  Metro :8081 OK"
} catch {
  throw "Metro not running on :8081. Start with Step 9.1 env before continuing."
}

Write-Host "`n=== F. Launch Kaana ==="
adb reverse tcp:8081 tcp:8081 | Out-Null
adb reverse tcp:4000 tcp:4000 | Out-Null
adb shell am start -n in.kaanafoods.mobile/.MainActivity `
  -a android.intent.action.VIEW `
  -d "in.kaanafoods.mobile://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081" | Out-Null
Start-Sleep -Seconds 15
Write-Host "  App launched - expect Entry screen after bundle loads."

Write-Host "`n=== G/H. Create STEP10-HUMAN-KDS + activation code ==="
foreach ($old in ($terms | Where-Object { $_.name -eq "STEP10-HUMAN-KDS" })) {
  if ($old.isRegistered) {
    Invoke-RestMethod -Uri "$Base/terminals/$($old.id)/revoke" -Method POST -Headers $oh -ContentType "application/json" | Out-Null
  }
}
Start-Sleep -Seconds 1
$term = Invoke-RestMethod -Uri "$Base/terminals" -Method POST -Headers $oh `
  -Body (@{ outletId = $OutletId; name = "STEP10-HUMAN-KDS"; deviceType = "kds" } | ConvertTo-Json) `
  -ContentType "application/json"
$act = Invoke-RestMethod -Uri "$Base/terminals/$($term.id)/activation-code" -Method POST -Headers $oh -ContentType "application/json"

Write-Host "`n=== J. Terminal state (pre-activation) ==="
Write-Host "  id=$($term.id)"
Write-Host "  isActive=$($term.isActive)"
Write-Host "  isRegistered=$($term.isRegistered)"
Write-Host "  activationCode=$($act.activationCodeDisplay)  raw=$($act.activationCode)"

@{
  terminalId = $term.id
  activationCode = $act.activationCode
  activationCodeDisplay = $act.activationCodeDisplay
  shotDir = $ShotDir
  preparedAt = (Get-Date).ToUniversalTime().ToString("o")
  note = "Do NOT run db:seed until walkthrough complete. Activate manually on emulator, then EMP003/3333 with keyboard Done."
} | ConvertTo-Json | Set-Content "$ShotDir\session.json"

Write-Host "`n=== K. READY FOR MANUAL WALKTHROUGH ==="
Write-Host "  1. Dismiss Expo dev overlay if shown"
Write-Host "  2. Entry -> Set Up Restaurant Device"
Write-Host "  3. Enter code: $($act.activationCodeDisplay) -> keyboard Enter"
Write-Host "  4. Operational login: EMP003 / 3333 -> keyboard Done on PIN"
Write-Host '  5. Confirm KDS board NEW | PREPARING | READY'
Write-Host ""
Write-Host "Session: $ShotDir\session.json"
Write-Host "Procedure: docs/validation/step10-kds-human/PROCEDURE.md"
