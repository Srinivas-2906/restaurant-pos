import {

  BadRequestException,

  ForbiddenException,

  Injectable,

  NotFoundException,

  UnauthorizedException,

} from "@nestjs/common";

import type { ModuleKey } from "@kaana/shared-types";

import * as bcrypt from "bcryptjs";

import { randomBytes, randomInt } from "crypto";

import { PrismaService } from "../prisma/prisma.service";

import { AuditService } from "../audit/audit.service";

import { CapabilityService } from "../capabilities/capability.service";

import { EventsGateway } from "../events/events.gateway";



const ACTIVATION_TTL_MS = 15 * 60 * 1000;



const DEVICE_TYPE_MODULE: Record<string, ModuleKey> = {

  pos: "pos",

  kds: "kds",

  captain: "captain",

};



@Injectable()

export class TerminalsService {

  constructor(

    private prisma: PrismaService,

    private audit: AuditService,

    private capabilities: CapabilityService,

    private events: EventsGateway,

  ) {}



  async listForOrganization(organizationId: string) {

    const terminals = await this.prisma.terminal.findMany({

      where: { outlet: { brand: { organizationId } } },

      orderBy: [{ outletId: "asc" }, { code: "asc" }],

      include: {

        outlet: { select: { id: true, name: true, code: true } },

      },

    });



    const terminalIds = terminals.map((t) => t.id);

    const healthRows = terminalIds.length

      ? await this.prisma.deviceHealth.findMany({

          where: { terminalId: { in: terminalIds } },

        })

      : [];

    const healthByTerminal = new Map(

      healthRows.filter((h) => h.terminalId).map((h) => [h.terminalId!, h]),

    );



    return terminals.map((terminal) => {

      const health = healthByTerminal.get(terminal.id);

      const metadata = (health?.metadata ?? {}) as Record<string, unknown>;

      return {

        id: terminal.id,

        name: terminal.name,

        code: terminal.code,

        deviceType: terminal.deviceType,

        outletId: terminal.outletId,

        outlet: terminal.outlet,

        isActive: terminal.isActive,

        isRegistered: terminal.isRegistered,

        revokedAt: terminal.revokedAt,

        registeredAt: terminal.registeredAt,

        hasPendingActivationCode: Boolean(

          terminal.activationCode && terminal.activationCodeExpiresAt && terminal.activationCodeExpiresAt > new Date(),

        ),

        activationCodeExpiresAt: terminal.activationCodeExpiresAt,

        status: this.deriveStatus(terminal, health),

        lastSeenAt: health?.lastSeenAt ?? null,

        appVersion: (metadata.appVersion as string | undefined) ?? null,

        healthStatus: health?.status ?? "unknown",

      };

    });

  }



  async createTerminal(input: {

    organizationId: string;

    userId: string;

    outletId: string;

    name: string;

    deviceType: "pos" | "kds" | "captain";

    code?: string;

  }) {

    await this.assertOutletInOrganization(input.outletId, input.organizationId);

    await this.assertDeviceTypeAllowed(input.organizationId, input.deviceType);



    const code =

      input.code?.trim().toUpperCase() ||

      (await this.generateUniqueTerminalCode(input.outletId, input.deviceType));



    const existing = await this.prisma.terminal.findUnique({

      where: { outletId_code: { outletId: input.outletId, code } },

    });

    if (existing) {

      throw new BadRequestException(`Terminal code ${code} already exists for this outlet`);

    }



    const terminal = await this.prisma.terminal.create({

      data: {

        outletId: input.outletId,

        name: input.name.trim(),

        code,

        deviceType: input.deviceType,

        isActive: true,

        isRegistered: false,

        deviceSecretHash: null,

      },

      include: { outlet: { select: { id: true, name: true, code: true } } },

    });



    await this.audit.log({

      organizationId: input.organizationId,

      userId: input.userId,

      outletId: input.outletId,

      action: "platform_config",

      entityType: "terminal",

      entityId: terminal.id,

      metadata: {

        event: "device.created",

        name: terminal.name,

        code: terminal.code,

        deviceType: terminal.deviceType,

      },

    });



    return terminal;

  }



  async registerTerminal(terminalId: string, organizationId: string, userId: string) {

    const terminal = await this.getTerminalForOrganization(terminalId, organizationId);

    if (!terminal.isActive) throw new BadRequestException("Terminal is inactive");

    if (terminal.revokedAt) throw new BadRequestException("Terminal is revoked — generate a new activation code");



    const deviceSecret = randomBytes(32).toString("hex");

    const deviceSecretHash = await bcrypt.hash(deviceSecret, 10);



    const updated = await this.prisma.terminal.update({

      where: { id: terminalId },

      data: {

        isRegistered: true,

        deviceSecretHash,

        registeredAt: new Date(),

        registeredByUserId: userId,

        revokedAt: null,

      },

      include: { outlet: { select: { id: true, name: true, code: true } } },

    });



    return {

      terminal: {

        id: updated.id,

        name: updated.name,

        code: updated.code,

        deviceType: updated.deviceType,

        outlet: updated.outlet,

      },

      deviceSecret,

    };

  }



