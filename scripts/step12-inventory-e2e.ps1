# Step 12 — Inventory & Procurement E2E validation
param(
  [string]$Base = "http://localhost:4000/api",
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
$Pass = 0
$Fail = 0
$Results = @()

function Record($name, $ok, $detail = "") {
  if ($ok) { $script:Pass++ } else { $script:Fail++ }
  $script:Results += [pscustomobject]@{ Test = $name; Pass = $ok; Detail = $detail }
  $mark = if ($ok) { "PASS" } else { "FAIL" }
  Write-Host "[$mark] $name $(if ($detail) { "- $detail" })"
}

function Login($email) {
  Start-Sleep -Milliseconds 300
  Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body (@{ email = $email; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
}

function Op-Pin($terminalAuth, $code, $pin) {
  Start-Sleep -Milliseconds 300
  $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $terminalAuth }
  $emp = $staff | Where-Object { $_.employeeCode -eq $code } | Select-Object -First 1
  if (-not $emp) { throw "Employee $code not eligible on terminal" }
  return Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $terminalAuth } -Body (@{ staffProfileId = $emp.id; pin = $pin } | ConvertTo-Json) -ContentType "application/json"
}

function Menu-Item($headers, $outletId, $name) {
  $menu = Invoke-RestMethod -Uri "$Base/outlets/$outletId/menu" -Headers $headers
  foreach ($m in $menu) {
    foreach ($cat in $m.categories) {
      $item = $cat.items | Where-Object { $_.name -like "*$name*" } | Select-Object -First 1
      if ($item) { return $item }
    }
  }
  return $null
}

function Ingredient-ByName($headers, $outletId, $name) {
  $items = Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/ingredients" -Headers $headers
  return $items | Where-Object { $_.name -eq $name } | Select-Object -First 1
}

function Supplier-ByName($headers, $outletId, $name) {
  $suppliers = Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/suppliers" -Headers $headers
  return $suppliers | Where-Object { $_.name -like "*$name*" } | Select-Object -First 1
}

function Try-Api($label, [scriptblock]$scriptBlock) {
  try {
    & $scriptBlock
    Record $label $true
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    Record $label $false "$code $($_.Exception.Message)"
  }
}

function Expect-Deny($label, [scriptblock]$scriptBlock) {
  try {
    & $scriptBlock
    Record $label $false "unexpected allow"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -in 400, 401, 403, 404) {
      Record $label $true "denied ($code)"
    } else {
      Record $label $false "$code $($_.Exception.Message)"
    }
  }
}

Write-Host "=== Step 12 Inventory E2E ===" -ForegroundColor Cyan

if (-not $SkipSeed) {
  Write-Host "Running db:seed..."
  Push-Location (Split-Path $PSScriptRoot -Parent)
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  npm run db:seed 2>&1 | Out-Null
  $ErrorActionPreference = $prevEap
  Pop-Location
  Start-Sleep -Seconds 3
}

Try-Api "API health" {
  Invoke-RestMethod -Uri "$Base/health" -Method GET | Out-Null
}

$owner = Login "owner@kaanafoods.in"
$oh = @{ Authorization = "Bearer $($owner.accessToken)" }

$allTerminals = Invoke-RestMethod -Uri "$Base/terminals" -Headers $oh
if ($null -eq $allTerminals) { $allTerminals = @() }
elseif ($allTerminals -isnot [System.Array]) { $allTerminals = @($allTerminals) }

$seededTerminals = @($allTerminals | Where-Object { $_.code -in @("POS-01", "CAPTAIN-01", "KDS-01") })
$demoOutletGroup = @($seededTerminals | Where-Object { $_.isRegistered }) | Group-Object outletId | Sort-Object Count -Descending | Select-Object -First 1
if (-not $demoOutletGroup -or @($demoOutletGroup.Group).Count -lt 3) {
  throw "Expected 3 seeded registered terminals on demo outlet"
}
$outletId = $demoOutletGroup.Name
$posTerminal = $seededTerminals | Where-Object { $_.code -eq "POS-01" -and $_.outletId -eq $outletId } | Select-Object -First 1
$PosAuth = "Terminal $($posTerminal.id):kaana-dev-pos-01-secret"
$posPin = Op-Pin $PosAuth "EMP001" "1111"
$ph = @{ Authorization = "Bearer $($posPin.accessToken)" }

