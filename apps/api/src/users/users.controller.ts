import { Controller, Get, Post, Body, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards";

@ApiTags("users")
@Controller("users")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll(@Request() req: { user: { organizationId: string } }) {
    return this.usersService.findByOrganization(req.user.organizationId);
  }

  @Post()
  create(@Request() req: { user: { organizationId: string } }, @Body() body: Record<string, unknown>) {
    return this.usersService.create(req.user.organizationId, body as never);
  }
}
