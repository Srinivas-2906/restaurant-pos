import { useRouter } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

const STATIONS = [
  { id: "st-tandoor", name: "Tandoor" },
  { id: "st-main", name: "Main Kitchen" },
];

export default function StationSelect() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kaana KDS</Text>
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
  container: { flex: 1, justifyContent: "center", padding: 32, backgroundColor: "#111" },
  title: { fontSize: 36, fontWeight: "bold", color: "#ea580c", textAlign: "center" },
  sub: { fontSize: 18, color: "#888", textAlign: "center", marginBottom: 32 },
  station: { backgroundColor: "#222", padding: 32, borderRadius: 16, marginBottom: 16 },
  stationText: { color: "#fff", fontSize: 24, fontWeight: "600", textAlign: "center" },
});
