import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useShellOrientation } from "@/src/hooks/useShellOrientation";
import { OperationalShellFrame } from "@/src/components/OperationalShellFrame";
import { useSession } from "@/src/session/SessionProvider";
import { useKds } from "@/src/kds/KdsProvider";
import { KdsTicketCard } from "@/src/kds/KdsTicketCard";
import { partitionKotsByColumn, type KdsColumn } from "@/src/kds/permissions";

const COLUMN_META: Record<KdsColumn, { title: string; empty: string }> = {
  new: { title: "NEW", empty: "No new orders" },
  preparing: { title: "PREPARING", empty: "Nothing preparing" },
  ready: { title: "READY", empty: "Nothing waiting for pickup" },
};

function KdsQueueColumn({
  column,
  title,
  emptyLabel,
  kots,
  nowMs,
  bumpingId,
  kdsAvailable,
  onStartPreparing,
  onMarkReady,
}: {
  column: KdsColumn;
  title: string;
  emptyLabel: string;
  kots: ReturnType<typeof useKds>["kots"];
  nowMs: number;
  bumpingId: string | null;
  kdsAvailable: boolean;
  onStartPreparing: (kotId: string) => void;
  onMarkReady: (kotId: string) => void;
}) {
  return (
    <View style={styles.column}>
      <View style={styles.columnHeader}>
        <Text style={styles.columnTitle}>{title}</Text>
        <Text style={styles.columnCount}>{kots.length}</Text>
      </View>
      {kots.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
      ) : (
        <FlatList
          data={kots}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <KdsTicketCard
              kot={item}
              nowMs={nowMs}
              busy={bumpingId === item.id}
              disabled={!kdsAvailable}
              onStartPreparing={column === "new" ? () => onStartPreparing(item.id) : undefined}
              onMarkReady={column === "preparing" ? () => onMarkReady(item.id) : undefined}
            />
          )}
          contentContainerStyle={styles.columnList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function KdsBoard() {
  const {
    kots,
    loading,
    refreshing,
    error,
    bumpingId,
    kdsAvailable,
    kdsBlockedMessage,
    connectionStatus,
    loadQueue,
    startPreparing,
    markReady,
  } = useKds();
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const columns = useMemo(() => partitionKotsByColumn(kots), [kots]);

  if (loading && kots.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Loading kitchen queue…</Text>
      </View>
    );
  }

  return (
    <View style={styles.board}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>Kaana KDS</Text>
        <Text style={styles.toolbarMeta}>
          {connectionStatus === "online" ? "Online" : connectionStatus === "reconnecting" ? "Reconnecting" : "Offline"}
        </Text>
        <Pressable style={styles.refreshBtn} onPress={() => void loadQueue()} accessibilityRole="button" accessibilityLabel="Refresh">
          <Text style={styles.refreshText}>{refreshing ? "Refreshing…" : "Refresh"}</Text>
        </Pressable>
      </View>

      {!kdsAvailable && kdsBlockedMessage ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{kdsBlockedMessage}</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.columnsRow}>
        {(Object.keys(COLUMN_META) as KdsColumn[]).map((key) => (
          <KdsQueueColumn
            key={key}
            column={key}
            title={COLUMN_META[key].title}
            emptyLabel={COLUMN_META[key].empty}
            kots={columns[key]}
            nowMs={nowMs}
            bumpingId={bumpingId}
            kdsAvailable={kdsAvailable}
            onStartPreparing={(id) => void startPreparing(id)}
            onMarkReady={(id) => void markReady(id)}
          />
        ))}
      </View>
    </View>
  );
}

export default function KdsShell() {
  const { terminal, employee, sessionType, bootstrapTarget } = useSession();
  useShellOrientation("kds");

  if (sessionType !== "operational" || !terminal || terminal.deviceType !== "kds") {
    return <Redirect href="/operational/login" />;
  }
  if (!employee || bootstrapTarget.kind !== "operational-shell") {
    return <Redirect href="/operational/login" />;
  }

  return (
    <OperationalShellFrame deviceType="kds" backgroundColor="#0f172a" textColor="#f8fafc">
      <StatusBar style="light" />
      <KdsBoard />
    </OperationalShellFrame>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  toolbarTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "800" },
  toolbarMeta: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
  refreshBtn: {
    marginLeft: "auto",
    backgroundColor: "#1e293b",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  refreshText: { color: "#e2e8f0", fontWeight: "700" },
  banner: {
    backgroundColor: "#451a03",
    borderColor: "#f59e0b",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  bannerText: { color: "#fde68a", fontWeight: "600" },
  errorBox: { backgroundColor: "#450a0a", borderRadius: 8, padding: 10, marginBottom: 8 },
  errorText: { color: "#fecaca", fontWeight: "600" },
  columnsRow: { flex: 1, flexDirection: "row", gap: 10 },
  column: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  columnTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  columnCount: { color: "#38bdf8", fontWeight: "800", fontSize: 16 },
  columnList: { paddingBottom: 24 },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    borderStyle: "dashed",
  },
  emptyText: { color: "#64748b", fontSize: 14, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#94a3b8" },
});
