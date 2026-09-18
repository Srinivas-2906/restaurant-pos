import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

type Props = {
  message?: string;
  onRetry?: () => void;
};

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error.message || "An unexpected error occurred."}
          </Text>
          <Pressable style={styles.button} onPress={() => this.setState({ error: null })}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export function BootstrapError({ message, onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unable to start Kaana</Text>
      <Text style={styles.message}>{message ?? "Please check your connection and try again."}</Text>
      {onRetry ? (
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff7ed",
  },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 8 },
  message: { fontSize: 15, color: "#6b7280", textAlign: "center", marginBottom: 20 },
  button: {
    backgroundColor: "#9a3412",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});
