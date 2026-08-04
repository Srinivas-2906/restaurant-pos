import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByOrganization(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true,
        isActive: true, lastLoginAt: true, roleAssignments: { include: { outlet: true } },
      },
    });
  }

  async create(organizationId: string, data: {
    email: string; password: string; firstName: string; lastName?: string;
    phone?: string; role: string; outletId?: string;
  }) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        organizationId,
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      },
    });

    await this.prisma.roleAssignment.create({
      data: {
        userId: user.id,
        organizationId,
        outletId: data.outletId,
        role: data.role as never,
      },
    });

    return user;
  }
}
