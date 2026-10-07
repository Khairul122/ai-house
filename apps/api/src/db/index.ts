import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema/index.js";

const dbUrl = process.env.DATABASE_URL || "file:./data/house.db";
const dbPath = dbUrl.replace(/^file:/, "");

const dir = path.dirname(dbPath);
if (dir && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const sqliteClient = createClient({
  url: dbUrl.startsWith("file:") ? dbUrl : `file:${dbUrl}`
});

export const db = drizzle(sqliteClient, { schema });
