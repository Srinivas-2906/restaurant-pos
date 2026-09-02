import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import { login, registerDevice } from "../lib/api";
import { useNotify } from "../lib/toast";

export default function LoginScreen() {
  const router = useRouter();
  const notify = useNotify();
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      await login();
      await registerDevice(`captain-${Date.now()}`);
      router.push("/tables");
    } catch {
      notify.warning("Login failed — continuing in offline mode");
      router.push("/tables");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Image source={require("../assets/kaana-logo.png")} style={styles.logo} accessibilityLabel="Kaana Kitchens" resizeMode="contain" />
      <Text style={styles.badge}>Captain · Floor</Text>
      <Text style={styles.subtitle}>Serve ready items · KOT status</Text>
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Connecting..." : "Start Shift"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    paddingBottom: 32,
    backgroundColor: "#000",
  },
  logo: {
    width: "100%",
    maxWidth: 280,
    height: 72,
    alignSelf: "center",
    marginBottom: 20,
  },
  badge: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  subtitle: { fontSize: 16, color: "#999", textAlign: "center", marginBottom: 32 },
  button: { backgroundColor: "#fff", padding: 16, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#000", fontSize: 18, fontWeight: "600" },
});
