# Step 7 - Management mobile API validation
$Base = "http://localhost:4000/api"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$OrgId = "cmselugbk0000u978y0qjuzqq"

function Login($email) {
  $body = @{ email = $email; password = "password123" } | ConvertTo-Json
  return Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body $body -ContentType "application/json"
}

function Header($token) { @{ Authorization = "Bearer $($token.accessToken)" } }

Write-Host "=== Owner dashboard APIs ==="
$owner = Login "owner@kaanafoods.in"
$oh = Header $owner
$dash = Invoke-RestMethod -Uri "$Base/organizations/dashboard?outletId=$OutletId" -Headers $oh
Write-Host "Today revenue=$($dash.todayRevenue) orders=$($dash.todayOrders)"
$sales = Invoke-RestMethod -Uri "$Base/reports/sales?outletId=$OutletId&from=$((Get-Date).Date.ToUniversalTime().ToString('o'))&to=$((Get-Date).ToUniversalTime().ToString('o'))" -Headers $oh
Write-Host "Sales report revenue=$($sales.totalRevenue) payments=$($sales.byPayment | ConvertTo-Json -Compress)"

Write-Host "`n=== Manager access ==="
$manager = Login "manager@kaanafoods.in"
$mh = Header $manager
$mgrDash = Invoke-RestMethod -Uri "$Base/organizations/dashboard?outletId=$OutletId" -Headers $mh
Write-Host "Manager dashboard OK orders=$($mgrDash.todayOrders)"

Write-Host "`n=== Orders / Inventory / Staff / Devices ==="
$orders = Invoke-RestMethod -Uri "$Base/orders?outletId=$OutletId" -Headers $oh
Write-Host "Orders count=$($orders.Count)"
$inv = Invoke-RestMethod -Uri "$Base/inventory/outlets/$OutletId/stock-summary" -Headers $oh
Write-Host "Inventory lowStock=$($inv.lowStockCount) outOfStock=$($inv.outOfStockCount)"
$staff = Invoke-RestMethod -Uri "$Base/staff/outlets/$OutletId" -Headers $oh
Write-Host "Staff count=$($staff.Count)"
$terms = Invoke-RestMethod -Uri "$Base/terminals" -Headers $oh
Write-Host "Devices count=$($terms.Count)"

Write-Host "`n=== Purchase test (Fresh Poultry / Chicken) ==="
$suppliers = Invoke-RestMethod -Uri "$Base/inventory/outlets/$OutletId/suppliers" -Headers $oh
$poultry = $suppliers | Where-Object { $_.name -like "*Poultry*" } | Select-Object -First 1
$ingredients = Invoke-RestMethod -Uri "$Base/inventory/outlets/$OutletId/ingredients" -Headers $oh
$chicken = $ingredients | Where-Object { $_.name -like "*Chicken*" } | Select-Object -First 1
if ($poultry -and $chicken) {
  $po = Invoke-RestMethod -Uri "$Base/inventory/outlets/$OutletId/purchase-orders" -Method POST -Headers $oh -Body (@{
    supplierId = $poultry.id
    items = @(@{ ingredientId = $chicken.id; quantity = 5; unitPrice = 220 })
    notes = "STEP7 mobile test purchase"
  } | ConvertTo-Json -Depth 5) -ContentType "application/json"
  Write-Host "Created PO $($po.poNumber) amount=$($po.totalAmount)"
  $lineId = $po.items[0].id
  Invoke-RestMethod -Uri "$Base/inventory/purchase-orders/$($po.id)/receive" -Method POST -Headers $oh -Body (@{
    lines = @(@{ poItemId = $lineId; receivedQty = 5 })
  } | ConvertTo-Json -Depth 5) -ContentType "application/json" | Out-Null
  Write-Host "Received PO -> stock updated via GRN flow"
  $chickenAfter = ($ingredients | Where-Object { $_.id -eq $chicken.id })
  $stockAfter = Invoke-RestMethod -Uri "$Base/reports/inventory?outletId=$OutletId" -Headers $oh
  $row = $stockAfter | Where-Object { $_.id -eq $chicken.id }
  Write-Host "Chicken stock now=$($row.currentStock) $($row.unit)"
} else {
  Write-Host "SKIP purchase test - supplier/ingredient not found"
}

Write-Host "`n=== Seeded terminals ==="
foreach ($code in @("POS-01","KDS-01","CAPTAIN-01")) {
  $t = $terms | Where-Object { $_.code -eq $code }
  Write-Host "$code registered=$($t.isRegistered) revoked=$([bool]$t.revokedAt)"
}

Write-Host "`nStep 7 API validation complete."
