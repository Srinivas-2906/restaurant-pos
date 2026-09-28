import { Injectable } from "@nestjs/common";
import {
  ALL_FEATURE_KEYS,
  ALL_MODULE_KEYS,
  FEATURE_PERMISSION_MAP,
  MODE_NAV_DEPTH,
  PLAN_DEFAULTS,
  type FeatureEntitlementKey,
  type FeatureOverrideState,
  type ModuleKey,
  type OperatingMode,
  type ResolvedCapabilities,
  type SubscriptionPlanId,
} from "@kaana/shared-types";
import { PrismaService } from "../prisma/prisma.service";

type OrgCapabilityRow = {
  id: string;
  operatingMode: OperatingMode;
  subscriptionPlan: SubscriptionPlanId;
  configVersion: number;
  moduleOverrides: Array<{ moduleKey: string; enabled: boolean }>;
  featureOverrides: Array<{ featureKey: string; state: FeatureOverrideState; expiresAt: Date | null }>;
};

@Injectable()
export class CapabilityService {
  private cache = new Map<string, { version: number; payload: ResolvedCapabilities; cachedAt: number }>();
  private readonly cacheTtlMs = 60_000;

  constructor(private prisma: PrismaService) {}

  async resolveForOrganization(organizationId: string): Promise<ResolvedCapabilities> {
    const org = await this.loadOrganization(organizationId);
    const cached = this.cache.get(organizationId);
    if (cached && cached.version === org.configVersion && Date.now() - cached.cachedAt < this.cacheTtlMs) {
      return cached.payload;
    }

    const payload = this.buildResolved(org);
    this.cache.set(organizationId, { version: org.configVersion, payload, cachedAt: Date.now() });
    return payload;
  }

  async canRestaurantUse(organizationId: string, featureKey: FeatureEntitlementKey): Promise<boolean> {
    const caps = await this.resolveForOrganization(organizationId);
    return caps.features[featureKey] === true;
  }

  canEmployeeAct(permissions: string[] | undefined, featureKey: FeatureEntitlementKey): boolean {
    const required = FEATURE_PERMISSION_MAP[featureKey] ?? [];
    if (required.length === 0) return true;
    const granted = new Set(permissions ?? []);
    return required.some((p) => granted.has(p));
  }

  async assertRestaurantFeature(organizationId: string, featureKey: FeatureEntitlementKey): Promise<void> {
    const allowed = await this.canRestaurantUse(organizationId, featureKey);
    if (!allowed) {
      throw new Error(`Feature not enabled: ${featureKey}`);
    }
  }

  async assertEmployeeFeature(
    organizationId: string,
    permissions: string[] | undefined,
    featureKey: FeatureEntitlementKey,
  ): Promise<void> {
    const restaurantOk = await this.canRestaurantUse(organizationId, featureKey);
    if (!restaurantOk) {
      throw new Error(`Feature not enabled: ${featureKey}`);
    }
    if (!this.canEmployeeAct(permissions, featureKey)) {
      throw new Error(`Permission denied for feature: ${featureKey}`);
    }
  }

  async bumpConfigVersion(organizationId: string): Promise<number> {
    const org = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { configVersion: { increment: 1 } },
      select: { configVersion: true },
    });
    this.cache.delete(organizationId);
    return org.configVersion;
  }

  invalidateCache(organizationId: string): void {
    this.cache.delete(organizationId);
  }

  private async loadOrganization(organizationId: string): Promise<OrgCapabilityRow> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        id: true,
        operatingMode: true,
        subscriptionPlan: true,
        configVersion: true,
        moduleOverrides: { select: { moduleKey: true, enabled: true } },
        featureOverrides: { select: { featureKey: true, state: true, expiresAt: true } },
      },
    });
    return {
      id: org.id,
      operatingMode: org.operatingMode as OperatingMode,
      subscriptionPlan: org.subscriptionPlan as SubscriptionPlanId,
      configVersion: org.configVersion,
      moduleOverrides: org.moduleOverrides,
      featureOverrides: org.featureOverrides.map((f) => ({
        featureKey: f.featureKey,
        state: f.state as FeatureOverrideState,
        expiresAt: f.expiresAt,
      })),
    };
  }

  private buildResolved(org: OrgCapabilityRow): ResolvedCapabilities {
    const planDefaults = PLAN_DEFAULTS[org.subscriptionPlan] ?? PLAN_DEFAULTS.LEGACY_FULL;
    const modules = { ...planDefaults.modules };
    const features = { ...planDefaults.features };

    for (const override of org.moduleOverrides) {
      if (ALL_MODULE_KEYS.includes(override.moduleKey as ModuleKey)) {
        modules[override.moduleKey as ModuleKey] = override.enabled;
      }
    }

    const now = Date.now();
    for (const override of org.featureOverrides) {
      if (!ALL_FEATURE_KEYS.includes(override.featureKey as FeatureEntitlementKey)) continue;
      if (override.expiresAt && override.expiresAt.getTime() < now) continue;
      const key = override.featureKey as FeatureEntitlementKey;
      if (override.state === "ENABLED") features[key] = true;
      if (override.state === "DISABLED" || override.state === "READ_ONLY") features[key] = false;
    }

    return {
      organizationId: org.id,
      operatingMode: org.operatingMode,
      subscriptionPlan: org.subscriptionPlan,
      configVersion: org.configVersion,
      modules,
      features,
      navDepth: MODE_NAV_DEPTH[org.operatingMode] ?? MODE_NAV_DEPTH.STANDARD,
    };
  }
}
