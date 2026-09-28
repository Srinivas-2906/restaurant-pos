# Step 10 — Manual KDS validation procedure

## Seed reset (run first, always)

```powershell
npm run db:seed
```

Verify via API:

- **6/6 tables** `status=free` on Main Outlet floor
- **0 live orders**
- KDS capability enabled (SIMPLE + LEGACY_FULL, no overrides)
- Seeded terminals intact: **POS-01**, **CAPTAIN-01**, **KDS-01**

**Do not run `db:seed` again until the walkthrough is complete.**

---

## Temporary terminal (`STEP10-HUMAN-KDS`) and `db:seed`

This is **expected dev behaviour**, not a production bug:

1. Activate `STEP10-HUMAN-KDS` on the emulator → app stores `terminalId` + device secret in **SecureStore**.
2. Run `npm run db:seed` → backend deactivates non-seeded terminals (`isActive=false`) and re-seeds only POS-01 / KDS-01 / CAPTAIN-01.
3. The app still holds the **old** credential for a terminal that is now inactive or removed from the active set.
4. Operational auth correctly **fails** (401/403 / “device deactivated”) until the app is reset and a **new** terminal is activated.

**Rule:** `db:seed` **before** creating/activating `STEP10-HUMAN-KDS`. After activation, **no seed** until screenshots and KDS transitions are done.

---

## Clean device state (once per walkthrough)

Before activation, clear stale credentials **once**:

- In-app: operational login → **Remove this device**, or
- `adb shell pm clear in.kaanafoods.mobile`

Expected after launch: **Entry** screen (not PIN, not stale KDS session).

---

## Order of operations (do not deviate)

| Step | Action |
|------|--------|
| A | `npm run db:seed` |
| B | Verify 6/6 free, 0 live orders, KDS enabled, POS/KDS/CAPTAIN-01 intact |
| C | Clear app data / Remove device |
| D | API on `:4000` |
| E | Metro on `:8081` (Step 9.1 env) |
| F | Launch Kaana dev client |
| G | Create terminal `STEP10-HUMAN-KDS` (Main Outlet, `kds`) |
| H | Generate activation code |
| I | Activate on **visible emulator** (keyboard Enter on code field) |
| J | Server: `isRegistered=true`, `isActive=true`, `revokedAt=null` |
| K | **Stop — no seed from here** |

---

## Login (manual only)

On the emulator (no adb typing automation):

- Employee ID: `EMP003`
- PIN: `3333`
- Submit with keyboard **Done/Enter** on PIN field

Watch Metro/API logs for `POST /operational/pin-login`.

Expected: **200**, operational JWT, route `/kds`, board **NEW | PREPARING | READY**.

---

## KDS closure (after login succeeds)

1. Captain helper: Table 2 — Chicken Biryani (note: Less spicy) + Lime Soda → fire KOT
2. Manual tap **Start Preparing** → backend `preparing`, UI PREPARING column
3. Manual tap **Mark Ready** (partial then full for multi-KOT)
4. Screenshots under `docs/validation/step10-kds-human/`
5. Cancel test order → `npm run db:seed` → verify 6/6 free again

---

## Scripts

- `scripts/step10-prepare-manual-kds.ps1` — steps A–K (API/Metro launch, terminal + code, app clear; **no login automation**)
- `scripts/step10-human-kds-orders.ps1` — Captain orders only (after KDS board is up)
