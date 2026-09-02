import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { api, login, resolveOutletId } from "../lib/api";
import { useNotify } from "../lib/toast";

interface TableActiveOrder {
  inKitchen: number;
  readyCount?: number;
  servedCount?: number;
  totalAmount: number;
  itemQty: number;
  orderNumber: string;
}

interface Table {
  id: string;
  number: string;
  status: string;
  capacity: number;
  activeOrder?: TableActiveOrder | null;
}

export default function TablesScreen() {
  const router = useRouter();
  const notify = useNotify();
  const [tables, setTables] = useState<Table[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const prevReadyRef = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    await login();
    const outletId = await resolveOutletId();
    const floor = await api<{ tables: Table[] }>(`/outlets/${outletId}/floor`);
    const next = floor.tables ?? [];

    for (const table of next) {
      const ready = table.activeOrder?.readyCount ?? 0;
      const prev = prevReadyRef.current[table.id] ?? 0;
      if (ready > prev) {
        notify.success(`Table T${table.number} — ${ready - prev} item${ready - prev !== 1 ? "s" : ""} ready to serve`);
      }
      prevReadyRef.current[table.id] = ready;
    }

    setTables(next);
  }, [notify]);

  useEffect(() => {
    load().catch(console.error);
    const interval = setInterval(() => load().catch(() => undefined), 5000);
    return () => clearInterval(interval);
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load().catch(console.error);
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Floor — tap table to order or serve</Text>
      <FlatList
        data={tables}
        numColumns={2}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ea580c" />}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => {
          const ao = item.activeOrder;
          const ready = ao?.readyCount ?? 0;
          const hasOrder = Boolean(ao);
          const target = ready > 0
            ? { pathname: "/serve" as const, params: { tableId: item.id, tableNumber: item.number } }
            : { pathname: "/order" as const, params: { tableId: item.id, tableNumber: item.number } };

          return (
            <TouchableOpacity
              style={[
                styles.tableCard,
                ready > 0 ? styles.tableReady : hasOrder ? styles.tableActive : styles.tableFree,
              ]}
              onPress={() => router.push(target)}
            >
              <Text style={styles.tableNumber}>T{item.number}</Text>
              {ao ? (
                <>
                  <Text style={styles.tableMeta}>₹{Number(ao.totalAmount).toFixed(0)} · {ao.itemQty} items</Text>
                  <View style={styles.chips}>
                    {(ao.inKitchen ?? 0) > 0 && <Text style={styles.chipCooking}>{ao.inKitchen} cooking</Text>}
                    {ready > 0 && <Text style={styles.chipReady}>{ready} ready</Text>}
                    {(ao.servedCount ?? 0) > 0 && <Text style={styles.chipServed}>{ao.servedCount} served</Text>}
                  </View>
                </>
              ) : (
                <Text style={styles.tableStatus}>Available</Text>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  title: { color: "#2dd4bf", fontSize: 16, fontWeight: "600", padding: 16 },
  tableCard: { flex: 1, margin: 6, padding: 16, borderRadius: 12, borderWidth: 2, alignItems: "center", minHeight: 120 },
  tableFree: { borderColor: "#334155", backgroundColor: "#1e293b" },
  tableActive: { borderColor: "#d97706", backgroundColor: "#1e293b" },
  tableReady: { borderColor: "#22c55e", backgroundColor: "#14532d33" },
  tableNumber: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  tableMeta: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  tableStatus: { fontSize: 12, color: "#64748b", marginTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8, justifyContent: "center" },
  chipCooking: { fontSize: 10, color: "#fbbf24", backgroundColor: "#78350f66", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  chipReady: { fontSize: 10, color: "#86efac", backgroundColor: "#14532d66", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  chipServed: { fontSize: 10, color: "#7dd3fc", backgroundColor: "#0c4a6e66", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});
