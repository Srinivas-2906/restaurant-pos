import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useManagement } from "@/src/management/ManagementProvider";

/**
 * Owner billing entry (Step 7 architecture)
 *
 * Personal owner phones are NOT registered POS terminals.
 * Step 8 will introduce management-authenticated mobile billing using:
 *   JWT (owner/manager) + POS module + take_order permission
 * Operational shared POS devices continue to use:
 *   Terminal credential + employee PIN session
 *
 * Current POS order APIs accept JWT for manager/owner roles — terminal auth is not required
 * on POST /orders today. Step 8 will formalize the mobile POS shell without weakening terminal security.
 */
export default function BillingEntryScreen() {
  const router = useRouter();
  const { access } = useManagement();

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>New Bill</Text>
      <Text style={styles.subtitle}>
        Owner mobile billing opens the POS workflow without device activation.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Step 8 — Mobile POS</Text>
        <Text style={styles.text}>
          Full counter billing UI is coming in Step 8. Your account already has permission to bill when POS is
          enabled. Shared restaurant POS tablets will keep using terminal activation + employee PIN.
        </Text>
      </View>

      {access.canUsePos ? (
        <Pressable style={styles.btn} onPress={() => router.push("/pos?source=management")}>
          <Text style={styles.btnText}>Open POS entry (placeholder)</Text>
        </Pressable>
      ) : (
        <Text style={styles.note}>POS is not enabled for this restaurant.</Text>
      )}

      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Back to Home</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16, paddingTop: 56 },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  subtitle: { color: "#64748b", marginTop: 4, marginBottom: 16, lineHeight: 22 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 16 },
  cardTitle: { fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  text: { color: "#64748b", lineHeight: 22 },
  btn: { backgroundColor: "#9a3412", padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600" },
  note: { color: "#92400e", marginTop: 8 },
  back: { color: "#9a3412", marginTop: 16, fontWeight: "600" },
});
