import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { hub } from "../lib/hub";

interface Kot { id: string; kotNumber: string; status: string; firedAt: string; items: Array<{ quantity: number; orderItem: { name: string } }>; }

export default function TicketBoard() {
  const { stationId } = useLocalSearchParams<{ stationId: string }>();
  const router = useRouter();
  const [kots, setKots] = useState<Kot[]>([]);

  useEffect(() => {
    if (!stationId) return;
    const load = () => hub<Kot[]>(`/hub/kds/stations/${stationId}/queue`).then(setKots).catch(console.error);
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [stationId]);

  async function bump(kot: Kot) {
    const path = kot.status === "pending" ? "preparing" : "ready";
    await hub(`/hub/kds/kot/${kot.id}/${path}`, { method: "PATCH" });
    hub<Kot[]>(`/hub/kds/stations/${stationId}/queue`).then(setKots);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.link}>← Stations</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Ticket Board</Text>
        <TouchableOpacity onPress={() => router.push("/aggregate")}><Text style={styles.link}>Rush</Text></TouchableOpacity>
      </View>
      <ScrollView horizontal contentContainerStyle={styles.board}>
        {kots.map((kot) => {
          const elapsed = Math.floor((Date.now() - new Date(kot.firedAt).getTime()) / 60000);
          return (
            <View key={kot.id} style={[styles.card, elapsed > 15 && styles.overdue]}>
              <Text style={styles.kotNum}>{kot.kotNumber}</Text>
              <Text style={styles.timer}>{elapsed}m</Text>
              {kot.items.map((i, idx) => (
                <Text key={idx} style={styles.item}>{i.quantity}x {i.orderItem?.name ?? "Item"}</Text>
              ))}
              <TouchableOpacity style={styles.bump} onPress={() => bump(kot)}>
                <Text style={styles.bumpText}>{kot.status === "pending" ? "Start" : "Ready"}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  header: { flexDirection: "row", justifyContent: "space-between", padding: 16, alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  link: { color: "#ea580c", fontSize: 16 },
  board: { padding: 16, gap: 16 },
  card: { width: 280, backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16, marginRight: 12, borderWidth: 2, borderColor: "#333" },
  overdue: { borderColor: "#ef4444", backgroundColor: "#2a1515" },
  kotNum: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  timer: { color: "#888", fontSize: 18, marginBottom: 8 },
  item: { color: "#fff", fontSize: 18, marginVertical: 2 },
  bump: { marginTop: 12, backgroundColor: "#22c55e", padding: 12, borderRadius: 8, alignItems: "center" },
  bumpText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
