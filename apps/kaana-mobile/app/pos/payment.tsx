import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { OrderDetail } from "@kaana/api-client";
import { LoadingState, ErrorState } from "@/src/components/ui/States";
import { formatInr } from "@/src/management/format";
import { usePos } from "@/src/pos/PosProvider";
import { useOfflinePos } from "@/src/offline/OfflinePosProvider";
import { getLocalOrder } from "@/src/offline/posLocalStore";
import { ORDER_TYPE_LABELS } from "@/src/pos/orderLabels";
import { money } from "@/src/pos/types";

type PayMethod = "cash" | "upi" | "card";

const METHODS: Array<{ id: PayMethod; label: string }> = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
];

export default function PosPaymentScreen() {
  const router = useRouter();
  const { orderId, discount } = useLocalSearchParams<{ orderId: string; discount?: string }>();
  const { api, permissions, restaurantName, outletName } = usePos();
  const offlinePos = useOfflinePos();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>("cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const settledRef = useRef(false);
  const idempotencyKeyRef = useRef(`mobile-settle-${orderId}-${Date.now()}`);

  const discountAmount = Math.max(0, Number(discount ?? 0) || 0);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    void (async () => {
      try {
        const local = await getLocalOrder(orderId);
        if (local) {
          const detail = offlinePos.toOrderDetail(local);
          setOrder(detail);
          const due = money(detail.totalAmount) - discountAmount;
          setAmountReceived(String(Math.ceil(due)));
          setLoading(false);
          return;
        }
        const o = await api.orders.getOne(orderId);
        setOrder(o);
        const due = money(o.totalAmount) - discountAmount;
        setAmountReceived(String(Math.ceil(due)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load order");
      } finally {
        setLoading(false);
      }
    })();
  }, [api, orderId, discountAmount, offlinePos]);

  const totalDue = order ? money(order.totalAmount) - discountAmount : 0;
  const received = Number(amountReceived) || 0;
  const change = received - totalDue;

  const submitPayment = useCallback(async () => {
    if (!order || submitting || settledRef.current) return;
    if (!permissions.canSettle) {
      setError("You do not have permission to settle bills");
      return;
    }
    if (received < totalDue) {
      setError(`Amount must be at least ${formatInr(totalDue)}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const local = await getLocalOrder(order.id);
      if (local || offlinePos.isOffline) {
        await offlinePos.settle(order.id, {
          payments: [{ method, amount: received }],
          discountAmount: discountAmount > 0 ? discountAmount : 0,
          idempotencyKey: idempotencyKeyRef.current,
        });
        settledRef.current = true;
        void offlinePos.triggerSync();
        router.replace({
          pathname: "/pos/receipt",
          params: {
            orderId: order.id,
            paymentMethod: method,
            paymentAmount: String(received),
            pendingSync: "1",
          },
        });
        return;
      }
      const result = await api.orders.settle(order.id, {
        payments: [{ method, amount: received }],
        discountAmount: discountAmount > 0 ? discountAmount : 0,
        loyaltyPointsUsed: 0,
        idempotencyKey: idempotencyKeyRef.current,
      });
      settledRef.current = true;
      router.replace({
        pathname: "/pos/receipt",
        params: {
          orderId: order.id,
          paymentMethod: method,
          paymentAmount: String(received),
        },
      });
      return result;
    } catch (err) {
      if (order.status === "settled") {
        settledRef.current = true;
        router.replace({
          pathname: "/pos/receipt",
          params: { orderId: order.id, paymentMethod: method, paymentAmount: String(received) },
        });
        return;
      }
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }, [order, submitting, permissions.canSettle, received, totalDue, api, method, discountAmount, router]);

  if (loading) return <LoadingState message="Loading bill…" />;
  if (error && !order) return <ErrorState message={error} onRetry={() => router.back()} />;
  if (!order) return <ErrorState message="Order not found" onRetry={() => router.back()} />;

  return (
    <ScrollView style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back to order</Text>
      </Pressable>

      <Text style={styles.title}>Bill preview</Text>
      <Text style={styles.subtitle}>
        {restaurantName} · {outletName}
      </Text>

      <View style={styles.card}>
        <Text style={styles.billNo}>#{order.orderNumber}</Text>
        <Text style={styles.meta}>
          {ORDER_TYPE_LABELS[order.type ?? "takeaway"]}
          {order.table?.number ? ` · Table ${order.table.number}` : ""}
        </Text>

        {order.items.map((item) => (
          <View key={item.id} style={styles.line}>
            <Text style={styles.lineName}>
              {item.quantity}× {item.name}
            </Text>
            <Text>{formatInr(item.totalPrice)}</Text>
          </View>
        ))}

        <View style={styles.divider} />
        <View style={styles.line}>
          <Text>Subtotal</Text>
          <Text>{formatInr(order.subtotal)}</Text>
        </View>
        {discountAmount > 0 ? (
          <View style={styles.line}>
            <Text>Discount</Text>
            <Text>-{formatInr(discountAmount)}</Text>
          </View>
        ) : null}
        <View style={styles.line}>
          <Text>Tax (GST)</Text>
          <Text>{formatInr(order.taxAmount)}</Text>
        </View>
        <View style={[styles.line, styles.totalLine]}>
          <Text style={styles.totalLabel}>Total due</Text>
          <Text style={styles.totalLabel}>{formatInr(totalDue)}</Text>
        </View>
      </View>

      <Text style={styles.section}>Payment method</Text>
      <View style={styles.methodRow}>
        {METHODS.map((m) => (
          <Pressable
            key={m.id}
            style={[styles.methodBtn, method === m.id && styles.methodBtnActive]}
            onPress={() => setMethod(m.id)}
          >
            <Text style={[styles.methodText, method === m.id && styles.methodTextActive]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      {method === "cash" ? (
        <>
          <Text style={styles.section}>Amount received</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={amountReceived}
            onChangeText={setAmountReceived}
          />
          {change > 0 ? (
            <Text style={styles.change}>Change: {formatInr(change)}</Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.note}>Records {method.toUpperCase()} payment — no gateway verification in Step 8.</Text>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.payBtn, submitting && styles.disabled]}
        disabled={submitting}
        onPress={() => void submitPayment()}
      >
        <Text style={styles.payBtnText}>{submitting ? "Processing…" : "Complete payment"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff7ed", padding: 20, paddingTop: 56 },
  back: { color: "#9a3412", fontWeight: "600", marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  subtitle: { color: "#64748b", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  billNo: { fontSize: 18, fontWeight: "700" },
  meta: { color: "#64748b", marginBottom: 12 },
  line: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  lineName: { flex: 1, paddingRight: 8 },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 10 },
  totalLine: { marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderColor: "#e2e8f0" },
  totalLabel: { fontWeight: "800", fontSize: 16 },
  section: { marginTop: 20, marginBottom: 8, fontWeight: "700", color: "#475569" },
  methodRow: { flexDirection: "row", gap: 8 },
  methodBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  methodBtnActive: { borderColor: "#9a3412", backgroundColor: "#ffedd5" },
  methodText: { fontWeight: "600", color: "#64748b" },
  methodTextActive: { color: "#9a3412" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 18,
    fontWeight: "700",
  },
  change: { color: "#16a34a", fontWeight: "600", marginTop: 8 },
  note: { color: "#64748b", lineHeight: 20 },
  error: { color: "#b91c1c", marginTop: 12 },
  payBtn: { backgroundColor: "#16a34a", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 24, marginBottom: 40 },
  payBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  disabled: { opacity: 0.6 },
});
