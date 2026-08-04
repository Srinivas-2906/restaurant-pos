import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { hub } from "../lib/hub";

export default function EightySixScreen() {
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");

  async function markUnavailable(id: string) {
    await hub(`/hub/menu/items/${id}/availability`, { method: "PATCH" });
    setMsg(`Marked ${id} unavailable — synced to POS`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>86 Control</Text>
      <TextInput style={styles.input} placeholder="Search item..." placeholderTextColor="#666" value={search} onChangeText={setSearch} />
      <TouchableOpacity style={styles.btn} onPress={() => markUnavailable("mi-1")}>
        <Text style={styles.btnText}>Mark Paneer Tikka — 86</Text>
      </TouchableOpacity>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", padding: 24 },
  title: { color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  input: { backgroundColor: "#222", color: "#fff", padding: 16, borderRadius: 12, marginBottom: 16 },
  btn: { backgroundColor: "#ef4444", padding: 16, borderRadius: 12 },
  btnText: { color: "#fff", fontWeight: "600", textAlign: "center" },
  msg: { color: "#22c55e", marginTop: 16 },
});
