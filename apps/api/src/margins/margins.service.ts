import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { calculateOrderMargin, rankItemsByMargin, findLossMakingCombos } from "@kaana/profitability";

@Injectable()
export class MarginsService {
  constructor(private prisma: PrismaService) {}

  async snapshotOrder(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { menuItem: { include: { recipe: { include: { items: { include: { ingredient: true } } } } } } } } },
    });

    let ingredientCost = 0;
    for (const item of order.items) {
      const recipe = item.menuItem.recipe;
      if (recipe) {
        for (const ri of recipe.items) {
          ingredientCost += Number(ri.quantity) * Number(ri.ingredient.costPerUnit ?? 0) * item.quantity;
        }
      } else {
        ingredientCost += Number(item.unitPrice) * 0.35 * item.quantity;
      }
    }

    const revenue = Number(order.totalAmount);
    const margin = calculateOrderMargin({
      orderId,
      outletId: order.outletId,
      revenue,
      ingredientCost,
      packagingCost: revenue * 0.02,
      discountAmount: Number(order.discountAmount),
      aggregatorCommission: order.source !== "dine_in" ? revenue * 0.22 : 0,
      paymentFee: revenue * 0.015,
      laborAllocation: revenue * 0.15,
    });

    return this.prisma.orderMarginSnapshot.upsert({
      where: { orderId },
      create: {
        orderId,
        outletId: order.outletId,
        revenue,
        ingredientCost,
        packagingCost: margin.breakdown.packagingCost,
        aggregatorCommission: margin.breakdown.aggregatorCommission,
        discountAmount: margin.breakdown.discountAmount,
        paymentFee: margin.breakdown.paymentFee,
        laborAllocation: margin.breakdown.laborAllocation,
        wastageAllocation: 0,
        contributionMargin: margin.contributionMargin,
        marginPercent: margin.marginPercent,
      },
      update: {
        contributionMargin: margin.contributionMargin,
        marginPercent: margin.marginPercent,
      },
    });
  }

  async getOutletReport(outletId: string) {
    const snapshots = await this.prisma.orderMarginSnapshot.findMany({
      where: { outletId },
      orderBy: { calculatedAt: "desc" },
      take: 100,
    });
    const avgMargin = snapshots.length
      ? snapshots.reduce((s, x) => s + Number(x.marginPercent), 0) / snapshots.length
      : 0;
    const lossMaking = findLossMakingCombos(
      snapshots.map((s) => ({ name: s.orderId, margin: Number(s.contributionMargin) })),
    );
    return { avgMargin, totalOrders: snapshots.length, lossMakingCount: lossMaking.length, snapshots };
  }

  async getItemRanking(outletId: string) {
    const orders = await this.prisma.order.findMany({
      where: { outletId, status: "settled" },
      include: { items: true, marginSnapshot: true },
      take: 200,
    });
    const itemMap = new Map<string, { name: string; margin: number; orders: number }>();
    for (const order of orders) {
      const orderMargin = Number(order.marginSnapshot?.contributionMargin ?? 0);
      for (const item of order.items) {
        const key = item.name;
        const existing = itemMap.get(key) ?? { name: key, margin: 0, orders: 0 };
        existing.margin += orderMargin / order.items.length;
        existing.orders += 1;
        itemMap.set(key, existing);
      }
    }
    return rankItemsByMargin([...itemMap.values()]);
  }
}
