import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import {
  APP_ACCESS,
  hasAppAccess,
  resolveEffectivePermissions,
} from "@kaana/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { TokenService } from "./token.service";
import type { TerminalContext } from "./terminal-auth.guard";

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000;

@Injectable()
export class OperationalAuthService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tokens: TokenService,
  ) {}

  getTerminalContext(terminal: TerminalContext) {
    return this.prisma.terminal.findUniqueOrThrow({
      where: { id: terminal.terminalId },
      select: {
        id: true,
        name: true,
        code: true,
        deviceType: true,
        outletId: true,
        outlet: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async listEligibleStaff(terminal: TerminalContext) {
    const assignments = await this.prisma.staffRoleAssignment.findMany({
      where: {
        outletId: terminal.outletId,
        organizationId: terminal.organizationId,
      },
      include: {
        staff: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            profilePhotoUrl: true,
            isActive: true,
            pinHash: true,
            outletId: true,
            outletAssignments: {
              where: { outletId: terminal.outletId, effectiveTo: null },
              select: { id: true },
            },
          },
        },
      },
    });

    const seen = new Set<string>();
    const staff: Array<{
      id: string;
      displayName: string;
      employeeCode: string;
      profilePhotoUrl: string | null;
    }> = [];

    for (const assignment of assignments) {
      const profile = assignment.staff;
      if (!profile.isActive || !profile.pinHash || seen.has(profile.id)) continue;

      const permissions = resolveEffectivePermissions(assignment);
      if (!hasAppAccess(permissions, APP_ACCESS.access_pos)) continue;

      const assignedToOutlet =
        profile.outletId === terminal.outletId || profile.outletAssignments.length > 0;
      if (!assignedToOutlet) continue;

      seen.add(profile.id);
      staff.push({
        id: profile.id,
        displayName:
          profile.displayName ??
          [profile.firstName, profile.lastName].filter(Boolean).join(" ") ??
          profile.employeeCode,
        employeeCode: profile.employeeCode,
        profilePhotoUrl: profile.profilePhotoUrl,
      });
    }

    return staff.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async pinLogin(
    terminal: TerminalContext,
    staffProfileId: string,
    pin: string,
    ipAddress?: string,
  ) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        id: staffProfileId,
        organizationId: terminal.organizationId,
        isActive: true,
      },
      include: {
        outletAssignments: {
          where: { outletId: terminal.outletId, effectiveTo: null },
        },
        staffRoleAssignments: {
          where: { outletId: terminal.outletId },
        },
      },
    });

    const fail = async (reason: string) => {
      await this.audit.log({
        organizationId: terminal.organizationId,
        outletId: terminal.outletId,
        action: "login",
        entityType: "staff_profile",
        entityId: staffProfileId,
        metadata: {
          authMode: "operational",
          success: false,
          terminalId: terminal.terminalId,
          reason,
        },
        ipAddress,
      });
      throw new UnauthorizedException("Invalid employee or PIN");
    };

    if (!staff?.pinHash) {
      await fail("no_pin");
    }

    const assignedToOutlet =
      staff!.outletId === terminal.outletId || staff!.outletAssignments.length > 0;
    if (!assignedToOutlet) {
      await fail("wrong_outlet");
    }

    if (staff!.pinLockedUntil && staff!.pinLockedUntil > new Date()) {
      await fail("locked");
    }

    const pinValid = await bcrypt.compare(pin, staff!.pinHash!);
    if (!pinValid) {
      const attempts = staff!.pinFailedAttempts + 1;
      const locked = attempts >= PIN_MAX_ATTEMPTS;
      await this.prisma.staffProfile.update({
        where: { id: staff!.id },
        data: {
          pinFailedAttempts: attempts,
          pinLockedUntil: locked ? new Date(Date.now() + PIN_LOCKOUT_MS) : null,
        },
      });
      await fail("bad_pin");
    }

    const roleAssignment =
      staff!.staffRoleAssignments.find((a) =>
        hasAppAccess(resolveEffectivePermissions(a), APP_ACCESS.access_pos),
      ) ?? staff!.staffRoleAssignments[0];

    if (!roleAssignment) {
      throw new ForbiddenException("POS access not granted");
    }

    const permissions = resolveEffectivePermissions(roleAssignment);
    if (!hasAppAccess(permissions, APP_ACCESS.access_pos)) {
      throw new ForbiddenException("POS access not granted");
    }

    await this.prisma.staffProfile.update({
      where: { id: staff!.id },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    });

    const displayName =
      staff!.displayName ??
      [staff!.firstName, staff!.lastName].filter(Boolean).join(" ") ??
      staff!.employeeCode;

    const { accessToken, refreshToken } = await this.tokens.issueTokens({
      payload: {
        sub: staff!.userId ?? staff!.id,
        authMode: "operational",
        staffProfileId: staff!.id,
        userId: staff!.userId ?? undefined,
        organizationId: terminal.organizationId,
        outletId: terminal.outletId,
        terminalId: terminal.terminalId,
        role: roleAssignment.role,
        permissions,
        displayName,
      },
      refreshUserId: staff!.userId ?? undefined,
    });

    await this.audit.log({
      organizationId: terminal.organizationId,
      outletId: terminal.outletId,
      userId: staff!.userId ?? undefined,
      action: "login",
      entityType: "staff_profile",
      entityId: staff!.id,
      metadata: {
        authMode: "operational",
        success: true,
        terminalId: terminal.terminalId,
        role: roleAssignment.role,
      },
      ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      staff: {
        id: staff!.id,
        displayName,
        employeeCode: staff!.employeeCode,
        role: roleAssignment.role,
      },
      outletId: terminal.outletId,
      terminalId: terminal.terminalId,
    };
  }
}
