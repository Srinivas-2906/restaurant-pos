import {
  PrismaClient,
  UserRole,
  OutletType,
  OrderStatus,
  TableStatus,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import {
  LEGACY_FULL_FEATURES,
  LEGACY_FULL_MODULES,
  MODE_NAV_DEPTH,
  type ModuleKey,
} from "@kaana/shared-types";

const prisma = new PrismaClient();

const DEV_PASSWORD = "password123";
const ORG_SLUG = "kaana-demo";
const BRAND_SLUG = "kaana-demo";
const OUTLET_CODE = "MAIN-001";

const DEV_DEVICE_SECRETS = {
  "POS-01": "kaana-dev-pos-01-secret",
  "KDS-01": "kaana-dev-kds-01-secret",
  "CAPTAIN-01": "kaana-dev-captain-01-secret",
} as const;

const STAFF_PINS: Record<string, string> = {
  EMP001: "1111",
  EMP002: "2222",
  EMP003: "3333",
  EMP004: "4444",
};

async function hashPin(pin: string) {
  return bcrypt.hash(pin, 10);
}

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

/** Return demo outlet tables and in-flight orders to the seeded baseline. */
async function resetDemoOutletOperationalState(outletId: string) {
  const activeOrderStatuses: OrderStatus[] = [
    "draft",
    "open",
    "kot_fired",
    "preparing",
    "ready",
    "served",
    "billed",
  ];

  const cancelledOrders = await prisma.order.updateMany({
    where: { outletId, status: { in: activeOrderStatuses } },
    data: { status: "cancelled" },
  });

  await prisma.reservation.updateMany({
    where: {
      outletId,
      status: { in: ["pending", "confirmed", "arrived", "seated"] },
    },
    data: { status: "cancelled" },
  });

  await prisma.waitlistEntry.updateMany({
    where: {
      outletId,
      status: { in: ["waiting", "notified", "seated"] },
    },
    data: { status: "cancelled" },
  });

  const freedTables = await prisma.table.updateMany({
    where: { floorPlan: { outletId } },
    data: { status: TableStatus.free },
  });

  const removedPos = await prisma.purchaseOrder.deleteMany({
    where: {
      outletId,
      poNumber: { notIn: ["PO-REC-001", "PO-OPEN-001"] },
    },
  });

  if (cancelledOrders.count > 0 || freedTables.count > 0 || removedPos.count > 0) {
    console.log(
      `  Dev reset: cancelled ${cancelledOrders.count} active order(s), set ${freedTables.count} table(s) to free, removed ${removedPos.count} stray PO(s)`,
    );
  }
}

/** Reset inventory ledger/commitments so opening-stock seed is authoritative after test runs. */
async function resetDemoOutletInventoryState(outletId: string) {
  await prisma.stockCommitment.deleteMany({ where: { outletId } });
  await prisma.wastageEntry.deleteMany({ where: { outletId } });

  const testStockCounts = await prisma.stockCount.findMany({
    where: { outletId },
    select: { id: true },
  });
  if (testStockCounts.length > 0) {
    await prisma.stockCountLine.deleteMany({
      where: { stockCountId: { in: testStockCounts.map((c) => c.id) } },
    });
    await prisma.stockCount.deleteMany({ where: { outletId } });
  }

  const testGrns = await prisma.goodsReceipt.findMany({
    where: { outletId },
    select: { id: true },
  });
  if (testGrns.length > 0) {
    await prisma.goodsReceiptLine.deleteMany({
      where: { goodsReceiptId: { in: testGrns.map((g) => g.id) } },
    });
    await prisma.goodsReceipt.deleteMany({ where: { outletId } });
  }

  const clearedLedger = await prisma.stockLedger.deleteMany({ where: { outletId } });

  await prisma.ingredient.updateMany({
    where: { outletId },
    data: { committedStock: 0 },
  });

  if (clearedLedger.count > 0) {
    console.log(`  Dev reset: cleared ${clearedLedger.count} stock ledger row(s), commitments, and test GRNs`);
  }
}

type SeedGlAccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

const SEED_CHART_OF_ACCOUNTS: Array<{ code: string; name: string; type: SeedGlAccountType }> = [
  { code: "1000", name: "Cash on Hand", type: "asset" },
  { code: "1010", name: "Bank", type: "asset" },
  { code: "1020", name: "UPI Clearing", type: "asset" },
  { code: "1030", name: "Card Clearing", type: "asset" },
  { code: "1100", name: "Accounts Receivable", type: "asset" },
  { code: "1200", name: "Inventory Asset", type: "asset" },
  { code: "1210", name: "Inventory In Transit", type: "asset" },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2100", name: "GRNI", type: "liability" },
  { code: "2200", name: "Output CGST Payable", type: "liability" },
  { code: "2210", name: "Output SGST Payable", type: "liability" },
  { code: "2220", name: "Output IGST Payable", type: "liability" },
  { code: "2300", name: "Input CGST Receivable", type: "asset" },
  { code: "2310", name: "Input SGST Receivable", type: "asset" },
  { code: "3000", name: "Owner Capital", type: "equity" },
  { code: "3100", name: "Owner Drawings", type: "equity" },
  { code: "3200", name: "Opening Balance Equity", type: "equity" },
  { code: "4000", name: "Restaurant Sales Revenue", type: "revenue" },
  { code: "4900", name: "Inventory Adjustment Gain", type: "revenue" },
  { code: "5000", name: "Cost of Goods Sold", type: "expense" },
  { code: "5100", name: "Inventory Wastage Expense", type: "expense" },
  { code: "5200", name: "Inventory Adjustment Loss", type: "expense" },
  { code: "5300", name: "Operating Expenses", type: "expense" },
];

const SEED_AC = { INVENTORY: "1200", OPENING_EQUITY: "3200" } as const;

/** Clear test journals so opening inventory accounting can be re-seeded idempotently. */
async function resetDemoAccountingState(organizationId: string) {
  await prisma.supplierPayment.deleteMany({ where: { organizationId } });
  await prisma.expense.deleteMany({ where: { organizationId } });
  const entries = await prisma.journalEntry.findMany({
    where: { organizationId },
    select: { id: true },
  });
  if (entries.length > 0) {
    await prisma.journalLine.deleteMany({
      where: { journalEntryId: { in: entries.map((e) => e.id) } },
    });
    const removed = await prisma.journalEntry.deleteMany({ where: { organizationId } });
    console.log(`  Dev reset: cleared ${removed.count} journal entr(ies)`);
  }
}

async function ensureSeedDefaultAccounts(organizationId: string) {
  for (const acct of SEED_CHART_OF_ACCOUNTS) {
    await prisma.glAccount.upsert({
      where: { organizationId_code: { organizationId, code: acct.code } },
      create: { organizationId, code: acct.code, name: acct.name, type: acct.type },
      update: { name: acct.name, type: acct.type, isActive: true },
    });
  }
}

async function postSeedOpeningInventoryJournals(organizationId: string) {
  const outlets = await prisma.outlet.findMany({
    where: { brand: { organizationId }, isActive: true },
    select: { id: true },
  });

  for (const outlet of outlets) {
    const openings = await prisma.stockLedger.findMany({
      where: { outletId: outlet.id, type: "opening_stock" },
      include: { ingredient: true },
    });

    for (const row of openings) {
      const value = Math.round(Number(row.totalValue ?? Number(row.quantity) * Number(row.unitCost ?? 0)) * 100) / 100;
      if (value <= 0) continue;

      const idempotencyKey = `opening-inventory:${outlet.id}:${row.ingredientId}`;
      const existing = await prisma.journalEntry.findUnique({
        where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } },
      });
      if (existing) continue;

      const invAcct = await prisma.glAccount.findUniqueOrThrow({
        where: { organizationId_code: { organizationId, code: SEED_AC.INVENTORY } },
      });
      const eqAcct = await prisma.glAccount.findUniqueOrThrow({
        where: { organizationId_code: { organizationId, code: SEED_AC.OPENING_EQUITY } },
      });

      await prisma.journalEntry.create({
        data: {
          organizationId,
          outletId: outlet.id,
          reference: row.reference ?? `opening:${row.ingredientId}`,
          description: `Opening inventory — ${row.ingredient.name}`,
          sourceEvent: "inventory_opening",
          sourceId: row.id,
          idempotencyKey,
          postingDate: row.createdAt,
          status: "posted",
          lines: {
            create: [
              { glAccountId: invAcct.id, debit: value, outletId: outlet.id },
              { glAccountId: eqAcct.id, credit: value, outletId: outlet.id },
            ],
          },
        },
      });
    }
  }
}

