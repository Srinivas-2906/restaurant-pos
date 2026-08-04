import { Controller, Get, Post, Param, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { RecommendationsService } from "./recommendations.service";
import { JwtAuthGuard, Roles } from "../auth/guards";

@ApiTags("recommendations")
@Controller("recommendations")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecommendationsController {
  constructor(private recommendationsService: RecommendationsService) {}

  @Post("generate")
  @Roles("owner", "manager")
  generate(@Query("outletId") outletId: string) {
    return this.recommendationsService.generate(outletId);
  }

  @Get("pending")
  @Roles("owner", "manager")
  pending(@Query("outletId") outletId: string) {
    return this.recommendationsService.findPending(outletId);
  }

  @Post(":id/approve")
  @Roles("owner")
  approve(@Param("id") id: string, @Request() req: { user: { userId: string } }) {
    return this.recommendationsService.approve(id, req.user.userId);
  }

  @Post(":id/dismiss")
  @Roles("owner")
  dismiss(@Param("id") id: string) {
    return this.recommendationsService.dismiss(id);
  }

  @Get("history")
  @Roles("owner", "manager")
  history(@Query("outletId") outletId: string) {
    return this.recommendationsService.getHistory(outletId);
  }
}
