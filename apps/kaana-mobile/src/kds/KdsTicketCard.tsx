import { View, Text, Pressable, StyleSheet } from "react-native";
import type { KdsQueueKot } from "@kaana/api-client";
import { ageTone, formatElapsed } from "./ticketAge";
import { orderContextLabel } from "./permissions";

type Props = {
  kot: KdsQueueKot;
  nowMs: number;
  busy: boolean;
  disabled: boolean;
  onStartPreparing?: () => void;
  onMarkReady?: () => void;
};

export function KdsTicketCard({ kot, nowMs, busy, disabled, onStartPreparing, onMarkReady }: Props) {
  const tone = ageTone(kot.firedAt, nowMs);
  const borderColor = tone === "late" ? "#ef4444" : tone === "warn" ? "#f59e0b" : "#334155";

  return (
    <View style={[styles.card, { borderColor }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kotNumber}>{kot.kotNumber}</Text>
          <Text style={styles.context}>{orderContextLabel(kot)}</Text>
          <Text style={styles.station}>{kot.kitchenStation.name}</Text>
        </View>
        <Text style={[styles.age, tone !== "normal" && styles.ageWarn]}>{formatElapsed(kot.firedAt, nowMs)}</Text>
      </View>

      <View style={styles.items}>
        {kot.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemLine}>
              {item.quantity} × {item.orderItem.name}
            </Text>
            {item.orderItem.notes ? (
              <Text style={styles.note}>{item.orderItem.notes.toUpperCase()}</Text>
            ) : null}
          </View>
        ))}
      </View>

      {kot.status === "pending" && onStartPreparing ? (
        <Pressable
          style={[styles.action, styles.actionStart, (busy || disabled) && styles.actionDisabled]}
          disabled={busy || disabled}
          accessibilityRole="button"
          accessibilityLabel="Start Preparing"
          onPress={onStartPreparing}
        >
          <Text style={styles.actionText}>{busy ? "Updating…" : "Start Preparing"}</Text>
        </Pressable>
      ) : null}

      {kot.status === "preparing" && onMarkReady ? (
        <Pressable
          style={[styles.action, styles.actionReady, (busy || disabled) && styles.actionDisabled]}
          disabled={busy || disabled}
          accessibilityRole="button"
          accessibilityLabel="Mark Ready"
          onPress={onMarkReady}
        >
          <Text style={styles.actionText}>{busy ? "Updating…" : "Mark Ready"}</Text>
        </Pressable>
      ) : null}

      {kot.status === "ready" ? (
        <View style={styles.readyBadge}>
          <Text style={styles.readyText}>READY</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    marginBottom: 12,
    minWidth: 280,
  },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  kotNumber: { color: "#f8fafc", fontSize: 20, fontWeight: "800" },
  context: { color: "#38bdf8", fontSize: 16, fontWeight: "800", marginTop: 2 },
  station: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  age: { color: "#cbd5e1", fontSize: 18, fontWeight: "700" },
  ageWarn: { color: "#fbbf24" },
  items: { gap: 8, marginBottom: 12 },
  itemRow: { gap: 2 },
  itemLine: { color: "#f1f5f9", fontSize: 18, fontWeight: "700" },
  note: { color: "#fbbf24", fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  action: { borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  actionStart: { backgroundColor: "#ea580c" },
  actionReady: { backgroundColor: "#16a34a" },
  actionDisabled: { opacity: 0.6 },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  readyBadge: {
    backgroundColor: "#14532d",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  readyText: { color: "#86efac", fontWeight: "800", fontSize: 16, letterSpacing: 1 },
});
