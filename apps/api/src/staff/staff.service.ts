import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async createProfile(data: {
    userId: string;
    outletId?: string;
    employeeCode: string;
    wageType?: "hourly" | "monthly";
    hourlyRate?: number;
    monthlySalary?: number;
    displayName?: string;
    phone?: string;
    gender?: string;
    address?: string;
    departmentId?: string;
    designationId?: string;
    pfAccount?: string;
    uan?: string;
    esicNumber?: string;
    bankName?: string;
    bankAccount?: string;
    ifsc?: string;
    emergencyContact?: Record<string, unknown>;
  }) {
    if (!data.hourlyRate && !data.monthlySalary && data.outletId) {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        include: { roleAssignments: { where: { outletId: data.outletId }, take: 1 } },
      });
      const role = user?.roleAssignments[0]?.role;
      if (role) {
        const rule = await this.prisma.wageRule.findFirst({
          where: { OR: [{ outletId: data.outletId }, { outletId: null }], role },
        });
        if (rule) {
          data.wageType = rule.wageType;
          data.hourlyRate = rule.hourlyRate ? Number(rule.hourlyRate) : undefined;
          data.monthlySalary = rule.monthlySalary ? Number(rule.monthlySalary) : undefined;
        }
      }
    }
    return this.prisma.staffProfile.create({ data: data as never });
  }

  updateProfile(id: string, data: Record<string, unknown>) {
    return this.prisma.staffProfile.update({
      where: { id },
      data: data as never,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        department: true,
        designation: true,
      },
    });
  }

  listByOutlet(outletId: string) {
    return this.prisma.staffProfile.findMany({
      where: { outletId, isActive: true },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            roleAssignments: { where: { outletId }, select: { role: true } },
          },
        },
        department: true,
        designation: true,
      },
      orderBy: { employeeCode: "asc" },
    });
  }

  createShift(data: { outletId: string; userId: string; startAt: string; endAt: string; station?: string }) {
    return this.prisma.shiftSchedule.create({
      data: {
        outletId: data.outletId,
        userId: data.userId,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        station: data.station,
      },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
  }

  listShifts(outletId: string, from?: string, to?: string) {
    return this.prisma.shiftSchedule.findMany({
      where: {
        outletId,
        ...(from && to ? { startAt: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { startAt: "asc" },
    });
  }

  clockIn(outletId: string, userId: string, source = "pos") {
    return this.prisma.attendanceRecord.create({
      data: { outletId, userId, clockIn: new Date(), source },
    });
  }

  clockOut(recordId: string) {
    return this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { clockOut: new Date() },
    });
  }

  async onFloor(outletId: string) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { outletId, clockOut: null },
      include: {
        staff: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                roleAssignments: { where: { outletId }, select: { role: true } },
              },
            },
            designation: true,
          },
        },
      },
    });
    return records.map((r) => ({
      ...r,
      role: r.staff.user.roleAssignments[0]?.role ?? r.staff.designation?.name ?? null,
    }));
  }

  async getAttendanceSummary(outletId: string, date?: string) {
    const day = date ? new Date(date) : new Date();
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);

    const [staff, attendance, leaves, shifts] = await Promise.all([
      this.prisma.staffProfile.findMany({
        where: { outletId, isActive: true },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              roleAssignments: { where: { outletId }, select: { role: true } },
            },
          },
          designation: true,
        },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { outletId, clockIn: { gte: day, lt: next } },
        include: { staff: { include: { user: { select: { firstName: true, lastName: true } }, designation: true } } },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          outletId,
          status: "approved",
          startDate: { lte: day },
          endDate: { gte: day },
        },
      }),
      this.prisma.shiftSchedule.findMany({
        where: { outletId, startAt: { gte: day, lt: next } },
      }),
    ]);

    const onLeaveIds = new Set(leaves.map((l) => l.userId));
    const checkedIn = attendance.filter((a) => !a.clockOut || a.clockOut >= day);
    const checkedInIds = new Set(checkedIn.map((a) => a.userId));
    const scheduledIds = new Set(shifts.map((s) => s.userId));

    const notInYet = staff.filter(
      (s) => !checkedInIds.has(s.userId) && !onLeaveIds.has(s.userId) && scheduledIds.has(s.userId),
    );
    const onLeave = staff.filter((s) => onLeaveIds.has(s.userId));

    return {
      date: day.toISOString(),
      totals: {
        staff: staff.length,
        checkedIn: checkedIn.length,
        notInYet: notInYet.length,
        onLeave: onLeave.length,
      },
      checkedIn: checkedIn.map((a) => ({
        id: a.id,
        userId: a.userId,
        name: `${a.staff.user.firstName} ${a.staff.user.lastName ?? ""}`.trim(),
        role: a.staff.designation?.name ?? null,
        clockIn: a.clockIn,
        clockOut: a.clockOut,
        hoursWorked: a.clockOut
          ? (a.clockOut.getTime() - a.clockIn.getTime()) / 3_600_000
          : (Date.now() - a.clockIn.getTime()) / 3_600_000,
      })),
      notInYet: notInYet.map((s) => ({
        userId: s.userId,
        name: `${s.user.firstName} ${s.user.lastName ?? ""}`.trim(),
        role: s.designation?.name ?? s.user.roleAssignments[0]?.role ?? null,
      })),
      onLeave: onLeave.map((s) => ({
        userId: s.userId,
        name: `${s.user.firstName} ${s.user.lastName ?? ""}`.trim(),
      })),
    };
  }

  getAttendanceHistory(outletId: string, from?: string, to?: string) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        outletId,
        ...(from && to
          ? { clockIn: { gte: new Date(from), lte: new Date(to) } }
          : {}),
      },
      include: {
        staff: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            designation: true,
          },
        },
      },
      orderBy: { clockIn: "desc" },
    });
  }

  listDepartments(organizationId: string) {
    return this.prisma.department.findMany({
      where: { organizationId },
      include: { designations: true, _count: { select: { staff: true } } },
      orderBy: { name: "asc" },
    });
  }

  createDepartment(organizationId: string, name: string) {
    return this.prisma.department.create({ data: { organizationId, name } });
  }

  createDesignation(organizationId: string, name: string, departmentId?: string) {
    return this.prisma.designation.create({ data: { organizationId, name, departmentId } });
  }

  listLeaves(outletId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { outletId },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { startDate: "desc" },
    });
  }

  createLeave(data: {
    userId: string;
    outletId: string;
    type?: string;
    startDate: string;
    endDate: string;
    reason?: string;
  }) {
    return this.prisma.leaveRequest.create({
      data: {
        userId: data.userId,
        outletId: data.outletId,
        type: (data.type as never) ?? "casual",
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
      },
    });
  }

  updateLeaveStatus(id: string, status: "approved" | "rejected" | "cancelled") {
    return this.prisma.leaveRequest.update({ where: { id }, data: { status } });
  }

  listHolidays(outletId: string) {
    return this.prisma.holiday.findMany({ where: { outletId }, orderBy: { date: "asc" } });
  }

  createHoliday(outletId: string, date: string, name: string) {
    return this.prisma.holiday.create({ data: { outletId, date: new Date(date), name } });
  }
}
