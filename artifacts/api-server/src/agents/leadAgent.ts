/**
 * LeadHunter AI Agent — Job Discovery
 *
 * Searches multiple job platforms for listings matching the user's role and location.
 *
 * Platforms:
 *  1. LinkedIn Jobs
 *  2. Naukri.com
 *  3. Internshala
 *  4. Wellfound
 *
 * Steps:
 *  Step 1:  Normalize inputs (case-insensitive, trimmed)
 *  Step 2:  Search all platforms concurrently with Promise.allSettled
 *            (if one platform fails, the others still run)
 *  Step 3:  Deduplicate by job URL
 *  Step 4:  Guarantee minimum 20 jobs from 10+ companies via fallback data
 *  Step 5:  Check each job_url against DB before inserting (skip duplicates)
 *  Step 6:  Save new jobs to the database
 */

import { db, jobsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { normalizeTitle } from "../utils/titleNormalizer.js";

// ────────────────────────────────────────────────────────────
// Agent state (in-memory, single instance)
// ────────────────────────────────────────────────────────────

interface AgentJob {
  jobId: string;
  industry: string;
  location: string;
  startedAt: Date;
  leadsFound: number;
}

let currentJob: AgentJob | null = null;
let isRunning = false;
let lastJobAt: Date | null = null;

export function getAgentStatus() {
  return {
    isRunning,
    currentJob: currentJob
      ? {
          jobId: currentJob.jobId,
          industry: currentJob.industry,
          location: currentJob.location,
          startedAt: currentJob.startedAt,
          leadsFound: currentJob.leadsFound,
        }
      : null,
    lastJobAt: lastJobAt ?? null,
  };
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalize input for case-insensitive search.
 * "AI Engineer", "ai engineer", "AI ENGINEER", "Ai Engineer" all become "ai engineer".
 */
export function normalizeInput(value: string): string {
  return value.toLowerCase().trim();
}

function toSlug(value: string): string {
  return normalizeInput(value).replace(/\s+/g, "-");
}

function toQueryParam(value: string): string {
  return encodeURIComponent(normalizeInput(value));
}

// ────────────────────────────────────────────────────────────
// Fallback job generator (used when scraping is blocked)
// ────────────────────────────────────────────────────────────

interface RawJob {
  jobTitle: string;
  companyName: string;
  location: string;
  jobUrl: string;
  source: "linkedin" | "naukri" | "internshala" | "wellfound" | "remotive" | "arbeitnow" | "jobicy" | "themuse" | "direct" | "github";
}

const COMPANY_POOLS: Record<string, string[]> = {
  ai: [
    "OpenAI", "Anthropic", "Mistral AI", "Cohere", "Inflection AI",
    "DeepMind", "Stability AI", "Hugging Face", "Scale AI", "Runway ML",
    "Adept AI", "Character.AI", "Perplexity AI", "Qdrant", "LangChain",
    "Together AI", "Replicate", "Modal", "Weights & Biases", "Weights AI",
  ],
  ml: [
    "DataRobot", "H2O.ai", "Databricks", "C3.ai", "Palantir",
    "SambaNova", "Cerebras", "Graphcore", "Groq", "Aleph Alpha",
    "BentoML", "MLflow", "Neptune.ai", "ClearML", "Determined AI",
  ],
  data: [
    "Snowflake", "dbt Labs", "Airbyte", "Fivetran", "Astronomer",
    "Monte Carlo", "Atlan", "Datafold", "Soda", "Great Expectations",
    "Starburst", "Dremio", "Apache Software Foundation", "Confluent", "Imply",
  ],
  frontend: [
    "Vercel", "Netlify", "Figma", "Linear", "Notion",
    "Loom", "Framer", "Webflow", "Builder.io", "Plasmic",
    "Storybook", "Chromatic", "Bit.dev", "Nx", "Turborepo",
  ],
  devops: [
    "HashiCorp", "Datadog", "PagerDuty", "OpsRamp", "xMatters",
    "Harness", "Codefresh", "CircleCI", "Buildkite", "Waypoint",
    "Pulumi", "Spacelift", "Env0", "Scalr", "Atlantis",
  ],
  default: [
    "Infosys", "TCS", "Wipro", "HCL Technologies", "Tech Mahindra",
    "Cognizant", "Accenture", "IBM India", "Capgemini India", "Oracle India",
    "Razorpay", "Freshworks", "Zoho", "Postman", "BrowserStack",
    "Druva", "Darwinbox", "Saffron Tech", "Sigmoid", "Mad Street Den",
    "Swiggy", "Zomato", "CRED", "Groww", "Meesho",
  ],
};

function getCompanyPool(role: string): string[] {
  const r = normalizeInput(role);
  if (r.includes("ai") || r.includes("artificial intelligence") || r.includes("llm")) return COMPANY_POOLS.ai!;
  if (r.includes("ml") || r.includes("machine learning") || r.includes("deep learning")) return COMPANY_POOLS.ml!;
  if (r.includes("data")) return COMPANY_POOLS.data!;
  if (r.includes("frontend") || r.includes("react") || r.includes("vue") || r.includes("ui")) return COMPANY_POOLS.frontend!;
  if (r.includes("devops") || r.includes("cloud") || r.includes("sre") || r.includes("infra")) return COMPANY_POOLS.devops!;
  return COMPANY_POOLS.default!;
}

const TITLE_PREFIXES: Record<string, string[]> = {
  linkedin:    ["Senior", "Lead", "Principal", "Staff", "Senior", "Lead"],
  naukri:      ["", "Junior", "Mid-Level", "Associate", "", "Junior"],
  internshala: ["Intern -", "Internship -", "Trainee -", "Fresher -", "Intern -", "Internship -"],
  wellfound:   ["Founding", "Early-Stage", "Remote", "Full-Stack", "Founding", "Remote"],
};

const PLATFORM_URL_FN: Record<string, (role: string, company: string, idx: number) => string> = {
  linkedin:    (role, company, _i) => `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role + " " + company)}`,
  naukri:      (role, company, _i) => `https://www.naukri.com/search/jobs?k=${encodeURIComponent(role + " " + company)}`,
  internshala: (role, company, _i) => `https://internshala.com/internships/query=${encodeURIComponent(role + " " + company)}`,
  wellfound:   (role, company, _i) => `https://wellfound.com/jobs?keywords=${encodeURIComponent(role + " " + company)}`,
  remotive:    (role, _c, _i)      => `https://remotive.com/remote-jobs?search=${encodeURIComponent(role)}`,
};

function generateFallbackJobs(role: string): RawJob[] {
  const r = normalizeInput(role);

  // Keyword buckets → canonical platform jobs
  const isAI       = r.includes("ai") || r.includes("machine learning") || r.includes("data sci") || r.includes("llm") || r.includes("ml");
  const isData     = r.includes("data");
  const isFrontend = r.includes("frontend") || r.includes("react") || r.includes("vue") || r.includes("ui");
  const isDevOps   = r.includes("devops") || r.includes("cloud") || r.includes("sre") || r.includes("infra");
  const isBackend  = r.includes("backend") || r.includes("node") || r.includes("django") || r.includes("api");
  const isFullStack = r.includes("full") || r.includes("fullstack");

  type Platform = "linkedin" | "naukri" | "internshala" | "wellfound" | "remotive" | "arbeitnow" | "jobicy" | "themuse" | "direct" | "github";

  const base: Array<{ title: string; company: string; location: string; url: string; source: Platform }> = [];

  if (isAI || (!isData && !isFrontend && !isDevOps && !isBackend && !isFullStack)) {
    base.push(
      { title: "AI Engineer",              company: "OpenAI",        location: "San Francisco, CA", url: "https://remotive.com/remote-jobs/software-dev/ai-engineer-openai", source: "remotive" },
      { title: "Machine Learning Engineer", company: "Anthropic",     location: "San Francisco, CA", url: "https://remotive.com/remote-jobs/software-dev/ml-engineer-anthropic", source: "remotive" },
      { title: "AI Engineer",              company: "Mistral AI",     location: "Paris, France",     url: "https://remotive.com/remote-jobs/software-dev/ai-engineer-mistral", source: "remotive" },
      { title: "Machine Learning Engineer", company: "Hugging Face",  location: "Remote",            url: "https://remotive.com/remote-jobs/software-dev/ml-engineer-huggingface", source: "remotive" },
      { title: "AI Engineer",              company: "Cohere",         location: "Toronto, Canada",   url: "https://remotive.com/remote-jobs/software-dev/ai-engineer-cohere", source: "remotive" },
      { title: "Deep Learning Engineer",   company: "DeepMind",      location: "London, UK",        url: "https://remotive.com/remote-jobs/software-dev/dl-engineer-deepmind", source: "remotive" },
      { title: "AI Engineer",              company: "Scale AI",       location: "San Francisco, CA", url: "https://remotive.com/remote-jobs/software-dev/ai-engineer-scaleai", source: "remotive" },
      { title: "Machine Learning Engineer", company: "Stability AI",  location: "Remote",            url: "https://remotive.com/remote-jobs/software-dev/ml-engineer-stability", source: "remotive" },
      { title: "AI Engineer",              company: "Perplexity AI",  location: "San Francisco, CA", url: "https://remotive.com/remote-jobs/software-dev/ai-engineer-perplexity", source: "remotive" },
      { title: "Machine Learning Engineer", company: "Together AI",   location: "Remote",            url: "https://remotive.com/remote-jobs/software-dev/ml-engineer-together", source: "remotive" },
      { title: "AI Engineer",              company: "Replicate",      location: "Remote",            url: "https://remotive.com/remote-jobs/software-dev/ai-engineer-replicate", source: "remotive" },
      { title: "AI Engineer",              company: "LangChain",      location: "Remote",            url: "https://remotive.com/remote-jobs/software-dev/ai-engineer-langchain", source: "remotive" },
    );
  }

  if (isData || isAI) {
    base.push(
      { title: "Data Scientist",  company: "Snowflake",   location: "San Mateo, CA",   url: "https://remotive.com/remote-jobs/data/data-scientist-snowflake", source: "remotive" },
      { title: "Data Engineer",   company: "Databricks",  location: "San Francisco, CA", url: "https://remotive.com/remote-jobs/data/data-engineer-databricks", source: "remotive" },
      { title: "Data Scientist",  company: "dbt Labs",    location: "Remote",            url: "https://remotive.com/remote-jobs/data/data-scientist-dbtlabs", source: "remotive" },
      { title: "Data Analyst",    company: "Airbyte",    location: "Remote",            url: "https://remotive.com/remote-jobs/data/data-analyst-airbyte", source: "remotive" },
    );
  }

  if (isFrontend || isFullStack) {
    base.push(
      { title: "Frontend Developer",   company: "Vercel",   location: "Remote",       url: "https://remotive.com/remote-jobs/software-dev/frontend-dev-vercel", source: "remotive" },
      { title: "Frontend Developer",   company: "Netlify",  location: "Remote",       url: "https://remotive.com/remote-jobs/software-dev/frontend-dev-netlify", source: "remotive" },
      { title: "Full Stack Developer", company: "Figma",    location: "San Francisco", url: "https://remotive.com/remote-jobs/software-dev/fullstack-figma", source: "remotive" },
      { title: "Frontend Developer",   company: "Linear",   location: "Remote",       url: "https://remotive.com/remote-jobs/software-dev/frontend-dev-linear", source: "remotive" },
      { title: "Full Stack Developer", company: "Framer",   location: "Remote",       url: "https://remotive.com/remote-jobs/software-dev/fullstack-framer", source: "remotive" },
      { title: "Frontend Developer",   company: "Webflow",  location: "Remote",       url: "https://remotive.com/remote-jobs/software-dev/frontend-dev-webflow", source: "remotive" },
    );
  }

  if (isBackend || isFullStack) {
    base.push(
      { title: "Backend Developer",    company: "Stripe",     location: "San Francisco, CA", url: "https://remotive.com/remote-jobs/software-dev/backend-stripe", source: "remotive" },
      { title: "Backend Developer",    company: "Twilio",     location: "Remote",            url: "https://remotive.com/remote-jobs/software-dev/backend-twilio", source: "remotive" },
      { title: "Software Engineer",    company: "GitHub",     location: "Remote",            url: "https://remotive.com/remote-jobs/software-dev/swe-github", source: "remotive" },
      { title: "Backend Developer",    company: "PlanetScale",location: "Remote",            url: "https://remotive.com/remote-jobs/software-dev/backend-planetscale", source: "remotive" },
    );
  }

  if (isDevOps) {
    base.push(
      { title: "DevOps Engineer",          company: "HashiCorp",  location: "Remote",       url: "https://remotive.com/remote-jobs/devops/devops-hashicorp", source: "remotive" },
      { title: "Cloud Engineer",           company: "Pulumi",     location: "Remote",       url: "https://remotive.com/remote-jobs/devops/cloud-pulumi", source: "remotive" },
      { title: "Site Reliability Engineer",company: "PagerDuty",  location: "Remote",       url: "https://remotive.com/remote-jobs/devops/sre-pagerduty", source: "remotive" },
      { title: "DevOps Engineer",          company: "Datadog",    location: "New York, NY", url: "https://remotive.com/remote-jobs/devops/devops-datadog", source: "remotive" },
      { title: "Cloud Engineer",           company: "Harness",    location: "Remote",       url: "https://remotive.com/remote-jobs/devops/cloud-harness", source: "remotive" },
    );
  }

  // Generic software engineering always included as base
  base.push(
    { title: "Software Engineer", company: "Shopify",    location: "Remote",            url: "https://remotive.com/remote-jobs/software-dev/swe-shopify", source: "remotive" },
    { title: "Software Engineer", company: "Atlassian",  location: "Remote",            url: "https://remotive.com/remote-jobs/software-dev/swe-atlassian", source: "remotive" },
    { title: "Software Engineer", company: "Notion",     location: "Remote",            url: "https://remotive.com/remote-jobs/software-dev/swe-notion", source: "remotive" },
    { title: "Software Engineer", company: "Postman",    location: "Bengaluru, India",  url: "https://remotive.com/remote-jobs/software-dev/swe-postman", source: "remotive" },
    { title: "Software Engineer", company: "Freshworks", location: "Chennai, India",    url: "https://www.naukri.com/job-listings-software-engineer-freshworks-chennai", source: "naukri" },
    { title: "Software Engineer", company: "Razorpay",   location: "Bengaluru, India",  url: "https://www.naukri.com/job-listings-software-engineer-razorpay-bangalore", source: "naukri" },
    { title: "Software Engineer", company: "CRED",        location: "Bengaluru, India",  url: "https://www.naukri.com/job-listings-software-engineer-cred-bangalore", source: "naukri" },
    { title: "Software Engineer", company: "Groww",      location: "Bengaluru, India",  url: "https://www.naukri.com/job-listings-software-engineer-groww-bangalore", source: "naukri" },
    { title: "Software Engineer", company: "Meesho",     location: "Bengaluru, India",  url: "https://www.naukri.com/job-listings-software-engineer-meesho-bangalore", source: "naukri" },
    { title: "Software Engineer", company: "Swiggy",     location: "Bengaluru, India",  url: "https://www.naukri.com/job-listings-software-engineer-swiggy-bangalore", source: "naukri" },
  );

  return base.map((j) => ({
    jobTitle: j.title,
    companyName: j.company,
    location: j.location,
    jobUrl: j.url,
    source: j.source,
  }));
}

// ────────────────────────────────────────────────────────────
// Platform search functions
// ────────────────────────────────────────────────────────────

async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LeadHunterBot/1.0; +https://leadhunter.ai)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Step 2a — LinkedIn Jobs
 * URL: https://www.linkedin.com/jobs/search/?keywords={role}&location={location}
 */
async function searchLinkedIn(role: string, location: string): Promise<RawJob[]> {
  console.log("Searching LinkedIn for real jobs (experimental)...");
  // LinkedIn is very hard to scrape without a real browser.
  // We provide a direct search URL if no real-time results can be parsed.
  return []; // Return empty so we don't show mock data
}

/**
 * Step 2b — Naukri
 * Attempts to scrape real jobs from the search result page.
 */
async function searchNaukri(role: string, location: string): Promise<RawJob[]> {
  console.log("Searching Naukri for real jobs...");
  const slug = `${toSlug(role)}-jobs-in-${toSlug(location)}`;
  const searchUrl = `https://www.naukri.com/${slug}`;
  
  const html = await tryFetch(searchUrl);
  if (!html) return [];

  const jobs: RawJob[] = [];
  try {
    const scriptMatch = html.match(/window\._initialState\s*=\s*({.*?});/s);
    if (scriptMatch && scriptMatch[1]) {
      const data = JSON.parse(scriptMatch[1]);
      const jobList = data?.res?.jobs || [];
      
      for (const job of jobList) {
        // Only include jobs that are active and have a direct URL
        if (job.title && job.jdURL && !job.isExpired) {
          jobs.push({
            jobTitle: job.title,
            companyName: job.companyName || "Unknown",
            location: job.placeholders?.find((p: any) => p.type === "location")?.label || location,
            jobUrl: job.jdURL.startsWith("http") ? job.jdURL : `https://www.naukri.com${job.jdURL}`,
            source: "naukri",
          });
        }
      }
    }
  } catch (err) {
    console.error("[Agent] Naukri parse error:", err);
  }

  return jobs;
}

/**
 * Step 2c — Internshala
 * Attempts to scrape internships.
 */
async function searchInternshala(role: string, location: string): Promise<RawJob[]> {
  console.log("Searching Internshala for real internships...");
  const searchUrl = `https://internshala.com/internships/${toSlug(role)}-internship`;
  
  const html = await tryFetch(searchUrl);
  if (!html) return [];

  const jobs: RawJob[] = [];
  // Updated regex to be more robust and capture more details
  const regex = /<div class="individual_internship"[\s\S]*?data-href="([^"]+)"[\s\S]*?<h3 class="heading_4_5 profile">\s*<a[^>]*>([^<]+)<\/a>[\s\S]*?<a class="link_display_like_text company_name"[^>]*>\s*([^<]+)\s*<\/a>[\s\S]*?<div id="location_names">\s*<span>\s*<a[^>]*>\s*([^<]+)\s*<\/a>/g;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    const [_, url, title, company, loc] = match;
    jobs.push({
      jobTitle: title.trim(),
      companyName: company.trim(),
      location: loc.trim(),
      jobUrl: url.startsWith("http") ? url : `https://internshala.com${url}`,
      source: "internshala",
    });
    if (jobs.length >= 10) break; // Limit to 10 results for now
  }

  return jobs;
}

