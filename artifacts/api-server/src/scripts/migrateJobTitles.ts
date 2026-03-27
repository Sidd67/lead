/**
 * One-time migration: normalise all existing job titles in the database.
 *
 * For each job:
 *   - If the title maps to a canonical predefined role → update it
 *   - If the title cannot be mapped → delete the record
 *
 * Run with:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/migrateJobTitles.ts
 */

import { db, jobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { normalizeTitle } from "../utils/titleNormalizer.js";

async function migrate() {
  console.log("Starting job title migration...");

  const jobs = await db.select({ id: jobsTable.id, jobTitle: jobsTable.jobTitle }).from(jobsTable);
  console.log(`Found ${jobs.length} jobs to process.`);

  let updated = 0;
  let deleted = 0;

  for (const job of jobs) {
    const canonical = normalizeTitle(job.jobTitle);
    if (!canonical) {
      await db.delete(jobsTable).where(eq(jobsTable.id, job.id));
      console.log(`Deleted unrecognised: "${job.jobTitle}"`);
      deleted++;
    } else if (canonical !== job.jobTitle) {
      await db.update(jobsTable).set({ jobTitle: canonical }).where(eq(jobsTable.id, job.id));
      console.log(`Updated: "${job.jobTitle}" → "${canonical}"`);
      updated++;
    }
  }

  console.log(`\nMigration complete: ${updated} updated, ${deleted} deleted, ${jobs.length - updated - deleted} already clean.`);
  process.exit(0);
}

migrate().catch((err) => { console.error(err); process.exit(1); });
