import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getHubHealth, hub } from "../lib/hub";

export default function DiagnosticsScreen() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [diag, setDiag] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    getHubHealth().then(setHealth);
    hub<Record<string, unknown>>("/hub/diagnostics").then(setDiag).catch(console.error);
  }, []);

  async function testPrinter() {
    await hub("/hub/printers/test", { method: "POST" });
    alert("Printer test sent");
  }

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto">
      <div className="flex justify-between mb-6">
        <h1 className="text-xl font-bold">Diagnostics</h1>
        <Link to="/floor" className="text-orange-600">← Floor</Link>
      </div>
      <div className="space-y-4">
        <div className="bg-white border rounded-xl p-4">
          <p className="font-medium">Hub Connection</p>
          <pre className="text-xs mt-2 bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(health, null, 2)}</pre>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="font-medium">Devices & Printers</p>
          <pre className="text-xs mt-2 bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(diag, null, 2)}</pre>
        </div>
        <button onClick={testPrinter} className="w-full py-3 border rounded-lg">Test Printer</button>
        <button className="w-full py-3 bg-orange-600 text-white rounded-lg">Contact Support (attach logs)</button>
      </div>
    </div>
  );
}
