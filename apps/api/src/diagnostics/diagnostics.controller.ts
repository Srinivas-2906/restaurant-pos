import { Controller, Get, Post, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { DiagnosticsService } from "./diagnostics.service";
import { JwtAuthGuard, Roles } from "../auth/guards";

@ApiTags("diagnostics")
@Controller("diagnostics")
export class DiagnosticsController {
  constructor(private diagnosticsService: DiagnosticsService) {}

  @Post("tickets")
  createTicket(@Body() body: Record<string, unknown>) {
    return this.diagnosticsService.createTicket(body as never);
  }

  @Get("tickets")
  @UseGuards(JwtAuthGuard)
  @Roles("owner", "manager")
  @ApiBearerAuth()
  listTickets(@Query("outletId") outletId: string) {
    return this.diagnosticsService.listTickets(outletId);
  }

  @Post("tickets/:id/resolve")
  @UseGuards(JwtAuthGuard)
  @Roles("owner", "manager")
  @ApiBearerAuth()
  resolve(@Param("id") id: string) {
    return this.diagnosticsService.resolveTicket(id);
  }

  @Get("devices")
  @UseGuards(JwtAuthGuard)
  @Roles("owner", "manager")
  @ApiBearerAuth()
  deviceHealth(@Query("outletId") outletId: string) {
    return this.diagnosticsService.getDeviceHealth(outletId);
  }
}
