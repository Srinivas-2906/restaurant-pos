import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  rulePackForState,
  computeThresholds,
  COMPLIANCE_CALENDAR,
  calculateComponentPayslip,
  validateWageRule,
  wagePaymentDueDate,
  canTransitionPayroll,
  deriveWageRuleFromComponents,
  calculateGratuityProvision,
  type SalaryComponentInput,
  type PayrollRunWorkflowStatus,
} from "@kaana/hr-core";

type PrismaDelegate = {
  findMany?: (args?: unknown) => Promise<unknown[]>;
  findFirst?: (args?: unknown) => Promise<unknown | null>;
  findUnique?: (args?: unknown) => Promise<unknown | null>;
  create?: (args?: unknown) => Promise<unknown>;
  update?: (args?: unknown) => Promise<unknown>;
  upsert?: (args?: unknown) => Promise<unknown>;
  count?: (args?: unknown) => Promise<number>;
  aggregate?: (args?: unknown) => Promise<unknown>;
};

@Injectable()
export class HrService {
  constructor(private prisma: PrismaService) {}

  private model(...names: string[]): PrismaDelegate | undefined {
    for (const name of names) {
      const delegate = (this.prisma as unknown as Record<string, unknown>)[name] as
        | PrismaDelegate
        | undefined;
      if (delegate?.findMany || delegate?.findFirst || delegate?.create) return delegate;
    }
    return undefined;
  }

