import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TrainingService {
  constructor(private prisma: PrismaService) {}

  createModule(data: { title: string; content: string; triggerAction?: string; durationMin?: number }) {
    return this.prisma.trainingModule.create({ data });
  }

  listModules() {
    return this.prisma.trainingModule.findMany({ orderBy: { createdAt: "desc" } });
  }

  assignFromMistake(userId: string, triggerAction: string, reason: string) {
    return this.prisma.trainingModule.findFirst({ where: { triggerAction } }).then(async (mod) => {
      if (!mod) {
        mod = await this.prisma.trainingModule.create({
          data: {
            title: `Corrective: ${triggerAction.replace("_", " ")}`,
            content: `Review proper procedure for ${triggerAction.replace("_", " ")}.`,
            triggerAction,
            durationMin: 5,
          },
        });
      }
      return this.prisma.staffTrainingAssignment.create({
        data: { userId, moduleId: mod.id, reason },
      });
    });
  }

  listAssignments(userId: string) {
    return this.prisma.staffTrainingAssignment.findMany({
      where: { userId },
      orderBy: { assignedAt: "desc" },
    });
  }

  completeAssignment(id: string) {
    return this.prisma.staffTrainingAssignment.update({
      where: { id },
      data: { status: "completed", completedAt: new Date() },
    });
  }
}
