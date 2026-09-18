import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import { ROLES_KEY } from "./roles.decorator";

describe("RolesGuard platform isolation", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function contextFor(user: { role?: string; roles?: string[] }) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it("allows super_admin on platform-only routes", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["super_admin"]);
    expect(guard.canActivate(contextFor({ role: "super_admin" }))).toBe(true);
  });

  it("denies restaurant owner on platform-only routes", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["super_admin"]);
    expect(() => guard.canActivate(contextFor({ role: "owner" }))).toThrow(ForbiddenException);
  });

  it("denies manager on platform-only routes", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["super_admin"]);
    expect(() => guard.canActivate(contextFor({ role: "manager" }))).toThrow(ForbiddenException);
  });

  it("denies biller on platform-only routes", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["super_admin"]);
    expect(() => guard.canActivate(contextFor({ role: "biller" }))).toThrow(ForbiddenException);
  });

  it("still allows owner on owner-scoped routes", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["owner", "manager"]);
    expect(guard.canActivate(contextFor({ role: "owner" }))).toBe(true);
  });

  it("still allows owner bypass on manager-only routes (legacy)", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["manager"]);
    expect(guard.canActivate(contextFor({ role: "owner" }))).toBe(true);
  });
});
