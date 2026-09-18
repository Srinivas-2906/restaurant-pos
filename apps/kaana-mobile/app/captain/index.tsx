import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { FloorTable } from "@kaana/api-client";
import { LoadingState, ErrorState } from "@/src/components/ui/States";
import { formatInr } from "@/src/management/format";
import { useCaptain } from "@/src/captain/CaptainProvider";
import {
  collectReadyTables,
  deriveTablePhase,
  TABLE_PHASE_COLOR,
  TABLE_PHASE_LABEL,
} from "@/src/captain/tablePhase";
import { usePosRealtime } from "@/src/pos/usePosRealtime";
import { useShellOrientation } from "@/src/hooks/useShellOrientation";
import { OperationalShellFrame } from "@/src/components/OperationalShellFrame";
import { useSession } from "@/src/session/SessionProvider";

function CaptainTablesContent() {
  const router = useRouter();
  const { api, outletId, outletName, employeeName, captainAvailable, captainBlockedMessage, loading: bootLoading, error: bootError } =
    useCaptain();
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    try {
      const floor = await api.outlets.getFloor(outletId);
      setTables(floor.tables ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load floor");
    } finally {
      setLoading(false);
    }
  }, [api, outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  usePosRealtime(outletId, () => {
    void load();
  });

  if (bootLoading) return <LoadingState message="Loading Captain…" />;
  if (bootError) return <ErrorState message={bootError} onRetry={() => void load()} />;

  const readyTables = collectReadyTables(tables);

  function openTable(table: FloorTable) {
    const phase = deriveTablePhase(table);
    if (phase === "ready" && table.activeOrder) {
      router.push({
        pathname: "/captain/order",
        params: { tableId: table.id, tableNumber: table.number, orderId: table.activeOrder.id, focus: "serve" },
      });
      return;
    }
    router.push({
      pathname: "/captain/order",
      params: {
        tableId: table.id,
        tableNumber: table.number,
        orderId: table.activeOrder?.id,
      },
    });
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Tables</Text>
        <Text style={styles.subtitle}>
          {outletName} · {employeeName}
        </Text>
      </View>

      {!captainAvailable ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{captainBlockedMessage}</Text>
          <Text style={styles.bannerNote}>Existing orders are preserved. New actions are blocked.</Text>
        </View>
      ) : null}

      {readyTables.length > 0 ? (
        <View style={styles.readySection}>
          <Text style={styles.readyTitle}>Ready to serve</Text>
          {readyTables.map((t) => (
            <Pressable key={t.id} style={styles.readyRow} onPress={() => openTable(t)}>
              <Text style={styles.readyTable}>Table {t.number}</Text>
              <Text style={styles.readyMeta}>
                {t.activeOrder?.readyCount ?? 0} ready · {formatInr(t.activeOrder?.totalAmount)}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push("/captain/ready")}>
            <Text style={styles.readyLink}>View all ready orders →</Text>
          </Pressable>
        </View>
      ) : null}

      {loading && tables.length === 0 ? (
        <LoadingState message="Loading tables…" />
      ) : error && tables.length === 0 ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <FlatList
          data={tables}
          keyExtractor={(t) => t.id}
          numColumns={2}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => {
            const phase = deriveTablePhase(item);
            const colors = TABLE_PHASE_COLOR[phase];
            const ao = item.activeOrder;
            return (
              <Pressable
                style={[styles.tableCard, { borderColor: colors.border, backgroundColor: colors.bg }]}
                accessibilityRole="button"
                accessibilityLabel={`Table ${item.number}`}
                onPress={() => openTable(item)}
              >
                <Text style={styles.tableNumber}>Table {item.number}</Text>
                <Text style={styles.tableMeta}>
                  {item.capacity} seats · {TABLE_PHASE_LABEL[phase]}
                </Text>
                {ao ? (
                  <>
                    <Text style={styles.tableAmount}>{formatInr(ao.totalAmount)}</Text>
                    <Text style={styles.tableItems}>
                      {ao.itemQty} items
                      {(ao.inKitchen ?? 0) > 0 ? ` · ${ao.inKitchen} cooking` : ""}
                      {(ao.readyCount ?? 0) > 0 ? ` · ${ao.readyCount} ready` : ""}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.freeLabel}>Tap to start</Text>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

export default function CaptainShell() {
  const router = useRouter();
  const { terminal, employee, sessionType, bootstrapTarget } = useSession();
  useShellOrientation("captain");

  if (sessionType !== "operational" || !terminal || terminal.deviceType !== "captain") {
    return <Redirect href="/operational/login" />;
  }
  if (!employee || bootstrapTarget.kind !== "operational-shell") {
    return <Redirect href="/operational/login" />;
  }

  return (
    <OperationalShellFrame deviceType="captain" backgroundColor="#fff7ed" textColor="#111827">
      <CaptainTablesContent />
    </OperationalShellFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff7ed", paddingTop: 48 },
  header: { paddingHorizontal: 16, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: "800", color: "#0f766e" },
  subtitle: { color: "#64748b", marginTop: 2 },
  banner: { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#fef3c7", padding: 12, borderRadius: 10 },
  bannerText: { color: "#92400e", fontWeight: "600" },
  bannerNote: { color: "#92400e", marginTop: 4, fontSize: 12 },
  readySection: { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#ecfdf5", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#86efac" },
  readyTitle: { fontWeight: "800", color: "#166534", marginBottom: 8 },
  readyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderColor: "#bbf7d0" },
  readyTable: { fontWeight: "700", color: "#0f172a", fontSize: 16 },
  readyMeta: { color: "#15803d", fontWeight: "600" },
  readyLink: { color: "#0f766e", fontWeight: "600", marginTop: 8 },
  grid: { padding: 10 },
  tableCard: {
    flex: 1,
    margin: 6,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    minHeight: 130,
  },
  tableNumber: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  tableMeta: { color: "#64748b", fontSize: 12, marginTop: 4 },
  tableAmount: { fontWeight: "800", color: "#0f766e", marginTop: 10, fontSize: 16 },
  tableItems: { fontSize: 12, color: "#475569", marginTop: 4 },
  freeLabel: { color: "#16a34a", marginTop: 12, fontWeight: "600" },
});
