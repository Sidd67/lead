import { Router, type IRouter } from "express";
import healthRouter from "./health";
import leadsRouter from "./leads";
import csvExportRouter from "./csvExport";
import analyticsRouter from "./analytics";
import jobsRouter from "./jobs";
import suggestionsRouter from "./suggestions";
import autoApplyRouter from "./autoApply";
import resumeMatchRouter from "./resumeMatch";
import jobSummaryRouter from "./jobSummary";
import jobAlertRouter from "./jobAlert";

const router: IRouter = Router();

// Health check
router.use(healthRouter);

// Leads endpoints (start-agent, agent-status, leads)
router.use(leadsRouter);

// CSV export and analytics — mounted BEFORE the general /jobs handler so
// the more-specific paths /jobs/export-csv and /jobs/analytics match first
router.use(csvExportRouter);
router.use(analyticsRouter);

// Jobs endpoint with filtering support
router.use(jobsRouter);

// Job role suggestions
router.use(suggestionsRouter);

// Auto-apply and applications tracking
router.use(autoApplyRouter);

// Resume match scoring
router.use(resumeMatchRouter);

// AI job summary
router.use(jobSummaryRouter);

// Job alert subscriptions
router.use(jobAlertRouter);

export default router;
