# Step 3 manual validation script
$Base = "http://localhost:4000/api"
$OrgId = "cmselugbk0000u978y0qjuzqq"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$KdsTerminal = "cmtpu138o004su92sw5o46nf6"
$KdsSecret = "kaana-dev-kds-01-secret"
$PosTerminal = "cmtpu1368004qu92shslo1n1k"
$PosSecret = "kaana-dev-pos-01-secret"

function Login-Email($email) {
  $body = @{ email = $email; password = "password123" } | ConvertTo-Json
  $r = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body $body -ContentType "application/json"
  return $r.accessToken
}

function Try-Platform($token, $label) {
  try {
    Invoke-RestMethod -Uri "$Base/platform/tenants" -Headers @{ Authorization = "Bearer $token" } | Out-Null
    return "$label -> ALLOWED (unexpected)"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    return "$label -> $code"
  }
}

function Get-Caps($token) {
  return Invoke-RestMethod -Uri "$Base/capabilities/me" -Headers @{ Authorization = "Bearer $token" }
}

Write-Host "=== Logins ==="
$adminToken = Login-Email "admin@kaanafoods.in"
$ownerToken = Login-Email "owner@kaanafoods.in"
$managerToken = Login-Email "manager@kaanafoods.in"
Write-Host "Admin, owner, manager tokens OK"

Write-Host "`n=== Platform authorization ==="
Write-Host (Try-Platform $ownerToken "owner")
Write-Host (Try-Platform $managerToken "manager")

# Operational PIN logins
$termHeader = @{ Authorization = "Terminal ${PosTerminal}:${PosSecret}" }
$staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers $termHeader
$biller = ($staff | Where-Object { $_.employeeCode -eq "EMP001" })[0]
$billerLogin = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers $termHeader -Body (@{ staffProfileId = $biller.id; pin = "1111" } | ConvertTo-Json) -ContentType "application/json"
Write-Host (Try-Platform $billerLogin.accessToken "biller")

$capHeader = @{ Authorization = "Terminal cmtpu13b5004uu92s5rht3ml4:kaana-dev-captain-01-secret" }
$capStaff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers $capHeader
$captain = ($capStaff | Where-Object { $_.employeeCode -eq "EMP002" })[0]
$captainLogin = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers $capHeader -Body (@{ staffProfileId = $captain.id; pin = "2222" } | ConvertTo-Json) -ContentType "application/json"
Write-Host (Try-Platform $captainLogin.accessToken "captain")

$kdsHeader = @{ Authorization = "Terminal ${KdsTerminal}:${KdsSecret}" }
$chefStaff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers $kdsHeader
$chef = ($chefStaff | Where-Object { $_.employeeCode -eq "EMP003" })[0]
$chefLogin = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers $kdsHeader -Body (@{ staffProfileId = $chef.id; pin = "3333" } | ConvertTo-Json) -ContentType "application/json"
Write-Host (Try-Platform $chefLogin.accessToken "chef")

$tenants = Invoke-RestMethod -Uri "$Base/platform/tenants" -Headers @{ Authorization = "Bearer $adminToken" }
Write-Host "super_admin tenants count: $($tenants.Count)"

Write-Host "`n=== Tenant detail / configVersion ==="
$tenant = Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId" -Headers @{ Authorization = "Bearer $adminToken" }
$v0 = $tenant.organization.configVersion
Write-Host "Initial configVersion: v$v0 mode=$($tenant.organization.operatingMode)"

$patch = @{ operatingMode = "STANDARD" } | ConvertTo-Json
$t1 = Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $adminToken" } -Body $patch -ContentType "application/json"
$v1 = $t1.organization.configVersion
Write-Host "After STANDARD: v$v1"

$patch2 = @{ operatingMode = "SIMPLE" } | ConvertTo-Json
$t2 = Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $adminToken" } -Body $patch2 -ContentType "application/json"
$v2 = $t2.organization.configVersion
Write-Host "After SIMPLE: v$v2"

Write-Host "`n=== Disable KDS ==="
$patchKds = @{ moduleOverrides = @(@{ moduleKey = "kds"; enabled = $false }) } | ConvertTo-Json -Depth 5
$t3 = Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $adminToken" } -Body $patchKds -ContentType "application/json"
$v3 = $t3.organization.configVersion
$capsOwner = Get-Caps $ownerToken
Write-Host "After KDS disable: v$v3 kds=$($capsOwner.modules.kds)"

