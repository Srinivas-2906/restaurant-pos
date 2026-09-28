import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@kaana/database";
import { PrismaService } from "../prisma/prisma.service";
import { CapabilityService } from "../capabilities/capability.service";
import { AC, CHART_OF_ACCOUNTS, paymentAssetAccount } from "./chart-of-accounts";
import { assertBalanced, money, roundMoney, toNumber } from "./accounting-money.util";
import { resolveMoneyPeriod, type MoneyPeriodPreset } from "./business-day.util";

type JournalLineInput = {
  accountCode: string;
  debit?: number | Prisma.Decimal;
  credit?: number | Prisma.Decimal;
  outletId?: string;
};

type PostJournalInput = {
  organizationId: string;
  outletId?: string;
  reference: string;
  description: string;
  sourceEvent: string;
  sourceId?: string;
  idempotencyKey?: string;
  postingDate?: Date;
  lines: JournalLineInput[];
};

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    private prisma: PrismaService,
    private capabilities: CapabilityService,
  ) {}

  async ensureDefaultAccounts(organizationId: string) {
    for (const acct of CHART_OF_ACCOUNTS) {
      await this.prisma.glAccount.upsert({
        where: { organizationId_code: { organizationId, code: acct.code } },
        create: { organizationId, code: acct.code, name: acct.name, type: acct.type },
        update: { name: acct.name, type: acct.type },
      });
    }
  }

  /** Automated business-event posting — NOT gated by finance UI capability. */
  async postJournalEntry(input: PostJournalInput) {
    return this.postJournalInternal(input, { requireGlFeature: false });
  }

  /** Manual / admin journal — requires finance.general_ledger capability. */
  async postManualJournalEntry(input: PostJournalInput) {
    return this.postJournalInternal(input, { requireGlFeature: true });
  }

  private async postJournalInternal(
    input: PostJournalInput,
    opts: { requireGlFeature: boolean },
  ) {
    if (opts.requireGlFeature) {
      const allowed = await this.capabilities.canRestaurantUse(input.organizationId, "finance.general_ledger");
      if (!allowed) {
        throw new BadRequestException("General ledger feature is not enabled");
      }
    }

    if (input.idempotencyKey) {
      const existing = await this.prisma.journalEntry.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: input.organizationId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: { lines: { include: { glAccount: true } } },
      });
      if (existing) return existing;
    }

    await this.ensureDefaultAccounts(input.organizationId);

    const normalized = input.lines.map((l) => ({
      accountCode: l.accountCode,
      debit: roundMoney(l.debit ?? 0),
      credit: roundMoney(l.credit ?? 0),
      outletId: l.outletId ?? input.outletId,
    }));

    try {
      assertBalanced(normalized);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    return this.prisma.journalEntry.create({
      data: {
        organizationId: input.organizationId,
        outletId: input.outletId,
        reference: input.reference,
        description: input.description,
        sourceEvent: input.sourceEvent,
        sourceId: input.sourceId,
        idempotencyKey: input.idempotencyKey,
        postingDate: input.postingDate ?? new Date(),
        status: "posted",
        lines: {
          create: await Promise.all(
            normalized.map(async (line) => {
              const account = await this.prisma.glAccount.findUniqueOrThrow({
                where: {
                  organizationId_code: { organizationId: input.organizationId, code: line.accountCode },
                },
              });
              if (!account.isActive) {
                throw new BadRequestException(`Account ${line.accountCode} is inactive`);
              }
              return {
                glAccountId: account.id,
                debit: line.debit,
                credit: line.credit,
                outletId: line.outletId,
              };
            }),
          ),
        },
      },
      include: { lines: { include: { glAccount: true } } },
    });
  }

  private async orgIdForOutlet(outletId: string): Promise<string> {
    const outlet = await this.prisma.outlet.findUniqueOrThrow({
      where: { id: outletId },
      select: { brand: { select: { organizationId: true } } },
    });
    return outlet.brand.organizationId;
  }

  async bootstrapOrganizationAccounting(organizationId: string) {
    await this.ensureDefaultAccounts(organizationId);
    await this.postOpeningInventoryFromLedger(organizationId);
  }

  /** Post opening inventory journals from opening_stock ledger rows (idempotent). */
  async postOpeningInventoryFromLedger(organizationId: string) {
    const outlets = await this.prisma.outlet.findMany({
      where: { brand: { organizationId }, isActive: true },
      select: { id: true },
    });

    for (const outlet of outlets) {
      const openings = await this.prisma.stockLedger.findMany({
        where: { outletId: outlet.id, type: "opening_stock" },
        include: { ingredient: true },
      });

      for (const row of openings) {
        const value = roundMoney(row.totalValue ?? money(row.quantity).times(row.unitCost ?? 0));
        if (value.lte(0)) continue;

        await this.postJournalEntry({
          organizationId,
          outletId: outlet.id,
          reference: row.reference ?? `opening:${row.ingredientId}`,
          description: `Opening inventory — ${row.ingredient.name}`,
          sourceEvent: "inventory_opening",
          sourceId: row.id,
          idempotencyKey: `opening-inventory:${outlet.id}:${row.ingredientId}`,
          postingDate: row.createdAt,
          lines: [
            { accountCode: AC.INVENTORY, debit: value, outletId: outlet.id },
            { accountCode: AC.OPENING_EQUITY, credit: value },
          ],
        });
      }
    }
  }

  async postOrderSettlementAccounting(input: {
    organizationId: string;
    outletId: string;
    orderId: string;
    invoice: {
      taxableAmount: Prisma.Decimal | number;
      cgstAmount: Prisma.Decimal | number;
      sgstAmount: Prisma.Decimal | number;
      igstAmount?: Prisma.Decimal | number;
      totalAmount: Prisma.Decimal | number;
    };
    payments: Array<{ method: string; amount: number }>;
  }) {
    const revenue = roundMoney(input.invoice.taxableAmount);
    const cgst = roundMoney(input.invoice.cgstAmount);
    const sgst = roundMoney(input.invoice.sgstAmount);
    const igst = roundMoney(input.invoice.igstAmount ?? 0);

    const paymentLines: JournalLineInput[] = input.payments.map((p) => ({
      accountCode: paymentAssetAccount(p.method),
      debit: roundMoney(p.amount),
      outletId: input.outletId,
    }));

    const creditLines: JournalLineInput[] = [
      { accountCode: AC.SALES, credit: revenue, outletId: input.outletId },
    ];
    if (cgst.gt(0)) creditLines.push({ accountCode: AC.OUTPUT_CGST, credit: cgst, outletId: input.outletId });
    if (sgst.gt(0)) creditLines.push({ accountCode: AC.OUTPUT_SGST, credit: sgst, outletId: input.outletId });
    if (igst.gt(0)) creditLines.push({ accountCode: AC.OUTPUT_IGST, credit: igst, outletId: input.outletId });

    await this.postJournalEntry({
      organizationId: input.organizationId,
      outletId: input.outletId,
      reference: input.orderId,
      description: `Sales settlement — order ${input.orderId}`,
      sourceEvent: "order_settlement",
      sourceId: input.orderId,
      idempotencyKey: `sales:${input.orderId}`,
      lines: [...paymentLines, ...creditLines],
    });

    await this.postOrderCogs(input.organizationId, input.outletId, input.orderId);
  }

  async postOrderCogs(organizationId: string, outletId: string, orderId: string) {
    const consumptions = await this.prisma.stockLedger.findMany({
      where: {
        outletId,
        type: "recipe_consumption",
        reference: { startsWith: `${orderId}:` },
      },
    });

    const cogsTotal = roundMoney(
      consumptions.reduce((s, l) => s.plus(l.totalValue ?? 0), new Prisma.Decimal(0)),
    );

    if (cogsTotal.lte(0)) {
      this.logger.warn(`No COGS value for order ${orderId} — skipping COGS journal`);
      return null;
    }

    return this.postJournalEntry({
      organizationId,
      outletId,
      reference: orderId,
      description: `COGS — order ${orderId}`,
      sourceEvent: "order_cogs",
      sourceId: orderId,
      idempotencyKey: `cogs:${orderId}`,
      lines: [
        { accountCode: AC.COGS, debit: cogsTotal, outletId },
        { accountCode: AC.INVENTORY, credit: cogsTotal, outletId },
      ],
    });
  }

  async postGoodsReceiptAccounting(input: {
    organizationId: string;
    outletId: string;
    goodsReceiptId: string;
    grnNumber: string;
    totalValue: number;
  }) {
    const value = roundMoney(input.totalValue);
    if (value.lte(0)) return null;

    return this.postJournalEntry({
      organizationId: input.organizationId,
      outletId: input.outletId,
      reference: input.grnNumber,
      description: `Goods receipt ${input.grnNumber}`,
      sourceEvent: "goods_receipt",
      sourceId: input.goodsReceiptId,
      idempotencyKey: `grn:${input.goodsReceiptId}`,
      lines: [
        { accountCode: AC.INVENTORY, debit: value, outletId: input.outletId },
        { accountCode: AC.GRNI, credit: value, outletId: input.outletId },
      ],
    });
  }

  async postPurchaseInvoiceAccounting(invoice: {
    id: string;
    outletId: string;
    invoiceNumber: string;
    taxableValue: Prisma.Decimal;
    cgst: Prisma.Decimal;
    sgst: Prisma.Decimal;
    igst: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    goodsReceiptId?: string | null;
  }) {
    const organizationId = await this.orgIdForOutlet(invoice.outletId);
    const inventoryValue = roundMoney(invoice.taxableValue);
    const cgst = roundMoney(invoice.cgst);
    const sgst = roundMoney(invoice.sgst);
    const igst = roundMoney(invoice.igst);
    const total = roundMoney(invoice.totalAmount);

    const lines: JournalLineInput[] = [
      { accountCode: AC.GRNI, debit: inventoryValue, outletId: invoice.outletId },
    ];

    if (cgst.gt(0)) lines.push({ accountCode: AC.INPUT_CGST, debit: cgst, outletId: invoice.outletId });
    if (sgst.gt(0)) lines.push({ accountCode: AC.INPUT_SGST, debit: sgst, outletId: invoice.outletId });
    if (igst.gt(0)) {
      throw new BadRequestException("IGST input posting not supported in Step 13 MVP");
    }

    lines.push({ accountCode: AC.AP, credit: total, outletId: invoice.outletId });

    return this.postJournalEntry({
      organizationId,
      outletId: invoice.outletId,
      reference: invoice.invoiceNumber,
      description: `Supplier bill ${invoice.invoiceNumber}`,
      sourceEvent: "supplier_invoice",
      sourceId: invoice.id,
      idempotencyKey: `supplier-invoice:${invoice.id}`,
      lines,
    });
  }

  async postSupplierPayment(input: {
    organizationId: string;
    outletId: string;
    supplierPaymentId: string;
    purchaseInvoiceId?: string;
    amount: number;
    paymentMethod: string;
    reference?: string;
  }) {
    const amount = roundMoney(input.amount);
    const asset = paymentAssetAccount(input.paymentMethod);

    return this.postJournalEntry({
      organizationId: input.organizationId,
      outletId: input.outletId,
      reference: input.reference ?? input.supplierPaymentId,
      description: "Supplier payment",
      sourceEvent: "supplier_payment",
      sourceId: input.supplierPaymentId,
      idempotencyKey: `supplier-payment:${input.supplierPaymentId}`,
      lines: [
        { accountCode: AC.AP, debit: amount, outletId: input.outletId },
        { accountCode: asset, credit: amount, outletId: input.outletId },
      ],
    });
  }

  async postWastageAccounting(input: {
    organizationId: string;
    outletId: string;
    wastageEntryId: string;
    ingredientName: string;
    costValue: number;
  }) {
    const value = roundMoney(input.costValue);
    if (value.lte(0)) return null;

    return this.postJournalEntry({
      organizationId: input.organizationId,
      outletId: input.outletId,
      reference: input.wastageEntryId,
      description: `Wastage — ${input.ingredientName}`,
      sourceEvent: "inventory_wastage",
      sourceId: input.wastageEntryId,
      idempotencyKey: `wastage:${input.wastageEntryId}`,
      lines: [
        { accountCode: AC.WASTAGE, debit: value, outletId: input.outletId },
        { accountCode: AC.INVENTORY, credit: value, outletId: input.outletId },
      ],
    });
  }

  async postStockAdjustmentAccounting(input: {
    organizationId: string;
    outletId: string;
    ledgerId: string;
    reference: string;
    quantity: number;
    costValue: number;
    reason?: string;
  }) {
    const value = roundMoney(Math.abs(input.costValue));
    if (value.lte(0)) return null;

    const isLoss = input.quantity < 0;

    return this.postJournalEntry({
      organizationId: input.organizationId,
      outletId: input.outletId,
      reference: input.reference,
      description: input.reason ?? "Stock adjustment",
      sourceEvent: isLoss ? "inventory_adjustment_loss" : "inventory_adjustment_gain",
      sourceId: input.ledgerId,
      idempotencyKey: `adjustment:${input.ledgerId}`,
      lines: isLoss
        ? [
            { accountCode: AC.ADJ_LOSS, debit: value, outletId: input.outletId },
            { accountCode: AC.INVENTORY, credit: value, outletId: input.outletId },
          ]
        : [
            { accountCode: AC.INVENTORY, debit: value, outletId: input.outletId },
            { accountCode: AC.ADJ_GAIN, credit: value, outletId: input.outletId },
          ],
    });
  }

  async postTransferDispatchAccounting(input: {
    organizationId: string;
    fromOutletId: string;
    transferId: string;
    transferNumber: string;
    totalValue: number;
  }) {
    const value = roundMoney(input.totalValue);
    if (value.lte(0)) return null;

    return this.postJournalEntry({
      organizationId: input.organizationId,
      outletId: input.fromOutletId,
      reference: input.transferNumber,
      description: `Transfer dispatch ${input.transferNumber}`,
      sourceEvent: "inventory_transfer_dispatch",
      sourceId: input.transferId,
      idempotencyKey: `transfer-dispatch:${input.transferId}`,
      lines: [
        { accountCode: AC.IN_TRANSIT, debit: value, outletId: input.fromOutletId },
        { accountCode: AC.INVENTORY, credit: value, outletId: input.fromOutletId },
      ],
    });
  }

  async postTransferReceiveAccounting(input: {
    organizationId: string;
    toOutletId: string;
    transferId: string;
    transferNumber: string;
    totalValue: number;
  }) {
    const value = roundMoney(input.totalValue);
    if (value.lte(0)) return null;

    return this.postJournalEntry({
      organizationId: input.organizationId,
      outletId: input.toOutletId,
      reference: input.transferNumber,
      description: `Transfer receive ${input.transferNumber}`,
      sourceEvent: "inventory_transfer_receive",
      sourceId: input.transferId,
      idempotencyKey: `transfer-receive:${input.transferId}`,
      lines: [
        { accountCode: AC.INVENTORY, debit: value, outletId: input.toOutletId },
        { accountCode: AC.IN_TRANSIT, credit: value, outletId: input.toOutletId },
      ],
    });
  }

  async postExpense(input: {
    organizationId: string;
    outletId: string;
    expenseAccountCode?: string;
    amount: number;
    description: string;
    paymentMethod: string;
    expenseDate: Date;
    createdById?: string;
    supplierId?: string;
  }) {
    const amount = roundMoney(input.amount);
    const asset = paymentAssetAccount(input.paymentMethod);
    const expenseCode = input.expenseAccountCode ?? AC.OPEX;

    const account = await this.prisma.glAccount.findUniqueOrThrow({
      where: { organizationId_code: { organizationId: input.organizationId, code: expenseCode } },
    });

    const expense = await this.prisma.expense.create({
      data: {
        organizationId: input.organizationId,
        outletId: input.outletId,
        glAccountId: account.id,
        amount,
        expenseDate: input.expenseDate,
        description: input.description,
        paymentMethod: input.paymentMethod,
        supplierId: input.supplierId,
        createdById: input.createdById,
      },
    });

    const journal = await this.postJournalEntry({
      organizationId: input.organizationId,
      outletId: input.outletId,
      reference: expense.id,
      description: input.description,
      sourceEvent: "expense",
      sourceId: expense.id,
      idempotencyKey: `expense:${expense.id}`,
      postingDate: input.expenseDate,
      lines: [
        { accountCode: expenseCode, debit: amount, outletId: input.outletId },
        { accountCode: asset, credit: amount, outletId: input.outletId },
      ],
    });

    await this.prisma.expense.update({
      where: { id: expense.id },
      data: { journalEntryId: journal.id },
    });

    return { expense, journal };
  }

  async postOwnerCapital(input: {
    organizationId: string;
    outletId?: string;
    amount: number;
    paymentMethod?: string;
    description?: string;
    idempotencyKey?: string;
  }) {
    const amount = roundMoney(input.amount);
    const asset = paymentAssetAccount(input.paymentMethod ?? "cash");

    return this.postManualJournalEntry({
      organizationId: input.organizationId,
      outletId: input.outletId,
      reference: `capital-${Date.now()}`,
      description: input.description ?? "Owner capital contribution",
      sourceEvent: "owner_capital",
      idempotencyKey: input.idempotencyKey ?? `owner-capital:${input.organizationId}:${amount}:${Date.now()}`,
      lines: [
        { accountCode: asset, debit: amount, outletId: input.outletId },
        { accountCode: AC.OWNER_CAPITAL, credit: amount },
      ],
    });
  }

  async postOwnerDrawing(input: {
    organizationId: string;
    outletId?: string;
    amount: number;
    paymentMethod?: string;
    description?: string;
    idempotencyKey?: string;
  }) {
    const amount = roundMoney(input.amount);
    const asset = paymentAssetAccount(input.paymentMethod ?? "cash");

    return this.postManualJournalEntry({
      organizationId: input.organizationId,
      outletId: input.outletId,
      reference: `drawing-${Date.now()}`,
      description: input.description ?? "Owner drawing",
      sourceEvent: "owner_drawing",
      idempotencyKey: input.idempotencyKey ?? `owner-drawing:${input.organizationId}:${amount}:${Date.now()}`,
      lines: [
        { accountCode: AC.OWNER_DRAWINGS, debit: amount },
        { accountCode: asset, credit: amount, outletId: input.outletId },
      ],
    });
  }

  async postSupplierPaymentWithRecord(input: {
    organizationId: string;
    outletId: string;
    supplierId: string;
    purchaseInvoiceId?: string;
    amount: number;
    paymentMethod: string;
    paymentDate?: Date;
    reference?: string;
    createdById?: string;
  }) {
    const amount = roundMoney(input.amount);
    if (amount.lte(0)) {
      throw new BadRequestException("Payment amount must be positive");
    }

    if (input.purchaseInvoiceId) {
      const bill = await this.prisma.purchaseInvoice.findFirstOrThrow({
        where: { id: input.purchaseInvoiceId, outletId: input.outletId },
      });
      const billTotal = roundMoney(
        bill.totalAmount ??
          Number(bill.taxableValue) +
            Number(bill.cgst) +
            Number(bill.sgst) +
            Number(bill.igst) +
            Number(bill.freight) +
            Number(bill.rounding) -
            Number(bill.discount),
      );
      const paid = await this.prisma.supplierPayment.aggregate({
        where: { purchaseInvoiceId: input.purchaseInvoiceId },
        _sum: { amount: true },
      });
      const outstanding = billTotal.minus(roundMoney(paid._sum.amount ?? 0));
      if (amount.gt(outstanding)) {
        throw new BadRequestException(
          `Payment exceeds outstanding balance (${toNumber(outstanding)} remaining)`,
        );
      }
    }

    const payment = await this.prisma.supplierPayment.create({
      data: {
        organizationId: input.organizationId,
        outletId: input.outletId,
        supplierId: input.supplierId,
        purchaseInvoiceId: input.purchaseInvoiceId,
        amount: roundMoney(input.amount),
        paymentMethod: input.paymentMethod,
        paymentDate: input.paymentDate ?? new Date(),
        reference: input.reference,
        createdById: input.createdById,
      },
    });

    const journal = await this.postSupplierPayment({
      organizationId: input.organizationId,
      outletId: input.outletId,
      supplierPaymentId: payment.id,
      purchaseInvoiceId: input.purchaseInvoiceId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      reference: input.reference,
    });

    await this.prisma.supplierPayment.update({
      where: { id: payment.id },
      data: { journalEntryId: journal.id },
    });

    if (input.purchaseInvoiceId) {
      const bill = await this.prisma.purchaseInvoice.findUniqueOrThrow({
        where: { id: input.purchaseInvoiceId },
      });
      const billTotal = roundMoney(
        bill.totalAmount ??
          Number(bill.taxableValue) +
            Number(bill.cgst) +
            Number(bill.sgst) +
            Number(bill.igst) +
            Number(bill.freight) +
            Number(bill.rounding) -
            Number(bill.discount),
      );
      const paidAfter = await this.prisma.supplierPayment.aggregate({
        where: { purchaseInvoiceId: input.purchaseInvoiceId },
        _sum: { amount: true },
      });
      const remaining = billTotal.minus(roundMoney(paidAfter._sum.amount ?? 0));
      await this.prisma.purchaseInvoice.update({
        where: { id: input.purchaseInvoiceId },
        data: { paymentStatus: remaining.lte(0) ? "paid" : "partial" },
      });
    }

    return { payment, journal };
  }

  async reverseJournalEntry(organizationId: string, journalEntryId: string, reason: string) {
    const original = await this.prisma.journalEntry.findFirstOrThrow({
      where: { id: journalEntryId, organizationId },
      include: { lines: true },
    });

    if (original.status === "reversed") {
      throw new BadRequestException("Journal already reversed");
    }

    const reversal = await this.postManualJournalEntry({
      organizationId,
      outletId: original.outletId ?? undefined,
      reference: `REV-${original.reference}`,
      description: `Reversal: ${reason}`,
      sourceEvent: "journal_reversal",
      sourceId: original.id,
      idempotencyKey: `reversal:${original.id}`,
      lines: await Promise.all(
        original.lines.map(async (l) => {
          const acct = await this.prisma.glAccount.findUniqueOrThrow({ where: { id: l.glAccountId } });
          return {
            accountCode: acct.code,
            debit: l.credit,
            credit: l.debit,
            outletId: l.outletId ?? undefined,
          };
        }),
      ),
    });

    await this.prisma.journalEntry.update({
      where: { id: original.id },
      data: { status: "reversed", reversedEntryId: reversal.id },
    });

    return reversal;
  }

  async listAccounts(organizationId: string) {
    await this.ensureDefaultAccounts(organizationId);
    return this.prisma.glAccount.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
    });
  }

  async listEntries(organizationId: string, limit = 50, filters?: { outletId?: string; from?: Date; to?: Date }) {
    return this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        ...(filters?.outletId ? { outletId: filters.outletId } : {}),
        ...(filters?.from || filters?.to
          ? {
              postingDate: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { postingDate: "desc" },
      take: limit,
      include: { lines: { include: { glAccount: true } } },
    });
  }

  async getAccountLedger(organizationId: string, accountCode: string, from?: Date, to?: Date) {
    const account = await this.prisma.glAccount.findUniqueOrThrow({
      where: { organizationId_code: { organizationId, code: accountCode } },
    });

    const lines = await this.prisma.journalLine.findMany({
      where: {
        glAccountId: account.id,
        journalEntry: {
          organizationId,
          status: "posted",
          ...(from || to
            ? {
                postingDate: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
      },
      include: { journalEntry: true },
      orderBy: { journalEntry: { postingDate: "asc" } },
    });

    let balance = new Prisma.Decimal(0);
    return lines.map((l) => {
      const debit = money(l.debit);
      const credit = money(l.credit);
      const delta = account.type === "asset" || account.type === "expense"
        ? debit.minus(credit)
        : credit.minus(debit);
      balance = balance.plus(delta);
      return {
        ...l,
        runningBalance: toNumber(balance),
      };
    });
  }

  async getTrialBalance(organizationId: string, asOf?: Date, outletId?: string) {
    const accounts = await this.ensureDefaultAccounts(organizationId).then(() =>
      this.prisma.glAccount.findMany({ where: { organizationId, isActive: true }, orderBy: { code: "asc" } }),
    );

    const rows: Array<{
      accountCode: string;
      accountName: string;
      type: string;
      periodDebit: number;
      periodCredit: number;
      closingDebit: number;
      closingCredit: number;
    }> = [];
    let totalDebits = new Prisma.Decimal(0);
    let totalCredits = new Prisma.Decimal(0);

    for (const account of accounts) {
      const agg = await this.prisma.journalLine.aggregate({
        where: {
          glAccountId: account.id,
          ...(outletId ? { outletId } : {}),
          journalEntry: {
            organizationId,
            status: "posted",
            ...(asOf ? { postingDate: { lte: asOf } } : {}),
          },
        },
        _sum: { debit: true, credit: true },
      });

      const debit = roundMoney(agg._sum.debit ?? 0);
      const credit = roundMoney(agg._sum.credit ?? 0);
      const isDebitNormal = account.type === "asset" || account.type === "expense";
      const balance = isDebitNormal ? debit.minus(credit) : credit.minus(debit);

      let closingDebit = new Prisma.Decimal(0);
      let closingCredit = new Prisma.Decimal(0);

      if (balance.gte(0)) {
        if (isDebitNormal) closingDebit = balance;
        else closingCredit = balance;
      } else {
        if (isDebitNormal) closingCredit = balance.abs();
        else closingDebit = balance.abs();
      }

      totalDebits = totalDebits.plus(closingDebit);
      totalCredits = totalCredits.plus(closingCredit);

      if (debit.gt(0) || credit.gt(0)) {
        rows.push({
          accountCode: account.code,
          accountName: account.name,
          type: account.type,
          periodDebit: toNumber(debit),
          periodCredit: toNumber(credit),
          closingDebit: toNumber(closingDebit),
          closingCredit: toNumber(closingCredit),
        });
      }
    }

    const balanced = totalDebits.minus(totalCredits).abs().lte(0.01);

    return {
      ok: balanced,
      asOf: asOf?.toISOString() ?? new Date().toISOString(),
      outletId,
      totalDebits: toNumber(totalDebits),
      totalCredits: toNumber(totalCredits),
      rows,
    };
  }

  async getProfitAndLoss(organizationId: string, from: Date, to: Date, outletId?: string) {
    const accounts = await this.prisma.glAccount.findMany({
      where: { organizationId, type: { in: ["revenue", "expense"] }, isActive: true },
      orderBy: { code: "asc" },
    });

    const revenueRows: Array<{ code: string; name: string; amount: number }> = [];
    const expenseRows: Array<{ code: string; name: string; amount: number }> = [];
    let totalRevenue = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);

    for (const account of accounts) {
      const agg = await this.prisma.journalLine.aggregate({
        where: {
          glAccountId: account.id,
          ...(outletId ? { outletId } : {}),
          journalEntry: { organizationId, status: "posted", postingDate: { gte: from, lte: to } },
        },
        _sum: { debit: true, credit: true },
      });

      const debit = roundMoney(agg._sum.debit ?? 0);
      const credit = roundMoney(agg._sum.credit ?? 0);

      if (account.type === "revenue") {
        const amount = credit.minus(debit);
        if (amount.abs().gt(0)) {
          revenueRows.push({ code: account.code, name: account.name, amount: toNumber(amount) });
          totalRevenue = totalRevenue.plus(amount);
        }
      } else {
        const amount = debit.minus(credit);
        if (amount.abs().gt(0)) {
          expenseRows.push({ code: account.code, name: account.name, amount: toNumber(amount) });
          totalExpense = totalExpense.plus(amount);
        }
      }
    }

    const cogs = expenseRows.find((r) => r.code === AC.COGS)?.amount ?? 0;
    const netRevenue = toNumber(totalRevenue);
    const grossProfit = netRevenue - cogs;
    const netProfit = toNumber(totalRevenue.minus(totalExpense));

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      outletId,
      revenue: revenueRows,
      expenses: expenseRows,
      netRevenue,
      cogs,
      grossProfit,
      netProfit,
    };
  }

  async getBalanceSheet(organizationId: string, asOf: Date, outletId?: string) {
    const tb = await this.getTrialBalance(organizationId, asOf, outletId);

    const assets = tb.rows.filter((r) => r.type === "asset");
    const liabilities = tb.rows.filter((r) => r.type === "liability");
    const equityAccounts = tb.rows.filter((r) => r.type === "equity");

    const totalAssets = assets.reduce((s, r) => s + r.closingDebit - r.closingCredit, 0);
    const totalLiabilities = liabilities.reduce((s, r) => s + r.closingCredit - r.closingDebit, 0);
    const totalEquityAccounts = equityAccounts.reduce((s, r) => s + r.closingCredit - r.closingDebit, 0);

    // Retained earnings = cumulative P&L through asOf
    const epoch = new Date("2000-01-01");
    const pl = await this.getProfitAndLoss(organizationId, epoch, asOf, outletId);
    const retainedEarnings = pl.netProfit;

    const totalEquity = totalEquityAccounts + retainedEarnings;
    const equationOk = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.02;

    return {
      ok: equationOk && tb.ok,
      asOf: asOf.toISOString(),
      outletId,
      assets,
      liabilities,
      equity: equityAccounts,
      retainedEarnings,
      totalAssets,
      totalLiabilities,
      totalEquity,
      equation: { assets: totalAssets, liabilitiesPlusEquity: totalLiabilities + totalEquity },
    };
  }

  async reconcileAccounting(organizationId: string, outletId?: string) {
    const asOf = new Date();
    const tb = await this.getTrialBalance(organizationId, asOf, outletId);
    const bs = await this.getBalanceSheet(organizationId, asOf, outletId);

    const inventoryGl = tb.rows.find((r) => r.accountCode === AC.INVENTORY);
    const inventoryGlBalance = (inventoryGl?.closingDebit ?? 0) - (inventoryGl?.closingCredit ?? 0);

    const ledgerEntries = await this.prisma.stockLedger.findMany({
      where: {
        ...(outletId
          ? { outletId }
          : { outlet: { brand: { organizationId } } }),
      },
      select: { quantity: true, totalValue: true, type: true },
    });

    const ZERO_QTY = new Set(["committed_out", "commit_release"]);
    const inventoryValuation = ledgerEntries.reduce((sum, row) => {
      if (ZERO_QTY.has(row.type)) return sum;
      const value = Number(row.totalValue ?? 0);
      return sum + (Number(row.quantity) >= 0 ? value : -value);
    }, 0);

    const inventoryDelta = roundMoney(inventoryGlBalance).minus(roundMoney(inventoryValuation));

    const unbalanced = await this.findUnbalancedJournals(organizationId);

    return {
      ok: tb.ok && bs.ok && inventoryDelta.abs().lte(0.01) && unbalanced.count === 0,
      trialBalance: tb,
      balanceSheet: bs,
      inventory: {
        glBalance: inventoryGlBalance,
        valuation: toNumber(roundMoney(inventoryValuation)),
        valuationMethod: "stock_ledger_signed_totalValue",
        delta: toNumber(inventoryDelta),
      },
      journals: unbalanced,
    };
  }

  async findUnbalancedJournals(organizationId: string) {
    const entries = await this.prisma.journalEntry.findMany({
      where: { organizationId, status: "posted" },
      include: { lines: true },
    });

    const bad: Array<{ id: string; reference: string; debit: number; credit: number }> = [];
    for (const entry of entries) {
      const debit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
      const credit = entry.lines.reduce((s, l) => s + Number(l.credit), 0);
      if (Math.abs(debit - credit) > 0.001) {
        bad.push({ id: entry.id, reference: entry.reference, debit, credit });
      }
    }
    return { count: bad.length, entries: bad, total: entries.length };
  }

  /** Replay journal for an expense row missing its posting. */
  async replayExpensePosting(expenseId: string) {
    const expense = await this.prisma.expense.findUniqueOrThrow({
      where: { id: expenseId },
      include: { glAccount: true },
    });
    if (expense.journalEntryId) {
      return this.prisma.journalEntry.findUniqueOrThrow({ where: { id: expense.journalEntryId } });
    }

    const amount = roundMoney(expense.amount);
    const asset = paymentAssetAccount(expense.paymentMethod);
    const journal = await this.postJournalEntry({
      organizationId: expense.organizationId,
      outletId: expense.outletId,
      reference: expense.id,
      description: expense.description,
      sourceEvent: "expense",
      sourceId: expense.id,
      idempotencyKey: `expense:${expense.id}`,
      postingDate: expense.expenseDate,
      lines: [
        { accountCode: expense.glAccount.code, debit: amount, outletId: expense.outletId },
        { accountCode: asset, credit: amount, outletId: expense.outletId },
      ],
    });

    await this.prisma.expense.update({
      where: { id: expense.id },
      data: { journalEntryId: journal.id },
    });
    return journal;
  }

  async getAccountBalance(
    organizationId: string,
    accountCode: string,
    asOf = new Date(),
    outletId?: string,
  ): Promise<number> {
    const account = await this.prisma.glAccount.findUniqueOrThrow({
      where: { organizationId_code: { organizationId, code: accountCode } },
    });

    const agg = await this.prisma.journalLine.aggregate({
      where: {
        glAccountId: account.id,
        ...(outletId ? { outletId } : {}),
        journalEntry: {
          organizationId,
          status: "posted",
          postingDate: { lte: asOf },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const debit = roundMoney(agg._sum.debit ?? 0);
    const credit = roundMoney(agg._sum.credit ?? 0);
    const isDebitNormal = account.type === "asset" || account.type === "expense";
    const balance = isDebitNormal ? debit.minus(credit) : credit.minus(debit);
    return toNumber(balance);
  }

  private async sumPaymentAssetDebits(
    organizationId: string,
    from: Date,
    to: Date,
    outletId?: string,
  ): Promise<{ cash: number; upi: number; card: number; bank: number }> {
    const paymentCodes = [AC.CASH, AC.UPI, AC.CARD, AC.BANK];
    const accounts = await this.prisma.glAccount.findMany({
      where: { organizationId, code: { in: paymentCodes } },
    });
    const codeById = new Map(accounts.map((a) => [a.id, a.code]));

    const lines = await this.prisma.journalLine.findMany({
      where: {
        glAccountId: { in: accounts.map((a) => a.id) },
        ...(outletId ? { outletId } : {}),
        journalEntry: {
          organizationId,
          status: "posted",
          sourceEvent: "order_settlement",
          postingDate: { gte: from, lte: to },
        },
      },
      select: { glAccountId: true, debit: true },
    });

    const totals = { cash: 0, upi: 0, card: 0, bank: 0 };
    for (const line of lines) {
      const code = codeById.get(line.glAccountId);
      const amount = toNumber(roundMoney(line.debit));
      if (code === AC.CASH) totals.cash += amount;
      else if (code === AC.UPI) totals.upi += amount;
      else if (code === AC.CARD) totals.card += amount;
      else if (code === AC.BANK) totals.bank += amount;
    }
    return totals;
  }

  async getMoneySummary(
    organizationId: string,
    opts: {
      period?: MoneyPeriodPreset;
      customFrom?: string;
      customTo?: string;
      outletId?: string;
    } = {},
  ) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const timeZone = org.timezone || "Asia/Kolkata";
    const preset = opts.period ?? "today";
    const period = resolveMoneyPeriod(timeZone, preset, opts.customFrom, opts.customTo);
    const asOf = period.to;

    const pl = await this.getProfitAndLoss(organizationId, period.from, period.to, opts.outletId);
    const opexTotal = pl.expenses
      .filter((e) => e.code !== AC.COGS && e.code !== AC.WASTAGE && e.code !== AC.ADJ_LOSS)
      .reduce((s, e) => s + e.amount, 0);
    const wastageExpense =
      (pl.expenses.find((e) => e.code === AC.WASTAGE)?.amount ?? 0) +
      (pl.expenses.find((e) => e.code === AC.ADJ_LOSS)?.amount ?? 0);

    const paymentBreakdown = await this.sumPaymentAssetDebits(
      organizationId,
      period.from,
      period.to,
      opts.outletId,
    );

    const orderCount = await this.prisma.order.count({
      where: {
        status: "settled",
        settledAt: { gte: period.from, lte: period.to },
        ...(opts.outletId
          ? { outletId: opts.outletId }
          : { outlet: { brand: { organizationId } } }),
      },
    });

    const cashInHand = await this.getAccountBalance(organizationId, AC.CASH, asOf, opts.outletId);
    const bankBalance = await this.getAccountBalance(organizationId, AC.BANK, asOf, opts.outletId);
    const upiClearing = await this.getAccountBalance(organizationId, AC.UPI, asOf, opts.outletId);
    const cardClearing = await this.getAccountBalance(organizationId, AC.CARD, asOf, opts.outletId);
    const supplierDue = await this.getAccountBalance(organizationId, AC.AP, asOf, opts.outletId);

    const reconcile = await this.reconcileAccounting(organizationId, opts.outletId);
    const inventoryValue = reconcile.ok ? reconcile.inventory.valuation : null;

    return {
      period: {
        preset,
        label: period.label,
        from: period.from.toISOString(),
        to: period.to.toISOString(),
        timeZone,
      },
      outletId: opts.outletId,
      integrity: {
        ok: reconcile.ok,
        warning: reconcile.ok ? undefined : "Financial data needs reconciliation",
      },
      sales: pl.netRevenue,
      orders: orderCount,
      expenses: opexTotal + wastageExpense,
      operatingExpenses: opexTotal,
      wastageExpense,
      profit: pl.netProfit,
      profitSummary: {
        revenue: pl.netRevenue,
        cogs: pl.cogs,
        grossProfit: pl.grossProfit,
        expenses: opexTotal + wastageExpense,
        operatingExpenses: opexTotal,
        netProfit: pl.netProfit,
      },
      paymentBreakdown: {
        cash: paymentBreakdown.cash,
        upi: paymentBreakdown.upi,
        card: paymentBreakdown.card,
      },
      balances: {
        cashInHand,
        bank: bankBalance,
        upiPendingSettlement: upiClearing,
        cardPendingSettlement: cardClearing,
      },
      supplierDue,
      inventoryValue,
      inventoryReconciled: reconcile.inventory.delta === 0,
      dailySummary: {
        sales: pl.netRevenue,
        orders: orderCount,
        cashSales: paymentBreakdown.cash,
        upiSales: paymentBreakdown.upi,
        cardSales: paymentBreakdown.card,
        cogs: pl.cogs,
        grossProfit: pl.grossProfit,
        expenses: opexTotal + wastageExpense,
        netProfit: pl.netProfit,
      },
    };
  }

  private activityLabel(sourceEvent: string): string {
    switch (sourceEvent) {
      case "order_settlement":
        return "Sale";
      case "expense":
        return "Expense";
      case "supplier_payment":
        return "Supplier Payment";
      case "owner_capital":
        return "Owner Capital";
      case "owner_drawing":
        return "Owner Withdrawal";
      case "purchase_invoice":
        return "Purchase Bill";
      case "goods_receipt":
        return "Goods Receipt";
      case "inventory_wastage":
        return "Wastage";
      default:
        return sourceEvent.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  private activityDirection(sourceEvent: string): "in" | "out" | "neutral" {
    if (["order_settlement", "owner_capital", "inventory_adjustment_gain"].includes(sourceEvent)) return "in";
    if (
      ["expense", "supplier_payment", "owner_drawing", "inventory_wastage", "inventory_adjustment_loss"].includes(
        sourceEvent,
      )
    ) {
      return "out";
    }
    return "neutral";
  }

  async getMoneyActivity(
    organizationId: string,
    opts: { from?: Date; to?: Date; outletId?: string; limit?: number } = {},
  ) {
    const entries = await this.listEntries(organizationId, opts.limit ?? 100, {
      outletId: opts.outletId,
      from: opts.from,
      to: opts.to,
    });

    return entries.map((entry) => {
      const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = entry.lines.reduce((s, l) => s + Number(l.credit), 0);
      const amount = Math.max(totalDebit, totalCredit);
      const paymentLine = entry.lines.find((l) =>
        [AC.CASH, AC.UPI, AC.CARD, AC.BANK].includes(l.glAccount.code as typeof AC.CASH),
      );
      return {
        id: entry.id,
        date: entry.postingDate.toISOString(),
        type: this.activityLabel(entry.sourceEvent),
        description: entry.description,
        amount,
        direction: this.activityDirection(entry.sourceEvent),
        paymentMethod: paymentLine
          ? paymentLine.glAccount.code === AC.CASH
            ? "cash"
            : paymentLine.glAccount.code === AC.UPI
              ? "upi"
              : paymentLine.glAccount.code === AC.CARD
                ? "card"
                : "bank"
          : undefined,
        outletId: entry.outletId,
        sourceEvent: entry.sourceEvent,
        sourceId: entry.sourceId,
      };
    });
  }

  async getSupplierDues(organizationId: string, outletId?: string) {
    const bills = await this.prisma.purchaseInvoice.findMany({
      where: {
        ...(outletId
          ? { outletId }
          : { outlet: { brand: { organizationId } } }),
        paymentStatus: { in: ["unpaid", "partial"] },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        supplierPayments: { select: { amount: true } },
      },
      orderBy: { invoiceDate: "desc" },
    });

    const rows = bills.map((bill) => {
      const billTotal = roundMoney(
        bill.totalAmount ??
          Number(bill.taxableValue) +
            Number(bill.cgst) +
            Number(bill.sgst) +
            Number(bill.igst) +
            Number(bill.freight) +
            Number(bill.rounding) -
            Number(bill.discount),
      );
      const paid = roundMoney(
        bill.supplierPayments.reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0)),
      );
      const remaining = billTotal.minus(paid);
      return {
        billId: bill.id,
        supplierId: bill.supplier.id,
        supplierName: bill.supplier.name,
        billNumber: bill.invoiceNumber,
        billTotal: toNumber(billTotal),
        paid: toNumber(paid),
        remaining: toNumber(remaining),
        dueDate: undefined,
        outletId: bill.outletId,
      };
    });

    const totalOutstanding = rows.reduce((s, r) => s + r.remaining, 0);
    const apBalance = await this.getAccountBalance(organizationId, AC.AP, new Date(), outletId);

    return {
      totalOutstanding,
      apBalance,
      bills: rows.filter((r) => r.remaining > 0.001),
    };
  }

  async listExpenses(
    organizationId: string,
    opts: { from?: Date; to?: Date; outletId?: string; categoryCode?: string } = {},
  ) {
    const expenses = await this.prisma.expense.findMany({
      where: {
        organizationId,
        ...(opts.outletId ? { outletId: opts.outletId } : {}),
        ...(opts.from || opts.to
          ? {
              expenseDate: {
                ...(opts.from ? { gte: opts.from } : {}),
                ...(opts.to ? { lte: opts.to } : {}),
              },
            }
          : {}),
        ...(opts.categoryCode ? { glAccount: { code: opts.categoryCode } } : {}),
      },
      include: { glAccount: true, outlet: { select: { name: true } } },
      orderBy: { expenseDate: "desc" },
    });

    return expenses.map((e) => ({
      id: e.id,
      amount: toNumber(e.amount),
      description: e.description,
      categoryCode: e.glAccount.code,
      categoryName: expenseCategoryLabel(e.glAccount.code, e.glAccount.name),
      paymentMethod: e.paymentMethod,
      expenseDate: e.expenseDate.toISOString(),
      outletId: e.outletId,
      outletName: e.outlet.name,
    }));
  }

  getExpenseCategories() {
    return [
      { code: AC.OPEX, label: "Operating Expense" },
      { code: AC.WASTAGE, label: "Wastage" },
      { code: AC.ADJ_LOSS, label: "Inventory Loss" },
    ];
  }
}

export function expenseCategoryLabel(code: string, fallbackName?: string): string {
  const map: Record<string, string> = {
    [AC.OPEX]: "Operating Expense",
    [AC.WASTAGE]: "Wastage",
    [AC.ADJ_LOSS]: "Inventory Loss",
    [AC.COGS]: "Cost of Goods Sold",
  };
  return map[code] ?? fallbackName ?? code;
}
