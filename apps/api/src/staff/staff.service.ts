import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

function splitLegalName(legalName: string): { firstName: string; lastName: string | null } {
  const parts = legalName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: legalName, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function staffDisplayName(staff: {
  displayName?: string | null;
  legalName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  user?: { firstName: string; lastName: string | null } | null;
}): string {
  if (staff.displayName?.trim()) return staff.displayName.trim();
  if (staff.legalName?.trim()) return staff.legalName.trim();
  if (staff.firstName?.trim()) {
    return `${staff.firstName} ${staff.lastName ?? ""}`.trim();
  }
  if (staff.user) {
    return `${staff.user.firstName} ${staff.user.lastName ?? ""}`.trim();
  }
  return "Employee";
}

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  private staffInclude = {
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        roleAssignments: { select: { role: true, outletId: true } },
      },
    },
    department: true,
    designation: true,
    reportingManager: {
      select: { id: true, employeeCode: true, displayName: true, legalName: true, firstName: true, lastName: true },
    },
  };

  async createEmployee(
    organizationId: string,
    data: Record<string, unknown>,
    createdById?: string,
  ) {
    const legalName = String(data.legalName ?? "").trim();
    const phone = String(data.phone ?? "").trim();
    if (!legalName) throw new BadRequestException("Legal name is required");
    if (!phone) throw new BadRequestException("Mobile number is required");
    if (!data.dateOfBirth) throw new BadRequestException("Date of birth is required");
    if (!data.gender) throw new BadRequestException("Gender is required");
    if (!data.currentAddress && !data.address) {
      throw new BadRequestException("Current address is required");
    }
    if (!data.permanentAddress) throw new BadRequestException("Permanent address is required");
    if (!data.emergencyContactName) throw new BadRequestException("Emergency contact is required");
    if (!data.emergencyContactRelation) {
      throw new BadRequestException("Emergency contact relationship is required");
    }

    const employeeCode = String(data.employeeCode ?? "").trim();
    if (!employeeCode) throw new BadRequestException("Employee code is required");

    const existing = await this.prisma.staffProfile.findUnique({
      where: { organizationId_employeeCode: { organizationId, employeeCode } },
    });
    if (existing) throw new BadRequestException("Employee code already exists");

    const { firstName, lastName } = splitLegalName(legalName);
    const outletId = data.outletId ? String(data.outletId) : undefined;

    const profile = await this.prisma.staffProfile.create({
      data: {
        organizationId,
        outletId,
        employeeCode,
        legalName,
        firstName,
        lastName,
        displayName: data.displayName ? String(data.displayName) : undefined,
        email: data.email ? String(data.email) : undefined,
        phone,
        dateOfBirth: new Date(String(data.dateOfBirth)),
        gender: String(data.gender),
        bloodGroup: data.bloodGroup ? String(data.bloodGroup) : undefined,
        maritalStatus: data.maritalStatus ? String(data.maritalStatus) : undefined,
        languagesSpoken: Array.isArray(data.languagesSpoken) ? data.languagesSpoken : [],
        profilePhotoUrl: data.profilePhotoUrl ? String(data.profilePhotoUrl) : undefined,
        currentAddress: String(data.currentAddress ?? data.address ?? ""),
        permanentAddress: String(data.permanentAddress),
        address: String(data.currentAddress ?? data.address ?? ""),
        emergencyContactName: String(data.emergencyContactName),
        emergencyContactRelation: String(data.emergencyContactRelation),
        emergencyContact: {
          name: data.emergencyContactName,
          relation: data.emergencyContactRelation,
          phone: data.emergencyContactPhone ?? data.phone,
        },
        employmentCategory: (data.employmentCategory as never) ?? "permanent",
        departmentId: data.departmentId ? String(data.departmentId) : undefined,
        designationId: data.designationId ? String(data.designationId) : undefined,
        reportingManagerId: data.reportingManagerId ? String(data.reportingManagerId) : undefined,
        joinDate: data.joinDate ? new Date(String(data.joinDate)) : new Date(),
        probationEndDate: data.probationEndDate ? new Date(String(data.probationEndDate)) : undefined,
        confirmationDate: data.confirmationDate ? new Date(String(data.confirmationDate)) : undefined,
        contractStartDate: data.contractStartDate ? new Date(String(data.contractStartDate)) : undefined,
        contractEndDate: data.contractEndDate ? new Date(String(data.contractEndDate)) : undefined,
        noticePeriodDays: data.noticePeriodDays ? Number(data.noticePeriodDays) : undefined,
        pan: data.pan ? String(data.pan) : undefined,
        aadhaarLast4: data.aadhaarLast4 ? String(data.aadhaarLast4) : undefined,
        uan: data.uan ? String(data.uan) : undefined,
        pfAccount: data.pfAccount ? String(data.pfAccount) : undefined,
        esicNumber: data.esicNumber ? String(data.esicNumber) : undefined,
        bankName: data.bankName ? String(data.bankName) : undefined,
        bankAccount: data.bankAccount ? String(data.bankAccount) : undefined,
        ifsc: data.ifsc ? String(data.ifsc) : undefined,
        bankAccountType: data.bankAccountType ? String(data.bankAccountType) : undefined,
        salaryPaymentMode: data.salaryPaymentMode ? String(data.salaryPaymentMode) : undefined,
        wageType: (data.wageType as never) ?? "monthly",
        monthlySalary: data.monthlySalary != null ? Number(data.monthlySalary) : undefined,
        hourlyRate: data.hourlyRate != null ? Number(data.hourlyRate) : undefined,
        hasLoginAccess: Boolean(data.hasLoginAccess),
        isActive: data.isActive !== false,
      } as never,
      include: this.staffInclude,
    });

    await this.prisma.employeeTimelineEvent.create({
      data: {
        staffProfileId: profile.id,
        eventType: "joined",
        title: "Joined",
        description: `Employee ${employeeCode} added to the roster`,
        createdById,
        metadata: { outletId, employmentCategory: profile.employmentCategory },
      },
    });

    if (data.isFoodHandler || data.medicalExamDate || data.fostacStatus) {
      await this.prisma.employeeMedicalRecord.upsert({
        where: { staffProfileId: profile.id },
        update: {
          isFoodHandler: Boolean(data.isFoodHandler),
          medicalExamDate: data.medicalExamDate ? new Date(String(data.medicalExamDate)) : undefined,
          fostacStatus: data.fostacStatus ? String(data.fostacStatus) : undefined,
        },
        create: {
          staffProfileId: profile.id,
          isFoodHandler: Boolean(data.isFoodHandler),
          medicalExamDate: data.medicalExamDate ? new Date(String(data.medicalExamDate)) : undefined,
          fostacStatus: data.fostacStatus ? String(data.fostacStatus) : undefined,
        },
      });
    }

    return profile;
  }

  async createProfile(data: {
    userId: string;
    organizationId?: string;
    outletId?: string;
    employeeCode: string;
    wageType?: "hourly" | "monthly";
    hourlyRate?: number;
    monthlySalary?: number;
    displayName?: string;
    phone?: string;
    gender?: string;
    address?: string;
    departmentId?: string;
    designationId?: string;
    pfAccount?: string;
    uan?: string;
    esicNumber?: string;
    bankName?: string;
    bankAccount?: string;
    ifsc?: string;
    emergencyContact?: Record<string, unknown>;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      include: { roleAssignments: data.outletId ? { where: { outletId: data.outletId }, take: 1 } : undefined },
    });
    if (!user) throw new NotFoundException("User not found");

    if (!data.hourlyRate && !data.monthlySalary && data.outletId) {
      const role = user.roleAssignments?.[0]?.role;
      if (role) {
        const rule = await this.prisma.wageRule.findFirst({
          where: { OR: [{ outletId: data.outletId }, { outletId: null }], role },
        });
        if (rule) {
          data.wageType = rule.wageType;
          data.hourlyRate = rule.hourlyRate ? Number(rule.hourlyRate) : undefined;
          data.monthlySalary = rule.monthlySalary ? Number(rule.monthlySalary) : undefined;
        }
      }
    }

    return this.prisma.staffProfile.create({
      data: {
        ...data,
        organizationId: data.organizationId ?? user.organizationId,
        legalName: `${user.firstName} ${user.lastName ?? ""}`.trim(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        hasLoginAccess: true,
      } as never,
      include: this.staffInclude,
    });
  }

  getProfile(id: string) {
    return this.prisma.staffProfile.findUnique({
      where: { id },
      include: {
        ...this.staffInclude,
        timelineEvents: { orderBy: { occurredAt: "desc" }, take: 50 },
        outlet: { select: { id: true, name: true, city: true, state: true } },
      },
    });
  }

  updateProfile(id: string, data: Record<string, unknown>) {
    return this.prisma.staffProfile.update({
      where: { id },
      data: data as never,
      include: this.staffInclude,
    });
  }

  listByOutlet(outletId: string) {
    return this.prisma.staffProfile.findMany({
      where: { outletId, isActive: true },
      include: {
        ...this.staffInclude,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            roleAssignments: { where: { outletId }, select: { role: true } },
          },
        },
      },
      orderBy: { employeeCode: "asc" },
    });
  }

  async resolveStaffProfileId(staffProfileId?: string, userId?: string): Promise<string> {
    if (staffProfileId) return staffProfileId;
    if (!userId) throw new BadRequestException("staffProfileId or userId required");
    const profile = await this.prisma.staffProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException("Staff profile not found for user");
    return profile.id;
  }

  async createShift(data: {
    outletId: string;
    staffProfileId?: string;
    userId?: string;
    startAt: string;
    endAt: string;
    station?: string;
  }) {
    const staffProfileId = await this.resolveStaffProfileId(data.staffProfileId, data.userId);
    return this.prisma.shiftSchedule.create({
      data: {
        outletId: data.outletId,
        staffProfileId,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        station: data.station,
      },
      include: { staff: { include: this.staffInclude } },
    });
  }

  listShifts(outletId: string, from?: string, to?: string) {
    return this.prisma.shiftSchedule.findMany({
      where: {
        outletId,
        ...(from && to ? { startAt: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
      include: { staff: { include: this.staffInclude } },
      orderBy: { startAt: "asc" },
    });
  }

  async clockIn(outletId: string, staffProfileIdOrUserId: string, source = "pos", byUserId = false) {
    const staffProfileId = byUserId
      ? await this.resolveStaffProfileId(undefined, staffProfileIdOrUserId)
      : staffProfileIdOrUserId;
    return this.prisma.attendanceRecord.create({
      data: { outletId, staffProfileId, clockIn: new Date(), source },
    });
  }

  clockOut(recordId: string) {
    return this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { clockOut: new Date() },
    });
  }

  async onFloor(outletId: string) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { outletId, clockOut: null },
      include: {
        staff: {
          include: {
            ...this.staffInclude,
            user: {
              select: {
                firstName: true,
                lastName: true,
                roleAssignments: { where: { outletId }, select: { role: true } },
              },
            },
          },
        },
      },
    });
    return records.map((r) => ({
      id: r.id,
      staffProfileId: r.staffProfileId,
      clockIn: r.clockIn,
      clockOut: r.clockOut,
      source: r.source,
      name: staffDisplayName(r.staff),
      role: r.staff.user?.roleAssignments?.[0]?.role ?? r.staff.designation?.name ?? null,
      hoursWorked: (Date.now() - r.clockIn.getTime()) / 3_600_000,
    }));
  }

  async getAttendanceSummary(outletId: string, date?: string) {
    const day = date ? new Date(date) : new Date();
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);

    const [staff, attendance, leaves, shifts] = await Promise.all([
      this.prisma.staffProfile.findMany({
        where: { outletId, isActive: true },
        include: this.staffInclude,
      }),
      this.prisma.attendanceRecord.findMany({
        where: { outletId, clockIn: { gte: day, lt: next } },
        include: { staff: { include: this.staffInclude } },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          outletId,
          status: "approved",
          startDate: { lte: day },
          endDate: { gte: day },
        },
      }),
      this.prisma.shiftSchedule.findMany({
        where: { outletId, startAt: { gte: day, lt: next } },
      }),
    ]);

    const onLeaveIds = new Set(leaves.map((l) => l.staffProfileId));
    const checkedIn = attendance.filter((a) => !a.clockOut || a.clockOut >= day);
    const checkedInIds = new Set(checkedIn.map((a) => a.staffProfileId));
    const scheduledIds = new Set(shifts.map((s) => s.staffProfileId));

    const notInYet = staff.filter(
      (s) => !checkedInIds.has(s.id) && !onLeaveIds.has(s.id) && scheduledIds.has(s.id),
    );
    const onLeave = staff.filter((s) => onLeaveIds.has(s.id));

    const onFloorNow = checkedIn.filter((a) => !a.clockOut);
    const sourceBreakdown: Record<string, number> = {};
    for (const a of checkedIn) {
      const key = (a.source ?? "manual").toLowerCase();
      sourceBreakdown[key] = (sourceBreakdown[key] ?? 0) + 1;
    }

    return {
      date: day.toISOString(),
      totals: {
        staff: staff.length,
        checkedIn: checkedIn.length,
        onFloor: onFloorNow.length,
        notInYet: notInYet.length,
        onLeave: onLeave.length,
      },
      sourceBreakdown,
      onFloor: onFloorNow.map((a) => ({
        id: a.id,
        staffProfileId: a.staffProfileId,
        name: staffDisplayName(a.staff),
        role: a.staff.designation?.name ?? a.staff.user?.roleAssignments?.[0]?.role ?? null,
        clockIn: a.clockIn,
        source: a.source,
        hoursWorked: (Date.now() - a.clockIn.getTime()) / 3_600_000,
      })),
      checkedIn: checkedIn.map((a) => ({
        id: a.id,
        staffProfileId: a.staffProfileId,
        name: staffDisplayName(a.staff),
        role: a.staff.designation?.name ?? a.staff.user?.roleAssignments?.[0]?.role ?? null,
        clockIn: a.clockIn,
        clockOut: a.clockOut,
        source: a.source,
        isActive: !a.clockOut,
        hoursWorked: a.clockOut
          ? (a.clockOut.getTime() - a.clockIn.getTime()) / 3_600_000
          : (Date.now() - a.clockIn.getTime()) / 3_600_000,
      })),
      notInYet: notInYet.map((s) => ({
        staffProfileId: s.id,
        name: staffDisplayName(s),
        role: s.designation?.name ?? s.user?.roleAssignments?.[0]?.role ?? null,
      })),
      onLeave: onLeave.map((s) => ({
        staffProfileId: s.id,
        name: staffDisplayName(s),
      })),
    };
  }

  async getAttendanceHistory(outletId: string, from?: string, to?: string) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        outletId,
        ...(from && to ? { clockIn: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
      include: { staff: { include: this.staffInclude } },
      orderBy: { clockIn: "desc" },
    });

    return records.map((a) => ({
      id: a.id,
      staffProfileId: a.staffProfileId,
      name: staffDisplayName(a.staff),
      role: a.staff.designation?.name ?? a.staff.user?.roleAssignments?.[0]?.role ?? null,
      clockIn: a.clockIn,
      clockOut: a.clockOut,
      source: a.source,
      isActive: !a.clockOut,
      hoursWorked: a.clockOut
        ? (a.clockOut.getTime() - a.clockIn.getTime()) / 3_600_000
        : (Date.now() - a.clockIn.getTime()) / 3_600_000,
    }));
  }

  listDepartments(organizationId: string) {
    return this.prisma.department.findMany({
      where: { organizationId },
      include: { designations: true, _count: { select: { staff: true } } },
      orderBy: { name: "asc" },
    });
  }

  createDepartment(organizationId: string, name: string) {
    return this.prisma.department.create({ data: { organizationId, name } });
  }

  createDesignation(organizationId: string, name: string, departmentId?: string) {
    return this.prisma.designation.create({ data: { organizationId, name, departmentId } });
  }

  listLeaves(outletId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { outletId },
      include: { staff: { include: this.staffInclude } },
      orderBy: { startDate: "desc" },
    });
  }

  async createLeave(data: {
    staffProfileId?: string;
    userId?: string;
    outletId: string;
    type?: string;
    startDate: string;
    endDate: string;
    reason?: string;
  }) {
    const staffProfileId = await this.resolveStaffProfileId(data.staffProfileId, data.userId);
    return this.prisma.leaveRequest.create({
      data: {
        staffProfileId,
        outletId: data.outletId,
        type: (data.type as never) ?? "casual",
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
      },
      include: { staff: { include: this.staffInclude } },
    });
  }

  updateLeaveStatus(id: string, status: "approved" | "rejected" | "cancelled") {
    return this.prisma.leaveRequest.update({ where: { id }, data: { status } });
  }

  listHolidays(outletId: string) {
    return this.prisma.holiday.findMany({ where: { outletId }, orderBy: { date: "asc" } });
  }

  createHoliday(outletId: string, date: string, name: string) {
    return this.prisma.holiday.create({ data: { outletId, date: new Date(date), name } });
  }

  listTimeline(staffProfileId: string) {
    return this.prisma.employeeTimelineEvent.findMany({
      where: { staffProfileId },
      orderBy: { occurredAt: "desc" },
    });
  }

  async setPin(
    staffProfileId: string,
    organizationId: string,
    pin: string,
    updatedByUserId: string,
  ) {
    const profile = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, organizationId },
    });
    if (!profile) throw new NotFoundException("Staff profile not found");

    const pinHash = await bcrypt.hash(pin, 10);
    await this.prisma.staffProfile.update({
      where: { id: staffProfileId },
      data: {
        pinHash,
        pinSetAt: new Date(),
        pinUpdatedByUserId: updatedByUserId,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });
    return { success: true };
  }

  async revokePin(staffProfileId: string, organizationId: string) {
    const profile = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, organizationId },
    });
    if (!profile) throw new NotFoundException("Staff profile not found");

    await this.prisma.staffProfile.update({
      where: { id: staffProfileId },
      data: {
        pinHash: null,
        pinSetAt: null,
        pinUpdatedByUserId: null,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });
    return { success: true };
  }

  async ensureStaffRoleAssignment(
    staffProfileId: string,
    organizationId: string,
    outletId: string,
    role: UserRole,
  ) {
    return this.prisma.staffRoleAssignment.upsert({
      where: {
        staffProfileId_outletId_role: { staffProfileId, outletId, role },
      },
      update: {},
      create: {
        staffProfileId,
        organizationId,
        outletId,
        role,
        permissions: [],
      },
    });
  }
}
