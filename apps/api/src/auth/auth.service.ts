import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { JwtPayload } from "@kaana/shared-types";
import * as bcrypt from "bcryptjs";
import { TokenService } from "./token.service";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tokens: TokenService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      include: {
        roleAssignments: { include: { outlet: true } },
        organization: true,
        staffProfile: { select: { hasLoginAccess: true } },
      },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.staffProfile && !user.staffProfile.hasLoginAccess) {
      throw new ForbiddenException("Email login is not enabled for this employee");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const primaryRole =
      user.roleAssignments.find((r) => r.outletId) ?? user.roleAssignments[0];
    const payload: JwtPayload = {
      sub: user.id,
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      outletId: primaryRole?.outletId ?? undefined,
      role: primaryRole?.role,
      authMode: "email",
    };

    const { accessToken, refreshToken } = await this.tokens.issueTokens({
      payload,
      refreshUserId: user.id,
    });

    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.id,
      outletId: primaryRole?.outletId ?? undefined,
      action: "login",
      metadata: { email: user.email, role: primaryRole?.role, authMode: "email" },
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
      userId: stored.user.id,
      email: stored.user.email,
      organizationId: stored.user.organizationId,
      outletId: primaryRole?.outletId ?? undefined,
      role: primaryRole?.role,
      authMode: "email",
    };

    const { accessToken } = await this.tokens.issueTokens({ payload });
    return { accessToken };
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
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      outletId,
      role: assignment.role,
      authMode: "email",
    };

    const { accessToken } = await this.tokens.issueTokens({ payload });
    return { accessToken, outletId, role: assignment.role };
  }
}
