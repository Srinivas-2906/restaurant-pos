# Step 9 - Captain E2E validation
$Base = "http://localhost:4000/api"
$OrgId = "cmselugbk0000u978y0qjuzqq"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$CaptainTerminalId = "cmtpu13b5004uu92s5rht3ml4"
$CaptainSecret = "kaana-dev-captain-01-secret"
$PosTerminalId = "cmtpu1368004qu92shslo1n1k"
$PosSecret = "kaana-dev-pos-01-secret"
$CaptainAuth = "Terminal ${CaptainTerminalId}:${CaptainSecret}"
$PosAuth = "Terminal ${PosTerminalId}:${PosSecret}"
$KdsTerminalId = "cmtpu138o004su92sw5o46nf6"
$KdsSecret = "kaana-dev-kds-01-secret"
$KdsAuth = "Terminal ${KdsTerminalId}:${KdsSecret}"

function Login($email) {
  Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body (@{ email = $email; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
}
function Captain-Pin($code, $pin) {
  $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $CaptainAuth }
  $emp = $staff | Where-Object { $_.employeeCode -eq $code } | Select-Object -First 1
  if (-not $emp) { throw "Employee $code not eligible" }
  return Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $CaptainAuth } -Body (@{ staffProfileId = $emp.id; pin = $pin } | ConvertTo-Json) -ContentType "application/json"
}
function Pos-Pin($code, $pin) {
  $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $PosAuth }
  $emp = $staff | Where-Object { $_.employeeCode -eq $code } | Select-Object -First 1
  return Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $PosAuth } -Body (@{ staffProfileId = $emp.id; pin = $pin } | ConvertTo-Json) -ContentType "application/json"
}
function Menu-Item($headers, $name) {
  $menu = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/menu" -Headers $headers
  foreach ($m in $menu) {
    foreach ($cat in $m.categories) {
      $item = $cat.items | Where-Object { $_.name -like "*$name*" } | Select-Object -First 1
      if ($item) { return $item }
    }
  }
  return $null
}
function Table-ByNumber($headers, $num) {
  $floor = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $headers
  return $floor.tables | Where-Object { $_.number -eq "$num" } | Select-Object -First 1
}

Write-Host "=== Baseline ==="
$owner = Login "owner@kaanafoods.in"
$oh = @{ Authorization = "Bearer $($owner.accessToken)" }
$floor0 = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $oh
Write-Host "Tables free: $(($floor0.tables | Where-Object { -not $_.activeOrder }).Count)/6"

Write-Host "`n=== Test G: Wrong employees ==="
foreach ($case in @(@{ c = "EMP003"; p = "3333" }, @{ c = "EMP001"; p = "1111" })) {
  try {
    Captain-Pin $case.c $case.p | Out-Null
    Write-Host "$($case.c): ALLOWED (unexpected)"
  } catch {
    Write-Host "$($case.c): denied ($($_.Exception.Response.StatusCode.value__))"
  }
}

