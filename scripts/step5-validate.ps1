# Step 5 - Device registration and activation validation
$Base = "http://localhost:4000/api"
$OrgId = "cmselugbk0000u978y0qjuzqq"
$OutletId = "cmtpu12qg0004u92svflt7odc"
$PosTerminal = "cmtpu1368004qu92shslo1n1k"
$PosSecret = "kaana-dev-pos-01-secret"
$KdsTerminal = "cmtpu138o004su92sw5o46nf6"
$KdsSecret = "kaana-dev-kds-01-secret"
$CaptainTerminal = "cmtpu13b5004uu92s5rht3ml4"
$CaptainSecret = "kaana-dev-captain-01-secret"

function Login-Email($email) {
  $body = @{ email = $email; password = "password123" } | ConvertTo-Json
  $r = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -Body $body -ContentType "application/json"
  return $r.accessToken
}

function Try-PinLogin($termId, $secret, $employeeCode, $pin) {
  $header = @{ Authorization = "Terminal ${termId}:${secret}" }
  try {
    $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers $header
    $profile = ($staff | Where-Object { $_.employeeCode -eq $employeeCode })[0]
    if (-not $profile) {
      return "$employeeCode on $termId -> NO_ELIGIBLE_PROFILE"
    }
    $login = Invoke-RestMethod -Uri "$Base/operational/pin-login" -Method POST -Headers $header -Body (@{
      staffProfileId = $profile.id
      pin = $pin
    } | ConvertTo-Json) -ContentType "application/json"
    if ($login.accessToken) { return "$employeeCode on $termId -> ALLOWED" }
    return "$employeeCode on $termId -> DENIED (no token)"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    return "$employeeCode on $termId -> DENIED ($code)"
  }
}

function Try-TerminalAuth($termId, $secret, $label) {
  $header = @{ Authorization = "Terminal ${termId}:${secret}" }
  try {
    Invoke-RestMethod -Uri "$Base/operational/terminals/me" -Headers $header | Out-Null
    return "$label -> ALLOWED"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    return "$label -> DENIED ($code)"
  }
}

function Try-PinOnRevoked($termId, $secret, $employeeCode, $pin) {
  $header = @{ Authorization = "Terminal ${termId}:${secret}" }
  try {
    $staff = Invoke-RestMethod -Uri "$Base/operational/terminals/me/eligible-staff" -Headers $header
    return "$employeeCode after revoke -> UNEXPECTED eligible staff"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    return "Revoked terminal auth -> DENIED ($code)"
  }
}

Write-Host "=== Owner login ==="
$ownerToken = Login-Email "owner@kaanafoods.in"
$ownerHeader = @{ Authorization = "Bearer $ownerToken" }

Write-Host "`n=== Create STEP5-POS ==="
$existing = Invoke-RestMethod -Uri "$Base/terminals" -Headers $ownerHeader
$step5 = $existing | Where-Object { $_.name -eq "STEP5-POS" }
if ($step5) {
  Write-Host "STEP5-POS already exists id=$($step5.id) - reusing"
  $step5Id = $step5.id
} else {
  $created = Invoke-RestMethod -Uri "$Base/terminals" -Method POST -Headers $ownerHeader -Body (@{
    outletId = $OutletId
    name = "STEP5-POS"
    deviceType = "pos"
  } | ConvertTo-Json) -ContentType "application/json"
  $step5Id = $created.id
  Write-Host "Created STEP5-POS id=$step5Id code=$($created.code)"
}

Write-Host "`n=== Generate activation code ==="
$activation = Invoke-RestMethod -Uri "$Base/terminals/$step5Id/activation-code" -Method POST -Headers $ownerHeader
Write-Host "Code: $($activation.activationCodeDisplay) expires $($activation.expiresAt)"

Write-Host "`n=== Activate device ==="
$activated = Invoke-RestMethod -Uri "$Base/terminals/activate" -Method POST -Body (@{
  code = $activation.activationCodeDisplay
  deviceId = "step5-test-device"
  deviceMetadata = @{ appVersion = "step5-1.0.0"; platform = "web"; osVersion = "win32" }
} | ConvertTo-Json) -ContentType "application/json"
$step5Secret = $activated.deviceCredential
Write-Host "Activated terminalId=$($activated.terminalId) mode=$($activated.deviceMode)"

