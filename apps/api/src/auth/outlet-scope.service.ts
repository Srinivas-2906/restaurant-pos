import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface ScopedAuthUser {
  userId: string;
  organizationId: string;
  outletId?: string;
  role?: string;
  roles?: string[];
  authMode?: "email" | "operational";
  staffProfileId?: string;
  terminalId?: string;
  displayName?: string;
  permissions?: string[];
}

@Injectable()
export class OutletScopeService {
  constructor(private prisma: PrismaService) {}

  async assertOutletInOrganization(outletId: string, organizationId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, brand: { organizationId } },
      select: { id: true, name: true },
    });
    if (!outlet) {
      throw new ForbiddenException("Outlet not in your organization");
    }
    return outlet;
  }

  async assertUserOutletAccess(user: ScopedAuthUser, outletId: string) {
    await this.assertOutletInOrganization(outletId, user.organizationId);

    if (user.role === "owner" || user.role === "super_admin") {
      return;
    }

    if (user.authMode === "operational") {
      if (user.outletId && user.outletId !== outletId) {
        throw new ForbiddenException("Terminal is bound to a different outlet");
      }
      return;
    }

    const roleNames = [...new Set([user.role, ...(user.roles ?? [])].filter(Boolean))] as string[];
    const hasUserAssignment = await this.prisma.roleAssignment.findFirst({
      where: {
        userId: user.userId,
        organizationId: user.organizationId,
        OR: [{ outletId }, { outletId: null }],
      },
    });

    if (hasUserAssignment) return;

    if (user.staffProfileId) {
      const staffAssignment = await this.prisma.staffRoleAssignment.findFirst({
        where: {
          staffProfileId: user.staffProfileId,
          outletId,
          organizationId: user.organizationId,
        },
      });
      if (staffAssignment) return;
    }

    if (roleNames.includes("owner") || roleNames.includes("super_admin")) {
      return;
    }

    throw new ForbiddenException("No access to this outlet");
  }

  async assertOrderInOrganization(orderId: string, organizationId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, outlet: { brand: { organizationId } } },
      select: { id: true, outletId: true },
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  async assertKotInOrganization(kotId: string, organizationId: string) {
    const kot = await this.prisma.kOT.findFirst({
      where: { id: kotId, order: { outlet: { brand: { organizationId } } } },
      select: { id: true, order: { select: { outletId: true } } },
    });
    if (!kot) {
      throw new NotFoundException("KOT not found");
    }
    return kot;
  }

  async assertStationInOrganization(stationId: string, organizationId: string) {
    const station = await this.prisma.kitchenStation.findFirst({
      where: { id: stationId, outlet: { brand: { organizationId } } },
      select: { id: true, outletId: true },
    });
    if (!station) {
      throw new NotFoundException("Kitchen station not found");
    }
    return station;
  }

  async assertIngredientInOrganization(ingredientId: string, organizationId: string) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id: ingredientId, outlet: { brand: { organizationId } } },
      select: { id: true, outletId: true },
    });
    if (!ingredient) {
      throw new NotFoundException("Ingredient not found");
    }
    return ingredient;
  }

  async assertPurchaseOrderInOrganization(poId: string, organizationId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: poId, outlet: { brand: { organizationId } } },
      select: { id: true, outletId: true },
    });
    if (!po) {
      throw new NotFoundException("Purchase order not found");
    }
    return po;
  }

  async assertTransferInOrganization(transferId: string, organizationId: string) {
    const transfer = await this.prisma.centralKitchenTransfer.findFirst({
      where: {
        id: transferId,
        OR: [
          { fromOutlet: { brand: { organizationId } } },
          { toOutlet: { brand: { organizationId } } },
        ],
      },
      select: { id: true, fromOutletId: true, toOutletId: true },
    });
    if (!transfer) {
      throw new NotFoundException("Transfer not found");
    }
    return transfer;
  }

  async assertStockCountInOrganization(countId: string, organizationId: string) {
    const count = await this.prisma.stockCount.findFirst({
      where: { id: countId, outlet: { brand: { organizationId } } },
      select: { id: true, outletId: true },
    });
    if (!count) {
      throw new NotFoundException("Stock count not found");
    }
    return count;
  }

  async assertSupplierInOrganization(supplierId: string, organizationId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, outlet: { brand: { organizationId } } },
      select: { id: true, outletId: true },
    });
    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }
    return supplier;
  }
}
