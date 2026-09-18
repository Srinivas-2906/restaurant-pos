import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ALL_FEATURE_KEYS,
  ALL_MODULE_KEYS,
  FEATURE_OVERRIDE_STATES,
  MODULE_DEPENDENCIES,
  MODULE_LABELS,
  OPERATING_MODES,
  PLAN_DEFAULTS,
  SUBSCRIPTION_PLANS,
  featuresForModule,
  type FeatureEffectiveState,
  type FeatureEntitlementKey,
  type FeatureOverrideState,
  type ModuleEffectiveState,
  type ModuleKey,
  type OperatingMode,
  type SubscriptionPlanId,
} from "@kaana/shared-types";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CapabilityService } from "../capabilities/capability.service";
import { EventsGateway } from "../events/events.gateway";

type ModuleOverrideInput =
  | { moduleKey: string; enabled: boolean }
  | { moduleKey: string; inherit: true };

type FeatureOverrideInput =
  | { featureKey: string; state: FeatureOverrideState; expiresAt?: string }
  | { featureKey: string; inherit: true };

type UpdateTenantConfigBody = {
  operatingMode?: OperatingMode;
  subscriptionPlan?: SubscriptionPlanId;
  moduleOverrides?: ModuleOverrideInput[];
  featureOverrides?: FeatureOverrideInput[];
};

const INTERNAL_ORG_SLUG = "kaana-platform";

function isModuleInherit(row: ModuleOverrideInput): row is { moduleKey: string; inherit: true } {
  return "inherit" in row && row.inherit === true;
}

function isFeatureInherit(row: FeatureOverrideInput): row is { featureKey: string; inherit: true } {
  return "inherit" in row && row.inherit === true;
}

@Injectable()
export class PlatformService {
  constructor(
    private prisma: PrismaService,
    private capabilities: CapabilityService,
    private events: EventsGateway,
  ) {}

