import { useCallback, useEffect, useState } from "react";

import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { useRouter } from "expo-router";

import type { MoneyActivityItem } from "@kaana/api-client";

import { ErrorState, LoadingState } from "@/src/components/ui/States";

import { formatInr, formatTime } from "@/src/management/format";

import { useManagement } from "@/src/management/ManagementProvider";



export default function MoneyActivityScreen() {

  const router = useRouter();

  const { api, outletId } = useManagement();

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<MoneyActivityItem[]>([]);



  const load = useCallback(async () => {

    if (!outletId) return;

    setLoading(true);

    setError(null);

    try {

      const data = await api.accounting.moneyActivity({ outletId, limit: 100 });

      setItems(data);

    } catch (err) {

      setError(err instanceof Error ? err.message : "Failed to load activity");

    } finally {

      setLoading(false);

    }

  }, [api, outletId]);



  useEffect(() => {

    void load();

  }, [load]);



  if (loading && items.length === 0) return <LoadingState />;

  if (error && items.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;



  return (

    <ScrollView

      style={styles.container}

      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}

    >

      <Pressable onPress={() => router.back()}>

        <Text style={styles.back}>‹ Back</Text>

      </Pressable>

      <Text style={styles.title}>Money Activity</Text>

      <Text style={styles.subtitle}>Recent business transactions from your books.</Text>



      {items.length === 0 ? (

        <View style={styles.empty}>

          <Text style={styles.emptyText}>No transactions yet.</Text>

        </View>

      ) : (

        items.map((item) => (

          <View key={item.id} style={styles.card}>

            <View style={styles.cardHeader}>

              <Text style={styles.type}>{item.type}</Text>

              <Text

                style={[

                  styles.amount,

                  item.direction === "in" && styles.amountIn,

                  item.direction === "out" && styles.amountOut,

                ]}

              >

                {item.direction === "out" ? "−" : item.direction === "in" ? "+" : ""}

                {formatInr(item.amount)}

              </Text>

            </View>

            <Text style={styles.desc}>{item.description}</Text>

            <Text style={styles.meta}>

              {formatTime(item.date)}

              {item.paymentMethod ? ` · ${item.paymentMethod.toUpperCase()}` : ""}

            </Text>

          </View>

        ))

      )}

    </ScrollView>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16, paddingTop: 56 },

  back: { color: "#ea580c", fontWeight: "600", marginBottom: 8 },

  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },

  subtitle: { color: "#64748b", marginBottom: 16 },

  empty: { padding: 24, alignItems: "center" },

  emptyText: { color: "#94a3b8" },

  card: {

    backgroundColor: "#fff",

    borderRadius: 12,

    padding: 14,

    marginBottom: 8,

    borderWidth: 1,

    borderColor: "#e2e8f0",

  },

  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  type: { fontWeight: "700", color: "#0f172a", fontSize: 15 },

  amount: { fontWeight: "700", fontSize: 16, color: "#0f172a" },

  amountIn: { color: "#15803d" },

  amountOut: { color: "#b91c1c" },

  desc: { color: "#64748b", marginTop: 4, fontSize: 13 },

  meta: { color: "#94a3b8", marginTop: 4, fontSize: 12 },

});


