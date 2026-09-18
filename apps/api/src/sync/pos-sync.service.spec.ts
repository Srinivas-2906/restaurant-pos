import { Test, TestingModule } from "@nestjs/testing";
import { PosSyncService } from "./pos-sync.service";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";

describe("PosSyncService", () => {
  let service: PosSyncService;
  const prisma = {
    posSyncCommand: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
    },
  };
  const orders = {
    createWithOfflineProvenance: jest.fn(),
    addItemFromSnapshot: jest.fn(),
    fireKOT: jest.fn(),
    settle: jest.fn(),
    cancelOrder: jest.fn(),
    updateItemQuantity: jest.fn(),
    removeItem: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrdersService, useValue: orders },
      ],
    }).compile();
    service = module.get(PosSyncService);
  });

  it("returns acked for duplicate idempotency key", async () => {
    prisma.posSyncCommand.findUnique.mockResolvedValue({
      status: "acked",
      serverEntityId: "server-order-1",
      result: { cloudMappings: { local1: "server-order-1" } },
    });

    const res = await service.ingestBatch({
      outletId: "outlet-1",
      deviceId: "device-1",
      terminalId: "term-1",
      commands: [
        {
          id: "cmd-1",
          idempotencyKey: "create:local1",
          outletId: "outlet-1",
          deviceId: "device-1",
          terminalId: "term-1",
          staffProfileId: "staff-1",
          employeeCode: "EMP001",
          operationType: "CREATE_ORDER",
          aggregateId: "local1",
          localEntityId: "local1",
          payload: { clientOrderId: "local1", type: "takeaway" },
          occurredAt: new Date().toISOString(),
          sequence: 1,
        },
      ],
    });

    expect(res.results[0]?.status).toBe("acked");
    expect(res.results[0]?.serverEntityId).toBe("server-order-1");
    expect(orders.createWithOfflineProvenance).not.toHaveBeenCalled();
  });

  it("creates order on first CREATE_ORDER", async () => {
    prisma.posSyncCommand.findUnique.mockResolvedValue(null);
    prisma.order.findFirst.mockResolvedValue(null);
    orders.createWithOfflineProvenance.mockResolvedValue({ id: "server-order-2" });
    prisma.posSyncCommand.upsert.mockResolvedValue({});

    const res = await service.ingestBatch({
      outletId: "outlet-1",
      deviceId: "device-1",
      terminalId: "term-1",
      commands: [
        {
          id: "cmd-2",
          idempotencyKey: "create:local2",
          outletId: "outlet-1",
          deviceId: "device-1",
          terminalId: "term-1",
          staffProfileId: "staff-1",
          employeeCode: "EMP001",
          operationType: "CREATE_ORDER",
          aggregateId: "local2",
          localEntityId: "local2",
          payload: { clientOrderId: "local2", type: "takeaway" },
          occurredAt: new Date().toISOString(),
          sequence: 1,
        },
      ],
    });

    expect(orders.createWithOfflineProvenance).toHaveBeenCalled();
    expect(res.results[0]?.status).toBe("acked");
  });

  it("returns table conflict without creating order", async () => {
    prisma.posSyncCommand.findUnique.mockResolvedValue(null);
    prisma.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing", orderNumber: "ORD-00001", table: { number: "2" } });

    const res = await service.ingestBatch({
      outletId: "outlet-1",
      deviceId: "device-1",
      terminalId: "term-1",
      commands: [
        {
          id: "cmd-3",
          idempotencyKey: "create:local3",
          outletId: "outlet-1",
          deviceId: "device-1",
          terminalId: "term-1",
          staffProfileId: "staff-1",
          employeeCode: "EMP001",
          operationType: "CREATE_ORDER",
          aggregateId: "local3",
          localEntityId: "local3",
          payload: { clientOrderId: "local3", type: "dine_in", tableId: "table-2" },
          occurredAt: new Date().toISOString(),
          sequence: 1,
        },
      ],
    });

    expect(res.results[0]?.status).toBe("conflict");
    expect(res.results[0]?.conflict?.code).toBe("TABLE_OCCUPIED");
    expect(orders.createWithOfflineProvenance).not.toHaveBeenCalled();
  });
});
