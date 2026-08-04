import { Module } from "@nestjs/common";
import { MarginsService } from "./margins.service";
import { MarginsController } from "./margins.controller";

@Module({ providers: [MarginsService], controllers: [MarginsController], exports: [MarginsService] })
export class MarginsModule {}
