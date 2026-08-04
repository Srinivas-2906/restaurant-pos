import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  createProfile(data: {
    userId: string; outletId?: string; employeeCode: string;
    wageType?: "hourly" | "monthly"; hourlyRate?: number; monthlySalary?: number;
  }) {
    return this.prisma.staffProfile.create({ data: data as never });
  }

  listByOutlet(outletId: string) {
    return this.prisma.staffProfile.findMany({
      where: { outletId, isActive: true },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
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

  onFloor(outletId: string) {
    return this.prisma.attendanceRecord.findMany({
      where: { outletId, clockOut: null },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
  }
}
