/**
 * AI Job Summary route
 *
 * POST /api/job-summary
 *
 * Accepts raw job description text and returns a structured summary:
 *   - requiredSkills      — extracted technical skills and tools mentioned
 *   - experienceLevel     — inferred seniority from keywords
 *   - keyResponsibilities — bullet-point sentences describing the core duties
 *
 * Uses pattern-based NLP (no external AI API needed). Works offline and is
 * deterministic, making it suitable for a demo environment.
 */

import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ── Known tech skill keywords ──────────────────────────────────────
const TECH_SKILLS = new Set([
  // Languages
  "javascript","typescript","python","java","c++","c#","go","golang","rust",
  "swift","kotlin","ruby","php","scala","r","matlab","bash","shell","sql",
  "html","css","sass","scss",
  // Frameworks / libraries
  "react","vue","angular","nextjs","nuxt","svelte","express","fastapi",
  "django","flask","spring","rails","laravel","nestjs","graphql","restapi",
  "tensorflow","pytorch","keras","scikit-learn","pandas","numpy","spark",
  "kafka","airflow","dbt","langchain","openai","huggingface",
  // Cloud / DevOps
  "aws","gcp","azure","docker","kubernetes","terraform","ansible","jenkins",
  "github","gitlab","bitbucket","ci/cd","linux","unix","nginx","redis",
  "mongodb","postgresql","mysql","elasticsearch","snowflake","databricks",
  // Other
  "machine learning","deep learning","nlp","computer vision","llm","rag",
  "agile","scrum","jira","figma","postman","microservices","soa","grpc",
]);

// Seniority signal keywords
const SENIOR_SIGNALS = ["senior","lead","principal","staff","architect","head","director","vp","manager"];
const JUNIOR_SIGNALS = ["junior","entry","intern","internship","trainee","fresher","graduate","associate"];
const MID_SIGNALS    = ["mid-level","mid level","intermediate","engineer ii","engineer 2"];

// Phrases that often precede responsibility sentences
const RESPONSIBILITY_TRIGGERS = [
  /you will\b/i,
  /responsibilities\b/i,
  /you['']ll\b/i,
  /your role\b/i,
  /key duties\b/i,
  /duties include\b/i,
  /what you['']ll do\b/i,
  /role involves\b/i,
];

/**
 * Split text into sentences (rough split on . ! ? and newlines).
 */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 300);
}

/**
 * Extract tech skills that appear in the description.
 */
function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const skill of TECH_SKILLS) {
    // Use word-boundary style check
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`).test(lower)) {
      found.push(skill);
    }
  }
  return [...new Set(found)].slice(0, 15); // deduplicated, max 15
}

/**
 * Infer experience level from seniority keywords.
 */
function inferExperience(text: string): string {
  const lower = text.toLowerCase();
  if (SENIOR_SIGNALS.some((k) => lower.includes(k))) return "Senior (5+ years)";
  if (MID_SIGNALS.some((k) => lower.includes(k)))    return "Mid-level (2–5 years)";
  if (JUNIOR_SIGNALS.some((k) => lower.includes(k))) return "Junior / Entry-level (0–2 years)";

  // Heuristic: check for year ranges like "3+ years" or "5 years"
  const yearMatch = lower.match(/(\d+)\+?\s*years?\s+(?:of\s+)?experience/);
  if (yearMatch) {
    const years = parseInt(yearMatch[1] ?? "0", 10);
    if (years >= 5) return `Senior (${years}+ years)`;
    if (years >= 2) return `Mid-level (${years}+ years)`;
    return `Junior (${years}+ years)`;
  }

  return "Not specified";
}

/**
 * Pull out up to 5 responsibility sentences from the description.
 */
function extractResponsibilities(text: string): string[] {
  const all = sentences(text);
  const scored = all.map((s) => {
    let score = 0;
    if (RESPONSIBILITY_TRIGGERS.some((re) => re.test(s))) score += 3;
    if (/\b(design|build|develop|implement|lead|manage|maintain|create|deliver|own|drive)\b/i.test(s)) score += 2;
    if (s.startsWith("-") || s.startsWith("•") || s.startsWith("*")) score += 1;
    return { s, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ s }) => s.replace(/^[-•*]\s*/, ""));
}

/**
 * POST /api/job-summary
 */
router.post("/job-summary", (req, res) => {
  try {
    const { jobDescription } = req.body ?? {};
    if (typeof jobDescription !== "string" || jobDescription.length < 20) {
      res.status(400).json({ error: "jobDescription must be a string with at least 20 characters" });
      return;
    }

    const requiredSkills      = extractSkills(jobDescription);
    const experienceLevel     = inferExperience(jobDescription);
    const keyResponsibilities = extractResponsibilities(jobDescription);

    console.log(
      `[JobSummary] Skills: ${requiredSkills.length} | Experience: ${experienceLevel} | Responsibilities: ${keyResponsibilities.length}`
    );

    res.json({ requiredSkills, experienceLevel, keyResponsibilities });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
