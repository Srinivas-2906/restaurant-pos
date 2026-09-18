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

import type { ExpenseCategory, ExpenseItem } from "@kaana/api-client";

import { ErrorState, LoadingState } from "@/src/components/ui/States";

import { formatInr, formatTime } from "@/src/management/format";

import { useManagement } from "@/src/management/ManagementProvider";



type ExpensePeriod = "today" | "week" | "month";



export default function ExpensesScreen() {

  const router = useRouter();

  const { api, outletId } = useManagement();

  const [period, setPeriod] = useState<ExpensePeriod>("today");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  const [showForm, setShowForm] = useState(false);

  const [amount, setAmount] = useState("");

  const [description, setDescription] = useState("");

  const [categoryCode, setCategoryCode] = useState("5300");

  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [saving, setSaving] = useState(false);



  const periodParams = useCallback(async () => {

    const summary = await api.accounting.moneySummary({

      period: period === "today" ? "today" : period === "week" ? "week" : "month",

      outletId: outletId ?? undefined,

    });

    return { from: summary.period.from, to: summary.period.to };

  }, [api, outletId, period]);



  const load = useCallback(async () => {

    if (!outletId) return;

    setLoading(true);

    setError(null);

    try {

      const { from, to } = await periodParams();

      const [list, cats] = await Promise.all([

        api.accounting.listExpenses({ outletId, from, to }),

        categories.length ? Promise.resolve(categories) : api.accounting.expenseCategories(),

      ]);

      setExpenses(list);

      if (cats.length) setCategories(cats);

    } catch (err) {

      setError(err instanceof Error ? err.message : "Failed to load expenses");

    } finally {

      setLoading(false);

    }

  }, [api, outletId, periodParams, categories.length]);



  useEffect(() => {

    void load();

  }, [load]);



  const total = expenses.reduce((s, e) => s + e.amount, 0);



  const saveExpense = async () => {

    if (!outletId) return;

    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {

      Alert.alert("Invalid amount", "Enter a positive amount.");

      return;

    }

    if (!description.trim()) {

      Alert.alert("Description required", "Describe what this expense was for.");

      return;

    }

    setSaving(true);

    try {

      await api.accounting.createExpense({

        outletId,

        amount: value,

        description: description.trim(),

        paymentMethod,

        expenseAccountCode: categoryCode,

      });

      setAmount("");

      setDescription("");

      setShowForm(false);

      await load();

      Alert.alert("Expense recorded", formatInr(value));

    } catch (err) {

      Alert.alert("Failed", err instanceof Error ? err.message : "Try again.");

    } finally {

      setSaving(false);

    }

  };



  if (loading && expenses.length === 0 && !showForm) return <LoadingState />;

  if (error && expenses.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;



  return (

    <ScrollView

      style={styles.container}

      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}

    >

      <Pressable onPress={() => router.back()}>

        <Text style={styles.back}>‹ Back</Text>

      </Pressable>

      <Text style={styles.title}>Expenses</Text>

      <Text style={styles.subtitle}>Operating expenses — not inventory purchases.</Text>



      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodRow}>

        {(["today", "week", "month"] as ExpensePeriod[]).map((p) => (

          <Pressable

            key={p}

            style={[styles.periodPill, period === p && styles.periodPillActive]}

            onPress={() => setPeriod(p)}

          >

            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>

              {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}

            </Text>

          </Pressable>

        ))}

      </ScrollView>



      <View style={styles.totalCard}>

        <Text style={styles.totalLabel}>Total</Text>

        <Text style={styles.totalValue}>{formatInr(total)}</Text>

      </View>



      <Pressable style={styles.addBtn} onPress={() => setShowForm((v) => !v)}>

        <Text style={styles.addBtnText}>{showForm ? "Cancel" : "+ Add Expense"}</Text>

      </Pressable>



      {showForm ? (

        <View style={styles.form}>

          <TextInput

            style={styles.input}

            keyboardType="numeric"

            placeholder="Amount (₹)"

            value={amount}

            onChangeText={setAmount}

          />

          <TextInput

            style={styles.input}

            placeholder="Description"

            value={description}

            onChangeText={setDescription}

          />

          <Text style={styles.fieldLabel}>Category</Text>

          <View style={styles.chipRow}>

            {categories.map((c) => (

              <Pressable

                key={c.code}

                style={[styles.chip, categoryCode === c.code && styles.chipActive]}

                onPress={() => setCategoryCode(c.code)}

              >

                <Text style={[styles.chipText, categoryCode === c.code && styles.chipTextActive]}>

                  {c.label}

                </Text>

              </Pressable>

            ))}

          </View>

          <Text style={styles.fieldLabel}>Payment method</Text>

          <View style={styles.chipRow}>

            {(["cash", "upi", "card", "bank"] as const).map((m) => (

              <Pressable

                key={m}

                style={[styles.chip, paymentMethod === m && styles.chipActive]}

                onPress={() => setPaymentMethod(m)}

              >

                <Text style={[styles.chipText, paymentMethod === m && styles.chipTextActive]}>

                  {m.toUpperCase()}

                </Text>

              </Pressable>

            ))}

          </View>

          <Pressable style={styles.saveBtn} disabled={saving} onPress={() => void saveExpense()}>

            <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Expense"}</Text>

          </Pressable>

        </View>

      ) : null}



      {expenses.length === 0 ? (

        <View style={styles.empty}>

          <Text style={styles.emptyText}>No expenses in this period.</Text>

        </View>

      ) : (

        expenses.map((e) => (

          <View key={e.id} style={styles.card}>

            <View style={styles.cardHeader}>

              <Text style={styles.cardTitle}>{e.description}</Text>

              <Text style={styles.cardAmount}>{formatInr(e.amount)}</Text>

            </View>

            <Text style={styles.meta}>

              {e.categoryName} · {e.paymentMethod.toUpperCase()} · {formatTime(e.expenseDate)}

            </Text>

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

  subtitle: { color: "#64748b", marginBottom: 12 },

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

  totalCard: {

    backgroundColor: "#fff",

    borderRadius: 12,

    padding: 16,

    marginBottom: 12,

    borderWidth: 1,

    borderColor: "#e2e8f0",

  },

  totalLabel: { color: "#64748b", fontWeight: "600" },

  totalValue: { fontSize: 28, fontWeight: "700", color: "#0f172a" },

  addBtn: {

    backgroundColor: "#ea580c",

    borderRadius: 10,

    padding: 14,

    alignItems: "center",

    marginBottom: 16,

  },

  addBtnText: { color: "#fff", fontWeight: "700" },

  form: {

    backgroundColor: "#fff",

    borderRadius: 12,

    padding: 14,

    marginBottom: 16,

    borderWidth: 1,

    borderColor: "#e2e8f0",

  },

  input: {

    borderWidth: 1,

    borderColor: "#e2e8f0",

    borderRadius: 8,

    paddingHorizontal: 12,

    paddingVertical: 10,

    marginBottom: 10,

    backgroundColor: "#f8fafc",

  },

  fieldLabel: { color: "#64748b", fontWeight: "600", marginBottom: 6, marginTop: 4 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },

  chip: {

    paddingHorizontal: 12,

    paddingVertical: 6,

    borderRadius: 16,

    borderWidth: 1,

    borderColor: "#e2e8f0",

    backgroundColor: "#f8fafc",

  },

  chipActive: { backgroundColor: "#ea580c", borderColor: "#ea580c" },

  chipText: { color: "#64748b", fontWeight: "600", fontSize: 12 },

  chipTextActive: { color: "#fff" },

  saveBtn: { backgroundColor: "#0f172a", borderRadius: 10, padding: 14, alignItems: "center" },

  saveBtnText: { color: "#fff", fontWeight: "700" },

  empty: { padding: 24, alignItems: "center" },

  emptyText: { color: "#94a3b8" },

  card: {

    backgroundColor: "#fff",

    borderRadius: 12,

    padding: 14,

    marginBottom: 8,

    borderWidth: 1,

    borderColor: "#e2e8f0",

  },

  cardHeader: { flexDirection: "row", justifyContent: "space-between" },

  cardTitle: { fontWeight: "600", color: "#0f172a", flex: 1, marginRight: 8 },

  cardAmount: { fontWeight: "700", color: "#b91c1c" },

  meta: { color: "#94a3b8", fontSize: 12, marginTop: 4 },

});


