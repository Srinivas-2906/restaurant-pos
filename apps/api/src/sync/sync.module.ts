import { Module } from "@nestjs/common";
import { SyncService } from "./sync.service";
import { SyncController } from "./sync.controller";
import { PosSyncService } from "./pos-sync.service";
import { OrdersModule } from "../orders/orders.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [OrdersModule, AuthModule],
  controllers: [SyncController],
  providers: [SyncService, PosSyncService],
  exports: [SyncService, PosSyncService],
})
export class SyncModule {}
