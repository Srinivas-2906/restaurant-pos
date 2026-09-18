import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/ui/States";
import { formatNumber } from "@/src/management/format";
import { useManagement } from "@/src/management/ManagementProvider";

type ItemRow = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  isLowStock: boolean;
};

export default function InventoryScreen() {
  const router = useRouter();
  const { api, outletId } = useManagement();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await api.reports.inventory(outletId);
      setItems(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          unit: r.unit,
          currentStock: Number(r.currentStock),
          reorderLevel: Number(r.reorderLevel),
          isLowStock: r.isLowStock,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [api, outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (lowOnly && !item.isLowStock) return false;
      if (!query.trim()) return true;
      return item.name.toLowerCase().includes(query.trim().toLowerCase());
    });
  }, [items, query, lowOnly]);

  if (loading && items.length === 0) return <LoadingState />;
  if (error && items.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inventory</Text>
      <TextInput
        placeholder="Search items"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />
      <Pressable style={[styles.chip, lowOnly && styles.chipActive]} onPress={() => setLowOnly((v) => !v)}>
        <Text style={[styles.chipText, lowOnly && styles.chipTextActive]}>Low stock only</Text>
      </Pressable>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={<EmptyState title="No items" message="Try changing your search or filters." />}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/management/inventory/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>
                {formatNumber(item.currentStock)} {item.unit}
                {item.isLowStock ? " · Low stock" : ""}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingTop: 56, paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12, color: "#0f172a" },
  search: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  chipActive: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  chipText: { color: "#64748b" },
  chipTextActive: { color: "#9a3412", fontWeight: "600" },
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
