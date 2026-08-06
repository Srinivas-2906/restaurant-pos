import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  calculatePayslip,
  grossFromAttendance,
  grossFromMonthly,
  calculatePayableDays,
  daysInPeriod,
} from "@kaana/payroll";

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
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const periodDays = daysInPeriod(start, end);

    const [attendance, leaves, holidays, staffProfiles] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: {
          ...(data.outletId ? { outletId: data.outletId } : {}),
          clockIn: { gte: start, lte: end },
          clockOut: { not: null },
        },
        include: { staff: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          ...(data.outletId ? { outletId: data.outletId } : {}),
          status: "approved",
          startDate: { lte: end },
          endDate: { gte: start },
        },
      }),
      this.prisma.holiday.findMany({
        where: {
          ...(data.outletId ? { outletId: data.outletId } : {}),
          date: { gte: start, lte: end },
        },
      }),
      this.prisma.staffProfile.findMany({
        where: {
          isActive: true,
          ...(data.outletId ? { outletId: data.outletId } : {}),
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          department: true,
          designation: true,
        },
      }),
    ]);

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
    const daysWorkedByUser = new Map<string, Set<string>>();
    for (const rec of attendance) {
      if (!rec.clockOut) continue;
      const hours = (rec.clockOut.getTime() - rec.clockIn.getTime()) / 3_600_000;
      hoursByUser.set(rec.userId, (hoursByUser.get(rec.userId) ?? 0) + hours);
      const dayKey = rec.clockIn.toISOString().slice(0, 10);
      const set = daysWorkedByUser.get(rec.userId) ?? new Set<string>();
      set.add(dayKey);
      daysWorkedByUser.set(rec.userId, set);
    }

    const paidLeaveDaysByUser = new Map<string, number>();
    for (const leave of leaves) {
      const leaveStart = leave.startDate < start ? start : leave.startDate;
      const leaveEnd = leave.endDate > end ? end : leave.endDate;
      const days =
        Math.floor((leaveEnd.getTime() - leaveStart.getTime()) / 86_400_000) + 1;
      paidLeaveDaysByUser.set(leave.userId, (paidLeaveDaysByUser.get(leave.userId) ?? 0) + days);
    }

    const holidayCount = holidays.length;
    let totalGross = 0;
    let totalNet = 0;

    for (const profile of staffProfiles) {
      const hours = hoursByUser.get(profile.userId) ?? 0;
      const workedDays = daysWorkedByUser.get(profile.userId)?.size ?? 0;
      const paidLeaveDays = paidLeaveDaysByUser.get(profile.userId) ?? 0;

      if (profile.wageType === "hourly" && hours <= 0) continue;
      if (profile.wageType === "monthly" && workedDays <= 0 && paidLeaveDays <= 0) continue;

      const payableDays =
        profile.wageType === "monthly"
          ? calculatePayableDays({
              periodStart: start,
              periodEnd: end,
              workedDays,
              weeklyOffDays: Math.floor(periodDays / 7),
              holidays: holidayCount,
              paidLeaveDays,
            })
          : workedDays;

      const gross =
        profile.wageType === "hourly"
          ? grossFromAttendance(hours, Number(profile.hourlyRate ?? 0))
          : grossFromMonthly(Number(profile.monthlySalary ?? 0), payableDays, periodDays);

      const slip = calculatePayslip({ userId: profile.userId, grossPay: gross, hoursWorked: hours });
      await this.prisma.payslip.create({
        data: {
          payrollRunId: run.id,
          userId: profile.userId,
          grossPay: slip.grossPay,
          deductions: slip.deductions,
          netPay: slip.netPay,
          hoursWorked: hours,
          breakdown: {
            ...slip.breakdown,
            workedDays,
            payableDays,
            paidLeaveDays,
            holidays: holidayCount,
          },
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
          include: {
            staff: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true } },
                department: true,
                designation: true,
              },
            },
          },
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

  async getRun(id: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: {
        payslips: {
          include: {
            staff: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true } },
                department: true,
                designation: true,
              },
            },
          },
        },
        outlet: true,
      },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    return run;
  }

  async getPayslip(id: string) {
    const slip = await this.prisma.payslip.findUnique({
      where: { id },
      include: {
        payrollRun: { include: { outlet: true, organization: true } },
        staff: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            department: true,
            designation: true,
          },
        },
      },
    });
    if (!slip) throw new NotFoundException("Payslip not found");
    return slip;
  }

  approveRun(id: string) {
    return this.prisma.payrollRun.update({
      where: { id },
      data: { status: "approved", approvedAt: new Date() },
    });
  }

  markPaid(id: string, paidById?: string) {
    return this.prisma.payrollRun.update({
      where: { id },
      data: { status: "paid", paidAt: new Date(), paidById },
    });
  }

  async exportCsv(id: string) {
    const run = await this.getRun(id);
    const rows = run.payslips.map((s) => {
      const name = `${s.staff.user.firstName} ${s.staff.user.lastName ?? ""}`.trim();
      return [
        s.staff.employeeCode,
        name,
        s.staff.bankAccount ?? "",
        s.staff.ifsc ?? "",
        Number(s.netPay).toFixed(2),
      ].join(",");
    });
    return {
      filename: `payroll-${run.id.slice(-8)}.csv`,
      csv: ["Employee Code,Name,Bank Account,IFSC,Net Pay", ...rows].join("\n"),
    };
  }
}
