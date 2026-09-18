import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color="#9a3412" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.error}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  title: { fontSize: 18, fontWeight: "600", color: "#111827", marginBottom: 6 },
  text: { fontSize: 14, color: "#6b7280", marginTop: 8, textAlign: "center" },
  error: { fontSize: 14, color: "#b91c1c", textAlign: "center", marginBottom: 12 },
  button: { backgroundColor: "#9a3412", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
