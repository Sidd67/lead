import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Jobs table - stores all job listings found by the AI agent
export const jobsTable = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobTitle: text("job_title").notNull(),
  companyName: text("company_name").notNull(),
  location: text("location").notNull(),
  jobUrl: text("job_url").notNull(),
  source: text("source").notNull(), // linkedin | naukri | internshala | wellfound
  jobRole: text("job_role").notNull(),  // the search keyword used (normalized)
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, createdAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
