import Database from "../packages/outlet-db/node_modules/better-sqlite3/lib/index.js";
import { readFileSync, existsSync } from "node:fs";

const dbPath = process.argv[2];
const sql = process.argv[3];
if (!dbPath || !sql) {
  console.error("usage: node step15.1-sqlite-query.mjs <db> <sql>");
  process.exit(1);
}
if (!existsSync(dbPath)) process.exit(0);
const db = new Database(dbPath, { readonly: true });
try {
  const trimmed = sql.trim().toLowerCase();
  if (trimmed.startsWith("select") && !trimmed.includes("limit")) {
    const rows = db.prepare(sql).all();
    if (rows.length === 1 && Object.keys(rows[0]).length === 1) {
      console.log(String(Object.values(rows[0])[0]));
    } else {
      console.log(JSON.stringify(rows));
    }
  } else {
    const row = db.prepare(sql).get();
    if (row && typeof row === "object") {
      const vals = Object.values(row);
      console.log(vals.length === 1 ? String(vals[0]) : JSON.stringify(row));
    }
  }
} finally {
  db.close();
}
