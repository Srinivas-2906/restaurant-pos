import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { hub } from "../lib/api";

interface MenuItem { id: string; name: string; price: number; isAvailable?: boolean }
interface Category { id: string; name: string; items: MenuItem[] }
interface Order { id: string; totalAmount: number; items: Array<{ name: string; quantity: number }> }

export default function OrderScreen() {
  const { tableId, tableNumber } = useLocalSearchParams<{ tableId: string; tableNumber: string }>();
  const [menu, setMenu] = useState<Category[]>([]);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    async function init() {
      const menuData = await hub<Category[]>("/hub/menu");
      setMenu(menuData);
      const created = await hub<Order>("/hub/orders", {
        method: "POST",
        body: JSON.stringify({ tableId, guestCount: 2, source: "dine_in" }),
      });
      setOrder(created);
    }
    init().catch(console.error);
  }, [tableId]);

  async function addItem(item: MenuItem) {
    if (!order) return;
    const updated = await hub<Order>(`/hub/orders/${order.id}/items`, {
      method: "POST",
      body: JSON.stringify({ menuItemId: item.id, name: item.name, unitPrice: item.price }),
    });
    setOrder(updated);
  }

  async function fireKOT() {
    if (!order) return;
    await hub(`/hub/orders/${order.id}/kot`, { method: "POST" });
    Alert.alert("KOT Fired", "Order sent to kitchen");
  }

  async function requestBill() {
    if (!order) return;
    Alert.alert("Bill Requested", `Table ${tableNumber} — ₹${order.totalAmount.toFixed(0)} sent to cashier`);
  }

  const allItems = menu.flatMap((c) => c.items.filter((i) => i.isAvailable !== false));

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Table {tableNumber} · ₹{(order?.totalAmount ?? 0).toFixed(0)}</Text>
      <FlatList
        data={allItems}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.itemRow} onPress={() => addItem(item)}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>₹{Number(item.price).toFixed(0)}</Text>
          </TouchableOpacity>
        )}
      />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.kotBtn} onPress={fireKOT}><Text style={styles.btnText}>Fire KOT</Text></TouchableOpacity>
        <TouchableOpacity style={styles.billBtn} onPress={requestBill}><Text style={styles.btnText}>Request Bill</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  header: { padding: 16, fontSize: 18, fontWeight: "600", color: "#ea580c", backgroundColor: "#1a1a1a" },
  itemRow: { flexDirection: "row", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#222" },
  itemName: { color: "#fff", fontSize: 16 },
  itemPrice: { color: "#ea580c", fontSize: 16 },
  actions: { flexDirection: "row", padding: 12, gap: 8 },
  kotBtn: { flex: 1, backgroundColor: "#eab308", padding: 14, borderRadius: 10, alignItems: "center" },
  billBtn: { flex: 1, backgroundColor: "#22c55e", padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
