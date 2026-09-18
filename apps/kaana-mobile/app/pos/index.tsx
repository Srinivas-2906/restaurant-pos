import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useShellOrientation } from "@/src/hooks/useShellOrientation";
import { OperationalShellFrame } from "@/src/components/OperationalShellFrame";
import { LoadingState, ErrorState } from "@/src/components/ui/States";
import { SyncStatusBanner } from "@/src/offline/SyncStatusBanner";
import { useOfflinePos } from "@/src/offline/OfflinePosProvider";
import { usePos } from "@/src/pos/PosProvider";
import { useSession } from "@/src/session/SessionProvider";

function PosHomeContent() {
  const router = useRouter();
  const { posAvailable, posBlockedMessage, loading, error, authMode, permissions, exitPos } = usePos();
  const { pendingCount, syncBlockedMessage } = useOfflinePos();

  if (loading) return <LoadingState message="Loading POS…" />;
  if (error) return <ErrorState message={error} onRetry={() => router.replace("/pos")} />;

  if (!permissions.canBill) {
    return (
      <View style={styles.center}>
        <Text style={styles.blockedTitle}>POS access denied</Text>
        <Text style={styles.blockedText}>Your account does not have permission to bill orders.</Text>
        <Pressable onPress={exitPos} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!posAvailable) {
    return (
      <View style={styles.center}>
        <Text style={styles.blockedTitle}>POS unavailable</Text>
        <Text style={styles.blockedText}>{posBlockedMessage}</Text>
        <Text style={styles.note}>Your current order (if any) is preserved. New billing is blocked.</Text>
        <Pressable onPress={() => router.push("/pos/open-orders")} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>View open orders</Text>
        </Pressable>
        <Pressable onPress={exitPos} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SyncStatusBanner onPressStatus={() => router.push("/pos/sync-status")} />
      <View style={styles.header}>
        <Text style={styles.title}>POS</Text>
        <Pressable onPress={exitPos}>
          <Text style={styles.exit}>{authMode === "management" ? "Management" : "Exit"}</Text>
        </Pressable>
      </View>

      <Text style={styles.subtitle}>Choose order type</Text>

      <Pressable style={styles.typeCard} onPress={() => router.push("/pos/tables")}>
        <Text style={styles.typeTitle}>Dine In</Text>
        <Text style={styles.typeDesc}>Select a table and send items to kitchen</Text>
      </Pressable>

      <Pressable
        style={styles.typeCard}
        onPress={() => router.push({ pathname: "/pos/order", params: { type: "takeaway" } })}
      >
        <Text style={styles.typeTitle}>Takeaway</Text>
        <Text style={styles.typeDesc}>Quick counter order — bill and pay</Text>
      </Pressable>

      <Pressable
        style={styles.typeCard}
        onPress={() => router.push({ pathname: "/pos/order", params: { type: "delivery" } })}
      >
        <Text style={styles.typeTitle}>Delivery</Text>
        <Text style={styles.typeDesc}>Restaurant delivery order</Text>
      </Pressable>

      {(pendingCount > 0 || syncBlockedMessage) ? (
        <Pressable style={styles.pendingSyncBtn} onPress={() => router.push("/pos/sync-status")}>
          <Text style={styles.pendingSyncTitle}>
            {syncBlockedMessage ?? `${pendingCount} sale${pendingCount === 1 ? "" : "s"} waiting to sync`}
          </Text>
          <Text style={styles.pendingSyncLink}>View sync status →</Text>
        </Pressable>
      ) : null}

      <Pressable style={styles.openOrdersBtn} onPress={() => router.push("/pos/open-orders")}>
        <Text style={styles.openOrdersText}>Open orders</Text>
      </Pressable>
    </View>
  );
}

export default function PosShell() {
  const router = useRouter();
  const { terminal, employee, sessionType, bootstrapTarget } = useSession();
  useShellOrientation("pos");

  const isOperationalPos =
    sessionType === "operational" && terminal?.deviceType === "pos" && employee && bootstrapTarget.kind === "operational-shell";

  if (!isOperationalPos) {
    return <PosHomeContent />;
  }

  return (
    <OperationalShellFrame deviceType="pos">
      <PosHomeContent />
    </OperationalShellFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff7ed", padding: 20, paddingTop: 56 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", color: "#9a3412" },
  exit: { color: "#9a3412", fontWeight: "600" },
  subtitle: { color: "#64748b", marginBottom: 16 },
  typeCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  typeTitle: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  typeDesc: { color: "#64748b", marginTop: 4 },
  pendingSyncBtn: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  pendingSyncTitle: { color: "#92400e", fontWeight: "700", fontSize: 15 },
  pendingSyncLink: { color: "#9a3412", marginTop: 6, fontWeight: "600" },
  openOrdersBtn: { marginTop: 8, alignItems: "center", padding: 14 },
  openOrdersText: { color: "#9a3412", fontWeight: "700", fontSize: 16 },
  center: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff7ed" },
  blockedTitle: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  blockedText: { color: "#64748b", lineHeight: 22, marginBottom: 12 },
  note: { color: "#92400e", marginBottom: 16, lineHeight: 20 },
  primaryBtn: { backgroundColor: "#9a3412", padding: 14, borderRadius: 10, alignItems: "center", marginBottom: 10 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: { padding: 12, alignItems: "center" },
  secondaryBtnText: { color: "#9a3412", fontWeight: "600" },
});
