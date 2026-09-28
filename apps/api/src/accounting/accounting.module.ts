import { Module, forwardRef } from "@nestjs/common";
import { AccountingService } from "./accounting.service";
import { AccountingController } from "./accounting.controller";
import { AccountingPostingQueueService } from "./accounting-posting-queue.service";
import { CapabilitiesModule } from "../capabilities/capabilities.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [CapabilitiesModule, forwardRef(() => AuthModule)],
  controllers: [AccountingController],
  providers: [AccountingService, AccountingPostingQueueService],
  exports: [AccountingService, AccountingPostingQueueService],
})
export class AccountingModule {}
