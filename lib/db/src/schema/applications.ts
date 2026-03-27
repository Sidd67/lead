import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Applications table - tracks every auto-apply attempt made by the agent
export const applicationsTable = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobTitle: text("job_title").notNull(),
  companyName: text("company_name").notNull(),
  jobUrl: text("job_url").notNull(),
  // Status values: "pending" | "applied" | "failed"
  status: text("status").notNull().default("pending"),
  appliedAt: integer("applied_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({
  id: true,
  appliedAt: true,
});
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applicationsTable.$inferSelect;
