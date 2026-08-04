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
    customer?: {
        name?: string;
        phone?: string;
    };
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
    createPaymentOrder(amount: number, currency: string, reference: string): Promise<{
        orderId: string;
        qrCode?: string;
    }>;
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
export declare class MockAggregatorAdapter implements AggregatorAdapter {
    name: string;
    pushMenu(_outletId: string, _items: MenuItemPayload[]): Promise<boolean>;
    updateItemAvailability(_outletId: string, itemId: string, available: boolean): Promise<boolean>;
    acknowledgeOrder(externalOrderId: string, status: string): Promise<boolean>;
}
export declare class ZomatoAdapter implements AggregatorAdapter {
    name: string;
    private apiKey;
    constructor(apiKey: string);
    pushMenu(outletId: string, items: MenuItemPayload[]): Promise<boolean>;
    updateItemAvailability(outletId: string, itemId: string, available: boolean): Promise<boolean>;
    acknowledgeOrder(externalOrderId: string, status: string): Promise<boolean>;
}
export declare class SwiggyAdapter implements AggregatorAdapter {
    name: string;
    private apiKey;
    constructor(apiKey: string);
    pushMenu(outletId: string, items: MenuItemPayload[]): Promise<boolean>;
    updateItemAvailability(outletId: string, itemId: string, available: boolean): Promise<boolean>;
    acknowledgeOrder(externalOrderId: string, status: string): Promise<boolean>;
}
export declare class RazorpayAdapter implements PaymentAdapter {
    name: string;
    private keyId;
    private keySecret;
    constructor(keyId: string, keySecret: string);
    createPaymentOrder(amount: number, currency: string, reference: string): Promise<{
        orderId: string;
        qrCode: string;
    }>;
    verifyPayment(paymentId: string, signature: string): Promise<boolean>;
    refund(paymentId: string, amount: number): Promise<boolean>;
}
export declare class EscPosPrinterAdapter implements PrinterAdapter {
    print(job: PrintJob): Promise<boolean>;
}
export declare function createAggregatorAdapter(type: string, apiKey?: string): AggregatorAdapter;
