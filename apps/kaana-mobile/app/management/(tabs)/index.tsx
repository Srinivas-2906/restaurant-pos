import { ScrollView, View, Text, Pressable, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MetricCard } from "@/src/components/ui/MetricCard";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/ui/States";
import { formatInr, formatNumber } from "@/src/management/format";
import { useManagement } from "@/src/management/ManagementProvider";
import { useDashboardHome } from "@/src/management/useDashboardHome";
import { useShellOrientation } from "@/src/hooks/useShellOrientation";
import { useSession } from "@/src/session/SessionProvider";

export default function ManagementHomeScreen() {
  useShellOrientation("management");
  const router = useRouter();
  const { logoutManagement } = useSession();
  const { outlet, outlets, setOutletId, loadingOutlets, access } = useManagement();
  const { data, loading, error, refresh } = useDashboardHome();

  if (loadingOutlets) return <LoadingState message="Loading restaurant…" />;
  if (!outlet) return <EmptyState title="No outlet found" message="Add an outlet in Operations Web first." />;
  if (loading && !data) return <LoadingState message="Loading today…" />;
  if (error && !data) return <ErrorState message={error} onRetry={() => void refresh()} />;

  const cash = data?.paymentSplit?.cash ?? data?.paymentSplit?.CASH ?? 0;
  const upi = data?.paymentSplit?.upi ?? data?.paymentSplit?.UPI ?? 0;
  const card = data?.paymentSplit?.card ?? data?.paymentSplit?.CARD ?? 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Today</Text>
          <Text style={styles.title}>{outlet.name}</Text>
        </View>
        <Pressable onPress={() => void logoutManagement().then(() => router.replace("/entry"))}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {outlets.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.outletRow}>
          {outlets.map((o) => (
            <Pressable
              key={o.id}
              style={[styles.outletChip, o.id === outlet.id && styles.outletChipActive]}
              onPress={() => void setOutletId(o.id).then(() => void refresh())}
            >
              <Text style={[styles.outletChipText, o.id === outlet.id && styles.outletChipTextActive]}>
                {o.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.metricsRow}>
        <MetricCard label="Total sales" value={formatInr(data?.todayRevenue ?? 0)} />
        <MetricCard label="Orders" value={formatNumber(data?.todayOrders ?? 0)} />
      </View>

      {(cash > 0 || upi > 0 || card > 0) && (
        <>
          <Text style={styles.section}>Payment split</Text>
          <View style={styles.metricsRow}>
            <MetricCard label="Cash" value={formatInr(cash)} />
            <MetricCard label="UPI" value={formatInr(upi)} />
            <MetricCard label="Card" value={formatInr(card)} />
          </View>
        </>
      )}

      {access.hasModule("pos") && (
        <>
          <Text style={styles.section}>Operational summary</Text>
          <View style={styles.metricsRow}>
            <MetricCard label="Open" value={formatNumber(data?.openOrders ?? 0)} />
            <MetricCard label="Preparing" value={formatNumber(data?.preparingOrders ?? 0)} />
            <MetricCard label="Ready" value={formatNumber(data?.readyOrders ?? 0)} />
          </View>
        </>
      )}

      {access.canManageInventory && (data?.lowStockCount ?? 0) + (data?.outOfStockCount ?? 0) > 0 && (
        <>
          <Text style={styles.section}>Inventory alerts</Text>
          <View style={styles.metricsRow}>
            <MetricCard label="Low stock" value={formatNumber(data?.lowStockCount ?? 0)} />
            <MetricCard label="Out of stock" value={formatNumber(data?.outOfStockCount ?? 0)} />
          </View>
        </>
      )}

      <Text style={styles.section}>Quick actions</Text>
      <View style={styles.actions}>
        {access.canUsePos && (
          <Pressable style={styles.action} onPress={() => router.push("/management/billing")}>
            <Text style={styles.actionText}>New Bill</Text>
          </Pressable>
        )}
        {access.hasModule("pos") && (
          <Pressable style={styles.action} onPress={() => router.push("/management/orders")}>
            <Text style={styles.actionText}>Orders</Text>
          </Pressable>
        )}
        {access.canManagePurchases && (
          <Pressable style={styles.action} onPress={() => router.push("/management/purchases/add")}>
            <Text style={styles.actionText}>Add Purchase</Text>
          </Pressable>
        )}
        {access.canViewOwnerFinance && (
          <Pressable style={styles.action} onPress={() => router.push("/management/expenses")}>
            <Text style={styles.actionText}>Add Expense</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16, paddingTop: 56 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  eyebrow: { fontSize: 12, fontWeight: "700", color: "#9a3412", textTransform: "uppercase" },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  signOut: { color: "#6b7280", fontSize: 14 },
  outletRow: { marginBottom: 12 },
  outletChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 8,
  },
  outletChipActive: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  outletChipText: { color: "#64748b", fontSize: 13 },
  outletChipTextActive: { color: "#9a3412", fontWeight: "600" },
  section: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginTop: 16, marginBottom: 8 },
  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  action: {
    backgroundColor: "#9a3412",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionText: { color: "#fff", fontWeight: "600" },
});
