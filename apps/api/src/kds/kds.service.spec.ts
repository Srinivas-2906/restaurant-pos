import { KdsService } from "./kds.service";

describe("KdsService queue", () => {
  let prisma: {
    kOT: { findMany: jest.Mock; update: jest.Mock };
    kOTItem: { updateMany: jest.Mock };
    orderItem: { updateMany: jest.Mock; findMany: jest.Mock };
    order: { update: jest.Mock };
    outlet: { findUnique: jest.Mock };
  };
  let events: { emitKOTUpdate: jest.Mock; emitOrderUpdate: jest.Mock };
  let audit: { log: jest.Mock };
  let service: KdsService;

  beforeEach(() => {
    prisma = {
      kOT: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      kOTItem: { updateMany: jest.fn() },
      orderItem: { updateMany: jest.fn(), findMany: jest.fn() },
      order: { update: jest.fn() },
      outlet: { findUnique: jest.fn() },
    };
    events = { emitKOTUpdate: jest.fn(), emitOrderUpdate: jest.fn() };
    audit = { log: jest.fn() };
    service = new KdsService(prisma as never, events as never, audit as never);
  });

  it("loads outlet queue with pending, preparing, and ready excluding cancelled orders", async () => {
    await service.getOutletQueue("outlet-1");
    expect(prisma.kOT.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["pending", "preparing", "ready"] },
          order: {
            outletId: "outlet-1",
            status: { notIn: ["cancelled", "voided", "settled"] },
          },
        }),
      }),
    );
  });

  it("marks KOT preparing and syncs order items", async () => {
    prisma.kOT.update.mockResolvedValue({
      id: "kot-1",
      kotNumber: "KOT-0001",
      kitchenStationId: "st-1",
      orderId: "ord-1",
      kitchenStation: { name: "Main Kitchen" },
      items: [{ orderItemId: "oi-1", orderItem: { name: "Biryani" } }],
      order: {
        outletId: "outlet-1",
        tableId: "t-1",
        table: { number: "2" },
        items: [{ kotId: "kot-1", status: "preparing" }],
      },
    });
    prisma.orderItem.findMany.mockResolvedValue([
      { id: "oi-1", kotId: "kot-1", status: "preparing" },
    ]);
    prisma.outlet.findUnique.mockResolvedValue({
      brand: { organizationId: "org-1" },
    });

    await service.markPreparing("kot-1", { userId: "user-1", authMode: "email" });

    expect(prisma.kOT.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "preparing" } }),
    );
    expect(prisma.kOTItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "preparing" } }),
    );
    expect(events.emitOrderUpdate).toHaveBeenCalledWith(
      "outlet-1",
      expect.objectContaining({ type: "kot_preparing", orderId: "ord-1" }),
    );
  });

  it("marks KOT ready and emits kot_ready", async () => {
    prisma.kOT.update.mockResolvedValue({
      id: "kot-2",
      kotNumber: "KOT-0002",
      kitchenStationId: "st-1",
      orderId: "ord-1",
      kitchenStation: { name: "Bar" },
      items: [{ orderItemId: "oi-2", orderItem: { name: "Soda" } }],
      order: {
        outletId: "outlet-1",
        tableId: "t-1",
        table: { number: "2" },
        items: [
          { kotId: "kot-1", status: "ready" },
          { kotId: "kot-2", status: "ready" },
        ],
      },
    });
    prisma.orderItem.findMany.mockResolvedValue([
      { id: "oi-1", kotId: "kot-1", status: "ready" },
      { id: "oi-2", kotId: "kot-2", status: "ready" },
    ]);
    prisma.outlet.findUnique.mockResolvedValue({
      brand: { organizationId: "org-1" },
    });

    await service.markReady("kot-2", { userId: "user-1", authMode: "email" });

    expect(prisma.kOT.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ready" }) }),
    );
    expect(events.emitOrderUpdate).toHaveBeenCalledWith(
      "outlet-1",
      expect.objectContaining({ type: "kot_ready", orderStatus: "ready" }),
    );
  });
});
