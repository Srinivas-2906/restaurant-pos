import { Controller, Get, Patch, Post, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { CrmService } from "./crm.service";
import { JwtAuthGuard } from "../auth/guards";

@ApiTags("crm")
@Controller("crm")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CrmController {
  constructor(private crmService: CrmService) {}

  @Get("outlets/:outletId/customers")
  findAll(@Param("outletId") outletId: string, @Query("search") search?: string) {
    return this.crmService.findByOutlet(outletId, search);
  }

  @Get("outlets/:outletId/customers/:phone")
  findByPhone(@Param("outletId") outletId: string, @Param("phone") phone: string) {
    return this.crmService.findByPhone(outletId, phone);
  }

  @Patch("customers/:id")
  update(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.crmService.updateCustomer(id, body as never);
  }

  @Post("customers/:id/loyalty/earn")
  earnPoints(@Param("id") id: string, @Body() body: { points: number; orderId?: string }) {
    return this.crmService.earnPoints(id, body.points, body.orderId);
  }

  @Post("customers/:id/loyalty/redeem")
  redeemPoints(@Param("id") id: string, @Body() body: { points: number; orderId?: string }) {
    return this.crmService.redeemPoints(id, body.points, body.orderId);
  }
}