async function bootstrapSeedAccounting(organizationId: string) {
  await ensureSeedDefaultAccounts(organizationId);
  await postSeedOpeningInventoryJournals(organizationId);
}

async function ensureOpeningStock(
  outletId: string,
  ingredientId: string,
  quantity: number,
  unitCost: number,
) {
  const reference = `opening:${ingredientId}`;
  const existing = await prisma.stockLedger.findFirst({
    where: { outletId, ingredientId, type: "opening_stock", reference },
  });

  await prisma.ingredient.update({
    where: { id: ingredientId },
    data: {
      currentStock: quantity,
      weightedAverageCost: unitCost,
      costPerUnit: unitCost,
    },
  });

  if (existing) return existing;

  return prisma.stockLedger.create({
    data: {
      outletId,
      ingredientId,
      type: "opening_stock",
      quantity,
      balanceAfter: quantity,
      reference,
      notes: "Seed opening stock",
      unitCost,
      totalValue: quantity * unitCost,
      reason: "Opening stock entry",
    },
  });
}

async function upsertStaff(input: {
  organizationId: string;
  outletId: string;
  employeeCode: string;
  displayName: string;
  pin: string;
  roles: UserRole[];
  ownerUserId: string;
  userId?: string;
  hasLoginAccess?: boolean;
}) {
  const pinHash = await hashPin(input.pin);
  const profile = await prisma.staffProfile.upsert({
    where: {
      organizationId_employeeCode: {
        organizationId: input.organizationId,
        employeeCode: input.employeeCode,
      },
    },
    update: {
      displayName: input.displayName,
      legalName: input.displayName,
      firstName: input.displayName.split(" ").slice(-1)[0],
      outletId: input.outletId,
      isActive: true,
      hasLoginAccess: input.hasLoginAccess ?? false,
      userId: input.userId ?? null,
      pinHash,
      pinSetAt: new Date(),
      pinUpdatedByUserId: input.ownerUserId,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    },
    create: {
      organizationId: input.organizationId,
      outletId: input.outletId,
      employeeCode: input.employeeCode,
      displayName: input.displayName,
      legalName: input.displayName,
      firstName: input.displayName.split(" ").slice(-1)[0],
      isActive: true,
      hasLoginAccess: input.hasLoginAccess ?? false,
      userId: input.userId,
      pinHash,
      pinSetAt: new Date(),
      pinUpdatedByUserId: input.ownerUserId,
    },
  });

  for (const role of input.roles) {
    await prisma.staffRoleAssignment.upsert({
      where: {
        staffProfileId_outletId_role: {
          staffProfileId: profile.id,
          outletId: input.outletId,
          role,
        },
      },
      update: { permissions: [] },
      create: {
        staffProfileId: profile.id,
        organizationId: input.organizationId,
        outletId: input.outletId,
        role,
        permissions: [],
      },
    });
  }

  const allowedRoles = new Set(input.roles);
  const stale = await prisma.staffRoleAssignment.findMany({
    where: { staffProfileId: profile.id, outletId: input.outletId },
  });
  for (const row of stale) {
    if (!allowedRoles.has(row.role)) {
      await prisma.staffRoleAssignment.delete({ where: { id: row.id } });
    }
  }

  return profile;
}

