import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: string; roles?: string[] } | undefined;
    if (!user) return true;
    if (!user.role && !(user.roles?.length)) {
      throw new ForbiddenException("No role assigned");
    }

    const userRoles = [...new Set([user.role, ...(user.roles ?? [])].filter(Boolean))] as string[];
    const platformOnly =
      requiredRoles.includes("super_admin") &&
      requiredRoles.every((role) => role === "super_admin");

    if (platformOnly) {
      if (userRoles.includes("super_admin")) return true;
      throw new ForbiddenException("Platform access requires super_admin role");
    }

    const allowed =
      requiredRoles.some((role) => userRoles.includes(role)) ||
      userRoles.includes("owner") ||
      (userRoles.includes("super_admin") && requiredRoles.includes("super_admin"));

    if (!allowed) throw new ForbiddenException(`Role ${user.role} not permitted`);
    return true;
  }
}
