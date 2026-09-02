import { notify } from "./notify";

export interface OrderUpdatePayload {
  type?: string;
  tableNumber?: string | null;
  stationName?: string;
  itemNames?: string[];
  itemName?: string;
  kotNumber?: string;
  kotNumbers?: string[];
}

export type NotifyAppRole = "pos" | "kds" | "captain" | "ops";

function tableLabel(tableNumber?: string | null) {
  return tableNumber ? `Table ${tableNumber}` : "Order";
}

function itemList(names?: string[]) {
  if (!names?.length) return "items";
  return names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "");
}

/** Show a top-right toast for kitchen/order websocket events, scoped per app role. */
export function notifyOrderUpdate(event: OrderUpdatePayload, role: NotifyAppRole) {
  const label = tableLabel(event.tableNumber);
  const items = itemList(event.itemNames);

  switch (event.type) {
    case "kot_fired":
      if (role === "kds") notify.info(`New ticket · ${label} — ${items}`);
      else if (role === "pos") notify.success(`Sent to kitchen · ${label}`);
      break;
    case "kot_preparing":
      if (role === "kds") notify.info(`${label} · prep started`);
      else if (role === "captain") notify.info(`${label} · kitchen started prep`);
      break;
    case "kot_ready":
      if (role === "pos") notify.success(`${label} — ${event.stationName ?? "Kitchen"} ready: ${items}`);
      else if (role === "captain") notify.success(`${label} ready to serve · ${items}`);
      else if (role === "kds") notify.success(`Marked ready · ${event.kotNumber ?? label}`);
      break;
    case "item_served":
      if (role === "pos") notify.success(`${label} — ${event.itemName ?? "Item"} served`);
      else if (role === "captain") notify.success(`Served · ${event.itemName ?? "item"} at ${label}`);
      break;
    case "bill_requested":
      if (role === "pos") notify.info(`Bill requested · ${label} — open counter to settle`);
      else if (role === "captain") notify.success(`Bill requested for ${label}`);
      break;
    default:
      break;
  }
}
