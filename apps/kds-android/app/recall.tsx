import { View, Text, StyleSheet } from "react-native";

export default function RecallScreen() {
  const recent = [
    { kot: "KOT-0042", table: "T3", time: "12 min ago" },
    { kot: "KOT-0041", table: "T7", time: "18 min ago" },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recall — Last 10 Served</Text>
      {recent.map((r) => (
        <View key={r.kot} style={styles.row}>
          <Text style={styles.kot}>{r.kot}</Text>
          <Text style={styles.meta}>{r.table} · {r.time}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", padding: 24 },
  title: { color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  row: { backgroundColor: "#222", padding: 16, borderRadius: 12, marginBottom: 8 },
  kot: { color: "#fff", fontSize: 18, fontWeight: "600" },
  meta: { color: "#888", marginTop: 4 },
});
