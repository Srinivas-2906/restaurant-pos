import { Controller, Get, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { AuditService } from "./audit.service";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@ApiTags("audit")
@Controller("audit")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Roles("owner", "manager", "super_admin")
  findAll(@Request() req: { user: { organizationId: string } }, @Query("limit") limit?: string) {
    return this.auditService.findByOrganization(req.user.organizationId, limit ? Number(limit) : 50);
  }
}
