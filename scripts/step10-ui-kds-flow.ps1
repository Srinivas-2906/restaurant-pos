# Step 10.1 KDS UI flow — full Android walkthrough + screenshots
$ErrorActionPreference = "Stop"
$ShotDir = "c:\Users\kanas\Kaana-foods\docs\validation\step10-kds"
$Base = "http://localhost:4000/api"
$OrgId = "cmselugbk0000u978y0qjuzqq"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$CaptainTerminalId = "cmtpu13b5004uu92s5rht3ml4"
$CaptainSecret = "kaana-dev-captain-01-secret"
$PosTerminalId = "cmtpu1368004qu92shslo1n1k"
$PosSecret = "kaana-dev-pos-01-secret"
$script:OrderId = $null
$script:KotIds = @()

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

function Shot($n) {
  New-Item -ItemType Directory -Force -Path $ShotDir | Out-Null
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
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  try {
    for ($i = 0; $i -lt 8; $i++) {
      adb shell uiautomator dump /sdcard/ui.xml | Out-Null
      $raw = adb shell cat /sdcard/ui.xml 2>$null
      if ($raw -and $raw -match "hierarchy") {
        return ($raw -replace '&amp;','&' -replace '&quot;','"' -replace '&lt;','<' -replace '&gt;','>')
      }
      Wait 3
    }
    throw "uiautomator dump failed after retries"
  } finally {
    $ErrorActionPreference = $prev
  }
}
function ScreenHas($fragment) { (UiDump) -match [regex]::Escape($fragment) }
function WaitForScreen($fragment, $timeoutSec = 40) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (ScreenHas $fragment) { Write-Host "[screen] $fragment"; return $true }
    Wait 2
  }
  throw "Timed out waiting for: $fragment"
}
function TapText($label) {
  $xml = UiDump
  $escaped = [regex]::Escape($label)
  foreach ($pat in @(
    "text=`"$escaped`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`"",
    "content-desc=`"$escaped`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`""
  )) {
    $m = [regex]::Match($xml, $pat)
    if ($m.Success) {
      Tap ([int](([int]$m.Groups[1].Value + [int]$m.Groups[3].Value) / 2)) ([int](([int]$m.Groups[2].Value + [int]$m.Groups[4].Value) / 2))
      return $true
    }
  }
  Write-Host "[warn] TapText not found: $label"
  return $false
}
function TapByDesc($label) {
  if (TapText $label) { return $true }
  $xml = UiDump
  $escaped = [regex]::Escape($label)
  $pat = "content-desc=`"$escaped`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`""
  if ($xml -match $pat) {
    Tap ([int](([int]$Matches[1] + [int]$Matches[3]) / 2)) ([int](([int]$Matches[2] + [int]$Matches[4]) / 2))
    return $true
  }
  return $false
}
function DismissGoogleSetup {
  $xml = UiDump
  if ($xml -match "Sign in with ease" -or $xml -match 'text="SKIP"') {
    TapText "SKIP" | Out-Null; if (-not $?) { Tap 120 2280 }; Wait 2
  }
}
function DismissDevMenu {
  $xml = UiDump
  if ($xml -match "React Native Dev Menu" -or $xml -match "Reload") {
    adb shell input keyevent 4 | Out-Null
    Wait 2
    Write-Host "[dismiss] dev-menu-back"
  }
}
function DismissOverlays {
  DismissGoogleSetup
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  for ($i = 0; $i -lt 5; $i++) {
    $xml = UiDump
    if ($xml -match "Android App Compatibility") {
      if (-not (TapText "OK")) { Tap 540 2213 }
      Wait 2
      Write-Host "[dismiss] android-compat"
      continue
    }
    DismissDevMenu
    if ($xml -match "This is the developer menu" -or $xml -match "Connected to:") {
      TapText "Continue" | Out-Null; if (-not $?) { Tap 540 1780 }; Wait 2
      Write-Host "[dismiss] dev-onboarding"
    }
    if ($xml -match "Set Up Restaurant Device" -or $xml -match "Kaana KDS" -or $xml -match "Employee ID") { break }
    Wait 3
  }
  $ErrorActionPreference = $prev
}
function FillActivationCode($code) {
  if (-not (TapText "ABCD-1234")) { Tap 540 430 }
  Wait 1; ClearField; InputText $code; Wait 1; HideKeyboard
}
function FillEmployeeLogin($employeeCode, $pin) {
  if (-not (TapText "EMP001")) { Tap 540 571 }
  Wait 1; ClearField
  adb shell input text $employeeCode.ToLower() | Out-Null
  Wait 1
  if (-not (TapText "••••")) { Tap 540 800 }
  Wait 1; ClearField; InputDigits $pin; HideKeyboard
}
function ActivateAndLogin($activationCode, $employeeCode, $pin) {
  WaitForScreen "Set Up Restaurant Device" 60 | Out-Null
  TapText "Set Up Restaurant Device" | Out-Null; if (-not $?) { Tap 540 680 }
  Wait 4
  WaitForScreen "Activate This Device" 20 | Out-Null
  FillActivationCode $activationCode
  TapText "Activate Device" | Out-Null; if (-not $?) { Tap 540 620 }
  Wait 12; DismissOverlays
  WaitForScreen "Employee ID" 30 | Out-Null
  FillEmployeeLogin $employeeCode $pin
  TapText "Sign In" | Out-Null; if (-not $?) { Tap 540 760 }
  Wait 15; DismissOverlays
  WaitForScreen "Kaana KDS" 40 | Out-Null
}
function TryDeniedLogin($employeeCode, $pin) {
  TapText "Switch Employee" | Out-Null; if (-not $?) { Tap 980 120 }
  Wait 4
  FillEmployeeLogin $employeeCode $pin
  TapText "Sign In" | Out-Null; if (-not $?) { Tap 540 760 }
  Wait 6
  if (ScreenHas "Employee ID" -or ScreenHas "Sign In") {
    Write-Host "[auth] $employeeCode denied as expected"
    return $true
  }
  throw "$employeeCode was not denied on KDS device"
}
function ClearLiveOrders($headers) {
  $live = Invoke-RestMethod -Uri "$Base/orders/live?outletId=$OutletId" -Headers $headers
  foreach ($o in $live.orders) {
    try {
      Invoke-RestMethod -Uri "$Base/orders/$($o.id)/cancel" -Method POST -Headers $headers -Body (@{ reason = "step10-ui-reset" } | ConvertTo-Json) -ContentType "application/json" | Out-Null
    } catch { }
  }
}
function CaptainPin() {
  $auth = "Terminal ${CaptainTerminalId}:${CaptainSecret}"
  $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $auth }
  $emp = $staff | Where-Object { $_.employeeCode -eq "EMP002" } | Select-Object -First 1
  return Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $auth } -Body (@{ staffProfileId = $emp.id; pin = "2222" } | ConvertTo-Json) -ContentType "application/json"
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
function KdsHeaders() {
  $auth = "Terminal cmtpu138o004su92sw5o46nf6:kaana-dev-kds-01-secret"
  $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $auth }
  $chef = $staff | Where-Object { $_.employeeCode -eq "EMP003" } | Select-Object -First 1
  $pin = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $auth } -Body (@{ staffProfileId = $chef.id; pin = "3333" } | ConvertTo-Json) -ContentType "application/json"
  return @{ Authorization = "Bearer $($pin.accessToken)" }
}

