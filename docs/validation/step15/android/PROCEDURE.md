# Step 15.1A — Manual Android Offline POS Walkthrough

## Prerequisites (automated prep)

```powershell
powershell -File scripts\step15.1a-prepare.ps1
```

Ensures: seed baseline, API + Metro up, `STEP15-ANDROID-POS` terminal with fresh activation code in `step15.1a-session.json`.

**Do not run `db:seed` again until walkthrough completes.**

## API connectivity (emulator)

| Setting | Value |
|---------|--------|
| `EXPO_PUBLIC_API_URL` | `http://10.0.2.2:4000/api` |
| adb reverse | `tcp:4000 tcp:4000`, `tcp:8081 tcp:8081` |
| Metro launch URL | `http://127.0.0.1:8081` (via reverse) |

Android **cannot** use `localhost:4000` directly — use `10.0.2.2` or adb reverse.

## Manual steps (no adb UI taps)

1. Launch dev client (Metro must be running).
2. **Set Up Restaurant Device** → enter activation code from `step15.1a-session.json`.
3. Sign in **EMP001 / 1111** manually.
4. Confirm **POS home** (menu, Takeaway, sync banner Online).
5. Screenshot → `01-online-cached.png`
6. Verify SQLite:
   ```powershell
   adb shell run-as in.kaanafoods.mobile ls databases
   adb shell run-as in.kaanafoods.mobile cp databases/kaana_pos_offline.db /sdcard/
   adb pull /sdcard/kaana_pos_offline.db $env:TEMP\kaana_pos_offline.db
   node scripts/step15.1-sqlite-query.mjs $env:TEMP\kaana_pos_offline.db "SELECT name FROM sqlite_master WHERE type='table'"
   ```
7. Force-stop + relaunch **while API still online** — confirm POS reachable again.
8. **Only then** stop API (`Stop-Process` on port 4000 listener) — keep Wi‑Fi/Metro so bundle stays loaded.
9. Complete offline takeaway → KOT ×2 → cash settle → force-stop → offline login → restore API → sync.
10. Screenshots `02-offline.png` … `06-synced.png`
11. Backend verify + `npm run db:seed` reset.

## Offline outage method

**Preferred:** Stop host API process only after POS is loaded and online bootstrap proven. Do **not** disable emulator Wi‑Fi if Metro dev client still needs it.

## Login error semantics (fixed in 15.1A)

| Condition | Message |
|-----------|---------|
| API up, wrong role | You don't have access to POS on this device. |
| API down, no offline snapshot | Connect to the internet to sign in on this device first. |
| API down, valid offline verifier | Offline PIN login attempted |
