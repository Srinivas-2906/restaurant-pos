export class KaanaClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  async getOrders(outletId: string) {
    const res = await fetch(`${this.baseUrl}/orders?outletId=${outletId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    return res.json();
  }

  async createWebhook(outletId: string, url: string, events: string[]) {
    const res = await fetch(`${this.baseUrl}/developer/webhooks?outletId=${outletId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ url, events }),
    });
    return res.json();
  }
}
