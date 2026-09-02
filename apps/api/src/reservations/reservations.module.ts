import { Module, forwardRef } from "@nestjs/common";
import { ReservationsService } from "./reservations.service";
import { ReservationsController, PublicReservationsController } from "./reservations.controller";
import { OrdersModule } from "../orders/orders.module";

@Module({
  imports: [forwardRef(() => OrdersModule)],
  controllers: [ReservationsController, PublicReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
