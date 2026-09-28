import { useCallback, useEffect, useState } from "react";

import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { useRouter } from "expo-router";

import type { BalanceSheetReport } from "@kaana/api-client";

import { ErrorState, LoadingState } from "@/src/components/ui/States";

import { formatInr } from "@/src/management/format";

import { useManagement } from "@/src/management/ManagementProvider";



export default function BalanceSheetScreen() {

  const router = useRouter();

  const { api, outletId } = useManagement();

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [bs, setBs] = useState<BalanceSheetReport | null>(null);



  const load = useCallback(async () => {

    if (!outletId) return;

    setLoading(true);

    setError(null);

    try {

      const report = await api.accounting.balanceSheet(undefined, outletId);

      setBs(report);

    } catch (err) {

      setError(err instanceof Error ? err.message : "Failed to load balance sheet");

    } finally {

      setLoading(false);

    }

  }, [api, outletId]);



  useEffect(() => {

    void load();

  }, [load]);



  if (loading && !bs) return <LoadingState />;

  if (error && !bs) return <ErrorState message={error} onRetry={() => void load()} />;



  const balanced = Math.abs(bs!.totalAssets - (bs!.totalLiabilities + bs!.totalEquity)) < 0.02;



  return (

    <ScrollView

      style={styles.container}

      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}

    >

      <Pressable onPress={() => router.back()}>

        <Text style={styles.back}>‹ Back</Text>

      </Pressable>

      <Text style={styles.title}>Balance Sheet</Text>

      <Text style={styles.subtitle}>Simplified summary — Assets = Liabilities + Equity</Text>



      <View style={styles.card}>

        <Row label="Total Assets" value={formatInr(bs!.totalAssets)} bold />

        <Row label="Total Liabilities" value={formatInr(bs!.totalLiabilities)} />

        <Row label="Total Equity" value={formatInr(bs!.totalEquity)} />

        <Row label="Retained Earnings" value={formatInr(bs!.retainedEarnings)} />

      </View>



      <View style={[styles.status, balanced && bs!.ok ? styles.statusOk : styles.statusWarn]}>

        <Text style={styles.statusText}>

          {balanced && bs!.ok ? "Books balance correctly" : "Balance sheet needs review"}

        </Text>

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

  bold: { fontWeight: "700" },

  status: { marginTop: 16, padding: 12, borderRadius: 10 },

  statusOk: { backgroundColor: "#dcfce7" },

  statusWarn: { backgroundColor: "#fef3c7" },

  statusText: { fontWeight: "600", color: "#0f172a", textAlign: "center" },

});


