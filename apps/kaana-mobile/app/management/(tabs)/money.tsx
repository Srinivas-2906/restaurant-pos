import { useCallback, useEffect, useState } from "react";

import {

  Pressable,

  RefreshControl,

  ScrollView,

  StyleSheet,

  Text,

  View,

} from "react-native";

import { useRouter } from "expo-router";

import type { MoneyPeriodPreset, MoneySummary } from "@kaana/api-client";

import { MetricCard } from "@/src/components/ui/MetricCard";

import { ErrorState, LoadingState } from "@/src/components/ui/States";

import { formatInr, formatNumber } from "@/src/management/format";

import { useManagement } from "@/src/management/ManagementProvider";



const PERIODS: Array<{ key: MoneyPeriodPreset; label: string }> = [

  { key: "today", label: "Today" },

  { key: "yesterday", label: "Yesterday" },

  { key: "week", label: "This Week" },

  { key: "month", label: "This Month" },

];



export default function MoneyScreen() {

  const router = useRouter();

  const { api, outletId, access } = useManagement();

  const [period, setPeriod] = useState<MoneyPeriodPreset>("today");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<MoneySummary | null>(null);



  const load = useCallback(async () => {

    if (!outletId) return;

    setLoading(true);

    setError(null);

    try {

      const data = await api.accounting.moneySummary({ period, outletId });

      setSummary(data);

    } catch (err) {

      setError(err instanceof Error ? err.message : "Failed to load money summary");

    } finally {

      setLoading(false);

    }

  }, [api, outletId, period]);



  useEffect(() => {

    void load();

  }, [load]);



  if (loading && !summary) return <LoadingState />;

  if (error && !summary) return <ErrorState message={error} onRetry={() => void load()} />;



  const s = summary!;

  const showUPI = Math.abs(s.balances.upiPendingSettlement) > 0.01;

  const showCard = Math.abs(s.balances.cardPendingSettlement) > 0.01;



  return (

    <ScrollView

      style={styles.container}

      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}

    >

      <Text style={styles.title}>Money</Text>

      <Text style={styles.subtitle}>Your business at a glance — from the books, not guesses.</Text>



      {!s.integrity.ok ? (

        <View style={styles.warningBox}>

          <Text style={styles.warningText}>{s.integrity.warning ?? "Financial data needs reconciliation"}</Text>

        </View>

      ) : null}



      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodRow}>

        {PERIODS.map((p) => (

          <Pressable

            key={p.key}

            style={[styles.periodPill, period === p.key && styles.periodPillActive]}

            onPress={() => setPeriod(p.key)}

          >

            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>{p.label}</Text>

          </Pressable>

        ))}

      </ScrollView>



      <Text style={styles.section}>Summary — {s.period.label}</Text>

      <View style={styles.metricsRow}>

        <MetricCard label="Sales" value={formatInr(s.sales)} subtitle={`${formatNumber(s.orders)} orders`} />

        <MetricCard label="Expenses" value={formatInr(s.expenses)} />

      </View>

      <View style={styles.metricsRow}>

        <MetricCard

          label="Profit"

          value={formatInr(s.profit)}

          subtitle={`Gross ${formatInr(s.profitSummary.grossProfit)}`}

        />

        <MetricCard

          label="Cash in Hand"

          value={formatInr(s.balances.cashInHand)}

          subtitle="Actual cash balance"

        />

      </View>



      <Text style={styles.hint}>

        Profit and cash are different — profit is what you earned; cash is what you hold.

      </Text>



      <Text style={styles.section}>Sales by payment</Text>

      <View style={styles.metricsRow}>

        <MetricCard label="Cash sales" value={formatInr(s.paymentBreakdown.cash)} />

        <MetricCard label="UPI sales" value={formatInr(s.paymentBreakdown.upi)} />

        <MetricCard label="Card sales" value={formatInr(s.paymentBreakdown.card)} />

      </View>



      <Text style={styles.section}>Balances</Text>

      <View style={styles.metricsRow}>

        {s.balances.bank !== 0 ? (

          <MetricCard label="Bank" value={formatInr(s.balances.bank)} />

        ) : null}

        {showUPI ? (

          <MetricCard

            label="UPI Pending Settlement"

            value={formatInr(s.balances.upiPendingSettlement)}

          />

        ) : null}

        {showCard ? (

          <MetricCard

            label="Card Pending Settlement"

            value={formatInr(s.balances.cardPendingSettlement)}

          />

        ) : null}

      </View>



      <View style={styles.metricsRow}>

        <MetricCard label="Supplier Due" value={formatInr(s.supplierDue)} />

        <MetricCard

          label="Inventory Value"

          value={s.inventoryValue != null ? formatInr(s.inventoryValue) : "—"}

          subtitle={s.inventoryReconciled ? "Reconciled" : "Needs reconciliation"}

        />

      </View>



      <Text style={styles.section}>Profit breakdown</Text>

      <View style={styles.breakdownCard}>

        <Row label="Revenue" value={formatInr(s.profitSummary.revenue)} />

        <Row label="COGS" value={`− ${formatInr(s.profitSummary.cogs)}`} />

        <Row label="Gross Profit" value={formatInr(s.profitSummary.grossProfit)} bold />

        <Row label="Expenses" value={`− ${formatInr(s.profitSummary.expenses)}`} />

        <Row label="Net Profit" value={formatInr(s.profitSummary.netProfit)} bold />

      </View>



      <Text style={styles.section}>Daily summary</Text>

      <View style={styles.breakdownCard}>

        <Row label="Sales" value={formatInr(s.dailySummary.sales)} />

        <Row label="Orders" value={formatNumber(s.dailySummary.orders)} />

        <Row label="Cash / UPI / Card" value={`${formatInr(s.dailySummary.cashSales)} / ${formatInr(s.dailySummary.upiSales)} / ${formatInr(s.dailySummary.cardSales)}`} />

        <Row label="COGS" value={formatInr(s.dailySummary.cogs)} />

        <Row label="Gross Profit" value={formatInr(s.dailySummary.grossProfit)} />

        <Row label="Expenses" value={formatInr(s.dailySummary.expenses)} />

        <Row label="Net Profit" value={formatInr(s.dailySummary.netProfit)} bold />

      </View>



      <Text style={styles.section}>Actions</Text>

      <View style={styles.linkList}>

        <LinkRow label="Money Activity" onPress={() => router.push("/management/money/activity")} />

        <LinkRow label="Expenses" onPress={() => router.push("/management/expenses")} />

        <LinkRow label="Supplier Dues" onPress={() => router.push("/management/money/supplier-dues")} />

        <LinkRow label="Profit & Loss" onPress={() => router.push("/management/money/profit-loss")} />

        <LinkRow label="Balance Sheet" onPress={() => router.push("/management/money/balance-sheet")} />

        {access.canViewOwnerFinance ? (

          <LinkRow label="Owner Funds & Withdrawals" onPress={() => router.push("/management/money/owner")} />

        ) : null}

      </View>

    </ScrollView>

  );

}



