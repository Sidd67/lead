import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import path from "path";

const dbUrl = process.env.DATABASE_URL || `file:${path.resolve(process.cwd(), "../../sqlite.db")}`;
const client = createClient({ 
  url: dbUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN, 
});
export const db = drizzle(client, { schema });

export * from "./schema";
