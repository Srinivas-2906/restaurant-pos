import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { ReservationsService } from "../reservations/reservations.service";
import type { CreateWaitlistEntryDto } from "@kaana/shared-types";

@Injectable()
export class WaitlistService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
    private reservationsService: ReservationsService,
  ) {}

  private emitUpdate(outletId: string, data: unknown) {
    this.events.emitWaitlistUpdate(outletId, data);
  }

  async findByOutlet(outletId: string) {
    return this.prisma.waitlistEntry.findMany({
      where: { outletId, status: { in: ["waiting", "notified"] } },
      include: { reservation: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }

  async create(data: CreateWaitlistEntryDto) {
    const maxPos = await this.prisma.waitlistEntry.aggregate({
      where: { outletId: data.outletId, status: { in: ["waiting", "notified"] } },
      _max: { position: true },
    });

    const entry = await this.prisma.waitlistEntry.create({
      data: {
        outletId: data.outletId,
        guestName: data.guestName,
        guestPhone: data.guestPhone,
        guestCount: data.guestCount,
        quotedWaitMins: data.quotedWaitMins,
        notes: data.notes,
        position: (maxPos._max.position ?? -1) + 1,
      },
    });

    this.emitUpdate(data.outletId, entry);
    return entry;
  }

  async notify(id: string) {
    const entry = await this.prisma.waitlistEntry.update({
      where: { id },
      data: { status: "notified", notifiedAt: new Date() },
    });
    this.emitUpdate(entry.outletId, entry);
    return entry;
  }

  async promote(id: string, date?: string) {
    const entry = await this.prisma.waitlistEntry.findUniqueOrThrow({ where: { id } });
    if (entry.status === "cancelled" || entry.status === "seated") {
      throw new BadRequestException("Entry is no longer in queue");
    }

    const reservation = await this.reservationsService.create({
      outletId: entry.outletId,
      guestName: entry.guestName,
      guestPhone: entry.guestPhone,
      guestCount: entry.guestCount,
      date: date ?? new Date().toISOString(),
      source: "walk_in",
      notes: entry.notes ?? undefined,
    });

    const updated = await this.prisma.waitlistEntry.update({
      where: { id },
      data: { status: "seated", reservationId: reservation.id },
      include: { reservation: true },
    });

    this.emitUpdate(entry.outletId, updated);
    return { entry: updated, reservation };
  }

  async cancel(id: string) {
    const entry = await this.prisma.waitlistEntry.update({
      where: { id },
      data: { status: "cancelled" },
    });
    this.emitUpdate(entry.outletId, entry);
    return entry;
  }

  async reorder(outletId: string, orderedIds: string[]) {
    await Promise.all(
      orderedIds.map((id, index) =>
        this.prisma.waitlistEntry.update({ where: { id, outletId }, data: { position: index } }),
      ),
    );

    const entries = await this.findByOutlet(outletId);
    this.emitUpdate(outletId, entries);
    return entries;
  }
}
