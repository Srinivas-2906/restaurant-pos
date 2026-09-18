import { Module, forwardRef } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { InventoryController } from "./inventory.controller";
import { MenuModule } from "../menu/menu.module";
import { AuthModule } from "../auth/auth.module";
import { AccountingModule } from "../accounting/accounting.module";

@Module({
  imports: [forwardRef(() => MenuModule), forwardRef(() => AuthModule), AccountingModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
