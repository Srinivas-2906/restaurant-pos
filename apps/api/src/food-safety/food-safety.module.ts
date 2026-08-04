import { Module } from "@nestjs/common";
import { FoodSafetyService } from "./food-safety.service";
import { FoodSafetyController } from "./food-safety.controller";

@Module({ providers: [FoodSafetyService], controllers: [FoodSafetyController] })
export class FoodSafetyModule {}
