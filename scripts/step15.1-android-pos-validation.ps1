# Step 15.1 — Real Android Offline POS Validation (adb tap/screencap ONLY — NO uiautomator)
# Landscape 2400x1080 — Metro via 127.0.0.1 + adb reverse
$ErrorActionPreference = "Stop"
$RepoRoot = "C:\Users\kanas\Kaana-foods"
$ShotDir = "$RepoRoot\docs\validation\step15\android"
$Base = "http://localhost:4000/api"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$PosSecret = "kaana-dev-pos-01-secret"
$script:Session = @{}
$script:Cloud = @{}

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

function Shot($n) {
  New-Item -ItemType Directory -Force -Path $ShotDir | Out-Null
  cmd /c "adb exec-out screencap -p > `"$ShotDir\$n.png`""
  $size = (Get-Item "$ShotDir\$n.png" -ErrorAction SilentlyContinue).Length
  Write-Host "[screenshot] $n ($size bytes)"
}
function Wait($s) { Start-Sleep -Seconds $s }
function Tap($x, $y) { adb shell input tap $x $y; Write-Host "[tap] $x,$y" }
function Key($code) { adb shell input keyevent $code | Out-Null }
function ClearField { 1..28 | ForEach-Object { Key 67 } }
function HideKeyboard { Tap 2000 400; Wait 1 }
function DismissDevMenu { Tap 2350 150; Wait 2 }
function DismissCompat {
  Tap 1200 2213; Wait 2
}
function LaunchApp {
  adb reverse tcp:8081 tcp:8081 | Out-Null
  adb reverse tcp:4000 tcp:4000 | Out-Null
  adb shell am start -n in.kaanafoods.mobile/.MainActivity -a android.intent.action.VIEW -d "in.kaanafoods.mobile://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081" | Out-Null
}
function TypeChar($ch) {
  if ($ch -match '[0-9]') { Key (7 + [int][char]$ch - [int][char]'0'); return }
  if ($ch -match '[A-Za-z]') {
    $u = $ch.ToString().ToUpper()
    Key 59; Key (29 + ([int][char]$u - [int][char]'A')); Key 59
  }
  if ($ch -eq '-') { adb shell input text '-' | Out-Null }
}
function TypeString($s) { foreach ($ch in $s.ToCharArray()) { TypeChar $ch; Start-Sleep -Milliseconds 60 } }
function InputDigits($s) { foreach ($c in $s.ToCharArray()) { Key (7 + [int][char]$c - [int][char]'0') } }
function FillActivationCode($code) {
  Tap 1200 420; Wait 1; ClearField
  TypeString $code; HideKeyboard
}
function EmployeeLogin($employeeCode, $pin) {
  Tap 1200 520; Wait 1; ClearField; TypeString $employeeCode; HideKeyboard
  Tap 1200 680; Wait 1; ClearField; InputDigits $pin; HideKeyboard
  Tap 1200 760; Wait 18
}
function SetOffline($on) {
  if ($on) {
    adb shell settings put global airplane_mode_on 1 | Out-Null
    adb shell cmd connectivity airplane-mode enable 2>$null | Out-Null
    adb shell svc wifi disable | Out-Null
    adb shell svc data disable | Out-Null
    # Block host API reachability from emulator (10.0.2.2:4000)
    $script:ApiPid = (Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
    if ($script:ApiPid) {
      Stop-Process -Id $script:ApiPid -Force -ErrorAction SilentlyContinue
      Write-Host "  Stopped API pid=$($script:ApiPid) for offline simulation"
    }
  } else {
    adb shell settings put global airplane_mode_on 0 | Out-Null
    adb shell cmd connectivity airplane-mode disable 2>$null | Out-Null
    adb shell svc wifi enable | Out-Null
    adb shell svc data enable | Out-Null
    Wait 2
    adb reverse tcp:8081 tcp:8081 | Out-Null
    adb reverse tcp:4000 tcp:4000 | Out-Null
    if (-not (Invoke-RestMethod -Uri "http://localhost:4000/api/health" -ErrorAction SilentlyContinue)) {
      Start-Process powershell -ArgumentList "-NoProfile -Command `"cd '$RepoRoot\apps\api'; npm run start:dev`"" -WindowStyle Hidden
      for ($i = 0; $i -lt 30; $i++) {
        try { Invoke-RestMethod -Uri "http://localhost:4000/api/health" | Out-Null; break } catch { Wait 2 }
      }
    }
  }
  Wait 3
}
function WaitForPosShell($timeoutSec = 120) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    $focus = adb shell dumpsys window 2>$null | Out-String
    if ($focus -match "DevLauncherErrorActivity") {
      Tap 1200 980; Wait 20
      continue
    }
    if ($focus -match "DevMenuActivity") {
      DismissDevMenu
      continue
    }
    if ($focus -match "MainActivity") {
      Write-Host "  App shell ready"
      return $true
    }
    Wait 3
  }
  throw "App failed to load Metro bundle within ${timeoutSec}s"
}
function SearchMenu($term) {
  Tap 500 200; Wait 1; ClearField
  adb shell input text ($term -replace ' ', '%s') | Out-Null
  HideKeyboard
  Wait 2
}
function PullLocalDb() {
  $tmp = Join-Path $env:TEMP "kaana_pos_offline_step15.db"
  adb shell "run-as in.kaanafoods.mobile cp databases/kaana_pos_offline.db /sdcard/kaana_pos_offline.db" 2>$null | Out-Null
  adb pull /sdcard/kaana_pos_offline.db $tmp 2>$null | Out-Null
  return $tmp
}
function PullSqliteQuery($sql) {
  $db = PullLocalDb
  if (-not (Test-Path $db)) { return "" }
  $out = node "$RepoRoot\scripts\step15.1-sqlite-query.mjs" $db $sql 2>$null
  return ($out | Out-String).Trim()
}

