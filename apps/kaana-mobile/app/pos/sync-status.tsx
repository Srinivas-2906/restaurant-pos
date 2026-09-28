import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LoadingState, EmptyState } from "@/src/components/ui/States";
import { formatInr } from "@/src/management/format";
import { usePos } from "@/src/pos/PosProvider";
import { useOfflinePos } from "@/src/offline/OfflinePosProvider";
import { outboxStore } from "@/src/offline/outboxStore";
import { listPendingSyncOrderSummaries, type PendingSyncOrderSummary } from "@/src/offline/posLocalStore";
import {
  formatPendingSyncMeta,
  formatPendingSyncHeadline,
  labelOutboxOperation,
  type PendingOutboxSummary,
} from "@/src/offline/pendingSyncDisplay";
import { SyncStatusBanner } from "@/src/offline/SyncStatusBanner";

export default function PosSyncStatusScreen() {
  const router = useRouter();
  const { outletId } = usePos();
  const offlinePos = useOfflinePos();
  const { syncBlockedMessage } = offlinePos;
  const [orders, setOrders] = useState<PendingSyncOrderSummary[]>([]);
  const [outbox, setOutbox] = useState<PendingOutboxSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!outletId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const pendingOrders = await listPendingSyncOrderSummaries(outletId);
      const pendingOps = await outboxStore.getPendingForDisplay(50);
      const ops = pendingOps.map((row) => ({
          operationType: row.operationType,
          status: row.status,
          label: labelOutboxOperation(row.operationType),
        }));
      setOrders(pendingOrders);
      setOutbox(ops);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState message="Loading sync status…" />;

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← POS</Text>
      </Pressable>
      <Text style={styles.title}>Sync status</Text>
      <Text style={styles.subtitle}>
        {offlinePos.isOffline
          ? "Offline — local sales are stored on this device until the API reconnects."
          : "Pending local changes waiting for cloud sync."}
      </Text>

      <SyncStatusBanner onPressStatus={() => {}} />
      {syncBlockedMessage ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{syncBlockedMessage}</Text>
          <Text style={styles.noticeHint}>Switch Employee → sign in EMP001 with PIN while online.</Text>
        </View>
      ) : null}

      {outbox.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending sync operations ({outbox.length})</Text>
          {outbox.map((op, index) => (
            <View key={`${op.operationType}-${index}`} style={styles.opRow}>
              <Text style={styles.opLabel}>{op.label}</Text>
              <Text style={styles.opStatus}>{op.status}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.localOrderId}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={
          <EmptyState
            title="No pending sales"
            message="Settled offline transactions will appear here until they sync."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: "/pos/receipt",
                params: {
                  orderId: item.localOrderId,
                  paymentMethod: item.paymentMethod ?? "cash",
                  paymentAmount: String(item.paymentAmount ?? item.totalAmount),
                  pendingSync: "1",
                },
              })
            }
          >
            <Text style={styles.cardTitle}>{formatPendingSyncHeadline(item)}</Text>
            <Text style={styles.cardMeta}>{formatPendingSyncMeta(item)}</Text>
            <Text style={styles.cardAmount}>{formatInr(item.totalAmount)}</Text>
            <Text style={styles.cardLink}>View receipt →</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff7ed", paddingTop: 48, paddingHorizontal: 16 },
  back: { color: "#9a3412", fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", marginTop: 4 },
  subtitle: { color: "#64748b", marginBottom: 12, lineHeight: 20 },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: { fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  opRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  opLabel: { color: "#334155" },
  opStatus: { color: "#92400e", fontWeight: "600", textTransform: "capitalize" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  cardTitle: { fontWeight: "800", color: "#9a3412", fontSize: 16 },
  cardMeta: { color: "#64748b", marginTop: 6, fontSize: 13 },
  cardAmount: { fontWeight: "700", color: "#0f172a", marginTop: 8, fontSize: 18 },
  cardLink: { color: "#9a3412", marginTop: 8, fontWeight: "600" },
  notice: {
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  noticeText: { color: "#92400e", fontWeight: "700" },
  noticeHint: { color: "#92400e", marginTop: 4, fontSize: 13 },
});
