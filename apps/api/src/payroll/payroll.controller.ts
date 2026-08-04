import { Controller, Get, Post, Body, Param, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { PayrollService } from "./payroll.service";
import { JwtAuthGuard, Roles } from "../auth/guards";

@ApiTags("payroll")
@Controller("payroll")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PayrollController {
  constructor(private payrollService: PayrollService) {}

  @Post("runs")
  @Roles("accountant", "owner")
  createRun(
    @Request() req: { user: { organizationId: string } },
    @Body() body: { outletId?: string; periodStart: string; periodEnd: string },
  ) {
    return this.payrollService.createRun({
      organizationId: req.user.organizationId,
      ...body,
    });
  }

  @Get("runs")
  @Roles("accountant", "owner", "manager")
  listRuns(@Request() req: { user: { organizationId: string } }) {
    return this.payrollService.listRuns(req.user.organizationId);
  }

  @Post("runs/:id/approve")
  @Roles("accountant", "owner")
  approve(@Param("id") id: string) {
    return this.payrollService.approveRun(id);
  }
}
