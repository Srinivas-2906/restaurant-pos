import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FoodSafetyService {
  constructor(private prisma: PrismaService) {}

  logTemperature(data: { outletId: string; equipmentId: string; temperature: number; recordedBy?: string; notes?: string }) {
    return this.prisma.temperatureLog.create({ data });
  }

  listTemperatureLogs(outletId: string) {
    return this.prisma.temperatureLog.findMany({ where: { outletId }, orderBy: { recordedAt: "desc" }, take: 50 });
  }

  createCleaningTask(data: { outletId: string; taskName: string; frequency: string; nextDueAt: Date; assignedTo?: string }) {
    return this.prisma.cleaningSchedule.create({ data });
  }

  listCleaningTasks(outletId: string) {
    return this.prisma.cleaningSchedule.findMany({ where: { outletId }, orderBy: { nextDueAt: "asc" } });
  }

  markCleaningDone(id: string) {
    const task = this.prisma.cleaningSchedule.findUniqueOrThrow({ where: { id } });
    return task.then((t) => {
      const nextDue = new Date();
      if (t.frequency === "daily") nextDue.setDate(nextDue.getDate() + 1);
      else if (t.frequency === "weekly") nextDue.setDate(nextDue.getDate() + 7);
      else nextDue.setMonth(nextDue.getMonth() + 1);
      return this.prisma.cleaningSchedule.update({
        where: { id },
        data: { lastDoneAt: new Date(), nextDueAt: nextDue },
      });
    });
  }
}
