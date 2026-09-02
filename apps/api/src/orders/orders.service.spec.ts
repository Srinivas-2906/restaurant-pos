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
    kOT: { count: jest.Mock; create: jest.Mock };
    kOTItem: { updateMany: jest.Mock; findMany: jest.Mock };
    outlet: { findUnique: jest.Mock };
    payment: { createMany: jest.Mock };
    invoiceSequence: { upsert: jest.Mock };
    invoice: { create: jest.Mock };
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
      kOT: { count: jest.fn(), create: jest.fn() },
      kOTItem: { updateMany: jest.fn(), findMany: jest.fn() },
      outlet: { findUnique: jest.fn() },
      payment: { createMany: jest.fn() },
      invoiceSequence: { upsert: jest.fn() },
      invoice: { create: jest.fn() },
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
    service = new OrdersService(
      prisma as never,
      events as never,
      inventory as never,
      audit as never,
      printBridge as never,
    );
  });

  it("creates dine-in orders with captain source when actor is captain", async () => {
    prisma.order.create.mockResolvedValue({
      id: "ord-1",
      outletId: "out-1",
      source: "captain",
      type: "dine_in",
      items: [],
      table: { id: "t1" },
      createdBy: { id: "u1", firstName: "Cap", lastName: null },
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
    jest.spyOn(service, "findOne").mockResolvedValue({ id: "ord-1" } as never);

    await service.requestBill("ord-1", "user-1");

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
      totalAmount: 100,
      items: [{ id: "i1", menuItemId: "m1", quantity: 1 }],
      outlet: { settings: { billingMode: "captain_can_settle" } },
    });
    prisma.payment.createMany.mockResolvedValue({ count: 1 });
    prisma.order.update.mockResolvedValue({});
    prisma.table.update.mockResolvedValue({});
    prisma.invoiceSequence.upsert.mockResolvedValue({ lastNumber: 1 });
    prisma.invoice.create.mockResolvedValue({});
    jest.spyOn(service, "findOne").mockResolvedValue({ id: "ord-1", status: "settled" } as never);

    await expect(
      service.settle(
        "ord-1",
        { payments: [{ method: "cash", amount: 100 }] },
        { role: "captain", permissions: ["settle_bill"] },
      ),
    ).resolves.toBeDefined();
  });

  it("infers fulfilment for aggregator delivery orders", async () => {
    prisma.order.create.mockResolvedValue({
      id: "ord-2",
      outletId: "out-1",
      source: "swiggy",
      type: "delivery",
      fulfilment: "aggregator",
      items: [],
      table: null,
      createdBy: null,
    });

    await service.create({
      outletId: "out-1",
      type: "delivery",
      source: "swiggy",
    });

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fulfilment: "aggregator", source: "swiggy" }),
      }),
    );
  });
});
