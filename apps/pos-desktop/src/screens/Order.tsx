import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MenuItemGrid, OrderCart } from "@kaana/ui";
import { hub } from "../lib/hub";

interface MenuCat { id: string; name: string; items: Array<{ id: string; name: string; price: number; isVeg?: boolean; isAvailable?: boolean }>; }
interface Order { id: string; items: Array<{ id: string; name: string; quantity: number; totalPrice: number }>; totalAmount: number; }

export default function OrderScreen() {
  const { orderId } = useParams<{ orderId: string }>();
  const nav = useNavigate();
  const [menu, setMenu] = useState<MenuCat[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [cat, setCat] = useState<string>("");

  useEffect(() => {
    hub<MenuCat[]>("/hub/menu").then((m) => { setMenu(m); setCat(m[0]?.id ?? ""); });
    if (orderId) hub<Order>(`/hub/orders/${orderId}`).then(setOrder);
  }, [orderId]);

  async function addItem(menuItemId: string) {
    const item = menu.flatMap((c) => c.items).find((i) => i.id === menuItemId);
    if (!item || !orderId) return;
    const updated = await hub<Order>(`/hub/orders/${orderId}/items`, {
      method: "POST",
      body: JSON.stringify({ menuItemId, name: item.name, unitPrice: item.price }),
    });
    setOrder(updated);
  }

  const items = menu.find((c) => c.id === cat)?.items ?? [];

  return (
    <div className="h-screen flex">
      <div className="w-28 bg-gray-900 text-white p-2 space-y-1">
        {menu.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className={`w-full p-2 rounded text-sm ${cat === c.id ? "bg-orange-600" : "hover:bg-gray-700"}`}>{c.name}</button>
        ))}
      </div>
      <div className="flex-1 p-3 overflow-y-auto">
        <MenuItemGrid items={items} onSelect={addItem} />
      </div>
      <div className="w-80">
        {order && (
          <OrderCart
            items={order.items}
            total={order.totalAmount}
            onFire={() => nav(`/kot/${orderId}`)}
            onPay={() => nav(`/payment/${orderId}`)}
          />
        )}
      </div>
    </div>
  );
}
