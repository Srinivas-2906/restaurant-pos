"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscPosPrinterAdapter = exports.RazorpayAdapter = exports.SwiggyAdapter = exports.ZomatoAdapter = exports.MockAggregatorAdapter = void 0;
exports.createAggregatorAdapter = createAggregatorAdapter;
class MockAggregatorAdapter {
    name = "mock_aggregator";
    async pushMenu(_outletId, _items) {
        console.log("[MockAggregator] Menu pushed");
        return true;
    }
    async updateItemAvailability(_outletId, itemId, available) {
        console.log(`[MockAggregator] Item ${itemId} availability: ${available}`);
        return true;
    }
    async acknowledgeOrder(externalOrderId, status) {
        console.log(`[MockAggregator] Order ${externalOrderId} status: ${status}`);
        return true;
    }
}
exports.MockAggregatorAdapter = MockAggregatorAdapter;
class ZomatoAdapter {
    name = "zomato";
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async pushMenu(outletId, items) {
        if (!this.apiKey)
            return false;
        console.log(`[Zomato] Pushing ${items.length} items for outlet ${outletId}`);
        return true;
    }
    async updateItemAvailability(outletId, itemId, available) {
        if (!this.apiKey)
            return false;
        console.log(`[Zomato] Outlet ${outletId} item ${itemId}: ${available}`);
        return true;
    }
    async acknowledgeOrder(externalOrderId, status) {
        if (!this.apiKey)
            return false;
        console.log(`[Zomato] Ack order ${externalOrderId}: ${status}`);
        return true;
    }
}
exports.ZomatoAdapter = ZomatoAdapter;
class SwiggyAdapter {
    name = "swiggy";
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async pushMenu(outletId, items) {
        if (!this.apiKey)
            return false;
        console.log(`[Swiggy] Pushing ${items.length} items for outlet ${outletId}`);
        return true;
    }
    async updateItemAvailability(outletId, itemId, available) {
        if (!this.apiKey)
            return false;
        console.log(`[Swiggy] Outlet ${outletId} item ${itemId}: ${available}`);
        return true;
    }
    async acknowledgeOrder(externalOrderId, status) {
        if (!this.apiKey)
            return false;
        console.log(`[Swiggy] Ack order ${externalOrderId}: ${status}`);
        return true;
    }
}
exports.SwiggyAdapter = SwiggyAdapter;
class RazorpayAdapter {
    name = "razorpay";
    keyId;
    keySecret;
    constructor(keyId, keySecret) {
        this.keyId = keyId;
        this.keySecret = keySecret;
    }
    async createPaymentOrder(amount, currency, reference) {
        if (!this.keyId) {
            return { orderId: `mock_${reference}`, qrCode: `upi://pay?pa=kaana@upi&am=${amount}` };
        }
        console.log(`[Razorpay] Create order ${reference}: ${amount} ${currency}`);
        return { orderId: `order_${reference}`, qrCode: `upi://pay?pa=kaana@upi&am=${amount}` };
    }
    async verifyPayment(paymentId, signature) {
        if (!this.keyId)
            return true;
        console.log(`[Razorpay] Verify ${paymentId} sig=${signature}`);
        return true;
    }
    async refund(paymentId, amount) {
        console.log(`[Razorpay] Refund ${paymentId}: ${amount}`);
        return true;
    }
}
exports.RazorpayAdapter = RazorpayAdapter;
class EscPosPrinterAdapter {
    async print(job) {
        console.log(`[ESC/POS] Print ${job.type} for station ${job.stationCode ?? "default"}`);
        return true;
    }
}
exports.EscPosPrinterAdapter = EscPosPrinterAdapter;
function createAggregatorAdapter(type, apiKey = "") {
    switch (type) {
        case "zomato": return new ZomatoAdapter(apiKey);
        case "swiggy": return new SwiggyAdapter(apiKey);
        default: return new MockAggregatorAdapter();
    }
}
//# sourceMappingURL=index.js.map