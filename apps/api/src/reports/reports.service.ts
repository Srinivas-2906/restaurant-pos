import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async salesDailyBreakdown(outletId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const orders = await this.prisma.order.findMany({
      where: {
        outletId,
        status: "settled",
        settledAt: { gte: fromDate, lte: toDate },
      },
      select: { settledAt: true, totalAmount: true },
    });

    const revenueByDay = new Map<string, number>();
    const ordersByDay = new Map<string, number>();

    for (const order of orders) {
      if (!order.settledAt) continue;
      const day = order.settledAt.toISOString().slice(0, 10);
      revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(order.totalAmount));
      ordersByDay.set(day, (ordersByDay.get(day) ?? 0) + 1);
    }

    const days: Array<{ date: string; revenue: number; orders: number }> = [];
    const cursor = new Date(fromDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(0, 0, 0, 0);

    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10);
      days.push({
        date,
        revenue: revenueByDay.get(date) ?? 0,
        orders: ordersByDay.get(date) ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }

  async salesReport(outletId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const orders = await this.prisma.order.findMany({
      where: {
        outletId,
        status: "settled",
        settledAt: { gte: fromDate, lte: toDate },
      },
      include: { items: true, payments: true },
    });

    const totalRevenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const bySource = orders.reduce((acc, o) => {
      acc[o.source] = (acc[o.source] ?? 0) + Number(o.totalAmount);
      return acc;
    }, {} as Record<string, number>);

    const byPayment = orders.flatMap((o) => o.payments).reduce((acc, p) => {
      acc[p.method] = (acc[p.method] ?? 0) + Number(p.amount);
      return acc;
    }, {} as Record<string, number>);

    return { totalRevenue, totalOrders, avgOrderValue, bySource, byPayment, period: { from, to } };
  }

  async itemWiseReport(outletId: string, from: string, to: string) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          outletId,
          status: "settled",
          settledAt: { gte: new Date(from), lte: new Date(to) },
        },
      },
    });

    const grouped = items.reduce((acc, item) => {
      if (!acc[item.name]) acc[item.name] = { quantity: 0, revenue: 0 };
      acc[item.name].quantity += item.quantity;
      acc[item.name].revenue += Number(item.totalPrice);
      return acc;
    }, {} as Record<string, { quantity: number; revenue: number }>);

    return Object.entries(grouped)
      .map(([name, data]) => {
        const d = data as { quantity: number; revenue: number };
        return { name, quantity: d.quantity, revenue: d.revenue };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }

  async gstExport(outletId: string, from: string, to: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        order: {
          outletId,
          settledAt: { gte: new Date(from), lte: new Date(to) },
        },
      },
      include: { order: { include: { items: true } } },
    });

    return {
      outletId,
      period: { from, to },
      totalInvoices: invoices.length,
      totalTaxable: invoices.reduce((s, i) => s + Number(i.taxableAmount), 0),
      totalCGST: invoices.reduce((s, i) => s + Number(i.cgstAmount), 0),
      totalSGST: invoices.reduce((s, i) => s + Number(i.sgstAmount), 0),
      totalAmount: invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      invoices: invoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        date: inv.issuedAt,
        gstin: inv.gstin,
        taxableAmount: inv.taxableAmount,
        cgst: inv.cgstAmount,
        sgst: inv.sgstAmount,
        total: inv.totalAmount,
      })),
    };
  }

  async inventoryReport(outletId: string) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { outletId, isActive: true },
      include: { category: true },
    });

    return ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      category: i.category?.name ?? "Uncategorized",
      currentStock: Number(i.currentStock),
      committed: Number(i.committedStock),
      available: Number(i.currentStock) - Number(i.committedStock),
      reorderLevel: Number(i.reorderLevel || i.minStock),
      targetStock: Number(i.targetStock || i.parStock),
      isLowStock: Number(i.currentStock) - Number(i.committedStock) <= Number(i.reorderLevel || i.minStock),
      weightedAverageCost: Number(i.weightedAverageCost || i.costPerUnit),
      value: Number(i.currentStock) * Number(i.weightedAverageCost || i.costPerUnit),
    }));
  }

  async foodCostReport(outletId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const [orders, consumptionLedger, purchaseLedger] = await Promise.all([
      this.prisma.order.findMany({
        where: { outletId, status: "settled", settledAt: { gte: fromDate, lte: toDate } },
        include: { items: true },
      }),
      this.prisma.stockLedger.findMany({
        where: {
          outletId,
          type: { in: ["recipe_consumption", "sale"] },
          createdAt: { gte: fromDate, lte: toDate },
        },
      }),
      this.prisma.stockLedger.findMany({
        where: {
          outletId,
          type: "purchase",
          createdAt: { gte: fromDate, lte: toDate },
        },
      }),
    ]);

    const revenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const actualConsumption = consumptionLedger.reduce((s, l) => s + Number(l.totalValue ?? 0), 0);
    const purchases = purchaseLedger.reduce((s, l) => s + Number(l.totalValue ?? 0), 0);

    const recipes = await this.prisma.recipe.findMany({
      include: { items: { include: { ingredient: true } }, menuItem: true },
    });
    const recipeCostByMenuItem = new Map(
      recipes.map((r) => [
        r.menuItemId,
        r.items.reduce((s, ri) => s + Number(ri.quantity) * Number(ri.ingredient.weightedAverageCost || ri.ingredient.costPerUnit), 0),
      ]),
    );

    let theoreticalConsumption = 0;
    for (const order of orders) {
      for (const item of order.items) {
        const cost = recipeCostByMenuItem.get(item.menuItemId) ?? 0;
        theoreticalConsumption += cost * item.quantity;
      }
    }

    const foodCostPct = revenue > 0 ? (actualConsumption / revenue) * 100 : 0;
    const theoreticalPct = revenue > 0 ? (theoreticalConsumption / revenue) * 100 : 0;

    return {
      period: { from, to },
      revenue,
      actualConsumption,
      theoreticalConsumption,
      variance: actualConsumption - theoreticalConsumption,
      foodCostPct: Math.round(foodCostPct * 100) / 100,
      theoreticalFoodCostPct: Math.round(theoreticalPct * 100) / 100,
      purchases,
    };
  }

  async supplierPerformanceReport(outletId: string) {
    const suppliers = await this.prisma.supplier.findMany({
      where: { outletId, isActive: true },
      include: {
        purchaseOrders: { orderBy: { createdAt: "desc" }, take: 10 },
        goodsReceipts: { orderBy: { receivedAt: "desc" }, take: 10 },
      },
    });

    return suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      onTimeDeliveryPct: Number(s.onTimeDeliveryPct),
      rejectionRate: Number(s.rejectionRate),
      avgPriceVariance: Number(s.avgPriceVariance),
      outstandingAmount: Number(s.outstandingAmount),
      totalPurchases: Number(s.totalPurchases),
      lastPurchaseAt: s.lastPurchaseAt,
      openPOs: s.purchaseOrders.filter((po) => ["draft", "sent", "partial"].includes(po.status)).length,
      recentReceipts: s.goodsReceipts.length,
    }));
  }

  async consumptionReport(outletId: string, from: string, to: string) {
    const ledger = await this.prisma.stockLedger.findMany({
      where: {
        outletId,
        type: { in: ["recipe_consumption", "sale", "wastage", "production_consumption"] },
        createdAt: { gte: new Date(from), lte: new Date(to) },
      },
      include: { ingredient: true },
    });

    const byIngredient = new Map<string, { name: string; unit: string; quantity: number; value: number }>();
    for (const row of ledger) {
      const key = row.ingredientId;
      const existing = byIngredient.get(key) ?? {
        name: row.ingredient.name,
        unit: row.ingredient.unit,
        quantity: 0,
        value: 0,
      };
      existing.quantity += Math.abs(Number(row.quantity));
      existing.value += Number(row.totalValue ?? 0);
      byIngredient.set(key, existing);
    }

    return Array.from(byIngredient.values()).sort((a, b) => b.value - a.value);
  }

  async outletComparison(organizationId: string, from: string, to: string) {
    const outlets = await this.prisma.outlet.findMany({
      where: { brand: { organizationId } },
    });

    const results = await Promise.all(
      outlets.map(async (outlet) => {
        const report = await this.salesReport(outlet.id, from, to);
        return { outletId: outlet.id, outletName: outlet.name, ...report };
      })
    );

    return results.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  async wastageReport(outletId: string, from: string, to: string) {
    return this.prisma.stockLedger.findMany({
      where: {
        outletId,
        type: "wastage",
        createdAt: { gte: new Date(from), lte: new Date(to) },
      },
      include: { ingredient: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async reconciliation(outletId: string, from: string, to: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        outletId,
        status: "settled",
        settledAt: { gte: new Date(from), lte: new Date(to) },
      },
      include: { payments: true },
    });

    const byMethod = orders.flatMap((o) => o.payments).reduce((acc, p) => {
      acc[p.method] = (acc[p.method] ?? 0) + Number(p.amount);
      return acc;
    }, {} as Record<string, number>);

    const totalCollected = Object.values(byMethod).reduce((s, v) => s + v, 0);
    const aggregatorShare = (byMethod.upi ?? 0) + (byMethod.card ?? 0);
    const expectedSettlement = Math.round(aggregatorShare * 0.98 * 100) / 100;
    const variance = Math.round((aggregatorShare - expectedSettlement) * 100) / 100;

    return {
      outletId,
      period: { from, to },
      totalCollected,
      byMethod,
      aggregatorShare,
      expectedSettlement,
      variance,
      orderCount: orders.length,
    };
  }
}
