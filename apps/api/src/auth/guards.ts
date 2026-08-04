import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) throw err || new UnauthorizedException();
    return user;
  }
}

export { RolesGuard } from "./roles.guard";
export { Roles } from "./roles.decorator";
