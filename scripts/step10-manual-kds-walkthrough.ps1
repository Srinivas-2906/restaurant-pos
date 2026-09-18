# Step 10.2 — Manual KDS Android walkthrough (adb tap/screencap ONLY — NO uiautomator)
# Landscape 2400x1080 — launch via 127.0.0.1 + adb reverse
$ErrorActionPreference = "Stop"
$ShotDir = "C:\Users\kanas\Kaana-foods\docs\validation\step10-kds"
$Base = "http://localhost:4000/api"
$OrgId = "cmselugbk0000u978y0qjuzqq"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$CaptainTerminalId = "cmtpu13b5004uu92s5rht3ml4"
$CaptainSecret = "kaana-dev-captain-01-secret"
$PosTerminalId = "cmtpu1368004qu92shslo1n1k"
$PosSecret = "kaana-dev-pos-01-secret"
$script:OrderId = $null
$script:KotIds = @()
$script:InvoiceId = $null

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
function ClearField { 1..24 | ForEach-Object { Key 67 } }
function HideKeyboard { Tap 2000 400; Wait 1 }
function DismissDevMenu { Tap 1680 320; Wait 2 }
function EnsureInApp {
  $f = adb shell dumpsys window 2>$null | Out-String
  if ($f -notmatch "in.kaanafoods.mobile") {
    1..3 | ForEach-Object { Key 4; Wait 1 }
    LaunchApp; Wait 12; DismissDevMenu; Wait 2
  }
}
function InputText($t) { adb shell input text $t }
function InputDigits($s) {
  foreach ($c in $s.ToCharArray()) {
    Key (7 + [int][char]$c - [int][char]'0')
  }
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
}
function TypeString($s) { foreach ($ch in $s.ToCharArray()) { TypeChar $ch; Start-Sleep -Milliseconds 80 } }
function FillActivationCode($code) {
  Tap 1200 420; Wait 1; ClearField
  TypeString $code; HideKeyboard
}
function EmployeeLogin($employeeCode, $pin) {
  Tap 1200 520; Wait 1; ClearField; TypeString $employeeCode; HideKeyboard
  Tap 1200 680; Wait 1; ClearField; InputDigits $pin; HideKeyboard
  Tap 1200 610; Wait 20
}
function FillEmployeeLogin($employeeCode, $pin) { EmployeeLogin $employeeCode $pin }
function OwnerLogin {
  Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body (@{ email = "owner@kaanafoods.in"; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
}
function ClearLiveOrders($headers) {
  $live = Invoke-RestMethod -Uri "$Base/orders/live?outletId=$OutletId" -Headers $headers
  foreach ($o in $live.orders) {
    try {
      Invoke-RestMethod -Uri "$Base/orders/$($o.id)/cancel" -Method POST -Headers $headers -Body (@{ reason = "step10-manual-reset" } | ConvertTo-Json) -ContentType "application/json" | Out-Null
    } catch { }
  }
}
function CaptainPin {
  $auth = "Terminal ${CaptainTerminalId}:${CaptainSecret}"
  $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $auth }
  $emp = $staff | Where-Object { $_.employeeCode -eq "EMP002" } | Select-Object -First 1
  return Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $auth } -Body (@{ staffProfileId = $emp.id; pin = "2222" } | ConvertTo-Json) -ContentType "application/json"
}
function PosPin {
  $auth = "Terminal ${PosTerminalId}:${PosSecret}"
  $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $auth }
  $cashier = $staff | Where-Object { $_.employeeCode -eq "EMP001" } | Select-Object -First 1
  return Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $auth } -Body (@{ staffProfileId = $cashier.id; pin = "1111" } | ConvertTo-Json) -ContentType "application/json"
}
function MenuItem($headers, $name) {
  $menu = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/menu" -Headers $headers
  foreach ($m in $menu) {
    foreach ($cat in $m.categories) {
      $item = $cat.items | Where-Object { $_.name -like "*$name*" } | Select-Object -First 1
      if ($item) { return $item }
    }
  }
  return $null
}
function FireCaptainTable2Order($headers) {
  $ch = @{ Authorization = "Bearer $((CaptainPin).accessToken)" }
  $floor = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $ch
  $t2 = $floor.tables | Where-Object { $_.number -eq "2" } | Select-Object -First 1
  $biryani = MenuItem $ch "Chicken Biryani"
  $soda = MenuItem $ch "Lime Soda"
  $order = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $ch -Body (@{
    outletId = $OutletId; type = "dine_in"; source = "captain"; tableId = $t2.id; guestCount = 2
  } | ConvertTo-Json) -ContentType "application/json"
  Invoke-RestMethod -Uri "$Base/orders/$($order.id)/items" -Method POST -Headers $ch -Body (@{ menuItemId = $biryani.id; quantity = 1; notes = "Less spicy" } | ConvertTo-Json) -ContentType "application/json" | Out-Null
  Invoke-RestMethod -Uri "$Base/orders/$($order.id)/items" -Method POST -Headers $ch -Body (@{ menuItemId = $soda.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
  $fire = Invoke-RestMethod -Uri "$Base/orders/$($order.id)/kot" -Method POST -Headers $ch -ContentType "application/json"
  $script:OrderId = $order.id
  $script:KotIds = @($fire.kots | ForEach-Object { $_.id })
  return $fire
}
function FireSecondKot($headers) {
  $ch = @{ Authorization = "Bearer $((CaptainPin).accessToken)" }
  $naan = MenuItem $ch "Butter Naan"
  Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)/items" -Method POST -Headers $ch -Body (@{ menuItemId = $naan.id; quantity = 2 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
  return Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)/kot" -Method POST -Headers $ch -ContentType "application/json"
}
function FirePosTakeaway($headers) {
  $ph = @{ Authorization = "Bearer $((PosPin).accessToken)" }
  $paneer = MenuItem $ph "Paneer Butter Masala"
  $order = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $ph -Body (@{
    outletId = $OutletId; type = "takeaway"; source = "pos"
  } | ConvertTo-Json) -ContentType "application/json"
  Invoke-RestMethod -Uri "$Base/orders/$($order.id)/items" -Method POST -Headers $ph -Body (@{ menuItemId = $paneer.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
  Invoke-RestMethod -Uri "$Base/orders/$($order.id)/kot" -Method POST -Headers $ph -ContentType "application/json" | Out-Null
  return $order
}

Write-Host "=== Step 10.2 Manual KDS Walkthrough (landscape) ==="
adb shell getprop sys.boot_completed | Out-Null
adb shell wm size

$owner = OwnerLogin
$oh = @{ Authorization = "Bearer $($owner.accessToken)" }
ClearLiveOrders $oh

$existing = Invoke-RestMethod -Uri "$Base/terminals" -Headers $oh
$manualTerm = $existing | Where-Object { $_.name -eq "STEP10-MANUAL-KDS" } | Select-Object -First 1
if ($manualTerm.isRegistered) {
  Invoke-RestMethod -Uri "$Base/terminals/$($manualTerm.id)/revoke" -Method POST -Headers $oh -ContentType "application/json" | Out-Null
  Wait 2
  $manualTerm = Invoke-RestMethod -Uri "$Base/terminals" -Method POST -Headers $oh -Body (@{
    outletId = $OutletId; name = "STEP10-MANUAL-KDS"; deviceType = "kds"
  } | ConvertTo-Json) -ContentType "application/json"
}
if (-not $manualTerm) {
  $manualTerm = Invoke-RestMethod -Uri "$Base/terminals" -Method POST -Headers $oh -Body (@{
    outletId = $OutletId; name = "STEP10-MANUAL-KDS"; deviceType = "kds"
  } | ConvertTo-Json) -ContentType "application/json"
}
$act = Invoke-RestMethod -Uri "$Base/terminals/$($manualTerm.id)/activation-code" -Method POST -Headers $oh -ContentType "application/json"
Write-Host "STEP10-MANUAL-KDS id=$($manualTerm.id) code=$($act.activationCodeDisplay) raw=$($act.activationCode)"

Write-Host "`n=== Launch + activate ==="
adb shell pm clear in.kaanafoods.mobile | Out-Null
LaunchApp
Wait 25
DismissDevMenu
Wait 3
EnsureInApp
Tap 1200 680; Wait 4
EnsureInApp
FillActivationCode $act.activationCode
Tap 1200 620; Wait 15
EnsureInApp
EmployeeLogin "EMP003" "3333"
Shot "01-kds-login"
EnsureInApp
Wait 5
Shot "02-empty-kds"

Write-Host "`n=== Captain order Table 2 ==="
$fire = FireCaptainTable2Order $oh
Write-Host "Order=$($script:OrderId) kots=$($script:KotIds -join ',')"
Wait 10
Tap 2200 120; Wait 2
Shot "03-new-ticket"

Write-Host "`n=== Start Preparing ==="
Tap 430 820; Wait 12
Shot "04-preparing"

Write-Host "`n=== Partial Ready (first KOT in PREPARING column) ==="
Tap 1230 820; Wait 12
Shot "05-partial-ready"

Write-Host "`n=== Full Ready (remaining KOTs) ==="
Tap 1230 820; Wait 5
Tap 430 820; Wait 3
Tap 1230 820; Wait 12
Shot "06-ready"

Write-Host "`n=== Second KOT ==="
$fire2 = FireSecondKot $oh
Write-Host "Second fire kots=$($fire2.kots.Count)"
Wait 10
Shot "07-second-kot"

Write-Host "`n=== POS takeaway ==="
$posOrder = FirePosTakeaway $oh
Write-Host "POS order=$($posOrder.id)"
Wait 10
Shot "08-pos-ticket"

Write-Host "`n=== Employee switch ==="
Tap 2350 80; Wait 4
FillEmployeeLogin "EMP004" "4444"
Tap 1200 760; Wait 12
Shot "09-employee-switch"
Tap 2350 80; Wait 4
FillEmployeeLogin "EMP001" "1111"
Tap 1200 760; Wait 6
Tap 2350 80; Wait 4
FillEmployeeLogin "EMP003" "3333"
Tap 1200 760; Wait 15

Write-Host "`n=== App restart ==="
adb shell am force-stop in.kaanafoods.mobile
Wait 2
LaunchApp; Wait 20
DismissDevMenu
Shot "09b-restart-pin"

Write-Host "`n=== Capability disable ==="
$admin = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body (@{ email = "admin@kaanafoods.in"; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
$adminH = @{ Authorization = "Bearer $($admin.accessToken)" }
$off = @{ moduleOverrides = @(@{ moduleKey = "kds"; enabled = $false }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers $adminH -Body $off -ContentType "application/json" | Out-Null
Wait 5
Tap 2200 120; Wait 3
Shot "09c-kds-disabled"
$on = @{ moduleOverrides = @(@{ moduleKey = "kds"; inherit = $true }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers $adminH -Body $on -ContentType "application/json" | Out-Null

Write-Host "`n=== Revoke terminal ==="
Invoke-RestMethod -Uri "$Base/terminals/$($manualTerm.id)/revoke" -Method POST -Headers $oh -ContentType "application/json" | Out-Null
Wait 5
LaunchApp; Wait 15
DismissDevMenu
Shot "10-revoked-device"

Write-Host "`n=== Captain served + POS settle ==="
$ch = @{ Authorization = "Bearer $((CaptainPin).accessToken)" }
$ph = @{ Authorization = "Bearer $((PosPin).accessToken)" }
$oFinal = Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)" -Headers $ch
foreach ($item in @($oFinal.items | Where-Object { $_.status -eq "ready" })) {
  Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)/items/$($item.id)/served" -Method PATCH -Headers $ch -ContentType "application/json" | Out-Null
}
Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)/request-bill" -Method POST -Headers $ch -ContentType "application/json" | Out-Null
$oSettle = Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)" -Headers $ph
$settle = Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)/settle" -Method POST -Headers $ph -Body (@{
  payments = @(@{ method = "cash"; amount = [decimal]$oSettle.totalAmount })
} | ConvertTo-Json -Depth 5) -ContentType "application/json"
$script:InvoiceId = $settle.invoiceId

Write-Host "`n=== Summary ==="
Write-Host "OrderId=$($script:OrderId)"
Write-Host "KotIds=$($script:KotIds -join ',')"
Write-Host "InvoiceId=$($script:InvoiceId)"
Write-Host "Step 10.2 manual walkthrough complete."