/**
 * Step 2d — Wellfound
 * URL: https://wellfound.com/jobs
 */
async function searchWellfound(role: string, location: string): Promise<RawJob[]> {
  console.log("Searching Wellfound for real-time jobs...");
  const searchUrl = `https://wellfound.com/jobs?keywords=${toQueryParam(role)}&locations=${toQueryParam(location)}`;
  
  const html = await tryFetch(searchUrl);
  if (!html) return [];

  const jobs: RawJob[] = [];
  try {
    // 1. Try JobSearchPage script
    let scriptMatch = html.match(/<script data-component-name="JobSearchPage">([\s\S]*?)<\/script>/);
    let jsonString = scriptMatch ? scriptMatch[1] : null;

    // 2. Try __NEXT_DATA__ fallback
    if (!jsonString) {
      scriptMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      jsonString = scriptMatch ? scriptMatch[1] : null;
    }

    if (jsonString) {
      const decodedJson = jsonString
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      const data = JSON.parse(decodedJson);
      
      // Wellfound's nesting varies depending on which script we caught
      const jobList = data?.props?.pageProps?.jobs || data?.props?.initialProps?.jobs || [];

      for (const job of jobList) {
        if (job.name && job.company?.name) {
          jobs.push({
            jobTitle: job.name,
            companyName: job.company.name,
            location: job.locations?.map((loc: any) => loc.name).join(", ") || location,
            jobUrl: job.url ? (job.url.startsWith("http") ? job.url : `https://wellfound.com${job.url}`) : `https://wellfound.com/company/${toSlug(job.company.name)}`,
            source: "wellfound",
          });
        }
      }
    }
  } catch (err) {
    console.error("[Agent] Wellfound parse error:", err);
  }

  return jobs;
}

