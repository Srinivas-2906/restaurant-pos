import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import type { JwtPayload } from "@kaana/shared-types";
import { CapabilityService } from "./capability.service";

@Controller("capabilities")
@UseGuards(JwtAuthGuard)
export class CapabilityController {
  constructor(private capabilities: CapabilityService) {}

  @Get("me")
  async getMyCapabilities(@Request() req: { user: JwtPayload }) {
    const resolved = await this.capabilities.resolveForOrganization(req.user.organizationId);
    return {
      success: true,
      data: {
        ...resolved,
        resolvedAt: new Date().toISOString(),
      },
    };
  }
}
