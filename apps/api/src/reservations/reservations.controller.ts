import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import {
  CreateReservationSchema,
  UpdateReservationSchema,
  AssignTableSchema,
  OpenReservationOrderSchema,
  PublicCreateReservationSchema,
} from "@kaana/shared-types";
import { ReservationsService } from "./reservations.service";
import { JwtAuthGuard } from "../auth/guards";
import { Public } from "../auth/public.decorator";

@ApiTags("reservations")
@Controller("reservations")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Get()
  findAll(
    @Query("outletId") outletId: string,
    @Query("date") date?: string,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.reservationsService.findByOutlet(outletId, { date, status, from, to });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.reservationsService.findOne(id);
  }

  @Post()
  create(@Body() body: unknown) {
    const data = CreateReservationSchema.parse(body);
    return this.reservationsService.create(data);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    const data = UpdateReservationSchema.parse(body);
    return this.reservationsService.update(id, data);
  }

  @Patch(":id/check-in")
  checkIn(@Param("id") id: string) {
    return this.reservationsService.checkIn(id);
  }

  @Patch(":id/assign-table")
  assignTable(@Param("id") id: string, @Body() body: unknown) {
    const { tableId } = AssignTableSchema.parse(body);
    return this.reservationsService.assignTable(id, tableId);
  }

  @Patch(":id/seat")
  seat(@Param("id") id: string, @Body() body: unknown) {
    const { tableId } = AssignTableSchema.parse(body);
    return this.reservationsService.seat(id, tableId);
  }

  @Patch(":id/open-order")
  openOrder(@Param("id") id: string, @Body() body: unknown) {
    const data = OpenReservationOrderSchema.parse(body ?? {});
    return this.reservationsService.openOrder(id, data);
  }

  @Patch(":id/complete")
  complete(@Param("id") id: string) {
    return this.reservationsService.complete(id);
  }

  @Patch(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.reservationsService.cancel(id);
  }

  @Patch(":id/no-show")
  markNoShow(@Param("id") id: string) {
    return this.reservationsService.markNoShow(id);
  }
}

@ApiTags("public-reservations")
@Controller("public/outlets")
export class PublicReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Public()
  @Get(":slug")
  getOutlet(@Param("slug") slug: string) {
    return this.reservationsService.getPublicOutlet(slug);
  }

  @Public()
  @Post(":slug/reservations")
  create(@Param("slug") slug: string, @Body() body: unknown) {
    const data = PublicCreateReservationSchema.parse(body);
    return this.reservationsService.createPublic(slug, data);
  }
}
