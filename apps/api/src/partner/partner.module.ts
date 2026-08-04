import { Module } from "@nestjs/common";
import { PartnerService } from "./partner.service";
import { PartnerController } from "./partner.controller";
import { OrdersModule } from "../orders/orders.module";
import { MenuModule } from "../menu/menu.module";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [OrdersModule, MenuModule, EventsModule],
  controllers: [PartnerController],
  providers: [PartnerService],
  exports: [PartnerService],
})
export class PartnerModule {}
