import { Controller, Get, Post, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { StaffService } from "./staff.service";
import { JwtAuthGuard, Roles } from "../auth/guards";

@ApiTags("staff")
@Controller("staff")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Post("profiles")
  @Roles("manager", "owner")
  createProfile(@Body() body: Record<string, unknown>) {
    return this.staffService.createProfile(body as never);
  }

  @Get("outlets/:outletId")
  @Roles("manager", "owner", "inventory_manager")
  list(@Param("outletId") outletId: string) {
    return this.staffService.listByOutlet(outletId);
  }

  @Post("shifts")
  @Roles("manager", "owner")
  createShift(@Body() body: Record<string, unknown>) {
    return this.staffService.createShift(body as never);
  }

  @Get("outlets/:outletId/shifts")
  @Roles("manager", "owner")
  shifts(@Param("outletId") outletId: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.staffService.listShifts(outletId, from, to);
  }

  @Post("clock-in")
  @Roles("manager", "biller", "captain", "chef")
  clockIn(@Body() body: { outletId: string; userId: string; source?: string }) {
    return this.staffService.clockIn(body.outletId, body.userId, body.source);
  }

  @Post("clock-out/:recordId")
  @Roles("manager", "biller", "captain", "chef")
  clockOut(@Param("recordId") recordId: string) {
    return this.staffService.clockOut(recordId);
  }

  @Get("outlets/:outletId/on-floor")
  @Roles("manager", "owner")
  onFloor(@Param("outletId") outletId: string) {
    return this.staffService.onFloor(outletId);
  }
}
