import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { JwtPayload } from "@kaana/shared-types";
import { PrismaService } from "../prisma/prisma.service";

export type IssueTokenInput = {
  payload: JwtPayload;
  refreshUserId?: string;
};

@Injectable()
export class TokenService {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async issueTokens(input: IssueTokenInput) {
    const sessionPayload: JwtPayload = {
      ...input.payload,
      sessionId: input.payload.sessionId ?? randomUUID(),
    };

    const isOperational = sessionPayload.authMode === "operational";
    const accessToken = this.jwt.sign(sessionPayload, {
      expiresIn: isOperational
        ? this.config.get("JWT_OPERATIONAL_EXPIRES_IN", "8h")
        : this.config.get("JWT_EXPIRES_IN", "15m"),
    });

    let refreshToken: string | undefined;
    if (input.refreshUserId) {
      refreshToken = await this.createRefreshToken(input.refreshUserId);
    }

    return { accessToken, refreshToken, sessionId: sessionPayload.sessionId };
  }

  private async createRefreshToken(userId: string) {
    const token = this.jwt.sign(
      { sub: userId },
      {
        secret: this.config.get("JWT_REFRESH_SECRET"),
        expiresIn: this.config.get("JWT_REFRESH_EXPIRES_IN", "7d"),
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return token;
  }
}
