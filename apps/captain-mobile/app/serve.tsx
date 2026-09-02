import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, login, markItemServed, resolveOutletId } from "../lib/api";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  status: string;
}

interface Order {
  id: string;
  orderNumber: string;
  items: OrderItem[];
}

export default function ServeScreen() {
  const { tableId, tableNumber } = useLocalSearchParams<{ tableId: string; tableNumber: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    await login();
    const outletId = await resolveOutletId();
    const data = await api<Order | null>(`/orders/open/by-table?outletId=${outletId}&tableId=${tableId}`);
    setOrder(data);
  }, [tableId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
    const interval = setInterval(() => load().catch(() => undefined), 5000);
    return () => clearInterval(interval);
  }, [load]);

  async function serve(itemId: string) {
    if (!order || busy) return;
    setBusy(itemId);
    try {
      await markItemServed(order.id, itemId);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#2dd4bf" /></View>;
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No active order</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.link}>← Back</Text></TouchableOpacity>
      </View>
    );
  }

  const ready = order.items.filter((i) => i.status === "ready");
  const cooking = order.items.filter((i) => i.status === "kot_fired" || i.status === "preparing");
  const served = order.items.filter((i) => i.status === "served");

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Table {tableNumber} · {order.orderNumber}</Text>

      {ready.length > 0 && (
        <>
          <Text style={styles.section}>Ready to serve</Text>
          <FlatList
            data={ready}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <View style={styles.readyRow}>
                <Text style={styles.itemName}>{item.quantity}× {item.name}</Text>
                <TouchableOpacity
                  style={styles.serveBtn}
                  disabled={busy === item.id}
                  onPress={() => serve(item.id)}
                >
                  <Text style={styles.serveBtnText}>{busy === item.id ? "…" : "Served"}</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </>
      )}

      {cooking.length > 0 && (
        <>
          <Text style={[styles.section, { color: "#fbbf24" }]}>Cooking</Text>
          {cooking.map((item) => (
            <View key={item.id} style={styles.dimRow}>
              <Text style={styles.itemName}>{item.quantity}× {item.name}</Text>
            </View>
          ))}
        </>
      )}

      {served.length > 0 && (
        <>
          <Text style={[styles.section, { color: "#7dd3fc" }]}>Served</Text>
          {served.map((item) => (
            <View key={item.id} style={styles.dimRow}>
              <Text style={[styles.itemName, { opacity: 0.5 }]}>✓ {item.quantity}× {item.name}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  center: { flex: 1, backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center" },
  header: { color: "#2dd4bf", fontSize: 18, fontWeight: "600", marginBottom: 16 },
  section: { color: "#86efac", fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginTop: 12, marginBottom: 8 },
  readyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#14532d44", padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: "#22c55e55" },
  dimRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#334155" },
  itemName: { color: "#fff", fontSize: 16, flex: 1 },
  serveBtn: { backgroundColor: "#16a34a", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  serveBtnText: { color: "#fff", fontWeight: "700" },
  empty: { color: "#94a3b8", marginBottom: 12 },
  link: { color: "#2dd4bf" },
});