  async generateActivationCode(terminalId: string, organizationId: string, userId: string) {

    const terminal = await this.getTerminalForOrganization(terminalId, organizationId);

    await this.assertDeviceTypeAllowed(organizationId, terminal.deviceType);



    const rawCode = this.buildActivationCode();

    const expiresAt = new Date(Date.now() + ACTIVATION_TTL_MS);



    await this.prisma.terminal.update({

      where: { id: terminalId },

      data: {

        activationCode: rawCode,

        activationCodeExpiresAt: expiresAt,

        revokedAt: null,

        isActive: true,

      },

    });



    await this.audit.log({

      organizationId,

      userId,

      outletId: terminal.outletId,

      action: "platform_config",

      entityType: "terminal",

      entityId: terminalId,

      metadata: {

        event: "device.activation_code_generated",

        expiresAt: expiresAt.toISOString(),

      },

    });



    return {

      terminalId,

      activationCode: rawCode,

      activationCodeDisplay: this.formatActivationCode(rawCode),

      expiresAt,

    };

  }



  async cancelActivationCode(terminalId: string, organizationId: string, userId: string) {

    const terminal = await this.getTerminalForOrganization(terminalId, organizationId);

    await this.prisma.terminal.update({

      where: { id: terminalId },

      data: { activationCode: null, activationCodeExpiresAt: null },

    });



    await this.audit.log({

      organizationId,

      userId,

      outletId: terminal.outletId,

      action: "platform_config",

      entityType: "terminal",

      entityId: terminalId,

      metadata: { event: "device.activation_code_cancelled" },

    });



    return { cancelled: true, terminalId };

  }



  async redeemActivationCode(

    code: string,

    deviceId: string,

    deviceMetadata?: Record<string, unknown>,

  ) {

    const normalized = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

    const terminal = await this.prisma.terminal.findFirst({

      where: {

        activationCode: normalized,

        isActive: true,

        revokedAt: null,

        activationCodeExpiresAt: { gt: new Date() },

      },

      include: { outlet: { include: { brand: true } } },

    });

    if (!terminal) throw new UnauthorizedException("Invalid or expired activation code");



    await this.assertDeviceTypeAllowed(terminal.outlet.brand.organizationId, terminal.deviceType);



    const deviceSecret = randomBytes(32).toString("hex");

    const deviceSecretHash = await bcrypt.hash(deviceSecret, 10);

    const organizationId = terminal.outlet.brand.organizationId;



    await this.prisma.terminal.update({

      where: { id: terminal.id },

      data: {

        isRegistered: true,

        deviceSecretHash,

        registeredAt: new Date(),

        registeredByUserId: null,

        activationCode: null,

        activationCodeExpiresAt: null,

        revokedAt: null,

        settings: {
          ...(terminal.settings as Record<string, unknown>),
          lastDeviceId: deviceId,
          lastActivatedAt: new Date().toISOString(),
          clientMetadata: deviceMetadata ?? {},
        } as never,

      },

    });



    const capabilities = await this.capabilities.resolveForOrganization(organizationId);



    await this.prisma.deviceHealth.upsert({

      where: { deviceId },

      create: {

        deviceId,

        outletId: terminal.outletId,

        terminalId: terminal.id,

        role: terminal.deviceType,

        deviceType: terminal.deviceType,

        name: terminal.name,

        status: "online",

        lastSeenAt: new Date(),

        metadata: {

          appVersion: deviceMetadata?.appVersion,

          platform: deviceMetadata?.platform,

          osVersion: deviceMetadata?.osVersion,

        } as never,

      },

      update: {

        outletId: terminal.outletId,

        terminalId: terminal.id,

        role: terminal.deviceType,

        deviceType: terminal.deviceType,

        name: terminal.name,

        status: "online",

        lastSeenAt: new Date(),

        metadata: {

          appVersion: deviceMetadata?.appVersion,

          platform: deviceMetadata?.platform,

          osVersion: deviceMetadata?.osVersion,

        } as never,

      },

    });



    await this.audit.log({

      organizationId,

      outletId: terminal.outletId,

      action: "platform_config",

      entityType: "terminal",

      entityId: terminal.id,

      metadata: {

        event: "device.activated",

        deviceId,

        deviceType: terminal.deviceType,

      },

    });



    return {

      terminalId: terminal.id,

      organizationId,

      outletId: terminal.outletId,

      deviceMode: terminal.deviceType,

      deviceName: terminal.name,

      deviceCode: terminal.code,

      deviceCredential: deviceSecret,

      configVersion: capabilities.configVersion,

      apiBaseUrl: process.env.PUBLIC_API_URL ?? "http://localhost:4000/api",

    };

  }



