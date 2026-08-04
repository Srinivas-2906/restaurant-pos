import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FranchiseService {
  constructor(private prisma: PrismaService) {}

  recordAudit(data: { outletId: string; score: number; findings?: unknown[]; auditorId?: string }) {
    return this.prisma.franchiseAudit.create({
      data: { outletId: data.outletId, score: data.score, findings: (data.findings ?? []) as never, auditorId: data.auditorId },
    });
  }

  listAudits(outletId: string) {
    return this.prisma.franchiseAudit.findMany({ where: { outletId }, orderBy: { auditedAt: "desc" } });
  }

  createSop(data: { title: string; version: string; content: string }) {
    return this.prisma.sopVersion.create({ data });
  }

  listSops() {
    return this.prisma.sopVersion.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } });
  }

  compareOutlets(organizationId: string) {
    return this.prisma.outlet.findMany({
      where: { brand: { organizationId } },
      select: { id: true, name: true, city: true, franchiseAudits: { orderBy: { auditedAt: "desc" }, take: 1 } },
    });
  }
}
