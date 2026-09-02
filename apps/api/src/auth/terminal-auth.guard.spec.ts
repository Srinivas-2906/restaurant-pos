import { UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { TerminalAuthGuard } from "./terminal-auth.guard";

describe("TerminalAuthGuard", () => {
  let prisma: { terminal: { findUnique: jest.Mock } };
  let guard: TerminalAuthGuard;

  beforeEach(() => {
    prisma = { terminal: { findUnique: jest.fn() } };
    guard = new TerminalAuthGuard(prisma as never);
  });

  it("accepts valid terminal credentials", async () => {
    const secret = "kaana-demo-terminal-secret";
    const deviceSecretHash = await bcrypt.hash(secret, 10);
    prisma.terminal.findUnique.mockResolvedValue({
      id: "term-1",
      outletId: "outlet-1",
      isActive: true,
      isRegistered: true,
      deviceSecretHash,
      deviceType: "pos",
      outlet: { brand: { organizationId: "org-1" } },
    });

    const request: { headers: { authorization?: string }; terminal?: unknown } = {
      headers: { authorization: `Terminal term-1:${secret}` },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(request.terminal).toEqual(
      expect.objectContaining({ terminalId: "term-1", outletId: "outlet-1" }),
    );
  });

  it("rejects invalid terminal credentials", async () => {
    const deviceSecretHash = await bcrypt.hash("correct-secret", 10);
    prisma.terminal.findUnique.mockResolvedValue({
      id: "term-1",
      outletId: "outlet-1",
      isActive: true,
      isRegistered: true,
      deviceSecretHash,
      deviceType: "pos",
      outlet: { brand: { organizationId: "org-1" } },
    });

    const request = { headers: { authorization: "Terminal term-1:wrong-secret" } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
