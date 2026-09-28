import { useCallback, useEffect, useState } from "react";

import {

  Alert,

  Pressable,

  RefreshControl,

  ScrollView,

  StyleSheet,

  Text,

  TextInput,

  View,

} from "react-native";

import { useRouter } from "expo-router";

import type { SupplierDues } from "@kaana/api-client";

import { ErrorState, LoadingState } from "@/src/components/ui/States";

import { formatInr, formatTime } from "@/src/management/format";

import { useManagement } from "@/src/management/ManagementProvider";



export default function SupplierDuesScreen() {

  const router = useRouter();

  const { api, outletId, access } = useManagement();

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [dues, setDues] = useState<SupplierDues | null>(null);

  const [payAmount, setPayAmount] = useState<Record<string, string>>({});

  const [paying, setPaying] = useState<string | null>(null);



  const load = useCallback(async () => {

    if (!outletId) return;

    setLoading(true);

    setError(null);

    try {

      const data = await api.accounting.supplierDues(outletId);

      setDues(data);

    } catch (err) {

      setError(err instanceof Error ? err.message : "Failed to load supplier dues");

    } finally {

      setLoading(false);

    }

  }, [api, outletId]);



  useEffect(() => {

    void load();

  }, [load]);



  const payBill = async (billId: string, supplierId: string, remaining: number) => {

    if (!outletId) return;

    const raw = payAmount[billId] ?? String(remaining);

    const amount = Number(raw);

    if (!Number.isFinite(amount) || amount <= 0) {

      Alert.alert("Invalid amount", "Enter a valid payment amount.");

      return;

    }

    if (amount > remaining + 0.01) {

      Alert.alert("Overpayment", `Outstanding is ${formatInr(remaining)}.`);

      return;

    }

    setPaying(billId);

    try {

      await api.accounting.supplierPayment({

        outletId,

        supplierId,

        purchaseInvoiceId: billId,

        amount,

        paymentMethod: "cash",

      });

      await load();

      Alert.alert("Payment recorded", `${formatInr(amount)} paid to supplier.`);

    } catch (err) {

      Alert.alert("Payment failed", err instanceof Error ? err.message : "Try again.");

    } finally {

      setPaying(null);

    }

  };



  if (loading && !dues) return <LoadingState />;

  if (error && !dues) return <ErrorState message={error} onRetry={() => void load()} />;



  return (

    <ScrollView

      style={styles.container}

      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}

    >

      <Pressable onPress={() => router.back()}>

        <Text style={styles.back}>‹ Back</Text>

      </Pressable>

      <Text style={styles.title}>Supplier Dues</Text>

      <Text style={styles.subtitle}>Purchase bills outstanding — not operating expenses.</Text>



      <View style={styles.summaryCard}>

        <Text style={styles.summaryLabel}>Total Outstanding</Text>

        <Text style={styles.summaryValue}>{formatInr(dues!.totalOutstanding)}</Text>

        <Text style={styles.meta}>AP balance: {formatInr(dues!.apBalance)}</Text>

      </View>



      {dues!.bills.length === 0 ? (

        <View style={styles.empty}>

          <Text style={styles.emptyText}>No outstanding supplier bills.</Text>

        </View>

      ) : (

        dues!.bills.map((bill) => (

          <View key={bill.billId} style={styles.card}>

            <Text style={styles.supplier}>{bill.supplierName}</Text>

            <Text style={styles.billNo}>Bill {bill.billNumber}</Text>

            <View style={styles.row}>

              <Text style={styles.label}>Total</Text>

              <Text style={styles.value}>{formatInr(bill.billTotal)}</Text>

            </View>

            <View style={styles.row}>

              <Text style={styles.label}>Paid</Text>

              <Text style={styles.value}>{formatInr(bill.paid)}</Text>

            </View>

            <View style={styles.row}>

              <Text style={styles.label}>Remaining</Text>

              <Text style={[styles.value, styles.remaining]}>{formatInr(bill.remaining)}</Text>

            </View>

            {bill.dueDate ? (

              <Text style={styles.meta}>Due {formatTime(bill.dueDate)}</Text>

            ) : null}

            {access.canViewFinanceSummary ? (

              <View style={styles.payRow}>

                <TextInput

                  style={styles.input}

                  keyboardType="numeric"

                  placeholder={String(bill.remaining)}

                  value={payAmount[bill.billId] ?? ""}

                  onChangeText={(t) => setPayAmount((p) => ({ ...p, [bill.billId]: t }))}

                />

                <Pressable

                  style={styles.payBtn}

                  disabled={paying === bill.billId}

                  onPress={() => void payBill(bill.billId, bill.supplierId, bill.remaining)}

                >

                  <Text style={styles.payBtnText}>{paying === bill.billId ? "…" : "Pay"}</Text>

                </Pressable>

              </View>

            ) : null}

          </View>

        ))

      )}

    </ScrollView>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16, paddingTop: 56 },

  back: { color: "#ea580c", fontWeight: "600", marginBottom: 8 },

  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },

  subtitle: { color: "#64748b", marginBottom: 16 },

  summaryCard: {

    backgroundColor: "#fff",

    borderRadius: 12,

    padding: 16,

    marginBottom: 16,

    borderWidth: 1,

    borderColor: "#e2e8f0",

  },

  summaryLabel: { color: "#64748b", fontWeight: "600" },

  summaryValue: { fontSize: 28, fontWeight: "700", color: "#0f172a", marginTop: 4 },

  meta: { color: "#94a3b8", fontSize: 12, marginTop: 4 },

  empty: { padding: 24, alignItems: "center" },

  emptyText: { color: "#94a3b8" },

  card: {

    backgroundColor: "#fff",

    borderRadius: 12,

    padding: 14,

    marginBottom: 10,

    borderWidth: 1,

    borderColor: "#e2e8f0",

  },

  supplier: { fontWeight: "700", fontSize: 16, color: "#0f172a" },

  billNo: { color: "#64748b", marginBottom: 8 },

  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },

  label: { color: "#64748b" },

  value: { fontWeight: "600", color: "#0f172a" },

  remaining: { color: "#b91c1c" },

  payRow: { flexDirection: "row", gap: 8, marginTop: 10 },

  input: {

    flex: 1,

    borderWidth: 1,

    borderColor: "#e2e8f0",

    borderRadius: 8,

    paddingHorizontal: 12,

    paddingVertical: 8,

    backgroundColor: "#f8fafc",

  },

  payBtn: {

    backgroundColor: "#ea580c",

    borderRadius: 8,

    paddingHorizontal: 16,

    justifyContent: "center",

  },

  payBtnText: { color: "#fff", fontWeight: "700" },

});


