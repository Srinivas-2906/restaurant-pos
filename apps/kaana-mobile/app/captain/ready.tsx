import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { OrderSummary } from "@kaana/api-client";
import { LoadingState, ErrorState, EmptyState } from "@/src/components/ui/States";
import { formatInr } from "@/src/management/format";
import { useCaptain } from "@/src/captain/CaptainProvider";
import { usePosRealtime } from "@/src/pos/usePosRealtime";
import { ACTIVE_ORDER_STATUSES } from "@/src/pos/types";

export default function CaptainReadyScreen() {
  const router = useRouter();
  const { api, outletId } = useCaptain();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await api.orders.list(outletId);
      setOrders(
        rows.filter(
          (o) =>
            ACTIVE_ORDER_STATUSES.has(o.status) &&
            (o.status === "ready" || o.items?.some(() => false)),
        ),
      );
      const detailed = await Promise.all(
        rows
          .filter((o) => ACTIVE_ORDER_STATUSES.has(o.status))
          .slice(0, 30)
          .map((o) => api.orders.getOne(o.id)),
      );
      setOrders(
        detailed
          .filter((o) => o.items.some((i) => i.status === "ready"))
          .map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            status: o.status,
            totalAmount: o.totalAmount,
            table: o.table,
            tableId: o.table?.id,
          })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ready orders");
    } finally {
      setLoading(false);
    }
  }, [api, outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  usePosRealtime(outletId, () => {
    void load();
  });

  if (loading && orders.length === 0) return <LoadingState message="Loading ready orders…" />;
  if (error && orders.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Ready orders</Text>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={<EmptyState title="Nothing ready" message="Ready items will appear here." />}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: "/captain/order",
                params: {
                  tableId: (item as { tableId?: string }).tableId ?? "",
                  tableNumber: item.table?.number ?? "?",
                  orderId: item.id,
                  focus: "serve",
                },
              })
            }
          >
            <View>
              <Text style={styles.orderNo}>#{item.orderNumber}</Text>
              <Text style={styles.meta}>
                Table {item.table?.number ?? "—"} · READY
              </Text>
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
  back: { color: "#0f766e", fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "800", marginVertical: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#86efac",
  },
  orderNo: { fontWeight: "800", color: "#0f172a" },
  meta: { color: "#15803d", marginTop: 2, fontWeight: "600" },
  amount: { fontWeight: "800", color: "#0f766e" },
});
