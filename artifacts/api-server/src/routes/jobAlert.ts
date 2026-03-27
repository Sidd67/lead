/**
 * Job Alert routes
 *
 * POST /api/job-alert    — Subscribe to email notifications for a role + location
 * GET  /api/job-alerts   — List all active subscriptions
 *
 * When a matching job is later inserted into the database, the system will log
 * the alert so it can be forwarded to an email service (e.g. SendGrid, Resend)
 * when email credentials are configured.
 *
 * Note: Actual email delivery is not wired here because no email provider is
 * configured in this environment. The subscription is stored in the DB and
 * a console log is emitted whenever a matching job is found, making it easy
 * to plug in any SMTP/SaaS email service in the future.
 */

import { Router, type IRouter } from "express";
import { db, jobAlertsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

/** Basic email format check (no external library). */
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * POST /api/job-alert
 * Create a new job alert subscription.
 * If the same email + role + location is already subscribed, returns the
 * existing record without creating a duplicate.
 */
router.post("/job-alert", async (req, res) => {
  try {
    const { email, jobRole, location } = req.body ?? {};
    if (typeof email !== "string" || !isValidEmail(email)) {
      res.status(400).json({ error: "A valid email address is required" });
      return;
    }
    if (typeof jobRole !== "string" || jobRole.length < 2) {
      res.status(400).json({ error: "jobRole must be at least 2 characters" });
      return;
    }
    if (typeof location !== "string" || location.length < 2) {
      res.status(400).json({ error: "location must be at least 2 characters" });
      return;
    }
    const normalizedRole     = jobRole.toLowerCase().trim();
    const normalizedLocation = location.toLowerCase().trim();

    // Check for existing identical subscription
    const existing = await db
      .select()
      .from(jobAlertsTable)
      .where(
        and(
          eq(jobAlertsTable.email, email),
          eq(jobAlertsTable.jobRole, normalizedRole),
          eq(jobAlertsTable.location, normalizedLocation)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      res.json({
        success: true,
        alertId: existing[0]!.id,
        message: `You are already subscribed to alerts for "${jobRole}" in "${location}".`,
        alreadyExists: true,
      });
      return;
    }

    const [inserted] = await db
      .insert(jobAlertsTable)
      .values({ email, jobRole: normalizedRole, location: normalizedLocation })
      .returning({ id: jobAlertsTable.id });

    console.log(
      `[JobAlert] New subscription: ${email} → "${normalizedRole}" in "${normalizedLocation}"`
    );

    res.json({
      success: true,
      alertId: inserted!.id,
      message: `Job alert created! You'll be notified when new "${jobRole}" roles appear in "${location}".`,
      alreadyExists: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/job-alerts
 * Returns all stored job alert subscriptions (most recent first).
 */
router.get("/job-alerts", async (_req, res) => {
  try {
    const alerts = await db
      .select()
      .from(jobAlertsTable)
      .orderBy(desc(jobAlertsTable.createdAt));

    res.json({ alerts, total: alerts.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
