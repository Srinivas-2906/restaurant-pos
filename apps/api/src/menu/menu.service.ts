import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  async getOutletMenu(outletId: string) {
    const outlet = await this.prisma.outlet.findUniqueOrThrow({
      where: { id: outletId },
      include: { brand: { include: { menus: { include: {
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: {
            items: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              include: { variants: true, taxRule: true, overrides: { where: { outletId } } },
            },
          },
        },
      } } } } },
    });

    return outlet.brand.menus.map((menu) => ({
      ...menu,
      categories: menu.categories.map((cat) => ({
        ...cat,
        items: cat.items.map((item) => {
          const override = item.overrides[0];
          return {
            ...item,
            price: override?.price ?? item.basePrice,
            isAvailable: override?.isAvailable ?? true,
            overrides: undefined,
          };
        }),
      })),
    }));
  }

  createCategory(menuId: string, data: { name: string; nameHi?: string; sortOrder?: number }) {
    return this.prisma.category.create({ data: { menuId, ...data } });
  }

  createItem(data: {
    categoryId: string; name: string; nameHi?: string; basePrice: number;
    kitchenStationId?: string; taxRuleId?: string; isVeg?: boolean; hsnCode?: string;
  }) {
    return this.prisma.menuItem.create({ data });
  }

  updateAvailability(outletId: string, menuItemId: string, isAvailable: boolean) {
    return this.prisma.outletMenuOverride.upsert({
      where: { outletId_menuItemId: { outletId, menuItemId } },
      update: { isAvailable },
      create: { outletId, menuItemId, isAvailable },
    });
  }

  createTaxRule(data: { name: string; cgstRate: number; sgstRate: number }) {
    return this.prisma.taxRule.create({
      data: { name: data.name, type: "cgst_sgst", cgstRate: data.cgstRate, sgstRate: data.sgstRate },
    });
  }
}
