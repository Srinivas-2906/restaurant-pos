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
  Alert,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { verifyOfflinePin, hasOfflineCredentialForEmployee } from "@/src/offline/offlineAuth";
import { resolveOperationalLoginFailure } from "@/src/api/operationalLoginErrors";
import { shellPathForDeviceType, moduleLabelForDeviceType } from "@/src/session/bootstrap";
import { useSession } from "@/src/session/SessionProvider";

export default function OperationalLoginScreen() {
  const router = useRouter();
  const {
    terminal,
    loginEmployee,
    loginEmployeeOffline,
    resetDevice,
    moduleUnavailable,
    revokedMessage,
  } = useSession();
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  if (!terminal) return <Redirect href="/entry" />;

  const deviceLabel = moduleLabelForDeviceType(terminal.deviceType);

  async function submit() {
    if (!terminal) return;
    setError(null);
    setLoading(true);
    try {
      await loginEmployee(employeeCode, pin);
      setPin("");
      router.replace(shellPathForDeviceType(terminal.deviceType));
    } catch (err) {
      const resolution = resolveOperationalLoginFailure({
        error: err,
        deviceLabel,
        hasOfflineCredential: await hasOfflineCredentialForEmployee(employeeCode),
      });

      if (resolution.action === "try_offline") {
        try {
          await loginEmployeeOffline(employeeCode, pin);
          setPin("");
          router.replace(shellPathForDeviceType(terminal.deviceType));
          return;
        } catch (offlineErr) {
          setError(offlineErr instanceof Error ? offlineErr.message : "Offline login denied");
          return;
        }
      }

      if (resolution.action === "access_denied" || resolution.action === "internet_required") {
        setError(resolution.message);
        return;
      }

      setError(resolution.message);
    } finally {
      setLoading(false);
    }
  }

  function confirmReset() {
    Alert.alert(
      "Remove this device?",
      "This clears the device activation from this phone. You will need a new activation code to use it again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove Device",
          style: "destructive",
          onPress: () => {
            void resetDevice().then(() => router.replace("/entry"));
          },
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "android" ? (isLandscape ? 0 : 24) : 0}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isLandscape && styles.scrollContentLandscape]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>{deviceLabel} device</Text>
        <Text style={[styles.title, isLandscape && styles.titleLandscape]}>{terminal.deviceName}</Text>
        <Text style={[styles.subtitle, isLandscape && styles.subtitleLandscape]}>
          {terminal.outletName || "Restaurant device"}
        </Text>

        {revokedMessage ? <Text style={styles.error}>{revokedMessage}</Text> : null}
        {moduleUnavailable ? <Text style={styles.warning}>{moduleUnavailable}</Text> : null}

        <Text style={styles.label}>Employee ID</Text>
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="EMP001"
          value={employeeCode}
          onChangeText={setEmployeeCode}
          style={styles.input}
          returnKeyType="next"
          blurOnSubmit={false}
        />
        <Text style={styles.label}>PIN</Text>
        <TextInput
          secureTextEntry
          keyboardType="number-pad"
          placeholder="••••"
          value={pin}
          onChangeText={setPin}
          style={styles.input}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={() => void submit()}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={styles.button}
          onPress={() => void submit()}
          disabled={loading || !!moduleUnavailable}
          accessibilityRole="button"
          accessibilityLabel="Sign In"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </Pressable>

        <Pressable onPress={confirmReset} style={styles.reset} accessibilityRole="button">
          <Text style={styles.resetText}>Remove this device</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff7ed" },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 64, paddingBottom: 32 },
  scrollContentLandscape: { paddingTop: 24, paddingBottom: 48, maxWidth: 720, alignSelf: "center", width: "100%" },
  eyebrow: { fontSize: 13, fontWeight: "600", color: "#9a3412", textTransform: "uppercase" },
  title: { fontSize: 26, fontWeight: "700", color: "#111827", marginTop: 4 },
  titleLandscape: { fontSize: 22 },
  subtitle: { marginTop: 4, marginBottom: 24, color: "#6b7280" },
  subtitleLandscape: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 16,
  },
  error: { color: "#b91c1c", marginBottom: 12 },
  warning: { color: "#92400e", backgroundColor: "#fffbeb", padding: 12, borderRadius: 10, marginBottom: 12 },
  button: {
    backgroundColor: "#9a3412",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  reset: { marginTop: 20, alignItems: "center" },
  resetText: { color: "#b91c1c", fontSize: 14 },
});
