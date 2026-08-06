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
    const user = request.user as { role?: string } | undefined;
    if (!user) return true;
    if (!user.role) throw new ForbiddenException("No role assigned");

    const allowed = requiredRoles.includes(user.role) ||
      user.role === "owner" ||
      user.role === "super_admin";

    if (!allowed) throw new ForbiddenException(`Role ${user.role} not permitted`);
    return true;
  }
}
