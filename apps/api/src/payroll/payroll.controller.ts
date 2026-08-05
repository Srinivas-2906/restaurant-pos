import { Controller, Get, Post, Body, Param, UseGuards, Request, Res } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import type { Response } from "express";
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

  @Get("runs/:id")
  @Roles("accountant", "owner", "manager")
  getRun(@Param("id") id: string) {
    return this.payrollService.getRun(id);
  }

  @Post("runs/:id/approve")
  @Roles("accountant", "owner")
  approve(@Param("id") id: string) {
    return this.payrollService.approveRun(id);
  }

  @Post("runs/:id/mark-paid")
  @Roles("accountant", "owner")
  markPaid(@Param("id") id: string, @Request() req: { user: { id: string } }) {
    return this.payrollService.markPaid(id, req.user.id);
  }

  @Get("runs/:id/export.csv")
  @Roles("accountant", "owner")
  async exportCsv(@Param("id") id: string, @Res() res: Response) {
    const { filename, csv } = await this.payrollService.exportCsv(id);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get("payslips/:id")
  @Roles("accountant", "owner", "manager")
  getPayslip(@Param("id") id: string) {
    return this.payrollService.getPayslip(id);
  }
}
