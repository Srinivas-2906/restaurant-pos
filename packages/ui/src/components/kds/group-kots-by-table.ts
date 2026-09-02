export interface KdsQueueItem {
  id: string;
  kotNumber: string;
  status: string;
  firedAt: string;
  items: Array<{
    quantity: number;
    orderItem: { id: string; name: string; notes?: string | null };
  }>;
  order: { id: string; orderNumber: string; table?: { number: string } | null };
}

export interface TableKOTGroupItem {
  id: string;
  quantity: number;
  name: string;
  notes?: string | null;
}

export interface TableOrderSection {
  orderId: string;
  orderNumber: string;
  firedAt: string;
  elapsedMin: number;
  kots: KdsQueueItem[];
  items: TableKOTGroupItem[];
}

export interface TableKOTGroup {
  tableKey: string;
  tableLabel: string;
  tableNumber?: string;
  firedAt: string;
  elapsedMin: number;
  orderCount: number;
  itemCount: number;
  kots: KdsQueueItem[];
  orders: TableOrderSection[];
  worstStatus: "pending" | "preparing";
}

function kotItemsFromKot(kot: KdsQueueItem): TableKOTGroupItem[] {
  return kot.items.map((i) => ({
    id: i.orderItem.id,
    quantity: i.quantity,
    name: i.orderItem.name,
    notes: i.orderItem.notes,
  }));
}

function mergeItemsInto(target: TableKOTGroupItem[], incoming: TableKOTGroupItem[]) {
  for (const item of incoming) {
    const match = target.find((i) => i.id === item.id);
    if (match) match.quantity += item.quantity;
    else target.push({ ...item });
  }
}

function upsertOrderSection(group: TableKOTGroup, kot: KdsQueueItem): TableOrderSection {
  let section = group.orders.find((o) => o.orderId === kot.order.id);
  const kotItems = kotItemsFromKot(kot);

  if (!section) {
    section = {
      orderId: kot.order.id,
      orderNumber: kot.order.orderNumber,
      firedAt: kot.firedAt,
      elapsedMin: elapsedMinutes(kot.firedAt),
      kots: [kot],
      items: kotItems.map((i) => ({ ...i })),
    };
    group.orders.push(section);
    return section;
  }

  section.kots.push(kot);
  mergeItemsInto(section.items, kotItems);
  if (new Date(kot.firedAt).getTime() < new Date(section.firedAt).getTime()) {
    section.firedAt = kot.firedAt;
  }
  section.elapsedMin = elapsedMinutes(section.firedAt);
  return section;
}

function recomputeGroupStats(group: TableKOTGroup) {
  group.orders.sort((a, b) => new Date(a.firedAt).getTime() - new Date(b.firedAt).getTime());
  group.orderCount = group.orders.length;
  group.itemCount = group.orders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
    0,
  );
  group.firedAt = group.orders[0]?.firedAt ?? group.firedAt;
  group.elapsedMin = elapsedMinutes(group.firedAt);
  group.worstStatus = group.kots.some((k) => k.status === "preparing") ? "preparing" : "pending";
}

export function groupKotsByTable(kots: KdsQueueItem[]): TableKOTGroup[] {
  const map = new Map<string, TableKOTGroup>();

  for (const kot of kots) {
    const tableNum = kot.order.table?.number;
    const tableKey = tableNum ?? kot.order.orderNumber;
    const tableLabel = tableNum ? `Table ${tableNum}` : kot.order.orderNumber;

    let group = map.get(tableKey);
    if (!group) {
      group = {
        tableKey,
        tableLabel,
        tableNumber: tableNum ?? undefined,
        firedAt: kot.firedAt,
        elapsedMin: elapsedMinutes(kot.firedAt),
        orderCount: 0,
        itemCount: 0,
        kots: [],
        orders: [],
        worstStatus: kot.status as TableKOTGroup["worstStatus"],
      };
      map.set(tableKey, group);
    }

    group.kots.push(kot);
    upsertOrderSection(group, kot);
    if (new Date(kot.firedAt).getTime() < new Date(group.firedAt).getTime()) {
      group.firedAt = kot.firedAt;
    }
    if (statusRank(kot.status) > statusRank(group.worstStatus)) {
      group.worstStatus = kot.status as TableKOTGroup["worstStatus"];
    }
    recomputeGroupStats(group);
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.firedAt).getTime() - new Date(b.firedAt).getTime(),
  );
}

function elapsedMinutes(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

function statusRank(status: string): number {
  if (status === "preparing") return 2;
  if (status === "pending") return 1;
  return 0;
}