# Baseline
$ingredients = Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/ingredients" -Headers $oh
Record "Baseline 12 ingredients" (@($ingredients).Count -eq 12) "count=$(@($ingredients).Count)"

$chickenBefore = Ingredient-ByName $oh $outletId "Chicken"
$chickenStockBefore = [decimal]$chickenBefore.currentStock
Record "Chicken baseline stock captured" ($chickenStockBefore -gt 0) "$chickenStockBefore kg"

$recipeVal = Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/recipe-validation" -Headers $oh
Record "Recipe/BOM validation" ($recipeVal.ok -eq $true) "recipes=$($recipeVal.recipeCount)"

$reconBefore = Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/reconcile" -Headers $oh
Record "Baseline ledger reconciliation" ($reconBefore.ok -eq $true) "mismatches=$($reconBefore.mismatchCount)"

# Purchase → receive
$poultry = Supplier-ByName $oh $outletId "Fresh Poultry"
$po = Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/purchase-orders" -Method POST -Headers $oh -Body (@{
  supplierId = $poultry.id
  items = @(@{ ingredientId = $chickenBefore.id; quantity = 5; unitPrice = 285 })
} | ConvertTo-Json -Depth 5) -ContentType "application/json"

Invoke-RestMethod -Uri "$Base/inventory/purchase-orders/$($po.id)/send" -Method POST -Headers $oh -ContentType "application/json" | Out-Null

$idemKey = "step12-recv-$(Get-Date -Format 'yyyyMMddHHmmss')"
$received = Invoke-RestMethod -Uri "$Base/inventory/purchase-orders/$($po.id)/receive" -Method POST -Headers $oh -Body (@{
  idempotencyKey = $idemKey
} | ConvertTo-Json) -ContentType "application/json"

$chickenAfterRecv = Ingredient-ByName $oh $outletId "Chicken"
$recvDelta = [decimal]$chickenAfterRecv.currentStock - $chickenStockBefore
Record "Purchase receive +5 kg stock" ([math]::Abs($recvDelta - 5) -lt 0.01) "delta=$recvDelta status=$($received.status)"

$receivedRetry = Invoke-RestMethod -Uri "$Base/inventory/purchase-orders/$($po.id)/receive" -Method POST -Headers $oh -Body (@{
  idempotencyKey = $idemKey
} | ConvertTo-Json) -ContentType "application/json"
$chickenAfterRetry = Ingredient-ByName $oh $outletId "Chicken"
Record "Receive idempotency (no duplicate stock)" ([decimal]$chickenAfterRetry.currentStock -eq [decimal]$chickenAfterRecv.currentStock) "stock=$($chickenAfterRetry.currentStock)"

Expect-Deny "Over-receive rejected" {
  $overPo = Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/purchase-orders" -Method POST -Headers $oh -Body (@{
    supplierId = $poultry.id
    items = @(@{ ingredientId = $chickenBefore.id; quantity = 3; unitPrice = 280 })
  } | ConvertTo-Json -Depth 5) -ContentType "application/json"
  Invoke-RestMethod -Uri "$Base/inventory/purchase-orders/$($overPo.id)/send" -Method POST -Headers $oh | Out-Null
  Invoke-RestMethod -Uri "$Base/inventory/purchase-orders/$($overPo.id)/receive" -Method POST -Headers $oh -Body (@{
    lines = @(@{ poItemId = $overPo.items[0].id; receivedQty = 5 })
  } | ConvertTo-Json -Depth 5) -ContentType "application/json" | Out-Null
}

