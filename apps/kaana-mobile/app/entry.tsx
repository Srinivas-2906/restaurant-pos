import { View, Text, Pressable, StyleSheet } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSession } from "@/src/session/SessionProvider";

export default function EntryScreen() {
  const router = useRouter();
  const { revokedMessage, terminal } = useSession();

  if (terminal) return <Redirect href="/operational/login" />;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.brand}>KAANA</Text>
      <Text style={styles.tagline}>Run your restaurant from one place.</Text>

      {revokedMessage ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{revokedMessage}</Text>
        </View>
      ) : null}

      <Pressable style={styles.primaryButton} onPress={() => router.push("/auth/login")}>
        <Text style={styles.primaryButtonText}>Owner / Manager Sign In</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => router.push("/activate")}>
        <Text style={styles.secondaryButtonText}>Set Up Restaurant Device</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 80,
    backgroundColor: "#fff7ed",
    justifyContent: "flex-start",
  },
  brand: { fontSize: 36, fontWeight: "800", color: "#9a3412", letterSpacing: 2 },
  tagline: { marginTop: 8, marginBottom: 32, fontSize: 16, color: "#6b7280" },
  banner: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  bannerText: { color: "#991b1b", fontSize: 14 },
  primaryButton: {
    backgroundColor: "#9a3412",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryButton: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  secondaryButtonText: { color: "#9a3412", fontSize: 16, fontWeight: "600" },
});