  async listTenants(query?: string) {
    const q = query?.trim();
    const where: Prisma.OrganizationWhereInput = {
      slug: { not: INTERNAL_ORG_SLUG },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              {
                users: {
                  some: {
                    roleAssignments: { some: { role: "owner" } },
                    email: { contains: q, mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const orgs = await this.prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        operatingMode: true,
        subscriptionPlan: true,
        configVersion: true,
        createdAt: true,
        updatedAt: true,
        users: {
          where: { roleAssignments: { some: { role: "owner" } } },
          take: 1,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            lastLoginAt: true,
          },
        },
        brands: {
          select: {
            outlets: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        },
      },
    });

    return Promise.all(
      orgs.map(async (org) => {
        const caps = await this.capabilities.resolveForOrganization(org.id);
        const enabledModules = ALL_MODULE_KEYS.filter((key) => caps.modules[key]);
        const owner = org.users[0] ?? null;
        const outletCount = org.brands.reduce((sum, brand) => sum + brand.outlets.length, 0);

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          isActive: org.isActive,
          operatingMode: org.operatingMode,
          subscriptionPlan: org.subscriptionPlan,
          configVersion: org.configVersion,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
          owner: owner
            ? {
                id: owner.id,
                email: owner.email,
                name: [owner.firstName, owner.lastName].filter(Boolean).join(" "),
                lastLoginAt: owner.lastLoginAt,
              }
            : null,
          outletCount,
          enabledModulesSummary: enabledModules.join(", "),
          lastActivityAt: owner?.lastLoginAt ?? org.updatedAt,
        };
      }),
    );
  }

  async getTenant(organizationId: string) {
    await this.assertTenantExists(organizationId);

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: {
        moduleOverrides: true,
        featureOverrides: true,
        brands: {
          include: {
            outlets: {
              include: {
                terminals: {
                  where: { isActive: true },
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    deviceType: true,
                    isRegistered: true,
                    revokedAt: true,
                    registeredAt: true,
                  },
                  orderBy: { code: "asc" },
                },
              },
            },
          },
        },
        users: {
          where: { roleAssignments: { some: { role: "owner" } } },
          take: 1,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            lastLoginAt: true,
          },
        },
      },
    });

    const capabilities = await this.capabilities.resolveForOrganization(organizationId);
    const planDefaults = PLAN_DEFAULTS[org.subscriptionPlan as SubscriptionPlanId] ?? PLAN_DEFAULTS.LEGACY_FULL;
    const moduleOverrideMap = new Map(org.moduleOverrides.map((row) => [row.moduleKey, row]));
    const featureOverrideMap = new Map(org.featureOverrides.map((row) => [row.featureKey, row]));

    const moduleCatalog = ALL_MODULE_KEYS.map((moduleKey) => {
      const planDefault = planDefaults.modules[moduleKey];
      const override = moduleOverrideMap.get(moduleKey);
      const resolvedEnabled = capabilities.modules[moduleKey];
      let effectiveState: ModuleEffectiveState;
      if (override) {
        effectiveState = override.enabled ? "OVERRIDE_ENABLED" : "OVERRIDE_DISABLED";
      } else {
        effectiveState = planDefault ? "INHERITED_ENABLED" : "INHERITED_DISABLED";
      }
      return {
        moduleKey,
        label: MODULE_LABELS[moduleKey],
        planDefault,
        resolvedEnabled,
        effectiveState,
        override: override ? { enabled: override.enabled, updatedAt: override.updatedAt } : null,
        features: featuresForModule(moduleKey).map((featureKey) => {
          const featureOverride = featureOverrideMap.get(featureKey);
          const inheritedEnabled = planDefaults.features[featureKey];
          const resolvedFeatureEnabled = capabilities.features[featureKey];
          let featureEffectiveState: FeatureEffectiveState = "INHERITED";
          if (featureOverride) {
            if (featureOverride.state === "ENABLED") featureEffectiveState = "OVERRIDE_ENABLED";
            else if (featureOverride.state === "READ_ONLY") featureEffectiveState = "OVERRIDE_READ_ONLY";
            else if (featureOverride.state === "DISABLED") featureEffectiveState = "OVERRIDE_DISABLED";
          }
          return {
            featureKey,
            inheritedEnabled,
            resolvedEnabled: resolvedFeatureEnabled,
            effectiveState: featureEffectiveState,
            override: featureOverride
              ? {
                  state: featureOverride.state,
                  expiresAt: featureOverride.expiresAt,
                  updatedAt: featureOverride.updatedAt,
                }
              : null,
          };
        }),
      };
    });

    const outletIds = org.brands.flatMap((brand) => brand.outlets.map((outlet) => outlet.id));
    const deviceHealth =
      outletIds.length > 0
        ? await this.prisma.deviceHealth.findMany({
            where: { outletId: { in: outletIds } },
            orderBy: { lastSeenAt: "desc" },
            take: 50,
          })
        : [];

    const recentConfigAudits = await this.prisma.auditLog.findMany({
      where: { organizationId, action: "platform_config" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    return {
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        isActive: org.isActive,
        operatingMode: org.operatingMode,
        subscriptionPlan: org.subscriptionPlan,
        configVersion: org.configVersion,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        gstin: org.gstin,
        email: org.email,
        phone: org.phone,
      },
      owner: org.users[0] ?? null,
      outlets: org.brands.flatMap((brand) =>
        brand.outlets.map((outlet) => ({
          id: outlet.id,
          name: outlet.name,
          code: outlet.code,
          type: outlet.type,
          isActive: outlet.isActive,
          terminals: outlet.terminals,
        })),
      ),
      capabilities,
      moduleCatalog,
      deviceHealth: {
        total: deviceHealth.length,
        online: deviceHealth.filter((row) => row.status === "online").length,
        devices: deviceHealth,
      },
      recentConfigAudits,
    };
  }

  async updateTenantConfig(
    organizationId: string,
    body: UpdateTenantConfigBody,
    actorUserId: string,
  ) {
    await this.assertTenantExists(organizationId);

    const before = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: { moduleOverrides: true, featureOverrides: true },
    });

    const auditEntries: Array<{
      event: string;
      target: string;
      previousValue: Prisma.InputJsonValue | null;
      newValue: Prisma.InputJsonValue | null;
    }> = [];

    if (body.operatingMode !== undefined) {
      if (!OPERATING_MODES.includes(body.operatingMode)) {
        throw new BadRequestException(`Invalid operating mode: ${body.operatingMode}`);
      }
      if (before.operatingMode !== body.operatingMode) {
        auditEntries.push({
          event: "organization.mode.updated",
          target: "operatingMode",
          previousValue: before.operatingMode,
          newValue: body.operatingMode,
        });
      }
    }

    if (body.subscriptionPlan !== undefined) {
      if (!SUBSCRIPTION_PLANS.includes(body.subscriptionPlan)) {
        throw new BadRequestException(`Invalid subscription plan: ${body.subscriptionPlan}`);
      }
      if (before.subscriptionPlan !== body.subscriptionPlan) {
        auditEntries.push({
          event: "organization.plan.updated",
          target: "subscriptionPlan",
          previousValue: before.subscriptionPlan,
          newValue: body.subscriptionPlan,
        });
      }
    }

    const moduleChanges = body.moduleOverrides ?? [];
    for (const row of moduleChanges) {
      if (!ALL_MODULE_KEYS.includes(row.moduleKey as ModuleKey)) {
        throw new BadRequestException(`Unknown module key: ${row.moduleKey}`);
      }
    }

    const featureChanges = body.featureOverrides ?? [];
    for (const row of featureChanges) {
      if (!ALL_FEATURE_KEYS.includes(row.featureKey as FeatureEntitlementKey)) {
        throw new BadRequestException(`Unknown feature key: ${row.featureKey}`);
      }
      if (!isFeatureInherit(row) && !FEATURE_OVERRIDE_STATES.includes(row.state)) {
        throw new BadRequestException(`Invalid feature override state: ${row.state}`);
      }
    }

    const resolvedBefore = await this.capabilities.resolveForOrganization(organizationId);

    for (const row of moduleChanges) {
      const moduleKey = row.moduleKey as ModuleKey;
      const existing = before.moduleOverrides.find((item) => item.moduleKey === moduleKey);

      if (isModuleInherit(row)) {
        if (existing) {
          auditEntries.push({
            event: "module.override.removed",
            target: moduleKey,
            previousValue: existing.enabled,
            newValue: null,
          });
        }
        continue;
      }

      const enabled = row.enabled;
      if (enabled === false) {
        this.assertModuleCanBeDisabled(moduleKey, resolvedBefore.modules);
      } else {
        this.assertModuleDependencies(moduleKey, resolvedBefore.modules, moduleChanges);
      }

      if (!existing || existing.enabled !== enabled) {
        auditEntries.push({
          event: "module.override.updated",
          target: moduleKey,
          previousValue: existing?.enabled ?? null,
          newValue: enabled,
        });
      }
    }

    for (const row of featureChanges) {
      const featureKey = row.featureKey as FeatureEntitlementKey;
      const existing = before.featureOverrides.find((item) => item.featureKey === featureKey);

      if (isFeatureInherit(row)) {
        if (existing) {
          auditEntries.push({
            event: "feature.override.removed",
            target: featureKey,
            previousValue: existing.state,
            newValue: null,
          });
        }
        continue;
      }

      if (!existing || existing.state !== row.state) {
        auditEntries.push({
          event: "feature.override.updated",
          target: featureKey,
          previousValue: existing?.state ?? "DEFAULT",
          newValue: row.state,
        });
      }
    }

    const hasOrgFieldChange =
      (body.operatingMode !== undefined && before.operatingMode !== body.operatingMode) ||
      (body.subscriptionPlan !== undefined && before.subscriptionPlan !== body.subscriptionPlan);
    const hasModuleChange = moduleChanges.some((row) => {
      const existing = before.moduleOverrides.find((item) => item.moduleKey === row.moduleKey);
      if (isModuleInherit(row)) return Boolean(existing);
      return !existing || existing.enabled !== row.enabled;
    });
    const hasFeatureChange = featureChanges.some((row) => {
      const existing = before.featureOverrides.find((item) => item.featureKey === row.featureKey);
      if (isFeatureInherit(row)) return Boolean(existing);
      return !existing || existing.state !== row.state;
    });

    if (!hasOrgFieldChange && !hasModuleChange && !hasFeatureChange) {
      return this.getTenant(organizationId);
    }

    await this.prisma.$transaction(async (tx) => {
      if (hasOrgFieldChange) {
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            ...(body.operatingMode !== undefined ? { operatingMode: body.operatingMode } : {}),
            ...(body.subscriptionPlan !== undefined ? { subscriptionPlan: body.subscriptionPlan } : {}),
            configVersion: { increment: 1 },
          },
        });
      }

      if (hasModuleChange) {
        for (const row of moduleChanges) {
          const moduleKey = row.moduleKey;
          if (isModuleInherit(row)) {
            await tx.restaurantModuleOverride.deleteMany({
              where: { organizationId, moduleKey },
            });
            continue;
          }
          await tx.restaurantModuleOverride.upsert({
            where: { organizationId_moduleKey: { organizationId, moduleKey } },
            create: { organizationId, moduleKey, enabled: row.enabled },
            update: { enabled: row.enabled },
          });
        }
        if (!hasOrgFieldChange) {
          await tx.organization.update({
            where: { id: organizationId },
            data: { configVersion: { increment: 1 } },
          });
        }
      }

      if (hasFeatureChange) {
        for (const row of featureChanges) {
          const featureKey = row.featureKey;
          if (isFeatureInherit(row)) {
            await tx.restaurantFeatureOverride.deleteMany({
              where: { organizationId, featureKey },
            });
            continue;
          }
          await tx.restaurantFeatureOverride.upsert({
            where: { organizationId_featureKey: { organizationId, featureKey } },
            create: {
              organizationId,
              featureKey,
              state: row.state,
              expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
            },
            update: {
              state: row.state,
              expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
            },
          });
        }
        if (!hasOrgFieldChange && !hasModuleChange) {
          await tx.organization.update({
            where: { id: organizationId },
            data: { configVersion: { increment: 1 } },
          });
        }
      }

      for (const entry of auditEntries) {
        await tx.auditLog.create({
          data: {
            organizationId,
            userId: actorUserId,
            action: "platform_config",
            entityType: entry.target,
            metadata: {
              event: entry.event,
              target: entry.target,
              previousValue: entry.previousValue,
              newValue: entry.newValue,
            },
          },
        });
      }
    });

    this.capabilities.invalidateCache(organizationId);
    const version = (
      await this.prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { configVersion: true },
      })
    ).configVersion;
    this.events.emitConfigVersion(organizationId, version);

    return this.getTenant(organizationId);
  }

  async getDeviceHealthOverview() {
    const devices = await this.prisma.deviceHealth.findMany({
      orderBy: { lastSeenAt: "desc" },
      take: 200,
    });
    return {
      total: devices.length,
      online: devices.filter((d) => d.status === "online").length,
      unsynced: devices.filter((d) => d.syncBacklog > 0).length,
      devices,
    };
  }

  private async assertTenantExists(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, slug: true, isActive: true },
    });
    if (!org || org.slug === INTERNAL_ORG_SLUG) {
      throw new NotFoundException("Tenant not found");
    }
  }

  private assertModuleDependencies(
    moduleKey: ModuleKey,
    resolvedModules: Record<ModuleKey, boolean>,
    pendingChanges: ModuleOverrideInput[],
  ) {
    const dependencies = MODULE_DEPENDENCIES[moduleKey] ?? [];
    for (const dependency of dependencies) {
      const pending = pendingChanges.find((row) => row.moduleKey === dependency);
      const pendingEnabled =
        pending && !isModuleInherit(pending) ? pending.enabled : resolvedModules[dependency];
      if (!pendingEnabled) {
        throw new BadRequestException(
          `Cannot enable ${moduleKey}: requires ${dependency} to be enabled`,
        );
      }
    }
  }

  private assertModuleCanBeDisabled(
    moduleKey: ModuleKey,
    resolvedModules: Record<ModuleKey, boolean>,
  ) {
    const dependents = ALL_MODULE_KEYS.filter((key) =>
      (MODULE_DEPENDENCIES[key] ?? []).includes(moduleKey),
    );
    for (const dependent of dependents) {
      if (resolvedModules[dependent]) {
        throw new BadRequestException(
          `Cannot disable ${moduleKey}: ${dependent} depends on it. Disable ${dependent} first.`,
        );
      }
    }
  }
}
