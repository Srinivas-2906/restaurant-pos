import { Controller, Get, Post, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { MarginsService } from "./margins.service";
import { JwtAuthGuard, Roles } from "../auth/guards";

@ApiTags("margins")
@Controller("margins")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarginsController {
  constructor(private marginsService: MarginsService) {}

  @Post("orders/:orderId/snapshot")
  @Roles("owner", "manager", "accountant")
  snapshot(@Param("orderId") orderId: string) {
    return this.marginsService.snapshotOrder(orderId);
  }

  @Get("outlet/:outletId")
  @Roles("owner", "manager", "accountant")
  report(@Param("outletId") outletId: string) {
    return this.marginsService.getOutletReport(outletId);
  }

  @Get("outlet/:outletId/items")
  @Roles("owner", "manager")
  itemRanking(@Param("outletId") outletId: string) {
    return this.marginsService.getItemRanking(outletId);
  }
}
