import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { filterNavItems, MORE_ITEMS } from "@/src/management/navigation";
import { useManagement } from "@/src/management/ManagementProvider";
import { useSession } from "@/src/session/SessionProvider";

export default function MoreScreen() {
  const router = useRouter();
  const { access, outlet } = useManagement();
  const { logoutManagement, management } = useSession();
  const items = filterNavItems(MORE_ITEMS, access);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>More</Text>
      <Text style={styles.subtitle}>{outlet?.name ?? "Restaurant"}</Text>

      {items.map((item) => (
        <Pressable key={item.id} style={styles.row} onPress={() => router.push(item.href as never)}>
          <Text style={styles.rowText}>{item.label}</Text>
        </Pressable>
      ))}

      <View style={styles.metaBox}>
        <Text style={styles.meta}>
          {management?.capabilities.operatingMode ?? "SIMPLE"} mode · config v
          {management?.capabilities.configVersion ?? 0}
        </Text>
        <Text style={styles.meta}>Signed in as {management?.user.email}</Text>
      </View>

      <Pressable
        style={styles.signOut}
        onPress={() => void logoutManagement().then(() => router.replace("/entry"))}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16, paddingTop: 56 },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  subtitle: { color: "#64748b", marginBottom: 16 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rowText: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  metaBox: { marginTop: 16, padding: 12 },
  meta: { color: "#94a3b8", fontSize: 13, marginBottom: 4 },
  signOut: { marginTop: 8, alignSelf: "flex-start" },
  signOutText: { color: "#9a3412", fontWeight: "600" },
});
