import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard, Roles } from "../auth/guards";
import { HrService } from "./hr.service";

type AuthRequest = { user: { id: string; organizationId: string } };

@ApiTags("hr")
@Controller("hr")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HrController {
  constructor(private hrService: HrService) {}

  // ─── Phase 1: Documents ───────────────────────────────────────────────────

  @Get("documents")
  @Roles("manager", "owner", "accountant")
  listDocuments(
    @Query("staffProfileId") staffProfileId?: string,
    @Query("outletId") outletId?: string,
    @Query("expiringWithinDays") expiringWithinDays?: string,
  ) {
    return this.hrService.listDocuments({
      staffProfileId,
      outletId,
      expiringWithinDays: expiringWithinDays ? Number(expiringWithinDays) : undefined,
    });
  }

  @Post("documents")
  @Roles("manager", "owner")
  createDocument(@Body() body: Record<string, unknown>) {
    return this.hrService.createDocument(body);
  }

  // ─── Phase 1: Shift templates ───────────────────────────────────────────

  @Get("shift-templates")
  @Roles("manager", "owner")
  listShiftTemplates(
    @Request() req: AuthRequest,
    @Query("outletId") outletId?: string,
  ) {
    return this.hrService.listShiftTemplates(req.user.organizationId, outletId);
  }

  @Post("shift-templates")
  @Roles("manager", "owner")
  createShiftTemplate(
    @Request() req: AuthRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hrService.createShiftTemplate({
      ...body,
      organizationId: req.user.organizationId,
    });
  }

  @Patch("shift-templates/:id")
  @Roles("manager", "owner")
  updateShiftTemplate(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.hrService.updateShiftTemplate(id, body);
  }

  // ─── Phase 1: Attendance corrections ────────────────────────────────────

  @Get("attendance-corrections")
  @Roles("manager", "owner", "accountant")
  listAttendanceCorrections(
    @Query("outletId") outletId?: string,
    @Query("staffProfileId") staffProfileId?: string,
    @Query("status") status?: string,
  ) {
    return this.hrService.listAttendanceCorrections({ outletId, staffProfileId, status });
  }

  @Post("attendance-corrections")
  @Roles("manager", "owner", "biller", "captain", "chef")
  createAttendanceCorrection(@Body() body: Record<string, unknown>) {
    return this.hrService.createAttendanceCorrection(body);
  }

  @Patch("attendance-corrections/:id/approve")
  @Roles("manager", "owner")
  approveAttendanceCorrection(@Param("id") id: string, @Request() req: AuthRequest) {
    return this.hrService.approveAttendanceCorrection(id, req.user.id);
  }

  // ─── Phase 1: Overtime ────────────────────────────────────────────────────

  @Get("overtime")
  @Roles("manager", "owner", "accountant")
  listOvertime(
    @Query("outletId") outletId?: string,
    @Query("staffProfileId") staffProfileId?: string,
    @Query("status") status?: string,
  ) {
    return this.hrService.listOvertimeRequests({ outletId, staffProfileId, status });
  }

  @Post("overtime")
  @Roles("manager", "owner", "biller", "captain", "chef")
  createOvertime(@Body() body: Record<string, unknown>) {
    return this.hrService.createOvertimeRequest(body);
  }

  @Patch("overtime/:id/approve")
  @Roles("manager", "owner")
  approveOvertime(@Param("id") id: string, @Request() req: AuthRequest) {
    return this.hrService.approveOvertimeRequest(id, req.user.id);
  }

  // ─── Phase 1: Leave policies & balances ───────────────────────────────────

  @Get("leave-policies")
  @Roles("manager", "owner", "accountant")
  listLeavePolicies(@Request() req: AuthRequest) {
    return this.hrService.listLeavePolicies(req.user.organizationId);
  }

  @Post("leave-policies")
  @Roles("manager", "owner")
  createLeavePolicy(
    @Request() req: AuthRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hrService.createLeavePolicy({
      ...body,
      organizationId: req.user.organizationId,
    });
  }

  @Get("leave-balances/:staffProfileId")
  @Roles("manager", "owner", "accountant", "biller", "captain", "chef")
  getLeaveBalances(@Param("staffProfileId") staffProfileId: string) {
    return this.hrService.getLeaveBalances(staffProfileId);
  }

  // ─── Phase 1: Employee access ───────────────────────────────────────────

  @Post("employees/:id/access")
  @Roles("manager", "owner")
  grantEmployeeAccess(@Param("id") id: string, @Request() req: AuthRequest) {
    return this.hrService.grantEmployeeAccess(id, req.user.id);
  }

  // ─── Phase 2: Salary components ───────────────────────────────────────────

  @Get("salary-components")
  @Roles("accountant", "owner", "manager")
  listSalaryComponents(@Request() req: AuthRequest) {
    return this.hrService.listSalaryComponents(req.user.organizationId);
  }

  @Post("salary-components")
  @Roles("accountant", "owner")
  createSalaryComponent(
    @Request() req: AuthRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hrService.createSalaryComponent({
      ...body,
      organizationId: req.user.organizationId,
    });
  }

  // ─── Phase 2: Salary structures ───────────────────────────────────────────

  @Get("salary-structures")
  @Roles("accountant", "owner", "manager")
  listSalaryStructures(@Request() req: AuthRequest) {
    return this.hrService.listSalaryStructures(req.user.organizationId);
  }

  @Post("salary-structures")
  @Roles("accountant", "owner")
  createSalaryStructure(
    @Request() req: AuthRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hrService.createSalaryStructure({
      ...body,
      organizationId: req.user.organizationId,
    });
  }

  @Post("salary-structures/:id/versions")
  @Roles("accountant", "owner")
  createSalaryStructureVersion(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hrService.createSalaryStructureVersion(id, body);
  }

  @Post("salary-structures/:id/assign")
  @Roles("accountant", "owner")
  assignSalaryStructure(
    @Param("id") structureId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hrService.assignSalaryStructure(String(body.staffProfileId), {
      ...body,
      salaryStructureId: structureId,
    });
  }

  // ─── Phase 2: Payroll adjustments ─────────────────────────────────────────

  @Get("payroll-adjustments")
  @Roles("accountant", "owner", "manager")
  listPayrollAdjustments(@Query("payrollRunId") payrollRunId?: string) {
    return this.hrService.listPayrollAdjustments(payrollRunId);
  }

  @Post("payroll-adjustments")
  @Roles("accountant", "owner")
  createPayrollAdjustment(@Body() body: Record<string, unknown>) {
    return this.hrService.createPayrollAdjustment(body);
  }

  // ─── Phase 2: Loans & advances ────────────────────────────────────────────

  @Get("loans")
  @Roles("accountant", "owner", "manager")
  listLoans(
    @Request() req: AuthRequest,
    @Query("staffProfileId") staffProfileId?: string,
    @Query("status") status?: string,
  ) {
    return this.hrService.listLoans({
      staffProfileId,
      organizationId: req.user.organizationId,
      status,
    });
  }

  @Post("loans")
  @Roles("accountant", "owner")
  createLoan(@Body() body: Record<string, unknown>) {
    return this.hrService.createLoan(body);
  }

  @Get("advances")
  @Roles("accountant", "owner", "manager")
  listAdvances(
    @Query("staffProfileId") staffProfileId?: string,
    @Query("status") status?: string,
  ) {
    return this.hrService.listAdvances({ staffProfileId, status });
  }

  @Post("advances")
  @Roles("accountant", "owner", "manager")
  createAdvance(@Body() body: Record<string, unknown>) {
    return this.hrService.createAdvance(body);
  }

  // ─── Phase 2: Settlements ─────────────────────────────────────────────────

  @Get("settlements")
  @Roles("accountant", "owner", "manager")
  listSettlements(
    @Request() req: AuthRequest,
    @Query("staffProfileId") staffProfileId?: string,
  ) {
    return this.hrService.listSettlements({
      staffProfileId,
      organizationId: req.user.organizationId,
    });
  }

  @Post("settlements")
  @Roles("accountant", "owner")
  createSettlement(@Body() body: Record<string, unknown>) {
    return this.hrService.createSettlement(body);
  }

  @Post("settlements/calculate")
  @Roles("accountant", "owner", "manager")
  calculateSettlement(
    @Body() body: { staffProfileId: string; lastWorkingDay: string },
  ) {
    return this.hrService.calculateSettlement(body.staffProfileId, body.lastWorkingDay);
  }

  // ─── Phase 2: Payroll payments & overview ─────────────────────────────────

  @Get("payroll-payments")
  @Roles("accountant", "owner", "manager")
  listPayrollPayments(@Query("payrollRunId") payrollRunId?: string) {
    return this.hrService.listPayrollPayments(payrollRunId);
  }

  @Post("payroll-payments")
  @Roles("accountant", "owner")
  createPayrollPayment(@Body() body: Record<string, unknown>) {
    return this.hrService.createPayrollPayment(body);
  }

  @Get("payroll-overview")
  @Roles("accountant", "owner", "manager")
  getPayrollOverview(
    @Request() req: AuthRequest,
    @Query("outletId") outletId?: string,
  ) {
    return this.hrService.getPayrollOverview(req.user.organizationId, outletId);
  }

  // ─── Phase 3: Compliance ──────────────────────────────────────────────────

  @Get("compliance/jurisdictions")
  @Roles("owner", "accountant", "manager")
  listComplianceJurisdictions(@Request() req: AuthRequest) {
    return this.hrService.listComplianceJurisdictions(req.user.organizationId);
  }

  @Post("compliance/jurisdictions")
  @Roles("owner", "accountant")
  createComplianceJurisdiction(
    @Request() req: AuthRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hrService.createComplianceJurisdiction({
      ...body,
      organizationId: req.user.organizationId,
    });
  }

  @Get("compliance/registrations")
  @Roles("owner", "accountant", "manager")
  listComplianceRegistrations(
    @Request() req: AuthRequest,
    @Query("outletId") outletId?: string,
  ) {
    return this.hrService.listComplianceRegistrations({
      organizationId: req.user.organizationId,
      outletId,
    });
  }

  @Post("compliance/registrations")
  @Roles("owner", "accountant")
  createComplianceRegistration(
    @Request() req: AuthRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hrService.createComplianceRegistration({
      ...body,
      organizationId: req.user.organizationId,
    });
  }

  @Get("compliance/dashboard")
  @Roles("owner", "accountant", "manager")
  getComplianceDashboard(
    @Request() req: AuthRequest,
    @Query("outletId") outletId?: string,
  ) {
    return this.hrService.getComplianceDashboard(req.user.organizationId, outletId);
  }

  @Get("compliance/calendar")
  @Roles("owner", "accountant", "manager")
  getComplianceCalendar() {
    return this.hrService.getComplianceCalendar();
  }

  // ─── Phase 3: Statutory ───────────────────────────────────────────────────

  @Get("statutory/pf/:staffProfileId")
  @Roles("accountant", "owner", "manager")
  getPfEnrollment(@Param("staffProfileId") staffProfileId: string) {
    return this.hrService.getPfEnrollment(staffProfileId);
  }

  @Post("statutory/pf/:staffProfileId")
  @Roles("accountant", "owner")
  upsertPfEnrollment(
    @Param("staffProfileId") staffProfileId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hrService.upsertPfEnrollment(staffProfileId, body);
  }

  @Get("statutory/esi/:staffProfileId")
  @Roles("accountant", "owner", "manager")
  getEsiEnrollment(@Param("staffProfileId") staffProfileId: string) {
    return this.hrService.getEsiEnrollment(staffProfileId);
  }

  @Post("statutory/esi/:staffProfileId")
  @Roles("accountant", "owner")
  upsertEsiEnrollment(
    @Param("staffProfileId") staffProfileId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hrService.upsertEsiEnrollment(staffProfileId, body);
  }

  @Get("statutory/gratuity/:staffProfileId")
  @Roles("accountant", "owner", "manager")
  getGratuityRecord(@Param("staffProfileId") staffProfileId: string) {
    return this.hrService.getGratuityRecord(staffProfileId);
  }

  @Post("statutory/gratuity/:staffProfileId")
  @Roles("accountant", "owner")
  upsertGratuityRecord(
    @Param("staffProfileId") staffProfileId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hrService.upsertGratuityRecord(staffProfileId, body);
  }

  // ─── Phase 4: Medical ─────────────────────────────────────────────────────

  @Get("medical/:staffProfileId")
  @Roles("manager", "owner", "accountant")
  getMedicalRecord(@Param("staffProfileId") staffProfileId: string) {
    return this.hrService.getMedicalRecord(staffProfileId);
  }

  @Put("medical/:staffProfileId")
  @Roles("manager", "owner")
  upsertMedicalRecord(
    @Param("staffProfileId") staffProfileId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hrService.upsertMedicalRecord(staffProfileId, body);
  }

  // ─── Phase 4: Contractors ─────────────────────────────────────────────────

  @Get("contractors")
  @Roles("manager", "owner", "accountant")
  listContractors(@Request() req: AuthRequest) {
    return this.hrService.listContractors(req.user.organizationId);
  }

  @Post("contractors")
  @Roles("manager", "owner")
  createContractor(
    @Request() req: AuthRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hrService.createContractor({
      ...body,
      organizationId: req.user.organizationId,
    });
  }

  @Get("contract-agreements")
  @Roles("manager", "owner", "accountant")
  listContractAgreements(
    @Request() req: AuthRequest,
    @Query("contractorId") contractorId?: string,
  ) {
    return this.hrService.listContractAgreements({
      contractorId,
      organizationId: req.user.organizationId,
    });
  }

  @Post("contract-agreements")
  @Roles("manager", "owner")
  createContractAgreement(@Body() body: Record<string, unknown>) {
    return this.hrService.createContractAgreement(body);
  }

  @Get("contract-workers")
  @Roles("manager", "owner", "accountant")
  listContractWorkers(
    @Query("contractorId") contractorId?: string,
    @Query("outletId") outletId?: string,
  ) {
    return this.hrService.listContractWorkers({ contractorId, outletId });
  }

  @Post("contract-workers")
  @Roles("manager", "owner")
  createContractWorker(@Body() body: Record<string, unknown>) {
    return this.hrService.createContractWorker(body);
  }

  // ─── Phase 4: Tips ────────────────────────────────────────────────────────

  @Get("tips/pools")
  @Roles("manager", "owner", "accountant")
  listTipPools(
    @Query("outletId") outletId?: string,
    @Query("periodStart") periodStart?: string,
  ) {
    return this.hrService.listTipPools({ outletId, periodStart });
  }

  @Post("tips/pools")
  @Roles("manager", "owner")
  createTipPool(@Body() body: Record<string, unknown>) {
    return this.hrService.createTipPool(body);
  }

  @Post("tips/pools/:id/distribute")
  @Roles("manager", "owner")
  distributeTips(
    @Param("id") id: string,
    @Body() body: { distributions: Array<Record<string, unknown>> },
  ) {
    return this.hrService.distributeTips(id, body.distributions ?? []);
  }

  // ─── Phase 4: Assets ──────────────────────────────────────────────────────

  @Get("assets")
  @Roles("manager", "owner", "accountant")
  listAssets(
    @Query("staffProfileId") staffProfileId?: string,
    @Query("outletId") outletId?: string,
    @Query("status") status?: string,
  ) {
    return this.hrService.listAssets({ staffProfileId, outletId, status });
  }

  @Post("assets")
  @Roles("manager", "owner")
  createAsset(@Body() body: Record<string, unknown>) {
    return this.hrService.createAsset(body);
  }

  // ─── Phase 5: Self-service ────────────────────────────────────────────────

  @Get("self-service/me")
  @Roles("manager", "owner", "accountant", "biller", "captain", "chef", "inventory_manager")
  getSelfServiceProfile(@Request() req: AuthRequest) {
    return this.hrService.getSelfServiceProfile(req.user.id);
  }

  // ─── Phase 5: Grievances ──────────────────────────────────────────────────

  @Get("grievances")
  @Roles("manager", "owner")
  listGrievances(
    @Query("outletId") outletId?: string,
    @Query("staffProfileId") staffProfileId?: string,
    @Query("status") status?: string,
  ) {
    return this.hrService.listGrievances({ outletId, staffProfileId, status });
  }

  @Post("grievances")
  @Roles("manager", "owner", "biller", "captain", "chef")
  createGrievance(@Body() body: Record<string, unknown>) {
    return this.hrService.createGrievance(body);
  }

  // ─── Phase 5: POSH ────────────────────────────────────────────────────────

  @Get("posh/committees")
  @Roles("owner", "manager")
  listPoshCommittees(@Request() req: AuthRequest) {
    return this.hrService.listPoshCommittees(req.user.organizationId);
  }

  @Post("posh/committees")
  @Roles("owner")
  createPoshCommittee(
    @Request() req: AuthRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hrService.createPoshCommittee({
      ...body,
      organizationId: req.user.organizationId,
    });
  }

  // ─── Phase 5: Analytics ───────────────────────────────────────────────────

  @Get("analytics/labour-cost")
  @Roles("owner", "accountant", "manager")
  getLabourCostAnalytics(
    @Request() req: AuthRequest,
    @Query("outletId") outletId?: string,
  ) {
    return this.hrService.getLabourCostAnalytics(req.user.organizationId, outletId);
  }

  @Get("analytics/overtime-risk")
  @Roles("owner", "accountant", "manager")
  getOvertimeRiskAnalytics(
    @Request() req: AuthRequest,
    @Query("outletId") outletId?: string,
  ) {
    return this.hrService.getOvertimeRiskAnalytics(req.user.organizationId, outletId);
  }

  @Get("analytics/compliance-score")
  @Roles("owner", "accountant", "manager")
  getComplianceScore(
    @Request() req: AuthRequest,
    @Query("outletId") outletId?: string,
  ) {
    return this.hrService.getComplianceScore(req.user.organizationId, outletId);
  }
}
