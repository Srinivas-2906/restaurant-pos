import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { DeviceHeartbeat } from "@kaana/sync-protocol";

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async register(data: {
    deviceId: string;
    outletId: string;
    terminalId?: string;
    role: string;
    deviceType: string;
    name: string;
    lanAddress?: string;
  }) {
    return this.prisma.deviceHealth.upsert({
      where: { deviceId: data.deviceId },
      create: {
        deviceId: data.deviceId,
        outletId: data.outletId,
        terminalId: data.terminalId,
        role: data.role,
        deviceType: data.deviceType,
        name: data.name,
        lanAddress: data.lanAddress,
        status: "online",
        lastSeenAt: new Date(),
      },
      update: {
        name: data.name,
        lanAddress: data.lanAddress,
        status: "online",
        lastSeenAt: new Date(),
      },
    });
  }

  async heartbeat(data: DeviceHeartbeat) {
    return this.prisma.deviceHealth.upsert({
      where: { deviceId: data.deviceId },
      create: {
        deviceId: data.deviceId,
        outletId: data.outletId,
        status: data.status,
        syncBacklog: data.syncBacklog,
        hubConnected: data.hubConnected,
        cloudConnected: data.cloudConnected,
        lastSeenAt: new Date(),
        lastSyncAt: data.lastSyncAt ? new Date(data.lastSyncAt) : undefined,
        metadata: (data.metadata ?? {}) as never,
        role: "unknown",
        deviceType: "unknown",
        name: data.deviceId,
      },
      update: {
        status: data.status,
        syncBacklog: data.syncBacklog,
        hubConnected: data.hubConnected,
        cloudConnected: data.cloudConnected,
        lastSeenAt: new Date(),
        lastSyncAt: data.lastSyncAt ? new Date(data.lastSyncAt) : undefined,
        metadata: (data.metadata ?? {}) as never,
      },
    });
  }

  async findByOutlet(outletId: string) {
    return this.prisma.deviceHealth.findMany({ where: { outletId }, orderBy: { lastSeenAt: "desc" } });
  }

  async findUnsynced(outletId?: string) {
    return this.prisma.deviceHealth.findMany({
      where: {
        ...(outletId ? { outletId } : {}),
        syncBacklog: { gt: 0 },
      },
    });
  }

  async getHealthDashboard(organizationId: string) {
    const outlets = await this.prisma.outlet.findMany({
      where: { brand: { organizationId } },
      select: { id: true, name: true },
    });
    const outletIds = outlets.map((o) => o.id);
    const devices = await this.prisma.deviceHealth.findMany({
      where: { outletId: { in: outletIds } },
    });
    return {
      totalDevices: devices.length,
      online: devices.filter((d) => d.status === "online").length,
      unsynced: devices.filter((d) => d.syncBacklog > 0).length,
      devices,
    };
  }
}
