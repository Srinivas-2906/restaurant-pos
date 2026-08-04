import { Controller, Get, Post, Body, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { FranchiseService } from "./franchise.service";
import { JwtAuthGuard, Roles } from "../auth/guards";

@ApiTags("franchise")
@Controller("franchise")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FranchiseController {
  constructor(private franchiseService: FranchiseService) {}

  @Post("audits")
  @Roles("owner", "manager")
  recordAudit(@Body() body: Record<string, unknown>) {
    return this.franchiseService.recordAudit(body as never);
  }

  @Get("audits")
  @Roles("owner", "manager")
  listAudits(@Query("outletId") outletId: string) {
    return this.franchiseService.listAudits(outletId);
  }

  @Post("sops")
  @Roles("owner")
  createSop(@Body() body: Record<string, unknown>) {
    return this.franchiseService.createSop(body as never);
  }

  @Get("sops")
  @Roles("owner", "manager")
  listSops() {
    return this.franchiseService.listSops();
  }

  @Get("compare")
  @Roles("owner")
  compare(@Request() req: { user: { organizationId: string } }) {
    return this.franchiseService.compareOutlets(req.user.organizationId);
  }
}
