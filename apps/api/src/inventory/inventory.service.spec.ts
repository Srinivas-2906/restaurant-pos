import { BadRequestException } from "@nestjs/common";
import { InventoryService } from "./inventory.service";

describe("InventoryService Step 12 hardening", () => {
  let prisma: {
    $transaction: jest.Mock;
    ingredient: {
      findUniqueOrThrow: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    stockLedger: { findFirst: jest.Mock; findMany: jest.Mock; create: jest.Mock };
    stockCommitment: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
    purchaseOrder: { findUniqueOrThrow: jest.Mock; update: jest.Mock; count: jest.Mock };
    goodsReceipt: { count: jest.Mock; create: jest.Mock };
    goodsReceiptLine: { create: jest.Mock };
    pOItem: { update: jest.Mock };
    supplier: { update: jest.Mock };
    inventoryBalance: { upsert: jest.Mock };
    inventoryBatch: { create: jest.Mock };
    centralKitchenTransfer: { findUniqueOrThrow: jest.Mock; update: jest.Mock };
    stockTransferLine: { update: jest.Mock };
    stockCount: { findUniqueOrThrow: jest.Mock; update: jest.Mock };
    wastageEntry: { create: jest.Mock };
    recipe: { findUnique: jest.Mock };
    outlet: { findUniqueOrThrow: jest.Mock };
  };
  let menuService: { updateAvailability: jest.Mock };
  let accounting: {
    postGoodsReceiptAccounting: jest.Mock;
    postWastageAccounting: jest.Mock;
    postStockAdjustmentAccounting: jest.Mock;
    postPurchaseInvoiceAccounting: jest.Mock;
    postTransferDispatchAccounting: jest.Mock;
    postTransferReceiveAccounting: jest.Mock;
  };
  let service: InventoryService;

  const chickenIngredient = {
    id: "ing-chicken",
    name: "Chicken",
    unit: "kg",
    consumptionUnit: "g",
    purchaseUnit: "kg",
    purchaseToStockFactor: 1,
    stockToConsumptionFactor: 1000,
    currentStock: 20,
    committedStock: 0,
    weightedAverageCost: 280,
    costPerUnit: 280,
    lastPurchaseCost: 280,
    negativeStockPolicy: "block",
    trackBatch: false,
    conversions: [],
    isActive: true,
    outletId: "out-1",
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (fn: (tx: typeof prisma) => unknown) => fn(prisma)),
      ingredient: {
        findUniqueOrThrow: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      stockLedger: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
      stockCommitment: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      purchaseOrder: { findUniqueOrThrow: jest.fn(), update: jest.fn(), count: jest.fn() },
      goodsReceipt: { count: jest.fn(), create: jest.fn() },
      goodsReceiptLine: { create: jest.fn() },
      pOItem: { update: jest.fn() },
      supplier: { update: jest.fn() },
      inventoryBalance: { upsert: jest.fn().mockRejectedValue(new Error("skip")) },
      inventoryBatch: { create: jest.fn() },
      centralKitchenTransfer: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
      stockTransferLine: { update: jest.fn() },
      stockCount: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
      wastageEntry: { create: jest.fn() },
      recipe: { findUnique: jest.fn() },
      outlet: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ brand: { organizationId: "org-1" } }),
      },
    };
    menuService = { updateAvailability: jest.fn() };
    accounting = {
      postGoodsReceiptAccounting: jest.fn().mockResolvedValue(null),
      postWastageAccounting: jest.fn().mockResolvedValue(null),
      postStockAdjustmentAccounting: jest.fn().mockResolvedValue(null),
      postPurchaseInvoiceAccounting: jest.fn().mockResolvedValue(null),
      postTransferDispatchAccounting: jest.fn().mockResolvedValue(null),
      postTransferReceiveAccounting: jest.fn().mockResolvedValue(null),
    };
    const accountingQueue = {
      runOrEnqueue: jest.fn().mockImplementation(({ execute }) => execute()),
    };
    service = new InventoryService(
      prisma as never,
      menuService as never,
      accounting as never,
      accountingQueue as never,
    );

    prisma.ingredient.findUniqueOrThrow.mockResolvedValue(chickenIngredient);
    prisma.ingredient.update.mockImplementation(({ data }) => ({
      ...chickenIngredient,
      ...data,
      currentStock: data.currentStock ?? chickenIngredient.currentStock,
    }));
    prisma.stockLedger.create.mockImplementation(({ data }) => ({ id: "led-1", ...data }));
  });

  describe("recordOpeningStock", () => {
    it("rejects duplicate opening stock for same ingredient", async () => {
      prisma.stockLedger.findFirst.mockResolvedValue({ id: "existing" });

      await expect(
        service.recordOpeningStock("out-1", { ingredientId: "ing-chicken", quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("receiveGoods", () => {
    const poBase = {
      id: "po-1",
      outletId: "out-1",
      poNumber: "PO-0005",
      supplierId: "sup-1",
      status: "sent",
      totalAmount: 1400,
      items: [
        {
          id: "poi-1",
          ingredientId: "ing-chicken",
          quantity: 10,
          receivedQty: 0,
          unitPrice: 280,
          ingredient: chickenIngredient,
        },
      ],
      supplier: { id: "sup-1" },
    };

    beforeEach(() => {
      prisma.purchaseOrder.findUniqueOrThrow.mockResolvedValue(poBase);
      prisma.goodsReceipt.count.mockResolvedValue(0);
      prisma.goodsReceipt.create.mockResolvedValue({ id: "grn-1", grnNumber: "GRN-0001" });
      prisma.purchaseOrder.update.mockResolvedValue({ ...poBase, status: "received" });
      prisma.stockLedger.findFirst.mockResolvedValue(null);
    });

    it("posts purchase ledger and updates stock on receive", async () => {
      await service.receiveGoods("po-1");

      expect(prisma.stockLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "purchase", quantity: 10 }),
        }),
      );
      expect(prisma.pOItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { receivedQty: 10 } }),
      );
    });

    it("rejects over-receive beyond ordered quantity", async () => {
      await expect(
        service.receiveGoods("po-1", [{ poItemId: "poi-1", receivedQty: 12 }]),
      ).rejects.toThrow(/Cannot receive/);
    });

    it("returns idempotently when idempotencyKey already used", async () => {
      prisma.stockLedger.findFirst.mockResolvedValue({ id: "dup" });

      const result = await service.receiveGoods("po-1", undefined, { idempotencyKey: "recv-1" });

      expect(result).toBeDefined();
      expect(prisma.goodsReceipt.create).not.toHaveBeenCalled();
    });

    it("rejects receive on cancelled PO", async () => {
      prisma.purchaseOrder.findUniqueOrThrow.mockResolvedValue({ ...poBase, status: "cancelled" });

      await expect(service.receiveGoods("po-1")).rejects.toThrow(/cancelled/);
    });

    it("rejects receive on draft PO", async () => {
      prisma.purchaseOrder.findUniqueOrThrow.mockResolvedValue({ ...poBase, status: "draft" });

      await expect(service.receiveGoods("po-1")).rejects.toThrow(/Send the purchase order/);
    });

    it("supports partial receive", async () => {
      prisma.purchaseOrder.update.mockResolvedValue({ ...poBase, status: "partial" });

      await service.receiveGoods("po-1", [{ poItemId: "poi-1", receivedQty: 6 }]);

      expect(prisma.pOItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { receivedQty: 6 } }),
      );
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "partial" }) }),
      );
    });
  });

  describe("cancelPO", () => {
    it("allows cancel on sent PO without reversing stock", async () => {
      prisma.purchaseOrder.findUniqueOrThrow.mockResolvedValue({
        id: "po-1",
        status: "sent",
        items: [{ receivedQty: 0 }],
      });
      prisma.purchaseOrder.update.mockResolvedValue({ id: "po-1", status: "cancelled" });

      const result = await service.cancelPO("po-1");

      expect(result.status).toBe("cancelled");
      expect(prisma.stockLedger.create).not.toHaveBeenCalled();
    });

    it("rejects cancel on fully received PO", async () => {
      prisma.purchaseOrder.findUniqueOrThrow.mockResolvedValue({
        id: "po-1",
        status: "received",
        items: [{ receivedQty: 10 }],
      });

      await expect(service.cancelPO("po-1")).rejects.toThrow(/fully received/);
    });
  });

  describe("writeLedger negative stock policy", () => {
    it("blocks wastage when policy is block and stock insufficient", async () => {
      prisma.ingredient.findUniqueOrThrow.mockResolvedValue({
        ...chickenIngredient,
        currentStock: 0.2,
        negativeStockPolicy: "block",
      });
      prisma.wastageEntry.create.mockResolvedValue({ id: "w1" });

      await expect(
        service.recordWastage("out-1", { ingredientId: "ing-chicken", quantity: 0.5, reason: "Spoiled" }),
      ).rejects.toThrow(/Insufficient stock/);
    });
  });

  describe("dispatchTransfer idempotency", () => {
    it("does not double-post transfer_out on retry", async () => {
      prisma.centralKitchenTransfer.findUniqueOrThrow.mockResolvedValue({
        id: "tr-1",
        fromOutletId: "out-1",
        toOutletId: "out-2",
        transferNumber: "TRF-0001",
        status: "requested",
        lines: [
          {
            id: "ln-1",
            ingredientId: "ing-rice",
            requestedQty: 5,
            ingredient: { ...chickenIngredient, id: "ing-rice", name: "Rice" },
          },
        ],
      });
      prisma.stockLedger.findFirst.mockResolvedValue({ id: "existing-out" });
      prisma.centralKitchenTransfer.update.mockResolvedValue({ id: "tr-1", status: "in_transit" });

      await service.dispatchTransfer("tr-1");

      expect(prisma.stockLedger.create).not.toHaveBeenCalled();
    });
  });

  describe("reconcileOutletStock", () => {
    it("reports mismatch when ledger sum differs from currentStock", async () => {
      prisma.ingredient.findMany.mockResolvedValue([
        { id: "ing-1", name: "Rice", currentStock: 10, committedStock: 0, unit: "kg" },
      ]);
      prisma.stockLedger.findMany.mockResolvedValue([
        { quantity: 8, type: "opening_stock" },
        { quantity: 0, type: "committed_out" },
      ]);

      const result = await service.reconcileOutletStock("out-1");

      expect(result.ok).toBe(false);
      expect(result.mismatchCount).toBe(1);
      expect(result.mismatches[0].delta).toBe(2);
    });

    it("passes when ledger sum matches currentStock", async () => {
      prisma.ingredient.findMany.mockResolvedValue([
        { id: "ing-1", name: "Rice", currentStock: 10, committedStock: 0, unit: "kg" },
      ]);
      prisma.stockLedger.findMany.mockResolvedValue([
        { quantity: 10, type: "opening_stock" },
      ]);

      const result = await service.reconcileOutletStock("out-1");

      expect(result.ok).toBe(true);
      expect(result.mismatchCount).toBe(0);
    });
  });

  describe("commitStockForOrderItem idempotency", () => {
    it("skips duplicate commitment for same order item ingredient", async () => {
      prisma.recipe.findUnique.mockResolvedValue({
        items: [{ ingredientId: "ing-chicken", quantity: 280, lossPct: 0, ingredient: chickenIngredient }],
      });
      prisma.stockCommitment.findUnique.mockResolvedValue({ id: "existing" });

      await service.commitStockForOrderItem("out-1", "ord-1", "oi-1", "menu-1", 1);

      expect(prisma.stockCommitment.create).not.toHaveBeenCalled();
    });
  });

  describe("consumeCommittedStock idempotency", () => {
    it("skips duplicate consumption ledger", async () => {
      prisma.recipe.findUnique.mockResolvedValue({
        items: [{ ingredientId: "ing-chicken", quantity: 280, lossPct: 0, ingredient: chickenIngredient }],
      });
      prisma.stockLedger.findFirst.mockResolvedValue({ id: "existing-consume" });

      await service.consumeCommittedStock("out-1", "menu-1", 1, "ord-1", "oi-1");

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
