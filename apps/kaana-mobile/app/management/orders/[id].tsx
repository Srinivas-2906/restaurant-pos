import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { OrderDetail } from "@kaana/api-client";
import { ErrorState, LoadingState } from "@/src/components/ui/States";
import { formatInr, formatOrderStatus, formatTime } from "@/src/management/format";
import { useManagement } from "@/src/management/ManagementProvider";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useManagement();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void api.orders
      .getOne(id)
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load order"))
      .finally(() => setLoading(false));
  }, [api, id]);

  if (loading) return <LoadingState />;
  if (error || !order) return <ErrorState message={error ?? "Order not found"} />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Order #{order.orderNumber ?? order.id.slice(-6)}</Text>
      <Text style={styles.meta}>{formatOrderStatus(order.status)} · {formatTime(order.createdAt)}</Text>
      <Text style={styles.amount}>{formatInr(order.totalAmount ?? 0)}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Items</Text>
        {(order.items ?? []).map((item) => (
          <Text key={item.id} style={styles.line}>Qty {item.quantity ?? 1}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16, paddingTop: 56 },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  meta: { color: "#64748b", marginTop: 4, marginBottom: 8 },
  amount: { fontSize: 28, fontWeight: "700", color: "#9a3412", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e2e8f0" },
  cardTitle: { fontWeight: "700", marginBottom: 8 },
  line: { color: "#334155", marginBottom: 4 },
});
