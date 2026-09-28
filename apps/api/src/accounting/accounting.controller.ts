import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Request,
  UseGuards,
  Param,
  ForbiddenException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, Roles } from "../auth/guards";
import { CapabilityGuard, RequireModule } from "../capabilities/capability.guard";
import { OutletScopeService, type ScopedAuthUser } from "../auth/outlet-scope.service";
import { AccountingService } from "./accounting.service";
import { AccountingPostingQueueService } from "./accounting-posting-queue.service";

const FINANCE_READ = ["owner", "manager", "accountant", "super_admin"] as const;
const FINANCE_WRITE = ["owner", "manager", "accountant"] as const;

@ApiTags("accounting")
@Controller("accounting")
@UseGuards(JwtAuthGuard, CapabilityGuard)
@RequireModule("finance")
@ApiBearerAuth()
export class AccountingController {
  constructor(
    private accounting: AccountingService,
    private outletScope: OutletScopeService,
    private postingQueue: AccountingPostingQueueService,
  ) {}

  @Get("accounts")
  @Roles(...FINANCE_READ)
  listAccounts(@Request() req: { user: ScopedAuthUser }) {
    return this.accounting.listAccounts(req.user.organizationId);
  }

  @Get("entries")
  @Roles(...FINANCE_READ)
  listEntries(
    @Request() req: { user: ScopedAuthUser },
    @Query("limit") limit?: string,
    @Query("outletId") outletId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    if (outletId) {
      return this.outletScope.assertUserOutletAccess(req.user, outletId).then(() =>
        this.accounting.listEntries(req.user.organizationId, limit ? Number(limit) : 50, {
          outletId,
          from: from ? new Date(from) : undefined,
          to: to ? new Date(to) : undefined,
        }),
      );
    }
    return this.accounting.listEntries(req.user.organizationId, limit ? Number(limit) : 50, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get("ledger/:accountCode")
  @Roles(...FINANCE_READ)
  accountLedger(
    @Request() req: { user: ScopedAuthUser },
    @Param("accountCode") accountCode: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.accounting.getAccountLedger(
      req.user.organizationId,
      accountCode,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get("reports/trial-balance")
  @Roles(...FINANCE_READ)
  trialBalance(
    @Request() req: { user: ScopedAuthUser },
    @Query("asOf") asOf?: string,
    @Query("outletId") outletId?: string,
  ) {
    return this.accounting.getTrialBalance(
      req.user.organizationId,
      asOf ? new Date(asOf) : new Date(),
      outletId,
    );
  }

  @Get("reports/profit-and-loss")
  @Roles(...FINANCE_READ)
  profitAndLoss(
    @Request() req: { user: ScopedAuthUser },
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("outletId") outletId?: string,
  ) {
    return this.accounting.getProfitAndLoss(
      req.user.organizationId,
      new Date(from),
      new Date(to),
      outletId,
    );
  }

  @Get("reports/balance-sheet")
  @Roles(...FINANCE_READ)
  balanceSheet(
    @Request() req: { user: ScopedAuthUser },
    @Query("asOf") asOf?: string,
    @Query("outletId") outletId?: string,
  ) {
    return this.accounting.getBalanceSheet(
      req.user.organizationId,
      asOf ? new Date(asOf) : new Date(),
      outletId,
    );
  }

  @Get("reconcile")
  @Roles(...FINANCE_READ)
  reconcile(
    @Request() req: { user: ScopedAuthUser },
    @Query("outletId") outletId?: string,
  ) {
    return this.accounting.reconcileAccounting(req.user.organizationId, outletId);
  }

  @Get("money-summary")
  @Roles(...FINANCE_READ)
  async moneySummary(
    @Request() req: { user: ScopedAuthUser },
    @Query("period") period?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("outletId") outletId?: string,
  ) {
    if (outletId) {
      await this.outletScope.assertUserOutletAccess(req.user, outletId);
    }
    const preset = (period ?? "today") as "today" | "yesterday" | "week" | "month" | "custom";
    return this.accounting.getMoneySummary(req.user.organizationId, {
      period: preset,
      customFrom: from,
      customTo: to,
      outletId,
    });
  }

  @Get("money/activity")
  @Roles(...FINANCE_READ)
  async moneyActivity(
    @Request() req: { user: ScopedAuthUser },
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("outletId") outletId?: string,
    @Query("limit") limit?: string,
  ) {
    if (outletId) {
      await this.outletScope.assertUserOutletAccess(req.user, outletId);
    }
    return this.accounting.getMoneyActivity(req.user.organizationId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      outletId,
      limit: limit ? Number(limit) : 100,
    });
  }

  @Get("supplier-dues")
  @Roles(...FINANCE_READ)
  async supplierDues(
    @Request() req: { user: ScopedAuthUser },
    @Query("outletId") outletId?: string,
  ) {
    if (outletId) {
      await this.outletScope.assertUserOutletAccess(req.user, outletId);
    }
    return this.accounting.getSupplierDues(req.user.organizationId, outletId);
  }

  @Get("expenses")
  @Roles(...FINANCE_READ)
  async listExpenses(
    @Request() req: { user: ScopedAuthUser },
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("outletId") outletId?: string,
    @Query("categoryCode") categoryCode?: string,
  ) {
    if (outletId) {
      await this.outletScope.assertUserOutletAccess(req.user, outletId);
    }
    return this.accounting.listExpenses(req.user.organizationId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      outletId,
      categoryCode,
    });
  }

  @Get("expense-categories")
  @Roles(...FINANCE_READ)
  expenseCategories() {
    return this.accounting.getExpenseCategories();
  }

  @Post("posting-jobs/process")
  @Roles("owner", "accountant", "super_admin")
  processPostingJobs(@Request() req: { user: ScopedAuthUser }) {
    return this.postingQueue.processPendingJobs(req.user.organizationId, 200);
  }

  @Post("posting-jobs/reconcile-missing")
  @Roles("owner", "accountant", "super_admin")
  reconcileMissing(@Request() req: { user: ScopedAuthUser }) {
    return this.postingQueue.reconcileMissingAccounting(req.user.organizationId);
  }

  @Post("bootstrap")
  @Roles("owner", "super_admin")
  bootstrap(@Request() req: { user: ScopedAuthUser }) {
    return this.accounting.bootstrapOrganizationAccounting(req.user.organizationId);
  }

  @Post("manual-journal")
  @Roles(...FINANCE_WRITE)
  manualJournal(
    @Request() req: { user: ScopedAuthUser },
    @Body()
    body: {
      outletId?: string;
      reference: string;
      description: string;
      postingDate?: string;
      lines: Array<{ accountCode: string; debit?: number; credit?: number; outletId?: string }>;
    },
  ) {
    if (req.user.authMode === "operational") {
      throw new ForbiddenException("Manual journals require management login");
    }
    return this.accounting.postManualJournalEntry({
      organizationId: req.user.organizationId,
      outletId: body.outletId,
      reference: body.reference,
      description: body.description,
      sourceEvent: "manual_journal",
      postingDate: body.postingDate ? new Date(body.postingDate) : undefined,
      lines: body.lines,
    });
  }

  @Post("expenses")
  @Roles(...FINANCE_WRITE)
  async createExpense(
    @Request() req: { user: ScopedAuthUser },
    @Body()
    body: {
      outletId: string;
      amount: number;
      description: string;
      paymentMethod: string;
      expenseDate?: string;
      expenseAccountCode?: string;
      supplierId?: string;
    },
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, body.outletId);
    if (req.user.authMode === "operational") {
      throw new ForbiddenException("Expense entry requires management login");
    }
    return this.accounting.postExpense({
      organizationId: req.user.organizationId,
      outletId: body.outletId,
      amount: body.amount,
      description: body.description,
      paymentMethod: body.paymentMethod,
      expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
      expenseAccountCode: body.expenseAccountCode,
      supplierId: body.supplierId,
      createdById: req.user.userId,
    });
  }

  @Post("owner-capital")
  @Roles("owner", "accountant")
  ownerCapital(
    @Request() req: { user: ScopedAuthUser },
    @Body() body: { amount: number; outletId?: string; paymentMethod?: string; description?: string; idempotencyKey?: string },
  ) {
    return this.accounting.postOwnerCapital({
      organizationId: req.user.organizationId,
      outletId: body.outletId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      description: body.description,
      idempotencyKey: body.idempotencyKey,
    });
  }

  @Post("owner-drawing")
  @Roles("owner", "accountant")
  ownerDrawing(
    @Request() req: { user: ScopedAuthUser },
    @Body() body: { amount: number; outletId?: string; paymentMethod?: string; description?: string; idempotencyKey?: string },
  ) {
    return this.accounting.postOwnerDrawing({
      organizationId: req.user.organizationId,
      outletId: body.outletId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      description: body.description,
      idempotencyKey: body.idempotencyKey,
    });
  }

  @Post("supplier-payments")
  @Roles(...FINANCE_WRITE)
  async supplierPayment(
    @Request() req: { user: ScopedAuthUser },
    @Body()
    body: {
      outletId: string;
      supplierId: string;
      purchaseInvoiceId?: string;
      amount: number;
      paymentMethod: string;
      paymentDate?: string;
      reference?: string;
    },
  ) {
    await this.outletScope.assertUserOutletAccess(req.user, body.outletId);
    return this.accounting.postSupplierPaymentWithRecord({
      organizationId: req.user.organizationId,
      outletId: body.outletId,
      supplierId: body.supplierId,
      purchaseInvoiceId: body.purchaseInvoiceId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : undefined,
      reference: body.reference,
      createdById: req.user.userId,
    });
  }
}
