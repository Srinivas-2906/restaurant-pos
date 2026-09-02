#Requires -Version 5.1
<#
.SYNOPSIS
  First-time and repeat deploy of Kaana API + four web apps to Cloud Run.
.NOTES
  Run from the repo root after `gcloud auth login`.
  No secrets are written to git.
#>
param(
  [string]$ProjectId = "",
  [string]$Region = "",
  [switch]$SkipSeed,
  [switch]$SkipInfra
)

$ErrorActionPreference = "Continue"
$PSNativeCommandUseErrorActionPreference = $false

function Invoke-Gcloud {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GcloudArgs)
  $old = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & gcloud @GcloudArgs
    if ($LASTEXITCODE -ne 0) {
      throw "gcloud $($GcloudArgs -join ' ') failed with exit $LASTEXITCODE"
    }
  } finally {
    $ErrorActionPreference = $old
  }
}

function Get-GcloudValue {
  param([string[]]$GcloudArgs)
  $old = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $raw = & gcloud @GcloudArgs 2>$null
    if ($LASTEXITCODE -ne 0) { throw "gcloud $($GcloudArgs -join ' ') failed" }
    $lines = @(
      @($raw) |
        ForEach-Object { "$_".Trim() } |
        Where-Object { $_ -and $_ -notmatch "active configuration" -and $_ -ne "(unset)" }
    )
    if ($lines.Count -eq 0) { return "" }
    return [string]$lines[$lines.Count - 1]
  } finally {
    $ErrorActionPreference = $old
  }
}

function Test-GcloudResource {
  param([string[]]$GcloudArgs)
  $old = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & gcloud @GcloudArgs 1>$null 2>$null
    return ($LASTEXITCODE -eq 0)
  } finally {
    $ErrorActionPreference = $old
  }
}

