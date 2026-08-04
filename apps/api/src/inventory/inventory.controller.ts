import { Controller, Get, Post, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { InventoryService } from "./inventory.service";
import { JwtAuthGuard, Roles } from "../auth/guards";

@ApiTags("inventory")
@Controller("inventory")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get("outlets/:outletId/ingredients")
  @Roles("inventory_manager", "manager", "owner", "super_admin")
  @ApiOperation({ summary: "I1 Stock overview — list ingredients with supplier and stock levels" })
  getIngredients(@Param("outletId") outletId: string) {
    return this.inventoryService.getIngredients(outletId);
  }

  @Post("outlets/:outletId/ingredients")
  @Roles("inventory_manager", "manager", "owner")
  @ApiOperation({ summary: "Create a new ingredient" })
  createIngredient(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createIngredient(outletId, body as never);
  }

  @Post("outlets/:outletId/wastage")
  @Roles("inventory_manager", "manager")
  @ApiOperation({ summary: "I3 Log wastage and deduct stock" })
  recordWastage(@Param("outletId") outletId: string, @Body() body: { ingredientId: string; quantity: number; notes?: string }) {
    return this.inventoryService.recordWastage(outletId, body.ingredientId, body.quantity, body.notes);
  }

  @Get("outlets/:outletId/purchase-orders")
  @Roles("inventory_manager", "manager", "owner")
  @ApiOperation({ summary: "List purchase orders for outlet" })
  listPOs(@Param("outletId") outletId: string) {
    return this.inventoryService.listPurchaseOrders(outletId);
  }

  @Post("outlets/:outletId/purchase-orders")
  @Roles("inventory_manager", "manager")
  @ApiOperation({ summary: "I4 Create purchase order draft" })
  createPO(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createPurchaseOrder(outletId, body as never);
  }

  @Post("purchase-orders/:poId/receive")
  @Roles("inventory_manager", "manager")
  @ApiOperation({ summary: "I2 Receive PO (GRN) and update stock" })
  receivePO(@Param("poId") poId: string) {
    return this.inventoryService.receivePO(poId);
  }

  @Get("outlets/:outletId/recipes")
  @Roles("inventory_manager", "manager", "owner", "chef")
  @ApiOperation({ summary: "I5 Recipe view — dish to ingredients" })
  getRecipes(@Param("outletId") outletId: string) {
    return this.inventoryService.getRecipes(outletId);
  }

  @Post("ck/transfers")
  @Roles("inventory_manager", "manager", "owner")
  createTransfer(@Body() body: { fromOutletId: string; toOutletId: string; items: unknown[]; notes?: string }) {
    return this.inventoryService.createCKTransfer(body.fromOutletId, body.toOutletId, body.items, body.notes);
  }

  @Get("outlets/:outletId/suppliers")
  @Roles("inventory_manager", "manager", "owner")
  getSuppliers(@Param("outletId") outletId: string) {
    return this.inventoryService.getSuppliers(outletId);
  }

  @Post("outlets/:outletId/suppliers")
  @Roles("inventory_manager", "manager", "owner")
  createSupplier(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createSupplier(outletId, body as never);
  }
}
