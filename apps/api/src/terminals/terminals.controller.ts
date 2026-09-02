import { Controller, Param, Post, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard, Roles } from "../auth/guards";
import { TerminalsService } from "./terminals.service";

@ApiTags("terminals")
@Controller("terminals")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TerminalsController {
  constructor(private terminalsService: TerminalsService) {}

  @Post(":id/register")
  @Roles("manager", "owner")
  register(
    @Param("id") id: string,
    @Request() req: { user: { organizationId: string; userId: string } },
  ) {
    return this.terminalsService.registerTerminal(
      id,
      req.user.organizationId,
      req.user.userId,
    );
  }
}
