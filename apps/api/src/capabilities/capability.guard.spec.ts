import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CapabilityGuard, REQUIRE_MODULE_KEY } from "./capability.guard";
import { CapabilityService } from "./capability.service";

describe("CapabilityGuard", () => {
  const capabilities = {
    resolveForOrganization: jest.fn(),
  };
  const config = { get: jest.fn((key: string, defaultValue?: string) => defaultValue) };
  let guard: CapabilityGuard;
  let reflector: Reflector;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = new Reflector();
    config.get.mockImplementation((_key: string, defaultValue?: string) => defaultValue ?? "true");
    guard = new CapabilityGuard(
      reflector,
      capabilities as unknown as CapabilityService,
      config as never,
    );
    delete process.env.CAPABILITY_ENFORCEMENT;
  });

  function contextFor(user: object) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as never;
  }

  it("allows when enforcement is disabled", async () => {
    config.get.mockReturnValue("false");
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue("kds");
    await expect(
      guard.canActivate(contextFor({ organizationId: "org-1" })),
    ).resolves.toBe(true);
    expect(capabilities.resolveForOrganization).not.toHaveBeenCalled();
  });

  it("denies KDS queue when kds module is disabled", async () => {
    config.get.mockReturnValue("true");
    jest.spyOn(reflector, "getAllAndOverride").mockImplementation((key) => {
      if (key === REQUIRE_MODULE_KEY) return "kds";
      return undefined;
    });
    capabilities.resolveForOrganization.mockResolvedValue({
      modules: { kds: false, pos: true },
      features: {},
    });

    await expect(
      guard.canActivate(contextFor({ organizationId: "org-1", permissions: ["access_kds"] })),
    ).rejects.toThrow(new ForbiddenException("Module not enabled: kds"));
  });

  it("allows KDS when kds module is enabled", async () => {
    config.get.mockReturnValue("true");
    jest.spyOn(reflector, "getAllAndOverride").mockImplementation((key) => {
      if (key === REQUIRE_MODULE_KEY) return "kds";
      return undefined;
    });
    capabilities.resolveForOrganization.mockResolvedValue({
      modules: { kds: true, pos: true },
      features: {},
    });

    await expect(
      guard.canActivate(contextFor({ organizationId: "org-1", permissions: ["access_kds"] })),
    ).resolves.toBe(true);
  });

  it("requires organization context", async () => {
    config.get.mockReturnValue("true");
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue("kds");
    await expect(guard.canActivate(contextFor({}))).rejects.toThrow(
      new ForbiddenException("Organization context required"),
    );
  });
});
