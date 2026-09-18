# Step 8 - Mobile POS E2E validation (API-level)
$Base = "http://localhost:4000/api"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$PosTerminalId = "cmtpu1368004qu92shslo1n1k"
$PosSecret = "kaana-dev-pos-01-secret"
$TerminalAuth = "Terminal ${PosTerminalId}:${PosSecret}"

function Login($email) {
  Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body (@{ email = $email; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
}
function Bearer($token) { @{ Authorization = "Bearer $($token.accessToken)" } }
function Get-Ingredients($headers) {
  Invoke-RestMethod -Uri "$Base/inventory/outlets/$OutletId/ingredients" -Headers $headers
}
function Find-MenuItem($headers, $name) {
  $menu = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/menu" -Headers $headers
  foreach ($m in $menu) {
    foreach ($cat in $m.categories) {
      $item = $cat.items | Where-Object { $_.name -like "*$name*" } | Select-Object -First 1
      if ($item) { return $item }
    }
  }
  return $null
}

Write-Host "=== Baseline stock ==="
$owner = Login "owner@kaanafoods.in"
$oh = Bearer $owner
$before = Get-Ingredients $oh
$chickenBefore = ($before | Where-Object { $_.name -eq "Chicken" }).currentStock
$riceBefore = ($before | Where-Object { $_.name -eq "Rice" }).currentStock
Write-Host "Chicken=$chickenBefore kg Rice=$riceBefore kg"

Write-Host "`n=== Scenario A: Owner Takeaway ==="
$biryani = Find-MenuItem $oh "Chicken Biryani"
$soda = Find-MenuItem $oh "Lime Soda"
$orderA = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $oh -Body (@{
  outletId = $OutletId; type = "takeaway"; source = "pos"; guestCount = 1
} | ConvertTo-Json) -ContentType "application/json"
Write-Host "Created $($orderA.orderNumber)"
Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)/items" -Method POST -Headers $oh -Body (@{ menuItemId = $biryani.id; quantity = 2 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)/items" -Method POST -Headers $oh -Body (@{ menuItemId = $soda.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
$orderA2 = Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)" -Headers $oh
Write-Host "Items=$($orderA2.items.Count) subtotal=$($orderA2.subtotal) tax=$($orderA2.taxAmount) total=$($orderA2.totalAmount)"
$settleA = Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)/settle" -Method POST -Headers $oh -Body (@{
  payments = @(@{ method = "cash"; amount = [decimal]$orderA2.totalAmount })
} | ConvertTo-Json -Depth 5) -ContentType "application/json"
Write-Host "Settled status=$($settleA.order.status) invoice=$($settleA.invoice.invoiceNumber)"

