import { Module } from "@nestjs/common";
import { KdsService } from "./kds.service";
import { KdsController } from "./kds.controller";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [EventsModule],
  controllers: [KdsController],
  providers: [KdsService],
  exports: [KdsService],
})
export class KdsModule {}
