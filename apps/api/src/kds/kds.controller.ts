import { Controller, Get, Patch, Param, Query, UseGuards } from "@nestjs/common";
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

  @Get("outlets/:outletId/aggregated")
  getAggregated(@Param("outletId") outletId: string) {
    return this.kdsService.getAggregatedItems(outletId);
  }

  @Patch("kot/:kotId/ready")
  markReady(@Param("kotId") kotId: string) {
    return this.kdsService.markReady(kotId);
  }

  @Patch("kot/:kotId/preparing")
  markPreparing(@Param("kotId") kotId: string) {
    return this.kdsService.markPreparing(kotId);
  }
}