Write-Host "`n=== Re-enable KDS (inherit) ==="
$patchKdsInherit = @{ moduleOverrides = @(@{ moduleKey = "kds"; inherit = $true }) } | ConvertTo-Json -Depth 5
$t4 = Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $adminToken" } -Body $patchKdsInherit -ContentType "application/json"
$capsOwner2 = Get-Caps $ownerToken
Write-Host "After KDS inherit: v$($t4.organization.configVersion) kds=$($capsOwner2.modules.kds)"

Write-Host "`n=== Inventory disable (procurement first) ==="
$patchProc = @{ moduleOverrides = @(@{ moduleKey = "procurement"; enabled = $false }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $adminToken" } -Body $patchProc -ContentType "application/json" | Out-Null
$patchInv = @{ moduleOverrides = @(@{ moduleKey = "inventory"; enabled = $false }) } | ConvertTo-Json -Depth 5
$t5 = Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $adminToken" } -Body $patchInv -ContentType "application/json"
$capsInv = Get-Caps $ownerToken
Write-Host "inventory=$($capsInv.modules.inventory) procurement=$($capsInv.modules.procurement)"

Write-Host "`n=== Restore inventory + procurement ==="
$restore = @{
  moduleOverrides = @(
    @{ moduleKey = "inventory"; inherit = $true },
    @{ moduleKey = "procurement"; inherit = $true }
  )
} | ConvertTo-Json -Depth 5
$t6 = Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $adminToken" } -Body $restore -ContentType "application/json"
$capsFinal = Get-Caps $ownerToken
Write-Host "Restored inventory=$($capsFinal.modules.inventory) procurement=$($capsFinal.modules.procurement)"

Write-Host "`n=== Feature override inventory.stock_transfer ==="
$featOff = @{ featureOverrides = @(@{ featureKey = "inventory.stock_transfer"; state = "DISABLED" }) } | ConvertTo-Json -Depth 5
$t7 = Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $adminToken" } -Body $featOff -ContentType "application/json"
Write-Host "stock_transfer=$($t7.capabilities.features.'inventory.stock_transfer')"
$featInherit = @{ featureOverrides = @(@{ featureKey = "inventory.stock_transfer"; inherit = $true }) } | ConvertTo-Json -Depth 5
$t8 = Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $adminToken" } -Body $featInherit -ContentType "application/json"
Write-Host "restored stock_transfer=$($t8.capabilities.features.'inventory.stock_transfer')"

Write-Host "`n=== Invalid inputs ==="
try {
  Invoke-RestMethod -Uri "$Base/platform/tenants/not-a-real-id" -Headers @{ Authorization = "Bearer $adminToken" } | Out-Null
} catch { Write-Host "invalid org: $($_.Exception.Response.StatusCode.value__)" }
try {
  $bad = @{ moduleOverrides = @(@{ moduleKey = "fake_module"; enabled = $false }) } | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $adminToken" } -Body $bad -ContentType "application/json" | Out-Null
} catch { Write-Host "bad module: $($_.Exception.Response.StatusCode.value__)" }
try {
  $badMode = @{ operatingMode = "NOPE" } | ConvertTo-Json
  Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $adminToken" } -Body $badMode -ContentType "application/json" | Out-Null
} catch { Write-Host "bad mode: $($_.Exception.Response.StatusCode.value__)" }

try {
  $badPatch = @{ operatingMode = "STANDARD" } | ConvertTo-Json
  Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId/config" -Method PATCH -Headers @{ Authorization = "Bearer $managerToken" } -Body $badPatch -ContentType "application/json" | Out-Null
  Write-Host "manager patch: ALLOWED (unexpected)"
} catch { Write-Host "manager patch: $($_.Exception.Response.StatusCode.value__)" }

$final = Invoke-RestMethod -Uri "$Base/platform/tenants/$OrgId" -Headers @{ Authorization = "Bearer $adminToken" }
Write-Host "`n=== Final Demo Restaurant ==="
Write-Host "mode=$($final.organization.operatingMode) configVersion=v$($final.organization.configVersion)"
Write-Host "kds=$($final.capabilities.modules.kds) inventory=$($final.capabilities.modules.inventory)"
Write-Host "module overrides: $($final.organization.moduleOverrides.Count)"
Write-Host "feature overrides: $($final.organization.featureOverrides.Count)"
Write-Host "recent audits: $($final.recentConfigAudits.Count)"

Write-Host "`nconfigVersion trail: v$v0 -> v$v1 -> v$v2 -> v$v3 (KDS disable)"
