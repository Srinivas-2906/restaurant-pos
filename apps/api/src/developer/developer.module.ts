import { Module } from "@nestjs/common";
import { DeveloperService } from "./developer.service";
import { DeveloperController } from "./developer.controller";

@Module({ providers: [DeveloperService], controllers: [DeveloperController], exports: [DeveloperService] })
export class DeveloperModule {}
