import { useState } from "react";

import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useRouter } from "expo-router";

import { useManagement } from "@/src/management/ManagementProvider";



export default function OwnerFundsScreen() {

  const router = useRouter();

  const { api, outletId } = useManagement();

  const [capitalAmount, setCapitalAmount] = useState("");

  const [drawingAmount, setDrawingAmount] = useState("");

  const [busy, setBusy] = useState(false);



  const addCapital = async () => {

    const amount = Number(capitalAmount);

    if (!Number.isFinite(amount) || amount <= 0) {

      Alert.alert("Invalid amount", "Enter a positive amount.");

      return;

    }

    setBusy(true);

    try {

      await api.accounting.ownerCapital({

        amount,

        outletId: outletId ?? undefined,

        paymentMethod: "cash",

        description: "Owner capital contribution",

        idempotencyKey: `mobile-capital-${Date.now()}`,

      });

      setCapitalAmount("");

      Alert.alert("Recorded", "Owner funds added — this is not revenue.");

    } catch (err) {

      Alert.alert("Failed", err instanceof Error ? err.message : "Try again.");

    } finally {

      setBusy(false);

    }

  };



  const recordDrawing = async () => {

    const amount = Number(drawingAmount);

    if (!Number.isFinite(amount) || amount <= 0) {

      Alert.alert("Invalid amount", "Enter a positive amount.");

      return;

    }

    setBusy(true);

    try {

      await api.accounting.ownerDrawing({

        amount,

        outletId: outletId ?? undefined,

        paymentMethod: "cash",

        description: "Owner withdrawal",

        idempotencyKey: `mobile-drawing-${Date.now()}`,

      });

      setDrawingAmount("");

      Alert.alert("Recorded", "Owner withdrawal recorded — this is not an expense.");

    } catch (err) {

      Alert.alert("Failed", err instanceof Error ? err.message : "Try again.");

    } finally {

      setBusy(false);

    }

  };



  return (

    <ScrollView style={styles.container}>

      <Pressable onPress={() => router.back()}>

        <Text style={styles.back}>‹ Back</Text>

      </Pressable>

      <Text style={styles.title}>Owner Funds</Text>

      <Text style={styles.subtitle}>Capital and withdrawals — owner only.</Text>



      <View style={styles.card}>

        <Text style={styles.cardTitle}>Add Owner Funds</Text>

        <Text style={styles.hint}>Not counted as sales revenue.</Text>

        <TextInput

          style={styles.input}

          keyboardType="numeric"

          placeholder="Amount in ₹"

          value={capitalAmount}

          onChangeText={setCapitalAmount}

        />

        <Pressable style={styles.btn} disabled={busy} onPress={() => void addCapital()}>

          <Text style={styles.btnText}>Add Funds</Text>

        </Pressable>

      </View>



      <View style={styles.card}>

        <Text style={styles.cardTitle}>Record Withdrawal</Text>

        <Text style={styles.hint}>Not counted as an operating expense.</Text>

        <TextInput

          style={styles.input}

          keyboardType="numeric"

          placeholder="Amount in ₹"

          value={drawingAmount}

          onChangeText={setDrawingAmount}

        />

        <Pressable style={[styles.btn, styles.btnSecondary]} disabled={busy} onPress={() => void recordDrawing()}>

          <Text style={styles.btnText}>Record Withdrawal</Text>

        </Pressable>

      </View>

    </ScrollView>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16, paddingTop: 56 },

  back: { color: "#ea580c", fontWeight: "600", marginBottom: 8 },

  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },

  subtitle: { color: "#64748b", marginBottom: 16 },

  card: {

    backgroundColor: "#fff",

    borderRadius: 12,

    padding: 16,

    marginBottom: 16,

    borderWidth: 1,

    borderColor: "#e2e8f0",

  },

  cardTitle: { fontWeight: "700", fontSize: 16, color: "#0f172a" },

  hint: { color: "#94a3b8", fontSize: 12, marginTop: 4, marginBottom: 12 },

  input: {

    borderWidth: 1,

    borderColor: "#e2e8f0",

    borderRadius: 8,

    paddingHorizontal: 12,

    paddingVertical: 10,

    marginBottom: 12,

    backgroundColor: "#f8fafc",

  },

  btn: { backgroundColor: "#ea580c", borderRadius: 10, padding: 14, alignItems: "center" },

  btnSecondary: { backgroundColor: "#64748b" },

  btnText: { color: "#fff", fontWeight: "700" },

});