# Partial receive on new PO (Rice)
$rice = Ingredient-ByName $oh $outletId "Rice"
$grocer = Supplier-ByName $oh $outletId "Sri Lakshmi"
$ricePo = Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/purchase-orders" -Method POST -Headers $oh -Body (@{
  supplierId = $grocer.id
  items = @(@{ ingredientId = $rice.id; quantity = 10; unitPrice = 65 })
} | ConvertTo-Json -Depth 5) -ContentType "application/json"
Invoke-RestMethod -Uri "$Base/inventory/purchase-orders/$($ricePo.id)/send" -Method POST -Headers $oh | Out-Null
$riceBefore = [decimal]$rice.currentStock

Invoke-RestMethod -Uri "$Base/inventory/purchase-orders/$($ricePo.id)/receive" -Method POST -Headers $oh -Body (@{
  lines = @(@{ poItemId = $ricePo.items[0].id; receivedQty = 6 })
} | ConvertTo-Json -Depth 5) -ContentType "application/json" | Out-Null
$riceMid = Ingredient-ByName $oh $outletId "Rice"
Record "Partial receive +6 kg" ([math]::Abs(([decimal]$riceMid.currentStock - $riceBefore) - 6) -lt 0.01) "stock=$($riceMid.currentStock)"

Invoke-RestMethod -Uri "$Base/inventory/purchase-orders/$($ricePo.id)/receive" -Method POST -Headers $oh -Body (@{
  lines = @(@{ poItemId = $ricePo.items[0].id; receivedQty = 4 })
} | ConvertTo-Json -Depth 5) -ContentType "application/json" | Out-Null
$riceAfter = Ingredient-ByName $oh $outletId "Rice"
Record "Partial receive remaining +4" ([math]::Abs(([decimal]$riceAfter.currentStock - $riceBefore) - 10) -lt 0.01) "total +10"

# Wastage
$chickenForWastage = Ingredient-ByName $oh $outletId "Chicken"
$beforeWastage = [decimal]$chickenForWastage.currentStock
Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/wastage" -Method POST -Headers $oh -Body (@{
  ingredientId = $chickenForWastage.id
  quantity = 0.5
  reason = "Spoiled - Step12 test"
} | ConvertTo-Json) -ContentType "application/json" | Out-Null
$afterWastage = Ingredient-ByName $oh $outletId "Chicken"
Record "Wastage -0.5 kg" ([math]::Abs(([decimal]$afterWastage.currentStock - $beforeWastage) + 0.5) -lt 0.01) "stock=$($afterWastage.currentStock)"

# Adjustment
Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/stock-adjustments" -Method POST -Headers $oh -Body (@{
  ingredientId = $chickenForWastage.id
  quantity = -0.1
  reason = "Physical count correction"
} | ConvertTo-Json) -ContentType "application/json" | Out-Null
Record "Stock adjustment posted" $true

# Stock count
$count = Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/stock-counts" -Method POST -Headers $oh -Body (@{
  countType = "full"
} | ConvertTo-Json) -ContentType "application/json"
$countLine = $count.lines | Where-Object { $_.ingredient.name -eq "Sugar" } | Select-Object -First 1
if ($countLine) {
  $sugar = Ingredient-ByName $oh $outletId "Sugar"
  $counted = [decimal]$sugar.currentStock - 0.2
  Invoke-RestMethod -Uri "$Base/inventory/stock-counts/$($count.id)/lines/$($countLine.id)" -Method PATCH -Headers $oh -Body (@{
    physicalStock = $counted
    reason = "Step12 count variance"
  } | ConvertTo-Json) -ContentType "application/json" | Out-Null
  Invoke-RestMethod -Uri "$Base/inventory/stock-counts/$($count.id)/approve" -Method POST -Headers $oh -ContentType "application/json" | Out-Null
  $sugarAfter = Ingredient-ByName $oh $outletId "Sugar"
  Record "Stock count variance posted" ([math]::Abs([decimal]$sugarAfter.currentStock - $counted) -lt 0.01) "sugar=$($sugarAfter.currentStock)"
} else {
  Record "Stock count variance posted" $false "Sugar line not found"
}

