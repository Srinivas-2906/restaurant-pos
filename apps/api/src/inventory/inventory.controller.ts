import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, ForbiddenException } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { InventoryService } from "./inventory.service";
import { JwtAuthGuard, Roles } from "../auth/guards";
import { CapabilityGuard, RequireFeature, RequireModule } from "../capabilities/capability.guard";
import { OutletScopeService, type ScopedAuthUser } from "../auth/outlet-scope.service";

/** Management roles allowed to mutate inventory (operational JWT excluded). */
const INV_MUTATE = ["inventory_manager", "manager", "owner"] as const;
const INV_READ = [...INV_MUTATE, "super_admin", "accountant"] as const;
const INV_OPS_READ = [...INV_READ, "biller", "chef"] as const;

function assertInventoryMutation(user: ScopedAuthUser) {
  if (user.authMode === "operational") {
    throw new ForbiddenException("Inventory write operations require management login");
  }
}

@ApiTags("inventory")
@Controller("inventory")
@UseGuards(JwtAuthGuard, CapabilityGuard)
@RequireModule("inventory")
@ApiBearerAuth()
export class InventoryController {
  constructor(
    private inventoryService: InventoryService,
    private outletScope: OutletScopeService,
  ) {}

  // ─── Items (Inventory Items) ───────────────────────────────────────────────

  @Get("outlets/:outletId/items")
  @Roles(...INV_OPS_READ)
  @ApiOperation({ summary: "List inventory items" })
  async getItems(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.getItems(outletId);
  }

  @Get("outlets/:outletId/ingredients")
  @Roles(...INV_OPS_READ)
  async getIngredients(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.getIngredients(outletId);
  }

  @Post("outlets/:outletId/items")
  @Roles(...INV_MUTATE)
  createItem(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.createIngredient(req, outletId, body);
  }

  @Post("outlets/:outletId/ingredients")
  @Roles(...INV_MUTATE)
  async createIngredient(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.createIngredient(outletId, body);
  }

  @Patch("items/:id")
  @Roles(...INV_MUTATE)
  async updateItem(
    @Request() req: { user: ScopedAuthUser },
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.updateIngredient(req, id, body);
  }

