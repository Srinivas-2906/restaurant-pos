import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PinLoginSchema } from "@kaana/shared-types";
import { Public } from "./public.decorator";
import { TerminalAuthGuard, TerminalContext } from "./terminal-auth.guard";
import { OperationalAuthService } from "./operational-auth.service";
import { Throttle } from "@nestjs/throttler";

@ApiTags("operational")
@Controller("operational")
export class OperationalAuthController {
  constructor(private operationalAuth: OperationalAuthService) {}

  @Public()
  @UseGuards(TerminalAuthGuard)
  @Get("terminals/me")
  getTerminal(@Req() req: { terminal: TerminalContext }) {
    return this.operationalAuth.getTerminalContext(req.terminal);
  }

  @Public()
  @UseGuards(TerminalAuthGuard)
  @Get("terminals/me/eligible-staff")
  eligibleStaff(@Req() req: { terminal: TerminalContext }) {
    return this.operationalAuth.listEligibleStaff(req.terminal);
  }

  @Public()
  @UseGuards(TerminalAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("pin-login")
  pinLogin(
    @Req() req: { terminal: TerminalContext; ip?: string },
    @Body() body: unknown,
  ) {
    const parsed = PinLoginSchema.parse(body);
    return this.operationalAuth.pinLogin(
      req.terminal,
      parsed.staffProfileId,
      parsed.pin,
      req.ip,
    );
  }
}
