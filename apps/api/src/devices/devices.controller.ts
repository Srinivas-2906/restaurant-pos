import { Controller, Get, Post, Body, Query, UseGuards, Request, Param } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { DevicesService } from "./devices.service";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@ApiTags("devices")
@Controller("devices")
export class DevicesController {
  constructor(private devicesService: DevicesService) {}

  @Post("register")
  register(@Body() body: Record<string, string>) {
    return this.devicesService.register(body as never);
  }

  @Post("heartbeat")
  heartbeat(@Body() body: Record<string, unknown>) {
    return this.devicesService.heartbeat(body as never);
  }

  @Get("outlet/:outletId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "manager", "super_admin")
  @ApiBearerAuth()
  findByOutlet(@Param("outletId") outletId: string) {
    return this.devicesService.findByOutlet(outletId);
  }

  @Get("health")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "manager", "super_admin")
  @ApiBearerAuth()
  healthDashboard(@Request() req: { user: { organizationId: string } }) {
    return this.devicesService.getHealthDashboard(req.user.organizationId);
  }

  @Get("unsynced")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "manager", "super_admin")
  @ApiBearerAuth()
  unsynced(@Query("outletId") outletId?: string) {
    return this.devicesService.findUnsynced(outletId);
  }
}
