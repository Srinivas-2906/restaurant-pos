import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuditAction } from "@prisma/client";

const SENSITIVE_METADATA_KEYS = new Set([
  "pin",
  "password",
  "passwordhash",
  "devicesecret",
  "devicecredential",
  "activationcode",
  "accesstoken",
  "refreshtoken",
  "token",
  "jwt",
  "bearertoken",
  "pinhash",
]);

function sanitizeMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeMetadata);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_METADATA_KEYS.has(key.toLowerCase())) continue;
      out[key] = sanitizeMetadata(nested);
    }
    return out;
  }
  return value;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    organizationId: string;
    userId?: string;
    outletId?: string;
    action: AuditAction;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    const metadata = sanitizeMetadata(data.metadata ?? {}) as Record<string, unknown>;
    return this.prisma.auditLog.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        outletId: data.outletId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: metadata as never,
        ipAddress: data.ipAddress,
      },
    });
  }

  async findByOrganization(organizationId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
  }
}
