# Kaana Mobile (Step 6)

Unified Expo app for Management, POS, Captain, and KDS shells.

## Android build environment

Broken `JAVA_HOME` (e.g. incomplete JDK 24 without `bin/java.exe`) will fail Gradle. Use JDK **17** for Android builds:

```powershell
. .\apps\kaana-mobile\scripts\android-env.ps1
cd apps\kaana-mobile\android
.\gradlew.bat assembleDebug
```

Project-local JDK: `C:\Users\kanas\Kaana-foods\.tools\jdk-17` (Temurin 17.0.13).

Set `android/local.properties` SDK path (auto-created): `%LOCALAPPDATA%\Android\Sdk`

## Environment

Set API URLs before running on a device or emulator:

```bash
# Android emulator (host machine localhost)
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api

# Physical Android device on same Wi-Fi (replace with your PC LAN IP)
EXPO_PUBLIC_API_URL=http://192.168.x.x:4000/api
EXPO_PUBLIC_WS_URL=http://192.168.x.x:4000/events
```

## Commands

```bash
npm install
npm run dev -w @kaana/kaana-mobile
npm run typecheck -w @kaana/kaana-mobile
npm run test -w @kaana/kaana-mobile
npm run prebuild -w @kaana/kaana-mobile -- --platform android
npm run android -w @kaana/kaana-mobile
```

## Session policy

- **Operational terminal** credential persists in SecureStore across restarts.
- **Employee PIN session** is in-memory only — cold restart requires PIN again.
- **Management session** persists tokens in SecureStore with refresh.
- If both could exist, **operational terminal takes precedence** (MVP dual-state rule).

## Offline foundation (Step 15 prep)

Sensitive auth in **Expo SecureStore**. Non-sensitive caches should use SQLite/WatermelonDB in a later step — do not use sync-engine localStorage on native.
