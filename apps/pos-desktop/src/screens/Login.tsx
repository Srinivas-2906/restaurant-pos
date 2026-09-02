import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SyncBadge, KaanaBrand } from "@kaana/ui";
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
    <div className="min-h-dvh flex items-center justify-center bg-gray-900 text-white p-4 overflow-x-clip">
      <div className="w-full max-w-sm p-6 sm:p-8 bg-gray-800 rounded-2xl overflow-hidden">
        <div className="flex justify-between items-start gap-3 mb-6 min-w-0">
          <div className="min-w-0">
            <KaanaBrand size="sm" appLabel="POS · Counter" />
            <p className="text-sm text-gray-400 mt-2 truncate">Terminal {getTerminalId()}</p>
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
