import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  addOrderItem,
  createTableOrder,
  fetchMenu,
  fireKot,
  getOpenOrderByTable,
  login,
  requestBill,
  resolveOutletId,
} from "../lib/api";

interface MenuItem { id: string; name: string; basePrice: number; isAvailable?: boolean }
interface Category { id: string; name: string; items: MenuItem[] }
interface OrderItem { id: string; name: string; quantity: number; status?: string; kotId?: string | null }
interface Order { id: string; totalAmount: number; orderNumber?: string; items: OrderItem[] }

export default function OrderScreen() {
  const { tableId, tableNumber } = useLocalSearchParams<{ tableId: string; tableNumber: string }>();
  const [menu, setMenu] = useState<Category[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [outletId, setOutletId] = useState("");

  useEffect(() => {
    async function init() {
      await login();
      const oid = await resolveOutletId();
      setOutletId(oid);
      const menuData = await fetchMenu(oid);
      setMenu(menuData);
      let open = await getOpenOrderByTable(oid, tableId);
      if (!open) {
        open = await createTableOrder(oid, tableId, 2);
      }
      setOrder(open as Order);
    }
    init().catch(console.error);
  }, [tableId]);

  async function addItem(item: MenuItem) {
    if (!order) return;
    const updated = await addOrderItem(order.id, item.id);
    setOrder(updated as Order);
  }

  async function fireKOT() {
    if (!order) return;
    await fireKot(order.id);
    const refreshed = await getOpenOrderByTable(outletId, tableId);
    setOrder(refreshed as Order);
    Alert.alert("KOT Fired", "Order sent to kitchen");
  }

  async function handleRequestBill() {
    if (!order) return;
    await requestBill(order.id);
    Alert.alert("Bill Requested", `Table ${tableNumber} — ₹${Number(order.totalAmount).toFixed(0)} sent to cashier`);
  }

  const allItems = menu.flatMap((c) => c.items.filter((i) => i.isAvailable !== false));
  const pendingCount = order?.items.filter((i) => !i.kotId && i.status === "pending").length ?? 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Table {tableNumber} — Order</Text>
      {order && (
        <Text style={styles.subtitle}>{order.orderNumber} · ₹{Number(order.totalAmount).toFixed(0)} · {pendingCount} pending</Text>
      )}
      <FlatList
        data={allItems}
        keyExtractor={(i) => i.id}
        numColumns={2}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.itemCard} onPress={() => addItem(item)}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>₹{Number(item.basePrice).toFixed(0)}</Text>
          </TouchableOpacity>
        )}
      />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.kotBtn} onPress={fireKOT}>
          <Text style={styles.btnText}>Send KOT ({pendingCount})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.billBtn} onPress={handleRequestBill}>
          <Text style={styles.btnText}>Request Bill</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  title: { color: "#fff", fontSize: 20, fontWeight: "bold", padding: 16, paddingBottom: 4 },
  subtitle: { color: "#94a3b8", fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },
  itemCard: { flex: 1, margin: 6, padding: 12, backgroundColor: "#1e293b", borderRadius: 10, borderWidth: 1, borderColor: "#334155" },
  itemName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  itemPrice: { color: "#2dd4bf", fontSize: 12, marginTop: 4 },
  actions: { flexDirection: "row", gap: 8, padding: 16 },
  kotBtn: { flex: 1, backgroundColor: "#ea580c", padding: 16, borderRadius: 12, alignItems: "center" },
  billBtn: { flex: 1, backgroundColor: "#7c3aed", padding: 16, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "bold" },
});
