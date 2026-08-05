import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from "@nestjs/common";
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
  @ApiOperation({ summary: "List ingredients with supplier and stock levels" })
  getIngredients(@Param("outletId") outletId: string) {
    return this.inventoryService.getIngredients(outletId);
  }

  @Post("outlets/:outletId/ingredients")
  @Roles("inventory_manager", "manager", "owner")
  createIngredient(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createIngredient(outletId, body as never);
  }

  @Patch("ingredients/:id")
  @Roles("inventory_manager", "manager", "owner")
  updateIngredient(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.updateIngredient(id, body);
  }

  @Get("outlets/:outletId/stock-summary")
  @Roles("inventory_manager", "manager", "owner", "super_admin")
  stockSummary(@Param("outletId") outletId: string) {
    return this.inventoryService.getStockSummary(outletId);
  }

  @Get("outlets/:outletId/stock-ledger")
  @Roles("inventory_manager", "manager", "owner", "super_admin")
  stockLedger(@Param("outletId") outletId: string, @Query("limit") limit?: string) {
    return this.inventoryService.getStockLedger(outletId, limit ? Number(limit) : 100);
  }

  @Post("outlets/:outletId/stock-adjustments")
  @Roles("inventory_manager", "manager", "owner")
  stockAdjustment(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createStockAdjustment(outletId, body as never);
  }

  @Get("outlets/:outletId/stock-closings")
  @Roles("inventory_manager", "manager", "owner")
  stockClosings(@Param("outletId") outletId: string, @Query("month") month?: string) {
    return this.inventoryService.getStockClosings(outletId, month);
  }

  @Post("outlets/:outletId/stock-closings")
  @Roles("inventory_manager", "manager", "owner")
  createStockClosing(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createStockClosing(outletId, body as never);
  }

  @Get("outlets/:outletId/categories")
  @Roles("inventory_manager", "manager", "owner")
  categories(@Param("outletId") outletId: string) {
    return this.inventoryService.getCategories(outletId);
  }

  @Post("outlets/:outletId/categories")
  @Roles("inventory_manager", "manager", "owner")
  createCategory(@Param("outletId") outletId: string, @Body() body: { name: string; sortOrder?: number }) {
    return this.inventoryService.createCategory(outletId, body.name, body.sortOrder);
  }

  @Post("outlets/:outletId/wastage")
  @Roles("inventory_manager", "manager")
  recordWastage(@Param("outletId") outletId: string, @Body() body: { ingredientId: string; quantity: number; notes?: string }) {
    return this.inventoryService.recordWastage(outletId, body.ingredientId, body.quantity, body.notes);
  }

  @Get("outlets/:outletId/purchase-orders")
  @Roles("inventory_manager", "manager", "owner")
  listPOs(@Param("outletId") outletId: string) {
    return this.inventoryService.listPurchaseOrders(outletId);
  }

  @Post("outlets/:outletId/purchase-orders")
  @Roles("inventory_manager", "manager")
  createPO(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createPurchaseOrder(outletId, body as never);
  }

  @Post("purchase-orders/:poId/receive")
  @Roles("inventory_manager", "manager")
  receivePO(@Param("poId") poId: string) {
    return this.inventoryService.receivePO(poId);
  }

  @Get("outlets/:outletId/recipes")
  @Roles("inventory_manager", "manager", "owner", "chef")
  getRecipes(@Param("outletId") outletId: string) {
    return this.inventoryService.getRecipes(outletId);
  }

  @Post("ck/transfers")
  @Roles("inventory_manager", "manager", "owner")
  createTransfer(@Body() body: { fromOutletId: string; toOutletId: string; items: unknown[]; notes?: string }) {
    return this.inventoryService.createCKTransfer(body.fromOutletId, body.toOutletId, body.items, body.notes);
  }

  @Get("outlets/:outletId/transfers")
  @Roles("inventory_manager", "manager", "owner")
  listTransfers(@Param("outletId") outletId: string) {
    return this.inventoryService.listTransfers(outletId);
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

  @Patch("suppliers/:id")
  @Roles("inventory_manager", "manager", "owner")
  updateSupplier(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.updateSupplier(id, body);
  }
}
