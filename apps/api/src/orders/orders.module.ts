import { Module, forwardRef } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { EventsModule } from "../events/events.module";
import { InventoryModule } from "../inventory/inventory.module";

@Module({
  imports: [EventsModule, forwardRef(() => InventoryModule)],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
