import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from "@nestjs/common";
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

  @Patch("profiles/:id")
  @Roles("manager", "owner")
  updateProfile(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.staffService.updateProfile(id, body);
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

  @Get("outlets/:outletId/attendance")
  @Roles("manager", "owner")
  attendanceSummary(@Param("outletId") outletId: string, @Query("date") date?: string) {
    return this.staffService.getAttendanceSummary(outletId, date);
  }

  @Get("outlets/:outletId/attendance/history")
  @Roles("manager", "owner", "accountant")
  attendanceHistory(
    @Param("outletId") outletId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.staffService.getAttendanceHistory(outletId, from, to);
  }

  @Get("departments")
  @Roles("manager", "owner")
  departments(@Request() req: { user: { organizationId: string } }) {
    return this.staffService.listDepartments(req.user.organizationId);
  }

  @Post("departments")
  @Roles("manager", "owner")
  createDepartment(@Request() req: { user: { organizationId: string } }, @Body() body: { name: string }) {
    return this.staffService.createDepartment(req.user.organizationId, body.name);
  }

  @Post("designations")
  @Roles("manager", "owner")
  createDesignation(
    @Request() req: { user: { organizationId: string } },
    @Body() body: { name: string; departmentId?: string },
  ) {
    return this.staffService.createDesignation(req.user.organizationId, body.name, body.departmentId);
  }

  @Get("outlets/:outletId/leaves")
  @Roles("manager", "owner")
  leaves(@Param("outletId") outletId: string) {
    return this.staffService.listLeaves(outletId);
  }

  @Post("outlets/:outletId/leaves")
  @Roles("manager", "owner")
  createLeave(
    @Param("outletId") outletId: string,
    @Body() body: { userId: string; type?: string; startDate: string; endDate: string; reason?: string },
  ) {
    return this.staffService.createLeave({ outletId, ...body });
  }

  @Patch("leaves/:id/status")
  @Roles("manager", "owner")
  updateLeaveStatus(@Param("id") id: string, @Body() body: { status: "approved" | "rejected" | "cancelled" }) {
    return this.staffService.updateLeaveStatus(id, body.status);
  }

  @Get("outlets/:outletId/holidays")
  @Roles("manager", "owner", "accountant")
  holidays(@Param("outletId") outletId: string) {
    return this.staffService.listHolidays(outletId);
  }

  @Post("outlets/:outletId/holidays")
  @Roles("manager", "owner")
  createHoliday(@Param("outletId") outletId: string, @Body() body: { date: string; name: string }) {
    return this.staffService.createHoliday(outletId, body.date, body.name);
  }
}
