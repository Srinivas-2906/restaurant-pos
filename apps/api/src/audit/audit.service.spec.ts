import { AuditService } from "./audit.service";

describe("AuditService", () => {
  it("strips sensitive keys from metadata", async () => {
    const prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "a1" }),
      },
    };
    const service = new AuditService(prisma as never);

    await service.log({
      organizationId: "org-1",
      action: "login",
      metadata: {
        pin: "1111",
        password: "secret",
        deviceSecret: "dev-secret",
        accessToken: "jwt-token",
        staffProfileId: "staff-1",
      },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: {
            staffProfileId: "staff-1",
          },
        }),
      }),
    );
  });
});
