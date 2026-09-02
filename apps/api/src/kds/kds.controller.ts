import { Controller, Get, Patch, Param, Request, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { KdsService } from "./kds.service";
import { JwtAuthGuard } from "../auth/guards";

@ApiTags("kds")
@Controller("kds")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KdsController {
  constructor(private kdsService: KdsService) {}

  @Get("stations/:stationId/queue")
  getQueue(@Param("stationId") stationId: string) {
    return this.kdsService.getStationQueue(stationId);
  }

  @Get("outlets/:outletId/queue")
  getOutletQueue(@Param("outletId") outletId: string) {
    return this.kdsService.getOutletQueue(outletId);
  }

  @Get("outlets/:outletId/aggregated")
  getAggregated(@Param("outletId") outletId: string) {
    return this.kdsService.getAggregatedItems(outletId);
  }

  @Patch("kot/:kotId/ready")
  markReady(@Param("kotId") kotId: string, @Request() req: { user: { userId: string } }) {
    return this.kdsService.markReady(kotId, req.user.userId);
  }

  @Patch("kot/:kotId/preparing")
  markPreparing(@Param("kotId") kotId: string, @Request() req: { user: { userId: string } }) {
    return this.kdsService.markPreparing(kotId, req.user.userId);
  }
}
