import { Controller, Post, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PartnerService } from "./partner.service";
import { JwtAuthGuard } from "../auth/guards";

@ApiTags("partner")
@Controller("v1")
export class PartnerController {
  constructor(private partnerService: PartnerService) {}

  @Post("menu/fetch")
  fetchMenu(@Body() body: { restId: string }) {
    return this.partnerService.fetchMenu(body.restId);
  }

  @Post("orders/save")
  saveOrder(@Body() body: Record<string, unknown>) {
    return this.partnerService.saveOrder(body as never);
  }

  @Post("stock/sync")
  pushStock(@Body() body: { restId: string; items: Array<{ itemId: string; isAvailable: boolean }> }) {
    return this.partnerService.pushStock(body.restId, body.items);
  }

  @Post("simulate/:outletId/:source")
  @UseGuards(JwtAuthGuard)
  simulate(@Param("outletId") outletId: string, @Param("source") source: "swiggy" | "zomato") {
    return this.partnerService.simulateOrder(outletId, source);
  }
}
