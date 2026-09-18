import { Body, Controller, Get, Param, Post, Request, UseGuards } from "@nestjs/common";

import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard, Roles } from "../auth/guards";

import { Public } from "../auth/public.decorator";

import { TerminalAuthGuard, type TerminalContext } from "../auth/terminal-auth.guard";

import { CapabilityGuard, RequireModule } from "../capabilities/capability.guard";

import { TerminalsService } from "./terminals.service";



@ApiTags("terminals")

@Controller("terminals")

export class TerminalsController {

  constructor(private terminalsService: TerminalsService) {}



  @Get()

  @UseGuards(JwtAuthGuard, CapabilityGuard)

  @RequireModule("devices")

  @ApiBearerAuth()

  @Roles("manager", "owner")

  list(@Request() req: { user: { organizationId: string } }) {

    return this.terminalsService.listForOrganization(req.user.organizationId);

  }



  @Post()

  @UseGuards(JwtAuthGuard, CapabilityGuard)

  @RequireModule("devices")

  @ApiBearerAuth()

  @Roles("manager", "owner")

  create(

    @Body()

    body: {

      outletId: string;

      name: string;

      deviceType: "pos" | "kds" | "captain";

      code?: string;

    },

    @Request() req: { user: { organizationId: string; userId: string } },

  ) {

    return this.terminalsService.createTerminal({

      organizationId: req.user.organizationId,

      userId: req.user.userId,

      outletId: body.outletId,

      name: body.name,

      deviceType: body.deviceType,

      code: body.code,

    });

  }



  @Post(":id/register")

  @UseGuards(JwtAuthGuard, CapabilityGuard)

  @RequireModule("devices")

  @ApiBearerAuth()

  @Roles("manager", "owner")

  register(

    @Param("id") id: string,

    @Request() req: { user: { organizationId: string; userId: string } },

  ) {

    return this.terminalsService.registerTerminal(id, req.user.organizationId, req.user.userId);

  }



  @Post(":id/activation-code")

  @UseGuards(JwtAuthGuard, CapabilityGuard)

  @RequireModule("devices")

  @ApiBearerAuth()

  @Roles("manager", "owner")

  activationCode(

    @Param("id") id: string,

    @Request() req: { user: { organizationId: string; userId: string } },

  ) {

    return this.terminalsService.generateActivationCode(id, req.user.organizationId, req.user.userId);

  }



  @Post(":id/cancel-activation-code")

  @UseGuards(JwtAuthGuard, CapabilityGuard)

  @RequireModule("devices")

  @ApiBearerAuth()

  @Roles("manager", "owner")

  cancelActivationCode(

    @Param("id") id: string,

    @Request() req: { user: { organizationId: string; userId: string } },

  ) {

    return this.terminalsService.cancelActivationCode(id, req.user.organizationId, req.user.userId);

  }



  @Post(":id/revoke")

  @UseGuards(JwtAuthGuard, CapabilityGuard)

  @RequireModule("devices")

  @ApiBearerAuth()

  @Roles("manager", "owner")

  revoke(

    @Param("id") id: string,

    @Request() req: { user: { organizationId: string; userId: string } },

  ) {

    return this.terminalsService.revokeTerminal(id, req.user.organizationId, req.user.userId);

  }



  @Public()

  @Post("activate")

  activate(

    @Body()

    body: {

      code: string;

      deviceId: string;

      deviceMetadata?: Record<string, unknown>;

    },

  ) {

    return this.terminalsService.redeemActivationCode(

      body.code,

      body.deviceId,

      body.deviceMetadata,

    );

  }



  @Public()

  @UseGuards(TerminalAuthGuard)

  @Post("heartbeat")

  heartbeat(

    @Request() req: { terminal: TerminalContext },

    @Body()

    body: { deviceId?: string; appVersion?: string; platform?: string; osVersion?: string; status?: string },

  ) {

    return this.terminalsService.recordHeartbeat(req.terminal, body);

  }

}