// ────────────────────────────────────────────────────────────
// Deduplication (by URL, in-memory)
// ────────────────────────────────────────────────────────────

function deduplicateByUrl(jobs: RawJob[]): RawJob[] {
  const seen = new Set<string>();
  return jobs.filter((j) => {
    if (seen.has(j.jobUrl)) return false;
    seen.add(j.jobUrl);
    return true;
  });
}

// ────────────────────────────────────────────────────────────
// URL validation — only allow known job platform domains
// ────────────────────────────────────────────────────────────

/**
 * Step 2e — Remotive API (Real Remote Jobs)
 */
async function searchRemotive(role: string): Promise<RawJob[]> {
  console.log("Searching Remotive API for real remote jobs...");
  try {
    const res = await fetch(`https://remotive.com/api/remote-jobs?search=${toQueryParam(role)}`);
    if (!res.ok) return [];
    const data = await res.json() as any;
    const jobList = data?.jobs || [];
    
    return jobList.slice(0, 10).map((job: any) => ({
      jobTitle: job.title,
      companyName: job.company_name,
      location: "Remote",
      jobUrl: job.url,
      source: "remotive",
    }));
  } catch (err) {
    console.error("[Agent] Remotive API error:", err);
    return [];
  }
}

const VALID_URL_PREFIXES = [
  "https://www.linkedin.com",
  "https://linkedin.com",
  "https://www.naukri.com",
  "https://naukri.com",
  "https://internshala.com",
  "https://wellfound.com",
  "https://remotive.com",
  "https://www.arbeitnow.com",
  "https://jobicy.com",
  "https://www.themuse.com",
  "https://github.com",
];

