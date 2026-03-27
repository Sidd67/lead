/**
 * Jobs route
 *
 * GET /api/jobs — Retrieve job listings with flexible filtering
 *
 * Supported query params:
 *  - jobRole     Filter by role keyword (case-insensitive match against stored normalised role)
 *  - location    Filter by location
 *  - source      Filter by platform: linkedin | naukri | internshala | wellfound
 *  - dateRange   Time window: day (24h) | week (7d) | month (30d)
 */

import { Router, type IRouter } from "express";
import { db, jobsTable } from "@workspace/db";
import { eq, and, gte, like, type SQL } from "drizzle-orm";
import { GetJobsQueryParams, GetJobsResponse } from "@workspace/api-zod";

// Current openings only: discard anything older than 30 days
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const router: IRouter = Router();

/** Map a dateRange string to a Date representing the start of the window. */
function dateRangeStart(range: string | undefined): Date | null {
  if (!range) return null;
  const now = new Date();
  if (range === "day")   { now.setDate(now.getDate() - 1);   return now; }
  if (range === "week")  { now.setDate(now.getDate() - 7);   return now; }
  if (range === "month") { now.setMonth(now.getMonth() - 1); return now; }
  return null;
}

/**
 * GET /api/jobs
 * Returns collected job listings, filtered by any combination of:
 *   jobRole, location, source, dateRange
 */
router.get("/jobs", async (req, res) => {
  try {
    const parsed = GetJobsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query params", details: parsed.error.message });
      return;
    }

    const { jobRole, location, source, dateRange } = parsed.data;

    // Build WHERE conditions dynamically
    const conditions: SQL[] = [];

    // Always filter to current openings (last 30 days) by default
    // If the caller also passes a dateRange, that will narrow further
    console.log("Filtering outdated jobs...");
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);
    conditions.push(gte(jobsTable.createdAt as any, thirtyDaysAgo));

    // Flexible role matching: allows "ai" to match "AI Engineer"
    if (jobRole) conditions.push(like(jobsTable.jobRole as any, `%${jobRole.toLowerCase().trim()}%`));
    if (location) conditions.push(like(jobsTable.location as any, `%${location.trim()}%`));
    if (source) conditions.push(eq(jobsTable.source as any, source));

    // Optional tighter date range (day / week / month)
    const since = dateRangeStart(dateRange as string | undefined);
    if (since) conditions.push(gte(jobsTable.createdAt as any, since));

    const rows = await db
      .select()
      .from(jobsTable)
      .where(conditions.length > 0 ? (and(...conditions) as any) : undefined)
      .orderBy(jobsTable.createdAt);

    const response = GetJobsResponse.parse({
      jobs: rows.map((j) => ({
        id: j.id,
        jobTitle: j.jobTitle,
        companyName: j.companyName,
        location: j.location,
        jobUrl: j.jobUrl,
        source: j.source,
        jobRole: j.jobRole,
        createdAt: j.createdAt,
      })),
      total: rows.length,
    });

    res.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/jobs/:id
 * Removes a specific job listing by ID.
 */
router.delete("/jobs/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid job ID" });
      return;
    }

    await db.delete(jobsTable).where(eq(jobsTable.id as any, id));
    res.json({ success: true, message: "Job deleted" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/jobs
 * Clears all job listings from the database.
 */
router.delete("/jobs", async (_req, res) => {
  try {
    await db.delete(jobsTable);
    res.json({ success: true, message: "All jobs cleared" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
