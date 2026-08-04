"""Kaana Foods Python SDK stub."""
import httpx

class KaanaClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def get_orders(self, outlet_id: str):
        r = httpx.get(f"{self.base_url}/orders", params={"outletId": outlet_id},
                      headers={"Authorization": f"Bearer {self.api_key}"})
        r.raise_for_status()
        return r.json()

    def create_webhook(self, outlet_id: str, url: str, events: list[str]):
        r = httpx.post(f"{self.base_url}/developer/webhooks", params={"outletId": outlet_id},
                       json={"url": url, "events": events},
                       headers={"Authorization": f"Bearer {self.api_key}"})
        r.raise_for_status()
        return r.json()
