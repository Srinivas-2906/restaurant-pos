import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OperationalSessionGuard } from "./operational-session.guard";

describe("OperationalSessionGuard", () => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
  let prisma: {
    terminal: { findUnique: jest.Mock };
    staffProfile: { findUnique: jest.Mock };
  };
  let guard: OperationalSessionGuard;

  beforeEach(() => {
    prisma = {
      terminal: { findUnique: jest.fn() },
      staffProfile: { findUnique: jest.fn() },
    };
    guard = new OperationalSessionGuard(prisma as never, reflector);
  });

  it("allows email auth without terminal lookup", async () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { authMode: "email", userId: "u1" } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
    expect(prisma.terminal.findUnique).not.toHaveBeenCalled();
  });

  it("rejects operational JWT when terminal is revoked", async () => {
    prisma.terminal.findUnique.mockResolvedValue({
      isActive: true,
      revokedAt: new Date(),
      outletId: "out-1",
    });

    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            authMode: "operational",
            terminalId: "term-1",
            staffProfileId: "staff-1",
            outletId: "out-1",
          },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects operational JWT when staff is inactive", async () => {
    prisma.terminal.findUnique.mockResolvedValue({
      isActive: true,
      revokedAt: null,
      outletId: "out-1",
    });
    prisma.staffProfile.findUnique.mockResolvedValue({ isActive: false });

    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            authMode: "operational",
            terminalId: "term-1",
            staffProfileId: "staff-1",
            outletId: "out-1",
          },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects operational JWT when terminal outlet mismatches", async () => {
    prisma.terminal.findUnique.mockResolvedValue({
      isActive: true,
      revokedAt: null,
      outletId: "out-other",
    });

    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            authMode: "operational",
            terminalId: "term-1",
            staffProfileId: "staff-1",
            outletId: "out-1",
          },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
