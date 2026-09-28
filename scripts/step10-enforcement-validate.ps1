# Step 10.1 - KDS capability enforcement validation
$ErrorActionPreference = "Stop"
$Base = "http://localhost:4000/api"
$OrgId = "cmselugbk0000u978y0qjuzqq"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$KdsTerminalId = "cmtpu138o004su92sw5o46nf6"
$KdsSecret = "kaana-dev-kds-01-secret"
$KdsAuth = "Terminal ${KdsTerminalId}:${KdsSecret}"

function Login($email) {
  Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body (@{ email = $email; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
}
function KdsPin() {
  $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $KdsAuth }
  $chef = $staff | Where-Object { $_.employeeCode -eq "EMP003" } | Select-Object -First 1
  return Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $KdsAuth } -Body (@{ staffProfileId = $chef.id; pin = "3333" } | ConvertTo-Json) -ContentType "application/json"
}
function Expect-Status($label, $scriptBlock, $expectedCode) {
  try {
    & $scriptBlock | Out-Null
    Write-Host "$label -> ALLOWED (unexpected)"
    return $false
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq $expectedCode) {
      Write-Host "$label -> $code (expected)"
      return $true
    }
    Write-Host "$label -> $code (unexpected)"
    return $false
  }
}

Write-Host "=== KDS capability enforcement (CAPABILITY_ENFORCEMENT=true) ==="
$admin = Login "admin@kaanafoods.in"
$adminH = @{ Authorization = "Bearer $($admin.accessToken)" }
$chef = KdsPin
$kh = @{ Authorization = "Bearer $($chef.accessToken)" }

$menu = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/menu" -Headers $kh
$biryani = $null
foreach ($m in $menu) { foreach ($c in $m.categories) { $biryani = $c.items | Where-Object { $_.name -like "*Biryani*" } | Select-Object -First 1; if ($biryani) { break } } if ($biryani) { break } }
$capAuth = "Terminal cmtpu13b5004uu92s5rht3ml4:kaana-dev-captain-01-secret"
$capStaff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $capAuth }
$capEmp = $capStaff | Where-Object { $_.employeeCode -eq "EMP002" } | Select-Object -First 1
$cap = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $capAuth } -Body (@{ staffProfileId = $capEmp.id; pin = "2222" } | ConvertTo-Json) -ContentType "application/json"
$ch = @{ Authorization = "Bearer $($cap.accessToken)" }
$floor = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $ch
$t2 = $floor.tables | Where-Object { $_.number -eq "2" } | Select-Object -First 1
$order = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $ch -Body (@{ outletId = $OutletId; type = "dine_in"; source = "captain"; tableId = $t2.id; guestCount = 2 } | ConvertTo-Json) -ContentType "application/json"
Invoke-RestMethod -Uri "$Base/orders/$($order.id)/items" -Method POST -Headers $ch -Body (@{ menuItemId = $biryani.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
$fire = Invoke-RestMethod -Uri "$Base/orders/$($order.id)/kot" -Method POST -Headers $ch -ContentType "application/json"
$kotId = ($fire.kots | Select-Object -First 1).id
if (-not $kotId) { throw "No KOT created for enforcement test" }
Write-Host "Test order=$($order.id) kot=$kotId"

Write-Host "`n--- Disable KDS module ---"
$off = @{ moduleOverrides = @(@{ moduleKey = "kds"; enabled = $false }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers $adminH -Body $off -ContentType "application/json" | Out-Null
$caps = (Invoke-RestMethod -Uri "$Base/capabilities/me" -Headers $kh).data
Write-Host "capabilities.me kds=$($caps.modules.kds)"

$ok = $true
$ok = (Expect-Status "Queue GET" { Invoke-RestMethod -Uri "$Base/kds/outlets/$OutletId/queue" -Headers $kh } 403) -and $ok
$ok = (Expect-Status "Start Preparing" { Invoke-RestMethod -Uri "$Base/kds/kot/$kotId/preparing" -Method PATCH -Headers $kh } 403) -and $ok
$ok = (Expect-Status "Mark Ready" { Invoke-RestMethod -Uri "$Base/kds/kot/$kotId/ready" -Method PATCH -Headers $kh } 403) -and $ok

Write-Host "`n--- Restore KDS + verify data intact ---"
$on = @{ moduleOverrides = @(@{ moduleKey = "kds"; inherit = $true }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers $adminH -Body $on -ContentType "application/json" | Out-Null
$queue = Invoke-RestMethod -Uri "$Base/kds/outlets/$OutletId/queue" -Headers $kh
Write-Host "Queue restored tickets=$($queue.Count)"
Invoke-RestMethod -Uri "$Base/orders/$($order.id)/cancel" -Method POST -Headers (@{ Authorization = "Bearer $((Login 'owner@kaanafoods.in').accessToken)" }) -Body (@{ reason = "step10-enforcement-reset" } | ConvertTo-Json) -ContentType "application/json" | Out-Null

if (-not $ok) { throw "KDS capability enforcement failed" }
Write-Host "`nStep 10.1 enforcement validation passed."
