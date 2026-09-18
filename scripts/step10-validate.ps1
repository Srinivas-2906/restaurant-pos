# Step 10 - KDS E2E validation (API scenarios A-I)
$ErrorActionPreference = "Stop"
$Base = "http://localhost:4000/api"
$OrgId = "cmselugbk0000u978y0qjuzqq"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$KdsTerminalId = "cmtpu138o004su92sw5o46nf6"
$KdsSecret = "kaana-dev-kds-01-secret"
$PosTerminalId = "cmtpu1368004qu92shslo1n1k"
$PosSecret = "kaana-dev-pos-01-secret"
$CaptainTerminalId = "cmtpu13b5004uu92s5rht3ml4"
$CaptainSecret = "kaana-dev-captain-01-secret"
$KdsAuth = "Terminal ${KdsTerminalId}:${KdsSecret}"
$PosAuth = "Terminal ${PosTerminalId}:${PosSecret}"
$CaptainAuth = "Terminal ${CaptainTerminalId}:${CaptainSecret}"

function Login($email) {
  Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body (@{ email = $email; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
}
function Pin($auth, $code, $pin) {
  $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $auth }
  $emp = $staff | Where-Object { $_.employeeCode -eq $code } | Select-Object -First 1
  if (-not $emp) { throw "Employee $code not eligible on terminal" }
  return Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $auth } -Body (@{ staffProfileId = $emp.id; pin = $pin } | ConvertTo-Json) -ContentType "application/json"
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
function Kds-Queue($headers) {
  Invoke-RestMethod -Uri "$Base/kds/outlets/$OutletId/queue" -Headers $headers
}
function Clear-LiveOrders($headers) {
  $live = Invoke-RestMethod -Uri "$Base/orders/live?outletId=$OutletId" -Headers $headers
  foreach ($o in $live.orders) {
    try {
      Invoke-RestMethod -Uri "$Base/orders/$($o.id)/cancel" -Method POST -Headers $headers -Body (@{ reason = "step10-reset" } | ConvertTo-Json) -ContentType "application/json" | Out-Null
      Write-Host "[reset] cancelled $($o.orderNumber)"
    } catch {
      Write-Host "[reset] skip $($o.orderNumber): $($_.Exception.Message)"
    }
  }
}

Write-Host "=== Baseline cleanup ==="
$owner = Login "owner@kaanafoods.in"
$oh = @{ Authorization = "Bearer $($owner.accessToken)" }
Clear-LiveOrders $oh
$floor0 = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $oh
$queue0 = Kds-Queue (@{ Authorization = "Bearer $((Pin $KdsAuth 'EMP003' '3333').accessToken)" })
Write-Host "Tables free: $(($floor0.tables | Where-Object { -not $_.activeOrder }).Count)/6"
Write-Host "KDS queue baseline tickets: $($queue0.Count)"

Write-Host "`n=== Test G: Wrong employees on KDS device ==="
foreach ($case in @(@{ c = "EMP001"; p = "1111" }, @{ c = "EMP002"; p = "2222" })) {
  try {
    Pin $KdsAuth $case.c $case.p | Out-Null
    Write-Host "$($case.c): ALLOWED (unexpected)"
  } catch {
    Write-Host "$($case.c): denied"
  }
}

Write-Host "`n=== Test F: EMP004 multi-role on KDS ==="
$kds4 = Pin $KdsAuth "EMP004" "4444"
$kh4 = @{ Authorization = "Bearer $($kds4.accessToken)" }
Write-Host "EMP004 KDS login OK"

Write-Host "`n=== Test A: Captain -> KDS ==="
$cap = Pin $CaptainAuth "EMP002" "2222"
$ch = @{ Authorization = "Bearer $($cap.accessToken)" }
$chef = Pin $KdsAuth "EMP003" "3333"
$kh = @{ Authorization = "Bearer $($chef.accessToken)" }
$t2 = Table-ByNumber $ch "2"
$biryani = Menu-Item $ch "Chicken Biryani"
$soda = Menu-Item $ch "Lime Soda"
$orderA = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $ch -Body (@{
  outletId = $OutletId; type = "dine_in"; source = "captain"; tableId = $t2.id; guestCount = 2
} | ConvertTo-Json) -ContentType "application/json"
Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)/items" -Method POST -Headers $ch -Body (@{ menuItemId = $biryani.id; quantity = 1; notes = "Less spicy" } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)/items" -Method POST -Headers $ch -Body (@{ menuItemId = $soda.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
$fireA = Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)/kot" -Method POST -Headers $ch -ContentType "application/json"
Write-Host "Captain fired kots=$($fireA.kots.Count) order=$($orderA.id)"
$queueA = Kds-Queue $kh | Where-Object { $_.order.id -eq $orderA.id }
Write-Host "KDS orderA tickets=$($queueA.Count) statuses=$($queueA.status -join ',')"
$biryaniKot = $queueA | Where-Object {
  @($_.items | ForEach-Object { $_.orderItem.name }) -match "Biryani"
} | Select-Object -First 1
if (-not $biryaniKot) { $biryaniKot = $queueA | Select-Object -First 1 }
$note = ($biryaniKot.items | Where-Object { $_.orderItem.notes }).orderItem.notes | Select-Object -First 1
Write-Host "Note on KDS=$note"
Invoke-RestMethod -Uri "$Base/kds/kot/$($biryaniKot.id)/preparing" -Method PATCH -Headers $kh -ContentType "application/json" | Out-Null
$oPrep = Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)" -Headers $ch
Write-Host "After preparing Captain orderStatus=$($oPrep.status)"
Invoke-RestMethod -Uri "$Base/kds/kot/$($biryaniKot.id)/ready" -Method PATCH -Headers $kh -ContentType "application/json" | Out-Null
$oReady = Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)" -Headers $ch
$readyItems = @($oReady.items | Where-Object { $_.status -eq "ready" })
Write-Host "After one KOT ready readyItems=$($readyItems.Count) orderStatus=$($oReady.status)"

