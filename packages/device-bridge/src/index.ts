export interface PrintJob {
  type: "kot" | "bill" | "test";
  content: string;
  stationCode?: string;
  printerId?: string;
}

export interface PrinterConfig {
  id: string;
  name: string;
  type: "usb" | "network" | "bluetooth";
  address: string;
  width: 58 | 80;
  isDefault?: boolean;
}

export interface PrintResult {
  success: boolean;
  printerId: string;
  error?: string;
  timestamp: string;
}

export interface DrawerKickResult {
  success: boolean;
  error?: string;
}

export interface PrinterDriver {
  id: string;
  print(job: PrintJob): Promise<PrintResult>;
  test(): Promise<PrintResult>;
  openDrawer?(): Promise<DrawerKickResult>;
}

export class EscPosDriver implements PrinterDriver {
  id: string;
  private config: PrinterConfig;

  constructor(config: PrinterConfig) {
    this.id = config.id;
    this.config = config;
  }

  async print(job: PrintJob): Promise<PrintResult> {
    const escpos = this.formatEscPos(job.content);
    console.log(`[ESC/POS ${this.config.name}@${this.config.address}]`, escpos.slice(0, 200));
    return { success: true, printerId: this.id, timestamp: new Date().toISOString() };
  }

  async test(): Promise<PrintResult> {
    return this.print({ type: "test", content: "=== KAANA FOODS PRINTER TEST ===\nOK\n" });
  }

  async openDrawer(): Promise<DrawerKickResult> {
    console.log(`[ESC/POS] Cash drawer kick on ${this.config.name}`);
    return { success: true };
  }

  private formatEscPos(text: string): string {
    const init = "\x1B\x40";
    const cut = "\x1D\x56\x00";
    return init + text + "\n\n" + cut;
  }
}

export class PrinterManager {
  private printers = new Map<string, PrinterDriver>();
  private routing = new Map<string, string>();

  register(driver: PrinterDriver, config: PrinterConfig) {
    this.printers.set(config.id, driver);
    if (config.isDefault) this.routing.set("default", config.id);
  }

  routeStation(stationCode: string, printerId: string) {
    this.routing.set(stationCode, printerId);
  }

  getPrinterForStation(stationCode?: string): PrinterDriver | undefined {
    const id = (stationCode && this.routing.get(stationCode)) || this.routing.get("default");
    return id ? this.printers.get(id) : undefined;
  }

  async printKOT(stationCode: string, kotNumber: string, items: Array<{ name: string; qty: number }>, table?: string) {
    const content = [
      `KOT: ${kotNumber}`,
      table ? `Table: ${table}` : "",
      "---",
      ...items.map((i) => `${i.qty}x ${i.name}`),
    ].filter(Boolean).join("\n");

    const printer = this.getPrinterForStation(stationCode);
    if (!printer) return { success: false, error: "No printer configured" };
    return printer.print({ type: "kot", content, stationCode });
  }

  async printBill(invoiceNumber: string, items: Array<{ name: string; qty: number; total: number }>, total: number, gstin?: string) {
    const content = [
      "KAANA FOODS",
      gstin ? `GSTIN: ${gstin}` : "",
      `Invoice: ${invoiceNumber}`,
      "---",
      ...items.map((i) => `${i.qty}x ${i.name}  Rs.${i.total.toFixed(0)}`),
      "---",
      `Total: Rs.${total.toFixed(0)}`,
      "Thank you!",
    ].filter(Boolean).join("\n");

    const printer = this.getPrinterForStation("default");
    if (!printer) return { success: false, error: "No printer configured" };
    return printer.print({ type: "bill", content });
  }

  listPrinters(): PrinterConfig[] {
    return Array.from(this.printers.keys()).map((id) => ({ id, name: id, type: "network" as const, address: "local", width: 80 as const }));
  }
}
