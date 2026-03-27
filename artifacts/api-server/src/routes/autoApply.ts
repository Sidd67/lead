/**
 * Auto Apply routes
 *
 * POST /api/auto-apply      — Submit an auto-apply request
 * GET  /api/applications    — View all application records
 *
 * Workflow:
 *  1. Validate the request (jobUrl, jobTitle, company)
 *  2. Insert application record with status "pending"
 *  3. Simulate the apply process asynchronously:
 *     - In production: opens the URL in a headless browser, detects Apply button,
 *       fills form fields, submits, and verifies confirmation
 *  4. Update status to "applied" or "failed"
 */

import { Router, type IRouter } from "express";
import { db, applicationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  AutoApplyBody,
  AutoApplyResponse,
  GetApplicationsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * POST /api/auto-apply
 * Records a new auto-apply attempt and simulates the application workflow.
 * Returns immediately with status "pending" — the apply runs async in background.
 */
router.post("/auto-apply", async (req, res) => {
  try {
    const parsed = AutoApplyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.message });
      return;
    }

    const { jobUrl, jobTitle, company } = parsed.data;

    // Step 1: Insert application record — status starts as "pending"
    const [inserted] = await db
      .insert(applicationsTable)
      .values({ jobTitle, companyName: company, jobUrl, status: "pending" })
      .returning({ id: applicationsTable.id });

    if (!inserted) {
      res.status(500).json({ error: "Failed to create application record" });
      return;
    }

    const applicationId = inserted.id;

    // Step 2: Simulate apply asynchronously (non-blocking)
    // In production this would control a real headless browser session
    (async () => {
      try {
        // Simulate: page load (1–2s) + form detection (0.5s) + submit (1s)
        await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000));

        // 85% success rate simulates real-world apply outcomes
        const newStatus = Math.random() < 0.85 ? "applied" : "failed";

        await db
          .update(applicationsTable)
          .set({ status: newStatus })
          .where(eq(applicationsTable.id, applicationId));

        console.log(
          `[AutoApply] #${applicationId} "${jobTitle}" @ ${company} → ${newStatus}`
        );
      } catch (err) {
        console.error(`[AutoApply] Failed to update status for #${applicationId}:`, err);
        // Mark as failed so we don't leave it permanently in "pending"
        await db
          .update(applicationsTable)
          .set({ status: "failed" })
          .where(eq(applicationsTable.id, applicationId))
          .catch(() => {});
      }
    })();

    const response = AutoApplyResponse.parse({
      success: true,
      applicationId,
      status: "pending",
      message: `Application submitted for "${jobTitle}" at ${company}. Status will update shortly.`,
    });

    res.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/applications
 * Returns all auto-apply records ordered by most recent first.
 */
router.get("/applications", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(applicationsTable)
      .orderBy(desc(applicationsTable.appliedAt));

    const response = GetApplicationsResponse.parse({
      applications: rows.map((a) => ({
        id: a.id,
        jobTitle: a.jobTitle,
        companyName: a.companyName,
        jobUrl: a.jobUrl,
        status: a.status,
        appliedAt: a.appliedAt,
      })),
      total: rows.length,
    });

    res.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
