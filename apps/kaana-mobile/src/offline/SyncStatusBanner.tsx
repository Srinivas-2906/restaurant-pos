import { Pressable, StyleSheet, Text, View } from "react-native";
import { useOfflinePos } from "./OfflinePosProvider";

export function SyncStatusBanner({ onPressStatus }: { onPressStatus?: () => void }) {
  const { isOffline, syncState, pendingCount, syncBlockedMessage, lastSyncLabel } = useOfflinePos();

  if (!isOffline && syncState === "ONLINE" && pendingCount === 0) {
    if (lastSyncLabel) {
      return (
        <View style={styles.subtle}>
          <Text style={styles.subtleText}>Last synced {lastSyncLabel}</Text>
        </View>
      );
    }
    return null;
  }

  let label = "Online";
  let tone: "offline" | "syncing" | "error" | "attention" = "offline";

  if (isOffline) {
    label = "Offline";
    tone = "offline";
  } else if (syncState === "SYNCING") {
    label = "Syncing…";
    tone = "syncing";
  } else if (syncState === "NEEDS_ATTENTION") {
    label = "Needs attention";
    tone = "attention";
  } else if (syncState === "SYNC_ERROR") {
    label = "Sync issue";
    tone = "error";
  }

  return (
    <Pressable
      style={[styles.banner, styles[tone]]}
      onPress={onPressStatus}
      accessibilityRole="button"
    >
      <Text style={styles.bannerText}>{label}</Text>
      {syncBlockedMessage ? (
        <Text style={styles.bannerMeta}>{syncBlockedMessage}</Text>
      ) : pendingCount > 0 ? (
        <Text style={styles.bannerMeta}>
          {pendingCount} change{pendingCount === 1 ? "" : "s"} waiting to sync
        </Text>
      ) : null}
      {lastSyncLabel ? <Text style={styles.bannerMeta}>Last synced {lastSyncLabel}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  offline: { backgroundColor: "#fef3c7" },
  syncing: { backgroundColor: "#dbeafe" },
  error: { backgroundColor: "#fee2e2" },
  attention: { backgroundColor: "#fde68a" },
  bannerText: { fontWeight: "700", color: "#1f2937" },
  bannerMeta: { color: "#4b5563", fontSize: 13 },
  subtle: { paddingHorizontal: 16, paddingVertical: 4 },
  subtleText: { fontSize: 12, color: "#6b7280" },
});