function New-RandomSecret {
  param([int]$Length = 32)
  $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  $bytes = New-Object byte[] $Length
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Ensure-Secret {
  param([string]$Name, [string]$Value)
  if (Test-GcloudResource "secrets", "describe", $Name, "--project", $script:ProjectId) {
    Write-Host "Secret $Name already exists"
    return
  }
  $tmp = New-TemporaryFile
  Set-Content -Path $tmp -Value $Value -NoNewline
  Invoke-Gcloud secrets create $Name --data-file=$tmp --project $script:ProjectId --quiet
  Remove-Item $tmp -Force
}

function Get-SecretValue {
  param([string]$Name)
  return Get-GcloudValue "secrets", "versions", "access", "latest", "--secret", $Name, "--project", $script:ProjectId
}

function Get-ServiceUrl {
  param([string]$Service)
  return Get-GcloudValue "run", "services", "describe", $Service, "--project", $script:ProjectId, "--region", $script:Region, "--format", "value(status.url)"
}

function Submit-ApiImage {
  param([string]$Image)
  Invoke-Gcloud builds submit `
    --project $script:ProjectId `
    --config deploy/cloudbuild.api.yaml `
    --substitutions "_IMAGE=$Image" `
    --quiet
}

function Submit-WebImage {
  param(
    [string]$Image,
    [string]$AppDir,
    [string]$AppName,
    [hashtable]$Public
  )
  $subs = @(
    "_IMAGE=$Image",
    "_APP_DIR=$AppDir",
    "_APP_NAME=$AppName",
    "_NEXT_PUBLIC_API_URL=$($Public.Api)",
    "_NEXT_PUBLIC_WS_URL=$($Public.Ws)",
    "_NEXT_PUBLIC_HUB_URL=$($Public.Hub)",
    "_NEXT_PUBLIC_OPERATIONS_WEB_URL=$($Public.Ops)",
    "_NEXT_PUBLIC_POS_WEB_URL=$($Public.Pos)",
    "_NEXT_PUBLIC_KDS_WEB_URL=$($Public.Kds)",
    "_NEXT_PUBLIC_CAPTAIN_WEB_URL=$($Public.Captain)"
  ) -join ","
  Invoke-Gcloud builds submit `
    --project $script:ProjectId `
    --config deploy/cloudbuild.web.yaml `
    --substitutions $subs `
    --quiet
}

function Deploy-RunService {
  param(
    [string]$Name,
    [string]$Image,
    [string]$Memory,
    [string]$Cpu,
    [int]$Timeout = 300,
    [hashtable]$EnvMap = @{},
    [string[]]$Secrets = @(),
    [string]$CloudSql = "",
    [string]$ServiceAccount = "",
    [switch]$SessionAffinity
  )
  $gcloudArgs = @(
    "run", "deploy", $Name,
    "--project", $script:ProjectId,
    "--region", $script:Region,
    "--image", $Image,
    "--platform", "managed",
    "--allow-unauthenticated",
    "--port", "8080",
    "--memory", $Memory,
    "--cpu", $Cpu,
    "--timeout", "$Timeout",
    "--min-instances", "0",
    "--max-instances", "10",
    "--no-invoker-iam-check",
    "--quiet"
  )
  $envFile = $null
  if ($EnvMap.Count -gt 0) {
    $envFile = New-TemporaryFile
    $lines = $EnvMap.GetEnumerator() | ForEach-Object { "$($_.Key): $($_.Value)" }
    Set-Content -Path $envFile -Value ($lines -join "`n")
    $gcloudArgs += @("--env-vars-file", "$envFile")
  }
  if ($Secrets.Count -gt 0) { $gcloudArgs += @("--set-secrets", ($Secrets -join ",")) }
  if ($CloudSql) { $gcloudArgs += @("--add-cloudsql-instances", $CloudSql) }
  if ($ServiceAccount) { $gcloudArgs += @("--service-account", $ServiceAccount) }
  if ($SessionAffinity) { $gcloudArgs += "--session-affinity" }
  try {
    Invoke-Gcloud @gcloudArgs
  } finally {
    if ($envFile) { Remove-Item $envFile -Force -ErrorAction SilentlyContinue }
  }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not $ProjectId) {
  $ProjectId = Get-GcloudValue "config", "get-value", "project"
}
if (-not $ProjectId -or $ProjectId -eq "(unset)") {
  throw "Set a GCP project: gcloud config set project YOUR_PROJECT_ID"
}

if (-not $Region) {
  $Region = (Get-GcloudValue "config", "get-value", "compute/region")
}
if (-not $Region -or $Region -eq "(unset)") {
  $Region = "asia-south1"
}

$script:ProjectId = $ProjectId
$script:Region = $Region
$Instance = "kaana-pg"
$Repo = "kaana-docker"
$Connection = "${ProjectId}:${Region}:${Instance}"
$Registry = "${Region}-docker.pkg.dev/${ProjectId}/${Repo}"
$ApiImage = "${Registry}/kaana-api:latest"
$ApiRunnerSa = "kaana-api-runner@${ProjectId}.iam.gserviceaccount.com"

Write-Host "Project=$ProjectId Region=$Region"

if (-not $SkipInfra) {
  Write-Host "Enabling APIs..."
  Invoke-Gcloud services enable `
    run.googleapis.com `
    artifactregistry.googleapis.com `
    sqladmin.googleapis.com `
    secretmanager.googleapis.com `
    cloudbuild.googleapis.com `
    --project $ProjectId --quiet

  if (-not (Test-GcloudResource "artifacts", "repositories", "describe", $Repo, "--location", $Region, "--project", $ProjectId)) {
    Write-Host "Creating Artifact Registry $Repo..."
    Invoke-Gcloud artifacts repositories create $Repo `
      --repository-format=docker `
      --location $Region `
      --project $ProjectId `
      --quiet
  }

  $ProjectNumber = Get-GcloudValue "projects", "describe", $ProjectId, "--format", "value(projectNumber)"
  $ComputeSa = "${ProjectNumber}-compute@developer.gserviceaccount.com"
  $BuildSa = "${ProjectNumber}@cloudbuild.gserviceaccount.com"
  if (-not (Test-GcloudResource "iam", "service-accounts", "describe", $ApiRunnerSa)) {
    Invoke-Gcloud iam service-accounts create kaana-api-runner --display-name "Kaana API Cloud Run" --quiet
  }
  foreach ($sa in @($ApiRunnerSa, $ComputeSa)) {
    Invoke-Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$sa" --role="roles/cloudsql.client" --quiet | Out-Null
    Invoke-Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$sa" --role="roles/secretmanager.secretAccessor" --quiet | Out-Null
  }
  Invoke-Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$BuildSa" --role="roles/artifactregistry.writer" --quiet | Out-Null
  Invoke-Gcloud iam service-accounts add-iam-policy-binding $ApiRunnerSa --member="serviceAccount:$ComputeSa" --role="roles/iam.serviceAccountUser" --quiet | Out-Null

  if (-not (Test-GcloudResource "sql", "instances", "describe", $Instance, "--project", $ProjectId)) {
    Write-Host "Creating Cloud SQL $Instance (this can take several minutes)..."
    $rootPassword = New-RandomSecret 24
    Invoke-Gcloud sql instances create $Instance `
      --database-version=POSTGRES_16 `
      --edition=ENTERPRISE `
      --tier=db-f1-micro `
      --region $Region `
      --project $ProjectId `
      --storage-size=10 `
      --root-password=$rootPassword `
      --quiet
  }

  $dbPassword = $null
  if (Test-GcloudResource "secrets", "describe", "KAANA_DB_PASSWORD", "--project", $ProjectId) {
    $dbPassword = Get-SecretValue "KAANA_DB_PASSWORD"
  } else {
    $dbPassword = New-RandomSecret 24
    Ensure-Secret -Name "KAANA_DB_PASSWORD" -Value $dbPassword
  }

  $dbExists = $false
  $dbList = & gcloud sql databases list --instance $Instance --project $ProjectId --format="value(name)"
  if ($dbList -match "kaana_foods") { $dbExists = $true }
  if (-not $dbExists) {
    Invoke-Gcloud sql databases create kaana_foods --instance $Instance --project $ProjectId --quiet
  }

  $userList = & gcloud sql users list --instance $Instance --project $ProjectId --format="value(name)"
  if ($userList -match "^kaana$") {
    Invoke-Gcloud sql users set-password kaana --instance $Instance --project $ProjectId --password $dbPassword --quiet
  } else {
    Invoke-Gcloud sql users create kaana --instance $Instance --project $ProjectId --password $dbPassword --quiet
  }

  $databaseUrl = "postgresql://kaana:${dbPassword}@localhost/kaana_foods?host=/cloudsql/${Connection}&schema=public"
  if (-not (Test-GcloudResource "secrets", "describe", "DATABASE_URL", "--project", $ProjectId)) {
    Ensure-Secret -Name "DATABASE_URL" -Value $databaseUrl
  }
  Ensure-Secret -Name "JWT_SECRET" -Value (New-RandomSecret 48)
  Ensure-Secret -Name "JWT_REFRESH_SECRET" -Value (New-RandomSecret 48)
}

Write-Host "Building API image..."
Submit-ApiImage -Image $ApiImage

Write-Host "Deploying API..."
Deploy-RunService -Name "kaana-api" -Image $ApiImage -Memory "1Gi" -Cpu "1" -Timeout 3600 `
  -EnvMap @{ NODE_ENV = "production"; JWT_EXPIRES_IN = "15m"; JWT_REFRESH_EXPIRES_IN = "7d" } `
  -Secrets @("DATABASE_URL=DATABASE_URL:latest", "JWT_SECRET=JWT_SECRET:latest", "JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest") `
  -CloudSql $Connection `
  -ServiceAccount $ApiRunnerSa `
  -SessionAffinity

$ApiUrl = Get-ServiceUrl "kaana-api"
$ApiPublic = "$ApiUrl/api"
$WsPublic = "$ApiUrl/events"
Write-Host "API: $ApiUrl"

if (-not $SkipSeed) {
  Write-Host "Pushing schema (Cloud SQL Auth Proxy)..."
  $proxy = Get-Command cloud-sql-proxy -ErrorAction SilentlyContinue
  $proxyExe = $null
  if ($proxy) {
    $proxyExe = $proxy.Source
  } else {
    $proxyExe = Join-Path $env:TEMP "cloud-sql-proxy.exe"
    if (-not (Test-Path $proxyExe)) {
      curl.exe -L --retry 3 -o $proxyExe "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.25.3/cloud-sql-proxy.x64.exe"
    }
  }
  $proxyProc = Start-Process -FilePath $proxyExe -ArgumentList @($Connection, "--port=6543", "--gcloud-auth") -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 4
  try {
    $plainPassword = Get-SecretValue "KAANA_DB_PASSWORD"
    $env:DATABASE_URL = "postgresql://kaana:${plainPassword}@127.0.0.1:6543/kaana_foods?schema=public"
    npx prisma db push --schema=packages/database/prisma/schema.prisma --skip-generate
    if ($LASTEXITCODE -ne 0) { throw "prisma db push failed" }
    npm run db:seed -w @kaana/database
    if ($LASTEXITCODE -ne 0) { Write-Warning "Seed failed (database may already be populated). Continuing." }
  } finally {
    if ($proxyProc -and -not $proxyProc.HasExited) { Stop-Process -Id $proxyProc.Id -Force }
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  }
}

$Public = @{
  Api = $ApiPublic
  Ws = $WsPublic
  Hub = "http://localhost:4100"
  Ops = "http://localhost:3010"
  Pos = "http://localhost:3001"
  Kds = "http://localhost:3002"
  Captain = "http://localhost:3003"
}

$WebApps = @(
  @{ Name = "kaana-operations-web"; Dir = "apps/operations-web"; Pkg = "@kaana/operations-web" },
  @{ Name = "kaana-pos-web"; Dir = "apps/pos-web"; Pkg = "@kaana/pos-web" },
  @{ Name = "kaana-kds-web"; Dir = "apps/kds-web"; Pkg = "@kaana/kds-web" },
  @{ Name = "kaana-captain-web"; Dir = "apps/captain-web"; Pkg = "@kaana/captain-web" }
)

foreach ($app in $WebApps) {
  if (Test-GcloudResource "run", "services", "describe", $app.Name, "--project", $ProjectId, "--region", $Region) {
    $url = Get-ServiceUrl $app.Name
    switch ($app.Name) {
      "kaana-operations-web" { $Public.Ops = $url }
      "kaana-pos-web" { $Public.Pos = $url }
      "kaana-kds-web" { $Public.Kds = $url }
      "kaana-captain-web" { $Public.Captain = $url }
    }
  }
}

Write-Host "Building and deploying web apps..."
foreach ($app in $WebApps) {
  $image = "$Registry/$($app.Name):latest"
  Submit-WebImage -Image $image -AppDir $app.Dir -AppName $app.Pkg -Public $Public
  Deploy-RunService -Name $app.Name -Image $image -Memory "512Mi" -Cpu "1" -Timeout 300 -EnvMap @{ NODE_ENV = "production" }
  $url = Get-ServiceUrl $app.Name
  switch ($app.Name) {
    "kaana-operations-web" { $Public.Ops = $url }
    "kaana-pos-web" { $Public.Pos = $url }
    "kaana-kds-web" { $Public.Kds = $url }
    "kaana-captain-web" { $Public.Captain = $url }
  }
  Write-Host "$($app.Name): $url"
}

Write-Host "Rebuilding web apps with production URLs..."
foreach ($app in $WebApps) {
  $image = "$Registry/$($app.Name):latest"
  Submit-WebImage -Image $image -AppDir $app.Dir -AppName $app.Pkg -Public $Public
  Deploy-RunService -Name $app.Name -Image $image -Memory "512Mi" -Cpu "1" -Timeout 300 -EnvMap @{ NODE_ENV = "production" }
}

$cors = @($Public.Ops, $Public.Pos, $Public.Kds, $Public.Captain) -join ","
Write-Host "Updating API CORS..."
Deploy-RunService -Name "kaana-api" -Image $ApiImage -Memory "1Gi" -Cpu "1" -Timeout 3600 `
  -EnvMap @{ NODE_ENV = "production"; JWT_EXPIRES_IN = "15m"; JWT_REFRESH_EXPIRES_IN = "7d"; CORS_ORIGINS = $cors } `
  -Secrets @("DATABASE_URL=DATABASE_URL:latest", "JWT_SECRET=JWT_SECRET:latest", "JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest") `
  -CloudSql $Connection `
  -ServiceAccount $ApiRunnerSa `
  -SessionAffinity

Write-Host ""
Write-Host "Deployed:"
Write-Host "  API         $ApiUrl"
Write-Host "  Operations  $($Public.Ops)"
Write-Host "  POS         $($Public.Pos)"
Write-Host "  KDS         $($Public.Kds)"
Write-Host "  Captain     $($Public.Captain)"
Write-Host "Health: $ApiUrl/api/health"
Write-Host "Sign in at $($Public.Ops)  (owner@kaanafoods.in / password123)"
