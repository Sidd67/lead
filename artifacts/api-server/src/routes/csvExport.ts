/**
 * CSV Export route
 *
 * GET /api/jobs/export-csv
 *
 * Fetches all current job listings from the database and streams them back as a
 * downloadable CSV file.
 *
 * CSV columns: Job Title, Company, Location, Source, Job URL, Date Added
 *
 * Headers sent:
 *   Content-Type: text/csv
 *   Content-Disposition: attachment; filename="leadhunter-jobs.csv"
 */

import { Router, type IRouter } from "express";
import { db, jobsTable } from "@workspace/db";
import { desc, gte } from "drizzle-orm";

const router: IRouter = Router();

// Only export jobs from the last 30 days (current openings)
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Escape a single CSV field value.
 * Wraps the value in double-quotes and escapes internal double-quotes by doubling them.
 */
function csvField(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let str = value instanceof Date ? value.toISOString().split("T")[0]! : String(value);
  // Escape internal double-quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Convert an array of row objects to a CSV string.
 */
function buildCsv(
  rows: Array<{
    jobTitle: string;
    companyName: string;
    location: string;
    source: string;
    jobUrl: string;
    createdAt: Date;
  }>
): string {
  const header = ["Job Title", "Company", "Location", "Source", "Job URL", "Date Added"].join(",");

  const dataRows = rows.map((r) =>
    [
      csvField(r.jobTitle),
      csvField(r.companyName),
      csvField(r.location),
      csvField(r.source),
      csvField(r.jobUrl),
      csvField(r.createdAt),
    ].join(",")
  );

  return [header, ...dataRows].join("\r\n");
}

/**
 * GET /api/jobs/export-csv
 * Returns a downloadable CSV of the last 30 days' job listings.
 */
router.get("/jobs/export-csv", async (_req, res) => {
  try {
    console.log("Generating CSV export...");

    const since = new Date(Date.now() - THIRTY_DAYS_MS);

    console.log("Filtering outdated jobs...");

    const rows = await db
      .select()
      .from(jobsTable)
      .where(gte(jobsTable.createdAt, since))
      .orderBy(desc(jobsTable.createdAt));

    const csv = buildCsv(rows);

    console.log(`[CSV] Exporting ${rows.length} current job listings`);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="leadhunter-jobs.csv"');
    res.send(csv);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[CSV] Export failed:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
