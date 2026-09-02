/**
 * Apply reservations_module.sql using DATABASE_URL from packages/database/.env
 * Usage: node scripts/apply-reservations-migration.js
 */
const fs = require("fs");
const path = require("path");

async function main() {
  const envPath = path.join(__dirname, "../packages/database/.env");
  const sqlPath = path.join(__dirname, "../packages/database/prisma/migrations/reservations_module.sql");

  if (!fs.existsSync(envPath)) {
    console.error("Missing packages/database/.env");
    process.exit(1);
  }

  const env = fs.readFileSync(envPath, "utf8");
  const match = env.match(/DATABASE_URL="([^"]+)"/);
  if (!match) {
    console.error("DATABASE_URL not found in .env");
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");

  let pg;
  try {
    pg = require("pg");
  } catch {
    console.error("Install pg: npm install pg --workspace-root or from repo root");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: match[1] });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Reservations migration applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
