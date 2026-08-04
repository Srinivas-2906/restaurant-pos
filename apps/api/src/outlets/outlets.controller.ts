import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { OutletsService } from "./outlets.service";
import { JwtAuthGuard } from "../auth/guards";

@ApiTags("outlets")
@Controller("outlets")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OutletsController {
  constructor(private outletsService: OutletsService) {}

  @Get()
  findAll(@Query("brandId") brandId: string) {
    return this.outletsService.findByBrand(brandId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.outletsService.findOne(id);
  }

  @Post()
  create(@Body() body: Record<string, unknown>) {
    return this.outletsService.create(body as never);
  }

  @Get(":id/floor")
  getFloor(@Param("id") id: string) {
    return this.outletsService.getFloorPlan(id);
  }

  @Patch("tables/:tableId/status")
  updateTableStatus(@Param("tableId") tableId: string, @Body() body: { status: string }) {
    return this.outletsService.updateTableStatus(tableId, body.status);
  }

  @Post(":id/terminals")
  createTerminal(@Param("id") id: string, @Body() body: { name: string; code: string; isMaster?: boolean }) {
    return this.outletsService.createTerminal(id, body);
  }
}
