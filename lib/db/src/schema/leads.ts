import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Leads table - stores all company leads found by the AI agent
export const leadsTable = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyName: text("company_name").notNull(),
  founderName: text("founder_name"),
  email: text("email"),
  linkedinUrl: text("linkedin_url"),
  website: text("website"),
  industry: text("industry").notNull(),
  location: text("location").notNull(),
  dateCollected: integer("date_collected", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, dateCollected: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
