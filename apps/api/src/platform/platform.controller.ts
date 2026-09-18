import { Body, Controller, Get, Param, Patch, Query, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, Roles } from "../auth/guards";
import { PlatformService } from "./platform.service";

@Controller("platform")
@UseGuards(JwtAuthGuard)
@Roles("super_admin")
export class PlatformController {
  constructor(private platform: PlatformService) {}

  @Get("tenants")
  listTenants(@Query("q") q?: string) {
    return this.platform.listTenants(q);
  }

  @Get("tenants/:id")
  getTenant(@Param("id") id: string) {
    return this.platform.getTenant(id);
  }

  @Patch("tenants/:id/config")
  updateTenantConfig(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Request() req: { user: { userId: string } },
  ) {
    return this.platform.updateTenantConfig(id, body as never, req.user.userId);
  }

  @Get("devices/health")
  deviceHealth() {
    return this.platform.getDeviceHealthOverview();
  }
}
