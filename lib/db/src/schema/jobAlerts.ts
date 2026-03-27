import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Job alerts table — stores email notification subscriptions
export const jobAlertsTable = sqliteTable("job_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  jobRole: text("job_role").notNull(),
  location: text("location").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const insertJobAlertSchema = createInsertSchema(jobAlertsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertJobAlert = z.infer<typeof insertJobAlertSchema>;
export type JobAlert = typeof jobAlertsTable.$inferSelect;
