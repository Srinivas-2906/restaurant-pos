import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

export type TerminalContext = {
  terminalId: string;
  outletId: string;
  organizationId: string;
  deviceType: string;
};

@Injectable()
export class TerminalAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      terminal?: TerminalContext;
    }>();

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Terminal ")) {
      throw new UnauthorizedException("Terminal credential required");
    }

    const credential = authHeader.slice("Terminal ".length).trim();
    const separator = credential.indexOf(":");
    if (separator <= 0) {
      throw new UnauthorizedException("Invalid terminal credential");
    }

    const terminalId = credential.slice(0, separator);
    const deviceSecret = credential.slice(separator + 1);
    if (!terminalId || !deviceSecret) {
      throw new UnauthorizedException("Invalid terminal credential");
    }

    const terminal = await this.prisma.terminal.findUnique({
      where: { id: terminalId },
      include: { outlet: { include: { brand: true } } },
    });

    if (
      !terminal ||
      !terminal.isActive ||
      !terminal.isRegistered ||
      !terminal.deviceSecretHash
    ) {
      throw new UnauthorizedException("Terminal not registered");
    }

    const valid = await bcrypt.compare(deviceSecret, terminal.deviceSecretHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid terminal credential");
    }

    request.terminal = {
      terminalId: terminal.id,
      outletId: terminal.outletId,
      organizationId: terminal.outlet.brand.organizationId,
      deviceType: terminal.deviceType,
    };
    return true;
  }
}
