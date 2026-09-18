import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { OrderDetail } from "@kaana/api-client";
import { LoadingState, ErrorState } from "@/src/components/ui/States";
import { formatInr } from "@/src/management/format";
import { usePos } from "@/src/pos/PosProvider";
import { useOfflinePos } from "@/src/offline/OfflinePosProvider";
import { getLocalOrderPayments } from "@/src/offline/posLocalStore";
import { ORDER_TYPE_LABELS } from "@/src/pos/orderLabels";
import { buildReceiptData } from "@/src/pos/receipt";

export default function PosReceiptScreen() {
  const router = useRouter();
  const { orderId, paymentMethod, paymentAmount, pendingSync } = useLocalSearchParams<{
    orderId: string;
    paymentMethod?: string;
    paymentAmount?: string;
    pendingSync?: string;
  }>();
  const { api, restaurantName, outletName, exitPos } = usePos();
  const offlinePos = useOfflinePos();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    void (async () => {
      try {
        const local = await offlinePos.getOrder(orderId);
        if (local) {
          const payments = await getLocalOrderPayments(orderId);
          const detail = offlinePos.toOrderDetail(local);
          setOrder({
            ...detail,
            settledAt: local.status === "settled" ? local.occurredAt : detail.settledAt,
            payments: payments.map((payment) => ({
              id: payment.id,
              method: payment.method,
              amount: String(payment.amount),
            })),
          });
          return;
        }
        const remote = await api.orders.getOne(orderId);
        setOrder(remote);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load receipt");
      } finally {
        setLoading(false);
      }
    })();
  }, [api, orderId, offlinePos]);

  if (loading) return <LoadingState message="Loading receipt…" />;
  if (error || !order) return <ErrorState message={error ?? "Receipt unavailable"} onRetry={() => router.replace("/pos")} />;

  const receipt = buildReceiptData(order, {
    restaurantName,
    outletName,
    paymentMethod: paymentMethod ?? order.payments?.[0]?.method,
    paymentAmount: paymentAmount ? Number(paymentAmount) : undefined,
  });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.successBanner}>
        <Text style={styles.successTitle}>Payment successful</Text>
        <Text style={styles.successSub}>Bill #{receipt.billNumber}</Text>
        {pendingSync === "1" ? (
          <Text style={styles.pendingSync}>Pending cloud sync — receipt saved on this device</Text>
        ) : null}
      </View>

      <View style={styles.receipt}>
        <Text style={styles.brand}>{receipt.restaurantName}</Text>
        <Text style={styles.outlet}>{receipt.outletName}</Text>
        <Text style={styles.meta}>
          {ORDER_TYPE_LABELS[receipt.orderType] ?? receipt.orderType}
          {receipt.tableNumber ? ` · Table ${receipt.tableNumber}` : ""}
        </Text>
        <Text style={styles.meta}>{new Date(receipt.dateTime).toLocaleString("en-IN")}</Text>

        <View style={styles.divider} />

        {receipt.items.map((item, idx) => (
          <View key={idx} style={styles.line}>
            <Text style={styles.itemName}>
              {item.quantity}× {item.name}
            </Text>
            <Text>{formatInr(item.total)}</Text>
          </View>
        ))}

        <View style={styles.divider} />

        <View style={styles.line}>
          <Text>Subtotal</Text>
          <Text>{formatInr(receipt.subtotal)}</Text>
        </View>
        {receipt.discount > 0 ? (
          <View style={styles.line}>
            <Text>Discount</Text>
            <Text>-{formatInr(receipt.discount)}</Text>
          </View>
        ) : null}
        <View style={styles.line}>
          <Text>GST</Text>
          <Text>{formatInr(receipt.taxAmount)}</Text>
        </View>
        <View style={[styles.line, styles.total]}>
          <Text style={styles.totalText}>Total</Text>
          <Text style={styles.totalText}>{formatInr(receipt.total)}</Text>
        </View>

        {receipt.paymentMethod ? (
          <Text style={styles.paid}>
            Paid via {String(receipt.paymentMethod).toUpperCase()}
            {receipt.paymentAmount ? ` · ${formatInr(receipt.paymentAmount)}` : ""}
          </Text>
        ) : null}
      </View>

      <Pressable
        style={styles.primaryBtn}
        onPress={() => router.replace({ pathname: "/pos/order", params: { type: "takeaway" } })}
      >
        <Text style={styles.primaryBtnText}>New order</Text>
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={exitPos}>
        <Text style={styles.secondaryBtnText}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff7ed", padding: 20, paddingTop: 56 },
  successBanner: { backgroundColor: "#dcfce7", padding: 16, borderRadius: 12, marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: "800", color: "#166534" },
  successSub: { color: "#15803d", marginTop: 4 },
  pendingSync: { color: "#92400e", marginTop: 8, fontWeight: "600", fontSize: 13 },
  receipt: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  brand: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  outlet: { textAlign: "center", color: "#64748b" },
  meta: { textAlign: "center", color: "#64748b", fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 12 },
  line: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  itemName: { flex: 1, paddingRight: 8 },
  total: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: "#e2e8f0" },
  totalText: { fontWeight: "800", fontSize: 16 },
  paid: { marginTop: 12, textAlign: "center", fontWeight: "600", color: "#16a34a" },
  primaryBtn: { backgroundColor: "#9a3412", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 20 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: { padding: 14, alignItems: "center" },
  secondaryBtnText: { color: "#9a3412", fontWeight: "600" },
});
