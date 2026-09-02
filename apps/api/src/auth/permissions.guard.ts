import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasAppAccess, type AppAccessPermission } from "@kaana/shared-types";
import { APP_ACCESS_KEY } from "./permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppAccessPermission | undefined>(
      APP_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest<{ user?: { permissions?: string[] } }>();
    const permissions = request.user?.permissions ?? [];
    if (!hasAppAccess(permissions, required)) {
      throw new ForbiddenException("Insufficient application access");
    }
    return true;
  }
}
