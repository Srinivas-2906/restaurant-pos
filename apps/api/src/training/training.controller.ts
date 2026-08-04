import { Controller, Get, Post, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { TrainingService } from "./training.service";
import { JwtAuthGuard, Roles } from "../auth/guards";

@ApiTags("training")
@Controller("training")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TrainingController {
  constructor(private trainingService: TrainingService) {}

  @Post("modules")
  @Roles("owner", "manager")
  createModule(@Body() body: Record<string, unknown>) {
    return this.trainingService.createModule(body as never);
  }

  @Get("modules")
  listModules() {
    return this.trainingService.listModules();
  }

  @Post("assign")
  @Roles("manager")
  assign(@Body() body: { userId: string; triggerAction: string; reason: string }) {
    return this.trainingService.assignFromMistake(body.userId, body.triggerAction, body.reason);
  }

  @Get("assignments")
  assignments(@Query("userId") userId: string) {
    return this.trainingService.listAssignments(userId);
  }

  @Post("assignments/:id/complete")
  complete(@Param("id") id: string) {
    return this.trainingService.completeAssignment(id);
  }
}
