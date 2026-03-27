/**
 * Leads routes
 *
 * GET  /api/leads          - Retrieve all collected leads (with optional filters)
 * POST /api/start-agent    - Start the AI lead search agent
 * GET  /api/agent-status   - Get current agent running status
 */

import { Router, type IRouter } from "express";
import { db, leadsTable } from "@workspace/db";
import { eq, and, like, type SQL } from "drizzle-orm";
import {
  StartAgentBody,
  GetLeadsQueryParams,
  StartAgentResponse,
  GetLeadsResponse,
  GetAgentStatusResponse,
} from "@workspace/api-zod";
import { runLeadAgent, getAgentStatus } from "../agents/leadAgent.js";

const router: IRouter = Router();

/**
 * POST /api/start-agent
 * Validates the request body, then starts the AI agent in the background.
 * Returns a jobId immediately — the agent runs asynchronously.
 */
router.post("/start-agent", async (req, res) => {
  try {
    // Validate request body using generated Zod schema
    const parsed = StartAgentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.message });
      return;
    }

    const { industry, location } = parsed.data;

    // Start agent (runs async in background)
    const { jobId } = await runLeadAgent(industry, location);

    const response = StartAgentResponse.parse({
      success: true,
      message: `AI agent started! Searching for ${industry} companies in ${location}.`,
      jobId,
    });

    res.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/leads
 * Returns all leads from the database with optional industry/location filters.
 */
router.get("/leads", async (req, res) => {
  try {
    // Validate query params
    const parsed = GetLeadsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query params", details: parsed.error.message });
      return;
    }

    const { industry, location } = parsed.data;

    // Build dynamic WHERE conditions
    const conditions: SQL[] = [];
    if (industry) conditions.push(like(leadsTable.industry, `%${industry.trim()}%`));
    if (location) conditions.push(like(leadsTable.location, `%${location.trim()}%`));

    const leads = await db
      .select()
      .from(leadsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(leadsTable.dateCollected);

    // Map DB rows to API response shape
    const response = GetLeadsResponse.parse({
      leads: leads.map((l) => ({
        id: l.id,
        companyName: l.companyName,
        founderName: l.founderName ?? null,
        email: l.email ?? null,
        linkedinUrl: l.linkedinUrl ?? null,
        website: l.website ?? null,
        industry: l.industry,
        location: l.location,
        dateCollected: l.dateCollected.toISOString(),
      })),
      total: leads.length,
    });

    res.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/agent-status
 * Returns whether the agent is currently running and metadata about the current job.
 */
router.get("/agent-status", (_req, res) => {
  const status = getAgentStatus();
  const response = GetAgentStatusResponse.parse(status);
  res.json(response);
});

export default router;