New-Item -ItemType Directory -Force -Path $ShotDir | Out-Null
adb reverse tcp:8081 tcp:8081 | Out-Null
adb reverse tcp:4000 tcp:4000 | Out-Null

$owner = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body (@{ email = "owner@kaanafoods.in"; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
$oh = @{ Authorization = "Bearer $($owner.accessToken)" }
ClearLiveOrders $oh

$existing = Invoke-RestMethod -Uri "$Base/terminals" -Headers $oh
$uiTerm = $existing | Where-Object { $_.name -eq "STEP10-UI-KDS" } | Select-Object -First 1
if (-not $uiTerm) {
  $uiTerm = Invoke-RestMethod -Uri "$Base/terminals" -Method POST -Headers $oh -Body (@{
    outletId = $OutletId; name = "STEP10-UI-KDS"; deviceType = "kds"
  } | ConvertTo-Json) -ContentType "application/json"
}
$act = Invoke-RestMethod -Uri "$Base/terminals/$($uiTerm.id)/activation-code" -Method POST -Headers $oh -ContentType "application/json"
Write-Host "STEP10-UI-KDS activation: $($act.activationCodeDisplay)"

Write-Host "=== Launch + activate ==="
adb shell pm clear in.kaanafoods.mobile | Out-Null
LaunchApp; Wait 40
1..10 | ForEach-Object { DismissOverlays; Wait 3 }
WaitForScreen "Set Up Restaurant Device" 90 | Out-Null
ActivateAndLogin $act.activationCode "EMP003" "3333"
WaitForScreen "NEW" 20 | Out-Null
Shot "01-empty-kds"

Write-Host "=== Wrong employees ==="
TryDeniedLogin "EMP001" "1111" | Out-Null
TryDeniedLogin "EMP002" "2222" | Out-Null
TapText "Switch Employee" | Out-Null; Wait 3
FillEmployeeLogin "EMP004" "4444"
TapText "Sign In" | Out-Null; Wait 12
WaitForScreen "Kaana KDS" 25 | Out-Null
Shot "08-employee-switch"
TapText "Switch Employee" | Out-Null; Wait 3
FillEmployeeLogin "EMP003" "3333"
TapText "Sign In" | Out-Null; Wait 12
WaitForScreen "Kaana KDS" 25 | Out-Null

Write-Host "=== Captain -> KDS ==="
$fire = FireCaptainTable2Order $oh
Write-Host "Order $($script:OrderId) kots=$($script:KotIds.Count)"
Wait 8
if (-not (ScreenHas "Chicken Biryani")) { TapByDesc "Refresh" | Out-Null; Wait 6 }
WaitForScreen "Chicken Biryani" 25 | Out-Null
Shot "02-new-ticket"

Write-Host "=== Start Preparing (one KOT) ==="
TapByDesc "Start Preparing" | Out-Null
Wait 8
WaitForScreen "PREPARING" 25 | Out-Null
Shot "03-preparing"

Write-Host "=== Partial Ready (one KOT only) ==="
TapByDesc "Mark Ready" | Out-Null
Wait 8
WaitForScreen "READY" 25 | Out-Null
$kh = KdsHeaders
$oPartial = Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)" -Headers $kh
Write-Host "Partial orderStatus=$($oPartial.status)"
Shot "04-partial-ready"

Write-Host "=== Full Ready (remaining KOTs) ==="
while (TapByDesc "Start Preparing") { Wait 4 }
while (TapByDesc "Mark Ready") { Wait 4 }
Wait 8
TapByDesc "Refresh" | Out-Null; Wait 4
Shot "05-ready"

Write-Host "=== Second KOT ==="
$ch = @{ Authorization = "Bearer $((CaptainPin).accessToken)" }
$naan = MenuItem $ch "Butter Naan"
Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)/items" -Method POST -Headers $ch -Body (@{ menuItemId = $naan.id; quantity = 2 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)/kot" -Method POST -Headers $ch -ContentType "application/json" | Out-Null
Wait 8
TapByDesc "Refresh" | Out-Null; Wait 4
Shot "06-second-kot"

