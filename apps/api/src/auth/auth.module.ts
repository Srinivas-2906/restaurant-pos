import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { RolesGuard } from "./roles.guard";
import { PermissionsGuard } from "./permissions.guard";
import { TerminalAuthGuard } from "./terminal-auth.guard";
import { OperationalAuthService } from "./operational-auth.service";
import { OperationalAuthController } from "./operational-auth.controller";
import { TokenService } from "./token.service";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get("JWT_SECRET", "dev-secret"),
        signOptions: { expiresIn: config.get("JWT_EXPIRES_IN", "15m") },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, OperationalAuthController],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    PermissionsGuard,
    TerminalAuthGuard,
    OperationalAuthService,
    TokenService,
  ],
  exports: [
    AuthService,
    JwtModule,
    RolesGuard,
    PermissionsGuard,
    TerminalAuthGuard,
    OperationalAuthService,
    TokenService,
  ],
})
export class AuthModule {}
