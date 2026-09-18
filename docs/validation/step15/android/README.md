# Step 15 Android Manual Validation

Manual smoke checklist for offline POS on Android emulator/device.

## Prerequisites
- API running at `http://10.0.2.2:4000` (emulator) or LAN IP
- Demo Restaurant seeded
- POS-01 terminal activated on device

## Checklist

1. [ ] Online POS login (EMP001 / PIN 1111)
2. [ ] Menu sync/cache completes (Last synced shown)
3. [ ] Disable network / block API
4. [ ] POS still opens with cached menu
5. [ ] Create Takeaway order
6. [ ] Add Chicken Biryani + Lime Soda
7. [ ] Settle Cash
8. [ ] Force-close app
9. [ ] Reopen while still offline — transaction remains
10. [ ] Restore network
11. [ ] Sync indicator resolves (pending → synced)
12. [ ] Verify cloud order in admin/API

## Screenshots

Place captures in this folder:
- `01-online-login.png`
- `02-offline-banner.png`
- `03-offline-order.png`
- `04-offline-settled.png`
- `05-after-restart-offline.png`
- `06-sync-complete.png`

## Notes

Physical device validation confirms expo-sqlite persistence across process kill — not fully automatable via UIAutomator per Step 15 scope.
