# Step 4 Operations Web capability validation (API-level)
$Base = "http://localhost:4000/api"
$OrgId = "cmselugbk0000u978y0qjuzqq"

function Login($email) {
  return (Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body (@{ email = $email; password = "password123" } | ConvertTo-Json) -ContentType "application/json")
}

function Get-Caps($token) {
  return (Invoke-RestMethod -Uri "$Base/capabilities/me" -Headers @{ Authorization = "Bearer $($token.accessToken)" }).data
}

Write-Host "=== Login bootstrap ==="
$owner = Login "owner@kaanafoods.in"
$manager = Login "manager@kaanafoods.in"
$ownerCaps = Get-Caps $owner
Write-Host "Owner login OK | mode=$($ownerCaps.operatingMode) configVersion=$($ownerCaps.configVersion) navDepth=$($ownerCaps.navDepth)"
Write-Host "Owner modules enabled:" ($ownerCaps.modules.PSObject.Properties | Where-Object { $_.Value -eq $true } | ForEach-Object { $_.Name }) -Separator ", "
Write-Host "Manager login OK | roles=$($manager.user.roles.role -join ',')"

$admin = Login "admin@kaanafoods.in"

Write-Host "`n=== Disable procurement + inventory ==="
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $($admin.accessToken)" } -Body '{"moduleOverrides":[{"moduleKey":"procurement","enabled":false}]}' -ContentType "application/json" | Out-Null
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $($admin.accessToken)" } -Body '{"moduleOverrides":[{"moduleKey":"inventory","enabled":false}]}' -ContentType "application/json" | Out-Null
$afterInv = Get-Caps $owner
Write-Host "After disable: inventory=$($afterInv.modules.inventory) procurement=$($afterInv.modules.procurement) configVersion=$($afterInv.configVersion)"

Write-Host "`n=== Restore inventory + procurement ==="
$restore = '{"moduleOverrides":[{"moduleKey":"inventory","inherit":true},{"moduleKey":"procurement","inherit":true}]}'
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $($admin.accessToken)" } -Body $restore -ContentType "application/json" | Out-Null

Write-Host "`n=== Disable payroll ==="
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $($admin.accessToken)" } -Body '{"moduleOverrides":[{"moduleKey":"payroll","enabled":false}]}' -ContentType "application/json" | Out-Null
$afterPayroll = Get-Caps $owner
Write-Host "payroll=$($afterPayroll.modules.payroll)"
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $($admin.accessToken)" } -Body '{"moduleOverrides":[{"moduleKey":"payroll","inherit":true}]}' -ContentType "application/json" | Out-Null

Write-Host "`n=== Feature-only: inventory.stock_transfer ==="
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $($admin.accessToken)" } -Body '{"featureOverrides":[{"featureKey":"inventory.stock_transfer","state":"DISABLED"}]}' -ContentType "application/json" | Out-Null
$afterFeat = Get-Caps $owner
Write-Host "inventory=$($afterFeat.modules.inventory) stock_transfer=$($afterFeat.features.'inventory.stock_transfer')"
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $($admin.accessToken)" } -Body '{"featureOverrides":[{"featureKey":"inventory.stock_transfer","inherit":true}]}' -ContentType "application/json" | Out-Null

Write-Host "`n=== Mode SIMPLE -> STANDARD -> SIMPLE ==="
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $($admin.accessToken)" } -Body '{"operatingMode":"STANDARD"}' -ContentType "application/json" | Out-Null
$std = Get-Caps $owner
Write-Host "STANDARD navDepth=$($std.navDepth)"
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $($admin.accessToken)" } -Body '{"operatingMode":"SIMPLE"}' -ContentType "application/json" | Out-Null
$final = Get-Caps $owner
Write-Host "FINAL mode=$($final.operatingMode) navDepth=$($final.navDepth) inventory=$($final.modules.inventory) payroll=$($final.modules.payroll)"
