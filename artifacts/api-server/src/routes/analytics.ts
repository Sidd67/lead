/**
 * Job Analytics route
 *
 * GET /api/jobs/analytics
 *
 * Returns aggregated statistics about the jobs stored in the database:
 *   - totalJobs          — count of all jobs (last 30 days)
 *   - jobsByPlatform     — job count grouped by source platform
 *   - topCompanies       — top 10 companies by job count
 *   - mostSearchedRoles  — top 10 roles by job count
 */

import { Router, type IRouter } from "express";
import { db, jobsTable } from "@workspace/db";
import { sql, gte, desc } from "drizzle-orm";

const router: IRouter = Router();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

router.get("/jobs/analytics", async (_req, res) => {
  try {
    const since = new Date(Date.now() - THIRTY_DAYS_MS);

    // Run all aggregation queries in parallel
    const [totalResult, platformResult, companyResult, roleResult] =
      await Promise.all([
        // Total jobs in the last 30 days
        db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(jobsTable)
          .where(gte(jobsTable.createdAt, since)),

        // Jobs grouped by platform (source)
        db
          .select({
            source: jobsTable.source,
            count: sql<number>`cast(count(*) as int)`,
          })
          .from(jobsTable)
          .where(gte(jobsTable.createdAt, since))
          .groupBy(jobsTable.source)
          .orderBy(desc(sql`count(*)`)),

        // Top 10 companies by number of listings
        db
          .select({
            company: jobsTable.companyName,
            count: sql<number>`cast(count(*) as int)`,
          })
          .from(jobsTable)
          .where(gte(jobsTable.createdAt, since))
          .groupBy(jobsTable.companyName)
          .orderBy(desc(sql`count(*)`))
          .limit(10),

        // Top 10 most common job roles
        db
          .select({
            role: jobsTable.jobRole,
            count: sql<number>`cast(count(*) as int)`,
          })
          .from(jobsTable)
          .where(gte(jobsTable.createdAt, since))
          .groupBy(jobsTable.jobRole)
          .orderBy(desc(sql`count(*)`))
          .limit(10),
      ]);

    const totalJobs = totalResult[0]?.count ?? 0;

    // Shape the platform results into a keyed object
    const jobsByPlatform: Record<string, number> = {};
    for (const row of platformResult) {
      jobsByPlatform[row.source] = row.count;
    }

    const topCompanies = companyResult.map((r) => ({
      company: r.company,
      jobCount: r.count,
    }));

    const mostSearchedRoles = roleResult.map((r) => ({
      role: r.role,
      jobCount: r.count,
    }));

    res.json({
      totalJobs,
      jobsByPlatform,
      topCompanies,
      mostSearchedRoles,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
