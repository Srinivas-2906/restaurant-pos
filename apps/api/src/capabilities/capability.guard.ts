import {

  CanActivate,

  ExecutionContext,

  ForbiddenException,

  Injectable,

  SetMetadata,

} from "@nestjs/common";

import { ConfigService } from "@nestjs/config";

import { Reflector } from "@nestjs/core";

import type { FeatureEntitlementKey, ModuleKey } from "@kaana/shared-types";

import { CapabilityService } from "./capability.service";



export const REQUIRE_FEATURE_KEY = "requireFeature";

export const REQUIRE_MODULE_KEY = "requireModule";



export const RequireFeature = (featureKey: FeatureEntitlementKey) =>

  SetMetadata(REQUIRE_FEATURE_KEY, featureKey);



export const RequireModule = (moduleKey: ModuleKey) =>

  SetMetadata(REQUIRE_MODULE_KEY, moduleKey);



@Injectable()

export class CapabilityGuard implements CanActivate {

  constructor(

    private reflector: Reflector,

    private capabilities: CapabilityService,

    private config: ConfigService,

  ) {}



  async canActivate(context: ExecutionContext): Promise<boolean> {

    const featureKey = this.reflector.getAllAndOverride<FeatureEntitlementKey | undefined>(

      REQUIRE_FEATURE_KEY,

      [context.getHandler(), context.getClass()],

    );

    const moduleKey = this.reflector.getAllAndOverride<ModuleKey | undefined>(REQUIRE_MODULE_KEY, [

      context.getHandler(),

      context.getClass(),

    ]);

    if (!featureKey && !moduleKey) return true;



    const req = context.switchToHttp().getRequest();

    const user = req.user as { organizationId?: string; permissions?: string[] } | undefined;

    if (!user?.organizationId) {

      throw new ForbiddenException("Organization context required");

    }



    const enforcement = this.config.get<string>("CAPABILITY_ENFORCEMENT", "true") !== "false";

    if (!enforcement) return true;



    const resolved = await this.capabilities.resolveForOrganization(user.organizationId);



    if (moduleKey && !resolved.modules[moduleKey]) {

      throw new ForbiddenException(`Module not enabled: ${moduleKey}`);

    }



    if (featureKey) {

      const restaurantOk = resolved.features[featureKey] === true;

      if (!restaurantOk) {

        throw new ForbiddenException(`Feature not enabled: ${featureKey}`);

      }



      const employeeOk = this.capabilities.canEmployeeAct(user.permissions, featureKey);

      if (!employeeOk) {

        throw new ForbiddenException(`Permission denied for feature: ${featureKey}`);

      }

    }



    return true;

  }

}


