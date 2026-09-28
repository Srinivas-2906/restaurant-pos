# Step 10.3 — Captain/POS order helpers (API only)
param(
  [ValidateSet("table2", "second-kot", "pos-takeaway", "verify-kots")]
  [string]$Action = "table2",
  [string]$OrderId = ""
)

$ErrorActionPreference = "Stop"
$Base = "http://localhost:4000/api"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$CaptainTerminalId = "cmtpu13b5004uu92s5rht3ml4"
$CaptainSecret = "kaana-dev-captain-01-secret"
$PosTerminalId = "cmtpu1368004qu92shslo1n1k"
$PosSecret = "kaana-dev-pos-01-secret"

function CaptainAuth {
  $auth = "Terminal ${CaptainTerminalId}:${CaptainSecret}"
  $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $auth }
  $emp = $staff | Where-Object { $_.employeeCode -eq "EMP002" } | Select-Object -First 1
  $pin = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $auth } `
    -Body (@{ staffProfileId = $emp.id; pin = "2222" } | ConvertTo-Json) -ContentType "application/json"
  return @{ Authorization = "Bearer $($pin.accessToken)" }
}

function PosAuth {
  $auth = "Terminal ${PosTerminalId}:${PosSecret}"
  $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers @{ Authorization = $auth }
  $cash = $staff | Where-Object { $_.employeeCode -eq "EMP001" } | Select-Object -First 1
  $pin = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers @{ Authorization = $auth } `
    -Body (@{ staffProfileId = $cash.id; pin = "1111" } | ConvertTo-Json) -ContentType "application/json"
  return @{ Authorization = "Bearer $($pin.accessToken)" }
}

function MenuItem($headers, $name) {
  $menu = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/menu" -Headers $headers
  foreach ($m in $menu) {
    foreach ($cat in $m.categories) {
      $item = $cat.items | Where-Object { $_.name -like "*$name*" } | Select-Object -First 1
      if ($item) { return $item }
    }
  }
  throw "Menu item not found: $name"
}

$ch = CaptainAuth

switch ($Action) {
  "table2" {
    $floor = Invoke-RestMethod -Uri "$Base/outlets/$OutletId/floor" -Headers $ch
    $t2 = $floor.tables | Where-Object { $_.number -eq "2" } | Select-Object -First 1
    $biryani = MenuItem $ch "Chicken Biryani"
    $soda = MenuItem $ch "Lime Soda"
    $order = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $ch `
      -Body (@{ outletId = $OutletId; type = "dine_in"; source = "captain"; tableId = $t2.id; guestCount = 2 } | ConvertTo-Json) `
      -ContentType "application/json"
    Invoke-RestMethod -Uri "$Base/orders/$($order.id)/items" -Method POST -Headers $ch `
      -Body (@{ menuItemId = $biryani.id; quantity = 1; notes = "Less spicy" } | ConvertTo-Json) -ContentType "application/json" | Out-Null
    Invoke-RestMethod -Uri "$Base/orders/$($order.id)/items" -Method POST -Headers $ch `
      -Body (@{ menuItemId = $soda.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
    $fire = Invoke-RestMethod -Uri "$Base/orders/$($order.id)/kot" -Method POST -Headers $ch -ContentType "application/json"
    @{ orderId = $order.id; kotIds = @($fire.kots | ForEach-Object { $_.id }); kotNumbers = @($fire.kots | ForEach-Object { $_.kotNumber }) } | ConvertTo-Json | Write-Output
  }
  "second-kot" {
    if (-not $OrderId) { throw "OrderId required" }
    $naan = MenuItem $ch "Butter Naan"
    Invoke-RestMethod -Uri "$Base/orders/$OrderId/items" -Method POST -Headers $ch `
      -Body (@{ menuItemId = $naan.id; quantity = 2 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
    $fire = Invoke-RestMethod -Uri "$Base/orders/$OrderId/kot" -Method POST -Headers $ch -ContentType "application/json"
    @{ orderId = $OrderId; kotIds = @($fire.kots | ForEach-Object { $_.id }); kotNumbers = @($fire.kots | ForEach-Object { $_.kotNumber }) } | ConvertTo-Json | Write-Output
  }
  "pos-takeaway" {
    $ph = PosAuth
    $paneer = MenuItem $ph "Paneer"
    $order = Invoke-RestMethod -Uri "$Base/orders" -Method POST -Headers $ph `
      -Body (@{ outletId = $OutletId; type = "takeaway"; source = "pos" } | ConvertTo-Json) -ContentType "application/json"
    Invoke-RestMethod -Uri "$Base/orders/$($order.id)/items" -Method POST -Headers $ph `
      -Body (@{ menuItemId = $paneer.id; quantity = 1 } | ConvertTo-Json) -ContentType "application/json" | Out-Null
    $fire = Invoke-RestMethod -Uri "$Base/orders/$($order.id)/kot" -Method POST -Headers $ph -ContentType "application/json"
    @{ orderId = $order.id; kotNumbers = @($fire.kots | ForEach-Object { $_.kotNumber }) } | ConvertTo-Json | Write-Output
  }
  "verify-kots" {
    if (-not $OrderId) { throw "OrderId required" }
    $owner = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST `
      -Body (@{ email = "owner@kaanafoods.in"; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
    $oh = @{ Authorization = "Bearer $($owner.accessToken)" }
    $o = Invoke-RestMethod -Uri "$Base/orders/$OrderId" -Headers $oh
    $o.kots | ForEach-Object { [PSCustomObject]@{ kotNumber = $_.kotNumber; status = $_.status; station = $_.kitchenStation.name } } | ConvertTo-Json
  }
}
