import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { MenuCategory, OrderDetail } from "@kaana/api-client";
import { LoadingState, ErrorState } from "@/src/components/ui/States";
import { formatInr } from "@/src/management/format";
import { useCaptain } from "@/src/captain/CaptainProvider";
import { orderStatusLabel } from "@/src/pos/orderLabels";
import { usePosRealtime } from "@/src/pos/usePosRealtime";
import { canModifyItem, menuItemPrice, pendingItems } from "@/src/pos/types";

export default function CaptainOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    tableId: string;
    tableNumber: string;
    orderId?: string;
    focus?: string;
  }>();

  const { api, outletId, terminalId, permissions, captainAvailable, captainBlockedMessage } = useCaptain();

  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [kotMessage, setKotMessage] = useState<string | null>(null);

  const refreshOrder = useCallback(
    async (orderId: string) => {
      const updated = await api.orders.getOne(orderId);
      setOrder(updated);
      return updated;
    },
    [api],
  );

  const ensureOrder = useCallback(async (): Promise<OrderDetail | null> => {
    if (order) return order;
    if (params.orderId) {
      return refreshOrder(params.orderId);
    }
    if (!captainAvailable) return null;
    setBusy(true);
    try {
      try {
        const existing = await api.orders.openByTable(outletId, params.tableId);
        setOrder(existing);
        return existing;
      } catch {
        const created = await api.orders.create({
          outletId,
          type: "dine_in",
          source: "captain",
          tableId: params.tableId,
          terminalId,
          guestCount: 2,
        });
        setOrder(created);
        return created;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start order");
      return null;
    } finally {
      setBusy(false);
    }
  }, [order, params.orderId, params.tableId, captainAvailable, api, outletId, terminalId, refreshOrder]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cats = await api.menu.fetchMenu(outletId);
      setMenu(cats);
      if (cats[0]) setActiveCategory(cats[0].id);
      if (params.orderId) {
        await refreshOrder(params.orderId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [api, outletId, params.orderId, refreshOrder]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  usePosRealtime(outletId, (event) => {
    if (event.orderId && order?.id === event.orderId) {
      void refreshOrder(event.orderId);
    }
  });

  const filteredItems = useMemo(() => {
    const cat = menu.find((c) => c.id === activeCategory);
    const items = cat?.items ?? menu.flatMap((c) => c.items);
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (item.isAvailable === false) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q);
    });
  }, [menu, activeCategory, search]);

  async function addItem(menuItemId: string) {
    if (busy || !captainAvailable) return;
    setBusy(true);
    setError(null);
    try {
      const active = await ensureOrder();
      if (!active) return;
      await api.orders.addItem(active.id, { menuItemId, quantity: 1 });
      await refreshOrder(active.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item");
    } finally {
      setBusy(false);
    }
  }

  async function changeQty(itemId: string, delta: number, currentQty: number) {
    if (!order || busy) return;
    setBusy(true);
    try {
      const next = currentQty + delta;
      if (next <= 0) {
        await api.orders.removeItem(order.id, itemId);
      } else {
        await api.orders.updateItemQuantity(order.id, itemId, next);
      }
      await refreshOrder(order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update item");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!order || !noteItemId || busy) return;
    const item = order.items.find((i) => i.id === noteItemId);
    if (!item || !canModifyItem(item)) return;
    setBusy(true);
    try {
      await api.orders.removeItem(order.id, noteItemId);
      await api.orders.addItem(order.id, {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        notes: noteText.trim() || undefined,
      });
      await refreshOrder(order.id);
      setNoteItemId(null);
      setNoteText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
    } finally {
      setBusy(false);
    }
  }

  async function fireKitchen() {
    if (!order || busy || !permissions.canFireKot) return;
    setBusy(true);
    setKotMessage(null);
    setError(null);
    try {
      await api.orders.fireKot(order.id);
      await refreshOrder(order.id);
      setKotMessage("Sent to kitchen");
      setTimeout(() => router.replace("/captain"), 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send to kitchen";
      if (msg.includes("No pending items")) {
        setKotMessage("Already sent to kitchen");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function requestBill() {
    if (!order || busy || !permissions.canRequestBill) return;
    setBusy(true);
    try {
      await api.orders.requestBill(order.id);
      Alert.alert("Bill requested", `Table ${params.tableNumber} bill sent to cashier`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request bill");
    } finally {
      setBusy(false);
    }
  }

  async function markServed(itemId: string) {
    if (!order || busy || !permissions.canMarkServed) return;
    setBusy(true);
    try {
      await api.orders.markItemServed(order.id, itemId);
      await refreshOrder(order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark served");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState message="Loading menu…" />;
  if (error && !order && menu.length === 0) {
    return <ErrorState message={error} onRetry={() => void bootstrap()} />;
  }

  const pending = order ? pendingItems(order) : [];
  const readyItems = order?.items.filter((i) => i.status === "ready") ?? [];
  const showServe = params.focus === "serve" || readyItems.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/captain")}>
          <Text style={styles.back}>← Tables</Text>
        </Pressable>
        <Text style={styles.title}>Table {params.tableNumber}</Text>
        {order ? (
          <Text style={styles.meta}>
            #{order.orderNumber} · {orderStatusLabel(order.status)} · {formatInr(order.totalAmount)}
          </Text>
        ) : (
          <Text style={styles.meta}>Tap items to start order</Text>
        )}
      </View>

      {!captainAvailable ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{captainBlockedMessage}</Text>
        </View>
      ) : null}

      {showServe && readyItems.length > 0 ? (
        <View style={styles.readyBox}>
          <Text style={styles.readyTitle}>Ready — tap Served</Text>
          {readyItems.map((item) => (
            <View key={item.id} style={styles.readyRow}>
              <Text style={styles.readyItem}>
                {item.quantity}× {item.name}
              </Text>
              <Pressable style={styles.servedBtn} accessibilityRole="button" accessibilityLabel="Served" disabled={busy} onPress={() => void markServed(item.id)}>
                <Text style={styles.servedBtnText}>Served</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cartScroll}>
        {(order?.items ?? []).map((item) => (
          <View key={item.id} style={styles.cartChip}>
            <Text style={styles.cartChipName} numberOfLines={1}>
              {item.quantity}× {item.name}
            </Text>
            {canModifyItem(item) ? (
              <View style={styles.qtyRow}>
                <Pressable style={styles.qtyBtn} onPress={() => void changeQty(item.id, -1, item.quantity)}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </Pressable>
                <Pressable style={styles.noteBtn} accessibilityRole="button" accessibilityLabel="Note" onPress={() => { setNoteItemId(item.id); setNoteText(item.notes ?? ""); }}>
                  <Text style={styles.noteBtnText}>Note</Text>
                </Pressable>
                <Pressable style={styles.qtyBtn} onPress={() => void changeQty(item.id, 1, item.quantity)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.firedLabel}>{item.status.replace(/_/g, " ")}</Text>
            )}
            {item.notes ? <Text style={styles.itemNote}>{item.notes}</Text> : null}
          </View>
        ))}
      </ScrollView>

      <TextInput style={styles.search} placeholder="Search menu…" value={search} onChangeText={setSearch} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
        {menu.map((cat) => (
          <Pressable
            key={cat.id}
            style={[styles.catChip, activeCategory === cat.id && styles.catChipActive]}
            accessibilityRole="button"
            accessibilityLabel={cat.name}
            onPress={() => setActiveCategory(cat.id)}
          >
            <Text style={[styles.catText, activeCategory === cat.id && styles.catTextActive]}>{cat.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void bootstrap()} />}
        contentContainerStyle={styles.menuGrid}
        renderItem={({ item }) => (
          <Pressable
            style={styles.menuCard}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.name}`}
            disabled={busy || !captainAvailable}
            onPress={() => void addItem(item.id)}
          >
            <Text style={styles.menuName}>{item.name}</Text>
            <Text style={styles.menuPrice}>{formatInr(menuItemPrice(item))}</Text>
            {item.isVeg === false ? <Text style={styles.nonVeg}>Non-veg</Text> : null}
          </Pressable>
        )}
      />

      <View style={styles.footer}>
        {permissions.canFireKot && order && pending.length > 0 ? (
          <Pressable style={styles.kotBtn} accessibilityRole="button" accessibilityLabel="Send to Kitchen" disabled={busy} onPress={() => void fireKitchen()}>
            <Text style={styles.kotBtnText}>{busy ? "Sending…" : `Send to Kitchen (${pending.length})`}</Text>
          </Pressable>
        ) : null}
        {permissions.canRequestBill && order && order.items.length > 0 ? (
          <Pressable style={styles.billBtn} accessibilityRole="button" accessibilityLabel="Request Bill" disabled={busy} onPress={() => void requestBill()}>
            <Text style={styles.billBtnText}>Request Bill</Text>
          </Pressable>
        ) : null}
        {kotMessage ? <Text style={styles.success}>{kotMessage}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Modal visible={noteItemId !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Item note</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Less spicy, no onion…"
              value={noteText}
              onChangeText={setNoteText}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setNoteItemId(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSave} disabled={busy} onPress={() => void saveNote()}>
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff7ed", paddingTop: 44 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  back: { color: "#0f766e", fontWeight: "700", marginBottom: 4 },
  title: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  meta: { color: "#64748b", marginTop: 2 },
  banner: { marginHorizontal: 16, backgroundColor: "#fef3c7", padding: 10, borderRadius: 8, marginBottom: 8 },
  bannerText: { color: "#92400e" },
  readyBox: { marginHorizontal: 16, marginBottom: 8, backgroundColor: "#ecfdf5", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#86efac" },
  readyTitle: { fontWeight: "800", color: "#166534", marginBottom: 8 },
  readyRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  readyItem: { flex: 1, fontWeight: "600", color: "#0f172a" },
  servedBtn: { backgroundColor: "#16a34a", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  servedBtnText: { color: "#fff", fontWeight: "700" },
  cartScroll: { maxHeight: 100, paddingHorizontal: 12, marginBottom: 4 },
  cartChip: { backgroundColor: "#fff", borderRadius: 10, padding: 10, marginRight: 8, minWidth: 140, borderWidth: 1, borderColor: "#e2e8f0" },
  cartChipName: { fontWeight: "700", color: "#0f172a" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  qtyBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 18, fontWeight: "700" },
  noteBtn: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: "#ccfbf1", borderRadius: 6 },
  noteBtnText: { color: "#0f766e", fontWeight: "600", fontSize: 12 },
  firedLabel: { fontSize: 11, color: "#64748b", marginTop: 4 },
  itemNote: { fontSize: 11, color: "#0f766e", marginTop: 4, fontStyle: "italic" },
  search: { marginHorizontal: 16, marginVertical: 6, backgroundColor: "#fff", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  categories: { paddingHorizontal: 12, maxHeight: 44 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", marginHorizontal: 4, borderWidth: 1, borderColor: "#e2e8f0" },
  catChipActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  catText: { color: "#64748b", fontWeight: "600" },
  catTextActive: { color: "#fff" },
  menuGrid: { padding: 8, paddingBottom: 120 },
  menuCard: { flex: 1, margin: 6, backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#99f6e4", minHeight: 88 },
  menuName: { fontWeight: "700", color: "#0f172a", fontSize: 15 },
  menuPrice: { color: "#0f766e", fontWeight: "700", marginTop: 6 },
  nonVeg: { fontSize: 11, color: "#b91c1c", marginTop: 4 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", padding: 16, borderTopWidth: 1, borderColor: "#e2e8f0", gap: 8 },
  kotBtn: { backgroundColor: "#ea580c", padding: 16, borderRadius: 12, alignItems: "center" },
  kotBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  billBtn: { backgroundColor: "#7c3aed", padding: 14, borderRadius: 12, alignItems: "center" },
  billBtnText: { color: "#fff", fontWeight: "700" },
  success: { color: "#16a34a", textAlign: "center", fontWeight: "600" },
  error: { color: "#b91c1c", textAlign: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  noteInput: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, minHeight: 80, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, alignItems: "center" },
  modalCancel: { color: "#64748b", fontWeight: "600", padding: 12 },
  modalSave: { backgroundColor: "#0f766e", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  modalSaveText: { color: "#fff", fontWeight: "700" },
});
