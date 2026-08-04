import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DiagnosticsService {
  constructor(private prisma: PrismaService) {}

  async createTicket(data: {
    outletId: string; deviceId?: string; subject: string; description: string; logBundle?: Record<string, unknown>;
  }) {
    return this.prisma.supportTicket.create({
      data: {
        outletId: data.outletId,
        deviceId: data.deviceId,
        subject: data.subject,
        description: data.description,
        logBundle: (data.logBundle ?? {}) as never,
      },
    });
  }

  async listTickets(outletId: string) {
    return this.prisma.supportTicket.findMany({
      where: { outletId },
      orderBy: { createdAt: "desc" },
    });
  }

  async resolveTicket(id: string) {
    return this.prisma.supportTicket.update({
      where: { id },
      data: { status: "resolved", resolvedAt: new Date() },
    });
  }

  async getDeviceHealth(outletId: string) {
    const devices = await this.prisma.deviceHealth.findMany({ where: { outletId } });
    return {
      total: devices.length,
      online: devices.filter((d) => d.status === "online").length,
      degraded: devices.filter((d) => d.syncBacklog > 0).length,
      devices,
    };
  }
}
