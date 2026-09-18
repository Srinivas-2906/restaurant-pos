# Kaana Foods — Step 15 Offline POS Testing Guide

This document explains how to **build, run, and validate** the offline-capable POS stack (API + Metro + physical Android tablet or emulator), including the fixes for menu/tables/open-orders loading, sync outbox recovery, and post-offline **online PIN re-login for sync**.

---

## 1. What you are validating

| Area | Expected behavior |
|------|-------------------|
| Online bootstrap | EMP001 PIN login, POS home, menu loads from API |
| SQLite cache | Menu (and floor after visiting Tables once) persisted in `kaana_pos_offline.db` |
| Offline menu | API stopped → menu visible within ~10s (not infinite “Loading menu…”) |
| Offline tables / open orders | Same timeout + cache; empty state OK if floor never cached online |
| Offline order | Takeaway → items → KOT ×2 → cash settle |
| Process death | Force-stop app → offline PIN login → sale still in SQLite |
| Sync status UI | POS home → “View sync status” / banner tap → pending sale card + receipt |
| Reconnect sync | **Online PIN login** (not offline PIN) → outbox drains, banner clears |

**Do not run `db:seed` on a device mid-walkthrough** if you are inspecting real cached data.

---

## 2. Prerequisites

### Software (host PC)

- Node.js 20+ (repo uses npm workspaces)
- Docker Desktop (PostgreSQL + Redis per repo docs)
- Android SDK / `adb` (physical device USB debugging or emulator)
- Git

### Network (physical device)

| Service | URL |
|---------|-----|
| API | `http://<PC-LAN-IP>:4000/api` (example: `http://192.168.31.57:4000/api`) |
| Metro | `http://<PC-LAN-IP>:8081` |
| **Not for physical device** | `10.0.2.2` (emulator only) |

Phone and PC must be on the **same Wi‑Fi**. Windows Firewall must allow inbound **4000** and **8081**.

### Seed credentials (after `npm run db:seed`)

| Role | Login |
|------|--------|
| POS | EMP001 / PIN `1111` |
| Captain | EMP002 / `2222` |
| KDS | EMP003 / `3333` |
| Owner (web) | `owner@kaanafoods.in` / `password123` |

---

## 3. One-time host setup

From repo root `Kaana-foods`:

```powershell
npm install
docker compose up -d
npm run db:seed
```

Start API:

```powershell
cd apps\api
npm run dev:watch
```

Verify:

```powershell
Invoke-WebRequest http://127.0.0.1:4000/api/health -UseBasicParsing
```

Start Metro (physical device):

```powershell
cd apps\kaana-mobile
$env:EXPO_PUBLIC_API_URL = "http://192.168.31.57:4000/api"
$env:EXPO_PUBLIC_WS_URL = "http://192.168.31.57:4000/events"
npx expo start --host lan
```

Replace `192.168.31.57` with your PC’s IPv4 (`ipconfig`).

### Debug APK (optional, no Metro)

```powershell
cd apps\kaana-mobile
powershell -File scripts\build-device-apk.ps1 -LanIp 192.168.31.57
```

Install APK from `apps/kaana-mobile/dist/`. Dev client + Metro is preferred for JS fixes without rebuild.

### Fresh terminal activation code

```powershell
powershell -File scripts\step15.1a-prepare.ps1
```

Codes are written to `docs/validation/step15/android/step15.1a-session.json` (gitignored). Use **Set Up Restaurant Device** on the tablet.

---

## 4. Automated tests (CI / local)

```powershell
# Mobile unit tests (menu refresh, sync display, persistence, connectivity probe)
cd apps\kaana-mobile
npm test

# API tests (includes pos-sync)
cd apps\api
npm test

# Repo root E2E script (when API + DB up)
cd ..\..
node scripts\step15-offline-pos-e2e.mjs
```

---

## 5. Physical device walkthrough (Step 15.1A)

Detailed checklist: [android/PROCEDURE.md](./android/PROCEDURE.md)

### Phase A — Online bootstrap

1. Activate device (POS terminal) with code from prepare script.
2. Sign in **EMP001 / 1111** (API must be up).
3. Open **Takeaway** → confirm menu loads.
4. Optional: open **Dine In → Tables** once (caches floor for offline).
5. Screenshot: `docs/validation/step15/android/01-online-cached.png`

### Phase B — Inspect SQLite (no wipe)

