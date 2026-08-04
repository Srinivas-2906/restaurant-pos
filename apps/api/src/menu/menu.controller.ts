import { Controller, Get, Post, Patch, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { MenuService } from "./menu.service";
import { JwtAuthGuard } from "../auth/guards";

@ApiTags("menu")
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MenuController {
  constructor(private menuService: MenuService) {}

  @Get("outlets/:outletId/menu")
  getMenu(@Param("outletId") outletId: string) {
    return this.menuService.getOutletMenu(outletId);
  }

  @Patch("outlets/:outletId/items/:itemId/availability")
  updateAvailability(
    @Param("outletId") outletId: string,
    @Param("itemId") itemId: string,
    @Body() body: { isAvailable: boolean },
  ) {
    return this.menuService.updateAvailability(outletId, itemId, body.isAvailable);
  }

  @Post("menus/:menuId/categories")
  createCategory(@Param("menuId") menuId: string, @Body() body: { name: string; nameHi?: string }) {
    return this.menuService.createCategory(menuId, body);
  }

  @Post("menu-items")
  createItem(@Body() body: Record<string, unknown>) {
    return this.menuService.createItem(body as never);
  }

  @Post("tax-rules")
  createTaxRule(@Body() body: { name: string; cgstRate: number; sgstRate: number }) {
    return this.menuService.createTaxRule(body);
  }
}
