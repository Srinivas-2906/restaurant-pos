import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MenuService } from "../menu/menu.service";
import {
  toStockUnit,
  fromConsumptionToStock,
  applyLossPct,
  buildDefaultConversions,
  updateCostOnReceipt,
  calculateReorderSuggestion,
  type ItemUnitContext,
  type LedgerWriteInput,
} from "@kaana/inventory-core";
import type { Prisma } from "@kaana/database";

type TxClient = Prisma.TransactionClient;

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private menuService: MenuService,
  ) {}

  private itemContext(ingredient: {
    unit: string;
    consumptionUnit?: string | null;
    purchaseUnit?: string | null;
    purchaseToStockFactor?: Prisma.Decimal | null;
    stockToConsumptionFactor?: Prisma.Decimal | null;
    conversions?: Array<{ fromUnit: string; toUnit: string; factor: Prisma.Decimal; dimension: string }>;
  }): ItemUnitContext {
    return {
      stockUnit: ingredient.unit,
      consumptionUnit: ingredient.consumptionUnit,
      purchaseUnit: ingredient.purchaseUnit,
      purchaseToStockFactor: ingredient.purchaseToStockFactor ? Number(ingredient.purchaseToStockFactor) : null,
      stockToConsumptionFactor: ingredient.stockToConsumptionFactor ? Number(ingredient.stockToConsumptionFactor) : null,
      conversions: ingredient.conversions?.map((c) => ({
        fromUnit: c.fromUnit,
        toUnit: c.toUnit,
        factor: Number(c.factor),
        dimension: c.dimension as "weight" | "volume" | "count" | "length" | "custom_package",
      })),
    };
  }

  private async writeLedger(tx: TxClient, input: LedgerWriteInput & { allowNegative?: boolean }) {
    const ingredient = await tx.ingredient.findUniqueOrThrow({
      where: { id: input.ingredientId },
      include: { conversions: true },
    });

    const currentStock = Number(ingredient.currentStock);
    const newStock = input.allowNegative ? currentStock + input.quantity : Math.max(0, currentStock + input.quantity);
    const unitCost = input.unitCost ?? (Number(ingredient.weightedAverageCost || ingredient.costPerUnit) || 0);
    const totalValue = Math.abs(input.quantity) * unitCost;

    await tx.ingredient.update({
      where: { id: input.ingredientId },
      data: { currentStock: newStock },
    });

    await tx.inventoryBalance.upsert({
      where: {
        outletId_ingredientId_locationId_batchId: {
          outletId: input.outletId,
          ingredientId: input.ingredientId,
          locationId: input.sourceLocationId ?? null as never,
          batchId: input.batchId ?? null as never,
        },
      },
      create: {
        outletId: input.outletId,
        ingredientId: input.ingredientId,
        locationId: input.sourceLocationId,
        batchId: input.batchId,
        onHand: Math.max(0, newStock),
      },
      update: {
        onHand: Math.max(0, newStock),
      },
    }).catch(() => undefined);

    return tx.stockLedger.create({
      data: {
        outletId: input.outletId,
        ingredientId: input.ingredientId,
        type: input.type as never,
        quantity: input.quantity,
        balanceAfter: newStock,
        reference: input.reference,
        notes: input.notes,
        reason: input.reason,
        createdById: input.createdById,
        batchId: input.batchId,
        unitCost,
        totalValue,
        sourceLocationId: input.sourceLocationId,
        destLocationId: input.destLocationId,
      },
    });
  }

  async commitStockForOrder(outletId: string, orderId: string, items: Array<{ id: string; menuItemId: string; quantity: number }>) {
    for (const item of items) {
      await this.commitStockForOrderItem(outletId, orderId, item.id, item.menuItemId, item.quantity);
    }
  }

  async commitStockForOrderItem(outletId: string, orderId: string, orderItemId: string, menuItemId: string, quantity: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { menuItemId },
      include: { items: { include: { ingredient: { include: { conversions: true } } } } },
    });
    if (!recipe) return;

    for (const ri of recipe.items) {
      const ctx = this.itemContext(ri.ingredient);
      const consumptionQty = applyLossPct(Number(ri.quantity) * quantity, Number(ri.lossPct ?? ri.ingredient.normalLossPct));
      const stockQty = fromConsumptionToStock(ctx, consumptionQty);

      const existing = await this.prisma.stockCommitment.findUnique({
        where: { orderItemId_ingredientId: { orderItemId, ingredientId: ri.ingredientId } },
      });
      if (existing) continue;

      await this.prisma.$transaction(async (tx) => {
        const ing = await tx.ingredient.findUniqueOrThrow({ where: { id: ri.ingredientId } });
        const committed = Number(ing.committedStock) + stockQty;

        await tx.ingredient.update({
          where: { id: ri.ingredientId },
          data: { committedStock: committed },
        });

        await tx.stockCommitment.create({
          data: {
            outletId,
            ingredientId: ri.ingredientId,
            orderId,
            orderItemId,
            quantity: stockQty,
            status: "committed",
          },
        });

        await this.writeLedger(tx, {
          outletId,
          ingredientId: ri.ingredientId,
          type: "committed_out",
          quantity: 0,
          reference: `${orderId}:${orderItemId}:${ri.ingredientId}:commit`,
          notes: `Committed ${stockQty} ${ing.unit} for KOT`,
        });
      });
    }
  }

  async consumeCommittedStock(outletId: string, menuItemId: string, quantity: number, orderId: string, orderItemId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { menuItemId },
      include: { items: { include: { ingredient: { include: { conversions: true } } } } },
    });
    if (!recipe) return;

    for (const ri of recipe.items) {
      const ctx = this.itemContext(ri.ingredient);
      const consumptionQty = applyLossPct(Number(ri.quantity) * quantity, Number(ri.lossPct ?? ri.ingredient.normalLossPct));
      const stockQty = fromConsumptionToStock(ctx, consumptionQty);
      const ledgerRef = `${orderId}:${orderItemId}:${ri.ingredientId}`;

      const existing = await this.prisma.stockLedger.findFirst({
        where: { outletId, ingredientId: ri.ingredientId, type: { in: ["recipe_consumption", "sale"] }, reference: ledgerRef },
      });
      if (existing) continue;

      await this.prisma.$transaction(async (tx) => {
        const commitment = await tx.stockCommitment.findUnique({
          where: { orderItemId_ingredientId: { orderItemId, ingredientId: ri.ingredientId } },
        });

        const ing = await tx.ingredient.findUniqueOrThrow({ where: { id: ri.ingredientId } });
        const newCommitted = Math.max(0, Number(ing.committedStock) - stockQty);

        await tx.ingredient.update({
          where: { id: ri.ingredientId },
          data: { committedStock: newCommitted },
        });

        if (commitment) {
          await tx.stockCommitment.update({
            where: { id: commitment.id },
            data: { status: "consumed" },
          });
        }

        await this.writeLedger(tx, {
          outletId,
          ingredientId: ri.ingredientId,
          type: "recipe_consumption",
          quantity: -stockQty,
          reference: ledgerRef,
          unitCost: Number(ing.weightedAverageCost || ing.costPerUnit),
        });

        const updated = await tx.ingredient.findUniqueOrThrow({ where: { id: ri.ingredientId } });
        const reorderLevel = Number(updated.reorderLevel || updated.minStock);
        if (Number(updated.currentStock) - Number(updated.committedStock) <= reorderLevel) {
          await this.auto86MenuItem(outletId, menuItemId);
        }
      });
    }
  }

  async releaseCommit(outletId: string, orderItemId: string, asWastage = false) {
    const commitments = await this.prisma.stockCommitment.findMany({
      where: { outletId, orderItemId, status: "committed" },
      include: { ingredient: true },
    });

    for (const c of commitments) {
      await this.prisma.$transaction(async (tx) => {
        const ing = await tx.ingredient.findUniqueOrThrow({ where: { id: c.ingredientId } });
        const qty = Number(c.quantity);
        const newCommitted = Math.max(0, Number(ing.committedStock) - qty);

        await tx.ingredient.update({
          where: { id: c.ingredientId },
          data: { committedStock: newCommitted },
        });

        await tx.stockCommitment.update({
          where: { id: c.id },
          data: { status: asWastage ? "wastage" : "released" },
        });

        if (asWastage) {
          await this.writeLedger(tx, {
            outletId,
            ingredientId: c.ingredientId,
            type: "wastage",
            quantity: -qty,
            reference: `${orderItemId}:${c.ingredientId}:cancel`,
            notes: "Cancelled after preparation",
            unitCost: Number(ing.weightedAverageCost || ing.costPerUnit),
          });
        } else {
          await this.writeLedger(tx, {
            outletId,
            ingredientId: c.ingredientId,
            type: "commit_release",
            quantity: 0,
            reference: `${orderItemId}:${c.ingredientId}:release`,
            notes: `Released ${qty} ${ing.unit}`,
          });
        }
      });
    }
  }

  /** @deprecated use consumeCommittedStock */
  async deductForSale(outletId: string, menuItemId: string, quantity: number, reference?: string) {
    const parts = reference?.split(":") ?? [];
    const orderId = parts[0] ?? reference ?? menuItemId;
    const orderItemId = parts[1] ?? reference ?? menuItemId;
    await this.consumeCommittedStock(outletId, menuItemId, quantity, orderId, orderItemId);
  }

  private async auto86MenuItem(outletId: string, menuItemId: string) {
    await this.menuService.updateAvailability(outletId, menuItemId, false);
  }

  getIngredients(outletId: string) {
    return this.prisma.ingredient.findMany({
      where: { outletId, isActive: true },
      include: { supplier: true, category: true, conversions: true },
      orderBy: { name: "asc" },
    });
  }

  getItems(outletId: string) {
    return this.getIngredients(outletId);
  }

  async createIngredient(outletId: string, data: Record<string, unknown>) {
    const payload = this.normalizeItemPayload(data);
    const ingredient = await this.prisma.ingredient.create({
      data: { outletId, ...(payload as object) } as never,
    });
    await this.syncConversions(ingredient.id, payload);
    return this.prisma.ingredient.findUniqueOrThrow({
      where: { id: ingredient.id },
      include: { supplier: true, category: true, conversions: true },
    });
  }

  async updateIngredient(id: string, data: Record<string, unknown>) {
    const payload = this.normalizeItemPayload(data);
    await this.prisma.ingredient.update({ where: { id }, data: payload });
    await this.syncConversions(id, payload);
    return this.prisma.ingredient.findUniqueOrThrow({
      where: { id },
      include: { supplier: true, category: true, conversions: true },
    });
  }

  private normalizeItemPayload(data: Record<string, unknown>) {
    const payload: Record<string, unknown> = { ...data };
    if (payload.reorderLevel != null) payload.minStock = payload.reorderLevel;
    if (payload.targetStock != null) payload.parStock = payload.targetStock;
    if (payload.minStock != null && payload.reorderLevel == null) payload.reorderLevel = payload.minStock;
    if (payload.parStock != null && payload.targetStock == null) payload.targetStock = payload.parStock;
    delete payload.conversions;
    return payload as never;
  }

  private async syncConversions(ingredientId: string, data: Record<string, unknown>) {
    const ingredient = await this.prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
    const defaults = buildDefaultConversions({
      stockUnit: ingredient.unit,
      consumptionUnit: ingredient.consumptionUnit,
      purchaseUnit: ingredient.purchaseUnit,
      purchaseToStockFactor: ingredient.purchaseToStockFactor ? Number(ingredient.purchaseToStockFactor) : null,
      stockToConsumptionFactor: ingredient.stockToConsumptionFactor ? Number(ingredient.stockToConsumptionFactor) : null,
    });

    const custom = Array.isArray(data.conversions) ? data.conversions as Array<{ fromUnit: string; toUnit: string; factor: number; dimension: string }> : [];
    const all = [...defaults, ...custom];

    if (all.length === 0) return;

    await this.prisma.itemUnitConversion.deleteMany({ where: { ingredientId } });
    await this.prisma.itemUnitConversion.createMany({
      data: all.map((c) => ({
        ingredientId,
        fromUnit: c.fromUnit,
        toUnit: c.toUnit,
        factor: c.factor,
        dimension: c.dimension as never,
      })),
    });
  }

  async recordOpeningStock(outletId: string, data: {
    ingredientId: string; quantity: number; unitCost?: number; notes?: string; createdById?: string;
  }) {
    const ingredient = await this.prisma.ingredient.findUniqueOrThrow({
      where: { id: data.ingredientId },
      include: { conversions: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const cost = data.unitCost ?? (Number(ingredient.weightedAverageCost || ingredient.costPerUnit) || 0);
      const costUpdate = updateCostOnReceipt(
        { currentStock: 0, weightedAverageCost: Number(ingredient.weightedAverageCost), lastPurchaseCost: Number(ingredient.lastPurchaseCost) },
        data.quantity,
        cost,
      );

      await tx.ingredient.update({
        where: { id: data.ingredientId },
        data: costUpdate,
      });

      return this.writeLedger(tx, {
        outletId,
        ingredientId: data.ingredientId,
        type: "opening_stock",
        quantity: data.quantity,
        unitCost: cost,
        reference: `opening:${data.ingredientId}`,
        notes: data.notes,
        createdById: data.createdById,
        reason: "Opening stock entry",
      });
    });
  }

  async getStockSummary(outletId: string) {
    return this.getDashboard(outletId);
  }

  async getDashboard(outletId: string) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { outletId, isActive: true },
      include: { category: true },
    });

    const totalValue = ingredients.reduce(
      (s, i) => s + Number(i.currentStock) * Number(i.weightedAverageCost || i.costPerUnit),
      0,
    );

    const lowStock = ingredients.filter((i) => {
      const available = Number(i.currentStock) - Number(i.committedStock);
      const reorder = Number(i.reorderLevel || i.minStock);
      return available <= reorder;
    });

    const outOfStock = ingredients.filter((i) => Number(i.currentStock) - Number(i.committedStock) <= 0);

    const byCategory = new Map<string, { name: string; value: number; count: number }>();
    for (const ing of ingredients) {
      const cat = ing.category?.name ?? "Uncategorized";
      const existing = byCategory.get(cat) ?? { name: cat, value: 0, count: 0 };
      existing.value += Number(ing.currentStock) * Number(ing.weightedAverageCost || ing.costPerUnit);
      existing.count += 1;
      byCategory.set(cat, existing);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayLedger = await this.prisma.stockLedger.findMany({
      where: { outletId, createdAt: { gte: today, lt: tomorrow } },
    });

    const sumByType = (types: string[]) =>
      todayLedger.filter((l) => types.includes(l.type)).reduce((s, l) => s + Math.abs(Number(l.quantity)), 0);

    const purchasesValue = todayLedger
      .filter((l) => l.type === "purchase" || l.type === "opening_stock")
      .reduce((s, l) => s + Number(l.totalValue ?? 0), 0);

    const consumptionValue = todayLedger
      .filter((l) => ["recipe_consumption", "sale", "wastage"].includes(l.type))
      .reduce((s, l) => s + Number(l.totalValue ?? 0), 0);

    const closing = await this.prisma.stockClosing.findUnique({
      where: { outletId_date: { outletId, date: today } },
    });

    const alerts = await this.prisma.inventoryAlert.findMany({
      where: { outletId, isRead: false },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { ingredient: { select: { name: true } } },
    });

    return {
      totalValue,
      totalItems: ingredients.length,
      belowParCount: lowStock.length,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      lowStockItems: lowStock.slice(0, 12).map((i) => ({
        id: i.id,
        name: i.name,
        currentStock: Number(i.currentStock),
        available: Number(i.currentStock) - Number(i.committedStock),
        reorderLevel: Number(i.reorderLevel || i.minStock),
        unit: i.unit,
      })),
      categoryBreakdown: Array.from(byCategory.values()),
      todayClosing: closing,
      todayFlow: {
        openingValue: totalValue,
        purchasesReceived: purchasesValue,
        consumption: consumptionValue,
        wastage: sumByType(["wastage"]),
        transfers: sumByType(["transfer_in", "transfer_out"]),
      },
      alerts: alerts.map((a) => ({ id: a.id, type: a.alertType, message: a.message, ingredient: a.ingredient?.name })),
      reorderSuggestions: lowStock.slice(0, 5).map((i) => ({
        ingredientId: i.id,
        name: i.name,
        suggestedQty: calculateReorderSuggestion({
          forecastDemand: Number(i.targetStock || i.parStock) || Number(i.reorderLevel || i.minStock) * 2,
          available: Number(i.currentStock) - Number(i.committedStock),
          incoming: 0,
          safetyStock: Number(i.safetyStock),
          targetStock: Number(i.targetStock || i.parStock),
        }),
        unit: i.unit,
      })),
    };
  }

  getStockLedger(outletId: string, limit = 100, filters?: { type?: string; ingredientId?: string }) {
    return this.prisma.stockLedger.findMany({
      where: {
        outletId,
        ...(filters?.type ? { type: filters.type as never } : {}),
        ...(filters?.ingredientId ? { ingredientId: filters.ingredientId } : {}),
      },
      include: { ingredient: { select: { name: true, unit: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  createStockAdjustment(outletId: string, data: {
    ingredientId: string; quantity: number; notes?: string; reason?: string; createdById?: string;
  }) {
    if (!data.reason?.trim()) {
      throw new BadRequestException("Reason is required for manual adjustments");
    }
    return this.prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: data.ingredientId } });
      return this.writeLedger(tx, {
        outletId,
        ingredientId: data.ingredientId,
        type: "adjustment",
        quantity: data.quantity,
        notes: data.notes,
        reason: data.reason,
        createdById: data.createdById,
        unitCost: Number(ingredient.weightedAverageCost || ingredient.costPerUnit),
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
        outletId, date, status: "completed", accuracyPct: data.accuracyPct,
        closedById: data.closedById, closedAt: new Date(), notes: data.notes,
      },
      update: {
        status: "completed", accuracyPct: data.accuracyPct,
        closedById: data.closedById, closedAt: new Date(), notes: data.notes,
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

  recordWastage(outletId: string, data: {
    ingredientId: string; quantity: number; category?: string; notes?: string;
    reason?: string; batchId?: string; orderId?: string; recordedById?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: data.ingredientId } });
      const unitCost = Number(ingredient.weightedAverageCost || ingredient.costPerUnit);
      const costImpact = data.quantity * unitCost;

      await tx.wastageEntry.create({
        data: {
          outletId,
          ingredientId: data.ingredientId,
          quantity: data.quantity,
          unit: ingredient.unit,
          costImpact,
          category: (data.category ?? "unexplained") as never,
          reason: data.reason ?? data.notes,
          batchId: data.batchId,
          orderId: data.orderId,
          recordedById: data.recordedById,
          notes: data.notes,
        },
      });

      return this.writeLedger(tx, {
        outletId,
        ingredientId: data.ingredientId,
        type: "wastage",
        quantity: -data.quantity,
        notes: data.notes,
        reason: data.reason,
        unitCost,
        batchId: data.batchId,
      });
    });
  }

  createPurchaseOrder(outletId: string, data: {
    supplierId: string;
    items: Array<{ ingredientId: string; quantity: number; unitPrice: number; purchaseUnit?: string }>;
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
          status: "draft",
          items: {
            create: data.items.map((i) => ({
              ingredientId: i.ingredientId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.quantity * i.unitPrice,
            })),
          },
        },
        include: { items: { include: { ingredient: true } }, supplier: true },
      });
    });
  }

  async receivePO(poId: string, lines?: Array<{ poItemId: string; receivedQty: number; rejectedQty?: number; purchaseUnit?: string }>) {
    return this.receiveGoods(poId, lines);
  }

  async receiveGoods(poId: string, lines?: Array<{ poItemId: string; receivedQty: number; rejectedQty?: number; purchaseUnit?: string }>) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id: poId },
        include: { items: { include: { ingredient: { include: { conversions: true } } } }, supplier: true },
      });

      const grnCount = await tx.goodsReceipt.count({ where: { outletId: po.outletId } });
      const grn = await tx.goodsReceipt.create({
        data: {
          outletId: po.outletId,
          grnNumber: `GRN-${String(grnCount + 1).padStart(4, "0")}`,
          purchaseOrderId: po.id,
          supplierId: po.supplierId,
        },
      });

      let allReceived = true;
      let anyReceived = false;

      for (const item of po.items) {
        const lineInput = lines?.find((l) => l.poItemId === item.id);
        const orderedQty = Number(item.quantity);
        const alreadyReceived = Number(item.receivedQty);
        const receiveQty = lineInput?.receivedQty ?? (orderedQty - alreadyReceived);
        if (receiveQty <= 0) continue;

        anyReceived = true;
        const ingredient = item.ingredient;
        const ctx = this.itemContext(ingredient);
        const purchaseUnit = lineInput?.purchaseUnit ?? ingredient.purchaseUnit ?? ingredient.unit;
        let stockQty: number;
        try {
          stockQty = toStockUnit(ctx, receiveQty, purchaseUnit);
        } catch {
          stockQty = receiveQty;
        }

        const unitCost = Number(item.unitPrice);
        const costUpdate = updateCostOnReceipt(
          {
            currentStock: Number(ingredient.currentStock),
            weightedAverageCost: Number(ingredient.weightedAverageCost || ingredient.costPerUnit),
            lastPurchaseCost: Number(ingredient.lastPurchaseCost || ingredient.costPerUnit),
          },
          stockQty,
          unitCost / (receiveQty > 0 ? stockQty / receiveQty : 1),
        );

        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: costUpdate,
        });

        const batch = ingredient.trackBatch
          ? await tx.inventoryBatch.create({
              data: {
                outletId: po.outletId,
                ingredientId: item.ingredientId,
                batchNumber: `${grn.grnNumber}-${item.id.slice(-4)}`,
                supplierId: po.supplierId,
                receivedQty: stockQty,
                remainingQty: stockQty,
                unitCost: costUpdate.weightedAverageCost,
                status: "available",
              },
            })
          : null;

        await tx.goodsReceiptLine.create({
          data: {
            goodsReceiptId: grn.id,
            ingredientId: item.ingredientId,
            receivedQty: stockQty,
            rejectedQty: lineInput?.rejectedQty ?? 0,
            unitPrice: unitCost,
            purchaseUnit,
            batchId: batch?.id,
          },
        });

        await this.writeLedger(tx, {
          outletId: po.outletId,
          ingredientId: item.ingredientId,
          type: "purchase",
          quantity: stockQty,
          reference: `${po.poNumber}:${grn.grnNumber}`,
          unitCost: costUpdate.weightedAverageCost,
          batchId: batch?.id,
        });

        const newReceived = alreadyReceived + receiveQty;
        await tx.pOItem.update({
          where: { id: item.id },
          data: { receivedQty: newReceived },
        });

        if (newReceived < orderedQty) allReceived = false;
      }

      if (!anyReceived) throw new BadRequestException("No items to receive");

      const status = allReceived ? "received" : "partial";

      await tx.supplier.update({
        where: { id: po.supplierId },
        data: {
          lastPurchaseAt: new Date(),
          totalPurchases: { increment: Number(po.totalAmount) },
        },
      });

      return tx.purchaseOrder.update({
        where: { id: poId },
        data: { status, receivedAt: allReceived ? new Date() : undefined },
        include: { items: { include: { ingredient: true } }, supplier: true },
      });
    });
  }

  async sendPO(poId: string) {
    return this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: "sent", orderedAt: new Date() },
    });
  }

  async cancelPO(poId: string) {
    const po = await this.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
    if (po.status === "received") throw new BadRequestException("Cannot cancel received PO");
    return this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: "cancelled" },
    });
  }

  createCKTransfer(fromOutletId: string, toOutletId: string, items: Array<{ ingredientId: string; quantity: number }>, notes?: string) {
    const count = this.prisma.centralKitchenTransfer.count({ where: { fromOutletId } });
    return count.then(async (c) => {
      const transfer = await this.prisma.centralKitchenTransfer.create({
        data: {
          fromOutletId,
          toOutletId,
          transferNumber: `TRF-${String(c + 1).padStart(4, "0")}`,
          items: items as never,
          notes,
          status: "requested",
          lines: {
            create: items.map((i) => ({
              ingredientId: i.ingredientId,
              requestedQty: i.quantity,
            })),
          },
        },
        include: { lines: { include: { ingredient: true } } },
      });
      return transfer;
    });
  }

  async dispatchTransfer(transferId: string) {
    const transfer = await this.prisma.centralKitchenTransfer.findUniqueOrThrow({
      where: { id: transferId },
      include: { lines: { include: { ingredient: true } } },
    });

    return this.prisma.$transaction(async (tx) => {
      for (const line of transfer.lines) {
        const qty = Number(line.requestedQty);
        await this.writeLedger(tx, {
          outletId: transfer.fromOutletId,
          ingredientId: line.ingredientId,
          type: "transfer_out",
          quantity: -qty,
          reference: transfer.transferNumber,
          unitCost: Number(line.ingredient.weightedAverageCost || line.ingredient.costPerUnit),
        });

        const ing = await tx.ingredient.findUniqueOrThrow({ where: { id: line.ingredientId } });
        await tx.inventoryBalance.upsert({
          where: {
            outletId_ingredientId_locationId_batchId: {
              outletId: transfer.fromOutletId,
              ingredientId: line.ingredientId,
              locationId: null as never,
              batchId: null as never,
            },
          },
          create: { outletId: transfer.fromOutletId, ingredientId: line.ingredientId, inTransit: qty },
          update: { inTransit: { increment: qty } },
        }).catch(() => undefined);

        await tx.stockTransferLine.update({
          where: { id: line.id },
          data: { dispatchedQty: qty },
        });
      }

      return tx.centralKitchenTransfer.update({
        where: { id: transferId },
        data: { status: "in_transit", dispatchedAt: new Date() },
        include: { lines: { include: { ingredient: true } } },
      });
    });
  }

  async receiveTransfer(transferId: string, lines?: Array<{ lineId: string; receivedQty: number }>) {
    const transfer = await this.prisma.centralKitchenTransfer.findUniqueOrThrow({
      where: { id: transferId },
      include: { lines: { include: { ingredient: true } } },
    });

    return this.prisma.$transaction(async (tx) => {
      for (const line of transfer.lines) {
        const input = lines?.find((l) => l.lineId === line.id);
        const qty = input?.receivedQty ?? Number(line.dispatchedQty);
        if (qty <= 0) continue;

        const destIngredient = await tx.ingredient.findFirst({
          where: { outletId: transfer.toOutletId, name: line.ingredient.name },
        });

        if (destIngredient) {
          await this.writeLedger(tx, {
            outletId: transfer.toOutletId,
            ingredientId: destIngredient.id,
            type: "transfer_in",
            quantity: qty,
            reference: transfer.transferNumber,
            unitCost: Number(line.ingredient.weightedAverageCost || line.ingredient.costPerUnit),
          });
        }

        await tx.stockTransferLine.update({
          where: { id: line.id },
          data: { receivedQty: qty },
        });
      }

      return tx.centralKitchenTransfer.update({
        where: { id: transferId },
        data: { status: "received", receivedAt: new Date(), deliveredAt: new Date() },
        include: { lines: { include: { ingredient: true } } },
      });
    });
  }

  getSuppliers(outletId: string) {
    return this.prisma.supplier.findMany({
      where: { outletId, isActive: true },
      include: { supplierItems: { include: { ingredient: true } }, _count: { select: { purchaseOrders: true } } },
    });
  }

  createSupplier(outletId: string, data: Record<string, unknown>) {
    return this.prisma.supplier.create({ data: { outletId, ...data } as never });
  }

  updateSupplier(id: string, data: Record<string, unknown>) {
    return this.prisma.supplier.update({ where: { id }, data: data as never });
  }

  listPurchaseOrders(outletId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { outletId },
      include: { items: { include: { ingredient: true } }, supplier: true },
      orderBy: { createdAt: "desc" },
    });
  }

  listGoodsReceipts(outletId: string) {
    return this.prisma.goodsReceipt.findMany({
      where: { outletId },
      include: { lines: { include: { ingredient: true } }, supplier: true },
      orderBy: { receivedAt: "desc" },
    });
  }

  listPurchaseRequests(outletId: string) {
    return this.prisma.purchaseRequest.findMany({
      where: { outletId },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    });
  }

  createPurchaseRequest(outletId: string, data: {
    lines: Array<{ ingredientId: string; requestedQty: number; currentStock?: number; suggestedQty?: number }>;
    requiredBy?: string; reason?: string; requesterId?: string;
  }) {
    const count = this.prisma.purchaseRequest.count({ where: { outletId } });
    return count.then((c) =>
      this.prisma.purchaseRequest.create({
        data: {
          outletId,
          requestNumber: `PR-${String(c + 1).padStart(4, "0")}`,
          requiredBy: data.requiredBy ? new Date(data.requiredBy) : undefined,
          reason: data.reason,
          requesterId: data.requesterId,
          lines: {
            create: data.lines.map((l) => ({
              ingredientId: l.ingredientId,
              requestedQty: l.requestedQty,
              currentStock: l.currentStock ?? 0,
              suggestedQty: l.suggestedQty ?? l.requestedQty,
            })),
          },
        },
        include: { lines: true },
      }),
    );
  }

  async getMenuAvailability(outletId: string) {
    const outlet = await this.prisma.outlet.findUniqueOrThrow({
      where: { id: outletId },
      include: {
        brand: {
          include: {
            menus: {
              include: {
                categories: {
                  include: {
                    items: {
                      include: {
                        recipe: { include: { items: { include: { ingredient: true } } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const items = outlet.brand.menus.flatMap((m) => m.categories.flatMap((c) => c.items));
    const result: Array<{
      menuItemId: string;
      name: string;
      canProduce: boolean;
      missingIngredients: Array<{ name: string; needed: number; available: number; unit: string }>;
    }> = [];

    for (const item of items) {
      if (!item.recipe) {
        result.push({ menuItemId: item.id, name: item.name, canProduce: true, missingIngredients: [] });
        continue;
      }

      const missing: Array<{ name: string; needed: number; available: number; unit: string }> = [];
      for (const ri of item.recipe.items) {
        const ctx = this.itemContext(ri.ingredient);
        const stockQty = fromConsumptionToStock(ctx, Number(ri.quantity));
        const available = Number(ri.ingredient.currentStock) - Number(ri.ingredient.committedStock);
        if (available < stockQty) {
          missing.push({
            name: ri.ingredient.name,
            needed: stockQty,
            available,
            unit: ri.ingredient.unit,
          });
        }
      }

      result.push({
        menuItemId: item.id,
        name: item.name,
        canProduce: missing.length === 0,
        missingIngredients: missing,
      });
    }

    return result;
  }

  async getRecipes(outletId: string) {
    const outlet = await this.prisma.outlet.findUniqueOrThrow({
      where: { id: outletId },
      include: {
        brand: {
          include: {
            menus: {
              include: {
                categories: {
                  include: {
                    items: {
                      include: {
                        recipe: {
                          include: {
                            items: { include: { ingredient: true } },
                            versions: { orderBy: { version: "desc" }, take: 1 },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const items = outlet.brand.menus.flatMap((m) => m.categories.flatMap((c) => c.items));
    return items
      .filter((i) => i.recipe)
      .map((i) => ({
        id: i.recipe!.id,
        menuItemId: i.id,
        name: i.name,
        yieldQty: i.recipe!.yieldQty,
        version: i.recipe!.version,
        isActive: i.recipe!.isActive,
        instructions: i.recipe!.instructions,
        ingredients: i.recipe!.items.map((ri) => ({
          id: ri.id,
          ingredientId: ri.ingredientId,
          name: ri.ingredient.name,
          quantity: Number(ri.quantity),
          unit: ri.consumptionUnit ?? ri.ingredient.consumptionUnit ?? ri.ingredient.unit,
          lossPct: Number(ri.lossPct),
          isOptional: ri.isOptional,
          unitCost: Number(ri.ingredient.weightedAverageCost || ri.ingredient.costPerUnit),
        })),
        recipeCost: i.recipe!.items.reduce(
          (s, ri) => s + Number(ri.quantity) * Number(ri.ingredient.weightedAverageCost || ri.ingredient.costPerUnit),
          0,
        ),
      }));
  }

  async upsertRecipe(data: {
    menuItemId: string;
    yieldQty?: number;
    instructions?: string;
    ingredients: Array<{ ingredientId: string; quantity: number; lossPct?: number; isOptional?: boolean; consumptionUnit?: string }>;
  }) {
    const existing = await this.prisma.recipe.findUnique({ where: { menuItemId: data.menuItemId } });

    if (existing) {
      await this.prisma.recipeVersion.create({
        data: {
          recipeId: existing.id,
          version: existing.version,
          yieldQty: existing.yieldQty,
          instructions: existing.instructions ?? undefined,
          effectiveTo: new Date(),
          isActive: false,
        },
      });

      await this.prisma.recipeItem.deleteMany({ where: { recipeId: existing.id } });

      return this.prisma.recipe.update({
        where: { id: existing.id },
        data: {
          yieldQty: data.yieldQty ?? existing.yieldQty,
          instructions: data.instructions,
          version: existing.version + 1,
          effectiveFrom: new Date(),
          items: {
            create: data.ingredients.map((ing) => ({
              ingredientId: ing.ingredientId,
              quantity: ing.quantity,
              lossPct: ing.lossPct ?? 0,
              isOptional: ing.isOptional ?? false,
              consumptionUnit: ing.consumptionUnit,
            })),
          },
        },
        include: { items: { include: { ingredient: true } } },
      });
    }

    return this.prisma.recipe.create({
      data: {
        menuItemId: data.menuItemId,
        yieldQty: data.yieldQty ?? 1,
        instructions: data.instructions,
        items: {
          create: data.ingredients.map((ing) => ({
            ingredientId: ing.ingredientId,
            quantity: ing.quantity,
            lossPct: ing.lossPct ?? 0,
            isOptional: ing.isOptional ?? false,
            consumptionUnit: ing.consumptionUnit,
          })),
        },
      },
      include: { items: { include: { ingredient: true } } },
    });
  }

  listTransfers(outletId: string) {
    return this.prisma.centralKitchenTransfer.findMany({
      where: { OR: [{ fromOutletId: outletId }, { toOutletId: outletId }] },
      include: { lines: { include: { ingredient: true } } },
      orderBy: { requestedAt: "desc" },
    });
  }

  async createStockCount(outletId: string, data: { countType: string; locationName?: string; isBlind?: boolean; countedById?: string }) {
    const ingredients = await this.prisma.ingredient.findMany({ where: { outletId, isActive: true } });
    const count = await this.prisma.stockCount.count({ where: { outletId } });

    return this.prisma.stockCount.create({
      data: {
        outletId,
        countNumber: `CNT-${String(count + 1).padStart(4, "0")}`,
        countType: data.countType as never,
        locationName: data.locationName,
        isBlind: data.isBlind ?? false,
        countedById: data.countedById,
        status: "in_progress",
        lines: {
          create: ingredients.map((i) => ({
            ingredientId: i.id,
            expectedStock: Number(i.currentStock),
            physicalStock: 0,
            variance: -Number(i.currentStock),
            varianceValue: -Number(i.currentStock) * Number(i.weightedAverageCost || i.costPerUnit),
          })),
        },
      },
      include: { lines: { include: { ingredient: true } } },
    });
  }

  async updateStockCountLine(countId: string, lineId: string, physicalStock: number, reason?: string) {
    const line = await this.prisma.stockCountLine.findUniqueOrThrow({
      where: { id: lineId },
      include: { ingredient: true, stockCount: true },
    });

    if (line.stockCountId !== countId) throw new BadRequestException("Line does not belong to count");

    const variance = physicalStock - Number(line.expectedStock);
    const unitCost = Number(line.ingredient.weightedAverageCost || line.ingredient.costPerUnit);

    return this.prisma.stockCountLine.update({
      where: { id: lineId },
      data: {
        physicalStock,
        variance,
        varianceValue: variance * unitCost,
        reason,
      },
    });
  }

  async approveStockCount(countId: string, approvedById?: string) {
    const count = await this.prisma.stockCount.findUniqueOrThrow({
      where: { id: countId },
      include: { lines: { include: { ingredient: true } }, outlet: true },
    });

    return this.prisma.$transaction(async (tx) => {
      for (const line of count.lines) {
        const variance = Number(line.variance);
        if (variance === 0) continue;

        await this.writeLedger(tx, {
          outletId: count.outletId,
          ingredientId: line.ingredientId,
          type: "stock_count_adjustment",
          quantity: variance,
          reference: count.countNumber,
          reason: line.reason ?? "Stock count variance",
          unitCost: Number(line.ingredient.weightedAverageCost || line.ingredient.costPerUnit),
        });
      }

      return tx.stockCount.update({
        where: { id: countId },
        data: { status: "posted", approvedById, updatedAt: new Date() },
        include: { lines: { include: { ingredient: true } } },
      });
    });
  }

  getStockCounts(outletId: string) {
    return this.prisma.stockCount.findMany({
      where: { outletId },
      include: { lines: { include: { ingredient: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  listWastage(outletId: string) {
    return this.prisma.wastageEntry.findMany({
      where: { outletId },
      include: { ingredient: true, batch: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async createProductionOrder(outletId: string, data: {
    outputItemId: string; plannedOutput: number; plannedDate?: string;
    inputs: Array<{ ingredientId: string; plannedQty: number }>; notes?: string;
  }) {
    const count = await this.prisma.productionOrder.count({ where: { outletId } });
    return this.prisma.productionOrder.create({
      data: {
        outletId,
        orderNumber: `PROD-${String(count + 1).padStart(4, "0")}`,
        outputItemId: data.outputItemId,
        plannedOutput: data.plannedOutput,
        plannedDate: data.plannedDate ? new Date(data.plannedDate) : undefined,
        notes: data.notes,
        inputs: {
          create: data.inputs.map((i) => ({
            ingredientId: i.ingredientId,
            plannedQty: i.plannedQty,
          })),
        },
      },
      include: { outputItem: true, inputs: { include: { ingredient: true } } },
    });
  }

  async completeProductionOrder(orderId: string, data: {
    actualOutput: number; inputs: Array<{ inputId: string; actualQty: number }>; batchNumber?: string;
  }) {
    const order = await this.prisma.productionOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { inputs: { include: { ingredient: true } }, outputItem: true },
    });

    return this.prisma.$transaction(async (tx) => {
      let totalInputCost = 0;
      for (const input of order.inputs) {
        const actual = data.inputs.find((i) => i.inputId === input.id)?.actualQty ?? Number(input.plannedQty);
        const unitCost = Number(input.ingredient.weightedAverageCost || input.ingredient.costPerUnit);
        totalInputCost += actual * unitCost;

        await this.writeLedger(tx, {
          outletId: order.outletId,
          ingredientId: input.ingredientId,
          type: "production_consumption",
          quantity: -actual,
          reference: order.orderNumber,
          unitCost,
        });

        await tx.productionInput.update({
          where: { id: input.id },
          data: { actualQty: actual },
        });
      }

      const costPerUnit = data.actualOutput > 0 ? totalInputCost / data.actualOutput : 0;
      const productionLoss = order.inputs.reduce((s, i) => s + Number(i.plannedQty), 0) - data.actualOutput;

      await this.writeLedger(tx, {
        outletId: order.outletId,
        ingredientId: order.outputItemId,
        type: "production_output",
        quantity: data.actualOutput,
        reference: order.orderNumber,
        unitCost: costPerUnit,
      });

      return tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: "completed",
          actualOutput: data.actualOutput,
          productionLoss: Math.max(0, productionLoss),
          completedAt: new Date(),
          costPerUnit,
          batchNumber: data.batchNumber,
        },
        include: { outputItem: true, inputs: { include: { ingredient: true } } },
      });
    });
  }

  listProductionOrders(outletId: string) {
    return this.prisma.productionOrder.findMany({
      where: { outletId },
      include: { outputItem: true, inputs: { include: { ingredient: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  listPurchaseInvoices(outletId: string) {
    return this.prisma.purchaseInvoice.findMany({
      where: { outletId },
      include: { supplier: true, goodsReceipt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  createPurchaseInvoice(outletId: string, data: Record<string, unknown>) {
    return this.prisma.purchaseInvoice.create({
      data: { outletId, ...data } as never,
      include: { supplier: true },
    });
  }

  listPurchaseReturns(outletId: string) {
    return this.prisma.purchaseReturn.findMany({
      where: { outletId },
      include: { supplier: true, lines: { include: { ingredient: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async createPurchaseReturn(outletId: string, data: {
    supplierId: string; reason: string;
    lines: Array<{ ingredientId: string; quantity: number }>; notes?: string;
  }) {
    const count = await this.prisma.purchaseReturn.count({ where: { outletId } });
    return this.prisma.$transaction(async (tx) => {
      const ret = await tx.purchaseReturn.create({
        data: {
          outletId,
          supplierId: data.supplierId,
          returnNumber: `PRET-${String(count + 1).padStart(4, "0")}`,
          reason: data.reason,
          notes: data.notes,
          lines: {
            create: await Promise.all(
              data.lines.map(async (l) => {
                const ing = await tx.ingredient.findUniqueOrThrow({ where: { id: l.ingredientId } });
                const unitCost = Number(ing.weightedAverageCost || ing.costPerUnit);
                await this.writeLedger(tx, {
                  outletId,
                  ingredientId: l.ingredientId,
                  type: "purchase_return",
                  quantity: -l.quantity,
                  reference: `PRET-${count + 1}`,
                  unitCost,
                });
                return { ingredientId: l.ingredientId, quantity: l.quantity, unitCost };
              }),
            ),
          },
        },
        include: { lines: { include: { ingredient: true } }, supplier: true },
      });
      return ret;
    });
  }

  async createAlert(outletId: string, alertType: string, message: string, ingredientId?: string, metadata?: Record<string, unknown>) {
    return this.prisma.inventoryAlert.create({
      data: {
        outletId,
        ingredientId,
        alertType: alertType as never,
        message,
        metadata: (metadata ?? {}) as never,
      },
    });
  }

  async checkAndCreateLowStockAlerts(outletId: string) {
    const ingredients = await this.prisma.ingredient.findMany({ where: { outletId, isActive: true } });
    for (const ing of ingredients) {
      const available = Number(ing.currentStock) - Number(ing.committedStock);
      const reorder = Number(ing.reorderLevel || ing.minStock);
      if (available <= 0) {
        await this.createAlert(outletId, "stock_out", `${ing.name} is out of stock`, ing.id);
      } else if (available <= reorder) {
        await this.createAlert(outletId, "below_reorder", `${ing.name} below reorder level (${available} ${ing.unit})`, ing.id);
      }
    }
    return { checked: ingredients.length };
  }

  listAlerts(outletId: string) {
    return this.prisma.inventoryAlert.findMany({
      where: { outletId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { ingredient: { select: { name: true } } },
    });
  }

  async getReorderSuggestions(outletId: string) {
    const ingredients = await this.prisma.ingredient.findMany({ where: { outletId, isActive: true } });
    return ingredients
      .map((i) => {
        const available = Number(i.currentStock) - Number(i.committedStock);
        const reorder = Number(i.reorderLevel || i.minStock);
        if (available > reorder) return null;
        const forecastDemand = Number(i.targetStock || i.parStock) || reorder * 2;
        const suggestedQty = calculateReorderSuggestion({
          forecastDemand,
          available,
          incoming: 0,
          safetyStock: Number(i.safetyStock),
          targetStock: Number(i.targetStock || i.parStock),
        });
        if (suggestedQty <= 0) return null;
        return {
          ingredientId: i.id,
          name: i.name,
          suggestedQty,
          unit: i.unit,
          explanation: {
            forecastDemand,
            available,
            incoming: 0,
            safetyStock: Number(i.safetyStock),
            leadTimeDays: i.leadTimeDays,
          },
        };
      })
      .filter(Boolean);
  }
}
