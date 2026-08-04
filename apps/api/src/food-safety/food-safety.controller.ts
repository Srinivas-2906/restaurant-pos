import { Controller, Get, Post, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { FoodSafetyService } from "./food-safety.service";
import { JwtAuthGuard, Roles } from "../auth/guards";

@ApiTags("food-safety")
@Controller("food-safety")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FoodSafetyController {
  constructor(private foodSafetyService: FoodSafetyService) {}

  @Post("temperature")
  @Roles("manager", "inventory_manager", "chef")
  logTemp(@Body() body: Record<string, unknown>) {
    return this.foodSafetyService.logTemperature(body as never);
  }

  @Get("temperature")
  @Roles("owner", "manager")
  listTemps(@Query("outletId") outletId: string) {
    return this.foodSafetyService.listTemperatureLogs(outletId);
  }

  @Post("cleaning")
  @Roles("manager")
  createTask(@Body() body: Record<string, unknown>) {
    return this.foodSafetyService.createCleaningTask(body as never);
  }

  @Get("cleaning")
  @Roles("manager", "owner")
  listTasks(@Query("outletId") outletId: string) {
    return this.foodSafetyService.listCleaningTasks(outletId);
  }

  @Post("cleaning/:id/done")
  @Roles("manager", "inventory_manager")
  markDone(@Param("id") id: string) {
    return this.foodSafetyService.markCleaningDone(id);
  }
}
