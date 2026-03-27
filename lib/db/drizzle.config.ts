import { defineConfig } from "drizzle-kit";
import path from "path";

const dbPath = path.resolve(process.cwd(), "../../sqlite.db");

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: `file:${dbPath}`,
  },
});
