import { Module, forwardRef } from "@nestjs/common";
import { OutletsService } from "./outlets.service";
import { OutletsController } from "./outlets.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [OutletsController],
  providers: [OutletsService],
  exports: [OutletsService],
})
export class OutletsModule {}
