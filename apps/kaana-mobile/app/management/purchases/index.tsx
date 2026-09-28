import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { PurchaseOrderRow } from "@kaana/api-client";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/ui/States";
import { formatInr, formatTime } from "@/src/management/format";
import { useManagement } from "@/src/management/ManagementProvider";

export default function PurchasesScreen() {
  const router = useRouter();
  const { api, outletId } = useManagement();
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await api.inventory.purchaseOrders(outletId);
      setOrders(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load purchases");
    } finally {
      setLoading(false);
    }
  }, [api, outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && orders.length === 0) return <LoadingState />;
  if (error && orders.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Purchases</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push("/management/purchases/add")}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={<EmptyState title="No purchases yet" message="Record your first purchase to get started." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.poNumber}</Text>
            <Text style={styles.sub}>{item.supplier?.name ?? "Supplier"} · {item.status}</Text>
            <Text style={styles.sub}>{formatInr(item.totalAmount)} · {formatTime(item.createdAt)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingTop: 56, paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  addBtn: { backgroundColor: "#9a3412", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: "#fff", fontWeight: "600" },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  name: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  sub: { fontSize: 13, color: "#64748b", marginTop: 2 },
});
