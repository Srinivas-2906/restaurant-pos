import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";

describe("AuthService email login", () => {
  let prisma: {
    user: {
      findFirst: jest.Mock;
      update: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
  };
  let audit: { log: jest.Mock };
  let tokens: { issueTokens: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
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
    service = new AuthService(prisma as never, audit as never, tokens as unknown as TokenService);
  });

  it("still logs in active users with email/password", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    prisma.user.findFirst.mockResolvedValue({
      id: "user-1",
      email: "owner@kaanafoods.in",
      passwordHash,
      organizationId: "org-1",
      firstName: "Raj",
      lastName: "Kumar",
      organization: { id: "org-1", name: "Kaana" },
      roleAssignments: [{ outletId: "outlet-1", role: "owner" }],
      staffProfile: null,
    });

    const result = await service.login("owner@kaanafoods.in", "password123");

    expect(result.accessToken).toBe("access-token");
    expect(tokens.issueTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ authMode: "email", sub: "user-1" }),
      }),
    );
  });

  it("blocks email login when staff profile hasLoginAccess is false", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    prisma.user.findFirst.mockResolvedValue({
      id: "user-2",
      email: "floor@kaanafoods.in",
      passwordHash,
      organizationId: "org-1",
      roleAssignments: [],
      staffProfile: { hasLoginAccess: false },
    });

    await expect(service.login("floor@kaanafoods.in", "password123")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("rejects invalid credentials", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.login("bad@kaanafoods.in", "nope")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
