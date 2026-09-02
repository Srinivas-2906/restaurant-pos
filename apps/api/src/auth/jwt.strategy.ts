import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { JwtPayload } from "@kaana/shared-types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get("JWT_SECRET", "dev-secret"),
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.userId ?? payload.sub,
      email: payload.email,
      organizationId: payload.organizationId,
      outletId: payload.outletId,
      role: payload.role,
      authMode: payload.authMode ?? "email",
      staffProfileId: payload.staffProfileId,
      terminalId: payload.terminalId,
      permissions: payload.permissions ?? [],
      sessionId: payload.sessionId,
      displayName: payload.displayName,
    };
  }
}
