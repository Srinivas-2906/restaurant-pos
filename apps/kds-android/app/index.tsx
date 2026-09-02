import { useRouter } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";

const STATIONS = [
  { id: "st-tandoor", name: "Tandoor" },
  { id: "st-main", name: "Main Kitchen" },
];

export default function StationSelect() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Image source={require("../assets/kaana-logo.png")} style={styles.logo} accessibilityLabel="Kaana Kitchens" resizeMode="contain" />
      <Text style={styles.badge}>KDS · Kitchen</Text>
      <Text style={styles.sub}>Select Station</Text>
      {STATIONS.map((s) => (
        <TouchableOpacity key={s.id} style={styles.station} onPress={() => router.push({ pathname: "/board", params: { stationId: s.id } })}>
          <Text style={styles.stationText}>{s.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 32, backgroundColor: "#000" },
  logo: { width: "100%", maxWidth: 300, height: 72, alignSelf: "center", marginBottom: 20 },
  badge: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  sub: { fontSize: 18, color: "#888", textAlign: "center", marginBottom: 32 },
  station: { backgroundColor: "#1a1a1a", padding: 32, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: "#333" },
  stationText: { color: "#fff", fontSize: 24, fontWeight: "600", textAlign: "center" },
});
