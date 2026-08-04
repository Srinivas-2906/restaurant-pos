import { Controller, Get, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard, Roles } from "../auth/guards";

@ApiTags("reports")
@Controller("reports")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get("sales")
  @Roles("accountant", "owner", "manager")
  sales(@Query("outletId") outletId: string, @Query("from") from: string, @Query("to") to: string) {
    return this.reportsService.salesReport(outletId, from, to);
  }

  @Get("items")
  @Roles("accountant", "owner", "manager")
  items(@Query("outletId") outletId: string, @Query("from") from: string, @Query("to") to: string) {
    return this.reportsService.itemWiseReport(outletId, from, to);
  }

  @Get("gst/export")
  @Roles("accountant", "owner")
  gstExport(@Query("outletId") outletId: string, @Query("from") from: string, @Query("to") to: string) {
    return this.reportsService.gstExport(outletId, from, to);
  }

  @Get("inventory")
  @Roles("accountant", "owner", "inventory_manager")
  inventory(@Query("outletId") outletId: string) {
    return this.reportsService.inventoryReport(outletId);
  }

  @Get("outlets/comparison")
  @Roles("accountant", "owner")
  outletComparison(@Request() req: { user: { organizationId: string } }, @Query("from") from: string, @Query("to") to: string) {
    return this.reportsService.outletComparison(req.user.organizationId, from, to);
  }

  @Get("wastage")
  @Roles("accountant", "owner", "inventory_manager")
  wastage(@Query("outletId") outletId: string, @Query("from") from: string, @Query("to") to: string) {
    return this.reportsService.wastageReport(outletId, from, to);
  }

  @Get("reconciliation")
  @Roles("accountant", "owner")
  reconciliation(@Query("outletId") outletId: string, @Query("from") from: string, @Query("to") to: string) {
    return this.reportsService.reconciliation(outletId, from, to);
  }
}
