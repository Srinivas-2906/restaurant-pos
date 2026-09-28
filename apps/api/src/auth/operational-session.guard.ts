import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";
import { IS_PUBLIC_KEY } from "./public.decorator";
import type { ScopedAuthUser } from "./outlet-scope.service";

@Injectable()
export class OperationalSessionGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ user?: ScopedAuthUser }>();
    const user = request.user;
    if (!user || user.authMode !== "operational") return true;

    if (!user.terminalId || !user.staffProfileId || !user.outletId) {
      throw new UnauthorizedException("Invalid operational session");
    }

    const terminal = await this.prisma.terminal.findUnique({
      where: { id: user.terminalId },
      select: { isActive: true, revokedAt: true, outletId: true },
    });

    if (!terminal || !terminal.isActive || terminal.revokedAt) {
      throw new UnauthorizedException("Terminal session invalidated");
    }

    if (terminal.outletId !== user.outletId) {
      throw new ForbiddenException("Terminal is bound to a different outlet");
    }

    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: user.staffProfileId },
      select: { isActive: true },
    });

    if (!staff?.isActive) {
      throw new UnauthorizedException("Employee session invalidated");
    }

    return true;
  }
}
