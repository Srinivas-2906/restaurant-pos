import path from "path";
import os from "os";
import { createOutletDb, type OutletDatabase } from "@kaana/outlet-db";
import { PrinterManager, EscPosDriver } from "@kaana/device-bridge";
import { HubState } from "./hub-state";
import { OrderService } from "./services/order.service";
import { KdsService } from "./services/kds.service";
import { SyncWorker } from "./services/sync.worker";
import { InventoryService } from "./services/inventory.service";
import { createHubServer, listenHub } from "./server";

const PORT = Number(process.env.HUB_PORT ?? 4100);
const OUTLET_ID = process.env.OUTLET_ID ?? "local-outlet";
const CLOUD_API_URL = process.env.CLOUD_API_URL ?? "http://localhost:4000/api";

const dbPath = process.env.OUTLET_DB_PATH ?? path.join(os.homedir(), ".kaana", "outlet.db");
const db: OutletDatabase = createOutletDb(dbPath);

const printerManager = new PrinterManager();
const defaultPrinter = new EscPosDriver({ id: "default", name: "Main Printer", type: "network", address: "localhost", width: 80, isDefault: true });
printerManager.register(defaultPrinter, { id: "default", name: "Main Printer", type: "network", address: "localhost", width: 80, isDefault: true });

const state = new HubState(OUTLET_ID);
const orderService = new OrderService(db, state, printerManager);
const kdsService = new KdsService(db, state);
const inventoryService = new InventoryService(db, state);
const syncWorker = new SyncWorker(db, state, CLOUD_API_URL);

const { httpServer, wss } = createHubServer({ db, state, orderService, kdsService, inventoryService, printerManager, syncWorker });

listenHub(httpServer, PORT, "0.0.0.0", () => {
  console.log(`Kaana Outlet Hub running on http://0.0.0.0:${PORT}`);
  console.log(`Outlet ID: ${OUTLET_ID}`);
  console.log(`Database: ${dbPath}`);
  syncWorker.start();
});

process.on("SIGINT", () => {
  syncWorker.stop();
  wss.close();
  httpServer.close();
  process.exit(0);
});
