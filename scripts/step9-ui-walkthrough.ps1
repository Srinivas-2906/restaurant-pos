# Step 9.1 Android Captain UI walkthrough (UIAutomator + coordinates)
$ErrorActionPreference = "Continue"
$ShotDir = "c:\Users\kanas\Kaana-foods\docs\validation\step9-ui"
$Base = "http://localhost:4000/api"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$TerminalId = "cmtq1yagt0005u9i0x8d5ph4o"

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

function Shot($n) {
  $path = Join-Path $ShotDir "$n.png"
  cmd /c "adb exec-out screencap -p > `"$path`""
  Write-Host "[screenshot] $n"
}
function Wait($s) { Start-Sleep -Seconds $s }
function Tap($x, $y) { adb shell input tap $x $y; Write-Host "[tap] $x,$y" }
function InputText($t) { adb shell input text $t }
function InputDigits($s) {
  foreach ($c in $s.ToCharArray()) {
    adb shell input keyevent (7 + [int][char]$c - [int][char]'0') | Out-Null
  }
}
function HideKeyboard { adb shell input keyevent 111 | Out-Null; Wait 1 }
function Back { adb shell input keyevent 4 }
function ClearField { 1..24 | ForEach-Object { adb shell input keyevent 67 | Out-Null } }
function LaunchApp { adb shell am start -a android.intent.action.VIEW -d "in.kaanafoods.mobile://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081" | Out-Null }

function UiDump {
  adb shell uiautomator dump /sdcard/ui.xml 2>$null | Out-Null
  adb shell cat /sdcard/ui.xml
}

function DismissCompatDialog {
  $xml = UiDump
  if ($xml -match "Android App Compatibility") {
    Tap 800 2213
    Wait 1
    Tap 540 2213
    Wait 1
    Write-Host "[dismiss] Android App Compatibility"
  }
  if ($xml -match "Render Error") {
    Tap 540 2100
    Wait 1
    Write-Host "[dismiss] Render Error overlay"
  }
}

function DismissDevClientOnboarding {
  $xml = UiDump
  if ($xml -match "developer menu" -or $xml -match "Kaana Mobile") {
    TapText "Continue" | Out-Null
    if (-not $?) { Tap 540 1780 }
    Wait 2
    Write-Host "[dismiss] Expo dev client onboarding"
  }
}

function TapText($label) {
  $xml = UiDump
  $escaped = [regex]::Escape($label)
  $patterns = @(
    "text=`"$escaped`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`"",
    "content-desc=`"$escaped`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`""
  )
  foreach ($pat in $patterns) {
    $m = [regex]::Match($xml, $pat)
    if ($m.Success) {
      $x = [int](([int]$m.Groups[1].Value + [int]$m.Groups[3].Value) / 2)
      $y = [int](([int]$m.Groups[2].Value + [int]$m.Groups[4].Value) / 2)
      Tap $x $y
      return $true
    }
  }
  Write-Host "[warn] TapText not found: $label"
  return $false
}

function TapContains($fragment) {
  $xml = UiDump
  $pat = 'text="[^"]*' + [regex]::Escape($fragment) + '[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
  $m = [regex]::Match($xml, $pat)
  if ($m.Success) {
    $x = [int](([int]$m.Groups[1].Value + [int]$m.Groups[3].Value) / 2)
    $y = [int](([int]$m.Groups[2].Value + [int]$m.Groups[4].Value) / 2)
    Tap $x $y
    return $true
  }
  Write-Host "[warn] TapContains not found: $fragment"
  return $false
}

function TapTable($num) {
  if (TapText "Table $num") { return }
  # fallback grid: right column row1 = table 2 at ~810,220
  $coords = @{ "1" = @(270,200); "2" = @(810,200); "3" = @(270,360); "4" = @(810,360); "5" = @(270,520); "6" = @(810,520) }
  if ($coords.ContainsKey("$num")) {
    Tap $coords["$num"][0] $coords["$num"][1]
  }
}

New-Item -ItemType Directory -Force -Path $ShotDir | Out-Null
adb reverse tcp:8081 tcp:8081 | Out-Null
adb reverse tcp:4000 tcp:4000 | Out-Null