Write-Host "`n=== STEP5-POS PIN matrix ==="
Write-Host (Try-PinLogin $step5Id $step5Secret "EMP001" "1111")
Write-Host (Try-PinLogin $step5Id $step5Secret "EMP003" "3333")
Write-Host (Try-PinLogin $step5Id $step5Secret "EMP004" "4444")

Write-Host "`n=== Seeded terminal matrix ==="
Write-Host (Try-PinLogin $PosTerminal $PosSecret "EMP001" "1111")
Write-Host (Try-PinLogin $PosTerminal $PosSecret "EMP002" "2222")
Write-Host (Try-PinLogin $PosTerminal $PosSecret "EMP003" "3333")
Write-Host (Try-PinLogin $PosTerminal $PosSecret "EMP004" "4444")
Write-Host (Try-PinLogin $KdsTerminal $KdsSecret "EMP003" "3333")
Write-Host (Try-PinLogin $KdsTerminal $KdsSecret "EMP001" "1111")
Write-Host (Try-PinLogin $KdsTerminal $KdsSecret "EMP004" "4444")
Write-Host (Try-PinLogin $CaptainTerminal $CaptainSecret "EMP002" "2222")
Write-Host (Try-PinLogin $CaptainTerminal $CaptainSecret "EMP003" "3333")
Write-Host (Try-PinLogin $CaptainTerminal $CaptainSecret "EMP004" "4444")

Write-Host "`n=== Revoke STEP5-POS ==="
Invoke-RestMethod -Uri "$Base/terminals/$step5Id/revoke" -Method POST -Headers $ownerHeader | Out-Null
Write-Host (Try-TerminalAuth $step5Id $step5Secret "old credential after revoke")
Write-Host (Try-PinOnRevoked $step5Id $step5Secret "EMP001" "1111")

Write-Host "`n=== Reactivate STEP5-POS ==="
$activation2 = Invoke-RestMethod -Uri "$Base/terminals/$step5Id/activation-code" -Method POST -Headers $ownerHeader
$activated2 = Invoke-RestMethod -Uri "$Base/terminals/activate" -Method POST -Body (@{
  code = $activation2.activationCodeDisplay
  deviceId = "step5-test-device-2"
  deviceMetadata = @{ appVersion = "step5-1.0.1"; platform = "web" }
} | ConvertTo-Json) -ContentType "application/json"
$newSecret = $activated2.deviceCredential
Write-Host (Try-TerminalAuth $step5Id $newSecret "new credential")
Write-Host (Try-TerminalAuth $step5Id $step5Secret "old credential after reactivation")

Write-Host "`n=== Heartbeat ==="
$hbHeader = @{ Authorization = "Terminal ${step5Id}:${newSecret}" }
$hb = Invoke-RestMethod -Uri "$Base/terminals/heartbeat" -Method POST -Headers $hbHeader -Body (@{
  deviceId = "step5-test-device-2"
  appVersion = "step5-1.0.1"
  platform = "web"
} | ConvertTo-Json) -ContentType "application/json"
Write-Host "Heartbeat status=$($hb.status) lastSeen=$($hb.lastSeenAt)"

Write-Host "`n=== Cross-tenant (owner cannot access other org terminal) ==="
try {
  Invoke-RestMethod -Uri "$Base/terminals/not-a-real-terminal-id/activation-code" -Method POST -Headers $ownerHeader | Out-Null
  Write-Host "cross-tenant activation -> UNEXPECTED ALLOW"
} catch {
  Write-Host "cross-tenant / invalid terminal -> $($_.Exception.Response.StatusCode.value__)"
}

Write-Host "`n=== List devices (owner) ==="
$list = Invoke-RestMethod -Uri "$Base/terminals" -Headers $ownerHeader
$step5Row = $list | Where-Object { $_.id -eq $step5Id }
Write-Host "STEP5-POS status=$($step5Row.registrationStatus) health=$($step5Row.healthStatus) app=$($step5Row.appVersion)"

Write-Host "`n=== Seeded terminals unchanged ==="
foreach ($code in @("POS-01", "KDS-01", "CAPTAIN-01")) {
  $row = $list | Where-Object { $_.code -eq $code }
  Write-Host "$code registered=$($row.isRegistered) revoked=$([bool]$row.revokedAt)"
}

Write-Host "`nStep 5 validation complete."
