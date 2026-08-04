import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DeveloperService {
  constructor(private prisma: PrismaService) {}

  async createApiKey(outletId: string, name: string, scopes: string[]) {
    const raw = `kaana_${randomBytes(24).toString("hex")}`;
    const keyHash = createHash("sha256").update(raw).digest("hex");
    await this.prisma.apiKey.create({
      data: { outletId, name, keyHash, keyPrefix: raw.slice(0, 12), scopes },
    });
    return { key: raw, prefix: raw.slice(0, 12), scopes };
  }

  async listApiKeys(outletId: string) {
    return this.prisma.apiKey.findMany({
      where: { outletId },
      select: { id: true, name: true, keyPrefix: true, scopes: true, isActive: true, lastUsedAt: true, createdAt: true },
    });
  }

  async createWebhook(outletId: string, url: string, events: string[]) {
    const secret = randomBytes(16).toString("hex");
    return this.prisma.webhookSubscription.create({
      data: { outletId, url, events, secret },
    });
  }

  async listWebhooks(outletId: string) {
    return this.prisma.webhookSubscription.findMany({ where: { outletId } });
  }

  async deliverWebhook(subscriptionId: string, eventType: string, payload: Record<string, unknown>) {
    const sub = await this.prisma.webhookSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    let statusCode: number | undefined;
    let response: string | undefined;
    let success = false;
    try {
      const res = await fetch(sub.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Kaana-Secret": sub.secret },
        body: JSON.stringify({ event: eventType, data: payload, timestamp: new Date().toISOString() }),
      });
      statusCode = res.status;
      response = await res.text();
      success = res.ok;
    } catch (err) {
      response = err instanceof Error ? err.message : "Delivery failed";
    }
    await this.prisma.webhookDeliveryLog.create({
      data: { subscriptionId, eventType, payload: payload as never, statusCode, response, success },
    });
    return { success, statusCode };
  }

  getSandboxInfo() {
    return {
      baseUrl: "http://localhost:4000/api",
      sandboxOutletId: "sandbox-outlet",
      docs: "/api/docs",
      sdks: { javascript: "@kaana/sdk-js", python: "kaana-sdk" },
    };
  }
}