$owner = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body (@{ email = "owner@kaanafoods.in"; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
$oh = @{ Authorization = "Bearer $($owner.accessToken)" }

$act = Invoke-RestMethod -Uri "$Base/terminals/$TerminalId/activation-code" -Method POST -Headers $oh -ContentType "application/json"
$ActivationCode = $act.activationCode
Write-Host "Activation code: $($act.activationCodeDisplay) ($ActivationCode)"

Write-Host "`n=== 1. Fresh launch + Entry ==="
adb shell pm clear in.kaanafoods.mobile | Out-Null
LaunchApp
Wait 20
DismissCompatDialog
DismissDevClientOnboarding
Wait 5
DismissCompatDialog
Shot "01-entry"
if (-not (TapText "Owner / Manager Sign In")) { Tap 540 480 }
Wait 1
Back
Wait 1
if (-not (TapText "Set Up Restaurant Device")) { Tap 540 580 }
Wait 2
Back
Wait 2
Shot "01-entry-buttons"

Write-Host "`n=== 2. Owner smoke ==="
if (-not (TapText "Owner / Manager Sign In")) { Tap 540 480 }
Wait 4
DismissCompatDialog
Shot "02-owner-login"
Tap 540 400; ClearField; InputText "owner%@kaanafoods.in"; adb shell input keyevent 61; Wait 1
Tap 540 500; ClearField; InputText "password123"; Wait 1
TapText "Sign In" | Out-Null; if (-not $?) { Tap 540 620 }
Wait 10
Shot "03-management-home"
Tap 270 2280; Wait 3; Shot "03b-orders-tab"
Tap 540 2280; Wait 3; Shot "03c-inventory-tab"
Tap 675 2280; Wait 3; Shot "03d-money-tab"
Tap 810 2280; Wait 3; Shot "04-management-more"
TapText "Log Out" | Out-Null; if (-not $?) { Tap 540 1900 }
Wait 5
Shot "05-after-logout"

Write-Host "`n=== 3. Device activation ==="
if (-not (TapText "Set Up Restaurant Device")) { Tap 540 580 }
Wait 4
Shot "06-activation"
Tap 540 430; ClearField; InputText $ActivationCode; Wait 1
TapText "Activate Device" | Out-Null; if (-not $?) { Tap 540 620 }
Wait 8
Shot "07-pin-login"

Write-Host "`n=== 4. PIN matrix ==="
Tap 540 430; ClearField; InputText "EMP003"; Wait 1
Tap 540 530; ClearField; InputDigits "3333"; HideKeyboard; Wait 1
TapText "Sign In" | Out-Null; if (-not $?) { Tap 540 680 }
Wait 4
Shot "07b-emp003-denied"

Tap 540 430; ClearField; InputText "EMP004"; Wait 1
Tap 540 530; ClearField; InputDigits "4444"; HideKeyboard; Wait 1
TapText "Sign In" | Out-Null; if (-not $?) { Tap 540 680 }
Wait 8
Shot "07c-emp004-tables"
Back; Wait 2; TapText "Sign In" | Out-Null; if (-not $?) { Tap 540 680 }; Wait 3

Tap 540 430; ClearField; InputText "EMP002"; Wait 1
Tap 540 530; ClearField; InputDigits "2222"; HideKeyboard; Wait 1
TapText "Sign In" | Out-Null; if (-not $?) { Tap 540 680 }
Wait 8
Shot "08-captain-tables"

Write-Host "`n=== 5. Table 2 order ==="
TapTable 2
Wait 6
Shot "09-captain-menu"
TapContains "Biryani" | Out-Null; if (-not $?) { Tap 270 900 }
Wait 3
TapContains "Biryani" | Out-Null; if (-not $?) { Tap 270 1100 }
Wait 2
TapText "Note" | Out-Null; if (-not $?) { Tap 400 350 }
Wait 2
Tap 540 1600; Wait 1
InputText "Less%sspicy"; Wait 1
TapText "Save" | Out-Null; if (-not $?) { Tap 540 1200 }
Wait 2
Shot "10-cart-note"
TapContains "Send to Kitchen" | Out-Null; if (-not $?) { Tap 540 2280 }
Wait 8
Shot "11-after-kot"
TapText "Tables" | Out-Null; if (-not $?) { Tap 100 120 }
Wait 5
Shot "12-table-kitchen"

Write-Host "`n=== 6. Second KOT ==="
TapTable 2
Wait 5
TapContains "Soda" | Out-Null; if (-not $?) { Tap 750 1200 }
Wait 2
TapContains "Send to Kitchen" | Out-Null; if (-not $?) { Tap 540 2280 }
Wait 8
Shot "13-second-kot"
TapText "Tables" | Out-Null; if (-not $?) { Tap 100 120 }
Wait 4

$PosTerminalId = "cmtpu1368004qu92shslo1n1k"
$PosSecret = "kaana-dev-pos-01-secret"
$KdsTerminalId = "cmtpu138o004su92sw5o46nf6"
$KdsSecret = "kaana-dev-kds-01-secret"
$PosAuth = "Terminal ${PosTerminalId}:${PosSecret}"
$KdsAuth = "Terminal ${KdsTerminalId}:${KdsSecret}"

$floor = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $oh
$t2 = $floor.tables | Where-Object { $_.number -eq "2" } | Select-Object -First 1
if (-not $t2.activeOrder) { throw "Table 2 has no active order after Captain UI walkthrough" }
$orderId = $t2.activeOrder.id
$order = Invoke-RestMethod -Uri "$Base/orders/$orderId" -Headers $oh
Write-Host "OrderId=$orderId KOTs=$($order.kots.Count) Items=$($order.items.Count)"
$biryani = $order.items | Where-Object { $_.name -like "*Biryani*" } | Select-Object -First 1
Write-Host "Note=$($biryani.notes)"

Write-Host "`n=== 7. POS adds item + ready ==="
$posStaff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $PosAuth }
$cashier = $posStaff | Where-Object { $_.employeeCode -eq "EMP001" } | Select-Object -First 1
$pos = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $PosAuth } -Body (@{ staffProfileId = $cashier.id; pin = "1111" } | ConvertTo-Json) -ContentType "application/json"
$ph = @{ Authorization = "Bearer $($pos.accessToken)" }
$menu = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/menu" -Headers $ph
$rice = $null
foreach ($m in $menu) { foreach ($c in $m.categories) { $rice = $c.items | Where-Object { $_.name -like "*Plain Rice*" } | Select-Object -First 1; if ($rice) { break } } if ($rice) { break } }
Invoke-RestMethod -Uri "$Base/orders/$orderId/items" -Method POST -Headers $ph -Body (@{ menuItemId = $rice.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Wait 3
TapTable 2
Wait 5
Shot "14-pos-added-rice"

$kdsStaff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $KdsAuth }
$chef = $kdsStaff | Where-Object { $_.employeeCode -eq "EMP003" } | Select-Object -First 1
$chefPin = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $KdsAuth } -Body (@{ staffProfileId = $chef.id; pin = "3333" } | ConvertTo-Json) -ContentType "application/json"
$kh = @{ Authorization = "Bearer $($chefPin.accessToken)" }
$o = Invoke-RestMethod -Uri "$Base/orders/$orderId" -Headers $oh
foreach ($kot in $o.kots) {
  Invoke-RestMethod -Uri "$Base/kds/kot/$($kot.id)/ready" -Method PATCH -Headers $kh -ContentType "application/json" | Out-Null
}
Wait 3
TapText "Tables" | Out-Null; if (-not $?) { Tap 100 120 }
Wait 5
Shot "15-ready-tables"
TapTable 2
Wait 5
Shot "16-ready-order-serve"
TapText "Served" | Out-Null; if (-not $?) { Tap 900 400 }
Wait 4
Shot "17-served-item"
TapText "Request Bill" | Out-Null; if (-not $?) { Tap 950 2280 }
Wait 4
Shot "18-bill-requested"
TapText "Tables" | Out-Null; if (-not $?) { Tap 100 120 }
Wait 4

