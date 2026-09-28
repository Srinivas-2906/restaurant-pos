import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { OrderSummary } from "@kaana/api-client";
import { LoadingState, ErrorState, EmptyState } from "@/src/components/ui/States";
import { formatInr } from "@/src/management/format";
import { usePos } from "@/src/pos/PosProvider";
import { useOfflinePos } from "@/src/offline/OfflinePosProvider";
import { ORDER_TYPE_LABELS, orderStatusLabel } from "@/src/pos/orderLabels";
import { usePosRealtime } from "@/src/pos/usePosRealtime";

export default function PosOpenOrdersScreen() {
  const router = useRouter();
  const { outletId } = usePos();
  const offlinePos = useOfflinePos();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!outletId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await offlinePos.refreshOpenOrders();
      setOrders(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load open orders");
    } finally {
      setLoading(false);
    }
  }, [offlinePos, outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  usePosRealtime(outletId, () => {
    if (!offlinePos.isOffline) void load();
  });

  if (loading && orders.length === 0) return <LoadingState message="Loading open orders…" />;
  if (error && orders.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← POS</Text>
      </Pressable>
      <Text style={styles.title}>Open orders</Text>
      <Text style={styles.subtitle}>
        {offlinePos.isOffline
          ? "Offline — showing cached and locally created orders"
          : "All outlet orders — any source (POS, Captain, etc.)"}
      </Text>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={
          <EmptyState
            title="No open orders"
            message={
              offlinePos.isOffline
                ? "No cached or local open orders on this device."
                : "Settled and cancelled orders are hidden."
            }
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: "/pos/order",
                params: {
                  type: item.type ?? "takeaway",
                  orderId: item.id,
                  tableNumber: item.table?.number,
                },
              })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.orderNo}>#{item.orderNumber}</Text>
              <Text style={styles.meta}>
                {ORDER_TYPE_LABELS[item.type ?? ""] ?? item.type}
                {item.table?.number ? ` · Table ${item.table.number}` : ""}
                {item.source ? ` · ${item.source}` : ""}
              </Text>
              <Text style={styles.status}>{orderStatusLabel(item.status)}</Text>
            </View>
            <Text style={styles.amount}>{formatInr(item.totalAmount)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff7ed", paddingTop: 48, paddingHorizontal: 16 },
  back: { color: "#9a3412", fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", marginTop: 4 },
  subtitle: { color: "#64748b", marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  orderNo: { fontWeight: "700", color: "#0f172a" },
  meta: { color: "#64748b", fontSize: 12, marginTop: 2 },
  status: { fontSize: 12, color: "#9a3412", marginTop: 2, fontWeight: "600" },
  amount: { fontWeight: "800", color: "#0f172a" },
});
