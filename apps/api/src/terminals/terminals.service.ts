import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TerminalsService {
  constructor(private prisma: PrismaService) {}

  async registerTerminal(
    terminalId: string,
    organizationId: string,
    userId: string,
  ) {
    const terminal = await this.prisma.terminal.findUnique({
      where: { id: terminalId },
      include: { outlet: { include: { brand: true } } },
    });

    if (!terminal) {
      throw new NotFoundException("Terminal not found");
    }

    if (terminal.outlet.brand.organizationId !== organizationId) {
      throw new UnauthorizedException("Terminal not in your organization");
    }

    if (!terminal.isActive) {
      throw new BadRequestException("Terminal is inactive");
    }

    const deviceSecret = randomBytes(32).toString("hex");
    const deviceSecretHash = await bcrypt.hash(deviceSecret, 10);

    const updated = await this.prisma.terminal.update({
      where: { id: terminalId },
      data: {
        isRegistered: true,
        deviceSecretHash,
        registeredAt: new Date(),
        registeredByUserId: userId,
      },
      include: {
        outlet: { select: { id: true, name: true, code: true } },
      },
    });

    return {
      terminal: {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        deviceType: updated.deviceType,
        outlet: updated.outlet,
      },
      deviceSecret,
    };
  }
}