# Recipe order + cancel release
$biryani = Menu-Item $oh $outletId "Chicken Biryani"
$chickenPreOrder = Ingredient-ByName $oh $outletId "Chicken"
$availBefore = [decimal]$chickenPreOrder.currentStock - [decimal]$chickenPreOrder.committedStock

$cancelOrder = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $ph -Body (@{
  outletId = $outletId; type = "takeaway"; source = "pos"
} | ConvertTo-Json) -ContentType "application/json"
Invoke-RestMethod -Uri "$Base/orders/$($cancelOrder.id)/items" -Method POST -Headers $ph -Body (@{
  menuItemId = $biryani.id; quantity = 1
} | ConvertTo-Json) -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($cancelOrder.id)/kot" -Method POST -Headers $ph -ContentType "application/json" | Out-Null

$chickenCommitted = Ingredient-ByName $oh $outletId "Chicken"
Record "KOT commitment increases committedStock" ([decimal]$chickenCommitted.committedStock -gt [decimal]$chickenPreOrder.committedStock) "committed=$($chickenCommitted.committedStock)"

Invoke-RestMethod -Uri "$Base/orders/$($cancelOrder.id)/cancel" -Method POST -Headers $ph -Body (@{ reason = "Step12 cancel release" } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Start-Sleep -Seconds 1
$chickenPostCancel = Ingredient-ByName $oh $outletId "Chicken"
$availAfter = [decimal]$chickenPostCancel.currentStock - [decimal]$chickenPostCancel.committedStock
Record "Cancel releases commitment" ([math]::Abs($availAfter - $availBefore) -lt 0.05) "available=$availAfter"

# Operational JWT cannot mutate inventory
Expect-Deny "Operational JWT wastage denied" {
  Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/wastage" -Method POST -Headers $ph -Body (@{
    ingredientId = $chickenForWastage.id; quantity = 0.1; reason = "should fail"
  } | ConvertTo-Json) -ContentType "application/json" | Out-Null
}

# Cross-outlet IDOR
$otherOutlet = ($allTerminals | Where-Object { $_.outletId -ne $outletId -and $_.isRegistered } | Select-Object -First 1).outletId
if ($otherOutlet) {
  Expect-Deny "Cross-outlet inventory denied" {
    Invoke-RestMethod -Uri "$Base/inventory/outlets/$otherOutlet/ingredients" -Headers $oh | Out-Null
  }
} else {
  Record "Cross-outlet inventory denied" $true "skipped (single outlet tenant)"
}

# Low stock dashboard
$dash = Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/dashboard" -Headers $oh
Record "Inventory dashboard" ($null -ne $dash.totalItems) "items=$($dash.totalItems) low=$($dash.lowStockCount)"

# Final reconciliation
$reconFinal = Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/reconcile" -Headers $oh
Record "Final ledger reconciliation" ($reconFinal.ok -eq $true) "mismatches=$($reconFinal.mismatchCount)"

# PO cancel does not affect stock
$draftPo = Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/purchase-orders" -Method POST -Headers $oh -Body (@{
  supplierId = $poultry.id
  items = @(@{ ingredientId = $chickenBefore.id; quantity = 2; unitPrice = 280 })
} | ConvertTo-Json -Depth 5) -ContentType "application/json"
Invoke-RestMethod -Uri "$Base/inventory/purchase-orders/$($draftPo.id)/send" -Method POST -Headers $oh | Out-Null
$stockBeforeCancel = [decimal](Ingredient-ByName $oh $outletId "Chicken").currentStock
Invoke-RestMethod -Uri "$Base/inventory/purchase-orders/$($draftPo.id)/cancel" -Method POST -Headers $oh | Out-Null
$stockAfterCancel = [decimal](Ingredient-ByName $oh $outletId "Chicken").currentStock
Record "Unreceived PO cancel no stock change" ($stockBeforeCancel -eq $stockAfterCancel) "stock=$stockAfterCancel"

Write-Host ""
Write-Host "=== Summary: $Pass passed, $Fail failed ===" -ForegroundColor $(if ($Fail -eq 0) { "Green" } else { "Red" })
$Results | Format-Table -AutoSize
if ($Fail -gt 0) { exit 1 }
