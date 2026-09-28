import { Controller, Get, Patch, Param, Request, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { APP_ACCESS } from "@kaana/shared-types";
import { KdsService } from "./kds.service";
import { JwtAuthGuard, Roles } from "../auth/guards";
import { RequireAppAccess } from "../auth/permissions.decorator";
import { OutletScopeService, type ScopedAuthUser } from "../auth/outlet-scope.service";
import { CapabilityGuard, RequireModule } from "../capabilities/capability.guard";
import { auditActorFromUser } from "../auth/audit-actor.util";

function auditActor(req: { user: ScopedAuthUser }) {
  return auditActorFromUser(req.user);
}

@ApiTags("kds")
@Controller("kds")
@UseGuards(JwtAuthGuard, CapabilityGuard)
@RequireModule("kds")
@ApiBearerAuth()
@RequireAppAccess(APP_ACCESS.access_kds)
export class KdsController {
  constructor(
    private kdsService: KdsService,
    private outletScope: OutletScopeService,
  ) {}

  @Get("stations/:stationId/queue")
  @Roles("chef", "manager", "owner")
  async getQueue(@Request() req: { user: ScopedAuthUser }, @Param("stationId") stationId: string) {
    const station = await this.outletScope.assertStationInOrganization(
      stationId,
      req.user.organizationId,
    );
    await this.outletScope.assertUserOutletAccess(req.user, station.outletId);
    return this.kdsService.getStationQueue(stationId);
  }

  @Get("outlets/:outletId/queue")
  @Roles("chef", "manager", "owner")
  async getOutletQueue(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.kdsService.getOutletQueue(outletId);
  }

  @Get("outlets/:outletId/aggregated")
  @Roles("chef", "manager", "owner")
  async getAggregated(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.kdsService.getAggregatedItems(outletId);
  }

  @Patch("kot/:kotId/ready")
  @Roles("chef", "manager")
  async markReady(@Request() req: { user: ScopedAuthUser }, @Param("kotId") kotId: string) {
    const kot = await this.outletScope.assertKotInOrganization(kotId, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, kot.order.outletId);
    return this.kdsService.markReady(kotId, auditActor(req));
  }

  @Patch("kot/:kotId/preparing")
  @Roles("chef", "manager")
  async markPreparing(@Request() req: { user: ScopedAuthUser }, @Param("kotId") kotId: string) {
    const kot = await this.outletScope.assertKotInOrganization(kotId, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, kot.order.outletId);
    return this.kdsService.markPreparing(kotId, auditActor(req));
  }
}