Write-Host "`n=== Test C: Multi-KOT partial ready ==="
$queueC = Kds-Queue $kh | Where-Object { $_.order.id -eq $orderA.id }
$pendingKots = @($queueC | Where-Object { $_.status -in @("pending", "preparing") })
if ($pendingKots.Count -gt 0 -and $oReady.status -eq "ready") {
  Write-Host "WARN: order marked fully ready while other KOTs active"
} else {
  Write-Host "Partial-ready OK remainingKots=$($pendingKots.Count) orderStatus=$($oReady.status)"
}

Write-Host "`n=== Test D: Second KOT ==="
$naan = Menu-Item $ch "Butter Naan"
Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)/items" -Method POST -Headers $ch -Body (@{ menuItemId = $naan.id; quantity = 2 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
$before = @((Kds-Queue $kh | Where-Object { $_.order.id -eq $orderA.id })).Count
$fireD = Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)/kot" -Method POST -Headers $ch -ContentType "application/json"
$after = @((Kds-Queue $kh | Where-Object { $_.order.id -eq $orderA.id })).Count
Write-Host "Second fire kots=$($fireD.kots.Count) queue before=$before after=$after"
$dupOrder = Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)" -Headers $ch
$dupPending = @($dupOrder.items | Where-Object { -not $_.kotId -and $_.status -eq "pending" }).Count
Write-Host "Double fire pendingItems=$dupPending (expect 0)"

