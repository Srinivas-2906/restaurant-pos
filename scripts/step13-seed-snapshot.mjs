import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function snapshot(label) {
  const org = await prisma.organization.findFirst({ where: { slug: "kaana-demo" } });
  if (!org) throw new Error("Demo org not found");

  const glAccounts = await prisma.glAccount.count({ where: { organizationId: org.id } });
  const journalEntries = await prisma.journalEntry.count({ where: { organizationId: org.id } });
  const journalLines = await prisma.journalLine.count({
    where: { journalEntry: { organizationId: org.id } },
  });

  const invAcct = await prisma.glAccount.findFirst({
    where: { organizationId: org.id, code: "1200" },
  });
  const obeAcct = await prisma.glAccount.findFirst({
    where: { organizationId: org.id, code: "3200" },
  });

  const invAgg = invAcct
    ? await prisma.journalLine.aggregate({
        where: { glAccountId: invAcct.id, journalEntry: { organizationId: org.id, status: "posted" } },
        _sum: { debit: true, credit: true },
      })
    : { _sum: { debit: 0, credit: 0 } };

  const obeAgg = obeAcct
    ? await prisma.journalLine.aggregate({
        where: { glAccountId: obeAcct.id, journalEntry: { organizationId: org.id, status: "posted" } },
        _sum: { debit: true, credit: true },
      })
    : { _sum: { debit: 0, credit: 0 } };

  const inventoryAsset = Number(invAgg._sum.debit ?? 0) - Number(invAgg._sum.credit ?? 0);
  const openingEquity = Number(obeAgg._sum.credit ?? 0) - Number(obeAgg._sum.debit ?? 0);

  console.log(JSON.stringify({ label, glAccounts, journalEntries, journalLines, inventoryAsset, openingEquity }, null, 2));
}

const label = process.argv[2] ?? "snapshot";
snapshot(label)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
