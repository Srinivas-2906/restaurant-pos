import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { StaffMember } from "@kaana/api-client";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/ui/States";
import { useManagement } from "@/src/management/ManagementProvider";

function staffName(staff: StaffMember): string {
  return (
    staff.displayName ??
    [staff.firstName, staff.lastName].filter(Boolean).join(" ") ??
    staff.employeeCode
  );
}

export default function StaffScreen() {
  const { api, outletId, access } = useManagement();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await api.staff.listByOutlet(outletId);
      setStaff(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [api, outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && staff.length === 0) return <LoadingState />;
  if (error && staff.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Staff</Text>
      {!access.canManageStaff ? (
        <Text style={styles.note}>You do not have permission to manage staff.</Text>
      ) : null}
      <FlatList
        data={staff}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={<EmptyState title="No staff" message="No employees found for this outlet." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{staffName(item)}</Text>
            <Text style={styles.sub}>
              {item.employeeCode} · {(item.staffRoleAssignments ?? []).map((r) => r.role).join(", ") || "—"}
            </Text>
            <Text style={styles.sub}>{item.isActive ? "Active" : "Inactive"}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingTop: 56, paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12, color: "#0f172a" },
  note: { color: "#64748b", marginBottom: 12 },
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
