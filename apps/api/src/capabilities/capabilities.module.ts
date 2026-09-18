import { Global, Module } from "@nestjs/common";
import { CapabilityService } from "./capability.service";
import { CapabilityController } from "./capability.controller";
import { CapabilityGuard } from "./capability.guard";

@Global()
@Module({
  controllers: [CapabilityController],
  providers: [CapabilityService, CapabilityGuard],
  exports: [CapabilityService, CapabilityGuard],
})
export class CapabilitiesModule {}
