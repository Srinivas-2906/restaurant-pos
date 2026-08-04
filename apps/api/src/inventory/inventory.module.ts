import { Module, forwardRef } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { InventoryController } from "./inventory.controller";
import { MenuModule } from "../menu/menu.module";

@Module({
  imports: [forwardRef(() => MenuModule)],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
