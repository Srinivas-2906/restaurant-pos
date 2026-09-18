import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { ErrorState, LoadingState } from "@/src/components/ui/States";
import { endOfDayIso, formatInr, formatNumber, startOfDayIso } from "@/src/management/format";
import { useManagement } from "@/src/management/ManagementProvider";

export default function ReportsScreen() {
  const { api, outletId } = useManagement();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<{ totalRevenue: number; totalOrders: number; byPayment: Record<string, number> } | null>(null);
  const [topItems, setTopItems] = useState<Array<{ name: string; quantity: number; revenue: number }>>([]);

  const load = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    try {
      const from = startOfDayIso();
      const to = endOfDayIso();
      const [salesReport, items] = await Promise.all([
        api.reports.sales(outletId, from, to),
        api.reports.topItems(outletId, from, to),
      ]);
      setSales({
        totalRevenue: salesReport.totalRevenue,
        totalOrders: salesReport.totalOrders,
        byPayment: salesReport.byPayment ?? {},
      });
      setTopItems(items.slice(0, 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [api, outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !sales) return <LoadingState />;
  if (error && !sales) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <Text style={styles.title}>Reports</Text>
      <Text style={styles.section}>Daily sales</Text>
      <Text style={styles.line}>Revenue: {formatInr(sales?.totalRevenue ?? 0)}</Text>
      <Text style={styles.line}>Orders: {formatNumber(sales?.totalOrders ?? 0)}</Text>

      <Text style={styles.section}>Payment split</Text>
      {Object.entries(sales?.byPayment ?? {}).map(([method, amount]) => (
        <Text key={method} style={styles.line}>
          {method.toUpperCase()}: {formatInr(amount)}
        </Text>
      ))}

      <Text style={styles.section}>Top items today</Text>
      {topItems.length === 0 ? (
        <Text style={styles.line}>No item sales yet today.</Text>
      ) : (
        topItems.map((item) => (
          <Text key={item.name} style={styles.line}>
            {item.name} · {formatNumber(item.quantity)} sold · {formatInr(item.revenue)}
          </Text>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16, paddingTop: 56 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12, color: "#0f172a" },
  section: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8, color: "#0f172a" },
  line: { color: "#334155", marginBottom: 6, fontSize: 15 },
});
