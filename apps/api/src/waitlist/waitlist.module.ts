import { Module, forwardRef } from "@nestjs/common";
import { WaitlistService } from "./waitlist.service";
import { WaitlistController } from "./waitlist.controller";
import { ReservationsModule } from "../reservations/reservations.module";

@Module({
  imports: [forwardRef(() => ReservationsModule)],
  controllers: [WaitlistController],
  providers: [WaitlistService],
  exports: [WaitlistService],
})
export class WaitlistModule {}
