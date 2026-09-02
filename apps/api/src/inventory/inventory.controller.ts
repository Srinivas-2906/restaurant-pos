import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { InventoryService } from "./inventory.service";
import { JwtAuthGuard, Roles } from "../auth/guards";

/** POS + back-office inventory operators */
const INV_OPS = ["inventory_manager", "manager", "owner", "biller"] as const;
const INV_READ = [...INV_OPS, "super_admin"] as const;

@ApiTags("inventory")
@Controller("inventory")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  // ─── Items (Inventory Items) ───────────────────────────────────────────────

  @Get("outlets/:outletId/items")
  @Roles(...INV_READ)
  @ApiOperation({ summary: "List inventory items" })
  getItems(@Param("outletId") outletId: string) {
    return this.inventoryService.getItems(outletId);
  }

  @Get("outlets/:outletId/ingredients")
  @Roles(...INV_READ)
  getIngredients(@Param("outletId") outletId: string) {
    return this.inventoryService.getIngredients(outletId);
  }

  @Post("outlets/:outletId/items")
  @Roles(...INV_OPS)
  createItem(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createIngredient(outletId, body);
  }

  @Post("outlets/:outletId/ingredients")
  @Roles(...INV_OPS)
  createIngredient(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createIngredient(outletId, body);
  }

  @Patch("items/:id")
  @Roles(...INV_OPS)
  updateItem(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.updateIngredient(id, body);
  }

  @Patch("ingredients/:id")
  @Roles(...INV_OPS)
  updateIngredient(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.updateIngredient(id, body);
  }

  @Post("outlets/:outletId/opening-stock")
  @Roles(...INV_OPS)
  openingStock(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.recordOpeningStock(outletId, body as never);
  }

  // ─── Dashboard & Ledger ──────────────────────────────────────────────────────

  @Get("outlets/:outletId/dashboard")
  @Roles(...INV_READ)
  dashboard(@Param("outletId") outletId: string) {
    return this.inventoryService.getDashboard(outletId);
  }

  @Get("outlets/:outletId/stock-summary")
  @Roles(...INV_READ)
  stockSummary(@Param("outletId") outletId: string) {
    return this.inventoryService.getStockSummary(outletId);
  }

  @Get("outlets/:outletId/stock-ledger")
  @Roles(...INV_READ)
  stockLedger(
    @Param("outletId") outletId: string,
    @Query("limit") limit?: string,
    @Query("type") type?: string,
    @Query("ingredientId") ingredientId?: string,
  ) {
    return this.inventoryService.getStockLedger(outletId, limit ? Number(limit) : 100, { type, ingredientId });
  }

  @Post("outlets/:outletId/stock-adjustments")
  @Roles(...INV_OPS)
  stockAdjustment(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createStockAdjustment(outletId, body as never);
  }

  @Get("outlets/:outletId/menu-availability")
  @Roles(...INV_OPS)
  menuAvailability(@Param("outletId") outletId: string) {
    return this.inventoryService.getMenuAvailability(outletId);
  }

  // ─── Stock Closing ───────────────────────────────────────────────────────────

  @Get("outlets/:outletId/stock-closings")
  @Roles(...INV_OPS)
  stockClosings(@Param("outletId") outletId: string, @Query("month") month?: string) {
    return this.inventoryService.getStockClosings(outletId, month);
  }

  @Post("outlets/:outletId/stock-closings")
  @Roles(...INV_OPS)
  createStockClosing(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createStockClosing(outletId, body as never);
  }

  // ─── Categories ─────────────────────────────────────────────────────────────

  @Get("outlets/:outletId/categories")
  @Roles(...INV_OPS)
  categories(@Param("outletId") outletId: string) {
    return this.inventoryService.getCategories(outletId);
  }

  @Post("outlets/:outletId/categories")
  @Roles(...INV_OPS)
  createCategory(@Param("outletId") outletId: string, @Body() body: { name: string; sortOrder?: number }) {
    return this.inventoryService.createCategory(outletId, body.name, body.sortOrder);
  }

  // ─── Wastage ─────────────────────────────────────────────────────────────────

  @Post("outlets/:outletId/wastage")
  @Roles(...INV_OPS)
  recordWastage(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.recordWastage(outletId, body as never);
  }

  @Get("outlets/:outletId/wastage")
  @Roles(...INV_OPS)
  listWastage(@Param("outletId") outletId: string) {
    return this.inventoryService.listWastage(outletId);
  }

  // ─── Purchase Orders & Receipts ──────────────────────────────────────────────

  @Get("outlets/:outletId/purchase-orders")
  @Roles(...INV_OPS)
  listPOs(@Param("outletId") outletId: string) {
    return this.inventoryService.listPurchaseOrders(outletId);
  }

  @Post("outlets/:outletId/purchase-orders")
  @Roles(...INV_OPS)
  createPO(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createPurchaseOrder(outletId, body as never);
  }

  @Post("purchase-orders/:poId/receive")
  @Roles(...INV_OPS)
  receivePO(@Param("poId") poId: string, @Body() body?: { lines?: Array<{ poItemId: string; receivedQty: number; rejectedQty?: number; purchaseUnit?: string }> }) {
    return this.inventoryService.receivePO(poId, body?.lines);
  }

  @Post("purchase-orders/:poId/send")
  @Roles(...INV_OPS)
  sendPO(@Param("poId") poId: string) {
    return this.inventoryService.sendPO(poId);
  }

  @Post("purchase-orders/:poId/cancel")
  @Roles(...INV_OPS)
  cancelPO(@Param("poId") poId: string) {
    return this.inventoryService.cancelPO(poId);
  }

  @Get("outlets/:outletId/goods-receipts")
  @Roles(...INV_OPS)
  listGoodsReceipts(@Param("outletId") outletId: string) {
    return this.inventoryService.listGoodsReceipts(outletId);
  }

  // ─── Purchase Requests ───────────────────────────────────────────────────────

  @Get("outlets/:outletId/purchase-requests")
  @Roles(...INV_OPS)
  listPurchaseRequests(@Param("outletId") outletId: string) {
    return this.inventoryService.listPurchaseRequests(outletId);
  }

  @Post("outlets/:outletId/purchase-requests")
  @Roles(...INV_OPS)
  createPurchaseRequest(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createPurchaseRequest(outletId, body as never);
  }

  // ─── Purchase Invoices & Returns ─────────────────────────────────────────────

  @Get("outlets/:outletId/purchase-invoices")
  @Roles(...INV_OPS, "accountant")
  listPurchaseInvoices(@Param("outletId") outletId: string) {
    return this.inventoryService.listPurchaseInvoices(outletId);
  }

  @Post("outlets/:outletId/purchase-invoices")
  @Roles("inventory_manager", "manager", "accountant")
  createPurchaseInvoice(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createPurchaseInvoice(outletId, body);
  }

  @Get("outlets/:outletId/purchase-returns")
  @Roles(...INV_OPS)
  listPurchaseReturns(@Param("outletId") outletId: string) {
    return this.inventoryService.listPurchaseReturns(outletId);
  }

  @Post("outlets/:outletId/purchase-returns")
  @Roles(...INV_OPS)
  createPurchaseReturn(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createPurchaseReturn(outletId, body as never);
  }

  // ─── Recipes ─────────────────────────────────────────────────────────────────

  @Get("outlets/:outletId/recipes")
  @Roles(...INV_OPS, "chef")
  getRecipes(@Param("outletId") outletId: string) {
    return this.inventoryService.getRecipes(outletId);
  }

  @Post("outlets/:outletId/recipes")
  @Roles(...INV_OPS, "chef")
  upsertRecipe(@Param("outletId") _outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.upsertRecipe(body as never);
  }

  // ─── Stock Count ─────────────────────────────────────────────────────────────

  @Get("outlets/:outletId/stock-counts")
  @Roles(...INV_OPS)
  getStockCounts(@Param("outletId") outletId: string) {
    return this.inventoryService.getStockCounts(outletId);
  }

  @Post("outlets/:outletId/stock-counts")
  @Roles(...INV_OPS)
  createStockCount(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createStockCount(outletId, body as never);
  }

  @Patch("stock-counts/:countId/lines/:lineId")
  @Roles(...INV_OPS)
  updateStockCountLine(
    @Param("countId") countId: string,
    @Param("lineId") lineId: string,
    @Body() body: { physicalStock: number; reason?: string },
  ) {
    return this.inventoryService.updateStockCountLine(countId, lineId, body.physicalStock, body.reason);
  }

  @Post("stock-counts/:countId/approve")
  @Roles("manager", "owner")
  approveStockCount(@Param("countId") countId: string, @Body() body: { approvedById?: string }) {
    return this.inventoryService.approveStockCount(countId, body.approvedById);
  }

  // ─── Transfers ───────────────────────────────────────────────────────────────

  @Post("ck/transfers")
  @Roles(...INV_OPS)
  createTransfer(@Body() body: { fromOutletId: string; toOutletId: string; items: Array<{ ingredientId: string; quantity: number }>; notes?: string }) {
    return this.inventoryService.createCKTransfer(body.fromOutletId, body.toOutletId, body.items, body.notes);
  }

  @Get("outlets/:outletId/transfers")
  @Roles(...INV_OPS)
  listTransfers(@Param("outletId") outletId: string) {
    return this.inventoryService.listTransfers(outletId);
  }

  @Post("transfers/:transferId/dispatch")
  @Roles(...INV_OPS)
  dispatchTransfer(@Param("transferId") transferId: string) {
    return this.inventoryService.dispatchTransfer(transferId);
  }

  @Post("transfers/:transferId/receive")
  @Roles(...INV_OPS)
  receiveTransfer(@Param("transferId") transferId: string, @Body() body?: { lines?: Array<{ lineId: string; receivedQty: number }> }) {
    return this.inventoryService.receiveTransfer(transferId, body?.lines);
  }

  // ─── Production ──────────────────────────────────────────────────────────────

  @Get("outlets/:outletId/production-orders")
  @Roles(...INV_OPS, "chef")
  listProductionOrders(@Param("outletId") outletId: string) {
    return this.inventoryService.listProductionOrders(outletId);
  }

  @Post("outlets/:outletId/production-orders")
  @Roles(...INV_OPS, "chef")
  createProductionOrder(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createProductionOrder(outletId, body as never);
  }

  @Post("production-orders/:orderId/complete")
  @Roles(...INV_OPS, "chef")
  completeProductionOrder(@Param("orderId") orderId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.completeProductionOrder(orderId, body as never);
  }

  // ─── Suppliers ───────────────────────────────────────────────────────────────

  @Get("outlets/:outletId/suppliers")
  @Roles(...INV_OPS)
  getSuppliers(@Param("outletId") outletId: string) {
    return this.inventoryService.getSuppliers(outletId);
  }

  @Post("outlets/:outletId/suppliers")
  @Roles(...INV_OPS)
  createSupplier(@Param("outletId") outletId: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.createSupplier(outletId, body);
  }

  @Patch("suppliers/:id")
  @Roles(...INV_OPS)
  updateSupplier(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.updateSupplier(id, body);
  }

  @Get("outlets/:outletId/alerts")
  @Roles(...INV_OPS)
  listAlerts(@Param("outletId") outletId: string) {
    return this.inventoryService.listAlerts(outletId);
  }

  @Post("outlets/:outletId/alerts/check")
  @Roles(...INV_OPS)
  checkAlerts(@Param("outletId") outletId: string) {
    return this.inventoryService.checkAndCreateLowStockAlerts(outletId);
  }

  @Get("outlets/:outletId/reorder-suggestions")
  @Roles(...INV_OPS)
  reorderSuggestions(@Param("outletId") outletId: string) {
    return this.inventoryService.getReorderSuggestions(outletId);
  }
}
