import { Module, forwardRef } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { EventsModule } from "../events/events.module";
import { InventoryModule } from "../inventory/inventory.module";
import { PrintModule } from "../print/print.module";
import { AuthModule } from "../auth/auth.module";
import { AccountingModule } from "../accounting/accounting.module";

@Module({
  imports: [EventsModule, forwardRef(() => InventoryModule), PrintModule, AuthModule, AccountingModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