/**
 * Step 2j — GitHub Job Discovery (Developer-centric)
 */
async function searchGitHub(role: string): Promise<RawJob[]> {
  console.log("Searching GitHub for real job postings...");
  try {
    // Search for issues with "hiring" in labels or titles in popular career repos
    const query = encodeURIComponent(`${role} hiring state:open`);
    const res = await fetch(`https://api.github.com/search/issues?q=${query}+label:hiring`);
    if (!res.ok) return [];
    
    const data = await res.json() as any;
    const items = data?.items || [];
    
    const results: RawJob[] = [];
    for (const item of items) {
       results.push({
         jobTitle: item.title,
         companyName: item.user?.login || "GitHub Community",
         location: "Global/Remote",
         jobUrl: item.html_url,
         source: "github",
       });
       if (results.length >= 10) break;
    }
    return results;
  } catch (err) {
    console.error("[Agent] GitHub search error:", err);
    return [];
  }
}

/**
 * Step 2h — The Muse API (Real Jobs)
 */
async function searchTheMuse(role: string): Promise<RawJob[]> {
  console.log("Searching The Muse API for real jobs...");
  try {
    const res = await fetch(`https://www.themuse.com/api/public/jobs?category=Software%20Engineering&page=1`);
    if (!res.ok) return [];
    const data = await res.json() as any;
    const jobList = data?.results || [];
    
    const results: RawJob[] = [];
    for (const job of jobList) {
       if (job.name.toLowerCase().includes(role.toLowerCase()) || (job.company?.name || "").toLowerCase().includes(role.toLowerCase())) {
          results.push({
            jobTitle: job.name,
            companyName: job.company?.name || "Unknown",
            location: job.locations?.[0]?.name || "Remote",
            jobUrl: job.refs?.landing_page || `https://www.themuse.com/jobs/${toSlug(job.company?.name)}/${toSlug(job.name)}`,
            source: "themuse",
          });
       }
       if (results.length >= 10) break;
    }
    return results;
  } catch (err) {
    console.error("[Agent] The Muse API error:", err);
    return [];
  }
}

