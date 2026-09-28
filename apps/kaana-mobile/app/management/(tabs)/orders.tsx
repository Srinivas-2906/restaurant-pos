import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import type { OrderSummary } from "@kaana/api-client";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/ui/States";
import { formatInr, formatOrderStatus, formatTime } from "@/src/management/format";
import { useManagement } from "@/src/management/ManagementProvider";

const FILTERS = [
  { id: "active", label: "Open", statuses: ["open", "kot_fired", "preparing", "ready", "served", "billed"] },
  { id: "settled", label: "Completed", statuses: ["settled"] },
  { id: "all", label: "Recent", statuses: [] as string[] },
];

export default function OrdersScreen() {
  const router = useRouter();
  const { api, outletId } = useManagement();
  const [filter, setFilter] = useState("active");
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await api.orders.list(outletId);
      setOrders(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [api, outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    if (f.statuses.length === 0) return orders.slice(0, 50);
    return orders.filter((o) => f.statuses.includes(o.status));
  }, [orders, filter]);

  if (loading && orders.length === 0) return <LoadingState />;
  if (error && orders.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Orders</Text>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            style={[styles.chip, filter === f.id && styles.chipActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.chipText, filter === f.id && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={<EmptyState title="No orders" message="No orders match this filter." />}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/management/orders/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>#{item.orderNumber ?? item.id.slice(-6)}</Text>
              <Text style={styles.rowSub}>
                {formatOrderStatus(item.status)} · {item.type?.replace("_", " ") ?? "order"}
                {item.table?.number ? ` · Table ${item.table.number}` : ""}
              </Text>
              <Text style={styles.rowTime}>{formatTime(item.createdAt)}</Text>
            </View>
            <Text style={styles.amount}>{formatInr(item.totalAmount ?? 0)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingTop: 56, paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12, color: "#0f172a" },
  filters: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  chipActive: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  chipText: { color: "#64748b", fontSize: 13 },
  chipTextActive: { color: "#9a3412", fontWeight: "600" },
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
  rowTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  rowSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  rowTime: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  amount: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
});
