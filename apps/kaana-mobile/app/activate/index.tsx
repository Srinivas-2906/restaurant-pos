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
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { mapActivationError } from "@/src/device/activationErrors";
import { useSession } from "@/src/session/SessionProvider";

export default function ActivateDeviceScreen() {
  const router = useRouter();
  const { activateDevice } = useSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      await activateDevice(code);
      router.replace("/operational/login");
    } catch (err) {
      setError(mapActivationError(err));
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
      <Text style={styles.title}>Activate This Device</Text>
      <Text style={styles.subtitle}>
        Enter the activation code from Operations → Devices. The code expires after 15 minutes.
      </Text>

      <TextInput
        autoCapitalize="characters"
        placeholder="ABCD-1234"
        value={code}
        onChangeText={setCode}
        style={styles.input}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={() => void submit()}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={() => void submit()} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Activate Device</Text>
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
  subtitle: { marginTop: 8, marginBottom: 24, color: "#6b7280", lineHeight: 22 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 18,
    letterSpacing: 1,
    textAlign: "center",
  },
  error: { color: "#b91c1c", marginBottom: 12, lineHeight: 20 },
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
