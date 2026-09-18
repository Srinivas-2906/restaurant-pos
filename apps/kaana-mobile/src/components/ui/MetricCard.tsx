import { View, Text, StyleSheet } from "react-native";

export function MetricCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  label: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  value: { fontSize: 20, fontWeight: "700", color: "#111827", marginTop: 4 },
  subtitle: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
});
