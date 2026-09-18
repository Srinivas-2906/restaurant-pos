import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { MenuCategory, OrderDetail } from "@kaana/api-client";
import { LoadingState, ErrorState } from "@/src/components/ui/States";
import { formatInr } from "@/src/management/format";
import { usePos } from "@/src/pos/PosProvider";
import { useOfflinePos } from "@/src/offline/OfflinePosProvider";
import { SyncStatusBanner } from "@/src/offline/SyncStatusBanner";
import { ORDER_TYPE_LABELS, orderStatusLabel } from "@/src/pos/orderLabels";
import { usePosRealtime } from "@/src/pos/usePosRealtime";
import {
  canModifyItem,
  menuItemPrice,
  money,
  pendingItems,
  type PosOrderType,
} from "@/src/pos/types";

export default function PosOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    type?: string;
    tableId?: string;
    tableNumber?: string;
    orderId?: string;
  }>();
  const orderType = (params.type ?? "takeaway") as PosOrderType;
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const { api, outletId, terminalId, permissions, posAvailable, posBlockedMessage, restaurantName, outletName } =
    usePos();
  const offlinePos = useOfflinePos();
  const [localOrderId, setLocalOrderId] = useState<string | null>(null);

  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [showCart, setShowCart] = useState(false);

  const refreshOrder = useCallback(
    async (orderId: string) => {
      const updated = await api.orders.getOne(orderId);
      setOrder(updated);
      return updated;
    },
    [api],
  );

  const loadMenu = useCallback(async () => {
    const cats = await offlinePos.refreshMenu();
    setMenu(cats);
    if (cats[0] && !activeCategory) setActiveCategory(cats[0].id);
  }, [offlinePos, activeCategory]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadMenu();
      if (params.orderId) {
        await refreshOrder(params.orderId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load POS order");
    } finally {
      setLoading(false);
    }
  }, [loadMenu, params.orderId, refreshOrder]);

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

  async function ensureOrder(): Promise<OrderDetail | null> {
    if (order) return order;
    if (!posAvailable) return null;
    setBusy(true);
    try {
      if (offlinePos.isOffline) {
        const created = await offlinePos.createOrder({
          type: orderType,
          tableId: params.tableId,
          guestCount: orderType === "dine_in" ? 2 : 1,
        });
        setLocalOrderId(created.id);
        const detail = offlinePos.toOrderDetail(created);
        setOrder(detail);
        return detail;
      }
      const created = await api.orders.create({
        outletId,
        type: orderType,
        source: "pos",
        tableId: params.tableId,
        terminalId,
        guestCount: orderType === "dine_in" ? 2 : 1,
      });
      setOrder(created);
      return created;
    } catch (err) {
      if (!offlinePos.isOffline) {
        try {
          const created = await offlinePos.createOrder({
            type: orderType,
            tableId: params.tableId,
            guestCount: orderType === "dine_in" ? 2 : 1,
          });
          setLocalOrderId(created.id);
          const detail = offlinePos.toOrderDetail(created);
          setOrder(detail);
          return detail;
        } catch (localErr) {
          setError(localErr instanceof Error ? localErr.message : "Could not create order");
          return null;
        }
      }
      setError(err instanceof Error ? err.message : "Could not create order");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function addItem(menuItemId: string) {
    if (busy || !posAvailable) return;
    setBusy(true);
    setError(null);
    try {
      const active = await ensureOrder();
      if (!active) return;
      const menuItem = menu.flatMap((c) => c.items).find((i) => i.id === menuItemId) as
        | (typeof menu)[0]["items"][0] & { taxRule?: { cgstRate?: number; sgstRate?: number }; updatedAt?: string }
        | undefined;
      if (!menuItem) return;

      if (localOrderId || offlinePos.isOffline) {
        const taxRate = menuItem.taxRule
          ? Number(menuItem.taxRule.cgstRate ?? 0) + Number(menuItem.taxRule.sgstRate ?? 0)
          : 0;
        const updated = await offlinePos.addItem(active.id, {
          menuItemId,
          name: menuItem.name,
          unitPrice: Number(menuItem.basePrice),
          taxRate,
          menuItemUpdatedAt: menuItem.updatedAt,
        });
        setOrder(offlinePos.toOrderDetail(updated));
        return;
      }
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

  async function fireKitchen() {
    if (!order || busy) return;
    setBusy(true);
    try {
      if (localOrderId || offlinePos.isOffline) {
        const updated = await offlinePos.fireKot(order.id);
        setOrder(offlinePos.toOrderDetail(updated));
        return;
      }
      await api.orders.fireKot(order.id);
      await refreshOrder(order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send to kitchen");
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder() {
    if (!order || busy || !permissions.canCancel) return;
    setBusy(true);
    try {
      await api.orders.cancel(order.id, "Cancelled from mobile POS");
      router.replace("/pos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel order");
    } finally {
      setBusy(false);
    }
  }

  function goToPayment() {
    if (!order) return;
    router.push({
      pathname: "/pos/payment",
      params: {
        orderId: order.id,
        discount: discountInput || "0",
      },
    });
  }

  if (loading) return <LoadingState message="Loading menu…" />;
  if (!loading && menu.length === 0 && offlinePos.menuBlockedMessage) {
    return (
      <ErrorState
        message={offlinePos.menuBlockedMessage}
        onRetry={() => void bootstrap()}
      />
    );
  }
  if (error && !order && menu.length === 0) {
    return <ErrorState message={error} onRetry={() => void bootstrap()} />;
  }

  const pending = order ? pendingItems(order) : [];
  const title =
    orderType === "dine_in" && params.tableNumber
      ? `Table ${params.tableNumber}`
      : ORDER_TYPE_LABELS[orderType] ?? orderType;

  const cartPanel = (
    <View style={[styles.cartPanel, isWide ? styles.cartPanelWide : styles.cartPanelFull]}>
      <View style={styles.cartHeader}>
        <Text style={styles.cartTitle}>Order {order?.orderNumber ?? "—"}</Text>
        {order ? (
          <Text style={styles.cartStatus}>{orderStatusLabel(order.status)}</Text>
        ) : (
          <Text style={styles.cartStatus}>Tap items to start</Text>
        )}
      </View>

      <ScrollView
        style={styles.cartList}
        contentContainerStyle={styles.cartListContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {(order?.items ?? []).map((item) => (
          <View key={item.id} style={styles.cartRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cartItemName}>{item.name}</Text>
              <Text style={styles.cartItemMeta}>
                {formatInr(item.unitPrice)} · {item.status.replace(/_/g, " ")}
              </Text>
            </View>
            {canModifyItem(item) ? (
              <View style={styles.qtyRow}>
                <Pressable style={styles.qtyBtn} onPress={() => void changeQty(item.id, -1, item.quantity)}>
                  <Text>−</Text>
                </Pressable>
                <Text style={styles.qty}>{item.quantity}</Text>
                <Pressable style={styles.qtyBtn} onPress={() => void changeQty(item.id, 1, item.quantity)}>
                  <Text>+</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.qty}>×{item.quantity}</Text>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.cartFooter}>
        {order ? (
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text>Subtotal</Text>
              <Text>{formatInr(order.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>Tax (GST)</Text>
              <Text>{formatInr(order.taxAmount)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={styles.grandLabel}>Total</Text>
              <Text style={styles.grandLabel}>{formatInr(order.totalAmount)}</Text>
            </View>
          </View>
        ) : null}

        {permissions.canApplyDiscount && order ? (
          <TextInput
            style={styles.discountInput}
            placeholder="Discount amount (₹)"
            keyboardType="numeric"
            value={discountInput}
            onChangeText={setDiscountInput}
          />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          {order && pending.length > 0 && permissions.canFireKot ? (
            <Pressable style={styles.kotBtn} disabled={busy} onPress={() => void fireKitchen()}>
              <Text style={styles.kotBtnText}>{busy ? "Sending…" : "Send to Kitchen"}</Text>
            </Pressable>
          ) : null}

          {order && permissions.canSettle && order.status !== "settled" ? (
            <Pressable
              style={[styles.payBtn, (!order.items.length || busy) && styles.disabled]}
              disabled={!order.items.length || busy}
              onPress={goToPayment}
            >
              <Text style={styles.payBtnText}>Bill & Pay</Text>
            </Pressable>
          ) : null}

          {order && permissions.canCancel && order.status !== "settled" ? (
            <Pressable style={styles.cancelBtn} disabled={busy} onPress={() => void cancelOrder()}>
              <Text style={styles.cancelBtnText}>Cancel order</Text>
            </Pressable>
          ) : null}

          {orderType === "dine_in" && order && pending.length === 0 && order.status !== "settled" ? (
            <Pressable style={styles.holdBtn} onPress={() => router.replace("/pos")}>
              <Text style={styles.holdBtnText}>Hold & back to POS</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );

  const menuPanel = (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.outlet}>{restaurantName} · {outletName}</Text>
      </View>

      {!posAvailable ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{posBlockedMessage}</Text>
        </View>
      ) : null}

      <TextInput
        style={styles.search}
        placeholder="Search menu…"
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
        {menu.map((cat) => (
          <Pressable
            key={cat.id}
            style={[styles.catChip, activeCategory === cat.id && styles.catChipActive]}
            onPress={() => setActiveCategory(cat.id)}
          >
            <Text style={[styles.catChipText, activeCategory === cat.id && styles.catChipTextActive]}>
              {cat.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        style={styles.menuList}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={isWide ? 3 : 2}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void bootstrap()} />}
        contentContainerStyle={styles.menuGrid}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        renderItem={({ item }) => (
          <Pressable
            style={[styles.menuCard, item.isAvailable === false && styles.menuDisabled]}
            disabled={busy || !posAvailable || item.isAvailable === false}
            onPress={() => void addItem(item.id)}
          >
            <Text style={styles.menuName}>{item.name}</Text>
            <Text style={styles.menuPrice}>{formatInr(menuItemPrice(item))}</Text>
            {item.isVeg === false ? <Text style={styles.nonVeg}>Non-veg</Text> : null}
          </Pressable>
        )}
      />
    </View>
  );

  if (isWide) {
    return (
      <View style={styles.wideRoot}>
        {menuPanel}
        {cartPanel}
      </View>
    );
  }

  return (
    <View style={styles.phoneRoot}>
      {showCart ? cartPanel : menuPanel}
      {!isWide ? (
        <Pressable style={styles.cartFab} onPress={() => setShowCart((v) => !v)}>
          <Text style={styles.cartFabText}>
            {showCart ? "Menu" : `Cart${order ? ` · ${formatInr(order.totalAmount)}` : ""}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wideRoot: { flex: 1, flexDirection: "row", backgroundColor: "#fff7ed" },
  phoneRoot: { flex: 1, backgroundColor: "#fff7ed" },
  header: { paddingTop: 48, paddingHorizontal: 16, paddingBottom: 8 },
  back: { color: "#9a3412", fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  outlet: { color: "#64748b", fontSize: 13 },
  banner: { backgroundColor: "#fef3c7", marginHorizontal: 16, padding: 10, borderRadius: 8 },
  bannerText: { color: "#92400e" },
  search: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  categories: { paddingHorizontal: 12, maxHeight: 44, marginBottom: 4 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  catChipActive: { backgroundColor: "#9a3412", borderColor: "#9a3412" },
  catChipText: { color: "#64748b", fontWeight: "600" },
  catChipTextActive: { color: "#fff" },
  menuGrid: { padding: 8, paddingBottom: 96 },
  menuList: { flex: 1, minHeight: 0 },
  menuCard: {
    flex: 1,
    margin: 6,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fed7aa",
    minHeight: 90,
  },
  menuDisabled: { opacity: 0.45 },
  menuName: { fontWeight: "700", color: "#0f172a" },
  menuPrice: { color: "#9a3412", fontWeight: "700", marginTop: 6 },
  nonVeg: { fontSize: 11, color: "#b91c1c", marginTop: 4 },
  cartPanel: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  cartPanelFull: {
    maxHeight: undefined,
  },
  cartPanelWide: {
    width: 360,
    maxWidth: "42%",
    borderTopWidth: 0,
    borderLeftWidth: 1,
  },
  cartHeader: { marginBottom: 8 },
  cartTitle: { fontSize: 18, fontWeight: "700" },
  cartStatus: { color: "#64748b" },
  cartList: { flex: 1, minHeight: 0 },
  cartListContent: { paddingBottom: 8 },
  cartFooter: { flexShrink: 0, paddingTop: 8 },
  cartRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderColor: "#f1f5f9" },
  cartItemName: { fontWeight: "600", color: "#0f172a" },
  cartItemMeta: { fontSize: 12, color: "#64748b" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  qty: { fontWeight: "700", minWidth: 24, textAlign: "center" },
  totals: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: "#e2e8f0" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  grandTotal: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderColor: "#e2e8f0" },
  grandLabel: { fontWeight: "800", fontSize: 16 },
  discountInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#f8fafc",
  },
  error: { color: "#b91c1c", marginTop: 8 },
  actions: { gap: 8, marginTop: 10 },
  kotBtn: { backgroundColor: "#d97706", padding: 12, borderRadius: 10, alignItems: "center" },
  kotBtnText: { color: "#fff", fontWeight: "700" },
  payBtn: { backgroundColor: "#16a34a", padding: 14, borderRadius: 10, alignItems: "center" },
  payBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn: { padding: 10, alignItems: "center" },
  cancelBtnText: { color: "#b91c1c", fontWeight: "600" },
  holdBtn: { backgroundColor: "#f1f5f9", padding: 12, borderRadius: 10, alignItems: "center" },
  holdBtnText: { color: "#475569", fontWeight: "600" },
  disabled: { opacity: 0.5 },
  cartFab: {
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: "#9a3412",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  cartFabText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