Write-Host "`n=== 8. POS settle ==="
$oSettle = Invoke-RestMethod -Uri "$Base/orders/$orderId" -Headers $ph
Invoke-RestMethod -Uri "$Base/orders/$orderId/settle" -Method POST -Headers $ph -Body (@{ payments = @(@{ method = "cash"; amount = [decimal]$oSettle.totalAmount }) } | ConvertTo-Json -Depth 5) -ContentType "application/json" | Out-Null
Wait 4
TapText "Tables" | Out-Null; if (-not $?) { Tap 100 120 }
Wait 5
Shot "19-table-free-after-settle"

Write-Host "`n=== 9. App restart ==="
adb shell am force-stop in.kaanafoods.mobile
LaunchApp
Wait 15
DismissCompatDialog
DismissDevClientOnboarding
Wait 5
Shot "20-restart-pin-login"

Write-Host "`n=== 10. Revocation ==="
Invoke-RestMethod -Uri "$Base/terminals/$TerminalId/revoke" -Method POST -Headers $oh -ContentType "application/json" | Out-Null
Wait 2
adb shell am force-stop in.kaanafoods.mobile
LaunchApp
Wait 15
DismissCompatDialog
DismissDevClientOnboarding
Wait 5
Shot "21-revoked-device"

Write-Host "`nWalkthrough complete. OrderId=$orderId"
