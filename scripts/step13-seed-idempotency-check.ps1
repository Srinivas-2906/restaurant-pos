# Step 13.1 — seed accounting idempotency snapshot
param([string]$DatabaseUrl = "postgresql://kaana:kaana_dev@127.0.0.1:5433/kaana_foods?schema=public")

$ErrorActionPreference = "Stop"
$env:DATABASE_URL = $DatabaseUrl

$query = @'
SELECT
  (SELECT COUNT(*)::int FROM "GlAccount" WHERE "organizationId" = (SELECT b."organizationId" FROM "Outlet" o JOIN "Brand" b ON b.id = o."brandId" WHERE o.code = 'MAIN-001' LIMIT 1)) AS gl_accounts,
  (SELECT COUNT(*)::int FROM "JournalEntry") AS journal_entries,
  (SELECT COUNT(*)::int FROM "JournalLine") AS journal_lines,
  (SELECT COALESCE(SUM(debit-credit),0)::float FROM "JournalLine" jl JOIN "GlAccount" ga ON ga.id = jl."glAccountId" JOIN "JournalEntry" je ON je.id = jl."journalEntryId" WHERE ga.code = '1200' AND je.status = 'posted') AS inventory_asset_net,
  (SELECT COALESCE(SUM(credit-debit),0)::float FROM "JournalLine" jl JOIN "GlAccount" ga ON ga.id = jl."glAccountId" JOIN "JournalEntry" je ON je.id = jl."journalEntryId" WHERE ga.code = '3200' AND je.status = 'posted') AS opening_equity_net;
'@

Push-Location (Join-Path $PSScriptRoot ".." "packages" "database")
$result = npx prisma db execute --stdin --schema prisma/schema.prisma 2>&1 <<< $query
Pop-Location
Write-Output $result