Write-Host "`n=== Test B: POS -> KDS takeaway ==="
$pos = Pin $PosAuth "EMP001" "1111"
$ph = @{ Authorization = "Bearer $($pos.accessToken)" }
$paneer = Menu-Item $ph "Paneer Butter Masala"
$naan2 = Menu-Item $ph "Butter Naan"
$orderB = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $ph -Body (@{
  outletId = $OutletId; type = "takeaway"; source = "pos"
} | ConvertTo-Json) -ContentType "application/json"
Invoke-RestMethod -Uri "$Base/orders/$($orderB.id)/items" -Method POST -Headers $ph -Body (@{ menuItemId = $paneer.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($orderB.id)/items" -Method POST -Headers $ph -Body (@{ menuItemId = $naan2.id; quantity = 2 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($orderB.id)/kot" -Method POST -Headers $ph -ContentType "application/json" | Out-Null
$queueB = Kds-Queue $kh | Where-Object { $_.order.id -eq $orderB.id }
Write-Host "POS takeaway KDS tickets=$($queueB.Count)"

Write-Host "`n=== Test E: Cancel order ==="
$cancelB = Invoke-RestMethod -Uri "$Base/orders/$($orderB.id)/cancel" -Method POST -Headers $oh -Body (@{ reason = "step10-cancel" } | ConvertTo-Json) -ContentType "application/json"
Write-Host "Cancelled status=$($cancelB.status)"
$ghost = @(Kds-Queue $kh | Where-Object { $_.order.id -eq $orderB.id })
Write-Host "Ghost tickets after cancel=$($ghost.Count) (expect 0)"

Write-Host "`n=== Test H: KDS module disable ==="
$admin = Login "admin@kaanafoods.in"
$adminH = @{ Authorization = "Bearer $($admin.accessToken)" }
$off = @{ moduleOverrides = @(@{ moduleKey = "kds"; enabled = $false }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers $adminH -Body $off -ContentType "application/json" | Out-Null
try {
  Kds-Queue $kh | Out-Null
  Write-Host "KDS queue while disabled: ALLOWED (unexpected)"
} catch {
  Write-Host "KDS queue while disabled: blocked ($($_.Exception.Response.StatusCode.value__))"
}
$on = @{ moduleOverrides = @(@{ moduleKey = "kds"; inherit = $true }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers $adminH -Body $on -ContentType "application/json" | Out-Null
Write-Host "KDS module restored"

Write-Host "`n=== Test I: STEP10-KDS terminal ==="
$existing = Invoke-RestMethod -Uri "$Base/terminals" -Headers $oh
$step10 = $existing | Where-Object { $_.name -eq "STEP10-KDS" } | Select-Object -First 1
if (-not $step10) {
  $step10 = Invoke-RestMethod -Uri "$Base/terminals" -Method POST -Headers $oh -Body (@{
    outletId = $OutletId; name = "STEP10-KDS"; deviceType = "kds"
  } | ConvertTo-Json) -ContentType "application/json"
}
$act = Invoke-RestMethod -Uri "$Base/terminals/$($step10.id)/activation-code" -Method POST -Headers $oh -ContentType "application/json"
Write-Host "STEP10-KDS id=$($step10.id) code=$($act.activationCodeDisplay)"
Invoke-RestMethod -Uri "$Base/terminals/$($step10.id)/revoke" -Method POST -Headers $oh -ContentType "application/json" | Out-Null
Write-Host "STEP10-KDS revoked"

Write-Host "`n=== Final E2E settle order A ==="
$queuePrep = Kds-Queue $kh | Where-Object { $_.order.id -eq $orderA.id }
foreach ($k in $queuePrep) {
  if ($k.status -eq "pending") { Invoke-RestMethod -Uri "$Base/kds/kot/$($k.id)/preparing" -Method PATCH -Headers $kh | Out-Null }
  if ($k.status -in @("pending", "preparing")) { Invoke-RestMethod -Uri "$Base/kds/kot/$($k.id)/ready" -Method PATCH -Headers $kh | Out-Null }
}
$oFinal = Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)" -Headers $ph
foreach ($item in @($oFinal.items | Where-Object { $_.status -eq "ready" })) {
  Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)/items/$($item.id)/served" -Method PATCH -Headers $ch -ContentType "application/json" | Out-Null
}
Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)/request-bill" -Method POST -Headers $ch -ContentType "application/json" | Out-Null
$oSettle = Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)" -Headers $ph
Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)/settle" -Method POST -Headers $ph -Body (@{
  payments = @(@{ method = "cash"; amount = [decimal]$oSettle.totalAmount })
} | ConvertTo-Json -Depth 5) -ContentType "application/json" | Out-Null
$final = Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)" -Headers $oh
Write-Host "OrderA=$($orderA.id) settled status=$($final.status) kots=$($queuePrep.id -join ',')"

Write-Host "`nStep 10 API validation complete."
