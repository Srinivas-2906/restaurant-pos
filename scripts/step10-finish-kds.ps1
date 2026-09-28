# Step 10 finish — keyboard-only login; KDS via focus+Enter (no x/y automation)
$ErrorActionPreference = "Stop"
$ShotDir = "C:\Users\kanas\Kaana-foods\docs\validation\step10-kds-human"
$Base = "http://localhost:4000/api"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$script:OrderId = $null

$env:PATH = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:PATH"
New-Item -ItemType Directory -Force -Path $ShotDir | Out-Null

function Shot($n) { cmd /c "adb exec-out screencap -p > `"$ShotDir\$n.png`""; Write-Host "[shot] $n" }
function Wait($s) { Start-Sleep -Seconds $s }
function Key($c) { adb shell input keyevent $c | Out-Null }
function ClearField { 1..30 | ForEach-Object { Key 67 } }
function TypeChar($ch) {
  if ($ch -match '[0-9]') { Key (7 + [int][char]$ch - [int][char]'0'); return }
  if ($ch -match '[A-Za-z]') {
    $u = $ch.ToString().ToUpper(); Key 59; Key (29 + ([int][char]$u - [int][char]'A')); Key 59
  }
}
function TypeString($s) { foreach ($ch in $s.ToCharArray()) { TypeChar $ch; Start-Sleep -Milliseconds 90 } }
function InputDigits($s) { foreach ($c in $s.ToCharArray()) { Key (7 + [int][char]$c - [int][char]'0'); Start-Sleep -Milliseconds 90 } }
function LaunchApp($path = "") {
  adb reverse tcp:8081 tcp:8081 | Out-Null; adb reverse tcp:4000 tcp:4000 | Out-Null
  $url = "http%3A%2F%2F127.0.0.1%3A8081"; if ($path) { $url += "%2F--%2F$path" }
  adb shell am start -n in.kaanafoods.mobile/.MainActivity -a android.intent.action.VIEW `
    -d "in.kaanafoods.mobile://expo-development-client/?url=$url" | Out-Null
}
function KotStatus($orderId) {
  $owner = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body '{"email":"owner@kaanafoods.in","password":"password123"}' -ContentType "application/json"
  $oh = @{ Authorization = "Bearer $($owner.accessToken)" }
  return (Invoke-RestMethod -Uri "$Base/orders/$orderId" -Headers $oh).kots
}
function TryFocusActivate($maxTabs = 24) {
  for ($i = 0; $i -lt $maxTabs; $i++) { Key 61; Wait 0.25 }
  Key 66; Wait 0.5
  Key 23; Wait 0.5
}

# Run setup (creates terminal + session.json)
powershell -NoProfile -File "C:\Users\kanas\Kaana-foods\scripts\step10-human-kds-setup.ps1" | Out-Null
$session = Get-Content "$ShotDir\session.json" | ConvertFrom-Json
$code = $session.activationCode
$termId = $session.terminalId

adb shell settings put secure stylus_handwriting_enabled 0 2>$null | Out-Null

# Activate via deep link + Enter
LaunchApp "activate"; Wait 12
ClearField; TypeString $code; Wait 1; Key 66; Wait 18
$owner = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body '{"email":"owner@kaanafoods.in","password":"password123"}' -ContentType "application/json"
$oh = @{ Authorization = "Bearer $($owner.accessToken)" }
$reg = (Invoke-RestMethod -Uri "$Base/terminals" -Headers $oh | Where-Object { $_.id -eq $termId }).isRegistered
Write-Host "registered=$reg"
if (-not $reg) { throw "Activation failed" }

# Login: EMP003 + PIN + Enter/Done
LaunchApp "operational/login"; Wait 12
ClearField; TypeString "EMP003"; Wait 1
Key 61; Wait 1
ClearField; InputDigits "3333"; Wait 1
Key 66; Wait 25
Shot "01-kds-board"

# Captain order
$orderJson = powershell -NoProfile -File "C:\Users\kanas\Kaana-foods\scripts\step10-human-kds-orders.ps1" -Action table2 | ConvertFrom-Json
$script:OrderId = $orderJson.orderId
Write-Host "order=$($script:OrderId) kots=$($orderJson.kotNumbers -join ',')"
Wait 12; Shot "02-new"

# Start Preparing — focus navigation + Enter/DPAD center (no coordinates)
Write-Host "Start Preparing via focus+Enter..."
TryFocusActivate 30
Wait 12
Shot "03-preparing"
$kots = KotStatus $script:OrderId
$kots | ForEach-Object { Write-Host "  $($_.kotNumber)=$($_.status)" }
$prepCount = @($kots | Where-Object { $_.status -eq "preparing" }).Count

if ($prepCount -eq 0) {
  Write-Host "Retry Start Preparing focus cycle..."
  TryFocusActivate 40; Wait 12
  Shot "03-preparing-retry"
  $kots = KotStatus $script:OrderId
  $kots | ForEach-Object { Write-Host "  $($_.kotNumber)=$($_.status)" }
}

# Partial ready — one Mark Ready
Write-Host "Mark Ready (one) via focus+Enter..."
TryFocusActivate 30; Wait 12
Shot "04-partial-ready"
$kots = KotStatus $script:OrderId
$kots | ForEach-Object { Write-Host "  $($_.kotNumber)=$($_.status)" }

# Full ready — remaining
Write-Host "Mark Ready (remaining) via focus+Enter..."
TryFocusActivate 30; Wait 3
TryFocusActivate 30; Wait 12
Shot "05-ready"
$kots = KotStatus $script:OrderId
$kots | ForEach-Object { Write-Host "  $($_.kotNumber)=$($_.status)" }

# Captain check
$ch = @{ Authorization = "Terminal cmtpu13b5004uu92s5rht3ml4:kaana-dev-captain-01-secret" }
$staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers $ch
$emp = $staff | Where-Object { $_.employeeCode -eq "EMP002" } | Select-Object -First 1
$pin = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers $ch -Body (@{ staffProfileId = $emp.id; pin = "2222" } | ConvertTo-Json) -ContentType "application/json"
$captOrder = Invoke-RestMethod -Uri "$Base/orders/$($script:OrderId)" -Headers @{ Authorization = "Bearer $($pin.accessToken)" }
$readyItems = @($captOrder.items | Where-Object { $_.status -eq "ready" }).Count
Write-Host "Captain: order=$($captOrder.status) readyItems=$readyItems/$($captOrder.items.Count)"

# Second KOT
powershell -NoProfile -File "C:\Users\kanas\Kaana-foods\scripts\step10-human-kds-orders.ps1" -Action second-kot -OrderId $script:OrderId | Out-Null
Wait 12; Shot "06-second-kot"

$script:OrderId | Set-Content "$ShotDir\order-id.txt"
Write-Host "FINISH order=$($script:OrderId)"
