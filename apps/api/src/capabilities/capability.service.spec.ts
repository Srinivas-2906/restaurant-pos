import { Test, TestingModule } from "@nestjs/testing";
import { CapabilityService } from "./capability.service";
import { PrismaService } from "../prisma/prisma.service";

describe("CapabilityService", () => {
  let service: CapabilityService;
  const prisma = {
    organization: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapabilityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CapabilityService);
  });

  it("defaults existing org to LEGACY_FULL modules and features", async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      id: "org1",
      operatingMode: "STANDARD",
      subscriptionPlan: "LEGACY_FULL",
      configVersion: 1,
      moduleOverrides: [],
      featureOverrides: [],
    });

    const resolved = await service.resolveForOrganization("org1");
    expect(resolved.modules.pos).toBe(true);
    expect(resolved.modules.payroll).toBe(true);
    expect(resolved.features["pos.refund"]).toBe(true);
    expect(resolved.navDepth).toBe(2);
  });

  it("applies module override on top of plan defaults", async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      id: "org1",
      operatingMode: "SIMPLE",
      subscriptionPlan: "LEGACY_FULL",
      configVersion: 2,
      moduleOverrides: [{ moduleKey: "payroll", enabled: false }],
      featureOverrides: [],
    });

    const resolved = await service.resolveForOrganization("org1");
    expect(resolved.modules.payroll).toBe(false);
    expect(resolved.navDepth).toBe(1);
  });

  it("requires employee permission for feature act", () => {
    expect(service.canEmployeeAct(["refund_payment"], "pos.refund")).toBe(true);
    expect(service.canEmployeeAct(["take_order"], "pos.refund")).toBe(false);
  });
});
