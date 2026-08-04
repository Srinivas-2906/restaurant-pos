import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { login, registerDevice } from "../lib/api";

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      await login();
      await registerDevice(`captain-${Date.now()}`);
      router.push("/tables");
    } catch {
      alert("Login failed — connecting to hub in offline mode");
      router.push("/tables");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kaana Captain</Text>
      <Text style={styles.subtitle}>Waiter · Table Orders · KOT</Text>
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Connecting..." : "Start Shift"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#111" },
  title: { fontSize: 32, fontWeight: "bold", color: "#ea580c", textAlign: "center" },
  subtitle: { fontSize: 16, color: "#999", textAlign: "center", marginBottom: 32 },
  button: { backgroundColor: "#ea580c", padding: 16, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});