  @Patch("ingredients/:id")
  @Roles(...INV_MUTATE)
  async updateIngredient(
    @Request() req: { user: ScopedAuthUser },
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const ing = await this.outletScope.assertIngredientInOrganization(id, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, ing.outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.updateIngredient(id, body);
  }

  @Post("outlets/:outletId/opening-stock")
  @Roles(...INV_MUTATE)
  async openingStock(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.recordOpeningStock(outletId, {
      ...(body as object),
      createdById: req.user.userId,
    } as never);
  }

  // ─── Dashboard & Ledger ──────────────────────────────────────────────────────

  @Get("outlets/:outletId/dashboard")
  @Roles(...INV_OPS_READ)
  async dashboard(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.getDashboard(outletId);
  }

  @Get("outlets/:outletId/stock-summary")
  @Roles(...INV_OPS_READ)
  async stockSummary(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.getStockSummary(outletId);
  }

  @Get("outlets/:outletId/stock-ledger")
  @Roles(...INV_OPS_READ)
  async stockLedger(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Query("limit") limit?: string,
    @Query("type") type?: string,
    @Query("ingredientId") ingredientId?: string,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.getStockLedger(outletId, limit ? Number(limit) : 100, { type, ingredientId });
  }

  @Get("outlets/:outletId/reconcile")
  @Roles(...INV_MUTATE, "super_admin")
  @ApiOperation({ summary: "Diagnostic ledger vs on-hand reconciliation" })
  async reconcile(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.reconcileOutletStock(outletId);
  }

  @Get("outlets/:outletId/recipe-validation")
  @Roles(...INV_MUTATE, "super_admin")
  async recipeValidation(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.validateRecipeIntegrity(outletId);
  }

  @Post("outlets/:outletId/stock-adjustments")
  @Roles(...INV_MUTATE)
  async stockAdjustment(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.createStockAdjustment(outletId, {
      ...(body as object),
      createdById: req.user.userId,
    } as never);
  }

  @Get("outlets/:outletId/menu-availability")
  @Roles(...INV_OPS_READ)
  async menuAvailability(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.getMenuAvailability(outletId);
  }

  // ─── Stock Closing ───────────────────────────────────────────────────────────

  @Get("outlets/:outletId/stock-closings")
  @Roles(...INV_MUTATE, "accountant")
  async stockClosings(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Query("month") month?: string,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.getStockClosings(outletId, month);
  }

  @Post("outlets/:outletId/stock-closings")
  @Roles(...INV_MUTATE)
  async createStockClosing(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.createStockClosing(outletId, {
      ...(body as object),
      closedById: req.user.userId,
    } as never);
  }

  // ─── Categories ─────────────────────────────────────────────────────────────

  @Get("outlets/:outletId/categories")
  @Roles(...INV_OPS_READ)
  async categories(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.getCategories(outletId);
  }

  @Post("outlets/:outletId/categories")
  @Roles(...INV_MUTATE)
  async createCategory(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: { name: string; sortOrder?: number },
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.createCategory(outletId, body.name, body.sortOrder);
  }

  // ─── Wastage ─────────────────────────────────────────────────────────────────

  @Post("outlets/:outletId/wastage")
  @Roles(...INV_MUTATE)
  async recordWastage(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.recordWastage(outletId, {
      ...(body as object),
      recordedById: req.user.userId,
    } as never);
  }

  @Get("outlets/:outletId/wastage")
  @Roles(...INV_MUTATE, "accountant")
  async listWastage(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.listWastage(outletId);
  }

  // ─── Purchase Orders & Receipts ──────────────────────────────────────────────

  @Get("outlets/:outletId/purchase-orders")
  @RequireFeature("procurement.purchase_orders")
  @Roles(...INV_MUTATE, "accountant")
  async listPOs(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.listPurchaseOrders(outletId);
  }

  @Post("outlets/:outletId/purchase-orders")
  @RequireFeature("procurement.purchase_orders")
  @Roles(...INV_MUTATE)
  async createPO(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.createPurchaseOrder(outletId, body as never);
  }

  @Post("purchase-orders/:poId/receive")
  @RequireFeature("procurement.purchase_orders")
  @Roles(...INV_MUTATE)
  async receivePO(
    @Request() req: { user: ScopedAuthUser },
    @Param("poId") poId: string,
    @Body() body?: {
      lines?: Array<{ poItemId: string; receivedQty: number; rejectedQty?: number; purchaseUnit?: string }>;
      idempotencyKey?: string;
    },
  ) {
    const po = await this.outletScope.assertPurchaseOrderInOrganization(poId, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, po.outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.receivePO(poId, body?.lines, {
      idempotencyKey: body?.idempotencyKey,
      createdById: req.user.userId,
    });
  }

  @Post("purchase-orders/:poId/send")
  @RequireFeature("procurement.purchase_orders")
  @Roles(...INV_MUTATE)
  async sendPO(@Request() req: { user: ScopedAuthUser }, @Param("poId") poId: string) {
    const po = await this.outletScope.assertPurchaseOrderInOrganization(poId, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, po.outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.sendPO(poId);
  }

  @Post("purchase-orders/:poId/cancel")
  @RequireFeature("procurement.purchase_orders")
  @Roles(...INV_MUTATE)
  async cancelPO(@Request() req: { user: ScopedAuthUser }, @Param("poId") poId: string) {
    const po = await this.outletScope.assertPurchaseOrderInOrganization(poId, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, po.outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.cancelPO(poId);
  }

  @Get("outlets/:outletId/goods-receipts")
  @RequireFeature("procurement.purchase_orders")
  @Roles(...INV_MUTATE, "accountant")
  async listGoodsReceipts(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.listGoodsReceipts(outletId);
  }

  // ─── Purchase Requests ───────────────────────────────────────────────────────

  @Get("outlets/:outletId/purchase-requests")
  @RequireFeature("procurement.purchase_orders")
  @Roles(...INV_MUTATE)
  async listPurchaseRequests(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.listPurchaseRequests(outletId);
  }

  @Post("outlets/:outletId/purchase-requests")
  @RequireFeature("procurement.purchase_orders")
  @Roles(...INV_MUTATE)
  async createPurchaseRequest(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.createPurchaseRequest(outletId, body as never);
  }

  // ─── Purchase Invoices & Returns ─────────────────────────────────────────────

  @Get("outlets/:outletId/purchase-invoices")
  @Roles(...INV_MUTATE, "accountant")
  async listPurchaseInvoices(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.listPurchaseInvoices(outletId);
  }

  @Post("outlets/:outletId/purchase-invoices")
  @Roles("inventory_manager", "manager", "accountant")
  async createPurchaseInvoice(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.createPurchaseInvoice(outletId, body);
  }

  @Get("outlets/:outletId/purchase-returns")
  @Roles(...INV_MUTATE)
  async listPurchaseReturns(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.listPurchaseReturns(outletId);
  }

  @Post("outlets/:outletId/purchase-returns")
  @Roles(...INV_MUTATE)
  async createPurchaseReturn(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.createPurchaseReturn(outletId, body as never);
  }

  // ─── Recipes ─────────────────────────────────────────────────────────────────

  @Get("outlets/:outletId/recipes")
  @Roles(...INV_MUTATE, "chef")
  async getRecipes(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.getRecipes(outletId);
  }

  @Post("outlets/:outletId/recipes")
  @Roles(...INV_MUTATE, "chef")
  async upsertRecipe(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.upsertRecipe(body as never);
  }

  // ─── Stock Count ─────────────────────────────────────────────────────────────

  @Get("outlets/:outletId/stock-counts")
  @Roles(...INV_MUTATE)
  async getStockCounts(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.getStockCounts(outletId);
  }

  @Post("outlets/:outletId/stock-counts")
  @Roles(...INV_MUTATE)
  async createStockCount(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.createStockCount(outletId, {
      ...(body as object),
      countedById: req.user.userId,
    } as never);
  }

  @Patch("stock-counts/:countId/lines/:lineId")
  @Roles(...INV_MUTATE)
  async updateStockCountLine(
    @Request() req: { user: ScopedAuthUser },
    @Param("countId") countId: string,
    @Param("lineId") lineId: string,
    @Body() body: { physicalStock: number; reason?: string },
  ) {
    const count = await this.outletScope.assertStockCountInOrganization(countId, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, count.outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.updateStockCountLine(countId, lineId, body.physicalStock, body.reason);
  }

  @Post("stock-counts/:countId/approve")
  @Roles("manager", "owner", "inventory_manager")
  async approveStockCount(
    @Request() req: { user: ScopedAuthUser },
    @Param("countId") countId: string,
    @Body() body: { approvedById?: string },
  ) {
    const count = await this.outletScope.assertStockCountInOrganization(countId, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, count.outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.approveStockCount(countId, body.approvedById ?? req.user.userId);
  }

  // ─── Transfers ───────────────────────────────────────────────────────────────

  @Post("ck/transfers")
  @RequireFeature("inventory.stock_transfer")
  @Roles(...INV_MUTATE)
  async createTransfer(
    @Request() req: { user: ScopedAuthUser },
    @Body() body: { fromOutletId: string; toOutletId: string; items: Array<{ ingredientId: string; quantity: number }>; notes?: string },
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, body.fromOutletId);
    await this.outletScope.assertUserOutletAccess(req.user, body.toOutletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.createCKTransfer(body.fromOutletId, body.toOutletId, body.items, body.notes);
  }

  @Get("outlets/:outletId/transfers")
  @Roles(...INV_MUTATE)
  async listTransfers(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.listTransfers(outletId);
  }

  @Post("transfers/:transferId/dispatch")
  @RequireFeature("inventory.stock_transfer")
  @Roles(...INV_MUTATE)
  async dispatchTransfer(@Request() req: { user: ScopedAuthUser }, @Param("transferId") transferId: string) {
    const transfer = await this.outletScope.assertTransferInOrganization(transferId, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, transfer.fromOutletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.dispatchTransfer(transferId);
  }

  @Post("transfers/:transferId/receive")
  @RequireFeature("inventory.stock_transfer")
  @Roles(...INV_MUTATE)
  async receiveTransfer(
    @Request() req: { user: ScopedAuthUser },
    @Param("transferId") transferId: string,
    @Body() body?: { lines?: Array<{ lineId: string; receivedQty: number }> },
  ) {
    const transfer = await this.outletScope.assertTransferInOrganization(transferId, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, transfer.toOutletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.receiveTransfer(transferId, body?.lines);
  }

  // ─── Production ──────────────────────────────────────────────────────────────

  @Get("outlets/:outletId/production-orders")
  @Roles(...INV_MUTATE, "chef")
  async listProductionOrders(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.listProductionOrders(outletId);
  }

  @Post("outlets/:outletId/production-orders")
  @Roles(...INV_MUTATE, "chef")
  async createProductionOrder(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.createProductionOrder(outletId, body as never);
  }

  @Post("production-orders/:orderId/complete")
  @Roles(...INV_MUTATE, "chef")
  async completeProductionOrder(
    @Request() req: { user: ScopedAuthUser },
    @Param("orderId") orderId: string,
    @Body() body: Record<string, unknown>,
  ) {
    assertInventoryMutation(req.user);
    return this.inventoryService.completeProductionOrder(orderId, body as never);
  }

  // ─── Suppliers ───────────────────────────────────────────────────────────────

  @Get("outlets/:outletId/suppliers")
  @Roles(...INV_MUTATE, "accountant")
  async getSuppliers(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.getSuppliers(outletId);
  }

  @Post("outlets/:outletId/suppliers")
  @Roles(...INV_MUTATE)
  async createSupplier(
    @Request() req: { user: ScopedAuthUser },
    @Param("outletId") outletId: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.createSupplier(outletId, body);
  }

  @Patch("suppliers/:id")
  @Roles(...INV_MUTATE)
  async updateSupplier(
    @Request() req: { user: ScopedAuthUser },
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const supplier = await this.outletScope.assertSupplierInOrganization(id, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, supplier.outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.updateSupplier(id, body);
  }

  @Get("outlets/:outletId/alerts")
  @Roles(...INV_OPS_READ)
  async listAlerts(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.listAlerts(outletId);
  }

  @Post("outlets/:outletId/alerts/check")
  @Roles(...INV_MUTATE)
  async checkAlerts(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    assertInventoryMutation(req.user);
    return this.inventoryService.checkAndCreateLowStockAlerts(outletId);
  }

  @Get("outlets/:outletId/reorder-suggestions")
  @Roles(...INV_MUTATE)
  async reorderSuggestions(@Request() req: { user: ScopedAuthUser }, @Param("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.inventoryService.getReorderSuggestions(outletId);
  }
}
