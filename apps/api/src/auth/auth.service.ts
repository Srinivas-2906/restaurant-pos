import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

import { AuditService } from "../audit/audit.service";

import { SignupDto } from "@kaana/shared-types";

import * as bcrypt from "bcryptjs";

import { TokenService } from "./token.service";

import { OutletsService } from "../outlets/outlets.service";

import { buildEmailJwtPayload, pickPrimaryRoleAssignment } from "./auth-payload.util";

import { CapabilityService } from "../capabilities/capability.service";



@Injectable()

export class AuthService {

  constructor(

    private prisma: PrismaService,

    private audit: AuditService,

    private tokens: TokenService,

    private outletsService: OutletsService,

    private capabilities: CapabilityService,

  ) {}



  async login(email: string, password: string) {

    const user = await this.prisma.user.findFirst({

      where: { email, isActive: true },

      include: {

        roleAssignments: { include: { outlet: true } },

        organization: true,

        staffProfile: {

          select: {

            id: true,

            hasLoginAccess: true,

            staffRoleAssignments: true,

          },

        },

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



    const primaryRole = pickPrimaryRoleAssignment(user.roleAssignments);

    const payload = buildEmailJwtPayload({

      userId: user.id,

      email: user.email,

      organizationId: user.organizationId,

      roleAssignments: user.roleAssignments,

      staffRoleAssignments: user.staffProfile?.staffRoleAssignments,

      staffProfileId: user.staffProfile?.id,

    });



    const { accessToken, refreshToken } = await this.tokens.issueTokens({

      payload,

      refreshUserId: user.id,

    });



    await this.audit.log({

      organizationId: user.organizationId,

      userId: user.id,

      outletId: primaryRole?.outletId ?? undefined,

      action: "login",

      metadata: {

        email: user.email,

        role: primaryRole?.role,

        roles: payload.roles,

        authMode: "email",

      },

    });



    const capabilityBootstrap = await this.capabilities.resolveForOrganization(user.organizationId);



    return {

      accessToken,

      refreshToken,

      capabilities: {

        ...capabilityBootstrap,

        resolvedAt: new Date().toISOString(),

      },

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



  async signup(dto: SignupDto) {

    const existingUser = await this.prisma.user.findFirst({

      where: { email: dto.email },

    });

    if (existingUser) {

      throw new ForbiddenException("An account with this email already exists");

    }



    const existingOrg = await this.prisma.organization.findUnique({

      where: { slug: dto.restaurantSlug },

    });

    if (existingOrg) {

      throw new ForbiddenException("This restaurant URL slug is already taken");

    }



    const passwordHash = await bcrypt.hash(dto.password, 10);



    const result = await this.prisma.$transaction(async (tx) => {

      const organization = await tx.organization.create({

        data: {

          name: dto.restaurantName,

          slug: dto.restaurantSlug,

          email: dto.email,

          phone: dto.phone,

          gstin: dto.gstin,

        },

      });



      const brand = await tx.brand.create({

        data: {

          organizationId: organization.id,

          name: dto.restaurantName,

          slug: dto.restaurantSlug,

        },

      });



      const outlet = await tx.outlet.create({

        data: {

          brandId: brand.id,

          name: dto.outletName,

          code: dto.outletCode.toUpperCase(),

          type: "dine_in",

        },

      });



      const user = await tx.user.create({

        data: {

          organizationId: organization.id,

          email: dto.email,

          passwordHash,

          firstName: dto.firstName,

          lastName: dto.lastName,

          phone: dto.phone,

        },

      });



      await tx.roleAssignment.create({

        data: {

          userId: user.id,

          organizationId: organization.id,

          outletId: outlet.id,

          role: "owner",

        },

      });



      const staffProfile = await tx.staffProfile.create({

        data: {

          organizationId: organization.id,

          userId: user.id,

          outletId: outlet.id,

          employeeCode: "OWNER-001",

          displayName: `${dto.firstName} ${dto.lastName ?? ""}`.trim(),

          firstName: dto.firstName,

          lastName: dto.lastName,

          email: dto.email,

          phone: dto.phone,

          hasLoginAccess: true,

        },

      });



      return { organization, brand, outlet, user, staffProfile };

    });



    await this.outletsService.bootstrapDineInOutlet(result.outlet.id);



    return this.login(dto.email, dto.password);

  }



  async refresh(refreshToken: string) {

    const stored = await this.prisma.refreshToken.findUnique({

      where: { token: refreshToken },

      include: {

        user: {

          include: {

            roleAssignments: true,

            staffProfile: { include: { staffRoleAssignments: true } },

          },

        },

      },

    });



    if (!stored || stored.expiresAt < new Date()) {

      throw new UnauthorizedException("Invalid refresh token");

    }



    const payload = buildEmailJwtPayload({

      userId: stored.user.id,

      email: stored.user.email,

      organizationId: stored.user.organizationId,

      roleAssignments: stored.user.roleAssignments,

      staffRoleAssignments: stored.user.staffProfile?.staffRoleAssignments,

      staffProfileId: stored.user.staffProfile?.id,

    });



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



    const user = await this.prisma.user.findUniqueOrThrow({

      where: { id: userId },

      include: {

        roleAssignments: true,

        staffProfile: { include: { staffRoleAssignments: true } },

      },

    });



    const payload = buildEmailJwtPayload({

      userId: user.id,

      email: user.email,

      organizationId: user.organizationId,

      roleAssignments: user.roleAssignments,

      staffRoleAssignments: user.staffProfile?.staffRoleAssignments.filter(

        (a) => a.outletId === outletId,

      ),

      staffProfileId: user.staffProfile?.id,

      outletIdOverride: outletId,

    });



    const { accessToken } = await this.tokens.issueTokens({ payload });

    return { accessToken, outletId, role: assignment.role };

  }

}


