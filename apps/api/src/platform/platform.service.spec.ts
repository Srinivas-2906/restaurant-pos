import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PlatformService } from "./platform.service";
import { PrismaService } from "../prisma/prisma.service";
import { CapabilityService } from "../capabilities/capability.service";
import { EventsGateway } from "../events/events.gateway";

describe("PlatformService", () => {
  let service: PlatformService;

  const orgA = {
    id: "org-a",
    name: "Demo",
    slug: "kaana-demo",
    isActive: true,
    operatingMode: "SIMPLE",
    subscriptionPlan: "LEGACY_FULL",
    configVersion: 1,
    moduleOverrides: [],
    featureOverrides: [],
    gstin: null,
    email: null,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    brands: [],
    users: [],
  };

  const tx = {
    organization: {
      update: jest.fn().mockResolvedValue({ configVersion: 2 }),
    },
    restaurantModuleOverride: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    restaurantFeatureOverride: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const prisma = {
    organization: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    deviceHealth: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
  };

  const capabilities = {
    resolveForOrganization: jest.fn(),
    invalidateCache: jest.fn(),
  };

  const events = {
    emitConfigVersion: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    capabilities.resolveForOrganization.mockResolvedValue({
      organizationId: "org-a",
      operatingMode: "SIMPLE",
      subscriptionPlan: "LEGACY_FULL",
      configVersion: 1,
      modules: {
        pos: true,
        kds: true,
        captain: true,
        inventory: true,
        procurement: true,
        payroll: true,
        finance: true,
        crm: true,
        reservations: true,
        reports: true,
        devices: true,
        developer: true,
      },
      features: {},
      navDepth: 1,
    });

    prisma.organization.findUnique.mockImplementation(({ where }: { where: { id?: string } }) => {
      if (where.id === "org-a") return Promise.resolve({ id: "org-a", slug: "kaana-demo", isActive: true });
      if (where.id === "missing") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    prisma.organization.findUniqueOrThrow.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === "org-a") {
        return Promise.resolve(orgA);
      }
      throw new Error("not found");
    });

    prisma.organization.findMany.mockResolvedValue([
      {
        id: "org-a",
        name: "Demo",
        slug: "kaana-demo",
        isActive: true,
        operatingMode: "SIMPLE",
        subscriptionPlan: "LEGACY_FULL",
        configVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        users: [{ id: "u1", email: "owner@test.in", firstName: "Owner", lastName: "", lastLoginAt: null }],
        brands: [{ outlets: [{ id: "o1" }] }],
      },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformService,
        { provide: PrismaService, useValue: prisma },
        { provide: CapabilityService, useValue: capabilities },
        { provide: EventsGateway, useValue: events },
      ],
    }).compile();

    service = module.get(PlatformService);
  });

  it("lists tenants for super admin flow", async () => {
    const rows = await service.listTenants();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Demo");
    expect(rows[0].owner?.email).toBe("owner@test.in");
  });

  it("rejects unknown tenant id", async () => {
    await expect(service.getTenant("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("persists operating mode and increments config version", async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValueOnce(orgA).mockResolvedValueOnce({
      ...orgA,
      operatingMode: "STANDARD",
      configVersion: 2,
    });

    await service.updateTenantConfig("org-a", { operatingMode: "STANDARD" }, "admin-1");

    expect(tx.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "org-a" },
        data: expect.objectContaining({ operatingMode: "STANDARD" }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "organization.mode.updated" }),
        }),
      }),
    );
    expect(events.emitConfigVersion).toHaveBeenCalledWith("org-a", 2);
  });

  it("creates module override audit when disabling kds", async () => {
    await service.updateTenantConfig(
      "org-a",
      { moduleOverrides: [{ moduleKey: "kds", enabled: false }] },
      "admin-1",
    );

    expect(tx.restaurantModuleOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_moduleKey: { organizationId: "org-a", moduleKey: "kds" } },
        create: expect.objectContaining({ enabled: false }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            event: "module.override.updated",
            target: "kds",
          }),
        }),
      }),
    );
  });

  it("removes module override on inherit", async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValueOnce({
      ...orgA,
      moduleOverrides: [{ moduleKey: "kds", enabled: false }],
    });

    await service.updateTenantConfig(
      "org-a",
      { moduleOverrides: [{ moduleKey: "kds", inherit: true }] },
      "admin-1",
    );

    expect(tx.restaurantModuleOverride.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: "org-a", moduleKey: "kds" },
    });
  });

  it("rejects unknown module key", async () => {
    await expect(
      service.updateTenantConfig(
        "org-a",
        { moduleOverrides: [{ moduleKey: "not_real", enabled: false }] },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects unknown feature key", async () => {
    await expect(
      service.updateTenantConfig(
        "org-a",
        { featureOverrides: [{ featureKey: "fake.feature", state: "DISABLED" }] },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects invalid operating mode", async () => {
    await expect(
      service.updateTenantConfig("org-a", { operatingMode: "INVALID" as never }, "admin-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks disabling inventory while procurement is enabled", async () => {
    await expect(
      service.updateTenantConfig(
        "org-a",
        { moduleOverrides: [{ moduleKey: "inventory", enabled: false }] },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("writes feature override audit", async () => {
    await service.updateTenantConfig(
      "org-a",
      { featureOverrides: [{ featureKey: "inventory.stock_transfer", state: "DISABLED" }] },
      "admin-1",
    );

    expect(tx.restaurantFeatureOverride.upsert).toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            event: "feature.override.updated",
            target: "inventory.stock_transfer",
          }),
        }),
      }),
    );
  });
});
