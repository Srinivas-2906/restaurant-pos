import { Module } from "@nestjs/common";
import { FranchiseService } from "./franchise.service";
import { FranchiseController } from "./franchise.controller";

@Module({ providers: [FranchiseService], controllers: [FranchiseController] })
export class FranchiseModule {}
