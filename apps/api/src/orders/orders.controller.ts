import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { JwtAuthGuard, Roles } from "../auth/guards";
import {
  auditActorFromUser,
  operationalAuditMetadata,
  type AuditActorContext,
} from "../auth/audit-actor.util";
import { OutletScopeService, type ScopedAuthUser } from "../auth/outlet-scope.service";

function auditActor(req: { user: ScopedAuthUser }): AuditActorContext {
  return auditActorFromUser(req.user);
}

@ApiTags("orders")
@Controller("orders")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private outletScope: OutletScopeService,
  ) {}

  @Get()
  @Roles("owner", "manager", "biller", "captain", "super_admin")
  async findAll(
    @Request() req: { user: ScopedAuthUser },
    @Query("outletId") outletId: string,
    @Query("status") status?: string,
    @Query("type") type?: string,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.ordersService.findByOutlet(outletId, status, type);
  }

  @Get("live")
  @Roles("owner", "manager", "biller", "super_admin")
  async getLive(@Request() req: { user: ScopedAuthUser }, @Query("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.ordersService.getLiveOrders(outletId);
  }

  @Get("inbox")
  @Roles("biller", "manager", "owner")
  async getInbox(@Request() req: { user: ScopedAuthUser }, @Query("outletId") outletId: string) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.ordersService.getUnifiedInbox(outletId);
  }

  @Get("open/by-table")
  @Roles("biller", "captain", "manager")
  async openByTable(
    @Request() req: { user: ScopedAuthUser },
    @Query("outletId") outletId: string,
    @Query("tableId") tableId: string,
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    const order = await this.ordersService.getOpenOrderForTable(outletId, tableId);
    if (!order) throw new NotFoundException("No open order for this table");
    return order;
  }

  @Get(":id/kitchen-timeline")
  @Roles("owner", "manager", "biller", "captain", "chef")
  async kitchenTimeline(@Request() req: { user: ScopedAuthUser }, @Param("id") id: string) {
    const order = await this.outletScope.assertOrderInOrganization(id, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, order.outletId);
    return this.ordersService.getKitchenTimeline(id);
  }

  @Get(":id")
  @Roles("owner", "manager", "biller", "captain", "super_admin")
  async findOne(@Request() req: { user: ScopedAuthUser }, @Param("id") id: string) {
    const order = await this.outletScope.assertOrderInOrganization(id, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, order.outletId);
    return this.ordersService.findOne(id);
  }

  @Post()
  @Roles("biller", "captain", "manager")
  async create(
    @Request() req: { user: ScopedAuthUser },
    @Body() body: Record<string, unknown>,
  ) {
    const outletId = String(body.outletId ?? "");
    await this.outletScope.assertUserOutletAccess(req.user, outletId);
    return this.ordersService.create({
      ...body,
      outletId,
      terminalId:
        req.user.authMode === "operational"
          ? req.user.terminalId
          : (body.terminalId as string | undefined),
      createdById: req.user.authMode === "operational" ? undefined : req.user.userId,
      actorRole: req.user.role,
      actor: auditActor(req),
    } as never);
  }

  @Post(":id/items")
  @Roles("biller", "captain")
  async addItem(
    @Request() req: { user: ScopedAuthUser },
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const order = await this.outletScope.assertOrderInOrganization(id, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, order.outletId);
    return this.ordersService.addItem(id, body as never);
  }

  @Patch(":id/items/:itemId")
  @Roles("biller", "captain")
  async updateItem(
    @Request() req: { user: ScopedAuthUser },
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() body: { quantity: number },
  ) {
    const order = await this.outletScope.assertOrderInOrganization(id, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, order.outletId);
    return this.ordersService.updateItemQuantity(id, itemId, body.quantity);
  }

  @Patch(":id/items/:itemId/served")
  @Roles("captain", "manager")
  async markItemServed(
    @Request() req: { user: ScopedAuthUser },
    @Param("id") id: string,
    @Param("itemId") itemId: string,
  ) {
    const order = await this.outletScope.assertOrderInOrganization(id, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, order.outletId);
    return this.ordersService.markItemServed(id, itemId, auditActor(req));
  }

  @Delete(":id/items/:itemId")
  @Roles("biller", "captain")
  async removeItem(
    @Request() req: { user: ScopedAuthUser },
    @Param("id") id: string,
    @Param("itemId") itemId: string,
  ) {
    const order = await this.outletScope.assertOrderInOrganization(id, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, order.outletId);
    return this.ordersService.removeItem(id, itemId);
  }

  @Post(":id/kot")
  @Roles("biller", "captain")
  async fireKOT(@Request() req: { user: ScopedAuthUser }, @Param("id") id: string) {
    const order = await this.outletScope.assertOrderInOrganization(id, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, order.outletId);
    await this.ordersService.fireKOT(id, auditActor(req));
    return this.ordersService.findOne(id);
  }

  @Post(":id/request-bill")
  @Roles("biller", "captain", "manager")
  async requestBill(@Request() req: { user: ScopedAuthUser }, @Param("id") id: string) {
    const order = await this.outletScope.assertOrderInOrganization(id, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, order.outletId);
    return this.ordersService.requestBill(id, auditActor(req));
  }

  @Post(":id/print-bill")
  @Roles("biller", "captain", "manager")
  async printBill(@Request() req: { user: ScopedAuthUser }, @Param("id") id: string) {
    const order = await this.outletScope.assertOrderInOrganization(id, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, order.outletId);
    return this.ordersService.printBill(id);
  }

  @Post(":id/settle")
  @Roles("owner", "biller", "manager", "captain")
  async settle(
    @Request() req: { user: ScopedAuthUser },
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const order = await this.outletScope.assertOrderInOrganization(id, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, order.outletId);
    return this.ordersService.settle(id, body as never, {
      role: req.user.role,
      permissions: req.user.permissions,
      actor: auditActor(req),
    });
  }

  @Post(":id/split")
  @Roles("biller", "manager")
  async splitTable(
    @Request() req: { user: ScopedAuthUser },
    @Param("id") id: string,
    @Body() body: { itemIds: string[]; targetTableId: string },
  ) {
    const order = await this.outletScope.assertOrderInOrganization(id, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, order.outletId);
    return this.ordersService.splitTable(id, body.itemIds, body.targetTableId);
  }

  @Post(":id/cancel")
  @Roles("biller", "manager")
  async cancel(
    @Request() req: { user: ScopedAuthUser },
    @Param("id") id: string,
    @Body() body: { reason?: string },
  ) {
    const order = await this.outletScope.assertOrderInOrganization(id, req.user.organizationId);
    await this.outletScope.assertUserOutletAccess(req.user, order.outletId);
    return this.ordersService.cancelOrder(id, body.reason, auditActor(req));
  }
}
