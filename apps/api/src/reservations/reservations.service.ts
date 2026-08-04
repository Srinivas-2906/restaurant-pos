import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReservationsService {
  constructor(private prisma: PrismaService) {}

  findByOutlet(outletId: string, date?: string) {
    const start = date ? new Date(date) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    return this.prisma.reservation.findMany({
      where: { outletId, date: { gte: start, lte: end } },
      include: { table: true, customer: true },
      orderBy: { date: "asc" },
    });
  }

  create(data: {
    outletId: string; guestName: string; guestPhone: string; guestCount: number;
    date: string; source?: string; notes?: string;
  }) {
    return this.prisma.reservation.create({
      data: {
        outletId: data.outletId,
        guestName: data.guestName,
        guestPhone: data.guestPhone,
        guestCount: data.guestCount,
        date: new Date(data.date),
        source: (data.source ?? "walk_in") as never,
        notes: data.notes,
        status: "confirmed",
      },
    });
  }

  async seat(id: string, tableId: string) {
    const reservation = await this.prisma.reservation.update({
      where: { id },
      data: { status: "seated", tableId },
    });

    await this.prisma.table.update({
      where: { id: tableId },
      data: { status: "reserved" },
    });

    return reservation;
  }

  cancel(id: string) {
    return this.prisma.reservation.update({
      where: { id },
      data: { status: "cancelled" },
    });
  }
}