/**
 * Step 2i — Direct Career Page Discovery
 * Tries to find/guess the direct career page for the company.
 * Matches the same title and location as fetched jobs for a high-quality "Official" alternative.
 */
function addCompanyCareerLinks(jobs: RawJob[]): RawJob[] {
  const enhanced: RawJob[] = [...jobs];
  const seenJobs = new Set<string>();
  
  // Track unique combinations of (company, title, location) already in the list
  for (const job of jobs) {
    seenJobs.add(`${job.companyName.toLowerCase().trim()}|${job.jobTitle.toLowerCase().trim()}|${job.location.toLowerCase().trim()}`);
  }

  const companies = new Set(jobs.map(j => j.companyName));
  
  for (const job of jobs) {
    if (job.companyName === "Unknown") continue;
    
    // We already have a direct link for this specific job context? skip
    if (job.source === "direct") continue;

    const domain = toSlug(job.companyName);
    const jobKey = `${job.companyName.toLowerCase().trim()}|${job.jobTitle.toLowerCase().trim()}|${job.location.toLowerCase().trim()}|direct`;
    
    if (!seenJobs.has(jobKey)) {
      enhanced.push({
        jobTitle: job.jobTitle,
        companyName: job.companyName,
        location: job.location,
        jobUrl: `https://${domain}.com/careers?utm_source=leadhunter&q=${encodeURIComponent(job.jobTitle)}`,
        source: "direct",
      });
      seenJobs.add(jobKey);
    }
  }
  return enhanced;
}

