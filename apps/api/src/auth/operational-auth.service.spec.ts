import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { OperationalAuthService } from "./operational-auth.service";
import { TokenService } from "./token.service";

describe("OperationalAuthService", () => {
  const terminal = {
    terminalId: "term-1",
    outletId: "outlet-1",
    organizationId: "org-1",
    deviceType: "pos",
  };

  let prisma: {
    staffProfile: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    staffRoleAssignment: {
      findMany: jest.Mock;
    };
    terminal: {
      findUniqueOrThrow: jest.Mock;
    };
  };
  let audit: { log: jest.Mock };
  let tokens: { issueTokens: jest.Mock };
  let capabilities: { resolveForOrganization: jest.Mock };
  let service: OperationalAuthService;

  beforeEach(() => {
    prisma = {
      staffProfile: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      staffRoleAssignment: {
        findMany: jest.fn(),
      },
      terminal: {
        findUniqueOrThrow: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    tokens = {
      issueTokens: jest.fn().mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      }),
    };
    capabilities = {
      resolveForOrganization: jest.fn().mockResolvedValue({
        organizationId: "org-1",
        operatingMode: "STANDARD",
        subscriptionPlan: "LEGACY_FULL",
        configVersion: 1,
        modules: { pos: true },
        features: {},
        navDepth: 2,
      }),
    };
    service = new OperationalAuthService(
      prisma as never,
      audit as never,
      tokens as unknown as TokenService,
      capabilities as never,
    );
  });

  it("issues operational JWT on valid terminal staff and PIN", async () => {
    const pinHash = await bcrypt.hash("4821", 10);
    prisma.staffProfile.findFirst.mockResolvedValue({
      id: "staff-1",
      userId: "user-1",
      organizationId: "org-1",
      outletId: "outlet-1",
      pinHash,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      displayName: "Biller User",
      firstName: "Biller",
      lastName: "User",
      employeeCode: "EMP-001",
      outletAssignments: [],
      staffRoleAssignments: [{ role: "biller", permissions: [] }],
    });

    const result = await service.pinLogin(terminal, "staff-1", "4821");

    expect(result.accessToken).toBe("access-token");
    expect(tokens.issueTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          authMode: "operational",
          staffProfileId: "staff-1",
          role: "biller",
        }),
        refreshUserId: "user-1",
      }),
    );
  });

  it("rejects wrong PIN with generic unauthorized error", async () => {
    const pinHash = await bcrypt.hash("4821", 10);
    prisma.staffProfile.findFirst.mockResolvedValue({
      id: "staff-1",
      userId: null,
      organizationId: "org-1",
      outletId: "outlet-1",
      pinHash,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      outletAssignments: [],
      staffRoleAssignments: [{ role: "biller", permissions: [] }],
    });

    await expect(service.pinLogin(terminal, "staff-1", "0000")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.staffProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pinFailedAttempts: 1 }),
      }),
    );
  });

  it("rejects staff without access_pos", async () => {
    const pinHash = await bcrypt.hash("4821", 10);
    prisma.staffProfile.findFirst.mockResolvedValue({
      id: "staff-chef",
      userId: "user-chef",
      organizationId: "org-1",
      outletId: "outlet-1",
      pinHash,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      outletAssignments: [],
      staffRoleAssignments: [{ role: "chef", permissions: [] }],
    });

    await expect(service.pinLogin(terminal, "staff-chef", "4821")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("allows chef on kds terminal", async () => {
    const kdsTerminal = { ...terminal, deviceType: "kds" };
    const pinHash = await bcrypt.hash("3333", 10);
    prisma.staffProfile.findFirst.mockResolvedValue({
      id: "staff-chef",
      userId: "user-chef",
      organizationId: "org-1",
      outletId: "outlet-1",
      pinHash,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      displayName: "Chef",
      firstName: "Demo",
      lastName: "Chef",
      employeeCode: "EMP003",
      outletAssignments: [],
      staffRoleAssignments: [{ role: "chef", permissions: [] }],
    });
    prisma.staffProfile.update.mockResolvedValue({});

    const result = await service.pinLogin(kdsTerminal, "staff-chef", "3333");
    expect(result.accessToken).toBe("access-token");
  });

  it("denies biller on kds terminal", async () => {
    const kdsTerminal = { ...terminal, deviceType: "kds" };
    const pinHash = await bcrypt.hash("1111", 10);
    prisma.staffProfile.findFirst.mockResolvedValue({
      id: "staff-biller",
      userId: "user-biller",
      organizationId: "org-1",
      outletId: "outlet-1",
      pinHash,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      outletAssignments: [],
      staffRoleAssignments: [{ role: "biller", permissions: [] }],
    });

    await expect(service.pinLogin(kdsTerminal, "staff-biller", "1111")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("denies staff assigned to a different outlet", async () => {
    const pinHash = await bcrypt.hash("1111", 10);
    prisma.staffProfile.findFirst.mockResolvedValue({
      id: "staff-other",
      userId: "user-other",
      organizationId: "org-1",
      outletId: "other-outlet",
      pinHash,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      outletAssignments: [],
      staffRoleAssignments: [{ role: "biller", permissions: [] }],
    });

    await expect(service.pinLogin(terminal, "staff-other", "1111")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects inactive or missing staff", async () => {
    prisma.staffProfile.findFirst.mockResolvedValue(null);
    await expect(service.pinLogin(terminal, "missing", "4821")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
