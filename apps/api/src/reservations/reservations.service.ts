import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import type { CreateReservationDto, UpdateReservationDto } from "@kaana/shared-types";
import { OrdersService } from "../orders/orders.service";

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
  ) {}

  private emitUpdate(outletId: string, data: unknown) {
    this.events.emitReservationUpdate(outletId, data);
  }

  private async resolveCustomer(outletId: string, phone: string, name: string) {
    const existing = await this.prisma.customer.findUnique({
      where: { outletId_phone: { outletId, phone } },
    });
    if (existing) return existing.id;
    const created = await this.prisma.customer.create({
      data: { outletId, phone, name },
    });
    return created.id;
  }

  private async freeTableIfReserved(tableId: string | null | undefined) {
    if (!tableId) return;
    const table = await this.prisma.table.findUnique({ where: { id: tableId } });
    if (table?.status === "reserved") {
      await this.prisma.table.update({ where: { id: tableId }, data: { status: "free" } });
    }
  }

  async findByOutlet(outletId: string, opts?: { date?: string; status?: string; from?: string; to?: string }) {
    const where: Record<string, unknown> = { outletId };

    if (opts?.status) {
      where.status = opts.status;
    }

    if (opts?.from || opts?.to) {
      where.date = {
        ...(opts.from ? { gte: new Date(opts.from) } : {}),
        ...(opts.to ? { lte: new Date(opts.to) } : {}),
      };
    } else if (opts?.date) {
      const match = opts.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const y = Number(match[1]);
        const m = Number(match[2]);
        const d = Number(match[3]);
        const start = new Date(y, m - 1, d, 0, 0, 0, 0);
        const end = new Date(y, m - 1, d, 23, 59, 59, 999);
        where.date = { gte: start, lte: end };
      }
    }

    const rows = await this.prisma.reservation.findMany({
      where: where as never,
      include: { table: true, customer: true, order: true },
      orderBy: { date: "asc" },
    });

    return rows;
  }

  findOne(id: string) {
    return this.prisma.reservation.findUniqueOrThrow({
      where: { id },
      include: { table: true, customer: true, order: true },
    });
  }

  async create(data: CreateReservationDto) {
    const customerId = await this.resolveCustomer(data.outletId, data.guestPhone, data.guestName);

    const reservation = await this.prisma.reservation.create({
      data: {
        outletId: data.outletId,
        customerId,
        guestName: data.guestName,
        guestPhone: data.guestPhone,
        guestCount: data.guestCount,
        date: new Date(data.date),
        source: (data.source ?? "walk_in") as never,
        notes: data.notes,
        occasion: data.occasion,
        specialRequest: data.specialRequest,
        preferredArea: data.preferredArea,
        advancePayment: data.advancePayment,
        tableId: data.tableId,
        status: "confirmed",
      },
      include: { table: true, customer: true },
    });

    if (data.tableId) {
      await this.prisma.table.update({
        where: { id: data.tableId },
        data: { status: "reserved" },
      });
    }

    this.emitUpdate(data.outletId, reservation);
    return reservation;
  }

  async update(id: string, data: UpdateReservationDto) {
    const existing = await this.prisma.reservation.findUniqueOrThrow({ where: { id } });
    if (["completed", "cancelled", "no_show"].includes(existing.status)) {
      throw new BadRequestException("Cannot edit reservation in current status");
    }

    const reservation = await this.prisma.reservation.update({
      where: { id },
      data: {
        guestName: data.guestName,
        guestPhone: data.guestPhone,
        guestCount: data.guestCount,
        date: data.date ? new Date(data.date) : undefined,
        source: data.source as never,
        notes: data.notes,
        occasion: data.occasion,
        specialRequest: data.specialRequest,
        preferredArea: data.preferredArea,
        advancePayment: data.advancePayment,
      },
      include: { table: true, customer: true, order: true },
    });

    this.emitUpdate(existing.outletId, reservation);
    return reservation;
  }

  async checkIn(id: string) {
    const existing = await this.prisma.reservation.findUniqueOrThrow({ where: { id } });
    if (existing.status !== "confirmed") {
      throw new BadRequestException("Only confirmed reservations can be checked in");
    }

    const reservation = await this.prisma.reservation.update({
      where: { id },
      data: { status: "arrived", arrivedAt: new Date() },
      include: { table: true, customer: true, order: true },
    });

    this.emitUpdate(existing.outletId, reservation);
    return reservation;
  }

  async assignTable(id: string, tableId: string) {
    const existing = await this.prisma.reservation.findUniqueOrThrow({ where: { id } });
    if (["completed", "cancelled", "no_show"].includes(existing.status)) {
      throw new BadRequestException("Cannot assign table in current status");
    }

    const table = await this.prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    if (table.status !== "free" && table.status !== "reserved") {
      throw new BadRequestException("Table is not available");
    }

    if (existing.tableId && existing.tableId !== tableId) {
      await this.freeTableIfReserved(existing.tableId);
    }

    const reservation = await this.prisma.reservation.update({
      where: { id },
      data: { tableId },
      include: { table: true, customer: true, order: true },
    });

    await this.prisma.table.update({ where: { id: tableId }, data: { status: "reserved" } });

    this.emitUpdate(existing.outletId, reservation);
    return reservation;
  }

  /** @deprecated use assignTable + openOrder */
  async seat(id: string, tableId: string) {
    await this.assignTable(id, tableId);
    return this.openOrder(id, {});
  }

  async openOrder(id: string, data: { terminalId?: string; createdById?: string }) {
    const existing = await this.prisma.reservation.findUniqueOrThrow({
      where: { id },
      include: { order: true },
    });

    if (existing.order) {
      return { reservation: existing, order: existing.order };
    }

    if (!["confirmed", "arrived", "seated"].includes(existing.status)) {
      throw new BadRequestException("Cannot open order for reservation in current status");
    }

    if (!existing.tableId) {
      throw new BadRequestException("Assign a table before opening order");
    }

    const order = await this.ordersService.createFromReservation({
      outletId: existing.outletId,
      tableId: existing.tableId,
      customerId: existing.customerId ?? undefined,
      reservationId: existing.id,
      guestCount: existing.guestCount,
      notes: existing.specialRequest ?? existing.notes ?? undefined,
      terminalId: data.terminalId,
      createdById: data.createdById,
    });

    const reservation = await this.prisma.reservation.update({
      where: { id },
      data: { status: "seated", seatedAt: new Date() },
      include: { table: true, customer: true, order: true },
    });

    this.emitUpdate(existing.outletId, reservation);
    return { reservation, order };
  }

  async complete(id: string) {
    const existing = await this.prisma.reservation.findUniqueOrThrow({ where: { id } });
    const reservation = await this.prisma.reservation.update({
      where: { id },
      data: { status: "completed" },
      include: { table: true, customer: true, order: true },
    });
    this.emitUpdate(existing.outletId, reservation);
    return reservation;
  }

  async cancel(id: string) {
    const existing = await this.prisma.reservation.findUniqueOrThrow({ where: { id } });
    if (existing.status === "cancelled") return existing;

    await this.freeTableIfReserved(existing.tableId);

    const reservation = await this.prisma.reservation.update({
      where: { id },
      data: { status: "cancelled" },
      include: { table: true, customer: true, order: true },
    });

    this.emitUpdate(existing.outletId, reservation);
    return reservation;
  }

  async markNoShow(id: string) {
    const existing = await this.prisma.reservation.findUniqueOrThrow({ where: { id } });
    await this.freeTableIfReserved(existing.tableId);

    const reservation = await this.prisma.reservation.update({
      where: { id },
      data: { status: "no_show" },
      include: { table: true, customer: true, order: true },
    });

    this.emitUpdate(existing.outletId, reservation);
    return reservation;
  }

  async createPublic(outletCode: string, data: {
    guestName: string; guestPhone: string; guestCount: number; date: string;
    occasion?: string; specialRequest?: string;
  }) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { OR: [{ code: outletCode }, { id: outletCode }], isActive: true },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    return this.create({
      outletId: outlet.id,
      guestName: data.guestName,
      guestPhone: data.guestPhone,
      guestCount: data.guestCount,
      date: data.date,
      source: "website",
      occasion: data.occasion,
      specialRequest: data.specialRequest,
    });
  }

  async getPublicOutlet(outletCode: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { OR: [{ code: outletCode }, { id: outletCode }], isActive: true },
      select: { id: true, name: true, code: true, city: true, phone: true, settings: true },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");
    return outlet;
  }
}
