import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { ApprovalsService } from "./approvals.service";
import { JwtAuthGuard, Roles } from "../auth/guards";

@ApiTags("approvals")
@Controller("approvals")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApprovalsController {
  constructor(private approvalsService: ApprovalsService) {}

  @Get("pending")
  @Roles("manager", "owner")
  pending(@Query("outletId") outletId: string) {
    return this.approvalsService.getPending(outletId);
  }
}
