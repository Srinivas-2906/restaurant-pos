import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MetricCard } from "@/src/components/ui/MetricCard";
import { ErrorState, LoadingState } from "@/src/components/ui/States";
import { formatInr, formatNumber, periodPresets } from "@/src/management/format";
import { useManagement } from "@/src/management/ManagementProvider";

export default function SalesScreen() {
  const { api, outletId } = useManagement();
  const presets = periodPresets();
  const [period, setPeriod] = useState<keyof ReturnType<typeof periodPresets>>("today");
  const [report, setReport] = useState<{ totalRevenue: number; totalOrders: number; avgOrderValue: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    try {
      const range = presets[period];
      const data = await api.reports.sales(outletId, range.from, range.to);
      setReport({
        totalRevenue: data.totalRevenue,
        totalOrders: data.totalOrders,
        avgOrderValue: data.avgOrderValue,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales");
    } finally {
      setLoading(false);
    }
  }, [api, outletId, period, presets]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !report) return <LoadingState />;
  if (error && !report) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <Text style={styles.title}>Sales</Text>
      <View style={styles.filters}>
        {(Object.keys(presets) as Array<keyof typeof presets>).map((key) => (
          <Pressable
            key={key}
            style={[styles.chip, period === key && styles.chipActive]}
            onPress={() => setPeriod(key)}
          >
            <Text style={[styles.chipText, period === key && styles.chipTextActive]}>{presets[key].label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.metricsRow}>
        <MetricCard label="Gross sales" value={formatInr(report?.totalRevenue ?? 0)} />
        <MetricCard label="Orders" value={formatNumber(report?.totalOrders ?? 0)} />
        <MetricCard label="Avg order" value={formatInr(report?.avgOrderValue ?? 0)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16, paddingTop: 56 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12, color: "#0f172a" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  chipActive: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  chipText: { color: "#64748b", fontSize: 13 },
  chipTextActive: { color: "#9a3412", fontWeight: "600" },
  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
