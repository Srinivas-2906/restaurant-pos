import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OutletsService {
  constructor(private prisma: PrismaService) {}

  findByBrand(brandId: string) {
    return this.prisma.outlet.findMany({
      where: { brandId, isActive: true },
      include: { terminals: true, kitchenStations: true },
    });
  }

  findOne(id: string) {
    return this.prisma.outlet.findUniqueOrThrow({
      where: { id },
      include: {
        terminals: true,
        kitchenStations: true,
        floorPlans: { include: { tables: true } },
        brand: true,
      },
    });
  }

  create(data: {
    brandId: string;
    name: string;
    code: string;
    type: string;
    address?: string;
    city?: string;
    state?: string;
    gstin?: string;
    zone?: string;
  }) {
    return this.prisma.outlet.create({ data: data as never });
  }

  getFloorPlan(outletId: string) {
    return this.prisma.floorPlan.findFirst({
      where: { outletId, isDefault: true },
      include: { tables: { orderBy: { number: "asc" } } },
    });
  }

  updateTableStatus(tableId: string, status: string) {
    return this.prisma.table.update({
      where: { id: tableId },
      data: { status: status as never },
    });
  }

  createTerminal(outletId: string, data: { name: string; code: string; isMaster?: boolean }) {
    return this.prisma.terminal.create({
      data: { outletId, ...data },
    });
  }
}