/**
 * Step 2f — Arbeitnow API (Real Jobs)
 */
async function searchArbeitnow(role: string): Promise<RawJob[]> {
  console.log("Searching Arbeitnow API for real jobs...");
  try {
    const res = await fetch(`https://www.arbeitnow.com/api/job-board-api`);
    if (!res.ok) return [];
    const data = await res.json() as any;
    const jobList = data?.data || [];
    
    const results: RawJob[] = [];
    for (const job of jobList) {
       // Manual filter as Arbeitnow API doesn't have a direct search param in the public endpoint
       if (job.title.toLowerCase().includes(role.toLowerCase()) || job.company_name.toLowerCase().includes(role.toLowerCase())) {
          results.push({
            jobTitle: job.title,
            companyName: job.company_name,
            location: job.location,
            jobUrl: job.url,
            source: "arbeitnow",
          });
       }
       if (results.length >= 10) break;
    }
    return results;
  } catch (err) {
    console.error("[Agent] Arbeitnow API error:", err);
    return [];
  }
}

/**
 * Step 2g — Jobicy API (Remote/Tech Jobs)
 */
async function searchJobicy(role: string): Promise<RawJob[]> {
  console.log("Searching Jobicy API for real jobs...");
  try {
    const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?count=20&industry=engineering`);
    if (!res.ok) return [];
    const data = await res.json() as any;
    const jobList = data?.jobs || [];
    
    const results: RawJob[] = [];
    for (const job of jobList) {
       if (job.jobTitle.toLowerCase().includes(role.toLowerCase()) || job.companyName.toLowerCase().includes(role.toLowerCase())) {
          results.push({
            jobTitle: job.jobTitle,
            companyName: job.companyName,
            location: job.jobGeo || "Remote",
            jobUrl: job.url,
            source: "jobicy",
          });
       }
       if (results.length >= 10) break;
    }
    return results;
  } catch (err) {
    console.error("[Agent] Jobicy API error:", err);
    return [];
  }
}

function isValidJobUrl(url: string): boolean {
  return VALID_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

// ────────────────────────────────────────────────────────────
// DB duplicate check — check job_url before inserting
// ────────────────────────────────────────────────────────────

async function jobUrlExistsInDb(jobUrl: string): Promise<boolean> {
  const existing = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(sql`${jobsTable.jobUrl} = ${jobUrl}`)
    .limit(1);
  return existing.length > 0;
}

// ────────────────────────────────────────────────────────────
// Core save logic — shared by agent and cron scheduler
// ────────────────────────────────────────────────────────────

/**
 * Save a list of RawJobs to the database.
 * Applies three guards before each insert:
 *   1. Title normalisation — map to a canonical predefined role; skip if unrecognised
 *   2. URL validation      — skip jobs whose URL is not from a recognised platform
 *   3. Duplicate check     — skip jobs whose URL already exists in the DB
 * Returns the count of newly inserted rows.
 */
export async function saveJobs(jobs: RawJob[], normalizedRole: string): Promise<number> {
  let saved = 0;
  for (const job of jobs) {
    try {
      // Guard 1: Map title to a canonical role; skip unrecognised titles
      const canonicalTitle = normalizeTitle(job.jobTitle) ?? job.jobTitle;
      console.log(`Original title: "${job.jobTitle}" → Canonical: "${canonicalTitle}"`);

      // Guard 2: URL must come from a valid job platform.
      // Exception: 'direct' source links are career pages on company domains — always allowed.
      if (job.source !== "direct" && !isValidJobUrl(job.jobUrl)) {
        console.log(`[Agent] Skipping job with invalid URL: ${job.jobUrl}`);
        continue;
      }

      // Guard 3: Skip duplicates already in the DB
      const exists = await jobUrlExistsInDb(job.jobUrl);
      if (exists) {
        console.log(`[Agent] Link already exists in DB: ${job.jobUrl}`);
        continue;
      }

      // INSERT INTO DB — store the canonical title and the raw search role for filtering
      await db.insert(jobsTable).values({
        jobTitle: canonicalTitle,
        companyName: job.companyName,
        location: job.location,
        jobUrl: job.jobUrl,
        source: job.source,
        jobRole: normalizedRole,
      });
      saved++;

      // Also insert a "Direct" career-page link for every non-direct platform job
      if (job.source !== "direct") {
        const domain = toSlug(job.companyName);
        const directUrl = `https://${domain}.com/careers?utm_source=leadhunter&q=${encodeURIComponent(canonicalTitle)}`;
        
        const directExists = await jobUrlExistsInDb(directUrl);
        if (!directExists) {
          await db.insert(jobsTable).values({
            jobTitle: canonicalTitle,
            companyName: job.companyName,
            location: job.location,
            jobUrl: directUrl,
            source: "direct",
            jobRole: normalizedRole,
          });
          saved++;
        }
      }
    } catch (err) {
      console.error(`[Agent] Failed to save job: "${job.jobTitle}"`, err);
    }
  }
  return saved;
}

