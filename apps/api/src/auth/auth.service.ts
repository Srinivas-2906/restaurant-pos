import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { JwtPayload } from "@kaana/shared-types";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      include: {
        roleAssignments: { include: { outlet: true } },
        organization: true,
      },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const primaryRole = user.roleAssignments[0];
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      outletId: primaryRole?.outletId ?? undefined,
      role: primaryRole?.role,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id);

    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.id,
      outletId: primaryRole?.outletId ?? undefined,
      action: "login",
      metadata: { email: user.email, role: primaryRole?.role },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organization: user.organization,
        roles: user.roleAssignments,
      },
    };
  }

  async refresh(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { roleAssignments: true } } },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const primaryRole = stored.user.roleAssignments[0];
    const payload: JwtPayload = {
      sub: stored.user.id,
      email: stored.user.email,
      organizationId: stored.user.organizationId,
      outletId: primaryRole?.outletId ?? undefined,
      role: primaryRole?.role,
    };

    return { accessToken: this.jwt.sign(payload) };
  }

  async switchOutlet(userId: string, outletId: string) {
    const assignment = await this.prisma.roleAssignment.findFirst({
      where: { userId, outletId },
    });

    if (!assignment) {
      throw new UnauthorizedException("No access to this outlet");
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      outletId,
      role: assignment.role,
    };

    return { accessToken: this.jwt.sign(payload), outletId, role: assignment.role };
  }

  private async createRefreshToken(userId: string) {
    const token = this.jwt.sign({ sub: userId }, {
      secret: this.config.get("JWT_REFRESH_SECRET"),
      expiresIn: this.config.get("JWT_REFRESH_EXPIRES_IN", "7d"),
    });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return token;
  }
}