  async revokeTerminal(terminalId: string, organizationId: string, userId: string) {

    const terminal = await this.getTerminalForOrganization(terminalId, organizationId);



    await this.prisma.terminal.update({

      where: { id: terminalId },

      data: {

        isRegistered: false,

        deviceSecretHash: null,

        activationCode: null,

        activationCodeExpiresAt: null,

        revokedAt: new Date(),

      },

    });



    await this.audit.log({

      organizationId,

      userId,

      outletId: terminal.outletId,

      action: "device_revoked",

      entityType: "terminal",

      entityId: terminalId,

      metadata: { event: "device.revoked", code: terminal.code, deviceType: terminal.deviceType },

    });



    this.events.emitDeviceRevoked(organizationId, terminalId);



    return { revoked: true, terminalId };

  }



  async recordHeartbeat(

    terminal: { terminalId: string; outletId: string; organizationId: string; deviceType: string },

    body: { deviceId?: string; appVersion?: string; platform?: string; osVersion?: string; status?: string },

  ) {

    const deviceId = body.deviceId ?? `terminal:${terminal.terminalId}`;

    const terminalRow = await this.prisma.terminal.findUniqueOrThrow({

      where: { id: terminal.terminalId },

      select: { name: true, deviceType: true },

    });



    return this.prisma.deviceHealth.upsert({

      where: { deviceId },

      create: {

        deviceId,

        outletId: terminal.outletId,

        terminalId: terminal.terminalId,

        role: terminalRow.deviceType,

        deviceType: terminalRow.deviceType,

        name: terminalRow.name,

        status: body.status ?? "online",

        lastSeenAt: new Date(),

        metadata: {

          appVersion: body.appVersion,

          platform: body.platform,

          osVersion: body.osVersion,

        } as never,

      },

      update: {

        status: body.status ?? "online",

        lastSeenAt: new Date(),

        metadata: {

          appVersion: body.appVersion,

          platform: body.platform,

          osVersion: body.osVersion,

        } as never,

      },

    });

  }



  private deriveStatus(

    terminal: { isRegistered: boolean; revokedAt: Date | null; activationCode: string | null; activationCodeExpiresAt: Date | null },

    health: { lastSeenAt: Date | null; status: string } | undefined,

  ): "active" | "waiting_activation" | "revoked" | "offline" | "online" {

    if (terminal.revokedAt) return "revoked";

    if (

      terminal.activationCode &&

      terminal.activationCodeExpiresAt &&

      terminal.activationCodeExpiresAt > new Date()

    ) {

      return "waiting_activation";

    }

    if (!terminal.isRegistered) return "waiting_activation";

    if (health?.status === "online") return "online";

    if (health?.lastSeenAt) {

      const ageMs = Date.now() - health.lastSeenAt.getTime();

      if (ageMs < 5 * 60 * 1000) return "online";

      if (ageMs < 30 * 60 * 1000) return "offline";

    }

    return "active";

  }



  private async getTerminalForOrganization(terminalId: string, organizationId: string) {

    const terminal = await this.prisma.terminal.findUnique({

      where: { id: terminalId },

      include: { outlet: { include: { brand: true } } },

    });

    if (!terminal) throw new NotFoundException("Terminal not found");

    if (terminal.outlet.brand.organizationId !== organizationId) {

      throw new UnauthorizedException("Terminal not in your organization");

    }

    return terminal;

  }



  private async assertOutletInOrganization(outletId: string, organizationId: string) {

    const outlet = await this.prisma.outlet.findFirst({

      where: { id: outletId, brand: { organizationId } },

      select: { id: true },

    });

    if (!outlet) throw new NotFoundException("Outlet not found");

  }



  private async assertDeviceTypeAllowed(organizationId: string, deviceType: string) {

    const moduleKey = DEVICE_TYPE_MODULE[deviceType];

    if (!moduleKey) return;

    const caps = await this.capabilities.resolveForOrganization(organizationId);

    if (caps.modules[moduleKey] === false) {

      throw new ForbiddenException(`${deviceType.toUpperCase()} devices are not enabled for this restaurant`);

    }

  }



  private buildActivationCode() {

    const letters = randomBytes(2).toString("hex").toUpperCase().slice(0, 4);

    const digits = String(randomInt(1000, 9999));

    return `${letters}${digits}`;

  }



  formatActivationCode(code: string) {

    const normalized = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

    if (normalized.length <= 4) return normalized;

    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;

  }



  private async generateUniqueTerminalCode(outletId: string, deviceType: string) {

    const prefix = deviceType.toUpperCase().slice(0, 3);

    for (let attempt = 0; attempt < 20; attempt++) {

      const suffix = String(randomInt(1, 999)).padStart(3, "0");

      const code = `${prefix}-${suffix}`;

      const existing = await this.prisma.terminal.findUnique({

        where: { outletId_code: { outletId, code } },

      });

      if (!existing) return code;

    }

    throw new BadRequestException("Could not allocate terminal code");

  }

}


