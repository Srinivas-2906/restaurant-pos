import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  async getPending(outletId: string) {
    const audits = await this.prisma.auditLog.findMany({
      where: {
        outletId,
        action: { in: ["discount_applied", "order_void", "bill_modified"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    const recommendations = await this.prisma.recommendation.findMany({
      where: { outletId, status: "pending" },
      include: { actions: true },
    });

    return {
      discounts: audits.filter((a) => a.action === "discount_applied"),
      voids: audits.filter((a) => a.action === "order_void"),
      recommendations,
      total: audits.length + recommendations.length,
    };
  }
}