  private async safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }

  private requireDelegate(...names: string[]): PrismaDelegate {
    const delegate = this.model(...names);
    if (!delegate?.findMany && !delegate?.create) {
      throw new BadRequestException(`HR model "${names[0]}" is not available yet`);
    }
    return delegate;
  }

  // ─── Phase 1: Documents ───────────────────────────────────────────────────

  listDocuments(query: {
    staffProfileId?: string;
    outletId?: string;
    expiringWithinDays?: number;
  }) {
    const delegate = this.requireDelegate("employeeDocument");
    const where: Record<string, unknown> = {};
    if (query.staffProfileId) where.staffProfileId = query.staffProfileId;
    if (query.outletId) where.outletId = query.outletId;
    if (query.expiringWithinDays != null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + Number(query.expiringWithinDays));
      where.expiryDate = { lte: cutoff, gte: new Date() };
    }
    return delegate.findMany!({ where, orderBy: { expiryDate: "asc" } });
  }

  createDocument(data: Record<string, unknown>) {
    return this.requireDelegate("employeeDocument").create!({ data: data as never });
  }

  // ─── Phase 1: Shift templates ─────────────────────────────────────────────

  listShiftTemplates(organizationId: string, outletId?: string) {
    const where: Record<string, unknown> = { organizationId };
    if (outletId) where.outletId = outletId;
    return this.requireDelegate("shiftTemplate").findMany!({
      where,
      orderBy: { name: "asc" },
    });
  }

  createShiftTemplate(data: Record<string, unknown>) {
    return this.requireDelegate("shiftTemplate").create!({ data: data as never });
  }

  updateShiftTemplate(id: string, data: Record<string, unknown>) {
    return this.requireDelegate("shiftTemplate").update!({
      where: { id },
      data: data as never,
    });
  }

  // ─── Phase 1: Attendance corrections ──────────────────────────────────────

  listAttendanceCorrections(query: { outletId?: string; staffProfileId?: string; status?: string }) {
    const where: Record<string, unknown> = {};
    if (query.outletId) where.outletId = query.outletId;
    if (query.staffProfileId) where.staffProfileId = query.staffProfileId;
    if (query.status) where.status = query.status;
    return this.safe(async () => {
      const delegate = this.model("attendanceCorrection");
      if (!delegate?.findMany) return [];
      return (await delegate.findMany({ where, orderBy: { createdAt: "desc" } })) as unknown[];
    }, []);
  }

  createAttendanceCorrection(data: Record<string, unknown>) {
    return this.requireDelegate("attendanceCorrection").create!({
      data: { ...data, status: data.status ?? "pending" } as never,
    });
  }

  approveAttendanceCorrection(id: string, approverId: string) {
    return this.requireDelegate("attendanceCorrection").update!({
      where: { id },
      data: {
        status: "approved",
        approvedById: approverId,
        approvedAt: new Date(),
      } as never,
    });
  }

  // ─── Phase 1: Overtime ────────────────────────────────────────────────────

  listOvertimeRequests(query: { outletId?: string; staffProfileId?: string; status?: string }) {
    const where: Record<string, unknown> = {};
    if (query.outletId) where.outletId = query.outletId;
    if (query.staffProfileId) where.staffProfileId = query.staffProfileId;
    if (query.status) where.status = query.status;
    return this.safe(async () => {
      const delegate = this.model("overtimeRequest");
      if (!delegate?.findMany) return [];
      return (await delegate.findMany({ where, orderBy: { createdAt: "desc" } })) as unknown[];
    }, []);
  }

  createOvertimeRequest(data: Record<string, unknown>) {
    return this.requireDelegate("overtimeRequest").create!({
      data: { ...data, status: data.status ?? "pending" } as never,
    });
  }

  approveOvertimeRequest(id: string, approverId: string) {
    return this.requireDelegate("overtimeRequest").update!({
      where: { id },
      data: {
        status: "approved",
        approvedById: approverId,
        approvedAt: new Date(),
      } as never,
    });
  }

  // ─── Phase 1: Leave policies & balances ───────────────────────────────────

  listLeavePolicies(organizationId: string) {
    return this.requireDelegate("leavePolicy").findMany!({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  createLeavePolicy(data: Record<string, unknown>) {
    return this.requireDelegate("leavePolicy").create!({ data: data as never });
  }

  getLeaveBalances(staffProfileId: string) {
    return this.requireDelegate("leaveBalance").findMany!({
      where: { staffProfileId },
    });
  }

  // ─── Phase 1: Employee access stub ────────────────────────────────────────

  async grantEmployeeAccess(staffProfileId: string, createdById?: string) {
    const profile = await this.prisma.staffProfile.findUnique({ where: { id: staffProfileId } });
    if (!profile) throw new NotFoundException("Staff profile not found");

    const updated = await this.prisma.staffProfile.update({
      where: { id: staffProfileId },
      data: { hasLoginAccess: true },
    });

    await this.prisma.employeeTimelineEvent.create({
      data: {
        staffProfileId,
        eventType: "access_invited",
        title: "Login access enabled",
        description: "Employee invited to self-service portal (stub)",
        createdById,
        metadata: { stub: true },
      },
    });

    return { profile: updated, inviteSent: false, message: "Login access flag set; invite email stub" };
  }

  // ─── Phase 2: Salary components ───────────────────────────────────────────

  listSalaryComponents(organizationId: string) {
    return this.requireDelegate("salaryComponent").findMany!({
      where: { organizationId },
      orderBy: { code: "asc" },
    });
  }

  createSalaryComponent(data: Record<string, unknown>) {
    return this.requireDelegate("salaryComponent").create!({ data: data as never });
  }

  // ─── Phase 2: Salary structures ───────────────────────────────────────────

  listSalaryStructures(organizationId: string) {
    return this.requireDelegate("salaryStructure").findMany!({
      where: { organizationId },
      include: { versions: { orderBy: { effectiveFrom: "desc" }, take: 1 } },
    });
  }

  createSalaryStructure(data: Record<string, unknown>) {
    return this.requireDelegate("salaryStructure").create!({ data: data as never });
  }

  createSalaryStructureVersion(structureId: string, data: Record<string, unknown>) {
    return this.requireDelegate("salaryStructureVersion").create!({
      data: { ...data, salaryStructureId: structureId } as never,
    });
  }

  assignSalaryStructure(staffProfileId: string, data: Record<string, unknown>) {
    return this.requireDelegate("employeeSalaryAssignment").create!({
      data: { ...data, staffProfileId } as never,
    });
  }

  // ─── Phase 2: Payroll adjustments ─────────────────────────────────────────

  listPayrollAdjustments(payrollRunId?: string) {
    const where = payrollRunId ? { payrollRunId } : {};
    return this.requireDelegate("payrollAdjustment").findMany!({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  createPayrollAdjustment(data: Record<string, unknown>) {
    return this.requireDelegate("payrollAdjustment").create!({ data: data as never });
  }

  // ─── Phase 2: Loans & advances ────────────────────────────────────────────

  listLoans(query: { staffProfileId?: string; organizationId?: string; status?: string }) {
    const where: Record<string, unknown> = {};
    if (query.staffProfileId) where.staffProfileId = query.staffProfileId;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.status) where.status = query.status;
    return this.requireDelegate("employeeLoan").findMany!({ where, orderBy: { createdAt: "desc" } });
  }

  createLoan(data: Record<string, unknown>) {
    return this.requireDelegate("employeeLoan").create!({ data: data as never });
  }

  listAdvances(query: { staffProfileId?: string; status?: string }) {
    const where: Record<string, unknown> = {};
    if (query.staffProfileId) where.staffProfileId = query.staffProfileId;
    if (query.status) where.status = query.status;
    return this.requireDelegate("salaryAdvance").findMany!({ where, orderBy: { createdAt: "desc" } });
  }

  createAdvance(data: Record<string, unknown>) {
    return this.requireDelegate("salaryAdvance").create!({ data: data as never });
  }

  // ─── Phase 2: Final settlements ───────────────────────────────────────────

  listSettlements(query: { staffProfileId?: string; organizationId?: string }) {
    const where: Record<string, unknown> = {};
    if (query.staffProfileId) where.staffProfileId = query.staffProfileId;
    if (query.organizationId) where.organizationId = query.organizationId;
    return this.requireDelegate("finalSettlement").findMany!({ where, orderBy: { createdAt: "desc" } });
  }

  createSettlement(data: Record<string, unknown>) {
    return this.requireDelegate("finalSettlement").create!({ data: data as never });
  }

  async calculateSettlement(staffProfileId: string, lastWorkingDay: string) {
    const profile = await this.prisma.staffProfile.findUnique({ where: { id: staffProfileId } });
    if (!profile) throw new NotFoundException("Staff profile not found");

    const outlet = profile.outletId
      ? await this.prisma.outlet.findUnique({ where: { id: profile.outletId }, select: { state: true } })
      : null;
    const org = await this.prisma.organization.findUnique({
      where: { id: profile.organizationId },
      select: { state: true },
    });
    const rulePack = rulePackForState(outlet?.state ?? org?.state);

    const monthlySalary = Number(profile.monthlySalary ?? 0);
    const joinDate = profile.joinDate ?? new Date();
    const lastDay = new Date(lastWorkingDay);
    const yearsOfService = Math.max(
      0,
      (lastDay.getTime() - joinDate.getTime()) / (365.25 * 86_400_000),
    );

    const components: SalaryComponentInput[] = [
      { code: "basic", name: "Basic", type: "earning", amount: monthlySalary * 0.5 },
      { code: "da", name: "DA", type: "earning", amount: monthlySalary * 0.1 },
      {
        code: "special",
        name: "Special Allowance",
        type: "earning",
        amount: monthlySalary * 0.4,
      },
    ];
    const wageRule = validateWageRule(deriveWageRuleFromComponents(components));
    const gratuity = calculateGratuityProvision(wageRule.statutoryWage, Math.floor(yearsOfService));

    const payslip = calculateComponentPayslip({
      employeeId: staffProfileId,
      components,
      rulePack,
      pfApplicable: Boolean(profile.pfAccount || profile.uan),
      esiApplicable: Boolean(profile.esicNumber),
      ptApplicable: true,
    });

    return {
      staffProfileId,
      lastWorkingDay,
      yearsOfService: Math.round(yearsOfService * 100) / 100,
      unpaidSalary: payslip.netPay,
      gratuity,
      wageRuleExplanation: wageRule.explanation,
      statutoryWage: wageRule.statutoryWage,
      breakdown: payslip.breakdown,
    };
  }

  // ─── Phase 2: Payroll payments & overview ─────────────────────────────────

  listPayrollPayments(payrollRunId?: string) {
    const where = payrollRunId ? { payrollRunId } : {};
    return this.requireDelegate("payrollPayment").findMany!({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  createPayrollPayment(data: Record<string, unknown>) {
    return this.requireDelegate("payrollPayment").create!({ data: data as never });
  }

  async getPayrollOverview(organizationId: string, outletId?: string) {
    const where: Record<string, unknown> = { organizationId };
    if (outletId) where.outletId = outletId;

    const runs = await this.prisma.payrollRun.findMany({
      where,
      orderBy: { periodStart: "desc" },
      take: 6,
      include: { payslips: true },
    });

    const latest = runs[0];
    const currentStatus = (latest?.status ?? "not_started") as PayrollRunWorkflowStatus;
    const dueDate = latest
      ? wagePaymentDueDate(latest.periodEnd)
      : wagePaymentDueDate(new Date());

    const pendingApprovals = await this.safe(
      () =>
        this.requireDelegate("payrollApproval").count!({
          where: { status: "pending", payrollRun: { organizationId } },
        }),
      0,
    );

    return {
      recentRuns: runs,
      currentRunStatus: currentStatus,
      allowedTransitions: ["draft", "pending_approval", "approved", "paid"].filter((s) =>
        canTransitionPayroll(currentStatus, s as PayrollRunWorkflowStatus),
      ),
      wagePaymentDueDate: dueDate,
      pendingApprovals,
    };
  }

  // ─── Phase 3: Compliance ──────────────────────────────────────────────────

  listComplianceJurisdictions(organizationId: string) {
    return this.requireDelegate("complianceJurisdiction").findMany!({
      where: { organizationId },
    });
  }

  createComplianceJurisdiction(data: Record<string, unknown>) {
    return this.requireDelegate("complianceJurisdiction").create!({ data: data as never });
  }

  listComplianceRegistrations(query: { organizationId?: string; outletId?: string }) {
    const where: Record<string, unknown> = {};
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.outletId) where.outletId = query.outletId;
    return this.requireDelegate("complianceRegistration").findMany!({ where });
  }

  createComplianceRegistration(data: Record<string, unknown>) {
    return this.requireDelegate("complianceRegistration").create!({ data: data as never });
  }

  getComplianceCalendar() {
    return COMPLIANCE_CALENDAR;
  }

  async getComplianceDashboard(organizationId: string, outletId?: string) {
    const staffWhere: Record<string, unknown> = { organizationId, isActive: true };
    if (outletId) staffWhere.outletId = outletId;

    const employeeCount = await this.prisma.staffProfile.count({ where: staffWhere });

    const contractWorkerCount = await this.safe(
      () =>
        this.requireDelegate("contractWorker").count!({
          where: { ...(outletId ? { outletId } : {}), isActive: true },
        }),
      0,
    );

    const appointmentLettersIssued = await this.safe(
      () =>
        this.requireDelegate("employeeDocument").count!({
          where: {
            documentType: "appointment_letter",
            staffProfile: staffWhere,
          },
        }),
      0,
    );

    const medicalTotal = await this.safe(
      () =>
        this.requireDelegate("employeeMedicalRecord").count!({
          where: { staffProfile: staffWhere },
        }),
      0,
    );
    const medicalValid = await this.safe(
      () =>
        this.requireDelegate("employeeMedicalRecord").count!({
          where: {
            staffProfile: staffWhere,
            validUntil: { gte: new Date() },
          },
        }),
      0,
    );
    const foodHandlerCompliancePct =
      medicalTotal > 0 ? (medicalValid / medicalTotal) * 100 : 100;

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { state: true },
    });
    const rulePack = rulePackForState(org?.state);

    return {
      thresholds: computeThresholds({
        employeeCount,
        contractWorkerCount,
        appointmentLettersIssued,
        foodHandlerCompliancePct,
      }),
      rulePack,
      employeeCount,
      contractWorkerCount,
    };
  }

  // ─── Phase 3: Statutory enrollments ───────────────────────────────────────

  getPfEnrollment(staffProfileId: string) {
    return this.requireDelegate("pfEnrollment", "pFEnrollment").findFirst!({
      where: { staffProfileId },
    });
  }

  upsertPfEnrollment(staffProfileId: string, data: Record<string, unknown>) {
    const delegate = this.requireDelegate("pfEnrollment", "pFEnrollment");
    if (delegate.upsert) {
      return delegate.upsert({
        where: { staffProfileId },
        create: { ...data, staffProfileId } as never,
        update: data as never,
      });
    }
    return delegate.create!({ data: { ...data, staffProfileId } as never });
  }

  getEsiEnrollment(staffProfileId: string) {
    return this.requireDelegate("esiEnrollment", "eSIEnrollment").findFirst!({
      where: { staffProfileId },
    });
  }

  upsertEsiEnrollment(staffProfileId: string, data: Record<string, unknown>) {
    const delegate = this.requireDelegate("esiEnrollment", "eSIEnrollment");
    if (delegate.upsert) {
      return delegate.upsert({
        where: { staffProfileId },
        create: { ...data, staffProfileId } as never,
        update: data as never,
      });
    }
    return delegate.create!({ data: { ...data, staffProfileId } as never });
  }

  getGratuityRecord(staffProfileId: string) {
    return this.requireDelegate("gratuityRecord").findFirst!({ where: { staffProfileId } });
  }

  upsertGratuityRecord(staffProfileId: string, data: Record<string, unknown>) {
    const delegate = this.requireDelegate("gratuityRecord");
    if (delegate.upsert) {
      return delegate.upsert({
        where: { staffProfileId },
        create: { ...data, staffProfileId } as never,
        update: data as never,
      });
    }
    return delegate.create!({ data: { ...data, staffProfileId } as never });
  }

  // ─── Phase 4: Medical records ─────────────────────────────────────────────

  getMedicalRecord(staffProfileId: string) {
    return this.requireDelegate("employeeMedicalRecord").findFirst!({
      where: { staffProfileId },
      orderBy: { examinedAt: "desc" },
    });
  }

  upsertMedicalRecord(staffProfileId: string, data: Record<string, unknown>) {
    const delegate = this.requireDelegate("employeeMedicalRecord");
    return delegate.create!({ data: { ...data, staffProfileId } as never });
  }

  // ─── Phase 4: Contractors ─────────────────────────────────────────────────

  listContractors(organizationId: string) {
    return this.requireDelegate("contractor").findMany!({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  createContractor(data: Record<string, unknown>) {
    return this.requireDelegate("contractor").create!({ data: data as never });
  }

  listContractAgreements(query: { contractorId?: string; organizationId?: string }) {
    const where: Record<string, unknown> = {};
    if (query.contractorId) where.contractorId = query.contractorId;
    if (query.organizationId) where.organizationId = query.organizationId;
    return this.requireDelegate("contractAgreement").findMany!({ where });
  }

  createContractAgreement(data: Record<string, unknown>) {
    return this.requireDelegate("contractAgreement").create!({ data: data as never });
  }

  listContractWorkers(query: { contractorId?: string; outletId?: string }) {
    const where: Record<string, unknown> = {};
    if (query.contractorId) where.contractorId = query.contractorId;
    if (query.outletId) where.outletId = query.outletId;
    return this.requireDelegate("contractWorker").findMany!({ where });
  }

  createContractWorker(data: Record<string, unknown>) {
    return this.requireDelegate("contractWorker").create!({ data: data as never });
  }

  // ─── Phase 4: Tips ────────────────────────────────────────────────────────

  listTipPools(query: { outletId?: string; periodStart?: string }) {
    const where: Record<string, unknown> = {};
    if (query.outletId) where.outletId = query.outletId;
    if (query.periodStart) where.periodStart = new Date(query.periodStart);
    return this.requireDelegate("tipPool").findMany!({ where, orderBy: { periodStart: "desc" } });
  }

  createTipPool(data: Record<string, unknown>) {
    return this.requireDelegate("tipPool").create!({ data: data as never });
  }

  distributeTips(tipPoolId: string, distributions: Array<Record<string, unknown>>) {
    const delegate = this.requireDelegate("tipDistribution");
    return Promise.all(
      distributions.map((d) =>
        delegate.create!({ data: { ...d, tipPoolId } as never }),
      ),
    );
  }

  // ─── Phase 4: Assets ──────────────────────────────────────────────────────

  listAssets(query: { staffProfileId?: string; outletId?: string; status?: string }) {
    const where: Record<string, unknown> = {};
    if (query.staffProfileId) where.staffProfileId = query.staffProfileId;
    if (query.outletId) where.outletId = query.outletId;
    if (query.status) where.status = query.status;
    return this.requireDelegate("employeeAsset").findMany!({ where });
  }

  createAsset(data: Record<string, unknown>) {
    return this.requireDelegate("employeeAsset").create!({ data: data as never });
  }

  // ─── Phase 5: Self-service ────────────────────────────────────────────────

  async getSelfServiceProfile(userId: string) {
    const baseInclude = {
      department: true,
      designation: true,
      outlet: { select: { id: true, name: true, city: true } },
    };
    const profile = await this.safe(
      () =>
        this.prisma.staffProfile.findUnique({
          where: { userId },
          include: {
            ...baseInclude,
            leaveBalances: true,
            documents: { take: 20, orderBy: { expiryDate: "asc" } },
          } as never,
        }),
      null,
    );
    if (profile) return profile;

    const fallback = await this.prisma.staffProfile.findUnique({
      where: { userId },
      include: baseInclude,
    });
    if (!fallback) throw new NotFoundException("No staff profile linked to this user");
    return fallback;
  }

  // ─── Phase 5: Grievances ──────────────────────────────────────────────────

  listGrievances(query: { outletId?: string; staffProfileId?: string; status?: string }) {
    const where: Record<string, unknown> = {};
    if (query.outletId) where.outletId = query.outletId;
    if (query.staffProfileId) where.staffProfileId = query.staffProfileId;
    if (query.status) where.status = query.status;
    return this.requireDelegate("grievanceCase").findMany!({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  createGrievance(data: Record<string, unknown>) {
    return this.requireDelegate("grievanceCase").create!({
      data: { ...data, status: data.status ?? "open" } as never,
    });
  }

  // ─── Phase 5: POSH committees ─────────────────────────────────────────────

  listPoshCommittees(organizationId: string) {
    return this.requireDelegate("poshCommittee", "pOSHCommittee").findMany!({
      where: { organizationId },
    });
  }

  createPoshCommittee(data: Record<string, unknown>) {
    return this.requireDelegate("poshCommittee", "pOSHCommittee").create!({
      data: data as never,
    });
  }

  // ─── Phase 5: Analytics ───────────────────────────────────────────────────

  async getLabourCostAnalytics(organizationId: string, outletId?: string) {
    const staffWhere: Record<string, unknown> = { organizationId, isActive: true };
    if (outletId) staffWhere.outletId = outletId;

    const staff = await this.prisma.staffProfile.findMany({
      where: staffWhere,
      select: { id: true, monthlySalary: true, hourlyRate: true, wageType: true },
    });

    const monthlyHeadcount = staff.length;
    const estimatedMonthlyCost = staff.reduce((sum, s) => {
      if (s.wageType === "monthly") return sum + Number(s.monthlySalary ?? 0);
      return sum + Number(s.hourlyRate ?? 0) * 176;
    }, 0);

    const recentRun = await this.prisma.payrollRun.findFirst({
      where: { organizationId, ...(outletId ? { outletId } : {}) },
      orderBy: { periodStart: "desc" },
    });

    return {
      monthlyHeadcount,
      estimatedMonthlyCost: Math.round(estimatedMonthlyCost * 100) / 100,
      lastPayrollRun: recentRun,
      avgCostPerEmployee:
        monthlyHeadcount > 0
          ? Math.round((estimatedMonthlyCost / monthlyHeadcount) * 100) / 100
          : 0,
    };
  }

  async getOvertimeRiskAnalytics(organizationId: string, outletId?: string) {
    const pending = await this.safe(
      () =>
        this.requireDelegate("overtimeRequest").count!({
          where: {
            status: "pending",
            staffProfile: { organizationId, ...(outletId ? { outletId } : {}) },
          },
        }),
      0,
    );
    const approvedThisMonth = await this.safe(
      () =>
        this.requireDelegate("overtimeRequest").count!({
          where: {
            status: "approved",
            approvedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            staffProfile: { organizationId, ...(outletId ? { outletId } : {}) },
          },
        }),
      0,
    );
    return {
      pendingRequests: pending,
      approvedThisMonth,
      riskLevel: pending > 10 ? "high" : pending > 3 ? "medium" : "low",
    };
  }

  async getComplianceScore(organizationId: string, outletId?: string) {
    const dashboard = await this.getComplianceDashboard(organizationId, outletId);
    const met = dashboard.thresholds.filter((t) => t.met).length;
    const total = dashboard.thresholds.length;
    const score = total > 0 ? Math.round((met / total) * 100) : 100;
    return {
      score,
      met,
      total,
      thresholds: dashboard.thresholds,
    };
  }
}
