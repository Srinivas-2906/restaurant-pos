import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { mapManagementLoginError } from "@/src/device/activationErrors";
import { useSession } from "@/src/session/SessionProvider";

export default function ManagementLoginScreen() {
  const router = useRouter();
  const { loginManagement, terminal } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (terminal) return <Redirect href="/operational/login" />;

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      await loginManagement(email.trim(), password);
      router.replace("/management");
    } catch (err) {
      setError(mapManagementLoginError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" />
      <Text style={styles.title}>Owner / Manager Sign In</Text>
      <Text style={styles.subtitle}>Use your Kaana account email and password.</Text>

      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        secureTextEntry
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={() => void submit()} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64, backgroundColor: "#fff7ed" },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  subtitle: { marginTop: 8, marginBottom: 24, color: "#6b7280" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  error: { color: "#b91c1c", marginBottom: 12 },
  button: {
    backgroundColor: "#9a3412",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  back: { marginTop: 16, alignItems: "center" },
  backText: { color: "#6b7280" },
});
