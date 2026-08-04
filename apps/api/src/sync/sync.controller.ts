import { Controller, Get, Post, Body, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { SyncService } from "./sync.service";
import { JwtAuthGuard } from "../auth/guards";
import type { SyncBatchRequest } from "@kaana/sync-protocol";

@ApiTags("sync")
@Controller("sync")
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post("batch")
  ingestBatch(@Body() body: SyncBatchRequest) {
    return this.syncService.ingestBatch(body);
  }

  @Post("enqueue")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  enqueue(@Request() req: { user: { userId: string; outletId?: string } }, @Body() body: Record<string, unknown>) {
    return this.syncService.enqueue({
      ...body,
      userId: req.user.userId,
      outletId: (body.outletId as string) ?? req.user.outletId!,
    } as never);
  }

  @Get("pending")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getPending(@Query("clientId") clientId: string) {
    return this.syncService.getPending(clientId);
  }

  @Post("replay")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  replay(@Body() body: { clientId: string }) {
    return this.syncService.replay(body.clientId);
  }
}
