import { Module } from "@nestjs/common";
import { TerminalsController } from "./terminals.controller";
import { TerminalsService } from "./terminals.service";
import { AuditModule } from "../audit/audit.module";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [AuditModule, EventsModule],
  controllers: [TerminalsController],
  providers: [TerminalsService],
  exports: [TerminalsService],
})
export class TerminalsModule {}
