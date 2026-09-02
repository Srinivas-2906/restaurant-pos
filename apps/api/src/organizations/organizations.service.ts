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

  getDashboardStats(organizationId: string, outletId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const outletScope = outletId
        ? { outletId }
        : { outlet: { brand: { organizationId } } };

      const outlets = await tx.outlet.count({
        where: outletId
          ? { id: outletId, brand: { organizationId } }
          : { brand: { organizationId }, isActive: true },
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(todayEnd);
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

      const settledTodayWhere = {
        ...outletScope,
        status: "settled" as const,
        settledAt: { gte: todayStart, lte: todayEnd },
      };

      const settledYesterdayWhere = {
        ...outletScope,
        status: "settled" as const,
        settledAt: { gte: yesterdayStart, lte: yesterdayEnd },
      };

      const [todayOrders, todayRevenue, yesterdayOrders, yesterdayRevenue] = await Promise.all([
        tx.order.count({ where: settledTodayWhere }),
        tx.order.aggregate({ where: settledTodayWhere, _sum: { totalAmount: true } }),
        tx.order.count({ where: settledYesterdayWhere }),
        tx.order.aggregate({ where: settledYesterdayWhere, _sum: { totalAmount: true } }),
      ]);

      const todayRev = Number(todayRevenue._sum.totalAmount ?? 0);
      const yesterdayRev = Number(yesterdayRevenue._sum.totalAmount ?? 0);

      return {
        totalOutlets: outlets,
        outletId: outletId ?? null,
        todayOrders,
        todayRevenue: todayRev,
        yesterdayOrders,
        yesterdayRevenue: yesterdayRev,
        ordersDelta: todayOrders - yesterdayOrders,
        revenueDelta: todayRev - yesterdayRev,
      };
    });
  }
}
