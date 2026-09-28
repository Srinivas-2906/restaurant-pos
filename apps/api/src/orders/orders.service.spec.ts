import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { OrdersService } from "./orders.service";

describe("OrdersService captain flow", () => {
  let prisma: {
    order: {
      count: jest.Mock;
      create: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    orderItem: {
      findMany: jest.Mock;
      findFirstOrThrow: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
    table: { update: jest.Mock };
    kOT: { count: jest.Mock; create: jest.Mock; updateMany: jest.Mock };
    kOTItem: { updateMany: jest.Mock; findMany: jest.Mock };
    outlet: { findUnique: jest.Mock; findUniqueOrThrow?: jest.Mock };
    payment: { createMany: jest.Mock; findMany: jest.Mock };
    invoiceSequence: { upsert: jest.Mock };
    invoice: { create: jest.Mock; findUnique?: jest.Mock };
    customer: { upsert: jest.Mock };
    reservation: { update: jest.Mock };
    auditLog: { findMany: jest.Mock };
  };
  let events: { emitOrderUpdate: jest.Mock; emitKOTUpdate: jest.Mock; emitReservationUpdate: jest.Mock };
  let inventory: { commitStockForOrder: jest.Mock; consumeCommittedStock: jest.Mock; releaseCommit: jest.Mock };
  let audit: { log: jest.Mock };
  let printBridge: { printProformaBill: jest.Mock };
  let service: OrdersService;

  beforeEach(() => {
    prisma = {
      order: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      orderItem: {
        findMany: jest.fn(),
        findFirstOrThrow: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      table: { update: jest.fn() },
      kOT: { count: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
      kOTItem: { updateMany: jest.fn(), findMany: jest.fn() },
      outlet: { findUnique: jest.fn().mockResolvedValue({ brand: { organizationId: "org-1" } }) },
      payment: { createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      invoiceSequence: { upsert: jest.fn() },
      invoice: { create: jest.fn(), findUnique: jest.fn() },
      customer: { upsert: jest.fn() },
      reservation: { update: jest.fn() },
      auditLog: { findMany: jest.fn() },
    };
    events = {
      emitOrderUpdate: jest.fn(),
      emitKOTUpdate: jest.fn(),
      emitReservationUpdate: jest.fn(),
    };
    inventory = {
      commitStockForOrder: jest.fn(),
      consumeCommittedStock: jest.fn(),
      releaseCommit: jest.fn(),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    printBridge = { printProformaBill: jest.fn() };
    const accounting = {
      postOrderSettlementAccounting: jest.fn().mockResolvedValue(undefined),
    };
    const accountingQueue = {
      runOrEnqueue: jest.fn().mockImplementation(({ execute }) => execute()),
    };
    service = new OrdersService(
      prisma as never,
      events as never,
      inventory as never,
      audit as never,
      printBridge as never,
      accounting as never,
      accountingQueue as never,
    );
  });

  it("creates dine-in orders with captain source when actor is captain", async () => {
    prisma.order.create.mockResolvedValue({
      id: "ord-1",
      outletId: "out-1",
      source: "captain",
      type: "dine_in",
      orderNumber: "ORD-00001",
      items: [],
      table: { id: "t1" },
      createdBy: { id: "u1", firstName: "Cap", lastName: null },
    });
    prisma.outlet.findUnique.mockResolvedValue({
      brand: { organizationId: "org-1" },
    });

    const order = await service.create({
      outletId: "out-1",
      tableId: "t1",
      type: "dine_in",
      guestCount: 2,
      createdById: "u1",
      actorRole: "captain",
    });

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: "captain", type: "dine_in" }),
      }),
    );
    expect(order.source).toBe("captain");
  });

  it("requestBill sets table bill_requested and emits event", async () => {
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: "ord-1",
      outletId: "out-1",
      tableId: "t1",
      status: "open",
      orderNumber: "ORD-00001",
      totalAmount: 500,
      items: [{ id: "i1" }],
      table: { number: "12" },
    });
    prisma.order.update.mockResolvedValue({});
    prisma.table.update.mockResolvedValue({});
    prisma.outlet.findUnique.mockResolvedValue({
      brand: { organizationId: "org-1" },
    });
    jest.spyOn(service, "findOne").mockResolvedValue({ id: "ord-1" } as never);

    await service.requestBill("ord-1", { userId: "user-1", authMode: "email" });

    expect(prisma.table.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "bill_requested" } }),
    );
    expect(events.emitOrderUpdate).toHaveBeenCalledWith(
      "out-1",
      expect.objectContaining({ type: "bill_requested", orderId: "ord-1" }),
    );
  });

  it("blocks captain settle when outlet billingMode is cashier_settles", async () => {
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: "ord-1",
      outletId: "out-1",
      status: "open",
      totalAmount: 100,
      items: [],
      outlet: { settings: { billingMode: "cashier_settles" } },
    });

    await expect(
      service.settle(
        "ord-1",
        { payments: [{ method: "cash", amount: 100 }] },
        { role: "captain", permissions: ["settle_bill"] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects fireKOT when items lack kitchen station", async () => {
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: "ord-1",
      outletId: "out-1",
      items: [
        {
          id: "i1",
          kotId: null,
          status: "pending",
          name: "Mystery Item",
          menuItem: { kitchenStationId: null },
        },
      ],
      table: null,
    });

    await expect(service.fireKOT("ord-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows captain settle when outlet billingMode is captain_can_settle", async () => {
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: "ord-1",
      outletId: "out-1",
      status: "open",
      subtotal: 95,
      taxAmount: 5,
      totalAmount: 100,
      items: [{ id: "i1", menuItemId: "m1", quantity: 1, menuItem: {} }],
      outlet: { settings: { billingMode: "captain_can_settle" }, gstin: null },
    });
    prisma.payment.createMany.mockResolvedValue({ count: 1 });
    prisma.order.update.mockResolvedValue({});
    prisma.table.update.mockResolvedValue({});
    prisma.invoiceSequence.upsert.mockResolvedValue({ lastNumber: 1 });
    prisma.invoice.create.mockResolvedValue({ invoiceNumber: "INV-1", taxableAmount: 95, cgstAmount: 2.5, sgstAmount: 2.5, totalAmount: 100 });
    jest.spyOn(service, "findOne").mockResolvedValue({ id: "ord-1", status: "settled" } as never);

    await expect(
      service.settle(
        "ord-1",
        { payments: [{ method: "cash", amount: 100 }] },
        { role: "captain", permissions: ["settle_bill"] },
      ),
    ).resolves.toBeDefined();
  });

  it("returns empty array when no pending items to fire (idempotent)", async () => {
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: "ord-1",
      outletId: "out-1",
      tableId: null,
      items: [],
      table: null,
    });

    const result = await service.fireKOT("ord-1");
    expect(result).toEqual([]);
    expect(prisma.kOT.create).not.toHaveBeenCalled();
  });

  it("returns existing order when settle is retried on already settled order", async () => {
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: "ord-settled",
      outletId: "out-1",
      status: "settled",
      totalAmount: 500,
      subtotal: 480,
      taxAmount: 20,
      items: [],
      outlet: { gstin: null, settings: {} },
    });
    jest.spyOn(service, "findOne").mockResolvedValue({ id: "ord-settled", status: "settled" } as never);
    prisma.invoice.findUnique = jest.fn().mockResolvedValue({
      invoiceNumber: "INV-1",
      taxableAmount: 480,
      cgstAmount: 10,
      sgstAmount: 10,
      totalAmount: 500,
    });
    prisma.payment.findMany.mockResolvedValue([{ method: "cash", amount: 500 }]);

    const result = await service.settle("ord-settled", { payments: [{ method: "cash", amount: 500 }] });
    expect(result.order.status).toBe("settled");
    expect(prisma.payment.createMany).not.toHaveBeenCalled();
  });

  it("recalculates tax proportionally when discount is applied", () => {
    const totals = service.computeInvoiceTotals(
      { subtotal: { toString: () => "200" } as never, taxAmount: { toString: () => "10" } as never },
      20,
    );
    expect(totals.taxableAmount).toBe(180);
    expect(totals.taxAmount).toBe(9);
    expect(totals.cgstAmount).toBe(4.5);
    expect(totals.sgstAmount).toBe(4.5);
    expect(totals.totalAmount).toBe(189);
  });

  it("rejects discount without permission", async () => {
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: "ord-1",
      outletId: "out-1",
      status: "open",
      totalAmount: 100,
      items: [],
      outlet: { settings: {} },
    });

    await expect(
      service.settle(
        "ord-1",
        { payments: [{ method: "cash", amount: 80 }], discountAmount: 20 },
        { role: "biller", permissions: [] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("cancelOrder releases stock and frees table when no other active order", async () => {
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: "ord-1",
      outletId: "out-1",
      tableId: "t1",
      status: "open",
      source: "pos",
      externalOrderId: null,
      notes: null,
      items: [{ id: "item-1" }],
      table: { number: "3" },
    });
    prisma.kOT.updateMany.mockResolvedValue({ count: 0 });
    prisma.order.update.mockResolvedValue({ id: "ord-1", status: "cancelled" });
    prisma.order.count.mockResolvedValue(0);
    prisma.table.update.mockResolvedValue({});
    prisma.outlet.findUnique.mockResolvedValue({
      brand: { organizationId: "org-1" },
    });

    await service.cancelOrder("ord-1", "test cancel", {
      authMode: "operational",
      staffProfileId: "staff-1",
      terminalId: "term-1",
    });

    expect(inventory.releaseCommit).toHaveBeenCalledWith("out-1", "item-1", false);
    expect(prisma.table.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1" }, data: { status: "free" } }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          staffProfileId: "staff-1",
          terminalId: "term-1",
          authMode: "operational",
        }),
      }),
    );
  });

  it("cancelOrder keeps table seated when another active order exists", async () => {
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: "ord-1",
      outletId: "out-1",
      tableId: "t1",
      status: "open",
      source: "pos",
      externalOrderId: null,
      notes: null,
      items: [],
      table: { number: "3" },
    });
    prisma.kOT.updateMany.mockResolvedValue({ count: 0 });
    prisma.order.update.mockResolvedValue({ id: "ord-1", status: "cancelled" });
    prisma.order.count.mockResolvedValue(1);
    prisma.outlet.findUnique.mockResolvedValue({
      brand: { organizationId: "org-1" },
    });

    await service.cancelOrder("ord-1");

    expect(prisma.table.update).not.toHaveBeenCalled();
  });
});
