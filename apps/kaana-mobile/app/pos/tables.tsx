import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LoadingState, ErrorState, EmptyState } from "@/src/components/ui/States";
import { formatInr } from "@/src/management/format";
import { usePos } from "@/src/pos/PosProvider";
import { useOfflinePos } from "@/src/offline/OfflinePosProvider";
import type { FloorTable } from "@kaana/api-client";

export default function PosTablesScreen() {
  const router = useRouter();
  const { outletId, posAvailable, posBlockedMessage } = usePos();
  const offlinePos = useOfflinePos();
  const [tables, setTables] = useState<FloorTable[]>([]);
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
      const rows = await offlinePos.refreshFloor();
      setTables(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tables");
    } finally {
      setLoading(false);
    }
  }, [offlinePos, outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!posAvailable) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedTitle}>POS unavailable</Text>
        <Text style={styles.blockedText}>{posBlockedMessage}</Text>
      </View>
    );
  }

  if (loading && tables.length === 0) return <LoadingState message="Loading tables…" />;
  if (error && tables.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  function openTable(table: FloorTable) {
    if (table.activeOrder) {
      router.push({
        pathname: "/pos/order",
        params: { type: "dine_in", tableId: table.id, orderId: table.activeOrder.id },
      });
      return;
    }
    router.push({
      pathname: "/pos/order",
      params: { type: "dine_in", tableId: table.id, tableNumber: table.number },
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← POS</Text>
        </Pressable>
        <Text style={styles.title}>Dine In — Tables</Text>
        {offlinePos.isOffline ? (
          <Text style={styles.offlineHint}>Offline — showing last cached floor plan</Text>
        ) : null}
      </View>

      <FlatList
        data={tables}
        keyExtractor={(t) => t.id}
        numColumns={2}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <EmptyState
            title="No tables"
            message={
              offlinePos.isOffline
                ? "Connect online once to load the floor plan for this outlet."
                : "Configure tables in Operations Web."
            }
          />
        }
        renderItem={({ item }) => {
          const occupied = Boolean(item.activeOrder);
          return (
            <Pressable
              style={[styles.tableCard, occupied && styles.tableOccupied]}
              onPress={() => openTable(item)}
            >
              <Text style={styles.tableNumber}>Table {item.number}</Text>
              <Text style={styles.tableMeta}>{item.capacity} seats · {item.status}</Text>
              {item.activeOrder ? (
                <>
                  <Text style={styles.orderAmt}>{formatInr(item.activeOrder.totalAmount)}</Text>
                  <Text style={styles.orderMeta}>
                    {item.activeOrder.itemQty} items · {item.activeOrder.status}
                  </Text>
                </>
              ) : (
                <Text style={styles.free}>Available</Text>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff7ed", paddingTop: 48 },
  header: { paddingHorizontal: 16, marginBottom: 8 },
  back: { color: "#9a3412", fontWeight: "600", marginBottom: 4 },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  offlineHint: { color: "#64748b", fontSize: 12, marginTop: 4 },
  grid: { padding: 12, gap: 8 },
  tableCard: {
    flex: 1,
    margin: 6,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    minWidth: "45%",
  },
  tableOccupied: { borderColor: "#fdba74", backgroundColor: "#fffbeb" },
  tableNumber: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  tableMeta: { color: "#64748b", fontSize: 12, marginTop: 2 },
  orderAmt: { fontWeight: "700", color: "#9a3412", marginTop: 8 },
  orderMeta: { fontSize: 12, color: "#64748b" },
  free: { color: "#16a34a", marginTop: 8, fontWeight: "600" },
  blocked: { flex: 1, justifyContent: "center", padding: 24 },
  blockedTitle: { fontSize: 20, fontWeight: "700" },
  blockedText: { color: "#64748b", marginTop: 8 },
});
