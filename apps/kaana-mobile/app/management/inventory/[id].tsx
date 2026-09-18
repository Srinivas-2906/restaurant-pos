import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ErrorState, LoadingState } from "@/src/components/ui/States";
import { formatNumber, formatTime } from "@/src/management/format";
import { useManagement } from "@/src/management/ManagementProvider";

export default function InventoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { api, outletId } = useManagement();
  const [item, setItem] = useState<{
    id: string;
    name: string;
    unit: string;
    currentStock: number;
    reorderLevel: number;
  } | null>(null);
  const [ledger, setLedger] = useState<Array<{ id: string; type: string; quantity: number | string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [wastageQty, setWastageQty] = useState("");

  const load = useCallback(async () => {
    if (!outletId || !id) return;
    setLoading(true);
    try {
      const [rows, moves] = await Promise.all([
        api.reports.inventory(outletId),
        api.inventory.stockLedger(outletId, id, 10),
      ]);
      const found = rows.find((r) => r.id === id);
      if (!found) throw new Error("Item not found");
      setItem({
        id: found.id,
        name: found.name,
        unit: found.unit,
        currentStock: Number(found.currentStock),
        reorderLevel: Number(found.reorderLevel),
      });
      setLedger(moves);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load item");
    } finally {
      setLoading(false);
    }
  }, [api, outletId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function adjustStock(sign: 1 | -1) {
    if (!outletId || !item) return;
    const qty = Number(adjustQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert("Invalid quantity", "Enter a positive number.");
      return;
    }
    await api.inventory.adjustStock(outletId, {
      ingredientId: item.id,
      quantity: sign * qty,
      reason: sign > 0 ? "adjustment_in" : "adjustment_out",
      notes: "Mobile adjustment",
    });
    setAdjustQty("");
    await load();
  }

  async function recordWastage() {
    if (!outletId || !item) return;
    const qty = Number(wastageQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert("Invalid quantity", "Enter a positive number.");
      return;
    }
    await api.inventory.recordWastage(outletId, {
      ingredientId: item.id,
      quantity: qty,
      reason: "mobile_wastage",
      notes: "Mobile wastage",
    });
    setWastageQty("");
    await load();
  }

  if (loading) return <LoadingState />;
  if (error || !item) return <ErrorState message={error ?? "Not found"} onRetry={() => void load()} />;

  return (
    <ScrollView style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.stock}>
        {formatNumber(item.currentStock)} {item.unit}
      </Text>
      <Text style={styles.meta}>Reorder at {formatNumber(item.reorderLevel)} {item.unit}</Text>

      <Text style={styles.section}>Adjust stock</Text>
      <TextInput style={styles.input} value={adjustQty} onChangeText={setAdjustQty} keyboardType="decimal-pad" placeholder="Quantity" />
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => void adjustStock(1)}>
          <Text style={styles.btnText}>Add</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => void adjustStock(-1)}>
          <Text style={styles.btnTextSecondary}>Remove</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Record wastage</Text>
      <TextInput style={styles.input} value={wastageQty} onChangeText={setWastageQty} keyboardType="decimal-pad" placeholder="Quantity" />
      <Pressable style={styles.btn} onPress={() => void recordWastage()}>
        <Text style={styles.btnText}>Save wastage</Text>
      </Pressable>

      <Text style={styles.section}>Recent movement</Text>
      {ledger.length === 0 ? (
        <Text style={styles.meta}>No recent movements.</Text>
      ) : (
        ledger.map((row) => (
          <Text key={row.id} style={styles.line}>
            {row.type} · {row.quantity} · {formatTime(row.createdAt)}
          </Text>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16, paddingTop: 56 },
  back: { color: "#9a3412", marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  stock: { fontSize: 28, fontWeight: "700", color: "#9a3412", marginTop: 4 },
  meta: { color: "#64748b", marginTop: 4, marginBottom: 12 },
  section: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8, color: "#0f172a" },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  btn: { backgroundColor: "#9a3412", padding: 12, borderRadius: 10, alignItems: "center", marginBottom: 8 },
  btnSecondary: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#fed7aa" },
  btnText: { color: "#fff", fontWeight: "600" },
  btnTextSecondary: { color: "#9a3412", fontWeight: "600" },
  line: { color: "#334155", marginBottom: 6 },
});
