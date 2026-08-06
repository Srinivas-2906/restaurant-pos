import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { JwtAuthGuard, Roles } from "../auth/guards";

@ApiTags("orders")
@Controller("orders")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  @Roles("owner", "manager", "biller", "captain", "super_admin")
  findAll(@Query("outletId") outletId: string, @Query("status") status?: string) {
    return this.ordersService.findByOutlet(outletId, status);
  }

  @Get("inbox")
  @Roles("biller", "manager", "owner")
  getInbox(@Query("outletId") outletId: string) {
    return this.ordersService.getUnifiedInbox(outletId);
  }

  @Get("open/by-table")
  @Roles("biller", "captain", "manager")
  openByTable(@Query("outletId") outletId: string, @Query("tableId") tableId: string) {
    return this.ordersService.getOpenOrderForTable(outletId, tableId);
  }

  @Get(":id")
  @Roles("owner", "manager", "biller", "captain", "super_admin")
  findOne(@Param("id") id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  @Roles("biller", "captain", "manager")
  create(@Request() req: { user: { userId: string } }, @Body() body: Record<string, unknown>) {
    return this.ordersService.create({ ...body, createdById: req.user.userId } as never);
  }

  @Post(":id/items")
  @Roles("biller", "captain")
  addItem(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.ordersService.addItem(id, body as never);
  }

  @Patch(":id/items/:itemId")
  @Roles("biller", "captain")
  updateItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() body: { quantity: number },
  ) {
    return this.ordersService.updateItemQuantity(id, itemId, body.quantity);
  }

  @Delete(":id/items/:itemId")
  @Roles("biller", "captain")
  removeItem(@Param("id") id: string, @Param("itemId") itemId: string) {
    return this.ordersService.removeItem(id, itemId);
  }

  @Post(":id/kot")
  @Roles("biller", "captain")
  fireKOT(@Param("id") id: string) {
    return this.ordersService.fireKOT(id);
  }

  @Post(":id/print-bill")
  @Roles("biller", "captain", "manager")
  printBill(@Param("id") id: string) {
    return this.ordersService.printBill(id);
  }

  @Post(":id/settle")
  @Roles("biller", "manager")
  settle(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.ordersService.settle(id, body as never);
  }

  @Post(":id/split")
  @Roles("biller", "manager")
  splitTable(@Param("id") id: string, @Body() body: { itemIds: string[]; targetTableId: string }) {
    return this.ordersService.splitTable(id, body.itemIds, body.targetTableId);
  }
}
