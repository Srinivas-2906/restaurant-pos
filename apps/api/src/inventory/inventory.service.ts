import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MenuService } from "../menu/menu.service";

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private menuService: MenuService,
  ) {}

  async deductForSale(outletId: string, menuItemId: string, quantity: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { menuItemId },
      include: { items: { include: { ingredient: true } } },
    });

    if (!recipe) return;

    for (const ri of recipe.items) {
      const deductQty = Number(ri.quantity) * quantity;
      const ingredient = ri.ingredient;

      const newStock = Number(ingredient.currentStock) - deductQty;
      await this.prisma.ingredient.update({
        where: { id: ingredient.id },
        data: { currentStock: Math.max(0, newStock) },
      });

      await this.prisma.stockLedger.create({
        data: {
          outletId,
          ingredientId: ingredient.id,
          type: "sale",
          quantity: -deductQty,
          balanceAfter: Math.max(0, newStock),
          reference: menuItemId,
        },
      });

      if (newStock <= Number(ingredient.minStock)) {
        await this.auto86MenuItem(outletId, menuItemId);
      }
    }
  }

  private async auto86MenuItem(outletId: string, menuItemId: string) {
    await this.menuService.updateAvailability(outletId, menuItemId, false);
  }

  getIngredients(outletId: string) {
    return this.prisma.ingredient.findMany({
      where: { outletId, isActive: true },
      include: { supplier: true, category: true },
      orderBy: { name: "asc" },
    });
  }

  createIngredient(outletId: string, data: {
    name: string; unit: string; minStock?: number; parStock?: number; costPerUnit?: number;
    supplierId?: string; categoryId?: string; consumptionUnit?: string; taxPct?: number;
    normalLossPct?: number; allowDecimal?: boolean; isFavourite?: boolean;
  }) {
    return this.prisma.ingredient.create({ data: { outletId, ...data } });
  }

  updateIngredient(id: string, data: Record<string, unknown>) {
    return this.prisma.ingredient.update({ where: { id }, data: data as never });
  }

  async getStockSummary(outletId: string) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { outletId, isActive: true },
      include: { category: true },
    });
    const totalValue = ingredients.reduce(
      (s, i) => s + Number(i.currentStock) * Number(i.costPerUnit),
      0,
    );
    const belowPar = ingredients.filter((i) => Number(i.currentStock) <= Number(i.parStock || i.minStock));
    const lowStock = ingredients.filter((i) => Number(i.currentStock) <= Number(i.minStock));
    const byCategory = new Map<string, { name: string; value: number; count: number }>();
    for (const ing of ingredients) {
      const cat = ing.category?.name ?? "Uncategorized";
      const existing = byCategory.get(cat) ?? { name: cat, value: 0, count: 0 };
      existing.value += Number(ing.currentStock) * Number(ing.costPerUnit);
      existing.count += 1;
      byCategory.set(cat, existing);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closing = await this.prisma.stockClosing.findUnique({
      where: { outletId_date: { outletId, date: today } },
    });
    return {
      totalValue,
      totalItems: ingredients.length,
      belowParCount: belowPar.length,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock.slice(0, 10).map((i) => ({
        id: i.id,
        name: i.name,
        currentStock: Number(i.currentStock),
        minStock: Number(i.minStock),
        unit: i.unit,
      })),
      categoryBreakdown: Array.from(byCategory.values()),
      todayClosing: closing,
    };
  }

  getStockLedger(outletId: string, limit = 100) {
    return this.prisma.stockLedger.findMany({
      where: { outletId },
      include: { ingredient: { select: { name: true, unit: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  createStockAdjustment(outletId: string, data: {
    ingredientId: string; quantity: number; notes?: string; createdById?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: data.ingredientId } });
      const newStock = Number(ingredient.currentStock) + data.quantity;
      await tx.ingredient.update({
        where: { id: data.ingredientId },
        data: { currentStock: Math.max(0, newStock) },
      });
      return tx.stockLedger.create({
        data: {
          outletId,
          ingredientId: data.ingredientId,
          type: "adjustment",
          quantity: data.quantity,
          balanceAfter: Math.max(0, newStock),
          notes: data.notes,
          createdById: data.createdById,
        },
      });
    });
  }

  async getStockClosings(outletId: string, month?: string) {
    const ref = month ? new Date(`${month}-01`) : new Date();
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return this.prisma.stockClosing.findMany({
      where: { outletId, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    });
  }

  createStockClosing(outletId: string, data: { date?: string; accuracyPct?: number; closedById?: string; notes?: string }) {
    const date = data.date ? new Date(data.date) : new Date();
    date.setHours(0, 0, 0, 0);
    return this.prisma.stockClosing.upsert({
      where: { outletId_date: { outletId, date } },
      create: {
        outletId,
        date,
        status: "completed",
        accuracyPct: data.accuracyPct,
        closedById: data.closedById,
        closedAt: new Date(),
        notes: data.notes,
      },
      update: {
        status: "completed",
        accuracyPct: data.accuracyPct,
        closedById: data.closedById,
        closedAt: new Date(),
        notes: data.notes,
      },
    });
  }

  getCategories(outletId: string) {
    return this.prisma.ingredientCategory.findMany({
      where: { outletId },
      orderBy: { sortOrder: "asc" },
    });
  }

  createCategory(outletId: string, name: string, sortOrder = 0) {
    return this.prisma.ingredientCategory.create({ data: { outletId, name, sortOrder } });
  }

  updateSupplier(id: string, data: Record<string, unknown>) {
    return this.prisma.supplier.update({ where: { id }, data: data as never });
  }

  listTransfers(outletId: string) {
    return this.prisma.centralKitchenTransfer.findMany({
      where: { OR: [{ fromOutletId: outletId }, { toOutletId: outletId }] },
      orderBy: { requestedAt: "desc" },
    });
  }

  recordWastage(outletId: string, ingredientId: string, quantity: number, notes?: string) {
    return this.prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
      const newStock = Number(ingredient.currentStock) - quantity;

      await tx.ingredient.update({
        where: { id: ingredientId },
        data: { currentStock: Math.max(0, newStock) },
      });

      return tx.stockLedger.create({
        data: {
          outletId, ingredientId, type: "wastage", quantity: -quantity,
          balanceAfter: Math.max(0, newStock), notes,
        },
      });
    });
  }

  createPurchaseOrder(outletId: string, data: {
    supplierId: string;
    items: Array<{ ingredientId: string; quantity: number; unitPrice: number }>;
    notes?: string;
  }) {
    const poCount = this.prisma.purchaseOrder.count({ where: { outletId } });
    return poCount.then(async (count) => {
      const totalAmount = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      return this.prisma.purchaseOrder.create({
        data: {
          outletId,
          supplierId: data.supplierId,
          poNumber: `PO-${String(count + 1).padStart(4, "0")}`,
          totalAmount,
          notes: data.notes,
          items: {
            create: data.items.map((i) => ({
              ingredientId: i.ingredientId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.quantity * i.unitPrice,
            })),
          },
        },
        include: { items: true, supplier: true },
      });
    });
  }

  receivePO(poId: string) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id: poId },
        include: { items: true },
      });

      for (const item of po.items) {
        const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: item.ingredientId } });
        const newStock = Number(ingredient.currentStock) + Number(item.quantity);

        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: { currentStock: newStock },
        });

        await tx.stockLedger.create({
          data: {
            outletId: po.outletId,
            ingredientId: item.ingredientId,
            type: "purchase",
            quantity: Number(item.quantity),
            balanceAfter: newStock,
            reference: po.poNumber,
          },
        });

        await tx.pOItem.update({
          where: { id: item.id },
          data: { receivedQty: item.quantity },
        });
      }

      return tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: "received", receivedAt: new Date() },
        include: { items: true },
      });
    });
  }

  createCKTransfer(fromOutletId: string, toOutletId: string, items: unknown[], notes?: string) {
    const count = this.prisma.centralKitchenTransfer.count({ where: { fromOutletId } });
    return count.then((c) =>
      this.prisma.centralKitchenTransfer.create({
        data: {
          fromOutletId,
          toOutletId,
          transferNumber: `TRF-${String(c + 1).padStart(4, "0")}`,
          items: items as never,
          notes,
        },
      })
    );
  }

  getSuppliers(outletId: string) {
    return this.prisma.supplier.findMany({ where: { outletId, isActive: true } });
  }

  createSupplier(outletId: string, data: { name: string; phone?: string; email?: string; gstin?: string }) {
    return this.prisma.supplier.create({ data: { outletId, ...data } });
  }

  listPurchaseOrders(outletId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { outletId },
      include: { items: { include: { ingredient: true } }, supplier: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getRecipes(outletId: string) {
    const outlet = await this.prisma.outlet.findUniqueOrThrow({
      where: { id: outletId },
      include: { brand: { include: { menus: { include: { categories: { include: { items: { include: { recipe: { include: { items: { include: { ingredient: true } } } } } } } } } } } } },
    });
    const items = outlet.brand.menus.flatMap((m) => m.categories.flatMap((c) => c.items));
    return items.filter((i) => i.recipe).map((i) => ({
      menuItemId: i.id,
      name: i.name,
      ingredients: i.recipe!.items.map((ri) => ({
        name: ri.ingredient.name,
        quantity: Number(ri.quantity),
        unit: ri.ingredient.unit,
      })),
    }));
  }
}