async function upsertTerminal(input: {
  outletId: string;
  code: string;
  name: string;
  deviceType: "pos" | "kds" | "captain";
  isMaster?: boolean;
  registeredByUserId: string;
  deviceSecret: string;
}) {
  const deviceSecretHash = await hashPassword(input.deviceSecret);
  return prisma.terminal.upsert({
    where: { outletId_code: { outletId: input.outletId, code: input.code } },
    update: {
      name: input.name,
      deviceType: input.deviceType,
      isMaster: input.isMaster ?? false,
      isActive: true,
      isRegistered: true,
      deviceSecretHash,
      registeredAt: new Date(),
      registeredByUserId: input.registeredByUserId,
      activationCode: null,
      activationCodeExpiresAt: null,
      revokedAt: null,
    },
    create: {
      outletId: input.outletId,
      code: input.code,
      name: input.name,
      deviceType: input.deviceType,
      isMaster: input.isMaster ?? false,
      isActive: true,
      isRegistered: true,
      deviceSecretHash,
      registeredAt: new Date(),
      registeredByUserId: input.registeredByUserId,
    },
  });
}

async function upsertRecipe(
  menuItemId: string,
  items: Array<{ ingredientId: string; quantity: number; lossPct?: number }>,
) {
  const recipe = await prisma.recipe.upsert({
    where: { menuItemId },
    update: { yieldQty: 1, isActive: true },
    create: { menuItemId, yieldQty: 1 },
  });

  for (const item of items) {
    const existing = await prisma.recipeItem.findFirst({
      where: { recipeId: recipe.id, ingredientId: item.ingredientId },
    });
    if (existing) {
      await prisma.recipeItem.update({
        where: { id: existing.id },
        data: { quantity: item.quantity, lossPct: item.lossPct ?? 0 },
      });
    } else {
      await prisma.recipeItem.create({
        data: {
          recipeId: recipe.id,
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          lossPct: item.lossPct ?? 0,
          stage: 1,
        },
      });
    }
  }
}

async function resolveCapabilitiesForOrg(organizationId: string) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { moduleOverrides: true, featureOverrides: true },
  });

  const modules = { ...LEGACY_FULL_MODULES };
  const features = { ...LEGACY_FULL_FEATURES };

  for (const override of org.moduleOverrides) {
    if (override.moduleKey in modules) {
      modules[override.moduleKey as ModuleKey] = override.enabled;
    }
  }

  const now = Date.now();
  for (const override of org.featureOverrides) {
    if (override.expiresAt && override.expiresAt.getTime() < now) continue;
    if (override.state === "ENABLED") features[override.featureKey as keyof typeof features] = true;
    if (override.state === "DISABLED" || override.state === "READ_ONLY") {
      features[override.featureKey as keyof typeof features] = false;
    }
  }

  return {
    organizationId: org.id,
    operatingMode: org.operatingMode,
    subscriptionPlan: org.subscriptionPlan,
    configVersion: org.configVersion,
    modules,
    features,
    navDepth: MODE_NAV_DEPTH[org.operatingMode],
  };
}