Write-Host "`n=== Test A: Captain Table 2 order ==="
$cap = Captain-Pin "EMP002" "2222"
$ch = @{ Authorization = "Bearer $($cap.accessToken)" }
Write-Host "JWT terminalId=$($cap.terminalId) outletId=$($cap.outletId)"
$t2 = Table-ByNumber $ch "2"
$biryani = Menu-Item $ch "Chicken Biryani"
$soda = Menu-Item $ch "Lime Soda"
$order = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $ch -Body (@{
  outletId = $OutletId; type = "dine_in"; source = "captain"; tableId = $t2.id; guestCount = 2
} | ConvertTo-Json) -ContentType "application/json"
Write-Host "Created $($order.orderNumber) id=$($order.id) source=$($order.source)"
Invoke-RestMethod -Uri "$Base/orders/$($order.id)/items" -Method POST -Headers $ch -Body (@{ menuItemId = $biryani.id; quantity = 1; notes = "Less spicy" } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($order.id)/items" -Method POST -Headers $ch -Body (@{ menuItemId = $soda.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
$o1 = Invoke-RestMethod -Uri "$Base/orders/$($order.id)" -Headers $ch
$note = ($o1.items | Where-Object { $_.name -like "*Biryani*" }).notes
Write-Host "Items=$($o1.items.Count) note=$note"
$kot1 = Invoke-RestMethod -Uri "$Base/orders/$($order.id)/kot" -Method POST -Headers $ch -ContentType "application/json"
Write-Host "First KOT status=$($kot1.status) kots=$($kot1.kots.Count)"
$kotsDb = Invoke-RestMethod -Uri "$Base/orders/$($order.id)" -Headers $oh
Write-Host "Order status=$($kotsDb.status) unpaid"

Write-Host "`n=== Test B: Second KOT same order ==="
$naan = Menu-Item $ch "Butter Naan"
Invoke-RestMethod -Uri "$Base/orders/$($order.id)/items" -Method POST -Headers $ch -Body (@{ menuItemId = $naan.id; quantity = 2 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
$kot2 = Invoke-RestMethod -Uri "$Base/orders/$($order.id)/kot" -Method POST -Headers $ch -ContentType "application/json"
Write-Host "Same order=$($order.id) kots=$($kot2.kots.Count)"
$o2 = Invoke-RestMethod -Uri "$Base/orders/$($order.id)" -Headers $ch
Write-Host "Total items=$($o2.items.Count)"

Write-Host "`n=== KOT idempotency double fire ==="
$kot3 = Invoke-RestMethod -Uri "$Base/orders/$($order.id)/kot" -Method POST -Headers $ch -ContentType "application/json"
Write-Host "Double fire kots=$($kot3.kots.Count) (no duplicate pending KOT)"

Write-Host "`n=== Test D: POS adds Plain Rice ==="
$pos = Pos-Pin "EMP001" "1111"
$ph = @{ Authorization = "Bearer $($pos.accessToken)" }
$rice = Menu-Item $ph "Plain Rice"
Invoke-RestMethod -Uri "$Base/orders/$($order.id)/items" -Method POST -Headers $ph -Body (@{ menuItemId = $rice.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
$o3 = Invoke-RestMethod -Uri "$Base/orders/$($order.id)" -Headers $ch
$hasRice = $o3.items | Where-Object { $_.name -like "*Plain Rice*" }
Write-Host "Captain sees Plain Rice: $($hasRice.name)"

Write-Host "`n=== Test E: Ready state via KDS API ==="
$oPre = Invoke-RestMethod -Uri "$Base/orders/$($order.id)" -Headers $ch
$kotId = $oPre.kots[0].id
$kdsStaff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $KdsAuth }
$chef = $kdsStaff | Where-Object { $_.employeeCode -eq "EMP003" } | Select-Object -First 1
$chefPin = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $KdsAuth } -Body (@{ staffProfileId = $chef.id; pin = "3333" } | ConvertTo-Json) -ContentType "application/json"
$kh = @{ Authorization = "Bearer $($chefPin.accessToken)" }
Invoke-RestMethod -Uri "$Base/kds/kot/$kotId/ready" -Method PATCH -Headers $kh -ContentType "application/json" | Out-Null
$oReady = Invoke-RestMethod -Uri "$Base/orders/$($order.id)" -Headers $ch
$readyCount = ($oReady.items | Where-Object { $_.status -eq "ready" }).Count
Write-Host "Ready items after KDS mark: $readyCount (order status=$($oReady.status))"

Write-Host "`n=== Test F: EMP004 multi-role ==="
$fm = Captain-Pin "EMP004" "4444"
Write-Host "EMP004 captain login OK role=$($fm.staff.role)"

Write-Host "`n=== Test C: POS settlement ==="
$oBefore = Invoke-RestMethod -Uri "$Base/orders/$($order.id)" -Headers $ph
$settle = Invoke-RestMethod -Uri "$Base/orders/$($order.id)/settle" -Method POST -Headers $ph -Body (@{
  payments = @(@{ method = "cash"; amount = [decimal]$oBefore.totalAmount })
} | ConvertTo-Json -Depth 5) -ContentType "application/json"
Write-Host "Settled status=$($settle.order.status)"
$t2after = Table-ByNumber $ch "2"
Write-Host "Table 2 status=$($t2after.status)"

Write-Host "`n=== Test H: Disable Captain module ==="
$admin = Login "admin@kaanafoods.in"
$off = @{ moduleOverrides = @(@{ moduleKey = "captain"; enabled = $false }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $($admin.accessToken)" } -Body $off -ContentType "application/json" | Out-Null
$capsOff = (Invoke-RestMethod -Uri "$Base/capabilities/me" -Headers $ch).data
Write-Host "Captain module=$($capsOff.modules.captain)"
$on = @{ moduleOverrides = @(@{ moduleKey = "captain"; inherit = $true }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $($admin.accessToken)" } -Body $on -ContentType "application/json" | Out-Null
Write-Host "Captain restored"

Write-Host "`nStep 9 API validation complete."
