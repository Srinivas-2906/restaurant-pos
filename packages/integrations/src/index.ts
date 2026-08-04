export interface MenuItemPayload {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  category: string;
  isVeg: boolean;
}

export interface OrderPayload {
  externalOrderId: string;
  source: "swiggy" | "zomato" | "website";
  items: Array<{
    itemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }>;
  customer?: { name?: string; phone?: string };
  type: "delivery" | "takeaway";
}

export interface AggregatorAdapter {
  name: string;
  pushMenu(outletId: string, items: MenuItemPayload[]): Promise<boolean>;
  updateItemAvailability(outletId: string, itemId: string, available: boolean): Promise<boolean>;
  acknowledgeOrder(externalOrderId: string, status: string): Promise<boolean>;
}

export interface PaymentAdapter {
  name: string;
  createPaymentOrder(amount: number, currency: string, reference: string): Promise<{ orderId: string; qrCode?: string }>;
  verifyPayment(paymentId: string, signature: string): Promise<boolean>;
  refund(paymentId: string, amount: number): Promise<boolean>;
}

export interface PrintJob {
  type: "kot" | "bill";
  content: string;
  stationCode?: string;
}

export interface PrinterAdapter {
  print(job: PrintJob): Promise<boolean>;
}

export class MockAggregatorAdapter implements AggregatorAdapter {
  name = "mock_aggregator";

  async pushMenu(_outletId: string, _items: MenuItemPayload[]): Promise<boolean> {
    console.log("[MockAggregator] Menu pushed");
    return true;
  }

  async updateItemAvailability(_outletId: string, itemId: string, available: boolean): Promise<boolean> {
    console.log(`[MockAggregator] Item ${itemId} availability: ${available}`);
    return true;
  }

  async acknowledgeOrder(externalOrderId: string, status: string): Promise<boolean> {
    console.log(`[MockAggregator] Order ${externalOrderId} status: ${status}`);
    return true;
  }
}

export class ZomatoAdapter implements AggregatorAdapter {
  name = "zomato";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async pushMenu(outletId: string, items: MenuItemPayload[]): Promise<boolean> {
    if (!this.apiKey) return false;
    console.log(`[Zomato] Pushing ${items.length} items for outlet ${outletId}`);
    return true;
  }

  async updateItemAvailability(outletId: string, itemId: string, available: boolean): Promise<boolean> {
    if (!this.apiKey) return false;
    console.log(`[Zomato] Outlet ${outletId} item ${itemId}: ${available}`);
    return true;
  }

  async acknowledgeOrder(externalOrderId: string, status: string): Promise<boolean> {
    if (!this.apiKey) return false;
    console.log(`[Zomato] Ack order ${externalOrderId}: ${status}`);
    return true;
  }
}

export class SwiggyAdapter implements AggregatorAdapter {
  name = "swiggy";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async pushMenu(outletId: string, items: MenuItemPayload[]): Promise<boolean> {
    if (!this.apiKey) return false;
    console.log(`[Swiggy] Pushing ${items.length} items for outlet ${outletId}`);
    return true;
  }

  async updateItemAvailability(outletId: string, itemId: string, available: boolean): Promise<boolean> {
    if (!this.apiKey) return false;
    console.log(`[Swiggy] Outlet ${outletId} item ${itemId}: ${available}`);
    return true;
  }

  async acknowledgeOrder(externalOrderId: string, status: string): Promise<boolean> {
    if (!this.apiKey) return false;
    console.log(`[Swiggy] Ack order ${externalOrderId}: ${status}`);
    return true;
  }
}

export class RazorpayAdapter implements PaymentAdapter {
  name = "razorpay";
  private keyId: string;
  private keySecret: string;

  constructor(keyId: string, keySecret: string) {
    this.keyId = keyId;
    this.keySecret = keySecret;
  }

  async createPaymentOrder(amount: number, currency: string, reference: string) {
    if (!this.keyId) {
      return { orderId: `mock_${reference}`, qrCode: `upi://pay?pa=kaana@upi&am=${amount}` };
    }
    console.log(`[Razorpay] Create order ${reference}: ${amount} ${currency}`);
    return { orderId: `order_${reference}`, qrCode: `upi://pay?pa=kaana@upi&am=${amount}` };
  }

  async verifyPayment(paymentId: string, signature: string): Promise<boolean> {
    if (!this.keyId) return true;
    console.log(`[Razorpay] Verify ${paymentId} sig=${signature}`);
    return true;
  }

  async refund(paymentId: string, amount: number): Promise<boolean> {
    console.log(`[Razorpay] Refund ${paymentId}: ${amount}`);
    return true;
  }
}

export class EscPosPrinterAdapter implements PrinterAdapter {
  async print(job: PrintJob): Promise<boolean> {
    console.log(`[ESC/POS] Print ${job.type} for station ${job.stationCode ?? "default"}`);
    return true;
  }
}

export function createAggregatorAdapter(type: string, apiKey = ""): AggregatorAdapter {
  switch (type) {
    case "zomato": return new ZomatoAdapter(apiKey);
    case "swiggy": return new SwiggyAdapter(apiKey);
    default: return new MockAggregatorAdapter();
  }
}