Write-Host "`n=== Scenario B: POS Terminal Takeaway (EMP001) ==="
$staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $TerminalAuth }
$cashier = $staff | Where-Object { $_.employeeCode -eq "EMP001" } | Select-Object -First 1
$pin = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $TerminalAuth } -Body (@{ staffProfileId = $cashier.id; pin = "1111" } | ConvertTo-Json) -ContentType "application/json"
$bh = @{ Authorization = "Bearer $($pin.accessToken)" }
$paneer = Find-MenuItem $bh "Paneer Butter Masala"
$naan = Find-MenuItem $bh "Butter Naan"
$orderB = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $bh -Body (@{
  outletId = $OutletId; type = "takeaway"; source = "pos"; terminalId = $PosTerminalId
} | ConvertTo-Json) -ContentType "application/json"
Invoke-RestMethod -Uri "$Base/orders/$($orderB.id)/items" -Method POST -Headers $bh -Body (@{ menuItemId = $paneer.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($orderB.id)/items" -Method POST -Headers $bh -Body (@{ menuItemId = $naan.id; quantity = 2 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
$orderB2 = Invoke-RestMethod -Uri "$Base/orders/$($orderB.id)" -Headers $bh
$settleB = Invoke-RestMethod -Uri "$Base/orders/$($orderB.id)/settle" -Method POST -Headers $bh -Body (@{
  payments = @(@{ method = "upi"; amount = [decimal]$orderB2.totalAmount })
} | ConvertTo-Json -Depth 5) -ContentType "application/json"
Write-Host "EMP001 settled $($orderB.orderNumber) via UPI total=$($orderB2.totalAmount)"

Write-Host "`n=== Scenario C: Dine-in hold + additional KOT ==="
$floor = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $oh
$table3 = $floor.tables | Where-Object { $_.number -eq "3" } | Select-Object -First 1
$curry = Find-MenuItem $oh "Chicken Curry"
$rice = Find-MenuItem $oh "Plain Rice"
$roti = Find-MenuItem $oh "Roti"
$orderC = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $oh -Body (@{
  outletId = $OutletId; type = "dine_in"; source = "pos"; tableId = $table3.id; guestCount = 2
} | ConvertTo-Json) -ContentType "application/json"
Invoke-RestMethod -Uri "$Base/orders/$($orderC.id)/items" -Method POST -Headers $oh -Body (@{ menuItemId = $curry.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($orderC.id)/items" -Method POST -Headers $oh -Body (@{ menuItemId = $rice.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
$kot1 = Invoke-RestMethod -Uri "$Base/orders/$($orderC.id)/kot" -Method POST -Headers $oh -ContentType "application/json"
Write-Host "First KOT fired kots=$($kot1.kots.Count) status=$($kot1.status)"
$floorMid = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $oh
$t3mid = $floorMid.tables | Where-Object { $_.id -eq $table3.id }
Write-Host "Table 3 occupied order=$($t3mid.activeOrder.orderNumber)"
Invoke-RestMethod -Uri "$Base/orders/$($orderC.id)/items" -Method POST -Headers $oh -Body (@{ menuItemId = $roti.id; quantity = 2 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
$kot2 = Invoke-RestMethod -Uri "$Base/orders/$($orderC.id)/kot" -Method POST -Headers $oh -ContentType "application/json"
Write-Host "Second KOT same order=$($orderC.orderNumber) kots=$($kot2.kots.Count)"
$orderC2 = Invoke-RestMethod -Uri "$Base/orders/$($orderC.id)" -Headers $oh
$settleC = Invoke-RestMethod -Uri "$Base/orders/$($orderC.id)/settle" -Method POST -Headers $oh -Body (@{
  payments = @(@{ method = "card"; amount = [decimal]$orderC2.totalAmount })
} | ConvertTo-Json -Depth 5) -ContentType "application/json"
$floorAfter = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $oh
$t3after = $floorAfter.tables | Where-Object { $_.id -eq $table3.id }
Write-Host "Table 3 after settle status=$($t3after.status)"

Write-Host "`n=== Scenario D: Discount (owner) ==="
$orderD = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $oh -Body (@{ outletId = $OutletId; type = "takeaway"; source = "pos" } | ConvertTo-Json) -ContentType "application/json"
Invoke-RestMethod -Uri "$Base/orders/$($orderD.id)/items" -Method POST -Headers $oh -Body (@{ menuItemId = $soda.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
$orderD2 = Invoke-RestMethod -Uri "$Base/orders/$($orderD.id)" -Headers $oh
$disc = 20
$settleD = Invoke-RestMethod -Uri "$Base/orders/$($orderD.id)/settle" -Method POST -Headers $oh -Body (@{
  discountAmount = $disc
  payments = @(@{ method = "cash"; amount = [decimal]$orderD2.totalAmount - $disc })
} | ConvertTo-Json -Depth 5) -ContentType "application/json"
Write-Host "Discount $disc applied invoice total=$($settleD.invoice.totalAmount)"

Write-Host "`n=== Scenario E: Cancel ==="
$orderE = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $oh -Body (@{ outletId = $OutletId; type = "takeaway"; source = "pos" } | ConvertTo-Json) -ContentType "application/json"
Invoke-RestMethod -Uri "$Base/orders/$($orderE.id)/items" -Method POST -Headers $oh -Body (@{ menuItemId = $soda.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
$cancelE = Invoke-RestMethod -Uri "$Base/orders/$($orderE.id)/cancel" -Method POST -Headers $oh -Body (@{ reason = "STEP8 test cancel" } | ConvertTo-Json) -ContentType "application/json"
Write-Host "Cancelled status=$($cancelE.status)"

Write-Host "`n=== Settle idempotency retry ==="
try {
  Invoke-RestMethod -Uri "$Base/orders/$($orderA.id)/settle" -Method POST -Headers $oh -Body (@{
    payments = @(@{ method = "cash"; amount = 100 })
  } | ConvertTo-Json -Depth 5) -ContentType "application/json"
  Write-Host "Retry returned without duplicate error"
} catch {
  Write-Host "Retry response: $($_.Exception.Message)"
}

Write-Host "`n=== Inventory after Chicken Biryani x2 ==="
$after = Get-Ingredients $oh
$chickenAfter = ($after | Where-Object { $_.name -eq "Chicken" }).currentStock
$riceAfter = ($after | Where-Object { $_.name -eq "Rice" }).currentStock
Write-Host "Chicken $chickenBefore -> $chickenAfter kg"
Write-Host "Rice $riceBefore -> $riceAfter kg"

Write-Host "`n=== Journal entries (if any) ==="
try {
  $journals = Invoke-RestMethod -Uri "$Base/accounting/journal-entries?outletId=$OutletId&limit=5" -Headers $oh
  Write-Host "Journal entries found: $($journals.Count)"
} catch {
  Write-Host "Accounting journal API: not available or empty ($($_.Exception.Message))"
}

Write-Host "`nStep 8 API validation complete."
