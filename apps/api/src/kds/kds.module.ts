import { Module } from "@nestjs/common";
import { KdsService } from "./kds.service";
import { KdsController } from "./kds.controller";
import { EventsModule } from "../events/events.module";
import { AuthModule } from "../auth/auth.module";
import { CapabilitiesModule } from "../capabilities/capabilities.module";

@Module({
  imports: [EventsModule, AuthModule, CapabilitiesModule],
  controllers: [KdsController],
  providers: [KdsService],
  exports: [KdsService],
})
export class KdsModule {}
