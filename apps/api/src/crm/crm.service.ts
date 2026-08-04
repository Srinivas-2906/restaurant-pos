import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService) {}

  findByOutlet(outletId: string, search?: string) {
    return this.prisma.customer.findMany({
      where: {
        outletId,
        ...(search ? { OR: [{ phone: { contains: search } }, { name: { contains: search, mode: "insensitive" } }] } : {}),
      },
      include: { loyaltyAccount: true },
      orderBy: { totalSpent: "desc" },
      take: 50,
    });
  }

  findByPhone(outletId: string, phone: string) {
    return this.prisma.customer.findUnique({
      where: { outletId_phone: { outletId, phone } },
      include: {
        loyaltyAccount: { include: { history: { take: 10, orderBy: { createdAt: "desc" } } } },
        orders: { take: 5, orderBy: { createdAt: "desc" } },
      },
    });
  }

  async earnPoints(customerId: string, points: number, orderId?: string) {
    const account = await this.prisma.loyaltyAccount.upsert({
      where: { customerId },
      update: { points: { increment: points } },
      create: { customerId, points },
    });

    await this.prisma.loyaltyTransaction.create({
      data: { loyaltyAccountId: account.id, points, type: "earn", orderId, description: "Order purchase" },
    });

    return account;
  }

  async redeemPoints(customerId: string, points: number, orderId?: string) {
    const account = await this.prisma.loyaltyAccount.findUniqueOrThrow({ where: { customerId } });
    if (account.points < points) throw new Error("Insufficient loyalty points");

    const updated = await this.prisma.loyaltyAccount.update({
      where: { customerId },
      data: { points: { decrement: points } },
    });

    await this.prisma.loyaltyTransaction.create({
      data: { loyaltyAccountId: account.id, points: -points, type: "redeem", orderId, description: "Points redeemed" },
    });

    return updated;
  }

  updateCustomer(id: string, data: { name?: string; email?: string; tags?: string[]; notes?: string }) {
    return this.prisma.customer.update({ where: { id }, data });
  }
}
