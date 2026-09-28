import { useCallback, useEffect, useState } from "react";

import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { useRouter } from "expo-router";

import type { ProfitAndLossReport } from "@kaana/api-client";

import { ErrorState, LoadingState } from "@/src/components/ui/States";

import { formatInr } from "@/src/management/format";

import { useManagement } from "@/src/management/ManagementProvider";



export default function ProfitLossScreen() {

  const router = useRouter();

  const { api, outletId } = useManagement();

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [pl, setPl] = useState<ProfitAndLossReport | null>(null);



  const load = useCallback(async () => {

    if (!outletId) return;

    setLoading(true);

    setError(null);

    try {

      const summary = await api.accounting.moneySummary({ period: "month", outletId });

      const report = await api.accounting.profitAndLoss(summary.period.from, summary.period.to, outletId);

      setPl(report);

    } catch (err) {

      setError(err instanceof Error ? err.message : "Failed to load P&L");

    } finally {

      setLoading(false);

    }

  }, [api, outletId]);



  useEffect(() => {

    void load();

  }, [load]);



  if (loading && !pl) return <LoadingState />;

  if (error && !pl) return <ErrorState message={error} onRetry={() => void load()} />;



  return (

    <ScrollView

      style={styles.container}

      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}

    >

      <Pressable onPress={() => router.back()}>

        <Text style={styles.back}>‹ Back</Text>

      </Pressable>

      <Text style={styles.title}>Profit & Loss</Text>

      <Text style={styles.subtitle}>This month — from journal entries.</Text>



      <View style={styles.card}>

        <Row label="Revenue" value={formatInr(pl!.netRevenue)} />

        <Row label="COGS" value={`− ${formatInr(pl!.cogs)}`} />

        <Row label="Gross Profit" value={formatInr(pl!.grossProfit)} bold />

        <Row

          label="Expenses"

          value={`− ${formatInr(pl!.expenses.filter((e) => e.code !== "5000").reduce((s, e) => s + e.amount, 0))}`}

        />

        <Row label="Net Profit" value={formatInr(pl!.netProfit)} bold />

      </View>

    </ScrollView>

  );

}



function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {

  return (

    <View style={styles.row}>

      <Text style={[styles.label, bold && styles.bold]}>{label}</Text>

      <Text style={[styles.value, bold && styles.bold]}>{value}</Text>

    </View>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16, paddingTop: 56 },

  back: { color: "#ea580c", fontWeight: "600", marginBottom: 8 },

  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },

  subtitle: { color: "#64748b", marginBottom: 16 },

  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },

  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },

  label: { color: "#64748b" },

  value: { fontWeight: "600", color: "#0f172a" },

  bold: { fontWeight: "700", color: "#0f172a" },

});