function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {

  return (

    <View style={styles.rowLine}>

      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>

      <Text style={[styles.rowValue, bold && styles.bold]}>{value}</Text>

    </View>

  );

}



function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {

  return (

    <Pressable style={styles.linkRow} onPress={onPress}>

      <Text style={styles.linkText}>{label}</Text>

      <Text style={styles.chevron}>›</Text>

    </Pressable>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16, paddingTop: 56 },

  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },

  subtitle: { color: "#64748b", marginTop: 4, marginBottom: 12, lineHeight: 20 },

  warningBox: {

    backgroundColor: "#fef3c7",

    borderRadius: 10,

    padding: 12,

    marginBottom: 12,

    borderWidth: 1,

    borderColor: "#fcd34d",

  },

  warningText: { color: "#92400e", fontWeight: "600" },

  periodRow: { marginBottom: 12, maxHeight: 44 },

  periodPill: {

    paddingHorizontal: 14,

    paddingVertical: 8,

    borderRadius: 20,

    backgroundColor: "#fff",

    borderWidth: 1,

    borderColor: "#e2e8f0",

    marginRight: 8,

  },

  periodPillActive: { backgroundColor: "#ea580c", borderColor: "#ea580c" },

  periodText: { color: "#64748b", fontWeight: "600", fontSize: 13 },

  periodTextActive: { color: "#fff" },

  section: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8, color: "#0f172a" },

  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  hint: { color: "#94a3b8", fontSize: 12, marginTop: 8, lineHeight: 18 },

  breakdownCard: {

    backgroundColor: "#fff",

    borderRadius: 12,

    padding: 14,

    borderWidth: 1,

    borderColor: "#e2e8f0",

  },

  rowLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },

  rowLabel: { color: "#64748b", fontSize: 14 },

  rowValue: { color: "#0f172a", fontSize: 14, fontWeight: "600" },

  bold: { fontWeight: "700", color: "#0f172a" },

  linkList: { marginBottom: 32 },

  linkRow: {

    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    backgroundColor: "#fff",

    borderRadius: 12,

    padding: 16,

    marginBottom: 8,

    borderWidth: 1,

    borderColor: "#e2e8f0",

  },

  linkText: { fontSize: 16, fontWeight: "600", color: "#0f172a" },

  chevron: { fontSize: 22, color: "#94a3b8" },

});


