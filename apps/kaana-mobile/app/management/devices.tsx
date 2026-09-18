import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/ui/States";
import { formatTime } from "@/src/management/format";
import { useManagement } from "@/src/management/ManagementProvider";

type TerminalRow = {
  id: string;
  name: string;
  code: string;
  deviceType: string;
  outlet?: { name: string };
  status?: string;
  lastSeenAt?: string | null;
  appVersion?: string | null;
  isRegistered?: boolean;
  revokedAt?: string | null;
};

export default function DevicesScreen() {
  const { api } = useManagement();
  const [devices, setDevices] = useState<TerminalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.devices.listTerminals();
      setDevices(rows as TerminalRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && devices.length === 0) return <LoadingState />;
  if (error && devices.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Devices</Text>
      <Text style={styles.note}>Read-only status. Configure devices in Operations Web.</Text>
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={<EmptyState title="No devices" message="No terminals registered yet." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.name || item.code}</Text>
            <Text style={styles.sub}>
              {item.deviceType.toUpperCase()} · {item.outlet?.name ?? "Outlet"}
            </Text>
            <Text style={styles.sub}>
              {item.revokedAt ? "Revoked" : item.status ?? (item.isRegistered ? "Registered" : "Pending")}
              {item.lastSeenAt ? ` · Last seen ${formatTime(item.lastSeenAt)}` : ""}
              {item.appVersion ? ` · v${item.appVersion}` : ""}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingTop: 56, paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 4, color: "#0f172a" },
  note: { color: "#64748b", marginBottom: 12, fontSize: 13 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  name: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  sub: { fontSize: 13, color: "#64748b", marginTop: 2 },
});
