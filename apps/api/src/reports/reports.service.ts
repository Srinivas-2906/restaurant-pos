import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

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
    });

    return ingredients.map((i) => ({
      name: i.name,
      unit: i.unit,
      currentStock: i.currentStock,
      minStock: i.minStock,
      isLowStock: Number(i.currentStock) <= Number(i.minStock),
      value: Number(i.currentStock) * Number(i.costPerUnit),
    }));
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
