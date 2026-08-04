import { Injectable } from "@nestjs/common";
import { EscPosPrinterAdapter, PrintJob } from "@kaana/integrations";

@Injectable()
export class PrintBridgeService {
  private printer = new EscPosPrinterAdapter();

  async printKOT(stationCode: string, items: Array<{ name: string; quantity: number }>, orderNumber: string) {
    const content = [
      "=== KOT ===",
      `Order: ${orderNumber}`,
      `Station: ${stationCode}`,
      "---",
      ...items.map((i) => `${i.quantity}x ${i.name}`),
      "===========",
    ].join("\n");

    return this.printer.print({ type: "kot", content, stationCode });
  }

  async printBill(invoiceNumber: string, items: Array<{ name: string; quantity: number; total: number }>, total: number, gstin?: string) {
    const content = [
      "=== KAANA FOODS ===",
      gstin ? `GSTIN: ${gstin}` : "",
      `Invoice: ${invoiceNumber}`,
      "---",
      ...items.map((i) => `${i.quantity}x ${i.name}  ₹${i.total}`),
      "---",
      `Total: ₹${total}`,
      "Thank you!",
    ].filter(Boolean).join("\n");

    return this.printer.print({ type: "bill", content });
  }
}
