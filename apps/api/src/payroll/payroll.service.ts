import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { calculatePayslip, grossFromAttendance, grossFromMonthly } from "@kaana/payroll";

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  async createRun(data: {
    organizationId: string;
    outletId?: string;
    periodStart: string;
    periodEnd: string;
  }) {
    const start = new Date(data.periodStart);
    const end = new Date(data.periodEnd);

    const attendance = await this.prisma.attendanceRecord.findMany({
      where: {
        ...(data.outletId ? { outletId: data.outletId } : {}),
        clockIn: { gte: start, lte: end },
        clockOut: { not: null },
      },
      include: { staff: true },
    });

    const run = await this.prisma.payrollRun.create({
      data: {
        organizationId: data.organizationId,
        outletId: data.outletId,
        periodStart: start,
        periodEnd: end,
        status: "draft",
      },
    });

    const hoursByUser = new Map<string, number>();
    for (const rec of attendance) {
      if (!rec.clockOut) continue;
      const hours = (rec.clockOut.getTime() - rec.clockIn.getTime()) / 3_600_000;
      hoursByUser.set(rec.userId, (hoursByUser.get(rec.userId) ?? 0) + hours);
    }

    let totalGross = 0;
    let totalNet = 0;

    for (const [userId, hours] of hoursByUser) {
      const profile = await this.prisma.staffProfile.findUnique({ where: { userId } });
      if (!profile) continue;

      const gross =
        profile.wageType === "hourly"
          ? grossFromAttendance(hours, Number(profile.hourlyRate ?? 0))
          : grossFromMonthly(Number(profile.monthlySalary ?? 0), Math.max(1, Math.ceil(hours / 8)));

      const slip = calculatePayslip({ userId, grossPay: gross, hoursWorked: hours });
      await this.prisma.payslip.create({
        data: {
          payrollRunId: run.id,
          userId,
          grossPay: slip.grossPay,
          deductions: slip.deductions,
          netPay: slip.netPay,
          hoursWorked: hours,
          breakdown: slip.breakdown,
        },
      });
      totalGross += slip.grossPay;
      totalNet += slip.netPay;
    }

    return this.prisma.payrollRun.update({
      where: { id: run.id },
      data: { totalGross, totalNet },
      include: {
        payslips: {
          include: { staff: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } },
        },
      },
    });
  }

  listRuns(organizationId: string) {
    return this.prisma.payrollRun.findMany({
      where: { organizationId },
      include: {
        payslips: {
          include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
        },
      },
      orderBy: { periodStart: "desc" },
    });
  }

  approveRun(id: string) {
    return this.prisma.payrollRun.update({
      where: { id },
      data: { status: "approved", approvedAt: new Date() },
    });
  }
}