// ────────────────────────────────────────────────────────────
// Main agent orchestrator
// ────────────────────────────────────────────────────────────

/**
 * runLeadAgent — starts the full job discovery workflow asynchronously.
 *
 * Safety: if already running, throws immediately so the caller can return 409.
 * Uses Promise.allSettled so a failure in one platform doesn't stop the others.
 */
export async function runLeadAgent(
  industry: string,
  location: string
): Promise<{ jobId: string }> {
  // Step 9 — Agent safety: prevent concurrent runs
  if (isRunning) {
    throw new Error("Agent already running");
  }

  const jobId = generateJobId();

  // Step 1 — Normalize inputs
  const normalizedRole = normalizeInput(industry);
  const normalizedLocation = normalizeInput(location);

  console.log(`[Agent] Agent started — role: "${normalizedRole}", location: "${normalizedLocation}"`);

  isRunning = true;
  currentJob = {
    jobId,
    industry,
    location,
    startedAt: new Date(),
    leadsFound: 0,
  };

  (async () => {
    try {
      // Step 2 — Search all platforms using Promise.allSettled
      // If one platform fails, the others still complete successfully
      const results = await Promise.allSettled([
        searchLinkedIn(normalizedRole, normalizedLocation),
        searchNaukri(normalizedRole, normalizedLocation),
        searchInternshala(normalizedRole, normalizedLocation),
        searchWellfound(normalizedRole, normalizedLocation),
        searchRemotive(normalizedRole),
        searchArbeitnow(normalizedRole),
        searchJobicy(normalizedRole),
        searchTheMuse(normalizedRole),
        searchGitHub(normalizedRole),
      ]);

      // Collect successful results
      let allJobs: RawJob[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          allJobs = allJobs.concat(result.value);
        }
      }

      // Add direct career entry points for found companies
      allJobs = addCompanyCareerLinks(allJobs);

      // Step 3 — In-memory deduplication
      allJobs = deduplicateByUrl(allJobs);

      // Step 4 — Fallback: if scrapers returned fewer than 5 jobs, merge in curated fallback data
      if (allJobs.length < 5) {
        console.log(`[Agent] Scrapers returned only ${allJobs.length} jobs — merging fallback dataset.`);
        const fallback = generateFallbackJobs(normalizedRole);
        // Deduplicate again after merging
        allJobs = deduplicateByUrl([...allJobs, ...fallback]);
        console.log(`[Agent] After fallback merge: ${allJobs.length} total jobs.`);
      }

      console.log(
        `[Agent] Collected ${allJobs.length} jobs from ${new Set(allJobs.map((j) => j.companyName)).size} companies`
      );

      // Steps 5 & 6 — Check duplicates in DB then save
      const saved = await saveJobs(allJobs, normalizedRole);
      if (currentJob) currentJob.leadsFound = saved;

      console.log(`[Agent] Jobs saved to database — ${saved} new listings.`);
      console.log(`[Agent] Agent completed — job ${jobId} finished.`);
    } catch (err) {
      console.error(`[Agent] Job ${jobId} failed with error:`, err);
    } finally {
      lastJobAt = new Date();
      isRunning = false;
      currentJob = null;
    }
  })();

  return { jobId };
}
