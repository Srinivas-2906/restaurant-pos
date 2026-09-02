import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { OrganizationsService } from "./organizations.service";
import { JwtAuthGuard } from "../auth/guards";

@ApiTags("organizations")
@Controller("organizations")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private orgService: OrganizationsService) {}

  @Get()
  findAll(@Request() req: { user: { organizationId: string } }) {
    return this.orgService.findAll(req.user.organizationId);
  }

  @Get("dashboard")
  getDashboard(
    @Request() req: { user: { organizationId: string } },
    @Query("outletId") outletId?: string,
  ) {
    return this.orgService.getDashboardStats(req.user.organizationId, outletId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.orgService.findOne(id);
  }

  @Post()
  create(@Body() body: { name: string; slug: string; gstin?: string; email?: string; phone?: string }) {
    return this.orgService.create(body);
  }
}
