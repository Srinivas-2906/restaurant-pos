import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { TableCard } from "@kaana/ui";
import { hub, getTerminalId } from "../lib/hub";

interface Table { id: string; number: string; status: string; capacity: number; }

export default function FloorScreen() {
  const nav = useNavigate();
  const [tables, setTables] = useState<Table[]>([]);

  useEffect(() => {
    hub<{ tables: Table[] }>("/hub/floor").then((d) => setTables(d.tables ?? d as unknown as Table[])).catch(console.error);
  }, []);

  async function selectTable(table: Table) {
    const order = await hub<{ id: string }>("/hub/orders", {
      method: "POST",
      body: JSON.stringify({ tableId: table.id, terminalId: getTerminalId(), guestCount: 2 }),
    });
    nav(`/order/${order.id}`);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <h1 className="font-bold text-lg">Floor Plan</h1>
        <nav className="flex gap-3 text-sm">
          <Link to="/inbox" className="text-blue-600">Inbox</Link>
          <Link to="/day-close" className="text-gray-600">Day Close</Link>
          <Link to="/diagnostics" className="text-gray-600">Diagnostics</Link>
        </nav>
      </header>
      <main className="flex-1 p-4 grid grid-cols-4 gap-3">
        {tables.map((t) => (
          <TableCard key={t.id} number={t.number} status={t.status} capacity={t.capacity} onClick={() => selectTable(t)} />
        ))}
      </main>
    </div>
  );
}
