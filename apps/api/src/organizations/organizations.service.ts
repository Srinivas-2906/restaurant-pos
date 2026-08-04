import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  findAll(organizationId: string) {
    return this.prisma.organization.findMany({
      where: { id: organizationId },
      include: { brands: { include: { outlets: true } } },
    });
  }

  findOne(id: string) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id },
      include: {
        brands: { include: { outlets: true, menus: true } },
        users: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true } },
      },
    });
  }

  create(data: { name: string; slug: string; gstin?: string; email?: string; phone?: string }) {
    return this.prisma.organization.create({ data });
  }

  getDashboardStats(organizationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const outlets = await tx.outlet.count({
        where: { brand: { organizationId } },
      });
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayOrders = await tx.order.count({
        where: {
          outlet: { brand: { organizationId } },
          createdAt: { gte: todayStart },
          status: { in: ["settled", "billed"] },
        },
      });

      const todayRevenue = await tx.order.aggregate({
        where: {
          outlet: { brand: { organizationId } },
          createdAt: { gte: todayStart },
          status: "settled",
        },
        _sum: { totalAmount: true },
      });

      return {
        totalOutlets: outlets,
        todayOrders,
        todayRevenue: todayRevenue._sum.totalAmount ?? 0,
      };
    });
  }
}
