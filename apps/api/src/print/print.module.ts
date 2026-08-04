import { Module } from "@nestjs/common";
import { PrintBridgeService } from "./print-bridge.service";

@Module({
  providers: [PrintBridgeService],
  exports: [PrintBridgeService],
})
export class PrintModule {}
