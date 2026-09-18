# Build a standalone Android release APK for a physical device on the same Wi-Fi.
# Usage:
#   powershell -File scripts\build-device-apk.ps1
#   powershell -File scripts\build-device-apk.ps1 -LanIp 192.168.1.42
#   powershell -File scripts\build-device-apk.ps1 -Variant debug   # faster, needs Metro

param(
  [string]$LanIp = "",
  [ValidateSet("release", "debug")]
  [string]$Variant = "release"
)

$ErrorActionPreference = "Stop"
$RepoRoot = "C:\Users\kanas\Kaana-foods"
$MobileRoot = "$RepoRoot\apps\kaana-mobile"
$AndroidRoot = "$MobileRoot\android"
$OutDir = "$MobileRoot\dist"

if (-not $LanIp) {
  $LanIp = (
    Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.InterfaceAlias -notlike "*WSL*" -and
        $_.InterfaceAlias -notlike "*Hyper-V*" -and
        $_.InterfaceAlias -notlike "*Default Switch*"
      } |
      Select-Object -First 1
  ).IPAddress
}

if (-not $LanIp) {
  throw "Could not detect LAN IP. Pass -LanIp explicitly."
}

$env:EXPO_PUBLIC_API_URL = "http://${LanIp}:4000/api"
$env:EXPO_PUBLIC_WS_URL = "http://${LanIp}:4000/events"

Write-Host "=== Kaana Mobile device APK build ==="
Write-Host "LAN IP:       $LanIp"
Write-Host "API URL:      $env:EXPO_PUBLIC_API_URL"
Write-Host "Variant:      $Variant"
Write-Host ""

. "$MobileRoot\scripts\android-env.ps1"

$localProps = "$AndroidRoot\local.properties"
if (-not (Test-Path $localProps)) {
  "sdk.dir=$($env:ANDROID_HOME -replace '\\','/')" | Set-Content $localProps
}

Set-Location $MobileRoot
$env:NODE_ENV = if ($Variant -eq "release") { "production" } else { "development" }

if ($Variant -eq "release") {
  Write-Host "Pre-bundling JS from $MobileRoot ..."
  Set-Location $MobileRoot
  npx expo export:embed --eager --platform android --dev false | Out-Host
}

$task = if ($Variant -eq "debug") { "assembleDebug" } else { "assembleRelease" }
Write-Host "Running gradlew $task ..."
Set-Location $AndroidRoot
.\gradlew.bat $task --no-daemon
Set-Location $MobileRoot

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$srcApk = if ($Variant -eq "debug") {
  "$AndroidRoot\app\build\outputs\apk\debug\app-debug.apk"
} else {
  "$AndroidRoot\app\build\outputs\apk\release\app-release.apk"
}

if (-not (Test-Path $srcApk)) {
  throw "APK not found at $srcApk"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$destName = "kaana-mobile-$Variant-$stamp.apk"
$destApk = "$OutDir\$destName"
Copy-Item $srcApk $destApk -Force

$requirements = @(
  "Phone and PC on same Wi-Fi",
  "API running at http://${LanIp}:4000",
  "Windows firewall allows inbound TCP 4000"
)
if ($Variant -eq "debug") {
  $requirements += "Metro running: npm run dev -w @kaana/kaana-mobile -- --host lan"
} else {
  $requirements += "Release APK - no Metro required"
}

@{
  builtAt = (Get-Date).ToUniversalTime().ToString("o")
  variant = $Variant
  lanIp = $LanIp
  apiUrl = $env:EXPO_PUBLIC_API_URL
  wsUrl = $env:EXPO_PUBLIC_WS_URL
  apkPath = $destApk
  installHint = "adb install -r `"$destApk`""
  requirements = $requirements
} | ConvertTo-Json -Depth 4 | Set-Content "$OutDir\latest-device-build.json"

Write-Host ""
Write-Host "=== BUILD OK ==="
Write-Host "APK: $destApk"
Write-Host "Install: adb install -r `"$destApk`""
Write-Host "Or copy APK to phone and open it (enable Install unknown apps)."
