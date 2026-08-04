import { EventEmitter } from "events";
import type { DeviceRegistration, HubStatus } from "@kaana/sync-protocol";

export class HubState extends EventEmitter {
  hubId: string;
  outletId: string;
  cloudConnected = false;
  pendingSyncCount = 0;
  registeredDevices = new Map<string, DeviceRegistration>();
  sequence = 0;
  orderCounter = 0;
  kotCounter = 0;
  invoiceCounter = 0;

  constructor(outletId: string) {
    super();
    this.hubId = `hub-${outletId}`;
    this.outletId = outletId;
  }

  nextSequence() {
    return ++this.sequence;
  }

  nextOrderNumber() {
    this.orderCounter++;
    return `ORD-${String(this.orderCounter).padStart(5, "0")}`;
  }

  nextKotNumber() {
    this.kotCounter++;
    return `KOT-${String(this.kotCounter).padStart(4, "0")}`;
  }

  nextInvoiceNumber() {
    this.invoiceCounter++;
    const year = new Date().getFullYear();
    return `INV-${year}-${String(this.invoiceCounter).padStart(5, "0")}`;
  }

  registerDevice(device: DeviceRegistration) {
    this.registeredDevices.set(device.deviceId, device);
    this.emit("device:registered", device);
  }

  getStatus(): HubStatus {
    return {
      hubId: this.hubId,
      outletId: this.outletId,
      cloudConnected: this.cloudConnected,
      pendingSyncCount: this.pendingSyncCount,
      registeredDevices: this.registeredDevices.size,
      lastCloudSyncAt: undefined,
      version: "0.1.0",
    };
  }

  broadcast(channel: string, data: unknown) {
    this.emit("broadcast", channel, data);
  }
}
