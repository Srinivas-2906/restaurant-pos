import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url } } });

try {
  const result = await prisma.$queryRaw`SELECT 1 as ok`;
  console.log("OK", url, result);
} catch (e) {
  console.error("FAIL", url, e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
