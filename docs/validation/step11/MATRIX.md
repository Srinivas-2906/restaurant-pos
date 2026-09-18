# Step 11 Validation Matrix

## Identities (seeded)

| Surface | Identity | Credential |
|---------|----------|------------|
| Kaana Admin | admin@kaanafoods.in | password123 |
| Owner | owner@kaanafoods.in | password123 |
| Manager | manager@kaanafoods.in | password123 |
| Cashier | EMP001 | PIN 1111 |
| Captain | EMP002 | PIN 2222 |
| Chef | EMP003 | PIN 3333 |
| Floor Manager | EMP004 | PIN 4444 |

## Devices (seeded)

| Code | Type | Dev secret |
|------|------|------------|
| POS-01 | pos | kaana-dev-pos-01-secret |
| CAPTAIN-01 | captain | kaana-dev-captain-01-secret |
| KDS-01 | kds | kaana-dev-kds-01-secret |

## Deterministic baseline

- Demo Restaurant / MAIN-001 outlet
- Operating mode: SIMPLE, Plan: LEGACY_FULL, configVersion: 1
- 0 module overrides, 0 feature overrides
- 6/6 tables free, 0 live orders
- 12 menu items, 12 ingredients, 3 suppliers, 5 recipes
- 3 active terminals (POS-01, CAPTAIN-01, KDS-01)
- Purchase orders: **PO-REC-001** (received), **PO-OPEN-001** (sent) — count **2**

## Automation

Run: `powershell -NoProfile -File scripts/step11-system-e2e.ps1`

Results: `docs/validation/step11/e2e-results.json`
