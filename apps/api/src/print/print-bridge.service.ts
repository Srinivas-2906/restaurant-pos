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

  async printProformaBill(bill: {
    orderNumber: string;
    tableNumber: string | null;
    guestCount: number;
    printedAt: string;
    isReprint: boolean;
    outlet: { name: string; address?: string | null; city?: string | null; gstin?: string | null };
    items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }>;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    disclaimer: string;
  }) {
    const content = [
      "=== KAANA FOODS ===",
      bill.outlet.name,
      bill.outlet.address ?? "",
      bill.outlet.city ?? "",
      bill.outlet.gstin ? `GSTIN: ${bill.outlet.gstin}` : "",
      bill.isReprint ? "** REPRINT **" : "** PROFORMA BILL **",
      `Order: ${bill.orderNumber}`,
      bill.tableNumber ? `Table: ${bill.tableNumber}` : "",
      `Guests: ${bill.guestCount}`,
      `Printed: ${new Date(bill.printedAt).toLocaleString("en-IN")}`,
      "---",
      ...bill.items.map((i) => `${i.quantity}x ${i.name.padEnd(20).slice(0, 20)} ₹${i.totalPrice.toFixed(0)}`),
      "---",
      `Subtotal: ₹${bill.subtotal.toFixed(0)}`,
      `Tax:      ₹${bill.taxAmount.toFixed(0)}`,
      `TOTAL:    ₹${bill.totalAmount.toFixed(0)}`,
      "---",
      bill.disclaimer,
    ].filter(Boolean).join("\n");

    return this.printer.print({ type: "bill", content });
  }
}
