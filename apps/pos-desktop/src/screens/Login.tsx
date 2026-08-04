import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SyncBadge } from "@kaana/ui";
import { getHubHealth, hub, getTerminalId } from "../lib/hub";

export default function LoginScreen() {
  const nav = useNavigate();
  const [pin, setPin] = useState("");
  const [sync, setSync] = useState<"online" | "degraded" | "offline">("offline");

  useEffect(() => {
    getHubHealth()
      .then((h) => setSync(h.cloudConnected ? (h.pendingSyncCount > 0 ? "degraded" : "online") : "offline"))
      .catch(() => setSync("offline"));
  }, []);

  function login() {
    if (pin.length >= 4) {
      sessionStorage.setItem("pos_pin", pin);
      hub("/hub/devices/register", {
        method: "POST",
        body: JSON.stringify({ deviceId: getTerminalId(), outletId: "local-outlet", role: "biller", deviceType: "pos", name: "Counter POS" }),
      }).catch(() => {});
      nav("/floor");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="w-96 p-8 bg-gray-800 rounded-2xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-orange-500">Kaana POS</h1>
            <p className="text-sm text-gray-400">Terminal {getTerminalId()}</p>
          </div>
          <SyncBadge status={sync} />
        </div>
        <input
          type="password"
          placeholder="Staff PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
          className="w-full p-4 rounded-lg bg-gray-700 text-center text-2xl tracking-widest mb-4"
        />
        <button onClick={login} className="w-full py-4 bg-orange-600 rounded-lg font-bold text-lg">Login</button>
      </div>
    </div>
  );
}
