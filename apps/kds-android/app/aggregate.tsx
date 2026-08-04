import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { hub } from "../lib/hub";

export default function AggregateView() {
  const router = useRouter();
  const [items, setItems] = useState<Array<{ name: string; _sum: { quantity: number } }>>([]);

  useEffect(() => {
    hub<Array<{ name: string; _sum: { quantity: number } }>>("/hub/kds/aggregated").then(setItems);
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()}><Text style={styles.link}>← Board</Text></TouchableOpacity>
      <Text style={styles.title}>Rush Mode — Item Aggregation</Text>
      <ScrollView>
        {items.map((i) => (
          <View key={i.name} style={styles.row}>
            <Text style={styles.qty}>{i._sum.quantity}x</Text>
            <Text style={styles.name}>{i.name}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", padding: 24 },
  link: { color: "#ea580c", marginBottom: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 24 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#222", padding: 20, borderRadius: 12, marginBottom: 8 },
  qty: { color: "#ea580c", fontSize: 28, fontWeight: "bold", width: 80 },
  name: { color: "#fff", fontSize: 20 },
});