```powershell
adb devices
cmd /c "adb exec-out run-as in.kaanafoods.mobile cat files/SQLite/kaana_pos_offline.db > %TEMP%\kaana_pos_offline.db"
powershell -File scripts\step15-inspect-device-cache.ps1
```

Or manual queries:

```powershell
node scripts\step15.1-sqlite-query.mjs $env:TEMP\kaana_pos_offline.db "SELECT COUNT(*) FROM menu_categories"
node scripts\step15.1-sqlite-query.mjs $env:TEMP\kaana_pos_offline.db "SELECT COUNT(*) FROM menu_items"
node scripts\step15.1-sqlite-query.mjs $env:TEMP\kaana_pos_offline.db "SELECT status, sync_status, total_amount FROM orders"
```

Expect menu row counts **> 0** after online menu load.

### Phase C — Offline outage (API only)

Stop API **only** (keep Wi‑Fi + Metro):

```powershell
# Find listener on 4000 and stop that node process, or close the API terminal
Get-NetTCPConnection -LocalPort 4000 -State Listen
```

On tablet:

1. Reload app if you deployed new JS via Metro.
2. Open POS → Takeaway → menu should appear (cached), banner **Offline**.
3. **Tables / Open orders** should finish loading (empty or cached), not spin forever.
4. Complete takeaway: items → **Fire KOT** twice → **Cash settle**.
5. Force-stop app → reopen → **offline PIN** EMP001 / 1111.
6. POS home → **View sync status** → pending **cash sale** card → **View receipt**.

### Phase D — Sync (API back online)

1. Start API again (`npm run dev:watch` in `apps/api`).
2. **Switch Employee** → sign in **EMP001 / 1111** with API up (**online PIN**, not offline-only session).
3. Banner: **Online** → **Syncing…** → pending count **0**.
4. Verify cloud order in Operations Web or:

```powershell
node scripts\step15.1-replay-sync.mjs
```

Screenshots: `02-offline.png` … `06-synced.png` in `docs/validation/step15/android/`.

---

## 6. Troubleshooting

| Symptom | Likely cause | Action |
|---------|----------------|--------|
| Stuck “Loading menu…” offline | Old bundle / no cache | Metro reload; load menu online first |
| Banner flickers Offline/Online | Old build | Pull latest; stable probe needs 2 consecutive results |
| Online but “waiting to sync” forever | Logged in with **offline PIN** | Switch Employee → online PIN login |
| 2 changes stuck in `syncing` | Crashed mid-sync | Latest code runs `recoverStaleSyncing()` on sync |
| Tables empty offline | Floor never cached | API on → open Tables once → stop API |
| `adb` empty | USB debugging off | Enable dev options + authorize RSA |
| API unreachable from phone | Wrong IP / firewall | Ping PC IP; open ports 4000, 8081 |

### Metro reload

Shake device → **Reload**, or `adb shell am force-stop in.kaanafoods.mobile` and reopen dev client.

### Health check from PC (LAN)

```powershell
Invoke-WebRequest "http://192.168.31.57:4000/api/health" -UseBasicParsing
```

---

## 7. Key source paths (Step 15 mobile)

| Concern | Path |
|---------|------|
| Menu offline refresh | `apps/kaana-mobile/src/offline/menuRefresh.ts` |
| Tables / orders offline | `apps/kaana-mobile/src/offline/offlineResourceRefresh.ts` |
| Connectivity probe | `apps/kaana-mobile/src/offline/connectivityProbe.ts` |
| Sync worker | `apps/kaana-mobile/src/offline/syncWorker.ts` |
| Outbox recovery | `apps/kaana-mobile/src/offline/outboxStore.ts` |
| Sync status UI | `apps/kaana-mobile/app/pos/sync-status.tsx` |
| POS sync batch API | `apps/api/src/sync/pos-sync.service.ts` |

---

## 8. Definition of done (Step 15)

- [ ] Online menu + SQLite cache verified on device  
- [ ] Offline menu usable after API stop (no infinite loading)  
- [ ] Offline settle + force-stop + offline login + receipt from SQLite  
- [ ] Online PIN re-login syncs outbox  
- [ ] `apps/kaana-mobile` tests pass (`npm test`)  
- [ ] Screenshots archived under `docs/validation/step15/android/`  

Step **16** (extended offline KDS / cloud KOT) is **out of scope** until the above passes.
