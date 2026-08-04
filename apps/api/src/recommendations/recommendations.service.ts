import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { generateDemandForecast, evaluateOutcome } from "@kaana/intelligence";

@Injectable()
export class RecommendationsService {
  constructor(private prisma: PrismaService) {}

  async generate(outletId: string) {
    const recentOrders = await this.prisma.order.count({
      where: { outletId, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
    });
    const daily = Array.from({ length: 7 }, () => Math.ceil(recentOrders / 30));
    const draft = generateDemandForecast(daily, new Date().getDay());
    draft.outletId = outletId;

    return this.prisma.recommendation.create({
      data: {
        outletId,
        type: draft.type,
        title: draft.title,
        prediction: draft.prediction,
        proposedActions: draft.proposedActions,
        actions: {
          create: draft.proposedActions.map((a) => ({ actionType: "auto", payload: { description: a } })),
        },
      },
      include: { actions: true },
    });
  }

  async findPending(outletId: string) {
    return this.prisma.recommendation.findMany({
      where: { outletId, status: "pending" },
      include: { actions: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async approve(id: string, userId: string) {
    const rec = await this.prisma.recommendation.update({
      where: { id },
      data: { status: "approved", approvedById: userId, approvedAt: new Date() },
      include: { actions: true },
    });

    for (const action of rec.actions) {
      await this.prisma.recommendationAction.update({
        where: { id: action.id },
        data: { status: "completed", completedAt: new Date() },
      });
    }

    return this.prisma.recommendation.update({
      where: { id },
      data: { status: "completed", completedAt: new Date() },
      include: { actions: true },
    });
  }

  async dismiss(id: string) {
    return this.prisma.recommendation.update({
      where: { id },
      data: { status: "dismissed" },
    });
  }

  async getHistory(outletId: string) {
    return this.prisma.recommendation.findMany({
      where: { outletId },
      include: { actions: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  evaluate(predicted: number, actual: number) {
    return evaluateOutcome(predicted, actual);
  }
}
