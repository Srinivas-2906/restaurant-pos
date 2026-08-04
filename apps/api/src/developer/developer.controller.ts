import { Controller, Get, Post, Body, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { DeveloperService } from "./developer.service";
import { JwtAuthGuard, Roles } from "../auth/guards";

@ApiTags("developer")
@Controller("developer")
export class DeveloperController {
  constructor(private developerService: DeveloperService) {}

  @Get("sandbox")
  sandbox() {
    return this.developerService.getSandboxInfo();
  }

  @Post("api-keys")
  @UseGuards(JwtAuthGuard)
  @Roles("owner", "manager")
  @ApiBearerAuth()
  createKey(@Query("outletId") outletId: string, @Body() body: { name: string; scopes?: string[] }) {
    return this.developerService.createApiKey(outletId, body.name, body.scopes ?? ["orders:read"]);
  }

  @Get("api-keys")
  @UseGuards(JwtAuthGuard)
  @Roles("owner", "manager")
  @ApiBearerAuth()
  listKeys(@Query("outletId") outletId: string) {
    return this.developerService.listApiKeys(outletId);
  }

  @Post("webhooks")
  @UseGuards(JwtAuthGuard)
  @Roles("owner", "manager")
  @ApiBearerAuth()
  createWebhook(@Query("outletId") outletId: string, @Body() body: { url: string; events: string[] }) {
    return this.developerService.createWebhook(outletId, body.url, body.events);
  }

  @Get("webhooks")
  @UseGuards(JwtAuthGuard)
  @Roles("owner", "manager")
  @ApiBearerAuth()
  listWebhooks(@Query("outletId") outletId: string) {
    return this.developerService.listWebhooks(outletId);
  }
}
