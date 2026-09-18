import { useRouter } from "expo-router";
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
import { useManagement } from "@/src/management/ManagementProvider";

export default function AddPurchaseScreen() {
  const router = useRouter();
  const { api, outletId } = useManagement();
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [ingredients, setIngredients] = useState<Array<{ id: string; name: string; unit: string }>>([]);
  const [supplierId, setSupplierId] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [rate, setRate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const [sup, ing] = await Promise.all([
        api.inventory.suppliers(outletId),
        api.inventory.ingredients(outletId),
      ]);
      setSuppliers(sup);
      setIngredients(ing);
      setSupplierId(sup[0]?.id ?? "");
      setIngredientId(ing[0]?.id ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load purchase form");
    } finally {
      setLoading(false);
    }
  }, [api, outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(receiveNow: boolean) {
    if (!outletId) return;
    const qty = Number(quantity);
    const unitPrice = Number(rate);
    if (!supplierId || !ingredientId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      Alert.alert("Missing details", "Choose supplier, item, quantity, and rate.");
      return;
    }
    setSaving(true);
    try {
      const po = await api.inventory.createPurchaseOrder(outletId, {
        supplierId,
        items: [{ ingredientId, quantity: qty, unitPrice }],
      });
      if (receiveNow && po.items?.[0]?.id) {
        await api.inventory.receivePurchaseOrder(po.id, [{ poItemId: po.items[0].id, receivedQty: qty }]);
      }
      Alert.alert("Saved", receiveNow ? "Purchase recorded and stock received." : "Purchase order created.");
      router.replace("/management/purchases");
    } catch (err) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Add Purchase</Text>

      <Text style={styles.label}>Supplier</Text>
      <View style={styles.pills}>
        {suppliers.map((s) => (
          <Pressable
            key={s.id}
            style={[styles.pill, supplierId === s.id && styles.pillActive]}
            onPress={() => setSupplierId(s.id)}
          >
            <Text style={[styles.pillText, supplierId === s.id && styles.pillTextActive]}>{s.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Item</Text>
      <View style={styles.pills}>
        {ingredients.map((i) => (
          <Pressable
            key={i.id}
            style={[styles.pill, ingredientId === i.id && styles.pillActive]}
            onPress={() => setIngredientId(i.id)}
          >
            <Text style={[styles.pillText, ingredientId === i.id && styles.pillTextActive]}>{i.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Quantity</Text>
      <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="e.g. 5" />

      <Text style={styles.label}>Rate (per unit)</Text>
      <TextInput style={styles.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="e.g. 220" />

      <Pressable style={styles.btn} disabled={saving} onPress={() => void save(true)}>
        <Text style={styles.btnText}>{saving ? "Saving…" : "Save & receive stock"}</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.btnSecondary]} disabled={saving} onPress={() => void save(false)}>
        <Text style={styles.btnTextSecondary}>Save as draft PO</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16, paddingTop: 56 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16, color: "#0f172a" },
  label: { fontWeight: "600", color: "#334155", marginBottom: 6, marginTop: 8 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  pillActive: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  pillText: { color: "#64748b", fontSize: 13 },
  pillTextActive: { color: "#9a3412", fontWeight: "600" },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, marginBottom: 8 },
  btn: { backgroundColor: "#9a3412", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 8 },
  btnSecondary: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#fed7aa" },
  btnText: { color: "#fff", fontWeight: "600" },
  btnTextSecondary: { color: "#9a3412", fontWeight: "600" },
});
