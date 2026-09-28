import { ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { TerminalsService } from "./terminals.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CapabilityService } from "../capabilities/capability.service";
import { EventsGateway } from "../events/events.gateway";

describe("TerminalsService", () => {
  let service: TerminalsService;

  const orgId = "org-a";
  const outletId = "outlet-a";
  const terminalId = "term-a";

  const prisma = {
    terminal: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    outlet: { findFirst: jest.fn() },
    deviceHealth: { findMany: jest.fn(), upsert: jest.fn() },
  };

  const audit = { log: jest.fn() };
  const capabilities = {
    resolveForOrganization: jest.fn().mockResolvedValue({
      configVersion: 3,
      modules: { pos: true, kds: true, captain: true },
    }),
  };
  const events = { emitDeviceRevoked: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TerminalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: CapabilityService, useValue: capabilities },
        { provide: EventsGateway, useValue: events },
      ],
    }).compile();
    service = module.get(TerminalsService);
  });

  it("creates terminal for owner organization", async () => {
    prisma.outlet.findFirst.mockResolvedValue({ id: outletId });
    prisma.terminal.findUnique.mockResolvedValue(null);
    prisma.terminal.create.mockResolvedValue({
      id: terminalId,
      outletId,
      name: "STEP5-POS",
      code: "POS-001",
      deviceType: "pos",
    });

    const created = await service.createTerminal({
      organizationId: orgId,
      userId: "owner-1",
      outletId,
      name: "STEP5-POS",
      deviceType: "pos",
    });

    expect(created.name).toBe("STEP5-POS");
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ event: "device.created" }),
      }),
    );
  });

  it("denies cross-tenant terminal access", async () => {
    prisma.terminal.findUnique.mockResolvedValue({
      id: terminalId,
      outlet: { brand: { organizationId: "other-org" }, id: outletId },
      outletId,
    });

    await expect(
      service.generateActivationCode(terminalId, orgId, "owner-1"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("generates activation code with display format", async () => {
    prisma.terminal.findUnique.mockResolvedValue({
      id: terminalId,
      outletId,
      deviceType: "pos",
      outlet: { brand: { organizationId: orgId } },
    });
    prisma.terminal.update.mockResolvedValue({});

    const result = await service.generateActivationCode(terminalId, orgId, "owner-1");
    expect(result.activationCodeDisplay).toMatch(/^[A-F0-9]{4}-\d{4}$/);
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it("redeems valid activation code once", async () => {
    prisma.terminal.findFirst.mockResolvedValue({
      id: terminalId,
      name: "STEP5-POS",
      code: "POS-999",
      deviceType: "pos",
      outletId,
      settings: {},
      activationCode: "ABCD1234",
      activationCodeExpiresAt: new Date(Date.now() + 60_000),
      outlet: { brand: { organizationId: orgId } },
    });
    prisma.terminal.update.mockResolvedValue({});
    prisma.deviceHealth.upsert.mockResolvedValue({});

    const result = await service.redeemActivationCode("ABCD-1234", "device-1", {
      appVersion: "1.0.0",
      platform: "web",
    });

    expect(result.deviceCredential).toHaveLength(64);
    expect(result.configVersion).toBe(3);
    expect(prisma.terminal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ activationCode: null }),
      }),
    );
  });

  it("denies expired activation code", async () => {
    prisma.terminal.findFirst.mockResolvedValue(null);
    await expect(service.redeemActivationCode("EXPIRED1", "device-1")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("denies second use of activation code", async () => {
    prisma.terminal.findFirst
      .mockResolvedValueOnce({
        id: terminalId,
        name: "STEP5-POS",
        code: "POS-999",
        deviceType: "pos",
        outletId,
        settings: {},
        outlet: { brand: { organizationId: orgId } },
      })
      .mockResolvedValueOnce(null);
    prisma.terminal.update.mockResolvedValue({});
    prisma.deviceHealth.upsert.mockResolvedValue({});

    await service.redeemActivationCode("ABCD1234", "device-1");
    await expect(service.redeemActivationCode("ABCD1234", "device-2")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rotates credential on reactivation after revoke", async () => {
    prisma.terminal.findUnique.mockResolvedValue({
      id: terminalId,
      outletId,
      code: "POS-001",
      deviceType: "pos",
      outlet: { brand: { organizationId: orgId } },
    });
    prisma.terminal.update.mockResolvedValue({});

    await service.revokeTerminal(terminalId, orgId, "owner-1");
    expect(prisma.terminal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deviceSecretHash: null,
          revokedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("denies invalid activation code", async () => {
    prisma.terminal.findFirst.mockResolvedValue(null);
    await expect(service.redeemActivationCode("BADCODE", "device-1")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("revokes terminal and emits event", async () => {
    prisma.terminal.findUnique.mockResolvedValue({
      id: terminalId,
      outletId,
      code: "POS-001",
      deviceType: "pos",
      outlet: { brand: { organizationId: orgId } },
    });
    prisma.terminal.update.mockResolvedValue({});

    const result = await service.revokeTerminal(terminalId, orgId, "owner-1");
    expect(result.revoked).toBe(true);
    expect(events.emitDeviceRevoked).toHaveBeenCalledWith(orgId, terminalId);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "device_revoked" }),
    );
  });

  it("blocks activation when module disabled", async () => {
    capabilities.resolveForOrganization.mockResolvedValueOnce({
      configVersion: 1,
      modules: { pos: false, kds: true, captain: true },
    });
    prisma.terminal.findFirst.mockResolvedValue({
      id: terminalId,
      name: "POS",
      code: "POS-001",
      deviceType: "pos",
      outletId,
      settings: {},
      outlet: { brand: { organizationId: orgId } },
    });

    await expect(service.redeemActivationCode("ABCD1234", "device-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("blocks create when kds module disabled", async () => {
    capabilities.resolveForOrganization.mockResolvedValueOnce({
      configVersion: 1,
      modules: { pos: true, kds: false, captain: true },
    });
    prisma.outlet.findFirst.mockResolvedValue({ id: outletId });

    await expect(
      service.createTerminal({
        organizationId: orgId,
        userId: "owner-1",
        outletId,
        name: "Kitchen 1",
        deviceType: "kds",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
