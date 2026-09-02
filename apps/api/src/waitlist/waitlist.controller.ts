import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { CreateWaitlistEntrySchema, ReorderWaitlistSchema } from "@kaana/shared-types";
import { WaitlistService } from "./waitlist.service";
import { JwtAuthGuard } from "../auth/guards";

@ApiTags("waitlist")
@Controller("waitlist")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WaitlistController {
  constructor(private waitlistService: WaitlistService) {}

  @Get()
  findAll(@Query("outletId") outletId: string) {
    return this.waitlistService.findByOutlet(outletId);
  }

  @Post()
  create(@Body() body: unknown) {
    const data = CreateWaitlistEntrySchema.parse(body);
    return this.waitlistService.create(data);
  }

  @Patch("reorder")
  reorder(@Body() body: unknown) {
    const { outletId, orderedIds } = ReorderWaitlistSchema.parse(body);
    return this.waitlistService.reorder(outletId, orderedIds);
  }

  @Patch(":id/notify")
  notify(@Param("id") id: string) {
    return this.waitlistService.notify(id);
  }

  @Patch(":id/promote")
  promote(@Param("id") id: string, @Body() body: { date?: string }) {
    return this.waitlistService.promote(id, body?.date);
  }

  @Patch(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.waitlistService.cancel(id);
  }
}
