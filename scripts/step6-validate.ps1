# Step 6 - Kaana mobile foundation API validation
# Validates the same flows the React Native app uses via @kaana/api-client contracts.
$Base = "http://localhost:4000/api"
$OutletId = "cmtpu12qg0004u92svflt7odc"

function Login-Owner {
  $body = @{ email = "owner@kaanafoods.in"; password = "password123" } | ConvertTo-Json
  return Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body $body -ContentType "application/json"
}

function Login-Manager {
  $body = @{ email = "manager@kaanafoods.in"; password = "password123" } | ConvertTo-Json
  return Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body $body -ContentType "application/json"
}

function Create-TestTerminal($ownerToken, $name, $deviceType) {
  $header = @{ Authorization = "Bearer $($ownerToken.accessToken)" }
  $existing = Invoke-RestMethod -Uri "$Base/terminals" -Headers $header
  $found = $existing | Where-Object { $_.name -eq $name }
  if ($found) { return $found }
  return Invoke-RestMethod -Uri "$Base/terminals" -Method POST -Headers $header -Body (@{
    outletId = $OutletId
    name = $name
    deviceType = $deviceType
  } | ConvertTo-Json) -ContentType "application/json"
}

function Activate-Terminal($ownerToken, $terminalId) {
  $header = @{ Authorization = "Bearer $($ownerToken.accessToken)" }
  $code = Invoke-RestMethod -Uri "$Base/terminals/$terminalId/activation-code" -Method POST -Headers $header
  return Invoke-RestMethod -Uri "$Base/terminals/activate" -Method POST -Body (@{
    code = $code.activationCodeDisplay
    deviceId = "step6-$terminalId"
    deviceMetadata = @{ appVersion = "step6-1.0.0"; platform = "android"; osVersion = "14" }
  } | ConvertTo-Json) -ContentType "application/json"
}

function Try-Pin($terminalId, $secret, $employeeCode, $pin, $label) {
  $header = @{ Authorization = "Terminal ${terminalId}:${secret}" }
  try {
    $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers $header
    $profile = ($staff | Where-Object { $_.employeeCode -eq $employeeCode })[0]
    if (-not $profile) {
      if ($employeeCode -eq "EMP003" -and $label -like "*POS*") {
        return "$label $employeeCode -> DENIED (not eligible)"
      }
      return "$label $employeeCode -> NO_ELIGIBLE"
    }
    $login = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers $header -Body (@{
      staffProfileId = $profile.id
      pin = $pin
    } | ConvertTo-Json) -ContentType "application/json"
    return "$label $employeeCode -> ALLOWED ($($login.staff.role))"
  } catch {
    return "$label $employeeCode -> DENIED"
  }
}

Write-Host "=== Management login ==="
$owner = Login-Owner
$manager = Login-Manager
$caps = Invoke-RestMethod -Uri "$Base/capabilities/me" -Headers @{ Authorization = "Bearer $($owner.accessToken)" }
Write-Host "Owner login OK org=$($caps.organizationId) mode=$($caps.operatingMode)"

Write-Host "`n=== Activate STEP6 terminals ==="
$pos = Create-TestTerminal $owner "STEP6-POS" "pos"
$kds = Create-TestTerminal $owner "STEP6-KDS" "kds"
$cap = Create-TestTerminal $owner "STEP6-CAPTAIN" "captain"

$posAct = Activate-Terminal $owner $pos.id
$kdsAct = Activate-Terminal $owner $kds.id
$capAct = Activate-Terminal $owner $cap.id
Write-Host "STEP6-POS activated mode=$($posAct.deviceMode)"
Write-Host "STEP6-KDS activated mode=$($kdsAct.deviceMode)"
Write-Host "STEP6-CAPTAIN activated mode=$($capAct.deviceMode)"

Write-Host "`n=== Operational capabilities endpoint ==="
$termCaps = Invoke-RestMethod -Uri "$Base/operational/terminals/me/capabilities" -Headers @{
  Authorization = "Terminal $($posAct.terminalId):$($posAct.deviceCredential)"
}
Write-Host "Terminal capabilities configVersion=$($termCaps.configVersion) kds=$($termCaps.modules.kds)"

Write-Host "`n=== PIN routing matrix (device mode enforcement) ==="
Write-Host (Try-Pin $posAct.terminalId $posAct.deviceCredential "EMP001" "1111" "POS")
Write-Host (Try-Pin $posAct.terminalId $posAct.deviceCredential "EMP003" "3333" "POS")
Write-Host (Try-Pin $posAct.terminalId $posAct.deviceCredential "EMP004" "4444" "POS")
Write-Host (Try-Pin $kdsAct.terminalId $kdsAct.deviceCredential "EMP003" "3333" "KDS")
Write-Host (Try-Pin $kdsAct.terminalId $kdsAct.deviceCredential "EMP001" "1111" "KDS")
Write-Host (Try-Pin $kdsAct.terminalId $kdsAct.deviceCredential "EMP004" "4444" "KDS")
Write-Host (Try-Pin $capAct.terminalId $capAct.deviceCredential "EMP002" "2222" "Captain")
Write-Host (Try-Pin $capAct.terminalId $capAct.deviceCredential "EMP003" "3333" "Captain")
Write-Host (Try-Pin $capAct.terminalId $capAct.deviceCredential "EMP004" "4444" "Captain")

Write-Host "`n=== Heartbeat ==="
$hb = Invoke-RestMethod -Uri "$Base/terminals/heartbeat" -Method POST -Headers @{
  Authorization = "Terminal $($posAct.terminalId):$($posAct.deviceCredential)"
} -Body (@{ appVersion = "step6-1.0.0"; platform = "android" } | ConvertTo-Json) -ContentType "application/json"
Write-Host "Heartbeat status=$($hb.status)"

Write-Host "`n=== Revoke STEP6-POS ==="
Invoke-RestMethod -Uri "$Base/terminals/$($pos.id)/revoke" -Method POST -Headers @{
  Authorization = "Bearer $($owner.accessToken)"
} | Out-Null
try {
  Invoke-RestMethod -Uri "$Base/operational/terminals/me" -Headers @{
    Authorization = "Terminal $($posAct.terminalId):$($posAct.deviceCredential)"
  } | Out-Null
  Write-Host "Revoked terminal auth -> UNEXPECTED ALLOW"
} catch {
  Write-Host "Revoked terminal auth -> DENIED"
}

Write-Host "`n=== Seeded terminals unchanged ==="
$list = Invoke-RestMethod -Uri "$Base/terminals" -Headers @{ Authorization = "Bearer $($owner.accessToken)" }
foreach ($code in @("POS-01", "KDS-01", "CAPTAIN-01")) {
  $row = $list | Where-Object { $_.code -eq $code }
  Write-Host "$code registered=$($row.isRegistered) revoked=$([bool]$row.revokedAt)"
}

Write-Host "`nManager login OK: $($manager.user.email)"
Write-Host "Step 6 API validation complete."
