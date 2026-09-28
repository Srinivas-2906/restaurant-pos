# Step 11 — Full-system operational E2E validation (API automation)
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
  Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body (@{ email = $email; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
}

function Op-Pin($terminalAuth, $code, $pin) {
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

function Table-ByNumber($headers, $outletId, $num) {
  $floor = Invoke-RestMethod -Uri "$Base/outlets/$outletId/floor" -Headers $headers
  return $floor.tables | Where-Object { $_.number -eq "$num" } | Select-Object -First 1
}

function Expect-Deny($label, [scriptblock]$scriptBlock) {
  try {
    & $scriptBlock
    Record $label $false "unexpected allow"
  } catch {
    Record $label $true "denied"
  }
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

function Expect-DenyOrNotFound($label, [scriptblock]$scriptBlock) {
  try {
    & $scriptBlock
    Record $label $false "unexpected allow"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -in 401, 403, 404) {
      Record $label $true "denied ($code)"
    } else {
      Record $label $false "$code $($_.Exception.Message)"
    }
  }
}

Write-Host "=== Step 11 System E2E ===" -ForegroundColor Cyan

if (-not $SkipSeed) {
  Write-Host "Running db:seed..."
  Push-Location (Split-Path $PSScriptRoot -Parent)
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  npm run db:seed 2>&1 | Out-Null
  $ErrorActionPreference = $prevEap
  Pop-Location
  Start-Sleep -Seconds 2
}

Try-Api "API health" {
  Invoke-RestMethod -Uri "$Base/health" -Method GET | Out-Null
}

$owner = Login "owner@kaanafoods.in"
$oh = @{ Authorization = "Bearer $($owner.accessToken)" }

$orgId = $owner.user.organization.id
$allTerminals = Invoke-RestMethod -Uri "$Base/terminals" -Headers $oh
if ($null -eq $allTerminals) { $allTerminals = @() }
elseif ($allTerminals -isnot [System.Array]) { $allTerminals = @($allTerminals) }

$seededTerminals = @($allTerminals | Where-Object { $_.code -in @("POS-01", "CAPTAIN-01", "KDS-01") })
$demoOutletGroup = @($seededTerminals | Where-Object { $_.isRegistered }) | Group-Object outletId | Sort-Object Count -Descending | Select-Object -First 1
if (-not $demoOutletGroup -or @($demoOutletGroup.Group).Count -lt 3) {
  throw "Expected 3 seeded registered terminals (POS-01, CAPTAIN-01, KDS-01) on demo outlet; found $(@($seededTerminals).Count) matching codes"
}
$outletId = $demoOutletGroup.Name
$posTerminal = $seededTerminals | Where-Object { $_.code -eq "POS-01" -and $_.outletId -eq $outletId } | Select-Object -First 1
$captainTerminal = $seededTerminals | Where-Object { $_.code -eq "CAPTAIN-01" -and $_.outletId -eq $outletId } | Select-Object -First 1
$kdsTerminal = $seededTerminals | Where-Object { $_.code -eq "KDS-01" -and $_.outletId -eq $outletId } | Select-Object -First 1

$manager = Login "manager@kaanafoods.in"
$admin = Login "admin@kaanafoods.in"
$mh = @{ Authorization = "Bearer $($manager.accessToken)" }
$ah = @{ Authorization = "Bearer $($admin.accessToken)" }

$PosAuth = "Terminal $($posTerminal.id):kaana-dev-pos-01-secret"
$CaptainAuth = "Terminal $($captainTerminal.id):kaana-dev-captain-01-secret"
$KdsAuth = "Terminal $($kdsTerminal.id):kaana-dev-kds-01-secret"

$floor = Invoke-RestMethod -Uri "$Base/outlets/$outletId/floor" -Headers $oh
$freeCount = @($floor.tables | Where-Object { $_.status -eq "free" }).Count
Record "Baseline 6/6 tables free" ($freeCount -eq 6) "$freeCount/6"

$poCount = 0
for ($attempt = 1; $attempt -le 3; $attempt++) {
  $demoPurchaseOrders = Invoke-RestMethod -Uri "$Base/inventory/outlets/$outletId/purchase-orders" -Headers $oh
  $poCount = @($demoPurchaseOrders).Length
  if ($poCount -eq 2) { break }
  Start-Sleep -Seconds 1
}
Record "Baseline PO count = 2" ($poCount -eq 2) "count=$poCount"

$caps = Invoke-RestMethod -Uri "$Base/capabilities/me" -Headers $oh
Record "Capabilities SIMPLE/LEGACY_FULL" ($caps.data.operatingMode -eq "SIMPLE" -and $caps.data.subscriptionPlan -eq "LEGACY_FULL") "mode=$($caps.data.operatingMode)"

# Auth matrix spot checks
Expect-Deny "Captain denies EMP001 on CAPTAIN-01" {
  Op-Pin $CaptainAuth "EMP001" "1111" | Out-Null
}
Expect-Deny "Chef denies EMP003 on CAPTAIN-01" {
  Op-Pin $CaptainAuth "EMP003" "3333" | Out-Null
}
Record "Cashier POS login EMP001" $true (Op-Pin $PosAuth "EMP001" "1111").staff.employeeCode
Record "Captain login EMP002" $true (Op-Pin $CaptainAuth "EMP002" "2222").staff.employeeCode
Record "Chef KDS login EMP003" $true (Op-Pin $KdsAuth "EMP003" "3333").staff.employeeCode

# Wrong outlet JWT
$cap = Op-Pin $CaptainAuth "EMP002" "2222"
$ch = @{ Authorization = "Bearer $($cap.accessToken)" }
Expect-DenyOrNotFound "Operational JWT wrong outlet denied" {
  $otherOrgOutlet = "cmselughc000cu9787m3dwl8u"
  if ($otherOrgOutlet -eq $outletId) { throw "no alternate outlet fixture" }
  Invoke-RestMethod -Uri "$Base/outlets/$otherOrgOutlet/floor" -Headers $ch | Out-Null
}

# Canonical service loop — Table 2
$t2 = Table-ByNumber $ch $outletId "2"
$biryani = Menu-Item $ch $outletId "Chicken Biryani"
$soda = Menu-Item $ch $outletId "Lime Soda"
$order = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $ch -Body (@{
  outletId = $outletId; type = "dine_in"; source = "captain"; tableId = $t2.id; guestCount = 2
} | ConvertTo-Json) -ContentType "application/json"
Record "Captain creates order" ($order.source -eq "captain") "id=$($order.id)"

Invoke-RestMethod -Uri "$Base/orders/$($order.id)/items" -Method POST -Headers $ch -Body (@{ menuItemId = $biryani.id; quantity = 1; notes = "Less spicy" } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($order.id)/items" -Method POST -Headers $ch -Body (@{ menuItemId = $soda.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($order.id)/kot" -Method POST -Headers $ch -ContentType "application/json" | Out-Null
$o1 = Invoke-RestMethod -Uri "$Base/orders/$($order.id)" -Headers $oh
Record "KOT fired" ($o1.kots.Count -ge 1) "kots=$($o1.kots.Count)"

# POS sees same order
$posPin = Op-Pin $PosAuth "EMP001" "1111"
$ph = @{ Authorization = "Bearer $($posPin.accessToken)" }
$posOpen = Invoke-RestMethod -Uri "$Base/orders/open/by-table?outletId=$outletId&tableId=$($t2.id)" -Headers $ph
Record "POS open order same ID" ($posOpen.id -eq $order.id)

# KDS transitions
$kotId = $o1.kots[0].id
$chefPin = Op-Pin $KdsAuth "EMP003" "3333"
$kh = @{ Authorization = "Bearer $($chefPin.accessToken)" }
foreach ($kot in $o1.kots) {
  Invoke-RestMethod -Uri "$Base/kds/kot/$($kot.id)/preparing" -Method PATCH -Headers $kh -ContentType "application/json" | Out-Null
  Invoke-RestMethod -Uri "$Base/kds/kot/$($kot.id)/ready" -Method PATCH -Headers $kh -ContentType "application/json" | Out-Null
}
$oReady = Invoke-RestMethod -Uri "$Base/orders/$($order.id)" -Headers $ch
Record "KDS ready reflected" (($oReady.items | Where-Object { $_.status -eq "ready" }).Count -ge 1)

# Second KOT round
$naan = Menu-Item $ch $outletId "Butter Naan"
Invoke-RestMethod -Uri "$Base/orders/$($order.id)/items" -Method POST -Headers $ch -Body (@{ menuItemId = $naan.id; quantity = 2 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
$beforeKots = $oReady.kots.Count
Invoke-RestMethod -Uri "$Base/orders/$($order.id)/kot" -Method POST -Headers $ch -ContentType "application/json" | Out-Null
$o2 = Invoke-RestMethod -Uri "$Base/orders/$($order.id)" -Headers $ch
Record "Second KOT same order" ($o2.id -eq $order.id -and $o2.kots.Count -gt $beforeKots) "kots=$($o2.kots.Count)"

# KOT idempotency
$kotRetry = Invoke-RestMethod -Uri "$Base/orders/$($order.id)/kot" -Method POST -Headers $ch -ContentType "application/json"
Record "KOT idempotency no duplicate" ($kotRetry.kots.Count -eq $o2.kots.Count)

# Bill request + settle
Invoke-RestMethod -Uri "$Base/orders/$($order.id)/request-bill" -Method POST -Headers $ch -ContentType "application/json" | Out-Null
$oBill = Invoke-RestMethod -Uri "$Base/orders/$($order.id)" -Headers $ph
$settle = Invoke-RestMethod -Uri "$Base/orders/$($order.id)/settle" -Method POST -Headers $ph -Body (@{
  payments = @(@{ method = "cash"; amount = [decimal]$oBill.totalAmount })
} | ConvertTo-Json -Depth 5) -ContentType "application/json"
Record "POS settlement" ($settle.order.status -eq "settled") "payment+invoice"

$t2after = Table-ByNumber $ch $outletId "2"
Record "Table 2 free after settle" ($t2after.status -eq "free") "status=$($t2after.status)"

# Settlement idempotency
$settle2 = Invoke-RestMethod -Uri "$Base/orders/$($order.id)/settle" -Method POST -Headers $ph -Body (@{
  payments = @(@{ method = "cash"; amount = [decimal]$oBill.totalAmount })
} | ConvertTo-Json -Depth 5) -ContentType "application/json"
Record "Settlement idempotency" ($settle2.order.status -eq "settled")

# Cancel frees table — Table 3
$t3 = Table-ByNumber $ch $outletId "3"
$cancelOrder = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $ph -Body (@{
  outletId = $outletId; type = "dine_in"; source = "pos"; tableId = $t3.id
} | ConvertTo-Json) -ContentType "application/json"
$rice = Menu-Item $ph $outletId "Plain Rice"
Invoke-RestMethod -Uri "$Base/orders/$($cancelOrder.id)/items" -Method POST -Headers $ph -Body (@{ menuItemId = $rice.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($cancelOrder.id)/kot" -Method POST -Headers $ph -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/orders/$($cancelOrder.id)/cancel" -Method POST -Headers $ph -Body (@{ reason = "Step11 cancel test" } | ConvertTo-Json) -ContentType "application/json" | Out-Null
$t3after = Table-ByNumber $oh $outletId "3"
Record "Cancel order frees table" ($t3after.status -eq "free") "status=$($t3after.status)"

# Discount authorization
Expect-DenyOrNotFound "Cashier discount denied" {
  $discOrder = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $ph -Body (@{
    outletId = $outletId; type = "takeaway"; source = "pos"
  } | ConvertTo-Json) -ContentType "application/json"
  $item = Menu-Item $ph $outletId "Lime Soda"
  Invoke-RestMethod -Uri "$Base/orders/$($discOrder.id)/items" -Method POST -Headers $ph -Body (@{ menuItemId = $item.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
  $oDisc = Invoke-RestMethod -Uri "$Base/orders/$($discOrder.id)" -Headers $ph
  Invoke-RestMethod -Uri "$Base/orders/$($discOrder.id)/settle" -Method POST -Headers $ph -Body (@{
    payments = @(@{ method = "cash"; amount = [decimal]$oDisc.totalAmount - 10 })
    discountAmount = 10
  } | ConvertTo-Json -Depth 5) -ContentType "application/json" | Out-Null
}
Try-Api "Owner discount allowed" {
  $discOrder2 = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $oh -Body (@{
    outletId = $outletId; type = "takeaway"; source = "pos"
  } | ConvertTo-Json) -ContentType "application/json"
  $item = Menu-Item $oh $outletId "Lime Soda"
  Invoke-RestMethod -Uri "$Base/orders/$($discOrder2.id)/items" -Method POST -Headers $oh -Body (@{ menuItemId = $item.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
  $oDisc2 = Invoke-RestMethod -Uri "$Base/orders/$($discOrder2.id)" -Headers $oh
  $s = Invoke-RestMethod -Uri "$Base/orders/$($discOrder2.id)/settle" -Method POST -Headers $oh -Body (@{
    payments = @(@{ method = "cash"; amount = [decimal]$oDisc2.totalAmount - 5 })
    discountAmount = 5
  } | ConvertTo-Json -Depth 5) -ContentType "application/json"
  if ($s.order.status -ne "settled") { throw "not settled" }
}

# Reports consistency
$from = (Get-Date).Date.ToUniversalTime().ToString("yyyy-MM-dd")
$to = (Get-Date).Date.AddDays(1).ToUniversalTime().ToString("yyyy-MM-dd")
$sales = Invoke-RestMethod -Uri "$Base/reports/sales?outletId=$outletId&from=$from&to=$to" -Headers $oh
Record "Reports sales endpoint" ($null -ne $sales.totalRevenue) "revenue=$($sales.totalRevenue)"

# Audit operational attribution
$audits = Invoke-RestMethod -Uri "$Base/audit?limit=30" -Headers $oh
$opAudit = $audits | Where-Object { $_.metadata.authMode -eq "operational" -and $_.metadata.staffProfileId } | Select-Object -First 1
Record "Operational audit attribution" ($null -ne $opAudit) $(if ($opAudit) { $opAudit.action })

# IDOR — random order id
Expect-DenyOrNotFound "IDOR random order denied" {
  Invoke-RestMethod -Uri "$Base/orders/clxxxxxxxxxxxxxxxxxxxxxxxxx" -Headers $oh | Out-Null
}

Write-Host "`n=== Summary: $Pass passed, $Fail failed ===" -ForegroundColor $(if ($Fail -eq 0) { "Green" } else { "Yellow" })
$outFile = Join-Path $PSScriptRoot "..\docs\validation\step11\e2e-results.json"
New-Item -ItemType Directory -Force -Path (Split-Path $outFile) | Out-Null
$Results | ConvertTo-Json -Depth 4 | Set-Content $outFile
Write-Host "Results saved to $outFile"

if ($Fail -gt 0) { exit 1 }
