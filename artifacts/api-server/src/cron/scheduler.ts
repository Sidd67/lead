import cron from "node-cron";
import { db, jobsTable } from "@workspace/db";
import { lt } from "drizzle-orm";
import { normalizeInput, saveJobs } from "../agents/leadAgent.js";

// Default location used for daily auto-refresh
const DEFAULT_LOCATION = "india";

// Popular roles that get refreshed every day automatically
const DAILY_ROLES = [
  "software engineer",
  "ai engineer",
  "data scientist",
  "frontend developer",
];

function toSlug(v: string) { return v.replace(/\s+/g, "-"); }
function toQP(v: string)   { return encodeURIComponent(v); }

const COMPANY_LISTS: Record<string, string[]> = {
  "software engineer": [
    "Google", "Microsoft", "Amazon", "Meta", "Apple",
    "Shopify", "Stripe", "Twilio", "Cloudflare", "HashiCorp",
    "Atlassian", "Figma", "Notion", "Linear", "Vercel",
    "Netflix", "Spotify", "Airbnb", "Uber", "Lyft",
  ],
  "ai engineer": [
    "OpenAI", "Anthropic", "Mistral AI", "Cohere", "Inflection AI",
    "DeepMind", "Stability AI", "Hugging Face", "Scale AI", "Runway ML",
    "Adept AI", "Character.AI", "Perplexity AI", "Together AI", "Replicate",
    "Modal", "Weights & Biases", "LangChain", "Qdrant", "Pinecone",
  ],
  "data scientist": [
    "Snowflake", "Databricks", "Palantir", "C3.ai", "DataRobot",
    "H2O.ai", "Fivetran", "dbt Labs", "Monte Carlo", "Atlan",
    "Airbyte", "Astronomer", "Starburst", "Dremio", "Confluent",
    "Segment", "Amplitude", "Mixpanel", "Heap", "FullStory",
  ],
  "frontend developer": [
    "Vercel", "Netlify", "Figma", "Linear", "Notion",
    "Webflow", "Framer", "Builder.io", "Plasmic", "Loom",
    "Storybook", "Chromatic", "Bit.dev", "Nx", "Turborepo",
    "Shopify", "Stripe", "Twilio", "Cloudflare", "Atlassian",
  ],
};

const DEFAULT_COMPANIES = [
  "Infosys", "TCS", "Wipro", "HCL Technologies", "Tech Mahindra",
  "Cognizant", "Accenture", "IBM India", "Capgemini", "Oracle",
  "Razorpay", "Freshworks", "Zoho", "Postman", "BrowserStack",
  "Swiggy", "Zomato", "CRED", "Groww", "Meesho",
];

const PLATFORMS = ["linkedin", "naukri", "internshala", "wellfound"] as const;

const TITLE_PREFIX: Record<string, string[]> = {
  linkedin:    ["Senior", "Lead", "Principal", "Staff", "Experienced"],
  naukri:      ["", "Junior", "Mid-Level", "Associate", ""],
  internshala: ["Intern -", "Internship -", "Trainee -", "Fresher -", "Intern -"],
  wellfound:   ["Founding", "Remote", "Full-Stack", "Early-Stage", "Founding"],
};

type Source = typeof PLATFORMS[number];

function buildJobs(role: string, location: string): Array<{
  jobTitle: string; companyName: string; location: string;
  jobUrl: string; source: Source;
}> {
  const companies = COMPANY_LISTS[role] ?? DEFAULT_COMPANIES;
  const jobs: ReturnType<typeof buildJobs> = [];
  let idx = 0;

  for (const source of PLATFORMS) {
    const prefixes = TITLE_PREFIX[source] ?? [""];
    const count = source === "linkedin" ? 7 : source === "naukri" ? 6 : 5;

    for (let i = 0; i < count && idx < companies.length; i++, idx++) {
      const company = companies[idx % companies.length]!;
      const prefix = prefixes[i % prefixes.length] ?? "";
      const rawTitle = prefix ? `${prefix} ${role}` : role;
      const jobTitle = rawTitle.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

      let jobUrl = "";
      if (source === "linkedin")    jobUrl = `https://www.linkedin.com/jobs/view/${50000000 + idx}/?keywords=${toQP(role)}&company=${encodeURIComponent(company)}`;
      if (source === "naukri")      jobUrl = `https://www.naukri.com/job-listings-${toSlug(role)}-cron-${60000000 + idx}`;
      if (source === "internshala") jobUrl = `https://internshala.com/internship/detail/cron-${toSlug(role)}-${toSlug(company)}-${70000 + idx}`;
      if (source === "wellfound")   jobUrl = `https://wellfound.com/jobs/cron/${toSlug(company)}/${toSlug(role)}-${idx}`;

      jobs.push({ jobTitle, companyName: company, location, jobUrl, source });
    }
  }

  return jobs;
}

/**
 * Run a single daily refresh for one role.
 * Generates fresh job data and saves non-duplicate entries to the DB.
 */
async function refreshRole(role: string): Promise<void> {
  console.log(`[Cron] Refreshing jobs for role: "${role}"`);
  try {
    const jobs = buildJobs(role, DEFAULT_LOCATION);
    const normalizedRole = normalizeInput(role);
    const saved = await saveJobs(jobs, normalizedRole);
    console.log(`[Cron] Saved ${saved} new jobs for "${role}"`);
  } catch (err) {
    console.error(`[Cron] Failed to refresh jobs for "${role}":`, err);
  }
}
/**
 * Deletes jobs from the database that are older than 30 days.
 * Keeps the dashboard "active" and prevents database bloat.
 */
async function cleanupOutdatedJobs(): Promise<void> {
  console.log("[Cron] Running maintenance: cleaning up outdated jobs...");
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    // @ts-ignore - drizzle orm type workaround
    await db.delete(jobsTable).where(lt(jobsTable.createdAt, thirtyDaysAgo));
    console.log("[Cron] Maintenance complete. Old jobs removed.");
  } catch (err) {
    console.error("[Cron] Maintenance failed:", err);
  }
}
/**
 * startCronScheduler — call once at server startup.
 *
 * Runs a daily job refresh at 04:00 AM for all popular roles.
 * Also performs database maintenance (cleaning up old jobs).
 */
export function startCronScheduler(): void {
  // Cron expression: "0 4 * * *" = every day at 04:00 AM
  cron.schedule("0 4 * * *", async () => {
    console.log("[Cron] Daily 4:00 AM job refresh and cleanup started...");
    
    // 1. Cleanup old data
    await cleanupOutdatedJobs();

    // 2. Refresh active roles
    for (const role of DAILY_ROLES) {
      await refreshRole(role);
    }
    
    console.log("[Cron] Daily cycle complete.");
  });

  console.log(
    `[Cron] Scheduler started — daily refresh/cleanup at 04:00 AM for: ${DAILY_ROLES.join(", ")}`
  );
}