async function main() {
  console.log("Seeding Kaana Demo Restaurant (Step 2 development tenant)...");

  const passwordHash = await hashPassword(DEV_PASSWORD);

  const platformOrg = await prisma.organization.upsert({
    where: { slug: "kaana-platform" },
    update: {
      name: "Kaana Platform",
      isActive: true,
      operatingMode: "ENTERPRISE",
      subscriptionPlan: "ENTERPRISE",
    },
    create: {
      name: "Kaana Platform",
      slug: "kaana-platform",
      operatingMode: "ENTERPRISE",
      subscriptionPlan: "ENTERPRISE",
    },
  });

  const platformAdmin = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: platformOrg.id,
        email: "admin@kaanafoods.in",
      },
    },
    update: {
      passwordHash,
      firstName: "Kaana",
      lastName: "Admin",
      isActive: true,
    },
    create: {
      organizationId: platformOrg.id,
      email: "admin@kaanafoods.in",
      passwordHash,
      firstName: "Kaana",
      lastName: "Admin",
    },
  });

  await prisma.roleAssignment.deleteMany({
    where: { userId: platformAdmin.id },
  });
  await prisma.roleAssignment.create({
    data: {
      userId: platformAdmin.id,
      organizationId: platformOrg.id,
      role: UserRole.super_admin,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: {
      name: "Kaana Demo Restaurant",
      operatingMode: "SIMPLE",
      subscriptionPlan: "LEGACY_FULL",
      configVersion: 1,
      isActive: true,
      gstin: "29AABCK1234F1Z5",
      address: "42 Restaurant Street",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560001",
      phone: "+919876543210",
      email: "owner@kaanafoods.in",
    },
    create: {
      name: "Kaana Demo Restaurant",
      slug: ORG_SLUG,
      operatingMode: "SIMPLE",
      subscriptionPlan: "LEGACY_FULL",
      configVersion: 1,
      gstin: "29AABCK1234F1Z5",
      address: "42 Restaurant Street",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560001",
      phone: "+919876543210",
      email: "owner@kaanafoods.in",
    },
  });

  await prisma.restaurantModuleOverride.deleteMany({ where: { organizationId: org.id } });
  await prisma.restaurantFeatureOverride.deleteMany({ where: { organizationId: org.id } });

  const brand = await prisma.brand.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: BRAND_SLUG } },
    update: { name: "Kaana Demo Restaurant", isActive: true },
    create: {
      organizationId: org.id,
      name: "Kaana Demo Restaurant",
      slug: BRAND_SLUG,
      description: "Primary development restaurant for E2E testing",
    },
  });

  const outlet = await prisma.outlet.upsert({
    where: { brandId_code: { brandId: brand.id, code: OUTLET_CODE } },
    update: {
      name: "Main Outlet",
      type: OutletType.dine_in,
      isActive: true,
      address: "42 Restaurant Street",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560001",
      gstin: "29AABCK1234F1Z5",
      settings: {
        billingMode: "cashier_settles",
        inventoryPolicy: "warn",
        supportsTakeaway: true,
        supportsDelivery: true,
      },
    },
    create: {
      brandId: brand.id,
      name: "Main Outlet",
      code: OUTLET_CODE,
      type: OutletType.dine_in,
      address: "42 Restaurant Street",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560001",
      gstin: "29AABCK1234F1Z5",
      settings: {
        billingMode: "cashier_settles",
        inventoryPolicy: "warn",
        supportsTakeaway: true,
        supportsDelivery: true,
      },
    },
  });

  await prisma.outlet.updateMany({
    where: { brandId: brand.id, code: { not: OUTLET_CODE } },
    data: { isActive: false },
  });

  await resetDemoOutletOperationalState(outlet.id);

  const owner = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "owner@kaanafoods.in" } },
    update: {
      passwordHash,
      firstName: "Demo",
      lastName: "Owner",
      isActive: true,
    },
    create: {
      organizationId: org.id,
      email: "owner@kaanafoods.in",
      phone: "+919876543210",
      passwordHash,
      firstName: "Demo",
      lastName: "Owner",
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "manager@kaanafoods.in" } },
    update: {
      passwordHash,
      firstName: "Demo",
      lastName: "Manager",
      isActive: true,
    },
    create: {
      organizationId: org.id,
      email: "manager@kaanafoods.in",
      phone: "+919876543211",
      passwordHash,
      firstName: "Demo",
      lastName: "Manager",
    },
  });

  await prisma.roleAssignment.upsert({
    where: { id: "seed-demo-owner-role" },
    update: { userId: owner.id, organizationId: org.id, outletId: null, role: UserRole.owner },
    create: {
      id: "seed-demo-owner-role",
      userId: owner.id,
      organizationId: org.id,
      role: UserRole.owner,
    },
  });

  await prisma.roleAssignment.upsert({
    where: { id: "seed-demo-manager-role" },
    update: {
      userId: managerUser.id,
      organizationId: org.id,
      outletId: outlet.id,
      role: UserRole.manager,
    },
    create: {
      id: "seed-demo-manager-role",
      userId: managerUser.id,
      organizationId: org.id,
      outletId: outlet.id,
      role: UserRole.manager,
    },
  });

  await prisma.user.updateMany({
    where: {
      organizationId: org.id,
      email: {
        notIn: ["owner@kaanafoods.in", "manager@kaanafoods.in"],
      },
    },
    data: { isActive: false },
  });

  await prisma.staffProfile.updateMany({
    where: { userId: { in: [owner.id, managerUser.id] } },
    data: { userId: null, hasLoginAccess: false },
  });

  const stations = await Promise.all([
    prisma.kitchenStation.upsert({
      where: { outletId_code: { outletId: outlet.id, code: "MAIN" } },
      update: { name: "Main Kitchen", sortOrder: 1 },
      create: { outletId: outlet.id, name: "Main Kitchen", code: "MAIN", sortOrder: 1 },
    }),
    prisma.kitchenStation.upsert({
      where: { outletId_code: { outletId: outlet.id, code: "TANDOOR" } },
      update: { name: "Tandoor", sortOrder: 2 },
      create: { outletId: outlet.id, name: "Tandoor", code: "TANDOOR", sortOrder: 2 },
    }),
    prisma.kitchenStation.upsert({
      where: { outletId_code: { outletId: outlet.id, code: "BAR" } },
      update: { name: "Bar", sortOrder: 3 },
      create: { outletId: outlet.id, name: "Bar", code: "BAR", sortOrder: 3 },
    }),
  ]);

  const floorPlan = await prisma.floorPlan.upsert({
    where: { id: "seed-fp-main-dining" },
    update: { name: "Main Dining", isDefault: true, outletId: outlet.id },
    create: {
      id: "seed-fp-main-dining",
      outletId: outlet.id,
      name: "Main Dining",
      isDefault: true,
    },
  });

  const tableSpecs = [
    { number: "1", capacity: 2 },
    { number: "2", capacity: 2 },
    { number: "3", capacity: 4 },
    { number: "4", capacity: 4 },
    { number: "5", capacity: 6 },
    { number: "6", capacity: 8 },
  ];

  for (const [i, spec] of tableSpecs.entries()) {
    const existing = await prisma.table.findFirst({
      where: { floorPlanId: floorPlan.id, number: spec.number },
    });
    if (existing) {
      await prisma.table.update({
        where: { id: existing.id },
        data: {
          name: `Table ${spec.number}`,
          capacity: spec.capacity,
          status: TableStatus.free,
          isActive: true,
          posX: (i % 3) * 120,
          posY: Math.floor(i / 3) * 120,
        },
      });
    } else {
      await prisma.table.create({
        data: {
          floorPlanId: floorPlan.id,
          number: spec.number,
          name: `Table ${spec.number}`,
          capacity: spec.capacity,
          status: TableStatus.free,
          posX: (i % 3) * 120,
          posY: Math.floor(i / 3) * 120,
        },
      });
    }
  }

  await resetDemoOutletOperationalState(outlet.id);
  await resetDemoOutletInventoryState(outlet.id);
  await resetDemoAccountingState(org.id);

  const taxRule = await prisma.taxRule.upsert({
    where: { id: "seed-tax-gst5" },
    update: {
      name: "GST 5% (CGST+SGST)",
      type: "cgst_sgst",
      cgstRate: 2.5,
      sgstRate: 2.5,
      isActive: true,
    },
    create: {
      id: "seed-tax-gst5",
      name: "GST 5% (CGST+SGST)",
      type: "cgst_sgst",
      cgstRate: 2.5,
      sgstRate: 2.5,
      isActive: true,
    },
  });

  const menu = await prisma.menu.upsert({
    where: { id: "seed-menu-demo" },
    update: { brandId: brand.id, name: "Demo Menu", isActive: true },
    create: { id: "seed-menu-demo", brandId: brand.id, name: "Demo Menu" },
  });

  const categoryDefs = [
    { id: "seed-cat-starters", name: "Starters", sortOrder: 1 },
    { id: "seed-cat-main", name: "Main Course", sortOrder: 2 },
    { id: "seed-cat-biryani", name: "Rice & Biryani", sortOrder: 3 },
    { id: "seed-cat-breads", name: "Breads", sortOrder: 4 },
    { id: "seed-cat-beverages", name: "Beverages", sortOrder: 5 },
    { id: "seed-cat-desserts", name: "Desserts", sortOrder: 6 },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoryDefs) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: { menuId: menu.id, name: cat.name, sortOrder: cat.sortOrder, isActive: true },
      create: {
        id: cat.id,
        menuId: menu.id,
        name: cat.name,
        sortOrder: cat.sortOrder,
      },
    });
    categories[cat.name] = cat.id;
  }

  const menuItemDefs: Array<{
    sku: string;
    name: string;
    category: string;
    price: number;
    isVeg: boolean;
    stationIdx: number;
    hsnCode?: string;
  }> = [
    { sku: "DEMO-001", name: "Veg Manchurian", category: "Starters", price: 220, isVeg: true, stationIdx: 0 },
    { sku: "DEMO-002", name: "Chicken 65", category: "Starters", price: 280, isVeg: false, stationIdx: 0 },
    { sku: "DEMO-003", name: "Paneer Butter Masala", category: "Main Course", price: 320, isVeg: true, stationIdx: 1 },
    { sku: "DEMO-004", name: "Chicken Curry", category: "Main Course", price: 340, isVeg: false, stationIdx: 1 },
    { sku: "DEMO-005", name: "Veg Biryani", category: "Rice & Biryani", price: 260, isVeg: true, stationIdx: 1 },
    { sku: "DEMO-006", name: "Chicken Biryani", category: "Rice & Biryani", price: 320, isVeg: false, stationIdx: 1 },
    { sku: "DEMO-007", name: "Plain Rice", category: "Rice & Biryani", price: 120, isVeg: true, stationIdx: 1 },
    { sku: "DEMO-008", name: "Butter Naan", category: "Breads", price: 55, isVeg: true, stationIdx: 2 },
    { sku: "DEMO-009", name: "Roti", category: "Breads", price: 35, isVeg: true, stationIdx: 2 },
    { sku: "DEMO-010", name: "Lime Soda", category: "Beverages", price: 60, isVeg: true, stationIdx: 2 },
    { sku: "DEMO-011", name: "Mineral Water", category: "Beverages", price: 30, isVeg: true, stationIdx: 2 },
    { sku: "DEMO-012", name: "Gulab Jamun", category: "Desserts", price: 120, isVeg: true, stationIdx: 2 },
  ];

  const menuItems: Record<string, string> = {};
  for (const item of menuItemDefs) {
    const categoryId = categories[item.category];
    const existing = await prisma.menuItem.findFirst({
      where: { sku: item.sku, category: { menuId: menu.id } },
    });
    const data = {
      categoryId,
      kitchenStationId: stations[item.stationIdx].id,
      name: item.name,
      sku: item.sku,
      basePrice: item.price,
      taxRuleId: taxRule.id,
      isVeg: item.isVeg,
      isActive: true,
      hsnCode: item.hsnCode ?? "996331",
    };
    const saved = existing
      ? await prisma.menuItem.update({ where: { id: existing.id }, data })
      : await prisma.menuItem.create({ data });
    menuItems[item.name] = saved.id;
  }

  const supplierDefs = [
    { name: "Fresh Poultry Suppliers", phone: "+919900001001" },
    { name: "Sri Lakshmi Groceries", phone: "+919900001002", gstin: "29AABCS1234G1Z5" },
    { name: "Daily Fresh Vegetables", phone: "+919900001003" },
  ];

  const suppliers: Record<string, string> = {};
  for (const s of supplierDefs) {
    const existing = await prisma.supplier.findFirst({
      where: { outletId: outlet.id, name: s.name },
    });
    const saved = existing
      ? await prisma.supplier.update({
          where: { id: existing.id },
          data: { phone: s.phone, gstin: s.gstin, isActive: true },
        })
      : await prisma.supplier.create({
          data: { outletId: outlet.id, name: s.name, phone: s.phone, gstin: s.gstin },
        });
    suppliers[s.name] = saved.id;
  }

  const ingCat = await prisma.ingredientCategory.upsert({
    where: { outletId_name: { outletId: outlet.id, name: "Raw Materials" } },
    update: {},
    create: { outletId: outlet.id, name: "Raw Materials", sortOrder: 1 },
  });

  type IngDef = {
    name: string;
    unit: string;
    consumptionUnit?: string;
    openingQty: number;
    costPerUnit: number;
    supplier?: string;
  };

  const ingredientDefs: IngDef[] = [
    { name: "Rice", unit: "kg", consumptionUnit: "g", openingQty: 25, costPerUnit: 65, supplier: "Sri Lakshmi Groceries" },
    { name: "Chicken", unit: "kg", consumptionUnit: "g", openingQty: 20, costPerUnit: 280, supplier: "Fresh Poultry Suppliers" },
    { name: "Paneer", unit: "kg", consumptionUnit: "g", openingQty: 10, costPerUnit: 320, supplier: "Sri Lakshmi Groceries" },
    { name: "Tomato", unit: "kg", consumptionUnit: "g", openingQty: 15, costPerUnit: 40, supplier: "Daily Fresh Vegetables" },
    { name: "Onion", unit: "kg", consumptionUnit: "g", openingQty: 20, costPerUnit: 35, supplier: "Daily Fresh Vegetables" },
    { name: "Cooking Oil", unit: "L", consumptionUnit: "ml", openingQty: 15, costPerUnit: 160, supplier: "Sri Lakshmi Groceries" },
    { name: "Butter", unit: "kg", consumptionUnit: "g", openingQty: 5, costPerUnit: 520, supplier: "Sri Lakshmi Groceries" },
    { name: "Flour", unit: "kg", consumptionUnit: "g", openingQty: 20, costPerUnit: 45, supplier: "Sri Lakshmi Groceries" },
    { name: "Spices", unit: "kg", consumptionUnit: "g", openingQty: 5, costPerUnit: 450, supplier: "Sri Lakshmi Groceries" },
    { name: "Lemon", unit: "pcs", consumptionUnit: "pcs", openingQty: 100, costPerUnit: 5, supplier: "Daily Fresh Vegetables" },
    { name: "Sugar", unit: "kg", consumptionUnit: "g", openingQty: 10, costPerUnit: 50, supplier: "Sri Lakshmi Groceries" },
    { name: "Mineral Water", unit: "pcs", consumptionUnit: "pcs", openingQty: 100, costPerUnit: 15, supplier: "Sri Lakshmi Groceries" },
  ];

  const ingredients: Record<string, string> = {};
  for (const ing of ingredientDefs) {
    const existing = await prisma.ingredient.findFirst({
      where: { outletId: outlet.id, name: ing.name },
    });
    const saved = existing
      ? await prisma.ingredient.update({
          where: { id: existing.id },
          data: {
            unit: ing.unit,
            consumptionUnit: ing.consumptionUnit ?? ing.unit,
            categoryId: ingCat.id,
            supplierId: ing.supplier ? suppliers[ing.supplier] : undefined,
            isActive: true,
            minStock: ing.openingQty * 0.1,
            reorderLevel: ing.openingQty * 0.15,
          },
        })
      : await prisma.ingredient.create({
          data: {
            outletId: outlet.id,
            name: ing.name,
            unit: ing.unit,
            consumptionUnit: ing.consumptionUnit ?? ing.unit,
            categoryId: ingCat.id,
            supplierId: ing.supplier ? suppliers[ing.supplier] : undefined,
            minStock: ing.openingQty * 0.1,
            reorderLevel: ing.openingQty * 0.15,
          },
        });
    ingredients[ing.name] = saved.id;
    await ensureOpeningStock(outlet.id, saved.id, ing.openingQty, ing.costPerUnit);
  }

  await bootstrapSeedAccounting(org.id);

  await upsertRecipe(menuItems["Chicken Biryani"], [
    { ingredientId: ingredients["Rice"], quantity: 250 },
    { ingredientId: ingredients["Chicken"], quantity: 180 },
    { ingredientId: ingredients["Onion"], quantity: 60 },
    { ingredientId: ingredients["Cooking Oil"], quantity: 20 },
    { ingredientId: ingredients["Spices"], quantity: 15 },
  ]);

  await upsertRecipe(menuItems["Veg Biryani"], [
    { ingredientId: ingredients["Rice"], quantity: 250 },
    { ingredientId: ingredients["Onion"], quantity: 60 },
    { ingredientId: ingredients["Tomato"], quantity: 40 },
    { ingredientId: ingredients["Cooking Oil"], quantity: 20 },
    { ingredientId: ingredients["Spices"], quantity: 12 },
  ]);

  await upsertRecipe(menuItems["Paneer Butter Masala"], [
    { ingredientId: ingredients["Paneer"], quantity: 180 },
    { ingredientId: ingredients["Tomato"], quantity: 120 },
    { ingredientId: ingredients["Butter"], quantity: 40 },
    { ingredientId: ingredients["Onion"], quantity: 50 },
    { ingredientId: ingredients["Spices"], quantity: 10 },
  ]);

  await upsertRecipe(menuItems["Chicken Curry"], [
    { ingredientId: ingredients["Chicken"], quantity: 200 },
    { ingredientId: ingredients["Tomato"], quantity: 100 },
    { ingredientId: ingredients["Onion"], quantity: 70 },
    { ingredientId: ingredients["Cooking Oil"], quantity: 25 },
    { ingredientId: ingredients["Spices"], quantity: 12 },
  ]);

  await upsertRecipe(menuItems["Butter Naan"], [
    { ingredientId: ingredients["Flour"], quantity: 120 },
    { ingredientId: ingredients["Butter"], quantity: 15 },
  ]);

  const receivedPo = await prisma.purchaseOrder.upsert({
    where: { outletId_poNumber: { outletId: outlet.id, poNumber: "PO-REC-001" } },
    update: {
      supplierId: suppliers["Fresh Poultry Suppliers"],
      status: "received",
      totalAmount: 5600,
      orderedAt: new Date(Date.now() - 7 * 86400000),
      receivedAt: new Date(Date.now() - 6 * 86400000),
    },
    create: {
      outletId: outlet.id,
      supplierId: suppliers["Fresh Poultry Suppliers"],
      poNumber: "PO-REC-001",
      status: "received",
      totalAmount: 5600,
      orderedAt: new Date(Date.now() - 7 * 86400000),
      receivedAt: new Date(Date.now() - 6 * 86400000),
      items: {
        create: [
          {
            ingredientId: ingredients["Chicken"],
            quantity: 20,
            receivedQty: 20,
            unitPrice: 280,
            totalPrice: 5600,
          },
        ],
      },
    },
    include: { items: true },
  });

  if (receivedPo.items.length === 0) {
    await prisma.pOItem.create({
      data: {
        purchaseOrderId: receivedPo.id,
        ingredientId: ingredients["Chicken"],
        quantity: 20,
        receivedQty: 20,
        unitPrice: 280,
        totalPrice: 5600,
      },
    });
  }

  const pendingPo = await prisma.purchaseOrder.upsert({
    where: { outletId_poNumber: { outletId: outlet.id, poNumber: "PO-OPEN-001" } },
    update: {
      supplierId: suppliers["Sri Lakshmi Groceries"],
      status: "sent",
      totalAmount: 3250,
      orderedAt: new Date(),
    },
    create: {
      outletId: outlet.id,
      supplierId: suppliers["Sri Lakshmi Groceries"],
      poNumber: "PO-OPEN-001",
      status: "sent",
      totalAmount: 3250,
      orderedAt: new Date(),
      items: {
        create: [
          {
            ingredientId: ingredients["Rice"],
            quantity: 50,
            unitPrice: 65,
            totalPrice: 3250,
          },
        ],
      },
    },
  });

  const posTerminal = await upsertTerminal({
    outletId: outlet.id,
    code: "POS-01",
    name: "POS-01",
    deviceType: "pos",
    isMaster: true,
    registeredByUserId: owner.id,
    deviceSecret: DEV_DEVICE_SECRETS["POS-01"],
  });

  const kdsTerminal = await upsertTerminal({
    outletId: outlet.id,
    code: "KDS-01",
    name: "KDS-01",
    deviceType: "kds",
    registeredByUserId: owner.id,
    deviceSecret: DEV_DEVICE_SECRETS["KDS-01"],
  });

  const captainTerminal = await upsertTerminal({
    outletId: outlet.id,
    code: "CAPTAIN-01",
    name: "CAPTAIN-01",
    deviceType: "captain",
    registeredByUserId: owner.id,
    deviceSecret: DEV_DEVICE_SECRETS["CAPTAIN-01"],
  });

  await prisma.terminal.updateMany({
    where: {
      outletId: outlet.id,
      code: { notIn: ["POS-01", "KDS-01", "CAPTAIN-01"] },
    },
    data: { isActive: false },
  });

  const cashier = await upsertStaff({
    organizationId: org.id,
    outletId: outlet.id,
    employeeCode: "EMP001",
    displayName: "Demo Cashier",
    pin: STAFF_PINS.EMP001,
    roles: [UserRole.biller],
    ownerUserId: owner.id,
  });

  const captainStaff = await upsertStaff({
    organizationId: org.id,
    outletId: outlet.id,
    employeeCode: "EMP002",
    displayName: "Demo Captain",
    pin: STAFF_PINS.EMP002,
    roles: [UserRole.captain],
    ownerUserId: owner.id,
  });

  const chefStaff = await upsertStaff({
    organizationId: org.id,
    outletId: outlet.id,
    employeeCode: "EMP003",
    displayName: "Demo Chef",
    pin: STAFF_PINS.EMP003,
    roles: [UserRole.chef],
    ownerUserId: owner.id,
  });

  const floorManager = await upsertStaff({
    organizationId: org.id,
    outletId: outlet.id,
    employeeCode: "EMP004",
    displayName: "Demo Floor Manager",
    pin: STAFF_PINS.EMP004,
    roles: [UserRole.biller, UserRole.captain, UserRole.chef],
    ownerUserId: owner.id,
  });

  await prisma.staffProfile.updateMany({
    where: {
      organizationId: org.id,
      employeeCode: { notIn: ["EMP001", "EMP002", "EMP003", "EMP004"] },
    },
    data: { isActive: false },
  });

  await prisma.invoiceSequence.upsert({
    where: { outletId_year: { outletId: outlet.id, year: new Date().getFullYear() } },
    update: {},
    create: {
      outletId: outlet.id,
      prefix: "INV",
      year: new Date().getFullYear(),
      lastNumber: 0,
    },
  });

  const capabilities = await resolveCapabilitiesForOrg(org.id);

  const counts = {
    organizations: await prisma.organization.count({ where: { slug: ORG_SLUG } }),
    activeOutlets: await prisma.outlet.count({ where: { brandId: brand.id, isActive: true } }),
    staffProfiles: await prisma.staffProfile.count({
      where: { organizationId: org.id, isActive: true, employeeCode: { startsWith: "EMP" } },
    }),
    tables: await prisma.table.count({ where: { floorPlan: { outletId: outlet.id } } }),
    menuItems: await prisma.menuItem.count({ where: { category: { menuId: menu.id } } }),
    ingredients: await prisma.ingredient.count({ where: { outletId: outlet.id, isActive: true } }),
    suppliers: await prisma.supplier.count({ where: { outletId: outlet.id, isActive: true } }),
    recipes: await prisma.recipe.count({ where: { menuItem: { category: { menuId: menu.id } } } }),
    terminals: await prisma.terminal.count({ where: { outletId: outlet.id, isActive: true } }),
    purchaseOrders: await prisma.purchaseOrder.count({ where: { outletId: outlet.id } }),
  };

  const stockSample = await prisma.ingredient.findFirst({
    where: { outletId: outlet.id, currentStock: { gt: 0 } },
    select: { name: true, currentStock: true, unit: true },
  });

  const freeTables = await prisma.table.count({
    where: { floorPlan: { outletId: outlet.id }, status: TableStatus.free },
  });
  const liveOrders = await prisma.order.count({
    where: {
      outletId: outlet.id,
      status: { in: ["open", "kot_fired", "preparing", "ready", "served", "billed"] },
    },
  });

  console.log("\n=== Kaana Demo Restaurant seed complete ===\n");
  console.log("Platform admin (HQ): admin@kaanafoods.in / password123");
  console.log("Organization:", org.name, org.id);
  console.log("Operating mode:", org.operatingMode, "| Plan:", org.subscriptionPlan, "| configVersion:", org.configVersion);
  console.log("Outlet:", outlet.name, outlet.id);
  console.log("\nAccounts (password: password123):");
  console.log("  Owner:   owner@kaanafoods.in");
  console.log("  Manager: manager@kaanafoods.in");
  console.log("\nOperational staff (PIN login on registered terminals):");
  console.log("  EMP001 Demo Cashier       PIN 1111  roles: biller (POS)");
  console.log("  EMP002 Demo Captain       PIN 2222  roles: captain");
  console.log("  EMP003 Demo Chef          PIN 3333  roles: chef (KDS)");
  console.log("  EMP004 Demo Floor Manager PIN 4444  roles: biller+captain+chef");
  console.log("\nTerminals (pre-registered for dev — use Terminal auth header):");
  console.log(`  POS-01     id=${posTerminal.id}  secret=${DEV_DEVICE_SECRETS["POS-01"]}`);
  console.log(`  KDS-01     id=${kdsTerminal.id}  secret=${DEV_DEVICE_SECRETS["KDS-01"]}`);
  console.log(`  CAPTAIN-01 id=${captainTerminal.id}  secret=${DEV_DEVICE_SECRETS["CAPTAIN-01"]}`);
  console.log("\nTax: GST 5% split CGST 2.5% + SGST 2.5% (HSN 996331 on menu items)");
  console.log("\nPurchase orders:");
  console.log(`  ${receivedPo.poNumber} status=received`);
  console.log(`  ${pendingPo.poNumber} status=sent (open)`);
  console.log(`\nFloor baseline: ${freeTables}/${counts.tables} tables free, ${liveOrders} live order(s)`);
  console.log("\nEntity counts:", JSON.stringify(counts));
  console.log("Sample stock:", stockSample);
  console.log("\nResolved capabilities (SIMPLE + LEGACY_FULL):");
  console.log("  navDepth:", capabilities.navDepth);
  console.log("  modules:", Object.entries(capabilities.modules).filter(([, v]) => v).map(([k]) => k).join(", "));
  console.log("  core features enabled:", Object.entries(capabilities.features).filter(([, v]) => v).length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
