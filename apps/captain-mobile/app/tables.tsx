import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { hub } from "../lib/api";

interface Table { id: string; number: string; status: string; capacity: number }

export default function TablesScreen() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);

  useEffect(() => {
    hub<{ tables: Table[] }>("/hub/floor").then((f) => setTables(f.tables ?? f as unknown as Table[])).catch(console.error);
  }, []);

  const statusColor = (s: string) => {
    if (s === "free") return "#22c55e";
    if (s === "seated") return "#f97316";
    return "#6b7280";
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Floor — C1</Text>
      <FlatList
        data={tables}
        numColumns={2}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.tableCard, { borderColor: statusColor(item.status) }]}
            onPress={() => router.push({ pathname: "/order", params: { tableId: item.id, tableNumber: item.number } })}
          >
            <Text style={styles.tableNumber}>{item.number}</Text>
            <Text style={styles.tableStatus}>{item.status}</Text>
            <Text style={styles.tableCapacity}>{item.capacity} seats</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  title: { color: "#ea580c", fontSize: 20, fontWeight: "bold", padding: 16 },
  tableCard: { flex: 1, margin: 6, padding: 20, borderRadius: 12, borderWidth: 2, backgroundColor: "#1a1a1a", alignItems: "center" },
  tableNumber: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  tableStatus: { fontSize: 12, color: "#999", marginTop: 4, textTransform: "capitalize" },
  tableCapacity: { fontSize: 11, color: "#666", marginTop: 2 },
});
