# Step 9.1 Captain UI flow — UIAutomator taps + verified screen transitions
$ErrorActionPreference = "Stop"
$ShotDir = "c:\Users\kanas\Kaana-foods\docs\validation\step9-ui"
$Base = "http://localhost:4000/api"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$TerminalId = "cmtq1yagt0005u9i0x8d5ph4o"
$orderId = $null

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

function Shot($n) {
  cmd /c "adb exec-out screencap -p > `"$ShotDir\$n.png`""
  Write-Host "[screenshot] $n"
}
function Wait($s) { Start-Sleep -Seconds $s }
function Tap($x, $y) { adb shell input tap $x $y; Write-Host "[tap] $x,$y" }
function InputText($t) { adb shell input text $t }
function ClearField { 1..24 | ForEach-Object { adb shell input keyevent 67 | Out-Null } }
function HideKeyboard { adb shell input keyevent 111 | Out-Null; Wait 1 }
function InputDigits($s) {
  foreach ($c in $s.ToCharArray()) {
    adb shell input keyevent (7 + [int][char]$c - [int][char]'0') | Out-Null
  }
}
function LaunchApp {
  adb shell am start -n in.kaanafoods.mobile/.MainActivity -a android.intent.action.VIEW -d "in.kaanafoods.mobile://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081" | Out-Null
}

function UiDump {
  adb shell uiautomator dump /sdcard/ui.xml 2>$null | Out-Null
  $raw = adb shell cat /sdcard/ui.xml
  return ($raw -replace '&amp;','&' -replace '&quot;','"' -replace '&lt;','<' -replace '&gt;','>')
}

function TapByDesc($label) {
  if (TapContentDesc $label) { return $true }
  return TapText $label
}

function ScreenHas($fragment) {
  $xml = UiDump
  return $xml -match [regex]::Escape($fragment)
}

function WaitForOrderScreen($timeoutSec = 25) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (ScreenHas "Search menu" -or ScreenHas "Tap items to start order" -or ScreenHas "Send to Kitchen") {
      Write-Host "[screen] order view ready"
      return $true
    }
    Wait 2
  }
  throw "Timed out waiting for Captain order screen"
}

function ClearOutletOrders($headers) {
  $floor = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $headers
  foreach ($t in $floor.tables) {
    if ($t.activeOrder) {
      try {
        Invoke-RestMethod -Uri "$Base/orders/$($t.activeOrder.id)/cancel" -Method POST -Headers $headers -Body (@{ reason = "step9-ui-reset" } | ConvertTo-Json) -ContentType "application/json" | Out-Null
        Write-Host "[reset] cancelled table $($t.number) order"
      } catch {
        Write-Host "[reset] could not cancel table $($t.number): $_"
      }
    }
  }
}

function WaitForScreen($fragment, $timeoutSec = 30) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (ScreenHas $fragment) {
      Write-Host "[screen] found: $fragment"
      return $true
    }
    Wait 2
  }
  throw "Timed out waiting for screen containing: $fragment"
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
  $escaped = [regex]::Escape($fragment)
  $patterns = @(
    'text="[^"]*' + $escaped + '[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
    'content-desc="[^"]*' + $escaped + '[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
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
  Write-Host "[warn] TapContains not found: $fragment"
  return $false
}

function TapContentDesc($desc) {
  $xml = UiDump
  $escaped = [regex]::Escape($desc)
  $patterns = @(
    'content-desc="' + $escaped + '"[^>]*clickable="true"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
    'clickable="true"[^>]*content-desc="' + $escaped + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
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
  Write-Host "[warn] TapContentDesc not found: $desc"
  return $false
}

function TapTable($num) {
  if (TapContentDesc "Table $num") { return $true }
  $coords = @{ "1" = @(270, 884); "2" = @(771, 884); "3" = @(270, 1050); "4" = @(771, 1050); "5" = @(270, 1220); "6" = @(771, 1220) }
  if ($coords.ContainsKey("$num")) {
    Tap $coords["$num"][0] $coords["$num"][1]
    return $true
  }
  return $false
}

function WaitForTableOrder($tableNum, $minItems, $timeoutSec = 45) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    $floor = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $oh
    $t = $floor.tables | Where-Object { $_.number -eq "$tableNum" } | Select-Object -First 1
    if ($t.activeOrder -and [int]$t.activeOrder.itemQty -ge $minItems) {
      Write-Host "[order] table $tableNum has $($t.activeOrder.itemQty) items id=$($t.activeOrder.id)"
      return $t.activeOrder.id
    }
    Wait 2
  }
  throw "Table $tableNum order with $minItems items not created"
}

function DismissGoogleSetup {
  $xml = UiDump
  if ($xml -match "Sign in with ease" -or $xml -match 'text="SKIP"') {
    TapText "SKIP" | Out-Null
    if (-not $?) { Tap 120 2280 }
    Wait 2
    Write-Host "[dismiss] google-setup"
  }
}

function DismissOverlays {
  DismissGoogleSetup
  $xml = UiDump
  if ($xml -match "Android App Compatibility") { Tap 800 2213; Wait 1; Tap 540 2213; Wait 1; Write-Host "[dismiss] compat" }
  if ($xml -match "This is the developer menu" -or $xml -match "Connected to:") {
    TapText "Continue" | Out-Null
    if (-not $?) { Tap 540 1780 }
    Wait 2
    Write-Host "[dismiss] dev-onboarding"
  }
  if ($xml -match "Connected to:" -and $xml -match "Reload") {
    adb shell input keyevent 4 | Out-Null
    Wait 2
    Write-Host "[dismiss] dev-menu"
  }
}

function SearchMenu($term) {
  Tap 540 688
  Wait 1
  Tap 540 688
  Wait 1
  ClearField
  InputText $term
  Wait 1
  HideKeyboard
  Wait 2
}

function EnsureInApp {
  $xml = UiDump
  if ($xml -notmatch 'package="in.kaanafoods.mobile"') {
    Write-Host "[recover] leaving system UI"
    1..3 | ForEach-Object { adb shell input keyevent 4 | Out-Null; Wait 1 }
    LaunchApp
    Wait 10
    DismissOverlays
  }
}

function TapCategory($name) {
  if (TapContains $name) { return $true }
  $fallbacks = @{
    "Rice & Biryani" = @(800, 400)
    "Beverages"      = @(950, 400)
  }
  if ($fallbacks.ContainsKey($name)) {
    Tap $fallbacks[$name][0] $fallbacks[$name][1]
    return $true
  }
  return $false
}

function FillActivationCode($code) {
  if (-not (TapText "ABCD-1234")) { Tap 540 430 }
  Wait 1
  ClearField
  InputText $code
  Wait 1
  HideKeyboard
}

function TapEditText($hintFragment) {
  $xml = UiDump
  $pat = 'class="android.widget.EditText"[^>]*hint="' + [regex]::Escape($hintFragment) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
  $m = [regex]::Match($xml, $pat)
  if (-not $m.Success) {
    $pat = 'hint="' + [regex]::Escape($hintFragment) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
    $m = [regex]::Match($xml, $pat)
  }
  if ($m.Success) {
    $x = [int](([int]$m.Groups[1].Value + [int]$m.Groups[3].Value) / 2)
    $y = [int](([int]$m.Groups[2].Value + [int]$m.Groups[4].Value) / 2)
    Tap $x $y
    return $true
  }
  return $false
}

function FillEmployeeLogin($employeeCode, $pin) {
  if (-not (TapEditText "EMP001")) { Tap 540 571 }
  Wait 1
  ClearField
  InputText $employeeCode.ToLower()
  Wait 1
  if (-not (TapEditText "••••")) { Tap 540 800 }
  Wait 1
  ClearField
  InputDigits $pin
  Wait 1
  HideKeyboard
}

New-Item -ItemType Directory -Force -Path $ShotDir | Out-Null
adb reverse tcp:8081 tcp:8081 | Out-Null
adb reverse tcp:4000 tcp:4000 | Out-Null

$owner = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body (@{ email = "owner@kaanafoods.in"; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
$oh = @{ Authorization = "Bearer $($owner.accessToken)" }
$act = Invoke-RestMethod -Uri "$Base/terminals/$TerminalId/activation-code" -Method POST -Headers $oh -ContentType "application/json"
$ActivationCode = $act.activationCode
Write-Host "Activation: $($act.activationCodeDisplay) ($ActivationCode)"
ClearOutletOrders $oh

Write-Host "=== Launch + activate + captain login ==="
adb shell pm clear in.kaanafoods.mobile | Out-Null
LaunchApp
Wait 25
1..5 | ForEach-Object { DismissOverlays; DismissGoogleSetup; Wait 3 }
WaitForScreen "Set Up Restaurant Device" 60 | Out-Null
Shot "01-entry"

if (-not (TapText "Set Up Restaurant Device")) { Tap 540 680 }
Wait 4
WaitForScreen "Activate This Device" 20 | Out-Null
Shot "06-activation"

FillActivationCode $ActivationCode
if (-not (TapText "Activate Device")) { Tap 540 620 }
Wait 12
DismissOverlays
WaitForScreen "Employee ID" 30 | Out-Null
Shot "07-pin-login"

FillEmployeeLogin "EMP002" "2222"
if (-not (TapText "Sign In")) { Tap 540 760 }
Wait 15
DismissOverlays
WaitForScreen "Tables" 30 | Out-Null
Shot "08-captain-tables"

Write-Host "=== Table 2 order ==="
TapTable 2 | Out-Null
Wait 10
DismissOverlays
EnsureInApp
WaitForOrderScreen 25 | Out-Null
Shot "09-captain-menu"
TapByDesc "Rice & Biryani" | Out-Null; if (-not $?) { Tap 740 821 }
Wait 3
TapByDesc "Add Chicken Biryani" | Out-Null; if (-not $?) { Tap 800 1040 }
Wait 4
TapByDesc "Add Chicken Biryani" | Out-Null; if (-not $?) { Tap 800 1040 }
Wait 4
$orderId = WaitForTableOrder "2" 2
Shot "10-cart-note"
EnsureInApp
TapByDesc "Send to Kitchen" | Out-Null; if (-not $?) { Tap 540 2080 }
Wait 12
DismissOverlays
EnsureInApp
Shot "11-after-kot"
WaitForScreen "Tables" 25 | Out-Null
Shot "12-table-kitchen"

Write-Host "=== Second KOT ==="
TapTable 2 | Out-Null
Wait 10
DismissOverlays
EnsureInApp
WaitForOrderScreen 20 | Out-Null
Tap 740 821
Wait 2
adb shell input swipe 540 1400 540 900 400 | Out-Null
Wait 2
TapByDesc "Add Plain Rice" | Out-Null; if (-not $?) { Tap 280 1200 }
Wait 4
WaitForTableOrder "2" 3 | Out-Null
EnsureInApp
TapByDesc "Send to Kitchen" | Out-Null; if (-not $?) { Tap 540 2080 }
Wait 12
DismissOverlays
EnsureInApp
Shot "13-second-kot"
WaitForScreen "Tables" 25 | Out-Null

$PosTerminalId = "cmtpu1368004qu92shslo1n1k"
$PosSecret = "kaana-dev-pos-01-secret"
$KdsTerminalId = "cmtpu138o004su92sw5o46nf6"
$KdsSecret = "kaana-dev-kds-01-secret"
$PosAuth = "Terminal ${PosTerminalId}:${PosSecret}"
$KdsAuth = "Terminal ${KdsTerminalId}:${KdsSecret}"

$floor = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $oh
$t2 = $floor.tables | Where-Object { $_.number -eq "2" } | Select-Object -First 1
if (-not $t2.activeOrder) { throw "Table 2 has no active order after Captain UI walkthrough" }
if (-not $orderId) { $orderId = $t2.activeOrder.id }
$order = Invoke-RestMethod -Uri "$Base/orders/$orderId" -Headers $oh
$biryaniItem = $order.items | Where-Object { $_.name -like "*Biryani*" } | Select-Object -First 1
Write-Host "OrderId=$orderId items=$($order.items.Count) kots=$($order.kots.Count) note=$($biryaniItem.notes)"

Write-Host "=== POS + KDS + settle ==="
$posStaff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $PosAuth }
$cashier = $posStaff | Where-Object { $_.employeeCode -eq "EMP001" } | Select-Object -First 1
$pos = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $PosAuth } -Body (@{ staffProfileId = $cashier.id; pin = "1111" } | ConvertTo-Json) -ContentType "application/json"
$ph = @{ Authorization = "Bearer $($pos.accessToken)" }
$menu = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/menu" -Headers $ph
$rice = $null
foreach ($m in $menu) { foreach ($c in $m.categories) { $rice = $c.items | Where-Object { $_.name -like "*Plain Rice*" } | Select-Object -First 1; if ($rice) { break } } if ($rice) { break } }
Invoke-RestMethod -Uri "$Base/orders/$orderId/items" -Method POST -Headers $ph -Body (@{ menuItemId = $rice.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Wait 4
TapTable 2 | Out-Null
Wait 10
EnsureInApp
WaitForOrderScreen 15 | Out-Null
Shot "14-pos-added-rice"

$kdsStaff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $KdsAuth }
$chef = $kdsStaff | Where-Object { $_.employeeCode -eq "EMP003" } | Select-Object -First 1
$chefPin = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $KdsAuth } -Body (@{ staffProfileId = $chef.id; pin = "3333" } | ConvertTo-Json) -ContentType "application/json"
$kh = @{ Authorization = "Bearer $($chefPin.accessToken)" }
$o = Invoke-RestMethod -Uri "$Base/orders/$orderId" -Headers $oh
foreach ($kot in $o.kots) { Invoke-RestMethod -Uri "$Base/kds/kot/$($kot.id)/ready" -Method PATCH -Headers $kh -ContentType "application/json" | Out-Null }
Wait 4
Shot "15-ready-tables"
TapTable 2 | Out-Null
Wait 10
WaitForOrderScreen 15 | Out-Null
WaitForScreen "Ready" 15 | Out-Null
Shot "16-ready-order-serve"
TapText "Served" | Out-Null; if (-not $?) { Tap 900 420 }
Wait 4
Shot "17-served-item"
TapText "Request Bill" | Out-Null; if (-not $?) { Tap 540 2280 }
Wait 4
DismissOverlays
Shot "18-bill-requested"
TapContains "Tables" | Out-Null; if (-not $?) { Tap 120 130 }
Wait 4

$oSettle = Invoke-RestMethod -Uri "$Base/orders/$orderId" -Headers $ph
Invoke-RestMethod -Uri "$Base/orders/$orderId/settle" -Method POST -Headers $ph -Body (@{ payments = @(@{ method = "cash"; amount = [decimal]$oSettle.totalAmount }) } | ConvertTo-Json -Depth 5) -ContentType "application/json" | Out-Null
Wait 4
Shot "19-table-free-after-settle"

Write-Host "=== Restart + revoke ==="
adb shell am force-stop in.kaanafoods.mobile
LaunchApp
Wait 15
DismissOverlays
WaitForScreen "Employee ID" 30 | Out-Null
Shot "20-restart-pin-login"
Invoke-RestMethod -Uri "$Base/terminals/$TerminalId/revoke" -Method POST -Headers $oh -ContentType "application/json" | Out-Null
adb shell am force-stop in.kaanafoods.mobile
LaunchApp
Wait 15
DismissOverlays
WaitForScreen "Set Up Restaurant Device" 30 | Out-Null
Shot "21-revoked-device"

Write-Host "Captain UI flow complete. OrderId=$orderId"