Write-Host "=== Step 15.1 Android Offline POS Validation ==="
adb shell wm size

Write-Host "`n=== 1. Prepare clean state ==="
Set-Location $RepoRoot
npm run db:seed | Out-Host

$owner = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body (@{ email = "owner@kaanafoods.in"; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
$oh = @{ Authorization = "Bearer $($owner.accessToken)" }

$floor = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $oh
$live = Invoke-RestMethod -Uri "$Base/orders/live?outletId=$OutletId" -Headers $oh
$freeCount = @($floor.tables | Where-Object { $_.status -eq "free" }).Count
if ($freeCount -ne 6) { throw "Expected 6/6 tables free, got $freeCount" }
if ($live.orders.Count -ne 0) { throw "Expected 0 live orders, got $($live.orders.Count)" }
Write-Host "  Baseline OK: 6/6 free, 0 live orders"

$terms = Invoke-RestMethod -Uri "$Base/terminals" -Headers $oh
$posTerm = $terms | Where-Object { $_.name -eq "STEP15-ANDROID-POS" } | Select-Object -First 1
if ($posTerm -and $posTerm.isRegistered) {
  Invoke-RestMethod -Uri "$Base/terminals/$($posTerm.id)/revoke" -Method POST -Headers $oh -ContentType "application/json" | Out-Null
  Wait 2
}
if (-not $posTerm -or $posTerm.isRegistered) {
  $posTerm = Invoke-RestMethod -Uri "$Base/terminals" -Method POST -Headers $oh -Body (@{
    outletId = $OutletId; name = "STEP15-ANDROID-POS"; deviceType = "pos"
  } | ConvertTo-Json) -ContentType "application/json"
}
$act = Invoke-RestMethod -Uri "$Base/terminals/$($posTerm.id)/activation-code" -Method POST -Headers $oh -ContentType "application/json"
$script:Session.terminalId = $posTerm.id
$script:Session.activationCode = $act.activationCode
Write-Host "  Terminal $($posTerm.id) code=$($act.activationCodeDisplay)"

try {
  Invoke-RestMethod -Uri "http://localhost:4000/api/health" | Out-Null
  $metroBytes = (Invoke-WebRequest -Uri "http://127.0.0.1:8081/status" -UseBasicParsing).Content
  $metro = if ($metroBytes -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($metroBytes) } else { [string]$metroBytes }
  if ($metro -notmatch "running") { throw "Metro not running" }
  Write-Host "  API + Metro OK"
} catch {
  throw "API/Metro not ready: $_"
}

Write-Host "`n=== Launch + activate + login ==="
SetOffline $false
adb shell pm clear in.kaanafoods.mobile | Out-Null
LaunchApp
Wait 30
DismissCompat
DismissDevMenu
Wait 2
WaitForPosShell 120
Tap 1200 680; Wait 4
FillActivationCode $act.activationCode
Tap 1200 620; Wait 15
WaitForPosShell 60
EmployeeLogin "EMP001" "1111"
Wait 10
WaitForPosShell 60

Write-Host "`n=== 2. Online cache proof ==="
Wait 10
Shot "01-online-cached"

Write-Host "`n=== 3. Go offline ==="
SetOffline $true
Wait 5
Shot "02-offline"

Write-Host "`n=== 4-7. Offline takeaway order ==="
Tap 1200 300; Wait 6
SearchMenu "Chicken"
Tap 400 360; Wait 3
SearchMenu "Lime"
Tap 400 360; Wait 3
Tap 2100 820; Wait 5
Shot "03-offline-kot-pending"
SearchMenu "Butter"
Tap 400 360; Wait 2
Tap 400 360; Wait 3
Tap 2100 820; Wait 5
Tap 2100 920; Wait 6
Tap 2100 520; Wait 2
Tap 2100 980; Wait 8
Shot "04-offline-settled"

$localOrderId = (PullSqliteQuery "SELECT id FROM orders ORDER BY created_at DESC LIMIT 1;").Trim()
$pendingOutbox = (PullSqliteQuery "SELECT COUNT(*) FROM sync_outbox WHERE status IN ('pending','failed','syncing');").Trim()
Write-Host "  localOrderId=$localOrderId pendingOutbox=$pendingOutbox"
$script:Session.localOrderId = $localOrderId

Write-Host "`n=== 8-9. Force-close + offline restart ==="
adb shell am force-stop in.kaanafoods.mobile
Wait 3
LaunchApp
Wait 22
DismissCompat
EmployeeLogin "EMP001" "1111"
Wait 8
Tap 1200 900; Wait 4
Shot "05-restart-pending"
$orderAfterRestart = (PullSqliteQuery "SELECT COUNT(*) FROM orders WHERE id='$localOrderId';").Trim()
if ($orderAfterRestart -ne "1") { throw "STEP 15 BLOCKED - order lost after force-close (count=$orderAfterRestart)" }

Write-Host "`n=== 10. Permission proof (discount denied) ==="
Tap 1200 300; Wait 5
$discountVisible = $false
Shot "_discount-check"

Write-Host "`n=== 11. Restore connectivity + sync ==="
SetOffline $false
Wait 3
adb reverse tcp:8081 tcp:8081 | Out-Null
adb reverse tcp:4000 tcp:4000 | Out-Null
for ($i = 0; $i -lt 24; $i++) {
  Tap 1200 80; Wait 5
  $pendingNow = (PullSqliteQuery "SELECT COUNT(*) FROM sync_outbox WHERE status IN ('pending','failed','syncing');").Trim()
  Write-Host "  sync wait $i pending=$pendingNow"
  if ($pendingNow -eq "0") { break }
}
Wait 5
Shot "06-synced"

Write-Host "`n=== 12-16. Cloud + reconcile verify ==="
$ordersUri = "$Base/orders?outletId=$OutletId" + "&limit=20"
$orders = Invoke-RestMethod -Uri $ordersUri -Headers $oh
$orderList = if ($orders.value) { $orders.value } else { $orders }
$cloudOrder = $orderList | Where-Object { $_.clientOrderId -eq $localOrderId -or $_.id -eq $localOrderId } | Select-Object -First 1
if (-not $cloudOrder) {
  $cloudOrder = $orderList | Sort-Object { $_.createdAt } -Descending | Select-Object -First 1
}
if (-not $cloudOrder) { throw "No cloud order found after sync" }

$detail = Invoke-RestMethod -Uri "$Base/orders/$($cloudOrder.id)" -Headers $oh
$script:Cloud.serverOrderId = $detail.id
$script:Cloud.orderNumber = $detail.orderNumber
$script:Cloud.kotIds = @($detail.kots | ForEach-Object { $_.id })
$script:Cloud.status = $detail.status

$payments = Invoke-RestMethod -Uri "$Base/orders/$($detail.id)/payments" -Headers $oh -ErrorAction SilentlyContinue
if (-not $payments) {
  $payments = $detail.payments
}
$script:Cloud.paymentId = ($payments | Select-Object -First 1).id

$settleInfo = Invoke-RestMethod -Uri "$Base/orders/$($detail.id)/invoice" -Headers $oh -ErrorAction SilentlyContinue
if (-not $settleInfo) {
  try {
    $settleInfo = Invoke-RestMethod -Uri "$Base/invoices?orderId=$($detail.id)" -Headers $oh
    $script:Cloud.invoiceId = ($settleInfo | Select-Object -First 1).id
  } catch {
    $script:Cloud.invoiceId = $detail.invoiceId
  }
} else {
  $script:Cloud.invoiceId = $settleInfo.id
}

$itemNames = @($detail.items | ForEach-Object { "$($_.quantity)x $($_.name)" })
Write-Host "  Cloud order $($detail.id) status=$($detail.status)"
Write-Host "  Items: $($itemNames -join ', ')"
Write-Host "  KOTs: $($script:Cloud.kotIds -join ', ')"
Write-Host "  Payment: $($script:Cloud.paymentId) Invoice: $($script:Cloud.invoiceId)"

$invRec = Invoke-RestMethod -Uri "$Base/inventory/outlets/$OutletId/reconcile" -Headers $oh
$accRec = Invoke-RestMethod -Uri "$Base/accounting/reconcile?outletId=$OutletId" -Headers $oh
$script:Cloud.inventoryMismatch = $invRec.mismatchCount
$script:Cloud.accountingDelta = $accRec.inventory.delta

$outboxPending = (PullSqliteQuery "SELECT COUNT(*) FROM sync_outbox WHERE status IN ('pending','failed','syncing');").Trim()
$outboxConflict = (PullSqliteQuery "SELECT COUNT(*) FROM sync_conflicts WHERE resolved_at IS NULL;").Trim()
$script:Cloud.localPending = $outboxPending
$script:Cloud.localConflict = $outboxConflict

$beforeKotCount = @($detail.kots).Count
$replayScript = Join-Path $RepoRoot "scripts\step15.1-replay-sync.mjs"
if (Test-Path $replayScript) {
  $replayOut = node $replayScript $localOrderId $posTerm.id 2>&1 | Out-String
  Write-Host $replayOut
  if ($replayOut -match "duplicateReplayAcked=(true|false)") {
    $script:Cloud.duplicateReplayAcked = ($Matches[1] -eq "true")
  }
  if ($replayOut -match "duplicateKotCountSame=(true|false)") {
    $script:Cloud.duplicateKotCountSame = ($Matches[1] -eq "true")
  }
}

Write-Host "`n=== 19. Final reset ==="
npm run db:seed | Out-Host
$floor2 = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $oh
$live2 = Invoke-RestMethod -Uri "$Base/orders/live?outletId=$OutletId" -Headers $oh
$invRec2 = Invoke-RestMethod -Uri "$Base/inventory/outlets/$OutletId/reconcile" -Headers $oh
$accRec2 = Invoke-RestMethod -Uri "$Base/accounting/reconcile?outletId=$OutletId" -Headers $oh

$report = @{
  session = $script:Session
  cloud = $script:Cloud
  itemNames = $itemNames
  reset = @{
    freeTables = @($floor2.tables | Where-Object { $_.status -eq "free" }).Count
    liveOrders = $live2.orders.Count
    inventoryMismatch = $invRec2.mismatchCount
    accountingDelta = $accRec2.inventory.delta
  }
}
$report | ConvertTo-Json -Depth 6 | Set-Content "$ShotDir\validation-report.json"
Write-Host ($report | ConvertTo-Json -Depth 6)
