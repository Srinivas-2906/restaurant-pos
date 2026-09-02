import { PrismaClient, UserRole, OutletType } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Kaana Foods database...");

  const org = await prisma.organization.upsert({
    where: { slug: "kaana-demo" },
    update: {},
    create: {
      name: "Kaana Foods Demo",
      slug: "kaana-demo",
      gstin: "29AABCK1234F1Z5",
      address: "123 MG Road",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560001",
      phone: "+919876543210",
      email: "demo@kaanafoods.in",
    },
  });

  const brand = await prisma.brand.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "kaana-kitchen" } },
    update: {},
    create: {
      organizationId: org.id,
      name: "Kaana Kitchen",
      slug: "kaana-kitchen",
      description: "Authentic Indian cuisine",
    },
  });

  const passwordHash = await bcrypt.hash("password123", 10);

  const owner = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "owner@kaanafoods.in" } },
    update: {},
    create: {
      organizationId: org.id,
      email: "owner@kaanafoods.in",
      phone: "+919876543210",
      passwordHash,
      firstName: "Raj",
      lastName: "Kumar",
    },
  });

  const biller = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "biller@kaanafoods.in" } },
    update: {},
    create: {
      organizationId: org.id,
      email: "biller@kaanafoods.in",
      phone: "+919876543211",
      passwordHash,
      firstName: "Priya",
      lastName: "Sharma",
    },
  });

  const captain = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "captain@kaanafoods.in" } },
    update: {},
    create: {
      organizationId: org.id,
      email: "captain@kaanafoods.in",
      phone: "+919876543212",
      passwordHash,
      firstName: "Amit",
      lastName: "Singh",
    },
  });

  const chef = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "chef@kaanafoods.in" } },
    update: {},
    create: {
      organizationId: org.id,
      email: "chef@kaanafoods.in",
      phone: "+919876543216",
      passwordHash,
      firstName: "Ravi",
      lastName: "Nair",
    },
  });

  const outlets = await Promise.all([
    prisma.outlet.upsert({
      where: { brandId_code: { brandId: brand.id, code: "BLR-001" } },
      update: {},
      create: {
        brandId: brand.id,
        name: "Kaana Kitchen - Indiranagar",
        code: "BLR-001",
        type: OutletType.dine_in,
        address: "100 12th Main, Indiranagar",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560038",
        gstin: "29AABCK1234F1Z5",
        zone: "South Bangalore",
      },
    }),
    prisma.outlet.upsert({
      where: { brandId_code: { brandId: brand.id, code: "BLR-CK" } },
      update: {},
      create: {
        brandId: brand.id,
        name: "Kaana Cloud Kitchen",
        code: "BLR-CK",
        type: OutletType.cloud_kitchen,
        address: "Whitefield Industrial Area",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560066",
        zone: "East Bangalore",
      },
    }),
    prisma.outlet.upsert({
      where: { brandId_code: { brandId: brand.id, code: "BLR-CK2" } },
      update: {},
      create: {
        brandId: brand.id,
        name: "Kaana Central Kitchen",
        code: "BLR-CK2",
        type: OutletType.central_kitchen,
        address: "Hoskote Food Park",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "562114",
        zone: "Central",
      },
    }),
  ]);

  const dineInOutlet = outlets[0];

  await Promise.all([
    prisma.roleAssignment.upsert({
      where: { id: "seed-owner-role" },
      update: {},
      create: {
        id: "seed-owner-role",
        userId: owner.id,
        organizationId: org.id,
        role: UserRole.owner,
      },
    }),
    prisma.roleAssignment.upsert({
      where: { id: "seed-biller-role" },
      update: {},
      create: {
        id: "seed-biller-role",
        userId: biller.id,
        organizationId: org.id,
        outletId: dineInOutlet.id,
        role: UserRole.biller,
      },
    }),
    prisma.roleAssignment.upsert({
      where: { id: "seed-captain-role" },
      update: {},
      create: {
        id: "seed-captain-role",
        userId: captain.id,
        organizationId: org.id,
        outletId: dineInOutlet.id,
        role: UserRole.captain,
      },
    }),
    prisma.roleAssignment.upsert({
      where: { id: "seed-chef-role" },
      update: {},
      create: {
        id: "seed-chef-role",
        userId: chef.id,
        organizationId: org.id,
        outletId: dineInOutlet.id,
        role: UserRole.chef,
      },
    }),
  ]);

  const terminal = await prisma.terminal.findFirst({
    where: { outletId: dineInOutlet.id, code: "T1" },
  }) ?? await prisma.terminal.create({
    data: {
      outletId: dineInOutlet.id,
      name: "Counter",
      code: "T1",
      isMaster: true,
      deviceType: "pos",
    },
  });

  await prisma.terminal.updateMany({
    where: { outletId: dineInOutlet.id, code: "T1" },
    data: { name: "Counter", isMaster: true, deviceType: "pos" },
  });

  await prisma.terminal.deleteMany({ where: { outletId: dineInOutlet.id, code: "T2" } });

  const demoTerminalSecret = "kaana-demo-terminal-secret";
  const demoPinHash = await bcrypt.hash("4821", 10);
  const demoDeviceSecretHash = await bcrypt.hash(demoTerminalSecret, 10);
  await prisma.terminal.update({
    where: { id: terminal.id },
    data: {
      name: "Counter",
      deviceType: "pos",
      isMaster: true,
      isRegistered: true,
      deviceSecretHash: demoDeviceSecretHash,
      registeredAt: new Date(),
      registeredByUserId: manager.id,
    },
  });

  let stations = await prisma.kitchenStation.findMany({ where: { outletId: dineInOutlet.id } });

  if (stations.length === 0) {
  stations = await Promise.all([
    prisma.kitchenStation.create({
      data: { outletId: dineInOutlet.id, name: "Tandoor", code: "TANDOOR", sortOrder: 1 },
    }),
    prisma.kitchenStation.create({
      data: { outletId: dineInOutlet.id, name: "Main Kitchen", code: "MAIN", sortOrder: 2 },
    }),
    prisma.kitchenStation.create({
      data: { outletId: dineInOutlet.id, name: "Bar", code: "BAR", sortOrder: 3 },
    }),
  ]);

  const floorPlan = await prisma.floorPlan.create({
    data: {
      outletId: dineInOutlet.id,
      name: "Ground Floor",
      isDefault: true,
    },
  });

  await Promise.all(
    ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"].map((num, i) =>
      prisma.table.create({
        data: {
          floorPlanId: floorPlan.id,
          number: num,
          capacity: i < 4 ? 4 : 6,
          posX: (i % 4) * 120,
          posY: Math.floor(i / 4) * 120,
        },
      })
    )
  );

  const taxRule = await prisma.taxRule.create({
    data: {
      name: "GST 5%",
      type: "cgst_sgst",
      cgstRate: 2.5,
      sgstRate: 2.5,
    },
  });

  const menu = await prisma.menu.create({
    data: { brandId: brand.id, name: "Main Menu" },
  });

  const categories = await Promise.all([
    prisma.category.create({ data: { menuId: menu.id, name: "Starters", sortOrder: 1 } }),
    prisma.category.create({ data: { menuId: menu.id, name: "Main Course", sortOrder: 2 } }),
    prisma.category.create({ data: { menuId: menu.id, name: "Breads", sortOrder: 3 } }),
    prisma.category.create({ data: { menuId: menu.id, name: "Beverages", sortOrder: 4 } }),
  ]);

  const paneerTikka = await prisma.menuItem.create({
    data: {
      categoryId: categories[0].id,
      kitchenStationId: stations[0].id,
      name: "Paneer Tikka",
      basePrice: 249,
      taxRuleId: taxRule.id,
      isVeg: true,
      hsnCode: "996331",
    },
  });

  const butterChicken = await prisma.menuItem.create({
    data: {
      categoryId: categories[1].id,
      kitchenStationId: stations[1].id,
      name: "Butter Chicken",
      basePrice: 349,
      taxRuleId: taxRule.id,
      isVeg: false,
      hsnCode: "996331",
    },
  });

  await prisma.menuItem.create({
    data: {
      categoryId: categories[2].id,
      kitchenStationId: stations[0].id,
      name: "Butter Naan",
      basePrice: 59,
      taxRuleId: taxRule.id,
      isVeg: true,
    },
  });

  await prisma.menuItem.create({
    data: {
      categoryId: categories[3].id,
      kitchenStationId: stations[2].id,
      name: "Masala Chai",
      basePrice: 49,
      taxRuleId: taxRule.id,
      isVeg: true,
    },
  });

  await Promise.all([
    prisma.menuItem.create({
      data: {
        categoryId: categories[0].id,
        kitchenStationId: stations[0].id,
        name: "Hara Bhara Kebab",
        basePrice: 199,
        taxRuleId: taxRule.id,
        isVeg: true,
        sortOrder: 2,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: categories[0].id,
        kitchenStationId: stations[1].id,
        name: "Chicken Wings",
        basePrice: 279,
        taxRuleId: taxRule.id,
        isVeg: false,
        sortOrder: 3,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: categories[1].id,
        kitchenStationId: stations[1].id,
        name: "Dal Makhani",
        basePrice: 249,
        taxRuleId: taxRule.id,
        isVeg: true,
        sortOrder: 2,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: categories[1].id,
        kitchenStationId: stations[1].id,
        name: "Veg Biryani",
        basePrice: 299,
        taxRuleId: taxRule.id,
        isVeg: true,
        sortOrder: 3,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: categories[2].id,
        kitchenStationId: stations[0].id,
        name: "Garlic Naan",
        basePrice: 69,
        taxRuleId: taxRule.id,
        isVeg: true,
        sortOrder: 2,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: categories[2].id,
        kitchenStationId: stations[0].id,
        name: "Tandoori Roti",
        basePrice: 39,
        taxRuleId: taxRule.id,
        isVeg: true,
        sortOrder: 3,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: categories[3].id,
        kitchenStationId: stations[2].id,
        name: "Sweet Lassi",
        basePrice: 79,
        taxRuleId: taxRule.id,
        isVeg: true,
        sortOrder: 2,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: categories[3].id,
        kitchenStationId: stations[2].id,
        name: "Fresh Lime Soda",
        basePrice: 69,
        taxRuleId: taxRule.id,
        isVeg: true,
        sortOrder: 3,
      },
    }),
  ]);

  const supplier = await prisma.supplier.create({
    data: {
      outletId: dineInOutlet.id,
      name: "Fresh Farms Pvt Ltd",
      phone: "+919988776655",
      gstin: "29AABCF1234G1Z5",
    },
  });

  const dairyCat = await prisma.ingredientCategory.create({
    data: { outletId: dineInOutlet.id, name: "Dairy", sortOrder: 1 },
  });
  const proteinCat = await prisma.ingredientCategory.create({
    data: { outletId: dineInOutlet.id, name: "Protein", sortOrder: 2 },
  });

  const paneer = await prisma.ingredient.create({
    data: {
      outletId: dineInOutlet.id,
      name: "Paneer",
      unit: "kg",
      consumptionUnit: "kg",
      currentStock: 10,
      minStock: 2,
      parStock: 8,
      costPerUnit: 320,
      supplierId: supplier.id,
      categoryId: dairyCat.id,
      isFavourite: true,
    },
  });

  const chicken = await prisma.ingredient.create({
    data: {
      outletId: dineInOutlet.id,
      name: "Chicken",
      unit: "kg",
      consumptionUnit: "kg",
      currentStock: 15,
      minStock: 3,
      parStock: 12,
      costPerUnit: 280,
      supplierId: supplier.id,
      categoryId: proteinCat.id,
    },
  });

  const recipe = await prisma.recipe.create({
    data: { menuItemId: paneerTikka.id, yieldQty: 1 },
  });

  await prisma.recipeItem.create({
    data: { recipeId: recipe.id, ingredientId: paneer.id, quantity: 0.2, stage: 1 },
  });

  const recipe2 = await prisma.recipe.create({
    data: { menuItemId: butterChicken.id, yieldQty: 1 },
  });

  await prisma.recipeItem.create({
    data: { recipeId: recipe2.id, ingredientId: chicken.id, quantity: 0.25, stage: 1 },
  });

  await prisma.invoiceSequence.upsert({
    where: { outletId_year: { outletId: dineInOutlet.id, year: new Date().getFullYear() } },
    update: {},
    create: { outletId: dineInOutlet.id, prefix: "INV", year: new Date().getFullYear(), lastNumber: 0 },
  });
  } // end initial demo data block

  const demoMenu = await prisma.menu.findFirst({ where: { brandId: brand.id } });
  const demoTax = await prisma.taxRule.findFirst();
  const demoStations = await prisma.kitchenStation.findMany({
    where: { outletId: dineInOutlet.id },
    orderBy: { sortOrder: "asc" },
  });

  if (demoMenu && demoTax && demoStations.length >= 3) {
    const demoCategories = await prisma.category.findMany({
      where: { menuId: demoMenu.id },
      orderBy: { sortOrder: "asc" },
    });
    const catByName = (name: string) => demoCategories.find((c) => c.name === name);

    const extraMenuItems: Array<{
      category: string;
      name: string;
      basePrice: number;
      stationIdx: number;
      isVeg: boolean;
      sortOrder: number;
    }> = [
      { category: "Starters", name: "Hara Bhara Kebab", basePrice: 199, stationIdx: 0, isVeg: true, sortOrder: 2 },
      { category: "Starters", name: "Chicken Wings", basePrice: 279, stationIdx: 1, isVeg: false, sortOrder: 3 },
      { category: "Main Course", name: "Dal Makhani", basePrice: 249, stationIdx: 1, isVeg: true, sortOrder: 2 },
      { category: "Main Course", name: "Veg Biryani", basePrice: 299, stationIdx: 1, isVeg: true, sortOrder: 3 },
      { category: "Breads", name: "Garlic Naan", basePrice: 69, stationIdx: 0, isVeg: true, sortOrder: 2 },
      { category: "Breads", name: "Tandoori Roti", basePrice: 39, stationIdx: 0, isVeg: true, sortOrder: 3 },
      { category: "Beverages", name: "Sweet Lassi", basePrice: 79, stationIdx: 2, isVeg: true, sortOrder: 2 },
      { category: "Beverages", name: "Fresh Lime Soda", basePrice: 69, stationIdx: 2, isVeg: true, sortOrder: 3 },
    ];

    for (const item of extraMenuItems) {
      const category = catByName(item.category);
      if (!category) continue;
      const exists = await prisma.menuItem.findFirst({
        where: { categoryId: category.id, name: item.name },
      });
      if (exists) continue;
      await prisma.menuItem.create({
        data: {
          categoryId: category.id,
          kitchenStationId: demoStations[item.stationIdx].id,
          name: item.name,
          basePrice: item.basePrice,
          taxRuleId: demoTax.id,
          isVeg: item.isVeg,
          sortOrder: item.sortOrder,
        },
      });
    }
  }

  const seedSupplier = await prisma.supplier.findFirst({ where: { outletId: dineInOutlet.id } });
  const seedPaneer = await prisma.ingredient.findFirst({ where: { outletId: dineInOutlet.id, name: "Paneer" } });

  if (!seedSupplier || !seedPaneer) {
    console.warn("Skipping back-office PO seed — supplier or paneer not found");
  }

  const storekeeper = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "storekeeper@kaanafoods.in" } },
    update: {},
    create: {
      organizationId: org.id,
      email: "storekeeper@kaanafoods.in",
      phone: "+919876543213",
      passwordHash,
      firstName: "Suresh",
      lastName: "Reddy",
    },
  });

  const manager = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "manager@kaanafoods.in" } },
    update: {},
    create: {
      organizationId: org.id,
      email: "manager@kaanafoods.in",
      phone: "+919876543214",
      passwordHash,
      firstName: "Anita",
      lastName: "Desai",
    },
  });

  const accountant = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "accountant@kaanafoods.in" } },
    update: {},
    create: {
      organizationId: org.id,
      email: "accountant@kaanafoods.in",
      phone: "+919876543215",
      passwordHash,
      firstName: "Vikram",
      lastName: "Patel",
    },
  });

  await Promise.all([
    prisma.roleAssignment.upsert({
      where: { id: "seed-storekeeper-role" },
      update: {},
      create: {
        id: "seed-storekeeper-role",
        userId: storekeeper.id,
        organizationId: org.id,
        outletId: dineInOutlet.id,
        role: UserRole.inventory_manager,
      },
    }),
    prisma.roleAssignment.upsert({
      where: { id: "seed-manager-role" },
      update: {},
      create: {
        id: "seed-manager-role",
        userId: manager.id,
        organizationId: org.id,
        outletId: dineInOutlet.id,
        role: UserRole.manager,
      },
    }),
    prisma.roleAssignment.upsert({
      where: { id: "seed-accountant-role" },
      update: {},
      create: {
        id: "seed-accountant-role",
        userId: accountant.id,
        organizationId: org.id,
        outletId: dineInOutlet.id,
        role: UserRole.accountant,
      },
    }),
  ]);

  for (const profile of [
    { userId: biller.id, organizationId: org.id, employeeCode: "EMP-001", wageType: "hourly" as const, hourlyRate: 150, legalName: "Biller User", firstName: "Biller", displayName: "Biller User", hasLoginAccess: true },
    { userId: captain.id, organizationId: org.id, employeeCode: "EMP-002", wageType: "hourly" as const, hourlyRate: 140, legalName: "Captain User", firstName: "Captain", displayName: "Captain User", hasLoginAccess: true },
    { userId: manager.id, organizationId: org.id, employeeCode: "EMP-003", wageType: "monthly" as const, monthlySalary: 45000, legalName: "Raj Manager", firstName: "Raj", lastName: "Manager", displayName: "Raj Manager", hasLoginAccess: true },
    { userId: chef.id, organizationId: org.id, employeeCode: "EMP-004", wageType: "monthly" as const, monthlySalary: 38000, legalName: "Chef User", firstName: "Chef", displayName: "Chef User", hasLoginAccess: true },
  ]) {
    await prisma.staffProfile.upsert({
      where: { userId: profile.userId },
      update: {},
      create: { ...profile, outletId: dineInOutlet.id },
    });
  }

  const kitchenDept = await prisma.department.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Kitchen" } },
    update: {},
    create: { organizationId: org.id, name: "Kitchen" },
  });
  const serviceDept = await prisma.department.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Service" } },
    update: {},
    create: { organizationId: org.id, name: "Service" },
  });
  const headChef = await prisma.designation.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Head Chef" } },
    update: {},
    create: { organizationId: org.id, name: "Head Chef", departmentId: kitchenDept.id },
  });
  const floorManager = await prisma.designation.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Floor Manager" } },
    update: {},
    create: { organizationId: org.id, name: "Floor Manager", departmentId: serviceDept.id },
  });

  await prisma.staffProfile.update({
    where: { userId: manager.id },
    data: {
      departmentId: serviceDept.id,
      designationId: floorManager.id,
      displayName: "Raj Manager",
      phone: "+919876543210",
      pfAccount: "PF-KAANA-003",
      uan: "100012345678",
      bankName: "HDFC Bank",
      bankAccount: "50100123456789",
      ifsc: "HDFC0001234",
      monthlySalary: 45000,
    },
  });
  await prisma.staffProfile.update({
    where: { userId: biller.id },
    data: {
      departmentId: serviceDept.id,
      hourlyRate: 150,
      bankName: "SBI",
      bankAccount: "30001234567",
      ifsc: "SBIN0001234",
    },
  });

  const existingWageRule = await prisma.wageRule.findFirst({ where: { outletId: dineInOutlet.id, role: UserRole.biller } });
  if (!existingWageRule) {
    await prisma.wageRule.createMany({
      data: [
        { outletId: dineInOutlet.id, role: UserRole.biller, wageType: "hourly", hourlyRate: 150 },
        { outletId: dineInOutlet.id, role: UserRole.captain, wageType: "hourly", hourlyRate: 140 },
        { outletId: dineInOutlet.id, role: UserRole.manager, wageType: "monthly", monthlySalary: 45000 },
        { outletId: dineInOutlet.id, role: UserRole.chef, wageType: "monthly", monthlySalary: 38000 },
      ],
    });
  }

  const closingDate = new Date();
  closingDate.setHours(0, 0, 0, 0);
  await prisma.stockClosing.upsert({
    where: { outletId_date: { outletId: dineInOutlet.id, date: closingDate } },
    update: {},
    create: {
      outletId: dineInOutlet.id,
      date: closingDate,
      status: "completed",
      accuracyPct: 100,
      closedAt: new Date(),
    },
  });

  await prisma.holiday.createMany({
    data: [
      { outletId: dineInOutlet.id, date: new Date(new Date().getFullYear(), 0, 26), name: "Republic Day" },
      { outletId: dineInOutlet.id, date: new Date(new Date().getFullYear(), 7, 15), name: "Independence Day" },
    ],
    skipDuplicates: true,
  });

  const shiftStart = new Date();
  shiftStart.setHours(10, 0, 0, 0);
  const shiftEnd = new Date();
  shiftEnd.setHours(22, 0, 0, 0);

  const billerProfile = await prisma.staffProfile.findUnique({ where: { userId: biller.id } });
  const captainProfile = await prisma.staffProfile.findUnique({ where: { userId: captain.id } });

  const existingShift = billerProfile && (await prisma.shiftSchedule.findFirst({
    where: { outletId: dineInOutlet.id, staffProfileId: billerProfile.id, startAt: shiftStart },
  }));
  if (!existingShift && billerProfile && captainProfile) {
    await prisma.shiftSchedule.create({
      data: {
        outletId: dineInOutlet.id,
        staffProfileId: billerProfile.id,
        startAt: shiftStart,
        endAt: shiftEnd,
        station: "Counter",
      },
    });
    await prisma.shiftSchedule.create({
      data: {
        outletId: dineInOutlet.id,
        staffProfileId: captainProfile.id,
        startAt: shiftStart,
        endAt: shiftEnd,
        station: "Floor",
      },
    });
  }

  const existingAttendance = billerProfile && (await prisma.attendanceRecord.findFirst({
    where: { outletId: dineInOutlet.id, staffProfileId: billerProfile.id, source: "pos" },
  }));
  if (!existingAttendance && billerProfile) {
    const clockIn = new Date();
    clockIn.setHours(9, 55, 0, 0);
    const clockOut = new Date();
    clockOut.setHours(17, 0, 0, 0);
    await prisma.attendanceRecord.create({
      data: { outletId: dineInOutlet.id, staffProfileId: billerProfile.id, clockIn, clockOut, source: "pos" },
    });
  }

  // HR Phase 1–5 seed: jurisdictions, shift templates, salary components, leave policies
  const kaJurisdiction = await prisma.complianceJurisdiction.upsert({
    where: { organizationId_stateCode_effectiveFrom: { organizationId: org.id, stateCode: "KA", effectiveFrom: new Date("2025-11-21") } },
    update: {},
    create: {
      organizationId: org.id,
      stateCode: "KA",
      stateName: "Karnataka",
      rulePack: { minimumMonthlyWage: 17750, pfWageCeiling: 15000, esiWageCeiling: 21000 },
      effectiveFrom: new Date("2025-11-21"),
    },
  });

  const existingReg = await prisma.complianceRegistration.findFirst({
    where: { jurisdictionId: kaJurisdiction.id, outletId: dineInOutlet.id, type: "shops_establishments" },
  });
  if (!existingReg) {
    await prisma.complianceRegistration.create({
      data: {
        jurisdictionId: kaJurisdiction.id,
        outletId: dineInOutlet.id,
        type: "shops_establishments",
        registrationNo: "KA-SNE-2024-001",
        issuedAt: new Date("2024-01-01"),
      },
    });
  }

  for (const tpl of [
    { code: "opening", name: "Opening shift", startTime: "08:00", endTime: "12:00" },
    { code: "general", name: "General shift", startTime: "10:00", endTime: "22:00" },
    { code: "evening", name: "Evening shift", startTime: "14:00", endTime: "23:00" },
    { code: "closing", name: "Closing shift", startTime: "18:00", endTime: "01:00", nightAllowance: true },
    { code: "split", name: "Split shift", startTime: "11:00", endTime: "23:30", isSplitShift: true, splitBreakStart: "15:00", splitBreakEnd: "19:00" },
  ] as const) {
    await prisma.shiftTemplate.upsert({
      where: { organizationId_code: { organizationId: org.id, code: tpl.code } },
      update: {},
      create: {
        organizationId: org.id,
        outletId: dineInOutlet.id,
        name: tpl.name,
        code: tpl.code,
        startTime: tpl.startTime,
        endTime: tpl.endTime,
        breakMinutes: 30,
        mealEligible: true,
        nightAllowance: "nightAllowance" in tpl ? tpl.nightAllowance : false,
        isSplitShift: "isSplitShift" in tpl ? tpl.isSplitShift : false,
        splitBreakStart: "splitBreakStart" in tpl ? tpl.splitBreakStart : undefined,
        splitBreakEnd: "splitBreakEnd" in tpl ? tpl.splitBreakEnd : undefined,
      },
    });
  }

  for (const comp of [
    { code: "basic", name: "Basic", kind: "earning" as const, includeInPf: true, includeInGratuity: true },
    { code: "da", name: "Dearness Allowance", kind: "earning" as const, includeInPf: true },
    { code: "hra", name: "HRA", kind: "earning" as const },
    { code: "special", name: "Special Allowance", kind: "earning" as const },
    { code: "shift_allowance", name: "Shift Allowance", kind: "earning" as const, includeInOvertime: true },
    { code: "pf", name: "EPF", kind: "deduction" as const },
    { code: "esi", name: "ESIC", kind: "deduction" as const },
    { code: "employer_pf", name: "Employer PF", kind: "employer_cost" as const },
  ]) {
    await prisma.salaryComponent.upsert({
      where: { organizationId_code_effectiveFrom: { organizationId: org.id, code: comp.code, effectiveFrom: new Date("2025-11-21") } },
      update: {},
      create: {
        organizationId: org.id,
        effectiveFrom: new Date("2025-11-21"),
        calculationType: "fixed",
        code: comp.code,
        name: comp.name,
        kind: comp.kind,
        includeInPf: comp.includeInPf ?? false,
        includeInGratuity: comp.includeInGratuity ?? false,
        includeInOvertime: comp.includeInOvertime ?? false,
      },
    });
  }

  for (const lp of [
    { leaveType: "earned" as const, name: "Earned Leave", carryForwardMax: 30, maxBalance: 45 },
    { leaveType: "casual" as const, name: "Casual Leave", maxBalance: 12 },
    { leaveType: "sick" as const, name: "Sick Leave", documentRequired: true },
  ]) {
    const existing = await prisma.leavePolicy.findFirst({ where: { organizationId: org.id, leaveType: lp.leaveType, name: lp.name } });
    if (!existing) {
      await prisma.leavePolicy.create({ data: { organizationId: org.id, outletId: dineInOutlet.id, ...lp } });
    }
  }

  const demoPO = seedSupplier && seedPaneer
    ? await prisma.purchaseOrder.findFirst({
        where: { outletId: dineInOutlet.id, poNumber: "PO-0001" },
      }) ?? await prisma.purchaseOrder.create({
        data: {
          outletId: dineInOutlet.id,
          supplierId: seedSupplier.id,
          poNumber: "PO-0001",
          status: "draft",
          totalAmount: 1600,
          items: {
            create: [{ ingredientId: seedPaneer.id, quantity: 5, unitPrice: 320, totalPrice: 1600 }],
          },
        },
      })
    : null;

  await prisma.category.updateMany({ data: { nameHi: null } });
  await prisma.menuItem.updateMany({ data: { nameHi: null } });

  const floorProfiles = await prisma.staffProfile.findMany({
    where: {
      organizationId: org.id,
      userId: { in: [biller.id, captain.id, chef.id, manager.id] },
    },
  });
  for (const sp of floorProfiles) {
    await prisma.staffProfile.update({
      where: { id: sp.id },
      data: {
        pinHash: demoPinHash,
        pinSetAt: new Date(),
        pinUpdatedByUserId: manager.id,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });
  }

  const roleByUserId: Record<string, UserRole> = {
    [biller.id]: UserRole.biller,
    [captain.id]: UserRole.captain,
    [chef.id]: UserRole.chef,
    [manager.id]: UserRole.manager,
  };
  for (const sp of floorProfiles) {
    const role = sp.userId ? roleByUserId[sp.userId] : UserRole.biller;
    if (!role) continue;
    await prisma.staffRoleAssignment.upsert({
      where: {
        staffProfileId_outletId_role: {
          staffProfileId: sp.id,
          outletId: dineInOutlet.id,
          role,
        },
      },
      update: { permissions: [] },
      create: {
        staffProfileId: sp.id,
        organizationId: org.id,
        outletId: dineInOutlet.id,
        role,
        permissions: [],
      },
    });
  }

  console.log("Seed complete!");
  console.log("Login credentials (password123 for all) — sign in once at http://localhost:3010");
  console.log("  Owner:       owner@kaanafoods.in       → Owner console (payroll, staff, reports)");
  console.log("  Manager:     manager@kaanafoods.in     → Owner console");
  console.log("  Storekeeper: storekeeper@kaanafoods.in → POS /inventory");
  console.log("  Accountant:  accountant@kaanafoods.in  → Owner console /payroll");
  console.log("  Biller:      biller@kaanafoods.in       → POS /floor");
  console.log("  Chef (KDS):  chef@kaanafoods.in        → http://localhost:3002");
  console.log("  Platform:    (super_admin only)        → http://localhost:3000");
  console.log("Outlet:", dineInOutlet.name, dineInOutlet.id);
  console.log("Demo PO:", demoPO?.poNumber ?? "n/a", demoPO?.id ?? "");
  console.log("Terminal:", terminal.code, terminal.id);
  console.log("Demo POS terminal credential: Terminal", `${terminal.id}:${demoTerminalSecret}`);
  console.log("Demo staff PIN (biller/captain/chef/manager): 4821");

  await prisma.outlet.update({
    where: { id: dineInOutlet.id },
    data: {
      settings: {
        billingMode: "cashier_settles",
        inventoryPolicy: "warn",
      },
    },
  });

  const ordersToBackfill = await prisma.order.findMany({ where: { outletId: dineInOutlet.id } });
  for (const order of ordersToBackfill) {
    let fulfilment: "restaurant" | "aggregator" | "customer_pickup" | null = null;
    if (order.type === "delivery" && ["swiggy", "zomato", "ondc"].includes(order.source)) {
      fulfilment = "aggregator";
    } else if (order.type === "takeaway" && ["walk_in", "pos", "captain"].includes(order.source)) {
      fulfilment = "customer_pickup";
    } else if (order.type === "delivery") {
      fulfilment = "restaurant";
    }
    if (fulfilment) {
      await prisma.order.update({ where: { id: order.id }, data: { fulfilment } });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
