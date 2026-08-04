import path from "path";
import { createOutletDb } from "./index";

const dbPath = process.env.OUTLET_DB_PATH ?? path.join(process.cwd(), "outlet.db");
createOutletDb(dbPath);
console.log(`Outlet SQLite database initialized at ${dbPath}`);
