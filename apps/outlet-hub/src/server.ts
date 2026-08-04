import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { OutletDatabase } from "@kaana/outlet-db";
import type { HubState } from "./hub-state";
import type { OrderService } from "./services/order.service";
import type { KdsService } from "./services/kds.service";
import type { PrinterManager } from "@kaana/device-bridge";
import type { SyncWorker } from "./services/sync.worker";

import type { InventoryService } from "./services/inventory.service";

interface HubDeps {
  db: OutletDatabase;
  state: HubState;
  orderService: OrderService;
  kdsService: KdsService;
  inventoryService: InventoryService;
  printerManager: PrinterManager;
  syncWorker: SyncWorker;
}

export function createHubServer(deps: HubDeps) {
  const { state, orderService, kdsService, inventoryService, printerManager, syncWorker } = deps;
  const app = express();
  app.use(cors());
  app.use(express.json());

  orderService.seedDemoData();

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });
  const clients = new Map<WebSocket, Set<string>>();

  state.on("broadcast", (channel: string, data: unknown) => {
    const msg = JSON.stringify({ channel, data });
    for (const [ws, channels] of clients) {
      if (channels.has(channel) || channels.has("*")) {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg);
      }
    }
  });

  wss.on("connection", (ws) => {
    clients.set(ws, new Set());
    ws.on("message", (raw) => {
      try {
        const { action, channel } = JSON.parse(raw.toString());
        if (action === "join" && channel) clients.get(ws)?.add(channel);
      } catch { /* ignore */ }
    });
    ws.on("close", () => clients.delete(ws));
    ws.send(JSON.stringify({ event: "connected", hubId: state.hubId }));
  });

  app.get("/hub/health", (_req, res) => {
    res.json({ status: "ok", ...syncWorker.getStatus() });
  });

  app.post("/hub/devices/register", (req, res) => {
    state.registerDevice(req.body);
    res.json({ registered: true });
  });

  app.get("/hub/floor", (_req, res) => res.json({ tables: orderService.getFloor() }));
  app.get("/hub/menu", (_req, res) => res.json(orderService.getMenu()));

  app.get("/hub/orders", (req, res) => {
    res.json(orderService.listOrders(req.query.status as string));
  });

  app.post("/hub/orders", (req, res) => {
    res.json(orderService.createOrder(req.body));
  });

  app.get("/hub/orders/:id", (req, res) => {
    const order = orderService.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Not found" });
    res.json(order);
  });

  app.post("/hub/orders/:id/items", (req, res) => {
    res.json(orderService.addItem(req.params.id, req.body));
  });

  app.post("/hub/orders/:id/kot", (req, res) => {
    res.json(orderService.fireKOT(req.params.id));
  });

  app.post("/hub/orders/:id/settle", (req, res) => {
    res.json(orderService.settle(req.params.id, req.body));
  });

  app.get("/hub/kds/stations/:stationId/queue", (req, res) => {
    res.json(kdsService.getStationQueue(req.params.stationId));
  });

  app.get("/hub/kds/aggregated", (_req, res) => {
    res.json(kdsService.getAggregated(state.outletId));
  });

  app.patch("/hub/kds/kot/:kotId/ready", (req, res) => {
    res.json(kdsService.markReady(req.params.kotId));
  });

  app.patch("/hub/kds/kot/:kotId/preparing", (req, res) => {
    res.json(kdsService.markPreparing(req.params.kotId));
  });

  app.patch("/hub/menu/items/:id/availability", (req, res) => {
    res.json(kdsService.markItemUnavailable(req.params.id));
  });

  app.post("/hub/printers/test", async (_req, res) => {
    const result = await printerManager.getPrinterForStation("default")?.test();
    res.json(result);
  });

  app.get("/hub/diagnostics", (_req, res) => {
    res.json({
      hub: syncWorker.getStatus(),
      devices: Array.from(state.registeredDevices.values()),
      printers: printerManager.listPrinters(),
    });
  });

  app.get("/status", (_req, res) => {
    const diag = {
      hub: syncWorker.getStatus(),
      devices: Array.from(state.registeredDevices.values()),
      printers: printerManager.listPrinters(),
    };
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Kaana Outlet Hub Status</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:1rem;margin:1rem 0}
.ok{color:#16a34a}.warn{color:#ea580c}button{background:#ea580c;color:#fff;border:none;padding:.5rem 1rem;border-radius:6px;cursor:pointer}
</style></head><body>
<h1>Kaana Outlet Hub</h1>
<p class="ok">Local service running</p>
<div class="card"><h2>Cloud sync</h2>
<p>Connected: ${diag.hub.cloudConnected ? "Yes" : "No"}</p>
<p>Pending sync: ${diag.hub.pendingSyncCount ?? 0}</p>
<p>Outlet: ${diag.hub.outletId}</p>
<p>Version: ${diag.hub.version ?? "1.0"}</p>
</div>
<div class="card"><h2>Devices (${diag.devices.length})</h2>
<pre>${JSON.stringify(diag.devices, null, 2)}</pre></div>
<div class="card"><h2>Printers</h2>
<pre>${JSON.stringify(diag.printers, null, 2)}</pre></div>
<p><button onclick="fetch('/hub/sync/trigger',{method:'POST'}).then(()=>location.reload())">Trigger sync</button>
<button onclick="window.open('/hub/diagnostics')">Download JSON</button></p>
</body></html>`;
    res.type("html").send(html);
  });

  app.post("/hub/sync/trigger", async (_req, res) => {
    await syncWorker.sync();
    res.json(syncWorker.getStatus());
  });

  app.get("/hub/inventory/ingredients", (_req, res) => {
    res.json(inventoryService.listIngredients());
  });

  app.get("/hub/inventory/purchase-orders", (_req, res) => {
    res.json(inventoryService.listPurchaseOrders());
  });

  app.post("/hub/inventory/purchase-orders/:id/receive", (req, res) => {
    try {
      res.json(inventoryService.receivePO(req.params.id));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Receive failed" });
    }
  });

  return { app, httpServer, wss };
}

export function listenHub(httpServer: Server, port: number, host: string, onListen?: () => void) {
  httpServer.listen(port, host, onListen);
}
