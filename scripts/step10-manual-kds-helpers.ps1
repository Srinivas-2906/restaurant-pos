# Step 10.2 manual KDS helpers — adb tap/screencap only (NO uiautomator)
$ErrorActionPreference = "Stop"
$ShotDir = "C:\Users\kanas\Kaana-foods\docs\validation\step10-kds"
$Base = "http://localhost:4000/api"
$OrgId = "cmselugbk0000u978y0qjuzqq"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$CaptainTerminalId = "cmtpu13b5004uu92s5rht3ml4"
$CaptainSecret = "kaana-dev-captain-01-secret"
$PosTerminalId = "cmtpu1368004qu92shslo1n1k"
$PosSecret = "kaana-dev-pos-01-secret"

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

function Shot($n) {
  New-Item -ItemType Directory -Force -Path $ShotDir | Out-Null
  cmd /c "adb exec-out screencap -p > `"$ShotDir\$n.png`""
  Write-Host "[screenshot] $n"
}
function Wait($s) { Start-Sleep -Seconds $s }
function Tap($x, $y) { adb shell input tap $x $y; Write-Host "[tap] $x,$y" }
function Key($code) { adb shell input keyevent $code | Out-Null }
function ClearField { 1..24 | ForEach-Object { Key 67 } }
function HideKeyboard { Key 111; Wait 1 }
function InputText($t) { adb shell input text $t }
function InputDigits($s) {
  foreach ($c in $s.ToCharArray()) {
    Key (7 + [int][char]$c - [int][char]'0')
  }
}
function LaunchApp {
  adb shell am start -n in.kaanafoods.mobile/.MainActivity -a android.intent.action.VIEW -d "in.kaanafoods.mobile://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081" | Out-Null
}
function DismissOverlays {
  Key 4; Wait 1
  Tap 1200 950; Wait 1
  Tap 1200 850; Wait 1
}
function FillActivationCode($code) {
  Tap 1200 430; Wait 1; ClearField
  InputText $code; HideKeyboard
}
function FillEmployeeLogin($employeeCode, $pin) {
  Tap 1200 520; Wait 1; ClearField
  InputText $employeeCode.ToLower()
  Wait 1
  Tap 1200 680; Wait 1; ClearField
  InputDigits $pin; HideKeyboard
}
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
  return @{ order = $order; fire = $fire }
}
function PosPin {
  $auth = "Terminal ${PosTerminalId}:${PosSecret}"
  $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $auth }
  $cashier = $staff | Where-Object { $_.employeeCode -eq "EMP001" } | Select-Object -First 1
  return Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $auth } -Body (@{ staffProfileId = $cashier.id; pin = "1111" } | ConvertTo-Json) -ContentType "application/json"
}

Export-ModuleMember -Function * -ErrorAction SilentlyContinue