Write-Host "=== POS -> KDS takeaway ==="
$posAuth = "Terminal ${PosTerminalId}:${PosSecret}"
$posStaff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $posAuth }
$cashier = $posStaff | Where-Object { $_.employeeCode -eq "EMP001" } | Select-Object -First 1
$pos = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $posAuth } -Body (@{ staffProfileId = $cashier.id; pin = "1111" } | ConvertTo-Json) -ContentType "application/json"
$ph = @{ Authorization = "Bearer $($pos.accessToken)" }
$paneer = MenuItem $ph "Paneer Butter Masala"
$naan2 = MenuItem $ph "Butter Naan"
$orderB = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $ph -Body (@{ outletId = $OutletId; type = "takeaway"; source = "pos" } | ConvertTo-Json) -ContentType "application/json"
Invoke-RestMethod -Uri "$Base/orders/$($orderB.id)/items" -Method POST -Headers $ph -Body (@{ menuItemId = $paneer.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($orderB.id)/items" -Method POST -Headers $ph -Body (@{ menuItemId = $naan2.id; quantity = 2 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($orderB.id)/kot" -Method POST -Headers $ph -ContentType "application/json" | Out-Null
Wait 8; TapByDesc "Refresh" | Out-Null; Wait 4
Shot "07-pos-ticket"

Write-Host "=== Cancellation ==="
Invoke-RestMethod -Uri "$Base/orders/$($orderB.id)/cancel" -Method POST -Headers $oh -Body (@{ reason = "step10-ui-cancel" } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Wait 6; TapByDesc "Refresh" | Out-Null; Wait 4
$queue = Invoke-RestMethod -Uri "$Base/kds/outlets/$OutletId/queue" -Headers $kh
$ghost = @($queue | Where-Object { $_.order.id -eq $orderB.id })
Write-Host "Ghost tickets after cancel=$($ghost.Count) (expect 0)"

Write-Host "=== Revocation ==="
Invoke-RestMethod -Uri "$Base/terminals/$($uiTerm.id)/revoke" -Method POST -Headers $oh -ContentType "application/json" | Out-Null
Wait 6
LaunchApp; Wait 12
Shot "09-revoked-device"

Write-Host "=== Restart (KDS-01) ==="
$act2 = Invoke-RestMethod -Uri "$Base/terminals/cmtpu138o004su92sw5o46nf6/activation-code" -Method POST -Headers $oh -ContentType "application/json"
adb shell pm clear in.kaanafoods.mobile | Out-Null
LaunchApp; Wait 20
1..4 | ForEach-Object { DismissOverlays; Wait 2 }
ActivateAndLogin $act2.activationCode "EMP003" "3333"
adb shell am force-stop in.kaanafoods.mobile | Out-Null
Wait 2
LaunchApp; Wait 15
if (ScreenHas "Employee ID" -or ScreenHas "Sign In") {
  Write-Host "[restart] terminal persisted, employee session cleared"
} else {
  throw "Expected employee PIN screen after restart"
}

Write-Host "=== Final service loop ==="
ClearLiveOrders $oh
$fireFinal = FireCaptainTable2Order $oh
$kh = KdsHeaders
$q = Invoke-RestMethod -Uri "$Base/kds/outlets/$OutletId/queue" -Headers $kh | Where-Object { $_.order.id -eq $script:OrderId }
foreach ($k in $q) {
  if ($k.status -eq "pending") { Invoke-RestMethod -Uri "$Base/kds/kot/$($k.id)/preparing" -Method PATCH -Headers $kh | Out-Null }
  Invoke-RestMethod -Uri "$Base/kds/kot/$($k.id)/ready" -Method PATCH -Headers $kh | Out-Null
}
$oFinal = Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)" -Headers $kh
foreach ($item in @($oFinal.items | Where-Object { $_.status -eq "ready" })) {
  Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)/items/$($item.id)/served" -Method PATCH -Headers (@{ Authorization = "Bearer $((CaptainPin).accessToken)" }) -ContentType "application/json" | Out-Null
}
Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)/request-bill" -Method POST -Headers (@{ Authorization = "Bearer $((CaptainPin).accessToken)" }) -ContentType "application/json" | Out-Null
$oBill = Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)" -Headers $ph
$settle = Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)/settle" -Method POST -Headers $ph -Body (@{
  payments = @(@{ method = "cash"; amount = [decimal]$oBill.totalAmount })
} | ConvertTo-Json -Depth 5) -ContentType "application/json"
Write-Host "FINAL OrderId=$($script:OrderId) status=$($settle.order.status) invoice=$($settle.invoice.id)"

ClearLiveOrders $oh
Write-Host "Step 10.1 KDS UI walkthrough complete."
