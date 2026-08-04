import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { ReservationsService } from "./reservations.service";
import { JwtAuthGuard } from "../auth/guards";

@ApiTags("reservations")
@Controller("reservations")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Get()
  findAll(@Query("outletId") outletId: string, @Query("date") date?: string) {
    return this.reservationsService.findByOutlet(outletId, date);
  }

  @Post()
  create(@Body() body: Record<string, unknown>) {
    return this.reservationsService.create(body as never);
  }

  @Patch(":id/seat")
  seat(@Param("id") id: string, @Body() body: { tableId: string }) {
    return this.reservationsService.seat(id, body.tableId);
  }

  @Patch(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.reservationsService.cancel(id);
  }
}
